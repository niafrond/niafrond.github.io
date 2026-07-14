/**
 * sw.js — Service Worker pour DJ Mix PWA
 */

const CACHE = 'djmix-v1.229.3';

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
  './lib/downloadBatchStore.js',
  './lib/downloadBatchManager.js',
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

// Nombre de records traités en parallèle : évite de charger des centaines de
// blobs audio en mémoire simultanément pour un gros lot (SPEC-19.5).
const BG_FETCH_RECORD_CONCURRENCY = 5;

async function _processRecordsInChunks(records, handler) {
  for (let i = 0; i < records.length; i += BG_FETCH_RECORD_CONCURRENCY) {
    const chunk = records.slice(i, i + BG_FETCH_RECORD_CONCURRENCY);
    await Promise.all(chunk.map(handler));
  }
}

// Lit tous les enregistrements d'une registration Background Fetch, met en
// cache les blobs des réponses OK et classe chaque clé `_ck` en réussite ou
// échec. Utilisable aussi depuis `backgroundfetchfail` : les réponses déjà
// reçues y restent lisibles via matchAll() (SPEC-19.6.1).
async function _harvestBgFetchRecords(bgFetch) {
  const audioCache = await caches.open(AUDIO_CACHE);
  const records = await bgFetch.matchAll();

  const succeededKeys = [];
  const failedKeys = [];

  await _processRecordsInChunks(records, async record => {
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
  });

  return { succeededKeys, failedKeys };
}

async function _handleBgFetchSuccess(bgFetch) {
  const { succeededKeys, failedKeys } = await _harvestBgFetchRecords(bgFetch);
  const done = succeededKeys.length;
  const failed = failedKeys.length;

  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  clients.forEach(c => c.postMessage({ type: 'BG_FETCH_DONE', id: bgFetch.id, succeededKeys, failedKeys }));

  await self.registration.showNotification('DJ Mix — Téléchargement terminé', {
    body: `${done} morceau${done > 1 ? 'x' : ''} mis en cache${failed > 0 ? ` — ${failed} échec${failed > 1 ? 's' : ''}` : ''}`,
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: 'djmix-dl-done',
  });
}

// Une seule réponse non-2xx suffit à faire échouer TOUTE la registration
// Background Fetch (`failureReason: 'bad-status'`). Les réponses déjà reçues
// restent pourtant lisibles ici : on les moissonne comme en succès pour ne
// perdre aucun morceau, et seules les vraies erreurs partent en `failedKeys`
// (retentées ensuite par la page, SPEC-19.6).
async function _handleBgFetchFail(bgFetch) {
  let harvest = null;
  try { harvest = await _harvestBgFetchRecords(bgFetch); } catch (_) {}

  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });

  if (harvest && (harvest.succeededKeys.length || harvest.failedKeys.length)) {
    const done = harvest.succeededKeys.length;
    const failed = harvest.failedKeys.length;
    clients.forEach(c => c.postMessage({
      type: 'BG_FETCH_DONE',
      id: bgFetch.id,
      succeededKeys: harvest.succeededKeys,
      failedKeys: harvest.failedKeys,
    }));

    await self.registration.showNotification('DJ Mix — Téléchargement interrompu', {
      body: `${done} morceau${done > 1 ? 'x' : ''} mis en cache — ${failed} à retenter`,
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: 'djmix-dl-done',
    });
    return;
  }

  clients.forEach(c => c.postMessage({ type: 'BG_FETCH_FAIL', id: bgFetch.id }));

  await self.registration.showNotification('DJ Mix — Téléchargement échoué', {
    body: 'Le téléchargement en arrière-plan a échoué.',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: 'djmix-dl-fail',
  });
}
