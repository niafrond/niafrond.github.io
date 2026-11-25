import { freeSpace, proposeBeds, FLOWER_ZONE_TYPES, isFlowerZone } from '../../massifs.js';
import { createZone, createItem, createOpening } from '../../model.js';
import { overlapArea, polygonArea, pointInPolygon, polygonInside, shapePolygon } from '../../geometry.js';
import { itemPolygon } from '../../items.js';
import { gardenA, gardenBig, rect } from './massif-fixtures.js';

const bedPoly = (b) => b.shape.points;
const minDistTo = (p, poly) => {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]; const b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x; const dy = b.y - a.y; const l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
  }
  return best;
};

describe('freeSpace', () => {
  const g = gardenA();
  const fs = freeSpace(g);
  const free = (x, y) => fs.isFree(x, y);

  test('exclut maison, terrasse, pelouse, piscine (+1 m), mobilier (+0,3 m), hors contour', () => {
    expect(free(6, 0.8)).toBe(false); // maison
    expect(free(5, 3)).toBe(false); // terrasse
    expect(free(5, 6)).toBe(false); // pelouse
    expect(free(10.2, 6.2)).toBe(false); // piscine
    expect(free(10.2, 4.4)).toBe(false); // à 0,8 m du bord de la piscine
    expect(free(10.2, 3.9)).toBe(true); // à plus de 1 m
    expect(free(1.2, 4)).toBe(false); // banc
    expect(free(1, 4.5)).toBe(false); // banc + 0,3 m (profondeur 0,5 : bord à 4,25)
    expect(free(1, 4.7)).toBe(true);
    expect(free(-1, 3)).toBe(false);
    expect(free(1, 7)).toBe(true);
  });

  test('pelouse libérée avec allowLawn ; la grille est cohérente avec isFree', () => {
    const fl = freeSpace(g, { allowLawn: true });
    expect(fl.isFree(5, 6)).toBe(true);
    expect(fl.freeArea).toBeGreaterThan(fs.freeArea + 10);
    let n = 0;
    for (let j = 0; j < fs.ny; j++) for (let i = 0; i < fs.nx; i++) {
      const c = fs.cellCenter(i, j);
      expect(!!fs.grid[j * fs.nx + i]).toBe(fs.isFree(c.x, c.y));
      if (fs.grid[j * fs.nx + i]) n++;
    }
    expect(fs.freeArea).toBeCloseTo(n * 0.0625, 6);
  });

  test('mare +0,5 m, arbre obstacle, houppier, allée, massif existant, ouverture', () => {
    const h = gardenA();
    h.zones.push(createZone('pond', { kind: 'circle', center: { x: 2, y: 7.5 }, radius: 0.6 }));
    h.zones.push(createZone('trees', { kind: 'circle', center: { x: 6, y: 8 }, radius: 0.8 }));
    h.zones.push(createZone('path', { kind: 'line', points: [{ x: 9, y: 2 }, { x: 9, y: 4 }], width: 1 }));
    h.zones.push(createZone('midplants', rect(0.2, 2, 1.5, 1.2)));
    h.obstacles.push({ id: 'a', kind: 'tree', center: { x: 4, y: 4.5 }, radius: 0.5, height: 5 });
    h.openings = [{ ...createOpening('door', { type: 'obstacle', obstacleId: 'maison', side: 2 }, 0.9), id: 'op1' }];
    const f = freeSpace(h);
    expect(f.isFree(2, 7.5 - 0.6 - 0.3)).toBe(false);
    expect(f.isFree(2, 7.5 - 0.6 - 0.7)).toBe(true);
    expect(f.isFree(6, 8)).toBe(false);
    expect(f.isFree(9, 3)).toBe(false);
    expect(f.isFree(1, 2.5)).toBe(false);
    expect(f.isFree(4, 4.5 + 0.7)).toBe(false);
    expect(f.freeArea).toBeLessThan(fs.freeArea);
    // devant la porte (0,9 m), sur le côté bas de la maison
    const door = (h.obstacles[0].points[2]);
    expect(f.isFree(door.x - 1.08 * 0.9, 1.6 + 0.5)).toBe(false);
  });

  test('components : zones libres connexes triées, aire totale cohérente', () => {
    const comps = fs.components();
    expect(comps.length).toBeGreaterThanOrEqual(1);
    for (let i = 1; i < comps.length; i++) expect(comps[i - 1].areaM2).toBeGreaterThanOrEqual(comps[i].areaM2);
    expect(comps.reduce((s, c) => s + c.areaM2, 0)).toBeCloseTo(fs.freeArea, 6);
  });

  test('empreinte d\'une plante existante exclue (+0,3 m)', () => {
    const h = gardenBig();
    h.existing = [{ id: 'e1', kind: 'tree', plantId: null, x: 14, y: 11, height: 8, width: 4, keep: true }];
    const f = freeSpace(h);
    expect(f.isFree(14, 11)).toBe(false);
    expect(f.isFree(14 + 2.2, 11)).toBe(false);
    expect(f.isFree(14 + 2.8, 11)).toBe(true);
  });
});

describe('proposeBeds', () => {
  const g = gardenA();

  test('massifs dans le contour, hors zones / mobilier / obstacles, surfaces et largeurs valides', () => {
    for (const seed of [1, 2, 3]) {
      const beds = proposeBeds(g, { seed, design: false });
      expect(beds.length).toBeGreaterThan(0);
      const fs = freeSpace(g);
      beds.forEach((b) => {
        expect(b.shape.kind).toBe('polygon');
        expect(b.shape.points.length).toBeGreaterThanOrEqual(8);
        expect(b.shape.points.length).toBeLessThanOrEqual(24);
        expect(polygonInside(bedPoly(b), g.boundary)).toBe(true);
        expect(b.areaM2).toBeGreaterThanOrEqual(2 - 0.05);
        expect(b.areaM2).toBeLessThanOrEqual(20);
        expect(b.widthM).toBeGreaterThanOrEqual(0.6);
        expect(['bordure', 'pied-de-mur', 'ilot', 'angle', 'haie-fleurie']).toContain(b.role);
        expect(typeof b.why).toBe('string');
        expect(b.sunLevel).toBe('full');
        // aucune zone, mobilier ni obstacle dans le massif
        for (const z of g.zones) expect(overlapArea(bedPoly(b), shapePolygon(z.shape))).toBeLessThan(0.1);
        for (const it of g.items) expect(overlapArea(bedPoly(b), itemPolygon(it))).toBeLessThan(0.1);
        for (const ob of g.obstacles) if (ob.points) expect(overlapArea(bedPoly(b), ob.points)).toBeLessThan(0.1);
        // dégagements (piscine 1 m, mobilier 0,3 m) respectés sur un échantillon de points intérieurs
        const bb = bedPoly(b);
        for (const p of bb) expect(minDistTo(p, [{ x: 10.2, y: 6.2 }, { x: 10.2001, y: 6.2 }]) - 1).toBeGreaterThan(0.95 - 0.001);
        for (let y = 0.1; y < 9; y += 0.4) for (let x = 0.1; x < 12; x += 0.4) {
          if (pointInPolygon({ x, y }, bb)) expect(fs.isFree(x, y) || !fs.grid[Math.floor((y - fs.minY) / fs.cell) * fs.nx + Math.floor((x - fs.minX) / fs.cell)]).toBe(true);
        }
      });
      // pas de chevauchement entre massifs
      for (let i = 0; i < beds.length; i++) for (let j = i + 1; j < beds.length; j++) {
        expect(overlapArea(bedPoly(beds[i]), bedPoly(beds[j]))).toBeLessThan(0.1);
      }
    }
  });

  test('coverage respectée à ±25 %', () => {
    const fs = freeSpace(g);
    for (const coverage of [0.3, 0.5]) for (const seed of [1, 2, 3]) {
      const beds = proposeBeds(g, { seed, coverage, design: false });
      const area = beds.reduce((s, b) => s + b.areaM2, 0);
      const ratio = area / (coverage * fs.freeArea);
      expect(ratio).toBeGreaterThanOrEqual(0.75);
      expect(ratio).toBeLessThanOrEqual(1.25);
    }
  });

  test('déterministe avec la graine, variantes avec une autre graine', () => {
    const a = proposeBeds(g, { seed: 5 });
    expect(JSON.stringify(proposeBeds(g, { seed: 5 }))).toBe(JSON.stringify(a));
    const sigs = new Set([1, 2, 3, 4, 5, 6].map((s) => JSON.stringify(proposeBeds(g, { seed: s, design: false }).map((b) => b.shape.points))));
    expect(sigs.size).toBeGreaterThanOrEqual(3);
  });

  test('styles borders / islands, maxBeds, descriptions et plantations', () => {
    const big = gardenBig();
    const borders = proposeBeds(big, { seed: 1, style: 'borders', design: false });
    expect(borders.length).toBeGreaterThan(0);
    expect(borders.every((b) => b.role !== 'ilot')).toBe(true);
    const islands = proposeBeds(big, { seed: 1, style: 'islands', design: false, coverage: 0.3 });
    expect(islands.length).toBeGreaterThan(0);
    expect(islands.every((b) => b.role === 'ilot')).toBe(true);
    expect(proposeBeds(big, { seed: 1, maxBeds: 2, design: false }).length).toBeLessThanOrEqual(2);
    const full = proposeBeds(big, { seed: 1 });
    full.forEach((b) => {
      expect(b.plantings.length).toBeGreaterThanOrEqual(3);
      expect(b.summary.bloomMonths.length).toBeGreaterThan(0);
      expect(b.why).toMatch(/\d/);
    });
    expect(full.some((b) => /^Bordure de \d+(,\d)? m le long de /.test(b.why) || /^Pied de mur/.test(b.why) || /^(Haie fleurie|Massif d’angle|Îlot)/.test(b.why))).toBe(true);
  });

  test('jardin sans vide → liste vide ; sans contour → liste vide', () => {
    const h = gardenA();
    h.zones.push(createZone('other', rect(-1, -1, 14, 11)));
    expect(proposeBeds(h, { seed: 1 })).toEqual([]);
    const e = gardenA(); e.boundary = [];
    expect(proposeBeds(e, { seed: 1 })).toEqual([]);
    expect(proposeBeds(g, { seed: 1, coverage: 0 })).toEqual([]);
  });

  test('un arbre existant au milieu d\'un vide n\'est recouvert par aucun massif', () => {
    const h = gardenBig();
    h.zones = h.zones.filter((z) => z.type !== 'lawn');
    h.obstacles = h.obstacles.filter((o) => o.kind === 'house');
    h.items = [];
    h.existing = [{ id: 'e1', kind: 'tree', plantId: null, x: 10, y: 10.5, height: 9, width: 5, keep: true }];
    for (const style of ['mixed', 'islands']) for (const seed of [1, 2]) {
      const beds = proposeBeds(h, { seed, style, coverage: 0.6, design: false });
      expect(beds.length).toBeGreaterThan(0);
      for (const b of beds) {
        for (const p of bedPoly(b)) expect(Math.hypot(p.x - 10, p.y - 10.5)).toBeGreaterThanOrEqual(2.5 + 0.3 - 0.05);
        expect(b.sunLevel === null || ['full', 'partial', 'shade'].includes(b.sunLevel)).toBe(true);
      }
    }
  });

  test('ombre d\'un grand arbre existant : ensoleillement plus faible côté nord', () => {
    const h = gardenBig();
    h.sun = { mode: 'uniform', uniform: 'full', regions: [] };
    h.zones = []; h.obstacles = [{ id: 'maison', kind: 'house', points: [{ x: 4, y: 0 }, { x: 16, y: 0 }, { x: 16, y: 3 }, { x: 4, y: 3 }], height: 6 }];
    h.items = [];
    h.existing = [{ id: 'e1', kind: 'tree', plantId: null, x: 10, y: 12, height: 10, width: 4, keep: true }];
    const beds = proposeBeds(h, { seed: 1, design: false, coverage: 0.7 });
    const north = beds.filter((b) => b.shape.points.every((p) => Math.hypot(p.x - 10, p.y - 12) < 9 && p.y < 12 - 2.3));
    for (const b of north) expect(['partial', 'shade']).toContain(b.sunLevel);
    expect(beds.some((b) => b.sunLevel === 'full')).toBe(true);
  });

  test('300 m² en moins de 1,5 s', () => {
    const big = gardenBig();
    const t = Date.now();
    const beds = proposeBeds(big, { seed: 1 });
    expect(Date.now() - t).toBeLessThan(1500);
    expect(beds.length).toBeGreaterThan(2);
    beds.forEach((b) => expect(polygonArea(bedPoly(b))).toBeLessThanOrEqual(20.5));
  });

  test('exports FLOWER_ZONE_TYPES / isFlowerZone', () => {
    expect(FLOWER_ZONE_TYPES).toEqual(['lowplants', 'midplants', 'tallplants']);
    expect(isFlowerZone(createZone('midplants', rect(0, 0, 1, 1)))).toBe(true);
    expect(isFlowerZone(createZone('terrace', rect(0, 0, 1, 1)))).toBe(false);
    expect(isFlowerZone(null)).toBe(false);
  });
});
