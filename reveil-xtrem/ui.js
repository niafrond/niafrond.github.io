// Fonctions de formatage pures, réutilisées par main.js et testées isolément.

export const DAY_LABELS = { 0: 'D', 1: 'L', 2: 'M', 3: 'M', 4: 'J', 5: 'V', 6: 'S' };
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function formatDaysShort(days) {
  if (!days || days.length === 0) return 'Une fois';
  if (days.length === 7) return 'Tous les jours';
  const weekdays = [1, 2, 3, 4, 5];
  const weekend = [0, 6];
  if (days.length === 5 && weekdays.every(d => days.includes(d))) return 'Semaine';
  if (days.length === 2 && weekend.every(d => days.includes(d))) return 'Week-end';
  return DAY_ORDER.filter(d => days.includes(d)).map(d => DAY_LABELS[d]).join(' ');
}

export function formatClock(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}
