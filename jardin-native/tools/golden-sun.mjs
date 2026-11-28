// Golden de sun.js. La date « maintenant » est figée (21 juin 2025) pour les cartes sans date explicite.
import { freezeNow, writeGolden, writeFixtures, byId, normOb } from './golden-lib.mjs';
freezeNow();
const S = await import('../../jardin/sun.js');

const { plants, gardens } = writeFixtures();
const g = gardens.main;
const lookup = (id) => byId(plants)[id];
const out = { garden: g, plants };
const dates = ['2025-06-21T12:00:00Z', '2025-03-20T07:15:30.250Z', '2025-12-21T11:00:00Z', '2024-02-29T23:59:59Z', '2000-01-01T00:00:00Z'];
const locs = [[48.85, 2.35], [0, 0], [-33.9, 151.2], [64.1, -21.9], [35.7, 139.7], [78, 15]];
out.dates = dates; out.locs = locs;
out.pos = [];
for (const [la, lo] of locs) for (const d of dates) for (const h of [0, 4, 8, 12, 16, 20]) {
  const t = new Date(new Date(d).getTime() + h * 3600000);
  out.pos.push({ la, lo, t: t.toISOString(), r: S.sunPosition(la, lo, t) });
}
out.level = [0, 2.99, 3, 5.75, 6, 12].map((h) => ({ h, r: S.levelFromHours(h) }));
const probes = [{ x: 1, y: 13 }, { x: 5, y: 8 }, { x: 10, y: 3 }, { x: 15, y: 10.5 }, { x: 19, y: 0.5 }, { x: 4, y: 9 }, { x: 12.5, y: 8.5 }];
out.probes = probes;
const obs = S.shadowObstacles(g);
out.shadow = obs.map(normOb);
out.shadowLookup = S.shadowObstacles(g, { plantLookup: lookup }).map(normOb);
out.zoneShadow = S.zoneShadowObstacles(g, { plantLookup: lookup }).map(normOb);
out.hours = [];
for (const d of [dates[0], dates[2]]) for (const na of [0, 37]) for (const p of probes) {
  out.hours.push({ d, na, p, r: S.sunHoursOnPoint(p, { lat: 48.85, lon: 2.35, northAngle: na, obstacles: obs, date: new Date(d) }), r0: S.sunHoursOnPoint(p, { lat: 48.85, lon: 2.35, northAngle: na, date: new Date(d) }) });
}
out.map = [
  S.estimateSunMap(g, { date: new Date(dates[0]), step: 1 }),
  S.estimateSunMap(g, { date: new Date(dates[2]), step: 0.75, plantLookup: lookup }),
  S.estimateSunMap(g, { step: 1 }),
  S.estimateSunMap(gardens.empty, {}),
  S.estimateSunMap(gardens.small, { step: 0.25 }),
];
out.zoneSun = {};
const variants = {
  map: g,
  uniform: { ...g, sun: { mode: 'uniform', uniform: 'partial', regions: [] } },
  uniformNone: { ...g, sun: { mode: 'uniform', uniform: null, regions: [] } },
  unknown: { ...g, sun: { mode: 'unknown', uniform: null, regions: [] } },
  noExisting: { ...g, existing: [] },
  mapNoExisting: { ...g, existing: [], sun: g.sun },
  noLoc: { ...g, context: { ...g.context, location: null } },
};
for (const [k, v] of Object.entries(variants)) out.zoneSun[k] = g.zones.map((z) => S.zoneSunLevel(v, z));
out.variants = Object.fromEntries(Object.entries(variants).map(([k, v]) => [k, { sun: v.sun, existing: v.existing.length, loc: v.context.location }]));
writeGolden('sun', out);
