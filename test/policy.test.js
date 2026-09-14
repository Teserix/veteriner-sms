import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { setupEnv } from './helpers.js';

setupEnv();
const { templateProblems, contentProblems, composeMessage, identityLine, optOutLine, normalizeTr, TEMPLATE_VARS } = await import('../src/sms/policy.js');
const { MAX_MESSAGE_LENGTH } = await import('../src/sms/index.js');
const { legalProblems, DEFAULT_SETTINGS } = await import('../src/db/tenant.js');

const tacir = { ...DEFAULT_SETTINGS, legal_form: 'tacir', mersis_no: '0123456789012345', clinic_phone: '0212 555 00 00', m61_declared_at: '2026-01-01T00:00:00Z' };
const esnaf = { ...DEFAULT_SETTINGS, legal_form: 'esnaf', tax_id: '12345678901', ruhsat_isim: 'Pati Veteriner', clinic_phone: '0212 555', m61_declared_at: '2026-01-01T00:00:00Z' };

describe('normalizeTr', () => {
  test('Türkçe büyük/küçük ve aksan farkları düzleşir', () => {
    assert.equal(normalizeTr('İNDİRİM Ücretsiz KAMPANYA'), 'indirim ucretsiz kampanya');
    assert.equal(normalizeTr('Fırsat  Hediye'), 'firsat hediye');
  });
});

describe('templateProblems', () => {
  test('varsayılan şablon temiz', () => {
    assert.deepEqual(templateProblems(DEFAULT_SETTINGS.template), []);
  });
  test('boş ve fazla uzun şablon reddedilir', () => {
    assert.equal(templateProblems('').length, 1);
    assert.ok(templateProblems('x'.repeat(321))[0].includes('320'));
  });
  test('bilinmeyen değişken reddedilir, izinli liste mesajda geçer', () => {
    const p = templateProblems('Sayın {sahip}, {fiyat} {hayvan}');
    assert.equal(p.length, 1);
    assert.ok(p[0].includes('{fiyat}'));
    for (const v of TEMPLATE_VARS) assert.ok(p[0].includes(`{${v}}`));
  });
  test('reklam/özendirme ifadeleri dayanağıyla reddedilir (6343 m.9, TVHB m.97)', () => {
    for (const t of ['Bu ay %20 indirim', 'Kampanya başladı', 'Ücretsiz kontrol', 'Doğum günü kutlu olsun', '2 al 1 öde', 'Sadece 500 TL']) {
      const p = templateProblems(`Sayın {sahip}, ${t}`);
      assert.ok(p.length >= 1, t);
      assert.ok(p[0].includes('m.97') || p[0].includes('m.6/1'), p[0]);
    }
  });
  test('ilaç ticari adı ve teşhis ifadeleri reddedilir', () => {
    assert.ok(contentProblems('Nobivac rapeli zamanı')[0].includes('m.37/1'));
    assert.ok(contentProblems('Böbrek yetmezliği kontrolü')[0].includes('meslek sırrı'));
    assert.ok(contentProblems('Parvo testi')[0].includes('meslek sırrı'));
  });
  test('sıradan hatırlatma başlıkları geçer', () => {
    for (const t of ['Kuduz aşısı', 'Karma aşı rapeli', 'İç parazit', 'Dış parazit damlası', 'Genel kontrol', 'Kısırlaştırma sonrası kontrol', 'Diş taşı temizliği']) {
      assert.deepEqual(contentProblems(t), [], t);
    }
  });
});

describe('identityLine / optOutLine / composeMessage', () => {
  test('tacir: MERSİS; esnaf: ruhsat adı + VKN (Yön. m.8/3)', () => {
    assert.equal(identityLine(tacir), 'MERSIS:0123456789012345');
    assert.equal(identityLine(esnaf), 'Pati Veteriner VKN:12345678901');
    assert.equal(identityLine(DEFAULT_SETTINGS), '');
  });
  test('iptal satırı ret URL + telefon içerir (m.9/3), belirteç yoksa yalnızca telefon', () => {
    const line = optOutLine(tacir, 'abcdefabcdef', 'f'.repeat(32));
    assert.ok(line.startsWith('Iptal: http://localhost/ret/abcdefabcdef.' + 'f'.repeat(32)), line);
    assert.ok(line.endsWith('Tel:0212 555 00 00'));
    assert.equal(optOutLine(tacir, 'abcdefabcdef', ''), 'Iptal: Tel:0212 555 00 00');
  });
  test('nihai metin: nitelik ibaresi + gövde + kimlik + iptal; klinik kuyruğu kaldıramaz', () => {
    const m = composeMessage(tacir, 'Merhaba', { clinicId: 'abcdefabcdef', optOutToken: 'a'.repeat(32) });
    assert.equal(m, 'Bilgilendirme: Merhaba MERSIS:0123456789012345 Iptal: http://localhost/ret/abcdefabcdef.' + 'a'.repeat(32) + ' Tel:0212 555 00 00');
  });
  test('uzun gövde kırpılır, kuyruk korunur, toplam MAX_MESSAGE_LENGTH içinde', () => {
    const m = composeMessage(tacir, 'y'.repeat(600), { clinicId: 'abcdefabcdef', optOutToken: 'a'.repeat(32) });
    assert.ok(m.length <= MAX_MESSAGE_LENGTH);
    assert.ok(m.endsWith('Tel:0212 555 00 00'));
    assert.ok(m.includes('…'));
  });
});

describe('legalProblems', () => {
  test('eksik kimlik/beyan kilitler; tam kimlik açar', () => {
    assert.ok(legalProblems(DEFAULT_SETTINGS).length >= 2);
    assert.deepEqual(legalProblems(tacir), []);
    assert.deepEqual(legalProblems(esnaf), []);
    assert.ok(legalProblems({ ...tacir, mersis_no: '123' })[0].includes('MERSİS'));
    assert.ok(legalProblems({ ...esnaf, ruhsat_isim: '' })[0].includes('işletme adı'));
    assert.ok(legalProblems({ ...tacir, m61_declared_at: '' })[0].includes('beyan'));
    assert.ok(legalProblems({ ...tacir, clinic_phone: '' })[0].includes('telefon'));
  });
});
