import { config } from './config.js';
import { clinics } from './db/master.js';
import { openTenant, getSettings, reminders } from './db/tenant.js';
import { dispatchUnlocked, lockKey } from './sms/dispatch.js';
import { renderTemplate } from './sms/index.js';
import { withLock } from './lock.js';
import { nowLocal, nowIso, todayLocal, formatDate, addDays, REMINDER_TYPES } from './util.js';
import { log } from './log.js';
import { maybeBackup } from './backup.js';

const MAX_ATTEMPTS = 3;
const RETRY_AFTER_MS = 4 * 60 * 60 * 1000; // başarısız denemeden 4 saat sonra tekrar

/** Hatırlatma için SMS metnini üretir */
export function buildMessage(settings, r) {
  return renderTemplate(settings.template, {
    sahip: r.owner_name,
    hayvan: r.pet_name,
    tarih: formatDate(r.due_date),
    tur: r.title || REMINDER_TYPES[r.type] || r.type,
    klinik: settings.clinic_name || '',
    klinik_tel: settings.clinic_phone || '',
  });
}

/**
 * Tekrarlayan hatırlatmanın bir sonraki tarihi: bildirim günü (due - notify) bugünden SONRA
 * olana kadar repeat_days adımlarıyla ilerler; böylece yeni kayıt hemen "bugün gönderilecek" olmaz.
 */
export function nextDueDate(dueDate, repeatDays, notifyDays, today) {
  const step = Math.max(1, Number(repeatDays) || 1);
  let next = addDays(dueDate, step);
  let guard = 0;
  while (addDays(next, -Number(notifyDays || 0)) <= today && guard++ < 5000) next = addDays(next, step);
  return next;
}

function createNextOccurrence(db, r, at, today) {
  if (!r.repeat_days || r.repeat_days <= 0) return null;
  const due = nextDueDate(r.due_date, r.repeat_days, r.notify_days_before, today);
  if (reminders.existsPending(db, r.pet_id, r.title, due)) return null;
  return reminders.create(db, {
    pet_id: r.pet_id, type: r.type, title: r.title, due_date: due,
    notify_days_before: r.notify_days_before, repeat_days: r.repeat_days,
    notes: r.notes, created_at: at, created_by: 'tekrar',
  });
}

/**
 * Tek bir hatırlatma için SMS gönderir, durumu günceller, tekrar varsa sonrakini oluşturur.
 * Zamanlayıcı ve "Şimdi gönder" düğmesi bunu kullanır. Klinik kilidi altında çalışır:
 * satır yeniden okunur, artık beklemede değilse gönderilmez (çift gönderim yok).
 */
export function sendReminderSms(clinicId, db, settings, r, sentBy = 'zamanlayici', now = new Date()) {
  return withLock(lockKey(clinicId), async () => {
    const fresh = reminders.get(db, r.id);
    if (!fresh || fresh.status !== 'pending') {
      return { ok: false, skipped: 'state', error: 'Hatırlatma artık beklemede değil (gönderilmiş ya da kapatılmış).' };
    }
    const at = nowIso();
    const today = todayLocal(now);
    const prevAttempt = fresh.last_attempt_at;
    reminders.claim(db, fresh.id, at); // çökme koruması: yarım kalan gönderim 4 saat içinde tekrar denenmez
    const message = buildMessage(settings, fresh);
    const result = await dispatchUnlocked({
      clinicId, db, settings, kind: 'reminder', to: fresh.owner_phone, message,
      owner: { id: fresh.owner_id, name: fresh.owner_name, sms_opt_in: fresh.sms_opt_in },
      pet: { id: fresh.pet_id, name: fresh.pet_name },
      reminderId: fresh.id, sentBy,
    });

    if (result.ok) {
      reminders.markSent(db, fresh.id, at);
      createNextOccurrence(db, fresh, at, today);
    } else if (result.skipped) {
      // Tavan / opt-out: gönderim denenmedi, izi geri al
      reminders.setLastAttempt(db, fresh.id, prevAttempt);
    } else {
      reminders.markAttemptFailed(db, fresh.id, at, result.error || 'Bilinmeyen hata', MAX_ATTEMPTS);
      const after = reminders.get(db, fresh.id);
      // Kalıcı başarısızlık tekrar serisini bitirmesin: sonraki dönem yine oluşturulur
      if (after?.status === 'failed') createNextOccurrence(db, fresh, at, today);
    }
    return { ...result, message };
  });
}

/** Bir kliniğin bugün gönderilmesi gereken hatırlatmalarını işler */
export async function processClinic(clinicId, now = new Date()) {
  const db = openTenant(clinicId);
  const settings = getSettings(db);
  if (settings.scheduler_enabled !== '1') return { skipped: 'kapali', sent: 0, failed: 0 };

  const { date: today, hour } = nowLocal(now);
  const start = Number(settings.send_hour_start ?? 9);
  const end = Number(settings.send_hour_end ?? 20);
  if (hour < start || hour >= end) return { skipped: 'saat-disi', sent: 0, failed: 0 };

  const due = reminders.due(db, today);
  let sent = 0, failed = 0, skipped = 0;
  const nowMs = now.getTime();

  for (const r of due) {
    if (!r.sms_opt_in) { skipped++; continue; }
    if (r.last_attempt_at && nowMs - new Date(r.last_attempt_at).getTime() < RETRY_AFTER_MS) { skipped++; continue; }
    try {
      const res = await sendReminderSms(clinicId, db, settings, r, 'zamanlayici', now);
      if (res.ok) sent++;
      else if (res.skipped === 'cap') { skipped += due.length - sent - failed - skipped; break; }
      else if (res.skipped) skipped++;
      else failed++;
    } catch (e) {
      failed++;
      log.error('hatırlatma gönderilemedi', { clinicId, reminderId: r.id, error: e.message });
    }
  }
  return { sent, failed, skipped };
}

let running = null; // çalışan tick'in promise'i
let timer = null;

export async function tick(now = new Date()) {
  if (running) return running;
  running = (async () => {
    try {
      for (const c of clinics.active()) {
        try {
          const r = await processClinic(c.id, now);
          if (r.sent || r.failed) log.info('zamanlayıcı', { clinic: c.id, sent: r.sent, failed: r.failed, skipped: r.skipped });
        } catch (e) {
          log.error('klinik işlenemedi', { clinic: c.id, error: e.message });
        }
      }
      await maybeBackup(now);
    } finally {
      running = null;
    }
  })();
  return running;
}

export function startScheduler() {
  if (!config.enableScheduler) {
    log.warn('Zamanlayıcı kapalı (ENABLE_SCHEDULER=1 verilmedi); otomatik SMS gönderilmeyecek.');
    return;
  }
  const ms = config.schedulerIntervalSeconds * 1000;
  log.info(`zamanlayıcı her ${config.schedulerIntervalSeconds} sn'de bir çalışacak`);
  setTimeout(() => tick(), 5000).unref();
  timer = setInterval(() => tick(), ms);
  timer.unref();
}

/** Çalışan tick'i bekleyip zamanlayıcıyı durdurur (graceful shutdown) */
export async function stopScheduler() {
  if (timer) { clearInterval(timer); timer = null; }
  if (running) { try { await running; } catch { /* yoksay */ } }
}
