// Rendu SVG des aménagements : éléments posés, côtés murs/clôtures/haies, ouvertures (pur, sans DOM).
// Renvoie une chaîne SVG (groupe) à insérer dans un plan : coordonnées monde × `scale` (px par mètre).
import {
  ITEM_KINDS, EDGE_KINDS, getItemKind, getOpeningKind, getEdgeKind, itemPolygon, itemRadius, itemHalfSize,
  boundarySides, obstacleSides, edgeKindOf, openingGeometry, MATERIALS, materialOf,
} from './items.js';
import { getPlant } from './catalog.js';
import { EXISTING_KINDS, getExistingKind, existingLabel, existingPlant, getFenceMaterial } from './existing.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const f = (n) => (Math.round(n * 100) / 100).toString();
const fr = (n) => n.toFixed(2).replace('.', ',');


/**
 * Clôture / mur selon le matériau, sur une polyligne en coordonnées de sortie (`pts` : [{x, y}]) :
 * bois = lattes brunes espacées ; métal = barreaux fins gris foncé + poteaux ; béton, pierre, brique = trait plein épais ;
 * grillage = trait fin maillé.
 */
export function fenceMarkup(pts, material, { u = 1, thick = 0.05, scale = 1, selected = false, closedLoop = false } = {}) {
  const line = pts.map((p) => `${f(p.x)},${f(p.y)}`).join(' ');
  const poly = (extra) => `<polyline points="${line}" fill="none" ${extra}/>`;
  const col = selected ? '#d81b60' : (MATERIALS[material] || MATERIALS.wood).color;
  const th = Math.max(2 * u, thick * scale);
  void closedLoop;
  if (material === 'metal') {
    const posts = pts.map((p) => `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${f(2.4 * u)}" fill="${col}"/>`).join('');
    return poly(`stroke="${col}" stroke-width="${f(1.2 * u)}"`) + poly(`stroke="${col}" stroke-width="${f(4.5 * u)}" stroke-dasharray="${f(0.9 * u)} ${f(3.2 * u)}"`) + posts;
  }
  if (material === 'concrete') return poly(`stroke="${col}" stroke-width="${f(Math.max(4.5 * u, th))}" stroke-linecap="square"`) + poly(`stroke="#e0e0e0" stroke-width="${f(Math.max(1 * u, th * 0.25))}" stroke-linecap="square"`);
  if (material === 'stone') return poly(`stroke="${col}" stroke-width="${f(Math.max(4.5 * u, th))}" stroke-linecap="square"`) + poly(`stroke="#efebe9" stroke-width="${f(Math.max(1 * u, th * 0.3))}" stroke-dasharray="${f(5 * u)} ${f(3 * u)}"`);
  if (material === 'brick') return poly(`stroke="${col}" stroke-width="${f(Math.max(4.5 * u, th))}" stroke-linecap="square"`) + poly(`stroke="#f3d9cf" stroke-width="${f(Math.max(1 * u, th * 0.3))}" stroke-dasharray="${f(3 * u)} ${f(2 * u)}"`);
  if (material === 'mesh') return poly(`stroke="${col}" stroke-width="${f(3.4 * u)}" stroke-dasharray="${f(1.1 * u)} ${f(2.2 * u)}" stroke-opacity=".85"`) + poly(`stroke="${col}" stroke-width="${f(1 * u)}"`);
  // bois : lattes brunes espacées + rail
  return poly(`stroke="${col}" stroke-width="${f(1.2 * u)}"`) + poly(`stroke="${col}" stroke-width="${f(Math.max(5 * u, th))}" stroke-dasharray="${f(2 * u)} ${f(3 * u)}"`);
}

const HEX = /^#[0-9a-f]{6}$/i;
const darken = (hex, k = 0.7) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0');
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
};

/** Côté de mur/clôture/maison/contour le plus proche d'un point (≤ `max` m) : {angle (rad), q}. */
function nearestWall(garden, p, max = 1.5) {
  const sides = boundarySides(garden).map((s) => ({ a: s.a, b: s.b }));
  for (const o of garden.obstacles || []) {
    if (['house', 'shed', 'wall', 'fence'].includes(o.kind)) for (const s of obstacleSides(o)) sides.push({ a: s.a, b: s.b });
  }
  let best = null;
  for (const s of sides) {
    const dx = s.b.x - s.a.x; const dy = s.b.y - s.a.y; const L2 = dx * dx + dy * dy;
    if (L2 < 1e-9) continue;
    const t = Math.min(1, Math.max(0, ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / L2));
    const q = { x: s.a.x + dx * t, y: s.a.y + dy * t };
    const d = Math.hypot(p.x - q.x, p.y - q.y);
    if (d <= max && (!best || d < best.d)) best = { d, q, angle: Math.atan2(dy, dx) };
  }
  return best;
}

/** Rendu d'un élément existant ; `low` = tout sauf les arbres (dessinés au-dessus du mobilier). */
function existingSVG(garden, e, ctx) {
  const { tx, ty, scale, u, names, bg, sel, lookup } = ctx;
  const k = getExistingKind(e.kind) || getExistingKind('other');
  const plant = existingPlant(e, lookup);
  const col = plant && HEX.test(plant.foliageColor || '') ? plant.foliageColor : k.color;
  const dark = darken(col, 0.6);
  const keep = e.keep !== false;
  const selected = sel.existingId === e.id;
  const stroke = selected ? '#d81b60' : dark;
  const sw = f((selected ? 2.6 : 1.3) * u);
  const dash = keep ? '' : ` stroke-dasharray="${f(4 * u)} ${f(3 * u)}"`;
  const op = keep ? 1 : 0.55;
  const cx = tx(e.x); const cy = ty(e.y);
  const R = Math.max(2.5 * u, (e.width / 2) * scale);
  const P = (p) => `${f(tx(p.x))},${f(ty(p.y))}`;
  let body = '';
  let tag = { x: cx, y: cy + R }; // point d'ancrage de l'étiquette
  let badgeAt = { x: cx + R * 0.7, y: cy - R * 0.7 };
  if (e.kind === 'hedge' && Array.isArray(e.points) && e.points.length >= 2) {
    const line = e.points.map(P).join(' ');
    const wpx = Math.max(6 * u, e.width * scale);
    body = `<polyline points="${line}" fill="none" stroke="${selected ? '#d81b60' : dark}" stroke-width="${f(wpx + 2 * u)}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity=".9"/>`
      + `<polyline points="${line}" fill="none" stroke="${col}" stroke-width="${f(wpx)}" stroke-linecap="round" stroke-linejoin="round"/>`
      + `<polyline points="${line}" fill="none" stroke="${dark}" stroke-width="${f(Math.max(2 * u, wpx * 0.28))}" stroke-dasharray="${f(1 * u)} ${f(6 * u)}" stroke-linecap="round" stroke-opacity=".7"/>`;
    const mid = e.points[Math.floor(e.points.length / 2)];
    tag = { x: tx(mid.x), y: ty(mid.y) + wpx / 2 + 2 * u };
    badgeAt = { x: tx(e.points[0].x), y: ty(e.points[0].y) - wpx / 2 - 4 * u };
  } else if (e.kind === 'fence' && Array.isArray(e.points) && e.points.length >= 2) {
    const mat = getFenceMaterial(e.material);
    const pts = e.points.map((p) => ({ x: tx(p.x), y: ty(p.y) }));
    body = fenceMarkup(pts, mat.id, { u, thick: e.width, scale, selected });
    const mid = pts[Math.floor(pts.length / 2)];
    tag = { x: mid.x, y: mid.y + 6 * u };
    badgeAt = { x: pts[0].x, y: pts[0].y - 9 * u };
  } else if (e.kind === 'climber') {
    const wall = nearestWall(garden, e);
    const ang = wall ? wall.angle : 0;
    const len = Math.max(10 * u, e.width * scale);
    const c0 = wall ? { x: tx(wall.q.x), y: ty(wall.q.y) } : { x: cx, y: cy };
    const dx = Math.cos(ang); const dy = Math.sin(ang);
    const a = { x: c0.x - dx * len / 2, y: c0.y - dy * len / 2 }; const b = { x: c0.x + dx * len / 2, y: c0.y + dy * len / 2 };
    const leaves = [];
    const n = Math.max(3, Math.round(len / (7 * u)));
    for (let i = 0; i <= n; i++) {
      const t = i / n; const side = i % 2 ? 1 : -1;
      leaves.push(`<circle cx="${f(a.x + (b.x - a.x) * t - dy * side * 3.5 * u)}" cy="${f(a.y + (b.y - a.y) * t + dx * side * 3.5 * u)}" r="${f(3 * u)}" fill="${col}" stroke="${dark}" stroke-width="${f(0.6 * u)}"/>`);
    }
    body = `<line x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(b.x)}" y2="${f(b.y)}" stroke="${selected ? '#d81b60' : '#6d4c41'}" stroke-width="${f((selected ? 3 : 1.6) * u)}" stroke-linecap="round"/>${leaves.join('')}`;
    tag = { x: c0.x, y: c0.y + 9 * u }; badgeAt = { x: b.x, y: b.y - 8 * u };
  } else if (e.kind === 'tree') {
    const sd = R * 0.12;
    body = `<circle cx="${f(cx + sd)}" cy="${f(cy + sd)}" r="${f(R)}" fill="#000" fill-opacity=".14"/>`
      + `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R)}" fill="${col}" fill-opacity=".72" stroke="${stroke}" stroke-width="${sw}"${dash}/>`
      + `<circle cx="${f(cx - R * 0.25)}" cy="${f(cy - R * 0.25)}" r="${f(R * 0.5)}" fill="#fff" fill-opacity=".14"/>`
      + `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(Math.max(2 * u, Math.min(R * 0.12, 4 * u)))}" fill="#5d4037" stroke="#3e2723" stroke-width="${f(0.6 * u)}"/>`;
  } else if (e.kind === 'perennial') {
    const bits = [];
    const nb = 7;
    for (let i = 0; i < nb; i++) {
      const t = (2 * Math.PI * i) / nb;
      bits.push(`<circle cx="${f(cx + Math.cos(t) * R * 0.55)}" cy="${f(cy + Math.sin(t) * R * 0.55)}" r="${f(R * 0.32)}" fill="${col}" fill-opacity=".9" stroke="${dark}" stroke-width="${f(0.6 * u)}"/>`);
    }
    body = `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R)}" fill="${col}" fill-opacity=".28" stroke="${stroke}" stroke-width="${sw}"${dash || ` stroke-dasharray="${f(2 * u)} ${f(2 * u)}"`}/>${bits.join('')}`;
  } else if (e.kind === 'shrub') {
    body = `<circle cx="${f(cx + R * 0.08)}" cy="${f(cy + R * 0.1)}" r="${f(R)}" fill="#000" fill-opacity=".12"/>`
      + `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R)}" fill="${col}" fill-opacity=".85" stroke="${stroke}" stroke-width="${sw}"${dash}/>`
      + [[-0.35, -0.2, 0.45], [0.3, -0.3, 0.38], [0.05, 0.35, 0.42]].map(([ox, oy, rr]) => `<circle cx="${f(cx + ox * R)}" cy="${f(cy + oy * R)}" r="${f(rr * R)}" fill="${darken(col, 0.85)}" fill-opacity=".55"/>`).join('');
  } else {
    body = `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R)}" fill="${col}" fill-opacity=".5" stroke="${stroke}" stroke-width="${sw}" stroke-dasharray="${f(4 * u)} ${f(3 * u)}"/>`;
  }
  let badge = '';
  if (!keep) {
    const br = 7 * u;
    badge = `<g data-role="remove-badge"><circle cx="${f(badgeAt.x)}" cy="${f(badgeAt.y)}" r="${f(br)}" fill="#fff" stroke="#c62828" stroke-width="${f(1.6 * u)}"/>`
      + `<text x="${f(badgeAt.x)}" y="${f(badgeAt.y + 4 * u)}" font-size="${f(10 * u)}" text-anchor="middle">🪓</text>`
      + `<line x1="${f(badgeAt.x - br * 0.75)}" y1="${f(badgeAt.y + br * 0.75)}" x2="${f(badgeAt.x + br * 0.75)}" y2="${f(badgeAt.y - br * 0.75)}" stroke="#c62828" stroke-width="${f(1.8 * u)}" stroke-linecap="round"/></g>`;
  }
  let txt = '';
  if (names) {
    const lab = e.kind === 'fence' && !(typeof e.label === 'string' && e.label.trim() && e.label !== 'Clôture existante') ? `Clôture ${getFenceMaterial(e.material).label.toLowerCase()}` : existingLabel(e, lookup);
    txt = `<text x="${f(tag.x)}" y="${f(tag.y + 10 * u)}" font-size="${f(10 * u)}" text-anchor="middle" fill="#1b2a1b" stroke="${bg}" stroke-width="${f(2.6 * u)}" paint-order="stroke">${esc(lab)}${keep ? '' : ' (à retirer)'}</text>`;
  }
  return `<g data-existing="${esc(e.id)}" data-kind="${esc(e.kind)}"${e.kind === 'fence' ? ` data-material="${getFenceMaterial(e.material).id}"` : ''}${keep ? '' : ' data-keep="0"'}${selected ? ' data-selected="1"' : ''} opacity="${op}">${body}${badge}${txt}</g>`;
}

/**
 * @param {object} garden
 * @param {{scale?:number, tx?:(x:number)=>number, ty?:(y:number)=>number, px?:number, names?:boolean, bg?:string,
 *   selected?:{itemId?:string, openingId?:string, edge?:number, existingId?:string}, plantLookup?:(id:string)=>object}} [opts]
 *   `scale` : unités de sortie par mètre (px/m) ; `tx`/`ty` : transformations monde → sortie (défaut x·scale) ;
 *   `px` : taille d'un pixel d'écran en unités de sortie (épaisseurs de trait et textes, 1 par défaut) ;
 *   `bg` : couleur du fond, utilisée pour creuser les brèches des ouvertures ; `plantLookup` : essences (catalogue par défaut).
 * @returns {string} un groupe SVG (vide s'il n'y a rien à dessiner)
 */
export function renderItemsSVG(garden, opts = {}) {
  const scale = opts.scale > 0 ? opts.scale : 1;
  const tx = opts.tx || ((x) => x * scale);
  const ty = opts.ty || ((y) => y * scale);
  const u = opts.px > 0 ? opts.px : 1;
  const names = opts.names !== false;
  const bg = opts.bg || '#ffffff';
  const sel = opts.selected || {};
  const P = (p) => `${f(tx(p.x))},${f(ty(p.y))}`;
  const out = [];
  const ectx = { tx, ty, scale, u, names, bg, sel, lookup: opts.plantLookup || getPlant };
  const existants = Array.isArray(garden.existing) ? garden.existing.filter((e) => e && getExistingKind(e.kind)) : [];
  const isHigh = (e) => e.kind === 'tree';

  // --- côtés du contour : mur / clôture / haie ---
  for (const s of boundarySides(garden)) {
    const kind = edgeKindOf(garden, s.i);
    if (kind === 'open') continue;
    const k = getEdgeKind(kind);
    const line = (extra) => `<line x1="${f(tx(s.a.x))}" y1="${f(ty(s.a.y))}" x2="${f(tx(s.b.x))}" y2="${f(ty(s.b.y))}" ${extra}/>`;
    const haut = sel.edge === s.i ? ` data-selected="1"` : '';
    if (kind === 'wall' || kind === 'fence') {
      const mat = materialOf(kind, garden.boundaryEdges && garden.boundaryEdges[s.i] && garden.boundaryEdges[s.i].material);
      const A = { x: tx(s.a.x), y: ty(s.a.y) }; const B = { x: tx(s.b.x), y: ty(s.b.y) };
      out.push(`<g data-edge="${s.i}" data-kind="${kind}" data-material="${mat}"${haut}>${fenceMarkup([A, B], mat, { u, thick: k.thickness, scale, selected: !!haut })}</g>`);
    } else {
      out.push(`<g data-edge="${s.i}" data-kind="hedge"${haut}>${line(`stroke="${k.color}" stroke-opacity=".85" stroke-width="${f(Math.max(6 * u, k.thickness * scale))}" stroke-linecap="round"`)}${line(`stroke="#1b5e20" stroke-width="${f(Math.max(2.4 * u, k.thickness * scale * 0.3))}" stroke-dasharray="${f(1 * u)} ${f(7 * u)}" stroke-linecap="round"`)}</g>`);
    }
  }

  // --- plantes existantes basses (sous le mobilier) ---
  for (const e of existants.filter((x) => !isHigh(x))) out.push(existingSVG(garden, e, ectx));

  // --- éléments posés ---
  for (const it of garden.items || []) {
    const k = getItemKind(it.kind);
    if (!k) continue;
    const poly = itemPolygon(it);
    const color = k.color;
    const sx = sel.itemId === it.id;
    const stroke = `stroke="${sx ? '#d81b60' : '#37474f'}" stroke-width="${f((sx ? 2.6 : 1.4) * u)}"`;
    const r = itemRadius(it);
    const { hw, hd } = itemHalfSize(it);
    const body = r != null
      ? `<circle cx="${f(tx(it.x))}" cy="${f(ty(it.y))}" r="${f(r * scale)}" fill="${color}" fill-opacity=".8" ${stroke}/>`
      : `<polygon points="${poly.map(P).join(' ')}" fill="${color}" fill-opacity=".8" ${stroke}/>`;
    let txt = '';
    const minDim = Math.min(hw, hd) * 2 * scale;
    const label = it.label || k.short;
    if (names && minDim >= 24 * u) {
      const fs = Math.min(11 * u, minDim / 3.2);
      txt = `<text x="${f(tx(it.x))}" y="${f(ty(it.y) + fs * 0.35)}" font-size="${f(fs * 1.5)}" text-anchor="middle">${esc(k.emoji)}</text>`
        + (Math.max(hw, hd) * 2 * scale >= 40 * u ? `<text x="${f(tx(it.x))}" y="${f(ty(it.y) + fs * 1.9)}" font-size="${f(fs)}" text-anchor="middle" fill="#263238">${esc(label)}</text>` : '');
    } else if (names) {
      txt = `<text x="${f(tx(it.x))}" y="${f(ty(it.y) + 4 * u)}" font-size="${f(12 * u)}" text-anchor="middle">${esc(k.emoji)}</text>`;
    }
    out.push(`<g data-item="${esc(it.id)}" data-kind="${esc(it.kind)}">${body}${txt}</g>`);
  }

  // --- arbres existants (houppier au-dessus du mobilier) ---
  for (const e of existants.filter(isHigh)) out.push(existingSVG(garden, e, ectx));

  // --- ouvertures : brèche, montants, battant ou rail ---
  for (const op of garden.openings || []) {
    const k = getOpeningKind(op.kind);
    const g = k && openingGeometry(garden, op);
    if (!g) continue;
    const col = sel.openingId === op.id ? '#d81b60' : k.color;
    const thick = Math.max(8 * u, 0.3 * scale);
    const A = { x: tx(g.a.x), y: ty(g.a.y) };
    const B = { x: tx(g.b.x), y: ty(g.b.y) };
    const W = Math.hypot(B.x - A.x, B.y - A.y);
    // vecteurs en sortie (tx/ty peuvent être des transformations affines sans rotation)
    const nx = g.normal.x; const ny = g.normal.y;
    const parts = [];
    parts.push(`<line x1="${f(A.x)}" y1="${f(A.y)}" x2="${f(B.x)}" y2="${f(B.y)}" style="stroke:${bg}" stroke-width="${f(thick)}"/>`);
    for (const E of [A, B]) {
      parts.push(`<line x1="${f(E.x - nx * thick / 2)}" y1="${f(E.y - ny * thick / 2)}" x2="${f(E.x + nx * thick / 2)}" y2="${f(E.y + ny * thick / 2)}" stroke="${col}" stroke-width="${f(2.6 * u)}" stroke-linecap="round"/>`);
    }
    const sw = op.swing || k.swing;
    if (sw === 'sliding') {
      const o = thick / 2 + 3 * u;
      const rail = `x1="${f(A.x + nx * o)}" y1="${f(A.y + ny * o)}" x2="${f(B.x + nx * o)}" y2="${f(B.y + ny * o)}"`;
      parts.push(`<line ${rail} stroke="${col}" stroke-width="${f(2 * u)}"/>`);
      parts.push(`<line x1="${f(A.x)}" y1="${f(A.y)}" x2="${f(B.x)}" y2="${f(B.y)}" stroke="${col}" stroke-width="${f(2 * u)}" stroke-dasharray="${f(6 * u)} ${f(4 * u)}"/>`);
      const n = Math.max(2, Math.floor(W / (14 * u)));
      if (op.kind === 'garage') {
        for (let i = 1; i < n; i++) {
          const t = i / n;
          const cx = A.x + (B.x - A.x) * t; const cy = A.y + (B.y - A.y) * t;
          parts.push(`<line x1="${f(cx - nx * thick * 0.35)}" y1="${f(cy - ny * thick * 0.35)}" x2="${f(cx + nx * thick * 0.35)}" y2="${f(cy + ny * thick * 0.35)}" stroke="${col}" stroke-width="${f(1.2 * u)}"/>`);
        }
      }
    } else {
      const dirSign = sw === 'out' ? 1 : -1;
      const dx = nx * dirSign; const dy = ny * dirSign; // direction d'ouverture du battant
      const leaves = op.kind === 'double_gate' ? [[A, B], [B, A]] : [[A, B]];
      for (const [hinge, other] of leaves) {
        const len = (op.kind === 'double_gate' ? W / 2 : W);
        const end = { x: hinge.x + dx * len, y: hinge.y + dy * len };
        const close = op.kind === 'double_gate'
          ? { x: hinge.x + (other.x - hinge.x) / 2, y: hinge.y + (other.y - hinge.y) / 2 }
          : other;
        const cross = (end.x - hinge.x) * (close.y - hinge.y) - (end.y - hinge.y) * (close.x - hinge.x);
        parts.push(`<line x1="${f(hinge.x)}" y1="${f(hinge.y)}" x2="${f(end.x)}" y2="${f(end.y)}" stroke="${col}" stroke-width="${f(2.8 * u)}" stroke-linecap="round"/>`);
        parts.push(`<path d="M${f(end.x)},${f(end.y)} A${f(len)},${f(len)} 0 0 ${cross > 0 ? 1 : 0} ${f(close.x)},${f(close.y)}" fill="none" stroke="${col}" stroke-width="${f(1.2 * u)}" stroke-dasharray="${f(3 * u)} ${f(3 * u)}"/>`);
      }
    }
    let txt = '';
    if (names) {
      const dir = sw === 'in' ? -1 : 1;
      const off = thick / 2 + (sw === 'sliding' ? 14 * u : W + 10 * u);
      const lx = tx(g.center.x) + nx * off * dir;
      const ly = ty(g.center.y) + ny * off * dir;
      txt = `<text x="${f(lx)}" y="${f(ly)}" font-size="${f(10 * u)}" text-anchor="middle" fill="${col}" stroke="${bg}" stroke-width="${f(2.5 * u)}" paint-order="stroke">${esc(k.label)} ${fr(g.width)} m</text>`;
    }
    out.push(`<g data-opening="${esc(op.id)}" data-kind="${esc(op.kind)}">${parts.join('')}${txt}</g>`);
  }

  if (!out.length) return '';
  return `<g class="jd-items-layer" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif">${out.join('')}</g>`;
}

/**
 * Entrées de légende des aménagements utilisés : [{id, type:'item'|'edge'|'opening'|'existing', label, emoji, color, count}].
 */
export function itemsLegendEntries(garden) {
  const entries = [];
  const count = (arr, keyFn) => { const m = new Map(); for (const x of arr) { const k = keyFn(x); if (k != null) m.set(k, (m.get(k) || 0) + 1); } return m; };

  const ci = count(garden.items || [], (it) => (getItemKind(it.kind) ? it.kind : null));
  for (const k of ITEM_KINDS) {
    if (ci.has(k.id)) entries.push({ id: k.id, type: 'item', label: k.label, emoji: k.emoji, color: k.color, count: ci.get(k.id) });
  }
  const edgeKinds = boundarySides(garden).map((s) => edgeKindOf(garden, s.i)).filter((k) => k !== 'open');
  const ce = count(edgeKinds, (k) => k);
  for (const k of EDGE_KINDS) {
    if (ce.has(k.id)) entries.push({ id: k.id, type: 'edge', label: k.label, emoji: '', color: k.color, count: ce.get(k.id) });
  }
  const co = count((garden.openings || []).filter((o) => openingGeometry(garden, o)), (o) => (getOpeningKind(o.kind) ? o.kind : null));
  for (const [id, n] of co) {
    const k = getOpeningKind(id);
    entries.push({ id, type: 'opening', label: k.label, emoji: k.emoji, color: k.color, count: n });
  }
  const cx = new Map();
  for (const e of garden.existing || []) if (e && getExistingKind(e.kind)) cx.set(e.kind, (cx.get(e.kind) || 0) + 1);
  for (const k of EXISTING_KINDS) {
    if (k.id === 'fence' && cx.has('fence')) {
      for (const m of ['wood', 'metal', 'concrete']) {
        const n = (garden.existing || []).filter((e) => e && e.kind === 'fence' && getFenceMaterial(e.material).id === m).length;
        if (n) entries.push({ id: `existing-fence-${m}`, type: 'existing', label: `Clôture existante (${getFenceMaterial(m).label.toLowerCase()})`, emoji: k.emoji, color: getFenceMaterial(m).color, count: n });
      }
    } else if (cx.has(k.id)) entries.push({ id: `existing-${k.id}`, type: 'existing', label: k.defaultLabel, emoji: k.emoji, color: k.color, count: cx.get(k.id) });
  }
  return entries;
}
