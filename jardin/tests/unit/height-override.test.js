// Hauteurs réglées à la main : habitParams, placePlants (2D / 3D), ombre, cohérence, piscine hors sol, pergola, clôture.
import { habitParams } from '../../habits.js';
import { placePlants } from '../../render-common.js';
import { placePlants as placeGl, runJob, slimPlant } from '../../gl-worker-core.js';
import { jobsForGarden } from '../../render-gl.js';
import { shadowObstacles, zoneShadowObstacles, sunHoursOnPoint } from '../../sun.js';
import { checkCoherence } from '../../recommend.js';
import { createGarden, createZone, createItem, setPoolVariant } from '../../model.js';
import { itemObstacles, edgeObstacles } from '../../items.js';
import { PLANTS, lookup } from './render-fixture.js';

const rect = (x0, y0, x1, y1) => ({ kind: 'polygon', points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] });

describe('habitParams avec réglage', () => {
  test('hauteur / largeur remplacent le catalogue, le facteur d’âge reste proportionnel', () => {
    const p = PLANTS.cerisier;
    const base = habitParams(p, { age: 1 });
    const grand = habitParams(p, { age: 1, height: 15 });
    expect(base.height).toBe(6);
    expect(grand.height).toBe(15); expect(grand.heightAdult).toBe(15);
    expect(grand.trunkHeight).toBeCloseTo(base.trunkHeight * 15 / 6, 5);
    const jeune = habitParams(p, { age: 'young', height: 15 });
    expect(jeune.height).toBeCloseTo(15 * 0.35, 5);
    expect(jeune.height / jeune.heightAdult).toBeCloseTo(base.ageFactor === 1 ? habitParams(p, { age: 'young' }).height / 6 : 0, 5);
    expect(habitParams(p, { width: 9 }).width).toBe(9);
    expect(habitParams(p, { height: -3 }).height).toBe(6); // valeur invalide ignorée
  });
});

describe('placePlants avec réglage', () => {
  const zone = (pl) => { const z = createZone('trees', { kind: 'circle', center: { x: 5, y: 5 }, radius: 2 }); z.id = 'zt'; z.plantings = [pl]; return z; };
  test('2D / iso : la plante placée porte la hauteur réglée', () => {
    const a = placePlants(null, zone({ plantId: 'cerisier', count: 1 }), PLANTS)[0];
    const b = placePlants(null, zone({ plantId: 'cerisier', count: 1, height: 15, width: 8 }), PLANTS)[0];
    expect(a.plant.heightAdult).toBe(6);
    expect(b.plant.heightAdult).toBe(15); expect(b.plant.widthAdult).toBe(8);
    expect(b.r).toBeGreaterThan(a.r);
    expect(PLANTS.cerisier.heightAdult).toBe(6); // catalogue intact
  });
  test('3D : placePlants et tâches des workers', () => {
    const z = zone({ plantId: 'cerisier', count: 1, height: 15 });
    expect(placeGl(null, z, PLANTS)[0].plant.heightAdult).toBe(15);
    const g = createGarden('x'); g.zones.push(z);
    const jobs = jobsForGarden(g, lookup);
    expect(jobs[0].plants.cerisier.heightAdult).toBe(15);
    expect(jobs[0].zone.plantings[0].height).toBe(15);
    const res = (h) => { const zz = zone({ plantId: 'cerisier', count: 1, height: h }); const gg = createGarden('y'); gg.zones.push(zz); return runJob(jobsForGarden(gg, lookup)[0]); };
    const top = (r) => Math.max(...r.groups.flatMap((q) => { const ys = []; for (let i = 0; i < q.n; i++) ys.push(q.matrices[i * 16 + 13] + Math.abs(q.matrices[i * 16 + 5])); return ys; }));
    expect(top(res(15))).toBeGreaterThan(top(res(8)) * 1.3);
  });
  test('sans réglage : identique à avant (même objet plante)', () => {
    const z = zone({ plantId: 'cerisier', count: 1 });
    expect(placePlants(null, z, PLANTS)[0].plant).toBe(PLANTS.cerisier);
    expect(slimPlant(PLANTS.cerisier).heightAdult).toBe(6);
  });
});

describe('ombre', () => {
  test('piscine hors sol et terrasse surélevée deviennent des obstacles à leur hauteur', () => {
    const g = createGarden('o');
    const pool = createZone('pool', rect(2, 2, 6, 6)); setPoolVariant(pool, 'above'); pool.id = 'p';
    const ter = createZone('terrace', rect(8, 2, 11, 5)); ter.id = 't';
    g.zones.push(pool, ter);
    expect(zoneShadowObstacles(g)).toHaveLength(1);
    expect(zoneShadowObstacles(g)[0].height).toBe(1.2);
    pool.height = 1.6; ter.height = 0.5;
    const o = shadowObstacles(g);
    expect(o.find((x) => x.id === 'zone_p').height).toBe(1.6);
    expect(o.find((x) => x.id === 'zone_t').height).toBe(0.5);
  });
  test('un arbre planté plus haut ombrage plus longtemps', () => {
    const mk = (h) => {
      const g = createGarden('s');
      const z = createZone('trees', { kind: 'circle', center: { x: 5, y: 5 }, radius: 1 }); z.id = 'zt';
      z.plantings = [{ plantId: 'cerisier', count: 1, ...(h ? { height: h } : {}) }];
      g.zones.push(z); return g;
    };
    const pt = { x: 5, y: 0.5 };
    const hrs = (g) => sunHoursOnPoint(pt, { lat: 45, lon: 3, northAngle: 0, date: new Date(Date.UTC(2026, 5, 21, 12)), obstacles: shadowObstacles(g, { plantLookup: lookup }) });
    expect(zoneShadowObstacles(mk(null), { plantLookup: lookup })[0].height).toBe(6);
    expect(zoneShadowObstacles(mk(15), { plantLookup: lookup })[0].height).toBe(15);
    expect(hrs(mk(15))).toBeLessThan(hrs(mk(null)));
    expect(shadowObstacles(mk(15)).some((o) => o.zone)).toBe(false); // sans lookup : inchangé
  });
  test('pergola et clôture : hauteurs réglées prises en compte', () => {
    const g = createGarden('i');
    const it = createItem('pergola', 4, 4); g.items.push(it);
    expect(itemObstacles(g)[0].height).toBe(2.4);
    it.height = 3; expect(itemObstacles(g)[0].height).toBe(3);
    g.boundary = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }]; g.boundaryClosed = true;
    g.boundaryEdges = [{ kind: 'fence', height: 1.2 }, { kind: 'fence', height: 2.5 }];
    expect(edgeObstacles(g).map((e) => e.height)).toEqual([1.2, 2.5]);
  });
});

describe('checkCoherence avec hauteurs réglées', () => {
  const garden = (treeHeight) => {
    const g = createGarden('c');
    g.boundary = [{ x: 0, y: 0 }, { x: 14, y: 0 }, { x: 14, y: 10 }, { x: 0, y: 10 }]; g.boundaryClosed = true;
    const t = createZone('terrace', rect(6, 6, 10, 9)); t.id = 'ter';
    const a = createZone('trees', { kind: 'circle', center: { x: 4, y: 7 }, radius: 1 }); a.id = 'arb';
    a.plantings = [{ plantId: 'rosier', count: 1, ...(treeHeight ? { height: treeHeight } : {}) }];
    g.zones.push(t, a);
    return g;
  };
  const plants = Object.values(PLANTS);
  test('un arbuste réglé à 6 m déclenche l’avertissement « à moins de 3 m d’une terrasse »', () => {
    expect(checkCoherence(garden(null), { plants }).filter((w) => /moins de 3 m/.test(w.text))).toHaveLength(0);
    const w = checkCoherence(garden(6), { plants }).filter((x) => /moins de 3 m/.test(x.text));
    expect(w).toHaveLength(1); expect(w[0].text).toContain('6 m');
  });
  test('haie ou clôture haute (> 2 m) au sud d’une zone en plein soleil', () => {
    const g = createGarden('h');
    g.boundary = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 8 }, { x: 0, y: 8 }]; g.boundaryClosed = true;
    g.context.northAngle = 0; g.context.location = { lat: 46, lon: 2 };
    g.sun = { mode: 'uniform', uniform: 'full', regions: [] };
    const z = createZone('midplants', rect(2, 1, 10, 4)); z.id = 'm'; z.label = 'Massif'; z.plantings = [{ plantId: 'rosier', count: 2 }];
    g.zones.push(z);
    g.obstacles.push({ id: 'cl', kind: 'fence', points: [{ x: 1, y: 6 }, { x: 11, y: 6 }], height: 1.2 });
    const sud = (gg) => checkCoherence(gg, { plants: Object.values(PLANTS) }).filter((w) => /au sud de la zone/.test(w.text));
    expect(sud(g)).toHaveLength(0);
    g.obstacles[0].height = 2.6;
    const w = sud(g); expect(w).toHaveLength(1); expect(w[0].text).toContain('2,6 m');
    g.obstacles[0].points = [{ x: 1, y: -3 }, { x: 11, y: -3 }]; // au nord : pas d'avertissement
    expect(sud(g)).toHaveLength(0);
  });
});
