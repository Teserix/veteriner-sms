import { config } from '../config.js';
import { renderTemplate, MAX_MESSAGE_LENGTH } from './index.js';

/**
 * SMS içerik politikası ve zorunlu kuyruk.
 *
 * Hatırlatma SMS'i hukuken ticari elektronik iletidir; onay muafiyeti (Ticari İletişim Yön. m.6/1)
 * yalnızca "temin edilen hizmete ilişkin bakım" bilgilendirmesi olduğu sürece geçerlidir. Bu dosya:
 *  - şablonda tanıtım/özendirme, ilaç ticari adı ve teşhis geçmesini engeller
 *    (m.6/1 sınırı; 6343 m.9 ve TVHB Uyg. Yön. m.97 reklam yasağı; VTÜ Yön. m.37/1; TVHB m.68 meslek sırrı),
 *  - her iletiye kaldırılamaz kuyruk ekler: niteliği belirten ibare (m.8/6), gönderen kimliği
 *    (m.8/3: tacir MERSİS / esnaf ad + VKN-TCKN), erişilebilir iletişim bilgisi (m.8/5) ve ret imkânı (m.9/3-4).
 * Klinik yalnızca gövdeyi yazar; kuyruk sistem tarafından eklenir.
 */

export const TEMPLATE_VARS = Object.freeze(['sahip', 'hayvan', 'tarih', 'tur', 'klinik', 'klinik_tel']);
export const MAX_BODY_LENGTH = 320;
const PREFIX = 'Bilgilendirme: ';

/** Türkçe harf ve aksan farklarını düzleştirir: "İNDİRİM" -> "indirim", "Ücretsiz" -> "ucretsiz" */
export function normalizeTr(s) {
  return String(s || '')
    .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
    .toLowerCase()
    .replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/̇/g, '') // "i̇" birleşik nokta
    .replace(/\s+/g, ' ');
}

const AD = 'TVHB Uyg. Yön. m.97 (maddi avantaj/özendirme ifadesi) ve Ticari İletişim Yön. m.6/1 sınırı';
const DRUG = 'Veteriner Tıbbi Ürünler Yön. m.37/1 (ilaç ticari adıyla tanıtım yasağı)';
const SECRET = 'TVHB Uyg. Yön. m.68 / 6343 m.41-h (meslek sırrı: teşhis SMS ile paylaşılamaz)';

/** Yasaklı desenler: normalizeTr() çıktısına uygulanır */
export const BANNED_PATTERNS = Object.freeze([
  { re: /\bindirim/, label: 'indirim', why: AD },
  { re: /\bkampanya/, label: 'kampanya', why: AD },
  { re: /\bpromosyon/, label: 'promosyon', why: AD },
  { re: /\bfirsat/, label: 'fırsat', why: AD },
  { re: /\bhediye/, label: 'hediye', why: AD },
  { re: /\bucretsiz/, label: 'ücretsiz', why: AD },
  { re: /\bbedava/, label: 'bedava', why: AD },
  { re: /\bavantaj/, label: 'avantaj', why: AD },
  { re: /\bozel fiyat/, label: 'özel fiyat', why: AD },
  { re: /\btanitim/, label: 'tanıtım', why: AD },
  { re: /\byeni hizmet/, label: 'yeni hizmet', why: AD },
  { re: /\bkutlu olsun/, label: 'kutlu olsun (kutlama/temenni iletisi onaya tabidir, m.5/1)', why: AD },
  { re: /\bdogum gun/, label: 'doğum günü (kutlama iletisi onaya tabidir, m.5/1)', why: AD },
  { re: /\d\s*%|%\s*\d/, label: 'yüzde ifadesi', why: AD },
  { re: /\b\d+([.,]\d+)?\s*(tl|₺|lira)\b/, label: 'fiyat', why: AD },
  { re: /\b\d\s*al(in)?\s*\d\s*ode/, label: '"2 al 1 öde"', why: AD },
]);

/** Yaygın veteriner tıbbi ürün ticari adları (başlangıç listesi; ayarlardan genişletilebilir) */
export const DRUG_BRANDS = Object.freeze([
  'nobivac', 'eurican', 'purevax', 'felocell', 'vanguard', 'rabisin', 'fevaxyn', 'versican', 'biocan', 'canigen', 'feligen',
  'bravecto', 'nexgard', 'simparica', 'frontline', 'advocate', 'advantix', 'revolution', 'stronghold', 'seresto', 'credelio',
  'drontal', 'milbemax', 'profender', 'panacur', 'endogard', 'dolpac', 'cestal', 'broadline',
]);

/** Teşhis / klinik durum terimleri: SMS gövdesinde geçemez */
export const DIAGNOSIS_TERMS = Object.freeze([
  'tumor', 'kanser', 'parvo', 'distemper', 'gencik', 'fip', 'felv', 'fiv', 'losemi', 'lenfoma', 'diyabet', 'epilepsi',
  'bobrek yetmezligi', 'karaciger yetmezligi', 'kalp yetmezligi', 'leishmania', 'ehrlichia', 'babesia', 'kuduz suphesi',
  'teshis', 'tani konuldu', 'hastaligi', 'enfeksiyon', 'mantar', 'uyuz', 'demodex', 'piyometra', 'pyometra',
]);

/** Yalnızca içerik denetimi (şablon, hatırlatma başlığı gibi serbest metinler için). Sorun listesi döner. */
export function contentProblems(text) {
  const n = normalizeTr(text);
  const out = [];
  for (const b of BANNED_PATTERNS) if (b.re.test(n)) out.push(`"${b.label}" ifadesi kullanılamaz — ${b.why}.`);
  for (const d of DRUG_BRANDS) if (new RegExp(`\\b${d}\\b`).test(n)) out.push(`İlaç ticari adı geçiyor ("${d}") — ${DRUG}.`);
  for (const t of DIAGNOSIS_TERMS) if (new RegExp(`\\b${t}\\b`).test(n)) out.push(`Teşhis/hastalık ifadesi geçiyor ("${t}") — ${SECRET}.`);
  return out;
}

/** Şablon denetimi: boş, uzun, bilinmeyen değişken ve içerik ihlalleri */
export function templateProblems(template) {
  const t = String(template || '').trim();
  if (!t) return ['Mesaj şablonu boş olamaz.'];
  const out = [];
  if (t.length > MAX_BODY_LENGTH) out.push(`Şablon en fazla ${MAX_BODY_LENGTH} karakter olabilir (kimlik ve iptal satırı sistemce eklenir).`);
  const unknown = [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((k) => !TEMPLATE_VARS.includes(k));
  if (unknown.length) out.push(`Bilinmeyen değişken: {${[...new Set(unknown)].join('}, {')}}. Kullanılabilir: {${TEMPLATE_VARS.join('}, {')}}.`);
  out.push(...contentProblems(t));
  return out;
}

/** Gönderen kimliği satırı (m.8/3). Kimlik eksikse boş döner; dispatch zaten kilitler. */
export function identityLine(settings) {
  if (settings.legal_form === 'tacir' && settings.mersis_no) return `MERSIS:${settings.mersis_no}`;
  if (settings.legal_form === 'esnaf' && settings.tax_id) return `${String(settings.ruhsat_isim || '').trim()} VKN:${settings.tax_id}`.trim();
  return '';
}

export function optOutUrl(clinicId, token) {
  if (!token || !config.appOrigin) return '';
  return `${config.appOrigin}/ret/${clinicId}.${token}`;
}

/** Ret satırı (m.9/3): rette özgülenmiş URL + kliniğin telefonu (aynı kanaldan ve ücretsiz ret için) */
export function optOutLine(settings, clinicId, token) {
  const url = optOutUrl(clinicId, token);
  const tel = String(settings.clinic_phone || '').trim();
  const parts = [];
  if (url) parts.push(url);
  if (tel) parts.push(`Tel:${tel}`);
  return parts.length ? `Iptal: ${parts.join(' ')}` : '';
}

function tailOf(settings, clinicId, optOutToken) {
  const identity = identityLine(settings);
  const optOut = optOutLine(settings, clinicId, optOutToken);
  return { identity, optOut, tail: [identity, optOut].filter(Boolean).join(' ') };
}

/** composeMessage'in parçalı hâli: önizleme ve gönderim aynı birleştirmeyi kullanır */
function composeParts(settings, body, { clinicId = '', optOutToken = '' } = {}) {
  const { identity, optOut, tail } = tailOf(settings, clinicId, optOutToken);
  const room = MAX_MESSAGE_LENGTH - PREFIX.length - (tail ? tail.length + 1 : 0);
  let b = String(body || '').replace(/\s+/g, ' ').trim();
  if (b.length > room) b = b.slice(0, Math.max(0, room - 1)).trimEnd() + '…';
  return { prefix: PREFIX, body: b, identity, optOut, full: `${PREFIX}${b}${tail ? ' ' + tail : ''}` };
}

/**
 * Nihai SMS metni: "Bilgilendirme: <gövde> <kimlik> <iptal>". Toplam MAX_MESSAGE_LENGTH'i aşarsa gövde kırpılır;
 * kuyruk asla kırpılmaz. (Kullanıcının düzenlediği gövde bodyProblems ile önceden reddedilir; kırpılmaz.)
 */
export function composeMessage(settings, body, opts = {}) {
  return composeParts(settings, body, opts).full;
}

/**
 * Gönderilecek tam metnin parçaları. Önizleme ekranı ve gönderim (composeFromTemplate -> buildMessage) bunu kullanır;
 * böylece önizlenen metin ile gönderilen metin aynı fonksiyondan çıkar.
 * bodyOverride verilirse şablon yerine kullanıcının düzenlediği gövde kullanılır (önek ve kuyruk yine sistemce eklenir).
 */
export function previewParts(settings, vars, { clinicId = '', optOutToken = '', bodyOverride } = {}) {
  const originalBody = renderTemplate(settings.template, vars);
  const source = bodyOverride ?? originalBody;
  const parts = composeParts(settings, source, { clinicId, optOutToken });
  return {
    ...parts,
    segments: smsSegments(parts.full),
    edited: bodyOverride != null && String(bodyOverride).trim() !== String(originalBody).trim(),
    originalBody,
    maxBodyLength: MAX_BODY_LENGTH,
  };
}

/** Şablon + değişkenler + kuyruk (hatırlatma ve önizleme bunu kullanır); opts.bodyOverride kabul eder */
export function composeFromTemplate(settings, vars, opts) {
  return previewParts(settings, vars, opts).full;
}

/**
 * Kullanıcının düzenlediği gövdenin denetimi (sorun listesi döner; boş liste = geçerli).
 * Gövde kırpılmaz: toplam uzunluk aşılırsa hata verilir. Gövde kimlik/iptal satırını taklit edemez
 * (alıcı sahte bir "Iptal:" bağlantısıyla yanıltılmasın; m.8/3, m.9/3).
 */
export function bodyProblems(body, settings, { clinicId = '', optOutToken = '' } = {}) {
  const raw = String(body ?? '');
  const b = raw.trim();
  if (!b) return ['Mesaj gövdesi boş olamaz.'];
  const out = [];
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F-\u009F]/.test(raw)) out.push('Mesaj gövdesinde satır sonu, sekme veya kontrol karakteri olamaz.');
  if (b.length > MAX_BODY_LENGTH) out.push(`Mesaj gövdesi en fazla ${MAX_BODY_LENGTH} karakter olabilir.`);
  const { tail } = tailOf(settings || {}, clinicId, optOutToken);
  const total = PREFIX.length + b.length + (tail ? tail.length + 1 : 0);
  if (total > MAX_MESSAGE_LENGTH) out.push(`Kimlik ve iptal satırıyla birlikte mesaj ${MAX_MESSAGE_LENGTH} karakteri aşıyor (${total}); gövdeyi kısaltın.`);
  if (/\b(mersis|vkn|iptal)\s*:/.test(normalizeTr(b))) out.push('Gövde kimlik (MERSIS/VKN) veya iptal satırı içeremez; bu satırlar sistemce eklenir.');
  out.push(...contentProblems(b));
  return out;
}

/**
 * Gönderimden hemen önce son kilit: metin önekle başlamalı ve gerçek kimlik + iptal kuyruğuyla bitmeli.
 * Kimlik satırı boşsa (hukuki kimlik eksik) false döner.
 */
export function hasMandatoryTail(message, settings, clinicId = '', token = '') {
  const m = String(message || '');
  const { identity, optOut, tail } = tailOf(settings || {}, clinicId, token);
  if (!identity || !optOut) return false;
  return m.startsWith(PREFIX) && m.endsWith(' ' + tail);
}

/* ---------- SMS parça sayacı ---------- */

/**
 * Kodlama kararı: Yalnızca GSM 03.38 temel tablosu + genişletme tablosu kullanılır. Ulusal (Türkçe) kaydırma
 * tablosu KULLANILMAZ; Türk sağlayıcıları bunu desteklemiyor. Bu yüzden temel tabloda olmayan tek bir karakter
 * (ş ğ ı İ Ş Ğ ç …) bütün mesajı UCS-2'ye geçirir (70/67). Ç, Ö, Ü, ö, ü temel tablodadır.
 * GSM-7'de genişletme karakterleri (^ { } \ [ ~ ] | €) 2 birim sayılır; UCS-2'de birim = UTF-16 kod birimi.
 * Parça sınırında bir genişletme çiftinin bölünmemesi gibi sağlayıcı ayrıntıları hesaba katılmaz.
 * İstemci (public/app.js) aynı mantığı uygular; ortak vektörler test/fixtures/sms-segments.json içindedir.
 */
export const SMS_LIMITS = Object.freeze({ gsm7: { single: 160, multi: 153 }, ucs2: { single: 70, multi: 67 } });

const GSM7_BASIC = new Set(
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
);
const GSM7_EXT = new Set('^{}\\[~]|€');

export function smsSegments(text) {
  const s = String(text ?? '');
  let gsmUnits = 0;
  let encoding = 'gsm7';
  for (const ch of s) {
    if (GSM7_BASIC.has(ch)) gsmUnits += 1;
    else if (GSM7_EXT.has(ch)) gsmUnits += 2;
    else { encoding = 'ucs2'; break; }
  }
  const units = encoding === 'gsm7' ? gsmUnits : s.length;
  const { single, multi } = SMS_LIMITS[encoding];
  const segments = units === 0 ? 0 : units <= single ? 1 : Math.ceil(units / multi);
  const perSegment = segments > 1 ? multi : single;
  const remainingInSegment = segments === 0 ? single : segments * perSegment - units;
  return { encoding, units, segments, perSegment, remainingInSegment };
}
