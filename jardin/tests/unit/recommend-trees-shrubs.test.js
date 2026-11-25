import { createGarden, createZone } from '../../model.js';
import { plants } from '../../data/plants/index.js';
import { scorePlant, recommendForZone, suggestSelection, isSmallShrub } from '../../recommend.js';

const RECT = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
function jardin() {
  const g = createGarden('Arbres');
  g.boundary = RECT(0, 0, 16, 12); g.boundaryClosed = true;
  g.context.departement = '69';
  const z = createZone('trees', { kind: 'circle', center: { x: 8, y: 6 }, radius: 3 });
  g.zones.push(z);
  return { g, z };
}

describe('zone d’arbres : petits arbustes aussi proposés', () => {
  test('isSmallShrub : arbuste ≤ 4 m seulement', () => {
    expect(isSmallShrub({ category: 'shrub', heightAdult: 2 })).toBe(true);
    expect(isSmallShrub({ category: 'shrub', heightAdult: 5 })).toBe(false);
    expect(isSmallShrub({ category: 'tree', heightAdult: 3 })).toBe(false);
  });

  test('un petit arbuste n’est pas pénalisé dans une zone d’arbres et la raison le dit', () => {
    const sh = plants.find((p) => p.category === 'shrub' && p.heightAdult <= 3 && !(p.zones || []).includes('trees'));
    const r = scorePlant(sh, { tminC: -10, zoneType: 'trees', sunLevel: null, areaM2: 28, minDimension: 6, soil: null, windy: null });
    expect(r.status).not.toBe('discouraged');
    expect(r.reasons.find((x) => x.criterion === 'zone').text).toContain('Petit arbuste');
  });

  test('un grand arbuste ou une vivace reste peu adapté', () => {
    const big = { ...plants.find((p) => p.category === 'shrub'), heightAdult: 6, zones: ['midplants'] };
    expect(scorePlant(big, { tminC: -10, zoneType: 'trees' }).status).toBe('discouraged');
  });

  test('les recommandations d’une zone d’arbres contiennent des arbres et des petits arbustes', () => {
    const { g, z } = jardin();
    const rec = recommendForZone(g, z, {});
    expect(rec.some((r) => r.plant.category === 'tree')).toBe(true);
    expect(rec.some((r) => isSmallShrub(r.plant))).toBe(true);
  });

  test('« Surprends-moi » mélange arbres et petits arbustes (≈ un tiers), de façon déterministe', () => {
    const { g, z } = jardin();
    const byId = Object.fromEntries(plants.map((p) => [p.id, p]));
    for (const seed of [1, 2, 3, 4, 5]) {
      const sel = suggestSelection(g, z, { seed, max: 5 });
      expect(sel.length).toBeGreaterThanOrEqual(3);
      const shrubs = sel.filter((x) => isSmallShrub(byId[x.plantId])).length;
      expect(shrubs).toBeGreaterThanOrEqual(1);
      expect(sel.length - shrubs).toBeGreaterThanOrEqual(1);
      expect(suggestSelection(g, z, { seed, max: 5 })).toEqual(sel);
    }
  });

  test('les autres types de zone ne changent pas', () => {
    const g = createGarden('x'); g.boundary = RECT(0, 0, 10, 10); g.boundaryClosed = true;
    const z = createZone('lawn', { kind: 'polygon', points: RECT(1, 1, 6, 6) }); g.zones.push(z);
    const sh = plants.find((p) => p.category === 'shrub' && !(p.zones || []).includes('lawn'));
    expect(scorePlant(sh, { tminC: -10, zoneType: 'lawn' }).reasons.find((x) => x.criterion === 'zone').text).not.toContain('Petit arbuste');
  });
});
