import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { hashPassword, passwordProblem, generatePassword } from '../auth.js';
import { clinics, users, sessions, auditLog, master } from '../db/master.js';
import { openTenant, closeTenant, setSetting, tenantPath } from '../db/tenant.js';
import { config } from '../config.js';
import { randomId } from '../crypto.js';
import { audit } from '../audit.js';
import { log } from '../log.js';
import { trim, toInt, nowIso, isValidEmail } from '../util.js';

/**
 * Süper yönetici: klinik (kiracı) açma/kapatma, yönetici parolası sıfırlama.
 * Klinik HASTA verisine erişmez; yalnızca klinik ayarlarını (ad/telefon) senkronlar ve dosyayı taşır.
 * /admin altında; superadmin rolü app.js'te zorunlu.
 */
export const adminRouter = Router();

function listView(res, { error = null, form = {}, status = 200 } = {}) {
  const list = clinics.all().map((c) => ({ ...c, user_count: clinics.userCount(c.id) }));
  res.status(status).render('admin', { title: 'Klinikler', list, error, form });
}

function detailView(res, clinic, { tempPassword = null, tempFor = null, error = null, status = 200 } = {}) {
  res.status(status).render('admin_detail', { title: clinic.name, clinic, userList: users.byClinic(clinic.id), tempPassword, tempFor, error });
}

adminRouter.get('/', (req, res) => listView(res));

adminRouter.get('/denetim', (req, res) => {
  res.render('audit', { title: 'Denetim günlüğü', list: auditLog.recent(300), clinicMap: Object.fromEntries(clinics.all().map((c) => [c.id, c.name])) });
});

adminRouter.post('/klinik', async (req, res) => {
  const form = {
    clinic_name: trim(req.body.clinic_name, 80),
    clinic_phone: trim(req.body.clinic_phone, 30),
    admin_name: trim(req.body.admin_name, 80),
    admin_email: trim(req.body.admin_email, 120).toLowerCase(),
  };
  const password = String(req.body.admin_password || '');
  if (!form.clinic_name || !form.admin_name || !form.admin_email) return listView(res, { error: 'Zorunlu alanları doldurun.', form, status: 400 });
  if (!isValidEmail(form.admin_email)) return listView(res, { error: 'E-posta adresi geçersiz.', form, status: 400 });
  const problem = passwordProblem(password);
  if (problem) return listView(res, { error: problem, form, status: 400 });
  if (users.byEmail(form.admin_email)) return listView(res, { error: 'Bu e-posta kullanılamıyor.', form, status: 400 });

  const id = randomId(6);
  const hash = await hashPassword(password);
  const now = nowIso();
  master.exec('BEGIN');
  try {
    clinics.create(id, form.clinic_name, form.clinic_phone, now);
    users.create({ clinicId: id, email: form.admin_email, name: form.admin_name, passwordHash: hash, role: 'admin', createdAt: now, mustChangePassword: 1 });
    master.exec('COMMIT');
  } catch (e) {
    master.exec('ROLLBACK');
    throw e;
  }
  // Kliniğe ait ayrı veritabanı dosyasını oluştur; başarısızsa klinik kaydını geri al
  try {
    const db = openTenant(id);
    setSetting(db, 'clinic_name', form.clinic_name);
    setSetting(db, 'clinic_phone', form.clinic_phone);
  } catch (e) {
    closeTenant(id);
    clinics.delete(id);
    log.error('klinik dosyası oluşturulamadı', { id, error: e.message });
    return listView(res, { error: 'Klinik veritabanı oluşturulamadı: ' + e.message, form, status: 500 });
  }
  audit(req, 'clinic.create', { clinicId: id, entityType: 'clinic', entityId: id });
  res.redirect('/admin?ok=' + encodeURIComponent(`"${form.clinic_name}" oluşturuldu. Yönetici: ${form.admin_email} (ilk girişte parola değişimi istenecek)`));
});

function loadClinic(req, res) {
  const c = clinics.get(String(req.params.id));
  if (!c) { res.redirect('/admin?err=' + encodeURIComponent('Klinik bulunamadı.')); return null; }
  return c;
}

adminRouter.get('/klinik/:id', (req, res) => {
  const c = loadClinic(req, res);
  if (c) detailView(res, c);
});

adminRouter.post('/klinik/:id/durum', (req, res) => {
  const c = loadClinic(req, res);
  if (!c) return;
  const active = req.body.active === '1';
  clinics.setActive(c.id, active);
  if (!active) for (const u of users.byClinic(c.id)) sessions.deleteForUser(u.id);
  audit(req, active ? 'clinic.activate' : 'clinic.deactivate', { clinicId: c.id, entityType: 'clinic', entityId: c.id });
  res.redirect('/admin?ok=' + encodeURIComponent(active ? 'Klinik aktifleştirildi.' : 'Klinik pasifleştirildi; kullanıcıları giriş yapamaz.'));
});

adminRouter.post('/klinik/:id/duzenle', (req, res) => {
  const c = loadClinic(req, res);
  if (!c) return;
  const name = trim(req.body.name, 80);
  const phone = trim(req.body.phone, 30);
  const cap = Math.min(5000, Math.max(0, toInt(req.body.sms_daily_cap, c.sms_daily_cap)));
  if (!name) return detailView(res, c, { error: 'Klinik adı boş olamaz.', status: 400 });
  clinics.update(c.id, { name, phone, smsDailyCap: cap });
  if (c.active) {
    const db = openTenant(c.id);
    setSetting(db, 'clinic_name', name);
    setSetting(db, 'clinic_phone', phone);
  }
  audit(req, 'clinic.update', { clinicId: c.id, entityType: 'clinic', entityId: c.id, meta: { cap } });
  res.redirect(`/admin/klinik/${c.id}?ok=` + encodeURIComponent('Kaydedildi.'));
});

/** Klinik yöneticisi/personeli için geçici parola üretir (kilitlenen yöneticiyi kurtarmak için) */
adminRouter.post('/klinik/:id/sifre-sifirla', async (req, res) => {
  const c = loadClinic(req, res);
  if (!c) return;
  const u = users.byId(toInt(req.body.user_id));
  if (!u || u.clinic_id !== c.id) return detailView(res, c, { error: 'Kullanıcı bulunamadı.', status: 400 });
  const temp = generatePassword();
  users.setPassword(u.id, await hashPassword(temp), 1);
  sessions.deleteForUser(u.id);
  audit(req, 'user.password_reset', { clinicId: c.id, entityType: 'user', entityId: u.id });
  detailView(res, c, { tempPassword: temp, tempFor: u });
});

/** Klinik silme: oturumları kapat, dosyayı data/trash/ altına taşı (unlink yok); klinik kaydı ve kullanıcı hesapları master.db'den silinir */
adminRouter.post('/klinik/:id/sil', (req, res) => {
  const c = loadClinic(req, res);
  if (!c) return;
  if (trim(req.body.confirm_name, 80) !== c.name) {
    return detailView(res, c, { error: 'Onay için klinik adını aynen yazın.', status: 400 });
  }
  for (const u of users.byClinic(c.id)) sessions.deleteForUser(u.id);
  closeTenant(c.id);
  const src = tenantPath(c.id);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const dst = path.join(config.dataDir, 'trash', `${c.id}-${ts}.db`);
  for (const suffix of ['', '-wal', '-shm']) {
    if (fs.existsSync(src + suffix)) fs.renameSync(src + suffix, dst + suffix);
  }
  clinics.delete(c.id); // kullanıcılar cascade ile silinir
  audit(req, 'clinic.delete', { clinicId: c.id, entityType: 'clinic', entityId: c.id, meta: { name: c.name, trash: path.basename(dst) } });
  res.redirect('/admin?ok=' + encodeURIComponent(`"${c.name}" silindi. Veritabanı dosyası data/trash/ altına taşındı.`));
});
