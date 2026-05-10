/**
 * Spotify Web API wrapper – read-only calls used by DJ Mix.
 */
export class SpotifyAPI {
  #token;
  #base = 'https://api.spotify.com/v1';

  constructor(token) {
    this.#token = token;
  }

  async #get(path) {
    const res = await fetch(`${this.#base}${path}`, {
      headers: { Authorization: `Bearer ${this.#token}` },
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
