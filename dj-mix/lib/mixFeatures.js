function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeDistortionCurve(amount = 120) {
  const nSamples = 44100;
  const curve = new Float32Array(nSamples);
  const k = typeof amount === 'number' ? amount : 120;
  const deg = Math.PI / 180;

  for (let i = 0; i < nSamples; i += 1) {
    const x = (i * 2) / nSamples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + (k * Math.abs(x)));
  }

  return curve;
}

/**
 * Builds a Mid/Side encoder–decoder chain for a stereo source.
 *
 * Mid  = (L + R) / 2  → carries centred content (vocals)
 * Side = (L − R) / 2  → carries wide content (instruments panned off-centre)
 *
 * By muting Mid we remove vocals; by muting Side we isolate vocals.
 *
 * Returns { input, midGain, sideGain, output }
 */
function createMidSideChain(ctx) {
  // --- Encode ---
  const splitter = ctx.createChannelSplitter(2);      // L / R

  const midMerger = ctx.createChannelMerger(2);       // L+R (mid)
  const sideMerger = ctx.createChannelMerger(2);      // L-R (side)

  // Mid = L + R  (each at gain 0.5 to normalise)
  const midGainL = ctx.createGain(); midGainL.gain.value = 0.5;
  const midGainR = ctx.createGain(); midGainR.gain.value = 0.5;

  // Side = L - R
  const sideGainL = ctx.createGain(); sideGainL.gain.value =  0.5;
  const sideGainR = ctx.createGain(); sideGainR.gain.value = -0.5;

  splitter.connect(midGainL, 0);
  splitter.connect(midGainR, 1);
  splitter.connect(sideGainL, 0);
  splitter.connect(sideGainR, 1);

  // Mid bus: both L and R feed channel 0 and 1 of midMerger
  midGainL.connect(midMerger, 0, 0);
  midGainL.connect(midMerger, 0, 1);
  midGainR.connect(midMerger, 0, 0);
  midGainR.connect(midMerger, 0, 1);

  // Side bus
  sideGainL.connect(sideMerger, 0, 0);
  sideGainL.connect(sideMerger, 0, 1);
  sideGainR.connect(sideMerger, 0, 0);
  sideGainR.connect(sideMerger, 0, 1);

  // Controllable gains on mid & side
  const midGain  = ctx.createGain(); midGain.gain.value  = 1;
  const sideGain = ctx.createGain(); sideGain.gain.value = 1;

  midMerger.connect(midGain);
  sideMerger.connect(sideGain);

  // --- Decode ---
  // Output L = Mid + Side,  Output R = Mid − Side
  const outMerger = ctx.createChannelMerger(2);

  const decMidL  = ctx.createGain(); decMidL.gain.value  =  1;
  const decMidR  = ctx.createGain(); decMidR.gain.value  =  1;
  const decSideL = ctx.createGain(); decSideL.gain.value =  1;
  const decSideR = ctx.createGain(); decSideR.gain.value = -1;

  midGain.connect(decMidL);
  midGain.connect(decMidR);
  sideGain.connect(decSideL);
  sideGain.connect(decSideR);

  decMidL.connect(outMerger,  0, 0);   // → L
  decSideL.connect(outMerger, 0, 0);   // → L
  decMidR.connect(outMerger,  0, 1);   // → R
  decSideR.connect(outMerger, 0, 1);   // → R

  return {
    input:    splitter,
    midGain,
    sideGain,
    output:   outMerger,
  };
}

export class SimpleMixFeatures {
  #audioA;
  #audioB;
  #audioCtx = null;
  #ready = false;
  #settings = {
    autoBpm:      false,
    echo:         false,
    distortion:   false,
    vocalRemove:  false,   // suppress vocals (mid), keep instruments
    instruRemove:  false,   // suppress instruments (side), keep vocals
  };

  #nodesA = null;
  #nodesB = null;

  constructor(audioA, audioB) {
    this.#audioA = audioA;
    this.#audioB = audioB;
  }

  async ensureReady() {
    if (this.#ready || !this.#audioA || !this.#audioB) return;

    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;

    this.#audioCtx = new Ctx();

    this.#nodesA = this.#createDeckChain(this.#audioA);
    this.#nodesB = this.#createDeckChain(this.#audioB);

    this.#ready = true;
    this.#applySettings();
  }

  async setEnabled(next) {
    this.#settings = {
      ...this.#settings,
      ...next,
    };

    // vocalRemove and instruRemove are mutually exclusive
    if (next.vocalRemove)  this.#settings.instruRemove = false;
    if (next.instruRemove)  this.#settings.vocalRemove = false;

    const anyEnabled =
      this.#settings.autoBpm    ||
      this.#settings.echo       ||
      this.#settings.distortion ||
      this.#settings.vocalRemove ||
      this.#settings.instruRemove;

    if (anyEnabled) await this.ensureReady();
    this.#applySettings();
  }

  tick(activeDeck) {
    if (!this.#settings.autoBpm) return;
    if (!this.#audioA || !this.#audioB) return;

    const active   = activeDeck === 'B' ? this.#audioB : this.#audioA;
    const inactive = activeDeck === 'B' ? this.#audioA : this.#audioB;

    if (active.paused || inactive.paused) return;

    const delta      = active.currentTime - inactive.currentTime;
    const targetRate = clamp(1 + (delta * 0.02), 0.94, 1.06);
    inactive.playbackRate = inactive.playbackRate + ((targetRate - inactive.playbackRate) * 0.2);
    active.playbackRate   = active.playbackRate   + ((1 - active.playbackRate) * 0.1);
  }

  destroy() {
    if (this.#audioA) this.#audioA.playbackRate = 1;
    if (this.#audioB) this.#audioB.playbackRate = 1;

    if (this.#audioCtx) {
      this.#audioCtx.close().catch(() => {});
      this.#audioCtx = null;
    }

    this.#ready   = false;
    this.#nodesA  = null;
    this.#nodesB  = null;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  #createDeckChain(audioEl) {
    const source  = this.#audioCtx.createMediaElementSource(audioEl);
    const preGain = this.#audioCtx.createGain();

    // Echo chain
    const delay    = this.#audioCtx.createDelay(0.8);
    delay.delayTime.value = 0.22;
    const feedback = this.#audioCtx.createGain(); feedback.gain.value = 0.28;
    const wet      = this.#audioCtx.createGain(); wet.gain.value      = 0;
    const dry      = this.#audioCtx.createGain(); dry.gain.value      = 1;

    // Distortion chain
    const distortion = this.#audioCtx.createWaveShaper();
    distortion.curve      = makeDistortionCurve(140);
    distortion.oversample = '4x';
    const distWet = this.#audioCtx.createGain(); distWet.gain.value = 0;
    const distDry = this.#audioCtx.createGain(); distDry.gain.value = 1;

    // Mid/Side chain (vocal / instrumental removal)
    const ms = createMidSideChain(this.#audioCtx);

    // Routing: source → preGain → echo → distortion → mid/side → destination
    source.connect(preGain);

    preGain.connect(dry);
    preGain.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);

    dry.connect(distDry);
    wet.connect(distDry);
    dry.connect(distortion);
    wet.connect(distortion);
    distortion.connect(distWet);

    // distDry & distWet → mid/side input
    distDry.connect(ms.input);
    distWet.connect(ms.input);

    // mid/side output → destination
    ms.output.connect(this.#audioCtx.destination);

    return { wet, dry, distWet, distDry, ms };
  }

  #applySettings() {
    if (!this.#ready || !this.#nodesA || !this.#nodesB) return;

    const echoOn        = this.#settings.echo;
    const distOn        = this.#settings.distortion;
    const vocalRemove   = this.#settings.vocalRemove;
    const instruRemove   = this.#settings.instruRemove;

    for (const nodes of [this.#nodesA, this.#nodesB]) {
      // Echo
      nodes.wet.gain.value = echoOn ? 0.35 : 0;
      nodes.dry.gain.value = 1;

      // Distortion
      nodes.distWet.gain.value = distOn ? 0.35 : 0;
      nodes.distDry.gain.value = 1;

      // Mid/Side
      // vocalRemove  → mute Mid (0), keep Side (1)  ⇒ karaoke / instru only
      // instruRemove  → mute Side (0), keep Mid (1)  ⇒ vocals only
      // both off     → pass-through (1 / 1)
      nodes.ms.midGain.gain.value  = vocalRemove ? 0 : 1;
      nodes.ms.sideGain.gain.value = instruRemove ? 0 : 1;
    }

    if (!this.#settings.autoBpm) {
      this.#audioA.playbackRate = this.#audioA.playbackRate + ((1 - this.#audioA.playbackRate) * 0.25);
      this.#audioB.playbackRate = this.#audioB.playbackRate + ((1 - this.#audioB.playbackRate) * 0.25);
    }
  }
}