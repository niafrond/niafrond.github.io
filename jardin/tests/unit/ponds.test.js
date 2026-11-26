import { pondTreeRule, pondArea, pondDepth, estimatePondDepth, pondFit, pondCoverage, pondPlantQuantity } from '../../ponds.js';
import POND_TAGS from '../../data/plants/pond-tags.js';
import { createZone } from '../../model.js';
import { getPlant, allPlants } from '../../catalog.js';

const rect = (w, h) => ({ kind: 'polygon', points: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }] });
const mare = (w, h, depth) => { const z = createZone('pond', rect(w, h)); if (depth) z.depth = depth; return z; };

describe('étiquettes de mare', () => {
  test('uniquement des ids du catalogue, couvrant toutes les aquatiques et essences de berge', () => {
    for (const id of Object.keys(POND_TAGS)) expect(getPlant(id)).toBeTruthy();
    const attendus = allPlants().filter((p) => p.category === 'aquatic' || (p.zones || []).includes('pond'));
    for (const p of attendus) expect(POND_TAGS[p.id]).toBeTruthy();
    for (const t of Object.values(POND_TAGS)) {
      expect(['flottante', 'oxygenante', 'bordure', 'berge', 'marais']).toContain(t.role);
      expect(['faible', 'moyen', 'fort']).toContain(t.spread);
      expect(t.minArea).toBeGreaterThan(0);
      expect(typeof t.note).toBe('string');
    }
  });
});

describe('profondeur', () => {
  test('estimée d’après la surface', () => {
    expect(estimatePondDepth(1)).toBe(40);
    expect(estimatePondDepth(4)).toBe(60);
    expect(estimatePondDepth(10)).toBe(80);
    expect(estimatePondDepth(30)).toBe(100);
    expect(pondDepth(mare(1, 1.5))).toBe(40);
    expect(pondDepth(mare(2, 2))).toBe(60);
    expect(pondDepth(mare(6, 5))).toBe(100);
  });
  test('zone.depth l’emporte, valeur invalide ignorée', () => {
    expect(pondDepth(mare(2, 2, 120))).toBe(120);
    const z = mare(2, 2); z.depth = -5;
    expect(pondDepth(z)).toBe(60);
    expect(pondArea(mare(2, 2))).toBeCloseTo(4);
  });
});

describe('pondFit', () => {
  test('grand nénuphar : écarté en petite mare, accepté en grande', () => {
    const n = getPlant('h-nenuphar');
    const petite = pondFit(n, mare(2, 2));
    expect(petite.ok).toBe(false);
    expect(petite.level).toBe('avoid');
    expect(pondFit(n, mare(2, 1)).level).toBe('forbid');
    expect(petite.reasons.join(' ')).toMatch(/Trop grande pour cette mare \(4 m² ; il faut ≥ 6 m²\)/);
    expect(pondFit(n, mare(5, 5, 100)).ok).toBe(true);
  });
  test('profondeur insuffisante', () => {
    const r = pondFit(getPlant('h-nenuphar'), mare(5, 4, 30));
    expect(r.ok).toBe(false);
    expect(r.reasons.join(' ')).toMatch(/trop peu profonde pour ce nénuphar/);
  });
  test('massette : fort envahisseur, jamais sous 20 m² au mieux « avoid »', () => {
    const m = getPlant('h-massette');
    expect(pondFit(m, mare(2, 2)).level).toBe('forbid');
    expect(pondFit(m, mare(4, 3)).level).toBe('avoid');
    expect(pondFit(m, mare(4, 4)).level).toBe('avoid'); // 16 m² : encore trop colonisatrice
    expect(pondFit(m, mare(5, 4)).ok).toBe(true); // 20 m²
  });
  test('jussie toujours interdite, essence non étiquetée sans effet', () => {
    expect(pondFit(getPlant('h-jussie'), mare(10, 10)).level).toBe('forbid');
    expect(pondFit({ id: 'x' }, mare(1, 1)).ok).toBe(true);
  });
  test('petite essence adaptée à une toute petite mare', () => {
    expect(pondFit(getPlant('h-populage'), mare(1, 1)).ok).toBe(true);
    expect(pondFit(getPlant('h-iris-marais'), mare(1, 1)).ok).toBe(true);
  });
});

describe('couverture et quantités', () => {
  test('flottantes ≤ 50–60 %', () => {
    const n = getPlant('h-nenuphar');
    const c = pondCoverage(n, mare(5, 5));
    expect(c).toBeGreaterThan(0); expect(c).toBeLessThanOrEqual(0.6);
    expect(pondCoverage({ id: 'inconnue' }, mare(5, 5))).toBe(0);
  });
  test('quantités cohérentes avec la surface couverte', () => {
    const n = getPlant('h-nenuphar');
    const q = pondPlantQuantity(n, mare(6, 5));
    const emprise = q * Math.PI * (n.widthAdult / 2) ** 2;
    expect(q).toBeGreaterThanOrEqual(1);
    expect(emprise).toBeLessThanOrEqual(0.6 * 30);
    expect(pondPlantQuantity(getPlant('h-myriophylle-epi'), mare(6, 5))).toBeGreaterThan(pondPlantQuantity(getPlant('h-myriophylle-epi'), mare(2, 1)));
    expect(pondPlantQuantity(getPlant('h-iris-marais'), mare(1, 1))).toBe(1);
    expect(pondPlantQuantity({ id: 'z' }, mare(3, 3))).toBe(1);
  });
});

describe('saules et grands arbres', () => {
  const saules = () => allPlants().filter((p) => pondTreeRule(p) === 'willow');
  test('tout saule est interdit, quelle que soit la taille', () => {
    expect(saules().length).toBeGreaterThan(0);
    for (const p of saules()) {
      for (const [w, h] of [[2, 1], [10, 10]]) {
        const r = pondFit(p, mare(w, h));
        expect(r.level).toBe('forbid');
        expect(r.reasons[0]).toBe('Les saules ne conviennent pas aux mares : racines envahissantes, feuilles dans l’eau');
      }
    }
    expect(pondFit(getPlant('saule-tortueux'), mare(20, 20)).level).toBe('forbid');
  });
  test('grands arbres : écartés sous 30 m², tolérés au-delà ; arbustes de berge conservés', () => {
    const grands = allPlants().filter((p) => pondTreeRule(p) && pondTreeRule(p) !== 'willow');
    expect(grands.length).toBeGreaterThan(0);
    for (const p of grands) {
      expect(pondFit(p, mare(4, 4)).ok).toBe(false);
      if (pondTreeRule(p) === 'bigtree') expect(pondFit(p, mare(8, 8)).ok).toBe(true);
    }
    expect(pondFit(getPlant('cornouiller-sanguin'), mare(3, 3)).ok).toBe(true);
    expect(pondFit(getPlant('viorne-obier'), mare(3, 3)).ok).toBe(true);
  });
  test('règle par nom pour une essence ajoutée plus tard', () => {
    expect(pondTreeRule({ id: 'n', commonName: 'Osier rouge', latinName: 'X' })).toBe('willow');
    expect(pondTreeRule({ id: 'n', commonName: 'Peuplier', latinName: 'Populus nigra' })).toBe('aggressive');
  });
});
