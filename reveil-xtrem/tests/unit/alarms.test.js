import { createAlarm, clampProblemsCount, DIFFICULTIES } from '../../alarms.js';
import { SOUND_PRESETS, DEFAULT_SOUND_ID } from '../../sound.js';

describe('createAlarm', () => {
  test('retient la sonnerie demandée (id web ou URI native)', () => {
    expect(createAlarm({ time: '07:00', sound: 'siren' }).sound).toBe('siren');
    // Une alarme native stocke l'URI choisie via le sélecteur système Android
    // (RingtoneManager) — toute chaîne est donc acceptée, pas seulement les
    // ids de sonnerie web connus. Voir native-bridge.js#nativePickRingtone.
    expect(createAlarm({ time: '07:00', sound: 'content://media/internal/audio/media/17' }).sound)
      .toBe('content://media/internal/audio/media/17');
    // '' = sonnerie par défaut du système (choix explicite côté natif), à
    // distinguer d'une valeur absente : elle est conservée telle quelle.
    expect(createAlarm({ time: '07:00', sound: '' }).sound).toBe('');
  });

  test('retombe sur la sonnerie par défaut si le champ est absent', () => {
    expect(createAlarm({ time: '07:00' }).sound).toBe(DEFAULT_SOUND_ID);
    expect(createAlarm({ time: '07:00', sound: undefined }).sound).toBe(DEFAULT_SOUND_ID);
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
