/**
 * Spotify Web API wrapper – read-only calls used by DJ Mix.
 */
export class SpotifyAPI {
  #getToken; // async () => string
  #base = 'https://api.spotify.com/v1';

  /**
   * @param {() => Promise<string>} getToken  Async function returning a valid access token.
   */
  constructor(getToken) {
    this.#getToken = getToken;
  }

  async #get(path) {
    const token = await this.#getToken();
    const res = await fetch(`${this.#base}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = body?.error?.message ?? `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return res.json();
  }

  /** Verify token is valid and return the user's profile. */
  async getMe() {
    return this.#get('/me');
  }

  /**
   * Search for tracks on Spotify.
   * @param {string} query
   * @returns {Promise<SpotifyTrack[]>} up to 15 results
   */
  async search(query) {
    const q = encodeURIComponent(query.trim());
    const data = await this.#get(`/search?q=${q}&type=track&limit=15&market=from_token`);
    return data.tracks.items;
  }

  /** Fetch the current user’s playlists (up to 50). */
  async getMyPlaylists() {
    const data = await this.#get('/me/playlists?limit=50');
    return data.items;
  }

  /**
   * Fetch tracks from a playlist (up to 100).
   * @param {string} playlistId
   * @returns {Promise<SpotifyTrack[]>}
   */
  async getPlaylistTracks(playlistId) {
    const data = await this.#get(`/playlists/${encodeURIComponent(playlistId)}/tracks?limit=100&market=from_token`);
    return data.items
      .filter(item => item.track && item.track.type === 'track')
      .map(item => item.track);
  }
}

/**
 * @typedef {Object} SpotifyTrack
 * @property {string}   id
 * @property {string}   uri        – spotify:track:...
 * @property {string}   name
 * @property {number}   duration_ms
 * @property {{ name: string }[]} artists
 * @property {{ images: { url: string }[] }} album
 */
