// TODO : Mettez à jour CACHE à chaque release pour forcer le rechargement du cache.
// Convention : '<nomjeu>-v<semver>'
const CACHE = 'template-v1.176.1';

// TODO : Listez ici tous les fichiers à mettre en cache pour le mode hors-ligne.
const ASSETS = [
  './',
  './index.html',
  './main.js',
  './state.js',
  './ui.js',
  './game.js',
  './pwa.js',
  './sound.js',
  './style.css',
  './manifest.json',
  './version.js',
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
