/**
 * sound.js — Sons Web Audio synthétiques
 * Adapté de game-template/sound.js + son de buzz taboo.
 */

let _ctx = null;
let _muted = false;

export function setMuted(val) { _muted = val; }
export function getMuted()    { return _muted; }

function getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
  return _ctx;
}

function playNote(freq, type, startTime, duration, gain = 0.4) {
  if (_muted) return;
  const ctx = getCtx();
  const osc      = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.01);
  gainNode.gain.setValueAtTime(gain, startTime + duration - 0.05);
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

/** Clic de bouton. */
export function playButtonClick() {
  if (_muted) return;
  const ctx = getCtx();
  playNote(800, 'sine', ctx.currentTime, 0.06, 0.15);
}

/** Tick du compte à rebours (≤ 10 s). */
export function playTick() {
  if (_muted) return;
  const ctx = getCtx();
  playNote(880, 'square', ctx.currentTime, 0.08, 0.12);
}

/** Tick urgent (≤ 5 s). */
export function playTickUrgent() {
  if (_muted) return;
  const ctx = getCtx();
  playNote(1200, 'square', ctx.currentTime, 0.08, 0.18);
}

/** Son "trouvé / bonne réponse". */
export function playFound() {
  if (_muted) return;
  const ctx = getCtx();
  const t = ctx.currentTime;
  playNote(523, 'sine', t,       0.12, 0.35);
  playNote(659, 'sine', t + 0.1, 0.12, 0.35);
  playNote(784, 'sine', t + 0.2, 0.18, 0.4);
}

/** Buzzer de fin de tour (temps écoulé). */
export function playBuzzer() {
  if (_muted) return;
  const ctx = getCtx();
  const t = ctx.currentTime;
  playNote(200, 'sawtooth', t,       0.18, 0.5);
  playNote(180, 'sawtooth', t + 0.2, 0.18, 0.5);
  playNote(160, 'sawtooth', t + 0.4, 0.25, 0.5);
}

/** Son de buzz taboo (mot interdit prononcé). */
export function playBuzz() {
  if (_muted) return;
  const ctx = getCtx();
  const t = ctx.currentTime;
  playNote(300, 'sawtooth', t,       0.12, 0.6);
  playNote(250, 'sawtooth', t + 0.1, 0.15, 0.55);
  playNote(220, 'sawtooth', t + 0.22, 0.2, 0.5);
}

/** Son de début de partie. */
export function playGameStart() {
  if (_muted) return;
  const ctx = getCtx();
  const t = ctx.currentTime;
  playNote(523,  'sine', t,        0.12, 0.35);
  playNote(659,  'sine', t + 0.12, 0.12, 0.35);
  playNote(784,  'sine', t + 0.24, 0.12, 0.35);
  playNote(1047, 'sine', t + 0.36, 0.2,  0.4);
}

/** Son de fin de partie. */
export function playGameOver() {
  if (_muted) return;
  const ctx = getCtx();
  const t = ctx.currentTime;
  playNote(523, 'sine', t,        0.15, 0.4);
  playNote(440, 'sine', t + 0.15, 0.15, 0.4);
  playNote(392, 'sine', t + 0.30, 0.15, 0.4);
  playNote(330, 'sine', t + 0.45, 0.3,  0.45);
}
