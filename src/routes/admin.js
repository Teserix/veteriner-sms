import { Router } from 'express';
import { requireRole, hashPassword, passwordProblem } from '../auth.js';
import { clinics, users, sessions, master } from '../db/master.js';
import { openTenant, setSetting } from '../db/tenant.js';
import { randomId } from '../crypto.js';
import { trim, nowIso } from '../util.js';

/** Süper yönetici: klinik (kiracı) açma/kapatma. Klinik verisine erişmez. */
export const adminRouter = Router();
adminRouter.use(requireRole('superadmin'));

function render(res, { error = null, form = {}, status = 200 } = {}) {
  const list = clinics.all().map((c) => ({ ...c, user_count: clinics.userCount(c.id) }));
  res.status(status).render('admin', { title: 'Klinikler', list, error, form });
}

adminRouter.get('/admin', (req, res) => render(res));

adminRouter.post('/admin/klinik', async (req, res) => {
  const form = {
    clinic_name: trim(req.body.clinic_name, 80),
    clinic_phone: trim(req.body.clinic_phone, 30),
    admin_name: trim(req.body.admin_name, 80),
    admin_email: trim(req.body.admin_email, 120).toLowerCase(),
  };
  const password = String(req.body.admin_password || '');
  if (!form.clinic_name || !form.admin_name || !form.admin_email) return render(res, { error: 'Zorunlu alanları doldurun.', form, status: 400 });
  const problem = passwordProblem(password);
  if (problem) return render(res, { error: problem, form, status: 400 });
  if (users.byEmail(form.admin_email)) return render(res, { error: 'Bu e-posta zaten kayıtlı.', form, status: 400 });

  const id = randomId(6);
  const hash = await hashPassword(password);
  const now = nowIso();
  master.exec('BEGIN');
  try {
    clinics.create(id, form.clinic_name, form.clinic_phone, now);
    users.create({ clinicId: id, email: form.admin_email, name: form.admin_name, passwordHash: hash, role: 'admin', createdAt: now });
    master.exec('COMMIT');
  } catch (e) {
    master.exec('ROLLBACK');
    throw e;
  }
  // Kliniğe ait ayrı veritabanı dosyasını oluştur ve temel ayarları yaz
  const db = openTenant(id);
  setSetting(db, 'clinic_name', form.clinic_name);
  setSetting(db, 'clinic_phone', form.clinic_phone);

  res.redirect('/admin?ok=' + encodeURIComponent(`"${form.clinic_name}" oluşturuldu. Yönetici: ${form.admin_email}`));
});

adminRouter.post('/admin/klinik/:id/durum', (req, res) => {
  const c = clinics.get(String(req.params.id));
  if (!c) return res.redirect('/admin?err=' + encodeURIComponent('Klinik bulunamadı.'));
  const active = req.body.active === '1';
  clinics.setActive(c.id, active);
  if (!active) {
    for (const u of users.byClinic(c.id)) sessions.deleteForUser(u.id);
  }
  res.redirect('/admin?ok=' + encodeURIComponent(active ? 'Klinik aktifleştirildi.' : 'Klinik pasifleştirildi; kullanıcıları giriş yapamaz.'));
});
