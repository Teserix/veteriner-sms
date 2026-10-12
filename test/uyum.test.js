/**
 * Mevzuat uyumu uçtan uca: oturumsuz hukuki sayfalar, SMS ret bağlantısı, panelden ret,
 * ilgili kişi başvuruları, veri dışa aktarma/anonimleştirme, ihlal kaydı, şifreli yedek.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  setupEnv, createClient, startApp, createSuperadmin, login, csrfFor, csrfOf,
  createClinicViaHttp, loginAndChangePassword, logout, resetLoginLimiter, acceptLegal, LEGAL_SETTINGS,
} from './helpers.js';

const dataDir = setupEnv({ BACKUP_KEY: 'test-backup-key-0123456789abcdef0123456789', BACKUP_SECONDARY_DIR: '' });
const { openTenant, owners, pets, consents, smsLog, subjectRequests, getSettings } = await import('../src/db/tenant.js');
const { breaches, auditLog, clinics } = await import('../src/db/master.js');
const { decryptFile } = await import('../src/backup.js');
const { nowIso } = await import('../src/util.js');

let app, c, clinicId, ownerId, optOutToken;
const flashErr = (r) => new URLSearchParams(new URL(r.location, 'http://x').search).get('err') || '';
const SA = 'root@example.com', SA_PASS = 'Root12345';
const ADMIN = 'vet@pati.test', TEMP = 'Gecici123', NEW = 'YeniSifre123';

before(async () => {
  await createSuperadmin(SA, SA_PASS);
  app = await startApp();
  c = createClient(app.base);
  await resetLoginLimiter();
  await login(c, SA, SA_PASS);
  ({ id: clinicId } = await createClinicViaHttp(c, { name: 'Uyum Kliniği', phone: '0212 555 00 00', adminEmail: ADMIN, adminPassword: TEMP }));
  await logout(c);
  await loginAndChangePassword(c, ADMIN, TEMP, NEW);
});

after(async () => { await app?.close(); }); // before() düşerse asıl hatayı gizlemesin

test('oturumsuz hukuki sayfalar 200 döner, footer bağlantıları var, şablon belgesi doğrudan açılamaz', async () => {
  const anon = createClient(app.base);
  for (const slug of ['kullanim-kosullari', 'abonelik-sozlesmesi', 'veri-isleyen-eki', 'aydinlatma-teserix', 'cerez']) {
    const r = await anon.get('/belgeler/' + slug);
    assert.equal(r.status, 200, slug);
    assert.ok(r.text.includes('SHA-256'));
  }
  assert.equal((await anon.get('/belgeler/aydinlatma-klinik-sablon')).status, 404);
  assert.equal((await anon.get('/belgeler/../../etc/passwd')).status, 404);
  const contact = await anon.get('/iletisim');
  assert.equal(contact.status, 200);
  assert.ok(contact.text.includes('5651'));
  assert.ok(contact.text.includes('/belgeler/cerez'), 'footer bağlantısı');
});

test('kliniğin aydınlatma metni kısa adla açılır ve klinik bilgileriyle dolar', async () => {
  const anon = createClient(app.base);
  const clinic = clinics.get(clinicId);
  assert.match(clinic.public_slug, /^[a-f0-9]{12}$/);
  const r = await anon.get('/aydinlatma/' + clinic.public_slug);
  assert.equal(r.status, 200);
  assert.ok(r.text.includes('Uyum Kliniği'));
  assert.ok(r.text.includes('MERSİS: 0123456789012345'));
  assert.ok(r.text.includes('KVKK'));
  assert.equal((await anon.get('/aydinlatma/' + clinicId)).status, 404, 'klinik kimliği kısa ad olarak kullanılamaz');
  assert.equal((await anon.get('/aydinlatma/zzzzzzzzzzzz')).status, 404);
});

test('sahip oluşturma tercih olayı yazar; SMS gönderimi ret bağlantısı içerir', async () => {
  const csrf = await csrfFor(c, '/sahipler/yeni');
  let r = await c.post('/sahipler/yeni', { _csrf: csrf, name: 'Mehmet Kaya', phone: '0532 123 45 67', email: '', address: 'Kadıköy', notes: '', sms_opt_in: '1', consent_channel: 'sozlu' });
  assert.equal(r.status, 302);
  ownerId = Number(/\/sahipler\/(\d+)/.exec(r.location)[1]);
  const db = openTenant(clinicId);
  const o = owners.get(db, ownerId);
  assert.equal(o.address, 'Kadıköy');
  assert.match(o.opt_out_token, /^[a-f0-9]{32}$/);
  optOutToken = o.opt_out_token;
  const ev = consents.history(db, ownerId);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].action, 'grant');
  assert.equal(ev[0].channel, 'sozlu');
  assert.equal(ev[0].actor_email, ADMIN);

  // hayvan (mikroçip doğrulaması) + hatırlatma + elle gönderim
  r = await c.post(`/sahipler/${ownerId}/hayvan/yeni`, { _csrf: csrf, name: 'Boncuk', species: 'Kedi', microchip_no: '12345' });
  assert.equal(r.status, 400);
  assert.ok(r.text.includes('15 haneli'));
  r = await c.post(`/sahipler/${ownerId}/hayvan/yeni`, { _csrf: csrf, name: 'Boncuk', species: 'Kedi', microchip_no: '900123456789012' });
  assert.equal(r.status, 302);
  const petId = pets.byOwner(db, ownerId)[0].id;
  assert.equal(pets.byOwner(db, ownerId)[0].microchip_no, '900123456789012');
  // reklam içeren başlık reddedilir
  r = await c.post(`/hayvanlar/${petId}/hatirlatma/yeni`, { _csrf: csrf, type: 'asi', title: 'İndirimli aşı', due_date: '2030-01-10', notify_days_before: '1' });
  assert.equal(r.status, 400);
  r = await c.post(`/hayvanlar/${petId}/hatirlatma/yeni`, { _csrf: csrf, type: 'asi', title: 'Kuduz aşısı', due_date: '2030-01-10', notify_days_before: '1' });
  assert.equal(r.status, 302);
  const reminderId = db.prepare('SELECT id FROM reminders ORDER BY id DESC LIMIT 1').get().id;
  r = await c.post(`/hatirlatmalar/${reminderId}/gonder`, { _csrf: csrf });
  // test ortamında SMS_MODE live değil: simüle edilir (metin yine aynı kuyrukla üretilip sms_log'a 'simulated' yazılır)
  assert.ok(r.location.includes('err=') && decodeURIComponent(r.location.replace(/\+/g, ' ')).includes('simüle'), r.location);
  const log = smsLog.allByOwner(db, ownerId)[0];
  assert.equal(log.status, 'simulated');
  assert.ok(log.message.startsWith('Bilgilendirme: '), log.message);
  assert.ok(log.message.includes('MERSIS:0123456789012345'));
  assert.ok(log.message.includes(`/ret/${clinicId}.${optOutToken}`));
  assert.equal(log.legal_basis, 'm6_1');
});

test('SMS ret bağlantısı: oturumsuz, ön belirteçle, tek tıkla; sonra gönderim durur', async () => {
  const anon = createClient(app.base);
  const url = `/ret/${clinicId}.${optOutToken}`;
  let r = await anon.get(url);
  assert.equal(r.status, 200);
  assert.ok(r.text.includes('Uyum Kliniği'));
  const pre = csrfOf(r.text);
  assert.ok(pre);
  // belirteçsiz POST 403
  const other = createClient(app.base);
  assert.equal((await other.post(url, { _csrf: 'x' })).status, 403);
  r = await anon.post(url, { _csrf: pre });
  assert.equal(r.status, 200);
  assert.ok(r.text.includes('durduruldu'));
  const db = openTenant(clinicId);
  assert.equal(owners.get(db, ownerId).sms_opt_in, 0);
  const last = consents.last(db, ownerId);
  assert.equal(last.action, 'revoke');
  assert.equal(last.channel, 'ret_url');
  assert.ok(last.ip);
  assert.ok(auditLog.recent(20, clinicId).some((a) => a.action === 'consent.revoke'));
  // yeniden açılış: zaten kapalı mesajı
  r = await anon.get(url);
  assert.ok(r.text.includes('zaten kapalı'));
  // geçersiz belirteçler 404
  assert.equal((await anon.get(`/ret/${clinicId}.${'0'.repeat(32)}`)).status, 404);
  assert.equal((await anon.get('/ret/abc')).status, 404);
  // elle gönderim artık opt-out
  const csrf = await csrfFor(c, '/sahipler');
  const reminderId = db.prepare('SELECT id FROM reminders ORDER BY id DESC LIMIT 1').get().id;
  r = await c.post(`/hatirlatmalar/${reminderId}/gonder`, { _csrf: csrf });
  assert.ok(decodeURIComponent(r.location).includes('istemiyor'), r.location);
});

test('panelden yeniden açma ve ret (personel dahil) tercih olayı yazar', async () => {
  const db = openTenant(clinicId);
  const csrf = await csrfFor(c, `/sahipler/${ownerId}/duzenle`);
  let r = await c.post(`/sahipler/${ownerId}/duzenle`, { _csrf: csrf, name: 'Mehmet Kaya', phone: '0532 123 45 67', sms_opt_in: '1', consent_channel: 'yazili' });
  assert.equal(r.status, 302);
  assert.equal(owners.get(db, ownerId).sms_opt_in, 1);
  assert.equal(consents.last(db, ownerId).channel, 'yazili');
  r = await c.post(`/sahipler/${ownerId}/ret`, { _csrf: csrf, channel: 'telefon', note: 'aradı' });
  assert.equal(r.status, 302);
  assert.equal(owners.get(db, ownerId).sms_opt_in, 0);
  const last = consents.last(db, ownerId);
  assert.equal(last.channel, 'telefon');
  assert.equal(last.note, 'aradı');
  const page = await c.get(`/sahipler/${ownerId}`);
  assert.ok(page.text.includes('SMS tercihi geçmişi'));
  assert.ok(auditLog.recent(50, clinicId).some((a) => a.action === 'owner.view'), 'erişim kaydı');
});

test('ilgili kişi başvurusu: 30 günlük süre, nav sayacı, kapatma', async () => {
  const csrf = await csrfFor(c, '/basvurular');
  let r = await c.post('/basvurular', { _csrf: csrf, applicant_name: 'Mehmet Kaya', applicant_phone: '05321234567', owner_id: String(ownerId), kind: 'erisim', channel: 'yazili', received_at: '2026-09-01', note: 'verilerimi istiyorum' });
  assert.equal(r.status, 302);
  assert.ok(decodeURIComponent(r.location).includes('01.10.2026'), r.location);
  const db = openTenant(clinicId);
  const list = subjectRequests.list(db);
  assert.equal(list.length, 1);
  assert.equal(list[0].due_at, '2026-10-01');
  assert.equal(list[0].status, 'acik');
  r = await c.get('/');
  assert.match(r.text, /KVKK başvuruları<\/span><span class="nav-count" aria-label="1 açık">1<\/span>/);
  r = await c.post(`/basvurular/${list[0].id}/kapat`, { _csrf: csrf, status: 'kapali' });
  assert.equal(r.status, 302);
  assert.equal(subjectRequests.get(db, list[0].id).status, 'kapali');
  assert.equal(subjectRequests.openCount(db), 0);
  // eksik alan
  r = await c.post('/basvurular', { _csrf: csrf, applicant_name: '', kind: 'silme', channel: 'kep', received_at: '2026-09-01' });
  assert.ok(r.location.includes('err='));
});

test('veri dışa aktarma (JSON/CSV) ve anonimleştirme; personel dışa aktaramaz', async () => {
  let r = await c.get(`/sahipler/${ownerId}/veri.json`);
  assert.equal(r.status, 200);
  const bundle = JSON.parse(r.text);
  assert.equal(bundle.owner.name, 'Mehmet Kaya');
  assert.equal(bundle.owner.opt_out_token, undefined, 'ret belirteci dışa verilmez');
  assert.equal(bundle.pets.length, 1);
  assert.equal(bundle.sms_log.length, 1);
  assert.ok(bundle.consent_events.length >= 3);
  r = await c.get(`/sahipler/${ownerId}/veri.csv`);
  assert.equal(r.status, 200);
  assert.ok(r.text.includes('Sahip;name;Mehmet Kaya'));
  assert.ok(auditLog.recent(50, clinicId).filter((a) => a.action === 'owner.export').length >= 2);

  const csrf = await csrfFor(c, '/sahipler');
  r = await c.post(`/sahipler/${ownerId}/anonimlestir`, { _csrf: csrf });
  assert.equal(r.status, 302);
  const db = openTenant(clinicId);
  const o = owners.get(db, ownerId);
  assert.equal(o.name, '[silindi]');
  assert.equal(pets.byOwner(db, ownerId).length, 0);
  const log = smsLog.allByOwner(db, ownerId)[0];
  assert.equal(log.message, '[anonim]');
  assert.equal(log.phone, '');
  assert.ok(log.anonymized_at);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM imha_log').get().c, 1);
  r = await c.get(`/sahipler/${ownerId}`);
  assert.ok(r.text.includes('anonimleştirilmiş'));

  // silme: sms_log kalıntısı anonim
  const o2 = owners.create(db, { name: 'Silinecek', phone: '905329999999', created_at: nowIso() });
  smsLog.add(db, { owner_id: o2, phone: '905329999999', message: 'gizli', provider: 'console', status: 'sent', created_at: nowIso(), owner_name: 'Silinecek', kind: 'reminder' });
  r = await c.post(`/sahipler/${o2}/sil`, { _csrf: csrf });
  assert.equal(r.status, 302);
  assert.equal(owners.get(db, o2), undefined);
  assert.equal(db.prepare('SELECT message, owner_name FROM sms_log WHERE owner_id = ?').get(o2).message, '[anonim]');
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM imha_log').get().c, 2);
});

test('ayarlar: hukuki kimlik doğrulaması, m.6/1 beyanı tek seferlik, saklama süresi alt sınırı', async () => {
  let r = await c.get('/ayarlar');
  const csrf = csrfOf(r.text);
  assert.ok(r.text.includes('Beyan verildi'));
  assert.ok(r.text.includes('/aydinlatma/'));
  assert.ok(r.text.includes('Abonelik Sözleşmesi'), 'kabul edilen sözleşme listelenir');
  const base = { _csrf: csrf, clinic_name: 'Uyum Kliniği', clinic_phone: '0212 555 00 00', template: 'Sayın {sahip}, {hayvan} {tarih} {tur}', scheduler_enabled: '1', send_hour_start: '9', send_hour_end: '20', daily_sms_limit: '200', sms_provider: 'console', sms_sender: '' };
  r = await c.post('/ayarlar', { ...base, legal_form: 'tacir', mersis_no: '12' });
  assert.ok(flashErr(r).includes('16 haneli'), r.location);
  r = await c.post('/ayarlar', { ...base, legal_form: 'esnaf', tax_id: '12', ruhsat_isim: 'X' });
  assert.ok(flashErr(r).includes('haneli'), r.location);
  r = await c.post('/ayarlar', { ...base, legal_form: 'tacir', mersis_no: '0123456789012345', retention_sms_days: '5', kvkk_contact_email: 'kvkk@pati.test' });
  assert.ok(r.location.includes('ok='));
  const s = getSettings(openTenant(clinicId));
  assert.equal(s.retention_sms_days, '1095');
  assert.equal(s.kvkk_contact_email, 'kvkk@pati.test');
  assert.equal(s.m61_declared_at, LEGAL_SETTINGS.m61_declared_at, 'beyan tarihi yeniden yazılmaz');
});

test('süper yönetici: ihlal kaydı ve 72 saat bildirim takibi', async () => {
  await logout(c);
  await resetLoginLimiter();
  await login(c, SA, SA_PASS);
  let r = await c.get('/admin/ihlaller');
  assert.equal(r.status, 200);
  const csrf = csrfOf(r.text);
  r = await c.post('/admin/ihlaller', { _csrf: csrf, clinic_id: clinicId, detected_at: '2026-09-10T10:00', source: 'Yedek diski kayboldu', affected_count: '120', categories: 'kimlik, iletişim' });
  assert.equal(r.status, 302);
  const list = breaches.all();
  assert.equal(list.length, 1);
  assert.equal(list[0].affected_count, 120);
  r = await c.post(`/admin/ihlaller/${list[0].id}/bildirim`, { _csrf: csrf, target: 'kurul' });
  assert.equal(r.status, 302);
  assert.ok(breaches.get(list[0].id).kurul_notified_at);
  r = await c.get('/admin/ihlaller');
  assert.ok(r.text.includes('Yedek diski kayboldu'));
  // klinik detayında kabul kayıtları
  r = await c.get(`/admin/klinik/${clinicId}`);
  assert.ok(r.text.includes('abonelik-sozlesmesi'));
  assert.ok(r.text.includes('/aydinlatma/'));
});

test('şifreli yedek: ikinci hedefe .enc yazılır, çözülür ve bütünlük korunur', async () => {
  const { config } = await import('../src/config.js');
  const { runBackup } = await import('../src/backup.js');
  const secondary = path.join(dataDir, 'yedek-dis');
  config.backupSecondaryDir = secondary;
  const r = runBackup(new Date());
  assert.ok(r.secondary.copied >= 2, JSON.stringify(r.secondary));
  const day = fs.readdirSync(secondary).find((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  const enc = path.join(secondary, day, 'tenants', `${clinicId}.db.enc`);
  assert.ok(fs.existsSync(enc));
  assert.equal(fs.readFileSync(enc).subarray(0, 5).toString(), 'VSBK1');
  assert.ok(!fs.readFileSync(enc).includes(Buffer.from('SQLite format 3')), 'düz metin sızmaz');
  const out = path.join(dataDir, 'restored.db');
  decryptFile(enc, out);
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(out, { readOnly: true });
  assert.equal(Object.values(db.prepare('PRAGMA integrity_check').get())[0], 'ok');
  assert.ok(db.prepare('SELECT COUNT(*) AS c FROM owners').get().c >= 1);
  db.close();
  const crypto = await import('node:crypto');
  assert.throws(() => decryptFile(enc, out + '2', crypto.createHash('sha256').update('baska').digest()));
  // anahtar yokken ikinci hedef atlanır, birincil yedek yine alınır
  config.backupKey = '';
  assert.equal(runBackup(new Date()).secondary.skipped, 'anahtar-yok');
  config.backupSecondaryDir = '';
});

test('personel sözleşme kapısından etkilenmez, dışa aktarma/anonimleştirme yapamaz', async () => {
  await logout(c);
  await resetLoginLimiter();
  // personel oluştur (yönetici olarak)
  await login(c, ADMIN, NEW);
  let csrf = await csrfFor(c, '/kullanicilar');
  let r = await c.post('/kullanicilar', { _csrf: csrf, name: 'Personel', email: 'staff@pati.test', role: 'staff', password: 'Staff1234' });
  assert.equal(r.status, 302, r.text.slice(0, 200));
  await logout(c);
  await resetLoginLimiter();
  await loginAndChangePassword(c, 'staff@pati.test', 'Staff1234', 'Staff12345');
  r = await c.get('/');
  assert.equal(r.status, 200, 'personel kapıya takılmaz');
  csrf = csrfOf(r.text);
  assert.equal((await c.get(`/sahipler/${ownerId}/veri.json`)).status, 403);
  assert.equal((await c.post(`/sahipler/${ownerId}/anonimlestir`, { _csrf: csrf })).status, 403);
  assert.equal((await c.get('/sozlesme')).status, 403);
});
