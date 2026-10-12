import { config } from './config.js';

/* ---------- Telefon ---------- */

/** Türkiye cep telefonu numarasını 905XXXXXXXXX biçimine çevirir. Geçersizse null. */
export function normalizePhone(input) {
  if (!input) return null;
  let d = String(input).replace(/\D/g, '');
  if (d.startsWith('0090')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('05')) d = '9' + d;
  else if (d.length === 10 && d.startsWith('5')) d = '90' + d;
  if (d.length === 12 && d.startsWith('905')) return d;
  return null;
}

/** 905321234567 -> 0532 123 45 67 */
export function formatPhone(p) {
  if (!p || p.length !== 12) return p || '';
  return `0${p.slice(2, 5)} ${p.slice(5, 8)} ${p.slice(8, 10)} ${p.slice(10, 12)}`;
}

/** Loglar için: 905321234567 -> 90532*****67 */
/** Log için: yalnızca son 2 hane görünür (örn. *********45). */
export function maskPhoneTail(p) {
  const s = String(p || '');
  if (s.length < 3) return '***';
  return '*'.repeat(s.length - 2) + s.slice(-2);
}

export function maskPhone(p) {
  const s = String(p || '');
  if (s.length < 6) return '***';
  return s.slice(0, 5) + '*'.repeat(Math.max(1, s.length - 7)) + s.slice(-2);
}

/* ---------- Tarih / saat (Europe/Istanbul, kalıcı UTC+3) ---------- */

export const TZ_OFFSET = '+03:00';

const dtf = new Intl.DateTimeFormat('sv-SE', {
  timeZone: config.timeZone,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false,
});

function partsOf(d) {
  return Object.fromEntries(dtf.formatToParts(d).map((p) => [p.type, p.value]));
}

/** İstanbul saatine göre { date: 'YYYY-MM-DD', hour: 0-23 } */
export function nowLocal(now = new Date()) {
  const p = partsOf(now);
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour === '24' ? 0 : p.hour) };
}

export function todayLocal(now = new Date()) {
  return nowLocal(now).date;
}

/** Yerel günün başlangıcı (İstanbul 00:00) ISO/UTC olarak */
export function localDayStartIso(date) {
  return new Date(`${date}T00:00:00${TZ_OFFSET}`).toISOString();
}

/** İçinde bulunulan yerel ayın [başlangıç, bitiş) ISO aralığı */
export function monthRangeIso(now = new Date()) {
  const { date } = nowLocal(now);
  const [y, m] = date.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const end = `${ny}-${String(nm).padStart(2, '0')}-01`;
  return { from: localDayStartIso(start), to: localDayStartIso(end), label: `${String(m).padStart(2, '0')}.${y}` };
}

/** ISO tarih (YYYY-MM-DD) -> DD.MM.YYYY */
export function formatDate(iso) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/** ISO zaman damgası -> DD.MM.YYYY HH:MM (İstanbul) */
export function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = partsOf(d);
  return `${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`;
}

export function isValidDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
}

/** dd.mm.yyyy | dd/mm/yyyy | yyyy-mm-dd -> yyyy-mm-dd (geçersizse null) */
export function parseDateFlexible(s) {
  const t = String(s || '').trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (m) { const iso = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`; return isValidDate(iso) ? iso : null; }
  m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(t);
  if (m) { const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; return isValidDate(iso) ? iso : null; }
  return null;
}

/** ISO tarihe gün ekler */
export function addDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + Number(days));
  return d.toISOString().slice(0, 10);
}

export function nowIso() {
  return new Date().toISOString();
}

/* ---------- Girdi yardımcıları ---------- */

export function trim(s, max = 500) {
  return String(s ?? '').trim().slice(0, max);
}

export function toInt(v, def = null) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

export function isValidEmail(s) {
  return /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(String(s || ''));
}

/** LIKE deseni için % _ \ karakterlerini kaçışlar (ESCAPE '\' ile kullanılır) */
export function escapeLike(s) {
  return String(s || '').replace(/[\\%_]/g, (c) => '\\' + c);
}

/* ---------- Yönlendirme ---------- */

function allowedHosts(req) {
  const hosts = new Set();
  const h = req.get('host');
  if (h) hosts.add(h);
  for (const o of [config.appOrigin, ...(config.appOrigins || [])]) {
    if (o) { try { hosts.add(new URL(o).host); } catch { /* yoksay */ } }
  }
  return hosts;
}

/** Referer aynı origin ise yol+sorgu döner; değilse fallback. Açık yönlendirmeyi engeller. */
export function returnTo(req, fallback) {
  const ref = req.get('Referer');
  if (!ref) return fallback;
  try {
    const u = new URL(ref);
    if (!allowedHosts(req).has(u.host)) return fallback;
    return u.pathname + u.search;
  } catch {
    return fallback;
  }
}

/** Kullanıcı girdisinden gelen "next" yolunu yalnızca yerel yol ise kabul eder */
export function safeLocalPath(input, fallback = '/') {
  const s = String(input || '');
  if (!s.startsWith('/') || s.startsWith('//') || s.startsWith('/\\') || /[\r\n]/.test(s)) return fallback;
  return s;
}

/** URL'ye tek bir flash parametresi ekler (eski ok/err silinir) */
export function withFlash(url, kind, msg) {
  const u = new URL(url, 'http://local');
  u.searchParams.delete('ok');
  u.searchParams.delete('err');
  u.searchParams.set(kind, String(msg || '').slice(0, 300));
  return u.pathname + u.search;
}

/* ---------- Sabitler ---------- */

export const REMINDER_TYPES = {
  asi: 'Aşı',
  kontrol: 'Kontrol',
  parazit: 'Parazit (iç/dış)',
  kisirlastirma: 'Kısırlaştırma',
  diger: 'Diğer',
};

export const SPECIES = ['Kedi', 'Köpek', 'Kuş', 'Tavşan', 'Hamster', 'Diğer'];

export const STATUS_LABELS = {
  pending: 'Bekliyor',
  sent: 'SMS gönderildi',
  done: 'Tamamlandı',
  cancelled: 'İptal',
  failed: 'Gönderilemedi',
};

/**
 * Demo telefon aralığı: 0515/0516 BTK numara planında atanmamıştır; demo verisi (src/demo.js) yalnızca
 * bu aralıktan numara üretir ve SMS çıkış noktası (src/sms/index.js sendSms) bu numaraları hiçbir
 * sağlayıcıya göndermez. Böylece demo kayıtları ne gerçek kişiye ulaşır ne de kredi harcar.
 */
export const DEMO_PHONE_RE = /^9051[56]\d{7}$/;
export function isDemoPhone(phone) {
  return DEMO_PHONE_RE.test(String(phone || ''));
}
