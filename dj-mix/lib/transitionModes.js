// Transition mode catalog + RAM estimation utilities.

export const MIX_TRANSITION_MODES = Object.freeze([
  'auto',
  'crossfade_linear',
  'crossfade_logarithmic',
  'fade_in_out',
  'cut_transition',
  'filter_sweep_low_high',
  'eq_transition_simple',
  'echo_out_light',
  'reverb_short_simple',
  'short_loop',
  'brake_tape_stop_simple',
  'short_reverse',
  'sidechain_basic',
  'volume_ducking',
  'gain_automation',
  'filter_automation',
  'crossfade_lowpass',
  'crossfade_highpass_in',
  'filter_dual_sweep',
  'echo_lowpass',
  'bass_swap',
  'kick_swap',
  'beat_repeat',
  'backspin',
  'fake_drop',
  'echo_freeze',
]);

export const MIX_TRANSITION_MODE_LABELS = Object.freeze({
  auto: 'Auto (meilleur)',
  crossfade_linear: 'Crossfade lineaire',
  crossfade_logarithmic: 'Crossfade logarithmique',
  fade_in_out: 'Fade in / Fade out',
  cut_transition: 'Cut transition',
  filter_sweep_low_high: 'Filter sweep (low-pass / high-pass)',
  eq_transition_simple: 'EQ transition simple',
  echo_out_light: 'Echo out leger',
  reverb_short_simple: 'Reverb courte et simple',
  short_loop: 'Loop courte',
  brake_tape_stop_simple: 'Brake / tape stop simple',
  short_reverse: 'Reverse court',
  sidechain_basic: 'Sidechain basique',
  volume_ducking: 'Volume ducking',
  gain_automation: 'Automation de gain',
  filter_automation: 'Automation de filtre',
  crossfade_lowpass: 'Crossfade + Low-pass sortant',
  crossfade_highpass_in: 'Crossfade + High-pass entrant',
  filter_dual_sweep: 'Double filtre (low/high swap)',
  echo_lowpass: 'Echo + Low-pass sortant',
  bass_swap: 'Bass swap (échange des graves)',
  kick_swap: 'Kick swap (échange des kicks)',
  beat_repeat: 'Beat repeat (boucle accélérée)',
  backspin: 'Backspin (vinyl stop)',
  fake_drop: 'Fake drop (silence + impact)',
  echo_freeze: 'Echo freeze (écho gelé)',
});

export const DEFAULT_TRANSITION_MODE = 'auto';

export function normalizeTransitionMode(mode) {
  const next = String(mode || '').trim();
  return MIX_TRANSITION_MODES.includes(next) ? next : DEFAULT_TRANSITION_MODE;
}

const TRANSITION_EXTRA_RAM_MB = Object.freeze({
  auto: 0,
  crossfade_linear: 18,
  crossfade_logarithmic: 20,
  fade_in_out: 24,
  cut_transition: 6,
  filter_sweep_low_high: 96,
  eq_transition_simple: 44,
  echo_out_light: 128,
  reverb_short_simple: 172,
  short_loop: 108,
  brake_tape_stop_simple: 58,
  short_reverse: 122,
  sidechain_basic: 52,
  volume_ducking: 40,
  gain_automation: 34,
  filter_automation: 104,
  crossfade_lowpass: 140,
  crossfade_highpass_in: 118,
  filter_dual_sweep: 178,
  echo_lowpass: 216,
  bass_swap: 175,
  kick_swap: 145,
  beat_repeat: 112,
  backspin: 85,
  fake_drop: 28,
  echo_freeze: 195,
});

const TRANSITION_OVERLAP_MULTIPLIER = Object.freeze({
  auto: 0,
  crossfade_linear: 1.0,
  crossfade_logarithmic: 1.02,
  fade_in_out: 1.05,
  cut_transition: 0.12,
  filter_sweep_low_high: 1.2,
  eq_transition_simple: 1.08,
  echo_out_light: 1.35,
  reverb_short_simple: 1.55,
  short_loop: 1.22,
  brake_tape_stop_simple: 1.12,
  short_reverse: 1.24,
  sidechain_basic: 1.1,
  volume_ducking: 1.06,
  gain_automation: 1.0,
  filter_automation: 1.25,
  crossfade_lowpass: 1.18,
  crossfade_highpass_in: 1.12,
  filter_dual_sweep: 1.35,
  echo_lowpass: 1.45,
  bass_swap: 1.30,
  kick_swap: 1.25,
  beat_repeat: 1.20,
  backspin: 0.95,
  fake_drop: 0.80,
  echo_freeze: 1.48,
});

export function getTransitionRamRequirementsMb(options = {}) {
  const crossfadeDurationMs = Math.max(250, Number(options.crossfadeDurationMs) || 12000);
  const sampleRate = Number(options.sampleRate) > 0 ? Number(options.sampleRate) : 44100;
  const channels = Number(options.channels) > 0 ? Number(options.channels) : 2;
  const bytesPerSample = Number(options.bytesPerSample) > 0 ? Number(options.bytesPerSample) : 4;
  const overlapSeconds = crossfadeDurationMs / 1000;
  const overlapMb = (sampleRate * channels * bytesPerSample * overlapSeconds) / (1024 * 1024);

  const profile = {};
  for (const mode of MIX_TRANSITION_MODES) {
    const extraMb = TRANSITION_EXTRA_RAM_MB[mode] || 0;
    const overlapFactor = TRANSITION_OVERLAP_MULTIPLIER[mode] || 1;
    const estimateMb = mode === 'auto'
      ? 0
      : Math.round((extraMb + (overlapMb * overlapFactor)) * 10) / 10;
    profile[mode] = estimateMb;
  }
  return profile;
}

export function getTransitionRamRequirementMb(mode, options = {}) {
  const safeMode = normalizeTransitionMode(mode);
  const profile = getTransitionRamRequirementsMb(options);
  return Number(profile[safeMode]) || 0;
}

export function getAllowedTransitionModesForRam(ramBudgetMb, options = {}) {
  const budgetMb = Math.max(0, Number(ramBudgetMb) || 0);
  const profile = getTransitionRamRequirementsMb(options);
  const allowed = MIX_TRANSITION_MODES.filter((mode) => {
    if (mode === 'auto') return true;
    return (Number(profile[mode]) || 0) <= budgetMb;
  });

  if (!allowed.includes('cut_transition')) {
    allowed.push('cut_transition');
  }
  if (!allowed.includes('auto')) {
    allowed.unshift('auto');
  }

  return allowed;
}
