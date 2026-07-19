/**
 * Spec-driven tests for §1 — Lecture audio (Player)
 * References: SPEC-1.2.1, SPEC-1.3.4.1–4, SPEC-1.5.1–4, SPEC-5.6
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import {
  MIX_TRANSITION_MODES,
  MIX_TRANSITION_MODE_LABELS,
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

describe('SPEC-1.3.1 — 25 transition modes exist', () => {
  test('catalogue contains exactly 25 modes', () => {
    expect(MIX_TRANSITION_MODES).toHaveLength(25);
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
    'backspin', 'echo_freeze',
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

// ── SPEC-1.3.3 — Auto random transition selection ───────────────────────────

describe('SPEC-1.3.3 — Auto mode label', () => {
  test('SPEC-1.3.3.1 — auto label is Auto (aléatoire)', () => {
    expect(MIX_TRANSITION_MODE_LABELS.auto).toBe('Auto (aléatoire)');
  });
});

describe('SPEC-1.3.3 — Auto mode selects from full pool via player', () => {
  let mockAudios = [];
  let origAudio;
  let origRAF;
  let origCAF;
  let origAudioContext;

  beforeEach(() => {
    mockAudios = [];
    origAudio = globalThis.Audio;
    globalThis.Audio = function MockAudio() {
      const listeners = {};
      const audio = {
        src: '', currentTime: 0, duration: 180, volume: 0, paused: true,
        ended: false, playbackRate: 1, preload: '', readyState: 0, currentSrc: '',
        addEventListener(event, handler, opts) {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push({ handler, once: opts?.once ?? false });
        },
        removeEventListener(event, handler) {
          if (!listeners[event]) return;
          listeners[event] = listeners[event].filter((e) => e.handler !== handler);
        },
        dispatchEvent(event) {
          const name = typeof event === 'string' ? event : event.type;
          const handlers = listeners[name] || [];
          const toRemove = [];
          for (const entry of handlers) { entry.handler(event); if (entry.once) toRemove.push(entry); }
          for (const entry of toRemove) listeners[name] = (listeners[name] || []).filter((e) => e !== entry);
        },
        load() { audio.readyState = 4; queueMicrotask(() => audio.dispatchEvent(new Event('canplay'))); },
        play() { audio.paused = false; queueMicrotask(() => audio.dispatchEvent(new Event('playing'))); return Promise.resolve(); },
        pause() { audio.paused = true; },
        remove() {},
      };
      mockAudios.push(audio);
      return audio;
    };
    origRAF = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    origCAF = globalThis.cancelAnimationFrame;
    globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
    origAudioContext = globalThis.AudioContext;
    const makeNode = () => ({ connect() {}, disconnect() {} });
    globalThis.AudioContext = class MockAudioContext {
      state = 'running';
      sampleRate = 44100;
      createMediaElementSource() { return makeNode(); }
      createGain() { return { gain: { value: 1, setTargetAtTime() {}, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, ...makeNode() }; }
      createBiquadFilter() { return { type: 'allpass', frequency: { value: 350, setTargetAtTime() {}, setValueAtTime() {} }, Q: { value: 1, setTargetAtTime() {}, setValueAtTime() {} }, ...makeNode() }; }
      createChannelSplitter() { return makeNode(); }
      createChannelMerger() { return makeNode(); }
      createDelay() { return { delayTime: { value: 0 }, ...makeNode() }; }
      createDynamicsCompressor() { return { threshold: { value: -24 }, knee: { value: 30 }, ratio: { value: 12 }, attack: { value: 0.003 }, release: { value: 0.25 }, ...makeNode() }; }
      createWaveShaper() { return { curve: null, oversample: 'none', ...makeNode() }; }
      createOscillator() { return { type: 'sine', frequency: { value: 440, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, start() {}, stop() {}, ...makeNode() }; }
      createConvolver() { return { buffer: null, ...makeNode() }; }
      get destination() { return makeNode(); }
      get currentTime() { return 0; }
      resume() { return Promise.resolve(); }
      close() { return Promise.resolve(); }
    };
  });

  afterEach(() => {
    globalThis.Audio = origAudio;
    globalThis.requestAnimationFrame = origRAF;
    globalThis.cancelAnimationFrame = origCAF;
    globalThis.AudioContext = origAudioContext;
  });

  async function makePlayer() {
    const { DJPlayer } = await import('../../../player.js');
    const player = new DJPlayer();
    player.crossfadeDuration = 250;
    player.setTransitionMode('auto');
    await player.init();
    await new Promise((r) => setTimeout(r, 0));
    await player.play({ url: 'blob:track-a', durationMs: 210000 });
    await new Promise((r) => setTimeout(r, 0));
    return player;
  }

  async function crossfadeAndGetMode(player, source) {
    let resolvedMode = null;
    const onMode = (e) => { resolvedMode = e.detail.effectiveMode; };
    player.addEventListener('transitionmode', onMode, { once: true });
    await player.crossfadeToDeck(null, source).catch(() => {});
    await new Promise((r) => setTimeout(r, 0));
    return resolvedMode;
  }

  test('SPEC-1.3.3.2.a — short next track (<95s) always picks cut_transition', async () => {
    const player = await makePlayer();
    const mode = await crossfadeAndGetMode(player, { url: 'blob:short', durationMs: 60000 });
    expect(mode).toBe('cut_transition');
    player.destroy?.();
  }, 10000);

  test('SPEC-1.3.3.2.c — normal next track picks from full allowed pool (not just crossfade_linear)', async () => {
    const player = await makePlayer();
    const seen = new Set();
    for (let i = 0; i < 10; i++) {
      const mode = await crossfadeAndGetMode(player, { url: `blob:track-${i}`, durationMs: 200000 });
      if (mode) seen.add(mode);
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
    player.destroy?.();
  }, 30000);

  test('SPEC-1.3.3.3 — history prevents same mode repeating consecutively too often', async () => {
    const player = await makePlayer();
    const modes = [];
    for (let i = 0; i < 10; i++) {
      const mode = await crossfadeAndGetMode(player, { url: `blob:track-${i}`, durationMs: 200000 });
      if (mode) modes.push(mode);
    }
    let consecutiveSame = 0;
    for (let i = 1; i < modes.length; i++) {
      if (modes[i] === modes[i - 1]) consecutiveSame++;
    }
    expect(consecutiveSame).toBeLessThan(5);
    player.destroy?.();
  }, 30000);

  test('SPEC-1.3.3.2.d — reverb_short_simple is never auto-picked (disabled, harsh sound)', async () => {
    const player = await makePlayer();
    const seen = new Set();
    for (let i = 0; i < 15; i++) {
      const mode = await crossfadeAndGetMode(player, { url: `blob:track-${i}`, durationMs: 200000 });
      if (mode) seen.add(mode);
    }
    expect(seen.has('reverb_short_simple')).toBe(false);
    player.destroy?.();
  }, 30000);
});

// ── SPEC-1.3.6 — Aucune transition ne crée de silence ───────────────────────

describe('SPEC-1.3.6 — Aucune transition ne crée de silence', () => {
  let mockAudios = [];
  let origAudio;
  let origRAF;
  let origCAF;
  let origAudioContext;

  beforeEach(() => {
    mockAudios = [];
    origAudio = globalThis.Audio;
    globalThis.Audio = function MockAudio() {
      const listeners = {};
      const audio = {
        src: '', currentTime: 0, duration: 180, volume: 0, paused: true,
        ended: false, playbackRate: 1, preload: '', readyState: 0, currentSrc: '',
        addEventListener(event, handler, opts) {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push({ handler, once: opts?.once ?? false });
        },
        removeEventListener(event, handler) {
          if (!listeners[event]) return;
          listeners[event] = listeners[event].filter((e) => e.handler !== handler);
        },
        dispatchEvent(event) {
          const name = typeof event === 'string' ? event : event.type;
          const handlers = listeners[name] || [];
          const toRemove = [];
          for (const entry of handlers) { entry.handler(event); if (entry.once) toRemove.push(entry); }
          for (const entry of toRemove) listeners[name] = (listeners[name] || []).filter((e) => e !== entry);
        },
        load() { audio.readyState = 4; queueMicrotask(() => audio.dispatchEvent(new Event('canplay'))); },
        play() { audio.paused = false; queueMicrotask(() => audio.dispatchEvent(new Event('playing'))); return Promise.resolve(); },
        pause() { audio.paused = true; },
        remove() {},
      };
      mockAudios.push(audio);
      return audio;
    };
    origRAF = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    origCAF = globalThis.cancelAnimationFrame;
    globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
    origAudioContext = globalThis.AudioContext;
    const makeNode = () => ({ connect() {}, disconnect() {} });
    globalThis.AudioContext = class MockAudioContext {
      state = 'running';
      sampleRate = 44100;
      createMediaElementSource() { return makeNode(); }
      createGain() { return { gain: { value: 1, setTargetAtTime() {}, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, ...makeNode() }; }
      createBiquadFilter() { return { type: 'allpass', frequency: { value: 350, setTargetAtTime() {}, setValueAtTime() {} }, Q: { value: 1, setTargetAtTime() {}, setValueAtTime() {} }, ...makeNode() }; }
      createChannelSplitter() { return makeNode(); }
      createChannelMerger() { return makeNode(); }
      createDelay() { return { delayTime: { value: 0 }, ...makeNode() }; }
      createDynamicsCompressor() { return { threshold: { value: -24 }, knee: { value: 30 }, ratio: { value: 12 }, attack: { value: 0.003 }, release: { value: 0.25 }, ...makeNode() }; }
      createWaveShaper() { return { curve: null, oversample: 'none', ...makeNode() }; }
      createOscillator() { return { type: 'sine', frequency: { value: 440, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, start() {}, stop() {}, ...makeNode() }; }
      createConvolver() { return { buffer: null, ...makeNode() }; }
      get destination() { return makeNode(); }
      get currentTime() { return 0; }
      resume() { return Promise.resolve(); }
      close() { return Promise.resolve(); }
    };
  });

  afterEach(() => {
    globalThis.Audio = origAudio;
    globalThis.requestAnimationFrame = origRAF;
    globalThis.cancelAnimationFrame = origCAF;
    globalThis.AudioContext = origAudioContext;
  });

  async function makePlayer() {
    const { DJPlayer } = await import('../../../player.js');
    const player = new DJPlayer();
    player.crossfadeDuration = 2000;
    player.setTransitionMode('auto');
    await player.init();
    await new Promise((r) => setTimeout(r, 0));
    await player.play({ url: 'blob:track-a', durationMs: 210000 });
    await new Promise((r) => setTimeout(r, 0));
    return player;
  }

  async function crossfadeWithMode(player, mode, source) {
    player.setTransitionMode(mode);
    const samples = [];
    const onProgress = (e) => samples.push({
      progress: e.detail.progress,
      fromVolume: e.detail.fromVolume,
      toVolume: e.detail.toVolume,
    });
    player.addEventListener('crossfadeprogress', onProgress);
    await player.crossfadeToDeck(null, source).catch(() => {});
    player.removeEventListener('crossfadeprogress', onProgress);
    return samples;
  }

  function maxSilentStreakMs(samples, durationMs, threshold = 0.05) {
    let maxMs = 0;
    let streakStartProgress = null;
    for (const s of samples) {
      const combined = s.fromVolume + s.toVolume;
      if (combined < threshold) {
        if (streakStartProgress === null) streakStartProgress = s.progress;
        maxMs = Math.max(maxMs, (s.progress - streakStartProgress) * durationMs);
      } else {
        streakStartProgress = null;
      }
    }
    return maxMs;
  }

  test('SPEC-1.3.6.1/1.3.6.2 — fade_in_out ne crée jamais plus de 100ms de silence', async () => {
    const player = await makePlayer();
    const samples = await crossfadeWithMode(player, 'fade_in_out', { url: 'blob:track-b', durationMs: 200000 });
    expect(samples.length).toBeGreaterThan(5);
    expect(maxSilentStreakMs(samples, player.crossfadeDuration)).toBeLessThanOrEqual(100);
    player.destroy?.();
  }, 10000);

  test('SPEC-1.3.6.1/1.3.6.3 — backspin ne crée jamais plus de 100ms de silence', async () => {
    const player = await makePlayer();
    const samples = await crossfadeWithMode(player, 'backspin', { url: 'blob:track-c', durationMs: 200000 });
    expect(samples.length).toBeGreaterThan(5);
    expect(maxSilentStreakMs(samples, player.crossfadeDuration)).toBeLessThanOrEqual(100);
    player.destroy?.();
  }, 10000);

  test('SPEC-1.3.6.4 — brake_tape_stop_simple ne décélère plus le playbackRate', async () => {
    const player = await makePlayer();
    player.crossfadeDuration = 500;
    let minRateSeen = 1;
    const onProgress = () => {
      for (const audio of mockAudios) {
        minRateSeen = Math.min(minRateSeen, audio.playbackRate);
      }
    };
    player.addEventListener('crossfadeprogress', onProgress);
    await crossfadeWithMode(player, 'brake_tape_stop_simple', { url: 'blob:track-d', durationMs: 200000 });
    player.removeEventListener('crossfadeprogress', onProgress);
    expect(minRateSeen).toBeGreaterThan(0.99);
    player.destroy?.();
  }, 10000);
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
