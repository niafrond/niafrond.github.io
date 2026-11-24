// Ensoleillement : trajectoire du soleil, ombres des obstacles, cartes estimées (pur, sans DOM).
// Repère du plan : x vers la droite, y vers le bas ; `northAngle` = rotation du nord (degrés, sens horaire).
import { bounds, pointInPolygon, shapePolygon } from './geometry.js';

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

/**
 * Position du soleil (algorithme astronomique type NOAA, précision ~0,1°).
 * @returns {{azimuth:number, elevation:number}} azimut depuis le nord (sens horaire), élévation (°)
 */
export function sunPosition(lat, lon, date) {
  const d = date instanceof Date ? date : new Date(date);
  const jd = d.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const Mr = rad(M);
  const C = Math.sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T))
    + Math.sin(2 * Mr) * (0.019993 - 0.000101 * T) + Math.sin(3 * Mr) * 0.000289;
  const vraie = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const apparente = vraie - 0.00569 - 0.00478 * Math.sin(rad(omega));
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(rad(omega));
  const decl = Math.asin(Math.sin(rad(eps)) * Math.sin(rad(apparente)));
  const y = Math.tan(rad(eps) / 2) ** 2;
  const L0r = rad(L0);
  // Équation du temps (minutes).
  const eqt = 4 * deg(y * Math.sin(2 * L0r) - 2 * e * Math.sin(Mr) + 4 * e * y * Math.sin(Mr) * Math.cos(2 * L0r)
    - 0.5 * y * y * Math.sin(4 * L0r) - 1.25 * e * e * Math.sin(2 * Mr));
  const minutesUTC = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60 + d.getUTCMilliseconds() / 60000;
  const tst = minutesUTC + eqt + 4 * lon; // temps solaire vrai (min)
  const H = rad(tst / 4 - 180);
  const phi = rad(lat);
  const sinEl = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(H);
  const elevation = deg(Math.asin(Math.max(-1, Math.min(1, sinEl))));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(decl) * Math.cos(phi));
  return { azimuth: (deg(az) + 180 + 360) % 360, elevation };
}

/** Niveau d'ensoleillement selon les heures de soleil direct. */
export function levelFromHours(h) {
  if (h >= 6) return 'full';
  if (h >= 3) return 'partial';
  return 'shade';
}

const PAS_MIN = 15;

/** Échantillons du soleil au-dessus de l'horizon pour la journée (UTC) de `date`, directions dans le plan. */
function echantillonsSoleil(lat, lon, northAngle, date) {
  const d = date instanceof Date ? date : new Date(date);
  // Fenêtre de 24 h centrée sur le midi solaire approximatif.
  const midi = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12) - (lon / 15) * 3600000;
  const debut = midi - 12 * 3600000;
  const res = [];
  for (let t = debut; t < debut + 24 * 3600000; t += PAS_MIN * 60000) {
    const s = sunPosition(lat, lon, new Date(t));
    if (s.elevation <= 0) continue;
    const a = rad(s.azimuth + (northAngle || 0));
    res.push({ ux: Math.sin(a), uy: -Math.cos(a), tanEl: Math.tan(rad(s.elevation)) });
  }
  return res;
}

/** Distance (le long du rayon P + t·u) jusqu'à l'obstacle, ou Infinity. */
function distanceObstacle(p, u, ob) {
  if (ob.kind === 'tree' || (ob.center && ob.radius != null && !ob.points)) {
    const c = ob.center;
    const fx = p.x - c.x;
    const fy = p.y - c.y;
    const b = fx * u.ux + fy * u.uy;
    const cc = fx * fx + fy * fy - ob.radius * ob.radius;
    const disc = b * b - cc;
    if (disc < 0) return Infinity;
    const r = Math.sqrt(disc);
    const t1 = -b - r;
    const t2 = -b + r;
    if (t2 < 0) return Infinity;
    return Math.max(0, t1);
  }
  const pts = ob.points;
  if (!pts || pts.length < 2) return Infinity;
  const n = pts.length === 2 ? 1 : pts.length;
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const den = u.ux * ey - u.uy * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = ((a.x - p.x) * ey - (a.y - p.y) * ex) / den;
    const s = ((a.x - p.x) * u.uy - (a.y - p.y) * u.ux) / den;
    if (t > 1e-9 && s >= -1e-9 && s <= 1 + 1e-9 && t < best) best = t;
  }
  return best;
}

function heuresAvecEchantillons(point, samples, obstacles) {
  let n = 0;
  for (const u of samples) {
    let masque = false;
    for (const ob of obstacles) {
      const h = ob.height || 0;
      if (h <= 0) continue;
      const t = distanceObstacle(point, u, ob);
      if (t !== Infinity && t * u.tanEl <= h) { masque = true; break; }
    }
    if (!masque) n++;
  }
  return (n * PAS_MIN) / 60;
}

/**
 * Heures de soleil direct reçues par un point sur la journée de `date`, en tenant compte de l'ombre
 * des obstacles (maison, mur, abri, clôture, arbre).
 */
export function sunHoursOnPoint(point, { lat, lon, northAngle = 0, obstacles = [], date = new Date() } = {}) {
  return heuresAvecEchantillons(point, echantillonsSoleil(lat, lon, northAngle, date), obstacles);
}

/**
 * Carte d'ensoleillement estimée : régions rectangulaires (grille 0,5 m) fusionnées par niveau.
 * Date par défaut : solstice d'été (cas le plus favorable) de l'année courante.
 * @returns {{level:string, points:Point[]}[]}
 */
export function estimateSunMap(garden, { date, step = 0.5 } = {}) {
  const loc = garden.context && garden.context.location;
  const contour = garden.boundary || [];
  if (!loc || contour.length < 3) return [];
  const d = date || new Date(Date.UTC(new Date().getUTCFullYear(), 5, 21, 12));
  const samples = echantillonsSoleil(loc.lat, loc.lon, garden.context.northAngle || 0, d);
  const obstacles = garden.obstacles || [];
  const b = bounds(contour);
  const nx = Math.ceil(b.width / step);
  const ny = Math.ceil(b.height / step);
  const grille = [];
  for (let j = 0; j < ny; j++) {
    const ligne = [];
    for (let i = 0; i < nx; i++) {
      const p = { x: b.minX + (i + 0.5) * step, y: b.minY + (j + 0.5) * step };
      ligne.push(pointInPolygon(p, contour) ? levelFromHours(heuresAvecEchantillons(p, samples, obstacles)) : null);
    }
    grille.push(ligne);
  }
  // Fusion horizontale en segments, puis verticale quand les segments sont identiques.
  const regions = [];
  let ouverts = new Map(); // clé "level|i0|i1" -> région en cours
  for (let j = 0; j <= ny; j++) {
    const courants = new Map();
    if (j < ny) {
      let i = 0;
      while (i < nx) {
        const lv = grille[j][i];
        if (!lv) { i++; continue; }
        let k = i;
        while (k + 1 < nx && grille[j][k + 1] === lv) k++;
        const cle = `${lv}|${i}|${k}`;
        const r = ouverts.get(cle);
        if (r) { r.j1 = j + 1; courants.set(cle, r); ouverts.delete(cle); }
        else courants.set(cle, { level: lv, i0: i, i1: k, j0: j, j1: j + 1 });
        i = k + 1;
      }
    }
    for (const r of ouverts.values()) regions.push(r);
    ouverts = courants;
  }
  return regions.map((r) => {
    const x0 = b.minX + r.i0 * step;
    const x1 = b.minX + (r.i1 + 1) * step;
    const y0 = b.minY + r.j0 * step;
    const y1 = b.minY + r.j1 * step;
    return { level: r.level, points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] };
  });
}

/**
 * Niveau d'ensoleillement d'une zone selon `garden.sun` (mode uniforme ou cartographié).
 * `share` : part de la surface connue par niveau (somme = 1, ou 0 partout si inconnu).
 * @returns {{level:string|null, dominant:string|null, share:{full:number, partial:number, shade:number}}}
 */
export function zoneSunLevel(garden, zone) {
  const vide = { level: null, dominant: null, share: { full: 0, partial: 0, shade: 0 } };
  const sun = garden.sun;
  if (!sun || sun.mode === 'unknown') return vide;
  if (sun.mode === 'uniform') {
    if (!sun.uniform) return vide;
    const share = { full: 0, partial: 0, shade: 0 };
    share[sun.uniform] = 1;
    return { level: sun.uniform, dominant: sun.uniform, share };
  }
  if (sun.mode !== 'map' || !sun.regions || !sun.regions.length) return vide;
  const poly = shapePolygon(zone.shape);
  if (poly.length < 3) return vide;
  const b = bounds(poly);
  const pas = Math.max(0.1, Math.min(0.25, Math.max(b.width, b.height) / 60));
  const cpt = { full: 0, partial: 0, shade: 0 };
  let total = 0;
  for (let y = b.minY + pas / 2; y < b.maxY; y += pas) {
    for (let x = b.minX + pas / 2; x < b.maxX; x += pas) {
      const p = { x, y };
      if (!pointInPolygon(p, poly)) continue;
      // La dernière région peinte l'emporte.
      let lv = null;
      for (let i = sun.regions.length - 1; i >= 0; i--) {
        if (pointInPolygon(p, sun.regions[i].points)) { lv = sun.regions[i].level; break; }
      }
      if (lv && cpt[lv] !== undefined) { cpt[lv]++; total++; }
    }
  }
  if (!total) return vide;
  const share = { full: cpt.full / total, partial: cpt.partial / total, shade: cpt.shade / total };
  let dominant = 'full';
  for (const k of ['partial', 'shade']) if (share[k] > share[dominant]) dominant = k;
  return { level: dominant, dominant, share };
}
