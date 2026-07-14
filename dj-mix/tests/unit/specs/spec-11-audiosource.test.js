/**
 * Spec-driven tests for §11 — Gestion des sources audio
 * References: SPEC-11.1–11.4
 */
import { describe, test, expect } from '@jest/globals';
import {
  getDirectPlayableSourceUrl,
  isTrustedLocalAudioUrl,
  getTrackCacheKey,
} from '../../../lib/audioSourceManager.js';
import {
  isLowMemoryPlaybackDevice,
  LOW_MEMORY_PLAYBACK_MAX_RAM_MB,
} from '../../../lib/playbackMemoryPolicy.js';

// ── SPEC-11.1 — URL resolution ──────────────────────────────────────────────

describe('SPEC-11.1.1 — URL resolution cascade', () => {
  const getUrl = () => 'http://localhost:3000';

  test('prefers persistedSourceUrl first', () => {
    const track = {
      persistedSourceUrl: 'blob:persisted',
      localBlobUrl: 'blob:local',
      downloadUrl: 'http://localhost:3000/api/cache/x',
    };
    expect(getDirectPlayableSourceUrl(track, getUrl)).toBe('blob:persisted');
  });

  test('falls back to localBlobUrl', () => {
    const track = { localBlobUrl: 'blob:local' };
    expect(getDirectPlayableSourceUrl(track, getUrl)).toBe('blob:local');
  });

  test('returns empty string for no valid source', () => {
    const track = { url: 'http://evil.com/track.mp3' };
    expect(getDirectPlayableSourceUrl(track, getUrl)).toBe('');
  });

  test('accepts blob: URLs without trust check', () => {
    const track = { localBlobUrl: 'blob:http://localhost/12345' };
    expect(getDirectPlayableSourceUrl(track, getUrl)).toBe(track.localBlobUrl);
  });
});

// ── SPEC-11.1.3 — Trust validation ─────────────────────────────────────────

describe('SPEC-11.1.3 — isTrustedLocalAudioUrl', () => {
  const getUrl = () => 'http://192.168.8.149:3000';

  test('trusts same-origin URLs', () => {
    // jsdom uses http://localhost by default
    expect(isTrustedLocalAudioUrl('http://localhost/audio.mp3', () => '')).toBe(true);
  });

  test('trusts downloader API URLs with /api/cache/ path', () => {
    expect(isTrustedLocalAudioUrl(
      'http://192.168.8.149:3000/api/cache/song.mp3',
      getUrl,
    )).toBe(true);
  });

  test('rejects arbitrary external URLs', () => {
    expect(isTrustedLocalAudioUrl('https://evil.com/hack.mp3', getUrl)).toBe(false);
  });

  test('rejects downloader origin without /api/cache/ path', () => {
    expect(isTrustedLocalAudioUrl(
      'http://192.168.8.149:3000/other/path.mp3',
      getUrl,
    )).toBe(false);
  });
});

// ── SPEC-11.3 — Cache key generation ────────────────────────────────────────

describe('SPEC-11.3 — Cache key', () => {
  test('generates stable cache key from track', () => {
    const key = getTrackCacheKey({ name: 'Hello', artist: 'Adele' });
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(0);
  });

  test('same track produces same key', () => {
    const a = getTrackCacheKey({ name: 'Hello', artist: 'Adele' });
    const b = getTrackCacheKey({ name: 'Hello', artist: 'Adele' });
    expect(a).toBe(b);
  });

  test('different tracks produce different keys', () => {
    const a = getTrackCacheKey({ name: 'Hello', artist: 'Adele' });
    const b = getTrackCacheKey({ name: 'Bye', artist: 'Other' });
    expect(a).not.toBe(b);
  });
});

// ── SPEC-11.4 — Memory policy ───────────────────────────────────────────────

describe('SPEC-11.4 — Low memory detection', () => {
  test('SPEC-11.4.1 — threshold is 3072 MB', () => {
    expect(LOW_MEMORY_PLAYBACK_MAX_RAM_MB).toBe(3072);
  });

  test('SPEC-11.4.1 — detects constrained mobile device', () => {
    expect(isLowMemoryPlaybackDevice({
      enabled: true,
      mobile: true,
      totalRamMb: 2048,
    })).toBe(true);
  });

  test('SPEC-11.4.1 — at threshold is still low memory', () => {
    expect(isLowMemoryPlaybackDevice({
      enabled: true,
      mobile: true,
      totalRamMb: 3072,
    })).toBe(true);
  });

  test('ignores desktop devices', () => {
    expect(isLowMemoryPlaybackDevice({
      enabled: true,
      mobile: false,
      totalRamMb: 2048,
    })).toBe(false);
  });

  test('ignores mobile with high RAM', () => {
    expect(isLowMemoryPlaybackDevice({
      enabled: true,
      mobile: true,
      totalRamMb: 4096,
    })).toBe(false);
  });

  test('ignores when capability disabled', () => {
    expect(isLowMemoryPlaybackDevice({
      enabled: false,
      mobile: true,
      totalRamMb: 2048,
    })).toBe(false);
  });
});
