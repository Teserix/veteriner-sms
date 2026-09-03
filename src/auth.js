import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { randomToken, sha256, safeEqual } from './crypto.js';
import { sessions, users } from './db/master.js';
import { nowIso } from './util.js';

const COOKIE = 'vsid';
const BCRYPT_ROUNDS = 12;

/* ---------- Parola ---------- */
export const hashPassword = (p) => bcrypt.hash(p, BCRYPT_ROUNDS);
export const verifyPassword = (p, hash) => bcrypt.compare(p, hash);

export function passwordProblem(p) {
  if (!p || p.length < 8) return 'Parola en az 8 karakter olmalı.';
  if (p.length > 128) return 'Parola çok uzun.';
  if (!/[a-zA-Z]/.test(p) || !/\d/.test(p)) return 'Parola en az bir harf ve bir rakam içermeli.';
  return null;
}

/* ---------- Giriş denemesi sınırlama (IP + e-posta) ---------- */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const attempts = new Map(); // key -> { count, first }

function bump(key) {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || now - a.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: now });
    return 1;
  }
  a.count++;
  return a.count;
}

export function isRateLimited(...keys) {
  const now = Date.now();
  return keys.some((k) => {
    const a = attempts.get(k);
    return a && now - a.first <= WINDOW_MS && a.count >= MAX_ATTEMPTS;
  });
}

export function recordFailure(...keys) {
  keys.forEach(bump);
}

export function clearFailures(...keys) {
  keys.forEach((k) => attempts.delete(k));
}

setInterval(() => {
  const now = Date.now();
  for (const [k, a] of attempts) if (now - a.first > WINDOW_MS) attempts.delete(k);
}, 60 * 1000).unref();

/* ---------- Çerez yardımcıları ---------- */
function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function setSessionCookie(res, token) {
  const parts = [
    `${COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${config.sessionTtlHours * 3600}`,
  ];
  if (config.isProd) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  res.append('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${config.isProd ? '; Secure' : ''}`);
}

/* ---------- Oturum ---------- */
export function createSession(res, req, userId) {
  const token = randomToken(32);
  const now = new Date();
  const exp = new Date(now.getTime() + config.sessionTtlHours * 3600 * 1000);
  sessions.create({
    id: sha256(token),
    userId,
    csrf: randomToken(24),
    createdAt: now.toISOString(),
    expiresAt: exp.toISOString(),
    ip: req.ip,
    userAgent: String(req.headers['user-agent'] || '').slice(0, 200),
  });
  users.touchLogin(userId, now.toISOString());
  setSessionCookie(res, token);
}

export function destroySession(req, res) {
  if (req.session?.session_id) sessions.delete(req.session.session_id);
  clearSessionCookie(res);
}

/** Her istekte oturumu çözer; req.session ve req.user doldurulur */
export function sessionMiddleware(req, res, next) {
  req.session = null;
  req.user = null;
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token && token.length < 200) {
    const s = sessions.get(sha256(token));
    if (s) {
      const expired = s.expires_at < nowIso();
      const disabled = !s.user_active || (s.clinic_id && !s.clinic_active);
      if (expired || disabled) {
        sessions.delete(s.session_id);
        clearSessionCookie(res);
      } else {
        req.session = s;
        req.user = {
          id: s.user_id,
          email: s.email,
          name: s.name,
          role: s.role,
          clinicId: s.clinic_id,
          clinicName: s.clinic_name,
        };
      }
    }
  }
  res.locals.user = req.user;
  res.locals.csrf = req.session?.csrf || '';
  next();
}

/** POST/PUT/DELETE isteklerinde CSRF belirtecini doğrular */
export function csrfMiddleware(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (!req.session) return next(); // giriş sayfası gibi oturumsuz formlar kendi koruması ile
  const sent = req.body?._csrf || req.headers['x-csrf-token'];
  if (!safeEqual(sent, req.session.csrf)) {
    return res.status(403).render('error', { title: 'Güvenlik hatası', message: 'Form belirteci geçersiz. Sayfayı yenileyip tekrar deneyin.' });
  }
  next();
}

/* ---------- Yetki kontrolleri ---------- */
export function requireLogin(req, res, next) {
  if (!req.user) return res.redirect('/giris?next=' + encodeURIComponent(req.originalUrl));
  next();
}

export function requireClinic(req, res, next) {
  if (!req.user) return res.redirect('/giris');
  if (!req.user.clinicId) {
    // Süper yönetici klinik verisi görmez; yönetim paneline yönlendir
    return res.redirect('/admin');
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.redirect('/giris');
    if (!roles.includes(req.user.role)) {
      return res.status(403).render('error', { title: 'Yetkisiz', message: 'Bu sayfaya erişim yetkiniz yok.' });
    }
    next();
  };
}
