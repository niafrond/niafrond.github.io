import { STORAGE_KEYS } from './storageKeys.js';

export const AUTO_DJ_FX_CONFIG = Object.freeze({
  filter: { label: 'Filter', category: 'filter' },
  lowPass: { label: 'Low-pass', category: 'filter' },
  highPass: { label: 'High-pass', category: 'filter' },
  echoDelay: { label: 'Echo / Delay', category: 'modulation' },
  reverb: { label: 'Reverb', category: 'modulation' },
  flangerPhaser: { label: 'Flanger / Phaser', category: 'modulation' },
  roll: { label: 'Roll / Loop', category: 'beat' },
  loop: { label: 'Loop', category: 'beat' },
  beatRepeat: { label: 'Beat Repeat', category: 'beat' },
  brake: { label: 'Brake / Vinyl Stop', category: 'transport' },
  backspin: { label: 'Backspin / Rewind', category: 'transport' },
  noise: { label: 'Noise FX', category: 'textural' },
  eq: { label: 'EQ', category: 'filter' },
  keyShift: { label: 'Key Shift / Harmonic', category: 'pitch' },
  scratching: { label: 'Scratching', category: 'scratch' },
  hotCues: { label: 'Hot Cues', category: 'cue' },
  sampling: { label: 'Sampling', category: 'sample' },
});

export const AUTO_DJ_FX_TYPES = Object.freeze(Object.keys(AUTO_DJ_FX_CONFIG));

export function createDefaultAutoDjFxAllowed() {
  const defaults = {};
  for (const type of AUTO_DJ_FX_TYPES) {
    // Disable hotCues and reverb by default
    defaults[type] = type !== 'hotCues' && type !== 'reverb';
  }
  return defaults;
}

export function getSafeAutoDjFxMinIntervalSec(value) {
  const numeric = Math.round(Number(value) || 0);
  return Math.max(1, Math.min(180, numeric || 14));
}

export function getSafeAutoDjFxMaxIntervalSec(value) {
  const numeric = Math.round(Number(value) || 0);
  return Math.max(3, Math.min(300, numeric || 45));
}

export function normalizeAutoDjFxIntervalSettings(minIntervalSec, maxIntervalSec) {
  const safeMin = getSafeAutoDjFxMinIntervalSec(minIntervalSec);
  const safeMaxRaw = getSafeAutoDjFxMaxIntervalSec(maxIntervalSec);
  return {
    minIntervalSec: safeMin,
    maxIntervalSec: Math.max(safeMin, safeMaxRaw),
  };
}

export function normalizeAutoDjFxSettings(raw) {
  const defaultsIntervals = normalizeAutoDjFxIntervalSettings(14, 45);
  const defaultsAllowed = createDefaultAutoDjFxAllowed();
  const allowedFromStorage = (raw && typeof raw.allowed === 'object') ? raw.allowed : {};
  const allowed = { ...defaultsAllowed };

  for (const type in allowedFromStorage) {
    if (Object.prototype.hasOwnProperty.call(allowedFromStorage, type)) {
      allowed[type] = Boolean(allowedFromStorage[type]);
    }
  }

  const intervals = normalizeAutoDjFxIntervalSettings(
    raw?.minIntervalSec,
    raw?.maxIntervalSec,
  );

  return {
    enabled: raw?.enabled !== undefined ? Boolean(raw.enabled) : true,
    allowed,
    minIntervalSec: intervals.minIntervalSec,
    maxIntervalSec: intervals.maxIntervalSec,
  };
}

export function readAutoDjFxSettings() {
  const defaults = normalizeAutoDjFxSettings(null);
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.autoDjFxSettings);
    if (!raw) return defaults;
    return normalizeAutoDjFxSettings(JSON.parse(raw));
  } catch (_) {
    return defaults;
  }
}

export function persistAutoDjFxSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEYS.autoDjFxSettings, JSON.stringify(normalizeAutoDjFxSettings(settings)));
  } catch (_) {
    // ignore storage failures
  }
}

export function isAutoDjFxTypeAllowed(settings, type) {
  if (!type) return false;
  if (!Object.prototype.hasOwnProperty.call(settings?.allowed || {}, type)) return true;
  return Boolean(settings.allowed[type]);
}

export function getAutoDjFxStatusText(settings) {
  const normalized = normalizeAutoDjFxSettings(settings);
  const allowedCount = AUTO_DJ_FX_TYPES.reduce((count, type) => {
    return count + (isAutoDjFxTypeAllowed(normalized, type) ? 1 : 0);
  }, 0);
  const globalState = normalized.enabled ? 'ON' : 'OFF';
  return `Robot FX ${globalState}: ${allowedCount}/${AUTO_DJ_FX_TYPES.length} autorises, intervalle ${normalized.minIntervalSec}s a ${normalized.maxIntervalSec}s.`;
}

export function getAutoDjFxMaxGapMs(settings) {
  const normalized = normalizeAutoDjFxSettings(settings);
  return normalized.maxIntervalSec * 1000;
}

export function canTriggerAutoDjFx(event, settings, lastTriggeredAtMs, nowMs = Date.now()) {
  const normalized = normalizeAutoDjFxSettings(settings);
  if (!normalized.enabled) {
    const typeDisabled = String(event?.type || '');
    const labelDisabled = String(event?.label || typeDisabled || 'FX');
    return { allowed: false, reason: 'disabled', type: typeDisabled, label: labelDisabled };
  }

  const type = String(event?.type || '');
  const label = String(event?.label || type || 'FX');
  if (!type) return { allowed: false, reason: 'missing-type', type, label };

  if (!isAutoDjFxTypeAllowed(normalized, type)) {
    return { allowed: false, reason: 'not-allowed', type, label };
  }

  const minGapMs = getSafeAutoDjFxMinIntervalSec(normalized.minIntervalSec) * 1000;
  const elapsedMs = nowMs - (Number(lastTriggeredAtMs) || 0);
  if (Number(lastTriggeredAtMs) > 0 && elapsedMs < minGapMs) {
    return { allowed: false, reason: 'min-interval', type, label, elapsedMs, minGapMs };
  }

  return { allowed: true, reason: 'ok', type, label, minGapMs, elapsedMs };
}
