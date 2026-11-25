import { renderPlanSVG } from '../../render.js';
import { createGarden, createZone } from '../../model.js';
import { allPlants } from '../../catalog.js';
import { jardin as jardinCouleurs, lookup, NO_LEGEND } from './render-fixture.js';

function jardin() {
  const g = createGarden('Test <jardin>');
  g.boundary = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }];
  g.boundaryClosed = true;
  g.context.northAngle = 30;
  g.context.commune = 'Lyon';
  const terrasse = createZone('terrace', { kind: 'polygon', points: [{ x: 0.5, y: 0.5 }, { x: 4, y: 0.5 }, { x: 4, y: 3 }, { x: 0.5, y: 3 }] });
  terrasse.label = 'Terrasse sud';
  const arbre = createZone('trees', { kind: 'circle', center: { x: 7, y: 5 }, radius: 2 });
  const p = allPlants().find((x) => x.category === 'tree');
  if (p) arbre.plantings.push({ plantId: p.id, count: 1 });
  const haie = createZone('hedge', { kind: 'line', points: [{ x: 0.5, y: 7.5 }, { x: 9.5, y: 7.5 }], width: 1 });
  g.zones.push(terrasse, arbre, haie);
  g.obstacles.push({ id: 'o1', kind: 'house', points: [{ x: 4.5, y: 0.2 }, { x: 9.5, y: 0.2 }, { x: 9.5, y: 2 }, { x: 4.5, y: 2 }], height: 6 });
  g.sun = { mode: 'map', uniform: null, regions: [{ id: 'r', level: 'shade', points: [{ x: 5, y: 3 }, { x: 9, y: 3 }, { x: 9, y: 6 }] }] };
  return g;
}

// Bien formé : balises équilibrées et attributs entre guillemets
function bienForme(svg) {
  const re = /<\/?([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g;
  const pile = [];
  let m;
  while ((m = re.exec(svg))) {
    const [, nom, , auto] = m;
    if (m[0].startsWith('</')) { if (pile.pop() !== nom) return false; } else if (!auto) pile.push(nom);
  }
  return pile.length === 0;
}

describe('renderPlanSVG', () => {
  test('SVG autonome, bien formé, contient les zones', () => {
    const svg = renderPlanSVG(jardin());
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toMatch(/viewBox="0 0 1000 760"/);
    expect(bienForme(svg)).toBe(true);
    expect(svg).toContain('Terrasse sud');
    expect(svg).toContain('data-zone');
    expect(svg).toContain('Test &lt;jardin&gt;');
    expect(svg).toContain('10,00 m');
    expect(svg).toContain('80,0 m²');
    expect(svg).not.toMatch(/NaN|undefined/);
  });

  test('vue illustrée : dégradés et ombres', () => {
    const svg = renderPlanSVG(jardin(), { view: 'illustrated', age: 'young', layers: { sun: true, dims: false, legend: false, names: false } });
    expect(svg).toContain('feDropShadow');
    expect(svg).toContain('linearGradient');
    expect(svg).not.toContain('10,00 m<');
    expect(bienForme(svg)).toBe(true);
    expect(svg).not.toMatch(/NaN|undefined/);
  });

  test('nord orienté, jardin vide, viewBox selon width/height', () => {
    expect(renderPlanSVG(jardin())).toContain('rotate(30)');
    const vide = renderPlanSVG(createGarden('Vide'), { width: 600, height: 500 });
    expect(vide).toContain('viewBox="0 0 600 500"');
    expect(bienForme(vide)).toBe(true);
    expect(vide).not.toMatch(/NaN|undefined/);
  });
});

describe('renderPlanSVG : vraies couleurs des essences', () => {
  const FOLIAGES = ['#2f8f3f', '#6f8f6a', '#2e7d4a', '#1f6f3a'];
  const render = (o = {}) => renderPlanSVG(jardinCouleurs(), { plantLookup: lookup, ...o });
  const has = (svg, hex) => svg.toLowerCase().includes(hex.toLowerCase());

  test('toutes les vues 2D contiennent feuillage et fleurs réels (pleine floraison)', () => {
    for (const view of ['plan', 'illustrated']) {
      const svg = render({ view, layers: NO_LEGEND });
      for (const hex of [...FOLIAGES.slice(0, 3), '#ff66aa', '#7744cc', '#dd1122']) expect(has(svg, hex)).toBe(true);
      expect(svg).toContain('data-flower="1"');
      expect(svg).not.toMatch(/NaN|undefined/);
    }
  });

  test('hors floraison : seulement le feuillage (pas de couleur de fleur)', () => {
    const svg = render({ view: 'illustrated', month: 12, layers: NO_LEGEND });
    for (const hex of ['#ff66aa', '#7744cc', '#dd1122']) expect(has(svg, hex)).toBe(false);
    expect(svg).not.toContain('data-flower');
    expect(has(svg, '#6f8f6a')).toBe(true);
  });

  test('floraison selon le mois : avril = cerisier seul ; juillet = lavande et rosier', () => {
    const avril = render({ month: 4, layers: NO_LEGEND });
    expect(has(avril, '#ff66aa')).toBe(true); expect(has(avril, '#7744cc')).toBe(false); expect(has(avril, '#dd1122')).toBe(false);
    const juillet = render({ month: 7, layers: NO_LEGEND });
    expect(has(juillet, '#7744cc')).toBe(true); expect(has(juillet, '#dd1122')).toBe(true); expect(has(juillet, '#ff66aa')).toBe(false);
  });

  test('caduc dépouillé de novembre à mars, feuillu en été ; persistant toujours feuillu', () => {
    const hiver = render({ month: 1, layers: NO_LEGEND });
    expect(hiver).toContain('data-bare="1"');
    expect(has(hiver, '#2f8f3f')).toBe(false); // cerisier sans feuilles
    expect(has(hiver, '#6f8f6a')).toBe(true); // lavande persistante
    const ete = render({ month: 6, layers: NO_LEGEND });
    expect(ete).not.toContain('data-bare="1"');
    expect(has(ete, '#2f8f3f')).toBe(true);
    // en avril le cerisier fleurit mais n'est pas dépouillé
    expect(render({ month: 4, layers: NO_LEGEND })).not.toContain('data-bare="1"');
  });

  test('légende « Essences » : pastilles de couleurs réelles et quantités, groupées par zone', () => {
    const svg = render({ view: 'plan' });
    expect(svg).toContain('Essences');
    expect(svg).toContain('Lavande vraie ×12');
    expect(svg).toContain('Buis ×12');
    expect(svg).toContain('Massif');
    const i = svg.indexOf('Essences');
    expect(has(svg.slice(i), '#7744cc')).toBe(true);
    expect(has(svg.slice(i), '#2e7d4a')).toBe(true);
  });

  test('déterministe, mois lisible dans le cartouche, budget conservé', () => {
    expect(render({ month: 5 })).toBe(render({ month: 5 }));
    expect(render({ month: 5 })).not.toBe(render({ month: 9 }));
    expect(render({ month: 3 })).toContain('Mars');
    expect(render()).toContain('Pleine floraison');
    expect(renderPlanSVG(jardinCouleurs(), { plantLookup: lookup, layers: { budget: true } })).toMatch(/Budget estimé/);
  });

  test('gazon texturé, ombres en vue illustrée seulement, jeunes plants plus petits', () => {
    const ill = render({ view: 'illustrated' });
    expect(ill).toMatch(/pattern id="jp-lawn-/);
    expect(ill).toContain('data-role="shadows"');
    expect(render({ view: 'plan' })).not.toContain('data-role="shadows"');
    expect(render({ age: 'young' })).not.toBe(render({ age: 'adult' }));
  });

  test('légende volumineuse : reste dans le cadre (compacte ou tronquée), jamais de NaN', () => {
    const g = jardinCouleurs();
    const z = g.zones[1];
    const many = {};
    z.plantings = Array.from({ length: 40 }, (_, i) => { many[`p${i}`] = { id: `p${i}`, commonName: `Essence ${i}`, category: 'perennial', heightAdult: 0.5, widthAdult: 0.4, spacing: 0.4, bloom: [6], flowerColor: '#aa3366', foliageColor: '#336633' }; return { plantId: `p${i}`, count: 2 }; });
    for (const [w, h] of [[1000, 760], [1000, 1500]]) {
      const svg = renderPlanSVG(g, { plantLookup: (id) => many[id] || lookup(id), width: w, height: h });
      expect(svg).not.toMatch(/NaN|undefined/);
      expect(svg).toContain('data-role="legend"');
    }
  });

  test('aménagements : éléments, côtés muraux et légende « Aménagements »', () => {
    const g = jardinCouleurs();
    g.items = [{ id: 'i1', kind: 'table', x: 6, y: 3, width: 1.8, depth: 0.9, rotation: 0 }];
    g.boundaryEdges = [{ kind: 'wall' }];
    const svg = renderPlanSVG(g, { plantLookup: lookup });
    expect(svg).toContain('data-item="i1"');
    expect(svg).toContain('Aménagements');
    expect(svg).not.toMatch(/NaN|undefined/);
  });
});
