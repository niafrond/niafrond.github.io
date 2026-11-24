import { parseOpenMeteo, fetchForecast, weatherUrl, cacheKey } from '../../weather.js';

const json = {
  daily: {
    time: ['2026-06-01', '2026-06-02'],
    precipitation_sum: [0, 4.2],
    et0_fao_evapotranspiration: [4.1, null],
    temperature_2m_min: [11, 12],
    temperature_2m_max: [24, 36],
  },
};
const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

describe('weather', () => {
  test('parseOpenMeteo', () => {
    const d = parseOpenMeteo(json);
    expect(d).toEqual([
      { date: '2026-06-01', precipMm: 0, et0Mm: 4.1, tminC: 11, tmaxC: 24 },
      { date: '2026-06-02', precipMm: 4.2, et0Mm: null, tminC: 12, tmaxC: 36 },
    ]);
    expect(() => parseOpenMeteo({})).toThrow();
  });

  test('URL : coordonnées arrondies, past_days et forecast_days', () => {
    const u = weatherUrl(48.85661, 2.35222, 7);
    expect(u).toContain('latitude=48.857&longitude=2.352');
    expect(u).toContain('forecast_days=7');
    expect(u).toContain('past_days=3');
    expect(u).toContain('timezone=auto');
    expect(u).toContain('et0_fao_evapotranspiration');
  });

  test('fetchForecast : réseau puis cache frais sans second appel', async () => {
    const cache = mem();
    const f = jest.fn(async () => ok(json));
    const now = Date.parse('2026-06-01T10:00:00Z');
    const r1 = await fetchForecast({ lat: 48.8, lon: 2.3 }, { fetchImpl: f, cache, now });
    expect(r1.stale).toBe(false);
    expect(r1.daily).toHaveLength(2);
    const r2 = await fetchForecast({ lat: 48.8, lon: 2.3 }, { fetchImpl: f, cache, now: now + 60000 });
    expect(f).toHaveBeenCalledTimes(1);
    expect(r2.stale).toBe(false);
  });

  test('fetchForecast : repli sur cache périmé en cas d’échec', async () => {
    const cache = mem();
    const now = Date.parse('2026-06-01T10:00:00Z');
    await fetchForecast({ lat: 1, lon: 2 }, { fetchImpl: async () => ok(json), cache, now });
    const r = await fetchForecast({ lat: 1, lon: 2 }, { fetchImpl: async () => { throw new Error('hors ligne'); }, cache, now: now + 3 * 3600e3 });
    expect(r.stale).toBe(true);
    expect(r.daily).toHaveLength(2);
  });

  test('fetchForecast : erreur HTTP sans cache → exception', async () => {
    await expect(fetchForecast({ lat: 9, lon: 9 }, { fetchImpl: async () => ({ ok: false, status: 500 }), cache: mem() })).rejects.toThrow();
  });

  test('cache par défaut = localStorage', async () => {
    localStorage.clear();
    await fetchForecast({ lat: 3, lon: 4 }, { fetchImpl: async () => ok(json) });
    expect(localStorage.getItem(cacheKey(3, 4))).toBeTruthy();
  });
});
