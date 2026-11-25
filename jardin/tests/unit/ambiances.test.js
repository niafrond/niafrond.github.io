import { AMBIANCES, getAmbiance, detectAmbiance, plantAmbiances, plantAmbianceScore, isTypical } from '../../ambiances.js';
import TAGS from '../../data/plants/ambiances-tags.js';
import { plants } from '../../data/plants/index.js';

const IDS = new Set(AMBIANCES.map((a) => a.id));

test('liste des ambiances : 12 entrées complètes', () => {
  expect(AMBIANCES).toHaveLength(12);
  for (const a of AMBIANCES) {
    expect(a.id).toMatch(/^[a-z]+$/);
    expect(a.label).toBeTruthy();
    expect(a.emoji).toBeTruthy();
    expect(a.desc.length).toBeGreaterThan(20);
    expect(a.keywords.length).toBeGreaterThan(0);
    for (const k of a.keywords) expect(k).toBe(k.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());
    expect(getAmbiance(a.id)).toBe(a);
  }
  expect(getAmbiance('nimporte')).toBeNull();
});

test('tags : toutes les essences, aucun id inventé, ambiances valides', () => {
  const ids = plants.map((p) => p.id);
  expect(ids.filter((i) => !TAGS[i])).toEqual([]);
  expect(Object.keys(TAGS).filter((i) => !ids.includes(i))).toEqual([]);
  for (const [id, t] of Object.entries(TAGS)) {
    expect(t.ambiances.length).toBeGreaterThanOrEqual(2);
    expect(t.ambiances.length).toBeLessThanOrEqual(4);
    expect(new Set(t.ambiances).size).toBe(t.ambiances.length);
    for (const a of [...t.ambiances, ...(t.avoid || [])]) expect(IDS.has(a)).toBe(true);
    for (const a of t.avoid || []) expect(t.ambiances).not.toContain(a);
    expect(id).toBeTruthy();
  }
});

test('chaque ambiance a au moins 8 essences typiques', () => {
  for (const a of AMBIANCES) {
    const n = plants.filter((p) => isTypical(p, a.id)).length;
    expect(n).toBeGreaterThanOrEqual(8);
  }
});

test.each([
  ['Massif bucolique devant la terrasse', 'bucolique'],
  ['coin zen', 'zen'],
  ['Jardin japonais', 'zen'],
  ['Coin ZEN près du bassin', 'zen'],
  ['Parterre décoratif', 'decoratif'],
  ['Haie champêtre', 'bucolique'],
  ['Espace méditerranéen', 'mediterraneen'],
  ['Carré gourmand', 'gourmand'],
  ['Allée romantique', 'romantique'],
  ['Massif contemporain', 'contemporain'],
  ['Angle exotique', 'exotique'],
  ['Pour les papillons et les abeilles', 'pollinisateurs'],
  ['Coin calme', 'apaisant'],
  ['Bordure colorée', 'colore'],
  ['Zone sauvage au fond', 'sauvage'],
])('detectAmbiance(« %s ») → %s', (txt, id) => {
  expect(detectAmbiance(txt)).toBe(id);
});

test('detectAmbiance : null sans mot d\'ambiance explicite', () => {
  for (const t of ['Potager', 'Massif de plantes moyennes', 'Arbres', '', null, undefined, 'Zone 2', 'Zenith']) expect(detectAmbiance(t)).toBeNull();
});

test('plantAmbiances : tags explicites et repli heuristique', () => {
  const lav = plants.find((p) => p.id === 'h-lavande');
  expect(plantAmbiances(lav)[0]).toBe('mediterraneen');
  const inconnue = { id: 'x-inconnue', category: 'fruit', edible: true, melliferous: true, sun: ['full'], water: 'medium', bloom: [5] };
  const a = plantAmbiances(inconnue);
  expect(a).toContain('gourmand');
  expect(a).toContain('pollinisateurs');
  const gram = { id: 'x-gram', category: 'grass', sun: ['full'], water: 'low', bloom: [8] };
  expect(plantAmbiances(gram)).toEqual(expect.arrayContaining(['contemporain', 'zen', 'sauvage']));
});

test('plantAmbianceScore : entre 0 et 1, typique > compatible > contraire', () => {
  for (const p of plants) for (const a of AMBIANCES) {
    const s = plantAmbianceScore(p, a.id);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  }
  const by = (id) => plants.find((p) => p.id === id);
  expect(plantAmbianceScore(by('h-lavande'), 'mediterraneen')).toBe(1);
  expect(plantAmbianceScore(by('thuya'), 'sauvage')).toBe(0);
  expect(plantAmbianceScore(by('h-hosta'), 'zen')).toBeGreaterThan(0.7);
  expect(plantAmbianceScore(by('h-dahlia'), 'apaisant')).toBeLessThan(0.5); // couleur vive, contraire
  expect(plantAmbianceScore(by('h-tomate'), 'sauvage')).toBeCloseTo(0.5);
  expect(plantAmbianceScore(by('h-lavande'), 'inconnue')).toBe(0.5);
});
