/**
 * playlist.js — Gestion de la playlist de l'hôte
 *
 * Stockage : localStorage['blind-test-playlist'] = JSON.stringify(Song[])
 * Song : { id, videoId, title, artist, year: number|null, genre: string|null, alternatives: [] }
 */

import { fuzzyMatch, normalize } from './fuzzy.js';

const STORAGE_KEY = 'blind-test-playlist';
const SAVED_KEY   = 'blind-test-saved-playlists';

/**
 * Extrait le videoId depuis une URL YouTube de différents formats :
 * - https://www.youtube.com/watch?v=XXXXXXXXXXX
 * - https://youtu.be/XXXXXXXXXXX
 * - https://www.youtube.com/embed/XXXXXXXXXXX
 * - https://youtube.com/shorts/XXXXXXXXXXX
 */
export function extractVideoId(url) {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    if (u.hostname === 'youtu.be') {
      return u.pathname.slice(1).split('?')[0] || null;
    }
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return v;
      // /embed/ ou /shorts/
      const m = u.pathname.match(/\/(embed|shorts|v)\/([^/?&]+)/);
      if (m) return m[2];
    }
  } catch {
    // Si ce n'est pas une URL valide, tente le match direct (videoId brut)
    const m = url.trim().match(/^[a-zA-Z0-9_-]{11}$/);
    if (m) return url.trim();
  }
  return null;
}

export function loadPlaylist() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePlaylist(songs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
  } catch (e) {
    console.warn('Impossible de sauvegarder la playlist', e);
  }
}

export function addSong(songs, { url, title, artist, year, genre, alternatives }) {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error('URL YouTube invalide');

  const song = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    videoId,
    title: (title || 'Titre inconnu').trim(),
    artist: (artist || '?').trim(),
    year: year ?? null,
    genre: genre ?? null,
    alternatives: alternatives || [],
  };
  const updated = [...songs, song];
  savePlaylist(updated);
  return updated;
}

export function removeSong(songs, id) {
  const updated = songs.filter(s => s.id !== id);
  savePlaylist(updated);
  return updated;
}

export function moveSong(songs, id, direction) {
  const idx = songs.findIndex(s => s.id === id);
  if (idx === -1) return songs;
  const target = direction === 'up' ? idx - 1 : idx + 1;
  if (target < 0 || target >= songs.length) return songs;
  const updated = [...songs];
  [updated[idx], updated[target]] = [updated[target], updated[idx]];
  savePlaylist(updated);
  return updated;
}

/**
 * Mélange (Fisher-Yates) et retourne une copie
 */
export function shufflePlaylist(songs) {
  const arr = [...songs];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── Import depuis une playlist YouTube (Innertube API) ──────────────────────

/**
 * Extrait le playlistId depuis une URL YouTube playlist.
 * Supporte youtube.com/playlist?list=, watch?list=, music.youtube.com, etc.
 */
export function extractPlaylistId(url) {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    return u.searchParams.get('list') || null;
  } catch {
    // Tente un match brut si ce n'est pas une URL complète
    const m = url.trim().match(/[?&]list=([a-zA-Z0-9_-]+)/);
    return m ? m[1] : null;
  }
}

const CORS_PROXY = 'https://corsproxy.io/?url=';
const INNERTUBE_BROWSE = 'https://www.youtube.com/youtubei/v1/browse';

function findAllByKey(obj, key, depth = 0) {
  const results = [];
  if (!obj || typeof obj !== 'object' || depth > 30) return results;
  if (Array.isArray(obj)) {
    for (const item of obj) results.push(...findAllByKey(item, key, depth + 1));
  } else {
    if (key in obj) results.push(obj[key]);
    for (const val of Object.values(obj)) {
      if (val && typeof val === 'object') results.push(...findAllByKey(val, key, depth + 1));
    }
  }
  return results;
}

function extractVideosFromData(data, songs) {
  const renderers = findAllByKey(data, 'playlistVideoRenderer');
  for (const v of renderers) {
    if (!v.videoId) continue;
    const title =
      v.title?.runs?.[0]?.text ||
      v.title?.simpleText ||
      'Titre inconnu';
    const artist =
      v.shortBylineText?.runs?.[0]?.text ||
      v.longBylineText?.runs?.[0]?.text ||
      '?';
    songs.push({ videoId: v.videoId, title: title.trim(), artist: artist.trim() });
  }
}

function extractContinuationToken(data) {
  const tokens = findAllByKey(data, 'token');
  // Continuation tokens are long opaque strings starting with "4q"
  return tokens.find(t => typeof t === 'string' && t.length > 40) || null;
}

function extractAssignedJson(html, markers) {
  for (const marker of markers) {
    const markerIndex = html.indexOf(marker);
    if (markerIndex === -1) continue;

    const objectStart = html.indexOf('{', markerIndex + marker.length);
    if (objectStart === -1) continue;

    let depth = 0;
    let inString = false;
    let escaping = false;

    for (let i = objectStart; i < html.length; i++) {
      const ch = html[i];
      if (inString) {
        if (escaping) escaping = false;
        else if (ch === '\\') escaping = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === '{') {
        depth++;
        continue;
      }
      if (ch === '}') {
        depth--;
        if (depth === 0) return html.slice(objectStart, i + 1);
      }
    }
  }

  return null;
}

/**
 * Importe les vidéos d'une playlist YouTube.
 * Étape 1 : scrape la page HTML de la playlist via corsproxy pour lire ytInitialData.
 * Étape 2 : pagination via l'API Innertube (aussi via corsproxy).
 *
 * @param {string} playlistUrl — URL de la playlist YouTube
 * @param {Function} [onProgress] — callback(loaded) pendant la pagination
 * @returns {Promise<Array<{videoId, title, artist}>>}
 */
export async function fetchYouTubePlaylist(playlistUrl, onProgress) {
  const playlistId = extractPlaylistId(playlistUrl);
  if (!playlistId) throw new Error('URL de playlist YouTube invalide (paramètre list= introuvable)');

  // ── Étape 1 : lire la page playlist pour récupérer ytInitialData ─────────
  const pageUrl = `https://www.youtube.com/playlist?list=${playlistId}&hl=fr`;
  const pageResp = await fetch(CORS_PROXY + encodeURIComponent(pageUrl));
  if (!pageResp.ok) throw new Error(`Impossible de charger la playlist (${pageResp.status})`);

  const html = await pageResp.text();

  const rawJson = extractAssignedJson(html, [
    'var ytInitialData = ',
    'window["ytInitialData"] = ',
    'ytInitialData = ',
  ]);
  if (!rawJson) throw new Error('Impossible de parser ytInitialData');

  let data;
  try { data = JSON.parse(rawJson); }
  catch { throw new Error('Erreur de parsing ytInitialData'); }

  const songs = [];
  extractVideosFromData(data, songs);
  onProgress?.(songs.length);

  // ── Étape 2 : pagination Innertube ───────────────────────────────────────
  const innertubeCtx = {
    context: {
      client: { clientName: 'WEB', clientVersion: '2.20240101.00.00', hl: 'fr', gl: 'FR' },
    },
  };

  let token = extractContinuationToken(data);
  while (token) {
    const contResp = await fetch(CORS_PROXY + encodeURIComponent(INNERTUBE_BROWSE), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...innertubeCtx, continuation: token }),
    });
    if (!contResp.ok) break;
    data = await contResp.json();
    extractVideosFromData(data, songs);
    onProgress?.(songs.length);
    token = extractContinuationToken(data);
  }

  if (songs.length === 0) throw new Error('Aucune vidéo trouvée dans cette playlist. Vérifiez qu\'elle est publique.');
  return songs;
}

/**
 * Ajoute les chansons importées dans la playlist existante (déduplique par videoId).
 */
export function mergeSongs(existing, imported) {
  const existingIds = new Set(existing.map(s => s.videoId));
  const news = imported
    .filter(s => !existingIds.has(s.videoId))
    .map(s => ({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      videoId: s.videoId,
      title: s.title,
      artist: s.artist,
      alternatives: s.alternatives || [],
    }));
  const updated = [...existing, ...news];
  savePlaylist(updated);
  return { updated, added: news.length, skipped: imported.length - news.length };
}

// ─── Enrichissement via iTunes Search API ────────────────────────────────────

const ITUNES_SEARCH    = 'https://itunes.apple.com/search';
const ITUNES_CACHE_KEY = 'blind-test-itunes-cache';
const ITUNES_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 1 semaine en ms

function _cacheLoad() {
  try { return JSON.parse(localStorage.getItem(ITUNES_CACHE_KEY) || '{}'); } catch { return {}; }
}
function _cacheSave(store) {
  try { localStorage.setItem(ITUNES_CACHE_KEY, JSON.stringify(store)); } catch { /* quota */ }
}
function _cacheGet(key) {
  const store = _cacheLoad();
  const entry = store[key];
  if (!entry) return undefined;
  if (Date.now() - entry.ts > ITUNES_CACHE_TTL) return undefined; // expiré
  return entry.data;
}
function _cacheSet(key, data) {
  const store = _cacheLoad();
  store[key] = { data, ts: Date.now() };
  // Purge des entrées expirées à chaque écriture pour limiter la taille
  const now = Date.now();
  for (const k of Object.keys(store)) {
    if (now - store[k].ts > ITUNES_CACHE_TTL) delete store[k];
  }
  _cacheSave(store);
}

/** Retourne les métadonnées complètes d'un videoId depuis le cache, ou null. */
export function getVideoCache(videoId) {
  const v = _cacheGet(`vid:${videoId}`);
  return v !== undefined ? v : null;
}
/** Stocke les métadonnées complètes d'un videoId dans le cache. */
export function setVideoCache(videoId, data) {
  _cacheSet(`vid:${videoId}`, data);
}

/**
 * fetch avec retry infini sur 429 (Too Many Requests).
 * Attend le délai indiqué par Retry-After (ou un backoff exponentiel) avant de réessayer.
 * @param {string} url
 */
async function itunesFetch(url) {
  let delay = 1000;
  while (delay<=60000) {
    const resp = await fetch(url).catch((error) => {
      console.error(`iTunes API fetch error for ${url}:`, error);
      if (error.message.includes('429')) {
        return { status: 429, headers: new Headers({ 'Retry-After': '1' }) };
      }
      if (error.message.includes('Failed to fetch')) {
        return { status: 429, headers: new Headers({ 'Retry-After': '5' }) };
      }
    });
    console.log(`iTunes API response: ${resp.status} for ${url}`);
    if (resp.status !== 429) return resp;
    const wait = delay;
    await new Promise(r => setTimeout(r, wait));
    delay *= 2;
    console.log(`iTunes API rate limit hit, retrying in ${wait / 1000}s...`);
  }
}

/**
 * Récupère le titre d'une vidéo YouTube via l'API oEmbed (sans clé API).
 * @param {string} videoId
 * @returns {Promise<string|null>}
 */
export async function fetchVideoTitle(videoId) {
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + videoId)}&format=json`;
  let delay = 1000;
  for (;;) {
    try {
      const resp = await fetch(url);
      if (resp.status === 429) {
        const retryAfter = parseInt(resp.headers.get('Retry-After') || '0', 10);
        const wait = retryAfter > 0 ? retryAfter * 1000 : delay;
        await new Promise(r => setTimeout(r, wait));
        delay *= 2;
        continue;
      }
      if (!resp.ok) return null;
      const data = await resp.json();
      return data.title ?? null;
    } catch {
      return null;
    }
  }
}

/**
 * Récupère jusqu'à 3 autres chansons du même artiste via iTunes Search,
 * en excluant le titre de la chanson elle-même.
 * @param {string} artist
 * @param {string} excludeTitle
 * @returns {Promise<Array<{title: string, artist: string}>>}
 */
export async function fetchArtistAlternatives(artist, excludeTitle) {
  if (!artist || artist === '?') return [];
  const cacheKey = `alt:${artist.toLowerCase()}`;
  const cached = _cacheGet(cacheKey);
  if (cached !== undefined) {
    // Applique le filtre excludeTitle sur le résultat mis en cache
    const excl = excludeTitle.toLowerCase();
    return cached.filter(r => r.title.toLowerCase() !== excl);
  }
  try {
    const url = `${ITUNES_SEARCH}?term=${encodeURIComponent(artist)}&entity=song&limit=10&country=FR`;
    const resp = await itunesFetch(url);
    if (!resp.ok) return [];
    const data = await resp.json();
    // Stocke toutes les pistes (sans filtre) pour réutilisation
    const all = (data.results || [])
      .filter(r => r.trackName && r.artistName)
      .slice(0, 10)
      .map(r => ({ title: r.trackName, artist: r.artistName }));
    _cacheSet(cacheKey, all);
    const excl = excludeTitle.toLowerCase();
    return all.filter(r => r.title.toLowerCase() !== excl).slice(0, 3);
  } catch {
    return [];
  }
}

function cleanItunesSearchText(text) {
  return String(text || '')
    .replace(/\s*[\[(][^\])\n]*[\])\n]/g, '')
    .replace(/\s*[-–|]\s*(Official|Audio|Lyrics?|Video|HD|HQ|4K|Live|Karaoke|Cover|Clip).*/i, '')
    .replace(/\s+(feat\.?|ft\.?)\s+.+$/i, '')
    .trim();
}

function splitYouTubeTitle(rawTitle) {
  const cleaned = cleanItunesSearchText(rawTitle);
  const separators = [' - ', ' – ', ' — ', ' | ', ': '];
  for (const separator of separators) {
    const parts = cleaned.split(separator);
    if (parts.length >= 2) {
      return {
        artist: parts[0].trim(),
        title: parts.slice(1).join(separator).trim(),
      };
    }
  }
  return { artist: '', title: cleaned };
}

function isItunesCandidateMatchingVideo(hit, youtubeTitle, expectedArtist = '') {
  if (!hit?.trackName || !youtubeTitle) return false;

  const normalizedVideoTitle = normalize(youtubeTitle);
  const normalizedTrackName = normalize(hit.trackName);
  const normalizedArtistName = normalize(hit.artistName || '');
  const normalizedExpectedArtist = normalize(expectedArtist || '');

  const titleMatches = fuzzyMatch(hit.trackName, youtubeTitle)
    || fuzzyMatch(youtubeTitle, hit.trackName)
    || normalizedVideoTitle.includes(normalizedTrackName);
  if (!titleMatches) return false;

  if (!normalizedExpectedArtist) return true;
  return fuzzyMatch(hit.artistName, expectedArtist)
    || normalizedVideoTitle.includes(normalizedArtistName)
    || normalizedArtistName.includes(normalizedExpectedArtist)
    || normalizedExpectedArtist.includes(normalizedArtistName);
}

function pickBestItunesResult(results, youtubeTitle, expectedArtist = '') {
  const normalizedExpectedArtist = normalize(expectedArtist || '');
  const candidates = (results || []).filter(hit => isItunesCandidateMatchingVideo(hit, youtubeTitle, expectedArtist));
  if (!candidates.length) return null;
  if (!normalizedExpectedArtist) return candidates[0];

  return candidates.sort((a, b) => {
    const aExact = normalize(a.artistName || '') === normalizedExpectedArtist ? 1 : 0;
    const bExact = normalize(b.artistName || '') === normalizedExpectedArtist ? 1 : 0;
    return bExact - aExact;
  })[0];
}

/**
 * Cherche les métadonnées canoniques d'une chanson via l'API iTunes Search.
 * Retourne { title, artist } si un résultat est trouvé, null sinon.
 * @param {string} title — titre brut (peut être le titre de la vidéo YouTube)
 * @param {string} [artist] — artiste brut (facultatif)
 * @returns {Promise<{title: string, artist: string}|null>}
 */
export async function lookupSongMetadata(title, artist) {
  const parsed = splitYouTubeTitle(title);
  const cleanTitle = cleanItunesSearchText(parsed.title || title);
  // Supprime "VEVO", "- Topic", etc. dans l'artiste
  const cleanArtist = (artist && artist !== '?'
    ? artist
    : parsed.artist).replace(/\s*(VEVO|-\s*Topic|Official)$/i, '').trim();

  const term = cleanArtist ? `${cleanArtist} ${cleanTitle}` : cleanTitle;
  if (!term) return null;

  const cacheKey = `meta:${term.toLowerCase()}`;
  const cached = _cacheGet(cacheKey);
  if (cached !== undefined) return cached; // null signifie "pas de résultat", c'est valide

  // Vérifie le cache artiste avant tout appel réseau
  if (cleanArtist) {
    const artistKey = `artist-songs:${cleanArtist.toLowerCase()}`;
    const artistSongs = _cacheGet(artistKey);
    if (artistSongs) {
      const normalizedTitle = cleanTitle.toLowerCase();
      const match = artistSongs.find(s => s.title.toLowerCase() === normalizedTitle) ?? null;
      if (match) {
        _cacheSet(cacheKey, match);
        return match;
      }
      // L'artiste est connu mais ce titre n'y figure pas → appel spécifique ci-dessous
    }
  }

  try {
    const searchTerms = [
      cleanArtist ? `${cleanArtist} ${cleanTitle}` : '',
      cleanTitle,
      cleanArtist ? `${cleanTitle} ${cleanArtist}` : '',
      cleanItunesSearchText(title),
    ].filter(Boolean).filter((value, index, arr) => arr.indexOf(value) === index);

    let hit = null;
    let data = null;
    for (const searchTerm of searchTerms) {
      const url = `${ITUNES_SEARCH}?term=${encodeURIComponent(searchTerm)}&entity=song&limit=25&country=FR`;
      const resp = await itunesFetch(url);
      if (!resp?.ok) continue;
      data = await resp.json();
      hit = pickBestItunesResult(data.results, cleanTitle, cleanArtist);
      if (hit) break;
    }

    if (!hit || !data) { _cacheSet(cacheKey, null); return null; }

    const year = hit.releaseDate ? parseInt(hit.releaseDate.slice(0, 4), 10) : null;
    const result = {
      title: hit.trackName,
      artist: hit.artistName,
      year: Number.isFinite(year) ? year : null,
      genre: hit.primaryGenreName ?? null,
    };
    _cacheSet(cacheKey, result);

    // Alimente le cache artiste avec tous les résultats retournés
    if (cleanArtist) {
      const artistKey = `artist-songs:${cleanArtist.toLowerCase()}`;
      const existing = _cacheGet(artistKey) || [];
      const titleSet = new Set(existing.map(s => s.title.toLowerCase()));
      for (const r of (data.results || [])) {
        if (!r.trackName || !r.artistName) continue;
        if (titleSet.has(r.trackName.toLowerCase())) continue;
        const y = r.releaseDate ? parseInt(r.releaseDate.slice(0, 4), 10) : null;
        existing.push({
          title: r.trackName,
          artist: r.artistName,
          year: Number.isFinite(y) ? y : null,
          genre: r.primaryGenreName ?? null,
        });
        titleSet.add(r.trackName.toLowerCase());
      }
      _cacheSet(artistKey, existing);
    }

    return result;
  } catch {
    return null;
  }
}

/**
 * Enrichit une liste de chansons avec les métadonnées iTunes (par lots de 5).
 * Pour chaque chanson, récupère aussi jusqu'à 3 alternatives du même artiste.
 * @param {Array<{videoId, title, artist}>} songs
 * @param {Function} [onProgress] — callback(current, total)
 * @returns {Promise<Array<{videoId, title, artist, alternatives}>>}
 */
export async function enrichWithMusicMetadata(songs, onProgress) {
  const BATCH = 5;
  const results = [...songs];
  let completed = 0;

  for (let i = 0; i < songs.length; i += BATCH) {
    const batch = songs.slice(i, i + BATCH);
    const enriched = await Promise.all(
      batch.map(async s => {
        // Court-circuit : videoId déjà enrichi
        const vidCached = getVideoCache(s.videoId);
        if (vidCached) return { fromVideoCache: true, ...vidCached };

        let meta = await lookupSongMetadata(s.title, s.artist).catch(() => null);
        if (meta && !isItunesCandidateMatchingVideo({ trackName: meta.title, artistName: meta.artist }, s.title, s.artist)) {
          meta = await lookupSongMetadata(s.title, null).catch(() => null);
        }
        const resolvedTitle = meta ? meta.title : s.title;
        const resolvedArtist = meta ? meta.artist : s.artist;
        const alternatives = await fetchArtistAlternatives(resolvedArtist, resolvedTitle).catch(() => []);
        const enrichedData = {
          title: resolvedTitle,
          artist: resolvedArtist,
          year: meta?.year ?? s.year ?? null,
          genre: meta?.genre ?? s.genre ?? null,
          alternatives,
        };
        setVideoCache(s.videoId, enrichedData);
        return enrichedData;
      })
    );
    for (let j = 0; j < batch.length; j++) {
      const { fromVideoCache: _, ...enrichedData } = enriched[j];
      results[i + j] = { ...songs[i + j], ...enrichedData };
      onProgress?.(++completed, songs.length);
    }
    if (i + BATCH < songs.length) await new Promise(r => setTimeout(r, 250));
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pour le mode 4 choix : génère 3 mauvaises réponses.
 * Les alternatives pré-récupérées du même artiste (song.alternatives) ont une
 * pondération ×3 par rapport aux autres chansons de la playlist.
 * Retourne un tableau de 4 strings mélangées incluant la bonne réponse.
 */
export function generateFourChoices(currentSong, allSongs) {
  const correct = `${currentSong.title} — ${currentSong.artist}`;
  const usedLabels = new Set([correct]);

  // Alternatives pré-fetched du même artiste (poids ×3)
  const altLabels = (currentSong.alternatives || [])
    .map(a => `${a.title} — ${a.artist}`)
    .filter(a => a !== correct);

  // Autres chansons de la playlist (poids ×1)
  const playlistLabels = allSongs
    .filter(s => s.id !== currentSong.id)
    .map(s => `${s.title} — ${s.artist}`);

  // Pool pondéré : alternatives apparaissent 3 fois
  const weightedPool = [...altLabels, ...altLabels, ...altLabels, ...playlistLabels];

  // Mélange Fisher-Yates
  for (let i = weightedPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [weightedPool[i], weightedPool[j]] = [weightedPool[j], weightedPool[i]];
  }

  // Pick 3 réponses fausses uniques
  const wrongs = [];
  for (const candidate of weightedPool) {
    if (wrongs.length >= 3) break;
    if (!usedLabels.has(candidate)) {
      usedLabels.add(candidate);
      wrongs.push(candidate);
    }
  }

  const choices = [correct, ...wrongs];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return choices;
}

// ─── Export / Import JSON ─────────────────────────────────────────────────────

export function exportPlaylistJSON(songs) {
  const normalized = songs.map(s => ({
    id: s.id,
    videoId: s.videoId,
    title: s.title,
    artist: s.artist,
    year: s.year ?? null,
    genre: s.genre ?? null,
    alternatives: s.alternatives ?? [],
  }));
  return JSON.stringify(normalized, null, 2);
}

export function importPlaylistJSON(jsonString) {
  let parsed;
  try { parsed = JSON.parse(jsonString); } catch { throw new Error('Fichier JSON invalide.'); }
  if (!Array.isArray(parsed)) throw new Error('Le JSON doit contenir un tableau de chansons.');
  return parsed
    .filter(s => s && typeof s.videoId === 'string' && s.videoId.length > 0)
    .map(s => ({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      videoId: String(s.videoId).trim(),
      title: (s.title || 'Titre inconnu').trim(),
      artist: (s.artist || '?').trim(),
      year: Number.isFinite(Number(s.year)) && Number(s.year) > 0 ? Number(s.year) : null,
      genre: s.genre ? String(s.genre).trim() : null,
      alternatives: Array.isArray(s.alternatives) ? s.alternatives : [],
    }));
}

// ─── Playlists sauvegardées ───────────────────────────────────────────────────

export const BUILTIN_PLAYLISTS = [
  {
    id: 'builtin-intl',
    name: '🌍 International',
    songs: [
      { videoId: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', artist: 'Rick Astley', year: 1987, genre: 'Pop' },
      { videoId: 'hTWKbfoikeg', title: 'Smells Like Teen Spirit', artist: 'Nirvana', year: 1991, genre: 'Rock' },
      { videoId: 'rYEDA3JcQqw', title: 'Rolling in the Deep', artist: 'Adele', year: 2010, genre: 'Pop' },
      { videoId: 'OPf0YbXqDm0', title: 'Uptown Funk', artist: 'Mark Ronson ft. Bruno Mars', year: 2014, genre: 'Funk' },
      { videoId: 'CevxZvSJLk8', title: 'Roar', artist: 'Katy Perry', year: 2013, genre: 'Pop' },
      { videoId: '09R8_2nJtjg', title: 'Sugar', artist: 'Maroon 5', year: 2014, genre: 'Pop' },
      { videoId: 'SlPhMPnQ58k', title: 'Shape of You', artist: 'Ed Sheeran', year: 2017, genre: 'Pop' },
      { videoId: 'kXYiU_JCYtU', title: 'Numb', artist: 'Linkin Park', year: 2003, genre: 'Rock' },
      { videoId: 'qeMFqkcPYcg', title: "Don't Stop Me Now", artist: 'Queen', year: 1978, genre: 'Rock' },
      { videoId: 'fJ9rUzIMcZQ', title: 'Bohemian Rhapsody', artist: 'Queen', year: 1975, genre: 'Rock' },
      { videoId: '_Yhyp-_hX2s', title: 'Happy', artist: 'Pharrell Williams', year: 2013, genre: 'Pop' },
      { videoId: 'UrIiLvg58SY', title: 'Moves Like Jagger', artist: 'Maroon 5', year: 2011, genre: 'Pop' },
      { videoId: 'PT2_F-1esPk', title: 'Umbrella', artist: 'Rihanna', year: 2007, genre: 'Pop' },
      { videoId: '7PCkvCPvDXk', title: 'Titanium', artist: 'David Guetta ft. Sia', year: 2011, genre: 'Electronic' },
      { videoId: 'KUmZp8pR1uc', title: 'Blinding Lights', artist: 'The Weeknd', year: 2019, genre: 'Synth-pop' },
      { videoId: 'H7HmzwI67ec', title: 'Sweet Child O\u2019 Mine', artist: "Guns N' Roses", year: 1987, genre: 'Rock' },
      { videoId: 'FTQbiNvZqaY', title: "I Will Always Love You", artist: 'Whitney Houston', year: 1992, genre: 'Pop' },
      { videoId: 'RBumgq5yVrA', title: 'Somebody That I Used to Know', artist: 'Gotye ft. Kimbra', year: 2011, genre: 'Indie Pop' },
      { videoId: '2Vv-BfVoq4g', title: 'Perfect', artist: 'Ed Sheeran', year: 2017, genre: 'Pop' },
      { videoId: 'YQHsXMglC9A', title: 'Hello', artist: 'Adele', year: 2015, genre: 'Pop' },
    ].map(s => ({ ...s, id: `builtin-intl-${s.videoId}`, alternatives: [] })),
  },
  {
    id: 'builtin-fr',
    name: '🇫🇷 Variétés françaises',
    songs: [
      { videoId: 'NuF-dO90Peg', title: 'La Bohème', artist: 'Charles Aznavour', year: 1965, genre: 'Chanson française' },
      { videoId: 'KId6eABLMsc', title: 'Non, je ne regrette rien', artist: 'Édith Piaf', year: 1960, genre: 'Chanson française' },
      { videoId: 'oBpNiAMgqsI', title: 'Ces soirées-là', artist: 'Yannick', year: 2000, genre: 'Pop' },
      { videoId: 'p43A5NGbDXE', title: 'L\u2019envie d\u2019aimer', artist: 'Les Enfoirés / Daniel Lévi', year: 2001, genre: 'Pop' },
      { videoId: 'UqrXNGmqaE8', title: 'Le Sud', artist: 'Nino Ferrer', year: 1975, genre: 'Chanson française' },
      { videoId: 'sQRcBh6SBkQ', title: 'Bella Vita', artist: 'Keen\u2019V', year: 2012, genre: 'Pop' },
      { videoId: 'xIaPlbZqFAA', title: "Tombé pour elle", artist: 'Francis Cabrel', year: 1987, genre: 'Chanson française' },
      { videoId: '3q73hxSWbWE', title: 'Je l\'aime à mourir', artist: 'Francis Cabrel', year: 1979, genre: 'Chanson française' },
      { videoId: 'nQSD6KbexDo', title: 'Alexandrie Alexandra', artist: 'Claude François', year: 1977, genre: 'Chanson française' },
      { videoId: 'HwZkSiKcJV8', title: 'Les Champs-Élysées', artist: 'Joe Dassin', year: 1969, genre: 'Chanson française' },
      { videoId: '0yAjRRW3JGY', title: 'Comment te dire adieu', artist: 'Françoise Hardy', year: 1968, genre: 'Chanson française' },
      { videoId: 'n3bGDFtPsFw', title: 'Et si tu n\'existais pas', artist: 'Joe Dassin', year: 1975, genre: 'Chanson française' },
      { videoId: 'bEjVVFWoRhM', title: 'Partir un jour', artist: 'Indochine', year: 1987, genre: 'New Wave' },
      { videoId: 'oBWL6eLNmIM', title: 'Lemon Incest', artist: 'Serge Gainsbourg & Charlotte Gainsbourg', year: 1984, genre: 'Chanson française' },
      { videoId: 'VpmTg3NJu1I', title: 'Le Pénitencier', artist: 'Johnny Hallyday', year: 1964, genre: 'Rock' },
      { videoId: 'MrCPMsIrnSQ', title: "L'Aziza", artist: 'Daniel Balavoine', year: 1985, genre: 'Pop' },
      { videoId: 'wMzFHX4HhGg', title: "Il venait d'avoir 18 ans", artist: 'Dalida', year: 1973, genre: 'Chanson française' },
      { videoId: 'nxMl8bOLUps', title: 'Voyage voyage', artist: 'Desireless', year: 1986, genre: 'Synthpop' },
      { videoId: 'ZmVMzLqt08w', title: 'Foule sentimentale', artist: 'Alain Souchon', year: 1993, genre: 'Chanson française' },
      { videoId: 'nRCHzCVMFH8', title: "Quelque chose de Tennessee", artist: 'Johnny Hallyday', year: 1985, genre: 'Rock' },
    ].map(s => ({ ...s, id: `builtin-fr-${s.videoId}`, alternatives: [] })),
  },
];

export function listSavedPlaylists() {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveNamedPlaylist(name, songs) {
  if (!name?.trim()) throw new Error('Nom de playlist invalide.');
  const list = listSavedPlaylists();
  const id = crypto.randomUUID ? crypto.randomUUID() : `pl-${Date.now()}`;
  list.push({ id, name: name.trim(), songs });
  localStorage.setItem(SAVED_KEY, JSON.stringify(list));
  return id;
}

export function loadNamedPlaylist(id) {
  const builtin = BUILTIN_PLAYLISTS.find(p => p.id === id);
  if (builtin) return builtin.songs;
  return listSavedPlaylists().find(p => p.id === id)?.songs ?? null;
}

export function deleteNamedPlaylist(id) {
  const list = listSavedPlaylists().filter(p => p.id !== id);
  localStorage.setItem(SAVED_KEY, JSON.stringify(list));
}

// ─── Filtres par ère ──────────────────────────────────────────────────────────

export const ERAS = [
  { label: '40-50', min: 1940, max: 1959 },
  { label: '60-70', min: 1960, max: 1979 },
  { label: '80-90', min: 1980, max: 1999 },
  { label: '2000-2020', min: 2000, max: 2020 },
];

export function filterByEras(songs, selectedEraLabels) {
  if (!selectedEraLabels || selectedEraLabels.length === 0) return songs;
  const ranges = ERAS.filter(e => selectedEraLabels.includes(e.label));
  return songs.filter(s => {
    if (s.year == null) return false;
    return ranges.some(r => s.year >= r.min && s.year <= r.max);
  });
}
