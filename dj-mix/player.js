/**
 * DJPlayer – manages two Spotify Web Playback SDK instances (Deck A & B)
 * to enable true simultaneous crossfading between tracks.
 *
 * Events emitted (via EventTarget):
 *   'ready'           – both decks initialised
 *   'progress'        – { position, duration, remaining } (every ~300 ms)
 *   'statechange'     – { track, paused } when active deck state changes
 *   'crossfadeready'  – fired when remaining time ≤ crossfade duration
 *   'trackend'        – fired when current track finishes with no crossfade pending
 *   'error'           – { message }
 */
export class DJPlayer extends EventTarget {
  // Private fields
  #getToken; // async () => string
  #playerA = null;
  #playerB = null;
  #deviceA = null;
  #deviceB = null;
  #active = 'A';           // which deck is the "current" one
  #crossfadeDuration = 5000; // ms
  #isCrossfading = false;
  #crossfadeNotified = false; // guard: only fire crossfadeready once per track
  #trackInterval = null;
  #currentTrackUri = null;
  #ready = false;

  /**
   * @param {() => Promise<string>} getToken  Async function returning a valid access token.
   */
  constructor(getToken) {
    super();
    this.#getToken = getToken;
  }

  // ── Public getters / setters ─────────────────────────

  get crossfadeDuration() { return this.#crossfadeDuration; }
  set crossfadeDuration(ms) {
    this.#crossfadeDuration = ms;
    this.#crossfadeNotified = false; // allow re-trigger with new duration
  }

  get isCrossfading() { return this.#isCrossfading; }
  get isReady() { return this.#ready; }

  // ── Initialisation ────────────────────────────────────

  async init() {
    await window.spotifySDKReady;

    const [a, b] = await Promise.all([
      this.#createDeck('DJ Mix – Deck A'),
      this.#createDeck('DJ Mix – Deck B'),
    ]);

    this.#playerA = a.player;
    this.#deviceA = a.deviceId;
    this.#playerB = b.player;
    this.#deviceB = b.deviceId;

    // Deck A starts active at full volume; Deck B silent
    await this.#playerA.setVolume(1);
    await this.#playerB.setVolume(0);

    this.#startTracking();
    this.#ready = true;
    this.dispatchEvent(new CustomEvent('ready'));
  }

  // ── Playback controls ─────────────────────────────────

  /** Play a track URI on the active deck (no crossfade). */
  async play(uri) {
    this.#currentTrackUri = uri;
    this.#crossfadeNotified = false;
    await this.#activePlayer.setVolume(1);
    await this.#playOnDevice(this.#activeDevice, uri);
  }

  /** Toggle play / pause on the active deck. */
  async togglePause() {
    await this.#activePlayer.togglePlay();
  }

  /** Pause the active deck. */
  async pause() {
    await this.#activePlayer.pause();
  }

  /**
   * Cross-fade from current deck to the given URI.
   * @param {string} uri  – spotify:track:...
   * @param {number} [durationOverride]  – crossfade length in ms (defaults to this.crossfadeDuration)
   */
  async crossfadeTo(uri, durationOverride) {
    if (this.#isCrossfading) return;
    this.#isCrossfading = true;
    this.#crossfadeNotified = true;

    const duration = durationOverride ?? this.#crossfadeDuration;
    const from = this.#activePlayer;
    const to = this.#inactivePlayer;
    const toDevice = this.#inactiveDevice;

    try {
      // Prime the incoming deck silently
      await to.setVolume(0);
      await this.#playOnDevice(toDevice, uri);

      // Swap active deck so progress tracking follows the incoming track
      this.#active = this.#active === 'A' ? 'B' : 'A';
      this.#currentTrackUri = uri;
      this.#crossfadeNotified = false;

      // Run the volume crossfade with an ease-in-out curve
      const STEPS = 80;
      const stepMs = duration / STEPS;

      await new Promise((resolve) => {
        let step = 0;
        const tick = setInterval(() => {
          step++;
          const t = step / STEPS;
          // Ease in-out: smooth S-curve
          const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
          from.setVolume(1 - eased);
          to.setVolume(eased);

          if (step >= STEPS) {
            clearInterval(tick);
            // Ensure exact final volumes
            from.setVolume(0);
            to.setVolume(1);
            from.pause();
            this.#isCrossfading = false;
            resolve();
          }
        }, stepMs);
      });
    } catch (err) {
      this.#isCrossfading = false;
      throw err;
    }
  }

  /** Immediately switch (very short 250 ms crossfade — feels instantaneous). */
  async switchTo(uri) {
    return this.crossfadeTo(uri, 250);
  }

  // ── Cleanup ───────────────────────────────────────────

  destroy() {
    clearInterval(this.#trackInterval);
    this.#playerA?.disconnect();
    this.#playerB?.disconnect();
  }

  // ── Private helpers ───────────────────────────────────

  get #activePlayer() { return this.#active === 'A' ? this.#playerA : this.#playerB; }
  get #activeDevice()  { return this.#active === 'A' ? this.#deviceA : this.#deviceB; }
  get #inactivePlayer(){ return this.#active === 'A' ? this.#playerB : this.#playerA; }
  get #inactiveDevice(){ return this.#active === 'A' ? this.#deviceB : this.#deviceA; }

  /** Create a single Spotify.Player deck and return { player, deviceId }. */
  #createDeck(name) {
    return new Promise((resolve, reject) => {
      const player = new Spotify.Player({
        name,
        getOAuthToken: (cb) => this.#getToken().then(cb),
        volume: 0,
      });

      player.addListener('ready', ({ device_id }) => {
        resolve({ player, deviceId: device_id });
      });

      player.addListener('not_ready', ({ device_id }) => {
        this.dispatchEvent(new CustomEvent('error', {
          detail: { message: `Deck "${name}" went offline (${device_id})` },
        }));
      });

      player.addListener('player_state_changed', (state) => {
        if (state && this.#isActive(player)) {
          this.dispatchEvent(new CustomEvent('statechange', {
            detail: {
              track: state.track_window?.current_track ?? null,
              paused: state.paused,
            },
          }));
        }
      });

      for (const event of ['initialization_error', 'authentication_error', 'account_error']) {
        player.addListener(event, ({ message }) => {
          this.dispatchEvent(new CustomEvent('error', { detail: { message } }));
          reject(new Error(message));
        });
      }

      player.connect();
    });
  }

  /** Poll active deck state for progress and auto-crossfade triggering. */
  #startTracking() {
    this.#trackInterval = setInterval(async () => {
      const state = await this.#activePlayer.getCurrentState();
      if (!state || !state.duration) return;

      const { position, duration, paused } = state;
      const remaining = duration - position;

      this.dispatchEvent(new CustomEvent('progress', {
        detail: { position, duration, remaining, paused },
      }));

      if (paused || this.#isCrossfading) return;

      // Announce that a crossfade should start (once per track)
      if (!this.#crossfadeNotified && remaining <= this.#crossfadeDuration && remaining > 0) {
        this.#crossfadeNotified = true;
        this.dispatchEvent(new Event('crossfadeready'));
      }

      // Track ended with nothing queued / crossfade not triggered
      if (remaining <= 100 && !this.#isCrossfading) {
        this.dispatchEvent(new Event('trackend'));
      }
    }, 300);
  }

  #isActive(player) {
    return (this.#active === 'A' && player === this.#playerA)
        || (this.#active === 'B' && player === this.#playerB);
  }

  async #playOnDevice(deviceId, uri) {
    const token = await this.#getToken();
    const res = await fetch(
      `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uris: [uri] }),
      }
    );
    // 204 = OK with no body; anything else is an error
    if (!res.ok && res.status !== 204) {
      const body = await res.json().catch(() => ({}));
      const msg = body?.error?.message ?? `HTTP ${res.status}`;
      throw new Error(msg);
    }
  }
}
