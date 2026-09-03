/**
 * Anahtar başına basit promise zinciri kilidi (tek süreç).
 * withLock('sms:<klinik>', fn): aynı anahtarla gelen çağrılar sırayla çalışır.
 * Günlük SMS tavanı ve hatırlatma durum geçişleri gibi "oku-karar ver-yaz" adımlarını yarıştan korur.
 */
const chains = new Map();

export function withLock(key, fn) {
  const prev = chains.get(key) || Promise.resolve();
  const run = prev.then(() => fn(), () => fn());
  const tail = run.then(() => undefined, () => undefined);
  chains.set(key, tail);
  tail.then(() => { if (chains.get(key) === tail) chains.delete(key); });
  return run;
}
