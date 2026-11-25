// Scène 3D : construction, saisons, âge, soleil, libération (three.js vendorisé, sans GPU ni DOM).
import * as THREE from '../../vendor/three/three.module.min.js';
import { buildScene, sunDirection } from '../../render-gl.js';
import { sunPosition } from '../../sun.js';
import { createGarden, createZone } from '../../model.js';
import { allPlants, getPlant } from '../../catalog.js';

const P = allPlants();
const first = (pred) => P.find(pred);
const arbreCaduc = first((p) => p.category === 'tree' && p.foliage === 'deciduous' && p.bloom.length && p.flowerColor);
const vivace = first((p) => p.category === 'perennial' && p.bloom.length && p.flowerColor);

function jardin() {
  const g = createGarden('Fixture');
  g.boundary = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 14 }, { x: 0, y: 14 }];
  g.boundaryClosed = true;
  g.context.northAngle = 30;
  g.context.location = { lat: 45.76, lon: 4.84 };
  const t = createZone('trees', { kind: 'circle', center: { x: 14, y: 9 }, radius: 3 }); t.plantings.push({ plantId: arbreCaduc.id, count: 2 });
  const m = createZone('midplants', { kind: 'polygon', points: [{ x: 2, y: 8 }, { x: 9, y: 8 }, { x: 9, y: 12 }, { x: 2, y: 12 }] }); m.plantings.push({ plantId: vivace.id, count: 10 });
  const l = createZone('lawn', { kind: 'polygon', points: [{ x: 1, y: 1 }, { x: 9, y: 1 }, { x: 9, y: 6 }, { x: 1, y: 6 }] });
  const e = createZone('pond', { kind: 'circle', center: { x: 12, y: 3 }, radius: 1.5 });
  g.zones.push(t, m, l, e);
  g.obstacles.push({ id: 'h', kind: 'house', points: [{ x: 11, y: 5.5 }, { x: 16, y: 5.5 }, { x: 16, y: 7.5 }, { x: 11, y: 7.5 }], height: 6 });
  return g;
}
const opts = (o = {}) => ({ plantsById: getPlant, month: 7, age: 1, hour: 14, quality: { density: 1, detail: 1, shadow: 1024 }, ...o });
const visible = (api, id, part) => api.meshes.filter((m) => m.userData.plantId === id && m.userData.part === part && m.visible);

describe('buildScene', () => {
  test('maillages et instances présents', () => {
    const api = buildScene(THREE, jardin(), opts());
    expect(api.scene.getObjectByName('sol')).toBeTruthy();
    expect(api.zonesGroup.children.length).toBeGreaterThanOrEqual(3);
    expect(api.structures.children.length).toBeGreaterThan(0);
    expect(api.stats.instances).toBeGreaterThan(0);
    expect(api.meshes.every((m) => m.isInstancedMesh)).toBe(true);
    expect(api.bounds.cx).toBeCloseTo(10, 5);
    api.dispose();
  });

  test('fleurs visibles seulement les mois de floraison', () => {
    const api = buildScene(THREE, jardin(), opts({ month: arbreCaduc.bloom[0] }));
    expect(visible(api, vivace.id, 'flower').length).toBe(vivace.bloom.includes(arbreCaduc.bloom[0]) ? 1 : 0);
    const hors = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].find((mo) => !vivace.bloom.includes(mo));
    api.update({ month: vivace.bloom[0] });
    expect(visible(api, vivace.id, 'flower').length).toBe(1);
    api.update({ month: hors });
    expect(visible(api, vivace.id, 'flower').length).toBe(0);
    api.dispose();
  });

  test('caduc dépouillé l’hiver (branches), feuillé l’été', () => {
    const api = buildScene(THREE, jardin(), opts({ month: 7 }));
    expect(visible(api, arbreCaduc.id, 'crown').length).toBe(1);
    expect(visible(api, arbreCaduc.id, 'branch').length).toBe(0);
    api.update({ month: 1 });
    expect(visible(api, arbreCaduc.id, 'crown').length).toBe(0);
    expect(visible(api, arbreCaduc.id, 'branch').length).toBe(1);
    api.dispose();
  });

  test('l’âge change les hauteurs (0,35 → 1)', () => {
    const api = buildScene(THREE, jardin(), opts());
    const adulte = api.topHeight();
    api.update({ age: 0 });
    const jeune = api.topHeight();
    expect(jeune).toBeLessThan(adulte * 0.6);
    expect(jeune).toBeGreaterThan(adulte * 0.25);
    api.update({ age: 1 });
    expect(api.topHeight()).toBeCloseTo(adulte, 5);
    api.dispose();
  });

  test('le soleil suit sunPosition, la latitude, l’heure et northAngle', () => {
    const g = jardin();
    const date = new Date(2026, 5, 21);
    const api = buildScene(THREE, g, opts({ date, month: 6, hour: 14 }));
    const s = sunDirection(g, { date, hour: 14 });
    const ref = sunPosition(45.76, 4.84, new Date(Date.UTC(2026, 5, 21) + (14 - 4.84 / 15) * 3600000));
    expect(s.elevation).toBeCloseTo(ref.elevation, 6);
    const dir = api.sun.position.clone().sub(api.sun.target.position).normalize();
    expect(dir.y).toBeCloseTo(Math.sin((ref.elevation * Math.PI) / 180), 3);
    const a = ((ref.azimuth + 30) * Math.PI) / 180;
    expect(dir.x).toBeGreaterThan(0 - 1); // sanity
    const horiz = Math.hypot(dir.x, dir.z);
    expect(dir.x / horiz).toBeCloseTo(Math.sin(a), 3);
    expect(dir.z / horiz).toBeCloseTo(-Math.cos(a), 3);
    // la nuit : plus de soleil
    api.update({ hour: 1 });
    expect(api.sun.intensity).toBeLessThan(0.01);
    api.dispose();
  });

  test('latitude par défaut (France) sans position, et jardin vide sans erreur', () => {
    expect(sunDirection({ context: {} }, { date: new Date(2026, 5, 21), hour: 12 }).lat).toBeCloseTo(46.5);
    const api = buildScene(THREE, createGarden('vide'), { plantsById: getPlant });
    expect(api.stats.instances).toBe(0);
    api.dispose();
  });

  test('dispose libère la scène', () => {
    const api = buildScene(THREE, jardin(), opts());
    let freed = 0;
    api.meshes[0].geometry.addEventListener('dispose', () => { freed++; });
    api.dispose();
    expect(freed).toBe(1);
    expect(api.scene.children.length).toBe(0);
    expect(api.disposed).toBe(true);
  });
});
