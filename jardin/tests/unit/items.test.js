import {
  ITEM_KINDS, OPENING_KINDS, EDGE_KINDS, itemPolygon, openingGeometry, snapOpeningToSides, edgeObstacles, itemObstacles,
  boundarySides, obstacleSides, itemsTotalPrice,
} from '../../items.js';
import { createGarden, createItem, createOpening } from '../../model.js';
import { renderItemsSVG, itemsLegendEntries } from '../../render-items.js';
import { polygonArea, bounds } from '../../geometry.js';

function jardin() {
  const g = createGarden('T');
  g.boundary = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 8 }, { x: 0, y: 8 }];
  g.boundaryClosed = true;
  return g;
}

describe('catalogue', () => {
  test('≈ 25 éléments complets, ids uniques', () => {
    expect(ITEM_KINDS.length).toBeGreaterThanOrEqual(25);
    expect(new Set(ITEM_KINDS.map((k) => k.id)).size).toBe(ITEM_KINDS.length);
    for (const k of ITEM_KINDS) {
      expect(k.label && k.emoji && k.color).toBeTruthy();
      expect(['furniture', 'equipment', 'structure']).toContain(k.category);
      expect(['rect', 'circle']).toContain(k.shape);
      expect(k.w).toBeGreaterThan(0); expect(k.d).toBeGreaterThan(0);
      expect(k.priceEur).toBeGreaterThan(0);
      if (k.shape === 'circle') expect(k.w).toBe(k.d);
    }
  });
  test('ouvertures par défaut', () => {
    const w = Object.fromEntries(OPENING_KINDS.map((k) => [k.id, k.width]));
    expect(w).toMatchObject({ gate: 3, wicket: 1, door: 0.9, garage: 2.4, double_gate: 4 });
    expect(EDGE_KINDS.find((k) => k.id === 'wall').height).toBe(2);
    expect(EDGE_KINDS.find((k) => k.id === 'fence').height).toBe(1.2);
    expect(EDGE_KINDS.find((k) => k.id === 'hedge').height).toBe(1.8);
  });
});

describe('itemPolygon', () => {
  test('rectangle non tourné', () => {
    const p = itemPolygon({ x: 5, y: 4, width: 2, depth: 1, rotation: 0 });
    expect(p).toHaveLength(4);
    const b = bounds(p);
    expect(b.minX).toBeCloseTo(4); expect(b.maxX).toBeCloseTo(6); expect(b.minY).toBeCloseTo(3.5); expect(b.maxY).toBeCloseTo(4.5);
  });
  test('rotation 90° : largeur et profondeur échangées, aire conservée', () => {
    const p = itemPolygon({ x: 0, y: 0, width: 2, depth: 1, rotation: 90 });
    const b = bounds(p);
    expect(b.width).toBeCloseTo(1); expect(b.height).toBeCloseTo(2);
    expect(polygonArea(p)).toBeCloseTo(2);
  });
  test('cercle échantillonné', () => {
    const p = itemPolygon({ x: 1, y: 1, radius: 1.5, width: 3, depth: 3 });
    expect(p).toHaveLength(24);
    for (const q of p) expect(Math.hypot(q.x - 1, q.y - 1)).toBeCloseTo(1.5);
  });
});

describe('côtés et ouvertures', () => {
  test('boundarySides : fermé = n côtés, ouvert = n-1', () => {
    const g = jardin();
    expect(boundarySides(g)).toHaveLength(4);
    g.boundaryClosed = false;
    expect(boundarySides(g)).toHaveLength(3);
  });
  test('obstacleSides : maison fermée, mur ouvert', () => {
    expect(obstacleSides({ kind: 'house', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] })).toHaveLength(4);
    expect(obstacleSides({ kind: 'wall', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] })).toHaveLength(2);
    expect(obstacleSides({ kind: 'tree', center: { x: 0, y: 0 }, radius: 1 })).toHaveLength(0);
  });
  test('openingGeometry sur le contour : segment centré, normale vers l’extérieur', () => {
    const g = jardin();
    const op = createOpening('gate', { type: 'boundary', side: 0 }, 0.5);
    const og = openingGeometry(g, op);
    expect(og.width).toBe(3);
    expect(og.center).toEqual({ x: 6, y: 0 });
    expect(og.a.x).toBeCloseTo(4.5); expect(og.b.x).toBeCloseTo(7.5);
    expect(og.normal.x).toBeCloseTo(0); expect(og.normal.y).toBeCloseTo(-1);
    // côté du bas : l'extérieur est vers le bas
    const bas = openingGeometry(g, createOpening('wicket', { type: 'boundary', side: 2 }, 0.5));
    expect(bas.normal.y).toBeCloseTo(1);
  });
  test('openingGeometry : sens antihoraire, position bornée et largeur limitée au côté', () => {
    const g = jardin();
    g.boundary.reverse();
    const og = openingGeometry(g, { id: 'x', kind: 'gate', ref: { type: 'boundary', side: 0 }, t: 0, width: 3 });
    expect(og.a.y).toBeCloseTo(8); // le côté 0 est désormais en bas (0,8)->(12,8)? sommets inversés
    expect(og.normal.y).toBeCloseTo(1);
    const g2 = jardin();
    const o = openingGeometry(g2, { id: 'y', kind: 'gate', ref: { type: 'boundary', side: 0 }, t: 0.01, width: 3 });
    expect(o.a.x).toBeGreaterThanOrEqual(-1e-9);
    const trop = openingGeometry(g2, { id: 'z', kind: 'gate', ref: { type: 'boundary', side: 0 }, t: 0.5, width: 50 });
    expect(trop.width).toBe(12);
  });
  test('ouverture sur un côté de maison', () => {
    const g = jardin();
    g.obstacles.push({ id: 'h1', kind: 'house', points: [{ x: 2, y: 2 }, { x: 8, y: 2 }, { x: 8, y: 6 }, { x: 2, y: 6 }], height: 6 });
    const og = openingGeometry(g, createOpening('garage', { type: 'obstacle', obstacleId: 'h1', side: 2 }, 0.5));
    expect(og.center).toEqual({ x: 5, y: 6 });
    expect(og.normal.y).toBeCloseTo(1); // vers l'extérieur de la maison
    expect(og.width).toBeCloseTo(2.4);
  });
  test('côté inexistant → null', () => {
    const g = jardin();
    expect(openingGeometry(g, createOpening('gate', { type: 'boundary', side: 9 }))).toBeNull();
    expect(openingGeometry(g, createOpening('door', { type: 'obstacle', obstacleId: 'nope', side: 0 }))).toBeNull();
  });
  test('snapOpeningToSides : côté le plus proche, filtré par type', () => {
    const g = jardin();
    g.obstacles.push({ id: 'h1', kind: 'house', points: [{ x: 2, y: 2 }, { x: 8, y: 2 }, { x: 8, y: 6 }, { x: 2, y: 6 }], height: 6 });
    g.obstacles.push({ id: 't1', kind: 'tree', center: { x: 10, y: 4 }, radius: 1 });
    const s = snapOpeningToSides(g, { x: 5, y: 0.3 });
    expect(s.ref).toEqual({ type: 'boundary', side: 0 });
    expect(s.t).toBeCloseTo(5 / 12);
    const m = snapOpeningToSides(g, { x: 5, y: 2.4 });
    expect(m.ref).toEqual({ type: 'obstacle', obstacleId: 'h1', side: 0 });
    expect(m.t).toBeCloseTo(0.5);
    // un garage ne se pose que sur maison / abri, même si le contour est plus proche
    const gar = snapOpeningToSides(g, { x: 5, y: 0.3 }, { kind: 'garage' });
    expect(gar.ref.type).toBe('obstacle');
    expect(snapOpeningToSides(g, { x: 5, y: 0.3 }, { maxDist: 0.1 })).toBeNull();
    const vide = jardin(); vide.boundary = [];
    expect(snapOpeningToSides(vide, { x: 0, y: 0 }, { kind: 'garage' })).toBeNull();
  });
});

describe('edgeObstacles / itemObstacles', () => {
  test('côtés mur/clôture/haie → obstacles linéaires avec hauteurs par défaut', () => {
    const g = jardin();
    g.boundaryEdges = [{ kind: 'wall', height: 2 }, { kind: 'fence', height: 0 }, { kind: 'open', height: 0 }, { kind: 'hedge' }];
    const obs = edgeObstacles(g);
    expect(obs.map((o) => o.kind)).toEqual(['wall', 'fence', 'hedge']);
    expect(obs[0].points).toEqual([{ x: 0, y: 0 }, { x: 12, y: 0 }]);
    expect(obs.map((o) => o.height)).toEqual([2, 1.2, 1.8]);
    expect(edgeObstacles(createGarden())).toEqual([]);
  });
  test('hauteur personnalisée', () => {
    const g = jardin();
    g.boundaryEdges = [{ kind: 'wall', height: 3.2 }];
    expect(edgeObstacles(g)[0].height).toBe(3.2);
  });
  test('itemObstacles : seuls les éléments hauts projettent une ombre', () => {
    const g = jardin();
    g.items = [createItem('bench', 2, 2), createItem('pergola', 6, 4), createItem('parasol', 9, 4)];
    const obs = itemObstacles(g);
    expect(obs.map((o) => o.itemKind)).toEqual(['pergola', 'parasol']);
    expect(obs[0].height).toBe(2.4);
    expect(obs[1].points).toHaveLength(24);
  });
  test('prix total', () => {
    const g = jardin();
    g.items = [createItem('bench', 1, 1), createItem('bench', 3, 1)];
    expect(itemsTotalPrice(g)).toBe(180);
  });
});

describe('rendu SVG des aménagements', () => {
  test('éléments, côtés et ouvertures dessinés ; légende', () => {
    const g = jardin();
    g.items = [createItem('bench', 3, 3, 30), createItem('table_round', 6, 4)];
    g.boundaryEdges = [{ kind: 'wall', height: 2 }, { kind: 'hedge', height: 1.8 }];
    g.obstacles.push({ id: 'h1', kind: 'house', points: [{ x: 2, y: 2 }, { x: 8, y: 2 }, { x: 8, y: 6 }, { x: 2, y: 6 }], height: 6 });
    g.openings = [createOpening('gate', { type: 'boundary', side: 2 }), createOpening('garage', { type: 'obstacle', obstacleId: 'h1', side: 2 }), createOpening('double_gate', { type: 'boundary', side: 3 })];
    const svg = renderItemsSVG(g, { scale: 40 });
    expect(svg).toContain('data-kind="bench"');
    expect(svg).toContain('<circle'); // table ronde
    expect(svg).toContain('data-kind="wall"'); expect(svg).toContain('data-kind="hedge"');
    expect(svg).toContain('data-opening'); expect(svg).toContain('Portail 3,00 m');
    expect(svg).toContain('Porte de garage 2,40 m');
    expect(svg).toContain('stroke-dasharray'); // rail / arc
    const lg = itemsLegendEntries(g);
    expect(lg.map((e) => e.id)).toEqual(expect.arrayContaining(['bench', 'table_round', 'wall', 'hedge', 'gate', 'garage', 'double_gate']));
    expect(lg.find((e) => e.id === 'bench').count).toBe(1);
  });
  test('jardin sans aménagement : chaîne vide, légende vide', () => {
    expect(renderItemsSVG(jardin(), { scale: 10 })).toBe('');
    expect(itemsLegendEntries(jardin())).toEqual([]);
  });
  test('échappe les noms personnalisés', () => {
    const g = jardin();
    const b = createItem('bench', 3, 3); b.label = '<b>"x"</b>';
    g.items = [b];
    expect(renderItemsSVG(g, { scale: 80 })).not.toContain('<b>');
  });
});
