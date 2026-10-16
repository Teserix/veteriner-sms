import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { setupEnv } from './helpers.js';

setupEnv();
const { bodyProblems, imitatesTail, containsUrl, lookalikeSkeleton, URL_PROBLEM, hasMandatoryTail, templateProblems, contentProblems, composeMessage, identityLine, optOutLine, normalizeTr, TEMPLATE_VARS } = await import('../src/sms/policy.js');
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

describe('gövdede iptal/ret satırı taklidi (imitatesTail / bodyProblems)', () => {
  const positives = [
    'İptal için kısa-link: bit.ly/x', 'IPTAL: x', 'iptal : 0212', 'İPTAL İÇİN KISA LİNK', 'Ret: tıklayın', 'RET için SMS gönderin',
    'kısa link ile çıkın', 'Kisa-Link verilmiştir', 'kısa bağlantı ekte', 'İptal linki aşağıda', 'ret bağlantısı: x',
    'SMS almamak için 1 yazın', 'SMS almak istemiyorsanız arayın', 'SMS istemiyorsanız yazın', 'Listeden çıkmak için yanıtlayın',
    'abonelikten çık', 'bkz. example.com/ret/abc', 'MERSIS:1234', 'VKN: 1', 'ıptal için lınk', 'Iptal icin tikla',
  ];
  const negatives = [
    'Sayın Mehmet Kaya, Boncuk için 10.09.2026 tarihinde aşı randevunuz vardır.',
    'Randevunuzu iptal etmek ya da ertelemek için kliniği arayabilirsiniz.',
    'Randevu iptali için lütfen bizi arayın.',
    'Boncuk kısa bir kontrol için bekleniyor.',
    'Kontrol sonrası sargının kısa sürede çıkarılması gerekir.',
    'Garanti: aşı kartınızı getirin.',
    'Ferret aşısı zamanı geldi.',
    'Pamuk için sıra numaranız: 12.',
  ];
  for (const t of positives) test('yakalar: ' + t, () => {
    assert.equal(imitatesTail(t), true, t);
    assert.ok(bodyProblems(t, tacir).some((p) => p.includes('iptal satırı')), t);
  });
  for (const t of negatives) test('yanlış pozitif yok: ' + t, () => {
    assert.equal(imitatesTail(t), false, t);
    assert.ok(!bodyProblems(t, tacir).some((p) => p.includes('iptal satırı')), t);
  });
});

describe('filtre sertleştirme: NFKC, görünmez karakter, benzer karakter', () => {
  const tail = (t) => bodyProblems(t, tacir).some((p) => p.includes('iptal satırı'));
  test('normalizeTr: NFKC tam genişlik ve görünmez karakterler', () => {
    assert.equal(normalizeTr('İPTAL：'), 'iptal:');
    assert.equal(normalizeTr('ＩＰＴＡＬ'), 'iptal');
    for (const z of ['\u200B', '\u200C', '\u200D', '\u200E', '\u200F', '\u2060', '\uFEFF', '\u00AD']) {
      assert.equal(normalizeTr(`ip${z}tal`), 'iptal', 'U+' + z.charCodeAt(0).toString(16));
    }
  });
  const positives = [
    'İptal： x', 'IPTAL：0212', 'ＩＰＴＡＬ: x', 'ip\u200Btal: x', 'ip\u00ADtal: x', 'İp\u2060tal için kısa-link', 'k\u200Dısa\uFEFF link',
    'iptaI: x', 'ipta1: x', '1ptal: x', '!ptal: x', '|ptal: x', 'IPTA1 İÇİN L1NK', 'kısa-1ink', 'SMS a1mamak için', 'l1steden çık',
    'ipta\u200B1：x', 'R3T: x',
  ];
  for (const t of positives) test('taklit yakalanır: ' + JSON.stringify(t), () => { assert.equal(imitatesTail(t), true); assert.ok(tail(t)); });
  const negatives = [
    'Sayın Ali, Boncuk için saat 10:30 randevunuz vardır.', 'Kilo: 4,5 kg; 15 ml şurup getirin.', 'Adres: Moda Cd. No:17 Kat:1',
    'Randevu iptali için 0212 555 00 00 numarasını arayın.', 'Lütfen 1 saat önce gelin.', 'Aşı kartı (l1) hazır.',
    'Pamuk 3 yaşına girdi, yıllık kontrol zamanı.', 'Yeni randevu tarihi: 12.10.2026', 'Ferret aşısı zamanı geldi.',
  ];
  for (const t of negatives) test('yanlış pozitif yok: ' + JSON.stringify(t), () => {
    assert.equal(imitatesTail(t), false);
    assert.deepEqual(bodyProblems(t, tacir), []);
  });
  test('iskelet yalnız denetim içindir: gönderilen metni değiştirmez', () => {
    assert.equal(lookalikeSkeleton('ipta1'), 'iptai');
    assert.ok(composeMessage(tacir, 'Saat 10:30 l1').includes('Saat 10:30 l1'));
  });
});

describe('gövdede URL reddi', () => {
  const positives = [
    'Bilgi: http://ornek.com', 'https://klinik.com.tr/randevu', 'HTTPS://X.Y', 'www.klinik.com', 'WWW.Klinik.Com', 'klinik.com.tr/randevu',
    'ornek.org/a', 'bit.ly', 'bit.ly/abc', 'Detay: tinyurl.com/x', 'goo.gl', 'cutt.ly/a', 't.co/x', 'is.gd', 'rb.gy/a', 's.id/a',
    'ｈｔｔｐｓ：／／ornek.com', 'ht\u200Btps://ornek.com', 'w\u200Bww.ornek.com', 'bit\u00AD.ly/x', 'BİT.LY/x',
  ];
  for (const t of positives) test('reddedilir: ' + JSON.stringify(t), () => {
    assert.equal(containsUrl(t), true);
    assert.ok(bodyProblems(t, tacir).includes(URL_PROBLEM));
    assert.ok(templateProblems(t).includes(URL_PROBLEM));
  });
  const negatives = [
    'Randevu 12.10.2026 saat 10.30da.', 'Dr. Ayşe Hanım sizi bekliyor.', 'Kilo 4.5 kg, doz 0.5 ml.', 'Aşı/kontrol günü yarın.',
    'Sayın {sahip}, {hayvan} için {tarih} {tur}. {klinik}', 'Moda Cd. No:17/2 Kadıköy', 'Aşı kartını getirin, kısa sürer.',
  ];
  for (const t of negatives) test('kabul edilir: ' + JSON.stringify(t), () => {
    assert.equal(containsUrl(t), false);
    assert.ok(!bodyProblems(t, tacir).includes(URL_PROBLEM));
  });
  test('sistemin ret bağlantısı gövde sayılmaz; kuyruk bozulmaz', () => {
    const body = 'Boncuk için aşı günü yarın.';
    const opts = { clinicId: 'abcdefabcdef', optOutToken: 'a'.repeat(32) };
    assert.deepEqual(bodyProblems(body, tacir, opts), []);
    const full = composeMessage(tacir, body, opts);
    assert.ok(/Iptal: https?:\/\/\S+\/ret\/abcdefabcdef\.a{32} Tel:/.test(full), full);
    assert.equal(hasMandatoryTail(full, tacir, opts.clinicId, opts.optOutToken), true);
    assert.equal(containsUrl(full), true); // tam metinde var, ama denetim yalnız gövdeye bakar
  });
});

describe('URL kaçışları: boşluklu alan adı, bozulmuş şema, eğik çizgisiz alan adı (PR #3 ONAY notu)', () => {
  const positives = [
    'bit . ly', 'bit .ly/x', 'BİT . LY', 'bit,ly', 'bit (.) ly', 'bit [.] ly', 'bit (dot) ly', 'bit nokta ly',
    'hxxp://ornek', 'hxxps://ornek.com', 'HXXP://x', 'h**p://ornek', 'http : // ornek', 'https:\\\\ornek', 'ftp://ornek',
    'klinik.com.tr', 'klinik.com', 'Klinik.Com.Tr', 'klinik . com . tr', 'klinik (nokta) com', 'klinik[.]com', 'ornek dot com',
    'Detay klinikvet.net adresinde', 'w w w.ornek', 'KLİNİK.COM.TR', 'randevu.app', 'ornek.vet',
  ];
  for (const t of positives) test('reddedilir: ' + JSON.stringify(t), () => {
    assert.equal(containsUrl(t), true);
    assert.ok(bodyProblems(t, tacir).includes(URL_PROBLEM));
    assert.ok(templateProblems(t).includes(URL_PROBLEM));
  });
  const negatives = [
    'Kedinizi de getirin, Tel: 0212', 'Aşı günü yarın. Lütfen gelin.', 'Pet sahibi. Pet kartını getirin.',
    'Kontrol 1 hafta sonra. Top oynamasın.', 'Saat: 10:30, kontrol', 'Boncuk, Pamuk ve Tarçın.', 'Randevu 12.10.2026 saat 10.30da.',
    'Aşı geldi. De gelin.', 'Moda Cd. No:17/2 Kadıköy', 'Doz 2.5 ml. Kontrol 3.gün.',
  ];
  for (const t of negatives) test('kabul edilir: ' + JSON.stringify(t), () => {
    assert.equal(containsUrl(t), false);
  });
});

describe('Siber Güvenlik listesi: görünmez karakter, tam genişlik, Yunanca/Kiril benzer harf, MERSIS-1', () => {
  const tails = ['iptal\u200b: x', 'i\u200bptal: x', 'ret\u00ad: x', 'ıptal： x', 'Ιptal: x', 'Ιπtal: x'.replace('π', 'p'), 'іptal: x', 'iptaI: x', 'ipta1: x', 'MERSIS-1', 'mersis 0123', 'VKN-12', 'TCKN 1'];
  for (const t of tails) test('reddedilir: ' + JSON.stringify(t), () => {
    assert.equal(imitatesTail(t), true);
    assert.ok(bodyProblems(t, tacir).some((p) => p.includes('MERSIS/VKN')));
  });
  for (const t of ['İptal için x.co/a', 'vazgeçmek için tıklayın bit.ly/q']) test('URL reddi: ' + JSON.stringify(t), () => {
    assert.equal(containsUrl(t), true);
  });
  for (const t of ['Randevunuzu iptal etmek için kliniği arayın.', 'Kontrol 2 hafta sonra. Ret yok.', 'Aşı 3. doz', 'Merhaba Ayşe Hanım, Boncuk için aşı günü.', 'Vergi bilgisi faturada.']) test('yasal metin kabul: ' + JSON.stringify(t), () => {
    assert.equal(imitatesTail(t), false);
    assert.equal(containsUrl(t), false);
  });
});
