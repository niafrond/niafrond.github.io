import { plantLayer, minDistance, clearanceFromBuilding, allocateQuantities, packingCapacity, packZone, checkSpacing, fitQuantities, footRadius } from '../../spacing.js';
import { getPlant } from '../../catalog.js';
import { shapePolygon, pointInPolygon } from '../../geometry.js';

const rect = (x, y, w, h) => ({ kind: 'polygon', points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });
const mk = (o) => ({ id: 'p', commonName: 'Plante', category: 'perennial', heightAdult: 0.5, widthAdult: 0.5, spacing: 0.4, ...o });
const TREE = mk({ id: 'arbre', commonName: 'Chêne', category: 'tree', heightAdult: 10, widthAdult: 6, spacing: 6 });
const TREE2 = mk({ id: 'arbre2', commonName: 'Tilleul', category: 'tree', heightAdult: 8, widthAdult: 4, spacing: 4 });
const SHRUB = mk({ id: 'arbuste', commonName: 'Rosier', category: 'shrub', heightAdult: 1.2, widthAdult: 1, spacing: 0.8 });
const BIGSHRUB = mk({ id: 'grand', category: 'shrub', heightAdult: 3, widthAdult: 2, spacing: 1.5 });
const PERE = mk({ id: 'vivace', commonName: 'Lavande', heightAdult: 0.6, widthAdult: 0.5, spacing: 0.4 });
const GROUND = mk({ id: 'sol', category: 'groundcover', heightAdult: 0.1, widthAdult: 0.6, spacing: 0.4 });
const HEDGE = mk({ id: 'haie', commonName: 'Charme', category: 'hedge', heightAdult: 2, widthAdult: 1, spacing: 0.6 });
const ALL = { arbre: TREE, arbre2: TREE2, arbuste: SHRUB, grand: BIGSHRUB, vivace: PERE, sol: GROUND, haie: HEDGE };
const look = (id) => ALL[id];
const distinctPairs = (pos) => { const o = []; for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) o.push([pos[i], pos[j]]); return o; };
const violations = (r, plantsById = look) => distinctPairs(r.positions).filter(([a, b]) => Math.hypot(a.x - b.x, a.y - b.y) < minDistance(plantsById(a.plantId), plantsById(b.plantId)) - 1e-6);

describe('couches et distances', () => {
  test('plantLayer', () => {
    expect(plantLayer(TREE)).toBe('canopy');
    expect(plantLayer(BIGSHRUB)).toBe('tall');
    expect(plantLayer(SHRUB)).toBe('mid');
    expect(plantLayer(mk({ heightAdult: 1.2 }))).toBe('mid');
    expect(plantLayer(PERE)).toBe('low');
    expect(plantLayer(GROUND)).toBe('ground');
    expect(plantLayer(mk({ category: 'aquatic' }))).toBe('aquatic');
    expect(plantLayer(mk({ category: 'fruit', heightAdult: 8 }))).toBe('canopy');
  });
  test('minDistance', () => {
    expect(minDistance(PERE, PERE)).toBe(0.4);
    expect(minDistance(TREE, TREE)).toBeCloseTo(6);
    expect(minDistance(TREE, TREE2)).toBeCloseTo(Math.max(0.7 * 5, 5));
    expect(minDistance(TREE, SHRUB)).toBeCloseTo(1.5);
    expect(minDistance(TREE, PERE)).toBe(0.8);
    expect(minDistance(SHRUB, PERE)).toBeCloseTo(footRadius(SHRUB) + footRadius(PERE));
    expect(minDistance(SHRUB, PERE)).toBeLessThan(minDistance(SHRUB, SHRUB));
    expect(minDistance(TREE, SHRUB)).toBe(minDistance(SHRUB, TREE));
  });
  test('clearanceFromBuilding', () => {
    expect(clearanceFromBuilding(TREE)).toBe(5);
    expect(clearanceFromBuilding(TREE2)).toBe(4);
    expect(clearanceFromBuilding(BIGSHRUB)).toBe(1.5);
    expect(clearanceFromBuilding(PERE)).toBe(0);
  });
});

describe('packingCapacity', () => {
  test('pavage : proche de la surface / espacement², jamais au-delà', () => {
    const poly = shapePolygon(rect(0, 0, 4, 3));
    const c = packingCapacity(poly, PERE);
    expect(c).toBeGreaterThanOrEqual(40);
    expect(c).toBeLessThanOrEqual(Math.floor(12 * 1.16 / 0.16));
  });
  test('un arbre dans une petite zone : au moins 1 ; les pieds déjà posés réduisent la capacité', () => {
    expect(packingCapacity(shapePolygon(rect(0, 0, 3, 3)), TREE)).toBe(1);
    const poly = shapePolygon(rect(0, 0, 4, 3));
    const libre = packingCapacity(poly, PERE);
    const sous = packingCapacity(poly, PERE, { obstacles: [{ x: 2, y: 1.5, plant: TREE }] });
    expect(sous).toBeLessThan(libre);
  });
});

describe('allocateQuantities', () => {
  const zone = { id: 'z', type: 'trees', shape: rect(0, 0, 5.3, 5.3) };
  test('arbre + arbustes dans une zone d’arbres : jamais de surdensité, pas de pieds sous le tronc', () => {
    const al = allocateQuantities(zone, [TREE2, SHRUB, PERE, GROUND]);
    expect(al.map((x) => x.plantId)).toEqual(['arbre2', 'arbuste', 'vivace', 'sol']);
    expect(al[0].count).toBeGreaterThanOrEqual(1);
    expect(al[0].count).toBeLessThanOrEqual(2);
    const pls = al.filter((x) => x.count > 0);
    const r = packZone(zone, pls, look);
    expect(r.overflow).toEqual([]);
    expect(violations(r)).toEqual([]);
    const arbre = r.positions.filter((p) => p.plantId === 'arbre2');
    for (const q of r.positions.filter((p) => p.plantId !== 'arbre2')) for (const t of arbre) expect(Math.hypot(q.x - t.x, q.y - t.y)).toBeGreaterThanOrEqual(0.8 - 1e-6);
  });
  test('le tronc compte pour sa couronne : plus de plants sans arbre qu’avec', () => {
    const avec = allocateQuantities(zone, [TREE2, PERE]);
    const sans = allocateQuantities(zone, [PERE]);
    expect(avec[1].count).toBeLessThan(sans[0].count);
  });
  test('un arbre ne dépasse pas un par espacement², et reste 1 si la couronne dépasse la zone', () => {
    const big = mk({ id: 'g', category: 'tree', widthAdult: 14, heightAdult: 20, spacing: 10 });
    expect(allocateQuantities(zone, [big])[0].count).toBe(1);
    const grande = { id: 'z2', type: 'trees', shape: rect(0, 0, 30, 30) };
    expect(allocateQuantities(grande, [TREE2])[0].count).toBeLessThanOrEqual(Math.floor(900 / 16));
  });
  test('part par couche : chaque essence ≤ capacité', () => {
    const z = { id: 'm', type: 'midplants', shape: rect(0, 0, 6, 2) };
    const al = allocateQuantities(z, [BIGSHRUB, SHRUB, PERE, GROUND]);
    al.forEach((x) => expect(x.count).toBeGreaterThanOrEqual(1));
    const r = packZone(z, al, look);
    expect(r.overflow).toEqual([]);
    expect(violations(r)).toEqual([]);
  });
  test('haie : un rang unique', () => {
    const z = { id: 'h', type: 'hedge', shape: { kind: 'line', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], width: 1 } };
    const al = allocateQuantities(z, [HEDGE]);
    expect(al[0].count).toBe(Math.floor(9.9 / 0.6) + 1);
  });
});

describe('packZone', () => {
  const zone = { id: 'z', type: 'midplants', shape: rect(0, 0, 6, 4) };
  const pls = [{ plantId: 'arbuste', count: 4 }, { plantId: 'vivace', count: 20 }, { plantId: 'sol', count: 10 }];
  test('déterministe, tous dans le polygone, distances minimales sur toutes les paires', () => {
    const a = packZone(zone, pls, look); const b = packZone(zone, pls, look);
    expect(a).toEqual(b);
    expect(a.positions).toHaveLength(34);
    const poly = shapePolygon(zone.shape);
    for (const p of a.positions) expect(pointInPolygon(p, poly)).toBe(true);
    expect(violations(a)).toEqual([]);
    expect(a.overflow).toEqual([]);
  });
  test('overflow quand la capacité est dépassée (et pose forcée sur demande)', () => {
    const r = packZone(zone, [{ plantId: 'vivace', count: 400 }], look);
    expect(r.overflow).toHaveLength(1);
    expect(r.overflow[0]).toMatchObject({ plantId: 'vivace', wanted: 400 });
    expect(r.overflow[0].placed).toBe(r.positions.length);
    expect(r.overflow[0].placed).toBeLessThan(400);
    expect(violations(r)).toEqual([]);
    const f = packZone(zone, [{ plantId: 'vivace', count: 400 }], look, { force: true });
    expect(f.positions).toHaveLength(400);
  });
  test('haie en rang à l’espacement le long de la ligne', () => {
    const z = { id: 'h', type: 'hedge', shape: { kind: 'line', points: [{ x: 0, y: 1 }, { x: 6, y: 1 }], width: 1 } };
    const r = packZone(z, [{ plantId: 'haie', count: 8 }], look);
    expect(r.positions).toHaveLength(8);
    const xs = r.positions.map((p) => p.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeCloseTo(0.6, 6);
    r.positions.forEach((p) => expect(p.y).toBeCloseTo(1, 6));
  });
  test('maxima : nombre maximal compte tenu des autres', () => {
    const r = packZone(zone, [{ plantId: 'vivace', count: 5 }], look, { maxima: true });
    expect(r.maxima[0]).toBeGreaterThan(5);
    expect(r.maxima[0]).toBeLessThanOrEqual(packingCapacity(shapePolygon(zone.shape), PERE));
  });
  test('fitQuantities ramène à ce qui tient', () => {
    const fit = fitQuantities(zone, [{ plantId: 'vivace', count: 400 }], look);
    expect(fit[0].count).toBeLessThan(400);
    expect(packZone(zone, fit, look).overflow).toEqual([]);
  });
});

describe('checkSpacing', () => {
  const g0 = { obstacles: [{ id: 'maison', kind: 'house', points: [{ x: -6, y: 0 }, { x: -1, y: 0 }, { x: -1, y: 6 }, { x: -6, y: 6 }] }], boundary: [] };
  test('surdensité', () => {
    const z = { id: 'z', type: 'midplants', shape: rect(0, 0, 2, 2), plantings: [{ plantId: 'vivace', count: 40 }] };
    const w = checkSpacing({ zones: [z] }, z, look);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ level: 'warn', zoneId: 'z', plantId: 'vivace', kind: 'surdensite' });
    expect(w[0].text).toMatch(/40 plants ne tiennent pas, \d+ maximum avec 40 cm d'espacement/);
  });
  test('arbres proches', () => {
    const z = { id: 'z', type: 'trees', shape: rect(0, 0, 3, 3), plantings: [{ plantId: 'arbre2', count: 2 }] };
    const w = checkSpacing({ zones: [z] }, z, look);
    expect(w.some((x) => x.kind === 'arbres-proches' && /Deux Tilleul à \d(,\d)? m : prévoir 4 m/.test(x.text))).toBe(true);
  });
  test('pied sous un arbre', () => {
    const z = { id: 'z', type: 'trees', shape: rect(0, 0, 2, 2), plantings: [{ plantId: 'arbre2', count: 1 }, { plantId: 'vivace', count: 40 }] };
    expect(checkSpacing({ zones: [z] }, z, look).some((x) => x.kind === 'pied-arbre')).toBe(true);
  });
  test('bâtiment', () => {
    const z = { id: 'z', type: 'trees', shape: rect(0, 0, 3, 3), plantings: [{ plantId: 'arbre2', count: 1 }] };
    const w = checkSpacing({ ...g0, zones: [z] }, z, look);
    const b = w.find((x) => x.kind === 'batiment');
    expect(b).toBeTruthy();
    expect(b.text).toMatch(/Tilleul à \d(,\d)? m de la maison : prévoir 4 m/);
  });
  test('zone saine : aucun avertissement', () => {
    const z = { id: 'z', type: 'midplants', shape: rect(0, 0, 4, 3), plantings: [{ plantId: 'vivace', count: 10 }, { plantId: 'arbuste', count: 2 }] };
    expect(checkSpacing({ zones: [z] }, z, look)).toEqual([]);
  });
});

test('catalogue réel : les couches existent pour toutes les essences', () => {
  for (const id of ['erable-japonais', 'h-lavande', 'h-pervenche']) expect(['canopy', 'tall', 'mid', 'low', 'ground']).toContain(plantLayer(getPlant(id)));
});
