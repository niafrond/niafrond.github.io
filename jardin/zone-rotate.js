// Rotation des formes de zones (pur, sans DOM) : points pivotés autour d'un centre, angle d'une forme, rectangle reconstruit.
// Convention : angles en degrés, sens horaire à l'écran (y vers le bas), 0° = premier côté orienté vers la droite.
import { centroid } from './geometry.js';

const RAD = Math.PI / 180;

/** Angle ramené dans [0, 360), arrondi à 1e-6 près (évite 359,9999999). */
export function norm360(deg) {
  let a = Math.round((Number(deg) || 0) * 1e6) / 1e6;
  a = ((a % 360) + 360) % 360;
  return a >= 360 ? 0 : a;
}

/** Points pivotés de `deg` degrés (sens horaire à l'écran) autour de `center`. Nouveaux points. */
export function rotatePoints(points, deg, center) {
  const c = center || centroid(points);
  const cos = Math.cos(deg * RAD); const sin = Math.sin(deg * RAD);
  return points.map((p) => {
    const dx = p.x - c.x; const dy = p.y - c.y;
    return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
  });
}

/** Centre de rotation d'une forme : centroïde d'un polygone, milieu moyen d'une ligne, centre d'un cercle. */
export function rotationCenter(shape) {
  if (!shape) return { x: 0, y: 0 };
  if (shape.kind === 'circle') return { x: shape.center.x, y: shape.center.y };
  const pts = shape.points || [];
  if (shape.kind === 'line') {
    const n = pts.length || 1;
    return { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n };
  }
  return centroid(pts);
}

/** Vrai si la forme a une orientation (tout sauf le cercle). */
export function isRotatable(shape) {
  return !!shape && shape.kind !== 'circle' && Array.isArray(shape.points) && shape.points.length >= 2;
}

/** Angle (0–359,99…) du premier côté : de points[0] vers points[1]. 0 pour un cercle. */
export function rotationOf(shape) {
  if (!isRotatable(shape)) return 0;
  const [a, b] = shape.points;
  if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-9) return 0;
  return norm360(Math.atan2(b.y - a.y, b.x - a.x) / RAD);
}

/** Nouvelle forme pivotée de `delta` degrés autour de son centre. Le cercle est rendu inchangé (copie). */
export function rotateShapeBy(shape, delta) {
  const s = JSON.parse(JSON.stringify(shape));
  if (!isRotatable(s)) return s;
  s.points = rotatePoints(s.points, delta, rotationCenter(shape));
  return s;
}

/** Nouvelle forme dont le premier côté est orienté à `deg` (pivot autour du centre). */
export function rotateShapeTo(shape, deg) {
  return rotateShapeBy(shape, norm360(deg) - rotationOf(shape));
}

/**
 * Rectangle (4 points, ordre haut-gauche, haut-droite, bas-droite, bas-gauche avant rotation) de largeur `w`
 * (côté 0→1) et longueur `l` (côté 0→3), centré sur `center`, pivoté de `deg`.
 */
export function rebuildRect(center, w, l, deg = 0) {
  const hw = w / 2; const hl = l / 2;
  const pts = [
    { x: center.x - hw, y: center.y - hl }, { x: center.x + hw, y: center.y - hl },
    { x: center.x + hw, y: center.y + hl }, { x: center.x - hw, y: center.y + hl },
  ];
  return deg ? rotatePoints(pts, deg, center) : pts;
}
