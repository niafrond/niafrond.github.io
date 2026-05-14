/**
 * main.js - DJ Mix app orchestrator.
 * Search: downloader API
 * Playback: temporary local Blob download + dual-deck crossfade
 */

import { DJPlayer } from './player.js';
import {
  MIX_TRANSITION_MODE_LABELS,
  MIX_TRANSITION_MODES,
} from './lib/mixFeatures.js';
import { AutoFadeManager } from './lib/autoFadeManager.js';
import {
  createAudioSourceManager,
  getDirectPlayableSourceUrl,
} from './lib/audioSourceManager.js';
import { createDownloaderConfigManager } from './lib/downloaderConfig.js';
import {
  createLogger,
  setDebugLoggingEnabled,
} from './lib/logger.js';
import { createMixControls } from './lib/mixControls.js';
import { createPlaylistManager } from './lib/playlistManager.js';
import { restoreQueueFromStorage, saveQueueToStorage } from './lib/queueStorage.js';
import { createShellUi } from './lib/shellUi.js';
import { createDjMixRenderer } from './lib/uiRenderer.js';
import { createAutoModeManager } from './lib/autoModeManager.js';
import {
  buildSearchResultsSectionsHTML,
  escHtml,
  extractAudioFeatures,
  extractStemSourceUrls,
  extractTrackLoudnessDb,
  getBestArtworkUrl,
  getTrackDurationMs,
  mapApiTrackToSearchItem,
  normalizeApiSearchResponse,
  sortSearchResultsByPopularity,
} from './lib/searchUtils.js';

const QUEUE_KEY = 'dj-mix:queue';
const DOWNLOADER_API_URL_KEY = 'dj-mix:downloader:api:url';
const FX_VISIBILITY_KEY = 'dj-mix:fx:hidden';
const DEBUG_LOGS_KEY = 'dj-mix:logs:debug';
const MIX_TRANSITION_MODE_KEY = 'dj-mix:transition:mode';
const DEFAULT_DOWNLOADER_API_URL = 'http://192.168.8.149:3000';
const AUDIO_CACHE_NAME = 'dj-mix:audio-cache:v1';

const logger = createLogger('main');
const logDebug = (event, payload) => logger.debug(event, payload);
const logInfo = (event, payload) => logger.info(event, payload);
const logWarn = (event, payload) => logger.warn(event, payload);
const logError = (event, payload) => logger.error(event, payload);

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
let deckMixRatio = 0;
let manualMixLock = false;
let deckBCueIndex = -1;
let deckCueDeck = null;

// Auto DJ timing
let nextAutomixTriggerMs = -1; // When to trigger automix (ms from start)
let automixTriggeredForTrack = false; // Has automix been triggered for current track

/**
 * Track stem loading status per deck: { A: boolean, B: boolean }
 * true = stems loaded/available, false = stems not yet available
 */
let stemsLoadedPerDeck = { A: false, B: false };

let mixFeatures = {
  autoBpm: false,
  echo: false,
  distortion: false,
  deckFx: {
    A: { vocalRemove: false, instruRemove: false },
    B: { vocalRemove: false, instruRemove: false },
  },
};
let fxControlsHidden = false;
const deckDisplayItems = { A: null, B: null };
let prevIsCrossfading = false;
let selectedTransitionMode = readTransitionModeSetting();

function readTransitionModeSetting() {
  try {
    const stored = localStorage.getItem(MIX_TRANSITION_MODE_KEY) || 'auto';
    return MIX_TRANSITION_MODES.includes(stored) ? stored : 'auto';
  } catch (_) {
    return 'auto';
  }
}

function persistTransitionModeSetting(mode) {
  try {
    localStorage.setItem(MIX_TRANSITION_MODE_KEY, mode);
  } catch (_) {
    // ignore storage failures
  }
}

function applyTransitionModeSetting(mode, options = {}) {
  const { persist = true } = options;
  const safeMode = MIX_TRANSITION_MODES.includes(mode) ? mode : 'auto';
  selectedTransitionMode = safeMode;
  if (mixTransitionModeSelect) {
    mixTransitionModeSelect.value = safeMode;
  }
  player?.setTransitionMode(safeMode);
  if (persist) persistTransitionModeSetting(safeMode);
}

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
const crossfadeRing = document.getElementById('crossfade-ring');
const trackArtistA = document.getElementById('track-artist-a');
const trackArtist = document.getElementById('track-artist');
const clearCacheBtn = document.getElementById('clear-cache-btn');
const deckAPanel = document.getElementById('deck-a-panel');
const deckBPanel = document.getElementById('deck-b-panel');
const deckAVol = document.getElementById('deck-a-vol');
const deckBVol = document.getElementById('deck-b-vol');
const deckASlider = document.getElementById('deck-a-slider');
const deckBSlider = document.getElementById('deck-b-slider');
const deckAProgress = document.getElementById('deck-a-progress');
const deckBProgress = document.getElementById('deck-b-progress');
const deckAFill = document.getElementById('deck-a-fill');
const deckBFill = document.getElementById('deck-b-fill');
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
const mixTransitionModeSelect = document.getElementById('mix-transition-mode');
const mixModeRow = document.querySelector('.mix-mode-row');
const manualLockBtn = document.getElementById('manual-lock-btn');
const fxVisibilityBtn = document.getElementById('fx-visibility-btn');
const deckFxActions = document.querySelector('.deck-fx-actions');
const crossfadeControlMix = document.querySelector('.crossfade-control--mix');
const autoBpmBtn = document.getElementById('fx-auto-bpm-btn');
const echoBtn = document.getElementById('fx-echo-btn');
const distortionBtn = document.getElementById('fx-distortion-btn');
const autoModeBtn = document.getElementById('auto-mode-btn');
const deckAVocalBtn = document.getElementById('deck-a-vocal-btn');
const deckAInstruBtn = document.getElementById('deck-a-instru-btn');
const deckBVocalBtn = document.getElementById('deck-b-vocal-btn');
const deckBInstruBtn = document.getElementById('deck-b-instru-btn');
const deckAstemsIndicator = document.getElementById('deck-a-stems-indicator');
const deckBstemsIndicator = document.getElementById('deck-b-stems-indicator');
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
const debugLogsToggle = document.getElementById('debug-logs-toggle');
const debugLogsStatus = document.getElementById('debug-logs-status');

const tabBtns = document.querySelectorAll('.tab-bar-btn');
const tabPanels = {
  mix: document.getElementById('tab-mix'),
  playlist: document.getElementById('tab-playlist'),
  config: document.getElementById('tab-config'),
};
const deckMixControl = document.getElementById('deck-mix-control');

const shellUi = createShellUi({
  appScreen,
  crossfadeRing,
  setupError,
  setupLoading,
  setupScreen,
});

const {
  hideSetupError,
  showApp,
  showCrossfadeRing,
  showSetup,
  showSetupError,
  showSetupLoading,
  showToast,
} = shellUi;

const downloaderConfig = createDownloaderConfigManager({
  defaultUrl: DEFAULT_DOWNLOADER_API_URL,
  inputEl: downloaderApiUrlInput,
  saveBtn: downloaderApiSaveBtn,
  statusEl: downloaderApiStatus,
  storageKey: DOWNLOADER_API_URL_KEY,
  testBtn: downloaderApiTestBtn,
});

const {
  getDownloaderApiUrl,
  loadIntoForm: loadDownloaderApiConfigIntoForm,
  saveFromForm: saveDownloaderApiConfigFromForm,
  setStatus: setDownloaderApiStatus,
  setupEvents: setupDownloaderApiConfigEvents,
} = downloaderConfig;

const mixControls = createMixControls({
  autoBpmBtn,
  crossfadeControlMix,
  mixModeRow,
  deckAPanel,
  deckBPanel,
  deckFxActions,
  deckScopedFxButtons: {
    A: { vocalRemoveBtn: deckAVocalBtn, instruRemoveBtn: deckAInstruBtn },
    B: { vocalRemoveBtn: deckBVocalBtn, instruRemoveBtn: deckBInstruBtn },
  },
  deckMixLabel,
  deckMixSlider,
  distortionBtn,
  echoBtn,
  fxVisibilityBtn,
  getDeckBCueIndex: () => deckBCueIndex,
  getDeckCueDeck: () => deckCueDeck,
  getDeckMixRatio: () => deckMixRatio,
  getFxControlsHidden: () => fxControlsHidden,
  getManualMixLock: () => manualMixLock,
  getMixFeatures: () => mixFeatures,
  getPlayer: () => player,
  getQueueLength: () => queue.length,
  manualLockBtn,
  onFocusDeckChanged: () => {
    updateDeckCueUI();
  },
  setDeckMixRatio: (value) => {
    deckMixRatio = value;
  },
  setMixFeatures: (value) => {
    mixFeatures = value;
  },
});

const {
  applyDeckMixRatio,
  applyMixFeatures,
  clampCrossfadeSeconds,
  clampDeckMixRatio,
  deckToPlatineLabel,
  getFocusDeck,
  getInactiveDeck,
  setMixFeatureEnabled,
  updateDeckCueUI,
  updateDeckMixUI,
  updateFxVisibilityUI,
  updateManualLockUI,
  updateMixFeaturesUI,
} = mixControls;

const saveQueue = () => {
  logDebug('saveQueue()', { currentIndex, length: queue.length });
  saveQueueToStorage({
    currentIndex,
    queue,
    storageKey: QUEUE_KEY,
  });
};

const restoreQueue = () => {
  logInfo('restoreQueue(): loading queue from storage');
  const restored = restoreQueueFromStorage(QUEUE_KEY);
  if (!restored?.items?.length) {
    logInfo('restoreQueue(): no stored queue found');
    return;
  }

  for (const item of restored.items) {
    queue.push(item);
  }

  currentIndex = restored.index;
  if (currentIndex >= queue.length) currentIndex = queue.length - 1;
  currentTrackId = queue[currentIndex]?.id ?? null;
  logInfo('restoreQueue(): queue restored', {
    currentIndex,
    length: queue.length,
    currentTrackId,
  });
};

const audioSourceManager = createAudioSourceManager({
  audioCacheName: AUDIO_CACHE_NAME,
  getDownloaderApiUrl,
  normalizeApiSearchResponse,
  onQueueUpdated: () => renderQueue(),
  sessionBlobCache,
  touchQueueItem,
});

const uiRenderer = createDjMixRenderer({
  albumArt,
  artPlaceholder,
  autoMixBtn,
  clampDeckMixRatio,
  deckABpm,
  deckABpmReset,
  deckAFill,
  deckALaunchBtn,
  deckAPanel,
  deckAVol,
  deckBBpm,
  deckBBpmReset,
  deckBFill,
  deckBLaunchBtn,
  deckBPanel,
  deckBVol,
  emptyQueue,
  getCurrentIndex: () => currentIndex,
  getCurrentTrackId: () => currentTrackId,
  getDeckBCueIndex: () => deckBCueIndex,
  getDeckCueDeck: () => deckCueDeck,
  getDeckDisplayItems: () => deckDisplayItems,
  getDeckMixRatio: () => deckMixRatio,
  getFocusDeck,
  getInactiveDeck,
  getIsPlaying: () => isPlaying,
  getLaunchPreviewState: () => ({
    active: launchPreviewActive,
    artUrl: launchPreviewArtUrl,
    artist: launchPreviewArtist,
    deck: launchPreviewDeck,
    title: launchPreviewTitle,
  }),
  getPlayer: () => player,
  getPrevIsCrossfading: () => prevIsCrossfading,
  getQueue: () => queue,
  nextAlbumArt,
  nextArtPlaceholder,
  queueList,
  setDeckMixRatio: (value) => {
    deckMixRatio = value;
  },
  setPrevIsCrossfading: (value) => {
    prevIsCrossfading = value;
  },
  trackArtist,
  trackArtistA,
  trackArtistB,
  updateDeckCueUI,
  updateDeckMixUI,
});

const {
  clearSessionBlobCache,
  deleteLocalCacheSong,
  enrichStemsFromServer,
  ensureLocalSource,
  releaseLocalBlob,
  searchTracksViaApi,
} = audioSourceManager;

const playlistManager = createPlaylistManager({
  deleteLocalCacheSong,
  escHtml,
  getCurrentIndex: () => currentIndex,
  getDownloaderApiUrl,
  getPlayer: () => player,
  getPlaylistLoaded: () => playlistLoaded,
  getQueue: () => queue,
  playlistListEl,
  renderQueue,
  saveQueue,
  setCurrentIndex: (value) => {
    currentIndex = value;
  },
  setPendingAutoplay: (value) => {
    pendingAutoplay = value;
  },
  setPlaylistLoaded: (value) => {
    playlistLoaded = value;
  },
  showToast,
  startPlaybackForIndex,
  triggerCacheFade: async (file) => {
    if (!file) return;
    await triggerSearchFade({
      id: file.id || file.cachePath || file.path || file.url || file.trackName,
      uri: file.url || file.localUrl || file.streamUrl || file.path || '',
      name: file.trackName || file.name || file.title || 'Inconnu',
      artist: file.artistName || file.artist || 'Artiste inconnu',
      artUrl: file.artworkUrl || file.artUrl || '',
      duration: Number(file.duration) || 0,
      bpm: file.bpm || file.tempo || null,
      loudnessDb: Number(file.loudnessDb),
      audioFeatures: file.audioFeatures || null,
      stems: {
        vocalsUrl: file.vocalsUrl || '',
        instrumentalUrl: file.instrumentalUrl || '',
      },
      cachePath: file.cachePath || '',
      downloadUrl: file.url || file.localUrl || file.streamUrl || '',
    });
  },
  tabBtns,
  tabPanels,
});

const { setCacheFilter, switchTab } = playlistManager;

function isCacheTabActive() {
  return Boolean(tabPanels.playlist && tabPanels.playlist.classList.contains('active') && !tabPanels.playlist.hidden);
}

const renderDeckState = (detail) => uiRenderer.renderDeckState(detail);
const updateNowPlaying = (item, deck = getFocusDeck()) => uiRenderer.updateNowPlaying(item, deck);
const updateUpcomingArtwork = () => uiRenderer.updateUpcomingArtwork();

function readDebugLogsSetting() {
  try {
    return localStorage.getItem(DEBUG_LOGS_KEY) === '1';
  } catch (_) {
    return false;
  }
}

function persistDebugLogsSetting(enabled) {
  try {
    localStorage.setItem(DEBUG_LOGS_KEY, enabled ? '1' : '0');
  } catch (_) {
    // ignore storage failures
  }
}

function updateDebugLogsUi(enabled) {
  if (debugLogsToggle) debugLogsToggle.checked = Boolean(enabled);
  if (!debugLogsStatus) return;
  debugLogsStatus.textContent = enabled
    ? 'Mode debug actif: logs info + debug visibles dans la console.'
    : 'Mode debug inactif: seuls les warnings et erreurs sont affiches.';
}

function applyDebugLogsSetting(enabled, options = {}) {
  const { persist = true } = options;
  const safeEnabled = Boolean(enabled);
  setDebugLoggingEnabled(safeEnabled);
  updateDebugLogsUi(safeEnabled);
  if (persist) persistDebugLogsSetting(safeEnabled);
  if (safeEnabled) {
    logWarn('debug.mode.enabled', { enabled: safeEnabled });
  } else {
    logWarn('debug.mode.disabled', { enabled: safeEnabled });
  }
}

/**
 * Update stem removal button disabled state for a deck based on stem availability.
 * Disable buttons if stems are not yet loaded, enable if they are available.
 * Also show/hide the stems indicator icon.
 */
function updateStemButtonState(deck) {
  const stemsAvailable = stemsLoadedPerDeck[deck] || false;
  const safeDeck = deck === 'B' ? 'B' : 'A';
  
  if (safeDeck === 'A') {
    deckAVocalBtn?.setAttribute('disabled', stemsAvailable ? '' : 'disabled');
    deckAInstruBtn?.setAttribute('disabled', stemsAvailable ? '' : 'disabled');
    deckAstemsIndicator?.setAttribute('hidden', stemsAvailable ? '' : 'hidden');
  } else {
    deckBVocalBtn?.setAttribute('disabled', stemsAvailable ? '' : 'disabled');
    deckBInstruBtn?.setAttribute('disabled', stemsAvailable ? '' : 'disabled');
    deckBstemsIndicator?.setAttribute('hidden', stemsAvailable ? '' : 'hidden');
  }
}

/**
 * Fire-and-forget: enrich item stems from the server, then notify mixFeatures
 * of the updated URLs if the item is still loaded on the given deck.
 */
function backgroundEnrichStems(deck, item) {
  if (!item || !deck) return;
  enrichStemsFromServer(item)
    .then(() => {
      // After enrichment, check if stems are now available
      const stems = item.localStemUrls || item.stems;
      if (!stems?.vocalsUrl && !stems?.instrumentalUrl) return; // no stems found
      if (deckDisplayItems[deck] !== item) return; // item was swapped out
      
      // Mark stems as loaded for this deck
      stemsLoadedPerDeck[deck] = true;
      updateStemButtonState(deck);
      
      player?.updateDeckStems(deck, stems);
      logDebug('stems.enriched.deck', { deck, id: item?.id, hasVocals: !!stems.vocalsUrl, hasInstrumental: !!stems.instrumentalUrl });
    })
    .catch((err) => {
      logWarn('stems.enrichment.error', { deck, id: item?.id, error: err?.message });
    });
}



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

const autoModeManager = createAutoModeManager({
  getDownloaderApiUrl,
  getQueue: () => queue,
  getCurrentTrackId: () => currentTrackId,
  getCurrentTrackIndex: () => currentIndex,
  searchTracksViaApi,
  addToQueue,
  showToast,
  logger,
  onAutomixTimingCalculated: (triggerMs) => {
    nextAutomixTriggerMs = triggerMs;
    automixTriggeredForTrack = false;
    logDebug('autoDj: timing calculated', { triggerMs });
  },
});

tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    if (tab === 'playlist') playlistLoaded = false;
    if (tab === 'mix') closeSearch();
    switchTab(tab);
    if (tab === 'playlist') {
      setCacheFilter(searchInput.value.trim());
      closeSearch();
    }
  });
});

(async function init() {
  applyDebugLogsSetting(readDebugLogsSetting(), { persist: false });
  applyTransitionModeSetting(selectedTransitionMode, { persist: false });

  autoModeManager.initialize();
  updateAutoModeUI();

  debugLogsToggle?.addEventListener('change', () => {
    applyDebugLogsSetting(Boolean(debugLogsToggle.checked), { persist: true });
  });

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
  logInfo('connectLocal(): initializing local dual-deck player');
  hideSetupError();
  startBlobCleanupLoop();

  player?.destroy();
  player = new DJPlayer();
  player.crossfadeDuration = clampCrossfadeSeconds(crossfadeSlider.value) * 1000;
  player.setTransitionMode(selectedTransitionMode);
  player.setMixFeatures(mixFeatures);
  hookPlayerEvents();

  showApp();

  await player.init();
  logInfo('connectLocal(): player initialized', {
    crossfadeDurationMs: player.crossfadeDuration,
    transitionMode: selectedTransitionMode,
  });
}

function hookPlayerEvents() {
  player.addEventListener('ready', async () => {
    logInfo('player.ready', { pendingAutoplay, currentIndex, queueLength: queue.length });
    // showToast('Platines locales prêtes');
    applyDeckMixRatio(deckMixRatio, 0);
    player.setMixFeatures(mixFeatures);

    if (pendingAutoplay && currentIndex >= 0 && queue[currentIndex]) {
      pendingAutoplay = false;
      await startPlaybackForIndex(currentIndex, 'play');
    }
  });

  player.addEventListener('statechange', ({ detail }) => {
    logDebug('player.statechange', detail);
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

    // Auto DJ: Check if it's time to trigger automix
    if (autoModeManager.isAutoModeEnabled() && 
        !automixTriggeredForTrack && 
        nextAutomixTriggerMs > 0 && 
        position >= nextAutomixTriggerMs) {
      
      automixTriggeredForTrack = true;
      logInfo('autoDj: triggering automix at optimal moment', {
        position,
        triggerMs: nextAutomixTriggerMs,
        remainingMs: duration - position,
      });

      // Trigger automix automatically
      const nextIdx = currentIndex + 1;
      if (nextIdx < queue.length) {
        autoMixBtn?.click?.();
      }
    }
  });

  player.addEventListener('crossfadeready', () => {
    logInfo('player.crossfadeready: triggering autofade manager');
    autoFadeManager.handleReady().catch(() => {
      // handled internally by manager callbacks
    });
  });

  player.addEventListener('trackend', () => {
    logInfo('player.trackend');
    isPlaying = false;
    showCrossfadeRing(false);
    renderQueue();
    
    // Trigger auto mode search on track end
    const currentTrack = queue[currentIndex];
    if (currentTrack) {
      autoModeManager.onTrackFinished(currentTrack);
    }
  });

    player.addEventListener('error', ({ detail }) => {
      logError('player.error', detail);
      // showToast(`Erreur API: ${detail.message}`, true);
    });

    player.addEventListener('crossfadeprogress', ({ detail }) => {
      updateCrossfadeBars(detail);
    });

    player.addEventListener('transitionmode', ({ detail }) => {
      const requestedMode = detail?.requestedMode || 'auto';
      const effectiveMode = detail?.effectiveMode || requestedMode;
      if (requestedMode !== 'auto') return;
      const label = MIX_TRANSITION_MODE_LABELS[effectiveMode] || effectiveMode;
      showToast(`AutoMix mode: ${label}`);
    });

    player.addEventListener('deckstate', ({ detail }) => {
      renderDeckState(detail);
    });
}

autoMixBtn?.addEventListener('click', async () => {
  if (!player || player.isCrossfading) return;
  const hasCue = deckBCueIndex >= 0 && deckBCueIndex < queue.length;
  const inactiveDeck = hasCue && (deckCueDeck === 'A' || deckCueDeck === 'B')
    ? deckCueDeck
    : getInactiveDeck();
  const preparedItem = deckDisplayItems[inactiveDeck];
  const preparedIndex = preparedItem ? queue.findIndex((item) => item.id === preparedItem.id) : -1;
  const nextIndex = preparedIndex >= 0
    ? preparedIndex
    : (currentIndex + 1 < queue.length ? currentIndex + 1 : (queue.length > 1 ? 0 : -1));
  if (nextIndex < 0) return;

  logInfo('automix.click', {
    currentIndex,
    nextIndex,
    preparedIndex,
    inactiveDeck,
    queueLength: queue.length,
  });

  showCrossfadeRing(true);
  showToast('AutoMix en cours...');

  try {
    await startPlaybackForIndex(nextIndex, 'crossfade', { targetDeck: inactiveDeck });
    renderQueue();
  } catch (err) {
    logError('automix.failed', { message: err?.message, nextIndex, inactiveDeck });
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

async function launchDeckFromQueue(deck, options = {}) {
  if (!player || !queue.length) {
    showToast('Ajoutez une chanson dans la file', true);
    return;
  }

  let targetDeck = deck === 'B' ? 'B' : 'A';

  const fallbackIndex = currentIndex >= 0 && queue[currentIndex] ? currentIndex : 0;
  const inactiveDeck = getInactiveDeck();
  const deckItemIndex = deckDisplayItems[targetDeck]
    ? queue.findIndex((q) => q.id === deckDisplayItems[targetDeck]?.id)
    : -1;

  let targetIndex = fallbackIndex;
  if (options.useCue === true && deckBCueIndex >= 0 && queue[deckBCueIndex]) {
    targetIndex = deckBCueIndex;
    deckBCueIndex = -1;
  } else if (deckItemIndex >= 0) {
    targetIndex = deckItemIndex;
  } else if (targetDeck === inactiveDeck) {
    targetIndex = getFollowingQueueIndex(fallbackIndex);
  }
  if (targetIndex < 0) targetIndex = fallbackIndex;

  const item = queue[targetIndex];
  if (!item) return;

  logInfo('launchDeckFromQueue(): deck load requested', {
    deck: targetDeck,
    targetIndex,
    currentIndex,
    itemId: item.id,
    itemName: item.name,
    options,
  });

  try {
    const sourceUrl = await ensureLocalSource(item);
    const isFocusDeck = targetDeck === getFocusDeck();
    const paused = typeof options.paused === 'boolean' ? options.paused : !isFocusDeck;
    await player.playOnDeck(targetDeck, {
      url: sourceUrl,
      loudnessDb: item.loudnessDb,
      bpm: item.bpm,
      durationMs: item.duration,
      audioFeatures: item.audioFeatures,
      stems: item.stems,
    }, { makeActive: false, paused });
    deckDisplayItems[targetDeck] = item;
    
    if (isFocusDeck) {
      currentIndex = targetIndex;
      currentTrackId = item.id;
      updateNowPlaying(item, targetDeck);
      isPlaying = true;
      launchPreviewTitle = '';
      launchPreviewArtist = '';
      launchPreviewDeck = null;
      prefetchNext(getFollowingQueueIndex(targetIndex));
      renderQueue();
    } else {
      launchPreviewActive = true;
      launchPreviewArtUrl = item.artUrl || '';
      launchPreviewTitle = item.name || '';
      launchPreviewArtist = item.artist || '';
      launchPreviewDeck = targetDeck;
      deckCueDeck = targetDeck;
      updateUpcomingArtwork();
    }
    logInfo('launchDeckFromQueue(): deck loaded', {
      deck: targetDeck,
      itemId: item.id,
      isFocusDeck,
      paused,
    });
    backgroundEnrichStems(targetDeck, item);
  } catch (err) {
    logError('launchDeckFromQueue(): failed', {
      deck: targetDeck,
      targetIndex,
      itemId: item.id,
      message: err?.message,
    });
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

manualLockBtn?.addEventListener('click', () => {
  manualMixLock = !manualMixLock;
  updateManualLockUI();
});

fxVisibilityBtn?.addEventListener('click', () => {
  fxControlsHidden = !fxControlsHidden;
  localStorage.setItem(FX_VISIBILITY_KEY, fxControlsHidden ? '1' : '0');
  updateFxVisibilityUI();
});

mixTransitionModeSelect?.addEventListener('change', () => {
  const nextMode = String(mixTransitionModeSelect.value || 'auto');
  applyTransitionModeSetting(nextMode, { persist: true });
  const label = MIX_TRANSITION_MODE_LABELS[selectedTransitionMode] || selectedTransitionMode;
  showToast(`Mode AutoMix: ${label}`);
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

deckAProgress?.addEventListener('click', (event) => {
  seekDeckFromProgressEvent('A', event);
});

deckBProgress?.addEventListener('click', (event) => {
  seekDeckFromProgressEvent('B', event);
});

deckAProgress?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  const rect = deckAProgress.getBoundingClientRect();
  seekDeckFromProgressEvent('A', {
    currentTarget: deckAProgress,
    clientX: rect.left + (rect.width / 2),
  });
});

deckBProgress?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  const rect = deckBProgress.getBoundingClientRect();
  seekDeckFromProgressEvent('B', {
    currentTarget: deckBProgress,
    clientX: rect.left + (rect.width / 2),
  });
});

autoBpmBtn?.addEventListener('click', () => {
  const nextEnabled = !mixFeatures.autoBpm;
  setMixFeatureEnabled('autoBpm', nextEnabled);
  if (nextEnabled && player) {
    player.syncDecksToActive();
    showToast('Auto BPM active + Sync BPM');
  }
});

echoBtn?.addEventListener('click', () => {
  setMixFeatureEnabled('echo', !mixFeatures.echo);
});

distortionBtn?.addEventListener('click', () => {
  setMixFeatureEnabled('distortion', !mixFeatures.distortion);
});

autoModeBtn?.addEventListener('click', () => {
  const isEnabled = autoModeManager.toggleAutoMode();
  autoModeBtn.setAttribute('aria-pressed', String(isEnabled));
  autoModeBtn.textContent = `Auto Mode: ${isEnabled ? 'ON' : 'OFF'}`;
  showToast(`Auto Mode: ${isEnabled ? '🤖 ON' : 'OFF'}`);
});

function updateAutoModeUI() {
  const isEnabled = autoModeManager.isAutoModeEnabled();
  autoModeBtn.setAttribute('aria-pressed', String(isEnabled));
  autoModeBtn.textContent = `Auto Mode: ${isEnabled ? 'ON' : 'OFF'}`;
}

deckAVocalBtn?.addEventListener('click', () => {
  const enabled = Boolean(mixFeatures.deckFx?.A?.vocalRemove);
  setMixFeatureEnabled('vocalRemove', !enabled, 'A');
});

deckAInstruBtn?.addEventListener('click', () => {
  const enabled = Boolean(mixFeatures.deckFx?.A?.instruRemove);
  setMixFeatureEnabled('instruRemove', !enabled, 'A');
});

deckBVocalBtn?.addEventListener('click', () => {
  const enabled = Boolean(mixFeatures.deckFx?.B?.vocalRemove);
  setMixFeatureEnabled('vocalRemove', !enabled, 'B');
});

deckBInstruBtn?.addEventListener('click', () => {
  const enabled = Boolean(mixFeatures.deckFx?.B?.instruRemove);
  setMixFeatureEnabled('instruRemove', !enabled, 'B');
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

   if (isCacheTabActive()) {
    setCacheFilter(q);
    closeSearch();
    return;
  }

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
  event.preventDefault();
  clearTimeout(searchDebounceTimer);

  if (isCacheTabActive()) {
    setCacheFilter(q);
    closeSearch();
    return;
  }

  if (!q) return;

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
  if (isCacheTabActive()) {
    setCacheFilter('');
  }
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
  logInfo('runSearch(): querying API', { query });
  try {
    if (!getDownloaderApiUrl()) {
      searchResults.innerHTML = '<div class="search-empty">Configurez l’API de téléchargement dans l’onglet Config</div>';
      return;
    }

    const tracks = await searchTracksViaApi(query);
    logInfo('runSearch(): API results', { query, count: tracks?.length || 0 });
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
      const resolveResult = () => {
        const kind = el.dataset.kind;
        const idx = Number(el.dataset.index);
        return kind === 'artist' ? artistResults[idx] : songResults[idx];
      };

      el.querySelector('.play-now-btn')?.addEventListener('click', (event) => {
        event.stopPropagation();
        player?.activateElement();
        const result = resolveResult();
        if (!result || result?.isArtistResult) return;
        if (pendingSearchAdd) return;

        pendingSearchAdd = true;
        triggerSearchFade(result)
          .catch((err) => {
            showToast(`API: ${err.message}`, true);
          })
          .finally(() => {
            pendingSearchAdd = false;
          });
      });

      el.addEventListener('click', () => {
        player?.activateElement();
        const result = resolveResult();
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
    logError('runSearch(): failed', { query, message: err?.message });
    searchResults.innerHTML = `<div class="search-empty">⚠ ${escHtml(err.message)}</div>`;
  }
}

function getQueueIndexForTrack(track) {
  const trackId = track?.id || track?.ratingKey || track?.uri || track?.name;
  const trackName = track?.name || track?.title || '';
  const trackArtist = track?.artists
    ? track.artists.map((a) => a.name).join(', ')
    : (track?.artist || 'Artiste inconnu');

  return queue.findIndex(
    (q) => q.id === trackId || (q.name === trackName && q.artist === trackArtist)
  );
}

async function triggerSearchFade(track) {
  if (!player || player.isCrossfading) return;

  // If nothing is currently playing, keep the existing direct play behavior.
  if (!isPlaying) {
    await addToQueue(track, { playNow: true, preferFade: false });
    return;
  }

  let targetIndex = getQueueIndexForTrack(track);
  if (targetIndex < 0) {
    await addToQueue(track);
    targetIndex = getQueueIndexForTrack(track);
  }

  if (targetIndex < 0) return;

  const inactiveDeck = getInactiveDeck();
  deckBCueIndex = targetIndex;
  deckCueDeck = inactiveDeck;
  updateDeckCueUI();
  renderQueue();

  await launchDeckFromQueue(inactiveDeck, { paused: true, useCue: true });
  showToast(`Platine ${deckToPlatineLabel(inactiveDeck)} prechargee, AutoMix...`);
  autoMixBtn?.click();
  closeSearch();
}

async function addToQueue(track, options = {}) {
  const { playNow = false, preferFade = false } = options;
  const artUrl = getBestArtworkUrl(track);
  const duration = getTrackDurationMs(track);
  const stems = extractStemSourceUrls(track);
  const audioFeatures = extractAudioFeatures(track);
  const item = {
    id: track.id || track.ratingKey || track.uri || track.name,
    uri: track.uri || track.downloadUrl || `api:track:${track.id || track.name}`,
    name: track.name || track.title || 'Titre API',
    artist: track.artists ? track.artists.map((a) => a.name).join(', ') : (track.artist || 'Artiste inconnu'),
    artUrl,
    duration,
    bpm: track.bpm || track.tempo || null,
    loudnessDb: extractTrackLoudnessDb(track),
    audioFeatures,
    stems: {
      vocalsUrl: stems.vocalsUrl,
      instrumentalUrl: stems.instrumentalUrl,
    },
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

    if (playNow && player && !player.isCrossfading) {
      const existingIndex = queue.findIndex(
        (q) => q.id === item.id || (q.name === item.name && q.artist === item.artist)
      );
      if (existingIndex >= 0) {
        const useFade = isPlaying && preferFade;
        if (useFade) showCrossfadeRing(true);
        try {
          await startPlaybackForIndex(existingIndex, useFade ? 'crossfade' : 'play');
          currentIndex = existingIndex;
          currentTrackId = queue[existingIndex]?.id ?? null;
          renderQueue();
          closeSearch();
        } finally {
          if (useFade) showCrossfadeRing(false);
        }
      }
    }

    return;
  }

  queue.push(item);
  const addedIndex = queue.length - 1;
  logInfo('addToQueue(): item added', {
    addedIndex,
    id: item.id,
    name: item.name,
    artist: item.artist,
    queueLength: queue.length,
  });
  renderQueue();

  if (playNow && player && !player.isCrossfading && isPlaying) {
    const useFade = Boolean(preferFade);
    if (useFade) showCrossfadeRing(true);
    try {
      await startPlaybackForIndex(addedIndex, useFade ? 'crossfade' : 'play');
      currentIndex = addedIndex;
      currentTrackId = item.id;
      renderQueue();
      closeSearch();
    } finally {
      if (useFade) showCrossfadeRing(false);
    }
    return;
  }

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

  logInfo('startPlaybackForIndex(): begin', {
    index,
    mode,
    targetDeck,
    currentIndex,
    currentTrackId,
    itemId: item.id,
    itemName: item.name,
  });

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
    
    // Check if stems are already available in cache
    const hasStemsInCache = !!(item.localStemUrls?.vocalsUrl || item.localStemUrls?.instrumentalUrl || 
                                item.stems?.vocalsUrl || item.stems?.instrumentalUrl);
    stemsLoadedPerDeck[targetDeck] = hasStemsInCache;
    updateStemButtonState(targetDeck);
    
    const sourceUrl = await ensureLocalSource(item);
    logDebug('startPlaybackForIndex(): source resolved', {
      index,
      mode,
      targetDeck,
      sourcePreview: String(sourceUrl || '').slice(0, 80),
      sourceState: item.sourceState,
      sourceMeta: item.sourceMeta,
    });

    if (mode === 'autofade') {
      await player.crossfadeToDeck(targetDeck, {
        url: sourceUrl,
        loudnessDb: item.loudnessDb,
        bpm: item.bpm,
        durationMs: item.duration,
        audioFeatures: item.audioFeatures,
        stems: item.stems,
      });
    } else if (mode === 'crossfade') {
      await player.crossfadeToDeck(targetDeck, {
        url: sourceUrl,
        loudnessDb: item.loudnessDb,
        bpm: item.bpm,
        durationMs: item.duration,
        audioFeatures: item.audioFeatures,
        stems: item.stems,
      });
    } else if (mode === 'switch') {
      await player.playOnDeck(getFocusDeck(), {
        url: sourceUrl,
        loudnessDb: item.loudnessDb,
        bpm: item.bpm,
        durationMs: item.duration,
        audioFeatures: item.audioFeatures,
        stems: item.stems,
      }, { makeActive: false, paused: false });
    } else {
      await player.playOnDeck(getFocusDeck(), {
        url: sourceUrl,
        loudnessDb: item.loudnessDb,
        bpm: item.bpm,
        durationMs: item.duration,
        audioFeatures: item.audioFeatures,
        stems: item.stems,
      }, { makeActive: false, paused: false });
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
      const nextIndex = getFollowingQueueIndex(index);
      const nextItem = nextIndex >= 0 ? queue[nextIndex] : null;
      if (nextItem) {
        logDebug('startPlaybackForIndex(): preparing inactive deck with next track', {
          inactiveDeck,
          nextIndex,
          nextItemId: nextItem.id,
          nextItemName: nextItem.name,
        });
        ensureLocalSource(nextItem).then((nextUrl) => {
          if (!player) return;
          
          // Check if stems are already available in cache for inactive deck
          const nextHasStemsInCache = !!(nextItem.localStemUrls?.vocalsUrl || nextItem.localStemUrls?.instrumentalUrl || 
                                          nextItem.stems?.vocalsUrl || nextItem.stems?.instrumentalUrl);
          stemsLoadedPerDeck[inactiveDeck] = nextHasStemsInCache;
          updateStemButtonState(inactiveDeck);
          
          player.playOnDeck(inactiveDeck, {
            url: nextUrl,
            loudnessDb: nextItem.loudnessDb,
            bpm: nextItem.bpm,
            durationMs: nextItem.duration,
            audioFeatures: nextItem.audioFeatures,
            stems: nextItem.stems,
          }, { paused: true });
          deckDisplayItems[inactiveDeck] = nextItem;
          
          // Always fetch stems from server for the next track
          backgroundEnrichStems(inactiveDeck, nextItem);
          
          renderQueue();
        }).catch(() => {});
      }
    }

    isPlaying = true;
  prefetchNext(getFollowingQueueIndex(index));
    launchPreviewActive = false;
    launchPreviewArtUrl = '';
    launchPreviewTitle = '';
    launchPreviewArtist = '';
    launchPreviewDeck = null;
    renderQueue();
    logInfo('startPlaybackForIndex(): done', {
      mode,
      index,
      currentIndex,
      currentTrackId,
      targetDeck,
      isPlaying,
    });
    backgroundEnrichStems(targetDeck, item);
    
    // Schedule automix timing for auto DJ mode and reset trigger flag
    automixTriggeredForTrack = false;
    nextAutomixTriggerMs = -1;
    autoModeManager.scheduleAutomixTiming(item);
  } catch (err) {
    item.sourceState = 'error';
    item.sourceError = err.message;
    launchPreviewActive = false;
    launchPreviewArtUrl = '';
    launchPreviewTitle = '';
    launchPreviewArtist = '';
    launchPreviewDeck = null;
    renderQueue();
    logError('startPlaybackForIndex(): failed', {
      mode,
      index,
      targetDeck,
      itemId: item.id,
      message: err?.message,
    });
    showToast(`API: ${err.message}`, true);
    throw err;
  }
}

function prefetchNext(index) {
  if (index < 0) return;
  const next = queue[index];
  if (!next) return;
  if (next.localBlobUrl) return;
  logDebug('prefetchNext(): prefetching track source', {
    index,
    id: next.id,
    name: next.name,
  });
  touchQueueItem(next);

  ensureLocalSource(next).catch(() => {
    // silent prefetch failure: user can still trigger manually and get toast
  });
  
  // Always fetch stems from server for any queued track (background enrichment)
  enrichStemsFromServer(next).catch(() => {});
}

function renderQueue() {
  saveQueue();
  uiRenderer.updateUpcomingArtwork();
  updateDeckCueUI();

  if (!queue.length) {
    uiRenderer.queueList.innerHTML = '';
    uiRenderer.queueList.appendChild(uiRenderer.emptyQueue);
    uiRenderer.emptyQueue.style.display = '';
    if (uiRenderer.autoMixBtn) uiRenderer.autoMixBtn.disabled = true;
    return;
  }

  uiRenderer.emptyQueue.style.display = 'none';
  if (uiRenderer.autoMixBtn) uiRenderer.autoMixBtn.disabled = queue.length <= 1;

  uiRenderer.queueList.innerHTML = uiRenderer.buildQueueHTML();

  uiRenderer.queueList.querySelectorAll('.queue-item').forEach((el) => {
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
      uiRenderer.queueList.querySelectorAll('.queue-item').forEach((node) => node.classList.remove('is-dragging'));
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

  uiRenderer.queueList.querySelectorAll('.queue-remove').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.index);
      removeFromQueue(idx);
    });
  });

  uiRenderer.queueList.querySelectorAll('.queue-cue').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.index);
      const deck = btn.dataset.deck === 'B' ? 'B' : 'A';
      if (idx < 0 || idx >= queue.length) return;
      deckBCueIndex = idx;
      deckCueDeck = deck;
      updateDeckCueUI();
      showToast(`Cue Platine ${deckToPlatineLabel(deck)}: ${queue[idx].name}`);
      renderQueue();

      await launchDeckFromQueue(deck, { paused: true, useCue: true });
    });
  });
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
  uiRenderer.queueList.querySelectorAll('.queue-item').forEach((el) => {
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

function getWrappedQueueIndex(index) {
  if (!queue.length) return -1;
  const numeric = Number(index);
  if (!Number.isFinite(numeric)) return -1;
  return ((numeric % queue.length) + queue.length) % queue.length;
}

function getFollowingQueueIndex(index) {
  if (queue.length <= 1) return -1;
  return getWrappedQueueIndex(index + 1);
}

function updateCrossfadeBars({ fromDeck,fromVolume, toVolume, toPosition, toDuration }) {
  if(fromDeck === 'A') {
    updateDeckMixUI(toVolume);
  }else {updateDeckMixUI(fromVolume);}
}

async function seekDeckFromProgressEvent(deck, event) {
  if (!player || !event?.currentTarget) return;
  const detail = player._lastDeckState;
  const deckState = deck === 'B' ? detail?.deckB : detail?.deckA;
  const durationMs = Number(deckState?.durationMs) || 0;
  if (durationMs <= 0) return;

  const rect = event.currentTarget.getBoundingClientRect();
  if (!rect.width) return;

  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  await player.seekDeckTo(deck, durationMs * ratio).catch((err) => {
    showToast(`Erreur: ${err.message}`, true);
  });
}

updateCrossfadeControlUI(crossfadeSlider.value);
updateDeckMixUI(deckMixRatio);
updateManualLockUI();
updateDeckCueUI();
updateMixFeaturesUI();
fxControlsHidden = localStorage.getItem(FX_VISIBILITY_KEY) === '1';
updateFxVisibilityUI();

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
    deckFx: {
      A: { vocalRemove: false, instruRemove: false },
      B: { vocalRemove: false, instruRemove: false },
    },
  };

  autoModeManager.reset();

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

  // Reset auto DJ timing
  nextAutomixTriggerMs = -1;
  automixTriggeredForTrack = false;

  localStorage.removeItem(QUEUE_KEY);
  deckDisplayItems.A = null;
  deckDisplayItems.B = null;
  prevIsCrossfading = false;
  deckCueDeck = null;
  switchTab('mix');
  showCrossfadeRing(false);
  trackArtist.textContent = 'Ajoutez des chansons à la file d\'attente';
  albumArt.src = '';
  albumArt.hidden = true;
  artPlaceholder.style.display = '';
  nextAlbumArt.src = '';
  nextAlbumArt.hidden = true;
  nextArtPlaceholder.style.display = '';
  if (trackArtistA) trackArtistA.textContent = '';
  if (trackArtistB) trackArtistB.textContent = '';
  updateManualLockUI();
  updateDeckCueUI();
  updateMixFeaturesUI();
  updateAutoModeUI();
  renderQueue();
  showSetup();
}

function openSearch() {
  searchOverlay.hidden = false;
  if (searchClose) searchClose.hidden = false;
}

function closeSearch() {
  searchOverlay.hidden = true;
  if (searchClose) searchClose.hidden = true;
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
