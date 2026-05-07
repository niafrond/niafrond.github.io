/**
 * ui.js — Navigation d'écrans et rendu pour Geo Party
 * Gère les cartes Leaflet et le viewer Street View Mapillary.
 */

// ─── Helpers DOM ──────────────────────────────────────────────────────────────

export function el(id) { return document.getElementById(id); }

let _currentScreen = null;
const _screenCbs   = [];

export function showScreen(id) {
  document.querySelectorAll('[data-screen]').forEach(s => { s.hidden = true; });
  const scr = el(id);
  if (scr) {
    scr.hidden     = false;
    _currentScreen = id;
    _screenCbs.forEach(cb => cb(id));
  }
}

export function getCurrentScreen() { return _currentScreen; }
export function onScreenChange(cb) { _screenCbs.push(cb); }

export function showToast(msg, type = 'info') {
  const toast = el('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className   = `toast toast-${type}`;
  toast.hidden      = false;
  clearTimeout(toast._tid);
  toast._tid = setTimeout(() => { toast.hidden = true; }, 3500);
}

// ─── Mapillary Viewer ──────────────────────────────────────────────────────────

let _mapillaryViewer = null;
let _mapillaryToken  = null;
let _currentImageId  = null;

/** Stocke le token Mapillary (depuis l'hôte ou le SYNC). */
export function setMapillaryToken(token) {
  _mapillaryToken = token || null;
}

function _waitForMapillarySDK() {
  return new Promise(resolve => {
    if (window.mapillary?.Viewer) { resolve(); return; }
    const t = setInterval(() => {
      if (window.mapillary?.Viewer) { clearInterval(t); resolve(); }
    }, 100);
    // Résoudre quand même après 8s pour ne pas bloquer indéfiniment
    setTimeout(() => { clearInterval(t); resolve(); }, 8000);
  });
}

/**
 * Affiche (ou navigue vers) un panorama Mapillary dans #mapillary-container.
 * Si imageId est null ou qu'il n'y a pas de token, affiche un placeholder.
 */
export async function showMapillaryImage(imageId) {
  const container = el('mapillary-container');
  if (!container) return;

  if (!_mapillaryToken) {
    _clearViewer(container, '🔑', 'Entrez un token Mapillary dans les paramètres pour activer la vue 360°');
    return;
  }

  if (!imageId) {
    _clearViewer(container, '🗺️', 'Aucun panorama Street View trouvé pour ce lieu');
    return;
  }

  await _waitForMapillarySDK();

  if (!window.mapillary?.Viewer) {
    _clearViewer(container, '❌', 'SDK Mapillary non chargé');
    return;
  }

  // Naviguer vers la nouvelle image si le viewer existe déjà
  if (_mapillaryViewer && _currentImageId !== imageId) {
    try {
      await _mapillaryViewer.moveTo(imageId);
      _currentImageId = imageId;
      return;
    } catch {
      // Recréer le viewer si moveTo échoue
      destroyMapillaryViewer();
    }
  }

  if (_currentImageId === imageId && _mapillaryViewer) return; // déjà à jour

  // Créer un nouveau viewer
  _destroyViewerInstance();
  container.innerHTML = '';
  _currentImageId = imageId;

  try {
    _mapillaryViewer = new window.mapillary.Viewer({
      accessToken: _mapillaryToken,
      container:   'mapillary-container',
      imageId,
      component:   { cover: false },
    });
  } catch (err) {
    console.error('[Mapillary viewer]', err);
    _currentImageId = null;
    _clearViewer(container, '❌', 'Impossible de charger le panorama. Vérifiez votre token Mapillary.');
  }
}

/** Détruit proprement le viewer Mapillary. */
export function destroyMapillaryViewer() {
  _destroyViewerInstance();
  _currentImageId = null;
  const container = el('mapillary-container');
  if (container) container.innerHTML = '';
}

function _destroyViewerInstance() {
  if (_mapillaryViewer) {
    try { _mapillaryViewer.remove(); } catch { /* ignore */ }
    _mapillaryViewer = null;
  }
}

function _clearViewer(container, icon, msg) {
  _destroyViewerInstance();
  _currentImageId = null;
  const wrap = document.createElement('div');
  wrap.className = 'mapillary-placeholder';
  const ico = document.createElement('div');
  ico.textContent = icon;
  ico.style.fontSize = '2.5rem';
  const p = document.createElement('p');
  p.textContent = msg;
  wrap.append(ico, p);
  container.innerHTML = '';
  container.appendChild(wrap);
}

// ─── Cartes Leaflet ────────────────────────────────────────────────────────────

let _guessMap       = null;
let _guessMarker    = null;
let _resultsMap     = null;
let _onGuessCallback = null;

function _waitForLeaflet() {
  return new Promise((resolve) => {
    if (window.L) { resolve(); return; }
    const timer = setInterval(() => {
      if (window.L) { clearInterval(timer); resolve(); }
    }, 100);
  });
}

/**
 * Initialise (ou réinitialise) la carte de devinette.
 * @param {function} onGuess  appelé avec (lat, lng) quand le joueur clique
 */
export async function initGuessMap(onGuess) {
  _onGuessCallback = onGuess;
  await _waitForLeaflet();

  const container = el('guess-map');
  if (!container) return;

  if (_guessMap) {
    _guessMap.remove();
    _guessMap    = null;
    _guessMarker = null;
  }

  _guessMap = L.map('guess-map', {
    center: [20, 0],
    zoom:   2,
    zoomControl: true,
    attributionControl: false,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
  }).addTo(_guessMap);

  _guessMap.on('click', (e) => {
    const { lat, lng } = e.latlng;
    _placeGuessMarker(lat, lng);
    if (_onGuessCallback) _onGuessCallback(lat, lng);
  });
}

function _placeGuessMarker(lat, lng) {
  if (!_guessMap) return;
  if (_guessMarker) {
    _guessMarker.setLatLng([lat, lng]);
  } else {
    _guessMarker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: '',
        html: '<div class="guess-pin">📍</div>',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      }),
    }).addTo(_guessMap);
  }
}

/** Remet la carte à zéro (nouveau round). */
export function resetGuessMap() {
  if (_guessMarker && _guessMap) {
    _guessMap.removeLayer(_guessMarker);
    _guessMarker = null;
  }
  if (_guessMap) _guessMap.setView([20, 0], 2);
  setTimeout(() => { if (_guessMap) _guessMap.invalidateSize(); }, 100);
}

/** Force un recalcul de taille (après expand/collapse de l'overlay). */
export function invalidateGuessMap() {
  setTimeout(() => { if (_guessMap) _guessMap.invalidateSize(); }, 50);
}

/** Retourne true si un marqueur est posé. */
export function hasGuessMarker() { return _guessMarker !== null; }

/** Retourne les coordonnées actuelles du marqueur ou null. */
export function getGuessCoords() {
  if (!_guessMarker) return null;
  const ll = _guessMarker.getLatLng();
  return { lat: ll.lat, lng: ll.lng };
}

// ─── Carte Résultats ──────────────────────────────────────────────────────────

export async function initResultsMap(players, actualLat, actualLng) {
  await _waitForLeaflet();

  const container = el('results-map');
  if (!container) return;

  if (_resultsMap) {
    _resultsMap.remove();
    _resultsMap = null;
  }

  _resultsMap = L.map('results-map', {
    center: [20, 0],
    zoom:   2,
    zoomControl: true,
    attributionControl: false,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
  }).addTo(_resultsMap);

  const bounds = [];

  // Marqueur réel (étoile)
  const actualIcon = L.divIcon({
    className: '',
    html: '<div class="actual-pin">⭐</div>',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
  L.marker([actualLat, actualLng], { icon: actualIcon })
    .addTo(_resultsMap)
    .bindPopup('<strong>Lieu réel</strong>');
  bounds.push([actualLat, actualLng]);

  // Marqueurs joueurs
  players.forEach((p) => {
    if (!p.guess) return;
    const { lat, lng } = p.guess;
    bounds.push([lat, lng]);

    const pIcon = L.divIcon({
      className: '',
      html: `<div class="player-pin" style="background:${p.color}">${_initial(p.name)}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
    L.marker([lat, lng], { icon: pIcon })
      .addTo(_resultsMap)
      .bindPopup(`<strong>${_escHtml(p.name)}</strong><br>${_fmtDist(p.guessDistance)}<br>${p.guessScore ?? 0} pts`);

    L.polyline([[lat, lng], [actualLat, actualLng]], {
      color: p.color,
      weight: 2,
      opacity: 0.7,
      dashArray: '5,5',
    }).addTo(_resultsMap);
  });

  if (bounds.length > 0) {
    try {
      _resultsMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
    } catch { /* ignore */ }
  }
}

function _initial(name) {
  return (name || '?').charAt(0).toUpperCase();
}

function _escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function _fmtDist(km) {
  if (km == null) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

// ─── Rendu écrans ─────────────────────────────────────────────────────────────

/** Timer bar */
export function updateTimerBar(timeLeft, total) {
  const pct = total > 0 ? (timeLeft / total) * 100 : 0;
  const bar   = el('round-timer-bar');
  const label = el('round-timer-label');
  if (bar) {
    bar.style.width = `${pct}%`;
    bar.className   = 'timer-bar';
    if (timeLeft <= 5)       bar.classList.add('timer-urgent');
    else if (timeLeft <= 10) bar.classList.add('timer-warning');
  }
  if (label) label.textContent = timeLeft;
}

/** Lobby HOST : QR + lien + liste des joueurs */
export function renderLobby(peerId, url, players, canStart) {
  const qr = el('lobby-qr');
  if (qr) {
    qr.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
    qr.alt = 'QR Code';
  }
  const urlEl = el('lobby-url');
  if (urlEl) urlEl.textContent = url;

  _renderPlayerList('lobby-players', players);

  const btn = el('btn-start-game');
  if (btn) btn.hidden = !canStart;
}

/** Lobby CLIENT : liste d'attente */
export function renderWaiting(players) {
  _renderPlayerList('waiting-players', players);
}

function _renderPlayerList(containerId, players) {
  const c = el(containerId);
  if (!c) return;
  c.innerHTML = '';
  players.forEach((p) => {
    const li = document.createElement('li');
    li.className = 'player-item';
    const dot = document.createElement('span');
    dot.className = 'player-dot';
    dot.style.background = p.color;
    const name = document.createElement('span');
    name.textContent = p.name;
    li.appendChild(dot);
    li.appendChild(name);
    c.appendChild(li);
  });
}

/** Pré-round : compte à rebours */
export function renderPreRound(s) {
  const el_n  = el('pre-round-number');
  const el_r  = el('pre-round-round');
  if (el_n) el_n.textContent = s.countdown;
  if (el_r) el_r.textContent = `Manche ${s.currentRound + 1} / ${s.totalRounds}`;
}

/** Round : timer + statut guesses (l'image/viewer est géré séparément) */
export function renderRound(s) {
  const badge = el('round-badge');
  if (badge) badge.textContent = `Manche ${s.currentRound} / ${s.totalRounds}`;

  updateTimerBar(s.timeLeft, s.timerDuration);

  const status = el('round-guess-status');
  if (status) {
    status.innerHTML = '';
    s.players.forEach((p) => {
      const chip = document.createElement('span');
      chip.className = 'player-status-chip' + (p.hasGuessed ? ' chip-guessed' : '');

      const dot = document.createElement('span');
      dot.className = 'chip-dot';
      dot.style.background = p.color;

      const name = document.createElement('span');
      name.className = 'chip-name';
      name.textContent = p.name;

      const icon = document.createElement('span');
      icon.className = 'chip-icon';
      icon.textContent = p.hasGuessed ? '✅' : '⏳';

      chip.append(dot, name, icon);
      status.appendChild(chip);
    });
  }
}

/** Résultats : carte + scores */
export function renderResults(s) {
  const loc = s.currentLocation;

  const nameEl = el('results-location-name');
  if (nameEl) {
    nameEl.textContent = loc ? `${loc.name} — ${loc.country}` : '—';
  }

  const list = el('results-scores');
  if (list) {
    list.innerHTML = '';
    const sorted = [...s.players].sort((a, b) => (b.guessScore ?? 0) - (a.guessScore ?? 0));
    sorted.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'score-row';

      const rank = document.createElement('span');
      rank.className = 'score-rank';
      rank.textContent = `${i + 1}.`;

      const dot = document.createElement('span');
      dot.className = 'player-dot';
      dot.style.background = p.color;

      const name = document.createElement('span');
      name.className = 'score-name';
      name.textContent = p.name;

      const dist = document.createElement('span');
      dist.className = 'score-dist';
      dist.textContent = _fmtDist(p.guessDistance);

      const pts = document.createElement('span');
      pts.className = 'score-pts';
      pts.textContent = `+${p.guessScore ?? 0}`;

      const total = document.createElement('span');
      total.className = 'score-total';
      total.textContent = `${p.score} pts`;

      row.append(rank, dot, name, dist, pts, total);
      list.appendChild(row);
    });
  }
}

/** Game Over : classement final */
export function renderGameOver(s, isHost) {
  const list = el('gameover-scores');
  if (!list) return;
  list.innerHTML = '';

  const sorted = [...s.players].sort((a, b) => b.score - a.score);
  sorted.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'score-row score-row--final';

    const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
    const m = document.createElement('span');
    m.className   = 'score-rank';
    m.textContent = medal;

    const dot = document.createElement('span');
    dot.className = 'player-dot';
    dot.style.background = p.color;

    const name = document.createElement('span');
    name.className = 'score-name';
    name.textContent = p.name;

    const total = document.createElement('span');
    total.className = 'score-total score-total--big';
    total.textContent = `${p.score} pts`;

    row.append(m, dot, name, total);
    list.appendChild(row);
  });

  const winner = sorted[0];
  const winnerEl = el('gameover-winner');
  if (winnerEl && winner) {
    winnerEl.textContent = `🏆 ${winner.name} gagne !`;
  }

  const btn = el('btn-replay');
  if (btn) btn.hidden = !isHost;
}

