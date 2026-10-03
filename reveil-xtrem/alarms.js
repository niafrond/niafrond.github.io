// Stockage local des alarmes et de leur état d'exécution (snooze, dernier déclenchement).

import { DEFAULT_SOUND_ID } from './sound.js';

const ALARMS_KEY = 'reveil-xtrem:alarms:v1';
const RUNTIME_KEY = 'reveil-xtrem:runtime:v1';

export const DIFFICULTIES = ['veryEasy', 'easy', 'medium', 'hard', 'veryHard'];
export const DEFAULT_SNOOZE_MINUTES = 9;
export const DEFAULT_PROBLEMS_COUNT = 3;
export const MIN_PROBLEMS_COUNT = 1;
export const MAX_PROBLEMS_COUNT = 10;

// Nombre de rappels (snooze) autorisés avant de forcer la résolution du
// calcul — 0 = illimité (comportement historique, avant ce réglage).
export const DEFAULT_SNOOZE_LIMIT = 0;
export const MIN_SNOOZE_LIMIT = 0;
export const MAX_SNOOZE_LIMIT = 10;

// Minutes retranchées à l'intervalle de rappel à chaque nouveau snooze
// (ex. 10 min réglées, réduction de 2 min → 10, 8, 6, 4… jamais sous 1 min)
// — 0 = intervalle constant (comportement historique).
export const DEFAULT_SNOOZE_DECREASE_MINUTES = 0;
export const MIN_SNOOZE_DECREASE_MINUTES = 0;
export const MAX_SNOOZE_DECREASE_MINUTES = 15;

// Délai après lequel la sonnerie s'arrête seule si personne ne résout le
// calcul — 0 = jamais (comportement historique : sonne jusqu'à résolution).
export const DEFAULT_AUTO_DISMISS_MINUTES = 0;
export const MIN_AUTO_DISMISS_MINUTES = 0;
export const MAX_AUTO_DISMISS_MINUTES = 30;

export function clampProblemsCount(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_PROBLEMS_COUNT;
  return Math.min(MAX_PROBLEMS_COUNT, Math.max(MIN_PROBLEMS_COUNT, n));
}

export function clampSnoozeLimit(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_SNOOZE_LIMIT;
  return Math.min(MAX_SNOOZE_LIMIT, Math.max(MIN_SNOOZE_LIMIT, n));
}

export function clampSnoozeDecreaseMinutes(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_SNOOZE_DECREASE_MINUTES;
  return Math.min(MAX_SNOOZE_DECREASE_MINUTES, Math.max(MIN_SNOOZE_DECREASE_MINUTES, n));
}

export function clampAutoDismissMinutes(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_AUTO_DISMISS_MINUTES;
  return Math.min(MAX_AUTO_DISMISS_MINUTES, Math.max(MIN_AUTO_DISMISS_MINUTES, n));
}

// Intervalle de rappel effectif pour le (priorSnoozeCount + 1)ᵉ snooze —
// jamais sous 1 minute même avec une forte réduction cumulée.
export function effectiveSnoozeMinutes(alarm, priorSnoozeCount = 0) {
  const base = alarm.snoozeMinutes || DEFAULT_SNOOZE_MINUTES;
  const decrease = (alarm.snoozeDecreaseMinutes || 0) * priorSnoozeCount;
  return Math.max(1, base - decrease);
}

// GIVEN `priorSnoozeCount` rappels déjà utilisés pour l'occurrence en cours
// — THEN un rappel de plus est autorisé si la limite est illimitée (0) ou
// pas encore atteinte.
export function canSnoozeAgain(alarm, priorSnoozeCount = 0) {
  const limit = alarm.snoozeLimit || 0;
  return limit <= 0 || priorSnoozeCount < limit;
}

function genId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `a-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function loadAlarms() {
  try {
    const raw = localStorage.getItem(ALARMS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAlarms(alarms) {
  localStorage.setItem(ALARMS_KEY, JSON.stringify(alarms));
}

export function createAlarm({
  time, label, days, difficulty, snoozeMinutes, problemsCount, sound,
  snoozeLimit, snoozeDecreaseMinutes, autoDismissMinutes,
}) {
  return {
    id: genId(),
    time,
    label: (label && label.trim()) || 'Alarme',
    days: Array.isArray(days) ? [...days].sort() : [],
    enabled: true,
    difficulty: DIFFICULTIES.includes(difficulty) ? difficulty : 'veryEasy',
    // Le nombre de calculs est réglable indépendamment de la difficulté (qui
    // ne contrôle que le type/la taille des nombres, voir math-challenge.js).
    problemsCount: clampProblemsCount(problemsCount ?? DEFAULT_PROBLEMS_COUNT),
    snoozeMinutes: Number.isFinite(snoozeMinutes) && snoozeMinutes > 0 ? snoozeMinutes : DEFAULT_SNOOZE_MINUTES,
    // Réglages avancés façon Alarm Clock Xtreme (écrans "Rappel"/"Ignorer") :
    // voir clampSnoozeLimit/clampSnoozeDecreaseMinutes/clampAutoDismissMinutes.
    snoozeLimit: clampSnoozeLimit(snoozeLimit ?? DEFAULT_SNOOZE_LIMIT),
    snoozeDecreaseMinutes: clampSnoozeDecreaseMinutes(snoozeDecreaseMinutes ?? DEFAULT_SNOOZE_DECREASE_MINUTES),
    autoDismissMinutes: clampAutoDismissMinutes(autoDismissMinutes ?? DEFAULT_AUTO_DISMISS_MINUTES),
    // Sonnerie propre à chaque alarme : soit un id de sonnerie web (voir
    // sound.js#SOUND_PRESETS, hors app native), soit l'URI d'une sonnerie
    // choisie dans le sélecteur système Android (chaîne libre), soit '' pour
    // la sonnerie par défaut du système. Seule une valeur absente retombe
    // sur la sonnerie web par défaut.
    sound: typeof sound === 'string' ? sound : DEFAULT_SOUND_ID,
    skipNext: false,
    createdAt: Date.now(),
  };
}

export function upsertAlarm(alarms, alarm) {
  const idx = alarms.findIndex(a => a.id === alarm.id);
  const next = [...alarms];
  if (idx === -1) next.push(alarm);
  else next[idx] = alarm;
  return next;
}

export function removeAlarm(alarms, id) {
  return alarms.filter(a => a.id !== id);
}

export function patchAlarm(alarms, id, patch) {
  return alarms.map(a => (a.id === id ? { ...a, ...patch } : a));
}

// ── État d'exécution (snooze en cours, minute déjà sonnée) ────────────────
// Persisté séparément des alarmes pour survivre à un rechargement de page
// pendant un snooze, sans polluer l'objet alarme lui-même.

export function loadRuntime() {
  try {
    const raw = localStorage.getItem(RUNTIME_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveRuntime(runtime) {
  localStorage.setItem(RUNTIME_KEY, JSON.stringify(runtime));
}
