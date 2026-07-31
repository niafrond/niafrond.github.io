/**
 * sw.js — Service Worker pour DJ Mix PWA
 */

const CACHE = 'djmix-v2.24.0';

const ASSETS = [
  './',
  './index.html',
  './relay.html',
  './relay.js',
  './relay.css',
  './main.js',
  './player.js',
  './pwa.js',
  './version.js',
  './style.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './lib/androidAutoBridge.js',
  './lib/apiHealthMonitor.js',
  './lib/appState.js',
  './lib/artworkPersistence.js',
  './lib/artworkUrlCache.js',
  './lib/audioSourceManager.js',
  './lib/autoDjFxManager.js',
  './lib/autoFadeManager.js',
  './lib/autoModeManager.js',
  './lib/automixTimeline.js',
  './lib/blobStore.js',
  './lib/constants.js',
  './lib/danceGenreConfig.js',
  './lib/deckHelpers.js',
  './lib/deckMarkerController.js',
  './lib/djApiClient.js',
  './lib/djFxController.js',
  './lib/djModeConfig.js',
  './lib/djModeController.js',
  './lib/djPlanIndicator.js',
  './lib/djPlanManager.js',
  './lib/djTransitionMapping.js',
  './lib/downloadBatchManager.js',
  './lib/downloadBatchSizing.js',
  './lib/downloadBatchStore.js',
  './lib/downloaderConfig.js',
  './lib/filRougeController.js',
  './lib/filRougeDownloader.js',
  './lib/filRougeManager.js',
  './lib/inactivePreloadWatcher.js',
  './lib/index.js',
  './lib/logger.js',
  './lib/loopMorphEngine.js',
  './lib/mediaSessionController.js',
  './lib/metaFetchService.js',
  './lib/mixControls.js',
  './lib/mixFeatures.js',
  './lib/playbackController.js',
  './lib/playbackMemoryPolicy.js',
  './lib/playlistManager.js',
  './lib/queueDnD.js',
  './lib/queueManager.js',
  './lib/queueStorage.js',
  './lib/ramProfile.js',
  './lib/relayIncomingQueue.js',
  './lib/relayModeController.js',
  './lib/relayModeManager.js',
  './lib/relayQueueView.js',
  './lib/samplerSoundsManager.js',
  './lib/searchController.js',
  './lib/searchUtils.js',
  './lib/settingsController.js',
  './lib/settingsStorage.js',
  './lib/shellUi.js',
  './lib/spotifyClient.js',
  './lib/spotifyController.js',
  './lib/storageKeys.js',
  './lib/trackMetaStorage.js',
  './lib/trackPathDb.js',
  './lib/trackStore.js',
  './lib/transitionModes.js',
  './lib/uiRenderer.js',
  './lib/uiState.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

// Ne purger que les anciennes versions du cache d'app shell (préfixe
// `djmix-v`) — le cache audio persistant (`dj-mix:audio-cache:v1`, voir
// audioSourceManager.js) et tout autre cache utilisent un espace de nommage
// différent et doivent survivre à chaque mise à jour du Service Worker
// (SPEC-20.2), sinon le fil rouge et la file d'attente perdent leurs
// morceaux téléchargés à chaque activation (nouvelle version déployée).
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k.startsWith('djmix-v') && k !== CACHE).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Ne pas intercepter les requêtes cross-origin (API Spotify, CDN)
  if (!e.request.url.startsWith(self.location.origin)) return;

  // Ne pas intercepter les requêtes API
  if (e.request.url.includes('/api/')) return;

  // Pour les navigations (chargement de pages HTML), chercher dans le cache
  // sans les query params : évite que la redirection "clean URL" du serveur
  // (relay.html → relay) ne supprime les paramètres de session relay.
  if (e.request.mode === 'navigate') {
    const urlWithoutSearch = e.request.url.split('?')[0];
    e.respondWith(
      caches.match(urlWithoutSearch).then(res => res || fetch(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});

