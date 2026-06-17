/**
 * sw.js — Service Worker pour DJ Mix PWA
 */

const CACHE = 'djmix-v1.229.1';

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
  './lib/djApiClient.js',
  './lib/djPlanManager.js',
  './lib/djTransitionMapping.js',
  './lib/filRougeDownloader.js',
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

// ── Background Fetch (téléchargement écran éteint) ───────────────────────────

const AUDIO_CACHE = 'dj-mix:audio-cache:v1';

self.addEventListener('backgroundfetchsuccess', e => {
  e.waitUntil(_handleBgFetchSuccess(e.registration));
});

self.addEventListener('backgroundfetchfail', e => {
  e.waitUntil(_handleBgFetchFail(e.registration));
});

self.addEventListener('backgroundfetchclick', e => {
  e.waitUntil(self.clients.openWindow('./'));
});

async function _handleBgFetchSuccess(bgFetch) {
  const audioCache = await caches.open(AUDIO_CACHE);
  const records = await bgFetch.matchAll();

  const succeededKeys = [];
  const failedKeys = [];

  await Promise.all(records.map(async record => {
    const url = new URL(record.request.url);
    const cacheKey = url.searchParams.get('_ck');

    let response;
    try { response = await record.responseReady; } catch (_) {}

    if (!response || !response.ok || !cacheKey) {
      if (cacheKey) failedKeys.push(cacheKey);
      return;
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    let blob;

    if (contentType.includes('audio') || contentType.includes('octet-stream')) {
      blob = await response.blob().catch(() => null);
    } else {
      // Réponse JSON avec URL directe
      const data = await response.json().catch(() => null);
      const directUrl = data?.downloadUrl || data?.url || data?.fileUrl || data?.audioUrl;
      if (directUrl) {
        try {
          const mediaRes = await fetch(directUrl);
          if (mediaRes.ok) blob = await mediaRes.blob();
        } catch (_) {}
      }
    }

    if (blob && blob.size > 0) {
      const safeKey = encodeURIComponent(cacheKey);
      await audioCache.put(
        new Request(`https://dj-mix.local/cache-audio/${safeKey}`),
        new Response(blob, { headers: { 'content-type': blob.type || 'audio/mpeg' } }),
      );
      succeededKeys.push(cacheKey);
    } else {
      failedKeys.push(cacheKey);
    }
  }));

  const done = succeededKeys.length;
  const failed = failedKeys.length;

  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  clients.forEach(c => c.postMessage({ type: 'BG_FETCH_DONE', succeededKeys, failedKeys }));

  await self.registration.showNotification('DJ Mix — Téléchargement terminé', {
    body: `${done} morceau${done > 1 ? 'x' : ''} mis en cache${failed > 0 ? ` — ${failed} échec${failed > 1 ? 's' : ''}` : ''}`,
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: 'djmix-dl-done',
  });
}

async function _handleBgFetchFail(bgFetch) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  clients.forEach(c => c.postMessage({ type: 'BG_FETCH_FAIL' }));

  await self.registration.showNotification('DJ Mix — Téléchargement échoué', {
    body: 'Le téléchargement en arrière-plan a échoué.',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: 'djmix-dl-fail',
  });
}
