import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { setupEnv, LEGAL_SETTINGS } from './helpers.js';

setupEnv();
const { clinics, auditLog } = await import('../src/db/master.js');
const { openTenant, setSetting, owners, pets, smsLog, imhaLog, consents } = await import('../src/db/tenant.js');
const { runClinicRetention, runRetention, maybeRetention, smsRetentionDays, MIN_SMS_RETENTION_DAYS, _resetRetentionState } = await import('../src/retention.js');
const { dispatch } = await import('../src/sms/dispatch.js');
const { randomId } = await import('../src/crypto.js');
const { nowIso } = await import('../src/util.js');

let origLog;
before(() => { origLog = console.log; console.log = () => {}; });

function makeClinic() {
  const id = randomId(6);
  clinics.create(id, 'Test ' + id, '', nowIso());
  const db = openTenant(id);
  for (const [k, v] of Object.entries(LEGAL_SETTINGS)) setSetting(db, k, v);
  return { id, db };
}

const daysAgo = (n) => new Date(Date.now() - n * 86400 * 1000).toISOString();

function addLog(db, ownerId, createdAt, message = 'Sayın Mehmet, Boncuk aşı') {
  return smsLog.add(db, { owner_id: ownerId, phone: '905321234567', message, provider: 'console', status: 'sent', sent_by: 't', created_at: createdAt, owner_name: 'Mehmet', pet_name: 'Boncuk', kind: 'reminder' });
}

describe('saklama süresi', () => {
  test('alt sınır 1095 gün (Yön. m.13/2); daha düşük ayar yükseltilir', () => {
    assert.equal(smsRetentionDays({ retention_sms_days: '30' }), MIN_SMS_RETENTION_DAYS);
    assert.equal(smsRetentionDays({ retention_sms_days: '2000' }), 2000);
    assert.equal(smsRetentionDays({}), 1095);
  });
});

describe('periyodik imha', () => {
  test('süresi dolan sms_log satırlarının kişisel alanları anonimleşir; satır ve imha kaydı kalır', () => {
    const { id, db } = makeClinic();
    const o = owners.create(db, { name: 'Mehmet', phone: '905321234567', created_at: nowIso() });
    const oldId = addLog(db, o, daysAgo(1200));
    const newId = addLog(db, o, daysAgo(10));
    const n = runClinicRetention(id, new Date());
    assert.equal(n, 1);
    const old = db.prepare('SELECT * FROM sms_log WHERE id = ?').get(oldId);
    assert.equal(old.phone, '');
    assert.equal(old.message, '[anonim]');
    assert.equal(old.owner_name, null);
    assert.ok(old.anonymized_at);
    assert.equal(old.status, 'sent'); // sayım/durum bilgisi korunur (6563 m.11/3)
    const fresh = db.prepare('SELECT * FROM sms_log WHERE id = ?').get(newId);
    assert.equal(fresh.message, 'Sayın Mehmet, Boncuk aşı');
    const logs = imhaLog.recent(db);
    assert.equal(logs.length, 1);
    assert.equal(logs[0].scope, 'sms_log');
    assert.equal(logs[0].method, 'anonim');
    assert.equal(logs[0].row_count, 1);
    // ikinci tur: yeniden anonimleştirmez, yeni imha satırı yazmaz
    assert.equal(runClinicRetention(id, new Date()), 0);
    assert.equal(imhaLog.recent(db).length, 1);
  });

  test('klinik kendi süresini uzatabilir ama kısaltamaz', () => {
    const { id, db } = makeClinic();
    const o = owners.create(db, { name: 'A', phone: '905321234568', created_at: nowIso() });
    addLog(db, o, daysAgo(1200));
    setSetting(db, 'retention_sms_days', '3000');
    assert.equal(runClinicRetention(id, new Date()), 0);
    setSetting(db, 'retention_sms_days', '10');
    assert.equal(runClinicRetention(id, new Date()), 1, '10 gün 1095\'e yükseltilir; 1200 günlük satır yine anonimleşir');
  });

  test('günde bir kez çalışır; master denetim günlüğünde retention.run satırı ve eski aktörler maskelenir', async () => {
    _resetRetentionState();
    auditLog.add({ created_at: daysAgo(1200), actor_email: 'eski@ornek.com', action: 'login', ip: '1.2.3.4' });
    assert.equal(await maybeRetention(new Date()), true);
    assert.equal(await maybeRetention(new Date()), false);
    const masked = auditLog.recent(500).find((a) => a.action === 'login' && a.created_at < daysAgo(1100));
    assert.equal(masked.actor_email, '[anonim]');
    assert.equal(masked.ip, null);
    assert.ok(auditLog.recent(20).some((a) => a.action === 'retention.run'));
  });
});

describe('sahip silme ve anonimleştirme', () => {
  test('scrubOwner: sahibin SMS satırları anonimleşir, diğer sahipler etkilenmez', () => {
    const { db } = makeClinic();
    const a = owners.create(db, { name: 'A', phone: '905321111111', created_at: nowIso() });
    const b = owners.create(db, { name: 'B', phone: '905322222222', created_at: nowIso() });
    addLog(db, a, nowIso(), 'A mesajı');
    addLog(db, b, nowIso(), 'B mesajı');
    assert.equal(smsLog.scrubOwner(db, a, nowIso()), 1);
    assert.equal(smsLog.allByOwner(db, a)[0].message, '[anonim]');
    assert.equal(smsLog.allByOwner(db, b)[0].message, 'B mesajı');
  });
  test('anonymize: ad/iletişim gider, telefon yer tutucu olur, kimlik kalır', () => {
    const { db } = makeClinic();
    const a = owners.create(db, { name: 'A', phone: '905321111112', email: 'a@x', address: 'adres', created_at: nowIso() });
    pets.create(db, { owner_id: a, name: 'P', created_at: nowIso() });
    owners.anonymize(db, a);
    const row = owners.get(db, a);
    assert.equal(row.name, '[silindi]');
    assert.equal(row.phone, `sil-${a}`);
    assert.equal(row.email, null);
    assert.equal(row.address, null);
    assert.equal(row.sms_opt_in, 0);
    assert.equal(row.opt_out_token, null);
  });
});

describe('dispatch hukuki izi ve kilidi', () => {
  test('kimlik eksikse hatırlatma gönderilmez (skipped: legal), test SMS gönderilir', async () => {
    const id = randomId(6);
    clinics.create(id, 'Kilitli', '', nowIso());
    const db = openTenant(id);
    const settings = { ...(await import('../src/db/tenant.js')).getSettings(db) };
    const r = await dispatch({ clinicId: id, db, settings, kind: 'reminder', to: '905321234567', message: 'm', owner: { id: 1, name: 'x', sms_opt_in: 1 }, sentBy: 't' });
    assert.equal(r.skipped, 'legal');
    assert.equal(smsLog.countSince(db, '2000-01-01'), 0);
    const t = await dispatch({ clinicId: id, db, settings, kind: 'test', to: '905321234567', message: 'm', sentBy: 't' });
    assert.equal(t.ok, true);
  });
  test('gönderilen satıra dayanak, iys bayrağı ve kimlik yazılır', async () => {
    const { id, db } = makeClinic();
    const settings = (await import('../src/db/tenant.js')).getSettings(db);
    const message = (await import('../src/sms/policy.js')).composeMessage(settings, 'm', { clinicId: id });
    const r = await dispatch({ clinicId: id, db, settings, kind: 'reminder', to: '905321234567', message, owner: { id: 1, name: 'x', sms_opt_in: 1 }, sentBy: 't' });
    assert.equal(r.ok, true);
    const row = db.prepare('SELECT * FROM sms_log WHERE id = ?').get(r.logId);
    assert.equal(row.legal_basis, 'm6_1');
    assert.equal(row.iys_flag, '0');
    assert.equal(row.identity_used, 'MERSIS:0123456789012345');
  });
  test('ret sonrası gönderilmez; consent_events revoke kaydı', async () => {
    const { id, db } = makeClinic();
    const o = owners.create(db, { name: 'R', phone: '905321234569', created_at: nowIso() });
    owners.setOptIn(db, o, 0);
    consents.log(db, { owner_id: o, action: 'revoke', channel: 'ret_url', created_at: nowIso() });
    const settings = (await import('../src/db/tenant.js')).getSettings(db);
    const r = await dispatch({ clinicId: id, db, settings, kind: 'reminder', to: '905321234569', message: 'm', owner: owners.get(db, o), sentBy: 't' });
    assert.equal(r.skipped, 'opt-out');
    assert.equal(consents.last(db, o).action, 'revoke');
  });
});
