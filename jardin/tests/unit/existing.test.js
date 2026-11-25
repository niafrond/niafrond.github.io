import { createGarden } from '../../model.js';
import { validateGarden, ensureAmenagements } from '../../model.js';
import {
  createExisting, ensureExisting, existingFootprint, existingFootprints, existingShadowObstacles, existingSummary, existingForRender,
  setFenceMaterial, sizeForPlant, EXISTING_KINDS,
} from '../../existing.js';
import { polygonArea } from '../../geometry.js';
import { getPlant } from '../../catalog.js';
import { snapOpeningToSides, openingGeometry } from '../../items.js';
import { createOpening } from '../../model.js';
import { existingAdvice } from '../../advice.js';

const carre = () => { const g = createGarden('t'); g.boundary = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 8 }, { x: 0, y: 8 }]; g.boundaryClosed = true; return g; };

describe('existing.js', () => {
  test('types et valeurs typiques', () => {
    expect(EXISTING_KINDS.map((k) => k.id)).toEqual(['tree', 'shrub', 'hedge', 'climber', 'perennial', 'fence', 'other']);
    const a = createExisting('tree', { x: 3, y: 4 });
    expect(a).toMatchObject({ kind: 'tree', x: 3, y: 4, height: 8, width: 5, keep: true, plantId: null, label: 'Arbre existant' });
    const h = createExisting('hedge', [{ x: 0, y: 0 }, { x: 4, y: 0 }]);
    expect(h.points).toHaveLength(2); expect(h).toMatchObject({ height: 1.8, width: 0.8 });
    expect(() => createExisting('zzz')).toThrow();
  });
  test('migration des obstacles arbres, idempotente, ids conservés', () => {
    const g = carre();
    g.obstacles = [{ id: 'o_t', kind: 'tree', center: { x: 5, y: 5 }, radius: 2, height: 9 }, { id: 'o_m', kind: 'house', points: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }], height: 5 }];
    ensureExisting(g); ensureExisting(g); ensureAmenagements(g);
    expect(g.obstacles.map((o) => o.id)).toEqual(['o_m']);
    expect(g.existing).toHaveLength(1);
    expect(g.existing[0]).toMatchObject({ id: 'o_t', kind: 'tree', x: 5, y: 5, height: 9, width: 4, keep: true });
  });
  test('createGarden a existing = []', () => { expect(createGarden().existing).toEqual([]); });
  test('empreintes : disque et bande de haie', () => {
    const t = createExisting('tree', { x: 0, y: 0 });
    expect(polygonArea(existingFootprint(t))).toBeCloseTo(Math.PI * 2.5 * 2.5, 0);
    const h = createExisting('hedge', [{ x: 0, y: 0 }, { x: 10, y: 0 }]);
    expect(polygonArea(existingFootprint(h))).toBeCloseTo(8, 1);
    const g = carre(); g.existing = [t, h]; h.keep = false;
    expect(existingFootprints(g)).toHaveLength(1);
    expect(existingFootprints(g, { includeRemoved: true })).toHaveLength(2);
  });
  test('ombre : disque pour un arbre, ligne pour une haie, rien si à retirer', () => {
    const g = carre();
    const t = createExisting('tree', { x: 6, y: 4 }); const h = createExisting('hedge', [{ x: 0, y: 1 }, { x: 5, y: 1 }]);
    g.existing = [t, h];
    const obs = existingShadowObstacles(g);
    expect(obs[0]).toMatchObject({ kind: 'tree', center: { x: 6, y: 4 }, radius: 2.5, height: 8 });
    expect(obs[1]).toMatchObject({ kind: 'hedge', height: 1.8 }); expect(obs[1].points).toHaveLength(2);
    t.keep = false;
    expect(existingShadowObstacles(g)).toHaveLength(1);
  });
  test('résumé', () => {
    const g = carre();
    expect(existingSummary(g).text).toBe('Aucun existant');
    g.existing = [createExisting('tree', { x: 1, y: 1 }), createExisting('tree', { x: 2, y: 2 }), createExisting('hedge', [{ x: 0, y: 0 }, { x: 1, y: 0 }])];
    g.existing[1].keep = false;
    const s = existingSummary(g);
    expect(s).toMatchObject({ total: 3, toRemove: 1, text: '3 existants : 2 arbres, 1 haie' });
  });
  test('tailles par âge', () => {
    const p = getPlant('erable-champetre');
    expect(sizeForPlant(p, 'adult')).toEqual({ height: 10, width: 6 });
    expect(sizeForPlant(p, 'young').height).toBeLessThan(5);
  });
  test('existingForRender : plante, port, matériau', () => {
    const g = carre();
    const t = createExisting('tree', { x: 1, y: 1 }); t.plantId = 'erable-champetre';
    const f = createExisting('fence', [{ x: 0, y: 0 }, { x: 3, y: 0 }]); setFenceMaterial(f, 'metal');
    g.existing = [t, createExisting('shrub', { x: 2, y: 2 }), f];
    const r = existingForRender(g);
    expect(r[0].plant.id).toBe('erable-champetre'); expect(r[0].habit.id).toBeTruthy();
    expect(r[1]).toMatchObject({ plant: null }); expect(r[1].habit.id).toBe('shrub-round');
    expect(r[2]).toMatchObject({ kind: 'fence', material: 'metal', height: 1.5 }); expect(r[2].habit).toBeNull();
  });
  test('clôture : matériaux, hauteur, ombre (métal ajouré = presque aucune)', () => {
    const g = carre();
    const f = createExisting('fence', [{ x: 0, y: 0 }, { x: 3, y: 0 }]);
    expect(f).toMatchObject({ material: 'wood', height: 1.2 });
    setFenceMaterial(f, 'concrete'); expect(f.height).toBe(1.8); expect(f.width).toBe(0.15);
    g.existing = [f];
    expect(existingShadowObstacles(g)[0]).toMatchObject({ kind: 'fence', height: 1.8, thickness: 0.15, opacity: 1 });
    setFenceMaterial(f, 'metal');
    expect(existingShadowObstacles(g)).toHaveLength(0);
  });
  test('ouvertures posables sur une clôture existante', () => {
    const g = carre();
    const f = createExisting('fence', [{ x: 2, y: 4 }, { x: 6, y: 4 }, { x: 6, y: 7 }]);
    g.existing = [f];
    const s = snapOpeningToSides(g, { x: 4, y: 4.1 }, { kind: 'gate', maxDist: 0.5 });
    expect(s.ref).toEqual({ type: 'existing', existingId: f.id, side: 0 });
    const op = createOpening('gate', s.ref, 0.5);
    expect(openingGeometry(g, op).center.x).toBeCloseTo(4, 3);
    expect(snapOpeningToSides(g, { x: 4, y: 4.1 }, { kind: 'door', maxDist: 0.5 })).toBeNull();
  });
  test('validateGarden : existant hors du terrain = avertissement', () => {
    const g = carre(); g.existing = [createExisting('tree', { x: 30, y: 30 }), createExisting('tree', { x: 5, y: 5 })];
    const v = validateGarden(g);
    expect(v.ok).toBe(true);
    expect(v.warnings.filter((w) => w.includes('existante'))).toHaveLength(1);
  });
  test('conseils : espèce connue (catalogue) ou génériques ; liste à retirer', () => {
    const g = carre();
    const a = createExisting('tree', { x: 1, y: 1 }); a.plantId = 'erable-champetre';
    const b = createExisting('shrub', { x: 2, y: 2 }); const c = createExisting('tree', { x: 3, y: 3 }); c.keep = false;
    g.existing = [a, b, c];
    const adv = existingAdvice(g, { month: 12 });
    expect(adv.entries).toHaveLength(2);
    expect(adv.entries[0].known).toBe(true); expect(adv.entries[0].now.join(' ')).toContain('Tailler');
    expect(adv.entries[1].known).toBe(false);
    expect(adv.toRemove).toHaveLength(1);
  });
});
