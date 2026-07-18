/**
 * Spec-driven tests for §3 — Fil Rouge
 * References: SPEC-3.1–3.4
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { createFilRougeManager } from '../../../lib/filRougeManager.js';
import { createTrackStore } from '../../../lib/trackStore.js';
import { computeNextBatchSize } from '../../../lib/downloadBatchSizing.js';

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

  test('SPEC-3.1.1/3.1.2 — persists the playlist as a thin id-list, not full track objects', () => {
    const mgr = createFilRougeManager();
    mgr.addToPlaylist(makeTrack({ id: '1', name: 'Song A' }));
    mgr.save();
    const raw = JSON.parse(localStorage.getItem('dj-mix:fil-rouge'));
    expect(raw.playlist).toEqual(['1']);
    expect(raw.playlist[0]).not.toHaveProperty('name');
  });

  test('SPEC-3.1.6 — djIsIconic (patched via patchPlaylistItem) survives a save/restore cycle', () => {
    const trackStore = createTrackStore();
    const mgr = createFilRougeManager({ trackStore });
    mgr.addToPlaylist({ id: '1', name: 'Song A', artist: 'A' });
    mgr.patchPlaylistItem('1', { djIsIconic: true });
    mgr.save();

    const freshStore = createTrackStore();
    freshStore.restore();
    expect(freshStore.get('1').djIsIconic).toBe(true);
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

// ── SPEC-3.4.9 — Adaptive download batch sizing ─────────────────────────────

describe('SPEC-3.4.9 — Ajustement adaptatif du parallélisme de téléchargement', () => {
  test('SPEC-3.4.9 — réduit la taille du batch quand le débit par morceau est trop faible', () => {
    const next = computeNextBatchSize({
      currentSize: 5,
      elapsedMs: 30_000, // 6000 ms/morceau, au-delà des 4000 ms cibles
      completedCount: 5,
    });
    expect(next).toBe(3);
  });

  test('SPEC-3.4.9 — augmente la taille du batch quand le débit par morceau est largement sous la cible', () => {
    const next = computeNextBatchSize({
      currentSize: 5,
      elapsedMs: 5_000, // 1000 ms/morceau, sous la moitié des 4000 ms cibles
      completedCount: 5,
    });
    expect(next).toBe(7);
  });

  test('SPEC-3.4.9 — ne descend jamais sous le plancher de 2 téléchargements parallèles', () => {
    const next = computeNextBatchSize({
      currentSize: 2,
      elapsedMs: 30_000,
      completedCount: 2,
    });
    expect(next).toBe(2);
  });

  test('SPEC-3.4.9 — ne dépasse jamais le plafond de 20 téléchargements parallèles', () => {
    const next = computeNextBatchSize({
      currentSize: 20,
      elapsedMs: 1_000,
      completedCount: 20,
    });
    expect(next).toBe(20);
  });
});
