import { saveQueueToStorage, restoreQueueFromStorage } from '../../lib/queueStorage.js';
import { createTrackStore } from '../../lib/trackStore.js';

const KEY = 'dj-mix:queue';

beforeEach(() => {
  localStorage.clear();
});

describe('queueStorage', () => {
  describe('saveQueueToStorage', () => {
    test('persists only the thin, list-local shape (no track metadata)', () => {
      const queue = [
        { id: '1', name: 'Song A', artist: 'A', bpm: 128, queueSource: 'manual' },
      ];
      saveQueueToStorage({ currentIndex: 0, queue, storageKey: KEY });

      const raw = JSON.parse(localStorage.getItem(KEY));
      expect(raw.items[0]).toEqual({
        id: '1',
        queueSource: 'manual',
        autoDjReferenceTrackId: null,
        autoDjStartOffsetMs: 0,
      });
      expect(raw.items[0].name).toBeUndefined();
      expect(raw.items[0].bpm).toBeUndefined();
    });
  });

  describe('restoreQueueFromStorage', () => {
    test('returns null when storage is empty', () => {
      const trackStore = createTrackStore();
      expect(restoreQueueFromStorage(KEY, trackStore)).toBeNull();
    });

    test('resolves thin persisted items into trackStore references', () => {
      const trackStore = createTrackStore();
      trackStore.getOrCreate({ id: '1', name: 'Song A', artist: 'A', bpm: 128 });
      localStorage.setItem(KEY, JSON.stringify({
        index: 0,
        items: [{ id: '1', queueSource: 'auto-dj', autoDjReferenceTrackId: 'ref', autoDjStartOffsetMs: 500 }],
      }));

      const restored = restoreQueueFromStorage(KEY, trackStore);
      expect(restored.items).toHaveLength(1);
      expect(restored.items[0]).toBe(trackStore.get('1'));
      expect(restored.items[0].name).toBe('Song A');
      expect(restored.items[0].bpm).toBe(128);
      expect(restored.items[0].queueSource).toBe('auto-dj');
      expect(restored.items[0].autoDjReferenceTrackId).toBe('ref');
      expect(restored.items[0].autoDjStartOffsetMs).toBe(500);
    });

    test('migration: old fat-format persisted items feed their metadata into an empty trackStore', () => {
      const trackStore = createTrackStore();
      localStorage.setItem(KEY, JSON.stringify({
        index: 0,
        items: [{
          id: '1', uri: 'api:track:1', name: 'Song A', artist: 'A', artUrl: 'http://x/art.png',
          duration: 200000, bpm: 128, genre: 'House', loudnessDb: -8, cachePath: 'a.mp3',
          ratingKey: 'rk1', persistedSourceUrl: 'http://x/a.mp3', sourceState: 'ready',
        }],
      }));

      const restored = restoreQueueFromStorage(KEY, trackStore);
      expect(restored.items[0].name).toBe('Song A');
      expect(restored.items[0].bpm).toBe(128);
      expect(restored.items[0].genre).toBe('House');
      expect(restored.items[0].cachePath).toBe('a.mp3');
      expect(trackStore.get('1').name).toBe('Song A');
    });

    test('round trip: a fresh trackStore restored from dj-mix:tracks recovers full metadata', () => {
      const store1 = createTrackStore();
      const track = store1.getOrCreate({ id: '1', name: 'Song A', artist: 'A', bpm: 128, genre: 'House' });
      track.queueSource = 'manual';
      saveQueueToStorage({ currentIndex: 0, queue: [track], storageKey: KEY });
      store1.save();

      const store2 = createTrackStore();
      store2.restore();
      const restored = restoreQueueFromStorage(KEY, store2);
      expect(restored.items[0].name).toBe('Song A');
      expect(restored.items[0].bpm).toBe(128);
      expect(restored.items[0].genre).toBe('House');
    });
  });
});
