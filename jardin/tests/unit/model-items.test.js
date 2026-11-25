import { createGarden, createItem, createOpening, validateGarden, ensureAmenagements } from '../../model.js';
import { createStorage, createMemoryBackend } from '../../storage.js';

const carre = () => {
  const g = createGarden('M');
  g.boundary = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 8 }, { x: 0, y: 8 }];
  g.boundaryClosed = true;
  return g;
};

describe('modèle : aménagements', () => {
  test('createGarden initialise items, boundaryEdges, openings', () => {
    const g = createGarden();
    expect(g.items).toEqual([]); expect(g.boundaryEdges).toEqual([]); expect(g.openings).toEqual([]);
  });
  test('createItem / createOpening', () => {
    const b = createItem('bench', 3, 2, 90);
    expect(b).toMatchObject({ kind: 'bench', x: 3, y: 2, rotation: 90, width: 1.5, depth: 0.5 });
    expect(b.radius).toBeUndefined();
    const t = createItem('table_round', 1, 1);
    expect(t.radius).toBeCloseTo(0.6);
    expect(() => createItem('zzz')).toThrow();
    const op = createOpening('garage', { type: 'obstacle', obstacleId: 'h', side: 1 }, 0.3);
    expect(op).toMatchObject({ kind: 'garage', t: 0.3, width: 2.4, swing: 'sliding' });
    expect(() => createOpening('zzz', {})).toThrow();
  });
  test('validateGarden : élément hors du terrain, ouverture sans côté', () => {
    const g = carre();
    g.items = [createItem('bench', 3, 3), createItem('table', 20, 3)];
    g.openings = [createOpening('gate', { type: 'boundary', side: 1 }), createOpening('gate', { type: 'boundary', side: 7 })];
    const r = validateGarden(g);
    expect(r.ok).toBe(true);
    expect(r.warnings.filter((w) => /Élément/.test(w))).toHaveLength(1);
    expect(r.warnings.find((w) => /Table/.test(w))).toMatch(/sort du contour/);
    expect(r.warnings.filter((w) => /Ouverture/.test(w))).toHaveLength(1);
  });
  test('jardin ancien sans les champs : valeurs par défaut, aucun avertissement', () => {
    const g = carre();
    delete g.items; delete g.boundaryEdges; delete g.openings;
    expect(validateGarden(g).warnings).toEqual([]);
    ensureAmenagements(g);
    expect(g.items).toEqual([]); expect(g.openings).toEqual([]);
  });
  test('stockage : getGarden et import complètent les champs absents', async () => {
    const backend = createMemoryBackend();
    const storage = createStorage(backend);
    const g = carre();
    delete g.items; delete g.boundaryEdges; delete g.openings;
    await backend.put('gardens', g.id, g);
    const lu = await storage.getGarden(g.id);
    expect(lu.items).toEqual([]); expect(lu.boundaryEdges).toEqual([]); expect(lu.openings).toEqual([]);
    expect((await storage.listGardens())[0].items).toEqual([]);
    const brut = JSON.parse(storage.exportGarden(carre()));
    delete brut.garden.items; delete brut.garden.openings;
    const imp = await storage.importGarden(brut);
    expect(imp.items).toEqual([]); expect(imp.openings).toEqual([]);
  });
  test('aller-retour de stockage des aménagements', async () => {
    const storage = createStorage(createMemoryBackend());
    const g = carre();
    g.items = [createItem('bench', 3, 3)];
    g.boundaryEdges = [{ kind: 'wall', height: 2 }];
    g.openings = [createOpening('gate', { type: 'boundary', side: 1 })];
    await storage.saveGarden(g);
    const lu = await storage.getGarden(g.id);
    expect(lu.items[0].kind).toBe('bench');
    expect(lu.boundaryEdges[0]).toEqual({ kind: 'wall', height: 2 });
    expect(lu.openings[0].ref).toEqual({ type: 'boundary', side: 1 });
  });
});
