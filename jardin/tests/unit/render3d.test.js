import { renderViewSVG, renderContactSheet, VIEWS } from '../../render3d.js';
import { renderPlanSVG } from '../../render.js';
import { createGarden, createZone } from '../../model.js';
import { jardin, lookup, NO_LEGEND, PLANTS } from './render-fixture.js';

const view = (id, o = {}, g = jardin()) => renderViewSVG(g, { view: id, plantLookup: lookup, layers: NO_LEGEND, ...o });
const has = (svg, hex) => svg.toLowerCase().includes(hex.toLowerCase());
const IDS = VIEWS.map((v) => v.id);

describe('renderViewSVG', () => {
  test('VIEWS : dessus, 4 isométriques, 4 faces, avec libellés français', () => {
    expect(IDS).toEqual(['top', 'iso-ne', 'iso-se', 'iso-sw', 'iso-nw', 'front-s', 'front-w', 'front-n', 'front-e']);
    for (const v of VIEWS) expect(typeof v.label).toBe('string');
  });

  test('chaque vue : SVG autonome sans NaN, et toutes les vues sont différentes', () => {
    const all = IDS.map((id) => view(id));
    for (const svg of all) {
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
      expect(svg.endsWith('</svg>')).toBe(true);
      expect(svg).not.toMatch(/NaN|undefined|Infinity/);
    }
    expect(new Set(all).size).toBe(IDS.length);
  });

  test('« top » = rendu 2D illustré', () => {
    const o = { month: 5, age: 'young', width: 800, height: 600 };
    expect(renderViewSVG(jardin(), { view: 'top', plantLookup: lookup, ...o })).toBe(renderPlanSVG(jardin(), { view: 'illustrated', plantLookup: lookup, ...o }));
  });

  test('vue inconnue : repli sur le dessus', () => {
    expect(renderViewSVG(jardin(), { view: 'zzz', plantLookup: lookup })).toBe(renderViewSVG(jardin(), { view: 'top', plantLookup: lookup }));
  });

  test('couleurs réelles en isométrique et en élévation ; saison respectée', () => {
    for (const id of ['iso-ne', 'iso-sw', 'front-s', 'front-e']) {
      const pleine = view(id);
      for (const hex of ['#2f8f3f', '#2e7d4a', '#ff66aa', '#7744cc', '#dd1122', '#1f6f3a']) expect(has(pleine, hex)).toBe(true);
      const hiver = view(id, { month: 1 });
      expect(hiver).toContain('data-bare="1"');
      expect(has(hiver, '#ff66aa') || has(hiver, '#dd1122')).toBe(false);
      expect(has(view(id, { month: 4 }), '#ff66aa')).toBe(true);
      expect(has(view(id, { month: 4 }), '#7744cc')).toBe(false);
      expect(has(view(id, { month: 9 }), '#ff66aa')).toBe(false);
    }
  });

  test('volumes : maison extrudée à toit, ombres au sol, pelouse, haie continue', () => {
    const svg = view('iso-se');
    expect(svg).toContain('data-obstacle="house"');
    expect(svg).toContain('data-role="shadows"');
    expect(svg).toMatch(/pattern id="jv-lawn-/);
    expect((svg.match(/<polygon/g) || []).length).toBeGreaterThan(20);
  });

  test('rotation selon le nord du plan et élévation réglable', () => {
    const g = jardin();
    const a = view('iso-ne', {}, g);
    g.context.northAngle = 90;
    expect(view('iso-ne', {}, g)).not.toBe(a);
    g.context.northAngle = 20;
    expect(view('iso-ne', { elevation: 55 }, g)).not.toBe(a);
  });

  test('élévations : règle des hauteurs, ciel ; pas de règle en isométrique', () => {
    expect(view('front-s')).toContain('data-role="ruler"');
    expect(view('iso-ne')).not.toContain('data-role="ruler"');
  });

  test('ordre de profondeur : un mur devant un arbre est dessiné après lui', () => {
    const g = createGarden('Mur');
    g.boundary = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]; g.boundaryClosed = true;
    const z = createZone('trees', { kind: 'circle', center: { x: 5, y: 4 }, radius: 1 }); z.id = 'a';
    z.plantings = [{ plantId: 'cerisier', count: 1 }];
    g.zones.push(z);
    g.obstacles.push({ id: 'w', kind: 'wall', points: [{ x: 1, y: 7 }, { x: 9, y: 7 }], height: 3 }); // mur au sud de l'arbre
    const idx = (svg, key) => svg.indexOf(key);
    const sud = renderViewSVG(g, { view: 'front-s', plantLookup: lookup, layers: NO_LEGEND });
    expect(sud.lastIndexOf('data-obstacle="wall"')).toBeGreaterThan(idx(sud, 'data-plant="cerisier"')); // mur plus près : devant
    expect(idx(sud, 'data-obstacle="wall"')).toBeGreaterThan(idx(sud, 'data-plant="cerisier"'));
    const nord = renderViewSVG(g, { view: 'front-n', plantLookup: lookup, layers: NO_LEGEND });
    expect(nord.lastIndexOf('data-obstacle="wall"')).toBeLessThan(idx(nord, 'data-plant="cerisier"')); // mur derrière l'arbre
    // en isométrique : mur court juste au sud de l'arbre, devant depuis le sud-est, derrière depuis le nord-ouest
    g.obstacles[0].points = [{ x: 4.5, y: 7 }, { x: 5.5, y: 7 }];
    const se = renderViewSVG(g, { view: 'iso-se', plantLookup: lookup, layers: NO_LEGEND });
    expect(se.lastIndexOf('data-obstacle="wall"')).toBeGreaterThan(idx(se, 'data-plant="cerisier"'));
    const nw = renderViewSVG(g, { view: 'iso-nw', plantLookup: lookup, layers: NO_LEGEND });
    expect(nw.lastIndexOf('data-obstacle="wall"')).toBeLessThan(idx(nw, 'data-plant="cerisier"'));
  });

  test('mêmes plants qu’en 2D : autant de symboles par essence', () => {
    const count = (svg, id) => (svg.match(new RegExp(`data-plant="${id}"`, 'g')) || []).length;
    const top = renderViewSVG(jardin(), { view: 'top', plantLookup: lookup, layers: NO_LEGEND });
    const iso = view('iso-ne');
    expect(count(iso, 'lavande')).toBe(count(top, 'lavande'));
    expect(count(iso, 'rosier')).toBe(count(top, 'rosier'));
    expect(count(iso, 'cerisier')).toBe(count(top, 'cerisier'));
  });

  test('légende des essences et cartouche (nom, vue, mois, échelle, nord)', () => {
    const svg = renderViewSVG(jardin(), { view: 'iso-nw', month: 6, plantLookup: lookup });
    expect(svg).toContain('Essences');
    expect(svg).toContain('Lavande vraie ×12');
    expect(svg).toContain('Jardin &lt;test&gt;');
    expect(svg).toContain('isométrique depuis le nord-ouest');
    expect(svg).toContain('Juin');
    expect(svg).toContain('échelle approx.');
    expect(svg).toMatch(/ m<\/text>/); // barre d'échelle
    expect(svg).toContain('>N<');
  });

  test('jardin vide, contour ouvert, tailles variées : pas d’erreur', () => {
    for (const id of IDS) {
      expect(renderViewSVG(createGarden('Vide'), { view: id, width: 390, height: 844 })).not.toMatch(/NaN/);
      const g = createGarden('Ouvert'); g.boundary = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }];
      expect(renderViewSVG(g, { view: id, width: 600, height: 400 })).not.toMatch(/NaN/);
    }
  });

  test('aménagements optionnels : éléments, côtés murés et ouvertures', () => {
    const g = jardin();
    g.items = [{ id: 'i1', kind: 'table', x: 6, y: 3, width: 1.8, depth: 0.9, rotation: 0 }, { id: 'i2', kind: 'pergola', x: 3, y: 5, width: 3, depth: 3, rotation: 0 }, { id: 'i3', kind: 'parasol', x: 10, y: 3, radius: 1.5 }];
    g.boundaryEdges = [{ kind: 'wall' }, { kind: 'fence' }, { kind: 'hedge' }, { kind: 'open' }];
    g.openings = [{ id: 'o1', kind: 'gate', ref: { type: 'boundary', side: 1 }, t: 0.5 }];
    const svg = renderViewSVG(g, { view: 'iso-sw', plantLookup: lookup });
    expect(svg).not.toMatch(/NaN|undefined/);
    expect(svg).toContain('data-item="table"');
    expect(svg).toContain('data-obstacle="wall"');
    expect(svg).toContain('data-obstacle="hedge"');
  });

  test('performance : quelques centaines d’éléments en moins de 300 ms', () => {
    const g = jardin();
    const grand = createZone('midplants', { kind: 'polygon', points: [{ x: 0.5, y: 2.2 }, { x: 11.5, y: 2.2 }, { x: 11.5, y: 7 }, { x: 0.5, y: 7 }] });
    grand.id = 'big'; grand.plantings = [{ plantId: 'lavande', count: 300 }, { plantId: 'rosier', count: 120 }];
    g.zones.push(grand);
    renderViewSVG(g, { view: 'iso-ne', plantLookup: lookup }); // échauffement
    const t = Date.now();
    for (const id of ['iso-ne', 'front-s']) renderViewSVG(g, { view: id, plantLookup: lookup });
    expect((Date.now() - t) / 2).toBeLessThan(300);
  });
});

describe('renderContactSheet', () => {
  test('feuille unique : dessus + 4 isométriques + légende, 2 × 3', () => {
    const svg = renderContactSheet(jardin(), { month: 4, plantLookup: lookup });
    expect(svg.startsWith('<svg')).toBe(true);
    expect((svg.match(/<svg x=/g) || [])).toHaveLength(5);
    expect(svg).toContain('width="2000"');
    expect(svg).toContain('Jardin &lt;test&gt;');
    expect(svg).toContain('Avril');
    expect(svg).toContain('Lavande vraie ×12');
    expect(svg).not.toMatch(/NaN|undefined/);
    // identifiants uniques entre cellules
    const ids = [...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

void PLANTS;
