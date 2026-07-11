// Aucun backend : cette page parle directement, depuis le navigateur du
// téléphone, à l'API de plex.tv (découverte du serveur) puis à ton serveur
// Plex local en HTTPS (adresse *.plex.direct), exactement comme le fait
// app.plex.tv. Le token et l'éventuelle adresse manuelle restent uniquement
// dans le localStorage de ce navigateur.

const els = {
  pageTitle: document.getElementById('pageTitle'),
  refreshBtn: document.getElementById('refreshBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
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
  closePlayerBtn: document.getElementById('closePlayerBtn'),
  settingsView: document.getElementById('settingsView'),
  closeSettingsBtn: document.getElementById('closeSettingsBtn'),
  tokenInput: document.getElementById('tokenInput'),
  serverInput: document.getElementById('serverInput'),
  connectBtn: document.getElementById('connectBtn'),
  forgetBtn: document.getElementById('forgetBtn'),
  settingsStatus: document.getElementById('settingsStatus')
};

let libraries = [];
let activeLibrary = null;
let currentSession = null;
let hls = null;
let conn = null; // { baseUrl, token }

init();

function init() {
  els.refreshBtn.addEventListener('click', () => (activeLibrary ? renderLibraryGrid() : connect()));
  els.settingsBtn.addEventListener('click', openSettings);
  els.closeSettingsBtn.addEventListener('click', closeSettings);
  els.connectBtn.addEventListener('click', onConnectClick);
  els.forgetBtn.addEventListener('click', forgetToken);
  els.closeDetailBtn.addEventListener('click', closeDetailSheet);
  els.closePlayerBtn.addEventListener('click', closePlayer);

  els.tokenInput.value = localStorage.getItem('plexToken') || '';
  els.serverInput.value = localStorage.getItem('plexServerUrlOverride') || '';

  connect();
}

function getClientId() {
  let id = localStorage.getItem('plexClientId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('plexClientId', id);
  }
  return id;
}

// ---- Connexion / découverte du serveur ----

async function discoverServer(token) {
  const url = new URL('https://plex.tv/api/v2/resources');
  url.searchParams.set('includeHttps', '1');
  url.searchParams.set('includeRelay', '0');
  url.searchParams.set('X-Plex-Token', token);

  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'X-Plex-Client-Identifier': getClientId() }
  });
  if (!res.ok) throw new Error(`plex.tv a répondu ${res.status} (token invalide ?)`);
  const resources = await res.json();

  const servers = resources.filter((r) => (r.provides || '').includes('server'));
  const server = servers.find((r) => r.owned) || servers[0];
  if (!server) throw new Error('Aucun serveur Plex trouvé pour ce compte.');

  const connections = server.connections || [];
  const local = connections.find((c) => c.local && c.protocol === 'https') || connections.find((c) => c.local);
  if (!local) throw new Error("Aucune connexion locale trouvée — le PC avec Plex est-il sur le même réseau que ce téléphone ?");

  return { baseUrl: local.uri.replace(/\/$/, ''), token: server.accessToken || token };
}

async function connect() {
  const token = localStorage.getItem('plexToken');
  if (!token) {
    openSettings();
    return false;
  }

  showStatus('Connexion à Plex…', 'info');
  try {
    const override = localStorage.getItem('plexServerUrlOverride');
    const candidate = override ? { baseUrl: override.replace(/\/$/, ''), token } : await discoverServer(token);

    const testUrl = new URL(candidate.baseUrl + '/identity');
    testUrl.searchParams.set('X-Plex-Token', candidate.token);
    const res = await fetch(testUrl, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Le serveur a répondu ${res.status}`);

    conn = candidate;
    showStatus(null);
    loadLibraries();
    return true;
  } catch (err) {
    conn = null;
    showStatus(`Connexion impossible : ${err.message}`);
    return false;
  }
}

// ---- Réglages ----

function openSettings() {
  els.settingsStatus.textContent = '';
  els.settingsView.hidden = false;
}

function closeSettings() {
  els.settingsView.hidden = true;
}

async function onConnectClick() {
  const token = els.tokenInput.value.trim();
  const override = els.serverInput.value.trim();
  if (!token) {
    els.settingsStatus.textContent = 'Le token est obligatoire.';
    return;
  }
  localStorage.setItem('plexToken', token);
  if (override) localStorage.setItem('plexServerUrlOverride', override);
  else localStorage.removeItem('plexServerUrlOverride');

  els.settingsStatus.textContent = 'Connexion…';
  const ok = await connect();
  if (ok) {
    els.settingsStatus.textContent = 'Connecté ✓';
    closeSettings();
  } else {
    els.settingsStatus.textContent = "Échec de connexion, vérifie le token/l'adresse.";
  }
}

function forgetToken() {
  localStorage.removeItem('plexToken');
  localStorage.removeItem('plexServerUrlOverride');
  els.tokenInput.value = '';
  els.serverInput.value = '';
  conn = null;
  libraries = [];
  activeLibrary = null;
  els.tabs.innerHTML = '';
  els.tabs.hidden = true;
  els.grid.innerHTML = '';
  els.pageTitle.textContent = 'Plex';
  els.settingsStatus.textContent = 'Token oublié.';
}

// ---- Appels API Plex ----

function plexUrl(path) {
  const url = new URL(conn.baseUrl + path);
  url.searchParams.set('X-Plex-Token', conn.token);
  return url;
}

async function plexGet(path) {
  const res = await fetch(plexUrl(path), {
    headers: { Accept: 'application/json', 'X-Plex-Client-Identifier': getClientId() }
  });
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
    showStatus(`Impossible de charger les bibliothèques : ${err.message}`);
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
  if (!activeLibrary) return;
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
    if (item.thumb) img.src = plexUrl(item.thumb);

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
  els.detailArt.style.backgroundImage = bg ? `url('${plexUrl(bg)}')` : '';
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
    if (thumb) img.src = plexUrl(thumb);

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
    if (ep.thumb) img.src = plexUrl(ep.thumb);

    const text = document.createElement('div');
    text.innerHTML = `<div class="ep-title">${ep.index}. ${escapeHtml(ep.title)}</div><div class="ep-sub">${formatDuration(ep.duration)}</div>`;

    row.append(img, text);
    row.addEventListener('click', () => playItem(ep));
    els.episodeList.appendChild(row);
  }
}

// ---- Lecture (HLS via le transcodeur universel de Plex) ----

function playItem(item) {
  closeDetailSheet();
  currentSession = crypto.randomUUID();

  const url = plexUrl('/video/:/transcode/universal/start.m3u8');
  const params = {
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
    'X-Plex-Client-Identifier': getClientId(),
    'X-Plex-Platform': 'Chrome',
    'X-Plex-Product': 'Plex Mobile Web'
  };
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  els.playerView.hidden = false;
  showStatus(null);

  if (window.Hls && Hls.isSupported()) {
    hls = new Hls();
    hls.loadSource(url.toString());
    hls.attachMedia(els.video);
    hls.on(Hls.Events.ERROR, (_evt, data) => {
      if (data.fatal) showStatus(`Erreur de lecture : ${data.details}`);
    });
    els.video.play().catch(() => {});
  } else if (els.video.canPlayType('application/vnd.apple.mpegurl')) {
    els.video.src = url.toString();
    els.video.play().catch(() => {});
  } else {
    showStatus('Ton navigateur ne supporte pas la lecture HLS.');
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
  if (currentSession && conn) {
    const stopUrl = plexUrl('/video/:/transcode/universal/stop');
    stopUrl.searchParams.set('session', currentSession);
    fetch(stopUrl).catch(() => {});
    currentSession = null;
  }
}
