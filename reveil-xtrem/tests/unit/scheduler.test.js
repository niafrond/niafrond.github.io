import {
  minuteKey, matchesSchedule, evaluateAlarms, applySnooze, clearSnooze,
  nextOccurrence, getNextAlarmOccurrence,
} from '../../scheduler.js';

function alarm(overrides = {}) {
  return {
    id: 'a1',
    time: '07:30',
    days: [],
    enabled: true,
    skipNext: false,
    ...overrides,
  };
}

describe('matchesSchedule', () => {
  test('GIVEN une alarme ponctuelle (days vide) — WHEN l\'heure correspond — THEN elle matche quel que soit le jour', () => {
    const a = alarm({ time: '07:30', days: [] });
    expect(matchesSchedule(a, new Date(2026, 8, 28, 7, 30))).toBe(true); // lundi
    expect(matchesSchedule(a, new Date(2026, 8, 29, 7, 30))).toBe(true); // mardi
  });

  test('GIVEN une alarme récurrente — WHEN le jour n\'est pas listé — THEN elle ne matche pas', () => {
    const a = alarm({ time: '07:30', days: [1, 2, 3, 4, 5] }); // lun-ven
    const sunday = new Date(2026, 8, 27, 7, 30); // dimanche
    expect(matchesSchedule(a, sunday)).toBe(false);
    const monday = new Date(2026, 8, 28, 7, 30);
    expect(matchesSchedule(a, monday)).toBe(true);
  });

  test('l\'heure doit correspondre exactement à la minute', () => {
    const a = alarm({ time: '07:30', days: [] });
    expect(matchesSchedule(a, new Date(2026, 8, 28, 7, 31))).toBe(false);
    expect(matchesSchedule(a, new Date(2026, 8, 28, 8, 30))).toBe(false);
  });
});

describe('evaluateAlarms', () => {
  test('GIVEN une alarme activée dont l\'heure matche — WHEN evaluateAlarms tourne — THEN elle sonne', () => {
    const now = new Date(2026, 8, 28, 7, 30);
    const alarms = [alarm()];
    const { ringing, nextRuntime } = evaluateAlarms(alarms, now, new Map());
    expect(ringing).toEqual(['a1']);
    expect(nextRuntime.get('a1').lastFiredKey).toBe(minuteKey(now));
  });

  test('une alarme désactivée ne sonne jamais', () => {
    const now = new Date(2026, 8, 28, 7, 30);
    const alarms = [alarm({ enabled: false })];
    const { ringing } = evaluateAlarms(alarms, now, new Map());
    expect(ringing).toEqual([]);
  });

  test('une alarme ne sonne qu\'une fois par minute même si evaluateAlarms est rappelé dans la même minute', () => {
    const now = new Date(2026, 8, 28, 7, 30, 5);
    const alarms = [alarm()];
    const first = evaluateAlarms(alarms, now, new Map());
    expect(first.ringing).toEqual(['a1']);

    const later = new Date(2026, 8, 28, 7, 30, 45);
    const second = evaluateAlarms(alarms, later, first.nextRuntime);
    expect(second.ringing).toEqual([]);
  });

  test('GIVEN skipNext=true — WHEN l\'heure matche — THEN elle ne sonne pas et est listée dans skipConsumed', () => {
    const now = new Date(2026, 8, 28, 7, 30);
    const alarms = [alarm({ skipNext: true })];
    const { ringing, skipConsumed } = evaluateAlarms(alarms, now, new Map());
    expect(ringing).toEqual([]);
    expect(skipConsumed).toEqual(['a1']);
  });

  test('GIVEN une alarme snoozée — WHEN l\'heure de snooze est atteinte — THEN elle resonne', () => {
    const now = new Date(2026, 8, 28, 7, 40, 0);
    let runtime = applySnooze(new Map(), 'a1', new Date(2026, 8, 28, 7, 30), 9); // snoozeUntil = 7:39
    const alarms = [alarm()];
    const { ringing, nextRuntime } = evaluateAlarms(alarms, now, runtime);
    expect(ringing).toEqual(['a1']);
    expect(nextRuntime.get('a1').snoozeUntil).toBeNull();
  });

  test('GIVEN une alarme snoozée — WHEN elle resonne — THEN snoozeCount déjà accumulé est conservé (pas remis à zéro)', () => {
    // Régression : evaluateAlarms reconstruisait l'entrée runtime sans
    // repartir de `rt`, perdant snoozeCount à chaque réveil d'un snooze.
    const now = new Date(2026, 8, 28, 7, 40, 0);
    const runtime = applySnooze(new Map(), 'a1', new Date(2026, 8, 28, 7, 30), 9); // snoozeCount: 1
    const alarms = [alarm()];
    const { nextRuntime } = evaluateAlarms(alarms, now, runtime);
    expect(nextRuntime.get('a1').snoozeCount).toBe(1);
  });

  test('GIVEN une alarme snoozée — WHEN l\'heure de snooze n\'est pas encore atteinte — THEN elle ne sonne pas', () => {
    const now = new Date(2026, 8, 28, 7, 32, 0);
    const runtime = applySnooze(new Map(), 'a1', new Date(2026, 8, 28, 7, 30), 9); // snoozeUntil = 7:39
    const alarms = [alarm()];
    const { ringing } = evaluateAlarms(alarms, now, runtime);
    expect(ringing).toEqual([]);
  });

  test('clearSnooze annule un snooze programmé', () => {
    const runtime = applySnooze(new Map(), 'a1', new Date(2026, 8, 28, 7, 30), 9);
    const cleared = clearSnooze(runtime, 'a1');
    expect(cleared.get('a1').snoozeUntil).toBeNull();
  });

  test('applySnooze incrémente snoozeCount à chaque rappel', () => {
    let runtime = applySnooze(new Map(), 'a1', new Date(2026, 8, 28, 7, 30), 9);
    expect(runtime.get('a1').snoozeCount).toBe(1);
    runtime = applySnooze(runtime, 'a1', new Date(2026, 8, 28, 7, 39), 9);
    expect(runtime.get('a1').snoozeCount).toBe(2);
  });

  test('clearSnooze remet snoozeCount à zéro', () => {
    const runtime = applySnooze(new Map(), 'a1', new Date(2026, 8, 28, 7, 30), 9);
    const cleared = clearSnooze(runtime, 'a1');
    expect(cleared.get('a1').snoozeCount).toBe(0);
  });

  test('deux alarmes qui sonnent à la même minute sont toutes les deux détectées', () => {
    const now = new Date(2026, 8, 28, 7, 30);
    const alarms = [alarm({ id: 'a1' }), alarm({ id: 'a2' })];
    const { ringing } = evaluateAlarms(alarms, now, new Map());
    expect(ringing.sort()).toEqual(['a1', 'a2']);
  });
});

describe('nextOccurrence', () => {
  test('alarme ponctuelle dont l\'heure n\'est pas encore passée aujourd\'hui', () => {
    const now = new Date(2026, 8, 28, 6, 0); // lundi 06:00
    const a = alarm({ time: '07:30', days: [] });
    const next = nextOccurrence(a, now);
    expect(next.toISOString().slice(0, 16)).toBe(new Date(2026, 8, 28, 7, 30).toISOString().slice(0, 16));
  });

  test('alarme ponctuelle dont l\'heure est déjà passée aujourd\'hui -> demain', () => {
    const now = new Date(2026, 8, 28, 8, 0); // lundi 08:00, alarme à 07:30 déjà passée
    const a = alarm({ time: '07:30', days: [] });
    const next = nextOccurrence(a, now);
    expect(next.getDate()).toBe(29); // mardi
  });

  test('l\'occurrence est strictement future : à l\'instant pile, on saute au jour suivant valide', () => {
    const now = new Date(2026, 8, 28, 7, 30, 0); // lundi 07:30:00 pile
    const a = alarm({ time: '07:30', days: [] });
    const next = nextOccurrence(a, now);
    expect(next.getTime()).toBeGreaterThan(now.getTime());
    expect(next.getDate()).toBe(29);
  });

  test('alarme récurrente : trouve le prochain jour listé', () => {
    const now = new Date(2026, 8, 28, 10, 0); // lundi 10:00
    const a = alarm({ time: '07:30', days: [3, 5] }); // mercredi, vendredi
    const next = nextOccurrence(a, now);
    expect(next.getDay()).toBe(3);
    expect(next.getDate()).toBe(30); // mercredi 30 septembre
  });
});

describe('getNextAlarmOccurrence', () => {
  test('choisit l\'alarme activée dont l\'occurrence est la plus proche', () => {
    const now = new Date(2026, 8, 28, 6, 0);
    const alarms = [
      alarm({ id: 'late', time: '09:00', days: [] }),
      alarm({ id: 'soon', time: '07:00', days: [] }),
    ];
    const result = getNextAlarmOccurrence(alarms, now);
    expect(result.alarm.id).toBe('soon');
  });

  test('ignore les alarmes désactivées', () => {
    const now = new Date(2026, 8, 28, 6, 0);
    const alarms = [alarm({ id: 'off', time: '07:00', enabled: false, days: [] })];
    expect(getNextAlarmOccurrence(alarms, now)).toBeNull();
  });

  test('un snooze en cours prime sur l\'horaire normal, même s\'il est plus proche', () => {
    const now = new Date(2026, 8, 28, 6, 0);
    const alarms = [alarm({ id: 'a1', time: '09:00', days: [] })];
    const runtime = applySnooze(new Map(), 'a1', now, 5); // snoozeUntil = 06:05
    const result = getNextAlarmOccurrence(alarms, now, runtime);
    expect(result.at.getTime()).toBe(now.getTime() + 5 * 60000);
  });

  test('skipNext décale la prochaine occurrence affichée à celle d\'après', () => {
    const now = new Date(2026, 8, 28, 6, 0);
    const alarms = [alarm({ id: 'a1', time: '07:00', days: [1, 2, 3, 4, 5], skipNext: true })];
    const result = getNextAlarmOccurrence(alarms, now);
    // sautée lundi 7h -> prochaine réelle mardi 7h
    expect(result.at.getDate()).toBe(29);
  });
});
