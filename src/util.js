import { config } from './config.js';

/**
 * Türkiye cep telefonu numarasını 905XXXXXXXXX biçimine çevirir.
 * Geçersizse null döner.
 */
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

const dtf = new Intl.DateTimeFormat('sv-SE', {
  timeZone: config.timeZone,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false,
});

/** İstanbul saatine göre { date: 'YYYY-MM-DD', hour: 0-23, time: 'HH:MM' } */
export function nowLocal() {
  const parts = Object.fromEntries(dtf.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour === '24' ? 0 : parts.hour),
    time: `${parts.hour}:${parts.minute}`,
  };
}

export function todayLocal() {
  return nowLocal().date;
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
  const parts = Object.fromEntries(dtf.formatToParts(d).map((p) => [p.type, p.value]));
  return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`;
}

export function isValidDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
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

export function trim(s, max = 500) {
  return String(s ?? '').trim().slice(0, max);
}

export function toInt(v, def = null) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

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
