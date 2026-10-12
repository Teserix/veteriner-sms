/**
 * İstemci (public/app.js) ve sunucu (src/sms/policy.js) SMS parça sayacı eşitliği.
 * app.js içindeki '// SMS-SAYAC-BASLA' ... '// SMS-SAYAC-BITIS' bloğu node:vm ile DOM olmadan çalıştırılır.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { smsSegments } from '../src/sms/policy.js';

const appSrc = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const { vectors } = JSON.parse(readFileSync(new URL('./fixtures/sms-segments.json', import.meta.url), 'utf8'));

function loadClient() {
  const start = appSrc.indexOf('// SMS-SAYAC-BASLA');
  const end = appSrc.indexOf('// SMS-SAYAC-BITIS');
  assert.ok(start !== -1 && end > start, 'sayaç işaretleri app.js içinde bulunamadı');
  const ctx = vm.createContext({});
  vm.runInContext(appSrc.slice(start, end) + '\nthis.smsSegments = smsSegments;', ctx);
  assert.equal(typeof ctx.smsSegments, 'function');
  // vm bağlamındaki nesne başka bir realm'den gelir; deepStrictEqual için düz nesneye çevrilir
  return (t, o) => ({ ...ctx.smsSegments(t, o) });
}

const textOf = (v) => (v.text != null ? v.text : v.char.repeat(v.count));

test('istemci sayacı fixture vektörlerinde beklenen değerleri ve sunucuyla aynı sonucu verir', () => {
  const client = loadClient();
  for (const v of vectors) {
    const t = textOf(v);
    const o = { turkishShift: !!v.turkishShift };
    const c = client(t, o);
    assert.deepStrictEqual(c, smsSegments(t, o), v.name);
    assert.equal(c.encoding, v.encoding, v.name);
    assert.equal(c.units, v.units, v.name);
    assert.equal(c.segments, v.segments, v.name);
  }
});

test('rastgele 500 dize (Türkçe/ASCII/genişletme karışımı): istemci = sunucu', () => {
  const client = loadClient();
  // Tekrarlanabilir sözde rastgele üreteç (mulberry32)
  let seed = 0x5eed1234;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const pools = [
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:;!?-()/\'"',
    'ÇÖÜçöüşğıİŞĞâî',
    '^{}\\[]~|€',
    'éèàñäØåΔΩ@£$¥§¿¡\n\r\t',
    '😀🐶’“”–',
  ];
  for (let n = 0; n < 500; n++) {
    // Çoğu dize yalnız GSM-7 olsun ki parça sınırları (160/153) da sınansın
    const gsmOnly = rnd() < 0.5;
    const len = Math.floor(rnd() * 480);
    let s = '';
    for (let i = 0; i < len; i++) {
      const r = rnd();
      const pool = gsmOnly ? (r < 0.9 ? pools[0] : pools[2]) : pools[r < 0.6 ? 0 : r < 0.8 ? 1 : r < 0.9 ? 2 : r < 0.97 ? 3 : 4];
      const chars = Array.from(pool);
      s += chars[Math.floor(rnd() * chars.length)];
    }
    for (const o of [{ turkishShift: false }, { turkishShift: true }]) {
      assert.deepStrictEqual(client(s, o), smsSegments(s, o), `dize #${n} ${JSON.stringify(o)}: ${JSON.stringify(s.slice(0, 40))}`);
    }
  }
});
