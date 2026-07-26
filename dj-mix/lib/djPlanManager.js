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
import { normalizeTransitionMode } from './transitionModes.js';

const DEFAULT_SET_PROFILE = 'club_peak';
const MAX_LOOKAHEAD_TRANSITIONS = 10;

function saveBatchPlanToStorage(result) {
  try {
    localStorage.setItem(STORAGE_KEYS.djBatchPlan, JSON.stringify(result));
  } catch (_) {}
}

function getStoredBatchPlanFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.djBatchPlan);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export function createDjPlanManager({ djApiClient, getFilRougeManager, getQueue, getTrackMaxDurationAppliedSec, isFilRougeDownloadPending, logger } = {}) {
  /** @type {Array} cached `TrackSummary[]` from `/api/dj/tracks` */
  let trackSummaries = [];
  let trackSummariesLoadedAt = 0;

  /** @type {Promise<Array>|null} in-flight ensureTrackSummaries promise for dedup */
  let _trackSummariesInflight = null;

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
    if (_trackSummariesInflight) return _trackSummariesInflight;
    _trackSummariesInflight = djApiClient.fetchTracks().then((tracks) => {
      if (Array.isArray(tracks) && tracks.length) {
        trackSummaries = tracks;
        trackSummariesLoadedAt = Date.now();
      } else if (force) {
        trackSummaries = [];
      }
      return trackSummaries;
    }).finally(() => { _trackSummariesInflight = null; });
    return _trackSummariesInflight;
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
  async function computeAndPersistEdges(edges, { forceRefresh = false } = {}) {
    const fr = filRouge();
    if (!fr || !Array.isArray(edges) || !edges.length) return;

    const maxDur = getTrackMaxDurationAppliedSec?.() || 0;
    const maxDurOpt = maxDur > 0 ? { maxTrackDurationSec: maxDur } : undefined;

    const pending = edges
      .filter(({ from, to }) =>
        from && to
        && (forceRefresh || !isDjTransitionFresh(from.djTransition, to.id))
        && from.djTrackId && to.djTrackId
        && from.djHasAnalysis && to.djHasAnalysis)
      .map(({ from, to }) =>
        djApiClient.fetchTransition(from.djTrackId, to.djTrackId, maxDurOpt)
          .then((result) => ({ from, to, result })));

    const results = await Promise.all(pending);

    for (const { from, to, result } of results) {
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
          automixMode: null,
          mixOutSec: result.mixOutSec,
          mixInSec: result.mixInSec,
          mixInSecDefined: Number.isFinite(result.mixInSec),
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
   * Plans the next MAX_LOOKAHEAD_TRANSITIONS consecutive edges from the current
   * fil rouge index (memoized via `isDjTransitionFresh`), plus the loop-wrap
   * edge if looping is enabled and the budget allows.
   */
  async function planAllEdges() {
    const fr = filRouge();
    if (!fr) return;

    const playlist = fr.getPlaylist();
    if (playlist.length < 2) return;

    await resolveTrackIdsForItems(playlist);

    const startIdx = Math.max(0, fr.getCurrentIndex?.() ?? 0);
    const edges = [];
    for (let i = startIdx; i < playlist.length - 1 && edges.length < MAX_LOOKAHEAD_TRANSITIONS; i++) {
      edges.push({ from: playlist[i], to: playlist[i + 1] });
    }
    if (fr.isLoopEnabled() && playlist.length > 1 && edges.length < MAX_LOOKAHEAD_TRANSITIONS) {
      edges.push({ from: playlist[playlist.length - 1], to: playlist[0] });
    }

    await computeAndPersistEdges(edges);
  }

  /**
   * Plans the next MAX_LOOKAHEAD_TRANSITIONS individual transitions in the fil rouge
   * via `/api/dj/transition` (one call per pair). No batch endpoint is used.
   * Skipped (returns `null`) while fil rouge downloads are still in progress.
   * @returns {Promise<null>}
   */
  async function computeSetQuality({ forceRefresh = false } = {}) {
    if (isFilRougeDownloadPending?.()) {
      logger?.debug?.('djPlanManager: computeSetQuality skipped — fil rouge downloads in progress');
      return null;
    }

    const fr = filRouge();
    if (!fr) return null;

    const playlist = fr.getPlaylist();
    if (playlist.length < 2) return null;

    await resolveTrackIdsForItems(playlist);

    const startIdx = Math.max(0, fr.getCurrentIndex?.() ?? 0);
    const edges = [];
    for (let i = startIdx; i < playlist.length - 1 && edges.length < MAX_LOOKAHEAD_TRANSITIONS; i++) {
      edges.push({ from: playlist[i], to: playlist[i + 1] });
    }

    if (edges.length > 0) {
      await computeAndPersistEdges(edges, { forceRefresh });
    }

    return null;
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
   * @returns {{transitionType: string, automixMode: string|null, mixOutSec: number, mixInSec: number, mixInSecDefined: boolean, recommendedBpm: number, crossfadeDurationSec: number, compatibilityScore: number, mode: string|null, decisionId: string}|null}
   */
  function getDjTransitionPlan(nextItem) {
    if (!nextItem) return null;
    const predecessor = findDjPredecessorInFilRouge(nextItem);
    if (!predecessor) return null;

    const transition = predecessor.djTransition;
    if (!isDjTransitionFresh(transition, nextItem.id)) return null;

    const automixMode = transition.automixMode || null;
    return {
      transitionType: transition.transitionType,
      automixMode,
      mixOutSec: transition.mixOutSec,
      mixInSec: transition.mixInSec,
      mixInSecDefined: Boolean(transition.mixInSecDefined),
      recommendedBpm: transition.recommendedBpm,
      crossfadeDurationSec: transition.crossfadeDurationSec,
      compatibilityScore: transition.compatibilityScore,
      mode: automixMode
        ? normalizeTransitionMode(automixMode)
        : mapDjTransitionTypeToMode(transition.transitionType),
      decisionId: transition.decisionId,
    };
  }

  /**
   * Returns the opening cue start offset (ms) for a given djTrackId,
   * from the stored batch plan. Returns 0 if not found.
   * @param {string} djTrackId
   * @returns {number}
   */
  function getOpeningCueOffsetMs(djTrackId) {
    if (!djTrackId) return 0;
    const plan = getStoredBatchPlanFromStorage();
    if (!plan?.openingCue) return 0;
    if (plan.openingCue.trackId !== djTrackId) return 0;
    const timeSec = Number(plan.openingCue.timeSec);
    return Number.isFinite(timeSec) && timeSec > 0 ? Math.round(timeSec * 1000) : 0;
  }

  /**
   * Computes the transition from a current item to its successor in the playlist,
   * called by the "recalculate" action. Forces fresh computation regardless of memoization.
   * @param {object} currentItem - the currently playing item
   * @param {{force?: boolean}} [options] - force=true relaxes djHasAnalysis guard and retries track resolution
   * @returns {Promise<{ok: boolean, reason?: string}>}
   */
  async function planCurrentToNextTransition(currentItem, { force = false } = {}) {
    const fr = filRouge();
    if (!fr || !currentItem) return { ok: false, reason: 'no-context' };

    const playlist = fr.getPlaylist();
    const currentIdx = playlist.findIndex((p) => p.id === currentItem.id);
    if (currentIdx === -1) return { ok: false, reason: 'not-in-playlist' };

    // Le morceau réellement joué ensuite est celui de la file d'attente (getQueue),
    // pas forcément playlist[currentIdx + 1] : la file peut diverger de l'ordre du
    // fil rouge (ajout manuel entre les deux, plusieurs morceaux déjà enchaînés,
    // etc.). On ne retombe sur l'ordre brut du fil rouge que si le morceau courant
    // n'est pas trouvé dans la file (ex: passe initiale avant le début de lecture).
    const queue = getQueue?.() || [];
    const queueIdx = queue.findIndex((q) => q.id === currentItem.id);
    const nextItem = (queueIdx >= 0 ? queue[queueIdx + 1] : null) || playlist[currentIdx + 1] || null;
    if (!nextItem) return { ok: false, reason: 'last-track' };

    await resolveTrackIdsForItems([currentItem, nextItem]);

    if (!currentItem.djTrackId || !nextItem.djTrackId) {
      if (force) {
        await ensureTrackSummaries({ force: true });
        await resolveTrackIdsForItems([currentItem, nextItem]);
      }
      if (!currentItem.djTrackId || !nextItem.djTrackId) {
        return { ok: false, reason: 'unresolved-tracks' };
      }
    }

    if (!force && (!currentItem.djHasAnalysis || !nextItem.djHasAnalysis)) {
      return { ok: false, reason: 'missing-analysis' };
    }

    const maxDur = getTrackMaxDurationAppliedSec?.() || 0;
    const result = await djApiClient.fetchTransition(
      currentItem.djTrackId,
      nextItem.djTrackId,
      maxDur > 0 ? { maxTrackDurationSec: maxDur } : undefined,
    );
    if (!result) return { ok: false, reason: 'api-error' };

    if (!Number.isFinite(result.mixOutSec) || !Number.isFinite(result.mixInSec)) {
      logger?.warn('djPlanManager.planCurrentToNextTransition: mixOutSec/mixInSec manquants', {
        fromTrackId: currentItem.djTrackId,
        toTrackId: nextItem.djTrackId,
        rawResult: result,
      });
    }

    fr.patchPlaylistItem(currentItem.id, {
      djTransition: {
        toItemId: nextItem.id,
        transitionType: result.transitionType,
        automixMode: null,
        mixOutSec: result.mixOutSec,
        mixInSec: result.mixInSec,
        mixInSecDefined: Number.isFinite(result.mixInSec),
        recommendedBpm: result.recommendedBpm,
        crossfadeDurationSec: result.crossfadeDurationSec,
        compatibilityScore: result.compatibilityScore,
        decisionId: result.decisionId,
        computedAt: Date.now(),
      },
    });

    return { ok: true };
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
    planCurrentToNextTransition,
    computeSetQuality,
    getSetProfiles,
    getSelectedSetProfile,
    setSelectedSetProfile,
    setIconic,
    findDjPredecessorInFilRouge,
    getDjTransitionPlan,
    getOpeningCueOffsetMs,
    getStoredBatchPlan: getStoredBatchPlanFromStorage,
    submitFeedback,
    retrainEngine,
    fetchWeights,
  };
}
