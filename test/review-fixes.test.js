/**
 * Adversarial inceleme sonrası yapılan düzeltmelerin regresyon testleri.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupEnv, createClient, startApp, createSuperadmin, login, csrfFor, csrfOf,
  createClinicViaHttp, loginAndChangePassword, logout, resetLoginLimiter,
  LEGAL_SETTINGS,
} from './helpers.js';

setupEnv();
const { parseCsv, detectDelimiter } = await import('../src/csv.js');
const { nextDueDate, sendReminderSms } = await import('../src/scheduler.js');
const { PROVIDERS } = await import('../src/sms/index.js');
const { dispatch } = await import('../src/sms/dispatch.js');
const { clinics } = await import('../src/db/master.js');
const { openTenant, setSetting, getSettings, owners, pets, reminders, smsLog } = await import('../src/db/tenant.js');
const { randomId } = await import('../src/crypto.js');
const { addDays, todayLocal } = await import('../src/util.js');

const enc = (s) => new TextEncoder().encode(s);

/* ---------- CSV ---------- */
test('csv: kapatılmamış tırnak hata verir, veri sessizce yutulmaz', () => {
  assert.throws(() => parseCsv(enc('Ad;Tel\n"Ali;0532\nVeli;0533\n')), /kapatılmamış tırnak/);
});

test('csv: virgüllü dosyada hücre içi noktalı virgüller ayracı yanıltmaz', () => {
  const text = 'Ad,Telefon,Asilar\nAli,05321234560,karma; kuduz; ic parazit\nVeli,05321234561,karma; kuduz\n';
  assert.equal(detectDelimiter(text), ',');
  const r = parseCsv(enc(text));
  assert.deepEqual(r.headers, ['Ad', 'Telefon', 'Asilar']);
  assert.equal(r.rows[0][2], 'karma; kuduz; ic parazit');
});

test('csv: tırnak içinde CRLF satır sonu olan hücre çökmez (Excel adres/not sütunu)', () => {
  const r = parseCsv(enc('Ad;Not\r\nAli;"iki\r\nsatir"\r\nVeli;x\r\n'));
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[0][1], 'iki\r\nsatir');
  assert.deepEqual(r.lines, [2, 4]);
});

test('csv: satır numaraları boş satır ve çok satırlı hücreyi hesaba katar', () => {
  const r = parseCsv(enc('Ad;Tel;Not\nAli;0532;"iki\nsatir"\n\nVeli;0533;x\n'));
  assert.deepEqual(r.lines, [2, 5]);
  assert.equal(r.rows[0][2], 'iki\nsatir');
});

/* ---------- Tekrar zinciri ---------- */
test('nextDueDate: yeni kayıt hemen "bugün gönderilecek" olmaz', () => {
  const today = '2026-09-03';
  const next = nextDueDate('2026-09-06', 1, 30, today);
  assert.ok(addDays(next, -30) > today, `bildirim günü bugünden sonra olmalı: ${next}`);
  assert.equal(nextDueDate('2026-09-06', 365, 1, today), '2027-09-06');
  assert.equal(nextDueDate('2026-09-06', 7, 14, today), '2026-09-20'); // 20-14=06 > 03
});

/* ---------- İleti Merkezi ---------- */
test('iletimerkezi: JSON olmayan HTTP 200 yanıt başarı sayılmaz', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response('<html>bakım</html>', { status: 200, headers: { 'content-type': 'text/html' } });
  try {
    const r = await PROVIDERS.iletimerkezi.send({ to: '905321234567', message: 'x', sender: 'ABC', credentials: { key: 'k', hash: 'h' } });
    assert.equal(r.ok, false);
    assert.match(r.error, /beklenmeyen yanıt/);
  } finally {
    globalThis.fetch = orig;
  }
});

/* ---------- Kilit: tavan yarışı ve çift gönderim ---------- */
function makeClinic() {
  const id = randomId(6);
  clinics.create(id, 'Test ' + id, '', new Date().toISOString());
  const db = openTenant(id);
  for (const [k, v] of Object.entries(LEGAL_SETTINGS)) setSetting(db, k, v); // gönderim kilidi açık
  return { id, db };
}

PROVIDERS.slow = { label: 'slow', fields: [], senderHelp: '', async send() { await new Promise((r) => setTimeout(r, 25)); return { ok: true, ref: 'slow' }; } };
PROVIDERS.bad = { label: 'bad', fields: [], senderHelp: '', async send() { return { ok: false, error: 'sağlayıcı hatası' }; } };

test('günlük tavan eşzamanlı isteklerde aşılmaz', async () => {
  const { id, db } = makeClinic();
  setSetting(db, 'sms_provider', 'slow');
  setSetting(db, 'daily_sms_limit', '1');
  const settings = getSettings(db);
  const results = await Promise.all(Array.from({ length: 5 }, (_, i) =>
    dispatch({ clinicId: id, db, settings, kind: 'test', to: '905321234567', message: 'm' + i, sentBy: 't' })));
  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.equal(results.filter((r) => r.skipped === 'cap').length, 4);
  assert.equal(smsLog.countSince(db, '2000-01-01T00:00:00.000Z'), 1);
});

test('aynı hatırlatma eşzamanlı gönderilirse tek SMS ve tek tekrar kaydı oluşur', async () => {
  const { id, db } = makeClinic();
  setSetting(db, 'sms_provider', 'slow');
  const at = new Date().toISOString();
  const ownerId = owners.create(db, { name: 'Ali', phone: '905321234567', created_at: at });
  const petId = pets.create(db, { owner_id: ownerId, name: 'Boncuk', created_at: at });
  const today = todayLocal();
  const rid = reminders.create(db, { pet_id: petId, type: 'asi', title: 'Karma', due_date: today, notify_days_before: 0, repeat_days: 30, created_at: at });
  const r = reminders.get(db, rid);
  const settings = getSettings(db);
  const [a, b] = await Promise.all([
    sendReminderSms(id, db, settings, r, 'a'),
    sendReminderSms(id, db, settings, r, 'b'),
  ]);
  assert.equal([a, b].filter((x) => x.ok).length, 1);
  assert.equal([a, b].filter((x) => x.skipped === 'state').length, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM sms_log WHERE reminder_id = ?').get(rid).c, 1);
  assert.equal(reminders.get(db, rid).status, 'sent');
  const children = db.prepare(`SELECT * FROM reminders WHERE pet_id = ? AND id != ? AND status = 'pending'`).all(petId, rid);
  assert.equal(children.length, 1);
  assert.ok(addDays(children[0].due_date, 0) > today);
});

test('kalıcı başarısızlık tekrar serisini bitirmez; failed listesi panelde görünür', async () => {
  const { id, db } = makeClinic();
  setSetting(db, 'sms_provider', 'bad');
  const at = new Date().toISOString();
  const ownerId = owners.create(db, { name: 'Ali', phone: '905321234568', created_at: at });
  const petId = pets.create(db, { owner_id: ownerId, name: 'Pati', created_at: at });
  const today = todayLocal();
  const rid = reminders.create(db, { pet_id: petId, type: 'asi', title: 'Kuduz', due_date: today, notify_days_before: 0, repeat_days: 365, created_at: at });
  const settings = getSettings(db);
  for (let i = 0; i < 3; i++) await sendReminderSms(id, db, settings, reminders.get(db, rid), 'z');
  assert.equal(reminders.get(db, rid).status, 'failed');
  const child = db.prepare(`SELECT * FROM reminders WHERE pet_id = ? AND id != ?`).get(petId, rid);
  assert.ok(child, 'tekrar kaydı oluşmalı');
  assert.equal(child.due_date, addDays(today, 365));
  assert.equal(reminders.failedList(db).length, 1);
  // aynı tarihli ikinci bir çocuk oluşmasın
  assert.equal(db.prepare(`SELECT COUNT(*) AS c FROM reminders WHERE pet_id = ?`).get(petId).c, 2);
});

/* ---------- HTTP ---------- */
let app;
after(async () => { if (app) await app.close(); });

test('HTTP düzeltmeleri', async (t) => {
  app = await startApp();
  await resetLoginLimiter();
  await createSuperadmin('root@test.local', 'Root12345');

  await t.test('JSON gövdeli POST /giris 500 değil 403 döner', async () => {
    const res = await fetch(app.base + '/giris', { method: 'POST', headers: { 'content-type': 'application/json', origin: app.base }, body: JSON.stringify({ email: 'a@b.co' }), redirect: 'manual' });
    assert.equal(res.status, 403);
  });

  await t.test('anonim bilinmeyen yol 404, statik eksik dosya 404', async () => {
    const c = createClient(app.base);
    assert.equal((await c.get('/yok-boyle-sayfa')).status, 404);
    assert.equal((await c.get('/static/yok.css')).status, 404);
    assert.equal((await c.get('/sahipler')).status, 302); // klinik yolu -> giriş duvarı
  });

  const root = createClient(app.base);
  await login(root, 'root@test.local', 'Root12345');
  await t.test('süper yönetici için bilinmeyen yol 404', async () => {
    assert.equal((await root.get('/admin/yok')).status, 404);
    assert.equal((await root.get('/yok')).status, 404);
  });

  const { id: clinicId } = await createClinicViaHttp(root, { name: 'Kaçış Kliniği', adminEmail: 'vet@test.local', adminPassword: 'Gecici123' });
  await logout(root);

  const admin = createClient(app.base);
  await loginAndChangePassword(admin, 'vet@test.local', 'Gecici123', 'Kalici1234');

  await t.test('kullanıcı adındaki HTML üst çubukta kaçışlanır', async () => {
    const csrf = await csrfFor(admin, '/kullanicilar');
    const r = await admin.post('/kullanicilar', { _csrf: csrf, name: '<img src=x onerror=alert(1)>Ali', email: 'xss@test.local', password: 'Staff1234', role: 'staff' });
    assert.equal(r.status, 302);
    const staff = createClient(app.base);
    await loginAndChangePassword(staff, 'xss@test.local', 'Staff1234', 'Staff12345');
    const page = await staff.get('/');
    assert.equal(page.status, 200);
    assert.ok(page.text.includes('&lt;img src=x onerror=alert(1)&gt;Ali'));
    assert.ok(!page.text.includes('<img src=x onerror'));
  });

  await t.test('hızlı kayıt doğrulama hatasında onay kutuları kullanıcının seçimini korur', async () => {
    const csrf = await csrfFor(admin, '/hizli-kayit');
    const r = await admin.post('/hizli-kayit', { _csrf: csrf, owner_name: 'Deneme', phone: '05329998877', species: 'Kedi', pet_name: '' });
    assert.equal(r.status, 400);
    assert.match(r.text, /name="sms_opt_in" value="1"\s*>/);
    assert.match(r.text, /name="add_reminder" value="1"\s*>/);
    assert.doesNotMatch(r.text, /name="sms_opt_in" value="1" checked/);
  });

  await t.test('tarih değişince gönderilmiş hatırlatma yeniden beklemeye alınır', async () => {
    const today = todayLocal();
    let csrf = await csrfFor(admin, '/hizli-kayit');
    let r = await admin.post('/hizli-kayit', { _csrf: csrf, owner_name: 'Mehmet', phone: '05321112233', pet_name: 'Zeytin', species: 'Köpek', add_reminder: '1', type: 'asi', title: 'Karma', due_date: today, notify_days_before: '0', sms_opt_in: '1' });
    assert.equal(r.status, 302);
    const db = openTenant(clinicId);
    const rem = db.prepare('SELECT * FROM reminders ORDER BY id DESC LIMIT 1').get();
    r = await admin.post(`/hatirlatmalar/${rem.id}/gonder`, { _csrf: csrf });
    assert.ok(String(r.location).includes('ok='), r.location);
    assert.equal(reminders.get(db, rem.id).status, 'sent');
    r = await admin.post(`/hatirlatmalar/${rem.id}/duzenle`, { _csrf: csrf, type: 'asi', title: 'Karma', due_date: addDays(today, 10), notify_days_before: '1' });
    assert.equal(r.status, 302);
    const after2 = reminders.get(db, rem.id);
    assert.equal(after2.status, 'pending');
    assert.equal(after2.sent_at, null);
  });

  await t.test('başarılı giriş IP sayacını sıfırlamaz', async () => {
    await resetLoginLimiter();
    const c = createClient(app.base);
    for (let i = 0; i < 7; i++) {
      const r = await login(c, `kurban${i}@test.local`, 'Yanlis123');
      assert.equal(r.status, 401);
    }
    const ok = await login(c, 'root@test.local', 'Root12345');
    assert.equal(ok.status, 302);
    await logout(c);
    const eighth = await login(c, 'kurban9@test.local', 'Yanlis123');
    assert.equal(eighth.status, 401);
    const ninth = await login(c, 'kurban10@test.local', 'Yanlis123');
    assert.equal(ninth.status, 429);
    await resetLoginLimiter();
  });
});
