/**
 * youtube.js — Lecture audio YouTube via cobalt.tools → Piped → Invidious
 *
 * Stratégie (toutes les tentatives parallèles pour rapidité maximale) :
 *  1. cobalt.tools : API CORS-enabled, renvoie une URL audio directe
 *  2. Piped instances : liste live depuis GitHub wiki, appelées directement (CORS ouvert)
 *  3. Invidious instances : toutes tentées en parallèle (Promise.any)
 *
 * Interface publique : load(), pause(), play(), getCurrentTime(), destroy()
 * Événements : ready, play, pause, ended, error
 */

const COBALT_API = 'https://api.cobalt.tools/';
const TIMEOUT_MS  = 6000;

// Mis à jour par probeEndpoints() — false = cobalt a échoué au diagnostic, on saute l'appel
let _cobaltAvailable = true;

const PIPED_WIKI = 'https://raw.githubusercontent.com/TeamPiped/documentation/refs/heads/main/content/docs/public-instances/index.md';

// Cache de la liste des instances Piped (évite de re-fetcher à chaque chanson)
let _pipedInstancesCache = null;

// Meilleure instance mémorisée entre sessions (localStorage)
const LS_PIPED = 'blindtest_piped_best';
const LS_INVIDIOUS = 'blindtest_invidious_best';
const LS_COBALT_OK = 'blindtest_cobalt_ok';
let _cachedPipedBest = localStorage.getItem(LS_PIPED) ?? null;
let _cachedInvidiousBest = localStorage.getItem(LS_INVIDIOUS) ?? null;

async function getPipedInstances() {
  if (_pipedInstancesCache) return _pipedInstancesCache;
  const resp = await fetch(PIPED_WIKI, { signal: AbortSignal.timeout(8000) });
  if (!resp.ok) throw new Error(`Impossible de charger la liste Piped (HTTP ${resp.status})`);
  const body = await resp.text();
  const instances = [];
  for (const line of body.split('\n')) {
    // Cherche dans chaque cellule séparée par | une URL propre (pas un badge markdown)
    for (const cell of line.split('|')) {
      const url = cell.trim();
      if (/^https:\/\/[^\s![\]()]+$/.test(url)) {
        instances.push(url);
        break; // une seule URL API par ligne
      }
    }
  }
  // Mettre l'instance mémorisée en tête pour la prioriser lors de la lecture
  if (_cachedPipedBest) {
    const idx = instances.indexOf(_cachedPipedBest);
    if (idx > 0) instances.splice(idx, 1);
    if (idx !== 0) instances.unshift(_cachedPipedBest);
  }
  _pipedInstancesCache = instances.length ? instances : null;
  if (!instances.length) throw new Error('Aucune instance Piped trouvée dans le wiki');
  return instances;
}

const INVIDIOUS_API = 'https://api.invidious.io/instances.json?sort_by=type,users';

// Instances de secours au cas où api.invidious.io ne répond pas
const INVIDIOUS_FALLBACK = [
  'https://invidious.privacydev.net',
  'https://yt.artemislena.eu',
  'https://invidious.flokinet.to',
  'https://iv.datura.network',
  'https://yewtu.be',
  'https://inv.tux.pizza',
  'https://invidious.fdn.fr',
];

// Cache de la liste des instances Invidious
let _invidiousInstancesCache = null;

async function getInvidiousInstances() {
  if (_invidiousInstancesCache) return _invidiousInstancesCache;
  const resp = await fetch(INVIDIOUS_API, { signal: AbortSignal.timeout(8000) });
  if (!resp.ok) throw new Error(`API Invidious inaccessible (HTTP ${resp.status})`);
  const data = await resp.json();
  // Format : [[domain, { type, uri, monitor: { down }, ... }]]
  const instances = data
    .filter(([, info]) => info.type === 'https' && info.monitor?.down !== true)
    .map(([, info]) => info.uri.replace(/\/$/, ''));
  if (!instances.length) throw new Error('Aucune instance Invidious disponible');
  // Mettre l'instance mémorisée en tête
  if (_cachedInvidiousBest) {
    const idx = instances.indexOf(_cachedInvidiousBest);
    if (idx > 0) instances.splice(idx, 1);
    if (idx !== 0) instances.unshift(_cachedInvidiousBest);
  }
  _invidiousInstancesCache = instances;
  return instances;
}

async function fetchViaCobalt(videoId) {
  if (!_cobaltAvailable) throw new Error('cobalt désactivé (probe failed)');
  const resp = await fetch(COBALT_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      url: `https://www.youtube.com/watch?v=${videoId}`,
      downloadMode: 'audio',
      audioFormat: 'best',
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!resp.ok) throw new Error(`cobalt HTTP ${resp.status}`);
  const data = await resp.json();
  if (data.status === 'error') throw new Error(`cobalt: ${data.error?.code ?? data.text ?? 'erreur inconnue'}`);
  const url = data.url ?? data.tunnel;
  if (!url) throw new Error('cobalt: pas d\'URL dans la réponse');
  return url;
}

async function _fetchViaPipedInstance(instance, videoId) {
  const resp = await fetch(`${instance}/streams/${videoId}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!resp.ok) throw new Error(`${instance}: HTTP ${resp.status}`);
  const data = await resp.json();
  const streams = (data.audioStreams || []).filter(s => s.url);
  if (!streams.length) throw new Error(`${instance}: aucun flux`);
  streams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
  return streams[0].url;
}

/**
 * Si l'hôte a suggéré une meilleure instance, on la teste seule en premier.
 * Si elle échoue, fallback sur Promise.any des instances restantes.
 */
async function fetchViaPiped(videoId) {
  const instances = await getPipedInstances();
  if (_cachedPipedBest && instances.includes(_cachedPipedBest)) {
    try {
      return await _fetchViaPipedInstance(_cachedPipedBest, videoId);
    } catch { /* fallback */ }
  }
  const rest = instances.filter(i => i !== _cachedPipedBest);
  if (!rest.length) throw new Error('Piped: toutes les instances ont échoué');
  return Promise.any(rest.map(i => _fetchViaPipedInstance(i, videoId)))
    .catch(() => { throw new Error('Piped: toutes les instances ont échoué'); });
}

function _probeInvidiousInstance(instance, videoId) {
  return new Promise((resolve, reject) => {
    const url = `${instance}/latest_version?id=${videoId}&itag=140&local=true`;
    const tmp = new Audio();
    const timer = setTimeout(() => { tmp.src = ''; reject(new Error('timeout')); }, TIMEOUT_MS);
    tmp.addEventListener('canplay', () => { clearTimeout(timer); resolve(url); }, { once: true });
    tmp.addEventListener('error',   () => { clearTimeout(timer); reject(new Error('error')); }, { once: true });
    tmp.src = url;
  });
}

/**
 * Si l'hôte a suggéré une meilleure instance, on la sonde seule en premier.
 * Si elle échoue, fallback sur Promise.any des instances restantes.
 */
async function fetchViaInvidious(audio, videoId) {
  const instances = await getInvidiousInstances().catch(() => INVIDIOUS_FALLBACK);
  if (_cachedInvidiousBest && instances.includes(_cachedInvidiousBest)) {
    try {
      return await _probeInvidiousInstance(_cachedInvidiousBest, videoId);
    } catch { /* fallback */ }
  }
  const rest = instances.filter(i => i !== _cachedInvidiousBest);
  if (!rest.length) throw new Error('Invidious: toutes les instances ont échoué');
  return Promise.any(rest.map(i => _probeInvidiousInstance(i, videoId)))
    .catch(() => { throw new Error('Invidious: toutes les instances ont échoué'); });
}


/**
 * Teste cobalt.tools, toutes les instances Piped et toutes les instances Invidious
 * simultanément (Promise.all). Met à jour les caches internes pour la partie.
 *
 * @param {string} testVideoId  — ID YouTube de référence (vidéo publique)
 * @param {Function} onProgress — appelé quand une liste est téléchargée : { source, total }
 * @returns {{ cobalt, pipedWorking, pipedTotal, invidiousWorking, invidiousTotal }}
 */
export async function probeEndpoints(testVideoId = 'dQw4w9WgXcQ', onProgress = () => {}) {
  _cobaltAvailable = true;
  _pipedInstancesCache = null;
  _invidiousInstancesCache = null;

  // ── 3 branches lancées simultanément ────────────────────────────────────

  const cobaltBranch = fetchViaCobalt(testVideoId)
    .then(() => true)
    .catch(() => false);

  const pipedBranch = getPipedInstances()
    .then(async (allInstances) => {
      onProgress({ source: 'piped-fetched', total: allInstances.length });
      const results = await Promise.allSettled(
        allInstances.map(async (instance) => {
          const resp = await fetch(`${instance}/streams/${testVideoId}`, {
            signal: AbortSignal.timeout(TIMEOUT_MS),
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const data = await resp.json();
          if (!(data.audioStreams?.length)) throw new Error('pas de flux audio');
          return instance;
        })
      );
      const working = results.filter(r => r.status === 'fulfilled').map(r => r.value);
      return { total: allInstances.length, working };
    })
    .catch(() => ({ total: 0, working: [] }));

  const invidiousBranch = getInvidiousInstances()
    .then(async (allInstances) => {
      onProgress({ source: 'invidious-fetched', total: allInstances.length });
      const results = await Promise.allSettled(
        allInstances.map((instance) => new Promise((resolve, reject) => {
          const url = `${instance}/latest_version?id=${testVideoId}&itag=140&local=true`;
          const tmp = new Audio();
          const timer = setTimeout(() => { tmp.src = ''; reject(new Error('timeout')); }, TIMEOUT_MS);
          tmp.addEventListener('canplay', () => { clearTimeout(timer); tmp.src = ''; resolve(instance); }, { once: true });
          tmp.addEventListener('error',   () => { clearTimeout(timer); reject(new Error('error')); }, { once: true });
          tmp.src = url;
        }))
      );
      const working = results.filter(r => r.status === 'fulfilled').map(r => r.value);
      return { total: allInstances.length, working };
    })
    .catch(() => ({ total: 0, working: [] }));

  // ── Attente simultanée ──────────────────────────────────────────────────
  const [cobaltOk, piped, invidious] = await Promise.all([cobaltBranch, pipedBranch, invidiousBranch]);

  _cobaltAvailable = cobaltOk;
  _pipedInstancesCache = piped.working.length ? piped.working : null;
  _invidiousInstancesCache = invidious.working.length ? invidious.working : null;

  // Mémoriser la meilleure instance de chaque type pour les prochaines sessions
  if (piped.working.length) {
    _cachedPipedBest = piped.working[0];
    localStorage.setItem(LS_PIPED, piped.working[0]);
  }
  if (invidious.working.length) {
    _cachedInvidiousBest = invidious.working[0];
    localStorage.setItem(LS_INVIDIOUS, invidious.working[0]);
  }
  localStorage.setItem(LS_COBALT_OK, cobaltOk ? 'true' : 'false');

  return {
    cobalt: cobaltOk,
    pipedWorking: piped.working.length,
    pipedTotal: piped.total,
    invidiousWorking: invidious.working.length,
    invidiousTotal: invidious.total,
  };
}

/**
 * Vérifie rapidement si le endpoint mis en cache lors du dernier test est encore opérationnel.
 * Si oui, met à jour l'état interne et retourne un objet résultat compatible avec probeEndpoints.
 * Si non (ou si aucun cache), retourne null → il faut relancer probeEndpoints.
 */
export async function quickCheckCachedEndpoint(testVideoId = 'dQw4w9WgXcQ') {
  const cobaltWasOk  = localStorage.getItem(LS_COBALT_OK) === 'true';
  const pipedBest    = localStorage.getItem(LS_PIPED);
  const invidiousBest = localStorage.getItem(LS_INVIDIOUS);

  if (!cobaltWasOk && !pipedBest && !invidiousBest) return null;

  const checks = [];

  if (cobaltWasOk) {
    checks.push(fetchViaCobalt(testVideoId).then(() => ({ source: 'cobalt' })));
  }
  if (pipedBest) {
    checks.push(_fetchViaPipedInstance(pipedBest, testVideoId).then(() => ({ source: 'piped', instance: pipedBest })));
  }
  if (invidiousBest) {
    checks.push(new Promise((resolve, reject) => {
      const url = `${invidiousBest}/latest_version?id=${testVideoId}&itag=140&local=true`;
      const tmp = new Audio();
      const timer = setTimeout(() => { tmp.src = ''; reject(new Error('timeout')); }, TIMEOUT_MS);
      tmp.addEventListener('canplay', () => { clearTimeout(timer); tmp.src = ''; resolve({ source: 'invidious', instance: invidiousBest }); }, { once: true });
      tmp.addEventListener('error',   () => { clearTimeout(timer); reject(new Error('error')); }, { once: true });
      tmp.src = url;
    }));
  }

  try {
    const winner = await Promise.any(checks);
    // Mettre à jour l'état interne selon ce qui a fonctionné
    _cobaltAvailable = winner.source === 'cobalt';
    if (winner.source === 'piped') {
      _pipedInstancesCache = [winner.instance];
      _cachedPipedBest = winner.instance;
    }
    if (winner.source === 'invidious') {
      _invidiousInstancesCache = [winner.instance];
      _cachedInvidiousBest = winner.instance;
    }
    return {
      cobalt: winner.source === 'cobalt',
      pipedWorking: winner.source === 'piped' ? 1 : 0,
      pipedTotal: pipedBest ? 1 : 0,
      invidiousWorking: winner.source === 'invidious' ? 1 : 0,
      invidiousTotal: invidiousBest ? 1 : 0,
      source: winner.source,
      _quick: true,
    };
  } catch {
    return null; // Aucun endpoint cached ne répond → relancer probeEndpoints
  }
}

/** Retourne les listes d'instances validées (à transmettre aux clients). */
export function getInstanceCaches() {
  return {
    piped: _pipedInstancesCache ?? [],
    invidious: _invidiousInstancesCache ?? [],
  };
}

/** Injecte des listes d'instances (côté client, reçues de l'hôte). */
export function setInstanceCaches(piped, invidious) {
  if (piped?.length) {
    _pipedInstancesCache = piped;
    _cachedPipedBest = piped[0];
    localStorage.setItem(LS_PIPED, piped[0]);
  }
  if (invidious?.length) {
    _invidiousInstancesCache = invidious;
    _cachedInvidiousBest = invidious[0];
    localStorage.setItem(LS_INVIDIOUS, invidious[0]);
  }
}

export class YouTubePlayer extends EventTarget {
  constructor(_containerId, _opts = {}) {
    super();
    this._audio = null;
    this._ready = false;
    this._currentVideoId = null;
  }

  init() {
    this._audio = new Audio();
    this._audio.preload = 'none';

    this._audio.addEventListener('playing', () => this.dispatchEvent(new CustomEvent('play')));
    this._audio.addEventListener('pause',   () => this.dispatchEvent(new CustomEvent('pause')));
    this._audio.addEventListener('ended',   () => this.dispatchEvent(new CustomEvent('ended')));

    this._ready = true;
    this.dispatchEvent(new CustomEvent('ready'));
    return Promise.resolve();
  }

  async load(videoId, seekTo = 0) {
    if (!this._ready || !this._audio) return;
    this._currentVideoId = videoId;
    const audio = this._audio;

    const applyAndPlay = (url) => {
      if (this._currentVideoId !== videoId) return;
      audio.src = url;
      if (seekTo > 0) {
        audio.addEventListener('canplay', () => { audio.currentTime = seekTo; }, { once: true });
      }
      audio.play().catch(() => {});
    };

    // ── Tentative 1 : cobalt.tools ──────────────────────────────────────────
    try {
      const url = await fetchViaCobalt(videoId);
      applyAndPlay(url);
      return;
    } catch (e) {
      console.warn('[Audio] cobalt.tools échoué :', e.message);
    }

    if (this._currentVideoId !== videoId) return;

    // ── Tentative 2 : instances Piped (parallèle) ────────────────────────────
    try {
      const url = await fetchViaPiped(videoId);
      if (this._currentVideoId !== videoId) return;
      applyAndPlay(url);
      return;
    } catch (e) {
      console.warn('[Audio] Piped échoué :', e.message);
    }

    if (this._currentVideoId !== videoId) return;

    // ── Tentative 3 : instances Invidious (parallèle) ────────────────────────
    try {
      const url = await fetchViaInvidious(audio, videoId);
      if (this._currentVideoId !== videoId) return;
      audio.src = url;
      if (seekTo > 0) audio.currentTime = seekTo;
      audio.play().catch(() => {});
      return;
    } catch (e) {
      console.warn('[Audio] Invidious échoué :', e.message);
    }

    // Toutes les sources ont échoué
    console.error('[Audio] Aucune source disponible pour', videoId);
    this.dispatchEvent(new CustomEvent('error', { detail: { code: -1 } }));
  }

  pause() { this._audio?.pause(); }

  play() { this._audio?.play().catch(() => {}); }

  getCurrentTime() { return this._audio?.currentTime || 0; }

  getState() {
    if (!this._audio) return -1;
    if (this._audio.ended)  return 0;
    if (this._audio.paused) return 2;
    return 1;
  }

  destroy() {
    if (this._audio) {
      this._audio.pause();
      this._audio.src = '';
      this._audio = null;
    }
    this._ready = false;
  }
}

