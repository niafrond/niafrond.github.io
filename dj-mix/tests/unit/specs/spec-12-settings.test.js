/**
 * Spec-driven tests for §12 — Paramètres (Settings)
 * References: SPEC-12.1–12.3
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { STORAGE_KEYS } from '../../../lib/storageKeys.js';
import {
  readCrossfadeSecondsSetting,
  readTrackMaxDurationSetting,
  readTrackMaxDurationEnabledSetting,
  readTrackMaxDurationModeSetting,
  readTrackMaxDurationPctSetting,
  readRamFilterEnabledSetting,
  readRamTotalMbOverrideSetting,
  readDjModeSetting,
  readQueueLoopSetting,
  readQueueShuffleSetting,
  persistCrossfadeSecondsSetting,
  persistTrackMaxDurationSetting,
  persistTrackMaxDurationEnabledSetting,
  persistRamTotalMbOverrideSetting,
  readDisabledTransitionModesSetting,
  persistDisabledTransitionModesSetting,
} from '../../../lib/settingsStorage.js';
import { MIX_TRANSITION_MODES } from '../../../lib/transitionModes.js';
import {
  TRACK_MAX_DURATION_MIN_SEC,
  TRACK_MAX_DURATION_MAX_SEC,
  TRACK_MAX_DURATION_PCT_MIN,
  TRACK_MAX_DURATION_PCT_MAX,
  RAM_MIN_MB,
  RAM_MAX_MB,
} from '../../../lib/constants.js';

beforeEach(() => {
  localStorage.clear();
});

// ── SPEC-12.1 — Storage keys exist ──────────────────────────────────────────

describe('SPEC-12.1 — Storage keys centralized', () => {
  test('STORAGE_KEYS is frozen', () => {
    expect(Object.isFrozen(STORAGE_KEYS)).toBe(true);
  });

  const requiredKeys = [
    'queue', 'filRouge', 'crossfadeSeconds', 'mixTransitionMode',
    'trackMaxDuration', 'trackMaxDurationEnabled', 'trackMaxDurationMode',
    'trackMaxDurationPct', 'ramFilterEnabled', 'ramTotalMbOverride',
    'autoDjFxSettings', 'queueLoop', 'queueShuffle', 'disabledTransitionModes',
    'djMode', 'djModeGenrePrefs',
    'spotifyClientId', 'spotifyAuth', 'spotifyFilRougeSource',
    'relayMode', 'relayMasterId',
  ];

  test.each(requiredKeys)('key "%s" exists', (key) => {
    expect(STORAGE_KEYS).toHaveProperty(key);
    expect(typeof STORAGE_KEYS[key]).toBe('string');
  });

  test('all keys have dj-mix: prefix', () => {
    for (const value of Object.values(STORAGE_KEYS)) {
      expect(value).toMatch(/^dj-mix:/);
    }
  });
});

// ── SPEC-12.3 — Bounds and defaults ─────────────────────────────────────────

describe('SPEC-12.3 — Bounds constants', () => {
  test('track max duration bounds: 0–600', () => {
    expect(TRACK_MAX_DURATION_MIN_SEC).toBe(0);
    expect(TRACK_MAX_DURATION_MAX_SEC).toBe(600);
  });

  test('track max duration pct bounds: 5–95', () => {
    expect(TRACK_MAX_DURATION_PCT_MIN).toBe(5);
    expect(TRACK_MAX_DURATION_PCT_MAX).toBe(95);
  });

  test('RAM override bounds: 512–32768', () => {
    expect(RAM_MIN_MB).toBe(512);
    expect(RAM_MAX_MB).toBe(32_768);
  });
});

describe('SPEC-12.3 — Default values', () => {
  test('crossfade default: 6s', () => {
    expect(readCrossfadeSecondsSetting()).toBe(6);
  });

  test('track max duration default: 0 (disabled)', () => {
    expect(readTrackMaxDurationSetting()).toBe(0);
  });

  test('track max duration mode default: sec', () => {
    expect(readTrackMaxDurationModeSetting()).toBe('sec');
  });

  test('track max duration pct default: 50', () => {
    expect(readTrackMaxDurationPctSetting()).toBe(50);
  });

  test('RAM filter default: enabled', () => {
    expect(readRamFilterEnabledSetting()).toBe(true);
  });

  test('DJ mode default: music', () => {
    expect(readDjModeSetting()).toBe('music');
  });

  test('queue loop default: false', () => {
    expect(readQueueLoopSetting()).toBe(false);
  });

  test('queue shuffle default: false', () => {
    expect(readQueueShuffleSetting()).toBe(false);
  });

  test('disabled transition modes default: empty array', () => {
    expect(readDisabledTransitionModesSetting(MIX_TRANSITION_MODES)).toEqual([]);
  });
});

// ── SPEC-12.3 — Persistence roundtrip ──────────────────────────────────────

describe('SPEC-12.3 — Persistence roundtrip', () => {
  test('crossfade persist/read', () => {
    persistCrossfadeSecondsSetting(12);
    // readCrossfadeSecondsSetting returns raw localStorage value (string)
    expect(Number(readCrossfadeSecondsSetting())).toBe(12);
  });

  test('track max duration persist/read', () => {
    persistTrackMaxDurationSetting(120);
    expect(readTrackMaxDurationSetting()).toBe(120);
  });

  test('track max duration enabled persist/read', () => {
    persistTrackMaxDurationEnabledSetting(true);
    expect(readTrackMaxDurationEnabledSetting(false)).toBe(true);
    persistTrackMaxDurationEnabledSetting(false);
    expect(readTrackMaxDurationEnabledSetting(true)).toBe(false);
  });

  test('RAM override clamped on read', () => {
    persistRamTotalMbOverrideSetting(100);
    expect(readRamTotalMbOverrideSetting()).toBe(512); // clamped to min

    persistRamTotalMbOverrideSetting(99999);
    expect(readRamTotalMbOverrideSetting()).toBe(32768); // clamped to max

    persistRamTotalMbOverrideSetting(4096);
    expect(readRamTotalMbOverrideSetting()).toBe(4096); // in range
  });

  test('disabled transition modes persist/read roundtrip', () => {
    persistDisabledTransitionModesSetting(['beat_repeat', 'backspin']);
    expect(readDisabledTransitionModesSetting(MIX_TRANSITION_MODES)).toEqual(['beat_repeat', 'backspin']);
  });

  test('disabled transition modes: unknown/invalid modes are filtered out on read', () => {
    persistDisabledTransitionModesSetting(['beat_repeat', 'not_a_real_mode', 42]);
    expect(readDisabledTransitionModesSetting(MIX_TRANSITION_MODES)).toEqual(['beat_repeat']);
  });

  test('disabled transition modes: corrupted storage value falls back to empty array', () => {
    localStorage.setItem(STORAGE_KEYS.disabledTransitionModes, '{not json');
    expect(readDisabledTransitionModesSetting(MIX_TRANSITION_MODES)).toEqual([]);
  });
});
