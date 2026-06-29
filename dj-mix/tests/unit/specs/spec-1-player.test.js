/**
 * Spec-driven tests for §1 — Lecture audio (Player)
 * References: SPEC-1.2.1, SPEC-1.3.4.1–4, SPEC-1.5.1–4, SPEC-5.6
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import {
  MIX_TRANSITION_MODES,
  getAllowedTransitionModesForRam,
  getTransitionRamRequirementMb,
  getTransitionRamRequirementsMb,
  normalizeTransitionMode,
} from '../../../lib/transitionModes.js';
import {
  resetAutomixTimeline,
  setAutomixTriggerMs,
  shouldTriggerAutomix,
  markAutomixTriggered,
} from '../../../lib/automixTimeline.js';
import { createSettingsController } from '../../../lib/settingsController.js';
import { uiState } from '../../../lib/uiState.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSettingsController(overrides = {}) {
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
  uiState.currentIndex = -1;
  uiState.queue = [];
});

// ── SPEC-1.3 Transition modes catalogue ──────────────────────────────────────

describe('SPEC-1.3.1 — 26 transition modes exist', () => {
  test('catalogue contains exactly 26 modes', () => {
    expect(MIX_TRANSITION_MODES).toHaveLength(26);
  });

  test('auto is the first mode', () => {
    expect(MIX_TRANSITION_MODES[0]).toBe('auto');
  });

  test('cut_transition exists as emergency fallback', () => {
    expect(MIX_TRANSITION_MODES).toContain('cut_transition');
  });

  const expectedModes = [
    'auto', 'crossfade_linear', 'crossfade_logarithmic', 'fade_in_out',
    'cut_transition', 'filter_sweep_low_high', 'eq_transition_simple',
    'echo_out_light', 'reverb_short_simple', 'short_loop',
    'brake_tape_stop_simple', 'short_reverse', 'sidechain_basic',
    'volume_ducking', 'gain_automation', 'filter_automation',
    'crossfade_lowpass', 'crossfade_highpass_in', 'filter_dual_sweep',
    'echo_lowpass', 'bass_swap', 'kick_swap', 'beat_repeat',
    'backspin', 'fake_drop', 'echo_freeze',
  ];

  test.each(expectedModes)('mode "%s" is in the catalogue', (mode) => {
    expect(MIX_TRANSITION_MODES).toContain(mode);
  });
});

// ── SPEC-1.3.2 — RAM cost per mode ──────────────────────────────────────────

describe('SPEC-1.3.2 — RAM cost declarations', () => {
  test('auto mode has 0 MB cost', () => {
    expect(getTransitionRamRequirementMb('auto')).toBe(0);
  });

  test('cut_transition has lowest non-zero cost (6 MB)', () => {
    const cost = getTransitionRamRequirementMb('cut_transition');
    expect(cost).toBeLessThanOrEqual(10);
  });

  test('every mode has a finite numeric RAM cost', () => {
    for (const mode of MIX_TRANSITION_MODES) {
      const cost = getTransitionRamRequirementMb(mode);
      expect(typeof cost).toBe('number');
      expect(Number.isFinite(cost)).toBe(true);
    }
  });

  test('RAM cost increases with crossfade duration', () => {
    const profile6s = getTransitionRamRequirementsMb({ crossfadeDurationMs: 6000 });
    const profile20s = getTransitionRamRequirementsMb({ crossfadeDurationMs: 20000 });
    // Non-zero modes should cost more with longer crossfade
    expect(profile20s.crossfade_linear).toBeGreaterThan(profile6s.crossfade_linear);
  });
});

// ── SPEC-1.3.4 — RAM filter ─────────────────────────────────────────────────

describe('SPEC-1.3.4 — RAM filter', () => {
  test('SPEC-1.3.4.2 — auto and cut_transition always allowed even with 1 MB budget', () => {
    const allowed = getAllowedTransitionModesForRam(1, { crossfadeDurationMs: 12000 });
    expect(allowed).toContain('auto');
    expect(allowed).toContain('cut_transition');
  });

  test('with very low budget, only cheapest modes survive', () => {
    const allowed = getAllowedTransitionModesForRam(10, { crossfadeDurationMs: 6000 });
    expect(allowed).toContain('auto');
    expect(allowed).toContain('cut_transition');
    // Expensive modes should be filtered
    expect(allowed).not.toContain('echo_lowpass');
    expect(allowed).not.toContain('echo_freeze');
  });

  test('with high budget, all modes are allowed', () => {
    const allowed = getAllowedTransitionModesForRam(10000, { crossfadeDurationMs: 6000 });
    expect(allowed).toHaveLength(MIX_TRANSITION_MODES.length);
  });

  test('normalizeTransitionMode falls back to auto for unknown modes', () => {
    expect(normalizeTransitionMode('nonexistent')).toBe('auto');
    expect(normalizeTransitionMode(null)).toBe('auto');
    expect(normalizeTransitionMode('')).toBe('auto');
  });
});

// ── SPEC-1.5 — Track max duration ───────────────────────────────────────────

describe('SPEC-1.5.1 — Configuration', () => {
  test('SPEC-1.5.1.2 — sec mode bounds 0–600', () => {
    const ctrl = makeSettingsController();
    ctrl.applyTrackMaxDurationSetting(999);
    expect(ctrl.getTrackMaxDurationSec()).toBe(600);
    ctrl.applyTrackMaxDurationSetting(-50);
    expect(ctrl.getTrackMaxDurationSec()).toBe(0);
  });

  test('SPEC-1.5.1.3 — pct mode bounds 5–95, default 50', () => {
    const ctrl = makeSettingsController();
    expect(ctrl.getTrackMaxDurationPct()).toBe(50);
    ctrl.applyTrackMaxDurationPctSetting(2);
    expect(ctrl.getTrackMaxDurationPct()).toBe(5);
    ctrl.applyTrackMaxDurationPctSetting(100);
    expect(ctrl.getTrackMaxDurationPct()).toBe(95);
  });
});

describe('SPEC-1.5.2 — Pct mode calculation', () => {
  test('SPEC-1.5.2.1 — excludes intro and outro from effective duration', () => {
    const ctrl = makeSettingsController({ initialTrackMaxDurationPct: 50 });
    const mixData = {
      probableSongStartSec: 15,
      outroZones: [{ startSec: 200 }],
    };
    // effectiveDuration = 200 − 15 = 185
    // result = 15 + 185 × 50/100 = 15 + 92.5 = 107.5
    expect(ctrl.computePctMaxDurationSec(mixData, 240_000)).toBe(107.5);
  });

  test('SPEC-1.5.2.2 — no mixData uses full track as effective', () => {
    const ctrl = makeSettingsController({ initialTrackMaxDurationPct: 25 });
    // 200s track, no mix data → result = 0 + 200 × 25/100 = 50
    expect(ctrl.computePctMaxDurationSec(null, 200_000)).toBe(50);
  });

  test('returns 0 for zero duration', () => {
    const ctrl = makeSettingsController({ initialTrackMaxDurationPct: 80 });
    expect(ctrl.computePctMaxDurationSec(null, 0)).toBe(0);
  });

  test('multiple outroZones picks earliest', () => {
    const ctrl = makeSettingsController({ initialTrackMaxDurationPct: 100 });
    const mixData = {
      probableSongStartSec: 0,
      outroZones: [{ startSec: 250 }, { startSec: 220 }, { startSec: 280 }],
    };
    // earliest outro = 220, effectiveDuration = 220 − 0 = 220
    expect(ctrl.computePctMaxDurationSec(mixData, 300_000)).toBe(220);
  });
});

// ── SPEC-5.7 — Automix timeline (trigger mechanics) ─────────────────────────

describe('SPEC-5.7 — Automix timeline', () => {
  test('SPEC-5.7.1 — triggers when position reaches nextTriggerMs', () => {
    const state = { nextTriggerMs: -1, triggeredForTrack: false };
    setAutomixTriggerMs(state, 120_000);
    expect(state.nextTriggerMs).toBe(120_000);
    expect(shouldTriggerAutomix(state, 119_999)).toBe(false);
    expect(shouldTriggerAutomix(state, 120_000)).toBe(true);
    expect(shouldTriggerAutomix(state, 125_000)).toBe(true);
  });

  test('SPEC-5.7.3 — triggers only once per track', () => {
    const state = { nextTriggerMs: 50_000, triggeredForTrack: false };
    expect(shouldTriggerAutomix(state, 50_000)).toBe(true);
    markAutomixTriggered(state);
    expect(shouldTriggerAutomix(state, 60_000)).toBe(false);
  });

  test('resetAutomixTimeline resets trigger state', () => {
    const state = { nextTriggerMs: 50_000, triggeredForTrack: true, currentPlayingDeck: 'B' };
    resetAutomixTimeline(state, 'A');
    expect(state.nextTriggerMs).toBe(-1);
    expect(state.triggeredForTrack).toBe(false);
    expect(state.currentPlayingDeck).toBe('A');
  });

  test('setAutomixTriggerMs rejects non-positive values', () => {
    const state = { nextTriggerMs: 50_000, triggeredForTrack: true };
    setAutomixTriggerMs(state, 0);
    expect(state.nextTriggerMs).toBe(-1);
    setAutomixTriggerMs(state, -100);
    expect(state.nextTriggerMs).toBe(-1);
    setAutomixTriggerMs(state, NaN);
    expect(state.nextTriggerMs).toBe(-1);
  });

  test('setAutomixTriggerMs clears triggeredForTrack', () => {
    const state = { nextTriggerMs: 50_000, triggeredForTrack: true };
    setAutomixTriggerMs(state, 80_000);
    expect(state.triggeredForTrack).toBe(false);
  });
});
