// Rendu SVG des aménagements : éléments posés, côtés murs/clôtures/haies, ouvertures (pur, sans DOM).
// Renvoie une chaîne SVG (groupe) à insérer dans un plan : coordonnées monde × `scale` (px par mètre).
import {
  ITEM_KINDS, EDGE_KINDS, getItemKind, getOpeningKind, getEdgeKind, itemPolygon, itemRadius, itemHalfSize,
  boundarySides, edgeKindOf, openingGeometry,
} from './items.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const f = (n) => (Math.round(n * 100) / 100).toString();
const fr = (n) => n.toFixed(2).replace('.', ',');

/**
 * @param {object} garden
 * @param {{scale?:number, tx?:(x:number)=>number, ty?:(y:number)=>number, px?:number, names?:boolean, bg?:string,
 *   selected?:{itemId?:string, openingId?:string, edge?:number}}} [opts]
 *   `scale` : unités de sortie par mètre (px/m) ; `tx`/`ty` : transformations monde → sortie (défaut x·scale) ;
 *   `px` : taille d'un pixel d'écran en unités de sortie (épaisseurs de trait et textes, 1 par défaut) ;
 *   `bg` : couleur du fond, utilisée pour creuser les brèches des ouvertures.
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

  // --- côtés du contour : mur / clôture / haie ---
  for (const s of boundarySides(garden)) {
    const kind = edgeKindOf(garden, s.i);
    if (kind === 'open') continue;
    const k = getEdgeKind(kind);
    const line = (extra) => `<line x1="${f(tx(s.a.x))}" y1="${f(ty(s.a.y))}" x2="${f(tx(s.b.x))}" y2="${f(ty(s.b.y))}" ${extra}/>`;
    const haut = sel.edge === s.i ? ` data-selected="1"` : '';
    if (kind === 'wall') {
      out.push(`<g data-edge="${s.i}" data-kind="wall"${haut}>${line(`stroke="${k.color}" stroke-width="${f(Math.max(4 * u, k.thickness * scale))}" stroke-linecap="square"`)}${line(`stroke="#9e9e9e" stroke-width="${f(Math.max(1 * u, k.thickness * scale * 0.25))}" stroke-linecap="square"`)}</g>`);
    } else if (kind === 'fence') {
      out.push(`<g data-edge="${s.i}" data-kind="fence"${haut}>${line(`stroke="${k.color}" stroke-width="${f(Math.max(2.4 * u, k.thickness * scale))}" stroke-dasharray="${f(7 * u)} ${f(3 * u)}"`)}${line(`stroke="${k.color}" stroke-width="${f(5 * u)}" stroke-dasharray="${f(1.2 * u)} ${f(26 * u)}" stroke-linecap="round"`)}</g>`);
    } else {
      out.push(`<g data-edge="${s.i}" data-kind="hedge"${haut}>${line(`stroke="${k.color}" stroke-opacity=".85" stroke-width="${f(Math.max(6 * u, k.thickness * scale))}" stroke-linecap="round"`)}${line(`stroke="#1b5e20" stroke-width="${f(Math.max(2.4 * u, k.thickness * scale * 0.3))}" stroke-dasharray="${f(1 * u)} ${f(7 * u)}" stroke-linecap="round"`)}</g>`);
    }
  }

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
 * Entrées de légende des aménagements utilisés : [{id, type:'item'|'edge'|'opening', label, emoji, color, count}].
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
  return entries;
}
