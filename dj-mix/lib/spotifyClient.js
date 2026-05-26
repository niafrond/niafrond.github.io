import { STORAGE_KEYS } from './storageKeys.js';

const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1';
const SPOTIFY_SCOPES = 'playlist-read-private playlist-read-collaborative';
const TOKEN_REFRESH_SKEW_MS = 60_000;
const SPOTIFY_PLAYLIST_HISTORY_MAX = 20;
const SPOTIFY_FETCH_MAX_RETRIES = 2;
const SPOTIFY_FETCH_BASE_BACKOFF_MS = 1000;
const SPOTIFY_FETCH_MAX_BACKOFF_MS = 30000;

function safeSetStorage(key, value) {
  try {
    if (value == null) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, value);
  } catch (_) {
    // ignore storage failures
  }
}

function safeGetStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}

function base64UrlEncode(bytes) {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function createRandomBase64Url(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  if (typeof globalThis?.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return base64UrlEncode(bytes);
}

function utf8Encode(input) {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(String(input || ''));
  }
  const ascii = unescape(encodeURIComponent(String(input || '')));
  const out = new Uint8Array(ascii.length);
  for (let i = 0; i < ascii.length; i++) out[i] = ascii.charCodeAt(i);
  return out;
}

function rightRotate(value, amount) {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256Bytes(messageBytes) {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const H = [
    0x6a09e667,
    0xbb67ae85,
    0x3c6ef372,
    0xa54ff53a,
    0x510e527f,
    0x9b05688c,
    0x1f83d9ab,
    0x5be0cd19,
  ];

  const bitLength = messageBytes.length * 8;
  const paddedLength = (((messageBytes.length + 9 + 63) >> 6) << 6);
  const padded = new Uint8Array(paddedLength);
  padded.set(messageBytes, 0);
  padded[messageBytes.length] = 0x80;

  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  padded[paddedLength - 8] = (high >>> 24) & 0xff;
  padded[paddedLength - 7] = (high >>> 16) & 0xff;
  padded[paddedLength - 6] = (high >>> 8) & 0xff;
  padded[paddedLength - 5] = high & 0xff;
  padded[paddedLength - 4] = (low >>> 24) & 0xff;
  padded[paddedLength - 3] = (low >>> 16) & 0xff;
  padded[paddedLength - 2] = (low >>> 8) & 0xff;
  padded[paddedLength - 1] = low & 0xff;

  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const j = offset + i * 4;
      w[i] = ((padded[j] << 24) | (padded[j + 1] << 16) | (padded[j + 2] << 8) | padded[j + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = H[0];
    let b = H[1];
    let c = H[2];
    let d = H[3];
    let e = H[4];
    let f = H[5];
    let g = H[6];
    let h = H[7];

    for (let i = 0; i < 64; i++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  const out = new Uint8Array(32);
  for (let i = 0; i < H.length; i++) {
    out[i * 4] = (H[i] >>> 24) & 0xff;
    out[i * 4 + 1] = (H[i] >>> 16) & 0xff;
    out[i * 4 + 2] = (H[i] >>> 8) & 0xff;
    out[i * 4 + 3] = H[i] & 0xff;
  }
  return out;
}

async function createCodeChallengeData(verifier) {
  if (typeof globalThis?.crypto?.subtle?.digest === 'function') {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', utf8Encode(verifier));
    return {
      method: 'S256',
      challenge: base64UrlEncode(new Uint8Array(digest)),
    };
  }

  const digestBytes = sha256Bytes(utf8Encode(verifier));
  return {
    method: 'S256',
    challenge: base64UrlEncode(digestBytes),
  };
}

export function parseSpotifyPlaylistId(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';

  const direct = raw.match(/^[A-Za-z0-9]{22}$/);
  if (direct) return direct[0];

  const uri = raw.match(/^spotify:playlist:([A-Za-z0-9]{22})$/i);
  if (uri) return uri[1];

  try {
    const url = new URL(raw);
    const parts = url.pathname.split('/').filter(Boolean);
    const playlistIdx = parts.findIndex((part) => part.toLowerCase() === 'playlist');
    if (playlistIdx >= 0 && parts[playlistIdx + 1]) {
      const id = parts[playlistIdx + 1].trim();
      return /^[A-Za-z0-9]{22}$/.test(id) ? id : '';
    }
  } catch (_) {
    // ignore invalid URL
  }

  return '';
}

function normalizeSpotifyTrack(track) {
  if (!track || !track.id || !track.name) return null;
  const artists = Array.isArray(track.artists)
    ? track.artists.map((artist) => artist?.name).filter(Boolean).join(', ')
    : '';
  const images = track.album?.images;
  const artUrl = Array.isArray(images) && images.length ? String(images[0]?.url || '') : '';
  return {
    id: `spotify:${track.id}`,
    spotifyTrackId: track.id,
    spotifyUri: track.uri || '',
    name: track.name,
    artist: artists || 'Artiste inconnu',
    artUrl,
    duration: Number(track.duration_ms) || 0,
    bpm: null,
    genre: '',
    cachePath: '',
    persistedSourceUrl: '',
    ratingKey: '',
    stemsStatus: '',
    stems: null,
    source: 'spotify',
  };
}

export function normalizeSpotifyPlaylistTracks(items) {
  const normalized = [];
  const seen = new Set();
  for (const item of Array.isArray(items) ? items : []) {
    const rawItem = item?.item || item?.track;
    if (!rawItem) continue;
    if (rawItem?.type && String(rawItem.type).toLowerCase() !== 'track') continue;
    if (item?.is_local === true) continue;
    const track = normalizeSpotifyTrack(rawItem);
    if (!track || seen.has(track.id)) continue;
    seen.add(track.id);
    normalized.push(track);
  }
  return normalized;
}

function computePlaylistFingerprint(tracks) {
  return (Array.isArray(tracks) ? tracks : [])
    .map((track) => `${track.id || ''}:${track.name || ''}:${track.artist || ''}:${track.duration || 0}`)
    .join('|');
}

function readAuth() {
  try {
    const raw = safeGetStorage(STORAGE_KEYS.spotifyAuth);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function writeAuth(auth) {
  safeSetStorage(STORAGE_KEYS.spotifyAuth, auth ? JSON.stringify(auth) : null);
}

function readPlaylistHistory() {
  try {
    const raw = safeGetStorage(STORAGE_KEYS.spotifyPlaylistHistory);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => {
        const playlistId = String(entry?.playlistId || '').trim();
        if (!playlistId) return null;
        return {
          playlistId,
          playlistName: String(entry?.playlistName || '').trim(),
          updatedAt: Number(entry?.updatedAt) || 0,
        };
      })
      .filter(Boolean)
      .slice(0, SPOTIFY_PLAYLIST_HISTORY_MAX);
  } catch (_) {
    return [];
  }
}

function writePlaylistHistory(history) {
  const clean = (Array.isArray(history) ? history : []).slice(0, SPOTIFY_PLAYLIST_HISTORY_MAX);
  safeSetStorage(STORAGE_KEYS.spotifyPlaylistHistory, clean.length ? JSON.stringify(clean) : null);
}

function parseRetryAfterMs(value) {
  const raw = String(value || '').trim();
  if (!raw) return 0;

  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }

  const asDate = Date.parse(raw);
  if (Number.isFinite(asDate)) {
    return Math.max(0, asDate - Date.now());
  }

  return 0;
}

function waitMs(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, Number(ms) || 0));
  });
}

function computeRetryDelayMs(attempt, retryAfterMs = 0) {
  const jitterMs = Math.floor(Math.random() * 250);
  if (retryAfterMs > 0) {
    return Math.min(retryAfterMs + jitterMs, SPOTIFY_FETCH_MAX_BACKOFF_MS);
  }
  const exponential = SPOTIFY_FETCH_BASE_BACKOFF_MS * (2 ** Math.max(0, attempt));
  return Math.min(exponential + jitterMs, SPOTIFY_FETCH_MAX_BACKOFF_MS);
}

export function createSpotifyClient(options = {}) {
  const {
    redirectUri = window.location.origin + window.location.pathname,
  } = options;

  async function startLogin(clientId) {
    const safeClientId = String(clientId || '').trim();
    if (!safeClientId) throw new Error('Client ID Spotify manquant');
    safeSetStorage(STORAGE_KEYS.spotifyClientId, safeClientId);

    const verifier = createRandomBase64Url(64);
    const state = createRandomBase64Url(16);
    const { method, challenge } = await createCodeChallengeData(verifier);
    sessionStorage.setItem('dj-mix:spotify:pkce-verifier', verifier);
    sessionStorage.setItem('dj-mix:spotify:oauth-state', state);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: safeClientId,
      redirect_uri: redirectUri,
      scope: SPOTIFY_SCOPES,
      state,
      code_challenge_method: method,
      code_challenge: challenge,
    });

    window.location.assign(`${SPOTIFY_AUTHORIZE_URL}?${params.toString()}`);
  }

  async function exchangeCode(code, expectedState) {
    const verifier = sessionStorage.getItem('dj-mix:spotify:pkce-verifier');
    if (!verifier) throw new Error('Session OAuth expirée, reconnectez Spotify');

    const clientId = String(safeGetStorage(STORAGE_KEYS.spotifyClientId) || '').trim();
    if (!clientId) throw new Error('Client ID Spotify manquant');

    const payload = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: verifier,
    });

    const res = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.access_token) {
      throw new Error(data?.error_description || 'Connexion Spotify refusée');
    }

    const expiresInSec = Number(data.expires_in) || 3600;
    writeAuth({
      accessToken: data.access_token,
      refreshToken: data.refresh_token || '',
      expiresAt: Date.now() + expiresInSec * 1000,
      tokenType: data.token_type || 'Bearer',
      scope: data.scope || '',
      state: expectedState || '',
    });
  }

  async function maybeHandleRedirect() {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    if (!code && !error) return { handled: false };

    const expectedState = sessionStorage.getItem('dj-mix:spotify:oauth-state');
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    url.searchParams.delete('error');
    history.replaceState({}, '', url.toString());

    if (error) {
      throw new Error(`Spotify: ${error}`);
    }
    if (!state || !expectedState || state !== expectedState) {
      throw new Error('État OAuth Spotify invalide');
    }

    try {
      await exchangeCode(code, expectedState);
      return { handled: true };
    } finally {
      sessionStorage.removeItem('dj-mix:spotify:oauth-state');
      sessionStorage.removeItem('dj-mix:spotify:pkce-verifier');
    }
  }

  async function refreshAccessToken(auth) {
    if (!auth?.refreshToken) return null;
    const clientId = String(safeGetStorage(STORAGE_KEYS.spotifyClientId) || '').trim();
    if (!clientId) return null;

    const payload = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: auth.refreshToken,
      client_id: clientId,
    });

    const res = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.access_token) return null;

    const expiresInSec = Number(data.expires_in) || 3600;
    const refreshed = {
      ...auth,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || auth.refreshToken,
      expiresAt: Date.now() + expiresInSec * 1000,
      tokenType: data.token_type || auth.tokenType || 'Bearer',
      scope: data.scope || auth.scope || '',
    };
    writeAuth(refreshed);
    return refreshed;
  }

  async function getAccessToken() {
    let auth = readAuth();
    if (!auth?.accessToken) return '';
    if ((Number(auth.expiresAt) || 0) - TOKEN_REFRESH_SKEW_MS <= Date.now()) {
      auth = await refreshAccessToken(auth);
    }
    return auth?.accessToken || '';
  }

  async function spotifyFetch(pathOrUrl) {
    const token = await getAccessToken();
    if (!token) throw new Error('Spotify non connecté');
    const endpoint = /^https?:\/\//i.test(pathOrUrl)
      ? pathOrUrl
      : `${SPOTIFY_API_BASE_URL}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
    for (let attempt = 0; attempt <= SPOTIFY_FETCH_MAX_RETRIES; attempt++) {
      let res;
      try {
        res = await fetch(endpoint, {
          headers: { Authorization: 'Bearer ' + token },
        });
      } catch (networkErr) {
        const canRetryNetwork = attempt < SPOTIFY_FETCH_MAX_RETRIES;
        if (canRetryNetwork) {
          await waitMs(computeRetryDelayMs(attempt));
          continue;
        }
        throw networkErr;
      }

      const data = await res.json().catch(() => null);
      if (res.ok) {
        return data;
      }

      const retryAfterMs = parseRetryAfterMs(res.headers.get('Retry-After'));
      const shouldRetry = res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504;
      const canRetry = shouldRetry && attempt < SPOTIFY_FETCH_MAX_RETRIES;
      if (canRetry) {
        await waitMs(computeRetryDelayMs(attempt, retryAfterMs));
        continue;
      }

      const err = new Error(data?.error?.message || `Spotify HTTP ${res.status}`);
      err.status = res.status;
      err.retryAfterMs = retryAfterMs;
      throw err;
    }

    throw new Error('Spotify request failed unexpectedly');
  }

  async function fetchPlaylistSnapshot(playlistId) {
    return spotifyFetch(`/playlists/${encodeURIComponent(playlistId)}?fields=id,name,snapshot_id`);
  }

  async function fetchUserPlaylists() {
    const playlists = [];
    const seen = new Set();
    let nextUrl = `${SPOTIFY_API_BASE_URL}/me/playlists?fields=items(id,name),next&limit=50`;
    while (nextUrl) {
      const data = await spotifyFetch(nextUrl);
      const items = Array.isArray(data?.items) ? data.items : [];
      for (const item of items) {
        const playlistId = String(item?.id || '').trim();
        if (!playlistId || seen.has(playlistId)) continue;
        seen.add(playlistId);
        playlists.push({
          playlistId,
          playlistName: String(item?.name || '').trim(),
        });
      }
      nextUrl = String(data?.next || '').trim();
    }
    return playlists;
  }

  async function fetchPlaylistTracks(playlistId) {
    const allItems = [];
    const fields = 'items(is_local,item(type,id,uri,name,duration_ms,artists(name),album(images(url))),track(type,id,uri,name,duration_ms,artists(name),album(images(url)))),next,total';
    let nextUrl = `${SPOTIFY_API_BASE_URL}/playlists/${encodeURIComponent(playlistId)}/items?fields=${encodeURIComponent(fields)}&limit=100&additional_types=track,episode`;
    while (nextUrl) {
      const data = await spotifyFetch(nextUrl);
      const items = Array.isArray(data?.items) ? data.items : [];
      allItems.push(...items);
      nextUrl = data?.next || '';
    }
    const tracks = normalizeSpotifyPlaylistTracks(allItems);
    return {
      tracks,
      fingerprint: computePlaylistFingerprint(tracks),
    };
  }

  function clearAuth() {
    writeAuth(null);
    safeSetStorage(STORAGE_KEYS.spotifyFilRougeSource, null);
  }

  function isConnected() {
    const auth = readAuth();
    return Boolean(auth?.accessToken);
  }

  function getStoredClientId() {
    return String(safeGetStorage(STORAGE_KEYS.spotifyClientId) || '').trim();
  }

  function rememberPlaylist(playlistId, playlistName = '') {
    const safeId = String(playlistId || '').trim();
    if (!safeId) return;
    const safeName = String(playlistName || '').trim();
    const now = Date.now();
    const current = readPlaylistHistory();
    const existing = current.find((entry) => entry.playlistId === safeId);
    const nextEntry = {
      playlistId: safeId,
      playlistName: safeName || existing?.playlistName || '',
      updatedAt: now,
    };
    const next = [
      nextEntry,
      ...current.filter((entry) => entry.playlistId !== safeId),
    ].slice(0, SPOTIFY_PLAYLIST_HISTORY_MAX);
    writePlaylistHistory(next);
  }

  function getRememberedPlaylists() {
    return readPlaylistHistory();
  }

  return {
    clearAuth,
    fetchUserPlaylists,
    fetchPlaylistSnapshot,
    fetchPlaylistTracks,
    getRememberedPlaylists,
    getStoredClientId,
    isConnected,
    maybeHandleRedirect,
    parseSpotifyPlaylistId,
    rememberPlaylist,
    startLogin,
  };
}
