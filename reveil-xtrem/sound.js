// Sonneries d'alarme générées via Web Audio (pas de fichier audio à charger,
// fonctionne hors-ligne dans la PWA comme dans le wrapper Android).

export const SOUND_PRESETS = [
  { id: 'classic', label: '🔔 Classique' },
  { id: 'digital', label: '⏱️ Digital' },
  { id: 'siren', label: '🚨 Sirène' },
  { id: 'chime', label: '🎐 Carillon' },
  { id: 'gentle', label: '🌙 Douceur' },
];

export const DEFAULT_SOUND_ID = 'classic';

let audioCtx = null;
let loopId = null;

function beep(ctx, freq, duration, when, type = 'square', peakGain = 0.35) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(peakGain, when + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(when);
  osc.stop(when + duration + 0.02);
}

function sweep(ctx, fromFreq, toFreq, duration, when, peakGain = 0.3) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(fromFreq, when);
  osc.frequency.linearRampToValueAtTime(toFreq, when + duration);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(peakGain, when + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(when);
  osc.stop(when + duration + 0.02);
}

const PATTERNS = {
  classic(ctx, now) {
    beep(ctx, 880, 0.18, now);
    beep(ctx, 880, 0.18, now + 0.28);
    beep(ctx, 660, 0.32, now + 0.56);
  },
  digital(ctx, now) {
    beep(ctx, 1046, 0.1, now);
    beep(ctx, 1046, 0.1, now + 0.16);
    beep(ctx, 1046, 0.1, now + 0.32);
    beep(ctx, 1046, 0.1, now + 0.48);
  },
  siren(ctx, now) {
    sweep(ctx, 440, 880, 0.45, now);
    sweep(ctx, 880, 440, 0.45, now + 0.45);
  },
  chime(ctx, now) {
    beep(ctx, 784, 0.5, now, 'triangle', 0.28);
    beep(ctx, 1047, 0.7, now + 0.15, 'triangle', 0.24);
  },
  gentle(ctx, now) {
    beep(ctx, 523, 0.5, now, 'sine', 0.2);
    beep(ctx, 659, 0.6, now + 0.25, 'sine', 0.18);
  },
};

function resolvePattern(soundId) {
  return PATTERNS[soundId] || PATTERNS[DEFAULT_SOUND_ID];
}

function ensureContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  audioCtx = audioCtx || new Ctx();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

export function startAlarmSound(soundId = DEFAULT_SOUND_ID) {
  if (loopId) return;
  const ctx = ensureContext();
  if (!ctx) return;
  const play = resolvePattern(soundId);
  play(ctx, ctx.currentTime);
  loopId = setInterval(() => play(ctx, ctx.currentTime), 1000);
  if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400, 200, 400]);
}

export function stopAlarmSound() {
  if (loopId) {
    clearInterval(loopId);
    loopId = null;
  }
  if (navigator.vibrate) navigator.vibrate(0);
}

export function isAlarmSoundPlaying() {
  return loopId != null;
}

/** Joue un seul cycle d'une sonnerie, pour la prévisualiser dans l'écran d'édition. */
export function previewSound(soundId = DEFAULT_SOUND_ID) {
  const ctx = ensureContext();
  if (!ctx) return;
  resolvePattern(soundId)(ctx, ctx.currentTime);
}
