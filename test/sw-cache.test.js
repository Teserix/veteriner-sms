import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  setupEnv, startApp, createClient, createSuperadmin, createClinicViaHttp,
  loginAndChangePassword, login, resetLoginLimiter,
} from './helpers.js';

setupEnv();

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('service worker kabuk önbelleği', () => {
  test('sw.js: ignoreSearch eşleşmesi, cache:reload tazeleme, CACHE_VERSION v4 değil', () => {
    const sw = read('public/sw.js');
    assert.match(sw, /ignoreSearch:\s*true/);
    assert.match(sw, /cache:\s*'reload'/);
    assert.doesNotMatch(sw, /CACHE_VERSION\s*=\s*'v4'/);
  });

  test('ASSET_VERSION özeti tour.js içeriğini de kapsar', () => {
    const src = read('src/app.js');
    const list = /const ASSET_VERSION[\s\S]*?for \(const f of \[([^\]]*)\]/.exec(src);
    assert.ok(list, 'ASSET_VERSION dosya listesi bulunamadı');
    assert.match(list[1], /'tour\.js'/);
  });
});

describe('klinik sayfasında varlık sürümleri', () => {
  const SA = { email: 'swc-sa@example.com', pass: 'Admin12345' };
  const K = { email: 'swc-k@klinik.test', temp: 'GeciciS123', pass: 'ParolaS123', name: 'SW Klinik' };
  let app;
  let client;

  before(async () => {
    app = await startApp();
    await createSuperadmin(SA.email, SA.pass);
    const sa = createClient(app.base);
    await login(sa, SA.email, SA.pass);
    await createClinicViaHttp(sa, { name: K.name, adminEmail: K.email, adminPassword: K.temp });
    client = createClient(app.base);
    await loginAndChangePassword(client, K.email, K.temp, K.pass);
    await resetLoginLimiter();
  });

  after(async () => { await app.close(); });

  test('footer tour.js ?v= değeri style.css ?v= ile aynı', async () => {
    const page = await client.get('/');
    assert.equal(page.status, 200);
    const tourV = /\/static\/tour\.js\?v=([^"&]*)"/.exec(page.text)?.[1];
    const styleV = /\/static\/style\.css\?v=([^"&]*)"/.exec(page.text)?.[1];
    assert.ok(tourV, 'tour.js ?v= bulunamadı');
    assert.equal(tourV, styleV);
  });
});
