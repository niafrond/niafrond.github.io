// Utilitaires communs des scripts golden du noyau métier (modèle, géométrie, soleil, espacement…).
// Fixtures déterministes : un échantillon du catalogue réel + plusieurs jardins complets.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { allPlants } from '../../jardin/catalog.js';
import POND_TAGS from '../../jardin/data/plants/pond-tags.js';
import { createGarden, createZone, createItem, createOpening } from '../../jardin/model.js';
import { createExisting } from '../../jardin/existing.js';

const here = dirname(fileURLToPath(import.meta.url));
export const goldenDir = resolve(here, '../golden');

export function writeGolden(name, obj) {
  mkdirSync(goldenDir, { recursive: true });
  writeFileSync(resolve(goldenDir, `${name}.json`), JSON.stringify(obj, (k, v) => (typeof v === 'number' && !Number.isFinite(v) ? (Number.isNaN(v) ? '__NaN__' : v > 0 ? '__Inf__' : '__-Inf__') : v)));
  console.log(`golden ${name} ok`);
}

/** Date « maintenant » figée (évite que les cartes solaires dépendent de l'année d'exécution). */
export const FIXED_NOW = Date.UTC(2025, 5, 21, 9, 30);
export function freezeNow() {
  const Real = Date;
  globalThis.Date = class extends Real {
    constructor(...a) { if (a.length) super(...a); else super(FIXED_NOW); }
    static now() { return FIXED_NOW; }
  };
}

const PLANT_FIELDS = ['id', 'commonName', 'latinName', 'category', 'heightAdult', 'widthAdult', 'spacing', 'habit', 'foliage', 'invasive'];

/** Échantillon déterministe du catalogue : quelques essences par catégorie + essences à règles de mare + saules/peupliers. */
export function plantSample() {
  const all = allPlants();
  const pick = new Map();
  const cats = [...new Set(all.map((p) => p.category))];
  for (const c of cats) {
    const l = all.filter((p) => p.category === c);
    for (const i of [0, 1, Math.floor(l.length / 3), Math.floor(l.length / 2), l.length - 1]) if (l[i]) pick.set(l[i].id, l[i]);
  }
  for (const id of Object.keys(POND_TAGS)) { const p = all.find((x) => x.id === id); if (p) pick.set(id, p); }
  for (const p of all) if (/salix|populus|bambu|fargesia|phyllostachys|trachycarpus|thuja|cupressus|taxus/i.test(p.latinName)) pick.set(p.id, p);
  return [...pick.values()].map((p) => Object.fromEntries(PLANT_FIELDS.filter((k) => p[k] !== undefined).map((k) => [k, p[k]])));
}

const sq = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];

/** Jardins de test (JSON complet, ids figés). */
export function gardens(plants) {
  const byCat = (c, i = 0) => plants.filter((p) => p.category === c)[i].id;
  const ids = {
    tree: byCat('tree', 0), tree2: byCat('tree', 2), shrub: byCat('shrub', 1), hedge: byCat('hedge', 0), fruit: byCat('fruit', 0),
    climber: byCat('climber', 0), perennial: byCat('perennial', 1), perennial2: byCat('perennial', 3), ground: byCat('groundcover', 0),
    grass: byCat('grass', 1), bulb: byCat('bulb', 0), veg: byCat('vegetable', 0), veg2: byCat('vegetable', 3), aquatic: byCat('aquatic', 0), aquatic2: byCat('aquatic', 2),
  };
  const mk = (name, id) => { const g = createGarden(name); g.id = id; g.createdAt = '2025-01-01T00:00:00.000Z'; g.updatedAt = '2025-01-02T00:00:00.000Z'; return g; };

  // ----- jardin principal : tout y est
  const g = mk('Jardin principal', 'g_main');
  g.context = { ...g.context, location: { lat: 48.85, lon: 2.35 }, commune: 'Paris', departement: '75', region: 'Île-de-France', altitude: 35, orientation: 'S', northAngle: 20, soil: 'loam', slope: 'flat', wind: 'medium', roofArea: 80, bedMode: 'manual' };
  g.boundary = sq(0, 0, 20, 14); g.boundaryClosed = true;
  g.boundaryEdges = [{ kind: 'wall', material: 'brick' }, { kind: 'fence', height: 1.5, material: 'metal' }, { kind: 'hedge' }, { kind: 'open' }];
  g.obstacles = [
    { id: 'ob_house', kind: 'house', points: sq(2, 2, 6, 4), height: 6 },
    { id: 'ob_shed', kind: 'shed', points: sq(14, 9, 3, 2.5), height: 2.5 },
    { id: 'ob_wall', kind: 'wall', points: [{ x: 10, y: 7 }, { x: 14, y: 7 }, { x: 14, y: 10 }], height: 2 },
    { id: 'ob_tree', kind: 'tree', center: { x: 16, y: 3 }, radius: 2, height: 8 },
  ];
  g.items = [
    Object.assign(createItem('bench', 5, 9, 15), { id: 'i_bench' }),
    Object.assign(createItem('parasol', 11, 11, 0), { id: 'i_parasol' }),
    Object.assign(createItem('pergola', 9, 3.5, 30), { id: 'i_pergola' }),
    Object.assign(createItem('table_round', 18, 12, 0), { id: 'i_table', height: 0.9 }),
    Object.assign(createItem('shed_item', 19.6, 13.8, 0), { id: 'i_out' }),
  ];
  g.openings = [
    Object.assign(createOpening('gate', { type: 'boundary', side: 0 }, 0.3), { id: 'op_gate' }),
    Object.assign(createOpening('door', { type: 'obstacle', obstacleId: 'ob_house', side: 1 }, 0.5), { id: 'op_door' }),
    Object.assign(createOpening('wicket', { type: 'boundary', side: 3 }, 0.9), { id: 'op_wicket' }),
    Object.assign(createOpening('garage', { type: 'obstacle', obstacleId: 'ob_nope', side: 0 }, 0.5), { id: 'op_lost' }),
  ];
  const ex1 = createExisting('tree', { x: 3, y: 10 }); ex1.id = 'e_1'; ex1.plantId = ids.tree; ex1.height = 9; ex1.width = 6;
  const ex2 = createExisting('hedge', [{ x: 0.5, y: 13 }, { x: 8, y: 13 }, { x: 8, y: 12.5 }]); ex2.id = 'e_2'; ex2.label = '';
  const ex3 = createExisting('fence', [{ x: 12, y: 1 }, { x: 19, y: 1 }]); ex3.id = 'e_3'; ex3.material = 'metal'; ex3.height = 1.5; ex3.width = 0.03;
  const ex4 = createExisting('perennial', { x: 12.5, y: 5 }); ex4.id = 'e_4'; ex4.keep = false;
  const ex5 = createExisting('shrub', { x: 21, y: 5 }); ex5.id = 'e_5'; ex5.plantId = ids.shrub; ex5.label = 'Hors terrain';
  g.existing = [ex1, ex2, ex3, ex4, ex5];
  g.sun = { mode: 'map', uniform: null, regions: [{ level: 'full', points: sq(0, 0, 20, 14) }, { level: 'shade', points: sq(2, 7, 6, 7) }, { level: 'partial', points: sq(12, 0, 8, 5) }] };
  g.wishedZoneTypes = ['lawn', 'vegetable', 'terrace', 'orchard', 'lowplants'];
  const Z = (id, type, shape, extra = {}) => Object.assign(createZone(type, shape), { id }, extra);
  g.zones = [
    Z('z_lawn', 'lawn', { kind: 'polygon', points: [{ x: 9, y: 8 }, { x: 14, y: 6.5 }, { x: 19, y: 9 }, { x: 15, y: 13 }, { x: 9, y: 12 }] }),
    Z('z_pond', 'pond', { kind: 'circle', center: { x: 4, y: 7.5 }, radius: 1.6 }, { depth: 70, plantings: [{ plantId: ids.aquatic, count: 1 }, { plantId: ids.aquatic2, count: 2 }] }),
    Z('z_pool', 'pool', { kind: 'polygon', points: sq(11, 1, 5, 3) }, { variant: 'above', height: 1.4 }),
    Z('z_terrace', 'terrace', { kind: 'polygon', points: sq(2, 6.5, 5, 0.9) }, { height: 0.4 }),
    Z('z_hedge', 'hedge', { kind: 'line', points: [{ x: 0.7, y: 1 }, { x: 0.7, y: 12 }], width: 1 }, { plantings: [{ plantId: ids.hedge, count: 8 }] }),
    Z('z_trees', 'trees', { kind: 'circle', center: { x: 18, y: 6 }, radius: 1.5 }, { plantings: [{ plantId: ids.tree2, count: 1, height: 7 }] }),
    Z('z_veg', 'vegetable', { kind: 'polygon', points: sq(2, 8, 5, 4) }, { plantings: [{ plantId: ids.veg, count: 6 }, { plantId: ids.veg2, count: 8 }] }),
    Z('z_bed', 'midplants', { kind: 'polygon', points: [{ x: 9, y: 1 }, { x: 11, y: 1 }, { x: 11.5, y: 5 }, { x: 8.5, y: 5 }] }, { plantings: [{ plantId: ids.perennial, count: 5 }, { plantId: ids.perennial2, count: 4 }, { plantId: ids.ground, count: 8 }, { plantId: ids.shrub, count: 2 }] }),
    Z('z_orchard', 'orchard', { kind: 'polygon', points: sq(13.5, 11, 4.5, 2.5) }, { plantings: [{ plantId: ids.fruit, count: 2 }, { plantId: ids.climber, count: 3 }, { plantId: ids.tree, count: 1 }] }),
    Z('z_out', 'other', { kind: 'polygon', points: sq(18, 11, 4, 4) }),
  ];

  // ----- jardin vide / invalide
  const vide = mk('Vide', 'g_empty');
  const bad = mk('Invalide', 'g_bad');
  bad.boundary = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 0 }, { x: 0, y: 10 }]; bad.boundaryClosed = true;
  bad.zones = [Z('z_unknown', 'lawn', { kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }), Object.assign(createZone('lawn', { kind: 'circle', center: { x: 1, y: 1 }, radius: 1 }), { id: 'z_ok', type: 'bogus' })];
  const open = mk('Ouvert', 'g_open');
  open.boundary = sq(0, 0, 5, 5); open.boundaryClosed = false;
  const small = mk('Petit', 'g_small');
  small.boundary = sq(0, 0, 1, 0.9); small.boundaryClosed = true;
  small.context.bedMode = 'auto'; small.wishedZoneTypes = ['midplants', 'lawn'];
  // ----- jardin à l'ancienne (champs absents) pour ensureAmenagements
  const old = { id: 'g_old', name: 'Ancien', boundary: sq(0, 0, 10, 10), boundaryClosed: true, obstacles: [{ id: 'old_tree', kind: 'tree', center: { x: 5, y: 5 }, radius: 1.5, height: 6 }, { id: 'old_wall', kind: 'wall', points: [{ x: 0, y: 0 }, { x: 3, y: 0 }] }], zones: [] };
  return { main: g, empty: vide, bad, open, small, old, ids };
}

export function writeFixtures() {
  const plants = plantSample();
  const g = gardens(plants);
  writeGolden('fixtures', { plants, gardens: g });
  return { plants, gardens: g };
}

/** Obstacle d'ombre normalisé (mêmes champs que le côté Kotlin). */
export function normOb(o) {
  const r = { id: o.id, kind: o.kind, height: Number(o.height) || 0 };
  for (const k of ['points', 'center', 'radius', 'thickness', 'opacity', 'itemKind', 'edge']) if (o[k] !== undefined) r[k] = o[k];
  if (o.existing) r.existing = true;
  if (o.zone) r.zone = true;
  return r;
}
export const byId = (plants) => Object.fromEntries(plants.map((p) => [p.id, p]));
