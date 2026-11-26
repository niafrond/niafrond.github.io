/** @jest-environment jsdom */
import { createGarden, createZone, createItem } from '../../model.js';
import { allPlants } from '../../catalog.js';
import { renderPlanSVG } from '../../render.js';
import { xmlSafe, esc, cleanSvgNumbers } from '../../render-common.js';

const r = (x, y, w, h) => ({ kind: 'polygon', points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });
const base = () => { const g = createGarden('Base'); g.boundary = r(0, 0, 12, 8).points; g.boundaryClosed = true; return g; };
const pl = (n = 2) => allPlants().filter((p) => p.category === 'perennial').slice(0, n).map((p) => ({ plantId: p.id, count: 5 }));
const NASTY = 'Mare « é » 😀 \u0000\u0001\u001f \ud800 seul \udc00 ￾￿ & < > " \'';

const variants = {
  'contour vide': () => { const g = createGarden('v'); return g; },
  'contour ouvert': () => { const g = base(); g.boundaryClosed = false; g.zones = [createZone('lawn', r(1, 1, 3, 3))]; return g; },
  'zone sans forme': () => { const g = base(); const z = createZone('lawn', r(1, 1, 3, 3)); z.shape = null; g.zones = [z]; return g; },
  'zone NaN': () => { const g = base(); g.zones = [createZone('lawn', { kind: 'polygon', points: [{ x: NaN, y: 0 }, { x: 3, y: NaN }, { x: 3, y: 3 }] })]; return g; },
  'cercle NaN': () => { const g = base(); g.zones = [createZone('trees', { kind: 'circle', center: { x: NaN, y: 2 }, radius: NaN })]; return g; },
  'plantId inconnu': () => { const g = base(); const z = createZone('midplants', r(1, 1, 4, 3)); z.plantings = [{ plantId: 'zzz', count: 3 }, { plantId: undefined, count: 1 }]; g.zones = [z]; return g; },
  'count NaN': () => { const g = base(); const z = createZone('midplants', r(1, 1, 4, 3)); z.plantings = pl().map((p) => ({ ...p, count: NaN })); g.zones = [z]; return g; },
  'hauteur NaN': () => { const g = base(); const z = createZone('midplants', r(1, 1, 4, 3)); z.plantings = pl().map((p) => ({ ...p, height: NaN, width: Infinity })); g.zones = [z]; return g; },
  'noms hostiles': () => { const g = base(); g.name = NASTY; const z = createZone('midplants', r(1, 1, 4, 3)); z.label = NASTY; z.plantings = pl(); g.zones = [z]; g.items = [{ ...createItem('bench', 3, 3), label: NASTY }]; return g; },
  'item incomplet': () => { const g = base(); g.items = [{ id: 'a', kind: 'bench' }, { id: 'b', kind: 'inconnu', x: 1, y: 1 }, { id: 'c', kind: 'table_round', x: NaN, y: 2, radius: NaN }]; return g; },
  'existant incomplet': () => { const g = base(); g.existing = [{ id: 'e1', kind: 'tree' }, { id: 'e2', kind: 'hedge', points: [{ x: 1, y: 1 }] }, { id: 'e3', kind: 'fence', points: [{ x: NaN, y: 1 }, { x: 2, y: 2 }], label: NASTY }, { id: 'e4', kind: 'shrub', x: 2, y: 2, width: Infinity, keep: false }]; return g; },
  'obstacle incomplet': () => { const g = base(); g.obstacles = [{ id: 'o1', kind: 'house' }, { id: 'o2', kind: 'wall', points: [{ x: 1, y: 1 }] }, { id: 'o3', kind: 'tree', center: { x: 2, y: 2 }, radius: NaN }, { id: 'o4', kind: 'house', points: [{ x: 1, y: 1 }, { x: NaN, y: 4 }, { x: 4, y: 4 }], height: NaN }]; return g; },
  'côtés et matériaux': () => { const g = base(); g.boundaryEdges = [{ kind: 'wall', material: 'inconnu' }, { kind: 'fence', material: 'metal', height: NaN }, { kind: 'hedge' }, { kind: 'zzz' }]; return g; },
  'ouverture orpheline': () => { const g = base(); g.openings = [{ id: 'op', kind: 'gate', ref: { type: 'boundary', side: 99 }, t: NaN }, { id: 'op2', kind: 'zzz' }]; return g; },
  'mare, piscine, allée hors terrain': () => { const g = base(); g.zones = [createZone('pond', { kind: 'circle', center: { x: 20, y: 20 }, radius: 2 }), (() => { const z = createZone('pool', r(-5, -5, 3, 3)); z.variant = 'above'; return z; })(), createZone('path', { kind: 'line', points: [{ x: -3, y: 2 }, { x: 15, y: 2 }], width: 1 })]; return g; },
  'contexte étrange': () => { const g = base(); g.context = { northAngle: NaN, region: NASTY, altitude: 'x' }; g.sun = { mode: 'map', regions: [{ level: 'zzz', points: [{ x: 0, y: 0 }, { x: NaN, y: 1 }, { x: 2, y: 2 }] }] }; return g; },
  'beaucoup de plants': () => { const g = base(); const z = createZone('midplants', r(0, 0, 12, 8)); z.plantings = allPlants().filter((p) => p.category !== 'lawn').slice(0, 40).map((p) => ({ plantId: p.id, count: 30 })); g.zones = [z]; return g; },
  'zone dupliquée sans id': () => { const g = base(); const z = createZone('lawn', r(1, 1, 3, 3)); delete z.id; g.zones = [z, { ...z }]; return g; },
};

const opts = [{}, { view: 'illustrated' }, { print: true, idPrefix: 'pdf', layers: { legend: false, cartouche: false }, ghost: ['zones', 'items'], numbering: { species: new Map(), items: new Map(), zones: new Map() } }, { print: true, simple: true }];

describe('SVG du plan : jamais NaN / undefined / Infinity, toujours du XML valide', () => {
  test('18 variantes', () => { expect(Object.keys(variants)).toHaveLength(18); });
  for (const [name, mk] of Object.entries(variants)) {
    test(name, () => {
      const g = mk();
      for (const o of opts) {
        const svg = renderPlanSVG(g, { width: 900, height: 600, ...o });
        expect(svg).not.toMatch(/NaN|Infinity|undefined/);
        // caractères interdits en XML 1.0 et surrogates isolés
        expect(svg).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
        const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
        expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
        expect(doc.documentElement.getAttribute('viewBox')).toMatch(/^0 0 \d+ \d+$/);
      }
    });
  }
  test('assainissement des textes et des nombres', () => {
    expect(xmlSafe('a\u0000b\ud800c\udc00d😀')).toBe('abcd😀');
    expect(esc('<a & "b">\u0001')).toBe('&lt;a &amp; &quot;b&quot;&gt;');
    expect(cleanSvgNumbers('<c r="NaN" points="1,2 Infinity,undefined" data-x="ok"/>')).toBe('<c r="0" points="1,2 0,0" data-x="ok"/>');
  });
});
