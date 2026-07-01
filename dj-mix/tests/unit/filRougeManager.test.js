import { createFilRougeManager } from '../../lib/filRougeManager.js';

beforeEach(() => {
  localStorage.clear();
});

describe('filRougeManager', () => {
  describe('playlist management', () => {
    test('adds items to playlist', () => {
      const mgr = createFilRougeManager();
      const added = mgr.addToPlaylist({ id: '1', name: 'Song A', artist: 'Artist A' });
      expect(added).toBe(true);
      expect(mgr.getPlaylistLength()).toBe(1);
    });

    test('rejects duplicates', () => {
      const mgr = createFilRougeManager();
      mgr.addToPlaylist({ id: '1', name: 'Song A', artist: 'Artist A' });
      const added = mgr.addToPlaylist({ id: '1', name: 'Song A', artist: 'Artist A' });
      expect(added).toBe(false);
      expect(mgr.getPlaylistLength()).toBe(1);
    });

    test('rejects duplicates by name+artist', () => {
      const mgr = createFilRougeManager();
      mgr.addToPlaylist({ id: '1', name: 'Song A', artist: 'Artist A' });
      const added = mgr.addToPlaylist({ id: '2', name: 'Song A', artist: 'Artist A' });
      expect(added).toBe(false);
    });

    test('removes from playlist', () => {
      const mgr = createFilRougeManager();
      mgr.addToPlaylist({ id: '1', name: 'Song A', artist: 'A' });
      mgr.addToPlaylist({ id: '2', name: 'Song B', artist: 'B' });
      mgr.removeFromPlaylist(0);
      expect(mgr.getPlaylistLength()).toBe(1);
      expect(mgr.getPlaylist()[0].name).toBe('Song B');
    });

    test('clears playlist', () => {
      const mgr = createFilRougeManager();
      mgr.addToPlaylist({ id: '1', name: 'Song A', artist: 'A' });
      mgr.addToPlaylist({ id: '2', name: 'Song B', artist: 'B' });
      mgr.clearPlaylist();
      expect(mgr.getPlaylistLength()).toBe(0);
    });
  });

  describe('getNextTrack', () => {
    test('returns from playlist first', () => {
      const mgr = createFilRougeManager();
      mgr.addToPlaylist({ id: '1', name: 'Song A', artist: 'A' });
      mgr.addToPlaylist({ id: '2', name: 'Song B', artist: 'B' });

      const first = mgr.getNextTrack();
      expect(first.name).toBe('Song A');

      const second = mgr.getNextTrack();
      expect(second.name).toBe('Song B');
    });

    test('loops playlist when reaching the end', () => {
      const mgr = createFilRougeManager();
      mgr.addToPlaylist({ id: '1', name: 'Song A', artist: 'A' });
      mgr.addToPlaylist({ id: '2', name: 'Song B', artist: 'B' });
      mgr.setLoopEnabled(true);

      mgr.getNextTrack(); // Song A (index 0)
      mgr.getNextTrack(); // Song B (index 1)
      const third = mgr.getNextTrack(); // loops to Song A (index 0)
      expect(third.name).toBe('Song A');
    });

    test('returns null when both are empty', () => {
      const mgr = createFilRougeManager();
      expect(mgr.getNextTrack()).toBeNull();
    });
  });

  describe('isActive', () => {
    test('returns false when empty', () => {
      const mgr = createFilRougeManager();
      expect(mgr.isActive()).toBe(false);
    });

    test('returns true with playlist items', () => {
      const mgr = createFilRougeManager();
      mgr.addToPlaylist({ id: '1', name: 'A', artist: 'A' });
      expect(mgr.isActive()).toBe(true);
    });
  });

  describe('shuffle', () => {
    test('toggle shuffle', () => {
      const mgr = createFilRougeManager();
      expect(mgr.isShuffleEnabled()).toBe(false);
      const on = mgr.toggleShuffle();
      expect(on).toBe(true);
      expect(mgr.isShuffleEnabled()).toBe(true);
    });
  });

  describe('persistence', () => {
    test('saves and restores playlist', () => {
      const mgr1 = createFilRougeManager();
      mgr1.addToPlaylist({ id: '1', name: 'Song A', artist: 'A' });
      mgr1.addToPlaylist({ id: '2', name: 'Song B', artist: 'B' });
      mgr1.getNextTrack(); // advance index
      mgr1.save(); // flush debounced save immediately

      // Create new instance which should restore from localStorage
      const mgr2 = createFilRougeManager();
      expect(mgr2.getPlaylistLength()).toBe(2);
      expect(mgr2.getCurrentIndex()).toBe(0);
    });
  });

  describe('peekNextTrack', () => {
    test('returns next without advancing', () => {
      const mgr = createFilRougeManager();
      mgr.addToPlaylist({ id: '1', name: 'Song A', artist: 'A' });
      mgr.addToPlaylist({ id: '2', name: 'Song B', artist: 'B' });

      const peeked = mgr.peekNextTrack();
      expect(peeked.name).toBe('Song A');
      // Peek again - should still be Song A since we didn't advance
      expect(mgr.peekNextTrack().name).toBe('Song A');
    });

    // SPEC-3.2.5: no wrap when loop is disabled
    test('SPEC-3.2.5: returns null at end of playlist when loop is disabled', () => {
      const mgr = createFilRougeManager();
      mgr.addToPlaylist({ id: '1', name: 'Song A', artist: 'A' });
      mgr.addToPlaylist({ id: '2', name: 'Song B', artist: 'B' });
      mgr.setLoopEnabled(false);

      // Advance to last track
      mgr.getNextTrack(); // -> Song A (index 0)
      mgr.getNextTrack(); // -> Song B (index 1)

      // Now at last index: peek should return null, NOT wrap to Song A
      expect(mgr.peekNextTrack()).toBeNull();
    });

    // SPEC-3.2.5: wraps to index 0 when loop is enabled
    test('SPEC-3.2.5: wraps to first track at end of playlist when loop is enabled', () => {
      const mgr = createFilRougeManager();
      mgr.addToPlaylist({ id: '1', name: 'Song A', artist: 'A' });
      mgr.addToPlaylist({ id: '2', name: 'Song B', artist: 'B' });
      mgr.setLoopEnabled(true);

      mgr.getNextTrack(); // -> Song A (index 0)
      mgr.getNextTrack(); // -> Song B (index 1)

      // At last index with loop: peek should wrap to Song A
      expect(mgr.peekNextTrack()?.name).toBe('Song A');
    });
  });

  describe('setCurrentIndex', () => {
    test('sets current index when valid', () => {
      const mgr = createFilRougeManager();
      mgr.addToPlaylist({ id: '1', name: 'Song A', artist: 'A' });
      mgr.addToPlaylist({ id: '2', name: 'Song B', artist: 'B' });

      const updated = mgr.setCurrentIndex(1);
      expect(updated).toBe(true);
      expect(mgr.getCurrentIndex()).toBe(1);
    });

    test('rejects invalid index', () => {
      const mgr = createFilRougeManager();
      mgr.addToPlaylist({ id: '1', name: 'Song A', artist: 'A' });

      const updated = mgr.setCurrentIndex(99);
      expect(updated).toBe(false);
      expect(mgr.getCurrentIndex()).toBe(-1);
    });
  });

  describe('DJ planner fields', () => {
    test('defaults djTrackId/djHasAnalysis/djTransition when not provided', () => {
      const mgr = createFilRougeManager();
      mgr.addToPlaylist({ id: '1', name: 'Song A', artist: 'A' });

      const item = mgr.getPlaylist()[0];
      expect(item.djTrackId).toBeNull();
      expect(item.djHasAnalysis).toBe(false);
      expect(item.djTransition).toBeNull();
    });

    test('round-trips djTrackId/djHasAnalysis/djTransition through add + persistence', () => {
      const djTransition = {
        toItemId: '2',
        transitionType: 'phrase_mix',
        mixOutSec: 12,
        mixInSec: 3,
        recommendedBpm: 124,
        crossfadeDurationSec: 8,
        compatibilityScore: 0.9,
        decisionId: 'd1',
        computedAt: Date.now(),
      };

      const mgr1 = createFilRougeManager();
      mgr1.addToPlaylist({
        id: '1',
        name: 'Song A',
        artist: 'A',
        djTrackId: 'a.mp3',
        djHasAnalysis: true,
        djTransition,
      });
      mgr1.save(); // flush debounced save immediately

      const item1 = mgr1.getPlaylist()[0];
      expect(item1.djTrackId).toBe('a.mp3');
      expect(item1.djHasAnalysis).toBe(true);
      expect(item1.djTransition).toEqual(djTransition);

      // Restore from localStorage in a new instance
      const mgr2 = createFilRougeManager();
      const item2 = mgr2.getPlaylist()[0];
      expect(item2.djTrackId).toBe('a.mp3');
      expect(item2.djHasAnalysis).toBe(true);
      expect(item2.djTransition).toEqual(djTransition);
    });

    test('patchPlaylistItem persists djTransition across instances', () => {
      const mgr1 = createFilRougeManager();
      mgr1.addToPlaylist({ id: '1', name: 'Song A', artist: 'A' });
      mgr1.addToPlaylist({ id: '2', name: 'Song B', artist: 'B' });

      const djTransition = { toItemId: '2', transitionType: 'long_blend', computedAt: Date.now(), decisionId: 'd2' };
      mgr1.patchPlaylistItem('1', { djTrackId: 'a.mp3', djHasAnalysis: true, djTransition });
      mgr1.save(); // flush debounced save immediately

      const mgr2 = createFilRougeManager();
      const item = mgr2.getPlaylist().find((p) => p.id === '1');
      expect(item.djTrackId).toBe('a.mp3');
      expect(item.djHasAnalysis).toBe(true);
      expect(item.djTransition).toEqual(djTransition);
    });

    test('deserializes legacy data without DJ fields to safe defaults', () => {
      const legacyData = {
        playlist: [
          { id: '1', name: 'Song A', artist: 'A' },
        ],
        priorityQueue: [],
        currentIndex: -1,
        shuffleEnabled: false,
        loopEnabled: false,
      };
      localStorage.setItem('dj-mix:fil-rouge', JSON.stringify(legacyData));

      const mgr = createFilRougeManager();
      const item = mgr.getPlaylist()[0];
      expect(item.djTrackId).toBeNull();
      expect(item.djHasAnalysis).toBe(false);
      expect(item.djTransition).toBeNull();
    });
  });
});
