import { jest } from '@jest/globals';
import { ensurePermission, scheduleAll, cancelAll, refreshAndSchedule } from '../../notify.js';

function fakePlugin({ display = 'prompt', pending = [] } = {}) {
  const p = {
    display, pending: [...pending], scheduled: [], cancelled: [],
    checkPermissions: async () => ({ display: p.display }),
    requestPermissions: async () => { p.display = 'granted'; return { display: 'granted' }; },
    getPending: async () => ({ notifications: p.pending }),
    cancel: async ({ notifications }) => { p.cancelled.push(...notifications.map((n) => n.id)); },
    schedule: async ({ notifications }) => { p.scheduled.push(...notifications); },
  };
  return p;
}
const now = new Date(2026, 5, 10, 8, 0);
const soon = (d) => new Date(now.getTime() + d * 3600e3).toISOString();

describe('notify', () => {
  test('ensurePermission demande une fois', async () => {
    const plugin = fakePlugin();
    expect(await ensurePermission({ plugin })).toBe(true);
    expect(plugin.display).toBe('granted');
  });

  test('scheduleAll annule seulement les notifications jardin et planifie le futur', async () => {
    const plugin = fakePlugin({ pending: [{ id: 5, extra: {} }, { id: 123, extra: { source: 'jardin' } }, { id: 200000000 }] });
    const n = await scheduleAll([
      { id: 300000001, at: soon(2), title: 'a', body: 'b', zoneIds: ['z'] },
      { id: 300000002, at: soon(-2), title: 'passé', body: '' },
    ], { plugin, now });
    expect(n).toBe(1);
    expect(plugin.cancelled.sort()).toEqual([123, 200000000]);
    expect(plugin.scheduled).toHaveLength(1);
    expect(plugin.scheduled[0].extra.source).toBe('jardin');
    expect(plugin.scheduled[0].schedule.at).toBeInstanceOf(Date);
  });

  test('cancelAll sans plugin ni Notification : no-op', async () => {
    await expect(cancelAll({})).resolves.toBeUndefined();
    expect(await scheduleAll([{ id: 1, at: soon(1), title: 't', body: 'b' }], { now })).toBe(0);
  });

  test('repli web : Notification accordée → minuterie', async () => {
    jest.useFakeTimers();
    const shown = [];
    globalThis.Notification = class { constructor(t, o) { shown.push([t, o.body]); } };
    globalThis.Notification.permission = 'granted';
    expect(await scheduleAll([{ id: 400000001, at: soon(1), title: 'Titre', body: 'Corps' }], { now })).toBe(1);
    jest.advanceTimersByTime(3600e3 + 10);
    expect(shown).toEqual([['Titre', 'Corps']]);
    await cancelAll({});
    delete globalThis.Notification;
    jest.useRealTimers();
  });

  test('refreshAndSchedule : météo → plan → planification', async () => {
    const plugin = fakePlugin({ display: 'granted' });
    const garden = {
      context: { location: { lat: 45, lon: 3 }, soil: null },
      zones: [{ id: 'z1', type: 'lawn', label: 'pelouse', shape: { kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] }, plantings: [] }],
    };
    const days = Array.from({ length: 10 }, (_, i) => `2026-06-${String(7 + i).padStart(2, '0')}`);
    const body = { daily: { time: days, precipitation_sum: days.map(() => 0), et0_fao_evapotranspiration: days.map(() => 5), temperature_2m_min: days.map(() => 12), temperature_2m_max: days.map(() => 27) } };
    const mem = new Map();
    const r = await refreshAndSchedule(garden, { notifications: { enabled: true, hour: 19, minute: 0 } }, {
      plugin, now, plantsById: {}, fetchImpl: async () => ({ ok: true, json: async () => body }),
      cache: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) },
    });
    expect(r.permission).toBe(true);
    expect(r.plan.withoutWeather).toBe(false);
    expect(r.scheduled).toBeGreaterThan(0);
    expect(plugin.scheduled.length).toBe(r.scheduled);
  });

  test('refreshAndSchedule : désactivé → annule tout', async () => {
    const plugin = fakePlugin({ display: 'granted', pending: [{ id: 300000009, extra: { source: 'jardin' } }] });
    const r = await refreshAndSchedule({ context: {}, zones: [] }, { notifications: { enabled: false } }, { plugin, now, plantsById: {} });
    expect(r.scheduled).toBe(0);
    expect(plugin.cancelled).toEqual([300000009]);
  });

  test('refreshAndSchedule : hors ligne → repli calendaire', async () => {
    const plugin = fakePlugin({ display: 'granted' });
    const garden = { context: { location: { lat: 45, lon: 3 } }, zones: [{ id: 'z1', type: 'vegetable', label: 'potager', shape: { kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 5 }] }, plantings: [] }] };
    const r = await refreshAndSchedule(garden, { notifications: { enabled: true } }, {
      plugin, now, plantsById: {}, fetchImpl: async () => { throw new Error('off'); }, cache: { getItem: () => null, setItem() {} },
    });
    expect(r.plan.withoutWeather).toBe(true);
    expect(r.plan.notifications.length).toBeGreaterThan(0);
    expect(r.plan.notifications[0].body).toContain('estimation sans météo');
  });
});
