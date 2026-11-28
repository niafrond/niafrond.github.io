// Golden de zone-rotate.js.
import * as R from '../../jardin/zone-rotate.js';
import { writeGolden } from './golden-lib.mjs';

const P = (x, y) => ({ x, y });
const shapes = {
  rect: { kind: 'polygon', points: [P(0, 0), P(4, 0), P(4, 2), P(0, 2)] },
  tri: { kind: 'polygon', points: [P(1, 1), P(5, 2), P(2, 6)] },
  circle: { kind: 'circle', center: P(3, 3), radius: 2 },
  line: { kind: 'line', points: [P(0, 0), P(3, 4), P(6, 0)], width: 1 },
  degenerate: { kind: 'polygon', points: [P(1, 1), P(1, 1), P(2, 2)] },
  single: { kind: 'line', points: [P(1, 1)], width: 1 },
};
const out = { shapes };
out.norm = [0, 360, -90, 725.5, 359.9999999, 0.0000004, 1e9 + 0.25].map((d) => ({ d, r: R.norm360(d) }));
out.rotatePoints = [[0, null], [90, null], [33.3, P(1, 1)], [-45, P(0, 0)], [180, null]].map(([d, c]) => ({ d, c, r: R.rotatePoints(shapes.tri.points, d, c || undefined) }));
out.center = Object.fromEntries(Object.entries(shapes).map(([k, s]) => [k, R.rotationCenter(s)]));
out.rotatable = Object.fromEntries(Object.entries(shapes).map(([k, s]) => [k, R.isRotatable(s)]));
out.rotationOf = Object.fromEntries(Object.entries(shapes).map(([k, s]) => [k, R.rotationOf(s)]));
out.by = Object.entries(shapes).flatMap(([k, s]) => [30, -75, 400].map((d) => ({ k, d, r: R.rotateShapeBy(s, d) })));
out.to = Object.entries(shapes).flatMap(([k, s]) => [0, 45, 270.5].map((d) => ({ k, d, r: R.rotateShapeTo(s, d) })));
out.rect = [[P(5, 5), 4, 2, 0], [P(5, 5), 4, 2, 30], [P(0, 0), 1, 3, 90], [P(2, 2), 6, 6, -45]].map(([c, w, l, d]) => ({ c, w, l, d, r: R.rebuildRect(c, w, l, d) }));
out.rectDefault = R.rebuildRect(P(1, 1), 2, 2);
writeGolden('zone-rotate', out);
