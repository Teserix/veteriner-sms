/**
 * SMS_MODE tek gönderim kapısı: yalnızca SMS_MODE=live iken sağlayıcıya (ağa) gidilir.
 * Gerçek ağ çağrısı yapılmaz: globalThis.fetch ve sağlayıcı istemcisi mock'lanır.
 */
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupEnv, LEGAL_SETTINGS } from './helpers.js';

setupEnv();
const { sendSms, PROVIDERS } = await import('../src/sms/index.js');
const { dispatch } = await import('../src/sms/dispatch.js');
const { processClinic } = await import('../src/scheduler.js');
const { clinics } = await import('../src/db/master.js');
const { openTenant, closeAll, setSetting, getSettings, owners, pets, reminders } = await import('../src/db/tenant.js');
const { randomId, encrypt } = await import('../src/crypto.js');
const { nowIso, nowLocal } = await import('../src/util.js');

const PHONE = '905321234567';
const TEXT = 'Gizli mesaj metni ABCXYZ';
const FAKE_CREDS = encrypt(JSON.stringify({ usercode: 'sahte-kullanici', password: 'sahte-sifre' }));

let fetchCalls = 0;
let fakeCalls = [];
let lines = [];
let origFetch, origLog, origMode;

PROVIDERS.mockprov = {
  label: 'mock', fields: [], senderHelp: '',
  async send(args) { fakeCalls.push(args); return { ok: true, ref: 'mock-' + fakeCalls.length }; },
};

before(() => {
  origFetch = globalThis.fetch; origLog = console.log; origMode = process.env.SMS_MODE;
  globalThis.fetch = async () => { fetchCalls++; return new Response(JSON.stringify({ code: '00', jobid: 'j1' }), { status: 200 }); };
  console.log = (...a) => lines.push(a.join(' '));
});
after(() => {
  globalThis.fetch = origFetch; console.log = origLog;
  if (origMode === undefined) delete process.env.SMS_MODE; else process.env.SMS_MODE = origMode;
  closeAll();
});
beforeEach(() => { fetchCalls = 0; fakeCalls = []; lines = []; });

const netgsm = { sms_provider: 'netgsm', sms_sender: 'VETKLINIK', sms_credentials: FAKE_CREDS };
const mock = { sms_provider: 'mockprov', sms_sender: 'VETKLINIK', sms_credentials: '' };

describe('SMS_MODE gönderim kapısı', () => {
  test('sahte anahtar + SMS_MODE=console: sağlayıcıya 0 çağrı, başarı döner', async () => {
    process.env.SMS_MODE = 'console';
    const a = await sendSms(netgsm, PHONE, TEXT);
    const b = await sendSms(mock, PHONE, TEXT);
    assert.equal(a.ok, true); assert.equal(b.ok, true);
    assert.equal(a.providerName, 'console');
    assert.equal(fetchCalls, 0); assert.equal(fakeCalls.length, 0);
  });

  test('SMS_MODE yok: 0 çağrı', async () => {
    delete process.env.SMS_MODE;
    const r = await sendSms(netgsm, PHONE, TEXT);
    await sendSms(mock, PHONE, TEXT);
    assert.equal(r.ok, true);
    assert.equal(fetchCalls, 0); assert.equal(fakeCalls.length, 0);
  });

  test('geçersiz SMS_MODE değeri (LIVE, prod, boş): 0 çağrı', async () => {
    for (const v of ['LIVE', 'prod', '', ' live', 'true']) {
      process.env.SMS_MODE = v;
      await sendSms(netgsm, PHONE, TEXT);
      await sendSms(mock, PHONE, TEXT);
    }
    assert.equal(fetchCalls, 0); assert.equal(fakeCalls.length, 0);
  });

  test('SMS_MODE=live + sahte sağlayıcı: tam 1 çağrı', async () => {
    process.env.SMS_MODE = 'live';
    const r = await sendSms(mock, PHONE, TEXT);
    assert.equal(r.ok, true); assert.equal(r.providerName, 'mockprov');
    assert.equal(fakeCalls.length, 1);
    assert.equal(fakeCalls[0].to, PHONE);
    assert.equal(fetchCalls, 0);
  });

  test('SMS_MODE=live + netgsm (fetch mock): tam 1 ağ çağrısı', async () => {
    process.env.SMS_MODE = 'live';
    const r = await sendSms(netgsm, PHONE, TEXT);
    assert.equal(r.ok, true); assert.equal(r.providerName, 'netgsm');
    assert.equal(fetchCalls, 1);
  });

  test('test SMS yolu (dispatch kind=test) kapıdan geçer', async () => {
    const id = randomId(6);
    clinics.create(id, 'K ' + id, '0212', nowIso());
    const db = openTenant(id);
    setSetting(db, 'sms_provider', 'mockprov');
    process.env.SMS_MODE = 'console';
    const a = await dispatch({ clinicId: id, db, settings: getSettings(db), kind: 'test', to: PHONE, message: TEXT, sentBy: 't' });
    assert.equal(a.ok, true); assert.equal(fakeCalls.length, 0);
    process.env.SMS_MODE = 'live';
    await dispatch({ clinicId: id, db, settings: getSettings(db), kind: 'test', to: PHONE, message: TEXT, sentBy: 't' });
    assert.equal(fakeCalls.length, 1);
  });

  test('zamanlayıcı yolu (processClinic) da kapıdan geçer', async () => {
    const NOW = new Date('2026-09-03T09:00:00Z');
    const TODAY = nowLocal(NOW).date;
    const mk = () => {
      const id = randomId(6);
      clinics.create(id, 'K ' + id, '0212', nowIso());
      const db = openTenant(id);
      setSetting(db, 'clinic_name', 'Test Klinik'); setSetting(db, 'clinic_phone', '0212 555');
      for (const [k, v] of Object.entries(LEGAL_SETTINGS)) setSetting(db, k, v);
      setSetting(db, 'sms_provider', 'mockprov'); setSetting(db, 'sms_sender', 'VETKLINIK');
      const at = nowIso();
      const o = owners.create(db, { name: 'Mehmet', phone: PHONE, sms_opt_in: 1, created_at: at });
      const p = pets.create(db, { owner_id: o, name: 'Boncuk', species: 'Kedi', created_at: at });
      const rid = reminders.create(db, { pet_id: p, type: 'asi', title: 'Kuduz', due_date: TODAY, notify_days_before: 0, created_at: at });
      return { id, db, rid };
    };
    process.env.SMS_MODE = 'console';
    const c = mk();
    const res = await processClinic(c.id, NOW);
    // SMS_MODE live değil: simüle edilir, gönderilmiş sayılmaz, hatırlatma açık kalır
    assert.equal(res.sent, 0);
    assert.equal(res.simulated, 1);
    assert.equal(reminders.get(c.db, c.rid).status, 'pending');
    assert.equal(fakeCalls.length, 0);
    process.env.SMS_MODE = 'live';
    const l = mk();
    const res2 = await processClinic(l.id, NOW);
    assert.equal(res2.sent, 1);
    assert.equal(fakeCalls.length, 1);
  });

  test('log: tam numara ve mesaj metni yok, son 2 hane var', async () => {
    process.env.SMS_MODE = 'console';
    const id = randomId(6);
    clinics.create(id, 'K ' + id, '0212', nowIso());
    const db = openTenant(id);
    await sendSms(netgsm, PHONE, TEXT);
    await dispatch({ clinicId: id, db, settings: getSettings(db), kind: 'test', to: PHONE, message: TEXT, sentBy: 't' });
    const all = lines.join('\n');
    const smsLines = lines.filter((l) => l.includes('[SMS-KONSOL]'));
    assert.ok(smsLines.length >= 2);
    assert.ok(!all.includes(PHONE), 'tam numara loglanmamalı');
    assert.ok(!all.includes('5321234567'), '10 haneli numara loglanmamalı');
    assert.ok(!all.includes('90532'), 'numara ön eki loglanmamalı');
    assert.ok(!all.includes('ABCXYZ'), 'mesaj metni loglanmamalı');
    for (const l of smsLines) assert.ok(l.includes('**********67'), 'yalnızca son 2 hane: ' + l);
    assert.ok(lines.some((l) => l.includes('INFO sms') && l.includes('**********67')));
  });
});
