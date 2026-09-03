import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// mapping.js -> util.js -> config.js zinciri DATA_DIR altında klasör açar; geçici dizin kullan
process.env.SKIP_DOTENV = '1';
process.env.APP_SECRET = 'test-secret-test-secret-test-secret-1234';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'vet-csv-'));

const { parseCsv, detectDelimiter, csvCell, toCsv } = await import('../src/csv.js');
const { guessMapping, normalizeSpecies, normalizeSex, normalizeDate, TARGET_FIELDS } = await import('../src/import/mapping.js');

const buf = (s) => Buffer.from(s, 'utf8');

test('parseCsv: ";" ayraçlı', () => {
  const r = parseCsv(buf('Sahip;Telefon;Hayvan\nAyşe;0532 123 45 67;Boncuk\nAli;05331112233;Zeytin\n'));
  assert.equal(r.delimiter, ';');
  assert.equal(r.encoding, 'utf-8');
  assert.deepEqual(r.headers, ['Sahip', 'Telefon', 'Hayvan']);
  assert.deepEqual(r.rows, [['Ayşe', '0532 123 45 67', 'Boncuk'], ['Ali', '05331112233', 'Zeytin']]);
});

test('parseCsv: "," ayraçlı ve CRLF', () => {
  const r = parseCsv(buf('a,b,c\r\n1,2,3\r\n4,5,6'));
  assert.equal(r.delimiter, ',');
  assert.deepEqual(r.rows, [['1', '2', '3'], ['4', '5', '6']]);
});

test('parseCsv: sekme ayraçlı', () => {
  const r = parseCsv(buf('a\tb\n1\t2\n'));
  assert.equal(r.delimiter, '\t');
  assert.deepEqual(r.rows, [['1', '2']]);
});

test('parseCsv: tırnak içinde ayraç, kaçışlı tırnak ve satır sonu', () => {
  const r = parseCsv(buf('ad;not\n"Yılmaz; Ayşe";"çok ""iyi""\nhasta"\n'));
  assert.deepEqual(r.rows, [['Yılmaz; Ayşe', 'çok "iyi"\nhasta']]);
});

test('parseCsv: BOM temizlenir', () => {
  const r = parseCsv(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), buf('Sahip;Tel\nA;1\n')]));
  assert.deepEqual(r.headers, ['Sahip', 'Tel']);
});

test('parseCsv: windows-1254 (Şükrü) çözülür', () => {
  const body = Buffer.concat([buf('ad;tel\n'), Buffer.from([0xde, 0xfc, 0x6b, 0x72, 0xfc]), buf(';1\n')]);
  const r = parseCsv(body);
  assert.equal(r.encoding, 'windows-1254');
  assert.equal(r.rows[0][0], 'Şükrü');
});

test('parseCsv: NUL bayt reddedilir', () => {
  assert.throws(() => parseCsv(Buffer.concat([buf('a;b\n1;'), Buffer.from([0]), buf('2\n')])), /CSV gibi görünmüyor/);
});

test('parseCsv: boş satırlar atlanır, eksik hücreler tamamlanır, hücre 1000 karaktere kırpılır', () => {
  const long = 'x'.repeat(1200);
  const r = parseCsv(buf(`a;b;c\n\n;;\n1;${long}\n\n`));
  assert.equal(r.rows.length, 1);
  assert.deepEqual(r.rows[0], ['1', 'x'.repeat(1000), '']);
});

test('parseCsv: satır sınırı (5000)', () => {
  const ok = 'a;b\n' + Array.from({ length: 5000 }, (_, i) => `${i};x`).join('\n');
  assert.equal(parseCsv(buf(ok)).rows.length, 5000);
  assert.throws(() => parseCsv(buf(ok + '\n5000;x')), /En fazla 5000 satır/);
});

test('parseCsv: sütun sınırı (30) ve boş dosya', () => {
  assert.throws(() => parseCsv(buf(Array.from({ length: 31 }, (_, i) => 'c' + i).join(';') + '\n1\n')), /30 sütun/);
  assert.throws(() => parseCsv(buf('')), /boş/i);
  assert.throws(() => parseCsv(buf('a;b\n')), /veri satırı yok/);
});

test('detectDelimiter: tırnak içindeki ayraçlar sayılmaz', () => {
  assert.equal(detectDelimiter('a,b\n"x;y;z",1\n'), ',');
});

test('csvCell / toCsv: formül koruması ve tırnaklama', () => {
  assert.equal(csvCell('=SUM(1)'), "'=SUM(1)");
  assert.equal(csvCell('a;b'), '"a;b"');
  assert.equal(csvCell('a"b'), '"a""b"');
  const out = toCsv([['Satır', 'Hata'], [2, 'x;y']]);
  assert.ok(out.startsWith('﻿Satır;Hata\r\n2;"x;y"'));
});

test('guessMapping: Türkçe başlıklar', () => {
  const m = guessMapping(['Hasta Sahibi', 'Cep Telefonu', 'E-posta', 'Hayvan Adı', 'Tür', 'Irk', 'Cinsiyet', 'Doğum Tarihi', 'Not']);
  assert.equal(m.owner_name, 0);
  assert.equal(m.phone, 1);
  assert.equal(m.email, 2);
  assert.equal(m.pet_name, 3);
  assert.equal(m.species, 4);
  assert.equal(m.breed, 5);
  assert.equal(m.sex, 6);
  assert.equal(m.birth_date, 7);
  assert.equal(m.owner_notes, 8);
  assert.equal(m.pet_notes, null);
});

test('guessMapping: İngilizce başlıklar ve dışa aktarma biçimi', () => {
  const m = guessMapping(['Owner', 'Phone', 'Pet', 'Species', 'Breed', 'Sex', 'Birth']);
  assert.deepEqual([m.owner_name, m.phone, m.pet_name, m.species, m.breed, m.sex, m.birth_date], [0, 1, 2, 3, 4, 5, 6]);
  const e = guessMapping(['Sahip', 'Telefon', 'E-posta', 'SMS', 'Hayvan', 'Tür', 'Irk', 'Cinsiyet', 'Doğum']);
  assert.deepEqual([e.owner_name, e.phone, e.email, e.pet_name, e.species, e.breed, e.sex, e.birth_date], [0, 1, 2, 4, 5, 6, 7, 8]);
  assert.ok(Object.keys(TARGET_FIELDS).every((k) => k in e));
});

test('normalizeSpecies / normalizeSex / normalizeDate', () => {
  assert.equal(normalizeSpecies('kedi'), 'Kedi');
  assert.equal(normalizeSpecies('CAT'), 'Kedi');
  assert.equal(normalizeSpecies('kopek'), 'Köpek');
  assert.equal(normalizeSpecies('Dog'), 'Köpek');
  assert.equal(normalizeSpecies('kus'), 'Kuş');
  assert.equal(normalizeSpecies('Tavşan'), 'Tavşan');
  assert.equal(normalizeSpecies('hamster'), 'Hamster');
  assert.equal(normalizeSpecies('sürüngen'), 'Diğer');
  assert.equal(normalizeSpecies(''), null);
  assert.equal(normalizeSex('dişi'), 'Dişi');
  assert.equal(normalizeSex('F'), 'Dişi');
  assert.equal(normalizeSex('d'), 'Dişi');
  assert.equal(normalizeSex('erkek'), 'Erkek');
  assert.equal(normalizeSex('M'), 'Erkek');
  assert.equal(normalizeSex('e'), 'Erkek');
  assert.equal(normalizeSex('bilinmiyor'), null);
  assert.equal(normalizeDate('15.03.2020'), '2020-03-15');
  assert.equal(normalizeDate('2020-3-5'), '2020-03-05');
  assert.equal(normalizeDate('31/02/2020'), null);
  assert.equal(normalizeDate(''), null);
});
