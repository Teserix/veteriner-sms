import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  setupEnv, startApp, createClient, createSuperadmin, createClinicViaHttp,
  loginAndChangePassword, csrfFor, csrfOf, resetLoginLimiter, login,
  makeLegalReady, acceptLegal,
} from './helpers.js';

const dataDir = setupEnv();

const userVersion = (db) => db.prepare('PRAGMA user_version').get().user_version;
const columnNames = (db, table) => db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);

describe('tour_seen_at migrasyonu', () => {
  test('master users.tour_seen_at var, user_version uzunluğa eşit, ikinci migrate hata vermez', async () => {
    const { MASTER_MIGRATIONS, master } = await import('../src/db/master.js');
    const { migrate } = await import('../src/db/migrate.js');

    assert.ok(columnNames(master, 'users').includes('tour_seen_at'));
    assert.equal(userVersion(master), MASTER_MIGRATIONS.length);
    assert.equal(migrate(master, MASTER_MIGRATIONS), MASTER_MIGRATIONS.length);
    assert.equal(userVersion(master), MASTER_MIGRATIONS.length);
    assert.equal(migrate(master, MASTER_MIGRATIONS), MASTER_MIGRATIONS.length);

    const file = path.join(dataDir, 'tour-fresh.db');
    fs.rmSync(file, { force: true });
    const fresh = new DatabaseSync(file);
    fresh.exec('PRAGMA foreign_keys = ON');
    assert.equal(migrate(fresh, MASTER_MIGRATIONS), MASTER_MIGRATIONS.length);
    assert.equal(migrate(fresh, MASTER_MIGRATIONS), MASTER_MIGRATIONS.length);
    assert.ok(columnNames(fresh, 'users').includes('tour_seen_at'));
    assert.equal(userVersion(fresh), MASTER_MIGRATIONS.length);
    fresh.close();
  });
});

describe('POST /tur/goruldu', () => {
  const SA = { email: 'tour-sa@example.com', pass: 'Admin12345' };
  const A = { email: 'tour-a@klinik.test', temp: 'GeciciA123', pass: 'ParolaA123', name: 'Tur Klinik A' };
  const B = { email: 'tour-b@klinik.test', temp: 'GeciciB123', pass: 'ParolaB123', name: 'Tur Klinik B' };
  const C = { email: 'tour-c@klinik.test', temp: 'GeciciC123', pass: 'ParolaC123', name: 'Tur Klinik C' };
  const D = { email: 'tour-d@klinik.test', temp: 'GeciciD123', pass: 'ParolaD123', name: 'Tur Klinik D' };
  let app;
  let sa;
  let a;
  let b;
  let c;
  let d;

  async function openClinic(spec) {
    const { id } = await createClinicViaHttp(sa, {
      name: spec.name, adminEmail: spec.email, adminPassword: spec.temp, legalReady: false,
    });
    await makeLegalReady(id);
    const client = createClient(app.base);
    await loginAndChangePassword(client, spec.email, spec.temp, spec.pass, { acceptContracts: false });
    await acceptLegal(client);
    return client;
  }

  before(async () => {
    app = await startApp();
    await createSuperadmin(SA.email, SA.pass);
    sa = createClient(app.base);
    await login(sa, SA.email, SA.pass);
    a = await openClinic(A);
    b = await openClinic(B);
    c = await openClinic(C);
    d = await openClinic(D);
    await resetLoginLimiter();
  });

  after(async () => { await app.close(); });

  test('süper yönetici ve geçici parolada data-tour-auto yok', async () => {
    const admin = await sa.get('/admin');
    assert.equal(admin.status, 200);
    assert.doesNotMatch(admin.text, /data-tour-auto="1"/);
    assert.match(admin.text, /<meta name="csrf-token" content="[^"]+">/);

    const email = 'tour-gecici@klinik.test';
    await createClinicViaHttp(sa, { name: 'Tur Gecici', adminEmail: email, adminPassword: 'GeciciZ123', legalReady: false });
    const gecici = createClient(app.base);
    const entered = await login(gecici, email, 'GeciciZ123');
    assert.equal(entered.status, 302);
    assert.ok(String(entered.location).startsWith('/sifre'));
    const page = await gecici.get('/sifre');
    assert.equal(page.status, 200);
    assert.doesNotMatch(page.text, /data-tour-auto="1"/);
    const { users } = await import('../src/db/master.js');
    assert.equal(users.byEmail(email).tour_seen_at, null);
    const blocked = await gecici.post('/tur/goruldu', { _csrf: csrfOf(page.text) });
    assert.ok(blocked.status >= 300 && blocked.status < 400);
    assert.equal(users.byEmail(email).tour_seen_at, null);
  });

  test('klinik kullanıcısı bayrağı görür; geçerli POST sonrası kaydolur ve bayrak kalkar', async () => {
    const dash = await a.get('/');
    assert.equal(dash.status, 200);
    assert.match(dash.text, /data-tour-auto="1"/);
    const meta = /<meta name="csrf-token" content="([^"]+)">/.exec(dash.text);
    assert.ok(meta, 'csrf meta yok');
    assert.equal(meta[1], csrfOf(dash.text));

    const { users } = await import('../src/db/master.js');
    assert.equal(users.byEmail(A.email).tour_seen_at, null);

    const posted = await a.post('/tur/goruldu', { _csrf: meta[1] });
    assert.equal(posted.status, 303);
    assert.equal(posted.location, '/');
    const row = users.byEmail(A.email);
    assert.match(row.tour_seen_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    const next = await a.get(posted.location);
    assert.equal(next.status, 200);
    assert.doesNotMatch(next.text, /data-tour-auto="1"/);
    assert.match(next.text, /name="csrf-token"/);

    const csrf = await csrfFor(a, '/');
    const fetched = await a.post('/tur/goruldu', { _csrf: csrf }, { accept: 'application/json', 'x-csrf-token': csrf });
    assert.equal(fetched.status, 204);
    assert.equal(fetched.text, '');
    assert.match(users.byEmail(A.email).tour_seen_at, /^\d{4}-\d{2}-\d{2}T/);

    const back = await a.post('/tur/goruldu', { _csrf: csrf }, { referer: `${app.base}/hatirlatmalar?q=1` });
    assert.equal(back.status, 303);
    assert.equal(back.location, '/hatirlatmalar?q=1');
    const evil = await a.post('/tur/goruldu', { _csrf: csrf }, { referer: 'https://evil.example/phish' });
    assert.equal(evil.status, 303);
    assert.equal(evil.location, '/');
  });

  test('CSRF yok veya yanlışsa 403 ve tour_seen_at NULL kalır', async () => {
    const { users } = await import('../src/db/master.js');
    assert.equal(users.byEmail(C.email).tour_seen_at, null);
    const missing = await c.post('/tur/goruldu', {});
    assert.equal(missing.status, 403);
    assert.equal(users.byEmail(C.email).tour_seen_at, null);
    const wrong = await c.post('/tur/goruldu', { _csrf: 'yanlis-belirtec' });
    assert.equal(wrong.status, 403);
    assert.equal(users.byEmail(C.email).tour_seen_at, null);
    const page = await c.get('/');
    assert.match(page.text, /data-tour-auto="1"/);
  });

  test('gövdedeki user_id yok sayılır; yalnız oturum sahibi güncellenir', async () => {
    const { users } = await import('../src/db/master.js');
    const self = users.byEmail(D.email);
    const other = users.byEmail(B.email);
    assert.equal(self.tour_seen_at, null);
    assert.equal(other.tour_seen_at, null);
    const csrf = await csrfFor(d, '/');
    const r = await d.post('/tur/goruldu', { _csrf: csrf, user_id: String(other.id) });
    assert.ok(r.status === 204 || r.status === 303);
    assert.match(users.byId(self.id).tour_seen_at, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(users.byId(other.id).tour_seen_at, null);
    assert.equal(users.byId(other.id).clinic_id === self.clinic_id, false);
  });

  test('kiracı izolasyonu: A nin POST u B nin turunu ve bayrağını değiştirmez', async () => {
    const { users } = await import('../src/db/master.js');
    const beforeB = users.byEmail(B.email).tour_seen_at;
    assert.equal(beforeB, null);
    const csrf = await csrfFor(a, '/');
    const r = await a.post('/tur/goruldu', { _csrf: csrf, user_id: String(users.byEmail(B.email).id) });
    assert.ok(r.status === 204 || r.status === 303);
    assert.equal(users.byEmail(B.email).tour_seen_at, null);
    assert.notEqual(users.byEmail(A.email).clinic_id, users.byEmail(B.email).clinic_id);
    const page = await b.get('/');
    assert.equal(page.status, 200);
    assert.match(page.text, /data-tour-auto="1"/);
  });

  test('oturumsuz POST 2xx dönmez ve satır yazmaz', async () => {
    const { users } = await import('../src/db/master.js');
    const target = users.byEmail(B.email);
    const anon = createClient(app.base);
    const r = await anon.post('/tur/goruldu', { _csrf: 'yok', user_id: String(target.id) });
    assert.ok(r.status < 200 || r.status >= 300, `oturumsuz POST 2xx döndü: ${r.status}`);
    assert.equal(users.byId(target.id).tour_seen_at, null);
    const loginPage = await anon.get('/giris');
    assert.doesNotMatch(loginPage.text, /data-tour-auto="1"/);
    assert.doesNotMatch(loginPage.text, /name="csrf-token"/);
  });
});
