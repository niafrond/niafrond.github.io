/**
 * relayModeManager.js — Synchronisation maître/relais
 *
 * Il n'y a pas de « session » créée côté serveur : l'ID utilisé pour router les
 * appels (`:id` ci-dessous) est un identifiant permanent généré et conservé par
 * l'appareil maître lui-même (cf. relayModeController.js) — le serveur ne fait
 * qu'auto-créer l'entrée correspondante au premier PUT.
 *
 * Le serveur relay est un process autonome, détaché de l'API principale
 * (port 3003 par défaut) — voir getDownloaderRelayUrl / deriveRelayUrlFromApiUrl
 * dans lib/downloaderConfig.js. Toutes les requêtes de ce module ciblent ce
 * process, jamais l'API principale (`getDownloaderApiUrl`).
 *
 * Architecture :
 *   Maître   →  PUT  /api/relay/state/:id               → publie l'état courant (auto-crée)
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
 *   pushedAt,
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
  getDownloaderRelayUrl,
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
  let _masterId = null;
  let _pollTimer = null;
  let _cmdPollTimer = null;
  let _pushDebounceTimer = null;
  let _pendingState = null;
  let _lastStateHash = null;

  // ── Couche HTTP ────────────────────────────────────────────────────────────

  function _base() { return getDownloaderRelayUrl?.() || null; }

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

  // ── Maître : publication de l'état ────────────────────────────────────────

  function schedulePush(state) {
    if (_role !== 'master' || !_masterId) return;
    _pendingState = state;
    if (_pushDebounceTimer) return;
    _pushDebounceTimer = setTimeout(_flushPush, PUSH_DEBOUNCE_MS);
  }

  async function _flushPush() {
    _pushDebounceTimer = null;
    if (!_pendingState || _role !== 'master' || !_masterId) return;
    const payload = { ..._pendingState, pushedAt: Date.now() };
    _pendingState = null;
    const hash = _hashState(payload);
    if (hash === _lastStateHash) return;
    _lastStateHash = hash;
    const base = _base();
    if (!base) return;
    try {
      await fetch(`${base}/api/relay/state/${_masterId}`, {
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
    if (_role !== 'master' || !_masterId || !trackId || !blob) return false;
    const base = _base();
    if (!base) return false;
    try {
      const res = await fetch(`${base}/api/relay/audio/${_masterId}/${trackId}`, {
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
    if (!trackId || !_masterId) return null;
    const base = _base();
    if (!base) return null;
    const token = getDownloaderApiToken?.();
    const qs = token ? `?x-api-token=${encodeURIComponent(token)}` : '';
    return `${base}/api/relay/audio/${_masterId}/${trackId}${qs}`;
  }

  // ── Maître : polling des commandes relais ──────────────────────────────────

  async function _pollCommands() {
    if (_role !== 'master' || !_masterId || !onRelayCommand) return;
    const data = await _fetch(`/api/relay/commands/${_masterId}`);
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
    if (_role !== 'relay' || !_masterId) return;
    const state = await _fetch(`/api/relay/state/${_masterId}`);
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

  function startAsMaster(masterId) {
    _role = 'master';
    if (masterId) _masterId = masterId;
    _lastStateHash = null;
    _stopPoll();
    _startCmdPoll();
    logger?.info('relay.startAsMaster', { masterId: _masterId });
  }

  function startAsRelay(masterId) {
    _role = 'relay';
    _masterId = masterId;
    _lastStateHash = null;
    _startPoll();
    logger?.info('relay.startAsRelay', { masterId });
  }

  function setStandalone() {
    _stopPoll();
    _stopCmdPoll();
    if (_pushDebounceTimer) { clearTimeout(_pushDebounceTimer); _pushDebounceTimer = null; }
    _role = 'standalone';
    _masterId = null;
    _lastStateHash = null;
    _pendingState = null;
    logger?.info('relay.setStandalone');
  }

  function getRole() { return _role; }
  function getMasterId() { return _masterId; }

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
      s.relayIncoming?.nowPending ? '1' : '0',
      s.relayIncoming?.nextCount ?? 0,
    ].join('|');
  }

  return {
    schedulePush,
    uploadAudioProxy,
    getProxyAudioUrl,
    startAsMaster,
    startAsRelay,
    setStandalone,
    getRole,
    getMasterId,
  };
}
