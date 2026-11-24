import { hydrozones, waterNeed, planWatering, monthlySchedule, zoneProfile } from '../../watering.js';

const sq = (s, x = 0) => ({ kind: 'polygon', points: [{ x, y: 0 }, { x: x + s, y: 0 }, { x: x + s, y: s }, { x, y: s }] });
const plantsById = {
  lav: { id: 'lav', commonName: 'Lavande', category: 'perennial', water: 'low', kc: 0.4, hardiness: -12 },
  hyd: { id: 'hyd', commonName: 'Hortensia', category: 'shrub', water: 'high', kc: 0.9, hardiness: -15 },
  oli: { id: 'oli', commonName: 'Olivier', category: 'tree', water: 'low', kc: 0.5, hardiness: -3 },
};
const garden = () => ({
  context: { soil: 'loam' },
  sun: { mode: 'unknown', uniform: null, regions: [] },
  zones: [
    { id: 'a', type: 'midplants', label: 'massif sud', shape: sq(5), plantings: [{ plantId: 'hyd', count: 4 }] }, // 25 m²
    { id: 'b', type: 'midplants', label: 'rocaille', shape: sq(2, 10), plantings: [{ plantId: 'lav', count: 3 }, { plantId: 'oli', count: 1 }] },
    { id: 'c', type: 'terrace', label: 'terrasse', shape: sq(3, 20), plantings: [] },
    { id: 'd', type: 'lawn', label: 'pelouse', shape: sq(4, 30), plantings: [] },
  ],
});
const day = (date, o = {}) => ({ date, precipMm: 0, et0Mm: 5, tminC: 12, tmaxC: 28, ...o });
const dates = (from, n) => Array.from({ length: n }, (_, i) => { const d = new Date(Date.UTC(2026, 5, from + i)); return d.toISOString().slice(0, 10); });
const forecast = (over = {}, n = 10, from = 7) => ({ daily: dates(from, n).map((d) => day(d, over[d] || over.all || {})) });
const now = new Date(2026, 5, 10, 8, 0); // 10 juin 2026 8h
const settings = { notifications: { enabled: true, hour: 19, minute: 0, frost: true, heat: true, vacationUntil: null } };
const plan = (f, state = {}, s = settings, g = garden()) => planWatering(g, f, state, now, s, { plantsById });

describe('hydrozones / profils', () => {
  test('exclut terrasse, regroupe par niveau', () => {
    const hz = hydrozones(garden(), plantsById);
    expect(hz.map((h) => h.level)).toEqual(['low', 'medium', 'high']);
    expect(hz.find((h) => h.level === 'high')).toMatchObject({ zoneIds: ['a'], areaM2: 25 });
    expect(hz.find((h) => h.level === 'medium').zoneIds).toEqual(['d']);
    expect(hz.find((h) => h.level === 'low').avgKc).toBeCloseTo(0.425, 2);
  });

  test('zoneProfile : défaut par type de zone', () => {
    expect(zoneProfile({ type: 'lawn', plantings: [] }, plantsById)).toMatchObject({ level: 'medium' });
    expect(zoneProfile({ type: 'pond', plantings: [] }, plantsById)).toBeNull();
  });

  test('waterNeed = ET₀ × kc × surface', () => {
    const z = garden().zones[0];
    expect(waterNeed(z, garden(), '2026-06-10', { plantsById, et0Mm: 4 })).toBeCloseTo(4 * 0.9 * 25, 5);
    expect(waterNeed(garden().zones[2], garden(), '2026-06-10', { plantsById })).toBe(0);
  });
});

describe('planWatering', () => {
  test('beau temps : une seule notification groupée par jour, jamais deux jours de suite', () => {
    const p = plan(forecast());
    expect(p.withoutWeather).toBe(false);
    expect(p.notifications.length).toBeGreaterThan(0);
    const days = p.notifications.map((n) => n.at.slice(0, 10));
    expect(new Set(days).size).toBe(days.length);
    const ids = p.notifications.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (let i = 1; i < p.notifications.length; i++) {
      // jamais le même jour calendaire consécutif pour une zone : ici le massif (zone a)
    }
    const aDays = p.notifications.filter((n) => n.zoneIds.includes('a')).map((n) => Date.parse(n.at));
    for (let i = 1; i < aDays.length; i++) expect(aDays[i] - aDays[i - 1]).toBeGreaterThan(36 * 3600e3);
    const n0 = p.notifications[0];
    expect(n0.title).toBe('Arrosage du jour');
    expect(n0.body).toMatch(/Arroser .* ce soir \(≈ \d+ L\)/);
    expect(new Date(n0.at).getHours()).toBe(19);
  });

  test('pluie ≥ 5 mm le jour même : pas d’arrosage ce jour-là', () => {
    const base = plan(forecast());
    const firstDay = base.notifications[0].at.slice(0, 10);
    const rainy = plan(forecast({ [firstDay]: { precipMm: 6 } }));
    expect(rainy.notifications.map((n) => n.at.slice(0, 10))).not.toContain(firstDay);
  });

  test('pluie ≥ 5 mm prévue le lendemain : report', () => {
    const base = plan(forecast());
    const d = base.notifications[0].at.slice(0, 10);
    const next = new Date(Date.parse(`${d}T12:00:00Z`) + 86400e3).toISOString().slice(0, 10);
    const p = plan(forecast({ [next]: { precipMm: 8 } }));
    expect(p.notifications.map((n) => n.at.slice(0, 10))).not.toContain(d);
    expect(p.skipped.some((s) => s.date === d && /24 h/.test(s.reason))).toBe(true);
  });

  test('pluie efficace : 80 % sous 10 mm, 60 % au-dessus (déficit réduit)', () => {
    // 4 mm de pluie ne dépasse pas le seuil de 5 mm mais réduit le déficit
    const dry = plan(forecast({}, 4, 8));
    const wet = plan(forecast({ all: { precipMm: 4 } }, 4, 8));
    const sum = (p) => p.summary.reduce((a, s) => a + s.litersPerWeek, 0);
    expect(sum(wet)).toBeLessThan(sum(dry));
  });

  test('gel : alerte la veille si plantes frileuses (hardiness > −5)', () => {
    const f = forecast({ '2026-06-13': { tminC: 1 } });
    const p = plan(f);
    const n = p.notifications.find((x) => x.kinds.includes('frost'));
    expect(n).toBeDefined();
    expect(n.at.slice(0, 10)).toBe(new Date(2026, 5, 12, 19).toISOString().slice(0, 10));
    expect(n.body).toContain('Olivier');
    // sans plante frileuse : pas d'alerte
    const g = garden(); g.zones[1].plantings = [{ plantId: 'lav', count: 1 }];
    expect(plan(f, {}, settings, g).notifications.some((x) => x.kinds.includes('frost'))).toBe(false);
    // frost désactivé
    expect(plan(f, {}, { notifications: { ...settings.notifications, frost: false } }).notifications.some((x) => x.kinds.includes('frost'))).toBe(false);
  });

  test('canicule : alerte la veille et arrosage possible deux jours de suite', () => {
    const f = forecast({ all: { tmaxC: 37 } });
    const p = plan(f);
    expect(p.notifications.some((x) => x.kinds.includes('heat'))).toBe(true);
    const wDays = p.notifications.filter((n) => n.kinds.includes('water')).map((n) => n.at.slice(0, 10));
    const consecutive = wDays.some((d, i) => i > 0 && Date.parse(d) - Date.parse(wDays[i - 1]) <= 86400e3 + 1);
    expect(consecutive).toBe(true);
  });

  test('mode vacances et notifications désactivées', () => {
    const v = plan(forecast(), {}, { notifications: { ...settings.notifications, vacationUntil: '2026-06-14' } });
    expect(v.notifications.every((n) => n.at.slice(0, 10) > '2026-06-14')).toBe(true);
    expect(v.skipped.some((s) => s.reason === 'Mode vacances')).toBe(true);
    const off = plan(forecast(), {}, { notifications: { ...settings.notifications, enabled: false } });
    expect(off.notifications).toEqual([]);
    expect(off.summary.length).toBe(3);
  });

  test('« Fait » (lastWatered) repart de zéro ; heure passée aujourd’hui sautée', () => {
    const late = planWatering(garden(), forecast(), {}, new Date(2026, 5, 10, 21, 0), settings, { plantsById });
    expect(late.notifications.every((n) => n.at.slice(0, 10) !== new Date(2026, 5, 10, 19).toISOString().slice(0, 10))).toBe(true);
    const done = plan(forecast(), { lastWatered: { a: '2026-06-10', b: '2026-06-10', d: '2026-06-10' } });
    const first = plan(forecast());
    expect(Date.parse(done.notifications[0].at)).toBeGreaterThan(Date.parse(first.notifications[0].at));
  });

  test('summary : litres par semaine par zone', () => {
    const p = plan(forecast());
    const a = p.summary.find((s) => s.zoneId === 'a');
    // ≈ 5 × 0,9 × 25 × 7 = 787 L
    expect(a.litersPerWeek).toBeGreaterThan(600);
    expect(a.litersPerWeek).toBeLessThan(900);
  });

  test('repli calendaire sans météo', () => {
    const p = plan(null);
    expect(p.withoutWeather).toBe(true);
    expect(p.notifications.length).toBeGreaterThan(0);
    expect(p.notifications.every((n) => n.body.includes('estimation sans météo'))).toBe(true);
    expect(p.summary.length).toBe(3);
  });
});

describe('monthlySchedule', () => {
  test('12 mois, plus d’eau en été qu’en hiver', () => {
    const s = monthlySchedule(garden(), { plantsById, year: 2026 });
    expect(s).toHaveLength(12);
    const a = (m) => s[m - 1].zones.find((z) => z.zoneId === 'a');
    expect(a(1).litersPerWeek).toBe(0);
    expect(a(7).litersPerWeek).toBeGreaterThan(200);
    expect(a(7).intervalDays).toBeGreaterThan(0);
    expect(a(7).intervalDays).toBeLessThanOrEqual(7);
  });
});
