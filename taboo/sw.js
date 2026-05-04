const CACHE = 'taboo-v1.0.0';

const ASSETS = [
  './',
  './index.html',
  './main.js',
  './state.js',
  './ui.js',
  './game.js',
  './peer.js',
  './pwa.js',
  './sound.js',
  './style.css',
  './manifest.json',
  './version.js',
  './words.json',
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
