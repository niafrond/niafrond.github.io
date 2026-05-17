/**
 * main.js - DJ Mix app orchestrator.
 * Search: downloader API
 * Playback: temporary local Blob download + dual-deck crossfade
 */

import { DJPlayer } from './player.js';
import {
  getAllowedTransitionModesForRam,
  getTransitionRamRequirementsMb,
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
const TRACK_MAX_DURATION_KEY = 'dj-mix:track:max-duration';
const TRACK_MAX_DURATION_ENABLED_KEY = 'dj-mix:track:max-duration:enabled';
const RAM_FILTER_ENABLED_KEY = 'dj-mix:ram-filter:enabled';
const RAM_TOTAL_MB_OVERRIDE_KEY = 'dj-mix:ram-filter:total-mb-override';
const AUTO_DJ_FX_SETTINGS_KEY = 'dj-mix:auto-dj:fx:settings';
const DEFAULT_DOWNLOADER_API_URL = 'http://192.168.8.149:3000';
const AUDIO_CACHE_NAME = 'dj-mix:audio-cache:v1';
const MOBILE_TRANSITION_RAM_BUDGET_RATIO = 0.12;

const AUTO_DJ_FX_CONFIG = Object.freeze({
  filter: { label: 'Filter', category: 'filter' },
  lowPass: { label: 'Low-pass', category: 'filter' },
  highPass: { label: 'High-pass', category: 'filter' },
  echoDelay: { label: 'Echo / Delay', category: 'modulation' },
  reverb: { label: 'Reverb', category: 'modulation' },
  flangerPhaser: { label: 'Flanger / Phaser', category: 'modulation' },
  roll: { label: 'Roll / Loop', category: 'beat' },
  loop: { label: 'Loop', category: 'beat' },
  beatRepeat: { label: 'Beat Repeat', category: 'beat' },
  brake: { label: 'Brake / Vinyl Stop', category: 'transport' },
  backspin: { label: 'Backspin / Rewind', category: 'transport' },
  noise: { label: 'Noise FX', category: 'textural' },
  eq: { label: 'EQ', category: 'filter' },
  pitchTempo: { label: 'Pitch / Tempo', category: 'pitch' },
  keyShift: { label: 'Key Shift / Harmonic', category: 'pitch' },
  scratching: { label: 'Scratching', category: 'scratch' },
  hotCues: { label: 'Hot Cues', category: 'cue' },
  sampling: { label: 'Sampling', category: 'sample' },
});

const AUTO_DJ_FX_TYPES = Object.freeze(Object.keys(AUTO_DJ_FX_CONFIG));

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
let autoSuggestionRefreshInProgress = false;
let deckBCueIndex = -1;
let deckCueDeck = null;
const deckMixDataByTrackId = new Map();

// Auto DJ timing
let nextAutomixTriggerMs = -1; // When to trigger automix (ms from start)
let automixTriggeredForTrack = false; // Has automix been triggered for current track
let currentPlayingDeck = 'A'; // Which deck has the currently playing track

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
const djFxRuntime = {
  loopTimers: { A: null, B: null },
  playbackRateTimers: { A: null, B: null },
  samplingAudioContext: null,
  vinylNoiseBuffer: null,
  scratch: {
    animationFrameId: null,
    deck: 'A',
    velocity: 0,
    currentRate: 0,
    endAtMs: 0,
    lastReverseSeekAtMs: 0,
    running: false,
  },
  transientActionTimers: new Map(),
  autoDjRestoreTimers: new Map(),
  activeTransientActions: new Set(),
};
let fxControlsHidden = false;
const deckDisplayItems = { A: null, B: null };
let prevIsCrossfading = false;
let selectedTransitionMode = readTransitionModeSetting();
let ramFilterEnabled = readRamFilterEnabledSetting();
let ramTotalMbOverride = readRamTotalMbOverrideSetting();
let allowedTransitionModes = [...MIX_TRANSITION_MODES];
let transitionRamRequirementsMb = getTransitionRamRequirementsMb();
let transitionRamCapability = null;
let trackMaxDurationSec = readTrackMaxDurationSetting();
let trackMaxDurationEnabled = readTrackMaxDurationEnabledSetting(trackMaxDurationSec > 0);
let trackMaxDurationAppliedSec = trackMaxDurationEnabled ? trackMaxDurationSec : 0;
let lastTrackMaxDurationSec = trackMaxDurationSec > 0 ? trackMaxDurationSec : 120;
let autoDjFxSettings = readAutoDjFxSettings();
let lastAutoDjFxTriggeredAt = 0;

function isMobileDevice() {
  const ua = String(navigator.userAgent || navigator.vendor || '').toLowerCase();
  const coarseTouch = window.matchMedia?.('(pointer: coarse)')?.matches === true;
  return /android|iphone|ipad|ipod|mobile|windows phone|opera mini|blackberry/.test(ua)
    || (coarseTouch && Math.min(window.innerWidth, window.innerHeight) < 900);
}

function estimateTotalDeviceRamMb() {
  if (Number.isFinite(navigator.deviceMemory) && navigator.deviceMemory > 0) {
    return Math.round(navigator.deviceMemory * 1024);
  }

  const cores = Number(navigator.hardwareConcurrency) || 0;
  if (cores <= 2) return 1536;
  if (cores <= 4) return 2048;
  if (cores <= 6) return 3072;
  return 4096;
}

function readRamFilterEnabledSetting() {
  try {
    const stored = localStorage.getItem(RAM_FILTER_ENABLED_KEY);
    if (stored == null) return true;
    return stored !== '0';
  } catch (_) {
    return true;
  }
}

function createDefaultAutoDjFxAllowed() {
  const defaults = {};
  for (const type of AUTO_DJ_FX_TYPES) {
    defaults[type] = true;
  }
  return defaults;
}

function getSafeAutoDjFxMinIntervalSec(value) {
  const numeric = Math.round(Number(value) || 0);
  return Math.max(1, Math.min(180, numeric || 14));
}

function getSafeAutoDjFxMaxIntervalSec(value) {
  const numeric = Math.round(Number(value) || 0);
  return Math.max(3, Math.min(300, numeric || 45));
}

function normalizeAutoDjFxIntervalSettings(minIntervalSec, maxIntervalSec) {
  const safeMin = getSafeAutoDjFxMinIntervalSec(minIntervalSec);
  const safeMaxRaw = getSafeAutoDjFxMaxIntervalSec(maxIntervalSec);
  return {
    minIntervalSec: safeMin,
    maxIntervalSec: Math.max(safeMin, safeMaxRaw),
  };
}

function readAutoDjFxSettings() {
  const defaultsIntervals = normalizeAutoDjFxIntervalSettings(14, 45);
  const defaults = {
    allowed: createDefaultAutoDjFxAllowed(),
    minIntervalSec: defaultsIntervals.minIntervalSec,
    maxIntervalSec: defaultsIntervals.maxIntervalSec,
  };

  try {
    const raw = localStorage.getItem(AUTO_DJ_FX_SETTINGS_KEY);
    if (!raw) return defaults;

    const parsed = JSON.parse(raw);
    const allowedFromStorage = (parsed && typeof parsed.allowed === 'object') ? parsed.allowed : {};
    const allowed = { ...defaults.allowed };

    // Accept any FX from config, even if not in AUTO_DJ_FX_TYPES
    // This allows autodj to launch FX regardless of config coherence
    for (const type in allowedFromStorage) {
      if (Object.prototype.hasOwnProperty.call(allowedFromStorage, type)) {
        allowed[type] = Boolean(allowedFromStorage[type]);
      }
    }

    const intervals = normalizeAutoDjFxIntervalSettings(
      parsed?.minIntervalSec,
      parsed?.maxIntervalSec,
    );

    return {
      allowed,
      minIntervalSec: intervals.minIntervalSec,
      maxIntervalSec: intervals.maxIntervalSec,
    };
  } catch (_) {
    return defaults;
  }
}

function persistAutoDjFxSettings() {
  try {
    localStorage.setItem(AUTO_DJ_FX_SETTINGS_KEY, JSON.stringify(autoDjFxSettings));
  } catch (_) {
    // ignore storage failures
  }
}

function isAutoDjFxTypeAllowed(type) {
  if (!type) return false;
  if (!Object.prototype.hasOwnProperty.call(autoDjFxSettings.allowed, type)) return true;
  return Boolean(autoDjFxSettings.allowed[type]);
}

function updateAutoDjFxConfigUI() {
  const intervals = normalizeAutoDjFxIntervalSettings(
    autoDjFxSettings.minIntervalSec,
    autoDjFxSettings.maxIntervalSec,
  );
  autoDjFxSettings = {
    ...autoDjFxSettings,
    minIntervalSec: intervals.minIntervalSec,
    maxIntervalSec: intervals.maxIntervalSec,
  };

  if (autoDjFxMinIntervalInput) {
    autoDjFxMinIntervalInput.value = String(intervals.minIntervalSec);
  }
  if (autoDjFxMaxIntervalInput) {
    autoDjFxMaxIntervalInput.value = String(intervals.maxIntervalSec);
  }

  for (const toggleEl of autoDjFxToggleEls) {
    const type = String(toggleEl.dataset.autoFxType || '');
    toggleEl.checked = isAutoDjFxTypeAllowed(type);
  }

  if (autoDjFxStatus) {
    const allowedCount = AUTO_DJ_FX_TYPES.reduce((count, type) => {
      return count + (isAutoDjFxTypeAllowed(type) ? 1 : 0);
    }, 0);
    autoDjFxStatus.textContent = `Robot FX: ${allowedCount}/${AUTO_DJ_FX_TYPES.length} autorises, intervalle ${intervals.minIntervalSec}s a ${intervals.maxIntervalSec}s.`;
  }
}

function persistRamFilterEnabledSetting(enabled) {
  try {
    localStorage.setItem(RAM_FILTER_ENABLED_KEY, enabled ? '1' : '0');
  } catch (_) {
    // ignore storage failures
  }
}

function readRamTotalMbOverrideSetting() {
  try {
    const stored = Number.parseInt(localStorage.getItem(RAM_TOTAL_MB_OVERRIDE_KEY) || '0', 10);
    if (!Number.isFinite(stored) || stored <= 0) return 0;
    return Math.max(512, Math.min(32768, stored));
  } catch (_) {
    return 0;
  }
}

function persistRamTotalMbOverrideSetting(totalMb) {
  try {
    const safeMb = Math.max(0, Number.parseInt(String(totalMb || '0'), 10) || 0);
    localStorage.setItem(RAM_TOTAL_MB_OVERRIDE_KEY, String(safeMb));
  } catch (_) {
    // ignore storage failures
  }
}

function computeTransitionRamRequirements() {
  const crossfadeSeconds = clampCrossfadeSeconds(crossfadeSlider?.value || localStorage.getItem('dj-mix:crossfade-seconds') || 6);
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

  const mobile = isMobileDevice();
  const shouldApplyFilter = ramFilterEnabled && (mobile || ramTotalMbOverride > 0);

  if (!shouldApplyFilter) {
    allowedTransitionModes = [...MIX_TRANSITION_MODES];
    transitionRamCapability = {
      enabled: false,
      mobile: false,
      totalRamMb: null,
      transitionBudgetMb: null,
      disabledModes: [],
    };
    updateTransitionModeAvailabilityUI();
    return;
  }

  const totalRamMb = ramTotalMbOverride > 0 ? ramTotalMbOverride : estimateTotalDeviceRamMb();
  const transitionBudgetMb = Math.max(64, Math.round(totalRamMb * MOBILE_TRANSITION_RAM_BUDGET_RATIO));
  allowedTransitionModes = getAllowedTransitionModesForRam(transitionBudgetMb, {
    crossfadeDurationMs: clampCrossfadeSeconds(crossfadeSlider?.value || localStorage.getItem('dj-mix:crossfade-seconds') || 6) * 1000,
  });

  const disabledModes = MIX_TRANSITION_MODES.filter((mode) => !allowedTransitionModes.includes(mode));
  transitionRamCapability = {
    enabled: true,
    mobile: true,
    totalRamMb,
    transitionBudgetMb,
    ramOverrideMb: ramTotalMbOverride,
    disabledModes,
  };

  updateTransitionModeAvailabilityUI();

  logInfo('transition.ram.capability', {
    mobile,
    totalRamMb,
    transitionBudgetMb,
    disabledModes,
  });

  if (announce && disabledModes.length > 0) {
    showToast(`Transitions limitees (RAM mobile: ${Math.round(totalRamMb / 1024)} Go)`);
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
}

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

function readTrackMaxDurationSetting() {
  try {
    const stored = localStorage.getItem(TRACK_MAX_DURATION_KEY) || '0';
    const value = parseInt(stored, 10);
    return (value >= 30 && value <= 600) ? value : 0;
  } catch (_) {
    return 0;
  }
}

function persistTrackMaxDurationSetting(seconds) {
  try {
    localStorage.setItem(TRACK_MAX_DURATION_KEY, String(seconds));
  } catch (_) {
    // ignore storage failures
  }
}

function readTrackMaxDurationEnabledSetting(fallback = true) {
  try {
    const stored = localStorage.getItem(TRACK_MAX_DURATION_ENABLED_KEY);
    if (stored == null) return Boolean(fallback);
    return stored !== '0';
  } catch (_) {
    return Boolean(fallback);
  }
}

function persistTrackMaxDurationEnabledSetting(enabled) {
  try {
    localStorage.setItem(TRACK_MAX_DURATION_ENABLED_KEY, enabled ? '1' : '0');
  } catch (_) {
    // ignore storage failures
  }
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
  if (autoModeManager.isAutoModeEnabled() && currentIndex >= 0 && queue[currentIndex]) {
    const currentItem = queue[currentIndex];
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
  trackMaxDurationAppliedSec = trackMaxDurationEnabled ? trackMaxDurationSec : 0;
}

function updateTrackMaxDurationUI() {
  if (trackMaxDurationInput) {
    trackMaxDurationInput.value = String(trackMaxDurationSec);
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
const deckARefreshSuggestionBtn = document.getElementById('deck-a-refresh-suggestion');
const deckBRefreshSuggestionBtn = document.getElementById('deck-b-refresh-suggestion');
const deckMixSlider = document.getElementById('deck-mix-slider');
const deckMixLabel = document.getElementById('deck-mix-label');
const deckBCueLabel = document.getElementById('deck-b-cue-label');
const mixTransitionModeSelect = document.getElementById('mix-transition-mode');
const trackMaxDurationInput = document.getElementById('track-max-duration');
const trackMaxDurationMinus = document.getElementById('track-max-duration-minus');
const trackMaxDurationPlus = document.getElementById('track-max-duration-plus');
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
const deckAVocalBtn = document.getElementById('deck-a-vocal-btn');
const deckAInstruBtn = document.getElementById('deck-a-instru-btn');
const deckBVocalBtn = document.getElementById('deck-b-vocal-btn');
const deckBInstruBtn = document.getElementById('deck-b-instru-btn');
const deckAstemsIndicator = document.getElementById('deck-a-stems-indicator');
const deckBstemsIndicator = document.getElementById('deck-b-stems-indicator');
const autoMixBtn = document.getElementById('automix-btn');
const deckAAutoDjMarker = document.getElementById('deck-a-autodj-marker');
const deckBAutoDjMarker = document.getElementById('deck-b-autodj-marker');
const deckAAutoDjStartMarker = document.getElementById('deck-a-autodj-start-marker');
const deckBAutoDjStartMarker = document.getElementById('deck-b-autodj-start-marker');
const deckAMaxDurMarker = document.getElementById('deck-a-maxdur-marker');
const deckBMaxDurMarker = document.getElementById('deck-b-maxdur-marker');
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
const cacheYearFilterEl = document.getElementById('cache-year-filter');
const cacheStemsFilterEl = document.getElementById('cache-stems-filter');
const cacheResetFiltersBtn = document.getElementById('cache-reset-filters');

const downloaderApiUrlInput = document.getElementById('downloader-api-url-input');
const downloaderApiSaveBtn = document.getElementById('downloader-api-save-btn');
const downloaderApiTestBtn = document.getElementById('downloader-api-test-btn');
const downloaderApiStatus = document.getElementById('downloader-api-status');
const debugLogsToggle = document.getElementById('debug-logs-toggle');
const debugLogsStatus = document.getElementById('debug-logs-status');
const ramFilterEnabledToggle = document.getElementById('ram-filter-enabled-toggle');
const ramTotalMemoryInput = document.getElementById('ram-total-memory-gb');
const ramFilterStatus = document.getElementById('ram-filter-status');
const autoDjFxStatus = document.getElementById('auto-dj-fx-status');
const autoDjFxMinIntervalInput = document.getElementById('auto-dj-fx-min-interval-input');
const autoDjFxMaxIntervalInput = document.getElementById('auto-dj-fx-max-interval-input');
const autoDjFxToggleEls = Array.from(document.querySelectorAll('[data-auto-fx-type]'));

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

function syncAutoModeButtonUI(isEnabled) {
  if (!autoModeBtn) return;
  autoModeBtn.setAttribute('aria-pressed', String(isEnabled));
  autoModeBtn.classList.toggle('is-enabled', isEnabled);
  autoModeBtn.textContent = '🤖';
  autoModeBtn.title = `AutoDJ ${isEnabled ? 'actif' : 'inactif'}: recherche et ajoute automatiquement les chansons suivantes`;
  autoModeBtn.setAttribute('aria-label', `AutoDJ ${isEnabled ? 'actif' : 'inactif'}`);
}

const downloaderConfig = createDownloaderConfigManager({
  defaultUrl: DEFAULT_DOWNLOADER_API_URL,
  inputEl: downloaderApiUrlInput,
  saveBtn: downloaderApiSaveBtn,
  statusEl: downloaderApiStatus,
  storageKey: DOWNLOADER_API_URL_KEY,
  testBtn: downloaderApiTestBtn,
});
const DJ_FX_TRANSITION_MODE = Object.freeze({
  filter: 'filter_sweep_low_high',
  lowPass: 'filter_sweep_low_high',
  highPass: 'filter_sweep_low_high',
  reverb: 'reverb_short_simple',
  roll: 'short_loop',
  loop: 'short_loop',
  beatRepeat: 'short_loop',
  brake: 'brake_tape_stop_simple',
  backspin: 'short_reverse',
  noise: 'filter_automation',
  eq: 'eq_transition_simple',
});

const DJ_FX_TOGGLE_FEATURE = Object.freeze({
  echoDelay: 'echo',
  flangerPhaser: 'distortion',
  pitchTempo: 'autoBpm',
});

const DJ_FX_TRANSIENT_ACTIONS = new Set([
  'reverb',
  'roll',
  'loop',
  'beatRepeat',
  'brake',
  'backspin',
  'noise',
  'keyShift',
  'scratching',
  'hotCues',
  'sampling',
]);

function getFocusedDeckForFx() {
  return deckMixRatio > 0.5 ? 'B' : 'A';
}

function getDeckStateForFx(deck) {
  const state = player?._lastDeckState;
  if (!state) return null;
  return deck === 'B' ? state.deckB : state.deckA;
}

function clearDeckLoopFx(deck) {
  const timer = djFxRuntime.loopTimers[deck];
  if (timer) {
    clearInterval(timer);
    djFxRuntime.loopTimers[deck] = null;
  }
}

function setDeckFilterMode(mode, deck = getFocusedDeckForFx()) {
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

function cycleFocusedDeckFilterMode() {
  const deck = getFocusedDeckForFx();
  const currentMode = mixFeatures.deckFx?.[deck]?.filterMode || 'off';
  const nextMode = currentMode === 'off'
    ? 'lowPass'
    : currentMode === 'lowPass'
      ? 'highPass'
      : 'off';
  setDeckFilterMode(nextMode, deck);
  const label = nextMode === 'off' ? 'Filter OFF' : (nextMode === 'lowPass' ? 'Low-pass ON' : 'High-pass ON');
  showToast(label);
}

function applyTemporaryDeckPlaybackRate(deck, targetRate, durationMs = 1600) {
  if (!player) return;
  const safeDeck = deck === 'B' ? 'B' : 'A';
  const safeRate = Math.max(0.55, Math.min(1.45, Number(targetRate) || 1));
  player.setDeckPlaybackRate(safeDeck, safeRate);

  const prevTimer = djFxRuntime.playbackRateTimers[safeDeck];
  if (prevTimer) clearTimeout(prevTimer);
  djFxRuntime.playbackRateTimers[safeDeck] = setTimeout(() => {
    player?.resetDeckPlaybackRate(safeDeck);
    djFxRuntime.playbackRateTimers[safeDeck] = null;
  }, Math.max(120, Number(durationMs) || 1600));
}

function triggerLoopRoll(deck, options = {}) {
  if (!player) return;
  const safeDeck = deck === 'B' ? 'B' : 'A';
  const state = getDeckStateForFx(safeDeck);
  const anchorMs = Number(state?.positionMs) || 0;
  const durationMs = Number(state?.durationMs) || 0;
  if (anchorMs <= 0 || durationMs <= 0) return;

  const windowMs = Math.max(90, Number(options.windowMs) || 220);
  const totalMs = Math.max(180, Number(options.totalMs) || 1300);
  const tickMs = Math.max(55, Number(options.tickMs) || 110);
  const instantSeek = options.instantSeek === true;
  const loopStartMs = Math.max(0, Math.min(durationMs - 5, anchorMs - windowMs));

  clearDeckLoopFx(safeDeck);
  const startedAt = Date.now();
  djFxRuntime.loopTimers[safeDeck] = setInterval(() => {
    if (!player) {
      clearDeckLoopFx(safeDeck);
      return;
    }
    player.seekDeckTo(
      safeDeck,
      loopStartMs,
      instantSeek ? { instant: true } : { fadeMs: 52 },
    ).catch(() => {});
    if (Date.now() - startedAt >= totalMs) {
      clearDeckLoopFx(safeDeck);
    }
  }, tickMs);
}

function triggerBackspinFx(deck) {
  if (!player) return;
  const safeDeck = deck === 'B' ? 'B' : 'A';
  const state = getDeckStateForFx(safeDeck);
  const anchorMs = Number(state?.positionMs) || 0;
  if (anchorMs <= 200) return;

  applyTemporaryDeckPlaybackRate(safeDeck, 1.18, 640);
  for (let i = 0; i < 8; i += 1) {
    const targetMs = Math.max(0, anchorMs - ((i + 1) * 90));
    setTimeout(() => {
      player?.seekDeckTo(safeDeck, targetMs, { instant: true }).catch(() => {});
    }, i * 66);
  }
}

function getOrCreateFxAudioContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;

  if (!djFxRuntime.samplingAudioContext) {
    djFxRuntime.samplingAudioContext = new Ctx();
  }

  const ctx = djFxRuntime.samplingAudioContext;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

function getOrCreateVinylNoiseBuffer(ctx) {
  if (!ctx) return null;
  if (djFxRuntime.vinylNoiseBuffer) return djFxRuntime.vinylNoiseBuffer;

  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = ((Math.random() * 2) - 1) * 0.02;
  }

  djFxRuntime.vinylNoiseBuffer = buffer;
  return buffer;
}

function playVinylNoise(intensity = 1) {
  const ctx = getOrCreateFxAudioContext();
  if (!ctx) return;

  const noiseBuffer = getOrCreateVinylNoiseBuffer(ctx);
  if (!noiseBuffer) return;

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;

  const highPass = ctx.createBiquadFilter();
  highPass.type = 'highpass';
  highPass.frequency.setValueAtTime(1200, ctx.currentTime);

  const gain = ctx.createGain();
  const safeIntensity = Math.max(0.15, Math.min(2, Number(intensity) || 1));
  gain.gain.setValueAtTime(0.05 * safeIntensity, ctx.currentTime);

  noise.connect(highPass);
  highPass.connect(gain);
  gain.connect(ctx.destination);

  noise.start(ctx.currentTime);
  noise.stop(ctx.currentTime + 0.12);
}

function setScratchVelocity(value) {
  const velocity = Number(value) || 0;
  djFxRuntime.scratch.velocity = Math.max(-2, Math.min(2, velocity));
}

function stopScratchEngine(resetPlaybackRate = true) {
  const scratch = djFxRuntime.scratch;
  if (scratch.animationFrameId) {
    cancelAnimationFrame(scratch.animationFrameId);
    scratch.animationFrameId = null;
  }
  scratch.running = false;
  scratch.velocity = 0;
  scratch.currentRate = 0;
  scratch.endAtMs = 0;
  scratch.lastReverseSeekAtMs = 0;

  if (resetPlaybackRate && player) {
    player.resetDeckPlaybackRate(scratch.deck === 'B' ? 'B' : 'A');
  }
}

function runScratchEngineFrame() {
  const scratch = djFxRuntime.scratch;
  if (!scratch.running || !player) {
    scratch.animationFrameId = null;
    return;
  }

  const nowMs = window.performance?.now?.() || Date.now();
  const deck = scratch.deck === 'B' ? 'B' : 'A';
  const targetRate = Math.max(-2, Math.min(2, Number(scratch.velocity) || 0));

  // Keep mobile audio stable by smoothing velocity changes every frame.
  scratch.currentRate = (scratch.currentRate * 0.8) + (targetRate * 0.2);

  if (scratch.currentRate >= -0.03) {
    const forwardRate = 1 + (Math.abs(scratch.currentRate) * 0.32);
    player.setDeckPlaybackRate(deck, Math.max(0.82, Math.min(1.62, forwardRate)));
  } else {
    const pullStrength = Math.abs(scratch.currentRate);
    player.setDeckPlaybackRate(deck, Math.max(0.7, 1 - (pullStrength * 0.2)));

    const cadenceMs = Math.max(48, 92 - (pullStrength * 22));
    if ((nowMs - scratch.lastReverseSeekAtMs) >= cadenceMs) {
      const state = getDeckStateForFx(deck);
      const positionMs = Number(state?.positionMs) || 0;
      const durationMs = Number(state?.durationMs) || 0;
      if (positionMs > 0 && durationMs > 0) {
        const pullMs = Math.max(26, Math.min(140, 28 + (pullStrength * 42)));
        const targetMs = Math.max(0, Math.min(durationMs - 5, positionMs - pullMs));
        player.seekDeckTo(deck, targetMs, { instant: true }).catch(() => {});
      }
      scratch.lastReverseSeekAtMs = nowMs;
    }
  }

  if (nowMs >= scratch.endAtMs && Math.abs(targetRate) < 0.02 && Math.abs(scratch.currentRate) < 0.03) {
    stopScratchEngine(true);
    return;
  }

  scratch.animationFrameId = requestAnimationFrame(runScratchEngineFrame);
}

function ensureScratchEngine(deck, durationMs = 520) {
  const scratch = djFxRuntime.scratch;
  const safeDeck = deck === 'B' ? 'B' : 'A';
  const previousDeck = scratch.deck === 'B' ? 'B' : 'A';
  if (scratch.running && previousDeck !== safeDeck && player) {
    player.resetDeckPlaybackRate(previousDeck);
  }
  scratch.deck = safeDeck;
  scratch.endAtMs = Math.max(scratch.endAtMs, (window.performance?.now?.() || Date.now()) + Math.max(180, Number(durationMs) || 520));
  scratch.running = true;

  const prevRateTimer = djFxRuntime.playbackRateTimers[safeDeck];
  if (prevRateTimer) {
    clearTimeout(prevRateTimer);
    djFxRuntime.playbackRateTimers[safeDeck] = null;
  }

  if (!scratch.animationFrameId) {
    scratch.animationFrameId = requestAnimationFrame(runScratchEngineFrame);
  }
}

function triggerScratchFx(deck) {
  if (!player) return;
  const safeDeck = deck === 'B' ? 'B' : 'A';
  const state = getDeckStateForFx(safeDeck);
  const anchorMs = Number(state?.positionMs) || 0;
  const durationMs = Number(state?.durationMs) || 0;
  if (anchorMs <= 0 || durationMs <= 0) return;

  ensureScratchEngine(safeDeck, 760);
  playVinylNoise(1);

  const velocityPattern = [1.5, -1.35, 1.16, -1.02, 0.88, -0.62, 0.48, -0.3, 0.18, 0.08, 0];
  velocityPattern.forEach((velocity, index) => {
    setTimeout(() => {
      setScratchVelocity(velocity);
    }, index * 68);
  });
}

function triggerHotCueFx(deck) {
  if (!player) return;
  const safeDeck = deck === 'B' ? 'B' : 'A';
  const state = getDeckStateForFx(safeDeck);
  const durationMs = Number(state?.durationMs) || 0;
  if (durationMs <= 0) return;

  const item = deckDisplayItems[safeDeck] || queue[currentIndex] || null;
  const mixData = getTrackMixData(item)
    || (safeDeck === currentPlayingDeck ? autoModeManager.getCurrentTrackMixData?.() : autoModeManager.getNextTrackMixData?.())
    || null;

  const cueCandidatesMs = [];
  const pushCue = (sec) => {
    const ms = Math.round(Number(sec) * 1000);
    if (!Number.isFinite(ms) || ms <= 800 || ms >= (durationMs - 800)) return;
    cueCandidatesMs.push(ms);
  };

  const zoneLists = [mixData?.dropZones, mixData?.peakZones, mixData?.safeTransitionZones];
  for (const zones of zoneLists) {
    if (!Array.isArray(zones)) continue;
    for (const zone of zones) {
      pushCue(zone?.startSec);
      if (cueCandidatesMs.length >= 8) break;
    }
    if (cueCandidatesMs.length >= 8) break;
  }

  if (!cueCandidatesMs.length) {
    cueCandidatesMs.push(
      Math.round(durationMs * 0.2),
      Math.round(durationMs * 0.4),
      Math.round(durationMs * 0.6),
      Math.round(durationMs * 0.8),
    );
  }

  const uniqueCues = [...new Set(cueCandidatesMs)].sort((a, b) => a - b);
  if (!uniqueCues.length) return;

  const currentPositionMs = Math.max(0, Number(state?.positionMs) || 0);
  const nextCueIndex = uniqueCues.findIndex((cueMs) => cueMs > currentPositionMs);
  const targetMs = nextCueIndex >= 0 ? uniqueCues[nextCueIndex] : uniqueCues[0];

  player.seekDeckTo(safeDeck, targetMs, { fadeMs: 34 }).catch(() => {});
}

function triggerSamplingFx() {
  try {
    const ctx = getOrCreateFxAudioContext();
    if (!ctx) {
      showToast('Sampling indisponible: AudioContext non supporte.', true);
      return;
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.18);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1500, now);
    filter.Q.setValueAtTime(3.2, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.36);
  } catch (err) {
    showToast(`Sampling indisponible: ${err?.message || 'erreur audio'}`, true);
  }
}

function triggerBrakeFx(deck) {
  if (!player) return;
  const safeDeck = deck === 'B' ? 'B' : 'A';
  let step = 0;
  const maxSteps = 12;
  const timer = setInterval(() => {
    step += 1;
    const ratio = step / maxSteps;
    const rate = Math.max(0.35, 1 - (ratio * 0.7));
    player?.setDeckPlaybackRate(safeDeck, rate);
    if (step >= maxSteps) {
      clearInterval(timer);
      setTimeout(() => player?.resetDeckPlaybackRate(safeDeck), 120);
    }
  }, 48);
}

function triggerFlangerPhaserFx(deck) {
  if (!player) return;
  const safeDeck = deck === 'B' ? 'B' : 'A';
  const startedAt = Date.now();
  const totalMs = 1500;
  const timer = setInterval(() => {
    const elapsed = Date.now() - startedAt;
    const phase = elapsed / 85;
    const rate = 1 + (Math.sin(phase) * 0.06);
    player?.setDeckPlaybackRate(safeDeck, rate);
    if (elapsed >= totalMs) {
      clearInterval(timer);
      player?.resetDeckPlaybackRate(safeDeck);
    }
  }, 70);
}

function triggerNoiseFx() {
  playVinylNoise(1.35);
  triggerSamplingFx();
}

function triggerTransientDjFxAction(action, durationMs = 900) {
  if (!action) return;

  djFxRuntime.activeTransientActions.add(action);
  const prevTimer = djFxRuntime.transientActionTimers.get(action);
  if (prevTimer) {
    clearTimeout(prevTimer);
  }

  const safeDuration = Math.max(120, Number(durationMs) || 900);
  const timer = setTimeout(() => {
    djFxRuntime.activeTransientActions.delete(action);
    djFxRuntime.transientActionTimers.delete(action);
    updateDjFxMenuUI();
  }, safeDuration);

  djFxRuntime.transientActionTimers.set(action, timer);
  updateDjFxMenuUI();
}

function scheduleAutoDjRestoreTimer(key, durationMs, restoreFn) {
  if (!key || typeof restoreFn !== 'function') return;
  const prevTimer = djFxRuntime.autoDjRestoreTimers.get(key);
  if (prevTimer) clearTimeout(prevTimer);

  const safeDuration = Math.max(120, Number(durationMs) || 900);
  const timer = setTimeout(() => {
    djFxRuntime.autoDjRestoreTimers.delete(key);
    restoreFn();
    updateDjFxMenuUI();
  }, safeDuration);

  djFxRuntime.autoDjRestoreTimers.set(key, timer);
}

function scheduleAutoDjMixFeatureRestore(feature, previousValue, durationMs) {
  const key = `feature:${feature}`;
  const expectedCurrent = !Boolean(previousValue);
  scheduleAutoDjRestoreTimer(key, durationMs, () => {
    if (Boolean(mixFeatures?.[feature]) === expectedCurrent) {
      setMixFeatureEnabled(feature, Boolean(previousValue));
    }
  });
}

function scheduleAutoDjFilterRestore(deck, previousMode, durationMs) {
  const safeDeck = deck === 'B' ? 'B' : 'A';
  const prevMode = previousMode === 'lowPass' || previousMode === 'highPass' ? previousMode : 'off';
  scheduleAutoDjRestoreTimer(`filter:${safeDeck}`, durationMs, () => {
    const currentMode = mixFeatures.deckFx?.[safeDeck]?.filterMode || 'off';
    if (currentMode !== prevMode) {
      setDeckFilterMode(prevMode, safeDeck);
    }
  });
}

function updateDjFxMenuUI() {
  if (!djFxButtons.length) return;
  const focusDeck = getFocusedDeckForFx();
  const focusFilterMode = mixFeatures.deckFx?.[focusDeck]?.filterMode || 'off';
  for (const btn of djFxButtons) {
    const action = String(btn.dataset.fxAction || '');
    const feature = DJ_FX_TOGGLE_FEATURE[action];
    const transitionMode = DJ_FX_TRANSITION_MODE[action];

    let isEnabled = false;
    if (DJ_FX_TRANSIENT_ACTIONS.has(action)) {
      isEnabled = djFxRuntime.activeTransientActions.has(action);
    } else if (action === 'filter') {
      isEnabled = focusFilterMode !== 'off';
    } else if (action === 'lowPass') {
      isEnabled = focusFilterMode === 'lowPass';
    } else if (action === 'highPass') {
      isEnabled = focusFilterMode === 'highPass';
    } else if (feature) {
      isEnabled = Boolean(mixFeatures?.[feature]);
    } else if (transitionMode) {
      isEnabled = selectedTransitionMode === transitionMode;
    }

    btn.classList.toggle('is-enabled', isEnabled);
    btn.setAttribute('aria-pressed', String(isEnabled));
  }
}

function applyDjFxTransition(action, toastLabel, suppressToast = false) {
  const transitionMode = DJ_FX_TRANSITION_MODE[action];
  if (!transitionMode) return;
  applyTransitionModeSetting(transitionMode, { persist: true });
  const label = MIX_TRANSITION_MODE_LABELS[selectedTransitionMode] || selectedTransitionMode;
  if (!suppressToast) showToast(`${toastLabel} -> ${label}`);
}

function toggleDjFxFeature(action, toastLabel, afterEnable, suppressToast = false) {
  const feature = DJ_FX_TOGGLE_FEATURE[action];
  if (!feature) return;
  const nextEnabled = !Boolean(mixFeatures?.[feature]);
  setMixFeatureEnabled(feature, nextEnabled);
  if (nextEnabled) afterEnable?.();
  if (!suppressToast) showToast(`${toastLabel}: ${nextEnabled ? 'ON' : 'OFF'}`);
  updateDjFxMenuUI();
}

function handleDjFxAction(action) {
  const focusDeck = getFocusedDeckForFx();

  switch (action) {
    case 'filter':
      cycleFocusedDeckFilterMode();
      applyDjFxTransition('filter', 'Filter mode AutoMix', true);
      break;
    case 'lowPass':
      setDeckFilterMode(mixFeatures.deckFx?.[focusDeck]?.filterMode === 'lowPass' ? 'off' : 'lowPass', focusDeck);
      applyDjFxTransition('lowPass', 'Low-pass AutoMix', true);
      break;
    case 'highPass':
      setDeckFilterMode(mixFeatures.deckFx?.[focusDeck]?.filterMode === 'highPass' ? 'off' : 'highPass', focusDeck);
      applyDjFxTransition('highPass', 'High-pass AutoMix', true);
      break;
    case 'echoDelay':
      toggleDjFxFeature('echoDelay', 'Echo / Delay', undefined, true);
      break;
    case 'reverb':
      setMixFeatureEnabled('echo', true);
      setMixFeatureEnabled('distortion', true);
      triggerTransientDjFxAction('reverb', 1200);
      setTimeout(() => {
        setMixFeatureEnabled('echo', false);
        setMixFeatureEnabled('distortion', false);
        updateDjFxMenuUI();
      }, 1200);
      break;
    case 'flangerPhaser':
      triggerFlangerPhaserFx(focusDeck);
      toggleDjFxFeature('flangerPhaser', 'Flanger / Phaser', undefined, true);
      break;
    case 'roll':
      triggerLoopRoll(focusDeck, { windowMs: 220, totalMs: 1100, tickMs: 105 });
      triggerTransientDjFxAction('roll', 1000);
      break;
    case 'loop':
      triggerLoopRoll(focusDeck, { windowMs: 520, totalMs: 2400, tickMs: 115 });
      triggerTransientDjFxAction('loop', 2600);
      break;
    case 'beatRepeat':
      triggerLoopRoll(focusDeck, { windowMs: 140, totalMs: 950, tickMs: 90, instantSeek: true });
      triggerTransientDjFxAction('beatRepeat', 900);
      break;
    case 'brake':
      triggerBrakeFx(focusDeck);
      triggerTransientDjFxAction('brake', 900);
      break;
    case 'backspin':
      triggerBackspinFx(focusDeck);
      triggerTransientDjFxAction('backspin', 1200);
      break;
    case 'noise':
      triggerNoiseFx();
      triggerTransientDjFxAction('noise', 800);
      break;
    case 'eq':
      cycleFocusedDeckFilterMode();
      applyDjFxTransition('eq', 'EQ AutoMix', true);
      break;
    case 'pitchTempo':
      applyTemporaryDeckPlaybackRate(focusDeck, 1.06, 2000);
      toggleDjFxFeature('pitchTempo', 'Pitch / Tempo', () => {
        player?.syncDecksToActive();
      }, true);
      break;
    case 'keyShift':
      applyTemporaryDeckPlaybackRate(focusDeck, 1.035, 1800);
      triggerTransientDjFxAction('keyShift', 1800);
      break;
    case 'scratching':
      triggerScratchFx(focusDeck);
      triggerTransientDjFxAction('scratching', 450);
      break;
    case 'hotCues':
      triggerHotCueFx(focusDeck);
      triggerTransientDjFxAction('hotCues', 450);
      break;
    case 'sampling':
      triggerSamplingFx();
      triggerTransientDjFxAction('sampling', 500);
      break;
    default:
      break;
  }
}

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
  cacheFilterCountEl,
  cacheGenreFilterEl,
  cacheResetFiltersBtn,
  cacheStemsFilterEl,
  cacheYearFilterEl,
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
  return activeDeck === 'B' ? 'B' : 'A';
}

function getResolvedInactiveDeck() {
  return getResolvedActiveDeck() === 'A' ? 'B' : 'A';
}

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
    if (deckAVocalBtn) deckAVocalBtn.disabled = !stemsAvailable;
    if (deckAInstruBtn) deckAInstruBtn.disabled = !stemsAvailable;
    if (deckAstemsIndicator) deckAstemsIndicator.hidden = !stemsAvailable;
  } else {
    if (deckBVocalBtn) deckBVocalBtn.disabled = !stemsAvailable;
    if (deckBInstruBtn) deckBInstruBtn.disabled = !stemsAvailable;
    if (deckBstemsIndicator) deckBstemsIndicator.hidden = !stemsAvailable;
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
    });
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

  const probableStartSec = Number(mixData.probableSongStartSec);
  const hasProbableStart = Number.isFinite(probableStartSec) && probableStartSec > 0;
  let recommendedSec = hasProbableStart ? probableStartSec : 0;

  // Honor explicit recommendation fields when present on mix payload.
  const explicitOffsetMs = resolveTrackStartOffsetMs(mixData);
  if (explicitOffsetMs > 0) {
    recommendedSec = Math.max(recommendedSec, explicitOffsetMs / 1000);
  }

  const indicators = mixData.indicators && typeof mixData.indicators === 'object'
    ? mixData.indicators
    : null;

  const toFiniteNumber = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  };

  const introDanceability = toFiniteNumber(
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

  const introLooksWeak = (
    (introDanceability != null && introDanceability <= 0.45)
    || (introEnergy != null && introEnergy <= 0.4)
    || (hasProbableStart && probableStartSec >= 6)
  );

  const peakIsLateEnough = hasPeak
    && firstPeakStartSec >= Math.max(10, (hasProbableStart ? probableStartSec : 0) + 8)
    && (firstPeakScore == null || firstPeakScore >= 0.25);

  // If intro is likely non-danceable, start from first peak to keep momentum.
  if (introLooksWeak && peakIsLateEnough) {
    recommendedSec = Math.max(recommendedSec, firstPeakStartSec);
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

function preloadMixDataForDeckItem(item, deck) {
  if (!item) return;

  const currentDeck = deck === 'B' ? 'B' : 'A';
  return autoModeManager.fetchMixData(item.name, item.artist)
    .then((mixData) => {
      if (!mixData) return;

      storeTrackMixData(item, mixData);
      const startOffsetUpdated = applyMixSuggestedStartOffset(item, mixData);
      if (startOffsetUpdated) {
        updatePlannedStartMarker();
        renderQueue();
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
  getTrackMaxDurationSec: () => trackMaxDurationAppliedSec,
  getAutoFxMinGapMs: () => getSafeAutoDjFxMinIntervalSec(autoDjFxSettings.minIntervalSec) * 1000,
  getAutoFxMaxGapMs: () => {
    const intervals = normalizeAutoDjFxIntervalSettings(
      autoDjFxSettings.minIntervalSec,
      autoDjFxSettings.maxIntervalSec,
    );
    return intervals.maxIntervalSec * 1000;
  },
  onAutomixTimingCalculated: (triggerMs) => {
    nextAutomixTriggerMs = triggerMs;
    automixTriggeredForTrack = false;
    logDebug('autoDj: timing calculated', { triggerMs });
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
  applyRamFilterSettings({ persist: false, announce: true });
  applyDebugLogsSetting(readDebugLogsSetting(), { persist: false });
  applyTransitionModeSetting(selectedTransitionMode, { persist: false });
  
  // Initialize track max duration UI
  updateTrackMaxDurationUI();

  autoModeManager.initialize();
  updateAutoModeUI();
  updateAutoDjFxConfigUI();

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
  const savedCrossfadeVal = localStorage.getItem('dj-mix:crossfade-seconds') || 6;
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

    if (autoModeManager.isAutoModeEnabled()) {
      const dueAutoFxEvents = autoModeManager.consumeReadyAutoFxEvents(position, {
        currentTrackId: queue[currentIndex]?.id || null,
      });
      for (const event of dueAutoFxEvents) {
        triggerAutoDjCreativeFxEvent(event);
      }

      if (autoDjNextFxCountdown) {
        const pending = autoModeManager.getPendingAutoFxEvents();
        const next = pending.find((e) => e.timeMs > position);
        if (next) {
          const secLeft = Math.ceil((next.timeMs - position) / 1000);
          autoDjNextFxCountdown.textContent = `FX ${secLeft}s`;
          autoDjNextFxCountdown.hidden = false;
        } else {
          autoDjNextFxCountdown.hidden = true;
        }
      }
    } else if (autoDjNextFxCountdown) {
      autoDjNextFxCountdown.hidden = true;
    }

    // Auto DJ: Check if it's time to trigger automix
    if (autoModeManager.isAutoModeEnabled() && 
        !automixTriggeredForTrack && 
        nextAutomixTriggerMs > 0 && 
        position >= nextAutomixTriggerMs) {
      
      automixTriggeredForTrack = true;
      updateAutoDjMarker();
      updateMaxDurationMarker();
      logInfo('autoDj: triggering automix at optimal moment', {
        position,
        triggerMs: nextAutomixTriggerMs,
        remainingMs: duration - position,
      });

      // Add pending track (already found during timing calculation) to queue
      autoModeManager.addPendingTrackToQueue()
        .then((added) => {
          if (added) {
            logDebug('autoDj: pending track added, triggering automix', {});
            const nextIdx = currentIndex + 1;
            if (nextIdx < queue.length) {
              autoMixBtn?.click?.();
            }
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
    : getResolvedInactiveDeck();
  const preparedItem = deckDisplayItems[inactiveDeck];
  const preparedIndex = preparedItem ? queue.findIndex((item) => item.id === preparedItem.id) : -1;
  const sequentialNextIndex = currentIndex + 1 < queue.length ? currentIndex + 1 : -1;
  const preferredIndex = hasCue ? deckBCueIndex : sequentialNextIndex;
  const canUsePreparedIndex = preparedIndex >= 0
    && (hasCue ? preparedIndex === deckBCueIndex : preparedIndex === sequentialNextIndex);
  const nextIndex = canUsePreparedIndex
    ? preparedIndex
    : (preferredIndex >= 0 ? preferredIndex : (queue.length > 1 ? 0 : -1));
  if (nextIndex < 0) return;

  logInfo('automix.click', {
    currentIndex,
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
  const inactiveDeck = getResolvedInactiveDeck();
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
      await preloadMixDataForDeckItem(item, targetDeck);
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
      deckDisplayItems[targetDeck] = item;
      updatePlannedStartMarker();
    
      if (isFocusDeck) {
        currentIndex = targetIndex;
        currentTrackId = item.id;
        updateNowPlaying(item, targetDeck);
        isPlaying = true;
        launchPreviewTitle = '';
        launchPreviewArtist = '';
        launchPreviewDeck = null;
        prefetchNext(getFollowingQueueIndex(targetIndex));
      } else {
        launchPreviewActive = true;
        launchPreviewArtUrl = item.artUrl || '';
        launchPreviewTitle = item.name || '';
        launchPreviewArtist = item.artist || '';
        launchPreviewDeck = targetDeck;
        deckCueDeck = targetDeck;
        updateUpcomingArtwork();
      }
      renderQueue();
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
  applyRamFilterSettings({ persist: false, announce: false });
  
  // Persist crossfade setting to localStorage
  localStorage.setItem('dj-mix:crossfade-seconds', String(safeSeconds));

  if (player) {
    player.crossfadeDuration = safeSeconds * 1000;
    player.setAllowedTransitionModes(allowedTransitionModes);
  }
}

// Initialize crossfade slider from localStorage
const savedCrossfade = localStorage.getItem('dj-mix:crossfade-seconds');
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
  persistAutoDjFxSettings();
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
  persistAutoDjFxSettings();
  updateAutoDjFxConfigUI();
  recalculateAutomixTimingIfNeeded('autoDjFx: max interval changed');
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
    persistAutoDjFxSettings();
    updateAutoDjFxConfigUI();
  });
}

trackMaxDurationInput?.addEventListener('change', () => {
  applyTrackMaxDurationSetting(trackMaxDurationInput.value, 'trackMaxDuration: setting changed');
});

trackMaxDurationToggle?.addEventListener('click', () => {
  trackMaxDurationEnabled = !trackMaxDurationEnabled;

  if (trackMaxDurationEnabled && trackMaxDurationSec <= 0) {
    trackMaxDurationSec = lastTrackMaxDurationSec;
    persistTrackMaxDurationSetting(trackMaxDurationSec);
  }

  persistTrackMaxDurationEnabledSetting(trackMaxDurationEnabled);
  applyTrackMaxDurationForCurrentPlayback();
  updateTrackMaxDurationUI();
  showToast(trackMaxDurationEnabled ? `Durée max: ON (${trackMaxDurationSec}s)` : 'Durée max: OFF');
  logDebug('trackMaxDuration: toggled', {
    enabled: trackMaxDurationEnabled,
    value: trackMaxDurationSec,
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
  updateDjFxMenuUI();
});

distortionBtn?.addEventListener('click', () => {
  setMixFeatureEnabled('distortion', !mixFeatures.distortion);
  updateDjFxMenuUI();
});

djFxMenu?.addEventListener('click', (event) => {
  const button = event.target?.closest?.('[data-fx-action]');
  if (!button) return;
  const action = String(button.dataset.fxAction || '');
  if (!action) return;
  handleDjFxAction(action);
});

autoModeBtn?.addEventListener('click', () => {
  const isEnabled = autoModeManager.toggleAutoMode();
  syncAutoModeButtonUI(isEnabled);

  if (isEnabled && currentIndex >= 0 && queue[currentIndex]) {
    const currentItem = queue[currentIndex];
    autoModeManager.scheduleAutomixTiming(currentItem);
    autoModeManager.searchAndAddNextTrack(currentItem).catch((err) => {
      logWarn('autoDj: immediate search on enable failed', { error: err?.message });
    });
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

  if (!type) {
    logDebug('autoDj: creative fx skipped (no type)', { type, label });
    return;
  }

  if (!isAutoDjFxTypeAllowed(type)) {
    logDebug('autoDj: creative fx skipped (not allowed)', { type, label });
    return;
  }

  const now = Date.now();
  const minGapMs = getSafeAutoDjFxMinIntervalSec(autoDjFxSettings.minIntervalSec) * 1000;
  const elapsedMs = now - lastAutoDjFxTriggeredAt;
  if (lastAutoDjFxTriggeredAt > 0 && elapsedMs < minGapMs) {
    logDebug('autoDj: creative fx skipped (min interval)', {
      type,
      label,
      elapsedMs,
      requiredMs: minGapMs,
    });
    return;
  }

  const targetDeck = currentPlayingDeck === 'B' ? 'B' : 'A';
  const applied = applyAutoDjCreativeFx(type, targetDeck);
  if (!applied) {
    logDebug('autoDj: creative fx skipped (unsupported type)', { type, label });
    return;
  }

  lastAutoDjFxTriggeredAt = now;
  const suffix = reason ? ` (${reason})` : '';
  showToast(`🤖 Auto FX: ${label}${suffix}`);
}

function applyAutoDjCreativeFx(type, targetDeck) {
  const safeDeck = targetDeck === 'B' ? 'B' : 'A';
  switch (type) {
    case 'filter':
      {
        const prevMode = mixFeatures.deckFx?.[safeDeck]?.filterMode || 'off';
        setDeckFilterMode('lowPass', safeDeck);
        scheduleAutoDjFilterRestore(safeDeck, prevMode, 1800);
      }
      return true;
    case 'lowPass':
      {
        const prevMode = mixFeatures.deckFx?.[safeDeck]?.filterMode || 'off';
        setDeckFilterMode('lowPass', safeDeck);
        scheduleAutoDjFilterRestore(safeDeck, prevMode, 1800);
      }
      return true;
    case 'highPass':
      {
        const prevMode = mixFeatures.deckFx?.[safeDeck]?.filterMode || 'off';
        setDeckFilterMode('highPass', safeDeck);
        scheduleAutoDjFilterRestore(safeDeck, prevMode, 1800);
      }
      return true;
    case 'echoDelay':
      {
        const prevEcho = Boolean(mixFeatures.echo);
        setMixFeatureEnabled('echo', true);
        scheduleAutoDjMixFeatureRestore('echo', prevEcho, 1200);
      }
      triggerTransientDjFxAction('echoDelay', 1200);
      return true;
    case 'reverb':
      {
        const prevEcho = Boolean(mixFeatures.echo);
        const prevDistortion = Boolean(mixFeatures.distortion);
        setMixFeatureEnabled('echo', true);
        setMixFeatureEnabled('distortion', true);
        scheduleAutoDjMixFeatureRestore('echo', prevEcho, 1200);
        scheduleAutoDjMixFeatureRestore('distortion', prevDistortion, 1200);
      }
      triggerTransientDjFxAction('reverb', 1200);
      return true;
    case 'flangerPhaser':
      {
        const prevDistortion = Boolean(mixFeatures.distortion);
        setMixFeatureEnabled('distortion', true);
        scheduleAutoDjMixFeatureRestore('distortion', prevDistortion, 1600);
      }
      triggerFlangerPhaserFx(safeDeck);
      triggerTransientDjFxAction('flangerPhaser', 1600);
      return true;
    case 'roll':
      triggerLoopRoll(safeDeck, { windowMs: 220, totalMs: 1100, tickMs: 105 });
      triggerTransientDjFxAction('roll', 1000);
      return true;
    case 'loop':
      triggerLoopRoll(safeDeck, { windowMs: 520, totalMs: 2400, tickMs: 115 });
      triggerTransientDjFxAction('loop', 2600);
      return true;
    case 'beatRepeat':
      triggerLoopRoll(safeDeck, { windowMs: 140, totalMs: 950, tickMs: 90, instantSeek: true });
      triggerTransientDjFxAction('beatRepeat', 900);
      return true;
    case 'brake':
      triggerBrakeFx(safeDeck);
      triggerTransientDjFxAction('brake', 900);
      return true;
    case 'backspin':
      triggerBackspinFx(safeDeck);
      triggerTransientDjFxAction('backspin', 1200);
      return true;
    case 'noise':
      triggerNoiseFx();
      triggerTransientDjFxAction('noise', 800);
      return true;
    case 'eq':
      {
        const prevMode = mixFeatures.deckFx?.[safeDeck]?.filterMode || 'off';
        setDeckFilterMode('highPass', safeDeck);
        scheduleAutoDjFilterRestore(safeDeck, prevMode, 1800);
      }
      return true;
    case 'pitchTempo':
      {
        const prevAutoBpm = Boolean(mixFeatures.autoBpm);
        applyTemporaryDeckPlaybackRate(safeDeck, 1.06, 2000);
        setMixFeatureEnabled('autoBpm', true);
        scheduleAutoDjMixFeatureRestore('autoBpm', prevAutoBpm, 2000);
      }
      triggerTransientDjFxAction('pitchTempo', 2000);
      return true;
    case 'keyShift':
      applyTemporaryDeckPlaybackRate(safeDeck, 1.035, 1800);
      triggerTransientDjFxAction('keyShift', 1800);
      return true;
    case 'scratching':
      triggerScratchFx(safeDeck);
      triggerTransientDjFxAction('scratching', 450);
      return true;
    case 'hotCues':
      triggerHotCueFx(safeDeck);
      triggerTransientDjFxAction('hotCues', 450);
      return true;
    case 'sampling':
      triggerSamplingFx();
      triggerTransientDjFxAction('sampling', 500);
      return true;
    default:
      return false;
  }
}

function updateSuggestionRefreshButtons() {
  const isEnabled = autoModeManager.isAutoModeEnabled();
  const hasCurrent = isPlaying && currentIndex >= 0 && Boolean(queue[currentIndex]);
  const activeDeck = getResolvedActiveDeck();
  const shouldShow = isEnabled && hasCurrent;

  const applyState = (button, deck) => {
    if (!button) return;
    const visible = shouldShow && deck === activeDeck;
    button.hidden = !visible;
    button.disabled = !visible || autoSuggestionRefreshInProgress;
  };

  applyState(deckARefreshSuggestionBtn, 'A');
  applyState(deckBRefreshSuggestionBtn, 'B');
}

function findAutoSuggestedTrackIndexAfterCurrent(currentTrack) {
  const referenceId = currentTrack?.id || null;
  for (let i = Math.max(0, currentIndex + 1); i < queue.length; i += 1) {
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
  if (!autoModeManager.isAutoModeEnabled()) {
    showToast('Activez Auto Mode pour changer la suggestion', true);
    return;
  }

  const currentItem = queue[currentIndex];
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
      if (idx >= 0 && idx !== currentIndex) {
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

deckARefreshSuggestionBtn?.addEventListener('click', () => {
  refreshAutoSuggestionForCurrentTrack().catch(() => {});
});

deckBRefreshSuggestionBtn?.addEventListener('click', () => {
  refreshAutoSuggestionForCurrentTrack().catch(() => {});
});

function updateAutoDjMarker() {
  const isEnabled = autoModeManager.isAutoModeEnabled();
  const durationMs = playbackDurationMs > 0 ? playbackDurationMs : (queue[currentIndex]?.duration ?? 0);
  const hasTiming = nextAutomixTriggerMs > 0 && durationMs > 0 && !automixTriggeredForTrack;

  // Hide both markers first
  if (deckAAutoDjMarker) deckAAutoDjMarker.hidden = true;
  if (deckBAutoDjMarker) deckBAutoDjMarker.hidden = true;

  if (!isEnabled || !hasTiming) return;

  const pct = Math.min(100, Math.max(0, (nextAutomixTriggerMs / durationMs) * 100));
  const marker = currentPlayingDeck === 'B' ? deckBAutoDjMarker : deckAAutoDjMarker;
  if (marker) {
    marker.style.left = `${pct}%`;
    marker.hidden = false;
  }
}

function updatePlannedStartMarker() {
  if (deckAAutoDjStartMarker) deckAAutoDjStartMarker.hidden = true;
  if (deckBAutoDjStartMarker) deckBAutoDjStartMarker.hidden = true;

  const inactiveDeck = getResolvedInactiveDeck();
  const item = deckDisplayItems[inactiveDeck];
  if (!item) return;

  const durationMs = Number(item.duration) || (queue.find((q) => q.id === item.id)?.duration ?? 0);
  const startPositionMs = Math.max(0, Number(item.autoDjStartOffsetMs) || 0);
  if (!durationMs || startPositionMs <= 0 || startPositionMs >= durationMs) return;

  const pct = Math.min(100, Math.max(0, (startPositionMs / durationMs) * 100));
  const marker = inactiveDeck === 'B' ? deckBAutoDjStartMarker : deckAAutoDjStartMarker;
  if (marker) {
    marker.style.left = `${pct}%`;
    marker.title = `Démarrage AutoDJ prévu à ${Math.round(startPositionMs / 1000)}s`;
    marker.hidden = false;
  }
}

function updateMaxDurationMarker() {
  if (deckAMaxDurMarker) deckAMaxDurMarker.hidden = true;
  if (deckBMaxDurMarker) deckBMaxDurMarker.hidden = true;

  const effectiveMaxDurationSec = trackMaxDurationEnabled
    ? (isPlaying ? trackMaxDurationAppliedSec : trackMaxDurationSec)
    : 0;
  if (effectiveMaxDurationSec <= 0) return;

  const durationMs = playbackDurationMs > 0 ? playbackDurationMs : (queue[currentIndex]?.duration ?? 0);
  if (durationMs <= 0) return;

  const maxMs = effectiveMaxDurationSec * 1000;
  if (maxMs >= durationMs) return;

  let markerMs = maxMs;
  const currentItem = queue[currentIndex];
  const fallbackMixData = autoModeManager.getCurrentTrackMixData?.();
  const mixData = getTrackMixData(currentItem) || fallbackMixData || null;

  if (mixData && typeof autoModeManager.findBestTransitionZone === 'function') {
    const preferredZone = autoModeManager.findBestTransitionZone(mixData, {
      targetSec: effectiveMaxDurationSec,
    });

    const zoneEndSec = Number.isFinite(preferredZone?.zone?.endSec)
      ? preferredZone.zone.endSec
      : Number(preferredZone?.triggerSec);

    if (Number.isFinite(zoneEndSec) && zoneEndSec > 0) {
      markerMs = Math.min(durationMs, zoneEndSec * 1000);
    }
  }

  const pct = Math.min(100, (markerMs / durationMs) * 100);
  const marker = currentPlayingDeck === 'B' ? deckBMaxDurMarker : deckAMaxDurMarker;
  if (marker) {
    marker.style.left = `${pct}%`;
    marker.hidden = false;
  }
}

const MIX_ZONE_CONFIG = {
  peakZones: { label: 'Peak', className: 'zone-peak' },
  safeTransitionZones: { label: 'Zone sûre', className: 'zone-safe' },
  avoidTransitionZones: { label: 'À éviter', className: 'zone-avoid' },
  dropZones: { label: 'Drop', className: 'zone-drop' },
  breakdownZones: { label: 'Breakdown', className: 'zone-breakdown' },
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
        zoneEl.title = `${config.label} ${formatZoneTime(startSec)} → ${formatZoneTime(endSec)}${zone?.reason ? ` · ${zone.reason}` : ''}${Number.isFinite(Number(zone?.score)) ? ` · score ${Number(zone.score).toFixed(3)}` : ''}`;
        zoneEl.dataset.zoneType = zoneType;
        if (zone?.reason) zoneEl.dataset.reason = zone.reason;
        if (Number.isFinite(Number(zone?.score))) zoneEl.dataset.score = String(zone.score);

        layer.appendChild(zoneEl);
      }
    }
  };

  const playbackDuration = playbackDurationMs > 0 ? playbackDurationMs : (queue[currentIndex]?.duration ?? 0);
  const mixDataA = getTrackMixData(deckDisplayItems.A)
    || (currentPlayingDeck === 'A' ? autoModeManager.getCurrentTrackMixData?.() : null)
    || (currentPlayingDeck !== 'A' ? autoModeManager.getNextTrackMixData?.() : null);
  const mixDataB = getTrackMixData(deckDisplayItems.B)
    || (currentPlayingDeck === 'B' ? autoModeManager.getCurrentTrackMixData?.() : null)
    || (currentPlayingDeck !== 'B' ? autoModeManager.getNextTrackMixData?.() : null);

  renderLayer(deckAZoneLayer, mixDataA, deckDisplayItems.A?.duration || playbackDuration);
  renderLayer(deckBZoneLayer, mixDataB, deckDisplayItems.B?.duration || playbackDuration);
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

  const inactiveDeck = getResolvedInactiveDeck();
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
  const suggestedStartOffsetMs = resolveTrackStartOffsetMs(track);
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

    const cachedMixData = getTrackMixData(item);
    if (cachedMixData) {
      applyMixSuggestedStartOffset(item, cachedMixData);
      startPositionMs = Math.max(0, Number(item.autoDjStartOffsetMs) || 0);
    }

    const mixPreloadPromise = preloadMixDataForDeckItem(item, targetDeck);
    if (startPositionMs <= 0) {
      await Promise.race([
        mixPreloadPromise,
        new Promise((resolve) => setTimeout(resolve, 700)),
      ]);
      startPositionMs = Math.max(0, Number(item.autoDjStartOffsetMs) || 0);
    }

    updatePlannedStartMarker();
    
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
      }, { makeActive: false, paused: false, startPositionMs });
    } else {
      await player.playOnDeck(getResolvedActiveDeck(), {
        url: sourceUrl,
        loudnessDb: item.loudnessDb,
        bpm: item.bpm,
        durationMs: item.duration,
        audioFeatures: item.audioFeatures,
        stems: item.stems,
      }, { makeActive: false, paused: false, startPositionMs });
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
        ensureLocalSource(nextItem).then(async (nextUrl) => {
          if (!player) return;

          await preloadMixDataForDeckItem(nextItem, inactiveDeck);
          const nextStartPositionMs = Math.max(0, Number(nextItem.autoDjStartOffsetMs) || 0);
          
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
          }, {
            paused: true,
            startPositionMs: nextStartPositionMs,
          });
          deckDisplayItems[inactiveDeck] = nextItem;
          updatePlannedStartMarker();
          
          // Always fetch stems from server for the next track
          backgroundEnrichStems(inactiveDeck, nextItem);
          
          renderQueue();
        }).catch(() => {});
      }
    }

    isPlaying = true;
  prefetchNext(getFollowingQueueIndex(index, { wrap: false }));
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
    currentPlayingDeck = targetDeck;
    applyTrackMaxDurationForCurrentPlayback();
    updateAutoDjMarker();
    updateMaxDurationMarker();
    autoModeManager.scheduleAutomixTiming(item);
    autoModeManager.searchAndAddNextTrack(item).catch((err) => {
      logWarn('autoDj: search on track start failed', { error: err?.message });
    });
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
    updateSuggestionRefreshButtons();
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

  updateSuggestionRefreshButtons();
}

function removeFromQueue(idx) {
  const item = queue[idx];
  if (item?.id === currentTrackId) return;
  const [removed] = queue.splice(idx, 1);
  releaseLocalBlob(removed);

  if (deckDisplayItems.A?.id === removed?.id) deckDisplayItems.A = null;
  if (deckDisplayItems.B?.id === removed?.id) deckDisplayItems.B = null;

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

function getFollowingQueueIndex(index, options = {}) {
  if (queue.length <= 1) return -1;

  const { wrap = true } = options;
  const numeric = Number(index);
  if (!Number.isFinite(numeric)) return -1;

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
updateDjFxMenuUI();
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
      A: { vocalRemove: false, instruRemove: false, filterMode: 'off' },
      B: { vocalRemove: false, instruRemove: false, filterMode: 'off' },
    },
  };

  autoModeManager.reset();

  player?.destroy();
  player = null;

  for (const timer of djFxRuntime.transientActionTimers.values()) {
    clearTimeout(timer);
  }
  djFxRuntime.transientActionTimers.clear();
  for (const timer of djFxRuntime.autoDjRestoreTimers.values()) {
    clearTimeout(timer);
  }
  djFxRuntime.autoDjRestoreTimers.clear();
  djFxRuntime.activeTransientActions.clear();

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
  lastAutoDjFxTriggeredAt = 0;
  updateAutoDjMarker();
  updateMaxDurationMarker();

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
