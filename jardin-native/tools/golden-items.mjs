// Golden de items.js.
import * as I from '../../jardin/items.js';
import { writeGolden, writeFixtures, normOb } from './golden-lib.mjs';

const { gardens } = writeFixtures();
const g = gardens.main;
const out = { garden: g };
out.consts = {
  items: I.ITEM_KINDS, categories: I.ITEM_CATEGORIES, openings: I.OPENING_KINDS, swings: I.OPENING_SWINGS, edges: I.EDGE_KINDS, edgeIds: I.EDGE_IDS,
  materials: I.MATERIALS, edgeMaterials: I.EDGE_MATERIALS,
};
out.materialOf = [['wall', 'brick'], ['wall', 'zz'], ['wall', null], ['fence', 'mesh'], ['fence', 'brick'], ['hedge', 'wood'], ['open', null]].map(([k, m]) => ({ k, m, r: I.materialOf(k, m), d: I.defaultMaterial(k) }));
out.lookups = ['bench', 'zzz', null].map((id) => ({ id, item: !!I.getItemKind(id), opening: !!I.getOpeningKind(id), edge: !!I.getEdgeKind(id) }));
const extra = [
  { id: 'i_c', kind: 'x', x: 1, y: 1, radius: 0.7 }, { id: 'i_z', kind: 'bench', x: 0, y: 0, width: 0, depth: 0, rotation: 45 },
  { id: 'i_r', kind: 'bench', x: 3, y: 3, width: 2, depth: 1, rotation: 90 }, { id: 'i_nr', kind: 'bench', x: 3, y: 3, radius: -2, width: 1, depth: 1 },
];
const probe = [{ x: 3, y: 3 }, { x: 3.9, y: 3.2 }, { x: 1, y: 1.5 }, { x: 11, y: 11 }, { x: 0, y: 0 }];
out.itemInputs = [...g.items, ...extra];
out.itemFns = out.itemInputs.map((it) => ({
  radius: I.itemRadius(it), half: I.itemHalfSize(it), poly: I.itemPolygon(it), poly8: I.itemPolygon(it, 8), contains: probe.map((p) => I.itemContains(it, p)),
}));
out.probe = probe;
out.boundarySides = Object.fromEntries(['main', 'open', 'empty'].map((k) => [k, I.boundarySides(gardens[k])]));
out.obstacleSides = g.obstacles.map((o) => I.obstacleSides(o));
out.obstacleSidesNull = [I.obstacleSides(null), I.obstacleSides({ kind: 'wall', points: [{ x: 0, y: 0 }] })];
out.refs = [
  { type: 'boundary', side: 0 }, { type: 'boundary', side: 3 }, { type: 'boundary', side: 4 }, { type: 'boundary', side: -1 },
  { type: 'obstacle', obstacleId: 'ob_house', side: 3 }, { type: 'obstacle', obstacleId: 'ob_house', side: 4 }, { type: 'obstacle', obstacleId: 'ob_wall', side: 1 },
  { type: 'obstacle', obstacleId: 'ob_wall', side: 2 }, { type: 'obstacle', obstacleId: 'zz', side: 0 }, { type: 'existing', existingId: 'e_3', side: 0 },
  { type: 'existing', existingId: 'e_2', side: 1 }, { type: 'existing', existingId: 'e_1', side: 0 }, { type: 'weird', side: 0 },
];
out.resolve = out.refs.map((r) => I.resolveSide(g, r));
out.resolveOpen = out.refs.slice(0, 4).map((r) => I.resolveSide(gardens.open, r));
const ops = [...g.openings,
  { id: 'a', kind: 'gate', ref: { type: 'boundary', side: 1 }, t: 0.01, width: 3, swing: 'in' },
  { id: 'b', kind: 'gate', ref: { type: 'boundary', side: 1 }, t: 0.99, width: 99, swing: 'in' },
  { id: 'c', kind: 'gate', ref: { type: 'boundary', side: 2 }, t: 0.5, width: 0, swing: 'in' },
  { id: 'd', kind: 'gate', ref: { type: 'existing', existingId: 'e_3', side: 0 }, t: 0.5, width: 2, swing: 'in' }];
out.openingInputs = ops;
out.openingGeom = ops.map((o) => I.openingGeometry(g, o));
out.allowed = [['gate', 'boundary'], ['gate', 'house'], ['door', 'boundary'], ['door', 'shed'], ['wicket', 'fence'], ['zzz', 'wall'], ['garage', 'house']].map(([k, t]) => ({ k, t, r: I.openingAllowedOn(k, t) }));
const snapPts = [{ x: 5, y: -2 }, { x: 10, y: 6.9 }, { x: 5, y: 4.1 }, { x: 15.5, y: 10 }, { x: 15, y: 1.2 }, { x: 25, y: 25 }, { x: 0.2, y: 13 }];
out.snapInputs = [];
for (const p of snapPts) for (const o of [{}, { kind: 'door' }, { kind: 'gate', maxDist: 2 }, { kind: 'wicket' }, { kind: 'garage', maxDist: 0.5 }]) {
  out.snapInputs.push({ p, o, r: I.snapOpeningToSides(g, p, o) });
}
out.edges = [0, 1, 2, 3, 4, -1].map((i) => ({ i, kind: I.edgeKindOf(g, i), h: I.edgeHeightOf(g, i) }));
out.edgesNoEdges = [0, 1].map((i) => ({ i, kind: I.edgeKindOf(gardens.empty, i), h: I.edgeHeightOf(gardens.empty, i) }));
out.edgeObstacles = I.edgeObstacles(g).map(normOb);
out.itemObstacles = I.itemObstacles(g).map(normOb);
out.price = I.itemsTotalPrice(g);
out.priceEmpty = I.itemsTotalPrice(gardens.empty);
writeGolden('items', out);
