import { Router } from 'express';
import { users, sessions } from '../db/master.js';
import {
  verifyPassword, hashPassword, passwordProblem, createSession, destroySession,
  issuePreToken, verifyPreToken, requireLogin, DUMMY_HASH,
} from '../auth.js';
import { limiters, clientIp } from '../ratelimit.js';
import { audit } from '../audit.js';
import { trim, isValidEmail, safeLocalPath } from '../util.js';

export const authRouter = Router();

function renderLogin(res, { status = 200, error = null, email = '', next = '/' } = {}) {
  const preToken = issuePreToken(res);
  res.status(status).render('login', { title: 'Giriş', error, email, next, preToken });
}

authRouter.get('/giris', (req, res) => {
  if (req.user) return res.redirect(req.user.role === 'superadmin' ? '/admin' : '/');
  renderLogin(res, { next: safeLocalPath(req.query.next) });
});

authRouter.post('/giris', async (req, res) => {
  const email = trim(req.body.email, 120).toLowerCase();
  const password = String(req.body.password || '');
  const next = safeLocalPath(req.body.next);
  const ip = clientIp(req);
  const keys = ['ip:' + ip, 'email:' + email];
  const fail = (msg, status = 401) => renderLogin(res, { status, error: msg, email, next });

  if (!verifyPreToken(req)) return fail('Form süresi dolmuş. Lütfen tekrar deneyin.', 403);
  if (keys.some((k) => limiters.login.isLimited(k))) return fail('Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.', 429);
  if (!isValidEmail(email) || !password) {
    keys.forEach((k) => limiters.login.hit(k));
    return fail('E-posta veya parola hatalı.');
  }

  const u = users.byEmail(email);
  // Kullanıcı yoksa da bcrypt çalıştır (zamanlama farkını azaltır)
  const ok = await verifyPassword(password, u ? u.password_hash : DUMMY_HASH);
  if (!u || !ok || !u.active) {
    keys.forEach((k) => limiters.login.hit(k));
    audit(req, 'login.fail', { meta: { email } });
    return fail('E-posta veya parola hatalı.');
  }
  limiters.login.reset('email:' + email); // IP sayacı pencere sonunda kendiliğinden düşer (parola püskürtmeye karşı)
  createSession(res, req, u.id);
  req.user = { id: u.id, email: u.email, role: u.role, clinicId: u.clinic_id };
  audit(req, 'login.ok', { clinicId: u.clinic_id });
  if (u.must_change_password) return res.redirect('/sifre?err=' + encodeURIComponent('Geçici parolanızı değiştirin.'));
  res.redirect(u.role === 'superadmin' ? '/admin' : next);
});

authRouter.post('/cikis', (req, res) => {
  destroySession(req, res);
  res.redirect('/giris');
});

authRouter.get('/sifre', requireLogin, (req, res) => {
  res.render('password', { title: 'Parola', error: null });
});

authRouter.post('/sifre', requireLogin, async (req, res) => {
  const u = users.byId(req.user.id);
  const current = String(req.body.current || '');
  const p1 = String(req.body.password || '');
  const p2 = String(req.body.password2 || '');
  const err = (m) => res.status(400).render('password', { title: 'Parola', error: m });

  if (!(await verifyPassword(current, u.password_hash))) return err('Mevcut parola hatalı.');
  if (p1 !== p2) return err('Yeni parolalar eşleşmiyor.');
  const problem = passwordProblem(p1);
  if (problem) return err(problem);
  if (p1 === current) return err('Yeni parola mevcut parolayla aynı olamaz.');

  users.setPassword(u.id, await hashPassword(p1), 0);
  sessions.deleteForUser(u.id);
  req.session = null;
  createSession(res, req, u.id);
  audit(req, 'password.change', { entityType: 'user', entityId: u.id });
  res.redirect((u.role === 'superadmin' ? '/admin' : '/') + '?ok=' + encodeURIComponent('Parolanız güncellendi.'));
});
