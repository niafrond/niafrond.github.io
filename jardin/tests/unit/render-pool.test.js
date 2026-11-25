// Piscine hors sol : plan 2D (double contour, motif d'eau, légende), vue isométrique (parois) et scène 3D temps réel (paroi, eau, échelle).
import * as THREE from '../../vendor/three/three.module.min.js';
import { renderPlanSVG } from '../../render.js';
import { renderViewSVG } from '../../render3d.js';
import { buildScene } from '../../render-gl.js';
import { createGarden, createZone, setPoolVariant } from '../../model.js';
import { getPlant } from '../../catalog.js';

function jardin(variant, kind = 'polygon') {
  const g = createGarden('Piscine');
  g.boundary = [{ x: 0, y: 0 }, { x: 14, y: 0 }, { x: 14, y: 10 }, { x: 0, y: 10 }]; g.boundaryClosed = true;
  const shape = kind === 'circle' ? { kind: 'circle', center: { x: 7, y: 5 }, radius: 2 } : { kind: 'polygon', points: [{ x: 4, y: 3 }, { x: 10, y: 3 }, { x: 10, y: 7 }, { x: 4, y: 7 }] };
  const z = createZone('pool', shape); z.id = 'z-pool';
  if (variant === 'above') setPoolVariant(z, 'above');
  g.zones.push(z);
  return g;
}
const opts = { plantsById: getPlant, month: 7, age: 1, hour: 14, quality: { density: 1, detail: 1, shadow: 1024 } };

describe('plan 2D', () => {
  test('hors sol : double contour, motif d’eau et légende « Piscine hors sol »', () => {
    const svg = renderPlanSVG(jardin('above'));
    expect(svg).toContain('data-pool="above"');
    expect(svg).toContain('data-pool-wall="1"');
    expect((svg.match(/<polygon[^>]*stroke="#e6e1d6"/g) || []).length).toBe(1);
    expect(svg).toContain('-pat-pool-above');
    expect(svg).toContain('Piscine hors sol');
    expect(svg).not.toMatch(/NaN|undefined/);
  });
  test('rond : le double contour est dessiné en cercles', () => {
    const svg = renderPlanSVG(jardin('above', 'circle'));
    expect(svg).toMatch(/<circle[^>]*stroke="#e6e1d6"/);
  });
  test('enterrée : rendu inchangé (pas de paroi)', () => {
    const svg = renderPlanSVG(jardin('inground'));
    expect(svg).not.toContain('data-pool-wall');
    expect(svg).not.toContain('pool-above');
    expect(svg).toContain('Piscine');
  });
});

describe('vue isométrique', () => {
  test('hors sol : parois extrudées, eau, margelle, échelle', () => {
    for (const v of ['iso-ne', 'iso-sw', 'front-s']) {
      const svg = renderViewSVG(jardin('above'), { view: v });
      expect(svg).toContain('data-pool="above"');
      expect(svg).not.toMatch(/NaN|undefined|Infinity/);
    }
    const svg = renderViewSVG(jardin('above'), { view: 'iso-se' });
    expect(svg).toContain('data-role="pool-water"');
    expect(svg).toContain('data-role="pool-rim"');
    expect(svg).toContain('data-role="pool-ladder"');
    expect((svg.match(/<polygon/g) || []).length).toBeGreaterThan((renderViewSVG(jardin('inground'), { view: 'iso-se' }).match(/<polygon/g) || []).length);
  });
  test('rond : fonctionne aussi', () => {
    const svg = renderViewSVG(jardin('above', 'circle'), { view: 'iso-nw' });
    expect(svg).toContain('data-pool="above"'); expect(svg).not.toMatch(/NaN/);
  });
  test('enterrée : aucune paroi', () => {
    expect(renderViewSVG(jardin('inground'), { view: 'iso-se' })).not.toContain('data-pool="above"');
  });
});

describe('scène 3D temps réel', () => {
  test('hors sol : maillage de paroi, margelle, eau à 1,05 m, échelle', () => {
    const api = buildScene(THREE, jardin('above'), opts);
    const names = api.zonesGroup.children.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(['paroi-z-pool', 'margelle-z-pool', 'eau-z-pool', 'echelle-z-pool']));
    const wall = api.zonesGroup.getObjectByName('paroi-z-pool');
    wall.geometry.computeBoundingBox();
    expect(wall.geometry.boundingBox.max.y - wall.geometry.boundingBox.min.y).toBeCloseTo(1.2, 2);
    expect(api.zonesGroup.getObjectByName('eau-z-pool').position.y).toBeCloseTo(1.05, 3);
    expect(api.waterMeshes).toHaveLength(1);
    api.dispose();
  });
  test('rond : paroi cylindrique (polygone dense)', () => {
    const api = buildScene(THREE, jardin('above', 'circle'), opts);
    const wall = api.zonesGroup.getObjectByName('paroi-z-pool');
    expect(wall.geometry.attributes.position.count).toBeGreaterThan(200);
    api.dispose();
  });
  test('enterrée : inchangée (berge, eau basse, pas de paroi)', () => {
    const api = buildScene(THREE, jardin('inground'), opts);
    expect(api.zonesGroup.getObjectByName('paroi-z-pool')).toBeUndefined();
    expect(api.zonesGroup.getObjectByName('berge-z-pool')).toBeTruthy();
    expect(api.zonesGroup.getObjectByName('eau-z-pool').position.y).toBeLessThan(0.1);
    api.dispose();
  });
});
