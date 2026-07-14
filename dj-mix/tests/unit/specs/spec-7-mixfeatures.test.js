/**
 * Spec-driven tests for §7 — Effets DJ manuels (MixFeatures)
 * References: SPEC-7.1–7.5
 */
import { describe, test, expect } from '@jest/globals';
import {
  FFT_SIZE,
  SMOOTH_TAU,
  SMOOTH_JS,
  ENERGY_EPSILON,
  DISTORTION_K,
  DISTORTION_WET_MIX,
  DISTORTION_DRY_MIX,
  ECHO_DELAY_S,
  ECHO_FEEDBACK,
  ECHO_WET_MIX,
  ECHO_DRY_MIX,
  STEM_SYNC_INTERVAL_MS,
} from '../../../lib/constants.js';

// ── SPEC-7.2 — Echo constants ───────────────────────────────────────────────

describe('SPEC-7.2 — Echo constants', () => {
  test('SPEC-7.2.1 — delay is 0.22s (220ms)', () => {
    expect(ECHO_DELAY_S).toBe(0.22);
  });

  test('SPEC-7.2.1 — feedback is 0.28', () => {
    expect(ECHO_FEEDBACK).toBe(0.28);
  });

  test('SPEC-7.2.2 — wet mix is 0.28', () => {
    expect(ECHO_WET_MIX).toBe(0.28);
  });

  test('SPEC-7.2.2 — dry mix is 0.9', () => {
    expect(ECHO_DRY_MIX).toBe(0.9);
  });
});

// ── SPEC-7.3 — Distortion constants ────────────────────────────────────────

describe('SPEC-7.3 — Distortion constants', () => {
  test('SPEC-7.3.1 — K parameter is 140', () => {
    expect(DISTORTION_K).toBe(140);
  });

  test('SPEC-7.3.2 — wet mix is 0.36, dry mix is 0.84', () => {
    expect(DISTORTION_WET_MIX).toBe(0.36);
    expect(DISTORTION_DRY_MIX).toBe(0.84);
  });
});

// ── SPEC-7.5 — Audio analysis constants ─────────────────────────────────────

describe('SPEC-7.5 — Audio analysis', () => {
  test('SPEC-7.5.1 — FFT size is 1024', () => {
    expect(FFT_SIZE).toBe(1024);
  });

  test('SPEC-7.5.2 — energy epsilon is 1e-4', () => {
    expect(ENERGY_EPSILON).toBe(1e-4);
  });

  test('SPEC-7.5.3 — JS smoothing alpha is 0.34', () => {
    expect(SMOOTH_JS).toBe(0.34);
  });

  test('AudioParam smoothing tau is 0.08s', () => {
    expect(SMOOTH_TAU).toBe(0.08);
  });
});

// ── SPEC-7.1 — Stems constants ──────────────────────────────────────────────

describe('SPEC-7.1 — Stems sync', () => {
  test('SPEC-7.1.4 — sync interval is 2500ms', () => {
    expect(STEM_SYNC_INTERVAL_MS).toBe(2500);
  });
});
