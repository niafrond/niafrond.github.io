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

export function readDisabledTransitionModesSetting(validModes) {
  try {
    const raw = safeGet(STORAGE_KEYS.disabledTransitionModes);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = Array.isArray(validModes) ? validModes : null;
    return parsed.filter((mode) => typeof mode === 'string' && (!valid || valid.includes(mode)));
  } catch (_) {
    return [];
  }
}

export function persistDisabledTransitionModesSetting(modes) {
  safeSet(STORAGE_KEYS.disabledTransitionModes, JSON.stringify(Array.isArray(modes) ? modes : []));
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

export function readTrackMaxDurationModeSetting() {
  const stored = safeGet(STORAGE_KEYS.trackMaxDurationMode);
  return stored === 'pct' ? 'pct' : 'sec';
}

export function persistTrackMaxDurationModeSetting(mode) {
  safeSet(STORAGE_KEYS.trackMaxDurationMode, mode === 'pct' ? 'pct' : 'sec');
}

export function readTrackMaxDurationPctSetting() {
  const stored = safeGet(STORAGE_KEYS.trackMaxDurationPct) || '50';
  const value = Number.parseInt(stored, 10);
  return (value >= 5 && value <= 95) ? value : 50;
}

export function persistTrackMaxDurationPctSetting(pct) {
  const value = Math.max(5, Math.min(95, Number.parseInt(String(pct || '50'), 10) || 50));
  safeSet(STORAGE_KEYS.trackMaxDurationPct, String(value));
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

export function readDjExternalPlanEnabledSetting() {
  return readBooleanSetting(STORAGE_KEYS.djExternalPlanEnabled, true);
}

export function persistDjExternalPlanEnabledSetting(enabled) {
  persistBooleanSetting(STORAGE_KEYS.djExternalPlanEnabled, enabled);
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

export function readAutoSuggestionQueueSearchEnabledSetting() {
  return readBooleanSetting(STORAGE_KEYS.autoSuggestionQueueSearchEnabled, true);
}

export function persistAutoSuggestionQueueSearchEnabledSetting(enabled) {
  persistBooleanSetting(STORAGE_KEYS.autoSuggestionQueueSearchEnabled, enabled);
}

export function readQueueLoopSetting() {
  return readBooleanSetting(STORAGE_KEYS.queueLoop, false);
}

export function persistQueueLoopSetting(enabled) {
  persistBooleanSetting(STORAGE_KEYS.queueLoop, enabled);
}

export function readQueueShuffleSetting() {
  return readBooleanSetting(STORAGE_KEYS.queueShuffle, false);
}

export function persistQueueShuffleSetting(enabled) {
  persistBooleanSetting(STORAGE_KEYS.queueShuffle, enabled);
}

const RELAY_MODES = ['standalone', 'master', 'relay'];

export function readRelayModeSetting() {
  const stored = safeGet(STORAGE_KEYS.relayMode);
  return RELAY_MODES.includes(stored) ? stored : 'standalone';
}

export function persistRelayModeSetting(mode) {
  safeSet(STORAGE_KEYS.relayMode, RELAY_MODES.includes(mode) ? mode : 'standalone');
}

// Demande au navigateur de rendre le storage de cette origine « persistant » (best-effort,
// aucune garantie ni prompt selon les navigateurs) pour réduire le risque que le
// localStorage d'un appareil maître resté inactif plusieurs jours soit purgé (ex. purge
// ITP de Safari après 7 jours d'inactivité, éviction sous pression de stockage) — l'ID
// maître redeviendrait sinon aléatoire à la prochaine génération.
function _requestPersistentStorage() {
  try {
    navigator.storage?.persist?.();
  } catch (_) {
    // ignore — best effort
  }
}

// Identifiant court, unique et permanent de CET appareil en tant que maître relais
// (pas une session serveur éphémère : un simple aléa généré une fois et conservé
// tant que le storage n'est pas vidé). Pas de fonction de suppression : redevenir
// « autonome » ne doit pas faire perdre l'identité de l'appareil.
export function getOrCreateRelayMasterId() {
  const existing = safeGet(STORAGE_KEYS.relayMasterId);
  if (existing) return existing;
  const id = Math.random().toString(36).slice(2, 8).toUpperCase();
  safeSet(STORAGE_KEYS.relayMasterId, id);
  _requestPersistentStorage();
  return id;
}

export function removeQueueSetting() {
  try {
    localStorage.removeItem(STORAGE_KEYS.queue);
  } catch (_) {
    // ignore storage failures
  }
}
