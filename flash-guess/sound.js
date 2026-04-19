/**
 * sound.js — Sons synthétiques pour Flash Guess
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

/** Sonnerie de fin de manche — sonnerie d'école (4 coups de cloche) */
export function playBuzzer() {
  if (_muted) return;
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    // Four loud school-bell dings, each with sharp attack and long decay
    [0, 0.6, 1.2, 1.8].forEach((offset) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, now + offset);
      // Add a slight inharmonic overtone for a metallic bell colour
      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc2.connect(g2); g2.connect(ctx.destination);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1440, now + offset);
      const ringDuration = 0.55;
      g.gain.setValueAtTime(0, now + offset);
      g.gain.linearRampToValueAtTime(0.7, now + offset + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, now + offset + ringDuration);
      g2.gain.setValueAtTime(0, now + offset);
      g2.gain.linearRampToValueAtTime(0.35, now + offset + 0.01);
      g2.gain.exponentialRampToValueAtTime(0.001, now + offset + ringDuration * 0.6);
      osc.start(now + offset); osc.stop(now + offset + ringDuration);
      osc2.start(now + offset); osc2.stop(now + offset + ringDuration);
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

/** Son de confirmation générique — navigation entre écrans */
export function playButtonClick() {
  if (_muted) return;
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    playNote(660, 'sine', now, 0.08, 0.15);
  } catch (_) {}
}

/** Son de "Passer" — note neutre descendante */
export function playSkip() {
  if (_muted) return;
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    playNote(660, 'sine', now, 0.07, 0.18);
    playNote(440, 'sine', now + 0.08, 0.1, 0.12);
  } catch (_) {}
}

/** Son d'"Erreur" — buzz grave court */
export function playFault() {
  if (_muted) return;
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.linearRampToValueAtTime(110, now + 0.18);
    g.gain.setValueAtTime(0.2, now);
    g.gain.linearRampToValueAtTime(0, now + 0.2);
    osc.start(now); osc.stop(now + 0.2);
  } catch (_) {}
}

/** Son d'"Annuler" — glissando descendant rapide */
export function playUndo() {
  if (_muted) return;
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    playNote(880, 'sine', now, 0.07, 0.18);
    playNote(660, 'sine', now + 0.07, 0.07, 0.14);
    playNote(440, 'sine', now + 0.14, 0.08, 0.10);
  } catch (_) {}
}

/** Son de "Refaire" — glissando ascendant rapide */
export function playRedo() {
  if (_muted) return;
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    playNote(440, 'sine', now, 0.07, 0.10);
    playNote(660, 'sine', now + 0.07, 0.07, 0.14);
    playNote(880, 'sine', now + 0.14, 0.08, 0.18);
  } catch (_) {}
}

/** Jingle de début de partie */
export function playGameStart() {
  if (_muted) return;
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    const notes = [
      [523.25, 0.10], [659.25, 0.10], [783.99, 0.10],
      [1046.5, 0.14], [783.99, 0.08], [1046.5, 0.22],
    ];
    let t = now;
    notes.forEach(([freq, dur]) => {
      playNote(freq, 'triangle', t, dur + 0.05, 0.35);
      t += dur + 0.03;
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
