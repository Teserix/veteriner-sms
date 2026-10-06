/* Veteriner SMS — Service Worker
 *
 * GÜVENLİK İLKESİ (çok kiracılı, hasta verisi içeren uygulama):
 * Bu uygulama ortak kullanılan tabletlerde/bilgisayarlarda çalışabilir.
 * Önbellekte kalan bir sayfanın başka bir kullanıcıya görünmesi kabul
 * edilemez. Bu nedenle:
 *
 *   - HTML / gezinme yanıtları ASLA önbelleğe alınmaz (network-only).
 *   - GET olmayan istekler hiç ele alınmaz.
 *   - Yalnızca kendi origin'imizdeki /static/ altı statik varlıklar
 *     (CSS, JS, ikonlar, çevrimdışı sayfası) önbelleğe alınır.
 *   - /api/, /sw.js, /manifest.webmanifest önbelleğe alınmaz.
 *   - Çıkışta (pwa.js mesaj gönderir) tüm önbellekler silinir.
 *
 * Önbellekte hiçbir zaman kişisel veri bulunmaz; yalnızca uygulama kabuğu.
 */

const CACHE_VERSION = 'v2';
const STATIC_CACHE = `vetsms-static-${CACHE_VERSION}`;
const OFFLINE_URL = '/static/offline.html';

/** Kurulumda ön yüklenen kritik kabuk varlıkları. */
const SHELL_ASSETS = [
  '/static/style.css',
  '/static/app.js',
  '/static/pwa.js',
  OFFLINE_URL,
  '/static/icons/favicon.svg',
  '/static/icons/sprite.svg',
  '/static/icons/icon-192.png',
  '/static/icons/icon-512.png',
  '/static/icons/maskable-512.png',
  '/static/icons/apple-touch-icon.png',
];

/** Bir URL'nin önbelleğe alınabilir statik varlık olup olmadığı. */
function isCacheableAsset(url) {
  return url.origin === self.location.origin && url.pathname.startsWith('/static/');
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    // Tek tek ekle: bir varlık eksikse kurulumun tamamı başarısız olmasın.
    await Promise.all(SHELL_ASSETS.map((u) => cache.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n !== STATIC_CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const type = event.data && event.data.type;
  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (type === 'CLEAR_CACHES') {
    // Paylaşılan cihaz güvencesi: çıkışta statik önbellek dahil her şey silinir.
    event.waitUntil((async () => {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
      if (event.source && event.source.postMessage) {
        event.source.postMessage({ type: 'CACHES_CLEARED' });
      }
    })());
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // GET dışındaki her şey (POST/PUT/DELETE) tarayıcıya bırakılır.
  if (req.method !== 'GET') return;
  // Kısmi içerik istekleri önbellek mantığından muaf.
  if (req.headers.has('range')) return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  // Gezinme (HTML): yalnızca ağdan. Önbelleğe hiçbir şey yazılmaz.
  if (req.mode === 'navigate') {
    event.respondWith(networkOnlyWithOfflineFallback(req));
    return;
  }

  // Statik varlıklar: stale-while-revalidate.
  if (isCacheableAsset(url)) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Geri kalan her şey (/api/, /sw.js, /manifest.webmanifest, dış origin)
  // dokunulmadan tarayıcıya bırakılır.
});

/**
 * Gezinme isteği: her zaman ağdan. Yalnızca GERÇEK ağ hatasında çevrimdışı
 * sayfası döndürülür; HTTP 4xx/5xx yanıtları olduğu gibi geçirilir ki
 * kullanıcı uygulamanın kendi hata sayfasını görsün.
 */
async function networkOnlyWithOfflineFallback(request) {
  try {
    return await fetch(request);
  } catch {
    const cached = await caches.match(OFFLINE_URL);
    if (cached) return cached;
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>Çevrimdışı</title><p>İnternet bağlantısı yok.</p>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
}

/**
 * Statik varlık: önbellekteki kopya hemen döndürülür, arka planda tazelenir.
 * Yalnızca başarılı, kendi origin'imizden gelen yanıtlar önbelleğe yazılır.
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response && response.ok && response.type === 'basic') {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => null);

  if (cached) return cached;

  const fresh = await network;
  if (fresh) return fresh;
  return new Response('', { status: 504, statusText: 'Gateway Timeout' });
}
