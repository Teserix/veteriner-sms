/**
 * Süper yönetici klinik kullanıcılarını yönetir: ekleme, ad/e-posta/rol/durum düzenleme, parola belirleme, silme.
 * Kural: kliniğin giriş yapabilen en az bir yöneticisi kalmalı.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupEnv, startApp, createClient, createSuperadmin, csrfFor, login, logout,
  createClinicViaHttp, loginAndChangePassword, resetLoginLimiter,
} from './helpers.js';

setupEnv();
const { users, auditLog } = await import('../src/db/master.js');

const SA = { email: 'admin@example.com', pass: 'Admin12345' };
const CLINIC = { name: 'Pati Veteriner', adminEmail: 'ayse@pati.test', temp: 'Gecici123' };
let app;
let client;
let clinicId;
let clinicAdmin;
let staff;

const flashOf = (location) => decodeURIComponent(String(location).replace(/\+/g, ' '));
const base = () => `/admin/klinik/${clinicId}`;

before(async () => {
  app = await startApp();
  await createSuperadmin(SA.email, SA.pass);
  client = createClient(app.base);
  await login(client, SA.email, SA.pass);
  ({ id: clinicId } = await createClinicViaHttp(client, { name: CLINIC.name, adminEmail: CLINIC.adminEmail, adminPassword: CLINIC.temp }));
  clinicAdmin = users.byEmail(CLINIC.adminEmail);
});
after(async () => { await app.close(); });

test('kliniğe kullanıcı ekleme: doğrulama ve başarı', async () => {
  const csrf = await csrfFor(client, base());
  let r = await client.post(`${base()}/kullanici`, { _csrf: csrf, name: 'Personel Bir', email: 'bozuk-eposta', password: 'Personel123', role: 'staff' });
  assert.equal(r.status, 400);
  assert.ok(r.text.includes('E-posta adresi geçersiz'));
  r = await client.post(`${base()}/kullanici`, { _csrf: csrf, name: 'Personel Bir', email: 'p1@pati.test', password: 'kisa', role: 'staff' });
  assert.equal(r.status, 400);
  r = await client.post(`${base()}/kullanici`, { _csrf: csrf, name: 'Çakışan', email: CLINIC.adminEmail, password: 'Personel123', role: 'staff' });
  assert.equal(r.status, 400);
  assert.ok(r.text.includes('kullanılamıyor'));

  r = await client.post(`${base()}/kullanici`, { _csrf: csrf, name: 'Personel Bir', email: 'P1@pati.test', password: 'Personel123', role: 'staff' });
  assert.equal(r.status, 302);
  assert.ok(flashOf(r.location).includes('Kullanıcı eklendi'));
  assert.ok(!r.location.includes('pati.test'), 'yönlendirme adresinde e-posta olmaz');
  staff = users.byEmail('p1@pati.test');
  assert.ok(staff);
  assert.equal(staff.clinic_id, clinicId);
  assert.equal(staff.role, 'staff');
  assert.equal(staff.must_change_password, 1);
  const page = await client.get(base());
  assert.ok(page.text.includes(`/kullanici/${staff.id}"`), 'Düzenle bağlantısı listede olmalı');
});

test('düzenleme sayfası ve ad/e-posta/rol/durum güncelleme', async () => {
  let r = await client.get(`${base()}/kullanici/${staff.id}`);
  assert.equal(r.status, 200);
  assert.ok(r.text.includes('p1@pati.test') && r.text.includes('Personel Bir'));
  const csrf = await csrfFor(client, `${base()}/kullanici/${staff.id}`);

  // başka kullanıcının e-postası reddedilir
  r = await client.post(`${base()}/kullanici/${staff.id}/duzenle`, { _csrf: csrf, name: 'Personel Bir', email: CLINIC.adminEmail, role: 'staff', active: '1' });
  assert.equal(r.status, 400);
  assert.ok(r.text.includes('kullanılamıyor'));

  r = await client.post(`${base()}/kullanici/${staff.id}/duzenle`, { _csrf: csrf, name: 'Personel Yeni Ad', email: 'P1-yeni@pati.test', role: 'admin', active: '1' });
  assert.equal(r.status, 302);
  assert.ok(r.location.startsWith(`${base()}/kullanici/${staff.id}?ok=`));
  staff = users.byId(staff.id);
  assert.equal(staff.name, 'Personel Yeni Ad');
  assert.equal(staff.email, 'p1-yeni@pati.test');
  assert.equal(staff.role, 'admin');
  assert.equal(staff.active, 1);
  const entry = auditLog.recent(20).find((a) => a.action === 'user.update' && a.entity_id === String(staff.id));
  assert.ok(entry);
  const meta = JSON.parse(entry.meta);
  assert.equal(meta.email, true);
  assert.equal(meta.role, 'admin');
  assert.ok(!entry.meta.includes('@'), 'denetim kaydına e-posta yazılmaz');
});

test('kliniğin son aktif yöneticisi pasifleştirilemez, personel yapılamaz, silinemez', async () => {
  // Şu an iki yönetici var (ayse + terfi eden personel); personeli geri personel yapınca ayse tek yönetici kalır
  let csrf = await csrfFor(client, `${base()}/kullanici/${staff.id}`);
  let r = await client.post(`${base()}/kullanici/${staff.id}/duzenle`, { _csrf: csrf, name: staff.name, email: staff.email, role: 'staff', active: '1' });
  assert.equal(r.status, 302);
  assert.equal(users.activeAdminCount(clinicId), 1);

  csrf = await csrfFor(client, `${base()}/kullanici/${clinicAdmin.id}`);
  r = await client.post(`${base()}/kullanici/${clinicAdmin.id}/duzenle`, { _csrf: csrf, name: clinicAdmin.name, email: clinicAdmin.email, role: 'staff', active: '1' });
  assert.equal(r.status, 400);
  assert.ok(r.text.includes('en az bir yöneticisi'));
  r = await client.post(`${base()}/kullanici/${clinicAdmin.id}/duzenle`, { _csrf: csrf, name: clinicAdmin.name, email: clinicAdmin.email, role: 'admin', active: '0' });
  assert.equal(r.status, 400);
  r = await client.post(`${base()}/kullanici/${clinicAdmin.id}/sil`, { _csrf: csrf });
  assert.equal(r.status, 400);
  assert.ok(users.byId(clinicAdmin.id));
  // ad değişikliği serbest (yönetici kalıyor)
  r = await client.post(`${base()}/kullanici/${clinicAdmin.id}/duzenle`, { _csrf: csrf, name: 'Dr. Ayşe Yeni', email: clinicAdmin.email, role: 'admin', active: '1' });
  assert.equal(r.status, 302);
  assert.equal(users.byId(clinicAdmin.id).name, 'Dr. Ayşe Yeni');
});

test('parola belirleme: zayıf parola reddedilir; belirlenen parolayla giriş; ilk girişte değişim seçeneği', async () => {
  let csrf = await csrfFor(client, `${base()}/kullanici/${staff.id}`);
  let r = await client.post(`${base()}/kullanici/${staff.id}/parola`, { _csrf: csrf, password: 'kisa' });
  assert.equal(r.status, 400);
  r = await client.post(`${base()}/kullanici/${staff.id}/parola`, { _csrf: csrf, password: 'KaliciParola1' });
  assert.equal(r.status, 302);
  assert.ok(flashOf(r.location).includes('Parola kaydedildi.'));
  assert.equal(users.byId(staff.id).must_change_password, 0);

  await logout(client);
  await resetLoginLimiter();
  r = await login(client, staff.email, 'KaliciParola1');
  assert.equal(r.status, 302);
  assert.ok(!String(r.location).startsWith('/sifre'), 'parola değişimi istenmemeli');
  await logout(client);

  await login(client, SA.email, SA.pass);
  csrf = await csrfFor(client, `${base()}/kullanici/${staff.id}`);
  r = await client.post(`${base()}/kullanici/${staff.id}/parola`, { _csrf: csrf, password: 'GeciciParola1', must_change: '1' });
  assert.equal(r.status, 302);
  assert.equal(users.byId(staff.id).must_change_password, 1);
  await logout(client);
  await resetLoginLimiter();
  r = await login(client, staff.email, 'GeciciParola1');
  assert.equal(r.status, 302);
  assert.ok(String(r.location).startsWith('/sifre'));
  await logout(client);
  await login(client, SA.email, SA.pass);
});

test('pasifleştirilen kullanıcı giriş yapamaz; aktifleştirilince yapar', async () => {
  let csrf = await csrfFor(client, `${base()}/kullanici/${staff.id}`);
  let r = await client.post(`${base()}/kullanici/${staff.id}/duzenle`, { _csrf: csrf, name: staff.name, email: staff.email, role: 'staff', active: '0' });
  assert.equal(r.status, 302);
  assert.equal(users.byId(staff.id).active, 0);
  await logout(client);
  await resetLoginLimiter();
  r = await login(client, staff.email, 'GeciciParola1');
  assert.equal(r.status, 401);
  await login(client, SA.email, SA.pass);
  csrf = await csrfFor(client, `${base()}/kullanici/${staff.id}`);
  r = await client.post(`${base()}/kullanici/${staff.id}/duzenle`, { _csrf: csrf, name: staff.name, email: staff.email, role: 'staff', active: '1' });
  assert.equal(r.status, 302);
  assert.equal(users.byId(staff.id).active, 1);
});

test('başka kliniğin kullanıcısı ve süper yönetici bu klinikten düzenlenemez', async () => {
  const { id: otherId } = await createClinicViaHttp(client, { name: 'Diğer Klinik', adminEmail: 'diger@pati.test', adminPassword: 'Gecici123' });
  const other = users.byEmail('diger@pati.test');
  const sa = users.byEmail(SA.email);
  const csrf = await csrfFor(client, base());
  const snapshot = [other, sa].map((u) => ({ id: u.id, email: u.email, hash: u.password_hash, role: u.role, active: u.active }));
  for (const uid of [other.id, sa.id, 999999]) {
    const page = await client.get(`${base()}/kullanici/${uid}`);
    assert.equal(page.status, 302);
    assert.ok(page.location.includes('err='));
    const attempts = [
      client.post(`${base()}/kullanici/${uid}/duzenle`, { _csrf: csrf, name: 'Ele Geçirilen', email: 'elegecirilen@pati.test', role: 'staff', active: '0' }),
      client.post(`${base()}/kullanici/${uid}/parola`, { _csrf: csrf, password: 'Korsan12345' }),
      client.post(`${base()}/kullanici/${uid}/sil`, { _csrf: csrf }),
    ];
    for (const r of await Promise.all(attempts)) {
      assert.equal(r.status, 302);
      assert.ok(r.location.includes('err='));
    }
  }
  for (const before of snapshot) {
    const now = users.byId(before.id);
    assert.ok(now, 'kullanıcı silinmemeli');
    assert.equal(now.email, before.email);
    assert.equal(now.password_hash, before.hash);
    assert.equal(now.role, before.role);
    assert.equal(now.active, before.active);
  }
  assert.equal(users.byId(other.id).clinic_id, otherId);
});

test('kullanıcı silme', async () => {
  const csrf = await csrfFor(client, `${base()}/kullanici/${staff.id}`);
  const r = await client.post(`${base()}/kullanici/${staff.id}/sil`, { _csrf: csrf });
  assert.equal(r.status, 302);
  assert.ok(flashOf(r.location).includes('Kullanıcı silindi'));
  assert.ok(!r.location.includes('pati.test'));
  assert.equal(users.byId(staff.id), undefined);
  assert.ok(auditLog.recent(20).find((a) => a.action === 'user.delete' && a.entity_id === String(staff.id)));
});

test('klinik yöneticisi süper yönetici uçlarına erişemez (403)', async () => {
  await logout(client);
  await resetLoginLimiter();
  await loginAndChangePassword(client, CLINIC.adminEmail, CLINIC.temp, 'YeniParola123');
  const csrf = await csrfFor(client, '/sifre');
  assert.equal((await client.get(`${base()}/kullanici/${clinicAdmin.id}`)).status, 403);
  assert.equal((await client.post(`${base()}/kullanici`, { _csrf: csrf, name: 'X', email: 'x@pati.test', password: 'Parola123' })).status, 403);
  assert.equal((await client.post(`${base()}/kullanici/${clinicAdmin.id}/parola`, { _csrf: csrf, password: 'Parola123' })).status, 403);
});
