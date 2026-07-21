import { getUnreadQueue } from './lib/relayQueueView.js';

/**
 * relay.js — Écran relais léger
 *
 * Point d'entrée dédié pour les appareils relais (relay.html).
 * Aucune dépendance sur les modules principaux (DJPlayer, filRougeManager, etc.)
 *
 * Le relais ne joue plus l'audio localement — seul le maître produit le son. Ce
 * script se contente d'afficher l'état du maître et de servir de télécommande de
 * recherche pour alimenter sa file d'attente.
 *
 * Responsabilités :
 *   1. Lire ?relay-master=, ?relay-api= et ?relay-relay= depuis l'URL — relay-api
 *      cible l'API principale (recherche), relay-relay le process relay autonome
 *      (état, commandes), détaché de l'API principale depuis juillet 2026 (port 3003).
 *   2. Polling de l'état maître toutes les 1,5 s (dès le chargement de la page)
 *   3. Afficher jaquette / titre / artiste / progression (interpolée par horloge murale)
 *   4. Afficher la file d'attente non lue du maître
 *   5. Recherche + envoi de commandes (« Lire maintenant » / « Ajouter en suivant »)
 */

// ── Paramètres URL ────────────────────────────────────────────────────────────

const _p        = new URLSearchParams(location.search);
const MASTER_ID = _p.get('relay-master');
const API_BASE   = (_p.get('relay-api') || '').replace(/\/+$/, '');
// Process relay autonome (état/commandes), détaché de l'API principale — se replie
// sur API_BASE si absent (lien généré par une version antérieure du maître).
const RELAY_BASE = (_p.get('relay-relay') || API_BASE).replace(/\/+$/, '');
// Token priorité : transmis dans l'URL par le maître (relay-token), sinon localStorage du relais
const API_TOKEN = _p.get('relay-token') || localStorage.getItem('dj-mix:downloader:api:token') || '';

// Identifiant court, unique et permanent de cet appareil relais (pas un hash des
// caractéristiques du device — juste un aléa généré une fois puis persisté), pour
// attribuer les commandes envoyées au maître sans dépendre du fingerprinting.
function _getDeviceId() {
  const KEY = 'dj-mix:relay:device-id';
  let id = null;
  try { id = localStorage.getItem(KEY); } catch (_) { /* ignore */ }
  if (!id) {
    id = Math.random().toString(36).slice(2, 8).toUpperCase();
    try { localStorage.setItem(KEY, id); } catch (_) { /* ignore */ }
  }
  return id;
}
const DEVICE_ID = _getDeviceId();

// ── Références DOM ────────────────────────────────────────────────────────────

const $id = (id) => document.getElementById(id);

const artEl         = $id('relay-screen-art');
const artPlaceEl    = $id('relay-screen-art-placeholder');
const trackEl       = $id('relay-screen-track');
const artistEl      = $id('relay-screen-artist');
const metaEl        = $id('relay-screen-meta');
const progFillEl    = $id('relay-screen-progress-fill');
const progBarEl     = $id('relay-screen-progress-bar');
const timeCurEl     = $id('relay-screen-time-cur');
const timeTotalEl   = $id('relay-screen-time-total');
const queueWrapEl   = $id('relay-screen-queue');
const queueListEl   = $id('relay-screen-queue-list');
const fullscreenBtn = $id('relay-fullscreen-btn');

// ── Plein écran ───────────────────────────────────────────────────────────────

const _SVG_EXPAND =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';

const _SVG_COMPRESS =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>';

function _updateFullscreenBtn() {
  if (!fullscreenBtn) return;
  const isFs = !!document.fullscreenElement;
  fullscreenBtn.innerHTML = isFs ? _SVG_COMPRESS : _SVG_EXPAND;
  const label = isFs ? 'Quitter le plein écran' : 'Plein écran';
  fullscreenBtn.setAttribute('aria-label', label);
  fullscreenBtn.title = label;
}

if (fullscreenBtn) {
  fullscreenBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => {});
    } else {
      await document.exitFullscreen().catch(() => {});
    }
  });
  document.addEventListener('fullscreenchange', _updateFullscreenBtn);
  _updateFullscreenBtn();
}

// ── Utilitaires d'affichage ───────────────────────────────────────────────────

function _escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function _fmt(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

function _updateTrack({ name, artist, artUrl, bpm, genre } = {}) {
  if (trackEl)  trackEl.textContent  = name   || 'En attente du maître…';
  if (artistEl) artistEl.textContent = artist || '';
  if (metaEl) {
    const parts = [];
    if (bpm)   parts.push(`${Math.round(bpm)} BPM`);
    if (genre) parts.push(genre);
    metaEl.textContent = parts.join(' · ');
  }
  if (artUrl) {
    if (artEl)      { artEl.src = artUrl; artEl.hidden = false; }
    if (artPlaceEl) artPlaceEl.hidden = true;
  } else {
    if (artEl)      artEl.hidden = true;
    if (artPlaceEl) artPlaceEl.hidden = false;
  }
}

// ── File d'attente non lue du maître ─────────────────────────────────────────

function _updateQueueList(state) {
  if (!queueListEl || !queueWrapEl) return;
  const items = getUnreadQueue(state);
  if (!items.length) {
    queueWrapEl.hidden = true;
    queueListEl.innerHTML = '';
    return;
  }
  queueWrapEl.hidden = false;
  queueListEl.innerHTML = items.map((item) => {
    const art = item.artUrl
      ? `<img class="relay-screen-queue-item-art" src="${_escHtml(item.artUrl)}" alt="" loading="lazy">`
      : `<div class="relay-screen-queue-item-art"></div>`;
    return `<div class="relay-screen-queue-item">${art}` +
      `<div class="relay-screen-queue-item-info">` +
      `<span class="relay-screen-queue-item-name">${_escHtml(item.name)}</span>` +
      `<span class="relay-screen-queue-item-artist">${_escHtml(item.artist)}</span>` +
      `</div></div>`;
  }).join('');
}

// ── Progression (interpolation par horloge murale, pas de lecture audio locale) ─

let _posRefMs      = 0;
let _posRefAt      = 0;
let _posDurationMs = 0;
let _posPlaying    = false;
let _posTimer      = null;

function _setPosition(posMs, durMs, isPlaying) {
  _posRefMs      = posMs || 0;
  _posRefAt      = Date.now();
  _posDurationMs = durMs || 0;
  _posPlaying    = isPlaying;
  _tickProgress();
  if (!_posTimer) _posTimer = setInterval(_tickProgress, 500);
}

function _tickProgress() {
  const cur = _posPlaying ? _posRefMs + (Date.now() - _posRefAt) : _posRefMs;
  _updateProgress(cur, _posDurationMs);
}

function _updateProgress(posMs, durMs) {
  if (!durMs) return;
  const pct = Math.min(100, (posMs / durMs) * 100);
  if (progFillEl) progFillEl.style.width = `${pct.toFixed(1)}%`;
  if (progBarEl)  progBarEl.setAttribute('aria-valuenow', String(Math.round(pct)));
  if (timeCurEl)   timeCurEl.textContent   = _fmt(posMs);
  if (timeTotalEl) timeTotalEl.textContent = _fmt(durMs);
}

/** Durée connue par trackId (issue des métadonnées queue/filRouge du maître). */
const _trackDurations = new Map();

function _refreshPosition(state) {
  const { activeDeck = 'A', deckA, deckB, capturedAt, pushedAt, isPlaying = true, currentTrackId } = state;
  const activeDeckState = activeDeck === 'A' ? deckA : deckB;
  if (!activeDeckState || activeDeckState.positionMs === undefined) return;
  const now = Date.now();
  const refTime = capturedAt || pushedAt || now;
  const latencyMs = Math.max(0, now - refTime);
  const durMs = _trackDurations.get(currentTrackId) || 0;
  _setPosition(activeDeckState.positionMs + latencyMs, durMs, Boolean(isPlaying));
}

// ── Polling et application de l'état ─────────────────────────────────────────

let _lastHash   = null;
let _curTrackId = null;

// ── File "incoming" (Lire maintenant / Ajouter en suivant) ───────────────────
// Tant qu'aucune réponse fiable du maître n'a été reçue (ou après une perte de
// connexion prolongée), on ne sait pas si les slots sont disponibles : les
// boutons restent masqués et « En attente du maître… » est affiché à la place.
const RELAY_MASTER_STALE_AFTER = 3; // échecs consécutifs (~4.5 s à 1500 ms/poll)
let _relayIncomingKnown  = false;
let _lastRelayIncoming   = null;
let _consecutiveFailures = 0;

function _registerPollFailure() {
  _consecutiveFailures += 1;
  if (_consecutiveFailures >= RELAY_MASTER_STALE_AFTER && _relayIncomingKnown) {
    _relayIncomingKnown = false;
    _updateActionSheetVisibility();
  }
}

function _authHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (API_TOKEN) h['x-api-token'] = API_TOKEN;
  return h;
}

async function _poll() {
  try {
    const res = await fetch(`${RELAY_BASE}/api/relay/state/${MASTER_ID}`, {
      headers: _authHeaders(),
    });
    if (!res.ok) { _registerPollFailure(); return; }
    const state = await res.json().catch(() => null);
    if (!state?.pushedAt) return;

    // Rafraîchi à chaque poll réussi, indépendamment du hash de dédoublonnage
    // (nextCount et la position peuvent évoluer sans que le reste de l'état bouge).
    _consecutiveFailures = 0;
    _relayIncomingKnown = true;
    _lastRelayIncoming = state.relayIncoming || { nowPending: false, nextCount: 0, nextMax: 0 };
    _updateActionSheetVisibility();
    _refreshPosition(state);

    const hash = _stateHash(state);
    if (hash === _lastHash) return;
    _lastHash = hash;

    _applyState(state);
  } catch (err) {
    _registerPollFailure();
  }
}

function _applyState(state) {
  const { currentTrackId, queue = [], filRouge = [] } = state;

  // Durées connues, pour l'affichage de la progression (pas de téléchargement local).
  for (const item of [...queue, ...filRouge]) {
    if (item.id && item.duration) _trackDurations.set(item.id, item.duration);
  }

  _updateQueueList(state);

  if (currentTrackId && currentTrackId !== _curTrackId) {
    const item = queue.find((i) => i.id === currentTrackId)
              || filRouge.find((i) => i.id === currentTrackId);
    if (item) {
      _updateTrack({
        name:   item.name,
        artist: item.artist,
        artUrl: item.artUrl,
        bpm:    item.bpm,
        genre:  item.genre,
      });
    }
    _curTrackId = currentTrackId;
    _refreshPosition(state);
  }
}

// ── Hash léger de l'état (ne déclenche un re-rendu que si nécessaire) ────────

function _stateHash(s) {
  return [
    s.currentTrackId || '',
    s.currentIndex ?? '',
    (s.queue || []).map((i) => i.id).join(','),
    (s.filRouge || []).length,
  ].join('|');
}

// ── Recherche de chanson ─────────────────────────────────────────────────────

const searchBtn      = $id('relay-search-btn');
const searchOverlay  = $id('relay-search-overlay');
const searchInput    = $id('relay-search-input');
const searchClear    = $id('relay-search-clear');
const searchBack     = $id('relay-search-back');
const searchResults  = $id('relay-search-results');
const actionSheet    = $id('relay-action-sheet');
const actionArt      = $id('relay-action-art');
const actionName     = $id('relay-action-name');
const actionArtist   = $id('relay-action-artist');
const actionWaiting  = $id('relay-action-waiting');
const playNowBtn     = $id('relay-action-play-now');
const playNextBtn    = $id('relay-action-play-next');
const actionCancel   = $id('relay-action-cancel');
const toastEl        = $id('relay-toast');

const _SVG_SEARCH =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';

if (searchBtn) searchBtn.innerHTML = _SVG_SEARCH;

let _searchDebounce = null;
let _selectedTrack = null;
let _toastTimer = null;

function _openSearch() {
  if (!searchOverlay) return;
  searchOverlay.hidden = false;
  searchInput?.focus();
}

function _closeSearch() {
  if (!searchOverlay) return;
  searchOverlay.hidden = true;
  if (searchInput) searchInput.value = '';
  if (searchClear) searchClear.hidden = true;
  if (searchResults) searchResults.innerHTML = '';
}

function _fmtDuration(ms) {
  if (!ms || !Number.isFinite(ms)) return '';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

async function _relaySearch(query) {
  if (!query || !API_BASE) return;
  if (searchResults) searchResults.innerHTML = '<div class="relay-search-loading">Recherche…</div>';

  const params = new URLSearchParams({ term: query, limit: '15' });
  const headers = {};
  if (API_TOKEN) headers['x-api-token'] = API_TOKEN;
  headers['Accept'] = 'application/json';

  try {
    const res = await fetch(`${API_BASE}/api/search?${params}`, { headers });
    if (!res.ok) {
      _renderSearchEmpty('Erreur de recherche');
      return;
    }
    const data = await res.json();
    const tracks = Array.isArray(data?.tracks?.results) ? data.tracks.results : [];
    _renderSearchResults(tracks);
  } catch {
    _renderSearchEmpty('Erreur réseau');
  }
}

function _renderSearchResults(tracks) {
  if (!searchResults) return;
  if (!tracks.length) {
    _renderSearchEmpty('Aucun résultat');
    return;
  }

  searchResults.innerHTML = tracks.map((t, i) => {
    const art = t.artUrl || t.artworkUrl || t.artworkUrl100 || '';
    const name = _escHtml(t.name || t.trackName || t.title || '');
    const artist = _escHtml(t.artist || t.artistName || '');
    const dur = _fmtDuration(t.duration_ms || t.trackTimeMillis);
    return `<div class="relay-search-result" data-idx="${i}">` +
      (art ? `<img class="relay-search-result-art" src="${_escHtml(art)}" alt="" loading="lazy">` :
             `<div class="relay-search-result-art"></div>`) +
      `<div class="relay-search-result-info">` +
        `<div class="relay-search-result-name">${name}</div>` +
        `<div class="relay-search-result-artist">${artist}</div>` +
      `</div>` +
      (dur ? `<span class="relay-search-result-dur">${dur}</span>` : '') +
      `</div>`;
  }).join('');

  searchResults._tracks = tracks;
}

function _renderSearchEmpty(msg) {
  if (searchResults) searchResults.innerHTML = `<div class="relay-search-empty">${_escHtml(msg)}</div>`;
}

function _showActionSheet(track) {
  if (!actionSheet || !track) return;
  _selectedTrack = track;
  const art = track.artUrl || track.artworkUrl100 || '';
  if (actionArt) {
    actionArt.src = art;
    actionArt.hidden = !art;
  }
  if (actionName) actionName.textContent = track.name || track.trackName || track.title || '';
  if (actionArtist) actionArtist.textContent = track.artist || track.artistName || '';
  actionSheet.hidden = false;
  _updateActionSheetVisibility();
}

/**
 * Affiche/masque « Lire maintenant » et « Ajouter en suivant » selon l'état des
 * files "incoming" du maître (cf. SPECS.md §9.4). Tant qu'aucune info fiable
 * n'a été reçue, affiche « En attente du maître… » à la place des boutons.
 */
function _updateActionSheetVisibility() {
  if (!actionWaiting || !playNowBtn || !playNextBtn) return;

  if (!_relayIncomingKnown) {
    actionWaiting.hidden = false;
    playNowBtn.hidden = true;
    playNextBtn.hidden = true;
    return;
  }

  actionWaiting.hidden = true;
  playNowBtn.hidden = Boolean(_lastRelayIncoming?.nowPending);

  const nextCount = _lastRelayIncoming?.nextCount ?? 0;
  const nextMax = _lastRelayIncoming?.nextMax ?? Infinity;
  const full = nextCount >= nextMax;
  playNextBtn.hidden = false;
  playNextBtn.disabled = full;
  playNextBtn.textContent = full ? `File pleine (${nextCount}/${nextMax})` : 'Ajouter en suivant';
}

function _hideActionSheet() {
  if (actionSheet) actionSheet.hidden = true;
  _selectedTrack = null;
}

function _buildTrackPayload(track) {
  return {
    id: track.id || track.trackId || '',
    name: track.name || track.trackName || track.title || '',
    artist: track.artist || track.artistName || '',
    artUrl: track.artUrl || track.artworkUrl || track.artworkUrl100 || '',
    duration_ms: track.duration_ms || track.trackTimeMillis || 0,
    uri: track.uri || '',
    downloadUrl: track.downloadUrl || track.persistedSourceUrl || '',
  };
}

async function _sendRelayCommand(cmd) {
  if (!RELAY_BASE || !MASTER_ID) return;
  cmd.requestedAt = Date.now();
  cmd.deviceId = DEVICE_ID;
  try {
    await fetch(`${RELAY_BASE}/api/relay/commands/${MASTER_ID}`, {
      method: 'POST',
      headers: _authHeaders(),
      body: JSON.stringify(cmd),
    });
  } catch { /* ignore */ }
}

function _showRelayToast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.hidden = false;
  toastEl.classList.add('visible');
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    toastEl.classList.remove('visible');
    setTimeout(() => { toastEl.hidden = true; }, 300);
  }, 2000);
}

// ── Événements recherche ────────────────────────────────────────────────────

searchBtn?.addEventListener('click', (e) => { e.stopPropagation(); _openSearch(); });
searchBack?.addEventListener('click', _closeSearch);

searchInput?.addEventListener('input', () => {
  const q = (searchInput.value || '').trim();
  if (searchClear) searchClear.hidden = !q;
  clearTimeout(_searchDebounce);
  if (!q) {
    if (searchResults) searchResults.innerHTML = '';
    return;
  }
  _searchDebounce = setTimeout(() => _relaySearch(q), 500);
});

searchInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    clearTimeout(_searchDebounce);
    const q = (searchInput.value || '').trim();
    if (q) _relaySearch(q);
  }
});

searchClear?.addEventListener('click', () => {
  if (searchInput) searchInput.value = '';
  if (searchClear) searchClear.hidden = true;
  if (searchResults) searchResults.innerHTML = '';
  searchInput?.focus();
});

searchResults?.addEventListener('click', (e) => {
  const row = e.target.closest('.relay-search-result');
  if (!row) return;
  const idx = Number(row.dataset.idx);
  const tracks = searchResults._tracks;
  if (tracks && tracks[idx]) _showActionSheet(tracks[idx]);
});

playNowBtn?.addEventListener('click', () => {
  if (!_selectedTrack) return;
  _sendRelayCommand({ type: 'addToQueue', track: _buildTrackPayload(_selectedTrack), playNow: true });
  _showRelayToast(`${_selectedTrack.name || 'Piste'} — lecture imminente`);
  _hideActionSheet();
  _closeSearch();
});

playNextBtn?.addEventListener('click', () => {
  if (!_selectedTrack) return;
  _sendRelayCommand({ type: 'addToQueue', track: _buildTrackPayload(_selectedTrack), playNow: false });
  _showRelayToast(`${_selectedTrack.name || 'Piste'} — ajoutée en file d'attente`);
  _hideActionSheet();
  _closeSearch();
});

actionCancel?.addEventListener('click', _hideActionSheet);
actionSheet?.querySelector('.relay-action-sheet-backdrop')?.addEventListener('click', _hideActionSheet);

// ── Démarrage ─────────────────────────────────────────────────────────────────

if (!MASTER_ID) {
  document.body.innerHTML =
    '<p style="color:#8888aa;padding:32px;font-family:sans-serif">' +
    'Paramètre <code>relay-master</code> manquant dans l\'URL.<br>' +
    'Scannez le QR code affiché sur l\'appareil maître.' +
    '</p>';
} else {
  // Pas de lecture audio locale : aucun geste utilisateur requis, le polling
  // démarre dès le chargement de la page.
  _poll();
  setInterval(_poll, 1500);
}
