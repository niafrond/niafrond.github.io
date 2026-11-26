import { createGarden, createZone, createItem } from '../../model.js';
import { allPlants } from '../../catalog.js';
import { renderPlanSVG } from '../../render.js';
import { elementAnchors } from '../../render-items.js';

const r = (x, y, w, h) => ({ kind: 'polygon', points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });
function jardin() {
  const g = createGarden('Couches');
  g.boundary = r(0, 0, 12, 8).points; g.boundaryClosed = true;
  const m = createZone('midplants', r(0, 0, 6, 3));
  const p = allPlants().filter((q) => q.category === 'perennial' && q.flowerColor).slice(0, 2);
  m.plantings = p.map((q) => ({ plantId: q.id, count: 4 }));
  const l = createZone('lawn', r(0, 3, 12, 5)); l.plantings = [{ plantId: allPlants().find((q) => q.category === 'lawn').id, count: 1 }];
  g.zones = [m, l];
  g.obstacles = [{ id: 'h', kind: 'house', points: r(7, 0.5, 4, 1.5).points, height: 5 }];
  g.items = [createItem('bench', 3, 3.5), createItem('table_round', 9, 5)];
  return g;
}
const g = jardin();
const sp = new Map(g.zones[0].plantings.map((q, i) => [q.plantId, i + 1]));

describe('plan SVG : couches, ghost, numérotation, crop, print', () => {
  test('rendu par défaut inchangé par les options absentes', () => {
    const a = renderPlanSVG(g, {}); const b = renderPlanSVG(g, { layers: {}, ghost: [], numbering: null });
    expect(a).toBe(b);
    expect(a).toContain('data-item='); expect(a).toContain('data-plant='); expect(a).not.toContain('data-ghost');
  });
  test('couches désactivables', () => {
    const noPlants = renderPlanSVG(g, { layers: { plants: false } });
    expect(noPlants).not.toContain('data-plant='); expect(noPlants).toContain('data-zone=');
    const noZones = renderPlanSVG(g, { layers: { zones: false } });
    expect(noZones).not.toContain('data-zone="'); expect(noZones).toContain('data-plant=');
    const noItems = renderPlanSVG(g, { layers: { items: false } });
    expect(noItems).not.toContain('data-item=');
    const noExisting = renderPlanSVG(g, { layers: { existing: false, legend: false } });
    expect(noExisting).not.toContain('Maison');
    const only = renderPlanSVG(g, { bg: 'none', layers: { terrain: true, items: false, existing: false, zones: false, plants: false, zoneNames: false, dims: false, frame: false } });
    expect(only).not.toContain('data-zone=');
    expect(only).not.toMatch(/<rect width="\d+" height="\d+" fill="#fff/);
  });
  test('ghost : couches adoucies en niveaux de gris', () => {
    const s = renderPlanSVG(g, { ghost: ['items', 'existing'] });
    expect(s).toMatch(/<g data-ghost="items" opacity="0.35" filter="url\(#jp-ghost\)">/);
    expect(s).toContain('data-ghost="existing"');
    expect(s).toContain('<feColorMatrix type="saturate" values="0"/>');
    expect(s.indexOf('data-ghost="items"')).toBeLessThan(s.indexOf('data-plant='));
    expect(renderPlanSVG(g, { ghost: ['zones'], ghostOpacity: 0.5 })).toContain('opacity="0.5"');
  });
  test('numérotation des éléments, des essences et des zones', () => {
    const items = new Map([[`item:${g.items[0].id}`, 1], [`item:${g.items[1].id}`, 2], ['obstacle:h', 3]]);
    const s = renderPlanSVG(g, { numbering: { items, species: sp, zones: new Map([[g.zones[0].id, 1]]) } });
    expect(s).toContain('data-num-kind="el"'); expect(s).toContain('data-num="3"');
    expect(s).toContain('data-num-kind="sp"'); expect(s).toContain('Z1 · ');
    expect(elementAnchors(g).get('obstacle:h')).toEqual({ x: 9, y: 1.25 });
  });
  test('crop : vue rapprochée, autres zones adoucies, clip', () => {
    const s = renderPlanSVG(g, { crop: { zoneId: g.zones[0].id, margin: 1 } });
    expect(s).toContain('clipPath'); expect(s).toContain(`data-crop="${g.zones[0].id}"`);
    expect(s).toContain('data-out-of-focus="1"');
    expect(s).not.toBe(renderPlanSVG(g, {}));
  });
  test('print : pas d\'emoji, pas de cartouche', () => {
    const emo = /\p{Extended_Pictographic}/u;
    const normal = renderPlanSVG(g, { layers: { cartouche: false } });
    expect(emo.test(normal)).toBe(true);
    const print = renderPlanSVG(g, { print: true, layers: { cartouche: false, legend: false } });
    expect(emo.test(print)).toBe(false);
    expect(print).not.toContain('Vue du dessus');
  });
});
