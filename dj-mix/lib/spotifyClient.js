import { STORAGE_KEYS } from './storageKeys.js';

const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1';
const SPOTIFY_SCOPES = 'playlist-read-private playlist-read-collaborative';
const TOKEN_REFRESH_SKEW_MS = 60_000;

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
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function createCodeChallenge(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
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
    const track = normalizeSpotifyTrack(item?.track);
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
    const challenge = await createCodeChallenge(verifier);
    sessionStorage.setItem('dj-mix:spotify:pkce-verifier', verifier);
    sessionStorage.setItem('dj-mix:spotify:oauth-state', state);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: safeClientId,
      redirect_uri: redirectUri,
      scope: SPOTIFY_SCOPES,
      state,
      code_challenge_method: 'S256',
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
    const res = await fetch(endpoint, {
      headers: { Authorization: 'Bearer ' + token },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.error?.message || `Spotify HTTP ${res.status}`);
    }
    return data;
  }

  async function fetchPlaylistSnapshot(playlistId) {
    return spotifyFetch(`/playlists/${encodeURIComponent(playlistId)}?fields=id,name,snapshot_id`);
  }

  async function fetchPlaylistTracks(playlistId) {
    const allItems = [];
    let nextUrl = `${SPOTIFY_API_BASE_URL}/playlists/${encodeURIComponent(playlistId)}/tracks?fields=items(track(id,uri,name,duration_ms,artists(name),album(images(url)))),next,total&limit=100`;
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

  return {
    clearAuth,
    fetchPlaylistSnapshot,
    fetchPlaylistTracks,
    getStoredClientId,
    isConnected,
    maybeHandleRedirect,
    parseSpotifyPlaylistId,
    startLogin,
  };
}
