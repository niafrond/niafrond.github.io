// djPlanManager.js — Coordinates the DJ planner API (`/api/dj/*`) with the
// fil rouge playlist: resolves trackIds, computes per-edge transition plans
// (mémoïsés via djTransition.computedAt), exposes the global set quality,
// set-profile selection and feedback/iconic passthroughs.
//
// All public methods are safe to call even when the DJ API is offline or a
// track can't be resolved — they resolve to null/no-op rather than throwing,
// so callers can always fall back to the existing heuristics.

import { STORAGE_KEYS } from './storageKeys.js';
import { mapDjTransitionTypeToMode, isDjTransitionFresh } from './djTransitionMapping.js';

const DEFAULT_SET_PROFILE = 'club_peak';

export function createDjPlanManager({ djApiClient, getFilRougeManager, getQueue, logger } = {}) {
  /** @type {Array} cached `TrackSummary[]` from `/api/dj/tracks` */
  let trackSummaries = [];
  let trackSummariesLoadedAt = 0;

  /** @type {{profiles: Array, default: string}|null} */
  let setProfilesCache = null;

  function filRouge() {
    return getFilRougeManager?.();
  }

  function basename(path) {
    if (!path) return '';
    const normalized = String(path).replace(/\\/g, '/');
    const idx = normalized.lastIndexOf('/');
    return idx >= 0 ? normalized.slice(idx + 1) : normalized;
  }

  function normalizeForMatch(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  /**
   * Refreshes the in-memory `TrackSummary[]` cache from `/api/dj/tracks`.
   * @param {{force?: boolean}} [options]
   * @returns {Promise<Array>}
   */
  async function ensureTrackSummaries({ force = false } = {}) {
    if (!force && trackSummariesLoadedAt) return trackSummaries;
    const tracks = await djApiClient.fetchTracks();
    if (Array.isArray(tracks) && tracks.length) {
      trackSummaries = tracks;
      trackSummariesLoadedAt = Date.now();
    } else if (force) {
      trackSummaries = [];
    }
    return trackSummaries;
  }

  /**
   * Pure lookup of a FilRougeItem against the cached `TrackSummary[]`.
   * Does not mutate the item. Returns `null` if nothing matches.
   * @param {object} item
   * @returns {{trackId: string, hasFullAnalysis: boolean}|null}
   */
  function matchTrackSummary(item) {
    if (!item || !trackSummaries.length) return null;

    const candidates = [];
    if (item.cachePath) {
      candidates.push(item.cachePath);
      const base = basename(item.cachePath);
      if (base && base !== item.cachePath) candidates.push(base);
    }
    if (item.ratingKey) candidates.push(item.ratingKey);

    for (const candidate of candidates) {
      const match = trackSummaries.find((t) => t.trackId === candidate);
      if (match) return { trackId: match.trackId, hasFullAnalysis: Boolean(match.hasFullAnalysis) };
    }

    const normalizedName = normalizeForMatch(item.name);
    const normalizedArtist = normalizeForMatch(item.artist);
    if (normalizedName || normalizedArtist) {
      const match = trackSummaries.find((t) =>
        normalizeForMatch(t.trackName) === normalizedName
        && normalizeForMatch(t.artistName) === normalizedArtist);
      if (match) return { trackId: match.trackId, hasFullAnalysis: Boolean(match.hasFullAnalysis) };
    }

    logger?.debug?.('djPlan.resolveTrackId.notFound', {
      id: item.id, name: item.name, artist: item.artist, cachePath: item.cachePath,
    });
    return null;
  }

  /**
   * @param {object} item
   * @returns {Promise<{trackId: string, hasFullAnalysis: boolean}|null>}
   */
  async function resolveTrackIdForItem(item) {
    if (!item) return null;
    await ensureTrackSummaries();
    return matchTrackSummary(item);
  }

  /**
   * Resolves trackIds for a batch of items and persists `djTrackId`/`djHasAnalysis`
   * on each (via `patchPlaylistItem`, only when changed).
   * @param {Array} items
   * @returns {Promise<Map<string|number, {trackId: string, hasFullAnalysis: boolean}|null>>}
   */
  async function resolveTrackIdsForItems(items) {
    const results = new Map();
    if (!Array.isArray(items) || !items.length) return results;

    const fr = filRouge();
    await ensureTrackSummaries();

    for (const item of items) {
      const resolution = matchTrackSummary(item);
      results.set(item.id, resolution);

      const nextDjTrackId = resolution ? resolution.trackId : null;
      const nextDjHasAnalysis = resolution ? Boolean(resolution.hasFullAnalysis) : false;
      if (item.djTrackId !== nextDjTrackId || Boolean(item.djHasAnalysis) !== nextDjHasAnalysis) {
        fr?.patchPlaylistItem(item.id, { djTrackId: nextDjTrackId, djHasAnalysis: nextDjHasAnalysis });
      }
    }

    return results;
  }

  /**
   * Computes `/api/dj/transition` for each `{from, to}` edge whose `from.djTransition`
   * isn't already fresh for `to.id`, and persists the result on `from.djTransition`.
   * Skips edges where either side has no resolved/analysed trackId.
   * @param {Array<{from: object, to: object}>} edges
   */
  async function computeAndPersistEdges(edges) {
    const fr = filRouge();
    if (!fr || !Array.isArray(edges) || !edges.length) return;

    for (const { from, to } of edges) {
      if (!from || !to) continue;
      if (isDjTransitionFresh(from.djTransition, to.id)) continue;
      if (!from.djTrackId || !to.djTrackId || !from.djHasAnalysis || !to.djHasAnalysis) continue;

      const result = await djApiClient.fetchTransition(from.djTrackId, to.djTrackId);
      if (!result) continue;

      if (!Number.isFinite(result.mixOutSec) || !Number.isFinite(result.mixInSec)) {
        logger?.warn('djPlanManager: mixOutSec/mixInSec manquants dans la réponse API', {
          fromTrackId: from.djTrackId,
          toTrackId: to.djTrackId,
          rawResult: result,
        });
      }

      fr.patchPlaylistItem(from.id, {
        djTransition: {
          toItemId: to.id,
          transitionType: result.transitionType,
          mixOutSec: result.mixOutSec,
          mixInSec: result.mixInSec,
          recommendedBpm: result.recommendedBpm,
          crossfadeDurationSec: result.crossfadeDurationSec,
          compatibilityScore: result.compatibilityScore,
          decisionId: result.decisionId,
          computedAt: Date.now(),
        },
      });
    }
  }

  /**
   * Computes only the edges introduced by newly-added items, preserving the
   * existing fil rouge order: (predecessor -> item) for each new item, plus
   * (item -> first) for the last new item if `withWrap` and looping.
   * @param {Array} items - newly-added FilRougeItem(s), already present in the playlist
   * @param {{withWrap?: boolean}} [options]
   */
  async function planEdgesForNewItems(items, { withWrap = false } = {}) {
    const fr = filRouge();
    if (!fr || !Array.isArray(items) || !items.length) return;

    const playlist = fr.getPlaylist();
    if (playlist.length < 2) {
      await resolveTrackIdsForItems(playlist);
      return;
    }

    await resolveTrackIdsForItems(playlist);

    const edges = [];
    for (const item of items) {
      const idx = playlist.findIndex((p) => p.id === item.id);
      if (idx === -1) continue;
      if (idx > 0) {
        edges.push({ from: playlist[idx - 1], to: playlist[idx] });
      }
      if (withWrap && idx === playlist.length - 1) {
        edges.push({ from: playlist[idx], to: playlist[0] });
      }
    }

    await computeAndPersistEdges(edges);
  }

  /**
   * Full pairwise pass over the current fil rouge order (memoized via
   * `isDjTransitionFresh`), plus the wrap edge if looping is enabled.
   */
  async function planAllEdges() {
    const fr = filRouge();
    if (!fr) return;

    const playlist = fr.getPlaylist();
    if (playlist.length < 2) return;

    await resolveTrackIdsForItems(playlist);

    const edges = [];
    for (let i = 0; i < playlist.length - 1; i += 1) {
      edges.push({ from: playlist[i], to: playlist[i + 1] });
    }
    if (fr.isLoopEnabled()) {
      edges.push({ from: playlist[playlist.length - 1], to: playlist[0] });
    }

    await computeAndPersistEdges(edges);
  }

  /**
   * Informational-only call to `/api/dj/batch` for the current fil rouge order
   * and selected set profile. Does not reorder/drop tracks.
   * @returns {Promise<{globalSetScore: number, reasons: string[], globalComponents: object|null}|null>}
   */
  async function computeSetQuality({ forceRefresh = false } = {}) {
    const fr = filRouge();
    const playlist = fr ? fr.getPlaylist() : [];

    if (playlist.length) {
      await resolveTrackIdsForItems(playlist);
    }
    const filRougeTrackIds = playlist
      .filter((item) => item.djTrackId && item.djHasAnalysis)
      .map((item) => item.djTrackId);

    const queueItems = getQueue?.() || [];
    let queueTrackIds = [];
    if (queueItems.length) {
      await ensureTrackSummaries();
      queueTrackIds = queueItems
        .map((item) => matchTrackSummary(item))
        .filter((r) => r && r.hasFullAnalysis)
        .map((r) => r.trackId);
    }

    const trackIds = Array.from(new Set([...queueTrackIds, ...filRougeTrackIds]));
    if (!trackIds.length) return null;

    const result = await djApiClient.fetchBatchPlan(trackIds, getSelectedSetProfile());
    if (!result) return null;

    // Persist transition data from the batch result onto fil rouge items.
    // The batch already contains all pairwise transitions, so we avoid
    // separate /api/dj/transition calls for each edge.
    if (fr && Array.isArray(result.transitions) && result.transitions.length) {
      const byTrackId = new Map(
        playlist.filter((i) => i.djTrackId).map((i) => [i.djTrackId, i]),
      );
      for (const t of result.transitions) {
        const fromItem = byTrackId.get(t.trackA);
        const toItem = byTrackId.get(t.trackB);
        if (!fromItem || !toItem) continue;
        if (!forceRefresh && isDjTransitionFresh(fromItem.djTransition, toItem.id)) continue;
        if (!Number.isFinite(t.mixOutSec) || !Number.isFinite(t.mixInSec)) {
          logger?.warn('djPlanManager: batch — mixOutSec/mixInSec manquants', {
            trackA: t.trackA,
            trackB: t.trackB,
            rawTransition: t,
          });
        }
        fr.patchPlaylistItem(fromItem.id, {
          djTransition: {
            toItemId: toItem.id,
            transitionType: t.transitionType,
            mixOutSec: t.mixOutSec,
            mixInSec: t.mixInSec,
            recommendedBpm: t.recommendedBpm,
            crossfadeDurationSec: t.crossfadeDurationSec,
            compatibilityScore: t.compatibilityScore,
            decisionId: t.decisionId,
            computedAt: Date.now(),
          },
        });
      }
    }

    return {
      globalSetScore: result.globalSetScore,
      reasons: result.reasons || [],
      globalComponents: result.globalComponents || null,
    };
  }

  /**
   * Recalcule le badge de qualité en envoyant uniquement le profil à `/api/dj/batch`.
   * Utilisé lors du changement de profil depuis le sélecteur.
   */
  async function computeSetQualityByProfile(profile) {
    if (!profile) return null;
    const result = await djApiClient.fetchBatchPlanByProfile(profile);
    if (!result) return null;

    const fr = filRouge();
    if (fr && Array.isArray(result.transitions) && result.transitions.length) {
      const playlist = fr.getPlaylist();
      const byTrackId = new Map(
        playlist.filter((i) => i.djTrackId).map((i) => [i.djTrackId, i]),
      );
      for (const t of result.transitions) {
        const fromItem = byTrackId.get(t.trackA);
        const toItem = byTrackId.get(t.trackB);
        if (!fromItem || !toItem) continue;
        if (!Number.isFinite(t.mixOutSec) || !Number.isFinite(t.mixInSec)) continue;
        fr.patchPlaylistItem(fromItem.id, {
          djTransition: {
            toItemId: toItem.id,
            transitionType: t.transitionType,
            mixOutSec: t.mixOutSec,
            mixInSec: t.mixInSec,
            recommendedBpm: t.recommendedBpm,
            crossfadeDurationSec: t.crossfadeDurationSec,
            compatibilityScore: t.compatibilityScore,
            decisionId: t.decisionId,
            computedAt: Date.now(),
          },
        });
      }
    }

    return {
      globalSetScore: result.globalSetScore,
      reasons: result.reasons || [],
      globalComponents: result.globalComponents || null,
    };
  }

  /** @returns {Promise<{profiles: Array, default: string}|null>} */
  async function getSetProfiles() {
    if (setProfilesCache) return setProfilesCache;
    const result = await djApiClient.fetchSetProfiles();
    if (result) setProfilesCache = result;
    return result;
  }

  /** @returns {string} */
  function getSelectedSetProfile() {
    try {
      return localStorage.getItem(STORAGE_KEYS.djSetProfile) || DEFAULT_SET_PROFILE;
    } catch (_) {
      return DEFAULT_SET_PROFILE;
    }
  }

  /** @param {string} profile */
  function setSelectedSetProfile(profile) {
    try {
      localStorage.setItem(STORAGE_KEYS.djSetProfile, profile || DEFAULT_SET_PROFILE);
    } catch (_) {
      // localStorage unavailable: selection just won't persist across reloads
    }
  }

  /**
   * @param {object} item - a FilRougeItem with a resolved `djTrackId`
   * @param {boolean} iconic
   * @returns {Promise<object|null>}
   */
  async function setIconic(item, iconic) {
    if (!item?.djTrackId) return null;
    const result = await djApiClient.setIconic(item.djTrackId, iconic, item.name, item.artist);
    if (result !== null) {
      filRouge()?.patchPlaylistItem(item.id, { djIsIconic: Boolean(iconic) });
    }
    return result;
  }

  /** @returns {Promise<boolean>} */
  async function retrainEngine() {
    return djApiClient.retrainEngine();
  }

  /** @returns {Promise<object|null>} */
  async function fetchWeights() {
    return djApiClient.fetchWeights();
  }

  /**
   * Finds the fil rouge item whose `djTransition` points at `item`.
   * @param {object} item
   * @returns {object|null}
   */
  function findDjPredecessorInFilRouge(item) {
    const fr = filRouge();
    if (!fr || !item) return null;
    const playlist = fr.getPlaylist();
    return playlist.find((p) => p.djTransition && String(p.djTransition.toItemId) === String(item.id)) || null;
  }

  /**
   * Automix chokepoint: returns the transition plan to use when transitioning
   * INTO `nextItem`, or `null` if none is available/fresh (caller should fall
   * back to existing heuristics).
   * @param {object} nextItem
   * @returns {{transitionType: string, mixOutSec: number, mixInSec: number, recommendedBpm: number, crossfadeDurationSec: number, compatibilityScore: number, mode: string|null, decisionId: string}|null}
   */
  function getDjTransitionPlan(nextItem) {
    if (!nextItem) return null;
    const predecessor = findDjPredecessorInFilRouge(nextItem);
    if (!predecessor) return null;

    const transition = predecessor.djTransition;
    if (!isDjTransitionFresh(transition, nextItem.id)) return null;

    return {
      transitionType: transition.transitionType,
      mixOutSec: transition.mixOutSec,
      mixInSec: transition.mixInSec,
      recommendedBpm: transition.recommendedBpm,
      crossfadeDurationSec: transition.crossfadeDurationSec,
      compatibilityScore: transition.compatibilityScore,
      mode: mapDjTransitionTypeToMode(transition.transitionType),
      decisionId: transition.decisionId,
    };
  }

  /**
   * @param {string} decisionId
   * @param {'good'|'bad'} feedback
   * @param {string} [reason]
   * @param {string} [comment]
   * @returns {Promise<object|null>}
   */
  async function submitFeedback(decisionId, feedback, reason, comment) {
    return djApiClient.sendFeedback(decisionId, feedback, reason, comment);
  }

  return {
    ensureTrackSummaries,
    resolveTrackIdForItem,
    resolveTrackIdsForItems,
    planEdgesForNewItems,
    planAllEdges,
    computeSetQuality,
    computeSetQualityByProfile,
    getSetProfiles,
    getSelectedSetProfile,
    setSelectedSetProfile,
    setIconic,
    findDjPredecessorInFilRouge,
    getDjTransitionPlan,
    submitFeedback,
    retrainEngine,
    fetchWeights,
  };
}
