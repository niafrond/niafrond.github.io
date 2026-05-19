import {
  getAllowedTransitionModesForRam,
  MIX_TRANSITION_MODES,
} from './transitionModes.js';

export const MOBILE_TRANSITION_RAM_BUDGET_RATIO = 0.12;

export function isMobileDevice(env = {}) {
  const nav = env.navigator || globalThis.navigator || {};
  const win = env.window || globalThis.window || {};
  const ua = String(nav.userAgent || nav.vendor || '').toLowerCase();
  const coarseTouch = win.matchMedia?.('(pointer: coarse)')?.matches === true;
  const shortestSide = Math.min(Number(win.innerWidth) || 0, Number(win.innerHeight) || 0);
  return /android|iphone|ipad|ipod|mobile|windows phone|opera mini|blackberry/.test(ua)
    || (coarseTouch && shortestSide > 0 && shortestSide < 900);
}

export function estimateTotalDeviceRamMb(nav = globalThis.navigator || {}) {
  if (Number.isFinite(nav.deviceMemory) && nav.deviceMemory > 0) {
    return Math.round(nav.deviceMemory * 1024);
  }

  const cores = Number(nav.hardwareConcurrency) || 0;
  if (cores <= 2) return 1536;
  if (cores <= 4) return 2048;
  if (cores <= 6) return 3072;
  return 4096;
}

export function computeTransitionRamProfile(options = {}) {
  const mobile = options.mobile === true || options.mobile === false
    ? options.mobile
    : isMobileDevice();
  const ramFilterEnabled = Boolean(options.ramFilterEnabled);
  const ramTotalMbOverride = Math.max(0, Number(options.ramTotalMbOverride) || 0);
  const crossfadeDurationMs = Math.max(250, Number(options.crossfadeDurationMs) || 6000);

  const shouldApplyFilter = ramFilterEnabled && (mobile || ramTotalMbOverride > 0);
  if (!shouldApplyFilter) {
    return {
      allowedTransitionModes: [...MIX_TRANSITION_MODES],
      capability: {
        enabled: false,
        mobile: false,
        totalRamMb: null,
        transitionBudgetMb: null,
        disabledModes: [],
      },
    };
  }

  const totalRamMb = ramTotalMbOverride > 0 ? ramTotalMbOverride : estimateTotalDeviceRamMb();
  const transitionBudgetMb = Math.max(64, Math.round(totalRamMb * MOBILE_TRANSITION_RAM_BUDGET_RATIO));
  const allowedTransitionModes = getAllowedTransitionModesForRam(transitionBudgetMb, {
    crossfadeDurationMs,
  });
  const disabledModes = MIX_TRANSITION_MODES.filter((mode) => !allowedTransitionModes.includes(mode));

  return {
    allowedTransitionModes,
    capability: {
      enabled: true,
      mobile: true,
      totalRamMb,
      transitionBudgetMb,
      ramOverrideMb: ramTotalMbOverride,
      disabledModes,
    },
  };
}
