import { auditLog } from './db/master.js';
import { clientIp } from './ratelimit.js';
import { log } from './log.js';

/**
 * Denetim günlüğü (master.db). Kişisel veri (telefon, mesaj gövdesi, parola) yazılmaz.
 * Hata durumunda uygulamayı durdurmaz.
 *
 * audit(req, 'user.create', { clinicId, entityType: 'user', entityId: 5, meta: { role: 'staff' } })
 * audit(null, 'sms.cap', { clinicId })   // sistem (zamanlayıcı) kaynaklı
 */
export function audit(req, action, { clinicId = null, entityType = null, entityId = null, meta = null } = {}) {
  try {
    let metaStr = null;
    if (meta != null) {
      metaStr = JSON.stringify(meta);
      if (metaStr.length > 1024) metaStr = metaStr.slice(0, 1024);
    }
    auditLog.add({
      created_at: new Date().toISOString(),
      actor_user_id: req?.user?.id ?? null,
      actor_email: req?.user?.email ?? (req ? null : 'sistem'),
      actor_role: req?.user?.role ?? (req ? null : 'system'),
      clinic_id: clinicId ?? req?.user?.clinicId ?? null,
      action,
      entity_type: entityType,
      entity_id: entityId == null ? null : String(entityId),
      ip: req ? clientIp(req) : null,
      meta: metaStr,
    });
  } catch (e) {
    log.error('audit yazılamadı', { action, error: e.message });
  }
}
