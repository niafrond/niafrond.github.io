import { rotatePoints, rotationOf, rotateShapeTo, rotateShapeBy, rebuildRect, rotationCenter, norm360 } from '../../zone-rotate.js';
import { shapeArea, centroid } from '../../geometry.js';

const RECT = [{ x: 2, y: 2 }, { x: 6, y: 2 }, { x: 6, y: 5 }, { x: 2, y: 5 }];
const near = (a, b, d = 6) => expect(a).toBeCloseTo(b, d);

describe('zone-rotate : rotation de formes', () => {
  test('rotatePoints : 90° horaire autour d’un centre', () => {
    const [a] = rotatePoints([{ x: 1, y: 0 }], 90, { x: 0, y: 0 });
    near(a.x, 0); near(a.y, 1);
  });
  test('aller-retour : +37° puis −37° restitue les points', () => {
    const r = rotatePoints(rotatePoints(RECT, 37, centroid(RECT)), -37, centroid(RECT));
    r.forEach((p, i) => { near(p.x, RECT[i].x); near(p.y, RECT[i].y); });
  });
  test('360° = identité, entrée non modifiée', () => {
    const copy = JSON.parse(JSON.stringify(RECT));
    const r = rotatePoints(RECT, 360, { x: 0, y: 0 });
    r.forEach((p, i) => { near(p.x, RECT[i].x, 5); near(p.y, RECT[i].y, 5); });
    expect(RECT).toEqual(copy);
  });
  test('rotateShapeTo : surface et centroïde inchangés, reste un rectangle', () => {
    const s = { kind: 'polygon', points: RECT };
    const r = rotateShapeTo(s, 30);
    near(shapeArea(r), shapeArea(s), 6);
    const c0 = centroid(s.points); const c1 = centroid(r.points);
    near(c1.x, c0.x); near(c1.y, c0.y);
    const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    near(d(r.points[0], r.points[1]), 4); near(d(r.points[1], r.points[2]), 3);
    const [p0, p1, , p3] = r.points;
    near((p1.x - p0.x) * (p3.x - p0.x) + (p1.y - p0.y) * (p3.y - p0.y), 0);
    near(rotationOf(r), 30, 5);
  });
  test('rotationOf : angle du premier côté, 0–359', () => {
    expect(rotationOf({ kind: 'polygon', points: RECT })).toBe(0);
    near(rotationOf({ kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 0, y: 3 }, { x: -2, y: 3 }] }), 90);
    near(rotationOf({ kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 0, y: -3 }, { x: 2, y: -3 }] }), 270);
    near(rotationOf({ kind: 'line', points: [{ x: 0, y: 0 }, { x: -1, y: 0 }] }), 180);
    expect(rotationOf({ kind: 'circle', center: { x: 0, y: 0 }, radius: 2 })).toBe(0);
    for (const a of [0, 15, 90, 200, 359]) { const v = rotationOf(rotateShapeTo({ kind: 'polygon', points: RECT }, a)); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(360); near(v, a, 4); }
  });
  test('rotateShapeTo : angle négatif ou > 360 ramené dans 0–359', () => {
    near(rotationOf(rotateShapeTo({ kind: 'polygon', points: RECT }, -90)), 270, 4);
    near(rotationOf(rotateShapeTo({ kind: 'polygon', points: RECT }, 450)), 90, 4);
    expect(norm360(-1)).toBe(359); expect(norm360(720)).toBe(0);
  });
  test('ligne : pivote autour de son milieu, longueur conservée', () => {
    const s = { kind: 'line', points: [{ x: 0, y: 0 }, { x: 4, y: 0 }], width: 1 };
    const r = rotateShapeBy(s, 90);
    near(r.points[0].x, 2); near(r.points[0].y, -2); near(r.points[1].x, 2); near(r.points[1].y, 2);
    expect(r.width).toBe(1);
    expect(rotationCenter(s)).toEqual({ x: 2, y: 0 });
  });
  test('cercle : inchangé', () => {
    const s = { kind: 'circle', center: { x: 3, y: 3 }, radius: 2 };
    expect(rotateShapeTo(s, 45)).toEqual(s);
  });
  test('rebuildRect : dimensions, centre et angle', () => {
    const pts = rebuildRect({ x: 5, y: 5 }, 4, 2, 90);
    const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    near(d(pts[0], pts[1]), 4); near(d(pts[0], pts[3]), 2);
    const c = centroid(pts); near(c.x, 5); near(c.y, 5);
    near(rotationOf({ kind: 'polygon', points: pts }), 90, 4);
    expect(rebuildRect({ x: 5, y: 5 }, 4, 2, 0)).toEqual([{ x: 3, y: 4 }, { x: 7, y: 4 }, { x: 7, y: 6 }, { x: 3, y: 6 }]);
  });
});
