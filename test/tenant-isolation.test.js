import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import {
  setupEnv, startApp, createClient, createSuperadmin, csrfFor, login, logout,
  createClinicViaHttp, loginAndChangePassword,
} from './helpers.js';

const dataDir = setupEnv();
const { tenantPath, isValidClinicId } = await import('../src/db/tenant.js');

describe('tenantPath', () => {
  test('yalnızca 12 hex karakter kabul edilir', () => {
    assert.throws(() => tenantPath('../master'), /Geçersiz klinik kimliği/);
    assert.throws(() => tenantPath('ABC'), /Geçersiz klinik kimliği/);
    assert.throws(() => tenantPath('ABCDEFABCDEF'), /Geçersiz klinik kimliği/); // büyük harf
    assert.throws(() => tenantPath('abcdefabcdef1'), /Geçersiz klinik kimliği/);
    assert.throws(() => tenantPath(''), /Geçersiz klinik kimliği/);
    assert.throws(() => tenantPath(null), /Geçersiz klinik kimliği/);
    assert.throws(() => tenantPath('abcdefabcde/'), /Geçersiz klinik kimliği/);
    assert.equal(isValidClinicId('0123456789ab'), true);
    const p = tenantPath('0123456789ab');
    assert.equal(p, path.join(dataDir, 'tenants', '0123456789ab.db'));
    assert.ok(p.startsWith(path.join(dataDir, 'tenants') + path.sep));
  });
});

describe('iki klinik birbirini görmez', () => {
  const SA = { email: 'admin@example.com', pass: 'Admin12345' };
  const A = { email: 'a@a.test', temp: 'GeciciA123', pass: 'ParolaA123', name: 'Klinik A', owner: 'Ayla Yalniz' };
  const B = { email: 'b@b.test', temp: 'GeciciB123', pass: 'ParolaB123', name: 'Klinik B' };
  let app;
  let client;
  let idA;
  let idB;

  before(async () => {
    app = await startApp();
    await createSuperadmin(SA.email, SA.pass);
    client = createClient(app.base);
    await login(client, SA.email, SA.pass);
    idA = (await createClinicViaHttp(client, { name: A.name, adminEmail: A.email, adminPassword: A.temp })).id;
    idB = (await createClinicViaHttp(client, { name: B.name, adminEmail: B.email, adminPassword: B.temp })).id;
    await logout(client);
  });
  after(async () => { await app.close(); });

  test('A sahip ekler, B göremez', async () => {
    assert.notEqual(idA, idB);
    await loginAndChangePassword(client, A.email, A.temp, A.pass);
    const csrf = await csrfFor(client, '/hizli-kayit');
    const r = await client.post('/hizli-kayit', { _csrf: csrf, owner_name: A.owner, phone: '0532 111 22 33', pet_name: 'Pamuk', species: 'Kedi', add_reminder: '0', sms_opt_in: '1' });
    assert.equal(r.status, 302);
    assert.ok(r.location.startsWith('/sahipler/1'));
    const own = await client.get('/sahipler/1');
    assert.equal(own.status, 200);
    assert.ok(own.text.includes(A.owner));
    const listA = await client.get('/sahipler');
    assert.ok(listA.text.includes(A.owner));
    await logout(client);

    await loginAndChangePassword(client, B.email, B.temp, B.pass);
    const nf = await client.get('/sahipler/1');
    assert.equal(nf.status, 404);
    const listB = await client.get('/sahipler');
    assert.equal(listB.status, 200);
    assert.ok(!listB.text.includes(A.owner));
    assert.ok(!listB.text.includes('0532 111 22 33'));
    // arama sorgusu forma geri yazılır; sonuç hücresi (bağlantı) olmamalı
    const search = await client.get('/sahipler?q=' + encodeURIComponent(A.owner));
    assert.equal(search.status, 200);
    assert.ok(!search.text.includes(`>${A.owner}</a>`));
    assert.ok(!search.text.includes('href="/sahipler/1"'));
    // B'nin panelinde A'nın kliniği değil kendi adı
    const home = await client.get('/');
    assert.ok(home.text.includes(B.name));
    assert.ok(!home.text.includes(A.name));
    // A'nın hatırlatma/hayvan kimliklerine de erişilemez
    assert.equal((await client.get('/hayvanlar/1/duzenle')).status, 404);
    assert.equal((await client.get('/sahipler/1/duzenle')).status, 404);
    await logout(client);
  });

  test('dosya düzeyinde ayrım: tam iki .db, B dosyasında sahip yok', () => {
    const files = fs.readdirSync(path.join(dataDir, 'tenants')).filter((f) => f.endsWith('.db'));
    assert.deepEqual(files.sort(), [`${idA}.db`, `${idB}.db`].sort());
    const dbB = new DatabaseSync(tenantPath(idB), { readOnly: true });
    assert.equal(dbB.prepare('SELECT COUNT(*) AS c FROM owners').get().c, 0);
    assert.equal(dbB.prepare('SELECT COUNT(*) AS c FROM pets').get().c, 0);
    dbB.close();
    const dbA = new DatabaseSync(tenantPath(idA), { readOnly: true });
    assert.equal(dbA.prepare('SELECT COUNT(*) AS c FROM owners').get().c, 1);
    assert.equal(dbA.prepare('SELECT name FROM owners').get().name, A.owner);
    dbA.close();
    // klinik verisi master.db'de değil
    const master = new DatabaseSync(path.join(dataDir, 'master.db'), { readOnly: true });
    const masterTables = master.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((t) => t.name);
    for (const t of ['owners', 'pets', 'reminders', 'sms_log']) assert.ok(!masterTables.includes(t), t);
    master.close();
  });
});

describe('kaynak denetimi', () => {
  test('openTenant( yalnızca izinli dosyalarda çağrılır', () => {
    const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
    // routes/public.js: oturumsuz ret bağlantısı ve klinik aydınlatma metni; kliniği yalnızca doğrulanmış belirteç/kısa ad belirler
    // retention.js: periyodik imha, klinik kilidi altında
    const allowed = new Set(['db/tenant.js', 'routes/clinic.js', 'routes/admin.js', 'routes/public.js', 'scheduler.js', 'backup.js', 'retention.js']);
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      return e.isDirectory() ? walk(p) : (e.name.endsWith('.js') ? [p] : []);
    });
    const offenders = [];
    let seen = 0;
    for (const file of walk(srcDir)) {
      const rel = path.relative(srcDir, file).split(path.sep).join('/');
      const src = fs.readFileSync(file, 'utf8');
      if (!src.includes('openTenant(')) continue;
      seen++;
      if (!allowed.has(rel)) offenders.push(rel);
    }
    assert.ok(seen >= 2, 'tanım ve en az bir çağrı bulunmalı');
    assert.deepEqual(offenders, []);
    // tanım tenant.js'de
    assert.ok(fs.readFileSync(path.join(srcDir, 'db', 'tenant.js'), 'utf8').includes('export function openTenant('));
  });
});
