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
const DEFAULT_DOWNLOADER_API_URL = 'http://192.168.8.149:3000';
const AUDIO_CACHE_NAME = 'dj-mix:audio-cache:v1';

// Request persistent storage on load
if ('storage' in navigator && 'persist' in navigator.storage) {
  navigator.storage.persist().catch(() => {});
}

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
let launchPreviewTitle = '';
let launchPreviewArtist = '';
let launchPreviewDeck = null;
let draggedQueueIndex = -1;
let suppressQueueItemClick = false;
let toastTimer = null;
let deckMixRatio = 0;
let manualMixLock = false;
let deckBCueIndex = -1;
let deckCueDeck = null;
let mixFeatures = {
  autoBpm: false,
  echo: false,
  distortion: false,
};
let fxControlsHidden = false;
const deckDisplayItems = { A: null, B: null };
let prevIsCrossfading = false;

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
const trackArtistA = document.getElementById('track-artist-a');
const trackArtist = document.getElementById('track-artist');
const clearCacheBtn = document.getElementById('clear-cache-btn');
const deckAPanel = document.getElementById('deck-a-panel');
const deckBPanel = document.getElementById('deck-b-panel');
const deckAVol = document.getElementById('deck-a-vol');
const deckBVol = document.getElementById('deck-b-vol');
const deckASlider = document.getElementById('deck-a-slider');
const deckBSlider = document.getElementById('deck-b-slider');
const deckAFill = document.getElementById('deck-a-fill');
const deckBFill = document.getElementById('deck-b-fill');
const deckBTrackName = document.getElementById('deck-b-track-name');
const trackArtistB = document.getElementById('track-artist-b');
const deckABpm = document.getElementById('deck-a-bpm');
const deckBBpm = document.getElementById('deck-b-bpm');
const deckABpmReset = document.getElementById('deck-a-bpm-reset');
const deckBBpmReset = document.getElementById('deck-b-bpm-reset');
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
const autoMixBtn = document.getElementById('automix-btn');
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



document.getElementById('toggle-mix-menu-btn')?.addEventListener('click', () => {
  if (!tabPanels.mix || !deckMixControl) return;
  const isCollapsed = tabPanels.mix.classList.toggle('mix-options-collapsed');
  deckMixControl.setAttribute('aria-hidden', String(isCollapsed));
});

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
  setupMediaSession();
  restoreQueue();
  if (queue.length) {
    renderQueue();
    if (currentIndex >= 0 && queue[currentIndex]) {
      deckDisplayItems.A = queue[currentIndex];
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
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
    renderQueue();
  });

  player.addEventListener('progress', ({ detail }) => {
    const { position, duration } = detail;
    if (!duration) return;

    playbackPositionMs = position;
    playbackDurationMs = duration;
  });

  player.addEventListener('crossfadeready', () => {
    autoFadeManager.handleReady().catch(() => {
      // handled internally by manager callbacks
    });
  });

  player.addEventListener('trackend', () => {
    isPlaying = false;
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

autoMixBtn?.addEventListener('click', async () => {
  if (!player || player.isCrossfading) return;
  const inactiveDeck = deckCueDeck || getInactiveDeck();
  const preparedItem = deckDisplayItems[inactiveDeck];
  const preparedIndex = preparedItem ? queue.findIndex((item) => item.id === preparedItem.id) : -1;
  const nextIndex = preparedIndex >= 0
    ? preparedIndex
    : (currentIndex + 1 < queue.length ? currentIndex + 1 : (queue.length > 1 ? 0 : -1));
  if (nextIndex < 0) return;

  showCrossfadeRing(true);
  showToast('AutoMix en cours...');

  try {
    await startPlaybackForIndex(nextIndex, 'crossfade', { targetDeck: inactiveDeck });
    renderQueue();
  } catch (err) {
    showToast(`API: ${err.message}`, true);
  } finally {
    showCrossfadeRing(false);
  }
});

function setupMediaSession() {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.setActionHandler('play', () => {
    const focusDeck = getFocusDeck();
    if (focusDeck === 'A') deckALaunchBtn?.click();
    else deckBLaunchBtn?.click();
  });
  navigator.mediaSession.setActionHandler('pause', () => {
    const focusDeck = getFocusDeck();
    if (focusDeck === 'A') deckALaunchBtn?.click();
    else deckBLaunchBtn?.click();
  });
  navigator.mediaSession.setActionHandler('previoustrack', null);
  navigator.mediaSession.setActionHandler('nexttrack', () => autoMixBtn?.click());
}

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
  if (deckMixSlider) {
    deckMixSlider.value = String(deckB);
  }
  if (deckMixLabel) deckMixLabel.textContent = `Platine 1 ${deckA}% / Platine 2 ${deckB}%`;
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
  const inactiveDeck = deckCueDeck || getInactiveDeck();
  const inactivePanel = inactiveDeck === 'A' ? deckAPanel : deckBPanel;
  const otherPanel = inactiveDeck === 'A' ? deckBPanel : deckAPanel;
  if (!inactivePanel) return;
  const hasCue = deckBCueIndex >= 0 && !!queue[deckBCueIndex];
  inactivePanel.classList.toggle('has-cue', hasCue);
  otherPanel?.classList.remove('has-cue');
}

function applyDeckMixRatio(ratio, transitionMs = 140) {
  const prevFocus = getFocusDeck();
  deckMixRatio = clampDeckMixRatio(ratio);
  updateDeckMixUI(deckMixRatio);
  if (player) player.setDeckMixRatio(deckMixRatio, transitionMs);
  const nextFocus = getFocusDeck();
  updateDeckCueUI();
  if (prevFocus !== nextFocus && queue.length) {
    renderQueue();
  }
}

clearCacheBtn?.addEventListener('click', async () => {
  if (!('caches' in window)) {
    showToast('Cache API non disponible', true);
    return;
  }
  
  try {
    const cacheNames = await caches.keys();
    const audioCaches = cacheNames.filter(name => name === AUDIO_CACHE_NAME);
    
    for (const cacheName of audioCaches) {
      await caches.delete(cacheName);
    }
    
    sessionBlobCache.clear();
    showToast('Cache local vidé');
  } catch (err) {
    showToast(`Erreur suppression cache: ${err.message}`, true);
  }
});

function getFocusDeck() {
  // Focused platter only when mix is strictly above 50%.
  return deckMixRatio > 0.5 ? 'B' : 'A';
}

function getInactiveDeck() {
  return getFocusDeck() === 'A' ? 'B' : 'A';
}

function deckToPlatineLabel(deck) {
  return deck === 'A' ? '1' : '2';
}

function renderDeckState(detail) {
  if (!detail) return;

  const volA = detail.deckA?.volume || 0;
  const volB = detail.deckB?.volume || 0;
  const hasAudio = volA + volB > 0;
  const focusedDeck = hasAudio ? (volB > volA ? 'B' : 'A') : getFocusDeck();

  // Clear the outgoing deck when crossfade ends (outgoing = previous focus, now inactive)
  if (prevIsCrossfading && !detail.isCrossfading) {
    const clearedDeck = focusedDeck === 'A' ? 'B' : 'A';
    deckDisplayItems[clearedDeck] = null;
  }
  prevIsCrossfading = detail.isCrossfading;

  if (deckAPanel) {
    deckAPanel.classList.toggle('is-playing', Boolean(detail.deckA?.playing));
    deckAPanel.classList.toggle('is-active', focusedDeck === 'A');
  }
  if (deckBPanel) {
    deckBPanel.classList.toggle('is-playing', Boolean(detail.deckB?.playing));
    deckBPanel.classList.toggle('is-active', focusedDeck === 'B');
  }

  // Dominant = deck with >= 50% of total volume
  const bIsDominant = hasAudio && volB > volA;
  if (deckAPanel) deckAPanel.classList.toggle('is-dominant', hasAudio && !bIsDominant);
  if (deckBPanel) deckBPanel.classList.toggle('is-dominant', bIsDominant);

  // Per-deck track names
  if (trackName) trackName.textContent = deckDisplayItems.A?.name || '';
  if (deckBTrackName) deckBTrackName.textContent = deckDisplayItems.B?.name || '';

  if (!detail.isCrossfading) {
    const totalVolume = (detail.deckA?.volume || 0) + (detail.deckB?.volume || 0);
    if (totalVolume > 0) {
      const ratioB = (detail.deckB?.volume || 0) / totalVolume;
      deckMixRatio = clampDeckMixRatio(ratioB);
      updateDeckMixUI(deckMixRatio);
      updateDeckCueUI();
    }
  }

  if (deckAVol) deckAVol.textContent = `${Math.round((detail.deckA?.volume || 0) * 100)}%`;
  if (deckBVol) deckBVol.textContent = `${Math.round((detail.deckB?.volume || 0) * 100)}%`;

  // BPM display
  const rateA = detail.deckA?.playbackRate ?? 1;
  const rateB = detail.deckB?.playbackRate ?? 1;
  if (deckABpm) deckABpm.textContent = Math.abs(rateA - 1) > 0.005 ? `×${rateA.toFixed(2)}` : '';
  if (deckBBpm) deckBBpm.textContent = Math.abs(rateB - 1) > 0.005 ? `×${rateB.toFixed(2)}` : '';
  if (deckABpmReset) deckABpmReset.hidden = Math.abs(rateA - 1) <= 0.005;
  if (deckBBpmReset) deckBBpmReset.hidden = Math.abs(rateB - 1) <= 0.005;

  // Overlay button icons
  if (deckALaunchBtn) deckALaunchBtn.textContent = detail.deckA?.playing ? '⏸' : '▶';
  if (deckBLaunchBtn) deckBLaunchBtn.textContent = detail.deckB?.playing ? '⏸' : '▶';

  // Cache last state for click handlers
  if (player) player._lastDeckState = detail;

  if (deckAFill) {
    const pctA = detail.deckA?.durationMs > 0 ? (detail.deckA.positionMs / detail.deckA.durationMs) * 100 : 0;
    deckAFill.style.width = `${Math.min(100, pctA)}%`;
  }
  if (deckBFill) {
    const pctB = detail.deckB?.durationMs > 0 ? (detail.deckB.positionMs / detail.deckB.durationMs) * 100 : 0;
    deckBFill.style.width = `${Math.min(100, pctB)}%`;
  }
}

async function launchDeckFromQueue(deck, options = {}) {
  if (!player || !queue.length) {
    showToast('Ajoutez une chanson dans la file', true);
    return;
  }

  const fallbackIndex = currentIndex >= 0 && queue[currentIndex] ? currentIndex : 0;
  const inactiveDeck = getInactiveDeck();
  const deckItemIndex = deckDisplayItems[deck]
    ? queue.findIndex((q) => q.id === deckDisplayItems[deck]?.id)
    : -1;

  let targetIndex = fallbackIndex;
  if (options.useCue === true && deckBCueIndex >= 0 && queue[deckBCueIndex]) {
    targetIndex = deckBCueIndex;
  } else if (deckItemIndex >= 0) {
    targetIndex = deckItemIndex;
  } else if (deck === inactiveDeck) {
    targetIndex = fallbackIndex + 1 < queue.length ? fallbackIndex + 1 : fallbackIndex;
  }

  const item = queue[targetIndex];
  if (!item) return;

  try {
    const sourceUrl = await ensureLocalSource(item);
    const isFocusDeck = deck === getFocusDeck();
    const paused = typeof options.paused === 'boolean' ? options.paused : !isFocusDeck;
    await player.playOnDeck(deck, { url: sourceUrl, loudnessDb: item.loudnessDb }, { makeActive: false, paused });
    deckDisplayItems[deck] = item;

    if (isFocusDeck) {
      currentIndex = targetIndex;
      currentTrackId = item.id;
      updateNowPlaying(item, deck);
      isPlaying = true;
      launchPreviewTitle = '';
      launchPreviewArtist = '';
      launchPreviewDeck = null;
      prefetchNext(targetIndex + 1);
      renderQueue();
    } else {
      launchPreviewActive = true;
      launchPreviewArtUrl = item.artUrl || '';
      launchPreviewTitle = item.name || '';
      launchPreviewArtist = item.artist || '';
      launchPreviewDeck = deck;
      deckCueDeck = deck;
      updateUpcomingArtwork();
      if (deck === 'B' && deckBTrackName) deckBTrackName.textContent = item.name;
      if (deck === 'A' && trackName) trackName.textContent = item.name;
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
  const sliderValue = (Number(deckMixSlider.value) || 0) / 100;
  applyDeckMixRatio(sliderValue, 120);
});

deckALaunchBtn?.addEventListener('click', async () => {
  if (!player) return;
  const lastDetail = player._lastDeckState;
  if (lastDetail?.deckA?.playing) {
    player.pauseDeck('A');
  } else if (lastDetail?.deckA?.hasSrc) {
    await player.resumeDeck('A').catch((err) => showToast(`Erreur: ${err.message}`, true));
  } else {
    await launchDeckFromQueue('A', { paused: false }).catch((err) => showToast(`Erreur: ${err.message}`, true));
  }
});

deckBLaunchBtn?.addEventListener('click', async () => {
  if (!player) return;
  const lastDetail = player._lastDeckState;
  if (lastDetail?.deckB?.playing) {
    player.pauseDeck('B');
  } else if (lastDetail?.deckB?.hasSrc) {
    await player.resumeDeck('B').catch((err) => showToast(`Erreur: ${err.message}`, true));
  } else {
    await launchDeckFromQueue('B', { paused: false }).catch((err) => showToast(`Erreur: ${err.message}`, true));
  }
});

deckABpmReset?.addEventListener('click', () => { player?.resetDeckPlaybackRate('A'); });
deckBBpmReset?.addEventListener('click', () => { player?.resetDeckPlaybackRate('B'); });

deckSyncBtn?.addEventListener('click', () => {
  if (!player) return;
  player.syncDecksToActive();
  showToast('BPM synchronisés');
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
    bpm: track.bpm || track.tempo || null,
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

async function startPlaybackForIndex(index, mode, options = {}) {
  const item = queue[index];
  if (!item || !player) return;

  const targetDeck = options.targetDeck || ((mode === 'play' || mode === 'switch')
    ? getFocusDeck()
    : getInactiveDeck());

  if (mode === 'crossfade' && currentTrackId && item.id !== currentTrackId) {
    launchPreviewActive = true;
    launchPreviewArtUrl = item.artUrl || '';
    launchPreviewTitle = item.name || '';
    launchPreviewArtist = item.artist || '';
    launchPreviewDeck = targetDeck;
  } else {
    launchPreviewActive = false;
    launchPreviewArtUrl = '';
    launchPreviewTitle = '';
    launchPreviewArtist = '';
    launchPreviewDeck = null;
  }
  updateUpcomingArtwork();

  try {
    touchQueueItem(item);
    deckDisplayItems[targetDeck] = item;
    if (mode === 'play') deckDisplayItems[targetDeck === 'A' ? 'B' : 'A'] = null;
    updateNowPlaying(item, targetDeck);
    const sourceUrl = await ensureLocalSource(item);

    if (mode === 'autofade') {
      await player.crossfadeToDeck(targetDeck, { url: sourceUrl, loudnessDb: item.loudnessDb });
    } else if (mode === 'crossfade') {
      await player.crossfadeToDeck(targetDeck, { url: sourceUrl, loudnessDb: item.loudnessDb });
    } else if (mode === 'switch') {
      await player.playOnDeck(getFocusDeck(), { url: sourceUrl, loudnessDb: item.loudnessDb }, { makeActive: false, paused: false });
    } else {
      await player.playOnDeck(getFocusDeck(), { url: sourceUrl, loudnessDb: item.loudnessDb }, { makeActive: false, paused: false });
    }

    if (mode === 'autofade' || mode === 'crossfade') {
      currentIndex = index;
      currentTrackId = item.id;
    } else {
      currentIndex = index;
      currentTrackId = item.id;
    }

    // Sync deckMixRatio to the actual post-fade state so volumes stay consistent
    if ((mode === 'autofade' || mode === 'crossfade') && player) {
      const newRatio = targetDeck === 'B' ? 1 : 0;
      applyDeckMixRatio(newRatio, 0);
    }

    // After a crossfade: load next track into the now-inactive deck (paused, ready for next fade)
    if ((mode === 'autofade' || mode === 'crossfade') && player) {
      const inactiveDeck = getInactiveDeck();
      const nextItem = queue[index + 1];
      if (nextItem) {
        ensureLocalSource(nextItem).then((nextUrl) => {
          if (!player) return;
          player.playOnDeck(inactiveDeck, { url: nextUrl, loudnessDb: nextItem.loudnessDb }, { paused: true });
          deckDisplayItems[inactiveDeck] = nextItem;
          renderQueue();
        }).catch(() => {});
      }
    }

    isPlaying = true;
    prefetchNext(index + 1);
    launchPreviewActive = false;
    launchPreviewArtUrl = '';
    launchPreviewTitle = '';
    launchPreviewArtist = '';
    launchPreviewDeck = null;
    renderQueue();
  } catch (err) {
    item.sourceState = 'error';
    item.sourceError = err.message;
    launchPreviewActive = false;
    launchPreviewArtUrl = '';
    launchPreviewTitle = '';
    launchPreviewArtist = '';
    launchPreviewDeck = null;
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
    if (autoMixBtn) autoMixBtn.disabled = true;
    return;
  }

  emptyQueue.style.display = 'none';
  if (autoMixBtn) autoMixBtn.disabled = queue.length <= 1;

  queueList.innerHTML = queue.map((item, i) => {
    const isCurrent = item.id === currentTrackId;
    const cls = isCurrent ? 'queue-item is-current' : 'queue-item';
    const showPlayingBars = isCurrent && isPlaying;

    const numHtml = showPlayingBars
      ? '<div class="queue-num"><div class="playing-bars" aria-label="En cours"><span></span><span></span><span></span></div></div>'
      : `<div class="queue-num">${i + 1}</div>`;
    const cueBtnClass = i === deckBCueIndex ? 'queue-cue is-selected' : 'queue-cue';
    const inactiveDeck = getInactiveDeck();
    const cueBtnLabel = i === deckBCueIndex ? 'Cue ✓' : `Cue Platine ${inactiveDeck === 'A' ? '1' : '2'}`;
    const bpmDisplay = item.bpm ? ` • ${Math.round(item.bpm)} BPM` : '';

    return `
      <div class="${cls}" data-index="${i}" role="button" tabindex="0" draggable="true">
        ${numHtml}
        <img class="queue-art" src="${escHtml(item.artUrl)}" alt="" loading="lazy">
        <div class="queue-info">
          <div class="queue-name">${escHtml(item.name)}</div>
          <div class="queue-artist">${escHtml(item.artist)} ${renderSourceBadge(item)}${bpmDisplay}</div>
        </div>
        <span class="queue-duration">${formatTime(item.duration)}</span>
        <div class="queue-actions">
          <button class="${cueBtnClass}" data-index="${i}" aria-label="Cue platine inactive">${cueBtnLabel}</button>
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
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.index);
      if (idx < 0 || idx >= queue.length) return;
      deckBCueIndex = idx;
        deckCueDeck = getInactiveDeck();
      updateDeckCueUI();
        const inactiveDeck = deckCueDeck;
      showToast(`Cue Platine ${deckToPlatineLabel(inactiveDeck)}: ${queue[idx].name}`);
      renderQueue();
      // Load the cued song on the inactive deck
      await launchDeckFromQueue(inactiveDeck, { paused: true, useCue: true });
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
  if (deckCueDeck && deckDisplayItems[deckCueDeck]?.id === item?.id) deckCueDeck = null;
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
      const baseUrl = getDownloaderApiUrl();
      if (!baseUrl) throw new Error('URL API manquante');
      const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDownloaderApiStatus('Serveur disponible ✓', false);
    } catch (err) {
      setDownloaderApiStatus(`Serveur indisponible: ${err.message}`, true);
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

function updateNowPlaying(item, deck = getFocusDeck()) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: item.name || 'DJ Mix',
      artist: item.artist || '',
      artwork: item.artUrl ? [{ src: item.artUrl, sizes: '512x512', type: 'image/jpeg' }] : [],
    });
  }

  // Route art to the target platter only (avoid swapping artwork between platters)
  const focusArt = deck === 'A' ? albumArt : nextAlbumArt;
  const focusPlaceholder = deck === 'A' ? artPlaceholder : nextArtPlaceholder;

  if (item.artUrl) {
    focusArt.src = item.artUrl;
    focusArt.hidden = false;
    focusPlaceholder.style.display = 'none';
  } else {
    focusArt.src = '';
    focusArt.hidden = true;
    focusPlaceholder.style.display = '';
  }

  if (deck === 'A') {
    if (trackName) trackName.textContent = item.name || '';
    if (trackArtistA) trackArtistA.textContent = item.artist || '';
  } else {
    if (deckBTrackName) deckBTrackName.textContent = item.name || '';
    if (trackArtistB) trackArtistB.textContent = item.artist || '';
  }

  if (trackArtist) trackArtist.textContent = item.artist;

  updateUpcomingArtwork();
}

function updateUpcomingArtwork() {
  // Route upcoming/launch preview to a stable target platter.
  const targetDeck = launchPreviewActive && (launchPreviewDeck === 'A' || launchPreviewDeck === 'B')
    ? launchPreviewDeck
    : getInactiveDeck();
  const inactiveArt = targetDeck === 'A' ? albumArt : nextAlbumArt;
  const inactivePlaceholder = targetDeck === 'A' ? artPlaceholder : nextArtPlaceholder;
  const inactiveLabel = targetDeck === 'A' ? null : nextArtLabel; // label only exists on platter 2 panel

  let label = '';
  let artUrl = '';
  let artist = '';

  if (launchPreviewActive) {
    label = launchPreviewTitle || '';
    artUrl = launchPreviewArtUrl;
    artist = launchPreviewArtist || '';
  } else {
    const next = queue[currentIndex + 1];
    label = next?.name || '';
    artUrl = next?.artUrl || '';
    artist = next?.artist || '';
  }

  if (artUrl) {
    inactiveArt.src = artUrl;
    inactiveArt.hidden = false;
    inactivePlaceholder.style.display = 'none';
  } else {
    inactiveArt.src = '';
    inactiveArt.hidden = true;
    inactivePlaceholder.style.display = '';
  }

  if (inactiveLabel) inactiveLabel.textContent = label;
  if (targetDeck === 'A') {
    if (trackName) trackName.textContent = label;
    if (trackArtistA) trackArtistA.textContent = artist;
  } else {
    if (deckBTrackName) deckBTrackName.textContent = label;
    if (trackArtistB) trackArtistB.textContent = artist;
  }
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
  deckDisplayItems.A = null;
  deckDisplayItems.B = null;
  prevIsCrossfading = false;
  deckCueDeck = null;
  switchTab('mix');
  showCrossfadeRing(false);
  if (trackName) trackName.textContent = 'Aucune chanson';
  if (deckBTrackName) deckBTrackName.textContent = '';
  trackArtist.textContent = 'Ajoutez des chansons à la file d\'attente';
  albumArt.src = '';
  albumArt.hidden = true;
  artPlaceholder.style.display = '';
  nextAlbumArt.src = '';
  nextAlbumArt.hidden = true;
  nextArtPlaceholder.style.display = '';
  nextArtLabel.textContent = '';
  if (trackArtistA) trackArtistA.textContent = '';
  if (trackArtistB) trackArtistB.textContent = '';
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
