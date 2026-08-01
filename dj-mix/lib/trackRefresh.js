export async function refreshQueueTrack(item, deps = {}) {
  if (!item?.name) return null;

  const {
    redownloadTrack = async () => false,
    evictTrackSource = () => false,
    ensureLocalSource = async () => '',
  } = deps;

  const redownloaded = await redownloadTrack(item);
  if (!redownloaded) return false;

  // Only touch local caches once the server confirms the fresh file is in
  // place — evicting on a failed/timed-out redownload would leave a track
  // that was already playing fine without a valid local source for nothing.
  evictTrackSource?.(item, { notify: true });

  // Force a fresh orchestration resolve instead of reusing stale local hints.
  item.persistedSourceUrl = '';

  await ensureLocalSource(item, { forceFreshResolve: true });
  return true;
}
