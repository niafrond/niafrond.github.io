/**
 * beatRepeatEngine.test.js — Tests unitaires pour dj-mix/lib/beatRepeatEngine.js
 * Références SPEC-1.3.8.1 à SPEC-1.3.8.14 (dj-mix/SPECS.md).
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  BEAT_REPEAT_BEATS_PER_BAR,
  BEAT_REPEAT_DEFAULT_INITIAL_BEATS,
  BEAT_REPEAT_FALLBACK_INITIAL_BEATS,
  BEAT_REPEAT_MIN_INITIAL_BEATS,
  BEAT_REPEAT_FLOOR_BEATS,
  BeatRepeatEngine,
  buildBeatRepeatStageBeats,
  chooseInitialLoopBeats,
  computeBeatRepeatElapsedBeatsAtStageStart,
  computeBeatRepeatFinalStagePitchRatio,
  computeBeatRepeatHalfStageIndex,
  computeBeatRepeatLaunchBeats,
  computeBeatRepeatLoopPhaseMs,
  computeBeatRepeatStageIndexAtElapsedBeats,
  computeBeatRepeatStepProgress,
  computeCrossfadeWindowSec,
  computeLoopAnchorSeconds,
  computeStageTimeline,
  getSafeBeatRepeatBpm,
} from '../../lib/beatRepeatEngine.js';

// ── SPEC-1.3.8.3 — getSafeBeatRepeatBpm ─────────────────────────────────────

describe('getSafeBeatRepeatBpm', () => {
  test('clamps out-of-range BPM to [60, 220]', () => {
    expect(getSafeBeatRepeatBpm(30)).toBe(60);
    expect(getSafeBeatRepeatBpm(400)).toBe(220);
  });

  test('passes through valid BPM unchanged', () => {
    expect(getSafeBeatRepeatBpm(128)).toBe(128);
  });

  test('falls back to 120 for missing/invalid BPM', () => {
    expect(getSafeBeatRepeatBpm(undefined)).toBe(120);
    expect(getSafeBeatRepeatBpm(null)).toBe(120);
    expect(getSafeBeatRepeatBpm(0)).toBe(120);
    expect(getSafeBeatRepeatBpm(NaN)).toBe(120);
  });
});

// ── SPEC-1.3.8.2 — chooseInitialLoopBeats (step 2 runway ladder) ───────────

describe('SPEC-1.3.8.2 — chooseInitialLoopBeats', () => {
  test('defaults to 6 beats when plenty of runway remains', () => {
    expect(BEAT_REPEAT_DEFAULT_INITIAL_BEATS).toBe(6);
    expect(chooseInitialLoopBeats(100)).toBe(6);
    expect(chooseInitialLoopBeats(100, 6)).toBe(6);
  });

  test('falls back to 3 beats (half the default) when fewer than 6 beats remain', () => {
    expect(BEAT_REPEAT_FALLBACK_INITIAL_BEATS).toBe(3);
    expect(chooseInitialLoopBeats(4, 6)).toBe(3);
    expect(chooseInitialLoopBeats(5.999, 6)).toBe(3);
  });

  test('generalizes the same ladder shape for an explicit desired value of 8 (documentation/back-compat case)', () => {
    expect(chooseInitialLoopBeats(100, 8)).toBe(8);
    expect(chooseInitialLoopBeats(6, 8)).toBe(4);
    expect(chooseInitialLoopBeats(7.999, 8)).toBe(4);
  });

  test('never returns less than 2 beats, even with almost no runway', () => {
    expect(BEAT_REPEAT_MIN_INITIAL_BEATS).toBe(2);
    expect(chooseInitialLoopBeats(3, 8)).toBe(2);
    expect(chooseInitialLoopBeats(0, 8)).toBe(2);
    expect(chooseInitialLoopBeats(-5, 8)).toBe(2);
  });

  test('trusts the desired value when remaining runway is unknown/infinite', () => {
    expect(chooseInitialLoopBeats(Infinity, 8)).toBe(8);
    expect(chooseInitialLoopBeats(NaN, 8)).toBe(8);
    expect(chooseInitialLoopBeats(undefined, 8)).toBe(8);
  });

  test('never returns below the absolute floor, even if desiredInitialBeats itself is misconfigured below it', () => {
    expect(chooseInitialLoopBeats(100, 1)).toBe(2);
    expect(chooseInitialLoopBeats(100, 0.5)).toBe(2);
  });

  test('generalizes the ladder for a configured desiredInitialBeats other than 8', () => {
    expect(chooseInitialLoopBeats(100, 4)).toBe(4);
    expect(chooseInitialLoopBeats(3, 4)).toBe(2);
    expect(chooseInitialLoopBeats(100, 2)).toBe(2);
    expect(chooseInitialLoopBeats(100, 16)).toBe(16);
    expect(chooseInitialLoopBeats(10, 16)).toBe(8);
    expect(chooseInitialLoopBeats(1, 16)).toBe(2);
  });
});

// ── SPEC-1.3.8.3 — buildBeatRepeatStageBeats (absolute 1/16 floor) ─────────

describe('SPEC-1.3.8.3 — buildBeatRepeatStageBeats', () => {
  test('BEAT_REPEAT_FLOOR_BEATS is 1/16', () => {
    expect(BEAT_REPEAT_FLOOR_BEATS).toBeCloseTo(0.0625, 6);
  });

  test('8-beat initial produces the exact given sequence (8 stages)', () => {
    expect(buildBeatRepeatStageBeats(8)).toEqual([8, 4, 2, 1, 0.5, 0.25, 0.125, 0.0625]);
  });

  test('4-beat initial produces fewer stages, same absolute floor', () => {
    expect(buildBeatRepeatStageBeats(4)).toEqual([4, 2, 1, 0.5, 0.25, 0.125, 0.0625]);
  });

  test('2-beat initial produces even fewer stages, same absolute floor', () => {
    expect(buildBeatRepeatStageBeats(2)).toEqual([2, 1, 0.5, 0.25, 0.125, 0.0625]);
  });

  test('defaults to the 6-beat sequence with no arguments', () => {
    expect(buildBeatRepeatStageBeats()).toEqual(buildBeatRepeatStageBeats(6));
    expect(buildBeatRepeatStageBeats()).toEqual([6, 3, 1.5, 0.75, 0.375, 0.1875, 0.09375, 0.0625]);
  });

  test('falls back to the default for invalid initialBeats', () => {
    expect(buildBeatRepeatStageBeats(0)).toEqual(buildBeatRepeatStageBeats(6));
    expect(buildBeatRepeatStageBeats(-4)).toEqual(buildBeatRepeatStageBeats(6));
    expect(buildBeatRepeatStageBeats(NaN)).toEqual(buildBeatRepeatStageBeats(6));
  });
});

// ── SPEC-1.3.8.4/.5 — computeBeatRepeatLaunchBeats (2 reps/stage, bar boundary) ─

describe('SPEC-1.3.8.4/.5 — computeBeatRepeatLaunchBeats', () => {
  test('actual default (6-beat) sequence: total is 24 beats (6 bars)', () => {
    expect(BEAT_REPEAT_BEATS_PER_BAR).toBe(4);
    const stageBeats = buildBeatRepeatStageBeats();
    expect(computeBeatRepeatLaunchBeats(stageBeats)).toBe(24);
  });

  test('8-beat sequence (explicit, documentation/back-compat case): total is 32 beats (8 bars)', () => {
    const stageBeats = buildBeatRepeatStageBeats(8);
    expect(computeBeatRepeatLaunchBeats(stageBeats)).toBe(32);
  });

  test('4-beat initial sequence: total is 16 beats', () => {
    const stageBeats = buildBeatRepeatStageBeats(4);
    expect(computeBeatRepeatLaunchBeats(stageBeats)).toBe(16);
  });

  test('2-beat initial sequence: total is 8 beats', () => {
    const stageBeats = buildBeatRepeatStageBeats(2);
    expect(computeBeatRepeatLaunchBeats(stageBeats)).toBe(8);
  });

  test('never returns a value at or below the point where the floor stage completes its mandatory 2 reps, even exactly on a bar boundary', () => {
    // minLoopedBeats = 2*(4+4) = 16, already an exact bar boundary — must bump to the next one.
    expect(computeBeatRepeatLaunchBeats([4, 4])).toBe(20);
    // Single-stage case: minLoopedBeats = 2*2 = 4, exact boundary — must bump.
    expect(computeBeatRepeatLaunchBeats([2])).toBe(8);
  });

  test('scales with a custom beatsPerBar', () => {
    expect(computeBeatRepeatLaunchBeats([1, 1, 1, 1], 4)).toBe(12);
    expect(computeBeatRepeatLaunchBeats([1, 1], 2)).toBe(6);
  });
});

// ── SPEC-1.3.8.1 — computeLoopAnchorSeconds (beat-grid snap) ────────────────

describe('SPEC-1.3.8.1 — computeLoopAnchorSeconds', () => {
  test('snaps forward to the next beat boundary, never behind the current position (phase-zero at track start)', () => {
    expect(computeLoopAnchorSeconds(0, 0.5)).toBeCloseTo(0, 6); // exactly on grid: no wait needed
    expect(computeLoopAnchorSeconds(0.01, 0.5)).toBeCloseTo(0.5, 6);
    expect(computeLoopAnchorSeconds(0.24, 0.5)).toBeCloseTo(0.5, 6); // "nearest" would have snapped to 0 — must not
    expect(computeLoopAnchorSeconds(0.26, 0.5)).toBeCloseTo(0.5, 6);
    expect(computeLoopAnchorSeconds(1.9, 0.5)).toBeCloseTo(2.0, 6);
  });

  test('float noise right at an exact boundary does not add a spurious extra beat of wait', () => {
    expect(computeLoopAnchorSeconds(1.9999999998, 0.5)).toBeCloseTo(2.0, 6);
  });

  test('never returns a negative anchor / handles invalid input safely', () => {
    expect(computeLoopAnchorSeconds(-1, 0.5)).toBe(0);
    expect(computeLoopAnchorSeconds(NaN, 0.5)).toBe(0);
    expect(computeLoopAnchorSeconds(5, NaN)).toBe(5);
    expect(computeLoopAnchorSeconds(5, 0)).toBe(5);
  });
});

// ── computeStageTimeline (relative, audio-clock-agnostic) ──────────────────

describe('computeStageTimeline', () => {
  test('each non-final stage spans exactly 2x its own length; starts are monotonic', () => {
    const stageBeats = buildBeatRepeatStageBeats(8);
    const timeline = computeStageTimeline(stageBeats, 0.5); // 120 BPM
    expect(timeline).toHaveLength(8);
    for (let i = 0; i < timeline.length - 1; i++) {
      expect(timeline[i].startSec).toBeLessThan(timeline[i + 1].startSec);
      expect(timeline[i + 1].startSec - timeline[i].startSec).toBeCloseTo(timeline[i].lengthSec * 2, 6);
    }
    expect(timeline[timeline.length - 1].isFinal).toBe(true);
    // Sum of first 7 stages x2 (beats) x 0.5s/beat = 15.875s.
    expect(timeline[timeline.length - 1].startSec).toBeCloseTo(15.875, 6);
  });
});

// ── SPEC-1.3.8.7 — computeCrossfadeWindowSec ────────────────────────────────

describe('SPEC-1.3.8.7 — computeCrossfadeWindowSec', () => {
  test('uses the target window for long stages', () => {
    expect(computeCrossfadeWindowSec(4)).toBeCloseTo(0.012, 6);
  });

  test('shrinks proportionally for short stages, never exceeding maxFraction', () => {
    const window = computeCrossfadeWindowSec(0.03125); // 1/16 beat @ 220bpm
    expect(window).toBeLessThanOrEqual(0.03125 * 0.25 + 1e-9);
  });

  test('never goes below the minimum floor, even for a very short stage', () => {
    expect(computeCrossfadeWindowSec(0.005)).toBeCloseTo(0.003, 6);
  });
});

// ── SPEC-1.3.8.16 — computeBeatRepeatStageIndexAtElapsedBeats / computeBeatRepeatStepProgress ─

describe('SPEC-1.3.8.16 — computeBeatRepeatStageIndexAtElapsedBeats', () => {
  test('stays on stage 0 for the whole first stage (2 reps of the longest loop)', () => {
    const stageBeats = buildBeatRepeatStageBeats(8); // [8,4,2,1,.5,.25,.125,.0625]
    expect(computeBeatRepeatStageIndexAtElapsedBeats(stageBeats, 0)).toBe(0);
    expect(computeBeatRepeatStageIndexAtElapsedBeats(stageBeats, 15.999)).toBe(0);
  });

  test('advances by exactly one index at each stage boundary (cumulative beats*2 per non-final stage)', () => {
    const stageBeats = buildBeatRepeatStageBeats(8);
    expect(computeBeatRepeatStageIndexAtElapsedBeats(stageBeats, 16)).toBe(1);
    expect(computeBeatRepeatStageIndexAtElapsedBeats(stageBeats, 24)).toBe(2);
    expect(computeBeatRepeatStageIndexAtElapsedBeats(stageBeats, 28)).toBe(3);
  });

  test('returns the last index (final/floor stage) once its own start is reached, and stays there', () => {
    const stageBeats = buildBeatRepeatStageBeats(8);
    expect(computeBeatRepeatStageIndexAtElapsedBeats(stageBeats, 31.75)).toBe(7);
    expect(computeBeatRepeatStageIndexAtElapsedBeats(stageBeats, 1000)).toBe(7);
  });
});

describe('SPEC-1.3.8.16 — computeBeatRepeatStepProgress (equal-share staircase)', () => {
  test('each stage represents an equal 1/N share; reaches (N-1)/N at the start of the final stage', () => {
    const stageBeats = buildBeatRepeatStageBeats(8); // N = 8 stages
    expect(computeBeatRepeatStepProgress(stageBeats, 0)).toBeCloseTo(0, 6);
    expect(computeBeatRepeatStepProgress(stageBeats, 16)).toBeCloseTo(1 / 8, 6);
    expect(computeBeatRepeatStepProgress(stageBeats, 31.75)).toBeCloseTo(7 / 8, 6);
    // Never reaches 1 here: the last 1/N is the instant launch cut applied separately (SPEC-1.3.8.10).
    expect(computeBeatRepeatStepProgress(stageBeats, 1000)).toBeLessThan(1);
  });
});

// ── SPEC-1.3.8.17 — computeBeatRepeatHalfStageIndex / computeBeatRepeatElapsedBeatsAtStageStart ─

describe('SPEC-1.3.8.17 — computeBeatRepeatHalfStageIndex', () => {
  test('returns the first stage index at/after the halfway point (ceil(N/2))', () => {
    expect(computeBeatRepeatHalfStageIndex(8)).toBe(4);
    expect(computeBeatRepeatHalfStageIndex(6)).toBe(3);
    expect(computeBeatRepeatHalfStageIndex(7)).toBe(4);
  });

  test('never returns the last index (always leaves at least one stage for the incoming loop)', () => {
    expect(computeBeatRepeatHalfStageIndex(1)).toBe(0);
    expect(computeBeatRepeatHalfStageIndex(2)).toBe(1);
  });

  test('falls back safely for invalid/non-positive counts', () => {
    expect(computeBeatRepeatHalfStageIndex(0)).toBe(0);
    expect(computeBeatRepeatHalfStageIndex(NaN)).toBe(0);
  });
});

describe('SPEC-1.3.8.17 — computeBeatRepeatElapsedBeatsAtStageStart', () => {
  test('sums beats*2 of every non-final stage strictly before the given index', () => {
    const stageBeats = buildBeatRepeatStageBeats(8); // [8,4,2,1,.5,.25,.125,.0625]
    expect(computeBeatRepeatElapsedBeatsAtStageStart(stageBeats, 0)).toBe(0);
    expect(computeBeatRepeatElapsedBeatsAtStageStart(stageBeats, 4)).toBeCloseTo(2 * (8 + 4 + 2 + 1), 6);
  });

  test('matches computeBeatRepeatHalfStageIndex to derive a valid incoming-loop launch budget', () => {
    const stageBeats = buildBeatRepeatStageBeats(8);
    const launchBeats = computeBeatRepeatLaunchBeats(stageBeats); // 32
    const halfIndex = computeBeatRepeatHalfStageIndex(stageBeats.length); // 4
    const elapsedAtHalf = computeBeatRepeatElapsedBeatsAtStageStart(stageBeats, halfIndex); // 30
    expect(elapsedAtHalf).toBe(30);
    // Remaining budget for the incoming deck's own (shorter) run must be strictly positive.
    expect(launchBeats - elapsedAtHalf).toBeGreaterThan(0);
  });
});

// ── SPEC-1.3.8.15 — computeBeatRepeatFinalStagePitchRatio ───────────────────

describe('SPEC-1.3.8.15 — computeBeatRepeatFinalStagePitchRatio', () => {
  test('ratio is target (incoming) BPM over source (outgoing) BPM', () => {
    expect(computeBeatRepeatFinalStagePitchRatio(120, 140)).toBeCloseTo(140 / 120, 6);
    expect(computeBeatRepeatFinalStagePitchRatio(140, 120)).toBeCloseTo(120 / 140, 6);
  });

  test('is exactly 1 (no bend) when both BPMs match', () => {
    expect(computeBeatRepeatFinalStagePitchRatio(128, 128)).toBe(1);
  });

  test('clamps both BPMs to the safe [60,220] range before computing the ratio', () => {
    expect(computeBeatRepeatFinalStagePitchRatio(30, 140)).toBeCloseTo(140 / 60, 6);
    expect(computeBeatRepeatFinalStagePitchRatio(120, 400)).toBeCloseTo(220 / 120, 6);
  });
});

// ── SPEC-1.3.8.13 — computeBeatRepeatLoopPhaseMs ────────────────────────────

describe('SPEC-1.3.8.13 — computeBeatRepeatLoopPhaseMs', () => {
  test('default 6-beat loop at 120 BPM totals 12000ms (24 beats)', () => {
    expect(computeBeatRepeatLoopPhaseMs(120)).toBeCloseTo(12000, 5);
  });

  test('a faster BPM yields a shorter real-time duration for the same beat grid', () => {
    const slow = computeBeatRepeatLoopPhaseMs(60);
    const fast = computeBeatRepeatLoopPhaseMs(180);
    expect(fast).toBeLessThan(slow);
  });

  test('a shorter configurable initial loop yields a shorter total duration', () => {
    const short = computeBeatRepeatLoopPhaseMs(120, 1);
    const long = computeBeatRepeatLoopPhaseMs(120, 8);
    expect(short).toBeLessThan(long);
  });
});

// ── BeatRepeatEngine — Web Audio scheduling (mocked AudioContext) ──────────

describe('BeatRepeatEngine', () => {
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

  function makeFakeContext({ currentTime = 100, sampleRate = 1000, fullBufferSeconds = 10 } = {}) {
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
    const { ctx } = makeFakeContext({ sampleRate: 1000, fullBufferSeconds: 10 });
    const engine = new BeatRepeatEngine();

    const windowBuffer = await engine.prepare(ctx, 'blob:track', 2, 4);

    expect(global.fetch).toHaveBeenCalledWith('blob:track');
    // anchorSec=2 (sample 2000), windowSec=4 (+0.25 margin) => 4250 samples, well under the
    // 10000-sample full buffer — retained memory is proportional to the loop window.
    expect(windowBuffer.length).toBe(4250);
    expect(windowBuffer.sampleRate).toBe(1000);
  });

  test('prepare() clamps the window so it never reads past the end of the full buffer', async () => {
    global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
    const { ctx } = makeFakeContext({ sampleRate: 1000, fullBufferSeconds: 3 });
    const engine = new BeatRepeatEngine();

    const windowBuffer = await engine.prepare(ctx, 'blob:track', 2.9, 4);

    expect(windowBuffer.length).toBe(100); // clamped to the full buffer's remaining 100 samples
  });

  test('run() schedules one AudioBufferSourceNode per stage with shrinking loopEnd and a fixed loopStart', async () => {
    global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
    const { ctx, bufferSourceNodes, gainNodes } = makeFakeContext({ currentTime: 100, sampleRate: 1000 });
    const engine = new BeatRepeatEngine();

    const audioBuffer = await engine.prepare(ctx, 'blob:track', 2, 4);
    const stageBeats = buildBeatRepeatStageBeats(8); // [8,4,2,1,.5,.25,.125,.0625]
    const launchBeats = computeBeatRepeatLaunchBeats(stageBeats); // 32
    const destinationBus = { connect: jest.fn() };

    engine.run({ ctx, destinationBus, audioBuffer, stageBeats, secondsPerBeat: 0.5, launchBeats });

    expect(bufferSourceNodes).toHaveLength(8);
    expect(gainNodes).toHaveLength(8);
    bufferSourceNodes.forEach((node) => expect(node.loop).toBe(true));

    // All-zero fake buffer: zero-crossing snap is a no-op, so loopStart stays at 0 for every
    // stage (fixed anchor) and loopEnd lands exactly on each stage's own length in samples.
    expect(bufferSourceNodes[0].loopStart).toBe(0);
    expect(bufferSourceNodes[0].loopEnd).toBeCloseTo(4, 6); // 8 beats * 0.5s = 4s
    expect(bufferSourceNodes[1].loopEnd).toBeCloseTo(2, 6); // 4 beats * 0.5s = 2s
    expect(bufferSourceNodes[7].loopEnd).toBeCloseTo(0.031, 3); // 1/16 beat * 0.5s

    // start() timestamps strictly increasing, matching t0 + stage.startSec.
    const t0 = 100.05; // ctx.currentTime + SCHEDULE_LEAD_SEC (0.05)
    const startArgs = bufferSourceNodes.map((n) => n.start.mock.calls[0][0]);
    for (let i = 0; i < startArgs.length - 1; i++) {
      expect(startArgs[i]).toBeLessThan(startArgs[i + 1]);
    }
    expect(startArgs[0]).toBeCloseTo(t0, 6);
    expect(startArgs[7]).toBeCloseTo(t0 + 15.875, 6);

    // Final stage's teardown is scheduled at t0 + launchBeats*secondsPerBeat (the bar-aligned
    // handoff instant), not at a fixed 2x-length point.
    const finalStopArg = bufferSourceNodes[7].stop.mock.calls[0][0];
    expect(finalStopArg).toBeCloseTo(t0 + (32 * 0.5) + 0.02, 3);

    // Each stage's gain ramps in from 0 and out to 0 (fade in + hold + fade out = 4 automation calls).
    gainNodes.forEach((node) => {
      expect(node.gain.setValueAtTime).toHaveBeenCalledTimes(2);
      expect(node.gain.linearRampToValueAtTime).toHaveBeenCalledTimes(2);
      expect(node.gain.setValueAtTime.mock.calls[0][0]).toBe(0);
      expect(node.gain.linearRampToValueAtTime.mock.calls[0][0]).toBe(1);
      expect(node.gain.linearRampToValueAtTime.mock.calls[1][0]).toBe(0);
    });
  });

  test('SPEC-1.3.8.15 — run() ramps only the final stage\'s playbackRate toward finalStagePitchRatio', async () => {
    global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
    const { ctx, bufferSourceNodes } = makeFakeContext({ currentTime: 100, sampleRate: 1000 });
    const engine = new BeatRepeatEngine();

    const audioBuffer = await engine.prepare(ctx, 'blob:track', 2, 4);
    const stageBeats = buildBeatRepeatStageBeats(8);
    const launchBeats = computeBeatRepeatLaunchBeats(stageBeats);
    const destinationBus = { connect: jest.fn() };

    engine.run({
      ctx, destinationBus, audioBuffer, stageBeats, secondsPerBeat: 0.5, launchBeats,
      finalStagePitchRatio: 1.15,
    });

    // Non-final stages are untouched (native tempo throughout the loop, only the last stage bends).
    bufferSourceNodes.slice(0, -1).forEach((node) => {
      expect(node.playbackRate.setValueAtTime).not.toHaveBeenCalled();
      expect(node.playbackRate.linearRampToValueAtTime).not.toHaveBeenCalled();
    });

    const finalNode = bufferSourceNodes[bufferSourceNodes.length - 1];
    expect(finalNode.playbackRate.setValueAtTime).toHaveBeenCalledWith(1, expect.any(Number));
    expect(finalNode.playbackRate.linearRampToValueAtTime).toHaveBeenCalledWith(1.15, expect.any(Number));
  });

  test('run() leaves playbackRate untouched when finalStagePitchRatio is 1 (default, no bend)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
    const { ctx, bufferSourceNodes } = makeFakeContext();
    const engine = new BeatRepeatEngine();
    const audioBuffer = await engine.prepare(ctx, 'blob:track', 0, 1);
    const stageBeats = buildBeatRepeatStageBeats(2);
    const launchBeats = computeBeatRepeatLaunchBeats(stageBeats);

    engine.run({ ctx, destinationBus: { connect: jest.fn() }, audioBuffer, stageBeats, secondsPerBeat: 0.5, launchBeats });

    bufferSourceNodes.forEach((node) => {
      expect(node.playbackRate.setValueAtTime).not.toHaveBeenCalled();
      expect(node.playbackRate.linearRampToValueAtTime).not.toHaveBeenCalled();
    });
  });

  test('stop() is idempotent and safe before run(), and hard-cancels active nodes', async () => {
    const engine = new BeatRepeatEngine();
    expect(() => engine.stop()).not.toThrow();

    global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
    const { ctx, bufferSourceNodes, gainNodes } = makeFakeContext();
    const audioBuffer = await engine.prepare(ctx, 'blob:track', 0, 1);
    const stageBeats = buildBeatRepeatStageBeats(2);
    const launchBeats = computeBeatRepeatLaunchBeats(stageBeats);
    engine.run({ ctx, destinationBus: { connect: jest.fn() }, audioBuffer, stageBeats, secondsPerBeat: 0.5, launchBeats });

    engine.stop();
    bufferSourceNodes.forEach((node) => expect(node.stop).toHaveBeenCalled());
    gainNodes.forEach((node) => expect(node.disconnect).toHaveBeenCalled());

    // Calling stop() again must not throw even though the nodes are already "stopped".
    expect(() => engine.stop()).not.toThrow();
  });

  test('run() tears down any previous scheduling before scheduling new stages', async () => {
    global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
    const { ctx, bufferSourceNodes } = makeFakeContext();
    const engine = new BeatRepeatEngine();
    const audioBuffer = await engine.prepare(ctx, 'blob:track', 0, 1);
    const stageBeats = buildBeatRepeatStageBeats(2);
    const launchBeats = computeBeatRepeatLaunchBeats(stageBeats);
    const destinationBus = { connect: jest.fn() };

    engine.run({ ctx, destinationBus, audioBuffer, stageBeats, secondsPerBeat: 0.5, launchBeats });
    const firstRunNodes = [...bufferSourceNodes];
    engine.run({ ctx, destinationBus, audioBuffer, stageBeats, secondsPerBeat: 0.5, launchBeats });

    firstRunNodes.forEach((node) => expect(node.stop).toHaveBeenCalled());
  });
});
