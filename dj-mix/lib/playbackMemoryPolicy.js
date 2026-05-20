export const LOW_MEMORY_PLAYBACK_MAX_RAM_MB = 3072;

export function isLowMemoryPlaybackDevice(capability) {
  const totalRamMb = Number(capability?.totalRamMb) || 0;
  return capability?.enabled === true
    && capability?.mobile === true
    && totalRamMb > 0
    && totalRamMb <= LOW_MEMORY_PLAYBACK_MAX_RAM_MB;
}
