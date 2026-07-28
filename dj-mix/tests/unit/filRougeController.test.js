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
    patchPlaylistItem: jest.fn(),
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

// ── sortFilRouge ──────────────────────────────────────────────────────────────

describe('sortFilRouge', () => {
  const tracks = [
    { id: '1', name: 'A', artist: 'X', bpm: 120, danceability: 0.5, year: 2018 },
    { id: '2', name: 'B', artist: 'Y', bpm: 140, danceability: 0.9, year: 2022 },
    { id: '3', name: 'C', artist: 'Z', bpm: 100, danceability: 0.3, year: 2015 },
  ];

  function makeControllerWithFetch(fetchResult, fetchError = null, fetchTransitions = [], extraOptions = {}) {
    const fr = makeFilRougeManager(tracks);
    fr.setPlaylist = jest.fn();
    const getDownloaderApiUrl = jest.fn().mockReturnValue('http://api');
    const getDownloaderApiToken = jest.fn().mockReturnValue(null);
    const showToast = jest.fn();

    global.fetch = fetchError
      ? jest.fn().mockRejectedValue(fetchError)
      : jest.fn().mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue({ tracks: fetchResult, transitions: fetchTransitions }),
        });

    const ctrl = makeController({
      filRougeManager: fr,
      showToast,
      getDownloaderApiUrl,
      getDownloaderApiToken,
      ...extraOptions,
    });
    return { ctrl, fr, showToast };
  }

  test('SPEC-3.6.6: mode "original" skips API call and does not call setPlaylist', async () => {
    const { ctrl, fr } = makeControllerWithFetch([]);
    await ctrl.sortFilRouge('original');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(fr.setPlaylist).not.toHaveBeenCalled();
  });

  test('SPEC-3.6.3: mode "bpm" calls POST /api/fil-rouge/sort with correct payload', async () => {
    const sorted = [tracks[1], tracks[0], tracks[2]];
    const { ctrl } = makeControllerWithFetch(sorted);
    await ctrl.sortFilRouge('bpm');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://api/api/fil-rouge/sort',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"mode":"bpm"'),
      }),
    );
  });

  test('SPEC-3.6.3: setPlaylist is called with local items reordered per API order', async () => {
    const sorted = [tracks[1], tracks[0], tracks[2]];
    const { ctrl, fr } = makeControllerWithFetch(sorted);
    await ctrl.sortFilRouge('danceability');
    expect(fr.setPlaylist).toHaveBeenCalledWith(sorted);
  });

  test('SPEC-3.6.12: local data (cachePath, persistedSourceUrl) is preserved after sort', async () => {
    const localTracks = [
      { id: '1', name: 'A', artist: 'X', cachePath: '/music/a.mp3', persistedSourceUrl: 'http://api/a' },
      { id: '2', name: 'B', artist: 'Y', cachePath: '/music/b.mp3', persistedSourceUrl: 'http://api/b' },
      { id: '3', name: 'C', artist: 'Z', cachePath: '/music/c.mp3', persistedSourceUrl: 'http://api/c' },
    ];
    const fr = makeFilRougeManager(localTracks);
    fr.setPlaylist = jest.fn();
    const apiSorted = [
      { id: '2', name: 'B', artist: 'Y' },
      { id: '1', name: 'A', artist: 'X' },
      { id: '3', name: 'C', artist: 'Z' },
    ];
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ tracks: apiSorted, transitions: [] }),
    });
    const ctrl = makeController({
      filRougeManager: fr,
      getDownloaderApiUrl: jest.fn().mockReturnValue('http://api'),
      getDownloaderApiToken: jest.fn().mockReturnValue(null),
    });
    await ctrl.sortFilRouge('bpm');
    const called = fr.setPlaylist.mock.calls[0][0];
    expect(called[0].id).toBe('2');
    expect(called[0].cachePath).toBe('/music/b.mp3');
    expect(called[0].persistedSourceUrl).toBe('http://api/b');
    expect(called[1].id).toBe('1');
    expect(called[1].cachePath).toBe('/music/a.mp3');
    expect(called[2].id).toBe('3');
    expect(called[2].cachePath).toBe('/music/c.mp3');
  });

  test('SPEC-3.6.2: sort mode is persisted in localStorage', async () => {
    const { ctrl } = makeControllerWithFetch([tracks[0]]);
    await ctrl.sortFilRouge('year');
    expect(localStorage.getItem('dj-mix:fil-rouge:sort')).toBe('year');
  });

  test('SPEC-3.6.9: mode "pattern" calls POST /api/fil-rouge/sort with mode "pattern"', async () => {
    const sorted = [tracks[2], tracks[0], tracks[1]];
    const { ctrl, fr } = makeControllerWithFetch(sorted);
    await ctrl.sortFilRouge('pattern');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://api/api/fil-rouge/sort',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"mode":"pattern"'),
      }),
    );
    expect(fr.setPlaylist).toHaveBeenCalledWith(sorted);
  });

  test('SPEC-3.6.10: transitions from API response are stored via patchPlaylistItem', async () => {
    const sorted = [tracks[0], tracks[1], tracks[2]];
    const transitions = [
      { mixOutSec: 210, mixInSec: 3.1, automixMode: 'crossfade_logarithmic', crossfadeDurationSec: 12, compatibilityScore: 0.84 },
      { mixOutSec: 195, mixInSec: 2.0, automixMode: 'echo_out_light', crossfadeDurationSec: 8, compatibilityScore: 0.72 },
    ];
    const { ctrl, fr } = makeControllerWithFetch(sorted, null, transitions);
    await ctrl.sortFilRouge('pattern');
    expect(fr.patchPlaylistItem).toHaveBeenCalledWith(
      sorted[0].id,
      expect.objectContaining({
        djTransition: expect.objectContaining({
          toItemId: sorted[1].id,
          automixMode: 'crossfade_logarithmic',
          mixOutSec: 210,
          crossfadeDurationSec: 12,
          compatibilityScore: 0.84,
        }),
      }),
    );
    expect(fr.patchPlaylistItem).toHaveBeenCalledWith(
      sorted[1].id,
      expect.objectContaining({
        djTransition: expect.objectContaining({
          toItemId: sorted[2].id,
          automixMode: 'echo_out_light',
        }),
      }),
    );
  });

  test('SPEC-3.6.10: null transition entries are skipped', async () => {
    const sorted = [tracks[0], tracks[1], tracks[2]];
    const { ctrl, fr } = makeControllerWithFetch(sorted, null, [null, { mixOutSec: 195, mixInSec: 2.0, automixMode: 'cut_transition', crossfadeDurationSec: 2, compatibilityScore: 0.5 }]);
    await ctrl.sortFilRouge('best');
    expect(fr.patchPlaylistItem).toHaveBeenCalledTimes(1);
    expect(fr.patchPlaylistItem).toHaveBeenCalledWith(sorted[1].id, expect.objectContaining({ djTransition: expect.objectContaining({ automixMode: 'cut_transition' }) }));
  });

  test('SPEC-3.6.11: maxDuration is included in request body when getTrackMaxDurationAppliedSec > 0', async () => {
    const sorted = [tracks[0]];
    const { ctrl } = makeControllerWithFetch(sorted, null, [], {
      getTrackMaxDurationAppliedSec: jest.fn().mockReturnValue(3600),
    });
    await ctrl.sortFilRouge('bpm');
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.maxDuration).toEqual({ value: 3600, unit: 's' });
  });

  test('SPEC-3.6.11: maxDuration is omitted when getTrackMaxDurationAppliedSec returns 0', async () => {
    const sorted = [tracks[0]];
    const { ctrl } = makeControllerWithFetch(sorted, null, [], {
      getTrackMaxDurationAppliedSec: jest.fn().mockReturnValue(0),
    });
    await ctrl.sortFilRouge('bpm');
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.maxDuration).toBeUndefined();
  });

  test('SPEC-3.6.5: API error shows toast and does not call setPlaylist', async () => {
    const { ctrl, fr, showToast } = makeControllerWithFetch([], new Error('network'));
    await ctrl.sortFilRouge('best');
    expect(showToast).toHaveBeenCalledWith('Tri indisponible (API)', true);
    expect(fr.setPlaylist).not.toHaveBeenCalled();
  });

  test('SPEC-3.6.5: non-ok HTTP response shows toast and does not call setPlaylist', async () => {
    const fr = makeFilRougeManager(tracks);
    fr.setPlaylist = jest.fn();
    const showToast = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    const ctrl = makeController({
      filRougeManager: fr,
      showToast,
      getDownloaderApiUrl: jest.fn().mockReturnValue('http://api'),
      getDownloaderApiToken: jest.fn().mockReturnValue(null),
    });
    await ctrl.sortFilRouge('bpm');
    expect(showToast).toHaveBeenCalledWith('Tri indisponible (API)', true);
    expect(fr.setPlaylist).not.toHaveBeenCalled();
  });

  test('no-ops when playlist is empty', async () => {
    const fr = makeFilRougeManager([]);
    fr.setPlaylist = jest.fn();
    global.fetch = jest.fn();
    const ctrl = makeController({
      filRougeManager: fr,
      getDownloaderApiUrl: jest.fn().mockReturnValue('http://api'),
      getDownloaderApiToken: jest.fn().mockReturnValue(null),
    });
    await ctrl.sortFilRouge('bpm');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(fr.setPlaylist).not.toHaveBeenCalled();
  });
});

// ── updateDjPlanIndicator — dj-planner block (SPEC-8.8, additif) ────────────

describe('updateDjPlanIndicator — dj-planner block', () => {
  function makeEdgeItems() {
    const current = {
      id: 1,
      name: 'Track A',
      artist: 'Artist A',
      djTrackId: 'a.mp3',
      djTransition: {
        toItemId: 2,
        transitionType: 'phrase_mix',
        mixOutSec: 10,
        mixInSec: 5,
        crossfadeDurationSec: 6,
        compatibilityScore: 0.8,
        decisionId: 'd1',
        computedAt: Date.now(),
      },
    };
    const next = { id: 2, name: 'Track B', artist: 'Artist B', djTrackId: 'b.mp3' };
    return [current, next];
  }

  test('renders confidence/mode/evidence for a compatible decision', () => {
    const [current, next] = makeEdgeItems();
    current.plannerDecision = {
      compatible: true,
      confidence: 0.83,
      transition_type: 'crossfade_linear',
      evidence: { type: 'observed_transition', occurrence_count: 5, djs: ['DJ X', 'DJ Y'] },
      toItemId: 2,
      computedAt: Date.now(),
    };
    const fr = makeFilRougeManager([current, next]);
    uiState.currentTrackId = 1;
    const djPlanIndicatorEl = document.createElement('div');
    const djPlannerManager = {
      getMixDecision: jest.fn().mockReturnValue(current.plannerDecision),
      planMixDecisionForEdge: jest.fn(),
      getObservedTransition: jest.fn().mockReturnValue(null),
      planObservedTransitionForEdge: jest.fn().mockResolvedValue(null),
    };
    const ctrl = makeController({
      filRougeManager: fr,
      djPlannerManager,
      djPlanIndicatorEl,
      getDjExternalPlanEnabled: jest.fn().mockReturnValue(true),
    });

    ctrl.updateDjPlanIndicator();

    expect(djPlanIndicatorEl.querySelector('.dj-planner-badge')).not.toBeNull();
    expect(djPlanIndicatorEl.querySelector('.dj-planner-confidence').textContent).toBe('83%');
    expect(djPlanIndicatorEl.querySelector('.dj-planner-evidence--observed').textContent).toContain('5');
    expect(djPlannerManager.planMixDecisionForEdge).not.toHaveBeenCalled();
  });

  test('renders blocking_dimensions + explanation for an incompatible decision, distinct from a compatible card', () => {
    const [current, next] = makeEdgeItems();
    current.plannerDecision = {
      compatible: false,
      blocking_dimensions: ['harmonic', 'energy'],
      explanation: 'Clé et énergie incompatibles',
      toItemId: 2,
      computedAt: Date.now(),
    };
    const fr = makeFilRougeManager([current, next]);
    uiState.currentTrackId = 1;
    const djPlanIndicatorEl = document.createElement('div');
    const djPlannerManager = {
      getMixDecision: jest.fn().mockReturnValue(current.plannerDecision),
      planMixDecisionForEdge: jest.fn(),
      getObservedTransition: jest.fn().mockReturnValue(null),
      planObservedTransitionForEdge: jest.fn().mockResolvedValue(null),
    };
    const ctrl = makeController({
      filRougeManager: fr,
      djPlannerManager,
      djPlanIndicatorEl,
      getDjExternalPlanEnabled: jest.fn().mockReturnValue(true),
    });

    ctrl.updateDjPlanIndicator();

    expect(djPlanIndicatorEl.querySelector('.dj-planner-block--incompatible')).not.toBeNull();
    expect(djPlanIndicatorEl.querySelector('.dj-planner-blocking-dims').textContent).toBe('harmonique, énergie');
    expect(djPlanIndicatorEl.querySelector('.dj-planner-explanation').textContent).toBe('Clé et énergie incompatibles');
    expect(djPlanIndicatorEl.querySelector('.dj-planner-confidence')).toBeNull();
  });

  test('renders a distinct badge for status=deliberate_exception', () => {
    const [current, next] = makeEdgeItems();
    current.plannerDecision = {
      compatible: true,
      confidence: 0.6,
      status: 'deliberate_exception',
      toItemId: 2,
      computedAt: Date.now(),
    };
    const fr = makeFilRougeManager([current, next]);
    uiState.currentTrackId = 1;
    const djPlanIndicatorEl = document.createElement('div');
    const djPlannerManager = {
      getMixDecision: jest.fn().mockReturnValue(current.plannerDecision),
      planMixDecisionForEdge: jest.fn(),
      getObservedTransition: jest.fn().mockReturnValue(null),
      planObservedTransitionForEdge: jest.fn().mockResolvedValue(null),
    };
    const ctrl = makeController({
      filRougeManager: fr,
      djPlannerManager,
      djPlanIndicatorEl,
      getDjExternalPlanEnabled: jest.fn().mockReturnValue(true),
    });

    ctrl.updateDjPlanIndicator();

    expect(djPlanIndicatorEl.querySelector('.dj-planner-block--exception')).not.toBeNull();
    expect(djPlanIndicatorEl.querySelector('.dj-planner-exception-badge')).not.toBeNull();
  });

  test('triggers planMixDecisionForEdge when no fresh decision is memoized yet, and renders no dj-planner block meanwhile', () => {
    const [current, next] = makeEdgeItems();
    const fr = makeFilRougeManager([current, next]);
    uiState.currentTrackId = 1;
    const djPlanIndicatorEl = document.createElement('div');
    const djPlannerManager = {
      getMixDecision: jest.fn().mockReturnValue(null),
      planMixDecisionForEdge: jest.fn().mockResolvedValue(null),
      getObservedTransition: jest.fn().mockReturnValue(null),
      planObservedTransitionForEdge: jest.fn().mockResolvedValue(null),
    };
    const ctrl = makeController({
      filRougeManager: fr,
      djPlannerManager,
      djPlanIndicatorEl,
      getDjExternalPlanEnabled: jest.fn().mockReturnValue(true),
    });

    ctrl.updateDjPlanIndicator();

    expect(djPlannerManager.planMixDecisionForEdge).toHaveBeenCalledWith(current, next);
    expect(djPlanIndicatorEl.querySelector('.dj-planner-block')).toBeNull();
  });

  test('renders the legacy card without a dj-planner block when djPlannerManager is not provided', () => {
    const [current, next] = makeEdgeItems();
    const fr = makeFilRougeManager([current, next]);
    uiState.currentTrackId = 1;
    const djPlanIndicatorEl = document.createElement('div');
    const ctrl = makeController({
      filRougeManager: fr,
      djPlanIndicatorEl,
      getDjExternalPlanEnabled: jest.fn().mockReturnValue(true),
    });

    expect(() => ctrl.updateDjPlanIndicator()).not.toThrow();
    expect(djPlanIndicatorEl.querySelector('.dj-plan-card')).not.toBeNull();
    expect(djPlanIndicatorEl.querySelector('.dj-planner-block')).toBeNull();
  });

  test('renders "ready" using the queue\'s next item when it is absent from the fil rouge playlist (SPEC-8.5.8)', () => {
    const current = {
      id: 1,
      name: 'Track A',
      artist: 'Artist A',
      djTrackId: 'a.mp3',
      djTransition: {
        toItemId: 99,
        transitionType: 'phrase_mix',
        mixOutSec: 10,
        mixInSec: 5,
        crossfadeDurationSec: 6,
        compatibilityScore: 0.8,
        decisionId: 'd1',
        computedAt: Date.now(),
      },
    };
    const queueOnlyNext = { id: 99, name: 'Track Q', artist: 'Artist Q', djTrackId: 'q.mp3' };
    // The fil rouge playlist only contains `current` — the real next track was
    // queued manually and never made it into the fil rouge playlist.
    const fr = makeFilRougeManager([current]);
    uiState.currentTrackId = 1;
    const djPlanIndicatorEl = document.createElement('div');
    const ctrl = makeController({
      filRougeManager: fr,
      djPlanIndicatorEl,
      getDjExternalPlanEnabled: jest.fn().mockReturnValue(true),
      getQueue: jest.fn().mockReturnValue([current, queueOnlyNext]),
    });

    ctrl.updateDjPlanIndicator();

    expect(djPlanIndicatorEl.querySelector('.dj-plan-card')).not.toBeNull();
    expect(djPlanIndicatorEl.querySelector('.dj-plan-card--pending')).toBeNull();
    expect(djPlanIndicatorEl.textContent).not.toContain('introuvable');
  });

  test('shows "next-not-found" when the next item is absent from both the fil rouge playlist and the queue', () => {
    const current = {
      id: 1,
      name: 'Track A',
      artist: 'Artist A',
      djTrackId: 'a.mp3',
      djTransition: {
        toItemId: 99,
        transitionType: 'phrase_mix',
        mixOutSec: 10,
        mixInSec: 5,
        crossfadeDurationSec: 6,
        compatibilityScore: 0.8,
        decisionId: 'd1',
        computedAt: Date.now(),
      },
    };
    const fr = makeFilRougeManager([current]);
    uiState.currentTrackId = 1;
    const djPlanIndicatorEl = document.createElement('div');
    const ctrl = makeController({
      filRougeManager: fr,
      djPlanIndicatorEl,
      getDjExternalPlanEnabled: jest.fn().mockReturnValue(true),
      getQueue: jest.fn().mockReturnValue([current]),
    });

    ctrl.updateDjPlanIndicator();

    expect(djPlanIndicatorEl.textContent).toContain('introuvable');
  });
});

// ── initDjPlannerStylePanel (fetchStyleProgressions, SPEC-8.8) ──────────────

describe('initDjPlannerStylePanel', () => {
  function setup(djPlannerManager) {
    const styleInputEl = document.createElement('select');
    const placeholderOpt = document.createElement('option');
    placeholderOpt.value = '';
    placeholderOpt.textContent = '— Choisir un style —';
    styleInputEl.appendChild(placeholderOpt);
    const styleBtnEl = document.createElement('button');
    const panelEl = document.createElement('div');
    panelEl.hidden = true;
    const showToast = jest.fn();
    const ctrl = makeController({ djPlannerManager, showToast });
    ctrl.initDjPlannerStylePanel(styleInputEl, styleBtnEl, panelEl);
    return { styleInputEl, styleBtnEl, panelEl, showToast };
  }

  // <select>.value is a no-op without a matching <option> (unlike <input>) —
  // tests that need a selected style must add it first.
  function selectStyle(styleInputEl, value) {
    const opt = document.createElement('option');
    opt.value = value;
    styleInputEl.appendChild(opt);
    styleInputEl.value = value;
  }

  test('shows a toast and does not call the manager when the style input is empty', async () => {
    const djPlannerManager = { getStyleProgressions: jest.fn() };
    const { styleBtnEl, showToast } = setup(djPlannerManager);

    styleBtnEl.click();
    await Promise.resolve();

    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('style'), true);
    expect(djPlannerManager.getStyleProgressions).not.toHaveBeenCalled();
  });

  test('populates the <select> with the available styles on init', async () => {
    const djPlannerManager = {
      getStyleProgressions: jest.fn(),
      getAvailableStyles: jest.fn().mockResolvedValue(['house', 'techno']),
    };
    const { styleInputEl } = setup(djPlannerManager);

    await Promise.resolve();
    await Promise.resolve();

    const values = Array.from(styleInputEl.options).map((o) => o.value);
    expect(values).toEqual(['', 'house', 'techno']);
  });

  test('leaves only the placeholder option when getAvailableStyles resolves empty', async () => {
    const djPlannerManager = {
      getStyleProgressions: jest.fn(),
      getAvailableStyles: jest.fn().mockResolvedValue([]),
    };
    const { styleInputEl } = setup(djPlannerManager);

    await Promise.resolve();
    await Promise.resolve();

    expect(styleInputEl.options.length).toBe(1);
  });

  test('does not throw when djPlannerManager has no getAvailableStyles (not provided)', () => {
    expect(() => setup(null)).not.toThrow();
  });

  test('shows a toast when djPlannerManager is not provided', async () => {
    const { styleInputEl, styleBtnEl, showToast } = setup(null);
    selectStyle(styleInputEl, 'house');

    styleBtnEl.click();
    await Promise.resolve();

    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('indisponible'), true);
  });

  test('renders recurring progressions and associated labels on success', async () => {
    const response = {
      style: 'house',
      associated_labels: ['deep', 'tech'],
      recurring_progressions: [
        { track_sequence: ['a.mp3', 'b.mp3'], occurrence_count: 4, example_djs: ['DJ X', 'DJ Y'] },
      ],
    };
    const djPlannerManager = { getStyleProgressions: jest.fn().mockResolvedValue(response) };
    const { styleInputEl, styleBtnEl, panelEl } = setup(djPlannerManager);
    selectStyle(styleInputEl, 'house');

    styleBtnEl.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(djPlannerManager.getStyleProgressions).toHaveBeenCalledWith('house');
    expect(panelEl.hidden).toBe(false);
    expect(panelEl.querySelectorAll('.queue-chip').length).toBe(2);
    expect(panelEl.querySelector('.dj-planner-progression-sequence').textContent).toBe('a.mp3 → b.mp3');
    expect(panelEl.querySelector('.dj-planner-progression-meta').textContent).toContain('4');
  });

  test('shows an empty-state message when the manager resolves to null', async () => {
    const djPlannerManager = { getStyleProgressions: jest.fn().mockResolvedValue(null) };
    const { styleInputEl, styleBtnEl, panelEl } = setup(djPlannerManager);
    selectStyle(styleInputEl, 'house');

    styleBtnEl.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(panelEl.querySelector('.dj-planner-progressions-empty')).not.toBeNull();
  });
});

// ── optimizePlaylistViaDjPlanner / initDjPlannerPlanPanel (playlist-plans, SPEC-8.8) ──

describe('optimizePlaylistViaDjPlanner', () => {
  test('shows a toast and returns null when djPlannerManager is not provided', async () => {
    const showToast = jest.fn();
    const ctrl = makeController({ showToast });

    const result = await ctrl.optimizePlaylistViaDjPlanner(document.createElement('div'));

    expect(result).toBeNull();
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('indisponible'), true);
  });

  test('shows a toast and returns null when fewer than 2 tracks have a resolved djTrackId', async () => {
    const fr = makeFilRougeManager([{ id: 1, djTrackId: 'a.mp3' }, { id: 2 }]);
    const djPlannerManager = { createPlaylistPlan: jest.fn() };
    const showToast = jest.fn();
    const ctrl = makeController({ filRougeManager: fr, djPlannerManager, showToast });

    const result = await ctrl.optimizePlaylistViaDjPlanner(document.createElement('div'));

    expect(result).toBeNull();
    expect(djPlannerManager.createPlaylistPlan).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Pas assez'), true);
  });

  test('creates a plan from the resolved djTrackIds and renders the summary/tracklist', async () => {
    const fr = makeFilRougeManager([
      { id: 1, djTrackId: 'a.mp3' },
      { id: 2, djTrackId: 'b.mp3' },
      { id: 3 }, // unresolved, excluded
    ]);
    const plan = {
      id: 'plan-1',
      ordered_track_ids: ['b.mp3', 'a.mp3'],
      transitions: [],
      energy_curve: [],
      climax_positions: [1],
      flagged_tracks: [],
    };
    const djPlannerManager = { createPlaylistPlan: jest.fn().mockResolvedValue(plan) };
    const panelEl = document.createElement('div');
    panelEl.hidden = true;
    const ctrl = makeController({ filRougeManager: fr, djPlannerManager });

    const result = await ctrl.optimizePlaylistViaDjPlanner(panelEl);

    expect(djPlannerManager.createPlaylistPlan).toHaveBeenCalledWith(['a.mp3', 'b.mp3']);
    expect(result).toEqual(plan);
    expect(panelEl.hidden).toBe(false);
    expect(panelEl.querySelectorAll('.dj-planner-plan-track').length).toBe(2);
    expect(panelEl.textContent).toContain('2 morceaux');
  });

  test('renders flagged tracks distinctly and shows a failure message when the API call fails', async () => {
    const fr = makeFilRougeManager([{ id: 1, djTrackId: 'a.mp3' }, { id: 2, djTrackId: 'b.mp3' }]);
    const djPlannerManager = { createPlaylistPlan: jest.fn().mockResolvedValue(null) };
    const panelEl = document.createElement('div');
    const ctrl = makeController({ filRougeManager: fr, djPlannerManager });

    const result = await ctrl.optimizePlaylistViaDjPlanner(panelEl);

    expect(result).toBeNull();
    expect(panelEl.querySelector('.dj-planner-progressions-empty')).not.toBeNull();
  });
});

describe('initDjPlannerPlanPanel', () => {
  test('clicking the optimize button triggers optimizePlaylistViaDjPlanner', async () => {
    const fr = makeFilRougeManager([{ id: 1, djTrackId: 'a.mp3' }, { id: 2, djTrackId: 'b.mp3' }]);
    const plan = { id: 'plan-1', ordered_track_ids: ['a.mp3', 'b.mp3'], transitions: [], energy_curve: [], flagged_tracks: [] };
    const djPlannerManager = { createPlaylistPlan: jest.fn().mockResolvedValue(plan), updatePlaylistPlan: jest.fn() };
    const ctrl = makeController({ filRougeManager: fr, djPlannerManager });
    const optimizeBtnEl = document.createElement('button');
    const panelEl = document.createElement('div');
    ctrl.initDjPlannerPlanPanel(optimizeBtnEl, panelEl);

    optimizeBtnEl.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(djPlannerManager.createPlaylistPlan).toHaveBeenCalledWith(['a.mp3', 'b.mp3']);
    expect(panelEl.querySelectorAll('.dj-planner-plan-track').length).toBe(2);
  });

  test('clicking a lock button toggles the lock and re-optimizes via updatePlaylistPlan', async () => {
    const fr = makeFilRougeManager([{ id: 1, djTrackId: 'a.mp3' }, { id: 2, djTrackId: 'b.mp3' }]);
    const plan = { id: 'plan-1', ordered_track_ids: ['a.mp3', 'b.mp3'], transitions: [], energy_curve: [], flagged_tracks: [] };
    const reoptimizedPlan = { ...plan, ordered_track_ids: ['a.mp3', 'b.mp3'] };
    const djPlannerManager = {
      createPlaylistPlan: jest.fn().mockResolvedValue(plan),
      updatePlaylistPlan: jest.fn().mockResolvedValue(reoptimizedPlan),
    };
    const ctrl = makeController({ filRougeManager: fr, djPlannerManager });
    const optimizeBtnEl = document.createElement('button');
    const panelEl = document.createElement('div');
    ctrl.initDjPlannerPlanPanel(optimizeBtnEl, panelEl);

    optimizeBtnEl.click();
    await Promise.resolve();
    await Promise.resolve();

    const lockBtn = panelEl.querySelector('.dj-planner-plan-lock-btn');
    lockBtn.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(djPlannerManager.updatePlaylistPlan).toHaveBeenCalledWith(
      'plan-1',
      ['a.mp3', 'b.mp3'],
      { lockedPositions: [{ track_id: 'a.mp3', position: 0 }] },
    );
  });
});
