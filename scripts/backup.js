// Elle yedek: node scripts/backup.js  (docker compose exec veteriner-sms node scripts/backup.js)
import '../src/config.js';
import { runBackup } from '../src/backup.js';

const r = runBackup();
console.log(`Yedek tamamlandı: ${r.dir} (${r.tenants} klinik)`);
