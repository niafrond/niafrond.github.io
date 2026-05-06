/**
 * sound.js — Sons Web Audio synthétiques pour Geo Party
 */

let _ctx   = null;
let _muted = false;

export function setMuted(val) { _muted = val; }
export function getMuted()    { return _muted; }

function getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
  return _ctx;
}

function playNote(freq, type, startTime, duration, gain = 0.35) {
  if (_muted) return;
  const ctx  = getCtx();
  const osc  = ctx.createOscillator();
  const gn   = ctx.createGain();
  osc.connect(gn);
  gn.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gn.gain.setValueAtTime(0, startTime);
  gn.gain.linearRampToValueAtTime(gain, startTime + 0.01);
  gn.gain.setValueAtTime(gain, startTime + duration - 0.05);
  gn.gain.linearRampToValueAtTime(0, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

/** Clic bouton. */
export function playButtonClick() {
  if (_muted) return;
  const ctx = getCtx();
  playNote(800, 'sine', ctx.currentTime, 0.06, 0.12);
}

/** Tick de compte à rebours (≤ 10 s). */
export function playTick() {
  if (_muted) return;
  const ctx = getCtx();
  playNote(880, 'square', ctx.currentTime, 0.07, 0.1);
}

/** Tick urgent (≤ 5 s). */
export function playTickUrgent() {
  if (_muted) return;
  const ctx = getCtx();
  playNote(1200, 'square', ctx.currentTime, 0.07, 0.15);
}

/** Bonne réponse / score élevé. */
export function playFound() {
  if (_muted) return;
  const ctx = getCtx();
  const t = ctx.currentTime;
  playNote(523, 'sine', t,       0.12, 0.3);
  playNote(659, 'sine', t + 0.1, 0.12, 0.3);
  playNote(784, 'sine', t + 0.2, 0.18, 0.35);
}

/** Fin de tour (buzzer). */
export function playBuzzer() {
  if (_muted) return;
  const ctx = getCtx();
  const t = ctx.currentTime;
  playNote(200, 'sawtooth', t,       0.18, 0.45);
  playNote(180, 'sawtooth', t + 0.2, 0.18, 0.45);
  playNote(160, 'sawtooth', t + 0.4, 0.25, 0.45);
}

/** Démarrage de partie. */
export function playGameStart() {
  if (_muted) return;
  const ctx = getCtx();
  const t = ctx.currentTime;
  playNote(523,  'sine', t,        0.12, 0.3);
  playNote(659,  'sine', t + 0.12, 0.12, 0.3);
  playNote(784,  'sine', t + 0.24, 0.12, 0.3);
  playNote(1047, 'sine', t + 0.36, 0.2,  0.35);
}

/** Fin de partie. */
export function playGameOver() {
  if (_muted) return;
  const ctx = getCtx();
  const t = ctx.currentTime;
  playNote(784, 'sine', t,        0.15, 0.35);
  playNote(659, 'sine', t + 0.15, 0.15, 0.35);
  playNote(523, 'sine', t + 0.30, 0.15, 0.35);
  playNote(392, 'sine', t + 0.45, 0.3,  0.4);
}

/** Countdown (3-2-1). */
export function playCountdown(n) {
  if (_muted) return;
  const ctx = getCtx();
  const freq = n === 1 ? 1047 : 880;
  playNote(freq, 'sine', ctx.currentTime, 0.15, 0.3);
}
