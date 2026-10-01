// Demo verisi: node scripts/seed-demo.js <klinik-id> [--personel] [--sahte-kimlik]
// Mevcut kayıtlara EK olarak yükler (aynı telefonlu sahipleri atlar, çift kayıt üretmez). Telefonlar atanmamış
// 0515/0516 aralığındandır; SMS çıkış noktası bu numaraları sağlayıcıya hiç göndermez (gerçek kişiye SMS gitmez,
// kredi harcanmaz). Kliniğin zamanlayıcı ayarına dokunmaz.
//   --personel      personel@demo.local / Demo12345 personel hesabı açar
//   --sahte-kimlik  YALNIZCA yerel geliştirme: sahte VKN'li hukuki kimlik ve m.6/1 beyanı yazar (gönderim kilidi açılır).
//                   Üretimde kullanmayın; gerçek klinik kimliğini Ayarlar > Hukuki kimlik'ten kendisi girer.
// Aynı iş süper yönetici panelinden de yapılabilir: Klinik › "Demo verisi yükle" (gerçek sahip kaydı olmayan klinikte).
import '../src/config.js';
import { openTenant, reminders, closeAll } from '../src/db/tenant.js';
import { clinics, users } from '../src/db/master.js';
import { hashPassword } from '../src/auth.js';
import { audit } from '../src/audit.js';
import { nowIso } from '../src/util.js';
import { seedDemo } from '../src/demo.js';

const clinicId = process.argv[2];
const withStaff = process.argv.includes('--personel');
const fakeIdentity = process.argv.includes('--sahte-kimlik');
if (!clinicId || !clinics.get(clinicId)) { console.error('Kullanım: node scripts/seed-demo.js <klinik-id> [--personel] [--sahte-kimlik]'); process.exit(1); }

const db = openTenant(clinicId);
const result = seedDemo(db, { legalIdentity: fakeIdentity });
audit(null, 'clinic.demo_seed', { clinicId, entityType: 'clinic', entityId: clinicId, meta: { ...result, source: 'seed-demo.js' } });
if (result.legalIdentity) {
  // m.6/1 beyanı kliniğin kendi beyanıdır; buradan yazıldığı denetim günlüğünde görünür olsun
  audit(null, 'legal.m61_declare', { clinicId, meta: { source: 'seed-demo.js --sahte-kimlik', demo: true } });
  console.warn('UYARI: sahte hukuki kimlik (VKN 1234567890) yazıldı; bu klinik gerçek kullanıma geçmemeli.');
}

if (withStaff && !users.byEmail('personel@demo.local')) {
  users.create({ clinicId, email: 'personel@demo.local', name: 'Demo Personel', passwordHash: await hashPassword('Demo12345'), role: 'staff', createdAt: nowIso(), mustChangePassword: 0 });
  result.staff = 'personel@demo.local / Demo12345';
}
console.log('Demo verisi yüklendi:', JSON.stringify(result));
console.log('Durum:', JSON.stringify(reminders.countByStatus(db)));
closeAll();
