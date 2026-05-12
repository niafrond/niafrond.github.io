/**
 * DJPlayer - dual local-audio deck player with true crossfade.
 *
 * Expects local object URLs (blob:) or direct audio URLs.
 */
export class DJPlayer extends EventTarget {
  #audioA = null;
  #audioB = null;
  #active = 'A';
  #crossfadeDuration = 12000;
  #isCrossfading = false;
  #crossfadeNotified = false;
  #trackEndNotified = false;
  #trackInterval = null;
  #crossfadeInterval = null;
  #ready = false;
  #destroyed = false;

  get crossfadeDuration() { return this.#crossfadeDuration; }
  set crossfadeDuration(ms) {
    this.#crossfadeDuration = Math.max(250, Number(ms) || 5000);
    this.#crossfadeNotified = false;
  }

  get isCrossfading() { return this.#isCrossfading; }
  get isReady() { return this.#ready; }

  async init() {
    this.#audioA = this.#createDeckAudio('A');
    this.#audioB = this.#createDeckAudio('B');

    this.#audioA.volume = 1;
    this.#audioB.volume = 0;

    this.#startTracking();
    this.#ready = true;
    this.dispatchEvent(new CustomEvent('ready'));
  }

  async play(sourceUrl) {
    if (!sourceUrl) throw new Error('Source audio manquante');

    const active = this.#activeAudio;
    const inactive = this.#inactiveAudio;

    this.#crossfadeNotified = false;
    this.#trackEndNotified = false;

    inactive.pause();
    inactive.currentTime = 0;
    inactive.src = '';

    active.volume = 1;
    await this.#loadAndPlay(active, sourceUrl);
  }

  async togglePause() {
    const active = this.#activeAudio;
    if (!active) return;
    if (active.paused) await active.play();
    else active.pause();
  }

  async pause() {
    this.#activeAudio?.pause();
  }

  async seekTo(positionMs, options = {}) {
    const active = this.#activeAudio;
    if (!active) return;

    const durationMs = Number.isFinite(active.duration) && active.duration > 0
      ? active.duration * 1000
      : 0;
    if (!durationMs) return;

    const safeTargetMs = Math.max(0, Math.min(durationMs, Number(positionMs) || 0));
    const wasPaused = active.paused;
    const fadeMs = Math.max(40, Number(options.fadeMs) || 180);

    if (this.#isCrossfading || wasPaused) {
      active.currentTime = safeTargetMs / 1000;
      return;
    }

    const initialVolume = Math.max(0, Math.min(1, active.volume || 1));
    const floorVolume = Math.min(initialVolume, 0.08);

    await this.#fadeVolume(active, initialVolume, floorVolume, fadeMs);
    active.currentTime = safeTargetMs / 1000;
    await this.#fadeVolume(active, floorVolume, initialVolume, fadeMs);
  }

  async crossfadeTo(sourceUrl, durationOverride) {
    if (this.#isCrossfading) return;
    if (!sourceUrl) throw new Error('Source audio manquante pour le crossfade');

    this.#isCrossfading = true;
    this.#crossfadeNotified = true;

    const duration = Number(durationOverride) || this.#crossfadeDuration;
    const from = this.#activeAudio;
    const to = this.#inactiveAudio;

    try {
      to.volume = 0;
      await this.#loadAndPlay(to, sourceUrl);

      const steps = 80;
      const stepMs = Math.max(10, duration / steps);

      await new Promise((resolve) => {
        let step = 0;
        this.#crossfadeInterval = setInterval(() => {
          if (this.#destroyed) {
            clearInterval(this.#crossfadeInterval);
            this.#crossfadeInterval = null;
            resolve();
            return;
          }

          step += 1;
          const t = step / steps;
          const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

          from.volume = Math.max(0, 1 - eased);
          to.volume = Math.min(1, eased);

          if (step >= steps) {
            clearInterval(this.#crossfadeInterval);
            this.#crossfadeInterval = null;
            from.pause();
            from.currentTime = 0;
            from.src = '';
            from.volume = 0;
            to.volume = 1;
            resolve();
          }
        }, stepMs);
      });

      this.#active = this.#active === 'A' ? 'B' : 'A';
      this.#crossfadeNotified = false;
      this.#trackEndNotified = false;
    } catch (err) {
      to.pause();
      to.currentTime = 0;
      to.src = '';
      throw err;
    } finally {
      this.#isCrossfading = false;
    }
  }

  async switchTo(sourceUrl) {
    return this.crossfadeTo(sourceUrl, 250);
  }

  activateElement() {
    // No-op for HTMLAudioElement based playback.
  }

  destroy() {
    this.#destroyed = true;
    clearInterval(this.#trackInterval);
    clearInterval(this.#crossfadeInterval);
    this.#crossfadeInterval = null;

    for (const audio of [this.#audioA, this.#audioB]) {
      if (!audio) continue;
      audio.pause();
      audio.src = '';
      audio.remove();
    }

    this.#audioA = null;
    this.#audioB = null;
    this.#ready = false;
  }

  get #activeAudio() {
    return this.#active === 'A' ? this.#audioA : this.#audioB;
  }

  get #inactiveAudio() {
    return this.#active === 'A' ? this.#audioB : this.#audioA;
  }

  #createDeckAudio(deck) {
    const audio = new Audio();
    audio.preload = 'auto';

    audio.addEventListener('playing', () => {
      if ((deck === 'A' && this.#active !== 'A') || (deck === 'B' && this.#active !== 'B')) return;
      this.dispatchEvent(new CustomEvent('statechange', {
        detail: { paused: false, track: null },
      }));
    });

    audio.addEventListener('pause', () => {
      if ((deck === 'A' && this.#active !== 'A') || (deck === 'B' && this.#active !== 'B')) return;
      this.dispatchEvent(new CustomEvent('statechange', {
        detail: { paused: true, track: null },
      }));
    });

    audio.addEventListener('error', () => {
      const src = audio.currentSrc || audio.src || '';
      if (!src || this.#destroyed) return;
      this.dispatchEvent(new CustomEvent('error', {
        detail: { message: `Erreur audio deck ${deck}` },
      }));
    });

    return audio;
  }

  async #loadAndPlay(audio, sourceUrl) {
    audio.pause();
    audio.currentTime = 0;
    audio.src = sourceUrl;

    await new Promise((resolve, reject) => {
      const onCanPlay = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error('Flux audio API non lisible'));
      };
      const cleanup = () => {
        audio.removeEventListener('canplay', onCanPlay);
        audio.removeEventListener('error', onError);
      };

      audio.addEventListener('canplay', onCanPlay, { once: true });
      audio.addEventListener('error', onError, { once: true });
      audio.load();
    });

    await audio.play();
  }

  #startTracking() {
    this.#trackInterval = setInterval(() => {
      if (this.#destroyed || !this.#ready) return;
      const active = this.#activeAudio;
      if (!active || !Number.isFinite(active.duration) || active.duration <= 0) return;

      const position = Math.max(0, active.currentTime * 1000);
      const duration = active.duration * 1000;
      const remaining = Math.max(0, duration - position);

      this.dispatchEvent(new CustomEvent('progress', {
        detail: {
          position,
          duration,
          remaining,
          paused: active.paused,
        },
      }));

      if (!active.paused && !this.#isCrossfading && !this.#crossfadeNotified && remaining <= this.#crossfadeDuration && remaining > 0) {
        this.#crossfadeNotified = true;
        this.dispatchEvent(new Event('crossfadeready'));
      }

      if ((active.ended || remaining <= 120) && !this.#isCrossfading && !this.#trackEndNotified) {
        this.#trackEndNotified = true;
        this.dispatchEvent(new Event('trackend'));
      }
    }, 300);
  }

  async #fadeVolume(audio, from, to, durationMs) {
    if (!audio) return;
    if (durationMs <= 0 || from === to) {
      audio.volume = to;
      return;
    }

    const steps = Math.max(1, Math.round(durationMs / 16));
    const stepMs = Math.max(10, durationMs / steps);

    await new Promise((resolve) => {
      let step = 0;
      const timer = setInterval(() => {
        if (this.#destroyed) {
          clearInterval(timer);
          resolve();
          return;
        }

        step += 1;
        const t = Math.min(1, step / steps);
        const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        audio.volume = Math.max(0, Math.min(1, from + ((to - from) * eased)));

        if (step >= steps) {
          clearInterval(timer);
          audio.volume = Math.max(0, Math.min(1, to));
          resolve();
        }
      }, stepMs);
    });
  }
}
