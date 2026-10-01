import {
  createAlarm, clampProblemsCount, DIFFICULTIES,
  clampSnoozeLimit, clampSnoozeDecreaseMinutes, clampAutoDismissMinutes,
  effectiveSnoozeMinutes, canSnoozeAgain,
} from '../../alarms.js';
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

  test('réglages de rappel par défaut : illimité, sans réduction, sans arrêt auto', () => {
    const alarm = createAlarm({ time: '07:00' });
    expect(alarm.snoozeLimit).toBe(0);
    expect(alarm.snoozeDecreaseMinutes).toBe(0);
    expect(alarm.autoDismissMinutes).toBe(0);
  });

  test('retient les réglages de rappel demandés', () => {
    const alarm = createAlarm({ time: '07:00', snoozeLimit: 3, snoozeDecreaseMinutes: 2, autoDismissMinutes: 5 });
    expect(alarm.snoozeLimit).toBe(3);
    expect(alarm.snoozeDecreaseMinutes).toBe(2);
    expect(alarm.autoDismissMinutes).toBe(5);
  });
});

describe('clampSnoozeLimit', () => {
  test('borne entre 0 (illimité) et 10', () => {
    expect(clampSnoozeLimit(-5)).toBe(0);
    expect(clampSnoozeLimit(42)).toBe(10);
    expect(clampSnoozeLimit(3)).toBe(3);
  });

  test('retombe sur 0 (illimité) si non numérique', () => {
    expect(clampSnoozeLimit('nope')).toBe(0);
  });
});

describe('clampSnoozeDecreaseMinutes', () => {
  test('borne entre 0 et 15', () => {
    expect(clampSnoozeDecreaseMinutes(-5)).toBe(0);
    expect(clampSnoozeDecreaseMinutes(42)).toBe(15);
  });
});

describe('clampAutoDismissMinutes', () => {
  test('borne entre 0 (jamais) et 30', () => {
    expect(clampAutoDismissMinutes(-5)).toBe(0);
    expect(clampAutoDismissMinutes(99)).toBe(30);
  });
});

describe('effectiveSnoozeMinutes', () => {
  test('sans réduction réglée, l\'intervalle reste constant à chaque rappel', () => {
    const alarm = { snoozeMinutes: 10, snoozeDecreaseMinutes: 0 };
    expect(effectiveSnoozeMinutes(alarm, 0)).toBe(10);
    expect(effectiveSnoozeMinutes(alarm, 3)).toBe(10);
  });

  test('avec réduction réglée, l\'intervalle diminue à chaque rappel déjà utilisé', () => {
    const alarm = { snoozeMinutes: 10, snoozeDecreaseMinutes: 2 };
    expect(effectiveSnoozeMinutes(alarm, 0)).toBe(10); // 1er rappel
    expect(effectiveSnoozeMinutes(alarm, 1)).toBe(8); // 2e rappel
    expect(effectiveSnoozeMinutes(alarm, 2)).toBe(6); // 3e rappel
  });

  test('ne descend jamais sous 1 minute même avec une forte réduction cumulée', () => {
    const alarm = { snoozeMinutes: 10, snoozeDecreaseMinutes: 4 };
    expect(effectiveSnoozeMinutes(alarm, 5)).toBe(1);
  });
});

describe('canSnoozeAgain', () => {
  test('illimité (0) : toujours autorisé', () => {
    const alarm = { snoozeLimit: 0 };
    expect(canSnoozeAgain(alarm, 0)).toBe(true);
    expect(canSnoozeAgain(alarm, 50)).toBe(true);
  });

  test('limité : autorisé tant que le quota n\'est pas atteint', () => {
    const alarm = { snoozeLimit: 2 };
    expect(canSnoozeAgain(alarm, 0)).toBe(true);
    expect(canSnoozeAgain(alarm, 1)).toBe(true);
    expect(canSnoozeAgain(alarm, 2)).toBe(false);
    expect(canSnoozeAgain(alarm, 3)).toBe(false);
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
