/**
 * SMS_MODE live değilken (konsol) gönderim "simüle" sayılır: sms_log 'simulated', hatırlatma açık kalır,
 * markSent / sonraki tekrar oluşturulmaz, aynı gün yeniden işlenmez. Zamanlayıcı yalnız SMS_MODE=live iken başlar.
 * Ağ çağrısı yapılmaz.
 */
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupEnv, LEGAL_SETTINGS } from './helpers.js';

setupEnv();
delete process.env.SMS_MODE;
const { clinics } = await import('../src/db/master.js');
const { openTenant, closeAll, setSetting, getSettings, owners, pets, reminders, smsLog } = await import('../src/db/tenant.js');
const { processClinic, sendReminderSms, startScheduler, stopScheduler } = await import('../src/scheduler.js');
const { dispatch, usedToday } = await import('../src/sms/dispatch.js');
const { auditLog } = await import('../src/db/master.js');
const { config } = await import('../src/config.js');
const { randomId } = await import('../src/crypto.js');
const { nowIso, nowLocal } = await import('../src/util.js');

const NOW = new Date('2026-09-03T09:00:00Z'); // İstanbul 12:00
const LATER = new Date('2026-09-03T15:30:00Z'); // aynı gün 18:30 (4 saatlik tekrar penceresi geçti)
const NEXT_DAY = new Date('2026-09-04T09:00:00Z');
const TODAY = nowLocal(NOW).date;
const PHONE = '905321234567';

let lines = [], warns = [], origLog, origWarn, origMode, origEnable, origNodeEnv;
before(() => {
  origLog = console.log; origWarn = console.warn; origMode = process.env.SMS_MODE;
  origEnable = config.enableScheduler; origNodeEnv = process.env.NODE_ENV;
  console.log = (...a) => lines.push(a.join(' '));
  console.warn = (...a) => warns.push(a.join(' '));
});
after(async () => {
  console.log = origLog; console.warn = origWarn; config.enableScheduler = origEnable; process.env.NODE_ENV = origNodeEnv;
  if (origMode === undefined) delete process.env.SMS_MODE; else process.env.SMS_MODE = origMode;
  await stopScheduler();
  closeAll();
});
beforeEach(() => { lines = []; warns = []; delete process.env.SMS_MODE; });

function mk({ repeat = null } = {}) {
  const id = randomId(6);
  clinics.create(id, 'K ' + id, '0212', nowIso());
  const db = openTenant(id);
  setSetting(db, 'clinic_name', 'Test Klinik');
  for (const [k, v] of Object.entries(LEGAL_SETTINGS)) setSetting(db, k, v);
  const at = nowIso();
  const o = owners.create(db, { name: 'Mehmet', phone: PHONE, sms_opt_in: 1, created_at: at });
  const p = pets.create(db, { owner_id: o, name: 'Boncuk', species: 'Kedi', created_at: at });
  const rid = reminders.create(db, { pet_id: p, type: 'asi', title: 'Kuduz', due_date: TODAY, notify_days_before: 0, repeat_days: repeat, created_at: at });
  return { id, db, rid };
}
const rows = (db) => db.prepare('SELECT * FROM sms_log ORDER BY id').all();
const konsol = () => lines.filter((l) => l.includes('[SMS-KONSOL]'));

describe('simüle sonuç', () => {
  test("sendReminderSms: sms_log 'simulated', markSent yok, tekrar oluşmaz, hatırlatma açık, deneme izi geri alınır", async () => {
    const c = mk({ repeat: 365 });
    const before = reminders.get(c.db, c.rid);
    const res = await sendReminderSms(c.id, c.db, getSettings(c.db), before, 'zamanlayici', NOW);
    assert.equal(res.ok, true);
    assert.equal(res.simulated, true);
    const r = reminders.get(c.db, c.rid);
    assert.equal(r.status, 'pending');
    assert.equal(r.sent_at, null);
    assert.equal(r.attempts, 0);
    assert.equal(r.last_attempt_at, null, 'last_attempt_at geri alınmalı');
    assert.ok(r.simulated_at);
    assert.equal(c.db.prepare('SELECT COUNT(*) AS c FROM reminders').get().c, 1, 'createNextOccurrence çalışmamalı');
    const l = rows(c.db);
    assert.equal(l.length, 1);
    assert.equal(l[0].status, 'simulated');
    assert.equal(l[0].provider, 'console');
    // panel sayacı: simulated 'sent'e katılmaz
    const cnt = smsLog.countBetween(c.db, '2000-01-01', '2100-01-01');
    assert.equal(cnt.sent, 0);
    assert.equal(cnt.simulated, 1);
  });

  test('birden çok zamanlayıcı turu: aynı gün tek sms_log satırı ve tek konsol satırı; ertesi gün yeniden denenir', async () => {
    const c = mk();
    const r1 = await processClinic(c.id, NOW);
    assert.deepEqual(r1, { sent: 0, failed: 0, skipped: 0, simulated: 1 });
    const r2 = await processClinic(c.id, NOW);
    const r3 = await processClinic(c.id, LATER);
    assert.deepEqual(r2, { sent: 0, failed: 0, skipped: 1 });
    assert.deepEqual(r3, { sent: 0, failed: 0, skipped: 1 });
    assert.equal(rows(c.db).length, 1);
    assert.equal(konsol().length, 1);
    assert.equal(lines.filter((l) => l.includes(' INFO sms ')).length, 1);
    assert.equal(reminders.get(c.db, c.rid).status, 'pending');
    const r4 = await processClinic(c.id, NEXT_DAY);
    assert.equal(r4.simulated, 1);
    assert.equal(rows(c.db).length, 2);
    assert.equal(reminders.get(c.db, c.rid).attempts, 0, 'sonsuz deneme sayacı artmaz');
  });

  test('simüle gönderimler günlük tavana sayılmaz; tavan 1 iken 3 hatırlatma da simüle edilir, turlar sonsuz döngüye girmez', async () => {
    const c = mk();
    setSetting(c.db, 'daily_sms_limit', '1');
    const at = nowIso();
    const pet = c.db.prepare('SELECT pet_id FROM reminders WHERE id = ?').get(c.rid).pet_id;
    for (const t of ['Karma', 'Parazit']) reminders.create(c.db, { pet_id: pet, type: 'asi', title: t, due_date: TODAY, notify_days_before: 0, created_at: at });
    const r1 = await processClinic(c.id, NOW);
    assert.deepEqual(r1, { sent: 0, failed: 0, skipped: 0, simulated: 3 });
    assert.equal(usedToday(c.db), 0);
    assert.equal(auditLog.recent(500, c.id).filter((r) => r.action === 'sms.cap').length, 0);
    for (let k = 0; k < 5; k++) assert.deepEqual(await processClinic(c.id, LATER), { sent: 0, failed: 0, skipped: 3 });
    assert.equal(rows(c.db).length, 3);
    assert.equal(konsol().length, 3);
    // gerçek (simüle olmayan) satır tavana sayılır
    c.db.prepare(`INSERT INTO sms_log (phone, message, provider, status, created_at) VALUES ('905321234567', 'x', 'netgsm', 'failed', ?)`).run(nowIso());
    assert.equal(usedToday(c.db), 1);
  });

  test("test SMS (dispatch kind=test): sms_log 'simulated'", async () => {
    const c = mk();
    const r = await dispatch({ clinicId: c.id, db: c.db, settings: getSettings(c.db), kind: 'test', to: PHONE, message: 'Test', sentBy: 't' });
    assert.equal(r.ok, true);
    assert.equal(r.simulated, true);
    assert.equal(rows(c.db)[0].status, 'simulated');
  });

  test("demo numarası değişmedi: provider 'demo', status 'sent'", async () => {
    const c = mk();
    const r = await dispatch({ clinicId: c.id, db: c.db, settings: getSettings(c.db), kind: 'test', to: '905150001001', message: 'Test', sentBy: 't' });
    assert.equal(r.ok, true);
    assert.equal(r.simulated, undefined);
    assert.equal(rows(c.db)[0].provider, 'demo');
    assert.equal(rows(c.db)[0].status, 'sent');
  });
});

describe('zamanlayıcı kapısı', () => {
  const warnStart = () => warns.filter((w) => w.includes("Zamanlayıcı BAŞLATILMADI: SMS_MODE='live' değil"));

  test('ENABLE_SCHEDULER kapalıysa başlamaz (SMS_MODE live olsa bile)', async () => {
    config.enableScheduler = false;
    process.env.SMS_MODE = 'live';
    assert.equal(startScheduler(), false);
    assert.ok(warns.some((w) => w.includes('ENABLE_SCHEDULER')));
  });

  for (const [label, mode] of [['tanımsız', undefined], ['console', 'console'], ['tanınmayan "LIVE"', 'LIVE'], ['tanınmayan "canli"', 'canli']]) {
    for (const nodeEnv of ['production', 'development']) {
      test(`SMS_MODE ${label}, NODE_ENV=${nodeEnv}: başlamaz ve uyarı verir (numara/metin yok)`, async () => {
        config.enableScheduler = true;
        process.env.NODE_ENV = nodeEnv;
        if (mode === undefined) delete process.env.SMS_MODE; else process.env.SMS_MODE = mode;
        assert.equal(startScheduler(), false);
        assert.equal(warnStart().length, 1);
        assert.ok(!/\d{7,}/.test(warns.join('\n')));
        assert.ok(!lines.some((l) => l.includes('zamanlayıcı her')));
      });
    }
  }

  test('SMS_MODE=live ve ENABLE_SCHEDULER açık: başlar', async () => {
    config.enableScheduler = true;
    process.env.NODE_ENV = 'production';
    process.env.SMS_MODE = 'live';
    assert.equal(startScheduler(), true);
    assert.equal(warnStart().length, 0);
    assert.ok(lines.some((l) => l.includes('zamanlayıcı her')));
    await stopScheduler();
  });
});
