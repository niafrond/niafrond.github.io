import { jest } from '@jest/globals';
import {
  getOrCreateRelayMasterId,
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

  describe('getOrCreateRelayMasterId', () => {
    test('generates an id once and reuses it across calls (survives reload)', () => {
      const id = getOrCreateRelayMasterId();
      expect(id).toMatch(/^[0-9A-Z]{6}$/);
      expect(getOrCreateRelayMasterId()).toBe(id);
      expect(localStorage.getItem(STORAGE_KEYS.relayMasterId)).toBe(id);
    });

    test('requests persistent storage on first generation to reduce eviction risk', () => {
      const persist = jest.fn();
      navigator.storage = { persist };

      getOrCreateRelayMasterId();
      expect(persist).toHaveBeenCalledTimes(1);

      persist.mockClear();
      getOrCreateRelayMasterId();
      expect(persist).not.toHaveBeenCalled();

      delete navigator.storage;
    });

    test('does not throw when navigator.storage is unavailable', () => {
      delete navigator.storage;
      expect(() => getOrCreateRelayMasterId()).not.toThrow();
    });
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
