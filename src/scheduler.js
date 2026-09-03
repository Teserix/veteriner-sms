import { config } from './config.js';
import { clinics } from './db/master.js';
import { openTenant, getSettings, reminders } from './db/tenant.js';
import { dispatch } from './sms/dispatch.js';
import { renderTemplate } from './sms/index.js';
import { nowLocal, nowIso, formatDate, addDays, REMINDER_TYPES } from './util.js';
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
 * Tek bir hatırlatma için SMS gönderir, durumu günceller, tekrar varsa sonrakini oluşturur.
 * Zamanlayıcı ve "Şimdi gönder" düğmesi bunu kullanır.
 */
export async function sendReminderSms(clinicId, db, settings, r, sentBy = 'zamanlayici') {
  const message = buildMessage(settings, r);
  const result = await dispatch({
    clinicId, db, settings, kind: 'reminder', to: r.owner_phone, message,
    owner: { id: r.owner_id, name: r.owner_name, sms_opt_in: r.sms_opt_in },
    pet: { id: r.pet_id, name: r.pet_name },
    reminderId: r.id, sentBy,
  });
  const at = nowIso();

  if (result.ok) {
    reminders.markSent(db, r.id, at);
    if (r.repeat_days && r.repeat_days > 0) {
      reminders.create(db, {
        pet_id: r.pet_id, type: r.type, title: r.title,
        due_date: addDays(r.due_date, r.repeat_days),
        notify_days_before: r.notify_days_before, repeat_days: r.repeat_days,
        notes: r.notes, created_at: at, created_by: 'tekrar',
      });
    }
  } else if (!result.skipped) {
    // Gerçek gönderim hatası: deneme sayısı artar, 3'te 'failed'
    reminders.markAttemptFailed(db, r.id, at, result.error || 'Bilinmeyen hata', MAX_ATTEMPTS);
  }
  return { ...result, message };
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
      const res = await sendReminderSms(clinicId, db, settings, r, 'zamanlayici');
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
