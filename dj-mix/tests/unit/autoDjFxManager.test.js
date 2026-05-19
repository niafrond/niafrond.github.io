import {
  AUTO_DJ_FX_TYPES,
  canTriggerAutoDjFx,
  isAutoDjFxTypeAllowed,
  normalizeAutoDjFxSettings,
  persistAutoDjFxSettings,
  readAutoDjFxSettings,
} from '../../lib/autoDjFxManager.js';

describe('autoDjFxManager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('normalization keeps defaults for missing values', () => {
    const settings = normalizeAutoDjFxSettings({});
    expect(settings.minIntervalSec).toBeGreaterThan(0);
    expect(settings.maxIntervalSec).toBeGreaterThanOrEqual(settings.minIntervalSec);
    expect(Object.keys(settings.allowed)).toEqual(expect.arrayContaining(AUTO_DJ_FX_TYPES));
  });

  test('read/persist roundtrip settings', () => {
    const next = normalizeAutoDjFxSettings({
      allowed: { echoDelay: false },
      minIntervalSec: 5,
      maxIntervalSec: 12,
    });
    persistAutoDjFxSettings(next);
    const restored = readAutoDjFxSettings();
    expect(restored.minIntervalSec).toBe(5);
    expect(restored.maxIntervalSec).toBe(12);
    expect(restored.allowed.echoDelay).toBe(false);
    expect(isAutoDjFxTypeAllowed(restored, 'echoDelay')).toBe(false);
  });

  test('canTriggerAutoDjFx enforces min interval', () => {
    const settings = normalizeAutoDjFxSettings({ minIntervalSec: 10, maxIntervalSec: 20 });
    const first = canTriggerAutoDjFx({ type: 'echoDelay' }, settings, 0, 1000);
    expect(first.allowed).toBe(true);

    const second = canTriggerAutoDjFx({ type: 'echoDelay' }, settings, 1000, 1500);
    expect(second.allowed).toBe(false);
    expect(second.reason).toBe('min-interval');
  });

  test('canTriggerAutoDjFx returns disabled when global auto fx is off', () => {
    const settings = normalizeAutoDjFxSettings({ enabled: false });
    const result = canTriggerAutoDjFx({ type: 'echoDelay' }, settings, 0, 2000);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('disabled');
  });
});
