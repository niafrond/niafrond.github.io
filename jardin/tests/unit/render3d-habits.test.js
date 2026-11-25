// Vue isométrique et élévations : silhouettes par port, couleurs, saisons, existants et matériaux de clôtures.
import { renderViewSVG } from '../../render3d.js';
import { createGarden, createZone } from '../../model.js';

const rect = (x0, y0, x1, y1) => ({ kind: 'polygon', points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] });
function jardin(plantId, count = 1, shape = rect(2, 2, 8, 8), type = 'midplants') {
  const g = createGarden('Ports');
  g.boundary = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 10 }, { x: 0, y: 10 }]; g.boundaryClosed = true;
  const z = createZone(type, shape); z.id = `z-${plantId}`; z.plantings.push({ plantId, count });
  g.zones.push(z);
  return g;
}
const L = { legend: false, names: false, cartouche: false };
const svgOf = (g, o = {}) => renderViewSVG(g, { view: 'iso-ne', width: 900, height: 700, month: 7, layers: L, ...o });
const groupe = (svg, id) => { const m = new RegExp(`<g data-plant="${id}"[^>]*>`, 'g'); return [...svg.matchAll(m)].length; };
const inner = (svg, id) => { const i = svg.indexOf(`<g data-plant="${id}"`); return i < 0 ? '' : svg.slice(i, i + 6000); };

describe('silhouettes isométriques par port', () => {
  test('bambou en faisceau de chaumes, distinct d’un arbre rond et d’un conifère', () => {
    const b = svgOf(jardin('bambou-fargesia', 2)); const r = svgOf(jardin('pommier-a-fleurs', 1)); const c = svgOf(jardin('cedre-de-l-atlas-bleu', 1));
    expect((b.match(/data-culm="1"/g) || []).length).toBeGreaterThanOrEqual(18);
    expect(b).toContain('data-plume="1"');
    expect(r).not.toContain('data-culm'); expect(r).not.toContain('data-tier');
    expect((c.match(/data-tier="/g) || []).length).toBeGreaterThanOrEqual(4);
    expect(c).not.toContain('data-culm');
  });
  test('colonne, pleureur, parasol, vase, palmier ont des formes dédiées', () => {
    expect(svgOf(jardin('cypres-de-provence', 1))).toContain('data-shape="column"');
    expect(svgOf(jardin('bouleau-verruqueux', 1))).toContain('data-shape="curtain"');
    expect(svgOf(jardin('albizia', 1))).toContain('data-shape="umbrella"');
    expect(svgOf(jardin('cerisier-a-fleurs', 1))).toContain('data-shape="vase"');
    expect(svgOf(jardin('forsythia', 1))).toContain('data-shape="arching"');
  });
  test('haie : volume continu (pas d’ellipsoïdes) et rosette / graminée dessinées', () => {
    const h = svgOf(jardin('charmille', 6, { kind: 'line', points: [{ x: 1, y: 5 }, { x: 11, y: 5 }], width: 0.8 }, 'hedge'));
    expect(h).toMatch(/data-plant="charmille"[^>]*data-family="hedge"/);
    expect(h).not.toContain('data-shape=');
    expect(svgOf(jardin('h-hosta', 3))).toContain('data-family="rosette"');
    expect(svgOf(jardin('h-miscanthus', 2))).toContain('data-family="fountain"');
  });
  test('grimpante : support et tiges contre le mur', () => {
    const g = jardin('clematite-viticella', 2, rect(2, 1, 8, 4));
    g.obstacles.push({ id: 'mur', kind: 'wall', points: [{ x: 1, y: 0.6 }, { x: 10, y: 0.6 }], height: 2.2 });
    const s = svgOf(g);
    expect(s).toContain('data-stems="1"'); expect(s).toContain('data-support="wall"');
    const libre = svgOf(jardin('clematite-viticella', 1));
    expect(libre).toContain('data-support="tripod"');
  });
  test('saisons : branches nues l’hiver, fruits en été, couleurs conservées', () => {
    expect(svgOf(jardin('bouleau-verruqueux', 1), { month: 1 })).toContain('data-bare="1"');
    expect(svgOf(jardin('pommier', 1), { month: 8 })).toContain('data-fruit="1"');
    expect(svgOf(jardin('pommier', 1), { month: 1 })).not.toContain('data-fruit="1"');
    expect(svgOf(jardin('bambou-fargesia', 1), { month: 1 })).toContain('data-culm="1"'); // persistant
  });
  test('élévations : mêmes silhouettes', () => {
    for (const v of ['front-s', 'front-w']) {
      expect(svgOf(jardin('bambou-fargesia', 2), { view: v })).toContain('data-culm="1"');
      expect(svgOf(jardin('cedre-de-l-atlas-bleu', 1), { view: v })).toContain('data-tier=');
    }
  });
});

describe('plantes existantes', () => {
  const g = () => { const x = createGarden('Ex'); x.boundary = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 10 }, { x: 0, y: 10 }]; x.boundaryClosed = true; return x; };
  test('arbre existant à sa taille actuelle ; estompé si non conservé', () => {
    const existing = [
      { id: 'a', kind: 'tree', plant: null, x: 3, y: 5, height: 6, width: 4, keep: true, habit: { id: 'tree-round' } },
      { id: 'b', kind: 'tree', plant: null, x: 8, y: 5, height: 6, width: 4, keep: false, habit: { id: 'tree-conical' } },
    ];
    const s = svgOf(g(), { existing });
    expect(s).toContain('data-existing="1"'); expect(s.match(/data-ghost="1"/g).length).toBeGreaterThan(0);
    expect(s).toContain('data-tier=');
    expect(svgOf(g(), { existing: [] })).not.toContain('data-existing');
  });
  test('haie existante : volume continu le long des points', () => {
    const s = svgOf(g(), { existing: [{ id: 'h', kind: 'hedge', plant: null, points: [{ x: 1, y: 2 }, { x: 10, y: 2 }], height: 2, width: 1, keep: true, habit: { id: 'hedge-clipped' } }] });
    expect(s).toMatch(/data-existing="1" data-kind="shrub" data-family="hedge"/);
  });
});

describe('clôtures et murs par matériau', () => {
  const avec = (kind, material, extra = {}) => { const x = createGarden('M'); x.boundary = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 10 }, { x: 0, y: 10 }]; x.boundaryClosed = true; x.obstacles.push({ id: 'o', kind, points: [{ x: 2, y: 3 }, { x: 10, y: 3 }], height: 1.6, material, ...extra }); return x; };
  for (const [kind, mats] of [['fence', ['wood', 'metal', 'concrete', 'mesh']], ['wall', ['stone', 'concrete', 'brick']]]) {
    for (const m of mats) {
      test(`${kind} en ${m}`, () => {
        const s = svgOf(avec(kind, m));
        expect(s).toContain(`data-obstacle="${kind}" data-material="${m}"`);
      });
    }
  }
  test('matériaux distincts : rendus différents ; absent = bois (clôture) / béton (mur)', () => {
    const strip = (s) => s.replace(/data-material="[a-z]+"/g, '');
    const f = ['wood', 'metal', 'concrete', 'mesh'].map((m) => strip(svgOf(avec('fence', m))));
    expect(new Set(f).size).toBe(4);
    expect(svgOf(avec('fence', undefined))).toContain('data-material="wood"');
    expect(svgOf(avec('wall', undefined))).toContain('data-material="concrete"');
  });
  test('clôture existante estompée si non conservée', () => {
    const s = svgOf(avec('fence', 'wood'), { existing: [{ id: 'c', kind: 'fence', plant: null, points: [{ x: 2, y: 7 }, { x: 10, y: 7 }], height: 1.5, material: 'metal', keep: false }] });
    expect(s).toContain('data-material="metal" data-ghost="1"');
  });
});
