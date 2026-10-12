import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { config } from './config.js';
import { sessionMiddleware, csrfMiddleware, originCheck, requireRole, mustChangePasswordGate, legalAcceptanceGate } from './auth.js';
import { limiters, clientIp } from './ratelimit.js';
import { opsRouter } from './routes/ops.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { usersRouter } from './routes/users.js';
import { clinicRouter, clinicScope } from './routes/clinic.js';
import { ownersRouter } from './routes/owners.js';
import { remindersRouter } from './routes/reminders.js';
import { quickRouter } from './routes/quick.js';
import { importRouter } from './routes/import.js';
import { publicRouter } from './routes/public.js';
import { legalRouter } from './routes/legal.js';
import { tourRouter } from './routes/tour.js';
import { log } from './log.js';
import { formatPhone, formatDate, formatDateTime, REMINDER_TYPES, STATUS_LABELS, SPECIES } from './util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

/** Statik varlıkların içerik özeti: sürüm değişince tarayıcı ve service worker önbelleği eski CSS/JS'i kullanmaz */
const ASSET_VERSION = (() => {
  const h = crypto.createHash('sha256');
  for (const f of ['style.css', 'app.js', 'icons/sprite.svg']) {
    try { h.update(fs.readFileSync(path.join(PUBLIC_DIR, f))); } catch { /* yoksa atla */ }
  }
  return h.digest('hex').slice(0, 10);
})();

const ICON_NAME = /^[a-z-]+$/;
/** Simge: <%- icon('send') %> → dekoratif SVG (ekran okuyucudan gizli; anlamı yanındaki metin taşır) */
function icon(name, cls = '') {
  if (!ICON_NAME.test(name)) return '';
  return `<svg class="icon${cls ? ' ' + cls : ''}" aria-hidden="true" focusable="false"><use href="/static/icons/sprite.svg?v=${ASSET_VERSION}#i-${name}"/></svg>`;
}

/**
 * Header'daki _tourAuto: klinik kullanıcısı, parolasını değiştirmiş ve turu henüz görmemişse.
 * Süper yönetici adımları klinik ekranlarına ait olduğu için false.
 */
function tourAutoFor(req) {
  const u = req.user;
  if (!u || u.role === 'superadmin' || !u.clinicId || u.mustChangePassword) return false;
  const seen = req.session ? req.session.tour_seen_at : null;
  return seen == null || seen === '';
}

/** Express uygulamasını kurar (dinlemez). Testler doğrudan bunu kullanır. */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));

  // Görünüm varsayılanları: erken hata sayfaları (CSRF 403, 404, 500) bile güvenle render edilir
  Object.assign(app.locals, {
    user: null, csrf: '', settings: {}, currentPath: '', flash: { ok: '', err: '' }, tourAuto: false, _tourAuto: false,
    formatPhone, formatDate, formatDateTime, REMINDER_TYPES, STATUS_LABELS, SPECIES,
    icon, assetV: ASSET_VERSION,
  });

  /* ---------- Güvenlik başlıkları ---------- */
  app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader('Cache-Control', 'no-store');
    if (config.isProd) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });

  const publicDir = PUBLIC_DIR;
  app.use('/static', express.static(publicDir, { maxAge: '1h' }));
  app.use('/api', opsRouter);

  /* ---------- PWA: kök kapsamda servis edilmesi gereken dosyalar ----------
   * Service worker'ın "/" kapsamını yönetebilmesi için /sw.js kökten
   * sunulmalı; manifest de giriş yapılmadan okunabilmeli. Bu yüzden bu
   * rotalar oturum/CSRF ara katmanlarından ÖNCE, /api gibi tanımlanır.
   * Dosya adları sabittir; kullanıcı girdisiyle yol birleştirme yoktur.
   */
  const sendPublicFile = (res, next, name, headers) =>
    res.sendFile(path.join(publicDir, name), { headers }, (err) => {
      if (err && !res.headersSent) next(err);
    });

  app.get('/sw.js', (req, res, next) => sendPublicFile(res, next, 'sw.js', {
    'Content-Type': 'application/javascript; charset=utf-8',
    'Service-Worker-Allowed': '/',
    // Güncellemelerin yayılabilmesi için her zaman sunucuya sorulur
    'Cache-Control': 'no-cache',
  }));

  app.get('/manifest.webmanifest', (req, res, next) => sendPublicFile(res, next, 'manifest.webmanifest', {
    'Content-Type': 'application/manifest+json; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
  }));

  app.get('/favicon.ico', (req, res) => res.redirect(302, '/static/icons/favicon.svg'));

  app.use(express.urlencoded({ extended: false, limit: '64kb', parameterLimit: 100 }));
  // Express 5: gövde ayrıştırılmadıysa req.body undefined kalır; form olmayan POST'larda 500 yerine boş nesne
  app.use((req, res, next) => { if (req.body == null) req.body = {}; next(); });
  app.use(sessionMiddleware);

  /* ---------- Görünüm yardımcıları (CSRF'den önce, hata sayfaları için) ---------- */
  app.use((req, res, next) => {
    res.locals.currentPath = req.path;
    res.locals.flash = {
      ok: typeof req.query.ok === 'string' ? req.query.ok.slice(0, 300) : '',
      err: typeof req.query.err === 'string' ? req.query.err.slice(0, 300) : '',
    };
    res.locals.tourAuto = tourAutoFor(req);
    res.locals._tourAuto = res.locals.tourAuto;
    next();
  });

  app.use(originCheck);
  app.use(limiters.post.middleware((req) => (req.method === 'POST' ? clientIp(req) : null)));
  app.use(csrfMiddleware);
  app.use(mustChangePasswordGate);

  /* ---------- Rotalar ---------- */
  app.use(publicRouter);          // oturumsuz: hukuki metinler, iletişim, klinik aydınlatma, SMS ret bağlantısı
  app.use(authRouter);
  app.use(tourRouter);            // POST /tur/goruldu — sözleşme kapısından önce; tur işareti klinik ekranına bağlı değil
  app.use('/admin', requireRole('superadmin'), adminRouter);
  app.use(legalAcceptanceGate);   // klinik yöneticisi güncel sözleşmeyi kabul etmeden klinik ekranlarına giremez
  app.use(legalRouter);
  app.use(clinicScope);
  app.use('/kullanicilar', requireRole('admin'), usersRouter);
  app.use(ownersRouter);
  app.use(remindersRouter);
  app.use(quickRouter);
  app.use('/iceaktar', requireRole('admin'), importRouter);
  app.use(clinicRouter);

  app.use((req, res) => {
    res.status(404).render('error', { title: 'Sayfa bulunamadı', message: 'Aradığınız sayfa yok.' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err?.type === 'entity.too.large') {
      return res.status(413).render('error', { title: 'Çok büyük', message: 'Gönderilen veri çok büyük.' });
    }
    log.error('istek hatası', { path: req.path, error: err?.message });
    if (res.headersSent) return;
    res.status(err?.status || 500).render('error', { title: 'Hata', message: config.isProd ? 'Beklenmeyen bir hata oluştu.' : String(err?.message || err) });
  });

  return app;
}
