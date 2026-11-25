// Cœur pur de la vue 3D : répartition des plants et matrices d'instances (sans DOM, sans three.js).
// Importé par le Web Worker `gl-worker.js` ET par le repli synchrone / les tests. Repère : x = plan x, z = plan y, y = haut.
import { shapePolygon, polygonArea, centroid, bounds, pointInPolygon } from './geometry.js';
import { habitOf, habitParams, TAGS_BY_PLANT } from './habits.js';
import { effectivePlant } from './heights.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Facteur de hauteur selon l'âge (0 = jeune → 0,35 ; 1 = adulte → 1). */
export const heightFactor = (age) => 0.35 + 0.65 * clamp(Number.isFinite(age) ? age : 1, 0, 1);
/** Facteur d'emprise selon l'âge (0,3 → 1). */
export const widthFactor = (age) => 0.3 + 0.7 * clamp(Number.isFinite(age) ? age : 1, 0, 1);

/** Générateur pseudo-aléatoire déterministe. */
export function mulberry32(a) {
  let s = a >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const CONIFERES = new Set(['Pinus', 'Picea', 'Abies', 'Cupressus', 'Thuja', 'Taxus', 'Juniperus', 'Cedrus', 'Chamaecyparis', 'Sequoia', 'Cryptomeria', 'Larix']);

/** Fiche allégée (clonable pour un Worker) des champs utiles au rendu 3D. */
/** Couleur des chaumes d'un bambou selon l'espèce (noir, jaune, vert). */
export function culmColor(p) {
  const t = TAGS_BY_PLANT[p && p.id];
  const txt = `${(p && p.latinName) || ''} ${(p && p.commonName) || ''} ${(t && t.note) || ''}`;
  if (/nigra|noir|black/i.test(txt)) return '#2b2723';
  if (/aurea|jaune|sulphur|holochrys|vivax|yellow/i.test(txt)) return '#cdb44a';
  return '#7aa04c';
}

export function slimPlant(p) {
  const hp = habitParams(p);
  return {
    habit: hp.habit, stems: hp.stems, support: hp.support, culm: culmColor(p),
    id: p.id, category: p.category, heightAdult: Number(p.heightAdult) || 1, widthAdult: Number(p.widthAdult) || 1,
    foliage: p.foliage || 'deciduous', bloom: Array.isArray(p.bloom) ? p.bloom.slice() : [], flowerColor: p.flowerColor || null,
    foliageColor: p.foliageColor || null, spacing: Number(p.spacing) || 0,
    genus: String(p.latinName || '').split(/\s+/)[0] || '',
  };
}

export const LAWN_PLANT = { id: '_lawn', category: 'lawn', heightAdult: 0.14, widthAdult: 0.3, foliage: 'evergreen', bloom: [], flowerColor: null, foliageColor: '#6aa84a', spacing: 0, genus: '' };

/** Forme de rendu d'une essence : 'tree' | 'conifer' | 'shrub' | 'hedge' | 'tuft' | 'grass' | 'mound' | 'lawn'. */
export function kindOf(plant) {
  const c = plant.category;
  if (c === 'lawn') return 'lawn';
  if (plant.habit === 'bamboo') return 'shrub';
  if (c === 'tree' || c === 'fruit') return CONIFERES.has(plant.genus) ? 'conifer' : 'tree';
  if (c === 'hedge') return CONIFERES.has(plant.genus) ? 'conifer' : 'hedge';
  if (c === 'shrub') return CONIFERES.has(plant.genus) && plant.heightAdult > 2.5 ? 'conifer' : 'shrub';
  if (c === 'climber') return 'shrub';
  if (c === 'groundcover') return 'mound';
  if (c === 'grass') return 'grass';
  if (plant.heightAdult < 0.15) return 'mound';
  return 'tuft';
}
/** Essence ligneuse (feuillage porté par des branches visibles en hiver). */
export const isWoody = (plant) => ['tree', 'conifer', 'shrub', 'hedge'].includes(kindOf(plant));
/** Ligneux caduc : perd ses feuilles l'hiver. */
export const isDeciduousWoody = (plant) => isWoody(plant) && kindOf(plant) !== 'conifer' && plant.foliage === 'deciduous';

const lookupOf = (plantsById) => (id) => {
  if (!plantsById) return null;
  if (typeof plantsById === 'function') return plantsById(id) || null;
  if (plantsById instanceof Map) return plantsById.get(id) || null;
  return plantsById[id] || null;
};

/** Positions de `n` points dans un polygone (grille hexagonale, ou carrée si `rows`). Déterministe. */
export function spotsInPolygon(poly, n, { rows = false } = {}) {
  if (n <= 0 || poly.length < 3) return [];
  const area = polygonArea(poly);
  const c = centroid(poly);
  const inside = pointInPolygon(c, poly) ? c : null;
  if (n === 1) return [inside || poly[0]];
  const b = bounds(poly);
  let d = Math.sqrt(area / n) * 1.15;
  let cand = [];
  for (let it = 0; it < 16 && d > 0.04; it++) {
    cand = [];
    let row = 0;
    for (let y = b.minY + d / 2; y <= b.maxY; y += rows ? d : d * 0.866, row++) {
      for (let x = b.minX + d / 2 + (!rows && row % 2 ? d / 2 : 0); x <= b.maxX; x += d) {
        if (pointInPolygon({ x, y }, poly)) cand.push({ x, y });
      }
    }
    if (cand.length >= n) break;
    d *= 0.88;
  }
  if (!cand.length) return inside ? [inside] : [];
  const m = Math.min(n, cand.length);
  const out = [];
  for (let i = 0; i < m; i++) out.push(cand[Math.round((i * (cand.length - 1)) / Math.max(1, m - 1))]);
  return out;
}

/** n points équidistants le long d'une polyligne. */
export function spotsAlong(points, n) {
  if (!points || points.length < 2 || n <= 0) return [];
  const seg = []; let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const L = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    seg.push(L); total += L;
  }
  if (total < 1e-9) return [{ x: points[0].x, y: points[0].y }];
  const out = [];
  for (let k = 0; k < n; k++) {
    let t = n === 1 ? total / 2 : (total * k) / (n - 1);
    let i = 0;
    while (i < seg.length - 1 && t > seg[i]) { t -= seg[i]; i++; }
    const f = seg[i] > 1e-9 ? Math.min(1, t / seg[i]) : 0;
    out.push({ x: points[i].x + (points[i + 1].x - points[i].x) * f, y: points[i].y + (points[i + 1].y - points[i].y) * f });
  }
  return out;
}

function lineLength(points) {
  let L = 0;
  for (let i = 0; i < points.length - 1; i++) L += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  return L;
}

const MAX_PAR_ESSENCE = 400;

/**
 * Répartition déterministe des plants d'une zone.
 * @returns {{plantId:string, plant:object, x:number, y:number, rot:number, seed:number}[]} (x, y en mètres, repère du plan)
 */
export function placePlants(garden, zone, plantsById, { age = 1, density = 1, walls = null } = {}) {
  void age;
  const get = lookupOf(plantsById);
  const shape = zone && zone.shape;
  if (!shape) return [];
  const poly = shapePolygon(shape, 32);
  const isLine = shape.kind === 'line' && shape.points && shape.points.length >= 2;
  const area = poly.length >= 3 ? Math.abs(polygonArea(poly)) : 0;
  const len = isLine ? lineLength(shape.points) : 0;
  const rng = mulberry32(hashStr(String(zone.id || 'z')));
  const groups = [];
  for (const pl of zone.plantings || []) {
    const plant = effectivePlant(get(pl.plantId), pl);
    if (!plant) continue;
    const kind = kindOf(plant);
    const c = Math.max(1, Math.round(Number(pl.count ?? pl.quantity) || 1));
    let n = Math.min(c, 250);
    if (kind === 'lawn') n = 0; // le gazon est rendu par la zone (touffes + texture)
    else if (kind === 'mound' && plant.heightAdult < 0.4 && plant.category === 'groundcover') {
      const w = Math.max(0.3, plant.widthAdult * 0.8);
      n = clamp(Math.round((isLine ? len * (shape.width || 1) : area) / (w * w) * density), c, MAX_PAR_ESSENCE);
    } else if (isLine && plant.category === 'hedge') {
      const sp = Math.max(0.4, plant.widthAdult * 0.7);
      n = clamp(Math.ceil(len / sp), c, 250);
    }
    if (n > 0) groups.push({ plant, left: n });
  }
  const total = groups.reduce((s, g) => s + g.left, 0);
  if (!total) return [];
  const spots = isLine ? spotsAlong(shape.points, total) : spotsInPolygon(poly, total, { rows: zone.type === 'vegetable' });
  const seq = [];
  const left = groups.map((g) => g.left);
  // intercalage des essences pour un mélange homogène
  while (seq.length < spots.length && left.some((n) => n > 0)) {
    groups.forEach((g, gi) => { if (left[gi] > 0 && seq.length < spots.length) { seq.push(gi); left[gi]--; } });
  }
  const jit = isLine ? 0.08 : 0.18;
  const out = [];
  seq.forEach((gi, i) => {
    const plant = groups[gi].plant;
    let { x, y } = spots[i];
    const sp = Math.max(0.3, Math.min(plant.widthAdult, plant.spacing || plant.widthAdult));
    const jx = (rng() - 0.5) * 2 * jit * sp; const jy = (rng() - 0.5) * 2 * jit * sp;
    if (zone.type !== 'vegetable' && (poly.length < 3 || pointInPolygon({ x: x + jx, y: y + jy }, poly) || isLine)) { x += jx; y += jy; }
    out.push({ plantId: plant.id, plant, x, y, rot: rng() * Math.PI * 2, seed: rng() });
  });
  applyPortLayout(out, poly, { walls: walls || wallSegments(garden), line: isLine ? shape.points : null });
  return out;
}

/** Touffes de gazon d'une zone pelouse (déterministes). */
function lawnSpots(zone, density) {
  const poly = shapePolygon(zone.shape, 32);
  if (poly.length < 3) return [];
  const area = Math.abs(polygonArea(poly));
  const n = clamp(Math.round(area * 2.2 * density), 0, 2600);
  if (!n) return [];
  const b = bounds(poly);
  const rng = mulberry32(hashStr(`lawn${zone.id}`));
  const out = [];
  for (let tries = 0; out.length < n && tries < n * 4; tries++) {
    const p = { x: b.minX + rng() * b.width, y: b.minY + rng() * b.height };
    if (pointInPolygon(p, poly)) out.push({ plantId: '_lawn', plant: LAWN_PLANT, x: p.x, y: p.y, rot: rng() * Math.PI * 2, seed: rng() });
  }
  return out;
}

// ─── matrices d'instances ───────────────────────────────────────────────────────

/** Écrit dans `out` (16 nombres) T · Ry(ry) · Rz(rz) · S, colonne-major (convention three.js). */
export function composeInto(out, tx, ty, tz, ry, rz, sx, sy, sz) {
  const ca = Math.cos(ry); const sa = Math.sin(ry); const cb = Math.cos(rz); const sb = Math.sin(rz);
  out.push(ca * cb * sx, sb * sx, -sa * cb * sx, 0,
    -ca * sb * sy, cb * sy, sa * sb * sy, 0,
    sa * sz, 0, ca * sz, 0,
    tx, ty, tz, 1);
}

const PARTS_FEUILLES = new Set(['crown', 'cone', 'tuft', 'mound']);
export { PARTS_FEUILLES };

class Groupes {
  constructor() { this.map = new Map(); }
  get(plantId, part) {
    const k = `${plantId}|${part}`;
    let g = this.map.get(k);
    if (!g) { g = { plantId, part, m: [], t: [] }; this.map.set(k, g); }
    return g;
  }
  push(plantId, part, tint, tx, ty, tz, ry, rz, sx, sy, sz) {
    const g = this.get(plantId, part);
    composeInto(g.m, tx, ty, tz, ry, rz, sx, sy, sz);
    g.t.push(tint);
  }
  finish() {
    return [...this.map.values()].filter((g) => g.t.length).map((g) => ({
      plantId: g.plantId, part: g.part, n: g.t.length, matrices: new Float32Array(g.m), tints: new Float32Array(g.t),
    }));
  }
}

function pointOnCrown(rng, rx, ry, rz) {
  // direction aléatoire (hémisphère haut privilégié)
  const th = rng() * Math.PI * 2;
  const ph = Math.acos(clamp(1 - rng() * 1.45, -1, 1));
  return [Math.sin(ph) * Math.cos(th) * rx, Math.cos(ph) * ry, Math.sin(ph) * Math.sin(th) * rz];
}

// ─── familles de ports (silhouettes) ─────────────────────────────────────────────
/** Port → famille de dessin, partagée par les rendus 3D temps réel, isométrique et plan 2D. */
export const FAMILY = {
  'tree-round': 'round', 'tree-fruit': 'fruit', 'tree-spreading': 'spreading', 'tree-columnar': 'column', 'tree-conical': 'cone',
  'tree-weeping': 'weeping', 'tree-vase': 'vase', 'tree-umbrella': 'umbrella', palm: 'palm',
  'shrub-round': 'dome', 'shrub-mound': 'mound', 'shrub-upright': 'upright', 'shrub-arching': 'arching', 'shrub-conical': 'cone', 'shrub-columnar': 'column',
  bamboo: 'bamboo', 'hedge-clipped': 'hedge', climber: 'climber', vine: 'climber',
  'perennial-clump': 'clump', 'perennial-upright': 'spikes', 'perennial-mound': 'mound',
  'groundcover-mat': 'mat', 'groundcover-creeping': 'creeping',
  'grass-arching': 'fountain', 'grass-upright': 'blades', 'grass-fine': 'fine', fern: 'fern', rosette: 'rosette',
  'bulb-spike': 'bulbspike', 'bulb-clump': 'bulbclump', 'aquatic-floating': 'floating', 'aquatic-reed': 'reed', 'aquatic-marginal': 'clump',
  'vegetable-row': 'row', 'vegetable-climbing': 'tipi', 'herb-bush': 'herb', lawn: 'lawn',
};
export const familyOf = (plant) => FAMILY[(plant && plant.habit) || habitOf(plant).id] || 'dome';
const TREE_FAMILIES = new Set(['round', 'fruit', 'spreading', 'column', 'cone', 'weeping', 'vase', 'umbrella', 'palm']);

/** Segments de mur / clôture / maison pouvant servir de support : [{a, b, h}]. */
export function wallSegments(garden) {
  const out = [];
  const add = (a, b, h) => { if (a && b && Math.hypot(b.x - a.x, b.y - a.y) > 0.2) out.push({ a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y }, h }); };
  for (const o of (garden && garden.obstacles) || []) {
    const pts = o.points || [];
    if (o.kind === 'wall' || o.kind === 'fence') for (let i = 0; i < pts.length - 1; i++) add(pts[i], pts[i + 1], Number(o.height) > 0 ? Number(o.height) : (o.kind === 'wall' ? 2 : 1.2));
    else if ((o.kind === 'house' || o.kind === 'shed') && pts.length >= 3) for (let i = 0; i < pts.length; i++) add(pts[i], pts[(i + 1) % pts.length], Math.min(3, Number(o.height) > 0 ? Number(o.height) : 3));
  }
  const b = (garden && garden.boundary) || []; const be = (garden && garden.boundaryEdges) || [];
  for (let i = 0; i < b.length; i++) {
    const e = be[i];
    if (e && (e.kind === 'wall' || e.kind === 'fence')) add(b[i], b[(i + 1) % b.length], Number(e.height) > 0 ? Number(e.height) : (e.kind === 'wall' ? 2 : 1.2));
  }
  return out;
}

/** Axe principal d'un polygone (rectangle englobant d'aire minimale) : {ang, ux, uy, cx, cy, len, wid}. */
export function polyAxis(poly) {
  let best = null;
  for (let a = 0; a < 180; a += 5) {
    const r = (a * Math.PI) / 180; const c = Math.cos(r); const s = Math.sin(r);
    let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
    for (const p of poly) { const u = p.x * c + p.y * s; const v = -p.x * s + p.y * c; x0 = Math.min(x0, u); x1 = Math.max(x1, u); y0 = Math.min(y0, v); y1 = Math.max(y1, v); }
    const area = (x1 - x0) * (y1 - y0);
    if (!best || area < best.area - 1e-9) best = { area, r, c, s, x0, x1, y0, y1 };
  }
  const u = (best.x0 + best.x1) / 2; const v = (best.y0 + best.y1) / 2;
  let ang = best.r; let len = best.x1 - best.x0; let wid = best.y1 - best.y0;
  if (wid > len) { ang += Math.PI / 2; [len, wid] = [wid, len]; }
  return { ang, ux: Math.cos(ang), uy: Math.sin(ang), cx: u * best.c - v * best.s, cy: u * best.s + v * best.c, len, wid };
}

/** Mur le plus proche d'un point (≤ maxD) : {x, y, nx, ny, ang, h, dist} (n = normale vers le point). */
export function nearestWall(p, walls, maxD = 3) {
  let best = null;
  for (const w of walls || []) {
    const dx = w.b.x - w.a.x; const dy = w.b.y - w.a.y; const L2 = dx * dx + dy * dy || 1;
    const t = clamp(((p.x - w.a.x) * dx + (p.y - w.a.y) * dy) / L2, 0.02, 0.98);
    const qx = w.a.x + dx * t; const qy = w.a.y + dy * t; const d = Math.hypot(p.x - qx, p.y - qy);
    if (d <= maxD && (!best || d < best.dist)) {
      let nx = (p.x - qx); let ny = (p.y - qy); const nl = Math.hypot(nx, ny);
      if (nl < 1e-6) { const L = Math.sqrt(L2); nx = -dy / L; ny = dx / L; } else { nx /= nl; ny /= nl; }
      best = { x: qx, y: qy, nx, ny, ang: Math.atan2(dy, dx), h: w.h, dist: d };
    }
  }
  return best;
}

/** Longueur d'un tronçon de haie taillée d'une essence (m). */
export const hedgeSeg = (plant) => Math.max(0.45, (Number(plant && plant.widthAdult) || 1) * 0.78);

/**
 * Applique les contraintes de port à une liste de plants posés {plant, x, y, rot, aux?} (modifiée en place) :
 * haies taillées en rang le long du grand axe, bambous en touffes serrées, grimpantes contre le mur le plus proche.
 */
export function applyPortLayout(list, poly, { walls = [], line = null } = {}) {
  const hid = (q) => (q.plant.habit || habitOf(q.plant).id);
  const hedges = list.filter((q) => hid(q) === 'hedge-clipped');
  if (hedges.length && poly.length >= 3) {
    const ax = polyAxis(poly);
    if (line && line.length >= 2) {
      const along = spotsAlong(line, hedges.length);
      hedges.forEach((q, k) => { if (along[k]) { q.x = along[k].x; q.y = along[k].y; } });
      for (const q of hedges) {
        let bd = Infinity; let ang = ax.ang;
        for (let i = 0; i < line.length - 1; i++) {
          const dx = line[i + 1].x - line[i].x; const dy = line[i + 1].y - line[i].y; const L2 = dx * dx + dy * dy || 1;
          const t = clamp(((q.x - line[i].x) * dx + (q.y - line[i].y) * dy) / L2, 0, 1);
          const d = Math.hypot(q.x - (line[i].x + dx * t), q.y - (line[i].y + dy * t));
          if (d < bd) { bd = d; ang = Math.atan2(dy, dx); }
        }
        q.rot = ang; q.aux = hedgeSeg(q.plant);
      }
    } else {
      const d = hedges.reduce((s, q) => s + hedgeSeg(q.plant), 0) / hedges.length * 0.92;
      const m = hedges.length; const step = Math.min(d, ax.len / m);
      const pts = hedges.map((q, k) => ({ x: ax.cx + ax.ux * (k - (m - 1) / 2) * step, y: ax.cy + ax.uy * (k - (m - 1) / 2) * step }));
      if (pts.every((p) => pointInPolygon(p, poly))) hedges.forEach((q, k) => { q.x = pts[k].x; q.y = pts[k].y; q.rot = ax.ang; q.aux = hedgeSeg(q.plant); });
      else hedges.forEach((q) => { q.rot = ax.ang; q.aux = hedgeSeg(q.plant); });
    }
  }
  const bam = list.filter((q) => hid(q) === 'bamboo');
  if (bam.length > 1) {
    const cx = bam.reduce((s, q) => s + q.x, 0) / bam.length; const cy = bam.reduce((s, q) => s + q.y, 0) / bam.length;
    for (const q of bam) {
      const nx = cx + (q.x - cx) * 0.55; const ny = cy + (q.y - cy) * 0.55;
      if (poly.length < 3 || pointInPolygon({ x: nx, y: ny }, poly)) { q.x = nx; q.y = ny; }
      q.clump = true;
    }
  }
  for (const q of list) {
    if (FAMILY[hid(q)] !== 'climber') continue;
    const w = nearestWall(q, walls, 3);
    if (w) { q.x = w.x + w.nx * 0.22; q.y = w.y + w.ny * 0.22; q.rot = w.ang; q.aux = w.h > 0 ? w.h : 2; q.wall = w; }
    else q.aux = 0;
  }
  return list;
}

// ─── émission des instances par port ─────────────────────────────────────────────
const arcPt = (t) => [2 * (1 - t) * t * 0.1 + t * t, 3.2 * t - 2.7 * t * t]; // arc de tige : monte puis retombe (portée 1, hauteur ≈ 0,95)
export { arcPt };

function emitPlant(G, rec, plant, age0, density) {
  const { x, y: z, rot, seed } = rec; const aux = rec.aux || 0;
  const age = plant.fixed ? 1 : age0;
  const rng = mulberry32(Math.floor(seed * 4294967295) + 1);
  const kind = kindOf(plant);
  const hab = plant.habit || habitOf(plant).id;
  const fam = FAMILY[hab] || (kind === 'tree' ? 'round' : 'dome');
  const hf = heightFactor(age); const wf = widthFactor(age);
  const regular = fam === 'hedge';
  const H = Math.max(0.05, plant.heightAdult * hf * (regular ? 1 : 0.92 + rng() * 0.16));
  const W = Math.max(0.1, plant.widthAdult * wf * (0.92 + rng() * 0.16));
  const R = W / 2;
  const id = plant.id;
  const tint = () => 0.82 + rng() * 0.3;
  const hasBloom = plant.bloom && plant.bloom.length && plant.flowerColor;
  const nFlowers = (base) => (hasBloom ? Math.max(1, Math.round(base * density)) : 0);
  const dens = Math.min(1, 0.45 + 0.55 * density);
  const cnt = (n, lo = 1) => Math.max(lo, Math.round(n * dens));
  const fs = clamp(W * 0.028, 0.035, 0.1);
  const push = (part, t, px, py, pz, ry, rz, sx, sy, sz) => G.push(id, part, t, px, py, pz, ry, rz, sx, sy, sz);
  const TAU = Math.PI * 2;
  const blob = (px, py, pz, rx, ry_, rz_, t = tint()) => push('crown', t, px, py, pz, rng() * 6.28, 0, rx, ry_, rz_);
  // tige / branche inclinée de `tilt` rad vers l'azimut `phi` (plan), longueur `len`, épaisseur `th`
  const br = (px, py, pz, phi, tilt, len, th, part = 'branch') => push(part, 1, px, py, pz, Math.PI - phi, tilt, th, len, th);
  const tip = (px, py, pz, phi, tilt, len) => [px + Math.cos(phi) * Math.sin(tilt) * len, py + Math.cos(tilt) * len, pz + Math.sin(phi) * Math.sin(tilt) * len];
  const flowersOnCrown = (cy, rx, ry_, rz_, n, part = 'flower', k = 1) => {
    for (let i = 0; i < n; i++) { const [px, py, pz] = pointOnCrown(rng, rx, ry_, rz_); push(part, 1, x + px, cy + py, z + pz, 0, 0, fs * k, fs * k, fs * k); }
  };

  if (TREE_FAMILIES.has(fam)) {
    const TF = { round: 0.38, fruit: 0.3, spreading: 0.3, column: 0.12, cone: 0.1, weeping: 0.38, umbrella: 0.55, vase: 0.22, palm: 0.72 }[fam];
    const trunkH = H * TF;
    const r = clamp(0.03 * H + 0.012 * W, 0.04, 0.55) * (0.85 + rng() * 0.3);
    const flowerStyleNone = fam === 'cone' || fam === 'column' || fam === 'palm';
    if (fam === 'cone') {
      const tiers = hab === 'shrub-conical' ? 3 : 4;
      if (hab !== 'shrub-conical') push('trunk', 1, x, 0, z, rot, 0, r, H * 0.16, r);
      for (let k = 0; k < tiers; k++) {
        const s = 1 - 0.8 * (k / tiers) * (k / tiers) - 0.12 * k; // chaque étage plus étroit
        const sc = R * Math.max(0.2, s) * (0.94 + rng() * 0.1);
        push('cone', tint() * 0.82, x, H * (0.04 + (0.8 / tiers) * k), z, rng() * 6.28, 0, sc, H * (0.9 / tiers + 0.18), sc);
      }
    } else if (fam === 'column') {
      if (hab === 'tree-columnar') push('trunk', 1, x, 0, z, rot, 0, r, trunkH * 1.2, r);
      const n = 6; const b0 = hab === 'tree-columnar' ? trunkH * 0.5 : H * 0.02;
      for (let k = 0; k < n; k++) { // flamme étroite : cônes empilés très peu évasés
        const t = k / n; const sc = R * (0.95 - 0.45 * t * t) * (0.94 + rng() * 0.1);
        push('cone', tint() * 0.8, x + (rng() - 0.5) * R * 0.1, b0 + (H - b0) * t * 0.9, z + (rng() - 0.5) * R * 0.1, rng() * 6.28, 0, sc, (H - b0) * 0.32, sc);
      }
    } else if (fam === 'palm') {
      const L = clamp(H * 0.32, 0.6, 2.8); const top = H - L * 0.42;
      push('trunk', 1, x, 0, z, rot, 0, clamp(0.03 * H, 0.05, 0.22), top, clamp(0.03 * H, 0.05, 0.22));
      const nf = cnt(11, 6);
      for (let k = 0; k < nf; k++) {
        const phi = (k / nf) * TAU + rng() * 0.4; const lo = k % 3 === 0;
        push('frond', tint(), x, top - (lo ? L * 0.1 : 0), z, -phi, lo ? -0.35 : 0, L * (0.85 + rng() * 0.3), L * (lo ? 0.8 : 1), L * (0.9 + rng() * 0.2));
      }
    } else {
      push('trunk', 1, x, 0, z, rot, 0, r, trunkH * 1.08, r);
      const base = trunkH * 0.78; const ch = H - base;
      let cy = base + ch * 0.55; let crx = R; let cry = ch * 0.5;
      if (fam === 'round' || fam === 'fruit') {
        blob(x, base + ch * 0.52, z, R * 0.82, ch * 0.5, R * 0.82); blob(x, base + ch * 0.8, z, R * 0.52, ch * 0.28, R * 0.52);
        for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU + rng() * 0.8; const d = R * (0.42 + rng() * 0.12); blob(x + Math.cos(a) * d, base + ch * (0.3 + rng() * 0.25), z + Math.sin(a) * d, R * (0.5 + rng() * 0.14), ch * (0.3 + rng() * 0.1), R * (0.5 + rng() * 0.14)); }
      } else if (fam === 'spreading') {
        blob(x, base + ch * 0.5, z, R * 0.95, ch * 0.34, R * 0.95); blob(x, base + ch * 0.74, z, R * 0.6, ch * 0.22, R * 0.6);
        for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU + rng() * 0.6; const d = R * (0.58 + rng() * 0.15); blob(x + Math.cos(a) * d, base + ch * (0.36 + rng() * 0.2), z + Math.sin(a) * d, R * (0.42 + rng() * 0.12), ch * (0.2 + rng() * 0.08), R * (0.42 + rng() * 0.12)); }
        cry = ch * 0.34;
      } else if (fam === 'umbrella') {
        for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU + rng(); const d = R * 0.35; blob(x + Math.cos(a) * d, H * (0.86 + 0.03 * k) - ch * 0.08, z + Math.sin(a) * d, R * (0.62 + rng() * 0.1), ch * 0.17, R * (0.62 + rng() * 0.1)); }
        blob(x, H * 0.9, z, R * 0.7, ch * 0.16, R * 0.7); cy = H * 0.86; cry = ch * 0.2;
        const sway = (rng() - 0.5) * 0.5; // tronc tordu
        push('trunk', 1, x, trunkH * 0.5, z, rot + 1.5, sway, r * 0.9, trunkH * 0.6, r * 0.9);
      } else if (fam === 'vase') {
        const nb = 6;
        for (let k = 0; k < nb; k++) {
          const a = (k / nb) * TAU + rng() * 0.4; const tl = 0.45 + rng() * 0.25;
          br(x, trunkH * 0.85, z, a, tl, ch * 0.95, r * 0.28);
          const [tx0, ty0, tz0] = tip(x, trunkH * 0.85, z, a, tl, ch * 0.85);
          blob(tx0, ty0, tz0, R * (0.4 + rng() * 0.1), ch * 0.26, R * (0.4 + rng() * 0.1));
        }
        blob(x, base + ch * 0.72, z, R * 0.32, ch * 0.2, R * 0.32); cy = base + ch * 0.7; crx = R * 0.9;
      } else if (fam === 'weeping') {
        blob(x, base + ch * 0.74, z, R * 0.72, ch * 0.24, R * 0.72); blob(x, base + ch * 0.9, z, R * 0.4, ch * 0.12, R * 0.4);
        push('curtain', tint(), x, 0.04, z, rng() * 6.28, 0, R * 1.0, (base + ch * 0.8) * 0.97, R * 1.0);
        push('curtain', tint(), x, 0.1, z, rng() * 6.28, 0, R * 0.82, (base + ch * 0.62) * 0.95, R * 0.82);
        for (let k = 0; k < 14; k++) { const a = (k / 14) * TAU + rng() * 0.3; push('branch', 1, x + Math.cos(a) * R * 0.5, base + ch * 0.78, z + Math.sin(a) * R * 0.5, Math.PI - a, Math.PI - 0.12 - rng() * 0.2, r * 0.12, (base + ch * 0.7) * (0.7 + rng() * 0.3), r * 0.12); }
        cy = base + ch * 0.74; cry = ch * 0.24;
      }
      if (fam !== 'weeping' && fam !== 'umbrella' && fam !== 'vase') { // charpente visible hors feuillage
        for (let k = 0; k < 11; k++) { const a = (k / 11) * TAU + rng(); br(x, trunkH * (0.78 + rng() * 0.22), z, a, (fam === 'spreading' ? 1.0 : 0.5) + rng() * 0.5, ch * (0.5 + rng() * 0.35), r * 0.3); }
      } else if (fam === 'umbrella') {
        for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU + rng(); br(x, trunkH * 0.95, z, a, 1.05 + rng() * 0.2, R * (0.8 + rng() * 0.3), r * 0.26); }
      }
      if (fam !== 'vase' && fam !== 'weeping') for (let k = 0; k < 12; k++) { const a = rng() * TAU; br(x + Math.cos(a) * R * 0.25, base + ch * (0.25 + rng() * 0.3), z + Math.sin(a) * R * 0.25, a, 0.7 + rng() * 0.6, ch * (0.22 + rng() * 0.2), r * 0.11); }
      const nf = nFlowers(fam === 'fruit' ? 22 : 16);
      flowersOnCrown(cy, crx * 0.88, cry, crx * 0.88, nf, 'flower', 1.1);
      if (plant.category === 'fruit') flowersOnCrown(cy, crx * 0.85, cry * 0.9, crx * 0.85, Math.max(4, Math.round(14 * density)), 'fruit', 1.35);
    }
    void flowerStyleNone;
    return;
  }

  switch (fam) {
    case 'bamboo': {
      const n = clamp(Math.round((plant.stems || 30) * 0.4 * dens), 6, 34);
      const rC = clamp(0.011 + 0.0045 * H, 0.008, 0.04);
      push('crown', tint() * 1.05, x, H * 0.07, z, rng() * 6.28, 0, R * 0.7, H * 0.08, R * 0.7);
      const ps = clamp(0.26 + 0.045 * H, 0.22, 0.6);
      for (let k = 0; k < n; k++) {
        const phi = rng() * TAU; const d = Math.sqrt(rng()) * R * 0.5;
        const px = x + Math.cos(phi) * d; const pz = z + Math.sin(phi) * d;
        const Hc = H * (0.72 + 0.28 * rng()); const t1 = 0.04 + rng() * 0.08; const t2 = t1 + 0.1 + rng() * 0.18; const rr = rC * (0.8 + rng() * 0.4);
        const L1 = Hc * 0.6; const L2 = Hc * 0.42;
        br(px, 0, pz, phi, t1, L1, rr, 'culm');
        const [mx, my, mz] = tip(px, 0, pz, phi, t1, L1);
        br(mx, my, mz, phi, t2, L2, rr * 0.75, 'culm');
        for (let q = 0; q < 3; q++) {
          const tt = 0.55 + 0.22 * q; const [qx, qy, qz] = tip(mx, my, mz, phi, t2, L2 * tt);
          push('plume', tint(), qx, qy, qz, rng() * 6.28, 0, ps * (1.15 - 0.2 * q), ps * 0.9, ps * (1.15 - 0.2 * q));
        }
      }
      return;
    }
    case 'hedge': {
      const seg = aux > 0 ? aux : hedgeSeg(plant); const Wd = Math.max(0.3, plant.widthAdult * wf);
      push('hedgebox', tint(), x, 0, z, -rot, 0, seg * 1.7, H, Wd);
      for (let k = 0; k < 5; k++) br(x + (rng() - 0.5) * seg * 0.6, 0, z + (rng() - 0.5) * Wd * 0.4, rng() * TAU, 0.08 + rng() * 0.18, H * 0.9, 0.012 + 0.008 * H);
      for (let k = 0, n = nFlowers(8); k < n; k++) push('flower', 1, x + Math.cos(rot) * (rng() - 0.5) * seg, H * (0.55 + rng() * 0.45), z + Math.sin(rot) * (rng() - 0.5) * seg, 0, 0, fs, fs, fs);
      return;
    }
    case 'climber': {
      const onWall = aux > 0; const sup = plant.support || 'trellis';
      const a = rot; const dx = Math.cos(a); const dz = Math.sin(a);
      const Wp = clamp(W * 0.8, 0.8, 3); const Hs = onWall ? Math.min(H, aux * 1.02) : Math.min(H, sup === 'pergola' ? 2.3 : 2.4);
      const cover = [];
      if (!onWall) {
        if (sup === 'pergola') {
          const dn = 1.2; const nx = -dz; const nz = dx;
          for (const sx_ of [-1, 1]) for (const sn_ of [-1, 1]) push('trunk', 1, x + dx * sx_ * Wp / 2 + nx * sn_ * dn / 2, 0, z + dz * sx_ * Wp / 2 + nz * sn_ * dn / 2, 0, 0, 0.05, 2.3, 0.05);
          for (const sn_ of [-1, 1]) push('slat', 1, x - dx * Wp / 2 + nx * sn_ * dn / 2, 2.3, z - dz * Wp / 2 + nz * sn_ * dn / 2, -a, -Math.PI / 2, 0.06, Wp, 0.1);
          for (let k = 0; k < 5; k++) { const u = -Wp / 2 + (Wp * (k + 0.5)) / 5; push('slat', 1, x + dx * u - nx * dn / 2, 2.36, z + dz * u - nz * dn / 2, -(a + Math.PI / 2), -Math.PI / 2, 0.04, dn, 0.06); }
          for (let k = 0; k < cnt(14, 8); k++) cover.push([x + dx * (rng() - 0.5) * Wp + nx * (rng() - 0.5) * dn, 2.3 + 0.12 + rng() * 0.1, z + dz * (rng() - 0.5) * Wp + nz * (rng() - 0.5) * dn]);
          for (let k = 0; k < cnt(6, 3); k++) { const sx_ = k % 2 ? 1 : -1; cover.push([x + dx * sx_ * Wp / 2, 0.5 + rng() * 1.6, z + dz * sx_ * Wp / 2]); }
        } else if (sup === 'tripod') {
          const Ht = Math.min(H, 2); const tl = Math.atan(0.35 / Ht);
          for (let k = 0; k < 3; k++) { const phi = rot + (k / 3) * TAU; const bx = x + Math.cos(phi) * 0.35; const bz = z + Math.sin(phi) * 0.35; br(bx, 0, bz, phi + Math.PI, tl, Ht / Math.cos(tl), 0.014, 'trunk'); for (let q = 0; q < cnt(6, 3); q++) { const t = 0.15 + rng() * 0.8; cover.push([bx + (x - bx) * t, Ht * t, bz + (z - bz) * t]); } }
        } else {
          for (const s_ of [-1, 1]) push('trunk', 1, x + dx * s_ * Wp / 2, 0, z + dz * s_ * Wp / 2, 0, 0, 0.03, Hs + 0.1, 0.03);
          for (let k = 0; k < 5; k++) push('slat', 1, x + dx * (-Wp / 2 + (Wp * (k + 0.5)) / 5), 0, z + dz * (-Wp / 2 + (Wp * (k + 0.5)) / 5), -a, 0, 0.02, Hs, 0.012);
          for (let k = 1; k <= 4; k++) push('slat', 1, x - dx * Wp / 2, (Hs * k) / 5, z - dz * Wp / 2, -a, -Math.PI / 2, 0.02, Wp, 0.012);
        }
      }
      if (!cover.length) {
        const nb = cnt(clamp(Math.round(Wp * Hs * 12), 14, 80), 8);
        for (let k = 0; k < nb; k++) { const u = (rng() - 0.5) * Wp; const v = Hs * (0.1 + 0.9 * Math.sqrt(rng())); cover.push([x + dx * u, v, z + dz * u]); }
      }
      const ns = clamp(plant.stems || 3, 2, 6);
      for (let k = 0; k < ns; k++) {
        let px = x + dx * (rng() - 0.5) * Wp * 0.6; let pz = z + dz * (rng() - 0.5) * Wp * 0.6; let py = 0;
        const segN = 3; const sl = Math.min(Hs, 2.6) / segN;
        for (let q = 0; q < segN; q++) { const lean = (rng() - 0.5) * 0.5; push('branch', 1, px, py, pz, -a, lean, 0.013, sl * 1.05, 0.013); px += dx * Math.sin(lean) * -sl; pz += dz * Math.sin(lean) * -sl; py += Math.cos(lean) * sl; }
      }
      const flat = onWall || sup === 'trellis' || sup === 'wall' ? 0.12 : 0.22;
      for (const c of cover) blob(c[0], c[1], c[2], 0.16 + rng() * 0.1, 0.13 + rng() * 0.08, flat * (0.8 + rng() * 0.5));
      for (let k = 0, n = nFlowers(12); k < n; k++) { const c = cover[Math.floor(rng() * cover.length)]; push('flower', 1, c[0], c[1] + 0.06, c[2], 0, 0, fs * 1.2, fs * 1.2, fs * 1.2); }
      return;
    }
    case 'tipi': {
      const Ht = Math.min(Math.max(H, 1), 2); const tl = Math.atan(0.3 / Ht); const cover = [];
      for (let k = 0; k < 3; k++) {
        const phi = rot + (k / 3) * TAU; const bx = x + Math.cos(phi) * 0.3; const bz = z + Math.sin(phi) * 0.3;
        br(bx, 0, bz, phi + Math.PI, tl, Ht / Math.cos(tl), 0.013, 'trunk');
        for (let q = 0; q < cnt(5, 3); q++) { const t = 0.12 + rng() * 0.85; cover.push([bx + (x - bx) * t, Ht * t, bz + (z - bz) * t]); }
      }
      for (const c of cover) blob(c[0], c[1], c[2], 0.13 + rng() * 0.08, 0.11 + rng() * 0.07, 0.11 + rng() * 0.07);
      for (let k = 0, n = nFlowers(6); k < n; k++) { const c = cover[Math.floor(rng() * cover.length)]; push('fruit', 1, c[0], c[1] - 0.05, c[2], 0, 0, 0.045, 0.045, 0.045); }
      return;
    }
    case 'arching': {
      const n = clamp(Math.round((plant.stems || 10) * 0.5 * dens), 5, 12); const s = Math.max(0.3, (H + R) * 0.6);
      for (let k = 0; k < n; k++) {
        const phi = (k / n) * TAU + rng() * 0.5; const sc = s * (0.8 + rng() * 0.3);
        push('arc', 1, x, 0, z, -phi, 0, sc, sc, sc);
        for (const t of [0.45, 0.7, 0.95]) { const [ax, ay] = arcPt(t); blob(x + Math.cos(phi) * ax * sc, ay * sc, z + Math.sin(phi) * ax * sc, 0.26 * sc, 0.2 * sc, 0.26 * sc); }
      }
      blob(x, H * 0.18, z, R * 0.4, H * 0.18, R * 0.4);
      flowersOnCrown(H * 0.55, R * 0.8, H * 0.35, R * 0.8, nFlowers(12));
      return;
    }
    case 'upright': {
      const n = clamp(Math.round((plant.stems || 8) * 0.8 * dens), 4, 12);
      for (let k = 0; k < n; k++) {
        const phi = rng() * TAU; const tl = 0.08 + rng() * 0.25; const len = H * (0.8 + rng() * 0.2);
        br(x, 0, z, phi, tl, len, 0.012 + 0.006 * H);
        if (k % 2 === 0) { const [qx, qy, qz] = tip(x, 0, z, phi, tl, len * 0.7); blob(qx, qy, qz, R * 0.34, H * 0.2, R * 0.34); }
      }
      blob(x, H * 0.78, z, R * 0.55, H * 0.2, R * 0.55); blob(x, H * 0.5, z, R * 0.4, H * 0.28, R * 0.4);
      flowersOnCrown(H * 0.7, R * 0.7, H * 0.28, R * 0.7, nFlowers(12));
      return;
    }
    case 'dome': case 'mound': case 'herb': {
      const low = fam !== 'dome'; const hc = fam === 'herb' ? 0.5 : (low ? 0.5 : 0.5);
      blob(x, H * 0.5, z, R * (low ? 0.95 : 0.85), H * hc, R * (low ? 0.95 : 0.85));
      const nb = fam === 'herb' ? 4 : 3;
      for (let k = 0; k < nb; k++) { const a = rng() * TAU; const d = R * 0.4; blob(x + Math.cos(a) * d, H * (0.34 + rng() * 0.2), z + Math.sin(a) * d, R * (0.55 + rng() * 0.12), H * (0.32 + rng() * 0.1), R * (0.55 + rng() * 0.12)); }
      if (fam !== 'mound' || hab === 'shrub-mound') for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU + rng(); br(x, 0, z, a, 0.18 + rng() * 0.5, H * (0.7 + rng() * 0.3), 0.012 * H + 0.008); }
      if (fam === 'herb' || plant.flowerStyle === 'spikes') { for (let k = 0, n = nFlowers(10); k < n; k++) { const [px, py, pz] = pointOnCrown(rng, R * 0.8, H * 0.46, R * 0.8); push('spike', 1, x + px, H * 0.52 + py, z + pz, 0, 0, fs * 0.8, H * 0.28 + 0.05, fs * 0.8); } }
      else flowersOnCrown(H * 0.52, R * 0.9, H * 0.46, R * 0.85, nFlowers(low ? 10 : 12));
      return;
    }
    case 'spikes': {
      push('tuft', tint(), x, 0, z, rot, 0, R * 0.9, H * 0.38, R * 0.9);
      const n = clamp(Math.round((plant.stems || 5) * dens), 3, 12);
      for (let k = 0; k < n; k++) {
        const phi = rng() * TAU; const d = Math.sqrt(rng()) * R * 0.5; const hh = H * (0.72 + rng() * 0.28); const tl = rng() * 0.08;
        br(x + Math.cos(phi) * d, 0, z + Math.sin(phi) * d, phi, tl, hh, 0.011, 'stem');
        if (hasBloom) { const [qx, qy, qz] = tip(x + Math.cos(phi) * d, 0, z + Math.sin(phi) * d, phi, tl, hh); push('spike', 1, qx, qy - H * 0.2, qz, 0, 0, fs * 1.1, H * 0.22, fs * 1.1); }
      }
      return;
    }
    case 'mat': case 'creeping': {
      const nb = fam === 'creeping' ? 3 : 1;
      for (let k = 0; k < nb; k++) { const a = rng() * TAU; const d = fam === 'creeping' ? R * 0.45 : 0; push('crown', tint(), x + Math.cos(a) * d, H * 0.35, z + Math.sin(a) * d, rng() * 6.28, 0, R * (fam === 'creeping' ? 0.65 + rng() * 0.2 : 1), Math.max(H * 0.5, 0.03), R * (fam === 'creeping' ? 0.5 + rng() * 0.2 : 1)); }
      for (let k = 0, n = nFlowers(fam === 'creeping' ? 6 : 8); k < n; k++) { const a = rng() * TAU; const d = Math.sqrt(rng()) * R * 0.8; push('flower', 1, x + Math.cos(a) * d, H * 0.7 + 0.01, z + Math.sin(a) * d, 0, 0, Math.min(fs, 0.06), Math.min(fs, 0.06), Math.min(fs, 0.06)); }
      return;
    }
    case 'clump': case 'row': {
      push('tuft', tint(), x, 0, z, rot, 0, R, H, R);
      push('tuft', tint(), x + Math.cos(rot) * R * 0.3, 0, z + Math.sin(rot) * R * 0.3, rot + 1.1, 0, R * 0.72, H * (0.82 + rng() * 0.12), R * 0.72);
      if (fam === 'clump') blob(x, H * 0.3, z, R * 0.7, H * 0.28, R * 0.7);
      for (let k = 0, n = nFlowers(6); k < n; k++) { const a = rng() * TAU; const d = Math.sqrt(rng()) * R * 0.55; push('flower', 1, x + Math.cos(a) * d, H * (0.78 + rng() * 0.22), z + Math.sin(a) * d, 0, 0, Math.min(fs * 1.2, 0.09), Math.min(fs * 1.2, 0.09), Math.min(fs * 1.2, 0.09)); }
      return;
    }
    case 'fountain': case 'blades': case 'fine': {
      const part = fam === 'fountain' ? 'fountain' : fam === 'blades' ? 'upright' : 'fine';
      push(part, tint(), x, 0, z, rot, 0, R * 1.05, H, R * 1.05);
      push(part, tint(), x + Math.cos(rot) * R * 0.15, 0, z + Math.sin(rot) * R * 0.15, rot + 1.9, 0, R * 0.8, H * (0.84 + rng() * 0.1), R * 0.8);
      for (let k = 0, n = nFlowers(fam === 'fine' ? 3 : 7); k < n; k++) {
        const phi = rng() * TAU; const d = fam === 'blades' ? R * 0.25 * Math.sqrt(rng()) : R * (0.35 + rng() * 0.4);
        const hh = fam === 'blades' ? H * (0.95 + rng() * 0.15) : H * (0.75 + rng() * 0.2);
        push('spike', 1, x + Math.cos(phi) * d, hh * (fam === 'blades' ? 0.82 : 0.9), z + Math.sin(phi) * d, Math.PI - phi, fam === 'fountain' ? 0.5 : 0.1, 0.03, Math.max(0.12, H * 0.22), 0.03);
      }
      return;
    }
    case 'fern': {
      const n = cnt(clamp(plant.stems || 10, 7, 20), 6); const L = Math.max(0.3, H * 1.1);
      for (let k = 0; k < n; k++) { const phi = (k / n) * TAU + rng() * 0.3; const s = L * (0.7 + rng() * 0.4); push('frond', tint(), x, 0, z, -phi, -0.15 * (k % 3), s, s * (0.8 + rng() * 0.3), s); }
      return;
    }
    case 'rosette': {
      const n = cnt(clamp(plant.stems || 12, 7, 20), 6); const L = Math.max(0.2, Math.min(R * 1.05, H * 1.9));
      for (let k = 0; k < n; k++) { const phi = (k / n) * TAU * 1.6 + rng() * 0.4; const s = L * (0.6 + 0.4 * (k % 3 === 0 ? 1 : rng())); push('leaf', tint(), x, 0.02 * k / n, z, -phi, -(0.25 + 0.5 * (1 - k / n)), s, s, s); }
      if (hasBloom) for (let k = 0; k < 3; k++) { const phi = rng() * TAU; br(x, 0, z, phi, 0.05, H * 1.7, 0.01, 'stem'); const [qx, qy, qz] = tip(x, 0, z, phi, 0.05, H * 1.7); push('spike', 1, qx, qy - 0.1, qz, 0, 0, fs, 0.2, fs); }
      return;
    }
    case 'bulbspike': case 'bulbclump': {
      push('tuft', tint(), x, 0, z, rot, 0, Math.max(R, 0.07), H * (fam === 'bulbspike' ? 0.4 : 0.55), Math.max(R, 0.07));
      const n = clamp(Math.round((plant.stems || 4) * (fam === 'bulbclump' ? 0.5 : 1) * dens), 1, 10);
      for (let k = 0; k < n; k++) {
        const phi = rng() * TAU; const d = Math.sqrt(rng()) * R * 0.6; const hh = H * (0.75 + rng() * 0.25);
        br(x + Math.cos(phi) * d, 0, z + Math.sin(phi) * d, phi, rng() * 0.06, hh, 0.01, 'stem');
        if (hasBloom) { if (fam === 'bulbspike') push('spike', 1, x + Math.cos(phi) * d, hh * 0.78, z + Math.sin(phi) * d, 0, 0, fs * 1.3, hh * 0.24, fs * 1.3); else push('flower', 1, x + Math.cos(phi) * d, hh, z + Math.sin(phi) * d, 0, 0, fs * 1.4, fs * 1.4, fs * 1.4); }
      }
      return;
    }
    case 'floating': {
      const n = cnt(clamp(Math.round(W / 0.28), 3, 10), 3);
      for (let k = 0; k < n; k++) { const a = rng() * TAU; const d = Math.sqrt(rng()) * R * 0.85; const s = 0.13 + rng() * 0.12; push('pad', tint(), x + Math.cos(a) * d, 0.075 + k * 0.0006, z + Math.sin(a) * d, rng() * 6.28, 0, s, s, s); }
      for (let k = 0, n2 = nFlowers(2); k < n2; k++) { const a = rng() * TAU; const d = rng() * R * 0.5; push('flower', 1, x + Math.cos(a) * d, 0.1, z + Math.sin(a) * d, 0, 0, 0.07, 0.04, 0.07); }
      return;
    }
    case 'reed': {
      push('upright', tint(), x, 0, z, rot, 0, R, H * 0.8, R);
      const n = clamp(Math.round((plant.stems || 20) * 0.5 * dens), 4, 24);
      for (let k = 0; k < n; k++) {
        const phi = rng() * TAU; const d = Math.sqrt(rng()) * R * 0.6; const hh = H * (0.8 + rng() * 0.3);
        br(x + Math.cos(phi) * d, 0, z + Math.sin(phi) * d, phi, rng() * 0.12, hh, 0.008, 'stem');
        if (hasBloom && k % 2 === 0) push('spike', 1, x + Math.cos(phi) * d, hh * 0.88, z + Math.sin(phi) * d, 0, 0, fs, Math.max(0.12, H * 0.14), fs);
      }
      return;
    }
    default: break;
  }
  // 'lawn' et repli
  if (fam === 'lawn') { const s = 0.7 + rng() * 0.7; push('tuft', tint(), x, 0, z, rot, 0, 0.1 * s, 0.16 * s, 0.1 * s); return; }
  blob(x, H * 0.5, z, R * 0.85, H * 0.5, R * 0.85);
}

/** Matrices d'instances groupées par (essence, partie) à partir des enregistrements. Pur et déterministe. */
export function groupsFromRecords(rec, ids, plants, { age = 1, density = 1 } = {}) {
  const G = new Groupes();
  for (let i = 0; i < rec.length; i += 6) {
    const plant = plants[ids[rec[i + 4]]];
    if (!plant) continue;
    emitPlant(G, { x: rec[i], y: rec[i + 1], rot: rec[i + 2], seed: rec[i + 3], aux: rec[i + 5] }, plant, age, density);
  }
  return G.finish();
}

/** Empaquette des enregistrements de placement en `Float32Array` (x, y, rot, seed, indexEssence). */
export function packRecords(list) {
  const ids = []; const idx = new Map();
  const rec = new Float32Array(list.length * 6);
  list.forEach((r, i) => {
    if (!idx.has(r.plantId)) { idx.set(r.plantId, ids.length); ids.push(r.plantId); }
    rec[i * 6] = r.x; rec[i * 6 + 1] = r.y; rec[i * 6 + 2] = r.rot; rec[i * 6 + 3] = r.seed; rec[i * 6 + 4] = idx.get(r.plantId); rec[i * 6 + 5] = r.aux || 0;
  });
  return { rec, ids };
}

/**
 * Tâche d'un worker : une zone (ou des arbres existants) → enregistrements + matrices.
 * job = {zoneId, zone, plants:{id→fiche allégée}, age, density, extra?:[{plantId,x,y,rot,seed}]}
 */
export function runJob(job) {
  const plants = { ...(job.plants || {}), _lawn: LAWN_PLANT };
  const density = job.density ?? 1;
  let list = [];
  if (job.zone) {
    list = placePlants(null, job.zone, plants, { age: job.age, density, walls: job.walls || [] });
    if (job.zone.type === 'lawn') list = list.concat(lawnSpots(job.zone, density));
  }
  if (job.extra) list = list.concat(job.extra);
  const { rec, ids } = packRecords(list);
  const groups = groupsFromRecords(rec, ids, plants, { age: job.age ?? 1, density });
  return { zoneId: job.zoneId, rec, ids, groups, count: list.length };
}

/** Objets transférables (buffers) d'un résultat de `runJob`. */
export function transferablesOf(res) {
  const out = [res.rec.buffer];
  for (const g of res.groups) out.push(g.matrices.buffer, g.tints.buffer);
  return out;
}
