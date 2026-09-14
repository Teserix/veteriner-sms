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

// APP_ORIGIN: virgülle birden çok adres verilebilir (örn. Cloudflare Tunnel + Tailscale Funnel).
// İlki "asıl" adrestir; hepsi Origin/Referer kontrolünde kabul edilir.
const appOrigins = [];
for (const raw of String(env.APP_ORIGIN || '').split(',').map((x) => x.trim()).filter(Boolean)) {
  try { appOrigins.push(new URL(raw).origin); } catch { fail(`APP_ORIGIN geçerli bir URL olmalı (verilen: "${raw}", örn. https://vet.example.com).`); }
}
if (!appOrigins.length && isProd) fail('APP_ORIGIN üretimde zorunludur (örn. https://vet.example.com).');
const appOrigin = appOrigins[0] || '';

export const config = {
  port: num('PORT', 3000, { min: 1, max: 65535 }),
  isProd,
  trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
  appSecret,
  appOrigin,
  appOrigins,
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
  // Yedek: ikinci hedef (ayrı disk / ağ dışı bağlama noktası) ve ayrı şifreleme anahtarı
  backupSecondaryDir: env.BACKUP_SECONDARY_DIR ? path.resolve(env.BACKUP_SECONDARY_DIR) : '',
  backupKey: env.BACKUP_KEY || '',
  // Hizmet sağlayıcı (Teserix) kimlik bilgileri: /iletisim sayfası ve hukuki metinler (5651 m.3; 6563 m.3)
  company: {
    name: env.COMPANY_NAME || '',
    legalForm: env.COMPANY_LEGAL_FORM || '',       // 'tacir' | 'esnaf'
    taxId: env.COMPANY_TAX_ID || '',
    mersis: env.COMPANY_MERSIS || '',
    tradeRegistryNo: env.COMPANY_TRADE_REGISTRY_NO || '',
    address: env.COMPANY_ADDRESS || '',
    email: env.COMPANY_EMAIL || '',
    phone: env.COMPANY_PHONE || '',
    kep: env.COMPANY_KEP || '',
    hostingProvider: env.COMPANY_HOSTING_PROVIDER || '', // yer sağlayıcı (5651 m.3/1)
  },
};
if (config.backupKey && config.backupKey.length < 32) fail('BACKUP_KEY en az 32 karakter olmalı.');
if (isProd && !config.company.name) console.warn('[UYARI] COMPANY_* değişkenleri boş; /iletisim sayfası ve hukuki metinler eksik görünecek.');

for (const d of ['tenants', 'backups', 'trash']) {
  fs.mkdirSync(path.join(config.dataDir, d), { recursive: true });
}
