import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setupEnv, LEGAL_SETTINGS } from './helpers.js';

setupEnv();
process.env.SMS_MODE = 'live'; // bu dosya sahte sağlayıcılarla gerçek gönderim yolunu sınar (ağ çağrısı yok)
const { previewParts, composeFromTemplate, bodyProblems, hasMandatoryTail, smsSegments, SMS_LIMITS, composeMessage } = await import('../src/sms/policy.js');
const { buildMessage, buildReminderVars, sendReminderSms } = await import('../src/scheduler.js');
const { DEFAULT_SETTINGS, openTenant, setSetting, getSettings, owners, pets, reminders, smsLog } = await import('../src/db/tenant.js');
const { clinics } = await import('../src/db/master.js');
const { dispatch } = await import('../src/sms/dispatch.js');
const { randomId } = await import('../src/crypto.js');
const { PROVIDERS } = await import('../src/sms/index.js');
PROVIDERS.previewok = { label: 'previewok', fields: [], senderHelp: '', async send() { return { ok: true, ref: 'p' }; } };
const { nowIso, todayLocal } = await import('../src/util.js');

const CID = 'abcdefabcdef';
const TOKEN = 'a'.repeat(32);
const settings = { ...DEFAULT_SETTINGS, ...LEGAL_SETTINGS, template: 'Sayın {sahip}, {hayvan} {tarih} {tur} - {klinik}', clinic_name: 'Pati Vet' };
const row = { owner_name: 'Mehmet Kaya', pet_name: 'Boncuk', due_date: '2026-09-10', type: 'asi', title: '', opt_out_token: TOKEN };
const tail = composeMessage(settings, '', { clinicId: CID, optOutToken: TOKEN }).slice('Bilgilendirme: '.length).trim();

function makeClinic() {
  const id = randomId(6);
  clinics.create(id, 'Test ' + id, '', nowIso());
  const db = openTenant(id);
  for (const [k, v] of Object.entries(LEGAL_SETTINGS)) setSetting(db, k, v);
  return { id, db };
}

describe('önizleme = gönderim (tek kaynak)', () => {
  const vars = buildReminderVars(settings, row);
  test('bodyOverride yokken previewParts.full === buildMessage', () => {
    const p = previewParts(settings, vars, { clinicId: CID, optOutToken: TOKEN });
    assert.equal(p.full, buildMessage(settings, row, CID));
    assert.equal(p.full, composeFromTemplate(settings, vars, { clinicId: CID, optOutToken: TOKEN }));
    assert.equal(p.edited, false);
    assert.equal(p.full, `${p.prefix}${p.body} ${p.identity} ${p.optOut}`);
    assert.deepEqual(p.segments, smsSegments(p.full));
  });
  test('bodyOverride ile previewParts.full === buildMessage; düzenlendi bayrağı ve orijinal gövde', () => {
    const body = 'Boncuk için aşı randevunuz yaklaştı.';
    const p = previewParts(settings, vars, { clinicId: CID, optOutToken: TOKEN, bodyOverride: body });
    assert.equal(p.full, buildMessage(settings, row, CID, body));
    assert.equal(p.body, body);
    assert.equal(p.edited, true);
    assert.equal(p.originalBody, 'Sayın Mehmet Kaya, Boncuk 10.09.2026 Aşı - Pati Vet');
    assert.ok(p.full.startsWith('Bilgilendirme: ' + body));
    assert.ok(p.full.endsWith(' ' + tail));
  });
  test('orijinalle aynı gövde düzenlenmiş sayılmaz', () => {
    const p = previewParts(settings, vars, { bodyOverride: 'Sayın Mehmet Kaya, Boncuk 10.09.2026 Aşı - Pati Vet' });
    assert.equal(p.edited, false);
  });
});

describe('bodyProblems: kimlik/iptal zorunluluğu ve gövde denetimi', () => {
  const opts = { clinicId: CID, optOutToken: TOKEN };
  test('geçerli gövde', () => assert.deepEqual(bodyProblems('Boncuk için aşı zamanı geldi.', settings, opts), []));
  test('sahte kimlik/iptal satırı içeren gövde reddedilir', () => {
    for (const b of ['MERSIS:123 Iptal: x', 'Iptal: http://kotu.example', 'İPTAL : yaz', 'VKN:1234567890', 'mersis : 1']) {
      assert.ok(bodyProblems(b, settings, opts).some((p) => p.includes('kimlik')), b);
    }
  });
  test('boş ya da yalnız kontrol/boşluk karakteri olan gövde reddedilir', () => {
    for (const b of ['', '   ', '\n', '\t\n\r', '\u0000', null, undefined]) assert.ok(bodyProblems(b, settings, opts).length > 0, JSON.stringify(b));
  });
  test('kontrol karakteri, satır sonu ve sekme reddedilir', () => {
    for (const b of ['a\nb', 'a\tb', 'a\u0007b', 'a\u007Fb', 'a\u0085b']) assert.ok(bodyProblems(b, settings, opts).some((p) => p.includes('kontrol')), JSON.stringify(b));
  });
  test('uzunluk sınırı ve toplam sınır (kırpma yok, hata)', () => {
    assert.ok(bodyProblems('x'.repeat(321), settings, opts).some((p) => p.includes('320')));
    const long = { ...settings, clinic_phone: '0'.repeat(150) };
    assert.ok(bodyProblems('x'.repeat(300), long, opts).some((p) => p.includes('aşıyor')));
  });
  test('içerik politikası da uygulanır', () => {
    assert.ok(bodyProblems('Bu hafta %20 indirim!', settings, opts).length > 0);
  });
  test('gerçek kuyruk her zaman metnin sonundadır (sahte gövdeyle silinemez)', () => {
    const vars = buildReminderVars(settings, row);
    const p = previewParts(settings, vars, { ...opts, bodyOverride: 'MERSIS:1 Iptal: http://kotu.example' });
    assert.ok(p.full.endsWith(' ' + tail));
    assert.ok(hasMandatoryTail(p.full, settings, CID, TOKEN));
  });
});

describe('hasMandatoryTail', () => {
  test('önek + kimlik + iptal varsa true; eksikse false', () => {
    const full = buildMessage(settings, row, CID);
    assert.equal(hasMandatoryTail(full, settings, CID, TOKEN), true);
    assert.equal(hasMandatoryTail(full.replace('Bilgilendirme: ', ''), settings, CID, TOKEN), false);
    assert.equal(hasMandatoryTail(full.replace(/ Iptal:.*$/, ''), settings, CID, TOKEN), false);
    assert.equal(hasMandatoryTail(full, settings, CID, 'b'.repeat(32)), false);
    assert.equal(hasMandatoryTail('Bilgilendirme: merhaba', settings, CID, TOKEN), false);
    assert.equal(hasMandatoryTail(full, { ...settings, legal_form: '' }, CID, TOKEN), false);
  });
});

describe('smsSegments', () => {
  const { vectors } = JSON.parse(readFileSync(new URL('./fixtures/sms-segments.json', import.meta.url), 'utf8'));
  for (const v of vectors) {
    test(v.name, () => {
      const text = v.text ?? v.char.repeat(v.count);
      const r = smsSegments(text, { turkishShift: !!v.turkishShift });
      assert.equal(r.encoding, v.encoding);
      assert.equal(r.units, v.units);
      assert.equal(r.segments, v.segments);
    });
  }
  test('parça başına sınır ve kalan', () => {
    assert.deepEqual(SMS_LIMITS.gsm7, { single: 160, multi: 153 });
    assert.deepEqual(SMS_LIMITS.ucs2, { single: 70, multi: 67 });
    assert.deepEqual(smsSegments('a'.repeat(150)), { encoding: 'gsm7', units: 150, segments: 1, perSegment: 160, remainingInSegment: 10 });
    assert.deepEqual(smsSegments('ş'.repeat(71)), { encoding: 'ucs2', units: 71, segments: 2, perSegment: 67, remainingInSegment: 63 });
  });
});

describe('dispatch son kilidi ve düzenlenmiş gövdeyle gönderim', () => {
  test('hasMandatoryTail false ise dispatch göndermez ve sms_log yazmaz', async () => {
    const { id, db } = makeClinic();
    const s = getSettings(db);
    const r = await dispatch({ clinicId: id, db, settings: s, kind: 'reminder', to: '905321234567', message: 'Bilgilendirme: kuyruksuz', owner: { id: 1, name: 'x', sms_opt_in: 1 }, sentBy: 't' });
    assert.equal(r.ok, false);
    assert.equal(r.skipped, 'tail');
    assert.equal(smsLog.countSince(db, '2000-01-01'), 0);
    const tok = 'c'.repeat(32);
    const wrongToken = await dispatch({ clinicId: id, db, settings: s, kind: 'reminder', to: '905321234567', message: composeMessage(s, 'x', { clinicId: id, optOutToken: tok }), optOutToken: 'd'.repeat(32), owner: { id: 1, name: 'x', sms_opt_in: 1 }, sentBy: 't' });
    assert.equal(wrongToken.skipped, 'tail');
    const ok = await dispatch({ clinicId: id, db, settings: s, kind: 'reminder', to: '905321234567', message: composeMessage(s, 'x', { clinicId: id, optOutToken: tok }), optOutToken: tok, owner: { id: 1, name: 'x', sms_opt_in: 1 }, sentBy: 't' });
    assert.equal(ok.ok, true);
  });

  function seedReminder(db) {
    const at = nowIso();
    const ownerId = owners.create(db, { name: 'Ali', phone: '905321234567', created_at: at });
    const petId = pets.create(db, { owner_id: ownerId, name: 'Boncuk', created_at: at });
    return reminders.create(db, { pet_id: petId, type: 'asi', title: 'Karma', due_date: todayLocal(), notify_days_before: 0, created_at: at });
  }

  test('geçerli bodyOverride gönderilir; metin önizlemeyle aynıdır', async () => {
    const { id, db } = makeClinic();
    const rid = seedReminder(db);
    const s = getSettings(db);
    const res = await sendReminderSms(id, db, s, reminders.get(db, rid), 't', new Date(), { bodyOverride: 'Boncuk için aşı zamanı.' });
    assert.equal(res.ok, true);
    const fresh = reminders.get(db, rid);
    const preview = previewParts(s, buildReminderVars(s, fresh), { clinicId: id, optOutToken: fresh.opt_out_token, bodyOverride: 'Boncuk için aşı zamanı.' });
    assert.equal(res.message, preview.full);
    assert.equal(db.prepare('SELECT message FROM sms_log WHERE reminder_id = ?').get(rid).message, preview.full);
  });

  test('geçersiz bodyOverride gönderilmez, iz geri alınır', async () => {
    const { id, db } = makeClinic();
    const rid = seedReminder(db);
    const res = await sendReminderSms(id, db, getSettings(db), reminders.get(db, rid), 't', new Date(), { bodyOverride: 'MERSIS:123 Iptal: x' });
    assert.equal(res.ok, false);
    assert.equal(res.skipped, 'invalid');
    const after = reminders.get(db, rid);
    assert.equal(after.status, 'pending');
    assert.equal(after.last_attempt_at, null);
    assert.equal(smsLog.countSince(db, '2000-01-01'), 0);
  });

  test('bodyOverride verilmezse şablonla gönderilir (geriye uyumlu)', async () => {
    const { id, db } = makeClinic();
    const rid = seedReminder(db);
    const res = await sendReminderSms(id, db, getSettings(db), reminders.get(db, rid), 't');
    assert.equal(res.ok, true);
  });

  test('sağlayıcı hatasından sonraki otomatik tekrar düzenlenmiş gövdeyi gönderir', async () => {
    const { id, db } = makeClinic();
    const rid = seedReminder(db);
    const failing = { ...getSettings(db), sms_provider: 'netgsm' }; // hesap bilgisi yok -> sağlayıcı hatası
    const first = await sendReminderSms(id, db, failing, reminders.get(db, rid), 't', new Date(), { bodyOverride: 'Boncuk için aşı günü.' });
    assert.equal(first.ok, false);
    assert.equal(first.skipped, undefined);
    assert.equal(reminders.get(db, rid).body_override, 'Boncuk için aşı günü.');
    db.prepare('UPDATE reminders SET last_attempt_at = NULL WHERE id = ?').run(rid);
    const retry = await sendReminderSms(id, db, { ...getSettings(db), sms_provider: 'previewok' }, reminders.get(db, rid), 'zamanlayici');
    assert.equal(retry.ok, true);
    assert.equal(retry.edited, true);
    assert.match(retry.message, /^Bilgilendirme: Boncuk için aşı günü\. /);
    assert.equal(reminders.get(db, rid).body_override, null);
  });

  test('değiştirilmemiş çok satırlı şablon olduğu gibi gönderilir (düzenlendi sayılmaz)', async () => {
    const { id, db } = makeClinic();
    const rid = seedReminder(db);
    const s = { ...getSettings(db), template: 'Sayın {sahip},\n{hayvan} için {tur} zamanı.' };
    const r = reminders.get(db, rid);
    const original = previewParts(s, buildReminderVars(s, r), { clinicId: id }).originalBody;
    assert.ok(original.includes('\n'));
    const res = await sendReminderSms(id, db, s, r, 't', new Date(), { bodyOverride: original });
    assert.equal(res.ok, true);
    assert.equal(res.edited, false);
    assert.equal(res.message, buildMessage(s, reminders.get(db, rid), id));
  });

  test('kilit beklenirken kayıt değişse de kullanıcının gördüğü gövde gönderilir; uzunluklar taze kayıttan', async () => {
    const { id, db } = makeClinic();
    const rid = seedReminder(db);
    const s = getSettings(db);
    const stale = reminders.get(db, rid);
    const seen = previewParts(s, buildReminderVars(s, stale), { clinicId: id }).originalBody;
    db.prepare('UPDATE pets SET name = ? WHERE id = ?').run('Pamuk', stale.pet_id);
    const res = await sendReminderSms(id, db, s, stale, 't', new Date(), { bodyOverride: seen });
    assert.equal(res.ok, true);
    assert.ok(res.message.includes(seen.replace(/\s+/g, ' ').trim()));
    assert.equal(res.edited, true);
    const freshOriginal = previewParts(s, buildReminderVars(s, reminders.get(db, rid)), { clinicId: id }).originalBody;
    assert.equal(res.originalLength, freshOriginal.replace(/\s+/g, ' ').trim().length);
  });
});
