/**
 * sound.js — Sons synthétiques pour l'application Quiz
 *
 * Tous les sons sont générés via Web Audio API, sans fichier externe.
 * L'AudioContext est initialisé de façon paresseuse au premier appel,
 * après une interaction utilisateur (requis par les navigateurs).
 */

let _ctx = null;

function getCtx() {
  if (!_ctx) {
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (_ctx.state === 'suspended') {
    _ctx.resume().catch(() => {});
  }
  return _ctx;
}

/** Joue une note simple (oscillateur + enveloppe ADSR minimale) */
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

// ─── Sons ──────────────────────────────────────────────────────────────────────

/** Son de buzzer — onde carrée grave descendante */
export function playBuzz() {
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.type = 'square';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.15);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01);
    gainNode.gain.setValueAtTime(0.3, now + 0.12);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.18);

    osc.start(now);
    osc.stop(now + 0.2);
  } catch (_) {}
}

/** Son de bonne réponse — arpège ascendant joyeux */
export function playCorrect() {
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // Do Mi Sol Do (octave)
    notes.forEach((freq, i) => {
      playNote(freq, 'sine', now + i * 0.08, 0.2, 0.35);
    });
  } catch (_) {}
}

/** Son de mauvaise réponse — deux tonalités descendantes */
export function playWrong() {
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    playNote(300, 'sawtooth', now, 0.18, 0.3);
    playNote(220, 'sawtooth', now + 0.2, 0.22, 0.3);
  } catch (_) {}
}

/** Son "presque" (near miss) — note moyenne légèrement descendante */
export function playNearMiss() {
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    playNote(440, 'triangle', now, 0.15, 0.3);
    playNote(380, 'triangle', now + 0.18, 0.2, 0.25);
  } catch (_) {}
}

/** Son de nouvelle question — ding clair */
export function playQuestionStart() {
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    playNote(880, 'sine', now, 0.12, 0.25);
    playNote(1100, 'sine', now + 0.14, 0.18, 0.2);
  } catch (_) {}
}

/** Son de fin de partie — fanfare courte */
export function playGameOver() {
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    const melody = [
      [523.25, 0.12],
      [523.25, 0.12],
      [523.25, 0.12],
      [415.30, 0.09],
      [523.25, 0.18],
      [659.25, 0.18],
      [783.99, 0.36],
    ];
    let t = now;
    melody.forEach(([freq, dur]) => {
      playNote(freq, 'sine', t, dur + 0.04, 0.35);
      t += dur + 0.02;
    });
  } catch (_) {}
}

/** Son de compte à rebours (dernier 3 secondes) — tick sec */
export function playTick() {
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);

    gainNode.gain.setValueAtTime(0.15, now);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.06);

    osc.start(now);
    osc.stop(now + 0.07);
  } catch (_) {}
}
