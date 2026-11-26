import { renderPlanSVG, placePlants } from '../../render.js';
import { minDistance } from '../../spacing.js';
import { createZone } from '../../model.js';
import { jardin, PLANTS, lookup } from './render-fixture.js';

const rect = (x, y, w, h) => ({ kind: 'polygon', points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });
const PL = { ...PLANTS,
  tilleul: { id: 'tilleul', commonName: 'Tilleul', category: 'tree', heightAdult: 8, widthAdult: 4, spacing: 4, foliage: 'deciduous', bloom: [6], flowerColor: '#ddcc55', foliageColor: '#3a7d3a' },
  chevrefeuille: { id: 'chevrefeuille', commonName: 'Spirée', category: 'shrub', heightAdult: 1.5, widthAdult: 1.2, spacing: 1, foliage: 'deciduous', bloom: [5], flowerColor: '#ffffff', foliageColor: '#4c8c3c' },
};
const look = (id) => PL[id];

const pairs = (pl) => { const o = []; for (let i = 0; i < pl.length; i++) for (let j = i + 1; j < pl.length; j++) o.push([pl[i], pl[j]]); return o; };

describe('placePlants respecte les distances horticoles', () => {
  test('zone d’arbres : arbre + arbustes + vivaces, aucune paire trop proche', () => {
    const g = jardin();
    const z = createZone('trees', rect(0, 0, 5.3, 5.3)); z.id = 'zt';
    z.plantings = [{ plantId: 'tilleul', count: 1 }, { plantId: 'chevrefeuille', count: 5 }, { plantId: 'lavande', count: 20 }];
    const pl = placePlants(g, z, look);
    expect(pl).toHaveLength(26);
    for (const [a, b] of pairs(pl)) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(minDistance(a.plant, b.plant) - 1e-6);
  });
  test('massif de la fixture : distance ≥ minDistance pour toutes les paires', () => {
    const g = jardin();
    const pl = placePlants(g, g.zones.find((z) => z.id === 'z-massif'), look);
    for (const [a, b] of pairs(pl)) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(minDistance(a.plant, b.plant) - 1e-6);
  });
  test('le SVG 2D contient les mêmes plants que placePlants (mêmes positions)', () => {
    const g = jardin();
    const svg = renderPlanSVG(g, { layers: { plants: true, legend: false }, plantLookup: look });
    expect(typeof svg).toBe('string');
    expect(svg.length).toBeGreaterThan(500);
    const a = placePlants(g, g.zones.find((z) => z.id === 'z-massif'), look);
    const b = placePlants(g, g.zones.find((z) => z.id === 'z-massif'), look);
    expect(a.map((p) => [p.x, p.y])).toEqual(b.map((p) => [p.x, p.y]));
  });
});
