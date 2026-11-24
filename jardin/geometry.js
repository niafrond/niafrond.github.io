// Géométrie pure du jardin (aucune dépendance, aucun DOM).
// Unités : mètres. Repère : x vers la droite, y vers le bas (écran).
// Cap/azimut : degrés depuis le haut du plan, sens horaire.

const EPS = 1e-9;
const RAYON_TERRE = 6371008.8; // m

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

/** Distance euclidienne entre deux points. */
export function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Aire signée (formule du lacet) : positive si le sens est horaire à l'écran (y vers le bas). */
export function signedArea(points) {
  let s = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const q = points[(i + 1) % n];
    s += p.x * q.y - q.x * p.y;
  }
  return s / 2;
}

/** Aire du polygone (≥ 0), formule du lacet. */
export function polygonArea(points) {
  if (!points || points.length < 3) return 0;
  return Math.abs(signedArea(points));
}

/** Périmètre ; `closed` = true ajoute le côté de fermeture. */
export function perimeter(points, closed = true) {
  if (!points || points.length < 2) return 0;
  let s = 0;
  for (let i = 0; i < points.length - 1; i++) s += distance(points[i], points[i + 1]);
  if (closed && points.length > 2) s += distance(points[points.length - 1], points[0]);
  return s;
}

/** Centre de gravité d'un polygone (repli sur la moyenne des sommets si aire nulle). */
export function centroid(points) {
  if (!points || !points.length) return { x: 0, y: 0 };
  const a = signedArea(points);
  if (Math.abs(a) < EPS) {
    const n = points.length;
    return {
      x: points.reduce((s, p) => s + p.x, 0) / n,
      y: points.reduce((s, p) => s + p.y, 0) / n,
    };
  }
  let cx = 0;
  let cy = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const q = points[(i + 1) % n];
    const f = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

/** Boîte englobante. */
export function bounds(points) {
  if (!points || !points.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function surSegment(p, a, b, tol = 1e-9) {
  const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < EPS) return Math.hypot(p.x - a.x, p.y - a.y) <= tol;
  if (Math.abs(cross) / len > tol) return false;
  const dot = (p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y);
  return dot >= -tol * len && dot <= len * len + tol * len;
}

/** Point dans le polygone (bord compris). Lancer de rayon. */
export function pointInPolygon(p, points) {
  const n = points.length;
  if (n < 3) return false;
  let dedans = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = points[i];
    const b = points[j];
    if (surSegment(p, a, b)) return true;
    if (a.y > p.y !== b.y > p.y) {
      const xi = ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
      if (p.x < xi) dedans = !dedans;
    }
  }
  return dedans;
}

function orient(a, b, c) {
  const v = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return Math.abs(v) < EPS ? 0 : v > 0 ? 1 : -1;
}

/** Les segments [a,b] et [c,d] se coupent ou se touchent-ils ? */
export function segmentsIntersect(a, b, c, d) {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && surSegment(c, a, b)) return true;
  if (o2 === 0 && surSegment(d, a, b)) return true;
  if (o3 === 0 && surSegment(a, c, d)) return true;
  if (o4 === 0 && surSegment(b, c, d)) return true;
  return false;
}

/** Polygone simple : ≥ 3 sommets, aire non nulle, aucune auto-intersection. */
export function isSimplePolygon(points) {
  const n = points ? points.length : 0;
  if (n < 3) return false;
  if (polygonArea(points) < EPS) return false;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    if (distance(a, b) < EPS) return false;
    for (let j = i + 1; j < n; j++) {
      const c = points[j];
      const d = points[(j + 1) % n];
      const adjacents = j === i + 1 || (i === 0 && j === n - 1);
      if (adjacents) {
        // Côtés voisins : ils ne doivent partager que le sommet commun (pas de pointe repliée).
        if (j === i + 1) {
          if (surSegment(d, a, b) || surSegment(a, c, d)) return false;
        } else if (surSegment(c, a, b) || surSegment(b, c, d)) {
          return false;
        }
        continue;
      }
      if (segmentsIntersect(a, b, c, d)) return false;
    }
  }
  return true;
}

function ligneEpaissie(points, width) {
  const h = width / 2;
  if (points.length < 2) return [];
  const normales = [];
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    let dx1 = points[i].x - prev.x;
    let dy1 = points[i].y - prev.y;
    let dx2 = next.x - points[i].x;
    let dy2 = next.y - points[i].y;
    const l1 = Math.hypot(dx1, dy1);
    const l2 = Math.hypot(dx2, dy2);
    if (l1 < EPS) { dx1 = dx2; dy1 = dy2; }
    if (l2 < EPS) { dx2 = dx1; dy2 = dy1; }
    const n1 = Math.hypot(dx1, dy1) || 1;
    const n2 = Math.hypot(dx2, dy2) || 1;
    const nx1 = -dy1 / n1;
    const ny1 = dx1 / n1;
    const nx2 = -dy2 / n2;
    const ny2 = dx2 / n2;
    let mx = nx1 + nx2;
    let my = ny1 + ny2;
    const ml = Math.hypot(mx, my);
    if (ml < 1e-6) { mx = nx1; my = ny1; } else { mx /= ml; my /= ml; }
    // Mitre : longueur = h / cos(θ/2), bornée pour éviter les pointes.
    const cos = Math.max(0.3, mx * nx1 + my * ny1);
    normales.push({ x: (mx * h) / cos, y: (my * h) / cos });
  }
  const gauche = points.map((p, i) => ({ x: p.x + normales[i].x, y: p.y + normales[i].y }));
  const droite = points.map((p, i) => ({ x: p.x - normales[i].x, y: p.y - normales[i].y }));
  return gauche.concat(droite.reverse());
}

/** Polygone d'une forme de zone (cercle échantillonné, ligne épaissie). */
export function shapePolygon(shape, segments = 24) {
  if (!shape) return [];
  if (shape.kind === 'polygon') return shape.points.map((p) => ({ x: p.x, y: p.y }));
  if (shape.kind === 'circle') {
    const pts = [];
    for (let i = 0; i < segments; i++) {
      const t = (2 * Math.PI * i) / segments;
      pts.push({ x: shape.center.x + shape.radius * Math.cos(t), y: shape.center.y + shape.radius * Math.sin(t) });
    }
    return pts;
  }
  if (shape.kind === 'line') return ligneEpaissie(shape.points, shape.width);
  return [];
}

/** Aire d'une forme (cercle exact, ligne = polygone épaissi). */
export function shapeArea(shape) {
  if (!shape) return 0;
  if (shape.kind === 'circle') return Math.PI * shape.radius * shape.radius;
  return polygonArea(shapePolygon(shape));
}

/** Boîte englobante d'une forme. */
export function shapeBounds(shape) {
  if (shape && shape.kind === 'circle') {
    const { center: c, radius: r } = shape;
    return { minX: c.x - r, minY: c.y - r, maxX: c.x + r, maxY: c.y + r, width: 2 * r, height: 2 * r };
  }
  return bounds(shapePolygon(shape));
}

/**
 * Aire de recouvrement de deux polygones, par échantillonnage (centres de cellules de 0,05 m).
 * Approximative : erreur de l'ordre du périmètre de l'intersection × résolution.
 */
export function overlapArea(polyA, polyB) {
  if (!polyA || !polyB || polyA.length < 3 || polyB.length < 3) return 0;
  const a = bounds(polyA);
  const b = bounds(polyB);
  const minX = Math.max(a.minX, b.minX);
  const maxX = Math.min(a.maxX, b.maxX);
  const minY = Math.max(a.minY, b.minY);
  const maxY = Math.min(a.maxY, b.maxY);
  if (maxX <= minX || maxY <= minY) return 0;
  let pas = 0.05;
  // Garde-fou : au plus ~1 million d'échantillons.
  const cellules = ((maxX - minX) / pas) * ((maxY - minY) / pas);
  if (cellules > 1e6) pas *= Math.sqrt(cellules / 1e6);
  let n = 0;
  for (let y = minY + pas / 2; y < maxY; y += pas) {
    for (let x = minX + pas / 2; x < maxX; x += pas) {
      const p = { x, y };
      if (pointInPolygon(p, polyA) && pointInPolygon(p, polyB)) n++;
    }
  }
  return n * pas * pas;
}

/** `inner` est-il entièrement dans `outer` (bord compris) ? */
export function polygonInside(inner, outer) {
  if (!inner || !inner.length || !outer || outer.length < 3) return false;
  for (const p of inner) if (!pointInPolygon(p, outer)) return false;
  // Aucun côté de `inner` ne doit sortir en traversant strictement un côté de `outer`.
  const n = inner.length;
  const m = outer.length;
  for (let i = 0; i < n; i++) {
    const a = inner[i];
    const b = inner[(i + 1) % n];
    for (let j = 0; j < m; j++) {
      const c = outer[j];
      const d = outer[(j + 1) % m];
      if (orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0) return false;
    }
    // Milieu du côté : détecte une sortie qui rentre sans croisement strict.
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (!pointInPolygon(mid, outer)) return false;
  }
  return true;
}

/**
 * Aimantation d'un point. Priorité : sommets existants, alignement orthogonal (ortho.from), grille.
 * Retourne un nouveau point {x, y}.
 */
export function snapPoint(p, { grid, points, tolerance = 0.15, ortho } = {}) {
  if (points && points.length) {
    let meilleur = null;
    let dMin = tolerance;
    for (const q of points) {
      const d = distance(p, q);
      if (d <= dMin) { dMin = d; meilleur = q; }
    }
    if (meilleur) return { x: meilleur.x, y: meilleur.y };
  }
  const r = { x: p.x, y: p.y };
  let fixeX = false;
  let fixeY = false;
  if (ortho && ortho.from) {
    const dx = Math.abs(p.x - ortho.from.x);
    const dy = Math.abs(p.y - ortho.from.y);
    if (dx <= tolerance && dx <= dy) { r.x = ortho.from.x; fixeX = true; }
    else if (dy <= tolerance) { r.y = ortho.from.y; fixeY = true; }
  }
  if (grid && grid > 0) {
    if (!fixeX) r.x = +(Math.round(r.x / grid) * grid).toFixed(10);
    if (!fixeY) r.y = +(Math.round(r.y / grid) * grid).toFixed(10);
  }
  return r;
}

/** Point à `length` m de `from` dans la direction `bearingDeg` (0 = haut du plan, sens horaire). */
export function pointFromLengthBearing(from, length, bearingDeg) {
  const t = rad(bearingDeg);
  return { x: from.x + length * Math.sin(t), y: from.y - length * Math.cos(t) };
}

/** Cap de a vers b en degrés [0, 360), 0 = haut du plan, sens horaire. */
export function bearing(a, b) {
  const d = deg(Math.atan2(b.x - a.x, -(b.y - a.y)));
  return (d + 360) % 360;
}

/**
 * Écart de fermeture d'un contour saisi comme ligne ouverte (dernier point ≠ premier).
 * `corrected` : mêmes points, corrigés proportionnellement à la longueur cumulée de sorte que le
 * dernier coïncide avec le premier.
 * @returns {{gap:number, dx:number, dy:number, corrected:Point[]}}
 */
export function closeGapReport(points) {
  if (!points || points.length < 2) return { gap: 0, dx: 0, dy: 0, corrected: (points || []).slice() };
  const first = points[0];
  const last = points[points.length - 1];
  const dx = first.x - last.x;
  const dy = first.y - last.y;
  const gap = Math.hypot(dx, dy);
  const total = perimeter(points, false);
  let cum = 0;
  const corrected = points.map((p, i) => {
    if (i > 0) cum += distance(points[i - 1], p);
    const f = total > EPS ? cum / total : i / (points.length - 1);
    return { x: p.x + dx * f, y: p.y + dy * f };
  });
  return { gap, dx, dy, corrected };
}

/** Translate un polygone (nouveaux points). */
export function translatePolygon(points, dx, dy) {
  return points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

/** Distance orthodromique (m) entre deux {lat, lon}. */
export function haversine(a, b) {
  const p1 = rad(a.lat);
  const p2 = rad(b.lat);
  const dLat = p2 - p1;
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
  return 2 * RAYON_TERRE * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Projection plan tangent : x = est (m), y = −nord (m), relative à `origin` (par défaut le 1er point).
 * @returns {{points:Point[], origin:{lat,lon}}}
 */
export function gpsToLocal(latlons, origin) {
  const o = origin || (latlons.length ? { lat: latlons[0].lat, lon: latlons[0].lon } : { lat: 0, lon: 0 });
  const k = Math.cos(rad(o.lat));
  const points = latlons.map((q) => ({
    x: rad(q.lon - o.lon) * RAYON_TERRE * k,
    y: -rad(q.lat - o.lat) * RAYON_TERRE,
  }));
  return { points, origin: { lat: o.lat, lon: o.lon } };
}

/** Inverse de gpsToLocal pour un point. */
export function localToGps(point, origin) {
  const k = Math.cos(rad(origin.lat));
  return {
    lat: origin.lat + deg(-point.y / RAYON_TERRE),
    lon: origin.lon + deg(point.x / (RAYON_TERRE * k)),
  };
}
