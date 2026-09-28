import {
  minuteKey, matchesSchedule, evaluateAlarms, applySnooze, clearSnooze,
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

  test('deux alarmes qui sonnent à la même minute sont toutes les deux détectées', () => {
    const now = new Date(2026, 8, 28, 7, 30);
    const alarms = [alarm({ id: 'a1' }), alarm({ id: 'a2' })];
    const { ringing } = evaluateAlarms(alarms, now, new Map());
    expect(ringing.sort()).toEqual(['a1', 'a2']);
  });
});
