// Progressive Loop Morph (beat_repeat): an 8-phase state machine, replacing the earlier
// per-function escalation model on explicit user request — "je ne coderais pas la transition
// avec 8 fonctions différentes ; je la décrirais comme une timeline pilotée par une machine à
// états". Source spec: dj-mix/lib/loopmorph.md. See dj-mix/SPECS.md §1.3.8 for the literal
// mapping from that document onto this code.
//
// This module is split in two, same shape as the engine it replaces:
//  - pure, framework-free functions (the phase timeline + state lookup) — fully unit-testable.
//  - `LoopMorphEngine`, a thin Web Audio scheduling layer: every loop segment's start/stop/
//    crossfade is computed once, up front, against the AudioContext clock (not a reactive poll).
//
// THE STATE MACHINE: `computeLoopMorphTimeline` builds a table of 8 phases, each phase carrying
// the automation values (deck1Gain, deck2Gain, hpFilterPct, echoPct, deck2FilterPct) in effect at
// its END (loopmorph.md's INITIAL STATE is phase 0's start). `computeLoopMorphStateAtElapsed` is
// the ONE generic driver every caller uses: given an elapsed time, it finds the active phase and
// linearly (equal-power eased) interpolates from the previous phase's end-values to this phase's
// own end-values. There is no per-phase special-casing for these five values — a single lookup +
// interpolation, per the user's explicit request.

// ─── Pure constants ───────────────────────────────────────────────────────────

export const LOOP_MORPH_FLOOR_BEATS = 1 / 16;
export const LOOP_MORPH_BEATS_PER_BAR = 4;
const LOOP_MORPH_DEFAULT_BPM = 120;
const LOOP_MORPH_MIN_BPM = 60;
const LOOP_MORPH_MAX_BPM = 220;

export function getSafeLoopMorphBpm(bpm) {
  const value = Number(bpm);
  if (!Number.isFinite(value) || value <= 0) return LOOP_MORPH_DEFAULT_BPM;
  return Math.max(LOOP_MORPH_MIN_BPM, Math.min(LOOP_MORPH_MAX_BPM, value));
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

// Phases 1-5 (loopmorph.md): loop length shrinks phase over phase (phase 4→5 holds instead of
// halving again — a deliberate compression of the original spec's timing), held for a LITERAL
// repeat count — not stretched to equalize phase durations (confirmed with user: "répétitions
// littérales prioritaires"). Their real duration is whatever the outgoing deck's BPM produces.
const MAIN_PHASES = [
  { lengthBeats: 4, reps: 2 },     // Phase 1
  { lengthBeats: 2, reps: 2 },     // Phase 2
  { lengthBeats: 1, reps: 2 },     // Phase 3
  { lengthBeats: 0.5, reps: 1 },     // Phase 4
  { lengthBeats: 0.5, reps: 1 },   // Phase 5
];

// Phase 6's own 4 subdivisions (loopmorph.md PHASE 6, revised: hold at 1/4 beat three times, then
// drop straight to the floor — a compressed version of the original "1/2 → 1/4 → 1/8 → 1/16"
// smooth halving) — each stretched to occupy an equal share of phase 6's own allotted duration
// (computeLoopMorphTimeline), same "fill a time slice" mechanic used for beat_repeat's earlier
// tail-overlap iteration this session.
const PHASE6_SUBDIVISION_BEATS = [0.25, 0.25, 0.25, LOOP_MORPH_FLOOR_BEATS];

// Automation values in effect at the END of each phase (index 0 = loopmorph.md's INITIAL STATE,
// i.e. the start of phase 1; index N = end of phase N / start of phase N+1; index 8 = END
// STATE). `deck2FilterPct` is this engine's own reading of loopmorph.md's otherwise-unspecified
// "Deck2 ... Gradually restore bass frequencies" (Phase 7): deck2 joins already filtered in
// phase 6 (symmetric with deck1's own filter at that point, matching the "both decks in the same
// state" theme already established across this session's earlier iterations), then explicitly
// restores to 0 by the end of phase 7 — deck2 is silent (gain 0) throughout phase 6, so this
// value is inaudible until phase 7 regardless of the exact figure chosen here.
const PHASE_BOUNDARIES = [
  { deck1Gain: 1, deck2Gain: 0, hpFilterPct: 0, echoPct: 0, deck2FilterPct: 0 },     // INITIAL
  { deck1Gain: 1, deck2Gain: 0, hpFilterPct: 0, echoPct: 0, deck2FilterPct: 0 },     // end phase 1
  { deck1Gain: 1, deck2Gain: 0, hpFilterPct: 0.05, echoPct: 0, deck2FilterPct: 0 },  // end phase 2
  { deck1Gain: 1, deck2Gain: 0, hpFilterPct: 0.12, echoPct: 0, deck2FilterPct: 0 },  // end phase 3
  { deck1Gain: 1, deck2Gain: 0, hpFilterPct: 0.20, echoPct: 0, deck2FilterPct: 0 },  // end phase 4
  { deck1Gain: 0.95, deck2Gain: 0, hpFilterPct: 0.35, echoPct: 0, deck2FilterPct: 0 }, // end phase 5
  { deck1Gain: 0.90, deck2Gain: 0, hpFilterPct: 0.60, echoPct: 0.20, deck2FilterPct: 0.60 }, // end phase 6
  { deck1Gain: 0.40, deck2Gain: 0.60, hpFilterPct: 0.90, echoPct: 0.45, deck2FilterPct: 0 }, // end phase 7
  { deck1Gain: 0, deck2Gain: 1, hpFilterPct: 0, echoPct: 0.60, deck2FilterPct: 0 },  // END STATE
];

export const LOOP_MORPH_PHASE_COUNT = PHASE_BOUNDARIES.length - 1; // 8

// Sensible floor so phase 6 never collapses to zero-length when `crossfadeDuration` is too short
// to fit phases 1-5's BPM-determined duration.
const MIN_PHASE6_SEC = 0.3;
// The listener needs to actually HEAR both decks playing together — phases 7-8 are where that
// happens (loopmorph.md's crossfade + final handoff) — so their COMBINED duration is guaranteed
// at least this long, even if `crossfadeDuration` doesn't leave enough room for it (same
// disclosed trade-off already accepted for phases 1-5's own literal-repeat duration: total may
// end up longer than configured, never truncated below what's needed to be heard).
export const LOOP_MORPH_MIN_OVERLAP_SEC = 2;

// Step "acceleration": `orderedBeats` held in the given order, each stretched to roughly
// `targetSec / count` real seconds (never fewer than 2 repetitions of its own length).
function buildFillSegments(orderedBeats, secondsPerBeat, targetSec) {
  const count = orderedBeats.length;
  const sliceSec = count > 0 ? targetSec / count : 0;
  const segments = [];
  for (const lengthBeats of orderedBeats) {
    const lengthSec = lengthBeats * secondsPerBeat;
    const reps = Math.max(2, Math.round(sliceSec / lengthSec));
    segments.push({ lengthBeats, lengthSec, durationSec: reps * lengthSec });
  }
  return segments;
}

/**
 * Builds the full 8-phase timeline: phase boundaries (for computeLoopMorphStateAtElapsed) plus
 * the outgoing deck's loop-length segments (for LoopMorphEngine#run). `totalDurationSec` is
 * pinned to `player.crossfadeDuration` (confirmed with user) — phases 1-5's literal-repeat
 * duration is subtracted from it; the remainder is split evenly across phases 6/7/8.
 */
export function computeLoopMorphTimeline(secondsPerBeat, totalDurationSec) {
  const safeSpb = Number.isFinite(secondsPerBeat) && secondsPerBeat > 0 ? secondsPerBeat : 0.5;
  const safeTotal = Number.isFinite(totalDurationSec) && totalDurationSec > 0 ? totalDurationSec : 12;

  const mainSegments = MAIN_PHASES.map(({ lengthBeats, reps }) => ({
    lengthBeats,
    lengthSec: lengthBeats * safeSpb,
    durationSec: reps * lengthBeats * safeSpb,
  }));
  const mainTotalSec = mainSegments.reduce((sum, s) => sum + s.durationSec, 0);

  const rawRemainingSec = safeTotal - mainTotalSec;
  // Phase 6 gets a simple proportional-or-floor share; phases 7+8 (the actual overlap window)
  // are guaranteed at least LOOP_MORPH_MIN_OVERLAP_SEC combined, split evenly between them.
  const phase6Sec = Math.max(MIN_PHASE6_SEC, rawRemainingSec / 3);
  const overlapSec = Math.max(LOOP_MORPH_MIN_OVERLAP_SEC, (rawRemainingSec * 2) / 3);
  const phase7Sec = overlapSec / 2;
  const phase8Sec = overlapSec / 2;

  const phase6Segments = buildFillSegments(PHASE6_SUBDIVISION_BEATS, safeSpb, phase6Sec);
  const phase6ActualSec = phase6Segments.reduce((sum, s) => sum + s.durationSec, 0);

  // Phases (1-indexed in spirit, 0-indexed array): startSec/durationSec per phase.
  const phases = [];
  let cursor = 0;
  for (let i = 0; i < mainSegments.length; i++) {
    phases.push({ index: i + 1, startSec: cursor, durationSec: mainSegments[i].durationSec });
    cursor += mainSegments[i].durationSec;
  }
  const phase6StartSec = cursor;
  phases.push({ index: 6, startSec: phase6StartSec, durationSec: phase6ActualSec });
  cursor += phase6ActualSec;
  const phase7StartSec = cursor;
  phases.push({ index: 7, startSec: phase7StartSec, durationSec: phase7Sec });
  cursor += phase7Sec;
  const phase8StartSec = cursor;
  phases.push({ index: 8, startSec: phase8StartSec, durationSec: phase8Sec });
  cursor += phase8Sec;

  // Outgoing deck's full loop-segment list: phases 1-5 (2 reps each except phase 5's 4) then
  // phase 6's 4 stretched subdivisions — the LAST of those (1/16 beat) is extended to also cover
  // phase 7 (loopmorph.md: "both decks repeat the same 1/16 loop" through phase 7 — one
  // continuous buffer stage, not a new one at the phase 6/7 boundary).
  const deck1Segments = [...mainSegments, ...phase6Segments].map((seg, i, arr) => ({
    ...seg,
    startSec: i === 0 ? 0 : arr.slice(0, i).reduce((s, x) => s + x.durationSec, 0),
    isFinal: i === arr.length - 1,
  }));
  const lastSegment = deck1Segments[deck1Segments.length - 1];
  lastSegment.durationSec += phase7Sec; // extend the 1/16 stage through phase 7

  // Incoming deck's own single segment (loopmorph.md PHASE 6: "Enable identical 1/16 loop"),
  // spanning from phase 6's start through the end of phase 7 — see computeLoopMorphMirrorNote in
  // module docs for why this isn't sample-phase-locked to deck1's own arrival at 1/16.
  const deck2Segment = {
    lengthBeats: LOOP_MORPH_FLOOR_BEATS,
    lengthSec: LOOP_MORPH_FLOOR_BEATS * safeSpb,
    startSec: phase6StartSec,
    durationSec: phase6ActualSec + phase7Sec,
  };

  return {
    phases,
    totalSec: cursor,
    deck1Segments,
    deck2Segment,
    phase6StartSec,
    phase7StartSec,
    phase8StartSec,
  };
}

// Equal-power-style single-value ease (loopmorph.md: "Use Equal-Power gain curves instead of
// linear fades") — reuses the sin() half of the cos/sin pair already used elsewhere in this
// codebase for two-signal crossfades (player.js #equalPowerGainsFromRatio), generalized to any
// single from->to ramp so every automated parameter in this engine shares one curve shape.
function equalPowerLerp(from, to, t) {
  const eased = Math.sin((Math.PI / 2) * clamp01(t));
  return from + ((to - from) * eased);
}

/**
 * THE STATE MACHINE DRIVER. Given a timeline (computeLoopMorphTimeline) and an elapsed time,
 * finds the active phase and interpolates every automated parameter from the previous phase's
 * end-values to this phase's own end-values. Called every tick (~30ms) from player.js — this one
 * function replaces all per-phase branching.
 */
export function computeLoopMorphStateAtElapsed(timeline, elapsedSec) {
  const safeElapsed = Number.isFinite(elapsedSec) && elapsedSec > 0 ? elapsedSec : 0;
  const phases = timeline.phases;
  let active = phases[phases.length - 1];
  for (const phase of phases) {
    if (safeElapsed < phase.startSec + phase.durationSec) { active = phase; break; }
  }
  const localT = active.durationSec > 0
    ? clamp01((safeElapsed - active.startSec) / active.durationSec)
    : 1;
  const from = PHASE_BOUNDARIES[active.index - 1];
  const to = PHASE_BOUNDARIES[active.index];

  return {
    phaseIndex: active.index,
    phaseProgress: localT,
    deck1Gain: equalPowerLerp(from.deck1Gain, to.deck1Gain, localT),
    deck2Gain: equalPowerLerp(from.deck2Gain, to.deck2Gain, localT),
    hpFilterPct: equalPowerLerp(from.hpFilterPct, to.hpFilterPct, localT),
    echoPct: equalPowerLerp(from.echoPct, to.echoPct, localT),
    deck2FilterPct: equalPowerLerp(from.deck2FilterPct, to.deck2FilterPct, localT),
  };
}

// Step "Loop boundaries must always align to the beat grid" / "Beat phase and bar phase must
// remain synchronized": snaps forward to the next boundary at/after currentTimeSec — never
// backward (a backward anchor would replay already-heard content, a perceptible skip — the same
// bug fixed earlier this session for the previous engine). `beatsPerBoundary` = 1 for a beat-grid
// anchor (phase 1's loop capture), or LOOP_MORPH_BEATS_PER_BAR for a bar-grid anchor (deck2's
// "synchronize bar phase" in phase 6). Assumes beat-phase-zero at track start — the same honest,
// disclosed limitation as the rest of this app (no real downbeat detection).
export function computeLoopMorphAnchorSeconds(currentTimeSec, secondsPerBeat, beatsPerBoundary = 1) {
  if (!Number.isFinite(currentTimeSec) || currentTimeSec < 0) return 0;
  if (!Number.isFinite(secondsPerBeat) || secondsPerBeat <= 0) return Math.max(0, currentTimeSec);
  const boundarySec = Math.max(secondsPerBeat, secondsPerBeat * (Number(beatsPerBoundary) || 1));
  const index = Math.ceil((currentTimeSec / boundarySec) - 1e-9);
  return Math.max(0, index * boundarySec);
}

// Step "Synchronize BPM" (Phase 6): ratio to apply to the incoming deck's own playbackRate so its
// tempo matches the outgoing deck's current tempo — same math as this session's earlier
// final-stage pitch-bend, now applied up front (a setup action, not a gradual bend) and in the
// opposite direction (the INCOMING deck syncs TO the outgoing deck, then reverts to its own
// native tempo once it takes over — Phase 8 "Restore original tempo if Sync was temporary").
export function computeLoopMorphBpmSyncRatio(fromBpm, toBpm) {
  return getSafeLoopMorphBpm(fromBpm) / getSafeLoopMorphBpm(toBpm);
}

// Step "Apply 5-10 ms crossfades whenever the loop length changes to eliminate clicks" —
// proportional to the (shorter, incoming) stage length so a crossfade never swallows a whole
// short stage, explicitly bounded to the document's own 5-10ms range (not the wider floor used
// by the engine this replaces).
export function computeLoopMorphCrossfadeWindowSec(stageLengthSec, options = {}) {
  const targetSec = Number.isFinite(options.targetSec) ? options.targetSec : 0.0075;
  const minSec = Number.isFinite(options.minSec) ? options.minSec : 0.005;
  const maxSec = Number.isFinite(options.maxSec) ? options.maxSec : 0.010;
  const maxFraction = Number.isFinite(options.maxFraction) ? options.maxFraction : 0.25;
  const safeLength = Number.isFinite(stageLengthSec) && stageLengthSec > 0 ? stageLengthSec : 0;
  const proportionalCap = safeLength * maxFraction;
  const window = Math.min(targetSec, proportionalCap, maxSec);
  return Math.max(minSec, window);
}

// ─── Web Audio scheduling engine ──────────────────────────────────────────────

const ZERO_CROSSING_SEARCH_SEC = 0.005; // standard seamless-loop technique: nudge loop points
// to the nearest zero crossing so the sample-level discontinuity itself doesn't click,
// independent of the surrounding gain crossfade.
const SCHEDULE_LEAD_SEC = 0.05; // headroom so the very first start() isn't scheduled in the past
const DECODE_WINDOW_MARGIN_SEC = 0.25;

// 2026-07-29 feedback: a raw audio buffer looped continuously at a fast rate doesn't read as
// rhythmic drumming, it reads as a chaotic buzz/drone — once the loop cycle gets short enough
// (roughly sub-200ms, crossing from "audible individual repeats" into "audio-rate texture"),
// simply looping it with one flat sustained gain is wavetable synthesis, not a beat repeat. Loop
// cycles below this threshold (phase 6's fast subdivisions) get re-attacked and decayed EVERY
// cycle instead of one flat sustain, so each repeat reads as a discrete percussive hit. Phases
// 1-5's longer loops (musical phrase-length repeats) are left alone — they already sound like
// clear rhythmic repeats of real content without any extra shaping.
const PERCUSSIVE_GATE_THRESHOLD_SEC = 0.2;
const PERCUSSIVE_GATE_DECAY_FRACTION = 0.55; // fraction of each cycle spent decaying — the rest
// is a near-silent gap before the next hit's attack, which is what separates hits instead of
// smearing them into a tone.
const PERCUSSIVE_GATE_FLOOR = 0.08; // exponentialRampToValueAtTime needs a nonzero target; also
// leaves a faint tail between hits rather than a dead silence that could itself click.

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

export class LoopMorphEngine {
  #activeNodes = [];

  /**
   * Decodes the deck's current track (already a local blob: URL, no network cost) and returns a
   * SMALL retained AudioBuffer covering just the loop window — the full decode is transient
   * (discarded right after), so retained memory stays proportional to a few seconds of audio, not
   * the whole track.
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
   * Schedules every segment's AudioBufferSourceNode up front against ctx.currentTime (or an
   * explicit `startAt`, used to phase-lock the incoming deck's single segment to the outgoing
   * deck's own timeline). `segments` is a computeLoopMorphTimeline().deck1Segments (or a
   * single-entry array wrapping deck2Segment) — loopStart is fixed at 0 (the retained window's
   * own start == the anchor) for every segment, loopEnd shrinks per segment. `playbackRate`
   * (default 1) is applied uniformly to every node — the incoming deck's BPM-sync ratio
   * (computeLoopMorphBpmSyncRatio), a fixed setup value, not a ramp. Each segment's gain envelope
   * is either one flat sustain (long loops) or a per-cycle percussive gate (short loops, below
   * PERCUSSIVE_GATE_THRESHOLD_SEC) — see the constants above.
   */
  run({ ctx, destinationBus, audioBuffer, segments, playbackRate = 1, startAt: explicitStartAt }) {
    this.stop();
    const t0 = Number.isFinite(explicitStartAt) ? explicitStartAt : ctx.currentTime + SCHEDULE_LEAD_SEC;
    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0);

    const loopStartIndex = findNearestZeroCrossingIndex(channelData, 0, sampleRate, ZERO_CROSSING_SEARCH_SEC);
    const loopStartSec = loopStartIndex / sampleRate;

    const active = [];
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const nextSegment = segments[i + 1];
      const startAt = t0 + segment.startSec;
      const stopAt = startAt + segment.durationSec;

      const fadeInWindow = computeLoopMorphCrossfadeWindowSec(segment.lengthSec);
      const fadeOutWindow = nextSegment
        ? computeLoopMorphCrossfadeWindowSec(nextSegment.lengthSec)
        : computeLoopMorphCrossfadeWindowSec(segment.lengthSec);

      const loopEndSampleGuess = Math.max(loopStartIndex + 1, Math.min(audioBuffer.length - 1, loopStartIndex + Math.round(segment.lengthSec * sampleRate)));
      const loopEndIndex = findNearestZeroCrossingIndex(channelData, loopEndSampleGuess, sampleRate, ZERO_CROSSING_SEARCH_SEC);
      const loopEndSec = Math.max(loopStartSec + (1 / sampleRate), loopEndIndex / sampleRate);

      const node = ctx.createBufferSource();
      node.buffer = audioBuffer;
      node.loop = true;
      node.loopStart = loopStartSec;
      node.loopEnd = loopEndSec;
      if (playbackRate !== 1) node.playbackRate.setValueAtTime(playbackRate, startAt);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0, startAt);
      gainNode.gain.linearRampToValueAtTime(1, startAt + fadeInWindow);

      const sustainStart = startAt + fadeInWindow;
      const sustainEnd = Math.max(sustainStart, stopAt - fadeOutWindow);
      if (segment.lengthSec > 0 && segment.lengthSec < PERCUSSIVE_GATE_THRESHOLD_SEC && sustainEnd > sustainStart) {
        // Percussive gate: re-attack + decay every cycle instead of one flat sustain.
        const cycleCount = Math.max(1, Math.round((sustainEnd - sustainStart) / segment.lengthSec));
        const actualCycleSec = (sustainEnd - sustainStart) / cycleCount;
        const decaySec = actualCycleSec * PERCUSSIVE_GATE_DECAY_FRACTION;
        for (let c = 0; c < cycleCount; c++) {
          const cycleStart = sustainStart + (c * actualCycleSec);
          gainNode.gain.setValueAtTime(1, cycleStart);
          gainNode.gain.exponentialRampToValueAtTime(PERCUSSIVE_GATE_FLOOR, cycleStart + decaySec);
        }
      } else {
        gainNode.gain.setValueAtTime(1, sustainEnd);
      }
      gainNode.gain.linearRampToValueAtTime(0, stopAt);

      node.connect(gainNode);
      gainNode.connect(destinationBus);
      node.start(startAt);
      node.stop(stopAt + 0.02); // small safety margin past the fade-out

      active.push({ node, gainNode });
    }

    this.#activeNodes = active;
    return { stop: () => this.stop(), t0 };
  }

  /**
   * Retunes the LAST scheduled segment's node to a new playbackRate at an absolute AudioContext
   * time, via a second `setValueAtTime` on the already-running node's own AudioParam — no new
   * node, no restart. Used so the outgoing deck's still-playing final loop segment (which spans
   * phase 6 through phase 7, one continuous buffer per SPEC-1.3.8.21) can snap to the incoming
   * deck's tempo partway through its own run, once phase 7 starts (2026-07-29 feedback: the tiny
   * loop should sound like "the beat of the other song", not the outgoing deck's own tempo).
   * No-op if run() hasn't scheduled anything yet.
   */
  scheduleFinalSegmentRateChange(atTime, rate) {
    const last = this.#activeNodes[this.#activeNodes.length - 1];
    if (!last) return;
    last.node.playbackRate.setValueAtTime(rate, atTime);
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
