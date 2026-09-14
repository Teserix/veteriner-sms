#!/usr/bin/env node
// Şifreli yedek dosyasını çözer ve bütünlüğünü doğrular.
//   BACKUP_KEY=... node scripts/restore.js <kaynak.db.enc> <hedef.db>
// Geri yükleme tatbikatı: servisi durdur -> çözülen dosyayı data/tenants/<id>.db yerine koy -> başlat.
import { DatabaseSync } from 'node:sqlite';
import { decryptFile } from '../src/backup.js';

const [src, dst] = process.argv.slice(2);
if (!src || !dst) {
  console.error('Kullanım: BACKUP_KEY=... node scripts/restore.js <kaynak.db.enc> <hedef.db>');
  process.exit(2);
}
decryptFile(src, dst);
const db = new DatabaseSync(dst, { readOnly: true });
const r = db.prepare('PRAGMA integrity_check').get();
db.close();
const ok = r && Object.values(r)[0] === 'ok';
console.log(`${dst}: integrity_check = ${ok ? 'ok' : JSON.stringify(r)}`);
process.exit(ok ? 0 : 1);
