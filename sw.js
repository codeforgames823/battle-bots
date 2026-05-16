// Battle Bots — minimal service worker for offline play.
// Cache-first for static assets, network-first for the document (so updates ship).

const CACHE = 'bb-v3';
const PRECACHE = [
  './',
  './index.html',
  './style.css?v=2',
  './manifest.json',
  './js/main.js?v=2',
  './js/storage.js',
  './js/physics.js',
  './js/bots.js',
  './js/ai.js',
  './js/game.js',
  './js/home.js',
  './js/shop.js',
  './js/controls.js',
  './js/audio.js',
  './js/net.js',
  './js/championship.js',
  './js/achievements.js',
  './js/tutorial.js',
  './img/hero/main.webp',
  './img/arenas/warehouse.webp',
  './img/arenas/factory.webp',
  './img/arenas/lab.webp',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE).catch(() => {/* ignore individual misses */}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Bypass cross-origin / API calls — let the network handle them
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Document / navigations: network-first
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then((m) => m || caches.match('./index.html')))
    );
    return;
  }

  // Static assets: network-first with cache fallback (so updates ship fast)
  event.respondWith(
    fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req))
  );
});
