// Briques communes aux rendus 2D (render.js) et 3D (render3d.js) : couleurs réelles des essences,
// placement déterministe des plants, légende « Essences », cadre (cartouche, nord, échelle). Pur, sans DOM.
import { bounds, polygonArea, centroid, pointInPolygon, shapePolygon } from './geometry.js';
import { ZONE_TYPES, getZoneType, SUN_LABELS, isAbovePool, POOL_ABOVE_LABEL } from './model.js';
import { getPlant } from './catalog.js';
import { habitOf } from './habits.js';
import { effectivePlant } from './heights.js';
import { applyPortLayout, wallSegments, FAMILY, polyAxis, hedgeSeg } from './gl-worker-core.js';

export const FONT = 'Helvetica, Arial, sans-serif';
export const CAT_COLORS = {
  tree: '#2e7d32', shrub: '#558b2f', hedge: '#33691e', fruit: '#e0793c', climber: '#7cb342', perennial: '#ab47bc',
  groundcover: '#66bb6a', grass: '#9e9d24', bulb: '#ec407a', aquatic: '#0288d1', vegetable: '#ef6c00', lawn: '#7cc95a',
};
/** Feuillage par défaut (essences sans couleur renseignée). */
export const FOLIAGE_DEFAULT = {
  tree: '#4f8f3a', shrub: '#5b8f3a', hedge: '#3f7d34', fruit: '#5b9a3f', climber: '#6aa84f', perennial: '#6aa04a',
  groundcover: '#7ab35a', grass: '#9bb05a', bulb: '#6a9a5a', aquatic: '#4f9a6a', vegetable: '#6aa84f', lawn: '#7cc95a',
};
export const SUN_COLORS = { full: '#ffd54f', partial: '#ffa726', shade: '#5c6bc0' };
export const OBSTACLE_LABELS = { house: 'Maison', wall: 'Mur', shed: 'Abri', tree: 'Arbre existant', fence: 'Clôture' };
export const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
export const MONTHS_SHORT = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
export const WINTER_MONTHS = new Set([11, 12, 1, 2, 3]);
export const WOODY_CATS = new Set(['tree', 'shrub', 'hedge', 'fruit', 'climber']);
export const BARE_WOOD = '#7b6c5d';
export const BARE_HERB = '#b8a483';
export const YOUNG_W = 0.4;
export const YOUNG_H = 0.35;

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const f = (n) => (Math.round(n * 100) / 100).toString();
export const frNum = (n, d = 2) => n.toFixed(d).replace('.', ',');

export function safeHex(c) {
  if (typeof c !== 'string') return null;
  const t = c.trim();
  if (/^#[0-9a-f]{6}$/i.test(t)) return t;
  if (/^#[0-9a-f]{3}$/i.test(t)) return `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`.toLowerCase();
  return null;
}
const toRGB = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return null; const v = parseInt(m[1], 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const toHex = (r) => `#${r.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')}`;
export function darken(hex, k = 0.35) { const c = toRGB(hex); return c ? toHex(c.map((x) => x * (1 - k))) : '#333333'; }
export function lighten(hex, k = 0.45) { const c = toRGB(hex); return c ? toHex(c.map((x) => x + (255 - x) * k)) : '#dddddd'; }
export function mixHex(a, b, t) { const A = toRGB(a); const B = toRGB(b); return A && B ? toHex(A.map((x, i) => x + (B[i] - x) * t)) : (a || b); }

export function hash32(s) {
  let h = 2166136261 >>> 0;
  const str = String(s);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** Générateur pseudo-aléatoire déterministe (mulberry32) : () → [0, 1). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rngOf = (pp) => rng(Math.floor((pp.rand || 0) * 4294967296));

export const normMonth = (m) => { const n = Math.round(Number(m)); return m != null && Number.isFinite(n) && n >= 1 && n <= 12 ? n : null; };
export const monthLabel = (m) => { const n = normMonth(m); return n ? MONTHS[n - 1] : 'Pleine floraison'; };

/** État d'une essence pour une saison : couleurs réelles, floraison, dépouillé. `month` null = pleine floraison. */
export function plantState(plant, month) {
  const m = normMonth(month);
  const flower = safeHex(plant.flowerColor);
  const foliage = safeHex(plant.foliageColor) || FOLIAGE_DEFAULT[plant.category] || '#5b8f3a';
  const bloom = Array.isArray(plant.bloom) ? plant.bloom : [];
  return {
    month: m, foliage, flower,
    flowering: !!flower && (m == null || bloom.includes(m)),
    bare: m != null && plant.foliage === 'deciduous' && WINTER_MONTHS.has(m),
    woody: WOODY_CATS.has(plant.category),
  };
}

export const toLookup = (plantsById) => (typeof plantsById === 'function' ? plantsById : (id) => (plantsById ? plantsById[id] : undefined));

/** Vecteur unitaire (écran) de l'ombre portée pour un soleil au sud-ouest : l'ombre part vers le nord-est. */
export function shadowDir(northAngle = 0) {
  const a = (Number(northAngle) || 0) * Math.PI / 180;
  const e = Math.SQRT1_2; const n = Math.SQRT1_2; // nord-est dans le repère boussole
  // repère plan : est = (cos a, sin a), nord = (sin a, -cos a)
  return { x: e * Math.cos(a) + n * Math.sin(a), y: e * Math.sin(a) - n * Math.cos(a) };
}

export const plantRadiusM = (plant, age) => (age === 'young' ? Math.max(0.08, (plant.widthAdult || 1) * 0.5 * YOUNG_W) : Math.max(0.05, (plant.widthAdult || 1) / 2));
export const plantHeightM = (plant, age) => Math.max(0.05, (plant.heightAdult || 0.5) * (age === 'young' ? YOUNG_H : 1));

/**
 * Répartition déterministe des plants d'une zone (identique entre vues 2D et 3D).
 * Grille hexagonale décalée (rangs droits pour le potager) légèrement jitterée (graine = id de zone + id d'essence),
 * limitée à la forme de la zone ; le gazon est un remplissage unique.
 * @returns {{plant:object, x:number, y:number, r:number, rand:number, zoneId:string, fill?:boolean}[]}
 */
export function placePlants(garden, zone, plantsById, opts = {}) {
  const lookup = toLookup(plantsById || getPlant);
  const age = opts.age === 'young' ? 'young' : 'adult';
  const max = opts.max > 0 ? opts.max : 150;
  const shape = zone && zone.shape;
  if (!shape) return [];
  const poly = shapePolygon(shape, 48);
  if (poly.length < 3) return [];
  const zid = String(zone.id ?? '');
  const groups = (zone.plantings || []).map((pl) => ({ pl, plant: effectivePlant(lookup(pl.plantId), pl) })).filter((g) => g.plant)
    .map((g) => ({ ...g, n: Math.max(1, Math.round(g.pl.count || 1)) }));
  if (!groups.length) return [];
  // haies taillées : assez de plants pour couvrir la longueur de la zone (rang continu)
  for (const g of groups) {
    if (habitOf(g.plant).id !== 'hedge-clipped') continue;
    const pts0 = shape.kind === 'line' && shape.points ? shape.points : null;
    let len = 0;
    if (pts0) for (let i = 0; i < pts0.length - 1; i++) len += Math.hypot(pts0[i + 1].x - pts0[i].x, pts0[i + 1].y - pts0[i].y);
    else len = polyAxis(poly).len;
    g.n = Math.max(g.n, Math.min(60, Math.ceil(len / (hedgeSeg(g.plant) * 0.92))));
  }
  const area = polygonArea(poly);
  const c = centroid(poly);
  const inner = pointInPolygon(c, poly) ? c : poly[0];
  const rand0 = (plant, i) => rng(hash32(`${zid}|${plant.id}|${i}`))();
  const out = [];
  for (const g of groups.filter((q) => q.plant.category === 'lawn')) {
    out.push({ plant: g.plant, x: inner.x, y: inner.y, r: Math.sqrt(area / Math.PI), rand: rand0(g.plant, 0), zoneId: zid, fill: true });
  }
  const pts = groups.filter((q) => q.plant.category !== 'lawn');
  if (!pts.length) return out;
  const total = pts.reduce((s, g) => s + g.n, 0);
  const nDraw = Math.min(total, max);
  const rows = pts.every((g) => g.plant.category === 'vegetable');
  const spacing = pts.reduce((s, g) => s + (g.plant.spacing > 0 ? g.plant.spacing : (g.plant.widthAdult || 0.5)), 0) / pts.length * (age === 'young' ? 0.8 : 1);
  const b = bounds(poly);
  const jit = rng(hash32(`${zid}|jitter`));
  const make = (d) => {
    const cand = [];
    if (rows) {
      for (let y = b.minY + d / 2; y <= b.maxY; y += d) for (let x = b.minX + d / 2; x <= b.maxX; x += d) if (pointInPolygon({ x, y }, poly)) cand.push({ x, y });
      return cand;
    }
    let row = 0;
    for (let y = b.minY + d / 2; y <= b.maxY; y += d * 0.866, row++) {
      for (let x = b.minX + d / 2 + (row % 2 ? d / 2 : 0); x <= b.maxX; x += d) {
        const jx = x + (jit() - 0.5) * d * 0.22; const jy = y + (jit() - 0.5) * d * 0.22;
        cand.push(pointInPolygon({ x: jx, y: jy }, poly) ? { x: jx, y: jy } : pointInPolygon({ x, y }, poly) ? { x, y } : null);
      }
    }
    return cand.filter(Boolean);
  };
  let spots = [];
  if (nDraw === 1) spots = [inner];
  else {
    let d = Math.max(Math.sqrt(area / nDraw) * 1.15, spacing);
    let cand = [];
    for (let it = 0; it < 24 && d > 0.04; it++) { cand = make(d); if (cand.length >= nDraw) break; d *= 0.88; }
    if (!cand.length) cand = [inner];
    const m = Math.min(nDraw, cand.length);
    for (let i = 0; i < m; i++) spots.push(cand[Math.min(cand.length - 1, Math.floor(((i + 0.5) * cand.length) / m))]);
  }
  // séquence d'essences (proportionnelle si plafonnée), mélangée de façon déterministe
  const left = pts.map((g) => Math.max(1, Math.round((g.n * nDraw) / total)));
  const seq = [];
  let guard = 0;
  while (seq.length < spots.length && left.some((n) => n > 0) && guard++ < 100000) {
    pts.forEach((g, gi) => { if (left[gi] > 0 && seq.length < spots.length) { seq.push(gi); left[gi]--; } });
  }
  while (seq.length < spots.length) seq.push(seq.length % pts.length);
  if (pts.length > 1) {
    const sh = rng(hash32(`${zid}|mix`));
    for (let i = seq.length - 1; i > 0; i--) { const j = Math.floor(sh() * (i + 1)); [seq[i], seq[j]] = [seq[j], seq[i]]; }
  }
  const idx = new Array(pts.length).fill(0);
  spots.forEach((p, i) => {
    const gi = seq[i]; const plant = pts[gi].plant;
    out.push({ plant, x: p.x, y: p.y, r: plantRadiusM(plant, age), rand: rand0(plant, idx[gi]++), zoneId: zid, group: gi, rot: 0 });
  });
  // ports : haies en rang le long du grand axe, bambous en touffes serrées, grimpantes contre le mur le plus proche
  const mine = out.filter((q) => !q.fill);
  const climbs = mine.some((q) => FAMILY[habitOf(q.plant).id] === 'climber');
  applyPortLayout(mine, poly, { walls: climbs ? wallSegments(garden) : [], line: shape.kind === 'line' && shape.points && shape.points.length >= 2 ? shape.points : null });
  for (const q of mine) {
    const hid = habitOf(q.plant).id; q.habit = hid; q.family = FAMILY[hid] || 'dome';
    if (q.family === 'mat' || q.family === 'creeping') q.r *= 1.35; // nappes qui se chevauchent
    if (q.aux > 0 && q.family === 'hedge') q.seg = q.aux;
  }
  return out;
}

/** Motif de remplissage propre à chaque type de zone (tuile 10×10 px). */
export function patternBody(typeId, stroke) {
  const s = `stroke="${stroke}" stroke-width="0.9" fill="none" stroke-linecap="round"`;
  switch (typeId) {
    case 'pond': return `<path d="M0 3 Q2.5 0 5 3 T10 3 M0 8 Q2.5 5 5 8 T10 8" ${s}/>`;
    case 'pool': return `<path d="M0 0H10V10 M0 5H10 M5 0V10" ${s} stroke-opacity=".55"/>`;
    case 'pool-above': return `<path d="M0 3 Q2.5 0 5 3 T10 3 M0 8 Q2.5 5 5 8 T10 8" ${s} stroke-opacity=".7"/>`;
    case 'terrace': return `<path d="M0 0H10V10H0Z M5 0V5 M0 5H10" ${s} stroke-opacity=".6"/>`;
    case 'path': return `<circle cx="2.5" cy="2.5" r="1" fill="${stroke}" opacity=".6"/><circle cx="7.5" cy="7.5" r="1" fill="${stroke}" opacity=".6"/><circle cx="7.5" cy="2.5" r=".6" fill="${stroke}" opacity=".6"/>`;
    case 'lawn': return `<path d="M2 8 L2 5 M3.2 8 L4 5.5 M7 4 L7 1 M8.2 4 L9 1.5" ${s}/>`;
    case 'lowplants': return `<circle cx="3" cy="3" r="1.7" ${s}/><circle cx="8" cy="7" r="1.7" ${s}/>`;
    case 'midplants': return `<path d="M5 2V8 M2 5H8" ${s}/>`;
    case 'tallplants': return `<path d="M0 10L10 0 M-2 2L2 -2 M8 12L12 8" ${s}/>`;
    case 'hedge': return `<circle cx="2.5" cy="2.5" r="1.6" fill="${stroke}" opacity=".55"/><circle cx="7.5" cy="7.5" r="1.6" fill="${stroke}" opacity=".55"/>`;
    case 'trees': return `<circle cx="5" cy="5" r="1" fill="${stroke}" opacity=".35"/>`;
    case 'vegetable': return `<path d="M0 2.5H10 M0 7.5H10" ${s}/>`;
    case 'orchard': return `<circle cx="5" cy="5" r="2.4" ${s}/>`;
    default: return `<path d="M0 10L10 0" ${s}/>`;
  }
}

/** Registre de dégradés radiaux par couleur (ombrage des houppiers) : id(hex) puis defs(). */
export class GradRegistry {
  constructor(P, light = { x: -0.7, y: -0.7 }) { this.P = P; this.light = light; this.set = new Map(); }
  id(hex) {
    const key = String(hex).replace('#', '').toLowerCase();
    if (!this.set.has(key)) this.set.set(key, hex);
    return `${this.P}-fg-${key}`;
  }
  defs() {
    const cx = f(0.5 + this.light.x * 0.22); const cy = f(0.5 + this.light.y * 0.22);
    return [...this.set.entries()].map(([key, hex]) => `<radialGradient id="${this.P}-fg-${key}" cx="${cx}" cy="${cy}" r="0.78" fx="${cx}" fy="${cy}"><stop offset="0" stop-color="${lighten(hex, 0.42)}"/><stop offset=".55" stop-color="${hex}"/><stop offset="1" stop-color="${darken(hex, 0.3)}"/></radialGradient>`).join('');
  }
}

// ---------------------------------------------------------------- légende

/** Essences du jardin groupées par zone : [{zoneId, label, items:[{plant, count}]}] (quantités réelles). */
export function essenceGroups(garden, lookup) {
  const out = [];
  for (const z of garden.zones || []) {
    const t = getZoneType(z.type);
    const items = [];
    for (const pl of z.plantings || []) {
      const plant = lookup(pl.plantId);
      if (!plant) continue;
      const count = Math.max(1, Math.round(pl.count || 1));
      const ex = items.find((i) => i.plant.id === plant.id);
      if (ex) ex.count += count; else items.push({ plant, count });
    }
    if (items.length) out.push({ zoneId: z.id, label: z.label || (t && t.label) || z.type, items });
  }
  return out;
}

/** Port en petit pour la légende : « bambou, touffe ». */
export const portShort = (plant) => habitOf(plant).label.slice(0, 34);
const trunc = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Pastille d'essence : feuillage + fleur (couleurs réelles), centrée en (11, -4). */
export function swatch(plant) {
  const fo = safeHex(plant.foliageColor) || FOLIAGE_DEFAULT[plant.category] || '#5b8f3a';
  const fl = safeHex(plant.flowerColor);
  const flower = fl ? `<circle cx="3.6" cy="-3.2" r="4.6" fill="${fl}" stroke="${darken(fl, 0.35)}" stroke-width=".7"/><circle cx="-3.8" cy="3.4" r="2.8" fill="${fl}" stroke="${darken(fl, 0.35)}" stroke-width=".6"/>` : '';
  return `<g transform="translate(11 -4)"><circle r="9" fill="${fo}" stroke="${darken(fo, 0.4)}" stroke-width="1"/>${flower}</g>`;
}

/**
 * Éléments de légende [{h, svg}] ; `compact` : essences fusionnées par nom, sans titres de zone.
 * `opts.rows` ajoute des éléments (ex. ensoleillement). Retourne aussi les types de zones utilisés.
 */
export function buildLegendItems(garden, lookup, layers, { P, compact = false, sun = false, extra = null } = {}) {
  const items = [];
  const li = (h0, inner) => items.push({ h: h0, svg: inner });
  const zones = garden.zones || [];
  const used = new Set(zones.map((z) => z.type));
  const obstacles = garden.obstacles || [];
  li(24, `<text font-size="13" font-weight="700" fill="#222" font-family="${FONT}">Légende</text>`);
  const above = zones.some((z) => isAbovePool(z));
  const inground = zones.some((z) => z.type === 'pool' && !isAbovePool(z));
  for (const t of ZONE_TYPES.filter((q) => used.has(q.id))) {
    const variants = t.id !== 'pool' ? [{ pat: t.id, label: t.label }] : [
      ...(inground || !above ? [{ pat: 'pool', label: t.label }] : []),
      ...(above ? [{ pat: 'pool-above', label: POOL_ABOVE_LABEL, wall: true }] : []),
    ];
    for (const v of variants) {
      const wall = v.wall ? `<rect y="-11" width="22" height="14" fill="none" stroke="#e6e1d6" stroke-width="3"/><rect y="-11" width="22" height="14" fill="none" stroke="#546e7a" stroke-width=".8"/>` : '';
      li(20, `<rect y="-11" width="22" height="14" fill="${t.color}" fill-opacity=".7" stroke="${darken(t.color, 0.35)}"/><rect y="-11" width="22" height="14" fill="url(#${P}-pat-${v.pat})"/>${wall}<text x="30" font-size="11" fill="#222" font-family="${FONT}">${esc(trunc(v.label, 24))}</text>`);
    }
  }
  const groups = essenceGroups(garden, lookup);
  if (groups.length) {
    li(22, `<text font-size="12" font-weight="700" fill="#222" font-family="${FONT}">Essences</text>`);
    const row = (plant, count) => li(compact ? 24 : 28, `${swatch(plant)}<text x="30" font-size="11" fill="#222" font-family="${FONT}">${esc(trunc(plant.commonName, 22))}${count > 1 ? ` ×${count}` : ''}</text><text x="30" y="11" font-size="8.5" fill="#667" font-family="${FONT}" data-role="port">${esc(portShort(plant))}</text>`);
    if (compact) {
      const m = new Map();
      for (const g of groups) for (const it of g.items) { const e = m.get(it.plant.id) || { plant: it.plant, count: 0 }; e.count += it.count; m.set(it.plant.id, e); }
      for (const e of m.values()) row(e.plant, e.count);
    } else {
      for (const g of groups) {
        li(17, `<text x="2" font-size="10" font-weight="700" fill="#556" font-family="${FONT}">${esc(trunc(g.label, 28))}</text>`);
        for (const it of g.items) row(it.plant, it.count);
      }
    }
  }
  if (sun && garden.sun && (garden.sun.mode === 'map' || garden.sun.mode === 'uniform')) {
    li(22, `<text font-size="12" font-weight="700" fill="#222" font-family="${FONT}">Ensoleillement</text>`);
    for (const k of ['full', 'partial', 'shade']) li(20, `<rect y="-11" width="22" height="14" fill="${SUN_COLORS[k]}" fill-opacity=".5" stroke="${SUN_COLORS[k]}"/><text x="30" font-size="11" fill="#222" font-family="${FONT}">${esc(SUN_LABELS[k])}</text>`);
  }
  if (obstacles.length && !compact) {
    li(22, `<text font-size="12" font-weight="700" fill="#222" font-family="${FONT}">Existant</text>`);
    for (const k of [...new Set(obstacles.map((o) => o.kind))]) li(20, `<rect y="-11" width="22" height="14" fill="#e3e3e3" stroke="#424242"/><text x="30" font-size="11" fill="#222" font-family="${FONT}">${esc(OBSTACLE_LABELS[k] || k)}</text>`);
  }
  if (extra) extra(li);
  return items;
}

const sumH = (items) => items.reduce((a, it) => a + it.h, 0);
function truncateItems(items, maxH) {
  if (sumH(items) <= maxH) return items;
  const out = [];
  let acc = 0;
  for (const it of items) { if (acc + it.h > maxH - 20) break; out.push(it); acc += it.h; }
  const hidden = items.length - out.length;
  out.push({ h: 18, svg: `<text x="2" font-size="10" fill="#666" font-family="${FONT}">… +${hidden} lignes</text>` });
  return out;
}

/**
 * Cadre commun : zone de dessin + légende (à droite en paysage, en colonnes sous le plan en portrait).
 * `buildItems(compact)` → éléments de légende. Retourne {ax, ay, aw, ah, MARGIN, CART_H, legendSVG}.
 */
export function makeFrame(W, H, layers, buildItems) {
  const MARGIN = 34; const CART_H = 58; const COL_W = 200;
  const bottom = !!layers.legend && H > W * 1.05;
  let items = layers.legend ? buildItems(false) : [];
  let LEG_H = 0; let LEG_W = 0; let legCols = [];
  if (layers.legend && bottom) {
    const ncols = Math.max(1, Math.floor((W - MARGIN * 2) / COL_W));
    const limit = Math.max(120, Math.round(H * 0.3));
    if (sumH(items) / ncols > limit * 0.92) items = buildItems(true);
    items = truncateItems(items, ncols * (limit - 16) * 0.95);
    let colMax = Math.max(Math.ceil(sumH(items) / ncols), 44);
    for (let guard = 0; guard < 60; guard++) {
      legCols = []; let cur = []; let acc = 0;
      for (const it of items) {
        if (acc + it.h > colMax && cur.length) { legCols.push(cur); cur = []; acc = 0; }
        cur.push(it); acc += it.h;
      }
      if (cur.length) legCols.push(cur);
      if (legCols.length <= ncols) break;
      colMax += 10;
    }
    LEG_H = Math.max(...legCols.map((c) => sumH(c))) + 14;
  } else if (layers.legend) LEG_W = 210;
  const ax = MARGIN; const ay = MARGIN;
  const aw = W - MARGIN * 2 - (LEG_W ? LEG_W + 14 : 0);
  const ah = H - MARGIN * 2 - CART_H - 8 - (LEG_H ? LEG_H + 8 : 0);
  if (layers.legend && !bottom) {
    const maxH = ah - 28;
    if (sumH(items) > maxH) items = buildItems(true);
    items = truncateItems(items, maxH);
  }
  let legendSVG = '';
  if (layers.legend && items.length) {
    if (bottom) {
      const ly = ay + ah + 8;
      let cx = MARGIN;
      const cols = legCols.map((col) => { let y = 20; const g2 = col.map((it) => { const r = `<g transform="translate(8 ${y})">${it.svg}</g>`; y += it.h; return r; }).join(''); const r2 = `<g transform="translate(${cx} 0)">${g2}</g>`; cx += COL_W; return r2; }).join('');
      legendSVG = `<g font-family="${FONT}" data-role="legend"><rect x="${MARGIN}" y="${ly}" width="${W - MARGIN * 2}" height="${LEG_H}" rx="6" fill="#fff" fill-opacity=".92" stroke="#bdbdbd"/><g transform="translate(0 ${ly - 8})">${cols}</g></g>`;
    } else {
      const lx = W - MARGIN - LEG_W; let y = 20;
      const rows = items.map((it) => { const r = `<g transform="translate(10 ${y})">${it.svg}</g>`; y += it.h; return r; }).join('');
      legendSVG = `<g font-family="${FONT}" data-role="legend"><rect x="${lx}" y="${ay}" width="${LEG_W}" height="${f(Math.min(ah, y + 8))}" rx="6" fill="#fff" fill-opacity=".92" stroke="#bdbdbd"/><g transform="translate(${lx} ${ay})">${rows}</g></g>`;
    }
  }
  return { ax, ay, aw, ah, MARGIN, CART_H, legendSVG };
}

export function northSVG(x, y, angleDeg) {
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(angleDeg)})"><circle r="24" fill="#fff" fill-opacity=".8" stroke="#555" stroke-width="0.8"/><path d="M0 -20L7 8L0 3L-7 8Z" fill="#c62828" stroke="#333" stroke-width="0.8"/><text y="-26" font-size="13" font-weight="700" text-anchor="middle" fill="#222" font-family="${FONT}">N</text></g>`;
}

export function scaleBarSVG(x0, y0, pxPerM) {
  const nice = [0.5, 1, 2, 5, 10, 20, 50, 100];
  const target = 110;
  const len = nice.reduce((best, v) => (Math.abs(v * pxPerM - target) < Math.abs(best * pxPerM - target) ? v : best), nice[0]);
  const w = len * pxPerM; const half = w / 2;
  return `<g font-family="${FONT}" font-size="11" fill="#222"><rect x="${f(x0 - 6)}" y="${f(y0 - 24)}" width="${f(w + 12)}" height="32" fill="#fff" fill-opacity=".75"/><rect x="${f(x0)}" y="${f(y0 - 4)}" width="${f(half)}" height="6" fill="#222"/><rect x="${f(x0 + half)}" y="${f(y0 - 4)}" width="${f(half)}" height="6" fill="#fff" stroke="#222" stroke-width="1"/><rect x="${f(x0)}" y="${f(y0 - 4)}" width="${f(w)}" height="6" fill="none" stroke="#222" stroke-width="1"/><text x="${f(x0)}" y="${f(y0 - 10)}">0</text><text x="${f(x0 + w)}" y="${f(y0 - 10)}" text-anchor="end">${frNum(len, len < 1 ? 1 : 0)} m</text></g>`;
}

export function cartoucheSVG(garden, { W, H, MARGIN, CART_H, line2, line3, budgetTxt = '' }) {
  const cx0 = MARGIN; const cy0 = H - MARGIN - CART_H; const cw = W - MARGIN * 2;
  const b = garden.boundary || [];
  const surface = b.length >= 3 ? polygonArea(b) : 0;
  let per = 0;
  if (b.length >= 2) { const n = b.length; const closed = garden.boundaryClosed !== false && n >= 3; for (let i = 0; i < (closed ? n : n - 1); i++) per += Math.hypot(b[(i + 1) % n].x - b[i].x, b[(i + 1) % n].y - b[i].y); }
  const dateStr = (() => { const d = new Date((garden.plan && garden.plan.validatedAt) || garden.updatedAt || Date.now()); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR'); })();
  const region = [garden.context && garden.context.commune, garden.context && garden.context.region].filter(Boolean).join(', ');
  return `<g font-family="${FONT}" fill="#1b1b1b" data-role="cartouche"><rect x="${cx0}" y="${cy0}" width="${cw}" height="${CART_H}" fill="#fff" stroke="#333" stroke-width="1.2"/><line x1="${cx0 + cw * 0.5}" y1="${cy0}" x2="${cx0 + cw * 0.5}" y2="${cy0 + CART_H}" stroke="#333" stroke-width="0.8"/><text x="${cx0 + 12}" y="${cy0 + 24}" font-size="19" font-weight="700">${esc(garden.name || 'Mon jardin')}</text><text x="${cx0 + 12}" y="${cy0 + 44}" font-size="12" fill="#444">${esc(region || 'Région non renseignée')}</text>${budgetTxt ? `<text x="${cx0 + 12}" y="${cy0 + 54}" font-size="10" fill="#444">${esc(budgetTxt)}</text>` : ''}<text x="${cx0 + cw * 0.5 + 12}" y="${cy0 + 20}" font-size="12">Surface : ${frNum(surface, 1)} m² · Périmètre : ${frNum(per, 1)} m</text><text x="${cx0 + cw * 0.5 + 12}" y="${cy0 + 38}" font-size="12">${esc(line2)}</text><text x="${cx0 + cw * 0.5 + 12}" y="${cy0 + 53}" font-size="11" fill="#555">${esc(line3 != null ? line3 : dateStr)}${line3 != null ? '' : (garden.status === 'validated' ? ' · validé' : ' · brouillon')}</text></g>`;
}

/** Résumé textuel du plan (zones et essences) pour l'accessibilité. */
export function describePlan(garden, lookup = getPlant) {
  const lines = [];
  for (const z of garden.zones || []) {
    const t = getZoneType(z.type);
    const pl = (z.plantings || []).map((p) => {
      const plant = lookup && lookup(p.plantId);
      return `${p.count || 1} × ${plant ? plant.commonName : p.plantId}`;
    });
    lines.push(`${z.label || (t && t.label) || z.type}${pl.length ? ` : ${pl.join(', ')}` : ''}`);
  }
  return lines.join(' ; ');
}

/** Types de zones utilisés, plus « pool-above » si une piscine hors sol est présente (motif d'eau dédié). */
export function usedZoneTypes(zones) {
  const used = new Set((zones || []).map((z) => z.type));
  if ((zones || []).some((z) => isAbovePool(z))) used.add('pool-above');
  return used;
}

/** Définitions communes (motifs par type de zone). */
export function patternDefs(P, usedTypes, illus) {
  const defs = [];
  for (const t of ZONE_TYPES) {
    if (!usedTypes.has(t.id)) continue;
    defs.push(`<pattern id="${P}-pat-${t.id}" width="10" height="10" patternUnits="userSpaceOnUse">${patternBody(t.id, darken(t.color, 0.45))}</pattern>`);
    if (t.id === 'pool' && usedTypes.has('pool-above')) defs.push(`<pattern id="${P}-pat-pool-above" width="10" height="10" patternUnits="userSpaceOnUse">${patternBody('pool-above', darken(t.color, 0.45))}</pattern>`);
    if (illus) defs.push(`<linearGradient id="${P}-g-${t.id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${lighten(t.color, 0.35)}"/><stop offset="1" stop-color="${t.color}"/></linearGradient>`);
  }
  return defs;
}

/** Motif de brins d'herbe pour une pelouse de couleur `col`. */
export function lawnPatternDef(id, col) {
  return `<pattern id="${id}" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M2 10L2.6 6M5 11L6.2 6.5M8.5 9L9 4.5M10.5 5L11 2" stroke="${darken(col, 0.3)}" stroke-width=".9" stroke-linecap="round" fill="none" opacity=".6"/><path d="M0.5 5L1 2M6 4L6.5 1.5" stroke="${lighten(col, 0.4)}" stroke-width=".8" stroke-linecap="round" fill="none" opacity=".7"/></pattern>`;
}

/** Bandeau de pied de cadre quand le cartouche est masqué (feuille de contact). */
export function captionSVG(text, { W, H, MARGIN, CART_H }) {
  return `<text x="${W / 2}" y="${H - MARGIN - CART_H / 2 + 6}" font-size="22" font-weight="700" text-anchor="middle" fill="#223" font-family="${FONT}">${esc(text)}</text>`;
}
