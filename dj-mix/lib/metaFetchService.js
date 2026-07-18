/**
 * metaFetchService.js
 *
 * Resolves missing BPM/genre metadata for a playlist/queue item: first from the
 * localStorage cache (trackMetaStorage), then by falling back to the search API.
 * See SPECS.md SPEC-3.4.7 / SPEC-3.4.8.
 */

/**
 * @param {object} deps
 * @param {(name: string, artist?: string) => {bpm?: string|number, genre?: string}|null} deps.getStoredTrackMeta
 * @param {(name: string, artist: string|undefined, patch: object) => void} deps.patchStoredTrackMeta
 * @param {(query: string, limit?: number) => Promise<Array<object>>} deps.searchTracksViaApi
 * @param {{ patch: (id: string, fields: object) => boolean }} [deps.trackStore] - registre partagé (cf. SPECS.md §2.6)
 * @param {() => void} [deps.invalidateDeckMetaCache]
 * @param {() => void} [deps.refreshDeckMetaDisplays]
 * @param {() => void} [deps.renderQueueDebounced]
 * @param {() => void} [deps.renderFilRougeDebounced]
 */
export function createMetaFetchService({
  getStoredTrackMeta,
  patchStoredTrackMeta,
  searchTracksViaApi,
  trackStore,
  invalidateDeckMetaCache,
  refreshDeckMetaDisplays,
  renderQueueDebounced,
  renderFilRougeDebounced,
}) {
  // Tracks in-flight meta fetches to avoid duplicate API calls.
  const metaFetchInFlight = new Set();
  // Tracks keys already queried via the API this session, even when no bpm/genre was
  // found, so renderQueue/renderFilRouge re-renders don't keep re-spamming /api/search
  // for tracks the API simply has no data for.
  const metaFetchAttempted = new Set();

  function notifyChanged(item) {
    // Le morceau (qu'il vienne de la Queue ou du Fil Rouge) EST l'enregistrement
    // partagé du trackStore — cette mutation est donc déjà visible des deux côtés ;
    // on la route par trackStore.patch() uniquement pour déclencher sa persistence.
    if (item.id) trackStore?.patch(item.id, { bpm: item.bpm, genre: item.genre });
    invalidateDeckMetaCache?.();
    refreshDeckMetaDisplays?.();
    renderQueueDebounced?.();
    renderFilRougeDebounced?.();
  }

  /**
   * Fetches BPM and/or genre for an item that is missing them.
   * Checks localStorage first, then falls back to the search API.
   * Mutates item in place and triggers a re-render only when bpm/genre actually changed.
   * @param {object} item
   */
  async function fetchMissingMeta(item) {
    if (!item?.name) return;
    if (item.bpm && item.genre) return;
    const key = String(item.id || `${item.artist}::${item.name}`);
    if (metaFetchInFlight.has(key) || metaFetchAttempted.has(key)) return;
    metaFetchInFlight.add(key);
    try {
      // 1. Check localStorage cache
      const stored = getStoredTrackMeta(item.name, item.artist);
      let localChanged = false;
      if (!item.bpm && stored?.bpm) { item.bpm = stored.bpm; localChanged = true; }
      if (!item.genre && stored?.genre) { item.genre = stored.genre; localChanged = true; }
      if (localChanged) notifyChanged(item);
      if (item.bpm && item.genre) return;
      // 2. Mark as attempted before the API call so concurrent/subsequent re-renders
      // don't re-trigger a fetch for a track that will durably stay incomplete.
      metaFetchAttempted.add(key);
      const results = await searchTracksViaApi(`${item.artist} ${item.name}`, 5);
      const hit = results[0];
      if (!hit) return;
      let changed = false;
      if (!item.bpm && hit.bpm) { item.bpm = hit.bpm; changed = true; }
      if (!item.genre && hit.genre) { item.genre = hit.genre; changed = true; }
      if (changed) {
        patchStoredTrackMeta(item.name, item.artist, { bpm: item.bpm, genre: item.genre });
        notifyChanged(item);
      }
    } catch (_) {
    } finally {
      metaFetchInFlight.delete(key);
    }
  }

  return { fetchMissingMeta };
}
