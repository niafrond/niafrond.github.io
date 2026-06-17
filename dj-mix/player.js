import {
  DEFAULT_TRANSITION_MODE,
  MIX_TRANSITION_MODE_LABELS,
  MIX_TRANSITION_MODES,
  normalizeTransitionMode,
} from './lib/transitionModes.js';
import {
  SimpleMixFeatures,
} from './lib/mixFeatures.js';
import { createLogger } from './lib/logger.js';

const logger = createLogger('player');
const logDebug = (event, payload) => logger.debug(event, payload);
const logInfo = (event, payload) => logger.info(event, payload);
const logWarn = (event, payload) => logger.warn(event, payload);
const logError = (event, payload) => logger.error(event, payload);

// Re-export for UI/main.js
export { MIX_TRANSITION_MODES, MIX_TRANSITION_MODE_LABELS };

// Au-delà de ce délai, load()->canplay ou play() sont considérés lents (réseau/decode) et loggés en warn.
const SLOW_AUDIO_LOAD_THRESHOLD_MS = 200;

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function createDefaultDeckFx() {
  return {
    A: { vocalRemove: false, instruRemove: false, filterMode: 'off' },
    B: { vocalRemove: false, instruRemove: false, filterMode: 'off' },
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
  // Lissages volume/mix-ratio/playbackRate: rAF + progression basée sur le temps écoulé
  // (plutôt qu'un compte de "ticks" setInterval) pour s'aligner sur le rafraîchissement
  // écran et s'auto-corriger si des frames sont sautées (onglet en arrière-plan).
  #manualMixRafId = null;
  #playbackRateRafIds = {
    A: null,
    B: null,
  };
  // Coalesce les multiples #emitDeckState() d'une même frame en un seul dispatch 'deckstate'.
  #emitDeckStateRafId = null;
  // Suivi des coupures audio (event 'waiting'/'stalled') pour diagnostiquer les soubresauts de lecture.
  #stallStartedAt = {
    A: null,
    B: null,
  };
  #underrunCounts = {
    A: 0,
    B: 0,
  };
  #deckMixRatio = 0;
  #transitionMode = DEFAULT_TRANSITION_MODE;
  #allowedTransitionModes = new Set(MIX_TRANSITION_MODES);
  #recentAutoTransitions = [];
  #deckSourceMeta = {
    A: null,
    B: null,
  };
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
  get transitionMode() { return this.#transitionMode; }

  static getTransitionModes() {
    return [...MIX_TRANSITION_MODES];
  }

  setAllowedTransitionModes(modes) {
    const incoming = Array.isArray(modes) ? modes : [];
    const nextAllowed = new Set(
      incoming
        .map((mode) => normalizeTransitionMode(mode))
        .filter((mode) => MIX_TRANSITION_MODES.includes(mode)),
    );

    if (!nextAllowed.size) {
      for (const mode of MIX_TRANSITION_MODES) {
        nextAllowed.add(mode);
      }
    }

    nextAllowed.add('auto');
    nextAllowed.add('cut_transition');
    this.#allowedTransitionModes = nextAllowed;
    this.#transitionMode = this.#resolveAllowedTransitionMode(this.#transitionMode);
  }

  getAllowedTransitionModes() {
    return [...this.#allowedTransitionModes];
  }

  setTransitionMode(mode) {
    this.#transitionMode = this.#resolveAllowedTransitionMode(mode);
  }

  async init() {
    this.#audioA = this.#createDeckAudio('A');
    this.#audioB = this.#createDeckAudio('B');

    this.#audioA.volume = 1;
    this.#audioB.volume = 0;

    this.#mixFeatures = new SimpleMixFeatures(this.#audioA, this.#audioB);
    await this.#mixFeatures.setEnabled(this.#mixFeatureSettings);

    this.#startTracking();
    this.#ready = true;
    this.#requestEmitDeckState();
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
    this.#deckSourceMeta[activeDeck] = normalized;
    this.#deckSourceMeta[inactiveDeck] = null;

    inactive.pause();
    inactive.currentTime = 0;
    inactive.src = '';

    this.#applyDeckBaseMix(activeDeck === 'A' ? 1 : 0, activeDeck === 'B' ? 1 : 0);
    this.#mixFeatures?.setDeckSourceMetadata(activeDeck, normalized);
    await this.#loadAndPlay(active, normalized.url);
    this.#requestEmitDeckState();
  }

  async playOnDeck(deck, source, options = {}) {
    const normalized = this.#normalizeSource(source);
    if (!normalized.url) throw new Error('Source audio manquante');
    const targetDeck = deck === 'B' ? 'B' : 'A';
    const audio = targetDeck === 'A' ? this.#audioA : this.#audioB;
    if (!audio) return;

    this.#setDeckLoudness(targetDeck, normalized.loudnessDb);
    this.#deckSourceMeta[targetDeck] = normalized;

    logInfo('deck.load.begin', {
      targetDeck,
      paused: options.paused === true,
      makeActive: options.makeActive === true,
      hasUrl: !!normalized.url,
    });

    this.#mixFeatures?.setDeckSourceMetadata(targetDeck, normalized);

    if (options.paused === true) {
      await this.#loadOnly(audio, normalized.url);
    } else {
      await this.#loadAndPlay(audio, normalized.url);
    }

    const preferredStartMs = Number.isFinite(normalized.startPositionMs) && normalized.startPositionMs > 0
      ? normalized.startPositionMs
      : (Number.isFinite(options.startPositionMs) && options.startPositionMs > 0
        ? options.startPositionMs
        : 0);

    if (preferredStartMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const durationMs = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration * 1000 : normalized.durationMs;
      const safeTargetMs = Number.isFinite(durationMs)
        ? Math.max(0, Math.min(durationMs, preferredStartMs))
        : Math.max(0, preferredStartMs);
      audio.currentTime = safeTargetMs / 1000;
    }

    if (options.makeActive === true) {
      this.#active = targetDeck;
      this.#crossfadeNotified = false;
      this.#trackEndNotified = false;
    }

    this.#requestEmitDeckState();
    logInfo('deck.load.done', {
      targetDeck,
      activeDeck: this.#active,
    });
  }

  pauseDeck(deck) {
    const audio = deck === 'B' ? this.#audioB : this.#audioA;
    audio?.pause();
    this.#requestEmitDeckState();
  }

  async resumeDeck(deck) {
    const audio = deck === 'B' ? this.#audioB : this.#audioA;
    if (!audio || !audio.src) return;
    await audio.play().catch(() => {});
    this.#requestEmitDeckState();
  }

  setDeckPlaybackRate(deck, rate) {
    const targetDeck = deck === 'B' ? 'B' : 'A';
    this.#smoothSetDeckPlaybackRate(targetDeck, rate, 180);
  }

  resetDeckPlaybackRate(deck) {
    this.setDeckPlaybackRate(deck, 1.0);
  }

  setDeckMixRatio(ratio, transitionMs = 140) {
    const safeRatio = Math.max(0, Math.min(1, Number(ratio) || 0));
    this.#smoothSetDeckMixRatio(safeRatio, transitionMs);
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
    const inactiveDeck = this.#active === 'A' ? 'B' : 'A';
    this.#smoothSetDeckPlaybackRate(inactiveDeck, active.playbackRate, 220);
  }

  setMixFeatures(settings) {
    this.#mixFeatureSettings = mergeMixFeatureSettings(this.#mixFeatureSettings, settings);

    if (this.#mixFeatures) {
      this.#mixFeatures.setEnabled(this.#mixFeatureSettings).catch(() => {
        // optional effects should never break playback
      });
    }
  }

  /**
   * Notify mixFeatures of updated stem URLs for an already-loaded deck.
   * Safe to call at any time; no-ops if the deck has no source.
   */
  updateDeckStems(deck, stems) {
    const safeDeck = deck === 'B' ? 'B' : 'A';
    const audio = safeDeck === 'A' ? this.#audioA : this.#audioB;
    const currentUrl = audio?.currentSrc || audio?.src || '';
    if (!currentUrl) return;
    this.#mixFeatures?.setDeckSourceMetadata(safeDeck, {
      url: currentUrl,
      stems: {
        vocalsUrl: typeof stems?.vocalsUrl === 'string' ? stems.vocalsUrl : '',
        instrumentalUrl: typeof stems?.instrumentalUrl === 'string' ? stems.instrumentalUrl : '',
        echoUrl: typeof stems?.echoUrl === 'string' ? stems.echoUrl : '',
        distortionUrl: typeof stems?.distortionUrl === 'string' ? stems.distortionUrl : '',
      },
    });
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
    const instant = options?.instant === true;
    const fadeMs = Math.max(40, Number(options.fadeMs) || 180);

    if (instant || this.#isCrossfading || wasPaused) {
      audio.currentTime = safeTargetMs / 1000;
      this.#requestEmitDeckState();
      return;
    }

    const initialVolume = Math.max(0, Math.min(1, audio.volume || 1));
    const floorVolume = Math.min(initialVolume, 0.08);

    await this.#fadeVolume(audio, initialVolume, floorVolume, fadeMs);
    audio.currentTime = safeTargetMs / 1000;
    await this.#fadeVolume(audio, floorVolume, initialVolume, fadeMs);
    this.#requestEmitDeckState();
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

    let overrideMs = null;
    let transitionOptions = {};
    if (typeof durationOverride === 'number') {
      overrideMs = durationOverride;
    } else if (durationOverride && typeof durationOverride === 'object') {
      transitionOptions = durationOverride;
    }

    if (overrideMs) {
      this.crossfadeDuration = overrideMs;
    }

    const requestedMode = normalizeTransitionMode(transitionOptions.mode || this.#transitionMode);
    const transitionStartPositionMs = Number(transitionOptions.startPositionMs);

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

    const computedMode = requestedMode === 'auto'
      ? this.#chooseAutoTransitionMode(fromDeck, normalized)
      : requestedMode;
    const effectiveMode = this.#resolveAllowedTransitionMode(computedMode);

    logInfo('crossfade.begin', {
      desiredDeck,
      fromDeck,
      toDeck,
      durationMs: this.#crossfadeDuration,
      requestedMode,
      effectiveMode,
      hasUrl: !!normalized.url,
    });

    this.dispatchEvent(new CustomEvent('transitionmode', {
      detail: {
        requestedMode,
        effectiveMode,
        fromDeck,
        toDeck,
      },
    }));

    // Capture current base mix levels before loading the new track so the
    // crossfade starts from the current slider position instead of jumping to 0.
    const compFrom = this.#getDeckCompensation(fromDeck);
    const compTo = this.#getDeckCompensation(toDeck);
    const startBaseFrom = compFrom > 0 ? Math.max(0, Math.min(1, from.volume / compFrom)) : 1;
    const startBaseTo = compTo > 0 ? Math.max(0, Math.min(1, to.volume / compTo)) : 0;

    try {
      this.#setDeckLoudness(toDeck, normalized.loudnessDb);
      this.#deckSourceMeta[toDeck] = normalized;
      this.#mixFeatures?.setDeckSourceMetadata(toDeck, normalized);
      
      await this.#loadAndPlay(to, normalized.url);

      const preferredStartMs = Number.isFinite(normalized.startPositionMs) && normalized.startPositionMs > 0
        ? normalized.startPositionMs
        : (Number.isFinite(transitionStartPositionMs) && transitionStartPositionMs > 0
          ? transitionStartPositionMs
          : 0);
      if (preferredStartMs > 0) {
        const durationMs = Number.isFinite(to.duration) && to.duration > 0 ? to.duration * 1000 : normalized.durationMs;
        const safeTargetMs = Number.isFinite(durationMs)
          ? Math.max(0, Math.min(durationMs, preferredStartMs))
          : Math.max(0, preferredStartMs);
        to.currentTime = safeTargetMs / 1000;
      }

      await this.#runTransitionMode({
        effectiveMode,
        fromDeck,
        toDeck,
        from,
        to,
        startBaseFrom,
        startBaseTo,
      });

      from.pause();
      from.currentTime = 0;
      from.src = '';
      this.#smoothSetDeckPlaybackRate(fromDeck, 1, 140);
      this.#smoothSetDeckPlaybackRate(toDeck, 1, 220);
      this.#setDeckLoudness(fromDeck, null);
      this.#deckSourceMeta[fromDeck] = null;

      this.#active = toDeck;
      this.#crossfadeNotified = false;
      this.#trackEndNotified = false;
      this.#requestEmitDeckState();
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

  #chooseAutoTransitionMode(fromDeck, nextSource) {
    const current = this.#deckSourceMeta[fromDeck] || {};
    const currFeatures = current.audioFeatures;
    const nextFeatures = nextSource?.audioFeatures;
    const bpmA = Number(currFeatures?.bpm || current.bpm);
    const bpmB = Number(nextFeatures?.bpm || nextSource?.bpm);
    const loudA = Number(current.loudnessDb);
    const loudB = Number(nextSource?.loudnessDb);
    const diffBpm = Number.isFinite(bpmA) && Number.isFinite(bpmB) ? Math.abs(bpmA - bpmB) : null;
    const diffLoud = Number.isFinite(loudA) && Number.isFinite(loudB) ? Math.abs(loudA - loudB) : null;
    const nextDurationMs = Number.isFinite(nextSource?.durationMs) ? nextSource.durationMs : null;

    const energyA = Number(currFeatures?.energy);
    const energyB = Number(nextFeatures?.energy);
    const diffEnergy = Number.isFinite(energyA) && Number.isFinite(energyB) ? Math.abs(energyA - energyB) : null;

    const danceA = Number(currFeatures?.danceability);
    const danceB = Number(nextFeatures?.danceability);
    const diffDance = Number.isFinite(danceA) && Number.isFinite(danceB) ? Math.abs(danceA - danceB) : null;

    const rhythmA = String(currFeatures?.rhythm || '');
    const rhythmB = String(nextFeatures?.rhythm || '');

    const currentDeckAudio = fromDeck === 'B' ? this.#audioB : this.#audioA;
    const remainingMs = currentDeckAudio && Number.isFinite(currentDeckAudio.duration) && currentDeckAudio.duration > 0
      ? Math.max(0, (currentDeckAudio.duration - currentDeckAudio.currentTime) * 1000)
      : null;

    if (Number.isFinite(nextDurationMs) && nextDurationMs < 95_000) {
      return this.#pickWeightedAutoTransition(['cut_transition']);
    }
    if (Number.isFinite(remainingMs) && remainingMs < 3_500) {
      return this.#pickWeightedAutoTransition(['echo_out_light', 'cut_transition', 'fade_in_out']);
    }
    if (rhythmA && rhythmB && rhythmA === rhythmB && Number.isFinite(diffBpm) && diffBpm <= 1) {
      return this.#pickWeightedAutoTransition(['crossfade_linear', 'crossfade_logarithmic', 'gain_automation']);
    }
    if (Number.isFinite(diffBpm) && diffBpm <= 2 && (!Number.isFinite(diffLoud) || diffLoud <= 2)) {
      return this.#pickWeightedAutoTransition(['crossfade_logarithmic', 'crossfade_linear', 'gain_automation', 'crossfade_lowpass']);
    }
    if (Number.isFinite(diffEnergy) && diffEnergy >= 0.35 && Number.isFinite(energyB) && energyB < 0.4) {
      return this.#pickWeightedAutoTransition(['fade_in_out', 'volume_ducking', 'echo_out_light']);
    }
    if (Number.isFinite(diffDance) && diffDance >= 0.3) {
      return this.#pickWeightedAutoTransition(['filter_sweep_low_high', 'filter_automation', 'filter_dual_sweep']);
    }
    if (Number.isFinite(diffBpm) && diffBpm <= 6) {
      return this.#pickWeightedAutoTransition(['filter_automation', 'eq_transition_simple', 'crossfade_lowpass', 'crossfade_highpass_in']);
    }
    if (Number.isFinite(diffEnergy) && diffEnergy >= 0.25) {
      return this.#pickWeightedAutoTransition(['eq_transition_simple', 'sidechain_basic', 'crossfade_highpass_in']);
    }
    if (Number.isFinite(diffBpm) && diffBpm <= 10) {
      return this.#pickWeightedAutoTransition(['sidechain_basic', 'eq_transition_simple', 'volume_ducking']);
    }
    if (Number.isFinite(diffLoud) && diffLoud >= 5) {
      return this.#pickWeightedAutoTransition(['volume_ducking', 'fade_in_out', 'gain_automation']);
    }
    if (Number.isFinite(diffBpm) && diffBpm >= 20) {
      return this.#pickWeightedAutoTransition(['brake_tape_stop_simple', 'backspin', 'fake_drop']);
    }
    if (Number.isFinite(danceA) && Number.isFinite(danceB) && danceA > 0.65 && danceB > 0.65) {
      return this.#pickWeightedAutoTransition(['short_loop', 'beat_repeat', 'kick_swap', 'bass_swap']);
    }

    return this.#pickWeightedAutoTransition(['gain_automation', 'crossfade_linear', 'crossfade_logarithmic', 'fade_in_out']);
  }

  #pickWeightedAutoTransition(candidates) {
    const MAX_HISTORY = 8;
    const allowed = this.#allowedTransitionModes;
    const eligible = candidates.filter((m) => allowed.has(m));
    if (eligible.length === 0) return candidates[0];
    if (eligible.length === 1) {
      this.#recordAutoTransition(eligible[0]);
      return eligible[0];
    }

    const recent = this.#recentAutoTransitions;
    const weights = eligible.map((mode) => {
      const lastIndex = recent.lastIndexOf(mode);
      if (lastIndex === -1) return 1;
      const recency = recent.length - lastIndex;
      return recency <= 1 ? 0.05 : recency <= 2 ? 0.15 : recency <= 3 ? 0.35 : 0.7;
    });

    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * totalWeight;
    for (let i = 0; i < eligible.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        this.#recordAutoTransition(eligible[i]);
        return eligible[i];
      }
    }

    const pick = eligible[eligible.length - 1];
    this.#recordAutoTransition(pick);
    return pick;
  }

  #recordAutoTransition(mode) {
    this.#recentAutoTransitions.push(mode);
    if (this.#recentAutoTransitions.length > 8) {
      this.#recentAutoTransitions.shift();
    }
  }

  #resolveAllowedTransitionMode(mode) {
    const safeMode = normalizeTransitionMode(mode);
    if (this.#allowedTransitionModes.has(safeMode)) {
      return safeMode;
    }

    if (safeMode === 'auto' && this.#allowedTransitionModes.size) {
      return 'auto';
    }

    const fallbackOrder = [
      'crossfade_linear',
      'crossfade_logarithmic',
      'fade_in_out',
      'cut_transition',
    ];

    for (const candidate of fallbackOrder) {
      if (this.#allowedTransitionModes.has(candidate)) {
        return candidate;
      }
    }

    return 'cut_transition';
  }

  async #runTransitionMode(context) {
    const mode = normalizeTransitionMode(context.effectiveMode);
    if (mode === 'cut_transition') {
      this.#runCutTransition(context);
      return;
    }

    const liveDuration = Math.max(250, Number(this.#crossfadeDuration) || 5000);
    const startEcho = this.#mixFeatureSettings.echo;
    const savedFromFilterMode = this.#mixFeatureSettings.deckFx?.[context.fromDeck]?.filterMode || 'off';
    const savedToFilterMode = this.#mixFeatureSettings.deckFx?.[context.toDeck]?.filterMode || 'off';

    if (mode === 'echo_out_light' && !startEcho) {
      this.setMixFeatures({ echo: true });
    }
    if (mode === 'reverb_short_simple' && !this.#mixFeatureSettings.distortion) {
      this.setMixFeatures({ distortion: true });
    }
    // Pour les modes qui activent un filtre Web Audio, s'assurer que l'AudioContext
    // est créé et en cours d'exécution avant d'appeler setMixFeatures (qui est async non-awaité).
    const NEEDS_AUDIO_CTX = new Set([
      'crossfade_lowpass', 'crossfade_highpass_in', 'filter_dual_sweep', 'echo_lowpass',
      'bass_swap', 'kick_swap', 'echo_freeze',
    ]);
    if (NEEDS_AUDIO_CTX.has(mode) && this.#mixFeatures) {
      await this.#mixFeatures.ensureReady();
    }

    if (mode === 'crossfade_lowpass' && savedFromFilterMode !== 'lowPass') {
      this.setMixFeatures({ deckFx: { [context.fromDeck]: { filterMode: 'lowPass' } } });
    }
    if (mode === 'crossfade_highpass_in' && savedToFilterMode !== 'highPass') {
      this.setMixFeatures({ deckFx: { [context.toDeck]: { filterMode: 'highPass' } } });
    }
    if (mode === 'filter_dual_sweep') {
      if (savedFromFilterMode !== 'lowPass') {
        this.setMixFeatures({ deckFx: { [context.fromDeck]: { filterMode: 'lowPass' } } });
      }
      if (savedToFilterMode !== 'highPass') {
        this.setMixFeatures({ deckFx: { [context.toDeck]: { filterMode: 'highPass' } } });
      }
    }
    if (mode === 'echo_lowpass') {
      if (!startEcho) this.setMixFeatures({ echo: true });
      if (savedFromFilterMode !== 'lowPass') {
        this.setMixFeatures({ deckFx: { [context.fromDeck]: { filterMode: 'lowPass' } } });
      }
    }
    if (mode === 'bass_swap') {
      if (savedFromFilterMode !== 'highPass') {
        this.setMixFeatures({ deckFx: { [context.fromDeck]: { filterMode: 'highPass' } } });
      }
      if (savedToFilterMode !== 'lowPass') {
        this.setMixFeatures({ deckFx: { [context.toDeck]: { filterMode: 'lowPass' } } });
      }
    }
    if (mode === 'kick_swap' && savedFromFilterMode !== 'lowPass') {
      this.setMixFeatures({ deckFx: { [context.fromDeck]: { filterMode: 'lowPass' } } });
    }
    if (mode === 'echo_freeze' && !startEcho) {
      this.setMixFeatures({ echo: true });
    }

    try {
      await new Promise((resolve) => {
        let progress = 0;
        let lastTickAt = performance.now();
        let loopAnchor = context.to.currentTime || 0;
        let loopAnchorFrom = context.from.currentTime || 0;

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
          progress = Math.min(1, progress + (elapsedMs / liveDuration));

          const levels = this.#computeTransitionLevels(mode, progress, context.startBaseFrom, context.startBaseTo);
          let fromBase = levels.from;
          let toBase = levels.to;

          if (mode === 'short_loop' && progress < 0.45 && Number.isFinite(context.to.currentTime)) {
            const loopLen = 0.85;
            if ((context.to.currentTime - loopAnchor) > loopLen) {
              context.to.currentTime = loopAnchor;
            }
          }

          if (mode === 'short_reverse' && progress < 0.18 && Number.isFinite(context.from.currentTime) && context.from.currentTime > 0.18) {
            context.from.currentTime = Math.max(0, context.from.currentTime - 0.045);
          }

          // Retire le high-pass du deck entrant à mi-transition pour laisser ouvrir le spectre
          if ((mode === 'crossfade_highpass_in' || mode === 'filter_dual_sweep') && progress >= 0.6) {
            if (this.#mixFeatureSettings.deckFx?.[context.toDeck]?.filterMode === 'highPass') {
              this.setMixFeatures({ deckFx: { [context.toDeck]: { filterMode: 'off' } } });
            }
          }

          // bass_swap : retire le lowpass du deck entrant à 50% pour ouvrir le spectre complet
          if (mode === 'bass_swap' && progress >= 0.5) {
            if (this.#mixFeatureSettings.deckFx?.[context.toDeck]?.filterMode === 'lowPass') {
              this.setMixFeatures({ deckFx: { [context.toDeck]: { filterMode: 'off' } } });
            }
          }

          // beat_repeat : boucle le deck sortant avec une longueur qui rétrécit progressivement
          if (mode === 'beat_repeat' && progress < 0.65 && Number.isFinite(context.from.currentTime)) {
            const loopLen = Math.max(0.1, Math.pow(1 - (progress / 0.65), 1.5));
            if ((context.from.currentTime - loopAnchorFrom) >= loopLen) {
              context.from.currentTime = loopAnchorFrom;
            }
          }

          if (mode === 'brake_tape_stop_simple') {
            context.from.playbackRate = Math.max(0.2, 1 - (0.85 * progress));
            context.to.playbackRate = Math.min(1, 0.9 + (0.1 * progress));
          } else if (mode === 'backspin') {
            // Décélération rapide jusqu'à l'arrêt complet
            context.from.playbackRate = progress < 0.35
              ? Math.max(0.04, 1 - Math.pow(progress / 0.35, 0.55))
              : 0;
            context.to.playbackRate += (1 - context.to.playbackRate) * 0.18;
          } else if (mode === 'filter_sweep_low_high' || mode === 'filter_automation') {
            context.from.playbackRate = Math.max(0.86, 1 - (0.16 * progress));
            context.to.playbackRate = Math.max(0.9, 1.08 - (0.18 * progress));
          } else {
            context.from.playbackRate += (1 - context.from.playbackRate) * 0.18;
            context.to.playbackRate += (1 - context.to.playbackRate) * 0.18;
          }

          fromBase = clamp01(fromBase);
          toBase = clamp01(toBase);

          if (context.fromDeck === 'A') {
            this.#applyDeckBaseMix(fromBase, toBase);
          } else {
            this.#applyDeckBaseMix(toBase, fromBase);
          }

          this.#requestEmitDeckState();
          this.dispatchEvent(new CustomEvent('crossfadeprogress', {
            detail: {
              fromDeck: context.fromDeck,
              fromVolume: fromBase,
              toVolume: toBase,
              toPosition: Number.isFinite(context.to.currentTime) ? context.to.currentTime * 1000 : 0,
              toDuration: Number.isFinite(context.to.duration) && context.to.duration > 0 ? context.to.duration * 1000 : 0,
              durationMs: liveDuration,
              progress,
              mode,
            },
          }));

          if (progress >= 1) {
            clearInterval(this.#crossfadeInterval);
            this.#crossfadeInterval = null;
            resolve();
          }
        }, 30);
      });
    } finally {
      if (mode === 'echo_out_light' && !startEcho) {
        this.setMixFeatures({ echo: false });
      }
      if (mode === 'echo_lowpass' && !startEcho) {
        this.setMixFeatures({ echo: false });
      }
      if (mode === 'crossfade_lowpass' || mode === 'filter_dual_sweep' || mode === 'echo_lowpass') {
        this.setMixFeatures({ deckFx: { [context.fromDeck]: { filterMode: savedFromFilterMode } } });
      }
      if (mode === 'crossfade_highpass_in' || mode === 'filter_dual_sweep') {
        this.setMixFeatures({ deckFx: { [context.toDeck]: { filterMode: savedToFilterMode } } });
      }
      if (mode === 'bass_swap') {
        this.setMixFeatures({ deckFx: { [context.fromDeck]: { filterMode: savedFromFilterMode } } });
        this.setMixFeatures({ deckFx: { [context.toDeck]: { filterMode: savedToFilterMode } } });
      }
      if (mode === 'kick_swap') {
        this.setMixFeatures({ deckFx: { [context.fromDeck]: { filterMode: savedFromFilterMode } } });
      }
      if (mode === 'echo_freeze' && !startEcho) {
        this.setMixFeatures({ echo: false });
      }
      this.#smoothSetDeckPlaybackRate(context.fromDeck, 1, 160);
      this.#smoothSetDeckPlaybackRate(context.toDeck, 1, 220);
    }
  }

  #runCutTransition(context) {
    const fromBase = 0;
    const toBase = 1;
    if (context.fromDeck === 'A') {
      this.#applyDeckBaseMix(fromBase, toBase);
    } else {
      this.#applyDeckBaseMix(toBase, fromBase);
    }

    this.#requestEmitDeckState();
    this.dispatchEvent(new CustomEvent('crossfadeprogress', {
      detail: {
        fromDeck: context.fromDeck,
        fromVolume: fromBase,
        toVolume: toBase,
        toPosition: Number.isFinite(context.to.currentTime) ? context.to.currentTime * 1000 : 0,
        toDuration: Number.isFinite(context.to.duration) && context.to.duration > 0 ? context.to.duration * 1000 : 0,
        durationMs: 80,
        progress: 1,
        mode: 'cut_transition',
      },
    }));
  }

  #computeTransitionLevels(mode, t, startBaseFrom, startBaseTo) {
    const clampedT = clamp01(t);
    const linearFrom = startBaseFrom * (1 - clampedT);
    const linearTo = startBaseTo + ((1 - startBaseTo) * clampedT);
    
    switch (mode) {
      case 'crossfade_linear': {
        return { from: linearFrom, to: linearTo };
      }
      case 'crossfade_logarithmic': {
        const from = startBaseFrom * Math.cos((Math.PI / 2) * clampedT);
        const to = startBaseTo + ((1 - startBaseTo) * Math.sin((Math.PI / 2) * clampedT));
        return { from, to };
      }
      case 'fade_in_out': {
        if (clampedT < 0.52) {
          const phase = clampedT / 0.52;
          return { from: startBaseFrom * (1 - phase), to: startBaseTo * 0.25 };
        }
        const phase = (clampedT - 0.52) / 0.48;
        return { from: 0, to: startBaseTo + ((1 - startBaseTo) * phase) };
      }
      case 'filter_sweep_low_high': {
        const eased = Math.sqrt(clampedT);
        return {
          from: startBaseFrom * (1 - eased),
          to: startBaseTo + ((1 - startBaseTo) * (0.85 * eased + 0.15 * clampedT)),
        };
      }
      case 'eq_transition_simple': {
        const from = startBaseFrom * (1 - (0.82 * clampedT));
        const to = startBaseTo + ((1 - startBaseTo) * Math.pow(clampedT, 1.2));
        return { from, to };
      }
      case 'echo_out_light': {
        return {
          from: Math.max(0.06, startBaseFrom * (1 - clampedT)),
          to: startBaseTo + ((1 - startBaseTo) * Math.pow(clampedT, 1.05)),
        };
      }
      case 'reverb_short_simple': {
        const from = clampedT < 0.8
          ? Math.max(0.1, startBaseFrom * (1 - (0.92 * clampedT)))
          : startBaseFrom * (1 - clampedT);
        const to = startBaseTo + ((1 - startBaseTo) * Math.pow(clampedT, 1.3));
        return { from, to };
      }
      case 'short_loop': {
        const pulse = 0.85 + (0.15 * Math.abs(Math.sin(clampedT * Math.PI * 6)));
        return {
          from: startBaseFrom * (1 - clampedT),
          to: (startBaseTo + ((1 - startBaseTo) * clampedT)) * pulse,
        };
      }
      case 'brake_tape_stop_simple': {
        const drag = Math.pow(clampedT, 1.6);
        return {
          from: startBaseFrom * (1 - drag),
          to: startBaseTo + ((1 - startBaseTo) * Math.pow(clampedT, 1.1)),
        };
      }
      case 'short_reverse': {
        const wobble = 1 - (0.18 * Math.sin(clampedT * Math.PI * 7));
        return {
          from: startBaseFrom * (1 - clampedT) * wobble,
          to: startBaseTo + ((1 - startBaseTo) * clampedT),
        };
      }
      case 'sidechain_basic': {
        const pump = 1 - (0.25 * Math.max(0, Math.sin(clampedT * Math.PI * 8)));
        return {
          from: linearFrom,
          to: linearTo * pump,
        };
      }
      case 'volume_ducking': {
        const duck = clampedT < 0.4
          ? (1 - (0.7 * (clampedT / 0.4)))
          : (0.3 - (0.3 * ((clampedT - 0.4) / 0.6)));
        return {
          from: startBaseFrom * Math.max(0, duck),
          to: linearTo,
        };
      }
      case 'gain_automation': {
        return {
          from: startBaseFrom * (1 - Math.pow(clampedT, 1.8)),
          to: startBaseTo + ((1 - startBaseTo) * Math.pow(clampedT, 1.45)),
        };
      }
      case 'filter_automation': {
        const sweep = 0.5 - (0.5 * Math.cos(Math.PI * clampedT));
        return {
          from: startBaseFrom * (1 - sweep),
          to: startBaseTo + ((1 - startBaseTo) * sweep),
        };
      }
      case 'crossfade_lowpass': {
        const from = startBaseFrom * Math.cos((Math.PI / 2) * clampedT);
        const to = startBaseTo + ((1 - startBaseTo) * Math.sin((Math.PI / 2) * clampedT));
        return { from, to };
      }
      case 'crossfade_highpass_in': {
        return { from: linearFrom, to: linearTo };
      }
      case 'filter_dual_sweep': {
        const sweep = 0.5 - (0.5 * Math.cos(Math.PI * clampedT));
        return {
          from: startBaseFrom * (1 - sweep),
          to: startBaseTo + ((1 - startBaseTo) * sweep),
        };
      }
      case 'echo_lowpass': {
        return {
          from: Math.max(0.08, startBaseFrom * (1 - clampedT)),
          to: startBaseTo + ((1 - startBaseTo) * Math.pow(clampedT, 1.08)),
        };
      }
      case 'bass_swap': {
        // fromDeck (highpass = sans basses) fade en courbe log ; toDeck (lowpass = basses d'abord) entre en miroir
        const from = startBaseFrom * Math.cos((Math.PI / 2) * Math.pow(clampedT, 0.85));
        const to = startBaseTo + ((1 - startBaseTo) * Math.pow(clampedT, 0.85));
        return { from, to };
      }
      case 'kick_swap': {
        // fromDeck (lowpass = kick muffled) fade en S ; toDeck entre seulement à partir de 30%
        const sweep = 0.5 - (0.5 * Math.cos(Math.PI * clampedT));
        const toProgress = clampedT < 0.3 ? 0 : (clampedT - 0.3) / 0.7;
        return {
          from: startBaseFrom * (1 - sweep),
          to: startBaseTo + ((1 - startBaseTo) * toProgress),
        };
      }
      case 'beat_repeat': {
        // fromDeck reste au volume plein pendant la boucle (65%), puis toDeck entre en hard
        if (clampedT < 0.65) {
          return { from: startBaseFrom, to: startBaseTo * 0.05 };
        }
        const phase = (clampedT - 0.65) / 0.35;
        return {
          from: startBaseFrom * (1 - phase),
          to: startBaseTo + ((1 - startBaseTo) * phase),
        };
      }
      case 'backspin': {
        // Phase 1 : fromDeck décélère et s'arrête ; Phase 2 : silence ; Phase 3 : toDeck hard entry
        if (clampedT < 0.35) {
          return { from: startBaseFrom * (1 - Math.pow(clampedT / 0.35, 0.65)), to: 0 };
        }
        if (clampedT < 0.5) {
          return { from: 0, to: 0 };
        }
        return { from: 0, to: startBaseTo + ((1 - startBaseTo) * ((clampedT - 0.5) / 0.5)) };
      }
      case 'fake_drop': {
        // fromDeck fade rapide → silence complet → toDeck entre avec impact brutal
        if (clampedT < 0.35) {
          return { from: startBaseFrom * (1 - (clampedT / 0.35)), to: 0 };
        }
        if (clampedT < 0.55) {
          return { from: 0, to: 0 };
        }
        return {
          from: 0,
          to: startBaseTo + ((1 - startBaseTo) * Math.min(1, (clampedT - 0.55) / 0.12)),
        };
      }
      case 'echo_freeze': {
        // fromDeck maintenu avec plancher d'écho jusqu'à 65%, puis fade ; toDeck entre après 45%
        const from = clampedT < 0.65
          ? Math.max(0.12, startBaseFrom * (1 - (0.78 * clampedT)))
          : Math.max(0, startBaseFrom * (1 - clampedT) * 2.86);
        const toProgress = clampedT < 0.45 ? 0 : Math.pow((clampedT - 0.45) / 0.55, 0.8);
        return { from, to: startBaseTo + ((1 - startBaseTo) * Math.min(1, toProgress)) };
      }
      default: {
        return { from: linearFrom, to: linearTo };
      }
    }
  }

  activateElement() {
    // No-op for HTMLAudioElement based playback.
  }

  destroy() {
    this.#destroyed = true;
    clearInterval(this.#trackInterval);
    clearInterval(this.#crossfadeInterval);
    this.#crossfadeInterval = null;

    if (this.#manualMixRafId !== null) {
      cancelAnimationFrame(this.#manualMixRafId);
      this.#manualMixRafId = null;
    }
    for (const deck of ['A', 'B']) {
      if (this.#playbackRateRafIds[deck] !== null) {
        cancelAnimationFrame(this.#playbackRateRafIds[deck]);
        this.#playbackRateRafIds[deck] = null;
      }
    }
    if (this.#emitDeckStateRafId !== null) {
      cancelAnimationFrame(this.#emitDeckStateRafId);
      this.#emitDeckStateRafId = null;
    }

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
      const stallStartedAt = this.#stallStartedAt[deck];
      if (stallStartedAt !== null) {
        this.#stallStartedAt[deck] = null;
        logInfo('audio.underrun.recovered', {
          deck,
          stallDurationMs: Math.round(performance.now() - stallStartedAt),
        });
      }
      this.#requestEmitDeckState();
      if ((deck === 'A' && this.#active !== 'A') || (deck === 'B' && this.#active !== 'B')) return;
      this.dispatchEvent(new CustomEvent('statechange', {
        detail: { paused: false, track: null },
      }));
    });

    audio.addEventListener('pause', () => {
      this.#requestEmitDeckState();
      if ((deck === 'A' && this.#active !== 'A') || (deck === 'B' && this.#active !== 'B')) return;
      this.dispatchEvent(new CustomEvent('statechange', {
        detail: { paused: true, track: null },
      }));
    });

    // 'waiting' = lecture suspendue car le buffer est vide (underrun). Sur deck inactif,
    // c'est normal (pas de data preloadée) ; on ne logge que le deck actif en lecture.
    audio.addEventListener('waiting', () => {
      if (audio.paused) return;
      this.#stallStartedAt[deck] = performance.now();
      this.#underrunCounts[deck] += 1;
      logWarn('audio.underrun.waiting', {
        deck,
        count: this.#underrunCounts[deck],
        positionMs: Number.isFinite(audio.currentTime) ? audio.currentTime * 1000 : 0,
        readyState: audio.readyState,
      });
    });

    // 'stalled' = le navigateur attend des données réseau (connexion lente/coupée).
    audio.addEventListener('stalled', () => {
      if (audio.paused) return;
      logWarn('audio.underrun.stalled', {
        deck,
        positionMs: Number.isFinite(audio.currentTime) ? audio.currentTime * 1000 : 0,
        readyState: audio.readyState,
      });
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

    const loadStartedAt = performance.now();
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
    const canPlayMs = performance.now() - loadStartedAt;

    const playStartedAt = performance.now();
    await audio.play();
    const playMs = performance.now() - playStartedAt;

    const isSlow = canPlayMs > SLOW_AUDIO_LOAD_THRESHOLD_MS || playMs > SLOW_AUDIO_LOAD_THRESHOLD_MS;
    (isSlow ? logWarn : logDebug)('audio.loadAndPlay.started', {
      srcPreview: String(sourceUrl || '').slice(0, 96),
      canPlayMs: Math.round(canPlayMs),
      playMs: Math.round(playMs),
    });
  }

  async #loadOnly(audio, sourceUrl) {
    audio.pause();
    audio.currentTime = 0;
    audio.src = sourceUrl;

    const loadStartedAt = performance.now();
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
    const canPlayMs = performance.now() - loadStartedAt;

    (canPlayMs > SLOW_AUDIO_LOAD_THRESHOLD_MS ? logWarn : logDebug)('audio.loadOnly.primed', {
      srcPreview: String(sourceUrl || '').slice(0, 96),
      canPlayMs: Math.round(canPlayMs),
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

      this.#mixFeatures?.tick(this.#active);

      // Skip event emission when paused (big RAM/CPU win between tracks)
      if (active.paused && !this.#isCrossfading) return;

      this.dispatchEvent(new CustomEvent('progress', {
        detail: {
          position,
          duration,
          remaining,
          paused: active.paused,
        },
      }));

      this.#requestEmitDeckState();

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

  #smoothSetDeckPlaybackRate(deck, targetRate, durationMs = 180) {
    const targetDeck = deck === 'B' ? 'B' : 'A';
    const audio = targetDeck === 'B' ? this.#audioB : this.#audioA;
    if (!audio) return;

    const safeTarget = Math.max(0.5, Math.min(2.0, Number(targetRate) || 1));
    const fromRate = Math.max(0.5, Math.min(2.0, Number(audio.playbackRate) || 1));
    const intervalKey = targetDeck;

    if (this.#playbackRateRafIds[intervalKey] !== null) {
      cancelAnimationFrame(this.#playbackRateRafIds[intervalKey]);
      this.#playbackRateRafIds[intervalKey] = null;
    }

    if (durationMs <= 0 || Math.abs(fromRate - safeTarget) < 0.001) {
      audio.playbackRate = safeTarget;
      this.#requestEmitDeckState();
      return;
    }

    const ms = Math.max(32, Number(durationMs) || 180);
    const startedAt = performance.now();

    const step = (now) => {
      const currentAudio = intervalKey === 'B' ? this.#audioB : this.#audioA;
      if (this.#destroyed || !currentAudio) {
        this.#playbackRateRafIds[intervalKey] = null;
        return;
      }

      const t = Math.min(1, (now - startedAt) / ms);
      if (t >= 1) {
        currentAudio.playbackRate = safeTarget;
        this.#playbackRateRafIds[intervalKey] = null;
      } else {
        const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        currentAudio.playbackRate = fromRate + ((safeTarget - fromRate) * eased);
        this.#playbackRateRafIds[intervalKey] = requestAnimationFrame(step);
      }
      this.#requestEmitDeckState();
    };

    this.#playbackRateRafIds[intervalKey] = requestAnimationFrame(step);
  }

  #smoothSetDeckVolumes(targetA, targetB, durationMs) {
    if (this.#manualMixRafId !== null) {
      cancelAnimationFrame(this.#manualMixRafId);
      this.#manualMixRafId = null;
    }

    if (!this.#audioA || !this.#audioB) return;

    const fromA = this.#audioA.volume || 0;
    const fromB = this.#audioB.volume || 0;
    const ms = Math.max(16, Number(durationMs) || 140);
    const startedAt = performance.now();

    const step = (now) => {
      if (this.#destroyed || !this.#audioA || !this.#audioB) {
        this.#manualMixRafId = null;
        return;
      }

      const t = Math.min(1, (now - startedAt) / ms);
      const nextA = Math.max(0, Math.min(1, fromA + ((targetA - fromA) * t)));
      const nextB = Math.max(0, Math.min(1, fromB + ((targetB - fromB) * t)));
      this.#applyDeckBaseMix(nextA, nextB);
      this.#deckMixRatio = this.#mixRatioFromGains(nextA, nextB);
      this.#requestEmitDeckState();

      if (t >= 1) {
        this.#manualMixRafId = null;
      } else {
        this.#manualMixRafId = requestAnimationFrame(step);
      }
    };

    this.#manualMixRafId = requestAnimationFrame(step);
  }

  #smoothSetDeckMixRatio(targetRatio, durationMs) {
    if (this.#manualMixRafId !== null) {
      cancelAnimationFrame(this.#manualMixRafId);
      this.#manualMixRafId = null;
    }

    if (!this.#audioA || !this.#audioB) return;

    const fromRatio = Math.max(0, Math.min(1, Number(this.#deckMixRatio) || 0));
    const toRatio = Math.max(0, Math.min(1, Number(targetRatio) || 0));
    const ms = Math.max(16, Number(durationMs) || 140);
    const startedAt = performance.now();

    const step = (now) => {
      if (this.#destroyed || !this.#audioA || !this.#audioB) {
        this.#manualMixRafId = null;
        return;
      }

      const t = Math.min(1, (now - startedAt) / ms);
      const ratio = fromRatio + ((toRatio - fromRatio) * t);
      const gains = this.#equalPowerGainsFromRatio(ratio);

      this.#applyDeckBaseMix(gains.a, gains.b);
      this.#deckMixRatio = ratio;
      this.#requestEmitDeckState();

      if (t >= 1) {
        this.#manualMixRafId = null;
      } else {
        this.#manualMixRafId = requestAnimationFrame(step);
      }
    };

    this.#manualMixRafId = requestAnimationFrame(step);
  }

  #equalPowerGainsFromRatio(ratio) {
    const safeRatio = Math.max(0, Math.min(1, Number(ratio) || 0));
    return {
      a: Math.cos((Math.PI / 2) * safeRatio),
      b: Math.sin((Math.PI / 2) * safeRatio),
    };
  }

  #mixRatioFromGains(gainA, gainB) {
    const safeA = Math.max(0, Number(gainA) || 0);
    const safeB = Math.max(0, Number(gainB) || 0);
    const angle = Math.atan2(safeB, safeA);
    return Math.max(0, Math.min(1, angle / (Math.PI / 2)));
  }

  // Demande l'émission de 'deckstate' au prochain rAF. Si plusieurs lissages/loops
  // demandent un emit pour la même frame, un seul CustomEvent est dispatché (réduit GC/UI churn).
  #requestEmitDeckState() {
    if (this.#emitDeckStateRafId !== null) return;
    this.#emitDeckStateRafId = requestAnimationFrame(() => {
      this.#emitDeckStateRafId = null;
      if (this.#destroyed) return;
      this.#emitDeckState();
    });
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
      return {
        url: source,
        loudnessDb: null,
        bpm: null,
        durationMs: null,
        audioFeatures: null,
        stems: { vocalsUrl: '', instrumentalUrl: '', echoUrl: '', distortionUrl: '' },
      };
    }

    if (source && typeof source === 'object') {
      const url = String(source.url || source.sourceUrl || source.src || '');
      const loudness = Number(source.loudnessDb);
      const bpm = Number(source.bpm);
      const durationMs = Number(source.durationMs);
      const startPositionMs = Number(source.startPositionMs);
      const audioFeatures = source.audioFeatures && typeof source.audioFeatures === 'object'
        ? source.audioFeatures
        : null;
      const stems = {
        vocalsUrl: typeof source?.stems?.vocalsUrl === 'string' ? source.stems.vocalsUrl : '',
        instrumentalUrl: typeof source?.stems?.instrumentalUrl === 'string' ? source.stems.instrumentalUrl : '',
        echoUrl: typeof source?.stems?.echoUrl === 'string' ? source.stems.echoUrl : '',
        distortionUrl: typeof source?.stems?.distortionUrl === 'string' ? source.stems.distortionUrl : '',
      };
      return {
        url,
        loudnessDb: Number.isFinite(loudness) ? loudness : null,
        bpm: Number.isFinite(bpm) ? bpm : null,
        durationMs: Number.isFinite(durationMs) && durationMs > 0 ? durationMs : null,
        startPositionMs: Number.isFinite(startPositionMs) && startPositionMs > 0 ? startPositionMs : null,
        audioFeatures,
        stems,
      };
    }

    return {
      url: '',
      loudnessDb: null,
      bpm: null,
      durationMs: null,
      startPositionMs: null,
      audioFeatures: null,
      stems: { vocalsUrl: '', instrumentalUrl: '', echoUrl: '', distortionUrl: '' },
    };
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

    let nextA;
    let nextB;

    if (safeA > 0 && safeB > 0) {
      // Use a shared compensation factor so the A/B ratio remains exact
      // for any slider position, including while smoothing.
      const sharedComp = Math.max(0, Math.min(compA, compB, 1));
      nextA = Math.max(0, Math.min(1, safeA * sharedComp));
      nextB = Math.max(0, Math.min(1, safeB * sharedComp));
    } else {
      nextA = Math.max(0, Math.min(1, safeA * compA));
      nextB = Math.max(0, Math.min(1, safeB * compB));
    }

    this.#audioA.volume = nextA;
    this.#audioB.volume = nextB;
  }
}
