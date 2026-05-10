/**
 * auth.js – Spotify PKCE Authorization Code Flow
 *
 * Flow:
 *  1. startPKCE(clientId, redirectUri) → redirect user to Spotify login
 *  2. handleCallback()                 → call on page load; exchanges ?code= for tokens
 *  3. getToken()                       → returns a valid access token, auto-refreshes
 *  4. logout()                         → clears all stored credentials
 */

const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-modify-playback-state',
].join(' ');

const LS = {
  clientId:     'djmix_client_id',
  accessToken:  'djmix_access_token',
  refreshToken: 'djmix_refresh_token',
  expiresAt:    'djmix_expires_at',
};
// verifier lives only in sessionStorage (same-tab, discarded on close)
const SS_VERIFIER = 'djmix_pkce_verifier';

export class SpotifyAuth {
  /** The Client ID stored from the last PKCE start. */
  get clientId() { return localStorage.getItem(LS.clientId); }

  /** True when tokens are stored and the session might be reusable. */
  get hasStoredTokens() {
    return !!localStorage.getItem(LS.accessToken);
  }

  // ── Step 1: initiate PKCE login ───────────────────────

  /**
   * Generate a PKCE challenge and redirect to Spotify authorization.
   * @param {string} clientId
   * @param {string} redirectUri  Must be registered in the Spotify app dashboard.
   */
  async startPKCE(clientId, redirectUri) {
    const verifier   = generateVerifier();
    const challenge  = await generateChallenge(verifier);

    localStorage.setItem(LS.clientId, clientId);
    sessionStorage.setItem(SS_VERIFIER, verifier);

    const url = new URL('https://accounts.spotify.com/authorize');
    url.searchParams.set('response_type',          'code');
    url.searchParams.set('client_id',              clientId);
    url.searchParams.set('scope',                  SCOPES);
    url.searchParams.set('redirect_uri',           redirectUri);
    url.searchParams.set('code_challenge_method',  'S256');
    url.searchParams.set('code_challenge',         challenge);

    window.location.href = url.toString();
  }

  // ── Step 2: handle the callback ───────────────────────

  /**
   * Detect ?code= in the URL and exchange it for tokens.
   * Call this once at boot before showing any UI.
   * @returns {boolean} true if a code was successfully exchanged.
   */
  async handleCallback() {
    const params = new URLSearchParams(window.location.search);
    const code   = params.get('code');
    const error  = params.get('error');

    if (!code && !error) return false;

    // Always clean the URL regardless of outcome
    history.replaceState(null, '', window.location.pathname);

    if (error) throw new Error(`Spotify a refusé l'accès : ${error}`);

    const verifier = sessionStorage.getItem(SS_VERIFIER);
    if (!verifier) throw new Error('Code verifier manquant – recommencez la connexion.');

    const clientId    = this.clientId;
    const redirectUri = window.location.origin + window.location.pathname;

    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        redirect_uri:  redirectUri,
        client_id:     clientId,
        code_verifier: verifier,
      }),
    });

    sessionStorage.removeItem(SS_VERIFIER);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error_description ?? `Erreur token: HTTP ${res.status}`);
    }

    this.#storeTokens(await res.json());
    return true;
  }

  // ── Token access (with auto-refresh) ─────────────────

  /**
   * Return a valid access token, refreshing silently if needed.
   * Throws if no session exists or refresh fails.
   * @returns {Promise<string>}
   */
  async getToken() {
    const expiresAt = Number(localStorage.getItem(LS.expiresAt) ?? 0);
    if (Date.now() > expiresAt - 60_000) {
      // Token is expired or expiring within 60 seconds → refresh
      await this.#refresh();
    }
    const token = localStorage.getItem(LS.accessToken);
    if (!token) throw new Error('Aucun token — veuillez vous reconnecter.');
    return token;
  }

  // ── Manual token (no refresh) ─────────────────────────

  /**
   * Store a manually provided access token.
   * Spotify tokens are valid for 1 hour; no refresh_token is available.
   * @param {string} token
   */
  setManualToken(token) {
    localStorage.setItem(LS.accessToken, token);
    localStorage.setItem(LS.expiresAt,   String(Date.now() + 3_600_000));
    localStorage.removeItem(LS.refreshToken);
    // clientId not needed for manual tokens
  }

  // ── Logout ────────────────────────────────────────────

  logout() {
    for (const key of Object.values(LS)) {
      localStorage.removeItem(key);
    }
    sessionStorage.removeItem(SS_VERIFIER);
  }

  // ── Private helpers ───────────────────────────────────

  #storeTokens({ access_token, refresh_token, expires_in }) {
    localStorage.setItem(LS.accessToken, access_token);
    if (refresh_token) {
      localStorage.setItem(LS.refreshToken, refresh_token);
    }
    localStorage.setItem(LS.expiresAt, String(Date.now() + expires_in * 1_000));
  }

  async #refresh() {
    const refreshToken = localStorage.getItem(LS.refreshToken);
    if (!refreshToken) {
      this.logout();
      throw new Error('Session expirée – veuillez vous reconnecter.');
    }

    const clientId = this.clientId;
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'refresh_token',
        refresh_token: refreshToken,
        client_id:     clientId,
      }),
    });

    if (!res.ok) {
      this.logout();
      throw new Error('Session expirée – veuillez vous reconnecter.');
    }

    this.#storeTokens(await res.json());
  }
}

// ── PKCE crypto helpers ───────────────────────────────────

function generateVerifier(length = 128) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (x) => chars[x % chars.length]).join('');
}

async function generateChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  let hashBytes;

  // crypto.subtle is only available in secure contexts (HTTPS / localhost).
  // Fall back to a pure-JS SHA-256 when unavailable (e.g. plain HTTP dev server).
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    hashBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  } else {
    hashBytes = sha256Sync(data);
  }

  return btoa(String.fromCharCode(...hashBytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g,  '');
}

// ── Pure-JS SHA-256 fallback ──────────────────────────────
// Used when crypto.subtle is not available (non-secure HTTP context).

function sha256Sync(data) {
  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

  /* eslint-disable no-multi-spaces */
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  /* eslint-enable no-multi-spaces */

  let h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);

  // Pre-processing: padding
  const len    = data.length;
  const bitLen = len * 8;
  const extra  = len % 64 < 56 ? 56 - (len % 64) : 120 - (len % 64);
  const padded = new Uint8Array(len + extra + 8);
  padded.set(data);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000) >>> 0, false);
  view.setUint32(padded.length - 4, bitLen >>> 0, false);

  const w = new Uint32Array(64);
  for (let i = 0; i < padded.length; i += 64) {
    const chunkView = new DataView(padded.buffer, i, 64);
    for (let j = 0; j < 16; j++) w[j] = chunkView.getUint32(j * 4, false);
    for (let j = 16; j < 64; j++) {
      const s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rotr(w[j -  2], 17) ^ rotr(w[j -  2], 19) ^ (w[j -  2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, hh] = h;
    for (let j = 0; j < 64; j++) {
      const S1    = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch    = (e & f) ^ (~e & g);
      const temp1 = (hh + S1 + ch + K[j] + w[j]) >>> 0;
      const S0    = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj   = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + temp1) >>> 0;
      d  = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }

    h[0] = (h[0] + a)  >>> 0; h[1] = (h[1] + b)  >>> 0;
    h[2] = (h[2] + c)  >>> 0; h[3] = (h[3] + d)  >>> 0;
    h[4] = (h[4] + e)  >>> 0; h[5] = (h[5] + f)  >>> 0;
    h[6] = (h[6] + g)  >>> 0; h[7] = (h[7] + hh) >>> 0;
  }

  const result = new Uint8Array(32);
  const rv     = new DataView(result.buffer);
  h.forEach((v, i) => rv.setUint32(i * 4, v, false));
  return result;
}
