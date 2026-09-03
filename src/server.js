import { config } from './config.js';
import { users, sessions } from './db/master.js';
import { closeAll } from './db/tenant.js';
import { hashPassword, initAuth } from './auth.js';
import { startScheduler, stopScheduler } from './scheduler.js';
import { createApp } from './app.js';
import { log } from './log.js';
import { nowIso } from './util.js';

/* ---------- İlk süper yönetici ---------- */
async function bootstrapAdmin() {
  if (users.count() > 0) return;
  if (!config.adminEmail || !config.adminPassword) {
    log.warn('Hiç kullanıcı yok. .env dosyasına ADMIN_EMAIL/ADMIN_PASSWORD yazın veya "npm run create-admin" çalıştırın.');
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
  log.info('süper yönetici oluşturuldu', { email: config.adminEmail });
}

await initAuth();
await bootstrapAdmin();
sessions.purgeExpired(nowIso());
setInterval(() => sessions.purgeExpired(nowIso()), 30 * 60 * 1000).unref();

const app = createApp();
const server = app.listen(config.port, () => {
  log.info(`Veteriner SMS çalışıyor: http://localhost:${config.port} (${config.isProd ? 'production' : 'development'})`);
});
startScheduler();

let shuttingDown = false;
async function shutdown(sig) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info('kapatılıyor', { signal: sig });
  // Önce zamanlayıcı: çalışan tur (sağlayıcı isteği dahil) bitsin ki gönderilen SMS kayda geçsin.
  const force = setTimeout(() => { log.warn('zorla kapatıldı'); process.exit(1); }, 25_000);
  force.unref();
  await stopScheduler();
  await new Promise((resolve) => server.close(resolve));
  closeAll();
  process.exit(0);
}
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => shutdown(sig));
