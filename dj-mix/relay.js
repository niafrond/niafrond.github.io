import { createRelayStreamController } from './lib/relayStreamController.js';

/**
 * relay.js — Lecteur relais ultra-léger
 *
 * Point d'entrée dédié pour les appareils relais (relay.html).
 * Aucune dépendance sur les modules principaux (DJPlayer, filRougeManager, etc.)
 *
 * Responsabilités :
 *   1. Lire ?relay-session= et ?relay-api= depuis l'URL
 *   2. Polling de l'état maître toutes les 1,5 s
 *   3. Télécharger et mettre en cache TOUTES les pistes (queue + fil rouge entier)
 *      — agressivement au premier poll, puis en continu sur chaque mise à jour
 *   4. Lire la piste active avec la bonne position et corriger la dérive
 *   5. Appliquer les transitions (crossfade / cut / fade) et les FX (filter, echo, distortion)
 *   6. Mettre à jour l'écran relais minimal
 */

// ── Paramètres URL ────────────────────────────────────────────────────────────

const _p        = new URLSearchParams(location.search);
const SESSION   = _p.get('relay-session');
const API_BASE  = (_p.get('relay-api') || '').replace(/\/+$/, '');
// Token priorité : transmis dans l'URL par le maître (relay-token), sinon localStorage du relais
const API_TOKEN = _p.get('relay-token') || localStorage.getItem('dj-mix:downloader:api:token') || '';

// ── Références DOM ────────────────────────────────────────────────────────────

const $id = (id) => document.getElementById(id);

const tapOverlay    = $id('relay-tap-overlay');
const statusEl      = $id('relay-screen-status');
const artEl         = $id('relay-screen-art');
const artPlaceEl    = $id('relay-screen-art-placeholder');
const trackEl       = $id('relay-screen-track');
const artistEl      = $id('relay-screen-artist');
const metaEl        = $id('relay-screen-meta');
const progFillEl    = $id('relay-screen-progress-fill');
const progBarEl     = $id('relay-screen-progress-bar');
const timeCurEl     = $id('relay-screen-time-cur');
const timeTotalEl   = $id('relay-screen-time-total');
const nextWrapEl    = $id('relay-screen-next');
const nextArtEl     = $id('relay-screen-next-art');
const nextNameEl    = $id('relay-screen-next-name');
const nextArtistEl  = $id('relay-screen-next-artist');
const dlFillEl      = $id('relay-screen-dl-fill');
const dlLabelEl     = $id('relay-screen-dl-label');
const fullscreenBtn = $id('relay-fullscreen-btn');
const streamBtn     = $id('relay-stream-btn');

// ── Plein écran ───────────────────────────────────────────────────────────────

const _SVG_PLAY =
  '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';

const _SVG_STOP_STREAM =
  '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>';

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

// ── Cache blob ────────────────────────────────────────────────────────────────

/** trackId (ou persistedSourceUrl si id vide) → objectURL */
const _blobCache    = new Map();
const _downloading  = new Set();

/** File de téléchargement bornée à MAX_DL_SLOTS simultanés */
const MAX_DL_SLOTS = 3;
let   _dlSlots     = MAX_DL_SLOTS;
const _dlQueue     = [];

/** Nombre total de pistes à télécharger dans cette session (pour la barre) */
let _dlTotal    = 0;
let _dlDone     = 0;

function _blobKey(item) {
  return String(item.id || item.persistedSourceUrl || '').trim();
}

function _enqueueDownload(item) {
  const key = _blobKey(item);
  if (!key || !item.persistedSourceUrl) return;
  if (_blobCache.has(key) || _downloading.has(key)) return;
  if (_dlQueue.some((i) => _blobKey(i) === key)) return;
  _dlQueue.push(item);
  _dlTotal = Math.max(_dlTotal, _dlDone + _dlQueue.length);
  _pumpDl();
}

function _pumpDl() {
  while (_dlSlots > 0 && _dlQueue.length > 0) {
    const item = _dlQueue.shift();
    _dlSlots--;
    _fetchBlob(item).finally(() => {
      _dlSlots++;
      _pumpDl();
      _refreshDlBar();
    });
  }
}

async function _fetchBlob(item) {
  const key = _blobKey(item);
  if (!key || _blobCache.has(key)) return;
  // blob: URLs n'existent que dans le browser du maître — inutile de tenter
  if (!item.persistedSourceUrl || item.persistedSourceUrl.startsWith('blob:')) {
    if (item.id) {
      const proxyUrl = _proxyUrl(item.id);
      if (proxyUrl) {
        _downloading.add(key);
        try {
          const blob = await _httpBlob(proxyUrl);
          if (blob) {
            _blobCache.set(key, URL.createObjectURL(blob));
            _dlDone++;
            _downloading.delete(key);
            return;
          }
        } catch (_) {}
        _downloading.delete(key);
      }
    }
    return;
  }
  _downloading.add(key);
  try {
    const blob = await _httpBlob(item.persistedSourceUrl);
    if (blob) {
      _blobCache.set(key, URL.createObjectURL(blob));
      _dlDone++;
      _downloading.delete(key);
      return;
    }
  } catch (_) {}

  // Fallback : proxy maître
  if (item.id) {
    const proxyUrl = _proxyUrl(item.id);
    if (proxyUrl) {
      try {
        const blob = await _httpBlob(proxyUrl);
        if (blob) {
          _blobCache.set(key, URL.createObjectURL(blob));
          _dlDone++;
          _downloading.delete(key);
          return;
        }
      } catch (_) {}
    }
  }
  _downloading.delete(key);
}

async function _httpBlob(url) {
  const headers = {};
  if (API_TOKEN) headers['x-api-token'] = API_TOKEN;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

function _proxyUrl(trackId) {
  if (!trackId || !SESSION || !API_BASE) return null;
  const qs = API_TOKEN ? `?x-api-token=${encodeURIComponent(API_TOKEN)}` : '';
  return `${API_BASE}/api/relay/audio/${SESSION}/${trackId}${qs}`;
}

function _getBlobUrl(item) {
  return _blobCache.get(_blobKey(item)) || null;
}

function _refreshDlBar() {
  if (!dlFillEl || !dlLabelEl) return;
  const remaining = _dlQueue.length + _downloading.size;
  if (_dlTotal === 0 || remaining === 0) {
    dlFillEl.style.width = '0%';
    dlLabelEl.textContent = '';
    return;
  }
  const pct = Math.round((_dlDone / _dlTotal) * 100);
  dlFillEl.style.width = `${pct}%`;
  dlLabelEl.textContent = `${remaining} piste${remaining > 1 ? 's' : ''} en cache…`;
}

// ── Moteur audio minimal ──────────────────────────────────────────────────────

let _ctx         = null;
let _masterGain  = null;
let _filterNode  = null;
let _echoDelay   = null;
let _echoFb      = null;   // feedback gain
let _echoOut     = null;   // wet output gain
let _distNode    = null;   // WaveShaperNode

/**
 * Deck : { audio: HTMLAudioElement, source: MediaElementAudioSourceNode, gain: GainNode }
 * Index 0 → deck A, 1 → deck B
 */
const _decks = [null, null];
let _activeDeckIdx = 0;

function _deckIdxOf(deck) { return deck === 'B' ? 1 : 0; }

async function _initAudio() {
  if (_ctx) return;
  _ctx = new AudioContext();

  // Chaîne : decks → filter → distortion → echoSend → masterGain → destination
  _masterGain = _ctx.createGain();
  _masterGain.connect(_ctx.destination);

  // Distortion (passthrough tant que disabled)
  _distNode = _ctx.createWaveShaper();
  _distNode.curve = null; // pas de distorsion
  _distNode.connect(_masterGain);

  // Filter biquad (allpass = neutre)
  _filterNode = _ctx.createBiquadFilter();
  _filterNode.type = 'allpass';
  _filterNode.connect(_distNode);

  // Echo : delay → feedback ↺ delay → echoOut → masterGain (wet)
  _echoDelay = _ctx.createDelay(1.0);
  _echoDelay.delayTime.value = 0.35;
  _echoFb = _ctx.createGain();
  _echoFb.gain.value = 0.38;
  _echoOut = _ctx.createGain();
  _echoOut.gain.value = 0; // écho désactivé par défaut

  _echoDelay.connect(_echoFb);
  _echoFb.connect(_echoDelay);   // boucle feedback (cycle permis car DelayNode présent)
  _echoDelay.connect(_echoOut);
  _echoOut.connect(_masterGain); // wet → sortie principale

  // Création des 2 decks
  for (let i = 0; i < 2; i++) {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'none';
    const source = _ctx.createMediaElementSource(audio);
    const gain   = _ctx.createGain();
    gain.gain.value = 0; // silence par défaut
    source.connect(gain);
    gain.connect(_filterNode);  // chemin sec (avec filtre + distortion)
    gain.connect(_echoDelay);   // envoi écho
    _decks[i] = { audio, source, gain };
  }

  if (_ctx.state === 'suspended') await _ctx.resume();
}

/** Charge un blob dans un deck et attend canplay. */
async function _loadDeck(idx, blobUrl) {
  const deck = _decks[idx];
  if (!deck) return;
  if (deck.audio.src === blobUrl) return;
  deck.audio.pause();
  deck.audio.src = blobUrl;
  deck.audio.load();
  await new Promise((resolve) => {
    const done = () => resolve();
    deck.audio.addEventListener('canplay', done, { once: true });
    deck.audio.addEventListener('error',   done, { once: true });
  });
}

/** Joue immédiatement un deck avec seek (cut ou premier démarrage). */
async function _playDeck(idx, blobUrl, seekMs = 0) {
  const deck = _decks[idx];
  if (!deck) return;
  if (_ctx?.state === 'suspended') await _ctx.resume().catch(() => {});
  await _loadDeck(idx, blobUrl);
  deck.audio.currentTime = Math.max(0, seekMs / 1000);
  deck.gain.gain.cancelScheduledValues(_ctx.currentTime);
  deck.gain.gain.setValueAtTime(1, _ctx.currentTime);
  try { await deck.audio.play(); } catch (_) {}
}

/** Crossfade vers un nouveau deck. */
async function _crossfade(toIdx, blobUrl, seekMs, durationMs = 3000) {
  const fromIdx = 1 - toIdx;
  const from    = _decks[fromIdx];
  const to      = _decks[toIdx];
  if (!from || !to) return;

  if (_ctx?.state === 'suspended') await _ctx.resume().catch(() => {});
  await _loadDeck(toIdx, blobUrl);
  to.audio.currentTime = Math.max(0, seekMs / 1000);

  const now = _ctx.currentTime;
  const dur = Math.max(0.1, durationMs / 1000);

  to.gain.gain.cancelScheduledValues(now);
  from.gain.gain.cancelScheduledValues(now);
  to.gain.gain.setValueAtTime(0, now);
  from.gain.gain.setValueAtTime(from.gain.gain.value, now);

  try { await to.audio.play(); } catch (_) {}

  to.gain.gain.linearRampToValueAtTime(1, now + dur);
  from.gain.gain.linearRampToValueAtTime(0, now + dur);

  setTimeout(() => {
    from.audio.pause();
    // Libérer la source du deck inactif
    // (ne pas faire .src = '' pour éviter de reconstruire MediaElementSource)
    from.gain.gain.cancelScheduledValues(_ctx.currentTime);
    from.gain.gain.setValueAtTime(0, _ctx.currentTime);
  }, durationMs + 300);
}

/** Pause tous les decks. */
function _pauseAll() {
  for (const d of _decks) d?.audio.pause();
}

// ── Application des FX ────────────────────────────────────────────────────────

const _DIST_CURVE = (() => {
  const n = 256, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = (Math.PI + 200) * x / (Math.PI + 200 * Math.abs(x));
  }
  return curve;
})();

/**
 * Applique l'état FX reçu du maître.
 * @param {{ echo?: boolean, distortion?: boolean, filterType?: string, filterFreq?: number, filterQ?: number }} fx
 */
function _applyFx(fx) {
  if (!_ctx || !fx) return;
  const now = _ctx.currentTime;

  // Filtre
  if (fx.filterType && fx.filterType !== 'none') {
    _filterNode.type = fx.filterType;
    _filterNode.frequency.setTargetAtTime(fx.filterFreq || 2000, now, 0.05);
    _filterNode.Q.setTargetAtTime(fx.filterQ || 1, now, 0.05);
  } else {
    _filterNode.type = 'allpass';
  }

  // Écho
  const echoWet = fx.echo ? 0.45 : 0;
  _echoOut.gain.setTargetAtTime(echoWet, now, 0.1);
  _echoFb.gain.setTargetAtTime(fx.echo ? 0.38 : 0, now, 0.1);

  // Distortion
  _distNode.curve = fx.distortion ? _DIST_CURVE : null;
}

// ── Suivi de la position en temps réel (sub-milliseconde) ───────────────────
//
// Horloge de référence : AudioContext.currentTime (clock matériel audio).
// Élimine toute dérive entre le tracking et la lecture réelle — les deux
// partagent le même oscillateur hardware.

let _posTimer        = null;
let _posStartMs      = 0;   // position audio en ms au moment _posT0
let _posT0           = 0;   // _ctx.currentTime (secondes) à la capture
let _posDurationMs   = 0;

function _audioClock() {
  return _ctx ? _ctx.currentTime : performance.now() / 1000;
}

function _currentPosMs() {
  return _posStartMs + (_audioClock() - _posT0) * 1000;
}

function _startPosTracking(posMs, durationMs) {
  _stopPosTracking();
  _posStartMs    = posMs;
  _posT0         = _audioClock();
  _posDurationMs = durationMs;
  _posTimer = setInterval(() => {
    const cur = _currentPosMs();
    if (cur >= _posDurationMs) { _stopPosTracking(); return; }
    _updateProgress(cur, _posDurationMs);
  }, 50);
}

function _stopPosTracking() {
  if (_posTimer) { clearInterval(_posTimer); _posTimer = null; }
}

// ── Cache de durée par trackId ──────────────────────────────────────────────

const _trackDurations = new Map();

// ── UI ────────────────────────────────────────────────────────────────────────

function _setStatus(text) {
  if (statusEl) statusEl.textContent = text;
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

function _updateNextTrack(state) {
  if (!nextWrapEl) return;
  const { currentTrackId, deckA, deckB, queue = [], filRouge = [] } = state;
  if (!currentTrackId) { nextWrapEl.hidden = true; return; }

  const nextId = deckA?.trackId === currentTrackId
    ? deckB?.trackId
    : deckA?.trackId;

  if (!nextId || nextId === currentTrackId) {
    nextWrapEl.hidden = true;
    return;
  }

  const item = queue.find((i) => i.id === nextId)
            || filRouge.find((i) => i.id === nextId);
  if (!item) { nextWrapEl.hidden = true; return; }

  if (nextArtEl) {
    const art = item.artUrl || '';
    if (art) { nextArtEl.src = art; nextArtEl.hidden = false; }
    else     { nextArtEl.hidden = true; }
  }
  if (nextNameEl)   nextNameEl.textContent   = item.name || '';
  if (nextArtistEl) nextArtistEl.textContent = item.artist || '';
  nextWrapEl.hidden = false;
}

function _updateProgress(posMs, durMs) {
  if (!durMs) return;
  const pct = Math.min(100, (posMs / durMs) * 100);
  if (progFillEl) progFillEl.style.width = `${pct.toFixed(1)}%`;
  if (progBarEl)  progBarEl.setAttribute('aria-valuenow', String(Math.round(pct)));
  if (timeCurEl)  timeCurEl.textContent  = _fmt(posMs);
  if (timeTotalEl) timeTotalEl.textContent = _fmt(durMs);
}

function _fmt(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

// ── Événements planifiés (transition / FX anticipés par le maître) ────────────

/** Map : event.at (ms timestamp absolu) → timeoutId */
const _scheduled = new Map();
/** Dernier état complet reçu, pour drift correction locale */
let _lastState = null;

/**
 * Synchronise les événements planifiés reçus du maître.
 * Annule ceux qui ont disparu, programme les nouveaux.
 */
function _syncScheduled(events = []) {
  const incoming = new Map(events.map((e) => [e.at, e]));

  // Annuler les timeouts qui ne sont plus dans la liste
  for (const [at, tid] of _scheduled) {
    if (!incoming.has(at)) { clearTimeout(tid); _scheduled.delete(at); }
  }

  const now = Date.now();
  for (const [at, event] of incoming) {
    if (_scheduled.has(at)) continue;
    const delay = Math.max(0, at - now);
    const tid = setTimeout(() => {
      _scheduled.delete(at);
      _executeScheduled(event).catch(() => {});
    }, delay);
    _scheduled.set(at, tid);
  }
}

async function _executeScheduled(event) {
  if (event.type === 'transition') {
    const { toTrackId, toTrackUrl, mode, durationMs = 3000 } = event;
    if (!toTrackId) return;

    // Trouver le blob (déjà en cache si le pré-dl a fonctionné)
    let blobUrl = _blobCache.get(toTrackId) || _blobCache.get(toTrackUrl);
    if (!blobUrl && toTrackUrl) {
      // Téléchargement d'urgence si pas encore en cache
      blobUrl = await _fetchBlobNow({ id: toTrackId, persistedSourceUrl: toTrackUrl });
    }
    if (!blobUrl) return;

    const newDeckIdx = 1 - _curDeckIdx;
    if (mode === 'cut') {
      _pauseAll();
      await _playDeck(newDeckIdx, blobUrl, 0);
    } else {
      await _crossfade(newDeckIdx, blobUrl, 0, durationMs);
    }
    _curTrackId  = toTrackId;
    _curDeckIdx  = newDeckIdx;
    _activeDeckIdx = newDeckIdx;
    const nextDurMs = event.toTrackDurationMs || _trackDurations.get(toTrackId) || 0;
    const deckAudio = _decks[newDeckIdx]?.audio;
    const audioDurMs = (deckAudio?.duration && isFinite(deckAudio.duration))
      ? deckAudio.duration * 1000 : 0;
    _startPosTracking(0, nextDurMs || audioDurMs || _posDurationMs);

  } else if (event.type === 'fx') {
    // L'event contient les champs retournés par peekNextAutoFxEvent + éventuels feature/enabled
    const fxPatch = {};
    if ('echo'       in event) fxPatch.echo       = event.echo;
    if ('distortion' in event) fxPatch.distortion = event.distortion;
    if ('feature'    in event && 'enabled' in event) fxPatch[event.feature] = event.enabled;
    if (Object.keys(fxPatch).length) _applyFx(fxPatch);
  }
}

// ── Correction de dérive autonome (requestAnimationFrame, seuil < 0.5 ms) ──
//
// Tourne à chaque frame GPU (~4 ms à 240 Hz, ~16 ms à 60 Hz).
// Compare audio.currentTime (hardware clock) à la position attendue
// du maître et applique une micro-correction playbackRate en continu.

let _driftRAF = null;
let _driftCorrecting = false;

function _driftLoop() {
  _driftCheck();
  _driftRAF = requestAnimationFrame(_driftLoop);
}

function _startDriftLoop() {
  if (_driftRAF) return;
  _driftRAF = requestAnimationFrame(_driftLoop);
}

function _stopDriftLoop() {
  if (_driftRAF) { cancelAnimationFrame(_driftRAF); _driftRAF = null; }
}

function _driftCheck() {
  if (!_lastState || !_audioReady) return;
  const { activeDeck, capturedAt, pushedAt, isPlaying } = _lastState;
  if (!isPlaying) return;
  const deckState = activeDeck === 'A' ? _lastState.deckA : _lastState.deckB;
  if (!deckState?.positionMs || !capturedAt) return;

  const refTime   = capturedAt || pushedAt;
  const expected  = deckState.positionMs + (Date.now() - refTime);
  const deck      = _decks[_curDeckIdx];
  if (!deck?.audio || deck.audio.paused) return;
  const actual    = deck.audio.currentTime * 1000;
  const drift     = expected - actual;
  const absDrift  = Math.abs(drift);

  if (absDrift < 0.5) {
    if (_driftCorrecting) {
      deck.audio.playbackRate = 1.0;
      _driftCorrecting = false;
    }
    return;
  }

  if (absDrift > 100) {
    deck.audio.playbackRate = 1.0;
    _driftCorrecting = false;
    _seekDeck(_curDeckIdx, expected);
    _startPosTracking(expected, _posDurationMs);
    return;
  }

  // Correction proportionnelle : plus la dérive est grande, plus on corrige vite
  // ratio = drift / 500 → pour 1ms drift on applique ±0.002, pour 50ms → ±0.1
  const ratio = Math.min(0.05, absDrift / 500);
  deck.audio.playbackRate = drift > 0 ? (1 - ratio) : (1 + ratio);
  _driftCorrecting = true;
  _posStartMs = expected;
  _posT0 = _audioClock();
}

// ── Contrôle du flux (start / stop manuel) ───────────────────────────────────

function _updateStreamBtn(active) {
  if (!streamBtn) return;
  streamBtn.innerHTML = active ? _SVG_STOP_STREAM : _SVG_PLAY;
  const label = active ? 'Arrêter le flux' : 'Lancer le flux';
  streamBtn.title = label;
  streamBtn.setAttribute('aria-label', label);
  streamBtn.classList.toggle('relay-stream-btn--stop', active);
}

const _streamController = createRelayStreamController({
  onStart() {
    // Forcer la ré-application du dernier état connu pour démarrer l'audio immédiatement
    _lastHash = null;
    _startDriftLoop();
    _updateStreamBtn(true);
    _setStatus('Connexion au maître…');
  },
  onStop() {
    _stopDriftLoop();
    _pauseAll();
    _stopPosTracking();
    _updateStreamBtn(false);
    _setStatus('Flux arrêté · ▶ pour reprendre');
  },
});

streamBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  _streamController.toggle();
});

// ── Polling et application de l'état ─────────────────────────────────────────

let _lastHash      = null;
let _curTrackId    = null;
let _curDeckIdx    = 0;
let _audioReady    = false;

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
  if (!_audioReady) return;
  try {
    const res = await fetch(`${API_BASE}/api/relay/state/${SESSION}`, {
      headers: _authHeaders(),
    });
    if (!res.ok) {
      _setStatus('Maître hors ligne…');
      _registerPollFailure();
      return;
    }
    const state = await res.json().catch(() => null);
    if (!state?.pushedAt) return;

    _resyncPosition(state);

    const hash = _stateHash(state);
    if (hash === _lastHash) return;
    _lastHash = hash;

    await _applyState(state);
  } catch (err) {
    _setStatus(`Réseau : ${err.message}`);
    _registerPollFailure();
  }
}

function _resyncPosition(state) {
  _lastState = state;

  // Rafraîchi à chaque poll réussi, indépendamment du hash de dédoublonnage
  // (nextCount peut évoluer sans que le reste de l'état bouge).
  _consecutiveFailures = 0;
  _relayIncomingKnown = true;
  _lastRelayIncoming = state.relayIncoming || { nowPending: false, nextCount: 0, nextMax: 0 };
  _updateActionSheetVisibility();

  if (!_streamController.isActive() || !state.isPlaying || !_curTrackId) return;

  const { activeDeck, deckA, deckB, capturedAt, pushedAt } = state;
  const activeDeckState = activeDeck === 'A' ? deckA : deckB;
  if (activeDeckState?.positionMs === undefined) return;

  const now = Date.now();
  const refTime = capturedAt || pushedAt || now;
  const latencyMs = Math.max(0, now - refTime);
  const target = activeDeckState.positionMs + latencyMs;

  const deck = _decks[_curDeckIdx];
  if (!deck?.audio || deck.audio.paused) return;

  const current = deck.audio.currentTime * 1000;
  const absDrift = Math.abs(target - current);

  const driftInfo = absDrift < 0.5 ? ' · sync' :
    absDrift < 10 ? ` · Δ${absDrift.toFixed(2)}ms` : ` · Δ${Math.round(absDrift)}ms`;
  _setStatus(
    `Maître · ${new Date(now).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}${driftInfo}`
  );

  _posStartMs = target;
  _posT0 = _audioClock();
}

async function _applyState(state) {
  const {
    currentTrackId,
    activeDeck   = 'A',
    deckA, deckB,
    isPlaying    = true,
    queue        = [],
    filRouge     = [],
    transitionMode = 'crossfade',
    crossfadeMs  = 3000,
    capturedAt,
    pushedAt,
    fx,
    upcoming     = [],
  } = state;

  // Garder une référence à l'état pour la correction de dérive autonome
  _lastState = state;

  // 1. Enqueue téléchargements de tout le fil rouge ET la queue
  const allItems = [...queue, ...filRouge];
  for (const item of allItems) {
    if (item.persistedSourceUrl) _enqueueDownload(item);
    if (item.id && item.duration) _trackDurations.set(item.id, item.duration);
  }
  // Pré-télécharger en priorité les pistes des événements à venir
  for (const ev of upcoming) {
    if (ev.type === 'transition' && ev.toTrackUrl) {
      _enqueueDownload({ id: ev.toTrackId, persistedSourceUrl: ev.toTrackUrl });
    }
  }
  _refreshDlBar();

  // 2. Décalage temporel précis
  const now = Date.now();
  const refTime = capturedAt || pushedAt || now;
  const latencyMs = Math.max(0, now - refTime);
  const driftInfo = (() => {
    const deck = _decks[_curDeckIdx];
    if (!deck?.audio || deck.audio.paused || !capturedAt) return '';
    const expected = (activeDeck === 'A' ? deckA : deckB)?.positionMs;
    if (expected === undefined) return '';
    const actual = deck.audio.currentTime * 1000;
    const target = expected + latencyMs;
    const d = Math.abs(target - actual);
    if (d < 0.5) return ' · sync';
    return d < 10 ? ` · Δ${d.toFixed(2)}ms` : ` · Δ${Math.round(d)}ms`;
  })();
  if (_streamController.isActive()) {
    _setStatus(
      `Maître · ${new Date(now).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}${driftInfo}`
    );
    // 3. Événements planifiés et FX — audio uniquement
    _syncScheduled(upcoming);
    if (fx) _applyFx(fx);
  } else {
    _setStatus('Maître en ligne · ▶ pour écouter');
  }

  // 5. Prochain titre (deck opposée au currentTrackId)
  _updateNextTrack(state);

  // 6. Changement de piste
  if (currentTrackId && currentTrackId !== _curTrackId) {
    const item = queue.find((i) => i.id === currentTrackId)
              || filRouge.find((i) => i.id === currentTrackId);
    if (!item) return;

    // Affichage du titre toujours, même si le flux audio est arrêté
    _updateTrack({
      name:   item.name,
      artist: item.artist,
      artUrl: item.artUrl,
      bpm:    item.bpm,
      genre:  item.genre,
    });

    if (_streamController.isActive()) {
      const activeDeckState = activeDeck === 'A' ? deckA : deckB;
      const seekMs = Math.max(0, (activeDeckState?.positionMs || 0) + latencyMs);

      const blobUrl = _getBlobUrl(item);
      if (!blobUrl) {
        _setStatus('Téléchargement…');
        const blob = await _fetchBlobNow(item);
        if (!blob) {
          _setStatus('Échec téléchargement — vérifiez le réseau et l\'URL API');
          return;
        }
      }

      const resolvedBlob = _getBlobUrl(item);
      if (!resolvedBlob) return;

      const newDeckIdx = _deckIdxOf(activeDeck);

      if (_curTrackId && transitionMode === 'crossfade') {
        await _crossfade(newDeckIdx, resolvedBlob, seekMs, crossfadeMs);
      } else if (_curTrackId && transitionMode === 'fade_in_out') {
        await _crossfade(newDeckIdx, resolvedBlob, seekMs, crossfadeMs);
      } else {
        _pauseAll();
        await _playDeck(newDeckIdx, resolvedBlob, seekMs);
      }

      _curTrackId  = currentTrackId;
      _curDeckIdx  = newDeckIdx;
      _activeDeckIdx = newDeckIdx;

      const deckAudio = _decks[newDeckIdx]?.audio;
      const audioDurMs = (deckAudio?.duration && isFinite(deckAudio.duration))
        ? deckAudio.duration * 1000 : 0;
      const metaDurMs = _trackDurations.get(currentTrackId) || (item.duration || 0);
      const durMs = metaDurMs || audioDurMs;
      _startPosTracking(seekMs, durMs);

      if (deckAudio) {
        const _onDurChange = () => {
          if (deckAudio.duration && isFinite(deckAudio.duration) && _curTrackId === currentTrackId) {
            const realDurMs = deckAudio.duration * 1000;
            _posDurationMs = realDurMs;
            _trackDurations.set(currentTrackId, realDurMs);
          }
          deckAudio.removeEventListener('durationchange', _onDurChange);
        };
        deckAudio.addEventListener('durationchange', _onDurChange);
      }
    }

    // Pré-chargement du suivant, flux actif ou non
    const curIdx  = queue.findIndex((i) => i.id === currentTrackId);
    const nextItem = queue[curIdx + 1];
    if (nextItem?.persistedSourceUrl) _enqueueDownload(nextItem);

  } else if (currentTrackId && currentTrackId === _curTrackId) {
    // Même piste — correction de dérive et pause/reprise uniquement si flux actif
    if (_streamController.isActive()) {
      if (isPlaying && refTime) {
        const activeDeckState = activeDeck === 'A' ? deckA : deckB;
        if (activeDeckState?.positionMs !== undefined) {
          const target  = activeDeckState.positionMs + latencyMs;
          const deck    = _decks[_curDeckIdx];
          if (deck?.audio && !deck.audio.paused) {
            const current = deck.audio.currentTime * 1000;
            const absDrift = Math.abs(target - current);
            if (absDrift > 100) {
              _seekDeck(_curDeckIdx, target);
              _startPosTracking(target, _posDurationMs);
            }
          }
        }
      }

      if (!isPlaying) {
        _pauseAll();
        _stopPosTracking();
      } else {
        const deck = _decks[_curDeckIdx];
        if (deck?.audio.paused) {
          try { await deck.audio.play(); } catch (_) {}
          _startPosTracking(_currentPosMs(), _posDurationMs);
        }
      }
    }
  }
}

/** Téléchargement prioritaire immédiat (bloquant, hors queue). */
async function _fetchBlobNow(item) {
  const key = _blobKey(item);
  if (_blobCache.has(key)) return _blobCache.get(key);
  _downloading.add(key);

  // Essai URL directe (skip blob: URLs — inaccessibles depuis un autre appareil)
  if (item.persistedSourceUrl && !item.persistedSourceUrl.startsWith('blob:')) {
    try {
      const blob = await _httpBlob(item.persistedSourceUrl);
      if (blob) {
        const url = URL.createObjectURL(blob);
        _blobCache.set(key, url);
        _dlDone++;
        _downloading.delete(key);
        return url;
      }
    } catch (_) {}
  }

  // Fallback : proxy maître (même logique que _fetchBlob)
  if (item.id) {
    const proxyUrl = _proxyUrl(item.id);
    if (proxyUrl) {
      try {
        const blob = await _httpBlob(proxyUrl);
        if (blob) {
          const url = URL.createObjectURL(blob);
          _blobCache.set(key, url);
          _dlDone++;
          _downloading.delete(key);
          return url;
        }
      } catch (_) {}
    }
  }

  _downloading.delete(key);
  return null;
}

function _seekDeck(idx, ms) {
  const deck = _decks[idx];
  if (deck?.audio) deck.audio.currentTime = Math.max(0, ms / 1000);
}

// ── Hash léger de l'état ──────────────────────────────────────────────────────

function _stateHash(s) {
  return [
    s.currentTrackId || '',
    s.isPlaying ? '1' : '0',
    s.activeDeck || '',
    s.transitionMode || '',
    s.crossfadeMs || 0,
    s.deckA?.trackId || '',
    s.deckB?.trackId || '',
    s.fx ? `${s.fx.echo ? 'e' : ''}${s.fx.distortion ? 'd' : ''}` : '',
    (s.queue || []).map((i) => i.id).join(','),
    (s.filRouge || []).length,
    (s.upcoming || []).map((e) => `${e.type}:${Math.round(e.at / 1000)}`).join(';'),
    s.relayIncoming?.nowPending ? '1' : '0',
    s.relayIncoming?.nextCount ?? 0,
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

function _escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
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
  if (!API_BASE || !SESSION) return;
  cmd.requestedAt = Date.now();
  try {
    await fetch(`${API_BASE}/api/relay/commands/${SESSION}`, {
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

if (!SESSION) {
  document.body.innerHTML =
    '<p style="color:#8888aa;padding:32px;font-family:sans-serif">' +
    'Paramètre <code>relay-session</code> manquant dans l\'URL.<br>' +
    'Scannez le QR code affiché sur l\'appareil maître.' +
    '</p>';
} else {
  // Le premier geste utilisateur initialise l'AudioContext (exigé par les navigateurs).
  // Le flux audio lui-même ne démarre qu'après un clic sur le bouton ▶.
  let _started = false;
  const _start = async () => {
    if (_started) return;
    _started = true;
    tapOverlay?.remove();
    await _initAudio();
    _audioReady = true;
    _updateStreamBtn(false);
    _setStatus('Connexion…');
    // Le polling démarre ici pour les métadonnées et le pré-téléchargement.
    // L'audio ne joue que si _streamController.isActive() === true.
    await _poll();
    setInterval(_poll, 1500);
  };

  document.addEventListener('click',    _start, { once: true });
  document.addEventListener('touchend', _start, { once: true });
}
