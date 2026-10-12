/**
 * SMS önizleme + düzenlenmiş gövdeyle gönderim: HTTP uçtan uca testleri.
 * GET /hatirlatmalar/:id/onizle, POST /hatirlatmalar/:id/gonder (body), hızlı kayıtta sonra=onizle.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupEnv, createClient, startApp, createSuperadmin, login, csrfFor,
  createClinicViaHttp, loginAndChangePassword, logout,
} from './helpers.js';

setupEnv();
const { PROVIDERS } = await import('../src/sms/index.js');
const { master } = await import('../src/db/master.js');
const { openTenant, setSetting, reminders, owners } = await import('../src/db/tenant.js');
const { limiters } = await import('../src/ratelimit.js');
const { todayLocal } = await import('../src/util.js');

/** Sahte sağlayıcı: giden her mesajı kaydeder */
const sent = [];
PROVIDERS.fake = { label: 'fake', fields: [], senderHelp: '', async send({ to, message }) { sent.push({ to, message }); return { ok: true, ref: 'f' + sent.length }; } };

const app = await startApp();
after(() => app.close());

const unescapeHtml = (s) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const fullOf = (html) => unescapeHtml(/<p class="sms-full">([^<]*)<\/p>/.exec(html)?.[1] ?? '');
const auditRows = (clinicId) => master.prepare("SELECT * FROM audit_log WHERE clinic_id = ? AND action = 'reminder.sms_send' ORDER BY id").all(clinicId);

await createSuperadmin('root@test.local', 'RootPass123');
const root = createClient(app.base);
await login(root, 'root@test.local', 'RootPass123');
const { id: clinicA } = await createClinicViaHttp(root, { name: 'Önizleme A', adminEmail: 'a@test.local', adminPassword: 'Gecici123' });
const { id: clinicB } = await createClinicViaHttp(root, { name: 'Önizleme B', adminEmail: 'b@test.local', adminPassword: 'Gecici123' });
await logout(root);
const dbA = openTenant(clinicA);
setSetting(dbA, 'sms_provider', 'fake');
setSetting(dbA, 'template', 'Sayın {sahip}, {hayvan} için {tarih} tarihinde {tur} randevunuz var. {klinik}');

const a = createClient(app.base);
await loginAndChangePassword(a, 'a@test.local', 'Gecici123', 'Kalici1234');
const b = createClient(app.base);
await loginAndChangePassword(b, 'b@test.local', 'Gecici123', 'Kalici1234');

/** Hızlı kayıtla sahip + hayvan + bugünkü hatırlatma oluşturur; yönlendirme yanıtını ve yeni hatırlatmayı döner */
async function quick(client, { phone, optIn = '1', sonra } = {}) {
  const csrf = await csrfFor(client, '/hizli-kayit');
  const data = {
    _csrf: csrf, owner_name: 'Ayşe Yılmaz', phone, pet_name: 'Pamuk', species: 'Kedi',
    add_reminder: '1', type: 'asi', title: 'Karma aşı', due_date: todayLocal(), notify_days_before: '0', sms_opt_in: optIn,
  };
  if (sonra) data.sonra = sonra;
  const r = await client.post('/hizli-kayit', data);
  const rem = dbA.prepare('SELECT * FROM reminders ORDER BY id DESC LIMIT 1').get();
  return { r, rem, csrf };
}

test('hızlı kayıt: sonra=onizle yeni hatırlatmanın önizlemesine yönlendirir; yoksa sahip sayfası', async () => {
  const { r, rem } = await quick(a, { phone: '05321110001', sonra: 'onizle' });
  assert.equal(r.status, 302);
  assert.equal(r.location, `/hatirlatmalar/${rem.id}/onizle`);
  const plain = await quick(a, { phone: '05321110002' });
  assert.match(plain.r.location, /^\/sahipler\/\d+\?ok=/);
});

test('GET onizle: tam metin (önek + gövde + kimlik + iptal) ve sayaç', async () => {
  const { rem } = await quick(a, { phone: '05321110003' });
  const page = await a.get(`/hatirlatmalar/${rem.id}/onizle`);
  assert.equal(page.status, 200);
  const full = fullOf(page.text);
  assert.ok(full.startsWith('Bilgilendirme: Sayın Ayşe Yılmaz, Pamuk için'), full);
  assert.match(full, /MERSIS:0123456789012345 Iptal: http:\/\/127\.0\.0\.1:\d+\/ret\//);
  assert.match(page.text, /<textarea[^>]*name="body"[^>]*data-sms-body/);
  assert.match(page.text, /data-sms-counter/);
  assert.match(page.text, /\d+ karakter · \d+ SMS/);
  assert.doesNotMatch(page.text, /<button class="btn" type="submit" disabled/);
});

test('kiracı izolasyonu: başka kliniğin hatırlatması GET ve POST 404', async () => {
  const { rem } = await quick(a, { phone: '05321110004' });
  const g = await b.get(`/hatirlatmalar/${rem.id}/onizle`);
  assert.equal(g.status, 404);
  const csrf = await csrfFor(b);
  const p = await b.post(`/hatirlatmalar/${rem.id}/gonder`, { _csrf: csrf, body: 'Merhaba' });
  assert.equal(p.status, 404);
  assert.equal(reminders.get(dbA, rem.id).status, 'pending');
});

test('CSRF belirteci olmayan POST reddedilir', async () => {
  const { rem } = await quick(a, { phone: '05321110005' });
  const n = sent.length;
  const r = await a.post(`/hatirlatmalar/${rem.id}/gonder`, { body: 'Merhaba' });
  assert.equal(r.status, 403);
  assert.equal(sent.length, n);
  assert.equal(reminders.get(dbA, rem.id).status, 'pending');
});

test('düzenlenmiş gövde: sağlayıcıya giden metin önizlemedeki tam metinle aynı, kuyruk korunur; denetim kaydı', async () => {
  const { rem, csrf } = await quick(a, { phone: '05321110006' });
  const body = 'Pamuk için yarın saat 10:00 aşı randevunuz var, bekliyoruz.';
  const n = sent.length;
  const r = await a.post(`/hatirlatmalar/${rem.id}/gonder`, { _csrf: csrf, body });
  assert.equal(r.status, 302);
  assert.match(r.location, /ok=/);
  assert.equal(sent.length, n + 1);
  const msg = sent.at(-1).message;
  const ownerToken = owners.get(dbA, reminders.get(dbA, rem.id).owner_id).opt_out_token;
  assert.equal(msg, `Bilgilendirme: ${body} MERSIS:0123456789012345 Iptal: ${app.base}/ret/${clinicA}.${ownerToken} Tel:0212 555 00 00`);

  // Önizleme ekranının kullandığı fonksiyon aynı gövdeyle birebir aynı tam metni verir
  const { previewParts } = await import('../src/sms/policy.js');
  const { buildReminderVars } = await import('../src/scheduler.js');
  const { getSettings } = await import('../src/db/tenant.js');
  const s = getSettings(dbA);
  const p = previewParts(s, buildReminderVars(s, reminders.get(dbA, rem.id)), { clinicId: clinicA, optOutToken: ownerToken, bodyOverride: body });
  assert.equal(p.full, msg);

  const row = auditRows(clinicA).at(-1);
  assert.equal(row.entity_id, String(rem.id));
  const meta = JSON.parse(row.meta);
  assert.equal(meta.edited, true);
  assert.equal(meta.new_length, body.length);
  assert.ok(meta.original_length > 0);
  assert.equal(meta.ok, true);
  assert.ok(meta.segments >= 1 && ['gsm7', 'ucs2'].includes(meta.encoding));
  const all = JSON.stringify(master.prepare('SELECT * FROM audit_log').all());
  assert.ok(!all.includes('5321110006'), 'telefon denetim kaydında geçmemeli');
  assert.ok(!all.includes('bekliyoruz'), 'gövde denetim kaydında geçmemeli');
});

test('önizleme GET ile gösterilen tam metin, gövde düzenlenmeden gönderilenle aynıdır', async () => {
  const { rem, csrf } = await quick(a, { phone: '05321110007' });
  const page = await a.get(`/hatirlatmalar/${rem.id}/onizle`);
  const shown = fullOf(page.text);
  const original = unescapeHtml(/data-original="([^"]*)"/.exec(page.text)[1]);
  const r = await a.post(`/hatirlatmalar/${rem.id}/gonder`, { _csrf: csrf, body: original });
  assert.match(r.location, /ok=/);
  assert.equal(sent.at(-1).message, shown);
  assert.equal(JSON.parse(auditRows(clinicA).at(-1).meta).edited, false);
});

test('geçersiz gövde 400 + önizleme; gönderim olmaz (sahte kuyruk, boş, kontrol karakteri, uzun)', async () => {
  const { rem, csrf } = await quick(a, { phone: '05321110008' });
  for (const body of ['MERSIS:1 Iptal: x', '   ', 'Merhaba\nyeni satır', 'a'.repeat(400)]) {
    const n = sent.length;
    const r = await a.post(`/hatirlatmalar/${rem.id}/gonder`, { _csrf: csrf, body });
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.match(r.text, /data-sms-body/);
    assert.equal(sent.length, n);
    assert.equal(reminders.get(dbA, rem.id).status, 'pending');
  }
  const r = await a.post(`/hatirlatmalar/${rem.id}/gonder`, { _csrf: csrf, body: 'MERSIS:1 Iptal: x' });
  assert.match(r.text, /MERSIS:1 Iptal: x<\/textarea>/, 'kullanıcının metni korunur');
});

test('opt-out sahibine ve demo numaraya gönderim engellenir; önizlemede düğme devre dışı', async () => {
  const off = await quick(a, { phone: '05321110009', optIn: '0' });
  let page = await a.get(`/hatirlatmalar/${off.rem.id}/onizle`);
  assert.match(page.text, /sms-preview-blockers/);
  assert.match(page.text, /type="submit" disabled/);
  const n = sent.length;
  let r = await a.post(`/hatirlatmalar/${off.rem.id}/gonder`, { _csrf: off.csrf, body: 'Merhaba' });
  assert.match(r.location, /err=/);
  assert.equal(sent.length, n);

  const demo = await quick(a, { phone: '05151234567' });
  page = await a.get(`/hatirlatmalar/${demo.rem.id}/onizle`);
  assert.match(page.text, /demo numarası/);
  assert.match(page.text, /type="submit" disabled/);
  r = await a.post(`/hatirlatmalar/${demo.rem.id}/gonder`, { _csrf: demo.csrf, body: 'Merhaba' });
  assert.equal(sent.length, n, 'demo numara sağlayıcıya gitmez');
  const log = dbA.prepare('SELECT provider FROM sms_log WHERE reminder_id = ?').get(demo.rem.id);
  assert.equal(log?.provider, 'demo');
});

test('elle gönderim sınırı: 31. istek 429', async () => {
  limiters.manualSms._hits.clear();
  const csrf = await csrfFor(a);
  for (let i = 0; i < 30; i++) {
    const r = await a.post('/hatirlatmalar/999999/gonder', { _csrf: csrf, body: 'x' });
    assert.equal(r.status, 404);
  }
  const r = await a.post('/hatirlatmalar/999999/gonder', { _csrf: csrf, body: 'x' });
  assert.equal(r.status, 429);
  limiters.manualSms._hits.clear();
});
