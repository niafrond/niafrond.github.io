// Golden de existing.js.
import * as E from '../../jardin/existing.js';
import { writeGolden, writeFixtures, byId, normOb } from './golden-lib.mjs';

const { plants, gardens } = writeFixtures();
const g = gardens.main;
const lookup = (id) => byId(plants)[id];
const out = { garden: g, plants };
out.consts = { kinds: E.EXISTING_KINDS, ids: E.EXISTING_KIND_IDS, fence: E.FENCE_MATERIALS, ages: E.EXISTING_AGES };
out.fenceMat = ['wood', 'metal', 'concrete', 'zz', null].map((id) => ({ id, r: E.getFenceMaterial(id).id }));
out.size = [];
for (const p of plants.slice(0, 25)) for (const age of ['young', 'adult', 'old', 0.7, 'x']) for (const kind of [null, 'tree', 'hedge']) out.size.push({ p: p.id, age, kind, r: E.sizeForPlant(p, age, kind) });
out.sizeNull = [E.sizeForPlant(null), E.sizeForPlant(null, 'old', 'tree'), E.sizeForPlant({}, 'young', 'fence')];
out.kindFor = [...new Set(plants.map((p) => p.category)), 'zzz', null].map((c) => ({ c, r: E.kindForCategory(c) }));
// création : ids aléatoires -> on les retire
const strip = (e) => { const { id, ...r } = e; return r; };
out.create = [
  ['tree', { x: 1, y: 2 }], ['hedge', { x: 3, y: 4 }], ['hedge', [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }]], ['fence', { x: 0, y: 0 }], ['fence', [{ x: 1, y: 1 }, { x: 5, y: 1 }]],
  ['perennial', { x: 2, y: 2 }], ['other', { x: 9, y: 9 }], ['climber', { x: 1, y: 1 }], ['shrub', [{ x: 1, y: 1 }, { x: 3, y: 5 }]],
].map(([k, at]) => ({ k, at, r: strip(E.createExisting(k, at)) }));
out.createErr = (() => { try { E.createExisting('zz'); return false; } catch { return true; } })();
out.setFence = ['metal', 'concrete', 'zz', 'wood'].map((m) => ({ m, r: strip(E.setFenceMaterial(E.createExisting('fence', { x: 0, y: 0 }), m)) }));
out.labels = [...g.existing, { id: 'z1', kind: 'tree', plantId: plants[0].id, label: '   ', x: 0, y: 0 }, { id: 'z2', kind: 'tree', plantId: 'nope', label: '', x: 0, y: 0 }, { id: 'z3', kind: 'zz', plantId: null, label: '', x: 0, y: 0 }].map((e) => ({ e, r: E.existingLabel(e, lookup), p: E.existingPlant(e, lookup)?.id ?? null }));
out.footprint = g.existing.map((e) => E.existingFootprint(e));
out.footprints = [E.existingFootprints(g), E.existingFootprints(g, { includeRemoved: true })];
out.shadow = [E.existingShadowObstacles(g), E.existingShadowObstacles(g, { includeRemoved: true })].map((l) => l.map(normOb));
out.summary = [g, gardens.empty, { existing: [{ kind: 'perennial', keep: false }, { kind: 'perennial' }, { kind: 'tree' }] }].map((x) => E.existingSummary(x));
out.render = E.existingForRender(g, { lookup }).map((r) => ({ ...r, plant: r.plant ? r.plant.id : null, habit: r.habit ? r.habit.id : null }));
// ensureExisting : jardin complet et ancien jardin, ids inconnus normalisés
const raw = {
  id: 'g_raw', obstacles: [{ id: 'ot', kind: 'tree', center: { x: 2, y: 3 }, radius: 1.2, height: 5 }, { id: '', kind: 'tree', center: { x: 4, y: 5 }, radius: 3 }, { id: 'ow', kind: 'wall', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }],
  existing: [
    { id: 'k1', kind: 'bogus', x: 1, y: 2 }, { id: '', kind: 'hedge', x: 3, y: 3, height: 0, width: 0 }, { id: 'k3', kind: 'tree', height: 0.01, width: -1, x: 0, y: 0, label: '', notes: '', keep: false },
    { id: 'k4', kind: 'fence', material: 'zz', x: 0, y: 0, height: 1.2, width: 0.05, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }] }, { id: 'k5', kind: 'tree', material: 'wood', x: 1, y: 1, plantId: 'x', height: 8, width: 5 },
    { id: 'ot', kind: 'tree', x: 9, y: 9, height: 8, width: 5 },
  ],
};
const known = new Set([...raw.existing.map((e) => e.id), ...raw.obstacles.map((o) => o.id), ...g.existing.map((e) => e.id), 'old_tree']);
const normIds = (garden) => ({ ...garden, existing: garden.existing.map((e) => ({ ...e, id: known.has(e.id) ? e.id : 'NEW' })) });
out.raw = raw;
out.ensure = [normIds(E.ensureExisting(JSON.parse(JSON.stringify(raw)))), normIds(E.ensureExisting(JSON.parse(JSON.stringify(g)))), normIds(E.ensureExisting(JSON.parse(JSON.stringify(gardens.old))))].map((x) => ({ existing: x.existing, obstacles: x.obstacles }));
const once = E.ensureExisting(JSON.parse(JSON.stringify(raw)));
out.idempotent = JSON.stringify(E.ensureExisting(JSON.parse(JSON.stringify(once)))) === JSON.stringify(once);
writeGolden('existing', out);
