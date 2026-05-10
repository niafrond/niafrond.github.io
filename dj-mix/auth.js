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
  const data   = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g,  '');
}
