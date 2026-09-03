import { Router } from 'express';
import { randomToken, safeEqual } from '../crypto.js';
import { limiters } from '../ratelimit.js';
import { audit } from '../audit.js';
import { log } from '../log.js';
import { withFlash, toInt } from '../util.js';
import { parseCsv, toCsv, CSV_LIMITS } from '../csv.js';
import { readMultipart } from '../upload.js';
import { TARGET_FIELDS, FIELD_KEYS, guessMapping } from '../import/mapping.js';
import { classifyRows, summarize, applyImport, ACTION_LABELS } from '../import/apply.js';

/**
 * CSV içe aktarma (WP7). /iceaktar altında; klinik yöneticisi rolü app.js'te zorunlu.
 * Yüklenen dosya diske yazılmaz; bellek içi "parti" (batch) olarak 30 dakika tutulur.
 */
export const importRouter = Router();

const BATCH_TTL_MS = 30 * 60 * 1000;
const MAX_BATCHES_PER_CLINIC = 5;
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;

/** token -> { clinicId, filename, headers, rows, mapping, createdAt, expiresAt } (testler için dışa açık) */
export const _batches = new Map();

function cleanup(now = Date.now()) {
  for (const [t, b] of _batches) if (b.expiresAt <= now) _batches.delete(t);
}

function storeBatch(clinicId, data) {
  cleanup();
  const own = [..._batches.entries()].filter(([, b]) => b.clinicId === clinicId).sort((a, b) => a[1].createdAt - b[1].createdAt);
  while (own.length >= MAX_BATCHES_PER_CLINIC) _batches.delete(own.shift()[0]);
  const token = randomToken(24);
  const now = Date.now();
  _batches.set(token, { clinicId, mapping: null, ...data, createdAt: now, expiresAt: now + BATCH_TTL_MS });
  return token;
}

function notFound(res) {
  return res.status(404).render('error', { title: 'Bulunamadı', message: 'İçe aktarma oturumu bulunamadı ya da süresi doldu. Dosyayı yeniden yükleyin.' });
}

/** Parti belirteci bu kliniğe ait ve süresi geçmemişse yükler; aksi halde 404 */
function loadBatch(req, res, next) {
  cleanup();
  const token = String(req.params.token || '');
  const b = TOKEN_RE.test(token) ? _batches.get(token) : null;
  if (!b || b.clinicId !== req.user.clinicId) return notFound(res);
  req.batch = b;
  req.batchToken = token;
  next();
}

/* ---------- 1) Yükleme ---------- */
importRouter.get('/', (req, res) => {
  res.render('import_upload', { title: 'CSV içe aktar', limits: CSV_LIMITS, maxMb: MAX_UPLOAD_BYTES / (1024 * 1024) });
});

/** multipart gövdeyi okur, req.body'yi doldurur ve CSRF'i burada doğrular (genel ara katman multipart'ı atlar) */
async function multipartCsrf(req, res, next) {
  try {
    const { fields, file } = await readMultipart(req, { maxBytes: MAX_UPLOAD_BYTES });
    req.body = fields;
    req.file = file;
  } catch (e) {
    if (e.status === 413) return res.status(413).render('error', { title: 'Dosya çok büyük', message: `Dosya en fazla ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB olabilir.` });
    return res.status(e.status || 400).render('error', { title: 'Hata', message: e.message || 'Form verisi okunamadı.' });
  }
  if (!safeEqual(req.body._csrf, req.session?.csrf)) {
    return res.status(403).render('error', { title: 'Güvenlik hatası', message: 'Form belirteci geçersiz. Sayfayı yenileyip tekrar deneyin.' });
  }
  next();
}

// Sıra: gövde+CSRF (2 MB tavanlı, ucuz) -> klinik başına saatlik yükleme sınırı -> ayrıştırma.
// Böylece sahte/CSRF'siz ya da çok büyük istekler kliniğin hakkını tüketmez; genel POST sınırı zaten IP'yi korur.
importRouter.post('/',
  multipartCsrf,
  limiters.importUpload.middleware((req) => 'clinic:' + req.user.clinicId, 'Saatte en fazla 5 dosya yükleyebilirsiniz. Lütfen biraz sonra tekrar deneyin.'),
  (req, res) => {
    if (!req.file || !req.file.buffer.length) return res.redirect(withFlash('/iceaktar', 'err', 'Bir CSV dosyası seçin.'));
    let parsed;
    try {
      parsed = parseCsv(req.file.buffer);
    } catch (e) {
      return res.redirect(withFlash('/iceaktar', 'err', e.message));
    }
    const token = storeBatch(req.user.clinicId, {
      filename: req.file.filename,
      headers: parsed.headers,
      rows: parsed.rows,
      delimiter: parsed.delimiter,
      encoding: parsed.encoding,
    });
    log.info('csv yüklendi', { clinicId: req.user.clinicId, rows: parsed.rows.length, columns: parsed.headers.length, encoding: parsed.encoding });
    res.redirect(`/iceaktar/${token}/eslestir`);
  });

/* ---------- 2) Sütun eşleştirme ---------- */
importRouter.get('/:token/eslestir', loadBatch, (req, res) => {
  const b = req.batch;
  res.render('import_map', {
    title: 'Sütunları eşleştir',
    token: req.batchToken,
    batch: b,
    fields: TARGET_FIELDS,
    mapping: b.mapping || guessMapping(b.headers),
    preview: b.rows.slice(0, 5),
    error: null,
  });
});

importRouter.post('/:token/eslestir', loadBatch, (req, res) => {
  const b = req.batch;
  const mapping = {};
  const used = new Map();
  const problems = [];
  for (const key of FIELD_KEYS) {
    const raw = String(req.body[`map_${key}`] ?? '');
    const idx = raw === '' ? null : toInt(raw);
    if (idx != null && (idx < 0 || idx >= b.headers.length)) { problems.push(`${TARGET_FIELDS[key].label}: geçersiz sütun.`); continue; }
    if (idx != null && used.has(idx)) problems.push(`"${b.headers[idx]}" sütunu hem ${TARGET_FIELDS[used.get(idx)].label} hem ${TARGET_FIELDS[key].label} için seçilmiş.`);
    if (idx != null) used.set(idx, key);
    if (idx == null && TARGET_FIELDS[key].required) problems.push(`${TARGET_FIELDS[key].label} için bir sütun seçin.`);
    mapping[key] = idx;
  }
  if (problems.length) {
    return res.status(400).render('import_map', {
      title: 'Sütunları eşleştir', token: req.batchToken, batch: b, fields: TARGET_FIELDS, mapping, preview: b.rows.slice(0, 5), error: problems.join(' '),
    });
  }
  b.mapping = mapping;
  res.redirect(`/iceaktar/${req.batchToken}/onizle`);
});

/* ---------- 3) Önizleme ---------- */
importRouter.get('/:token/onizle', loadBatch, (req, res) => {
  const b = req.batch;
  if (!b.mapping) return res.redirect(`/iceaktar/${req.batchToken}/eslestir`);
  const classified = classifyRows(req.db, b.rows, b.mapping);
  const counts = summarize(classified);
  res.render('import_preview', {
    title: 'Önizleme',
    token: req.batchToken,
    batch: b,
    list: classified,
    counts,
    labels: ACTION_LABELS,
    canApply: counts.new_owner + counts.add_pet > 0,
  });
});

/* ---------- 4) Onay / uygulama ---------- */
importRouter.post('/:token/onayla', loadBatch, (req, res) => {
  const b = req.batch;
  if (!b.mapping) return res.redirect(`/iceaktar/${req.batchToken}/eslestir`);
  const classified = classifyRows(req.db, b.rows, b.mapping);
  const counts = applyImport(req.db, classified, { batchToken: req.batchToken, createdBy: req.user.email });
  _batches.delete(req.batchToken);
  audit(req, 'import.apply', { meta: { ...counts, rows: classified.length } });
  log.info('içe aktarma tamamlandı', { clinicId: req.user.clinicId, ...counts });
  const msg = `İçe aktarma tamamlandı: ${counts.owners} yeni sahip, ${counts.pets} hayvan eklendi; ${counts.skipped} satır zaten kayıtlıydı, ${counts.errors} satır hatalı.`;
  res.redirect(withFlash('/sahipler', 'ok', msg));
});

/* ---------- Hatalı satırlar (CSV) ---------- */
importRouter.get('/:token/hatalar.csv', loadBatch, (req, res) => {
  const b = req.batch;
  if (!b.mapping) return res.redirect(`/iceaktar/${req.batchToken}/eslestir`);
  const errors = classifyRows(req.db, b.rows, b.mapping).filter((r) => r.action === 'error');
  const rows = [['Satır', 'Sahip', 'Telefon', 'E-posta', 'Hayvan', 'Hata']];
  for (const r of errors) rows.push([r.rowNo, r.owner_name, r.phoneRaw, r.email || '', r.pet_name, r.reason]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="iceaktar-hatalar.csv"');
  res.send(toCsv(rows, ';'));
});
