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

  describe('priority queue', () => {
    test('adds items to priority queue', () => {
      const mgr = createFilRougeManager();
      const added = mgr.addToPriorityQueue({ id: '1', name: 'Song A', artist: 'A' });
      expect(added).toBe(true);
      expect(mgr.getPriorityQueueLength()).toBe(1);
    });

    test('rejects duplicates in priority queue', () => {
      const mgr = createFilRougeManager();
      mgr.addToPriorityQueue({ id: '1', name: 'Song A', artist: 'A' });
      const added = mgr.addToPriorityQueue({ id: '1', name: 'Song A', artist: 'A' });
      expect(added).toBe(false);
      expect(mgr.getPriorityQueueLength()).toBe(1);
    });

    test('removes from priority queue', () => {
      const mgr = createFilRougeManager();
      mgr.addToPriorityQueue({ id: '1', name: 'Song A', artist: 'A' });
      mgr.addToPriorityQueue({ id: '2', name: 'Song B', artist: 'B' });
      mgr.removeFromPriorityQueue(0);
      expect(mgr.getPriorityQueueLength()).toBe(1);
      expect(mgr.getPriorityQueue()[0].name).toBe('Song B');
    });
  });

  describe('getNextTrack', () => {
    test('returns from priority queue first', () => {
      const mgr = createFilRougeManager();
      mgr.addToPlaylist({ id: '1', name: 'Playlist Song', artist: 'A' });
      mgr.addToPriorityQueue({ id: '2', name: 'Priority Song', artist: 'B' });

      const next = mgr.getNextTrack();
      expect(next.name).toBe('Priority Song');
      expect(mgr.getPriorityQueueLength()).toBe(0);
    });

    test('falls back to playlist when priority queue is empty', () => {
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

      mgr.getNextTrack(); // Song A (index 0)
      mgr.getNextTrack(); // Song B (index 1)
      const third = mgr.getNextTrack(); // loops to Song A (index 0)
      expect(third.name).toBe('Song A');
    });

    test('returns null when both are empty', () => {
      const mgr = createFilRougeManager();
      expect(mgr.getNextTrack()).toBeNull();
    });

    test('priority queue exhausts before playlist continues', () => {
      const mgr = createFilRougeManager();
      mgr.addToPlaylist({ id: '1', name: 'P1', artist: 'A' });
      mgr.addToPlaylist({ id: '2', name: 'P2', artist: 'A' });
      mgr.addToPriorityQueue({ id: '3', name: 'Q1', artist: 'B' });
      mgr.addToPriorityQueue({ id: '4', name: 'Q2', artist: 'B' });

      expect(mgr.getNextTrack().name).toBe('Q1');
      expect(mgr.getNextTrack().name).toBe('Q2');
      expect(mgr.getNextTrack().name).toBe('P1'); // now falls back to playlist
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

    test('returns true with priority queue items', () => {
      const mgr = createFilRougeManager();
      mgr.addToPriorityQueue({ id: '1', name: 'A', artist: 'A' });
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

    test('returns priority queue item when available', () => {
      const mgr = createFilRougeManager();
      mgr.addToPlaylist({ id: '1', name: 'Playlist Song', artist: 'A' });
      mgr.addToPriorityQueue({ id: '2', name: 'Priority Song', artist: 'B' });

      expect(mgr.peekNextTrack().name).toBe('Priority Song');
      // Priority queue should not be modified
      expect(mgr.getPriorityQueueLength()).toBe(1);
    });
  });
});
