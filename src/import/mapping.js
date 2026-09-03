import { parseDateFlexible, SPECIES } from '../util.js';

/** Hedef alanlar (sıra: eşleştirme ekranındaki görünüm sırası) */
export const TARGET_FIELDS = Object.freeze({
  owner_name: { label: 'Sahip adı', required: true },
  phone: { label: 'Cep telefonu', required: true },
  email: { label: 'E-posta', required: false },
  owner_notes: { label: 'Sahip notu', required: false },
  pet_name: { label: 'Hayvan adı', required: true },
  species: { label: 'Tür', required: false },
  breed: { label: 'Irk', required: false },
  sex: { label: 'Cinsiyet', required: false },
  birth_date: { label: 'Doğum tarihi', required: false },
  pet_notes: { label: 'Hayvan notu', required: false },
});

export const FIELD_KEYS = Object.keys(TARGET_FIELDS);

const lower = (s) => String(s ?? '').toLocaleLowerCase('tr-TR').trim();

/**
 * Tahmin sırası önemli: daha özgül desenler (telefon, hayvan adı, cinsiyet) önce çalışır;
 * genel desenler (adı/isim -> sahip adı, "not" -> sahip notu) kalan sütunlardan seçer.
 */
const GUESS_ORDER = [
  ['phone', /tel|gsm|cep|phone|mobil/],
  ['email', /e-?posta|mail/],
  ['birth_date', /doğum|dogum|birth/],
  ['sex', /cinsiyet|sex|gender/],
  ['pet_name', /hayvan|pet|hasta ad|patient/],
  ['species', /tür|\btur\b|türü|cins|species/],
  ['breed', /ırk|irk|breed/],
  ['pet_notes', /(hayvan|pet|hasta).*not/],
  ['owner_name', /sahi[pb]|müşteri|musteri|ad soyad|adı|isim|owner|name/], // "sahibi" (ünsüz yumuşaması)
  ['owner_notes', /not|açıklama|aciklama/],
];

/** guessMapping(headers) -> { alan: sütunIndeksi | null } */
export function guessMapping(headers) {
  const lows = headers.map(lower);
  const used = new Set();
  const map = Object.fromEntries(FIELD_KEYS.map((k) => [k, null]));
  for (const [field, re] of GUESS_ORDER) {
    const idx = lows.findIndex((h, i) => !used.has(i) && re.test(h));
    if (idx >= 0) { map[field] = idx; used.add(idx); }
  }
  return map;
}

/** Eş anlamlıları SPECIES listesine indirger; boş -> null, bilinmeyen -> "Diğer" */
export function normalizeSpecies(s) {
  const t = lower(s);
  if (!t) return null;
  if (/^(kedi|cat|feline)/.test(t)) return 'Kedi';
  if (/köpek|kopek|dog|canine/.test(t)) return 'Köpek';
  if (/kuş|kus|bird|papağan|papagan|muhabbet|kanarya/.test(t)) return 'Kuş';
  if (/tavşan|tavsan|rabbit/.test(t)) return 'Tavşan';
  if (/hamster/.test(t)) return 'Hamster';
  const exact = SPECIES.find((x) => lower(x) === t);
  return exact || 'Diğer';
}

/** dişi/erkek eş anlamlıları; belirsiz -> null */
export function normalizeSex(s) {
  const t = lower(s);
  if (!t) return null;
  if (/^(dişi|disi|female|f|d)$/.test(t) || /^diş/.test(t) || /^fem/.test(t)) return 'Dişi';
  if (/^(erkek|male|m|e)$/.test(t) || /^erk/.test(t) || /^mal/.test(t)) return 'Erkek';
  return null;
}

/** Esnek tarih: dd.mm.yyyy | dd/mm/yyyy | yyyy-mm-dd -> yyyy-mm-dd, anlaşılmazsa null */
export function normalizeDate(s) {
  const t = String(s ?? '').trim();
  if (!t) return null;
  return parseDateFlexible(t);
}
