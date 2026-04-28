/**
 * sound.js — Sons pour Flash Guess
 *
 * La sonnerie de fin de tour utilise le fichier MP3 embarqué ;
 * les autres sons sont générés via Web Audio API.
 */

import { TTS_PREWARM_KEY } from './state.js';

let _ctx = null;
let _muted = false;

// ─── MP3 bell buffer ──────────────────────────────────────────────────────────
let _bellBuffer = null;

async function _loadBell() {
  try {
    const ctx = getCtx();
    const res = await fetch('./universfield-school-bell-199584.mp3');
    const buf = await res.arrayBuffer();
    _bellBuffer = await ctx.decodeAudioData(buf);
  } catch (_) {}
}

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

// Kick off MP3 pre-load as soon as the module is imported (browser only)
if (typeof fetch !== 'undefined') {
  _loadBell();
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

/** Sonnerie de fin de manche — MP3 école (fallback synthétique si non chargé) */
export function playBuzzer() {
  if (_muted) return;
  if (_bellBuffer) {
    try {
      const ctx = getCtx();
      const source = ctx.createBufferSource();
      source.buffer = _bellBuffer;
      source.connect(ctx.destination);
      source.start();
    } catch (_) {}
    return;
  }
  // Fallback : sonnerie synthétique si le MP3 n'est pas encore chargé
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    [0, 0.6, 1.2, 1.8].forEach((offset) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, now + offset);
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

/** Son de "Passer" — glissé neutre en trois paliers descendants */
export function playSkip() {
  if (_muted) return;
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    playNote(660, 'triangle', now,        0.06, 0.20);
    playNote(550, 'triangle', now + 0.07, 0.06, 0.16);
    playNote(440, 'triangle', now + 0.14, 0.08, 0.12);
  } catch (_) {}
}

/** Son d'"Abandonner" — trois notes descendantes lourdes */
export function playAbandon() {
  if (_muted) return;
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    playNote(440, 'triangle', now,        0.10, 0.28);
    playNote(330, 'triangle', now + 0.11, 0.10, 0.22);
    playNote(220, 'triangle', now + 0.22, 0.14, 0.18);
  } catch (_) {}
}

/** Son de "Je suis prêt" — double ping ascendant lumineux */
export function playReady() {
  if (_muted) return;
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    playNote(659, 'sine', now,        0.08, 0.20);
    playNote(988, 'sine', now + 0.09, 0.12, 0.22);
  } catch (_) {}
}

/** Son de "Carte suivante" — claquement sec très court */
export function playNextCard() {
  if (_muted) return;
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    playNote(880, 'sine', now, 0.04, 0.22);
  } catch (_) {}
}

/** Son de "Suivant" — deux notes montantes, sensation d'avancer */
export function playNextTurn() {
  if (_muted) return;
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    playNote(523, 'triangle', now,        0.07, 0.18);
    playNote(784, 'triangle', now + 0.08, 0.10, 0.20);
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

// ─── TTS — phrases fixes et suivi pré-amorçage ───────────────────────────────

/**
 * Morceaux fixes de la phrase d'annonce de tour.
 * Stockés séparément pour être pré-amorcés une seule fois au lancement.
 */
const FIXED_PHRASES = ['Au tour de', 'pour'];

/** Ensemble en mémoire des textes déjà mis en file silencieuse. */
const _prewarmed = new Set();

function _silentUtt(text) {
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang   = 'fr-FR';
  utt.volume = 0;
  utt.rate   = 5;
  return utt;
}

/**
 * Met en file une utterance silencieuse pour `text` si ce n'est pas encore fait.
 * Ne doit être appelé que depuis un contexte de geste utilisateur.
 */
function _queueSilent(text) {
  if (_prewarmed.has(text)) return;
  _prewarmed.add(text);
  speechSynthesis.speak(_silentUtt(text));
}

/**
 * Enregistre un nom de joueur dans localStorage pour mémoriser
 * qu'il a été soumis au pré-amorçage TTS.
 */
function _savePrewarmedName(name) {
  try {
    const stored = JSON.parse(localStorage.getItem(TTS_PREWARM_KEY) || '[]');
    if (!stored.includes(name)) {
      stored.push(name);
      localStorage.setItem(TTS_PREWARM_KEY, JSON.stringify(stored));
    }
  } catch (_) { /* ignore */ }
}

/**
 * Renvoie les noms de joueurs précédemment enregistrés pour le pré-amorçage TTS.
 */
export function loadPrewarmedNames() {
  try { return JSON.parse(localStorage.getItem(TTS_PREWARM_KEY) || '[]'); } catch { return []; }
}

/**
 * Pré-amorce le moteur TTS pour un seul joueur, sans annuler la file en cours.
 * À appeler dans le contexte d'un geste utilisateur (clic "Ajouter").
 */
export function prewarmPlayer(name) {
  if (typeof speechSynthesis === 'undefined') return;
  try {
    _queueSilent(name);
    _savePrewarmedName(name);
  } catch (_) {}
}

/**
 * Pré-amorce le moteur TTS dans le contexte d'un geste utilisateur.
 * Annule la file en cours, réinitialise le suivi, puis met en file
 * silencieusement les phrases fixes et tous les noms de joueurs.
 */
export function prewarmPlayerNames(names) {
  if (typeof speechSynthesis === 'undefined') return;
  try {
    speechSynthesis.cancel();
    _prewarmed.clear();
    FIXED_PHRASES.forEach(p => _queueSilent(p));
    names.forEach(name => {
      _queueSilent(name);
      _savePrewarmedName(name);
    });
  } catch (_) {}
}

/**
 * Synthèse vocale — annonce le nom du joueur dont c'est le tour
 * et, si fourni, le nom du devineur.
 * La phrase est découpée en morceaux distincts pour bénéficier
 * du pré-amorçage TTS effectué sur chaque segment.
 */
export function speakPreTurn(playerName, guesserLabel) {
  if (_muted) return;
  if (typeof speechSynthesis === 'undefined') return;
  try {
    speechSynthesis.cancel();
    const parts = ['Au tour de', playerName];
    if (guesserLabel) {
      parts.push('pour');
      parts.push(guesserLabel.replace(/ · /g, ' et '));
    }
    parts.forEach(text => {
      const utt   = new SpeechSynthesisUtterance(text);
      utt.lang    = 'fr-FR';
      utt.rate    = 1.25;
      utt.pitch   = 1;
      speechSynthesis.speak(utt);
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
