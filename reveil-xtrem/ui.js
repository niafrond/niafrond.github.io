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

function sameCalendarDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Libellé de répétition affiché sur une carte d'alarme. Pour une alarme
 * ponctuelle (`days` vide), affiche "Aujourd'hui"/"Demain" quand on connaît
 * sa prochaine occurrence (`nextAt`), sinon retombe sur `formatDaysShort`.
 */
export function formatAlarmSchedule(alarm, nextAt, now) {
  if (alarm.days && alarm.days.length > 0) return formatDaysShort(alarm.days);
  if (!nextAt) return formatDaysShort(alarm.days);

  if (sameCalendarDay(nextAt, now)) return "Aujourd'hui";
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (sameCalendarDay(nextAt, tomorrow)) return 'Demain';
  return formatDaysShort(alarm.days);
}

/** Ex. formatCountdown(5*3600000 + 50*60000) -> "5 h 50 min" */
export function formatCountdown(ms) {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  const parts = [];
  if (days > 0) parts.push(`${days} j`);
  if (days > 0 || hours > 0) parts.push(`${hours} h`);
  parts.push(`${minutes} min`);
  return parts.join(' ');
}
