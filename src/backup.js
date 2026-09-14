import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';
import { master } from './db/master.js';
import { log } from './log.js';
import { nowLocal } from './util.js';

/**
 * Yedekleme: master.db ve her klinik dosyası için WAL checkpoint + VACUUM INTO.
 * Çıktı: data/backups/YYYY-MM-DD/master.db ve data/backups/YYYY-MM-DD/tenants/<id>.db
 * Eski klasörler BACKUP_RETENTION_DAYS sonra silinir.
 *
 * Makine dışı kopya (Kişisel Veri Güvenliği Rehberi §3.6: "veri seti yedekleri mutlaka ağ dışında tutulmalıdır"):
 * BACKUP_SECONDARY_DIR doluysa her dosya BACKUP_KEY ile AES-256-GCM şifrelenerek oraya da yazılır (.db.enc).
 * Anahtar APP_SECRET'ten ayrıdır; yedek ortamı ele geçse bile uygulama sırrı açığa çıkmaz. scripts/restore.js çözer.
 */

const ENC_MAGIC = Buffer.from('VSBK1'); // dosya başlığı: sürüm 1

function backupKey() {
  if (!config.backupKey) return null;
  return crypto.createHash('sha256').update(config.backupKey).digest();
}

/** Dosyayı AES-256-GCM ile şifreler: MAGIC(5) + iv(12) + tag(16) + ciphertext */
export function encryptFile(src, dst, key = backupKey()) {
  if (!key) throw new Error('BACKUP_KEY tanımlı değil');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(fs.readFileSync(src)), cipher.final()]);
  fs.writeFileSync(dst, Buffer.concat([ENC_MAGIC, iv, cipher.getAuthTag(), enc]), { mode: 0o600 });
}

export function decryptFile(src, dst, key = backupKey()) {
  if (!key) throw new Error('BACKUP_KEY tanımlı değil');
  const buf = fs.readFileSync(src);
  if (!buf.subarray(0, ENC_MAGIC.length).equals(ENC_MAGIC)) throw new Error('Şifreli yedek başlığı tanınmadı');
  const iv = buf.subarray(5, 17);
  const tag = buf.subarray(17, 33);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  fs.writeFileSync(dst, Buffer.concat([decipher.update(buf.subarray(33)), decipher.final()]), { mode: 0o600 });
}

function vacuumInto(db, target) {
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  fs.rmSync(target, { force: true });
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
}

/** İkinci hedefe şifreli kopya; hedef yoksa/anahtar yoksa sessizce atlanır ve uyarı loglanır */
function copySecondary(dir, date, files) {
  if (!config.backupSecondaryDir) return { copied: 0, skipped: 'hedef-yok' };
  if (!config.backupKey) { log.warn('BACKUP_SECONDARY_DIR var ama BACKUP_KEY yok; makine dışı kopya alınmadı'); return { copied: 0, skipped: 'anahtar-yok' }; }
  const out = path.join(config.backupSecondaryDir, date);
  fs.mkdirSync(path.join(out, 'tenants'), { recursive: true });
  let copied = 0;
  for (const rel of files) {
    encryptFile(path.join(dir, rel), path.join(out, rel + '.enc'));
    copied++;
  }
  fs.writeFileSync(path.join(out, '.done'), new Date().toISOString());
  return { copied };
}

export function runBackup(now = new Date()) {
  const { date } = nowLocal(now);
  const dir = path.join(config.dataDir, 'backups', date);
  fs.mkdirSync(path.join(dir, 'tenants'), { recursive: true });

  vacuumInto(master, path.join(dir, 'master.db'));
  const files = ['master.db'];

  const tenantsDir = path.join(config.dataDir, 'tenants');
  let count = 0;
  for (const f of fs.readdirSync(tenantsDir)) {
    if (!/^[a-f0-9]{12}\.db$/.test(f)) continue;
    const db = new DatabaseSync(path.join(tenantsDir, f), { timeout: 5000 });
    try {
      vacuumInto(db, path.join(dir, 'tenants', f));
      files.push(path.join('tenants', f));
      count++;
    } finally {
      db.close();
    }
  }
  fs.writeFileSync(path.join(dir, '.done'), now.toISOString());
  let secondary = null;
  try {
    secondary = copySecondary(dir, date, files);
  } catch (e) {
    log.error('makine dışı yedek kopyası alınamadı', { error: e.message });
  }
  pruneOldBackups(now);
  log.info('yedek alındı', { dir, tenants: count, secondary: secondary?.copied ?? 0 });
  return { dir, tenants: count, secondary };
}

function pruneDir(root, cutoff) {
  if (!root || !fs.existsSync(root)) return;
  for (const d of fs.readdirSync(root)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    const t = new Date(d + 'T12:00:00Z').getTime();
    if (t < cutoff) fs.rmSync(path.join(root, d), { recursive: true, force: true });
  }
}

export function pruneOldBackups(now = new Date()) {
  const cutoff = now.getTime() - config.backupRetentionDays * 86400 * 1000;
  pruneDir(path.join(config.dataDir, 'backups'), cutoff);
  pruneDir(config.backupSecondaryDir, cutoff);
}

/** Günde bir kez, BACKUP_HOUR saatinde (İstanbul) yedek alır. Zamanlayıcı tick'inden çağrılır. */
export async function maybeBackup(now = new Date()) {
  const { date, hour } = nowLocal(now);
  if (hour < config.backupHour) return false;
  const marker = path.join(config.dataDir, 'backups', date, '.done');
  if (fs.existsSync(marker)) return false;
  try {
    runBackup(now);
    return true;
  } catch (e) {
    log.error('yedek alınamadı', { error: e.message });
    return false;
  }
}
