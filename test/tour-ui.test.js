import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  setupEnv, startApp, createClient, createSuperadmin, createClinicViaHttp,
  loginAndChangePassword, resetLoginLimiter, login, makeLegalReady, acceptLegal,
} from './helpers.js';

setupEnv();

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const tourJs = fs.readFileSync(path.join(root, 'public/tour.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/style.css'), 'utf8');

describe('tour.js modal, mobil ve kaydırma', () => {
  test('gerçek modal: focusin tuzağı, inert, Esc yayılımı durur, dinleyiciler kaldırılır', () => {
    for (const s of ['focusin', 'inert', 'stopImmediatePropagation', 'removeEventListener', 'tour-backdrop']) {
      assert.ok(tourJs.includes(s), s);
    }
    assert.match(tourJs, /document\.addEventListener\('keydown', onKey, true\)/);
    assert.match(tourJs, /document\.removeEventListener\('keydown', onKey, true\)/);
    assert.doesNotMatch(tourJs, /innerHTML/);
  });

  test("mobil: 700px eşiği ve .nav-toggle yedek hedefi; scroll'da yeniden konum, smooth yok", () => {
    assert.ok(tourJs.includes('(max-width: 700px)'));
    assert.ok(tourJs.includes('nav-toggle'));
    assert.ok(tourJs.includes("'scroll'"));
    assert.match(tourJs, /removeEventListener\('scroll'/);
    assert.ok(!tourJs.includes('smooth'));
  });

  test('personel rolünde ayarlar adımı süzülür', () => {
    assert.ok(tourJs.includes('staff'));
    assert.match(tourJs, /dataset\.role/);
  });

  test('style.css: .tour-backdrop ve 700px tur medya sorgusu', () => {
    assert.match(css, /\.tour-backdrop\s*\{[^}]*position:\s*fixed[^}]*z-index:\s*85/);
    assert.match(css, /@media \(max-width: 700px\)\s*\{\s*\.tour-panel/);
    assert.doesNotMatch(css, /@media \(max-width: 640px\)\s*\{\s*\.tour-panel/);
    assert.match(css, /@media print\s*\{[^}]*\.tour-backdrop/);
  });
});

describe('sekme çubuğunda data-tour işaretleri', () => {
  const SA = { email: 'tourui-sa@example.com', pass: 'Admin12345' };
  const A = { email: 'tourui-a@klinik.test', temp: 'GeciciA123', pass: 'ParolaA123', name: 'Tur UI Klinik' };
  let app;
  let a;

  before(async () => {
    app = await startApp();
    await createSuperadmin(SA.email, SA.pass);
    const sa = createClient(app.base);
    await login(sa, SA.email, SA.pass);
    const { id } = await createClinicViaHttp(sa, {
      name: A.name, adminEmail: A.email, adminPassword: A.temp, legalReady: false,
    });
    await makeLegalReady(id);
    a = createClient(app.base);
    await loginAndChangePassword(a, A.email, A.temp, A.pass, { acceptContracts: false });
    await acceptLegal(a);
    await resetLoginLimiter();
  });

  after(async () => { await app.close(); });

  test('tabbar hatirlatmalar, sahipler, hizli-kayit taşır; header işaretleri kalır', async () => {
    const page = await a.get('/');
    assert.equal(page.status, 200);
    const tabbar = /<nav class="tabbar"[\s\S]*?<\/nav>/.exec(page.text);
    assert.ok(tabbar, 'tabbar yok');
    for (const key of ['hatirlatmalar', 'sahipler', 'hizli-kayit']) {
      assert.match(tabbar[0], new RegExp(`data-tour="${key}"`), key);
    }
    const outside = page.text.replace(tabbar[0], '');
    for (const key of ['hizli-kayit', 'hatirlatmalar', 'sahipler', 'sms', 'ayarlar']) {
      assert.match(outside, new RegExp(`data-tour="${key}"`), `header ${key}`);
    }
    assert.match(tabbar[0], /class="tab-link nav-toggle"/);
  });
});
