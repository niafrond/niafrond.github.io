// djPlannerManager.js — Orchestrates the `dj-planner` backend (`/v1/*`, see
// lib/djPlannerClient.js) for the fil rouge: on-demand mix-decision between
// the current track and its successor ("Est-ce que ces deux morceaux se
// mixent ?"), observed-transition evidence, style progressions, playlist
// optimization and personal-history import (dj-mix/frontend-integration.md §4).
//
// Per §2, features depending on dj-planner MUST be silently disabled while
// the backend is unreachable — `ensureAvailability()` gates every call and
// caches the result briefly so a down backend isn't re-probed on every
// render tick.
//
// Track IDs: reuses the `djTrackId` already resolved onto each fil rouge
// item by the legacy `djPlanManager` (via `/api/dj/tracks`) — both backends
// read the same local audio library, so the same filename-based id applies.

const AVAILABILITY_RECHECK_MS = 30_000;
const MAX_DECISION_AGE_MS = 24 * 60 * 60 * 1000;
const STYLES_CACHE_MS = 5 * 60 * 1000;

export function createDjPlannerManager({ djPlannerClient, getFilRougeManager, logger } = {}) {
  let _available = null; // null = not yet probed
  let _availabilityCheckedAt = 0;
  let _stylesCache = null;
  let _stylesCachedAt = 0;

  function filRouge() {
    return getFilRougeManager?.();
  }

  /** @returns {Promise<boolean>} */
  async function ensureAvailability() {
    if (_available !== null && (Date.now() - _availabilityCheckedAt) < AVAILABILITY_RECHECK_MS) {
      return _available;
    }
    _available = await djPlannerClient.checkHealth();
    _availabilityCheckedAt = Date.now();
    if (!_available) logger?.debug?.('djPlannerManager: backend unreachable, features disabled');
    return _available;
  }

  /** @returns {boolean} last known availability, without probing (`false` until the first `ensureAvailability()`) */
  function isAvailable() {
    return _available === true;
  }

  /**
   * @param {object|null|undefined} record - a stored `item.plannerDecision`/`item.observedTransition`
   * @param {string|number|null|undefined} toItemId
   * @returns {boolean}
   */
  function isDecisionFresh(record, toItemId) {
    if (!record || toItemId == null) return false;
    if (String(record.toItemId) !== String(toItemId)) return false;
    const computedAt = Number(record.computedAt);
    if (!Number.isFinite(computedAt)) return false;
    return (Date.now() - computedAt) <= MAX_DECISION_AGE_MS;
  }

  /**
   * Pure sync getter: the memoized dj-planner decision for the edge
   * fromItem -> toItem, or `null` if not yet computed/stale (caller should
   * then call `planMixDecisionForEdge` to trigger computation).
   * @returns {object|null} raw `MixDecision`/`IncompatibleMixDecision` (+ `toItemId`/`computedAt`)
   */
  function getMixDecision(fromItem, toItem) {
    if (!fromItem || !toItem) return null;
    return isDecisionFresh(fromItem.plannerDecision, toItem.id) ? fromItem.plannerDecision : null;
  }

  /**
   * Computes (or returns the already-fresh) dj-planner mix decision for the
   * edge fromItem -> toItem, and persists it on `fromItem.plannerDecision`.
   * Resolves to `null` if unavailable, unresolved trackIds, or API failure —
   * callers should fall back to the existing heuristics / legacy djPlanManager.
   * @param {object} fromItem
   * @param {object} toItem
   * @param {{forceRefresh?: boolean}} [options]
   * @returns {Promise<object|null>}
   */
  async function planMixDecisionForEdge(fromItem, toItem, { forceRefresh = false } = {}) {
    if (!fromItem || !toItem || !fromItem.djTrackId || !toItem.djTrackId) return null;
    if (!forceRefresh && isDecisionFresh(fromItem.plannerDecision, toItem.id)) return fromItem.plannerDecision;

    const available = await ensureAvailability();
    if (!available) return null;

    const res = await djPlannerClient.createMixDecision(fromItem.djTrackId, toItem.djTrackId);
    if (!res.ok || !res.data) return null;

    const decision = { ...res.data, toItemId: toItem.id, computedAt: Date.now() };
    filRouge()?.patchPlaylistItem(fromItem.id, { plannerDecision: decision });
    return decision;
  }

  /**
   * Pure sync getter: the memoized `ObservedTransitionResponse` for the edge
   * fromItem -> toItem, or `null` if not yet computed/stale.
   * @returns {object|null}
   */
  function getObservedTransition(fromItem, toItem) {
    if (!fromItem || !toItem) return null;
    return isDecisionFresh(fromItem.observedTransition, toItem.id) ? fromItem.observedTransition : null;
  }

  /**
   * Computes (or returns the already-fresh) "has this transition already been
   * played by real DJs" evidence for the edge fromItem -> toItem
   * (`GET /v1/transitions/observed`), and persists it on
   * `fromItem.observedTransition`. `observed:false` is a normal result, not a
   * failure — it is cached and returned like any other successful response.
   * @param {object} fromItem
   * @param {object} toItem
   * @param {{forceRefresh?: boolean}} [options]
   * @returns {Promise<object|null>} `null` only on unavailable/unresolved/API failure
   */
  async function planObservedTransitionForEdge(fromItem, toItem, { forceRefresh = false } = {}) {
    if (!fromItem || !toItem || !fromItem.djTrackId || !toItem.djTrackId) return null;
    if (!forceRefresh && isDecisionFresh(fromItem.observedTransition, toItem.id)) return fromItem.observedTransition;

    const available = await ensureAvailability();
    if (!available) return null;

    const res = await djPlannerClient.fetchObservedTransition(fromItem.djTrackId, toItem.djTrackId);
    if (!res.ok || !res.data) return null;

    const observed = { ...res.data, toItemId: toItem.id, computedAt: Date.now() };
    filRouge()?.patchPlaylistItem(fromItem.id, { observedTransition: observed });
    return observed;
  }

  /**
   * @param {string} style
   * @returns {Promise<object|null>} `StyleProgressionsResponse`, or `null` if unavailable/failed
   */
  async function getStyleProgressions(style) {
    if (!style) return null;
    const available = await ensureAvailability();
    if (!available) return null;
    const res = await djPlannerClient.fetchStyleProgressions(style);
    return res.ok ? res.data : null;
  }

  /**
   * Cached for `STYLES_CACHE_MS` since the available style list rarely changes
   * mid-session — avoids re-fetching every time the style panel is opened.
   * @returns {Promise<string[]>} list of available styles, empty if unavailable/failed
   */
  async function getAvailableStyles() {
    if (_stylesCache && (Date.now() - _stylesCachedAt) < STYLES_CACHE_MS) return _stylesCache;
    const available = await ensureAvailability();
    if (!available) return [];
    const res = await djPlannerClient.fetchAvailableStyles();
    const styles = res.ok && Array.isArray(res.data?.styles) ? res.data.styles : [];
    _stylesCache = styles;
    _stylesCachedAt = Date.now();
    return styles;
  }

  /**
   * @param {string[]} trackIds
   * @param {{lockedPositions?: Array, allowException?: boolean}} [options]
   * @returns {Promise<object|null>} `PlaylistPlan`, or `null` if unavailable/failed
   */
  async function createPlaylistPlan(trackIds, options) {
    const available = await ensureAvailability();
    if (!available) return null;
    const res = await djPlannerClient.createPlaylistPlan(trackIds, options);
    return res.ok ? res.data : null;
  }

  /**
   * @param {string} planId
   * @param {string[]} trackIds
   * @param {{lockedPositions?: Array, allowException?: boolean}} [options]
   * @returns {Promise<object|null>} `PlaylistPlan`, or `null` if unavailable/failed
   */
  async function updatePlaylistPlan(planId, trackIds, options) {
    const available = await ensureAvailability();
    if (!available) return null;
    const res = await djPlannerClient.updatePlaylistPlan(planId, trackIds, options);
    return res.ok ? res.data : null;
  }

  /**
   * @param {{djName: string, entries: Array, event?: string, date?: string, sourceUrl?: string}} payload
   * @returns {Promise<object|null>} `PersonalHistoryImportResponse`, or `null` if unavailable/failed
   */
  async function importPersonalHistory(payload) {
    const available = await ensureAvailability();
    if (!available) return null;
    const res = await djPlannerClient.importPersonalHistory(payload);
    return res.ok ? res.data : null;
  }

  return {
    ensureAvailability,
    isAvailable,
    getMixDecision,
    planMixDecisionForEdge,
    getObservedTransition,
    planObservedTransitionForEdge,
    getStyleProgressions,
    getAvailableStyles,
    createPlaylistPlan,
    updatePlaylistPlan,
    importPersonalHistory,
  };
}
