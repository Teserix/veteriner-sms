/**
 * multipart/form-data okuyucu (bağımlılıksız). Gövde belleğe alınır, ardından
 * yerleşik Response#formData() ile ayrıştırılır. İlk dosya `file`, metin alanları `fields`.
 */

const MAX_FIELDS = 50;
const MAX_FIELD_LEN = 2000;

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let done = false;
    const finish = (fn) => { if (done) return; done = true; req.off('data', onData); fn(); };
    const onData = (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        // Kalan gövde okunmadan atılır; yanıt (413) yine de yazılabilsin diye bağlantı koparılmaz
        finish(() => { req.resume(); reject(httpError(413, 'Dosya çok büyük.')); });
        return;
      }
      chunks.push(chunk);
    };
    req.on('data', onData);
    req.once('end', () => finish(() => resolve(Buffer.concat(chunks))));
    req.once('error', (e) => finish(() => reject(e)));
    req.once('aborted', () => finish(() => reject(httpError(400, 'İstek yarıda kesildi.'))));
  });
}

/**
 * readMultipart(req, { maxBytes }) -> { fields: {name: string}, file: { filename, buffer } | null }
 * Content-Length sınırı aşıyorsa hemen, aksi halde akış sırasında sınır aşılınca 413 hatası fırlatır.
 */
export async function readMultipart(req, { maxBytes = 2 * 1024 * 1024 } = {}) {
  const ct = String(req.headers['content-type'] || '');
  if (!ct.toLowerCase().startsWith('multipart/form-data')) throw httpError(400, 'Form dosya yükleme biçiminde değil.');
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > maxBytes) throw httpError(413, 'Dosya çok büyük.');

  const body = await readBody(req, maxBytes);
  let form;
  try {
    form = await new Response(body, { headers: { 'content-type': ct } }).formData();
  } catch {
    throw httpError(400, 'Form verisi çözümlenemedi.');
  }

  const fields = {};
  let file = null;
  let count = 0;
  for (const [name, value] of form) {
    if (++count > MAX_FIELDS) break;
    if (typeof value === 'string') {
      if (!Object.hasOwn(fields, name)) fields[name] = value.slice(0, MAX_FIELD_LEN);
    } else if (!file) {
      file = { filename: String(value.name || 'dosya.csv').slice(0, 200), buffer: Buffer.from(await value.arrayBuffer()) };
    }
  }
  return { fields, file };
}
