// Rendu vectoriel du plan : renderPlanSVG(garden, opts) → string SVG autonome (pur, sans DOM).
import { bounds, polygonArea, perimeter, centroid, pointInPolygon, shapePolygon, shapeBounds, signedArea, distance } from './geometry.js';
import { ZONE_TYPES, getZoneType, SUN_LABELS, CATEGORY_LABELS } from './model.js';
import { getPlant } from './catalog.js';
import { gardenCost, formatEuro } from './pricing.js';

const FONT = 'Helvetica, Arial, sans-serif';
const CAT_COLORS = {
  tree: '#2e7d32', shrub: '#558b2f', hedge: '#33691e', fruit: '#e0793c', climber: '#7cb342', perennial: '#ab47bc',
  groundcover: '#66bb6a', grass: '#9e9d24', bulb: '#ec407a', aquatic: '#0288d1', vegetable: '#ef6c00', lawn: '#7cc95a',
};
const SUN_COLORS = { full: '#ffd54f', partial: '#ffa726', shade: '#5c6bc0' };
const OBSTACLE_LABELS = { house: 'Maison', wall: 'Mur', shed: 'Abri', tree: 'Arbre existant', fence: 'Clôture' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const f = (n) => (Math.round(n * 100) / 100).toString();
const frNum = (n, d = 2) => n.toFixed(d).replace('.', ',');

function darken(hex, k = 0.35) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#333333';
  const v = parseInt(m[1], 16);
  const c = (s) => Math.max(0, Math.round(((v >> s) & 255) * (1 - k)));
  return `#${[16, 8, 0].map((s) => c(s).toString(16).padStart(2, '0')).join('')}`;
}
function lighten(hex, k = 0.45) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#dddddd';
  const v = parseInt(m[1], 16);
  const c = (s) => Math.min(255, Math.round(((v >> s) & 255) + (255 - ((v >> s) & 255)) * k));
  return `#${[16, 8, 0].map((s) => c(s).toString(16).padStart(2, '0')).join('')}`;
}

/** Motif de remplissage propre à chaque type de zone (tuile 10×10 px). */
function patternBody(typeId, stroke) {
  const s = `stroke="${stroke}" stroke-width="0.9" fill="none" stroke-linecap="round"`;
  switch (typeId) {
    case 'pond': return `<path d="M0 3 Q2.5 0 5 3 T10 3 M0 8 Q2.5 5 5 8 T10 8" ${s}/>`;
    case 'pool': return `<path d="M0 0H10V10 M0 5H10 M5 0V10" ${s} stroke-opacity=".55"/>`;
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

/** Pictogramme par catégorie, centré en (0,0), taille g (px). */
const safeHex = (c) => (typeof c === 'string' && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(c.trim()) ? c.trim() : null);

function glyph(cat, g, col) {
  const s = `stroke="${col}" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  switch (cat) {
    case 'tree': return `<circle r="${f(g * 0.5)}" ${s}/><circle r="${f(g * 0.12)}" fill="${col}"/>`;
    case 'shrub': return `<path d="M${f(-g * 0.6)} 0H${f(g * 0.6)} M0 ${f(-g * 0.6)}V${f(g * 0.6)} M${f(-g * 0.42)} ${f(-g * 0.42)}L${f(g * 0.42)} ${f(g * 0.42)} M${f(g * 0.42)} ${f(-g * 0.42)}L${f(-g * 0.42)} ${f(g * 0.42)}" ${s}/>`;
    case 'hedge': return `<rect x="${f(-g * 0.6)}" y="${f(-g * 0.3)}" width="${f(g * 1.2)}" height="${f(g * 0.6)}" rx="${f(g * 0.25)}" ${s}/>`;
    case 'fruit': return `<circle r="${f(g * 0.5)}" ${s}/><circle cx="${f(-g * 0.18)}" cy="${f(-g * 0.1)}" r="${f(g * 0.14)}" fill="${col}"/><circle cx="${f(g * 0.2)}" cy="${f(g * 0.08)}" r="${f(g * 0.14)}" fill="${col}"/>`;
    case 'climber': return `<path d="M${f(-g * 0.5)} ${f(g * 0.5)}C${f(g * 0.6)} ${f(g * 0.4)} ${f(-g * 0.6)} ${f(-g * 0.1)} ${f(g * 0.5)} ${f(-g * 0.5)}" ${s}/>`;
    case 'perennial': {
      const p = [0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="${f(-g * 0.32)}" rx="${f(g * 0.17)}" ry="${f(g * 0.3)}" transform="rotate(${a})" ${s}/>`).join('');
      return `${p}<circle r="${f(g * 0.1)}" fill="${col}"/>`;
    }
    case 'groundcover': return `<circle cx="${f(-g * 0.3)}" cy="${f(-g * 0.2)}" r="${f(g * 0.2)}" ${s}/><circle cx="${f(g * 0.3)}" cy="${f(-g * 0.1)}" r="${f(g * 0.2)}" ${s}/><circle cx="0" cy="${f(g * 0.3)}" r="${f(g * 0.2)}" ${s}/>`;
    case 'grass': return `<path d="M0 ${f(g * 0.5)}L${f(-g * 0.5)} ${f(-g * 0.4)} M0 ${f(g * 0.5)}L0 ${f(-g * 0.55)} M0 ${f(g * 0.5)}L${f(g * 0.5)} ${f(-g * 0.4)}" ${s}/>`;
    case 'bulb': return `<ellipse cx="0" cy="${f(g * 0.15)}" rx="${f(g * 0.28)}" ry="${f(g * 0.38)}" ${s}/><path d="M0 ${f(-g * 0.25)}V${f(-g * 0.55)}" ${s}/>`;
    case 'aquatic': return `<circle r="${f(g * 0.5)}" ${s}/><path d="M0 0L${f(g * 0.5)} ${f(-g * 0.1)}" ${s}/><path d="M${f(-g * 0.35)} ${f(g * 0.65)}q${f(g * 0.17)} ${f(-g * 0.2)} ${f(g * 0.35)} 0t${f(g * 0.35)} 0" ${s}/>`;
    case 'vegetable': return `<path d="M0 ${f(g * 0.5)}C${f(-g * 0.6)} ${f(g * 0.1)} ${f(-g * 0.3)} ${f(-g * 0.5)} 0 ${f(-g * 0.5)}C${f(g * 0.3)} ${f(-g * 0.5)} ${f(g * 0.6)} ${f(g * 0.1)} 0 ${f(g * 0.5)}Z M0 ${f(g * 0.5)}V${f(-g * 0.3)}" ${s}/>`;
    case 'lawn': return `<path d="M${f(-g * 0.4)} ${f(g * 0.4)}L${f(-g * 0.4)} ${f(-g * 0.1)} M0 ${f(g * 0.4)}L0 ${f(-g * 0.3)} M${f(g * 0.4)} ${f(g * 0.4)}L${f(g * 0.4)} ${f(-g * 0.1)}" ${s}/>`;
    default: return `<circle r="${f(g * 0.3)}" fill="${col}"/>`;
  }
}

/** Positions de `n` plants dans un polygone (grille hexagonale puis échantillonnage régulier). */
function placePoints(poly, n) {
  if (n <= 0 || poly.length < 3) return [];
  const area = polygonArea(poly);
  const c = centroid(poly);
  const inside = pointInPolygon(c, poly) ? c : null;
  if (n === 1) return [inside || poly[0]];
  const b = bounds(poly);
  let d = Math.sqrt(area / n) * 1.15;
  let cand = [];
  for (let it = 0; it < 14 && d > 0.05; it++) {
    cand = [];
    let row = 0;
    for (let y = b.minY + d / 2; y <= b.maxY; y += d * 0.866, row++) {
      for (let x = b.minX + d / 2 + (row % 2 ? d / 2 : 0); x <= b.maxX; x += d) {
        if (pointInPolygon({ x, y }, poly)) cand.push({ x, y });
      }
    }
    if (cand.length >= n) break;
    d *= 0.85;
  }
  if (!cand.length) return inside ? [inside] : [];
  const out = [];
  const m = Math.min(n, cand.length);
  for (let i = 0; i < m; i++) out.push(cand[Math.round((i * (cand.length - 1)) / Math.max(1, m - 1))]);
  return out;
}

/** Résumé textuel du plan (zones et essences) pour l'accessibilité. */
export function describePlan(garden) {
  const lines = [];
  for (const z of garden.zones || []) {
    const t = getZoneType(z.type);
    const pl = (z.plantings || []).map((p) => {
      const plant = getPlant && getPlant(p.plantId);
      return `${p.count || 1} × ${plant ? plant.commonName : p.plantId}`;
    });
    lines.push(`${z.label || (t && t.label) || z.type}${pl.length ? ' : ' + pl.join(', ') : ''}`);
  }
  return lines.join(' ; ');
}

/**
 * Plan SVG autonome.
 * @param {object} garden
 * @param {{view?:'plan'|'illustrated', age?:'adult'|'young', layers?:{dims?:boolean,legend?:boolean,sun?:boolean,names?:boolean,budget?:boolean},
 *          width?:number, height?:number, idPrefix?:string, plantLookup?:Function}} opts
 */
export function renderPlanSVG(garden, opts = {}) {
  const view = opts.view === 'illustrated' ? 'illustrated' : 'plan';
  const age = opts.age === 'young' ? 'young' : 'adult';
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

  const MARGIN = 34;
  const CART_H = 58;
  const sun = garden.sun || {};
  const used = new Set(zones.map((z) => z.type));
  const catsUsed = new Set();
  for (const z of zones) for (const pl of z.plantings || []) { const pt = lookup(pl.plantId); if (pt) catsUsed.add(pt.category); }

  // Légende : éléments {h, svg} (empilés à droite en paysage, en colonnes sous le plan en portrait)
  const legendItems = [];
  if (layers.legend) {
    const li = (h0, inner) => legendItems.push({ h: h0, svg: inner });
    li(24, `<text font-size="13" font-weight="700" fill="#222" font-family="${FONT}">Légende</text>`);
    for (const t of ZONE_TYPES.filter((q) => used.has(q.id))) {
      li(20, `<rect y="-11" width="22" height="14" fill="${t.color}" fill-opacity=".7" stroke="${darken(t.color, 0.35)}"/><rect y="-11" width="22" height="14" fill="url(#${P}-pat-${t.id})"/><text x="30" font-size="11" fill="#222" font-family="${FONT}">${esc(t.label.length > 24 ? t.label.slice(0, 23) + '…' : t.label)}</text>`);
    }
    if (catsUsed.size) {
      li(22, `<text font-size="12" font-weight="700" fill="#222" font-family="${FONT}">Essences</text>`);
      for (const cat of catsUsed) {
        const col = CAT_COLORS[cat] || '#558b2f';
        li(22, `<g transform="translate(11 -4)"><circle r="9" fill="${col}" fill-opacity=".22" stroke="${col}"/>${glyph(cat, 11, darken(col, 0.2))}</g><text x="30" font-size="11" fill="#222" font-family="${FONT}">${esc(CATEGORY_LABELS[cat] || cat)}</text>`);
      }
    }
    if (layers.sun && (sun.mode === 'map' || sun.mode === 'uniform')) {
      li(22, `<text font-size="12" font-weight="700" fill="#222" font-family="${FONT}">Ensoleillement</text>`);
      for (const k of ['full', 'partial', 'shade']) li(20, `<rect y="-11" width="22" height="14" fill="${SUN_COLORS[k]}" fill-opacity=".5" stroke="${SUN_COLORS[k]}"/><text x="30" font-size="11" fill="#222" font-family="${FONT}">${esc(SUN_LABELS[k])}</text>`);
    }
    if (obstacles.length) {
      li(22, `<text font-size="12" font-weight="700" fill="#222" font-family="${FONT}">Existant</text>`);
      for (const k of [...new Set(obstacles.map((o) => o.kind))]) li(20, `<rect y="-11" width="22" height="14" fill="#e3e3e3" stroke="#424242"/><text x="30" font-size="11" fill="#222" font-family="${FONT}">${esc(OBSTACLE_LABELS[k] || k)}</text>`);
    }
  }
  const bottomLegend = layers.legend && H > W * 1.05;
  const COL_W = 200;
  let legCols = [];
  let LEG_H = 0;
  if (bottomLegend) {
    const ncols = Math.max(1, Math.floor((W - MARGIN * 2) / COL_W));
    const total = legendItems.reduce((acc, it) => acc + it.h, 0);
    let colMax = Math.max(Math.ceil(total / ncols), 44);
    for (let guard = 0; guard < 40; guard++) {
      legCols = []; let cur = []; let acc = 0;
      for (const it of legendItems) {
        if (acc + it.h > colMax && cur.length) { legCols.push(cur); cur = []; acc = 0; }
        cur.push(it); acc += it.h;
      }
      if (cur.length) legCols.push(cur);
      if (legCols.length <= ncols) break;
      colMax += 10;
    }
    LEG_H = Math.max(...legCols.map((c) => c.reduce((a2, it) => a2 + it.h, 0))) + 14;
  }
  const LEG_W = layers.legend && !bottomLegend ? 210 : 0;
  const ax = MARGIN; const ay = MARGIN;
  const aw = W - MARGIN * 2 - (LEG_W ? LEG_W + 14 : 0);
  const ah = H - MARGIN * 2 - CART_H - 8 - (LEG_H ? LEG_H + 8 : 0);
  const pad = 26; // pour cotes et marges
  const S = Math.min((aw - pad * 2) / wb.width, (ah - pad * 2) / wb.height);
  const ox = ax + (aw - wb.width * S) / 2;
  const oy = ay + (ah - wb.height * S) / 2;
  const tx = (x) => ox + (x - wb.minX) * S;
  const ty = (y) => oy + (y - wb.minY) * S;
  const pts = (poly) => poly.map((p) => `${f(tx(p.x))},${f(ty(p.y))}`).join(' ');

  const defs = [];
  const typeColor = (id) => (getZoneType(id) ? getZoneType(id).color : '#9e9e9e');
  for (const t of ZONE_TYPES) {
    if (!used.has(t.id)) continue;
    const stroke = darken(t.color, 0.45);
    defs.push(`<pattern id="${P}-pat-${t.id}" width="10" height="10" patternUnits="userSpaceOnUse">${patternBody(t.id, stroke)}</pattern>`);
    if (illus) defs.push(`<linearGradient id="${P}-g-${t.id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${lighten(t.color, 0.35)}"/><stop offset="1" stop-color="${t.color}"/></linearGradient>`);
  }
  defs.push(`<pattern id="${P}-pat-house" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8L8 0" stroke="#616161" stroke-width="1"/></pattern>`);
  if (illus) {
    defs.push(`<filter id="${P}-shadow" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="2" dy="3" stdDeviation="2.5" flood-color="#000" flood-opacity=".28"/></filter>`);
    defs.push(`<filter id="${P}-tshadow" x="-30%" y="-30%" width="170%" height="170%"><feDropShadow dx="3" dy="4" stdDeviation="3" flood-color="#000" flood-opacity=".3"/></filter>`);
    defs.push(`<linearGradient id="${P}-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3f7e6"/><stop offset="1" stop-color="#dfe9c8"/></linearGradient>`);
    defs.push(`<linearGradient id="${P}-lot" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfe7a8"/><stop offset="1" stop-color="#a9cf7c"/></linearGradient>`);
    for (const [cat, col] of Object.entries(CAT_COLORS)) {
      defs.push(`<radialGradient id="${P}-pg-${cat}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="${lighten(col, 0.55)}"/><stop offset="1" stop-color="${col}"/></radialGradient>`);
    }
  }

  const out = [];
  // Fond
  out.push(`<rect width="${W}" height="${H}" fill="${illus ? `url(#${P}-bg)` : '#ffffff'}"/>`);
  out.push(`<rect x="${ax}" y="${ay}" width="${f(aw)}" height="${f(ah)}" fill="none" stroke="#c8c8c8" stroke-width="0.6"/>`);

  // Terrain
  if (boundary.length >= 2) {
    const closed = garden.boundaryClosed !== false && boundary.length >= 3;
    if (closed) {
      out.push(`<polygon points="${pts(boundary)}" fill="${illus ? `url(#${P}-lot)` : '#fafaf5'}" stroke="#2b2b2b" stroke-width="${illus ? 2.2 : 2}" stroke-linejoin="round"${illus ? ` filter="url(#${P}-shadow)"` : ''}/>`);
    } else {
      out.push(`<polyline points="${pts(boundary)}" fill="none" stroke="#2b2b2b" stroke-width="2" stroke-dasharray="6 4"/>`);
    }
  }

  // Ensoleillement
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

  // Zones : sol puis canopée
  const sorted = [...zones].sort((a, b) => ((getZoneType(a.type) || {}).layer === 'canopy') - ((getZoneType(b.type) || {}).layer === 'canopy'));
  const plantsLegend = new Map();
  const labels = [];
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
    out.push(`<g data-zone="${esc(z.id)}">${geom(`fill="${fill}" fill-opacity="${op}" stroke="${stroke}" stroke-width="1.4"${canopy ? ' stroke-dasharray="6 3"' : ''}${illus ? ` filter="url(#${P}-shadow)"` : ''}`)}${geom(`fill="url(#${P}-pat-${t.id})" fill-opacity="${illus ? 0.35 : 0.8}" stroke="none"`)}</g>`);
    const c = centroid(poly);
    labels.push({ z, t, c, poly });

    // Essences
    const groups = (z.plantings || []).map((pl) => ({ pl, plant: lookup(pl.plantId) })).filter((g) => g.plant);
    const total = groups.reduce((s, g) => s + Math.max(1, Math.round(g.pl.count || 1)), 0);
    if (!groups.length) continue;
    const drawn = Math.min(total, 150);
    const spots = placePoints(poly, drawn);
    // intercalage des essences
    const seq = [];
    const left = groups.map((g) => Math.max(1, Math.round(g.pl.count || 1)));
    while (seq.length < spots.length && left.some((n) => n > 0)) {
      groups.forEach((g, gi) => { if (left[gi] > 0 && seq.length < spots.length) { seq.push(gi); left[gi]--; } });
    }
    const labelled = new Set();
    seq.forEach((gi, i) => {
      const { plant, pl } = groups[gi];
      const cat = plant.category;
      const col = CAT_COLORS[cat] || '#558b2f';
      const wAdult = plant.widthAdult || 1;
      const rM = age === 'young' ? Math.max(0.12, wAdult * 0.5 * 0.3) : wAdult / 2;
      const rp = Math.max(3, rM * S);
      const p = spots[i];
      const cx = tx(p.x); const cy = ty(p.y);
      const g = Math.min(rp * 0.8, 14);
      // Couleurs réelles de l'essence (vues illustrée et jeunes plants) : feuillage en fond, floraison en couronne.
      const colored = illus || age === 'young';
      const foc = colored ? safeHex(plant.foliageColor) : null;
      const flc = colored ? safeHex(plant.flowerColor) : null;
      let circle = illus
        ? `<circle r="${f(rp)}" fill="${foc || `url(#${P}-pg-${cat in CAT_COLORS ? cat : 'shrub'})`}" fill-opacity=".9" stroke="${darken(foc || col, 0.3)}" stroke-width="0.8"${rp > 8 ? ` filter="url(#${P}-tshadow)"` : ''}/>`
        : `<circle r="${f(rp)}" fill="${foc || col}" fill-opacity="${foc ? '.45' : '.2'}" stroke="${foc ? darken(foc, 0.2) : col}" stroke-width="1.1"/>`;
      if (flc && rp >= 4) circle += `<circle r="${f(rp * 0.62)}" fill="${flc}" fill-opacity=".85" stroke="${darken(flc, 0.25)}" stroke-width="0.6" data-flower="1"/>`;
      out.push(`<g transform="translate(${f(cx)} ${f(cy)})" data-plant="${esc(plant.id)}">${circle}${rp >= 5 ? glyph(cat, g, flc ? darken(flc, 0.55) : illus ? '#f4fbe9' : darken(col, 0.2)) : ''}</g>`);
      if (!plantsLegend.has(plant.id)) plantsLegend.set(plant.id, { plant, count: 0 });
      if (layers.names && !labelled.has(gi)) {
        labelled.add(gi);
        out.push(`<text x="${f(cx)}" y="${f(cy + rp + 11)}" font-size="10" text-anchor="middle" fill="#1b2a1b" stroke="#fff" stroke-width="2.6" paint-order="stroke" font-family="${FONT}">${esc(plant.commonName)}${(pl.count || 1) > 1 ? ` ×${Math.round(pl.count)}` : ''}</text>`);
      }
    });
    for (const g of groups) {
      const e = plantsLegend.get(g.plant.id) || { plant: g.plant, count: 0 };
      e.count += Math.max(1, Math.round(g.pl.count || 1));
      plantsLegend.set(g.plant.id, e);
    }
  }
  // Noms des zones (au-dessus de tout)
  for (const { z, t, c } of labels) {
    out.push(`<text x="${f(tx(c.x))}" y="${f(ty(c.y) + 4)}" font-size="12" font-weight="700" text-anchor="middle" fill="#14210f" stroke="#fff" stroke-width="3" paint-order="stroke" font-family="${FONT}" opacity=".92">${esc(z.label || t.label)}</text>`);
  }
  obstacles.filter((o) => o.kind === 'tree').forEach((o) => out.push(obstacleEl(o)));

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
      // normale vers l'extérieur
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

  // Nord
  {
    const nx0 = ax + aw - 34; const ny0 = ay + 40;
    out.push(`<g transform="translate(${f(nx0)} ${f(ny0)}) rotate(${f(northAngle)})"><circle r="24" fill="#fff" fill-opacity=".8" stroke="#555" stroke-width="0.8"/><path d="M0 -20L7 8L0 3L-7 8Z" fill="#c62828" stroke="#333" stroke-width="0.8"/><text y="-26" font-size="13" font-weight="700" text-anchor="middle" fill="#222" font-family="${FONT}">N</text></g>`);
  }

  // Échelle
  {
    const nice = [0.5, 1, 2, 5, 10, 20, 50, 100];
    const target = 110;
    const len = nice.reduce((best, v) => (Math.abs(v * S - target) < Math.abs(best * S - target) ? v : best), nice[0]);
    const x0 = ax + 14; const y0 = ay + ah - 16;
    const w = len * S;
    const half = w / 2;
    out.push(`<g font-family="${FONT}" font-size="11" fill="#222"><rect x="${f(x0 - 6)}" y="${f(y0 - 24)}" width="${f(w + 12)}" height="32" fill="#fff" fill-opacity=".75"/><rect x="${f(x0)}" y="${f(y0 - 4)}" width="${f(half)}" height="6" fill="#222"/><rect x="${f(x0 + half)}" y="${f(y0 - 4)}" width="${f(half)}" height="6" fill="#fff" stroke="#222" stroke-width="1"/><rect x="${f(x0)}" y="${f(y0 - 4)}" width="${f(w)}" height="6" fill="none" stroke="#222" stroke-width="1"/><text x="${f(x0)}" y="${f(y0 - 10)}">0</text><text x="${f(x0 + w)}" y="${f(y0 - 10)}" text-anchor="end">${frNum(len, len < 1 ? 1 : 0)} m</text></g>`);
  }

  // Légende
  if (layers.legend && legendItems.length) {
    if (bottomLegend) {
      const ly = ay + ah + 8;
      let cx = MARGIN;
      const cols = legCols.map((col) => { let y = 20; const g2 = col.map((it) => { const r = `<g transform="translate(8 ${y})">${it.svg}</g>`; y += it.h; return r; }).join(''); const r2 = `<g transform="translate(${cx} 0)">${g2}</g>`; cx += COL_W; return r2; }).join('');
      out.push(`<g font-family="${FONT}"><rect x="${MARGIN}" y="${ly}" width="${W - MARGIN * 2}" height="${LEG_H}" rx="6" fill="#fff" fill-opacity=".9" stroke="#bdbdbd"/><g transform="translate(0 ${ly - 8})">${cols}</g></g>`);
    } else {
      const lx = W - MARGIN - LEG_W; let y = 20;
      const rows = legendItems.map((it) => { const r = `<g transform="translate(10 ${y})">${it.svg}</g>`; y += it.h; return r; }).join('');
      out.push(`<g font-family="${FONT}"><rect x="${lx}" y="${ay}" width="${LEG_W}" height="${f(Math.min(ah, y + 8))}" rx="6" fill="#fff" fill-opacity=".9" stroke="#bdbdbd"/><g transform="translate(${lx} ${ay})">${rows}</g></g>`);
    }
  }

  // Cartouche
  {
    const cx0 = MARGIN; const cy0 = H - MARGIN - CART_H;
    const cw = W - MARGIN * 2;
    const surface = boundary.length >= 3 ? polygonArea(boundary) : 0;
    const per = boundary.length >= 2 ? perimeter(boundary, garden.boundaryClosed !== false) : 0;
    const dateStr = (() => {
      const d = new Date((garden.plan && garden.plan.validatedAt) || garden.updatedAt || Date.now());
      return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR');
    })();
    let budgetTxt = '';
    if (layers.budget) {
      try { const bc = gardenCost(garden, lookup); budgetTxt = `Budget estimé ≈ ${formatEuro(bc.total, { digits: 0 })}${bc.unknownCount ? ` (${bc.unknownCount} sans prix)` : ''}`; } catch { /* */ }
    }
    const region = [garden.context && garden.context.commune, garden.context && garden.context.region].filter(Boolean).join(', ');
    out.push(`<g font-family="${FONT}" fill="#1b1b1b"><rect x="${cx0}" y="${cy0}" width="${cw}" height="${CART_H}" fill="#fff" stroke="#333" stroke-width="1.2"/><line x1="${cx0 + cw * 0.5}" y1="${cy0}" x2="${cx0 + cw * 0.5}" y2="${cy0 + CART_H}" stroke="#333" stroke-width="0.8"/><text x="${cx0 + 12}" y="${cy0 + 24}" font-size="19" font-weight="700">${esc(garden.name || 'Mon jardin')}</text><text x="${cx0 + 12}" y="${cy0 + 44}" font-size="12" fill="#444">${esc(region || 'Région non renseignée')}</text>${budgetTxt ? `<text x="${cx0 + 12}" y="${cy0 + 54}" font-size="10" fill="#444">${esc(budgetTxt)}</text>` : ''}<text x="${cx0 + cw * 0.5 + 12}" y="${cy0 + 20}" font-size="12">Surface : ${frNum(surface, 1)} m² · Périmètre : ${frNum(per, 1)} m</text><text x="${cx0 + cw * 0.5 + 12}" y="${cy0 + 38}" font-size="12">Vue ${illus ? 'illustrée' : 'plan'} · ${age === 'young' ? 'jeunes plants' : 'à maturité'}</text><text x="${cx0 + cw * 0.5 + 12}" y="${cy0 + 53}" font-size="11" fill="#555">${esc(dateStr)}${garden.status === 'validated' ? ' · validé' : ' · brouillon'}</text></g>`);
  }

  const descr = describePlan(garden);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="${P}-t ${P}-d" font-family="${FONT}"><title id="${P}-t">Plan du jardin « ${esc(garden.name || 'Mon jardin')} »</title><desc id="${P}-d">${esc(descr || 'Plan sans zone.')}</desc><defs>${defs.join('')}</defs>${out.join('')}</svg>`;
}
