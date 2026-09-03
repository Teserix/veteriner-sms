import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { config } from './config.js';
import { users, sessions } from './db/master.js';
import { closeAll } from './db/tenant.js';
import { sessionMiddleware, csrfMiddleware, hashPassword } from './auth.js';
import { startScheduler } from './scheduler.js';
import { authRouter } from './routes/auth.js';
import { clinicRouter } from './routes/clinic.js';
import { ownersRouter } from './routes/owners.js';
import { remindersRouter } from './routes/reminders.js';
import { usersRouter } from './routes/users.js';
import { adminRouter } from './routes/admin.js';
import { formatPhone, formatDate, formatDateTime, nowIso, REMINDER_TYPES, STATUS_LABELS, SPECIES } from './util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.disable('x-powered-by');
if (config.trustProxy) app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

/* ---------- Güvenlik başlıkları ---------- */
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cache-Control', 'no-store');
  if (config.isProd) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.use('/static', express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));
app.use(sessionMiddleware);
app.use(csrfMiddleware);

/* ---------- Görünüm yardımcıları ---------- */
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.flash = { ok: typeof req.query.ok === 'string' ? req.query.ok.slice(0, 300) : '', err: typeof req.query.err === 'string' ? req.query.err.slice(0, 300) : '' };
  res.locals.formatPhone = formatPhone;
  res.locals.formatDate = formatDate;
  res.locals.formatDateTime = formatDateTime;
  res.locals.REMINDER_TYPES = REMINDER_TYPES;
  res.locals.STATUS_LABELS = STATUS_LABELS;
  res.locals.SPECIES = SPECIES;
  res.locals.settings = res.locals.settings || {};
  next();
});

/* ---------- Rotalar ---------- */
app.use(authRouter);
app.use(adminRouter);
app.use(usersRouter);
app.use(ownersRouter);
app.use(remindersRouter);
app.use(clinicRouter);

app.use((req, res) => {
  res.status(404).render('error', { title: 'Sayfa bulunamadı', message: 'Aradığınız sayfa yok.' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { title: 'Hata', message: config.isProd ? 'Beklenmeyen bir hata oluştu.' : err.message });
});

/* ---------- İlk süper yönetici ---------- */
async function bootstrapAdmin() {
  if (users.count() > 0) return;
  if (!config.adminEmail || !config.adminPassword) {
    console.warn('[UYARI] Hiç kullanıcı yok. .env dosyasına ADMIN_EMAIL/ADMIN_PASSWORD yazın veya "npm run create-admin" çalıştırın.');
    return;
  }
  users.create({
    clinicId: null,
    email: config.adminEmail.toLowerCase(),
    name: 'Süper Yönetici',
    passwordHash: await hashPassword(config.adminPassword),
    role: 'superadmin',
    createdAt: nowIso(),
  });
  console.log(`[kurulum] Süper yönetici oluşturuldu: ${config.adminEmail}`);
}

/* ---------- Başlat ---------- */
await bootstrapAdmin();
sessions.purgeExpired(nowIso());
setInterval(() => sessions.purgeExpired(nowIso()), 30 * 60 * 1000).unref();
startScheduler();

const server = app.listen(config.port, () => {
  console.log(`Veteriner SMS çalışıyor: http://localhost:${config.port}  (${config.isProd ? 'production' : 'development'})`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close();
    closeAll();
    process.exit(0);
  });
}
