// djPlannerClient.js — Thin client for the `dj-planner` backend (`/v1/*`),
// a separate local FastAPI service reachable behind the same reverse-proxy
// base URL as the downloader API (path-routed at `/api/dj-planner`, see
// `deriveDjPlannerUrlFromApiUrl` in downloaderConfig.js).
//
// Per dj-mix/frontend-integration.md §2:
//   - no authentication: never send a token or credentials
//   - callers MUST probe GET /health before enabling dj-planner features and
//     silently disable them if unreachable (see djPlannerManager.js)
//   - 422 is a normal business response (validation error / no decision
//     possible), NOT a health failure
//   - never throw; resolve to { ok:false, status, data:null } on any failure
//     so callers can always fall back to the existing heuristics

const REQUEST_TIMEOUT_MS = 15_000;
const HEALTH_TIMEOUT_MS = 2_000;

export function createDjPlannerClient({ getDjPlannerUrl, healthMonitor, logger } = {}) {
  async function _request(path, { method = 'GET', params, body } = {}) {
    try {
      const baseUrl = getDjPlannerUrl?.();
      if (!baseUrl) return { ok: false, status: 0, data: null };
      if (healthMonitor?.isOffline()) return { ok: false, status: 0, data: null };

      let url = `${baseUrl}${path}`;
      if (params) {
        const qs = new URLSearchParams(params).toString();
        if (qs) url += `?${qs}`;
      }

      const init = { method, headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) };
      if (body !== undefined) init.body = JSON.stringify(body);

      const response = await fetch(url, init);

      if (response.status === 422) {
        const data = await response.json().catch(() => null);
        logger?.debug?.('djPlanner.request.validationError', { path, detail: data?.detail });
        return { ok: false, status: 422, data };
      }

      if (!response.ok) {
        healthMonitor?.recordFailure();
        logger?.debug?.('djPlanner.request.failed', { path, status: response.status });
        return { ok: false, status: response.status, data: null };
      }

      healthMonitor?.recordSuccess();
      const data = await response.json().catch(() => null);
      return { ok: true, status: response.status, data };
    } catch (err) {
      healthMonitor?.recordFailure();
      logger?.warn?.('djPlanner.request.error', { path, error: err?.message });
      return { ok: false, status: 0, data: null };
    }
  }

  function _get(path, params) {
    return _request(path, { method: 'GET', params });
  }

  function _post(path, body) {
    return _request(path, { method: 'POST', body });
  }

  function _patch(path, body) {
    return _request(path, { method: 'PATCH', body });
  }

  /**
   * One-off availability probe, independent of `healthMonitor` state, using a
   * short (2s) timeout per frontend-integration.md §2.
   * @returns {Promise<boolean>}
   */
  async function checkHealth() {
    try {
      const baseUrl = getDjPlannerUrl?.();
      if (!baseUrl) return false;
      const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
      return res.ok;
    } catch (_) {
      return false;
    }
  }

  /**
   * @returns {Promise<{ok:boolean, status:number, data:(object|null)}>}
   * `data` is a `MixDecision` (compatible:true) or `IncompatibleMixDecision`
   * (compatible:false) — discriminate on `data.compatible`.
   */
  function createMixDecision(fromTrackId, toTrackId, { allowException = false } = {}) {
    if (!fromTrackId || !toTrackId) return Promise.resolve({ ok: false, status: 0, data: null });
    return _post('/v1/mix-decisions', {
      from_track_id: fromTrackId,
      to_track_id: toTrackId,
      allow_exception: Boolean(allowException),
    });
  }

  /**
   * @returns {Promise<{ok:boolean, status:number, data:(object|null)}>} `data` is a `PlaylistPlan`
   */
  function createPlaylistPlan(trackIds, { lockedPositions = [], allowException = false } = {}) {
    if (!Array.isArray(trackIds) || !trackIds.length) return Promise.resolve({ ok: false, status: 0, data: null });
    return _post('/v1/playlist-plans', {
      track_ids: trackIds,
      locked_positions: lockedPositions,
      allow_exception: Boolean(allowException),
    });
  }

  /**
   * @returns {Promise<{ok:boolean, status:number, data:(object|null)}>} `data` is a `PlaylistPlan`
   */
  function updatePlaylistPlan(planId, trackIds, { lockedPositions = [], allowException = false } = {}) {
    if (!planId || !Array.isArray(trackIds) || !trackIds.length) return Promise.resolve({ ok: false, status: 0, data: null });
    return _patch(`/v1/playlist-plans/${encodeURIComponent(planId)}`, {
      track_ids: trackIds,
      locked_positions: lockedPositions,
      allow_exception: Boolean(allowException),
    });
  }

  /**
   * @returns {Promise<{ok:boolean, status:number, data:(object|null)}>} `data` is an `ObservedTransitionResponse`
   */
  function fetchObservedTransition(fromTrackId, toTrackId) {
    if (!fromTrackId || !toTrackId) return Promise.resolve({ ok: false, status: 0, data: null });
    return _get('/v1/transitions/observed', { from_track_id: fromTrackId, to_track_id: toTrackId });
  }

  /**
   * @returns {Promise<{ok:boolean, status:number, data:(object|null)}>} `data` is a `StyleProgressionsResponse`
   */
  function fetchStyleProgressions(style) {
    if (!style) return Promise.resolve({ ok: false, status: 0, data: null });
    return _get(`/v1/styles/${encodeURIComponent(style)}/progressions`);
  }

  /**
   * @returns {Promise<{ok:boolean, status:number, data:(object|null)}>} `data` is a `PersonalHistoryImportResponse`
   */
  function importPersonalHistory({ djName, entries, event, date, sourceUrl } = {}) {
    if (!djName || !Array.isArray(entries) || !entries.length) return Promise.resolve({ ok: false, status: 0, data: null });
    const body = { dj_name: djName, entries };
    if (event) body.event = event;
    if (date) body.date = date;
    if (sourceUrl) body.source_url = sourceUrl;
    return _post('/v1/personal-history/import', body);
  }

  return {
    checkHealth,
    createMixDecision,
    createPlaylistPlan,
    updatePlaylistPlan,
    fetchObservedTransition,
    fetchStyleProgressions,
    importPersonalHistory,
  };
}
