import { maskPhoneTail } from './util.js';

/**
 * Tek satırlık günlük. Telefon numaraları maskelenir; mesaj gövdesi, parola,
 * belirteç ve sağlayıcı kimlik bilgileri ASLA loglanmaz (çağıranın sorumluluğu).
 */
function line(level, msg, meta) {
  const ts = new Date().toISOString();
  const extra = meta && Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
  const out = `${ts} ${level.toUpperCase()} ${msg}${extra}`;
  if (level === 'error') console.error(out);
  else if (level === 'warn') console.warn(out);
  else console.log(out);
}

export const log = {
  info: (msg, meta) => line('info', msg, meta),
  warn: (msg, meta) => line('warn', msg, meta),
  error: (msg, meta) => line('error', msg, meta),
  maskPhone: maskPhoneTail, // loglarda numaranın yalnızca son 2 hanesi
};
