import { recommendForZone, scorePlant, suggestSelection, suggestQuantity, checkCoherence, contextForZone } from '../../recommend.js';
import { createGarden, createZone } from '../../model.js';
import { pondFit, pondTreeRule } from '../../ponds.js';
import { getPlant, allPlants } from '../../catalog.js';

const rect = (x, y, w, h) => ({ kind: 'polygon', points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });
function jardin(w, h) {
  const g = createGarden('Mare');
  g.context.departement = '75';
  g.boundary = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 40 }];
  g.boundaryClosed = true;
  g.sun = { mode: 'uniform', uniform: 'full', regions: [] };
  const mare = createZone('pond', rect(1, 1, w, h)); mare.label = 'Mare';
  g.zones = [mare];
  return { g, mare };
}
const ids = (rs) => rs.map((r) => r.plant.id);

describe('mare de 2 m² vs 30 m²', () => {
  test('petite mare : grand nénuphar, massette et jussie écartés, même avec includeDiscouraged', () => {
    const { g, mare } = jardin(2, 1);
    const sans = ids(recommendForZone(g, mare));
    const avec = ids(recommendForZone(g, mare, { includeDiscouraged: true }));
    for (const id of ['h-nenuphar', 'h-massette', 'h-jussie', 'saule-tortueux']) {
      expect(sans).not.toContain(id);
      expect(avec).not.toContain(id);
    }
    expect(sans).toContain('h-populage');
    const tout = recommendForZone(g, mare, { includeDiscouraged: true, includeForbidden: true });
    const nen = tout.find((r) => r.plant.id === 'h-nenuphar');
    expect(nen.forbidden).toBe(true);
    expect(nen.status).toBe('discouraged');
    expect(nen.reasons.find((x) => x.criterion === 'mare').text).toMatch(/^Ne convient pas à une mare de 2 m² : Trop grande/);
  });
  test('grande mare : le grand nénuphar est proposé, la jussie jamais', () => {
    const { g, mare } = jardin(6, 5);
    const sans = ids(recommendForZone(g, mare));
    expect(sans).toContain('h-nenuphar');
    expect(sans).toContain('h-massette');
    expect(ids(recommendForZone(g, mare, { includeDiscouraged: true }))).not.toContain('h-jussie');
  });
  test('massette selon la taille', () => {
    const m = getPlant('h-massette');
    const statut = (w, h) => { const { g, mare } = jardin(w, h); return scorePlant(m, contextForZone(g, mare)).status; };
    expect(statut(3, 3)).toBe('discouraged');
    expect(statut(4, 4)).toBe('discouraged');
    expect(statut(5, 4)).not.toBe('discouraged'); // 20 m² : seuil atteint
  });
  test('scorePlant sans contexte de mare : inchangé', () => {
    const p = getPlant('h-nenuphar');
    const base = { tminC: -5, zoneType: 'pond', sunLevel: 'full', areaM2: 4, minDimension: 2 };
    const r = scorePlant(p, base);
    expect(r.reasons.some((x) => x.criterion === 'mare')).toBe(false);
    expect(r.forbidden).toBeUndefined();
  });
  test('la profondeur saisie écarte le nénuphar d’une mare trop peu profonde', () => {
    const { g, mare } = jardin(6, 5);
    mare.depth = 30;
    expect(ids(recommendForZone(g, mare, { includeDiscouraged: true }))).not.toContain('h-nenuphar');
  });
});

describe('suggestSelection et quantités', () => {
  test('ne propose jamais d’essence interdite', () => {
    for (const [w, h] of [[2, 1], [2, 2], [3, 3], [6, 5]]) {
      const { g, mare } = jardin(w, h);
      for (let seed = 1; seed <= 12; seed++) {
        for (const it of suggestSelection(g, mare, { seed })) {
          expect(pondFit(getPlant(it.plantId), mare).level).not.toBe('forbid');
          expect(it.plantId).not.toBe('h-jussie');
        }
      }
    }
  });
  test('quantité d’une aquatique : couverture raisonnable', () => {
    const { mare } = jardin(6, 5);
    const n = getPlant('h-nenuphar');
    const q = suggestQuantity(n, mare);
    expect(q * Math.PI * (n.widthAdult / 2) ** 2).toBeLessThanOrEqual(0.6 * 30);
  });
  test('rétro-compatibilité : autres zones inchangées', () => {
    const g = createGarden('x');
    const z = createZone('midplants', rect(0, 0, 4, 3));
    g.zones = [z];
    const p = getPlant('h-astilbe');
    expect(suggestQuantity(p, z)).toBe(Math.max(1, Math.floor(12 / (p.spacing * p.spacing) + 1e-9)));
    expect(contextForZone(g, z).pondArea).toBeUndefined();
  });
});

describe('checkCoherence après redimensionnement', () => {
  test('avertit pour une essence devenue inadaptée', () => {
    const { g, mare } = jardin(6, 5);
    mare.plantings = [{ plantId: 'h-nenuphar', count: 3 }];
    expect(checkCoherence(g).filter((w) => /ne convient plus/.test(w.text))).toHaveLength(0);
    mare.shape = rect(1, 1, 2, 1);
    const w = checkCoherence(g).filter((x) => /ne convient plus/.test(x.text));
    expect(w).toHaveLength(1);
    expect(w[0].text).toMatch(/Nénuphar/);
  });
});

describe('saules', () => {
  test('jamais dans une mare (2 m² comme 100 m²), mais toujours ailleurs', () => {
    for (const [w, h] of [[2, 1], [10, 10]]) {
      const { g, mare } = jardin(w, h);
      const tous = ids(recommendForZone(g, mare, { includeDiscouraged: true }));
      expect(tous.filter((id) => pondTreeRule(getPlant(id)) === 'willow')).toEqual([]);
      for (let seed = 1; seed <= 15; seed++) {
        for (const it of suggestSelection(g, mare, { seed })) expect(pondTreeRule(getPlant(it.plantId))).not.toBe('willow');
      }
      const ecartes = recommendForZone(g, mare, { includeDiscouraged: true, includeForbidden: true }).filter((r) => r.plant.id === 'saule-tortueux');
      expect(ecartes[0].forbidden).toBe(true);
      expect(ecartes[0].reasons.find((x) => x.criterion === 'mare').text).toMatch(/Les saules ne conviennent pas aux mares/);
    }
    const g = createGarden('x'); g.context.departement = '75';
    g.boundary = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 40 }]; g.boundaryClosed = true;
    g.sun = { mode: 'uniform', uniform: 'full', regions: [] };
    const bois = createZone('trees', rect(1, 1, 20, 20)); g.zones = [bois];
    const salix = allPlants().filter((p) => pondTreeRule(p) === 'willow');
    const dispo = ids(recommendForZone(g, bois, { includeDiscouraged: true }));
    expect(salix.some((p) => dispo.includes(p.id))).toBe(true);
  });
});
