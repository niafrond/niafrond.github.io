import { scorePlant, recommendForZone, suggestSelection, suggestForGarden, contextForZone, checkCoherence } from '../../recommend.js';
import { plantEffort } from '../../maintenance.js';
import { plants } from '../../data/plants/index.js';

const sq = (w, h) => ({ kind: 'polygon', points: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }] });
const by = (id) => plants.find((p) => p.id === id);
const mkGarden = (zones, maintenance) => ({ id: 'g', context: { departement: '75', ...(maintenance !== undefined ? { maintenance } : {}) }, sun: { mode: 'uniform', uniform: 'full', regions: [] }, zones });
const massif = (extra = {}) => ({ id: 'z1', type: 'midplants', label: 'Massif', shape: sq(8, 6), plantings: [], ...extra });
const base = { tminC: -5, zoneType: 'midplants', sunLevel: 'full', areaM2: 50, minDimension: 6 };

test('scorePlant : sans niveau ou « green », aucune raison « entretien » et score inchangé', () => {
  const p = by('h-lavande');
  const a = scorePlant(p, base);
  for (const m of [undefined, null, 'green']) {
    const b = scorePlant(p, { ...base, maintenance: m });
    expect(b.score).toBe(a.score);
    expect(b.reasons.some((r) => r.criterion === 'entretien')).toBe(false);
  }
});

test('scorePlant : « none » récompense l\'effort 1, pénalise 2, écarte 3', () => {
  const easy = plants.find((p) => plantEffort(p) === 1 && scorePlant(p, base).score === 100);
  const mid = plants.find((p) => plantEffort(p) === 2 && scorePlant(p, base).score === 100);
  const hard = plants.find((p) => plantEffort(p) === 3 && scorePlant(p, base).score === 100);
  const e = scorePlant(easy, { ...base, maintenance: 'none' });
  expect(e.reasons.find((r) => r.criterion === 'entretien')).toEqual({ ok: true, criterion: 'entretien', text: 'Très peu d’entretien : on plante et on oublie' });
  expect(e.rank).toBeGreaterThan(100);
  const m = scorePlant(mid, { ...base, maintenance: 'none' });
  expect(m.score).toBe(70);
  expect(m.status).toBe('possible');
  expect(m.reasons.find((r) => r.criterion === 'entretien').ok).toBe(false);
  const h = scorePlant(hard, { ...base, maintenance: 'none' });
  expect(h.status).toBe('discouraged');
});

test('scorePlant : « low » pénalise seulement l\'effort 3', () => {
  const mid = plants.find((p) => plantEffort(p) === 2 && scorePlant(p, base).score === 100);
  const hard = plants.find((p) => plantEffort(p) === 3 && scorePlant(p, base).score === 100);
  expect(scorePlant(mid, { ...base, maintenance: 'low' }).score).toBe(100);
  const h = scorePlant(hard, { ...base, maintenance: 'low' });
  expect(h.score).toBe(75);
  expect(h.reasons.find((r) => r.criterion === 'entretien')).toMatchObject({ ok: false, text: 'Demande pas mal d’entretien : déconseillée si vous voulez peu d’entretien' });
});

test('contextForZone : niveau de la zone prioritaire sur celui du jardin', () => {
  const z = massif();
  expect(contextForZone(mkGarden([z]), z).maintenance).toBe('green');
  expect(contextForZone(mkGarden([z], 'low'), z).maintenance).toBe('low');
  const z2 = massif({ maintenance: 'none' });
  expect(contextForZone(mkGarden([z2], 'low'), z2).maintenance).toBe('none');
  expect(contextForZone(mkGarden([z2], 'low'), z2, { maintenance: 'green' }).maintenance).toBe('green');
});

test('recommendForZone : « none » met les essences légères en tête et retire les exigeantes', () => {
  const z = massif();
  const g = mkGarden([z], 'none');
  const recs = recommendForZone(g, z);
  expect(recs.length).toBeGreaterThan(5);
  expect(recs.slice(0, 5).every((r) => plantEffort(r.plant) === 1)).toBe(true);
  expect(recs.some((r) => plantEffort(r.plant) === 3)).toBe(false);
  const libre = recommendForZone(mkGarden([z]), z);
  expect(libre.length).toBeGreaterThan(recs.length - 1);
});

test('suggestSelection : « none » ne choisit que des essences d\'effort 1', () => {
  const z = massif();
  for (const seed of [1, 2, 3, 'a']) {
    const sel = suggestSelection(mkGarden([z], 'none'), z, { seed });
    expect(sel.length).toBeGreaterThan(0);
    expect(sel.every((s) => plantEffort(by(s.plantId)) === 1)).toBe(true);
  }
});

test('suggestSelection : « low » évite l\'effort 3', () => {
  const z = massif();
  const sel = suggestSelection(mkGarden([z], 'low'), z, { seed: 4 });
  expect(sel.every((s) => plantEffort(by(s.plantId)) <= 2)).toBe(true);
});

test('suggestSelection : déterminisme, option explicite et niveau de zone', () => {
  const z = massif();
  const g = mkGarden([z], 'none');
  expect(suggestSelection(g, z, { seed: 7 })).toEqual(suggestSelection(g, z, { seed: 7 }));
  const zn = massif({ maintenance: 'none' });
  const g2 = mkGarden([zn], 'green');
  expect(suggestSelection(g2, zn, { seed: 7 }).every((s) => plantEffort(by(s.plantId)) === 1)).toBe(true);
  const zg = massif({ maintenance: 'green' });
  expect(suggestSelection(mkGarden([zg], 'none'), zg, { seed: 7 })).toEqual(suggestSelection(mkGarden([zg]), zg, { seed: 7 }));
  expect(suggestSelection(mkGarden([z]), z, { seed: 7, maintenance: 'none' }).every((s) => plantEffort(by(s.plantId)) === 1)).toBe(true);
});

test('rétro-compatibilité : sans niveau, la sélection est celle d\'avant', () => {
  const z = massif();
  const a = suggestSelection(mkGarden([z]), z, { seed: 5 });
  const b = suggestSelection(mkGarden([z], 'green'), z, { seed: 5 });
  expect(a).toEqual(b);
  expect(a.length).toBeGreaterThan(0);
});

test('suggestForGarden : tient compte du niveau de chaque zone', () => {
  const a = massif({ id: 'a', maintenance: 'none' });
  const b = massif({ id: 'b' });
  const res = suggestForGarden(mkGarden([a, b], 'green'), { seed: 3 });
  const sa = res.find((r) => r.zoneId === 'a').selection;
  expect(sa.every((s) => plantEffort(by(s.plantId)) === 1)).toBe(true);
  const all = suggestForGarden(mkGarden([a, b], 'green'), { seed: 3, maintenance: 'none' });
  expect(all.every((r) => r.selection.every((s) => plantEffort(by(s.plantId)) === 1))).toBe(true);
});

test('checkCoherence : avertit si une zone sans entretien contient une essence exigeante', () => {
  const hard = plants.find((p) => plantEffort(p) >= 2 && p.category === 'perennial') || plants.find((p) => plantEffort(p) >= 2);
  const easy = plants.find((p) => plantEffort(p) === 1);
  const z = massif({ plantings: [{ plantId: hard.id, count: 1 }, { plantId: easy.id, count: 1 }] });
  const w = checkCoherence(mkGarden([z], 'none')).filter((x) => /sans entretien/.test(x.text));
  expect(w).toHaveLength(1);
  expect(w[0].text).toContain('demande un entretien régulier alors que cette zone est prévue sans entretien');
  expect(w[0].zoneId).toBe('z1');
  expect(checkCoherence(mkGarden([z], 'low')).some((x) => /sans entretien/.test(x.text))).toBe(false);
  const zone = { ...z, maintenance: 'none' };
  expect(checkCoherence(mkGarden([zone], 'green')).some((x) => /sans entretien/.test(x.text))).toBe(true);
  expect(checkCoherence(mkGarden([{ ...z, maintenance: 'green' }], 'none')).some((x) => /sans entretien/.test(x.text))).toBe(false);
});
