import { placePlants } from '../../render.js';
import { placePlants as placeCommon } from '../../render-common.js';
import { pointInPolygon, shapePolygon } from '../../geometry.js';
import { createZone } from '../../model.js';
import { jardin, PLANTS, lookup } from './render-fixture.js';

const zone = (g, id) => g.zones.find((z) => z.id === id);

describe('placePlants', () => {
  test('exportée par render.js et render-common.js', () => { expect(placePlants).toBe(placeCommon); });

  test('déterministe : mêmes entrées, mêmes positions', () => {
    const g = jardin();
    const a = placePlants(g, zone(g, 'z-massif'), PLANTS);
    const b = placePlants(g, zone(g, 'z-massif'), lookup);
    expect(JSON.stringify(a.map(({ plant, ...r }) => ({ id: plant.id, ...r })))).toBe(JSON.stringify(b.map(({ plant, ...r }) => ({ id: plant.id, ...r }))));
    expect(a.length).toBe(15);
  });

  test('chaque plant est dans la forme de la zone (polygone, cercle, ligne)', () => {
    const g = jardin();
    for (const id of ['z-massif', 'z-arbre', 'z-haie']) {
      const z = zone(g, id);
      const poly = shapePolygon(z.shape, 48);
      const out = placePlants(g, z, PLANTS);
      expect(out.length).toBeGreaterThan(0);
      for (const p of out) {
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
        expect(pointInPolygon({ x: p.x, y: p.y }, poly)).toBe(true);
      }
    }
  });

  test('quantités par essence respectées et distance minimale ≈ espacement', () => {
    const g = jardin();
    const out = placePlants(g, zone(g, 'z-massif'), PLANTS);
    expect(out.filter((p) => p.plant.id === 'lavande')).toHaveLength(12);
    expect(out.filter((p) => p.plant.id === 'rosier')).toHaveLength(3);
    let min = Infinity;
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) min = Math.min(min, Math.hypot(out[i].x - out[j].x, out[i].y - out[j].y));
    expect(min).toBeGreaterThan(0.4); // ≥ espacement moyen des lavandes
  });

  test('rayon : largeur adulte / 2, réduit pour les jeunes plants', () => {
    const g = jardin();
    const a = placePlants(g, zone(g, 'z-arbre'), PLANTS);
    const y = placePlants(g, zone(g, 'z-arbre'), PLANTS, { age: 'young' });
    expect(a[0].r).toBeCloseTo(2, 6);
    expect(y[0].r).toBeLessThan(a[0].r);
    expect(y[0].r).toBeGreaterThan(0);
  });

  test('graine = id de zone + id d’essence : une autre zone donne d’autres graines', () => {
    const g = jardin();
    const z1 = zone(g, 'z-massif');
    const z2 = { ...z1, id: 'autre' };
    const a = placePlants(g, z1, PLANTS); const b = placePlants(g, z2, PLANTS);
    expect(a.map((p) => p.rand)).not.toEqual(b.map((p) => p.rand));
    for (const p of a) { expect(p.rand).toBeGreaterThanOrEqual(0); expect(p.rand).toBeLessThan(1); }
  });

  test('gazon : un remplissage unique ; plafond `max` ; zone sans plant ; potager en rangs', () => {
    const g = jardin();
    const lawn = placePlants(g, zone(g, 'z-pelouse'), PLANTS);
    expect(lawn).toHaveLength(1);
    expect(lawn[0].fill).toBe(true);
    const big = createZone('midplants', { kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] });
    big.plantings = [{ plantId: 'lavande', count: 500 }];
    expect(placePlants(g, big, PLANTS)).toHaveLength(150);
    expect(placePlants(g, big, PLANTS, { max: 40 })).toHaveLength(40);
    expect(placePlants(g, createZone('midplants', big.shape), PLANTS)).toEqual([]);
    const veg = createZone('vegetable', { kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 2 }, { x: 0, y: 2 }] });
    veg.plantings = [{ plantId: 'carotte', count: 30 }];
    const rows = new Set(placePlants(g, veg, PLANTS).map((p) => p.y.toFixed(3)));
    expect(rows.size).toBeLessThan(30);
  });

  test('essence inconnue ignorée, accepte une fonction ou un objet', () => {
    const g = jardin();
    const z = zone(g, 'z-massif');
    expect(placePlants(g, { ...z, plantings: [{ plantId: 'nope', count: 3 }] }, PLANTS)).toEqual([]);
    expect(placePlants(g, z, (id) => PLANTS[id])).toHaveLength(15);
  });
});
