import fs from 'node:fs';
import path from 'node:path';

// .env dosyası varsa yükle (Node 20.12+ yerleşik)
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const env = process.env;

const isProd = env.NODE_ENV === 'production';
const appSecret = env.APP_SECRET || '';

if (appSecret.length < 32) {
  const msg = 'APP_SECRET en az 32 karakter olmalı. .env dosyasını düzenleyin (bkz. .env.example).';
  if (isProd) throw new Error(msg);
  console.warn('[UYARI] ' + msg + ' Geliştirme modunda geçici bir anahtar kullanılıyor; SMS bilgileri yeniden başlatınca çözülemez.');
}

export const config = {
  port: Number(env.PORT || 3000),
  isProd,
  trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
  appSecret: appSecret.length >= 32 ? appSecret : 'dev-only-insecure-secret-do-not-use-in-production',
  dataDir: path.resolve(process.cwd(), env.DATA_DIR || './data'),
  adminEmail: env.ADMIN_EMAIL || '',
  adminPassword: env.ADMIN_PASSWORD || '',
  schedulerIntervalSeconds: Math.max(15, Number(env.SCHEDULER_INTERVAL_SECONDS || 60)),
  sessionTtlHours: 12,
  timeZone: 'Europe/Istanbul',
};

fs.mkdirSync(path.join(config.dataDir, 'tenants'), { recursive: true });
