/**
 * main.js - DJ Mix app orchestrator.
 * Search: downloader API
 * Playback: temporary local Blob download + dual-deck crossfade
 */

import { DJPlayer } from './player.js';
import { initServiceWorker, installPwa, initAutoFullscreen, initApkDownloadLink, checkApkUpdate, doApkUpdate } from './pwa.js';
import { pushPlaybackState, pushQueue, onMediaCommand, getPendingMediaCommand } from './lib/androidAutoBridge.js';

// --- Wake Lock (garder l'écran allumé pendant la lecture) ---
let wakeLock = null;
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      });
    }
  } catch (err) {
    // Peut échouer sur certains navigateurs ou si déjà actif
    wakeLock = null;
  }
}
function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

// --- Audio Session Keepalive (garder la notification "En cours" Android pendant la pause) ---
// Joue un audio silencieux en boucle pour maintenir la session audio active jusqu'à 10 minutes.
let _keepaliveAudio = null;
let _keepaliveTimer = null;
let _keepalivePosInterval = null;
const KEEPALIVE_DURATION_MS = 10 * 60 * 1000;

function _createSilentWavUrl() {
  const sampleRate = 8000;
  const numSamples = sampleRate; // 1 seconde
  const buf = new ArrayBuffer(44 + numSamples);
  const v = new DataView(buf);
  const w = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + numSamples, true);
  w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate, true);
  v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  w(36, 'data'); v.setUint32(40, numSamples, true);
  new Uint8Array(buf, 44).fill(128); // 128 = silence en PCM 8-bit
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

function startMediaKeepAlive() {
  stopMediaKeepAlive();
  if (!('mediaSession' in navigator)) return;
  if (!_keepaliveAudio) {
    _keepaliveAudio = new Audio(_createSilentWavUrl());
    _keepaliveAudio.loop = true;
    _keepaliveAudio.volume = 0.001; // non-zéro pour éviter les optimisations navigateur
  }
  _keepaliveAudio.play().catch(() => {});
  // Rafraîchir la position toutes les 30s pour signaler l'activité à Android
  _keepalivePosInterval = setInterval(() => updateMediaSessionPositionState(), 30_000);
  _keepaliveTimer = setTimeout(stopMediaKeepAlive, KEEPALIVE_DURATION_MS);
}

function stopMediaKeepAlive() {
  clearTimeout(_keepaliveTimer);
  clearInterval(_keepalivePosInterval);
  _keepaliveTimer = null;
  _keepalivePosInterval = null;
  _keepaliveAudio?.pause();
}
import {
  getTransitionRamRequirementsMb,
  MIX_TRANSITION_MODE_LABELS,
  MIX_TRANSITION_MODES,
} from './lib/transitionModes.js';
import { AutoFadeManager } from './lib/autoFadeManager.js';
import {
  createAudioSourceManager,
  getDirectPlayableSourceUrl,
} from './lib/audioSourceManager.js';
import { createDownloaderConfigManager } from './lib/downloaderConfig.js';
import {
  createLogger,
  isDebugLoggingEnabled,
  setDebugLoggingEnabled,
} from './lib/logger.js';
import { createMixControls } from './lib/mixControls.js';
import { createDjFxController } from './lib/djFxController.js';
import { createPlaylistManager } from './lib/playlistManager.js';
import { createFilRougeManager } from './lib/filRougeManager.js';
import { restoreQueueFromStorage, saveQueueToStorage } from './lib/queueStorage.js';
import { createShellUi } from './lib/shellUi.js';
import { createDjMixRenderer, renderDjSetQualityBadge, renderDjTransitionFeedback } from './lib/uiRenderer.js';
import { createAutoModeManager } from './lib/autoModeManager.js';
import { createDjApiClient } from './lib/djApiClient.js';
import { createDjPlanManager } from './lib/djPlanManager.js';
import { computeDjBpmRate } from './lib/djTransitionMapping.js';
import { computeDjPlanIndicatorState } from './lib/djPlanIndicator.js';
import { createAppState } from './lib/appState.js';
import {
  AUTO_DJ_FX_TYPES,
  canTriggerAutoDjFx,
  createDefaultAutoDjFxAllowed,
  getAutoDjFxMaxGapMs,
  getAutoDjFxStatusText,
  getSafeAutoDjFxMinIntervalSec,
  normalizeAutoDjFxIntervalSettings,
  persistAutoDjFxSettings,
  readAutoDjFxSettings,
} from './lib/autoDjFxManager.js';
import {
  markAutomixTriggered,
  resetAutomixTimeline,
  setAutomixTriggerMs,
  shouldTriggerAutomix,
} from './lib/automixTimeline.js';
import { getOtherDeck, toDeck } from './lib/deckHelpers.js';
import { computeTransitionRamProfile, estimateTotalDeviceRamMb, isMobileDevice } from './lib/ramProfile.js';
import { attachQueueDndHandlers, clearQueueDragMarkers } from './lib/queueDnD.js';
import {
  buildSearchResultsSectionsHTML,
  escHtml,
  extractAudioFeatures,
  extractStemSourceUrls,
  extractTrackBpm,
  extractTrackGenre,
  extractTrackLoudnessDb,
  getBestArtworkUrl,
  getTrackDurationMs,
  mapApiTrackToSearchItem,
  normalizeApiSearchResponse,
  sortSearchResultsByPopularity,
} from './lib/searchUtils.js';
import {
  persistAutoSuggestionQueueSearchEnabledSetting,
  persistCrossfadeSecondsSetting,
  persistDebugLogsSetting,
  persistFxControlsHiddenSetting,
  persistQueueLoopSetting,
  persistQueueShuffleSetting,
  persistRamFilterEnabledSetting,
  persistRamTotalMbOverrideSetting,
  persistTrackMaxDurationEnabledSetting,
  persistTrackMaxDurationSetting,
  persistTrackMaxDurationModeSetting,
  persistTrackMaxDurationPctSetting,
  persistTransitionModeSetting,
  readAutoSuggestionQueueSearchEnabledSetting,
  readCrossfadeSecondsSetting,
  readDebugLogsSetting,
  readFxControlsHiddenSetting,
  readQueueLoopSetting,
  readQueueShuffleSetting,
  readRamFilterEnabledSetting,
  readRamTotalMbOverrideSetting,
  readTrackMaxDurationEnabledSetting,
  readTrackMaxDurationSetting,
  readTrackMaxDurationModeSetting,
  readTrackMaxDurationPctSetting,
  readTransitionModeSetting,
  removeQueueSetting,
  readDjModeSetting,
  persistDjModeSetting,
  readDjModeGenrePrefs,
  persistDjModeGenrePrefs,
  readDjExternalPlanEnabledSetting,
  persistDjExternalPlanEnabledSetting,
} from './lib/settingsStorage.js';
import { DEFAULT_DOWNLOADER_API_URL, STORAGE_KEYS } from './lib/storageKeys.js';
import { getStoredTrackMeta, patchStoredTrackMeta } from './lib/trackMetaStorage.js';
import { DANCE_GENRE_DEFAULTS } from './lib/danceGenreConfig.js';
import { DJ_MODES } from './lib/djModeConfig.js';
import { createApiHealthMonitor } from './lib/apiHealthMonitor.js';
import { isLowMemoryPlaybackDevice } from './lib/playbackMemoryPolicy.js';
import { createSpotifyClient } from './lib/spotifyClient.js';
import { createSettingsController } from './lib/settingsController.js';
import { createQueueManager } from './lib/queueManager.js';
import { createFilRougeController } from './lib/filRougeController.js';
import { createFilRougeDownloader } from './lib/filRougeDownloader.js';
import { createDeckMarkerController } from './lib/deckMarkerController.js';
import { createPlaybackController } from './lib/playbackController.js';

import { uiState } from './lib/uiState.js';
const QUEUE_KEY = STORAGE_KEYS.queue;
const DOWNLOADER_API_URL_KEY = STORAGE_KEYS.downloaderApiUrl;
const DOWNLOADER_API_TOKEN_KEY = STORAGE_KEYS.downloaderApiToken;
const AUDIO_CACHE_NAME = 'dj-mix:audio-cache:v1';
const SPOTIFY_FIL_ROUGE_POLL_MS = 120000;
const SPOTIFY_FIL_ROUGE_BACKOFF_MAX_MULTIPLIER = 32;

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
const appState = createAppState();

/** @type {Array<QueueItem>} */
const queue = uiState.queue; // alias → uiState.queue
let pendingAutoplay = false;
let playlistLoaded = false;
let blobCleanupTimer = null;
let metricsLogTimer = null;
let playbackPositionMs = 0;
let playbackDurationMs = 0;
let automixRescheduledForTrackId = null;
let lastSearchQuery = '';
let pendingSearchAdd = false;
let searchDebounceTimer = null;
let currentSearchPollToken = null;
let launchPreviewActive = false;
let launchPreviewArtUrl = '';
let launchPreviewTitle = '';
let launchPreviewArtist = '';
let launchPreviewDeck = null;
let launchPreviewItem = null;
let manualMixLock = false;
let autoSuggestionRefreshInProgress = false;
const deckMixDataByTrackId = new Map();
let spotifySyncTimer = null;
let spotifySyncInFlight = false;
let spotifySyncBackoffAttempts = 0;
let spotifyPrefetchGeneration = 0;

const spotifyClient = createSpotifyClient();

// Auto DJ timing
const automixTimeline = appState.automixTimeline;

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
    A: { vocalRemove: false, instruRemove: false, filterMode: 'off' },
    B: { vocalRemove: false, instruRemove: false, filterMode: 'off' },
  },
};
let fxControlsHidden = false;
const deckDisplayItems = uiState.deckDisplayItems; // alias → uiState.deckDisplayItems
let selectedTransitionMode = readTransitionModeSetting(MIX_TRANSITION_MODES);
let ramFilterEnabled = readRamFilterEnabledSetting();
let ramTotalMbOverride = readRamTotalMbOverrideSetting();
let allowedTransitionModes = [...MIX_TRANSITION_MODES];
let transitionRamRequirementsMb = getTransitionRamRequirementsMb();
let transitionRamCapability = null;
let trackMaxDurationSec = readTrackMaxDurationSetting();
let trackMaxDurationEnabled = readTrackMaxDurationEnabledSetting(trackMaxDurationSec > 0);
let trackMaxDurationAppliedSec = trackMaxDurationEnabled ? trackMaxDurationSec : 0;
let lastTrackMaxDurationSec = trackMaxDurationSec > 0 ? trackMaxDurationSec : 120;
let trackMaxDurationMode = readTrackMaxDurationModeSetting();
let trackMaxDurationPct = readTrackMaxDurationPctSetting();
/** True once the maxdur marker has fired automix for the current track (prevents double-trigger). */
let maxDurMarkerTriggeredForTrack = false;
let autoDjFxSettings = readAutoDjFxSettings();
let lastAutoDjFxTriggeredAt = 0;
let djMode = readDjModeSetting(); // 'dance' | 'music'
let djExternalPlanEnabled = readDjExternalPlanEnabledSetting();
let djModeGenrePrefs = readDjModeGenrePrefs(); // string[]
let autoSuggestionQueueSearchEnabled = readAutoSuggestionQueueSearchEnabledSetting();
let queueLoopEnabled = readQueueLoopSetting();
let queueShuffleEnabled = readQueueShuffleSetting();

/** Morceau fil rouge préchargé sur le deck inactif via peek (non encore consommé par getNextTrack).
 * Null si aucun ghost en attente. */
let pendingFilRougeOnInactiveDeck = null;

function isAutoDjFxTypeAllowed(type) {
  if (!type) return false;
  if (!Object.prototype.hasOwnProperty.call(autoDjFxSettings.allowed || {}, type)) return true;
  return Boolean(autoDjFxSettings.allowed[type]);
}

function updateAutoDjFxConfigUI() {
  const intervals = normalizeAutoDjFxIntervalSettings(
    autoDjFxSettings.minIntervalSec,
    autoDjFxSettings.maxIntervalSec,
  );
  autoDjFxSettings = {
    ...autoDjFxSettings,
    enabled: autoDjFxSettings.enabled !== false,
    minIntervalSec: intervals.minIntervalSec,
    maxIntervalSec: intervals.maxIntervalSec,
  };

  if (autoDjFxMinIntervalInput) {
    autoDjFxMinIntervalInput.value = String(intervals.minIntervalSec);
    autoDjFxMinIntervalInput.disabled = autoDjFxSettings.enabled === false;
  }
  if (autoDjFxMaxIntervalInput) {
    autoDjFxMaxIntervalInput.value = String(intervals.maxIntervalSec);
    autoDjFxMaxIntervalInput.disabled = autoDjFxSettings.enabled === false;
  }

  for (const toggleEl of autoDjFxToggleEls) {
    const type = String(toggleEl.dataset.autoFxType || '');
    toggleEl.checked = isAutoDjFxTypeAllowed(type);
    toggleEl.disabled = autoDjFxSettings.enabled === false;
  }

  if (autoDjFxEnabledBtn) {
    const enabled = autoDjFxSettings.enabled !== false;
    autoDjFxEnabledBtn.classList.toggle('is-enabled', enabled);
    autoDjFxEnabledBtn.textContent = `AutoFX: ${enabled ? 'ON' : 'OFF'}`;
    autoDjFxEnabledBtn.setAttribute('aria-pressed', String(enabled));
    autoDjFxEnabledBtn.setAttribute('aria-label', `Auto FX ${enabled ? 'actif' : 'inactif'}`);
  }

  if (autoDjFxStatus) {
    autoDjFxStatus.textContent = getAutoDjFxStatusText(autoDjFxSettings);
  }
}

// --- DJ Mode helpers ---

function getActiveDeckBpm() {
  const activeDeck = automixTimeline?.currentPlayingDeck || 'A';
  const item = deckDisplayItems[activeDeck];
  const bpm = Number(extractTrackBpm(item));
  return Number.isFinite(bpm) && bpm > 0 ? bpm : null;
}

function getActiveDeckGenre() {
  const activeDeck = automixTimeline?.currentPlayingDeck || 'A';
  const item = deckDisplayItems[activeDeck];
  const genre = extractTrackGenre(item);
  return genre || null;
}

/**
 * Apply FX interval & allowed presets based on the selected DJ mode and current BPM.
 * Does not persist — caller must call persistAutoDjFxSettings() if desired.
 */
function applyDjModeFxPreset(mode, currentBpm) {
  const disabledInMusicLow = ['brake', 'backspin', 'scratching', 'roll'];
  const disabledInMusicNormal = ['brake', 'backspin'];
  const allowed = { ...createDefaultAutoDjFxAllowed() };

  let minIntervalSec;
  let maxIntervalSec;

  if (mode === 'dance') {
    minIntervalSec = 8;
    maxIntervalSec = 20;
    // all FX active
  } else {
    const bpm = Number.isFinite(currentBpm) ? currentBpm : 90;
    if (bpm < 90) {
      minIntervalSec = 40;
      maxIntervalSec = 120;
      for (const type of disabledInMusicLow) allowed[type] = false;
    } else {
      minIntervalSec = 20;
      maxIntervalSec = 60;
      for (const type of disabledInMusicNormal) allowed[type] = false;
    }
  }

  autoDjFxSettings = {
    ...autoDjFxSettings,
    minIntervalSec,
    maxIntervalSec,
    allowed,
  };
  persistAutoDjFxSettings(autoDjFxSettings);
  updateAutoDjFxConfigUI();
}

function computeTransitionRamRequirements() {
  const crossfadeSeconds = clampCrossfadeSeconds(
    crossfadeSlider?.value || readCrossfadeSecondsSetting(6),
  );
  transitionRamRequirementsMb = getTransitionRamRequirementsMb({
    crossfadeDurationMs: crossfadeSeconds * 1000,
  });
}

function getSafeAllowedTransitionMode(mode) {
  const normalized = MIX_TRANSITION_MODES.includes(mode) ? mode : 'auto';
  const allowedSet = new Set(allowedTransitionModes);
  if (allowedSet.has(normalized)) return normalized;
  if (allowedSet.has('auto')) return 'auto';
  return allowedTransitionModes[0] || 'cut_transition';
}

function updateTransitionModeAvailabilityUI() {
  if (!mixTransitionModeSelect) return;
  const allowedSet = new Set(allowedTransitionModes);

  for (const option of mixTransitionModeSelect.options) {
    const mode = String(option.value || '');
    const label = MIX_TRANSITION_MODE_LABELS[mode] || mode;
    const ramMb = Number(transitionRamRequirementsMb?.[mode]) || 0;
    const ramSuffix = mode === 'auto' ? '' : ` (~${Math.round(ramMb)} Mo RAM)`;
    const enabled = allowedSet.has(mode);

    option.disabled = !enabled;
    option.textContent = enabled
      ? `${label}${ramSuffix}`
      : `${label}${ramSuffix} [desactive]`;
  }

  const safeCurrent = getSafeAllowedTransitionMode(mixTransitionModeSelect.value || selectedTransitionMode);
  mixTransitionModeSelect.value = safeCurrent;
}

function applyTransitionCapabilitiesForDevice(options = {}) {
  const { announce = false } = options;
  computeTransitionRamRequirements();

  const profile = computeTransitionRamProfile({
    ramFilterEnabled,
    ramTotalMbOverride,
    crossfadeDurationMs: clampCrossfadeSeconds(crossfadeSlider?.value || readCrossfadeSecondsSetting(6)) * 1000,
  });
  allowedTransitionModes = profile.allowedTransitionModes;
  transitionRamCapability = profile.capability;
  const disabledModes = transitionRamCapability?.disabledModes || [];
  const totalRamMb = transitionRamCapability?.totalRamMb || 0;
  const transitionBudgetMb = transitionRamCapability?.transitionBudgetMb || 0;

  updateTransitionModeAvailabilityUI();

  logInfo('transition.ram.capability', {
    mobile: transitionRamCapability?.mobile || false,
    totalRamMb,
    transitionBudgetMb,
    disabledModes,
  });

  if (announce && disabledModes.length > 0) {
    showToast(`Transitions limitees (RAM mobile: ${Math.round(totalRamMb / 1024)} Go)`);
  }
}

function isLowMemoryPlaybackMode() {
  return isLowMemoryPlaybackDevice({
    enabled: true,
    mobile: isMobileDevice(),
    totalRamMb: ramTotalMbOverride > 0 ? ramTotalMbOverride : estimateTotalDeviceRamMb(),
  });
}

function trimRetainedAudioSources() {
  if (!isLowMemoryPlaybackMode()) return;
  let trimmedCount = 0;
  for (const item of queue) {
    if (!item) continue;
    if (deckDisplayItems.A === item || deckDisplayItems.B === item || launchPreviewItem === item) continue;
    if (evictTrackSource(item, { notify: false })) {
      trimmedCount += 1;
    }
  }
  if (trimmedCount > 0) {
    renderQueue();
    logInfo('memory.trim.lowRam', { trimmedCount, queueLength: queue.length });
  }
}

function updateRamFilterConfigUI() {
  if (ramFilterEnabledToggle) {
    ramFilterEnabledToggle.checked = ramFilterEnabled;
  }

  if (ramTotalMemoryInput) {
    const effectiveGb = ramTotalMbOverride > 0
      ? Math.max(0.5, Math.round((ramTotalMbOverride / 1024) * 10) / 10)
      : 0;
    if (document.activeElement !== ramTotalMemoryInput) {
      ramTotalMemoryInput.value = String(effectiveGb);
    }
  }

  if (ramFilterStatus) {
    if (!ramFilterEnabled) {
      ramFilterStatus.textContent = 'Filtre RAM inactif: toutes les transitions sont disponibles.';
    } else if (transitionRamCapability?.enabled) {
      const totalGb = Math.round(((transitionRamCapability.totalRamMb || 0) / 1024) * 10) / 10;
      const budgetMb = transitionRamCapability.transitionBudgetMb || 0;
      const disabled = transitionRamCapability.disabledModes?.length || 0;
      const suffix = ramTotalMbOverride > 0 ? ' (valeur manuelle)' : '';
      ramFilterStatus.textContent = `RAM ${totalGb} Go${suffix} - budget transitions ${budgetMb} Mo - ${disabled} mode(s) desactive(s).`;
    } else {
      ramFilterStatus.textContent = 'Filtre RAM actif mais non applique sur cet appareil sans valeur manuelle.';
    }
  }
}

function updateQueueModeConfigUI() {
  if (queueLoopToggle) queueLoopToggle.checked = queueLoopEnabled;
  if (queueShuffleToggle) queueShuffleToggle.checked = queueShuffleEnabled;
}

function applyRamFilterSettings(options = {}) {
  const { persist = true, announce = false } = options;
  if (persist) {
    persistRamFilterEnabledSetting(ramFilterEnabled);
    persistRamTotalMbOverrideSetting(ramTotalMbOverride);
  }

  applyTransitionCapabilitiesForDevice({ announce });
  updateRamFilterConfigUI();

  if (player) {
    player.setAllowedTransitionModes(allowedTransitionModes);
  }

  const safeMode = getSafeAllowedTransitionMode(selectedTransitionMode);
  if (safeMode !== selectedTransitionMode) {
    applyTransitionModeSetting(safeMode, { persist: true });
    showToast(`Mode AutoMix ajuste (RAM): ${MIX_TRANSITION_MODE_LABELS[safeMode] || safeMode}`);
  }

  trimRetainedAudioSources();
}

function applyTransitionModeSetting(mode, options = {}) {
  const { persist = true } = options;
  const safeMode = getSafeAllowedTransitionMode(mode);
  selectedTransitionMode = safeMode;
  if (mixTransitionModeSelect) {
    mixTransitionModeSelect.value = safeMode;
  }
  player?.setTransitionMode(safeMode);
  if (persist) persistTransitionModeSetting(safeMode);
  updateDjFxMenuUI();
}

function recalculateAutomixTimingIfNeeded(logEvent = 'autoDj: recalculating automix timing') {
  // If auto mode is enabled and a track is playing, recalculate timing
  if (autoModeManager.isAutoModeEnabled() && uiState.currentIndex >= 0 && queue[uiState.currentIndex]) {
    const currentItem = queue[uiState.currentIndex];
    const intervals = normalizeAutoDjFxIntervalSettings(
      autoDjFxSettings.minIntervalSec,
      autoDjFxSettings.maxIntervalSec,
    );
    logDebug(logEvent, {
      trackName: currentItem.name,
      newMaxDurationSec: trackMaxDurationSec,
      autoFxMinIntervalSec: intervals.minIntervalSec,
      autoFxMaxIntervalSec: intervals.maxIntervalSec,
    });
    autoModeManager.scheduleAutomixTiming(currentItem);
  }
}

function applyTrackMaxDurationForCurrentPlayback() {
  if (!trackMaxDurationEnabled) {
    trackMaxDurationAppliedSec = 0;
    return;
  }
  if (trackMaxDurationMode === 'pct') {
    // Pct mode: real value computed in updateMaxDurationMarker (has mixData).
    // Set a non-zero sentinel so downstream code knows max-duration is active.
    // updateMaxDurationMarker will override with the true snapped value.
    if (trackMaxDurationAppliedSec <= 0) trackMaxDurationAppliedSec = 1;
  } else {
    trackMaxDurationAppliedSec = trackMaxDurationSec;
  }
}

/**
 * Compute the effective max-duration target (in seconds, absolute file time)
 * from the current pct setting and the track's mix data, excluding intro and outro.
 * Returns 0 if insufficient data.
 * @param {object|null} mixData
 * @param {number} durationMs  — track duration in milliseconds
 * @returns {number}
 */
function computePctMaxDurationSec(mixData, durationMs) {
  const durationSec = durationMs / 1000;
  if (durationSec <= 0) return 0;

  const introEndSec = Number(mixData?.probableSongStartSec) || 0;
  const outroZones = Array.isArray(mixData?.outroZones) ? mixData.outroZones : [];
  const outroStartSec = outroZones.length > 0
    ? Math.min(...outroZones.map((z) => Number(z.startSec)))
    : durationSec;

  const effectiveDuration = Math.max(0, outroStartSec - introEndSec);
  return introEndSec + effectiveDuration * trackMaxDurationPct / 100;
}

function updateTrackMaxDurationUI() {
  const isPct = trackMaxDurationMode === 'pct';

  if (trackMaxDurationModeBtn) {
    trackMaxDurationModeBtn.textContent = isPct ? '%' : 'sec';
    trackMaxDurationModeBtn.title = isPct
      ? 'Mode pourcentage — cliquer pour passer en secondes fixes'
      : 'Mode secondes fixes — cliquer pour passer en pourcentage (hors intro/outro)';
  }
  if (trackMaxDurationSecRow) {
    trackMaxDurationSecRow.style.display = isPct ? 'none' : 'flex';
  }
  if (trackMaxDurationPctRow) {
    trackMaxDurationPctRow.style.display = isPct ? 'flex' : 'none';
  }

  if (trackMaxDurationInput) {
    trackMaxDurationInput.value = String(trackMaxDurationSec);
  }
  if (trackMaxDurationPctInput) {
    trackMaxDurationPctInput.value = String(trackMaxDurationPct);
  }
  if (trackMaxDurationMinus) {
    trackMaxDurationMinus.disabled = false;
  }
  if (trackMaxDurationPlus) {
    trackMaxDurationPlus.disabled = false;
  }
  if (trackMaxDurationToggle) {
    trackMaxDurationToggle.textContent = trackMaxDurationEnabled ? 'Durée max: ON' : 'Durée max: OFF';
    trackMaxDurationToggle.setAttribute('aria-pressed', String(trackMaxDurationEnabled));
  }
}

function applyTrackMaxDurationSetting(nextValue, logEvent) {
  const value = Math.max(0, Math.min(600, Number.parseInt(String(nextValue || '0'), 10) || 0));
  trackMaxDurationSec = value;
  if (value > 0) {
    lastTrackMaxDurationSec = value;
  }
  applyTrackMaxDurationForCurrentPlayback();
  persistTrackMaxDurationSetting(value);
  updateTrackMaxDurationUI();

  const msg = value > 0 ? `Durée max: ${value}s` : 'Durée max: désactivée';
  showToast(msg);
  logDebug(logEvent || 'trackMaxDuration: setting changed', { value });

  // Keep trigger and marker aligned with zone-aware automix timing.
  recalculateAutomixTimingIfNeeded('trackMaxDuration: recalculating automix timing');
  updateMaxDurationMarker();
}

function applyTrackMaxDurationPctSetting(nextValue, logEvent) {
  const value = Math.max(5, Math.min(95, Number.parseInt(String(nextValue || '50'), 10) || 50));
  trackMaxDurationPct = value;
  persistTrackMaxDurationPctSetting(value);
  updateTrackMaxDurationUI();
  showToast(`Durée max: ${value}%`);
  logDebug(logEvent || 'trackMaxDuration: pct setting changed', { value });
  recalculateAutomixTimingIfNeeded('trackMaxDuration: recalculating automix timing');
  updateMaxDurationMarker();
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
const searchIcon = document.querySelector('.search-icon');

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
const deckAProgressZones = document.getElementById('deck-a-zone-layer');
const deckBProgressZones = document.getElementById('deck-b-zone-layer');
const deckAFill = document.getElementById('deck-a-fill');
const deckBFill = document.getElementById('deck-b-fill');
const trackArtistB = document.getElementById('track-artist-b');
const deckATitle = document.getElementById('deck-a-title');
const deckBTitle = document.getElementById('deck-b-title');
const deckABpm = document.getElementById('deck-a-bpm');
const deckBBpm = document.getElementById('deck-b-bpm');
const deckABpmReset = document.getElementById('deck-a-bpm-reset');
const deckBBpmReset = document.getElementById('deck-b-bpm-reset');
const deckALaunchBtn = document.getElementById('deck-a-launch');
const deckBLaunchBtn = document.getElementById('deck-b-launch');
const deckAChangeSuggestionBtn = document.getElementById('deck-a-change-suggestion-btn');
const deckBChangeSuggestionBtn = document.getElementById('deck-b-change-suggestion-btn');
const deckMixSlider = document.getElementById('deck-mix-slider');
const deckMixLabel = document.getElementById('deck-mix-label');
const deckBCueLabel = document.getElementById('deck-b-cue-label');
const mixTransitionModeSelect = document.getElementById('mix-transition-mode');
const trackMaxDurationInput = document.getElementById('track-max-duration');
const trackMaxDurationMinus = document.getElementById('track-max-duration-minus');
const trackMaxDurationPlus = document.getElementById('track-max-duration-plus');
const trackMaxDurationModeBtn = document.getElementById('track-max-duration-mode-btn');
const trackMaxDurationPctInput = document.getElementById('track-max-duration-pct');
const trackMaxDurationPctMinus = document.getElementById('track-max-duration-pct-minus');
const trackMaxDurationPctPlus = document.getElementById('track-max-duration-pct-plus');
const trackMaxDurationSecRow = document.getElementById('track-max-duration-sec-row');
const trackMaxDurationPctRow = document.getElementById('track-max-duration-pct-row');
const mixModeRow = document.querySelector('.mix-mode-row');
const manualLockBtn = document.getElementById('manual-lock-btn');
const fxVisibilityBtn = document.getElementById('fx-visibility-btn');
const deckFxActions = document.querySelector('.deck-fx-actions');
const crossfadeControlMix = document.querySelector('.crossfade-control--mix');
const autoBpmBtn = document.getElementById('fx-auto-bpm-btn');
const echoBtn = document.getElementById('fx-echo-btn');
const distortionBtn = document.getElementById('fx-distortion-btn');
const trackMaxDurationToggle = document.getElementById('track-max-duration-toggle');
const djFxMenu = document.getElementById('dj-fx-menu');
const djFxButtons = Array.from(djFxMenu?.querySelectorAll('[data-fx-action]') || []);
const autoModeBtn = document.getElementById('auto-mode-btn');
const autoDjNextFxCountdown = document.getElementById('autodj-next-fx-countdown');
const deckALowPassBtn = document.getElementById('deck-a-lowpass-btn');
const deckAHighPassBtn = document.getElementById('deck-a-highpass-btn');
const deckBLowPassBtn = document.getElementById('deck-b-lowpass-btn');
const deckBHighPassBtn = document.getElementById('deck-b-highpass-btn');
const deckAstemsIndicator = document.getElementById('deck-a-stems-indicator');
const deckBstemsIndicator = document.getElementById('deck-b-stems-indicator');
const autoMixBtn = document.getElementById('automix-btn');
const deckAAutoDjMarker = document.getElementById('deck-a-autodj-marker');
const deckBAutoDjMarker = document.getElementById('deck-b-autodj-marker');
const deckAAutoDjStartMarker = document.getElementById('deck-a-autodj-start-marker');
const deckBAutoDjStartMarker = document.getElementById('deck-b-autodj-start-marker');
const deckADjPlanZone = document.getElementById('deck-a-dj-plan-zone');
const deckBDjPlanZone = document.getElementById('deck-b-dj-plan-zone');
const deckAMaxDurMarker = document.getElementById('deck-a-maxdur-marker');
const deckBMaxDurMarker = document.getElementById('deck-b-maxdur-marker');
const deckAMaxDurRawMarker = document.getElementById('deck-a-maxdur-raw-marker');
const deckBMaxDurRawMarker = document.getElementById('deck-b-maxdur-raw-marker');
const deckAZoneLayer = document.getElementById('deck-a-zone-layer');
const deckBZoneLayer = document.getElementById('deck-b-zone-layer');
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
const cacheFilterCountEl = document.getElementById('cache-filter-count');
const cacheGenreFilterEl = document.getElementById('cache-genre-filter');
const cacheGenreFilterFieldEl = cacheGenreFilterEl?.closest('.cache-filter-field') || null;
const cacheYearFilterEl = document.getElementById('cache-year-filter');
const cacheStemsFilterEl = document.getElementById('cache-stems-filter');
const cacheResetFiltersBtn = document.getElementById('cache-reset-filters');

const filRougeCountEl = document.getElementById('filrouge-count');
const filRougePriorityCountEl = document.getElementById('filrouge-priority-count');
const filRougePlaylistListEl = document.getElementById('filrouge-playlist-list');
const filRougePriorityListEl = document.getElementById('filrouge-priority-list');
const filRougeShuffleBtn = document.getElementById('filrouge-shuffle-btn');
const filRougeLoopBtn = document.getElementById('filrouge-loop-btn');
const djExternalPlanBtn = document.getElementById('dj-external-plan-btn');
const djPlanIndicatorEl = document.getElementById('dj-plan-indicator');
const filRougeClearBtn = document.getElementById('filrouge-clear-btn');
const djSetQualityBadgeEl = document.getElementById('dj-set-quality-badge');
const djSetProfileSelectEl = document.getElementById('dj-set-profile-select');
const djRecalculateBtn = document.getElementById('dj-recalculate-btn');
const filRougeDownloadAllBtn = document.getElementById('filrouge-download-all-btn');

const downloaderApiUrlInput = document.getElementById('downloader-api-url-input');
const downloaderApiTokenInput = document.getElementById('downloader-api-token-input');
const downloaderApiSaveBtn = document.getElementById('downloader-api-save-btn');
const downloaderApiTestBtn = document.getElementById('downloader-api-test-btn');
const downloaderApiStatus = document.getElementById('downloader-api-status');
const spotifyClientIdInput = document.getElementById('spotify-client-id-input');
const spotifyConnectBtn = document.getElementById('spotify-connect-btn');
const spotifyDisconnectBtn = document.getElementById('spotify-disconnect-btn');
const spotifyPlaylistInput = document.getElementById('spotify-playlist-input');
const spotifyPlaylistSelect = document.getElementById('spotify-playlist-select');
const spotifyImportFilRougeBtn = document.getElementById('spotify-import-filrouge-btn');
const spotifyStatus = document.getElementById('spotify-status');
const spotifyConnectionBadge = document.getElementById('spotify-connection-badge');
const txtPlaylistFileInput = document.getElementById('txt-playlist-file-input');
const txtPlaylistTextarea = document.getElementById('txt-playlist-textarea');
const txtImportFilRougeBtn = document.getElementById('txt-import-filrouge-btn');
const txtPlaylistStatus = document.getElementById('txt-playlist-status');
const apiMixPlaylistSelect = document.getElementById('api-mix-playlist-select');
const apiMixPlaylistRefreshBtn = document.getElementById('api-mix-playlist-refresh-btn');
const apiMixPlaylistLoadBtn = document.getElementById('api-mix-playlist-load-btn');
const apiMixPlaylistStatus = document.getElementById('api-mix-playlist-status');
const debugLogsToggle = document.getElementById('debug-logs-toggle');
const autoSuggestionQueueSearchToggle = document.getElementById('auto-suggestion-queue-search-toggle');
const configDjModeDanceBtn = document.getElementById('config-dj-mode-dance-btn');
const configDjModeMusicBtn = document.getElementById('config-dj-mode-music-btn');
const configDanceGenrePrefs = document.getElementById('config-dance-genre-prefs');
const configDanceGenreList = document.getElementById('config-dance-genre-list');
const debugLogsStatus = document.getElementById('debug-logs-status');
const autoSuggestionQueueSearchStatus = document.getElementById('auto-suggestion-queue-search-status');
const ramFilterEnabledToggle = document.getElementById('ram-filter-enabled-toggle');
const ramTotalMemoryInput = document.getElementById('ram-total-memory-gb');
const ramFilterStatus = document.getElementById('ram-filter-status');
const queueLoopToggle = document.getElementById('queue-loop-toggle');
const queueShuffleToggle = document.getElementById('queue-shuffle-toggle');
const djFxRow = document.querySelector('.dj-fx-row');
const autoDjFxStatus = document.getElementById('auto-dj-fx-status');
const autoDjFxMinIntervalInput = document.getElementById('auto-dj-fx-min-interval-input');
const autoDjFxMaxIntervalInput = document.getElementById('auto-dj-fx-max-interval-input');
const autoDjFxEnabledBtn = document.getElementById('auto-dj-fx-enabled-btn');
const autoDjFxToggleEls = Array.from(document.querySelectorAll('[data-auto-fx-type]'));

const tabBtns = document.querySelectorAll('.tab-bar-btn');
const tabPanels = {
  mix: document.getElementById('tab-mix'),
  filrouge: document.getElementById('tab-filrouge'),
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

function syncAutoModeButtonUI(isEnabled) {
  if (!autoModeBtn) return;
  autoModeBtn.setAttribute('aria-pressed', String(isEnabled));
  autoModeBtn.classList.toggle('is-enabled', isEnabled);
  autoModeBtn.textContent = '🤖';
  autoModeBtn.title = `AutoDJ ${isEnabled ? 'actif' : 'inactif'}: recherche et ajoute automatiquement les chansons suivantes`;
  autoModeBtn.setAttribute('aria-label', `AutoDJ ${isEnabled ? 'actif' : 'inactif'}`);
}

const apiOfflineBadge = document.getElementById('api-offline-badge');

function setApiOfflineBadgeVisible(visible) {
  if (!apiOfflineBadge) return;
  apiOfflineBadge.hidden = !visible;
}

const downloaderConfig = createDownloaderConfigManager({
  defaultUrl: DEFAULT_DOWNLOADER_API_URL,
  inputEl: downloaderApiUrlInput,
  saveBtn: downloaderApiSaveBtn,
  statusEl: downloaderApiStatus,
  storageKey: DOWNLOADER_API_URL_KEY,
  testBtn: downloaderApiTestBtn,
  tokenInputEl: downloaderApiTokenInput,
  tokenStorageKey: DOWNLOADER_API_TOKEN_KEY,
});
const {
  getDownloaderApiToken,
  getDownloaderApiUrl,
  loadIntoForm: loadDownloaderApiConfigIntoForm,
  saveFromForm: saveDownloaderApiConfigFromForm,
  setStatus: setDownloaderApiStatus,
  setupEvents: setupDownloaderApiConfigEvents,
} = downloaderConfig;

const apiHealthMonitor = createApiHealthMonitor({
  getDownloaderApiToken,
  getDownloaderApiUrl,
  onOffline: () => {
    logWarn('api.health.offline', {});
    setApiOfflineBadgeVisible(true);
    showToast('API hors ligne – mode local uniquement', true);
  },
  onOnline: () => {
    logInfo('api.health.online', {});
    setApiOfflineBadgeVisible(false);
    showToast('API de retour en ligne ✓', false);
  },
});

const mixControls = createMixControls({
  autoBpmBtn,
  crossfadeControlMix,
  djFxMenu,
  djFxRow,
  mixModeRow,
  deckAPanel,
  deckBPanel,
  deckFxActions,
  deckScopedFxButtons: {
    A: { lowPassBtn: deckALowPassBtn, highPassBtn: deckAHighPassBtn },
    B: { lowPassBtn: deckBLowPassBtn, highPassBtn: deckBHighPassBtn },
  },
  deckMixLabel,
  deckMixSlider,
  distortionBtn,
  echoBtn,
  fxVisibilityBtn,
  getDeckBCueIndex: () => uiState.deckBCueIndex,
  getDeckCueDeck: () => uiState.deckCueDeck,
  getDeckDisplayItems: () => deckDisplayItems,
  getDeckMixRatio: () => uiState.deckMixRatio,
  getFxControlsHidden: () => fxControlsHidden,
  getManualMixLock: () => manualMixLock,
  getMixFeatures: () => mixFeatures,
  getPlayer: () => player,
  getQueueLength: () => queue.length,
  manualLockBtn,
  onFocusDeckChanged: () => {
    updateDeckCueUI();
  },
  setDeckCueDeck: (value) => {
    uiState.deckCueDeck = value === 'B' ? 'B' : 'A';
  },
  setDeckMixRatio: (value) => {
    uiState.deckMixRatio = value;
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

const djFxController = createDjFxController({
  applyMixFeatures,
  applyTransitionModeSetting,
  djFxButtons,
  getAutomixCurrentPlayingDeck: () => automixTimeline.currentPlayingDeck,
  getCurrentIndex: () => uiState.currentIndex,
  getCurrentTrackMixData: () => autoModeManager.getCurrentTrackMixData?.(),
  getDeckDisplayItems: () => deckDisplayItems,
  getDeckMixRatio: () => uiState.deckMixRatio,
  getMixFeatures: () => mixFeatures,
  getNextTrackMixData: () => autoModeManager.getNextTrackMixData?.(),
  getPlayer: () => player,
  getQueue: () => queue,
  getSelectedTransitionMode: () => selectedTransitionMode,
  getTrackMixData,
  setMixFeatureEnabled,
  setMixFeatures: (value) => {
    mixFeatures = value;
  },
  showToast,
  transitionModeLabels: MIX_TRANSITION_MODE_LABELS,
});

const {
  applyAutoDjCreativeFx,
  handleDjFxAction,
  resetRuntimeState: resetDjFxRuntime,
  updateDjFxMenuUI,
} = djFxController;

// ── Background task scheduling utilities ──────────────────────────────────────
// Debounce: coalesce rapid-fire calls, executing only after the delay has elapsed
// without new invocations.
function createDebouncedFn(fn, delayMs) {
  let timer = null;
  const debounced = () => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; fn(); }, delayMs);
  };
  debounced.flush = () => { if (timer !== null) { clearTimeout(timer); timer = null; fn(); } };
  debounced.cancel = () => { if (timer !== null) { clearTimeout(timer); timer = null; } };
  return debounced;
}

// Schedule work during idle time (or after a short delay as fallback)
const scheduleIdle = typeof requestIdleCallback === 'function'
  ? (fn, timeout = 2000) => requestIdleCallback(fn, { timeout })
  : (fn) => setTimeout(fn, 80);

// Serialized background task queue: ensures only one heavy background task runs
// at a time to avoid saturating the network/CPU during playback.
const _bgTaskQueue = [];
let _bgTaskRunning = false;
function enqueueBackgroundTask(taskFn) {
  _bgTaskQueue.push(taskFn);
  _drainBackgroundTasks();
}
async function _drainBackgroundTasks() {
  if (_bgTaskRunning) return;
  _bgTaskRunning = true;
  while (_bgTaskQueue.length > 0) {
    const task = _bgTaskQueue.shift();
    try { await task(); } catch (_) { /* background tasks are best-effort */ }
  }
  _bgTaskRunning = false;
}

const saveQueue = () => {
  logDebug('saveQueue()', { currentIndex: uiState.currentIndex, length: queue.length });
  saveQueueToStorage({
    currentIndex: uiState.currentIndex,
    queue,
    storageKey: QUEUE_KEY,
  });
};

// Debounced version: avoids writing to localStorage on every rapid-fire renderQueue call.
const saveQueueDebounced = createDebouncedFn(saveQueue, 1500);

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

  uiState.currentIndex = restored.index;
  if (uiState.currentIndex >= queue.length) uiState.currentIndex = queue.length - 1;
  uiState.currentTrackId = queue[uiState.currentIndex]?.id ?? null;
  logInfo('restoreQueue(): queue restored', {
    currentIndex: uiState.currentIndex,
    length: queue.length,
    currentTrackId: uiState.currentTrackId,
  });
};

// Debounced renderQueue for background callbacks (stem enrichment, duration hydration, etc.)
// These fire rapidly and individually aren't urgent for UI — coalesce into one repaint.
const renderQueueDebounced = createDebouncedFn(() => renderQueue(), 300);
const renderFilRougeDebounced = createDebouncedFn(() => renderFilRouge(), 300);

const audioSourceManager = createAudioSourceManager({
  apiHealthMonitor,
  audioCacheName: AUDIO_CACHE_NAME,
  getDownloaderApiToken,
  getDownloaderApiUrl,
  normalizeApiSearchResponse,
  onQueueUpdated: () => renderQueueDebounced(),
  sessionBlobCache,
  shouldWarmStems: (item) => !isLowMemoryPlaybackMode() || deckDisplayItems.A === item || deckDisplayItems.B === item,
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
  deckATitle,
  deckAVol,
  deckBBpm,
  deckBBpmReset,
  deckBFill,
  deckBLaunchBtn,
  deckBPanel,
  deckBTitle,
  deckBVol,
  emptyQueue,
  getCurrentIndex: () => uiState.currentIndex,
  getCurrentTrackId: () => uiState.currentTrackId,
  getDeckBCueIndex: () => uiState.deckBCueIndex,
  getDeckCueDeck: () => uiState.deckCueDeck,
  getDeckDisplayItems: () => deckDisplayItems,
  getDeckMixRatio: () => uiState.deckMixRatio,
  getDjMode: () => djMode,
  getFocusDeck,
  getInactiveDeck,
  getIsPlaying: () => uiState.isPlaying,
  getLaunchPreviewState: () => ({
    active: launchPreviewActive,
    artUrl: launchPreviewArtUrl,
    artist: launchPreviewArtist,
    deck: launchPreviewDeck,
    item: launchPreviewItem,
    title: launchPreviewTitle,
  }),
  getPlayer: () => player,
  getPrevIsCrossfading: () => uiState.prevIsCrossfading,
  getQueue: () => queue,
  nextAlbumArt,
  nextArtPlaceholder,
  queueList,
  setDeckMixRatio: (value) => {
    uiState.deckMixRatio = value;
  },
  setPrevIsCrossfading: (value) => {
    uiState.prevIsCrossfading = value;
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
  evictTrackSource,
  isTrackInLocalCache,
  persistArtwork,
  pollSearchResults,
  prefetchTrackToLocalCache,
  releaseLocalBlob,
  restoreArtwork,
  searchTracksRaw,
  searchTracksViaApi,
} = audioSourceManager;

const playlistManager = createPlaylistManager({
  addToFilRouge: (file) => addToFilRouge(file),
  addToPriorityQueue: (file) => addToPriorityQueue(file),
  cacheFilterCountEl,
  cacheGenreFilterEl,
  cacheResetFiltersBtn,
  cacheStemsFilterEl,
  cacheYearFilterEl,
  deleteLocalCacheSong,
  escHtml,
  getCurrentIndex: () => uiState.currentIndex,
  getDownloaderApiToken,
  getDownloaderApiUrl,
  getPlayer: () => player,
  getPlaylistLoaded: () => playlistLoaded,
  getQueue: () => queue,
  playlistListEl,
  renderQueue,
  saveQueue,
  setCurrentIndex: (value) => {
    uiState.currentIndex = value;
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
        echoUrl: file.echoUrl || '',
        distortionUrl: file.distortionUrl || '',
      },
      cachePath: file.cachePath || '',
      downloadUrl: file.url || file.localUrl || file.streamUrl || '',
    });
  },
  tabBtns,
  tabPanels,
});

const { setCacheFilter, switchTab } = playlistManager;

const filRougeManager = createFilRougeManager();
const filRougeTrackStatusByKey = new Map();

// Tracks in-flight meta fetches to avoid duplicate API calls
const metaFetchInFlight = new Set();
// Tracks keys already queried via the API this session, even when no bpm/genre was
// found, so renderQueue/renderFilRouge re-renders don't keep re-spamming /api/search
// for tracks the API simply has no data for.
const metaFetchAttempted = new Set();

/**
 * Fetches BPM and/or genre for an item that is missing them.
 * Checks localStorage first, then falls back to the search API.
 * Mutates item in place and triggers a re-render when data is found.
 * @param {object} item
 */
async function fetchMissingMeta(item) {
  if (!item?.name) return;
  if (item.bpm && item.genre) return;
  const key = String(item.id || `${item.artist}::${item.name}`);
  if (metaFetchInFlight.has(key) || metaFetchAttempted.has(key)) return;
  metaFetchInFlight.add(key);
  try {
    // 1. Check localStorage cache
    const stored = getStoredTrackMeta(item.name, item.artist);
    if (stored?.bpm || stored?.genre) {
      if (!item.bpm && stored.bpm) item.bpm = stored.bpm;
      if (!item.genre && stored.genre) item.genre = stored.genre;
      if (item.id) filRougeManager.patchPlaylistItem(item.id, { bpm: item.bpm, genre: item.genre });
      uiRenderer.invalidateDeckMetaCache();
      uiRenderer.refreshDeckMetaDisplays();
      renderQueueDebounced();
      renderFilRougeDebounced();
      return;
    }
    // 2. Ask the API (only once per track per session)
    metaFetchAttempted.add(key);
    const results = await searchTracksViaApi(`${item.artist} ${item.name}`, 5);
    const hit = results[0];
    if (!hit) return;
    let changed = false;
    if (!item.bpm && hit.bpm) { item.bpm = hit.bpm; changed = true; }
    if (!item.genre && hit.genre) { item.genre = hit.genre; changed = true; }
    if (changed) {
      patchStoredTrackMeta(item.name, item.artist, { bpm: item.bpm, genre: item.genre });
      if (item.id) filRougeManager.patchPlaylistItem(item.id, { bpm: item.bpm, genre: item.genre });
      uiRenderer.invalidateDeckMetaCache();
      uiRenderer.refreshDeckMetaDisplays();
      renderQueueDebounced();
      renderFilRougeDebounced();
    }
  } catch (_) {
  } finally {
    metaFetchInFlight.delete(key);
  }
}

function getFilRougeTrackKey(item) {
  if (!item) return '';
  return String(item.id || item.cachePath || `${item.artist || ''}::${item.name || item.title || ''}`);
}

function hasStemsForTrack(item) {
  return Boolean(
    item?.localStemUrls?.vocalsUrl
      || item?.localStemUrls?.instrumentalUrl
      || item?.localStemUrls?.echoUrl
      || item?.localStemUrls?.distortionUrl
      || item?.stems?.vocalsUrl
      || item?.stems?.instrumentalUrl
      || item?.stems?.echoUrl
      || item?.stems?.distortionUrl
  );
}

function setFilRougeTrackStatus(item, patch = {}) {
  const key = getFilRougeTrackKey(item);
  if (!key) return;
  const prev = filRougeTrackStatusByKey.get(key) || {};
  filRougeTrackStatusByKey.set(key, {
    ...prev,
    ...patch,
    updatedAt: Date.now(),
  });
}

function getFilRougeTrackStatus(item) {
  const key = getFilRougeTrackKey(item);
  const stored = key ? filRougeTrackStatusByKey.get(key) : null;
  const stemsOk = hasStemsForTrack(item) || Boolean(stored?.stemsOk);
  const inferredDone = Boolean(item?.cachePath || item?.persistedSourceUrl);
  const downloadState = stored?.downloadState || (inferredDone ? 'done' : 'idle');
  return {
    downloadState,
    stemsOk,
  };
}

// ── Fil rouge UI rendering ──────────────────────────────────────────────────

function buildFilRougeDanceChips(item) {
  const bpm = Number(extractTrackBpm(item));
  const genre = String(extractTrackGenre(item) || '').trim();
  const bpmHtml = Number.isFinite(bpm) && bpm > 0 ? `<span class="queue-chip">${Math.round(bpm)} BPM</span>` : '';
  const genreHtml = genre
    ? `<button type="button" class="queue-chip queue-chip--genre" data-genre="${escHtml(genre)}" aria-label="Filtrer par genre ${escHtml(genre)}">${escHtml(genre)}</button>`
    : '';
  if (!bpmHtml && !genreHtml) return '';
  return `<div class="queue-chips">${bpmHtml}${genreHtml}</div>`;
}

function renderFilRouge() {
  updateDjPlanIndicator();

  const playlist = filRougeManager.getPlaylist();
  const priorityQueue = filRougeManager.getPriorityQueue();
  const filRougeIndex = filRougeManager.getCurrentIndex();

  // Fetch BPM/genre in background for visible items that are missing them
  const visibleStart = filRougeIndex > 0 ? Math.max(0, filRougeIndex - 2) : 0;
  playlist.slice(visibleStart, visibleStart + 20).forEach((item) => {
    if (!item.bpm || !item.genre) fetchMissingMeta(item).catch(() => {});
  });
  priorityQueue.slice(0, 10).forEach((item) => {
    if (!item.bpm || !item.genre) fetchMissingMeta(item).catch(() => {});
  });

  if (filRougeCountEl) {
    filRougeCountEl.textContent = `${playlist.length} morceau${playlist.length > 1 ? 'x' : ''}`;
  }
  if (filRougePriorityCountEl) {
    filRougePriorityCountEl.textContent = String(priorityQueue.length);
  }
  if (filRougeShuffleBtn) {
    const on = filRougeManager.isShuffleEnabled();
    filRougeShuffleBtn.textContent = `Shuffle: ${on ? 'ON' : 'OFF'}`;
    filRougeShuffleBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  if (filRougeLoopBtn) {
    const on = filRougeManager.isLoopEnabled();
    filRougeLoopBtn.textContent = `Loop: ${on ? 'ON' : 'OFF'}`;
    filRougeLoopBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  // Priority queue
  if (filRougePriorityListEl) {
    if (!priorityQueue.length) {
      filRougePriorityListEl.innerHTML = '<div class="filrouge-empty">Aucun morceau en file prioritaire</div>';
    } else {
      filRougePriorityListEl.innerHTML = priorityQueue.map((item, idx) => `
        <div class="filrouge-item filrouge-priority-item" data-index="${idx}">
          <img class="filrouge-art"${item.artUrl ? ` src="${escHtml(item.artUrl)}"` : ' hidden'} alt="" loading="lazy" onerror="this.hidden=true">
          <div class="filrouge-info">
            <span class="filrouge-pos">${idx + 1}.</span>
            <div class="filrouge-name">${escHtml(item.name || 'Inconnu')}</div>
            <div class="filrouge-artist">${escHtml(item.artist || '')}</div>
            ${buildFilRougeDanceChips(item)}
          </div>
          <button class="filrouge-remove-btn" data-type="priority" data-index="${idx}" aria-label="Retirer">✕</button>
        </div>
      `).join('');
    }
  }

  // Playlist fil rouge
  if (filRougePlaylistListEl) {
    if (!playlist.length) {
      filRougePlaylistListEl.innerHTML = '<div class="filrouge-empty">Playlist vide. Ajoutez des morceaux depuis le Cache.</div>';
    } else {
      filRougePlaylistListEl.innerHTML = playlist.map((item, idx) => `
        ${(() => {
          const status = getFilRougeTrackStatus(item);
          const downloadLabel = status.downloadState === 'downloading'
            ? 'Download en cours'
            : status.downloadState === 'done'
              ? 'Download fini'
              : status.downloadState === 'error'
                ? 'Download erreur'
                : 'Download en attente';
          const downloadClass = status.downloadState === 'downloading'
            ? 'is-downloading'
            : status.downloadState === 'done'
              ? 'is-done'
              : status.downloadState === 'error'
                ? 'is-error'
                : 'is-idle';
          const stemsLabel = status.stemsOk ? 'Stems OK' : 'Stems --';
          const stemsClass = status.stemsOk ? 'is-done' : 'is-idle';
          return `
        <div class="filrouge-item${idx === filRougeIndex ? ' filrouge-current' : ''}" data-index="${idx}">
          <img class="filrouge-art"${item.artUrl ? ` src="${escHtml(item.artUrl)}"` : ' hidden'} alt="" loading="lazy" onerror="this.hidden=true">
          <div class="filrouge-info">
            <span class="filrouge-pos">${idx + 1}.</span>
            <div class="filrouge-meta">
              <div class="filrouge-name">${escHtml(item.name || 'Inconnu')}</div>
              <div class="filrouge-artist">${escHtml(item.artist || '')}</div>
              ${buildFilRougeDanceChips(item)}
              <div class="filrouge-statuses">
                <span class="filrouge-status ${downloadClass}">${downloadLabel}</span>
                <span class="filrouge-status ${stemsClass}">${stemsLabel}</span>
              </div>
            </div>
          </div>
          <div class="filrouge-actions">
            ${renderDjTransitionFeedback(item)}
            ${item.djTrackId ? `<button class="filrouge-iconic-btn${item.djIsIconic ? ' is-iconic' : ''}" data-item-id="${item.id}" title="${item.djIsIconic ? 'Retirer le statut iconic' : 'Marquer comme iconic (ne jamais couper)'}" aria-label="${item.djIsIconic ? 'Retirer iconic' : 'Marquer iconic'}">${item.djIsIconic ? '★' : '☆'}</button>` : ''}
            ${idx < filRougeIndex
              ? `<button class="filrouge-set-current-btn" data-index="${idx}" aria-label="Revenir à ce morceau" title="Revenir à ce morceau">⏪</button>`
              : idx > filRougeIndex + 1
                ? `<button class="filrouge-set-current-btn" data-index="${idx}" aria-label="Sauter à ce morceau" title="Sauter ici (skip les ${idx - filRougeIndex - 1} morceau${idx - filRougeIndex - 1 > 1 ? 'x' : ''} précédents)">⏩</button>`
                : ''
            }
            <button class="filrouge-priority-add-btn" data-index="${idx}" aria-label="Ajouter à la file d'attente" title="Ajouter à la file d'attente">⏭</button>
            <button class="filrouge-remove-btn" data-type="playlist" data-index="${idx}" aria-label="Retirer">✕</button>
          </div>
        </div>
          `;
        })()}
      `).join('');
    }
  }

  // Attach event handlers
  document.querySelectorAll('.filrouge-remove-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const type = btn.dataset.type;
      const idx = Number(btn.dataset.index);
      if (type === 'priority') {
        filRougeManager.removeFromPriorityQueue(idx);
      } else {
        const removed = filRougeManager.getPlaylist()[idx];
        const key = getFilRougeTrackKey(removed);
        if (key) filRougeTrackStatusByKey.delete(key);
        addSpotifyDeletedId(removed?.id);
        filRougeManager.removeFromPlaylist(idx);
      }
      renderFilRouge();
    });
  });

  document.querySelectorAll('.filrouge-priority-add-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.index);
      const playlist = filRougeManager.getPlaylist();
      const item = playlist[idx];
      if (item) {
        addToQueue(item, { source: 'fil-rouge', showAddedToast: false });
        showToast(`"${item.name}" → file d'attente`);
      }
    });
  });

  document.querySelectorAll('.filrouge-set-current-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.index);
      const playlist = filRougeManager.getPlaylist();
      const item = playlist[idx];
      if (!item) return;
      filRougeManager.jumpToIndex(idx);
      renderFilRouge();
      showToast(`⏩ Fil rouge : prochain → "${item.name}"`);
    });
  });

  document.querySelectorAll('.filrouge-dj-feedback-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const container = btn.closest('.filrouge-dj-feedback');
      const decisionId = container?.dataset.decisionId;
      const feedback = btn.dataset.feedback;
      if (!decisionId || !feedback) return;

      const result = await djPlanManager.submitFeedback(decisionId, feedback);
      if (!result) {
        showToast('Feedback DJ: échec de l\'envoi', true);
        return;
      }

      container.querySelectorAll('.filrouge-dj-feedback-btn').forEach((b) => {
        b.classList.toggle('is-selected', b === btn);
      });
      showToast(feedback === 'good' ? '👍 Merci pour le retour' : '👎 Merci pour le retour');
    });
  });

  document.querySelectorAll('.filrouge-iconic-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const itemId = btn.dataset.itemId;
      const playlist = filRougeManager.getPlaylist();
      const item = playlist.find((p) => String(p.id) === String(itemId));
      if (!item) return;
      const newIconic = !item.djIsIconic;
      const result = await djPlanManager.setIconic(item, newIconic);
      if (!result) { showToast('Iconic DJ : échec', true); return; }
      renderFilRouge();
      showToast(newIconic ? '★ Morceau marqué iconic' : '☆ Statut iconic retiré');
    });
  });
}

function readSpotifyFilRougeSource() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.spotifyFilRougeSource);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function writeSpotifyFilRougeSource(source) {
  try {
    if (!source) {
      localStorage.removeItem(STORAGE_KEYS.spotifyFilRougeSource);
      return;
    }
    localStorage.setItem(STORAGE_KEYS.spotifyFilRougeSource, JSON.stringify(source));
  } catch (_) {
    // ignore storage failures
  }
}

function setSpotifyStatus(message, isError = false) {
  if (!spotifyStatus) return;
  const connected = spotifyClient.isConnected();
  spotifyStatus.textContent = String(message || '');
  spotifyStatus.classList.remove('is-connected', 'is-disconnected', 'is-error');
  if (isError) {
    spotifyStatus.classList.add('is-error');
  } else if (connected) {
    spotifyStatus.classList.add('is-connected');
  } else {
    spotifyStatus.classList.add('is-disconnected');
  }

  if (spotifyConnectionBadge) {
    spotifyConnectionBadge.classList.remove('is-connected', 'is-disconnected', 'is-error');
    if (isError) {
      spotifyConnectionBadge.classList.add('is-error');
      spotifyConnectionBadge.textContent = '● Erreur Spotify';
    } else if (connected) {
      spotifyConnectionBadge.classList.add('is-connected');
      spotifyConnectionBadge.textContent = '● Connecté';
    } else {
      spotifyConnectionBadge.classList.add('is-disconnected');
      spotifyConnectionBadge.textContent = '● Déconnecté';
    }
  }
}

function updateSpotifyConfigUi() {
  if (spotifyClientIdInput) {
    spotifyClientIdInput.value = spotifyClient.getStoredClientId();
  }
  const connected = spotifyClient.isConnected();
  const source = readSpotifyFilRougeSource();
  if (spotifyPlaylistInput && source?.playlistId && !spotifyPlaylistInput.value.trim()) {
    spotifyPlaylistInput.value = source.playlistId;
  }
  if (spotifyConnectBtn) spotifyConnectBtn.disabled = connected;
  if (spotifyDisconnectBtn) spotifyDisconnectBtn.disabled = !connected;
  if (spotifyImportFilRougeBtn) spotifyImportFilRougeBtn.disabled = !connected;

  if (spotifyConnectBtn) {
    spotifyConnectBtn.textContent = connected ? 'Spotify connecté' : 'Se connecter';
  }

  if (spotifyPlaylistInput) {
    spotifyPlaylistInput.disabled = !connected;
  }
  if (spotifyPlaylistSelect) {
    spotifyPlaylistSelect.disabled = !connected;
  }

  if (connected) {
    setSpotifyStatus(source?.playlistName
      ? `Spotify connecté. Sync active: ${source.playlistName}`
      : 'Spotify connecté. Vous pouvez importer une playlist dans le fil rouge.');
    return;
  }
  // Disconnected: clear the dropdown
  if (spotifyPlaylistSelect) {
    spotifyPlaylistSelect.innerHTML = '<option value="">Choisir une playlist Spotify</option>';
  }
  setSpotifyStatus('Spotify non connecté. Optionnel pour utiliser l\'application.');
}

async function refreshSpotifyPlaylistDropdown() {
  if (!spotifyPlaylistSelect) return;
  if (!spotifyClient.isConnected()) return;
  try {
    const playlists = await spotifyClient.fetchUserPlaylists();
    const currentVal = spotifyPlaylistSelect.value || spotifyPlaylistInput?.value?.trim() || '';
    spotifyPlaylistSelect.innerHTML = '<option value="">Choisir une playlist Spotify</option>';
    for (const pl of playlists) {
      const opt = document.createElement('option');
      opt.value = pl.playlistId;
      opt.textContent = pl.playlistName || pl.playlistId;
      if (pl.playlistId === currentVal) opt.selected = true;
      spotifyPlaylistSelect.appendChild(opt);
    }
  } catch (err) {
    logWarn('spotify: failed to fetch user playlists', { error: err?.message });
  }
}

function applySpotifyPlaylistToFilRouge(tracks) {
  filRougeTrackStatusByKey.clear();
  filRougeManager.clearPriorityQueue();
  filRougeManager.clearPlaylist();
  for (const track of tracks) {
    setFilRougeTrackStatus(track, {
      downloadState: track?.cachePath || track?.persistedSourceUrl ? 'done' : 'idle',
      stemsOk: hasStemsForTrack(track),
    });
    filRougeManager.addToPlaylist(track);
  }
  renderFilRouge();
  runDjPlanFullPass('spotify-import').catch(() => {});
}

/**
 * Parses a TXT playlist where each line is "artiste - titre".
 * Lines starting with '#' or empty lines are ignored.
 * @param {string} text
 * @returns {Array<{id:string, name:string, artist:string, artUrl:string, duration:number, bpm:null, genre:string, cachePath:string, persistedSourceUrl:string, ratingKey:string, stemsStatus:string, stems:null, source:string}>}
 */
function parseTxtPlaylist(text) {
  const tracks = [];
  const lines = String(text || '').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    let artist, name;
    // Accept "artiste - titre" with flexible whitespace and dash variants.
    const splitMatch = trimmed.match(/^(.+?)\s+(?:-|–|—)\s+(.+)$/u);
    if (splitMatch) {
      artist = splitMatch[1].trim();
      name = splitMatch[2].trim();
    } else {
      artist = 'Artiste inconnu';
      name = trimmed;
    }
    if (!name) continue;
    tracks.push({
      id: `txt-${tracks.length}-${encodeURIComponent(artist)}-${encodeURIComponent(name)}`,
      name,
      artist: artist || 'Artiste inconnu',
      artUrl: '',
      duration: 0,
      bpm: null,
      genre: '',
      cachePath: '',
      persistedSourceUrl: '',
      ratingKey: '',
      stemsStatus: '',
      stems: null,
      source: 'txt',
    });
  }
  return tracks;
}

function setTxtPlaylistStatus(msg, isError = false) {
  if (!txtPlaylistStatus) return;
  txtPlaylistStatus.textContent = msg;
  txtPlaylistStatus.style.color = isError ? 'var(--error, #e55)' : '';
}

function applyTxtPlaylistToFilRouge(tracks) {
  stopSpotifyFilRougeSync();
  writeSpotifyFilRougeSource(null);
  spotifyPrefetchGeneration++;
  filRougeTrackStatusByKey.clear();
  filRougeManager.clearPriorityQueue();
  filRougeManager.clearPlaylist();
  for (const track of tracks) {
    setFilRougeTrackStatus(track, {
      downloadState: 'idle',
      stemsOk: false,
    });
    filRougeManager.addToPlaylist(track);
  }
  updateSpotifyConfigUi();
  renderFilRouge();
  runDjPlanFullPass('txt-import').catch(() => {});
}

/**
 * Recherche l'artwork d'un morceau du fil rouge via l'API et met à jour
 * l'artUrl dans le gestionnaire fil rouge puis re-rend la liste.
 * Ne fait rien si le morceau a déjà un artUrl.
 * @param {import('./lib/filRougeManager.js').FilRougeItem} track
 */
async function fetchFilRougeArtwork(track) {
  if (!track?.id) return;
  const needsArt = !track.artUrl;
  const needsMeta = !track.bpm && !track.genre;
  if (!needsArt && !needsMeta) return;

  // Check Cache Storage for a persisted blob first (no network)
  if (needsArt) {
    const cachedBlobUrl = await restoreArtwork(track).catch(() => null);
    if (cachedBlobUrl) {
      filRougeManager.patchPlaylistItem(track.id, { artUrl: cachedBlobUrl });
      renderFilRouge();
      if (!needsMeta) return;
    }
  }

  // Use stored URL from localStorage if available
  const stored = getStoredTrackMeta(track.name, track.artist);
  if (needsArt && stored?.artworkUrl) {
    filRougeManager.patchPlaylistItem(track.id, { artUrl: stored.artworkUrl });
    persistArtwork(track, stored.artworkUrl).catch(() => {});
    renderFilRouge();
    if (!needsMeta) return;
  }

  try {
    const results = await searchTracksViaApi(`${track.artist} ${track.name}`, 5);
    const hit = results[0];
    if (!hit) return;
    const patch = {};
    const hitArtUrl = getBestArtworkUrl(hit);
    if (needsArt && hitArtUrl) {
      patch.artUrl = hitArtUrl;
      patchStoredTrackMeta(track.name, track.artist, { artworkUrl: hitArtUrl });
      persistArtwork(track, hitArtUrl).catch(() => {});
    }
    if (needsMeta) {
      if (hit.bpm) patch.bpm = hit.bpm;
      if (hit.genre) patch.genre = hit.genre;
    }
    if (Object.keys(patch).length) {
      filRougeManager.patchPlaylistItem(track.id, patch);
      renderFilRouge();
    }
  } catch (_) {}
}

/**
 * Récupère l'artwork d'un item de la file d'attente via l'API si l'artUrl
 * est vide, met à jour l'objet en place, synchronise le fil rouge si besoin,
 * et rafraîchit l'affichage (pochette + liste).
 * @param {object} item  - item de la file d'attente
 * @param {string} [deck] - deck en cours de lecture (pour rafraîchir la pochette)
 */
async function fetchAndStoreArtworkForItem(item, deck) {
  if (!item || item.artUrl) return;

  // Check Cache Storage for a persisted blob first (no network)
  const cachedBlobUrl = await restoreArtwork(item).catch(() => null);
  if (cachedBlobUrl) {
    item.artUrl = cachedBlobUrl;
    if (item.id) filRougeManager.patchPlaylistItem(item.id, { artUrl: cachedBlobUrl });
    updateNowPlaying(item, deck ?? getFocusDeck());
    renderQueue();
    renderFilRouge();
    return;
  }

  // Use stored URL from localStorage if available
  const stored = getStoredTrackMeta(item.name, item.artist);
  if (stored?.artworkUrl) {
    item.artUrl = stored.artworkUrl;
    if (item.id) filRougeManager.patchPlaylistItem(item.id, { artUrl: stored.artworkUrl });
    updateNowPlaying(item, deck ?? getFocusDeck());
    renderQueue();
    renderFilRouge();
    persistArtwork(item, stored.artworkUrl).catch(() => {});
    return;
  }

  try {
    const results = await searchTracksViaApi(`${item.artist} ${item.name}`, 5);
    const artUrl = getBestArtworkUrl(results[0]);
    if (!artUrl) return;
    item.artUrl = artUrl;
    patchStoredTrackMeta(item.name, item.artist, { artworkUrl: artUrl });
    if (item.id) {
      filRougeManager.patchPlaylistItem(item.id, { artUrl });
    }
    updateNowPlaying(item, deck ?? getFocusDeck());
    renderQueue();
    renderFilRouge();
    persistArtwork(item, artUrl).catch(() => {});
  } catch (_) {}
}

/**
 * Preloads TXT-imported tracks through the downloader API so files are
 * downloaded/cached server-side just like Spotify imports.
 */
async function startTxtPlaylistPrefetch(tracks) {
  if (!Array.isArray(tracks) || tracks.length === 0) return;
  const generation = ++spotifyPrefetchGeneration;
  let cached = 0;
  let failed = 0;

  const BATCH_SIZE = 3;
  for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
    if (spotifyPrefetchGeneration !== generation) return;
    const batch = tracks.slice(i, i + BATCH_SIZE);
    for (const track of batch) {
      setFilRougeTrackStatus(track, { downloadState: 'downloading', stemsOk: hasStemsForTrack(track) });
    }
    setTxtPlaylistStatus(`Téléchargement serveur TXT : ${i + 1}–${Math.min(i + BATCH_SIZE, tracks.length)} / ${tracks.length}…`);
    renderFilRouge();
    const batchResults = await Promise.allSettled(
      batch.map(track => prefetchTrackToLocalCache(track).catch(() => false))
    );
    await Promise.allSettled(
      batchResults.map(async (result, j) => {
        const track = batch[j];
        const ok = result.status === 'fulfilled' && result.value;
        if (ok) {
          cached++;
          autoModeManager.fetchMixData(track.name, track.artist).catch(() => {});
          setFilRougeTrackStatus(track, { downloadState: 'done', stemsOk: hasStemsForTrack(track) });
        } else {
          failed++;
          setFilRougeTrackStatus(track, { downloadState: 'error', stemsOk: hasStemsForTrack(track) });
        }
        await fetchFilRougeArtwork(track).catch(() => {});
      })
    );
    renderFilRouge();
  }

  if (spotifyPrefetchGeneration !== generation) return;
  const summary = failed > 0
    ? `Import TXT : ${cached} mis en cache serveur, ${failed} échec${failed > 1 ? 's' : ''}.`
    : `Import TXT : ${cached} morceau${cached > 1 ? 'x' : ''} mis en cache serveur.`;
  setTxtPlaylistStatus(summary, failed > 0 && cached === 0);
}

function stopSpotifyFilRougeSync() {
  if (spotifySyncTimer) {
    clearTimeout(spotifySyncTimer);
    spotifySyncTimer = null;
  }
}

function resetSpotifyFilRougeBackoff() {
  spotifySyncBackoffAttempts = 0;
}

function getSpotifyFilRougeNextDelayMs(error) {
  const retryAfterMs = Number(error?.retryAfterMs) || 0;
  const exponentialMs = SPOTIFY_FIL_ROUGE_POLL_MS
    * Math.min(2 ** spotifySyncBackoffAttempts, SPOTIFY_FIL_ROUGE_BACKOFF_MAX_MULTIPLIER);
  return Math.max(SPOTIFY_FIL_ROUGE_POLL_MS, retryAfterMs, exponentialMs);
}

/**
 * Caches all tracks from a Spotify playlist into the local API cache, one by
 * one (sequentially) to avoid flooding the device with parallel requests.
 * Each call increments a generation counter; a stale loop detects the change
 * and exits early so only the latest import is being prefetched at any time.
 */
async function startSpotifyPlaylistPrefetch(tracks) {
  if (!Array.isArray(tracks) || tracks.length === 0) return;
  const generation = ++spotifyPrefetchGeneration;
  let cached = 0;
  let failed = 0;
  const BATCH_SIZE = 3;
  for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
    if (spotifyPrefetchGeneration !== generation) return;
    const batch = tracks.slice(i, i + BATCH_SIZE);
    setSpotifyStatus(`Cache Spotify : ${i + 1}–${Math.min(i + BATCH_SIZE, tracks.length)} / ${tracks.length}…`);
    const batchResults = await Promise.allSettled(
      batch.map(track => prefetchTrackToLocalCache(track).catch(() => false))
    );
    for (let j = 0; j < batch.length; j++) {
      const track = batch[j];
      const ok = batchResults[j].status === 'fulfilled' && batchResults[j].value;
      if (ok) {
        cached++;
        autoModeManager.fetchMixData(track.name, track.artist).catch(() => {});
      } else {
        failed++;
      }
    }
  }
  if (spotifyPrefetchGeneration !== generation) return;
  const summary = failed > 0
    ? `Cache Spotify : ${cached} mis en cache, ${failed} échec${failed > 1 ? 's' : ''}`
    : `Cache Spotify : ${cached} morceau${cached > 1 ? 'x' : ''} mis en cache`;
  setSpotifyStatus(summary);
}

/**
 * Ajoute un id de morceau Spotify à la liste des suppressions manuelles
 * persistée dans le source fil rouge. Ces morceaux ne seront pas restaurés
 * lors des synchronisations ultérieures.
 * @param {string|number} trackId
 */
function addSpotifyDeletedId(trackId) {
  if (trackId == null) return;
  const source = readSpotifyFilRougeSource();
  if (!source?.playlistId) return;
  const deleted = new Set((source.deletedIds || []).map(String));
  deleted.add(String(trackId));
  writeSpotifyFilRougeSource({ ...source, deletedIds: [...deleted] });
}

/**
 * Fusionne les pistes fraîches de Spotify dans le fil rouge en cours.
 * - Les pistes supprimées manuellement (tombstone) sont ignorées.
 * - Les pistes déjà présentes sont conservées telles quelles (avec leur état de cache).
 * - Les nouvelles pistes sont insérées à leur rang Spotify.
 * @param {import('./lib/filRougeManager.js').FilRougeItem[]} freshTracks
 * @returns {{ added: number }} statistiques de la fusion
 */
function mergeSpotifyTracksToFilRouge(freshTracks) {
  const source = readSpotifyFilRougeSource();
  const deletedIds = new Set((source?.deletedIds || []).map(String));
  const currentPlaylist = filRougeManager.getPlaylist();
  const currentById = new Map(currentPlaylist.map(item => [String(item.id), item]));

  let added = 0;
  const merged = [];
  const newIds = [];

  for (const track of freshTracks) {
    const id = String(track.id);
    if (deletedIds.has(id)) continue;

    if (currentById.has(id)) {
      // Conserver l'item existant (cachePath, artUrl, statuts de téléchargement…)
      merged.push(currentById.get(id));
    } else {
      // Nouveau morceau ajouté sur Spotify
      setFilRougeTrackStatus(track, {
        downloadState: track?.cachePath || track?.persistedSourceUrl ? 'done' : 'idle',
        stemsOk: hasStemsForTrack(track),
      });
      merged.push(track);
      newIds.push(id);
      added++;
    }
  }

  filRougeManager.setPlaylist(merged);
  renderFilRouge();

  if (newIds.length) {
    const newItems = filRougeManager.getPlaylist().filter((item) => newIds.includes(String(item.id)));
    runDjPlanIncrementalPass(newItems, filRougeManager.isLoopEnabled()).catch(() => {});
  }

  return { added };
}

async function syncSpotifyFilRougeIfChanged(options = {}) {
  const { silent = false } = options;
  const source = readSpotifyFilRougeSource();
  if (!source?.playlistId) return false;
  if (spotifySyncInFlight) return false;
  spotifySyncInFlight = true;
  try {
    const snapshot = await spotifyClient.fetchPlaylistSnapshot(source.playlistId);
    if (snapshot?.snapshot_id && source.snapshotId && snapshot.snapshot_id === source.snapshotId) {
      return false;
    }

    const { tracks, fingerprint } = await spotifyClient.fetchPlaylistTracks(source.playlistId);
    const { added } = mergeSpotifyTracksToFilRouge(tracks);
    writeSpotifyFilRougeSource({
      ...source,
      playlistName: snapshot?.name || source.playlistName || '',
      snapshotId: snapshot?.snapshot_id || '',
      fingerprint,
      updatedAt: Date.now(),
    });
    updateSpotifyConfigUi();
    if (!silent) {
      const msg = added > 0
        ? `Fil rouge Spotify mis à jour (+${added} nouveau${added > 1 ? 'x' : ''})`
        : `Fil rouge Spotify mis à jour`;
      showToast(msg);
    }
    startSpotifyPlaylistPrefetch(tracks).catch(() => {});
    return true;
  } catch (err) {
    if (!silent) setSpotifyStatus(`Erreur sync Spotify: ${err.message}`, true);
    throw err;
  } finally {
    spotifySyncInFlight = false;
  }
}

function startSpotifyFilRougeSyncLoop() {
  stopSpotifyFilRougeSync();
  resetSpotifyFilRougeBackoff();
  const source = readSpotifyFilRougeSource();
  if (!source?.playlistId || !spotifyClient.isConnected()) return;

  const runSync = async () => {
    const currentSource = readSpotifyFilRougeSource();
    if (!currentSource?.playlistId || !spotifyClient.isConnected()) {
      stopSpotifyFilRougeSync();
      return;
    }

    let nextDelayMs = SPOTIFY_FIL_ROUGE_POLL_MS;
    try {
      await syncSpotifyFilRougeIfChanged({ silent: true });
      resetSpotifyFilRougeBackoff();
    } catch (err) {
      spotifySyncBackoffAttempts = Math.min(
        spotifySyncBackoffAttempts + 1,
        Math.log2(SPOTIFY_FIL_ROUGE_BACKOFF_MAX_MULTIPLIER),
      );
      nextDelayMs = getSpotifyFilRougeNextDelayMs(err);
    }

    spotifySyncTimer = setTimeout(() => {
      runSync().catch(() => {});
    }, nextDelayMs);
  };

  spotifySyncTimer = setTimeout(() => {
    runSync().catch(() => {});
  }, SPOTIFY_FIL_ROUGE_POLL_MS);
}

async function importSpotifyPlaylistToFilRouge() {
  const parsedId = spotifyClient.parseSpotifyPlaylistId(spotifyPlaylistInput?.value);
  if (!parsedId) {
    throw new Error('Playlist Spotify invalide (URL/URI/ID attendu)');
  }
  const snapshot = await spotifyClient.fetchPlaylistSnapshot(parsedId);
  const { tracks, fingerprint } = await spotifyClient.fetchPlaylistTracks(parsedId);
  applySpotifyPlaylistToFilRouge(tracks);
  writeSpotifyFilRougeSource({
    playlistId: parsedId,
    playlistName: snapshot?.name || '',
    snapshotId: snapshot?.snapshot_id || '',
    fingerprint,
    updatedAt: Date.now(),
  });
  startSpotifyFilRougeSyncLoop();
  updateSpotifyConfigUi();
  showToast(`Fil rouge importé depuis Spotify (${tracks.length} morceau${tracks.length > 1 ? 'x' : ''})`);
  startSpotifyPlaylistPrefetch(tracks).catch(() => {});
}

filRougeShuffleBtn?.addEventListener('click', () => {
  const on = filRougeManager.toggleShuffle();
  showToast(`Shuffle fil rouge: ${on ? 'ON' : 'OFF'}`);
  renderFilRouge();
});

filRougeLoopBtn?.addEventListener('click', () => {
  const on = filRougeManager.setLoopEnabled(!filRougeManager.isLoopEnabled());
  showToast(`Loop fil rouge: ${on ? 'ON' : 'OFF'}`);
  renderFilRouge();
});

filRougeClearBtn?.addEventListener('click', () => {
  filRougeTrackStatusByKey.clear();
  filRougeManager.clearPlaylist();
  filRougeManager.clearPriorityQueue();
  writeSpotifyFilRougeSource(null);
  stopSpotifyFilRougeSync();
  spotifyPrefetchGeneration++;
  showToast('Fil rouge vidé');
  updateSpotifyConfigUi();
  renderFilRouge();
});

/**
 * Adds a track item (from queue format) to the fil rouge playlist.
 */
function addToFilRouge(item) {
  if (!item) return;
  const filRougeItem = {
    id: item.id || item.cachePath || `fr-${Date.now()}`,
    name: item.name || item.trackName || item.title || 'Inconnu',
    artist: item.artist || item.artistName || 'Artiste inconnu',
    artUrl: getBestArtworkUrl(item),
    duration: item.duration || 0,
    bpm: extractTrackBpm(item),
    genre: extractTrackGenre(item),
    cachePath: item.cachePath || '',
    persistedSourceUrl: item.persistedSourceUrl || item.url || item.localUrl || item.streamUrl || '',
    ratingKey: item.ratingKey || '',
    stemsStatus: item.stemsStatus || '',
    stems: item.stems || null,
  };
  const added = filRougeManager.addToPlaylist(filRougeItem);
  if (added) {
    setFilRougeTrackStatus(filRougeItem, {
      downloadState: filRougeItem.cachePath || filRougeItem.persistedSourceUrl ? 'done' : 'idle',
      stemsOk: hasStemsForTrack(filRougeItem),
    });
    showToast(`"${filRougeItem.name}" ajouté au fil rouge`);

    const playlistItem = filRougeManager.getPlaylist().find((p) => p.id === filRougeItem.id);
    if (playlistItem) {
      runDjPlanIncrementalPass([playlistItem], filRougeManager.isLoopEnabled()).catch(() => {});
    }
  } else {
    showToast(`Déjà dans le fil rouge`, true);
  }
  renderFilRouge();
}

/**
 * Adds a track item to the priority queue.
 */
function addToPriorityQueue(item) {
  if (!item) return;
  addToQueue(item, { source: 'fil-rouge', showAddedToast: false });
  const name = item.name || item.trackName || item.title || 'Inconnu';
  showToast(`"${name}" → file d'attente`);
}

const DJ_SET_PROFILE_LABELS = {
  club_peak: "Club (pic d'énergie)",
  wedding: 'Mariage',
  festival: 'Festival',
  warmup: 'Mise en route',
  afterparty: 'After-party',
};

/**
 * Recalcule le badge de qualité du set via `/api/dj/batch` (informatif, ne
 * réordonne/ne retire rien) pour le profil sélectionné.
 */
async function runDjSetQualityRefresh({ forceRefresh = false } = {}) {
  try {
    const quality = await djPlanManager.computeSetQuality({ forceRefresh });
    renderDjSetQualityBadge(djSetQualityBadgeEl, quality);
    updateDjPlanIndicator();
  } catch (err) {
    logWarn('djPlan: computeSetQuality failed', { error: err?.message });
    renderDjSetQualityBadge(djSetQualityBadgeEl, null);
  }
}

const scheduleDjSetQualityRefresh = createDebouncedFn(() => {
  runDjSetQualityRefresh().catch(() => {});
}, 1000);

/**
 * Rafraîchit transitions + badge de qualité via un seul appel `/api/dj/batch`.
 * `computeSetQuality` persiste désormais les transitions retournées par batch,
 * ce qui rend `planAllEdges` redondant pour ce chemin.
 * @param {string} reason - pour les logs (ex: 'startup', 'spotify-import')
 */
async function runDjPlanFullPass(reason) {
  if (!filRougeManager.isActive()) {
    renderDjSetQualityBadge(djSetQualityBadgeEl, null);
    return;
  }
  await runDjSetQualityRefresh();
  renderFilRouge();
}

/**
 * Calcule les arêtes DJ pour des morceaux ajoutés à la volée (ajout simple ou
 * merge Spotify) via `/api/dj/transition`, puis rafraîchit le badge de qualité
 * du set (`/api/dj/batch`) sur l'ensemble du fil rouge.
 * @param {Array} items - nouveaux items déjà présents dans le fil rouge
 * @param {boolean} withWrap
 */
async function runDjPlanIncrementalPass(items, withWrap) {
  try {
    await djPlanManager.planEdgesForNewItems(items, { withWrap });
    renderFilRouge();
  } catch (err) {
    logWarn('djPlan: planEdgesForNewItems failed', { error: err?.message });
  }
  await runDjSetQualityRefresh();
}

/**
 * Peuple le sélecteur de profil de set depuis `/api/dj/set-profiles`,
 * restaure la sélection persistée et rafraîchit le badge au changement.
 */
async function initDjSetProfileSelect() {
  if (!djSetProfileSelectEl) return;

  const result = await djPlanManager.getSetProfiles();
  const profiles = Array.isArray(result?.profiles) && result.profiles.length
    ? result.profiles
    : Object.keys(DJ_SET_PROFILE_LABELS).map((id) => ({ id }));

  djSetProfileSelectEl.innerHTML = profiles.map((profile) => {
    const id = profile?.id;
    const label = DJ_SET_PROFILE_LABELS[id] || id;
    return `<option value="${escHtml(id)}">${escHtml(label)}</option>`;
  }).join('');

  const selected = djPlanManager.getSelectedSetProfile();
  if (profiles.some((p) => p.id === selected)) {
    djSetProfileSelectEl.value = selected;
  }

  djSetProfileSelectEl.addEventListener('change', () => {
    djPlanManager.setSelectedSetProfile(djSetProfileSelectEl.value);
    runDjSetQualityRefresh({ forceRefresh: true }).catch(() => {});
  });
}

const DJ_TRANSITION_TYPE_LABELS = {
  phrase_mix: 'Phrase mix',
  long_blend: 'Long blend',
  quick_cut: 'Quick cut',
  drop_swap: 'Drop swap',
  echo_out: 'Echo out',
};

function updateDjPlanIndicator() {
  if (!djPlanIndicatorEl) return;

  const indicatorState = computeDjPlanIndicatorState({
    enabled: djExternalPlanEnabled,
    playlist: filRougeManager.getPlaylist(),
    playingId: uiState.currentTrackId,
    currentIndex: filRougeManager.getCurrentIndex(),
  });

  if (!indicatorState.visible) {
    djPlanIndicatorEl.hidden = true;
    return;
  }

  djPlanIndicatorEl.hidden = false;

  if (indicatorState.state === 'no-track') {
    djPlanIndicatorEl.innerHTML = `<div class="dj-plan-card dj-plan-card--pending"><span class="dj-plan-pending-msg">DJ Plan actif — aucun morceau fil rouge en cours</span></div>`;
    return;
  }

  if (indicatorState.state === 'no-transition') {
    const { item } = indicatorState;
    const trackLabel = item.artist
      ? `${escHtml(item.artist)} — ${escHtml(item.name || '')}`
      : escHtml(item.name || '');
    djPlanIndicatorEl.innerHTML = `<div class="dj-plan-card dj-plan-card--pending"><span class="dj-plan-pending-msg">Transition en attente de calcul…</span><span class="dj-plan-pending-track">${trackLabel}</span></div>`;
    return;
  }

  if (indicatorState.state === 'next-not-found') {
    djPlanIndicatorEl.innerHTML = `<div class="dj-plan-card dj-plan-card--pending"><span class="dj-plan-pending-msg">Morceau suivant introuvable dans la playlist</span></div>`;
    return;
  }

  // state === 'ready'
  const { transition: t, nextItem } = indicatorState;
  const typeLabel = DJ_TRANSITION_TYPE_LABELS[t.transitionType] || t.transitionType || '—';
  const scorePct = Number.isFinite(t.compatibilityScore) ? Math.round(t.compatibilityScore * 100) : null;
  const scoreClass = scorePct === null ? '' : scorePct >= 70 ? 'is-good' : scorePct >= 50 ? 'is-ok' : 'is-low';
  const mixOutFmt = Number.isFinite(t.mixOutSec) && t.mixOutSec > 0 ? formatZoneTime(t.mixOutSec) : null;
  const mixInFmt = Number.isFinite(t.mixInSec) && t.mixInSec > 0 ? formatZoneTime(t.mixInSec) : null;
  const crossfadeSec = Number.isFinite(t.crossfadeDurationSec) ? Math.round(t.crossfadeDurationSec) : null;
  const bpm = Number.isFinite(t.recommendedBpm) && t.recommendedBpm > 0 ? Math.round(t.recommendedBpm) : null;
  const decisionId = t.decisionId ? escHtml(String(t.decisionId)) : '';
  const nextLabel = nextItem.artist
    ? `${escHtml(nextItem.artist)} — ${escHtml(nextItem.name || '')}`
    : escHtml(nextItem.name || '');

  djPlanIndicatorEl.innerHTML = `
    <div class="dj-plan-card">
      <div class="dj-plan-card-header">
        <span class="dj-plan-type-badge">${escHtml(typeLabel)}</span>
        ${scorePct !== null ? `<span class="dj-plan-score ${scoreClass}" title="Score de compatibilité">${scorePct}%</span>` : ''}
        ${decisionId ? `
        <div class="dj-plan-card-feedback filrouge-dj-feedback" data-decision-id="${decisionId}">
          <button type="button" class="filrouge-dj-feedback-btn" data-feedback="good" title="Bonne transition" aria-label="Bonne transition">👍</button>
          <button type="button" class="filrouge-dj-feedback-btn" data-feedback="bad" title="Mauvaise transition" aria-label="Mauvaise transition">👎</button>
        </div>` : ''}
      </div>
      <div class="dj-plan-timeline">
        <div class="dj-plan-timeline-out">
          <span class="dj-plan-tl-label">Sort à</span>
          <span class="dj-plan-tl-time">${mixOutFmt ?? '--:--'}</span>
        </div>
        <div class="dj-plan-timeline-fade">
          <div class="dj-plan-tl-bar"></div>
          ${crossfadeSec !== null ? `<span class="dj-plan-tl-duration">${crossfadeSec}s de fondu</span>` : ''}
        </div>
        <div class="dj-plan-timeline-in">
          <span class="dj-plan-tl-label">Entre à</span>
          <span class="dj-plan-tl-time">${mixInFmt ?? '--:--'}</span>
        </div>
      </div>
      <div class="dj-plan-card-meta">
        ${bpm !== null ? `<span class="dj-plan-meta-bpm">BPM cible : ${bpm}</span>` : ''}
        <span class="dj-plan-next-track">→ ${nextLabel}</span>
      </div>
    </div>`;

  djPlanIndicatorEl.querySelectorAll('.filrouge-dj-feedback-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const container = btn.closest('.filrouge-dj-feedback');
      const dId = container?.dataset.decisionId;
      const feedback = btn.dataset.feedback;
      if (!dId || !feedback) return;
      const result = await djPlanManager.submitFeedback(dId, feedback);
      if (!result) { showToast("Feedback DJ : échec de l'envoi", true); return; }
      djPlanIndicatorEl.querySelectorAll('.filrouge-dj-feedback-btn').forEach((b) => {
        b.classList.toggle('is-selected', b === btn);
      });
      showToast(feedback === 'good' ? '👍 Merci pour le retour' : '👎 Merci pour le retour');
    });
  });
}

function updateDjExternalPlanUI() {
  if (!djExternalPlanBtn) return;
  djExternalPlanBtn.classList.toggle('is-enabled', djExternalPlanEnabled);
  djExternalPlanBtn.setAttribute('aria-pressed', String(djExternalPlanEnabled));
  djExternalPlanBtn.textContent = `DJ Plan: ${djExternalPlanEnabled ? 'ON' : 'OFF'}`;
}

if (djExternalPlanBtn) {
  djExternalPlanBtn.addEventListener('click', () => {
    djExternalPlanEnabled = !djExternalPlanEnabled;
    persistDjExternalPlanEnabledSetting(djExternalPlanEnabled);
    updateDjExternalPlanUI();
    updateDjPlanZone();
    updateDjPlanIndicator();
    logInfo('djPlan: external plan toggled', { enabled: djExternalPlanEnabled });
  });
}

if (djRecalculateBtn) {
  djRecalculateBtn.addEventListener('click', async () => {
    djRecalculateBtn.disabled = true;
    try {
      await runDjPlanFullPass('manual-recalculate');
      showToast('Planning DJ recalculé');
    } catch (err) {
      showToast('Recalcul : échec', true);
    } finally {
      djRecalculateBtn.disabled = false;
    }
  });
}

// ── Fil rouge : téléchargement de masse ──────────────────────────────────────

const filRougeDownloader = createFilRougeDownloader({
  getDownloaderApiUrl,
  getDownloaderApiToken,
  prefetchTrackToLocalCache,
  setFilRougeTrackStatus,
  getFilRougeTrackStatus,
  renderFilRouge,
  showToast,
});

if (filRougeDownloadAllBtn) {
  filRougeDownloadAllBtn.addEventListener('click', () => {
    const tracks = filRougeManager.getPlaylist();
    filRougeDownloader.downloadAll(tracks).catch(err => {
      showToast('Téléchargement : erreur', true);
      console.error('[filrouge] downloadAll error', err);
    });
  });
}

// Mise à jour des statuts après un Background Fetch terminé par le SW
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', e => {
    const { type, succeededKeys = [], failedKeys = [] } = e?.data || {};
    if (type !== 'BG_FETCH_DONE' && type !== 'BG_FETCH_FAIL') return;

    if (type === 'BG_FETCH_FAIL') {
      showToast('Téléchargement arrière-plan : échec', true);
      const playlist = filRougeManager.getPlaylist();
      for (const track of playlist) {
        const { downloadState } = getFilRougeTrackStatus(track);
        if (downloadState === 'downloading') {
          setFilRougeTrackStatus(track, { downloadState: 'error' });
        }
      }
      renderFilRouge();
      return;
    }

    const playlist = filRougeManager.getPlaylist();
    for (const track of playlist) {
      const key = String(track.id || `${(track.artist || '').toLowerCase()}::${(track.name || '').toLowerCase()}`);
      if (succeededKeys.includes(key)) {
        setFilRougeTrackStatus(track, { downloadState: 'done' });
      } else if (failedKeys.includes(key)) {
        setFilRougeTrackStatus(track, { downloadState: 'error' });
      }
    }
    renderFilRouge();
    showToast(`Téléchargement terminé : ${succeededKeys.length} réussi${succeededKeys.length > 1 ? 's' : ''}`);
  });
}

// Initial render
renderFilRouge();
updateDjExternalPlanUI();

/**
 * Au chargement de la page, vérifie quels morceaux du fil rouge sont déjà
 * dans le cache local du navigateur et met à jour leurs labels en conséquence.
 * Les morceaux absents du cache sont téléchargés en séquentiel puis marqués.
 */
async function startFilRougeStartupCacheSync() {
  const playlist = filRougeManager.getPlaylist();
  if (!playlist.length) return;

  // Phase 1 : vérification rapide du cache sans téléchargement
  for (const track of playlist) {
    const inCache = await isTrackInLocalCache(track).catch(() => false);
    if (inCache) {
      autoModeManager.fetchMixData(track.name, track.artist).catch(() => {});
      setFilRougeTrackStatus(track, {
        downloadState: 'done',
        stemsOk: hasStemsForTrack(track),
      });
    }
  }
  renderFilRouge();

  // Phase 2 : télécharger ce qui manque (3 en parallèle)
  const toDownload = playlist.filter(track => {
    const key = getFilRougeTrackKey(track);
    const existing = filRougeTrackStatusByKey.get(key);
    return existing?.downloadState !== 'done';
  });
  const BATCH_SIZE = 3;
  for (let i = 0; i < toDownload.length; i += BATCH_SIZE) {
    const batch = toDownload.slice(i, i + BATCH_SIZE);
    for (const track of batch) {
      setFilRougeTrackStatus(track, { downloadState: 'downloading', stemsOk: hasStemsForTrack(track) });
    }
    renderFilRouge();
    const batchResults = await Promise.allSettled(
      batch.map(track => prefetchTrackToLocalCache(track).catch(() => false))
    );
    for (let j = 0; j < batch.length; j++) {
      const track = batch[j];
      const ok = batchResults[j].status === 'fulfilled' && batchResults[j].value;
      if (ok) {
        autoModeManager.fetchMixData(track.name, track.artist).catch(() => {});
        setFilRougeTrackStatus(track, { downloadState: 'done', stemsOk: hasStemsForTrack(track) });
      } else {
        setFilRougeTrackStatus(track, { downloadState: 'error', stemsOk: hasStemsForTrack(track) });
      }
    }
    renderFilRouge();
  }
}

function isCacheTabActive() {
  return Boolean(tabPanels.playlist && tabPanels.playlist.classList.contains('active') && !tabPanels.playlist.hidden);
}

const renderDeckState = (detail) => {
  uiRenderer.renderDeckState(detail);
  updatePlannedStartMarker();
  updateSuggestionRefreshButtons();
};
const updateNowPlaying = (item, deck = getFocusDeck()) => uiRenderer.updateNowPlaying(item, deck);
const updateUpcomingArtwork = () => uiRenderer.updateUpcomingArtwork();

function getResolvedActiveDeck() {
  const activeDeck = player?.activeDeck;
  return toDeck(activeDeck);
}

function getResolvedInactiveDeck() {
  return getOtherDeck(getResolvedActiveDeck());
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
 * Central deck state controller.
 * Assigns an item (or null) to a deck and synchronises all dependent UI in one shot:
 *   - deckDisplayItems mutation
 *   - stem button state
 *   - deck title/meta labels (refreshDeckMetaDisplays)
 *   - cue panel highlight (updateDeckCueUI)
 *
 * Always use this instead of writing deckDisplayItems[deck] directly so that UI
 * and internal state can never diverge.
 *
 * @param {'A'|'B'} deck
 * @param {object|null} item  Queue item, or null to clear the deck.
 */
function setDeckItem(deck, item) {
  const safeDeck = deck === 'B' ? 'B' : 'A';
  deckDisplayItems[safeDeck] = item ?? null;

  const hasStemsInCache = !!(
    item?.localStemUrls?.vocalsUrl || item?.localStemUrls?.instrumentalUrl ||
    item?.stems?.vocalsUrl || item?.stems?.instrumentalUrl
  );
  stemsLoadedPerDeck[safeDeck] = hasStemsInCache;
  updateStemButtonState(safeDeck);

  if (item) fetchMissingMeta(item).catch(() => {});
  uiRenderer.refreshDeckMetaDisplays();
  updateDeckCueUI();
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
    if (deckAstemsIndicator) deckAstemsIndicator.hidden = !stemsAvailable;
  } else {
    if (deckBstemsIndicator) deckBstemsIndicator.hidden = !stemsAvailable;
  }
}

function setDeckFilterModeForDeck(deck, mode) {
  const safeDeck = deck === 'B' ? 'B' : 'A';
  const safeMode = mode === 'lowPass' || mode === 'highPass' ? mode : 'off';
  const nextDeckFx = {
    A: { vocalRemove: false, instruRemove: false, filterMode: 'off', ...(mixFeatures.deckFx?.A || {}) },
    B: { vocalRemove: false, instruRemove: false, filterMode: 'off', ...(mixFeatures.deckFx?.B || {}) },
  };
  nextDeckFx[safeDeck] = {
    ...nextDeckFx[safeDeck],
    filterMode: safeMode,
  };

  mixFeatures = {
    ...mixFeatures,
    deckFx: nextDeckFx,
  };
  applyMixFeatures();
  updateDjFxMenuUI();
}

function toggleDeckFilterMode(deck, requestedMode) {
  const safeDeck = deck === 'B' ? 'B' : 'A';
  const safeMode = requestedMode === 'lowPass' || requestedMode === 'highPass' ? requestedMode : 'off';
  const currentMode = mixFeatures.deckFx?.[safeDeck]?.filterMode || 'off';
  const nextMode = currentMode === safeMode ? 'off' : safeMode;
  setDeckFilterModeForDeck(safeDeck, nextMode);
}

/**
 * Fire-and-forget: enrich item stems from the server, then notify mixFeatures
 * of the updated URLs if the item is still loaded on the given deck.
 */
function backgroundEnrichStems(deck, item) {
  if (!item || !deck) return;

  // If all stems are already loaded in memory, update deck state immediately without API
  const existingStems = item.localStemUrls || item.stems;
  if (existingStems?.vocalsUrl && existingStems?.instrumentalUrl) {
    if (deckDisplayItems[deck] === item) {
      stemsLoadedPerDeck[deck] = true;
      updateStemButtonState(deck);
      player?.updateDeckStems(deck, existingStems);
    }
    return;
  }

  enqueueBackgroundTask(() => enrichStemsFromServer(item)
    .then(() => {
      // After enrichment, check if stems are now available
      const stems = item.localStemUrls || item.stems;
      if (!stems?.vocalsUrl && !stems?.instrumentalUrl && !stems?.echoUrl && !stems?.distortionUrl) return; // no stems found
      if (deckDisplayItems[deck] !== item) return; // item was swapped out

      // Vocal/instrumental toggles depend on classic stems availability.
      stemsLoadedPerDeck[deck] = Boolean(stems?.vocalsUrl || stems?.instrumentalUrl);
      updateStemButtonState(deck);

      player?.updateDeckStems(deck, stems);
      logDebug('stems.enriched.deck', {
        deck,
        id: item?.id,
        hasVocals: !!stems.vocalsUrl,
        hasInstrumental: !!stems.instrumentalUrl,
        hasEcho: !!stems.echoUrl,
        hasDistortion: !!stems.distortionUrl,
      });
    })
    .catch((err) => {
      logWarn('stems.enrichment.error', { deck, id: item?.id, error: err?.message });
    })
  );
}

function getTrackMixData(item) {
  if (!item) return null;

  const trackId = item.id;
  if (trackId && deckMixDataByTrackId.has(trackId)) {
    return deckMixDataByTrackId.get(trackId);
  }

  return item.mixData || null;
}

function storeTrackMixData(item, mixData) {
  if (!item || !mixData) return;

  const trackId = item.id;
  if (trackId) {
    deckMixDataByTrackId.set(trackId, mixData);
  }
}

function resolveMixDataStartOffsetMs(mixData) {
  if (!mixData || typeof mixData !== 'object') return 0;

  const toFiniteNumber = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  };

  // Prefer recommendedSongStartSec (explicit API recommendation) over probableSongStartSec.
  const recommendedSongStartSec = toFiniteNumber(mixData.recommendedSongStartSec);
  const probableStartSec = toFiniteNumber(mixData.probableSongStartSec);
  const hasProbableStart = probableStartSec != null && probableStartSec > 0;

  let recommendedSec = 0;
  if (recommendedSongStartSec != null && recommendedSongStartSec > 0) {
    recommendedSec = recommendedSongStartSec;
  } else if (hasProbableStart) {
    recommendedSec = probableStartSec;
  }

  // Honor explicit recommendation fields when present on mix payload.
  const explicitOffsetMs = resolveTrackStartOffsetMs(mixData);
  if (explicitOffsetMs > 0) {
    recommendedSec = Math.max(recommendedSec, explicitOffsetMs / 1000);
  }

  // Use startRecommendation from the API when available — it is authoritative.
  const startRec = mixData.startRecommendation && typeof mixData.startRecommendation === 'object'
    ? mixData.startRecommendation
    : null;

  const introLooksSlow = startRec != null
    ? Boolean(startRec.introLooksSlow)
    : hasProbableStart && probableStartSec >= 6;

  // introDanceability and laterDanceabilityPeak come from startRecommendation directly.
  const introDanceability = toFiniteNumber(startRec?.introDanceability);
  const laterDanceabilityPeak = toFiniteNumber(startRec?.laterDanceabilityPeak);
  const startRecConfidence = toFiniteNumber(startRec?.confidence) ?? 1;

  // Fallback: read from indicators sub-fields if startRecommendation not present.
  const indicators = mixData.indicators && typeof mixData.indicators === 'object'
    ? mixData.indicators
    : null;

  const introDanceabilityFallback = introDanceability ?? toFiniteNumber(
    indicators?.introDanceability
    ?? indicators?.openingDanceability
    ?? indicators?.startDanceability
    ?? indicators?.danceabilityIntro
  );
  const introEnergy = toFiniteNumber(
    indicators?.introEnergy
    ?? indicators?.openingEnergy
    ?? indicators?.startEnergy
    ?? indicators?.energyIntro
  );

  const sortedPeakZones = Array.isArray(mixData.peakZones)
    ? [...mixData.peakZones]
      .filter((zone) => Number.isFinite(Number(zone?.startSec)))
      .sort((a, b) => Number(a.startSec) - Number(b.startSec))
    : [];

  const firstPeakZone = sortedPeakZones[0] || null;
  const firstPeakStartSec = Number(firstPeakZone?.startSec);
  const hasPeak = Number.isFinite(firstPeakStartSec) && firstPeakStartSec > 0;
  const firstPeakScore = toFiniteNumber(firstPeakZone?.score);

  const isDanceMode = djMode === 'dance';

  // introLooksWeak: use API's introLooksSlow if confident, else fall back to heuristics.
  // Dance mode uses lower danceability/energy thresholds to skip intros more aggressively.
  const introDanceabilityThreshold = isDanceMode ? 0.55 : 0.45;
  const introEnergyThreshold = isDanceMode ? 0.5 : 0.4;

  const introLooksWeak = startRec != null && startRecConfidence >= 0.5
    ? introLooksSlow || (introDanceability != null && introDanceability <= introDanceabilityThreshold)
    : (
      (introDanceabilityFallback != null && introDanceabilityFallback <= introDanceabilityThreshold)
      || (introEnergy != null && introEnergy <= introEnergyThreshold)
      || (hasProbableStart && probableStartSec >= 6)
    );

  // Dance mode accepts peaks closer to the intro end (4s vs 8s buffer).
  const peakMinOffset = isDanceMode ? 4 : 8;
  const peakIsLateEnough = hasPeak
    && firstPeakStartSec >= Math.max(10, (hasProbableStart ? probableStartSec : 0) + peakMinOffset)
    && (firstPeakScore == null || firstPeakScore >= 0.25);

  // When API says intro is slow and there's a later danceability peak, skip to it.
  if (introLooksWeak && laterDanceabilityPeak != null && laterDanceabilityPeak > 0) {
    // laterDanceabilityPeak is a value (0-1), not a time; use peakZones for timing.
    if (peakIsLateEnough) {
      recommendedSec = Math.max(recommendedSec, firstPeakStartSec);
    }
  } else if (introLooksWeak && peakIsLateEnough) {
    // If intro is likely non-danceable, start from first peak to keep momentum.
    recommendedSec = Math.max(recommendedSec, firstPeakStartSec);
  }

  // Dance mode: skip intro directly to first couplet when BPM drops vs previous track,
  // or when the backend signals a flat/ambient intro energy profile.
  if (isDanceMode) {
    const introBpm = toFiniteNumber(startRec?.introBpm);
    const firstCoupletSec = toFiniteNumber(startRec?.firstCoupletSec);
    const introEnergyProfile = startRec?.introEnergyProfile;

    const currentBpm = getActiveDeckBpm() ?? 0;
    const introBpmTooLow = introBpm != null && currentBpm > 0 && introBpm < currentBpm - 3;
    const introProfileWeak = introEnergyProfile === 'flat' || introEnergyProfile === 'ambient';

    if (introBpmTooLow || introProfileWeak) {
      const targetSec = (firstCoupletSec != null && firstCoupletSec > 0)
        ? firstCoupletSec
        : hasPeak
          ? firstPeakStartSec
          : (probableStartSec ?? 0);
      if (targetSec > 0) {
        recommendedSec = Math.max(recommendedSec, targetSec);
      }
    }
  }

  if (!Number.isFinite(recommendedSec) || recommendedSec <= 0) return 0;
  return Math.round(recommendedSec * 1000);
}

function applyMixSuggestedStartOffset(item, mixData, options = {}) {
  if (!item || !mixData) return false;

  const { overrideExisting = false } = options;
  const existingOffsetMs = Math.max(0, Number(item.autoDjStartOffsetMs) || 0);
  if (existingOffsetMs > 0 && !overrideExisting) return false;

  const suggestedOffsetMs = resolveMixDataStartOffsetMs(mixData);
  if (suggestedOffsetMs <= 0) return false;

  const durationMs = Math.max(0, Number(item.duration) || 0);
  const cappedOffsetMs = durationMs > 0
    ? Math.max(0, Math.min(suggestedOffsetMs, Math.max(0, durationMs - 1000)))
    : Math.max(0, suggestedOffsetMs);

  if (cappedOffsetMs <= 0 || cappedOffsetMs === existingOffsetMs) return false;

  item.autoDjStartOffsetMs = cappedOffsetMs;
  touchQueueItem(item);
  logInfo('autoDj: start offset updated from mix data', {
    id: item.id,
    name: item.name,
    artist: item.artist,
    startOffsetMs: cappedOffsetMs,
  });
  return true;
}

/**
 * Applies the start offset (`mixInSec`) recommended by `/api/dj/transition`
 * for the incoming track, taking priority over `applyMixSuggestedStartOffset`
 * (which no-ops once `item.autoDjStartOffsetMs` is already set).
 * @param {object} item
 * @param {{mixInSec: number, decisionId?: string}|null} plan
 * @returns {boolean} true if `item.autoDjStartOffsetMs` was updated
 */
function applyDjStartOffsetIfPlanned(item, plan) {
  if (!item || !plan) return false;
  if (!Number.isFinite(plan.mixInSec) || plan.mixInSec < 0) return false;

  const suggestedOffsetMs = Math.round(plan.mixInSec * 1000);
  const existingOffsetMs = Math.max(0, Number(item.autoDjStartOffsetMs) || 0);

  const durationMs = Math.max(0, Number(item.duration) || 0);
  const cappedOffsetMs = durationMs > 0
    ? Math.max(0, Math.min(suggestedOffsetMs, Math.max(0, durationMs - 1000)))
    : Math.max(0, suggestedOffsetMs);

  if (cappedOffsetMs <= 0 || cappedOffsetMs === existingOffsetMs) return false;

  item.autoDjStartOffsetMs = cappedOffsetMs;
  touchQueueItem(item);
  logInfo('djPlan: start offset applied', {
    id: item.id,
    name: item.name,
    artist: item.artist,
    startOffsetMs: cappedOffsetMs,
    decisionId: plan.decisionId,
  });
  return true;
}

function preloadMixDataForDeckItem(item, deck) {
  if (!item) return;

  const currentDeck = deck === 'B' ? 'B' : 'A';
  return autoModeManager.fetchMixData(item.name, item.artist)
    .then((mixData) => {
      if (!mixData) return;

      storeTrackMixData(item, mixData);

      // Ne pas écraser l'offset du batch plan (mixInSecDefined) avec le calcul zone-based.
      const activePlan = djExternalPlanEnabled ? djPlanManager.getDjTransitionPlan(item) : null;
      const hasBatchOffset = activePlan?.mixInSecDefined;
      if (!hasBatchOffset) {
        const startOffsetUpdated = applyMixSuggestedStartOffset(item, mixData);
        if (startOffsetUpdated) {
          updatePlannedStartMarker();
          renderQueue();
        }
      }

      if (deckDisplayItems[currentDeck] === item) {
        renderMixZones();
      }
    })
    .catch((err) => {
      logWarn('autoDj: mix preload failed', {
        deck: currentDeck,
        id: item.id,
        error: err?.message,
      });
    });
}



document.getElementById('toggle-mix-menu-btn')?.addEventListener('click', () => {
  if (!tabPanels.mix || !deckMixControl) return;
  const isCollapsed = tabPanels.mix.classList.toggle('mix-options-collapsed');
  deckMixControl.setAttribute('aria-hidden', String(isCollapsed));
  if (!isCollapsed) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollMixControlIntoView();
      });
    });
  }
});

function scrollMixControlIntoView() {
  if (!tabPanels.mix || !deckMixControl) return;

  const panel = tabPanels.mix;
  const panelRect = panel.getBoundingClientRect();
  const controlRect = deckMixControl.getBoundingClientRect();
  const playerSection = panel.querySelector('.player-section');
  const stickyHeight = Math.max(0, Number(playerSection?.getBoundingClientRect().height) || 0);

  // Keep the mix controls below the sticky decks header and with a small bottom margin.
  const topOffset = stickyHeight + 10;
  const bottomMargin = 12;
  const visibleTop = panelRect.top + topOffset;
  const visibleBottom = panelRect.bottom - bottomMargin;
  const fullyVisible = controlRect.top >= visibleTop && controlRect.bottom <= visibleBottom;
  if (fullyVisible) return;

  const controlTopInPanel = (controlRect.top - panelRect.top) + panel.scrollTop;
  const desiredTop = Math.max(0, controlTopInPanel - topOffset);
  const maxTop = Math.max(0, panel.scrollHeight - panel.clientHeight);

  panel.scrollTo({
    top: Math.min(desiredTop, maxTop),
    behavior: 'smooth',
  });
}

const autoFadeManager = new AutoFadeManager({
  getQueueLength: () => queue.length,
  getCurrentIndex: () => uiState.currentIndex,
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

const djApiClient = createDjApiClient({
  apiHealthMonitor,
  getDownloaderApiToken,
  getDownloaderApiUrl,
  logger,
});

const djPlanManager = createDjPlanManager({
  djApiClient,
  getFilRougeManager: () => filRougeManager,
  getQueue: () => queue,
  logger,
});

const autoModeManager = createAutoModeManager({
  apiHealthMonitor,
  getDownloaderApiToken,
  getDownloaderApiUrl,
  getFilRougeManager: () => filRougeManager,
  getQueue: () => queue,
  getCurrentTrackId: () => uiState.currentTrackId,
  getCurrentTrackIndex: () => uiState.currentIndex,
  searchTracksViaApi,
  addToQueue,
  showToast,
  logger,
  getTrackMaxDurationSec: () => trackMaxDurationAppliedSec,
  getAutoFxMinGapMs: () => getSafeAutoDjFxMinIntervalSec(autoDjFxSettings.minIntervalSec) * 1000,
  getAutoFxMaxGapMs: () => getAutoDjFxMaxGapMs(autoDjFxSettings),
  getDjMode: () => djMode,
  getDjModeGenrePrefs: () => djModeGenrePrefs,
  getCurrentBpm: getActiveDeckBpm,
  getActualDurationMs: () => playbackDurationMs,
  onAutomixTimingCalculated: (triggerMs) => {
    let finalTriggerMs = triggerMs;
    const nextFilRougeItem = filRougeManager.peekNextTrackFromAny();
    const djPlan = djExternalPlanEnabled ? djPlanManager.getDjTransitionPlan(nextFilRougeItem) : null;
    if (djPlan && Number.isFinite(djPlan.mixOutSec) && djPlan.mixOutSec > 0) {
      finalTriggerMs = Math.round(djPlan.mixOutSec * 1000);
      logDebug('djPlan: automix timing override', { triggerMs: finalTriggerMs, decisionId: djPlan.decisionId });
    }
    setAutomixTriggerMs(automixTimeline, finalTriggerMs);
    logDebug('autoDj: timing calculated', { triggerMs: finalTriggerMs });
    updateAutoDjMarker();
    updateMaxDurationMarker();
  },
  onMixDataUpdated: () => {
    renderMixZones();
    updateMaxDurationMarker();
  },
  onAutoFxPlanCalculated: (events, meta) => {
    logDebug('autoDj: creative fx plan', {
      total: events?.length || 0,
      events: (events || []).map((event) => ({
        type: event.type,
        timeMs: event.timeMs,
      })),
      windowMinutes: meta?.lastWindowMinutes,
      maxInWindow: meta?.maxInLastWindow,
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Refactored module instances (factory pattern, dependency injection)
// Old function bodies remain below as they are still wired to event listeners
// and the init() function; migrate call sites incrementally.
// ─────────────────────────────────────────────────────────────────────────────

const settingsCtrl = createSettingsController({
  initialTransitionMode: selectedTransitionMode,
  initialRamFilterEnabled: ramFilterEnabled,
  initialRamTotalMbOverride: ramTotalMbOverride,
  initialTrackMaxDurationSec: trackMaxDurationSec,
  initialTrackMaxDurationEnabled: trackMaxDurationEnabled,
  initialTrackMaxDurationMode: trackMaxDurationMode,
  initialTrackMaxDurationPct: trackMaxDurationPct,
  initialAutoSuggestionQueueSearchEnabled: autoSuggestionQueueSearchEnabled,
  initialQueueLoopEnabled: queueLoopEnabled,
  initialQueueShuffleEnabled: queueShuffleEnabled,
  clampCrossfadeSeconds,
  getCrossfadeSeconds: () => clampCrossfadeSeconds(Number(crossfadeSlider?.value) || 6),
  getPlayer: () => player,
  getQueue: () => queue,
  autoModeManager,
  getAutoDjFxSettings: () => autoDjFxSettings,
  setDebugLogging: (v) => setDebugLoggingEnabled(v),
  updateDjFxMenuUI,
  updateMaxDurationMarker: () => deckMarkerCtrl?.updateMaxDurationMarker(),
  updateSuggestionRefreshButtons,
  trimRetainedAudioSources,
  showToast,
  logInfo, logDebug, logWarn,
  trackMaxDurationInput,
  trackMaxDurationToggle,
  trackMaxDurationMinus,
  trackMaxDurationPlus,
  trackMaxDurationModeBtn,
  trackMaxDurationPctInput,
  trackMaxDurationSecRow,
  trackMaxDurationPctRow,
});

const queueMgr = createQueueManager({
  getQueueLoopEnabled: () => queueLoopEnabled,
  getQueueShuffleEnabled: () => queueShuffleEnabled,
  getPlayer: () => player,
  getResolvedInactiveDeck,
  startPlaybackForIndex: (idx, mode, opts) => playbackCtrl?.startPlaybackForIndex(idx, mode, opts),
  setDeckItem: (deck, item) => playbackCtrl?.setDeckItem(deck, item),
  closeSearch,
  showCrossfadeRing,
  showToast,
  logInfo, logDebug,
  fetchAndStoreArtworkForItem,
  preloadMixDataForDeckItem,
  ensureLocalSource,
  renderQueue,
  scheduleDjSetQualityRefresh: () => filRougeCtrl?.scheduleDjSetQualityRefresh(),
  updateDeckCueUI,
  releaseLocalBlob,
  isLowMemoryPlaybackMode,
  trimRetainedAudioSources,
  getPendingFilRougeOnInactiveDeck: () => pendingFilRougeOnInactiveDeck,
  setPendingFilRougeOnInactiveDeck: (v) => { pendingFilRougeOnInactiveDeck = v; },
  setPendingAutoplay: (v) => { pendingAutoplay = v; },
  scheduleIdle,
  enqueueBackgroundTask,
  getQueueList: () => queueList,
});

const filRougeCtrl = createFilRougeController({
  filRougeManager,
  djPlanManager,
  getDjExternalPlanEnabled: () => djExternalPlanEnabled,
  fetchMissingMeta,
  addToQueue: (...args) => queueMgr.addToQueue(...args),
  addSpotifyDeletedId,
  showToast,
  logWarn,
  filRougeCountEl,
  filRougePriorityCountEl,
  filRougeShuffleBtn,
  filRougeLoopBtn,
  filRougePriorityListEl,
  filRougePlaylistListEl,
  djPlanIndicatorEl,
  djSetQualityBadgeEl,
  djSetProfileSelectEl,
});

const deckMarkerCtrl = createDeckMarkerController({
  automixTimeline,
  autoModeManager,
  getPlaybackDurationMs: () => playbackDurationMs,
  getQueue: () => queue,
  getResolvedInactiveDeck,
  getTrackMixData,
  filRougeManager,
  djPlanManager,
  getDjExternalPlanEnabled: () => djExternalPlanEnabled,
  getTrackMaxDurationEnabled: () => settingsCtrl.getTrackMaxDurationEnabled(),
  getTrackMaxDurationSec: () => settingsCtrl.getTrackMaxDurationSec(),
  getTrackMaxDurationAppliedSec: () => settingsCtrl.getTrackMaxDurationAppliedSec(),
  getTrackMaxDurationMode: () => settingsCtrl.getTrackMaxDurationMode(),
  computePctMaxDurationSec: (mixData, durationMs) => settingsCtrl.computePctMaxDurationSec(mixData, durationMs),
  setTrackMaxDurationAppliedSec: (sec) => settingsCtrl.setTrackMaxDurationAppliedSec(sec),
  logDebug,
  deckAAutoDjMarker,
  deckBAutoDjMarker,
  deckAAutoDjStartMarker,
  deckBAutoDjStartMarker,
  deckADjPlanZone,
  deckBDjPlanZone,
  deckAMaxDurMarker,
  deckBMaxDurMarker,
  deckAMaxDurRawMarker,
  deckBMaxDurRawMarker,
  deckAProgressZones,
  deckBProgressZones,
});

const playbackCtrl = createPlaybackController({
  getPlayer: () => player,
  getQueue: () => queue,
  getDjMode: () => djMode,
  getActiveDeckBpm,
  getResolvedActiveDeck,
  getResolvedInactiveDeck,
  getFollowingQueueIndex: (...args) => queueMgr.getFollowingQueueIndex(...args),
  touchQueueItem: (item) => queueMgr.touchQueueItem(item),
  removeFromQueue: (idx) => queueMgr.removeFromQueue(idx),
  prefetchNext: (idx) => queueMgr.prefetchNext(idx),
  resolveTrackStartOffsetMs: (track) => queueMgr.resolveTrackStartOffsetMs(track),
  preloadMixDataForDeckItem,
  ensureLocalSource,
  fetchAndStoreArtworkForItem,
  enrichStemsFromServer,
  enqueueBackgroundTask,
  filRougeManager,
  djPlanManager,
  getDjExternalPlanEnabled: () => djExternalPlanEnabled,
  autoModeManager,
  getAutoSuggestionQueueSearchEnabled: () => autoSuggestionQueueSearchEnabled,
  automixTimeline,
  renderQueue,
  renderFilRouge,
  updateNowPlaying,
  updatePlannedStartMarker: () => deckMarkerCtrl.updatePlannedStartMarker(),
  updateUpcomingArtwork,
  suggestGenreFromCurrentTrack,
  applyDjModeFxPreset,
  scheduleIdle,
  trimRetainedAudioSources,
  isLowMemoryPlaybackMode,
  showToast,
  logInfo, logDebug, logWarn, logError,
  applyDeckMixRatio,
  updateAutoDjMarker: () => deckMarkerCtrl.updateAutoDjMarker(),
  updateMaxDurationMarker: () => deckMarkerCtrl.updateMaxDurationMarker(),
  applyTrackMaxDurationForCurrentPlayback: () => applyTrackMaxDurationForCurrentPlayback(),
  resetTrackCaches: () => {
    maxDurMarkerTriggeredForTrack = false;
    _maxDurMarkerCache.key = null;
    _maxDurMarkerCache.renderKey = null;
    _maxDurMarkerCache.rawLogged = false;
    _plannedStartMarkerLastKey = null;
    automixRescheduledForTrackId = null;
  },
  fetchMissingMeta,
  refreshDeckMetaDisplays: () => uiRenderer.refreshDeckMetaDisplays(),
  updateDeckCueUI,
  getPendingFilRougeOnInactiveDeck: () => pendingFilRougeOnInactiveDeck,
  setPendingFilRougeOnInactiveDeck: (v) => { pendingFilRougeOnInactiveDeck = v; },
  deckAstemsIndicator,
  deckBstemsIndicator,
  autoMixBtn,
});

// ─────────────────────────────────────────────────────────────────────────────

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
    if (tab === 'filrouge') {
      renderFilRouge();
    }
    if (tab === 'config' && spotifyClient.isConnected()) {
      refreshSpotifyPlaylistDropdown().catch(() => {});
    }
  });
});

// --- DJ Mode UI ---

function renderDjModeUI() {
  const isDance = djMode === 'dance';
  if (configDjModeDanceBtn) {
    configDjModeDanceBtn.classList.toggle('dj-mode-btn--active', isDance);
    configDjModeDanceBtn.setAttribute('aria-pressed', String(isDance));
  }
  if (configDjModeMusicBtn) {
    configDjModeMusicBtn.classList.toggle('dj-mode-btn--active', !isDance);
    configDjModeMusicBtn.setAttribute('aria-pressed', String(!isDance));
  }
  if (configDanceGenrePrefs) {
    configDanceGenrePrefs.hidden = !isDance;
  }
  if (cacheGenreFilterFieldEl) {
    cacheGenreFilterFieldEl.hidden = !isDance;
    if (!isDance && cacheGenreFilterEl && cacheGenreFilterEl.value) {
      cacheGenreFilterEl.value = '';
      cacheGenreFilterEl.dispatchEvent(new Event('change'));
    }
  }
  if (isDance) renderGenreList();
}

function getDanceGenreOptions() {
  const fromQueue = queue.map((item) => String(item?.genre || '').trim()).filter(Boolean);
  const fromDecks = [
    String(deckDisplayItems.A?.genre || '').trim(),
    String(deckDisplayItems.B?.genre || '').trim(),
  ].filter(Boolean);
  return Array.from(new Set([...DANCE_GENRE_DEFAULTS, ...djModeGenrePrefs, ...fromQueue, ...fromDecks]));
}

function renderGenreList() {
  if (!configDanceGenreList) return;
  const options = getDanceGenreOptions();
  configDanceGenreList.innerHTML = '';

  for (const genre of options) {
    const option = document.createElement('option');
    option.value = genre;
    option.textContent = genre;
    configDanceGenreList.appendChild(option);
  }

  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = 'Tous les genres';
  configDanceGenreList.insertBefore(emptyOption, configDanceGenreList.firstChild);

  const selectedGenre = String(djModeGenrePrefs[0] || '').trim().toLowerCase();
  configDanceGenreList.value = '';
  if (selectedGenre) {
    for (const option of configDanceGenreList.options) {
      if (String(option.value).trim().toLowerCase() === selectedGenre) {
        configDanceGenreList.value = option.value;
        break;
      }
    }
  }
}

function setPreferredDanceGenre(genre) {
  const selected = String(genre || '').trim();
  djModeGenrePrefs = selected ? [selected] : [];
  persistDjModeGenrePrefs(djModeGenrePrefs);
  renderGenreList();
}

function handleGenreChipClick(event) {
  const target = event.target instanceof HTMLElement ? event.target.closest('.queue-chip--genre[data-genre]') : null;
  if (!target) return;
  event.preventDefault();
  event.stopPropagation();
  setPreferredDanceGenre(target.dataset.genre);
}

function suggestGenreFromCurrentTrack() {
  if (djMode !== 'dance') return;
  const genre = getActiveDeckGenre();
  if (!genre || djModeGenrePrefs.includes(genre)) return;
  // Auto-suggestion: keep a single preferred genre in Dance mode.
  djModeGenrePrefs = [genre];
  persistDjModeGenrePrefs(djModeGenrePrefs);
  renderGenreList();
}

function setDjMode(mode) {
  djMode = mode;
  persistDjModeSetting(mode);
  applyDjModeFxPreset(mode, getActiveDeckBpm());
  renderDjModeUI();
  renderQueue();
  uiRenderer.refreshDeckMetaDisplays();
  if (uiState.lastDeckState) renderDeckState(uiState.lastDeckState);
  logDebug('djMode: changed', { mode, bpm: getActiveDeckBpm() });
}

configDjModeDanceBtn?.addEventListener('click', () => setDjMode('dance'));
configDjModeMusicBtn?.addEventListener('click', () => setDjMode('music'));

// Initialize DJ mode buttons from config
if (configDjModeDanceBtn) {
  configDjModeDanceBtn.title = DJ_MODES.dance.title;
  configDjModeDanceBtn.setAttribute('aria-label', DJ_MODES.dance.ariaLabel);
}
if (configDjModeMusicBtn) {
  configDjModeMusicBtn.title = DJ_MODES.music.title;
  configDjModeMusicBtn.setAttribute('aria-label', DJ_MODES.music.ariaLabel);
}

configDanceGenreList?.addEventListener('change', () => {
  setPreferredDanceGenre(configDanceGenreList.value);
});

queueList?.addEventListener('click', handleGenreChipClick, true);
trackArtistA?.addEventListener('click', handleGenreChipClick);
trackArtistB?.addEventListener('click', handleGenreChipClick);

spotifyPlaylistSelect?.addEventListener('change', () => {
  const selectedId = spotifyPlaylistSelect.value;
  if (selectedId && spotifyPlaylistInput) {
    spotifyPlaylistInput.value = selectedId;
  }
});

spotifyClientIdInput?.addEventListener('change', () => {
  try {
    localStorage.setItem(STORAGE_KEYS.spotifyClientId, String(spotifyClientIdInput.value || '').trim());
  } catch (_) {
    // ignore storage failures
  }
});

spotifyConnectBtn?.addEventListener('click', async () => {
  const clientId = String(spotifyClientIdInput?.value || '').trim();
  if (!clientId) {
    setSpotifyStatus('Client ID Spotify manquant', true);
    return;
  }
  try {
    setSpotifyStatus('Redirection vers Spotify...');
    await spotifyClient.startLogin(clientId);
  } catch (err) {
    setSpotifyStatus(`Connexion Spotify impossible: ${err.message}`, true);
  }
});

spotifyDisconnectBtn?.addEventListener('click', () => {
  spotifyClient.clearAuth();
  stopSpotifyFilRougeSync();
  spotifyPrefetchGeneration++;
  updateSpotifyConfigUi();
  showToast('Spotify déconnecté');
});

spotifyImportFilRougeBtn?.addEventListener('click', async () => {
  try {
    setSpotifyStatus('Import Spotify en cours...');
    await importSpotifyPlaylistToFilRouge();
  } catch (err) {
    setSpotifyStatus(`Import Spotify impossible: ${err.message}`, true);
    showToast(`Import Spotify impossible: ${err.message}`, true);
  }
});

txtImportFilRougeBtn?.addEventListener('click', async () => {
  try {
    let text = '';
    const file = txtPlaylistFileInput?.files?.[0];
    if (file) {
      text = await file.text();
    } else {
      text = txtPlaylistTextarea?.value || '';
    }
    const tracks = parseTxtPlaylist(text);
    if (!tracks.length) {
      setTxtPlaylistStatus('Aucun morceau trouvé. Vérifiez le format (artiste - titre).', true);
      return;
    }
    applyTxtPlaylistToFilRouge(tracks);
    if (txtPlaylistFileInput) txtPlaylistFileInput.value = '';
    if (txtPlaylistTextarea) txtPlaylistTextarea.value = '';
    setTxtPlaylistStatus(`Fil rouge importé depuis TXT (${tracks.length} morceau${tracks.length > 1 ? 'x' : ''}). Téléchargement serveur en cours…`);
    showToast(`Fil rouge importé depuis TXT (${tracks.length} morceau${tracks.length > 1 ? 'x' : ''})`);
    await startTxtPlaylistPrefetch(tracks);
  } catch (err) {
    setTxtPlaylistStatus(`Import TXT impossible: ${err.message}`, true);
    showToast(`Import TXT impossible: ${err.message}`, true);
  }
});

function setApiMixPlaylistStatus(msg, isError = false) {
  if (!apiMixPlaylistStatus) return;
  apiMixPlaylistStatus.textContent = msg;
  apiMixPlaylistStatus.style.color = isError ? 'var(--error, #e55)' : '';
}

async function refreshApiMixPlaylists() {
  if (!apiMixPlaylistSelect) return;
  setApiMixPlaylistStatus('Chargement des playlists…');
  const names = await djApiClient.fetchMixPlaylists();
  const prev = apiMixPlaylistSelect.value;
  apiMixPlaylistSelect.innerHTML = '<option value="">— Choisir une playlist —</option>';
  for (const name of names) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (name === prev) opt.selected = true;
    apiMixPlaylistSelect.appendChild(opt);
  }
  if (names.length) {
    setApiMixPlaylistStatus(`${names.length} playlist${names.length > 1 ? 's' : ''} disponible${names.length > 1 ? 's' : ''}.`);
  } else {
    setApiMixPlaylistStatus('Aucune playlist disponible (API hors ligne ou dossier vide).', true);
  }
}

apiMixPlaylistRefreshBtn?.addEventListener('click', () => {
  refreshApiMixPlaylists().catch(() => {});
});

apiMixPlaylistLoadBtn?.addEventListener('click', async () => {
  const name = apiMixPlaylistSelect?.value;
  if (!name) {
    setApiMixPlaylistStatus('Sélectionnez une playlist d\'abord.', true);
    return;
  }
  setApiMixPlaylistStatus(`Chargement de « ${name} »…`);
  const detail = await djApiClient.fetchMixPlaylistDetail(name);
  if (!detail || !Array.isArray(detail.sections)) {
    setApiMixPlaylistStatus(`Impossible de charger « ${name} ».`, true);
    return;
  }
  const text = detail.sections.map((group) => group.join('\n')).join('\n\n');
  if (txtPlaylistTextarea) txtPlaylistTextarea.value = text;
  const total = detail.sections.reduce((s, g) => s + g.length, 0);
  setApiMixPlaylistStatus(`« ${name} » chargé (${total} morceau${total > 1 ? 'x' : ''}). Cliquez sur "Importer vers fil rouge" pour l'appliquer.`);
  switchTab('config');
});

(async function init() {
  if (spotifyClientIdInput) {
    spotifyClientIdInput.value = spotifyClient.getStoredClientId();
  }
  try {
    await spotifyClient.maybeHandleRedirect();
  } catch (err) {
    setSpotifyStatus(`Connexion Spotify échouée: ${err.message}`, true);
  }
  updateSpotifyConfigUi();
  if (spotifyClient.isConnected()) {
    refreshSpotifyPlaylistDropdown().catch(() => {});
  }
  refreshApiMixPlaylists().catch(() => {});

  applyRamFilterSettings({ persist: false, announce: true });
  applyDebugLogsSetting(readDebugLogsSetting(), { persist: false });
  applyTransitionModeSetting(selectedTransitionMode, { persist: false });
  applyAutoSuggestionQueueSearchSetting(readAutoSuggestionQueueSearchEnabledSetting(), {
    persist: false,
    announce: false,
  });
  
  // Initialize track max duration UI
  updateTrackMaxDurationUI();

  autoModeManager.initialize();
  updateAutoModeUI();
  updateAutoDjFxConfigUI();
  renderDjModeUI();
  startSpotifyFilRougeSyncLoop();

  debugLogsToggle?.addEventListener('change', () => {
    applyDebugLogsSetting(Boolean(debugLogsToggle.checked), { persist: true });
  });

  autoSuggestionQueueSearchToggle?.addEventListener('change', () => {
    applyAutoSuggestionQueueSearchSetting(Boolean(autoSuggestionQueueSearchToggle.checked), {
      persist: true,
      announce: true,
    });
  });

  loadDownloaderApiConfigIntoForm();
  setupDownloaderApiConfigEvents();
  setupMediaSession();
  initServiceWorker();
  
  // Setup PWA install button
  const pwaInstallBtn = document.getElementById('btn-install-pwa');
  if (pwaInstallBtn) {
    pwaInstallBtn.addEventListener('click', () => {
      installPwa();
    });
  }

  // APK Android : plein écran auto, lien de téléchargement, mise à jour
  initAutoFullscreen();
  initApkDownloadLink();
  const apkUpdateBtn = document.getElementById('btn-apk-update');
  if (apkUpdateBtn) {
    apkUpdateBtn.addEventListener('click', () => {
      doApkUpdate();
    });
  }
  checkApkUpdate();


  restoreQueue();
  if (queue.length) {
    renderQueue();
    if (uiState.currentIndex >= 0 && queue[uiState.currentIndex]) {
      setDeckItem('A', queue[uiState.currentIndex]);
      updateNowPlaying(queue[uiState.currentIndex]);
      fetchAndStoreArtworkForItem(queue[uiState.currentIndex], 'A').catch(() => {});
    }
  }
  startBlobCleanupLoop();
  startMetricsLoop();
  showSetupLoading(false);

  // Enrich artworks for persisted fil rouge items that don't have one yet.
  const filRougeItemsWithoutArt = filRougeManager.getPlaylist().filter((t) => !t.artUrl);
  if (filRougeItemsWithoutArt.length) {
    (async () => {
      for (const track of filRougeItemsWithoutArt) {
        await fetchFilRougeArtwork(track).catch(() => {});
      }
    })().catch(() => {});
  }

  // Vérification et téléchargement au démarrage des morceaux du fil rouge.
  startFilRougeStartupCacheSync().catch(() => {});

  // DJ Planner : sélecteur de profil de set + recalcul complet des transitions du fil rouge.
  initDjSetProfileSelect().catch(() => {});
  runDjPlanFullPass('startup').catch(() => {});

  try {
    await connectLocal();
  } catch (err) {
    showToast(`Erreur API: ${err.message}`, true);
  }
  
  // Handle URL parameters from shortcuts (Android Auto support)
  handleShortcutParameters();

  initDevBuildIndicator().catch(() => {});
})();

async function initDevBuildIndicator() {
  const h = location.hostname;
  if (h !== 'localhost' && h !== '127.0.0.1' && !h.startsWith('192.168.') && !h.startsWith('10.')) return;

  const badge = document.createElement('div');
  badge.id = 'dev-build-badge';
  badge.title = 'Dernier Last-Modified des JS (clic = refresh)';
  badge.textContent = 'JS: …';
  document.body.appendChild(badge);

  const jsFiles = ['main.js', 'player.js', 'pwa.js'];

  async function refresh() {
    badge.textContent = 'JS: …';
    const dates = await Promise.all(jsFiles.map(async (f) => {
      try {
        const res = await fetch(f + '?_nc=' + Date.now(), { method: 'HEAD', cache: 'no-store' });
        const lm = res.headers.get('Last-Modified');
        return lm ? new Date(lm) : null;
      } catch { return null; }
    }));
    const valid = dates.filter(Boolean);
    if (!valid.length) { badge.textContent = 'JS: ?'; return; }
    const latest = valid.reduce((a, b) => (b > a ? b : a));
    const hh = String(latest.getHours()).padStart(2, '0');
    const mm = String(latest.getMinutes()).padStart(2, '0');
    const ss = String(latest.getSeconds()).padStart(2, '0');
    badge.textContent = `JS ${latest.getDate()}/${latest.getMonth() + 1} ${hh}:${mm}:${ss}`;
  }

  badge.addEventListener('click', refresh);
  await refresh();
}

function handleShortcutParameters() {
  const params = new URLSearchParams(window.location.search);
  
  // Handle automix parameter
  if (params.get('automix') === '1') {
    setTimeout(() => {
      autoMixBtn?.click();
    }, 500);
  }
  
  // Handle tab parameter
  const tabParam = params.get('tab');
  if (tabParam) {
    const tabButtons = document.querySelectorAll('[data-tab]');
    tabButtons.forEach(btn => {
      const tabId = btn.getAttribute('data-tab');
      if (tabId === tabParam) {
        setTimeout(() => {
          btn.click();
        }, 300);
      }
    });
  }

  // Apply any media command received from Android Auto before the WebView was ready
  // (e.g. pressing "Play" from the car before opening the app).
  getPendingMediaCommand().then((cmd) => {
    if (cmd) applyMediaCommand(cmd);
  });
}

window.addEventListener('beforeunload', () => {
  // Flush any pending debounced queue save before unload
  saveQueueDebounced.flush();
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
  const savedCrossfadeVal = readCrossfadeSecondsSetting(6);
  crossfadeSlider.value = savedCrossfadeVal;
  if (crossfadeSliderMix) crossfadeSliderMix.value = savedCrossfadeVal;
  player.crossfadeDuration = clampCrossfadeSeconds(crossfadeSlider.value) * 1000;
  updateCrossfadeControlUI(clampCrossfadeSeconds(savedCrossfadeVal));
  player.setAllowedTransitionModes(allowedTransitionModes);
  player.setTransitionMode(selectedTransitionMode);
  player.setMixFeatures(mixFeatures);
  hookPlayerEvents();

  showApp();

  await player.init();
  startSpotifyFilRougeSyncLoop();
  logInfo('connectLocal(): player initialized', {
    crossfadeDurationMs: player.crossfadeDuration,
    transitionMode: selectedTransitionMode,
  });
}

function hookPlayerEvents() {
  player.addEventListener('ready', async () => {
    logInfo('player.ready', { pendingAutoplay, currentIndex: uiState.currentIndex, queueLength: queue.length });
    // showToast('Platines locales prêtes');
    applyDeckMixRatio(uiState.deckMixRatio, 0);
    player.setMixFeatures(mixFeatures);

    if (pendingAutoplay && uiState.currentIndex >= 0 && queue[uiState.currentIndex]) {
      pendingAutoplay = false;
      await startPlaybackForIndex(uiState.currentIndex, 'play');
    } else if (!uiState.isPlaying && queue.length === 0 && filRougeManager.isActive()) {
      pendingAutoplay = false;
      const nextFromFilRouge = filRougeManager.getNextTrack();
      if (nextFromFilRouge) {
        const filRougeItem = {
          id: nextFromFilRouge.id || `filrouge-${Date.now()}`,
          uri: nextFromFilRouge.persistedSourceUrl || '',
          name: nextFromFilRouge.name || 'Inconnu',
          artist: nextFromFilRouge.artist || 'Artiste inconnu',
          artUrl: nextFromFilRouge.artUrl || '',
          duration: nextFromFilRouge.duration || 0,
          bpm: nextFromFilRouge.bpm || null,
          genre: nextFromFilRouge.genre || '',
          cachePath: nextFromFilRouge.cachePath || '',
          persistedSourceUrl: nextFromFilRouge.persistedSourceUrl || '',
          ratingKey: nextFromFilRouge.ratingKey || '',
          stemsStatus: nextFromFilRouge.stemsStatus || '',
          stems: nextFromFilRouge.stems || null,
          sourceState: 'idle',
          sourceError: null,
          sourceMeta: null,
          localBlobUrl: null,
          queueSource: 'fil-rouge',
          lastTouchedAt: Date.now(),
        };
        queue.push(filRougeItem);
        uiState.currentIndex = 0;
        uiState.currentTrackId = filRougeItem.id;
        renderQueue();
        renderFilRouge();
        await startPlaybackForIndex(0, 'play');
      }
    }
  });

  player.addEventListener('statechange', ({ detail }) => {
    logDebug('player.statechange', detail);
    uiState.isPlaying = !detail.paused;
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = uiState.isPlaying ? 'playing' : 'paused';
    }
    pushPlaybackState({ playing: uiState.isPlaying, positionMs: playbackPositionMs });
    // Wake Lock: activer si lecture, relâcher sinon
    if (uiState.isPlaying) {
      requestWakeLock();
      stopMediaKeepAlive(); // Lecture réelle → pas besoin du keepalive silencieux
    } else {
      releaseWakeLock();
      startMediaKeepAlive(); // Maintenir la notification Android pendant 10 minutes max
    }
    updateMediaSessionPositionState();
    renderQueue();
  });

  player.addEventListener('progress', ({ detail }) => {
    const { position, duration } = detail;
    if (!duration) return;

    playbackPositionMs = position;
    playbackDurationMs = duration;
    updateMediaSessionPositionState(position, duration);

    if (autoModeManager.isAutoModeEnabled()) {
      const dueAutoFxEvents = autoModeManager.consumeReadyAutoFxEvents(position, {
        currentTrackId: queue[uiState.currentIndex]?.id || null,
      });
      for (const event of dueAutoFxEvents) {
        triggerAutoDjCreativeFxEvent(event);
      }

      if (autoDjNextFxCountdown) {
        if (autoDjFxSettings.enabled === false) {
          autoDjNextFxCountdown.hidden = true;
        } else if (!document.hidden) {
          // Skip DOM updates when tab is hidden to save CPU
          const next = autoModeManager.peekNextAutoFxEvent(position);
          if (next) {
            const secLeft = Math.ceil((next.timeMs - position) / 1000);
            autoDjNextFxCountdown.textContent = `FX ${secLeft}s`;
            autoDjNextFxCountdown.hidden = false;
          } else {
            autoDjNextFxCountdown.hidden = true;
          }
        }
      }
    } else if (autoDjNextFxCountdown) {
      autoDjNextFxCountdown.hidden = true;
    }

    // Auto DJ: if timing not yet set (e.g. fil rouge track had duration=0 at schedule time),
    // reschedule now that real duration is known from the audio.
    if (autoModeManager.isAutoModeEnabled()
        && automixTimeline.nextTriggerMs <= 0
        && !automixTimeline.triggeredForTrack
        && duration > 0) {
      const currentTrackId = queue[uiState.currentIndex]?.id || null;
      if (currentTrackId && automixRescheduledForTrackId !== currentTrackId) {
        automixRescheduledForTrackId = currentTrackId;
        recalculateAutomixTimingIfNeeded('autoDj: rescheduling after real duration known');
      }
    }

    // Max duration: trigger automix immediately when playback position reaches the marker,
    // regardless of whether auto mode is enabled.
    if (trackMaxDurationEnabled && trackMaxDurationAppliedSec > 0
        && !maxDurMarkerTriggeredForTrack && !automixTimeline.triggeredForTrack) {
      const _mdCurrentItem = queue[uiState.currentIndex];
      const _mdStartOffsetMs = Math.max(0, Number(_mdCurrentItem?.autoDjStartOffsetMs) || 0);
      const _mdThresholdMs = trackMaxDurationAppliedSec * 1000 + _mdStartOffsetMs;
      if (position >= _mdThresholdMs) {
        maxDurMarkerTriggeredForTrack = true;
        logInfo('maxDuration: marker reached, triggering automix immediately', {
          position,
          markerThresholdMs: _mdThresholdMs,
        });
        autoMixBtn?.click?.();
      }
    }

    // Auto DJ: Check if it's time to trigger automix
    if (autoModeManager.isAutoModeEnabled() && shouldTriggerAutomix(automixTimeline, position)) {
      
      markAutomixTriggered(automixTimeline);
      updateAutoDjMarker();
      updateMaxDurationMarker();
      logInfo('autoDj: triggering automix at optimal moment', {
        position,
        triggerMs: automixTimeline.nextTriggerMs,
        remainingMs: duration - position,
      });

      // Add pending track (already found during timing calculation) to queue
      autoModeManager.addPendingTrackToQueue()
        .then((added) => {
          if (added) {
            logDebug('autoDj: pending track added, triggering automix', {});
            if (getFollowingQueueIndex(uiState.currentIndex) >= 0) {
              autoMixBtn?.click?.();
            }
          } else if (filRougeManager.isActive()) {
            // Fil rouge: autoMixBtn a un fallback pour récupérer le prochain morceau
            logDebug('autoDj: no pending track but fil rouge active, triggering automix', {});
            autoMixBtn?.click?.();
          } else {
            logDebug('autoDj: no pending track, skipping automix trigger', {});
          }
        })
        .catch(err => {
          logWarn('autoDj: failed to add pending track', { error: err?.message });
        });
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
    uiState.isPlaying = false;
    showCrossfadeRing(false);
    renderQueue();
    
    // Trigger auto mode search on track end
    const currentTrack = queue[uiState.currentIndex];
    if (currentTrack) {
      autoModeManager.onTrackFinished(currentTrack);
    }

    // Advance to next track via automix (handles queue next AND fil rouge fallback)
    const hasNextInQueue = getFollowingQueueIndex(uiState.currentIndex) >= 0;
    if (hasNextInQueue || filRougeManager.isActive()) {
      autoMixBtn?.click?.();
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
      uiState.lastDeckState = detail;
      renderDeckState(detail);
      // Update max duration marker when the playing deck's duration becomes available
      // (handles fil rouge tracks that have duration=0 in queue metadata).
      if (trackMaxDurationEnabled) updateMaxDurationMarker();
    });
}

autoMixBtn?.addEventListener('click', async () => {
  if (!player || player.isCrossfading) return;
  const hasCue = uiState.deckBCueIndex >= 0 && uiState.deckBCueIndex < queue.length;
  const inactiveDeck = hasCue && (uiState.deckCueDeck === 'A' || uiState.deckCueDeck === 'B')
    ? uiState.deckCueDeck
    : getResolvedInactiveDeck();
  const preparedItem = deckDisplayItems[inactiveDeck];
  const preparedIndex = preparedItem ? queue.findIndex((item) => item.id === preparedItem.id) : -1;
  const naturalNextIndex = getFollowingQueueIndex(uiState.currentIndex);
  const preferredIndex = hasCue ? uiState.deckBCueIndex : naturalNextIndex;
  const canUsePreparedIndex = preparedIndex >= 0
    && (hasCue ? preparedIndex === uiState.deckBCueIndex : preparedIndex === naturalNextIndex);
  let nextIndex = canUsePreparedIndex
    ? preparedIndex
    : (preferredIndex >= 0 ? preferredIndex : -1);

  // Fil rouge fallback: if no next track in queue, add from fil rouge
  if (nextIndex < 0 && filRougeManager.isActive()) {
    const nextFromFilRouge = filRougeManager.getNextTrack();
    if (nextFromFilRouge) {
      const item = {
        id: nextFromFilRouge.id || `filrouge-${Date.now()}`,
        uri: nextFromFilRouge.persistedSourceUrl || '',
        name: nextFromFilRouge.name || 'Inconnu',
        artist: nextFromFilRouge.artist || 'Artiste inconnu',
        artUrl: nextFromFilRouge.artUrl || '',
        duration: nextFromFilRouge.duration || 0,
        bpm: nextFromFilRouge.bpm || null,
        genre: nextFromFilRouge.genre || '',
        cachePath: nextFromFilRouge.cachePath || '',
        persistedSourceUrl: nextFromFilRouge.persistedSourceUrl || '',
        ratingKey: nextFromFilRouge.ratingKey || '',
        stemsStatus: nextFromFilRouge.stemsStatus || '',
        stems: nextFromFilRouge.stems || null,
        sourceState: 'idle',
        sourceError: null,
        sourceMeta: null,
        localBlobUrl: null,
        queueSource: 'fil-rouge',
        lastTouchedAt: Date.now(),
      };
      queue.push(item);
      nextIndex = queue.length - 1;
      renderFilRouge();
    }
  }

  if (nextIndex < 0) return;

  logInfo('automix.click', {
    currentIndex: uiState.currentIndex,
    nextIndex,
    preparedIndex,
    preferredIndex,
    canUsePreparedIndex,
    inactiveDeck,
    queueLength: queue.length,
  });

  showCrossfadeRing(true);
  showToast('AutoMix en cours...');

  try {
    await startPlaybackForIndex(nextIndex, 'crossfade', { targetDeck: inactiveDeck });
    uiState.deckBCueIndex = -1;
    uiState.deckCueDeck = null;
    updateDeckCueUI();
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
    const deckState = uiState.lastDeckState?.[focusDeck === 'A' ? 'deckA' : 'deckB'];
    if (deckState?.playing) return;
    if (deckState?.hasSrc) {
      player?.resumeDeck?.(focusDeck).catch(() => {});
    } else {
      if (focusDeck === 'A') deckALaunchBtn?.click();
      else deckBLaunchBtn?.click();
    }
  });
  navigator.mediaSession.setActionHandler('pause', () => {
    const focusDeck = getFocusDeck();
    const deckState = uiState.lastDeckState?.[focusDeck === 'A' ? 'deckA' : 'deckB'];
    if (deckState?.playing) player?.pauseDeck?.(focusDeck);
  });
  navigator.mediaSession.setActionHandler('stop', () => {
    player?.pause?.();
  });
  navigator.mediaSession.setActionHandler('seekbackward', (event) => {
    const offset = Number(event?.seekOffset) || 10;
    const position = Math.max(0, (playbackPositionMs || 0) - (offset * 1000));
    player?.seekTo?.(position, { fadeMs: 0 });
  });
  navigator.mediaSession.setActionHandler('seekforward', (event) => {
    const offset = Number(event?.seekOffset) || 10;
    const position = Math.max(0, (playbackPositionMs || 0) + (offset * 1000));
    player?.seekTo?.(position, { fadeMs: 0 });
  });
  navigator.mediaSession.setActionHandler('seekto', (event) => {
    if (event?.fastSeek === false && !Number.isFinite(event?.seekTime)) return;
    const position = Math.max(0, Number(event?.seekTime || 0) * 1000);
    player?.seekTo?.(position, { fadeMs: 0 });
  });
  navigator.mediaSession.setActionHandler('previoustrack', null);
  navigator.mediaSession.setActionHandler('nexttrack', () => autoMixBtn?.click());

  // Commandes de transport relayées depuis Android Auto / la notification native.
  onMediaCommand(applyMediaCommand);
}

/** Applique une commande de transport reçue depuis Android Auto / la notification native. */
function applyMediaCommand(cmd) {
  switch (cmd?.action) {
    case 'play': {
      const focusDeck = getFocusDeck();
      const deckState = uiState.lastDeckState?.[focusDeck === 'A' ? 'deckA' : 'deckB'];
      if (deckState?.playing) break;
      if (deckState?.hasSrc) {
        player?.resumeDeck?.(focusDeck).catch(() => {});
      } else {
        if (focusDeck === 'A') deckALaunchBtn?.click();
        else deckBLaunchBtn?.click();
      }
      break;
    }
    case 'pause': {
      const focusDeck = getFocusDeck();
      const deckState = uiState.lastDeckState?.[focusDeck === 'A' ? 'deckA' : 'deckB'];
      if (deckState?.playing) player?.pauseDeck?.(focusDeck);
      break;
    }
    case 'next':
      autoMixBtn?.click();
      break;
    case 'seekTo':
      player?.seekTo?.(Math.max(0, Number(cmd.positionMs) || 0), { fadeMs: 0 });
      break;
    case 'playFromMediaId': {
      const idx = queue.findIndex((item) => item.id === cmd.mediaId);
      if (idx >= 0) startPlaybackForIndex(idx, 'play');
      break;
    }
  }
}

function updateMediaSessionPositionState(positionMs = playbackPositionMs, durationMs = playbackDurationMs) {
  if (!('mediaSession' in navigator)) return;
  const safeDuration = Number(durationMs);
  const safePosition = Number(positionMs);
  if (!Number.isFinite(safeDuration) || safeDuration <= 0 || !Number.isFinite(safePosition)) return;

  try {
    navigator.mediaSession.setPositionState({
      duration: Math.max(0, safeDuration / 1000),
      position: Math.max(0, Math.min(safeDuration, safePosition)) / 1000,
      playbackRate: 1,
    });
  } catch (_) {
    // Unsupported in some browser/Android combinations.
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

async function launchDeckFromQueue(deck, options = {}) {
  if (!player) return;
  if (!queue.length) {
    if (filRougeManager.isActive()) {
      const nextFromFilRouge = filRougeManager.getNextTrack();
      if (nextFromFilRouge) {
        const filRougeItem = {
          id: nextFromFilRouge.id || `filrouge-${Date.now()}`,
          uri: nextFromFilRouge.persistedSourceUrl || '',
          name: nextFromFilRouge.name || 'Inconnu',
          artist: nextFromFilRouge.artist || 'Artiste inconnu',
          artUrl: nextFromFilRouge.artUrl || '',
          duration: nextFromFilRouge.duration || 0,
          bpm: nextFromFilRouge.bpm || null,
          genre: nextFromFilRouge.genre || '',
          cachePath: nextFromFilRouge.cachePath || '',
          persistedSourceUrl: nextFromFilRouge.persistedSourceUrl || '',
          ratingKey: nextFromFilRouge.ratingKey || '',
          stemsStatus: nextFromFilRouge.stemsStatus || '',
          stems: nextFromFilRouge.stems || null,
          sourceState: 'idle',
          sourceError: null,
          sourceMeta: null,
          localBlobUrl: null,
          queueSource: 'fil-rouge',
          lastTouchedAt: Date.now(),
        };
        queue.push(filRougeItem);
        uiState.currentIndex = 0;
        uiState.currentTrackId = filRougeItem.id;
        renderQueue();
        renderFilRouge();
      }
    }
    if (!queue.length) {
      showToast('Ajoutez une chanson dans la file', true);
      return;
    }
  }

  let targetDeck = deck === 'B' ? 'B' : 'A';

  const fallbackIndex = uiState.currentIndex >= 0 && queue[uiState.currentIndex] ? uiState.currentIndex : 0;
  const inactiveDeck = getResolvedInactiveDeck();

  // Si on charge explicitement le deck inactif, effacer le ghost fil rouge éventuel.
  if (targetDeck === inactiveDeck && pendingFilRougeOnInactiveDeck) {
    pendingFilRougeOnInactiveDeck = null;
  }

  const deckItemIndex = deckDisplayItems[targetDeck]
    ? queue.findIndex((q) => q.id === deckDisplayItems[targetDeck]?.id)
    : -1;

  let targetIndex = fallbackIndex;
  if (options.useCue === true && uiState.deckBCueIndex >= 0 && queue[uiState.deckBCueIndex]) {
    targetIndex = uiState.deckBCueIndex;
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
    currentIndex: uiState.currentIndex,
    itemId: item.id,
    itemName: item.name,
    options,
  });

    try {
      await preloadMixDataForDeckItem(item, targetDeck);
      setDeckItem(targetDeck, item);
      updatePlannedStartMarker();
      const sourceUrl = await ensureLocalSource(item);
      const isFocusDeck = targetDeck === getResolvedActiveDeck();
      const paused = typeof options.paused === 'boolean' ? options.paused : !isFocusDeck;
      await player.playOnDeck(targetDeck, {
        url: sourceUrl,
        loudnessDb: item.loudnessDb,
        bpm: item.bpm,
        durationMs: item.duration,
        audioFeatures: item.audioFeatures,
        stems: item.stems,
        startPositionMs: Math.max(0, Number(item.autoDjStartOffsetMs) || 0),
      }, { makeActive: false, paused });
    
      if (isFocusDeck) {
        uiState.currentIndex = targetIndex;
        uiState.currentTrackId = item.id;
        updateNowPlaying(item, targetDeck);
        fetchAndStoreArtworkForItem(item, targetDeck).catch(() => {});
        uiState.isPlaying = true;
        launchPreviewTitle = '';
        launchPreviewArtist = '';
        launchPreviewDeck = null;
        launchPreviewItem = null;
        prefetchNext(getFollowingQueueIndex(targetIndex));
        // Reapply DJ mode preset with updated BPM, and suggest genre chip
        applyDjModeFxPreset(djMode, item.bpm || null);
        suggestGenreFromCurrentTrack();
        autoModeManager.scheduleAutomixTiming(item);
        if (autoSuggestionQueueSearchEnabled) {
          scheduleIdle(() => {
            autoModeManager.searchAndAddNextTrack(item).catch((err) => {
              logWarn('autoDj: search on launchDeckFromQueue failed', { error: err?.message });
            });
          }, 3000);
        }
      } else {
        launchPreviewActive = true;
        launchPreviewArtUrl = item.artUrl || '';
        launchPreviewTitle = item.name || '';
        launchPreviewArtist = item.artist || '';
        launchPreviewDeck = targetDeck;
        launchPreviewItem = item;
        uiState.deckCueDeck = targetDeck;
        updateUpcomingArtwork();
        if (!item.artUrl) {
          fetchAndStoreArtworkForItem(item, targetDeck).then(() => {
            if (launchPreviewItem === item) {
              launchPreviewArtUrl = item.artUrl || '';
              updateUpcomingArtwork();
            }
          }).catch(() => {});
        }
      }
      renderQueue();
      logInfo('launchDeckFromQueue(): deck loaded', {
        deck: targetDeck,
        itemId: item.id,
        isFocusDeck,
        paused,
      });
      trimRetainedAudioSources();
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
  applyRamFilterSettings({ persist: false, announce: false });
  
  // Persist crossfade setting so RAM profile and player restart stay aligned.
  persistCrossfadeSecondsSetting(safeSeconds);

  if (player) {
    player.crossfadeDuration = safeSeconds * 1000;
    player.setAllowedTransitionModes(allowedTransitionModes);
  }
}

// Initialize crossfade slider from localStorage
const savedCrossfade = readCrossfadeSecondsSetting(null);
if (savedCrossfade) {
  crossfadeSlider.value = savedCrossfade;
  if (crossfadeSliderMix) crossfadeSliderMix.value = savedCrossfade;
  setCrossfadeDurationSeconds(savedCrossfade);
}

crossfadeSlider.addEventListener('input', () => {
  setCrossfadeDurationSeconds(crossfadeSlider.value);
});

crossfadeSliderMix?.addEventListener('input', () => {
  setCrossfadeDurationSeconds(crossfadeSliderMix.value);
});

// Initialize queue loop/shuffle from persisted settings
updateQueueModeConfigUI();

queueLoopToggle?.addEventListener('change', () => {
  queueLoopEnabled = Boolean(queueLoopToggle.checked);
  persistQueueLoopSetting(queueLoopEnabled);
});

queueShuffleToggle?.addEventListener('change', () => {
  queueShuffleEnabled = Boolean(queueShuffleToggle.checked);
  persistQueueShuffleSetting(queueShuffleEnabled);
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
  const lastDetail = uiState.lastDeckState;
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
  const lastDetail = uiState.lastDeckState;
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
  persistFxControlsHiddenSetting(fxControlsHidden);
  updateFxVisibilityUI();
});

mixTransitionModeSelect?.addEventListener('change', () => {
  const nextMode = String(mixTransitionModeSelect.value || 'auto');
  applyTransitionModeSetting(nextMode, { persist: true });
  const label = MIX_TRANSITION_MODE_LABELS[selectedTransitionMode] || selectedTransitionMode;
  showToast(`Mode AutoMix: ${label}`);
});

ramFilterEnabledToggle?.addEventListener('change', () => {
  ramFilterEnabled = Boolean(ramFilterEnabledToggle.checked);
  applyRamFilterSettings({ persist: true, announce: true });
});

ramTotalMemoryInput?.addEventListener('change', () => {
  const nextGb = Number.parseFloat(String(ramTotalMemoryInput.value || '0'));
  if (!Number.isFinite(nextGb) || nextGb <= 0) {
    ramTotalMbOverride = 0;
  } else {
    ramTotalMbOverride = Math.max(512, Math.min(32768, Math.round(nextGb * 1024)));
  }
  applyRamFilterSettings({ persist: true, announce: true });
});

autoDjFxMinIntervalInput?.addEventListener('change', () => {
  const intervals = normalizeAutoDjFxIntervalSettings(
    autoDjFxMinIntervalInput.value,
    autoDjFxSettings.maxIntervalSec,
  );
  autoDjFxSettings = {
    ...autoDjFxSettings,
    minIntervalSec: intervals.minIntervalSec,
    maxIntervalSec: intervals.maxIntervalSec,
  };
  persistAutoDjFxSettings(autoDjFxSettings);
  updateAutoDjFxConfigUI();
  recalculateAutomixTimingIfNeeded('autoDjFx: min interval changed');
});

autoDjFxMaxIntervalInput?.addEventListener('change', () => {
  const intervals = normalizeAutoDjFxIntervalSettings(
    autoDjFxSettings.minIntervalSec,
    autoDjFxMaxIntervalInput.value,
  );
  autoDjFxSettings = {
    ...autoDjFxSettings,
    minIntervalSec: intervals.minIntervalSec,
    maxIntervalSec: intervals.maxIntervalSec,
  };
  persistAutoDjFxSettings(autoDjFxSettings);
  updateAutoDjFxConfigUI();
  recalculateAutomixTimingIfNeeded('autoDjFx: max interval changed');
});

autoDjFxEnabledBtn?.addEventListener('click', () => {
  const nextEnabled = autoDjFxSettings.enabled === false;
  autoDjFxSettings = {
    ...autoDjFxSettings,
    enabled: nextEnabled,
  };
  persistAutoDjFxSettings(autoDjFxSettings);
  updateAutoDjFxConfigUI();
  if (!nextEnabled && autoDjNextFxCountdown) {
    autoDjNextFxCountdown.hidden = true;
  }
  showToast(`AutoFX ${nextEnabled ? 'activé' : 'désactivé'}`);
});

for (const toggleEl of autoDjFxToggleEls) {
  toggleEl.addEventListener('change', () => {
    const type = String(toggleEl.dataset.autoFxType || '');
    if (!type) return;
    autoDjFxSettings = {
      ...autoDjFxSettings,
      allowed: {
        ...(autoDjFxSettings.allowed || createDefaultAutoDjFxAllowed()),
        [type]: Boolean(toggleEl.checked),
      },
    };
    persistAutoDjFxSettings(autoDjFxSettings);
    updateAutoDjFxConfigUI();
  });
}

trackMaxDurationInput?.addEventListener('change', () => {
  applyTrackMaxDurationSetting(trackMaxDurationInput.value, 'trackMaxDuration: setting changed');
});

trackMaxDurationModeBtn?.addEventListener('click', () => {
  trackMaxDurationMode = trackMaxDurationMode === 'pct' ? 'sec' : 'pct';
  persistTrackMaxDurationModeSetting(trackMaxDurationMode);
  applyTrackMaxDurationForCurrentPlayback();
  updateTrackMaxDurationUI();
  const label = trackMaxDurationMode === 'pct' ? `${trackMaxDurationPct}% (hors intro/outro)` : `${trackMaxDurationSec}s`;
  showToast(`Durée max: mode ${trackMaxDurationMode === 'pct' ? '%' : 'sec'} (${label})`);
  recalculateAutomixTimingIfNeeded('trackMaxDuration: mode changed');
  updateMaxDurationMarker();
});

trackMaxDurationPctInput?.addEventListener('change', () => {
  applyTrackMaxDurationPctSetting(trackMaxDurationPctInput.value, 'trackMaxDuration: pct setting changed');
});

trackMaxDurationPctMinus?.addEventListener('click', () => {
  const newValue = Math.max(5, trackMaxDurationPct - 5);
  applyTrackMaxDurationPctSetting(newValue, 'trackMaxDuration: pct decreased');
});

trackMaxDurationPctPlus?.addEventListener('click', () => {
  const newValue = Math.min(95, trackMaxDurationPct + 5);
  applyTrackMaxDurationPctSetting(newValue, 'trackMaxDuration: pct increased');
});

trackMaxDurationToggle?.addEventListener('click', () => {
  trackMaxDurationEnabled = !trackMaxDurationEnabled;

  if (trackMaxDurationEnabled && trackMaxDurationMode === 'sec' && trackMaxDurationSec <= 0) {
    trackMaxDurationSec = lastTrackMaxDurationSec;
    persistTrackMaxDurationSetting(trackMaxDurationSec);
  }

  persistTrackMaxDurationEnabledSetting(trackMaxDurationEnabled);
  applyTrackMaxDurationForCurrentPlayback();
  updateTrackMaxDurationUI();
  const label = trackMaxDurationMode === 'pct' ? `${trackMaxDurationPct}%` : `${trackMaxDurationSec}s`;
  showToast(trackMaxDurationEnabled ? `Durée max: ON (${label})` : 'Durée max: OFF');
  logDebug('trackMaxDuration: toggled', {
    enabled: trackMaxDurationEnabled,
    mode: trackMaxDurationMode,
    value: trackMaxDurationMode === 'pct' ? trackMaxDurationPct : trackMaxDurationSec,
  });
  recalculateAutomixTimingIfNeeded();
  updateMaxDurationMarker();
});

trackMaxDurationMinus?.addEventListener('click', () => {
  const current = parseInt(trackMaxDurationInput?.value || '0', 10);
  const newValue = Math.max(0, current - 5);
  applyTrackMaxDurationSetting(newValue, 'trackMaxDuration: decreased');
});

trackMaxDurationPlus?.addEventListener('click', () => {
  const current = parseInt(trackMaxDurationInput?.value || '0', 10);
  const newValue = Math.min(600, current + 5);
  applyTrackMaxDurationSetting(newValue, 'trackMaxDuration: increased');
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
  } else if (player) {
    player.resetDeckPlaybackRate('A');
    player.resetDeckPlaybackRate('B');
  }
  updateDjFxMenuUI();
});

echoBtn?.addEventListener('click', () => {
  setMixFeatureEnabled('echo', !mixFeatures.echo);
  if (deckDisplayItems.A) backgroundEnrichStems('A', deckDisplayItems.A);
  if (deckDisplayItems.B) backgroundEnrichStems('B', deckDisplayItems.B);
  updateDjFxMenuUI();
});

distortionBtn?.addEventListener('click', () => {
  setMixFeatureEnabled('distortion', !mixFeatures.distortion);
  if (deckDisplayItems.A) backgroundEnrichStems('A', deckDisplayItems.A);
  if (deckDisplayItems.B) backgroundEnrichStems('B', deckDisplayItems.B);
  updateDjFxMenuUI();
});

// Actions DJ qui nécessitent des stems (voix/instru per-deck, echo/distorsion globaux)
const STEM_FX_ACTIONS_FOCUS_DECK = new Set(['vocalRemove', 'instruRemove']);
const STEM_FX_ACTIONS_BOTH_DECKS = new Set(['echoDelay', 'reverb', 'flangerPhaser']);

djFxMenu?.addEventListener('click', (event) => {
  const button = event.target?.closest?.('[data-fx-action]');
  if (!button) return;
  const action = String(button.dataset.fxAction || '');
  if (!action) return;
  if (STEM_FX_ACTIONS_FOCUS_DECK.has(action)) {
    const deck = getFocusDeck();
    const item = deckDisplayItems[deck];
    if (item) backgroundEnrichStems(deck, item);
  } else if (STEM_FX_ACTIONS_BOTH_DECKS.has(action)) {
    if (deckDisplayItems.A) backgroundEnrichStems('A', deckDisplayItems.A);
    if (deckDisplayItems.B) backgroundEnrichStems('B', deckDisplayItems.B);
  }
  handleDjFxAction(action);
});

autoModeBtn?.addEventListener('click', () => {
  const isEnabled = autoModeManager.toggleAutoMode();
  syncAutoModeButtonUI(isEnabled);

  if (isEnabled && uiState.currentIndex >= 0 && queue[uiState.currentIndex]) {
    const currentItem = queue[uiState.currentIndex];
    autoModeManager.scheduleAutomixTiming(currentItem);
    if (autoSuggestionQueueSearchEnabled) {
      autoModeManager.searchAndAddNextTrack(currentItem).catch((err) => {
        logWarn('autoDj: immediate search on enable failed', { error: err?.message });
      });
    }
  } else {
    updateAutoDjMarker();
    updateMaxDurationMarker();
  }

  updateSuggestionRefreshButtons();

  showToast(`AutoDJ: ${isEnabled ? 'ON' : 'OFF'}`);
});

function updateAutoModeUI() {
  const isEnabled = autoModeManager.isAutoModeEnabled();
  syncAutoModeButtonUI(isEnabled);
  updateSuggestionRefreshButtons();
}

function updateAutoSuggestionQueueSearchUi() {
  if (autoSuggestionQueueSearchToggle) {
    autoSuggestionQueueSearchToggle.checked = Boolean(autoSuggestionQueueSearchEnabled);
  }
  if (autoSuggestionQueueSearchStatus) {
    autoSuggestionQueueSearchStatus.textContent = autoSuggestionQueueSearchEnabled
      ? "Recherche de suggestion en file d'attente active."
      : "Recherche de suggestion en file d'attente desactivee.";
  }
}

function applyAutoSuggestionQueueSearchSetting(enabled, options = {}) {
  const { persist = true, announce = false } = options;
  autoSuggestionQueueSearchEnabled = Boolean(enabled);
  autoModeManager.setSuggestionSearchEnabled?.(autoSuggestionQueueSearchEnabled);
  updateAutoSuggestionQueueSearchUi();
  updateSuggestionRefreshButtons();
  if (persist) {
    persistAutoSuggestionQueueSearchEnabledSetting(autoSuggestionQueueSearchEnabled);
  }
  if (announce) {
    showToast(`Recherche suggestion queue: ${autoSuggestionQueueSearchEnabled ? 'ON' : 'OFF'}`);
  }
}

function triggerAutoDjCreativeFxEvent(event) {
  const type = String(event?.type || '');
  const label = String(event?.label || type || 'FX');
  const reason = String(event?.reason || '');

  logInfo('autoDj: creative fx triggered', {
    type,
    label,
    reason,
    timeMs: Number(event?.timeMs) || 0,
    trackId: event?.trackId || null,
  });

  const now = Date.now();
  const triggerDecision = canTriggerAutoDjFx(event, autoDjFxSettings, lastAutoDjFxTriggeredAt, now);
  if (!triggerDecision.allowed) {
    logDebug('autoDj: creative fx skipped (min interval)', {
      type,
      label,
      reason: triggerDecision.reason,
      elapsedMs: triggerDecision.elapsedMs,
      requiredMs: triggerDecision.minGapMs,
    });
    return;
  }

  const targetDeck = toDeck(automixTimeline.currentPlayingDeck);
  const applied = applyAutoDjCreativeFx(type, targetDeck);
  if (!applied) {
    logDebug('autoDj: creative fx skipped (unsupported type)', { type, label });
    return;
  }

  lastAutoDjFxTriggeredAt = now;
  const suffix = reason ? ` (${reason})` : '';
  showToast(`🤖 Auto FX: ${label}${suffix}`);
}

let _suggestionBtnLastKey = null;

function updateSuggestionRefreshButtons() {
  const isEnabled = autoModeManager.isAutoModeEnabled();
  const hasCurrent = uiState.isPlaying && uiState.currentIndex >= 0 && Boolean(queue[uiState.currentIndex]);
  const activeDeck = getResolvedActiveDeck();
  const shouldShow = isEnabled && hasCurrent && autoSuggestionQueueSearchEnabled;
  const cacheKey = `${shouldShow}|${activeDeck}|${autoSuggestionRefreshInProgress}`;
  if (cacheKey === _suggestionBtnLastKey) return;
  _suggestionBtnLastKey = cacheKey;

  const applyState = (button, deck) => {
    if (!button) return;
    const visible = shouldShow && deck === activeDeck;
    button.hidden = !visible;
    button.disabled = !visible || autoSuggestionRefreshInProgress;
  };

  applyState(deckAChangeSuggestionBtn, 'A');
  applyState(deckBChangeSuggestionBtn, 'B');
}

function findAutoSuggestedTrackIndexAfterCurrent(currentTrack) {
  const referenceId = currentTrack?.id || null;
  for (let i = Math.max(0, uiState.currentIndex + 1); i < queue.length; i += 1) {
    const item = queue[i];
    if (!item || item.queueSource !== 'auto-dj') continue;
    if (!referenceId || !item.autoDjReferenceTrackId || item.autoDjReferenceTrackId === referenceId) {
      return i;
    }
  }
  return -1;
}

async function refreshAutoSuggestionForCurrentTrack() {
  if (autoSuggestionRefreshInProgress) return;
  if (!autoSuggestionQueueSearchEnabled) {
    showToast("Recherche de suggestion en file d'attente desactivee", true);
    return;
  }
  if (!autoModeManager.isAutoModeEnabled()) {
    showToast('Activez Auto Mode pour changer la suggestion', true);
    return;
  }

  const currentItem = queue[uiState.currentIndex];
  if (!currentItem) {
    showToast('Aucune piste en cours', true);
    return;
  }

  autoSuggestionRefreshInProgress = true;
  updateSuggestionRefreshButtons();

  const previousAutoSuggestionIndex = findAutoSuggestedTrackIndexAfterCurrent(currentItem);
  const previousAutoSuggestion = previousAutoSuggestionIndex >= 0 ? queue[previousAutoSuggestionIndex] : null;

  try {
    const added = await autoModeManager.searchAndAddNextTrack(currentItem, { force: true });
    if (!added) {
      showToast('Aucune nouvelle suggestion disponible', true);
      return;
    }

    if (previousAutoSuggestion) {
      const idx = queue.indexOf(previousAutoSuggestion);
      if (idx >= 0 && idx !== uiState.currentIndex) {
        removeFromQueue(idx);
      }
    }

    const inactiveDeck = getResolvedInactiveDeck();
    if (inactiveDeck) {
      await launchDeckFromQueue(inactiveDeck, { paused: true });
    }
    showToast('🤖 Suggestion AutoDJ changée');
  } catch (err) {
    logWarn('autoDj: refresh suggestion failed', { error: err?.message });
    showToast(`AutoDJ: ${err?.message || 'erreur de suggestion'}`, true);
  } finally {
    autoSuggestionRefreshInProgress = false;
    updateSuggestionRefreshButtons();
  }
}

deckAChangeSuggestionBtn?.addEventListener('click', () => {
  refreshAutoSuggestionForCurrentTrack().catch(() => {});
});

deckBChangeSuggestionBtn?.addEventListener('click', () => {
  refreshAutoSuggestionForCurrentTrack().catch(() => {});
});

function updateAutoDjMarker() {
  const isEnabled = autoModeManager.isAutoModeEnabled();
  const durationMs = playbackDurationMs > 0 ? playbackDurationMs : (queue[uiState.currentIndex]?.duration ?? 0);
  const hasTiming = automixTimeline.nextTriggerMs > 0 && durationMs > 0 && !automixTimeline.triggeredForTrack;

  // Hide both markers first
  if (deckAAutoDjMarker) deckAAutoDjMarker.hidden = true;
  if (deckBAutoDjMarker) deckBAutoDjMarker.hidden = true;

  if (isEnabled && hasTiming) {
    const pct = Math.min(100, Math.max(0, (automixTimeline.nextTriggerMs / durationMs) * 100));
    const marker = automixTimeline.currentPlayingDeck === 'B' ? deckBAutoDjMarker : deckAAutoDjMarker;
    if (marker) {
      marker.style.left = `${pct}%`;
      marker.hidden = false;
    }
  }

  updateDjPlanZone(durationMs);
}

function updateDjPlanZone(durationMs) {
  if (deckADjPlanZone) deckADjPlanZone.hidden = true;
  if (deckBDjPlanZone) deckBDjPlanZone.hidden = true;

  if (!djExternalPlanEnabled) return;

  const nextItem = filRougeManager.peekNextTrackFromAny?.();
  const djPlan = djPlanManager.getDjTransitionPlan(nextItem);
  if (!djPlan || !Number.isFinite(djPlan.mixOutSec) || djPlan.mixOutSec <= 0) return;
  if (!Number.isFinite(djPlan.crossfadeDurationSec) || djPlan.crossfadeDurationSec <= 0) return;

  const dur = durationMs > 0 ? durationMs
    : (playbackDurationMs > 0 ? playbackDurationMs : (queue[uiState.currentIndex]?.duration ?? 0));
  if (dur <= 0) return;

  const durationSec = dur / 1000;
  const leftPct = Math.max(0, Math.min(100, (djPlan.mixOutSec / durationSec) * 100));
  const widthPct = Math.max(0.5, Math.min(100 - leftPct, (djPlan.crossfadeDurationSec / durationSec) * 100));

  const playingDeck = automixTimeline.currentPlayingDeck || 'A';
  const zone = playingDeck === 'B' ? deckBDjPlanZone : deckADjPlanZone;
  if (!zone) return;

  const scorePct = Math.round((djPlan.compatibilityScore ?? 0) * 100);
  const transitionLabel = djPlan.transitionType ? ` · ${djPlan.transitionType}` : '';
  const nextName = nextItem?.name ? ` → ${nextItem.name}` : '';
  zone.style.left = `${leftPct}%`;
  zone.style.width = `${widthPct}%`;
  zone.title = `DJ Plan : crossfade ${Math.round(djPlan.crossfadeDurationSec)}s${transitionLabel} · score ${scorePct}%${nextName}`;
  zone.hidden = false;
}

let _plannedStartMarkerLastKey = null;

function updatePlannedStartMarker() {
  const inactiveDeck = getResolvedInactiveDeck();
  const item = deckDisplayItems[inactiveDeck];

  if (!item) {
    // Only hide when something was previously shown
    if (_plannedStartMarkerLastKey !== null) {
      if (deckAAutoDjStartMarker) deckAAutoDjStartMarker.hidden = true;
      if (deckBAutoDjStartMarker) deckBAutoDjStartMarker.hidden = true;
      _plannedStartMarkerLastKey = null;
    }
    return;
  }

  const durationMs = Number(item.duration) || (queue.find((q) => q.id === item.id)?.duration ?? 0);
  const startPositionMs = Math.max(0, Number(item.autoDjStartOffsetMs) || 0);
  const cacheKey = `${inactiveDeck}|${item.id}|${startPositionMs}|${durationMs}`;
  if (cacheKey === _plannedStartMarkerLastKey) return;
  _plannedStartMarkerLastKey = cacheKey;

  if (deckAAutoDjStartMarker) deckAAutoDjStartMarker.hidden = true;
  if (deckBAutoDjStartMarker) deckBAutoDjStartMarker.hidden = true;

  if (!durationMs || startPositionMs <= 0 || startPositionMs >= durationMs) return;

  const pct = Math.min(100, Math.max(0, (startPositionMs / durationMs) * 100));
  const marker = inactiveDeck === 'B' ? deckBAutoDjStartMarker : deckAAutoDjStartMarker;
  if (marker) {
    marker.style.left = `${pct}%`;
    marker.title = `Démarrage AutoDJ prévu à ${Math.round(startPositionMs / 1000)}s`;
    marker.hidden = false;
  }
}

/**
 * Cache for updateMaxDurationMarker zone computation.
 * Keyed by (trackId + effectiveMaxDurationSec + durationMs) to avoid
 * re-running findBestTransitionZone on every deckstate event.
 */
const _maxDurMarkerCache = { key: null, markerMs: null, maxMs: null, maxExceedsDuration: null, rawLogged: false, renderKey: null };

function updateMaxDurationMarker() {
  // Prefer the specific playing deck's duration (accurate even during crossfades and
  // for fil rouge tracks that may have duration=0 in queue metadata).
  const playingDeck = automixTimeline.currentPlayingDeck || 'A';
  const deckStateDurationMs = uiState.lastDeckState?.[`deck${playingDeck}`]?.durationMs ?? 0;
  const durationMs = deckStateDurationMs > 0
    ? deckStateDurationMs
    : (playbackDurationMs > 0 ? playbackDurationMs : (queue[uiState.currentIndex]?.duration ?? 0));

  const currentItem = queue[uiState.currentIndex];
  const fallbackMixData = autoModeManager.getCurrentTrackMixData?.();
  const mixData = getTrackMixData(currentItem) || fallbackMixData || null;

  let effectiveMaxDurationSec;
  if (!trackMaxDurationEnabled) {
    effectiveMaxDurationSec = 0;
  } else if (trackMaxDurationMode === 'pct') {
    effectiveMaxDurationSec = durationMs > 0 ? computePctMaxDurationSec(mixData, durationMs) : 0;
    // Keep trackMaxDurationAppliedSec in sync so scheduleAutomixTiming reads the right value.
    if (effectiveMaxDurationSec > 0 && effectiveMaxDurationSec !== trackMaxDurationAppliedSec) {
      trackMaxDurationAppliedSec = effectiveMaxDurationSec;
    }
  } else {
    effectiveMaxDurationSec = uiState.isPlaying ? trackMaxDurationAppliedSec : trackMaxDurationSec;
  }

  if (effectiveMaxDurationSec <= 0 || durationMs <= 0) {
    if (_maxDurMarkerCache.renderKey !== 'off') {
      _maxDurMarkerCache.renderKey = 'off';
      if (deckAMaxDurMarker) deckAMaxDurMarker.hidden = true;
      if (deckBMaxDurMarker) deckBMaxDurMarker.hidden = true;
      if (deckAMaxDurRawMarker) deckAMaxDurRawMarker.hidden = true;
      if (deckBMaxDurRawMarker) deckBMaxDurRawMarker.hidden = true;
    }
    return;
  }

  const startOffsetMs = Math.max(0, Number(currentItem?.autoDjStartOffsetMs) || 0);
  // Shift the max-duration wall by the song start offset so the marker reflects
  // "X seconds from the actual start of playback" in absolute file time.
  const maxMs = effectiveMaxDurationSec * 1000 + startOffsetMs;
  // If max duration exceeds the track length, place the marker at the best transition zone
  // near the end (before the outro). Use the same zone logic as auto-DJ end-of-track.
  const maxExceedsDuration = maxMs >= durationMs;

  // Cache key: recompute zone-snapping only when track, setting or duration changes.
  const cacheKey = `${currentItem?.id}|${effectiveMaxDurationSec}|${durationMs}`;
  let markerMs;
  if (_maxDurMarkerCache.key === cacheKey && _maxDurMarkerCache.markerMs !== null) {
    markerMs = _maxDurMarkerCache.markerMs;
  } else {
    markerMs = maxExceedsDuration ? durationMs : maxMs;

    if (mixData && typeof autoModeManager.findBestTransitionZone === 'function') {
      const preferredZone = maxExceedsDuration
        // No target → zone closest to end (end-of-track mode)
        ? autoModeManager.findBestTransitionZone(mixData, {})
        : autoModeManager.findBestTransitionZone(mixData, {
            targetSec: effectiveMaxDurationSec + startOffsetMs / 1000,
          });

      const zoneEndSec = Number.isFinite(Number(preferredZone?.triggerSec))
        ? Number(preferredZone.triggerSec)
        : Number(preferredZone?.zone?.endSec);

      if (Number.isFinite(zoneEndSec) && zoneEndSec > 0) {
        markerMs = Math.min(durationMs, zoneEndSec * 1000);
      } else if (maxExceedsDuration) {
        // No zone found: fallback 20s before end (same as auto-DJ default)
        markerMs = Math.max(durationMs - 20000, durationMs * 0.75);
      }
    } else if (maxExceedsDuration) {
      // No mix data: fallback 20s before end
      markerMs = Math.max(durationMs - 20000, durationMs * 0.75);
    }

    // Before positioning, ensure the marker is not on an incompatible zone
    // (avoid, drop, neverMiss, high-peak, intro). If it is, advance past it.
    if (mixData && typeof autoModeManager.advancePastMaxDurationBlock === 'function') {
      const adjustedMs = autoModeManager.advancePastMaxDurationBlock(markerMs, mixData, durationMs);
      if (adjustedMs !== markerMs && adjustedMs < durationMs) {
        markerMs = adjustedMs;
      }
    }

    _maxDurMarkerCache.key = cacheKey;
    _maxDurMarkerCache.markerMs = markerMs;
    _maxDurMarkerCache.maxMs = maxMs;
    _maxDurMarkerCache.maxExceedsDuration = maxExceedsDuration;
    _maxDurMarkerCache.rawLogged = false; // reset so raw marker block runs for the new key
  }

  // Sync trackMaxDurationAppliedSec with the final marker position (after zone adjustment)
  // so the actual automix trigger fires at exactly where the marker is shown.
  // Only while playing: the applied value is reset to the raw setting on each new track/playback start.
  if (uiState.isPlaying && trackMaxDurationEnabled) {
    const snappedAppliedSec = Math.max(0, Math.round((markerMs - startOffsetMs) / 1000));
    if (snappedAppliedSec !== trackMaxDurationAppliedSec) {
      trackMaxDurationAppliedSec = snappedAppliedSec;
    }
  }

  const pct = Math.min(100, (markerMs / durationMs) * 100);

  // Compute raw marker state (user's unaltered setting, not the zone-snapped applied value)
  const userRawMs = trackMaxDurationSec * 1000 + startOffsetMs;
  const rawPct = !maxExceedsDuration ? Math.min(100, (userRawMs / durationMs) * 100) : -1;
  const rawVisible = rawPct >= 0 && Math.abs(rawPct - pct) > 0.2;

  // Skip all DOM writes when the display state is identical to the last render.
  const renderKey = `${playingDeck}|${pct.toFixed(3)}|${rawVisible ? rawPct.toFixed(3) : 'off'}`;
  if (renderKey === _maxDurMarkerCache.renderKey) return;
  _maxDurMarkerCache.renderKey = renderKey;

  // Hide the inactive deck's markers
  const inactiveDeck = playingDeck === 'B' ? 'A' : 'B';
  const inactiveMarker = inactiveDeck === 'A' ? deckAMaxDurMarker : deckBMaxDurMarker;
  const inactiveRawMarker = inactiveDeck === 'A' ? deckAMaxDurRawMarker : deckBMaxDurRawMarker;
  if (inactiveMarker) inactiveMarker.hidden = true;
  if (inactiveRawMarker) inactiveRawMarker.hidden = true;

  // Show active deck marker
  const marker = playingDeck === 'B' ? deckBMaxDurMarker : deckAMaxDurMarker;
  if (marker) {
    marker.style.left = `${pct}%`;
    marker.hidden = false;
  }

  // Raw marker (log once per zone-key, update DOM on render-key change)
  const rawMarker = playingDeck === 'B' ? deckBMaxDurRawMarker : deckAMaxDurRawMarker;
  if (!maxExceedsDuration) {
    if (!_maxDurMarkerCache.rawLogged) {
      logDebug('maxDuration: raw marker', {
        track: currentItem?.name,
        userSettingSec: trackMaxDurationSec,
        startOffsetSec: startOffsetMs / 1000,
        rawMs: userRawMs,
        rawSec: userRawMs / 1000,
        rawPct,
        adjustedMs: markerMs,
        adjustedSec: markerMs / 1000,
        adjustedPct: pct,
        diffSec: (markerMs - userRawMs) / 1000,
        rawVisible,
      });
      _maxDurMarkerCache.rawLogged = true;
    }
    if (rawMarker) {
      if (rawVisible) {
        rawMarker.style.left = `${rawPct}%`;
        rawMarker.hidden = false;
      } else {
        rawMarker.hidden = true;
      }
    }
  } else {
    if (!_maxDurMarkerCache.rawLogged) {
      logDebug('maxDuration: raw marker hidden (maxExceedsDuration)', {
        track: currentItem?.name,
        effectiveMaxDurationSec,
        durationSec: durationMs / 1000,
        adjustedSec: markerMs / 1000,
        adjustedPct: pct,
      });
      _maxDurMarkerCache.rawLogged = true;
    }
    if (rawMarker) rawMarker.hidden = true;
  }
}

const MIX_ZONE_CONFIG = {
  peakZones: { label: 'Peak', className: 'zone-peak' },
  safeTransitionZones: { label: 'Zone sûre', className: 'zone-safe' },
  avoidTransitionZones: { label: 'À éviter', className: 'zone-avoid' },
  dropZones: { label: 'Drop', className: 'zone-drop' },
  breakdownZones: { label: 'Breakdown', className: 'zone-breakdown' },
  neverMissZones: { label: 'Never Miss', className: 'zone-never-miss' },
};

function formatZoneTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = String(wholeSeconds % 60).padStart(2, '0');
  const tenths = Math.floor((seconds - wholeSeconds) * 10);
  return `${minutes}:${remainingSeconds}.${tenths}`;
}

function renderMixZones() {
  const renderLayer = (layer, mixData, durationMs) => {
    if (!layer) return;

    layer.replaceChildren();

    const durationSec = Number(mixData?.durationSec) || (durationMs > 0 ? durationMs / 1000 : 0);
    if (!mixData || !Number.isFinite(durationSec) || durationSec <= 0) return;

    const zoneTypes = [
      'peakZones',
      'breakdownZones',
      'safeTransitionZones',
      'dropZones',
      'avoidTransitionZones',
      'neverMissZones',
    ];

    for (const zoneType of zoneTypes) {
      const config = MIX_ZONE_CONFIG[zoneType];
      const zones = Array.isArray(mixData[zoneType]) ? mixData[zoneType] : [];

      for (const zone of zones) {
        const startSec = Number(zone?.startSec);
        const endSec = Number(zone?.endSec);

        if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec) continue;

        const leftPct = Math.max(0, Math.min(100, (startSec / durationSec) * 100));
        const widthPct = Math.max(0.3, Math.min(100 - leftPct, ((endSec - startSec) / durationSec) * 100));
        const zoneEl = document.createElement('div');

        zoneEl.className = `deck-progress-zone ${config.className}`;
        zoneEl.style.left = `${leftPct}%`;
        zoneEl.style.width = `${widthPct}%`;
        const zoneScore = Number.isFinite(Number(zone?.score)) ? Number(zone.score)
          : Number.isFinite(Number(zone?.neverMissScore)) ? Number(zone.neverMissScore)
          : null;
        const zoneLabel = zone?.label ? ` · ${zone.label}` : '';
        const zoneReason = zone?.reason && zone.reason !== zone?.label ? ` · ${zone.reason}` : '';
        const zoneScoreTxt = zoneScore !== null ? ` · score ${zoneScore.toFixed(3)}` : '';
        zoneEl.title = `${config.label} ${formatZoneTime(startSec)} → ${formatZoneTime(endSec)}${zoneLabel}${zoneReason}${zoneScoreTxt}`;
        zoneEl.dataset.zoneType = zoneType;
        if (zone?.reason) zoneEl.dataset.reason = zone.reason;
        if (zoneScore !== null) zoneEl.dataset.score = String(zoneScore);

        layer.appendChild(zoneEl);
      }
    }
  };

  const playbackDuration = playbackDurationMs > 0 ? playbackDurationMs : (queue[uiState.currentIndex]?.duration ?? 0);
  const mixDataA = getTrackMixData(deckDisplayItems.A)
    || (automixTimeline.currentPlayingDeck === 'A' ? autoModeManager.getCurrentTrackMixData?.() : null)
    || (automixTimeline.currentPlayingDeck !== 'A' ? autoModeManager.getNextTrackMixData?.() : null);
  const mixDataB = getTrackMixData(deckDisplayItems.B)
    || (automixTimeline.currentPlayingDeck === 'B' ? autoModeManager.getCurrentTrackMixData?.() : null)
    || (automixTimeline.currentPlayingDeck !== 'B' ? autoModeManager.getNextTrackMixData?.() : null);

  renderLayer(deckAProgressZones, mixDataA, playbackDuration);
  renderLayer(deckBProgressZones, mixDataB, playbackDuration);
}

deckALowPassBtn?.addEventListener('click', () => {
  toggleDeckFilterMode('A', 'lowPass');
});

deckAHighPassBtn?.addEventListener('click', () => {
  toggleDeckFilterMode('A', 'highPass');
});

deckBLowPassBtn?.addEventListener('click', () => {
  toggleDeckFilterMode('B', 'lowPass');
});

deckBHighPassBtn?.addEventListener('click', () => {
  toggleDeckFilterMode('B', 'highPass');
});



clearQueueBtn.addEventListener('click', () => {
  if (!queue.length) return;

  if (uiState.currentTrackId) {
    const current = queue.find((item) => item.id === uiState.currentTrackId);
    if (current) {
      for (const item of queue) {
        if (item.id !== uiState.currentTrackId) releaseLocalBlob(item);
      }
      queue.length = 0;
      queue.push(current);
      uiState.currentIndex = 0;
    } else {
      for (const item of queue) releaseLocalBlob(item);
      queue.length = 0;
      uiState.currentIndex = -1;
      uiState.currentTrackId = null;
    }
  } else {
    for (const item of queue) releaseLocalBlob(item);
    queue.length = 0;
    uiState.currentIndex = -1;
  }

  renderQueue();
  scheduleDjSetQualityRefresh();
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

  openSearch();
  searchResults.innerHTML = '<div class="search-loading">Recherche API...</div>';
  lastSearchQuery = q;
  await runSearch(q, true);
});

if (searchIcon) {
  searchIcon.setAttribute('role', 'button');
  searchIcon.setAttribute('tabindex', '0');
  searchIcon.setAttribute('aria-label', 'Rechercher');
}

const triggerSearchFromUserAction = async () => {
  const q = searchInput.value.trim();
  clearTimeout(searchDebounceTimer);

  if (isCacheTabActive()) {
    setCacheFilter(q);
    closeSearch();
    return;
  }

  if (!q) return;

  openSearch();
  searchResults.innerHTML = '<div class="search-loading">Recherche API...</div>';
  lastSearchQuery = q;
  await runSearch(q, true);
};

searchIcon?.addEventListener('click', () => {
  void triggerSearchFromUserAction();
});

searchIcon?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  void triggerSearchFromUserAction();
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
  if (e.target === searchOverlay || e.target === searchResults) closeSearch();
});

function bindSearchResults(songResults, artistResults) {
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
  searchResults.querySelectorAll('.search-result-item').forEach((el) => {
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
}

function renderSearchResults(tracks, isPartial = false) {
  const seen = new Set();
  const normalized = tracks
    .map(mapApiTrackToSearchItem)
    .filter(Boolean)
    .filter((track) => {
      const key = track.id || `${track.name}|${track.artist}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(sortSearchResultsByPopularity);
  const songResults = normalized.filter((track) => !track.isArtistResult);
  const artistResults = normalized.filter((track) => track.isArtistResult);

  const spinnerHtml = isPartial
    ? '<div class="search-poll-spinner search-loading" style="font-size:11px;padding:3px 8px;opacity:0.7;">Recherche en cours...</div>'
    : '';
  searchResults.innerHTML = spinnerHtml + buildSearchResultsSectionsHTML(songResults, artistResults);
  bindSearchResults(songResults, artistResults);
}

function scheduleSearchPoll(query, token, attempt) {
  if (attempt >= 8) return;
  const delay = Math.min(1500 + attempt * 600, 5000);
  setTimeout(async () => {
    if (lastSearchQuery !== query || currentSearchPollToken !== token) return;
    const { pending, tracks } = await pollSearchResults(token).catch(() => ({ pending: true, tracks: [] }));
    if (lastSearchQuery !== query || currentSearchPollToken !== token) return;
    if (!pending) {
      currentSearchPollToken = null;
      if (tracks?.length) {
        logInfo('runSearch(): phase 2 results', { query, count: tracks.length });
        renderSearchResults(tracks, false);
      } else {
        searchResults.querySelector('.search-poll-spinner')?.remove();
        if (!searchResults.querySelector('.search-result-item')) {
          searchResults.innerHTML = '<div class="search-empty">Aucun résultat</div>';
        }
      }
    } else {
      scheduleSearchPoll(query, token, attempt + 1);
    }
  }, delay);
}

async function runSearch(query, skipCache = false) {
  logInfo('runSearch(): querying API', { query, skipCache });
  lastSearchQuery = query;
  currentSearchPollToken = null;

  try {
    if (!getDownloaderApiUrl()) {
      searchResults.innerHTML = '<div class="search-empty">Configurez l\'API de téléchargement dans l\'onglet Config</div>';
      return;
    }

    if (apiHealthMonitor.isOffline()) {
      searchResults.innerHTML = '<div class="search-empty">⚠ API hors ligne – recherche indisponible</div>';
      return;
    }

    const { tracks, pollToken } = await searchTracksRaw(query, 25, skipCache);
    if (lastSearchQuery !== query) return;

    logInfo('runSearch(): phase 1 results', { query, count: tracks?.length || 0, hasPollToken: !!pollToken });

    if (tracks?.length) {
      renderSearchResults(tracks, !!pollToken);
    } else if (pollToken) {
      searchResults.innerHTML = '<div class="search-loading">Recherche en cours...</div>';
    } else {
      searchResults.innerHTML = '<div class="search-empty">Aucun résultat</div>';
    }

    if (pollToken) {
      currentSearchPollToken = pollToken;
      scheduleSearchPoll(query, pollToken, 0);
    }
  } catch (err) {
    logError('runSearch(): failed', { query, message: err?.message });
    if (lastSearchQuery === query) {
      searchResults.innerHTML = `<div class="search-empty">⚠ ${escHtml(err.message)}</div>`;
    }
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
  if (!uiState.isPlaying) {
    await addToQueue(track, { playNow: true, preferFade: false });
    return;
  }

  let targetIndex = getQueueIndexForTrack(track);
  if (targetIndex < 0) {
    await addToQueue(track);
    targetIndex = getQueueIndexForTrack(track);
  }

  if (targetIndex < 0) return;

  const inactiveDeck = getResolvedInactiveDeck();
  uiState.deckBCueIndex = targetIndex;
  uiState.deckCueDeck = inactiveDeck;
  updateDeckCueUI();
  renderQueue();

  await launchDeckFromQueue(inactiveDeck, { paused: true, useCue: true });
  showToast(`Platine ${deckToPlatineLabel(inactiveDeck)} prechargee, AutoMix...`);
  autoMixBtn?.click();
  closeSearch();
}

async function addToQueue(track, options = {}) {
  const {
    playNow = false,
    preferFade = false,
    source = 'manual',
    autoDjReferenceTrackId = null,
    showAddedToast = true,
  } = options;
  const artUrl = getBestArtworkUrl(track);
  const duration = getTrackDurationMs(track);
  const stems = extractStemSourceUrls(track);
  const audioFeatures = extractAudioFeatures(track);
  const bpm = extractTrackBpm({ ...track, audioFeatures });
  const genre = extractTrackGenre(track);
  const suggestedStartOffsetMs = resolveTrackStartOffsetMs(track);
  const item = {
    id: track.id || track.ratingKey || track.uri || track.name,
    uri: track.uri || track.downloadUrl || `api:track:${track.id || track.name}`,
    name: track.name || track.title || 'Titre API',
    artist: track.artists ? track.artists.map((a) => a.name).join(', ') : (track.artist || 'Artiste inconnu'),
    artUrl,
    duration,
    bpm,
    genre,
    loudnessDb: extractTrackLoudnessDb(track),
    audioFeatures,
    stems: {
      vocalsUrl: stems.vocalsUrl,
      instrumentalUrl: stems.instrumentalUrl,
      echoUrl: stems.echoUrl,
      distortionUrl: stems.distortionUrl,
    },
    persistedSourceUrl: getDirectPlayableSourceUrl(track),
    sourceState: 'idle',
    sourceError: null,
    sourceMeta: null,
    localBlobUrl: null,
    queueSource: source,
    autoDjReferenceTrackId: source === 'auto-dj' ? (autoDjReferenceTrackId || null) : null,
    autoDjStartOffsetMs: suggestedStartOffsetMs,
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
        const useFade = uiState.isPlaying && preferFade;
        if (useFade) showCrossfadeRing(true);
        try {
          await startPlaybackForIndex(existingIndex, useFade ? 'crossfade' : 'play');
          uiState.currentIndex = existingIndex;
          uiState.currentTrackId = queue[existingIndex]?.id ?? null;
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

  // Si le deck inactif avait un morceau fil rouge préchargé via peek (ghost), le remplacer
  // par la nouvelle entrée. Le fil rouge n'a PAS encore avancé son index (on utilisait peek),
  // donc la chanson ghost "retourne" naturellement en tant que prochain du fil rouge.
  if (pendingFilRougeOnInactiveDeck && !playNow) {
    const prevGhost = pendingFilRougeOnInactiveDeck;
    pendingFilRougeOnInactiveDeck = null;
    const inactiveDeck = getResolvedInactiveDeck();
    if (deckDisplayItems[inactiveDeck] === prevGhost) {
      setDeckItem(inactiveDeck, item);
      logInfo('addToQueue(): replacing fil rouge ghost on inactive deck', {
        inactiveDeck,
        newItemId: item.id,
        newItemName: item.name,
      });
      fetchAndStoreArtworkForItem(item, inactiveDeck).catch(() => {});
      const replaceMixPreload = preloadMixDataForDeckItem(item, inactiveDeck);
      ensureLocalSource(item).then(async (url) => {
        if (!player || deckDisplayItems[inactiveDeck] !== item) return;
        await replaceMixPreload.catch(() => {});
        const startMs = Math.max(0, Number(item.autoDjStartOffsetMs) || 0);
        await player.playOnDeck(inactiveDeck, {
          url,
          loudnessDb: item.loudnessDb,
          bpm: item.bpm,
          durationMs: item.duration,
          audioFeatures: item.audioFeatures,
          stems: item.stems,
        }, { paused: true, startPositionMs: startMs });
        renderQueue();
      }).catch(() => {});
    }
  }

  renderQueue();
  scheduleDjSetQualityRefresh();

  if (playNow && player && !player.isCrossfading && uiState.isPlaying) {
    const useFade = Boolean(preferFade);
    if (useFade) showCrossfadeRing(true);
    try {
      await startPlaybackForIndex(addedIndex, useFade ? 'crossfade' : 'play');
      uiState.currentIndex = addedIndex;
      uiState.currentTrackId = item.id;
      renderQueue();
      closeSearch();
    } finally {
      if (useFade) showCrossfadeRing(false);
    }
    return;
  }

  if (!uiState.isPlaying && !player?.isCrossfading) {
    uiState.currentIndex = addedIndex;
    uiState.currentTrackId = item.id;
    renderQueue();

    if (player?.isReady) {
      await startPlaybackForIndex(uiState.currentIndex, 'play');
    } else {
      pendingAutoplay = true;
    }
  } else if (uiState.currentIndex < 0) {
    uiState.currentIndex = 0;
    uiState.currentTrackId = queue[0]?.id ?? null;
    renderQueue();
  }

  // Warm cache immediately on queue add so playback is instant later.
  ensureLocalSource(item).catch(() => {
    // keep silent; item state already shows error in queue
  });

  // Preload mix data early so start offset recommendations are available before cue/play.
  preloadMixDataForDeckItem(item, getResolvedInactiveDeck()).catch(() => {});

  if (showAddedToast) {
    showToast(`✔ "${item.name}" ajouté`);
  }
}

async function startPlaybackForIndex(index, mode, options = {}) {
  const item = queue[index];
  if (!item || !player) return;
  let startPositionMs = Math.max(0, Number(item.autoDjStartOffsetMs) || 0);

  const targetDeck = options.targetDeck || ((mode === 'play' || mode === 'switch')
    ? getResolvedActiveDeck()
    : getResolvedInactiveDeck());

  logInfo('startPlaybackForIndex(): begin', {
    index,
    mode,
    targetDeck,
    currentIndex: uiState.currentIndex,
    currentTrackId: uiState.currentTrackId,
    itemId: item.id,
    itemName: item.name,
  });

  if (mode === 'crossfade' && uiState.currentTrackId && item.id !== uiState.currentTrackId) {
    launchPreviewActive = true;
    launchPreviewArtUrl = item.artUrl || '';
    launchPreviewTitle = item.name || '';
    launchPreviewArtist = item.artist || '';
    launchPreviewDeck = targetDeck;
    launchPreviewItem = item;
  } else {
    launchPreviewActive = false;
    launchPreviewArtUrl = '';
    launchPreviewTitle = '';
    launchPreviewArtist = '';
    launchPreviewDeck = null;
    launchPreviewItem = null;
  }
  updateUpcomingArtwork();

  // Un nouveau morceau démarre : effacer le ghost fil rouge potentiellement en attente sur le deck inactif.
  pendingFilRougeOnInactiveDeck = null;

  try {
    touchQueueItem(item);
    setDeckItem(targetDeck, item);
    if (mode === 'play') setDeckItem(targetDeck === 'A' ? 'B' : 'A', null);
    updateNowPlaying(item, targetDeck);
    fetchAndStoreArtworkForItem(item, targetDeck).catch(() => {});

    const djPlan = djExternalPlanEnabled ? djPlanManager.getDjTransitionPlan(item) : null;

    if (djPlan?.mixInSecDefined) {
      // Le batch plan fournit un mixInSec précis : l'utiliser directement, sans calcul zone-based.
      startPositionMs = Math.max(0, Math.round((djPlan.mixInSec || 0) * 1000));
      item.autoDjStartOffsetMs = startPositionMs;
      touchQueueItem(item);
      logInfo('djPlan: mixInSec exact appliqué', {
        id: item.id,
        name: item.name,
        startOffsetMs: startPositionMs,
        decisionId: djPlan.decisionId,
      });
    } else if (djExternalPlanEnabled && !djPlan) {
      // Pas de transition planifiée : vérifier l'openingCue du batch pour ce morceau.
      const filRougeItem = filRougeManager.getPlaylist().find((p) => String(p.id) === String(item.id));
      if (filRougeItem?.djTrackId) {
        const openingCueMs = djPlanManager.getOpeningCueOffsetMs(filRougeItem.djTrackId);
        if (openingCueMs > 0) {
          startPositionMs = openingCueMs;
          item.autoDjStartOffsetMs = startPositionMs;
          touchQueueItem(item);
          logInfo('djPlan: openingCue appliqué', {
            id: item.id,
            name: item.name,
            startOffsetMs: startPositionMs,
            djTrackId: filRougeItem.djTrackId,
          });
        }
      }
    }

    const mixPreloadPromise = preloadMixDataForDeckItem(item, targetDeck);
    if (startPositionMs <= 0) {
      // Aucun plan DJ défini : attendre les données mix pour l'offset zone-based.
      await Promise.race([
        mixPreloadPromise,
        new Promise((resolve) => setTimeout(resolve, 700)),
      ]);
      startPositionMs = Math.max(0, Number(item.autoDjStartOffsetMs) || 0);
    }

    updatePlannedStartMarker();

    const sourceUrl = await ensureLocalSource(item);
    logDebug('startPlaybackForIndex(): source resolved', {
      index,
      mode,
      targetDeck,
      sourcePreview: String(sourceUrl || '').slice(0, 80),
      sourceState: item.sourceState,
      sourceMeta: item.sourceMeta,
    });

    if ((mode === 'autofade' || mode === 'crossfade') && item.sourceState !== 'ready') {
      logWarn('startPlaybackForIndex(): crossfade starting with source not ready', {
        index,
        mode,
        targetDeck,
        id: item.id,
        name: item.name,
        sourceState: item.sourceState,
      });
    }

    let djRateApplied = false;
    if (djPlan?.recommendedBpm && mixFeatures.autoBpm) {
      const djRate = computeDjBpmRate(djPlan.recommendedBpm, item.bpm);
      if (djRate != null) {
        player.setDeckPlaybackRate(targetDeck, djRate);
        djRateApplied = true;
        logDebug('djPlan: bpm rate applied', {
          targetDeck, rate: djRate, recommendedBpm: djPlan.recommendedBpm, trackBpm: item.bpm,
        });
      }
    }
    if (!djRateApplied) {
      player.resetDeckPlaybackRate(targetDeck);
    }

    const djModeOverridden = Boolean(djPlan?.mode && djPlan.mode !== selectedTransitionMode);
    if (djModeOverridden) {
      player.setTransitionMode(djPlan.mode);
      logDebug('djPlan: transition mode override', { mode: djPlan.mode, decisionId: djPlan.decisionId });
    }

    // Appliquer crossfadeDurationSec du plan batch si disponible.
    const savedCrossfadeDuration = player.crossfadeDuration;
    const djCrossfadeMs = Number.isFinite(djPlan?.crossfadeDurationSec) && djPlan.crossfadeDurationSec > 0
      ? Math.round(djPlan.crossfadeDurationSec * 1000)
      : 0;
    if (djCrossfadeMs > 0) {
      player.crossfadeDuration = djCrossfadeMs;
      logDebug('djPlan: crossfade duration override', { crossfadeMs: djCrossfadeMs, decisionId: djPlan.decisionId });
    }

    try {
      if (mode === 'autofade') {
        await player.crossfadeToDeck(targetDeck, {
          url: sourceUrl,
          loudnessDb: item.loudnessDb,
          bpm: item.bpm,
          durationMs: item.duration,
          audioFeatures: item.audioFeatures,
          stems: item.stems,
        }, { startPositionMs });
      } else if (mode === 'crossfade') {
        await player.crossfadeToDeck(targetDeck, {
          url: sourceUrl,
          loudnessDb: item.loudnessDb,
          bpm: item.bpm,
          durationMs: item.duration,
          audioFeatures: item.audioFeatures,
          stems: item.stems,
        }, { startPositionMs });
      } else if (mode === 'switch') {
        await player.playOnDeck(getResolvedActiveDeck(), {
          url: sourceUrl,
          loudnessDb: item.loudnessDb,
          bpm: item.bpm,
          durationMs: item.duration,
          audioFeatures: item.audioFeatures,
          stems: item.stems,
        }, { makeActive: true, paused: false, startPositionMs });
      } else {
        await player.playOnDeck(getResolvedActiveDeck(), {
          url: sourceUrl,
          loudnessDb: item.loudnessDb,
          bpm: item.bpm,
          durationMs: item.duration,
          audioFeatures: item.audioFeatures,
          stems: item.stems,
        }, { makeActive: true, paused: false, startPositionMs });
      }
    } finally {
      if (djCrossfadeMs > 0) {
        player.crossfadeDuration = savedCrossfadeDuration;
      }
      if (djModeOverridden) {
        player.setTransitionMode(selectedTransitionMode);
      }
    }

    if (mode === 'autofade' || mode === 'crossfade') {
      uiState.currentIndex = index;
      uiState.currentTrackId = item.id;
    } else {
      uiState.currentIndex = index;
      uiState.currentTrackId = item.id;
    }

    // Sync uiState.deckMixRatio to the actual post-fade state so volumes stay consistent
    if ((mode === 'autofade' || mode === 'crossfade') && player) {
      const newRatio = targetDeck === 'B' ? 1 : 0;
      applyDeckMixRatio(newRatio, 0);
    }

    // After a crossfade: load next track into the now-inactive deck (paused, ready for next fade)
    if ((mode === 'autofade' || mode === 'crossfade') && player) {
      const inactiveDeck = getResolvedInactiveDeck();
      const nextIndex = getFollowingQueueIndex(index, { wrap: false });
      const nextItem = nextIndex >= 0 ? queue[nextIndex] : null;
      if (nextItem) {
        logDebug('startPlaybackForIndex(): preparing inactive deck with next track', {
          inactiveDeck,
          nextIndex,
          nextItemId: nextItem.id,
          nextItemName: nextItem.name,
        });

        setDeckItem(inactiveDeck, nextItem);
        updatePlannedStartMarker();

        fetchAndStoreArtworkForItem(nextItem, inactiveDeck).catch(() => {});
        const nextMixPreload = preloadMixDataForDeckItem(nextItem, inactiveDeck);

        ensureLocalSource(nextItem).then(async (nextUrl) => {
          if (!player) return;

          await nextMixPreload.catch(() => {});
          const nextStartPositionMs = Math.max(0, Number(nextItem.autoDjStartOffsetMs) || 0);

          await player.playOnDeck(inactiveDeck, {
            url: nextUrl,
            loudnessDb: nextItem.loudnessDb,
            bpm: nextItem.bpm,
            durationMs: nextItem.duration,
            audioFeatures: nextItem.audioFeatures,
            stems: nextItem.stems,
          }, {
            paused: true,
            startPositionMs: nextStartPositionMs,
          });
          renderQueue();
        }).catch(() => {});
      } else if (filRougeManager.isActive() && !isLowMemoryPlaybackMode()) {
        // Pas de prochain morceau en file d'attente, mais le fil rouge en a un :
        // précharger le prochain morceau fil rouge sur le deck inactif (via peek, sans avancer l'index).
        const peekedFilRouge = filRougeManager.peekNextTrackFromAny();
        if (peekedFilRouge) {
          const ghostItem = {
            id: peekedFilRouge.id || `filrouge-ghost-${Date.now()}`,
            uri: peekedFilRouge.persistedSourceUrl || '',
            name: peekedFilRouge.name || 'Inconnu',
            artist: peekedFilRouge.artist || 'Artiste inconnu',
            artUrl: peekedFilRouge.artUrl || '',
            duration: peekedFilRouge.duration || 0,
            bpm: peekedFilRouge.bpm || null,
            genre: peekedFilRouge.genre || '',
            cachePath: peekedFilRouge.cachePath || '',
            persistedSourceUrl: peekedFilRouge.persistedSourceUrl || '',
            ratingKey: peekedFilRouge.ratingKey || '',
            stemsStatus: peekedFilRouge.stemsStatus || '',
            stems: peekedFilRouge.stems || null,
            sourceState: 'idle',
            sourceError: null,
            sourceMeta: null,
            localBlobUrl: null,
            queueSource: 'fil-rouge',
            lastTouchedAt: Date.now(),
          };
          setDeckItem(inactiveDeck, ghostItem);
          pendingFilRougeOnInactiveDeck = ghostItem;
          updatePlannedStartMarker();

          logDebug('startPlaybackForIndex(): preloading fil rouge ghost on inactive deck', {
            inactiveDeck,
            ghostId: ghostItem.id,
            ghostName: ghostItem.name,
          });

          fetchAndStoreArtworkForItem(ghostItem, inactiveDeck).catch(() => {});
          const ghostMixPreload = preloadMixDataForDeckItem(ghostItem, inactiveDeck);

          ensureLocalSource(ghostItem).then(async (ghostUrl) => {
            if (!player || pendingFilRougeOnInactiveDeck !== ghostItem) return;
            await ghostMixPreload.catch(() => {});
            const ghostStartMs = Math.max(0, Number(ghostItem.autoDjStartOffsetMs) || 0);
            if (pendingFilRougeOnInactiveDeck !== ghostItem) return;
            await player.playOnDeck(inactiveDeck, {
              url: ghostUrl,
              loudnessDb: ghostItem.loudnessDb,
              bpm: ghostItem.bpm,
              durationMs: ghostItem.duration,
              audioFeatures: ghostItem.audioFeatures,
              stems: ghostItem.stems,
            }, { paused: true, startPositionMs: ghostStartMs });
            renderQueue();
          }).catch(() => {
            if (pendingFilRougeOnInactiveDeck === ghostItem) {
              pendingFilRougeOnInactiveDeck = null;
              setDeckItem(inactiveDeck, null);
            }
          });
        }
      }    }

    uiState.isPlaying = true;
    prefetchNext(getFollowingQueueIndex(index, { wrap: false }));
    launchPreviewActive = false;
    launchPreviewArtUrl = '';
    launchPreviewTitle = '';
    launchPreviewArtist = '';
    launchPreviewDeck = null;
    launchPreviewItem = null;
    renderQueue();
    logInfo('startPlaybackForIndex(): done', {
      mode,
      index,
      currentIndex: uiState.currentIndex,
      currentTrackId: uiState.currentTrackId,
      targetDeck,
      isPlaying: uiState.isPlaying,
    });
    trimRetainedAudioSources();

    // Schedule automix timing for auto DJ mode and reset trigger flag
    resetAutomixTimeline(automixTimeline, targetDeck);
    maxDurMarkerTriggeredForTrack = false;
    _maxDurMarkerCache.key = null;
    _maxDurMarkerCache.renderKey = null;
    _maxDurMarkerCache.rawLogged = false;
    _plannedStartMarkerLastKey = null;
    automixRescheduledForTrackId = null;
    applyTrackMaxDurationForCurrentPlayback();
    updateAutoDjMarker();
    updateMaxDurationMarker();
    autoModeManager.scheduleAutomixTiming(item);
    if (autoSuggestionQueueSearchEnabled) {
      // Defer suggestion search to idle time to avoid competing with playback startup
      scheduleIdle(() => {
        autoModeManager.searchAndAddNextTrack(item).catch((err) => {
          logWarn('autoDj: search on track start failed', { error: err?.message });
        });
      }, 3000);
    }
  } catch (err) {
    item.sourceState = 'error';
    item.sourceError = err.message;
    launchPreviewActive = false;
    launchPreviewArtUrl = '';
    launchPreviewTitle = '';
    launchPreviewArtist = '';
    launchPreviewDeck = null;
    launchPreviewItem = null;
    renderQueue();
    logError('startPlaybackForIndex(): failed', {
      mode,
      index,
      targetDeck,
      itemId: item.id,
      message: err?.message,
    });
    showToast(`API: ${err.message}`, true);
    // Flux non lisible : retirer de la file d'attente et du fil rouge, passer au suivant
    const _failedIdx = queue.findIndex((q) => q.id === item.id);
    if (_failedIdx >= 0) removeFromQueue(_failedIdx);
    if (filRougeManager.isActive()) {
      const _pq = filRougeManager.getPriorityQueue();
      const _pqIdx = _pq.findIndex((t) => t.id === item.id);
      if (_pqIdx >= 0) filRougeManager.removeFromPriorityQueue(_pqIdx);
      const _pl = filRougeManager.getPlaylist();
      const _plIdx = _pl.findIndex((t) => t.id === item.id);
      if (_plIdx >= 0) filRougeManager.removeFromPlaylist(_plIdx);
    }
    setTimeout(() => autoMixBtn?.click?.(), 400);
    throw err;
  }
}

function resolveTrackStartOffsetMs(track) {
  if (!track || typeof track !== 'object') return 0;

  const parseToMs = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return numeric < 1000 ? Math.round(numeric * 1000) : Math.round(numeric);
  };

  const direct = [
    track.autoDjStartOffsetMs,
    track.startOffsetMs,
    track.startTimeMs,
    track.startMs,
    track.offsetMs,
    track.entryPointMs,
    track.cueInMs,
    track.mixStartMs,
    track.startSec,
    track.startTimeSec,
    track.startSeconds,
    track.offsetSec,
    track.entryPointSec,
    track.cueInSec,
    track.mixStartSec,
  ];

  for (const candidate of direct) {
    const ms = parseToMs(candidate);
    if (ms > 0) return ms;
  }

  const nested = [
    track.mixSuggestion,
    track.suggestion,
    track.mix,
    track.transition,
    track.recommendation,
    track.meta,
  ];

  for (const node of nested) {
    if (!node || typeof node !== 'object') continue;
    const ms = resolveTrackStartOffsetMs(node);
    if (ms > 0) return ms;
  }

  return 0;
}

function prefetchNext(index) {
  if (index < 0) return;
  const next = queue[index];
  if (!next) return;

  const lowMemory = isLowMemoryPlaybackMode();
  if (lowMemory) {
    // En mode mémoire faible on libère tout sauf les decks actifs, mais on garde
    // (ou ré-établit ci-dessous) la source du prochain morceau pour éviter un
    // freeze audio en attendant son téléchargement au moment du crossfade.
    logDebug('prefetchNext(): low-memory mode, trimming other sources but keeping next track warm', {
      index,
      id: next.id,
      name: next.name,
    });
    trimRetainedAudioSources();
  }
  if (next.localBlobUrl) return;

  // Defer prefetch to idle time to avoid competing with active playback audio decoding
  scheduleIdle(() => {
    // Re-check conditions after idle delay (track may have been removed or loaded)
    if (next.localBlobUrl || !queue.includes(next)) return;
    logDebug('prefetchNext(): prefetching track source', {
      index,
      id: next.id,
      name: next.name,
    });
    touchQueueItem(next);

    enqueueBackgroundTask(() => ensureLocalSource(next).catch(() => {
      // silent prefetch failure: user can still trigger manually and get toast
    }));
  });
}

function buildFilRougeHintHTML() {
  if (!filRougeManager.isActive()) return '';
  const next = filRougeManager.peekNextTrack();
  if (!next) return '';
  const artHtml = next.artUrl
    ? `<img class="queue-art" src="${escHtml(next.artUrl)}" alt="" loading="lazy">`
    : '<div class="queue-art"></div>';
  return `<div class="queue-filrouge-hint">${artHtml}<div class="queue-info"><div class="queue-filrouge-hint-label">Prochain · fil rouge</div><div class="queue-name">${escHtml(next.name || 'Inconnu')}</div><div class="queue-artist">${escHtml(next.artist || '')}</div></div></div>`;
}

function renderQueue() {
  saveQueueDebounced();
  pushQueue(queue);
  uiRenderer.updateUpcomingArtwork();
  updateDeckCueUI();
  // Fetch BPM/genre in background for visible items that are missing them
  const visibleStart = uiState.currentIndex > 0 ? Math.max(0, uiState.currentIndex - 5) : 0;
  queue.slice(visibleStart, visibleStart + 20).forEach((item) => {
    if (!item.bpm || !item.genre) fetchMissingMeta(item).catch(() => {});
  });

  if (!queue.length) {
    uiRenderer.queueList.innerHTML = '';
    uiRenderer.queueList.appendChild(uiRenderer.emptyQueue);
    uiRenderer.emptyQueue.style.display = '';
    const hintHtml = buildFilRougeHintHTML();
    if (hintHtml) uiRenderer.queueList.insertAdjacentHTML('beforeend', hintHtml);
    if (uiRenderer.autoMixBtn) uiRenderer.autoMixBtn.disabled = !filRougeManager.isActive();
    updateSuggestionRefreshButtons();
    return;
  }

  uiRenderer.emptyQueue.style.display = 'none';
  if (uiRenderer.autoMixBtn) uiRenderer.autoMixBtn.disabled = queue.length <= 1 && !filRougeManager.isActive();

  uiRenderer.queueList.innerHTML = uiRenderer.buildQueueHTML();
  const hintHtml = buildFilRougeHintHTML();
  if (hintHtml) uiRenderer.queueList.insertAdjacentHTML('beforeend', hintHtml);

  attachQueueDndHandlers({
    queueList: uiRenderer.queueList,
    state: appState.queueDnd,
    onReorder: (fromIndex, targetIndex, insertAfter) => {
      reorderQueue(fromIndex, targetIndex, insertAfter);
    },
    onActivate: (idx) => {
      uiState.deckBCueIndex = idx;
      autoMixBtn?.click?.();
    },
    getCurrentIndex: () => uiState.currentIndex,
    isCrossfading: () => Boolean(player?.isCrossfading),
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
      uiState.deckBCueIndex = idx;
      uiState.deckCueDeck = deck;
      updateDeckCueUI();
      showToast(`Cue Platine ${deckToPlatineLabel(deck)}: ${queue[idx].name}`);
      renderQueue();

      await launchDeckFromQueue(deck, { paused: true, useCue: true });
    });
  });

  updateSuggestionRefreshButtons();
}

function removeFromQueue(idx) {
  const item = queue[idx];
  if (item?.id === uiState.currentTrackId) return;
  const [removed] = queue.splice(idx, 1);
  releaseLocalBlob(removed);

  if (deckDisplayItems.A?.id === removed?.id) setDeckItem('A', null);
  if (deckDisplayItems.B?.id === removed?.id) setDeckItem('B', null);

  if (uiState.deckBCueIndex === idx) uiState.deckBCueIndex = -1;
  else if (uiState.deckBCueIndex > idx) uiState.deckBCueIndex -= 1;
  if (uiState.deckCueDeck && deckDisplayItems[uiState.deckCueDeck]?.id === item?.id) uiState.deckCueDeck = null;
  updateDeckCueUI();
  updateCurrentIndex();
  renderQueue();
  scheduleDjSetQualityRefresh();
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
  if (uiState.deckBCueIndex === fromIndex) {
    uiState.deckBCueIndex = insertIndex;
  } else {
    if (fromIndex < uiState.deckBCueIndex && insertIndex >= uiState.deckBCueIndex) uiState.deckBCueIndex -= 1;
    if (fromIndex > uiState.deckBCueIndex && insertIndex <= uiState.deckBCueIndex) uiState.deckBCueIndex += 1;
  }
  updateDeckCueUI();
  updateCurrentIndex();
  clearQueueDragMarkers(uiRenderer.queueList);
  renderQueue();
}

function updateCurrentIndex() {
  if (!uiState.currentTrackId) {
    uiState.currentIndex = -1;
    return;
  }
  const idx = queue.findIndex((item) => item.id === uiState.currentTrackId);
  uiState.currentIndex = idx >= 0 ? idx : -1;
}

function startBlobCleanupLoop() {
  if (blobCleanupTimer) clearInterval(blobCleanupTimer);

  // Cache is intentionally kept for the whole page lifetime.
  blobCleanupTimer = null;
}

const METRICS_LOG_INTERVAL_MS = 60_000;

// Photo périodique de l'usage cache/mémoire pour repérer fuites/croissance anormale
// pendant une session de lecture longue. N'effectue rien si le mode debug est désactivé.
function logPeriodicMetrics() {
  if (!isDebugLoggingEnabled()) return;

  const memory = performance.memory ? {
    usedJsHeapMb: Math.round(performance.memory.usedJSHeapSize / (1024 * 1024)),
    totalJsHeapMb: Math.round(performance.memory.totalJSHeapSize / (1024 * 1024)),
    jsHeapLimitMb: Math.round(performance.memory.jsHeapSizeLimit / (1024 * 1024)),
  } : null;

  logInfo('metrics.periodic', {
    queueLength: queue.length,
    sessionBlobCacheEntries: sessionBlobCache.size,
    lowMemoryPlaybackMode: isLowMemoryPlaybackMode(),
    memory,
  });
}

function startMetricsLoop() {
  if (metricsLogTimer) clearInterval(metricsLogTimer);
  metricsLogTimer = setInterval(logPeriodicMetrics, METRICS_LOG_INTERVAL_MS);
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

function getFollowingQueueIndex(index, options = {}) {
  if (queue.length <= 1) return -1;

  const numeric = Number(index);
  if (!Number.isFinite(numeric)) return -1;

  const explicitWrap = 'wrap' in options;
  const wrap = explicitWrap ? options.wrap : queueLoopEnabled;

  // Apply shuffle only for natural next-track calls (not explicit wrap:false prefetch calls)
  if (queueShuffleEnabled && !explicitWrap) {
    let randomIdx;
    let attempts = 0;
    do {
      randomIdx = Math.floor(Math.random() * queue.length);
      attempts++;
    } while (randomIdx === numeric && attempts < 20);
    return randomIdx === numeric ? -1 : randomIdx;
  }

  const nextIndex = numeric + 1;
  if (nextIndex < queue.length) return nextIndex;
  return wrap ? getWrappedQueueIndex(nextIndex) : -1;
}

function updateCrossfadeBars({ fromDeck,fromVolume, toVolume, toPosition, toDuration }) {
  if(fromDeck === 'A') {
    updateDeckMixUI(toVolume);
  }else {updateDeckMixUI(fromVolume);}
}

async function seekDeckFromProgressEvent(deck, event) {
  if (!player || !event?.currentTarget) return;
  const detail = uiState.lastDeckState;
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
updateDeckMixUI(uiState.deckMixRatio);
updateManualLockUI();
updateDeckCueUI();
updateMixFeaturesUI();
updateDjFxMenuUI();
fxControlsHidden = readFxControlsHiddenSetting();
updateFxVisibilityUI();

function doLogout() {
  launchPreviewArtUrl = '';
  pendingAutoplay = false;
  lastSearchQuery = '';
  pendingSearchAdd = false;
  manualMixLock = false;
  uiState.deckBCueIndex = -1;
  mixFeatures = {
    autoBpm: false,
    echo: false,
    distortion: false,
    deckFx: {
      A: { vocalRemove: false, instruRemove: false, filterMode: 'off' },
      B: { vocalRemove: false, instruRemove: false, filterMode: 'off' },
    },
  };

  autoModeManager.reset();

  player?.destroy();
  player = null;

  resetDjFxRuntime();

  for (const item of queue) releaseLocalBlob(item);
  clearSessionBlobCache();

  if (blobCleanupTimer) {
    clearInterval(blobCleanupTimer);
    blobCleanupTimer = null;
  }
  stopSpotifyFilRougeSync();

  queue.length = 0;
  uiState.currentIndex = -1;
  uiState.currentTrackId = null;
  uiState.isPlaying = false;
  playlistLoaded = false;
  playbackPositionMs = 0;
  playbackDurationMs = 0;

  // Reset auto DJ timing
  resetAutomixTimeline(automixTimeline, 'A');
  lastAutoDjFxTriggeredAt = 0;
  updateAutoDjMarker();
  updateMaxDurationMarker();

  removeQueueSetting();
  deckDisplayItems.A = null;
  deckDisplayItems.B = null;
  uiState.prevIsCrossfading = false;
  uiState.deckCueDeck = null;
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
  updateDjFxMenuUI();
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
