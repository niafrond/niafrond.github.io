import { isLowMemoryPlaybackDevice, LOW_MEMORY_PLAYBACK_MAX_RAM_MB } from '../../lib/playbackMemoryPolicy.js';

describe('playbackMemoryPolicy', () => {
  test('detects constrained mobile playback devices', () => {
    expect(isLowMemoryPlaybackDevice({
      enabled: true,
      mobile: true,
      totalRamMb: LOW_MEMORY_PLAYBACK_MAX_RAM_MB,
    })).toBe(true);
  });

  test('ignores desktops and higher-memory devices', () => {
    expect(isLowMemoryPlaybackDevice({
      enabled: true,
      mobile: false,
      totalRamMb: 2048,
    })).toBe(false);

    expect(isLowMemoryPlaybackDevice({
      enabled: true,
      mobile: true,
      totalRamMb: LOW_MEMORY_PLAYBACK_MAX_RAM_MB + 1024,
    })).toBe(false);
  });
});
