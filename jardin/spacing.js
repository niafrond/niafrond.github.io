// Espacements horticoles (pur, sans DOM) : couches de végétation, distances minimales entre plants, capacité d'une
// zone, répartition des quantités qui PARTAGENT la surface, placement déterministe respectant les distances et
// avertissements d'espacement. Unité : mètres. Partagé par recommend.js, massifs.js, render-common.js et l'UI.
import { shapePolygon, polygonArea, bounds, pointInPolygon, centroid } from './geometry.js';
import { habitOf } from './habits.js';
import { effectivePlant } from './heights.js';
import { polyAxis, wallSegments } from './gl-worker-core.js';

export const LAYERS = ['canopy', 'tall', 'mid', 'low', 'ground', 'aquatic'];
const RANK = { canopy: 0, tall: 1, mid: 2, low: 3, ground: 4, aquatic: 5 };
/** Parts de la surface de sous-étage par couche (adaptables via `opts.shares`). */
export const DEFAULT_SHARES = { tall: 0.20, mid: 0.35, low: 0.30, ground: 0.15 };
const CAP = 2; // plafond des rapports distance / distance minimale
const ROW_HABIT = 'hedge-clipped';

const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const toLookup = (src) => {
  if (typeof src === 'function') return src;
  if (Array.isArray(src)) return (id) => src.find((p) => p && p.id === id);
  return (id) => (src ? src[id] : undefined);
};

// ---------------------------------------------------------------- couches et distances
/** Espacement du catalogue (m) ; repli : largeur adulte, puis 0,5 m. */
export const spacingOf = (p) => Math.max(0.05, num(p && p.spacing, num(p && p.widthAdult, 0.5)));
const widthOf = (p) => num(p && p.widthAdult, spacingOf(p));

/** Couche de végétation : 'canopy' | 'tall' | 'mid' | 'low' | 'ground' | 'aquatic'. */
export function plantLayer(plant) {
  if (!plant) return 'mid';
  const h = num(plant.heightAdult, 0.5);
  switch (plant.category) {
    case 'aquatic': return 'aquatic';
    case 'lawn': case 'groundcover': case 'bulb': return 'ground';
    case 'tree': return 'canopy';
    case 'fruit': return h >= 5 ? 'canopy' : h >= 2.5 ? 'tall' : 'mid';
    case 'hedge': return h >= 2 ? 'tall' : 'mid';
    case 'shrub': return h >= 2.5 ? 'tall' : 'mid';
    case 'climber': return 'mid';
    case 'perennial': return h >= 0.8 ? 'mid' : 'low';
    case 'grass': return h >= 1 ? 'mid' : 'low';
    case 'vegetable': return 'low';
    default: return 'mid';
  }
}

/** Rayon de pied (m) : ≈ 0,25 × largeur adulte, plafonné (0,6 m sous un arbre, 0,4 m sinon). */
export function footRadius(plant) {
  const cap = plantLayer(plant) === 'canopy' ? 0.6 : 0.4;
  return clamp(0.25 * widthOf(plant), 0.03, cap);
}
const isShrubby = (p) => p && (p.category === 'shrub' || p.category === 'hedge' || p.category === 'fruit');
const same = (a, b) => a === b || (a && b && a.id !== undefined && a.id === b.id);

/**
 * Distance minimale centre à centre (m) entre deux plants adultes.
 * Même espèce : espacement du catalogue ; arbres entre eux ≥ 0,7 × largeur adulte moyenne ; arbre ↔ arbuste ≥ 1 m du
 * tronc + rayon de l'arbuste ; arbre ↔ vivace ≥ 0,8 m ; même couche : espacement moyen ; couches différentes : les
 * houppiers peuvent se chevaucher en projection mais pas les pieds (somme des rayons de pied).
 */
export function minDistance(a, b) {
  const la = plantLayer(a); const lb = plantLayer(b);
  const sa = spacingOf(a); const sb = spacingOf(b);
  if (la === 'canopy' && lb === 'canopy') return Math.max(0.7 * (widthOf(a) + widthOf(b)) / 2, (sa + sb) / 2);
  if (la === 'canopy' || lb === 'canopy') {
    const o = la === 'canopy' ? b : a;
    return isShrubby(o) ? 1 + widthOf(o) / 2 : 0.8;
  }
  if (same(a, b)) return sa;
  if (la === lb) return (sa + sb) / 2;
  return Math.max(0.2, footRadius(a) + footRadius(b));
}

/** Distance minimale (m) d'un bâtiment : arbre ≥ max(3 m, 0,5 × hauteur adulte), grand arbuste ≥ 1,5 m, sinon 0. */
export function clearanceFromBuilding(plant, heightM) {
  const l = plantLayer(plant);
  const h = num(heightM, num(plant && plant.heightAdult, 1));
  if (l === 'canopy') return Math.max(3, 0.5 * h);
  if (l === 'tall') return 1.5;
  return 0;
}

/** Marge au bord de la forme (m) : 0,5 × espacement, plafonnée à 0,8 m. */
export const edgeMargin = (plant) => Math.min(0.5 * spacingOf(plant), 0.8);

export function formatSpacing(plant) {
  const s = spacingOf(plant);
  return s < 1 ? `${Math.round(s * 100)} cm` : `${String(Math.round(s * 10) / 10).replace('.', ',')} m`;
}
const fmtM = (n) => `${String(Math.round(n * 10) / 10).replace('.', ',')} m`;

// ---------------------------------------------------------------- géométrie
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax; const dy = by - ay; const l2 = dx * dx + dy * dy;
  const t = l2 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function edgeDist(x, y, poly) {
  let d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) d = Math.min(d, segDist(x, y, poly[j].x, poly[j].y, poly[i].x, poly[i].y));
  return d;
}
const perimeterOf = (poly) => poly.reduce((s, p, i) => s + Math.hypot(p.x - poly[(i + 1) % poly.length].x, p.y - poly[(i + 1) % poly.length].y), 0);
function hash32(s) {
  let h = 2166136261 >>> 0;
  const str = String(s);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  let s = a >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const zonePoly = (zone) => (zone && zone.shape ? shapePolygon(zone.shape, 48) : []);
const lineLength = (pts) => { let L = 0; for (let i = 0; i < pts.length - 1; i++) L += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y); return L; };

/** Surface utile (m²) : surface moins une bande de 25 cm au bord ; 75 % pour un potager (allées). */
export function usableArea(zone, poly = zonePoly(zone)) {
  if (poly.length < 3) return 0;
  const A = polygonArea(poly);
  const u = Math.max(0.4 * A, A - perimeterOf(poly) * 0.25);
  return zone && zone.type === 'vegetable' ? u * 0.75 : u;
}

// ---------------------------------------------------------------- capacité (pavage hexagonal)
/**
 * Nombre maximal de plants de cette essence qui tiennent dans le polygone en respectant l'espacement et la marge au
 * bord (meilleur de plusieurs pavages hexagonaux ou carrés, décalés et orientés). `opts.obstacles` : [{x, y, plant}]
 * (pieds d'arbres déjà posés) ; `opts.margin` remplace la marge par défaut.
 */
export function packingCapacity(poly, plant, opts = {}) {
  if (!poly || poly.length < 3 || !plant) return 0;
  const d = spacingOf(plant);
  const margin = opts.margin != null ? opts.margin : edgeMargin(plant);
  const keep = (opts.obstacles || []).map((o) => ({ x: o.x, y: o.y, r: o.r != null ? o.r : minDistance(o.plant, plant) }));
  const A = polygonArea(poly);
  const b = bounds(poly);
  const est = A * 1.16 / (d * d);
  if (est > 30000) return Math.max(1, Math.floor(Math.max(0, A - perimeterOf(poly) * margin) * 1.1547 / (d * d) * 0.98));
  const ok = (x, y) => {
    if (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY) return false;
    if (!pointInPolygon({ x, y }, poly)) return false;
    if (margin > 0 && edgeDist(x, y, poly) < margin - 1e-9) return false;
    for (const k of keep) if (Math.hypot(x - k.x, y - k.y) < k.r - 1e-9) return false;
    return true;
  };
  const n = est > 2500 ? 1 : est > 600 ? 2 : est > 120 ? 3 : 4;
  const cx = (b.minX + b.maxX) / 2; const cy = (b.minY + b.maxY) / 2;
  const R = Math.hypot(b.width, b.height) / 2 + d;
  let angles = [0];
  if (est <= 600) { const ax = polyAxis(poly).ang; if (Math.abs(Math.sin(ax)) > 0.02) angles = [0, ax]; }
  let best = 0;
  for (const th of angles) {
    for (const kind of est > 2500 ? ['hex'] : ['hex', 'square']) {
      const ux = Math.cos(th) * d; const uy = Math.sin(th) * d;
      const vAng = th + (kind === 'hex' ? Math.PI / 3 : Math.PI / 2);
      const vx = Math.cos(vAng) * d; const vy = Math.sin(vAng) * d;
      const range = Math.ceil(R / (d * (kind === 'hex' ? 0.8 : 1))) + 1;
      for (let sa = 0; sa < n; sa++) {
        for (let sb = 0; sb < n; sb++) {
          const ox = cx + (ux * sa + vx * sb) / n; const oy = cy + (uy * sa + vy * sb) / n;
          let cnt = 0;
          for (let i = -range; i <= range; i++) {
            for (let j = -range; j <= range; j++) if (ok(ox + i * ux + j * vx, oy + i * uy + j * vy)) cnt++;
          }
          if (cnt > best) best = cnt;
        }
      }
    }
  }
  if (best === 0) { // zone trop petite pour la marge : un plant au centre si la zone le permet
    const c = centroid(poly);
    if (ok2(c.x, c.y)) return 1;
    for (let i = 1; i < 10; i++) for (let j = 1; j < 10; j++) if (ok2(b.minX + b.width * i / 10, b.minY + b.height * j / 10)) return 1;
  }
  return best;
  function ok2(x, y) {
    if (!pointInPolygon({ x, y }, poly)) return false;
    for (const k of keep) if (Math.hypot(x - k.x, y - k.y) < k.r - 1e-9) return false;
    return true;
  }
}

// ---------------------------------------------------------------- placement
const isRow = (plant) => habitOf(plant).id === ROW_HABIT;
const isClimber = (plant) => { const id = habitOf(plant).id; return id === 'climber' || id === 'vine'; };
const isBamboo = (plant) => habitOf(plant).id === 'bamboo';

/** Position le long d'une polyligne à l'abscisse curviligne t. */
function alongPath(pts, t) {
  let rest = t;
  for (let i = 0; i < pts.length - 1; i++) {
    const L = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    if (rest <= L || i === pts.length - 2) { const k = L ? clamp(rest / L, 0, 1) : 0; return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * k, y: pts[i].y + (pts[i + 1].y - pts[i].y) * k }; }
    rest -= L;
  }
  return { x: pts[0].x, y: pts[0].y };
}

/** Chemin d'une haie : la ligne de la zone, sinon le grand axe du polygone. */
function rowPath(shape, poly) {
  if (shape.kind === 'line' && shape.points && shape.points.length >= 2) return { pts: shape.points, inset: 0.05, line: true };
  const ax = polyAxis(poly);
  return { pts: [{ x: ax.cx - ax.ux * ax.len / 2, y: ax.cy - ax.uy * ax.len / 2 }, { x: ax.cx + ax.ux * ax.len / 2, y: ax.cy + ax.uy * ax.len / 2 }], inset: 0.3, line: false };
}

/** Plants (essence, quantité) → ordre de pose : couches de haut en bas, essences entremêlées en proportion. */
function interleave(groups, rnd) {
  const left = groups.map((g) => g.n); const seq = [];
  let total = left.reduce((s, n) => s + n, 0);
  while (total > 0) {
    let bi = -1; let bv = -1;
    groups.forEach((g, i) => { if (left[i] > 0) { const v = left[i] / g.n + rnd() * 0.25; if (v > bv) { bv = v; bi = i; } } });
    seq.push(groups[bi]); left[bi]--; total--;
  }
  return seq;
}

/**
 * Place les plants d'une zone (déterministe) en respectant `minDistance` entre tous les plants et la marge au bord.
 * Arbres d'abord, puis arbustes, vivaces, couvre-sols ; haies en rang unique à l'espacement ; bambous en touffes ;
 * grimpantes au pied du mur le plus proche (`opts.garden`) ; potager en rangs.
 * `plantings` : [{plantId, count, height?, width?}] ; `plantsById` : objet, tableau ou fonction.
 * Options : {seed, garden, force (pose quand même les plants qui ne tiennent pas, au mieux), maxima (calcule
 * `maxima[i]` : nombre maximal de l'essence i compte tenu des autres)}.
 * @returns {{positions:{plantId,x,y,gi,forced?,row?,wall?}[], overflow:{plantId,wanted,placed}[], maxima?:number[]}}
 *   `gi` : indice de la ligne dans `plantings`.
 */
export function packZone(zone, plantings, plantsById, opts = {}) {
  const out = { positions: [], overflow: [] };
  const shape = zone && zone.shape;
  const poly = zonePoly(zone);
  if (!shape || poly.length < 3) return out;
  const lookup = toLookup(plantsById);
  const groups = [];
  (plantings || []).forEach((pl, src) => {
    const plant = effectivePlant(lookup(pl.plantId), pl);
    if (!plant || plant.category === 'lawn') return;
    const n = pl.count === undefined || pl.count === null ? 1 : Math.max(0, Math.round(Number(pl.count) || 0));
    if (!n) return;
    groups.push({ idx: groups.length, src, plantId: pl.plantId, plant, n, layer: plantLayer(plant), sp: spacingOf(plant), margin: edgeMargin(plant), placed: 0 });
  });
  if (!groups.length) return out;
  const G = groups.length;
  const M = groups.map((a) => groups.map((b) => minDistance(a.plant, b.plant)));
  const rnd = mulberry32(hash32(`${opts.seed ?? ''}|${zone.id ?? ''}`));
  const placed = []; // {x, y, g}
  const gardenWalls = opts.garden ? wallSegments(opts.garden) : [];
  let X = []; let Y = []; let ED = []; let WALL = []; let C = 0; let nb = []; let hasWallCand = false;

  // ----- potager : rangs réguliers
  if (groups.every((g) => g.plant.category === 'vegetable')) {
    const step = Math.max(...groups.map((g) => g.sp));
    const b = bounds(poly); const pts = [];
    for (let y = b.minY + step / 2; y <= b.maxY; y += step) {
      for (let x = b.minX + step / 2; x <= b.maxX; x += step) if (pointInPolygon({ x, y }, poly) && edgeDist(x, y, poly) >= Math.min(step / 2, 0.3) - 1e-9) pts.push({ x, y });
    }
    const total = groups.reduce((s, g) => s + g.n, 0);
    if (pts.length >= total) {
      const seq = interleave(groups, rnd);
      seq.forEach((g, i) => {
        const p = pts[Math.min(pts.length - 1, Math.floor(((i + 0.5) * pts.length) / total))];
        placed.push({ x: p.x, y: p.y, g: g.idx }); g.placed++;
      });
      return finish();
    }
  }

  // ----- candidats
  const A = polygonArea(poly);
  const minSp = Math.min(...groups.map((g) => g.sp));
  let step = Math.max(Math.min(minSp / 4, 0.25), Math.sqrt(A / 2200), 0.04);
  const b = bounds(poly);
  for (let attempt = 0; attempt < 4; attempt++) {
    X = []; Y = []; ED = [];
    const ox = b.minX + rnd() * step; const oy = b.minY + rnd() * step;
    for (let y = oy; y <= b.maxY; y += step) for (let x = ox; x <= b.maxX; x += step) if (pointInPolygon({ x, y }, poly)) { X.push(x); Y.push(y); ED.push(edgeDist(x, y, poly)); }
    if (X.length >= 6) break;
    step /= 2;
  }
  if (!X.length) { const c = centroid(poly); X.push(c.x); Y.push(c.y); ED.push(Math.max(0, edgeDist(c.x, c.y, poly))); }
  WALL = new Array(X.length).fill(0);
  // candidats « au pied d'un mur » pour les grimpantes
  const hasClimber = groups.some((g) => isClimber(g.plant));
  if (hasClimber && gardenWalls.length) {
    const cen = centroid(poly);
    for (const w of gardenWalls) {
      const L = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
      if (L < 0.2) continue;
      let nx = -(w.b.y - w.a.y) / L; let ny = (w.b.x - w.a.x) / L;
      const mx = (w.a.x + w.b.x) / 2; const my = (w.a.y + w.b.y) / 2;
      if ((cen.x - mx) * nx + (cen.y - my) * ny < 0) { nx = -nx; ny = -ny; }
      const ns = Math.max(1, Math.round(L / 0.1));
      for (let i = 0; i <= ns; i++) {
        const t = 0.02 + 0.96 * i / ns;
        const px = w.a.x + (w.b.x - w.a.x) * t + nx * 0.22; const py = w.a.y + (w.b.y - w.a.y) * t + ny * 0.22;
        const inside = pointInPolygon({ x: px, y: py }, poly);
        if (inside || edgeDist(px, py, poly) <= 0.6) { X.push(px); Y.push(py); ED.push(inside ? edgeDist(px, py, poly) : 0); WALL.push(1); hasWallCand = true; }
      }
    }
  }
  C = X.length;
  nb = groups.map(() => new Float32Array(C).fill(CAP));

  // candidats rangés en cases de 0,5 m : une pose ne met à jour que les voisins utiles
  const CS = 0.5; const cells = new Map();
  const cellKey = (ix, iy) => (ix + 64) * 16384 + (iy + 64);
  for (let c = 0; c < C; c++) {
    const k = cellKey(Math.floor((X[c] - b.minX) / CS), Math.floor((Y[c] - b.minY) / CS));
    const l = cells.get(k); if (l) l.push(c); else cells.set(k, [c]);
  }
  const commit = (g, x, y, extra = {}) => {
    placed.push({ x, y, g: g.idx, ...extra });
    if (!extra.forced) g.placed++;
    for (let h = 0; h < G; h++) {
      const m = M[h][g.idx]; const lim = CAP * m; const arr = nb[h];
      const x0 = Math.floor((x - lim - b.minX) / CS); const x1 = Math.floor((x + lim - b.minX) / CS);
      const y0 = Math.floor((y - lim - b.minY) / CS); const y1 = Math.floor((y + lim - b.minY) / CS);
      for (let ix = x0; ix <= x1; ix++) {
        for (let iy = y0; iy <= y1; iy++) {
          const l = cells.get(cellKey(ix, iy));
          if (!l) continue;
          for (let q = 0; q < l.length; q++) {
            const c = l[q]; const dx = X[c] - x; const dy = Y[c] - y;
            const r = Math.sqrt(dx * dx + dy * dy) / m;
            if (r < arr[c]) arr[c] = r;
          }
        }
      }
    }
  };
  // plants déjà posés qui bloquent un point précis (rangs de haie)
  const clearAt = (g, x, y) => { for (const q of placed) if (Math.hypot(q.x - x, q.y - y) < M[g.idx][q.g] - 1e-9) return false; return true; };

  // ----- rangs de haies taillées (rang unique le long du grand axe ou de la ligne)
  const rows = groups.filter((g) => isRow(g.plant));
  if (rows.length) {
    const path = rowPath(shape, poly);
    const L = lineLength(path.pts);
    const seq = interleave(rows, rnd);
    let need = 0;
    for (let i = 1; i < seq.length; i++) need += M[seq[i - 1].idx][seq[i].idx];
    const usable = Math.max(0, L - 2 * path.inset);
    let t = path.inset + Math.max(0, (usable - need) / 2);
    let k = 0;
    for (; k < seq.length; k++) {
      if (k > 0) t += M[seq[k - 1].idx][seq[k].idx];
      if (t > L - path.inset + 1e-9) break;
      const p = alongPath(path.pts, t);
      if (!path.line && !pointInPolygon(p, poly)) continue;
      if (!clearAt(seq[k], p.x, p.y)) continue;
      commit(seq[k], p.x, p.y, { row: true });
    }
  }

  // ----- pose générale
  const rest = groups.filter((g) => !isRow(g.plant));
  const order = [];
  for (const layer of LAYERS) {
    const gs = rest.filter((g) => g.layer === layer);
    if (gs.length) order.push(...interleave(gs, rnd));
  }
  // arbres (et plants isolés) : attirés vers le centre de la forme
  const cen0 = centroid(poly); const diag = Math.max(0.5, Math.hypot(b.width, b.height));
  const nTotal = groups.reduce((t, g) => t + g.n, 0);
  const pickFor = (g, relaxed) => {
    const pull = g.layer === 'canopy' || nTotal <= 3 ? 0.15 : 0;
    const climbWall = hasWallCand && isClimber(g.plant);
    const anchor = isBamboo(g.plant) && g.placed ? placed.filter((q) => q.g === g.idx).reduce((s, q, _, a) => ({ x: s.x + q.x / a.length, y: s.y + q.y / a.length }), { x: 0, y: 0 }) : null;
    let best = -1; let bestV = -Infinity;
    const arr = nb[g.idx];
    for (let c = 0; c < C; c++) {
      if (arr[c] < 1 - 1e-9) continue;
      let e;
      if (WALL[c]) { if (!climbWall) continue; e = CAP; } else if (climbWall) continue; else e = relaxed ? (ED[c] > 0.01 ? CAP : -1) : ED[c] / g.margin;
      if (e < 1 - 1e-9) continue;
      const v = anchor ? -Math.hypot(X[c] - anchor.x, Y[c] - anchor.y) + rnd() * 0.02
        : Math.min(arr[c], e, CAP) + rnd() * 0.03 + (pull ? pull * (1 - Math.hypot(X[c] - cen0.x, Y[c] - cen0.y) / diag) : 0);
      if (v > bestV) { bestV = v; best = c; }
    }
    return best;
  };
  const forceFor = (g) => {
    let best = -1; let bestV = -Infinity;
    const arr = nb[g.idx];
    for (let c = 0; c < C; c++) {
      if (WALL[c] || ED[c] <= 0.01) continue;
      const v = arr[c] + rnd() * 0.02;
      if (v > bestV) { bestV = v; best = c; }
    }
    return best >= 0 ? best : 0;
  };
  for (const g of order) {
    let c = pickFor(g, false);
    if (c < 0) c = pickFor(g, true);
    if (c >= 0) { commit(g, X[c], Y[c], WALL[c] ? { wall: true } : {}); continue; }
    if (opts.force) { const f = forceFor(g); commit(g, X[f], Y[f], { forced: true }); }
  }
  return finish();

  function finish() {
    for (const g of groups) {
      let k = 0;
      for (const q of placed) if (q.g === g.idx) { out.positions.push({ plantId: g.plantId, x: q.x, y: q.y, gi: g.src, k: k++, ...(q.forced ? { forced: true } : {}), ...(q.row ? { row: true } : {}), ...(q.wall ? { wall: true } : {}) }); }
      if (g.placed < g.n) out.overflow.push({ plantId: g.plantId, wanted: g.n, placed: g.placed, gi: g.src });
    }
    if (opts.maxima) out.maxima = maximaOf();
    return out;
  }

  /** Nombre maximal de chaque essence compte tenu de ce qui est déjà posé (les autres lignes restent inchangées). */
  function maximaOf() {
    const res = (plantings || []).map(() => 0);
    if (!C) return res;
    for (const g of groups) {
      let extra = 0;
      if (g.placed >= g.n && !isRow(g.plant)) {
        const tmp = Float32Array.from(nb[g.idx]);
        const m = M[g.idx][g.idx];
        const climbWall = hasWallCand && isClimber(g.plant);
        for (; extra < 80; extra++) {
          let best = -1; let bv = -1;
          for (let c = 0; c < C; c++) {
            if (tmp[c] < 1 - 1e-9) continue;
            if (WALL[c] ? !climbWall : climbWall) continue;
            if (!WALL[c] && ED[c] < g.margin - 1e-9) continue;
            if (tmp[c] > bv) { bv = tmp[c]; best = c; }
          }
          if (best < 0) break;
          for (let c = 0; c < C; c++) { const r = Math.hypot(X[c] - X[best], Y[c] - Y[best]) / m; if (r < tmp[c]) tmp[c] = r; }
        }
      }
      res[g.src] = g.placed + extra;
    }
    return res;
  }
}

/**
 * Ramène les quantités à ce qui tient réellement (aucun dépassement) : renvoie de nouvelles plantations
 * (lignes ramenées à 0 retirées) ; ne modifie pas `plantings`.
 */
export function fitQuantities(zone, plantings, plantsById, opts = {}) {
  let cur = (plantings || []).map((pl) => ({ ...pl }));
  for (let it = 0; it < 8; it++) {
    const r = packZone({ ...zone, plantings: cur }, cur, plantsById, opts);
    if (!r.overflow.length) break;
    for (const o of r.overflow) {
      const pl = cur[o.gi];
      if (pl) pl.count = it < 5 ? o.placed : Math.max(0, Math.min(o.placed, (Number(pl.count) || 1) - 1));
    }
    cur = cur.filter((pl) => pl.count === undefined || Number(pl.count) > 0);
  }
  return cur;
}

// ---------------------------------------------------------------- répartition des quantités
/**
 * Quantités par essence qui PARTAGENT la surface d'une zone : la couronne des arbres est réservée d'abord
 * (`floor(surface_utile × 0,8 / π(largeur/2)²)`, au moins 1 si la zone le permet, pas plus d'un arbre par espacement²),
 * puis la surface restante est répartie par couches (haut 20 %, milieu 35 %, bas 30 %, sol 15 %), chaque essence recevant
 * `part / espacement²` plants, jamais plus que la capacité (pieds d'arbres déduits). Une haie taillée = un rang unique.
 * `species` : essences (ou {plant}). Options : {shares, layerOf (clé de couche personnalisée), seed}.
 * @returns {{plantId, count}[]} dans l'ordre de `species` (0 = ne tient pas).
 */
export function allocateQuantities(zone, species, opts = {}) {
  const plants = (species || []).map((s) => (s && s.plant) || s);
  const out = plants.map((p) => ({ plantId: p.id, count: 0 }));
  const poly = zonePoly(zone);
  if (poly.length < 3) return out.map((o) => ({ ...o, count: 1 }));
  const layerOf = opts.layerOf || plantLayer;
  const shares = opts.shares || DEFAULT_SHARES;
  const usable = usableArea(zone, poly);
  const idx = { lawn: [], row: [], tree: [], under: [] };
  plants.forEach((p, i) => {
    if (p.category === 'lawn') idx.lawn.push(i);
    else if (isRow(p) && !opts.layerOf) idx.row.push(i);
    else if (layerOf(p) === 'canopy') idx.tree.push(i);
    else idx.under.push(i);
  });
  for (const i of idx.lawn) out[i].count = 1;

  // couronne des arbres
  let crown = 0; let obstacles = [];
  if (idx.tree.length) {
    const nT = idx.tree.length;
    for (const i of idx.tree) {
      const p = plants[i]; const c = Math.PI * (widthOf(p) / 2) ** 2;
      const byCrown = Math.floor(usable * 0.8 / nT / c + 1e-9);
      const bySp = Math.max(1, Math.floor(usable / (spacingOf(p) ** 2) + 1e-9));
      out[i].count = Math.max(1, Math.min(byCrown, bySp));
    }
    const byId = (id) => plants.find((p) => p.id === id);
    let pl = idx.tree.map((i) => ({ plantId: plants[i].id, count: out[i].count }));
    let r = null;
    for (let it = 0; it < 12; it++) {
      r = packZone({ ...zone, plantings: pl }, pl, byId, { seed: opts.seed });
      if (!r.overflow.length) break;
      for (const o of r.overflow) pl[o.gi].count = o.placed;
      pl = pl.filter((x) => x.count > 0);
      if (!pl.length) { r = { positions: [] }; break; }
    }
    idx.tree.forEach((i) => { out[i].count = 0; });
    for (const x of pl) { const i = idx.tree.find((k) => plants[k].id === x.plantId); if (i !== undefined) out[i].count = x.count; }
    obstacles = (r && r.positions ? r.positions : []).map((q) => ({ x: q.x, y: q.y, plant: byId(q.plantId) }));
    crown = idx.tree.reduce((s, i) => s + out[i].count * Math.PI * (widthOf(plants[i]) / 2) ** 2, 0);
  }
  const R = idx.tree.length && crown > 0 ? Math.max(usable - crown, 0.2 * usable) : usable;

  // haies taillées : un rang unique
  if (idx.row.length) {
    const path = rowPath(zone.shape, poly);
    const L = lineLength(path.pts);
    const avg = idx.row.reduce((s, i) => s + spacingOf(plants[i]), 0) / idx.row.length;
    const total = Math.max(1, Math.floor((L - 2 * path.inset) / avg + 1e-9) + 1);
    for (const i of idx.row) out[i].count = Math.max(1, Math.floor(total / idx.row.length));
  }

  // sous-étage par couches
  const byLayer = {};
  for (const i of idx.under) (byLayer[layerOf(plants[i])] ||= []).push(i);
  const keys = Object.keys(byLayer);
  const shareOf = (k) => (shares[k] > 0 ? shares[k] : 0.3);
  const totalShare = keys.reduce((s, k) => s + shareOf(k), 0) || 1;
  for (const k of keys) {
    const part = R * shareOf(k) / totalShare;
    for (const i of byLayer[k]) {
      const p = plants[i];
      const raw = part / byLayer[k].length / (spacingOf(p) ** 2);
      let n = Math.round(raw);
      // borne haute analytique (pavage hexagonal parfait) : le calcul exact n'est utile que si la quantité s'en approche
      const upper = Math.floor(Math.max(0, usable) * 1.1547 / (spacingOf(p) ** 2) + perimeterOf(poly) / spacingOf(p)) + 1;
      const cap = n > 0.5 * upper || obstacles.length ? packingCapacity(poly, p, { obstacles }) : n;
      if (cap >= 1) n = Math.max(1, n);
      out[i].count = Math.max(0, Math.min(n, cap));
    }
  }
  return out;
}

// ---------------------------------------------------------------- avertissements
const cache = new Map();
function spacingKey(garden, zone, plantings, lookup) {
  const pls = (plantings || []).map((pl) => {
    const p = lookup(pl.plantId);
    return [pl.plantId, pl.count, pl.height, pl.width, p && [p.spacing, p.widthAdult, p.heightAdult, p.category, p.habit]];
  });
  const g = garden ? [garden.obstacles, garden.boundary, garden.boundaryClosed, garden.boundaryEdges] : null;
  return JSON.stringify([zone.shape, zone.type, zone.id, pls, g]);
}

/** Pose d'une zone avec mémoire (mêmes entrées, mêmes positions) : utilisée par les avertissements et l'interface. */
export function zoneLayout(garden, zone, plantsById) {
  const lookup = toLookup(plantsById);
  const pls = zone.plantings || [];
  const key = spacingKey(garden, zone, pls, lookup);
  let hit = cache.get(key);
  if (!hit) {
    hit = packZone(zone, pls, lookup, { garden, force: true, maxima: true });
    cache.set(key, hit);
    if (cache.size > 300) cache.delete(cache.keys().next().value);
  }
  return hit;
}

const name = (p) => (p && (p.commonName || p.id)) || 'Plante';
function polyDist(x, y, poly) { return pointInPolygon({ x, y }, poly) ? 0 : edgeDist(x, y, poly); }

/**
 * Avertissements d'espacement d'une zone.
 * @returns {{level:'warn'|'info', zoneId, plantId?, text, kind:'surdensite'|'arbres-proches'|'pied-arbre'|'batiment'|'bord'}[]}
 */
export function checkSpacing(garden, zone, plantsById) {
  const res = [];
  if (!zone || !zone.shape || !(zone.plantings || []).length) return res;
  const lookup = toLookup(plantsById);
  const lay = zoneLayout(garden, zone, lookup);
  const zid = zone.id;
  const pls = zone.plantings || [];
  const plantOf = (gi) => effectivePlant(lookup(pls[gi].plantId), pls[gi]);

  for (const o of lay.overflow) {
    const p = plantOf(o.gi);
    res.push({ level: 'warn', zoneId: zid, plantId: o.plantId, kind: 'surdensite',
      text: `${name(p)} : ${o.wanted} plants ne tiennent pas, ${o.placed} maximum avec ${formatSpacing(p)} d'espacement` });
  }
  const pos = lay.positions.map((q) => ({ ...q, plant: plantOf(q.gi) })).filter((q) => q.plant);
  // arbres trop proches / pieds sous le houppier
  const trees = pos.filter((q) => plantLayer(q.plant) === 'canopy');
  const seen = new Set();
  for (let i = 0; i < trees.length; i++) {
    for (let j = i + 1; j < trees.length; j++) {
      const d = Math.hypot(trees[i].x - trees[j].x, trees[i].y - trees[j].y); const need = minDistance(trees[i].plant, trees[j].plant);
      if (d < need - 0.05) {
        const key = `${trees[i].plantId}|${trees[j].plantId}`;
        if (seen.has(key)) continue; seen.add(key);
        const a = name(trees[i].plant); const b = name(trees[j].plant);
        res.push({ level: 'warn', zoneId: zid, plantId: trees[i].plantId, kind: 'arbres-proches',
          text: a === b ? `Deux ${a} à ${fmtM(d)} : prévoir ${fmtM(need)}` : `${a} et ${b} à ${fmtM(d)} : prévoir ${fmtM(need)}` });
      }
    }
  }
  const seenFoot = new Set();
  for (const q of pos) {
    if (plantLayer(q.plant) === 'canopy') continue;
    for (const t of trees) {
      const d = Math.hypot(q.x - t.x, q.y - t.y); const need = minDistance(t.plant, q.plant);
      if (d < need - 0.05) {
        const key = `${q.plantId}|${t.plantId}`;
        if (seenFoot.has(key)) continue; seenFoot.add(key);
        res.push({ level: 'warn', zoneId: zid, plantId: q.plantId, kind: 'pied-arbre',
          text: `${name(q.plant)} à ${fmtM(d)} du tronc de ${name(t.plant)} : prévoir ${fmtM(need)}` });
      }
    }
  }
  // bâtiments et limite de propriété
  const builds = ((garden && garden.obstacles) || []).filter((o) => (o.kind === 'house' || o.kind === 'shed') && o.points && o.points.length >= 3);
  const bound = garden && garden.boundaryClosed !== false && garden.boundary && garden.boundary.length >= 3 ? garden.boundary : null;
  const seenB = new Set(); const seenE = new Set();
  for (const q of pos) {
    const need = clearanceFromBuilding(q.plant, q.plant.heightAdult);
    if (need > 0) {
      for (const bd of builds) {
        const d = polyDist(q.x, q.y, bd.points);
        const key = `${q.plantId}|${bd.id}`;
        if (d < need - 0.05 && !seenB.has(key)) {
          seenB.add(key);
          res.push({ level: 'warn', zoneId: zid, plantId: q.plantId, kind: 'batiment',
            text: `${name(q.plant)} à ${fmtM(d)} de ${bd.kind === 'house' ? 'la maison' : 'l’abri'} : prévoir ${fmtM(need)}` });
        }
      }
    }
    if (bound && plantLayer(q.plant) === 'canopy' && !seenE.has(q.plantId)) {
      const d = edgeDist(q.x, q.y, bound);
      if (pointInPolygon({ x: q.x, y: q.y }, bound) && d < 2 && num(q.plant.heightAdult, 0) > 2) {
        seenE.add(q.plantId);
        res.push({ level: 'info', zoneId: zid, plantId: q.plantId, kind: 'bord',
          text: `${name(q.plant)} à ${fmtM(d)} de la limite du terrain : un arbre de plus de 2 m se plante à 2 m au moins de la limite` });
      }
    }
  }
  return res;
}
