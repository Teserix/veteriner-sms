import { clinics, auditLog } from '../db/master.js';
import { smsLog, legalProblems } from '../db/tenant.js';
import { sendSms } from './index.js';
import { identityLine } from './policy.js';
import { audit } from '../audit.js';
import { log } from '../log.js';
import { withLock } from '../lock.js';
import { todayLocal, localDayStartIso, toInt, nowIso } from '../util.js';

/**
 * Uygulamadaki TEK SMS çıkış noktası.
 * Sıra: hukuki kimlik/beyan kilidi (test hariç) -> opt-in kontrolü (test hariç) -> günlük tavan -> gönder -> sms_log.
 * Tavan aşımında gönderilmez ve sms_log'a yazılmaz; günde bir denetim satırı düşülür.
 * dispatch() klinik başına kilit altında çalışır (eşzamanlı istekler tavanı aşamaz).
 *
 * dispatch({ clinicId, db, settings, kind: 'reminder'|'test'|'manual', to, message,
 *            owner?: {id,name,sms_opt_in}, pet?: {id,name}, reminderId?, sentBy })
 * => { ok, ref?, error?, skipped?: 'opt-out'|'cap'|'legal', providerName?, logId? }
 *
 * Hukuki iz: her satıra hangi dayanakla gönderildiği (m6_1 = Ticari İletişim Yön. m.6/1 bakım bilgilendirmesi),
 * sağlayıcıya iletilen iys bayrağı ('0' = bilgilendirme, m.11/8 beyanı) ve iletideki kimlik satırı yazılır.
 */
export const IYS_FLAG_INFO = '0';

export function legalBasisOf(kind) {
  return kind === 'test' ? 'test' : 'm6_1';
}
export function lockKey(clinicId) {
  return 'sms:' + clinicId;
}

export function dailyCap(clinicId, settings) {
  const clinic = clinics.get(clinicId);
  const clinicCap = toInt(clinic?.sms_daily_cap, 300);
  const ownCap = toInt(settings?.daily_sms_limit, 200);
  return Math.max(0, Math.min(clinicCap, ownCap));
}

export function usedToday(db) {
  return smsLog.countSince(db, localDayStartIso(todayLocal()));
}

/** Kilitsiz sürüm: yalnızca zaten withLock(lockKey(clinicId)) içinden çağrılır (bkz. scheduler.js) */
export async function dispatchUnlocked({ clinicId, db, settings, kind = 'reminder', to, message, owner = null, pet = null, reminderId = null, sentBy = 'zamanlayici' }) {
  if (kind !== 'test') {
    const legal = legalProblems(settings);
    if (legal.length) {
      return { ok: false, skipped: 'legal', error: 'Gönderim kilitli: Ayarlar > Hukuki kimlik eksik (' + legal[0] + ')' };
    }
  }
  if (kind !== 'test' && owner && !owner.sms_opt_in) {
    return { ok: false, skipped: 'opt-out', error: 'Hasta sahibi SMS almak istemiyor.' };
  }

  const cap = dailyCap(clinicId, settings);
  const used = usedToday(db);
  if (used >= cap) {
    const dayStart = localDayStartIso(todayLocal());
    if (!auditLog.existsSince(clinicId, 'sms.cap', dayStart)) {
      audit(null, 'sms.cap', { clinicId, meta: { cap, used } });
      log.warn('günlük SMS tavanına ulaşıldı', { clinicId, cap });
    }
    return { ok: false, skipped: 'cap', error: `Günlük SMS sınırına ulaşıldı (${cap}). Yarın tekrar denenecek.` };
  }

  const at = nowIso();
  const result = await sendSms(settings, to, message);
  const logId = smsLog.add(db, {
    owner_id: owner?.id ?? null,
    pet_id: pet?.id ?? null,
    reminder_id: reminderId,
    phone: to,
    message: String(message || '').slice(0, 460),
    provider: result.providerName,
    status: result.ok ? 'sent' : 'failed',
    provider_ref: result.ref ?? null,
    error: result.error ?? null,
    sent_by: sentBy,
    created_at: at,
    owner_name: owner?.name ?? null,
    pet_name: pet?.name ?? null,
    kind,
    legal_basis: legalBasisOf(kind),
    iys_flag: IYS_FLAG_INFO,
    identity_used: identityLine(settings) || null,
  });
  log.info('sms', { clinicId, kind, to: log.maskPhone(to), ok: result.ok, provider: result.providerName });
  return { ...result, logId };
}

export function dispatch(args) {
  return withLock(lockKey(args.clinicId), () => dispatchUnlocked(args));
}
