// djTransitionMapping.js — Pure helpers mapping the DJ planner API (`/api/dj/*`)
// transition vocabulary onto this app's automix primitives.

import { normalizeTransitionMode } from './transitionModes.js';

/**
 * Maps each `transitionType` returned by `POST /api/dj/transition` to the
 * closest existing automix transition mode.
 */
export const DJ_TRANSITION_TYPE_TO_MODE = Object.freeze({
  phrase_mix: 'crossfade_logarithmic',
  long_blend: 'crossfade_linear',
  quick_cut: 'cut_transition',
  drop_swap: 'filter_sweep_low_high',
  echo_out: 'echo_out_light',
});

/**
 * @param {string|null|undefined} transitionType
 * @returns {string|null} a value from MIX_TRANSITION_MODES, or null if unknown
 */
export function mapDjTransitionTypeToMode(transitionType) {
  const mode = DJ_TRANSITION_TYPE_TO_MODE[transitionType];
  if (!mode) return null;
  return normalizeTransitionMode(mode);
}

const DEFAULT_MIN_RATE = 0.85;
const DEFAULT_MAX_RATE = 1.15;

/**
 * Computes a playback-rate ratio to align `nextTrackBpm` onto `recommendedBpm`,
 * bounded to a safe pitch range.
 * @returns {number|null} ratio for player.setDeckPlaybackRate, or null if inputs are invalid
 */
export function computeDjBpmRate(recommendedBpm, nextTrackBpm, options = {}) {
  const { minRate = DEFAULT_MIN_RATE, maxRate = DEFAULT_MAX_RATE } = options;
  const target = Number(recommendedBpm);
  const base = Number(nextTrackBpm);
  if (!Number.isFinite(target) || target <= 0) return null;
  if (!Number.isFinite(base) || base <= 0) return null;

  const rate = target / base;
  if (!Number.isFinite(rate) || rate <= 0) return null;

  return Math.min(maxRate, Math.max(minRate, rate));
}

const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Checks that a stored `djTransition` still points at `toItemId` and was
 * computed recently enough to be trusted.
 * @param {object|null|undefined} djTransition
 * @param {string|number|null|undefined} toItemId
 * @param {number} [maxAgeMs]
 * @returns {boolean}
 */
export function isDjTransitionFresh(djTransition, toItemId, maxAgeMs = DEFAULT_MAX_AGE_MS) {
  if (!djTransition || toItemId == null) return false;
  if (String(djTransition.toItemId) !== String(toItemId)) return false;
  const computedAt = Number(djTransition.computedAt);
  if (!Number.isFinite(computedAt)) return false;
  return (Date.now() - computedAt) <= maxAgeMs;
}
