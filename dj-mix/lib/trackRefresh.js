export async function refreshQueueTrack(item, deps = {}) {
  if (!item?.name) return null;

  const {
    refreshMixData = async () => null,
    evictTrackSource = () => false,
    deleteLocalCacheSong = async () => {},
    ensureLocalSource = async () => '',
  } = deps;

  await refreshMixData(item.name, item.artist).catch(() => null);
  evictTrackSource?.(item, { notify: true });

  try {
    await deleteLocalCacheSong?.(item);
  } catch {
    // Best effort: the UI should still attempt a fresh download from the API.
  }

  await ensureLocalSource(item);
  return true;
}
