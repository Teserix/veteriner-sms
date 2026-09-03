// Kullanım: node scripts/create-admin.js <e-posta> <parola> [ad]
// Süper yönetici oluşturur (klinik bağımsız). Parola zaten kayıtlı bir e-posta ise parolayı sıfırlar.
import '../src/config.js';
import { users } from '../src/db/master.js';
import { hashPassword, passwordProblem } from '../src/auth.js';
import { nowIso } from '../src/util.js';

const [email, password, name = 'Süper Yönetici'] = process.argv.slice(2);
if (!email || !password) {
  console.error('Kullanım: node scripts/create-admin.js <e-posta> <parola> [ad]');
  process.exit(1);
}
const problem = passwordProblem(password);
if (problem) { console.error(problem); process.exit(1); }

const hash = await hashPassword(password);
const existing = users.byEmail(email.toLowerCase());
if (existing) {
  users.setPassword(existing.id, hash);
  console.log(`Parola güncellendi: ${email}`);
} else {
  users.create({ clinicId: null, email: email.toLowerCase(), name, passwordHash: hash, role: 'superadmin', createdAt: nowIso() });
  console.log(`Süper yönetici oluşturuldu: ${email}`);
}
