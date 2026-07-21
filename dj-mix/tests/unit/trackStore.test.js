import { createTrackStore } from '../../lib/trackStore.js';

beforeEach(() => {
  localStorage.clear();
});

describe('trackStore', () => {
  describe('getOrCreate', () => {
    test('creates a new record on first call', () => {
      const store = createTrackStore();
      const track = store.getOrCreate({ id: '1', name: 'Song A', artist: 'A' });
      expect(track.id).toBe('1');
      expect(track.name).toBe('Song A');
      expect(store.size()).toBe(1);
    });

    test('returns the same reference on a second call with the same id', () => {
      const store = createTrackStore();
      const first = store.getOrCreate({ id: '1', name: 'Song A', artist: 'A' });
      const second = store.getOrCreate({ id: '1', name: 'Song A', artist: 'A' });
      expect(second).toBe(first);
      expect(store.size()).toBe(1);
    });

    test('resolves id via artist::name fallback when no id present', () => {
      const store = createTrackStore();
      const first = store.getOrCreate({ name: 'Song A', artist: 'Foo' });
      const second = store.getOrCreate({ name: 'Song A', artist: 'Foo' });
      expect(second).toBe(first);
    });

    test('merges non-empty incoming fields into an existing record', () => {
      const store = createTrackStore();
      store.getOrCreate({ id: '1', name: 'Song A', artist: 'A' });
      const updated = store.getOrCreate({ id: '1', name: 'Song A', artist: 'A', bpm: 128, genre: 'House' });
      expect(updated.bpm).toBe(128);
      expect(updated.genre).toBe('House');
    });

    test('does not clobber an existing non-empty field with an empty/null/zero incoming value', () => {
      const store = createTrackStore();
      store.getOrCreate({ id: '1', name: 'Song A', artist: 'A', bpm: 128, artUrl: 'http://x/art.png' });
      const updated = store.getOrCreate({ id: '1', name: 'Song A', artist: 'A', bpm: 0, artUrl: '' });
      expect(updated.bpm).toBe(128);
      expect(updated.artUrl).toBe('http://x/art.png');
    });

    test('does not reset sourceState/localBlobUrl on a re-fetch of an existing record', () => {
      const store = createTrackStore();
      const track = store.getOrCreate({ id: '1', name: 'Song A', artist: 'A' });
      track.sourceState = 'ready';
      track.localBlobUrl = 'blob:abc';
      const again = store.getOrCreate({ id: '1', name: 'Song A', artist: 'A' });
      expect(again.sourceState).toBe('ready');
      expect(again.localBlobUrl).toBe('blob:abc');
    });

    test('initializes runtime fields to defaults on first creation', () => {
      const store = createTrackStore();
      const track = store.getOrCreate({ id: '1', name: 'Song A', artist: 'A' });
      expect(track.sourceState).toBe('idle');
      expect(track.sourceError).toBeNull();
      expect(track.localBlobUrl).toBeNull();
    });

    test('merges partial stems without blanking out previously-known stem urls', () => {
      const store = createTrackStore();
      store.getOrCreate({
        id: '1',
        name: 'Song A',
        artist: 'A',
        stems: { vocalsUrl: 'v.mp3', instrumentalUrl: 'i.mp3' },
      });
      const updated = store.getOrCreate({
        id: '1',
        name: 'Song A',
        artist: 'A',
        stems: { echoUrl: 'e.mp3' },
      });
      expect(updated.stems).toEqual({
        vocalsUrl: 'v.mp3',
        instrumentalUrl: 'i.mp3',
        echoUrl: 'e.mp3',
      });
    });
  });

  describe('patch', () => {
    test('mutates an existing record and returns true', () => {
      const store = createTrackStore();
      store.getOrCreate({ id: '1', name: 'Song A', artist: 'A' });
      const result = store.patch('1', { bpm: 140 });
      expect(result).toBe(true);
      expect(store.get('1').bpm).toBe(140);
    });

    test('returns false for an unknown id', () => {
      const store = createTrackStore();
      expect(store.patch('missing', { bpm: 140 })).toBe(false);
    });
  });

  describe('persistence', () => {
    test('save persists only whitelisted track fields (no runtime fields)', () => {
      const store = createTrackStore();
      const track = store.getOrCreate({ id: '1', name: 'Song A', artist: 'A' });
      track.sourceState = 'ready';
      track.localBlobUrl = 'blob:abc';
      store.save();

      const raw = JSON.parse(localStorage.getItem('dj-mix:tracks'));
      expect(raw['1'].name).toBe('Song A');
      expect(raw['1'].localBlobUrl).toBeUndefined();
      expect(raw['1'].sourceState).toBeUndefined();
    });

    test('restore recovers field values in a fresh store instance', () => {
      const store1 = createTrackStore();
      store1.getOrCreate({ id: '1', name: 'Song A', artist: 'A', bpm: 128, genre: 'House' });
      store1.save();

      const store2 = createTrackStore();
      store2.restore();
      const track = store2.get('1');
      expect(track.name).toBe('Song A');
      expect(track.bpm).toBe(128);
      expect(track.genre).toBe('House');
      expect(track.sourceState).toBe('idle');
    });

    test('restore is tolerant of a missing key', () => {
      const store = createTrackStore();
      expect(() => store.restore()).not.toThrow();
      expect(store.size()).toBe(0);
    });

    test('restore is tolerant of corrupt JSON', () => {
      localStorage.setItem('dj-mix:tracks', '{not valid json');
      const store = createTrackStore();
      expect(() => store.restore()).not.toThrow();
      expect(store.size()).toBe(0);
    });

    test('djIsIconic persists across a save/restore cycle (regression: was previously dropped)', () => {
      const store1 = createTrackStore();
      store1.getOrCreate({ id: '1', name: 'Song A', artist: 'A' });
      store1.patch('1', { djIsIconic: true });
      store1.save();

      const store2 = createTrackStore();
      store2.restore();
      expect(store2.get('1').djIsIconic).toBe(true);
    });

    test('save() strips a blob: artUrl instead of persisting it (regression: stale blob URLs blocked artwork re-download)', () => {
      const store = createTrackStore();
      const track = store.getOrCreate({ id: '1', name: 'Song A', artist: 'A' });
      store.patch('1', { artUrl: 'blob:https://example.com/abcd-1234' });
      store.save();

      const raw = JSON.parse(localStorage.getItem('dj-mix:tracks'));
      expect(raw['1'].artUrl).toBe('');
      // in-memory value for the current session is left untouched
      expect(track.artUrl).toBe('blob:https://example.com/abcd-1234');
    });

    test('restore() clears a stale blob: artUrl already sitting in localStorage (regression: pre-fix data)', () => {
      localStorage.setItem('dj-mix:tracks', JSON.stringify({
        1: { id: '1', name: 'Song A', artist: 'A', artUrl: 'blob:https://example.com/dead' },
      }));

      const store = createTrackStore();
      store.restore();
      expect(store.get('1').artUrl).toBe('');
    });

    test('a non-blob artUrl (remote CDN URL) survives a save/restore cycle', () => {
      const store1 = createTrackStore();
      store1.getOrCreate({ id: '1', name: 'Song A', artist: 'A', artUrl: 'https://cdn.example.com/art.jpg' });
      store1.save();

      const store2 = createTrackStore();
      store2.restore();
      expect(store2.get('1').artUrl).toBe('https://cdn.example.com/art.jpg');
    });
  });

  describe('pruneUnreferenced', () => {
    test('removes ids not in the referenced set and keeps the rest', () => {
      const store = createTrackStore();
      store.getOrCreate({ id: '1', name: 'A', artist: 'A' });
      store.getOrCreate({ id: '2', name: 'B', artist: 'B' });
      store.getOrCreate({ id: '3', name: 'C', artist: 'C' });

      const removed = store.pruneUnreferenced(new Set(['1', '3']));
      expect(removed).toBe(1);
      expect(store.has('1')).toBe(true);
      expect(store.has('2')).toBe(false);
      expect(store.has('3')).toBe(true);
    });
  });
});
