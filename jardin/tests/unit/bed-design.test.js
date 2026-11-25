import { designBed, colorFamily, proposeBeds } from '../../massifs.js';
import { getPlant } from '../../catalog.js';
import { habitOf } from '../../habits.js';
import { plantAmbianceScore, plantAvoids } from '../../ambiances.js';
import { fitsMaintenance } from '../../maintenance.js';
import { gardenA, gardenBig } from './massif-fixtures.js';

const poly = (x, y, w, h) => ({ kind: 'polygon', points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });
const bed = (over = {}) => ({ id: 'b1', role: 'bordure', shape: poly(0, 5, 6, 1.5), areaM2: 9, widthM: 1.5, sunLevel: 'full', ...over });
const g = gardenA();
const plantsOf = (d) => d.plantings.map((p) => getPlant(p.plantId));
const months = (d) => new Set(d.summary.bloomMonths.filter((m) => m >= 3 && m <= 10));

describe('designBed', () => {
  test('5 à 10 essences, quantités ≥ 1, essences du catalogue, résultat déterministe', () => {
    const d = designBed(g, bed(), { seed: 3, tminC: -15 });
    expect(d.plantings.length).toBeGreaterThanOrEqual(5);
    expect(d.plantings.length).toBeLessThanOrEqual(10);
    d.plantings.forEach((p) => { expect(getPlant(p.plantId)).toBeTruthy(); expect(p.count).toBeGreaterThanOrEqual(1); });
    expect(new Set(d.plantings.map((p) => p.plantId)).size).toBe(d.plantings.length);
    expect(JSON.stringify(designBed(g, bed(), { seed: 3, tminC: -15 }))).toBe(JSON.stringify(d));
  });

  test('floraison continue d\'au moins 7 mois de mars à octobre, avec 2 essences par saison', () => {
    for (const sunLevel of ['full', 'partial', 'shade']) for (const seed of [1, 2, 3, 4]) {
      const d = designBed(g, bed({ sunLevel }), { seed, tminC: -15 });
      expect(months(d).size).toBeGreaterThanOrEqual(7);
      const ps = plantsOf(d);
      for (const season of [[3, 4, 5], [6, 7, 8], [9, 10]]) {
        expect(ps.filter((p) => (p.bloom || []).some((m) => season.includes(m))).length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  test('au moins 3 niveaux de hauteur (étagement)', () => {
    for (const seed of [1, 2, 3]) {
      const d = designBed(g, bed(), { seed, tminC: -15 });
      expect(d.summary.layers).toBeGreaterThanOrEqual(3);
      const heights = plantsOf(d).map((p) => p.heightAdult);
      expect(Math.max(...heights) / Math.min(...heights)).toBeGreaterThan(2);
      expect(plantsOf(d).every((p) => habitOf(p))).toBe(true);
    }
  });

  test('rusticité respectée à −15 °C, soleil local respecté', () => {
    for (const sunLevel of ['full', 'shade']) {
      const d = designBed(g, bed({ sunLevel }), { seed: 2, tminC: -15 });
      for (const p of plantsOf(d)) {
        expect(p.hardiness).toBeLessThanOrEqual(-15);
        expect(p.sun).toContain(sunLevel);
      }
    }
  });

  test('aucune invasive ; aucune toxique près d\'une terrasse', () => {
    const near = bed({ shape: poly(3, 4.1, 5, 0.9), areaM2: 4.5, widthM: 0.9 });
    for (const seed of [1, 2, 3]) {
      const d = designBed(g, near, { seed, tminC: -15 });
      expect(d.plantings.length).toBeGreaterThanOrEqual(3);
      for (const p of plantsOf(d)) { expect(p.invasive).toBeFalsy(); expect(p.toxic).toBeFalsy(); }
    }
    // sans terrasse proche, les invasives restent exclues
    for (const p of plantsOf(designBed(g, bed(), { seed: 1 }))) expect(p.invasive).toBeFalsy();
  });

  test('ambiance respectée', () => {
    for (const ambiance of ['bucolique', 'zen', 'pollinisateurs']) {
      const d = designBed(g, bed(), { seed: 1, tminC: -15, ambiance });
      const ps = plantsOf(d);
      expect(ps.every((p) => !plantAvoids(p).includes(ambiance))).toBe(true);
      const mean = ps.reduce((s, p) => s + plantAmbianceScore(p, ambiance), 0) / ps.length;
      expect(mean).toBeGreaterThanOrEqual(0.6);
      expect(d.why).toContain('ambiance');
    }
  });

  test('niveau d\'entretien respecté', () => {
    for (const level of ['low', 'none']) {
      const d = designBed(g, bed(), { seed: 1, maintenance: level });
      for (const p of plantsOf(d)) expect(fitsMaintenance(p, level).ok).toBe(true);
    }
  });

  test('harmonie des couleurs : au plus 3 familles de teintes', () => {
    for (const seed of [1, 2, 3, 4, 5]) for (const palette of ['auto', 'chaud', 'froid', 'pastel']) {
      const d = designBed(g, bed(), { seed, tminC: -15, palette });
      const fams = new Set(plantsOf(d).filter((p) => (p.bloom || []).length).map((p) => colorFamily(p.flowerColor)).filter(Boolean));
      expect(fams.size).toBeLessThanOrEqual(3);
      expect(d.summary.families.length).toBeLessThanOrEqual(3);
      expect(d.why).toContain('palette');
    }
  });

  test('palette « froid » : essences bleu-violet / blanc / vert', () => {
    const d = designBed(g, bed(), { seed: 1, tminC: -15, palette: 'froid' });
    const fams = d.summary.families;
    expect(fams.filter((f) => ['bleu-violet', 'blanc', 'vert'].includes(f)).length).toBeGreaterThanOrEqual(fams.length - 1);
  });

  test('feuillage persistant et mellifères', () => {
    const d = designBed(g, bed(), { seed: 1, tminC: -15 });
    const ps = plantsOf(d);
    expect(ps.filter((p) => p.foliage === 'evergreen').length).toBeGreaterThanOrEqual(1);
    expect(ps.filter((p) => p.melliferous).length).toBeGreaterThanOrEqual(2);
    expect(d.summary.melliferous).toBe(ps.filter((p) => p.melliferous).length);
    expect(d.why).toMatch(/^\d+ mois de floraison \(\w+ à \w+\), \d+ hauteurs?, palette .+, \d+ essences? mellifères?/);
  });

  test('budget respecté quand c\'est possible', () => {
    for (const seed of [1, 2, 3, 4]) {
      const free = designBed(g, bed(), { seed, tminC: -15 });
      const d = designBed(g, bed(), { seed, tminC: -15, budget: 150 });
      expect(d.summary.costEur).toBeLessThanOrEqual(150);
      expect(d.summary.costEur).toBeLessThanOrEqual(Math.max(150, free.summary.costEur));
      expect(d.plantings.length).toBeGreaterThanOrEqual(5);
    }
  });

  test('quantités cohérentes avec la surface', () => {
    for (const area of [3, 9, 18]) {
      const w = area / 6;
      const d = designBed(g, bed({ shape: poly(0, 5, 6, w), areaM2: area, widthM: w }), { seed: 1, tminC: -15 });
      let footprint = 0;
      for (const pl of d.plantings) {
        const p = getPlant(pl.plantId);
        footprint += pl.count * (p.spacing > 0 ? p.spacing : p.widthAdult) ** 2;
      }
      expect(footprint / area).toBeGreaterThan(0.5);
      expect(footprint / area).toBeLessThan(1.3);
      expect(Math.abs(d.summary.density - footprint / area)).toBeLessThan(0.1);
    }
    // plus la surface est grande, plus il y a de plants
    const count = (area) => designBed(g, bed({ shape: poly(0, 5, 6, area / 6), areaM2: area, widthM: area / 6 }), { seed: 1, tminC: -15 })
      .plantings.reduce((s, p) => s + p.count, 0);
    expect(count(18)).toBeGreaterThan(count(3));
  });

  test('2 alternatives différentes entre elles et du choix principal', () => {
    for (const seed of [1, 2]) {
      const d = designBed(g, bed(), { seed, tminC: -15, ambiance: 'bucolique' });
      expect(d.alternatives).toHaveLength(2);
      const sig = (x) => x.plantings.map((p) => p.plantId).sort().join('|');
      const sigs = new Set([sig(d), sig(d.alternatives[0]), sig(d.alternatives[1])]);
      expect(sigs.size).toBe(3);
      d.alternatives.forEach((a) => {
        expect(a.plantings.length).toBeGreaterThanOrEqual(5);
        expect(typeof a.why).toBe('string');
        expect(a.summary.bloomMonths.length).toBeGreaterThan(0);
      });
      expect(d.alternatives[0].palette).not.toBe(d.alternatives[1].palette);
    }
  });

  test('sous-bois : près d\'un grand arbre existant, essences d\'ombre ou de mi-ombre', () => {
    const h = gardenBig();
    h.existing = [{ id: 'e1', kind: 'tree', plantId: null, x: 10, y: 11, height: 9, width: 5, keep: true }];
    const b = bed({ shape: poly(8, 9, 4, 2), areaM2: 8, widthM: 2, sunLevel: 'partial' });
    const d = designBed(h, b, { seed: 1, tminC: -15 });
    expect(d.why).toContain('sous-bois');
    const ps = plantsOf(d);
    expect(ps.filter((p) => p.sun.includes('shade') || p.sun.includes('partial')).length).toBe(ps.length);
    expect(ps.filter((p) => p.sun.includes('shade')).length).toBeGreaterThanOrEqual(2);
  });

  test('catalogue injecté : essences fournies uniquement', () => {
    const mk = (id, o) => ({ id, commonName: id, latinName: `${id} x`, category: 'perennial', heightAdult: 0.6, widthAdult: 0.5, sun: ['full'], hardiness: -20, water: 'medium', soil: [], foliage: 'deciduous', bloom: [6], zones: ['midplants'], maintenance: 'low', spacing: 0.5, priceEur: 5, priceUnit: 'plant', flowerColor: '#3355cc', ...o });
    const plants = [mk('a', { bloom: [3, 4] }), mk('b', { bloom: [5, 6], heightAdult: 1.4 }), mk('c', { bloom: [7, 8], heightAdult: 0.3 }), mk('d', { bloom: [9, 10], heightAdult: 0.8, flowerColor: '#ffffff' }), mk('e', { bloom: [6, 7], heightAdult: 0.5 }), mk('f', { bloom: [8, 9], heightAdult: 1.8 })];
    const d = designBed(g, bed(), { seed: 1, plants });
    expect(d.plantings.every((p) => plants.some((q) => q.id === p.plantId))).toBe(true);
    expect(d.plantings.length).toBeGreaterThanOrEqual(5);
  });

  test('proposeBeds : budget réparti, plantations sur chaque massif', () => {
    const beds = proposeBeds(gardenBig(), { seed: 2, budget: 1200 });
    expect(beds.length).toBeGreaterThan(0);
    const total = beds.reduce((s, b) => s + b.summary.costEur, 0);
    expect(total).toBeLessThanOrEqual(1200);
  });
});
