// Golden de spacing.js : couches, distances, capacité, placement déterministe, répartition, avertissements.
import * as Sp from '../../jardin/spacing.js';
import { writeGolden, writeFixtures, byId } from './golden-lib.mjs';
import { shapePolygon } from '../../jardin/geometry.js';

const { plants, gardens } = writeFixtures();
const g = gardens.main;
const lookup = (id) => byId(plants)[id];
const out = { garden: g, plants };
const cats = (c) => plants.filter((p) => p.category === c);
out.layer = plants.map((p) => ({ layer: Sp.plantLayer(p), spacing: Sp.spacingOf(p), foot: Sp.footRadius(p), margin: Sp.edgeMargin(p), fmt: Sp.formatSpacing(p), clr: Sp.clearanceFromBuilding(p), clr9: Sp.clearanceFromBuilding(p, 9) }));
out.layerNull = [Sp.plantLayer(null), Sp.spacingOf(null), Sp.footRadius(null), Sp.edgeMargin(null), Sp.formatSpacing(null)];
const sub = [...cats('tree').slice(0, 3), ...cats('shrub').slice(0, 2), ...cats('hedge').slice(0, 2), ...cats('perennial').slice(0, 2), ...cats('groundcover').slice(0, 2), ...cats('fruit').slice(0, 2), ...cats('aquatic').slice(0, 1), ...cats('vegetable').slice(0, 1)];
out.subIds = sub.map((p) => p.id);
out.minDist = sub.map((a) => sub.map((b) => Sp.minDistance(a, b)));
out.usable = g.zones.map((z) => Sp.usableArea(z));
// capacité
out.capacity = [];
const cz = g.zones.filter((z) => ['z_bed', 'z_veg', 'z_lawn', 'z_pond'].includes(z.id));
for (const z of cz) for (const p of sub.filter((_, i) => i % 2 === 0)) out.capacity.push({ z: z.id, p: p.id, r: Sp.packingCapacity(shapePolygon(z.shape, 48), p) });
const bedPoly = shapePolygon(g.zones.find((z) => z.id === 'z_bed').shape, 48);
out.capacityObs = [{ obstacles: [{ x: 10, y: 3, plant: sub[0] }], margin: undefined }, { obstacles: [{ x: 10, y: 3, r: 2 }, { x: 9.5, y: 2, plant: sub[3] }], margin: 0.1 }, { obstacles: [], margin: 0 }].map((o) => ({
  o, r: Sp.packingCapacity(bedPoly, cats('perennial')[0], o),
}));
out.capacityEdge = [Sp.packingCapacity(null, sub[0]), Sp.packingCapacity(bedPoly, null), Sp.packingCapacity([{ x: 0, y: 0 }, { x: 0.2, y: 0 }, { x: 0.2, y: 0.2 }], sub[0]), Sp.packingCapacity([{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }, { x: 0, y: 300 }], cats('groundcover')[0])];
// placement
const wallZone = { id: 'z_wall', type: 'midplants', label: 'Mur', shape: { kind: 'polygon', points: [{ x: 3, y: 0.3 }, { x: 9, y: 0.3 }, { x: 9, y: 3 }, { x: 3, y: 3 }] }, plantings: [{ plantId: cats('climber')[0].id, count: 3 }, { plantId: cats('perennial')[0].id, count: 4 }] };
const bamboo = plants.find((p) => /bamboo|bambou|Phyllostachys|Fargesia/i.test(p.latinName + p.commonName));
const bamZone = { id: 'z_bam', type: 'other', label: 'Bambou', shape: { kind: 'polygon', points: [{ x: 1, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 5 }, { x: 1, y: 5 }] }, plantings: [{ plantId: bamboo ? bamboo.id : sub[0].id, count: 6 }, { plantId: sub[5].id, count: 2 }] };
const crowd = { id: 'z_crowd', type: 'midplants', label: 'Serré', shape: { kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 2 }, { x: 0, y: 2 }] }, plantings: [{ plantId: cats('tree')[0].id, count: 3 }, { plantId: cats('shrub')[0].id, count: 12 }, { plantId: cats('perennial')[0].id, count: 40 }] };
const rowPoly = { id: 'z_rowp', type: 'hedge', label: 'Haie poly', shape: { kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 10, y: 1 }, { x: 10, y: 2 }, { x: 0, y: 1 }] }, plantings: [{ plantId: cats('hedge')[0].id, count: 10 }, { plantId: cats('hedge')[1].id, count: 6 }] };
const lawnZ = { id: 'z_lawnp', type: 'lawn', label: 'Gazon', shape: { kind: 'circle', center: { x: 5, y: 5 }, radius: 2 }, plantings: [{ plantId: cats('lawn')[0].id, count: 1 }, { plantId: cats('perennial')[1].id, count: 5 }] };
const zones = [...g.zones, wallZone, bamZone, crowd, rowPoly, lawnZ];
out.zones = zones;
out.pack = [];
for (const z of zones) {
  for (const opts of [{}, { seed: 'a', garden: g }, { seed: 7, force: true, maxima: true, garden: g }]) {
    out.pack.push({ z: z.id, opts: { seed: opts.seed, force: !!opts.force, maxima: !!opts.maxima, garden: !!opts.garden }, r: Sp.packZone(z, z.plantings, lookup, opts) });
  }
}
// fitQuantities
out.fit = [crowd, g.zones.find((z) => z.id === 'z_bed'), wallZone].map((z) => ({ z: z.id, r: Sp.fitQuantities(z, z.plantings.map((p, i) => ({ ...p, count: (p.count || 1) * (i + 2) })), lookup, { seed: 'f' }) }));
// répartition
const specs = [
  sub.slice(0, 3), [...cats('tree').slice(0, 2), ...cats('shrub').slice(0, 2), ...cats('perennial').slice(0, 3), cats('groundcover')[0]], cats('hedge').slice(0, 2),
  [...cats('lawn').slice(0, 1), ...cats('perennial').slice(0, 2)], [...cats('vegetable').slice(0, 3)], [...cats('aquatic').slice(0, 2)], cats('tree').slice(0, 1),
];
out.specs = specs.map((l) => l.map((p) => p.id));
out.alloc = [];
for (const z of zones.slice(0, 11)) specs.forEach((sp, i) => out.alloc.push({ z: z.id, s: i, r: Sp.allocateQuantities(z, sp, { seed: 's' }) }));
out.allocShares = specs.slice(1, 2).map((sp) => Sp.allocateQuantities(g.zones.find((z) => z.id === 'z_lawn'), sp, { shares: { mid: 0.5, low: 0.5, tall: 0.1 } }));
out.allocNoShape = Sp.allocateQuantities({ id: 'q', shape: null }, sub.slice(0, 2));
// avertissements
out.check = [];
for (const z of [...zones, { ...crowd, id: 'z_close', plantings: [{ plantId: cats('tree')[0].id, count: 4 }], shape: { kind: 'polygon', points: [{ x: 2.5, y: 3 }, { x: 7.5, y: 3 }, { x: 7.5, y: 5.5 }, { x: 2.5, y: 5.5 }] } }]) {
  out.check.push({ z: z.id, r: Sp.checkSpacing(g, z, lookup), layout: Sp.zoneLayout(g, z, lookup) });
}
out.checkNull = [Sp.checkSpacing(g, null, lookup), Sp.checkSpacing(g, { ...crowd, plantings: [] }, lookup)];
writeGolden('spacing', out);
