import { formatDaysShort, formatClock } from '../../ui.js';

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
