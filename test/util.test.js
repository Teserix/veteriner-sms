import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { setupEnv } from './helpers.js';

setupEnv();
const util = await import('../src/util.js');
const {
  normalizePhone, formatPhone, maskPhone, isValidEmail, escapeLike, parseDateFlexible, addDays,
  withFlash, returnTo, safeLocalPath, localDayStartIso, nowLocal, todayLocal, formatDate, formatDateTime,
  isValidDate, toInt, trim,
} = util;

describe('normalizePhone', () => {
  test('kabul edilen biçimler 905XXXXXXXXX olur', () => {
    assert.equal(normalizePhone('0532 123 45 67'), '905321234567');
    assert.equal(normalizePhone('5321234567'), '905321234567');
    assert.equal(normalizePhone('+90 532 123 45 67'), '905321234567');
    assert.equal(normalizePhone('0090 532 123 45 67'), '905321234567');
    assert.equal(normalizePhone('905321234567'), '905321234567');
    assert.equal(normalizePhone('(0532) 123-45-67'), '905321234567');
  });
  test('sabit hat, boş ve geçersizler null', () => {
    assert.equal(normalizePhone('0212 555 11 22'), null);
    assert.equal(normalizePhone(''), null);
    assert.equal(normalizePhone(null), null);
    assert.equal(normalizePhone(undefined), null);
    assert.equal(normalizePhone('abc'), null);
    assert.equal(normalizePhone('053212345'), null);
    assert.equal(normalizePhone('0532123456789'), null);
  });
});

describe('formatPhone / maskPhone', () => {
  test('formatPhone', () => {
    assert.equal(formatPhone('905321234567'), '0532 123 45 67');
    assert.equal(formatPhone(''), '');
    assert.equal(formatPhone(null), '');
    assert.equal(formatPhone('123'), '123');
  });
  test('maskPhone', () => {
    assert.equal(maskPhone('905321234567'), '90532*****67');
    assert.equal(maskPhone('123'), '***');
    assert.equal(maskPhone(''), '***');
    assert.ok(!maskPhone('905321234567').includes('1234567'));
  });
});

describe('isValidEmail / escapeLike', () => {
  test('isValidEmail', () => {
    assert.equal(isValidEmail('a@b.co'), true);
    assert.equal(isValidEmail('ayse@pati.test'), true);
    assert.equal(isValidEmail('a@b'), false);
    assert.equal(isValidEmail('a b@c.com'), false);
    assert.equal(isValidEmail(''), false);
    assert.equal(isValidEmail(null), false);
  });
  test('escapeLike', () => {
    assert.equal(escapeLike('50%_\\'), '50\\%\\_\\\\');
    assert.equal(escapeLike('Mehmet'), 'Mehmet');
    assert.equal(escapeLike(''), '');
    assert.equal(escapeLike(null), '');
  });
});

describe('tarih', () => {
  test('parseDateFlexible', () => {
    assert.equal(parseDateFlexible('03.09.2026'), '2026-09-03');
    assert.equal(parseDateFlexible('3.9.2026'), '2026-09-03');
    assert.equal(parseDateFlexible('03/09/2026'), '2026-09-03');
    assert.equal(parseDateFlexible('2026-09-03'), '2026-09-03');
    assert.equal(parseDateFlexible('2026-9-3'), '2026-09-03');
    assert.equal(parseDateFlexible(' 03.09.2026 '), '2026-09-03');
    assert.equal(parseDateFlexible('31.02.2026'), null);
    assert.equal(parseDateFlexible('2026-02-31'), null);
    assert.equal(parseDateFlexible('abc'), null);
    assert.equal(parseDateFlexible(''), null);
    assert.equal(parseDateFlexible(null), null);
  });
  test('isValidDate', () => {
    assert.equal(isValidDate('2026-09-03'), true);
    assert.equal(isValidDate('2026-02-31'), false);
    assert.equal(isValidDate('03.09.2026'), false);
  });
  test('addDays', () => {
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(addDays('2026-03-01', -1), '2026-02-28');
    assert.equal(addDays('2026-09-03', 365), '2027-09-03');
    assert.equal(addDays('2026-09-03', '7'), '2026-09-10');
  });
  test('formatDate / formatDateTime', () => {
    assert.equal(formatDate('2026-09-03'), '03.09.2026');
    assert.equal(formatDate(''), '');
    assert.equal(formatDate('x'), 'x');
    assert.equal(formatDateTime('2026-09-02T23:30:00Z'), '03.09.2026 02:30');
    assert.equal(formatDateTime(''), '');
  });
  test('localDayStartIso: İstanbul 00:00 = UTC 21:00 önceki gün', () => {
    assert.equal(localDayStartIso('2026-09-03'), '2026-09-02T21:00:00.000Z');
  });
  test('nowLocal: UTC+3 kaydırma günü değiştirir', () => {
    assert.deepEqual(nowLocal(new Date('2026-09-02T23:30:00Z')), { date: '2026-09-03', hour: 2 });
    assert.deepEqual(nowLocal(new Date('2026-09-03T09:00:00Z')), { date: '2026-09-03', hour: 12 });
    assert.deepEqual(nowLocal(new Date('2026-09-03T21:00:00Z')), { date: '2026-09-04', hour: 0 });
    assert.equal(todayLocal(new Date('2026-09-02T23:30:00Z')), '2026-09-03');
  });
});

describe('girdi yardımcıları', () => {
  test('toInt / trim', () => {
    assert.equal(toInt('12'), 12);
    assert.equal(toInt('abc'), null);
    assert.equal(toInt('abc', 5), 5);
    assert.equal(toInt(undefined, 0), 0);
    assert.equal(trim('  ab  '), 'ab');
    assert.equal(trim(null), '');
    assert.equal(trim('abcdef', 3), 'abc');
  });
});

describe('yönlendirme', () => {
  test('withFlash eski ok/err siler, tek flash ekler', () => {
    const out = withFlash('/sahipler/1?ok=eski&err=hata&q=z', 'ok', 'Kaydedildi.');
    const u = new URL(out, 'http://local');
    assert.equal(u.pathname, '/sahipler/1');
    assert.equal(u.searchParams.get('ok'), 'Kaydedildi.');
    assert.equal(u.searchParams.has('err'), false);
    assert.equal(u.searchParams.get('q'), 'z');
    assert.ok(out.startsWith('/sahipler/1?'));

    const err = withFlash('/sahipler/1?ok=x', 'err', 'Olmadı');
    const u2 = new URL(err, 'http://local');
    assert.equal(u2.searchParams.get('err'), 'Olmadı');
    assert.equal(u2.searchParams.has('ok'), false);
    // 300 karakter sınırı
    const long = withFlash('/x', 'ok', 'a'.repeat(400));
    assert.equal(new URL(long, 'http://local').searchParams.get('ok').length, 300);
  });

  const fakeReq = (headers) => ({ get: (h) => headers[String(h).toLowerCase()] });

  test('returnTo aynı host referer kabul eder', () => {
    const req = fakeReq({ host: 'localhost:3303', referer: 'http://localhost:3303/sahipler/1?ok=x' });
    assert.equal(returnTo(req, '/fb'), '/sahipler/1?ok=x');
  });
  test('returnTo yabancı host reddeder, referer yoksa fallback', () => {
    const req = fakeReq({ host: 'localhost:3303', referer: 'https://evil.example/x' });
    assert.equal(returnTo(req, '/fb'), '/fb');
    assert.equal(returnTo(fakeReq({ host: 'localhost:3303' }), '/fb'), '/fb');
    assert.equal(returnTo(fakeReq({ host: 'localhost:3303', referer: 'not a url' }), '/fb'), '/fb');
  });
  test('safeLocalPath', () => {
    assert.equal(safeLocalPath('/sahipler/1'), '/sahipler/1');
    assert.equal(safeLocalPath('//evil.example'), '/');
    assert.equal(safeLocalPath('/\\evil.example'), '/');
    assert.equal(safeLocalPath('https://evil.example'), '/');
    assert.equal(safeLocalPath('/x\r\nSet-Cookie: a=b'), '/');
    assert.equal(safeLocalPath(''), '/');
    assert.equal(safeLocalPath(undefined, '/geri'), '/geri');
  });
});
