/**
 * sound.js — Sons Web Audio synthétiques
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

export function playButtonClick() {
  if (_muted) return;
  const ctx = getCtx();
  playNote(800, 'sine', ctx.currentTime, 0.06, 0.15);
}

export function playTick() {
  if (_muted) return;
  const ctx = getCtx();
  playNote(880, 'square', ctx.currentTime, 0.08, 0.12);
}

export function playTickUrgent() {
  if (_muted) return;
  const ctx = getCtx();
  playNote(1200, 'square', ctx.currentTime, 0.08, 0.18);
}

export function playFound() {
  if (_muted) return;
  const ctx = getCtx();
  const t = ctx.currentTime;
  playNote(523, 'sine', t,        0.12, 0.35);
  playNote(659, 'sine', t + 0.1,  0.12, 0.35);
  playNote(784, 'sine', t + 0.2,  0.18, 0.4);
}

export function playBuzzer() {
  if (_muted) return;
  const ctx = getCtx();
  const t = ctx.currentTime;
  playNote(200, 'sawtooth', t,       0.18, 0.5);
  playNote(180, 'sawtooth', t + 0.2, 0.18, 0.5);
  playNote(160, 'sawtooth', t + 0.4, 0.25, 0.5);
}

export function playGameStart() {
  if (_muted) return;
  const ctx = getCtx();
  const t = ctx.currentTime;
  [523, 659, 784, 1047].forEach((f, i) => playNote(f, 'sine', t + i * 0.12, 0.15, 0.35));
}

export function playGameOver() {
  if (_muted) return;
  const ctx = getCtx();
  const t = ctx.currentTime;
  [523, 440, 392, 330].forEach((f, i) => playNote(f, 'sine', t + i * 0.18, 0.2, 0.35));
}
