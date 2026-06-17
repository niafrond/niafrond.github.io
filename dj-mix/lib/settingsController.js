import {
  persistRamFilterEnabledSetting,
  persistRamTotalMbOverrideSetting,
  persistTransitionModeSetting,
  persistTrackMaxDurationSetting,
  persistTrackMaxDurationModeSetting,
  persistTrackMaxDurationPctSetting,
  persistCrossfadeSecondsSetting,
  persistDebugLogsSetting,
  persistAutoSuggestionQueueSearchEnabledSetting,
  persistQueueLoopSetting,
  persistQueueShuffleSetting,
} from './settingsStorage.js';
import {
  MIX_TRANSITION_MODES,
  MIX_TRANSITION_MODE_LABELS,
  getTransitionRamRequirementsMb,
} from './transitionModes.js';
import { computeTransitionRamProfile } from './ramProfile.js';
import { normalizeAutoDjFxIntervalSettings } from './autoDjFxManager.js';
import { uiState } from './uiState.js';
import {
  TRACK_MAX_DURATION_MIN_SEC,
  TRACK_MAX_DURATION_MAX_SEC,
  TRACK_MAX_DURATION_PCT_MIN,
  TRACK_MAX_DURATION_PCT_MAX,
} from './constants.js';

/**
 * Gère tous les réglages utilisateur : transition mode, RAM filter, durée max,
 * crossfade, debug logs, auto-suggestion, boucle/shuffle.
 *
 * @param {object} options
 * @param {string}  options.initialTransitionMode
 * @param {boolean} options.initialRamFilterEnabled
 * @param {number}  options.initialRamTotalMbOverride
 * @param {number}  options.initialTrackMaxDurationSec
 * @param {boolean} options.initialTrackMaxDurationEnabled
 * @param {string}  options.initialTrackMaxDurationMode   - 'sec' | 'pct'
 * @param {number}  options.initialTrackMaxDurationPct
 * @param {boolean} options.initialAutoSuggestionQueueSearchEnabled
 * @param {boolean} options.initialQueueLoopEnabled
 * @param {boolean} options.initialQueueShuffleEnabled
 * @param {(val: number|string) => number} options.clampCrossfadeSeconds
 * @param {() => number} options.getCrossfadeSeconds  - current crossfade seconds (clamped)
 * @param {() => object|null} options.getPlayer
 * @param {() => object[]} options.getQueue
 * @param {object} options.autoModeManager
 * @param {() => object} options.getAutoDjFxSettings
 * @param {(enabled: boolean) => void} options.setDebugLogging
 * @param {() => void} options.updateDjFxMenuUI
 * @param {() => void} options.updateMaxDurationMarker
 * @param {() => void} [options.updateSuggestionRefreshButtons]
 * @param {() => void} [options.trimRetainedAudioSources]
 * @param {(msg: string, isError?: boolean) => void} options.showToast
 * @param {(event: string, payload?: object) => void} options.logInfo
 * @param {(event: string, payload?: object) => void} options.logDebug
 * @param {(event: string, payload?: object) => void} options.logWarn
 * @param {HTMLSelectElement|null} [options.mixTransitionModeSelect]
 * @param {HTMLInputElement|null}  [options.crossfadeSlider]
 * @param {HTMLInputElement|null}  [options.crossfadeSliderMix]
 * @param {HTMLElement|null}       [options.crossfadeValueEl]
 * @param {HTMLElement|null}       [options.crossfadeValueMixEl]
 * @param {HTMLElement|null}       [options.crossfadeFasterBtn]
 * @param {HTMLElement|null}       [options.crossfadeSlowerBtn]
 * @param {HTMLInputElement|null}  [options.trackMaxDurationInput]
 * @param {HTMLElement|null}       [options.trackMaxDurationMinus]
 * @param {HTMLElement|null}       [options.trackMaxDurationPlus]
 * @param {HTMLElement|null}       [options.trackMaxDurationModeBtn]
 * @param {HTMLInputElement|null}  [options.trackMaxDurationPctInput]
 * @param {HTMLElement|null}       [options.trackMaxDurationSecRow]
 * @param {HTMLElement|null}       [options.trackMaxDurationPctRow]
 * @param {HTMLElement|null}       [options.trackMaxDurationToggle]
 * @param {HTMLInputElement|null}  [options.ramFilterEnabledToggle]
 * @param {HTMLInputElement|null}  [options.ramTotalMemoryInput]
 * @param {HTMLElement|null}       [options.ramFilterStatus]
 * @param {HTMLInputElement|null}  [options.debugLogsToggle]
 * @param {HTMLElement|null}       [options.debugLogsStatus]
 * @param {HTMLInputElement|null}  [options.autoSuggestionQueueSearchToggle]
 * @param {HTMLElement|null}       [options.autoSuggestionQueueSearchStatus]
 * @param {HTMLInputElement|null}  [options.queueLoopToggle]
 * @param {HTMLInputElement|null}  [options.queueShuffleToggle]
 */
export function createSettingsController(options) {
  const {
    initialTransitionMode,
    initialRamFilterEnabled,
    initialRamTotalMbOverride,
    initialTrackMaxDurationSec,
    initialTrackMaxDurationEnabled,
    initialTrackMaxDurationMode,
    initialTrackMaxDurationPct,
    initialAutoSuggestionQueueSearchEnabled,
    initialQueueLoopEnabled,
    initialQueueShuffleEnabled,
    clampCrossfadeSeconds,
    getCrossfadeSeconds,
    getPlayer,
    getQueue,
    autoModeManager,
    getAutoDjFxSettings,
    setDebugLogging,
    updateDjFxMenuUI,
    updateMaxDurationMarker,
    updateSuggestionRefreshButtons,
    trimRetainedAudioSources,
    showToast,
    logInfo,
    logDebug,
    logWarn,
    mixTransitionModeSelect = null,
    crossfadeSlider = null,
    crossfadeSliderMix = null,
    crossfadeValueEl = null,
    crossfadeValueMixEl = null,
    crossfadeFasterBtn = null,
    crossfadeSlowerBtn = null,
    trackMaxDurationInput = null,
    trackMaxDurationMinus = null,
    trackMaxDurationPlus = null,
    trackMaxDurationModeBtn = null,
    trackMaxDurationPctInput = null,
    trackMaxDurationSecRow = null,
    trackMaxDurationPctRow = null,
    trackMaxDurationToggle = null,
    ramFilterEnabledToggle = null,
    ramTotalMemoryInput = null,
    ramFilterStatus = null,
    debugLogsToggle = null,
    debugLogsStatus = null,
    autoSuggestionQueueSearchToggle = null,
    autoSuggestionQueueSearchStatus = null,
    queueLoopToggle = null,
    queueShuffleToggle = null,
  } = options;

  // ── Private state ────────────────────────────────────────────────────────────

  let selectedTransitionMode = initialTransitionMode || 'auto';
  let ramFilterEnabled = Boolean(initialRamFilterEnabled);
  let ramTotalMbOverride = Number(initialRamTotalMbOverride) || 0;
  let allowedTransitionModes = [...MIX_TRANSITION_MODES];
  let transitionRamRequirementsMb = getTransitionRamRequirementsMb();
  let transitionRamCapability = null;
  let trackMaxDurationSec = Number(initialTrackMaxDurationSec) || 0;
  let trackMaxDurationEnabled = Boolean(initialTrackMaxDurationEnabled);
  let trackMaxDurationAppliedSec = trackMaxDurationEnabled ? trackMaxDurationSec : 0;
  let lastTrackMaxDurationSec = trackMaxDurationSec > 0 ? trackMaxDurationSec : 120;
  let trackMaxDurationMode = initialTrackMaxDurationMode || 'sec';
  let trackMaxDurationPct = Number(initialTrackMaxDurationPct) || 50;
  let autoSuggestionQueueSearchEnabled = Boolean(initialAutoSuggestionQueueSearchEnabled);
  let queueLoopEnabled = Boolean(initialQueueLoopEnabled);
  let queueShuffleEnabled = Boolean(initialQueueShuffleEnabled);

  // ── Getters ──────────────────────────────────────────────────────────────────

  function getSelectedTransitionMode() { return selectedTransitionMode; }
  function getAllowedTransitionModes() { return allowedTransitionModes; }
  function getTransitionRamCapability() { return transitionRamCapability; }
  function getRamFilterEnabled() { return ramFilterEnabled; }
  function getRamTotalMbOverride() { return ramTotalMbOverride; }
  function getTrackMaxDurationAppliedSec() { return trackMaxDurationAppliedSec; }
  function getTrackMaxDurationEnabled() { return trackMaxDurationEnabled; }
  function getTrackMaxDurationMode() { return trackMaxDurationMode; }
  function getTrackMaxDurationPct() { return trackMaxDurationPct; }
  function getTrackMaxDurationSec() { return trackMaxDurationSec; }
  function getQueueLoopEnabled() { return queueLoopEnabled; }
  function getQueueShuffleEnabled() { return queueShuffleEnabled; }
  function getAutoSuggestionQueueSearchEnabled() { return autoSuggestionQueueSearchEnabled; }

  // ── Setters (used by event listeners in main) ────────────────────────────────

  function setRamFilterEnabled(value) { ramFilterEnabled = Boolean(value); }
  function setRamTotalMbOverride(value) { ramTotalMbOverride = Number(value) || 0; }
  function setTrackMaxDurationMode(mode) { trackMaxDurationMode = mode === 'pct' ? 'pct' : 'sec'; }
  function setTrackMaxDurationAppliedSec(sec) { trackMaxDurationAppliedSec = Number(sec) || 0; }
  function setQueueLoopEnabled(value) {
    queueLoopEnabled = Boolean(value);
    persistQueueLoopSetting(queueLoopEnabled);
  }
  function setQueueShuffleEnabled(value) {
    queueShuffleEnabled = Boolean(value);
    persistQueueShuffleSetting(queueShuffleEnabled);
  }

  // ── Transition mode helpers ──────────────────────────────────────────────────

  function getSafeAllowedTransitionMode(mode) {
    const normalized = MIX_TRANSITION_MODES.includes(mode) ? mode : 'auto';
    const allowedSet = new Set(allowedTransitionModes);
    if (allowedSet.has(normalized)) return normalized;
    if (allowedSet.has('auto')) return 'auto';
    return allowedTransitionModes[0] || 'cut_transition';
  }

  function computeTransitionRamRequirements() {
    const crossfadeSeconds = getCrossfadeSeconds();
    transitionRamRequirementsMb = getTransitionRamRequirementsMb({
      crossfadeDurationMs: crossfadeSeconds * 1000,
    });
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
    const safeCurrent = getSafeAllowedTransitionMode(
      mixTransitionModeSelect.value || selectedTransitionMode,
    );
    mixTransitionModeSelect.value = safeCurrent;
  }

  function applyTransitionCapabilitiesForDevice({ announce = false } = {}) {
    computeTransitionRamRequirements();
    const crossfadeSeconds = getCrossfadeSeconds();
    const profile = computeTransitionRamProfile({
      ramFilterEnabled,
      ramTotalMbOverride,
      crossfadeDurationMs: crossfadeSeconds * 1000,
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

  // ── Queue mode UI ────────────────────────────────────────────────────────────

  function updateQueueModeConfigUI() {
    if (queueLoopToggle) queueLoopToggle.checked = queueLoopEnabled;
    if (queueShuffleToggle) queueShuffleToggle.checked = queueShuffleEnabled;
  }

  // ── RAM filter ───────────────────────────────────────────────────────────────

  function updateRamFilterConfigUI() {
    if (ramFilterEnabledToggle) ramFilterEnabledToggle.checked = ramFilterEnabled;
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

  function applyRamFilterSettings({ persist = true, announce = false } = {}) {
    if (persist) {
      persistRamFilterEnabledSetting(ramFilterEnabled);
      persistRamTotalMbOverrideSetting(ramTotalMbOverride);
    }
    applyTransitionCapabilitiesForDevice({ announce });
    updateRamFilterConfigUI();
    const player = getPlayer?.();
    if (player) player.setAllowedTransitionModes(allowedTransitionModes);
    const safeMode = getSafeAllowedTransitionMode(selectedTransitionMode);
    if (safeMode !== selectedTransitionMode) {
      applyTransitionModeSetting(safeMode, { persist: true });
      showToast(`Mode AutoMix ajuste (RAM): ${MIX_TRANSITION_MODE_LABELS[safeMode] || safeMode}`);
    }
    trimRetainedAudioSources?.();
  }

  // ── Transition mode ──────────────────────────────────────────────────────────

  function applyTransitionModeSetting(mode, { persist = true } = {}) {
    const safeMode = getSafeAllowedTransitionMode(mode);
    selectedTransitionMode = safeMode;
    if (mixTransitionModeSelect) mixTransitionModeSelect.value = safeMode;
    const player = getPlayer?.();
    player?.setTransitionMode(safeMode);
    if (persist) persistTransitionModeSetting(safeMode);
    updateDjFxMenuUI?.();
  }

  // ── Automix timing recalculation ─────────────────────────────────────────────

  function recalculateAutomixTimingIfNeeded(logEvent = 'autoDj: recalculating automix timing') {
    if (!autoModeManager?.isAutoModeEnabled()) return;
    if (uiState.currentIndex < 0) return;
    const queue = getQueue?.() || [];
    const currentItem = queue[uiState.currentIndex];
    if (!currentItem) return;
    const intervals = normalizeAutoDjFxIntervalSettings(
      getAutoDjFxSettings?.()?.minIntervalSec,
      getAutoDjFxSettings?.()?.maxIntervalSec,
    );
    logDebug(logEvent, {
      trackName: currentItem.name,
      newMaxDurationSec: trackMaxDurationSec,
      autoFxMinIntervalSec: intervals.minIntervalSec,
      autoFxMaxIntervalSec: intervals.maxIntervalSec,
    });
    autoModeManager.scheduleAutomixTiming(currentItem);
  }

  // ── Track max duration ────────────────────────────────────────────────────────

  function applyTrackMaxDurationForCurrentPlayback() {
    if (!trackMaxDurationEnabled) {
      trackMaxDurationAppliedSec = 0;
      return;
    }
    if (trackMaxDurationMode === 'pct') {
      if (trackMaxDurationAppliedSec <= 0) trackMaxDurationAppliedSec = 1;
    } else {
      trackMaxDurationAppliedSec = trackMaxDurationSec;
    }
  }

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
    if (trackMaxDurationSecRow) trackMaxDurationSecRow.style.display = isPct ? 'none' : 'flex';
    if (trackMaxDurationPctRow) trackMaxDurationPctRow.style.display = isPct ? 'flex' : 'none';
    if (trackMaxDurationInput) trackMaxDurationInput.value = String(trackMaxDurationSec);
    if (trackMaxDurationPctInput) trackMaxDurationPctInput.value = String(trackMaxDurationPct);
    if (trackMaxDurationMinus) trackMaxDurationMinus.disabled = false;
    if (trackMaxDurationPlus) trackMaxDurationPlus.disabled = false;
    if (trackMaxDurationToggle) {
      trackMaxDurationToggle.textContent = trackMaxDurationEnabled ? 'Durée max: ON' : 'Durée max: OFF';
      trackMaxDurationToggle.setAttribute('aria-pressed', String(trackMaxDurationEnabled));
    }
  }

  function applyTrackMaxDurationSetting(nextValue, logEvent) {
    const value = Math.max(
      TRACK_MAX_DURATION_MIN_SEC,
      Math.min(TRACK_MAX_DURATION_MAX_SEC, Number.parseInt(String(nextValue || '0'), 10) || 0),
    );
    trackMaxDurationSec = value;
    if (value > 0) lastTrackMaxDurationSec = value;
    applyTrackMaxDurationForCurrentPlayback();
    persistTrackMaxDurationSetting(value);
    updateTrackMaxDurationUI();
    const msg = value > 0 ? `Durée max: ${value}s` : 'Durée max: désactivée';
    showToast(msg);
    logDebug(logEvent || 'trackMaxDuration: setting changed', { value });
    recalculateAutomixTimingIfNeeded('trackMaxDuration: recalculating automix timing');
    updateMaxDurationMarker?.();
  }

  function applyTrackMaxDurationPctSetting(nextValue, logEvent) {
    const value = Math.max(
      TRACK_MAX_DURATION_PCT_MIN,
      Math.min(TRACK_MAX_DURATION_PCT_MAX, Number.parseInt(String(nextValue || '50'), 10) || 50),
    );
    trackMaxDurationPct = value;
    persistTrackMaxDurationModeSetting('pct');
    persistTrackMaxDurationPctSetting(value);
    updateTrackMaxDurationUI();
    showToast(`Durée max: ${value}%`);
    logDebug(logEvent || 'trackMaxDuration: pct setting changed', { value });
    recalculateAutomixTimingIfNeeded('trackMaxDuration: recalculating automix timing');
    updateMaxDurationMarker?.();
  }

  // ── Crossfade ────────────────────────────────────────────────────────────────

  function updateCrossfadeControlUI(seconds) {
    const safeSeconds = clampCrossfadeSeconds(seconds);
    if (crossfadeSlider) crossfadeSlider.value = String(safeSeconds);
    if (crossfadeSliderMix) crossfadeSliderMix.value = String(safeSeconds);
    if (crossfadeValueEl) crossfadeValueEl.textContent = `${safeSeconds}s`;
    if (crossfadeValueMixEl) crossfadeValueMixEl.textContent = `${safeSeconds}s`;
    if (crossfadeFasterBtn) crossfadeFasterBtn.disabled = safeSeconds <= 1;
    if (crossfadeSlowerBtn) crossfadeSlowerBtn.disabled = safeSeconds >= 30;
  }

  function setCrossfadeDurationSeconds(seconds) {
    const safeSeconds = clampCrossfadeSeconds(seconds);
    updateCrossfadeControlUI(safeSeconds);
    applyRamFilterSettings({ persist: false, announce: false });
    persistCrossfadeSecondsSetting(safeSeconds);
    const player = getPlayer?.();
    if (player) {
      player.crossfadeDuration = safeSeconds * 1000;
      player.setAllowedTransitionModes(allowedTransitionModes);
    }
  }

  // ── Debug logs ────────────────────────────────────────────────────────────────

  function updateDebugLogsUi(enabled) {
    if (debugLogsToggle) debugLogsToggle.checked = Boolean(enabled);
    if (debugLogsStatus) {
      debugLogsStatus.textContent = enabled
        ? 'Mode debug actif: logs info + debug visibles dans la console.'
        : 'Mode debug inactif: seuls les warnings et erreurs sont affiches.';
    }
  }

  function applyDebugLogsSetting(enabled, { persist = true } = {}) {
    const safeEnabled = Boolean(enabled);
    setDebugLogging?.(safeEnabled);
    updateDebugLogsUi(safeEnabled);
    if (persist) persistDebugLogsSetting(safeEnabled);
    if (safeEnabled) {
      logWarn('debug.mode.enabled', { enabled: safeEnabled });
    } else {
      logWarn('debug.mode.disabled', { enabled: safeEnabled });
    }
  }

  // ── Auto-suggestion queue search ─────────────────────────────────────────────

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

  function applyAutoSuggestionQueueSearchSetting(enabled, { persist = true, announce = false } = {}) {
    autoSuggestionQueueSearchEnabled = Boolean(enabled);
    autoModeManager?.setSuggestionSearchEnabled?.(autoSuggestionQueueSearchEnabled);
    updateAutoSuggestionQueueSearchUi();
    updateSuggestionRefreshButtons?.();
    if (persist) persistAutoSuggestionQueueSearchEnabledSetting(autoSuggestionQueueSearchEnabled);
    if (announce) {
      showToast(`Recherche suggestion queue: ${autoSuggestionQueueSearchEnabled ? 'ON' : 'OFF'}`);
    }
  }

  return {
    // Getters
    getSelectedTransitionMode,
    getAllowedTransitionModes,
    getTransitionRamCapability,
    getRamFilterEnabled,
    getRamTotalMbOverride,
    getTrackMaxDurationAppliedSec,
    getTrackMaxDurationEnabled,
    getTrackMaxDurationMode,
    getTrackMaxDurationPct,
    getTrackMaxDurationSec,
    getQueueLoopEnabled,
    getQueueShuffleEnabled,
    getAutoSuggestionQueueSearchEnabled,
    // Setters
    setRamFilterEnabled,
    setRamTotalMbOverride,
    setTrackMaxDurationMode,
    setTrackMaxDurationAppliedSec,
    setQueueLoopEnabled,
    setQueueShuffleEnabled,
    // Actions
    getSafeAllowedTransitionMode,
    applyRamFilterSettings,
    applyTransitionModeSetting,
    applyTransitionCapabilitiesForDevice,
    recalculateAutomixTimingIfNeeded,
    applyTrackMaxDurationForCurrentPlayback,
    applyTrackMaxDurationSetting,
    applyTrackMaxDurationPctSetting,
    computePctMaxDurationSec,
    updateTrackMaxDurationUI,
    updateQueueModeConfigUI,
    updateRamFilterConfigUI,
    updateCrossfadeControlUI,
    setCrossfadeDurationSeconds,
    applyDebugLogsSetting,
    applyAutoSuggestionQueueSearchSetting,
  };
}
