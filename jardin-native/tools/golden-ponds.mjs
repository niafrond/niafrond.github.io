// Golden de ponds.js.
import * as P from '../../jardin/ponds.js';
import POND_TAGS from '../../jardin/data/plants/pond-tags.js';
import { writeGolden, writeFixtures } from './golden-lib.mjs';

const { plants, gardens } = writeFixtures();
const tagged = plants.filter((p) => POND_TAGS[p.id]);
const extra = [
  { id: 'x-willow', commonName: 'Saule pleureur', latinName: 'Salix babylonica', category: 'tree', heightAdult: 15, widthAdult: 10 },
  { id: 'x-osier', commonName: 'Osier des vanniers', latinName: 'Zzz', category: 'shrub', heightAdult: 4, widthAdult: 3 },
  { id: 'x-peuplier', commonName: 'Peuplier', latinName: 'Populus nigra', category: 'tree', heightAdult: 25, widthAdult: 8 },
  { id: 'x-bigtree', commonName: 'Chêne', latinName: 'Quercus robur', category: 'tree', heightAdult: 25, widthAdult: 12 },
  { id: 'x-smalltree', commonName: 'Petit arbre', latinName: 'Zzz', category: 'tree', heightAdult: 5, widthAdult: 3 },
  { id: 'x-erable', commonName: 'Érable argenté', latinName: 'Acer saccharinum', category: 'tree', heightAdult: 15, widthAdult: 10 },
  { id: 'x-acc', commonName: 'Éléphant', latinName: 'Pétasite', category: 'perennial', heightAdult: 1, widthAdult: 1 },
  ...tagged.slice(0, 5).map((p) => ({ ...p, id: p.id, invasive: true })),
];
const all = [...plants, ...extra];
const out = { plants: all };
out.rule = all.map((p) => P.pondTreeRule(p));
out.tag = all.map((p) => P.pondTag(p));
out.concerned = all.map((p) => P.pondConcerned(p));
out.ids = P.pondTaggedIds();
out.nullRule = [P.pondTreeRule(null), P.pondTag(null), P.pondConcerned(undefined)];
out.depthEstimate = [0, 1.9, 2, 5.9, 6, 19.9, 20, 100].map((a) => ({ a, r: P.estimatePondDepth(a) }));
const zones = [
  { id: 'a', shape: { kind: 'circle', center: { x: 0, y: 0 }, radius: 0.6 } }, { id: 'b', shape: { kind: 'circle', center: { x: 0, y: 0 }, radius: 1.5 }, depth: 45 },
  { id: 'c', shape: { kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }] } }, { id: 'd', shape: { kind: 'circle', center: { x: 0, y: 0 }, radius: 3 }, depth: 120.4 },
  { id: 'e', shape: { kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 6 }, { x: 0, y: 6 }] }, depth: -5 }, { id: 'f', shape: { kind: 'circle', center: { x: 0, y: 0 }, radius: 5 } },
  { id: 'g' }, gardens.main.zones.find((z) => z.id === 'z_pond'),
];
out.zones = zones;
out.zoneFns = zones.map((z) => ({ area: P.pondArea(z), depth: P.pondDepth(z) }));
out.fitFor = [];
for (const p of all) for (const [a, d] of [[0.5, 30], [2, 40], [5, 60], [10, 80], [25, 100], [50, 150], [4, 10]]) out.fitFor.push(P.pondFitFor(p, a, d));
out.fit = [];
for (const p of all.filter((_, i) => i % 3 === 0)) for (const z of zones) out.fit.push({ ok: P.pondFit(p, z), cover: P.pondCoverage(p, z), qty: P.pondPlantQuantity(p, z) });
writeGolden('ponds', out);
