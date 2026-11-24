import {
  ZONE_TYPES, SUN_LEVELS, WATER_NEEDS, PLANT_CATEGORIES, SOILS, ORIENTATIONS, newId,
  createGarden, createZone, getZoneType, validateGarden,
} from '../../model.js';

const carre = (x, y, s) => [{ x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }];
const jardin = (s = 10) => {
  const g = createGarden('Test');
  g.boundary = carre(0, 0, s);
  g.boundaryClosed = true;
  return g;
};
const poly = (pts) => ({ kind: 'polygon', points: pts });

describe('constantes', () => {
  test('ZONE_TYPES : ids du contrat', () => {
    expect(ZONE_TYPES.map((t) => t.id)).toEqual(['pond', 'pool', 'terrace', 'path', 'lawn', 'lowplants', 'midplants', 'tallplants', 'hedge', 'trees', 'vegetable', 'orchard', 'other']);
    for (const t of ZONE_TYPES) {
      expect(typeof t.label).toBe('string');
      expect(t.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(['ground', 'canopy']).toContain(t.layer);
      expect(t.shapeKinds.length).toBeGreaterThan(0);
      expect([null, 'full', 'partial', 'shade']).toContain(t.minSun);
    }
    expect(getZoneType('hedge').shapeKinds).toContain('line');
    expect(getZoneType('nope')).toBeUndefined();
  });
  test('autres énumérations', () => {
    expect(SUN_LEVELS).toEqual(['full', 'partial', 'shade']);
    expect(WATER_NEEDS).toEqual(['low', 'medium', 'high']);
    expect(PLANT_CATEGORIES).toHaveLength(12);
    expect(SOILS).toEqual(['clay', 'limestone', 'sandy', 'loam', 'humus']);
    expect(ORIENTATIONS.map((o) => o.id)).toEqual(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);
    expect(ORIENTATIONS.find((o) => o.id === 'S').azimuth).toBe(180);
  });
  test('newId unique', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newId()));
    expect(ids.size).toBe(200);
  });
});

describe('création', () => {
  test('createGarden', () => {
    const g = createGarden('Mon pré');
    expect(g).toMatchObject({ name: 'Mon pré', status: 'draft', boundary: [], boundaryClosed: false, zones: [], obstacles: [], wishedZoneTypes: [] });
    expect(g.context).toMatchObject({ location: null, northAngle: 0, orientation: null, roofArea: null });
    expect(g.sun).toEqual({ mode: 'unknown', uniform: null, regions: [] });
    expect(g.plan).toEqual({ svg: null, validatedAt: null });
  });
  test('createZone', () => {
    const z = createZone('lawn', poly(carre(0, 0, 2)));
    expect(z).toMatchObject({ type: 'lawn', label: 'Pelouse', plantings: [], notes: '' });
    expect(z.id).toBeTruthy();
    expect(() => createZone('xx', null)).toThrow(/inconnu/);
  });
});

describe('validateGarden', () => {
  test('jardin valide', () => {
    const g = jardin();
    g.zones.push(createZone('lawn', poly(carre(1, 1, 4))));
    expect(validateGarden(g)).toEqual({ ok: true, errors: [], warnings: [] });
  });
  test('contour manquant / non fermé / auto-intersecté / trop petit', () => {
    expect(validateGarden(createGarden()).ok).toBe(false);
    const ouvert = jardin(); ouvert.boundaryClosed = false;
    expect(validateGarden(ouvert).errors.join()).toMatch(/fermé/);
    const x = jardin(); x.boundary = [{ x: 0, y: 0 }, { x: 4, y: 4 }, { x: 4, y: 0 }, { x: 0, y: 4 }];
    expect(validateGarden(x).errors.join()).toMatch(/croise/);
    const petit = jardin(1);
    expect(validateGarden(petit).errors.join()).toMatch(/1 m²/);
  });
  test('zone hors contour : avertissement', () => {
    const g = jardin();
    g.zones.push(createZone('lawn', poly(carre(8, 8, 5))));
    const r = validateGarden(g);
    expect(r.ok).toBe(true);
    expect(r.warnings.join()).toMatch(/sort du contour/);
  });
  test('chevauchement au sol, mais pas arbre sur pelouse', () => {
    const g = jardin();
    g.zones.push(createZone('lawn', poly(carre(0, 0, 6))));
    g.zones.push(createZone('terrace', poly(carre(4, 4, 4))));
    g.zones.push(createZone('trees', { kind: 'circle', center: { x: 2, y: 2 }, radius: 1.5 }));
    const w = validateGarden(g).warnings;
    expect(w.filter((m) => /chevauchent/.test(m))).toHaveLength(1);
    expect(w.join()).toMatch(/Pelouse.*Terrasse/);
  });
  test('zones souhaitées sans forme', () => {
    const g = jardin();
    g.wishedZoneTypes = ['pond', 'lawn'];
    g.zones.push(createZone('lawn', poly(carre(0, 0, 3))));
    const w = validateGarden(g).warnings;
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/Mare/);
  });
  test('zone invalide : erreur', () => {
    const g = jardin();
    g.zones.push({ id: 'a', type: 'lawn', label: 'X', shape: poly([{ x: 0, y: 0 }, { x: 1, y: 1 }]), plantings: [], notes: '' });
    g.zones.push({ id: 'b', type: 'inconnu', label: 'Y', shape: poly(carre(0, 0, 2)), plantings: [], notes: '' });
    const r = validateGarden(g);
    expect(r.ok).toBe(false);
    expect(r.errors).toHaveLength(2);
  });
});
