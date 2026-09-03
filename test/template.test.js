import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { setupEnv } from './helpers.js';

setupEnv();
const { renderTemplate, senderProblem, providerOf, sendSms, MAX_MESSAGE_LENGTH, PROVIDERS } = await import('../src/sms/index.js');
const { buildMessage } = await import('../src/scheduler.js');
const { DEFAULT_SETTINGS } = await import('../src/db/tenant.js');

describe('renderTemplate', () => {
  test('tüm yer tutucuları doldurur', () => {
    const out = renderTemplate('Sayın {sahip}, {hayvan} için {tarih} {tur}. {klinik} {klinik_tel}', {
      sahip: 'Mehmet', hayvan: 'Boncuk', tarih: '10.09.2026', tur: 'Aşı', klinik: 'Pati', klinik_tel: '0212',
    });
    assert.equal(out, 'Sayın Mehmet, Boncuk için 10.09.2026 Aşı. Pati 0212');
  });
  test('bilinmeyen yer tutucu olduğu gibi kalır, null değer doldurulmaz', () => {
    assert.equal(renderTemplate('{sahip} {bilinmeyen}', { sahip: 'A' }), 'A {bilinmeyen}');
    assert.equal(renderTemplate('{sahip}', { sahip: null }), '{sahip}');
    assert.equal(renderTemplate('{sahip}', { sahip: undefined }), '{sahip}');
    assert.equal(renderTemplate('', { sahip: 'A' }), '');
    assert.equal(renderTemplate(null, {}), '');
  });
  test('prototip anahtarları kullanılmaz', () => {
    assert.equal(renderTemplate('{constructor} {toString} {__proto__}', {}), '{constructor} {toString} {__proto__}');
    assert.equal(renderTemplate('{hasOwnProperty}', { sahip: 'x' }), '{hasOwnProperty}');
  });
  test('sayısal değer metne çevrilir', () => {
    assert.equal(renderTemplate('{n}', { n: 0 }), '0');
  });
});

describe('buildMessage', () => {
  const settings = { ...DEFAULT_SETTINGS, template: 'Sayın {sahip}, {hayvan} {tarih} {tur} - {klinik} {klinik_tel}', clinic_name: 'Pati Vet', clinic_phone: '0212 555' };
  const row = { owner_name: 'Mehmet Kaya', pet_name: 'Boncuk', due_date: '2026-09-10', type: 'asi', title: '' };

  test('başlık yoksa tür etiketi kullanılır, tarih DD.MM.YYYY olur', () => {
    assert.equal(buildMessage(settings, row), 'Sayın Mehmet Kaya, Boncuk 10.09.2026 Aşı - Pati Vet 0212 555');
  });
  test('başlık varsa başlık kullanılır', () => {
    assert.equal(buildMessage(settings, { ...row, title: 'Kuduz aşısı' }), 'Sayın Mehmet Kaya, Boncuk 10.09.2026 Kuduz aşısı - Pati Vet 0212 555');
  });
  test('bilinmeyen tür ham değer olarak düşer', () => {
    assert.ok(buildMessage(settings, { ...row, type: 'ozel' }).includes(' ozel - '));
  });
  test('varsayılan şablon çalışır', () => {
    const out = buildMessage({ ...DEFAULT_SETTINGS, clinic_name: 'Pati', clinic_phone: '0212' }, row);
    assert.ok(out.startsWith('Sayın Mehmet Kaya, Boncuk adlı dostunuzun 10.09.2026 tarihinde Aşı randevusu'));
    assert.ok(!out.includes('{'));
  });
});

describe('senderProblem', () => {
  test('netgsm/iletimerkezi: en fazla 11 alfasayısal karakter', () => {
    assert.equal(senderProblem('netgsm', 'PATI VET'), null);
    assert.equal(senderProblem('iletimerkezi', 'VETKLINIK'), null);
    assert.equal(typeof senderProblem('netgsm', 'ABCDEFGHIJKL'), 'string'); // 12 karakter
    assert.equal(typeof senderProblem('netgsm', 'PATİ VET'), 'string');   // Türkçe karakter
    assert.equal(typeof senderProblem('netgsm', '+905321234567'), 'string');
  });
  test('twilio: E.164', () => {
    assert.equal(senderProblem('twilio', '+905321234567'), null);
    assert.equal(typeof senderProblem('twilio', 'PATI VET'), 'string');
    assert.equal(typeof senderProblem('twilio', '05321234567'), 'string');
  });
  test('console ve boş başlık sorun değil', () => {
    assert.equal(senderProblem('console', 'herhangi bir şey!!!'), null);
    assert.equal(senderProblem('netgsm', ''), null);
    assert.equal(senderProblem('netgsm', '   '), null);
  });
});

describe('providerOf', () => {
  test('bilinen sağlayıcılar korunur, geri kalanı console', () => {
    assert.equal(providerOf('netgsm'), 'netgsm');
    assert.equal(providerOf('iletimerkezi'), 'iletimerkezi');
    assert.equal(providerOf('twilio'), 'twilio');
    assert.equal(providerOf('console'), 'console');
    assert.equal(providerOf('bogus'), 'console');
    assert.equal(providerOf(''), 'console');
    assert.equal(providerOf(undefined), 'console');
    assert.equal(providerOf('__proto__'), 'console');
    assert.equal(providerOf('constructor'), 'console');
    assert.ok(PROVIDERS[providerOf('toString')]);
  });
});

describe('sendSms (console)', () => {
  const settings = { ...DEFAULT_SETTINGS, sms_provider: 'console', sms_sender: '' };

  function captureLog(fn) {
    const orig = console.log;
    const lines = [];
    console.log = (...a) => lines.push(a.join(' '));
    return Promise.resolve().then(fn).finally(() => { console.log = orig; }).then((r) => ({ r, lines }));
  }

  test('MAX_MESSAGE_LENGTH kadar kısaltır ve ok döner', async () => {
    assert.equal(MAX_MESSAGE_LENGTH, 460);
    const long = 'x'.repeat(600);
    const { r, lines } = await captureLog(() => sendSms(settings, '905321234567', long));
    assert.equal(r.ok, true);
    assert.equal(r.providerName, 'console');
    assert.ok(r.ref);
    const line = lines.find((l) => l.includes('[SMS-KONSOL]'));
    assert.ok(line, 'konsol sağlayıcısı log yazmalı');
    const body = line.slice(line.indexOf('): ') + 3);
    assert.equal(body.length, MAX_MESSAGE_LENGTH);
    assert.ok(!line.includes('905321234567'), 'numara maskelenmeli');
  });
  test('boş mesaj ve geçersiz numara reddedilir', async () => {
    const { r: a } = await captureLog(() => sendSms(settings, '905321234567', '   '));
    assert.equal(a.ok, false);
    assert.equal(a.error, 'Mesaj boş');
    const { r: b } = await captureLog(() => sendSms(settings, '05321234567', 'merhaba'));
    assert.equal(b.ok, false);
    assert.equal(b.error, 'Geçersiz telefon numarası');
  });
  test('bilinmeyen sağlayıcı console\'a düşer', async () => {
    const { r } = await captureLog(() => sendSms({ ...settings, sms_provider: 'yok' }, '905321234567', 'merhaba'));
    assert.equal(r.ok, true);
    assert.equal(r.providerName, 'console');
  });
});
