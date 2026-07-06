import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { createFilRougeDownloader } from '../../lib/filRougeDownloader.js';

function makeDownloader(overrides = {}) {
  const statuses = new Map();

  const defaults = {
    prefetchTrackToLocalCache: jest.fn().mockResolvedValue(true),
    isTrackInLocalCache: jest.fn().mockResolvedValue(false),
    setFilRougeTrackStatus: jest.fn((item, patch) => {
      const key = item.id || item.name;
      statuses.set(key, { ...(statuses.get(key) || {}), ...patch });
    }),
    getFilRougeTrackStatus: jest.fn((item) => {
      const key = item.id || item.name;
      return statuses.get(key) || { downloadState: 'idle', hasMixInfo: false };
    }),
    renderFilRouge: jest.fn(),
    renderTrackStatus: jest.fn(),
    showToast: jest.fn(),
    onProgress: jest.fn(),
    fetchMixData: jest.fn().mockResolvedValue({ probableSongStartSec: 10 }),
    ...overrides,
  };

  const downloader = createFilRougeDownloader(defaults);
  return { downloader, mocks: defaults, statuses };
}

function makeTrack(overrides = {}) {
  return { id: 'track-1', name: 'Song A', artist: 'Artist A', ...overrides };
}

// ── SPEC-3.5.3 : downloadAll — audio download + mix data ─────────────────────

describe('downloadAll — SPEC-3.5.3', () => {
  test('fetches mix data after successful audio download and sets hasMixInfo=true', async () => {
    const { downloader, mocks, statuses } = makeDownloader();
    const track = makeTrack();

    await downloader.downloadAll([track]);

    expect(mocks.prefetchTrackToLocalCache).toHaveBeenCalledWith(track);
    expect(mocks.fetchMixData).toHaveBeenCalledWith(track.name, track.artist);
    expect(statuses.get(track.id)).toMatchObject({ downloadState: 'done', hasMixInfo: true });
  });

  test('sets hasMixInfo=false when fetchMixData returns null', async () => {
    const { downloader, mocks, statuses } = makeDownloader({
      fetchMixData: jest.fn().mockResolvedValue(null),
    });
    const track = makeTrack();

    await downloader.downloadAll([track]);

    expect(mocks.fetchMixData).toHaveBeenCalledWith(track.name, track.artist);
    expect(statuses.get(track.id)).toMatchObject({ downloadState: 'done', hasMixInfo: false });
  });

  test('does not set hasMixInfo on failed audio download', async () => {
    const { downloader, mocks, statuses } = makeDownloader({
      prefetchTrackToLocalCache: jest.fn().mockResolvedValue(false),
    });
    const track = makeTrack();

    await downloader.downloadAll([track]);

    expect(mocks.fetchMixData).not.toHaveBeenCalled();
    expect(statuses.get(track.id)).toMatchObject({ downloadState: 'error' });
    expect(statuses.get(track.id)?.hasMixInfo).toBeUndefined();
  });

  test('sets hasMixInfo=false when fetchMixData throws', async () => {
    const { downloader, mocks, statuses } = makeDownloader({
      fetchMixData: jest.fn().mockRejectedValue(new Error('network')),
    });
    const track = makeTrack();

    await downloader.downloadAll([track]);

    expect(mocks.fetchMixData).toHaveBeenCalled();
    expect(statuses.get(track.id)).toMatchObject({ downloadState: 'done', hasMixInfo: false });
  });

  test('works without fetchMixData option (backward compat)', async () => {
    const { downloader, mocks, statuses } = makeDownloader({ fetchMixData: undefined });
    const track = makeTrack();

    await downloader.downloadAll([track]);

    expect(statuses.get(track.id)).toMatchObject({ downloadState: 'done', hasMixInfo: false });
  });
});

// ── SPEC-3.5.3 : downloadAll — already cached tracks also fetch mix data ──────

describe('downloadAll — cached tracks also fetch mix data (SPEC-3.5.3)', () => {
  test('fetches mix data for tracks already in cache', async () => {
    const { downloader, mocks, statuses } = makeDownloader({
      isTrackInLocalCache: jest.fn().mockResolvedValue(true),
    });
    const track = makeTrack();

    await downloader.downloadAll([track]);

    expect(mocks.prefetchTrackToLocalCache).not.toHaveBeenCalled();
    expect(mocks.fetchMixData).toHaveBeenCalledWith(track.name, track.artist);
    expect(statuses.get(track.id)).toMatchObject({ downloadState: 'done', hasMixInfo: true });
  });

  test('sets hasMixInfo=false for cached track when fetchMixData returns null', async () => {
    const { downloader, mocks, statuses } = makeDownloader({
      isTrackInLocalCache: jest.fn().mockResolvedValue(true),
      fetchMixData: jest.fn().mockResolvedValue(null),
    });
    const track = makeTrack();

    await downloader.downloadAll([track]);

    expect(statuses.get(track.id)).toMatchObject({ downloadState: 'done', hasMixInfo: false });
  });
});
