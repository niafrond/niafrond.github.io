/**
 * Spec-driven tests for §6 — Auto FX
 * References: SPEC-6.1–6.3
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  AUTO_DJ_FX_CONFIG,
  AUTO_DJ_FX_TYPES,
  canTriggerAutoDjFx,
  createDefaultAutoDjFxAllowed,
  getSafeAutoDjFxMinIntervalSec,
  getSafeAutoDjFxMaxIntervalSec,
  isAutoDjFxTypeAllowed,
  normalizeAutoDjFxSettings,
  normalizeAutoDjFxIntervalSettings,
  readAutoDjFxSettings,
  persistAutoDjFxSettings,
} from '../../../lib/autoDjFxManager.js';
import {
  DANCE_MODE_MIN_INTERVAL_SEC,
  DANCE_MODE_MAX_INTERVAL_SEC,
  MUSIC_MODE_LOW_BPM_THRESHOLD,
  MUSIC_MODE_LOW_MIN_INTERVAL,
  MUSIC_MODE_LOW_MAX_INTERVAL,
  MUSIC_MODE_NORM_MIN_INTERVAL,
  MUSIC_MODE_NORM_MAX_INTERVAL,
} from '../../../lib/constants.js';

beforeEach(() => {
  localStorage.clear();
});

// ── SPEC-6.1 — 17 effect types ──────────────────────────────────────────────

describe('SPEC-6.1 — Effect catalogue', () => {
  test('exactly 16 types exist', () => {
    expect(AUTO_DJ_FX_TYPES).toHaveLength(16);
  });

  const expectedTypes = [
    'filter', 'lowPass', 'highPass', 'echoDelay', 'reverb',
    'roll', 'loop', 'beatRepeat', 'brake', 'backspin', 'noise',
    'eq', 'keyShift', 'scratching', 'hotCues', 'sampling',
  ];

  test.each(expectedTypes)('type "%s" is registered', (type) => {
    expect(AUTO_DJ_FX_TYPES).toContain(type);
  });

  test('flangerPhaser is removed (no longer a registered type)', () => {
    expect(AUTO_DJ_FX_TYPES).not.toContain('flangerPhaser');
  });

  test('each type has a config entry', () => {
    for (const type of AUTO_DJ_FX_TYPES) {
      expect(AUTO_DJ_FX_CONFIG).toHaveProperty(type);
      expect(AUTO_DJ_FX_CONFIG[type]).toHaveProperty('label');
      expect(AUTO_DJ_FX_CONFIG[type]).toHaveProperty('category');
    }
  });

  test('hotCues and reverb are OFF by default', () => {
    const defaults = createDefaultAutoDjFxAllowed();
    expect(defaults.hotCues).toBe(false);
    expect(defaults.reverb).toBe(false);
  });

  test('all other types are ON by default', () => {
    const defaults = createDefaultAutoDjFxAllowed();
    const alwaysOn = AUTO_DJ_FX_TYPES.filter((t) => t !== 'hotCues' && t !== 'reverb');
    for (const type of alwaysOn) {
      expect(defaults[type]).toBe(true);
    }
  });
});

// ── SPEC-6.2 — Triggering conditions ────────────────────────────────────────

describe('SPEC-6.2 — canTriggerAutoDjFx', () => {
  test('SPEC-6.2.1 — rejects when globally disabled', () => {
    const settings = normalizeAutoDjFxSettings({ enabled: false });
    const result = canTriggerAutoDjFx({ type: 'filter' }, settings, 0, 5000);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('disabled');
  });

  test('SPEC-6.2.1 — rejects missing type', () => {
    const settings = normalizeAutoDjFxSettings({});
    const result = canTriggerAutoDjFx({}, settings, 0, 5000);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('missing-type');
  });

  test('SPEC-6.2.1 — rejects disallowed type', () => {
    const settings = normalizeAutoDjFxSettings({ allowed: { echoDelay: false } });
    const result = canTriggerAutoDjFx({ type: 'echoDelay' }, settings, 0, 5000);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('not-allowed');
  });

  test('SPEC-6.2.1 — rejects when min-interval not elapsed', () => {
    const settings = normalizeAutoDjFxSettings({ minIntervalSec: 10 });
    const result = canTriggerAutoDjFx({ type: 'filter' }, settings, 1000, 5000);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('min-interval');
  });

  test('SPEC-6.2.1 — allows when all conditions met', () => {
    const settings = normalizeAutoDjFxSettings({ minIntervalSec: 5 });
    const result = canTriggerAutoDjFx({ type: 'filter' }, settings, 0, 10_000);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('ok');
  });

  test('allows first trigger when lastTriggeredAtMs is 0', () => {
    const settings = normalizeAutoDjFxSettings({ minIntervalSec: 10 });
    const result = canTriggerAutoDjFx({ type: 'filter' }, settings, 0, 1000);
    expect(result.allowed).toBe(true);
  });
});

// ── SPEC-6.2.2 — Interval bounds ────────────────────────────────────────────

describe('SPEC-6.2.2 — Interval bounds', () => {
  test('min interval: 0/falsy → default 14, negative → clamped to 1, over 180 → 180', () => {
    // 0 is falsy → falls back to default 14
    expect(getSafeAutoDjFxMinIntervalSec(0)).toBe(14);
    // -5 is truthy but negative → clamped to 1
    expect(getSafeAutoDjFxMinIntervalSec(-5)).toBe(1);
    // Over max → clamped to 180
    expect(getSafeAutoDjFxMinIntervalSec(200)).toBe(180);
    // Valid values pass through
    expect(getSafeAutoDjFxMinIntervalSec(50)).toBe(50);
    expect(getSafeAutoDjFxMinIntervalSec(1)).toBe(1);
  });

  test('max interval clamped to 3–300', () => {
    expect(getSafeAutoDjFxMaxIntervalSec(1)).toBe(3);
    expect(getSafeAutoDjFxMaxIntervalSec(500)).toBe(300);
    expect(getSafeAutoDjFxMaxIntervalSec(100)).toBe(100);
  });

  test('normalization ensures min ≤ max', () => {
    const result = normalizeAutoDjFxIntervalSettings(50, 20);
    expect(result.minIntervalSec).toBeLessThanOrEqual(result.maxIntervalSec);
  });

  test('defaults: min=14, max=45', () => {
    const settings = normalizeAutoDjFxSettings({});
    expect(settings.minIntervalSec).toBe(14);
    expect(settings.maxIntervalSec).toBe(45);
  });
});

// ── SPEC-6.3 — DJ mode intervals ────────────────────────────────────────────

describe('SPEC-6.3 — DJ mode interval constants', () => {
  test('SPEC-6.3.1 — Dance mode: 8–20s', () => {
    expect(DANCE_MODE_MIN_INTERVAL_SEC).toBe(8);
    expect(DANCE_MODE_MAX_INTERVAL_SEC).toBe(20);
  });

  test('SPEC-6.3.2 — Music mode low BPM threshold: 90', () => {
    expect(MUSIC_MODE_LOW_BPM_THRESHOLD).toBe(90);
  });

  test('SPEC-6.3.2 — Music mode low BPM: 40–120s', () => {
    expect(MUSIC_MODE_LOW_MIN_INTERVAL).toBe(40);
    expect(MUSIC_MODE_LOW_MAX_INTERVAL).toBe(120);
  });

  test('SPEC-6.3.3 — Music mode normal: 20–60s', () => {
    expect(MUSIC_MODE_NORM_MIN_INTERVAL).toBe(20);
    expect(MUSIC_MODE_NORM_MAX_INTERVAL).toBe(60);
  });
});

// ── Settings persistence ────────────────────────────────────────────────────

describe('SPEC-6.2 — Settings persistence roundtrip', () => {
  test('read/persist roundtrip', () => {
    const settings = normalizeAutoDjFxSettings({
      minIntervalSec: 8,
      maxIntervalSec: 30,
      allowed: { echoDelay: false, reverb: true },
    });
    persistAutoDjFxSettings(settings);
    const restored = readAutoDjFxSettings();
    expect(restored.minIntervalSec).toBe(8);
    expect(restored.maxIntervalSec).toBe(30);
    expect(isAutoDjFxTypeAllowed(restored, 'echoDelay')).toBe(false);
    expect(isAutoDjFxTypeAllowed(restored, 'reverb')).toBe(true);
  });
});
