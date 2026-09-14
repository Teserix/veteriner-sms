import { Router } from 'express';
import { config } from '../config.js';
import { issuePreToken, verifyPreToken } from '../auth.js';
import { clinics } from '../db/master.js';
import { isValidClinicId, tenantExists, openTenant, getSettings, owners, consents } from '../db/tenant.js';
import { LEGAL_DOCS, renderDoc } from '../legal.js';
import { limiters, clientIp } from '../ratelimit.js';
import { audit } from '../audit.js';
import { log } from '../log.js';
import { nowIso } from '../util.js';

/**
 * Oturum gerektirmeyen sayfalar:
 *  - /belgeler/:slug   hukuki metinler (kullanım koşulları, sözleşme, aydınlatma, çerez)
 *  - /iletisim         hizmet sağlayıcı kimlik bilgileri (5651 m.3; 6563 m.3)
 *  - /aydinlatma/:slug kliniğin hasta sahiplerine yönelik aydınlatma metni (KVKK m.10)
 *  - /ret/:token       SMS'teki iptal bağlantısı (Ticari İletişim Yön. m.9/3-4): tek tıkla ret
 *
 * /aydinlatma ve /ret klinik veritabanını kullanıcı oturumu olmadan açar; kliniği yalnızca
 * belirteçteki 12 haneli kimlik (ID_RE ile doğrulanır) ya da herkese açık kısa ad belirler.
 */
export const publicRouter = Router();

const SLUG_RE = /^[a-f0-9]{12}$/;
const TOKEN_RE = /^([a-f0-9]{12})\.([a-f0-9]{32})$/;

const publicLimit = limiters.publicPage.middleware((req) => clientIp(req));

function notFound(res, message = 'Sayfa bulunamadı.') {
  return res.status(404).render('error', { title: 'Bulunamadı', message });
}

/* ---------- Hukuki metinler ---------- */
publicRouter.get('/belgeler/:slug', publicLimit, (req, res) => {
  const slug = String(req.params.slug || '');
  const d = LEGAL_DOCS[slug];
  if (!d || !d.public) return notFound(res);
  res.render('legal_doc', { title: d.title, doc: renderDoc(slug) });
});

publicRouter.get('/iletisim', publicLimit, (req, res) => {
  res.render('contact', { title: 'İletişim', company: config.company, appOrigin: config.appOrigin });
});

/* ---------- Klinik aydınlatma metni ---------- */
publicRouter.get('/aydinlatma/:slug', publicLimit, (req, res) => {
  const slug = String(req.params.slug || '');
  if (!SLUG_RE.test(slug)) return notFound(res);
  const clinic = clinics.bySlug(slug);
  if (!clinic || !clinic.active || !tenantExists(clinic.id)) return notFound(res);
  const s = getSettings(openTenant(clinic.id));
  const identity = s.legal_form === 'tacir' && s.mersis_no ? ` (MERSİS: ${s.mersis_no})`
    : s.legal_form === 'esnaf' && s.tax_id ? ` (Vergi/T.C. kimlik no: ${s.tax_id})` : '';
  const kvkk = [s.kvkk_contact_email, s.kvkk_contact_phone].filter(Boolean).join(' / ') || s.clinic_phone || '';
  const doc = renderDoc('aydinlatma-klinik-sablon', {
    klinik_adi: s.clinic_name || clinic.name,
    klinik_kimlik: identity,
    klinik_telefon: s.clinic_phone || clinic.phone || '',
    klinik_eposta: s.kvkk_contact_email ? `, e-posta: ${s.kvkk_contact_email}` : '',
    klinik_kvkk_iletisim: kvkk,
    surum: `${LEGAL_DOCS['aydinlatma-klinik-sablon'].version}${s.notice_version ? '.' + s.notice_version : ''}`,
  });
  res.render('legal_doc', { title: `${s.clinic_name || clinic.name} — Aydınlatma Metni`, doc });
});

/* ---------- SMS ret (opt-out) ---------- */
function resolveOptOut(token) {
  const m = TOKEN_RE.exec(String(token || ''));
  if (!m) return null;
  const [, clinicId, ownerToken] = m;
  if (!isValidClinicId(clinicId)) return null;
  const clinic = clinics.get(clinicId);
  if (!clinic || !clinic.active || !tenantExists(clinicId)) return null;
  const db = openTenant(clinicId);
  const owner = owners.byOptOutToken(db, ownerToken);
  if (!owner) return null;
  return { clinic, db, owner, settings: getSettings(db) };
}

const optOutLimit = limiters.optOut.middleware((req) => clientIp(req), 'Çok fazla deneme. Lütfen biraz sonra tekrar deneyin.');

publicRouter.get('/ret/:token', optOutLimit, (req, res) => {
  const r = resolveOptOut(req.params.token);
  if (!r) return notFound(res, 'Bu bağlantı geçersiz ya da artık kullanılamıyor. Hatırlatma almak istemiyorsanız kliniğinizi arayabilirsiniz.');
  const pre = issuePreToken(res, '/ret');
  res.render('optout', {
    title: 'Hatırlatma SMS\'lerini durdur',
    clinicName: r.settings.clinic_name || r.clinic.name,
    clinicPhone: r.settings.clinic_phone || r.clinic.phone || '',
    alreadyOff: !r.owner.sms_opt_in,
    token: req.params.token,
    pre,
  });
});

publicRouter.post('/ret/:token', optOutLimit, (req, res) => {
  if (!verifyPreToken(req)) {
    return res.status(403).render('error', { title: 'Güvenlik hatası', message: 'Form belirteci geçersiz. Bağlantıyı yeniden açıp tekrar deneyin.' });
  }
  const r = resolveOptOut(req.params.token);
  if (!r) return notFound(res, 'Bu bağlantı geçersiz ya da artık kullanılamıyor.');
  const clinicName = r.settings.clinic_name || r.clinic.name;
  if (r.owner.sms_opt_in) {
    const at = nowIso();
    owners.setOptIn(r.db, r.owner.id, 0);
    consents.log(r.db, { owner_id: r.owner.id, action: 'revoke', channel: 'ret_url', note: 'SMS içindeki iptal bağlantısı', ip: clientIp(req), created_at: at });
    audit(req, 'consent.revoke', { clinicId: r.clinic.id, entityType: 'owner', entityId: r.owner.id, meta: { channel: 'ret_url' } });
    log.info('sms ret', { clinicId: r.clinic.id, ownerId: r.owner.id });
  }
  res.render('optout_done', { title: 'Hatırlatmalar durduruldu', clinicName, clinicPhone: r.settings.clinic_phone || r.clinic.phone || '' });
});
