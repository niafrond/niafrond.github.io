import {
  DEFAULT_TRANSITION_MODE,
  MIX_TRANSITION_MODE_LABELS,
  MIX_TRANSITION_MODES,
  normalizeTransitionMode,
} from './lib/transitionModes.js';
import {
  SimpleMixFeatures,
} from './lib/mixFeatures.js';
import {
  BEAT_REPEAT_DEFAULT_INITIAL_BEATS,
  BEAT_REPEAT_FALLBACK_INITIAL_BEATS,
  BEAT_REPEAT_MIN_INITIAL_BEATS,
  BEAT_REPEAT_BEATS_PER_BAR,
  BEAT_REPEAT_FX_STAGE_COUNT,
  getSafeBeatRepeatBpm,
  chooseInitialLoopBeats,
  buildBeatRepeatStageBeats,
  computeBeatRepeatLaunchBeats,
  computeBeatRepeatLoopPhaseMs,
  computeLoopAnchorSeconds,
  computeBeatRepeatStepProgress,
  computeBeatRepeatFinalStagePitchRatio,
  computeBeatRepeatHalfStageIndex,
  computeBeatRepeatElapsedBeatsAtStageStart,
  BeatRepeatEngine,
} from './lib/beatRepeatEngine.js';
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

// short_loop ne doit jamais ré-ancrer la piste entrante plus de SHORT_LOOP_MAX_REPEATS fois :
// au-delà, la lecture continue normalement (sans nouveau seek arrière) même si progress < 0.45.
export const SHORT_LOOP_MAX_REPEATS = 3;
const SHORT_LOOP_LENGTH_SEC = 0.85;

// GIVEN la piste entrante en cours de bouclage (short_loop) — WHEN elle dépasse
// SHORT_LOOP_LENGTH_SEC depuis loopAnchorSec — THEN elle doit être ré-ancrée, sauf si
// SHORT_LOOP_MAX_REPEATS répétitions ont déjà eu lieu.
export function shouldResetShortLoop(currentDeckTimeSec, loopAnchorSec, repeatCount) {
  if (repeatCount >= SHORT_LOOP_MAX_REPEATS) return false;
  if (!Number.isFinite(currentDeckTimeSec)) return false;
  return (currentDeckTimeSec - loopAnchorSec) > SHORT_LOOP_LENGTH_SEC;
}

// Re-export for main.js's decorative stutter-FX sync + tests.
export {
  BEAT_REPEAT_DEFAULT_INITIAL_BEATS,
  BEAT_REPEAT_FALLBACK_INITIAL_BEATS,
  BEAT_REPEAT_MIN_INITIAL_BEATS,
  BEAT_REPEAT_BEATS_PER_BAR,
  BEAT_REPEAT_FX_STAGE_COUNT,
  getSafeBeatRepeatBpm,
  chooseInitialLoopBeats,
  buildBeatRepeatStageBeats,
  computeBeatRepeatLaunchBeats,
  computeBeatRepeatLoopPhaseMs,
};

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

// Nominal cadence of the crossfade tick loop (see #crossfadeInterval's setInterval(..., 30)).
// Background tabs get their setInterval throttled by the browser (sometimes to ~1 tick/s or
// less), which would otherwise starve the per-tick playbackRate easing below and leave a deck's
// tempo stuck away from its target for the whole time the app stays backgrounded. Scaling the
// easing factor by the real elapsed time since the last tick keeps convergence tied to wall-clock
// time instead of tick count, so it lands on the same curve regardless of throttling.
export const CROSSFADE_RATE_EASE_TICK_MS = 30;
export function timeCorrectedRateEase(perTickFactor, elapsedMs) {
  return 1 - Math.pow(1 - perTickFactor, Math.max(0, elapsedMs) / CROSSFADE_RATE_EASE_TICK_MS);
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
  // Longueur initiale (en temps) du loop capturé par le mode beat_repeat avant raccourcissement
  // progressif — configurable indépendamment de crossfadeDuration (SPEC-1.3.8). C'est la
  // valeur "souhaitée" ; le runway réel avant fin de piste peut la réduire (step 2).
  #beatRepeatInitialBeats = BEAT_REPEAT_DEFAULT_INITIAL_BEATS;
  #beatRepeatEngine = new BeatRepeatEngine();
  // Runs only for the tail of the transition (see #startBeatRepeatIncomingLoop) so the incoming
  // deck is also audibly stuttering by the time of the final cut, instead of sitting silent
  // under the outgoing deck's loop for the whole phase.
  #beatRepeatEngineIncoming = new BeatRepeatEngine();
  #isCrossfading = false;
  #crossfadeNotified = false;
  #trackEndNotified = false;
  #trackInterval = null;
  #crossfadeInterval = null;
  // Callback qui résout immédiatement la Promise de #runTransitionMode/#runBeatRepeatTransition
  // en cours, posé le temps que dure la transition — permet à cancelActiveTransition() de
  // l'interrompre proprement sans dupliquer la logique de nettoyage des `finally` existants.
  #crossfadeFinishFn = null;
  // Distingue une fin de transition normale d'une annulation manuelle (slider de mix bougé
  // par l'utilisateur pendant une transition auto) : crossfadeToDeck() saute alors le handoff
  // définitif (pause/clear de la platine sortante) pour laisser les deux platines audibles.
  #crossfadeCancelledByUser = false;
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
  #globalVolume = 1;
  #lastBaseMix = { A: 1, B: 0 };
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

  get beatRepeatInitialBeats() { return this.#beatRepeatInitialBeats; }
  set beatRepeatInitialBeats(beats) {
    const value = Number(beats);
    this.#beatRepeatInitialBeats = Number.isFinite(value) && value > 0 ? value : BEAT_REPEAT_DEFAULT_INITIAL_BEATS;
  }

  get isCrossfading() { return this.#isCrossfading; }
  get isReady() { return this.#ready; }
  get activeDeck() { return this.#active; }
  get transitionMode() { return this.#transitionMode; }
  get globalVolume() { return this.#globalVolume; }

  setGlobalVolume(v) {
    this.#globalVolume = Math.max(0, Math.min(1, Number(v) || 0));
    this.#applyDeckBaseMix(this.#lastBaseMix.A, this.#lastBaseMix.B);
  }

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

    if (options.paused === true) {
      // SPEC-1.1.13 : un préchargement (paused) ne doit jamais cibler la platine
      // active en cours de lecture — sinon #loadOnly() couperait la musique.
      if (targetDeck === this.#active && audio.src && !audio.paused) {
        logWarn('deck.load.rejected.activePlaying', {
          targetDeck,
          activeDeck: this.#active,
          srcPreview: String(normalized.url || '').slice(0, 96),
        });
        return;
      }
      // SPEC-1.1.14 : ne jamais précharger une source déjà chargée sur l'autre platine.
      const otherDeck = targetDeck === 'A' ? 'B' : 'A';
      if (this.#deckSourceMeta[otherDeck]?.url === normalized.url) {
        logWarn('deck.load.rejected.duplicateSource', {
          targetDeck,
          otherDeck,
          srcPreview: String(normalized.url || '').slice(0, 96),
        });
        return;
      }
    }

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
    this.cancelActiveTransition();
    this.#smoothSetDeckMixRatio(safeRatio, transitionMs);
  }

  // Donne la main à l'utilisateur sur une transition auto (AutoMix/beat_repeat) en cours :
  // bouger le mix-slider pendant une transition l'interrompt immédiatement au lieu de se battre
  // avec elle pour le contrôle du volume des platines. Les deux platines restent chargées et
  // audibles (aucun handoff définitif), l'utilisateur reprend le mix à la main via le slider.
  cancelActiveTransition() {
    if (!this.#isCrossfading || typeof this.#crossfadeFinishFn !== 'function') return false;

    this.#crossfadeCancelledByUser = true;
    const finish = this.#crossfadeFinishFn;
    this.#crossfadeFinishFn = null;
    if (this.#crossfadeInterval) {
      clearInterval(this.#crossfadeInterval);
      this.#crossfadeInterval = null;
    }
    logInfo('crossfade.cancelled.manualOverride', {});
    finish();
    return true;
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
    // Un crossfade déjà en cours (déclenché par un autre chemin — timer automix,
    // clic manuel...) doit rejeter silencieusement cet appel concurrent SANS que
    // l'appelant ne croie que la transition a eu lieu : cf. startPlaybackForIndex()
    // qui n'actualise uiState.currentTrackId que si cette valeur de retour est true.
    if (this.#isCrossfading) {
      logWarn('crossfade.rejected.alreadyCrossfading', { targetDeck });
      return false;
    }
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
    let desiredDeck = targetDeck === 'A' || targetDeck === 'B' ? targetDeck : null;
    // SPEC-1.1.15 : un crossfade vers la platine active en lecture écraserait le
    // morceau en cours (cible devenue active pendant la préparation asynchrone) —
    // rediriger vers la platine réellement inactive.
    if (desiredDeck === this.#active) {
      const activeAudio = this.#activeAudio;
      if (activeAudio && activeAudio.src && !activeAudio.paused) {
        const redirected = desiredDeck === 'A' ? 'B' : 'A';
        logWarn('crossfade.retargeted.activeDeck', {
          desiredDeck,
          redirectedDeck: redirected,
          activeDeck: this.#active,
        });
        desiredDeck = redirected;
      }
    }
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
        incomingBpm: normalized.bpm,
      });

      if (this.#crossfadeCancelledByUser) {
        // L'utilisateur a bougé le mix-slider pendant la transition : pas de handoff définitif,
        // les deux platines restent chargées et audibles sous son contrôle manuel.
        this.#crossfadeCancelledByUser = false;
        this.dispatchEvent(new CustomEvent('transitioncancelled', {
          detail: { fromDeck, toDeck, mode: effectiveMode },
        }));
        this.#requestEmitDeckState();
        logInfo('crossfade.cancelled', { fromDeck, toDeck, mode: effectiveMode });
        return false;
      }

      if (to.paused && to.src) {
        await to.play().catch(() => {});
      }

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
      return true;
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
    const nextDurationMs = Number.isFinite(nextSource?.durationMs) ? nextSource.durationMs : null;
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

    const allModes = [...this.#allowedTransitionModes].filter((m) => m !== 'auto' && m !== 'reverb_short_simple');
    return this.#pickWeightedAutoTransition(allModes);
  }

  #pickWeightedAutoTransition(candidates) {
    const allowed = this.#allowedTransitionModes;
    const eligible = candidates.filter((m) => allowed.has(m));
    if (eligible.length === 0) return candidates[0];
    if (eligible.length === 1) {
      this.#recordAutoTransition(eligible[0]);
      return eligible[0];
    }

    const cooldown = Math.max(1, Math.floor(eligible.length / 2));
    const recent = this.#recentAutoTransitions;
    const recentTail = recent.slice(-cooldown);

    let available = eligible.filter((m) => !recentTail.includes(m));
    if (available.length === 0) available = eligible;

    const weights = available.map((mode) => {
      const lastIndex = recent.lastIndexOf(mode);
      if (lastIndex === -1) return 1;
      const recency = recent.length - lastIndex;
      return recency <= 2 ? 0.15 : recency <= 4 ? 0.5 : 0.8;
    });

    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * totalWeight;
    for (let i = 0; i < available.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        this.#recordAutoTransition(available[i]);
        return available[i];
      }
    }

    const pick = available[available.length - 1];
    this.#recordAutoTransition(pick);
    return pick;
  }

  #recordAutoTransition(mode) {
    this.#recentAutoTransitions.push(mode);
    if (this.#recentAutoTransitions.length > 16) {
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
    if (mode === 'beat_repeat') {
      await this.#runBeatRepeatTransition(context);
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
        const finishTransition = () => {
          this.#crossfadeFinishFn = null;
          resolve();
        };
        this.#crossfadeFinishFn = finishTransition;

        let progress = 0;
        let lastTickAt = performance.now();
        let loopAnchor = context.to.currentTime || 0;
        let shortLoopRepeatCount = 0;

        this.#crossfadeInterval = setInterval(() => {
          if (this.#destroyed) {
            clearInterval(this.#crossfadeInterval);
            this.#crossfadeInterval = null;
            finishTransition();
            return;
          }

          const now = performance.now();
          const elapsedMs = Math.max(0, now - lastTickAt);
          lastTickAt = now;
          progress = Math.min(1, progress + (elapsedMs / liveDuration));

          const levels = this.#computeTransitionLevels(mode, progress, context.startBaseFrom, context.startBaseTo);
          let fromBase = levels.from;
          let toBase = levels.to;

          if (mode === 'short_loop' && progress < 0.45
            && shouldResetShortLoop(context.to.currentTime, loopAnchor, shortLoopRepeatCount)) {
            context.to.currentTime = loopAnchor;
            shortLoopRepeatCount += 1;
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

          if (mode === 'backspin') {
            // Décélération rapide jusqu'à l'arrêt complet
            context.from.playbackRate = progress < 0.35
              ? Math.max(0.04, 1 - Math.pow(progress / 0.35, 0.55))
              : 0;
            context.to.playbackRate += (1 - context.to.playbackRate) * timeCorrectedRateEase(0.18, elapsedMs);
          } else if (mode === 'filter_sweep_low_high' || mode === 'filter_automation') {
            context.from.playbackRate = Math.max(0.86, 1 - (0.16 * progress));
            context.to.playbackRate = Math.max(0.9, 1.08 - (0.18 * progress));
          } else {
            const rateEase = timeCorrectedRateEase(0.18, elapsedMs);
            context.from.playbackRate += (1 - context.from.playbackRate) * rateEase;
            context.to.playbackRate += (1 - context.to.playbackRate) * rateEase;
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
            finishTransition();
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

  // beat_repeat: capture a beat-grid-aligned loop on the outgoing deck via BeatRepeatEngine
  // (sample-accurate, AudioContext-clock-scheduled — see lib/beatRepeatEngine.js) and hand off
  // to Track B on the next bar boundary. Bypasses the generic #runTransitionMode tick loop
  // entirely for the loop mechanics themselves; only reuses its general shape (30ms poll) for
  // wall-clock UI progress events, FX nudges (high-pass/echo on the last 2 stages), and the
  // stepped crossfader — never for the loop scheduling, which is computed once up front against
  // the audio clock (SPEC-1.3.5/SPEC-1.3.8).
  //
  // Waits for the live playhead to actually reach the beat-grid anchor before switching to the
  // loop engine (see #waitForBeatRepeatAnchor): starting the loop engine's audio content
  // immediately, regardless of where the live element actually is, made the anchor step
  // perceptible as a jerk/skip rather than the intended inaudible snap.
  async #waitForBeatRepeatAnchor(context, anchorSec) {
    await new Promise((resolve) => {
      const check = () => {
        if (this.#destroyed) { resolve(); return; }
        const current = Number.isFinite(context.from.currentTime) ? context.from.currentTime : anchorSec;
        if (current >= anchorSec) { resolve(); return; }
        setTimeout(check, 15);
      };
      check();
    });
  }

  // Incoming deck joins the stutter for the tail of the transition, phase-locked to the exact
  // same ctx-time instant the outgoing deck's own timeline reaches the halfway stage (SPEC-
  // 1.3.8.17) — both decks are then genuinely IN THE SAME LOOP STATE from that instant through
  // to the shared bar-boundary cut, not just "also looping on some independent schedule".
  // Scheduled up front against the AudioContext clock (via BeatRepeatEngine#run's `startAt`),
  // matching how the outgoing deck's own stages are scheduled (SPEC-1.3.8.6) — not a reactive
  // tick-loop check, which would let decode latency desync the two decks' stage boundaries.
  //
  // It's fresh, unfamiliar content to the listener, so unlike #waitForBeatRepeatAnchor for the
  // outgoing deck, no beat-grid wait is applied to *where* the loop is captured from: capturing
  // "wherever it currently is" is an acceptable, much simpler trade-off — nobody has a reference
  // point for what B "should" sound like yet, only for exactly *when* the stutter changes pace.
  async #scheduleBeatRepeatIncomingLoop(context, { ctx, destinationBus, sourceUrl, secondsPerBeat, remainingStageBeats, remainingLaunchBeats, startAt, cutoverState }) {
    const windowSec = remainingStageBeats[0] * secondsPerBeat;
    const durationSec = Number.isFinite(context.to.duration) && context.to.duration > 0 ? context.to.duration : null;
    const currentTimeSec = Number.isFinite(context.to.currentTime) ? context.to.currentTime : 0;
    let anchorSec = currentTimeSec;
    if (durationSec !== null) {
      anchorSec = Math.min(anchorSec, Math.max(0, durationSec - windowSec));
    }

    const audioBuffer = await this.#beatRepeatEngineIncoming.prepare(ctx, sourceUrl, anchorSec, windowSec);
    if (this.#destroyed || cutoverState.reached) return false;

    this.#beatRepeatEngineIncoming.run({
      ctx, destinationBus, audioBuffer, stageBeats: remainingStageBeats, secondsPerBeat, launchBeats: remainingLaunchBeats, startAt,
    });

    // Mute the incoming deck's own live element exactly when its scheduled loop content actually
    // starts producing sound — muting any earlier leaves a silent gap (nothing audible yet),
    // muting later doubles up live playback under the already-started loop.
    const muteDelayMs = Math.max(0, (startAt - ctx.currentTime) * 1000);
    return new Promise((resolve) => {
      cutoverState.incomingMuteResolve = resolve;
      cutoverState.incomingMuteTimeoutId = setTimeout(() => {
        cutoverState.incomingMuteTimeoutId = null;
        cutoverState.incomingMuteResolve = null;
        if (this.#destroyed || cutoverState.reached) { resolve(false); return; }
        this.#mixFeatures.setDeckElementGain(context.toDeck, 0);
        resolve(true);
      }, muteDelayMs);
    });
  }

  async #runBeatRepeatTransition(context) {
    // Corrected from an earlier version of this effect, which incorrectly used the *incoming*
    // deck's BPM: the loop is chopped out of the *outgoing* deck's own buffer, so its rhythmic
    // grid is the outgoing track's own BPM.
    const fromBpm = getSafeBeatRepeatBpm(this.#deckSourceMeta[context.fromDeck]?.bpm);
    const secondsPerBeat = 60 / fromBpm;
    // Final-stage tempo bend target: the incoming deck's own BPM, so the last stutters lead
    // into Track B's tempo instead of an instant tempo cut (SPEC-1.3.8.15).
    const toBpm = getSafeBeatRepeatBpm(this.#deckSourceMeta[context.toDeck]?.bpm);
    const finalStagePitchRatio = computeBeatRepeatFinalStagePitchRatio(fromBpm, toBpm);

    const durationSec = Number.isFinite(context.from.duration) && context.from.duration > 0
      ? context.from.duration
      : null;
    const currentTimeSec = Number.isFinite(context.from.currentTime) ? context.from.currentTime : 0;
    const remainingBeats = durationSec !== null
      ? Math.max(0, durationSec - currentTimeSec) / secondsPerBeat
      : Infinity;

    // Step 2: default beats (configurable, see BEAT_REPEAT_DEFAULT_INITIAL_BEATS), half if
    // runway is short, never below 2.
    const initialBeats = chooseInitialLoopBeats(remainingBeats, this.#beatRepeatInitialBeats);
    // Steps 3-5: halve every 2 repetitions down to the absolute 1/16-beat floor.
    const stageBeats = buildBeatRepeatStageBeats(initialBeats);
    // Step 8: next bar boundary after the final (floor) stage's mandatory 2 repetitions.
    const launchBeats = computeBeatRepeatLaunchBeats(stageBeats);
    const launchMs = launchBeats * secondsPerBeat * 1000;
    const totalMs = launchMs;

    // SPEC-1.3.5.5: the incoming deck joins the stutter once the stepped crossfader (SPEC-
    // 1.3.8.16) reaches 50% — it reuses the outgoing deck's own remaining stages/timing so both
    // decks land on the shared bar-boundary cut together.
    const incomingHalfStageIndex = computeBeatRepeatHalfStageIndex(stageBeats.length);
    const incomingElapsedBeatsThreshold = computeBeatRepeatElapsedBeatsAtStageStart(stageBeats, incomingHalfStageIndex);
    const incomingRemainingStageBeats = stageBeats.slice(incomingHalfStageIndex);
    const incomingRemainingLaunchBeats = launchBeats - incomingElapsedBeatsThreshold;

    // Step 1: beat-grid-aligned anchor (next beat at/after the live playhead — never behind
    // it), defensively pulled back so the loop window never reads past the track's own end.
    const windowSec = initialBeats * secondsPerBeat;
    let anchorSec = computeLoopAnchorSeconds(currentTimeSec, secondsPerBeat);
    if (durationSec !== null) {
      anchorSec = Math.min(anchorSec, Math.max(0, durationSec - windowSec));
    }

    const startEcho = this.#mixFeatureSettings.echo;
    const savedFromFilterMode = this.#mixFeatureSettings.deckFx?.[context.fromDeck]?.filterMode || 'off';

    await this.#mixFeatures?.ensureReady?.();
    const ctx = this.#mixFeatures?.getAudioContext?.();
    const destinationBus = this.#mixFeatures?.getDeckInputBus?.(context.fromDeck);
    const sourceUrl = this.#deckSourceMeta[context.fromDeck]?.url;

    let engineStarted = false;
    let incomingLoopPromise = null;
    let incomingEngineStarted = false;
    const cutoverState = { reached: false };

    try {
      if (ctx && destinationBus && sourceUrl) {
        // Decode runs in parallel with the wait so the buffer is ready the instant the live
        // playhead reaches the anchor — waiting first and only then decoding would let the
        // playhead drift past the anchor again during the decode itself.
        const preparePromise = this.#beatRepeatEngine.prepare(ctx, sourceUrl, anchorSec, windowSec);
        await this.#waitForBeatRepeatAnchor(context, anchorSec);
        const audioBuffer = await preparePromise;
        this.#mixFeatures.setDeckElementGain(context.fromDeck, 0);
        const { t0 } = this.#beatRepeatEngine.run({
          ctx, destinationBus, audioBuffer, stageBeats, secondsPerBeat, launchBeats, finalStagePitchRatio,
        });
        engineStarted = true;

        // Kick off the incoming deck's mirrored tail loop right away, scheduled against this
        // same t0 (SPEC-1.3.8.17) — not a reactive tick-loop check — so it's phase-locked to the
        // exact instant the outgoing timeline reaches its own halfway stage, however long its
        // own decode takes.
        const toDestinationBus = this.#mixFeatures?.getDeckInputBus?.(context.toDeck);
        const toSourceUrl = this.#deckSourceMeta[context.toDeck]?.url;
        if (toDestinationBus && toSourceUrl) {
          incomingLoopPromise = this.#scheduleBeatRepeatIncomingLoop(context, {
            ctx,
            destinationBus: toDestinationBus,
            sourceUrl: toSourceUrl,
            secondsPerBeat,
            remainingStageBeats: incomingRemainingStageBeats,
            remainingLaunchBeats: incomingRemainingLaunchBeats,
            startAt: t0 + (incomingElapsedBeatsThreshold * secondsPerBeat),
            cutoverState,
          }).then((started) => { incomingEngineStarted = started; }).catch(() => {});
        }
      }

      await new Promise((resolve) => {
        const finishTransition = () => {
          this.#crossfadeFinishFn = null;
          resolve();
        };
        this.#crossfadeFinishFn = finishTransition;

        let progress = 0;
        let lastTickAt = performance.now();

        this.#crossfadeInterval = setInterval(() => {
          if (this.#destroyed) {
            clearInterval(this.#crossfadeInterval);
            this.#crossfadeInterval = null;
            finishTransition();
            return;
          }

          const now = performance.now();
          const tickElapsedMs = Math.max(0, now - lastTickAt);
          lastTickAt = now;
          progress = Math.min(1, progress + (tickElapsedMs / totalMs));

          const elapsedMs = progress * totalMs;
          let fromBase;
          let toBase;
          let finished = false;

          if (elapsedMs < launchMs) {
            // Mix slider moves in one discrete jump per stage (not a continuous ramp) — an
            // equal 1/N share of the way to the incoming deck per stage change, matching the
            // audible stutter's own staircase rather than smoothing over it (SPEC-1.3.8.16).
            const elapsedBeats = (elapsedMs / 1000) / secondsPerBeat;
            const stepT = computeBeatRepeatStepProgress(stageBeats, elapsedBeats);
            const levels = this.#computeTransitionLevels('beat_repeat', stepT, context.startBaseFrom, context.startBaseTo);
            fromBase = levels.from;
            toBase = levels.to;

            // Last BEAT_REPEAT_FX_STAGE_COUNT stages (shortest): high-pass on the outgoing
            // deck + echo ramping 0->1 across their combined duration.
            const fxStageStartIndex = Math.max(0, stageBeats.length - BEAT_REPEAT_FX_STAGE_COUNT);
            const fxPhaseStartBeats = stageBeats
              .slice(0, fxStageStartIndex)
              .reduce((sum, beats) => sum + (beats * 2), 0);
            if (elapsedBeats >= fxPhaseStartBeats) {
              if (savedFromFilterMode !== 'highPass') {
                this.setMixFeatures({ deckFx: { [context.fromDeck]: { filterMode: 'highPass' } } });
              }
              if (!startEcho) this.setMixFeatures({ echo: true });
              const fxPhaseTotalBeats = Math.max(0.001, launchBeats - fxPhaseStartBeats);
              const echoIntensity = clamp01((elapsedBeats - fxPhaseStartBeats) / fxPhaseTotalBeats);
              this.#mixFeatures?.setEchoIntensity?.(echoIntensity);
            }
          } else {
            // Bar boundary reached: instant cut to Track B (the final step of the staircase),
            // consistent with the stutter aesthetic rather than a smoothed-over handoff.
            cutoverState.reached = true;
            fromBase = 0;
            toBase = 1;
            finished = true;
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
              durationMs: totalMs,
              progress: finished ? 1 : progress,
              mode: 'beat_repeat',
            },
          }));

          if (progress >= 1 || finished) {
            clearInterval(this.#crossfadeInterval);
            this.#crossfadeInterval = null;
            finishTransition();
          }
        }, 30);
      });
    } finally {
      // If the transition ended (destroyed, or interrupted) before the incoming loop's own
      // scheduled mute instant arrived, cancel it and force-resolve rather than leaving
      // `await incomingLoopPromise` blocked on a setTimeout that may be seconds away.
      if (cutoverState.incomingMuteTimeoutId) {
        clearTimeout(cutoverState.incomingMuteTimeoutId);
        cutoverState.incomingMuteTimeoutId = null;
        cutoverState.incomingMuteResolve?.(false);
        cutoverState.incomingMuteResolve = null;
      }
      if (incomingLoopPromise) await incomingLoopPromise;
      this.#beatRepeatEngine.stop();
      this.#beatRepeatEngineIncoming.stop();
      if (engineStarted) {
        this.#mixFeatures?.setDeckElementGain(context.fromDeck, 1);
      }
      if (incomingEngineStarted) {
        this.#mixFeatures?.setDeckElementGain(context.toDeck, 1);
      }
      this.#mixFeatures?.setEchoIntensity?.(1);
      if (!startEcho) this.setMixFeatures({ echo: false });
      this.setMixFeatures({ deckFx: { [context.fromDeck]: { filterMode: savedFromFilterMode } } });
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
        const from = startBaseFrom * Math.pow(1 - clampedT, 1.4);
        const to = startBaseTo + ((1 - startBaseTo) * Math.pow(clampedT, 0.7));
        return { from, to };
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
        // `t` here is a stage-quantized step (computeBeatRepeatStepProgress), not continuous
        // time — the plain linear curve applied to a stepped t already produces the intended
        // staircase crossfader. The final bar-boundary handoff is a separate instant cut
        // (fromBase=0/toBase=1), applied directly in the tick, not through this curve.
        return { from: linearFrom, to: linearTo };
      }
      case 'backspin': {
        // Phase 1 : fromDeck décélère et s'arrête ; toDeck monte dès 20% pour éviter tout silence
        const from = clampedT < 0.35
          ? startBaseFrom * (1 - Math.pow(clampedT / 0.35, 0.65))
          : 0;
        const toPhase = Math.min(1, Math.max(0, (clampedT - 0.2) / 0.5));
        const to = startBaseTo + ((1 - startBaseTo) * Math.pow(toPhase, 0.7));
        return { from, to };
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
    this.#beatRepeatEngine?.stop();
    this.#beatRepeatEngineIncoming?.stop();

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
    if (!audio.paused) {
      logWarn('audio.loadAndPlay.forcePause', {
        srcPreview: String(audio.src || '').slice(0, 96),
        ended: audio.ended,
        readyState: audio.readyState,
      });
      audio.pause();
    }
    audio.currentTime = 0;
    audio.src = sourceUrl;

    const loadStartedAt = performance.now();
    await new Promise((resolve, reject) => {
      let settled = false;
      const onCanPlay = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };
      const onError = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('Flux audio API non lisible'));
      };
      const cleanup = () => {
        clearTimeout(safetyTimer);
        audio.removeEventListener('canplay', onCanPlay);
        audio.removeEventListener('error', onError);
      };

      audio.addEventListener('canplay', onCanPlay, { once: true });
      audio.addEventListener('error', onError, { once: true });

      const safetyTimer = setTimeout(() => {
        if (settled) return;
        if (audio.readyState >= 2) {
          logWarn('audio.loadAndPlay.canPlayTimeout.readyOk', {
            readyState: audio.readyState,
            srcPreview: String(sourceUrl || '').slice(0, 96),
          });
          onCanPlay();
        } else {
          logError('audio.loadAndPlay.canPlayTimeout.notReady', {
            readyState: audio.readyState,
            srcPreview: String(sourceUrl || '').slice(0, 96),
          });
          onError();
        }
      }, 10000);

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
      let settled = false;
      const onCanPlay = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };
      const onError = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('Flux audio API non lisible'));
      };
      const cleanup = () => {
        clearTimeout(safetyTimer);
        audio.removeEventListener('canplay', onCanPlay);
        audio.removeEventListener('error', onError);
      };
      audio.addEventListener('canplay', onCanPlay, { once: true });
      audio.addEventListener('error', onError, { once: true });
      const safetyTimer = setTimeout(() => {
        if (settled) return;
        if (audio.readyState >= 2) {
          logWarn('audio.loadOnly.canPlayTimeout.readyOk', {
            readyState: audio.readyState,
            srcPreview: String(sourceUrl || '').slice(0, 96),
          });
          onCanPlay();
        } else {
          logError('audio.loadOnly.canPlayTimeout.notReady', {
            readyState: audio.readyState,
            srcPreview: String(sourceUrl || '').slice(0, 96),
          });
          onError();
        }
      }, 10000);
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
      const audioFeatures = source.audioFeatures && typeof source.audioFeatures === 'object'
        ? source.audioFeatures
        : null;
      // Le BPM peut n'être renseigné que sur audioFeatures selon l'appelant (cf. main.js) :
      // on retombe dessus si source.bpm/tempo est absent.
      const bpm = Number(source.bpm) || Number(source.tempo) || Number(audioFeatures?.bpm);
      const durationMs = Number(source.durationMs);
      const startPositionMs = Number(source.startPositionMs);
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
    this.#lastBaseMix.A = safeA;
    this.#lastBaseMix.B = safeB;
    const compA = this.#getDeckCompensation('A');
    const compB = this.#getDeckCompensation('B');
    const gv = this.#globalVolume;

    let nextA;
    let nextB;

    if (safeA > 0 && safeB > 0) {
      // Use a shared compensation factor so the A/B ratio remains exact
      // for any slider position, including while smoothing.
      const sharedComp = Math.max(0, Math.min(compA, compB, 1));
      nextA = Math.max(0, Math.min(1, safeA * sharedComp * gv));
      nextB = Math.max(0, Math.min(1, safeB * sharedComp * gv));
    } else {
      nextA = Math.max(0, Math.min(1, safeA * compA * gv));
      nextB = Math.max(0, Math.min(1, safeB * compB * gv));
    }

    this.#audioA.volume = nextA;
    this.#audioB.volume = nextB;
  }
}
