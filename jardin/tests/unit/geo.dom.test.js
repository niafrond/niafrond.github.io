import { jest } from '@jest/globals';
import { averageSamples, getPosition, magneticDeclination, reverseCommune, searchAddress, fetchElevation, watchHeading } from '../../geo.js';

const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const ko = { ok: false, status: 500, json: async () => ({}) };

afterEach(() => { delete globalThis.Capacitor; });

describe('geo', () => {
  test('averageSamples pondère par la précision', () => {
    const r = averageSamples([{ lat: 10, lon: 10, accuracy: 1 }, { lat: 20, lon: 20, accuracy: 100 }]);
    expect(r.lat).toBeCloseTo(10, 1);
    expect(r.accuracy).toBeLessThanOrEqual(1);
  });

  test('getPosition via plugin Capacitor, moyenne des échantillons', async () => {
    let i = 0;
    globalThis.Capacitor = { Plugins: { Geolocation: { getCurrentPosition: async () => ({ coords: { latitude: 45 + (i++) * 0.0001, longitude: 3, accuracy: 5 } }) } } };
    const p = await getPosition({ samples: 3, sampleDelayMs: 0 });
    expect(p.lat).toBeCloseTo(45.0001, 4);
    expect(p.lon).toBe(3);
    expect(p.accuracy).toBeLessThan(5);
  });

  test('getPosition : refus → erreur "denied"', async () => {
    Object.defineProperty(globalThis.navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (_ok, ko2) => ko2({ code: 1 }) } });
    await expect(getPosition({ samples: 2, sampleDelayMs: 0 })).rejects.toMatchObject({ code: 'denied' });
  });

  test('magneticDeclination plausible en France', () => {
    const d = new Date('2026-01-01');
    expect(magneticDeclination(48.85, 2.35, d)).toBeGreaterThan(0);
    expect(magneticDeclination(48.4, -4.5, d)).toBeLessThan(magneticDeclination(48.6, 7.75, d));
  });

  test('reverseCommune', async () => {
    const f = jest.fn(async () => ok([{ nom: 'Nantes', code: '44109', codeDepartement: '44', codeRegion: '52', region: { code: '52', nom: 'Pays de la Loire' } }]));
    const r = await reverseCommune(47.2, -1.55, { fetchImpl: f });
    expect(r).toEqual({ commune: 'Nantes', departement: '44', region: 'Pays de la Loire', codeInsee: '44109' });
    expect(f.mock.calls[0][0]).toContain('geo.api.gouv.fr/communes?lat=47.2&lon=-1.55');
    expect(await reverseCommune(0, 0, { fetchImpl: async () => ok([]) })).toBeNull();
    await expect(reverseCommune(0, 0, { fetchImpl: async () => ko })).rejects.toThrow();
  });

  test('searchAddress', async () => {
    const f = jest.fn(async () => ok({ features: [{ geometry: { coordinates: [2.35, 48.85] }, properties: { label: '1 rue X 75001 Paris' } }] }));
    const r = await searchAddress('1 rue X', { fetchImpl: f });
    expect(r).toEqual([{ label: '1 rue X 75001 Paris', lat: 48.85, lon: 2.35 }]);
    expect(f.mock.calls[0][0]).toContain('data.geopf.fr/geocodage/search?q=1%20rue%20X&limit=5');
    expect(await searchAddress(' ', { fetchImpl: f })).toEqual([]);
  });

  test('fetchElevation : IGN puis repli Open-Meteo puis null', async () => {
    expect(await fetchElevation(45, 3, { fetchImpl: async () => ok({ elevations: [412.3] }) })).toBe(412.3);
    const f = jest.fn(async (url) => (url.includes('geopf') ? ok({ elevations: [-99999] }) : ok({ elevation: [150] })));
    expect(await fetchElevation(45, 3, { fetchImpl: f })).toBe(150);
    expect(await fetchElevation(45, 3, { fetchImpl: async () => ko })).toBeNull();
  });

  test('watchHeading : cap absolu corrigé et arrêt', () => {
    const t = new EventTarget();
    const seen = [];
    const stop = watchHeading((h) => seen.push(h), { target: t });
    const e = new Event('deviceorientationabsolute'); e.alpha = 90; e.absolute = true;
    t.dispatchEvent(e);
    expect(seen[0]).toBe(270);
    stop();
    t.dispatchEvent(e);
    expect(seen).toHaveLength(1);
  });
});
