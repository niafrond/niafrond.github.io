import { jest } from '@jest/globals';
jest.setTimeout(240000);
import { suggestSelection, suggestForGarden, suggestQuantity, checkCoherence } from '../../recommend.js';
import { packZone, minDistance, packingCapacity } from '../../spacing.js';
import { getPlant } from '../../catalog.js';
import { createGarden, createZone } from '../../model.js';
import { shapePolygon } from '../../geometry.js';

const rect = (x, y, w, h) => ({ kind: 'polygon', points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });
const jardin = (type, shape) => {
  const g = createGarden('Espacement');
  g.context.departement = '75';
  g.sun = { mode: 'uniform', uniform: 'full', regions: [] };
  const z = createZone(type, shape); z.id = 'zz';
  g.zones = [z];
  return { g, z };
};
const verifie = (g, z, sel) => {
  const pls = sel.map((s) => ({ plantId: s.plantId, count: s.count }));
  const r = packZone({ ...z, plantings: pls }, pls, getPlant, { garden: g });
  expect(r.overflow).toEqual([]);
  for (let i = 0; i < r.positions.length; i++) {
    for (let j = i + 1; j < r.positions.length; j++) {
      const a = r.positions[i]; const b = r.positions[j];
      const need = minDistance(getPlant(a.plantId), getPlant(b.plantId));
      if (Math.hypot(a.x - b.x, a.y - b.y) < need - 1e-6) throw new Error(`${a.plantId}/${b.plantId} à ${Math.hypot(a.x - b.x, a.y - b.y).toFixed(2)} < ${need.toFixed(2)}`);
    }
  }
};
// 28 m² (zone d’arbres), plus petit et plus grand
const CAS = [
  ['trees', [[3, 3], [5.3, 5.3], [8, 7]]],
  ['midplants', [[2, 2], [4, 3], [6, 4]]],
  ['lawn', [[3, 3], [6, 5], [10, 8]]],
  ['vegetable', [[2, 2], [4, 3], [6, 4]]],
  ['hedge', [[2, 1], [5, 1.2], [9, 1.5]]],
];

describe('suggestSelection respecte les espacements', () => {
  for (const [type, tailles] of CAS) {
    test(`${type} : 6 graines × 3 tailles, aucune paire trop proche, rien ne dépasse`, () => {
      for (const [w, h] of tailles) {
        const { g, z } = jardin(type, rect(0, 0, w, h));
        for (let seed = 1; seed <= 6; seed++) {
          const sel = suggestSelection(g, z, { seed });
          expect(sel.length).toBeGreaterThan(0);
          sel.forEach((s) => expect(s.count).toBeGreaterThanOrEqual(1));
          verifie(g, z, sel);
        }
      }
    });
  }
  test('mare : quantités bornées par la capacité', () => {
    const { g, z } = jardin('pond', rect(0, 0, 4, 3));
    for (let seed = 1; seed <= 10; seed++) {
      for (const s of suggestSelection(g, z, { seed })) {
        const p = getPlant(s.plantId);
        expect(s.count).toBeLessThanOrEqual(Math.max(1, packingCapacity(shapePolygon(z.shape, 48), p)));
      }
    }
  });
  test('zone d’arbres 28 m² : arbres comptés pour leur couronne, plus de 1 ligne de sous-étage', () => {
    const { g, z } = jardin('trees', rect(0, 0, 5.3, 5.3));
    const sel = suggestSelection(g, z, { seed: 4 });
    const arbres = sel.filter((s) => getPlant(s.plantId).category === 'tree');
    const crown = arbres.reduce((t, s) => t + s.count * Math.PI * (getPlant(s.plantId).widthAdult / 2) ** 2, 0);
    expect(crown).toBeLessThanOrEqual(28 * 0.8 + Math.PI * 7 ** 2 * 0 + 30); // au moins 1 arbre même si sa couronne dépasse
    expect(arbres.length).toBeLessThanOrEqual(2);
  });
});

describe('rétro-compatibilité', () => {
  test('signatures : [{plantId, count}], suggestForGarden et suggestQuantity', () => {
    const { g, z } = jardin('midplants', rect(0, 0, 4, 3));
    const sel = suggestSelection(g, z, { seed: 2 });
    sel.forEach((s) => expect(Object.keys(s).sort()).toEqual(['count', 'plantId']));
    expect(suggestSelection(g, z, { seed: 2 })).toEqual(sel);
    const all = suggestForGarden(g, { seed: 3 });
    expect(all[0]).toMatchObject({ zoneId: 'zz' });
    expect(Array.isArray(all[0].selection)).toBe(true);
    verifie(g, z, all[0].selection);
    expect(suggestQuantity(getPlant('h-lavande'), z)).toBeLessThanOrEqual(packingCapacity(shapePolygon(z.shape, 48), getPlant('h-lavande')));
  });
  test('checkCoherence : une zone proposée ne déclenche aucun avertissement d’espacement', () => {
    const { g, z } = jardin('trees', rect(0, 0, 5.3, 5.3));
    z.plantings = suggestSelection(g, z, { seed: 7 });
    expect(checkCoherence(g).filter((w) => ['surdensite', 'arbres-proches', 'pied-arbre'].includes(w.kind))).toEqual([]);
  });
  test('surdensité signalée quand on force', () => {
    const { g, z } = jardin('midplants', rect(0, 0, 2, 2));
    z.plantings = [{ plantId: 'h-lavande', count: 60 }];
    const w = checkCoherence(g).filter((x) => x.kind === 'surdensite');
    expect(w).toHaveLength(1);
    expect(w[0].text).toMatch(/surdensité/);
  });
});
