// Rendu des hauteurs réglées : isométrique (SVG) et scène 3D temps réel.
import * as THREE from '../../vendor/three/three.module.min.js';
import { renderViewSVG } from '../../render3d.js';
import { buildScene } from '../../render-gl.js';
import { createGarden, createZone, createItem, setPoolVariant } from '../../model.js';
import { getPlant } from '../../catalog.js';
import { PLANTS, lookup } from './render-fixture.js';

const base = () => {
  const g = createGarden('H');
  g.boundary = [{ x: 0, y: 0 }, { x: 14, y: 0 }, { x: 14, y: 10 }, { x: 0, y: 10 }]; g.boundaryClosed = true;
  return g;
};
/** Étendue verticale (px) de tous les points des groupes `<g attr>` du SVG. */
function extentY(svg, attr) {
  const ys = [];
  for (const m of svg.matchAll(new RegExp(`<g ${attr}[^>]*>(.*?)</g>`, 'gs'))) {
    for (const p of m[1].matchAll(/points="([^"]+)"/g)) for (const pair of p[1].trim().split(/\s+/)) ys.push(Number(pair.split(',')[1]));
    for (const p of m[1].matchAll(/\b(?:cy|y|y1|y2)="(-?[\d.]+)"/g)) ys.push(Number(p[1]));
    for (const d of m[1].matchAll(/\sd="([^"]+)"/g)) for (const n of d[1].matchAll(/[ML]\s*(-?[\d.]+)[ ,](-?[\d.]+)/g)) ys.push(Number(n[2]));
  }
  return ys.length ? Math.max(...ys) - Math.min(...ys) : 0;
}
const iso = (g) => renderViewSVG(g, { view: 'iso-se', plantLookup: lookup });

describe('isométrique', () => {
  test('une pergola de 3 m est plus haute qu’une pergola de 2,4 m', () => {
    const mk = (h) => { const g = base(); const it = createItem('pergola', 7, 5); if (h) it.height = h; g.items.push(it); return g; };
    const a = extentY(iso(mk(null)), 'data-item="pergola"'); const b = extentY(iso(mk(3)), 'data-item="pergola"');
    expect(a).toBeGreaterThan(10);
    expect(b).toBeGreaterThan(a * 1.05);
  });
  test('un arbre de 15 m est plus haut qu’un arbre de 8 m (même catalogue)', () => {
    const mk = (h) => { const g = base(); const z = createZone('trees', { kind: 'circle', center: { x: 7, y: 5 }, radius: 1.5 }); z.plantings = [{ plantId: 'cerisier', count: 1, ...(h ? { height: h } : {}) }]; g.zones.push(z); return g; };
    const a = extentY(iso(mk(8)), 'data-plant="cerisier"'); const b = extentY(iso(mk(15)), 'data-plant="cerisier"');
    expect(a).toBeGreaterThan(20);
    expect(b).toBeGreaterThan(a * 1.3);
  });
  test('piscine hors sol : la paroi suit la hauteur réglée', () => {
    const mk = (h) => { const g = base(); const z = createZone('pool', { kind: 'polygon', points: [{ x: 4, y: 3 }, { x: 10, y: 3 }, { x: 10, y: 7 }, { x: 4, y: 7 }] }); setPoolVariant(z, 'above'); if (h) z.height = h; g.zones.push(z); return g; };
    const a = extentY(iso(mk(null)), 'data-pool="above"'); const b = extentY(iso(mk(2)), 'data-pool="above"');
    expect(b).toBeGreaterThan(a * 1.1);
  });
  test('clôture : plus haute réglée = plus haute à l’écran', () => {
    const mk = (h) => { const g = base(); g.obstacles.push({ id: 'c', kind: 'fence', points: [{ x: 3, y: 5 }, { x: 11, y: 5 }], height: h }); return g; };
    expect(extentY(iso(mk(2.5)), 'data-obstacle="fence"') - extentY(iso(mk(1.2)), 'data-obstacle="fence"')).toBeGreaterThan(25);
  });
});

const opts = { plantsById: getPlant, month: 7, age: 1, hour: 14, quality: { density: 1, detail: 1, shadow: 1024 } };
const hOf = (obj) => { const b = new THREE.Box3().setFromObject(obj); return b.max.y - b.min.y; };

describe('scène 3D temps réel', () => {
  test('la paroi d’une piscine hors sol, l’eau et l’échelle ont la hauteur réglée', () => {
    const mk = (h) => { const g = base(); const z = createZone('pool', { kind: 'polygon', points: [{ x: 4, y: 3 }, { x: 10, y: 3 }, { x: 10, y: 7 }, { x: 4, y: 7 }] }); z.id = 'p'; setPoolVariant(z, 'above'); if (h) z.height = h; g.zones.push(z); return g; };
    const a0 = buildScene(THREE, mk(null), opts); expect(hOf(a0.zonesGroup.getObjectByName('paroi-p'))).toBeCloseTo(1.2, 2); a0.dispose();
    const a = buildScene(THREE, mk(1.6), opts);
    expect(hOf(a.zonesGroup.getObjectByName('paroi-p'))).toBeCloseTo(1.6, 2);
    expect(a.zonesGroup.getObjectByName('eau-p').position.y).toBeCloseTo(1.45, 3);
    expect(a.zonesGroup.getObjectByName('margelle-p').position.y).toBeCloseTo(1.6, 3);
    a.dispose();
  });
  test('terrasse surélevée : épaisseur = hauteur réglée', () => {
    const g = base(); const z = createZone('terrace', { kind: 'polygon', points: [{ x: 4, y: 3 }, { x: 8, y: 3 }, { x: 8, y: 6 }, { x: 4, y: 6 }] }); z.id = 't'; z.height = 0.6; g.zones.push(z);
    const api = buildScene(THREE, g, opts);
    const m = api.zonesGroup.children.find((c) => c.name.startsWith('zone-terrace'));
    expect(hOf(m)).toBeCloseTo(0.6, 2);
    api.dispose();
  });
  test('pergola : poteaux et toit à la hauteur réglée', () => {
    const mk = (h) => { const g = base(); const it = createItem('pergola', 7, 5); if (h) it.height = h; g.items.push(it); return g; };
    const a = buildScene(THREE, mk(null), opts); const b = buildScene(THREE, mk(3.2), opts);
    const find = (api) => new THREE.Box3().setFromObject(api.scene.getObjectByName('structures')).max.y;
    const ha = find(a); const hb = find(b);
    expect(ha).toBeGreaterThan(2); expect(hb).toBeGreaterThan(ha + 0.6);
    a.dispose(); b.dispose();
  });
  test('arbre : le houppier suit la hauteur réglée', () => {
    const mk = (h) => { const g = base(); const z = createZone('trees', { kind: 'circle', center: { x: 7, y: 5 }, radius: 1.5 }); z.plantings = [{ plantId: 'cerisier', count: 1, ...(h ? { height: h } : {}) }]; g.zones.push(z); return g; };
    const hc = (api) => { let top = 0; api.meshes.forEach((m) => { if (m.userData.plantId === 'cerisier') { m.geometry.computeBoundingBox(); const bb = m.geometry.boundingBox; for (let i = 0; i < m.count; i++) { const mat = new THREE.Matrix4(); m.getMatrixAt(i, mat); const v = new THREE.Vector3(0, bb.max.y, 0).applyMatrix4(mat); top = Math.max(top, v.y); } } }); return top; };
    const a = buildScene(THREE, mk(null), { ...opts, plantsById: lookup }); const b = buildScene(THREE, mk(18), { ...opts, plantsById: lookup });
    expect(hc(b)).toBeGreaterThan(hc(a) * 2);
    a.dispose(); b.dispose();
  });
});
