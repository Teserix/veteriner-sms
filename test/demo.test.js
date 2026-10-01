/**
 * Demo verisi: süper yönetici düğmesi (POST /admin/klinik/:id/demo), src/demo.js ve SMS çıkışındaki demo numara koruması.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  setupEnv, startApp, createClient, createSuperadmin, csrfFor, login, logout,
  createClinicViaHttp, loginAndChangePassword, makeLegalReady,
} from './helpers.js';

setupEnv();
const { tenantPath, openTenant, owners, getSettings, legalProblems } = await import('../src/db/tenant.js');
const { auditLog } = await import('../src/db/master.js');
const { isDemoPhone } = await import('../src/util.js');

const SA = { email: 'admin@example.com', pass: 'Admin12345' };
const CLINIC = { name: 'Demo Veteriner', adminEmail: 'demo@pati.test', temp: 'Gecici123', pass: 'YeniParola123' };
let app;
let client;
let clinicId;
let origLog;

const count = (id, sql) => {
  const db = new DatabaseSync(tenantPath(id), { readOnly: true });
  try { return db.prepare(sql).get().c; } finally { db.close(); }
};
const settingsOf = (id) => getSettings(openTenant(id));
// Yönlendirme sorgusundaki flash metni (application/x-www-form-urlencoded: boşluk '+' olur)
const flashOf = (location) => decodeURIComponent(String(location).replace(/\+/g, ' '));

before(async () => {
  origLog = console.log;
  console.log = () => {}; // konsol SMS çıktısını sustur
  app = await startApp();
  await createSuperadmin(SA.email, SA.pass);
  client = createClient(app.base);
  await login(client, SA.email, SA.pass);
  ({ id: clinicId } = await createClinicViaHttp(client, { name: CLINIC.name, adminEmail: CLINIC.adminEmail, adminPassword: CLINIC.temp, legalReady: false }));
});
after(async () => { console.log = origLog; await app.close(); });

test('demo telefon aralığı yalnızca 0515/0516', () => {
  assert.equal(isDemoPhone('905151000100'), true);
  assert.equal(isDemoPhone('905161000101'), true);
  assert.equal(isDemoPhone('905321112233'), false);
  assert.equal(isDemoPhone('905171000100'), false);
  assert.equal(isDemoPhone('9051510001000'), false);
});

test('onay adı yanlışsa 400 ve hiçbir kayıt eklenmez', async () => {
  const csrf = await csrfFor(client, '/admin');
  const r = await client.post(`/admin/klinik/${clinicId}/demo`, { _csrf: csrf, confirm_name: 'Başka Klinik' });
  assert.equal(r.status, 400);
  assert.ok(r.text.includes('klinik adını aynen yazın'));
  assert.equal(count(clinicId, 'SELECT COUNT(*) AS c FROM owners'), 0);
});

test('boş kliniğe demo verisi yüklenir; hukuki kimlik ve zamanlayıcı ayarına dokunulmaz; denetim kaydı düşer', async () => {
  const before = settingsOf(clinicId);
  const csrf = await csrfFor(client, '/admin');
  const r = await client.post(`/admin/klinik/${clinicId}/demo`, { _csrf: csrf, confirm_name: CLINIC.name });
  assert.equal(r.status, 302);
  assert.ok(r.location.startsWith(`/admin/klinik/${clinicId}?ok=`));
  const okText = decodeURIComponent(r.location.split('?ok=')[1]);
  for (const s of ['20 sahip', '24 hayvan', '33 hatırlatma', '12 SMS', 'Hukuki kimlik']) assert.ok(okText.includes(s), okText);

  assert.equal(count(clinicId, 'SELECT COUNT(*) AS c FROM owners'), 20);
  assert.equal(count(clinicId, `SELECT COUNT(*) AS c FROM owners WHERE import_batch = 'demo'`), 20);
  assert.equal(count(clinicId, 'SELECT COUNT(*) AS c FROM pets'), 24);
  assert.equal(count(clinicId, 'SELECT COUNT(*) AS c FROM reminders'), 33);
  assert.equal(count(clinicId, `SELECT COUNT(*) AS c FROM sms_log WHERE provider = 'demo'`), 12);
  // Tüm demo telefonları atanmamış aralıkta
  assert.equal(count(clinicId, `SELECT COUNT(*) AS c FROM owners WHERE phone NOT LIKE '90515%' AND phone NOT LIKE '90516%'`), 0);

  // Hukuki kimlik YAZILMADI: gönderim kilidi klinik kendi kimliğini girene dek kapalı
  const after = settingsOf(clinicId);
  assert.equal(after.legal_form, '');
  assert.equal(after.tax_id, '');
  assert.equal(after.m61_declared_at, '');
  assert.ok(legalProblems(after).length > 0);
  // Zamanlayıcı ayarı ve telefon olduğu gibi kaldı
  assert.equal(after.scheduler_enabled, before.scheduler_enabled);
  assert.equal(after.clinic_phone, before.clinic_phone);

  const entry = auditLog.recent(50).find((a) => a.action === 'clinic.demo_seed');
  assert.ok(entry, 'denetim kaydı yok');
  assert.equal(entry.clinic_id, clinicId);
  assert.equal(JSON.parse(entry.meta).owners, 20);
  assert.equal(JSON.parse(entry.meta).legalIdentity, false);

  const page = await client.get(r.location);
  assert.equal(page.status, 200);
  assert.ok(page.text.includes('Demo verisi yüklendi'));
});

test('ikinci kez yükleme hiçbir şey değiştirmez', async () => {
  const csrf = await csrfFor(client, '/admin');
  const r = await client.post(`/admin/klinik/${clinicId}/demo`, { _csrf: csrf, confirm_name: CLINIC.name });
  assert.equal(r.status, 302);
  assert.ok(decodeURIComponent(r.location).includes('hiçbir şey değişmedi'));
  assert.equal(count(clinicId, 'SELECT COUNT(*) AS c FROM owners'), 20);
  assert.equal(count(clinicId, 'SELECT COUNT(*) AS c FROM reminders'), 33);
  assert.equal(count(clinicId, 'SELECT COUNT(*) AS c FROM sms_log'), 12);
});

test('silinmiş demo sahibi tekrar yüklemede geri gelir; diğer sahiplere çift hatırlatma yazılmaz', async () => {
  const db = openTenant(clinicId);
  const victim = owners.byPhone(db, '905151000100'); // Ayşe Yılmaz: 2 hayvan, 2 hatırlatma
  assert.ok(victim);
  owners.delete(db, victim.id); // hayvanlar ve hatırlatmalar cascade ile silinir
  assert.equal(count(clinicId, 'SELECT COUNT(*) AS c FROM owners'), 19);
  assert.equal(count(clinicId, 'SELECT COUNT(*) AS c FROM reminders'), 31);

  const csrf = await csrfFor(client, '/admin');
  const r = await client.post(`/admin/klinik/${clinicId}/demo`, { _csrf: csrf, confirm_name: CLINIC.name });
  assert.equal(r.status, 302);
  assert.ok(decodeURIComponent(r.location).includes('1 sahip, 2 hayvan, 2 hatırlatma'), r.location);
  assert.equal(count(clinicId, 'SELECT COUNT(*) AS c FROM owners'), 20);
  assert.equal(count(clinicId, 'SELECT COUNT(*) AS c FROM pets'), 24);
  assert.equal(count(clinicId, 'SELECT COUNT(*) AS c FROM reminders'), 33);
  assert.equal(count(clinicId, 'SELECT COUNT(*) AS c FROM (SELECT pet_id, title, due_date FROM reminders GROUP BY pet_id, title, due_date HAVING COUNT(*) > 1)'), 0);
  assert.equal(count(clinicId, `SELECT COUNT(*) AS c FROM sms_log WHERE provider_ref = 'demo-test'`), 1);
});

test('gerçek sahip kaydı olan kliniğe yüklenmez', async () => {
  const { id } = await createClinicViaHttp(client, { name: 'Gerçek Klinik', adminEmail: 'gercek@pati.test', adminPassword: 'Gecici123' });
  owners.create(openTenant(id), { name: 'Gerçek Sahip', phone: '905321112233', email: null, notes: null, sms_opt_in: 1, created_at: new Date().toISOString(), import_batch: null });
  const csrf = await csrfFor(client, '/admin');
  const r = await client.post(`/admin/klinik/${id}/demo`, { _csrf: csrf, confirm_name: 'Gerçek Klinik' });
  assert.equal(r.status, 400);
  assert.ok(r.text.includes('1 gerçek sahip kaydı var'));
  assert.equal(count(id, 'SELECT COUNT(*) AS c FROM owners'), 1);
  assert.equal(count(id, 'SELECT COUNT(*) AS c FROM reminders'), 0);
});

test('SMS çıkış noktası demo numarayı hiçbir sağlayıcıya göndermez', async () => {
  const { sendSms } = await import('../src/sms/index.js');
  // Gerçek sağlayıcı seçili olsa bile demo numara sağlayıcıya ulaşmaz
  const r = await sendSms({ sms_provider: 'iletimerkezi', sms_sender: 'APITEST', sms_credentials: '' }, '905151000100', 'deneme');
  assert.equal(r.ok, true);
  assert.equal(r.providerName, 'demo');
  assert.match(r.ref, /^demo-/);
  const real = await sendSms({ sms_provider: 'console', sms_sender: '', sms_credentials: '' }, '905321112233', 'deneme');
  assert.equal(real.providerName, 'console');
});

test('klinik yöneticisi: demo ucuna 403; demo hatırlatmayı "şimdi gönder" sağlayıcısız demo olarak loglanır', async () => {
  await logout(client);
  await loginAndChangePassword(client, CLINIC.adminEmail, CLINIC.temp, CLINIC.pass);
  const csrf = await csrfFor(client, '/sifre');
  const forbidden = await client.post(`/admin/klinik/${clinicId}/demo`, { _csrf: csrf, confirm_name: CLINIC.name });
  assert.equal(forbidden.status, 403);

  // Hukuki kimlik yokken gönderim kilitli
  const db = openTenant(clinicId);
  const rem = db.prepare(`SELECT r.id FROM reminders r JOIN pets p ON p.id = r.pet_id JOIN owners o ON o.id = p.owner_id
    WHERE r.status = 'pending' AND o.sms_opt_in = 1 ORDER BY r.id LIMIT 1`).get();
  assert.ok(rem);
  const locked = await client.post(`/hatirlatmalar/${rem.id}/gonder`, { _csrf: csrf });
  assert.equal(locked.status, 302);
  assert.ok(flashOf(locked.location).includes('Hukuki kimlik'), locked.location);

  // Klinik kendi kimliğini girdi: gönderim demo sağlayıcısıyla "başarılı", sağlayıcıya istek yok
  await makeLegalReady(clinicId);
  const sent = await client.post(`/hatirlatmalar/${rem.id}/gonder`, { _csrf: csrf });
  assert.equal(sent.status, 302);
  assert.ok(flashOf(sent.location).includes('SMS gönderildi'), sent.location);
  const row = db.prepare('SELECT provider, status, kind FROM sms_log WHERE reminder_id = ? ORDER BY id DESC LIMIT 1').get(rem.id);
  assert.deepEqual({ ...row }, { provider: 'demo', status: 'sent', kind: 'reminder' });
  assert.equal(db.prepare('SELECT status FROM reminders WHERE id = ?').get(rem.id).status, 'sent');
});
