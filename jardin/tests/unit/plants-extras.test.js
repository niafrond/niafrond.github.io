import { plants, plantsById, mergeExtras } from '../../data/plants/index.js';

test('mergeExtras ajoute les champs, null si absents, sans muter', () => {
  const src = [{ id: 'a', commonName: 'A' }, { id: 'b', commonName: 'B' }];
  const out = mergeExtras(src, { a: { priceEur: 5, priceUnit: 'plant', priceNote: 'pot', flowerColor: '#ff0000', foliageColor: '#00ff00', wiki: 'A' } }, { c: {} });
  expect(out[0]).toMatchObject({ priceEur: 5, priceUnit: 'plant', priceNote: 'pot', flowerColor: '#ff0000', foliageColor: '#00ff00', wiki: 'A' });
  expect(out[1]).toMatchObject({ priceEur: null, flowerColor: null, wiki: null });
  expect(src[0].priceEur).toBeUndefined();
});

test('le catalogue fusionné porte les extras', () => {
  expect(plants.length).toBeGreaterThan(200);
  expect(Object.keys(plantsById)).toHaveLength(plants.length);
  const priced = plants.filter((p) => typeof p.priceEur === 'number');
  expect(priced.length / plants.length).toBeGreaterThan(0.9);
  for (const p of priced) { expect(['plant', 'bulb', 'm2']).toContain(p.priceUnit); expect(p.priceEur).toBeGreaterThan(0); }
});
