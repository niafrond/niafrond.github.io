import {
  MIX_TRANSITION_MODES,
  getAllowedTransitionModesForRam,
  getTransitionRamRequirementMb,
  normalizeTransitionMode,
} from '../../lib/transitionModes.js';

describe('transitionModes', () => {
  test('normalizeTransitionMode falls back to auto for unknown values', () => {
    expect(normalizeTransitionMode('unknown_mode')).toBe('auto');
    expect(normalizeTransitionMode('crossfade_linear')).toBe('crossfade_linear');
  });

  test('getTransitionRamRequirementMb returns number for all known modes', () => {
    for (const mode of MIX_TRANSITION_MODES) {
      expect(typeof getTransitionRamRequirementMb(mode)).toBe('number');
    }
  });

  test('RAM filter always keeps auto and cut_transition', () => {
    const allowed = getAllowedTransitionModesForRam(1, { crossfadeDurationMs: 12000 });
    expect(allowed).toContain('auto');
    expect(allowed).toContain('cut_transition');
  });
});
