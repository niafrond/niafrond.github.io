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

  // Keep delete identifiers before clearing local routing hints.
  const deleteTarget = {
    cachePath: item.cachePath || '',
    name: item.name || '',
    artist: item.artist || '',
  };

  // Force a fresh orchestration resolve instead of reusing stale local hints.
  item.cachePath = '';
  item.persistedSourceUrl = '';

  try {
    await deleteLocalCacheSong?.(deleteTarget);
  } catch {
    // Best effort: the UI should still attempt a fresh download from the API.
  }

  await ensureLocalSource(item, { forceFreshResolve: true });
  return true;
}
