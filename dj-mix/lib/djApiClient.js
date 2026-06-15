// djApiClient.js — Thin client for the DJ planner API (`/api/dj/*`), exposed
// on the same backend as the downloader API.
//
// Follows the conventions used elsewhere for the downloader API (see
// fetchMixData in autoModeManager.js):
//   - skip the call entirely while apiHealthMonitor.isOffline()
//   - append the API token via appendApiToken()
//   - recordSuccess()/recordFailure() on the shared health monitor
//   - never throw; return null/[] on any failure
//
// 400/404 are normal business responses for this API (missing args, no
// analysis available, unknown decisionId, ...) and therefore do NOT count
// as a health failure.

import { appendApiToken } from './downloaderConfig.js';

export function createDjApiClient({
  apiHealthMonitor,
  getDownloaderApiToken,
  getDownloaderApiUrl,
  logger,
} = {}) {
  async function _request(path, { method = 'GET', params, body } = {}) {
    try {
      const apiUrl = getDownloaderApiUrl?.();
      if (!apiUrl) return { ok: false, status: 0, data: null };
      if (apiHealthMonitor?.isOffline()) return { ok: false, status: 0, data: null };

      let url = `${apiUrl}${path}`;
      if (params) {
        const qs = new URLSearchParams(params).toString();
        if (qs) url += `?${qs}`;
      }
      url = appendApiToken(url, getDownloaderApiToken?.());

      const init = { method, headers: { 'Content-Type': 'application/json' } };
      if (body !== undefined) init.body = JSON.stringify(body);

      const response = await fetch(url, init);

      if (response.status === 400 || response.status === 404) {
        const data = await response.json().catch(() => null);
        logger?.debug?.('djApi.request.businessError', { path, status: response.status, error: data?.error });
        return { ok: false, status: response.status, data };
      }

      if (!response.ok) {
        apiHealthMonitor?.recordFailure();
        logger?.debug?.('djApi.request.failed', { path, status: response.status });
        return { ok: false, status: response.status, data: null };
      }

      apiHealthMonitor?.recordSuccess();
      const data = await response.json().catch(() => null);
      return { ok: true, status: response.status, data };
    } catch (err) {
      apiHealthMonitor?.recordFailure();
      logger?.warn?.('djApi.request.error', { path, error: err?.message });
      return { ok: false, status: 0, data: null };
    }
  }

  function _get(path, params) {
    return _request(path, { method: 'GET', params });
  }

  function _post(path, body) {
    return _request(path, { method: 'POST', body });
  }

  /** @returns {Promise<Array>} TrackSummary[] (empty array on failure) */
  async function fetchTracks() {
    const res = await _get('/api/dj/tracks');
    return res.ok && Array.isArray(res.data?.tracks) ? res.data.tracks : [];
  }

  /** @returns {Promise<object|null>} TrackAnalysis, or null if unavailable (400/404/offline) */
  async function fetchTrackDetail(trackId) {
    if (!trackId) return null;
    const res = await _get('/api/dj/tracks/detail', { trackId });
    return res.ok ? res.data : null;
  }

  /** @returns {Promise<object|null>} transition recommendation, or null if unavailable */
  async function fetchTransition(trackA, trackB) {
    if (!trackA || !trackB) return null;
    const res = await _post('/api/dj/transition', { trackA, trackB });
    return res.ok ? res.data : null;
  }

  /** @returns {Promise<object|null>} batch plan result, or null if unavailable */
  async function fetchBatchPlan(tracks, profile) {
    if (!Array.isArray(tracks) || !tracks.length) return null;
    const body = { tracks };
    if (profile) body.profile = profile;
    const res = await _post('/api/dj/batch', body);
    return res.ok ? res.data : null;
  }

  /** @returns {Promise<object|null>} echoed feedback, or null if unavailable (e.g. unknown decisionId) */
  async function sendFeedback(decisionId, feedback, reason, comment) {
    if (!decisionId || !feedback) return null;
    const body = { decisionId, feedback };
    if (reason) body.reason = reason;
    if (comment) body.comment = comment;
    const res = await _post('/api/dj/feedback', body);
    return res.ok ? res.data : null;
  }

  /** @returns {Promise<object|null>} updated iconic flag info, or null if unavailable */
  async function setIconic(trackId, iconic, trackName, artistName) {
    if (!trackId) return null;
    const body = { trackId, iconic: Boolean(iconic) };
    if (trackName) body.trackName = trackName;
    if (artistName) body.artistName = artistName;
    const res = await _post('/api/dj/iconic', body);
    return res.ok ? res.data : null;
  }

  /** @returns {Promise<{profiles: Array, default: string}|null>} */
  async function fetchSetProfiles() {
    const res = await _get('/api/dj/set-profiles');
    return res.ok ? res.data : null;
  }

  return {
    fetchTracks,
    fetchTrackDetail,
    fetchTransition,
    fetchBatchPlan,
    sendFeedback,
    setIconic,
    fetchSetProfiles,
  };
}
