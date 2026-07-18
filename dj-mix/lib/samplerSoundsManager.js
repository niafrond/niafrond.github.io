import { STORAGE_KEYS } from './storageKeys.js';

export const SAMPLER_SOUND_CONFIG = Object.freeze({
  airhorn: { label: 'Airhorn' },
  stab: { label: 'Stab' },
  laser: { label: 'Laser' },
  siren: { label: 'Siren' },
});

export const SAMPLER_SOUND_IDS = Object.freeze(Object.keys(SAMPLER_SOUND_CONFIG));

export function createDefaultSamplerSoundsAllowed() {
  const defaults = {};
  for (const id of SAMPLER_SOUND_IDS) {
    defaults[id] = true;
  }
  return defaults;
}

export function normalizeSamplerSoundsSettings(raw) {
  const allowed = createDefaultSamplerSoundsAllowed();
  const allowedFromStorage = (raw && typeof raw.allowed === 'object') ? raw.allowed : {};

  for (const id in allowedFromStorage) {
    if (Object.prototype.hasOwnProperty.call(allowedFromStorage, id)) {
      allowed[id] = Boolean(allowedFromStorage[id]);
    }
  }

  return { allowed };
}

export function readSamplerSoundsSettings() {
  const defaults = normalizeSamplerSoundsSettings(null);
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.samplerSoundsSettings);
    if (!raw) return defaults;
    return normalizeSamplerSoundsSettings(JSON.parse(raw));
  } catch (_) {
    return defaults;
  }
}

export function persistSamplerSoundsSettings(settings) {
  try {
    localStorage.setItem(
      STORAGE_KEYS.samplerSoundsSettings,
      JSON.stringify(normalizeSamplerSoundsSettings(settings)),
    );
  } catch (_) {
    // ignore storage failures
  }
}

export function isSamplerSoundAllowed(settings, id) {
  if (!id) return false;
  if (!Object.prototype.hasOwnProperty.call(settings?.allowed || {}, id)) return true;
  return Boolean(settings.allowed[id]);
}
