import { config } from './config.js';

/**
 * Bellek içi kayan pencere sınırlayıcı. Tek kopya (tek container) varsayımıyla çalışır;
 * yeniden başlatmada sıfırlanır. Günlük SMS tavanı bundan bağımsız olarak sms_log'dan hesaplanır.
 */
export function createLimiter({ windowMs, max }) {
  const hits = new Map(); // key -> { count, first }

  function prune(now = Date.now()) {
    for (const [k, h] of hits) if (now - h.first > windowMs) hits.delete(k);
  }
  const timer = setInterval(() => prune(), Math.max(30_000, windowMs));
  timer.unref();

  return {
    /** Sınır aşıldı mı? (sayaç artmaz) */
    isLimited(key) {
      const h = hits.get(key);
      return Boolean(h && Date.now() - h.first <= windowMs && h.count >= max);
    },
    /** Sayacı artırır; aşıldıysa false döner */
    hit(key) {
      const now = Date.now();
      const h = hits.get(key);
      if (!h || now - h.first > windowMs) { hits.set(key, { count: 1, first: now }); return true; }
      h.count++;
      return h.count <= max;
    },
    reset(key) { hits.delete(key); },
    /** Express ara katmanı: keyFn(req) -> anahtar; aşımda 429 sayfası */
    middleware(keyFn, message = 'Çok fazla istek. Lütfen biraz sonra tekrar deneyin.') {
      return (req, res, next) => {
        const key = keyFn(req);
        if (key == null) return next();
        if (!this.hit(String(key))) {
          return res.status(429).render('error', { title: 'Çok fazla istek', message });
        }
        next();
      };
    },
    _hits: hits,
  };
}

/** Gerçek istemci IP'si: Cloudflare Tunnel arkasında cf-connecting-ip, aksi halde req.ip */
export function clientIp(req) {
  if (config.trustProxy) {
    const cf = req.get('cf-connecting-ip');
    if (cf) return cf.trim();
  }
  return req.ip || 'unknown';
}

const MIN = 60_000;
export const limiters = {
  login: createLimiter({ windowMs: 15 * MIN, max: 8 }),
  testSms: createLimiter({ windowMs: 60 * MIN, max: 5 }),
  manualSms: createLimiter({ windowMs: 60 * MIN, max: 30 }),
  importUpload: createLimiter({ windowMs: 60 * MIN, max: 5 }),
  post: createLimiter({ windowMs: 15 * MIN, max: 300 }),
};
