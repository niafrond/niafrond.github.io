/**
 * sw.js — Service Worker pour DJ Mix PWA
 */

const CACHE = 'djmix-v1.218.9';

const ASSETS = [
  './',
  './index.html',
  './main.js',
  './player.js',
  './pwa.js',
  './version.js',
  './style.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './lib/playbackMemoryPolicy.js',
  './lib/autoFadeManager.js',
  './lib/audioSourceManager.js',
  './lib/downloaderConfig.js',
  './lib/logger.js',
  './lib/mixControls.js',
  './lib/djFxController.js',
  './lib/playlistManager.js',
  './lib/filRougeManager.js',
  './lib/queueStorage.js',
  './lib/shellUi.js',
  './lib/uiRenderer.js',
  './lib/autoModeManager.js',
  './lib/appState.js',
  './lib/autoDjFxManager.js',
  './lib/automixTimeline.js',
  './lib/deckHelpers.js',
  './lib/ramProfile.js',
  './lib/queueDnD.js',
  './lib/searchUtils.js',
  './lib/transitionModes.js',
  './lib/index.js',
  './lib/danceGenreConfig.js',
  './lib/djModeConfig.js',
  './lib/apiHealthMonitor.js',
  './lib/trackMetaStorage.js',
  './lib/spotifyClient.js',
  './lib/storageKeys.js',
  './lib/mixFeatures.js',
  './lib/settingsStorage.js',
  './lib/androidAutoBridge.js',
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
  // Ne pas intercepter les requêtes cross-origin (API Spotify, CDN)
  if (!e.request.url.startsWith(self.location.origin)) return;
  
  // Ne pas intercepter les requêtes API
  if (e.request.url.includes('/api/')) return;
  
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
