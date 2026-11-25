import { sunPosition, sunHoursOnPoint, estimateSunMap, levelFromHours, zoneSunLevel } from '../../sun.js';
import { createGarden, createZone } from '../../model.js';
import { pointInPolygon } from '../../geometry.js';

const carre = (x, y, s) => [{ x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }];
const PARIS = { lat: 48.85, lon: 2.35 };

describe('sunPosition', () => {
  test('midi solaire au solstice d’été en France : sud, élévation ≈ 90−lat+23,4', () => {
    // Midi solaire à Paris le 21 juin ≈ 11 h 52 UTC ; on balaie et on prend le maximum.
    let best = { elevation: -90 };
    let tBest = 0;
    for (let m = 10 * 60; m <= 14 * 60; m++) {
      const t = Date.UTC(2026, 5, 21, 0, m);
      const s = sunPosition(PARIS.lat, PARIS.lon, new Date(t));
      if (s.elevation > best.elevation) { best = s; tBest = t; }
    }
    expect(best.elevation).toBeGreaterThan(90 - PARIS.lat + 23.4 - 0.5);
    expect(best.elevation).toBeLessThan(90 - PARIS.lat + 23.5 + 0.2);
    expect(Math.abs(best.azimuth - 180)).toBeLessThan(1);
    const h = new Date(tBest).getUTCHours() + new Date(tBest).getUTCMinutes() / 60;
    expect(h).toBeGreaterThan(11.7); expect(h).toBeLessThan(12.1);
  });
  test('solstice d’hiver : élévation ≈ 90−lat−23,4', () => {
    let max = -90;
    for (let m = 10 * 60; m <= 14 * 60; m += 2) {
      max = Math.max(max, sunPosition(PARIS.lat, PARIS.lon, new Date(Date.UTC(2026, 11, 21, 0, m))).elevation);
    }
    expect(max).toBeCloseTo(90 - 48.85 - 23.44, 0);
  });
  test('matin à l’est, soir à l’ouest, nuit sous l’horizon', () => {
    const matin = sunPosition(PARIS.lat, PARIS.lon, new Date(Date.UTC(2026, 5, 21, 6, 0)));
    const soir = sunPosition(PARIS.lat, PARIS.lon, new Date(Date.UTC(2026, 5, 21, 17, 0)));
    expect(matin.azimuth).toBeGreaterThan(60); expect(matin.azimuth).toBeLessThan(120);
    expect(soir.azimuth).toBeGreaterThan(240); expect(soir.azimuth).toBeLessThan(300);
    expect(sunPosition(PARIS.lat, PARIS.lon, new Date(Date.UTC(2026, 5, 21, 0, 0))).elevation).toBeLessThan(0);
  });
  test('équinoxe à l’équateur : soleil au zénith à midi', () => {
    const s = sunPosition(0, 0, new Date(Date.UTC(2026, 2, 20, 12, 0)));
    expect(s.elevation).toBeGreaterThan(85);
  });
});

describe('heures de soleil', () => {
  const date = new Date(Date.UTC(2026, 5, 21, 12));
  test('point dégagé : journée longue (~15–16 h) en juin', () => {
    const h = sunHoursOnPoint({ x: 0, y: 0 }, { ...PARIS, obstacles: [], date });
    expect(h).toBeGreaterThan(15); expect(h).toBeLessThan(17);
  });
  test('levelFromHours', () => {
    expect(levelFromHours(8)).toBe('full');
    expect(levelFromHours(6)).toBe('full');
    expect(levelFromHours(4)).toBe('partial');
    expect(levelFromHours(1)).toBe('shade');
  });
  test('un grand mur au sud réduit le soleil au nord du mur', () => {
    // nord en haut ; mur horizontal à y = 0 (sud du point test : y plus grand = sud)
    const mur = { id: 'm', kind: 'wall', points: [{ x: -50, y: 2 }, { x: 50, y: 2 }, { x: 50, y: 2.3 }, { x: -50, y: 2.3 }], height: 6 };
    const ombre = sunHoursOnPoint({ x: 0, y: 0 }, { ...PARIS, obstacles: [mur], date }); // mur au sud du point
    const libre = sunHoursOnPoint({ x: 0, y: 0 }, { ...PARIS, obstacles: [], date });
    expect(ombre).toBeLessThan(libre - 3);
    // Point de l'autre côté du mur (au sud) : le mur ne gêne que le soleil bas du nord.
    const sud = sunHoursOnPoint({ x: 0, y: 12 }, { ...PARIS, obstacles: [mur], date });
    expect(sud).toBeGreaterThan(ombre + 2);
  });
  test('northAngle fait tourner le plan : mur au nord réel ne gêne pas', () => {
    const mur = { id: 'm', kind: 'wall', points: [{ x: -50, y: 2 }, { x: 50, y: 2 }, { x: 50, y: 2.3 }, { x: -50, y: 2.3 }], height: 6 };
    const equinoxe = new Date(Date.UTC(2026, 2, 20, 12)); // le soleil reste au sud toute la journée
    const auSud = sunHoursOnPoint({ x: 0, y: 0 }, { ...PARIS, obstacles: [mur], date: equinoxe });
    const auNord = sunHoursOnPoint({ x: 0, y: 0 }, { ...PARIS, northAngle: 180, obstacles: [mur], date: equinoxe }); // mur au nord réel
    expect(auSud).toBeLessThan(1);
    expect(auNord).toBeGreaterThan(10);
  });
  test('arbre rond ombre un point proche', () => {
    const arbre = { id: 't', kind: 'tree', center: { x: 0, y: 3 }, radius: 1.5, height: 10 };
    const h = sunHoursOnPoint({ x: 0, y: 0 }, { ...PARIS, obstacles: [arbre], date });
    const libre = sunHoursOnPoint({ x: 0, y: 0 }, { ...PARIS, obstacles: [], date });
    expect(h).toBeLessThan(libre - 1);
  });
});

describe('estimateSunMap', () => {
  const date = new Date(Date.UTC(2026, 5, 21, 12));
  const jardin = (obstacles) => {
    const g = createGarden('s');
    g.boundary = carre(0, 0, 10);
    g.boundaryClosed = true;
    g.context.location = { ...PARIS };
    g.obstacles = obstacles;
    return g;
  };
  const niveauEn = (regions, p) => {
    const r = regions.find((q) => pointInPolygon(p, q.points));
    return r && r.level;
  };
  test('sans obstacle : tout en plein soleil', () => {
    const regions = estimateSunMap(jardin([]), { date });
    expect(regions.length).toBeGreaterThan(0);
    expect(regions.every((r) => r.level === 'full')).toBe(true);
  });
  test('mur au sud : la bande au pied du mur est à l’ombre (équinoxe)', () => {
    const date = new Date(Date.UTC(2026, 2, 20, 12));
    // Le haut du plan est le nord ; le mur borde le jardin au sud (y = 10..10,3).
    const mur = { id: 'm', kind: 'wall', points: [{ x: -20, y: 10.2 }, { x: 30, y: 10.2 }, { x: 30, y: 10.5 }, { x: -20, y: 10.5 }], height: 3 };
    const regions = estimateSunMap(jardin([mur]), { date });
    expect(niveauEn(regions, { x: 5, y: 9.75 })).not.toBe('full');
    expect(niveauEn(regions, { x: 5, y: 0.25 })).toBe('full');
    // Pas de chevauchement de régions.
    const total = regions.reduce((s, r) => s + (r.points[1].x - r.points[0].x) * (r.points[2].y - r.points[1].y), 0);
    expect(total).toBeCloseTo(100, 5);
  });
  test('sans localisation : vide', () => {
    const g = jardin([]); g.context.location = null;
    expect(estimateSunMap(g, { date })).toEqual([]);
  });
});

describe('zoneSunLevel', () => {
  const zone = createZone('lawn', { kind: 'polygon', points: carre(0, 0, 4) });
  test('inconnu', () => {
    const g = createGarden();
    expect(zoneSunLevel(g, zone)).toEqual({ level: null, dominant: null, share: { full: 0, partial: 0, shade: 0 } });
  });
  test('uniforme', () => {
    const g = createGarden();
    g.sun = { mode: 'uniform', uniform: 'partial', regions: [] };
    const r = zoneSunLevel(g, zone);
    expect(r.level).toBe('partial');
    expect(r.share.partial).toBe(1);
  });
  test('cartographié : zone à cheval sur deux niveaux', () => {
    const g = createGarden();
    g.sun = { mode: 'map', uniform: null, regions: [
      { id: 'a', level: 'full', points: [{ x: -1, y: -1 }, { x: 3, y: -1 }, { x: 3, y: 5 }, { x: -1, y: 5 }] },
      { id: 'b', level: 'shade', points: [{ x: 3, y: -1 }, { x: 5, y: -1 }, { x: 5, y: 5 }, { x: 3, y: 5 }] },
    ] };
    const r = zoneSunLevel(g, zone);
    expect(r.dominant).toBe('full');
    expect(r.share.full).toBeCloseTo(0.75, 1);
    expect(r.share.shade).toBeCloseTo(0.25, 1);
    expect(r.share.full + r.share.partial + r.share.shade).toBeCloseTo(1);
  });
  test('carte sans couverture de la zone : null', () => {
    const g = createGarden();
    g.sun = { mode: 'map', uniform: null, regions: [{ id: 'a', level: 'full', points: carre(50, 50, 2) }] };
    expect(zoneSunLevel(g, zone).level).toBeNull();
  });
});
