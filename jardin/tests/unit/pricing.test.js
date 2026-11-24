import { plantCost, zoneCost, gardenCost, formatEuro, formatPrice, summarizeGarden, bloomRangeText } from '../../pricing.js';

const sq = (w, h) => ({ kind: 'polygon', points: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }] });
const P = {
  rose: { id: 'rose', priceEur: 12.5, priceUnit: 'plant', priceNote: 'pot 3 L', bloom: [5, 6, 7] },
  tulipe: { id: 'tulipe', priceEur: 0.4, priceUnit: 'bulb', bloom: [4] },
  gazon: { id: 'gazon', priceEur: 0.5, priceUnit: 'm2', bloom: [] },
  inconnue: { id: 'inconnue', priceEur: null, bloom: [9] },
};
const zone = (id, shape, plantings, label = id) => ({ id, label, shape, plantings });

describe('plantCost', () => {
  test('plant et bulbe : quantité × prix', () => {
    expect(plantCost(P.rose, { plantId: 'rose', count: 4 }, zone('z', sq(2, 2)))).toEqual({ qty: 4, unit: 'plant', unitPrice: 12.5, total: 50 });
    expect(plantCost(P.tulipe, { count: 25 }, zone('z', sq(2, 2)))).toEqual({ qty: 25, unit: 'bulb', unitPrice: 0.4, total: 10 });
  });
  test('m² : surface de la zone, indépendante du nombre', () => {
    expect(plantCost(P.gazon, { count: 1 }, zone('z', sq(10, 4)))).toEqual({ qty: 40, unit: 'm2', unitPrice: 0.5, total: 20 });
  });
  test('quantité invalide → 1 ; sans prix → null', () => {
    expect(plantCost(P.rose, { count: 0 }, zone('z', sq(1, 1))).qty).toBe(1);
    expect(plantCost(P.inconnue, { count: 2 }, zone('z', sq(1, 1)))).toBeNull();
    expect(plantCost(null, {}, null)).toBeNull();
  });
  test('arrondi au centime sans erreur flottante', () => {
    expect(plantCost({ priceEur: 0.1, priceUnit: 'plant' }, { count: 3 }, null).total).toBe(0.3);
  });
});

describe('zoneCost / gardenCost', () => {
  const garden = { zones: [
    zone('a', sq(10, 4), [{ plantId: 'rose', count: 2 }, { plantId: 'inconnue', count: 3 }, { plantId: 'absente', count: 1 }], 'Massif'),
    zone('b', sq(5, 2), [{ plantId: 'gazon', count: 1 }, { plantId: 'tulipe', count: 10 }], 'Pelouse'),
    zone('c', sq(1, 1), []),
  ] };
  test('exclut les plantes sans prix du total et les compte', () => {
    const z = zoneCost(garden.zones[0], P);
    expect(z.total).toBe(25);
    expect(z.unknownCount).toBe(2);
    expect(z.lines).toHaveLength(1);
    expect(z.label).toBe('Massif');
  });
  test('total jardin par zone, plantsById en objet, Map ou fonction', () => {
    const g = gardenCost(garden, P);
    expect(g.total).toBe(25 + 5 + 4);
    expect(g.unknownCount).toBe(2);
    expect(g.byZone.map((z) => [z.zoneId, z.total])).toEqual([['a', 25], ['b', 9], ['c', 0]]);
    expect(gardenCost(garden, new Map(Object.entries(P))).total).toBe(34);
    expect(gardenCost(garden, (id) => P[id]).total).toBe(34);
    expect(gardenCost({ zones: [] }, P)).toEqual({ total: 0, byZone: [], unknownCount: 0 });
  });
});

describe('formats', () => {
  test('formatEuro', () => {
    expect(formatEuro(12.5)).toBe('12,50 €');
    expect(formatEuro(0)).toBe('0,00 €');
    expect(formatEuro(1.005)).toBe('1,01 €');
    expect(formatEuro(1234.567)).toBe('1 234,57 €');
    expect(formatEuro(339.6, { digits: 0 })).toBe('340 €');
    expect(formatEuro(NaN)).toBe('0,00 €');
  });
  test('formatPrice (prix unitaire)', () => {
    expect(formatPrice(12)).toBe('12 €');
    expect(formatPrice(0.5)).toBe('0,5 €');
    expect(formatPrice(6.75)).toBe('6,75 €');
  });
  test('résumé du jardin', () => {
    const g = { zones: [zone('a', sq(2, 2), [{ plantId: 'rose', count: 2 }, { plantId: 'tulipe', count: 5 }]), zone('b', sq(2, 2), [{ plantId: 'rose', count: 1 }])] };
    const s = summarizeGarden(g, P);
    expect(s.species).toBe(2);
    expect(s.text).toBe('2 essences, floraison de avril à juillet, ≈ 40 €');
    expect(bloomRangeText([3])).toBe('floraison en mars');
    expect(bloomRangeText([])).toBe('');
    expect(summarizeGarden({ zones: [] }, P).text).toBe('0 essence, ≈ 0 €');
  });
});
