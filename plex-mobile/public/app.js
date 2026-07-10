const CLIENT_IDENTIFIER = 'niafrond-plex-mobile-webapp';

const els = {
  pageTitle: document.getElementById('pageTitle'),
  refreshBtn: document.getElementById('refreshBtn'),
  tabs: document.getElementById('libraryTabs'),
  statusBanner: document.getElementById('statusBanner'),
  grid: document.getElementById('grid'),
  detailView: document.getElementById('detailView'),
  closeDetailBtn: document.getElementById('closeDetailBtn'),
  detailArt: document.getElementById('detailArt'),
  detailTitle: document.getElementById('detailTitle'),
  detailMeta: document.getElementById('detailMeta'),
  detailSummary: document.getElementById('detailSummary'),
  playBtn: document.getElementById('playBtn'),
  episodeList: document.getElementById('episodeList'),
  playerView: document.getElementById('playerView'),
  video: document.getElementById('video'),
  closePlayerBtn: document.getElementById('closePlayerBtn')
};

let libraries = [];
let activeLibrary = null;
let currentSession = null;
let hls = null;

init();

function init() {
  els.refreshBtn.addEventListener('click', () => {
    if (activeLibrary) renderLibraryGrid();
    else loadLibraries();
  });
  els.closeDetailBtn.addEventListener('click', closeDetailSheet);
  els.closePlayerBtn.addEventListener('click', closePlayer);
  loadLibraries();
}

async function plexGet(plexPath) {
  const res = await fetch('/api/plex' + plexPath, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Erreur Plex (${res.status})`);
  const data = await res.json();
  return data.MediaContainer || {};
}

function showStatus(message, kind) {
  if (!message) {
    els.statusBanner.hidden = true;
    els.statusBanner.textContent = '';
    return;
  }
  els.statusBanner.hidden = false;
  els.statusBanner.className = 'status-banner' + (kind === 'info' ? ' info' : '');
  els.statusBanner.textContent = message;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatDuration(ms) {
  const min = Math.round((ms || 0) / 60000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
}

function metaLine(item) {
  const parts = [];
  if (item.year) parts.push(item.year);
  if (item.duration) parts.push(formatDuration(item.duration));
  if (item.contentRating) parts.push(item.contentRating);
  return parts.join(' · ');
}

// ---- Bibliothèques ----

async function loadLibraries() {
  showStatus(null);
  els.grid.innerHTML = '<p class="empty">Chargement…</p>';
  try {
    const mc = await plexGet('/library/sections');
    libraries = (mc.Directory || []).filter((d) => d.type === 'movie' || d.type === 'show');
    renderTabs();
    if (libraries.length) {
      selectLibrary(libraries[0]);
    } else {
      els.grid.innerHTML = '';
      showStatus('Aucune bibliothèque films/séries trouvée sur ce serveur Plex.', 'info');
    }
  } catch (err) {
    els.grid.innerHTML = '';
    showStatus(`Impossible de joindre le serveur Plex (${err.message}). Vérifie l'IP/le token dans .env et que ton téléphone est bien sur le même Wi-Fi.`);
  }
}

function renderTabs() {
  els.tabs.innerHTML = '';
  els.tabs.hidden = libraries.length < 2;
  for (const lib of libraries) {
    const btn = document.createElement('button');
    btn.className = 'tab';
    btn.textContent = lib.title;
    btn.addEventListener('click', () => selectLibrary(lib));
    lib._tabEl = btn;
    els.tabs.appendChild(btn);
  }
}

function selectLibrary(lib) {
  activeLibrary = lib;
  els.pageTitle.textContent = lib.title;
  for (const l of libraries) if (l._tabEl) l._tabEl.classList.toggle('active', l.key === lib.key);
  renderLibraryGrid();
}

async function renderLibraryGrid() {
  showStatus(null);
  els.grid.innerHTML = '<p class="empty">Chargement…</p>';
  try {
    const mc = await plexGet(`/library/sections/${activeLibrary.key}/all`);
    const items = mc.Metadata || [];
    if (!items.length) {
      els.grid.innerHTML = '<p class="empty">Bibliothèque vide.</p>';
      return;
    }
    renderGrid(items, (item) => (item.type === 'show' ? openShow(item) : openMovie(item)));
  } catch (err) {
    els.grid.innerHTML = '';
    showStatus(`Erreur de chargement : ${err.message}`);
  }
}

function renderGrid(items, onTap) {
  els.grid.innerHTML = '';
  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'card';

    const img = document.createElement('img');
    img.className = 'poster';
    img.loading = 'lazy';
    if (item.thumb) img.src = '/api/plex' + item.thumb;

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = item.title;

    const sub = document.createElement('div');
    sub.className = 'card-sub';
    sub.textContent = item.year || '';

    card.append(img, title, sub);
    card.addEventListener('click', () => onTap(item));
    els.grid.appendChild(card);
  }
}

// ---- Détail film / série ----

function showDetailSheet() {
  els.detailView.hidden = false;
}

function closeDetailSheet() {
  els.detailView.hidden = true;
}

function setDetailHeader(item) {
  els.detailTitle.textContent = item.title;
  els.detailMeta.textContent = metaLine(item);
  els.detailSummary.textContent = item.summary || '';
  const bg = item.art || item.thumb;
  els.detailArt.style.backgroundImage = bg ? `url('/api/plex${bg}')` : '';
}

function openMovie(item) {
  showDetailSheet();
  setDetailHeader(item);
  els.playBtn.hidden = false;
  els.playBtn.onclick = () => playItem(item);
  els.episodeList.innerHTML = '';
}

async function openShow(show) {
  showDetailSheet();
  setDetailHeader(show);
  els.playBtn.hidden = true;
  els.episodeList.innerHTML = '<p class="empty">Chargement…</p>';
  try {
    const mc = await plexGet(`/library/metadata/${show.ratingKey}/children`);
    renderSeasonRows(mc.Metadata || [], show);
  } catch (err) {
    els.episodeList.innerHTML = `<p class="empty">Erreur : ${escapeHtml(err.message)}</p>`;
  }
}

function renderSeasonRows(seasons, show) {
  els.episodeList.innerHTML = '';
  for (const season of seasons) {
    const row = document.createElement('div');
    row.className = 'episode-row';

    const img = document.createElement('img');
    img.loading = 'lazy';
    const thumb = season.thumb || show.thumb;
    if (thumb) img.src = '/api/plex' + thumb;

    const text = document.createElement('div');
    text.innerHTML = `<div class="ep-title">${escapeHtml(season.title)}</div><div class="ep-sub">${season.leafCount || 0} épisode(s)</div>`;

    row.append(img, text);
    row.addEventListener('click', () => openSeason(season, show));
    els.episodeList.appendChild(row);
  }
}

async function openSeason(season, show) {
  els.episodeList.innerHTML = '<p class="empty">Chargement…</p>';
  try {
    const mc = await plexGet(`/library/metadata/${season.ratingKey}/children`);
    renderEpisodeRows(mc.Metadata || [], season, show);
  } catch (err) {
    els.episodeList.innerHTML = `<p class="empty">Erreur : ${escapeHtml(err.message)}</p>`;
  }
}

function renderEpisodeRows(episodes, season, show) {
  els.episodeList.innerHTML = '';

  const back = document.createElement('div');
  back.className = 'episode-row';
  back.innerHTML = '<div class="ep-title">← Saisons</div>';
  back.addEventListener('click', () => openShow(show));
  els.episodeList.appendChild(back);

  for (const ep of episodes) {
    const row = document.createElement('div');
    row.className = 'episode-row';

    const img = document.createElement('img');
    img.loading = 'lazy';
    if (ep.thumb) img.src = '/api/plex' + ep.thumb;

    const text = document.createElement('div');
    text.innerHTML = `<div class="ep-title">${ep.index}. ${escapeHtml(ep.title)}</div><div class="ep-sub">${formatDuration(ep.duration)}</div>`;

    row.append(img, text);
    row.addEventListener('click', () => playItem(ep));
    els.episodeList.appendChild(row);
  }
}

// ---- Lecture (HLS via le transcodeur Plex) ----

function playItem(item) {
  closeDetailSheet();
  currentSession = crypto.randomUUID();

  const params = new URLSearchParams({
    path: `/library/metadata/${item.ratingKey}`,
    mediaIndex: '0',
    partIndex: '0',
    protocol: 'hls',
    fastSeek: '1',
    directPlay: '0',
    directStream: '1',
    subtitleSize: '100',
    audioBoost: '100',
    maxVideoBitrate: '20000',
    videoResolution: '1920x1080',
    session: currentSession,
    'X-Plex-Session-Identifier': currentSession,
    'X-Plex-Client-Identifier': CLIENT_IDENTIFIER,
    'X-Plex-Platform': 'Chrome',
    'X-Plex-Product': 'Plex Mobile Web'
  });
  const url = `/api/plex/video/:/transcode/universal/start.m3u8?${params.toString()}`;

  els.playerView.hidden = false;
  showStatus(null);

  if (window.Hls && Hls.isSupported()) {
    hls = new Hls();
    hls.loadSource(url);
    hls.attachMedia(els.video);
    hls.on(Hls.Events.ERROR, (_evt, data) => {
      if (data.fatal) showStatus(`Erreur de lecture : ${data.details}`);
    });
    els.video.play().catch(() => {});
  } else if (els.video.canPlayType('application/vnd.apple.mpegurl')) {
    els.video.src = url;
    els.video.play().catch(() => {});
  } else {
    showStatus("Ton navigateur ne supporte pas la lecture HLS.");
  }
}

function closePlayer() {
  els.playerView.hidden = true;
  els.video.pause();
  els.video.removeAttribute('src');
  els.video.load();
  if (hls) {
    hls.destroy();
    hls = null;
  }
  if (currentSession) {
    fetch(`/api/plex/video/:/transcode/universal/stop?session=${currentSession}`).catch(() => {});
    currentSession = null;
  }
}
