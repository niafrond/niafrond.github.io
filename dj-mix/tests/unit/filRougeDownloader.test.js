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
    onMixInfoProgress: jest.fn(),
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

    expect(mocks.prefetchTrackToLocalCache).toHaveBeenCalledWith(track, expect.any(Object));
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

// ── SPEC-3.5.6 : downloadAll — pistes déjà done sans mix info ────────────────

describe('downloadAll — done tracks missing mix info (SPEC-3.5.6)', () => {
  test('fetches mix data for a track already done but without hasMixInfo', async () => {
    const { downloader, mocks, statuses } = makeDownloader({
      isTrackInLocalCache: jest.fn().mockResolvedValue(true),
    });
    const track = makeTrack();
    statuses.set(track.id, { downloadState: 'done', hasMixInfo: false });

    await downloader.downloadAll([track]);

    expect(mocks.prefetchTrackToLocalCache).not.toHaveBeenCalled();
    expect(mocks.fetchMixData).toHaveBeenCalledWith(track.name, track.artist);
    expect(statuses.get(track.id)).toMatchObject({ downloadState: 'done', hasMixInfo: true });
  });

  test('skips track already done with hasMixInfo=true', async () => {
    const { downloader, mocks, statuses } = makeDownloader();
    const track = makeTrack();
    statuses.set(track.id, { downloadState: 'done', hasMixInfo: true });

    await downloader.downloadAll([track]);

    expect(mocks.prefetchTrackToLocalCache).not.toHaveBeenCalled();
    expect(mocks.fetchMixData).not.toHaveBeenCalled();
    expect(mocks.showToast).toHaveBeenCalledWith('Tous les morceaux sont déjà téléchargés');
  });

  test('sets hasMixInfo=false for done-without-mix-info track when fetchMixData returns null', async () => {
    const { downloader, mocks, statuses } = makeDownloader({
      isTrackInLocalCache: jest.fn().mockResolvedValue(true),
      fetchMixData: jest.fn().mockResolvedValue(null),
    });
    const track = makeTrack();
    statuses.set(track.id, { downloadState: 'done', hasMixInfo: false });

    await downloader.downloadAll([track]);

    expect(statuses.get(track.id)).toMatchObject({ downloadState: 'done', hasMixInfo: false });
  });
});

// ── SPEC-3.5.7 : downloadMissingMixInfo — bouton dédié ────────────────────────

describe('downloadMissingMixInfo — SPEC-3.5.7', () => {
  test('fetches mix data for done tracks missing it and reports progress', async () => {
    const { downloader, mocks, statuses } = makeDownloader();
    const track = makeTrack();
    statuses.set(track.id, { downloadState: 'done', hasMixInfo: false });

    await downloader.downloadMissingMixInfo([track]);

    expect(mocks.prefetchTrackToLocalCache).not.toHaveBeenCalled();
    expect(mocks.fetchMixData).toHaveBeenCalledWith(track.name, track.artist);
    expect(statuses.get(track.id)).toMatchObject({ hasMixInfo: true });
    expect(mocks.onMixInfoProgress).toHaveBeenCalledWith(0, 1);
    expect(mocks.onMixInfoProgress).toHaveBeenCalledWith(1, 1);
    expect(mocks.onMixInfoProgress).toHaveBeenLastCalledWith(0, 0);
    expect(mocks.showToast).toHaveBeenCalledWith('Mix info mis à jour (1 morceau)');
  });

  test('ignores tracks that are not downloaded yet', async () => {
    const { downloader, mocks } = makeDownloader();
    const track = makeTrack();
    // downloadState defaults to 'idle' — never downloaded.

    await downloader.downloadMissingMixInfo([track]);

    expect(mocks.fetchMixData).not.toHaveBeenCalled();
    expect(mocks.showToast).toHaveBeenCalledWith('Aucune mix info manquante');
  });

  test('ignores tracks that already have mix info', async () => {
    const { downloader, mocks, statuses } = makeDownloader();
    const track = makeTrack();
    statuses.set(track.id, { downloadState: 'done', hasMixInfo: true });

    await downloader.downloadMissingMixInfo([track]);

    expect(mocks.fetchMixData).not.toHaveBeenCalled();
    expect(mocks.showToast).toHaveBeenCalledWith('Aucune mix info manquante');
  });

  test('reports failures in the summary toast without breaking the batch', async () => {
    const ok = makeTrack({ id: 'track-ok', name: 'Song OK', artist: 'Artist OK' });
    const bad = makeTrack({ id: 'track-bad', name: 'Song Bad', artist: 'Artist Bad' });
    const { downloader, mocks, statuses } = makeDownloader({
      fetchMixData: jest.fn((name) => (
        name === 'Song OK' ? Promise.resolve({ probableSongStartSec: 1 }) : Promise.reject(new Error('boom'))
      )),
    });
    statuses.set(ok.id, { downloadState: 'done', hasMixInfo: false });
    statuses.set(bad.id, { downloadState: 'done', hasMixInfo: false });

    await downloader.downloadMissingMixInfo([ok, bad]);

    expect(statuses.get(ok.id)).toMatchObject({ hasMixInfo: true });
    expect(statuses.get(bad.id)).toMatchObject({ hasMixInfo: false });
    expect(mocks.showToast).toHaveBeenCalledWith('Mix info mis à jour (1/2), 1 échec');
  });

  test('shows an error toast and does nothing when fetchMixData is unavailable', async () => {
    const { downloader, mocks } = makeDownloader({ fetchMixData: undefined });
    const track = makeTrack();

    await downloader.downloadMissingMixInfo([track]);

    expect(mocks.showToast).toHaveBeenCalledWith('Mix info indisponible', true);
  });

  test('runs to completion even while downloadAll is still downloading other tracks', async () => {
    let resolvePrefetch;
    let downloadAllSettled = false;
    const downloading = makeTrack({ id: 'track-downloading', name: 'Song Downloading', artist: 'Artist D' });
    const doneMissingInfo = makeTrack({ id: 'track-done', name: 'Song Done', artist: 'Artist E' });
    const { downloader, mocks, statuses } = makeDownloader({
      prefetchTrackToLocalCache: jest.fn(() => new Promise((resolve) => { resolvePrefetch = resolve; })),
    });
    statuses.set(doneMissingInfo.id, { downloadState: 'done', hasMixInfo: false });

    const downloadAllPromise = downloader.downloadAll([downloading]).then((r) => { downloadAllSettled = true; return r; });
    // Let downloadAll progress until it's blocked on prefetchTrackToLocalCache.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(resolvePrefetch).toEqual(expect.any(Function));

    await downloader.downloadMissingMixInfo([doneMissingInfo]);

    expect(statuses.get(doneMissingInfo.id)).toMatchObject({ hasMixInfo: true });
    expect(downloadAllSettled).toBe(false);

    resolvePrefetch(true);
    await downloadAllPromise;
    expect(downloadAllSettled).toBe(true);
    expect(mocks.prefetchTrackToLocalCache).toHaveBeenCalledWith(downloading, expect.any(Object));
  });
});
