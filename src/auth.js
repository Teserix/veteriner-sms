import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { randomToken, sha256, safeEqual } from './crypto.js';
import { sessions, users } from './db/master.js';
import { nowIso, safeLocalPath } from './util.js';
import { clientIp } from './ratelimit.js';

export const SESSION_COOKIE = config.isProd ? '__Host-vsid' : 'vsid';
export const PRE_COOKIE = 'vpre';
const BCRYPT_ROUNDS = 12;

/* ---------- Parola ---------- */
export const hashPassword = (p) => bcrypt.hash(p, BCRYPT_ROUNDS);
export const verifyPassword = (p, hash) => bcrypt.compare(p, hash);

/** Bilinmeyen e-postada da bcrypt çalışsın diye açılışta üretilen sahte hash */
export let DUMMY_HASH = null;
export async function initAuth() {
  DUMMY_HASH = await hashPassword(randomToken(16));
}

export function passwordProblem(p) {
  if (!p || p.length < 8) return 'Parola en az 8 karakter olmalı.';
  if (p.length > 128) return 'Parola çok uzun.';
  if (!/[a-zA-Z]/.test(p) || !/\d/.test(p)) return 'Parola en az bir harf ve bir rakam içermeli.';
  return null;
}

/** Rastgele, okunabilir geçici parola (harf+rakam, 12 karakter) */
export function generatePassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = randomToken(24);
  for (let i = 0; out.length < 12 && i < bytes.length; i++) {
    const idx = bytes.charCodeAt(i) % alphabet.length;
    out += alphabet[idx];
  }
  // en az bir harf ve bir rakam garantisi
  if (!/\d/.test(out)) out = out.slice(0, 11) + '7';
  if (!/[a-zA-Z]/.test(out)) out = 'k' + out.slice(1);
  return out;
}

/* ---------- Çerez yardımcıları ---------- */
export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) { try { out[k] = decodeURIComponent(v); } catch { out[k] = v; } }
  }
  return out;
}

function cookieString(name, value, { maxAge, path = '/' }) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`];
  if (config.isProd) parts.push('Secure');
  return parts.join('; ');
}

function setSessionCookie(res, token) {
  res.append('Set-Cookie', cookieString(SESSION_COOKIE, token, { maxAge: config.sessionTtlHours * 3600 }));
}

function clearSessionCookie(res) {
  res.append('Set-Cookie', cookieString(SESSION_COOKIE, '', { maxAge: 0 }));
}

/** Giriş formu için oturum öncesi CSRF belirteci (double-submit çerez) */
export function issuePreToken(res) {
  const token = randomToken(24);
  res.append('Set-Cookie', cookieString(PRE_COOKIE, token, { maxAge: 15 * 60, path: '/giris' }));
  return token;
}

export function verifyPreToken(req) {
  const cookie = parseCookies(req.headers.cookie)[PRE_COOKIE];
  const sent = req.body?._csrf;
  return Boolean(cookie && sent && safeEqual(cookie, sent));
}

/* ---------- Oturum ---------- */
export function createSession(res, req, userId) {
  // Oturum rotasyonu: varsa eski oturum silinir
  if (req.session?.session_id) sessions.delete(req.session.session_id);
  const token = randomToken(32);
  const now = new Date();
  const exp = new Date(now.getTime() + config.sessionTtlHours * 3600 * 1000);
  sessions.create({
    id: sha256(token),
    userId,
    csrf: randomToken(24),
    createdAt: now.toISOString(),
    expiresAt: exp.toISOString(),
    ip: clientIp(req),
    userAgent: String(req.headers['user-agent'] || '').slice(0, 200),
  });
  users.touchLogin(userId, now.toISOString());
  setSessionCookie(res, token);
}

export function destroySession(req, res) {
  if (req.session?.session_id) sessions.delete(req.session.session_id);
  clearSessionCookie(res);
  req.session = null;
  req.user = null;
}

/** Her istekte oturumu çözer; req.session ve req.user doldurulur */
export function sessionMiddleware(req, res, next) {
  req.session = null;
  req.user = null;
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
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
          mustChangePassword: Boolean(s.must_change_password),
        };
      }
    }
  }
  res.locals.user = req.user;
  res.locals.csrf = req.session?.csrf || '';
  next();
}

/* ---------- CSRF / Origin ---------- */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Origin (yoksa Referer) uygulamanın kendi origin'i değilse 403 */
export function originCheck(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const expected = config.appOrigin || `${req.protocol}://${req.get('host')}`;
  let origin = req.get('Origin');
  if (!origin) {
    const ref = req.get('Referer');
    if (ref) { try { origin = new URL(ref).origin; } catch { origin = 'invalid'; } }
  }
  if (!origin) {
    if (config.isProd) return res.status(403).render('error', { title: 'Güvenlik hatası', message: 'İsteğin kaynağı doğrulanamadı.' });
    return next();
  }
  if (origin !== expected) {
    return res.status(403).render('error', { title: 'Güvenlik hatası', message: 'İsteğin kaynağı doğrulanamadı.' });
  }
  next();
}

/** POST/PUT/DELETE isteklerinde CSRF belirtecini doğrular */
export function csrfMiddleware(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (!req.session) {
    // Oturumsuz form yalnızca giriş; kendi oturum-öncesi belirteciyle korunur
    if (req.path === '/giris') return next();
    return res.status(403).render('error', { title: 'Oturum bulunamadı', message: 'Oturumunuz sona ermiş. Lütfen yeniden giriş yapın.' });
  }
  const sent = req.body?._csrf || req.headers['x-csrf-token'];
  if (!safeEqual(sent, req.session.csrf)) {
    return res.status(403).render('error', { title: 'Güvenlik hatası', message: 'Form belirteci geçersiz. Sayfayı yenileyip tekrar deneyin.' });
  }
  next();
}

/* ---------- Yetki kontrolleri ---------- */
export function requireLogin(req, res, next) {
  if (!req.user) return res.redirect('/giris?next=' + encodeURIComponent(safeLocalPath(req.originalUrl)));
  next();
}

export function requireClinic(req, res, next) {
  if (!req.user) return res.redirect('/giris?next=' + encodeURIComponent(safeLocalPath(req.originalUrl)));
  if (!req.user.clinicId) return res.redirect('/admin');
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.redirect('/giris?next=' + encodeURIComponent(safeLocalPath(req.originalUrl)));
    if (!roles.includes(req.user.role)) {
      return res.status(403).render('error', { title: 'Yetkisiz', message: 'Bu sayfaya erişim yetkiniz yok.' });
    }
    next();
  };
}

/** Geçici parolayla giren kullanıcı önce parolasını değiştirmeli */
export function mustChangePasswordGate(req, res, next) {
  if (!req.user?.mustChangePassword) return next();
  if (req.path === '/sifre' || req.path === '/cikis') return next();
  return res.redirect('/sifre?err=' + encodeURIComponent('Devam etmeden önce geçici parolanızı değiştirin.'));
}
