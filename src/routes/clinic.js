import { Router } from 'express';
import { requireClinic, requireRole } from '../auth.js';
import { openTenant, getSettings, setSetting, owners, pets, reminders, smsLog } from '../db/tenant.js';
import { PROVIDERS, sendSms } from '../sms/index.js';
import { encrypt } from '../crypto.js';
import { todayLocal, addDays, normalizePhone, trim, toInt, nowIso } from '../util.js';

/**
 * Klinik kapsamlı sayfalar: özet, SMS geçmişi, ayarlar.
 * tenantMiddleware her istekte yalnızca oturumdaki kullanıcının klinik veritabanını açar.
 */
export const clinicRouter = Router();

export function tenantMiddleware(req, res, next) {
  req.db = openTenant(req.user.clinicId);
  req.settings = getSettings(req.db);
  res.locals.settings = req.settings;
  next();
}

clinicRouter.use(requireClinic, tenantMiddleware);

/* ---------- Özet ---------- */
clinicRouter.get('/', (req, res) => {
  const db = req.db;
  const today = todayLocal();
  const weekAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
  const smsCounts = Object.fromEntries(smsLog.countSince(db, weekAgo).map((r) => [r.status, r.c]));
  const remCounts = Object.fromEntries(reminders.countByStatus(db).map((r) => [r.status, r.c]));
  res.render('dashboard', {
    title: 'Özet',
    counts: {
      owners: owners.count(db),
      pets: pets.count(db),
      pending: remCounts.pending || 0,
      smsSent7: smsCounts.sent || 0,
      smsFailed7: smsCounts.failed || 0,
    },
    due: reminders.due(db, today),
    upcoming: reminders.upcoming(db, addDays(today, 1), addDays(today, 7)),
  });
});

/* ---------- SMS geçmişi ---------- */
clinicRouter.get('/sms', (req, res) => {
  res.render('smslog', { title: 'SMS Geçmişi', list: smsLog.recent(req.db, 300) });
});

/* ---------- Ayarlar (yalnızca klinik yöneticisi) ---------- */
clinicRouter.get('/ayarlar', requireRole('admin'), (req, res) => {
  res.render('settings', {
    title: 'Ayarlar',
    providers: PROVIDERS,
    hasCredentials: Boolean(req.settings.sms_credentials),
  });
});

clinicRouter.post('/ayarlar', requireRole('admin'), (req, res) => {
  const db = req.db;
  const b = req.body;
  const providerName = PROVIDERS[b.sms_provider] ? b.sms_provider : 'console';
  const start = Math.min(23, Math.max(0, toInt(b.send_hour_start, 9)));
  const end = Math.min(24, Math.max(start + 1, toInt(b.send_hour_end, 20)));

  setSetting(db, 'clinic_name', trim(b.clinic_name, 80));
  setSetting(db, 'clinic_phone', trim(b.clinic_phone, 30));
  setSetting(db, 'template', trim(b.template, 600) || getSettings(db).template);
  setSetting(db, 'scheduler_enabled', b.scheduler_enabled === '1' ? '1' : '0');
  setSetting(db, 'send_hour_start', String(start));
  setSetting(db, 'send_hour_end', String(end));
  setSetting(db, 'sms_sender', trim(b.sms_sender, 40));

  // Sağlayıcı kimlik bilgileri: form alanları doluysa şifreleyip kaydet, boşsa mevcut korunur.
  const fields = PROVIDERS[providerName].fields;
  const creds = {};
  let anyFilled = false;
  for (const f of fields) {
    const v = trim(b[`cred_${providerName}_${f.key}`], 200);
    if (v) { creds[f.key] = v; anyFilled = true; }
  }
  const providerChanged = providerName !== req.settings.sms_provider;
  setSetting(db, 'sms_provider', providerName);
  if (anyFilled) {
    if (fields.some((f) => !creds[f.key])) {
      return res.redirect('/ayarlar?err=' + encodeURIComponent('Sağlayıcı hesap bilgilerinin tamamını doldurun.'));
    }
    setSetting(db, 'sms_credentials', encrypt(JSON.stringify(creds)));
  } else if (providerChanged) {
    setSetting(db, 'sms_credentials', '');
  }
  res.redirect('/ayarlar?ok=' + encodeURIComponent('Ayarlar kaydedildi.'));
});

clinicRouter.post('/ayarlar/test', requireRole('admin'), async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  if (!phone) return res.redirect('/ayarlar?err=' + encodeURIComponent('Geçersiz telefon numarası.'));
  const settings = getSettings(req.db);
  const message = `Test mesajı - ${settings.clinic_name || 'Veteriner SMS'}`;
  const r = await sendSms(settings, phone, message);
  smsLog.add(req.db, {
    phone, message, provider: r.providerName, status: r.ok ? 'sent' : 'failed',
    provider_ref: r.ref, error: r.error, sent_by: req.user.email, created_at: nowIso(),
  });
  if (r.ok) return res.redirect('/ayarlar?ok=' + encodeURIComponent('Test SMS gönderildi (' + r.providerName + ').'));
  res.redirect('/ayarlar?err=' + encodeURIComponent('Gönderilemedi: ' + r.error));
});
