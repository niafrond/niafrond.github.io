import { suggestSelection } from '../../recommend.js';
import { zoneCost } from '../../pricing.js';

const sq = (w, h) => ({ kind: 'polygon', points: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }] });
const mk = (id, o) => ({
  id, commonName: id, latinName: id + ' x', category: 'perennial', heightAdult: 0.6, widthAdult: 0.5, sun: ['full'], hardiness: -20,
  water: 'medium', soil: [], foliage: 'deciduous', bloom: [6], zones: ['midplants'], maintenance: 'low', kc: 0.7, spacing: 0.5,
  priceEur: 5, priceUnit: 'plant', ...o,
});
const garden = (z) => ({ id: 'g', context: { departement: '75' }, sun: { mode: 'uniform', uniform: 'full', regions: [] }, zones: [z] });
const z = { id: 'z', type: 'midplants', shape: sq(6, 5), plantings: [] };
const plants = [mk('cher', { priceEur: 40, heightAdult: 1.2, bloom: [4, 5] }), mk('moyen', { priceEur: 8, bloom: [7, 8] }), mk('bon', { priceEur: 2, heightAdult: 2, bloom: [9] }), mk('autre', { priceEur: 3, heightAdult: 0.2, bloom: [3] })];
const costOf = (sel) => zoneCost({ ...z, plantings: sel }, Object.fromEntries(plants.map((p) => [p.id, p]))).total;

test('sans budget : comportement inchangé et déterministe', () => {
  const a = suggestSelection(garden(z), z, { seed: 3, plants });
  expect(a).toEqual(suggestSelection(garden(z), z, { seed: 3, plants, budget: undefined }));
  expect(a.length).toBeGreaterThan(0);
});

test('budget : le coût reste sous le plafond quand c’est possible', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const base = suggestSelection(garden(z), z, { seed, plants });
    const cap = Math.max(20, Math.floor(costOf(base) / 3));
    const sel = suggestSelection(garden(z), z, { seed, plants, budget: cap });
    expect(sel.length).toBeGreaterThan(0);
    expect(costOf(sel)).toBeLessThanOrEqual(cap + 1e-9);
    expect(costOf(sel)).toBeLessThanOrEqual(costOf(base));
  }
});

test('budget irréalisable : au moins une essence, un plant minimum', () => {
  const sel = suggestSelection(garden(z), z, { seed: 1, plants, budget: 0.5 });
  expect(sel).toHaveLength(1);
  expect(sel[0].count).toBe(1);
  expect(suggestSelection(garden(z), z, { seed: 1, plants, budget: -3 })).toEqual(suggestSelection(garden(z), z, { seed: 1, plants }));
});

test('graines différentes → propositions différentes', () => {
  const seen = new Set();
  for (let s = 1; s <= 8; s++) seen.add(JSON.stringify(suggestSelection(garden(z), z, { seed: s, plants })));
  expect(seen.size).toBeGreaterThan(1);
});
