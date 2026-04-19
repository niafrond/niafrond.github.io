/**
 * sound.js — Sons synthétiques pour Time's Up Nout Péi
 *
 * Tous les sons sont générés via Web Audio API, sans fichier externe.
 */

let _ctx = null;
let _muted = false;

export function setMuted(val) { _muted = val; }
export function getMuted() { return _muted; }

function getCtx() {
  if (!_ctx) {
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (_ctx.state === 'suspended') {
    _ctx.resume().catch(() => {});
  }
  return _ctx;
}

function playNote(freq, type, startTime, duration, gain = 0.4) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
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

/** Tick normal (compte à rebours ≤ 10s) */
export function playTick() {
  if (_muted) return;
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    g.gain.setValueAtTime(0.18, now);
    g.gain.linearRampToValueAtTime(0, now + 0.07);
    osc.start(now); osc.stop(now + 0.08);
  } catch (_) {}
}

/** Tick urgent (compte à rebours ≤ 5s) */
export function playTickUrgent() {
  if (_muted) return;
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1320, now);
    g.gain.setValueAtTime(0.28, now);
    g.gain.linearRampToValueAtTime(0, now + 0.06);
    osc.start(now); osc.stop(now + 0.07);
  } catch (_) {}
}

/** Sonnerie de fin de manche — sonnerie d'école (3 coups de cloche) */
export function playBuzzer() {
  if (_muted) return;
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    // Three school-bell dings: fundamental (900 Hz) + overtone (1440 Hz)
    [0, 0.55, 1.1].forEach((offset) => {
      playNote(900,  'sine', now + offset, 0.40, 0.70);
      playNote(1440, 'sine', now + offset, 0.25, 0.35);
    });
  } catch (_) {}
}

/** Son de mot trouvé — double ding joyeux */
export function playFound() {
  if (_muted) return;
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    playNote(880, 'sine', now, 0.1, 0.25);
    playNote(1320, 'sine', now + 0.1, 0.15, 0.2);
  } catch (_) {}
}

/** Son de démarrage de manche — mélodie rapide tropicale */
export function playRoundStart() {
  if (_muted) return;
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((freq, i) => {
      playNote(freq, 'triangle', now + i * 0.09, 0.18, 0.3);
    });
  } catch (_) {}
}

/** Fanfare de fin de partie */
export function playGameOver() {
  if (_muted) return;
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    const melody = [
      [523.25, 0.12], [523.25, 0.12], [523.25, 0.12],
      [415.30, 0.09], [523.25, 0.18],
      [659.25, 0.18], [783.99, 0.36],
    ];
    let t = now;
    melody.forEach(([freq, dur]) => {
      playNote(freq, 'sine', t, dur + 0.04, 0.35);
      t += dur + 0.02;
    });
  } catch (_) {}
}
