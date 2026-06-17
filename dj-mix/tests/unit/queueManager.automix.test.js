import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { createSettingsController } from '../../lib/settingsController.js';
import { shouldTriggerAutomix } from '../../lib/automixTimeline.js';
import { uiState } from '../../lib/uiState.js';

// ── shouldTriggerAutomix threshold tests ──────────────────────────────────────

describe('shouldTriggerAutomix', () => {
  test('returns false when nextTriggerMs is 0', () => {
    const timeline = { nextTriggerMs: 0, triggeredForTrack: false };
    expect(shouldTriggerAutomix(timeline, 5000)).toBe(false);
  });

  test('returns false when position is below trigger threshold', () => {
    const timeline = { nextTriggerMs: 10_000, triggeredForTrack: false };
    expect(shouldTriggerAutomix(timeline, 9000)).toBe(false);
  });

  test('returns true when position reaches nextTriggerMs', () => {
    const timeline = { nextTriggerMs: 10_000, triggeredForTrack: false };
    expect(shouldTriggerAutomix(timeline, 10_000)).toBe(true);
  });

  test('returns true when position exceeds nextTriggerMs', () => {
    const timeline = { nextTriggerMs: 10_000, triggeredForTrack: false };
    expect(shouldTriggerAutomix(timeline, 15_000)).toBe(true);
  });

  test('returns false when already triggered for track', () => {
    const timeline = { nextTriggerMs: 10_000, triggeredForTrack: true };
    expect(shouldTriggerAutomix(timeline, 15_000)).toBe(false);
  });
});

// ── recalculateAutomixTimingIfNeeded ──────────────────────────────────────────

function makeSettingsController(overrides = {}) {
  return createSettingsController({
    initialTransitionMode: 'auto',
    initialRamFilterEnabled: false,
    initialRamTotalMbOverride: 0,
    initialTrackMaxDurationSec: 0,
    initialTrackMaxDurationEnabled: false,
    initialTrackMaxDurationMode: 'sec',
    initialTrackMaxDurationPct: 50,
    initialAutoSuggestionQueueSearchEnabled: true,
    initialQueueLoopEnabled: false,
    initialQueueShuffleEnabled: false,
    clampCrossfadeSeconds: jest.fn((v) => Math.max(1, Math.min(30, Number(v) || 6))),
    getCrossfadeSeconds: jest.fn().mockReturnValue(6),
    getPlayer: jest.fn().mockReturnValue(null),
    getQueue: jest.fn().mockReturnValue([]),
    autoModeManager: {
      isAutoModeEnabled: jest.fn().mockReturnValue(false),
      scheduleAutomixTiming: jest.fn(),
      setSuggestionSearchEnabled: jest.fn(),
    },
    getAutoDjFxSettings: jest.fn().mockReturnValue({ minIntervalSec: 20, maxIntervalSec: 60 }),
    setDebugLogging: jest.fn(),
    updateDjFxMenuUI: jest.fn(),
    updateMaxDurationMarker: jest.fn(),
    updateSuggestionRefreshButtons: jest.fn(),
    trimRetainedAudioSources: jest.fn(),
    showToast: jest.fn(),
    logInfo: jest.fn(),
    logDebug: jest.fn(),
    logWarn: jest.fn(),
    ...overrides,
  });
}

describe('recalculateAutomixTimingIfNeeded', () => {
  beforeEach(() => {
    uiState.currentIndex = -1;
    uiState.queue = [];
  });

  test('no-ops when autoMode is disabled', () => {
    const scheduleAutomixTiming = jest.fn();
    const ctrl = makeSettingsController({
      autoModeManager: {
        isAutoModeEnabled: jest.fn().mockReturnValue(false),
        scheduleAutomixTiming,
        setSuggestionSearchEnabled: jest.fn(),
      },
    });
    uiState.currentIndex = 0;
    uiState.queue = [{ id: 'x', name: 'T' }];
    ctrl.recalculateAutomixTimingIfNeeded();
    expect(scheduleAutomixTiming).not.toHaveBeenCalled();
  });

  test('no-ops when currentIndex is -1', () => {
    const scheduleAutomixTiming = jest.fn();
    const ctrl = makeSettingsController({
      autoModeManager: {
        isAutoModeEnabled: jest.fn().mockReturnValue(true),
        scheduleAutomixTiming,
        setSuggestionSearchEnabled: jest.fn(),
      },
    });
    uiState.currentIndex = -1;
    ctrl.recalculateAutomixTimingIfNeeded();
    expect(scheduleAutomixTiming).not.toHaveBeenCalled();
  });

  test('calls scheduleAutomixTiming when auto mode is on and track is playing', () => {
    const scheduleAutomixTiming = jest.fn();
    const track = { id: 'x', name: 'T' };
    const ctrl = makeSettingsController({
      autoModeManager: {
        isAutoModeEnabled: jest.fn().mockReturnValue(true),
        scheduleAutomixTiming,
        setSuggestionSearchEnabled: jest.fn(),
      },
      getQueue: jest.fn().mockReturnValue([track]),
    });
    uiState.currentIndex = 0;
    ctrl.recalculateAutomixTimingIfNeeded();
    expect(scheduleAutomixTiming).toHaveBeenCalledWith(track);
  });
});

// ── trackMaxDuration: sec and pct modes ────────────────────────────────────────

describe('trackMaxDuration modes', () => {
  test('sec mode: applyTrackMaxDurationSetting sets applied sec immediately', () => {
    const ctrl = makeSettingsController({ initialTrackMaxDurationMode: 'sec' });
    ctrl.applyTrackMaxDurationSetting(120);
    // getTrackMaxDurationAppliedSec is 0 when trackMaxDurationEnabled is false
    expect(ctrl.getTrackMaxDurationSec()).toBe(120);
  });

  test('pct mode: computePctMaxDurationSec respects percentage', () => {
    const ctrl = makeSettingsController({
      initialTrackMaxDurationMode: 'pct',
      initialTrackMaxDurationPct: 50,
    });
    // 300s track, no intro/outro → 50% = 150s
    expect(ctrl.computePctMaxDurationSec(null, 300_000)).toBe(150);
  });

  test('pct mode: 100% uses full effective duration', () => {
    const ctrl = makeSettingsController({ initialTrackMaxDurationPct: 100 });
    const mixData = { probableSongStartSec: 10, outroZones: [{ startSec: 280 }] };
    // effectiveDuration = 280 - 10 = 270; result = 10 + 270 = 280
    expect(ctrl.computePctMaxDurationSec(mixData, 300_000)).toBe(280);
  });

  test('pct mode: clamps minimum to 5', () => {
    const ctrl = makeSettingsController();
    ctrl.applyTrackMaxDurationPctSetting(1);
    expect(ctrl.getTrackMaxDurationPct()).toBe(5);
  });

  test('pct mode: clamps maximum to 95', () => {
    const ctrl = makeSettingsController();
    ctrl.applyTrackMaxDurationPctSetting(99);
    expect(ctrl.getTrackMaxDurationPct()).toBe(95);
  });
});
