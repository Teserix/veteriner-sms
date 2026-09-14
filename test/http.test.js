/**
 * scripts/smoke.mjs akışının node:test'e taşınmış hali (aynı sıra, aynı iddialar) + ek uçlar.
 * Testler sıralıdır ve ortak istemci durumu üzerinden ilerler.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { setupEnv, startApp, createClient, createSuperadmin, csrfOf, resetLoginLimiter, acceptLegal } from './helpers.js';

const dataDir = setupEnv();
const { todayLocal } = await import('../src/util.js');
const { users } = await import('../src/db/master.js');

let app;
let c;
let csrf;
let token;
let clinicId;
let origLog;

before(async () => {
  origLog = console.log;
  console.log = () => {}; // konsol SMS çıktısını sustur
  app = await startApp();
  await createSuperadmin('admin@example.com', 'Admin12345');
  c = createClient(app.base);
});
after(async () => { console.log = origLog; await app.close(); });

test('ops: /api/health ve /api/version JSON', async () => {
  const h = await fetch(app.base + '/api/health');
  assert.equal(h.status, 200);
  assert.match(h.headers.get('content-type'), /application\/json/);
  assert.deepEqual(await h.json(), { ok: true });
  const v = await fetch(app.base + '/api/version');
  assert.equal(v.status, 200);
  const body = await v.json();
  assert.equal(body.name, 'veteriner-sms');
  assert.equal(typeof body.version, 'string');
  assert.ok(body.version.length > 0);
  assert.equal(typeof body.buildTime, 'string');
  assert.equal(h.headers.get('x-powered-by'), null);
  assert.ok(h.headers.get('content-security-policy').includes("default-src 'self'"));
});

test('1) login CSRF: ön belirteç olmadan 403', async () => {
  const r = await c.post('/giris', { email: 'admin@example.com', password: 'Admin12345' });
  assert.equal(r.status, 403);
});

test('2) süper yönetici girişi', async () => {
  let r = await c.get('/giris');
  token = csrfOf(r.text);
  assert.ok(token, 'login page has pre token');
  r = await c.post('/giris', { _csrf: token, email: 'admin@example.com', password: 'Admin12345', next: '/' });
  assert.equal(r.status, 302);
  assert.equal(r.location, '/admin');
  r = await c.get('/admin');
  assert.equal(r.status, 200);
  csrf = csrfOf(r.text);
  assert.ok(csrf);
});

test('3) bozuk CSRF 403 sayfası (500 değil)', async () => {
  const r = await c.post('/admin/klinik', { _csrf: 'bad', clinic_name: 'X' });
  assert.equal(r.status, 403);
  assert.ok(r.text.includes('Güvenlik hatası'));
});

test('4) klinik oluştur; süper yönetici klinik sayfalarını göremez; çıkış', async () => {
  let r = await c.post('/admin/klinik', { _csrf: csrf, clinic_name: 'Pati Veteriner', clinic_phone: '0212 555 11 22', admin_name: 'Dr. Ayşe', admin_email: 'ayse@pati.test', admin_password: 'Gecici123' });
  assert.equal(r.status, 302);
  assert.ok(r.location.startsWith('/admin?ok='));
  r = await c.get('/admin');
  clinicId = /tenants\/([a-f0-9]{12})\.db/.exec(r.text)?.[1];
  assert.ok(clinicId, 'clinic listed with id');
  assert.ok(fs.existsSync(path.join(dataDir, 'tenants', `${clinicId}.db`)));
  r = await c.get('/');
  assert.equal(r.status, 302); assert.equal(r.location, '/admin');
  r = await c.get('/sahipler');
  assert.equal(r.status, 302); assert.equal(r.location, '/admin');
  r = await c.post('/cikis', { _csrf: csrf });
  assert.equal(r.status, 302);
});

test('5) klinik yöneticisi girişi -> parola değişimi zorunlu', async () => {
  let r = await c.get('/giris'); token = csrfOf(r.text);
  r = await c.post('/giris', { _csrf: token, email: 'ayse@pati.test', password: 'Gecici123', next: '/' });
  assert.equal(r.status, 302); assert.ok(r.location.startsWith('/sifre'));
  r = await c.get('/');
  assert.equal(r.status, 302); assert.ok(r.location.startsWith('/sifre'));
  r = await c.get('/sifre'); csrf = csrfOf(r.text);
  assert.equal(r.status, 200);
  r = await c.post('/sifre', { _csrf: csrf, current: 'Gecici123', password: 'YeniSifre123', password2: 'YeniSifre123' });
  assert.equal(r.status, 302); assert.ok(r.location.startsWith('/?ok='));
  // Sözleşme kapısı: kabul edilmeden panel açılmaz
  r = await c.get('/');
  assert.equal(r.status, 302); assert.equal(r.location, '/sozlesme');
  await acceptLegal(c);
  r = await c.get('/'); csrf = csrfOf(r.text);
  assert.equal(r.status, 200);
  assert.ok(r.text.includes('Özet'));
  assert.ok(r.text.includes('Pati Veteriner'));
  // Hukuki kimlik dolana kadar gönderim kilitli uyarısı görünür; ayarlardan doldurulunca kalkar
  assert.ok(r.text.includes('SMS gönderimi kilitli'));
  r = await c.get('/ayarlar'); csrf = csrfOf(r.text);
  assert.ok(r.text.includes('MERSİS numarası (16 hane) girilmemiş') || r.text.includes('İşletme türü'));
  r = await c.post('/ayarlar', { _csrf: csrf, clinic_name: 'Pati Veteriner', clinic_phone: '0212 555 11 22', template: 'Sayın {sahip}, {hayvan} için {tarih} {tur}. {klinik}', scheduler_enabled: '1', send_hour_start: '9', send_hour_end: '20', daily_sms_limit: '200', sms_provider: 'console', sms_sender: '', legal_form: 'tacir', mersis_no: '0123456789012345', m61_declare: '1', retention_sms_days: '1095' });
  assert.equal(r.status, 302); assert.ok(r.location.includes('ok='), r.location);
  r = await c.get('/'); csrf = csrfOf(r.text);
  assert.ok(!r.text.includes('SMS gönderimi kilitli'));
});

test('6) hızlı kayıt: bugün vadeli, notify 0; mükerrer telefon mevcut sahibe eklenir', async () => {
  const today = todayLocal();
  let r = await c.post('/hizli-kayit', { _csrf: csrf, owner_name: 'Mehmet Kaya', phone: '0532 123 45 67', pet_name: 'Boncuk', species: 'Kedi', add_reminder: '1', type: 'asi', title: 'Kuduz aşısı', due_date: today, notify_days_before: '0', sms_opt_in: '1' });
  assert.equal(r.status, 302); assert.ok(r.location.startsWith('/sahipler/1'), r.location);
  r = await c.get('/sahipler/1');
  assert.equal(r.status, 200);
  assert.ok(r.text.includes('0532 123 45 67'));
  r = await c.get('/');
  assert.ok(r.text.includes('Bugün SMS') && r.text.includes('Mehmet Kaya'));
  r = await c.post('/hizli-kayit', { _csrf: csrf, owner_name: 'Mehmet Kaya', phone: '05321234567', pet_name: 'Zeytin', species: 'Köpek', add_reminder: '0' });
  assert.equal(r.status, 302); assert.ok(r.location.startsWith('/sahipler/1'));
  assert.ok(decodeURIComponent(r.location).includes('zaten kayıtlıydı'));
});

test('ek) sahip düzenleme formu biçimli telefon gösterir', async () => {
  const r = await c.get('/sahipler/1/duzenle');
  assert.equal(r.status, 200);
  assert.ok(r.text.includes('value="0532 123 45 67"'));
  assert.ok(r.text.includes('value="Mehmet Kaya"'));
  assert.ok(!r.text.includes('905321234567'));
});

test('ek) CSV dışa aktarma (yönetici): BOM, başlık ve sahip satırı', async () => {
  const r = await c.getBytes('/sahipler/disa-aktar.csv');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /^text\/csv/);
  assert.match(r.headers.get('content-disposition'), /attachment; filename="hasta-listesi\.csv"/);
  assert.deepEqual([...r.bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], 'UTF-8 BOM');
  assert.equal(r.text.charCodeAt(0), 0xfeff);
  const lines = r.text.slice(1).split('\r\n');
  assert.equal(lines[0], 'Sahip;Telefon;E-posta;Adres;SMS;Hayvan;Tür;Irk;Cinsiyet;Doğum;Mikroçip');
  assert.equal(lines.length, 3); // başlık + Boncuk + Zeytin
  assert.ok(lines[1].startsWith('Mehmet Kaya;0532 123 45 67;;;Evet;Boncuk;Kedi;'));
  assert.ok(lines[2].startsWith('Mehmet Kaya;0532 123 45 67;;;Evet;Zeytin;Köpek;'));
});

test('7) elle gönderim; SMS geçmişi; ikinci gönderim engellenir', async () => {
  let r = await c.post('/hatirlatmalar/1/gonder', { _csrf: csrf }, { referer: app.base + '/sahipler/1?ok=x' });
  assert.equal(r.status, 302);
  assert.ok(r.location.startsWith('/sahipler/1?ok='), r.location);
  assert.ok(!r.location.includes('ok=x'));
  r = await c.get('/sms');
  assert.equal(r.status, 200);
  assert.ok(r.text.includes('Gönderildi') && r.text.includes('Mehmet Kaya'));
  r = await c.post('/hatirlatmalar/1/gonder', { _csrf: csrf });
  assert.ok(r.location.includes('err='), r.location);
});

test('8) açık yönlendirme koruması', async () => {
  const r = await c.post('/hatirlatmalar/1/durum', { _csrf: csrf, status: 'done' }, { referer: 'https://evil.example/x' });
  assert.equal(r.status, 302);
  assert.ok(r.location.startsWith('/sahipler/1'), r.location);
});

test('9) ayarlar: kaydet, kimlik bilgisi, test SMS ve günlük tavan', async () => {
  let r = await c.get('/ayarlar'); csrf = csrfOf(r.text);
  assert.equal(r.status, 200);
  assert.ok(r.text.includes('İleti Merkezi'));
  r = await c.post('/ayarlar', { _csrf: csrf, clinic_name: 'Pati Veteriner', clinic_phone: '0212', template: 'Sayın {sahip}, {hayvan} için {tarih} {tur}. {klinik}', scheduler_enabled: '1', send_hour_start: '9', send_hour_end: '20', daily_sms_limit: '2', sms_provider: 'netgsm', sms_sender: 'PATI VET', cred_netgsm_usercode: 'u', cred_netgsm_password: 'p', legal_form: 'tacir', mersis_no: '0123456789012345' });
  assert.equal(r.status, 302); assert.ok(r.location.includes('ok='), r.location);
  // reklam ifadesi içeren şablon reddedilir (6343 m.9 / TVHB m.97)
  r = await c.post('/ayarlar', { _csrf: csrf, clinic_name: 'Pati Veteriner', clinic_phone: '0212', template: 'Sayın {sahip}, bu ay aşıda %20 indirim!', scheduler_enabled: '1', send_hour_start: '9', send_hour_end: '20', daily_sms_limit: '2', sms_provider: 'netgsm', sms_sender: 'PATI VET', legal_form: 'tacir', mersis_no: '0123456789012345' });
  assert.ok(decodeURIComponent(r.location).includes('indirim'), r.location);
  r = await c.post('/ayarlar', { _csrf: csrf, clinic_name: 'Pati Veteriner', clinic_phone: '0212', template: 'Sayın {sahip}, {hayvan} için {tarih} {tur}. {klinik}', scheduler_enabled: '1', send_hour_start: '9', send_hour_end: '20', daily_sms_limit: '2', sms_provider: 'netgsm', sms_sender: 'PATI VET', legal_form: 'tacir', mersis_no: '0123456789012345' });
  assert.equal(r.status, 302); assert.ok(r.location.includes('ok='), r.location);
  r = await c.get('/ayarlar');
  assert.ok(r.text.includes('kayıtlı'));
  assert.ok(!r.text.includes('cred_netgsm_password" value="p"'), 'kimlik bilgisi sayfada görünmez');
  // geçersiz başlık reddedilir
  r = await c.post('/ayarlar', { _csrf: csrf, clinic_name: 'Pati', clinic_phone: '', template: 'x', scheduler_enabled: '1', send_hour_start: '9', send_hour_end: '20', daily_sms_limit: '2', sms_provider: 'netgsm', sms_sender: 'COK UZUN BASLIK 123', legal_form: 'tacir', mersis_no: '0123456789012345' });
  assert.ok(r.location.includes('err='), r.location);
  r = await c.post('/ayarlar', { _csrf: csrf, clinic_name: 'Pati', clinic_phone: '0212', template: 'x', scheduler_enabled: '1', send_hour_start: '9', send_hour_end: '20', daily_sms_limit: '2', sms_provider: 'console', sms_sender: '', legal_form: 'tacir', mersis_no: '0123456789012345' });
  assert.equal(r.status, 302);
  r = await c.post('/ayarlar/test', { _csrf: csrf, phone: '05001112233' });
  assert.ok(r.location.includes('ok='), r.location);
  r = await c.post('/ayarlar/test', { _csrf: csrf, phone: '05001112233' });
  assert.ok(r.location.includes('err='), r.location);
  assert.ok(decodeURIComponent(r.location).includes('sınır'), decodeURIComponent(r.location));
});

test('10) kullanıcılar: personel oluştur, personel olarak 403 kontrolleri', async () => {
  let r = await c.get('/kullanicilar'); csrf = csrfOf(r.text);
  assert.equal(r.status, 200);
  r = await c.post('/kullanicilar', { _csrf: csrf, name: 'Personel', email: 'staff@pati.test', password: 'Staff1234', role: 'staff' });
  assert.equal(r.status, 302); assert.ok(r.location.includes('ok='), r.location);
  r = await c.post('/cikis', { _csrf: csrf });
  r = await c.get('/giris'); token = csrfOf(r.text);
  r = await c.post('/giris', { _csrf: token, email: 'staff@pati.test', password: 'Staff1234' });
  assert.equal(r.status, 302); assert.ok(r.location.startsWith('/sifre'));
  r = await c.get('/sifre'); csrf = csrfOf(r.text);
  r = await c.post('/sifre', { _csrf: csrf, current: 'Staff1234', password: 'Staff12345', password2: 'Staff12345' });
  assert.equal(r.status, 302);
  r = await c.get('/'); csrf = csrfOf(r.text);
  assert.equal(r.status, 200);
  assert.equal((await c.get('/kullanicilar')).status, 403);
  assert.equal((await c.get('/ayarlar')).status, 403);
  assert.equal((await c.get('/admin')).status, 403);
  assert.equal((await c.get('/iceaktar')).status, 403);
  assert.equal((await c.get('/sahipler/disa-aktar.csv')).status, 403, 'CSV dışa aktarma personele kapalı');
  r = await c.post('/sahipler/1/sil', { _csrf: csrf });
  assert.equal(r.status, 403);
  r = await c.get('/sahipler/1');
  assert.equal(r.status, 200);
  assert.ok(!r.text.includes('>Sil<'));
  r = await c.get('/yok-boyle-sayfa');
  assert.equal(r.status, 404);
  r = await c.get('/sahipler?q=%25');
  assert.equal(r.status, 200);
  assert.ok(!r.text.includes('Mehmet Kaya'));
  r = await c.get('/sahipler?q=Mehmet');
  assert.ok(r.text.includes('Mehmet Kaya'));
});

test('ek) süper yönetici: klinik detay, parola sıfırlama tek seferlik geçici parola', async () => {
  let r = await c.post('/cikis', { _csrf: csrf });
  r = await c.get('/giris'); token = csrfOf(r.text);
  r = await c.post('/giris', { _csrf: token, email: 'admin@example.com', password: 'Admin12345' });
  assert.equal(r.status, 302);
  r = await c.get(`/admin/klinik/${clinicId}`); csrf = csrfOf(r.text);
  assert.equal(r.status, 200);
  assert.ok(r.text.includes('Pati Veteriner'));
  assert.ok(r.text.includes('ayse@pati.test') && r.text.includes('staff@pati.test'));
  assert.ok(r.text.includes(`tenants/${clinicId}.db`));
  assert.ok(!r.text.includes('Mehmet Kaya'), 'süper yönetici hasta verisi görmez');
  assert.equal((await c.get('/admin/klinik/000000000000')).status, 302);

  const staff = users.byEmail('staff@pati.test');
  r = await c.post(`/admin/klinik/${clinicId}/sifre-sifirla`, { _csrf: csrf, user_id: String(staff.id) });
  assert.equal(r.status, 200);
  assert.ok(r.text.includes('geçici parola'));
  const temp = /<code class="mono big">([^<]+)<\/code>/.exec(r.text)?.[1];
  assert.ok(temp && temp.length === 12, 'geçici parola gösterilmeli');
  // yeniden yüklenen sayfada parola yok
  r = await c.get(`/admin/klinik/${clinicId}`);
  assert.ok(!r.text.includes(temp));
  assert.equal(users.byEmail('staff@pati.test').must_change_password, 1);
  // başka kliniğin kullanıcısı (süper yönetici) bu klinikten sıfırlanamaz
  const sa = users.byEmail('admin@example.com');
  r = await c.post(`/admin/klinik/${clinicId}/sifre-sifirla`, { _csrf: csrf, user_id: String(sa.id) });
  assert.equal(r.status, 400);

  // personel: eski parola geçersiz, geçici parola -> /sifre kapısı
  await c.post('/cikis', { _csrf: csrf });
  r = await c.get('/giris'); token = csrfOf(r.text);
  r = await c.post('/giris', { _csrf: token, email: 'staff@pati.test', password: 'Staff12345' });
  assert.equal(r.status, 401);
  r = await c.get('/giris'); token = csrfOf(r.text);
  r = await c.post('/giris', { _csrf: token, email: 'staff@pati.test', password: temp });
  assert.equal(r.status, 302); assert.ok(r.location.startsWith('/sifre'));
  r = await c.get('/');
  assert.equal(r.status, 302); assert.ok(r.location.startsWith('/sifre'));
  r = await c.get('/sifre'); csrf = csrfOf(r.text);
  await c.post('/cikis', { _csrf: csrf });
  await resetLoginLimiter();
});

test('ek) süper yönetici klinik silme: dosya data/trash altına taşınır, kullanıcı giremez', async () => {
  let r = await c.get('/giris'); token = csrfOf(r.text);
  r = await c.post('/giris', { _csrf: token, email: 'admin@example.com', password: 'Admin12345' });
  assert.equal(r.status, 302);
  r = await c.get(`/admin/klinik/${clinicId}`); csrf = csrfOf(r.text);
  // yanlış onay adı reddedilir
  r = await c.post(`/admin/klinik/${clinicId}/sil`, { _csrf: csrf, confirm_name: 'Yanlis' });
  assert.equal(r.status, 400);
  assert.ok(fs.existsSync(path.join(dataDir, 'tenants', `${clinicId}.db`)));
  r = await c.post(`/admin/klinik/${clinicId}/sil`, { _csrf: csrf, confirm_name: 'Pati Veteriner' });
  assert.equal(r.status, 302); assert.ok(r.location.startsWith('/admin?ok='));
  assert.ok(!fs.existsSync(path.join(dataDir, 'tenants', `${clinicId}.db`)));
  const trash = fs.readdirSync(path.join(dataDir, 'trash')).filter((f) => f.startsWith(`${clinicId}-`) && f.endsWith('.db'));
  assert.equal(trash.length, 1, 'trash içinde klinik dosyası');
  assert.equal(users.byEmail('ayse@pati.test'), undefined, 'kullanıcılar cascade ile silinir');
  r = await c.get('/admin');
  assert.ok(!r.text.includes(`tenants/${clinicId}.db`));
  assert.equal((await c.get(`/admin/klinik/${clinicId}`)).status, 302);
  await c.post('/cikis', { _csrf: csrf });
  r = await c.get('/giris'); token = csrfOf(r.text);
  r = await c.post('/giris', { _csrf: token, email: 'ayse@pati.test', password: 'YeniSifre123' });
  assert.equal(r.status, 401);
});
