// Ports des plantes (habits.js + data/plants/habits-tags.js).
import { HABITS, HABIT_IDS, SUPPORTS, getHabit, habitOf, habitParams, describeHabit } from '../../habits.js';
import TAGS from '../../data/plants/habits-tags.js';
import { plants, plantsById } from '../../data/plants/index.js';

const REQUIRED = ['tree-round', 'tree-spreading', 'tree-columnar', 'tree-conical', 'tree-weeping', 'tree-vase', 'tree-umbrella', 'tree-fruit', 'palm',
  'shrub-round', 'shrub-upright', 'shrub-arching', 'shrub-mound', 'shrub-conical', 'shrub-columnar', 'bamboo', 'hedge-clipped', 'climber', 'vine',
  'perennial-clump', 'perennial-upright', 'perennial-mound', 'groundcover-mat', 'groundcover-creeping', 'grass-arching', 'grass-upright', 'grass-fine',
  'fern', 'rosette', 'bulb-spike', 'bulb-clump', 'aquatic-floating', 'aquatic-reed', 'aquatic-marginal', 'vegetable-row', 'vegetable-climbing', 'herb-bush', 'lawn'];
const TRUNKS = ['none', 'short', 'tall', 'multi'];
const LEAVES = ['broad', 'needle', 'blade', 'frond', 'fine', 'palm', 'floating', 'none'];
const FLOWERS = ['canopy', 'spikes', 'scattered', 'umbels', 'none'];

describe('table des ports', () => {
  test('tous les ports demandés existent, sans doublon', () => {
    for (const id of REQUIRED) expect(getHabit(id)).toBeTruthy();
    expect(new Set(HABIT_IDS).size).toBe(HABITS.length);
  });
  test('champs valides', () => {
    for (const h of HABITS) {
      expect(typeof h.label).toBe('string');
      expect(h.ratio).toBeGreaterThan(0);
      expect(TRUNKS).toContain(h.trunk);
      expect(LEAVES).toContain(h.leaf);
      expect(FLOWERS).toContain(h.flowerStyle);
      for (const k of ['density', 'spread']) { expect(h[k]).toBeGreaterThanOrEqual(0); expect(h[k]).toBeLessThanOrEqual(1); }
      if (h.stems) { expect(h.stems.min).toBeGreaterThanOrEqual(1); expect(h.stems.max).toBeGreaterThanOrEqual(h.stems.min); }
      if (h.support) expect(SUPPORTS).toContain(h.support);
    }
  });
  test('colonnes élancées, bambou à plusieurs tiges, grimpantes avec support', () => {
    expect(getHabit('tree-columnar').ratio).toBeGreaterThanOrEqual(3);
    expect(getHabit('shrub-columnar').ratio).toBeGreaterThanOrEqual(3);
    expect(getHabit('bamboo').stems.min).toBeGreaterThan(1);
    expect(getHabit('climber').support).toBeTruthy();
  });
  test('getHabit inconnu → null', () => expect(getHabit('nope')).toBeNull());
});

describe('tags des essences', () => {
  test('tous les ids sont couverts, aucun id inventé', () => {
    const ids = plants.map((p) => p.id);
    expect(ids.length).toBe(213);
    expect(ids.filter((id) => !TAGS[id])).toEqual([]);
    expect(Object.keys(TAGS).filter((id) => !plantsById[id])).toEqual([]);
  });
  test('ports et supports valides', () => {
    for (const [id, t] of Object.entries(TAGS)) {
      expect(HABIT_IDS).toContain(t.habit);
      if (t.support) expect(SUPPORTS).toContain(t.support);
      if (t.stems) expect(t.stems.max).toBeGreaterThanOrEqual(t.stems.min);
      expect(id).toBeTruthy();
    }
  });
  test('couverture : au moins 15 ports utilisés', () => {
    const used = new Set(Object.values(TAGS).map((t) => t.habit));
    expect(used.size).toBeGreaterThanOrEqual(15);
  });
  test('exemples horticoles', () => {
    const h = (id) => habitOf(plantsById[id]).id;
    expect(h('bambou-fargesia')).toBe('bamboo');
    expect(h('cypres-de-provence')).toBe('tree-columnar');
    expect(h('if-commun')).toBe('shrub-columnar');
    expect(h('olivier')).toBe('tree-round');
    expect(h('h-nenuphar')).toBe('aquatic-floating');
    expect(h('h-hosta')).toBe('rosette');
    expect(h('h-fougere-male')).toBe('fern');
    expect(h('h-miscanthus')).toBe('grass-arching');
    expect(h('h-calamagrostis')).toBe('grass-upright');
    expect(h('h-festuca-glauca')).toBe('grass-fine');
    expect(h('h-tomate')).toBe('vegetable-climbing');
    expect(h('glycine')).toBe('climber');
    expect(h('pin-noir-autriche')).toBe('tree-umbrella');
    for (const p of plants.filter((x) => x.category === 'climber')) expect(['climber', 'vine']).toContain(h(p.id));
  });
});

describe('habitParams', () => {
  test('valeurs positives et jeunes < adultes pour toutes les essences', () => {
    for (const p of plants) {
      const a = habitParams(p, { age: 1 });
      const y = habitParams(p, { age: 0 });
      expect(a.height).toBeGreaterThan(0);
      expect(a.width).toBeGreaterThan(0);
      expect(a.ratio).toBeGreaterThan(0);
      expect(a.density).toBeGreaterThanOrEqual(0);
      expect(a.density).toBeLessThanOrEqual(1);
      expect(y.height).toBeLessThan(a.height);
      expect(y.width).toBeLessThan(a.width);
      expect(y.stems).toBeLessThanOrEqual(a.stems);
      expect(a.trunkHeight).toBeLessThan(a.height);
      expect(a.height).toBeCloseTo(p.heightAdult, 5);
    }
  });
  test("'young' / 'adult' équivalents à 0 / 1", () => {
    const p = plantsById['erable-plane'];
    expect(habitParams(p, { age: 'young' }).height).toBeCloseTo(habitParams(p, { age: 0 }).height);
    expect(habitParams(p, { age: 'adult' }).height).toBeCloseTo(p.heightAdult);
  });
  test('les bambous ont plusieurs tiges, les touffes de graminées aussi', () => {
    const b = habitParams(plantsById['bambou-fargesia']);
    expect(b.stems).toBeGreaterThan(5);
    expect(habitParams(plantsById['bambou-fargesia'], { age: 0 }).stems).toBeGreaterThan(1);
    expect(habitParams(plantsById['h-miscanthus']).stems).toBeGreaterThan(10);
    expect(habitParams(plantsById['erable-plane']).stems).toBe(1);
  });
  test('grimpantes : support renseigné', () => {
    expect(habitParams(plantsById['glycine']).support).toBe('pergola');
    expect(habitParams(plantsById['h-tomate']).support).toBe('tripod');
  });
});

describe('habitOf (repli)', () => {
  const base = { heightAdult: 1, widthAdult: 1, foliage: 'deciduous' };
  test('plante sans tag : déduction par catégorie et taille', () => {
    expect(habitOf({ ...base, id: 'x1', category: 'tree', heightAdult: 12, widthAdult: 8 }).id).toBe('tree-round');
    expect(habitOf({ ...base, id: 'x2', category: 'tree', latinName: 'Pinus pinea', heightAdult: 15, widthAdult: 6 }).id).toBe('tree-conical');
    expect(habitOf({ ...base, id: 'x3', category: 'hedge', latinName: 'Phyllostachys aurea', heightAdult: 5 }).id).toBe('bamboo');
    expect(habitOf({ ...base, id: 'x4', category: 'grass', heightAdult: 1.5, widthAdult: 0.6 }).id).toBe('grass-upright');
    expect(habitOf({ ...base, id: 'x5', category: 'perennial', latinName: 'Athyrium filix-femina' }).id).toBe('fern');
    expect(habitOf({ ...base, id: 'x6', category: 'climber', heightAdult: 4 }).id).toBe('climber');
    expect(habitOf({ ...base, id: 'x7', category: 'lawn', heightAdult: 0.08, widthAdult: 0.01 }).id).toBe('lawn');
    expect(habitOf({ ...base, id: 'x8', category: 'inconnue' })).toBeTruthy();
    expect(habitOf(null)).toBeTruthy();
  });
  test('champ habit explicite prioritaire', () => {
    expect(habitOf({ ...base, id: 'erable-plane', category: 'tree', habit: 'palm' }).id).toBe('palm');
  });
});

describe('describeHabit', () => {
  test('phrase française non vide', () => {
    for (const p of plants) {
      const s = describeHabit(p);
      expect(s.length).toBeGreaterThan(15);
      expect(s).toMatch(/\.$/);
    }
    expect(describeHabit(plantsById['bambou-fargesia'])).toMatch(/^Bambou/);
    expect(describeHabit(plantsById['glycine'])).toMatch(/pergola/);
  });
});
