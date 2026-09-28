// Stockage local des alarmes et de leur état d'exécution (snooze, dernier déclenchement).

const ALARMS_KEY = 'reveil-xtrem:alarms:v1';
const RUNTIME_KEY = 'reveil-xtrem:runtime:v1';

export const DIFFICULTIES = ['easy', 'medium', 'hard'];
export const DEFAULT_SNOOZE_MINUTES = 9;

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

export function createAlarm({ time, label, days, difficulty, snoozeMinutes }) {
  return {
    id: genId(),
    time,
    label: (label && label.trim()) || 'Alarme',
    days: Array.isArray(days) ? [...days].sort() : [],
    enabled: true,
    difficulty: DIFFICULTIES.includes(difficulty) ? difficulty : 'easy',
    snoozeMinutes: Number.isFinite(snoozeMinutes) && snoozeMinutes > 0 ? snoozeMinutes : DEFAULT_SNOOZE_MINUTES,
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
