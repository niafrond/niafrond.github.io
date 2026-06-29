/**
 * Spec-driven tests for §3 — Fil Rouge
 * References: SPEC-3.1–3.3
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { createFilRougeManager } from '../../../lib/filRougeManager.js';

beforeEach(() => {
  localStorage.clear();
});

function makeTrack(overrides = {}) {
  return {
    id: `fr-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Song',
    artist: 'Artist',
    duration: 200_000,
    ...overrides,
  };
}

// ── SPEC-3.1 — Playlist de fond ─────────────────────────────────────────────

describe('SPEC-3.1 — Fil Rouge basics', () => {
  test('SPEC-3.1.4 — isActive returns true when playlist has items', () => {
    const mgr = createFilRougeManager();
    expect(mgr.isActive()).toBe(false);
    mgr.addToPlaylist(makeTrack());
    expect(mgr.isActive()).toBe(true);
  });

  test('SPEC-3.1.4 — getNextTrack returns tracks sequentially', () => {
    const mgr = createFilRougeManager();
    mgr.addToPlaylist(makeTrack({ name: 'A' }));
    mgr.addToPlaylist(makeTrack({ name: 'B' }));
    expect(mgr.getNextTrack().name).toBe('A');
    expect(mgr.getNextTrack().name).toBe('B');
  });

  test('SPEC-3.1.4 — getNextTrack returns null when empty', () => {
    const mgr = createFilRougeManager();
    expect(mgr.getNextTrack()).toBeNull();
  });

  test('deduplication by id', () => {
    const mgr = createFilRougeManager();
    expect(mgr.addToPlaylist(makeTrack({ id: 'dup' }))).toBe(true);
    expect(mgr.addToPlaylist(makeTrack({ id: 'dup' }))).toBe(false);
    expect(mgr.getPlaylistLength()).toBe(1);
  });

  test('deduplication by name+artist', () => {
    const mgr = createFilRougeManager();
    mgr.addToPlaylist(makeTrack({ id: 'a', name: 'X', artist: 'Y' }));
    const added = mgr.addToPlaylist(makeTrack({ id: 'b', name: 'X', artist: 'Y' }));
    expect(added).toBe(false);
  });

  test('removeFromPlaylist works', () => {
    const mgr = createFilRougeManager();
    mgr.addToPlaylist(makeTrack({ name: 'A' }));
    mgr.addToPlaylist(makeTrack({ name: 'B' }));
    mgr.removeFromPlaylist(0);
    expect(mgr.getPlaylistLength()).toBe(1);
    expect(mgr.getPlaylist()[0].name).toBe('B');
  });

  test('clearPlaylist empties everything', () => {
    const mgr = createFilRougeManager();
    mgr.addToPlaylist(makeTrack());
    mgr.addToPlaylist(makeTrack());
    mgr.clearPlaylist();
    expect(mgr.getPlaylistLength()).toBe(0);
    expect(mgr.isActive()).toBe(false);
  });
});

// ── SPEC-3.2 — Shuffle & Loop ───────────────────────────────────────────────

describe('SPEC-3.2 — Fil Rouge shuffle & loop', () => {
  test('SPEC-3.2.1 — shuffle and loop are independent flags', () => {
    const mgr = createFilRougeManager();
    expect(mgr.isShuffleEnabled()).toBe(false);
    expect(mgr.isLoopEnabled()).toBe(false);
    mgr.toggleShuffle();
    expect(mgr.isShuffleEnabled()).toBe(true);
    expect(mgr.isLoopEnabled()).toBe(false);
  });

  test('SPEC-3.2.3 — loop wraps at end of playlist', () => {
    const mgr = createFilRougeManager();
    mgr.addToPlaylist(makeTrack({ name: 'A' }));
    mgr.addToPlaylist(makeTrack({ name: 'B' }));
    mgr.setLoopEnabled(true);
    mgr.getNextTrack(); // A
    mgr.getNextTrack(); // B
    const third = mgr.getNextTrack(); // loops to A
    expect(third.name).toBe('A');
  });

  test('SPEC-3.2.4 — no loop and no shuffle stops at end', () => {
    const mgr = createFilRougeManager();
    mgr.addToPlaylist(makeTrack({ name: 'A' }));
    mgr.setLoopEnabled(false);
    mgr.getNextTrack(); // A
    const second = mgr.getNextTrack(); // end
    expect(second).toBeNull();
  });

  test('SPEC-3.2.2 — shuffle picks random index', () => {
    const mgr = createFilRougeManager();
    for (let i = 0; i < 10; i++) {
      mgr.addToPlaylist(makeTrack({ id: `t-${i}`, name: `Song ${i}`, artist: `A${i}` }));
    }
    mgr.toggleShuffle();
    const results = new Set();
    for (let i = 0; i < 30; i++) {
      const track = mgr.getNextTrack();
      if (track) results.add(track.name);
    }
    // With shuffle and 10 items, we should see variety
    expect(results.size).toBeGreaterThan(1);
  });
});

// ── SPEC-3.3.1 — TXT import format ─────────────────────────────────────────

describe('SPEC-3.3.1 — TXT import parsing', () => {
  // These test the regex pattern the import uses
  const SEPARATOR_RE = /^(.+?)\s+(?:-|–|—)\s+(.+)$/u;

  test('parses "Artist — Title"', () => {
    const match = 'Daft Punk — Around the World'.match(SEPARATOR_RE);
    expect(match).not.toBeNull();
    expect(match[1]).toBe('Daft Punk');
    expect(match[2]).toBe('Around the World');
  });

  test('parses "Artist - Title"', () => {
    const match = 'Daft Punk - Around the World'.match(SEPARATOR_RE);
    expect(match).not.toBeNull();
    expect(match[1]).toBe('Daft Punk');
    expect(match[2]).toBe('Around the World');
  });

  test('parses "Artist – Title" (en dash)', () => {
    const match = 'Daft Punk – Around the World'.match(SEPARATOR_RE);
    expect(match).not.toBeNull();
  });

  test('no separator returns null (fallback to "Artiste inconnu")', () => {
    const match = 'Just A Song Title'.match(SEPARATOR_RE);
    expect(match).toBeNull();
  });
});
