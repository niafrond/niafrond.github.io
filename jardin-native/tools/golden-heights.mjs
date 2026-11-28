// Golden de heights.js.
import * as H from '../../jardin/heights.js';
import { ITEM_KINDS } from '../../jardin/items.js';
import { writeGolden, writeFixtures } from './golden-lib.mjs';

const { plants, gardens } = writeFixtures();
const out = { defaults: H.DEFAULT_HEIGHTS, limits: H.HEIGHT_LIMITS };
const kinds = [...Object.keys(H.HEIGHT_LIMITS), 'bench', 'mailbox', 'zzz', null, undefined];
out.limitsFor = kinds.map((k) => ({ k: k ?? null, r: H.heightLimits(k), msg: H.heightMessage(k) }));
out.parse = ['450', '4,5 m', '4.5m', '  120 cm ', '', 'abc', '-3', '12 m', '1,2,3', '0', ' 2 , 5 m', '3M', '1e2', null].map((t) => ({ t, r: H.parseHeight(t) }));
out.parseNum = [250, 0, -30, 12.5].map((n) => ({ n, r: H.parseHeight(n) }));
out.format = [0, 1.2, 2.405, 2.4049, 10, -0.5, NaN, 3].map((v) => ({ v: v === null ? null : v, r: H.formatHeight(v) }));
out.toCm = [0, 1.2, 2.405, 0.015, 4.5].map((v) => ({ v, r: H.heightToCm(v) }));
out.clamp = [];
for (const k of ['tree', 'shrub', 'wall', 'bench', 'zzz', 'terrace', 'pool']) for (const v of [-1, 0, 0.004, 0.5, 1.234, 3, 99, NaN]) out.clamp.push({ k, v, r: H.clampHeight(k, v), chk: H.checkHeight(k, v) });
out.heightOf = [];
for (const h of [null, 0, 1.5, -1, 0.001]) for (const d of [0, 1.2, 2.5]) out.heightOf.push({ h, d, r: H.heightOf({ height: h ?? undefined }, d), isDef: H.isDefaultHeight({ height: h ?? undefined }, d) });
out.heightOfNull = [H.heightOf(null, 2), H.heightOf(undefined, 0)];
out.apply = [];
for (const [h, k, v, d] of [[2, 'wall', 2.5, 2], [2, 'wall', 2, 2], [null, 'wall', 2.004, 2], [2.5, 'wall', 99, 2], [1, 'wall', NaN, 2], [null, 'terrace', 0, 0], [null, 'tree', 0.3, 5], [1, 'bench', 0.85, 0.85]]) {
  const e = h == null ? {} : { height: h };
  const r = H.applyHeight(e, k, v, d);
  out.apply.push({ h, k, v, d, r, entity: e });
}
out.itemDefaults = [...ITEM_KINDS.map((k) => k.id), 'zzz'].map((id) => ({ id, d: H.defaultItemHeight(id), h: H.itemHeight({ kind: id }), h2: H.itemHeight({ kind: id, height: 3.3 }) }));
out.obstacle = ['house', 'shed', 'wall', 'fence', 'tree', 'zzz'].map((k) => ({ k, d: H.defaultObstacleHeight(k), h: H.obstacleHeight({ kind: k }), h2: H.obstacleHeight({ kind: k, height: 4.4 }) }));
out.zones = [...gardens.main.zones, { id: 'a', type: 'pool', variant: 'inground' }, { id: 'b', type: 'pool', variant: 'above' }, { id: 'c', type: 'terrace', height: 0 }, { id: 'd', type: 'terrace' }, { id: 'e', type: 'lawn' }];
out.zoneFns = out.zones.map((z) => ({ h: H.zoneHeight(z), d: H.defaultZoneHeight(z), k: H.zoneHeightKind(z) }));
out.zoneNull = [H.zoneHeight(null), H.defaultZoneHeight(null), H.zoneHeightKind(null)];
out.plants = plants;
out.plantKinds = plants.map((p) => H.plantHeightKind(p));
const pls = [null, { height: 3 }, { width: 2 }, { height: 3, width: 2 }, { height: -1 }, { height: 0 }];
out.plantings = pls;
out.effective = plants.slice(0, 6).map((p) => pls.map((pl) => { const e = H.effectivePlant(p, pl); return { h: e.heightAdult, w: e.widthAdult }; }));
out.plantingHeight = plants.slice(0, 6).map((p) => pls.map((pl) => H.plantingHeight(p, pl)));
writeGolden('heights', out);
