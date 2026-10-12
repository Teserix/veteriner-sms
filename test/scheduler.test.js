import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupEnv, LEGAL_SETTINGS } from './helpers.js';

setupEnv();
const { clinics, auditLog } = await import('../src/db/master.js');
const { openTenant, closeAll, setSetting, getSettings, owners, pets, reminders, smsLog } = await import('../src/db/tenant.js');
const { processClinic, sendReminderSms } = await import('../src/scheduler.js');
const { randomId } = await import('../src/crypto.js');
const { addDays, nowIso, nowLocal } = await import('../src/util.js');

// Sabit "şimdi": 2026-09-03 09:00Z = İstanbul 12:00 (pencere 9-20 içinde)
const NOW = new Date('2026-09-03T09:00:00Z');
const TODAY = nowLocal(NOW).date; // 2026-09-03

let origLog;
before(() => { origLog = console.log; console.log = () => {}; }); // konsol sağlayıcısının çıktısını sustur
after(() => { console.log = origLog; closeAll(); });

function newClinic(settings = {}) {
  const id = randomId(6);
  clinics.create(id, 'Test Klinik ' + id, '0212', nowIso());
  const db = openTenant(id);
  setSetting(db, 'clinic_name', 'Test Klinik');
  setSetting(db, 'clinic_phone', '0212 555');
  for (const [k, v] of Object.entries(LEGAL_SETTINGS)) setSetting(db, k, v);
  setSetting(db, 'clinic_phone', '0212 555');
  for (const [k, v] of Object.entries(settings)) setSetting(db, k, v);
  return { id, db };
}

function addCase(db, { optIn = 1, due = TODAY, notify = 0, repeat = null, phone = '905321234567', name = 'Mehmet Kaya' } = {}) {
  const at = nowIso();
  const ownerId = owners.create(db, { name, phone, sms_opt_in: optIn, created_at: at });
  const petId = pets.create(db, { owner_id: ownerId, name: 'Boncuk', species: 'Kedi', created_at: at });
  const reminderId = reminders.create(db, { pet_id: petId, type: 'asi', title: 'Kuduz', due_date: due, notify_days_before: notify, repeat_days: repeat, created_at: at });
  return { ownerId, petId, reminderId };
}

const smsRows = (db) => db.prepare('SELECT * FROM sms_log ORDER BY id').all();
const capRows = (clinicId) => auditLog.recent(500, clinicId).filter((r) => r.action === 'sms.cap');

describe('processClinic', () => {
  test('bugün vadesi gelen (notify 0) gönderilir', async () => {
    const { id, db } = newClinic();
    const { reminderId, ownerId, petId } = addCase(db, { due: TODAY, notify: 0 });
    const res = await processClinic(id, NOW);
    assert.deepEqual(res, { sent: 1, failed: 0, skipped: 0 });
    const r = reminders.get(db, reminderId);
    assert.equal(r.status, 'sent');
    assert.ok(r.sent_at);
    assert.equal(r.attempts, 1);
    const rows = smsRows(db);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].kind, 'reminder');
    assert.equal(rows[0].status, 'sent');
    assert.equal(rows[0].provider, 'console');
    assert.equal(rows[0].reminder_id, reminderId);
    assert.equal(rows[0].owner_id, ownerId);
    assert.equal(rows[0].pet_id, petId);
    assert.equal(rows[0].sent_by, 'zamanlayici');
    assert.ok(rows[0].message.includes('Mehmet Kaya') && rows[0].message.includes('03.09.2026'));
    // ikinci çalıştırma tekrar göndermez
    assert.deepEqual(await processClinic(id, NOW), { sent: 0, failed: 0, skipped: 0 });
    assert.equal(smsRows(db).length, 1);
  });

  test('bildirim günü gelince (notify N gün önce) gönderilir', async () => {
    const { id, db } = newClinic();
    const { reminderId } = addCase(db, { due: addDays(TODAY, 3), notify: 3 });
    assert.equal((await processClinic(id, NOW)).sent, 1);
    assert.equal(reminders.get(db, reminderId).status, 'sent');
  });

  test('5 gün sonra vadeli (notify 1) gönderilmez', async () => {
    const { id, db } = newClinic();
    const { reminderId } = addCase(db, { due: addDays(TODAY, 5), notify: 1 });
    assert.deepEqual(await processClinic(id, NOW), { sent: 0, failed: 0, skipped: 0 });
    assert.equal(reminders.get(db, reminderId).status, 'pending');
    assert.equal(smsRows(db).length, 0);
    assert.equal(reminders.due(db, TODAY).length, 0);
    assert.equal(reminders.dueOn(db, addDays(TODAY, 4)).length, 1);
  });

  test('8 gün önce vadesi geçmiş bekleyen gönderilmez, overdue listesinde', async () => {
    const { id, db } = newClinic();
    const { reminderId } = addCase(db, { due: addDays(TODAY, -8), notify: 0 });
    assert.deepEqual(await processClinic(id, NOW), { sent: 0, failed: 0, skipped: 0 });
    assert.equal(reminders.get(db, reminderId).status, 'pending');
    assert.equal(smsRows(db).length, 0);
    assert.equal(reminders.due(db, TODAY).length, 0);
    const overdue = reminders.overdue(db, TODAY);
    assert.equal(overdue.length, 1);
    assert.equal(overdue[0].id, reminderId);
    // 3 gün sınırı: tam 3 gün önce hâlâ gönderilir, 4 gün önce gönderilmez
    const { db: db2, id: id2 } = newClinic();
    addCase(db2, { due: addDays(TODAY, -3), notify: 0, phone: '905321234501' });
    addCase(db2, { due: addDays(TODAY, -4), notify: 0, phone: '905321234502' });
    assert.equal(reminders.due(db2, TODAY).length, 1);
    assert.equal((await processClinic(id2, NOW)).sent, 1);
  });

  test('saat penceresi dışında "saat-disi"', async () => {
    const { id, db } = newClinic();
    const { reminderId } = addCase(db);
    const early = await processClinic(id, new Date('2026-09-03T03:00:00Z')); // 06:00 İstanbul
    assert.equal(early.skipped, 'saat-disi');
    assert.equal(early.sent, 0);
    const late = await processClinic(id, new Date('2026-09-03T17:00:00Z')); // 20:00 İstanbul (end hariç)
    assert.equal(late.skipped, 'saat-disi');
    assert.equal(reminders.get(db, reminderId).status, 'pending');
    assert.equal(smsRows(db).length, 0);
    const inWindow = await processClinic(id, new Date('2026-09-03T06:00:00Z')); // 09:00 İstanbul (start dahil)
    assert.equal(inWindow.sent, 1);
  });

  test('zamanlayıcı kapalıysa "kapali"', async () => {
    const { id, db } = newClinic({ scheduler_enabled: '0' });
    addCase(db);
    assert.equal((await processClinic(id, NOW)).skipped, 'kapali');
    assert.equal(smsRows(db).length, 0);
  });

  test('saat dilimi kenarı: 23:30Z = 03. gün 02:30 İstanbul', async () => {
    const edge = new Date('2026-09-02T23:30:00Z');
    assert.deepEqual(nowLocal(edge), { date: '2026-09-03', hour: 2 });
    const { id, db } = newClinic();
    const { reminderId } = addCase(db, { due: '2026-09-03', notify: 0 });
    // varsayılan pencere 9-20: saat 2 dışarıda
    assert.equal((await processClinic(id, edge)).skipped, 'saat-disi');
    assert.equal(reminders.get(db, reminderId).status, 'pending');
    // pencere 0-24: kullanılan gün 2026-09-03 (UTC'ye göre 09-02 olsaydı gönderilmezdi)
    setSetting(db, 'send_hour_start', '0');
    setSetting(db, 'send_hour_end', '24');
    const res = await processClinic(id, edge);
    assert.equal(res.sent, 1);
    assert.equal(reminders.get(db, reminderId).status, 'sent');
  });

  test('sms_opt_in 0 atlanır, sms_log yazılmaz', async () => {
    const { id, db } = newClinic();
    const { reminderId } = addCase(db, { optIn: 0 });
    const res = await processClinic(id, NOW);
    assert.deepEqual(res, { sent: 0, failed: 0, skipped: 1 });
    assert.equal(reminders.get(db, reminderId).status, 'pending');
    assert.equal(reminders.get(db, reminderId).attempts, 0);
    assert.equal(smsRows(db).length, 0);
    // sendReminderSms doğrudan çağrılsa da dispatch opt-out'u durdurur
    const direct = await sendReminderSms(id, db, getSettings(db), reminders.get(db, reminderId), 'test@x');
    assert.equal(direct.ok, false);
    assert.equal(direct.skipped, 'opt-out');
    assert.equal(smsRows(db).length, 0);
    assert.equal(reminders.get(db, reminderId).status, 'pending');
  });

  test('repeat_days 365: sonraki hatırlatma otomatik oluşur', async () => {
    const { id, db } = newClinic();
    const { reminderId, petId } = addCase(db, { due: TODAY, notify: 0, repeat: 365 });
    assert.equal((await processClinic(id, NOW)).sent, 1);
    const all = db.prepare('SELECT * FROM reminders WHERE pet_id = ? ORDER BY id').all(petId);
    assert.equal(all.length, 2);
    assert.equal(all[0].id, reminderId);
    assert.equal(all[0].status, 'sent');
    const next = all[1];
    assert.equal(next.status, 'pending');
    assert.equal(next.due_date, addDays(TODAY, 365));
    assert.equal(next.repeat_days, 365);
    assert.equal(next.notify_days_before, 0);
    assert.equal(next.type, 'asi');
    assert.equal(next.title, 'Kuduz');
    assert.equal(next.created_by, 'tekrar');
    assert.equal(next.attempts, 0);
    // tekrar çalıştırınca yeni olan gönderilmez (1 yıl sonra)
    assert.equal((await processClinic(id, NOW)).sent, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS c FROM reminders').get().c, 2);
  });

  test('tekrarsız hatırlatma yeni kayıt üretmez', async () => {
    const { id, db } = newClinic();
    addCase(db, { repeat: null });
    await processClinic(id, NOW);
    assert.equal(db.prepare('SELECT COUNT(*) AS c FROM reminders').get().c, 1);
  });

  test('günlük tavan: ilk gider, ikinci atlanır ve loglanmaz, tek sms.cap denetim satırı', async () => {
    const { id, db } = newClinic({ daily_sms_limit: '1' });
    const a = addCase(db, { phone: '905321234501', name: 'Birinci' });
    const b = addCase(db, { phone: '905321234502', name: 'Ikinci' });
    const res = await processClinic(id, NOW);
    assert.equal(res.sent, 1);
    assert.equal(res.failed, 0);
    assert.equal(res.skipped, 1);
    assert.equal(smsRows(db).length, 1);
    const statuses = [reminders.get(db, a.reminderId).status, reminders.get(db, b.reminderId).status].sort();
    assert.deepEqual(statuses, ['pending', 'sent']);
    const pending = [a, b].map((x) => reminders.get(db, x.reminderId)).find((r) => r.status === 'pending');
    assert.equal(pending.attempts, 0, 'tavan atlaması deneme sayılmaz');
    assert.equal(pending.last_attempt_at, null);
    assert.equal(capRows(id).length, 1);
    // ikinci ve üçüncü deneme: yine atlanır, sms_log ve denetim değişmez
    assert.deepEqual(await processClinic(id, NOW), { sent: 0, failed: 0, skipped: 1 });
    assert.deepEqual(await processClinic(id, NOW), { sent: 0, failed: 0, skipped: 1 });
    assert.equal(smsRows(db).length, 1);
    assert.equal(capRows(id).length, 1);
    const cap = capRows(id)[0];
    assert.equal(cap.clinic_id, id);
    assert.equal(cap.actor_email, 'sistem');
    assert.deepEqual(JSON.parse(cap.meta), { cap: 1, used: 1 });
    // başka kliniğin denetimine karışmaz
    const { id: other } = newClinic();
    assert.equal(capRows(other).length, 0);
  });

  test('klinik tavanı (master) klinik ayarını sınırlar', async () => {
    const { id, db } = newClinic({ daily_sms_limit: '5000' });
    clinics.update(id, { name: 'X', phone: '', smsDailyCap: 0 });
    addCase(db);
    const res = await processClinic(id, NOW);
    assert.equal(res.sent, 0);
    assert.equal(smsRows(db).length, 0);
    assert.equal(capRows(id).length, 1);
  });
});

describe('hatırlatma deneme sayacı', () => {
  test('markAttemptFailed 3. denemede failed, resetForRetry temizler', () => {
    const { db } = newClinic();
    const { reminderId } = addCase(db);
    const at = nowIso();
    reminders.markAttemptFailed(db, reminderId, at, 'hata 1', 3);
    let r = reminders.get(db, reminderId);
    assert.equal(r.status, 'pending');
    assert.equal(r.attempts, 1);
    assert.equal(r.last_error, 'hata 1');
    assert.equal(r.last_attempt_at, at);
    reminders.markAttemptFailed(db, reminderId, at, 'hata 2', 3);
    r = reminders.get(db, reminderId);
    assert.equal(r.status, 'pending');
    assert.equal(r.attempts, 2);
    reminders.markAttemptFailed(db, reminderId, at, 'hata 3', 3);
    r = reminders.get(db, reminderId);
    assert.equal(r.status, 'failed');
    assert.equal(r.attempts, 3);
    assert.equal(r.last_error, 'hata 3');

    reminders.resetForRetry(db, reminderId);
    r = reminders.get(db, reminderId);
    assert.equal(r.status, 'pending');
    assert.equal(r.attempts, 0);
    assert.equal(r.last_error, null);
    assert.equal(r.last_attempt_at, null);
  });

  test('gerçek gönderim hatası deneme sayısını artırır (geçersiz numara)', async () => {
    const { id, db } = newClinic();
    // normalize edilmemiş numara sendSms tarafından reddedilir -> markAttemptFailed
    const { reminderId } = addCase(db, { phone: '05321234567' });
    const res = await processClinic(id, NOW);
    assert.deepEqual(res, { sent: 0, failed: 1, skipped: 0 });
    const r = reminders.get(db, reminderId);
    assert.equal(r.status, 'pending');
    assert.equal(r.attempts, 1);
    assert.equal(r.last_error, 'Geçersiz telefon numarası');
    // başarısız gönderim de sms_log'a 'failed' olarak düşer
    const rows = smsRows(db);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, 'failed');
    // 4 saat dolmadan tekrar denenmez (last_attempt_at, sabit NOW'a göre 1 saat önce)
    const setLast = (d) => db.prepare('UPDATE reminders SET last_attempt_at = ? WHERE id = ?').run(d.toISOString(), reminderId);
    setLast(new Date(NOW.getTime() - 3600e3));
    assert.deepEqual(await processClinic(id, NOW), { sent: 0, failed: 0, skipped: 1 });
    assert.equal(reminders.get(db, reminderId).attempts, 1);
    assert.equal(smsRows(db).length, 1);
    // 4 saat geçince tekrar denenir
    setLast(new Date(NOW.getTime() - 5 * 3600e3));
    assert.deepEqual(await processClinic(id, NOW), { sent: 0, failed: 1, skipped: 0 });
    assert.equal(reminders.get(db, reminderId).attempts, 2);
    assert.equal(reminders.get(db, reminderId).status, 'pending');
    // 3. deneme -> failed; artık due listesinde değil
    setLast(new Date(NOW.getTime() - 5 * 3600e3));
    assert.deepEqual(await processClinic(id, NOW), { sent: 0, failed: 1, skipped: 0 });
    const r3 = reminders.get(db, reminderId);
    assert.equal(r3.attempts, 3);
    assert.equal(r3.status, 'failed');
    assert.equal(reminders.due(db, TODAY).length, 0);
    assert.deepEqual(await processClinic(id, NOW), { sent: 0, failed: 0, skipped: 0 });
    assert.equal(smsRows(db).length, 3);
    assert.ok(smsRows(db).every((s) => s.status === 'failed'));
  });

  test('kayıtlı body_override geçersizse şablon gönderilmez; deneme sayılır, last_error yazılır, 3. denemede failed', async () => {
    const { id, db } = newClinic();
    const { reminderId, petId } = addCase(db, { repeat: 365 });
    reminders.setBodyOverride(db, reminderId, 'MERSIS:1 Iptal: x'); // kuyruğu taklit eden gövde -> bodyProblems
    const res = await processClinic(id, NOW);
    assert.deepEqual(res, { sent: 0, failed: 1, skipped: 0 });
    assert.equal(smsRows(db).length, 0, 'SMS gönderilmedi');
    let r = reminders.get(db, reminderId);
    assert.equal(r.status, 'pending');
    assert.equal(r.attempts, 1);
    assert.match(r.last_error, /^Kayıtlı düzenlenmiş gövde geçersiz: /);
    assert.ok(r.last_attempt_at, 'deneme zamanı geri alınmadı');
    assert.equal(r.body_override, 'MERSIS:1 Iptal: x', 'kayıtlı gövde sessizce silinmez');
    // 4 saat içinde tekrar denenmez (takılı kalan yeniden deneme döngüsü yok)
    assert.deepEqual(await processClinic(id, NOW), { sent: 0, failed: 0, skipped: 1 });
    // doğrudan çağrı (bodyOverride undefined) da aynı yolu izler
    for (let i = 2; i <= 3; i++) {
      const direct = await sendReminderSms(id, db, getSettings(db), reminders.get(db, reminderId), 'zamanlayici', NOW);
      assert.equal(direct.ok, false);
      assert.equal(direct.skipped, undefined);
      assert.equal(reminders.get(db, reminderId).attempts, i);
    }
    r = reminders.get(db, reminderId);
    assert.equal(r.status, 'failed');
    assert.equal(smsRows(db).length, 0);
    // kalıcı başarısızlık tekrar serisini bitirmez
    const all = db.prepare('SELECT * FROM reminders WHERE pet_id = ? ORDER BY id').all(petId);
    assert.equal(all.length, 2);
    assert.equal(all[1].status, 'pending');
  });

  test('elle verilen geçersiz gövde: deneme sayılmaz, iz geri alınır (skipped invalid)', async () => {
    const { id, db } = newClinic();
    const { reminderId } = addCase(db);
    const res = await sendReminderSms(id, db, getSettings(db), reminders.get(db, reminderId), 'test@x', NOW, { bodyOverride: 'MERSIS:1 Iptal: x' });
    assert.equal(res.skipped, 'invalid');
    const r = reminders.get(db, reminderId);
    assert.equal(r.attempts, 0);
    assert.equal(r.last_attempt_at, null);
    assert.equal(smsRows(db).length, 0);
  });
});
