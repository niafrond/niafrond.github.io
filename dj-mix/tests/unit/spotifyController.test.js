import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { createSpotifyController } from '../../lib/spotifyController.js';

const SPOTIFY_SOURCE_KEY = 'dj-mix:spotify:fil-rouge-source';

function makeFilRougeManager(playlist = []) {
  const _playlist = [...playlist];
  return {
    getPlaylist: () => [..._playlist],
    setPlaylist: jest.fn((p) => { _playlist.length = 0; _playlist.push(...p); }),
    addToPlaylist: jest.fn(),
    clearPlaylist: jest.fn(),
    clearPriorityQueue: jest.fn(),
    isLoopEnabled: () => false,
  };
}

function makeSpotifyClient(overrides = {}) {
  return {
    isConnected: jest.fn().mockReturnValue(false),
    getStoredClientId: jest.fn().mockReturnValue(''),
    parseSpotifyPlaylistId: jest.fn((val) => val || null),
    fetchPlaylistSnapshot: jest.fn().mockResolvedValue({ snapshot_id: 'snap1', name: 'Test' }),
    fetchPlaylistTracks: jest.fn().mockResolvedValue({ tracks: [], fingerprint: 'fp' }),
    fetchUserPlaylists: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function makeController(overrides = {}) {
  const filRougeManager = overrides.filRougeManager || makeFilRougeManager();
  const spotifyClient = overrides.spotifyClient || makeSpotifyClient();

  return createSpotifyController({
    spotifyClient,
    filRougeManager,
    setFilRougeTrackStatus: jest.fn(),
    hasStemsForTrack: jest.fn().mockReturnValue(false),
    renderFilRouge: jest.fn(),
    runDjPlanFullPass: jest.fn().mockResolvedValue(undefined),
    runDjPlanIncrementalPass: jest.fn().mockResolvedValue(undefined),
    prefetchTrackToLocalCache: jest.fn().mockResolvedValue(true),
    autoModeManager: { fetchMixData: jest.fn().mockResolvedValue(undefined) },
    showToast: jest.fn(),
    logWarn: jest.fn(),
    spotifyStatus: null,
    spotifyConnectionBadge: null,
    spotifyClientIdInput: null,
    spotifyPlaylistInput: null,
    spotifyConnectBtn: null,
    spotifyDisconnectBtn: null,
    spotifyImportFilRougeBtn: null,
    spotifyPlaylistSelect: null,
    txtPlaylistStatus: null,
    ...overrides,
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe('parseTxtPlaylist', () => {
  test('parses "artiste - titre" format', () => {
    const ctrl = makeController();
    const tracks = ctrl.parseTxtPlaylist('Daft Punk - Get Lucky');
    expect(tracks).toHaveLength(1);
    expect(tracks[0].name).toBe('Get Lucky');
    expect(tracks[0].artist).toBe('Daft Punk');
  });

  test('handles em-dash separator', () => {
    const ctrl = makeController();
    const tracks = ctrl.parseTxtPlaylist('Artiste — Titre');
    expect(tracks[0].artist).toBe('Artiste');
    expect(tracks[0].name).toBe('Titre');
  });

  test('handles en-dash separator', () => {
    const ctrl = makeController();
    const tracks = ctrl.parseTxtPlaylist('Artiste – Titre');
    expect(tracks[0].artist).toBe('Artiste');
    expect(tracks[0].name).toBe('Titre');
  });

  test('skips blank lines', () => {
    const ctrl = makeController();
    const tracks = ctrl.parseTxtPlaylist('\n\nArtiste - Titre\n\n');
    expect(tracks).toHaveLength(1);
  });

  test('skips lines starting with #', () => {
    const ctrl = makeController();
    const tracks = ctrl.parseTxtPlaylist('# comment\nArtiste - Titre');
    expect(tracks).toHaveLength(1);
    expect(tracks[0].name).toBe('Titre');
  });

  test('line without separator uses full line as title with unknown artist', () => {
    const ctrl = makeController();
    const tracks = ctrl.parseTxtPlaylist('Titre sans artiste');
    expect(tracks[0].name).toBe('Titre sans artiste');
    expect(tracks[0].artist).toBe('Artiste inconnu');
  });

  test('assigns source = "txt"', () => {
    const ctrl = makeController();
    const tracks = ctrl.parseTxtPlaylist('A - B');
    expect(tracks[0].source).toBe('txt');
  });

  test('strips leading "1. " line number', () => {
    const ctrl = makeController();
    const tracks = ctrl.parseTxtPlaylist('1. Daft Punk - Get Lucky');
    expect(tracks[0].artist).toBe('Daft Punk');
    expect(tracks[0].name).toBe('Get Lucky');
  });

  test('strips leading "1- " line number', () => {
    const ctrl = makeController();
    const tracks = ctrl.parseTxtPlaylist('2- Michael Jackson - Thriller');
    expect(tracks[0].artist).toBe('Michael Jackson');
    expect(tracks[0].name).toBe('Thriller');
  });

  test('strips leading bare number + space', () => {
    const ctrl = makeController();
    const tracks = ctrl.parseTxtPlaylist('3 Kavinsky - Nightcall');
    expect(tracks[0].artist).toBe('Kavinsky');
    expect(tracks[0].name).toBe('Nightcall');
  });

  test('strips leading "42) " line number', () => {
    const ctrl = makeController();
    const tracks = ctrl.parseTxtPlaylist('42) Artiste - Titre');
    expect(tracks[0].artist).toBe('Artiste');
    expect(tracks[0].name).toBe('Titre');
  });

  test('does not strip non-numbered lines', () => {
    const ctrl = makeController();
    const tracks = ctrl.parseTxtPlaylist('Daft Punk - Around The World');
    expect(tracks[0].artist).toBe('Daft Punk');
    expect(tracks[0].name).toBe('Around The World');
  });
});

describe('addSpotifyDeletedId', () => {
  test('persists deleted id to spotifyFilRougeSource', () => {
    const ctrl = makeController();
    // Setup source first
    localStorage.setItem(SPOTIFY_SOURCE_KEY, JSON.stringify({
      playlistId: 'pl1',
      deletedIds: [],
    }));
    ctrl.addSpotifyDeletedId('track-123');
    const saved = JSON.parse(localStorage.getItem(SPOTIFY_SOURCE_KEY));
    expect(saved.deletedIds).toContain('track-123');
  });

  test('no-ops when no playlistId in source', () => {
    const ctrl = makeController();
    ctrl.addSpotifyDeletedId('track-abc');
    expect(localStorage.getItem('spotifyFilRougeSource')).toBe(null);
  });

  test('no-ops when trackId is null', () => {
    const ctrl = makeController();
    ctrl.addSpotifyDeletedId(null);
    expect(localStorage.getItem('spotifyFilRougeSource')).toBe(null);
  });
});

describe('mergeSpotifyTracksToFilRouge', () => {
  test('tombstoned ids are skipped', () => {
    localStorage.setItem(SPOTIFY_SOURCE_KEY, JSON.stringify({
      playlistId: 'pl1',
      deletedIds: ['track-1'],
    }));
    const fr = makeFilRougeManager([]);
    const ctrl = makeController({ filRougeManager: fr });
    ctrl.mergeSpotifyTracksToFilRouge([{ id: 'track-1', name: 'T1' }]);
    expect(fr.setPlaylist).toHaveBeenCalledWith([]);
  });

  test('existing items are preserved as-is', () => {
    const existingItem = { id: 'track-2', name: 'T2', cachePath: '/music/t2.mp3' };
    const fr = makeFilRougeManager([existingItem]);
    const ctrl = makeController({ filRougeManager: fr });
    ctrl.mergeSpotifyTracksToFilRouge([{ id: 'track-2', name: 'T2-updated' }]);
    const merged = fr.setPlaylist.mock.calls[0][0];
    const t2 = merged.find((i) => i.id === 'track-2');
    expect(t2.cachePath).toBe('/music/t2.mp3');
    expect(t2.name).toBe('T2');
  });

  test('new items are appended', () => {
    const fr = makeFilRougeManager([]);
    const ctrl = makeController({ filRougeManager: fr });
    const { added } = ctrl.mergeSpotifyTracksToFilRouge([{ id: 'new-1', name: 'New Track' }]);
    expect(added).toBe(1);
  });
});

describe('syncSpotifyFilRougeIfChanged', () => {
  test('returns false when snapshotId is unchanged', async () => {
    localStorage.setItem(SPOTIFY_SOURCE_KEY, JSON.stringify({
      playlistId: 'pl1',
      snapshotId: 'snap1',
    }));
    const spotifyClient = makeSpotifyClient({
      fetchPlaylistSnapshot: jest.fn().mockResolvedValue({ snapshot_id: 'snap1' }),
    });
    const ctrl = makeController({ spotifyClient });
    const result = await ctrl.syncSpotifyFilRougeIfChanged({ silent: true });
    expect(result).toBe(false);
  });

  test('sets inFlight=false in finally block on error', async () => {
    localStorage.setItem(SPOTIFY_SOURCE_KEY, JSON.stringify({
      playlistId: 'pl1',
      snapshotId: 'old',
    }));
    const spotifyClient = makeSpotifyClient({
      fetchPlaylistSnapshot: jest.fn().mockResolvedValue({ snapshot_id: 'new' }),
      fetchPlaylistTracks: jest.fn().mockRejectedValue(new Error('network error')),
    });
    const ctrl = makeController({ spotifyClient });
    await expect(ctrl.syncSpotifyFilRougeIfChanged({ silent: true })).rejects.toThrow();
    // After throwing, a second call should not be blocked by inFlight
    spotifyClient.fetchPlaylistSnapshot.mockResolvedValue({ snapshot_id: 'old' });
    // Re-set snapshotId to match so it returns false cleanly
    localStorage.setItem(SPOTIFY_SOURCE_KEY, JSON.stringify({
      playlistId: 'pl1',
      snapshotId: 'old',
    }));
    const result2 = await ctrl.syncSpotifyFilRougeIfChanged({ silent: true });
    expect(result2).toBe(false);
  });

  test('returns false when no playlistId', async () => {
    const ctrl = makeController();
    const result = await ctrl.syncSpotifyFilRougeIfChanged();
    expect(result).toBe(false);
  });
});

describe('readSpotifyFilRougeSource / writeSpotifyFilRougeSource', () => {
  test('roundtrip write and read', () => {
    const ctrl = makeController();
    ctrl.writeSpotifyFilRougeSource({ playlistId: 'abc', snapshotId: 's1' });
    const result = ctrl.readSpotifyFilRougeSource();
    expect(result.playlistId).toBe('abc');
    expect(result.snapshotId).toBe('s1');
  });

  test('write null removes storage key', () => {
    const ctrl = makeController();
    ctrl.writeSpotifyFilRougeSource({ playlistId: 'abc' });
    ctrl.writeSpotifyFilRougeSource(null);
    expect(ctrl.readSpotifyFilRougeSource()).toBe(null);
  });

  test('returns null when storage is empty', () => {
    const ctrl = makeController();
    expect(ctrl.readSpotifyFilRougeSource()).toBe(null);
  });
});
