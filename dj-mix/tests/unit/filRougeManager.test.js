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
});
