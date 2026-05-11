/**
 * main.js - DJ Mix app orchestrator.
 * Search: downloader API
 * Playback: temporary local Blob download + dual-deck crossfade
 */

import { DJPlayer } from './player.js';

const QUEUE_KEY = 'dj-mix:queue';
const DOWNLOADER_API_URL_KEY = 'dj-mix:downloader:api:url';
const DEFAULT_DOWNLOADER_API_URL = 'http://localhost:3000';

let player = null;
const sessionBlobCache = new Map();

/** @type {Array<QueueItem>} */
const queue = [];
let currentIndex = -1;
let currentTrackId = null;
let isPlaying = false;
let pendingAutoplay = false;
let playlistLoaded = false;
let blobCleanupTimer = null;
let playbackPositionMs = 0;
let playbackDurationMs = 0;
let lastSearchQuery = '';
let pendingSearchAdd = false;
let searchDebounceTimer = null;

const setupScreen = document.getElementById('setup-screen');
const appScreen = document.getElementById('app-screen');
const setupError = document.getElementById('setup-error');
const setupLoading = document.getElementById('setup-loading');

const oauthBtn = document.getElementById('oauth-btn');
const logoutBtn = document.getElementById('logout-btn');

const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');
const searchOverlay = document.getElementById('search-overlay');
const searchResults = document.getElementById('search-results');

const albumArt = document.getElementById('album-art');
const artPlaceholder = document.getElementById('art-placeholder');
const crossfadeRing = document.getElementById('crossfade-ring');
const trackName = document.getElementById('track-name');
const trackArtist = document.getElementById('track-artist');
const progressBarBg = document.querySelector('.progress-bar-bg');
const progressFill = document.getElementById('progress-fill');
const crossfadeZone = document.getElementById('crossfade-zone');
const currentTimeEl = document.getElementById('current-time');
const totalTimeEl = document.getElementById('total-time');
const playPauseBtn = document.getElementById('play-pause-btn');
const playIcon = document.getElementById('play-icon');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const crossfadeSlider = document.getElementById('crossfade-slider');
const crossfadeValue = document.getElementById('crossfade-value');
const queueList = document.getElementById('queue-list');
const emptyQueue = document.getElementById('empty-queue');
const clearQueueBtn = document.getElementById('clear-queue-btn');
const playlistListEl = document.getElementById('playlist-list');

const downloaderApiUrlInput = document.getElementById('downloader-api-url-input');
const downloaderApiSaveBtn = document.getElementById('downloader-api-save-btn');
const downloaderApiTestBtn = document.getElementById('downloader-api-test-btn');
const downloaderApiStatus = document.getElementById('downloader-api-status');

const tabBtns = document.querySelectorAll('.tab-bar-btn');
const tabPanels = {
  mix: document.getElementById('tab-mix'),
  playlist: document.getElementById('tab-playlist'),
  config: document.getElementById('tab-config'),
};

tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    if (tab === 'playlist') playlistLoaded = false;
    switchTab(tab);
  });
});

(async function init() {
  loadDownloaderApiConfigIntoForm();
  setupDownloaderApiConfigEvents();
  startBlobCleanupLoop();
  showSetupLoading(false);

  try {
    await connectLocal();
  } catch (err) {
    showToast(`Erreur API: ${err.message}`, true);
  }
})();

window.addEventListener('beforeunload', () => {
  clearSessionBlobCache();
});

oauthBtn?.addEventListener('click', async () => {
  hideSetupError();
  try {
    showSetupLoading(true, 'Initialisation locale...');
    await connectLocal();
  } catch (err) {
    showSetupError(err.message);
  } finally {
    showSetupLoading(false);
  }
});

logoutBtn?.addEventListener('click', doLogout);

async function connectLocal() {
  hideSetupError();
  startBlobCleanupLoop();

  player?.destroy();
  player = new DJPlayer();
  hookPlayerEvents();

  showApp();

  await player.init();
}

function hookPlayerEvents() {
  player.addEventListener('ready', async () => {
    playPauseBtn.disabled = false;
    showToast('Platines locales prêtes');

    if (pendingAutoplay && currentIndex >= 0 && queue[currentIndex]) {
      pendingAutoplay = false;
      await startPlaybackForIndex(currentIndex, 'play');
    }
  });

  player.addEventListener('statechange', ({ detail }) => {
    isPlaying = !detail.paused;
    playIcon.textContent = isPlaying ? '⏸' : '▶';
    renderQueue();
  });

  player.addEventListener('progress', ({ detail }) => {
    const { position, duration } = detail;
    if (!duration) return;

    playbackPositionMs = position;
    playbackDurationMs = duration;

    progressFill.style.width = `${(position / duration) * 100}%`;
    currentTimeEl.textContent = formatTime(position);
    totalTimeEl.textContent = formatTime(duration);

    const fadePct = Math.min(100, (player.crossfadeDuration / duration) * 100);
    crossfadeZone.style.width = `${fadePct}%`;
  });

  player.addEventListener('crossfadeready', async () => {
    const next = queue[currentIndex + 1];
    if (!next) return;

    showCrossfadeRing(true);
    showToast('Crossfade en cours...');

    try {
      await startPlaybackForIndex(currentIndex + 1, 'crossfade');
      renderQueue();
    } catch (err) {
      showToast(`API: ${err.message}`, true);
    } finally {
      showCrossfadeRing(false);
    }
  });

  player.addEventListener('trackend', () => {
    isPlaying = false;
    playIcon.textContent = '▶';
    showCrossfadeRing(false);
    renderQueue();
  });

  player.addEventListener('error', ({ detail }) => {
    showToast(`Erreur API: ${detail.message}`, true);
  });
}

playPauseBtn.addEventListener('click', async () => {
  player?.activateElement();
  if (!player || currentIndex < 0) return;

  if (!isPlaying && queue[currentIndex]) {
    await startPlaybackForIndex(currentIndex, 'play');
    return;
  }

  await player.togglePause().catch((err) => showToast(`Erreur: ${err.message}`, true));
});

nextBtn.addEventListener('click', async () => {
  const next = queue[currentIndex + 1];
  if (!next || !player || player.isCrossfading) return;

  showCrossfadeRing(true);
  showToast('Crossfade en cours...');

  try {
    await startPlaybackForIndex(currentIndex + 1, 'crossfade');
    renderQueue();
  } catch (err) {
    showToast(`API: ${err.message}`, true);
  } finally {
    showCrossfadeRing(false);
  }
});

prevBtn.addEventListener('click', async () => {
  if (!player || currentIndex <= 0 || player.isCrossfading) return;

  showCrossfadeRing(true);
  try {
    await startPlaybackForIndex(currentIndex - 1, 'crossfade');
    renderQueue();
  } catch (err) {
    showToast(`API: ${err.message}`, true);
  } finally {
    showCrossfadeRing(false);
  }
});

crossfadeSlider.addEventListener('input', () => {
  const sec = Number(crossfadeSlider.value);
  crossfadeValue.textContent = `${sec}s`;
  if (player) player.crossfadeDuration = sec * 1000;
});

progressBarBg?.addEventListener('click', async (event) => {
  if (!player || currentIndex < 0 || player.isCrossfading) return;
  if (!playbackDurationMs || !Number.isFinite(playbackDurationMs) || playbackDurationMs <= 0) return;

  const rect = progressBarBg.getBoundingClientRect();
  if (!rect.width) return;

  const relativeX = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
  const ratio = relativeX / rect.width;
  const targetMs = Math.round(playbackDurationMs * ratio);

  try {
    await player.seekTo(targetMs, { fadeMs: 180 });
    playbackPositionMs = targetMs;
    progressFill.style.width = `${ratio * 100}%`;
    currentTimeEl.textContent = formatTime(playbackPositionMs);
    totalTimeEl.textContent = formatTime(playbackDurationMs);
  } catch (err) {
    showToast(`Erreur seek: ${err.message}`, true);
  }
});

clearQueueBtn.addEventListener('click', () => {
  if (!queue.length) return;

  if (currentTrackId) {
    const current = queue.find((item) => item.id === currentTrackId);
    if (current) {
      for (const item of queue) {
        if (item.id !== currentTrackId) releaseLocalBlob(item);
      }
      queue.length = 0;
      queue.push(current);
      currentIndex = 0;
    } else {
      for (const item of queue) releaseLocalBlob(item);
      queue.length = 0;
      currentIndex = -1;
      currentTrackId = null;
    }
  } else {
    for (const item of queue) releaseLocalBlob(item);
    queue.length = 0;
    currentIndex = -1;
  }

  renderQueue();
});

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  searchClear.hidden = !q;
  clearTimeout(searchDebounceTimer);

  if (!q) {
    lastSearchQuery = '';
    closeSearch();
    return;
  }

  openSearch();
  searchResults.innerHTML = '<div class="search-loading">Recherche API...</div>';

  searchDebounceTimer = setTimeout(async () => {
    const term = searchInput.value.trim();
    if (!term) return;
    if (term === lastSearchQuery) return;

    lastSearchQuery = term;
    await runSearch(term);
  }, 600);
});

searchInput.addEventListener('keydown', async (event) => {
  if (event.key !== 'Enter') return;

  const q = searchInput.value.trim();
  if (!q) return;
  event.preventDefault();
  clearTimeout(searchDebounceTimer);

  if (q === lastSearchQuery) return;

  openSearch();
  searchResults.innerHTML = '<div class="search-loading">Recherche API...</div>';
  lastSearchQuery = q;
  await runSearch(q);
});

searchClear.addEventListener('click', () => {
  clearTimeout(searchDebounceTimer);
  searchInput.value = '';
  searchClear.hidden = true;
  lastSearchQuery = '';
  closeSearch();
  searchInput.focus();
});

searchOverlay.addEventListener('click', (e) => {
  if (e.target === searchOverlay) closeSearch();
});

async function runSearch(query) {
  try {
    if (!getDownloaderApiUrl()) {
      searchResults.innerHTML = '<div class="search-empty">Configurez l’API de téléchargement dans l’onglet Config</div>';
      return;
    }

    const tracks = await searchTracksViaApi(query);
    if (!tracks?.length) {
      searchResults.innerHTML = '<div class="search-empty">Aucun résultat</div>';
      return;
    }

    const normalized = tracks
      .map(mapApiTrackToSearchItem)
      .filter(Boolean)
      .sort(sortSearchResultsByPopularity);
    const songResults = normalized.filter((track) => !track.isArtistResult);
    const artistResults = normalized.filter((track) => track.isArtistResult);

    searchResults.innerHTML = buildSearchResultsSectionsHTML(songResults, artistResults);
    searchResults.querySelectorAll('.search-result-item').forEach((el, i) => {
      el.addEventListener('click', () => {
        player?.activateElement();
        const kind = el.dataset.kind;
        const idx = Number(el.dataset.index);
        const result = kind === 'artist' ? artistResults[idx] : songResults[idx];
        if (!result) return;

        if (result?.isArtistResult) {
          searchInput.value = result.artist || result.name || '';
          searchClear.hidden = !searchInput.value;
          lastSearchQuery = '';
          openSearch();
          searchResults.innerHTML = '<div class="search-loading">Recherche API...</div>';
          runSearch(searchInput.value.trim());
          return;
        }

        if (pendingSearchAdd) return;
        pendingSearchAdd = true;
        closeSearch();

        addToQueue(result)
          .catch((err) => {
            showToast(`API: ${err.message}`, true);
          })
          .finally(() => {
            pendingSearchAdd = false;
          });
      });
    });
  } catch (err) {
    searchResults.innerHTML = `<div class="search-empty">⚠ ${escHtml(err.message)}</div>`;
  }
}

async function addToQueue(track) {
  const artUrl = getBestArtworkUrl(track);
  const duration = getTrackDurationMs(track);
  const item = {
    id: track.id || track.ratingKey || track.uri || track.name,
    uri: track.uri || track.downloadUrl || `api:track:${track.id || track.name}`,
    name: track.name || track.title || 'Titre API',
    artist: track.artists ? track.artists.map((a) => a.name).join(', ') : (track.artist || 'Artiste inconnu'),
    artUrl,
    duration,
    sourceState: 'idle',
    sourceError: null,
    sourceMeta: null,
    localBlobUrl: null,
    lastTouchedAt: Date.now(),
  };

  queue.push(item);
  const addedIndex = queue.length - 1;
  renderQueue();

  if (!isPlaying && !player?.isCrossfading) {
    currentIndex = addedIndex;
    currentTrackId = item.id;
    renderQueue();

    if (player?.isReady) {
      await startPlaybackForIndex(currentIndex, 'play');
    } else {
      pendingAutoplay = true;
    }
  } else if (currentIndex < 0) {
    currentIndex = 0;
    currentTrackId = queue[0]?.id ?? null;
    renderQueue();
  }

  // Warm cache immediately on queue add so playback is instant later.
  ensureLocalSource(item).catch(() => {
    // keep silent; item state already shows error in queue
  });

  closeSearch();
  searchInput.value = '';
  searchClear.hidden = true;
  lastSearchQuery = '';
  showToast(`✔ "${item.name}" ajouté`);
}

async function startPlaybackForIndex(index, mode) {
  const item = queue[index];
  if (!item || !player) return;

  currentIndex = index;
  currentTrackId = item.id;

  try {
    touchQueueItem(item);
    updateNowPlaying(item);
    const sourceUrl = await ensureLocalSource(item);

    if (mode === 'crossfade') {
      await player.crossfadeTo(sourceUrl);
    } else if (mode === 'switch') {
      await player.switchTo(sourceUrl);
    } else {
      await player.play(sourceUrl);
    }

    isPlaying = true;
    playIcon.textContent = '⏸';
    prefetchNext(index + 1);
    renderQueue();
  } catch (err) {
    item.sourceState = 'error';
    item.sourceError = err.message;
    renderQueue();
    showToast(`API: ${err.message}`, true);
    throw err;
  }
}

async function ensureLocalSource(item) {
  const cacheKey = getTrackCacheKey(item);
  const cachedBlobUrl = sessionBlobCache.get(cacheKey);
  if (item.localBlobUrl) return item.localBlobUrl;
  if (cachedBlobUrl) {
    item.localBlobUrl = cachedBlobUrl;
    item.sourceState = 'ready';
    item.sourceError = null;
    touchQueueItem(item);
    hydrateItemDurationFromLocalSource(item);
    renderQueue();
    return item.localBlobUrl;
  }

  item.sourceState = 'resolving';
  item.sourceError = null;
  renderQueue();

  try {
    item.localBlobUrl = await downloadTrackViaApi(item);
    sessionBlobCache.set(cacheKey, item.localBlobUrl);
    item.sourceState = 'ready';
    item.sourceMode = 'api';
    touchQueueItem(item);
    hydrateItemDurationFromLocalSource(item);
    renderQueue();
    return item.localBlobUrl;
  } catch (err) {
    item.sourceState = 'error';
    item.sourceError = err.message;
    renderQueue();
    throw err;
  }
}

async function hydrateItemDurationFromLocalSource(item) {
  if (!item || item.duration > 0 || !item.localBlobUrl) return;
  if (item.durationProbeInFlight) return;

  item.durationProbeInFlight = true;
  try {
    const durationMs = await readAudioDurationMs(item.localBlobUrl);
    if (durationMs > 0) {
      item.duration = durationMs;
      renderQueue();
    }
  } finally {
    item.durationProbeInFlight = false;
  }
}

function readAudioDurationMs(sourceUrl) {
  return new Promise((resolve) => {
    if (!sourceUrl) {
      resolve(0);
      return;
    }

    const audio = new Audio();
    audio.preload = 'metadata';

    let settled = false;
    const cleanup = () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('error', onError);
      clearTimeout(timeoutId);
      audio.src = '';
    };

    const finish = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        finish(Math.round(audio.duration * 1000));
        return;
      }
      finish(0);
    };

    const onError = () => finish(0);
    const timeoutId = setTimeout(() => finish(0), 8000);

    audio.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
    audio.addEventListener('error', onError, { once: true });
    audio.src = sourceUrl;
  });
}

async function searchTracksViaApi(query, limit = 25) {
  const baseUrl = getDownloaderApiUrl();
  if (!baseUrl) throw new Error('URL API downloader manquante (Config)');

  const parsed = splitItunesSearchQuery(query);
  const searchAttempts = [
    { term: parsed.title, artist: parsed.artist },
    { term: cleanItunesSearchText(query), artist: '' },
  ]
    .map((attempt) => ({
      term: cleanItunesSearchText(attempt.term || ''),
      artist: cleanItunesSearchText(attempt.artist || ''),
    }))
    .filter((attempt, index, array) => array.findIndex((candidate) => candidate.term === attempt.term && candidate.artist === attempt.artist) === index)
    .filter((attempt) => attempt.term);

  for (const attempt of searchAttempts) {
    const limitParam = Number.isFinite(limit) && limit > 0 ? `&limit=${encodeURIComponent(limit)}` : '';
    const url = `${baseUrl}/api/search?term=${encodeURIComponent(attempt.term)}${attempt.artist ? `&artist=${encodeURIComponent(attempt.artist)}` : ''}${limitParam}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) continue;

    const data = await res.json().catch(() => null);
    const items = normalizeApiSearchResponse(data);
    if (items.length) return items;
  }

  return [];
}

async function downloadTrackViaApi(item) {
  const baseUrl = getDownloaderApiUrl();
  if (!baseUrl) {
    throw new Error('URL API downloader manquante (Config)');
  }

  const payload = {
    trackName: item.name,
    artistName: item.artist,
    searchQuery: `${item.artist} ${item.name}`,
    title: item.name,
    artist: item.artist,
    id: item.id,
    ratingKey: item.ratingKey,
  };

  const res = await fetch(`${baseUrl}/api/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${body}`.trim());
  }

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('audio') || contentType.includes('octet-stream')) {
    const blob = await res.blob();
    if (!blob || blob.size === 0) throw new Error('Flux audio vide depuis API');
    return URL.createObjectURL(blob);
  }

  const data = await res.json().catch(() => null);
  const directUrl = data?.downloadUrl || data?.url || data?.fileUrl || data?.audioUrl;
  if (!directUrl) {
    throw new Error('Réponse API sans URL audio');
  }

  const mediaRes = await fetch(directUrl);
  if (!mediaRes.ok) {
    throw new Error(`Téléchargement URL API impossible (HTTP ${mediaRes.status})`);
  }

  const mediaBlob = await mediaRes.blob();
  if (!mediaBlob || mediaBlob.size === 0) {
    throw new Error('Audio téléchargé vide');
  }

  return URL.createObjectURL(mediaBlob);
}

function prefetchNext(index) {
  const next = queue[index];
  if (!next) return;
  if (next.localBlobUrl) return;
  touchQueueItem(next);

  ensureLocalSource(next).catch(() => {
    // silent prefetch failure: user can still trigger manually and get toast
  });
}

function renderQueue() {
  saveQueue();

  if (!queue.length) {
    queueList.innerHTML = '';
    queueList.appendChild(emptyQueue);
    emptyQueue.style.display = '';
    nextBtn.disabled = true;
    prevBtn.disabled = true;
    return;
  }

  emptyQueue.style.display = 'none';
  nextBtn.disabled = currentIndex >= queue.length - 1;
  prevBtn.disabled = currentIndex <= 0;

  queueList.innerHTML = queue.map((item, i) => {
    const isCurrent = item.id === currentTrackId;
    const cls = isCurrent ? 'queue-item is-current' : 'queue-item';
    const showPlayingBars = isCurrent && isPlaying;

    const numHtml = showPlayingBars
      ? '<div class="queue-num"><div class="playing-bars" aria-label="En cours"><span></span><span></span><span></span></div></div>'
      : `<div class="queue-num">${i + 1}</div>`;

    return `
      <div class="${cls}" data-index="${i}" role="button" tabindex="0">
        ${numHtml}
        <img class="queue-art" src="${escHtml(item.artUrl)}" alt="" loading="lazy">
        <div class="queue-info">
          <div class="queue-name">${escHtml(item.name)}</div>
          <div class="queue-artist">${escHtml(item.artist)} ${renderSourceBadge(item)}</div>
        </div>
        <span class="queue-duration">${formatTime(item.duration)}</span>
        <button class="queue-remove" data-index="${i}" aria-label="Retirer">✕</button>
      </div>`;
  }).join('');

  queueList.querySelectorAll('.queue-item').forEach((el) => {
    el.addEventListener('click', async (e) => {
      if (e.target.classList.contains('queue-remove')) return;
      const idx = Number(el.dataset.index);
      if (idx === currentIndex || player.isCrossfading) return;

      showCrossfadeRing(true);
      try {
        await startPlaybackForIndex(idx, 'crossfade');
        currentIndex = idx;
        renderQueue();
      } finally {
        showCrossfadeRing(false);
      }
    });
  });

  queueList.querySelectorAll('.queue-remove').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.index);
      removeFromQueue(idx);
    });
  });
}

function renderSourceBadge(item) {
  if (item.sourceState === 'ready') return '• Cache ✓';
  if (item.sourceState === 'resolving') return '• Cache ...';
  if (item.sourceState === 'error') return '• Cache !';
  return '';
}

function removeFromQueue(idx) {
  const item = queue[idx];
  if (item?.id === currentTrackId) return;
  const [removed] = queue.splice(idx, 1);
  releaseLocalBlob(removed);
  updateCurrentIndex();
  renderQueue();
}

function updateCurrentIndex() {
  if (!currentTrackId) {
    currentIndex = -1;
    return;
  }
  const idx = queue.findIndex((item) => item.id === currentTrackId);
  currentIndex = idx >= 0 ? idx : -1;
}

function startBlobCleanupLoop() {
  if (blobCleanupTimer) clearInterval(blobCleanupTimer);

  // Cache is intentionally kept for the whole page lifetime.
  blobCleanupTimer = null;
}

function touchQueueItem(item) {
  if (!item) return;
  item.lastTouchedAt = Date.now();
}

async function loadPlaylists() {
  playlistLoaded = true;
  playlistListEl.innerHTML = `
    <div class="search-empty">
      Le cache local remplace maintenant les playlists.<br>
      Recherchez une chanson via l'API en haut pour l'ajouter à la file.
    </div>`;
}

function switchTab(name) {
  tabBtns.forEach((btn) => {
    const on = btn.dataset.tab === name;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });

  Object.entries(tabPanels).forEach(([key, panel]) => {
    const on = key === name;
    panel.classList.toggle('active', on);
    panel.hidden = !on;
  });

  if (name === 'playlist' && !playlistLoaded) loadPlaylists();
}

function loadDownloaderApiConfigIntoForm() {
  const url = localStorage.getItem(DOWNLOADER_API_URL_KEY) || DEFAULT_DOWNLOADER_API_URL;
  if (!localStorage.getItem(DOWNLOADER_API_URL_KEY)) {
    localStorage.setItem(DOWNLOADER_API_URL_KEY, url);
  }
  if (downloaderApiUrlInput) downloaderApiUrlInput.value = url;
}

function saveDownloaderApiConfigFromForm() {
  const baseUrl = (downloaderApiUrlInput?.value || DEFAULT_DOWNLOADER_API_URL).trim();
  localStorage.setItem(DOWNLOADER_API_URL_KEY, baseUrl);
}

function setupDownloaderApiConfigEvents() {
  downloaderApiSaveBtn?.addEventListener('click', () => {
    saveDownloaderApiConfigFromForm();
    setDownloaderApiStatus('Configuration API enregistrée', false);
  });

  downloaderApiTestBtn?.addEventListener('click', async () => {
    saveDownloaderApiConfigFromForm();
    setDownloaderApiStatus('Test API en cours...', false);

    try {
      if (!getDownloaderApiUrl()) {
        throw new Error('URL API manquante');
      }
      const tracks = await searchTracksViaApi('Daft Punk', 1);
      if (!tracks.length) throw new Error('Aucun résultat de test');
      setDownloaderApiStatus('Connexion API OK', false);
    } catch (err) {
      setDownloaderApiStatus(`API indisponible: ${err.message}`, true);
    }
  });
}

function setDownloaderApiStatus(message, isError) {
  if (!downloaderApiStatus) return;
  downloaderApiStatus.textContent = message;
  downloaderApiStatus.style.color = isError ? '#f87171' : 'var(--text-muted)';
}

function getDownloaderApiUrl() {
  return (localStorage.getItem(DOWNLOADER_API_URL_KEY) || DEFAULT_DOWNLOADER_API_URL).trim().replace(/\/$/, '');
}

function updateNowPlaying(item) {
  trackName.textContent = item.name;
  trackArtist.textContent = item.artist;

  if (item.artUrl) {
    albumArt.src = item.artUrl;
    albumArt.hidden = false;
    artPlaceholder.style.display = 'none';
  } else {
    albumArt.src = '';
    albumArt.hidden = true;
    artPlaceholder.style.display = '';
  }
}

function showCrossfadeRing(on) {
  crossfadeRing.hidden = !on;
}

let toastTimer = null;
function showToast(msg, isError = false) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  clearTimeout(toastTimer);

  const el = document.createElement('div');
  el.className = 'toast';
  if (isError) el.style.borderColor = '#f87171';
  el.textContent = msg;
  document.body.appendChild(el);

  toastTimer = setTimeout(() => el.remove(), 3000);
}

function showSetup() {
  setupScreen.classList.add('active');
  setupScreen.hidden = false;
  appScreen.hidden = true;
  showSetupLoading(false);
}

function showSetupError(message) {
  if (!setupError) return;
  setupError.textContent = message || 'Erreur inconnue';
  setupError.hidden = false;
}

function hideSetupError() {
  if (!setupError) return;
  setupError.hidden = true;
  setupError.textContent = '';
}

function showSetupLoading(on, message = null) {
  if (!setupLoading) return;

  setupLoading.hidden = !on;
  if (!on) return;

  if (message) {
    setupLoading.textContent = '';
    const spinner = document.createElement('span');
    spinner.className = 'spinner';
    setupLoading.appendChild(spinner);
    setupLoading.appendChild(document.createTextNode(` ${message}`));
  }
}

function showApp() {
  setupScreen.hidden = true;
  setupScreen.classList.remove('active');
  appScreen.hidden = false;
  appScreen.classList.add('active');

  restoreQueue();
  renderQueue();
  playPauseBtn.disabled = true;
}

function doLogout() {
  player?.destroy();
  player = null;

  for (const item of queue) releaseLocalBlob(item);
  if (blobCleanupTimer) {
    clearInterval(blobCleanupTimer);
    blobCleanupTimer = null;
  }
  queue.length = 0;
  currentIndex = -1;
  currentTrackId = null;
  isPlaying = false;
  playlistLoaded = false;

  localStorage.removeItem(QUEUE_KEY);
  switchTab('mix');

  connectLocal().catch((err) => {
    showToast(`Erreur API: ${err.message}`, true);
  });
}

function releaseLocalBlob(item) {
  if (!item?.localBlobUrl) return;
  item.localBlobUrl = null;
  touchQueueItem(item);
}

function clearSessionBlobCache() {
  for (const blobUrl of sessionBlobCache.values()) {
    URL.revokeObjectURL(blobUrl);
  }
  sessionBlobCache.clear();
}

function saveQueue() {
  try {
    const serialized = {
      index: currentIndex,
      items: queue.map((item) => ({
        id: item.id,
        uri: item.uri,
        name: item.name,
        artist: item.artist,
        artUrl: item.artUrl,
        duration: item.duration,
        sourceState: item.sourceState === 'ready' ? 'idle' : item.sourceState,
      })),
    };
    localStorage.setItem(QUEUE_KEY, JSON.stringify(serialized));
  } catch (_) {
    // ignore quota errors
  }
}

function restoreQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.items) || !parsed.items.length) return;

    for (const item of parsed.items) {
      queue.push({
        ...item,
        sourceState: 'idle',
        sourceError: null,
        localBlobUrl: null,
        lastTouchedAt: Date.now(),
      });
    }

    currentIndex = typeof parsed.index === 'number' ? Math.max(0, parsed.index) : 0;
    if (currentIndex >= queue.length) currentIndex = queue.length - 1;
    currentTrackId = queue[currentIndex]?.id ?? null;
  } catch (_) {
    // ignore corrupted data
  }
}

function openSearch() {
  searchOverlay.hidden = false;
}

function closeSearch() {
  searchOverlay.hidden = true;
}

function buildResultHTML(track, kind = 'song', index = 0) {
  const artUrl = getBestArtworkUrl(track);
  const artist = track.artists ? track.artists.map((a) => a.name).join(', ') : (track.artist || 'Artiste inconnu');
  const hasDuration = Number(track.duration_ms) > 0;
  const dur = hasDuration ? formatTime(track.duration_ms) : '--:--';
  const isArtistResult = Boolean(track.isArtistResult);
  const durationHtml = isArtistResult ? '<span class="result-duration">Artiste</span>' : `<span class="result-duration">${dur}</span>`;
  const addLabel = isArtistResult ? '🔎' : '+';
  const addAria = isArtistResult ? 'Rechercher cet artiste' : 'Ajouter';

  return `
    <div class="search-result-item" data-kind="${kind}" data-index="${index}" role="button" tabindex="0">
      <img class="result-art" src="${escHtml(artUrl)}" alt="" loading="lazy">
      <div class="result-info">
        <div class="result-name">${escHtml(track.name)}</div>
        <div class="result-artist">${escHtml(artist)}</div>
      </div>
      ${durationHtml}
      <button class="add-btn" aria-label="${addAria}">${addLabel}</button>
    </div>`;
}

function buildSearchResultsSectionsHTML(songResults, artistResults) {
  const songs = Array.isArray(songResults) ? songResults : [];
  const artists = Array.isArray(artistResults) ? artistResults : [];
  const sections = [];

  if (songs.length) {
    sections.push(`
      <div class="search-section" data-section="songs">
        <div class="search-empty" style="text-align:left; padding-bottom:6px;">Musiques (${songs.length})</div>
        ${songs.map((track, index) => buildResultHTML(track, 'song', index)).join('')}
      </div>
    `);
  }

  if (artists.length) {
    sections.push(`
      <div class="search-section" data-section="artists">
        <div class="search-empty" style="text-align:left; padding-bottom:6px;">Artistes (${artists.length})</div>
        ${artists.map((track, index) => buildResultHTML(track, 'artist', index)).join('')}
      </div>
    `);
  }

  return sections.join('');
}

function normalizeApiSearchResponse(data) {
  if (!data) return [];
  const rootCandidates = [];

  if (Array.isArray(data)) rootCandidates.push(...data);
  if (Array.isArray(data.results)) rootCandidates.push(...data.results);
  if (Array.isArray(data.items)) rootCandidates.push(...data.items);
  if (Array.isArray(data?.artists?.results)) rootCandidates.push(...data.artists.results);
  if (Array.isArray(data?.tracks?.results)) rootCandidates.push(...data.tracks.results);
  if (Array.isArray(data.tracks)) rootCandidates.push(...data.tracks);
  if (Array.isArray(data.songs)) rootCandidates.push(...data.songs);
  if (Array.isArray(data.artists)) rootCandidates.push(...data.artists);
  if (Array.isArray(data.media)) rootCandidates.push(...data.media);
  if (Array.isArray(data?.tracks?.items)) rootCandidates.push(...data.tracks.items);
  if (Array.isArray(data?.items?.tracks)) rootCandidates.push(...data.items.tracks);
  if (Array.isArray(data?.data)) rootCandidates.push(...data.data);

  if (!rootCandidates.length) {
    rootCandidates.push(data);
  }

  return rootCandidates.flatMap((item) => extractSongCandidatesFromApiItem(item));
}

function extractSongCandidatesFromApiItem(item) {
  if (!item) return [];
  if (Array.isArray(item)) return item.flatMap((entry) => extractSongCandidatesFromApiItem(entry));
  if (typeof item !== 'object') return [];

  const type = String(item.type || item.resultType || item.kind || '').toLowerCase();
  const nestedSongCollections = [
    item.results,
    item?.artists?.results,
    item?.tracks?.results,
    item.tracks,
    item.songs,
    item.topTracks,
    item.popularTracks,
    item.items,
    item.data,
    item?.items?.tracks,
    item?.album?.tracks,
  ];

  const nestedSongs = nestedSongCollections
    .filter((collection) => Array.isArray(collection) && collection.length)
    .flatMap((collection) => extractSongCandidatesFromApiItem(collection));

  if (nestedSongs.length) return nestedSongs;

  if (type.includes('artist') || type.includes('artiste')) {
    // Pure artist entries are not directly playable in queue.
    return [];
  }

  const hasTrackShape = Boolean(
    item.title
    || item.trackName
    || item.song
    || (item.name && (item.duration || item.duration_ms || item.uri || item.downloadUrl))
  );

  return hasTrackShape ? [item] : [];
}

function cleanItunesSearchText(text) {
  return String(text || '')
    .replace(/\s*[\[(][^\])\n]*[\])\n]/g, '')
    .replace(/\s*[-–|]\s*(Official|Audio|Lyrics?|Video|HD|HQ|4K|Live|Karaoke|Cover|Clip).*/i, '')
    .replace(/\s+(feat\.?|ft\.?)\s+.+$/i, '')
    .trim();
}

function splitItunesSearchQuery(rawQuery) {
  const cleaned = cleanItunesSearchText(rawQuery);
  const separators = [' - ', ' – ', ' — ', ' | ', ': '];
  for (const separator of separators) {
    const parts = cleaned.split(separator);
    if (parts.length >= 2) {
      return {
        artist: parts[0].trim(),
        title: parts.slice(1).join(separator).trim(),
      };
    }
  }

  return { artist: '', title: cleaned };
}

function mapApiTrackToSearchItem(track) {
  if (!track) return null;

  const type = String(track.type || track.resultType || track.kind || '').toLowerCase();
  const isArtistResult = Boolean(
    type.includes('artist')
    || type.includes('artiste')
    || (!track.trackName && !track.title && !track.song && !track.previewUrl && !track.downloadUrl && track.name)
  );

  if (isArtistResult) {
    const artistName = track.name || track.artistName || track.artist || 'Artiste inconnu';
    const artUrl = getBestArtworkUrl(track);
    return {
      id: track.id || track.artistId || `artist:${artistName}`,
      uri: track.viewUrl || track.artistViewUrl || `api:artist:${track.id || artistName}`,
      name: artistName,
      artist: artistName,
      artUrl,
      duration_ms: 0,
      duration: 0,
      isArtistResult: true,
      popularityScore: getPopularityScore(track),
      artists: [{ name: artistName }],
      album: { images: artUrl ? [{ url: artUrl }] : [] },
      downloadUrl: '',
    };
  }

  const title = track.title || track.trackName || track.name || track.song || track.grandparentTitle;
  if (!title) return null;

  const artist = track.artist || track.artistName || track.originalTitle || track.grandparentTitle || track.collectionName || 'Artiste inconnu';
  const artUrl = getBestArtworkUrl(track);
  const duration = getTrackDurationMs(track);

  return {
    id: track.id || track.ratingKey || `${title}-${artist}`,
    uri: track.uri || track.downloadUrl || `api:track:${track.id || title}`,
    name: title,
    artist,
    artUrl,
    duration_ms: duration,
    duration,
    isArtistResult: false,
    popularityScore: getPopularityScore(track),
    artists: [{ name: artist }],
    album: { images: artUrl ? [{ url: artUrl }, { url: artUrl }] : [] },
    downloadUrl: track.downloadUrl || track.streamUrl || track.url || '',
  };
}

function sortSearchResultsByPopularity(a, b) {
  // Put songs before artists, then sort by popularity descending.
  if (a.isArtistResult !== b.isArtistResult) {
    return a.isArtistResult ? 1 : -1;
  }

  const scoreA = Number.isFinite(a.popularityScore) ? a.popularityScore : 0;
  const scoreB = Number.isFinite(b.popularityScore) ? b.popularityScore : 0;
  if (scoreA !== scoreB) return scoreB - scoreA;

  // Keep deterministic ordering when popularity is missing/equal.
  return String(a.name || '').localeCompare(String(b.name || ''), 'fr', { sensitivity: 'base' });
}

function getPopularityScore(track) {
  if (!track || typeof track !== 'object') return 0;

  const candidates = [
    track.popularity,
    track.popularityScore,
    track.score,
    track.rank,
    track.rating,
    track.ratingCount,
    track.listenerCount,
    track.playCount,
    track.plays,
    track.views,
    track.followers,
    track.weight,
    track.position,
    track.index,
    track.order,
    track.sort,
    track.metrics?.popularity,
    track.stats?.popularity,
  ];

  for (const candidate of candidates) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric) && numeric > 0) {
      // Lower rank/position means more popular, invert those.
      if (candidate === track.rank || candidate === track.position || candidate === track.index || candidate === track.order || candidate === track.sort) {
        return 1_000_000 - numeric;
      }
      return numeric;
    }
  }

  return 0;
}

function getTrackCacheKey(track) {
  if (!track) return '';
  return String(track.uri || track.id || `${track.artist || ''}::${track.name || track.title || ''}`);
}

function getTrackDurationMs(track) {
  if (!track) return 0;

  const candidates = [
    // Direct properties (most common)
    track.duration_ms,
    track.durationMs,
    track.durationMS,
    track.trackDurationMs,
    track.track_duration_ms,
    track.lengthMs,
    track.length_ms,
    track.trackTimeMillis,
    track.timeMillis,
    track.durationMillis,
    track.durationInMs,
    track.durationInSec,
    track.durationInSeconds,
    track.lengthSeconds,
    track.seconds,
    track.duration,
    track.length,
    track.runtime,
    track.time,
    track.formattedDuration,
    track.formatted_duration,
    // Alternative naming conventions
    track.durationMilliseconds,
    track.durationInMilliseconds,
    track.lengthMilliseconds,
    track.lengthInMilliseconds,
    track.totalDuration,
    track.totalDurationMs,
    track.totalLength,
    track.playbackDuration,
    track.trackDuration,
    track.songLength,
    track.audioDuration,
    track.mediaLength,
    track.totalMilliseconds,
    track.playback_duration,
    track.trackLength,
    // Nested duration objects
    track.duration?.ms,
    track.duration?.milliseconds,
    track.duration?.millis,
    track.duration?.seconds,
    track.duration?.sec,
    track.duration?.formatted,
    track.duration?.text,
    track.meta?.duration,
    track.metadata?.duration,
    track.attributes?.duration,
    // Spotify-like nested (sometimes at top level too)
    track.track?.duration_ms,
    track.track?.duration,
    track.track?.trackTimeMillis,
    track.track?.duration?.ms,
  ];

  for (const value of candidates) {
    const ms = parseDurationToMs(value);
    if (ms > 0) return ms;
  }

  return 0;
}

function parseDurationToMs(value) {
  if (value && typeof value === 'object') {
    const nested = [
      value.ms,
      value.milliseconds,
      value.millis,
      value.seconds,
      value.sec,
      value.formatted,
      value.text,
      value.value,
      value.duration,
    ];

    for (const candidate of nested) {
      const ms = parseDurationToMs(candidate);
      if (ms > 0) return ms;
    }
    return 0;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value <= 0) return 0;
    // Most APIs return ms; small numeric values are usually seconds.
    return value < 1000 ? Math.round(value * 1000) : Math.round(value);
  }

  if (typeof value !== 'string') return 0;
  const text = value.trim();
  if (!text) return 0;

  const isoMatch = text.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (isoMatch) {
    const h = Number(isoMatch[1] || 0);
    const m = Number(isoMatch[2] || 0);
    const s = Number(isoMatch[3] || 0);
    const totalSeconds = (h * 3600) + (m * 60) + s;
    if (totalSeconds > 0) return totalSeconds * 1000;
  }

  if (/^\d+(\.\d+)?$/.test(text)) {
    const numeric = Number(text);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return numeric < 1000 ? Math.round(numeric * 1000) : Math.round(numeric);
  }

  const colonParts = text.split(':').map((part) => Number(part));
  if (colonParts.length >= 2 && colonParts.every((n) => Number.isFinite(n) && n >= 0)) {
    let seconds = 0;
    for (const part of colonParts) {
      seconds = (seconds * 60) + part;
    }
    return Math.round(seconds * 1000);
  }

  const match = text.match(/(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?/i);
  if (match) {
    const h = Number(match[1] || 0);
    const m = Number(match[2] || 0);
    const s = Number(match[3] || 0);
    const totalSeconds = (h * 3600) + (m * 60) + s;
    if (totalSeconds > 0) return totalSeconds * 1000;
  }

  return 0;
}

function getBestArtworkUrl(track) {
  if (!track) return '';

  const directCandidates = [
    track.artUrl,
    track.artworkUrl100,
    track.artworkUrl60,
    track.artworkUrl,
    track.cover,
    track.coverUrl,
    track.image,
    track.imageUrl,
    track.thumbnail,
    track.thumb,
    track.poster,
    track.posterUrl,
  ];

  for (const candidate of directCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }

  const nestedCollections = [
    track.album?.images,
    track.images,
    track.thumbnails,
    track.artworks,
    track.covers,
  ];

  for (const collection of nestedCollections) {
    if (!Array.isArray(collection) || !collection.length) continue;

    for (const image of collection) {
      if (!image) continue;
      if (typeof image === 'string' && image.trim()) return image.trim();
      if (typeof image?.url === 'string' && image.url.trim()) return image.url.trim();
      if (typeof image?.src === 'string' && image.src.trim()) return image.src.trim();
    }
  }

  if (typeof track.album?.artwork === 'string' && track.album.artwork.trim()) return track.album.artwork.trim();
  if (typeof track.album?.cover === 'string' && track.album.cover.trim()) return track.album.cover.trim();

  return '';
}

function formatTime(ms) {
  const total = Math.round((Number(ms) || 0) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * @typedef {Object} QueueItem
 * @property {string} id
 * @property {string} uri
 * @property {string} name
 * @property {string} artist
 * @property {string} artUrl
 * @property {number} duration
 * @property {'idle'|'resolving'|'ready'|'error'} sourceState
 * @property {string|null} sourceError
 * @property {string|null} sourceMeta
 * @property {string|null} localBlobUrl
 * @property {number} lastTouchedAt
 */
