import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ORIGIN = 'http://localhost:3301';
process.env.SKIP_DOTENV = '1';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'vet-import-'));
process.env.APP_SECRET = 'test-secret-test-secret-test-secret-1234';
process.env.APP_ORIGIN = ORIGIN;
process.env.PORT = '3301';
process.env.ENABLE_SCHEDULER = '0';

const { createApp } = await import('../src/app.js');
const { initAuth, hashPassword } = await import('../src/auth.js');
const { users } = await import('../src/db/master.js');
const { openTenant, owners, pets } = await import('../src/db/tenant.js');
const { limiters } = await import('../src/ratelimit.js');
const { _batches } = await import('../src/routes/import.js');
const { auditLog } = await import('../src/db/master.js');

let server;
let BASE;
const jar = {};
function cookieHeader() { return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '); }
function storeCookies(res) {
  for (const c of res.headers.getSetCookie?.() || []) {
    const [kv] = c.split(';'); const i = kv.indexOf('='); const k = kv.slice(0, i); const v = kv.slice(i + 1);
    const maxAge = /Max-Age=(\d+)/.exec(c);
    if (maxAge && maxAge[1] === '0') delete jar[k]; else jar[k] = v;
  }
}
async function get(p) {
  const res = await fetch(BASE + p, { headers: { cookie: cookieHeader() }, redirect: 'manual' });
  storeCookies(res); const text = await res.text();
  return { status: res.status, location: res.headers.get('location'), text };
}
async function post(p, data) {
  const body = new URLSearchParams(data).toString();
  const res = await fetch(BASE + p, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookieHeader(), origin: ORIGIN }, body, redirect: 'manual' });
  storeCookies(res); const text = await res.text();
  return { status: res.status, location: res.headers.get('location'), text };
}
async function upload(csrf, content, filename = 'liste.csv', extraHeaders = {}) {
  const fd = new FormData();
  if (csrf != null) fd.append('_csrf', csrf);
  fd.append('file', new Blob([content], { type: 'text/csv' }), filename);
  const res = await fetch(BASE + '/iceaktar', { method: 'POST', headers: { cookie: cookieHeader(), origin: ORIGIN, ...extraHeaders }, body: fd, redirect: 'manual' });
  storeCookies(res); const text = await res.text();
  return { status: res.status, location: res.headers.get('location'), text };
}
const csrfOf = (html) => /name="_csrf" value="([^"]+)"/.exec(html)?.[1];
const flashOf = (loc) => { const u = new URL(loc || '/', 'http://x'); return u.searchParams.get('ok') || u.searchParams.get('err') || ''; };
const tokenOf = (loc) => /\/iceaktar\/([A-Za-z0-9_-]{32})\//.exec(loc || '')?.[1];

let clinicId;
let csrf;

before(async () => {
  await initAuth();
  users.create({ clinicId: null, email: 'root@example.com', name: 'Root', passwordHash: await hashPassword('Root12345'), role: 'superadmin', createdAt: new Date().toISOString() });
  const app = createApp();
  server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  BASE = `http://127.0.0.1:${server.address().port}`;

  // superadmin: giriş + klinik oluştur
  let r = await get('/giris');
  r = await post('/giris', { _csrf: csrfOf(r.text), email: 'root@example.com', password: 'Root12345' });
  assert.equal(r.status, 302);
  r = await get('/admin');
  r = await post('/admin/klinik', { _csrf: csrfOf(r.text), clinic_name: 'Pati Veteriner', clinic_phone: '0212 555 11 22', admin_name: 'Dr. Ayşe', admin_email: 'ayse@pati.test', admin_password: 'Gecici123' });
  assert.equal(r.status, 302, r.text);
  r = await get('/admin');
  clinicId = /tenants\/([a-f0-9]{12})\.db/.exec(r.text)?.[1];
  assert.ok(clinicId, 'clinic id');
  r = await post('/cikis', { _csrf: csrfOf(r.text) });

  // klinik yöneticisi: giriş + parola değişimi
  r = await get('/giris');
  r = await post('/giris', { _csrf: csrfOf(r.text), email: 'ayse@pati.test', password: 'Gecici123' });
  r = await get('/sifre');
  r = await post('/sifre', { _csrf: csrfOf(r.text), current: 'Gecici123', password: 'YeniSifre123', password2: 'YeniSifre123' });
  assert.equal(r.status, 302);
  r = await get('/iceaktar');
  assert.equal(r.status, 200);
  assert.ok(r.text.includes('CSV UTF-8'));
  csrf = csrfOf(r.text);
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const CSV1 = [
  'Sahip Adı;Telefon;E-posta;Hayvan Adı;Tür;Irk;Cinsiyet;Doğum Tarihi',
  'Mehmet Kaya;0532 123 45 67;mehmet@example.com;Boncuk;kedi;Tekir;dişi;15.03.2020',
  'Mehmet Kaya;05321234567;;Zeytin;köpek;Golden;erkek;2019-01-02',
  'Mehmet Kaya;+90 532 123 45 67;;boncuk;kedi;;;',
  'Ayşe Demir;0212 123 45 67;;Pamuk;kus;;;',
  'Fatma Çelik;05339998877;fatma@;Duman;dog;;m;',
  ';05441112233;;Karabaş;;;;',
  '"Ali; Veli";0544 111 22 33;;"Karabaş";Tavşan;;d;01/05/2021',
].join('\r\n');

test('multipart CSRF: belirteçsiz yükleme 403', async () => {
  const r = await upload(null, CSV1);
  assert.equal(r.status, 403);
  assert.ok(r.text.includes('Güvenlik hatası'));
  const bad = await upload('kotu-belirtec', CSV1);
  assert.equal(bad.status, 403);
});

test('2MB+1 yükleme 413', async () => {
  const big = Buffer.alloc(2 * 1024 * 1024 + 1, 0x61);
  const r = await upload(csrf, big, 'buyuk.csv');
  assert.equal(r.status, 413);
});

test('NUL içeren dosya hata mesajıyla geri döner', async () => {
  const r = await upload(csrf, Buffer.from([0x61, 0x3b, 0x62, 0x0a, 0x00, 0x3b, 0x31]), 'ikili.csv');
  assert.equal(r.status, 302);
  assert.ok(flashOf(r.location).includes('CSV gibi görünmüyor'), r.location);
});

let token;
test('yükle -> eşleştir -> önizle -> onayla', async () => {
  let r = await upload(csrf, CSV1);
  assert.equal(r.status, 302, r.text);
  token = tokenOf(r.location);
  assert.ok(token, r.location);

  r = await get(`/iceaktar/${token}/eslestir`);
  assert.equal(r.status, 200);
  // tahmin edilen eşleştirme önceden seçili olmalı
  assert.match(r.text, /id="map_owner_name"[^]*?<option value="0" selected>/);
  assert.match(r.text, /id="map_phone"[^]*?<option value="1" selected>/);
  assert.match(r.text, /id="map_pet_name"[^]*?<option value="3" selected>/);
  assert.match(r.text, /id="map_sex"[^]*?<option value="6" selected>/);
  assert.ok(r.text.includes('Mehmet Kaya')); // ilk 5 satır önizleme

  // zorunlu alan eksik -> 400
  r = await post(`/iceaktar/${token}/eslestir`, { _csrf: csrf, map_owner_name: '0', map_phone: '', map_pet_name: '3' });
  assert.equal(r.status, 400);
  assert.ok(r.text.includes('Cep telefonu için bir sütun seçin'));

  r = await post(`/iceaktar/${token}/eslestir`, { _csrf: csrf, map_owner_name: '0', map_phone: '1', map_email: '2', map_pet_name: '3', map_species: '4', map_breed: '5', map_sex: '6', map_birth_date: '7' });
  assert.equal(r.status, 302);
  assert.equal(r.location, `/iceaktar/${token}/onizle`);

  r = await get(`/iceaktar/${token}/onizle`);
  assert.equal(r.status, 200);
  const badges = (cls) => (r.text.match(new RegExp(`class="badge ${cls}"`, 'g')) || []).length;
  assert.equal(badges('new_owner'), 2, 'Mehmet + Ali');
  assert.equal(badges('add_pet'), 1, 'Zeytin');
  assert.equal(badges('skip_duplicate'), 1, 'boncuk tekrar');
  assert.equal(badges('error'), 3, 'sabit hat, bozuk e-posta, boş sahip');
  assert.ok(r.text.includes('Ali; Veli'));
  assert.ok(r.text.includes('0532 123 45 67'));

  // fetch().text() baştaki BOM'u siler; ham baytlara bak
  const eRes = await fetch(`${BASE}/iceaktar/${token}/hatalar.csv`, { headers: { cookie: cookieHeader() } });
  assert.equal(eRes.status, 200);
  assert.ok(eRes.headers.get('content-disposition').includes('attachment'));
  const eBytes = Buffer.from(await eRes.arrayBuffer());
  assert.deepEqual([...eBytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  const eText = eBytes.subarray(3).toString('utf8');
  assert.ok(eText.startsWith('Satır;Sahip;Telefon;E-posta;Hayvan;Hata\r\n'), eText);
  assert.ok(eText.includes('Geçersiz cep telefonu'));
  assert.ok(eText.includes('E-posta geçersiz'));
  assert.ok(eText.includes('Sahip adı boş'));
  assert.equal(eText.trim().split('\r\n').length, 4);

  r = await post(`/iceaktar/${token}/onayla`, { _csrf: csrf });
  assert.equal(r.status, 302);
  assert.ok(r.location.startsWith('/sahipler?ok='), r.location);
  const msg = flashOf(r.location);
  assert.ok(msg.includes('2 yeni sahip'), msg);
  assert.ok(msg.includes('3 hayvan'), msg);

  const db = openTenant(clinicId);
  assert.equal(owners.count(db), 2);
  assert.equal(pets.count(db), 3);
  const mehmet = owners.byPhone(db, '905321234567');
  assert.ok(mehmet);
  assert.equal(mehmet.email, 'mehmet@example.com');
  assert.equal(mehmet.import_batch, token);
  const mp = pets.byOwner(db, mehmet.id).map((p) => [p.name, p.species, p.breed, p.sex, p.birth_date, p.import_batch]);
  assert.deepEqual(mp, [['Boncuk', 'Kedi', 'Tekir', 'Dişi', '2020-03-15', token], ['Zeytin', 'Köpek', 'Golden', 'Erkek', '2019-01-02', token]]);
  const ali = owners.byPhone(db, '905441112233');
  assert.equal(ali.name, 'Ali; Veli');
  assert.deepEqual(pets.byOwner(db, ali.id).map((p) => [p.name, p.species, p.sex, p.birth_date]), [['Karabaş', 'Tavşan', 'Dişi', '2021-05-01']]);
  assert.equal(owners.byPhone(db, '902121234567'), undefined, 'sabit hat eklenmemeli');
  assert.equal(owners.byPhone(db, '905339998877'), undefined, 'bozuk e-postalı satır eklenmemeli');

  // parti silindi, denetim yazıldı
  assert.equal(_batches.has(token), false);
  const r2 = await get(`/iceaktar/${token}/onizle`);
  assert.equal(r2.status, 404);
  const a = auditLog.recent(5, clinicId).find((x) => x.action === 'import.apply');
  assert.ok(a);
  assert.deepEqual(JSON.parse(a.meta), { owners: 2, pets: 3, skipped: 1, errors: 3, rows: 7 });
  // sayfada görünüyor
  const list = await get('/sahipler');
  assert.ok(list.text.includes('Mehmet Kaya') && list.text.includes('Ali; Veli'));
});

test('ikinci içe aktarma: mevcut telefona hayvan eklenir, aynı hayvan atlanır', async () => {
  const csv = 'sahip,telefon,hayvan\nMehmet K.,05321234567,Limon\nMehmet K.,05321234567,BONCUK\n';
  let r = await upload(csrf, csv, 'ek.csv');
  const t = tokenOf(r.location);
  assert.ok(t);
  r = await get(`/iceaktar/${t}/eslestir`);
  assert.ok(r.text.includes('ayraç: ,'));
  r = await post(`/iceaktar/${t}/eslestir`, { _csrf: csrf, map_owner_name: '0', map_phone: '1', map_pet_name: '2' });
  assert.equal(r.status, 302);
  r = await get(`/iceaktar/${t}/onizle`);
  assert.ok(r.text.includes('Mevcut sahibe eklenecek: Mehmet Kaya'));
  assert.ok(r.text.includes('Bu hayvan zaten kayıtlı'));
  r = await post(`/iceaktar/${t}/onayla`, { _csrf: csrf });
  assert.ok(flashOf(r.location).includes('0 yeni sahip, 1 hayvan'), r.location);
  const db = openTenant(clinicId);
  assert.equal(owners.count(db), 2);
  assert.equal(pets.count(db), 4);
  assert.equal(owners.byPhone(db, '905321234567').name, 'Mehmet Kaya', 'mevcut sahip adı değişmez');
});

test('yabancı / süresi dolmuş belirteç 404', async () => {
  let r = await get('/iceaktar/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/eslestir');
  assert.equal(r.status, 404);
  r = await get('/iceaktar/kisa/onizle');
  assert.equal(r.status, 404);
  r = await post('/iceaktar/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/onayla', { _csrf: csrf });
  assert.equal(r.status, 404);

  r = await upload(csrf, CSV1);
  const t = tokenOf(r.location);
  assert.ok(t);
  assert.equal((await get(`/iceaktar/${t}/eslestir`)).status, 200);
  // başka kliniğe aitmiş gibi
  _batches.get(t).clinicId = 'ffffffffffff';
  assert.equal((await get(`/iceaktar/${t}/eslestir`)).status, 404);
  _batches.get(t).clinicId = clinicId;
  // süresi dolmuş
  _batches.get(t).expiresAt = Date.now() - 1;
  assert.equal((await get(`/iceaktar/${t}/eslestir`)).status, 404);
  assert.equal(_batches.has(t), false);
});

test('yükleme hız sınırı: saatte 5 (CSRF/413 hataları sayılmaz)', async () => {
  // Şimdiye kadar CSRF geçen 4 yükleme oldu (NUL dosyası dahil); 403 ve 413 sınırlayıcıya ulaşmaz
  assert.equal(limiters.importUpload._hits.get('clinic:' + clinicId)?.count, 4);
  limiters.importUpload._hits.clear();
  for (let i = 0; i < 5; i++) {
    const r = await upload(csrf, 'a;b;c\n1;2;3\n');
    assert.equal(r.status, 302, `upload ${i}`);
  }
  const r = await upload(csrf, 'a;b;c\n1;2;3\n');
  assert.equal(r.status, 429);
  limiters.importUpload._hits.clear();
  // klinik başına en fazla 5 parti tutulur
  assert.equal([..._batches.values()].filter((b) => b.clinicId === clinicId).length, 5);
});

test('personel rolü içe aktaramaz', async () => {
  let r = await get('/kullanicilar');
  r = await post('/kullanicilar', { _csrf: csrfOf(r.text), name: 'Personel', email: 'staff@pati.test', password: 'Staff1234', role: 'staff' });
  assert.equal(r.status, 302);
  await post('/cikis', { _csrf: csrf });
  r = await get('/giris');
  r = await post('/giris', { _csrf: csrfOf(r.text), email: 'staff@pati.test', password: 'Staff1234' });
  r = await get('/sifre');
  r = await post('/sifre', { _csrf: csrfOf(r.text), current: 'Staff1234', password: 'Staff12345', password2: 'Staff12345' });
  r = await get('/iceaktar');
  assert.equal(r.status, 403);
});
