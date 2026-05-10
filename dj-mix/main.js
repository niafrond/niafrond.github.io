/**
 * main.js – DJ Mix app orchestrator
 * Handles: OAuth/token setup, search, queue management, player events, UI updates.
 */

import { SpotifyAPI } from './spotify.js';
import { DJPlayer } from './player.js';
import { SpotifyAuth } from './auth.js';

const auth = new SpotifyAuth();
const DEFAULT_CLIENT_ID = '2185f62bdf5f4d7a824aa14642484b05';

// ── App state ────────────────────────────────────────────
let api = null;
let player = null;
/** @type {Array<{id,uri,name,artist,artUrl,duration}>} */
const queue = [];
let currentIndex = -1;  // index of the currently playing track
let isPlaying = false;
let searchTimeout = null;

// ── DOM refs ─────────────────────────────────────────────
const setupScreen    = document.getElementById('setup-screen');
const appScreen      = document.getElementById('app-screen');
const setupError     = document.getElementById('setup-error');
const setupLoading   = document.getElementById('setup-loading');

const tokenInput      = document.getElementById('token-input');
const oauthBtn        = document.getElementById('oauth-btn');
const tokenBtn        = document.getElementById('token-btn');
const logoutBtn       = document.getElementById('logout-btn');
const userAvatar      = document.getElementById('user-avatar');
const userName        = document.getElementById('user-name');

const searchInput    = document.getElementById('search-input');
const searchClear    = document.getElementById('search-clear');
const searchOverlay  = document.getElementById('search-overlay');
const searchResults  = document.getElementById('search-results');

const albumArt       = document.getElementById('album-art');
const artPlaceholder = document.getElementById('art-placeholder');
const crossfadeRing  = document.getElementById('crossfade-ring');
const trackName      = document.getElementById('track-name');
const trackArtist    = document.getElementById('track-artist');
const progressFill   = document.getElementById('progress-fill');
const crossfadeZone  = document.getElementById('crossfade-zone');
const currentTimeEl  = document.getElementById('current-time');
const totalTimeEl    = document.getElementById('total-time');
const playPauseBtn   = document.getElementById('play-pause-btn');
const playIcon       = document.getElementById('play-icon');
const prevBtn        = document.getElementById('prev-btn');
const nextBtn        = document.getElementById('next-btn');
const crossfadeSlider = document.getElementById('crossfade-slider');
const crossfadeValue  = document.getElementById('crossfade-value');
const queueList      = document.getElementById('queue-list');
const emptyQueue     = document.getElementById('empty-queue');
const clearQueueBtn  = document.getElementById('clear-queue-btn');

// ── Boot ─────────────────────────────────────────────────
(async function init() {
  // Handle PKCE callback (?code= in query string)
  if (window.location.search.includes('code=') || window.location.search.includes('error=')) {
    showSetupLoading(true, 'Connexion Spotify…');
    try {
      await auth.handleCallback();
      await connectWithAuth();
    } catch (err) {
      showSetupLoading(false);
      showSetupError(err.message);
      showSetup();
    }
    return;
  }

  // Restore existing session (auto-refresh if needed)
  if (auth.hasStoredTokens) {
    showSetupLoading(true, 'Restauration de la session…');
    try {
      await connectWithAuth();
      return;
    } catch (err) {
      // Token invalid or expired without refresh → fall through to setup
      auth.logout();
    }
    showSetupLoading(false);
  }

  showSetup();
})();

// ── Setup event listeners ─────────────────────────────────

// OAuth (PKCE) flow
oauthBtn.addEventListener('click', async () => {
  hideSetupError();
  try {
    await auth.startPKCE(DEFAULT_CLIENT_ID);
  } catch (err) {
    showSetupError(err.message);
  }
});

// Manual token
tokenBtn.addEventListener('click', async () => {
  const token = tokenInput.value.trim();
  if (!token) { showSetupError('Entrez votre token Spotify.'); return; }
  hideSetupError();
  auth.setManualToken(token);
  showSetupLoading(true, 'Connexion…');
  try {
    await connectWithAuth();
  } catch (err) {
    auth.logout();
    showSetupLoading(false);
    showSetupError(err.message);
  }
});

// Logout
logoutBtn?.addEventListener('click', () => {
  auth.logout();
  player?.destroy();
  player = null;
  api = null;
  queue.length = 0;
  currentIndex = -1;
  isPlaying = false;
  showSetup();
});

// ── Connect with stored auth ──────────────────────────────

async function connectWithAuth() {
  hideSetupError();

  const getToken = () => auth.getToken();
  api = new SpotifyAPI(getToken);
  const me = await api.getMe();

  player = new DJPlayer(getToken);
  hookPlayerEvents();

  showSetupLoading(true, 'Initialisation des platines…');
  await player.init();

  showSetupLoading(false);
  showApp(me);
}

// ── Player events ─────────────────────────────────────────

function hookPlayerEvents() {
  player.addEventListener('statechange', ({ detail }) => {
    isPlaying = !detail.paused;
    playIcon.textContent = isPlaying ? '⏸' : '▶';

    if (detail.track) {
      const t = detail.track;
      trackName.textContent = t.name;
      trackArtist.textContent = t.artists.map(a => a.name).join(', ');

      const img = t.album?.images?.[0]?.url;
      if (img) {
        albumArt.src = img;
        albumArt.hidden = false;
        artPlaceholder.style.display = 'none';
      }
    }
  });

  player.addEventListener('progress', ({ detail }) => {
    const { position, duration } = detail;
    if (!duration) return;

    const pct = (position / duration) * 100;
    progressFill.style.width = `${pct}%`;
    currentTimeEl.textContent = formatTime(position);
    totalTimeEl.textContent = formatTime(duration);

    // Show crossfade zone width
    const fadePct = Math.min(100, (player.crossfadeDuration / duration) * 100);
    crossfadeZone.style.width = `${fadePct}%`;
  });

  player.addEventListener('crossfadeready', () => {
    // Auto-advance: crossfade to next track if available
    const next = queue[currentIndex + 1];
    if (next) {
      showCrossfadeRing(true);
      showToast('〜 Crossfade en cours…');
      player.crossfadeTo(next.uri).then(() => {
        currentIndex++;
        showCrossfadeRing(false);
        renderQueue();
      }).catch(console.error);
    }
  });

  player.addEventListener('trackend', () => {
    // Track ended without crossfade (queue was empty), clean up
    isPlaying = false;
    playIcon.textContent = '▶';
    showCrossfadeRing(false);
  });

  player.addEventListener('error', ({ detail }) => {
    console.error('Player error:', detail.message);
    showToast(`⚠️ ${detail.message}`, true);
  });
}

// ── Playback controls ─────────────────────────────────────

playPauseBtn.addEventListener('click', async () => {
  if (!player || currentIndex < 0) return;

  if (!isPlaying && currentIndex >= 0 && queue[currentIndex]) {
    // If nothing playing yet, play current (or first) track
    try {
      await player.play(queue[currentIndex].uri);
    } catch (e) {
      showToast(`⚠️ ${e.message}`, true);
    }
    return;
  }

  await player.togglePause().catch(console.error);
});

nextBtn.addEventListener('click', async () => {
  const next = queue[currentIndex + 1];
  if (!next || player.isCrossfading) return;

  showCrossfadeRing(true);
  showToast('〜 Crossfade en cours…');
  try {
    await player.crossfadeTo(next.uri);
    currentIndex++;
    showCrossfadeRing(false);
    renderQueue();
  } catch (e) {
    showCrossfadeRing(false);
    showToast(`⚠️ ${e.message}`, true);
  }
});

prevBtn.addEventListener('click', async () => {
  if (!player || currentIndex <= 0) return;
  const prev = queue[currentIndex - 1];
  if (!prev) return;

  try {
    await player.switchTo(prev.uri);
    currentIndex--;
    renderQueue();
  } catch (e) {
    showToast(`⚠️ ${e.message}`, true);
  }
});

// Crossfade duration slider
crossfadeSlider.addEventListener('input', () => {
  const sec = Number(crossfadeSlider.value);
  crossfadeValue.textContent = `${sec}s`;
  if (player) player.crossfadeDuration = sec * 1000;
});

// Clear queue
clearQueueBtn.addEventListener('click', () => {
  if (!queue.length) return;
  // Keep currently playing track
  if (currentIndex >= 0 && queue[currentIndex]) {
    const current = queue[currentIndex];
    queue.length = 0;
    queue.push(current);
    currentIndex = 0;
  } else {
    queue.length = 0;
    currentIndex = -1;
  }
  renderQueue();
});

// ── Search ────────────────────────────────────────────────

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  searchClear.hidden = !q;

  if (!q) {
    closeSearch();
    return;
  }

  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => runSearch(q), 350);
  openSearch();
  searchResults.innerHTML = '<div class="search-loading">🔍 Recherche…</div>';
});

searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchClear.hidden = true;
  closeSearch();
  searchInput.focus();
});

// Close search overlay when tapping outside
searchOverlay.addEventListener('click', (e) => {
  if (e.target === searchOverlay) closeSearch();
});

async function runSearch(query) {
  try {
    const tracks = await api.search(query);
    if (!tracks.length) {
      searchResults.innerHTML = '<div class="search-empty">Aucun résultat</div>';
      return;
    }
    searchResults.innerHTML = tracks.map(t => buildResultHTML(t)).join('');

    searchResults.querySelectorAll('.search-result-item').forEach((el, i) => {
      el.addEventListener('click', () => addToQueue(tracks[i]));
    });
  } catch (e) {
    searchResults.innerHTML = `<div class="search-empty">⚠️ ${e.message}</div>`;
  }
}

function buildResultHTML(track) {
  const artUrl = track.album?.images?.[1]?.url ?? track.album?.images?.[0]?.url ?? '';
  const artist = track.artists.map(a => a.name).join(', ');
  const dur    = formatTime(track.duration_ms);
  return `
    <div class="search-result-item" role="button" tabindex="0">
      <img class="result-art" src="${escHtml(artUrl)}" alt="" loading="lazy">
      <div class="result-info">
        <div class="result-name">${escHtml(track.name)}</div>
        <div class="result-artist">${escHtml(artist)}</div>
      </div>
      <span class="result-duration">${dur}</span>
      <button class="add-btn" aria-label="Ajouter">+</button>
    </div>`;
}

function openSearch() {
  searchOverlay.hidden = false;
}

function closeSearch() {
  searchOverlay.hidden = true;
}

// ── Queue management ──────────────────────────────────────

/**
 * Add a Spotify track object to the queue.
 * If nothing is playing, start playback immediately.
 */
async function addToQueue(track) {
  const artUrl = track.album?.images?.[1]?.url ?? track.album?.images?.[0]?.url ?? '';
  const item = {
    id:       track.id,
    uri:      track.uri,
    name:     track.name,
    artist:   track.artists.map(a => a.name).join(', '),
    artUrl,
    duration: track.duration_ms,
  };

  queue.push(item);
  renderQueue();

  // Start playing if this is the first / only track
  if (currentIndex < 0) {
    currentIndex = 0;
    renderQueue();
    try {
      await player.play(item.uri);
      isPlaying = true;
      playIcon.textContent = '⏸';
      updateNowPlaying(item);
    } catch (e) {
      showToast(`⚠️ ${e.message}`, true);
    }
  }

  // Close search after adding
  closeSearch();
  searchInput.value = '';
  searchClear.hidden = true;

  showToast(`✔ "${item.name}" ajouté`);
}

function renderQueue() {
  if (!queue.length) {
    queueList.innerHTML = '';
    queueList.appendChild(emptyQueue);
    emptyQueue.style.display = '';
    nextBtn.disabled = true;
    prevBtn.disabled = true;
    return;
  }

  emptyQueue.style.display = 'none';

  nextBtn.disabled = currentIndex >= queue.length - 1;
  prevBtn.disabled = currentIndex <= 0;

  queueList.innerHTML = queue.map((item, i) => {
    const isCurrent = i === currentIndex;
    const cls = isCurrent ? 'queue-item is-current' : 'queue-item';

    const numHtml = isCurrent
      ? `<div class="queue-num">
           <div class="playing-bars" aria-label="En cours">
             <span></span><span></span><span></span>
           </div>
         </div>`
      : `<div class="queue-num">${i + 1}</div>`;

    return `
      <div class="${cls}" data-index="${i}" role="button" tabindex="0">
        ${numHtml}
        <img class="queue-art" src="${escHtml(item.artUrl)}" alt="" loading="lazy">
        <div class="queue-info">
          <div class="queue-name">${escHtml(item.name)}</div>
          <div class="queue-artist">${escHtml(item.artist)}</div>
        </div>
        <span class="queue-duration">${formatTime(item.duration)}</span>
        <button class="queue-remove" data-index="${i}" aria-label="Retirer">✕</button>
      </div>`;
  }).join('');

  // Play on click (crossfade to that track)
  queueList.querySelectorAll('.queue-item').forEach(el => {
    el.addEventListener('click', async (e) => {
      if (e.target.classList.contains('queue-remove')) return;
      const idx = Number(el.dataset.index);
      if (idx === currentIndex) return;
      if (player.isCrossfading) return;

      showCrossfadeRing(true);
      try {
        if (idx > currentIndex) {
          // Going forward: crossfade
          await player.crossfadeTo(queue[idx].uri);
        } else {
          // Going backward: instant switch
          await player.switchTo(queue[idx].uri);
        }
        currentIndex = idx;
        updateNowPlaying(queue[idx]);
        showCrossfadeRing(false);
        renderQueue();
      } catch (e2) {
        showCrossfadeRing(false);
        showToast(`⚠️ ${e2.message}`, true);
      }
    });
  });

  // Remove buttons
  queueList.querySelectorAll('.queue-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.index);
      removeFromQueue(idx);
    });
  });
}

function removeFromQueue(idx) {
  if (idx === currentIndex) return; // can't remove currently playing track
  queue.splice(idx, 1);
  if (idx < currentIndex) currentIndex--;
  renderQueue();
}

// ── UI helpers ────────────────────────────────────────────

function updateNowPlaying(item) {
  trackName.textContent = item.name;
  trackArtist.textContent = item.artist;
  if (item.artUrl) {
    albumArt.src = item.artUrl;
    albumArt.hidden = false;
    artPlaceholder.style.display = 'none';
  }
}

function showCrossfadeRing(on) {
  crossfadeRing.hidden = !on;
}

let toastTimer = null;
function showToast(msg, isError = false) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  clearTimeout(toastTimer);

  const el = document.createElement('div');
  el.className = 'toast';
  if (isError) el.style.borderColor = '#f87171';
  el.textContent = msg;
  document.body.appendChild(el);

  toastTimer = setTimeout(() => el.remove(), 3000);
}

function showSetup() {
  setupScreen.classList.add('active');
  setupScreen.hidden = false;
  appScreen.hidden = true;
}

function showApp(me) {
  setupScreen.hidden = true;
  setupScreen.classList.remove('active');
  appScreen.hidden = false;
  appScreen.classList.add('active');

  // Show user profile in header
  if (me) {
    const img = me.images?.[0]?.url;
    if (img && userAvatar) {
      userAvatar.src = img;
      userAvatar.hidden = false;
    }
    if (userName) userName.textContent = me.display_name ?? me.id;
  }

  // Init UI state
  renderQueue();
  playPauseBtn.disabled = false;
}

function showSetupError(msg) {
  setupError.textContent = msg;
  setupError.hidden = false;
}

function hideSetupError() {
  setupError.hidden = true;
}

function showSetupLoading(on, msg) {
  setupLoading.hidden = !on;
  if (on && msg) {
    setupLoading.querySelector('span:last-child')?.remove?.();
    setupLoading.textContent = '';
    const spinner = document.createElement('span');
    spinner.className = 'spinner';
    setupLoading.appendChild(spinner);
    setupLoading.appendChild(document.createTextNode(` ${msg}`));
  }
}

// ── Utilities ─────────────────────────────────────────────

function formatTime(ms) {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Escape HTML to prevent XSS when inserting user/API content. */
function escHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
