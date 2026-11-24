// Utilitaires partagés des écrans de dessin : DOM, styles, viewport pan/zoom tactile, accrochage.
import { distance, snapPoint } from '../geometry.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Injecte une fois la feuille de style draw.css (lien relatif au module). */
export function injectStyles() {
  try {
    if (typeof document === 'undefined' || document.getElementById('jd-styles')) return;
    const link = document.createElement('link');
    link.id = 'jd-styles';
    link.rel = 'stylesheet';
    link.href = new URL('./draw.css', import.meta.url).href;
    document.head.appendChild(link);
  } catch { /* repli : styles par défaut du navigateur */ }
}

/** h('div', {class, onclick, ...}, enfants…) */
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (['value', 'checked', 'disabled', 'selected'].includes(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  const add = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.append(c.nodeType ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  return el;
}

export function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, String(v));
  return el;
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Nombre au format français : 12,5 */
export const fr = (n, d = 2) => (Number.isFinite(n) ? n.toFixed(d).replace('.', ',') : '—');
export const frLen = (n) => `${fr(n, 2)} m`;
export const frArea = (n) => `${fr(n, n >= 100 ? 1 : 2)} m²`;
/** Lit un nombre saisi (virgule ou point). */
export function parseNum(s) {
  const n = parseFloat(String(s).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

export function clone(o) { return JSON.parse(JSON.stringify(o)); }

/**
 * Accrochage unifié (grille / ortho / points) via geometry.snapPoint.
 * @returns {{p:{x,y}, kind:'point'|'ortho'|'grid'|null}}
 */
export function snap(p, { grid = 0, points = [], tolerance = 0.15, ortho = null } = {}) {
  let near = null;
  let dMin = tolerance;
  for (const q of points) { const d = distance(p, q); if (d <= dMin) { dMin = d; near = q; } }
  if (near) return { p: { x: near.x, y: near.y }, kind: 'point' };
  const opts = { tolerance };
  if (grid > 0) opts.grid = grid;
  if (ortho) opts.ortho = { from: ortho };
  const r = snapPoint(p, opts);
  const ok = r && Number.isFinite(r.x) && Number.isFinite(r.y);
  const q = ok ? { x: r.x, y: r.y } : { x: p.x, y: p.y };
  let kind = null;
  if (ortho && (Math.abs(q.x - ortho.x) < 1e-9 || Math.abs(q.y - ortho.y) < 1e-9)) kind = 'ortho';
  else if (grid > 0 && (q.x !== p.x || q.y !== p.y)) kind = 'grid';
  return { p: q, kind };
}

/**
 * Canvas SVG interactif (viewBox en mètres) avec pan 1 doigt (si aucun outil ne prend la main),
 * pincement 2 doigts, molette. Les outils fournissent des gestionnaires :
 *   down(world, ev) -> null | {move(world, ev), up(world, ev, moved), cancel()}   (null → pan)
 *   tap(world, ev), hover(world, ev)
 */
export function createCanvas(wrap, { onView, handlers = {} } = {}) {
  const svg = svgEl('svg', { class: 'jd-svg', role: 'img', preserveAspectRatio: 'xMidYMid meet' });
  wrap.appendChild(svg);
  const view = { cx: 0, cy: 0, mpp: 0.05 }; // centre monde, mètres par pixel
  let rect = { left: 0, top: 0, width: 390, height: 520 };
  const measure = () => {
    const r = svg.getBoundingClientRect();
    rect = { left: r.left, top: r.top, width: r.width || 390, height: r.height || 520 };
  };
  const apply = () => {
    measure();
    const w = rect.width * view.mpp;
    const hh = rect.height * view.mpp;
    svg.setAttribute('viewBox', `${view.cx - w / 2} ${view.cy - hh / 2} ${w} ${hh}`);
    if (onView) onView(view);
  };
  const toWorld = (clientX, clientY) => ({
    x: view.cx + (clientX - rect.left - rect.width / 2) * view.mpp,
    y: view.cy + (clientY - rect.top - rect.height / 2) * view.mpp,
  });
  const clampMpp = (m) => Math.min(0.5, Math.max(0.0015, m));
  const zoomAt = (clientX, clientY, factor) => {
    measure();
    const before = toWorld(clientX, clientY);
    view.mpp = clampMpp(view.mpp / factor);
    const after = toWorld(clientX, clientY);
    view.cx += before.x - after.x;
    view.cy += before.y - after.y;
    apply();
  };
  const panPx = (dx, dy) => { view.cx -= dx * view.mpp; view.cy -= dy * view.mpp; apply(); };
  const fit = (b, margin = 1.15) => {
    measure();
    const w = Math.max(b.width || 0, 2);
    const hh = Math.max(b.height || 0, 2);
    view.cx = b.minX + (b.width || 0) / 2;
    view.cy = b.minY + (b.height || 0) / 2;
    view.mpp = clampMpp(Math.max(w / rect.width, hh / rect.height) * margin);
    apply();
  };
  const zoomCenter = (factor) => { measure(); zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor); };

  // --- gestes ---
  const ptrs = new Map();
  let active = null; // {id, handler, startX, startY, moved, t0, panning}
  let pinch = null;
  const evWorld = (e) => toWorld(e.clientX, e.clientY);

  const cancelActive = () => {
    if (active && active.handler && active.handler.cancel) active.handler.cancel();
    active = null;
  };
  const onDown = (e) => {
    measure();
    try { svg.setPointerCapture(e.pointerId); } catch { /* jsdom */ }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) {
      cancelActive();
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      return;
    }
    if (ptrs.size > 2) return;
    const w = evWorld(e);
    const handler = handlers.down ? handlers.down(w, e) : null;
    active = { id: e.pointerId, handler, startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false, t0: Date.now() };
  };
  const onMove = (e) => {
    if (!ptrs.has(e.pointerId)) {
      if (handlers.hover && (e.pointerType === 'mouse' || e.pointerType === 'pen')) handlers.hover(evWorld(e), e);
      return;
    }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      measure();
      view.cx -= (mx - pinch.mx) * view.mpp;
      view.cy -= (my - pinch.my) * view.mpp;
      zoomAt(mx, my, d / pinch.d);
      pinch = { d, mx, my };
      return;
    }
    if (!active || active.id !== e.pointerId) return;
    if (!active.moved && Math.hypot(e.clientX - active.startX, e.clientY - active.startY) > 7) active.moved = true;
    if (active.handler) {
      if (active.moved && active.handler.move) active.handler.move(evWorld(e), e);
    } else if (active.moved) {
      panPx(e.clientX - active.lastX, e.clientY - active.lastY);
    }
    active.lastX = e.clientX; active.lastY = e.clientY;
  };
  const onUp = (e) => {
    const had = ptrs.delete(e.pointerId);
    if (pinch) { if (ptrs.size < 2) pinch = null; if (!ptrs.size) active = null; return; }
    if (!had || !active || active.id !== e.pointerId) return;
    const a = active;
    active = null;
    const w = evWorld(e);
    if (a.handler) {
      if (a.handler.up) a.handler.up(w, e, a.moved);
    } else if (!a.moved && handlers.tap) {
      handlers.tap(w, e);
    }
  };
  const onCancel = (e) => { ptrs.delete(e.pointerId); pinch = null; cancelActive(); };
  const onWheel = (e) => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.2 : 1 / 1.2);
  };
  svg.addEventListener('pointerdown', onDown);
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerup', onUp);
  svg.addEventListener('pointercancel', onCancel);
  svg.addEventListener('wheel', onWheel, { passive: false });
  svg.addEventListener('contextmenu', (e) => e.preventDefault());
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(() => apply()); ro.observe(wrap); }

  return {
    svg, view, apply, fit, zoomCenter, toWorld, panPx, zoomAt,
    px: (n) => n * view.mpp, // pixels → mètres
    destroy() { if (ro) ro.disconnect(); svg.remove(); },
  };
}

/** Pan/zoom CSS (pincement, molette, glisser) d'un contenu dans un conteneur. */
export function createPanZoom(view, content, { min = 0.2, max = 12 } = {}) {
  const st = { x: 0, y: 0, k: 1 };
  const apply = () => { content.style.transform = `translate(${st.x}px, ${st.y}px) scale(${st.k})`; };
  const ptrs = new Map();
  let last = null;
  const zoomAt = (cx, cy, f) => {
    const r = view.getBoundingClientRect();
    const px = cx - r.left; const py = cy - r.top;
    const k = Math.min(max, Math.max(min, st.k * f));
    const real = k / st.k;
    st.x = px - (px - st.x) * real; st.y = py - (py - st.y) * real; st.k = k; apply();
  };
  const fit = (cw, ch) => {
    const r = view.getBoundingClientRect();
    const W = r.width || 390; const H = r.height || 500;
    const k = Math.min(W / cw, H / ch);
    st.k = k; st.x = (W - cw * k) / 2; st.y = (H - ch * k) / 2; apply();
  };
  const down = (e) => { ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); last = null; try { view.setPointerCapture(e.pointerId); } catch { /* */ } };
  const move = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    const prev = ptrs.get(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) { st.x += e.clientX - prev.x; st.y += e.clientY - prev.y; apply(); }
    else if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (last) { st.x += m.x - last.m.x; st.y += m.y - last.m.y; zoomAt(m.x, m.y, d / last.d); }
      last = { d, m };
    }
  };
  const up = (e) => { ptrs.delete(e.pointerId); last = null; };
  const wheel = (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.2 : 1 / 1.2); };
  view.addEventListener('pointerdown', down);
  view.addEventListener('pointermove', move);
  view.addEventListener('pointerup', up);
  view.addEventListener('pointercancel', up);
  view.addEventListener('wheel', wheel, { passive: false });
  return {
    state: st, fit, apply,
    zoomBy(f) { const r = view.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, f); },
    destroy() {
      view.removeEventListener('pointerdown', down); view.removeEventListener('pointermove', move);
      view.removeEventListener('pointerup', up); view.removeEventListener('pointercancel', up);
      view.removeEventListener('wheel', wheel);
    },
  };
}

/** Grille adaptative (path) couvrant le viewBox courant. */
export function gridPath(view, rect) {
  const w = rect.width * view.mpp;
  const hh = rect.height * view.mpp;
  const steps = [0.1, 0.5, 1, 5, 10, 50, 100];
  const step = steps.find((s) => s / view.mpp >= 14) || 100;
  const x0 = view.cx - w / 2; const x1 = view.cx + w / 2;
  const y0 = view.cy - hh / 2; const y1 = view.cy + hh / 2;
  let minor = '';
  let major = '';
  const bigStep = step * 5;
  for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) {
    const isMajor = Math.abs(Math.round(x / bigStep) * bigStep - x) < 1e-9;
    const seg = `M${+x.toFixed(4)} ${y0}V${y1}`;
    if (isMajor) major += seg; else minor += seg;
  }
  for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) {
    const isMajor = Math.abs(Math.round(y / bigStep) * bigStep - y) < 1e-9;
    const seg = `M${x0} ${+y.toFixed(4)}H${x1}`;
    if (isMajor) major += seg; else minor += seg;
  }
  return { minor, major, step };
}

/** Télécharge un Blob ; tente le partage natif (fichier) d'abord si `share`. */
export async function saveBlob(blob, filename, { share = true } = {}) {
  try {
    if (share && typeof navigator !== 'undefined' && navigator.canShare && typeof File !== 'undefined') {
      const file = new File([blob], filename, { type: blob.type });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return 'shared';
      }
    }
  } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}
