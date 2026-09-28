const CACHE = 'reveilxtrem-v1.0.0';

const ASSETS = [
  './',
  './index.html',
  './main.js',
  './alarms.js',
  './scheduler.js',
  './math-challenge.js',
  './sound.js',
  './ui.js',
  './pwa.js',
  './style.css',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
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
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
