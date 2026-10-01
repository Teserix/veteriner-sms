import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { hashPassword, passwordProblem, generatePassword } from '../auth.js';
import { clinics, users, sessions, auditLog, master, breaches, legalAcceptances } from '../db/master.js';
import { openTenant, closeTenant, setSetting, tenantPath } from '../db/tenant.js';
import { config } from '../config.js';
import { randomId } from '../crypto.js';
import { audit } from '../audit.js';
import { seedDemo, nonDemoOwnerCount } from '../demo.js';
import { log } from '../log.js';
import { trim, toInt, nowIso, isValidEmail } from '../util.js';

/**
 * Süper yönetici: klinik (kiracı) açma/kapatma, klinik kullanıcılarını yönetme (ekleme, ad/e-posta/rol/durum,
 * parola belirleme/sıfırlama, silme; hepsi denetim kaydıyla).
 * Klinik HASTA verisine erişmez; yalnızca klinik ayarlarını (ad/telefon) senkronlar ve dosyayı taşır.
 * Tek istisna: boş kliniğe sahte demo verisi yükleme (/klinik/:id/demo, src/demo.js).
 * /admin altında; superadmin rolü app.js'te zorunlu.
 */
export const adminRouter = Router();

function listView(res, { error = null, form = {}, status = 200 } = {}) {
  const list = clinics.all().map((c) => ({ ...c, user_count: clinics.userCount(c.id) }));
  res.status(status).render('admin', { title: 'Klinikler', list, error, form });
}

function detailView(res, clinic, { tempPassword = null, tempFor = null, error = null, status = 200, userForm = {} } = {}) {
  res.status(status).render('admin_detail', {
    title: clinic.name, clinic, userList: users.byClinic(clinic.id), tempPassword, tempFor, error, userForm,
    acceptances: legalAcceptances.byClinic(clinic.id),
  });
}

/** Eski kliniklerde (migrasyon 3 öncesi) kısa ad yoktur; ilk görüntülemede üretilir */
function ensureSlug(clinic) {
  if (clinic.public_slug) return clinic;
  clinics.setSlug(clinic.id, randomId(6));
  return clinics.get(clinic.id);
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
    clinics.setSlug(id, randomId(6)); // hasta sahibi aydınlatma metni için herkese açık kısa ad (klinik kimliğini ifşa etmez)
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
  if (c) detailView(res, ensureSlug(c));
});

/* ---------- Veri ihlali kayıtları (KVKK m.12/5; Kurul 2019/10: 72 saat, kayıt altına alınır) ---------- */
adminRouter.get('/ihlaller', (req, res) => {
  const list = breaches.all().map((b) => {
    const detected = new Date(b.detected_at).getTime();
    const deadline = new Date(detected + 72 * 3600 * 1000).toISOString();
    return { ...b, deadline, overdue: !b.kurul_notified_at && Date.now() > detected + 72 * 3600 * 1000 };
  });
  res.render('admin_breach', { title: 'Veri ihlali kayıtları', list, clinicList: clinics.all(), error: null });
});

adminRouter.post('/ihlaller', (req, res) => {
  const b = req.body;
  const clinicId = b.clinic_id ? String(b.clinic_id) : null;
  if (clinicId && !clinics.get(clinicId)) return res.redirect('/admin/ihlaller?err=' + encodeURIComponent('Klinik bulunamadı.'));
  const detected = trim(b.detected_at, 25);
  if (Number.isNaN(new Date(detected).getTime())) return res.redirect('/admin/ihlaller?err=' + encodeURIComponent('Tespit zamanı geçersiz.'));
  const source = trim(b.source, 500);
  if (!source) return res.redirect('/admin/ihlaller?err=' + encodeURIComponent('İhlalin kaynağı/niteliği zorunlu.'));
  const id = breaches.add({
    clinic_id: clinicId, detected_at: new Date(detected).toISOString(), occurred_at: b.occurred_at ? new Date(trim(b.occurred_at, 25)).toISOString() : null,
    source, affected_count: toInt(b.affected_count) ?? null, categories: trim(b.categories, 300) || null,
    consequences: trim(b.consequences, 1000) || null, measures: trim(b.measures, 1000) || null, created_by: req.user.email, created_at: nowIso(),
  });
  audit(req, 'breach.create', { clinicId, entityType: 'breach', entityId: id });
  res.redirect('/admin/ihlaller?ok=' + encodeURIComponent('İhlal kaydı oluşturuldu. Veri sorumlusu (klinik) gecikmeksizin, Kurul 72 saat içinde bilgilendirilmeli.'));
});

adminRouter.post('/ihlaller/:id/bildirim', (req, res) => {
  const id = toInt(req.params.id);
  const field = { klinik: 'clinic_notified_at', kurul: 'kurul_notified_at', kisiler: 'subjects_notified_at' }[req.body.target];
  if (!breaches.get(id) || !field) return res.redirect('/admin/ihlaller?err=' + encodeURIComponent('Kayıt bulunamadı.'));
  breaches.setNotified(id, field, nowIso());
  audit(req, 'breach.notify', { entityType: 'breach', entityId: id, meta: { target: req.body.target } });
  res.redirect('/admin/ihlaller?ok=' + encodeURIComponent('Bildirim zamanı kaydedildi.'));
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

/**
 * Demo verisi (src/demo.js): tanıtım için sahte sahip/hayvan/hatırlatma kayıtları ve SMS geçmişi.
 * Süper yöneticinin klinik verisine yazdığı tek yerdir; bu yüzden yalnızca gerçek sahip kaydı OLMAYAN
 * kliniklerde çalışır ve klinik adıyla onay ister. Hukuki kimlik ve zamanlayıcı ayarına dokunmaz;
 * demo numaralar (0515/0516) SMS çıkışında sağlayıcıya hiç gitmez (sms/index.js).
 */
adminRouter.post('/klinik/:id/demo', (req, res) => {
  const c = loadClinic(req, res);
  if (!c) return;
  if (trim(req.body.confirm_name, 80) !== c.name) {
    return detailView(res, c, { error: 'Demo verisi için klinik adını aynen yazın.', status: 400 });
  }
  if (!c.active) return detailView(res, c, { error: 'Pasif kliniğe demo verisi yüklenmez; önce aktifleştirin.', status: 400 });
  const db = openTenant(c.id);
  const real = nonDemoOwnerCount(db);
  if (real > 0) {
    return detailView(res, c, { error: `Bu klinikte ${real} gerçek sahip kaydı var; demo verisi yalnızca boş kliniğe yüklenir.`, status: 400 });
  }
  const added = seedDemo(db); // hukuki kimlik yazılmaz, zamanlayıcı ayarı değişmez
  audit(req, 'clinic.demo_seed', { clinicId: c.id, entityType: 'clinic', entityId: c.id, meta: added });
  const text = added.owners === 0
    ? 'Demo verisi zaten yüklü; hiçbir şey değişmedi.'
    : `Demo verisi yüklendi: ${added.owners} sahip, ${added.pets} hayvan, ${added.reminders} hatırlatma, ${added.sms} SMS kaydı. Demo numaralara gerçek SMS gitmez; gönderim için klinik Ayarlar › Hukuki kimlik bölümünü kendisi doldurmalı.`;
  res.redirect(`/admin/klinik/${c.id}?ok=` + encodeURIComponent(text));
});

/* ---------- Klinik kullanıcıları: süper yönetici tüm bilgileri düzenler (ad, e-posta, rol, durum, parola, silme) ---------- */

/** Kliniğe ait kullanıcı; başka kliniğin kullanıcısı ve süper yöneticiler kapsam dışı */
function clinicUser(c, uid) {
  const u = users.byId(toInt(uid));
  return u && u.clinic_id === c.id && u.role !== 'superadmin' ? u : null;
}

/** Kliniğin giriş yapabilen en az bir yöneticisi kalmalı; yoksa klinik kilitlenir ve yalnızca Teserix açabilir */
function wouldOrphanClinic(c, u, { role = u.role, active = !!u.active } = {}) {
  const wasActiveAdmin = u.role === 'admin' && !!u.active;
  const staysActiveAdmin = role === 'admin' && active;
  return wasActiveAdmin && !staysActiveAdmin && users.activeAdminCount(c.id) <= 1;
}

function userView(res, clinic, u, { error = null, form = null, status = 200 } = {}) {
  res.status(status).render('admin_user', {
    title: `${u.name} · ${clinic.name}`, clinic, u, error,
    form: form || { name: u.name, email: u.email, role: u.role, active: u.active ? '1' : '0' },
  });
}

function userNotFound(res, c) {
  return res.redirect(`/admin/klinik/${c.id}?err=` + encodeURIComponent('Kullanıcı bulunamadı.'));
}

adminRouter.get('/klinik/:id/kullanici/:uid', (req, res) => {
  const c = loadClinic(req, res);
  if (!c) return;
  const u = clinicUser(c, req.params.uid);
  if (!u) return userNotFound(res, c);
  userView(res, c, u);
});

/** Kliniğe yeni kullanıcı (klinik yöneticisinin /kullanicilar akışıyla aynı kurallar) */
adminRouter.post('/klinik/:id/kullanici', async (req, res) => {
  const c = loadClinic(req, res);
  if (!c) return;
  const form = { name: trim(req.body.name, 80), email: trim(req.body.email, 120).toLowerCase(), role: req.body.role === 'admin' ? 'admin' : 'staff' };
  const password = String(req.body.password || '');
  const fail = (error) => detailView(res, c, { error, userForm: form, status: 400 });
  if (!form.name || !form.email) return fail('Ad ve e-posta zorunlu.');
  if (!isValidEmail(form.email)) return fail('E-posta adresi geçersiz.');
  const problem = passwordProblem(password);
  if (problem) return fail(problem);
  if (users.byEmail(form.email)) return fail('Bu e-posta kullanılamıyor.');
  const r = users.create({ clinicId: c.id, email: form.email, name: form.name, passwordHash: await hashPassword(password), role: form.role, createdAt: nowIso(), mustChangePassword: 1 });
  audit(req, 'user.create', { clinicId: c.id, entityType: 'user', entityId: r.lastInsertRowid, meta: { role: form.role } });
  // Flash metnine e-posta yazılmaz (URL erişim günlüklerine düşer); kullanıcı listede zaten görünür
  res.redirect(`/admin/klinik/${c.id}?ok=` + encodeURIComponent('Kullanıcı eklendi; ilk girişte parola değişimi istenecek.'));
});

adminRouter.post('/klinik/:id/kullanici/:uid/duzenle', (req, res) => {
  const c = loadClinic(req, res);
  if (!c) return;
  const u = clinicUser(c, req.params.uid);
  if (!u) return userNotFound(res, c);
  const form = {
    name: trim(req.body.name, 80),
    email: trim(req.body.email, 120).toLowerCase(),
    role: req.body.role === 'admin' ? 'admin' : 'staff',
    active: req.body.active === '1' ? '1' : '0',
  };
  const fail = (error) => userView(res, c, u, { error, form, status: 400 });
  if (!form.name || !form.email) return fail('Ad ve e-posta zorunlu.');
  if (!isValidEmail(form.email)) return fail('E-posta adresi geçersiz.');
  const other = users.byEmail(form.email);
  if (other && other.id !== u.id) return fail('Bu e-posta kullanılamıyor.');
  const active = form.active === '1';
  if (wouldOrphanClinic(c, u, { role: form.role, active })) {
    return fail('Kliniğin giriş yapabilen en az bir yöneticisi kalmalı; önce başka bir yönetici ekleyin.');
  }
  const changed = {
    name: form.name !== u.name,
    email: form.email !== u.email,
    role: form.role !== u.role ? form.role : null,
    active: active !== !!u.active ? active : null,
  };
  users.update(u.id, { name: form.name, email: form.email, role: form.role, active });
  // E-posta, rol ya da durum değişince açık oturumlar kapanır (eski yetkiyle devam edilmesin)
  if (changed.email || changed.role !== null || changed.active !== null) sessions.deleteForUser(u.id);
  audit(req, 'user.update', { clinicId: c.id, entityType: 'user', entityId: u.id, meta: changed });
  res.redirect(`/admin/klinik/${c.id}/kullanici/${u.id}?ok=` + encodeURIComponent('Kaydedildi.'));
});

/** Süper yönetici belirli bir parola verir (geçici parola üretimi için /sifre-sifirla) */
adminRouter.post('/klinik/:id/kullanici/:uid/parola', async (req, res) => {
  const c = loadClinic(req, res);
  if (!c) return;
  const u = clinicUser(c, req.params.uid);
  if (!u) return userNotFound(res, c);
  const password = String(req.body.password || '');
  const problem = passwordProblem(password);
  if (problem) return userView(res, c, u, { error: problem, status: 400 });
  const mustChange = req.body.must_change === '1';
  users.setPassword(u.id, await hashPassword(password), mustChange ? 1 : 0);
  sessions.deleteForUser(u.id);
  audit(req, 'user.password_set', { clinicId: c.id, entityType: 'user', entityId: u.id, meta: { mustChange } });
  res.redirect(`/admin/klinik/${c.id}/kullanici/${u.id}?ok=` + encodeURIComponent(mustChange ? 'Parola kaydedildi; kullanıcı ilk girişte değiştirecek.' : 'Parola kaydedildi.'));
});

adminRouter.post('/klinik/:id/kullanici/:uid/sil', (req, res) => {
  const c = loadClinic(req, res);
  if (!c) return;
  const u = clinicUser(c, req.params.uid);
  if (!u) return userNotFound(res, c);
  if (wouldOrphanClinic(c, u, { active: false })) {
    return userView(res, c, u, { error: 'Kliniğin giriş yapabilen en az bir yöneticisi kalmalı; silmeden önce başka bir yönetici ekleyin.', status: 400 });
  }
  sessions.deleteForUser(u.id);
  users.delete(u.id);
  audit(req, 'user.delete', { clinicId: c.id, entityType: 'user', entityId: u.id });
  res.redirect(`/admin/klinik/${c.id}?ok=` + encodeURIComponent('Kullanıcı silindi.'));
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
