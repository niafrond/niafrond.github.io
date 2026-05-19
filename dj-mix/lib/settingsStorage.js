import { STORAGE_KEYS } from './storageKeys.js';

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (_) {
    // ignore storage failures
  }
}

export function readBooleanSetting(key, fallback = false) {
  const stored = safeGet(key);
  if (stored == null) return Boolean(fallback);
  return stored !== '0';
}

export function persistBooleanSetting(key, enabled) {
  safeSet(key, enabled ? '1' : '0');
}

export function readTransitionModeSetting(validModes) {
  const stored = safeGet(STORAGE_KEYS.mixTransitionMode) || 'auto';
  return Array.isArray(validModes) && validModes.includes(stored) ? stored : 'auto';
}

export function persistTransitionModeSetting(mode) {
  safeSet(STORAGE_KEYS.mixTransitionMode, String(mode || 'auto'));
}

export function readTrackMaxDurationSetting() {
  const stored = safeGet(STORAGE_KEYS.trackMaxDuration) || '0';
  const value = Number.parseInt(stored, 10);
  return (value >= 30 && value <= 600) ? value : 0;
}

export function persistTrackMaxDurationSetting(seconds) {
  const value = Math.max(0, Math.min(600, Number.parseInt(String(seconds || '0'), 10) || 0));
  safeSet(STORAGE_KEYS.trackMaxDuration, String(value));
}

export function readTrackMaxDurationEnabledSetting(fallback = true) {
  return readBooleanSetting(STORAGE_KEYS.trackMaxDurationEnabled, fallback);
}

export function persistTrackMaxDurationEnabledSetting(enabled) {
  persistBooleanSetting(STORAGE_KEYS.trackMaxDurationEnabled, enabled);
}

export function readRamFilterEnabledSetting() {
  return readBooleanSetting(STORAGE_KEYS.ramFilterEnabled, true);
}

export function persistRamFilterEnabledSetting(enabled) {
  persistBooleanSetting(STORAGE_KEYS.ramFilterEnabled, enabled);
}

export function readRamTotalMbOverrideSetting() {
  const stored = Number.parseInt(safeGet(STORAGE_KEYS.ramTotalMbOverride) || '0', 10);
  if (!Number.isFinite(stored) || stored <= 0) return 0;
  return Math.max(512, Math.min(32768, stored));
}

export function persistRamTotalMbOverrideSetting(totalMb) {
  const safeMb = Math.max(0, Number.parseInt(String(totalMb || '0'), 10) || 0);
  safeSet(STORAGE_KEYS.ramTotalMbOverride, String(safeMb));
}

export function readDebugLogsSetting() {
  return readBooleanSetting(STORAGE_KEYS.debugLogs, false);
}

export function persistDebugLogsSetting(enabled) {
  persistBooleanSetting(STORAGE_KEYS.debugLogs, enabled);
}

export function readFxControlsHiddenSetting() {
  return readBooleanSetting(STORAGE_KEYS.fxVisibility, false);
}

export function persistFxControlsHiddenSetting(hidden) {
  persistBooleanSetting(STORAGE_KEYS.fxVisibility, hidden);
}

export function readCrossfadeSecondsSetting(fallback = 6) {
  const stored = safeGet(STORAGE_KEYS.crossfadeSeconds);
  if (stored == null) return fallback;
  return stored;
}

export function persistCrossfadeSecondsSetting(seconds) {
  safeSet(STORAGE_KEYS.crossfadeSeconds, String(seconds));
}

export function readDjModeSetting() {
  const stored = safeGet(STORAGE_KEYS.djMode);
  return stored === 'dance' ? 'dance' : 'music';
}

export function persistDjModeSetting(mode) {
  safeSet(STORAGE_KEYS.djMode, mode === 'dance' ? 'dance' : 'music');
}

export function readDjModeGenrePrefs() {
  try {
    const raw = safeGet(STORAGE_KEYS.djModeGenrePrefs);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((g) => g && typeof g === 'string') : [];
  } catch (_) {
    return [];
  }
}

export function persistDjModeGenrePrefs(genres) {
  safeSet(STORAGE_KEYS.djModeGenrePrefs, JSON.stringify(Array.isArray(genres) ? genres : []));
}

export function removeQueueSetting() {
  try {
    localStorage.removeItem(STORAGE_KEYS.queue);
  } catch (_) {
    // ignore storage failures
  }
}
