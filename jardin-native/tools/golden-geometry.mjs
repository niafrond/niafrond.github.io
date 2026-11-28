// Golden de geometry.js : mêmes entrées fixes, sorties de référence.
import * as G from '../../jardin/geometry.js';
import { writeGolden } from './golden-lib.mjs';

const P = (x, y) => ({ x, y });
const polys = {
  square: [P(0, 0), P(4, 0), P(4, 4), P(0, 4)],
  squareCcw: [P(0, 0), P(0, 4), P(4, 4), P(4, 0)],
  triangle: [P(0, 0), P(6, 0), P(3, 5)],
  concave: [P(0, 0), P(8, 0), P(8, 8), P(5, 8), P(5, 3), P(3, 3), P(3, 8), P(0, 8)],
  bowtie: [P(0, 0), P(4, 4), P(4, 0), P(0, 4)],
  spike: [P(0, 0), P(4, 0), P(2, 0), P(2, 3)],
  line2: [P(0, 0), P(3, 4)],
  tilted: [P(1.3, 2.1), P(7.9, 0.4), P(9.2, 5.5), P(4.1, 8.8), P(0.2, 6.6)],
  empty: [],
};
const shapes = {
  poly: { kind: 'polygon', points: polys.tilted },
  circle: { kind: 'circle', center: P(3, 4), radius: 2.5 },
  line: { kind: 'line', points: [P(0, 0), P(5, 0), P(5, 4), P(8, 6)], width: 1.2 },
  line2: { kind: 'line', points: [P(1, 1), P(1, 1), P(4, 3)], width: 0.6 },
  lineShort: { kind: 'line', points: [P(1, 1)], width: 1 },
};
const out = { polys, shapes };
out.poly = Object.fromEntries(Object.entries(polys).map(([k, v]) => [k, {
  area: G.polygonArea(v), signed: G.signedArea(v.length ? v : [P(0, 0)]), perClosed: G.perimeter(v), perOpen: G.perimeter(v, false),
  centroid: G.centroid(v), bounds: G.bounds(v), simple: G.isSimplePolygon(v),
}]));
const pts = [];
for (let y = -1; y <= 9; y += 1.25) for (let x = -1; x <= 9; x += 1.25) pts.push(P(x, y));
pts.push(P(4, 2), P(0, 2), P(2, 0), P(4, 4), P(4, 3.9999999999), P(5, 5), P(2.5, 3));
out.pipPoints = pts;
out.pip = Object.fromEntries(Object.entries(polys).map(([k, v]) => [k, pts.map((p) => G.pointInPolygon(p, v))]));
const segs = [
  [P(0, 0), P(4, 4), P(0, 4), P(4, 0)], [P(0, 0), P(1, 1), P(2, 2), P(3, 3)], [P(0, 0), P(2, 2), P(1, 1), P(3, 3)],
  [P(0, 0), P(4, 0), P(4, 0), P(4, 4)], [P(0, 0), P(4, 0), P(2, 0), P(2, 5)], [P(0, 0), P(4, 0), P(0, 1), P(4, 1)], [P(0, 0), P(0, 0), P(0, 0), P(1, 1)],
];
out.segs = segs.map((s) => ({ s, r: G.segmentsIntersect(...s) }));
out.shape = Object.fromEntries(Object.entries(shapes).map(([k, s]) => [k, {
  poly24: G.shapePolygon(s), poly7: G.shapePolygon(s, 7), area: G.shapeArea(s), bounds: G.shapeBounds(s),
}]));
out.shapeNull = { poly: G.shapePolygon(null), area: G.shapeArea(null), bounds: G.shapeBounds({ kind: 'weird' }) };
const pairs = [['square', 'tilted'], ['tilted', 'concave'], ['square', 'triangle'], ['concave', 'concave'], ['triangle', 'bowtie']];
out.overlap = pairs.map(([a, b]) => ({ a, b, r: G.overlapArea(polys[a], polys[b]) }));
out.overlapBig = G.overlapArea([P(0, 0), P(400, 0), P(400, 300), P(0, 300)], [P(100, 100), P(500, 100), P(500, 400), P(100, 400)]);
const big = [P(-1, -1), P(10, -1), P(10, 10), P(-1, 10)];
const ins = [['square', 'big'], ['tilted', 'big'], ['concave', 'square'], ['square', 'concave'], ['triangle', 'concave'], ['empty', 'big'], ['square', 'empty']];
const all = { ...polys, big };
out.big = big;
out.inside = ins.map(([a, b]) => ({ a, b, r: G.polygonInside(all[a], all[b]) }));
out.snap = [
  [P(1.02, 2.03), {}], [P(1.02, 2.03), { grid: 0.5 }], [P(1.234, 5.678), { grid: 0.25 }], [P(1.234, 5.678), { grid: 0.1 }],
  [P(3.9, 3.95), { points: [P(4, 4), P(3.95, 3.9)] }], [P(3.9, 3.95), { points: [P(9, 9)], grid: 1 }],
  [P(5.1, 7), { ortho: { from: P(5, 0) } }], [P(5.1, 7), { ortho: { from: P(5, 0) }, grid: 0.5 }], [P(7, 5.1), { ortho: { from: P(0, 5) } }],
  [P(7, 5.5), { ortho: { from: P(0, 5) }, tolerance: 1 }], [P(-0.26, 0.74), { grid: 0.5 }], [P(2.5, 3.5), { grid: 1 }],
].map(([p, o]) => ({ p, o, r: G.snapPoint(p, o) }));
out.bearing = [[P(0, 0), P(0, -5)], [P(0, 0), P(5, 0)], [P(0, 0), P(0, 5)], [P(0, 0), P(-5, 0)], [P(1, 1), P(4, -3)], [P(2, 2), P(2, 2)]].map(([a, b]) => ({ a, b, d: G.distance(a, b), r: G.bearing(a, b) }));
out.fromBearing = [[P(1, 1), 5, 0], [P(1, 1), 5, 90], [P(1, 1), 3.3, 217.5], [P(0, 0), 10, 360], [P(0, 0), 2, -45]].map(([f, l, b]) => ({ f, l, b, r: G.pointFromLengthBearing(f, l, b) }));
out.closeGap = [
  [P(0, 0), P(10, 0), P(10, 8), P(0, 8.5)], [P(0, 0), P(5, 0)], [P(0, 0)], [], [P(1, 1), P(1, 1), P(1, 1)], [P(0, 0), P(4, 0), P(4, 3), P(0.2, 0.1)],
].map((pp) => ({ pts: pp, r: G.closeGapReport(pp) }));
out.translate = G.translatePolygon(polys.tilted, 1.5, -2.25);
const ll = [{ lat: 48.8566, lon: 2.3522 }, { lat: 48.85672, lon: 2.35241 }, { lat: 48.85655, lon: 2.35260 }, { lat: 48.85640, lon: 2.35210 }];
out.latlons = ll;
out.haversine = [[ll[0], ll[1]], [ll[0], ll[3]], [{ lat: 0, lon: 0 }, { lat: 0, lon: 90 }], [{ lat: 48, lon: 2 }, { lat: 48, lon: 2 }], [{ lat: 90, lon: 0 }, { lat: -90, lon: 0 }]].map(([a, b]) => ({ a, b, r: G.haversine(a, b) }));
out.gps = G.gpsToLocal(ll);
out.gpsOrigin = G.gpsToLocal(ll, { lat: 48.85, lon: 2.35 });
out.gpsEmpty = G.gpsToLocal([]);
out.toGps = out.gpsOrigin.points.map((p) => G.localToGps(p, { lat: 48.85, lon: 2.35 }));
writeGolden('geometry', out);
