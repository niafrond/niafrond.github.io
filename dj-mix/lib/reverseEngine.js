// True "reverse" FX/transition audio (SPEC-1.3.6.6 / SPEC-13.x): sample-accurate reversal of a
// short window of the track, played through the same Web Audio graph as normal playback — as
// opposed to the previous approach (repeated hard `HTMLAudioElement.currentTime` jumps while the
// element kept playing forward underneath), which produced audible clicks at every jump instead
// of a continuous "song playing backward" sensation. Mirrors lib/loopMorphEngine.js's own
// transient-decode pattern (fetch the deck's already-local blob: URL, decodeAudioData, retain only
// a small window) — see LoopMorphEngine#prepare for the precedent.

const DECODE_WINDOW_MARGIN_SEC = 0.15;
// Short linear fade at both ends of the grain so its start/stop never clicks — long enough to be
// effective at typical grain lengths (a few hundred ms), short enough to stay inaudible as a fade.
const GRAIN_FADE_SEC = 0.012;

/**
 * Decodes `url` (a local blob:, no network cost) and returns a NEW AudioBuffer holding the
 * `windowSec` immediately preceding `anchorSec`, with every channel's samples in reverse order —
 * playing the result forward therefore sounds exactly like the source playing backward from
 * `anchorSec` down to `anchorSec - windowSec`. The full decode is transient (discarded right
 * after); only the small window is retained.
 */
export async function prepareReversedWindow(ctx, url, anchorSec, windowSec) {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const fullBuffer = await ctx.decodeAudioData(arrayBuffer);

  const sampleRate = fullBuffer.sampleRate;
  const wantedSamples = Math.max(1, Math.ceil((windowSec + DECODE_WINDOW_MARGIN_SEC) * sampleRate));
  const endSample = Math.max(1, Math.min(fullBuffer.length, Math.round(anchorSec * sampleRate)));
  const startSample = Math.max(0, endSample - wantedSamples);
  const length = Math.max(1, endSample - startSample);

  const reversed = ctx.createBuffer(fullBuffer.numberOfChannels, length, sampleRate);
  for (let ch = 0; ch < fullBuffer.numberOfChannels; ch++) {
    const src = fullBuffer.getChannelData(ch);
    const dst = reversed.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      dst[i] = src[endSample - 1 - i] ?? 0;
    }
  }
  return reversed;
}

export class ReverseGrainEngine {
  #node = null;
  #gainNode = null;

  /**
   * Schedules `audioBuffer` (already reversed — see prepareReversedWindow) to play once, through
   * a short fade-in/fade-out gain envelope (click-free grain boundaries), at `playbackRate`.
   * Fire-and-forget from the AudioContext's own clock — callers that need to know when it's
   * audibly done use the buffer's own duration (`audioBuffer.duration / playbackRate`), same as
   * every other caller of this engine already computes up front to size its own wait.
   */
  run({ ctx, destinationBus, audioBuffer, playbackRate = 1 }) {
    this.stop();

    const node = ctx.createBufferSource();
    node.buffer = audioBuffer;
    if (playbackRate !== 1) node.playbackRate.setValueAtTime(playbackRate, ctx.currentTime);

    const gainNode = ctx.createGain();
    const t0 = ctx.currentTime;
    const durationSec = audioBuffer.duration / playbackRate;
    const fadeSec = Math.min(GRAIN_FADE_SEC, durationSec / 4);

    gainNode.gain.setValueAtTime(0, t0);
    gainNode.gain.linearRampToValueAtTime(1, t0 + fadeSec);
    gainNode.gain.setValueAtTime(1, Math.max(t0 + fadeSec, t0 + durationSec - fadeSec));
    gainNode.gain.linearRampToValueAtTime(0, t0 + durationSec);

    node.connect(gainNode);
    gainNode.connect(destinationBus);
    node.start(t0);
    node.stop(t0 + durationSec + 0.02); // small safety margin past the fade-out

    this.#node = node;
    this.#gainNode = gainNode;

    return { durationSec };
  }

  /** Idempotent hard-cancel — safe to call before run() or multiple times. */
  stop() {
    if (this.#node) {
      try { this.#node.stop(); } catch { /* already stopped */ }
      try { this.#node.disconnect(); } catch { /* already disconnected */ }
    }
    if (this.#gainNode) {
      try { this.#gainNode.disconnect(); } catch { /* already disconnected */ }
    }
    this.#node = null;
    this.#gainNode = null;
  }
}
