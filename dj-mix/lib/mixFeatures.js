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

// ─── Constants ────────────────────────────────────────────────────────────────

const FFT_SIZE        = 1024;
const SMOOTH_TAU      = 0.08;   // seconds – AudioParam setTargetAtTime time-constant
const SMOOTH_JS       = 0.34;   // fallback lerp alpha (kept for computeAdaptiveMidSideGains)
const ENERGY_EPSILON  = 1e-4;
const DISTORTION_K    = 140;
const ECHO_DELAY_S    = 0.22;
const ECHO_FEEDBACK   = 0.28;
const STEM_SYNC_INTERVAL_MS = 1200;

const DEMUCS_WEB_MODULE_URL = 'https://cdn.jsdelivr.net/npm/demucs-web@1.0.2/+esm';
const ONNX_RUNTIME_MODULE_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort.min.mjs';

// ─── Tiny utilities ───────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

let _demucsRuntimePromise = null;

async function loadDemucsRuntime() {
  if (_demucsRuntimePromise) return _demucsRuntimePromise;

  _demucsRuntimePromise = (async () => {
    console.debug('[mixFeatures] loadDemucsRuntime: start');
    const [demucsModule, ortModule] = await Promise.all([
      import(DEMUCS_WEB_MODULE_URL),
      import(ONNX_RUNTIME_MODULE_URL),
    ]);

    const ort = ortModule.default || ortModule;
    if (ort?.env?.wasm) {
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.simd = true;
    }

    console.debug('[mixFeatures] loadDemucsRuntime: ready');
    return {
      DemucsProcessor: demucsModule.DemucsProcessor,
      CONSTANTS: demucsModule.CONSTANTS,
      ort,
    };
  })().catch((err) => {
    console.debug('[mixFeatures] loadDemucsRuntime: error', err);
    _demucsRuntimePromise = null;
    throw err;
  });

  return _demucsRuntimePromise;
}

function encodeStereoWav(left, right, sampleRate = 44100) {
  const length = Math.min(left?.length || 0, right?.length || 0);
  const bytesPerSample = 2;
  const blockAlign = 2 * bytesPerSample;
  const dataSize = length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  let offset = 0;
  const writeStr = (s) => {
    for (let i = 0; i < s.length; i += 1) view.setUint8(offset + i, s.charCodeAt(i));
    offset += s.length;
  };

  writeStr('RIFF');
  view.setUint32(offset, 36 + dataSize, true); offset += 4;
  writeStr('WAVE');
  writeStr('fmt ');
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2; // PCM
  view.setUint16(offset, 2, true); offset += 2; // Stereo
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, sampleRate * blockAlign, true); offset += 4;
  view.setUint16(offset, blockAlign, true); offset += 2;
  view.setUint16(offset, bytesPerSample * 8, true); offset += 2;
  writeStr('data');
  view.setUint32(offset, dataSize, true); offset += 4;

  for (let i = 0; i < length; i += 1) {
    const l = clamp(left[i] || 0, -1, 1);
    const r = clamp(right[i] || 0, -1, 1);
    view.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7fff, true); offset += 2;
    view.setInt16(offset, r < 0 ? r * 0x8000 : r * 0x7fff, true); offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

async function decodeAsStereo44100(ctx, arrayBuffer) {
  const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
  if (!decoded) return null;

  const targetRate = 44100;
  const duration = Math.max(0.01, decoded.duration || 0);
  const frameCount = Math.max(1, Math.ceil(duration * targetRate));
  const offline = new OfflineAudioContext(2, frameCount, targetRate);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start(0);

  const rendered = await offline.startRendering();
  const left = new Float32Array(rendered.getChannelData(0));
  const right = rendered.numberOfChannels > 1
    ? new Float32Array(rendered.getChannelData(1))
    : new Float32Array(rendered.getChannelData(0));

  return { left, right };
}

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
  #demucsProcessor = null;
  #demucsUnavailable = false;
  #stemCache = new Map();
  #deckStemState = {
    A: { originalSrc: '', appliedSrc: '', stemMode: null, token: 0, processing: false, providedStems: { vocalsUrl: '', instrumentalUrl: '' } },
    B: { originalSrc: '', appliedSrc: '', stemMode: null, token: 0, processing: false, providedStems: { vocalsUrl: '', instrumentalUrl: '' } },
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
    };

    state.originalSrc = url;
    state.appliedSrc = '';
    state.stemMode = null;
    state.providedStems = stems;

    if (this.#ready) {
      void this.#syncDeckStemMode(d, true, false);
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
    }
  }

  destroy() {
    console.debug('[mixFeatures] destroy');
    void this.#syncAllDeckStemModes(true, true);
    if (this.#audioA) this.#audioA.playbackRate = 1;
    if (this.#audioB) this.#audioB.playbackRate = 1;
    this.#audioCtx?.close().catch(() => {});
    this.#audioCtx = null;
    this.#nodesA = this.#nodesB = null;
    for (const stems of this.#stemCache.values()) {
      if (stems.vocalsUrl) URL.revokeObjectURL(stems.vocalsUrl);
      if (stems.instrumentalUrl) URL.revokeObjectURL(stems.instrumentalUrl);
    }
    this.#stemCache.clear();
    this.#demucsProcessor = null;
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

  #deckMode(deck) {
    const fx = this.#settings.deckFx?.[deck];
    if (fx?.vocalRemove) return 'vocalRemove';
    if (fx?.instruRemove) return 'instruRemove';
    return null;
  }

  #deckAudio(deck) {
    return deck === 'B' ? this.#audioB : this.#audioA;
  }

  async #ensureDemucsProcessor() {
    if (this.#demucsProcessor) return this.#demucsProcessor;
    if (this.#demucsUnavailable) throw new Error('demucs.unavailable');

    console.debug('[mixFeatures] ensureDemucsProcessor: loading model…');
    try {
      const runtime = await loadDemucsRuntime();
      const processor = new runtime.DemucsProcessor({
        ort: runtime.ort,
        sessionOptions: {
          enableCpuMemArena: false,
          enableMemPattern: false,
        },
      });

      await processor.loadModel(runtime.CONSTANTS?.DEFAULT_MODEL_URL);
      this.#demucsProcessor = processor;
      console.debug('[mixFeatures] ensureDemucsProcessor: model loaded');
      return processor;
    } catch (err) {
      console.debug('[mixFeatures] ensureDemucsProcessor: error', err);
      this.#demucsUnavailable = true;
      throw err;
    }
  }

  async #getOrCreateStems(sourceUrl) {
    const cached = this.#stemCache.get(sourceUrl);
    if (cached) {
      console.debug('[mixFeatures] getOrCreateStems: cache hit', sourceUrl);
      return cached;
    }

    console.debug('[mixFeatures] getOrCreateStems: separating stems for', sourceUrl);
    const processor = await this.#ensureDemucsProcessor();
    const response = await fetch(sourceUrl);
    if (!response.ok) throw new Error(`stem.fetch.failed:${response.status}`);

    const arrayBuffer = await response.arrayBuffer();
    const stereo = await decodeAsStereo44100(this.#audioCtx, arrayBuffer);
    if (!stereo) throw new Error('stem.decode.failed');

    const result = await processor.separate(stereo.left, stereo.right);

    const vocalsLeft = result?.vocals?.left;
    const vocalsRight = result?.vocals?.right;
    if (!vocalsLeft || !vocalsRight) throw new Error('stem.vocals.missing');

    const len = vocalsLeft.length;
    const instrumentalLeft = new Float32Array(len);
    const instrumentalRight = new Float32Array(len);
    const tracks = ['drums', 'bass', 'other'];

    for (const track of tracks) {
      const t = result?.[track];
      if (!t?.left || !t?.right) continue;
      for (let i = 0; i < len; i += 1) {
        instrumentalLeft[i] += t.left[i] || 0;
        instrumentalRight[i] += t.right[i] || 0;
      }
    }

    const stems = {
      vocalsUrl: URL.createObjectURL(encodeStereoWav(vocalsLeft, vocalsRight, 44100)),
      instrumentalUrl: URL.createObjectURL(encodeStereoWav(instrumentalLeft, instrumentalRight, 44100)),
    };

    this.#stemCache.set(sourceUrl, stems);
    console.debug('[mixFeatures] getOrCreateStems: done', sourceUrl);
    return stems;
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
      const providedVocals = typeof provided.vocalsUrl === 'string' ? provided.vocalsUrl : '';
      const providedInstrumental = typeof provided.instrumentalUrl === 'string' ? provided.instrumentalUrl : '';
      const needsVocals = mode === 'instruRemove';
      const hasRequiredProvided = needsVocals ? !!providedVocals : !!providedInstrumental;
      const stems = hasRequiredProvided
        ? {
            vocalsUrl: providedVocals,
            instrumentalUrl: providedInstrumental,
          }
        : await this.#getOrCreateStems(baseSrc);
      if (state.token !== token) return;

      const nextStemSrc = mode === 'instruRemove' ? stems.vocalsUrl : stems.instrumentalUrl;
      if (!nextStemSrc) return;

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

  #apply() {
    if (!this.#ready) return;

    const { echo, distortion, autoBpm } = this.#settings;
    console.debug('[mixFeatures] apply: echo=%s distortion=%s autoBpm=%s deckFx=%o', echo, distortion, autoBpm, this.#settings.deckFx);

    for (const deck of ['A', 'B']) {
      const n = this.#nodes(deck);
      n.wet.gain.value     = echo       ? 0.35 : 0;
      n.dry.gain.value     = 1;
      n.distWet.gain.value = distortion ? 0.35 : 0;
      n.distDry.gain.value = 1;

      // Legacy M/S shaping is disabled when using Demucs stems.
      this.#resetMs(deck);
    }

    void this.#syncAllDeckStemModes(true);

    if (!autoBpm) {
      this.#audioA.playbackRate += (1 - this.#audioA.playbackRate) * 0.25;
      this.#audioB.playbackRate += (1 - this.#audioB.playbackRate) * 0.25;
    }
  }
}