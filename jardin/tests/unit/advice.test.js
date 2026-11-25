import { buildAdvice, calendar, tasksForMonth, genericCare, frostProtection } from '../../advice.js';

const sq = (s) => ({ kind: 'polygon', points: [{ x: 0, y: 0 }, { x: s, y: 0 }, { x: s, y: s }, { x: 0, y: s }] });
const plantsById = {
  tree: { id: 'tree', commonName: 'Érable', category: 'tree', water: 'low', hardiness: -25, care: { plantMonths: [11], pruneMonths: [2], fertMonths: [3], planting: 'Planter en novembre.', pruning: 'Tailler en février.', fertilizer: 'Compost.', watering: 'Peu.', notes: 'RAS' } },
  shrub: { id: 'shrub', commonName: 'Laurier', category: 'shrub', water: 'medium', hardiness: -3 /* care absent */ },
  gc: { id: 'gc', commonName: 'Lierre', category: 'groundcover', water: 'low', hardiness: -20, care: { planting: '', plantMonths: [] } },
  tom: { id: 'tom', commonName: 'Tomate', category: 'vegetable', water: 'high', hardiness: 2, harvest: [8, 9] },
  per: { id: 'per', commonName: 'Sauge', category: 'perennial', water: 'low', hardiness: -10 },
};
const garden = () => ({
  context: { roofArea: 40 },
  zones: [
    { id: 'z1', type: 'lawn', label: 'Pelouse', shape: sq(5), plantings: [] },
    { id: 'z2', type: 'trees', label: 'Bosquet', shape: sq(5), plantings: [{ plantId: 'tree', count: 1 }, { plantId: 'shrub', count: 2 }] },
    { id: 'z3', type: 'lowplants', label: 'Sous-bois', shape: sq(3), plantings: [{ plantId: 'gc', count: 5 }, { plantId: 'unknown', count: 1 }] },
    { id: 'z4', type: 'vegetable', label: 'Potager', shape: sq(3), plantings: [{ plantId: 'tom', count: 4 }, { plantId: 'per', count: 1 }] },
    { id: 'z5', type: 'terrace', label: 'Terrasse', shape: sq(3), plantings: [] },
  ],
});

describe('genericCare', () => {
  test('toutes les catégories ont des textes français et des mois', () => {
    for (const c of ['tree', 'shrub', 'hedge', 'fruit', 'climber', 'perennial', 'groundcover', 'grass', 'bulb', 'aquatic', 'vegetable', 'lawn']) {
      const g = genericCare(c);
      for (const k of ['planting', 'pruning', 'fertilizer', 'watering', 'notes']) expect(g[k].length).toBeGreaterThan(10);
      expect(Array.isArray(g.plantMonths)).toBe(true);
    }
    expect(genericCare('inconnu').planting).toBe(genericCare('shrub').planting);
    genericCare('tree').plantMonths.push(99); // pas de mutation partagée
    expect(genericCare('tree').plantMonths).not.toContain(99);
  });
});

describe('buildAdvice', () => {
  test('fiche complète prioritaire, générique en repli, essence inconnue ignorée', () => {
    const a = buildAdvice(garden(), { plantsById });
    expect(a.zones).toHaveLength(5);
    const z2 = a.zones.find((z) => z.zoneId === 'z2');
    expect(z2.plants.find((p) => p.plant.id === 'tree').planting).toBe('Planter en novembre.');
    expect(z2.plants.find((p) => p.plant.id === 'shrub').pruning).toBe(genericCare('shrub').pruning);
    const z3 = a.zones.find((z) => z.zoneId === 'z3');
    expect(z3.plants).toHaveLength(1);
    expect(z3.plants[0].planting).toBe(genericCare('groundcover').planting); // chaîne vide → générique
    expect(a.zones.find((z) => z.zoneId === 'z1').tips[0]).toMatch(/Tondre/);
  });

  test('ordre de chantier : gros œuvre → arbres → arbustes → vivaces → couvre-sols → gazon', () => {
    const o = buildAdvice(garden(), { plantsById }).plantingOrder;
    const labels = ['Gros œuvre', 'Arbres', 'Arbustes', 'Vivaces', 'Couvre-sols', 'Gazon'];
    expect(o).toHaveLength(6);
    labels.forEach((l, i) => expect(o[i]).toContain(l));
    expect(o[0]).toMatch(/^1\./);
    const g = garden(); g.zones = g.zones.filter((z) => z.id === 'z2');
    expect(buildAdvice(g, { plantsById }).plantingOrder.map((s) => s.split(' : ')[0])).toEqual(['1. Arbres', '2. Arbustes']);
  });

  test('conseils généraux : cuve selon la toiture', () => {
    const a = buildAdvice(garden(), { plantsById });
    expect(a.general.rainwater).toContain('40 m²');
    expect(a.general.disclaimer).toMatch(/ordres de grandeur/);
  });
});

describe('calendar', () => {
  test('12 mois avec tâches typées', () => {
    const c = calendar(garden(), { plantsById });
    expect(c).toHaveLength(12);
    expect(c.map((m) => m.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(c[10].tasks.some((t) => t.kind === 'plant' && t.plantId === 'tree')).toBe(true);
    expect(c[1].tasks.some((t) => t.kind === 'prune' && t.plantId === 'tree')).toBe(true);
    expect(c[7].tasks.some((t) => t.kind === 'harvest' && t.plantId === 'tom')).toBe(true);
    expect(c[0].tasks.some((t) => t.kind === 'protect' && t.plantId === 'shrub')).toBe(true);
    expect(c[0].tasks.some((t) => t.kind === 'protect' && t.plantId === 'tree')).toBe(false);
    expect(c[6].tasks.some((t) => t.kind === 'water')).toBe(true);
    expect(c[5].tasks.some((t) => t.text.startsWith('Tondre'))).toBe(true); // pelouse sans plantation
    c.flatMap((m) => m.tasks).forEach((t) => expect(['plant', 'prune', 'fertilize', 'water', 'harvest', 'protect']).toContain(t.kind));
  });

  test('tasksForMonth', () => {
    expect(tasksForMonth(garden(), 8, { plantsById }).some((t) => t.kind === 'harvest')).toBe(true);
    expect(tasksForMonth(garden(), 13, { plantsById })).toEqual(calendar(garden(), { plantsById })[0].tasks);
  });
});

describe('frostProtection', () => {
  test('plantes dont la rusticité est insuffisante', () => {
    const r = frostProtection(garden(), -4, { plantsById });
    expect(r.map((x) => x.plantId).sort()).toEqual(['shrub', 'tom'].sort());
    expect(r[0].text).toContain('-4 °C');
    expect(frostProtection(garden(), 5, { plantsById })).toEqual([]);
  });
});
