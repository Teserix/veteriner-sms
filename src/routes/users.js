import { Router } from 'express';
import { hashPassword, passwordProblem, generatePassword } from '../auth.js';
import { users, sessions } from '../db/master.js';
import { audit } from '../audit.js';
import { trim, toInt, nowIso, isValidEmail } from '../util.js';

/** Klinik yöneticisinin kendi personelini yönettiği sayfalar ( /kullanicilar altında, admin rolü app.js'te zorunlu) */
export const usersRouter = Router();

function render(req, res, { error = null, form = {}, status = 200, tempPassword = null, tempFor = null } = {}) {
  res.status(status).render('users', { title: 'Kullanıcılar', list: users.byClinic(req.user.clinicId), error, form, tempPassword, tempFor });
}

/** Sadece kendi kliniğindeki, kendisi olmayan kullanıcı */
function ownUser(req, id) {
  const u = users.byId(id);
  return u && u.clinic_id === req.user.clinicId && u.id !== req.user.id ? u : null;
}

usersRouter.get('/', (req, res) => render(req, res));

usersRouter.post('/', async (req, res) => {
  const form = {
    name: trim(req.body.name, 80),
    email: trim(req.body.email, 120).toLowerCase(),
    role: req.body.role === 'admin' ? 'admin' : 'staff',
  };
  const password = String(req.body.password || '');
  if (!form.name || !form.email) return render(req, res, { error: 'Ad ve e-posta zorunlu.', form, status: 400 });
  if (!isValidEmail(form.email)) return render(req, res, { error: 'E-posta adresi geçersiz.', form, status: 400 });
  const problem = passwordProblem(password);
  if (problem) return render(req, res, { error: problem, form, status: 400 });
  if (users.byEmail(form.email)) return render(req, res, { error: 'Bu e-posta kullanılamıyor.', form, status: 400 });
  const r = users.create({ clinicId: req.user.clinicId, email: form.email, name: form.name, passwordHash: await hashPassword(password), role: form.role, createdAt: nowIso(), mustChangePassword: 1 });
  audit(req, 'user.create', { entityType: 'user', entityId: r.lastInsertRowid, meta: { role: form.role } });
  res.redirect('/kullanicilar?ok=' + encodeURIComponent('Kullanıcı eklendi. İlk girişte parolasını değiştirmesi istenecek.'));
});

usersRouter.post('/:id/durum', (req, res) => {
  const u = ownUser(req, toInt(req.params.id));
  if (!u) return res.redirect('/kullanicilar?err=' + encodeURIComponent('Kullanıcı bulunamadı.'));
  const active = req.body.active === '1';
  users.setActive(u.id, active);
  if (!active) sessions.deleteForUser(u.id);
  audit(req, active ? 'user.activate' : 'user.deactivate', { entityType: 'user', entityId: u.id });
  res.redirect('/kullanicilar?ok=' + encodeURIComponent('Güncellendi.'));
});

usersRouter.post('/:id/rol', (req, res) => {
  const u = ownUser(req, toInt(req.params.id));
  if (!u) return res.redirect('/kullanicilar?err=' + encodeURIComponent('Kullanıcı bulunamadı.'));
  const role = req.body.role === 'admin' ? 'admin' : 'staff';
  users.setRole(u.id, role);
  sessions.deleteForUser(u.id);
  audit(req, 'user.role', { entityType: 'user', entityId: u.id, meta: { role } });
  res.redirect('/kullanicilar?ok=' + encodeURIComponent('Rol güncellendi.'));
});

usersRouter.post('/:id/sil', (req, res) => {
  const u = ownUser(req, toInt(req.params.id));
  if (!u) return res.redirect('/kullanicilar?err=' + encodeURIComponent('Kullanıcı bulunamadı.'));
  users.delete(u.id);
  audit(req, 'user.delete', { entityType: 'user', entityId: u.id });
  res.redirect('/kullanicilar?ok=' + encodeURIComponent('Kullanıcı silindi.'));
});

/** Geçici parola üretir, bir kez ekranda gösterir; kullanıcı ilk girişte değiştirmek zorunda */
usersRouter.post('/:id/sifre-sifirla', async (req, res) => {
  const u = ownUser(req, toInt(req.params.id));
  if (!u) return res.redirect('/kullanicilar?err=' + encodeURIComponent('Kullanıcı bulunamadı.'));
  const temp = generatePassword();
  users.setPassword(u.id, await hashPassword(temp), 1);
  sessions.deleteForUser(u.id);
  audit(req, 'user.password_reset', { entityType: 'user', entityId: u.id });
  render(req, res, { tempPassword: temp, tempFor: u });
});
