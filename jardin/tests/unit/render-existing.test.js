import { renderItemsSVG, itemsLegendEntries } from '../../render-items.js';
import { renderPlanSVG } from '../../render.js';
import { createExisting, setFenceMaterial } from '../../existing.js';
import { jardin, lookup, NO_LEGEND } from './render-fixture.js';

const PL = { erable: { id: 'erable', commonName: 'Érable <test>', latinName: 'Acer', category: 'tree', heightAdult: 10, widthAdult: 6, foliageColor: '#123456' } };
const pl = (id) => PL[id];

function avec() {
  const g = jardin();
  const t = createExisting('tree', { x: 3, y: 4 }); t.plantId = 'erable'; t.label = 'Érable <test>';
  const s = createExisting('shrub', { x: 6, y: 4 });
  const hd = createExisting('hedge', [{ x: 1, y: 7 }, { x: 5, y: 7 }]);
  const cl = createExisting('climber', { x: 1, y: 0.3 });
  const v = createExisting('perennial', { x: 9, y: 3 }); v.keep = false;
  g.existing = [t, s, hd, cl, v];
  return g;
}

describe('rendu SVG des existants', () => {
  test('chaque type est dessiné, couleur de l’essence, nom échappé', () => {
    const svg = renderItemsSVG(avec(), { scale: 20, plantLookup: pl });
    for (const k of ['tree', 'shrub', 'hedge', 'climber', 'perennial']) expect(svg).toContain(`data-kind="${k}"`);
    expect(svg).toContain('#123456'); expect(svg).toContain('Érable &lt;test&gt;');
    expect(svg).not.toContain('<test>');
  });
  test('« à retirer » : pastille barrée et mention', () => {
    const svg = renderItemsSVG(avec(), { scale: 20, plantLookup: pl });
    expect(svg).toContain('data-role="remove-badge"'); expect(svg).toContain('(à retirer)'); expect(svg).toContain('data-keep="0"');
    expect(svg.match(/remove-badge/g)).toHaveLength(1);
  });
  test('clôtures : un motif par matériau', () => {
    const g = jardin();
    const mk = (m) => { const f = createExisting('fence', [{ x: 1, y: 1 }, { x: 5, y: 1 }]); setFenceMaterial(f, m); return f; };
    g.existing = [mk('wood'), mk('metal'), mk('concrete')];
    const svg = renderItemsSVG(g, { scale: 20 });
    for (const m of ['wood', 'metal', 'concrete']) expect(svg).toContain(`data-material="${m}"`);
    expect(svg).toContain('<circle'); // poteaux métal
    const leg = itemsLegendEntries(g).filter((e) => e.type === 'existing');
    expect(leg.map((e) => e.label)).toEqual(['Clôture existante (bois)', 'Clôture existante (métal)', 'Clôture existante (béton)']);
  });
  test('matériau d’un côté de contour', () => {
    const g = jardin(); g.boundaryEdges = [{ kind: 'wall', height: 2, material: 'brick' }, { kind: 'fence', height: 1.2 }];
    const svg = renderItemsSVG(g, { scale: 20 });
    expect(svg).toContain('data-material="brick"'); expect(svg).toContain('data-material="wood"');
  });
  test('légende des existants', () => {
    const e = itemsLegendEntries(avec()).filter((x) => x.type === 'existing');
    expect(e.map((x) => x.id)).toEqual(['existing-tree', 'existing-shrub', 'existing-hedge', 'existing-climber', 'existing-perennial']);
  });
  test('le plan final (renderPlanSVG) contient les existants sans toucher render.js', () => {
    const svg = renderPlanSVG(avec(), { plantLookup: lookup, ...NO_LEGEND, names: true });
    expect(svg).toContain('data-existing=');
    expect(svg).toContain('data-kind="hedge"');
  });
});
