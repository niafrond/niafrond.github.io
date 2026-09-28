import { formatDaysShort, formatClock, formatAlarmSchedule, formatCountdown } from '../../ui.js';

describe('formatDaysShort', () => {
  test('jours vides = alarme unique', () => {
    expect(formatDaysShort([])).toBe('Une fois');
  });

  test('7 jours = tous les jours', () => {
    expect(formatDaysShort([0, 1, 2, 3, 4, 5, 6])).toBe('Tous les jours');
  });

  test('lundi-vendredi = Semaine', () => {
    expect(formatDaysShort([1, 2, 3, 4, 5])).toBe('Semaine');
  });

  test('samedi-dimanche = Week-end', () => {
    expect(formatDaysShort([0, 6])).toBe('Week-end');
  });

  test('sélection libre listée dans l\'ordre L-D', () => {
    expect(formatDaysShort([3, 1])).toBe('L M');
  });
});

describe('formatClock', () => {
  test('formate HH:MM:SS avec zéros de tête', () => {
    expect(formatClock(new Date(2026, 8, 28, 7, 5, 9))).toBe('07:05:09');
  });
});

describe('formatAlarmSchedule', () => {
  const now = new Date(2026, 8, 28, 6, 0); // lundi 28/09 06:00

  test('alarme ponctuelle dont la prochaine occurrence est aujourd\'hui', () => {
    const alarm = { days: [] };
    const nextAt = new Date(2026, 8, 28, 7, 30);
    expect(formatAlarmSchedule(alarm, nextAt, now)).toBe("Aujourd'hui");
  });

  test('alarme ponctuelle dont la prochaine occurrence est demain', () => {
    const alarm = { days: [] };
    const nextAt = new Date(2026, 8, 29, 7, 30);
    expect(formatAlarmSchedule(alarm, nextAt, now)).toBe('Demain');
  });

  test('alarme ponctuelle plus lointaine ou sans occurrence connue -> repli formatDaysShort', () => {
    const alarm = { days: [] };
    expect(formatAlarmSchedule(alarm, null, now)).toBe('Une fois');
  });

  test('alarme récurrente : ignore nextAt, utilise formatDaysShort', () => {
    const alarm = { days: [1, 2, 3, 4, 5] };
    const nextAt = new Date(2026, 8, 29, 7, 30);
    expect(formatAlarmSchedule(alarm, nextAt, now)).toBe('Semaine');
  });
});

describe('formatCountdown', () => {
  test('heures et minutes', () => {
    expect(formatCountdown(5 * 3600000 + 50 * 60000)).toBe('5 h 50 min');
  });

  test('moins d\'une heure : pas de segment heures', () => {
    expect(formatCountdown(45 * 60000)).toBe('45 min');
  });

  test('au moins un jour', () => {
    expect(formatCountdown(25 * 3600000 + 10 * 60000)).toBe('1 j 1 h 10 min');
  });

  test('valeur négative ou nulle -> 0 min', () => {
    expect(formatCountdown(-500)).toBe('0 min');
  });
});
