// Massifs automatiques (moteur pur, déterministe, sans DOM) : espace libre, propositions de massifs,
// combinaison de plantes, conversion en zones. Voir jardin/SPECS.md « Massifs automatiques (moteur) ».
// Repère : mètres, x vers la droite, y vers le bas.
import { allPlants } from './catalog.js';
import { bounds, centroid, pointInPolygon, polygonArea, shapePolygon, bearing } from './geometry.js';
import { boundarySides, obstacleSides, edgeKindOf, itemPolygon, itemRadius, openingGeometry } from './items.js';
import { estimateSunMap } from './sun.js';
import { createZone } from './model.js';
import { climateForDepartement, adjustTminForAltitude } from './climate.js';
import { scorePlant } from './recommend.js';
import { getAmbiance, plantAmbianceScore, plantAvoids } from './ambiances.js';
import { fitsMaintenance, plantEffort } from './maintenance.js';
import { habitOf } from './habits.js';

// Empreintes des plantes existantes : import défensif (le module peut être absent).
let existingFootprints = null;
try {
  const m = await import('./existing.js');
  if (m && typeof m.existingFootprints === 'function') existingFootprints = m.existingFootprints;
} catch (e) {
  existingFootprints = null;
}

export const FLOWER_ZONE_TYPES = ['lowplants', 'midplants', 'tallplants'];
/** Zone « massif » (plantes basses, moyennes ou hautes) ? */
export const isFlowerZone = (zone) => !!zone && FLOWER_ZONE_TYPES.includes(zone.type);

// ---------------------------------------------------------------- utilitaires
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const r1 = (n) => Math.round(n * 10) / 10;
const r3 = (n) => Math.round(n * 1000) / 1000;
const fr = (n) => String(r1(n)).replace('.', ',');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function rngFrom(seed) {
  let a = (Number(seed) || 1) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function segDist(p, a, b) {
  const dx = b.x - a.x; const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
function edgeDist(p, poly, closed = true) {
  let best = Infinity;
  const n = poly.length;
  const cnt = closed ? n : n - 1;
  for (let i = 0; i < cnt; i++) best = Math.min(best, segDist(p, poly[i], poly[(i + 1) % n]));
  return best;
}
/** Distance d'un point à un polygone (0 dedans). */
function polyDist(p, poly) {
  if (poly.length >= 3 && pointInPolygon(p, poly)) return 0;
  return edgeDist(p, poly);
}
function polysDistance(A, B) {
  let best = Infinity;
  for (const p of A) best = Math.min(best, polyDist(p, B));
  for (const p of B) best = Math.min(best, polyDist(p, A));
  return best;
}

/** Recouvrement strict de deux polygones convexes (SAT) ; `eps` = pénétration tolérée (m). */
function convexOverlap(A, B, eps = 1e-3) {
  for (const P of [A, B]) {
    for (let i = 0; i < P.length; i++) {
      const a = P[i]; const b = P[(i + 1) % P.length];
      let nx = -(b.y - a.y); let ny = b.x - a.x;
      const l = Math.hypot(nx, ny) || 1;
      nx /= l; ny /= l;
      let minA = Infinity; let maxA = -Infinity; let minB = Infinity; let maxB = -Infinity;
      for (const p of A) { const d = p.x * nx + p.y * ny; if (d < minA) minA = d; if (d > maxA) maxA = d; }
      for (const p of B) { const d = p.x * nx + p.y * ny; if (d < minB) minB = d; if (d > maxB) maxB = d; }
      if (maxA <= minB + eps || maxB <= minA + eps) return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------- espace libre
const DEFAULT_CLEARANCES = {
  pool: 1, pond: 0.5, opening: 0.9, existing: 0.3, obstacle: 0, terrace: 0, path: 0, other: 0, bed: 0,
};

function polyBlocker(poly, d) {
  const bb = bounds(poly);
  const box = { minX: bb.minX - d, minY: bb.minY - d, maxX: bb.maxX + d, maxY: bb.maxY + d };
  return {
    box,
    test: (x, y) => {
      if (x < box.minX || x > box.maxX || y < box.minY || y > box.maxY) return false;
      const p = { x, y };
      if (pointInPolygon(p, poly)) return true;
      return d > 0 && edgeDist(p, poly) <= d;
    },
  };
}
function circleBlocker(c, r, d) {
  const R = r + d;
  return {
    box: { minX: c.x - R, minY: c.y - R, maxX: c.x + R, maxY: c.y + R },
    test: (x, y) => Math.hypot(x - c.x, y - c.y) <= R,
  };
}
function lineBlocker(points, half) {
  const bb = bounds(points);
  const box = { minX: bb.minX - half, minY: bb.minY - half, maxX: bb.maxX + half, maxY: bb.maxY + half };
  return {
    box,
    test: (x, y) => {
      if (x < box.minX || x > box.maxX || y < box.minY || y > box.maxY) return false;
      return edgeDist({ x, y }, points, false) <= half;
    },
  };
}

/** Empreintes des plantes existantes (module existing.js, sinon lecture directe de `garden.existing`). */
function existingPolys(garden) {
  const out = [];
  if (existingFootprints) {
    try {
      for (const f of existingFootprints(garden) || []) {
        if (f && f.keep === false) continue;
        const poly = f.polygon || f.points;
        if (poly && poly.length >= 3) out.push(poly);
      }
      return out;
    } catch (e) { /* repli */ }
  }
  for (const e of (garden && garden.existing) || []) {
    if (e.keep === false) continue;
    const w = Number(e.width) > 0 ? Number(e.width) : 1;
    if (Array.isArray(e.points) && e.points.length >= 2) {
      const bb = lineBlocker(e.points, w / 2);
      out.push({ line: e.points, half: w / 2, box: bb.box });
    } else {
      const pts = [];
      for (let i = 0; i < 16; i++) { const t = (2 * Math.PI * i) / 16; pts.push({ x: e.x + (w / 2) * Math.cos(t), y: e.y + (w / 2) * Math.sin(t) }); }
      out.push(pts);
    }
  }
  return out;
}

/**
 * Grille d'occupation du terrain. Une cellule est libre si son centre est dans le contour et hors de tout ce
 * qui est occupé : zones non-massif (piscine +1 m, mare +0,5 m, terrasse, allée, potager, haie, arbres…
 * pelouse seulement si `allowLawn` la libère), massifs déjà dessinés, mobilier (+`margin`), obstacles (maison,
 * abri, murs, arbres + `margin`), houppiers, plantes existantes (+0,3 m), dégagement des ouvertures (0,9 m).
 * @returns {{cell, minX, minY, nx, ny, grid:Uint8Array, freeArea:number, isFree(x,y):boolean, components():object[], distanceMap():Float32Array}}
 */
export function freeSpace(garden, { cell = 0.25, margin = 0.3, clearances, allowLawn = false, ignoreIds = [] } = {}) {
  const cl = { ...DEFAULT_CLEARANCES, furniture: margin, tree: margin, ...(clearances || {}) };
  const contour = (garden && garden.boundary) || [];
  const ignore = new Set(ignoreIds);
  const blockers = [];
  const add = (b) => { if (b) blockers.push(b); };

  for (const z of (garden && garden.zones) || []) {
    if (ignore.has(z.id) || !z.shape) continue;
    if (z.type === 'lawn' && allowLawn) continue;
    const d = Number(cl[z.type]) || 0;
    const sh = z.shape;
    if (sh.kind === 'circle') add(circleBlocker(sh.center, sh.radius, d + (z.type === 'trees' ? cl.tree : 0)));
    else if (sh.kind === 'line') add(lineBlocker(sh.points, (sh.width || 1) / 2 + d));
    else {
      const poly = shapePolygon(sh);
      if (poly.length >= 3) add(polyBlocker(poly, d + (z.type === 'trees' ? cl.tree : 0)));
    }
  }
  for (const it of (garden && garden.items) || []) {
    const r = itemRadius(it);
    if (r != null) add(circleBlocker({ x: it.x, y: it.y }, r, cl.furniture));
    else add(polyBlocker(itemPolygon(it), cl.furniture));
  }
  for (const ob of (garden && garden.obstacles) || []) {
    if (ob.center && ob.radius != null && !ob.points) { add(circleBlocker(ob.center, ob.radius, cl.tree)); continue; }
    const pts = ob.points || [];
    if (pts.length >= 3 && (ob.kind === 'house' || ob.kind === 'shed')) add(polyBlocker(pts, cl.obstacle));
    else if (pts.length >= 2) add(lineBlocker(pts, (ob.thickness || (ob.kind === 'wall' ? 0.2 : 0.05)) / 2 + cl.obstacle));
  }
  for (const poly of existingPolys(garden)) {
    if (poly.line) add({ box: poly.box, test: (x, y) => edgeDist({ x, y }, poly.line, false) <= poly.half + cl.existing });
    else add(polyBlocker(poly, cl.existing));
  }
  for (const op of (garden && garden.openings) || []) {
    let g = null;
    try { g = openingGeometry(garden, op); } catch (e) { g = null; }
    if (!g) continue;
    const hw = g.width / 2 + 0.3;
    const { u, normal: n, center: c } = g;
    const dd = cl.opening;
    add(polyBlocker([
      { x: c.x - u.x * hw - n.x * dd, y: c.y - u.y * hw - n.y * dd },
      { x: c.x + u.x * hw - n.x * dd, y: c.y + u.y * hw - n.y * dd },
      { x: c.x + u.x * hw + n.x * dd, y: c.y + u.y * hw + n.y * dd },
      { x: c.x - u.x * hw + n.x * dd, y: c.y - u.y * hw + n.y * dd },
    ], 0));
  }

  const inContour = (x, y) => contour.length >= 3 && pointInPolygon({ x, y }, contour);
  const isFree = (x, y) => {
    if (!inContour(x, y)) return false;
    for (const b of blockers) {
      if (x < b.box.minX || x > b.box.maxX || y < b.box.minY || y > b.box.maxY) continue;
      if (b.test(x, y)) return false;
    }
    return true;
  };

  const bb = bounds(contour);
  const nx = contour.length >= 3 ? Math.max(1, Math.ceil(bb.width / cell)) : 0;
  const ny = contour.length >= 3 ? Math.max(1, Math.ceil(bb.height / cell)) : 0;
  const grid = new Uint8Array(nx * ny);
  let nFree = 0;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (isFree(bb.minX + (i + 0.5) * cell, bb.minY + (j + 0.5) * cell)) { grid[j * nx + i] = 1; nFree++; }
    }
  }
  const fs = {
    cell, minX: bb.minX, minY: bb.minY, nx, ny, grid,
    freeArea: nFree * cell * cell,
    isFree,
    cellCenter: (i, j) => ({ x: bb.minX + (i + 0.5) * cell, y: bb.minY + (j + 0.5) * cell }),
    /** Zones libres connexes (4-voisinage), triées par surface décroissante. */
    components() {
      const seen = new Uint8Array(grid.length);
      const out = [];
      for (let s = 0; s < grid.length; s++) {
        if (!grid[s] || seen[s]) continue;
        const stack = [s]; seen[s] = 1;
        const cells = [];
        while (stack.length) {
          const c = stack.pop(); cells.push(c);
          const ci = c % nx; const cj = (c - ci) / nx;
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const ii = ci + di; const jj = cj + dj;
            if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
            const k = jj * nx + ii;
            if (grid[k] && !seen[k]) { seen[k] = 1; stack.push(k); }
          }
        }
        let sx = 0; let sy = 0; let minI = Infinity; let maxI = -Infinity; let minJ = Infinity; let maxJ = -Infinity;
        for (const c of cells) {
          const ci = c % nx; const cj = (c - ci) / nx;
          sx += ci; sy += cj;
          minI = Math.min(minI, ci); maxI = Math.max(maxI, ci); minJ = Math.min(minJ, cj); maxJ = Math.max(maxJ, cj);
        }
        out.push({
          cells, areaM2: cells.length * cell * cell,
          centroid: { x: bb.minX + (sx / cells.length + 0.5) * cell, y: bb.minY + (sy / cells.length + 0.5) * cell },
          bounds: { minX: bb.minX + minI * cell, minY: bb.minY + minJ * cell, maxX: bb.minX + (maxI + 1) * cell, maxY: bb.minY + (maxJ + 1) * cell },
        });
      }
      return out.sort((a, b) => b.areaM2 - a.areaM2);
    },
    /** Distance (m) de chaque cellule libre à la cellule non libre la plus proche (chanfrein 3-4). */
    distanceMap() {
      const INF = 1e9;
      const d = new Float32Array(grid.length);
      for (let k = 0; k < grid.length; k++) d[k] = grid[k] ? INF : 0;
      const at = (i, j) => (i < 0 || j < 0 || i >= nx || j >= ny ? 0 : d[j * nx + i]);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i; if (!grid[k]) continue;
        d[k] = Math.min(d[k], at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + 1.414, at(i + 1, j - 1) + 1.414);
      }
      for (let j = ny - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
        const k = j * nx + i; if (!grid[k]) continue;
        d[k] = Math.min(d[k], at(i + 1, j) + 1, at(i, j + 1) + 1, at(i + 1, j + 1) + 1.414, at(i - 1, j + 1) + 1.414);
      }
      for (let k = 0; k < d.length; k++) d[k] = grid[k] ? (d[k] - 0.5) * cell : 0;
      return d;
    },
  };
  return fs;
}

// ---------------------------------------------------------------- ensoleillement
const LEVELS = ['shade', 'partial', 'full'];
function downgrade(level, n = 1) {
  if (!level) return level;
  return LEVELS[Math.max(0, LEVELS.indexOf(level) - n)];
}

/** Grands arbres existants (≥ 3 m) : {x, y, h, w}. */
function existingTrees(garden) {
  return ((garden && garden.existing) || [])
    .filter((e) => e.keep !== false && Number(e.height) >= 3 && !(Array.isArray(e.points) && e.points.length >= 2))
    .map((e) => ({ x: e.x, y: e.y, h: Number(e.height), w: Number(e.width) > 0 ? Number(e.width) : 4 }));
}

/** Échantillonneur d'ensoleillement : at(point) → 'full'|'partial'|'shade'|null (ombre des arbres existants incluse). */
function makeSunSampler(garden) {
  const sun = (garden && garden.sun) || {};
  let base = () => null;
  let estimated = false;
  if (sun.mode === 'uniform' && sun.uniform) base = () => sun.uniform;
  else if (sun.mode === 'map' && Array.isArray(sun.regions) && sun.regions.length) {
    const regs = sun.regions;
    base = (p) => { for (let i = regs.length - 1; i >= 0; i--) if (pointInPolygon(p, regs[i].points)) return regs[i].level; return null; };
  } else if (garden && garden.context && garden.context.location && ((garden.boundary || []).length >= 3)) {
    estimated = true; // sun.js tient déjà compte de l'ombre des existants
    let regs = [];
    try {
      const bb = bounds(garden.boundary);
      regs = estimateSunMap(garden, { step: bb.width * bb.height > 150 ? 1 : 0.5 });
    } catch (e) { regs = []; }
    base = (p) => { for (const r of regs) if (pointInPolygon(p, r.points)) return r.level; return null; };
  }
  const trees = estimated ? [] : existingTrees(garden);
  const na = ((garden && garden.context && garden.context.northAngle) || 0) * Math.PI / 180;
  const north = { x: Math.sin(na), y: -Math.cos(na) };
  return (p) => {
    let lv = base(p);
    if (!lv || !trees.length) return lv;
    let n = 0;
    for (const t of trees) {
      const dx = p.x - t.x; const dy = p.y - t.y; const d = Math.hypot(dx, dy);
      if (d < t.w / 2) n = Math.max(n, 1);
      else if (d < t.h) {
        const cos = (dx * north.x + dy * north.y) / d;
        if (cos >= 0.34) n = Math.max(n, 1); // côté nord du grand arbre : ombre portée
      }
    }
    return n ? downgrade(lv, n) : lv;
  };
}
function dominantSun(poly, sunAt) {
  const bb = bounds(poly);
  const cnt = {};
  const step = Math.max(0.25, Math.max(bb.width, bb.height) / 12);
  for (let y = bb.minY + step / 2; y < bb.maxY; y += step) for (let x = bb.minX + step / 2; x < bb.maxX; x += step) {
    const p = { x, y };
    if (!pointInPolygon(p, poly)) continue;
    const l = sunAt(p);
    if (l) cnt[l] = (cnt[l] || 0) + 1;
  }
  let best = null; let bn = 0;
  for (const k of ['full', 'partial', 'shade']) if ((cnt[k] || 0) > bn) { bn = cnt[k]; best = k; }
  return best;
}

// ---------------------------------------------------------------- formes
const ARC = [0, 30, 60, 90].map((d) => (d * Math.PI) / 180);

function stripPoly(P0, P1, u, n, w, rc) {
  const c1 = { x: P1.x + n.x * (w - rc) - u.x * rc, y: P1.y + n.y * (w - rc) - u.y * rc };
  const c0 = { x: P0.x + n.x * (w - rc) + u.x * rc, y: P0.y + n.y * (w - rc) + u.y * rc };
  const pts = [P0, P1];
  for (const t of ARC) pts.push({ x: c1.x + rc * (u.x * Math.cos(t) + n.x * Math.sin(t)), y: c1.y + rc * (u.y * Math.cos(t) + n.y * Math.sin(t)) });
  for (const t of [...ARC].reverse()) pts.push({ x: c0.x + rc * (-u.x * Math.cos(t) + n.x * Math.sin(t)), y: c0.y + rc * (-u.y * Math.cos(t) + n.y * Math.sin(t)) });
  return pts.map((p) => ({ x: r3(p.x), y: r3(p.y) }));
}
function ellipsePoly(cx, cy, a, b, ang, N = 16) {
  const c = Math.cos(ang); const s = Math.sin(ang);
  const pts = [];
  for (let i = 0; i < N; i++) {
    const t = (2 * Math.PI * i) / N;
    const lx = a * Math.cos(t); const ly = b * Math.sin(t);
    pts.push({ x: r3(cx + lx * c - ly * s), y: r3(cy + lx * s + ly * c) });
  }
  return pts;
}
function rrectPoly(cx, cy, hw, hh, ang, rc) {
  const c = Math.cos(ang); const s = Math.sin(ang);
  rc = Math.min(rc, hw * 0.9, hh * 0.9);
  const pts = [];
  const corners = [[1, 1, 0], [-1, 1, 90], [-1, -1, 180], [1, -1, 270]];
  for (const [sx, sy, a0] of corners) {
    const ccx = sx * (hw - rc); const ccy = sy * (hh - rc);
    for (const dg of [0, 30, 60, 90]) {
      const t = ((a0 + dg) * Math.PI) / 180;
      const lx = ccx + rc * Math.cos(t); const ly = ccy + rc * Math.sin(t);
      pts.push({ x: r3(cx + lx * c - ly * s), y: r3(cy + lx * s + ly * c) });
    }
  }
  return pts;
}
function perim(poly) {
  let l = 0;
  for (let i = 0; i < poly.length; i++) l += Math.hypot(poly[(i + 1) % poly.length].x - poly[i].x, poly[(i + 1) % poly.length].y - poly[i].y);
  return l;
}

/** Points d'échantillonnage d'une forme convexe : intérieur en treillis + bord décalé de 3 cm vers l'intérieur. */
function samplePoints(poly, step = 0.3) {
  const bb = bounds(poly);
  const pts = [];
  for (let y = bb.minY + step / 2; y < bb.maxY; y += step) for (let x = bb.minX + step / 2; x < bb.maxX; x += step) {
    if (pointInPolygon({ x, y }, poly)) pts.push({ x, y });
  }
  const c = centroid(poly);
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]; const b = poly[(i + 1) % poly.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-6) continue;
    let nx = -(b.y - a.y) / len; let ny = (b.x - a.x) / len;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if ((c.x - mid.x) * nx + (c.y - mid.y) * ny < 0) { nx = -nx; ny = -ny; }
    const k = Math.max(1, Math.ceil(len / 0.15));
    const e = Math.min(0.45, 0.03 / len);
    for (let j = 0; j <= k; j++) {
      const t = e + (1 - 2 * e) * (j / k);
      pts.push({ x: a.x + (b.x - a.x) * t + nx * 0.03, y: a.y + (b.y - a.y) * t + ny * 0.03 });
    }
  }
  return pts;
}

// ---------------------------------------------------------------- compas / libellés
const COMPASS = ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest'];
function compassOf(garden, from, to) {
  const na = (garden && garden.context && garden.context.northAngle) || 0;
  const b = (bearing(from, to) - na + 720) % 360;
  return COMPASS[Math.round(b / 45) % 8];
}
const SUN_TEXT = { full: 'plein soleil', partial: 'mi-ombre', shade: 'ombre' };
const ALONG = {
  wall: 'du mur', fence: 'de la clôture', hedge: 'de la haie', open: 'de la limite du terrain',
  house: 'de la maison', shed: 'de l’abri', terrace: 'de la terrasse', path: 'de l’allée', lawn: 'de la pelouse',
};
const ROLE_LABEL = { bordure: 'Bordure', 'pied-de-mur': 'Massif de pied de mur', ilot: 'Îlot', angle: 'Massif d’angle', 'haie-fleurie': 'Haie fleurie' };
const ROLE_WEIGHT = { 'pied-de-mur': 1, 'haie-fleurie': 0.85, bordure: 0.8, angle: 0.75, ilot: 0.55 };

// ---------------------------------------------------------------- supports et candidats
function collectSupports(garden, allowLawn) {
  const sup = [];
  const push = (a, b, kind, role, contour) => {
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    if (L >= 1.2) sup.push({ a, b, L, u: { x: (b.x - a.x) / L, y: (b.y - a.y) / L }, kind, role, contour });
  };
  for (const s of boundarySides(garden)) {
    const k = edgeKindOf(garden, s.i);
    push(s.a, s.b, k, k === 'wall' ? 'pied-de-mur' : 'bordure', true);
  }
  for (const ob of garden.obstacles || []) {
    if (ob.center && !ob.points) continue;
    if (ob.kind === 'house' || ob.kind === 'shed') for (const s of obstacleSides(ob)) push(s.a, s.b, ob.kind, 'pied-de-mur', false);
    else if (ob.kind === 'wall') for (const s of obstacleSides(ob)) push(s.a, s.b, 'wall', 'pied-de-mur', false);
    else if (ob.kind === 'fence') for (const s of obstacleSides(ob)) push(s.a, s.b, 'fence', 'bordure', false);
  }
  for (const z of garden.zones || []) {
    if (!(z.type === 'terrace' || z.type === 'path' || (z.type === 'lawn' && !allowLawn)) || !z.shape || z.shape.kind === 'circle') continue;
    const poly = shapePolygon(z.shape);
    for (let i = 0; i < poly.length; i++) push(poly[i], poly[(i + 1) % poly.length], z.type, 'bordure', false);
  }
  return sup;
}

const WIDTHS = [0.8, 1, 1.2, 1.5, 1.8, 2];

function buildStrip(c, t0, t1) {
  const P0 = { x: c.A.x + c.u.x * t0, y: c.A.y + c.u.y * t0 };
  const P1 = { x: c.A.x + c.u.x * t1, y: c.A.y + c.u.y * t1 };
  return stripPoly(P0, P1, c.u, c.n, c.w, Math.min(0.45, c.w * 0.45, (t1 - t0) * 0.2));
}

function stripCandidates(fs, sup, side, o, rng) {
  const out = [];
  const n = { x: -sup.u.y * side, y: sup.u.x * side };
  const step = 0.1;
  const cols = Math.floor(sup.L / step) + 1;
  const depth = new Array(cols);
  const maxD = WIDTHS[WIDTHS.length - 1] + 0.03;
  for (let i = 0; i < cols; i++) {
    const t = Math.min(sup.L, i * step);
    const bx = sup.a.x + sup.u.x * t; const by = sup.a.y + sup.u.y * t;
    let d = 0.03;
    let k = 0;
    while (d <= maxD && fs.isFree(bx + n.x * d, by + n.y * d)) { k++; d += 0.05; }
    depth[i] = k ? 0.03 + 0.05 * (k - 1) + 0.03 : 0;
  }
  for (const w of WIDTHS) {
    const minLen = Math.max(1.5, o.minArea / w + 0.05);
    const Lmax = Math.min(10, o.maxArea / w - 0.05);
    if (Lmax < minLen) continue;
    let i = 0;
    while (i < cols) {
      if (depth[i] + 1e-9 < w) { i++; continue; }
      let j = i;
      while (j + 1 < cols && depth[j + 1] + 1e-9 >= w) j++;
      const t0 = i * step; const t1 = Math.min(sup.L, j * step);
      const Lr = t1 - t0;
      if (Lr >= minLen) {
        const lens = [...new Set([Math.min(Lr, Lmax), Math.max(minLen, Math.min(Lr, Lmax) * 0.55), Math.max(minLen, Math.min(Lr, 3))].map((v) => r1(Math.min(v, Lr, Lmax))))];
        const wins = [];
        for (const len of lens) {
          if (len < minLen - 1e-9) continue;
          wins.push([t0, t0 + len], [t1 - len, t1]);
          if (Lr - len > 0.4) { const s0 = t0 + rng() * (Lr - len); wins.push([s0, s0 + len]); }
        }
        const seen = new Set();
        for (const [a0, a1] of wins) {
          const key = `${r1(a0)}|${r1(a1)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          let role = sup.role;
          if (role === 'bordure' && sup.contour && (sup.kind === 'fence' || sup.kind === 'hedge') && w >= 1.2 && w <= 1.8 && a1 - a0 >= 4) role = 'haie-fleurie';
          out.push({ type: 'strip', role, sup, A: sup.a, u: sup.u, n, w, t0: a0, t1: a1, minLen });
        }
      }
      i = j + 1;
    }
  }
  return out;
}

function cornerCandidates(garden, fs, o) {
  const out = [];
  const b = garden.boundary || [];
  const n = b.length;
  if (!garden.boundaryClosed || n < 3) return out;
  for (let i = 0; i < n; i++) {
    const p = b[i]; const prev = b[(i + n - 1) % n]; const next = b[(i + 1) % n];
    const l1 = Math.hypot(next.x - p.x, next.y - p.y); const l2 = Math.hypot(prev.x - p.x, prev.y - p.y);
    if (l1 < 1 || l2 < 1) continue;
    const u1 = { x: (next.x - p.x) / l1, y: (next.y - p.y) / l1 };
    const u2 = { x: (prev.x - p.x) / l2, y: (prev.y - p.y) / l2 };
    const bis = { x: u1.x + u2.x, y: u1.y + u2.y };
    const bl = Math.hypot(bis.x, bis.y);
    if (bl < 0.2 || !pointInPolygon({ x: p.x + (bis.x / bl) * 0.2, y: p.y + (bis.y / bl) * 0.2 }, b)) continue;
    const phi = Math.acos(clamp(u1.x * u2.x + u1.y * u2.y, -1, 1));
    if (phi < 0.7 || phi > 2.6) continue;
    const a1 = Math.atan2(u1.y, u1.x);
    let da = Math.atan2(u2.y, u2.x) - a1;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    for (const r of [1.8, 2.4, 3, 3.6]) {
      const area = 0.5 * r * r * phi;
      if (area < o.minArea || area > o.maxArea) continue;
      const pts = [{ x: r3(p.x), y: r3(p.y) }];
      for (let k = 0; k <= 8; k++) {
        const a = a1 + (da * k) / 8;
        pts.push({ x: r3(p.x + r * Math.cos(a)), y: r3(p.y + r * Math.sin(a)) });
      }
      const sh = Math.sin(phi / 2);
      out.push({ type: 'corner', role: 'angle', poly: pts, guard: pts, widthM: 2 * r * sh / (1 + sh), corner: p });
    }
  }
  return out;
}

function islandCandidates(fs, o, rng, garden) {
  const out = [];
  const dm = fs.distanceMap();
  const cells = [];
  for (let k = 0; k < dm.length; k++) if (dm[k] >= 1.45) cells.push(k);
  cells.sort((a, b) => (dm[b] + rng() * 0.8) - (dm[a] + rng() * 0.8));
  const centers = [];
  for (const k of cells) {
    const i = k % fs.nx; const j = (k - i) / fs.nx;
    const c = fs.cellCenter(i, j);
    if (centers.every((q) => Math.hypot(q.x - c.x, q.y - c.y) >= 1.8)) centers.push({ ...c, d: dm[k] });
    if (centers.length >= 28) break;
  }
  const angles = [0, 30, 60, 90, 120, 150];
  for (const c of centers) {
    for (let rep = 0; rep < 2; rep++) {
      const ang = (angles[Math.floor(rng() * angles.length)] * Math.PI) / 180;
      const bPick = [1, 1.3, 1.5][Math.floor(rng() * 3)];
      const b = Math.min(bPick, c.d - 0.62, 1.5);
      if (b < 0.7) continue;
      const rect = rng() < 0.45;
      const aMax = Math.min(4.3, o.maxArea / (rect ? 4 * b * 0.97 : Math.PI * b));
      for (let a = aMax; a >= b && a >= 0.9; a -= 0.3) {
        const mk = (pa, pb) => (rect ? rrectPoly(c.x, c.y, pa, pb, ang, Math.min(0.6, pb * 0.6)) : ellipsePoly(c.x, c.y, pa, pb, ang));
        const poly = mk(a, b);
        const area = polygonArea(poly);
        if (area > o.maxArea || area < o.minArea) continue;
        const guard = mk(a + 0.6, b + 0.6);
        if (!guard.every((p) => fs.isFree(p.x, p.y))) continue;
        out.push({ type: 'island', role: 'ilot', poly, guard, widthM: 2 * b, center: { x: c.x, y: c.y }, rect });
        break;
      }
    }
  }
  return out;
}

function validShape(fs, poly, guard) {
  const g = guard || poly;
  for (const p of samplePoints(g, 0.3)) if (!fs.isFree(p.x, p.y)) return false;
  return true;
}

// ---------------------------------------------------------------- propositions de massifs
function viewpointsOf(garden) {
  const vps = [];
  for (const z of garden.zones || []) if (z.type === 'terrace' && z.shape) vps.push({ poly: shapePolygon(z.shape) });
  for (const ob of garden.obstacles || []) if (ob.kind === 'house' && ob.points && ob.points.length >= 3) vps.push({ poly: ob.points });
  for (const op of garden.openings || []) {
    if (op.kind !== 'door' && op.kind !== 'garage') continue;
    try { const g = openingGeometry(garden, op); if (g) vps.push({ pt: g.center }); } catch (e) { /* ignoré */ }
  }
  return vps;
}
function viewDistance(vps, p) {
  let d = Infinity;
  for (const v of vps) d = Math.min(d, v.poly ? polyDist(p, v.poly) : Math.hypot(p.x - v.pt.x, p.y - v.pt.y));
  return d;
}

/**
 * Propose des massifs dans le vide du jardin.
 * `opts` : {seed=1, coverage=0.5, minArea=2, maxArea=20, maxBeds, style:'mixed'|'borders'|'islands', ambiance, maintenance,
 * budget, palette, plants, allowLawn, cell, margin, clearances, design=true}.
 * @returns {Array} massifs {id, role, shape, areaM2, widthM, sunLevel, score, why, plantings, summary, …}
 */
export function proposeBeds(garden, opts = {}) {
  const o = {
    seed: 1, coverage: 0.5, minArea: 2, maxArea: 20, maxBeds: 12, style: 'mixed', ambiance: null, maintenance: null,
    palette: 'auto', allowLawn: false, design: true, ...opts,
  };
  if (!(o.maxBeds > 0)) o.maxBeds = 12;
  const rng = rngFrom(o.seed * 7919 + 13);
  const fs = freeSpace(garden, { cell: o.cell || 0.25, margin: o.margin ?? 0.3, clearances: o.clearances, allowLawn: o.allowLawn });
  if (fs.freeArea < o.minArea) return [];
  let target = clamp(o.coverage, 0, 1) * fs.freeArea;
  if (target <= 0) return [];
  target = Math.max(target, Math.min(o.minArea * 0.9, fs.freeArea * 0.5));

  const sunAt = makeSunSampler(garden);
  const vps = viewpointsOf(garden);
  const bc = centroid(garden.boundary);
  const bbG = bounds(garden.boundary);

  // Candidats.
  const cands = [];
  if (o.style !== 'islands') {
    for (const sup of collectSupports(garden, o.allowLawn)) for (const side of [1, -1]) cands.push(...stripCandidates(fs, sup, side, o, rng));
    cands.push(...cornerCandidates(garden, fs, o));
  }
  if (o.style !== 'borders') cands.push(...islandCandidates(fs, o, rng, garden));

  const finish = (c) => {
    if (c.type === 'strip') c.poly = buildStrip(c, c.t0, c.t1);
    if (c.type === 'strip') c.guard = c.poly;
    c.area = polygonArea(c.poly);
    c.cen = centroid(c.poly);
    if (c.type === 'strip') c.widthM = c.w;
    return c;
  };
  const scoreOf = (c) => {
    const sun = sunAt(c.cen);
    const sunS = sun === 'full' ? 1 : sun === 'partial' ? 0.75 : sun === 'shade' ? 0.45 : 0.65;
    const d = vps.length ? viewDistance(vps, c.cen) : null;
    const vis = d == null ? 0.5 : Math.max(0.1, Math.exp(-d / 7));
    const P = perim(c.poly);
    const iso = (4 * Math.PI * c.area) / (P * P);
    const compact = Math.min(1, 0.4 + Math.sqrt(iso));
    const wS = Math.min(1, c.widthM / 1.5);
    const sizeS = Math.exp(-(Math.log(c.area / 6) ** 2) / 2);
    c.vis = d;
    c.sun = sun;
    return 100 * (0.30 * ROLE_WEIGHT[c.role] + 0.22 * vis + 0.18 * sunS + 0.10 * compact + 0.10 * wS + 0.10 * sizeS);
  };
  for (const c of cands) { finish(c); c.jit = 1 + (rng() - 0.5) * 0.4; c.base = scoreOf(c) * c.jit; }

  const placed = [];
  let total = 0;
  const conflicts = (c, poly) => placed.some((p) => convexOverlap(c.guard === c.poly ? poly : c.guard, p.poly) || convexOverlap(poly, p.guard));
  const insideAny = (x, y) => placed.some((p) => pointInPolygon({ x, y }, p.poly));
  const isFreeAll = (x, y) => fs.isFree(x, y) && !insideAny(x, y);

  const trimmed = (c) => {
    if (!placed.length) return c;
    if (!conflicts(c, c.poly)) return c;
    if (c.type !== 'strip') return null;
    for (let k = 1; k <= 80; k++) {
      for (const [t0, t1] of [[c.t0, c.t1 - 0.1 * k], [c.t0 + 0.1 * k, c.t1]]) {
        if (t1 - t0 < c.minLen) continue;
        const poly = buildStrip(c, t0, t1);
        if (!conflicts(c, poly)) return finish({ ...c, t0, t1, poly });
      }
      if (c.t1 - c.t0 - 0.1 * k < c.minLen) break;
    }
    return null;
  };
  const sliverLen = (c) => {
    let len = 0;
    const ctr = c.cen;
    for (let i = 0; i < c.poly.length; i++) {
      const a = c.poly[i]; const b = c.poly[(i + 1) % c.poly.length];
      const L = Math.hypot(b.x - a.x, b.y - a.y);
      if (L < 1e-6) continue;
      let nx = (b.y - a.y) / L; let ny = -(b.x - a.x) / L;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if ((mid.x - ctr.x) * nx + (mid.y - ctr.y) * ny < 0) { nx = -nx; ny = -ny; }
      const k = Math.max(1, Math.ceil(L / 0.25));
      for (let j = 0; j < k; j++) {
        const t = (j + 0.5) / k;
        const px = a.x + (b.x - a.x) * t; const py = a.y + (b.y - a.y) * t;
        let d = 0.05; let hit = null;
        while (d <= 0.5) { if (!isFreeAll(px + nx * d, py + ny * d)) { hit = d; break; } d += 0.05; }
        if (hit != null && hit > 0.09) len += L / k;
      }
    }
    return len;
  };

  const dead = new Set();
  while (placed.length < o.maxBeds && total < target * 0.92) {
    const remaining = target - total;
    if (remaining < o.minArea * 0.75) break;
    const order = cands.filter((c) => !dead.has(c)).sort((a, b) => b.base - a.base);
    let best = null; let bestScore = -1; let tried = 0;
    for (const c0 of order) {
      if (tried >= 14) break;
      const c = trimmed(c0);
      if (!c) { dead.add(c0); continue; }
      if (c.area < o.minArea || c.area > o.maxArea) { dead.add(c0); continue; }
      if (total + c.area > target * 1.25 && placed.length) continue;
      tried++;
      const fit = c.area <= remaining * 1.2 + 0.3 ? 1 : (remaining * 1.2 + 0.3) / c.area * 0.5;
      const sc = scoreOf(c) * c0.jit * fit;
      if (sc > bestScore) { bestScore = sc; best = c; best.src = c0; }
    }
    if (!best) break;
    const c = best;
    if (!validShape(fs, c.poly, c.guard) || sliverLen(c) > 1.5) { dead.add(c.src); if (c.src === c) continue; continue; }
    c.score = bestScore;
    placed.push(c); total += c.area; dead.add(c.src);
  }

  // Sorties.
  const totalArea = placed.reduce((s, c) => s + c.area, 0) || 1;
  const beds = placed.map((c, idx) => {
    const sunLevel = dominantSun(c.poly, sunAt);
    const area = r1(c.area);
    const widthM = r1(c.widthM);
    const bed = {
      id: `m_${o.seed}_${idx + 1}`,
      role: c.role,
      shape: { kind: 'polygon', points: c.poly.map((p) => ({ x: r3(p.x), y: r3(p.y) })) },
      areaM2: area,
      widthM,
      sunLevel,
      score: Math.round(clamp(c.score, 0, 100)),
      why: whyBed(garden, c, { area, widthM, sunLevel, bc, bbG }),
      plantings: [],
      summary: null,
    };
    if (o.design) {
      const budget = Number.isFinite(o.budget) ? Math.max(0, o.budget) * (c.area / totalArea) : undefined;
      const d = designBed(garden, bed, {
        seed: o.seed, ambiance: o.ambiance, maintenance: o.maintenance, budget, palette: o.palette, plants: o.plants, tminC: o.tminC,
      });
      bed.plantings = d.plantings;
      bed.summary = d.summary;
      bed.plantsWhy = d.why;
      bed.alternatives = d.alternatives;
    }
    bed.ambiance = o.ambiance || null;
    bed.seed = o.seed;
    return bed;
  });
  return beds;
}

function whyBed(garden, c, { area, widthM, sunLevel, bc, bbG }) {
  const sun = sunLevel ? `, ${SUN_TEXT[sunLevel]}` : '';
  let vis = '';
  if (c.vis != null && c.vis < 5) vis = ', bien visible depuis la terrasse ou la maison';
  if (c.type === 'strip') {
    const mid = { x: (c.A.x + c.u.x * (c.t0 + c.t1) / 2), y: (c.A.y + c.u.y * (c.t0 + c.t1) / 2) };
    const dir = compassOf(garden, bc, mid);
    const lab = c.role === 'pied-de-mur' ? 'Pied de mur' : cap(ROLE_LABEL[c.role].toLowerCase());
    return `${lab} de ${fr(widthM)} m le long ${ALONG[c.sup.kind] || 'de la limite'} ${dir}${sun}${vis}`;
  }
  if (c.type === 'corner') return `Massif d’angle de ${fr(area)} m² au coin ${compassOf(garden, bc, c.corner)}${sun}${vis}`;
  const dist = Math.hypot(c.center.x - bc.x, c.center.y - bc.y);
  const pos = dist < Math.max(bbG.width, bbG.height) * 0.18 ? 'au centre du jardin' : `côté ${compassOf(garden, bc, c.center)}`;
  return `Îlot de ${fr(area)} m² dans un grand vide ${pos}${sun}${vis}`;
}

// ---------------------------------------------------------------- couleurs
function hexToHsl(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255; const g = ((n >> 8) & 255) / 255; const b = (n & 255) / 255;
  const mx = Math.max(r, g, b); const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2; const d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s, l };
}
/** Familles de teintes : 'rose-rouge' | 'jaune-orangé' | 'vert' | 'bleu-violet' | 'blanc'. */
export const COLOR_FAMILIES = ['rose-rouge', 'jaune-orangé', 'vert', 'bleu-violet', 'blanc'];
export function colorFamily(hex) {
  const c = hexToHsl(hex);
  if (!c) return null;
  if (c.l >= 0.85 || (c.s < 0.15 && c.l > 0.6)) return 'blanc';
  if (c.h >= 300 || c.h < 20) return 'rose-rouge';
  if (c.h < 70) return 'jaune-orangé';
  if (c.h < 170) return 'vert';
  return 'bleu-violet';
}
const WHEEL = ['rose-rouge', 'jaune-orangé', 'vert', 'bleu-violet'];
function harmony(fams) {
  const nb = fams.filter((f) => f !== 'blanc');
  if (fams.length > 3) return 0;
  if (nb.length === 0) return 0.7;
  if (nb.length === 1) return 1;
  const idx = nb.map((f) => WHEEL.indexOf(f)).sort((a, b) => a - b);
  if (nb.length === 2) {
    const d = (idx[1] - idx[0]) % 4;
    return d === 1 || d === 3 ? 0.95 : 0.88; // analogues / complémentaires
  }
  return 0.5;
}
function foliageTone(hex) {
  const c = hexToHsl(hex);
  if (!c) return 'moyen';
  if (c.s < 0.25 || (c.h >= 170 && c.h < 230)) return 'glauque';
  if (c.h >= 270 || c.h < 25) return 'pourpre';
  if (c.l > 0.55) return 'clair';
  if (c.l < 0.33) return 'foncé';
  return 'moyen';
}

const PALETTES = {
  chaud: { label: 'chaud', ok: (i) => !i.fam || ['rose-rouge', 'jaune-orangé', 'blanc'].includes(i.fam) },
  froid: { label: 'froid', ok: (i) => !i.fam || ['bleu-violet', 'vert', 'blanc'].includes(i.fam) },
  pastel: { label: 'pastel', ok: (i) => !i.hsl || (i.hsl.l >= 0.68 && i.hsl.s <= 0.85) },
  blanc: { label: 'blanc', ok: (i) => !i.fam || i.fam === 'blanc' || i.fam === 'vert' },
  vif: { label: 'vif', ok: (i) => !i.hsl || (i.hsl.s >= 0.55 && i.hsl.l >= 0.3 && i.hsl.l <= 0.72) },
};
const PALETTE_FAMS = {
  chaud: ['rose-rouge', 'jaune-orangé'], froid: ['bleu-violet', 'vert'], pastel: ['rose-rouge', 'bleu-violet'],
  blanc: ['blanc', 'vert'], vif: ['rose-rouge', 'jaune-orangé'],
};

// ---------------------------------------------------------------- combinaison de plantes
const LAYER_SHARE = { fond: 0.15, milieu: 0.35, avant: 0.30, bordure: 0.10, bulbes: 0.10 };
const LAYER_ORDER = ['fond', 'milieu', 'avant', 'bordure'];
const WATER = { low: 0, medium: 1, high: 2 };
const SEASONS = [[3, 4, 5], [6, 7, 8], [9, 10]];

function layerOf(p) {
  const h = Number(p.heightAdult) || 0.5;
  const hab = habitOf(p).id;
  if (hab.startsWith('groundcover') || h <= 0.3) return 'bordure';
  if (h <= 0.6) return 'avant';
  if (h <= 1.1) return 'milieu';
  return 'fond';
}
const spacingOf = (p) => {
  const s = p.spacing > 0 ? p.spacing : p.widthAdult > 0 ? p.widthAdult : 0.5;
  return Math.max(p.category === 'bulb' ? 0.12 : 0.2, s);
};
function priceOf(info, count, area) {
  const p = info.p;
  if (typeof p.priceEur !== 'number') return count * 8;
  return p.priceUnit === 'm2' ? p.priceEur * area : p.priceEur * count;
}

/** Quantités d'une sélection selon la surface : fond 15 %, milieu 35 %, avant 30 %, bordure 10 %, bulbes 10 %. */
function allocate(S, area) {
  const groups = {};
  S.forEach((i, k) => { (groups[i.bulb ? 'bulbes' : i.layer] ||= []).push(k); });
  const present = Object.keys(groups);
  const tot = present.reduce((s, g) => s + LAYER_SHARE[g], 0) || 1;
  const counts = new Array(S.length).fill(1);
  for (const g of present) {
    const per = (area * LAYER_SHARE[g] / tot) / groups[g].length;
    for (const k of groups[g]) {
      const sp = spacingOf(S[k].p);
      counts[k] = Math.max(1, Math.round(per / (sp * sp)));
    }
  }
  const fp = () => S.reduce((s, i, k) => s + counts[k] * spacingOf(i.p) ** 2, 0);
  let guard = 400;
  while (fp() > area * 1.15 && guard-- > 0) {
    let bk = -1; let bv = 0;
    S.forEach((i, k) => { if (counts[k] > 1) { const v = counts[k] * spacingOf(i.p) ** 2; if (v > bv) { bv = v; bk = k; } } });
    if (bk < 0) break;
    counts[bk]--;
  }
  return counts;
}

function normalizeGardenCtx(garden, opts) {
  const c = (garden && garden.context) || {};
  let tminC = null;
  if (Number.isFinite(opts.tminC)) tminC = opts.tminC;
  else if (Number.isFinite(c.tminC)) tminC = c.tminC;
  else {
    const clim = climateForDepartement(c.departement);
    if (clim) tminC = adjustTminForAltitude(clim.tminC, c.altitude);
  }
  const w = c.wind;
  return { tminC, soil: c.soil || null, windy: w === null || w === undefined ? null : !(w === false || w === 'none' || w === 'low'), maintenance: c.maintenance || null };
}

function relax(list, pred, min) {
  const f = list.filter(pred);
  return f.length >= min ? f : list;
}

function runDesign(infos, P) {
  const { area, rng, iters, budget, ambiance, maintenance, palette } = P;
  const n0 = clamp(Math.round(4 + area / 2.2), 5, 9);
  const amb = ambiance ? getAmbiance(ambiance) : null;
  const pollW = ambiance === 'pollinisateurs' ? 1.5 : 0.6;

  const evaluate = (S) => {
    const n = S.length;
    if (!n) return -1e9;
    const counts = allocate(S, area);
    const fit = S.reduce((s, i) => s + i.fit, 0) / n / 100;
    const months = new Set();
    for (const i of S) for (const m of i.bloom) if (m >= 3 && m <= 10) months.add(m);
    const cov = months.size / 8;
    let seasons = 0;
    for (const ss of SEASONS) seasons += Math.min(2, S.filter((i) => ss.some((m) => i.bloom.includes(m))).length);
    let run = 0; let longest = 0;
    for (let m = 3; m <= 10; m++) { if (months.has(m)) { run++; longest = Math.max(longest, run); } else run = 0; }
    const bloom = 0.5 * cov + 0.25 * (seasons / 6) + 0.25 * (longest / 8);
    const layers = new Set(S.map((i) => i.layer)).size;
    const layerS = layers >= 3 ? (layers >= 4 ? 1 : 0.8) : layers / 4 * 0.5;
    const fams = [...new Set(S.map((i) => i.fam).filter(Boolean))];
    let color = harmony(fams);
    const famCount = {};
    for (const i of S) if (i.fam) famCount[i.fam] = (famCount[i.fam] || 0) + 1;
    const flow = S.filter((i) => i.fam).length;
    if (flow && Math.max(...Object.values(famCount)) / flow >= 0.4) color = Math.min(1, color + 0.05);
    const ev = S.filter((i) => i.evergreen).length;
    const tones = new Set(S.map((i) => i.tone)).size;
    const foliage = 0.6 * (ev >= 2 ? 1 : ev === 1 ? 0.6 : 0) + 0.4 * Math.min(1, tones / 3);
    const ambS = amb ? S.reduce((s, i) => s + i.amb, 0) / n : 0.5;
    const maintS = maintenance === 'low' || maintenance === 'none'
      ? S.reduce((s, i) => s + (i.maintOk ? 1 : 0.3), 0) / n
      : S.reduce((s, i) => s + (1 - (i.effort - 1) / 4), 0) / n;
    const poll = Math.min(1, S.filter((i) => i.mell).length / 3);
    const ws = S.map((i) => i.water);
    const spread = Math.max(...ws) - Math.min(...ws);
    const water = spread === 0 ? 1 : spread === 1 ? 0.75 : 0;
    const sizeS = 1 - Math.abs(n - n0) / 5;
    const palS = palette && PALETTES[palette] ? S.filter((i) => i.pal).length / n : 0.5;
    const fp = S.reduce((s, i, k) => s + counts[k] * spacingOf(i.p) ** 2, 0) / area;
    const dens = fp > 1.2 ? 1 - (fp - 1.2) * 2 : fp < 0.5 ? 0.5 + fp : 1;
    let cost = 0;
    S.forEach((i, k) => { cost += priceOf(i, counts[k], area); });
    let costS;
    if (Number.isFinite(budget)) costS = cost <= budget ? 1 : -6 * (cost - budget) / Math.max(budget, 1);
    else costS = 1 - Math.min(1, cost / (area * 60));
    const genus = {};
    let genusPen = 0;
    for (const i of S) { genus[i.genus] = (genus[i.genus] || 0) + 1; if (genus[i.genus] > 2) genusPen += 0.4; }
    const under = S.reduce((s, i) => s + i.under, 0) / n;
    let f = 1.0 * fit + 3.4 * bloom + 1.6 * layerS + 1.6 * color + 0.8 * foliage + (amb ? 1.4 * ambS : 0)
      + 1.0 * maintS + pollW * poll + 1.0 * water + 0.4 * sizeS + (palette && PALETTES[palette] ? 2 * palS : 0) + 0.6 * costS + 1.0 * dens + under * 0.8 - genusPen;
    if (n < 5 && infos.length >= 5) f -= 2 * (5 - n);
    if (n > 10) f -= 3 * (n - 10);
    if (fams.length > 3) f -= 3;
    return f;
  };

  const rank = infos.map((_, k) => k).sort((a, b) => infos[b].fit - infos[a].fit);
  const search = (nIt) => {
  let S = [];
  const want = Math.min(infos.length, n0 + Math.floor(rng() * 2));
  while (S.length < want) {
    const rest = infos.filter((i) => !S.includes(i));
    const sample = [];
    for (let k = 0; k < 28 && k < rest.length; k++) sample.push(rest[Math.floor(rng() * rest.length)]);
    let bi = null; let bv = -Infinity;
    for (const c of new Set(sample)) { const v = evaluate([...S, c]) + rng() * 0.15; if (v > bv) { bv = v; bi = c; } }
    S.push(bi);
  }
  let cur = evaluate(S); let best = S.slice(); let bestV = cur;
  for (let it = 0; it < nIt; it++) {
    const T = 0.08 * (1 - it / nIt);
    const r = rng();
    let N = S.slice();
    const pick = () => infos[rank[Math.floor(rng() * rng() * rank.length)]];
    let gapPick = null;
    if (rng() < 0.4) {
      const have = new Set();
      for (const i of S) for (const m of i.bloom) have.add(m);
      const miss = [];
      for (let m = 3; m <= 10; m++) if (!have.has(m)) miss.push(m);
      if (miss.length) {
        const m = miss[Math.floor(rng() * miss.length)];
        const cand = infos.filter((i) => i.bloom.includes(m) && !S.includes(i));
        if (cand.length) gapPick = cand[Math.floor(rng() * cand.length)];
      }
    }
    if (r < 0.72 || N.length <= 1) {
      const k = Math.floor(rng() * N.length);
      const c = gapPick || (rng() < 0.5 ? pick() : infos[Math.floor(rng() * infos.length)]);
      if (N.includes(c)) continue;
      N[k] = c;
    } else if (r < 0.84 && N.length < 10) {
      const c = pick(); if (N.includes(c)) continue; N.push(c);
    } else if (r < 0.94 && N.length > 5) {
      N.splice(Math.floor(rng() * N.length), 1);
    } else {
      const k1 = Math.floor(rng() * N.length); const k2 = Math.floor(rng() * N.length);
      const c1 = pick(); const c2 = infos[Math.floor(rng() * infos.length)];
      if (N.includes(c1) || N.includes(c2) || c1 === c2) continue;
      N[k1] = c1; N[k2] = c2;
    }
    const v = evaluate(N);
    if (v >= cur || rng() < Math.exp((v - cur) / Math.max(T, 1e-6))) {
      S = N; cur = v;
      if (v > bestV) { bestV = v; best = N.slice(); }
    }
  }
  return { S: best, v: bestV };
  };
  const r1s = search(Math.ceil(iters / 2));
  const r2s = search(Math.ceil(iters / 2));
  let S = (r2s.v > r1s.v ? r2s : r1s).S;
  // Réparation du budget : remplacer les essences les plus chères par des moins chères.
  if (Number.isFinite(budget)) {
    const costOf = (L) => { const c = allocate(L, area); return L.reduce((s, i, k) => s + priceOf(i, c[k], area), 0); };
    const order = infos.slice().sort((x, y) => priceOf(x, 1, area) - priceOf(y, 1, area));
    for (let t = 0; t < 80 && costOf(S) > budget; t++) {
      const c = allocate(S, area);
      let wk = 0; let wv = -1;
      S.forEach((i, k) => { const v = priceOf(i, c[k], area); if (v > wv) { wv = v; wk = k; } });
      const cheaper = order.filter((i) => !S.includes(i) && priceOf(i, 1, area) < priceOf(S[wk], 1, area));
      if (!cheaper.length) { if (S.length > 5) { S.splice(wk, 1); continue; } break; }
      const sameLayer = cheaper.filter((i) => i.layer === S[wk].layer && i.bulb === S[wk].bulb);
      const src = sameLayer.length && rng() < 0.7 ? sameLayer : cheaper;
      const cand = src[Math.floor(rng() * Math.min(src.length, 6))];
      const trial = S.slice(); trial[wk] = cand;
      if (costOf(trial) < costOf(S)) S = trial;
    }
  }
  return S;
}

function monthRangeText(months) {
  const ms = [...new Set(months)].sort((a, b) => a - b);
  if (!ms.length) return '';
  let best = [ms[0], ms[0]]; let s = ms[0]; let p = ms[0];
  for (const m of ms.slice(1)) {
    if (m === p + 1) { p = m; } else { s = m; p = m; }
    if (p - s > best[1] - best[0]) best = [s, p];
  }
  return best[0] === best[1] ? MONTHS[best[0] - 1] : `${MONTHS[best[0] - 1]} à ${MONTHS[best[1] - 1]}`;
}
function listFr(a) { return a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} et ${a[a.length - 1]}`; }

function describe(S, counts, area, P) {
  const months = new Set();
  for (const i of S) for (const m of i.bloom) months.add(m);
  const bloomMonths = [...months].sort((a, b) => a - b);
  const layers = new Set(S.map((i) => i.layer)).size;
  const w = {};
  S.forEach((i, k) => { if (i.fam) w[i.fam] = (w[i.fam] || 0) + counts[k] * spacingOf(i.p) ** 2; });
  const fams = Object.keys(w).sort((a, b) => (a === 'blanc') - (b === 'blanc') || w[b] - w[a]);
  const paletteText = fams.length ? listFr(fams) : 'feuillage seul';
  const mell = S.filter((i) => i.mell).length;
  let cost = 0;
  S.forEach((i, k) => { cost += priceOf(i, counts[k], area); });
  const effort = r1(S.reduce((s, i) => s + i.effort, 0) / S.length);
  const density = r1(S.reduce((s, i, k) => s + counts[k] * spacingOf(i.p) ** 2, 0) / area * 100) / 100;
  const nMonths = bloomMonths.length;
  const parts = [];
  if (nMonths) parts.push(`${nMonths} mois de floraison (${monthRangeText(bloomMonths)})`);
  parts.push(`${layers} hauteur${layers > 1 ? 's' : ''}`);
  parts.push(`palette ${paletteText}`);
  if (mell) parts.push(`${mell} essence${mell > 1 ? 's' : ''} mellifère${mell > 1 ? 's' : ''}`);
  if (P.understory) parts.push('sous-bois d’un arbre existant');
  if (P.ambiance && getAmbiance(P.ambiance)) parts.push(`ambiance ${getAmbiance(P.ambiance).label.toLowerCase()}`);
  return {
    plantings: S.map((i, k) => ({ plantId: i.id, count: counts[k] })),
    summary: {
      bloomMonths, layers, palette: paletteText, families: fams, costEur: Math.round(cost * 100) / 100, effort,
      species: S.length, melliferous: mell, density,
    },
    why: parts.join(', '),
  };
}

/**
 * Combinaison de plantes d'un massif (5 à 10 essences) : étagement, floraison continue, harmonie des couleurs,
 * feuillage persistant, ambiance, entretien, mellifères, arrosage, coût. Déterministe avec `opts.seed`.
 * `opts` : {seed=1, ambiance, maintenance, budget, palette:'auto'|'chaud'|'froid'|'pastel'|'blanc'|'vif', plants, tminC, iterations}.
 * @returns {{plantings:{plantId,count}[], summary, why, alternatives:{label,palette,ambiance,plantings,summary,why}[]}}
 */
export function designBed(garden, bed, opts = {}) {
  const poly = bed.shape.kind === 'polygon' ? bed.shape.points : shapePolygon(bed.shape);
  const area = bed.areaM2 > 0 ? bed.areaM2 : polygonArea(poly);
  const bb = bounds(poly);
  const width = bed.widthM > 0 ? bed.widthM : Math.min(bb.width, bb.height);
  const g = normalizeGardenCtx(garden, opts);
  const sunAt = makeSunSampler(garden);
  const sunLevel = bed.sunLevel !== undefined ? bed.sunLevel : dominantSun(poly, sunAt);
  const ambiance = opts.ambiance !== undefined ? opts.ambiance : (bed.ambiance || null);
  const maintenance = opts.maintenance !== undefined ? opts.maintenance : g.maintenance;
  const seed = opts.seed || 1;
  const catalog = opts.plants || allPlants();
  const cen = centroid(poly);

  // Contexte local : terrasse/piscine proches, arbre existant (sous-bois).
  let nearTerrace = false;
  for (const z of garden.zones || []) {
    if ((z.type === 'terrace' || z.type === 'pool') && z.shape && polysDistance(poly, shapePolygon(z.shape)) < 3) nearTerrace = true;
  }
  const understory = existingTrees(garden).some((t) => Math.hypot(cen.x - t.x, cen.y - t.y) <= Math.max(t.h * 0.8, t.w));

  const ctx = { tminC: g.tminC, sunLevel, areaM2: area, minDimension: width, soil: g.soil, windy: g.windy, ambiance, maintenance };
  const MASSIF_CATS = ['perennial', 'grass', 'bulb', 'groundcover', 'shrub'];
  const roleHigh = bed.role === 'haie-fleurie';
  const base = [];
  for (const p of catalog) {
    if (!MASSIF_CATS.includes(p.category) || p.invasive) continue;
    if (Array.isArray(p.zones) && p.zones.length && !p.zones.some((z) => FLOWER_ZONE_TYPES.includes(z))) continue;
    if (nearTerrace && p.toxic) continue;
    if (p.category === 'shrub' && (Number(p.heightAdult) || 0) > (roleHigh ? 3.2 : 2.5)) continue;
    const sp = spacingOf(p);
    if (sp * sp > area * 0.45) continue;
    if (p.category !== 'bulb' && (Number(p.widthAdult) || 0) > Math.max(width, 0.6) * 1.25) continue;
    const sc = scorePlant(p, ctx);
    if (sc.excluded || sc.score < 50) continue;
    const hsl = hexToHsl(p.flowerColor);
    const bloom = Array.isArray(p.bloom) ? p.bloom : [];
    const sunOk = !sunLevel || (p.sun || []).includes(sunLevel);
    const shadeLover = (p.sun || []).includes('shade') || (p.sun || []).includes('partial');
    base.push({
      p, id: p.id, fit: sc.score, layer: layerOf(p), bulb: p.category === 'bulb', bloom,
      hsl, fam: bloom.length ? colorFamily(p.flowerColor) : null, tone: foliageTone(p.foliageColor),
      evergreen: p.foliage === 'evergreen', amb: ambiance ? plantAmbianceScore(p, ambiance) : 0.5,
      avoid: ambiance ? plantAvoids(p).includes(ambiance) : false,
      maintOk: maintenance === 'low' || maintenance === 'none' ? fitsMaintenance(p, maintenance).ok : true,
      effort: plantEffort(p), mell: !!p.melliferous, water: WATER[p.water] ?? 1, sunOk,
      genus: String(p.latinName || p.id).split(' ')[0],
      under: understory ? (shadeLover && (Number(p.heightAdult) || 0) <= 1.5 ? 0.6 : (p.sun || []).includes('full') && !shadeLover ? -0.4 : 0) : 0,
    });
  }

  const build = (palette, amb, avoidIds, salt) => {
    let pool = base.slice();
    pool = relax(pool, (i) => i.sunOk, 12);
    if (amb) pool = relax(pool, (i) => !i.avoid && plantAmbianceScore(i.p, amb) >= 0.4, 15);
    if (maintenance === 'low' || maintenance === 'none') pool = relax(pool, (i) => i.maintOk, 10);
    if (palette && PALETTES[palette]) pool = relax(pool, PALETTES[palette].ok, 10);
    if (avoidIds && avoidIds.size) pool = relax(pool, (i) => !avoidIds.has(i.id), 8);
    if (nearTerrace) pool = pool.filter((i) => !i.p.toxic);
    const palOk = palette && PALETTES[palette] ? PALETTES[palette].ok : () => true;
    const infos0 = amb === ambiance ? pool : pool.map((i) => ({ ...i, amb: plantAmbianceScore(i.p, amb), avoid: plantAvoids(i.p).includes(amb) }));
    const infos = infos0.map((i) => ({ ...i, pal: palOk(i) }));
    if (!infos.length) return null;
    const rng = rngFrom(seed * 104729 + hashStr(String(bed.id || '')) + salt);
    const S = runDesign(infos, {
      area, rng, iters: clamp(opts.iterations || 220, 150, 300), budget: opts.budget, ambiance: amb, maintenance, palette,
    });
    const counts = allocate(S, area);
    const res = describe(S, counts, area, { ambiance: amb, understory });
    res.ids = new Set(S.map((i) => i.id));
    return res;
  };

  const palette = opts.palette && opts.palette !== 'auto' ? opts.palette : null;
  const main = build(palette, ambiance, null, 0);
  if (!main) return { plantings: [], summary: describeEmpty(), why: 'Aucune essence du catalogue ne convient à ce massif', alternatives: [] };

  // Alternatives : une autre palette, puis une autre ambiance + palette.
  const mainFams = new Set(main.summary.families.filter((f) => f !== 'blanc'));
  const names = Object.keys(PALETTES).filter((k) => k !== palette);
  const overlap = (k) => PALETTE_FAMS[k].filter((f) => mainFams.has(f)).length;
  names.sort((a, b) => overlap(a) - overlap(b) || (a < b ? -1 : 1));
  const altAmbs = ['romantique', 'bucolique', 'decoratif', 'pollinisateurs', 'colore', 'apaisant'].filter((a) => a !== ambiance);
  const specs = [
    { palette: names[0], ambiance, avoid: new Set(main.ids), label: `Variante ${PALETTES[names[0]].label}` },
    { palette: names[1], ambiance: altAmbs[0], avoid: new Set(main.ids), label: `Variante ${PALETTES[names[1]].label}, ambiance ${getAmbiance(altAmbs[0]).label.toLowerCase()}` },
  ];
  const alternatives = [];
  const used = new Set(main.ids);
  specs.forEach((sp, k) => {
    const av = new Set([...sp.avoid, ...used]);
    let r = build(sp.palette, sp.ambiance, av, 17 + k * 31);
    if (r && [...r.ids].every((id) => main.ids.has(id)) ) r = build(sp.palette, sp.ambiance, new Set(main.ids), 99 + k);
    if (!r) return;
    for (const id of r.ids) used.add(id);
    alternatives.push({ label: sp.label, palette: sp.palette, ambiance: sp.ambiance || null, plantings: r.plantings, summary: r.summary, why: r.why });
  });
  return { plantings: main.plantings, summary: main.summary, why: main.why, alternatives };
}
function describeEmpty() {
  return { bloomMonths: [], layers: 0, palette: 'feuillage seul', families: [], costEur: 0, effort: 0, species: 0, melliferous: 0, density: 0 };
}

// ---------------------------------------------------------------- zones
/** Hauteur dominante d'un massif (moyenne des hauteurs adultes pondérée par l'emprise) → type de zone. */
function zoneTypeFor(bed, lookup) {
  if (bed.role === 'haie-fleurie') return 'tallplants';
  let s = 0; let h = 0;
  for (const pl of bed.plantings || []) {
    const p = lookup(pl.plantId);
    if (!p) continue;
    const fp = (pl.count || 1) * spacingOf(p) ** 2;
    s += fp; h += fp * (Number(p.heightAdult) || 0.5);
  }
  if (!s) return 'midplants';
  const m = h / s;
  return m >= 1.2 ? 'tallplants' : m >= 0.45 ? 'midplants' : 'lowplants';
}

/**
 * Transforme des massifs proposés en zones prêtes à insérer (`zone.auto = true`, `autoInfo`, ambiance, plantations).
 * `opts` : {ambiance, plants, startIndex}.
 */
export function bedsToZones(garden, beds, opts = {}) {
  const catalog = opts.plants || allPlants();
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const lookup = (id) => byId.get(id) || null;
  let start = opts.startIndex;
  const existingIds = new Set(((garden && garden.zones) || []).map((z) => z.id));
  if (start == null) {
    start = 0;
    for (const z of (garden && garden.zones) || []) {
      if (!z.auto) continue;
      const m = /n°\s*(\d+)/.exec(z.label || '');
      if (m) start = Math.max(start, Number(m[1]));
    }
  }
  return (beds || []).map((bed, i) => {
    const type = zoneTypeFor(bed, lookup);
    const z = createZone(type, { kind: 'polygon', points: bed.shape.points.map((p) => ({ x: p.x, y: p.y })) });
    const amb = opts.ambiance !== undefined ? opts.ambiance : (bed.ambiance || null);
    const a = amb ? getAmbiance(amb) : null;
    const num = start + i + 1;
    z.label = a ? `Massif ${a.label.toLowerCase()} n°${num}` : `Massif n°${num}`;
    let id = `z_${bed.id}`;
    while (existingIds.has(id)) id += 'b';
    existingIds.add(id);
    z.id = id;
    z.auto = true;
    z.ambiance = a ? a.id : null;
    z.plantings = (bed.plantings || []).map((pl) => ({ plantId: pl.plantId, count: pl.count }));
    z.autoInfo = {
      role: bed.role,
      why: [bed.why, bed.plantsWhy].filter(Boolean).join(' — '),
      seed: bed.seed ?? null,
      summary: bed.summary || null,
    };
    return z;
  });
}

/**
 * Refait les massifs automatiques non gardés. `keepIds` : ids de zones auto à conserver (elles restent occupées).
 * Les massifs dessinés à la main ne sont jamais touchés. Ne modifie pas `garden`.
 * @returns {{beds, zones:Zone[], added:Zone[], kept:string[], removed:string[]}} `zones` = nouvelle liste complète
 */
export function regenerate(garden, { keepIds = [], ...opts } = {}) {
  const keep = new Set(keepIds);
  const zones = (garden && garden.zones) || [];
  const removed = zones.filter((z) => z.auto && !keep.has(z.id)).map((z) => z.id);
  const rest = zones.filter((z) => !removed.includes(z.id));
  const g2 = { ...garden, zones: rest };
  let prev = 0;
  for (const z of zones) if (z.auto && z.autoInfo && Number.isFinite(z.autoInfo.seed)) prev = Math.max(prev, z.autoInfo.seed);
  const seed = opts.seed != null ? opts.seed : prev + 1;
  const beds = proposeBeds(g2, { ...opts, seed });
  const added = bedsToZones(g2, beds, opts);
  return { beds, zones: [...rest, ...added], added, kept: rest.filter((z) => z.auto).map((z) => z.id), removed };
}
