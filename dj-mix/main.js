/**
 * main.js - DJ Mix app orchestrator.
 * Search: downloader API
 * Playback: temporary local Blob download + dual-deck crossfade
 */

import { DJPlayer } from './player.js';
import { AutoFadeManager } from './lib/autoFadeManager.js';

const QUEUE_KEY = 'dj-mix:queue';
const DOWNLOADER_API_URL_KEY = 'dj-mix:downloader:api:url';
const FX_VISIBILITY_KEY = 'dj-mix:fx:hidden';
const DEFAULT_DOWNLOADER_API_URL = 'http://localhost:3000';
const AUDIO_CACHE_NAME = 'dj-mix:audio-cache:v1';

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
let launchPreviewActive = false;
let launchPreviewArtUrl = '';
let draggedQueueIndex = -1;
let suppressQueueItemClick = false;
let toastTimer = null;
let deckMixRatio = 0;
let manualMixLock = false;
let deckBCueIndex = -1;
let mixFeatures = {
  autoBpm: false,
  echo: false,
  distortion: false,
};
let fxControlsHidden = false;

const setupScreen = document.getElementById('setup-screen');
const appScreen = document.getElementById('app-screen');
const setupError = document.getElementById('setup-error');
const setupLoading = document.getElementById('setup-loading');

const oauthBtn = document.getElementById('oauth-btn');
const logoutBtn = document.getElementById('logout-btn');

const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');
const searchClose = document.getElementById('search-close');
const searchOverlay = document.getElementById('search-overlay');
const searchResults = document.getElementById('search-results');

const albumArt = document.getElementById('album-art');
const artPlaceholder = document.getElementById('art-placeholder');
const nextAlbumArt = document.getElementById('next-album-art');
const nextArtPlaceholder = document.getElementById('next-art-placeholder');
const nextArtLabel = document.getElementById('next-art-label');
const crossfadeRing = document.getElementById('crossfade-ring');
const trackName = document.getElementById('track-name');
const trackArtist = document.getElementById('track-artist');
const progressBarBg = document.querySelector('.progress-bar-bg');
const progressFill = document.getElementById('progress-fill');
const crossfadeZone = document.getElementById('crossfade-zone');
const currentTimeEl = document.getElementById('current-time');
const totalTimeEl = document.getElementById('total-time');
const deckAPanel = document.getElementById('deck-a-panel');
const deckBPanel = document.getElementById('deck-b-panel');
const deckAVol = document.getElementById('deck-a-vol');
const deckBVol = document.getElementById('deck-b-vol');
const deckASlider = document.getElementById('deck-a-slider');
const deckBSlider = document.getElementById('deck-b-slider');
const deckALaunchBtn = document.getElementById('deck-a-launch');
const deckBLaunchBtn = document.getElementById('deck-b-launch');
const deckMixSlider = document.getElementById('deck-mix-slider');
const deckMixLabel = document.getElementById('deck-mix-label');
const deckBCueLabel = document.getElementById('deck-b-cue-label');
const deckSyncBtn = document.getElementById('deck-sync-btn');
const manualLockBtn = document.getElementById('manual-lock-btn');
const fxVisibilityBtn = document.getElementById('fx-visibility-btn');
const deckFxActions = document.querySelector('.deck-fx-actions');
const autoBpmBtn = document.getElementById('fx-auto-bpm-btn');
const echoBtn = document.getElementById('fx-echo-btn');
const distortionBtn = document.getElementById('fx-distortion-btn');
const playPauseBtn = document.getElementById('play-pause-btn');
const playIcon = document.getElementById('play-icon');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const crossfadeSlider = document.getElementById('crossfade-slider');
const crossfadeValue = document.getElementById('crossfade-value');
const crossfadeSliderMix = document.getElementById('crossfade-slider-mix');
const crossfadeValueMix = document.getElementById('crossfade-value-mix');
const crossfadeFasterBtn = document.getElementById('crossfade-faster-btn');
const crossfadeSlowerBtn = document.getElementById('crossfade-slower-btn');
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
const deckMixControl = document.getElementById('deck-mix-control');

function syncMixOptionsVisibilityOnScroll() {
  if (!tabPanels.mix || !deckMixControl) return;
  const shouldHide = tabPanels.mix.scrollTop > 28;
  tabPanels.mix.classList.toggle('mix-options-collapsed', shouldHide);
  deckMixControl.setAttribute('aria-hidden', String(shouldHide));
}

tabPanels.mix?.addEventListener('scroll', syncMixOptionsVisibilityOnScroll, { passive: true });

const autoFadeManager = new AutoFadeManager({
  getQueueLength: () => queue.length,
  getCurrentIndex: () => currentIndex,
  isLocked: () => manualMixLock,
  onSkipLocked: () => showToast('Auto-fade verrouille (mix manuel)'),
  onStart: () => {
    showCrossfadeRing(true);
    showToast('Crossfade en cours...');
  },
  perform: async (nextIndex) => {
    await startPlaybackForIndex(nextIndex, 'autofade');
    renderQueue();
  },
  onError: (err) => showToast(`API: ${err.message}`, true),
  onEnd: () => showCrossfadeRing(false),
});

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
  restoreQueue();
  if (queue.length) {
    renderQueue();
    if (currentIndex >= 0 && queue[currentIndex]) {
      updateNowPlaying(queue[currentIndex]);
    }
  }
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
  player.crossfadeDuration = clampCrossfadeSeconds(crossfadeSlider.value) * 1000;
  player.setMixFeatures(mixFeatures);
  hookPlayerEvents();

  showApp();

  await player.init();
}

function hookPlayerEvents() {
  player.addEventListener('ready', async () => {
    playPauseBtn.disabled = false;
    showToast('Platines locales prêtes');
    applyDeckMixRatio(deckMixRatio, 0);
    player.setMixFeatures(mixFeatures);

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

  player.addEventListener('crossfadeready', () => {
    autoFadeManager.handleReady().catch(() => {
      // handled internally by manager callbacks
    });
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

    player.addEventListener('crossfadeprogress', ({ detail }) => {
      updateCrossfadeBars(detail);
    });

    player.addEventListener('deckstate', ({ detail }) => {
      renderDeckState(detail);
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
  if (!player || player.isCrossfading) return;
  const nextIndex = currentIndex + 1 < queue.length ? currentIndex + 1 : (queue.length > 1 ? 0 : -1);
  if (nextIndex < 0) return;

  showCrossfadeRing(true);
  showToast('Crossfade en cours...');

  try {
    await startPlaybackForIndex(nextIndex, 'crossfade');
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

function clampCrossfadeSeconds(value) {
  return Math.max(1, Math.min(30, Number(value) || 12));
}

function clampDeckMixRatio(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function updateDeckMixUI(ratio) {
  const safeRatio = clampDeckMixRatio(ratio);
  const deckA = Math.round((1 - safeRatio) * 100);
  const deckB = Math.round(safeRatio * 100);
  if (deckMixSlider) deckMixSlider.value = String(deckB);
  if (deckMixLabel) deckMixLabel.textContent = `P1 ${deckA}% / P2 ${deckB}%`;
}

function updateManualLockUI() {
  if (!manualLockBtn) return;
  manualLockBtn.setAttribute('aria-pressed', String(manualMixLock));
  manualLockBtn.textContent = manualMixLock ? 'Auto-Fade: OFF (verrou)' : 'Auto-Fade: ON';
}

function updateFxVisibilityUI() {
  if (!fxVisibilityBtn || !deckFxActions) return;
  deckFxActions.hidden = fxControlsHidden;
  fxVisibilityBtn.setAttribute('aria-expanded', String(!fxControlsHidden));
  fxVisibilityBtn.textContent = fxControlsHidden ? 'FX ▸' : 'FX ▾';
}

function applyMixFeatures() {
  if (player) player.setMixFeatures(mixFeatures);
  updateMixFeaturesUI();
}

function setMixFeatureEnabled(name, enabled) {
  mixFeatures = {
    ...mixFeatures,
    [name]: Boolean(enabled),
  };
  applyMixFeatures();
}

function styleFxButton(btn, active, label) {
  if (!btn) return;
  btn.classList.toggle('is-enabled', active);
  btn.setAttribute('aria-pressed', String(active));
  btn.textContent = `${label}: ${active ? 'ON' : 'OFF'}`;
}

function updateMixFeaturesUI() {
  styleFxButton(autoBpmBtn, mixFeatures.autoBpm, 'Auto BPM');
  styleFxButton(echoBtn, mixFeatures.echo, 'Echo');
  styleFxButton(distortionBtn, mixFeatures.distortion, 'Distorsion');
}

function updateDeckCueUI() {
  if (!deckBCueLabel) return;
  if (deckBCueIndex < 0 || !queue[deckBCueIndex]) {
    deckBCueLabel.textContent = 'Cue: suivant';
    return;
  }
  deckBCueLabel.textContent = `Cue: ${queue[deckBCueIndex].name}`;
}

function applyDeckMixRatio(ratio, transitionMs = 140) {
  deckMixRatio = clampDeckMixRatio(ratio);
  updateDeckMixUI(deckMixRatio);
  if (player) player.setDeckMixRatio(deckMixRatio, transitionMs);
}

function renderDeckState(detail) {
  if (!detail) return;
  if (deckAPanel) {
    deckAPanel.classList.toggle('is-playing', Boolean(detail.deckA?.playing));
    deckAPanel.classList.toggle('is-active', detail.activeDeck === 'A');
  }
  if (deckBPanel) {
    deckBPanel.classList.toggle('is-playing', Boolean(detail.deckB?.playing));
    deckBPanel.classList.toggle('is-active', detail.activeDeck === 'B');
  }

  if (!detail.isCrossfading) {
    const totalVolume = (detail.deckA?.volume || 0) + (detail.deckB?.volume || 0);
    if (totalVolume > 0) {
      const ratioB = (detail.deckB?.volume || 0) / totalVolume;
      updateDeckMixUI(ratioB);
    }
  }

  if (deckAVol) deckAVol.textContent = `${Math.round((detail.deckA?.volume || 0) * 100)}%`;
  if (deckBVol) deckBVol.textContent = `${Math.round((detail.deckB?.volume || 0) * 100)}%`;
  if (deckASlider && document.activeElement !== deckASlider) {
    deckASlider.value = String(Math.round((detail.deckA?.volume || 0) * 100));
  }
  if (deckBSlider && document.activeElement !== deckBSlider) {
    deckBSlider.value = String(Math.round((detail.deckB?.volume || 0) * 100));
  }
}

async function launchDeckFromQueue(deck) {
  if (!player || !queue.length) {
    showToast('Ajoutez une chanson dans la file', true);
    return;
  }

  const fallbackIndex = currentIndex >= 0 ? currentIndex : 0;
  const targetIndex = deck === 'B'
    ? (deckBCueIndex >= 0 && queue[deckBCueIndex]
      ? deckBCueIndex
      : (fallbackIndex + 1 < queue.length ? fallbackIndex + 1 : fallbackIndex))
    : fallbackIndex;

  const item = queue[targetIndex];
  if (!item) return;

  try {
    const sourceUrl = await ensureLocalSource(item);
    await player.playOnDeck(deck, { url: sourceUrl, loudnessDb: item.loudnessDb }, { makeActive: deck === 'A' });

    if (deck === 'A') {
      currentIndex = targetIndex;
      currentTrackId = item.id;
      updateNowPlaying(item);
      isPlaying = true;
      playIcon.textContent = '⏸';
      prefetchNext(targetIndex + 1);
      renderQueue();
    } else {
      launchPreviewActive = true;
      launchPreviewArtUrl = item.artUrl || '';
      updateUpcomingArtwork();
    }
  } catch (err) {
    showToast(`API: ${err.message}`, true);
  }
}

function updateCrossfadeControlUI(seconds) {
  const safeSeconds = clampCrossfadeSeconds(seconds);
  crossfadeSlider.value = String(safeSeconds);
  if (crossfadeSliderMix) crossfadeSliderMix.value = String(safeSeconds);
  crossfadeValue.textContent = `${safeSeconds}s`;
  if (crossfadeValueMix) crossfadeValueMix.textContent = `${safeSeconds}s`;
  if (crossfadeFasterBtn) crossfadeFasterBtn.disabled = safeSeconds <= 1;
  if (crossfadeSlowerBtn) crossfadeSlowerBtn.disabled = safeSeconds >= 30;
}

function setCrossfadeDurationSeconds(seconds) {
  const safeSeconds = clampCrossfadeSeconds(seconds);
  updateCrossfadeControlUI(safeSeconds);
  if (player) player.crossfadeDuration = safeSeconds * 1000;
}

crossfadeSlider.addEventListener('input', () => {
  setCrossfadeDurationSeconds(crossfadeSlider.value);
});

crossfadeSliderMix?.addEventListener('input', () => {
  setCrossfadeDurationSeconds(crossfadeSliderMix.value);
});

crossfadeFasterBtn?.addEventListener('click', () => {
  const sourceValue = crossfadeSliderMix?.value || crossfadeSlider.value;
  setCrossfadeDurationSeconds(Number(sourceValue) - 1);
});

crossfadeSlowerBtn?.addEventListener('click', () => {
  const sourceValue = crossfadeSliderMix?.value || crossfadeSlider.value;
  setCrossfadeDurationSeconds(Number(sourceValue) + 1);
});

deckMixSlider?.addEventListener('input', () => {
  applyDeckMixRatio((Number(deckMixSlider.value) || 0) / 100, 120);
});

deckALaunchBtn?.addEventListener('click', async () => {
  await launchDeckFromQueue('A');
});

deckBLaunchBtn?.addEventListener('click', async () => {
  await launchDeckFromQueue('B');
});

deckSyncBtn?.addEventListener('click', () => {
  if (!player) return;
  player.syncDecksToActive();
  showToast('Platines synchronisées');
});

manualLockBtn?.addEventListener('click', () => {
  manualMixLock = !manualMixLock;
  updateManualLockUI();
});

fxVisibilityBtn?.addEventListener('click', () => {
  fxControlsHidden = !fxControlsHidden;
  localStorage.setItem(FX_VISIBILITY_KEY, fxControlsHidden ? '1' : '0');
  updateFxVisibilityUI();
});

deckASlider?.addEventListener('input', () => {
  if (!player) return;
  const a = (Number(deckASlider.value) || 0) / 100;
  const b = (Number(deckBSlider?.value) || 0) / 100;
  player.setDeckVolumes(a, b, 80);
});

deckBSlider?.addEventListener('input', () => {
  if (!player) return;
  const a = (Number(deckASlider?.value) || 0) / 100;
  const b = (Number(deckBSlider.value) || 0) / 100;
  player.setDeckVolumes(a, b, 80);
});

autoBpmBtn?.addEventListener('click', () => {
  setMixFeatureEnabled('autoBpm', !mixFeatures.autoBpm);
});

echoBtn?.addEventListener('click', () => {
  setMixFeatureEnabled('echo', !mixFeatures.echo);
});

distortionBtn?.addEventListener('click', () => {
  setMixFeatureEnabled('distortion', !mixFeatures.distortion);
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

searchClose?.addEventListener('click', () => {
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
    searchResults.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const trackName = btn.dataset.trackName;
        const artistName = btn.dataset.artistName;
        const cachePath = btn.dataset.cachePath;
        const track = { name: trackName, artist: artistName, cachePath };
        btn.disabled = true;
        btn.textContent = '…';
        deleteLocalCacheSong(track)
          .then(() => {
            showToast(`Supprimé : ${trackName}`);
            btn.closest('.search-result-item')?.remove();
          })
          .catch((err) => {
            showToast(`Erreur suppression : ${err.message}`, true);
            btn.disabled = false;
            btn.textContent = '🗑';
          });
      });
    });
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
    loudnessDb: extractTrackLoudnessDb(track),
    persistedSourceUrl: getDirectPlayableSourceUrl(track),
    sourceState: 'idle',
    sourceError: null,
    sourceMeta: null,
    localBlobUrl: null,
    lastTouchedAt: Date.now(),
  };

  const isDuplicate = queue.some(
    (q) => q.id === item.id || (q.name === item.name && q.artist === item.artist)
  );
  if (isDuplicate) {
    showToast(`Déjà dans la file : ${item.name}`, true);
    return;
  }

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

  showToast(`✔ "${item.name}" ajouté`);
}

async function startPlaybackForIndex(index, mode) {
  const item = queue[index];
  if (!item || !player) return;

  if (mode === 'crossfade' && currentTrackId && item.id !== currentTrackId) {
    launchPreviewActive = true;
    launchPreviewArtUrl = item.artUrl || '';
  } else {
    launchPreviewActive = false;
    launchPreviewArtUrl = '';
  }
  updateUpcomingArtwork();

  currentIndex = index;
  currentTrackId = item.id;

  try {
    touchQueueItem(item);
    updateNowPlaying(item);
    const sourceUrl = await ensureLocalSource(item);

    if (mode === 'autofade') {
      const targetDeck = player.activeDeck === 'B' ? 'A' : 'B';
      await player.crossfadeToDeck(targetDeck, { url: sourceUrl, loudnessDb: item.loudnessDb });
    } else if (mode === 'crossfade') {
      await player.crossfadeTo({ url: sourceUrl, loudnessDb: item.loudnessDb });
    } else if (mode === 'switch') {
      await player.switchTo({ url: sourceUrl, loudnessDb: item.loudnessDb });
    } else {
      await player.play({ url: sourceUrl, loudnessDb: item.loudnessDb });
    }

    isPlaying = true;
    playIcon.textContent = '⏸';
    prefetchNext(index + 1);
    launchPreviewActive = false;
    launchPreviewArtUrl = '';
    renderQueue();
  } catch (err) {
    item.sourceState = 'error';
    item.sourceError = err.message;
    launchPreviewActive = false;
    launchPreviewArtUrl = '';
    renderQueue();
    showToast(`API: ${err.message}`, true);
    throw err;
  }
}

async function ensureLocalSource(item) {
  const cacheKey = getTrackCacheKey(item);
  const cachedSource = sessionBlobCache.get(cacheKey);
  if (item.localBlobUrl) return item.localBlobUrl;

  if (item.persistedSourceUrl) {
    const isPlayable = await canLoadAudioSource(item.persistedSourceUrl);
    if (isPlayable) {
      item.localBlobUrl = item.persistedSourceUrl;
      item.sourceState = 'ready';
      item.sourceError = null;
      touchQueueItem(item);
      hydrateItemDurationFromLocalSource(item);
      renderQueue();
      return item.localBlobUrl;
    }
    item.persistedSourceUrl = '';
  }

  const directFromUri = getDirectPlayableSourceUrl(item);
  if (directFromUri) {
    const isPlayable = await canLoadAudioSource(directFromUri);
    if (isPlayable) {
      item.persistedSourceUrl = directFromUri;
      item.localBlobUrl = directFromUri;
      item.sourceState = 'ready';
      item.sourceError = null;
      touchQueueItem(item);
      hydrateItemDurationFromLocalSource(item);
      renderQueue();
      return item.localBlobUrl;
    }
  }

  if (cachedSource) {
    item.localBlobUrl = typeof cachedSource === 'string' ? cachedSource : cachedSource.url;
    if (Number.isFinite(cachedSource?.loudnessDb)) {
      item.loudnessDb = cachedSource.loudnessDb;
    }
    item.sourceState = 'ready';
    item.sourceError = null;
    touchQueueItem(item);
    hydrateItemDurationFromLocalSource(item);
    renderQueue();
    return item.localBlobUrl;
  }

  const persistedBlobUrl = await restorePersistedAudioBlobUrl(cacheKey);
  if (persistedBlobUrl) {
    item.localBlobUrl = persistedBlobUrl;
    sessionBlobCache.set(cacheKey, {
      url: persistedBlobUrl,
      loudnessDb: Number.isFinite(item.loudnessDb) ? item.loudnessDb : null,
    });
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
    const downloaded = await downloadTrackViaApi(item);
    item.localBlobUrl = downloaded.url;
    if (Number.isFinite(downloaded.loudnessDb)) {
      item.loudnessDb = downloaded.loudnessDb;
    }
    sessionBlobCache.set(cacheKey, {
      url: item.localBlobUrl,
      loudnessDb: Number.isFinite(item.loudnessDb) ? item.loudnessDb : null,
    });
    item.sourceState = 'ready';
    item.sourceMode = 'api';
    item.sourceMeta = downloaded.sourceMeta || null;
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

async function deleteLocalCacheSong(track) {
  const baseUrl = getDownloaderApiUrl();
  if (!baseUrl) throw new Error('URL API downloader manquante (Config)');

  const payload = {};
  if (track.cachePath) {
    payload.cachePath = track.cachePath;
  } else {
    payload.trackName = track.name;
    if (track.artist) payload.artistName = track.artist;
  }

  const res = await fetch(`${baseUrl}/api/cache/files`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${body}`.trim());
  }
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
    await persistAudioBlob(getTrackCacheKey(item), blob);
    return {
      url: URL.createObjectURL(blob),
      loudnessDb: Number.isFinite(item.loudnessDb) ? item.loudnessDb : null,
      sourceMeta: 'audio-stream',
    };
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
  await persistAudioBlob(getTrackCacheKey(item), mediaBlob);

  const loudnessDb = extractTrackLoudnessDb(data);
  return {
    url: URL.createObjectURL(mediaBlob),
    loudnessDb: Number.isFinite(loudnessDb) ? loudnessDb : (Number.isFinite(item.loudnessDb) ? item.loudnessDb : null),
    sourceMeta: data?.source || data?.provider || data?.cachePath || '',
  };
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
  updateUpcomingArtwork();
  updateDeckCueUI();

  if (!queue.length) {
    queueList.innerHTML = '';
    queueList.appendChild(emptyQueue);
    emptyQueue.style.display = '';
    nextBtn.disabled = true;
    prevBtn.disabled = true;
    return;
  }

  emptyQueue.style.display = 'none';
  nextBtn.disabled = queue.length <= 1;
  prevBtn.disabled = currentIndex <= 0;

  queueList.innerHTML = queue.map((item, i) => {
    const isCurrent = item.id === currentTrackId;
    const cls = isCurrent ? 'queue-item is-current' : 'queue-item';
    const showPlayingBars = isCurrent && isPlaying;

    const numHtml = showPlayingBars
      ? '<div class="queue-num"><div class="playing-bars" aria-label="En cours"><span></span><span></span><span></span></div></div>'
      : `<div class="queue-num">${i + 1}</div>`;
    const cueBtnClass = i === deckBCueIndex ? 'queue-cue is-selected' : 'queue-cue';
    const cueBtnLabel = i === deckBCueIndex ? 'Cue ✓' : 'Cue P2';

    return `
      <div class="${cls}" data-index="${i}" role="button" tabindex="0" draggable="true">
        ${numHtml}
        <img class="queue-art" src="${escHtml(item.artUrl)}" alt="" loading="lazy">
        <div class="queue-info">
          <div class="queue-name">${escHtml(item.name)}</div>
          <div class="queue-artist">${escHtml(item.artist)} ${renderSourceBadge(item)}</div>
        </div>
        <span class="queue-duration">${formatTime(item.duration)}</span>
        <div class="queue-actions">
          <button class="${cueBtnClass}" data-index="${i}" aria-label="Cue platine 2">${cueBtnLabel}</button>
          <button class="queue-remove" data-index="${i}" aria-label="Retirer">✕</button>
        </div>
      </div>`;
  }).join('');

  queueList.querySelectorAll('.queue-item').forEach((el) => {
    el.addEventListener('dragstart', (event) => {
      draggedQueueIndex = Number(el.dataset.index);
      el.classList.add('is-dragging');
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(draggedQueueIndex));
      }
    });

    el.addEventListener('dragend', () => {
      draggedQueueIndex = -1;
      clearQueueDragMarkers();
      queueList.querySelectorAll('.queue-item').forEach((node) => node.classList.remove('is-dragging'));
      requestAnimationFrame(() => {
        suppressQueueItemClick = false;
      });
    });

    el.addEventListener('dragover', (event) => {
      if (draggedQueueIndex < 0) return;
      event.preventDefault();
      const targetIndex = Number(el.dataset.index);
      if (targetIndex === draggedQueueIndex) return;

      const rect = el.getBoundingClientRect();
      const insertAfter = event.clientY >= rect.top + (rect.height / 2);
      clearQueueDragMarkers();
      el.classList.add(insertAfter ? 'is-drag-over-after' : 'is-drag-over-before');
    });

    el.addEventListener('dragleave', (event) => {
      if (!el.contains(event.relatedTarget)) {
        el.classList.remove('is-drag-over-before', 'is-drag-over-after');
      }
    });

    el.addEventListener('drop', (event) => {
      if (draggedQueueIndex < 0) return;
      event.preventDefault();
      const targetIndex = Number(el.dataset.index);
      const rect = el.getBoundingClientRect();
      const insertAfter = event.clientY >= rect.top + (rect.height / 2);
      reorderQueue(draggedQueueIndex, targetIndex, insertAfter);
      suppressQueueItemClick = true;
    });

    el.addEventListener('click', async (e) => {
      if (e.target.classList.contains('queue-remove') || e.target.classList.contains('queue-cue')) return;
      if (suppressQueueItemClick) {
        suppressQueueItemClick = false;
        return;
      }
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

  queueList.querySelectorAll('.queue-cue').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.index);
      if (idx < 0 || idx >= queue.length) return;
      deckBCueIndex = idx;
      updateDeckCueUI();
      showToast(`Cue P2: ${queue[idx].name}`);
      renderQueue();
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
  if (deckBCueIndex === idx) deckBCueIndex = -1;
  else if (deckBCueIndex > idx) deckBCueIndex -= 1;
  updateDeckCueUI();
  updateCurrentIndex();
  renderQueue();
}

function clearQueueDragMarkers() {
  queueList.querySelectorAll('.queue-item').forEach((el) => {
    el.classList.remove('is-dragging', 'is-drag-over-before', 'is-drag-over-after');
  });
}

function reorderQueue(fromIndex, targetIndex, insertAfter = false) {
  if (fromIndex === targetIndex) return;
  if (fromIndex < 0 || targetIndex < 0) return;
  if (fromIndex >= queue.length || targetIndex >= queue.length) return;

  const [moved] = queue.splice(fromIndex, 1);
  let insertIndex = targetIndex;
  if (insertAfter) insertIndex += 1;
  if (fromIndex < insertIndex) insertIndex -= 1;
  insertIndex = Math.max(0, Math.min(queue.length, insertIndex));

  queue.splice(insertIndex, 0, moved);
  if (deckBCueIndex === fromIndex) {
    deckBCueIndex = insertIndex;
  } else {
    if (fromIndex < deckBCueIndex && insertIndex >= deckBCueIndex) deckBCueIndex -= 1;
    if (fromIndex > deckBCueIndex && insertIndex <= deckBCueIndex) deckBCueIndex += 1;
  }
  updateDeckCueUI();
  updateCurrentIndex();
  clearQueueDragMarkers();
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
  
  const baseUrl = getDownloaderApiUrl();
  if (!baseUrl) {
    playlistListEl.innerHTML = `
      <div class="search-empty">
        URL API manquante. Configurez l'API dans l'onglet Configuration.
      </div>`;
    return;
  }

  playlistListEl.innerHTML = '<div class="search-loading">Chargement du cache...</div>';

  try {
    const res = await fetch(`${baseUrl}/api/cache/files`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Erreur ${res.status}: ${res.statusText}`);
    
    const data = await res.json();
    const files = Array.isArray(data) ? data : (data.results || data.files || []);
    
    if (!files.length) {
      playlistListEl.innerHTML = `
        <div class="search-empty">
          Aucun fichier en cache. Recherchez des chansons pour les ajouter.
        </div>`;
      return;
    }

    playlistListEl.innerHTML = files.map((file, i) => `
      <div class="cache-item" data-index="${i}">
        <div class="cache-info">
          <div class="cache-name">${escHtml(file.trackName || file.name || file.title || 'Inconnu')}</div>
          <div class="cache-artist">${escHtml(file.artistName || file.artist || 'Artiste inconnu')}</div>
        </div>
        <button class="cache-add-btn" data-index="${i}" aria-label="Ajouter à la file">➕</button>
      </div>
    `).join('');

    playlistListEl.querySelectorAll('.cache-add-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.index);
        const file = files[idx];
        
        addCacheFileToQueue(file);
      });
    });
  } catch (err) {
    playlistListEl.innerHTML = `
      <div class="search-empty">
        Erreur lors du chargement du cache: ${escHtml(err.message)}
      </div>`;
  }
}

function addCacheFileToQueue(file) {
  if (!file) return;
  
  const item = {
    id: file.id || file.cachePath || file.path || `cache-${Date.now()}`,
    name: file.trackName || file.name || file.title || 'Inconnu',
    artist: file.artistName || file.artist || 'Artiste inconnu',
    artUrl: file.artworkUrl || file.artUrl || '',
    duration: file.duration || 0,
    sourceState: file.cachePath ? 'idle' : 'ready',
    localBlobUrl: file.url || file.localUrl || file.streamUrl || '',
    persistedSourceUrl: file.url || file.localUrl || file.streamUrl || '',
    cachePath: file.cachePath || '',
    ratingKey: file.ratingKey || '',
  };
  
  const isDuplicateCacheFile = queue.some(
    (q) => q.id === item.id || (q.name === item.name && q.artist === item.artist)
  );
  if (isDuplicateCacheFile) {
    showToast(`Déjà dans la file : ${item.name}`, true);
    return;
  }

  queue.push(item);
  
  if (currentIndex < 0 && queue.length === 1) {
    currentIndex = 0;
    pendingAutoplay = true;
    if (player && player.isReady) {
      startPlaybackForIndex(0, 'play').catch(err => showToast(`Erreur: ${err.message}`, true));
    }
  }
  
  renderQueue();
  saveQueue();
  showToast(`"${item.name}" ajouté à la file`);
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
  if (name === 'mix') syncMixOptionsVisibilityOnScroll();
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

  updateUpcomingArtwork();
}

function updateUpcomingArtwork() {
  if (!nextAlbumArt || !nextArtPlaceholder || !nextArtLabel) return;

  let label = 'A suivre';
  let artUrl = '';

  if (launchPreviewActive) {
    label = 'En lancement';
    artUrl = launchPreviewArtUrl;
  } else {
    const next = queue[currentIndex + 1];
    artUrl = next?.artUrl || '';
  }

  if (artUrl) {
    nextAlbumArt.src = artUrl;
    nextAlbumArt.hidden = false;
    nextArtPlaceholder.style.display = 'none';
  } else {
    nextAlbumArt.src = '';
    nextAlbumArt.hidden = true;
    nextArtPlaceholder.style.display = '';
  }

  nextArtLabel.textContent = label;
}

function showCrossfadeRing(on) {
  crossfadeRing.hidden = !on;
}

function updateCrossfadeBars({ fromVolume, toVolume, toPosition, toDuration }) {
  updateDeckMixUI(toVolume);
}

updateCrossfadeControlUI(crossfadeSlider.value);
updateDeckMixUI(deckMixRatio);
updateManualLockUI();
updateDeckCueUI();
updateMixFeaturesUI();
fxControlsHidden = localStorage.getItem(FX_VISIBILITY_KEY) === '1';
updateFxVisibilityUI();

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
  appScreen.classList.remove('active');
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

function doLogout() {
  launchPreviewArtUrl = '';
  pendingAutoplay = false;
  lastSearchQuery = '';
  pendingSearchAdd = false;
  manualMixLock = false;
  deckBCueIndex = -1;
  mixFeatures = {
    autoBpm: false,
    echo: false,
    distortion: false,
  };

  player?.destroy();
  player = null;

  for (const item of queue) releaseLocalBlob(item);
  clearSessionBlobCache();

  if (blobCleanupTimer) {
    clearInterval(blobCleanupTimer);
    blobCleanupTimer = null;
  }

  queue.length = 0;
  currentIndex = -1;
  currentTrackId = null;
  isPlaying = false;
  playlistLoaded = false;
  playbackPositionMs = 0;
  playbackDurationMs = 0;

  localStorage.removeItem(QUEUE_KEY);
  switchTab('mix');
  showCrossfadeRing(false);
  playPauseBtn.disabled = true;
  playIcon.textContent = '▶';
  progressFill.style.width = '0%';
  crossfadeZone.style.width = '0%';
  currentTimeEl.textContent = '0:00';
  totalTimeEl.textContent = '0:00';
  trackName.textContent = 'Aucune chanson';
  trackArtist.textContent = 'Ajoutez des chansons à la file d\'attente';
  albumArt.src = '';
  albumArt.hidden = true;
  artPlaceholder.style.display = '';
  nextAlbumArt.src = '';
  nextAlbumArt.hidden = true;
  nextArtPlaceholder.style.display = '';
  nextArtLabel.textContent = 'A suivre';
  updateManualLockUI();
  updateDeckCueUI();
  updateMixFeaturesUI();
  renderQueue();
  showSetup();
}

function showApp() {
  setupScreen.classList.remove('active');
  setupScreen.hidden = true;
  appScreen.classList.add('active');
  appScreen.hidden = false;
  hideSetupError();
}

function releaseLocalBlob(item) {
  if (!item?.localBlobUrl) return;
  item.localBlobUrl = null;
  touchQueueItem(item);
}

function clearSessionBlobCache() {
  for (const cachedSource of sessionBlobCache.values()) {
    const blobUrl = typeof cachedSource === 'string' ? cachedSource : cachedSource?.url;
    if (blobUrl && String(blobUrl).startsWith('blob:')) {
      URL.revokeObjectURL(blobUrl);
    }
  }
  sessionBlobCache.clear();
}

function getPersistentAudioCacheRequest(cacheKey) {
  const safeKey = encodeURIComponent(String(cacheKey || 'unknown'));
  return new Request(`https://dj-mix.local/cache-audio/${safeKey}`);
}

async function persistAudioBlob(cacheKey, blob) {
  if (!cacheKey || !blob || blob.size <= 0) return;
  if (!('caches' in window)) return;

  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const req = getPersistentAudioCacheRequest(cacheKey);
    const res = new Response(blob, {
      headers: {
        'content-type': blob.type || 'audio/mpeg',
      },
    });
    await cache.put(req, res);
  } catch (_) {
    // persistent cache is best effort only
  }
}

async function restorePersistedAudioBlobUrl(cacheKey) {
  if (!cacheKey) return null;
  if (!('caches' in window)) return null;

  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const req = getPersistentAudioCacheRequest(cacheKey);
    const cached = await cache.match(req);
    if (!cached) return null;
    const blob = await cached.blob();
    if (!blob || blob.size <= 0) return null;
    return URL.createObjectURL(blob);
  } catch (_) {
    return null;
  }
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
        loudnessDb: Number.isFinite(item.loudnessDb) ? item.loudnessDb : null,
        cachePath: item.cachePath || '',
        ratingKey: item.ratingKey || '',
        persistedSourceUrl: item.persistedSourceUrl || '',
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
        sourceMeta: null,
        localBlobUrl: null,
        cachePath: item.cachePath || '',
        loudnessDb: Number.isFinite(Number(item.loudnessDb)) ? Number(item.loudnessDb) : null,
        persistedSourceUrl: item.persistedSourceUrl || '',
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
  if (searchClose) searchClose.hidden = false;
}

function closeSearch() {
  searchOverlay.hidden = true;
  if (searchClose) searchClose.hidden = true;
}

function buildResultHTML(track, kind = 'song', index = 0) {
  const artUrl = getBestArtworkUrl(track);
  const artist = track.artists ? track.artists.map((a) => a.name).join(', ') : (track.artist || 'Artiste inconnu');
  const hasDuration = Number(track.duration_ms) > 0;
  const dur = hasDuration ? formatTime(track.duration_ms) : '--:--';
  const isArtistResult = Boolean(track.isArtistResult);
  const localBadge = track.isLocalResult ? '<span class="result-local-badge" title="Fichier local">📁</span>' : '';
  const durationHtml = isArtistResult ? '<span class="result-duration">Artiste</span>' : `<span class="result-duration">${dur}</span>`;
  const addLabel = isArtistResult ? '🔎' : '+';
  const addAria = isArtistResult ? 'Rechercher cet artiste' : 'Ajouter';
  const deleteBtn = (!isArtistResult && track.isLocalResult)
    ? `<button class="delete-btn" aria-label="Supprimer" data-track-name="${escHtml(track.name)}" data-artist-name="${escHtml(artist)}" data-cache-path="${escHtml(track.cachePath || '')}">🗑</button>`
    : '';

  return `
    <div class="search-result-item" data-kind="${kind}" data-index="${index}" role="button" tabindex="0">
      <img class="result-art" src="${escHtml(artUrl)}" alt="" loading="lazy">
      <div class="result-info">
        <div class="result-name">${escHtml(track.name)} ${localBadge}</div>
        <div class="result-artist">${escHtml(artist)}</div>
      </div>
      ${durationHtml}
      ${deleteBtn}
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
  const isLocalResult = isLocalTrackResult(track);

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
      isLocalResult,
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
    loudnessDb: extractTrackLoudnessDb(track),
    isArtistResult: false,
    isLocalResult,
    cachePath: track.cachePath || track.filePath || track.path || '',
    popularityScore: getPopularityScore(track),
    artists: [{ name: artist }],
    album: { images: artUrl ? [{ url: artUrl }, { url: artUrl }] : [] },
    downloadUrl: track.downloadUrl || track.streamUrl || track.url || '',
  };
}

function sortSearchResultsByPopularity(a, b) {
  // Put local results first, then songs before artists, then popularity.
  if (a.isLocalResult !== b.isLocalResult) {
    return a.isLocalResult ? -1 : 1;
  }

  // Then put songs before artists.
  if (a.isArtistResult !== b.isArtistResult) {
    return a.isArtistResult ? 1 : -1;
  }

  const scoreA = Number.isFinite(a.popularityScore) ? a.popularityScore : 0;
  const scoreB = Number.isFinite(b.popularityScore) ? b.popularityScore : 0;
  if (scoreA !== scoreB) return scoreB - scoreA;

  // Keep API order when popularity is equal or missing.
  return 0;
}

function isLocalTrackResult(track) {
  if (!track || typeof track !== 'object') return false;

  // Primary API contract: cached results must be flagged with cached=true.
  if (track.cached === true || track.isCached === true) return true;

  const candidates = [
    track.isLocal,
    track.local,
    track.sourceType,
    track.source,
    track.location,
    track.storage,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'boolean') {
      if (candidate) return true;
      continue;
    }

    const text = String(candidate || '').trim().toLowerCase();
    if (!text) continue;
    if (text === 'local' || text === 'cached' || text === 'cache' || text === 'disk' || text === 'file' || text === 'true') {
      return true;
    }
  }

  return false;
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

function extractTrackLoudnessDb(track) {
  if (!track || typeof track !== 'object') return null;

  const candidates = [
    track.loudnessDb,
    track.loudness_db,
    track.loudness,
    track.decibels,
    track.decibel,
    track.db,
    track.volumeDb,
    track.volume_db,
    track.replayGainDb,
    track.replaygain,
    track.audio?.loudnessDb,
    track.audio?.loudness,
    track.metadata?.loudnessDb,
    track.metadata?.loudness,
    track.metadata?.decibels,
    track.meta?.loudnessDb,
    track.meta?.loudness,
    track.stats?.loudness,
    track.analysis?.loudness,
  ];

  for (const candidate of candidates) {
    const db = parseDecibelValue(candidate);
    if (Number.isFinite(db)) return db;
  }

  return null;
}

function parseDecibelValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;

  const match = value.trim().match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return null;

  const normalized = match[0].replace(',', '.');
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function getTrackCacheKey(track) {
  if (!track) return '';
  return String(track.uri || track.id || `${track.artist || ''}::${track.name || track.title || ''}`);
}

function getDirectPlayableSourceUrl(track) {
  if (!track) return '';

  const candidates = [
    track.persistedSourceUrl,
    track.localBlobUrl,
    track.downloadUrl,
    track.streamUrl,
    track.fileUrl,
    track.audioUrl,
    track.url,
    track.uri,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const value = candidate.trim();
    if (!value) continue;
    if (value.startsWith('blob:')) return value;
    if (/^https?:\/\//i.test(value) && isTrustedLocalAudioUrl(value)) return value;
  }

  return '';
}

function isTrustedLocalAudioUrl(url) {
  if (!url || typeof url !== 'string') return false;

  try {
    const parsed = new URL(url, window.location.href);
    const sameOrigin = parsed.origin === window.location.origin;
    const downloaderApi = getDownloaderApiUrl();
    const apiOrigin = downloaderApi ? new URL(downloaderApi, window.location.href).origin : '';
    const fromConfiguredApi = apiOrigin && parsed.origin === apiOrigin;
    const hasCachePath = /\/api\/cache\//i.test(parsed.pathname) || /\/cache\//i.test(parsed.pathname);

    return sameOrigin || (fromConfiguredApi && hasCachePath);
  } catch (_) {
    return false;
  }
}

function canLoadAudioSource(sourceUrl) {
  return new Promise((resolve) => {
    if (!sourceUrl) {
      resolve(false);
      return;
    }

    const audio = new Audio();
    audio.preload = 'metadata';

    let settled = false;
    const cleanup = () => {
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('error', onError);
      clearTimeout(timeoutId);
      audio.src = '';
    };

    const finish = (ok) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(ok);
    };

    const onCanPlay = () => finish(true);
    const onError = () => finish(false);
    const timeoutId = setTimeout(() => finish(false), 6000);

    audio.addEventListener('canplay', onCanPlay, { once: true });
    audio.addEventListener('error', onError, { once: true });
    audio.src = sourceUrl;
    audio.load();
  });
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
 * @property {number|null} loudnessDb
 * @property {'idle'|'resolving'|'ready'|'error'} sourceState
 * @property {string|null} sourceError
 * @property {string|null} sourceMeta
 * @property {string|null} localBlobUrl
 * @property {string} persistedSourceUrl
 * @property {number} lastTouchedAt
 */
