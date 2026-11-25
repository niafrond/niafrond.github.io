import { scorePlant, recommendForZone, suggestSelection, suggestForGarden, contextForZone } from '../../recommend.js';
import { isTypical, plantAmbianceScore } from '../../ambiances.js';
import { createZone, createGarden, validateGarden } from '../../model.js';
import { plants } from '../../data/plants/index.js';

const sq = (w, h) => ({ kind: 'polygon', points: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }] });
const by = (id) => plants.find((p) => p.id === id);
const mkGarden = (zones) => ({ id: 'g', context: { departement: '75' }, sun: { mode: 'uniform', uniform: 'full', regions: [] }, zones });
const massif = (extra = {}) => ({ id: 'z1', type: 'midplants', label: 'Massif', shape: sq(8, 6), plantings: [], ...extra });
const base = { tminC: -5, zoneType: 'midplants', sunLevel: 'full', areaM2: 50, minDimension: 6 };

test('scorePlant : l\'ambiance ajoute une raison et un bonus', () => {
  const lav = by('h-lavande');
  const sans = scorePlant(lav, base);
  const avec = scorePlant(lav, { ...base, ambiance: 'mediterraneen' });
  const r = avec.reasons.find((x) => x.criterion === 'ambiance');
  expect(r).toEqual({ ok: true, criterion: 'ambiance', text: 'Convient à l\'ambiance « méditerranéen »' });
  expect(sans.reasons.some((x) => x.criterion === 'ambiance')).toBe(false);
  expect(avec.rank).toBeGreaterThan(sans.score);
  expect(avec.rank - sans.score).toBeLessThanOrEqual(15);
});

test('scorePlant : malus pour une essence à éviter', () => {
  const thuya = by('thuya');
  const ctx = { ...base, zoneType: 'hedge' };
  const sans = scorePlant(thuya, ctx);
  const avec = scorePlant(thuya, { ...ctx, ambiance: 'sauvage' });
  expect(avec.score).toBeLessThan(sans.score);
  expect(avec.reasons.find((x) => x.criterion === 'ambiance').ok).toBe(false);
});

test('rétro-compatibilité : sans ambiance, résultat identique', () => {
  const lav = by('h-lavande');
  const a = scorePlant(lav, base);
  expect(a).not.toHaveProperty('rank');
  expect(scorePlant(lav, { ...base, ambiance: null })).toEqual(a);
  const z = massif();
  expect(recommendForZone(mkGarden([z]), z).map((r) => r.plant.id))
    .toEqual(recommendForZone(mkGarden([z]), z, { ambiance: null }).map((r) => r.plant.id));
});

test('contexte : zone.ambiance, sinon nom de la zone, null explicite désactive', () => {
  const g = mkGarden([]);
  expect(contextForZone(g, massif({ ambiance: 'zen' })).ambiance).toBe('zen');
  expect(contextForZone(g, massif({ label: 'Massif bucolique' })).ambiance).toBe('bucolique');
  expect(contextForZone(g, massif({ label: 'Massif bucolique' }), { ambiance: null }).ambiance).toBeNull();
  expect(contextForZone(g, massif()).ambiance).toBeNull();
});

test('recommendForZone : l\'ambiance remonte les essences typiques', () => {
  const z = massif();
  const top = (amb) => recommendForZone(mkGarden([z]), z, { ambiance: amb }).slice(0, 15);
  const typ = top('mediterraneen').filter((r) => isTypical(r.plant, 'mediterraneen')).length;
  const typSans = top(null).filter((r) => isTypical(r.plant, 'mediterraneen')).length;
  expect(typ).toBeGreaterThan(typSans);
});

test.each(['bucolique', 'zen', 'gourmand', 'pollinisateurs', 'contemporain', 'romantique'])('suggestSelection %s : ≥ 70 % typiques', (amb) => {
  for (const type of ['midplants', 'tallplants']) {
    const z = massif({ type });
    for (const seed of [1, 2, 3, 4, 5]) {
      const sel = suggestSelection(mkGarden([z]), z, { seed, ambiance: amb });
      expect(sel.length).toBeGreaterThan(0);
      const t = sel.filter((s) => isTypical(by(s.plantId), amb)).length;
      expect(t / sel.length).toBeGreaterThanOrEqual(0.7);
    }
  }
});

test('suggestSelection : déterminisme avec graine, variété entre graines', () => {
  const z = massif();
  const g = mkGarden([z]);
  expect(suggestSelection(g, z, { seed: 7, ambiance: 'bucolique' })).toEqual(suggestSelection(g, z, { seed: 7, ambiance: 'bucolique' }));
  const seen = new Set();
  for (let s = 1; s <= 8; s++) seen.add(JSON.stringify(suggestSelection(g, z, { seed: s, ambiance: 'bucolique' })));
  expect(seen.size).toBeGreaterThan(1);
});

test('suggestSelection : sans ambiance, comportement inchangé ; ambiance du nom de zone prise en compte', () => {
  const z = massif();
  const g = mkGarden([z]);
  expect(suggestSelection(g, z, { seed: 3 })).toEqual(suggestSelection(g, z, { seed: 3, ambiance: null }));
  const zb = massif({ label: 'Coin bucolique' });
  expect(suggestSelection(g, zb, { seed: 3 })).toEqual(suggestSelection(g, zb, { seed: 3, ambiance: 'bucolique' }));
});

test('suggestSelection : l\'équilibre reste (plusieurs hauteurs et floraison étalée)', () => {
  const z = massif({ shape: sq(10, 10) });
  const sel = suggestSelection(mkGarden([z]), z, { seed: 2, ambiance: 'bucolique' });
  const ps = sel.map((s) => by(s.plantId));
  expect(new Set(ps.map((p) => (p.heightAdult < 0.5 ? 0 : p.heightAdult < 1.5 ? 1 : p.heightAdult < 4 ? 2 : 3))).size).toBeGreaterThan(1);
  expect(new Set(ps.flatMap((p) => p.bloom || [])).size).toBeGreaterThanOrEqual(4);
});

test('suggestForGarden : une sélection par zone plantable, chacune avec son ambiance', () => {
  const z1 = massif({ id: 'a' });
  const z2 = massif({ id: 'b', label: 'Coin zen' });
  const z3 = massif({ id: 'c', label: 'Coin zen' });
  const piscine = { id: 'p', type: 'pool', label: 'Piscine', shape: sq(4, 3), plantings: [] };
  const g = mkGarden([z1, z2, z3, piscine]);
  const res = suggestForGarden(g, { seed: 4, ambiances: { a: 'gourmand', c: null } });
  expect(res.map((r) => r.zoneId)).toEqual(['a', 'b', 'c']);
  const ratio = (r, amb) => r.selection.filter((s) => isTypical(by(s.plantId), amb)).length / r.selection.length;
  expect(ratio(res[0], 'gourmand')).toBeGreaterThanOrEqual(0.7);
  expect(ratio(res[1], 'zen')).toBeGreaterThanOrEqual(0.7); // détectée dans le nom
  const sansAmb = suggestSelection(g, z3, { seed: '4:2', ambiance: null });
  expect(res[2].selection).toEqual(sansAmb);
  expect(suggestForGarden(g, { seed: 4, ambiances: { a: 'gourmand', c: null } })).toEqual(res);
});

test('modèle : createZone ajoute ambiance null ; jardin ancien sans champ valide', () => {
  expect(createZone('lawn', sq(3, 3)).ambiance).toBeNull();
  const g = createGarden('Test');
  g.boundary = sq(20, 20).points;
  g.boundaryClosed = true;
  const z = createZone('midplants', sq(3, 3));
  delete z.ambiance;
  g.zones = [z];
  expect(validateGarden(g).errors).toEqual([]);
  expect(plantAmbianceScore(by('h-lavande'), 'zen')).toBeGreaterThanOrEqual(0);
});
