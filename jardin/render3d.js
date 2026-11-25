// Vues du jardin sous différents angles : axonométrie depuis chaque coin, élévations de face.
// renderViewSVG(garden, opts) → string SVG autonome (pur, sans DOM). Projection orthographique + algorithme du peintre.
import { renderPlanSVG, plantKind, leafPath } from './render.js';
import { shapePolygon, bounds, centroid, signedArea, pointInPolygon, polygonArea } from './geometry.js';
import { getZoneType, isAbovePool } from './model.js';
import { getPlant } from './catalog.js';
import { culmColor, hedgeSeg, familyOf } from './gl-worker-core.js';
import { habitOf, habitParams } from './habits.js';
import {
  FONT, BARE_WOOD, BARE_HERB, esc, f, darken, lighten, mixHex, rng, rngOf, hash32, normMonth, monthLabel, plantState,
  placePlants, shadowDir, GradRegistry, buildLegendItems, makeFrame, northSVG, scaleBarSVG, cartoucheSVG, captionSVG,
  patternDefs, usedZoneTypes, lawnPatternDef, plantHeightM, describePlan,
} from './render-common.js';

// Module des aménagements (écrit en parallèle) : optionnel, le rendu marche sans.
let ITEMS = null;
try { ITEMS = await import('./items.js'); } catch { ITEMS = null; }
// Plantes et clôtures existantes déclarées (existing.js) : import défensif, repli = aucune.
let EXISTING = null;
try { EXISTING = await import('./existing.js'); } catch { EXISTING = null; }
const existingList = (garden, override) => {
  if (Array.isArray(override)) return override;
  try { return (EXISTING && EXISTING.existingForRender && EXISTING.existingForRender(garden)) || []; } catch { return []; }
};
/** Matériau effectif (défaut : bois pour une clôture, béton pour un mur). */
const MATS = { wall: ['stone', 'concrete', 'brick'], fence: ['wood', 'metal', 'concrete', 'mesh'] };
const matOf = (kind, m) => ((MATS[kind] || []).includes(m) ? m : (kind === 'wall' ? 'concrete' : 'wood'));
const MAT_STYLE = {
  wood: { wall: '#a0724a', roof: '#b98558', alpha: 1, slats: 1, post: '#6d4c36' },
  metal: { wall: '#4a5459', roof: '#3b4348', alpha: 0.5, bars: 1, post: '#2f3a40' },
  concrete: { wall: '#c8c8c3', roof: '#d6d6d1', alpha: 1, joints: 1, post: '#b5b5b0' },
  mesh: { wall: '#9aa6ab', roof: '#8a979c', alpha: 0.28, mesh: 1, post: '#7b868b' },
  stone: { wall: '#a89f91', roof: '#bdb4a6', alpha: 1, courses: 1, post: '#8f877a' },
  brick: { wall: '#b5593c', roof: '#c9694a', alpha: 1, courses: 2, post: '#8f3f29' },
};

export const VIEWS = [
  { id: 'top', label: 'Dessus' },
  { id: 'iso-ne', label: 'Iso NE' },
  { id: 'iso-se', label: 'Iso SE' },
  { id: 'iso-sw', label: 'Iso SO' },
  { id: 'iso-nw', label: 'Iso NO' },
  { id: 'front-s', label: 'Face S' },
  { id: 'front-w', label: 'Face O' },
  { id: 'front-n', label: 'Face N' },
  { id: 'front-e', label: 'Face E' },
];
const VIEW_TEXT = {
  top: 'vue de dessus', 'iso-ne': 'isométrique depuis le nord-est', 'iso-se': 'isométrique depuis le sud-est',
  'iso-sw': 'isométrique depuis le sud-ouest', 'iso-nw': 'isométrique depuis le nord-ouest',
  'front-s': 'élévation vue du sud', 'front-w': 'élévation vue de l’ouest', 'front-n': 'élévation vue du nord', 'front-e': 'élévation vue de l’est',
};
/** Direction (est, nord) de la caméra : d'où l'on regarde. */
const CAMS = {
  'iso-ne': [1, 1], 'iso-se': [1, -1], 'iso-sw': [-1, -1], 'iso-nw': [-1, 1],
  'front-s': [0, -1], 'front-w': [-1, 0], 'front-n': [0, 1], 'front-e': [1, 0],
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const PI2 = Math.PI * 2;
const LIGHT = (() => { const v = [-0.5, -0.5, 0.72]; const n = Math.hypot(...v); return v.map((x) => x / n); })(); // soleil au sud-ouest

function makeCamera(view, northAngle, elevDeg) {
  const a = (northAngle * Math.PI) / 180;
  const E = { x: Math.cos(a), y: Math.sin(a) };
  const N = { x: Math.sin(a), y: -Math.cos(a) };
  const [ce, cn] = CAMS[view];
  const l = Math.hypot(ce, cn);
  const C = { e: ce / l, n: cn / l };
  const D = { e: -C.e, n: -C.n };
  const R = { e: D.n, n: -D.e };
  const th = (elevDeg * Math.PI) / 180;
  const cs = Math.cos(th); const sn = Math.sin(th);
  const comp = (x, y) => ({ e: x * E.x + y * E.y, n: x * N.x + y * N.y });
  return {
    C, D, R, cs, sn, th,
    comp,
    depth: (x, y) => { const c = comp(x, y); return c.e * D.e + c.n * D.n; },
    /** [sx, sy, profondeur] en mètres-écran (sy vers le bas). */
    proj(x, y, z) {
      const c = comp(x, y);
      const dp = c.e * D.e + c.n * D.n;
      return [c.e * R.e + c.n * R.n, -(z * cs + dp * sn), dp];
    },
    /** Normale plane → boussole. */
    nComp: (nx, ny) => comp(nx, ny),
    facing(nx, ny) { const c = comp(nx, ny); return c.e * C.e + c.n * C.n; },
  };
}

function shade(hex, n3) {
  const d = n3[0] * LIGHT[0] + n3[1] * LIGHT[1] + n3[2] * LIGHT[2];
  const k = clamp(0.55 + 0.5 * Math.max(0, d), 0.5, 1.03);
  return k < 1 ? darken(hex, 1 - k) : lighten(hex, (k - 1) * 4);
}

function hull(points) {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo = []; for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  const up = []; for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

/** Piscine hors sol : hauteur de paroi et niveau de l'eau (m). */
const ABOVE_POOL_H = 1.2;
const ABOVE_POOL_WATER_H = 1.05;

const ITEM_H = {
  bench: 0.45, table: 0.75, table_round: 0.75, chair: 0.9, lounge: 0.6, sunbed: 0.35, hammock: 1.6, bbq: 0.9, firepit: 0.35,
  composter: 0.9, rain_tank: 1.5, planter: 0.5, raised_bed: 0.4, woodpile: 1.3, clothesline: 1.8, mailbox: 1.1, light: 2.2,
  fountain: 1, swing: 2.3, trampoline: 0.9, sandbox: 0.25, playhouse: 1.8, shed_item: 2.3, greenhouse: 2, pergola: 2.4, gazebo: 2.5, parasol: 2.5,
};

function rectPoly(it) {
  const w = (it.width || 0.5) / 2; const d = (it.depth || 0.5) / 2; const a = ((it.rotation || 0) * Math.PI) / 180;
  const c = Math.cos(a); const s = Math.sin(a);
  return [[-w, -d], [w, -d], [w, d], [-w, d]].map(([lx, ly]) => ({ x: it.x + lx * c - ly * s, y: it.y + lx * s + ly * c }));
}
function ellipsePts(cx, cy, r, n = 16) { return Array.from({ length: n }, (_, i) => ({ x: cx + Math.cos((i / n) * PI2) * r, y: cy + Math.sin((i / n) * PI2) * r })); }

const isRect4 = (fp) => {
  if (fp.length !== 4) return false;
  const e0 = { x: fp[1].x - fp[0].x, y: fp[1].y - fp[0].y }; const e1 = { x: fp[2].x - fp[1].x, y: fp[2].y - fp[1].y };
  const l0 = Math.hypot(e0.x, e0.y); const l1 = Math.hypot(e1.x, e1.y);
  return l0 > 0.05 && l1 > 0.05 && Math.abs(e0.x * e1.x + e0.y * e1.y) < 0.06 * l0 * l1;
};

/** Points (m) d'un segment épaissi : rectangle `thick` autour de [a, b], prolongé aux extrémités. */
function segBox(a, b, thick) {
  const dx = b.x - a.x; const dy = b.y - a.y; const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L; const uy = dy / L; const nx = -uy * thick / 2; const ny = ux * thick / 2; const ex = ux * thick / 2; const ey = uy * thick / 2;
  return [{ x: a.x - ex + nx, y: a.y - ey + ny }, { x: b.x + ex + nx, y: b.y + ey + ny }, { x: b.x + ex - nx, y: b.y + ey - ny }, { x: a.x - ex - nx, y: a.y - ey - ny }];
}

/**
 * Vue du jardin sous un angle donné.
 * @param {object} garden
 * @param {{view?:string, month?:number|null, age?:'adult'|'young', layers?:object, width?:number, height?:number, elevation?:number,
 *          idPrefix?:string, plantLookup?:Function, caption?:string}} opts
 */
export function renderViewSVG(garden, opts = {}) {
  const view = opts.view && (opts.view === 'top' || CAMS[opts.view]) ? opts.view : 'top';
  if (view === 'top') {
    return renderPlanSVG(garden, {
      view: 'illustrated', age: opts.age, month: opts.month, layers: opts.layers, width: opts.width, height: opts.height,
      idPrefix: opts.idPrefix, plantLookup: opts.plantLookup, caption: opts.caption,
    });
  }
  const age = opts.age === 'young' ? 'young' : 'adult';
  const month = normMonth(opts.month);
  const layers = { dims: false, legend: true, sun: false, names: true, budget: false, cartouche: true, ...(opts.layers || {}) };
  const W = Math.max(320, Math.round(opts.width || 1000));
  const H = Math.max(240, Math.round(opts.height || 760));
  const P = opts.idPrefix || 'jv';
  const lookup = opts.plantLookup || getPlant;
  const northAngle = Number(garden.context && garden.context.northAngle) || 0;
  const front = view.startsWith('front');
  const elev = clamp(Number.isFinite(opts.elevation) ? opts.elevation : (front ? 0 : 35), 0, 85);
  const cam = makeCamera(view, northAngle, elev);
  const { cs, sn } = cam;
  const flatMode = elev < 6;
  const sv = shadowDir(northAngle); // direction (plan) des ombres portées
  const SLAB = front ? 0.5 : 0.35;

  const zones = garden.zones || [];
  const prims = []; const ground = []; const shadows = []; const labels = [];
  const bb = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const grow = (p) => { if (p[0] < bb.x0) bb.x0 = p[0]; if (p[0] > bb.x1) bb.x1 = p[0]; if (p[1] < bb.y0) bb.y0 = p[1]; if (p[1] > bb.y1) bb.y1 = p[1]; };
  const grads = new GradRegistry(P, { x: -0.55, y: -0.7 });
  const pr = (x, y, z = 0) => cam.proj(x, y, z);
  const add = (d, pts, fn) => { for (const p of pts) grow(p); prims.push({ d, fn }); };
  const poly = (T, pts) => pts.map((p) => T.p(p)).join(' ');
  const lawnPats = new Map();
  const used = usedZoneTypes(zones);

  // ---- terrain
  const closed = garden.boundaryClosed !== false && (garden.boundary || []).length >= 3;
  let lot = closed ? garden.boundary : null;
  if (!lot) {
    const pts = [...(garden.boundary || [])];
    for (const z of zones) if (z.shape) pts.push(...shapePolygon(z.shape, 16));
    for (const o of garden.obstacles || []) if (o.points) pts.push(...o.points);
    const b = pts.length ? bounds(pts) : { minX: 0, minY: 0, maxX: 10, maxY: 8 };
    lot = [{ x: b.minX - 0.5, y: b.minY - 0.5 }, { x: b.maxX + 0.5, y: b.minY - 0.5 }, { x: b.maxX + 0.5, y: b.maxY + 0.5 }, { x: b.minX - 0.5, y: b.maxY + 0.5 }];
  }
  const lotC = centroid(lot);
  const lotTop = lot.map((p) => pr(p.x, p.y, 0));
  const lotBot = lot.map((p) => pr(p.x, p.y, -SLAB));
  [...lotTop, ...lotBot].forEach(grow);
  // faces latérales de la dalle (coupe de terrain)
  {
    const faces = [];
    for (let i = 0; i < lot.length; i++) {
      const a = lot[i]; const b = lot[(i + 1) % lot.length];
      const dx = b.x - a.x; const dy = b.y - a.y; const L = Math.hypot(dx, dy) || 1;
      let nx = dy / L; let ny = -dx / L;
      if (nx * ((a.x + b.x) / 2 - lotC.x) + ny * ((a.y + b.y) / 2 - lotC.y) < 0) { nx = -nx; ny = -ny; }
      if (cam.facing(nx, ny) <= 0.001) continue;
      const nc = cam.nComp(nx, ny);
      faces.push({ d: cam.depth((a.x + b.x) / 2, (a.y + b.y) / 2), a, b, n3: [nc.e, nc.n, 0] });
    }
    faces.sort((p, q) => q.d - p.d);
    for (const fc of faces) {
      const pts = [pr(fc.a.x, fc.a.y, 0), pr(fc.b.x, fc.b.y, 0), pr(fc.b.x, fc.b.y, -SLAB), pr(fc.a.x, fc.a.y, -SLAB)];
      const strip = [pr(fc.a.x, fc.a.y, 0), pr(fc.b.x, fc.b.y, 0), pr(fc.b.x, fc.b.y, -0.07), pr(fc.a.x, fc.a.y, -0.07)];
      const mid = [pr(fc.a.x, fc.a.y, -SLAB * 0.45), pr(fc.b.x, fc.b.y, -SLAB * 0.45)];
      ground.push((T) => `<polygon points="${poly(T, pts)}" fill="${shade('#8a6a48', fc.n3)}" stroke="#4e3b28" stroke-width=".7" stroke-linejoin="round"/><polygon points="${poly(T, strip)}" fill="${shade('#5f8f3f', fc.n3)}"/><line x1="${T.p(mid[0]).split(',')[0]}" y1="${T.p(mid[0]).split(',')[1]}" x2="${T.p(mid[1]).split(',')[0]}" y2="${T.p(mid[1]).split(',')[1]}" stroke="#4e3b28" stroke-opacity=".25" stroke-width=".8"/>`);
    }
  }
  ground.push((T) => `<polygon points="${poly(T, lotTop)}" fill="${flatMode ? '#8fbf62' : `url(#${P}-lot)`}" stroke="#3d5a2a" stroke-width="1.2" stroke-linejoin="round"/>`);

  // ---- zones à plat (en élévation de face : bandes basses)
  const sortedZones = [...zones].sort((a, b) => ((getZoneType(a.type) || {}).layer === 'canopy') - ((getZoneType(b.type) || {}).layer === 'canopy'));
  const FLAT_H = { terrace: 0.12, path: 0.04, pool: 0.02, pond: 0.02 };
  const placements = new Map(sortedZones.map((z) => [z, z.shape ? placePlants(garden, z, lookup, { age, max: 90 }) : []]));
  for (const z of sortedZones) {
    const t = getZoneType(z.type);
    if (!t || !z.shape) continue;
    const zp = shapePolygon(z.shape, 32);
    if (zp.length < 3) continue;
    const water = z.type === 'pond' || z.type === 'pool';
    const canopy = t.layer === 'canopy';
    const above = isAbovePool(z);
    if (above && flatMode) {
      const b0 = prims.length;
      addBox(zp, 0, ABOVE_POOL_H, { wall: '#c9d3d8', roof: '#4aa3d8', seg: 2, tag: 'pool' });
      for (let i = b0; i < prims.length; i++) { const fn = prims[i].fn; prims[i].fn = (T) => `<g data-pool="above">${fn(T)}</g>`; }
    } else if (above) {
      addAbovePool(zp);
    } else if (flatMode) {
      if (!canopy && ['terrace', 'path', 'pond', 'pool'].includes(z.type)) {
        addBox(zp, 0, FLAT_H[z.type] || 0.05, { wall: water ? '#3a8fc4' : t.color, roof: water ? '#4aa3d8' : t.color, seg: 4, noShadow: true });
      }
    } else {
      const top = zp.map((p) => pr(p.x, p.y, water ? -0.02 : 0.01));
      top.forEach(grow);
      const fillId = water ? `${P}-water` : `${P}-g-${t.id}`;
      const op = canopy ? 0.32 : 0.96;
      ground.push((T) => {
        let s = `<polygon points="${poly(T, top)}" fill="url(#${fillId})" fill-opacity="${op}" stroke="${darken(t.color, 0.4)}" stroke-width=".9" stroke-linejoin="round"/>`;
        if (!canopy) s += `<polygon points="${poly(T, top)}" fill="url(#${P}-pat-${t.id})" fill-opacity="${water ? 0.35 : 0.3}"/>`;
        if (water) {
          const c = centroid(zp); const r = Math.sqrt(polygonArea(zp) / Math.PI);
          const h1 = pr(c.x - r * 0.35, c.y - r * 0.2, -0.02); const h2 = pr(c.x + r * 0.05, c.y - r * 0.25, -0.02);
          const h3 = pr(c.x - r * 0.1, c.y + r * 0.2, -0.02); const h4 = pr(c.x + r * 0.3, c.y + r * 0.15, -0.02);
          s += `<path d="M${T.p(h1)}L${T.p(h2)}M${T.p(h3)}L${T.p(h4)}" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round" fill="none"/>`;
        }
        return s;
      });
    }
    for (const pp of placements.get(z)) {
      if (!pp.fill || flatMode) continue;
      const st = plantState(pp.plant, month);
      const top = zp.map((p) => pr(p.x, p.y, 0.012)); top.forEach(grow);
      const id = `${P}-lawn-${st.foliage.slice(1)}`; if (!lawnPats.has(id)) lawnPats.set(id, st.foliage);
      const R = rngOf(pp); const bd = bounds(zp); const dots = [];
      if (st.flowering) for (let k = 0; k < 500 && dots.length < 30; k++) { const p = { x: bd.minX + R() * bd.width, y: bd.minY + R() * bd.height }; if (pointInPolygon(p, zp)) dots.push(pr(p.x, p.y, 0.02)); }
      ground.push((T) => `<polygon points="${poly(T, top)}" fill="${st.foliage}" fill-opacity=".7"/><polygon points="${poly(T, top)}" fill="url(#${id})"/>${dots.length ? `<g data-flower="1" fill="${st.flower}" stroke="${darken(st.flower, 0.35)}" stroke-width=".4">${dots.map((d) => `<circle cx="${T.p(d).split(',')[0]}" cy="${T.p(d).split(',')[1]}" r="1.5"/>`).join('')}</g>` : ''}`);
    }
    if (layers.names && !flatMode && polygonArea(zp) > 1.2) {
      const c = centroid(zp); const pc = pr(c.x, c.y, above ? ABOVE_POOL_H + 0.1 : 0.05);
      labels.push({ pt: pc, text: z.label || t.label });
    }
  }

  // ---- piscine hors sol : paroi extrudée, bord (margelle), eau plus basse, échelle d'accès
  /** Paroi + eau + margelle + échelle (`data-pool="above"`). */
  function addAbovePool(zp) {
    const before = prims.length;
    const H = ABOVE_POOL_H; const W = ABOVE_POOL_WATER_H; const WALL = '#c9d3d8';
    const c = centroid(zp);
    const rim = zp.map((p) => pr(p.x, p.y, H));
    const wat = zp.map((p) => pr(p.x, p.y, W));
    [...rim, ...wat].forEach(grow);
    // parois extérieures visibles (faces ombrées selon l'orientation)
    addBox(zp, 0, H, { wall: WALL, seg: 2, noRoof: true, tag: 'pool' });
    // parois intérieures côté opposé, puis eau (dessinées avant les parois avant)
    const inner = [];
    for (let i = 0; i < zp.length; i++) {
      const a = zp[i]; const b = zp[(i + 1) % zp.length];
      const dx = b.x - a.x; const dy = b.y - a.y; const L = Math.hypot(dx, dy) || 1;
      let nx = dy / L; let ny = -dx / L;
      if (nx * ((a.x + b.x) / 2 - c.x) + ny * ((a.y + b.y) / 2 - c.y) < 0) { nx = -nx; ny = -ny; }
      if (cam.facing(nx, ny) >= -0.001) continue;
      const nc = cam.nComp(-nx, -ny);
      inner.push({ pts: [pr(a.x, a.y, H), pr(b.x, b.y, H), pr(b.x, b.y, W), pr(a.x, a.y, W)], col: shade('#9fb4be', [nc.e, nc.n, 0]) });
    }
    const r = Math.sqrt(polygonArea(zp) / Math.PI);
    const hl = [[-0.35, -0.2, 0.05, -0.25], [-0.1, 0.2, 0.3, 0.15]].map(([x1, y1, x2, y2]) => [pr(c.x + r * x1, c.y + r * y1, W), pr(c.x + r * x2, c.y + r * y2, W)]);
    const dFar = Math.max(...rim.map((q) => q[2])) + 0.02;
    prims.push({ d: dFar, fn: (T) => `${inner.map((q) => `<polygon points="${poly(T, q.pts)}" fill="${q.col}" stroke="#78909c" stroke-width=".5" stroke-linejoin="round"/>`).join('')}<polygon points="${poly(T, wat)}" fill="url(#${P}-water)" stroke="#2b7fb5" stroke-width=".7" stroke-linejoin="round" data-role="pool-water"/><polygon points="${poly(T, wat)}" fill="url(#${P}-pat-pool-above)" fill-opacity=".35"/><path d="${hl.map((q) => `M${T.p(q[0])}L${T.p(q[1])}`).join('')}" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round" fill="none"/>` });
    // margelle (bord supérieur)
    const dNear = Math.min(...rim.map((q) => q[2])) - 0.05;
    prims.push({ d: dNear, fn: (T) => `<polygon points="${poly(T, rim)}" fill="none" stroke="#607d8b" stroke-width="3.6" stroke-linejoin="round"/><polygon points="${poly(T, rim)}" fill="none" stroke="#eceff1" stroke-width="2.2" stroke-linejoin="round" data-role="pool-rim"/>` });
    // échelle d'accès sur le sommet le plus proche de la caméra
    let near = zp[0]; let nd = Infinity;
    for (const p of zp) { const q = pr(p.x, p.y, 0)[2]; if (q < nd) { nd = q; near = p; } }
    const ox = near.x - c.x; const oy = near.y - c.y; const ol = Math.hypot(ox, oy) || 1;
    const ux = ox / ol; const uy = oy / ol; const tx0 = -uy * 0.2; const ty0 = ux * 0.2;
    const foot = { x: near.x + ux * 0.55, y: near.y + uy * 0.55 }; const top = { x: near.x + ux * 0.1, y: near.y + uy * 0.1 };
    const rails = [-1, 1].map((k) => [pr(foot.x + tx0 * k, foot.y + ty0 * k, 0), pr(top.x + tx0 * k, top.y + ty0 * k, H + 0.35)]);
    const rungs = [0.25, 0.5, 0.75].map((t) => [pr(foot.x + (top.x - foot.x) * t - tx0, foot.y + (top.y - foot.y) * t - ty0, (H + 0.35) * t), pr(foot.x + (top.x - foot.x) * t + tx0, foot.y + (top.y - foot.y) * t + ty0, (H + 0.35) * t)]);
    [...rails.flat(), ...rungs.flat()].forEach(grow);
    prims.push({ d: nd - 0.08, fn: (T) => `<g data-role="pool-ladder" stroke="#78909c" stroke-width="1.6" stroke-linecap="round">${[...rails, ...rungs].map((q) => `<line x1="${T.p(q[0]).split(',')[0]}" y1="${T.p(q[0]).split(',')[1]}" x2="${T.p(q[1]).split(',')[0]}" y2="${T.p(q[1]).split(',')[1]}"/>`).join('')}</g>` });
    for (let i = before; i < prims.length; i++) { const fn = prims[i].fn; prims[i].fn = (T) => `<g data-pool="above">${fn(T)}</g>`; }
  }

  // ---- extrusions
  /** Boîte extrudée (polygone `fp`, de z0 à z1) : faces visibles, toit plat ou à deux pans. */
  function addBox(fp, z0, z1, o = {}) {
    if (fp.length < 3 || !(z1 > z0)) return;
    const seg = o.seg || 2;
    const c = centroid(fp);
    const op = o.alpha != null ? o.alpha : 1;
    const stroke = o.noStroke ? '' : ` stroke="${darken(o.wall, 0.45)}" stroke-width=".6" stroke-linejoin="round"`;
    const gable = o.gable && isRect4(fp);
    let ridge = null;
    let zr = z1;
    if (gable) {
      const l01 = Math.hypot(fp[1].x - fp[0].x, fp[1].y - fp[0].y); const l12 = Math.hypot(fp[2].x - fp[1].x, fp[2].y - fp[1].y);
      const shortLen = Math.min(l01, l12);
      zr = z1 + clamp(shortLen * 0.32, 0.4, 2.4);
      const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      ridge = l01 <= l12 ? { m1: mid(fp[0], fp[1]), m2: mid(fp[2], fp[3]), short: [0, 2], long: [1, 3] } : { m1: mid(fp[1], fp[2]), m2: mid(fp[3], fp[0]), short: [1, 3], long: [0, 2] };
    }
    let minD = Infinity;
    const corners = fp.map((p) => { const q = pr(p.x, p.y, z1); if (q[2] < minD) minD = q[2]; return q; });
    for (let i = 0; i < fp.length; i++) {
      const a = fp[i]; const b = fp[(i + 1) % fp.length];
      const dx = b.x - a.x; const dy = b.y - a.y; const L = Math.hypot(dx, dy);
      if (L < 1e-6) continue;
      let nx = dy / L; let ny = -dx / L;
      if (nx * ((a.x + b.x) / 2 - c.x) + ny * ((a.y + b.y) / 2 - c.y) < 0) { nx = -nx; ny = -ny; }
      const fac = cam.facing(nx, ny);
      const nc = cam.nComp(nx, ny);
      const n3 = [nc.e, nc.n, 0];
      const isShortGable = gable && ridge.short.includes(i);
      if (fac > 0.001 || op < 1 && fac < -0.001) {
        const k = Math.max(1, Math.ceil(L / seg));
        const vis = fac > 0.001;
        for (let j = 0; j < k; j++) {
          const t0 = j / k; const t1 = (j + 1) / k;
          const p0 = { x: a.x + dx * t0, y: a.y + dy * t0 }; const p1 = { x: a.x + dx * t1, y: a.y + dy * t1 };
          const pts = [pr(p0.x, p0.y, z0), pr(p1.x, p1.y, z0), pr(p1.x, p1.y, z1), pr(p0.x, p0.y, z1)];
          const col = vis ? shade(o.wall, n3) : darken(o.wall, 0.3);
          const d = cam.depth((p0.x + p1.x) / 2, (p0.y + p1.y) / 2) + (vis ? 0 : 0.5);
          const fl = o.leaf ? faceLeaves(pts, o.leaf, `${o.tag}${i}${j}`, Math.max(3, Math.round(((o.leaf.n || 20) * seg) / 6))) : null;
          add(d, pts, (T) => `<polygon points="${poly(T, pts)}" fill="${col}"${op < 1 ? ` fill-opacity="${op}"` : ''}${stroke}/>${o.slats ? slats(T, pts, o.slats, o.slatColor, o.slatOp) : ''}${o.hlines ? hlines(T, pts, o.hlines, o.slatColor, o.slatOp) : ''}${fl ? fl(T, col) : ''}`);
        }
      }
      if (isShortGable && fac > 0.001) {
        const m = i === ridge.short[0] ? ridge.m1 : ridge.m2;
        const tri = [pr(a.x, a.y, z1), pr(b.x, b.y, z1), pr(m.x, m.y, zr)];
        const col = shade(o.wall, n3);
        add(cam.depth((a.x + b.x) / 2, (a.y + b.y) / 2) - 0.02, tri, (T) => `<polygon points="${poly(T, tri)}" fill="${col}"${op < 1 ? ` fill-opacity="${op}"` : ''}${stroke}/>`);
      }
    }
    // toit
    if (gable) {
      const runHalf = Math.min(Math.hypot(fp[1].x - fp[0].x, fp[1].y - fp[0].y), Math.hypot(fp[2].x - fp[1].x, fp[2].y - fp[1].y)) / 2;
      for (const li of ridge.long) {
        const a = fp[li]; const b = fp[(li + 1) % 4];
        const dx = b.x - a.x; const dy = b.y - a.y; const L = Math.hypot(dx, dy);
        let nx = dy / L; let ny = -dx / L;
        if (nx * ((a.x + b.x) / 2 - c.x) + ny * ((a.y + b.y) / 2 - c.y) < 0) { nx = -nx; ny = -ny; }
        const nc = cam.nComp(nx, ny);
        const dz = zr - z1;
        const nl = Math.hypot(nc.e * dz, nc.n * dz, runHalf) || 1;
        const n3 = [(nc.e * dz) / nl, (nc.n * dz) / nl, runHalf / nl];
        const toCam = n3[0] * cam.C.e * cs + n3[1] * cam.C.n * cs + n3[2] * sn;
        if (toCam <= 0.001) continue;
        // sommets de faîtage les plus proches de a et b
        const far = (p) => (Math.hypot(p.x - ridge.m1.x, p.y - ridge.m1.y) <= Math.hypot(p.x - ridge.m2.x, p.y - ridge.m2.y) ? ridge.m1 : ridge.m2);
        const ra = far(a); const rb = far(b);
        const pts = [pr(a.x, a.y, z1), pr(b.x, b.y, z1), pr(rb.x, rb.y, zr), pr(ra.x, ra.y, zr)];
        const col = shade(o.roof, n3);
        let dmin = Infinity; for (const p of pts) dmin = Math.min(dmin, p[2]);
        add(dmin - 0.03, pts, (T) => `<polygon points="${poly(T, pts)}" fill="${col}"${op < 1 ? ` fill-opacity="${op}"` : ''} stroke="${darken(o.roof, 0.5)}" stroke-width=".6" stroke-linejoin="round"/>`);
      }
    } else if (!o.noRoof) {
      const col = shade(o.roof || o.wall, [0, 0, 1]);
      const pieces = splitRect(fp, seg * 1.5);
      const edge = pieces.length > 1 ? col : darken(o.roof || o.wall, 0.4);
      pieces.forEach((pc, idx) => {
        let md = Infinity;
        const cr = pc.map((p) => { const q = pr(p.x, p.y, z1); if (q[2] < md) md = q[2]; return q; });
        const extra = o.leaf ? leafDots(pc, z1, { ...o.leaf, n: Math.max(3, Math.round((o.leaf.n || 20) / pieces.length)) }, `${o.tag || ''}${c.x.toFixed(2)}${c.y.toFixed(2)}${idx}`) : null;
        add(md - 0.03, cr, (T) => {
          let s = `<polygon points="${poly(T, cr)}" fill="${col}"${op < 1 ? ` fill-opacity="${op}"` : ''}${o.noStroke ? '' : ` stroke="${edge}" stroke-width=".6" stroke-linejoin="round"`}/>`;
          if (extra) s += extra(T);
          return s;
        });
      });
    }
    // ombre portée au sol
    if (!o.noShadow && z1 > 0.3) {
      const len = (zr - z0) * 0.8;
      const sh = [...fp, ...fp.map((p) => ({ x: p.x + sv.x * len, y: p.y + sv.y * len }))];
      shadows.push(hull(sh).map((p) => pr(p.x, p.y, 0)));
    }
  }

  function hlines(T, pts, n, col = '#000', op = 0.22) {
    let s = '';
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const a = [pts[0][0] + (pts[3][0] - pts[0][0]) * t, pts[0][1] + (pts[3][1] - pts[0][1]) * t];
      const b = [pts[1][0] + (pts[2][0] - pts[1][0]) * t, pts[1][1] + (pts[2][1] - pts[1][1]) * t];
      s += `M${T.p(a)}L${T.p(b)}`;
    }
    return `<path d="${s}" stroke="${col}" stroke-opacity="${op}" stroke-width=".6" fill="none"/>`;
  }
  function slats(T, pts, n, col = '#000', op = 0.22) {
    let s = '';
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const a = [pts[0][0] + (pts[1][0] - pts[0][0]) * t, pts[0][1] + (pts[1][1] - pts[0][1]) * t];
      const b = [pts[3][0] + (pts[2][0] - pts[3][0]) * t, pts[3][1] + (pts[2][1] - pts[3][1]) * t];
      s += `M${T.p(a)}L${T.p(b)}`;
    }
    return `<path d="${s}" stroke="${col}" stroke-opacity="${op}" stroke-width=".6" fill="none"/>`;
  }

  /** Touffes de feuillage sur une face verticale (haie) : points dans le quadrilatère projeté. */
  function faceLeaves(pts, { color }, seed, n) {
    const R = rng(hash32(seed));
    const dots = [];
    for (let k = 0; k < n; k++) {
      const u = R(); const v = R();
      dots.push([pts[0][0] + (pts[1][0] - pts[0][0]) * u + (pts[3][0] - pts[0][0]) * v, pts[0][1] + (pts[1][1] - pts[0][1]) * u + (pts[3][1] - pts[0][1]) * v, R()]);
    }
    return (T, base) => dots.map((d) => `<circle cx="${f(T.ox + d[0] * T.s)}" cy="${f(T.oy + d[1] * T.s)}" r="${f(1.2 + d[2] * 2.2)}" fill="${d[2] > 0.5 ? lighten(base || color, 0.22) : darken(base || color, 0.25)}" fill-opacity=".5"/>`).join('');
  }

  /** Découpe un rectangle en tranches le long de son grand côté (pour un tri en profondeur plus fin). */
  function splitRect(fp, maxLen) {
    if (!isRect4(fp)) return [fp];
    const l0 = Math.hypot(fp[1].x - fp[0].x, fp[1].y - fp[0].y); const l1 = Math.hypot(fp[2].x - fp[1].x, fp[2].y - fp[1].y);
    const k = Math.min(12, Math.ceil(Math.max(l0, l1) / maxLen));
    if (k <= 1) return [fp];
    const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    const [A0, A1, B0, B1] = l0 >= l1 ? [fp[0], fp[1], fp[3], fp[2]] : [fp[1], fp[2], fp[0], fp[3]];
    return Array.from({ length: k }, (_, j) => [lerp(A0, A1, j / k), lerp(A0, A1, (j + 1) / k), lerp(B0, B1, (j + 1) / k), lerp(B0, B1, j / k)]);
  }

  /** Feuillage (points) posé sur une face horizontale (haie). */
  function leafDots(fp, z, { n = 30, color, flower = null }, seed) {
    const R = rng(hash32(seed));
    const b = bounds(fp);
    const dots = [];
    for (let k = 0; k < 400 && dots.length < n; k++) {
      const p = { x: b.minX + R() * b.width, y: b.minY + R() * b.height };
      if (pointInPolygon(p, fp)) dots.push({ pt: pr(p.x, p.y, z), flower: flower && R() < 0.4, r: 0.8 + R() * 1.4 });
    }
    return (T) => {
      let s = '';
      for (const d of dots) {
        if (d.flower) s += `<circle cx="${T.p(d.pt).split(',')[0]}" cy="${T.p(d.pt).split(',')[1]}" r="${f(d.r + 0.6)}" fill="${flower}" stroke="${darken(flower, 0.35)}" stroke-width=".4" data-flower="1"/>`;
        else s += `<circle cx="${T.p(d.pt).split(',')[0]}" cy="${T.p(d.pt).split(',')[1]}" r="${f(d.r + 0.8)}" fill="${d.r > 1.8 ? lighten(color, 0.25) : d.r < 1.3 ? color : darken(color, 0.2)}" fill-opacity=".7"/>`;
      }
      return s;
    };
  }

  // ---- obstacles, bords du terrain, aménagements
  /** Enveloppe les primitives ajoutées depuis `before` dans un groupe porteur d'attributs (tests, accessibilité). */
  const tagNew = (before, attrs) => {
    for (let i = before; i < prims.length; i++) { const fn = prims[i].fn; prims[i].fn = (T) => `<g ${attrs}>${fn(T)}</g>`; }
  };
  const linear = [];
  for (const o of garden.obstacles || []) {
    if ((o.kind === 'wall' || o.kind === 'fence') && o.points && o.points.length >= 2) {
      for (let i = 0; i < o.points.length - 1; i++) linear.push({ kind: o.kind, a: o.points[i], b: o.points[i + 1], height: o.height, material: o.material });
    }
  }
  if (ITEMS && ITEMS.edgeObstacles) {
    try { for (const e of ITEMS.edgeObstacles(garden)) linear.push({ kind: e.kind, a: e.points[0], b: e.points[1], height: e.height, edge: true, material: ((garden.boundaryEdges || [])[e.edge] || {}).material }); } catch { /* aménagements absents */ }
  }
  const exList = existingList(garden, opts.existing);
  for (const e of exList) {
    if (e && (e.kind === 'fence' || e.kind === 'wall') && e.points && e.points.length >= 2) {
      for (let i = 0; i < e.points.length - 1; i++) linear.push({ kind: e.kind, a: e.points[i], b: e.points[i + 1], height: e.height, material: e.material, ghost: e.keep === false });
    }
  }
  const LIN = { wall: { th: 0.25, h: 2, wall: '#bdb4a8', roof: '#d0c9bf' }, fence: { th: 0.07, h: 1.2, wall: '#a77c5a', roof: '#b8906c', slats: 12 }, hedge: { th: 0.6, h: 1.8, wall: '#3f8f4a', roof: '#52a65c', leaf: true } };
  for (const l of linear) {
    const spec = LIN[l.kind];
    if (!spec) continue;
    const h = l.height > 0 ? l.height : spec.h;
    const o = { wall: spec.wall, roof: spec.roof, seg: 1.5, slats: spec.slats ? Math.max(2, Math.round(Math.hypot(l.b.x - l.a.x, l.b.y - l.a.y) * 3)) : 0, alpha: l.kind === 'fence' ? 0.92 : 1, tag: `lin${l.kind}` };
    if (spec.leaf) o.leaf = { n: 18, color: '#3f8f4a' };
    const before = prims.length;
    let material = null;
    if (l.kind === 'wall' || l.kind === 'fence') {
      // matériau : bois = lattes, métal = barreaux ajourés, béton = panneaux à joints, grillage = maille, pierre / brique = assises
      material = matOf(l.kind, l.material); const ms = MAT_STYLE[material]; const L = Math.hypot(l.b.x - l.a.x, l.b.y - l.a.y);
      Object.assign(o, { wall: ms.wall, roof: ms.roof, alpha: ms.alpha, slats: 0, hlines: 0, slatColor: '#000', slatOp: 0.22 });
      if (ms.slats) o.slats = Math.max(3, Math.round(L * 5));
      if (ms.bars) { o.slats = Math.max(4, Math.round(L * 8)); o.slatColor = '#1b2226'; o.slatOp = 0.9; }
      if (ms.joints) { o.slats = Math.max(1, Math.round(L / 2)); o.slatOp = 0.35; }
      if (ms.mesh) { o.slats = Math.max(4, Math.round(L * 7)); o.hlines = Math.max(3, Math.round(h * 7)); o.slatColor = '#56646a'; o.slatOp = 0.7; }
      if (ms.courses) { o.hlines = Math.max(3, Math.round(h * (ms.courses === 2 ? 9 : 4))); o.slatColor = '#3d2f26'; o.slatOp = 0.3; if (ms.courses === 1) o.slats = Math.max(2, Math.round(L * 2)); }
      o.alpha = ms.alpha * (l.ghost ? 0.5 : 1);
    }
    addBox(segBox(l.a, l.b, spec.th), 0, h, o);
    if (material && l.kind === 'fence') { // poteaux (et petit chapeau pour le bois)
      const L = Math.hypot(l.b.x - l.a.x, l.b.y - l.a.y); const nP = Math.max(2, Math.ceil(L / 2.2) + 1); const ms = MAT_STYLE[material];
      for (let k = 0; k < nP; k++) { const t = k / (nP - 1); const pc = { x: l.a.x + (l.b.x - l.a.x) * t, y: l.a.y + (l.b.y - l.a.y) * t }; addBox(segBox(pc, { x: pc.x + 0.001, y: pc.y }, 0.1), 0, h + (material === 'wood' ? 0.07 : 0.03), { wall: ms.post, roof: material === 'wood' ? darken(ms.post, 0.15) : ms.post, noShadow: true, seg: 3, alpha: l.ghost ? 0.5 : 1 }); }
    }
    tagNew(before, `data-obstacle="${l.kind}"${material ? ` data-material="${material}"` : ''}${l.ghost ? ' data-ghost="1"' : ''}`);
  }
  for (const o of garden.obstacles || []) {
    if ((o.kind === 'house' || o.kind === 'shed') && o.points && o.points.length >= 3) {
      const house = o.kind === 'house';
      const before = prims.length;
      addBox(o.points, 0, o.height > 0 ? o.height : (house ? 5 : 2.3), { wall: house ? '#ece3d4' : '#a1887f', roof: house ? '#b5654a' : '#6d4c41', gable: true, seg: 2, tag: o.kind });
      tagNew(before, `data-obstacle="${o.kind}"`);
    } else if (o.kind === 'tree' && o.center) {
      const H = o.height > 0 ? o.height : 6; const a = o.radius > 0 ? o.radius : 1.5;
      addTree(o.center.x, o.center.y, H, a, { foliage: '#4f8f3a', flower: null, flowering: false, bare: false }, rng(hash32(`o${o.id}`)), '#4f8f3a', true);
    }
  }
  const lookupKind = (id) => (ITEMS && ITEMS.getItemKind ? ITEMS.getItemKind(id) : null);
  for (const it of garden.items || []) {
    const k = lookupKind(it.kind);
    if (!k) continue;
    let fp;
    try { fp = ITEMS.itemPolygon(it); } catch { fp = rectPoly(it); }
    const h = it.height > 0 ? it.height : (ITEM_H[it.kind] || k.height || 0.5);
    const col = k.color || '#9e9e9e';
    const itemStart = prims.length;
    if (it.kind === 'parasol') {
      const r = it.radius > 0 ? it.radius : 1.5;
      const top = ellipsePts(it.x, it.y, r, 18).map((p) => pr(p.x, p.y, h)); const base = pr(it.x, it.y, 0); const apex = pr(it.x, it.y, h + 0.25);
      const d0 = cam.depth(it.x, it.y);
      add(d0, [...top, base, apex], (T) => `<path d="M${T.p(base)}L${T.p(apex)}" stroke="#5d4037" stroke-width="2"/><polygon points="${poly(T, top)}" fill="${col}" stroke="${darken(col, 0.4)}" stroke-width=".7"/><path d="M${T.p(apex)}${top.filter((_, i) => i % 3 === 0).map((p) => `L${T.p(p)}`).join('')}" stroke="${darken(col, 0.3)}" stroke-width=".6" fill="none"/>`);
      shadows.push(ellipsePts(it.x + sv.x * h * 0.7, it.y + sv.y * h * 0.7, r * 0.95, 14).map((p) => pr(p.x, p.y, 0)));
    } else if (it.kind === 'pergola' || it.kind === 'gazebo') {
      const post = 0.12;
      for (const p of fp) addBox(segBox(p, { x: p.x + 0.001, y: p.y }, post), 0, h, { wall: '#8d6e63', roof: '#a1887f', noShadow: true, seg: 3 });
      addBox(fp, h - 0.12, h, { wall: col, roof: col, alpha: 0.6, noShadow: true });
      shadows.push(hull([...fp, ...fp.map((p) => ({ x: p.x + sv.x * h * 0.8, y: p.y + sv.y * h * 0.8 }))]).map((p) => pr(p.x, p.y, 0)));
    } else if (it.kind === 'greenhouse') {
      addBox(fp, 0, h, { wall: '#b2dfdb', roof: '#cfeeea', gable: true, alpha: 0.55, tag: 'gh' });
    } else if (it.kind === 'planter' || it.kind === 'raised_bed') {
      addBox(fp, 0, h, { wall: '#a1887f', roof: '#6b8f3a', leaf: { n: 8, color: '#6b8f3a' }, seg: 2, tag: it.id });
    } else if (it.kind === 'shed_item' || it.kind === 'playhouse') {
      addBox(fp, 0, h, { wall: col, roof: '#6d4c41', gable: true, tag: it.id });
    } else if (it.kind === 'light') {
      const base = pr(it.x, it.y, 0); const top = pr(it.x, it.y, h);
      add(cam.depth(it.x, it.y), [base, top], (T) => `<path d="M${T.p(base)}L${T.p(top)}" stroke="#455a64" stroke-width="2"/><circle cx="${T.p(top).split(',')[0]}" cy="${T.p(top).split(',')[1]}" r="3" fill="#fff176" stroke="#8d6e00" stroke-width=".6"/>`);
    } else {
      addBox(fp, 0, h, { wall: col, roof: lighten(col, 0.2), tag: it.id, seg: 2 });
    }
    tagNew(itemStart, `data-item="${esc(it.kind)}"`);
  }
  if (ITEMS && ITEMS.openingGeometry && Array.isArray(garden.openings)) {
    for (const op of garden.openings) {
      let g = null;
      try { g = ITEMS.openingGeometry(garden, op); } catch { g = null; }
      if (!g) continue;
      const k = ITEMS.getOpeningKind ? ITEMS.getOpeningKind(op.kind) : null;
      const col = (k && k.color) || '#5d4037';
      const h = op.kind === 'garage' ? 2.2 : op.kind === 'door' ? 2.1 : op.kind === 'wicket' ? 1.3 : 1.6;
      for (const sgn of [1, -1]) {
        if (cam.facing(g.normal.x * sgn, g.normal.y * sgn) <= 0.001) continue;
        const off = 0.13 * sgn;
        const a = { x: g.a.x + g.normal.x * off, y: g.a.y + g.normal.y * off }; const b = { x: g.b.x + g.normal.x * off, y: g.b.y + g.normal.y * off };
        const pts = [pr(a.x, a.y, 0), pr(b.x, b.y, 0), pr(b.x, b.y, h), pr(a.x, a.y, h)];
        const nc = cam.nComp(g.normal.x * sgn, g.normal.y * sgn);
        const fill = shade(col, [nc.e, nc.n, 0]);
        add(cam.depth(g.center.x, g.center.y) - 2, pts, (T) => `<polygon points="${poly(T, pts)}" fill="${fill}" stroke="${darken(col, 0.5)}" stroke-width=".8"/>`);
      }
    }
  }

  // ---- végétation
  function flowerPts(cx, cy, rx, ry, R, n) {
    const clusters = Math.max(1, Math.round(n / 4)); const cc = [];
    for (let k = 0; k < clusters; k++) { const a = R() * PI2; const d = Math.sqrt(R()) * 0.7; cc.push([Math.cos(a) * d * rx, Math.sin(a) * d * ry]); }
    const pts = [];
    for (let i = 0; i < n; i++) { const c = cc[i % clusters]; const a = R() * PI2; const d = R() * 0.3; pts.push([cx + c[0] + Math.cos(a) * d * rx, cy + c[1] + Math.sin(a) * d * ry]); }
    return pts;
  }
  function dotsSVG(T, pts, col, r) {
    let s = '';
    for (const p of pts) s += `<circle cx="${f(T.ox + p[0] * T.s)}" cy="${f(T.oy + p[1] * T.s)}" r="${f(r)}"/>`;
    return `<g data-flower="1" fill="${col}" stroke="${darken(col, 0.35)}" stroke-width=".45">${s}</g>`;
  }

  /** Arbre : tronc + houppier en ellipsoïde ombré (feuillage, fleurs) ou branches nues. */
  function addTree(x, y, Hm, a, st, R, fo, existing = false, shp = null, extraFn = null) {
    const zc = (shp ? shp.zc : 0.66) * Hm; const b = Math.max(0.2, (shp ? shp.b : 0.34) * Hm);
    const [bx, by, dp] = pr(x, y, 0);
    const [cx, cy] = pr(x, y, zc);
    const rx = a; const ry = Math.sqrt((a * sn) ** 2 + (b * cs) ** 2);
    const tw = clamp(a * 0.1, 0.12, 0.35);
    add(dp, [[bx, by], [cx - rx, cy - ry], [cx + rx, cy + ry]], (T) => {
      let s = `<line x1="${f(T.ox + bx * T.s)}" y1="${f(T.oy + by * T.s)}" x2="${f(T.ox + cx * T.s)}" y2="${f(T.oy + (cy + ry * 0.2) * T.s)}" stroke="#5d4037" stroke-width="${f(Math.max(1.6, tw * T.s))}" stroke-linecap="round"/>`;
      const px = T.ox + cx * T.s; const py = T.oy + cy * T.s;
      if (st.bare) {
        let d = '';
        for (let k = 0; k < 8; k++) {
          const ph = R() * PI2; const ex = px + Math.cos(ph) * rx * T.s * 0.95; const ey = py + Math.sin(ph) * ry * T.s * 0.95;
          const sx = px; const sy = py + ry * T.s * 0.35;
          const mx = (sx + ex) / 2 + (R() - 0.5) * rx * T.s * 0.3; const my = (sy + ey) / 2;
          d += `M${f(sx)} ${f(sy)}Q${f(mx)} ${f(my)} ${f(ex)} ${f(ey)}M${f(mx)} ${f(my)}L${f(mx + (R() - 0.5) * rx * T.s * 0.4)} ${f(my - ry * T.s * 0.2)}`;
        }
        s += `<path d="${d}" fill="none" stroke="${BARE_WOOD}" stroke-width="${f(clamp(rx * T.s * 0.03, 0.8, 2))}" stroke-linecap="round" data-bare="1"/>`;
      } else {
        s += `<ellipse cx="${f(px)}" cy="${f(py)}" rx="${f(rx * T.s)}" ry="${f(ry * T.s)}" fill="url(#${grads.id(fo)})" stroke="${darken(fo, 0.45)}" stroke-width=".7"/>`;
        for (let k = 0; k < 6; k++) {
          const ph = R() * PI2; const d = Math.sqrt(R()) * 0.62;
          s += `<ellipse cx="${f(px + Math.cos(ph) * d * rx * T.s)}" cy="${f(py + Math.sin(ph) * d * ry * T.s)}" rx="${f(rx * T.s * (0.2 + R() * 0.2))}" ry="${f(ry * T.s * (0.2 + R() * 0.2))}" fill="${k % 2 ? darken(fo, 0.25) : lighten(fo, 0.25)}" fill-opacity=".38"/>`;
        }
      }
      if (st.flowering && st.flower) s += dotsSVG(T, flowerPts(cx, cy, rx * 0.85, ry * 0.85, R, clamp(Math.round(rx * T.s / 3), 6, 30)), st.flower, clamp(rx * T.s * 0.04, 1.1, 3));
      if (extraFn && !st.bare) s += extraFn(T, cx, cy, rx, ry);
      return s;
    });
    if (!st.bare || existing) {
      const off = Hm * 0.5;
      shadows.push(ellipsePts(x + sv.x * off, y + sv.y * off, a * 0.95, 14).map((p) => pr(p.x, p.y, 0)));
    }
  }

  /** Arbuste, haie isolée, légume : dôme ellipsoïdal posé au sol. */
  function addDome(x, y, Hm, a, st, R, fo) {
    const b = Hm / 2;
    const [bx, by, dp] = pr(x, y, 0);
    const [cx, cy] = pr(x, y, b);
    const rx = a; const ry = Math.sqrt((a * sn) ** 2 + (b * cs) ** 2);
    add(dp, [[cx - rx, cy - ry], [cx + rx, cy + ry], [bx, by]], (T) => {
      const px = T.ox + cx * T.s; const py = T.oy + cy * T.s;
      let s = '';
      if (st.bare) {
        let d = '';
        for (let k = 0; k < 7; k++) {
          const ph = Math.PI + R() * Math.PI; const ex = px + Math.cos(ph) * rx * T.s * 0.9 * -1; const ey = py - Math.abs(Math.sin(ph)) * ry * T.s * 0.95;
          d += `M${f(T.ox + bx * T.s + (R() - 0.5) * rx * T.s * 0.2)} ${f(T.oy + by * T.s)}L${f(ex)} ${f(ey)}`;
        }
        s += `<path d="${d}" fill="none" stroke="${BARE_WOOD}" stroke-width="${f(clamp(rx * T.s * 0.05, 0.8, 1.8))}" stroke-linecap="round" data-bare="1"/>`;
      } else {
        s += `<ellipse cx="${f(px)}" cy="${f(py)}" rx="${f(rx * T.s)}" ry="${f(ry * T.s)}" fill="url(#${grads.id(fo)})" stroke="${darken(fo, 0.45)}" stroke-width=".6"/>`;
        for (let k = 0; k < 4; k++) {
          const ph = R() * PI2; const d = Math.sqrt(R()) * 0.55;
          s += `<ellipse cx="${f(px + Math.cos(ph) * d * rx * T.s)}" cy="${f(py + Math.sin(ph) * d * ry * T.s)}" rx="${f(rx * T.s * (0.22 + R() * 0.2))}" ry="${f(ry * T.s * (0.22 + R() * 0.2))}" fill="${k % 2 ? darken(fo, 0.22) : lighten(fo, 0.25)}" fill-opacity=".4"/>`;
        }
      }
      if (st.flowering && st.flower) s += dotsSVG(T, flowerPts(cx, cy, rx * 0.8, ry * 0.8, R, clamp(Math.round(rx * T.s / 2.6), 5, 24)), st.flower, clamp(rx * T.s * 0.06, 1, 2.6));
      return s;
    });
    if (!st.bare) shadows.push(ellipsePts(x + sv.x * Hm * 0.4, y + sv.y * Hm * 0.4, a * 0.9, 12).map((p) => pr(p.x, p.y, 0)));
  }

  /** Touffes basses : vivaces, graminées, bulbes (brins, fleurs au sommet). */
  function addTuft(x, y, Hm, a, st, R, fo, kind, mode = 'fountain') {
    const [bx, by, dp] = pr(x, y, 0);
    const dormant = st.bare;
    const col = dormant ? BARE_HERB : fo;
    const hh = dormant ? Hm * 0.35 : Hm;
    const n = kind === 'bulb' ? 4 : mode === 'fine' ? clamp(Math.round(a * 34), 12, 30) : mode === 'spikes' ? clamp(Math.round(a * 14), 4, 9) : clamp(Math.round(a * 16), 5, kind === 'grass' ? 14 : 11);
    const blades = [];
    for (let k = 0; k < n; k++) {
      const spread = (k / (n - 1 || 1) - 0.5) * 2;
      const up = mode === 'upright' || mode === 'spikes' || mode === 'reed';
      const tipDx = spread * a * (up ? 0.3 : 0.95) + (R() - 0.5) * a * (up ? 0.12 : 0.3);
      const tipH = hh * (up ? 0.8 + 0.2 * R() : 0.7 + 0.3 * R());
      blades.push({ x0: (R() - 0.5) * a * 0.3, tipDx, tip: tipH, lean: (R() - 0.5) * 0.4 });
    }
    add(dp, [[bx - a, by - hh * cs - 0.1], [bx + a, by + a * sn]], (T) => {
      const X = (m) => T.ox + m * T.s; const Y = (m) => T.oy + m * T.s;
      let s = dormant ? '' : `<ellipse cx="${f(X(bx))}" cy="${f(Y(by))}" rx="${f(a * T.s * 0.8)}" ry="${f(Math.max(0.8, a * T.s * 0.8 * sn))}" fill="${darken(fo, 0.4)}" fill-opacity=".35"/>`;
      let d1 = ''; let d2 = ''; const tips = [];
      blades.forEach((bl, i) => {
        const x0 = X(bx + bl.x0); const y0 = Y(by);
        const tx = X(bx + bl.tipDx); const ty = Y(by - bl.tip * cs);
        const seg = `M${f(x0)} ${f(y0)}Q${f(x0 + (tx - x0) * 0.35 + bl.lean * (y0 - ty))} ${f(y0 + (ty - y0) * 0.65)} ${f(tx)} ${f(ty)}`;
        if (i % 2) d1 += seg; else d2 += seg;
        tips.push([(tx - T.ox) / T.s, (ty - T.oy) / T.s]);
      });
      const w = clamp(a * T.s * (mode === 'fine' ? 0.04 : 0.1), mode === 'fine' ? 0.5 : 0.9, 2.4);
      s += `<path d="${d2}" fill="none" stroke="${darken(col, 0.2)}" stroke-width="${f(w)}" stroke-linecap="round"${dormant ? ' data-bare="1"' : ''}/><path d="${d1}" fill="none" stroke="${col}" stroke-width="${f(w)}" stroke-linecap="round"/>`;
      if (st.flowering && st.flower && !dormant) {
        let t = '';
        tips.forEach((p, i) => { if (i % (kind === 'perennial' ? 1 : 2) === 0 || kind === 'bulb') t += (kind === 'grass' || mode === 'spikes') ? `<ellipse cx="${f(X(p[0]))}" cy="${f(Y(p[1]))}" rx="${f(clamp(a * T.s * 0.07, 0.9, 2.2))}" ry="${f(clamp(a * T.s * 0.18, 1.8, 5))}"/>` : `<circle cx="${f(X(p[0]))}" cy="${f(Y(p[1]))}" r="${f(clamp(a * T.s * (kind === 'bulb' ? 0.35 : 0.16), 1.4, 3.6))}"/>`; });
        s += `<g data-flower="1" fill="${st.flower}" stroke="${darken(st.flower, 0.35)}" stroke-width=".45">${t}</g>`;
      }
      return s;
    });
  }

  /** Couvre-sol / nénuphar : nappe basse. */
  function addMound(x, y, Hm, a, st, R, fo, flat) {
    const [bx, by, dp] = pr(x, y, 0);
    const rx = a; const ry = flat ? Math.max(0.02, a * sn) : Math.sqrt((a * sn) ** 2 + (Hm * cs) ** 2) * 0.8;
    const cy0 = by - (flat ? 0 : Hm * cs * 0.4);
    const col = st.bare ? mixHex(fo, BARE_HERB, 0.7) : fo;
    add(dp, [[bx - rx, cy0 - ry], [bx + rx, cy0 + ry]], (T) => {
      const px = T.ox + bx * T.s; const py = T.oy + cy0 * T.s;
      let s = `<ellipse cx="${f(px)}" cy="${f(py)}" rx="${f(rx * T.s)}" ry="${f(Math.max(0.8, ry * T.s))}" fill="${col}" stroke="${darken(col, 0.4)}" stroke-width=".6"${st.bare ? ' data-bare="1"' : ''}/>`;
      for (let k = 0; k < 3; k++) { const ph = R() * PI2; s += `<ellipse cx="${f(px + Math.cos(ph) * rx * T.s * 0.4)}" cy="${f(py + Math.sin(ph) * ry * T.s * 0.4)}" rx="${f(rx * T.s * 0.35)}" ry="${f(Math.max(0.5, ry * T.s * 0.35))}" fill="${k % 2 ? darken(col, 0.18) : lighten(col, 0.22)}" fill-opacity=".5"/>`; }
      if (st.flowering && st.flower) s += dotsSVG(T, flowerPts(bx, cy0, rx * 0.8, ry * 0.8, R, clamp(Math.round(rx * T.s / 2), 4, 20)), st.flower, clamp(rx * T.s * 0.07, 1, 2.4));
      return s;
    });
  }


  const FAMILY_OF = (plant) => familyOf(plant);
  const dotsFruit = (T, cx, cy, rx, ry, R) => { let d = ''; for (let k = 0; k < 8; k++) { const ph = R() * PI2; const r_ = Math.sqrt(R()) * 0.7; d += `<circle cx="${f(T.ox + (cx + Math.cos(ph) * r_ * rx) * T.s)}" cy="${f(T.oy + (cy + Math.sin(ph) * r_ * ry) * T.s)}" r="1.8"/>`; } return `<g data-fruit="1" fill="#d9482b" stroke="#7a1f10" stroke-width=".3">${d}</g>`; };
  // ---- silhouettes propres à chaque port (en coordonnées écran projetées)
  const wob = (R, k) => (R() - 0.5) * k;
  /** Capsule verticale (colonne) du sol à la hauteur Hm, rayon a. */
  function addColumn(x, y, Hm, a, st, R, fo, conifer) {
    const [bx, by, dp] = pr(x, y, 0); const [tx_, ty_] = pr(x, y, Hm);
    add(dp, [[bx - a, ty_ - a], [bx + a, by + a * sn]], (T) => {
      const X = (m) => T.ox + m * T.s; const Y = (m) => T.oy + m * T.s; const rb = a * T.s; const rt = rb * 0.55;
      const base = conifer ? darken(fo, 0.22) : fo;
      let s = `<path d="M${f(X(bx) - rb)} ${f(Y(by))}L${f(X(tx_) - rt)} ${f(Y(ty_) + rt)}A${f(rt)} ${f(rt)} 0 0 1 ${f(X(tx_) + rt)} ${f(Y(ty_) + rt)}L${f(X(bx) + rb)} ${f(Y(by))}A${f(rb)} ${f(Math.max(1, rb * sn))} 0 0 1 ${f(X(bx) - rb)} ${f(Y(by))}Z" fill="url(#${grads.id(base)})" stroke="${darken(fo, 0.5)}" stroke-width=".7" data-shape="column"/>`;
      for (let k = 0; k < 7; k++) { const t = (k + 0.5) / 7; s += `<ellipse cx="${f(X(bx) + wob(R, rb * 0.9))}" cy="${f(Y(by) + (Y(ty_) - Y(by)) * t)}" rx="${f(rb * (0.5 - 0.2 * t))}" ry="${f(Math.abs(Y(ty_) - Y(by)) / 14)}" fill="${k % 2 ? darken(fo, 0.35) : lighten(fo, 0.2)}" fill-opacity=".28"/>`; }
      if (st.flowering && st.flower) s += dotsSVG(T, flowerPts(bx, (by + ty_) / 2, a * 0.7, Math.abs(by - ty_) / 2.4, R, 8), st.flower, 1.4);
      return s;
    });
    shadows.push(ellipsePts(x + sv.x * Hm * 0.5, y + sv.y * Hm * 0.5, a * 0.8, 10).map((p) => pr(p.x, p.y, 0)));
  }
  /** Cône étagé (conifère) : 4 étages de jupes sombres. */
  function addCone(x, y, Hm, a, st, R, fo, trunk) {
    const [bx, by, dp] = pr(x, y, 0);
    add(dp, [[bx - a, pr(x, y, Hm)[1]], [bx + a, by + a * sn]], (T) => {
      const X = (m) => T.ox + m * T.s; const Y = (m) => T.oy + m * T.s;
      let s = trunk ? `<line x1="${f(X(bx))}" y1="${f(Y(by))}" x2="${f(X(bx))}" y2="${f(Y(by) - Hm * 0.16 * cs * T.s)}" stroke="#5d4037" stroke-width="${f(Math.max(1.5, a * T.s * 0.12))}"/>` : '';
      const tiers = 4;
      for (let k = 0; k < tiers; k++) {
        const z0 = Hm * (0.04 + (0.8 / tiers) * k); const r = a * (1 - 0.2 * k) * T.s; const z1 = z0 + Hm * (0.9 / tiers + 0.16);
        const yb = Y(by) - z0 * cs * T.s; const yt = Y(by) - z1 * cs * T.s; const rr = Math.max(1, r * sn);
        const col = darken(fo, 0.2 + 0.04 * k);
        s += `<path d="M${f(X(bx) - r)} ${f(yb)}L${f(X(bx))} ${f(yt)}L${f(X(bx) + r)} ${f(yb)}A${f(r)} ${f(rr)} 0 0 1 ${f(X(bx) - r)} ${f(yb)}Z" fill="url(#${grads.id(col)})" stroke="${darken(fo, 0.55)}" stroke-width=".7" stroke-linejoin="round" data-tier="${k}"/>`;
      }
      return s;
    });
    shadows.push(ellipsePts(x + sv.x * Hm * 0.4, y + sv.y * Hm * 0.4, a * 0.9, 10).map((p) => pr(p.x, p.y, 0)));
  }
  /** Arbres à houppier particulier : pleureur, parasol, vase, palmier (tronc + silhouette). */
  function addShapedTree(fam, x, y, Hm, a, st, R, fo, existing) {
    const [bx, by, dp] = pr(x, y, 0);
    const trunkFrac = { weeping: 0.38, umbrella: 0.55, vase: 0.22, palm: 0.72 }[fam];
    const [tx_, ty_] = pr(x, y, Hm * trunkFrac);
    const [cx, cy] = pr(x, y, Hm * (fam === 'weeping' ? 0.78 : fam === 'umbrella' ? 0.85 : fam === 'vase' ? 0.72 : 0.95));
    const ry = Math.sqrt((a * sn) ** 2 + ((fam === 'umbrella' ? 0.1 : 0.14) * Hm * cs) ** 2);
    add(dp, [[bx - a, cy - ry * 2], [bx + a, by + a * sn]], (T) => {
      const X = (m) => T.ox + m * T.s; const Y = (m) => T.oy + m * T.s; const tw = Math.max(1.6, clamp(a * 0.1, 0.12, 0.35) * T.s);
      const sway = fam === 'umbrella' ? wob(R, a * 0.5) * T.s : 0;
      let s = `<path d="M${f(X(bx))} ${f(Y(by))}Q${f(X(bx) + sway)} ${f((Y(by) + Y(cy)) / 2)} ${f(X(cx))} ${f(Y(cy))}" stroke="#5d4037" stroke-width="${f(tw)}" fill="none" stroke-linecap="round"/>`;
      if (st.bare) {
        let d = ''; const n = fam === 'weeping' ? 14 : 8;
        for (let k = 0; k < n; k++) { const ph = (k / n) * Math.PI - Math.PI / 2 + wob(R, 0.3); const ex = X(cx) + Math.sin(ph * 2) * a * T.s * 0.9; d += `M${f(X(cx))} ${f(Y(cy))}Q${f(X(cx) + Math.sin(ph * 2) * a * T.s * 0.5)} ${f(Y(cy) - (fam === 'weeping' ? -1 : 1) * a * T.s * 0.3)} ${f(ex)} ${f(fam === 'weeping' ? Y(by) - Hm * 0.1 * cs * T.s : Y(cy) - a * T.s * 0.3)}`; }
        return `${s}<path d="${d}" fill="none" stroke="${BARE_WOOD}" stroke-width="1" stroke-linecap="round" data-bare="1"/>`;
      }
      if (fam === 'weeping') {
        const rx = a * T.s; const top = Y(cy) - Hm * 0.12 * cs * T.s; const bot = Y(by) - 0.15 * T.s;
        s += `<path d="M${f(X(cx) - rx * 0.5)} ${f(top)}Q${f(X(cx) - rx * 1.05)} ${f((top + bot) / 2)} ${f(X(cx) - rx)} ${f(bot)}` + [0, 1, 2, 3, 4, 5].map((k) => `Q${f(X(cx) - rx + (k + 0.5) * rx / 3)} ${f(bot + 4 + wob(R, 4))} ${f(X(cx) - rx + (k + 1) * rx / 3)} ${f(bot + wob(R, 3))}`).join('') + `Q${f(X(cx) + rx * 1.05)} ${f((top + bot) / 2)} ${f(X(cx) + rx * 0.5)} ${f(top)}Z" fill="${lighten(fo, 0.08)}" fill-opacity=".92" stroke="${darken(fo, 0.45)}" stroke-width=".7" data-shape="curtain"/>`;
        let d = ''; for (let k = 0; k < 13; k++) { const u = -0.95 + (1.9 * k) / 12; d += `M${f(X(cx) + u * rx * 0.55)} ${f(top + 2)}L${f(X(cx) + u * rx)} ${f(bot - 2)}`; }
        s += `<path d="${d}" stroke="${darken(fo, 0.35)}" stroke-width=".7" stroke-opacity=".55" fill="none"/>`;
        s += `<ellipse cx="${f(X(cx))}" cy="${f(top + 2)}" rx="${f(rx * 0.55)}" ry="${f(Math.max(3, Hm * 0.12 * cs * T.s * 0.7))}" fill="url(#${grads.id(fo)})" stroke="${darken(fo, 0.45)}" stroke-width=".7"/>`;
      } else if (fam === 'umbrella') {
        for (let k = 0; k < 3; k++) { const dxk = (k - 1) * a * T.s * 0.28; s += `<ellipse cx="${f(X(cx) + dxk)}" cy="${f(Y(cy) - k * 2.4)}" rx="${f(a * T.s * (0.98 - 0.12 * k))}" ry="${f(Math.max(3, ry * T.s * (1 - 0.1 * k)))}" fill="url(#${grads.id(k % 2 ? lighten(fo, 0.08) : fo)})" stroke="${darken(fo, 0.45)}" stroke-width=".7" data-shape="umbrella"/>`; }
      } else if (fam === 'vase') {
        let d = ''; for (let k = 0; k < 5; k++) { const u = -1 + k * 0.5; d += `M${f(X(tx_))} ${f(Y(ty_))}L${f(X(cx) + u * a * T.s * 0.8)} ${f(Y(cy) - Hm * 0.12 * cs * T.s)}`; }
        s += `<path d="${d}" stroke="#5d4037" stroke-width="${f(Math.max(1.2, tw * 0.5))}" fill="none"/><path d="M${f(X(cx) - a * T.s * 0.95)} ${f(Y(cy) - Hm * 0.16 * cs * T.s)}Q${f(X(cx))} ${f(Y(cy) + Hm * 0.2 * cs * T.s)} ${f(X(cx) + a * T.s * 0.95)} ${f(Y(cy) - Hm * 0.16 * cs * T.s)}A${f(a * T.s * 0.95)} ${f(Math.max(3, ry * T.s))} 0 0 0 ${f(X(cx) - a * T.s * 0.95)} ${f(Y(cy) - Hm * 0.16 * cs * T.s)}Z" fill="url(#${grads.id(fo)})" stroke="${darken(fo, 0.45)}" stroke-width=".7" data-shape="vase"/>`;
      } else { // palmier : palmes arquées en couronne
        let d = ''; const L = Math.min(Hm * 0.32, a * 1.4) * T.s;
        for (let k = 0; k < 10; k++) { const ph = (k / 10) * Math.PI * 2; const ex = X(cx) + Math.cos(ph) * L; const ey = Y(cy) + Math.sin(ph) * L * (0.35 + 0.65 * Math.abs(Math.sin(ph))) * 0.5 + (Math.sin(ph) > 0 ? L * 0.35 : -L * 0.1); d += `M${f(X(cx))} ${f(Y(cy))}Q${f(X(cx) + Math.cos(ph) * L * 0.6)} ${f(Y(cy) - L * 0.55)} ${f(ex)} ${f(ey)}`; }
        s += `<path d="${d}" fill="none" stroke="${fo}" stroke-width="${f(Math.max(2, L * 0.12))}" stroke-linecap="round" data-shape="palm"/><path d="${d}" fill="none" stroke="${darken(fo, 0.35)}" stroke-width="${f(Math.max(.8, L * 0.03))}"/>`;
      }
      if (st.flowering && st.flower && fam !== 'palm') s += dotsSVG(T, flowerPts(cx, cy, a * 0.8, ry, R, 10), st.flower, 1.6);
      return s;
    });
    if (!st.bare || existing) shadows.push(ellipsePts(x + sv.x * Hm * 0.45, y + sv.y * Hm * 0.45, a * 0.9, 12).map((p) => pr(p.x, p.y, 0)));
  }
  /** Tiges arquées ou dressées d'un arbuste (touffe de rameaux + masse feuillée). */
  function addStems(fam, x, y, Hm, a, st, R, fo) {
    const [bx, by, dp] = pr(x, y, 0);
    add(dp, [[bx - a, by - Hm * cs - 0.1], [bx + a, by + a * sn]], (T) => {
      const X = (m) => T.ox + m * T.s; const Y = (m) => T.oy + m * T.s; let d = ''; let leaves = '';
      const n = fam === 'arching' ? 9 : 7;
      for (let k = 0; k < n; k++) {
        const ph = (k / n) * Math.PI * 2 + wob(R, 0.5); const reach = a * (fam === 'arching' ? 0.95 : 0.35) * (0.8 + 0.3 * R());
        const ex = bx + Math.cos(ph) * reach; const ez = Hm * (fam === 'arching' ? 0.5 : 0.92 + 0.08 * R());
        const [px, py] = pr(x + Math.cos(ph) * reach * (-0) , y, 0); void px; void py;
        const ex_ = X(bx) + Math.cos(ph) * reach * T.s; const ey_ = Y(by) - ez * cs * T.s + Math.sin(ph) * reach * sn * T.s;
        const topx = X(bx) + Math.cos(ph) * reach * 0.35 * T.s; const topy = Y(by) - Hm * (fam === 'arching' ? 1.05 : 0.7) * cs * T.s;
        d += `M${f(X(bx))} ${f(Y(by))}Q${f(topx)} ${f(topy)} ${f(ex_)} ${f(ey_)}`;
        if (!st.bare) for (const t of [0.55, 0.8, 1]) { const lx = (1 - t) * (1 - t) * X(bx) + 2 * (1 - t) * t * topx + t * t * ex_; const ly = (1 - t) * (1 - t) * Y(by) + 2 * (1 - t) * t * topy + t * t * ey_; leaves += `<ellipse cx="${f(lx)}" cy="${f(ly)}" rx="${f(Math.max(2, a * T.s * 0.2))}" ry="${f(Math.max(2, a * T.s * 0.15))}"/>`; }
      }
      let s = `<path d="${d}" fill="none" stroke="${st.bare ? BARE_WOOD : darken(fo, 0.45)}" stroke-width="${f(clamp(a * T.s * 0.03, 0.8, 1.8))}" stroke-linecap="round"${st.bare ? ' data-bare="1"' : ''} data-shape="${fam}"/>`;
      if (!st.bare) s += `<g fill="${fo}" fill-opacity=".82" stroke="${darken(fo, 0.4)}" stroke-width=".4">${leaves}</g>`;
      if (st.flowering && st.flower && !st.bare) s += dotsSVG(T, flowerPts(bx, by - Hm * cs * 0.55, a * 0.8, Hm * cs * 0.35, R, 10), st.flower, 1.5);
      return s;
    });
    if (!st.bare) shadows.push(ellipsePts(x + sv.x * Hm * 0.4, y + sv.y * Hm * 0.4, a * 0.85, 10).map((p) => pr(p.x, p.y, 0)));
  }
  /** Bambou : touffe de chaumes verticaux fins, nœuds visibles, plumeaux de feuilles en tête, base dense. */
  function addBamboo(x, y, Hm, a, st, R, fo, culm) {
    const [bx, by, dp] = pr(x, y, 0);
    const n = clamp(Math.round(10 + a * 6), 9, 16);
    const stems = [];
    for (let k = 0; k < n; k++) {
      const ph = R() * PI2; const d = Math.sqrt(R()) * a * 0.55; const Hc = Hm * (0.72 + 0.28 * R()); const lean = 0.05 + 0.16 * R();
      const px = x + Math.cos(ph) * d; const py = y + Math.sin(ph) * d;
      const [sx0, sy0, sd] = pr(px, py, 0); const [sx1, sy1] = pr(px + Math.cos(ph) * lean * Hc, py + Math.sin(ph) * lean * Hc, Hc);
      stems.push({ sx0, sy0, sx1, sy1, sd, Hc });
    }
    stems.sort((p, q) => q.sd - p.sd);
    add(dp, [[bx - a, by - Hm * cs - 0.5], [bx + a, by + a * sn]], (T) => {
      const X = (m) => T.ox + m * T.s; const Y = (m) => T.oy + m * T.s; let s = '';
      s += `<ellipse cx="${f(X(bx))}" cy="${f(Y(by) - Hm * 0.05 * T.s)}" rx="${f(a * T.s * 0.7)}" ry="${f(Math.max(2, a * T.s * 0.35))}" fill="${fo}" fill-opacity=".9" stroke="${darken(fo, 0.4)}" stroke-width=".5" data-shape="bamboo-base"/>`;
      const sw = clamp(T.s * 0.035, 1, 2.6);
      for (const st_ of stems) {
        const x0 = X(st_.sx0); const y0 = Y(st_.sy0); const x1 = X(st_.sx1); const y1 = Y(st_.sy1);
        const cxm = (x0 + x1) / 2 + (x1 - x0) * 0.1; const cym = (y0 + y1) / 2;
        s += `<path d="M${f(x0)} ${f(y0)}Q${f(cxm)} ${f(cym)} ${f(x1)} ${f(y1)}" fill="none" stroke="${culm}" stroke-width="${f(sw)}" stroke-linecap="round" data-culm="1"/>`;
        let nd = ''; for (let q = 1; q < 6; q++) { const t = q / 6; const px = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cxm + t * t * x1; const py = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cym + t * t * y1; nd += `M${f(px - sw * 0.9)} ${f(py)}L${f(px + sw * 0.9)} ${f(py)}`; }
        s += `<path d="${nd}" stroke="${darken(culm, 0.5)}" stroke-width=".7" fill="none"/>`;
        let pl = ''; const pLen = clamp(T.s * 0.16 * (1 + Hm * 0.04), 3, 11);
        for (let q = 0; q < 3; q++) { const t = 0.72 + 0.14 * q; const px = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cxm + t * t * x1; const py = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cym + t * t * y1; for (const sd of [-1, 0, 1]) pl += `M${f(px)} ${f(py)}Q${f(px + sd * pLen * 0.7)} ${f(py - pLen * 0.7)} ${f(px + sd * pLen)} ${f(py - pLen * (sd ? 0.1 : 1))}`; }
        s += `<path d="${pl}" fill="none" stroke="${fo}" stroke-width="${f(clamp(T.s * 0.03, 0.9, 2.2))}" stroke-linecap="round" data-plume="1"/>`;
      }
      return s;
    });
    shadows.push(ellipsePts(x + sv.x * Hm * 0.35, y + sv.y * Hm * 0.35, a * 0.8, 10).map((p) => pr(p.x, p.y, 0)));
  }
  /** Grimpante : support léger (treillis, câbles, tuteur) et tiges feuillées qui montent jusqu'à la hauteur. */
  function addClimber(pp, Hm, st, R, fo) {
    const { x, y } = pp; const hp = habitParams(pp.plant, { age });
    const onWall = !!pp.wall; const sup = hp.support || 'trellis';
    const a0 = pp.rot || 0; const dx = Math.cos(a0); const dy = Math.sin(a0);
    const Wp = clamp(pp.r * 2 * 0.9, 0.8, 3); const Hs = onWall ? Math.min(Hm, (pp.wall.h || 2) * 1.02) : Math.min(Hm, sup === 'pergola' ? 2.3 : 2.4);
    const corner = (u, v) => pr(x + dx * u, y + dy * u, v);
    const quad = [corner(-Wp / 2, 0), corner(Wp / 2, 0), corner(Wp / 2, Hs), corner(-Wp / 2, Hs)];
    const [, , dp] = pr(x, y, 0);
    const blobs = []; const nb = clamp(Math.round(Wp * Hs * 7), 10, 40);
    for (let k = 0; k < nb; k++) { const u = (R() - 0.5) * Wp; const v = Hs * (0.1 + 0.9 * Math.sqrt(R())); blobs.push({ p: corner(u, v), r: 0.14 + 0.1 * R() }); }
    const stemsP = []; for (let k = 0; k < clamp(hp.stems, 2, 5); k++) { const u = (R() - 0.5) * Wp * 0.7; stemsP.push([corner(u, 0), corner(u + (R() - 0.5) * 0.4, Hs * 0.5), corner(u + (R() - 0.5) * 0.5, Hs * 0.95)]); }
    add(dp, [...quad.map((q) => [q[0], q[1]]), ...blobs.map((b) => b.p)], (T) => {
      const X = (m) => T.ox + m * T.s; const Y = (m) => T.oy + m * T.s; let s = '';
      const qp = (q) => `${f(X(q[0]))},${f(Y(q[1]))}`;
      if (!onWall && sup !== 'tripod') { // treillis : cadre et grille légère (câbles), ou pergola
        let g = ''; for (let k = 1; k < 5; k++) { const t = k / 5; g += `M${f(X(quad[0][0] + (quad[1][0] - quad[0][0]) * t))} ${f(Y(quad[0][1] + (quad[1][1] - quad[0][1]) * t))}L${f(X(quad[3][0] + (quad[2][0] - quad[3][0]) * t))} ${f(Y(quad[3][1] + (quad[2][1] - quad[3][1]) * t))}M${f(X(quad[0][0] + (quad[3][0] - quad[0][0]) * t))} ${f(Y(quad[0][1] + (quad[3][1] - quad[0][1]) * t))}L${f(X(quad[1][0] + (quad[2][0] - quad[1][0]) * t))} ${f(Y(quad[1][1] + (quad[2][1] - quad[1][1]) * t))}`; }
        s += `<g data-support="${sup === 'pergola' ? 'pergola' : 'trellis'}"><polygon points="${quad.map(qp).join(' ')}" fill="#e8dcc5" fill-opacity=".18" stroke="#8a6a48" stroke-width="1.4" stroke-linejoin="round"/><path d="${g}" stroke="#8a6a48" stroke-width=".7" fill="none"/></g>`;
      } else if (sup === 'tripod' && !onWall) {
        const top = pr(x, y, Math.min(Hm, 2)); let d = '';
        for (let k = 0; k < 3; k++) { const ph = a0 + (k / 3) * PI2; const b = pr(x + Math.cos(ph) * 0.35, y + Math.sin(ph) * 0.35, 0); d += `M${f(X(b[0]))} ${f(Y(b[1]))}L${f(X(top[0]))} ${f(Y(top[1]))}`; }
        s += `<path d="${d}" stroke="#6d4c41" stroke-width="1.6" fill="none" data-support="tripod"/>`;
      } else s += `<line x1="${f(X(quad[0][0]))}" y1="${f(Y(quad[0][1]))}" x2="${f(X(quad[1][0]))}" y2="${f(Y(quad[1][1]))}" stroke="#4e4a44" stroke-width="1" opacity=".5" data-support="wall"/>`;
      let d = ''; for (const c of stemsP) d += `M${qp(c[0])}Q${qp(c[1])} ${qp(c[2])}`;
      s += `<path d="${d.replace(/,/g, ' ')}" fill="none" stroke="${st.bare ? BARE_WOOD : darken(fo, 0.45)}" stroke-width="${f(clamp(T.s * 0.03, 0.9, 1.8))}" stroke-linecap="round"${st.bare ? ' data-bare="1"' : ''} data-stems="1"/>`;
      if (!st.bare) s += `<g fill="${fo}" fill-opacity=".88" stroke="${darken(fo, 0.4)}" stroke-width=".4">${blobs.map((b) => `<ellipse cx="${f(X(b.p[0]))}" cy="${f(Y(b.p[1]))}" rx="${f(b.r * T.s)}" ry="${f(b.r * T.s * 0.8)}"/>`).join('')}</g>`;
      if (st.flowering && st.flower && !st.bare) s += dotsSVG(T, blobs.slice(0, 8).map((b) => [b.p[0], b.p[1]]), st.flower, 1.8);
      return s;
    });
  }
  /** Rosette : grandes feuilles larges posées autour d'un centre (hosta). */
  function addRosette(x, y, Hm, a, st, R, fo) {
    const [bx, by, dp] = pr(x, y, 0); const lift = Hm * cs * 0.4;
    add(dp, [[bx - a, by - lift - a * sn], [bx + a, by + a * sn]], (T) => {
      const col = st.bare ? BARE_HERB : fo; let s = '';
      const k = Math.max(0.3, sn);
      for (let i = 0; i < 9; i++) {
        const ph = (i / 9) * PI2 + wob(R, 0.3); const L = a * T.s * (0.8 + 0.2 * R());
        s += `<path d="${leafPath(0, 0, ph, L, L * 0.34)}" fill="${i % 2 ? col : lighten(col, 0.15)}" fill-opacity=".95" stroke="${darken(col, 0.45)}" stroke-width=".6" transform="translate(${f(T.ox + bx * T.s)} ${f(T.oy + (by - lift * (i % 3 === 0 ? 1 : 0.5)) * T.s)}) scale(1 ${f(k)})"/>`;
      }
      if (st.flowering && st.flower && !st.bare) s += `<g data-flower="1" stroke="${darken(st.flower, 0.35)}" stroke-width=".4" fill="${st.flower}">${[0, 1, 2].map((q) => `<ellipse cx="${f(T.ox + (bx + (q - 1) * a * 0.3) * T.s)}" cy="${f(T.oy + (by - Hm * cs * 1.3) * T.s)}" rx="1.6" ry="${f(Math.max(3, a * T.s * 0.3))}"/>`).join('')}</g>`;
      return `<g${st.bare ? ' data-bare="1"' : ''}>${s}</g>`;
    });
  }
  /** Tuteur / tipi de légume grimpant : trois cannes et plants feuillés. */
  function addTipi(x, y, Hm, a, st, R, fo) {
    const Ht = clamp(Hm, 1, 2); const top = pr(x, y, Ht); const [, , dp] = pr(x, y, 0);
    const feet = [0, 1, 2].map((k) => pr(x + Math.cos(k * 2.09 + 0.5) * 0.32, y + Math.sin(k * 2.09 + 0.5) * 0.32, 0));
    add(dp, [[top[0], top[1]], ...feet.map((q) => [q[0], q[1]])], (T) => {
      const X = (m) => T.ox + m * T.s; const Y = (m) => T.oy + m * T.s; let d = ''; let lv = '';
      for (const b of feet) { d += `M${f(X(b[0]))} ${f(Y(b[1]))}L${f(X(top[0]))} ${f(Y(top[1]))}`; if (!st.bare) for (const t of [0.25, 0.5, 0.75]) lv += `<ellipse cx="${f(X(b[0] + (top[0] - b[0]) * t))}" cy="${f(Y(b[1] + (top[1] - b[1]) * t))}" rx="${f(0.12 * T.s)}" ry="${f(0.1 * T.s)}"/>`; }
      return `<path d="${d}" stroke="#6d4c41" stroke-width="1.6" fill="none" data-support="tripod"/><g fill="${fo}" fill-opacity=".88" stroke="${darken(fo, 0.4)}" stroke-width=".4">${lv}</g>`;
    });
  }

  const placedAll = [];
  for (const z of sortedZones) {
    if (!z.shape) continue;
    const zt = getZoneType(z.type);
    const pl = placements.get(z);
    const zp = shapePolygon(z.shape, 32);
    // haie : volume continu
    const hedges = pl.filter((pp) => !pp.fill && pp.family === 'hedge');
    if (hedges.length && zp.length >= 3) {
      const plantH = hedges.reduce((best, pp) => (plantHeightM(pp.plant, age) > plantHeightM(best.plant, age) ? pp : best), hedges[0]);
      const st = plantState(plantH.plant, month);
      const Hh = plantHeightM(plantH.plant, age);
      const flowering = hedges.find((pp) => plantState(pp.plant, month).flowering);
      const fo = st.bare ? BARE_WOOD : st.foliage;
      const hb = prims.length;
      addBox(zp, 0, Hh, {
        wall: fo, roof: st.bare ? lighten(BARE_WOOD, 0.1) : lighten(fo, 0.12), seg: 1.5, tag: `h${z.id}`,
        leaf: { n: clamp(Math.round(polygonArea(zp) * 14), 10, 60), color: fo, flower: flowering ? plantState(flowering.plant, month).flower : null },
      });
      for (let i = hb; i < prims.length; i++) { const fn = prims[i].fn; prims[i].fn = (T) => `<g data-plant="${esc(plantH.plant.id)}" data-kind="shrub" data-family="hedge" data-habit="hedge-clipped"${st.bare ? ' data-bare="1"' : ''}>${fn(T)}</g>`; }
    }
    for (const pp of pl) {
      if (hedges.includes(pp)) continue;
      if (pp.fill) {
        continue;
      }
      placedAll.push({ pp, zt });
    }
  }
  // plantes existantes déclarées : même moteur de ports, taille actuelle, estompées si `keep === false`
  for (const [i, e] of exList.entries()) {
    if (!e || e.kind === 'fence' || e.kind === 'wall' || !(e.plant || e.habit || ['tree', 'shrub', 'hedge'].includes(e.kind))) continue;
    const hid = (e.habit && (e.habit.id || e.habit)) || null;
    const base = e.plant || { id: `_ex_${e.id ?? i}`, commonName: 'Existant', category: e.kind === 'tree' ? 'tree' : e.kind === 'hedge' ? 'hedge' : 'shrub', foliage: 'deciduous', bloom: [], flowerColor: null, foliageColor: '#4f8a3c' };
    const h = Number(e.height) > 0 ? Number(e.height) : (base.heightAdult || 3); const w = Number(e.width) > 0 ? Number(e.width) : (base.widthAdult || 2);
    const plant = { ...base, heightAdult: h, widthAdult: w, habit: typeof hid === 'string' && habitOf({ habit: hid }).id === hid ? hid : (e.plant ? habitOf(e.plant).id : (e.kind === 'tree' ? 'tree-round' : e.kind === 'hedge' ? 'hedge-clipped' : 'shrub-round')) };
    const fam = FAMILY_OF(plant);
    const seed = rng(hash32(`ex${e.id ?? i}`))();
    if (e.points && e.points.length >= 2 && fam === 'hedge') { // haie existante : volume continu le long des points
      const st = plantState(plant, month); const fo = st.bare ? BARE_WOOD : st.foliage; const before = prims.length;
      for (let k = 0; k < e.points.length - 1; k++) addBox(segBox(e.points[k], e.points[k + 1], Math.max(0.3, w)), 0, h, { wall: fo, roof: lighten(fo, 0.12), seg: 1.5, tag: `ex${i}${k}`, alpha: e.keep === false ? 0.45 : 1, leaf: { n: 16, color: fo } });
      for (let q = before; q < prims.length; q++) { const fn = prims[q].fn; prims[q].fn = (T) => `<g data-plant="${esc(plant.id)}" data-existing="1" data-kind="shrub" data-family="hedge"${e.keep === false ? ' data-ghost="1"' : ''}>${fn(T)}</g>`; }
      continue;
    }
    const pts0 = e.points && e.points.length ? e.points[0] : { x: e.x, y: e.y };
    placedAll.push({ pp: { plant, x: Number.isFinite(e.x) ? e.x : pts0.x, y: Number.isFinite(e.y) ? e.y : pts0.y, r: w / 2, rand: seed, family: fam, habit: plant.habit, rot: 0, seg: hedgeSeg(plant) }, fixedH: h, ghost: e.keep === false, existing: true });
  }
  for (const { pp, fixedH, ghost, existing } of placedAll) {
    const plant = pp.plant;
    const st = plantState(plant, month);
    const kind = plantKind(plant);
    const fam = pp.family || FAMILY_OF(plant);
    const R = rngOf(pp);
    const Hm = fixedH || plantHeightM(plant, age);
    const a = pp.r;
    const fo = ghost ? mixHex(st.foliage, '#a3a69e', 0.55) : st.foliage;
    const before = prims.length;
    const sh0 = shadows.length;
    const culm = culmColor(plant);
    switch (fam) {
      case 'round': addTree(pp.x, pp.y, Hm, a, st, R, fo, existing); break;
      case 'fruit': addTree(pp.x, pp.y, Hm, a, st, R, fo, existing, { zc: 0.62, b: 0.36 }, (T, cx, cy, rx, ry) => ((month == null || (month >= 7 && month <= 10)) ? dotsFruit(T, cx, cy, rx, ry, R) : '')); break;
      case 'spreading': addTree(pp.x, pp.y, Hm, a, st, R, fo, existing, { zc: 0.6, b: 0.22 }); break;
      case 'weeping': case 'umbrella': case 'vase': case 'palm': addShapedTree(fam, pp.x, pp.y, Hm, a, st, R, fo, existing); break;
      case 'column': addColumn(pp.x, pp.y, Hm, Math.max(0.15, a), st, R, fo, plant.foliage === 'evergreen'); break;
      case 'cone': addCone(pp.x, pp.y, Hm, a, st, R, fo, habitOf(plant).id === 'tree-conical'); break;
      case 'upright': case 'arching': addStems(fam, pp.x, pp.y, Hm, a, st, R, fo); break;
      case 'bamboo': addBamboo(pp.x, pp.y, Hm, a, st, R, fo, culm); break;
      case 'hedge': addDome(pp.x, pp.y, Hm, a, st, R, fo); break;
      case 'climber': addClimber(pp, Hm, st, R, fo); break;
      case 'rosette': addRosette(pp.x, pp.y, Math.min(Hm, 1), a, st, R, fo); break;
      case 'tipi': addTipi(pp.x, pp.y, Hm, a, st, R, fo); break;
      case 'mat': case 'creeping': addMound(pp.x, pp.y, Math.min(Hm, 0.3), a, st, R, fo, false); break;
      case 'floating': addMound(pp.x, pp.y, 0.05, a, st, R, fo, true); break;
      case 'fountain': case 'clump': case 'bulbclump': case 'bulbspike': addTuft(pp.x, pp.y, Math.min(Hm, 2.5), a, st, R, fo, kind === 'grass' || fam === 'fountain' ? 'grass' : kind === 'bulb' ? 'bulb' : 'perennial', 'fountain'); break;
      case 'blades': addTuft(pp.x, pp.y, Math.min(Hm, 2.5), a, st, R, fo, 'grass', 'upright'); break;
      case 'fine': addTuft(pp.x, pp.y, Math.min(Hm, 2.5), a, st, R, fo, 'grass', 'fine'); break;
      case 'reed': addTuft(pp.x, pp.y, Math.min(Hm, 2.8), a, st, R, fo, 'grass', 'reed'); break;
      case 'spikes': addTuft(pp.x, pp.y, Math.min(Hm, 2.5), a, st, R, fo, 'perennial', 'spikes'); break;
      case 'fern': addTuft(pp.x, pp.y, Math.min(Hm, 1.5), a, st, R, fo, 'perennial', 'fountain'); break;
      case 'row': addDome(pp.x, pp.y, Math.min(Hm, 0.6), a, st, R, fo); break;
      case 'herb': case 'mound': addDome(pp.x, pp.y, Math.min(Hm, 1.2), a, st, R, fo); break;
      default:
        if (kind === 'tree') addTree(pp.x, pp.y, Hm, a, st, R, fo);
        else if (kind === 'shrub') addDome(pp.x, pp.y, Hm, a, st, R, fo);
        else addTuft(pp.x, pp.y, Math.min(Hm, 2.5), a, st, R, fo, kind);
    }
    void sh0;
    // marque l'essence et son port pour les tests / l'accessibilité
    for (let i = before; i < prims.length; i++) {
      const fn = prims[i].fn;
      prims[i].fn = (T) => `<g data-plant="${esc(plant.id)}" data-kind="${kind}" data-family="${fam}" data-habit="${pp.habit || ''}"${existing ? ' data-existing="1"' : ''}${ghost ? ' data-ghost="1" opacity=".42"' : ''}${st.bare ? ' data-bare="1"' : ''}${st.flowering ? ' data-flowering="1"' : ''}>${fn(T)}</g>`;
    }
  }

  // ---- mise en page
  const fr = makeFrame(W, H, layers, (compact) => buildLegendItems(garden, lookup, layers, { P, compact, sun: false }));
  const { ax, ay, aw, ah, MARGIN, CART_H } = fr;
  const padL = front ? 40 : 16;
  const padT = 16;
  const bw = Math.max(1e-3, bb.x1 - bb.x0); const bh = Math.max(1e-3, bb.y1 - bb.y0);
  const s = Math.min((aw - padL - 16) / bw, (ah - padT * 2) / bh);
  const T = {
    s,
    ox: ax + padL + (aw - padL - 16 - bw * s) / 2 - bb.x0 * s,
    oy: ay + padT + (ah - padT * 2 - bh * s) / 2 - bb.y0 * s,
  };
  T.p = (p) => `${f(T.ox + p[0] * s)},${f(T.oy + p[1] * s)}`;

  prims.sort((p, q) => q.d - p.d);

  // ---- défs
  const defs = patternDefs(P, used, true);
  defs.push(`<linearGradient id="${P}-bg" x1="0" y1="0" x2="0" y2="1">${front ? '<stop offset="0" stop-color="#bddcf2"/><stop offset=".8" stop-color="#eef6fb"/><stop offset="1" stop-color="#dfe9c8"/>' : '<stop offset="0" stop-color="#f3f7e6"/><stop offset="1" stop-color="#dfe9c8"/>'}</linearGradient>`);
  defs.push(`<linearGradient id="${P}-lot" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfe7a8"/><stop offset="1" stop-color="#a9cf7c"/></linearGradient>`);
  defs.push(`<linearGradient id="${P}-water" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9ad7f2"/><stop offset=".6" stop-color="#4aa3d8"/><stop offset="1" stop-color="#2b7fb5"/></linearGradient>`);
  defs.push(`<filter id="${P}-blur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.4"/></filter>`);
  defs.push(`<clipPath id="${P}-clip"><polygon points="${poly(T, lotTop)}"/></clipPath>`);
  for (const [id, col] of lawnPats) defs.push(lawnPatternDef(id, col));

  const out = [];
  out.push(`<rect width="${W}" height="${H}" fill="url(#${P}-bg)"/>`);
  out.push(`<rect x="${ax}" y="${ay}" width="${f(aw)}" height="${f(ah)}" fill="none" stroke="#c8c8c8" stroke-width="0.6"/>`);
  out.push(`<g data-role="ground">${ground.map((fn) => fn(T)).join('')}</g>`);
  if (shadows.length) out.push(`<g clip-path="url(#${P}-clip)"><g filter="url(#${P}-blur)" fill="#1b2a10" fill-opacity=".26" data-role="shadows">${shadows.map((pts) => `<polygon points="${poly(T, pts)}"/>`).join('')}</g></g>`);
  out.push(`<g data-role="volumes">${prims.map((p) => p.fn(T)).join('')}</g>`);
  for (const lb of labels) {
    out.push(`<text x="${f(T.ox + lb.pt[0] * s)}" y="${f(T.oy + lb.pt[1] * s)}" font-size="11" font-weight="700" text-anchor="middle" fill="#14210f" stroke="#fff" stroke-width="3" paint-order="stroke" font-family="${FONT}" opacity=".9">${esc(lb.text)}</text>`);
  }
  if (front) {
    // règle des hauteurs (au premier plan)
    const zMax = Math.max(1, Math.floor((-bb.y0) / cs));
    const step = zMax > 12 ? 5 : zMax > 6 ? 2 : 1;
    const x0 = ax + 26;
    const yBase = T.oy + Math.max(...lotTop.map((p) => p[1])) * s;
    let ticks = '';
    for (let z = 0; z <= zMax; z += step) { const y = yBase - z * cs * s; ticks += `<line x1="${x0}" y1="${f(y)}" x2="${x0 + 7}" y2="${f(y)}" stroke="#555" stroke-width="1"/><text x="${x0 - 3}" y="${f(y + 3.5)}" font-size="10" text-anchor="end" fill="#444" font-family="${FONT}">${z} m</text>`; }
    out.push(`<g data-role="ruler"><line x1="${x0 + 7}" y1="${f(yBase)}" x2="${x0 + 7}" y2="${f(yBase - zMax * cs * s)}" stroke="#555" stroke-width="1"/>${ticks}</g>`);
  }
  // nord : direction projetée à l'écran
  {
    const eN = 0; const nN = 1; // vecteur nord en boussole
    const sx = eN * cam.R.e + nN * cam.R.n;
    const up = (eN * cam.D.e + nN * cam.D.n) * Math.sin((Math.max(elev, 35) * Math.PI) / 180);
    const ang = (Math.atan2(sx, up) * 180) / Math.PI;
    out.push(northSVG(ax + aw - 34, ay + 40, ang));
  }
  out.push(scaleBarSVG(ax + 14, ay + ah - 16, s));
  out.push(fr.legendSVG);

  if (layers.cartouche === false) out.push(captionSVG(opts.caption || VIEW_TEXT[view], { W, H, MARGIN, CART_H }));
  else {
    out.push(cartoucheSVG(garden, { W, H, MARGIN, CART_H, line2: `Vue ${VIEW_TEXT[view]}`, line3: `${age === 'young' ? 'Jeunes plants' : 'À maturité'} · ${monthLabel(month)} · échelle approx.` }));
  }
  const gd = grads.defs();
  const descr = describePlan(garden, lookup);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="${P}-t ${P}-d" font-family="${FONT}" data-view="${view}"><title id="${P}-t">Jardin « ${esc(garden.name || 'Mon jardin')} », ${esc(VIEW_TEXT[view])}</title><desc id="${P}-d">${esc(descr || 'Jardin sans zone.')}</desc><defs>${defs.join('')}${gd}</defs>${out.join('')}</svg>`;
}

/** Feuille de contact : vue du dessus + quatre isométriques (grille 2 × 3, dernière case = légende des essences). */
export function renderContactSheet(garden, opts = {}) {
  const month = normMonth(opts.month);
  const age = opts.age === 'young' ? 'young' : 'adult';
  const lookup = opts.plantLookup || getPlant;
  const CW = 1000; const CH = 760; const TOP = 70;
  const W = CW * 2; const HH = TOP + CH * 3;
  const ids = ['top', 'iso-ne', 'iso-se', 'iso-sw', 'iso-nw'];
  const cells = ids.map((v, i) => {
    const svg = renderViewSVG(garden, { view: v, month, age, width: CW, height: CH, idPrefix: `c${i}`, plantLookup: opts.plantLookup, layers: { legend: false, cartouche: false, dims: false }, caption: VIEWS.find((q) => q.id === v).label === 'Dessus' ? 'Dessus' : `Vue ${VIEW_TEXT[v].replace('isométrique depuis le ', '')}` });
    const x = (i % 2) * CW; const y = TOP + Math.floor(i / 2) * CH;
    return `<g>${svg.replace(/^<svg [^>]*>/, `<svg x="${x}" y="${y}" width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}" font-family="${FONT}">`)}<rect x="${x}" y="${y}" width="${CW}" height="${CH}" fill="none" stroke="#9aa" stroke-width="1"/></g>`;
  });
  // case 6 : légende
  const used = usedZoneTypes(garden.zones);
  const items = buildLegendItems(garden, lookup, { legend: true, sun: false }, { P: 'cs', compact: false, sun: false });
  const lx = CW; const ly = TOP + CH * 2;
  let y = 50; let col = 0; const parts = [];
  for (const it of items) {
    if (y + it.h > CH - 20) { col++; y = 50; }
    parts.push(`<g transform="translate(${lx + 30 + col * 300} ${ly + y})">${it.svg}</g>`);
    y += it.h;
  }
  const dateTxt = `${esc(monthLabel(month))} · ${age === 'young' ? 'jeunes plants' : 'à maturité'}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${HH}" width="${W}" height="${HH}" font-family="${FONT}" role="img"><title>Vues du jardin « ${esc(garden.name || 'Mon jardin')} »</title><defs>${patternDefs('cs', used, false).join('')}</defs><rect width="${W}" height="${HH}" fill="#fff"/><text x="30" y="46" font-size="30" font-weight="700" fill="#1b1b1b">${esc(garden.name || 'Mon jardin')}</text><text x="${W - 30}" y="46" font-size="20" text-anchor="end" fill="#555">${dateTxt}</text>${cells.join('')}<rect x="${lx}" y="${ly}" width="${CW}" height="${CH}" fill="#fafaf5" stroke="#9aa" stroke-width="1"/>${parts.join('')}</svg>`;
}

