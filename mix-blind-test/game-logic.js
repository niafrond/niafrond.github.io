function toFiniteBpm(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function sortPairIds(aId, bId) {
  return String(aId) < String(bId) ? [String(aId), String(bId)] : [String(bId), String(aId)];
}

export function makePairKey(trackA, trackB) {
  if (!trackA?.id || !trackB?.id) return '';
  const [left, right] = sortPairIds(trackA.id, trackB.id);
  return `${left}__${right}`;
}

export function chooseRoundPair(
  tracks,
  usedPairKeys = new Set(),
  difficultMode = false,
  rng = Math.random,
  excludedTrackIds = new Set(),
) {
  if (!Array.isArray(tracks) || tracks.length < 2) return null;

  const candidates = [];
  for (let i = 0; i < tracks.length - 1; i += 1) {
    for (let j = i + 1; j < tracks.length; j += 1) {
      const left = tracks[i];
      const right = tracks[j];
      if (excludedTrackIds.has(left.id) || excludedTrackIds.has(right.id)) continue;
      const key = makePairKey(left, right);
      if (!key || usedPairKeys.has(key)) continue;
      const leftBpm = toFiniteBpm(left.bpm);
      const rightBpm = toFiniteBpm(right.bpm);
      const bpmGap = leftBpm != null && rightBpm != null ? Math.abs(leftBpm - rightBpm) : Number.POSITIVE_INFINITY;
      candidates.push({ left, right, key, bpmGap });
    }
  }

  if (!candidates.length) return null;

  if (difficultMode) {
    return candidates[Math.floor(rng() * candidates.length)];
  }

  candidates.sort((a, b) => a.bpmGap - b.bpmGap);
  const bestGap = candidates[0].bpmGap;
  const finalists = candidates.filter((item) => item.bpmGap === bestGap);
  return finalists[Math.floor(rng() * finalists.length)];
}

export function pruneStemCacheEntries(entries, { maxBytes = 180 * 1024 * 1024, maxEntries = 24 } = {}) {
  const sorted = (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry && entry.key)
    .map((entry) => ({
      key: String(entry.key),
      size: Math.max(0, Number(entry.size) || 0),
      lastUsedAt: Number(entry.lastUsedAt) || 0,
    }))
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt);

  let totalBytes = 0;
  const kept = [];
  const evicted = [];

  for (const entry of sorted) {
    const wouldExceedEntries = kept.length >= maxEntries;
    const wouldExceedBytes = totalBytes + entry.size > maxBytes;
    if (wouldExceedEntries || wouldExceedBytes) {
      evicted.push(entry);
      continue;
    }
    kept.push(entry);
    totalBytes += entry.size;
  }

  return { kept, evicted, totalBytes };
}

export function isServerTracksCacheFresh(cached, { ttlMs = 5 * 60 * 1000, now = Date.now() } = {}) {
  if (!cached || !Array.isArray(cached.tracks)) return false;
  return now - (cached.fetchedAt || 0) <= ttlMs;
}

export function pickRandomTracks(tracks, count = 1, rng = Math.random) {
  const pool = Array.isArray(tracks) ? [...tracks] : [];
  if (!pool.length) return [];

  const requested = Math.floor(Number(count));
  const take = Math.min(pool.length, Number.isFinite(requested) && requested > 0 ? requested : 1);

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }

  return pool.slice(0, take);
}
