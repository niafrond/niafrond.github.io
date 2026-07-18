/**
 * relayModeManager.js — Synchronisation maître/relais
 *
 * Architecture :
 *   Maître   →  POST /api/relay/session                 → obtient un sessionId
 *            →  PUT  /api/relay/state/:id               → publie l'état courant
 *            →  POST /api/relay/audio/:trackId          → upload l'audio local (fallback P2P)
 *
 *   Relais   →  GET  /api/relay/state/:id  (polling)    → lit l'état du maître
 *            →  GET  /api/relay/audio/:trackId          → tente dl depuis le proxy maître
 *
 * Le maître pousse un snapshot compact toutes les ~2 s (debounce 200 ms sur les
 * changements fréquents). Le relais interroge toutes les POLL_MS ms et appelle
 * onApplyRelayState() si le contenu a changé.
 *
 * Pré-téléchargement :
 *   onRelayQueueItemsAvailable([items]) est appelé par le contrôleur quand de
 *   nouvelles pistes arrivent dans la queue/fil-rouge du maître. Le module
 *   l'utilisateur doit brancher ensureLocalSource() dessus pour le pré-dl.
 *
 * Format de l'état synchronisé :
 * {
 *   sessionId, pushedAt,
 *   currentTrackId, currentIndex, isPlaying,
 *   activeDeck,
 *   deckA: { trackId, positionMs, volume },
 *   deckB: { trackId, positionMs, volume },
 *   queue: [{ id, name, artist, artUrl, duration, persistedSourceUrl, bpm, genre }],
 *   filRouge: [{ id, name, artist, artUrl, duration, persistedSourceUrl }],
 *   transitionMode, crossfadeMs, djMode
 * }
 */

export function createRelayModeManager({
  getDownloaderApiUrl,
  getDownloaderApiToken,
  logger,
  onApplyRelayState,           // (state) => void
  onRelayQueueItemsAvailable,  // (items[]) => void — pour déclencher le pré-dl
  onRelayCommand,              // (cmd) => void — commande envoyée par un relais
} = {}) {
  const POLL_MS = 1500;
  const PUSH_DEBOUNCE_MS = 1000;
  const CMD_POLL_MS = 2500;
  const CMD_MAX_AGE_MS = 60_000;

  let _role = 'standalone';  // 'standalone' | 'master' | 'relay'
  let _sessionId = null;
  let _pollTimer = null;
  let _cmdPollTimer = null;
  let _pushDebounceTimer = null;
  let _pendingState = null;
  let _lastStateHash = null;

  // ── Couche HTTP ────────────────────────────────────────────────────────────

  function _base() { return getDownloaderApiUrl?.() || null; }

  function _headers(extra = {}) {
    const token = getDownloaderApiToken?.();
    const h = { 'Content-Type': 'application/json', ...extra };
    if (token) h['x-api-token'] = token;
    return h;
  }

  async function _fetch(path, init = {}) {
    const base = _base();
    if (!base) return null;
    try {
      const res = await fetch(`${base}${path}`, {
        headers: _headers(),
        ...init,
      });
      if (!res.ok) return null;
      return await res.json().catch(() => null);
    } catch (err) {
      logger?.warn('relay.fetch.error', { path, err: err?.message });
      return null;
    }
  }

  // ── Maître : gestion de session ────────────────────────────────────────────

  async function createSession() {
    const data = await _fetch('/api/relay/session', { method: 'POST', body: JSON.stringify({}) });
    if (data?.sessionId) {
      _sessionId = data.sessionId;
      logger?.info('relay.session.created', { sessionId: _sessionId });
      return _sessionId;
    }
    logger?.warn('relay.session.createFailed');
    return null;
  }

  // ── Maître : publication de l'état ────────────────────────────────────────

  function schedulePush(state) {
    if (_role !== 'master' || !_sessionId) return;
    _pendingState = state;
    if (_pushDebounceTimer) return;
    _pushDebounceTimer = setTimeout(_flushPush, PUSH_DEBOUNCE_MS);
  }

  async function _flushPush() {
    _pushDebounceTimer = null;
    if (!_pendingState || _role !== 'master' || !_sessionId) return;
    const payload = { ..._pendingState, pushedAt: Date.now() };
    _pendingState = null;
    const hash = _hashState(payload);
    if (hash === _lastStateHash) return;
    _lastStateHash = hash;
    const base = _base();
    if (!base) return;
    try {
      await fetch(`${base}/api/relay/state/${_sessionId}`, {
        method: 'PUT',
        headers: _headers(),
        body: JSON.stringify(payload),
      });
    } catch (err) {
      logger?.warn('relay.push.error', { err: err?.message });
    }
  }

  // ── Maître : upload audio pour fallback P2P ───────────────────────────────

  /**
   * Uploade un blob audio local vers le proxy serveur pour que les relais
   * puissent le récupérer si l'API principale est indisponible.
   * @param {string} trackId
   * @param {Blob} blob
   */
  async function uploadAudioProxy(trackId, blob) {
    if (_role !== 'master' || !_sessionId || !trackId || !blob) return false;
    const base = _base();
    if (!base) return false;
    try {
      const res = await fetch(`${base}/api/relay/audio/${_sessionId}/${trackId}`, {
        method: 'POST',
        headers: { 'x-api-token': getDownloaderApiToken?.() || '' },
        body: blob,
      });
      return res.ok;
    } catch (err) {
      logger?.warn('relay.uploadAudio.error', { trackId, err: err?.message });
      return false;
    }
  }

  /**
   * Retourne l'URL de l'audio proxifié par le maître (fallback si API indispo).
   * @param {string} trackId
   * @returns {string|null}
   */
  function getProxyAudioUrl(trackId) {
    if (!trackId || !_sessionId) return null;
    const base = _base();
    if (!base) return null;
    const token = getDownloaderApiToken?.();
    const qs = token ? `?x-api-token=${encodeURIComponent(token)}` : '';
    return `${base}/api/relay/audio/${_sessionId}/${trackId}${qs}`;
  }

  // ── Maître : polling des commandes relais ──────────────────────────────────

  async function _pollCommands() {
    if (_role !== 'master' || !_sessionId || !onRelayCommand) return;
    const data = await _fetch(`/api/relay/commands/${_sessionId}`);
    if (!data?.commands?.length) return;
    const now = Date.now();
    for (const cmd of data.commands) {
      if (cmd.requestedAt && now - cmd.requestedAt > CMD_MAX_AGE_MS) continue;
      try { onRelayCommand(cmd); } catch (err) {
        logger?.warn('relay.command.handlerError', { type: cmd.type, err: err?.message });
      }
    }
  }

  function _startCmdPoll() {
    _stopCmdPoll();
    _cmdPollTimer = setInterval(_pollCommands, CMD_POLL_MS);
  }

  function _stopCmdPoll() {
    if (_cmdPollTimer) { clearInterval(_cmdPollTimer); _cmdPollTimer = null; }
  }

  // ── Relais : polling ───────────────────────────────────────────────────────

  async function _poll() {
    if (_role !== 'relay' || !_sessionId) return;
    const state = await _fetch(`/api/relay/state/${_sessionId}`);
    if (!state?.pushedAt) return;
    const hash = _hashState(state);
    if (hash === _lastStateHash) return;
    _lastStateHash = hash;

    // Notifier les nouveaux items queue / fil rouge pour pré-dl. Un même morceau
    // peut désormais légitimement figurer dans les deux listes côté maître
    // (trackStore partagé, cf. SPECS.md §2.6) — dédoublonné par id pour éviter
    // un double pré-téléchargement côté relais (SPEC-9.3.3.1).
    const seenIds = new Set();
    const allItems = [...(state.queue || []), ...(state.filRouge || [])].filter((item) => {
      const id = item?.id;
      if (id == null) return true;
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });
    if (allItems.length) onRelayQueueItemsAvailable?.(allItems);

    onApplyRelayState?.(state);
  }

  function _startPoll() {
    _stopPoll();
    _pollTimer = setInterval(_poll, POLL_MS);
    // Premier sondage immédiat
    _poll();
  }

  function _stopPoll() {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  }

  // ── API publique ──────────────────────────────────────────────────────────

  function startAsMaster(sessionId) {
    _role = 'master';
    if (sessionId) _sessionId = sessionId;
    _lastStateHash = null;
    _stopPoll();
    _startCmdPoll();
    logger?.info('relay.startAsMaster', { sessionId: _sessionId });
  }

  function startAsRelay(sessionId) {
    _role = 'relay';
    _sessionId = sessionId;
    _lastStateHash = null;
    _startPoll();
    logger?.info('relay.startAsRelay', { sessionId });
  }

  function setStandalone() {
    _stopPoll();
    _stopCmdPoll();
    if (_pushDebounceTimer) { clearTimeout(_pushDebounceTimer); _pushDebounceTimer = null; }
    _role = 'standalone';
    _sessionId = null;
    _lastStateHash = null;
    _pendingState = null;
    logger?.info('relay.setStandalone');
  }

  function getRole() { return _role; }
  function getSessionId() { return _sessionId; }

  // ── Utilitaires ────────────────────────────────────────────────────────────

  function _hashState(state) {
    // Ne pas inclure positionMs : ça changerait à chaque tick et spammerait le relais.
    // L'état n'est poussé que sur un vrai changement (piste, queue, FX, mode, événement planifié).
    const s = state;
    return [
      s.currentTrackId,
      s.currentIndex,
      s.isPlaying ? '1' : '0',
      s.activeDeck,
      s.transitionMode,
      s.crossfadeMs,
      s.djMode,
      s.fx?.echo ? 'e' : '',
      s.fx?.distortion ? 'd' : '',
      (s.queue || []).map((i) => i.id).join(','),
      (s.upcoming || []).map((e) => `${e.type}:${Math.round(e.at / 1000)}`).join(';'),
    ].join('|');
  }

  return {
    createSession,
    schedulePush,
    uploadAudioProxy,
    getProxyAudioUrl,
    startAsMaster,
    startAsRelay,
    setStandalone,
    getRole,
    getSessionId,
  };
}
