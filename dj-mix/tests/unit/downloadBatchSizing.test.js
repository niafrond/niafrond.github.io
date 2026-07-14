import { describe, test, expect } from '@jest/globals';
import { computeNextBatchSize } from '../../lib/downloadBatchSizing.js';
import {
  MIN_PARALLEL_DOWNLOADS,
  MAX_PARALLEL_DOWNLOADS,
  TARGET_MS_PER_TRACK_DOWNLOAD,
} from '../../lib/constants.js';

describe('computeNextBatchSize (SPEC-3.4.9)', () => {
  test('keeps size unchanged when per-track time is around the target', () => {
    const next = computeNextBatchSize({
      currentSize: 5,
      elapsedMs: TARGET_MS_PER_TRACK_DOWNLOAD * 5 * 0.75,
      completedCount: 5,
    });
    expect(next).toBe(5);
  });

  test('decreases by 1 when per-track time exceeds the target', () => {
    const next = computeNextBatchSize({
      currentSize: 5,
      elapsedMs: (TARGET_MS_PER_TRACK_DOWNLOAD + 1000) * 5,
      completedCount: 5,
    });
    expect(next).toBe(4);
  });

  test('does not decrease below MIN_PARALLEL_DOWNLOADS', () => {
    const next = computeNextBatchSize({
      currentSize: MIN_PARALLEL_DOWNLOADS,
      elapsedMs: (TARGET_MS_PER_TRACK_DOWNLOAD + 1000) * MIN_PARALLEL_DOWNLOADS,
      completedCount: MIN_PARALLEL_DOWNLOADS,
    });
    expect(next).toBe(MIN_PARALLEL_DOWNLOADS);
  });

  test('increases by 1 when per-track time is well under the target', () => {
    const next = computeNextBatchSize({
      currentSize: 5,
      elapsedMs: (TARGET_MS_PER_TRACK_DOWNLOAD / 2 - 100) * 5,
      completedCount: 5,
    });
    expect(next).toBe(6);
  });

  test('does not increase above MAX_PARALLEL_DOWNLOADS', () => {
    const next = computeNextBatchSize({
      currentSize: MAX_PARALLEL_DOWNLOADS,
      elapsedMs: 100,
      completedCount: MAX_PARALLEL_DOWNLOADS,
    });
    expect(next).toBe(MAX_PARALLEL_DOWNLOADS);
  });

  test('ignores zero/invalid elapsed time or completed count', () => {
    expect(computeNextBatchSize({ currentSize: 4, elapsedMs: 0, completedCount: 4 })).toBe(4);
    expect(computeNextBatchSize({ currentSize: 4, elapsedMs: 5000, completedCount: 0 })).toBe(4);
  });
});
