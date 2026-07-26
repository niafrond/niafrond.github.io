// beat_repeat: capture a beat-grid-aligned loop on the outgoing deck and shorten it
// progressively (2 repetitions per length, then halve) down to an absolute floor of 1/16
// beat, then hand off to the next track on the next bar boundary. See SPECS.md §1.3.5/§1.3.8.
//
// This module is split in two:
//  - pure, framework-free functions (the beat-math) — fully unit-testable with no mocking.
//  - `BeatRepeatEngine`, a thin Web Audio scheduling layer: every stage's start/stop/crossfade
//    is computed once, up front, against the AudioContext clock (not a reactive poll), which is
//    what makes the timing sample-accurate and deterministic.

// ─── Pure constants ───────────────────────────────────────────────────────────

export const BEAT_REPEAT_FLOOR_BEATS = 1 / 16;
export const BEAT_REPEAT_DEFAULT_INITIAL_BEATS = 8;
export const BEAT_REPEAT_FALLBACK_INITIAL_BEATS = 4;
export const BEAT_REPEAT_MIN_INITIAL_BEATS = 2;
export const BEAT_REPEAT_BEATS_PER_BAR = 4;
export const BEAT_REPEAT_FX_STAGE_COUNT = 2;
// Final deck-to-deck volume crossfade (HTMLAudioElement.volume, not the buffer engine's own
// internal click-avoidance fades) once the bar boundary is reached and Track B takes over.
export const BEAT_REPEAT_LAUNCH_OVERLAP_MS = 300;
const BEAT_REPEAT_DEFAULT_BPM = 120;
const BEAT_REPEAT_MIN_BPM = 60;
const BEAT_REPEAT_MAX_BPM = 220;

export function getSafeBeatRepeatBpm(bpm) {
  const value = Number(bpm);
  if (!Number.isFinite(value) || value <= 0) return BEAT_REPEAT_DEFAULT_BPM;
  return Math.max(BEAT_REPEAT_MIN_BPM, Math.min(BEAT_REPEAT_MAX_BPM, value));
}

// Step 2: "Initial loop length: default 8 beats; if fewer than 8 beats remain before the
// transition point, use 4 beats; never start with less than 2 beats." `desiredInitialBeats`
// is the caller's configured preference (default 8); remainingBeats is how much of the
// outgoing track is actually left to loop through (Infinity if unknown/unbounded).
export function chooseInitialLoopBeats(remainingBeats, desiredInitialBeats = BEAT_REPEAT_DEFAULT_INITIAL_BEATS) {
  const rawDesired = Number.isFinite(desiredInitialBeats) && desiredInitialBeats > 0
    ? desiredInitialBeats
    : BEAT_REPEAT_DEFAULT_INITIAL_BEATS;
  // "Never start with less than 2 beats" applies even if the caller configured a lower
  // desired value — the absolute floor always wins.
  const safeDesired = Math.max(BEAT_REPEAT_MIN_INITIAL_BEATS, rawDesired);

  const half = safeDesired / 2;
  const ladder = [safeDesired];
  if (half >= BEAT_REPEAT_MIN_INITIAL_BEATS && half < safeDesired) ladder.push(half);
  if (!ladder.includes(BEAT_REPEAT_MIN_INITIAL_BEATS)) ladder.push(BEAT_REPEAT_MIN_INITIAL_BEATS);

  if (!Number.isFinite(remainingBeats)) return ladder[0];
  for (const candidate of ladder) {
    if (remainingBeats >= candidate) return candidate;
  }
  return BEAT_REPEAT_MIN_INITIAL_BEATS;
}

// Steps 3-5: "Repeat the current loop twice. Divide the loop length by 2. Repeat until
// reaching 1/16 beat." The floor is absolute (not relative to initialBeats): starting from a
// smaller initial length produces fewer halving stages, not a rescaled sequence.
// buildBeatRepeatStageBeats(8) -> [8,4,2,1,.5,.25,.125,.0625] (matches the given sequence).
export function buildBeatRepeatStageBeats(initialBeats = BEAT_REPEAT_DEFAULT_INITIAL_BEATS) {
  const safeInitial = Number.isFinite(initialBeats) && initialBeats > 0
    ? initialBeats
    : BEAT_REPEAT_DEFAULT_INITIAL_BEATS;
  const stages = [];
  let length = safeInitial;
  while (length - BEAT_REPEAT_FLOOR_BEATS > 1e-9) {
    stages.push(length);
    length /= 2;
  }
  stages.push(BEAT_REPEAT_FLOOR_BEATS);
  return stages;
}

// Step 8: "On the next bar boundary after the final reduction..." — the next multiple of
// `beatsPerBar` STRICTLY after every stage (including the floor) has played its mandatory 2
// repetitions, so the floor length always gets played at least twice before Track B launches.
export function computeBeatRepeatLaunchBeats(stageBeats, beatsPerBar = BEAT_REPEAT_BEATS_PER_BAR) {
  const safeBeatsPerBar = Number.isFinite(beatsPerBar) && beatsPerBar > 0 ? beatsPerBar : BEAT_REPEAT_BEATS_PER_BAR;
  const minLoopedBeats = stageBeats.reduce((sum, beats) => sum + (beats * 2), 0);
  let launchBeats = Math.ceil(minLoopedBeats / safeBeatsPerBar) * safeBeatsPerBar;
  if (launchBeats <= minLoopedBeats) launchBeats += safeBeatsPerBar;
  return launchBeats;
}

// Step 1: "Detect a valid loop start aligned to the beat grid." Snaps the current playhead to
// the nearest beat boundary, assuming beat-phase-zero at track start (t=0 on-grid) — the
// simplest honest approach given the app has no downbeat/phase-offset metadata, only a scalar
// BPM per track. Real tracks with intros/pickup notes can be measurably off this anchor; still
// strictly better than no snapping at all.
export function computeLoopAnchorSeconds(currentTimeSec, secondsPerBeat) {
  if (!Number.isFinite(currentTimeSec) || currentTimeSec < 0) return 0;
  if (!Number.isFinite(secondsPerBeat) || secondsPerBeat <= 0) return Math.max(0, currentTimeSec);
  const beatIndex = Math.round(currentTimeSec / secondsPerBeat);
  return Math.max(0, beatIndex * secondsPerBeat);
}

// Relative (audio-clock-agnostic) timeline: stage i's audible span is exactly 2x its own
// length (one "repeat the current loop twice"), except the final/floor stage, whose end is
// caller-supplied (the bar-aligned launch instant, cf. computeBeatRepeatLaunchBeats).
export function computeStageTimeline(stageBeats, secondsPerBeat) {
  const timeline = [];
  let cursor = 0;
  for (let i = 0; i < stageBeats.length; i++) {
    const lengthBeats = stageBeats[i];
    const lengthSec = lengthBeats * secondsPerBeat;
    const isFinal = i === stageBeats.length - 1;
    timeline.push({ index: i, lengthBeats, lengthSec, startSec: cursor, isFinal });
    if (!isFinal) cursor += lengthSec * 2;
  }
  return timeline;
}

// Step 7: "Apply short crossfades when changing loop length to prevent clicks." Proportional
// to the (shorter, incoming) stage length so a crossfade never swallows a whole short stage,
// but floored so it's never so short it fails to mask a discontinuity.
export function computeCrossfadeWindowSec(stageLengthSec, options = {}) {
  const targetSec = Number.isFinite(options.targetSec) ? options.targetSec : 0.012;
  const minSec = Number.isFinite(options.minSec) ? options.minSec : 0.003;
  const maxFraction = Number.isFinite(options.maxFraction) ? options.maxFraction : 0.25;
  const safeLength = Number.isFinite(stageLengthSec) && stageLengthSec > 0 ? stageLengthSec : 0;
  const proportionalCap = safeLength * maxFraction;
  const window = Math.min(targetSec, proportionalCap);
  return Math.max(minSec, window);
}

// Total duration (ms) from loop anchor to Track-B launch, for a given BPM/initial loop length —
// exposed so main.js can synchronize the decorative stutter FX to the same window.
export function computeBeatRepeatLoopPhaseMs(bpm, initialBeats = BEAT_REPEAT_DEFAULT_INITIAL_BEATS, beatsPerBar = BEAT_REPEAT_BEATS_PER_BAR) {
  const secondsPerBeat = 60 / getSafeBeatRepeatBpm(bpm);
  const stageBeats = buildBeatRepeatStageBeats(initialBeats);
  const launchBeats = computeBeatRepeatLaunchBeats(stageBeats, beatsPerBar);
  return launchBeats * secondsPerBeat * 1000;
}

// ─── Web Audio scheduling engine ──────────────────────────────────────────────

const ZERO_CROSSING_SEARCH_SEC = 0.005; // standard seamless-loop technique: nudge loop points
// to the nearest zero crossing so the sample-level discontinuity itself doesn't click,
// independent of the surrounding gain crossfade.
const SCHEDULE_LEAD_SEC = 0.05; // headroom so the very first start() isn't scheduled in the past
const DECODE_WINDOW_MARGIN_SEC = 0.25;

function findNearestZeroCrossingIndex(channelData, sampleIndex, sampleRate, searchSec) {
  if (!channelData || !channelData.length) return Math.max(0, sampleIndex);
  const searchSamples = Math.max(1, Math.round(searchSec * sampleRate));
  const center = Math.max(0, Math.min(channelData.length - 1, sampleIndex));
  const lo = Math.max(0, center - searchSamples);
  const hi = Math.min(channelData.length - 1, center + searchSamples);
  let best = center;
  let bestAbs = Math.abs(channelData[center] || 0);
  for (let i = lo; i <= hi; i++) {
    const abs = Math.abs(channelData[i]);
    if (abs < bestAbs) {
      bestAbs = abs;
      best = i;
    }
  }
  return best;
}

export class BeatRepeatEngine {
  #activeNodes = [];

  /**
   * Decodes the deck's current track (already a local blob: URL, no network cost) and returns
   * a SMALL retained AudioBuffer covering just the loop window — the full decode is transient
   * (discarded right after), so retained memory stays proportional to a few seconds of audio,
   * not the whole track (which could be 50-100MB for a multi-minute file).
   */
  async prepare(ctx, url, anchorSec, windowSec) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const fullBuffer = await ctx.decodeAudioData(arrayBuffer);

    const sampleRate = fullBuffer.sampleRate;
    const startSample = Math.max(0, Math.floor(anchorSec * sampleRate));
    const wantedSamples = Math.max(1, Math.ceil((windowSec + DECODE_WINDOW_MARGIN_SEC) * sampleRate));
    const endSample = Math.min(fullBuffer.length, startSample + wantedSamples);
    const length = Math.max(1, endSample - startSample);

    const windowBuffer = ctx.createBuffer(fullBuffer.numberOfChannels, length, sampleRate);
    for (let ch = 0; ch < fullBuffer.numberOfChannels; ch++) {
      const src = fullBuffer.getChannelData(ch);
      const dst = windowBuffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        dst[i] = src[startSample + i] ?? 0;
      }
    }
    return windowBuffer;
  }

  /**
   * Schedules every stage's AudioBufferSourceNode up front against ctx.currentTime — this, not
   * a reactive tick, is what satisfies "sample-accurate"/"deterministic". `stageBeats` is a
   * buildBeatRepeatStageBeats() result; loopStart is fixed at 0 (the start of the retained
   * window == the anchor) for every stage, loopEnd shrinks per stage — "never change loop
   * length mid-beat" holds by construction since a change only ever happens at an exact
   * multiple of the *current* stage's own beat length.
   */
  run({ ctx, destinationBus, audioBuffer, stageBeats, secondsPerBeat, launchBeats }) {
    this.stop();
    const timeline = computeStageTimeline(stageBeats, secondsPerBeat);
    const t0 = ctx.currentTime + SCHEDULE_LEAD_SEC;
    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0);

    const loopStartIndex = findNearestZeroCrossingIndex(channelData, 0, sampleRate, ZERO_CROSSING_SEARCH_SEC);
    const loopStartSec = loopStartIndex / sampleRate;

    const active = [];
    for (let i = 0; i < timeline.length; i++) {
      const stage = timeline[i];
      const nextStage = timeline[i + 1];
      const startAt = t0 + stage.startSec;
      const stopAt = stage.isFinal ? (t0 + (launchBeats * secondsPerBeat)) : (t0 + nextStage.startSec);

      const fadeInWindow = computeCrossfadeWindowSec(stage.lengthSec);
      const fadeOutWindow = stage.isFinal
        ? computeCrossfadeWindowSec(stage.lengthSec)
        : computeCrossfadeWindowSec(nextStage.lengthSec);

      const loopEndSampleGuess = Math.max(loopStartIndex + 1, Math.min(audioBuffer.length - 1, loopStartIndex + Math.round(stage.lengthSec * sampleRate)));
      const loopEndIndex = findNearestZeroCrossingIndex(channelData, loopEndSampleGuess, sampleRate, ZERO_CROSSING_SEARCH_SEC);
      const loopEndSec = Math.max(loopStartSec + (1 / sampleRate), loopEndIndex / sampleRate);

      const node = ctx.createBufferSource();
      node.buffer = audioBuffer;
      node.loop = true;
      node.loopStart = loopStartSec;
      node.loopEnd = loopEndSec;

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0, startAt);
      gainNode.gain.linearRampToValueAtTime(1, startAt + fadeInWindow);
      gainNode.gain.setValueAtTime(1, Math.max(startAt + fadeInWindow, stopAt - fadeOutWindow));
      gainNode.gain.linearRampToValueAtTime(0, stopAt);

      node.connect(gainNode);
      gainNode.connect(destinationBus);
      node.start(startAt);
      node.stop(stopAt + 0.02); // small safety margin past the fade-out

      active.push({ node, gainNode });
    }

    this.#activeNodes = active;
    return { stop: () => this.stop() };
  }

  /** Idempotent hard-cancel — safe to call before run() or multiple times. */
  stop() {
    for (const { node, gainNode } of this.#activeNodes) {
      try { node.stop(); } catch { /* already stopped */ }
      try { node.disconnect(); } catch { /* already disconnected */ }
      try { gainNode.disconnect(); } catch { /* already disconnected */ }
    }
    this.#activeNodes = [];
  }
}
