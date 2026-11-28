// Jardins de test déterministes pour les golden recommend / massifs : les jardins existants (golden-lib, fixtures-jardins,
// tests/unit/massif-fixtures.js) déclinés avec climat / sol / vent / entretien différents, plus un jardin « mares et haies ».
import { gardens as mainGardens, plantSample } from './golden-lib.mjs';
import { makeGardens, SYNTH } from './fixtures-jardins.mjs';
import { gardenA, gardenBig, rect } from '../../jardin/tests/unit/massif-fixtures.js';
import { createGarden, createZone, createItem } from '../../jardin/model.js';
import { allPlants } from '../../jardin/catalog.js';

export { SYNTH };

const clone = (o) => JSON.parse(JSON.stringify(o));
const sq = (x, y, w, h) => ({ kind: 'polygon', points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });

function norm(g, id) {
  g.id = id;
  g.createdAt = g.updatedAt = '2026-01-01T00:00:00.000Z';
  g.zones.forEach((z, i) => { z.id = z.id && !/^z_[0-9a-f]{16}$/.test(z.id) ? z.id : `z${i + 1}`; });
  (g.items || []).forEach((it, i) => { if (/^i_[0-9a-f]{16}$/.test(it.id || '')) it.id = `i${i + 1}`; });
  (g.openings || []).forEach((it, i) => { if (!it.id || /^[a-z]+_[0-9a-f]{16}$/.test(it.id)) it.id = `op${i + 1}`; });
  (g.existing || []).forEach((it, i) => { if (!it.id || /^[a-z]+_[0-9a-f]{16}$/.test(it.id)) it.id = `e${i + 1}`; });
  return g;
}

/** Jardin « mares, haies et arbres » : mares de tailles variées, haie haute au sud, arbres près d'une terrasse, noms d'ambiance. */
function gardenExtra() {
  const g = createGarden('Extra');
  g.boundary = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 30 }, { x: 0, y: 30 }]; g.boundaryClosed = true;
  g.boundaryEdges = [{ kind: 'hedge', height: 2.5 }, { kind: 'wall' }, { kind: 'fence', height: 2.2 }, { kind: 'open' }];
  g.sun = { mode: 'uniform', uniform: 'full', regions: [] };
  g.obstacles = [{ id: 'mur', kind: 'wall', points: [{ x: 5, y: 12 }, { x: 15, y: 12 }], height: 2.6 }, { id: 'clo', kind: 'fence', points: [{ x: 20, y: 5 }, { x: 28, y: 5 }] }];
  const Z = (type, shape, extra = {}) => Object.assign(createZone(type, shape), extra);
  const cat = (c, i) => allPlants().filter((p) => p.category === c)[i].id;
  g.zones = [
    Z('midplants', sq(6, 6, 8, 4), { label: 'Massif bucolique' }),
    Z('lawn', sq(16, 6, 10, 8), { label: 'Pelouse' }),
    Z('pond', sq(1, 14, 2, 1), { label: 'Mare', plantings: [{ plantId: 'h-nenuphar', count: 3 }] }),
    Z('pond', sq(6, 15, 3, 3), { label: 'Mare 9' }),
    Z('pond', sq(12, 15, 6, 5), { label: 'Grande mare', depth: 90 }),
    Z('pond', sq(22, 15, 10, 10), { label: 'Étang', depth: 30 }),
    Z('hedge', { kind: 'line', points: [{ x: 4, y: 11 }, { x: 16, y: 11 }], width: 1 }, { label: 'Haie haute', plantings: [{ plantId: cat('hedge', 0), count: 10, height: 3 }] }),
    Z('terrace', sq(30, 2, 6, 4), { label: 'Terrasse zen' }),
    Z('trees', { kind: 'circle', center: { x: 31, y: 8 }, radius: 2 }, { plantings: [{ plantId: cat('tree', 0), count: 1 }, { plantId: cat('tree', 3), count: 1, height: 12, width: 8 }] }),
    Z('pool', sq(34, 10, 4, 3), { label: 'Piscine' }),
    Z('vegetable', sq(2, 20, 6, 4), { label: 'Potager gourmand', plantings: [{ plantId: cat('vegetable', 0), count: 4 }, { plantId: cat('vegetable', 1), count: 6 }] }),
    Z('orchard', sq(10, 22, 8, 6), { label: 'Verger' }),
    Z('tallplants', sq(2, 1, 3, 8), { label: 'Plantes hautes méditerranéennes', maintenance: 'none' }),
    Z('lowplants', sq(34, 18, 4, 3), { label: 'Plantes basses', maintenance: 'low' }),
    Z('path', { kind: 'line', points: [{ x: 3, y: 12 }, { x: 18, y: 12 }], width: 1 }, { label: 'Allée' }),
    Z('other', sq(36, 22, 3, 3), { label: 'Coin romantique', ambiance: 'romantique', plantings: [{ plantId: cat('perennial', 2), count: 3 }, { plantId: cat('perennial', 4), count: 2 }] }),
  ];
  return g;
}

/** [{ name, garden }] : tous les jardins de test déclinés. */
export function recoGardens() {
  const out = [];
  const add = (name, g, ctx = {}, extra = {}) => {
    const c = clone(g);
    c.context = { ...c.context, ...ctx };
    Object.assign(c, extra);
    out.push({ name, garden: norm(c, `g-${name}`) });
  };
  const m = mainGardens(plantSample()).main;
  add('main', m, { departement: '75', maintenance: 'low' });
  add('main-alt', m, { departement: '05', altitude: 1200, wind: 'high', soil: 'clay', maintenance: 'none' });
  const fx = makeGardens();
  add('vide', fx[0]);
  add('mixte', fx[1], { departement: '69', wind: true, soil: 'limestone' });
  add('synth', fx[2], { departement: '13', wind: 'medium', soil: 'sandy' });
  add('verger', fx[3], { departement: '31', wind: 'none', altitude: 300 });
  add('nu', fx[4]);
  add('A', gardenA(), {}, {});
  add('A-sunmap', gardenA(), { departement: '06', soil: 'humus', northAngle: 30 }, { sun: { mode: 'map', uniform: null, regions: [{ level: 'full', points: [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 9 }, { x: 0, y: 9 }] }, { level: 'shade', points: [{ x: 0, y: 4 }, { x: 5, y: 4 }, { x: 5, y: 9 }, { x: 0, y: 9 }] }] } });
  add('big', gardenBig(), {}, {});
  add('big-m', gardenBig(), { departement: '38', maintenance: 'low', wind: 'strong' }, {});
  add('extra', gardenExtra(), { departement: '34', wind: 'low' });
  add('extra-cold', gardenExtra(), { departement: '88', altitude: 800, soil: 'sandy', wind: 'medium', maintenance: 'none' });
  return out;
}
