// Dosya izinleri: data/ altındaki veritabanları yalnızca uygulama kullanıcısı tarafından okunabilsin
process.umask(0o077);

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// .env dosyası varsa yükle (Node 20.12+ yerleşik). Ortam değişkenleri .env'i ezer.
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath) && process.env.SKIP_DOTENV !== '1') {
  const before = { ...process.env };
  process.loadEnvFile(envPath);
  for (const k of Object.keys(before)) process.env[k] = before[k];
}

const env = process.env;
const isProd = env.NODE_ENV === 'production';
const PLACEHOLDER_SECRET = 'degistirin-bu-degeri-en-az-32-karakter-olacak-sekilde';

function fail(msg) {
  if (isProd) throw new Error(msg);
  console.warn('[UYARI] ' + msg);
}

/** Sayısal ortam değişkeni: boşsa varsayılan, sayı değilse hata (üretimde açılmaz) */
function num(name, def, { min = null, max = null } = {}) {
  const raw = env[name];
  if (raw == null || String(raw).trim() === '') return def;
  const n = Number(raw);
  if (!Number.isFinite(n)) { fail(`${name} sayısal olmalı (verilen: "${raw}"); varsayılan ${def} kullanılıyor.`); return def; }
  let v = n;
  if (min != null) v = Math.max(min, v);
  if (max != null) v = Math.min(max, v);
  return v;
}

let appSecret = env.APP_SECRET || '';
if (appSecret.length < 32 || appSecret === PLACEHOLDER_SECRET) {
  fail('APP_SECRET en az 32 karakterlik rastgele bir değer olmalı (.env.example içindeki yer tutucu kullanılamaz).');
  // Geliştirme: her açılışta rastgele anahtar; bilinen sabit bir anahtarla hiçbir şey şifrelenmez
  appSecret = crypto.randomBytes(32).toString('hex');
  console.warn('[UYARI] Geçici rastgele APP_SECRET üretildi; kaydedilen SMS hesap bilgileri yeniden başlatınca çözülemez.');
}

let appOrigin = (env.APP_ORIGIN || '').replace(/\/+$/, '');
if (appOrigin) {
  try { appOrigin = new URL(appOrigin).origin; } catch { fail('APP_ORIGIN geçerli bir URL olmalı (örn. https://vet.example.com).'); appOrigin = ''; }
} else if (isProd) {
  fail('APP_ORIGIN üretimde zorunludur (örn. https://vet.example.com).');
}

export const config = {
  port: num('PORT', 3000, { min: 1, max: 65535 }),
  isProd,
  trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
  appSecret,
  appOrigin,
  dataDir: path.resolve(process.cwd(), env.DATA_DIR || './data'),
  adminEmail: env.ADMIN_EMAIL || '',
  adminPassword: env.ADMIN_PASSWORD || '',
  enableScheduler: env.ENABLE_SCHEDULER === '1' || env.ENABLE_SCHEDULER === 'true',
  schedulerIntervalSeconds: num('SCHEDULER_INTERVAL_SECONDS', 60, { min: 15 }),
  backupHour: num('BACKUP_HOUR', 3, { min: 0, max: 23 }),
  backupRetentionDays: num('BACKUP_RETENTION_DAYS', 14, { min: 1 }),
  sessionTtlHours: 12,
  timeZone: 'Europe/Istanbul',
  version: env.APP_VERSION || '1.0.0',
};

for (const d of ['tenants', 'backups', 'trash']) {
  fs.mkdirSync(path.join(config.dataDir, d), { recursive: true });
}
