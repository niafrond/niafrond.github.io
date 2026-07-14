/**
 * Spec-driven tests for §1.1 — Vérification périodique du préchargement de la platine inactive
 * References: SPEC-1.1.8, SPEC-1.1.9, SPEC-1.1.10, SPEC-1.1.11, SPEC-1.1.12
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { createInactivePreloadWatcher } from '../../../lib/inactivePreloadWatcher.js';

function makeWatcher(overrides = {}) {
  const state = {
    playing: true,
    activeDeck: 'A',
    items: { A: null, B: null },
  };

  const setDeckItem = jest.fn((deck, item) => { state.items[deck] = item; });
  const logDebug = jest.fn();
  const logWarn = jest.fn();

  const watcher = createInactivePreloadWatcher({
    isPlaying: () => state.playing,
    getActiveDeck: () => state.activeDeck,
    getInactiveDeck: () => (state.activeDeck === 'A' ? 'B' : 'A'),
    getDeckItem: (deck) => state.items[deck] ?? null,
    setDeckItem,
    logDebug,
    logWarn,
    intervalMs: 100,
    ...overrides,
  });

  return { watcher, state, setDeckItem, logDebug, logWarn };
}

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

// ── SPEC-1.1.8 ──────────────────────────────────────────────────────────────

describe('SPEC-1.1.8 — start() launches a periodic check every intervalMs', () => {
  test('GIVEN playback active — WHEN start() called — THEN tick fires after intervalMs', () => {
    const { watcher, logWarn } = makeWatcher();
    watcher.start();
    expect(logWarn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(100);
    // Inactive deck (B) has no item → warns
    expect(logWarn).toHaveBeenCalledWith(
      expect.stringContaining('platine inactive sans piste préchargée'),
      expect.any(Object),
    );
  });

  test('tick does not fire before intervalMs', () => {
    const { watcher, logWarn } = makeWatcher();
    watcher.start();
    jest.advanceTimersByTime(99);
    expect(logWarn).not.toHaveBeenCalled();
  });
});

// ── SPEC-1.1.9 ──────────────────────────────────────────────────────────────

describe('SPEC-1.1.9 — stop() when inactive deck has a preloaded track', () => {
  test('GIVEN inactive deck has a track — WHEN tick runs — THEN interval is cleared (no further ticks)', () => {
    const { watcher, state, logWarn, logDebug } = makeWatcher();
    state.items.B = { id: 'track-2', name: 'Track 2' };
    watcher.start();
    jest.advanceTimersByTime(100);
    // Should have stopped → no warn, debug called
    expect(logWarn).not.toHaveBeenCalled();
    expect(logDebug).toHaveBeenCalledWith(
      expect.stringContaining('platine inactive préchargée'),
      expect.any(Object),
    );
    logDebug.mockClear();
    jest.advanceTimersByTime(200);
    // No further ticks
    expect(logDebug).not.toHaveBeenCalled();
  });
});

// ── SPEC-1.1.10 ─────────────────────────────────────────────────────────────

describe('SPEC-1.1.10 — restart when active deck changes', () => {
  test('GIVEN active deck changes mid-check — THEN watcher restarts for new inactive deck', () => {
    const { watcher, state, logDebug } = makeWatcher();
    watcher.start();
    // Simulate crossfade: active deck switches from A to B
    state.activeDeck = 'B';
    jest.advanceTimersByTime(100);
    expect(logDebug).toHaveBeenCalledWith(
      expect.stringContaining('platine active changée'),
      expect.objectContaining({ from: 'A', to: 'B' }),
    );
  });

  test('GIVEN active deck changes — THEN new inactive deck (A) is checked on next tick', () => {
    const { watcher, state, logWarn } = makeWatcher();
    // B becomes active, A is inactive with no track
    state.activeDeck = 'B';
    state.items = { A: null, B: { id: 'b-track', name: 'B' } };
    watcher.start();
    jest.advanceTimersByTime(100);
    // First tick: no deck change detected (watcher started with B as active)
    // Inactive is A, has no track → warns
    expect(logWarn).toHaveBeenCalledWith(
      expect.stringContaining('platine inactive sans piste préchargée'),
      expect.objectContaining({ activeDeck: 'B', inactiveDeck: 'A' }),
    );
  });

  test('GIVEN active deck changes mid-interval — THEN new 10s window resets', () => {
    const { watcher, state, logWarn, logDebug } = makeWatcher();
    watcher.start();
    // Switch at 50ms (before first tick)
    jest.advanceTimersByTime(50);
    state.activeDeck = 'B';
    jest.advanceTimersByTime(50); // total 100ms → first tick fires, detects change → restarts
    expect(logDebug).toHaveBeenCalledWith(
      expect.stringContaining('platine active changée'),
      expect.any(Object),
    );
    logWarn.mockClear();
    jest.advanceTimersByTime(99); // new interval not yet fired
    expect(logWarn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1); // now fires (new 100ms elapsed)
    expect(logWarn).toHaveBeenCalled();
  });
});

// ── SPEC-1.1.11 ─────────────────────────────────────────────────────────────

describe('SPEC-1.1.11 — stop when playback stops', () => {
  test('GIVEN playback stops — WHEN tick runs — THEN interval is cancelled', () => {
    const { watcher, state, logWarn } = makeWatcher();
    watcher.start();
    state.playing = false;
    jest.advanceTimersByTime(100);
    // stopped → no warn
    expect(logWarn).not.toHaveBeenCalled();
    // Advance again: no further ticks
    jest.advanceTimersByTime(200);
    expect(logWarn).not.toHaveBeenCalled();
  });

  test('stop() called directly cancels future ticks', () => {
    const { watcher, logWarn } = makeWatcher();
    watcher.start();
    watcher.stop();
    jest.advanceTimersByTime(500);
    expect(logWarn).not.toHaveBeenCalled();
  });
});

// ── SPEC-1.1.12 ─────────────────────────────────────────────────────────────

describe('SPEC-1.1.12 — bug guard: same track on both decks', () => {
  test('GIVEN same track id on both decks — WHEN tick runs — THEN inactive deck is cleared', () => {
    const sameTrack = { id: 'dup-id', name: 'Dup Track' };
    const { watcher, state, setDeckItem, logWarn } = makeWatcher();
    state.items.A = sameTrack;
    state.items.B = sameTrack;
    watcher.start();
    jest.advanceTimersByTime(100);
    expect(logWarn).toHaveBeenCalledWith(
      expect.stringContaining('même morceau sur les deux platines'),
      expect.objectContaining({ activeDeck: 'A', inactiveDeck: 'B', trackId: 'dup-id' }),
    );
    expect(setDeckItem).toHaveBeenCalledWith('B', null);
  });

  test('GIVEN different tracks on each deck — WHEN tick runs — THEN no cleanup is triggered', () => {
    const { watcher, state, setDeckItem } = makeWatcher();
    state.items.A = { id: 'track-a', name: 'A' };
    state.items.B = { id: 'track-b', name: 'B' };
    watcher.start();
    jest.advanceTimersByTime(100);
    expect(setDeckItem).not.toHaveBeenCalled();
  });
});
