import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';
import { master } from './db/master.js';
import { log } from './log.js';
import { nowLocal } from './util.js';

/**
 * Yedekleme: master.db ve her klinik dosyası için WAL checkpoint + VACUUM INTO.
 * Çıktı: data/backups/YYYY-MM-DD/master.db ve data/backups/YYYY-MM-DD/tenants/<id>.db
 * Eski klasörler BACKUP_RETENTION_DAYS sonra silinir.
 */

function vacuumInto(db, target) {
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  fs.rmSync(target, { force: true });
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
}

export function runBackup(now = new Date()) {
  const { date } = nowLocal(now);
  const dir = path.join(config.dataDir, 'backups', date);
  fs.mkdirSync(path.join(dir, 'tenants'), { recursive: true });

  vacuumInto(master, path.join(dir, 'master.db'));

  const tenantsDir = path.join(config.dataDir, 'tenants');
  let count = 0;
  for (const f of fs.readdirSync(tenantsDir)) {
    if (!/^[a-f0-9]{12}\.db$/.test(f)) continue;
    const db = new DatabaseSync(path.join(tenantsDir, f), { timeout: 5000 });
    try {
      vacuumInto(db, path.join(dir, 'tenants', f));
      count++;
    } finally {
      db.close();
    }
  }
  fs.writeFileSync(path.join(dir, '.done'), now.toISOString());
  pruneOldBackups(now);
  log.info('yedek alındı', { dir, tenants: count });
  return { dir, tenants: count };
}

export function pruneOldBackups(now = new Date()) {
  const root = path.join(config.dataDir, 'backups');
  const cutoff = now.getTime() - config.backupRetentionDays * 86400 * 1000;
  for (const d of fs.readdirSync(root)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    const t = new Date(d + 'T12:00:00Z').getTime();
    if (t < cutoff) fs.rmSync(path.join(root, d), { recursive: true, force: true });
  }
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
