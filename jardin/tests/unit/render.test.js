import { renderPlanSVG } from '../../render.js';
import { createGarden, createZone } from '../../model.js';
import { allPlants } from '../../catalog.js';

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
