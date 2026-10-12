import { config } from './config.js';
import { clinics } from './db/master.js';
import { openTenant, getSettings, reminders, owners } from './db/tenant.js';
import { dispatchUnlocked, lockKey } from './sms/dispatch.js';
import { smsMode } from './sms/index.js';
import { composeFromTemplate, bodyProblems, previewParts, sameBody, oneLineBody } from './sms/policy.js';
import { randomId } from './crypto.js';
import { withLock } from './lock.js';
import { nowLocal, nowIso, todayLocal, formatDate, addDays, REMINDER_TYPES } from './util.js';
import { log } from './log.js';
import { maybeBackup } from './backup.js';
import { maybeRetention } from './retention.js';

const MAX_ATTEMPTS = 3;
const RETRY_AFTER_MS = 4 * 60 * 60 * 1000; // başarısız denemeden 4 saat sonra tekrar

/** Hatırlatma satırından şablon değişkenleri (gönderim ve önizleme rotası aynısını kullanır) */
export function buildReminderVars(settings, r) {
  return {
    sahip: r.owner_name,
    hayvan: r.pet_name,
    tarih: formatDate(r.due_date),
    tur: r.title || REMINDER_TYPES[r.type] || r.type,
    klinik: settings.clinic_name || '',
    klinik_tel: settings.clinic_phone || '',
  };
}

/** Hatırlatma için SMS metnini üretir (şablon ya da düzenlenmiş gövde + zorunlu kimlik/iptal kuyruğu) */
export function buildMessage(settings, r, clinicId = '', bodyOverride) {
  return composeFromTemplate(settings, buildReminderVars(settings, r), { clinicId, optOutToken: r.opt_out_token || '', bodyOverride });
}

/** Migrasyon 3 öncesi kayıtlarda ret belirteci yoktur; ilk gönderimde üretilir */
export function ensureOptOutToken(db, ownerId, current) {
  if (current) return current;
  const token = randomId(16);
  owners.setOptOutToken(db, ownerId, token);
  return token;
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
 * bodyOverride: kullanıcının önizlemede gönderdiği gövde (string), şablona dönüş (null) ya da verilmez (undefined:
 * kayıtlı düzenlenmiş gövde, örn. sağlayıcı hatasından sonraki otomatik tekrar). Karşılaştırma ve bodyProblems denetimi
 * kilit içinde taze kayıtla yapılır; böylece gönderilen metin kullanıcının gördüğüyle aynıdır. Verilen gövde geçersizse
 * gönderilmez, iz geri alınır (skipped: 'invalid'; rota 400 önizleme gösterir). Kayıtlı gövde sonradan geçersizleşmişse
 * şablon onun yerine gönderilmez: deneme başarısız sayılır (markAttemptFailed, last_error), MAX_ATTEMPTS sonunda
 * 'failed' olur; önizlemeden düzeltilip tekrar gönderilebilir. Sonuçta edited /
 * originalLength / newLength (denetim kaydı için; metin değil) döner.
 */
export function sendReminderSms(clinicId, db, settings, r, sentBy = 'zamanlayici', now = new Date(), { bodyOverride } = {}) {
  return withLock(lockKey(clinicId), async () => {
    const fresh = reminders.get(db, r.id);
    if (!fresh || fresh.status !== 'pending') {
      return { ok: false, skipped: 'state', error: 'Hatırlatma artık beklemede değil (gönderilmiş ya da kapatılmış).' };
    }
    const at = nowIso();
    const today = todayLocal(now);
    const prevAttempt = fresh.last_attempt_at;
    reminders.claim(db, fresh.id, at); // çökme koruması: yarım kalan gönderim 4 saat içinde tekrar denenmez
    fresh.opt_out_token = ensureOptOutToken(db, fresh.owner_id, fresh.opt_out_token);
    const optOpts = { clinicId, optOutToken: fresh.opt_out_token };
    const vars = buildReminderVars(settings, fresh);
    const { originalBody } = previewParts(settings, vars, optOpts);
    let override = bodyOverride === undefined ? (fresh.body_override ?? null) : bodyOverride;
    if (override != null && sameBody(override, originalBody)) override = null;
    const lengths = { originalLength: oneLineBody(originalBody).length };
    if (override != null) {
      const problems = bodyProblems(override, settings, optOpts);
      if (problems.length) {
        const invalid = { edited: true, ...lengths, newLength: oneLineBody(override).length };
        if (bodyOverride !== undefined) {
          reminders.setLastAttempt(db, fresh.id, prevAttempt); // elle gönderim: kullanıcı 400 önizlemede düzeltir, izi geri al
          return { ok: false, skipped: 'invalid', error: problems.join(' '), ...invalid };
        }
        // Kayıtlı gövde geçersizleşti: şablon onun yerine sessizce gönderilmez; deneme sayılır, last_error görünür olur
        const error = 'Kayıtlı düzenlenmiş gövde geçersiz: ' + problems.join(' ');
        reminders.markAttemptFailed(db, fresh.id, at, error, MAX_ATTEMPTS);
        if (reminders.get(db, fresh.id)?.status === 'failed') createNextOccurrence(db, fresh, at, today);
        return { ok: false, error, ...invalid };
      }
    }
    if (bodyOverride !== undefined) reminders.setBodyOverride(db, fresh.id, override);
    const parts = previewParts(settings, vars, { ...optOpts, bodyOverride: override ?? undefined });
    const message = parts.full;
    const meta = { edited: override != null, ...lengths, newLength: parts.body.length };
    const result = await dispatchUnlocked({
      clinicId, db, settings, kind: 'reminder', to: fresh.owner_phone, message, optOutToken: fresh.opt_out_token,
      owner: { id: fresh.owner_id, name: fresh.owner_name, sms_opt_in: fresh.sms_opt_in },
      pet: { id: fresh.pet_id, name: fresh.pet_name },
      reminderId: fresh.id, sentBy,
    });

    if (result.ok && result.simulated) {
      // SMS_MODE live değil: hiçbir şey gönderilmedi. Hatırlatma açık (pending) kalır, markSent/createNextOccurrence yok;
      // deneme izi geri alınır, simulated_at yazılır (processClinic aynı gün yeniden işlemez)
      reminders.markSimulated(db, fresh.id, now.toISOString(), prevAttempt); // 'now' ile: processClinic aynı yerel günü buna göre karşılaştırır
    } else if (result.ok) {
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
    return { ...result, message, ...meta };
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
  let sent = 0, failed = 0, skipped = 0, simulated = 0;
  const nowMs = now.getTime();

  for (const r of due) {
    if (!r.sms_opt_in) { skipped++; continue; }
    if (r.simulated_at && nowLocal(new Date(r.simulated_at)).date === today) { skipped++; continue; } // bugün zaten simüle edildi
    if (r.last_attempt_at && nowMs - new Date(r.last_attempt_at).getTime() < RETRY_AFTER_MS) { skipped++; continue; }
    try {
      const res = await sendReminderSms(clinicId, db, settings, r, 'zamanlayici', now);
      if (res.ok && res.simulated) simulated++;
      else if (res.ok) sent++;
      else if (res.skipped === 'cap') { skipped += due.length - sent - failed - skipped; break; }
      else if (res.skipped) skipped++;
      else failed++;
    } catch (e) {
      failed++;
      log.error('hatırlatma gönderilemedi', { clinicId, reminderId: r.id, error: e.message });
    }
  }
  return simulated ? { sent, failed, skipped, simulated } : { sent, failed, skipped };
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
          if (r.sent || r.failed || r.simulated) log.info('zamanlayıcı', { clinic: c.id, sent: r.sent, failed: r.failed, skipped: r.skipped, simulated: r.simulated || 0 });
        } catch (e) {
          log.error('klinik işlenemedi', { clinic: c.id, error: e.message });
        }
      }
      await maybeBackup(now);
      await maybeRetention(now);
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Döner: zamanlayıcı başlatıldıysa true. Güvenli taraf: yalnız ENABLE_SCHEDULER açık VE SMS_MODE tam olarak 'live' iken başlar. */
export function startScheduler() {
  if (!config.enableScheduler) {
    log.warn('Zamanlayıcı kapalı (ENABLE_SCHEDULER=1 verilmedi); otomatik SMS gönderilmeyecek.');
    return false;
  }
  if (smsMode() !== 'live') {
    // NODE_ENV'e bakılmaz: tanımsız/tanınmayan SMS_MODE'da hatırlatmalar sessizce 'simüle' edilip birikmesin
    log.warn("Zamanlayıcı BAŞLATILMADI: SMS_MODE='live' değil (tanımsız ya da tanınmayan değer); otomatik SMS gönderimi kapalı.");
    return false;
  }
  const ms = config.schedulerIntervalSeconds * 1000;
  log.info(`zamanlayıcı her ${config.schedulerIntervalSeconds} sn'de bir çalışacak`);
  setTimeout(() => tick(), 5000).unref();
  timer = setInterval(() => tick(), ms);
  timer.unref();
  return true;
}

/** Çalışan tick'i bekleyip zamanlayıcıyı durdurur (graceful shutdown) */
export async function stopScheduler() {
  if (timer) { clearInterval(timer); timer = null; }
  if (running) { try { await running; } catch { /* yoksay */ } }
}
