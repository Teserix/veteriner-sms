import { config } from './config.js';
import { clinics } from './db/master.js';
import { openTenant, getSettings, reminders, smsLog } from './db/tenant.js';
import { sendSms, renderTemplate } from './sms/index.js';
import { nowLocal, nowIso, formatDate, addDays, REMINDER_TYPES } from './util.js';

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
 * Tek bir hatırlatma için SMS gönderir, günlüğe yazar ve durumu günceller.
 * Hem zamanlayıcı hem de "Şimdi gönder" düğmesi bunu kullanır.
 */
export async function sendReminderSms(db, settings, r, sentBy = 'zamanlayici') {
  const message = buildMessage(settings, r);
  const at = nowIso();
  const result = await sendSms(settings, r.owner_phone, message);

  smsLog.add(db, {
    owner_id: r.owner_id,
    pet_id: r.pet_id,
    reminder_id: r.id,
    phone: r.owner_phone,
    message,
    provider: result.providerName,
    status: result.ok ? 'sent' : 'failed',
    provider_ref: result.ref,
    error: result.error,
    sent_by: sentBy,
    created_at: at,
  });

  if (result.ok) {
    reminders.markSent(db, r.id, at);
    // Tekrarlayan hatırlatma: bir sonrakini oluştur
    if (r.repeat_days && r.repeat_days > 0) {
      reminders.create(db, {
        pet_id: r.pet_id,
        type: r.type,
        title: r.title,
        due_date: addDays(r.due_date, r.repeat_days),
        notify_days_before: r.notify_days_before,
        repeat_days: r.repeat_days,
        notes: r.notes,
        created_at: at,
      });
    }
  } else {
    reminders.markAttemptFailed(db, r.id, at, result.error || 'Bilinmeyen hata', MAX_ATTEMPTS);
  }
  return { ...result, message };
}

/** Bir kliniğin bugün gönderilmesi gereken hatırlatmalarını işler */
export async function processClinic(clinicId) {
  const db = openTenant(clinicId);
  const settings = getSettings(db);
  if (settings.scheduler_enabled !== '1') return { skipped: 'kapali' };

  const { date: today, hour } = nowLocal();
  const start = Number(settings.send_hour_start ?? 9);
  const end = Number(settings.send_hour_end ?? 20);
  if (hour < start || hour >= end) return { skipped: 'saat-disi' };

  const due = reminders.due(db, today);
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const nowMs = Date.now();

  for (const r of due) {
    if (!r.sms_opt_in) { skipped++; continue; }
    if (r.last_attempt_at && nowMs - new Date(r.last_attempt_at).getTime() < RETRY_AFTER_MS) { skipped++; continue; }
    try {
      const res = await sendReminderSms(db, settings, r, 'zamanlayici');
      if (res.ok) sent++; else failed++;
    } catch (e) {
      failed++;
      console.error(`[zamanlayici] ${clinicId} hatirlatma #${r.id}:`, e.message);
    }
  }
  return { sent, failed, skipped };
}

let running = false;

export async function tick() {
  if (running) return;
  running = true;
  try {
    for (const c of clinics.active()) {
      try {
        const r = await processClinic(c.id);
        if (r.sent || r.failed) console.log(`[zamanlayici] ${c.name}: gönderildi=${r.sent} hata=${r.failed} atlandı=${r.skipped}`);
      } catch (e) {
        console.error(`[zamanlayici] ${c.id} işlenemedi:`, e.message);
      }
    }
  } finally {
    running = false;
  }
}

export function startScheduler() {
  const ms = config.schedulerIntervalSeconds * 1000;
  console.log(`[zamanlayici] her ${config.schedulerIntervalSeconds} sn'de bir çalışacak`);
  setTimeout(tick, 5000).unref();
  setInterval(tick, ms).unref();
}
