// Golden de model.js : constantes, créateurs (ids aléatoires retirés), validation, variantes de piscine.
import * as M from '../../jardin/model.js';
import { writeGolden, writeFixtures, byId } from './golden-lib.mjs';

const { plants, gardens } = writeFixtures();
const lookup = (id) => byId(plants)[id];
const strip = (o) => { const { id, ...r } = o; return r; };
const out = { gardens, plants };
out.consts = {
  zoneTypes: M.ZONE_TYPES, sunLevels: M.SUN_LEVELS, sunLabels: M.SUN_LABELS, waterNeeds: M.WATER_NEEDS, waterLabels: M.WATER_LABELS,
  categories: M.PLANT_CATEGORIES, categoryLabels: M.CATEGORY_LABELS, soils: M.SOILS, soilLabels: M.SOIL_LABELS, orientations: M.ORIENTATIONS,
  bedModes: M.BED_MODES, poolVariants: M.POOL_VARIANTS, poolAboveLabel: M.POOL_ABOVE_LABEL,
};
out.zoneType = ['pond', 'zzz', null].map((id) => ({ id, r: M.getZoneType(id) || null }));
const g = M.createGarden('Mon pré');
out.createGarden = { ...strip(g), createdAt: undefined, updatedAt: undefined };
const shape = { kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] };
out.createZone = M.ZONE_TYPES.map((t) => strip(M.createZone(t.id, shape)));
out.createZoneErr = (() => { try { M.createZone('zzz', shape); return false; } catch { return true; } })();
out.createItem = [['bench', 1, 2, 30], ['parasol'], ['table_round', 5, 5], ['light', 0, 0, 90]].map(([k, x, y, r]) => ({ args: [k, x, y, r], r: strip(M.createItem(k, x, y, r)) }));
out.createItemErr = (() => { try { M.createItem('zzz'); return false; } catch { return true; } })();
out.createOpening = [['gate', { type: 'boundary', side: 1 }, 0.25], ['door', { type: 'obstacle', obstacleId: 'o', side: 0 }], ['garage', { type: 'boundary', side: 0 }, 0.7]].map(([k, ref, t]) => ({ args: [k, ref, t], r: strip(M.createOpening(k, ref, t)) }));
out.createOpeningErr = (() => { try { M.createOpening('zzz', {}); return false; } catch { return true; } })();
out.bedMode = [g, { context: { bedMode: 'auto' } }, { context: {} }, null, {}].map((x) => M.bedModeOf(x));
const zs = [{ type: 'pool', variant: 'above' }, { type: 'pool' }, { type: 'pool', variant: 'zz' }, { type: 'lawn' }, null];
out.poolVariant = zs.map((z) => ({ z, v: M.poolVariant(z), a: M.isAbovePool(z) }));
const labels = ['Piscine', 'Piscine hors sol', 'Piscine 2', 'Piscine hors sol 3', 'Ma piscine', ''];
out.setPool = [];
for (const label of labels) for (const v of ['above', 'inground', 'zz']) out.setPool.push({ label, v, r: M.setPoolVariant({ id: 'p', type: 'pool', label, variant: 'inground' }, v) });
out.setPoolOther = M.setPoolVariant({ id: 'p', type: 'lawn', label: 'Piscine' }, 'above');
out.validate = Object.fromEntries(['main', 'empty', 'bad', 'open', 'small'].map((k) => [k, M.validateGarden(gardens[k])]));
const ex = (gardens) => ({ ...gardens, existing: [{ id: 'ee', kind: 'tree', plantId: plants[0].id, label: '', x: -5, y: -5, height: 8, width: 5, keep: true, notes: '' }] });
out.validateLabel = M.validateGarden(ex(gardens.main));
out.ensure = (() => { const o = M.ensureAmenagements(JSON.parse(JSON.stringify(gardens.old))); return { items: o.items, boundaryEdges: o.boundaryEdges, openings: o.openings, existing: o.existing.map((e) => ({ ...e })), obstacles: o.obstacles }; })();
writeGolden('model', out);
