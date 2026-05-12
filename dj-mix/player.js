import { SimpleMixFeatures } from './lib/mixFeatures.js';
import { createLogger } from './lib/logger.js';

const logger = createLogger('player');
const logDebug = (event, payload) => logger.debug(event, payload);
const logInfo = (event, payload) => logger.info(event, payload);
const logError = (event, payload) => logger.error(event, payload);

function createDefaultDeckFx() {
  return {
    A: { vocalRemove: false, instruRemove: false },
    B: { vocalRemove: false, instruRemove: false },
  };
}

function mergeMixFeatureSettings(current, next) {
  const base = current || {};
  const incoming = next || {};
  const mergedDeckFx = createDefaultDeckFx();

  for (const deck of ['A', 'B']) {
    mergedDeckFx[deck] = {
      ...mergedDeckFx[deck],
      ...(base.deckFx?.[deck] || {}),
      ...(incoming.deckFx?.[deck] || {}),
    };

    if (incoming[deck]?.vocalRemove !== undefined || incoming[deck]?.instruRemove !== undefined) {
      mergedDeckFx[deck] = {
        ...mergedDeckFx[deck],
        ...(incoming[deck] || {}),
      };
    }
  }

  if (incoming.vocalRemove !== undefined || incoming.instruRemove !== undefined) {
    mergedDeckFx.A = {
      ...mergedDeckFx.A,
      vocalRemove: incoming.vocalRemove !== undefined ? Boolean(incoming.vocalRemove) : mergedDeckFx.A.vocalRemove,
      instruRemove: incoming.instruRemove !== undefined ? Boolean(incoming.instruRemove) : mergedDeckFx.A.instruRemove,
    };
    mergedDeckFx.B = {
      ...mergedDeckFx.B,
      vocalRemove: incoming.vocalRemove !== undefined ? Boolean(incoming.vocalRemove) : mergedDeckFx.B.vocalRemove,
      instruRemove: incoming.instruRemove !== undefined ? Boolean(incoming.instruRemove) : mergedDeckFx.B.instruRemove,
    };
  }

  for (const deck of ['A', 'B']) {
    if (mergedDeckFx[deck].vocalRemove) mergedDeckFx[deck].instruRemove = false;
    if (mergedDeckFx[deck].instruRemove) mergedDeckFx[deck].vocalRemove = false;
  }

  return {
    autoBpm: incoming.autoBpm !== undefined ? Boolean(incoming.autoBpm) : Boolean(base.autoBpm),
    echo: incoming.echo !== undefined ? Boolean(incoming.echo) : Boolean(base.echo),
    distortion: incoming.distortion !== undefined ? Boolean(incoming.distortion) : Boolean(base.distortion),
    deckFx: mergedDeckFx,
  };
}

/**
 * DJPlayer - dual local-audio deck player with true crossfade.
 *
 * Expects local object URLs (blob:) or direct audio URLs.
 */
export class DJPlayer extends EventTarget {
  #audioA = null;
  #audioB = null;
  #deckLoudnessDb = {
    A: null,
    B: null,
  };
  #active = 'A';
  #crossfadeDuration = 12000;
  #isCrossfading = false;
  #crossfadeNotified = false;
  #trackEndNotified = false;
  #trackInterval = null;
  #crossfadeInterval = null;
  #manualMixInterval = null;
  #mixFeatures = null;
  #mixFeatureSettings = {
    autoBpm: false,
    echo: false,
    distortion: false,
    deckFx: createDefaultDeckFx(),
  };
  #ready = false;
  #destroyed = false;

  get crossfadeDuration() { return this.#crossfadeDuration; }
  set crossfadeDuration(ms) {
    this.#crossfadeDuration = Math.max(250, Number(ms) || 5000);
    this.#crossfadeNotified = false;
  }

  get isCrossfading() { return this.#isCrossfading; }
  get isReady() { return this.#ready; }
  get activeDeck() { return this.#active; }

  async init() {
    this.#audioA = this.#createDeckAudio('A');
    this.#audioB = this.#createDeckAudio('B');

    this.#audioA.volume = 1;
    this.#audioB.volume = 0;

    this.#mixFeatures = new SimpleMixFeatures(this.#audioA, this.#audioB);
    await this.#mixFeatures.setEnabled(this.#mixFeatureSettings);

    this.#startTracking();
    this.#ready = true;
    this.#emitDeckState();
    logInfo('player.init.ready', {
      crossfadeDurationMs: this.#crossfadeDuration,
      activeDeck: this.#active,
    });
    this.dispatchEvent(new CustomEvent('ready'));
  }

  async play(source) {
    const normalized = this.#normalizeSource(source);
    if (!normalized.url) throw new Error('Source audio manquante');

    const active = this.#activeAudio;
    const inactive = this.#inactiveAudio;
    const activeDeck = this.#active;
    const inactiveDeck = activeDeck === 'A' ? 'B' : 'A';

    this.#crossfadeNotified = false;
    this.#trackEndNotified = false;

    this.#setDeckLoudness(activeDeck, normalized.loudnessDb);
    this.#setDeckLoudness(inactiveDeck, null);

    inactive.pause();
    inactive.currentTime = 0;
    inactive.src = '';

    this.#applyDeckBaseMix(activeDeck === 'A' ? 1 : 0, activeDeck === 'B' ? 1 : 0);
    await this.#loadAndPlay(active, normalized.url);
    this.#emitDeckState();
  }

  async playOnDeck(deck, source, options = {}) {
    const normalized = this.#normalizeSource(source);
    if (!normalized.url) throw new Error('Source audio manquante');
    const targetDeck = deck === 'B' ? 'B' : 'A';
    const audio = targetDeck === 'A' ? this.#audioA : this.#audioB;
    if (!audio) return;

    this.#setDeckLoudness(targetDeck, normalized.loudnessDb);

    logInfo('deck.load.begin', {
      targetDeck,
      paused: options.paused === true,
      makeActive: options.makeActive === true,
      hasUrl: !!normalized.url,
    });

    if (options.paused === true) {
      await this.#loadOnly(audio, normalized.url);
    } else {
      await this.#loadAndPlay(audio, normalized.url);
    }

    if (options.makeActive === true) {
      this.#active = targetDeck;
      this.#crossfadeNotified = false;
      this.#trackEndNotified = false;
    }

    this.#emitDeckState();
    logInfo('deck.load.done', {
      targetDeck,
      activeDeck: this.#active,
    });
  }

  pauseDeck(deck) {
    const audio = deck === 'B' ? this.#audioB : this.#audioA;
    audio?.pause();
    this.#emitDeckState();
  }

  async resumeDeck(deck) {
    const audio = deck === 'B' ? this.#audioB : this.#audioA;
    if (!audio || !audio.src) return;
    await audio.play().catch(() => {});
    this.#emitDeckState();
  }

  setDeckPlaybackRate(deck, rate) {
    const audio = deck === 'B' ? this.#audioB : this.#audioA;
    if (!audio) return;
    audio.playbackRate = Math.max(0.5, Math.min(2.0, Number(rate) || 1));
    this.#emitDeckState();
  }

  resetDeckPlaybackRate(deck) {
    this.setDeckPlaybackRate(deck, 1.0);
  }

  setDeckMixRatio(ratio, transitionMs = 140) {
    const safeRatio = Math.max(0, Math.min(1, Number(ratio) || 0));
    const targetA = 1 - safeRatio;
    const targetB = safeRatio;

    this.#smoothSetDeckVolumes(targetA, targetB, transitionMs);
  }

  setDeckVolumes(volumeA, volumeB, transitionMs = 100) {
    const safeA = Math.max(0, Math.min(1, Number(volumeA) || 0));
    const safeB = Math.max(0, Math.min(1, Number(volumeB) || 0));
    this.#smoothSetDeckVolumes(safeA, safeB, transitionMs);
  }

  syncDecksToActive() {
    const active = this.#activeAudio;
    const inactive = this.#inactiveAudio;
    if (!active || !inactive) return;
    inactive.playbackRate = active.playbackRate;
    this.#emitDeckState();
  }

  setMixFeatures(settings) {
    this.#mixFeatureSettings = mergeMixFeatureSettings(this.#mixFeatureSettings, settings);

    if (this.#mixFeatures) {
      this.#mixFeatures.setEnabled(this.#mixFeatureSettings).catch(() => {
        // optional effects should never break playback
      });
    }
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

  async seekDeckTo(deck, positionMs, options = {}) {
    const targetDeck = deck === 'B' ? 'B' : 'A';
    const audio = targetDeck === 'B' ? this.#audioB : this.#audioA;
    if (!audio) return;

    const durationMs = Number.isFinite(audio.duration) && audio.duration > 0
      ? audio.duration * 1000
      : 0;
    if (!durationMs) return;

    const safeTargetMs = Math.max(0, Math.min(durationMs, Number(positionMs) || 0));
    const wasPaused = audio.paused;
    const fadeMs = Math.max(40, Number(options.fadeMs) || 180);

    if (this.#isCrossfading || wasPaused) {
      audio.currentTime = safeTargetMs / 1000;
      this.#emitDeckState();
      return;
    }

    const initialVolume = Math.max(0, Math.min(1, audio.volume || 1));
    const floorVolume = Math.min(initialVolume, 0.08);

    await this.#fadeVolume(audio, initialVolume, floorVolume, fadeMs);
    audio.currentTime = safeTargetMs / 1000;
    await this.#fadeVolume(audio, floorVolume, initialVolume, fadeMs);
    this.#emitDeckState();
  }

  async crossfadeTo(source, durationOverride) {
    return this.crossfadeToDeck(null, source, durationOverride);
  }

  async crossfadeToDeck(targetDeck, source, durationOverride) {
    if (this.#isCrossfading) return;
    const normalized = this.#normalizeSource(source);
    if (!normalized.url) throw new Error('Source audio manquante pour le crossfade');

    this.#isCrossfading = true;
    this.#crossfadeNotified = true;

    if (durationOverride) {
      this.crossfadeDuration = durationOverride;
    }
    // Determine fade direction: load new track on target deck, fade from the other.
    // When no target is specified, fade from the dominant (louder) deck.
    const desiredDeck = targetDeck === 'A' || targetDeck === 'B' ? targetDeck : null;
    let fromDeck, toDeck;
    if (desiredDeck) {
      toDeck = desiredDeck;
      fromDeck = desiredDeck === 'A' ? 'B' : 'A';
    } else {
      const volA = this.#audioA?.volume || 0;
      const volB = this.#audioB?.volume || 0;
      fromDeck = volB >= volA ? 'B' : 'A';
      toDeck = fromDeck === 'A' ? 'B' : 'A';
    }
    const from = fromDeck === 'A' ? this.#audioA : this.#audioB;
    const to = toDeck === 'A' ? this.#audioA : this.#audioB;

    logInfo('crossfade.begin', {
      desiredDeck,
      fromDeck,
      toDeck,
      durationMs: this.#crossfadeDuration,
      hasUrl: !!normalized.url,
    });

    // Capture current base mix levels before loading the new track so the
    // crossfade starts from the current slider position instead of jumping to 0.
    const compFrom = this.#getDeckCompensation(fromDeck);
    const compTo = this.#getDeckCompensation(toDeck);
    const startBaseFrom = compFrom > 0 ? Math.max(0, Math.min(1, from.volume / compFrom)) : 1;
    const startBaseTo = compTo > 0 ? Math.max(0, Math.min(1, to.volume / compTo)) : 0;

    try {
      this.#setDeckLoudness(toDeck, normalized.loudnessDb);
      
      await this.#loadAndPlay(to, normalized.url);
      

      const tickMs = 16;

      await new Promise((resolve) => {
        let progress = 0;
        let lastTickAt = performance.now();

        this.#crossfadeInterval = setInterval(() => {
          if (this.#destroyed) {
            clearInterval(this.#crossfadeInterval);
            this.#crossfadeInterval = null;
            resolve();
            return;
          }

          const now = performance.now();
          const elapsedMs = Math.max(0, now - lastTickAt);
          lastTickAt = now;
          const liveDuration = Math.max(250, Number(this.#crossfadeDuration) || 5000);

          progress = Math.min(1, progress + (elapsedMs / liveDuration));
          const t = progress;
          const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

          const fromBase = Math.max(0, startBaseFrom * (1 - eased));
          const toBase = Math.min(1, startBaseTo + (1 - startBaseTo) * eased);
          if (fromDeck === 'A') {
            this.#applyDeckBaseMix(fromBase, toBase);
          } else {
            this.#applyDeckBaseMix(toBase, fromBase);
          }
          this.#emitDeckState();

          this.dispatchEvent(new CustomEvent('crossfadeprogress', {
            detail: {
              fromDeck,
              fromVolume: fromBase,
              toVolume: toBase,
              toPosition: Number.isFinite(to.currentTime) ? to.currentTime * 1000 : 0,
              toDuration: Number.isFinite(to.duration) && to.duration > 0 ? to.duration * 1000 : 0,
              durationMs: liveDuration,
              progress,
            },
          }));

          if (progress >= 1) {
            clearInterval(this.#crossfadeInterval);
            this.#crossfadeInterval = null;
            from.pause();
            from.currentTime = 0;
            from.src = '';
            this.#setDeckLoudness(fromDeck, null);
            // if (toDeck === 'A') {
            //   this.#applyDeckBaseMix(1, 0);
            // } else {
            //   this.#applyDeckBaseMix(0, 1);
            // }
            resolve();
          }
        }, tickMs);
      });

      this.#active = toDeck;
      this.#crossfadeNotified = false;
      this.#trackEndNotified = false;
      this.#emitDeckState();
      logInfo('crossfade.done', {
        activeDeck: this.#active,
        fromDeck,
        toDeck,
      });
    } catch (err) {
      to.pause();
      to.currentTime = 0;
      to.src = '';
      logError('crossfade.failed', {
        fromDeck,
        toDeck,
        message: err?.message,
      });
      throw err;
    } finally {
      this.#isCrossfading = false;
    }
  }

  async switchTo(sourceUrl) {
    return this.crossfadeToDeck(null, sourceUrl, 250);
  }

  activateElement() {
    // No-op for HTMLAudioElement based playback.
  }

  destroy() {
    this.#destroyed = true;
    clearInterval(this.#trackInterval);
    clearInterval(this.#crossfadeInterval);
    clearInterval(this.#manualMixInterval);
    this.#crossfadeInterval = null;
    this.#manualMixInterval = null;

    this.#mixFeatures?.destroy();
    this.#mixFeatures = null;

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
      this.#emitDeckState();
      if ((deck === 'A' && this.#active !== 'A') || (deck === 'B' && this.#active !== 'B')) return;
      this.dispatchEvent(new CustomEvent('statechange', {
        detail: { paused: false, track: null },
      }));
    });

    audio.addEventListener('pause', () => {
      this.#emitDeckState();
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
/**
 * 
 * @param {*} audio 
 * @param {*} sourceUrl 
 */
  async #loadAndPlay(audio, sourceUrl) {
    if(!audio.paused) return;
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
    
    logDebug('audio.loadAndPlay.started', {
      srcPreview: String(sourceUrl || '').slice(0, 96),
    });
  }

  async #loadOnly(audio, sourceUrl) {
    audio.pause();
    audio.currentTime = 0;
    audio.src = sourceUrl;

    await new Promise((resolve, reject) => {
      const onCanPlay = () => { cleanup(); resolve(); };
      const onError = () => { cleanup(); reject(new Error('Flux audio API non lisible')); };
      const cleanup = () => {
        audio.removeEventListener('canplay', onCanPlay);
        audio.removeEventListener('error', onError);
      };
      audio.addEventListener('canplay', onCanPlay, { once: true });
      audio.addEventListener('error', onError, { once: true });
      audio.load();
    });
    logDebug('audio.loadOnly.primed', {
      srcPreview: String(sourceUrl || '').slice(0, 96),
    });
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

      this.#emitDeckState();
      this.#mixFeatures?.tick(this.#active);

      if (!active.paused && !this.#isCrossfading && !this.#crossfadeNotified && remaining <= this.#crossfadeDuration && remaining > 0) {
        this.#crossfadeNotified = true;
        logInfo('tracking.crossfadeReady.thresholdReached', {
          activeDeck: this.#active,
          remainingMs: remaining,
          crossfadeDurationMs: this.#crossfadeDuration,
        });
        this.dispatchEvent(new Event('crossfadeready'));
      }

      if ((active.ended || remaining <= 120) && !this.#isCrossfading && !this.#trackEndNotified) {
        this.#trackEndNotified = true;
        logInfo('tracking.trackEnd.reached', {
          activeDeck: this.#active,
          remainingMs: remaining,
          ended: active.ended,
        });
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

  #smoothSetDeckVolumes(targetA, targetB, durationMs) {
    clearInterval(this.#manualMixInterval);
    this.#manualMixInterval = null;

    if (!this.#audioA || !this.#audioB) return;

    const fromA = this.#audioA.volume || 0;
    const fromB = this.#audioB.volume || 0;
    const ms = Math.max(16, Number(durationMs) || 140);
    const steps = Math.max(1, Math.round(ms / 16));
    let step = 0;

    this.#manualMixInterval = setInterval(() => {
      if (this.#destroyed || !this.#audioA || !this.#audioB) {
        clearInterval(this.#manualMixInterval);
        this.#manualMixInterval = null;
        return;
      }

      step += 1;
      const t = Math.min(1, step / steps);
      const nextA = Math.max(0, Math.min(1, fromA + ((targetA - fromA) * t)));
      const nextB = Math.max(0, Math.min(1, fromB + ((targetB - fromB) * t)));
      this.#applyDeckBaseMix(nextA, nextB);
      this.#emitDeckState();

      if (step >= steps) {
        clearInterval(this.#manualMixInterval);
        this.#manualMixInterval = null;
      }
    }, 16);
  }

  #emitDeckState() {
    if (!this.#audioA || !this.#audioB) return;

    
    this.dispatchEvent(new CustomEvent('deckstate', {
      detail: {
        activeDeck: this.#active,
        isCrossfading: this.#isCrossfading,
        deckA: {
          playing: !this.#audioA.paused,
          volume: Math.max(0, Math.min(1, Number(this.#audioA.volume) || 0)),
          loudnessDb: this.#deckLoudnessDb.A,
          positionMs: Number.isFinite(this.#audioA.currentTime) ? this.#audioA.currentTime * 1000 : 0,
          durationMs: Number.isFinite(this.#audioA.duration) && this.#audioA.duration > 0 ? this.#audioA.duration * 1000 : 0,
          playbackRate: Number.isFinite(this.#audioA.playbackRate) ? this.#audioA.playbackRate : 1,
          hasSrc: !!this.#audioA.src,
        },
        deckB: {
          playing: !this.#audioB.paused,
          volume: Math.max(0, Math.min(1, Number(this.#audioB.volume) || 0)),
          loudnessDb: this.#deckLoudnessDb.B,
          positionMs: Number.isFinite(this.#audioB.currentTime) ? this.#audioB.currentTime * 1000 : 0,
          durationMs: Number.isFinite(this.#audioB.duration) && this.#audioB.duration > 0 ? this.#audioB.duration * 1000 : 0,
          playbackRate: Number.isFinite(this.#audioB.playbackRate) ? this.#audioB.playbackRate : 1,
          hasSrc: !!this.#audioB.src,
        },
      },
    }));
  }

  #normalizeSource(source) {
    if (typeof source === 'string') {
      return { url: source, loudnessDb: null };
    }

    if (source && typeof source === 'object') {
      const url = String(source.url || source.sourceUrl || source.src || '');
      const loudness = Number(source.loudnessDb);
      return {
        url,
        loudnessDb: Number.isFinite(loudness) ? loudness : null,
      };
    }

    return { url: '', loudnessDb: null };
  }

  #setDeckLoudness(deck, loudnessDb) {
    const safeDeck = deck === 'B' ? 'B' : 'A';
    const numeric = Number(loudnessDb);
    this.#deckLoudnessDb[safeDeck] = Number.isFinite(numeric) ? numeric : null;
  }

  #getDeckCompensation(deck) {
    const own = this.#deckLoudnessDb[deck];
    const otherDeck = deck === 'A' ? 'B' : 'A';
    const other = this.#deckLoudnessDb[otherDeck];
    if (!Number.isFinite(own) || !Number.isFinite(other)) return 1;

    const ownLin = Math.pow(10, own / 20);
    const otherLin = Math.pow(10, other / 20);
    if (!Number.isFinite(ownLin) || !Number.isFinite(otherLin) || ownLin <= 0 || otherLin <= 0) return 1;

    const rawOwnComp = 1 / ownLin;
    const rawOtherComp = 1 / otherLin;
    const maxComp = Math.max(rawOwnComp, rawOtherComp, 1e-6);
    return rawOwnComp / maxComp;
  }

  #applyDeckBaseMix(baseA, baseB) {
    if (!this.#audioA || !this.#audioB) return;
    const safeA = Math.max(0, Math.min(1, Number(baseA) || 0));
    const safeB = Math.max(0, Math.min(1, Number(baseB) || 0));
    const compA = this.#getDeckCompensation('A');
    const compB = this.#getDeckCompensation('B');

    this.#audioA.volume = Math.max(0, Math.min(1, safeA * compA));
    this.#audioB.volume = Math.max(0, Math.min(1, safeB * compB));
  }
}
