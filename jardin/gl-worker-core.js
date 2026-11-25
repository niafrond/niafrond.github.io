// Cœur pur de la vue 3D : répartition des plants et matrices d'instances (sans DOM, sans three.js).
// Importé par le Web Worker `gl-worker.js` ET par le repli synchrone / les tests. Repère : x = plan x, z = plan y, y = haut.
import { shapePolygon, polygonArea, centroid, bounds, pointInPolygon } from './geometry.js';

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
export function slimPlant(p) {
  return {
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
export function placePlants(garden, zone, plantsById, { age = 1, density = 1 } = {}) {
  void garden; void age;
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
    const plant = get(pl.plantId);
    if (!plant) continue;
    const kind = kindOf(plant);
    const c = Math.max(1, Math.round(Number(pl.count ?? pl.quantity) || 1));
    let n = Math.min(c, 250);
    if (kind === 'lawn') n = 0; // le gazon est rendu par la zone (touffes + texture)
    else if (kind === 'mound' && plant.heightAdult < 0.4 && plant.category === 'groundcover') {
      const w = Math.max(0.3, plant.widthAdult * 0.8);
      n = clamp(Math.round((isLine ? len * (shape.width || 1) : area) / (w * w) * density), c, MAX_PAR_ESSENCE);
    } else if ((kind === 'hedge' || kind === 'conifer') && isLine && plant.category === 'hedge') {
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

function emitPlant(G, rec, plant, age, density) {
  const { x, y: z, rot, seed } = rec;
  const rng = mulberry32(Math.floor(seed * 4294967295) + 1);
  const kind = kindOf(plant);
  const hf = heightFactor(age); const wf = widthFactor(age);
  const H = Math.max(0.05, plant.heightAdult * hf * (0.92 + rng() * 0.16));
  const W = Math.max(0.1, plant.widthAdult * wf * (0.92 + rng() * 0.16));
  const id = plant.id;
  const tint = () => 0.82 + rng() * 0.3;
  const hasBloom = plant.bloom && plant.bloom.length && plant.flowerColor;
  const nFlowers = (base) => (hasBloom ? Math.max(1, Math.round(base * density)) : 0);
  const fs = clamp(W * 0.028, 0.035, 0.1); // taille d'une fleur (rayon)

  if (kind === 'tree') {
    const fruit = plant.category === 'fruit';
    const trunkH = H * (fruit ? 0.3 : 0.38);
    const r = clamp(0.03 * H + 0.012 * W, 0.04, 0.55) * (0.85 + rng() * 0.3);
    G.push(id, 'trunk', 1, x, 0, z, rot, 0, r, trunkH * 1.08, r);
    const R = W / 2; const base = trunkH * 0.78; const ch = H - base;
    G.push(id, 'crown', tint(), x, base + ch * 0.52, z, rng() * 6.28, 0, R * 0.82, ch * 0.5, R * 0.82);
    G.push(id, 'crown', tint(), x, base + ch * 0.8, z, rng() * 6.28, 0, R * 0.52, ch * 0.28, R * 0.52);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + rng() * 0.8; const d = R * (0.42 + rng() * 0.12);
      const hh = base + ch * (0.3 + rng() * 0.25);
      G.push(id, 'crown', tint(), x + Math.cos(a) * d, hh, z + Math.sin(a) * d, rng() * 6.28, 0, R * (0.5 + rng() * 0.14), ch * (0.3 + rng() * 0.1), R * (0.5 + rng() * 0.14));
    }
    // branches (visibles hors feuillage)
    for (let k = 0; k < 11; k++) {
      const a = (k / 11) * Math.PI * 2 + rng(); const tilt = 0.5 + rng() * 0.55;
      const len = ch * (0.5 + rng() * 0.35);
      G.push(id, 'branch', 1, x, trunkH * (0.78 + rng() * 0.22), z, a, tilt, r * 0.3, len, r * 0.3);
    }
    for (let k = 0; k < 16; k++) {
      const a = rng() * Math.PI * 2; const tilt = 0.7 + rng() * 0.6;
      G.push(id, 'branch', 1, x + Math.cos(a) * R * 0.25, base + ch * (0.25 + rng() * 0.3), z + Math.sin(a) * R * 0.25, a, tilt, r * 0.11, ch * (0.22 + rng() * 0.2), r * 0.11);
    }
    const nf = nFlowers(fruit ? 22 : 16);
    for (let k = 0; k < nf; k++) {
      const [px, py, pz] = pointOnCrown(rng, R * 0.88, ch * 0.5, R * 0.88);
      G.push(id, 'flower', 1, x + px, base + ch * 0.55 + py, z + pz, 0, 0, fs * 1.1, fs * 1.1, fs * 1.1);
    }
  } else if (kind === 'conifer') {
    const R = W / 2; const r = clamp(0.025 * H, 0.04, 0.3);
    G.push(id, 'trunk', 1, x, 0, z, rot, 0, r, H * 0.14, r);
    for (let k = 0; k < 3; k++) {
      G.push(id, 'cone', tint(), x, H * (0.05 + 0.27 * k), z, rng() * 6.28, 0, R * (1 - 0.3 * k) * (0.94 + rng() * 0.1), H * (0.52 - 0.04 * k), R * (1 - 0.3 * k) * (0.94 + rng() * 0.1));
    }
  } else if (kind === 'shrub' || kind === 'hedge') {
    const R = W / 2; const hedge = kind === 'hedge';
    G.push(id, 'crown', tint(), x, H * 0.5, z, rng() * 6.28, 0, R * (hedge ? 0.98 : 0.85), H * (hedge ? 0.5 : 0.5), R * (hedge ? 0.9 : 0.85));
    const nb = hedge ? 2 : 3;
    for (let k = 0; k < nb; k++) {
      const a = rng() * Math.PI * 2; const d = R * (hedge ? 0.35 : 0.4);
      G.push(id, 'crown', tint(), x + Math.cos(a) * d, H * (0.34 + rng() * 0.2), z + Math.sin(a) * d, rng() * 6.28, 0, R * (0.55 + rng() * 0.12), H * (0.32 + rng() * 0.1), R * (0.55 + rng() * 0.12));
    }
    const tk = 0.012 * H + 0.008;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + rng(); const tilt = 0.18 + rng() * 0.5;
      G.push(id, 'branch', 1, x, 0, z, a, tilt, tk, H * (0.7 + rng() * 0.3), tk);
    }
    const nf = nFlowers(hedge ? 8 : 12);
    for (let k = 0; k < nf; k++) {
      const [px, py, pz] = pointOnCrown(rng, R * 0.9, H * 0.46, R * 0.85);
      G.push(id, 'flower', 1, x + px, H * 0.52 + py, z + pz, 0, 0, fs, fs, fs);
    }
  } else if (kind === 'mound') {
    const R = W / 2;
    G.push(id, 'crown', tint(), x, H * 0.35, z, rng() * 6.28, 0, R, Math.max(H * 0.5, 0.03), R);
    const nf = nFlowers(6);
    for (let k = 0; k < nf; k++) {
      const a = rng() * Math.PI * 2; const d = Math.sqrt(rng()) * R * 0.8;
      G.push(id, 'flower', 1, x + Math.cos(a) * d, H * 0.7 + 0.01, z + Math.sin(a) * d, 0, 0, Math.min(fs, 0.06), Math.min(fs, 0.06), Math.min(fs, 0.06));
    }
  } else if (kind === 'lawn') {
    const s = 0.7 + rng() * 0.7;
    G.push(id, 'tuft', tint(), x, 0, z, rot, 0, 0.1 * s, 0.16 * s, 0.1 * s);
  } else { // tuft | grass
    const R = W / 2;
    G.push(id, 'tuft', tint(), x, 0, z, rot, 0, R, H, R);
    if (kind === 'tuft' || R > 0.25) G.push(id, 'tuft', tint(), x + Math.cos(rot) * R * 0.3, 0, z + Math.sin(rot) * R * 0.3, rot + 1.1, 0, R * 0.72, H * (0.82 + rng() * 0.12), R * 0.72);
    const nf = nFlowers(kind === 'grass' ? 4 : 6);
    for (let k = 0; k < nf; k++) {
      const a = rng() * Math.PI * 2; const d = Math.sqrt(rng()) * R * 0.55;
      G.push(id, 'flower', 1, x + Math.cos(a) * d, H * (0.78 + rng() * 0.22), z + Math.sin(a) * d, 0, 0, Math.min(fs * 1.2, 0.09), Math.min(fs * 1.2, 0.09), Math.min(fs * 1.2, 0.09));
    }
  }
}

/** Matrices d'instances groupées par (essence, partie) à partir des enregistrements. Pur et déterministe. */
export function groupsFromRecords(rec, ids, plants, { age = 1, density = 1 } = {}) {
  const G = new Groupes();
  for (let i = 0; i < rec.length; i += 5) {
    const plant = plants[ids[rec[i + 4]]];
    if (!plant) continue;
    emitPlant(G, { x: rec[i], y: rec[i + 1], rot: rec[i + 2], seed: rec[i + 3] }, plant, age, density);
  }
  return G.finish();
}

/** Empaquette des enregistrements de placement en `Float32Array` (x, y, rot, seed, indexEssence). */
export function packRecords(list) {
  const ids = []; const idx = new Map();
  const rec = new Float32Array(list.length * 5);
  list.forEach((r, i) => {
    if (!idx.has(r.plantId)) { idx.set(r.plantId, ids.length); ids.push(r.plantId); }
    rec[i * 5] = r.x; rec[i * 5 + 1] = r.y; rec[i * 5 + 2] = r.rot; rec[i * 5 + 3] = r.seed; rec[i * 5 + 4] = idx.get(r.plantId);
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
    list = placePlants(null, job.zone, plants, { age: job.age, density });
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
