// Scène 3D temps réel : modèle par port (bambou, conifère, haie, grimpante…), déterminisme, saisons, qualité, existants, clôtures.
import * as THREE from '../../vendor/three/three.module.min.js';
import { buildScene } from '../../render-gl.js';
import { createGarden, createZone } from '../../model.js';
import { getPlant } from '../../catalog.js';

const rect = (x0, y0, x1, y1) => ({ kind: 'polygon', points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] });
function jardin(plantId, count = 1, shape = rect(3, 3, 9, 8), type = 'midplants') {
  const g = createGarden('Ports');
  g.boundary = [{ x: 0, y: 0 }, { x: 14, y: 0 }, { x: 14, y: 12 }, { x: 0, y: 12 }]; g.boundaryClosed = true;
  if (plantId) { const z = createZone(type, shape); z.id = `z-${plantId}`; z.plantings.push({ plantId, count }); g.zones.push(z); }
  return g;
}
const opts = (o = {}) => ({ plantsById: getPlant, month: 7, age: 1, hour: 14, quality: { density: 1, detail: 1, shadow: 512 }, ...o });
const parts = (api, id) => { const m = {}; for (const im of api.meshes) if (im.userData.plantId === id) m[im.userData.part] = im; return m; };
const count = (api, id, part) => (parts(api, id)[part] ? parts(api, id)[part].count : 0);
const visible = (api, id, part) => !!(parts(api, id)[part] && parts(api, id)[part].visible);

describe('modèle par port', () => {
  test('bambou : nombreux chaumes verticaux fins, plumeaux de feuilles, base dense', () => {
    const api = buildScene(THREE, jardin('bambou-fargesia', 2), opts());
    expect(count(api, 'bambou-fargesia', 'culm')).toBeGreaterThanOrEqual(30);
    expect(count(api, 'bambou-fargesia', 'plume')).toBeGreaterThanOrEqual(count(api, 'bambou-fargesia', 'culm'));
    expect(count(api, 'bambou-fargesia', 'crown')).toBeGreaterThanOrEqual(2);
    // chaume mince : rayon ≪ hauteur
    const a = parts(api, 'bambou-fargesia').culm.instanceMatrix.array;
    expect(Math.hypot(a[0], a[1], a[2])).toBeLessThan(0.1); expect(Math.hypot(a[4], a[5], a[6])).toBeGreaterThan(0.8);
    api.dispose();
  });
  test('conifère : cônes étagés sombres ; colonne : pile étroite', () => {
    const c = buildScene(THREE, jardin('cedre-de-l-atlas-bleu'), opts());
    expect(count(c, 'cedre-de-l-atlas-bleu', 'cone')).toBeGreaterThanOrEqual(4);
    const k = buildScene(THREE, jardin('cypres-de-provence'), opts());
    const cones = parts(k, 'cypres-de-provence').cone.instanceMatrix.array;
    expect(Math.hypot(cones[0], cones[1], cones[2])).toBeLessThan(1.2); // étroit (2 m de large)
    c.dispose(); k.dispose();
  });
  test('pleureur : rideau jusqu’au sol ; parasol : houppier plat ; fruitier : fruits', () => {
    const w = buildScene(THREE, jardin('bouleau-verruqueux'), opts());
    expect(count(w, 'bouleau-verruqueux', 'curtain')).toBeGreaterThanOrEqual(1);
    const cm = parts(w, 'bouleau-verruqueux').curtain.instanceMatrix.array;
    expect(cm[13]).toBeLessThan(0.3); // part du sol
    const u = buildScene(THREE, jardin('albizia'), opts());
    const cr = parts(u, 'albizia').crown.instanceMatrix.array;
    expect(Math.hypot(cr[0], cr[1], cr[2])).toBeGreaterThan(Math.hypot(cr[4], cr[5], cr[6]) * 2);
    const f = buildScene(THREE, jardin('pommier'), opts({ month: 9 }));
    expect(count(f, 'pommier', 'fruit')).toBeGreaterThan(0);
    w.dispose(); u.dispose(); f.dispose();
  });
  test('haie : volume continu (tronçons jointifs de même hauteur), orienté le long de la ligne', () => {
    const api = buildScene(THREE, jardin('charmille', 1, { kind: 'line', points: [{ x: 2, y: 6 }, { x: 12, y: 6 }], width: 0.8 }, 'hedge'), opts());
    const im = parts(api, 'charmille').hedgebox; const n = im.count; const a = im.instanceMatrix.array;
    expect(n).toBeGreaterThanOrEqual(8);
    const xs = []; const hs = new Set();
    for (let i = 0; i < n; i++) { xs.push(a[i * 16 + 12]); hs.add(Math.round(Math.hypot(a[i * 16 + 4], a[i * 16 + 5], a[i * 16 + 6]) * 100)); expect(Math.abs(a[i * 16 + 14] - 6)).toBeLessThan(0.01); }
    xs.sort((p, q) => p - q);
    const pas = Math.max(...xs.slice(1).map((x, i) => x - xs[i])); const lg = Math.hypot(a[0], a[1], a[2]);
    expect(pas).toBeLessThan(lg); // les tronçons se recouvrent
    expect(hs.size).toBe(1); // hauteur régulière
    api.dispose();
  });
  test('grimpante : support (treillage / tuteur) et tiges', () => {
    const api = buildScene(THREE, jardin('clematite-montana', 1), opts());
    const p = parts(api, 'clematite-montana');
    expect(p.trunk.count).toBeGreaterThanOrEqual(2); expect(p.slat.count).toBeGreaterThanOrEqual(5); // pergola : poteaux, lattes
    expect(p.branch.count).toBeGreaterThanOrEqual(2); expect(p.crown.count).toBeGreaterThanOrEqual(8);
    const t = buildScene(THREE, jardin('clematite-viticella', 1), opts());
    expect(count(t, 'clematite-viticella', 'trunk')).toBe(3); // tuteur à trois cannes
    api.dispose(); t.dispose();
  });
  test('grimpante contre un mur : pas de support, feuillage sur la paroi', () => {
    const g = jardin('clematite-viticella', 2, rect(2, 1, 9, 4));
    g.obstacles.push({ id: 'mur', kind: 'wall', points: [{ x: 1, y: 0.6 }, { x: 12, y: 0.6 }], height: 2.2 });
    const api = buildScene(THREE, g, opts());
    expect(count(api, 'clematite-viticella', 'slat')).toBe(0);
    const a = parts(api, 'clematite-viticella').crown.instanceMatrix.array;
    for (let i = 0; i < parts(api, 'clematite-viticella').crown.count; i++) expect(Math.abs(a[i * 16 + 14] - 0.82)).toBeLessThan(0.3);
    api.dispose();
  });
  test('autres ports : graminée, rosette, fougère, vivace à hampes, nénuphar', () => {
    for (const [id, part] of [['h-miscanthus', 'fountain'], ['h-hosta', 'leaf'], ['h-fougere-male', 'frond'], ['h-echinacee', 'stem'], ['h-nenuphar', 'pad'], ['forsythia', 'arc']]) {
      const api = buildScene(THREE, jardin(id, 2), opts());
      expect(count(api, id, part)).toBeGreaterThan(0);
      api.dispose();
    }
  });
});

describe('déterminisme, saisons, qualité', () => {
  const sig = (api) => api.meshes.map((m) => `${m.name}:${m.count}:${Array.from(m.instanceMatrix.array.slice(0, 32)).map((v) => v.toFixed(4)).join(',')}`).join('|');
  test('même graine = même scène', () => {
    expect(sig(buildScene(THREE, jardin('bambou-fargesia', 2), opts()))).toBe(sig(buildScene(THREE, jardin('bambou-fargesia', 2), opts())));
  });
  test('saisons : bambou persistant, caducs dépouillés, fruits seulement en été', () => {
    const b = buildScene(THREE, jardin('bambou-fargesia', 1), opts({ month: 1 }));
    expect(visible(b, 'bambou-fargesia', 'culm')).toBe(true); expect(visible(b, 'bambou-fargesia', 'plume')).toBe(true);
    const w = buildScene(THREE, jardin('bouleau-verruqueux'), opts({ month: 1 }));
    expect(visible(w, 'bouleau-verruqueux', 'curtain')).toBe(false); expect(visible(w, 'bouleau-verruqueux', 'branch')).toBe(true);
    w.update({ month: 7 }); expect(visible(w, 'bouleau-verruqueux', 'curtain')).toBe(true);
    const p = buildScene(THREE, jardin('pommier'), opts({ month: 1 }));
    expect(visible(p, 'pommier', 'fruit')).toBe(false); p.update({ month: 9 }); expect(visible(p, 'pommier', 'fruit')).toBe(true);
    const c = buildScene(THREE, jardin('clematite-viticella'), opts({ month: 1 }));
    expect(visible(c, 'clematite-viticella', 'crown')).toBe(false); expect(visible(c, 'clematite-viticella', 'branch')).toBe(true);
    [b, w, p, c].forEach((a) => a.dispose());
  });
  test('floraison des hampes : épis visibles seulement en saison', () => {
    const id = 'h-echinacee'; const pl = getPlant(id);
    const api = buildScene(THREE, jardin(id, 3), opts({ month: pl.bloom[0] }));
    expect(visible(api, id, 'spike')).toBe(true);
    api.update({ month: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].find((m) => !pl.bloom.includes(m)) });
    expect(visible(api, id, 'spike')).toBe(false);
    api.dispose();
  });
  test('qualité Basse : moins d’instances qu’en Haute', () => {
    const lourd = buildScene(THREE, jardin('bambou-fargesia', 3), opts({ quality: { density: 1, detail: 2 } }));
    const leger = buildScene(THREE, jardin('bambou-fargesia', 3), opts({ quality: { density: 0.35, detail: 1 } }));
    expect(leger.stats.instances).toBeLessThan(lourd.stats.instances * 0.8);
    expect(leger.stats.instances).toBeGreaterThan(40);
    const geo = (a) => parts(a, 'bambou-fargesia').culm.geometry.attributes.position.count;
    expect(geo(leger)).toBeLessThan(geo(lourd));
    lourd.dispose(); leger.dispose();
  });
});

describe('plantes existantes', () => {
  const ex = (o) => ({ kind: 'tree', plant: null, habit: { id: 'tree-round' }, ...o });
  test('taille actuelle (pas de croissance) et estompées si non conservées', () => {
    const existing = [ex({ id: 'a', x: 4, y: 6, height: 6, width: 4, keep: true }), ex({ id: 'b', x: 10, y: 6, height: 6, width: 4, keep: false })];
    const api = buildScene(THREE, jardin(null), opts({ existing, age: 0.1 }));
    const top = (id) => { const im = parts(api, id).crown; const a = im.instanceMatrix.array; let t = 0; for (let i = 0; i < im.count; i++) t = Math.max(t, a[i * 16 + 13] + Math.hypot(a[i * 16 + 4], a[i * 16 + 5], a[i * 16 + 6])); return t; };
    expect(top('_ex_a')).toBeGreaterThan(4.5);
    api.update({ age: 0 }); expect(top('_ex_a')).toBeGreaterThan(4.5);
    const mA = parts(api, '_ex_a').crown.material; const mB = parts(api, '_ex_b').crown.material;
    expect(mA.opacity).toBe(1); expect(mB.opacity).toBeLessThan(0.5); expect(mB.transparent).toBe(true);
    expect(parts(api, '_ex_b').trunk.material.opacity).toBeLessThan(0.5);
    api.dispose();
  });
  test('haie existante le long des points : tronçons de haie', () => {
    const api = buildScene(THREE, jardin(null), opts({ existing: [ex({ id: 'h', kind: 'hedge', points: [{ x: 2, y: 3 }, { x: 10, y: 3 }], height: 2, width: 1, keep: true, habit: { id: 'hedge-clipped' }, x: undefined, y: undefined })] }));
    expect(count(api, '_ex_h', 'hedgebox')).toBeGreaterThanOrEqual(8);
    api.dispose();
  });
});

describe('clôtures et murs par matériau', () => {
  const avec = (kind, material) => { const g = jardin(null); g.obstacles.push({ id: 'o', kind, points: [{ x: 2, y: 4 }, { x: 11, y: 4 }], height: 1.6, material }); return g; };
  const noms = (api) => api.structures.children.map((c) => c.name);
  for (const [kind, mats] of [['fence', ['wood', 'metal', 'concrete', 'mesh']], ['wall', ['stone', 'concrete', 'brick']]]) {
    for (const m of mats) test(`${kind} en ${m}`, () => {
      const api = buildScene(THREE, avec(kind, m), opts());
      expect(noms(api)).toContain(`linear-${kind}-${m}`);
      const grp = api.structures.children.find((c) => c.name === `linear-${kind}-${m}`);
      if (kind === 'fence' && (m === 'metal' || m === 'mesh')) expect(grp.children.some((c) => c.isInstancedMesh && c.count > 20)).toBe(true); // barreaux / maille fine
      if (kind === 'fence' && m === 'wood') expect(grp.children.length).toBeGreaterThanOrEqual(5); // planches + poteaux et chapeaux
      api.dispose();
    });
  }
  test('matériau absent : bois (clôture) / béton (mur) ; existante non conservée estompée', () => {
    expect(noms(buildScene(THREE, avec('fence', undefined), opts()))).toContain('linear-fence-wood');
    expect(noms(buildScene(THREE, avec('wall', undefined), opts()))).toContain('linear-wall-concrete');
    const api = buildScene(THREE, jardin(null), opts({ existing: [{ id: 'c', kind: 'fence', plant: null, points: [{ x: 2, y: 8 }, { x: 10, y: 8 }], height: 1.5, material: 'metal', keep: false }] }));
    const grp = api.structures.children.find((c) => c.name === 'linear-fence-metal');
    expect(grp).toBeTruthy(); expect(grp.userData.existing).toBe(true);
    expect(grp.children.every((c) => !c.material || c.material.opacity < 0.5)).toBe(true);
    api.dispose();
  });
});
