import {
  persistRamTotalMbOverrideSetting,
  persistTrackMaxDurationSetting,
  persistTrackMaxDurationEnabledSetting,
  readRamTotalMbOverrideSetting,
  readTrackMaxDurationEnabledSetting,
  readTrackMaxDurationSetting,
} from '../../lib/settingsStorage.js';
import { STORAGE_KEYS } from '../../lib/storageKeys.js';

describe('settingsStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('track max duration read/write handles bounds', () => {
    persistTrackMaxDurationSetting(120);
    expect(readTrackMaxDurationSetting()).toBe(120);

    localStorage.setItem(STORAGE_KEYS.trackMaxDuration, '12');
    expect(readTrackMaxDurationSetting()).toBe(0);
  });

  test('track max duration enabled uses fallback and persistence', () => {
    expect(readTrackMaxDurationEnabledSetting(true)).toBe(true);
    persistTrackMaxDurationEnabledSetting(false);
    expect(readTrackMaxDurationEnabledSetting(true)).toBe(false);
  });

  test('RAM override is clamped', () => {
    persistRamTotalMbOverrideSetting(128);
    expect(readRamTotalMbOverrideSetting()).toBe(512);

    localStorage.setItem(STORAGE_KEYS.ramTotalMbOverride, '4096');
    expect(readRamTotalMbOverrideSetting()).toBe(4096);

    localStorage.setItem(STORAGE_KEYS.ramTotalMbOverride, '999999');
    expect(readRamTotalMbOverrideSetting()).toBe(32768);
  });
});
