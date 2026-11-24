import { estimateSunMap, sunHoursOnPoint, shadowObstacles } from '../../sun.js';
import { createGarden, createItem } from '../../model.js';
import { pointInPolygon } from '../../geometry.js';

function jardin() {
  const g = createGarden('S');
  g.context.location = { lat: 48.85, lon: 2.35 };
  g.context.northAngle = 0; // nord en haut : le sud est du côté y croissant
  g.boundary = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  g.boundaryClosed = true;
  return g;
}
const DATE = new Date(Date.UTC(2026, 5, 21, 12));
const HIVER = new Date(Date.UTC(2026, 11, 21, 12)); // soleil plein sud toute la journée
const levelAt = (regions, p) => (regions.find((r) => pointInPolygon(p, r.points)) || {}).level;

describe('ombre des aménagements', () => {
  test('shadowObstacles : obstacles + côtés bâtis + éléments hauts, sans modifier l’existant', () => {
    const g = jardin();
    g.obstacles = [{ id: 'o1', kind: 'wall', points: [{ x: 0, y: 5 }, { x: 4, y: 5 }], height: 2 }];
    g.boundaryEdges = [{ kind: 'wall', height: 2 }, { kind: 'open', height: 0 }, { kind: 'hedge' }];
    g.items = [createItem('pergola', 5, 5), createItem('bench', 2, 2)];
    const all = shadowObstacles(g);
    expect(all).toHaveLength(1 + 2 + 1);
    expect(g.obstacles).toHaveLength(1);
    expect(shadowObstacles(createGarden())).toEqual([]);
  });
  test('un mur au sud met dans l’ombre le pied du mur (solstice d’hiver : soleil plein sud)', () => {
    const sans = jardin();
    const avec = jardin();
    avec.boundaryEdges = [{ kind: 'open', height: 0 }, { kind: 'open', height: 0 }, { kind: 'wall', height: 2 }]; // côté sud (y = 10)
    const p = { x: 5, y: 9.8 };
    const opts = { lat: 48.85, lon: 2.35, northAngle: 0, date: HIVER };
    const h0 = sunHoursOnPoint(p, { ...opts, obstacles: shadowObstacles(sans) });
    const h1 = sunHoursOnPoint(p, { ...opts, obstacles: shadowObstacles(avec) });
    expect(h0).toBeGreaterThan(6);
    expect(h1).toBeLessThan(1);
    const m0 = estimateSunMap(sans, { date: HIVER });
    const m1 = estimateSunMap(avec, { date: HIVER });
    expect(levelAt(m0, { x: 5, y: 9.75 })).toBe('full');
    expect(levelAt(m1, { x: 5, y: 9.75 })).toBe('shade');
    expect(levelAt(m1, { x: 5, y: 1 })).toBe('full');
  });
  test('en été le même mur réduit nettement le soleil de midi', () => {
    const avec = jardin();
    avec.boundaryEdges = [{ kind: 'open', height: 0 }, { kind: 'open', height: 0 }, { kind: 'wall', height: 2 }];
    const opts = { lat: 48.85, lon: 2.35, northAngle: 0, date: DATE };
    const p = { x: 5, y: 9.8 };
    expect(sunHoursOnPoint(p, { ...opts, obstacles: shadowObstacles(avec) })).toBeLessThan(sunHoursOnPoint(p, { ...opts, obstacles: [] }) - 4);
  });
  test('un abri (élément haut) ombrage son côté nord, pas un banc', () => {
    const g = jardin();
    g.items = [createItem('shed_item', 5, 5, 0)];
    const opts = { lat: 48.85, lon: 2.35, northAngle: 0, date: DATE, obstacles: shadowObstacles(g) };
    const nord = sunHoursOnPoint({ x: 5, y: 3.7 }, opts); // juste au nord de l'abri
    const loin = sunHoursOnPoint({ x: 1, y: 1 }, opts);
    expect(nord).toBeLessThan(loin);
    const g2 = jardin();
    g2.items = [createItem('bench', 5, 5, 0)];
    expect(shadowObstacles(g2)).toEqual([]);
  });
});
