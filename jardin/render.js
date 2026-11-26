// Rendu vectoriel du plan : renderPlanSVG(garden, opts) → string SVG autonome (pur, sans DOM).
// Les essences sont dessinées avec leurs vraies couleurs (feuillage + floraison selon la saison).
import { bounds, centroid, pointInPolygon, shapePolygon, shapeBounds, signedArea, distance } from './geometry.js';
import { getZoneType, isAbovePool } from './model.js';
import { getPlant } from './catalog.js';
import { culmColor } from './gl-worker-core.js';
import { renderItemsSVG, itemsLegendEntries, elementAnchors } from './render-items.js';
import { gardenCost, formatEuro } from './pricing.js';
import {
  FONT, OBSTACLE_LABELS, BARE_WOOD, BARE_HERB, SUN_COLORS, esc, f, frNum, darken, lighten, mixHex, rngOf,
  normMonth, monthLabel, plantState, placePlants, shadowDir, GradRegistry, buildLegendItems, makeFrame, northSVG, scaleBarSVG,
  cartoucheSVG, describePlan as describeCommon, cleanSvgNumbers, patternDefs, usedZoneTypes, plantHeightM, lawnPatternDef, captionSVG,
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
const fam0 = (pp) => pp.family || 'dome';
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

export function leafPath(cx, cy, a, L, wd) {
  const ex = cx + Math.cos(a) * L; const ey = cy + Math.sin(a) * L;
  const nx = -Math.sin(a) * wd; const ny = Math.cos(a) * wd;
  const mx = cx + Math.cos(a) * L * 0.5; const my = cy + Math.sin(a) * L * 0.5;
  return `M${f(cx)} ${f(cy)}Q${f(mx + nx)} ${f(my + ny)} ${f(ex)} ${f(ey)}Q${f(mx - nx)} ${f(my - ny)} ${f(cx)} ${f(cy)}Z`;
}


const TREEY = new Set(['round', 'fruit', 'spreading', 'umbrella', 'vase', 'weeping', 'upright', 'arching']);
const lobedPath = (cx, cy, r, n, amp, ph = 0) => { let d = ''; for (let i = 0; i < 48; i++) { const a = (i / 48) * PI2; const rr = r * (1 + amp * Math.cos(n * a + ph)); d += `${i ? 'L' : 'M'}${f(cx + Math.cos(a) * rr)} ${f(cy + Math.sin(a) * rr)}`; } return `${d}Z`; };
const starPath2 = (cx, cy, r, n, inner, ph = 0) => { let d = ''; for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * PI2 + ph; const rr = i % 2 ? r * inner : r; d += `${i ? 'L' : 'M'}${f(cx + Math.cos(a) * rr)} ${f(cy + Math.sin(a) * rr)}`; } return `${d}Z`; };

/**
 * Symbole 2D propre au port (vue de dessus) : couronne dentelée (feuillus), étoile (conifères), rayons (graminées),
 * faisceau de cercles (bambou), rang taillé (haie), tiges le long du mur (grimpantes)… `null` = symbole générique de la catégorie.
 */
function portSymbol(pp, st, fam, cx, cy, rp, ctx) {
  const R = rngOf(pp); const fo = st.foliage; const illus = ctx.illus;
  const fl = st.flowering ? st.flower : null;
  const dk = darken(fo, 0.35); const lt = lighten(fo, 0.3);
  const fill = illus ? `url(#${ctx.grads.id(fo)})` : fo;
  let s = '';
  const ray = (a, L, w, col, curve = 0) => { const ex = cx + Math.cos(a) * L; const ey = cy + Math.sin(a) * L; return `M${f(cx)} ${f(cy)}Q${f(cx + Math.cos(a + curve) * L * 0.6)} ${f(cy + Math.sin(a + curve) * L * 0.6)} ${f(ex)} ${f(ey)}`; };
  switch (fam) {
    case 'round': case 'fruit': case 'spreading': case 'umbrella': case 'vase': case 'weeping': {
      if (st.bare) return bareBranches(cx, cy, rp, R, illus);
      s = `<path d="${lobedPath(cx, cy, rp, fam === 'spreading' ? 9 : 7, fam === 'umbrella' ? 0.04 : 0.1, R() * 6)}" fill="${fill}" stroke="${darken(fo, 0.45)}" stroke-width=".8"/>`;
      for (const l of lobes(cx, cy, rp, 4, R, 0.5, 0.45)) s += `<circle cx="${f(l.x)}" cy="${f(l.y)}" r="${f(l.r)}" fill="${R() > 0.5 ? dk : lt}" fill-opacity=".25"/>`;
      if (fam === 'umbrella') { let d = ''; for (let k = 0; k < 8; k++) d += ray((k / 8) * PI2, rp * 0.92, 1, dk); s += `<path d="${d}" fill="none" stroke="${dk}" stroke-width=".7" stroke-opacity=".6"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(Math.max(1, rp * 0.08))}" fill="#5d4a3a"/>`; }
      if (fam === 'weeping') { let d = ''; for (let k = 0; k < 16; k++) d += ray((k / 16) * PI2 + R() * 0.2, rp * (0.85 + 0.15 * R()), 1, dk, 0.35); s += `<path d="${d}" fill="none" stroke="${dk}" stroke-width="${f(clamp(rp * 0.04, 0.5, 1.2))}" stroke-opacity=".7" stroke-linecap="round"/>`; }
      if (fam === 'vase') s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rp * 0.42)}" fill="${lt}" fill-opacity=".3" stroke="${dk}" stroke-opacity=".4" stroke-width=".6"/>`;
      if (fam === 'fruit' && (st.month == null || (st.month >= 7 && st.month <= 10))) { let d = ''; for (let k = 0; k < clamp(Math.round(rp / 2.5), 4, 12); k++) { const a = R() * PI2; const r2 = Math.sqrt(R()) * rp * 0.75; d += `<circle cx="${f(cx + Math.cos(a) * r2)}" cy="${f(cy + Math.sin(a) * r2)}" r="${f(clamp(rp * 0.06, 0.9, 2.4))}"/>`; } s += `<g data-fruit="1" fill="#d9482b" stroke="#7a1f10" stroke-width=".3">${d}</g>`; }
      if (fl) s += flowerDots(cx, cy, rp, fl, R, clamp(Math.round(rp * 0.9), 6, 30), false);
      return s;
    }
    case 'cone': case 'column': {
      const n = fam === 'cone' ? 10 : 6; const col = darken(fo, 0.22);
      s = `<path d="${starPath2(cx, cy, rp, n, fam === 'cone' ? 0.6 : 0.78, R() * 6)}" fill="${col}" stroke="${darken(fo, 0.55)}" stroke-width=".8" stroke-linejoin="round"/><path d="${starPath2(cx, cy, rp * 0.58, n, 0.55, R() * 6)}" fill="${fo}" fill-opacity=".85"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(Math.max(1, rp * 0.1))}" fill="${darken(fo, 0.6)}"/>`;
      return s;
    }
    case 'palm': {
      let d = ''; for (let k = 0; k < 9; k++) d += leafPath(cx, cy, (k / 9) * PI2 + R() * 0.2, rp * (0.9 + 0.15 * R()), rp * 0.17);
      return `<path d="${d}" fill="${fo}" stroke="${darken(fo, 0.45)}" stroke-width=".6"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(Math.max(1.2, rp * 0.12))}" fill="#6d5846"/>`;
    }
    case 'upright': case 'arching': {
      if (st.bare) return bareBranches(cx, cy, rp, R, illus);
      const n = 9; let d = ''; let tips = '';
      for (let k = 0; k < n; k++) { const a = (k / n) * PI2 + R() * 0.3; const L = rp * (fam === 'upright' ? 0.75 + 0.2 * R() : 0.85 + 0.15 * R()); d += ray(a, L, 1, fo, fam === 'arching' ? 0.5 : 0); tips += `<circle cx="${f(cx + Math.cos(a) * L)}" cy="${f(cy + Math.sin(a) * L)}" r="${f(rp * (fam === 'upright' ? 0.2 : 0.24))}"/>`; }
      s = `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rp * 0.45)}" fill="${fill}" stroke="${darken(fo, 0.4)}" stroke-width=".6"/><path d="${d}" fill="none" stroke="${dk}" stroke-width="${f(clamp(rp * 0.06, 0.6, 1.6))}" stroke-linecap="round"/><g fill="${fo}" fill-opacity=".85" stroke="${dk}" stroke-width=".4">${tips}</g>`;
      if (fl) s += flowerDots(cx, cy, rp, fl, R, clamp(Math.round(rp), 6, 24), false);
      return s;
    }
    case 'bamboo': {
      const cc = ctx.culm || '#5f8a3a'; let culms = ''; let plumes = '';
      const n = 8;
      for (let k = 0; k < n; k++) {
        const a = R() * PI2; const d = Math.sqrt(R()) * rp * 0.58; const x = cx + Math.cos(a) * d; const y = cy + Math.sin(a) * d;
        culms += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(Math.max(0.9, rp * 0.13))}"/>`;
        for (let q = 0; q < 5; q++) { const b = a + q * 1.26 + R() * 0.4; plumes += `M${f(x)} ${f(y)}L${f(x + Math.cos(b) * rp * 0.36)} ${f(y + Math.sin(b) * rp * 0.36)}`; }
      }
      return `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rp * 0.95)}" fill="${fo}" fill-opacity=".38" stroke="${dk}" stroke-opacity=".5" stroke-width=".6" stroke-dasharray="2 2"/><path d="${plumes}" fill="none" stroke="${fo}" stroke-width="${f(clamp(rp * 0.05, 0.6, 1.4))}" stroke-linecap="round"/><g fill="${cc}" stroke="${darken(cc, 0.5)}" stroke-width=".5" data-culms="${n}">${culms}</g>`;
    }
    case 'hedge': {
      const seg = (pp.seg || pp.r * 1.6) * ctx.S * 1.12; const wd = Math.max(3, pp.r * 2 * ctx.S);
      const ang = ((pp.rot || 0) * 180) / Math.PI;
      let dots = ''; for (let k = 0; k < 5; k++) dots += `<circle cx="${f((R() - 0.5) * seg * 0.8)}" cy="${f((R() - 0.5) * wd * 0.6)}" r="${f(wd * 0.14)}" fill="${R() > 0.5 ? lt : dk}" fill-opacity=".35"/>`;
      s = `<g transform="translate(${f(cx)} ${f(cy)}) rotate(${f(ang)})" data-row="1"><rect x="${f(-seg / 2)}" y="${f(-wd / 2)}" width="${f(seg)}" height="${f(wd)}" rx="${f(wd * 0.35)}" fill="${fill}" stroke="${darken(fo, 0.45)}" stroke-width=".7"/>${dots}</g>`;
      if (fl) s += flowerDots(cx, cy, wd * 0.5, fl, R, 4, false);
      return s;
    }
    case 'climber': {
      const a = pp.rot || 0; const L = Math.max(8, pp.r * 2 * ctx.S * 1.3); const dx = Math.cos(a); const dy = Math.sin(a);
      const x0 = cx - dx * L / 2; const y0 = cy - dy * L / 2; const x1 = cx + dx * L / 2; const y1 = cy + dy * L / 2;
      let stems = ''; let leaves = '';
      const n = 5;
      for (let k = 0; k <= n; k++) { const t = k / n; const bx = x0 + (x1 - x0) * t; const by = y0 + (y1 - y0) * t; const nx = -dy * (st.bare ? 0.7 : 1) * Math.min(L * 0.32, 9); const ny = dx * Math.min(L * 0.32, 9); stems += `M${f(bx)} ${f(by)}Q${f(bx + nx * 0.4 + dx * 2 * (R() - 0.5))} ${f(by + ny * 0.4)} ${f(bx + nx)} ${f(by + ny)}`; if (!st.bare) leaves += `<circle cx="${f(bx + nx)}" cy="${f(by + ny)}" r="${f(clamp(L * 0.11, 1.4, 3.4))}"/><circle cx="${f(bx + nx * 0.5)}" cy="${f(by + ny * 0.5)}" r="${f(clamp(L * 0.09, 1.2, 3))}"/>`; }
      const support = pp.wall ? `<line x1="${f(x0)}" y1="${f(y0)}" x2="${f(x1)}" y2="${f(y1)}" stroke="#6d4c41" stroke-width="2" stroke-dasharray="3 2"/>` : `<rect x="${f(cx - 4)}" y="${f(cy - 4)}" width="8" height="8" fill="none" stroke="#6d4c41" stroke-width=".8" stroke-dasharray="2 1.5" transform="rotate(${f((a * 180) / Math.PI)} ${f(cx)} ${f(cy)})"/>`;
      s = `${support}<path d="${stems}" fill="none" stroke="${st.bare ? BARE_WOOD : darken(fo, 0.4)}" stroke-width="1" stroke-linecap="round"${st.bare ? ' data-bare="1"' : ''}/><g fill="${fo}" fill-opacity=".9" stroke="${dk}" stroke-width=".4">${leaves}</g>`;
      if (fl) s += flowerDots(cx + dy * 3, cy - dx * 3, Math.max(rp, 5), fl, R, 5, false, 1.4);
      return s;
    }
    case 'creeping': {
      const col = st.bare ? mixHex(fo, BARE_HERB, 0.7) : fo; let d = ''; let t = '';
      for (let k = 0; k < 6; k++) { const a = R() * PI2; d += ray(a, rp * (0.8 + 0.3 * R()), 1, col, 0.3); t += `<circle cx="${f(cx + Math.cos(a) * rp * 0.9)}" cy="${f(cy + Math.sin(a) * rp * 0.9)}" r="${f(rp * 0.22)}"/>`; }
      s = `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rp * 0.55)}" fill="${col}" fill-opacity=".9"/><path d="${d}" fill="none" stroke="${darken(col, 0.3)}" stroke-width=".8"/><g fill="${col}" fill-opacity=".9" stroke="${darken(col, 0.4)}" stroke-width=".4">${t}</g>`;
      if (fl) s += flowerDots(cx, cy, rp, fl, R, clamp(Math.round(rp), 5, 20), false, 1.2);
      return s;
    }
    case 'blades': case 'fine': case 'reed': {
      const dormant = st.bare; const col = dormant ? BARE_HERB : fo; const n = fam === 'fine' ? 24 : 14; let d = '';
      for (let k = 0; k < n; k++) d += ray((k / n) * PI2 + R() * 0.2, rp * (0.55 + 0.45 * R()), 1, col, fam === 'fine' ? 0.45 : 0.08);
      s = `<path d="${d}" fill="none" stroke="${col}" stroke-width="${f(fam === 'fine' ? 0.7 : clamp(rp * 0.07, 0.9, 1.8))}" stroke-linecap="round"${dormant ? ' data-bare="1"' : ''}/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(Math.max(1, rp * 0.1))}" fill="${darken(col, 0.3)}"/>`;
      if (fam === 'reed') s += `<g fill="#6d4c2f">${[0, 1, 2].map((k) => `<ellipse cx="${f(cx + Math.cos(k * 2.1) * rp * 0.3)}" cy="${f(cy + Math.sin(k * 2.1) * rp * 0.3)}" rx="${f(Math.max(0.8, rp * 0.07))}" ry="${f(Math.max(1.4, rp * 0.17))}"/>`).join('')}</g>`;
      if (fl && fam !== 'reed') s += flowerDots(cx, cy, rp, fl, R, 4, false, 1);
      return s;
    }
    case 'fern': {
      const col = st.bare ? BARE_HERB : fo; let d = ''; let t = '';
      for (let k = 0; k < 8; k++) { const a = (k / 8) * PI2 + R() * 0.2; const L = rp * (0.9 + 0.15 * R()); d += leafPath(cx, cy, a, L, rp * 0.13); for (let q = 1; q < 6; q++) { const px = cx + Math.cos(a) * L * q / 6; const py = cy + Math.sin(a) * L * q / 6; for (const sd of [-1, 1]) t += `M${f(px)} ${f(py)}L${f(px + Math.cos(a + sd * 1.2) * rp * 0.14)} ${f(py + Math.sin(a + sd * 1.2) * rp * 0.14)}`; } }
      return `<path d="${d}" fill="${col}" fill-opacity=".85" stroke="${darken(col, 0.4)}" stroke-width=".5"${st.bare ? ' data-bare="1"' : ''}/><path d="${t}" stroke="${darken(col, 0.45)}" stroke-width=".5" fill="none"/>`;
    }
    case 'rosette': {
      const col = st.bare ? BARE_HERB : fo; let s2 = '';
      for (let k = 0; k < 9; k++) { const a = (k / 9) * PI2 * 1.1 + R() * 0.2; s2 += `<path d="${leafPath(cx, cy, a, rp * (0.8 + 0.2 * (k % 3 === 0)), rp * 0.34)}" fill="${k % 2 ? col : lighten(col, 0.15)}" fill-opacity=".93" stroke="${darken(col, 0.45)}" stroke-width=".6"/><path d="M${f(cx)} ${f(cy)}L${f(cx + Math.cos(a) * rp * 0.8)} ${f(cy + Math.sin(a) * rp * 0.8)}" stroke="${darken(col, 0.4)}" stroke-width=".4" opacity=".6"/>`; }
      s2 += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rp * 0.12)}" fill="${lighten(col, 0.4)}"/>`;
      if (fl) s2 += flowerDots(cx, cy, rp * 0.5, fl, R, 3, false, clamp(rp * 0.1, 1, 2.4));
      return `<g${st.bare ? ' data-bare="1"' : ''}>${s2}</g>`;
    }
    case 'tipi': {
      let d = ''; let t = '';
      for (let k = 0; k < 3; k++) { const a = (k / 3) * PI2 + 0.5; const x = cx + Math.cos(a) * rp * 0.8; const y = cy + Math.sin(a) * rp * 0.8; d += `M${f(x)} ${f(y)}L${f(cx)} ${f(cy)}`; for (const u of [0.3, 0.6]) t += `<circle cx="${f(x + (cx - x) * u)}" cy="${f(y + (cy - y) * u)}" r="${f(rp * 0.2)}"/>`; }
      return `<path d="${d}" stroke="#6d4c41" stroke-width="1" fill="none"/><g fill="${fo}" fill-opacity=".9" stroke="${dk}" stroke-width=".4"${st.bare ? ' opacity=".35"' : ''}>${t}</g><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rp * 0.12)}" fill="#6d4c41"/>`;
    }
    case 'herb': {
      let d = ''; for (let k = 0; k < 14; k++) d += ray((k / 14) * PI2 + R() * 0.2, rp * (0.7 + 0.3 * R()), 1, fo, 0.2);
      s = `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rp * 0.78)}" fill="${fo}" fill-opacity=".85" stroke="${darken(fo, 0.4)}" stroke-width=".6"/><path d="${d}" stroke="${dk}" stroke-width=".6" fill="none" stroke-linecap="round"/>`;
      if (fl) s += flowerDots(cx, cy, rp, fl, R, clamp(Math.round(rp), 5, 16), true, clamp(rp * 0.08, 0.9, 2));
      return s;
    }
    default: return null;
  }
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
 *
 * Options d'impression (PDF), toutes rétro-compatibles (absentes = rendu historique inchangé) :
 *   `layers` accepte aussi `terrain, items (mobilier), existing (bâti, murs, clôtures, portes, plantes existantes), zones, plants,
 *   zoneNames, numbers, frame (nord + échelle), cartouche` (tous vrais par défaut) ;
 *   `ghost: ['terrain'|'existing'|'items'|'zones'|'plants']` : couches dessinées adoucies (opacité ≈ 0,35, niveaux de gris) ;
 *   `numbering: {items: Map(clé → n), species: Map(plantId → n), zones: Map(zoneId → n), every?: boolean}` : pastilles numérotées
 *   (clés d'éléments : voir `elementAnchors`) ; `crop: {zoneId, margin}` : vue rapprochée d'une zone (les autres zones adoucies) ;
 *   `print: true` : pas d'emoji, fond blanc, marges serrées, pas de cartouche ; `bg: 'none'` : fond transparent (calques) ;
 *   `zoneSub: (zone) => string` : seconde ligne sous le nom de zone ; `ghostOpacity`, `ghostGray`.
 */
export function renderPlanSVG(garden, opts = {}) {
  const view = opts.view === 'illustrated' ? 'illustrated' : 'plan';
  const age = opts.age === 'young' ? 'young' : 'adult';
  const month = normMonth(opts.month);
  const layers = { dims: true, legend: true, sun: false, names: true, budget: false, ...(opts.layers || {}) };
  const on = (k) => layers[k] !== false;
  const print = !!opts.print;
  const simple = !!opts.simple; // PDF « simplifié » : aplats sans motifs ni filtres
  const numbering = opts.numbering || null;
  const ghost = new Set(Array.isArray(opts.ghost) ? opts.ghost : []);
  const ghostOp = opts.ghostOpacity > 0 ? opts.ghostOpacity : 0.35;
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
  const cropZone = opts.crop && opts.crop.zoneId ? zones.find((z) => z.id === opts.crop.zoneId) : null;
  if (cropZone && cropZone.shape) {
    const cb = shapeBounds(cropZone.shape);
    if (cb && Number.isFinite(cb.minX)) {
      // marge : au moins 12 % de la plus grande dimension, et le rayon (plafonné) des plus gros plants pour ne rien couper
      let rmax = 0;
      try { for (const pp of placePlants(garden, cropZone, lookup, { age })) if (!pp.fill) rmax = Math.max(rmax, pp.r); } catch { /* */ }
      const m = Math.max(opts.crop.margin >= 0 ? opts.crop.margin : 1.2, 0.12 * Math.max(cb.maxX - cb.minX, cb.maxY - cb.minY), Math.min(rmax, 2.5) + 0.3); all.length = 0; all.push({ x: cb.minX - m, y: cb.minY - m }, { x: cb.maxX + m, y: cb.maxY + m }); }
  }
  let wb = all.length ? bounds(all) : { minX: 0, minY: 0, maxX: 10, maxY: 8, width: 10, height: 8 };
  if (wb.width < 1) wb = { ...wb, maxX: wb.minX + 1, width: 1 };
  if (wb.height < 1) wb = { ...wb, maxY: wb.minY + 1, height: 1 };

  const used = usedZoneTypes(zones);
  let entries = [];
  try { entries = itemsLegendEntries(garden); } catch { entries = []; }
  const itemsExtra = (li) => {
    if (!entries.length) return;
    li(22, `<text font-size="12" font-weight="700" fill="#222" font-family="${FONT}">Aménagements</text>`);
    for (const e of entries) li(19, `<rect y="-11" width="22" height="14" rx="3" fill="${e.color || '#9e9e9e'}" fill-opacity=".8" stroke="#37474f"/><text x="30" font-size="11" fill="#222" font-family="${FONT}">${esc(e.label)}${e.count > 1 ? ` ×${e.count}` : ''}</text>`);
  };
  const fr = makeFrame(W, H, layers, (compact) => buildLegendItems(garden, lookup, layers, { P, compact, sun: layers.sun, extra: itemsExtra }), print ? { margin: 12, cartH: 0 } : {});
  const { ax, ay, aw, ah, MARGIN, CART_H } = fr;
  const pad = print ? 14 : 26;
  const S0 = Math.min((aw - pad * 2) / wb.width, (ah - pad * 2) / wb.height);
  const S = Number.isFinite(S0) && S0 > 0 ? S0 : 1;
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

  if (ghost.size && !simple) defs.push(`<filter id="${P}-ghost" x="0" y="0" width="${W}" height="${H}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">${opts.ghostGray === false ? '' : '<feColorMatrix type="saturate" values="0"/>'}</filter>`);
  const ghostWrap = (key, svg) => (svg && ghost.has(key) ? `<g data-ghost="${key}" opacity="${ghostOp}"${simple ? '' : ` filter="url(#${P}-ghost)"`}>${svg}</g>` : svg);
  const focusGhost = (zid, svg) => (svg && cropZone && zid !== cropZone.id ? `<g data-out-of-focus="1" opacity=".3">${svg}</g>` : svg);

  const out = [];
  const head = [];
  const tail = [];
  if (opts.bg !== 'none') head.push(`<rect width="${W}" height="${H}" fill="${illus && !print ? `url(#${P}-bg)` : '#ffffff'}"/>`);
  if (layers.frame !== false) head.push(`<rect x="${ax}" y="${ay}" width="${f(aw)}" height="${f(ah)}" fill="none" stroke="#c8c8c8" stroke-width="0.6"/>`);

  // Terrain
  const terrainOut = [];
  if (on('terrain') && boundary.length >= 2) {
    const closed = garden.boundaryClosed !== false && boundary.length >= 3;
    if (closed) terrainOut.push(`<polygon points="${pts(boundary)}" fill="${illus ? `url(#${P}-lot)` : '#fafaf5'}" stroke="#2b2b2b" stroke-width="${illus ? 2.2 : 2}" stroke-linejoin="round"${illus ? ` filter="url(#${P}-shadow)"` : ''}/>`);
    else terrainOut.push(`<polyline points="${pts(boundary)}" fill="none" stroke="#2b2b2b" stroke-width="2" stroke-dasharray="6 4"/>`);
  }

  // Ensoleillement
  const sun = garden.sun || {};
  if (on('terrain') && layers.sun && sun.mode === 'uniform' && sun.uniform && boundary.length >= 3) {
    terrainOut.push(`<polygon points="${pts(boundary)}" fill="${SUN_COLORS[sun.uniform]}" fill-opacity=".30" stroke="none"/>`);
  } else if (on('terrain') && layers.sun && sun.mode === 'map') {
    for (const r of sun.regions || []) {
      if (!r.points || r.points.length < 3) continue;
      terrainOut.push(`<polygon points="${pts(r.points)}" fill="${SUN_COLORS[r.level] || '#999'}" fill-opacity=".34" stroke="${SUN_COLORS[r.level] || '#999'}" stroke-opacity=".5" stroke-width="0.8"/>`);
    }
  }
  out.push(ghostWrap('terrain', terrainOut.join('')));

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
  if (on('existing')) out.push(ghostWrap('existing', obstacles.filter((o) => o.kind !== 'tree').map((o) => obstacleEl(o)).join('')));

  // Zones : sol puis canopée ; les plants sont collectés puis dessinés du plus bas au plus haut
  const sorted = [...zones].sort((a, b) => ((getZoneType(a.type) || {}).layer === 'canopy') - ((getZoneType(b.type) || {}).layer === 'canopy'));
  const labels = [];
  const placed = [];
  const fillNums = [];
  const zoneOut = [];
  const fillOut = [];
  const combined = on('zones') && on('plants') && !ghost.has('zones') && !ghost.has('plants') && !cropZone;
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
      : `<polygon points="${pts(poly)}"${/stroke-linejoin=/.test(a) ? '' : ' stroke-linejoin="round"'} ${a}/>`);
    let extra = '';
    const pl = on('plants') || numbering ? placePlants(garden, z, lookup, { age }) : [];
    for (const pp of pl) {
      if (pp.fill) {
        if (numbering) fillNums.push({ pp, z, c: centroid(poly) });
        if (!on('plants')) continue;
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
    // piscine hors sol : paroi (double contour : liseré sombre, margelle claire, liseré fin) et motif d'eau
    const above = isAbovePool(z);
    const wall = above ? `<g data-pool-wall="1">${geom('fill="none" stroke="#455a64" stroke-width="7" stroke-linejoin="round"')}${geom('fill="none" stroke="#e6e1d6" stroke-width="4.6" stroke-linejoin="round"')}${geom('fill="none" stroke="#455a64" stroke-width="1" stroke-linejoin="round"')}</g>` : '';
    const zgeom = `${geom(`fill="${fill}" fill-opacity="${op}" stroke="${stroke}" stroke-width="1.4"${canopy ? ' stroke-dasharray="6 3"' : ''}${illus ? ` filter="url(#${P}-shadow)"` : ''}`)}${simple ? '' : geom(`fill="url(#${P}-pat-${above ? 'pool-above' : t.id})" fill-opacity="${illus ? 0.35 : 0.8}" stroke="none"`)}${wall}`;
    const gopen = `<g data-zone="${esc(z.id)}"${above ? ' data-pool="above"' : ''}>`;
    if (combined) out.push(`${gopen}${zgeom}${extra}</g>`);
    else {
      if (on('zones')) zoneOut.push(focusGhost(z.id, `${gopen}${zgeom}</g>`));
      if (extra && on('plants')) fillOut.push(focusGhost(z.id, `<g data-zone-fill="${esc(z.id)}">${extra}</g>`));
    }
    labels.push({ z, t, c: centroid(poly) });
  }
  placed.sort((a, b) => (a.pp.plant.heightAdult || 0) - (b.pp.plant.heightAdult || 0));
  if (!combined) out.push(ghostWrap('zones', zoneOut.join('')));
  const ctx = { illus, P, grads, sv };
  const shadows = [];
  const bodies = [];
  const nameAt = new Map();
  const badgeAt = new Map(); // `${zoneId}|${plantId}` → {x, y, rp} (premier plant de l'essence dans la zone)
  const everyBadge = [];
  for (const { pp, z } of placed) {
    if (numbering) {
      const key0 = `${z.id}|${pp.plant.id}`;
      const rp0 = Math.max(2.2, pp.r * S);
      if (!badgeAt.has(key0)) badgeAt.set(key0, { x: tx(pp.x), y: ty(pp.y), rp: rp0, plant: pp.plant });
      everyBadge.push({ x: tx(pp.x), y: ty(pp.y), rp: rp0, plant: pp.plant });
    }
    if (!on('plants')) continue;
    const plant = pp.plant;
    const st = plantState(plant, month);
    const kind = plantKind(plant);
    const rp = Math.max(2.2, pp.r * S);
    const cx = tx(pp.x); const cy = ty(pp.y);
    if (illus && (kind === 'tree' || kind === 'shrub') && !st.bare && !['bamboo', 'hedge', 'climber', 'creeping', 'mat'].includes(fam0(pp))) {
      const d = rp * 0.25 + Math.min(plantHeightM(plant, age), 12) * S * 0.07;
      shadows.push(`<ellipse cx="${f(cx + sv.x * d)}" cy="${f(cy + sv.y * d)}" rx="${f(rp * 1.02)}" ry="${f(rp * 0.92)}"/>`);
    }
    const fam = pp.family || 'dome';
    const pctx = { ...ctx, S, culm: culmColor(plant) };
    const port = rp >= 3.4 ? portSymbol(pp, st, fam, cx, cy, rp, pctx) : null;
    bodies.push(focusGhost(z.id, `<g data-plant="${esc(plant.id)}" data-kind="${kind}" data-habit="${pp.habit || ''}" data-family="${fam}"${st.bare ? ' data-bare="1"' : ''}${st.flowering ? ' data-flowering="1"' : ''}>${port != null ? port : symbolBody(pp, st, kind, cx, cy, rp, pctx)}</g>`));
    const key = `${z.id}|${plant.id}`;
    if (layers.names && !nameAt.has(key)) {
      const cnt = (z.plantings || []).filter((q) => q.plantId === plant.id).reduce((s, q) => s + Math.max(1, Math.round(q.count || 1)), 0);
      nameAt.set(key, focusGhost(z.id, `<text x="${f(cx)}" y="${f(cy + rp + 11)}" font-size="10" text-anchor="middle" fill="#1b2a1b" stroke="#fff" stroke-width="2.6" paint-order="stroke" font-family="${FONT}">${esc(plant.commonName)}${cnt > 1 ? ` ×${cnt}` : ''}</text>`));
    }
  }
  // remplissages (pelouse) : au-dessus des zones, sous le mobilier
  if (!combined && fillOut.length) out.push(ghostWrap('plants', fillOut.join('')));
  // aménagements : contour (murs, clôtures, haies), plantes existantes, mobilier, ouvertures
  try {
    const io = { scale: S, tx, ty, names: layers.names, bg: illus ? '#dfe9c8' : '#ffffff', px: 1, emoji: !print };
    if (on('items') && on('existing') && !ghost.has('items') && !ghost.has('existing')) out.push(renderItemsSVG(garden, io));
    else {
      if (on('existing')) out.push(ghostWrap('existing', renderItemsSVG(garden, { ...io, only: ['edges', 'existing', 'openings'] })));
      if (on('items')) out.push(ghostWrap('items', renderItemsSVG(garden, { ...io, only: ['items'] })));
    }
  } catch { /* aménagements facultatifs */ }
  const plantsOut = [];
  if (shadows.length) plantsOut.push(`<g filter="url(#${P}-blur)" fill="#000" fill-opacity=".24" data-role="shadows">${shadows.join('')}</g>`);
  plantsOut.push(...bodies);
  plantsOut.push(...nameAt.values());
  if (ghost.has('plants')) out.push(ghostWrap('plants', plantsOut.join(''))); else out.push(...plantsOut);
  if (on('zoneNames')) {
    for (const { z, t, c } of labels) {
      const zn = numbering && numbering.zones && numbering.zones.get(z.id);
      const sub = typeof opts.zoneSub === 'function' ? opts.zoneSub(z) : '';
      // gros plan : l'étiquette de la zone cadrée est posée au-dessus de sa forme, hors des plants
      const zb = cropZone && cropZone.id === z.id ? shapeBounds(z.shape) : null;
      const lc = zb ? { x: c.x, y: zb.minY - 14 / S } : c;
      out.push(`<text x="${f(tx(lc.x))}" y="${f(ty(lc.y) + 4)}" font-size="12" font-weight="700" text-anchor="middle" fill="#14210f" stroke="#fff" stroke-width="3" paint-order="stroke" font-family="${FONT}" opacity=".92">${zn ? `Z${zn} · ` : ''}${esc(z.label || t.label)}</text>`);
      if (sub && !zb) out.push(`<text x="${f(tx(c.x))}" y="${f(ty(c.y) + 17)}" font-size="10" text-anchor="middle" fill="#2a3a22" stroke="#fff" stroke-width="2.6" paint-order="stroke" font-family="${FONT}">${esc(sub)}</text>`);
    }
  }
  if (on('existing')) out.push(ghostWrap('existing', obstacles.filter((o) => o.kind === 'tree').map((o) => obstacleEl(o)).join('')));
  for (const [id, col] of lawnPats) defs.push(lawnPatternDef(id, col));

  // Pastilles numérotées : éléments (noirs), essences (blanches), zones à étiquette (« Z1 »)
  if (numbering && on('numbers')) {
    const badge = (x, y, label, kind) => {
      const txt = String(label); const w = Math.max(15, 7 + txt.length * 6.6);
      const fillC = kind === 'el' ? '#111' : '#fff'; const txtC = kind === 'el' ? '#fff' : '#111';
      return `<g data-num="${esc(txt)}" data-num-kind="${kind}"><rect x="${f(x - w / 2)}" y="${f(y - 7.5)}" width="${f(w)}" height="15" rx="7.5" fill="${fillC}" stroke="${kind === 'el' ? '#fff' : '#111'}" stroke-width="1.1"/><text x="${f(x)}" y="${f(y + 3.7)}" font-size="10.5" font-weight="700" text-anchor="middle" fill="${txtC}" font-family="${FONT}">${esc(txt)}</text></g>`;
    };
    const nums = [];
    if (numbering.items && numbering.items.size) {
      const anch = elementAnchors(garden);
      for (const [key, n] of numbering.items) { const a = anch.get(key); if (a) nums.push(badge(tx(a.x), ty(a.y), n, 'el')); }
    }
    if (numbering.species && numbering.species.size) {
      const list = numbering.every ? everyBadge.map((b) => ({ ...b, off: 0 })) : [...badgeAt.values()].map((b) => ({ ...b, off: Math.min(b.rp * 0.6, 7) }));
      for (const b of list) { const n = numbering.species.get(b.plant.id); if (n != null) nums.push(badge(b.x + b.off, b.y - b.off, n, 'sp')); }
      for (const fl of fillNums) { const n = numbering.species.get(fl.pp.plant.id); if (n != null) nums.push(badge(tx(fl.c.x), ty(fl.c.y) + (on('zoneNames') ? 30 : 0), n, 'sp')); }
    }
    out.push(`<g data-role="numbers">${nums.join('')}</g>`);
  }

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

  if (layers.frame !== false) {
    tail.push(northSVG(ax + aw - 34, ay + 40, northAngle));
    tail.push(scaleBarSVG(ax + 14, ay + ah - 16, S));
  }
  tail.push(fr.legendSVG);

  let budgetTxt = '';
  if (layers.budget) {
    try { const bc = gardenCost(garden, lookup); budgetTxt = `Budget estimé ≈ ${formatEuro(bc.total, { digits: 0 })}${bc.unknownCount ? ` (${bc.unknownCount} sans prix)` : ''}`; } catch { /* */ }
  }
  if (layers.cartouche === false) { if (!print) tail.push(captionSVG(opts.caption || 'Vue du dessus', { W, H, MARGIN, CART_H })); }
  else tail.push(cartoucheSVG(garden, { W, H, MARGIN, CART_H, budgetTxt, line2: `Vue ${illus ? 'illustrée' : 'plan'} · ${age === 'young' ? 'jeunes plants' : 'à maturité'} · ${monthLabel(month)}` }));

  const gdefs = grads.defs();
  const descr = describeCommon(garden, lookup);
  const svgOut = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="${P}-t ${P}-d" font-family="${FONT}"><title id="${P}-t">Plan du jardin « ${esc(garden.name || 'Mon jardin')} »</title><desc id="${P}-d">${esc(descr || 'Plan sans zone.')}</desc><defs>${defs.join('')}${gdefs}${cropZone ? `<clipPath id="${P}-crop"><rect x="${ax}" y="${ay}" width="${f(aw)}" height="${f(ah)}"/></clipPath>` : ''}</defs>${head.join('')}${cropZone ? `<g clip-path="url(#${P}-crop)" data-crop="${esc(cropZone.id)}">${out.join('')}</g>` : out.join('')}${tail.join('')}</svg>`;
  return cleanSvgNumbers(svgOut);
}
