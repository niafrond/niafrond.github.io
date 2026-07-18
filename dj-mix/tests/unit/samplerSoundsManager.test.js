import {
  SAMPLER_SOUND_IDS,
  isSamplerSoundAllowed,
  normalizeSamplerSoundsSettings,
  persistSamplerSoundsSettings,
  readSamplerSoundsSettings,
} from '../../lib/samplerSoundsManager.js';

describe('samplerSoundsManager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('normalization keeps all samples allowed by default', () => {
    const settings = normalizeSamplerSoundsSettings({});
    expect(Object.keys(settings.allowed)).toEqual(expect.arrayContaining(SAMPLER_SOUND_IDS));
    for (const id of SAMPLER_SOUND_IDS) {
      expect(isSamplerSoundAllowed(settings, id)).toBe(true);
    }
  });

  test('read/persist roundtrip settings', () => {
    const next = normalizeSamplerSoundsSettings({ allowed: { airhorn: false } });
    persistSamplerSoundsSettings(next);
    const restored = readSamplerSoundsSettings();
    expect(restored.allowed.airhorn).toBe(false);
    expect(isSamplerSoundAllowed(restored, 'airhorn')).toBe(false);
    expect(isSamplerSoundAllowed(restored, 'stab')).toBe(true);
  });

  test('isSamplerSoundAllowed returns false for empty id', () => {
    const settings = normalizeSamplerSoundsSettings({});
    expect(isSamplerSoundAllowed(settings, '')).toBe(false);
  });
});
