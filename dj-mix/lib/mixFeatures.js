// ─── Transition modes (exported for UI selection and player) ────────────────

export const MIX_TRANSITION_MODES = Object.freeze([
  'auto',
  'crossfade_linear',
  'crossfade_logarithmic',
  'fade_in_out',
  'cut_transition',
  'filter_sweep_low_high',
  'eq_transition_simple',
  'echo_out_light',
  'reverb_short_simple',
  'short_loop',
  'brake_tape_stop_simple',
  'short_reverse',
  'sidechain_basic',
  'volume_ducking',
  'gain_automation',
  'filter_automation',
]);

export const MIX_TRANSITION_MODE_LABELS = Object.freeze({
  auto: 'Auto (meilleur)',
  crossfade_linear: 'Crossfade lineaire',
  crossfade_logarithmic: 'Crossfade logarithmique',
  fade_in_out: 'Fade in / Fade out',
  cut_transition: 'Cut transition',
  filter_sweep_low_high: 'Filter sweep (low-pass / high-pass)',
  eq_transition_simple: 'EQ transition simple',
  echo_out_light: 'Echo out leger',
  reverb_short_simple: 'Reverb courte et simple',
  short_loop: 'Loop courte',
  brake_tape_stop_simple: 'Brake / tape stop simple',
  short_reverse: 'Reverse court',
  sidechain_basic: 'Sidechain basique',
  volume_ducking: 'Volume ducking',
  gain_automation: 'Automation de gain',
  filter_automation: 'Automation de filtre',
});

export const DEFAULT_TRANSITION_MODE = 'auto';

export function normalizeTransitionMode(mode) {
  const next = String(mode || '').trim();
  return MIX_TRANSITION_MODES.includes(next) ? next : DEFAULT_TRANSITION_MODE;
}

const TRANSITION_EXTRA_RAM_MB = Object.freeze({
  auto: 0,
  crossfade_linear: 18,
  crossfade_logarithmic: 20,
  fade_in_out: 24,
  cut_transition: 6,
  filter_sweep_low_high: 96,
  eq_transition_simple: 44,
  echo_out_light: 128,
  reverb_short_simple: 172,
  short_loop: 108,
  brake_tape_stop_simple: 58,
  short_reverse: 122,
  sidechain_basic: 52,
  volume_ducking: 40,
  gain_automation: 34,
  filter_automation: 104,
});

const TRANSITION_OVERLAP_MULTIPLIER = Object.freeze({
  auto: 0,
  crossfade_linear: 1.0,
  crossfade_logarithmic: 1.02,
  fade_in_out: 1.05,
  cut_transition: 0.12,
  filter_sweep_low_high: 1.2,
  eq_transition_simple: 1.08,
  echo_out_light: 1.35,
  reverb_short_simple: 1.55,
  short_loop: 1.22,
  brake_tape_stop_simple: 1.12,
  short_reverse: 1.24,
  sidechain_basic: 1.1,
  volume_ducking: 1.06,
  gain_automation: 1.0,
  filter_automation: 1.25,
});

export function getTransitionRamRequirementsMb(options = {}) {
  const crossfadeDurationMs = Math.max(250, Number(options.crossfadeDurationMs) || 12000);
  const sampleRate = Number(options.sampleRate) > 0 ? Number(options.sampleRate) : 44100;
  const channels = Number(options.channels) > 0 ? Number(options.channels) : 2;
  const bytesPerSample = Number(options.bytesPerSample) > 0 ? Number(options.bytesPerSample) : 4;
  const overlapSeconds = crossfadeDurationMs / 1000;
  const overlapMb = (sampleRate * channels * bytesPerSample * overlapSeconds) / (1024 * 1024);

  const profile = {};
  for (const mode of MIX_TRANSITION_MODES) {
    const extraMb = TRANSITION_EXTRA_RAM_MB[mode] || 0;
    const overlapFactor = TRANSITION_OVERLAP_MULTIPLIER[mode] || 1;
    const estimateMb = mode === 'auto'
      ? 0
      : Math.round((extraMb + (overlapMb * overlapFactor)) * 10) / 10;
    profile[mode] = estimateMb;
  }
  return profile;
}

export function getTransitionRamRequirementMb(mode, options = {}) {
  const safeMode = normalizeTransitionMode(mode);
  const profile = getTransitionRamRequirementsMb(options);
  return Number(profile[safeMode]) || 0;
}

export function getAllowedTransitionModesForRam(ramBudgetMb, options = {}) {
  const budgetMb = Math.max(0, Number(ramBudgetMb) || 0);
  const profile = getTransitionRamRequirementsMb(options);
  const allowed = MIX_TRANSITION_MODES.filter((mode) => {
    if (mode === 'auto') return true;
    return (Number(profile[mode]) || 0) <= budgetMb;
  });

  if (!allowed.includes('cut_transition')) {
    allowed.push('cut_transition');
  }
  if (!allowed.includes('auto')) {
    allowed.unshift('auto');
  }

  return allowed;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FFT_SIZE        = 1024;
const SMOOTH_TAU      = 0.08;   // seconds – AudioParam setTargetAtTime time-constant
const SMOOTH_JS       = 0.34;   // lerp alpha for computeAdaptiveMidSideGains
const ENERGY_EPSILON  = 1e-4;
const DISTORTION_K    = 140;
const DISTORTION_WET_MIX = 0.36;
const DISTORTION_DRY_MIX = 0.84;
const ECHO_DELAY_S    = 0.22;
const ECHO_FEEDBACK   = 0.28;
const ECHO_WET_MIX    = 0.28;
const ECHO_DRY_MIX    = 0.9;
const STEM_SYNC_INTERVAL_MS = 1200;

// ─── Tiny utilities ───────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }


// ─── Distortion curve (computed once, reused for every deck) ─────────────────

const DISTORTION_CURVE = (() => {
  const n   = 44100;
  const deg = Math.PI / 180;
  const k   = DISTORTION_K;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    out[i]  = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return out;
})();

// ─── Analyser helpers (reusable Float32Array per analyser) ───────────────────

const _analyserBuf = new WeakMap();

function readEnergy(analyser) {
  if (!analyser) return 0;

  let buf = _analyserBuf.get(analyser);
  if (!buf) {
    buf = new Float32Array(analyser.fftSize);
    _analyserBuf.set(analyser, buf);
  }

  analyser.getFloatTimeDomainData(buf);

  let ss = 0;
  for (let i = 0; i < buf.length; i++) ss += buf[i] * buf[i];
  return Math.sqrt(ss / buf.length);
}

// ─── Adaptive mid/side gain computation ──────────────────────────────────────

/**
 * Returns { midGain, sideGain } ∈ [0.1, 1] based on live energy readings.
 * Pure function – no side-effects.
 */
export function computeAdaptiveMidSideGains(mode, midEnergy, sideEnergy) {
  if (mode !== 'vocalRemove' && mode !== 'instruRemove') return { midGain: 1, sideGain: 1 };

  const total = midEnergy + sideEnergy;

  if (total <= ENERGY_EPSILON) {
    return mode === 'vocalRemove'
      ? { midGain: 0.22, sideGain: 1 }
      : { midGain: 1,    sideGain: 0.22 };
  }

  const mr = midEnergy  / total;
  const sr = sideEnergy / total;

  return mode === 'vocalRemove'
    ? { midGain:  clamp(0.1 + (1 - mr) * 0.7, 0.1, 0.72), sideGain: clamp(0.92 + sr * 0.08, 0.92, 1) }
    : { midGain:  clamp(0.92 + mr * 0.08, 0.92, 1),        sideGain: clamp(0.1 + (1 - sr) * 0.7, 0.1, 0.72) };
}

// ─── Settings helpers ─────────────────────────────────────────────────────────

function defaultDeckFx() {
  return {
    A: { vocalRemove: false, instruRemove: false, filterMode: 'off' },
    B: { vocalRemove: false, instruRemove: false, filterMode: 'off' },
  };
}

function createAuxStemAudioElement() {
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const audio = document.createElement('audio');
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    return audio;
  }
  if (typeof Audio === 'function') {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    return audio;
  }
  return null;
}

/**
 * Immutably merges a partial `next` settings object into `current`.
 * Handles both top-level shorthand (next.vocalRemove) and per-deck form (next.deckFx.A.vocalRemove).
 */
function mergeSettings(current, next) {
  const deckFx = {
    A: { ...(current.deckFx?.A ?? {}), ...(next.deckFx?.A ?? {}) },
    B: { ...(current.deckFx?.B ?? {}), ...(next.deckFx?.B ?? {}) },
  };

  // Top-level shorthands propagate to both decks
  for (const key of ['vocalRemove', 'instruRemove']) {
    if (next[key] !== undefined) {
      deckFx.A[key] = Boolean(next[key]);
      deckFx.B[key] = Boolean(next[key]);
    }
  }

  // Mutual exclusion per deck
  for (const d of ['A', 'B']) {
    if (deckFx[d].vocalRemove) deckFx[d].instruRemove = false;
    else if (deckFx[d].instruRemove) deckFx[d].vocalRemove = false;
  }

  return {
    autoBpm:     next.autoBpm     !== undefined ? Boolean(next.autoBpm)     : Boolean(current.autoBpm),
    echo:        next.echo        !== undefined ? Boolean(next.echo)        : Boolean(current.echo),
    distortion:  next.distortion  !== undefined ? Boolean(next.distortion)  : Boolean(current.distortion),
    deckFx,
  };
}

// ─── Mid/Side chain ───────────────────────────────────────────────────────────

/**
 * Builds a minimal M/S encode → gain → analyse → decode graph.
 *
 *   Mid  = (L + R) * 0.5    ← centred content, usually vocals
 *   Side = (L − R) * 0.5    ← wide content, usually instruments
 *
 * Decode: L′ = Mid + Side,  R′ = Mid − Side
 *
 * Uses a ChannelMerger trick to avoid redundant gain nodes:
 *   - encode: splitter → ±0.5 scalars → merger (2 nodes saved vs previous)
 *   - decode: separate merger per output channel
 */
function createMidSideChain(ctx) {
  const splitter = ctx.createChannelSplitter(2);

  // ── Encode ──────────────────────────────────────────────────────────────────
  // Mid bus (L*0.5 + R*0.5)
  const encMidL = ctx.createGain(); encMidL.gain.value  =  0.5;
  const encMidR = ctx.createGain(); encMidR.gain.value  =  0.5;
  // Side bus (L*0.5 − R*0.5)
  const encSideL = ctx.createGain(); encSideL.gain.value =  0.5;
  const encSideR = ctx.createGain(); encSideR.gain.value = -0.5;

  splitter.connect(encMidL,  0); splitter.connect(encMidR,  1);
  splitter.connect(encSideL, 0); splitter.connect(encSideR, 1);

  // Merge into mono buses
  const midBus  = ctx.createGain();  // M signal (mono)
  const sideBus = ctx.createGain();  // S signal (mono)
  encMidL.connect(midBus);  encMidR.connect(midBus);
  encSideL.connect(sideBus); encSideR.connect(sideBus);

  // ── Analyse ─────────────────────────────────────────────────────────────────
  const midAnalyser  = ctx.createAnalyser(); midAnalyser.fftSize  = FFT_SIZE;
  const sideAnalyser = ctx.createAnalyser(); sideAnalyser.fftSize = FFT_SIZE;
  midBus.connect(midAnalyser);
  sideBus.connect(sideAnalyser);

  // ── Controllable gains (smoothed via AudioParam) ─────────────────────────────
  const midGain  = ctx.createGain(); midGain.gain.value  = 1;
  const sideGain = ctx.createGain(); sideGain.gain.value = 1;
  midAnalyser.connect(midGain);
  sideAnalyser.connect(sideGain);

  // ── Decode ───────────────────────────────────────────────────────────────────
  // L = Mid + Side,  R = Mid − Side
  const outL = ctx.createGain(); outL.gain.value  =  1;   // Side → R inverted
  const outR = ctx.createGain(); outR.gain.value  = -1;   // Side → R
  const merger = ctx.createChannelMerger(2);

  midGain.connect(merger,  0, 0); midGain.connect(merger,  0, 1);  // Mid → both channels
  sideGain.connect(outL);  outL.connect(merger, 0, 0);             // +Side → L
  sideGain.connect(outR);  outR.connect(merger, 0, 1);             // −Side → R

  return { input: splitter, midGain, midAnalyser, sideGain, sideAnalyser, output: merger };
}

// ─── Main class ───────────────────────────────────────────────────────────────

export class SimpleMixFeatures {
  #audioA;
  #audioB;
  #audioCtx  = null;
  #ready     = false;
  #settings  = { autoBpm: false, echo: false, distortion: false, deckFx: defaultDeckFx() };

  #nodesA = null;
  #nodesB = null;
  #deckStemState = {
    A: { originalSrc: '', appliedSrc: '', stemMode: null, token: 0, processing: false, providedStems: { vocalsUrl: '', instrumentalUrl: '', echoUrl: '', distortionUrl: '' } },
    B: { originalSrc: '', appliedSrc: '', stemMode: null, token: 0, processing: false, providedStems: { vocalsUrl: '', instrumentalUrl: '', echoUrl: '', distortionUrl: '' } },
  };
  #lastStemSyncAt = 0;

  // Smoothed gain state tracked on the JS side (for adaptive computation only)
  #msState = {
    A: { midGain: 1, sideGain: 1 },
    B: { midGain: 1, sideGain: 1 },
  };

  constructor(audioA, audioB) {
    this.#audioA = audioA;
    this.#audioB = audioB;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  async ensureReady() {
    if (this.#ready || !this.#audioA || !this.#audioB) return;
    const Ctx = window.AudioContext ?? window.webkitAudioContext;
    if (!Ctx) return;

    console.debug('[mixFeatures] ensureReady: creating AudioContext');
    this.#audioCtx = new Ctx();
    this.#nodesA   = this.#buildDeck(this.#audioA);
    this.#nodesB   = this.#buildDeck(this.#audioB);
    this.#ready    = true;
    console.debug('[mixFeatures] ensureReady: ready');
    this.#apply();
  }

  async setEnabled(next) {
    console.debug('[mixFeatures] setEnabled:', next);
    this.#settings = mergeSettings(this.#settings, next);

    const { autoBpm, echo, distortion, deckFx } = this.#settings;
    const needsCtx = autoBpm || echo || distortion
      || deckFx.A.vocalRemove || deckFx.A.instruRemove
      || deckFx.B.vocalRemove || deckFx.B.instruRemove;

    if (needsCtx) await this.ensureReady();
    this.#apply();
  }

  setDeckSourceMetadata(deck, source) {
    console.debug('[mixFeatures] setDeckSourceMetadata: deck=%s url=%s stems=%o', deck, source?.url, source?.stems);
    const d = deck === 'B' ? 'B' : 'A';
    const state = this.#deckStemState[d];
    const url = typeof source?.url === 'string' ? source.url : '';
    const stems = {
      vocalsUrl: typeof source?.stems?.vocalsUrl === 'string' ? source.stems.vocalsUrl : '',
      instrumentalUrl: typeof source?.stems?.instrumentalUrl === 'string' ? source.stems.instrumentalUrl : '',
      echoUrl: typeof source?.stems?.echoUrl === 'string' ? source.stems.echoUrl : '',
      distortionUrl: typeof source?.stems?.distortionUrl === 'string' ? source.stems.distortionUrl : '',
    };

    state.originalSrc = url;
    state.appliedSrc = '';
    state.stemMode = null;
    state.providedStems = stems;

    if (this.#ready) {
      void this.#syncDeckStemMode(d, true, false);
      this.#syncDeckEchoStemSource(d, true);
      this.#syncDeckDistortionStemSource(d, true);
    }
  }

  /**
   * Call from your animation / rAF loop.
   * autoBpm syncs playback rates; adaptive M/S gains are updated here via AudioParam.
   */
  tick(activeDeck) {
    if (!this.#ready) return;

    const { autoBpm } = this.#settings;

    if (autoBpm && !this.#audioA.paused && !this.#audioB.paused) {
      const active   = activeDeck === 'B' ? this.#audioB : this.#audioA;
      const inactive = activeDeck === 'B' ? this.#audioA : this.#audioB;

      const delta      = active.currentTime - inactive.currentTime;
      const targetRate = clamp(1 + delta * 0.02, 0.94, 1.06);
      inactive.playbackRate += (targetRate - inactive.playbackRate) * 0.2;
      active.playbackRate   += (1 - active.playbackRate) * 0.1;
    }

    const now = Date.now();
    if (now - this.#lastStemSyncAt >= STEM_SYNC_INTERVAL_MS) {
      this.#lastStemSyncAt = now;
      void this.#syncAllDeckStemModes(false);
      this.#syncAllDeckEchoStemSources(false);
      this.#syncAllDeckDistortionStemSources(false);
    }

    // M/S adaptive gains: active when no server-side stem swap is in effect
    for (const deck of ['A', 'B']) {
      if (this.#deckStemState[deck].stemMode) {
        this.#resetMs(deck);
      } else {
        this.#tickMsAdaptive(deck);
      }
    }
  }

  destroy() {
    console.debug('[mixFeatures] destroy');
    void this.#syncAllDeckStemModes(true, true);
    if (this.#audioA) this.#audioA.playbackRate = 1;
    if (this.#audioB) this.#audioB.playbackRate = 1;
    for (const deck of ['A', 'B']) {
      const stemAudio = this.#nodes(deck)?.echoStemAudio;
      if (stemAudio) {
        stemAudio.pause?.();
        stemAudio.src = '';
      }

      const distortionStemAudio = this.#nodes(deck)?.distortionStemAudio;
      if (distortionStemAudio) {
        distortionStemAudio.pause?.();
        distortionStemAudio.src = '';
      }
    }
    this.#audioCtx?.close().catch(() => {});
    this.#audioCtx = null;
    this.#nodesA = this.#nodesB = null;
    this.#ready  = false;
    this.#msState = { A: { midGain: 1, sideGain: 1 }, B: { midGain: 1, sideGain: 1 } };
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  #buildDeck(audioEl) {
    const ctx = this.#audioCtx;

    const source  = ctx.createMediaElementSource(audioEl);
    const preGain = ctx.createGain();
    const echoBaseSend = ctx.createGain();    echoBaseSend.gain.value = 1;
    const echoStemSend = ctx.createGain();    echoStemSend.gain.value = 0;
    const distBaseSend = ctx.createGain();    distBaseSend.gain.value = 0;
    const distStemSend = ctx.createGain();    distStemSend.gain.value = 0;

    // Echo
    const delay    = ctx.createDelay(0.8);    delay.delayTime.value = ECHO_DELAY_S;
    const feedback = ctx.createGain();         feedback.gain.value   = ECHO_FEEDBACK;
    const wet      = ctx.createGain();         wet.gain.value        = 0;
    const dry      = ctx.createGain();         dry.gain.value        = 1;

    // Distortion
    const distNode = ctx.createWaveShaper();
    distNode.curve      = DISTORTION_CURVE;   // shared, read-only
    distNode.oversample = '4x';
    const distWet  = ctx.createGain();         distWet.gain.value = 0;
    const distDry  = ctx.createGain();         distDry.gain.value = 1;

    // Mid/Side
    const ms = createMidSideChain(ctx);
    const toneFilter = ctx.createBiquadFilter();
    toneFilter.type = 'allpass';
    toneFilter.frequency.value = 18000;
    toneFilter.Q.value = 0.7;

    // ── Graph ────────────────────────────────────────────────────────────────
    source.connect(preGain);
    source.connect(echoBaseSend);
    source.connect(distBaseSend);

    preGain.connect(dry);
    echoBaseSend.connect(delay);
    echoStemSend.connect(delay);
    delay.connect(feedback); feedback.connect(delay);
    delay.connect(wet);

    dry.connect(distDry); wet.connect(distDry);
    distBaseSend.connect(distNode);
    distStemSend.connect(distNode);
    distNode.connect(distWet);

    distDry.connect(toneFilter);
    distWet.connect(toneFilter);
    toneFilter.connect(ms.input);
    ms.output.connect(ctx.destination);

    return {
      wet,
      dry,
      distWet,
      distDry,
      ms,
      toneFilter,
      echoBaseSend,
      echoStemSend,
      echoStemAudio: null,
      echoStemSource: null,
      distBaseSend,
      distStemSend,
      distortionStemAudio: null,
      distortionStemSource: null,
    };
  }

  #nodes(deck) { return deck === 'B' ? this.#nodesB : this.#nodesA; }

  /** Smooth-target a single AudioParam via the audio thread (no JS lerp needed). */
  #setParamSmooth(param, target) {
    const t = this.#audioCtx.currentTime;
    param.cancelScheduledValues(t);
    param.setTargetAtTime(target, t, SMOOTH_TAU);
  }

  #resetMs(deck) {
    const ms = this.#nodes(deck)?.ms;
    if (!ms) return;
    this.#setParamSmooth(ms.midGain.gain,  1);
    this.#setParamSmooth(ms.sideGain.gain, 1);
    this.#msState[deck].midGain = this.#msState[deck].sideGain = 1;
  }

  #tickMsAdaptive(deck) {
    const fx    = this.#settings.deckFx[deck];
    const mode  = fx.vocalRemove ? 'vocalRemove' : fx.instruRemove ? 'instruRemove' : null;
    const ms    = this.#nodes(deck)?.ms;
    if (!mode || !ms) { this.#resetMs(deck); return; }

    const { midGain, sideGain } = computeAdaptiveMidSideGains(
      mode,
      readEnergy(ms.midAnalyser),
      readEnergy(ms.sideAnalyser),
    );

    const state = this.#msState[deck];
    // Soft lerp on JS side so computeAdaptiveMidSideGains stays pure,
    // then hand the smoothed target to the audio-thread param.
    state.midGain  += (midGain  - state.midGain)  * SMOOTH_JS;
    state.sideGain += (sideGain - state.sideGain) * SMOOTH_JS;

    this.#setParamSmooth(ms.midGain.gain,  state.midGain);
    this.#setParamSmooth(ms.sideGain.gain, state.sideGain);
  }

  #deckMode(deck) {
    const fx = this.#settings.deckFx?.[deck];
    if (fx?.vocalRemove) return 'vocalRemove';
    if (fx?.instruRemove) return 'instruRemove';
    return null;
  }

  #deckAudio(deck) {
    return deck === 'B' ? this.#audioB : this.#audioA;
  }

  #ensureDeckEchoStemAudio(deck) {
    const nodes = this.#nodes(deck);
    if (!nodes || nodes.echoStemAudio || !this.#audioCtx) return nodes?.echoStemAudio ?? null;

    const stemAudio = createAuxStemAudioElement();
    if (!stemAudio) return null;

    nodes.echoStemAudio = stemAudio;
    nodes.echoStemSource = this.#audioCtx.createMediaElementSource(stemAudio);
    nodes.echoStemSource.connect(nodes.echoStemSend);
    return stemAudio;
  }

  #syncDeckEchoStemPlayback(deck, forceSeek = false) {
    if (!this.#settings.echo) return;

    const nodes = this.#nodes(deck);
    const stemAudio = nodes?.echoStemAudio;
    const mainAudio = this.#deckAudio(deck);
    if (!stemAudio || !mainAudio || !nodes) return;
    if (!nodes.echoStemSend.gain.value) return;

    const mainTime = Number.isFinite(mainAudio.currentTime) ? mainAudio.currentTime : 0;
    const stemTime = Number.isFinite(stemAudio.currentTime) ? stemAudio.currentTime : 0;

    stemAudio.playbackRate = Number.isFinite(mainAudio.playbackRate) ? mainAudio.playbackRate : 1;

    if (forceSeek || Math.abs(mainTime - stemTime) > 0.12) {
      try {
        stemAudio.currentTime = mainTime;
      } catch {}
    }

    if (mainAudio.paused) {
      stemAudio.pause?.();
      return;
    }

    try {
      const maybePromise = stemAudio.play?.();
      maybePromise?.catch?.(() => {});
    } catch {}
  }

  #syncDeckEchoStemSource(deck, forceSeek = false) {
    const nodes = this.#nodes(deck);
    if (!nodes) return;

    if (!this.#settings.echo) {
      nodes.echoBaseSend.gain.value = 1;
      nodes.echoStemSend.gain.value = 0;
      this.#setParamSmooth(nodes.wet.gain, 0);
      this.#setParamSmooth(nodes.dry.gain, 1);
      nodes.echoStemAudio?.pause?.();
      return;
    }

    // Keep the dry signal slightly under unity while echo is active,
    // so repetitions remain audible without overpowering the main track.
    this.#setParamSmooth(nodes.wet.gain, ECHO_WET_MIX);
    this.#setParamSmooth(nodes.dry.gain, ECHO_DRY_MIX);

    const vocalsUrl = this.#settings.echo
      ? (this.#deckStemState[deck]?.providedStems?.vocalsUrl || '')
      : '';

    if (!vocalsUrl) {
      nodes.echoBaseSend.gain.value = 1;
      nodes.echoStemSend.gain.value = 0;
      nodes.echoStemAudio?.pause?.();
      return;
    }

    const stemAudio = this.#ensureDeckEchoStemAudio(deck);
    if (!stemAudio) {
      nodes.echoBaseSend.gain.value = 1;
      nodes.echoStemSend.gain.value = 0;
      return;
    }

    const currentSrc = stemAudio.currentSrc || stemAudio.src || '';
    if (currentSrc !== vocalsUrl) {
      stemAudio.src = vocalsUrl;
      forceSeek = true;

      if (typeof stemAudio.addEventListener === 'function') {
        let settled = false;
        const finalize = () => {
          if (settled) return;
          settled = true;
          this.#syncDeckEchoStemPlayback(deck, true);
        };
        stemAudio.addEventListener('loadedmetadata', finalize, { once: true });
        setTimeout(finalize, 3000);
      }
    }

    nodes.echoBaseSend.gain.value = 0;
    nodes.echoStemSend.gain.value = 1;
    this.#syncDeckEchoStemPlayback(deck, forceSeek);
  }

  #syncAllDeckEchoStemSources(forceSeek = false) {
    this.#syncDeckEchoStemSource('A', forceSeek);
    this.#syncDeckEchoStemSource('B', forceSeek);
  }

  #ensureDeckDistortionStemAudio(deck) {
    const nodes = this.#nodes(deck);
    if (!nodes || nodes.distortionStemAudio || !this.#audioCtx) return nodes?.distortionStemAudio ?? null;

    const stemAudio = createAuxStemAudioElement();
    if (!stemAudio) return null;

    nodes.distortionStemAudio = stemAudio;
    nodes.distortionStemSource = this.#audioCtx.createMediaElementSource(stemAudio);
    nodes.distortionStemSource.connect(nodes.distStemSend);
    return stemAudio;
  }

  #syncDeckDistortionStemPlayback(deck, forceSeek = false) {
    if (!this.#settings.distortion) return;

    const nodes = this.#nodes(deck);
    const stemAudio = nodes?.distortionStemAudio;
    const mainAudio = this.#deckAudio(deck);
    if (!stemAudio || !mainAudio || !nodes) return;
    if (!nodes.distStemSend.gain.value) return;

    const mainTime = Number.isFinite(mainAudio.currentTime) ? mainAudio.currentTime : 0;
    const stemTime = Number.isFinite(stemAudio.currentTime) ? stemAudio.currentTime : 0;

    stemAudio.playbackRate = Number.isFinite(mainAudio.playbackRate) ? mainAudio.playbackRate : 1;

    if (forceSeek || Math.abs(mainTime - stemTime) > 0.12) {
      try {
        stemAudio.currentTime = mainTime;
      } catch {}
    }

    if (mainAudio.paused) {
      stemAudio.pause?.();
      return;
    }

    try {
      const maybePromise = stemAudio.play?.();
      maybePromise?.catch?.(() => {});
    } catch {}
  }

  #syncDeckDistortionStemSource(deck, forceSeek = false) {
    const nodes = this.#nodes(deck);
    if (!nodes) return;

    const distortionUrl = this.#settings.distortion
      ? (this.#deckStemState[deck]?.providedStems?.distortionUrl || '')
      : '';

    if (!this.#settings.distortion) {
      nodes.distBaseSend.gain.value = 0;
      nodes.distStemSend.gain.value = 0;
      this.#setParamSmooth(nodes.distWet.gain, 0);
      this.#setParamSmooth(nodes.distDry.gain, 1);
      nodes.distortionStemAudio?.pause?.();
      return;
    }

    // Reverb-style blend: lower dry a bit and raise wet while the effect is active.
    this.#setParamSmooth(nodes.distWet.gain, DISTORTION_WET_MIX);
    this.#setParamSmooth(nodes.distDry.gain, DISTORTION_DRY_MIX);

    if (!distortionUrl) {
      nodes.distBaseSend.gain.value = 1;
      nodes.distStemSend.gain.value = 0;
      nodes.distortionStemAudio?.pause?.();
      return;
    }

    const stemAudio = this.#ensureDeckDistortionStemAudio(deck);
    if (!stemAudio) {
      nodes.distBaseSend.gain.value = 1;
      nodes.distStemSend.gain.value = 0;
      return;
    }

    const currentSrc = stemAudio.currentSrc || stemAudio.src || '';
    if (currentSrc !== distortionUrl) {
      stemAudio.src = distortionUrl;
      forceSeek = true;

      if (typeof stemAudio.addEventListener === 'function') {
        let settled = false;
        const finalize = () => {
          if (settled) return;
          settled = true;
          this.#syncDeckDistortionStemPlayback(deck, true);
        };
        stemAudio.addEventListener('loadedmetadata', finalize, { once: true });
        setTimeout(finalize, 3000);
      }
    }

    nodes.distBaseSend.gain.value = 0;
    nodes.distStemSend.gain.value = 1;
    this.#syncDeckDistortionStemPlayback(deck, forceSeek);
  }

  #syncAllDeckDistortionStemSources(forceSeek = false) {
    this.#syncDeckDistortionStemSource('A', forceSeek);
    this.#syncDeckDistortionStemSource('B', forceSeek);
  }

  async #swapDeckSource(audio, nextSrc) {
    if (!audio || !nextSrc) return;
    const currentSrc = audio.currentSrc || audio.src || '';
    if (currentSrc === nextSrc) return;

    console.debug('[mixFeatures] swapDeckSource:', currentSrc, '→', nextSrc);
    const wasPaused = audio.paused;
    const prevTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;

    audio.src = nextSrc;

    await new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        audio.removeEventListener('loadedmetadata', onLoaded);
        audio.removeEventListener('error', onLoaded);
        resolve();
      };
      const onLoaded = () => finish();
      audio.addEventListener('loadedmetadata', onLoaded, { once: true });
      audio.addEventListener('error', onLoaded, { once: true });
      setTimeout(finish, 3000);
    });

    if (prevTime > 0 && Number.isFinite(audio.duration) && audio.duration > 0) {
      const seekTime = Math.min(prevTime, Math.max(0, audio.duration - 0.05));
      try { audio.currentTime = seekTime; } catch {}
    }

    if (!wasPaused) {
      await audio.play().catch(() => {});
    }
  }

  async #syncDeckStemMode(deck, force = false, restoreOnly = false) {
    const audio = this.#deckAudio(deck);
    if (!audio) return;

    console.debug('[mixFeatures] syncDeckStemMode: deck=%s force=%s restoreOnly=%s', deck, force, restoreOnly);
    const state = this.#deckStemState[deck];
    const mode = restoreOnly ? null : this.#deckMode(deck);
    const currentSrc = audio.currentSrc || audio.src || '';
    const isAppliedSrc = Boolean(state.appliedSrc) && currentSrc === state.appliedSrc;

    if (!mode) {
      if (isAppliedSrc && state.originalSrc) {
        await this.#swapDeckSource(audio, state.originalSrc);
      }
      state.appliedSrc = '';
      state.stemMode = null;
      state.processing = false;
      return;
    }

    if (!currentSrc) return;
    if (state.processing && !force) return;

    const baseSrc = isAppliedSrc ? state.originalSrc : currentSrc;
    if (!baseSrc) return;

    if (!force && state.stemMode === mode && isAppliedSrc) return;

    const token = state.token + 1;
    state.token = token;
    state.processing = true;

    try {
      const provided = state.providedStems || {};
      const stems = {
        vocalsUrl: typeof provided.vocalsUrl === 'string' ? provided.vocalsUrl : '',
        instrumentalUrl: typeof provided.instrumentalUrl === 'string' ? provided.instrumentalUrl : '',
        echoUrl: typeof provided.echoUrl === 'string' ? provided.echoUrl : '',
        distortionUrl: typeof provided.distortionUrl === 'string' ? provided.distortionUrl : '',
      };
      const nextStemSrc = mode === 'instruRemove'
        ? stems.vocalsUrl
        : mode === 'vocalRemove'
          ? stems.instrumentalUrl
          : stems.echoUrl;
      if (!nextStemSrc) return;
      if (state.token !== token) return;

      await this.#swapDeckSource(audio, nextStemSrc);
      if (state.token !== token) return;

      state.originalSrc = baseSrc;
      state.appliedSrc = nextStemSrc;
      state.stemMode = mode;
      console.debug('[mixFeatures] syncDeckStemMode: deck=%s mode=%s applied', deck, mode);
    } catch (err) {
      console.debug('[mixFeatures] syncDeckStemMode: deck=%s error', deck, err);
      // Keep playback alive when model loading/inference fails.
    } finally {
      if (state.token === token) state.processing = false;
    }
  }

  async #syncAllDeckStemModes(force = false, restoreOnly = false) {
    await Promise.all([
      this.#syncDeckStemMode('A', force, restoreOnly),
      this.#syncDeckStemMode('B', force, restoreOnly),
    ]);
  }

  #applyDeckToneFilter(deck) {
    const node = this.#nodes(deck);
    const filter = node?.toneFilter;
    if (!filter) return;

    const rawMode = this.#settings.deckFx?.[deck]?.filterMode;
    const mode = rawMode === 'lowPass' || rawMode === 'highPass' ? rawMode : 'off';

    if (mode === 'lowPass') {
      filter.type = 'lowpass';
      this.#setParamSmooth(filter.frequency, 1400);
      this.#setParamSmooth(filter.Q, 0.85);
      return;
    }

    if (mode === 'highPass') {
      filter.type = 'highpass';
      this.#setParamSmooth(filter.frequency, 280);
      this.#setParamSmooth(filter.Q, 0.8);
      return;
    }

    filter.type = 'allpass';
    this.#setParamSmooth(filter.frequency, 18000);
    this.#setParamSmooth(filter.Q, 0.7);
  }

  #apply() {
    if (!this.#ready) return;

    const { echo, distortion, autoBpm } = this.#settings;
    console.debug('[mixFeatures] apply: echo=%s distortion=%s autoBpm=%s deckFx=%o', echo, distortion, autoBpm, this.#settings.deckFx);

    for (const deck of ['A', 'B']) {
      const n = this.#nodes(deck);
      // Start from neutral mix values, then effect sync reapplies active settings.
      n.wet.gain.value = 0;
      n.dry.gain.value = 1;
      n.distWet.gain.value = 0;
      n.distDry.gain.value = 1;
      n.distBaseSend.gain.value = 0;
      n.distStemSend.gain.value = 0;
      n.echoBaseSend.gain.value = 1;
      n.echoStemSend.gain.value = 0;
      n.echoStemAudio?.pause?.();
      n.distortionStemAudio?.pause?.();
      this.#applyDeckToneFilter(deck);
    }

    this.#syncAllDeckEchoStemSources(true);
    this.#syncAllDeckDistortionStemSources(true);
    void this.#syncAllDeckStemModes(true);

    if (!autoBpm) {
      this.#audioA.playbackRate += (1 - this.#audioA.playbackRate) * 0.25;
      this.#audioB.playbackRate += (1 - this.#audioB.playbackRate) * 0.25;
    }
  }
}