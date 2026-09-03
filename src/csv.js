/**
 * Küçük CSV ayrıştırıcı (RFC 4180): çift tırnak, tırnak içinde "" kaçışı ve satır sonu desteklenir.
 * Excel'in Türkçe ayarlarda ürettiği ";" ayraçlı ve windows-1254 kodlu dosyalar da okunur.
 */

export const CSV_LIMITS = Object.freeze({ maxRows: 5000, maxColumns: 30, maxCell: 200 });

const DELIMITERS = [';', ',', '\t'];

function decode(buffer) {
  let bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) bytes = bytes.subarray(3);
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8' };
  } catch {
    return { text: new TextDecoder('windows-1254').decode(bytes), encoding: 'windows-1254' };
  }
}

/** İlk dolu satırlarda en sık geçen ayraç; hiçbiri yoksa ";" */
export function detectDelimiter(text) {
  const lines = text.split(/\r\n|\r|\n/).filter((l) => l.trim() !== '').slice(0, 20);
  const counts = Object.fromEntries(DELIMITERS.map((d) => [d, 0]));
  for (const line of lines) {
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') inQ = !inQ;
      else if (!inQ && Object.hasOwn(counts, ch)) counts[ch]++;
    }
  }
  let best = ';';
  for (const d of DELIMITERS) if (counts[d] > counts[best]) best = d;
  return best;
}

function parseRecords(text, delim) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQ = false;
  let started = false; // satırda en az bir karakter/hücre görüldü mü
  const n = text.length;
  const endRow = () => { row.push(cell); rows.push(row); row = []; cell = ''; started = false; };
  for (let i = 0; i < n; i++) {
    const c = text[i];
    started = true;
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false;
      } else cell += c;
      continue;
    }
    if (c === '"' && cell === '') { inQ = true; continue; }
    if (c === delim) { row.push(cell); cell = ''; continue; }
    if (c === '\r') { if (text[i + 1] === '\n') i++; endRow(); continue; }
    if (c === '\n') { endRow(); continue; }
    cell += c;
  }
  if (started || cell !== '' || row.length) endRow();
  return rows;
}

/**
 * parseCsv(buffer) -> { headers, rows, delimiter, encoding }
 * Sınırlar: 5000 veri satırı, 30 sütun, hücre 200 karakter (kırpılır). NUL bayt içeren dosya reddedilir.
 */
export function parseCsv(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (!bytes.length) throw new Error('Dosya boş.');
  if (bytes.includes(0)) throw new Error('Dosya CSV gibi görünmüyor (ikili içerik). Excel\'den "CSV UTF-8" olarak kaydedin.');
  const { text, encoding } = decode(bytes);
  const delimiter = detectDelimiter(text);
  const raw = parseRecords(text, delimiter);

  const clean = [];
  for (const r of raw) {
    const cells = r.map((c) => c.slice(0, CSV_LIMITS.maxCell));
    if (cells.every((c) => c.trim() === '')) continue; // tamamen boş satır
    if (cells.length > CSV_LIMITS.maxColumns) throw new Error(`En fazla ${CSV_LIMITS.maxColumns} sütun desteklenir.`);
    clean.push(cells);
  }
  if (!clean.length) throw new Error('Dosyada başlık satırı bulunamadı.');
  const headers = clean[0].map((h) => h.trim());
  const rows = clean.slice(1);
  if (rows.length > CSV_LIMITS.maxRows) throw new Error(`En fazla ${CSV_LIMITS.maxRows} satır içe aktarılabilir (dosyada ${rows.length} satır var). Dosyayı bölün.`);
  if (!rows.length) throw new Error('Dosyada başlık dışında veri satırı yok.');
  for (const r of rows) while (r.length < headers.length) r.push('');
  return { headers, rows, delimiter, encoding };
}

/** CSV hücresi: formül enjeksiyonu koruması + gerektiğinde tırnaklama */
export function csvCell(v, delim = ';') {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (s.includes('"') || s.includes(delim) || /[\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/** Satır dizilerinden BOM'lu, ";" ayraçlı CSV metni üretir */
export function toCsv(rows, delim = ';') {
  return '﻿' + rows.map((r) => r.map((c) => csvCell(c, delim)).join(delim)).join('\r\n');
}
