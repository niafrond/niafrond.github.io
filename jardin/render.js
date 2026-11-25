// Rendu vectoriel du plan : renderPlanSVG(garden, opts) → string SVG autonome (pur, sans DOM).
// Les essences sont dessinées avec leurs vraies couleurs (feuillage + floraison selon la saison).
import { bounds, centroid, pointInPolygon, shapePolygon, shapeBounds, signedArea, distance } from './geometry.js';
import { getZoneType } from './model.js';
import { getPlant } from './catalog.js';
import { gardenCost, formatEuro } from './pricing.js';
import {
  FONT, OBSTACLE_LABELS, BARE_WOOD, BARE_HERB, SUN_COLORS, esc, f, frNum, darken, lighten, mixHex, rngOf,
  normMonth, monthLabel, plantState, placePlants, shadowDir, GradRegistry, buildLegendItems, makeFrame, northSVG, scaleBarSVG,
  cartoucheSVG, describePlan as describeCommon, patternDefs, plantHeightM, lawnPatternDef, captionSVG,
} from './render-common.js';

export { placePlants } from './render-common.js';
export const describePlan = (garden) => describeCommon(garden, getPlant);

/** Famille de dessin d'une essence. */
export function plantKind(plant) {
  const c = plant.category;
  if (c === 'tree' || (c === 'fruit' && (plant.heightAdult || 0) >= 3)) return 'tree';
  if (c === 'shrub' || c === 'hedge' || c === 'climber' || c === 'fruit') return 'shrub';
  if (c === 'aquatic') return (plant.heightAdult || 0) >= 0.5 ? 'grass' : 'aquatic';
  return ['perennial', 'groundcover', 'grass', 'bulb', 'vegetable', 'lawn'].includes(c) ? c : 'shrub';
}

const PI2 = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function lobes(cx, cy, rp, n, R, spread, size) {
  const out = [];
  const a0 = R() * PI2;
  for (let k = 0; k < n; k++) {
    const a = a0 + (k / n) * PI2 + (R() - 0.5) * 0.6;
    const d = rp * spread * (0.65 + 0.35 * R());
    out.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, r: rp * size * (0.82 + 0.36 * R()) });
  }
  return out;
}

const starPath = (x, y, r) => {
  let d = '';
  for (let k = 0; k < 8; k++) { const rr = k % 2 ? r * 0.45 : r; const a = (k / 8) * PI2 - Math.PI / 2; d += `${k ? 'L' : 'M'}${f(x + Math.cos(a) * rr)} ${f(y + Math.sin(a) * rr)}`; }
  return `${d}Z`;
};

/** Petits points (ou étoiles) de floraison, groupés en bouquets. */
function flowerDots(cx, cy, rp, flc, R, n, star = false, fr0 = 0) {
  const clusters = Math.max(1, Math.round(n / 4));
  const cc = [];
  for (let k = 0; k < clusters; k++) { const a = R() * PI2; const d = Math.sqrt(R()) * rp * 0.62; cc.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d]); }
  const fr = fr0 || clamp(rp * 0.075, 0.9, 3.2);
  let body = '';
  for (let i = 0; i < n; i++) {
    const [px, py] = cc[i % clusters];
    const a = R() * PI2; const d = R() * rp * 0.3;
    const x = px + Math.cos(a) * d; const y = py + Math.sin(a) * d;
    body += star ? `<path d="${starPath(x, y, fr * 1.5)}"/>` : `<circle cx="${f(x)}" cy="${f(y)}" r="${f(fr)}"/>`;
  }
  return `<g data-flower="1" fill="${flc}" stroke="${darken(flc, 0.35)}" stroke-width=".45">${body}</g>`;
}

function crown(cx, cy, rp, fo, R, ctx, n, spread, size) {
  const dk = darken(fo, 0.3); const lt = lighten(fo, 0.3);
  let s;
  if (ctx.illus) {
    s = `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rp)}" fill="url(#${ctx.grads.id(fo)})" stroke="${darken(fo, 0.45)}" stroke-width=".7"/>`;
    for (const l of lobes(cx, cy, rp, n, R, spread, size)) s += `<circle cx="${f(l.x)}" cy="${f(l.y)}" r="${f(l.r)}" fill="${fo}" fill-opacity=".38" stroke="${dk}" stroke-opacity=".35" stroke-width=".5"/>`;
    for (const l of lobes(cx, cy, rp * 0.9, Math.max(2, n - 2), R, spread * 0.8, size * 0.5)) s += `<circle cx="${f(l.x - ctx.sv.x * rp * 0.14)}" cy="${f(l.y - ctx.sv.y * rp * 0.14)}" r="${f(l.r)}" fill="${lt}" fill-opacity=".38"/>`;
  } else {
    s = `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rp)}" fill="${fo}" fill-opacity=".88" stroke="${darken(fo, 0.42)}" stroke-width="1"/>`;
    for (const l of lobes(cx, cy, rp, n, R, spread, size)) s += `<circle cx="${f(l.x)}" cy="${f(l.y)}" r="${f(l.r)}" fill="${dk}" fill-opacity=".22"/>`;
  }
  return s;
}

function bareBranches(cx, cy, rp, R, illus) {
  const n = 6; let d = '';
  const a0 = R() * PI2;
  for (let k = 0; k < n; k++) {
    const a = a0 + (k / n) * PI2 + (R() - 0.5) * 0.5;
    const L = rp * (0.8 + 0.2 * R());
    const ex = cx + Math.cos(a) * L; const ey = cy + Math.sin(a) * L;
    const bend = (R() - 0.5) * rp * 0.35;
    d += `M${f(cx)} ${f(cy)}Q${f(cx + Math.cos(a) * L * 0.5 - Math.sin(a) * bend)} ${f(cy + Math.sin(a) * L * 0.5 + Math.cos(a) * bend)} ${f(ex)} ${f(ey)}`;
    for (const t of [0.55, 0.8]) {
      const bx = cx + Math.cos(a) * L * t; const by = cy + Math.sin(a) * L * t;
      for (const side of [-1, 1]) { const b2 = a + side * (0.55 + R() * 0.3); d += `M${f(bx)} ${f(by)}L${f(bx + Math.cos(b2) * rp * 0.28)} ${f(by + Math.sin(b2) * rp * 0.28)}`; }
    }
  }
  const w = clamp(rp * 0.05, 0.7, 2.2);
  return `${illus ? `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rp * 0.96)}" fill="#fff" fill-opacity=".1" stroke="${BARE_WOOD}" stroke-opacity=".22" stroke-dasharray="2 3" stroke-width=".6"/>` : ''}<path d="${d}" fill="none" stroke="${BARE_WOOD}" stroke-width="${f(w)}" stroke-linecap="round" data-bare="1"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(clamp(rp * 0.08, 1.2, 3))}" fill="#5d4a3a"/>`;
}

function leafPath(cx, cy, a, L, wd) {
  const ex = cx + Math.cos(a) * L; const ey = cy + Math.sin(a) * L;
  const nx = -Math.sin(a) * wd; const ny = Math.cos(a) * wd;
  const mx = cx + Math.cos(a) * L * 0.5; const my = cy + Math.sin(a) * L * 0.5;
  return `M${f(cx)} ${f(cy)}Q${f(mx + nx)} ${f(my + ny)} ${f(ex)} ${f(ey)}Q${f(mx - nx)} ${f(my - ny)} ${f(cx)} ${f(cy)}Z`;
}

/** Corps du symbole d'un plant (coordonnées absolues). */
function symbolBody(pp, st, kind, cx, cy, rp, ctx) {
  const R = rngOf(pp);
  const fo = st.foliage;
  const illus = ctx.illus;
  const fl = st.flowering ? st.flower : null;
  let s = '';
  if (rp < 3.4 && kind !== 'bulb' && kind !== 'grass') {
    const col = st.bare ? BARE_WOOD : fo;
    s = `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rp)}" fill="${col}" fill-opacity=".9" stroke="${darken(col, 0.4)}" stroke-width=".6"/>`;
    if (fl) s += flowerDots(cx, cy, rp, fl, R, 3, false, 0.9);
    return s;
  }
  switch (kind) {
    case 'tree':
    case 'shrub': {
      if (st.bare) s = bareBranches(cx, cy, rp, R, illus);
      else s = crown(cx, cy, rp, fo, R, ctx, kind === 'tree' ? (illus ? 7 : 5) : (illus ? 5 : 4), kind === 'tree' ? 0.5 : 0.45, kind === 'tree' ? 0.5 : 0.55);
      if (fl) s += flowerDots(cx, cy, rp, fl, R, clamp(Math.round(rp * (kind === 'tree' ? 0.9 : 1.1)), 6, 30), false);
      break;
    }
    case 'perennial': {
      const dormant = st.bare;
      const col = dormant ? BARE_HERB : fo;
      s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rp * 0.5)}" fill="${col}" fill-opacity="${dormant ? 0.5 : 0.85}"${dormant ? ' data-bare="1"' : ''}/>`;
      const n = rp < 7 ? 5 : 7; const a0 = R() * PI2;
      for (let k = 0; k < n; k++) s += `<path d="${leafPath(cx, cy, a0 + (k / n) * PI2, rp * (dormant ? 0.75 : 0.95) * (0.85 + 0.2 * R()), rp * 0.28)}" fill="${k % 2 ? col : lighten(col, 0.18)}" fill-opacity="${dormant ? 0.55 : 0.92}" stroke="${darken(col, 0.4)}" stroke-width=".6"/>`;
      if (fl) s += flowerDots(cx, cy, rp, fl, R, clamp(Math.round(rp / 2.8), 3, 9), rp >= 7, clamp(rp * 0.1, 1.1, 3.2));
      break;
    }
    case 'groundcover': {
      const dormant = st.bare;
      const col = dormant ? mixHex(fo, BARE_HERB, 0.7) : fo;
      s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rp * 0.8)}" fill="${col}" fill-opacity=".9"${dormant ? ' data-bare="1"' : ''}/>`;
      for (const l of lobes(cx, cy, rp, 5, R, 0.45, 0.5)) s += `<circle cx="${f(l.x)}" cy="${f(l.y)}" r="${f(l.r)}" fill="${R() > 0.5 ? col : darken(col, 0.12)}" fill-opacity=".85"/>`;
      if (fl) s += flowerDots(cx, cy, rp, fl, R, clamp(Math.round(rp * 1.4), 6, 30), false, clamp(rp * 0.07, 0.9, 2));
      break;
    }
    case 'grass': {
      const dormant = st.bare;
      const col = dormant ? BARE_HERB : fo;
      const n = 11; const a0 = R() * PI2;
      let tips = '';
      let d1 = ''; let d2 = '';
      for (let k = 0; k < n; k++) {
        const a = a0 + (k / n) * PI2; const L = rp * (0.8 + 0.25 * R());
        const ex = cx + Math.cos(a) * L; const ey = cy + Math.sin(a) * L;
        const seg = `M${f(cx)} ${f(cy)}Q${f(cx + Math.cos(a + 0.5) * L * 0.55)} ${f(cy + Math.sin(a + 0.5) * L * 0.55)} ${f(ex)} ${f(ey)}`;
        if (k % 2) d1 += seg; else d2 += seg;
        if (fl && k % 2 === 0) tips += `<ellipse cx="${f(ex)}" cy="${f(ey)}" rx="${f(clamp(rp * 0.1, 1, 3))}" ry="${f(clamp(rp * 0.16, 1.4, 4.5))}" transform="rotate(${f((a * 180) / Math.PI + 90)} ${f(ex)} ${f(ey)})"/>`;
      }
      const w = clamp(rp * 0.07, 0.8, 2);
      s += `<path d="${d2}" fill="none" stroke="${darken(col, 0.18)}" stroke-width="${f(w)}" stroke-linecap="round"${dormant ? ' data-bare="1"' : ''}/><path d="${d1}" fill="none" stroke="${col}" stroke-width="${f(w)}" stroke-linecap="round"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(Math.max(1, rp * 0.1))}" fill="${darken(col, 0.3)}"/>`;
      if (tips) s += `<g data-flower="1" fill="${fl}" stroke="${darken(fl, 0.35)}" stroke-width=".4">${tips}</g>`;
      break;
    }
    case 'bulb': {
      const dormant = st.bare;
      const col = dormant ? BARE_HERB : fo;
      const r2 = Math.max(rp, 2.6);
      if (dormant) { s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r2 * 0.4)}" fill="${BARE_HERB}" fill-opacity=".6" data-bare="1"/>`; break; }
      for (let k = 0; k < 4; k++) { const a = R() * PI2; s += `<path d="${leafPath(cx, cy, a, r2 * 1.05, r2 * 0.3)}" fill="${col}" stroke="${darken(col, 0.4)}" stroke-width=".5"/>`; }
      if (fl) s += flowerDots(cx, cy, r2 * 1.2, fl, R, 3, false, clamp(r2 * 0.55, 1.5, 3.4));
      break;
    }
    case 'vegetable': {
      const dormant = st.bare;
      const col = dormant ? mixHex(fo, BARE_HERB, 0.7) : fo;
      const n = 6; const a0 = R() * PI2;
      s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rp * 0.9)}" fill="${darken(col, 0.18)}" fill-opacity=".5"${dormant ? ' data-bare="1"' : ''}/>`;
      for (let k = 0; k < n; k++) { const a = a0 + (k / n) * PI2; s += `<circle cx="${f(cx + Math.cos(a) * rp * 0.45)}" cy="${f(cy + Math.sin(a) * rp * 0.45)}" r="${f(rp * 0.42)}" fill="${k % 2 ? col : lighten(col, 0.15)}" stroke="${darken(col, 0.4)}" stroke-width=".5"/>`; }
      s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rp * 0.22)}" fill="${lighten(col, 0.35)}"/>`;
      if (fl) s += flowerDots(cx, cy, rp, fl, R, 3, false, clamp(rp * 0.12, 1, 2.6));
      break;
    }
    case 'aquatic': {
      const dormant = st.bare;
      const col = dormant ? mixHex(fo, BARE_HERB, 0.6) : fo;
      const a = R() * PI2; const a2 = a + 0.5;
      s += `<path d="M${f(cx)} ${f(cy)}L${f(cx + Math.cos(a) * rp)} ${f(cy + Math.sin(a) * rp)}A${f(rp)} ${f(rp)} 0 1 1 ${f(cx + Math.cos(a2) * rp)} ${f(cy + Math.sin(a2) * rp)}Z" fill="${col}" fill-opacity=".92" stroke="${darken(col, 0.4)}" stroke-width=".8"${dormant ? ' data-bare="1"' : ''}/>`;
      s += `<path d="M${f(cx)} ${f(cy)}L${f(cx + Math.cos(a + 2) * rp * 0.8)} ${f(cy + Math.sin(a + 2) * rp * 0.8)}M${f(cx)} ${f(cy)}L${f(cx + Math.cos(a + 3.8) * rp * 0.8)} ${f(cy + Math.sin(a + 3.8) * rp * 0.8)}" stroke="${darken(col, 0.3)}" stroke-width=".5" fill="none"/>`;
      if (fl) s += `<g data-flower="1" fill="${fl}" stroke="${darken(fl, 0.35)}" stroke-width=".5"><path d="${starPath(cx, cy, clamp(rp * 0.55, 2.2, 9))}"/></g>`;
      break;
    }
    default:
      s = `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rp)}" fill="${fo}"/>`;
  }
  return s;
}

/**
 * Plan SVG autonome.
 * @param {object} garden
 * @param {{view?:'plan'|'illustrated', age?:'adult'|'young', month?:number|null, layers?:{dims?:boolean,legend?:boolean,sun?:boolean,names?:boolean,budget?:boolean},
 *          width?:number, height?:number, idPrefix?:string, plantLookup?:Function}} opts
 *   `month` : 1–12 ou null = pleine floraison (toutes les couleurs de fleurs visibles).
 */
export function renderPlanSVG(garden, opts = {}) {
  const view = opts.view === 'illustrated' ? 'illustrated' : 'plan';
  const age = opts.age === 'young' ? 'young' : 'adult';
  const month = normMonth(opts.month);
  const layers = { dims: true, legend: true, sun: false, names: true, budget: false, ...(opts.layers || {}) };
  const W = Math.max(320, Math.round(opts.width || 1000));
  const H = Math.max(240, Math.round(opts.height || 760));
  const P = opts.idPrefix || 'jp';
  const lookup = opts.plantLookup || getPlant;
  const illus = view === 'illustrated';

  const boundary = garden.boundary || [];
  const zones = garden.zones || [];
  const obstacles = garden.obstacles || [];
  const northAngle = Number(garden.context && garden.context.northAngle) || 0;
  const sv = shadowDir(northAngle);

  // --- emprise monde ---
  const all = [...boundary];
  for (const z of zones) { const b = shapeBounds(z.shape); if (b && Number.isFinite(b.minX)) all.push({ x: b.minX, y: b.minY }, { x: b.maxX, y: b.maxY }); }
  for (const o of obstacles) {
    if (o.points) all.push(...o.points);
    else if (o.center) { const r = o.radius || 1; all.push({ x: o.center.x - r, y: o.center.y - r }, { x: o.center.x + r, y: o.center.y + r }); }
  }
  let wb = all.length ? bounds(all) : { minX: 0, minY: 0, maxX: 10, maxY: 8, width: 10, height: 8 };
  if (wb.width < 1) wb = { ...wb, maxX: wb.minX + 1, width: 1 };
  if (wb.height < 1) wb = { ...wb, maxY: wb.minY + 1, height: 1 };

  const used = new Set(zones.map((z) => z.type));
  const fr = makeFrame(W, H, layers, (compact) => buildLegendItems(garden, lookup, layers, { P, compact, sun: layers.sun }));
  const { ax, ay, aw, ah, MARGIN, CART_H } = fr;
  const pad = 26;
  const S = Math.min((aw - pad * 2) / wb.width, (ah - pad * 2) / wb.height);
  const ox = ax + (aw - wb.width * S) / 2;
  const oy = ay + (ah - wb.height * S) / 2;
  const tx = (x) => ox + (x - wb.minX) * S;
  const ty = (y) => oy + (y - wb.minY) * S;
  const pts = (poly) => poly.map((p) => `${f(tx(p.x))},${f(ty(p.y))}`).join(' ');

  const grads = new GradRegistry(P, { x: -sv.x, y: -sv.y });
  const lawnPats = new Map();
  const defs = patternDefs(P, used, illus);
  defs.push(`<pattern id="${P}-pat-house" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8L8 0" stroke="#616161" stroke-width="1"/></pattern>`);
  if (illus) {
    defs.push(`<filter id="${P}-shadow" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="2" dy="3" stdDeviation="2.5" flood-color="#000" flood-opacity=".28"/></filter>`);
    defs.push(`<filter id="${P}-tshadow" x="-30%" y="-30%" width="170%" height="170%"><feDropShadow dx="3" dy="4" stdDeviation="3" flood-color="#000" flood-opacity=".3"/></filter>`);
    defs.push(`<filter id="${P}-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2"/></filter>`);
    defs.push(`<linearGradient id="${P}-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3f7e6"/><stop offset="1" stop-color="#dfe9c8"/></linearGradient>`);
    defs.push(`<linearGradient id="${P}-lot" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfe7a8"/><stop offset="1" stop-color="#a9cf7c"/></linearGradient>`);
  }

  const out = [];
  out.push(`<rect width="${W}" height="${H}" fill="${illus ? `url(#${P}-bg)` : '#ffffff'}"/>`);
  out.push(`<rect x="${ax}" y="${ay}" width="${f(aw)}" height="${f(ah)}" fill="none" stroke="#c8c8c8" stroke-width="0.6"/>`);

  // Terrain
  if (boundary.length >= 2) {
    const closed = garden.boundaryClosed !== false && boundary.length >= 3;
    if (closed) out.push(`<polygon points="${pts(boundary)}" fill="${illus ? `url(#${P}-lot)` : '#fafaf5'}" stroke="#2b2b2b" stroke-width="${illus ? 2.2 : 2}" stroke-linejoin="round"${illus ? ` filter="url(#${P}-shadow)"` : ''}/>`);
    else out.push(`<polyline points="${pts(boundary)}" fill="none" stroke="#2b2b2b" stroke-width="2" stroke-dasharray="6 4"/>`);
  }

  // Ensoleillement
  const sun = garden.sun || {};
  if (layers.sun && sun.mode === 'uniform' && sun.uniform && boundary.length >= 3) {
    out.push(`<polygon points="${pts(boundary)}" fill="${SUN_COLORS[sun.uniform]}" fill-opacity=".30" stroke="none"/>`);
  } else if (layers.sun && sun.mode === 'map') {
    for (const r of sun.regions || []) {
      if (!r.points || r.points.length < 3) continue;
      out.push(`<polygon points="${pts(r.points)}" fill="${SUN_COLORS[r.level] || '#999'}" fill-opacity=".34" stroke="${SUN_COLORS[r.level] || '#999'}" stroke-opacity=".5" stroke-width="0.8"/>`);
    }
  }

  // Obstacles (sous les zones pour maison/mur, au-dessus pour arbre existant)
  const obstacleEl = (o) => {
    const label = OBSTACLE_LABELS[o.kind] || 'Obstacle';
    const hTxt = o.height ? ` h ${frNum(o.height, 1)} m` : '';
    if (o.kind === 'tree' && o.center) {
      const r = (o.radius || 1.5) * S;
      return `<g><circle cx="${f(tx(o.center.x))}" cy="${f(ty(o.center.y))}" r="${f(r)}" fill="#558b2f" fill-opacity=".22" stroke="#33691e" stroke-dasharray="5 3" stroke-width="1.2"${illus ? ` filter="url(#${P}-tshadow)"` : ''}/><circle cx="${f(tx(o.center.x))}" cy="${f(ty(o.center.y))}" r="3" fill="#33691e"/>${layers.names ? `<text x="${f(tx(o.center.x))}" y="${f(ty(o.center.y) + r + 12)}" font-size="10" text-anchor="middle" fill="#33691e" font-family="${FONT}">${esc(label)}${hTxt}</text>` : ''}</g>`;
    }
    if (!o.points || o.points.length < 2) return '';
    if (o.kind === 'wall') return `<polyline points="${pts(o.points)}" fill="none" stroke="#424242" stroke-width="${f(Math.max(4, 0.3 * S))}" stroke-linecap="square"/>`;
    if (o.kind === 'fence') return `<polyline points="${pts(o.points)}" fill="none" stroke="#6d4c41" stroke-width="2.2" stroke-dasharray="7 3"/>`;
    const c = centroid(o.points);
    const body = `<polygon points="${pts(o.points)}" fill="${illus ? (o.kind === 'house' ? '#d7ccc8' : '#e0d8c8') : '#e3e3e3'}" stroke="#424242" stroke-width="1.6"${illus ? ` filter="url(#${P}-shadow)"` : ''}/>`
      + (!illus ? `<polygon points="${pts(o.points)}" fill="url(#${P}-pat-house)" opacity=".45"/>` : '');
    return `<g>${body}<text x="${f(tx(c.x))}" y="${f(ty(c.y) + 4)}" font-size="11" text-anchor="middle" fill="#37474f" font-family="${FONT}">${esc(label)}${hTxt}</text></g>`;
  };
  obstacles.filter((o) => o.kind !== 'tree').forEach((o) => out.push(obstacleEl(o)));

  // Zones : sol puis canopée ; les plants sont collectés puis dessinés du plus bas au plus haut
  const sorted = [...zones].sort((a, b) => ((getZoneType(a.type) || {}).layer === 'canopy') - ((getZoneType(b.type) || {}).layer === 'canopy'));
  const labels = [];
  const placed = [];
  for (const z of sorted) {
    const t = getZoneType(z.type);
    if (!t || !z.shape) continue;
    const poly = shapePolygon(z.shape, 48);
    if (poly.length < 3) continue;
    const canopy = t.layer === 'canopy';
    const stroke = darken(t.color, 0.35);
    const fill = illus ? `url(#${P}-g-${t.id})` : t.color;
    const op = canopy ? 0.45 : illus ? 0.95 : 0.6;
    const geom = (a) => (z.shape.kind === 'circle'
      ? `<circle cx="${f(tx(z.shape.center.x))}" cy="${f(ty(z.shape.center.y))}" r="${f(z.shape.radius * S)}" ${a}/>`
      : `<polygon points="${pts(poly)}" stroke-linejoin="round" ${a}/>`);
    let extra = '';
    const pl = placePlants(garden, z, lookup, { age });
    for (const pp of pl) {
      if (pp.fill) {
        const st = plantState(pp.plant, month);
        const id = `${P}-lawn-${st.foliage.slice(1)}`;
        if (!lawnPats.has(id)) lawnPats.set(id, st.foliage);
        extra += geom(`fill="${st.foliage}" fill-opacity="${illus ? 0.6 : 0.5}" stroke="none"`) + geom(`fill="url(#${id})" stroke="none"`);
        if (st.flowering) {
          const R = rngOf(pp); let dots = '';
          const bb = bounds(poly);
          for (let i = 0, k = 0; i < 40 && k < 400; k++) { const p = { x: bb.minX + R() * bb.width, y: bb.minY + R() * bb.height }; if (pointInPolygon(p, poly)) { dots += `<circle cx="${f(tx(p.x))}" cy="${f(ty(p.y))}" r="1.5"/>`; i++; } }
          extra += `<g data-flower="1" fill="${st.flower}" stroke="${darken(st.flower, 0.35)}" stroke-width=".4">${dots}</g>`;
        }
      } else placed.push({ pp, z });
    }
    out.push(`<g data-zone="${esc(z.id)}">${geom(`fill="${fill}" fill-opacity="${op}" stroke="${stroke}" stroke-width="1.4"${canopy ? ' stroke-dasharray="6 3"' : ''}${illus ? ` filter="url(#${P}-shadow)"` : ''}`)}${geom(`fill="url(#${P}-pat-${t.id})" fill-opacity="${illus ? 0.35 : 0.8}" stroke="none"`)}${extra}</g>`);
    labels.push({ z, t, c: centroid(poly) });
  }
  placed.sort((a, b) => (a.pp.plant.heightAdult || 0) - (b.pp.plant.heightAdult || 0));
  const ctx = { illus, P, grads, sv };
  const shadows = [];
  const bodies = [];
  const nameAt = new Map();
  for (const { pp, z } of placed) {
    const plant = pp.plant;
    const st = plantState(plant, month);
    const kind = plantKind(plant);
    const rp = Math.max(2.2, pp.r * S);
    const cx = tx(pp.x); const cy = ty(pp.y);
    if (illus && (kind === 'tree' || kind === 'shrub') && !st.bare) {
      const d = rp * 0.25 + Math.min(plantHeightM(plant, age), 12) * S * 0.07;
      shadows.push(`<ellipse cx="${f(cx + sv.x * d)}" cy="${f(cy + sv.y * d)}" rx="${f(rp * 1.02)}" ry="${f(rp * 0.92)}"/>`);
    }
    bodies.push(`<g data-plant="${esc(plant.id)}" data-kind="${kind}"${st.bare ? ' data-bare="1"' : ''}${st.flowering ? ' data-flowering="1"' : ''}>${symbolBody(pp, st, kind, cx, cy, rp, ctx)}</g>`);
    const key = `${z.id}|${plant.id}`;
    if (layers.names && !nameAt.has(key)) {
      const cnt = (z.plantings || []).filter((q) => q.plantId === plant.id).reduce((s, q) => s + Math.max(1, Math.round(q.count || 1)), 0);
      nameAt.set(key, `<text x="${f(cx)}" y="${f(cy + rp + 11)}" font-size="10" text-anchor="middle" fill="#1b2a1b" stroke="#fff" stroke-width="2.6" paint-order="stroke" font-family="${FONT}">${esc(plant.commonName)}${cnt > 1 ? ` ×${cnt}` : ''}</text>`);
    }
  }
  if (shadows.length) out.push(`<g filter="url(#${P}-blur)" fill="#000" fill-opacity=".24" data-role="shadows">${shadows.join('')}</g>`);
  out.push(...bodies);
  out.push(...nameAt.values());
  for (const { z, t, c } of labels) {
    out.push(`<text x="${f(tx(c.x))}" y="${f(ty(c.y) + 4)}" font-size="12" font-weight="700" text-anchor="middle" fill="#14210f" stroke="#fff" stroke-width="3" paint-order="stroke" font-family="${FONT}" opacity=".92">${esc(z.label || t.label)}</text>`);
  }
  obstacles.filter((o) => o.kind === 'tree').forEach((o) => out.push(obstacleEl(o)));
  for (const [id, col] of lawnPats) defs.push(lawnPatternDef(id, col));

  // Cotes
  if (layers.dims && boundary.length >= 2) {
    const closed = garden.boundaryClosed !== false && boundary.length >= 3;
    const sa = closed ? signedArea(boundary) : 0;
    const n = boundary.length;
    const edges = closed ? n : n - 1;
    for (let i = 0; i < edges; i++) {
      const a = boundary[i]; const b = boundary[(i + 1) % n];
      const len = distance(a, b);
      if (len < 1e-6) continue;
      const mx = (tx(a.x) + tx(b.x)) / 2; const my = (ty(a.y) + ty(b.y)) / 2;
      const dx = tx(b.x) - tx(a.x); const dy = ty(b.y) - ty(a.y);
      const L = Math.hypot(dx, dy) || 1;
      let nx = dy / L; let ny = -dx / L;
      if (sa < 0) { nx = -nx; ny = -ny; }
      if (!closed) { nx = dy / L; ny = -dx / L; }
      const ox2 = mx + nx * 13; const oy2 = my + ny * 13;
      let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (ang > 90) ang -= 180; else if (ang < -90) ang += 180;
      out.push(`<text transform="translate(${f(ox2)} ${f(oy2)}) rotate(${f(ang)})" font-size="12" text-anchor="middle" dominant-baseline="middle" fill="#0d47a1" stroke="#fff" stroke-width="3" paint-order="stroke" font-family="${FONT}">${frNum(len)} m</text>`);
      out.push(`<line x1="${f(tx(a.x) + nx * 6)}" y1="${f(ty(a.y) + ny * 6)}" x2="${f(tx(b.x) + nx * 6)}" y2="${f(ty(b.y) + ny * 6)}" stroke="#0d47a1" stroke-width="0.8" stroke-opacity=".6"/>`);
    }
  }

  out.push(northSVG(ax + aw - 34, ay + 40, northAngle));
  out.push(scaleBarSVG(ax + 14, ay + ah - 16, S));
  out.push(fr.legendSVG);

  let budgetTxt = '';
  if (layers.budget) {
    try { const bc = gardenCost(garden, lookup); budgetTxt = `Budget estimé ≈ ${formatEuro(bc.total, { digits: 0 })}${bc.unknownCount ? ` (${bc.unknownCount} sans prix)` : ''}`; } catch { /* */ }
  }
  if (layers.cartouche === false) out.push(captionSVG(opts.caption || 'Vue du dessus', { W, H, MARGIN, CART_H }));
  else out.push(cartoucheSVG(garden, { W, H, MARGIN, CART_H, budgetTxt, line2: `Vue ${illus ? 'illustrée' : 'plan'} · ${age === 'young' ? 'jeunes plants' : 'à maturité'} · ${monthLabel(month)}` }));

  const gdefs = grads.defs();
  const descr = describeCommon(garden, lookup);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="${P}-t ${P}-d" font-family="${FONT}"><title id="${P}-t">Plan du jardin « ${esc(garden.name || 'Mon jardin')} »</title><desc id="${P}-d">${esc(descr || 'Plan sans zone.')}</desc><defs>${defs.join('')}${gdefs}</defs>${out.join('')}</svg>`;
}

