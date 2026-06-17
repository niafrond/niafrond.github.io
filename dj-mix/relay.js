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
const dlFillEl      = $id('relay-screen-dl-fill');
const dlLabelEl     = $id('relay-screen-dl-label');

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
  return `${API_BASE}/api/relay/audio/${encodeURIComponent(trackId)}${qs}`;
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

// ── Suivi de la position en temps réel ───────────────────────────────────────

let _posTimer        = null;
let _posStartMs      = 0;   // position en ms à t0
let _posT0           = 0;   // Date.now() quand posStartMs a été établi
let _posDurationMs   = 0;

function _startPosTracking(posMs, durationMs) {
  _stopPosTracking();
  _posStartMs    = posMs;
  _posT0         = Date.now();
  _posDurationMs = durationMs;
  _posTimer = setInterval(() => {
    const cur = _posStartMs + (Date.now() - _posT0);
    if (cur >= _posDurationMs) { _stopPosTracking(); return; }
    _updateProgress(cur, _posDurationMs);
  }, 500);
}

function _stopPosTracking() {
  if (_posTimer) { clearInterval(_posTimer); _posTimer = null; }
}

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
    _startPosTracking(0, _posDurationMs); // sera mis à jour au prochain état reçu

  } else if (event.type === 'fx') {
    // L'event contient les champs retournés par peekNextAutoFxEvent + éventuels feature/enabled
    const fxPatch = {};
    if ('echo'       in event) fxPatch.echo       = event.echo;
    if ('distortion' in event) fxPatch.distortion = event.distortion;
    if ('feature'    in event && 'enabled' in event) fxPatch[event.feature] = event.enabled;
    if (Object.keys(fxPatch).length) _applyFx(fxPatch);
  }
}

// ── Correction de dérive autonome (toutes les 30 s, sans polling réseau) ─────

function _driftCheck() {
  if (!_lastState || !_audioReady) return;
  const { activeDeck, capturedAt, pushedAt } = _lastState;
  const deckState = activeDeck === 'A' ? _lastState.deckA : _lastState.deckB;
  if (!deckState?.positionMs || !capturedAt) return;

  const refTime   = capturedAt || pushedAt;
  const expected  = deckState.positionMs + (Date.now() - refTime);
  const deck      = _decks[_curDeckIdx];
  const actual    = (deck?.audio?.currentTime || 0) * 1000;

  if (Math.abs(expected - actual) > 2000) {
    _seekDeck(_curDeckIdx, expected);
    _startPosTracking(expected, _posDurationMs);
  }
}

// ── Polling et application de l'état ─────────────────────────────────────────

let _lastHash      = null;
let _curTrackId    = null;
let _curDeckIdx    = 0;
let _audioReady    = false;

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
      return;
    }
    const state = await res.json().catch(() => null);
    if (!state?.pushedAt) return;

    const hash = _stateHash(state);
    if (hash === _lastHash) return;
    _lastHash = hash;

    await _applyState(state);
  } catch (err) {
    _setStatus(`Réseau : ${err.message}`);
  }
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
  _setStatus(
    `Maître · ${new Date(now).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}`
  );

  // 3. Synchroniser les événements planifiés (transition, FX)
  _syncScheduled(upcoming);

  // 4. FX courant
  if (fx) _applyFx(fx);

  // 4. Changement de piste
  if (currentTrackId && currentTrackId !== _curTrackId) {
    const item = queue.find((i) => i.id === currentTrackId)
              || filRouge.find((i) => i.id === currentTrackId);
    if (!item) return;

    const activeDeckState = activeDeck === 'A' ? deckA : deckB;
    const seekMs = Math.max(0, (activeDeckState?.positionMs || 0) + latencyMs);

    const blobUrl = _getBlobUrl(item);
    if (!blobUrl) {
      // Pas encore en cache → téléchargement prioritaire immédiat
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
      // Même comportement que crossfade côté relais
      await _crossfade(newDeckIdx, resolvedBlob, seekMs, crossfadeMs);
    } else {
      _pauseAll();
      await _playDeck(newDeckIdx, resolvedBlob, seekMs);
    }

    _curTrackId  = currentTrackId;
    _curDeckIdx  = newDeckIdx;
    _activeDeckIdx = newDeckIdx;

    _updateTrack({
      name:   item.name,
      artist: item.artist,
      artUrl: item.artUrl,
      bpm:    item.bpm,
      genre:  item.genre,
    });

    // Durée : priorité aux métadonnées, fallback sur l'élément audio après chargement
    const deckAudio = _decks[newDeckIdx]?.audio;
    const audioDurMs = (deckAudio?.duration && isFinite(deckAudio.duration))
      ? deckAudio.duration * 1000 : 0;
    const durMs = (item.duration || 0) * 1000 || audioDurMs;
    _startPosTracking(seekMs, durMs);

    // Pré-charger la piste suivante si présente dans la queue
    const curIdx  = queue.findIndex((i) => i.id === currentTrackId);
    const nextItem = queue[curIdx + 1];
    if (nextItem?.persistedSourceUrl) _enqueueDownload(nextItem);

  } else if (currentTrackId && currentTrackId === _curTrackId) {
    // Même piste : resynchronisation si dérive > 5 s
    if (isPlaying && refTime) {
      const activeDeckState = activeDeck === 'A' ? deckA : deckB;
      if (activeDeckState?.positionMs !== undefined) {
        const target  = activeDeckState.positionMs + latencyMs;
        const deck    = _decks[_curDeckIdx];
        const current = (deck?.audio.currentTime || 0) * 1000;
        if (Math.abs(target - current) > 5000) {
          _seekDeck(_curDeckIdx, target);
          _startPosTracking(target, _posDurationMs);
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
        _startPosTracking(
          (_posStartMs + (Date.now() - _posT0)),
          _posDurationMs,
        );
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
    s.fx ? `${s.fx.echo ? 'e' : ''}${s.fx.distortion ? 'd' : ''}` : '',
    (s.queue || []).map((i) => i.id).join(','),
    (s.filRouge || []).length,
    (s.upcoming || []).map((e) => `${e.type}:${Math.round(e.at / 1000)}`).join(';'),
  ].join('|');
}

// ── Démarrage ─────────────────────────────────────────────────────────────────

if (!SESSION) {
  document.body.innerHTML =
    '<p style="color:#8888aa;padding:32px;font-family:sans-serif">' +
    'Paramètre <code>relay-session</code> manquant dans l\'URL.<br>' +
    'Scannez le QR code affiché sur l\'appareil maître.' +
    '</p>';
} else {
  // La lecture audio nécessite un geste utilisateur (politique navigateur).
  const _start = async () => {
    tapOverlay?.remove();
    await _initAudio();
    _audioReady = true;
    _setStatus(`Session ${SESSION} · connexion…`);
    // Premier poll immédiat, puis toutes les 1,5 s
    await _poll();
    setInterval(_poll, 1500);
    // Correction de dérive locale toutes les 30 s (sans polling réseau)
    setInterval(_driftCheck, 30_000);
  };

  document.addEventListener('click',    _start, { once: true });
  document.addEventListener('touchend', _start, { once: true });
}
