import { clinics, auditLog } from './db/master.js';
import { openTenant, getSettings, smsLog, imhaLog } from './db/tenant.js';
import { lockKey } from './sms/dispatch.js';
import { withLock } from './lock.js';
import { audit } from './audit.js';
import { nowLocal, toInt } from './util.js';
import { log } from './log.js';

/**
 * Periyodik imha (KVKK m.7; Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında
 * Yönetmelik m.11). Günde bir kez, zamanlayıcı tick'inden çalışır.
 *
 *  - sms_log: saklama süresi dolan satırların kişisel alanları anonimleştirilir; satır (sayı, durum, sağlayıcı
 *    referansı, hukuki dayanak) kalır. Alt sınır 3 yıl: Ticari İletişim Yön. m.13/2 kayıtların en az üç yıl
 *    saklanmasını emreder; 6563 m.11/3 iş ve işlem kayıtları için on yıl der — bu yüzden satır silinmez.
 *  - audit_log (master): 3 yıldan eski satırlarda kullanıcı e-postası ve IP maskelenir.
 *  - imha_log: her imha turu kaydedilir ve hiçbir zaman silinmez (İmha Yön. m.7/3: en az üç yıl).
 */
export const MIN_SMS_RETENTION_DAYS = 1095;
export const AUDIT_RETENTION_DAYS = 1095;

function cutoffIso(now, days) {
  return new Date(now.getTime() - days * 86400 * 1000).toISOString();
}

export function smsRetentionDays(settings) {
  return Math.max(MIN_SMS_RETENTION_DAYS, toInt(settings?.retention_sms_days, MIN_SMS_RETENTION_DAYS));
}

/** Tek klinik için imha turu; klinik kilidi altında çağrılmalıdır. Anonimleştirilen satır sayısını döner. */
export function runClinicRetention(clinicId, now = new Date()) {
  const db = openTenant(clinicId);
  const settings = getSettings(db);
  const days = smsRetentionDays(settings);
  const cutoff = cutoffIso(now, days);
  const at = now.toISOString();
  const n = smsLog.scrubOlderThan(db, cutoff, at);
  if (n > 0) {
    imhaLog.add(db, { run_at: at, scope: 'sms_log', method: 'anonim', row_count: n, criteria: `created_at < ${cutoff} (${days} gün)`, actor: 'sistem' });
  }
  return n;
}

export async function runRetention(now = new Date()) {
  let sms = 0;
  for (const c of clinics.active()) {
    try {
      sms += await withLock(lockKey(c.id), () => runClinicRetention(c.id, now));
    } catch (e) {
      log.error('imha turu başarısız', { clinic: c.id, error: e.message });
    }
  }
  const auditMasked = auditLog.maskOlderThan(cutoffIso(now, AUDIT_RETENTION_DAYS));
  audit(null, 'retention.run', { meta: { sms_anonymized: sms, audit_masked: auditMasked } });
  if (sms || auditMasked) log.info('periyodik imha', { sms, auditMasked });
  return { sms, auditMasked };
}

let lastRunDate = null;

/** Günde bir kez çalışır (yerel gün). Zamanlayıcı tick'inden çağrılır. */
export async function maybeRetention(now = new Date()) {
  const { date } = nowLocal(now);
  if (lastRunDate === date) return false;
  lastRunDate = date;
  try {
    await runRetention(now);
    return true;
  } catch (e) {
    log.error('periyodik imha çalıştırılamadı', { error: e.message });
    return false;
  }
}

/** Testler için */
export function _resetRetentionState() {
  lastRunDate = null;
}
