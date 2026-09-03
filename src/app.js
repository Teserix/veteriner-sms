import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { config } from './config.js';
import { sessionMiddleware, csrfMiddleware, originCheck, requireRole, mustChangePasswordGate } from './auth.js';
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
import { log } from './log.js';
import { formatPhone, formatDate, formatDateTime, REMINDER_TYPES, STATUS_LABELS, SPECIES } from './util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Express uygulamasını kurar (dinlemez). Testler doğrudan bunu kullanır. */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));

  // Görünüm varsayılanları: erken hata sayfaları (CSRF 403, 404, 500) bile güvenle render edilir
  Object.assign(app.locals, {
    user: null, csrf: '', settings: {}, currentPath: '', flash: { ok: '', err: '' },
    formatPhone, formatDate, formatDateTime, REMINDER_TYPES, STATUS_LABELS, SPECIES,
  });

  /* ---------- Güvenlik başlıkları ---------- */
  app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader('Cache-Control', 'no-store');
    if (config.isProd) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });

  app.use('/static', express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h' }));
  app.use('/api', opsRouter);

  app.use(express.urlencoded({ extended: false, limit: '64kb', parameterLimit: 100 }));
  app.use(sessionMiddleware);

  /* ---------- Görünüm yardımcıları (CSRF'den önce, hata sayfaları için) ---------- */
  app.use((req, res, next) => {
    res.locals.currentPath = req.path;
    res.locals.flash = {
      ok: typeof req.query.ok === 'string' ? req.query.ok.slice(0, 300) : '',
      err: typeof req.query.err === 'string' ? req.query.err.slice(0, 300) : '',
    };
    next();
  });

  app.use(originCheck);
  app.use(limiters.post.middleware((req) => (req.method === 'POST' ? clientIp(req) : null)));
  app.use(csrfMiddleware);
  app.use(mustChangePasswordGate);

  /* ---------- Rotalar ---------- */
  app.use(authRouter);
  app.use('/admin', requireRole('superadmin'), adminRouter);
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
