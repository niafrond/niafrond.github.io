const CACHE = 'flashguess-v1.1.1';

const ASSETS = [
  './',
  './index.html',
  './main.js',
  './state.js',
  './ui.js',
  './game.js',
  './setup.js',
  './members.js',
  './editor.js',
  './demo.js',
  './pwa.js',
  './words.js',
  './sound.js',
  './style.css',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './universfield-school-bell-199584.mp3',
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
