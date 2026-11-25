import {
  distance, polygonArea, signedArea, perimeter, centroid, bounds, pointInPolygon, segmentsIntersect,
  isSimplePolygon, shapePolygon, shapeArea, shapeBounds, overlapArea, polygonInside, snapPoint,
  pointFromLengthBearing, bearing, closeGapReport, translatePolygon, gpsToLocal, localToGps, haversine,
} from '../../geometry.js';

const carre = (x, y, s) => [{ x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }];

describe('aire et périmètre (lacet)', () => {
  test('carré 10 m', () => {
    expect(polygonArea(carre(0, 0, 10))).toBeCloseTo(100);
    expect(perimeter(carre(0, 0, 10))).toBeCloseTo(40);
    expect(perimeter(carre(0, 0, 10), false)).toBeCloseTo(30);
  });
  test('L, indépendant du sens, signedArea change de signe', () => {
    const L = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 4 }, { x: 0, y: 4 }];
    expect(polygonArea(L)).toBeCloseTo(12);
    expect(polygonArea([...L].reverse())).toBeCloseTo(12);
    expect(signedArea(L) * signedArea([...L].reverse())).toBeLessThan(0);
  });
  test('moins de 3 points', () => {
    expect(polygonArea([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(0);
  });
  test('distance, centroïde, boîte', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    const c = centroid(carre(2, 2, 4));
    expect(c.x).toBeCloseTo(4); expect(c.y).toBeCloseTo(4);
    expect(bounds(carre(1, 2, 3))).toEqual({ minX: 1, minY: 2, maxX: 4, maxY: 5, width: 3, height: 3 });
  });
});

describe('point dans polygone', () => {
  const L = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 4 }, { x: 0, y: 4 }];
  test('dedans / dehors / bord / concave', () => {
    expect(pointInPolygon({ x: 1, y: 1 }, L)).toBe(true);
    expect(pointInPolygon({ x: 3, y: 3 }, L)).toBe(false);
    expect(pointInPolygon({ x: 2, y: 3 }, L)).toBe(true); // bord
    expect(pointInPolygon({ x: 5, y: 1 }, L)).toBe(false);
    expect(pointInPolygon({ x: 1, y: 1 }, [])).toBe(false);
  });
});

describe('auto-intersection', () => {
  test('segments', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 })).toBe(true);
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 })).toBe(false);
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 0 }, { x: 3, y: 0 })).toBe(true);
  });
  test('polygone simple vs papillon', () => {
    expect(isSimplePolygon(carre(0, 0, 5))).toBe(true);
    const papillon = [{ x: 0, y: 0 }, { x: 4, y: 4 }, { x: 4, y: 0 }, { x: 0, y: 4 }];
    expect(isSimplePolygon(papillon)).toBe(false);
  });
  test('dégénérés', () => {
    expect(isSimplePolygon([{ x: 0, y: 0 }, { x: 1, y: 0 }])).toBe(false);
    expect(isSimplePolygon([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }])).toBe(false);
    // pointe repliée
    expect(isSimplePolygon([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 3 }])).toBe(false);
  });
});

describe('formes', () => {
  test('cercle', () => {
    const s = { kind: 'circle', center: { x: 5, y: 5 }, radius: 2 };
    expect(shapeArea(s)).toBeCloseTo(Math.PI * 4);
    expect(shapePolygon(s, 12)).toHaveLength(12);
    expect(polygonArea(shapePolygon(s, 96))).toBeCloseTo(Math.PI * 4, 1);
    expect(shapeBounds(s)).toMatchObject({ minX: 3, maxX: 7, width: 4 });
  });
  test('ligne épaissie', () => {
    const s = { kind: 'line', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], width: 1 };
    expect(shapeArea(s)).toBeCloseTo(10);
    const b = shapeBounds(s);
    expect(b.minY).toBeCloseTo(-0.5); expect(b.maxY).toBeCloseTo(0.5);
  });
  test('polygone', () => {
    const s = { kind: 'polygon', points: carre(0, 0, 3) };
    expect(shapeArea(s)).toBeCloseTo(9);
    expect(shapePolygon(s)).not.toBe(s.points);
  });
});

describe('recouvrement', () => {
  test('carrés décalés', () => {
    expect(overlapArea(carre(0, 0, 4), carre(2, 2, 4))).toBeCloseTo(4, 1);
  });
  test('disjoints, inclus', () => {
    expect(overlapArea(carre(0, 0, 2), carre(5, 5, 2))).toBe(0);
    expect(overlapArea(carre(0, 0, 10), carre(2, 2, 3))).toBeCloseTo(9, 1);
  });
  test('polygonInside', () => {
    expect(polygonInside(carre(1, 1, 2), carre(0, 0, 10))).toBe(true);
    expect(polygonInside(carre(8, 8, 4), carre(0, 0, 10))).toBe(false);
    const L = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 10 }, { x: 0, y: 10 }];
    expect(polygonInside(carre(1, 1, 6), L)).toBe(false); // sommets dedans mais traverse le creux ? sommet (7,7) hors
    expect(polygonInside([{ x: 0.5, y: 0.5 }, { x: 9, y: 0.5 }, { x: 9, y: 1.5 }], L)).toBe(true);
  });
});

describe('aimantation, cap, fermeture', () => {
  test('snapPoint', () => {
    expect(snapPoint({ x: 1.04, y: 2.96 }, { grid: 0.5 })).toEqual({ x: 1, y: 3 });
    expect(snapPoint({ x: 1.04, y: 2.96 }, { points: [{ x: 1, y: 3 }], tolerance: 0.1 })).toEqual({ x: 1, y: 3 });
    expect(snapPoint({ x: 5.05, y: 9 }, { ortho: { from: { x: 5, y: 0 } }, tolerance: 0.2 })).toEqual({ x: 5, y: 9 });
    expect(snapPoint({ x: 3.3, y: 1.7 })).toEqual({ x: 3.3, y: 1.7 });
  });
  test('cap et longueur', () => {
    const o = { x: 0, y: 0 };
    const n = pointFromLengthBearing(o, 5, 0);
    expect(n.x).toBeCloseTo(0); expect(n.y).toBeCloseTo(-5);
    const e = pointFromLengthBearing(o, 5, 90);
    expect(e.x).toBeCloseTo(5); expect(e.y).toBeCloseTo(0);
    expect(bearing(o, { x: 0, y: -3 })).toBeCloseTo(0);
    expect(bearing(o, { x: 3, y: 0 })).toBeCloseTo(90);
    expect(bearing(o, { x: 0, y: 3 })).toBeCloseTo(180);
    expect(bearing(o, { x: -3, y: 0 })).toBeCloseTo(270);
  });
  test('closeGapReport', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0.3, y: 10 }, { x: 0.2, y: 0.4 }];
    const r = closeGapReport(pts);
    expect(r.gap).toBeCloseTo(Math.hypot(0.2, 0.4));
    const last = r.corrected[r.corrected.length - 1];
    expect(last.x).toBeCloseTo(0); expect(last.y).toBeCloseTo(0);
    expect(r.corrected[0]).toEqual({ x: 0, y: 0 });
    expect(closeGapReport(carre(0, 0, 1).concat([{ x: 0, y: 0 }])).gap).toBe(0);
  });
  test('translatePolygon', () => {
    expect(translatePolygon(carre(0, 0, 1), 2, 3)[0]).toEqual({ x: 2, y: 3 });
  });
});

describe('GPS', () => {
  test('haversine : 1° de latitude ≈ 111,2 km', () => {
    expect(haversine({ lat: 45, lon: 3 }, { lat: 46, lon: 3 })).toBeGreaterThan(111000);
    expect(haversine({ lat: 45, lon: 3 }, { lat: 46, lon: 3 })).toBeLessThan(111400);
  });
  test('orientation : est = +x, nord = −y', () => {
    const o = { lat: 47, lon: 2 };
    const { points } = gpsToLocal([o, { lat: 47, lon: 2.001 }, { lat: 47.001, lon: 2 }]);
    expect(points[0].x).toBeCloseTo(0); expect(points[0].y).toBeCloseTo(0);
    expect(points[1].x).toBeGreaterThan(70); expect(points[1].y).toBeCloseTo(0);
    expect(points[2].y).toBeLessThan(-100);
  });
  test('aller-retour < 5 cm sur 100 m', () => {
    const origin = { lat: 48.8566, lon: 2.3522 };
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: -60, y: 80 }];
    const gps = pts.map((p) => localToGps(p, origin));
    const { points, origin: o2 } = gpsToLocal(gps, origin);
    expect(o2).toEqual(origin);
    points.forEach((p, i) => expect(distance(p, pts[i])).toBeLessThan(0.05));
  });
  test('distances locales cohérentes avec haversine à < 5 cm sur 100 m', () => {
    const a = { lat: 45.0, lon: 5.0 };
    const b = localToGps({ x: 70, y: -70 }, a);
    const { points } = gpsToLocal([a, b]);
    expect(Math.abs(distance(points[0], points[1]) - haversine(a, b))).toBeLessThan(0.05);
  });
  test('origine par défaut = premier point', () => {
    const { origin } = gpsToLocal([{ lat: 10, lon: 20 }, { lat: 10.1, lon: 20.1 }]);
    expect(origin).toEqual({ lat: 10, lon: 20 });
  });
});
