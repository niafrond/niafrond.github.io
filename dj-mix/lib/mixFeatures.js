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

export class SimpleMixFeatures {
  #audioA;
  #audioB;
  #audioCtx = null;
  #ready = false;
  #settings = {
    autoBpm: false,
    echo: false,
    distortion: false,
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

    const anyEnabled = this.#settings.autoBpm || this.#settings.echo || this.#settings.distortion;
    if (anyEnabled) await this.ensureReady();
    this.#applySettings();
  }

  tick(activeDeck) {
    if (!this.#settings.autoBpm) return;
    if (!this.#audioA || !this.#audioB) return;

    const active = activeDeck === 'B' ? this.#audioB : this.#audioA;
    const inactive = activeDeck === 'B' ? this.#audioA : this.#audioB;

    if (active.paused || inactive.paused) return;

    const delta = active.currentTime - inactive.currentTime;
    const targetRate = clamp(1 + (delta * 0.02), 0.94, 1.06);
    inactive.playbackRate = inactive.playbackRate + ((targetRate - inactive.playbackRate) * 0.2);
    active.playbackRate = active.playbackRate + ((1 - active.playbackRate) * 0.1);
  }

  destroy() {
    if (this.#audioA) this.#audioA.playbackRate = 1;
    if (this.#audioB) this.#audioB.playbackRate = 1;

    if (this.#audioCtx) {
      this.#audioCtx.close().catch(() => {});
      this.#audioCtx = null;
    }

    this.#ready = false;
    this.#nodesA = null;
    this.#nodesB = null;
  }

  #createDeckChain(audioEl) {
    const source = this.#audioCtx.createMediaElementSource(audioEl);
    const preGain = this.#audioCtx.createGain();

    const delay = this.#audioCtx.createDelay(0.8);
    delay.delayTime.value = 0.22;

    const feedback = this.#audioCtx.createGain();
    feedback.gain.value = 0.28;

    const wet = this.#audioCtx.createGain();
    wet.gain.value = 0;

    const dry = this.#audioCtx.createGain();
    dry.gain.value = 1;

    const distortion = this.#audioCtx.createWaveShaper();
    distortion.curve = makeDistortionCurve(140);
    distortion.oversample = '4x';

    const distWet = this.#audioCtx.createGain();
    distWet.gain.value = 0;

    const distDry = this.#audioCtx.createGain();
    distDry.gain.value = 1;

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

    distDry.connect(this.#audioCtx.destination);
    distWet.connect(this.#audioCtx.destination);

    return {
      wet,
      dry,
      distWet,
      distDry,
    };
  }

  #applySettings() {
    if (!this.#ready || !this.#nodesA || !this.#nodesB) return;

    const echoOn = this.#settings.echo;
    const distOn = this.#settings.distortion;

    for (const nodes of [this.#nodesA, this.#nodesB]) {
      nodes.wet.gain.value = echoOn ? 0.35 : 0;
      nodes.dry.gain.value = 1;

      nodes.distWet.gain.value = distOn ? 0.35 : 0;
      nodes.distDry.gain.value = 1;
    }

    if (!this.#settings.autoBpm) {
      this.#audioA.playbackRate = this.#audioA.playbackRate + ((1 - this.#audioA.playbackRate) * 0.25);
      this.#audioB.playbackRate = this.#audioB.playbackRate + ((1 - this.#audioB.playbackRate) * 0.25);
    }
  }
}
