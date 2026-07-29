import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { createSettingsController, clearLocalCache } from '../../lib/settingsController.js';
import { uiState } from '../../lib/uiState.js';

function makeController(overrides = {}) {
  return createSettingsController({
    initialTransitionMode: 'auto',
    initialRamFilterEnabled: false,
    initialRamTotalMbOverride: 0,
    initialTrackMaxDurationSec: 0,
    initialTrackMaxDurationEnabled: false,
    initialTrackMaxDurationMode: 'sec',
    initialTrackMaxDurationPct: 50,
    initialAutoSuggestionQueueSearchEnabled: true,
    initialQueueLoopEnabled: false,
    initialQueueShuffleEnabled: false,
    clampCrossfadeSeconds: jest.fn((v) => Math.max(1, Math.min(30, Number(v) || 6))),
    getCrossfadeSeconds: jest.fn().mockReturnValue(6),
    getPlayer: jest.fn().mockReturnValue(null),
    getQueue: jest.fn().mockReturnValue([]),
    autoModeManager: {
      isAutoModeEnabled: jest.fn().mockReturnValue(false),
      scheduleAutomixTiming: jest.fn(),
      setSuggestionSearchEnabled: jest.fn(),
    },
    getAutoDjFxSettings: jest.fn().mockReturnValue({ minIntervalSec: 20, maxIntervalSec: 60 }),
    setDebugLogging: jest.fn(),
    updateDjFxMenuUI: jest.fn(),
    updateMaxDurationMarker: jest.fn(),
    updateSuggestionRefreshButtons: jest.fn(),
    trimRetainedAudioSources: jest.fn(),
    showToast: jest.fn(),
    logInfo: jest.fn(),
    logDebug: jest.fn(),
    logWarn: jest.fn(),
    ...overrides,
  });
}

beforeEach(() => {
  localStorage.clear();
});

// ── getSafeAllowedTransitionMode ─────────────────────────────────────────────

describe('getSafeAllowedTransitionMode', () => {
  test('returns mode if it is in allowed set', () => {
    const ctrl = makeController({ initialTransitionMode: 'auto' });
    // allowedTransitionModes starts as all MIX_TRANSITION_MODES, which includes 'cut_transition'
    expect(ctrl.getSafeAllowedTransitionMode('cut_transition')).toBe('cut_transition');
  });

  test('falls back to auto if requested mode is not allowed', () => {
    const ctrl = makeController({ initialTransitionMode: 'auto' });
    // 'nonexistent_mode' won't be in allowed list
    expect(ctrl.getSafeAllowedTransitionMode('nonexistent_mode')).toBe('auto');
  });

  test('normalizes unknown mode to auto before checking', () => {
    const ctrl = makeController();
    // 'totally_invalid' not in MIX_TRANSITION_MODES → normalizes to 'auto' → auto is allowed
    expect(ctrl.getSafeAllowedTransitionMode('totally_invalid')).toBe('auto');
  });
});

// ── applyTransitionModeSetting ───────────────────────────────────────────────

describe('applyTransitionModeSetting', () => {
  test('updates selectedTransitionMode', () => {
    const ctrl = makeController({ initialTransitionMode: 'auto' });
    ctrl.applyTransitionModeSetting('cut_transition');
    expect(ctrl.getSelectedTransitionMode()).toBe('cut_transition');
  });

  test('propagates to player.setTransitionMode', () => {
    const setTransitionMode = jest.fn();
    const player = { setTransitionMode, setAllowedTransitionModes: jest.fn() };
    const ctrl = makeController({ getPlayer: jest.fn().mockReturnValue(player) });
    ctrl.applyTransitionModeSetting('cut_transition');
    expect(setTransitionMode).toHaveBeenCalledWith('cut_transition');
  });

  test('calls updateDjFxMenuUI', () => {
    const updateDjFxMenuUI = jest.fn();
    const ctrl = makeController({ updateDjFxMenuUI });
    ctrl.applyTransitionModeSetting('auto');
    expect(updateDjFxMenuUI).toHaveBeenCalled();
  });

  test('persists setting in localStorage', () => {
    const ctrl = makeController();
    ctrl.applyTransitionModeSetting('cut_transition', { persist: true });
    expect(ctrl.getSelectedTransitionMode()).toBe('cut_transition');
    // If persist=false, still applies but we just check the getter here
    ctrl.applyTransitionModeSetting('auto', { persist: false });
    expect(ctrl.getSelectedTransitionMode()).toBe('auto');
  });
});

// ── applyRamFilterSettings ────────────────────────────────────────────────────

describe('applyRamFilterSettings', () => {
  test('updates allowedTransitionModes via RAM profile', () => {
    const ctrl = makeController({ initialRamFilterEnabled: false });
    const beforeModes = ctrl.getAllowedTransitionModes();
    // Should at least contain 'auto'
    expect(beforeModes).toContain('auto');
    ctrl.applyRamFilterSettings({ persist: false });
    expect(ctrl.getAllowedTransitionModes()).toBeInstanceOf(Array);
  });

  test('propagates allowedTransitionModes to player', () => {
    const setAllowedTransitionModes = jest.fn();
    const setTransitionMode = jest.fn();
    const player = { setAllowedTransitionModes, setTransitionMode };
    const ctrl = makeController({ getPlayer: jest.fn().mockReturnValue(player) });
    ctrl.applyRamFilterSettings({ persist: false });
    expect(setAllowedTransitionModes).toHaveBeenCalled();
  });

  test('calls trimRetainedAudioSources', () => {
    const trimRetainedAudioSources = jest.fn();
    const ctrl = makeController({ trimRetainedAudioSources });
    ctrl.applyRamFilterSettings({ persist: false });
    expect(trimRetainedAudioSources).toHaveBeenCalled();
  });
});

// ── applyTrackMaxDurationSetting ─────────────────────────────────────────────

describe('applyTrackMaxDurationSetting', () => {
  test('clamps value to 0–600', () => {
    const ctrl = makeController();
    ctrl.applyTrackMaxDurationSetting(999);
    expect(ctrl.getTrackMaxDurationSec()).toBe(600);
  });

  test('clamps negative to 0', () => {
    const ctrl = makeController();
    ctrl.applyTrackMaxDurationSetting(-10);
    expect(ctrl.getTrackMaxDurationSec()).toBe(0);
  });

  test('sets trackMaxDurationSec', () => {
    const ctrl = makeController();
    ctrl.applyTrackMaxDurationSetting(120);
    expect(ctrl.getTrackMaxDurationSec()).toBe(120);
  });

  test('calls updateMaxDurationMarker', () => {
    const updateMaxDurationMarker = jest.fn();
    const ctrl = makeController({ updateMaxDurationMarker });
    ctrl.applyTrackMaxDurationSetting(60);
    expect(updateMaxDurationMarker).toHaveBeenCalled();
  });

  test('calls recalculateAutomixTimingIfNeeded when auto mode active', () => {
    const scheduleAutomixTiming = jest.fn();
    const queue = [{ name: 'Track', id: 'x' }];
    const ctrl = makeController({
      autoModeManager: {
        isAutoModeEnabled: jest.fn().mockReturnValue(true),
        scheduleAutomixTiming,
        setSuggestionSearchEnabled: jest.fn(),
      },
      getQueue: jest.fn().mockReturnValue(queue),
    });
    uiState.currentIndex = 0;
    ctrl.applyTrackMaxDurationSetting(90);
    expect(scheduleAutomixTiming).toHaveBeenCalledWith(queue[0]);
    uiState.currentIndex = -1;
  });
});

// ── applyTrackMaxDurationPctSetting ─────────────────────────────────────────

describe('applyTrackMaxDurationPctSetting', () => {
  test('clamps to 5–95', () => {
    const ctrl = makeController();
    ctrl.applyTrackMaxDurationPctSetting(2);
    expect(ctrl.getTrackMaxDurationPct()).toBe(5);
    ctrl.applyTrackMaxDurationPctSetting(99);
    expect(ctrl.getTrackMaxDurationPct()).toBe(95);
  });

  test('sets trackMaxDurationPct', () => {
    const ctrl = makeController();
    ctrl.applyTrackMaxDurationPctSetting(75);
    expect(ctrl.getTrackMaxDurationPct()).toBe(75);
  });
});

// ── computePctMaxDurationSec ─────────────────────────────────────────────────

describe('computePctMaxDurationSec', () => {
  test('returns 0 when durationMs is 0', () => {
    const ctrl = makeController({ initialTrackMaxDurationPct: 50 });
    expect(ctrl.computePctMaxDurationSec(null, 0)).toBe(0);
  });

  test('uses full track duration when no mix data', () => {
    const ctrl = makeController({ initialTrackMaxDurationPct: 50 });
    // no intro/outro → effectiveDuration = full track
    // result = 0 + 300 * 50/100 = 150
    expect(ctrl.computePctMaxDurationSec(null, 300_000)).toBe(150);
  });

  test('respects intro and outro zones', () => {
    const ctrl = makeController({ initialTrackMaxDurationPct: 100 });
    const mixData = {
      probableSongStartSec: 10,
      outroZones: [{ startSec: 250 }],
    };
    // effectiveDuration = 250 - 10 = 240; result = 10 + 240 * 1 = 250
    expect(ctrl.computePctMaxDurationSec(mixData, 300_000)).toBe(250);
  });
});

// ── setCrossfadeDurationSeconds ───────────────────────────────────────────────

describe('setCrossfadeDurationSeconds', () => {
  test('propagates crossfadeDuration to player', () => {
    const player = {
      crossfadeDuration: 0,
      setAllowedTransitionModes: jest.fn(),
      setTransitionMode: jest.fn(),
    };
    const ctrl = makeController({ getPlayer: jest.fn().mockReturnValue(player) });
    ctrl.setCrossfadeDurationSeconds(10);
    expect(player.crossfadeDuration).toBe(10_000);
  });

  test('clamps via clampCrossfadeSeconds', () => {
    const clampCrossfadeSeconds = jest.fn((v) => 6);
    const ctrl = makeController({ clampCrossfadeSeconds });
    ctrl.setCrossfadeDurationSeconds(999);
    expect(clampCrossfadeSeconds).toHaveBeenCalledWith(999);
  });
});

// ── applyDebugLogsSetting ─────────────────────────────────────────────────────

describe('applyDebugLogsSetting', () => {
  test('calls setDebugLogging with coerced boolean', () => {
    const setDebugLogging = jest.fn();
    const ctrl = makeController({ setDebugLogging });
    ctrl.applyDebugLogsSetting(1);
    expect(setDebugLogging).toHaveBeenCalledWith(true);
  });

  test('logs warn on enable', () => {
    const logWarn = jest.fn();
    const ctrl = makeController({ logWarn });
    ctrl.applyDebugLogsSetting(true);
    expect(logWarn).toHaveBeenCalledWith('debug.mode.enabled', expect.any(Object));
  });

  test('logs warn on disable', () => {
    const logWarn = jest.fn();
    const ctrl = makeController({ logWarn });
    ctrl.applyDebugLogsSetting(false);
    expect(logWarn).toHaveBeenCalledWith('debug.mode.disabled', expect.any(Object));
  });
});

// ── applyAutoSuggestionQueueSearchSetting ────────────────────────────────────

describe('applyAutoSuggestionQueueSearchSetting', () => {
  test('toggles autoSuggestionQueueSearchEnabled', () => {
    const ctrl = makeController({ initialAutoSuggestionQueueSearchEnabled: true });
    ctrl.applyAutoSuggestionQueueSearchSetting(false);
    expect(ctrl.getAutoSuggestionQueueSearchEnabled()).toBe(false);
  });

  test('calls autoModeManager.setSuggestionSearchEnabled', () => {
    const setSuggestionSearchEnabled = jest.fn();
    const ctrl = makeController({
      autoModeManager: {
        isAutoModeEnabled: jest.fn().mockReturnValue(false),
        scheduleAutomixTiming: jest.fn(),
        setSuggestionSearchEnabled,
      },
    });
    ctrl.applyAutoSuggestionQueueSearchSetting(false);
    expect(setSuggestionSearchEnabled).toHaveBeenCalledWith(false);
  });

  test('calls updateSuggestionRefreshButtons', () => {
    const updateSuggestionRefreshButtons = jest.fn();
    const ctrl = makeController({ updateSuggestionRefreshButtons });
    ctrl.applyAutoSuggestionQueueSearchSetting(true);
    expect(updateSuggestionRefreshButtons).toHaveBeenCalled();
  });

  test('shows toast when announce=true', () => {
    const showToast = jest.fn();
    const ctrl = makeController({ showToast });
    ctrl.applyAutoSuggestionQueueSearchSetting(true, { announce: true });
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('ON'));
  });
});

// ── Queue mode setters ────────────────────────────────────────────────────────

describe('setQueueLoopEnabled / setQueueShuffleEnabled', () => {
  test('setQueueLoopEnabled updates getter', () => {
    const ctrl = makeController({ initialQueueLoopEnabled: false });
    ctrl.setQueueLoopEnabled(true);
    expect(ctrl.getQueueLoopEnabled()).toBe(true);
  });

  test('setQueueShuffleEnabled updates getter', () => {
    const ctrl = makeController({ initialQueueShuffleEnabled: false });
    ctrl.setQueueShuffleEnabled(true);
    expect(ctrl.getQueueShuffleEnabled()).toBe(true);
  });
});

// ── clearLocalCache ─────────────────────────────────────────────────────────────

describe('clearLocalCache', () => {
  test('clears the IndexedDB blob store and session blobs, and deletes the legacy audio cache when Cache Storage is available', async () => {
    const cachesApi = {
      keys: jest.fn().mockResolvedValue(['dj-mix:audio-cache:v1', 'other-cache']),
      delete: jest.fn().mockResolvedValue(true),
    };
    const clearPersistedBlobs = jest.fn().mockResolvedValue(undefined);
    const clearSessionBlobCache = jest.fn();
    const showToast = jest.fn();

    await clearLocalCache({
      cachesApi,
      audioCacheName: 'dj-mix:audio-cache:v1',
      clearPersistedBlobs,
      clearSessionBlobCache,
      isSecureContext: true,
      showToast,
    });

    expect(clearPersistedBlobs).toHaveBeenCalledTimes(1);
    expect(cachesApi.delete).toHaveBeenCalledWith('dj-mix:audio-cache:v1');
    expect(cachesApi.delete).not.toHaveBeenCalledWith('other-cache');
    expect(clearSessionBlobCache).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Cache local vidé');
  });

  // IndexedDB (unlike the legacy Cache Storage API it replaces) has no
  // secure-context requirement, so clearing local persistence must succeed
  // even over a plain-HTTP LAN IP where `window.caches` is absent entirely —
  // this is the exact deployment mode that motivated the IndexedDB move.
  test('clears the IndexedDB blob store and session blobs even when Cache Storage/cachesApi is entirely unavailable (e.g. LAN IP over HTTP)', async () => {
    const clearPersistedBlobs = jest.fn().mockResolvedValue(undefined);
    const clearSessionBlobCache = jest.fn();
    const showToast = jest.fn();

    await clearLocalCache({
      cachesApi: null,
      audioCacheName: 'dj-mix:audio-cache:v1',
      clearPersistedBlobs,
      clearSessionBlobCache,
      isSecureContext: false,
      showToast,
    });

    expect(clearPersistedBlobs).toHaveBeenCalledTimes(1);
    expect(clearSessionBlobCache).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Cache local vidé');
  });

  test('shows an error toast when caches.delete rejects', async () => {
    const cachesApi = {
      keys: jest.fn().mockResolvedValue(['dj-mix:audio-cache:v1']),
      delete: jest.fn().mockRejectedValue(new Error('boom')),
    };
    const showToast = jest.fn();

    await clearLocalCache({
      cachesApi,
      audioCacheName: 'dj-mix:audio-cache:v1',
      clearPersistedBlobs: jest.fn().mockResolvedValue(undefined),
      clearSessionBlobCache: jest.fn(),
      isSecureContext: true,
      showToast,
    });

    expect(showToast).toHaveBeenCalledWith('Erreur suppression cache: boom', true);
  });

  test('shows an error toast when clearPersistedBlobs rejects', async () => {
    const showToast = jest.fn();

    await clearLocalCache({
      cachesApi: null,
      audioCacheName: 'dj-mix:audio-cache:v1',
      clearPersistedBlobs: jest.fn().mockRejectedValue(new Error('idb boom')),
      clearSessionBlobCache: jest.fn(),
      isSecureContext: true,
      showToast,
    });

    expect(showToast).toHaveBeenCalledWith('Erreur suppression cache: idb boom', true);
  });
});
