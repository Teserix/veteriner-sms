import { Router } from 'express';
import { users } from '../db/master.js';
import {
  verifyPassword, hashPassword, passwordProblem, createSession, destroySession,
  isRateLimited, recordFailure, clearFailures, requireLogin,
} from '../auth.js';
import { sessions } from '../db/master.js';
import { trim } from '../util.js';

export const authRouter = Router();

function safeNext(n) {
  return typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') ? n : '/';
}

authRouter.get('/giris', (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('login', { title: 'Giriş', error: null, email: '', next: safeNext(req.query.next) });
});

authRouter.post('/giris', async (req, res) => {
  const email = trim(req.body.email, 120).toLowerCase();
  const password = String(req.body.password || '');
  const next = safeNext(req.body.next);
  const keys = ['ip:' + req.ip, 'email:' + email];

  const fail = (msg) => res.status(401).render('login', { title: 'Giriş', error: msg, email, next });

  if (isRateLimited(...keys)) return fail('Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.');

  const u = users.byEmail(email);
  // Kullanıcı yoksa da sabit süreli karşılaştırma yap (zamanlama sızıntısını azaltır)
  const ok = u ? await verifyPassword(password, u.password_hash) : await verifyPassword(password, '$2a$12$abcdefghijklmnopqrstuuJ7GJGZ.7hEh0fDp1Yqk6XcJ8QO6dW5W');
  if (!u || !ok || !u.active) {
    recordFailure(...keys);
    return fail('E-posta veya parola hatalı.');
  }
  clearFailures(...keys);
  createSession(res, req, u.id);
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

  users.setPassword(u.id, await hashPassword(p1));
  // Diğer cihazlardaki oturumları kapat, bu oturumu yenile
  sessions.deleteForUser(u.id);
  createSession(res, req, u.id);
  res.redirect('/?ok=' + encodeURIComponent('Parolanız güncellendi.'));
});
