import { Router } from 'express';
import { requireRole } from '../auth.js';
import { openTenant, getSettings, setSetting, owners, pets, reminders, smsLog } from '../db/tenant.js';
import { PROVIDERS, providerOf, senderProblem, resolveProvider } from '../sms/index.js';
import { dispatch, dailyCap, usedToday } from '../sms/dispatch.js';
import { limiters } from '../ratelimit.js';
import { encrypt } from '../crypto.js';
import { audit } from '../audit.js';
import { todayLocal, addDays, normalizePhone, trim, toInt, monthRangeIso, withFlash } from '../util.js';

/**
 * clinicScope: giriş yapmış ve bir kliniğe bağlı kullanıcı için klinik veritabanını
 * istek başına BİR kez açar. Süper yönetici /admin'e, anonim kullanıcı /giris'e yönlenir.
 * Bu katmandan sonraki tüm router'lar req.db / req.settings'e güvenebilir.
 */
const CLINIC_PREFIXES = ['/sahipler', '/hayvanlar', '/hatirlatmalar', '/sms', '/ayarlar', '/hizli-kayit', '/iceaktar', '/kullanicilar'];

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
  res.render('smslog', { title: 'SMS Geçmişi', list: smsLog.recent(req.db, 300) });
});

/* ---------- Ayarlar (yalnızca klinik yöneticisi) ---------- */
clinicRouter.get('/ayarlar', requireRole('admin'), (req, res) => {
  const resolved = resolveProvider(req.settings);
  res.render('settings', {
    title: 'Ayarlar',
    providers: PROVIDERS,
    hasCredentials: Boolean(req.settings.sms_credentials) && !resolved.credentialsBroken,
    credentialsBroken: resolved.credentialsBroken,
    clinicCap: dailyCap(req.user.clinicId, { daily_sms_limit: '999999' }),
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
  if (!template) return res.redirect(withFlash('/ayarlar', 'err', 'Mesaj şablonu boş olamaz.'));

  setSetting(db, 'clinic_name', trim(b.clinic_name, 80));
  setSetting(db, 'clinic_phone', trim(b.clinic_phone, 30));
  setSetting(db, 'template', template);
  setSetting(db, 'scheduler_enabled', b.scheduler_enabled === '1' ? '1' : '0');
  setSetting(db, 'send_hour_start', String(start));
  setSetting(db, 'send_hour_end', String(end));
  setSetting(db, 'sms_sender', sender);
  setSetting(db, 'daily_sms_limit', String(Math.min(5000, Math.max(0, toInt(b.daily_sms_limit, 200)))));

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
  const message = `Test mesajı - ${settings.clinic_name || 'Veteriner SMS'}`;
  const r = await dispatch({ clinicId: req.user.clinicId, db: req.db, settings, kind: 'test', to: phone, message, sentBy: req.user.email });
  if (r.ok) return res.redirect(withFlash('/ayarlar', 'ok', `Test SMS gönderildi (${r.providerName}).`));
  res.redirect(withFlash('/ayarlar', 'err', 'Gönderilemedi: ' + r.error));
});
