import { Router } from 'express';
import { requireClinic, requireRole, hashPassword, passwordProblem } from '../auth.js';
import { users, sessions } from '../db/master.js';
import { trim, toInt, nowIso } from '../util.js';

/** Klinik yöneticisinin kendi personelini yönettiği sayfalar */
export const usersRouter = Router();
usersRouter.use(requireClinic, requireRole('admin'));

function render(req, res, { error = null, form = {}, status = 200 } = {}) {
  res.status(status).render('users', { title: 'Kullanıcılar', list: users.byClinic(req.user.clinicId), error, form });
}

/** Sadece kendi kliniğindeki kullanıcıya erişebilir */
function ownUser(req, id) {
  const u = users.byId(id);
  return u && u.clinic_id === req.user.clinicId && u.id !== req.user.id ? u : null;
}

usersRouter.get('/kullanicilar', (req, res) => render(req, res));

usersRouter.post('/kullanicilar', async (req, res) => {
  const form = {
    name: trim(req.body.name, 80),
    email: trim(req.body.email, 120).toLowerCase(),
    role: req.body.role === 'admin' ? 'admin' : 'staff',
  };
  const password = String(req.body.password || '');
  if (!form.name || !form.email) return render(req, res, { error: 'Ad ve e-posta zorunlu.', form, status: 400 });
  const problem = passwordProblem(password);
  if (problem) return render(req, res, { error: problem, form, status: 400 });
  if (users.byEmail(form.email)) return render(req, res, { error: 'Bu e-posta zaten kayıtlı.', form, status: 400 });
  users.create({ clinicId: req.user.clinicId, email: form.email, name: form.name, passwordHash: await hashPassword(password), role: form.role, createdAt: nowIso() });
  res.redirect('/kullanicilar?ok=' + encodeURIComponent('Kullanıcı eklendi.'));
});

usersRouter.post('/kullanicilar/:id/durum', (req, res) => {
  const u = ownUser(req, toInt(req.params.id));
  if (!u) return res.redirect('/kullanicilar?err=' + encodeURIComponent('Kullanıcı bulunamadı.'));
  const active = req.body.active === '1';
  users.setActive(u.id, active);
  if (!active) sessions.deleteForUser(u.id);
  res.redirect('/kullanicilar?ok=' + encodeURIComponent('Güncellendi.'));
});

usersRouter.post('/kullanicilar/:id/rol', (req, res) => {
  const u = ownUser(req, toInt(req.params.id));
  if (!u) return res.redirect('/kullanicilar?err=' + encodeURIComponent('Kullanıcı bulunamadı.'));
  users.setRole(u.id, req.body.role === 'admin' ? 'admin' : 'staff');
  sessions.deleteForUser(u.id);
  res.redirect('/kullanicilar?ok=' + encodeURIComponent('Rol güncellendi.'));
});

usersRouter.post('/kullanicilar/:id/sil', (req, res) => {
  const u = ownUser(req, toInt(req.params.id));
  if (!u) return res.redirect('/kullanicilar?err=' + encodeURIComponent('Kullanıcı bulunamadı.'));
  users.delete(u.id);
  res.redirect('/kullanicilar?ok=' + encodeURIComponent('Kullanıcı silindi.'));
});

usersRouter.post('/kullanicilar/sifre-sifirla', async (req, res) => {
  const u = ownUser(req, toInt(req.body.user_id));
  if (!u) return res.redirect('/kullanicilar?err=' + encodeURIComponent('Kullanıcı bulunamadı.'));
  const password = String(req.body.password || '');
  const problem = passwordProblem(password);
  if (problem) return res.redirect('/kullanicilar?err=' + encodeURIComponent(problem));
  users.setPassword(u.id, await hashPassword(password));
  sessions.deleteForUser(u.id);
  res.redirect('/kullanicilar?ok=' + encodeURIComponent('Parola sıfırlandı.'));
});
