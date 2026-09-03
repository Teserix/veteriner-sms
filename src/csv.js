/**
 * Küçük CSV ayrıştırıcı (RFC 4180): çift tırnak, tırnak içinde "" kaçışı ve satır sonu desteklenir.
 * Excel'in Türkçe ayarlarda ürettiği ";" ayraçlı ve windows-1254 kodlu dosyalar da okunur.
 */

export const CSV_LIMITS = Object.freeze({ maxRows: 5000, maxColumns: 30, maxCell: 1000 });

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

/**
 * Kayıtları ayrıştırır. Dönüş: { rows: string[][], lines: number[] } (lines[i] = kaydın başladığı kaynak satır, 1 tabanlı).
 * strict=true iken dosya tırnak içinde biterse hata fırlatır.
 */
function parseRecords(text, delim, { strict = true } = {}) {
  const rows = [];
  const lines = [];
  let row = [];
  let cell = '';
  let inQ = false;
  let started = false; // satırda en az bir karakter görüldü mü
  let lineNo = 1;
  let recordStart = 1;
  let quoteStart = 0;
  const n = text.length;
  const endRow = () => { row.push(cell); rows.push(row); lines.push(recordStart); row = []; cell = ''; started = false; recordStart = lineNo; };
  for (let i = 0; i < n; i++) {
    const c = text[i];
    if (!started) { started = true; recordStart = lineNo; }
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false;
      } else {
        if (c === '\n') lineNo++;
        else if (c === '\r') { lineNo++; if (text[i + 1] === '\n') { cell += c; i++; c = '\n'; } }
        cell += c;
      }
      continue;
    }
    if (c === '"' && cell === '') { inQ = true; quoteStart = lineNo; continue; }
    if (c === delim) { row.push(cell); cell = ''; continue; }
    if (c === '\r') { if (text[i + 1] === '\n') i++; lineNo++; endRow(); continue; }
    if (c === '\n') { lineNo++; endRow(); continue; }
    cell += c;
  }
  if (inQ && strict) {
    throw new Error(`Dosyada kapatılmamış tırnak var (satır ${quoteStart} civarı). Dosyayı Excel'de açıp "CSV UTF-8" olarak yeniden kaydedin.`);
  }
  if (started || cell !== '' || row.length) endRow();
  return { rows, lines };
}

/**
 * Ayraç seçimi: adaylardan, örnek satırlarda en tutarlı sütun sayısını (>1) veren kazanır.
 * Ham karakter sayımı, virgüllü dosyalarda hücre içindeki ";" yüzünden yanılabilir.
 */
export function detectDelimiter(text) {
  const sample = text.split(/\r\n|\r|\n/).filter((l) => l.trim() !== '').slice(0, 20).join('\n');
  let best = ';';
  let bestScore = -1;
  for (const d of DELIMITERS) {
    const { rows } = parseRecords(sample, d, { strict: false });
    if (!rows.length) continue;
    const headerCount = rows[0].length;
    if (headerCount < 2) continue;
    const consistent = rows.filter((r) => r.length === headerCount).length;
    const score = consistent * 1000 + headerCount;
    if (score > bestScore) { bestScore = score; best = d; }
  }
  return best;
}

/**
 * parseCsv(buffer) -> { headers, rows, lines, delimiter, encoding }
 * lines[i]: rows[i] kaydının kaynak dosyadaki satır numarası (hata raporları için).
 * Sınırlar: 5000 veri satırı, 30 sütun, hücre 1000 karakter (kırpılır). NUL bayt içeren dosya reddedilir.
 */
export function parseCsv(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (!bytes.length) throw new Error('Dosya boş.');
  if (bytes.includes(0)) throw new Error('Dosya CSV gibi görünmüyor (ikili içerik). Excel\'den "CSV UTF-8" olarak kaydedin.');
  const { text, encoding } = decode(bytes);
  const delimiter = detectDelimiter(text);
  const parsed = parseRecords(text, delimiter);

  const clean = [];
  const cleanLines = [];
  parsed.rows.forEach((r, i) => {
    const cells = r.map((c) => c.slice(0, CSV_LIMITS.maxCell));
    if (cells.every((c) => c.trim() === '')) return; // tamamen boş satır
    if (cells.length > CSV_LIMITS.maxColumns) throw new Error(`En fazla ${CSV_LIMITS.maxColumns} sütun desteklenir.`);
    clean.push(cells);
    cleanLines.push(parsed.lines[i]);
  });
  if (!clean.length) throw new Error('Dosyada başlık satırı bulunamadı.');
  const headers = clean[0].map((h) => h.trim());
  const rows = clean.slice(1);
  const lines = cleanLines.slice(1);
  if (rows.length > CSV_LIMITS.maxRows) throw new Error(`En fazla ${CSV_LIMITS.maxRows} satır içe aktarılabilir (dosyada ${rows.length} satır var). Dosyayı bölün.`);
  if (!rows.length) throw new Error('Dosyada başlık dışında veri satırı yok.');
  for (const r of rows) while (r.length < headers.length) r.push('');
  return { headers, rows, lines, delimiter, encoding };
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
