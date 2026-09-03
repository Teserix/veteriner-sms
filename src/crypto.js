import crypto from 'node:crypto';
import { config } from './config.js';

// APP_SECRET'tan 32 baytlık AES anahtarı türet
const key = crypto.createHash('sha256').update(config.appSecret).digest();

/** Metni AES-256-GCM ile şifreler. Çıktı: base64(iv + tag + ciphertext) */
export function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

/** encrypt() çıktısını çözer. Hatalı/eski anahtar ise null döner. */
export function decrypt(b64) {
  if (!b64) return null;
  try {
    const buf = Buffer.from(b64, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

export function randomId(bytes = 6) {
  return crypto.randomBytes(bytes).toString('hex');
}

/** Zamanlama saldırılarına dayanıklı karşılaştırma */
export function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
