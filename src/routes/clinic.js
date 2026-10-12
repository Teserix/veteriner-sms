import { Router } from 'express';
import { requireRole } from '../auth.js';
import { config } from '../config.js';
import { openTenant, getSettings, setSetting, owners, pets, reminders, smsLog, legalProblems, subjectRequests, SUBJECT_REQUEST_KINDS } from '../db/tenant.js';
import { clinics, legalAcceptances } from '../db/master.js';
import { PROVIDERS, providerOf, senderProblem, resolveProvider } from '../sms/index.js';
import { dispatch, dailyCap, usedToday } from '../sms/dispatch.js';
import { templateProblems, identityLine, optOutLine, composeMessage } from '../sms/policy.js';
import { LEGAL_DOCS } from '../legal.js';
import { MIN_SMS_RETENTION_DAYS } from '../retention.js';
import { limiters } from '../ratelimit.js';
import { encrypt } from '../crypto.js';
import { audit } from '../audit.js';
import { todayLocal, addDays, normalizePhone, trim, toInt, monthRangeIso, withFlash, nowIso, isValidEmail, formatDate as formatDateLocal } from '../util.js';

/**
 * clinicScope: giriş yapmış ve bir kliniğe bağlı kullanıcı için klinik veritabanını
 * istek başına BİR kez açar. Süper yönetici /admin'e, anonim kullanıcı /giris'e yönlenir.
 * Bu katmandan sonraki tüm router'lar req.db / req.settings'e güvenebilir.
 */
const CLINIC_PREFIXES = ['/sahipler', '/hayvanlar', '/hatirlatmalar', '/sms', '/ayarlar', '/hizli-kayit', '/iceaktar', '/kullanicilar', '/basvurular'];

export function isClinicPath(p) {
  return p === '/' || CLINIC_PREFIXES.some((x) => p === x || p.startsWith(x + '/'));
}

export function clinicScope(req, res, next) {
  if (!isClinicPath(req.path)) return next(); // bilinmeyen yollar 404'e düşsün, yönlendirme olmasın
  if (!req.user) return res.redirect('/giris?next=' + encodeURIComponent(req.originalUrl.startsWith('/') ? req.originalUrl : '/'));
  if (!req.user.clinicId) return res.redirect('/admin');
  if (!req.db) {
    req.db = openTenant(req.user.clinicId);
    req.settings = getSettings(req.db);
    res.locals.settings = { ...req.settings, sms_credentials: undefined };
    // Panel üst bandı: hukuki kimlik eksikse gönderim kilitli uyarısı; açık ilgili kişi başvurusu sayacı
    res.locals.legalLocked = legalProblems(req.settings).length > 0;
    if (res.locals.legalLocked) res.locals.tourAuto = false; // kilitliyken karşılama turu açılmaz
    res.locals.openRequests = subjectRequests.openCount(req.db);
  }
  next();
}

export const clinicRouter = Router();

/* ---------- Özet ---------- */
clinicRouter.get('/', (req, res) => {
  const db = req.db;
  const today = todayLocal();
  const month = monthRangeIso();
  const smsMonth = smsLog.countBetween(db, month.from, month.to);
  const remCounts = Object.fromEntries(reminders.countByStatus(db).map((r) => [r.status, r.c]));
  res.render('dashboard', {
    title: 'Özet',
    counts: {
      owners: owners.count(db),
      pets: pets.count(db),
      pending: remCounts.pending || 0,
      smsSentMonth: smsMonth.sent,
      smsFailedMonth: smsMonth.failed,
      monthLabel: month.label,
      capToday: dailyCap(req.user.clinicId, req.settings),
      usedToday: usedToday(db),
    },
    due: reminders.due(db, today),
    tomorrow: reminders.dueOn(db, addDays(today, 1)),
    overdue: reminders.overdue(db, today),
    failed: reminders.failedList(db),
    upcoming: reminders.upcoming(db, addDays(today, 1), addDays(today, 7)),
  });
});

/* ---------- SMS geçmişi ---------- */
clinicRouter.get('/sms', (req, res) => {
  audit(req, 'sms.view');
  res.render('smslog', { title: 'SMS Geçmişi', list: smsLog.recent(req.db, 300) });
});

/* ---------- İlgili kişi başvuruları (KVKK m.13; Başvuru Tebliği m.6/5: en geç 30 gün) ---------- */
const REQUEST_CHANNELS = Object.freeze({ yazili: 'Yazılı (elden/posta)', kep: 'KEP', eposta: 'E-posta', telefon: 'Telefon / sözlü', diger: 'Diğer' });
const REQUEST_DAYS = 30;

clinicRouter.get('/basvurular', (req, res) => {
  const today = todayLocal();
  const list = subjectRequests.list(req.db).map((r) => ({ ...r, overdue: r.status === 'acik' && r.due_at < today, ownerName: r.owner_id ? owners.get(req.db, r.owner_id)?.name : null }));
  res.render('basvurular', { title: 'KVKK başvuruları', list, kinds: SUBJECT_REQUEST_KINDS, channels: REQUEST_CHANNELS, today, form: { received_at: today } , error: null });
});

clinicRouter.post('/basvurular', (req, res) => {
  const b = req.body;
  const kind = Object.hasOwn(SUBJECT_REQUEST_KINDS, b.kind) ? b.kind : null;
  const channel = Object.hasOwn(REQUEST_CHANNELS, b.channel) ? b.channel : null;
  const name = trim(b.applicant_name, 120);
  const received = trim(b.received_at, 10);
  const ownerId = toInt(b.owner_id) || null;
  const fail = (msg) => res.redirect(withFlash('/basvurular', 'err', msg));
  if (!name) return fail('Başvuran adı zorunlu.');
  if (!kind) return fail('Talep türü seçin.');
  if (!channel) return fail('Başvuru kanalı seçin.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(received)) return fail('Alınma tarihi geçersiz.');
  if (ownerId && !owners.get(req.db, ownerId)) return fail('Hasta sahibi numarası bulunamadı.');
  const id = subjectRequests.create(req.db, {
    owner_id: ownerId, applicant_name: name, applicant_phone: normalizePhone(b.applicant_phone) || null, kind, channel,
    received_at: received, due_at: addDays(received, REQUEST_DAYS), note: trim(b.note, 1000) || null,
  });
  audit(req, 'request.create', { entityType: 'subject_request', entityId: id, meta: { kind, channel } });
  res.redirect(withFlash('/basvurular', 'ok', `Başvuru kaydedildi. Yanıt süresi: ${formatDateLocal(addDays(received, REQUEST_DAYS))} (30 gün).`));
});

clinicRouter.post('/basvurular/:id/kapat', (req, res) => {
  const id = toInt(req.params.id);
  const r = subjectRequests.get(req.db, id);
  if (!r) return res.status(404).render('error', { title: 'Bulunamadı', message: 'Başvuru bulunamadı.' });
  const status = req.body.status === 'reddedildi' ? 'reddedildi' : 'kapali';
  const changed = subjectRequests.close(req.db, id, { status, closedBy: req.user.email, closedAt: nowIso(), note: trim(req.body.note, 1000) || null });
  if (changed) audit(req, 'request.close', { entityType: 'subject_request', entityId: id, meta: { status } });
  res.redirect(withFlash('/basvurular', 'ok', 'Başvuru kapatıldı.'));
});

/* ---------- Ayarlar (yalnızca klinik yöneticisi) ---------- */
clinicRouter.get('/ayarlar', requireRole('admin'), (req, res) => {
  const resolved = resolveProvider(req.settings);
  const clinic = clinics.get(req.user.clinicId);
  const acceptances = legalAcceptances.byClinic(req.user.clinicId).map((a) => ({ ...a, title: LEGAL_DOCS[a.slug]?.title || a.slug }));
  res.render('settings', {
    title: 'Ayarlar',
    providers: PROVIDERS,
    hasCredentials: Boolean(req.settings.sms_credentials) && !resolved.credentialsBroken,
    credentialsBroken: resolved.credentialsBroken,
    clinicCap: dailyCap(req.user.clinicId, { daily_sms_limit: '999999' }),
    legalIssues: legalProblems(req.settings),
    identityPreview: identityLine(req.settings),
    optOutPreview: optOutLine(req.settings, req.user.clinicId, 'ornek'),
    noticeUrl: clinic?.public_slug && config.appOrigin ? `${config.appOrigin}/aydinlatma/${clinic.public_slug}` : '',
    acceptances,
  });
});

clinicRouter.post('/ayarlar', requireRole('admin'), (req, res) => {
  const db = req.db;
  const b = req.body;
  const providerName = providerOf(b.sms_provider);
  const start = Math.min(23, Math.max(0, toInt(b.send_hour_start, 9)));
  const end = Math.min(24, Math.max(start + 1, toInt(b.send_hour_end, 20)));
  const sender = trim(b.sms_sender, 40);
  const senderErr = senderProblem(providerName, sender);
  if (senderErr) return res.redirect(withFlash('/ayarlar', 'err', senderErr));
  const template = trim(b.template, 320);
  const tplProblems = templateProblems(template);
  if (tplProblems.length) return res.redirect(withFlash('/ayarlar', 'err', 'Şablon kaydedilmedi: ' + tplProblems.join(' ')));

  // Hukuki kimlik (m.8/3): tür seçildiyse ilgili numara biçimi doğrulanır; eksik bırakılabilir ama gönderim kilitli kalır
  const legalForm = ['tacir', 'esnaf'].includes(b.legal_form) ? b.legal_form : '';
  const mersis = trim(b.mersis_no, 16).replace(/\D/g, '');
  const taxId = trim(b.tax_id, 11).replace(/\D/g, '');
  if (legalForm === 'tacir' && mersis && !/^\d{16}$/.test(mersis)) return res.redirect(withFlash('/ayarlar', 'err', 'MERSİS numarası 16 haneli olmalı.'));
  if (legalForm === 'esnaf' && taxId && !/^\d{10,11}$/.test(taxId)) return res.redirect(withFlash('/ayarlar', 'err', 'Vergi kimlik numarası 10, T.C. kimlik numarası 11 haneli olmalı.'));
  const kvkkEmail = trim(b.kvkk_contact_email, 120);
  if (kvkkEmail && !isValidEmail(kvkkEmail)) return res.redirect(withFlash('/ayarlar', 'err', 'KVKK başvuru e-postası geçersiz.'));

  setSetting(db, 'clinic_name', trim(b.clinic_name, 80));
  setSetting(db, 'clinic_phone', trim(b.clinic_phone, 30));
  setSetting(db, 'template', template);
  setSetting(db, 'scheduler_enabled', b.scheduler_enabled === '1' ? '1' : '0');
  setSetting(db, 'send_hour_start', String(start));
  setSetting(db, 'send_hour_end', String(end));
  setSetting(db, 'sms_sender', sender);
  setSetting(db, 'daily_sms_limit', String(Math.min(5000, Math.max(0, toInt(b.daily_sms_limit, 200)))));
  setSetting(db, 'retention_sms_days', String(Math.min(3650, Math.max(MIN_SMS_RETENTION_DAYS, toInt(b.retention_sms_days, MIN_SMS_RETENTION_DAYS)))));
  setSetting(db, 'legal_form', legalForm);
  setSetting(db, 'mersis_no', mersis);
  setSetting(db, 'tax_id', taxId);
  setSetting(db, 'ruhsat_isim', trim(b.ruhsat_isim, 80));
  setSetting(db, 'kvkk_contact_email', kvkkEmail);
  setSetting(db, 'kvkk_contact_phone', trim(b.kvkk_contact_phone, 30));
  if (b.m61_declare === '1' && !req.settings.m61_declared_at) {
    setSetting(db, 'm61_declared_at', nowIso());
    audit(req, 'legal.m61_declare');
  }

  // Sağlayıcı kimlik bilgileri: alanlar doluysa şifreleyip kaydet, boşsa mevcut korunur.
  const fields = PROVIDERS[providerName].fields;
  const creds = {};
  let anyFilled = false;
  for (const f of fields) {
    const v = trim(b[`cred_${providerName}_${f.key}`], 200);
    if (v) { creds[f.key] = v; anyFilled = true; }
  }
  const providerChanged = providerName !== req.settings.sms_provider;
  if (anyFilled && fields.some((f) => !creds[f.key])) {
    return res.redirect(withFlash('/ayarlar', 'err', 'Sağlayıcı hesap bilgilerinin tamamını doldurun.'));
  }
  setSetting(db, 'sms_provider', providerName);
  if (anyFilled) setSetting(db, 'sms_credentials', encrypt(JSON.stringify(creds)));
  else if (providerChanged) setSetting(db, 'sms_credentials', '');

  audit(req, 'settings.update', { meta: { provider: providerName, credentialsChanged: anyFilled } });
  res.redirect(withFlash('/ayarlar', 'ok', 'Ayarlar kaydedildi.'));
});

clinicRouter.post('/ayarlar/test', requireRole('admin'), limiters.testSms.middleware((req) => 'u:' + req.user.id, 'Saatte en fazla 5 test SMS gönderebilirsiniz.'), async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  if (!phone) return res.redirect(withFlash('/ayarlar', 'err', 'Geçersiz telefon numarası.'));
  const settings = getSettings(req.db);
  // Gerçek gönderimle aynı kuyruk (kimlik + iptal satırı) eklenir ki yönetici alıcının göreceği metni görsün
  const message = composeMessage(settings, `Test mesajı - ${settings.clinic_name || 'Veteriner SMS'}`, { clinicId: req.user.clinicId, optOutToken: '' });
  const r = await dispatch({ clinicId: req.user.clinicId, db: req.db, settings, kind: 'test', to: phone, message, sentBy: req.user.email });
  if (r.ok) return res.redirect(withFlash('/ayarlar', 'ok', `Test SMS gönderildi (${r.providerName}).`));
  res.redirect(withFlash('/ayarlar', 'err', 'Gönderilemedi: ' + r.error));
});
