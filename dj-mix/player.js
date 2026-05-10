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
  #trackEndNotified = false;  // guard: only fire trackend once per track
  #trackInterval = null;
  #crossfadeInterval = null; // stored so destroy() can abort it
  #currentTrackUri = null;
  #ready = false;
  #destroyed = false;

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
    console.log('Initializing DJPlayer...');

    const [a, b] = await Promise.all([
      this.#createDeck('DJ Mix – Deck A'),
      this.#createDeck('DJ Mix – Deck B'),
    ]);

    this.#playerA = a.player;
    this.#deviceA = a.deviceId;
    this.#playerB = b.player;
    this.#deviceB = b.deviceId;
    console.log('DJPlayer initialized.');

    // FIX A — Keep device IDs in sync on reconnect (ready fires with new device_id).
    // IMPORTANT: only update on 'ready', never clear on 'not_ready' — the old
    // device_id stays valid for a short grace period and we need it for crossfade.
    this.#playerA.addListener('ready', ({ device_id }) => {
      this.#deviceA = device_id;
      console.log(`Deck A reconnected with device ID: ${device_id}`);
    });
    this.#playerB.addListener('ready', ({ device_id }) => {
      this.#deviceB = device_id;
      console.log(`Deck B reconnected with device ID: ${device_id}`);
    });

    // Deck A starts active at full volume; Deck B stays silent.
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
    this.#trackEndNotified = false;
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

    // FIX B — Resolve the inactive device ID before attempting crossfade.
    // If the inactive deck went offline (not_ready) since last use, its device_id
    // may be stale or null. We force a reconnect and wait for the new device_id.
    let toDevice = this.#inactiveDevice;
    if (!toDevice) {
      console.warn('Inactive deck has no device ID — forcing reconnect…');
      try {
        toDevice = await this.#reconnectDeck(to, this.#active === 'A' ? 'B' : 'A');
      } catch (err) {
        this.#isCrossfading = false;
        throw new Error(`Cannot crossfade: inactive deck failed to reconnect (${err.message})`);
      }
    }

    console.log(`Crossfade: from deck ${this.#active} → to device ${toDevice}, duration ${duration} ms`);

    try {
      // Prime the incoming deck silently
      await to.setVolume(0);
      await this.#playOnDevice(toDevice, uri);

      const STEPS = 80;
      const stepMs = duration / STEPS;

      await new Promise((resolve) => {
        let step = 0;
        this.#crossfadeInterval = setInterval(() => {
          if (this.#destroyed) {
            clearInterval(this.#crossfadeInterval);
            this.#crossfadeInterval = null;
            this.#isCrossfading = false;
            resolve();
            return;
          }
          step++;

          // Switch active deck on the first tick (incoming deck has had time to start)
          if (step === 1) {
            this.#active = this.#active === 'A' ? 'B' : 'A';
            this.#currentTrackUri = uri;
            this.#crossfadeNotified = false;
            this.#trackEndNotified = false;
          }

          const t = step / STEPS;
          // Ease in-out S-curve
          const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
          from?.setVolume(1 - eased);
          to?.setVolume(eased);

          if (step >= STEPS) {
            clearInterval(this.#crossfadeInterval);
            this.#crossfadeInterval = null;
            from?.setVolume(0);
            to?.setVolume(1);
            from?.pause();
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

  /**
   * Must be called synchronously from a user gesture (click) to unblock
   * browser autoplay restrictions before the first audio playback.
   */
  activateElement() {
    this.#playerA?.activateElement();
    this.#playerB?.activateElement();
  }

  // ── Cleanup ───────────────────────────────────────────

  destroy() {
    this.#destroyed = true;
    clearInterval(this.#trackInterval);
    clearInterval(this.#crossfadeInterval);
    this.#crossfadeInterval = null;
    this.#playerA?.disconnect();
    this.#playerB?.disconnect();
    this.#playerA = null;
    this.#playerB = null;
  }

  // ── Private helpers ───────────────────────────────────

  get #activePlayer()  { return this.#active === 'A' ? this.#playerA : this.#playerB; }
  get #activeDevice()  { return this.#active === 'A' ? this.#deviceA : this.#deviceB; }
  get #inactivePlayer(){ return this.#active === 'A' ? this.#playerB : this.#playerA; }
  get #inactiveDevice(){ return this.#active === 'A' ? this.#deviceB : this.#deviceA; }

  /**
   * FIX B — Force a reconnect on a deck that lost its device_id.
   * Calls player.connect() again and waits for the 'ready' event (max 8 s).
   * Updates #deviceA / #deviceB and returns the new device_id.
   *
   * @param {Spotify.Player} player
   * @param {'A'|'B'} deck
   * @returns {Promise<string>} new device_id
   */
  #reconnectDeck(player, deck) {
    return new Promise((resolve, reject) => {
      if (!player || this.#destroyed) {
        reject(new Error(`Deck ${deck} unavailable for reconnect`));
        return;
      }

      const timeout = setTimeout(() => {
        player?.removeListener?.('ready', onReady);
        reject(new Error(`Deck ${deck} reconnect timed out`));
      }, 8000);

      const onReady = ({ device_id }) => {
        player?.removeListener?.('ready', onReady);
        clearTimeout(timeout);
        if (deck === 'A') this.#deviceA = device_id;
        else              this.#deviceB = device_id;
        console.log(`Deck ${deck} reconnected with new device ID: ${device_id}`);
        resolve(device_id);
      };

      player.addListener('ready', onReady);
      player.connect();
    });
  }

  /** Create a single Spotify.Player deck and return { player, deviceId }. */
  #createDeck(name) {
    return new Promise((resolve, reject) => {
      const player = new Spotify.Player({
        name,
        getOAuthToken: (cb) => this.#getToken().then(cb),
        volume: 0,
      });

      player.addListener('ready', ({ device_id }) => {
        console.log(`Deck "${name}" ready with device ID ${device_id}`);
        resolve({ player, deviceId: device_id });
      });

      // FIX A — Do NOT clear the device_id on not_ready.
      // Log the event for debugging but keep the last known device_id intact
      // so crossfadeTo() can detect null and trigger #reconnectDeck.
      player.addListener('not_ready', ({ device_id }) => {
        console.warn(`Deck "${name}" went offline (${device_id}) — device_id preserved for reconnect detection`);
        // Intentionally NOT updating #deviceA / #deviceB here.
        // If the deck went offline its stored device_id is now invalid;
        // set it to null so crossfadeTo() knows it must reconnect.
        if (name.endsWith('Deck A')) this.#deviceA = null;
        if (name.endsWith('Deck B')) this.#deviceB = null;

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
      if (this.#destroyed || !this.#activePlayer) return;
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

      // trackend fired at most once per track
      if (remaining <= 100 && !this.#isCrossfading && !this.#trackEndNotified) {
        this.#trackEndNotified = true;
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