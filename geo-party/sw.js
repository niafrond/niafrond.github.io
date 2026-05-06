const CACHE = 'geoparty-v1.0.0';

const ASSETS = [
  './',
  './index.html',
  './main.js',
  './state.js',
  './peer.js',
  './game.js',
  './ui.js',
  './sound.js',
  './pwa.js',
  './locations.js',
  './style.css',
  './manifest.json',
  './version.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Ne pas intercepter les requêtes cross-origin (Wikimedia, OpenStreetMap, PeerJS CDN)
  if (!e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
