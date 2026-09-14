import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupEnv, startApp, createClient, createSuperadmin, csrfOf, login, logout, csrfFor,
  createClinicViaHttp, resetLoginLimiter,
  acceptLegal,
} from './helpers.js';

setupEnv();

const SA_EMAIL = 'admin@example.com';
const SA_PASS = 'Admin12345';
let app;
let client;

before(async () => {
  app = await startApp();
  await createSuperadmin(SA_EMAIL, SA_PASS);
  client = createClient(app.base);
});
after(async () => { await app.close(); });

const sessionCookie = (r) => r.setCookies.find((c) => c.startsWith('vsid='));

describe('giriş', () => {
  test('ön belirteç olmadan POST /giris -> 403', async () => {
    client.clear();
    const r = await client.post('/giris', { email: SA_EMAIL, password: SA_PASS });
    assert.equal(r.status, 403);
  });

  test('yanlış parola -> 401, genel mesaj, çerez yok', async () => {
    client.clear();
    const r = await login(client, SA_EMAIL, 'Yanlis12345');
    assert.equal(r.status, 401);
    assert.ok(r.text.includes('E-posta veya parola hatalı.'));
    assert.equal(sessionCookie(r), undefined);
    // bilinmeyen e-posta da aynı mesajı verir
    const r2 = await login(client, 'yok@example.com', 'Yanlis12345');
    assert.equal(r2.status, 401);
    assert.ok(r2.text.includes('E-posta veya parola hatalı.'));
    await resetLoginLimiter();
  });

  test('başarılı giriş HttpOnly SameSite=Lax çerez verir', async () => {
    client.clear();
    const r = await login(client, SA_EMAIL, SA_PASS);
    assert.equal(r.status, 302);
    assert.equal(r.location, '/admin');
    const c = sessionCookie(r);
    assert.ok(c, 'vsid çerezi yok');
    assert.ok(/HttpOnly/i.test(c));
    assert.ok(/SameSite=Lax/i.test(c));
    assert.ok(/Path=\//.test(c));
    assert.ok(!/Secure/i.test(c), 'test ortamında Secure beklenmez');
    // oturumla /giris tekrar açılırsa yönlenir
    const g = await client.get('/giris');
    assert.equal(g.status, 302);
    assert.equal(g.location, '/admin');
  });

  test('yabancı Origin ile POST -> 403', async () => {
    const csrf = await csrfFor(client, '/admin');
    const r = await client.post('/admin/klinik', { _csrf: csrf, clinic_name: 'X' }, { origin: 'https://evil.example' });
    assert.equal(r.status, 403);
    assert.ok(r.text.includes('Güvenlik hatası'));
  });

  test('oturumlu POST _csrf olmadan -> 403 HTML "Güvenlik hatası" (500 değil)', async () => {
    const r = await client.post('/admin/klinik', { clinic_name: 'X' });
    assert.equal(r.status, 403);
    assert.ok(r.text.includes('Güvenlik hatası'));
    assert.ok(r.text.includes('<html'));
    const r2 = await client.post('/admin/klinik', { _csrf: 'yanlis', clinic_name: 'X' });
    assert.equal(r2.status, 403);
    assert.ok(r2.text.includes('Güvenlik hatası'));
  });

  test('oturum rotasyonu: iki girişte çerez değeri farklı', async () => {
    client.clear();
    const a = sessionCookie(await login(client, SA_EMAIL, SA_PASS));
    await logout(client);
    const b = sessionCookie(await login(client, SA_EMAIL, SA_PASS));
    assert.ok(a && b);
    assert.notEqual(a.split(';')[0], b.split(';')[0]);
  });

  test('çıkış çerezi siler; /sahipler girişe yönlenir', async () => {
    client.clear();
    await login(client, SA_EMAIL, SA_PASS);
    assert.ok(client.jar.vsid);
    const r = await logout(client);
    assert.equal(r.status, 302);
    assert.equal(r.location, '/giris');
    const cleared = r.setCookies.find((c) => c.startsWith('vsid='));
    assert.ok(cleared && /Max-Age=0/.test(cleared));
    assert.equal(client.jar.vsid, undefined);
    const s = await client.get('/sahipler');
    assert.equal(s.status, 302);
    assert.ok(s.location.startsWith('/giris'));
    assert.ok(s.location.includes('next=%2Fsahipler'));
    // oturumsuz POST (giriş dışı) 403
    const p = await client.post('/cikis', {});
    assert.equal(p.status, 403);
  });
});

describe('parola', () => {
  const ADMIN_EMAIL = 'ayse@pati.test';
  const TEMP = 'Gecici123';
  const NEW = 'YeniSifre123';

  test('must_change_password kapısı ve parola değişimi', async () => {
    client.clear();
    await login(client, SA_EMAIL, SA_PASS);
    const { id } = await createClinicViaHttp(client, { name: 'Pati Veteriner', adminEmail: ADMIN_EMAIL, adminPassword: TEMP });
    assert.match(id, /^[a-f0-9]{12}$/);
    await logout(client);

    const r = await login(client, ADMIN_EMAIL, TEMP);
    assert.equal(r.status, 302);
    assert.ok(r.location.startsWith('/sifre'));
    const home = await client.get('/');
    assert.equal(home.status, 302);
    assert.ok(home.location.startsWith('/sifre'));
    const owners = await client.get('/sahipler');
    assert.equal(owners.status, 302);
    assert.ok(owners.location.startsWith('/sifre'));

    const page = await client.get('/sifre');
    assert.equal(page.status, 200);
    assert.ok(page.text.includes('Geçici parolayla giriş yaptınız'));
    const csrf = csrfOf(page.text);

    // aynı parola reddedilir
    const same = await client.post('/sifre', { _csrf: csrf, current: TEMP, password: TEMP, password2: TEMP });
    assert.equal(same.status, 400);
    assert.ok(same.text.includes('aynı olamaz'));
    // eşleşmeyen / zayıf / yanlış mevcut parola
    const mism = await client.post('/sifre', { _csrf: csrf, current: TEMP, password: NEW, password2: NEW + 'x' });
    assert.equal(mism.status, 400);
    const weak = await client.post('/sifre', { _csrf: csrf, current: TEMP, password: 'kisa', password2: 'kisa' });
    assert.equal(weak.status, 400);
    const wrong = await client.post('/sifre', { _csrf: csrf, current: 'Yanlis999', password: NEW, password2: NEW });
    assert.equal(wrong.status, 400);
    assert.ok(wrong.text.includes('Mevcut parola hatalı'));
    // hâlâ kapıda
    assert.equal((await client.get('/')).status, 302);

    const ok = await client.post('/sifre', { _csrf: csrf, current: TEMP, password: NEW, password2: NEW });
    assert.equal(ok.status, 302);
    assert.ok(ok.location.startsWith('/?ok='));
    assert.ok(sessionCookie(ok), 'parola değişimi yeni oturum çerezi vermeli');
    // Sözleşme kapısı: klinik yöneticisi güncel sözleşmeyi kabul etmeden klinik ekranlarına giremez
    const gated = await client.get('/');
    assert.equal(gated.status, 302);
    assert.equal(gated.location, '/sozlesme');
    const contract = await client.get('/sozlesme');
    assert.equal(contract.status, 200);
    assert.ok(contract.text.includes('name="accept_abonelik-sozlesmesi"'));
    assert.ok(contract.text.includes('name="accept_veri-isleyen-eki"'));
    // Tek belge onaylanınca kabul edilmez (her belge ayrı onay)
    const partial = await client.post('/sozlesme', { _csrf: csrfOf(contract.text), 'accept_abonelik-sozlesmesi': '1' });
    assert.equal(partial.status, 200);
    assert.ok(partial.text.includes('ayrı ayrı'));
    await acceptLegal(client);
    const home2 = await client.get('/');
    assert.equal(home2.status, 200);
    assert.ok(home2.text.includes('Pati Veteriner'));

    // eski parola artık geçersiz, yenisi doğrudan panele girer
    await logout(client);
    assert.equal((await login(client, ADMIN_EMAIL, TEMP)).status, 401);
    const again = await login(client, ADMIN_EMAIL, NEW);
    assert.equal(again.status, 302);
    assert.equal(again.location, '/');
    await logout(client);
    await resetLoginLimiter();
  });
});

describe('giriş sınırlayıcısı', () => {
  test('9. hatalı deneme 429', async () => {
    client.clear();
    await resetLoginLimiter();
    const email = 'limit@example.com';
    for (let i = 1; i <= 8; i++) {
      const r = await login(client, email, 'Yanlis12345');
      assert.equal(r.status, 401, `deneme ${i}`);
    }
    const r9 = await login(client, email, 'Yanlis12345');
    assert.equal(r9.status, 429);
    assert.ok(r9.text.includes('15 dakika'));
    // doğru parola bile aynı IP'den engellenir (anahtar ip VE e-posta)
    const sa = await login(client, SA_EMAIL, SA_PASS);
    assert.equal(sa.status, 429);
    await resetLoginLimiter();
    const ok = await login(client, SA_EMAIL, SA_PASS);
    assert.equal(ok.status, 302);
    await logout(client);
  });
});
