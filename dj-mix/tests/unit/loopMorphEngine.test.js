/**
 * loopMorphEngine.test.js — Tests unitaires pour dj-mix/lib/loopMorphEngine.js
 * Références SPEC-1.3.8.1 à SPEC-1.3.8.18 (dj-mix/SPECS.md) et dj-mix/lib/loopmorph.md.
 */
import { jest, describe, test, expect, afterEach } from '@jest/globals';
import {
  LOOP_MORPH_FLOOR_BEATS,
  LOOP_MORPH_BEATS_PER_BAR,
  LOOP_MORPH_PHASE_COUNT,
  LOOP_MORPH_MIN_OVERLAP_SEC,
  LoopMorphEngine,
  getSafeLoopMorphBpm,
  computeLoopMorphTimeline,
  computeLoopMorphStateAtElapsed,
  computeLoopMorphAnchorSeconds,
  computeLoopMorphBpmSyncRatio,
  computeLoopMorphCrossfadeWindowSec,
} from '../../lib/loopMorphEngine.js';

// ── getSafeLoopMorphBpm ──────────────────────────────────────────────────────

describe('getSafeLoopMorphBpm', () => {
  test('clamps out-of-range BPM to [60, 220]', () => {
    expect(getSafeLoopMorphBpm(30)).toBe(60);
    expect(getSafeLoopMorphBpm(400)).toBe(220);
  });

  test('passes through valid BPM unchanged', () => {
    expect(getSafeLoopMorphBpm(128)).toBe(128);
  });

  test('falls back to 120 for missing/invalid BPM', () => {
    expect(getSafeLoopMorphBpm(undefined)).toBe(120);
    expect(getSafeLoopMorphBpm(null)).toBe(120);
    expect(getSafeLoopMorphBpm(0)).toBe(120);
    expect(getSafeLoopMorphBpm(NaN)).toBe(120);
  });
});

// ── computeLoopMorphTimeline ─────────────────────────────────────────────────

describe('computeLoopMorphTimeline', () => {
  test('LOOP_MORPH_PHASE_COUNT is 8 (loopmorph.md)', () => {
    expect(LOOP_MORPH_PHASE_COUNT).toBe(8);
  });

  test('phases 1-5 use literal repeat counts (2,2,2,1,1), not stretched to fit totalDurationSec', () => {
    const secondsPerBeat = 0.5; // 120 BPM
    // Phase 1: 2 reps x 4 beats x 0.5s/beat = 4s; Phase 5: 1 rep x 0.5 beats x 0.5s/beat = 0.25s —
    // both fixed by BPM alone, regardless of totalDurationSec (SPEC-1.3.8.4).
    const timelineShort = computeLoopMorphTimeline(secondsPerBeat, 1); // 1s target, way too short
    const timelineLong = computeLoopMorphTimeline(secondsPerBeat, 60); // 60s target, way more than needed
    expect(timelineShort.phases[0].durationSec).toBeCloseTo(4, 6);
    expect(timelineShort.phases[4].durationSec).toBeCloseTo(0.25, 6);
    expect(timelineLong.phases[0].durationSec).toBeCloseTo(4, 6);
    expect(timelineLong.phases[4].durationSec).toBeCloseTo(0.25, 6);
  });

  test('phases 6-8 absorb whatever real time remains after phases 1-5, split evenly', () => {
    const secondsPerBeat = 0.5;
    const totalDurationSec = 30;
    const timeline = computeLoopMorphTimeline(secondsPerBeat, totalDurationSec);
    const mainTotalSec = timeline.phases.slice(0, 5).reduce((s, p) => s + p.durationSec, 0);
    expect(mainTotalSec).toBeCloseTo(7.5, 6);
    const remainingSec = totalDurationSec - mainTotalSec;
    // Phase 6's duration is realized (rounded reps), so only approximately 1/3 of the remainder.
    expect(timeline.phases[6].durationSec).toBeCloseTo(remainingSec / 3, 1); // phase 7 (index 6): exact 1/3
    expect(timeline.phases[7].durationSec).toBeCloseTo(remainingSec / 3, 1); // phase 8 (index 7): exact 1/3
  });

  test('never collapses phases 6-8 to zero when phases 1-5 alone exceed totalDurationSec', () => {
    const secondsPerBeat = 0.5;
    const timeline = computeLoopMorphTimeline(secondsPerBeat, 0.001); // impossibly short target
    expect(timeline.phases[5].durationSec).toBeGreaterThan(0); // phase 6
    expect(timeline.phases[6].durationSec).toBeGreaterThan(0); // phase 7
    expect(timeline.phases[7].durationSec).toBeGreaterThan(0); // phase 8
  });

  test('phases 7+8 (the actual overlap window) are guaranteed at least LOOP_MORPH_MIN_OVERLAP_SEC combined, even when crossfadeDuration leaves no room for it', () => {
    expect(LOOP_MORPH_MIN_OVERLAP_SEC).toBe(2);
    const secondsPerBeat = 0.5; // 120 BPM: phases 1-5 alone already take 7.5s
    const timeline = computeLoopMorphTimeline(secondsPerBeat, 12); // typical default crossfadeDuration (12s) — shorter than phases 1-5 alone
    const overlapSec = timeline.phases[6].durationSec + timeline.phases[7].durationSec;
    expect(overlapSec).toBeGreaterThanOrEqual(LOOP_MORPH_MIN_OVERLAP_SEC - 1e-6);
  });

  test('phases 7+8 split the overlap window evenly between them', () => {
    const timeline = computeLoopMorphTimeline(0.5, 1); // way too short — hits the overlap floor
    expect(timeline.phases[6].durationSec).toBeCloseTo(timeline.phases[7].durationSec, 6);
  });

  test('deck1Segments: 5 main segments (2 reps each except phases 4-5, 1 rep) + phase 6\'s 4 subdivisions, last one extended through phase 7', () => {
    const secondsPerBeat = 0.5;
    const timeline = computeLoopMorphTimeline(secondsPerBeat, 20);
    expect(timeline.deck1Segments).toHaveLength(9);
    expect(timeline.deck1Segments.map((s) => s.lengthBeats)).toEqual([4, 2, 1, 0.5, 0.5, 0.25, 0.25, 0.25, LOOP_MORPH_FLOOR_BEATS]);
    expect(timeline.deck1Segments[8].isFinal).toBe(true);
    expect(timeline.deck1Segments.slice(0, 8).every((s) => s.isFinal === false)).toBe(true);
    // Startsare monotonic and continuous (each segment starts exactly where the previous ends).
    for (let i = 1; i < timeline.deck1Segments.length; i++) {
      const prev = timeline.deck1Segments[i - 1];
      expect(timeline.deck1Segments[i].startSec).toBeCloseTo(prev.startSec + (i === 9 ? 0 : prev.durationSec), 6);
    }
    // The last segment's duration = its own phase-6 slice + all of phase 7.
    const phase7Sec = timeline.phases[6].durationSec;
    expect(timeline.deck1Segments[8].durationSec).toBeGreaterThan(phase7Sec);
  });

  test('deck2Segment: a single 1/16-beat stage spanning phase 6\'s start through the end of phase 7', () => {
    const secondsPerBeat = 0.5;
    const timeline = computeLoopMorphTimeline(secondsPerBeat, 20);
    expect(timeline.deck2Segment.lengthBeats).toBe(LOOP_MORPH_FLOOR_BEATS);
    expect(timeline.deck2Segment.startSec).toBeCloseTo(timeline.phase6StartSec, 6);
    const deck2EndSec = timeline.deck2Segment.startSec + timeline.deck2Segment.durationSec;
    expect(deck2EndSec).toBeCloseTo(timeline.phase8StartSec, 6);
    // Deck1's own final segment ends at exactly the same instant.
    const deck1Last = timeline.deck1Segments[timeline.deck1Segments.length - 1];
    expect(deck1Last.startSec + deck1Last.durationSec).toBeCloseTo(timeline.phase8StartSec, 6);
  });

  test('totalSec matches the end of phase 8', () => {
    const timeline = computeLoopMorphTimeline(0.5, 20);
    expect(timeline.totalSec).toBeCloseTo(timeline.phase8StartSec + timeline.phases[7].durationSec, 6);
  });
});

// ── computeLoopMorphStateAtElapsed (the state-machine driver) ───────────────

describe('computeLoopMorphStateAtElapsed', () => {
  test('at elapsed=0, matches loopmorph.md INITIAL STATE', () => {
    const timeline = computeLoopMorphTimeline(0.5, 20);
    const state = computeLoopMorphStateAtElapsed(timeline, 0);
    expect(state.phaseIndex).toBe(1);
    expect(state.deck1Gain).toBeCloseTo(1, 6);
    expect(state.deck2Gain).toBeCloseTo(0, 6);
    expect(state.hpFilterPct).toBeCloseTo(0, 6);
    expect(state.echoPct).toBeCloseTo(0, 6);
  });

  test('at elapsed >= totalSec, matches loopmorph.md END STATE', () => {
    const timeline = computeLoopMorphTimeline(0.5, 20);
    const state = computeLoopMorphStateAtElapsed(timeline, timeline.totalSec + 100);
    expect(state.phaseIndex).toBe(8);
    expect(state.deck1Gain).toBeCloseTo(0, 6);
    expect(state.deck2Gain).toBeCloseTo(1, 6);
    expect(state.hpFilterPct).toBeCloseTo(0, 6); // "HP Filter: Return to normal"
  });

  test('phase 1 (no effects, per loopmorph.md) stays flat at the INITIAL values throughout', () => {
    const timeline = computeLoopMorphTimeline(0.5, 20);
    const midPhase1 = timeline.phases[0].startSec + (timeline.phases[0].durationSec / 2);
    const state = computeLoopMorphStateAtElapsed(timeline, midPhase1);
    expect(state.phaseIndex).toBe(1);
    expect(state.deck1Gain).toBeCloseTo(1, 6);
    expect(state.hpFilterPct).toBeCloseTo(0, 6);
  });

  test('phase progress interpolates monotonically from the previous phase\'s end to this phase\'s own end', () => {
    const timeline = computeLoopMorphTimeline(0.5, 20);
    const phase2 = timeline.phases[1];
    const start = computeLoopMorphStateAtElapsed(timeline, phase2.startSec);
    const mid = computeLoopMorphStateAtElapsed(timeline, phase2.startSec + (phase2.durationSec / 2));
    const end = computeLoopMorphStateAtElapsed(timeline, phase2.startSec + phase2.durationSec - 1e-6);
    // Phase 2 ramps hpFilterPct from 0 (end of phase 1) to 0.05 (loopmorph.md "HP Filter=5%").
    expect(start.hpFilterPct).toBeCloseTo(0, 3);
    expect(mid.hpFilterPct).toBeGreaterThan(start.hpFilterPct);
    expect(mid.hpFilterPct).toBeLessThan(0.05);
    expect(end.hpFilterPct).toBeCloseTo(0.05, 2);
  });

  test('phase 7 crossfades both decks simultaneously (loopmorph.md "Deck1 90->40%, Deck2 0->60%")', () => {
    const timeline = computeLoopMorphTimeline(0.5, 20);
    const phase7 = timeline.phases[6];
    const start = computeLoopMorphStateAtElapsed(timeline, phase7.startSec);
    const end = computeLoopMorphStateAtElapsed(timeline, phase7.startSec + phase7.durationSec - 1e-6);
    expect(start.deck1Gain).toBeCloseTo(0.90, 2);
    expect(end.deck1Gain).toBeCloseTo(0.40, 1);
    expect(start.deck2Gain).toBeCloseTo(0, 2);
    expect(end.deck2Gain).toBeCloseTo(0.60, 1);
  });

  test('uses an equal-power (not linear) ease — midpoint is not exactly the arithmetic mean', () => {
    const timeline = computeLoopMorphTimeline(0.5, 20);
    const phase7 = timeline.phases[6];
    const midState = computeLoopMorphStateAtElapsed(timeline, phase7.startSec + (phase7.durationSec / 2));
    const arithmeticMean = (0.90 + 0.40) / 2;
    expect(midState.deck1Gain).not.toBeCloseTo(arithmeticMean, 2);
  });
});

// ── computeLoopMorphAnchorSeconds ────────────────────────────────────────────

describe('computeLoopMorphAnchorSeconds', () => {
  test('beat-grid mode (beatsPerBoundary=1): snaps forward to the next beat, never behind', () => {
    expect(computeLoopMorphAnchorSeconds(0, 0.5, 1)).toBeCloseTo(0, 6);
    expect(computeLoopMorphAnchorSeconds(0.01, 0.5, 1)).toBeCloseTo(0.5, 6);
    expect(computeLoopMorphAnchorSeconds(0.24, 0.5, 1)).toBeCloseTo(0.5, 6);
  });

  test('bar-grid mode (beatsPerBoundary=LOOP_MORPH_BEATS_PER_BAR): snaps to the next 4-beat bar', () => {
    expect(LOOP_MORPH_BEATS_PER_BAR).toBe(4);
    expect(computeLoopMorphAnchorSeconds(0, 0.5, 4)).toBeCloseTo(0, 6);
    expect(computeLoopMorphAnchorSeconds(0.6, 0.5, 4)).toBeCloseTo(2.0, 6); // next bar boundary = 2s (4 beats x 0.5s)
  });

  test('never returns a negative anchor / handles invalid input safely', () => {
    expect(computeLoopMorphAnchorSeconds(-1, 0.5, 1)).toBe(0);
    expect(computeLoopMorphAnchorSeconds(NaN, 0.5, 1)).toBe(0);
  });
});

// ── computeLoopMorphBpmSyncRatio ─────────────────────────────────────────────

describe('computeLoopMorphBpmSyncRatio', () => {
  test('ratio is the first BPM over the second — generic (a, b) => a/b, direction is the caller\'s choice', () => {
    expect(computeLoopMorphBpmSyncRatio(140, 120)).toBeCloseTo(140 / 120, 6);
    expect(computeLoopMorphBpmSyncRatio(120, 140)).toBeCloseTo(120 / 140, 6);
  });

  test('is exactly 1 (no sync needed) when both BPMs match', () => {
    expect(computeLoopMorphBpmSyncRatio(128, 128)).toBe(1);
  });
});

// ── computeLoopMorphCrossfadeWindowSec ───────────────────────────────────────

describe('computeLoopMorphCrossfadeWindowSec', () => {
  test('stays within loopmorph.md\'s explicit 5-10ms range for long stages', () => {
    const window = computeLoopMorphCrossfadeWindowSec(4);
    expect(window).toBeGreaterThanOrEqual(0.005);
    expect(window).toBeLessThanOrEqual(0.010);
  });

  test('shrinks proportionally for very short stages, floored at 5ms', () => {
    expect(computeLoopMorphCrossfadeWindowSec(0.01)).toBeCloseTo(0.005, 6);
  });
});

// ── LoopMorphEngine — Web Audio scheduling (mocked AudioContext) ────────────

describe('LoopMorphEngine', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function makeFakeBuffer(numberOfChannels, length, sampleRate) {
    const channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
    return {
      sampleRate,
      length,
      numberOfChannels,
      getChannelData: (ch) => channels[ch],
    };
  }

  function makeFakeContext({ currentTime = 100, sampleRate = 1000, fullBufferSeconds = 30 } = {}) {
    const bufferSourceNodes = [];
    const gainNodes = [];
    const ctx = {
      currentTime,
      createBuffer: (channels, length, rate) => makeFakeBuffer(channels, length, rate),
      decodeAudioData: () => Promise.resolve(makeFakeBuffer(1, fullBufferSeconds * sampleRate, sampleRate)),
      createBufferSource: () => {
        const node = {
          buffer: null,
          loop: false,
          loopStart: 0,
          loopEnd: 0,
          playbackRate: { setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn() },
          connect: jest.fn(),
          start: jest.fn(),
          stop: jest.fn(),
          disconnect: jest.fn(),
        };
        bufferSourceNodes.push(node);
        return node;
      },
      createGain: () => {
        const node = {
          gain: {
            setValueAtTime: jest.fn(),
            linearRampToValueAtTime: jest.fn(),
            exponentialRampToValueAtTime: jest.fn(),
          },
          connect: jest.fn(),
          disconnect: jest.fn(),
        };
        gainNodes.push(node);
        return node;
      },
    };
    return { ctx, bufferSourceNodes, gainNodes };
  }

  test('prepare() decodes the track and retains only a small window (not the whole buffer)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
    const { ctx } = makeFakeContext({ sampleRate: 1000, fullBufferSeconds: 30 });
    const engine = new LoopMorphEngine();

    const windowBuffer = await engine.prepare(ctx, 'blob:track', 2, 4);

    expect(global.fetch).toHaveBeenCalledWith('blob:track');
    expect(windowBuffer.length).toBe(4250); // (4 + 0.25 margin) x 1000Hz
    expect(windowBuffer.sampleRate).toBe(1000);
  });

  test('run() schedules one AudioBufferSourceNode per segment, start()s strictly increasing', async () => {
    global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
    const { ctx, bufferSourceNodes, gainNodes } = makeFakeContext({ currentTime: 100, sampleRate: 1000 });
    const engine = new LoopMorphEngine();
    const timeline = computeLoopMorphTimeline(0.5, 20);
    const windowSec = timeline.deck1Segments[0].lengthSec;

    const audioBuffer = await engine.prepare(ctx, 'blob:track', 0, windowSec);
    const destinationBus = { connect: jest.fn() };
    engine.run({ ctx, destinationBus, audioBuffer, segments: timeline.deck1Segments });

    expect(bufferSourceNodes).toHaveLength(9);
    expect(gainNodes).toHaveLength(9);
    bufferSourceNodes.forEach((node) => expect(node.loop).toBe(true));

    const startArgs = bufferSourceNodes.map((n) => n.start.mock.calls[0][0]);
    for (let i = 0; i < startArgs.length - 1; i++) {
      expect(startArgs[i]).toBeLessThan(startArgs[i + 1]);
    }
    const t0 = 100.05; // ctx.currentTime + SCHEDULE_LEAD_SEC
    expect(startArgs[0]).toBeCloseTo(t0, 6);

    // Every stage's gain ramps in from 0 and out to 0, regardless of gating below.
    gainNodes.forEach((node) => {
      expect(node.gain.linearRampToValueAtTime).toHaveBeenCalledTimes(2);
      expect(node.gain.setValueAtTime.mock.calls[0][0]).toBe(0);
      expect(node.gain.linearRampToValueAtTime.mock.calls[0][0]).toBe(1);
      expect(node.gain.linearRampToValueAtTime.mock.calls[1][0]).toBe(0);
    });
    // Segments at/above PERCUSSIVE_GATE_THRESHOLD_SEC (0.2s) get one flat sustain (2 setValueAtTime
    // calls total: initial 0, then the pre-fade-out anchor at 1). Segments below it (phase 6's
    // fast subdivisions, lengthSec 0.125/0.125/0.125/0.03125 here) get re-attacked every cycle
    // instead — many more setValueAtTime calls, plus an exponentialRampToValueAtTime decay per
    // cycle (2026-07-29 feedback: a fast raw loop otherwise reads as a buzz, not rhythmic hits).
    timeline.deck1Segments.forEach((segment, i) => {
      const node = gainNodes[i];
      if (segment.lengthSec < 0.2) {
        expect(node.gain.setValueAtTime.mock.calls.length).toBeGreaterThan(2);
        expect(node.gain.exponentialRampToValueAtTime).toHaveBeenCalled();
      } else {
        expect(node.gain.setValueAtTime).toHaveBeenCalledTimes(2);
        expect(node.gain.exponentialRampToValueAtTime).not.toHaveBeenCalled();
      }
    });
  });

  test('run() gates a fast loop (< 0.2s) into evenly-spaced attack/decay cycles instead of one flat sustain', async () => {
    global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
    const { ctx, gainNodes } = makeFakeContext({ currentTime: 0 });
    const engine = new LoopMorphEngine();
    const audioBuffer = await engine.prepare(ctx, 'blob:track', 0, 1);
    // A single 0.1s-cycle segment lasting 1s: comfortably below the 0.2s gate threshold.
    const segments = [{ lengthBeats: 1, lengthSec: 0.1, startSec: 0, durationSec: 1 }];

    engine.run({ ctx, destinationBus: { connect: jest.fn() }, audioBuffer, segments, startAt: 100 });

    const [node] = gainNodes;
    // First call is the segment's own opening fade-in-from-0 anchor, not a cycle attack.
    expect(node.gain.setValueAtTime.mock.calls[0]).toEqual([0, 100]);
    const cycleAttacks = node.gain.setValueAtTime.mock.calls.slice(1).map((call) => call[0]);
    expect(cycleAttacks.every((value) => value === 1)).toBe(true);
    expect(cycleAttacks.length).toBeGreaterThanOrEqual(8); // ~1s / 0.1s cycles, minus the fades' share
    // Every attack is paired with a decay down to the floor, never straight to silence.
    expect(node.gain.exponentialRampToValueAtTime.mock.calls.length).toBe(cycleAttacks.length);
    node.gain.exponentialRampToValueAtTime.mock.calls.forEach((call) => {
      expect(call[0]).toBeCloseTo(0.08, 6);
    });
    // Attack times are strictly increasing (each cycle starts after the previous one's attack).
    const attackTimes = node.gain.setValueAtTime.mock.calls.slice(1).map((call) => call[1]);
    for (let i = 0; i < attackTimes.length - 1; i++) {
      expect(attackTimes[i]).toBeLessThan(attackTimes[i + 1]);
    }
  });

  test('run() leaves a loop at/above the 0.2s gate threshold as one flat sustain (no gating)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
    const { ctx, gainNodes } = makeFakeContext({ currentTime: 0 });
    const engine = new LoopMorphEngine();
    const audioBuffer = await engine.prepare(ctx, 'blob:track', 0, 2);
    const segments = [{ lengthBeats: 1, lengthSec: 0.25, startSec: 0, durationSec: 1 }];

    engine.run({ ctx, destinationBus: { connect: jest.fn() }, audioBuffer, segments, startAt: 100 });

    const [node] = gainNodes;
    expect(node.gain.setValueAtTime).toHaveBeenCalledTimes(2);
    expect(node.gain.exponentialRampToValueAtTime).not.toHaveBeenCalled();
  });

  test('run() pins stage 0 to an explicit startAt, and returns the t0 actually used', async () => {
    global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
    const { ctx, bufferSourceNodes } = makeFakeContext({ currentTime: 100 });
    const engine = new LoopMorphEngine();
    const audioBuffer = await engine.prepare(ctx, 'blob:track', 0, 1);
    const segments = [{ lengthBeats: 0.0625, lengthSec: 0.03125, startSec: 0, durationSec: 2 }];

    const result = engine.run({ ctx, destinationBus: { connect: jest.fn() }, audioBuffer, segments, startAt: 250 });

    expect(result.t0).toBe(250);
    expect(bufferSourceNodes[0].start.mock.calls[0][0]).toBeCloseTo(250, 6);
  });

  test('run() applies a non-default playbackRate to every scheduled node (deck2\'s BPM-sync ratio)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
    const { ctx, bufferSourceNodes } = makeFakeContext();
    const engine = new LoopMorphEngine();
    const audioBuffer = await engine.prepare(ctx, 'blob:track', 0, 1);
    const segments = [{ lengthBeats: 0.0625, lengthSec: 0.03125, startSec: 0, durationSec: 2 }];

    engine.run({ ctx, destinationBus: { connect: jest.fn() }, audioBuffer, segments, playbackRate: 1.15 });

    expect(bufferSourceNodes[0].playbackRate.setValueAtTime).toHaveBeenCalledWith(1.15, expect.any(Number));
  });

  test('run() leaves playbackRate untouched when it is the default (1)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
    const { ctx, bufferSourceNodes } = makeFakeContext();
    const engine = new LoopMorphEngine();
    const audioBuffer = await engine.prepare(ctx, 'blob:track', 0, 1);
    const segments = [{ lengthBeats: 0.0625, lengthSec: 0.03125, startSec: 0, durationSec: 2 }];

    engine.run({ ctx, destinationBus: { connect: jest.fn() }, audioBuffer, segments });

    expect(bufferSourceNodes[0].playbackRate.setValueAtTime).not.toHaveBeenCalled();
  });

  test('scheduleFinalSegmentRateChange() retunes only the LAST scheduled node\'s playbackRate, via a second setValueAtTime (no new node)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
    const { ctx, bufferSourceNodes } = makeFakeContext();
    const engine = new LoopMorphEngine();
    const audioBuffer = await engine.prepare(ctx, 'blob:track', 0, 1);
    const segments = [
      { lengthBeats: 1, lengthSec: 0.5, startSec: 0, durationSec: 2 },
      { lengthBeats: 0.0625, lengthSec: 0.03125, startSec: 2, durationSec: 2 },
    ];

    engine.run({ ctx, destinationBus: { connect: jest.fn() }, audioBuffer, segments });
    engine.scheduleFinalSegmentRateChange(150, 1.2);

    expect(bufferSourceNodes).toHaveLength(2);
    expect(bufferSourceNodes[0].playbackRate.setValueAtTime).not.toHaveBeenCalled();
    expect(bufferSourceNodes[1].playbackRate.setValueAtTime).toHaveBeenCalledWith(1.2, 150);
  });

  test('scheduleFinalSegmentRateChange() is a safe no-op before run() has scheduled anything', () => {
    const engine = new LoopMorphEngine();
    expect(() => engine.scheduleFinalSegmentRateChange(150, 1.2)).not.toThrow();
  });

  test('stop() is idempotent and safe before run(), and hard-cancels active nodes', async () => {
    const engine = new LoopMorphEngine();
    expect(() => engine.stop()).not.toThrow();

    global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
    const { ctx, bufferSourceNodes, gainNodes } = makeFakeContext();
    const audioBuffer = await engine.prepare(ctx, 'blob:track', 0, 1);
    const segments = [{ lengthBeats: 0.0625, lengthSec: 0.03125, startSec: 0, durationSec: 2 }];
    engine.run({ ctx, destinationBus: { connect: jest.fn() }, audioBuffer, segments });

    engine.stop();
    bufferSourceNodes.forEach((node) => expect(node.stop).toHaveBeenCalled());
    gainNodes.forEach((node) => expect(node.disconnect).toHaveBeenCalled());
    expect(() => engine.stop()).not.toThrow();
  });

  test('run() tears down any previous scheduling before scheduling new stages', async () => {
    global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
    const { ctx, bufferSourceNodes } = makeFakeContext();
    const engine = new LoopMorphEngine();
    const audioBuffer = await engine.prepare(ctx, 'blob:track', 0, 1);
    const segments = [{ lengthBeats: 0.0625, lengthSec: 0.03125, startSec: 0, durationSec: 2 }];
    const destinationBus = { connect: jest.fn() };

    engine.run({ ctx, destinationBus, audioBuffer, segments });
    const firstRunNodes = [...bufferSourceNodes];
    engine.run({ ctx, destinationBus, audioBuffer, segments });

    firstRunNodes.forEach((node) => expect(node.stop).toHaveBeenCalled());
  });
});
