import { createAlarm, clampProblemsCount, DIFFICULTIES } from '../../alarms.js';
import { SOUND_PRESETS, DEFAULT_SOUND_ID } from '../../sound.js';

describe('createAlarm', () => {
  test('retient la sonnerie demandée quand elle existe', () => {
    const alarm = createAlarm({ time: '07:00', sound: 'siren' });
    expect(alarm.sound).toBe('siren');
  });

  test('retombe sur la sonnerie par défaut si absente ou inconnue', () => {
    expect(createAlarm({ time: '07:00' }).sound).toBe(DEFAULT_SOUND_ID);
    expect(createAlarm({ time: '07:00', sound: 'nope' }).sound).toBe(DEFAULT_SOUND_ID);
  });

  test('accepte chacune des sonneries proposées dans sound.js', () => {
    for (const { id } of SOUND_PRESETS) {
      expect(createAlarm({ time: '07:00', sound: id }).sound).toBe(id);
    }
  });

  test('retombe sur veryEasy pour une difficulté inconnue', () => {
    expect(createAlarm({ time: '07:00', difficulty: 'nope' }).difficulty).toBe('veryEasy');
  });

  test('accepte chacune des difficultés déclarées', () => {
    for (const difficulty of DIFFICULTIES) {
      expect(createAlarm({ time: '07:00', difficulty }).difficulty).toBe(difficulty);
    }
  });
});

describe('clampProblemsCount', () => {
  test('borne entre 1 et 10', () => {
    expect(clampProblemsCount(0)).toBe(1);
    expect(clampProblemsCount(-5)).toBe(1);
    expect(clampProblemsCount(42)).toBe(10);
  });

  test('arrondit et retombe sur la valeur par défaut si non numérique', () => {
    expect(clampProblemsCount(3.6)).toBe(4);
    expect(clampProblemsCount('nope')).toBe(3);
  });
});
