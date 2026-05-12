// ─── Constants ────────────────────────────────────────────────────────────────

const FFT_SIZE        = 1024;
const SMOOTH_TAU      = 0.08;   // seconds – AudioParam setTargetAtTime time-constant
const SMOOTH_JS       = 0.34;   // fallback lerp alpha (kept for computeAdaptiveMidSideGains)
const ENERGY_EPSILON  = 1e-4;
const DISTORTION_K    = 140;
const ECHO_DELAY_S    = 0.22;
const ECHO_FEEDBACK   = 0.28;

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
  return { A: { vocalRemove: false, instruRemove: false },
           B: { vocalRemove: false, instruRemove: false } };
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

    this.#audioCtx = new Ctx();
    this.#nodesA   = this.#buildDeck(this.#audioA);
    this.#nodesB   = this.#buildDeck(this.#audioB);
    this.#ready    = true;
    this.#apply();
  }

  async setEnabled(next) {
    this.#settings = mergeSettings(this.#settings, next);

    const { autoBpm, echo, distortion, deckFx } = this.#settings;
    const needsCtx = autoBpm || echo || distortion
      || deckFx.A.vocalRemove || deckFx.A.instruRemove
      || deckFx.B.vocalRemove || deckFx.B.instruRemove;

    if (needsCtx) await this.ensureReady();
    this.#apply();
  }

  /**
   * Call from your animation / rAF loop.
   * autoBpm syncs playback rates; adaptive M/S gains are updated here via AudioParam.
   */
  tick(activeDeck) {
    if (!this.#ready) return;

    const { autoBpm, deckFx } = this.#settings;

    if (autoBpm && !this.#audioA.paused && !this.#audioB.paused) {
      const active   = activeDeck === 'B' ? this.#audioB : this.#audioA;
      const inactive = activeDeck === 'B' ? this.#audioA : this.#audioB;

      const delta      = active.currentTime - inactive.currentTime;
      const targetRate = clamp(1 + delta * 0.02, 0.94, 1.06);
      inactive.playbackRate += (targetRate - inactive.playbackRate) * 0.2;
      active.playbackRate   += (1 - active.playbackRate) * 0.1;
    }

    if (deckFx.A.vocalRemove || deckFx.A.instruRemove) this.#tickMsAdaptive('A');
    if (deckFx.B.vocalRemove || deckFx.B.instruRemove) this.#tickMsAdaptive('B');
  }

  destroy() {
    if (this.#audioA) this.#audioA.playbackRate = 1;
    if (this.#audioB) this.#audioB.playbackRate = 1;
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

    // ── Graph ────────────────────────────────────────────────────────────────
    source.connect(preGain);

    preGain.connect(dry);
    preGain.connect(delay);
    delay.connect(feedback); feedback.connect(delay);
    delay.connect(wet);

    dry.connect(distDry); wet.connect(distDry);
    dry.connect(distNode); wet.connect(distNode);
    distNode.connect(distWet);

    distDry.connect(ms.input);
    distWet.connect(ms.input);
    ms.output.connect(ctx.destination);

    return { wet, dry, distWet, distDry, ms };
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

  #apply() {
    if (!this.#ready) return;

    const { echo, distortion, autoBpm, deckFx } = this.#settings;

    for (const deck of ['A', 'B']) {
      const n = this.#nodes(deck);
      n.wet.gain.value     = echo       ? 0.35 : 0;
      n.dry.gain.value     = 1;
      n.distWet.gain.value = distortion ? 0.35 : 0;
      n.distDry.gain.value = 1;

      const fx = deckFx[deck];
      if (fx.vocalRemove || fx.instruRemove) this.#tickMsAdaptive(deck);
      else this.#resetMs(deck);
    }

    if (!autoBpm) {
      this.#audioA.playbackRate += (1 - this.#audioA.playbackRate) * 0.25;
      this.#audioB.playbackRate += (1 - this.#audioB.playbackRate) * 0.25;
    }
  }
}