import { createZone, getZoneType, poolVariant, isAbovePool, setPoolVariant, validateGarden, createGarden } from '../../model.js';

const shape = { kind: 'circle', center: { x: 5, y: 5 }, radius: 2 };

describe('piscine : variante enterrée / hors sol', () => {
  test('createZone met « inground » pour une piscine, rien pour les autres', () => {
    expect(createZone('pool', shape).variant).toBe('inground');
    expect(createZone('pond', shape).variant).toBeUndefined();
  });
  test('rétro-compatibilité : variante absente = enterrée', () => {
    const z = createZone('pool', shape); delete z.variant;
    expect(poolVariant(z)).toBe('inground'); expect(isAbovePool(z)).toBe(false);
    expect(poolVariant(createZone('lawn', shape))).toBeNull();
  });
  test('la piscine accepte polygone et cercle', () => {
    expect(getZoneType('pool').shapeKinds).toEqual(expect.arrayContaining(['polygon', 'circle']));
  });
  test('libellé par défaut suivi, nom saisi jamais écrasé', () => {
    const z = createZone('pool', shape);
    setPoolVariant(z, 'above');
    expect(z.variant).toBe('above'); expect(z.label).toBe('Piscine hors sol'); expect(isAbovePool(z)).toBe(true);
    setPoolVariant(z, 'inground');
    expect(z.label).toBe('Piscine');
    z.label = 'Piscine 2'; setPoolVariant(z, 'above'); expect(z.label).toBe('Piscine hors sol 2');
    z.label = 'Ma grande bleue'; setPoolVariant(z, 'inground'); setPoolVariant(z, 'above');
    expect(z.label).toBe('Ma grande bleue');
  });
  test('setPoolVariant ignore les autres types', () => {
    const z = createZone('pond', shape); setPoolVariant(z, 'above');
    expect(z.variant).toBeUndefined();
  });
  test('validateGarden : aucune erreur nouvelle pour une piscine hors sol', () => {
    const g = createGarden('v');
    g.boundary = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 8 }, { x: 0, y: 8 }]; g.boundaryClosed = true;
    const z = createZone('pool', shape); setPoolVariant(z, 'above'); g.zones.push(z);
    const before = validateGarden({ ...g, zones: [createZone('pool', shape)] });
    const after = validateGarden(g);
    expect(after.errors || after).toEqual(before.errors || before);
  });
});
