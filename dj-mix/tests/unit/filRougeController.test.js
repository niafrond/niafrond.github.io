import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { createFilRougeController } from '../../lib/filRougeController.js';
import { uiState } from '../../lib/uiState.js';

function makeFilRougeManager(playlist = [], priorityQueue = []) {
  const _pl = [...playlist];
  const _pq = [...priorityQueue];
  return {
    getPlaylist: jest.fn(() => [..._pl]),
    getPriorityQueue: jest.fn(() => [..._pq]),
    getCurrentIndex: jest.fn(() => 0),
    addToPlaylist: jest.fn((item) => {
      const exists = _pl.some((p) => p.id === item.id);
      if (!exists) _pl.push(item);
      return !exists;
    }),
    removeFromPlaylist: jest.fn((idx) => _pl.splice(idx, 1)),
    removeFromPriorityQueue: jest.fn(),
    isLoopEnabled: jest.fn(() => false),
    isShuffleEnabled: jest.fn(() => false),
    isActive: jest.fn(() => true),
    jumpToIndex: jest.fn(),
    peekNextTrackFromAny: jest.fn(() => null),
  };
}

function makeDjPlanManager(overrides = {}) {
  return {
    computeSetQuality: jest.fn().mockResolvedValue(null),
    planEdgesForNewItems: jest.fn().mockResolvedValue(undefined),
    getDjTransitionPlan: jest.fn().mockReturnValue(null),
    submitFeedback: jest.fn().mockResolvedValue(true),
    setIconic: jest.fn().mockResolvedValue(true),
    getSetProfiles: jest.fn().mockResolvedValue({ profiles: [] }),
    getSelectedSetProfile: jest.fn().mockReturnValue('club_peak'),
    setSelectedSetProfile: jest.fn(),
    ...overrides,
  };
}

function makeController(overrides = {}) {
  const filRougeManager = overrides.filRougeManager || makeFilRougeManager();
  const djPlanManager = overrides.djPlanManager || makeDjPlanManager();
  return createFilRougeController({
    filRougeManager,
    djPlanManager,
    getDjExternalPlanEnabled: jest.fn().mockReturnValue(false),
    fetchMissingMeta: jest.fn().mockResolvedValue(undefined),
    addToQueue: jest.fn().mockResolvedValue(undefined),
    addSpotifyDeletedId: jest.fn(),
    showToast: jest.fn(),
    logWarn: jest.fn(),
    ...overrides,
  });
}

beforeEach(() => {
  uiState.currentTrackId = null;
  uiState.currentIndex = -1;
});

// ── hasStemsForTrack ──────────────────────────────────────────────────────────

describe('hasStemsForTrack', () => {
  test('returns false for item with no stems', () => {
    const ctrl = makeController();
    expect(ctrl.hasStemsForTrack({ name: 'T' })).toBe(false);
  });

  test('returns true when localStemUrls.vocalsUrl present', () => {
    const ctrl = makeController();
    expect(ctrl.hasStemsForTrack({ localStemUrls: { vocalsUrl: 'url' } })).toBe(true);
  });

  test('returns true when stems.instrumentalUrl present', () => {
    const ctrl = makeController();
    expect(ctrl.hasStemsForTrack({ stems: { instrumentalUrl: 'url' } })).toBe(true);
  });

  test('returns false for null item', () => {
    const ctrl = makeController();
    expect(ctrl.hasStemsForTrack(null)).toBe(false);
  });
});

// ── getFilRougeTrackStatus ────────────────────────────────────────────────────

describe('getFilRougeTrackStatus', () => {
  test('infers downloadState="done" from cachePath', () => {
    const ctrl = makeController();
    const status = ctrl.getFilRougeTrackStatus({ id: '1', cachePath: '/music/t.mp3' });
    expect(status.downloadState).toBe('done');
  });

  test('infers downloadState="done" from persistedSourceUrl', () => {
    const ctrl = makeController();
    const status = ctrl.getFilRougeTrackStatus({ id: '1', persistedSourceUrl: 'http://cdn/t.mp3' });
    expect(status.downloadState).toBe('done');
  });

  test('defaults to "idle" when no cachePath or persistedSourceUrl', () => {
    const ctrl = makeController();
    const status = ctrl.getFilRougeTrackStatus({ id: '1', name: 'T' });
    expect(status.downloadState).toBe('idle');
  });

  test('returns hasMixInfo=false by default', () => {
    const ctrl = makeController();
    const item = { id: '1', name: 'T' };
    const status = ctrl.getFilRougeTrackStatus(item);
    expect(status.hasMixInfo).toBe(false);
  });

  test('returns hasMixInfo=true when set via status', () => {
    const ctrl = makeController();
    const item = { id: '1', name: 'T' };
    ctrl.setFilRougeTrackStatus(item, { hasMixInfo: true });
    const status = ctrl.getFilRougeTrackStatus(item);
    expect(status.hasMixInfo).toBe(true);
  });

  test('reflects setFilRougeTrackStatus patch', () => {
    const ctrl = makeController();
    const item = { id: 'abc', name: 'T' };
    ctrl.setFilRougeTrackStatus(item, { downloadState: 'downloading' });
    const status = ctrl.getFilRougeTrackStatus(item);
    expect(status.downloadState).toBe('downloading');
  });
});

// ── setFilRougeTrackStatus ────────────────────────────────────────────────────

describe('setFilRougeTrackStatus', () => {
  test('merges patch without overwriting other fields', () => {
    const ctrl = makeController();
    const item = { id: 'x', name: 'T' };
    ctrl.setFilRougeTrackStatus(item, { downloadState: 'done', hasMixInfo: false });
    ctrl.setFilRougeTrackStatus(item, { hasMixInfo: true });
    const status = ctrl.getFilRougeTrackStatus(item);
    expect(status.downloadState).toBe('done');
    expect(status.hasMixInfo).toBe(true);
  });

  test('no-ops for item with no resolvable key', () => {
    const ctrl = makeController();
    // No id, no cachePath, no artist/name → empty key
    ctrl.setFilRougeTrackStatus({}, { downloadState: 'done' });
    // Should not throw
  });
});

// ── addToFilRouge ─────────────────────────────────────────────────────────────

describe('addToFilRouge', () => {
  test('normalizes fields from raw item', () => {
    const fr = makeFilRougeManager();
    const ctrl = makeController({ filRougeManager: fr });
    ctrl.addToFilRouge({ id: '1', trackName: 'Title', artistName: 'Artist', cachePath: '/t.mp3' });
    const added = fr.addToPlaylist.mock.calls[0][0];
    expect(added.name).toBe('Title');
    expect(added.artist).toBe('Artist');
    expect(added.cachePath).toBe('/t.mp3');
  });

  test('shows toast on success', () => {
    const showToast = jest.fn();
    const ctrl = makeController({ showToast });
    ctrl.addToFilRouge({ id: '1', name: 'Track', artist: 'X' });
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('ajouté'));
  });

  test('shows duplicate toast when already in playlist', () => {
    const fr = makeFilRougeManager([{ id: '1', name: 'Track' }]);
    const showToast = jest.fn();
    const ctrl = makeController({ filRougeManager: fr, showToast });
    ctrl.addToFilRouge({ id: '1', name: 'Track', artist: 'X' });
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('fil rouge'), true);
  });

  test('sets downloadState=done when cachePath present', () => {
    const fr = makeFilRougeManager();
    const ctrl = makeController({ filRougeManager: fr });
    ctrl.addToFilRouge({ id: '1', name: 'T', cachePath: '/t.mp3' });
    const status = ctrl.getFilRougeTrackStatus({ id: '1', cachePath: '/t.mp3' });
    expect(status.downloadState).toBe('done');
  });

  test('hasMixInfo defaults to false on addToFilRouge', () => {
    const fr = makeFilRougeManager();
    const ctrl = makeController({ filRougeManager: fr });
    ctrl.addToFilRouge({ id: '1', name: 'T' });
    const status = ctrl.getFilRougeTrackStatus({ id: '1' });
    expect(status.hasMixInfo).toBe(false);
  });

  test('no-ops for null item', () => {
    const fr = makeFilRougeManager();
    const ctrl = makeController({ filRougeManager: fr });
    ctrl.addToFilRouge(null);
    expect(fr.addToPlaylist).not.toHaveBeenCalled();
  });
});

// ── runDjPlanFullPass ─────────────────────────────────────────────────────────

describe('runDjPlanFullPass', () => {
  test('calls computeSetQuality', async () => {
    const computeSetQuality = jest.fn().mockResolvedValue(null);
    const djPlanManager = makeDjPlanManager({ computeSetQuality });
    const ctrl = makeController({ djPlanManager });
    await ctrl.runDjPlanFullPass('test');
    expect(computeSetQuality).toHaveBeenCalled();
  });

  test('skips quality refresh when filRouge is not active', async () => {
    const fr = makeFilRougeManager();
    fr.isActive.mockReturnValue(false);
    const computeSetQuality = jest.fn();
    const djPlanManager = makeDjPlanManager({ computeSetQuality });
    const ctrl = makeController({ filRougeManager: fr, djPlanManager });
    await ctrl.runDjPlanFullPass('test');
    expect(computeSetQuality).not.toHaveBeenCalled();
  });
});

// ── runDjPlanIncrementalPass ──────────────────────────────────────────────────

describe('runDjPlanIncrementalPass', () => {
  test('calls planEdgesForNewItems', async () => {
    const planEdgesForNewItems = jest.fn().mockResolvedValue(undefined);
    const djPlanManager = makeDjPlanManager({ planEdgesForNewItems });
    const ctrl = makeController({ djPlanManager });
    await ctrl.runDjPlanIncrementalPass([{ id: '1' }], false);
    expect(planEdgesForNewItems).toHaveBeenCalledWith([{ id: '1' }], { withWrap: false });
  });

  test('logs warn and continues on planEdgesForNewItems error', async () => {
    const logWarn = jest.fn();
    const planEdgesForNewItems = jest.fn().mockRejectedValue(new Error('net'));
    const djPlanManager = makeDjPlanManager({ planEdgesForNewItems });
    const ctrl = makeController({ djPlanManager, logWarn });
    await expect(ctrl.runDjPlanIncrementalPass([], false)).resolves.toBeUndefined();
    expect(logWarn).toHaveBeenCalled();
  });
});
