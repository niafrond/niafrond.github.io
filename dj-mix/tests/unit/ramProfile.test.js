import {
  computeTransitionRamProfile,
  estimateTotalDeviceRamMb,
  isMobileDevice,
} from '../../lib/ramProfile.js';

describe('ramProfile', () => {
  test('isMobileDevice detects coarse touch compact screens', () => {
    const mobile = isMobileDevice({
      navigator: { userAgent: 'Mozilla/5.0', vendor: '' },
      window: {
        innerWidth: 430,
        innerHeight: 932,
        matchMedia: () => ({ matches: true }),
      },
    });
    expect(mobile).toBe(true);
  });

  test('estimateTotalDeviceRamMb falls back from core count', () => {
    expect(estimateTotalDeviceRamMb({ hardwareConcurrency: 2 })).toBe(1536);
    expect(estimateTotalDeviceRamMb({ hardwareConcurrency: 8 })).toBe(4096);
  });

  test('computeTransitionRamProfile disables filter when not applicable', () => {
    const profile = computeTransitionRamProfile({
      ramFilterEnabled: true,
      ramTotalMbOverride: 0,
      crossfadeDurationMs: 6000,
      mobile: false,
    });
    expect(profile.capability.enabled).toBe(false);
    expect(profile.allowedTransitionModes.length).toBeGreaterThan(0);
  });
});
