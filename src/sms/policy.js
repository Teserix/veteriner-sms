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

/** Görünmez karakterler: sıfır genişlikli boşluk/birleştirici, yön işaretleri, word joiner, BOM, soft hyphen */
const INVISIBLE_RE = /[\p{Cf}\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\u3164\uFEFF\uFFA0]/gu;

/**
 * Türkçe harf ve aksan farklarını düzleştirir: "İNDİRİM" -> "indirim", "Ücretsiz" -> "ucretsiz".
 * Önce NFKC (tam genişlikli "：", "Ｉ" vb. olağan karşılığına döner), sonra görünmez karakterler silinir
 * ("ip\u200Btal" -> "iptal").
 */
export function normalizeTr(s) {
  return String(s || '')
    .normalize('NFKC')
    .replace(INVISIBLE_RE, '')
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

export const URL_PROBLEM = 'Mesaj gövdesinde bağlantı (URL, www. adresi ya da kısa link) bulunamaz; ret bağlantısı sistemce eklenir.';

/** Şablon denetimi: boş, uzun, bilinmeyen değişken ve içerik ihlalleri */
export function templateProblems(template) {
  const t = String(template || '').trim();
  if (!t) return ['Mesaj şablonu boş olamaz.'];
  const out = [];
  if (t.length > MAX_BODY_LENGTH) out.push(`Şablon en fazla ${MAX_BODY_LENGTH} karakter olabilir (kimlik ve iptal satırı sistemce eklenir).`);
  const unknown = [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((k) => !TEMPLATE_VARS.includes(k));
  if (unknown.length) out.push(`Bilinmeyen değişken: {${[...new Set(unknown)].join('}, {')}}. Kullanılabilir: {${TEMPLATE_VARS.join('}, {')}}.`);
  if (containsUrl(t)) out.push(URL_PROBLEM); // şablon da gövdedir (zamanlayıcı onu bodyProblems'siz gönderir)
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

/** composeMessage'in gövdeye uyguladığı boşluk normalleştirmesi */
export const oneLineBody = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** Kullanıcının gönderdiği gövde şablondan çıkanla aynı mı (boşluk farkları yok sayılır) */
export const sameBody = (a, b) => oneLineBody(a) === oneLineBody(b);

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
    segments: smsSegments(parts.full, { turkishShift: usesTurkishShift(settings) }),
    edited: bodyOverride != null && !sameBody(bodyOverride, originalBody),
    originalBody,
    originalBodyOneLine: oneLineBody(originalBody),
    turkishShift: usesTurkishShift(settings),
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
  if (imitatesTail(b)) out.push('Gövde kimlik (MERSIS/VKN) veya iptal satırı içeremez; bu satırlar sistemce eklenir.');
  // Yalnız gövde denetlenir: sistemin eklediği ret bağlantısı kuyruktadır, buraya girmez
  if (containsUrl(b)) out.push(URL_PROBLEM);
  out.push(...contentProblems(b));
  return out;
}

/**
 * Benzer karakter iskeleti (YALNIZ taklit denetimi için; gönderilen metne ve içerik denetimine uygulanmaz):
 * "iptaI" / "ipta1" / "1ptal" / "!ptal" / "|ptal" -> "iptai", "0" -> "o" ... normalizeTr çıktısına uygulanır.
 * "l" de "i"ye indirgendiği için aşağıdaki desenler bu iskelet biçiminde yazılmıştır ("link" -> "iink").
 */
const LOOKALIKE = Object.freeze({ l: 'i', 1: 'i', '!': 'i', '|': 'i', '¡': 'i', 0: 'o', 3: 'e', 4: 'a', '@': 'a', 5: 's', $: 's', 7: 't' });
/** Yunanca/Kiril benzer harfler (küçük harfe indirgenmiş hâlleri) → Latin karşılığı */
const CONFUSABLE = Object.freeze({
  'α': 'a', 'β': 'b', 'ε': 'e', 'η': 'n', 'ι': 'i', 'κ': 'k', 'ν': 'v', 'ο': 'o', 'ρ': 'p', 'τ': 't', 'υ': 'u', 'χ': 'x', 'μ': 'm', 'ζ': 'z',
  'а': 'a', 'в': 'b', 'е': 'e', 'ѕ': 's', 'і': 'i', 'ј': 'j', 'к': 'k', 'м': 'm', 'н': 'h', 'о': 'o', 'р': 'p', 'с': 'c', 'т': 't', 'у': 'y', 'х': 'x', 'ԁ': 'd', 'ӏ': 'l',
});
const CONFUSABLE_RE = new RegExp(`[${Object.keys(CONFUSABLE).join('')}]`, 'g');
export function lookalikeSkeleton(s) {
  return normalizeTr(s).replace(CONFUSABLE_RE, (c) => CONFUSABLE[c]).replace(/[l1!|¡0345@$7]/g, (c) => LOOKALIKE[c]);
}

/**
 * Gövdede kimlik/iptal/ret satırı taklidi (iskelet üzerinde: NFKC, görünmez karakter, Türkçe harf, benzer karakter farkı yok).
 * Meşru bakım metni ("randevunuzu iptal etmek için kliniği arayın") yakalanmaz; yalnız satır/bağlantı biçimli taklitler.
 */
const TAIL_IMITATION = Object.freeze([
  /\b(mersis|vkn|tckn|iptai|ret|red)\s*[:=]/,
  /\b(mersis|vkn|tckn)\s*[-_#.]?\s*(no\b|[0-9ioeast]+(?![a-z]))/, // rakamlar iskelette harfe döner                // "MERSIS-1", "VKN 123", "MERSIS no"              // "Iptal:", "RET =", "MERSIS:", "ipta1："
  /\bkisa[\s._-]*(iink|bagianti|uri)/,                      // "kısa-link", "kisa link", "kısa bağlantı"
  /\b(iptai|ret|red)\s*(icin|etmek icin)\s*(iink|bagianti|uri|tikia|kisa|sms|mesaj|yaz|gonder)/, // "İptal için kısa-link"
  /\b(iptai|ret)\s*(iinki|bagiantisi)/,                       // "iptal linki", "ret bağlantısı"
  /\bsms\s*(aimamak|aimak istemiyorsan|istemiyorsan)/,         // "SMS almamak için", "SMS almak istemiyorsanız"
  /\b(iisteden|aboneiikten)\s*cik/,                           // "listeden çıkmak için"
  /\/ret\//,                                                   // sahte ret URL yolu
]);

export function imitatesTail(body) {
  const n = lookalikeSkeleton(body);
  return TAIL_IMITATION.some((re) => re.test(n));
}

/** Yaygın kısa bağlantı alan adları (eğik çizgisiz de yakalanır) */
export const SHORTENER_DOMAINS = Object.freeze([
  'bit.ly', 't.co', 'tinyurl.com', 'goo.gl', 'is.gd', 'ow.ly', 'cutt.ly', 'rebrand.ly', 't.ly', 'shorturl.at', 'rb.gy',
  'tiny.cc', 's.id', 'buff.ly', 'lnkd.in', 'kisa.link', 'v.gd', 'bl.ink', 'short.io', 'tr.ee', 'qrco.de',
]);
const SHORTENER_RE = new RegExp(`(^|[^a-z0-9.-])(${SHORTENER_DOMAINS.map((d) => d.replace(/\./g, '\\.')).join('|')})(?![a-z0-9-])`);
const URL_RES = Object.freeze([
  /\bhttps?:\/\//,                                   // http:// https://
  /\bwww\./,                                          // www.
  /\b[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}\//,          // alan.adi/ , klinik.com.tr/yol
  SHORTENER_RE,
]);

/**
 * Alan adı sonu olarak kabul edilen üst düzey alan adları (TLD). Türkçede tek başına sık geçen kısa sözcükler
 * ("de", "da", "at", "in", "ne", "no", "ki", "el", "ve", "top", "pet", "tel", "ar", "es", "it", "am", "be", "se") kasıtlı olarak listede yok; bunlar cümle sonu noktasıyla
 * birleşince yanlış alarm verirdi. Kısa link alan adları ayrıca SHORTENER_DOMAINS ile yakalanır.
 */
export const URL_TLDS = Object.freeze([
  'com', 'net', 'org', 'tr', 'info', 'biz', 'co', 'io', 'ly', 'gl', 'gd', 'cc', 'id', 'me', 'app', 'link', 'xyz', 'site',
  'online', 'store', 'shop', 'click', 'live', 'club', 'vip', 'pro', 'dev', 'page', 'web', 'tv', 'ai', 'us', 'uk',
  'eu', 'ru', 'cn', 'tk', 'ml', 'ga', 'cf', 'gq', 'ws', 'bz', 'su', 'pw', 'sh', 'gg', 'ee', 'lt', 'lv', 'fm', 
  'ir', 'az', 'kz', 'ua', 'ro', 'bg', 'gr', 'nl', 'ch', 'fr', 'pl', 'cz', 'fi', 'dk', 
  'mx', 'br', 'au', 'nz', 'jp', 'kr', 'hk', 'sg', 'tw', 'vet', 'health', 'clinic', 'care', 'dog',
  'onl', 'icu', 'cyou', 'buzz', 'rest', 'fun', 'space', 'tech', 'website', 'email', 'one', 'world', 'today', 'run',
  'gov', 'edu', 'mil', 'int', 'k12', 'tsk', 'name', 'mobi', 'asia', 'cloud',
]);
const TLD_ALT = URL_TLDS.join('|');
/** Nokta yerine geçen yazımlar: "(.)", "[.]", "(dot)", "[nokta]", " nokta ", "·", "•" ve "。" (NFKC sonrası). Virgül yalnız kısa link listesi için noktaya çevrilir ("bit,ly"). */
const DOT_LIKE_RE = /\s*(?:\(\s*(?:\.|dot|nokta)\s*\)|\[\s*(?:\.|dot|nokta)\s*\]|\{\s*(?:\.|dot|nokta)\s*\}|(?<=\S)\s+(?:dot|nokta)\s+(?=\S)|[.·•‧∙⋅。])\s*/g;
/** Boşluk ve noktalama temizlenmiş biçim: "bit . ly" -> "bit.ly", "klinik [.] com" -> "klinik.com" */
export function collapseDots(n) {
  return n.replace(DOT_LIKE_RE, '.');
}
/** Eğik çizgisiz alan adı: en az iki harfli etiket + bilinen TLD, ardından harf/rakam gelmez ("klinik.com.tr", "bit.ly") */
const BARE_DOMAIN_RE = new RegExp(`(^|[^a-z0-9-])[a-z0-9][a-z0-9-]*[a-z][a-z0-9-]*(\\.[a-z0-9-]+)*\\.(${TLD_ALT})(?![a-z0-9-])`);
/** Şema: "http://", "hxxp://", "h**ps://", "http :// ", "ftp://"; ayrıca herhangi bir "harf : //" kalıbı */
const SCHEME_RES = Object.freeze([
  /\bh[tx*]{2}ps?\s*[:;]/,                 // hxxp: hxxps; h**p: (iki noktadan sonra // gelmese de)
  /\b[a-z][a-z0-9+.-]{1,15}\s*[:;]\s*[\/\\]\s*[\/\\]/, // herhangi şema + "//" (boşluklu, ters eğik çizgili)
  /\bw\s*w\s*w\s*\./,                      // "w w w." boşluklu
]);

/**
 * Gövdede bağlantı (URL) var mı? NFKC + görünmez karakter temizliğinden sonra bakılır (tam genişlikli "ｈｔｔｐ" de yakalanır).
 * Ayrıca boşluk ve noktalama temizlenmiş biçimde alan adına benzeyen her ifade reddedilir ("bit . ly", "klinik.com.tr",
 * "klinik (nokta) com"); bozulmuş şemalar ("hxxp://") da reddedilir. Kısa link listesi yalnız ek kontroldür.
 */
export function containsUrl(body) {
  const n = normalizeTr(body);
  if (URL_RES.some((re) => re.test(n))) return true;
  if (SCHEME_RES.some((re) => re.test(n))) return true;
  const c = collapseDots(n);
  if (BARE_DOMAIN_RE.test(c) || /\bwww\./.test(c) || SHORTENER_RE.test(c)) return true;
  return SHORTENER_RE.test(c.replace(/\s*,\s*/g, '.'));
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
 * Kodlama: GSM 03.38 temel tablosu + genişletme tablosu (^ { } \ [ ~ ] | € = 2 birim). Ç, Ö, Ü, ö, ü temel tablodadır.
 * Türkçe tek kaydırma tablosu (3GPP TS 23.038 A.2.1: Ğ İ Ş ç ğ ı ş) yalnızca sağlayıcı destekliyorsa
 * (Netgsm encoding:"TR"; usesTurkishShift) kullanılır: bu harfler 2 birim sayılır ve UDH'deki 3 baytlık dil
 * bilgisi yüzünden parça kapasitesi 155/149 olur ("gsm7tr"). Kaydırma tablosu yoksa ya da tabloda olmayan bir
 * karakter varsa bütün mesaj UCS-2'ye geçer (70/67; birim = UTF-16 kod birimi).
 * Çok parçalı mesajda 2 birimlik karakter (genişletme çifti / vekil çift) parça sınırında bölünemez; sonraki parçaya geçer.
 * İstemci (public/app.js) aynı mantığı uygular; ortak vektörler test/fixtures/sms-segments.json içindedir.
 */
export const SMS_LIMITS = Object.freeze({
  gsm7: { single: 160, multi: 153 }, gsm7tr: { single: 155, multi: 149 }, ucs2: { single: 70, multi: 67 },
});

const GSM7_BASIC = new Set(
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
);
const GSM7_EXT = new Set('^{}\\[~]|€');
const GSM7_TR_SHIFT = new Set('ĞİŞçğış');

/** Sağlayıcı Türkçe tek kaydırma tablosunu destekliyor mu (Netgsm REST v2 encoding:"TR", src/sms/index.js) */
export function usesTurkishShift(settings) {
  return settings?.sms_provider === 'netgsm';
}

export function smsSegments(text, { turkishShift = false } = {}) {
  const s = String(text ?? '');
  let encoding = 'gsm7';
  let sizes = [];
  for (const ch of s) {
    if (GSM7_BASIC.has(ch)) sizes.push(1);
    else if (GSM7_EXT.has(ch)) sizes.push(2);
    else if (turkishShift && GSM7_TR_SHIFT.has(ch)) { sizes.push(2); encoding = 'gsm7tr'; }
    else { encoding = 'ucs2'; break; }
  }
  if (encoding === 'ucs2') sizes = Array.from(s, (ch) => ch.length);
  const units = sizes.reduce((a, b) => a + b, 0);
  const { single, multi } = SMS_LIMITS[encoding];
  if (units === 0) return { encoding, units, segments: 0, perSegment: single, remainingInSegment: single };
  if (units <= single) return { encoding, units, segments: 1, perSegment: single, remainingInSegment: single - units };
  let segments = 1;
  let used = 0;
  for (const u of sizes) {
    if (used + u > multi) { segments += 1; used = 0; }
    used += u;
  }
  return { encoding, units, segments, perSegment: multi, remainingInSegment: multi - used };
}
