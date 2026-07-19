import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { createTrackPathDb } from '../../lib/trackPathDb.js';

function makeMemoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); },
  };
}

describe('trackPathDb', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // SPEC-11.5.1: nothing but the path is ever stored.
  test('get/set roundtrip a plain key -> cachePath pair', () => {
    const storage = makeMemoryStorage();
    const db = createTrackPathDb({ storageKey: 'test:paths', storage });

    expect(db.get('track-1')).toBe('');
    db.set('track-1', '/mnt/e/AudioDB/track-1.mp3');
    expect(db.get('track-1')).toBe('/mnt/e/AudioDB/track-1.mp3');
    expect(db.size()).toBe(1);
  });

  test('ignores empty key or cachePath on set', () => {
    const storage = makeMemoryStorage();
    const db = createTrackPathDb({ storageKey: 'test:paths', storage });

    db.set('', '/mnt/e/AudioDB/x.mp3');
    db.set('track-1', '');
    expect(db.size()).toBe(0);
  });

  // SPEC-11.5.1: writes are debounced (400ms) rather than synchronous, so a
  // bulk sync of a large library doesn't hammer localStorage on every entry.
  test('persists to storage debounced, not synchronously', () => {
    const storage = makeMemoryStorage();
    const setItemSpy = jest.spyOn(storage, 'setItem');
    const db = createTrackPathDb({ storageKey: 'test:paths', storage });

    db.set('track-1', '/mnt/e/AudioDB/track-1.mp3');
    expect(setItemSpy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(400);
    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(setItemSpy.mock.calls[0][1])).toEqual({ 'track-1': '/mnt/e/AudioDB/track-1.mp3' });
  });

  test('bulkSet coalesces multiple entries into a single debounced write', () => {
    const storage = makeMemoryStorage();
    const setItemSpy = jest.spyOn(storage, 'setItem');
    const db = createTrackPathDb({ storageKey: 'test:paths', storage });

    const changed = db.bulkSet([
      ['track-1', '/mnt/e/AudioDB/track-1.mp3'],
      ['track-2', '/mnt/e/AudioDB/track-2.mp3'],
      ['', '/mnt/e/AudioDB/ignored.mp3'],
    ]);

    expect(changed).toBe(true);
    jest.advanceTimersByTime(400);
    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(db.get('track-1')).toBe('/mnt/e/AudioDB/track-1.mp3');
    expect(db.get('track-2')).toBe('/mnt/e/AudioDB/track-2.mp3');
    expect(db.size()).toBe(2);
  });

  test('bulkSet is a no-op (no scheduled write) when nothing actually changed', () => {
    const storage = makeMemoryStorage();
    const db = createTrackPathDb({ storageKey: 'test:paths', storage });
    db.bulkSet([['track-1', '/mnt/e/AudioDB/track-1.mp3']]);
    jest.advanceTimersByTime(400);

    const setItemSpy = jest.spyOn(storage, 'setItem');
    const changed = db.bulkSet([['track-1', '/mnt/e/AudioDB/track-1.mp3']]);

    expect(changed).toBe(false);
    jest.advanceTimersByTime(400);
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  test('loads existing entries from storage on creation', () => {
    const storage = makeMemoryStorage();
    storage.setItem('test:paths', JSON.stringify({ 'track-9': '/mnt/e/AudioDB/track-9.mp3' }));

    const db = createTrackPathDb({ storageKey: 'test:paths', storage });

    expect(db.get('track-9')).toBe('/mnt/e/AudioDB/track-9.mp3');
  });

  test('falls back to an empty DB when stored JSON is corrupt', () => {
    const storage = makeMemoryStorage();
    storage.setItem('test:paths', '{not-json');

    const db = createTrackPathDb({ storageKey: 'test:paths', storage });

    expect(db.size()).toBe(0);
    expect(db.get('anything')).toBe('');
  });

  test('clear empties the DB and schedules a persisted write', () => {
    const storage = makeMemoryStorage();
    const db = createTrackPathDb({ storageKey: 'test:paths', storage });
    db.set('track-1', '/mnt/e/AudioDB/track-1.mp3');
    jest.advanceTimersByTime(400);

    db.clear();
    jest.advanceTimersByTime(400);

    expect(db.size()).toBe(0);
    expect(JSON.parse(storage.getItem('test:paths'))).toEqual({});
  });

  test('throws when created without a storageKey', () => {
    expect(() => createTrackPathDb({ storage: makeMemoryStorage() })).toThrow();
  });
});
