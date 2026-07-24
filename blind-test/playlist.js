/**
 * playlist.js — Gestion de la playlist de l'hôte
 *
 * Stockage : localStorage['blind-test-playlist'] = JSON.stringify(Song[])
 * Song : { id, title, artist, year: number|null, genre: string|null, alternatives: [], cachePath?, artUrl? }
 *
 * L'audio et les métadonnées passent par les mêmes mécaniques que dj-mix
 * (recherche/téléchargement via le serveur downloader local, voir
 * `./audioSource.js`) — il n'y a plus de `videoId` YouTube stocké sur un
 * morceau. L'import de playlist YouTube (scraping, ci-dessous) reste
 * disponible pour peupler rapidement une liste de titres/artistes, mais le
 * `videoId` scrappé est jeté dès que le morceau est enrichi.
 */

import { searchTracks } from './audioSource.js';

const STORAGE_KEY = 'blind-test-playlist';
const SAVED_KEY   = 'blind-test-saved-playlists';

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

export function addSong(songs, { title, artist, year, genre, alternatives, cachePath, artUrl }) {
  const cleanTitle = (title || '').trim();
  if (!cleanTitle) throw new Error('Titre de chanson requis');

  const song = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    title: cleanTitle,
    artist: (artist || '?').trim(),
    year: year ?? null,
    genre: genre ?? null,
    alternatives: alternatives || [],
    cachePath: cachePath || '',
    artUrl: artUrl || '',
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
//
// Scraping pur (aucun serveur requis) pour peupler rapidement une liste de
// candidats {videoId, title, artist} à partir d'une URL de playlist YouTube.
// Le videoId n'est utilisé que pendant le scraping/l'enrichissement ci-dessous
// et n'est jamais persisté sur un morceau de la playlist finale.

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

function decodeJsStringLiteral(source) {
  let result = '';
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch !== '\\') {
      result += ch;
      continue;
    }

    const next = source[++i];
    if (next === undefined) break;
    switch (next) {
      case '\\': result += '\\'; break;
      case "'": result += "'"; break;
      case '"': result += '"'; break;
      case 'n': result += '\n'; break;
      case 'r': result += '\r'; break;
      case 't': result += '\t'; break;
      case 'b': result += '\b'; break;
      case 'f': result += '\f'; break;
      case 'v': result += '\v'; break;
      case '0': result += '\0'; break;
      case 'x': {
        const hex = source.slice(i + 1, i + 3);
        if (/^[0-9a-fA-F]{2}$/.test(hex)) {
          result += String.fromCharCode(parseInt(hex, 16));
          i += 2;
        } else {
          result += 'x';
        }
        break;
      }
      case 'u': {
        const hex = source.slice(i + 1, i + 5);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          result += String.fromCharCode(parseInt(hex, 16));
          i += 4;
        } else {
          result += 'u';
        }
        break;
      }
      default:
        result += next;
        break;
    }
  }
  return result;
}

function findScriptEnd(html, startIndex) {
  const scriptEnd = html.indexOf('</script>', startIndex);
  return scriptEnd === -1 ? html.length : scriptEnd;
}

function findImmediateValueStart(html, startIndex, endIndex) {
  let i = startIndex;
  while (i < endIndex && /\s/.test(html[i])) i++;
  return i < endIndex ? i : -1;
}

function readQuotedLiteral(html, startIndex, endIndex = html.length) {
  const quote = html[startIndex];
  if (quote !== "'" && quote !== '"') return null;

  let literal = '';
  let escaping = false;
  for (let i = startIndex + 1; i < endIndex; i++) {
    const ch = html[i];
    if (escaping) {
      literal += '\\' + ch;
      escaping = false;
      continue;
    }
    if (ch === '\\') {
      escaping = true;
      continue;
    }
    if (ch === quote) {
      return { literal, endIndex: i + 1 };
    }
    literal += ch;
  }

  return null;
}

function extractConcatenatedStringLiteral(html, startIndex, endIndex = html.length) {
  let cursor = findImmediateValueStart(html, startIndex, endIndex);
  if (cursor === -1) return null;

  let combined = '';
  let partCount = 0;
  while (cursor < endIndex) {
    const part = readQuotedLiteral(html, cursor, endIndex);
    if (!part) break;

    combined += decodeJsStringLiteral(part.literal);
    partCount++;
    cursor = findImmediateValueStart(html, part.endIndex, endIndex);
    if (cursor === -1 || html[cursor] !== '+') break;
    cursor = findImmediateValueStart(html, cursor + 1, endIndex);
    if (cursor === -1) break;
  }

  if (!partCount) return null;
  const trimmed = combined.trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[') ? trimmed : null;
}

function extractJsonParseLiteral(html, startIndex, endIndex = html.length) {
  const parseIndex = findImmediateValueStart(html, startIndex, endIndex);
  if (parseIndex === -1 || !html.startsWith('JSON.parse(', parseIndex)) return null;

  let i = parseIndex + 'JSON.parse('.length;
  return extractConcatenatedStringLiteral(html, i, endIndex);
}

function extractQuotedJsonLiteral(html, startIndex, endIndex = html.length) {
  return extractConcatenatedStringLiteral(html, startIndex, endIndex);
}

function extractJsonObjectLiteral(html, startIndex, endIndex = html.length) {
  const objectStart = findImmediateValueStart(html, startIndex, endIndex);
  if (objectStart === -1 || html[objectStart] !== '{') return null;

  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let i = objectStart; i < endIndex; i++) {
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

  return null;
}

function compactPreview(text, maxLength = 140) {
  return (text || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function describeYtInitialDataIssue(html, markers) {
  for (const marker of markers) {
    const markerIndex = html.indexOf(marker);
    if (markerIndex === -1) continue;

    const scriptEnd = findScriptEnd(html, markerIndex);
    const valueStart = findImmediateValueStart(html, markerIndex + marker.length, scriptEnd);
    const preview = compactPreview(html.slice(markerIndex, markerIndex + 180));

    if (valueStart !== -1 && html.startsWith('JSON.parse(', valueStart)) {
      return `marqueur trouvé (${marker.trim()}) avec JSON.parse, mais la chaîne n'a pas pu être extraite. Extrait: ${preview}`;
    }
    if (valueStart !== -1 && (html[valueStart] === "'" || html[valueStart] === '"')) {
      return `marqueur trouvé (${marker.trim()}) avec une chaîne JavaScript encodée, potentiellement concaténée, mais son contenu JSON n'a pas pu être décodé. Extrait: ${preview}`;
    }
    if (valueStart !== -1 && html[valueStart] === '{') {
      return `marqueur trouvé (${marker.trim()}) avec un objet JSON, mais l'objet semble incomplet. Extrait: ${preview}`;
    }
    const tokenPreview = valueStart === -1 ? 'fin de script' : compactPreview(html.slice(valueStart, valueStart + 60), 60);
    return `marqueur trouvé (${marker.trim()}), mais la valeur suivante n'est pas un JSON exploitable. Début détecté: ${tokenPreview}`;
  }

  const looseIndex = html.indexOf('ytInitialData');
  if (looseIndex !== -1) {
    return `référence à ytInitialData détectée sans affectation reconnue. Extrait: ${compactPreview(html.slice(looseIndex, looseIndex + 180))}`;
  }

  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch?.[1]) {
    return `aucun marqueur ytInitialData trouvé. Titre reçu: ${compactPreview(titleMatch[1], 100)}`;
  }

  return 'aucun marqueur ytInitialData trouvé dans la réponse HTML';
}

function extractAssignedJson(html, markers) {
  for (const marker of markers) {
    const markerIndex = html.indexOf(marker);
    if (markerIndex === -1) continue;

    const scriptEnd = findScriptEnd(html, markerIndex);

    const jsonParseLiteral = extractJsonParseLiteral(html, markerIndex + marker.length, scriptEnd);
    if (jsonParseLiteral) return jsonParseLiteral;

    const quotedJsonLiteral = extractQuotedJsonLiteral(html, markerIndex + marker.length, scriptEnd);
    if (quotedJsonLiteral) return quotedJsonLiteral;

    const objectLiteral = extractJsonObjectLiteral(html, markerIndex + marker.length, scriptEnd);
    if (objectLiteral) return objectLiteral;
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

  const ytInitialDataMarkers = [
    'var ytInitialData = ',
    'var ytInitialData=',
    'window["ytInitialData"] = ',
    'window["ytInitialData"]=',
    'ytInitialData = ',
    'ytInitialData=',
  ];
  const rawJson = extractAssignedJson(html, ytInitialDataMarkers);
  if (!rawJson) {
    throw new Error(`Impossible de parser ytInitialData: ${describeYtInitialDataIssue(html, ytInitialDataMarkers)}`);
  }

  let data;
  try { data = JSON.parse(rawJson); }
  catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Erreur de parsing ytInitialData: ${reason}. Extrait JSON: ${compactPreview(rawJson, 180)}`);
  }

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

/** Clé d'identité d'un morceau (déduplication) : titre+artiste normalisés — plus de videoId. */
function songIdentityKey(song) {
  const title = String(song?.title || '').trim().toLowerCase();
  const artist = String(song?.artist || '').trim().toLowerCase();
  return `${title}::${artist}`;
}

/**
 * Ajoute les chansons importées dans la playlist existante (déduplique par titre+artiste).
 */
export function mergeSongs(existing, imported) {
  const existingKeys = new Set(existing.map(songIdentityKey));
  const news = imported
    .filter(s => !existingKeys.has(songIdentityKey(s)))
    .map(s => ({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      title: s.title,
      artist: s.artist,
      year: s.year ?? null,
      genre: s.genre ?? null,
      alternatives: s.alternatives || [],
      cachePath: s.cachePath || '',
      artUrl: s.artUrl || '',
    }));
  const updated = [...existing, ...news];
  savePlaylist(updated);
  return { updated, added: news.length, skipped: imported.length - news.length };
}

// ─── Enrichissement via la recherche du serveur downloader (mêmes mécaniques que dj-mix) ─

/**
 * Cherche les métadonnées canoniques d'un morceau via `/api/search` (iTunes/Deezer,
 * côté serveur downloader local — voir audioSource.js). Retourne le meilleur résultat
 * ou null si la recherche échoue/l'API est hors ligne.
 * @param {string} title
 * @param {string} [artist]
 * @returns {Promise<{title, artist, year, genre, artUrl, cachePath}|null>}
 */
export async function lookupSongMetadata(title, artist) {
  const query = artist && artist !== '?' ? `${artist} ${title}` : title;
  const results = await searchTracks(query, { limit: 5 }).catch(() => []);
  return results[0] ?? null;
}

/**
 * Récupère jusqu'à 3 autres chansons du même artiste via la recherche du serveur,
 * en excluant le titre de la chanson elle-même.
 * @param {string} artist
 * @param {string} excludeTitle
 * @returns {Promise<Array<{title: string, artist: string}>>}
 */
export async function fetchArtistAlternatives(artist, excludeTitle) {
  if (!artist || artist === '?') return [];
  const results = await searchTracks(artist, { limit: 10 }).catch(() => []);
  const excl = String(excludeTitle || '').toLowerCase();
  return results
    .filter(r => r.title.toLowerCase() !== excl)
    .slice(0, 3)
    .map(r => ({ title: r.title, artist: r.artist }));
}

/**
 * Enrichit une liste de chansons {videoId, title, artist} (issues du scraping YouTube)
 * avec les métadonnées de la recherche serveur (par lots de 5). Le videoId est jeté :
 * il ne sert qu'au scraping, jamais stocké sur le morceau final.
 * @param {Array<{videoId, title, artist}>} songs
 * @param {Function} [onProgress] — callback(current, total)
 * @returns {Promise<Array<{title, artist, year, genre, artUrl, alternatives}>>}
 */
export async function enrichWithMusicMetadata(songs, onProgress) {
  const BATCH = 5;
  const results = [...songs];
  let completed = 0;

  for (let i = 0; i < songs.length; i += BATCH) {
    const batch = songs.slice(i, i + BATCH);
    const enriched = await Promise.all(
      batch.map(async s => {
        const meta = await lookupSongMetadata(s.title, s.artist).catch(() => null);
        const resolvedTitle = meta?.title || s.title;
        const resolvedArtist = meta?.artist || s.artist;
        const alternatives = await fetchArtistAlternatives(resolvedArtist, resolvedTitle).catch(() => []);
        return {
          title: resolvedTitle,
          artist: resolvedArtist,
          year: meta?.year ?? s.year ?? null,
          genre: meta?.genre ?? s.genre ?? null,
          artUrl: meta?.artUrl || '',
          alternatives,
        };
      })
    );
    for (let j = 0; j < batch.length; j++) {
      const { videoId: _discard, ...rest } = { ...songs[i + j], ...enriched[j] };
      results[i + j] = rest;
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
//
// Le format volontairement PAS de cachePath/artUrl : ces champs sont propres
// au serveur downloader d'un hôte donné. Une playlist exportée/importée est
// systématiquement ré-résolue (recherche + téléchargement paresseux) sur le
// serveur de l'hôte qui l'importe.

export function exportPlaylistJSON(songs) {
  const normalized = songs.map(s => ({
    id: s.id,
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
    .filter(s => s && typeof s.title === 'string' && s.title.trim().length > 0)
    .map(s => ({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      title: String(s.title).trim(),
      artist: (s.artist || '?').toString().trim(),
      year: Number.isFinite(Number(s.year)) && Number(s.year) > 0 ? Number(s.year) : null,
      genre: s.genre ? String(s.genre).trim() : null,
      alternatives: Array.isArray(s.alternatives) ? s.alternatives : [],
      cachePath: '',
      artUrl: '',
    }));
}

// ─── Playlists sauvegardées ───────────────────────────────────────────────────

export const BUILTIN_PLAYLISTS = [
  {
    id: 'builtin-intl',
    name: '🌍 International',
    songs: [
      { title: 'Never Gonna Give You Up', artist: 'Rick Astley', year: 1987, genre: 'Pop' },
      { title: 'Smells Like Teen Spirit', artist: 'Nirvana', year: 1991, genre: 'Rock' },
      { title: 'Rolling in the Deep', artist: 'Adele', year: 2010, genre: 'Pop' },
      { title: 'Uptown Funk', artist: 'Mark Ronson ft. Bruno Mars', year: 2014, genre: 'Funk' },
      { title: 'Roar', artist: 'Katy Perry', year: 2013, genre: 'Pop' },
      { title: 'Sugar', artist: 'Maroon 5', year: 2014, genre: 'Pop' },
      { title: 'Shape of You', artist: 'Ed Sheeran', year: 2017, genre: 'Pop' },
      { title: 'Numb', artist: 'Linkin Park', year: 2003, genre: 'Rock' },
      { title: "Don't Stop Me Now", artist: 'Queen', year: 1978, genre: 'Rock' },
      { title: 'Bohemian Rhapsody', artist: 'Queen', year: 1975, genre: 'Rock' },
      { title: 'Happy', artist: 'Pharrell Williams', year: 2013, genre: 'Pop' },
      { title: 'Moves Like Jagger', artist: 'Maroon 5', year: 2011, genre: 'Pop' },
      { title: 'Umbrella', artist: 'Rihanna', year: 2007, genre: 'Pop' },
      { title: 'Titanium', artist: 'David Guetta ft. Sia', year: 2011, genre: 'Electronic' },
      { title: 'Blinding Lights', artist: 'The Weeknd', year: 2019, genre: 'Synth-pop' },
      { title: 'Sweet Child O’ Mine', artist: "Guns N' Roses", year: 1987, genre: 'Rock' },
      { title: "I Will Always Love You", artist: 'Whitney Houston', year: 1992, genre: 'Pop' },
      { title: 'Somebody That I Used to Know', artist: 'Gotye ft. Kimbra', year: 2011, genre: 'Indie Pop' },
      { title: 'Perfect', artist: 'Ed Sheeran', year: 2017, genre: 'Pop' },
      { title: 'Hello', artist: 'Adele', year: 2015, genre: 'Pop' },
    ].map((s, i) => ({ ...s, id: `builtin-intl-${i}`, alternatives: [], cachePath: '', artUrl: '' })),
  },
  {
    id: 'builtin-fr',
    name: '🇫🇷 Variétés françaises',
    songs: [
      { title: 'La Bohème', artist: 'Charles Aznavour', year: 1965, genre: 'Chanson française' },
      { title: 'Non, je ne regrette rien', artist: 'Édith Piaf', year: 1960, genre: 'Chanson française' },
      { title: 'Ces soirées-là', artist: 'Yannick', year: 2000, genre: 'Pop' },
      { title: 'L’envie d’aimer', artist: 'Les Enfoirés / Daniel Lévi', year: 2001, genre: 'Pop' },
      { title: 'Le Sud', artist: 'Nino Ferrer', year: 1975, genre: 'Chanson française' },
      { title: 'Bella Vita', artist: 'Keen’V', year: 2012, genre: 'Pop' },
      { title: "Tombé pour elle", artist: 'Francis Cabrel', year: 1987, genre: 'Chanson française' },
      { title: 'Je l\'aime à mourir', artist: 'Francis Cabrel', year: 1979, genre: 'Chanson française' },
      { title: 'Alexandrie Alexandra', artist: 'Claude François', year: 1977, genre: 'Chanson française' },
      { title: 'Les Champs-Élysées', artist: 'Joe Dassin', year: 1969, genre: 'Chanson française' },
      { title: 'Comment te dire adieu', artist: 'Françoise Hardy', year: 1968, genre: 'Chanson française' },
      { title: 'Et si tu n\'existais pas', artist: 'Joe Dassin', year: 1975, genre: 'Chanson française' },
      { title: 'Partir un jour', artist: 'Indochine', year: 1987, genre: 'New Wave' },
      { title: 'Lemon Incest', artist: 'Serge Gainsbourg & Charlotte Gainsbourg', year: 1984, genre: 'Chanson française' },
      { title: 'Le Pénitencier', artist: 'Johnny Hallyday', year: 1964, genre: 'Rock' },
      { title: "L'Aziza", artist: 'Daniel Balavoine', year: 1985, genre: 'Pop' },
      { title: "Il venait d'avoir 18 ans", artist: 'Dalida', year: 1973, genre: 'Chanson française' },
      { title: 'Voyage voyage', artist: 'Desireless', year: 1986, genre: 'Synthpop' },
      { title: 'Foule sentimentale', artist: 'Alain Souchon', year: 1993, genre: 'Chanson française' },
      { title: "Quelque chose de Tennessee", artist: 'Johnny Hallyday', year: 1985, genre: 'Rock' },
    ].map((s, i) => ({ ...s, id: `builtin-fr-${i}`, alternatives: [], cachePath: '', artUrl: '' })),
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
