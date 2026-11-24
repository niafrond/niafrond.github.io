// Éditeur d'aménagements : mobilier et équipements, murs / clôtures / haies, portes et accès.
import { distance, bounds, polygonInside, centroid } from '../geometry.js';
import { createItem, createOpening, ensureAmenagements, newId } from '../model.js';
import {
  ITEM_KINDS, ITEM_CATEGORIES, OPENING_KINDS, OPENING_SWINGS, EDGE_KINDS, getItemKind, getOpeningKind, getEdgeKind,
  itemPolygon, itemContains, itemRadius, itemHalfSize, boundarySides, obstacleSides, edgeKindOf, edgeHeightOf,
  openingGeometry, snapOpeningToSides, itemsTotalPrice,
} from '../items.js';
import { renderItemsSVG } from '../render-items.js';
import {
  injectStyles, h, createCanvas, gridPath, clone, esc, fr, projectOnLine, parseLength, toCm,
} from './draw-util.js';
import { createPop } from './pop.js';

const NS = 'vector-effect="non-scaling-stroke"';
const GRIDS = [0.1, 0.5, 0];
const TABS = [
  { id: 'furniture', label: '🪑 Mobilier' },
  { id: 'edges', label: '🧱 Murs & clôtures' },
  { id: 'access', label: '🚪 Portes & accès' },
];
const FREE_KINDS = { wall: { label: 'Mur', height: 2 }, fence: { label: 'Clôture', height: 1.2 } };
const rad = (d) => (d * Math.PI) / 180;
const norm360 = (a) => ((a % 360) + 360) % 360;
const euro = (n) => `${Math.round(n).toLocaleString('fr-FR')} €`;
const cm = (m) => `${Math.round(m * 100)}`;

function injectItemsStyles() {
  try {
    if (typeof document === 'undefined' || document.getElementById('jdi-styles')) return;
    const link = document.createElement('link');
    link.id = 'jdi-styles';
    link.rel = 'stylesheet';
    link.href = new URL('./draw-items.css', import.meta.url).href;
    document.head.appendChild(link);
  } catch { /* styles par défaut */ }
}

/** Dimensions lisibles d'un élément : « 150 × 50 cm » ou « Ø 120 cm ». */
export function itemDims(it) {
  const r = itemRadius(it);
  return r != null ? `Ø ${cm(r * 2)} cm` : `${cm(it.width)} × ${cm(it.depth)} cm`;
}

export function mountItemEditor(el, { garden, onChange } = {}) {
  injectStyles();
  injectItemsStyles();
  const g = ensureAmenagements(garden);
  g.boundary = g.boundary || [];
  g.obstacles = g.obstacles || [];

  const st = {
    tab: 'furniture', cat: 'all', kind: null, openKind: 'gate', sel: null, gridIdx: 0, history: [], future: [],
    draft: null, msg: '', msgKind: '', ghost: null, dismissed: {},
  };
  let destroyed = false;

  const snapshot = () => clone({ items: g.items, boundaryEdges: g.boundaryEdges, openings: g.openings, obstacles: g.obstacles });
  const restore = (s) => {
    g.items = clone(s.items); g.boundaryEdges = clone(s.boundaryEdges); g.openings = clone(s.openings); g.obstacles = clone(s.obstacles);
    if (!selExists()) st.sel = null;
  };
  const changed = () => { if (onChange) onChange(g); draw(); refreshUI(); };
  const pushHistory = (before) => { st.history.push(before); if (st.history.length > 100) st.history.shift(); st.future = []; };
  const mutate = (fn) => { pushHistory(snapshot()); fn(); changed(); };
  const undo = () => { if (!st.history.length) return; st.future.push(snapshot()); restore(st.history.pop()); changed(); };
  const redo = () => { if (!st.future.length) return; st.history.push(snapshot()); restore(st.future.pop()); changed(); };
  const say = (msg, kind = '') => { st.msg = msg; st.msgKind = kind; paintMsg(); };
  const gridSize = () => GRIDS[st.gridIdx];
  const closed = () => !!g.boundaryClosed && g.boundary.length >= 3;
  const hasContour = () => g.boundary.length >= 2;

  const selItem = () => (st.sel && st.sel.t === 'item' ? g.items.find((i) => i.id === st.sel.id) : null);
  const selOpening = () => (st.sel && st.sel.t === 'open' ? g.openings.find((o) => o.id === st.sel.id) : null);
  const selObstacle = () => (st.sel && st.sel.t === 'obst' ? g.obstacles.find((o) => o.id === st.sel.id) : null);
  const selEdge = () => (st.sel && st.sel.t === 'edge' ? st.sel.i : null);
  function selExists() {
    if (!st.sel) return true;
    if (st.sel.t === 'item') return !!selItem();
    if (st.sel.t === 'open') return !!selOpening();
    if (st.sel.t === 'obst') return !!selObstacle();
    if (st.sel.t === 'edge') return st.sel.i < boundarySides(g).length;
    return true;
  }

  // ---------- DOM ----------
  const root = h('div', { class: 'jd jd-editor jdi', 'data-role': 'items-editor' });
  const tabs = h('div', { class: 'jdi-tabs', role: 'tablist', 'aria-label': 'Aménagements' });
  const bar = h('div', { class: 'jd-bar jd-scroll' });
  const panel = h('div', { class: 'jdi-panel' });
  const wrap = h('div', { class: 'jd-canvas-wrap' });
  const detail = h('div', { class: 'jdi-detail', hidden: true, 'data-role': 'detail' });
  const info = h('div', { class: 'jd-info' });
  const msgEl = h('div', { class: 'jd-msg', role: 'status', 'aria-live': 'polite' });
  const startEl = h('div', { class: 'jdi-start', hidden: true, 'data-role': 'start-panel' });
  root.append(tabs, bar, panel, wrap, detail, info, msgEl);
  el.innerHTML = '';
  el.appendChild(root);

  const btn = (label, act, onclick, cls = '', extra = {}) => h('button', { type: 'button', class: `jd-btn ${cls}`, 'data-act': act, onclick, ...extra }, label);

  const tabBtns = TABS.map((t) => h('button', {
    type: 'button', class: 'jd-tab', role: 'tab', 'data-tab': t.id, onclick: () => setTab(t.id),
  }, t.label));
  tabs.append(...tabBtns);

  const bUndo = btn('↶', 'undo', undo, '', { 'aria-label': 'Annuler' });
  const bRedo = btn('↷', 'redo', redo, '', { 'aria-label': 'Rétablir' });
  const bGrid = btn('', 'grid', () => { st.gridIdx = (st.gridIdx + 1) % GRIDS.length; draw(); refreshUI(); }, '', { title: 'Pas de la grille' });
  const bZoomOut = btn('－', 'zoom-out', () => cv.zoomCenter(1 / 1.4), '', { 'aria-label': 'Zoom arrière' });
  const bZoomIn = btn('＋', 'zoom-in', () => cv.zoomCenter(1.4), '', { 'aria-label': 'Zoom avant' });
  const bFit = btn('⤢', 'fit', () => fitView(), '', { 'aria-label': 'Recentrer le plan', title: 'Recentrer' });
  const chips = h('div', { class: 'jdi-chips', 'data-role': 'chips' });
  bar.append(bUndo, bRedo, bGrid, bZoomOut, bZoomIn, bFit, chips);

  // ---------- canvas ----------
  const SVGNS = 'http://www.w3.org/2000/svg';
  const gGrid = document.createElementNS(SVGNS, 'g');
  const gMain = document.createElementNS(SVGNS, 'g');
  const gTop = document.createElementNS(SVGNS, 'g');
  const cv = createCanvas(wrap, { onView: () => draw(), handlers: { down: onDown, tap: onTap, hover: onHover, long: onLong } });
  wrap.append(startEl);
  cv.svg.append(gGrid, gMain, gTop);
  cv.svg.setAttribute('aria-label', 'Plan du terrain : aménagements');
  const pop = createPop(wrap, { onClose: () => draw(), onWarn: (m) => say(m, 'warn') });

  function fitView() {
    const pts = [...g.boundary];
    g.obstacles.forEach((o) => { if (o.points) pts.push(...o.points); else if (o.center) pts.push(o.center); });
    g.items.forEach((i) => pts.push(...itemPolygon(i)));
    if (pts.length >= 2) cv.fit(bounds(pts), 1.3);
    else cv.fit({ minX: 0, minY: 0, width: 12, height: 8 }, 1.15);
  }

  // ---------- géométrie d'interaction ----------
  const snapGrid = (p) => {
    const s = gridSize();
    return s ? { x: +(Math.round(p.x / s) * s).toFixed(6), y: +(Math.round(p.y / s) * s).toFixed(6) } : { x: p.x, y: p.y };
  };
  /** Côtés d'accrochage du mobilier : contour + maison/abri/mur/clôture. */
  const magnetSides = () => {
    const out = boundarySides(g).map((s) => ({ a: s.a, b: s.b }));
    for (const o of g.obstacles) if (['house', 'shed', 'wall', 'fence'].includes(o.kind)) for (const s of obstacleSides(o)) out.push({ a: s.a, b: s.b });
    return out;
  };
  /** Aimante l'élément (modifie x, y, rotation) contre le côté proche, en l'alignant sur lui. */
  function magnetItem(it) {
    const tol = cv.px(18);
    const sides = magnetSides();
    const r = itemRadius(it);
    const { hw, hd } = itemHalfSize(it);
    const ext = (nx, ny) => {
      if (r != null) return r;
      const a = rad(it.rotation || 0);
      return hw * Math.abs(nx * Math.cos(a) + ny * Math.sin(a)) + hd * Math.abs(-nx * Math.sin(a) + ny * Math.cos(a));
    };
    const frame = (s) => {
      const dx = s.b.x - s.a.x; const dy = s.b.y - s.a.y; const L = Math.hypot(dx, dy);
      if (L < 1e-6) return null;
      const ux = dx / L; const uy = dy / L; const nx = -uy; const ny = ux;
      const along = (it.x - s.a.x) * ux + (it.y - s.a.y) * uy;
      if (along < -0.3 || along > L + 0.3) return null;
      return { ux, uy, nx, ny, dist: (it.x - s.a.x) * nx + (it.y - s.a.y) * ny, ang: (Math.atan2(dy, dx) * 180) / Math.PI };
    };
    let pick = null;
    for (const s of sides) {
      const f0 = frame(s);
      if (!f0) continue;
      const gap = Math.abs(f0.dist) - Math.max(hw, hd);
      if (Math.abs(gap) <= tol * 1.5 && (!pick || Math.abs(gap) < pick.g)) pick = { s, g: Math.abs(gap), ang: f0.ang };
    }
    if (!pick) return;
    if (r == null) {
      const d = ((((it.rotation || 0) - pick.ang) % 90) + 135) % 90 - 45; // écart au multiple de 90° le plus proche
      if (Math.abs(d) <= 25) it.rotation = norm360(Math.round((it.rotation || 0) - d));
    }
    const f2 = frame(pick.s);
    if (!f2) return;
    const gap = Math.abs(f2.dist) - ext(f2.nx, f2.ny);
    if (Math.abs(gap) <= tol) {
      const sgn = f2.dist >= 0 ? 1 : -1;
      it.x -= f2.nx * sgn * gap;
      it.y -= f2.ny * sgn * gap;
    }
  }

  const hitItem = (w) => {
    for (let i = g.items.length - 1; i >= 0; i--) {
      const it = g.items[i];
      if (itemContains(it, w) || distance(it, w) <= cv.px(18)) return it;
    }
    return null;
  };
  const handlePos = (it) => {
    const { hd } = itemHalfSize(it);
    const a = rad(it.rotation || 0);
    const off = hd + cv.px(30);
    return { x: it.x + off * Math.sin(a), y: it.y - off * Math.cos(a) };
  };
  function hitBoundarySide(w) {
    let best = null;
    for (const s of boundarySides(g)) {
      const d = projectOnLine(w, s.a, s.b);
      const t = Math.min(1, Math.max(0, d.t));
      const q = { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t };
      const dist = distance(w, q);
      if (dist <= cv.px(22) && (!best || dist < best.dist)) best = { i: s.i, dist };
    }
    return best;
  }
  function hitFreeLine(w) {
    let best = null;
    for (const o of g.obstacles) {
      if (o.kind !== 'wall' && o.kind !== 'fence') continue;
      for (const s of obstacleSides(o)) {
        const d = projectOnLine(w, s.a, s.b);
        const t = Math.min(1, Math.max(0, d.t));
        const q = { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t };
        const dist = distance(w, q);
        if (dist <= cv.px(20) && (!best || dist < best.dist)) best = { o, dist };
      }
    }
    return best;
  }
  function hitOpening(w) {
    let best = null;
    for (const op of g.openings) {
      const og = openingGeometry(g, op);
      if (!og) continue;
      const d = projectOnLine(w, og.a, og.b);
      const t = Math.min(1, Math.max(0, d.t));
      const q = { x: og.a.x + (og.b.x - og.a.x) * t, y: og.a.y + (og.b.y - og.a.y) * t };
      const dist = distance(w, q);
      if (dist <= Math.max(cv.px(24), 0.15) && (!best || dist < best.dist)) best = { op, dist };
    }
    return best ? best.op : null;
  }
  const nearVertex = (p) => {
    const pts = [...g.boundary];
    g.obstacles.forEach((o) => { if (o.points) pts.push(...o.points); });
    let best = null; let bd = cv.px(14);
    for (const q of pts) { const d = distance(p, q); if (d <= bd) { bd = d; best = q; } }
    return best ? { x: best.x, y: best.y } : null;
  };

  // ---------- gestes ----------
  function onDown(w) {
    if (pop.isOpen()) pop.close();
    if (st.tab === 'furniture') {
      const cur = selItem();
      if (cur && itemRadius(cur) == null && distance(w, handlePos(cur)) <= cv.px(24)) return rotateDrag(cur);
      const hit = hitItem(w);
      if (hit) return itemDrag(hit, w);
      return null;
    }
    if (st.tab === 'access' && !st.draft) {
      const op = hitOpening(w);
      if (op) return openingDrag(op);
    }
    return null;
  }

  function itemDrag(it, w) {
    const before = snapshot();
    const off = { x: it.x - w.x, y: it.y - w.y };
    let moved = false;
    if (!(st.sel && st.sel.t === 'item' && st.sel.id === it.id)) { st.sel = { t: 'item', id: it.id }; st.kind = null; refreshUI(); draw(); }
    return {
      move(w2) {
        moved = true;
        const p = snapGrid({ x: w2.x + off.x, y: w2.y + off.y });
        it.x = p.x; it.y = p.y;
        magnetItem(it);
        draw();
      },
      up(_w, _e, mv) { if (mv && moved) { pushHistory(before); changed(); } else { draw(); refreshUI(); } },
      cancel() { restore(before); changed(); },
    };
  }

  function rotateDrag(it) {
    const before = snapshot();
    let moved = false;
    return {
      move(w2) {
        moved = true;
        let a = (Math.atan2(w2.y - it.y, w2.x - it.x) * 180) / Math.PI + 90;
        a = Math.round(norm360(a) / 5) * 5;
        const near = Math.round(a / 90) * 90;
        if (Math.abs(a - near) <= 6) a = near;
        it.rotation = norm360(a);
        draw();
      },
      up(_w, _e, mv) { if (mv && moved) { pushHistory(before); changed(); } else { draw(); } },
      cancel() { restore(before); changed(); },
    };
  }

  /** Cible d'un passage glissé : reste sur son côté tant que le doigt en est proche, sinon bascule sur le côté voisin. */
  function slideTarget(op, w) {
    const ends = sideEnds(op.ref);
    if (ends) {
      const pr = projectOnLine(w, ends[0], ends[1]);
      if (pr.d <= cv.px(45)) return { ref: op.ref, t: Math.min(1, Math.max(0, pr.t)) };
    }
    return snapOpeningToSides(g, w, { kind: op.kind, maxDist: cv.px(90) });
  }

  function openingDrag(op) {
    const before = snapshot();
    let moved = false;
    st.sel = { t: 'open', id: op.id };
    refreshUI(); draw();
    return {
      move(w2) {
        const s = slideTarget(op, w2);
        if (!s) return;
        moved = true;
        op.ref = s.ref;
        const [ea, eb] = sideEnds(s.ref);
        const L = distance(ea, eb);
        const half = Math.min(op.width, L) / 2 / L;
        const gridM = gridSize();
        let t = s.t;
        if (gridM) t = Math.round((t * L) / gridM) * gridM / L;
        if (Math.abs(t - 0.5) * L < cv.px(10)) t = 0.5;
        op.t = Math.min(1 - half, Math.max(half, t));
        draw();
      },
      up(_w, _e, mv) { if (mv && moved) { pushHistory(before); changed(); } else { draw(); refreshUI(); } },
      cancel() { restore(before); changed(); },
    };
  }
  function sideEnds(ref) {
    if (ref.type === 'boundary') { const sd = boundarySides(g).find((x) => x.i === ref.side); return sd ? [sd.a, sd.b] : null; }
    const ob = g.obstacles.find((o) => o.id === ref.obstacleId);
    const sd = ob && obstacleSides(ob).find((x) => x.i === ref.side);
    return sd ? [sd.a, sd.b] : null;
  }

  function onTap(w) {
    if (st.tab === 'furniture') {
      if (st.kind) { placeItem(w); return; }
      if (st.sel) { st.sel = null; draw(); refreshUI(); }
      say('Touchez un élément de la palette, puis le plan pour le poser.');
      return;
    }
    if (st.tab === 'edges') { tapEdges(w); return; }
    tapAccess(w);
  }

  function onHover(w) {
    if (st.tab === 'furniture' && st.kind) {
      const k = getItemKind(st.kind);
      const it = createItem(st.kind, 0, 0, 0);
      const p = snapGrid(w); it.x = p.x; it.y = p.y;
      magnetItem(it);
      st.ghost = it;
      void k;
      draw();
    }
  }

  function onLong(w) {
    if (st.tab === 'furniture') {
      const hit = hitItem(w);
      if (hit) { st.sel = { t: 'item', id: hit.id }; draw(); refreshUI(); openItemPop(hit); return; }
      if (st.kind) { const it = placeItem(w); if (it) openItemPop(it); }
      return;
    }
    if (st.tab === 'edges') {
      const sd = hitBoundarySide(w);
      if (sd) { st.sel = { t: 'edge', i: sd.i }; draw(); refreshUI(); openEdgePop(sd.i); return; }
      const fl = hitFreeLine(w);
      if (fl) { st.sel = { t: 'obst', id: fl.o.id }; draw(); refreshUI(); openFreePop(fl.o); }
      return;
    }
    const op = hitOpening(w);
    if (op) { st.sel = { t: 'open', id: op.id }; draw(); refreshUI(); openOpeningPop(op); }
  }

  // ---------- mobilier ----------
  function placeItem(w) {
    const k = getItemKind(st.kind);
    if (!k) return null;
    const p = snapGrid(w);
    const it = createItem(k.id, p.x, p.y, 0);
    magnetItem(it);
    mutate(() => { g.items.push(it); st.sel = { t: 'item', id: it.id }; st.kind = null; st.ghost = null; });
    say(`« ${k.label} » posé. Glissez pour le déplacer, la poignée ⟳ pour le tourner, appui long pour saisir sa taille en cm.`);
    return it;
  }

  function openItemPop(it) {
    const k = getItemKind(it.kind);
    const circle = itemRadius(it) != null;
    const fields = circle
      ? [{ key: 'w', label: 'Diamètre', value: cm(it.radius * 2), kind: 'length' }]
      : [{ key: 'w', label: 'Largeur', value: cm(it.width), kind: 'length' }, { key: 'd', label: 'Profondeur', value: cm(it.depth), kind: 'length' }];
    if (!circle) fields.push({ key: 'rot', label: 'Rotation', value: String(Math.round(it.rotation || 0)), kind: 'angle' });
    fields.push({ key: 'label', label: 'Nom', value: it.label || '', kind: 'text' });
    pop.open({
      title: `${k ? k.emoji + ' ' + k.label : 'Élément'} : taille en cm`,
      hint: '« 150 » = 1,50 m ; « 1,5 m » accepté.',
      fields,
      actions: [
        { label: '⧉ Dupliquer', act: 'pop-dup', fn: () => { pop.close(); duplicateItem(it); } },
        { label: '🗑 Supprimer', act: 'pop-del', danger: true, fn: () => { pop.close(); deleteSel(); } },
      ],
      onOk: (v) => mutate(() => {
        if (circle) { it.radius = v.w / 2; it.width = v.w; it.depth = v.w; } else { it.width = v.w; it.depth = v.d; it.rotation = v.rot; }
        if (v.label) it.label = v.label; else delete it.label;
      }),
    });
  }

  function duplicateItem(it) {
    const c = clone(it);
    c.id = newId('i_');
    c.x += 0.5; c.y += 0.5;
    mutate(() => { g.items.push(c); st.sel = { t: 'item', id: c.id }; });
  }
  function rotateSel(delta) {
    const it = selItem();
    if (!it || itemRadius(it) != null) return;
    mutate(() => { it.rotation = norm360((it.rotation || 0) + delta); });
  }
  function deleteSel() {
    if (st.sel && st.sel.t === 'item') mutate(() => { g.items = g.items.filter((i) => i.id !== st.sel.id); st.sel = null; });
    else if (st.sel && st.sel.t === 'open') mutate(() => { g.openings = g.openings.filter((o) => o.id !== st.sel.id); st.sel = null; });
    else if (st.sel && st.sel.t === 'obst') {
      mutate(() => {
        const id = st.sel.id;
        g.obstacles = g.obstacles.filter((o) => o.id !== id);
        g.openings = g.openings.filter((o) => !(o.ref && o.ref.type === 'obstacle' && o.ref.obstacleId === id));
        st.sel = null;
      });
    }
  }

  // ---------- murs, clôtures, haies ----------
  function setEdge(i, kind, height) {
    const n = boundarySides(g).length;
    while (g.boundaryEdges.length < Math.max(n, i + 1)) g.boundaryEdges.push({ kind: 'open', height: 0 });
    g.boundaryEdges[i] = kind === 'open' ? { kind: 'open', height: 0 } : { kind, height };
  }
  function chooseEdgeKind(kind) {
    const i = selEdge();
    if (i == null) { say('Touchez d’abord un côté du terrain.', 'warn'); return; }
    const k = getEdgeKind(kind);
    const prevKind = edgeKindOf(g, i);
    const h0 = prevKind === kind ? edgeHeightOf(g, i) : k.height;
    mutate(() => setEdge(i, kind, h0));
    say(kind === 'open' ? `Côté ${i + 1} : ouvert.` : `Côté ${i + 1} : ${k.label.toLowerCase()} de ${cm(h0)} cm.`);
  }
  function setEdgeHeight(i, m) {
    const kind = edgeKindOf(g, i);
    if (kind === 'open') return;
    mutate(() => setEdge(i, kind, Math.max(0.1, m)));
  }
  function applyAll() {
    const i = selEdge();
    if (i == null) return;
    const kind = edgeKindOf(g, i); const ht = edgeHeightOf(g, i);
    mutate(() => { for (const s of boundarySides(g)) setEdge(s.i, kind, ht); });
    say(kind === 'open' ? 'Tous les côtés sont ouverts.' : `Tous les côtés : ${getEdgeKind(kind).label.toLowerCase()} de ${cm(ht)} cm.`);
  }
  function tapEdges(w) {
    if (st.draft) { addDraftPoint(w); return; }
    const sd = hitBoundarySide(w);
    if (sd) { st.sel = { t: 'edge', i: sd.i }; draw(); refreshUI(); say(`Côté ${sd.i + 1} sélectionné : choisissez Ouvert, Mur, Clôture ou Haie.`); return; }
    const fl = hitFreeLine(w);
    if (fl) { st.sel = { t: 'obst', id: fl.o.id }; draw(); refreshUI(); return; }
    if (st.sel) { st.sel = null; draw(); refreshUI(); }
    say(hasContour() ? 'Touchez un côté du terrain pour en faire un mur, une clôture ou une haie.' : 'Pas de contour tracé : vous pouvez dessiner un mur ou une clôture libre.');
  }
  function openEdgePop(i) {
    const tmp = { kind: edgeKindOf(g, i) === 'open' ? 'wall' : edgeKindOf(g, i) };
    const seg = h('div', { class: 'jdi-seg' }, EDGE_KINDS.filter((k) => k.id !== 'open').map((k) => h('button', {
      type: 'button', class: 'jd-btn', 'data-edge-pop': k.id, 'aria-pressed': String(tmp.kind === k.id),
      onclick: (e) => { tmp.kind = k.id; seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); },
    }, k.label)));
    pop.open({
      title: `Côté ${i + 1} : type et hauteur`, hint: 'Hauteur en cm (« 200 » = 2 m).',
      fields: [{ key: 'h', label: 'Hauteur', value: cm(edgeKindOf(g, i) === 'open' ? getEdgeKind(tmp.kind).height : edgeHeightOf(g, i)), kind: 'length' }],
      extra: seg,
      actions: [{ label: 'Ouvert', act: 'pop-open', fn: () => { pop.close(); mutate(() => setEdge(i, 'open', 0)); } }],
      onOk: (v) => mutate(() => setEdge(i, tmp.kind, v.h)),
    });
  }
  function openFreePop(o) {
    pop.open({
      title: `${FREE_KINDS[o.kind].label} libre : hauteur`, fields: [{ key: 'h', label: 'Hauteur', value: cm(o.height || FREE_KINDS[o.kind].height), kind: 'length' }],
      actions: [{ label: '🗑 Supprimer', act: 'pop-del', danger: true, fn: () => { pop.close(); deleteSel(); } }],
      onOk: (v) => mutate(() => { o.height = v.h; }),
    });
  }
  function startDraft(kind) {
    st.draft = { kind, points: [] }; st.sel = null; refreshUI(); draw();
    say(`${FREE_KINDS[kind].label} libre : touchez les points successifs, puis « Terminer ».`);
  }
  function addDraftPoint(w) {
    const v = nearVertex(w);
    const p = v || snapGrid(w);
    const last = st.draft.points[st.draft.points.length - 1];
    if (last && distance(last, p) < 0.02) return;
    st.draft.points.push(p); draw(); refreshUI();
  }
  function finishDraft() {
    const d = st.draft;
    if (!d || d.points.length < 2) { say('Posez au moins deux points.', 'warn'); return; }
    const o = { id: newId('o_'), kind: d.kind, points: d.points, height: FREE_KINDS[d.kind].height };
    mutate(() => { g.obstacles.push(o); st.draft = null; st.sel = { t: 'obst', id: o.id }; });
    say(`${FREE_KINDS[d.kind].label} ajouté. Appui long pour changer sa hauteur.`);
  }
  function cancelDraft() { st.draft = null; refreshUI(); draw(); }

  // ---------- portes & accès ----------
  const hasHouse = () => g.obstacles.some((o) => o.kind === 'house' || o.kind === 'shed');
  function chooseOpening(id) {
    st.openKind = id; st.sel = null; refreshUI(); draw();
    if (!snapOpeningToSides(g, { x: 0, y: 0 }, { kind: id })) {
      say(id === 'garage' || id === 'door'
        ? 'Aucune maison ni abri : dessinez-en un à l’étape Terrain (obstacles) pour y poser cette porte.'
        : 'Aucun côté disponible : tracez d’abord le terrain (étape Terrain).', 'warn');
    } else say(`${getOpeningKind(id).label} : touchez un côté ${id === 'garage' || id === 'door' ? 'de la maison ou d’un abri' : 'du terrain, d’un mur ou d’une clôture'} pour le poser.`);
  }
  function tapAccess(w) {
    const hit = hitOpening(w);
    if (hit) { st.sel = { t: 'open', id: hit.id }; draw(); refreshUI(); return; }
    const k = getOpeningKind(st.openKind);
    const s = snapOpeningToSides(g, w, { kind: st.openKind, maxDist: cv.px(70) });
    if (!s) {
      say(st.openKind === 'garage' || st.openKind === 'door'
        ? `Une ${k.label.toLowerCase()} se pose sur un côté de maison ou d’abri : touchez plus près d’un bâtiment.`
        : 'Touchez plus près d’un côté du terrain, d’un mur ou d’une clôture.', 'warn');
      return;
    }
    const [a, b] = sideEnds(s.ref);
    const L = distance(a, b);
    let t = s.t;
    if (Math.abs(t - 0.5) * L < cv.px(10)) t = 0.5;
    const op = createOpening(st.openKind, s.ref, t);
    const og = openingGeometry(g, { ...op, t });
    op.t = og ? og.t : t;
    mutate(() => { g.openings.push(op); st.sel = { t: 'open', id: op.id }; });
    say(`${k.label} posé. Glissez-le le long du côté, appui long pour sa largeur en cm.`);
  }
  function openOpeningPop(op) {
    const k = getOpeningKind(op.kind);
    pop.open({
      title: `${k.label} : largeur en cm`, hint: '« 300 » = 3 m.',
      fields: [{ key: 'w', label: 'Largeur', value: cm(op.width), kind: 'length' }],
      actions: [{ label: '🗑 Supprimer', act: 'pop-del', danger: true, fn: () => { pop.close(); deleteSel(); } }],
      onOk: (v) => mutate(() => { op.width = v.w; const og = openingGeometry(g, op); if (og) op.t = og.t; }),
    });
  }
  function setSwing(sw) {
    const op = selOpening();
    if (op) mutate(() => { op.swing = sw; });
  }

  // ---------- dessin ----------
  const poly = (pts) => pts.map((p) => `${p.x},${p.y}`).join(' ');
  function obstacleSvg(o, selected) {
    const col = selected ? '#d81b60' : null;
    if (o.kind === 'tree' && o.center) return `<circle cx="${o.center.x}" cy="${o.center.y}" r="${o.radius || 1}" fill="#558b2f" fill-opacity=".2" stroke="#33691e" stroke-dasharray="6 4" stroke-width="1.5" ${NS}/>`;
    if (!o.points) return '';
    if (o.kind === 'wall') return `<polyline points="${poly(o.points)}" fill="none" stroke="${col || '#424242'}" stroke-width="${Math.max(0.2, cv.px(4))}" stroke-linecap="square"/>`;
    if (o.kind === 'fence') return `<polyline points="${poly(o.points)}" fill="none" stroke="${col || '#6d4c41'}" stroke-width="${cv.px(3)}" stroke-dasharray="${cv.px(8)} ${cv.px(4)}"/>`;
    const c = centroid(o.points);
    return `<polygon points="${poly(o.points)}" fill="#bdbdbd" fill-opacity=".5" stroke="#424242" stroke-width="2" ${NS}/><text x="${c.x}" y="${c.y}" font-size="${cv.px(11)}" text-anchor="middle" fill="#37474f">${o.kind === 'house' ? 'Maison' : 'Abri'}</text>`;
  }

  function draw() {
    if (destroyed || !cv) return;
    const r = cv.svg.getBoundingClientRect();
    const rect = { width: r.width || 390, height: r.height || 520 };
    const gp = gridPath(cv.view, rect);
    gGrid.innerHTML = `<path d="${gp.minor}" stroke="var(--jd-grid,#e3e3da)" stroke-width="1" fill="none" ${NS}/><path d="${gp.major}" stroke="var(--jd-line,#cfcfc4)" stroke-width="1" fill="none" ${NS}/>`;
    const u = cv.px(1);
    const b = g.boundary;
    let s = '';
    if (b.length >= 2) {
      s += closed()
        ? `<polygon points="${poly(b)}" fill="var(--jd-accent,#2e7d32)" fill-opacity=".1" stroke="var(--jd-fg,#222)" stroke-width="1.5" stroke-linejoin="round" ${NS}/>`
        : `<polyline points="${poly(b)}" fill="none" stroke="var(--jd-fg,#222)" stroke-width="1.5" ${NS}/>`;
    }
    for (const o of g.obstacles) s += obstacleSvg(o, st.sel && st.sel.t === 'obst' && st.sel.id === o.id);
    s += renderItemsSVG(g, {
      scale: 1, px: u, bg: 'var(--jd-canvas,#fbfaf4)',
      selected: { itemId: st.sel && st.sel.t === 'item' ? st.sel.id : null, openingId: st.sel && st.sel.t === 'open' ? st.sel.id : null, edge: selEdge() },
    });
    gMain.innerHTML = s;

    let top = '';
    if (st.tab === 'edges') {
      for (const sd of boundarySides(g)) {
        const mx = (sd.a.x + sd.b.x) / 2; const my = (sd.a.y + sd.b.y) / 2;
        const sel = selEdge() === sd.i;
        if (sel) top += `<line x1="${sd.a.x}" y1="${sd.a.y}" x2="${sd.b.x}" y2="${sd.b.y}" stroke="#d81b60" stroke-width="5" stroke-linecap="round" stroke-opacity=".75" ${NS}/>`;
        top += `<circle cx="${mx}" cy="${my}" r="${u * 11}" fill="var(--jd-card,#fff)" stroke="${sel ? '#d81b60' : '#0d47a1'}" stroke-width="1.5" ${NS}/><text x="${mx}" y="${my + u * 4}" font-size="${u * 11}" text-anchor="middle" fill="var(--jd-fg,#222)">${sd.i + 1}</text>`;
      }
    }
    const it = selItem();
    if (it && st.tab === 'furniture') {
      const poly0 = itemPolygon(it);
      top += `<polygon points="${poly(poly0)}" fill="none" stroke="#d81b60" stroke-width="2" stroke-dasharray="6 3" ${NS}/>`;
      if (itemRadius(it) == null) {
        const hp = handlePos(it);
        const { hd } = itemHalfSize(it); const a = rad(it.rotation || 0);
        const ex = it.x + hd * Math.sin(a); const ey = it.y - hd * Math.cos(a);
        top += `<line x1="${ex}" y1="${ey}" x2="${hp.x}" y2="${hp.y}" stroke="#d81b60" stroke-width="1.5" ${NS}/><circle cx="${hp.x}" cy="${hp.y}" r="${u * 13}" fill="#d81b60"/><text x="${hp.x}" y="${hp.y + u * 5}" font-size="${u * 15}" text-anchor="middle" fill="#fff">⟳</text>`;
      }
      if (contourOk() && !polygonInside(poly0, b)) top += `<text x="${it.x}" y="${it.y - u * 18}" font-size="${u * 12}" text-anchor="middle" fill="#b26a00">hors du terrain</text>`;
    }
    if (st.ghost && st.tab === 'furniture' && st.kind) {
      const gp0 = itemPolygon(st.ghost);
      top += `<polygon points="${poly(gp0)}" fill="#2e7d32" fill-opacity=".18" stroke="#2e7d32" stroke-dasharray="4 3" stroke-width="1.5" ${NS}/>`;
    }
    if (st.draft) {
      const pts = st.draft.points;
      if (pts.length) top += `<polyline points="${poly(pts)}" fill="none" stroke="#d81b60" stroke-width="3" ${NS}/>`;
      for (const p of pts) top += `<circle cx="${p.x}" cy="${p.y}" r="${u * 6}" fill="#d81b60"/>`;
    }
    gTop.innerHTML = top;
  }
  const contourOk = () => closed() && g.boundary.length >= 3;

  // ---------- interface ----------
  function setTab(id) {
    if (st.tab === id) return;
    st.tab = id; st.sel = null; st.kind = null; st.draft = null; st.ghost = null;
    pop.close(); st.msg = ''; draw(); refreshUI();
  }

  function paintMsg() { msgEl.textContent = st.msg; msgEl.className = `jd-msg ${st.msgKind}`; }

  function hintText() {
    if (st.tab === 'furniture') {
      if (st.kind) return `Touchez le plan pour poser « ${getItemKind(st.kind).label} » (aimanté aux côtés, grille ${gridSize() ? fr(gridSize(), 1) + ' m' : 'off'}).`;
      if (selItem()) return 'Glissez l’élément pour le déplacer, tirez la poignée ⟳ pour le tourner, appui long pour saisir sa taille en cm.';
      return 'Touchez un élément de la palette, puis touchez le plan pour le poser.';
    }
    if (st.tab === 'edges') {
      if (st.draft) return `${FREE_KINDS[st.draft.kind].label} libre : touchez les points successifs (${st.draft.points.length} posé${st.draft.points.length > 1 ? 's' : ''}), puis « Terminer ».`;
      if (selEdge() != null) return 'Choisissez Ouvert, Mur, Clôture ou Haie, ajustez la hauteur en cm, ou appliquez à tous les côtés.';
      return hasContour() ? 'Touchez un côté du terrain (numéroté) pour en faire un mur, une clôture ou une haie.' : 'Pas de contour tracé : vous pouvez dessiner un mur ou une clôture libre.';
    }
    if (selOpening()) return 'Glissez le passage le long du côté, appui long pour sa largeur en cm, ou changez son sens d’ouverture.';
    return `Choisissez un type de passage puis touchez un côté ${st.openKind === 'garage' || st.openKind === 'door' ? 'de maison ou d’abri' : 'du terrain, d’un mur ou d’une clôture'}.`;
  }

  function startText() {
    const d = st.dismissed;
    if (st.tab === 'furniture' && !g.items.length && !st.kind && !d.furniture) return ['Aménagez votre jardin', 'Choisissez un banc, une table… dans la palette, puis touchez le plan pour le poser.'];
    if (st.tab === 'edges' && !hasContour() && !g.obstacles.length && !st.draft && !d.edges) return ['Pas encore de terrain', 'Tracez le contour à l’étape Terrain pour poser murs et clôtures sur ses côtés, ou dessinez un mur libre.'];
    if (st.tab === 'access' && !snapOpeningToSides(g, { x: 0, y: 0 }, { kind: st.openKind }) && !d.access) return ['Aucun côté disponible', 'Tracez le terrain (et la maison) à l’étape Terrain pour poser portails et portes.'];
    return null;
  }

  function renderPanel() {
    panel.replaceChildren();
    chips.replaceChildren();
    if (st.tab === 'furniture') {
      chips.append(btn('Tout', 'cat-all', () => { st.cat = 'all'; refreshUI(); }, 'jdi-chip', { 'aria-pressed': String(st.cat === 'all') }));
      for (const c of ITEM_CATEGORIES) chips.append(btn(c.label, `cat-${c.id}`, () => { st.cat = c.id; refreshUI(); }, 'jdi-chip', { 'aria-pressed': String(st.cat === c.id) }));
      const pal = h('div', { class: 'jdi-palette', 'data-role': 'palette' });
      for (const k of ITEM_KINDS.filter((x) => st.cat === 'all' || x.category === st.cat)) {
        pal.append(h('button', {
          type: 'button', class: 'jdi-card', 'data-kind': k.id, 'aria-pressed': String(st.kind === k.id),
          'aria-label': `${k.label}, ${k.shape === 'circle' ? 'diamètre ' + cm(k.w) : cm(k.w) + ' par ' + cm(k.d)} centimètres, environ ${k.priceEur} euros`,
          onclick: () => {
            st.kind = st.kind === k.id ? null : k.id; st.sel = null; st.ghost = null; st.dismissed.furniture = true;
            say(''); draw(); refreshUI();
          },
        }, h('span', { class: 'jdi-pastille', style: { background: k.color } }, k.emoji),
        h('span', { class: 'jdi-card-name' }, k.label),
        h('span', { class: 'jdi-card-meta' }, `${k.shape === 'circle' ? 'Ø ' + cm(k.w) : cm(k.w) + '×' + cm(k.d)} cm`),
        h('span', { class: 'jdi-card-meta' }, `≈ ${euro(k.priceEur)}`)));
      }
      panel.append(pal);
    } else if (st.tab === 'edges') {
      const row = h('div', { class: 'jdi-palette', 'data-role': 'edge-tools' });
      if (st.draft) {
        row.append(
          btn('✔ Terminer', 'draft-finish', finishDraft, 'primary', { disabled: st.draft.points.length < 2 }),
          btn('↩ Retirer le dernier point', 'draft-undo', () => { st.draft.points.pop(); draw(); refreshUI(); }, '', { disabled: !st.draft.points.length }),
          btn('✕ Annuler', 'draft-cancel', cancelDraft));
      } else {
        row.append(
          btn('＋ Mur libre', 'draft-wall', () => startDraft('wall')),
          btn('＋ Clôture libre', 'draft-fence', () => startDraft('fence')));
      }
      panel.append(row);
    } else {
      const pal = h('div', { class: 'jdi-palette', 'data-role': 'opening-kinds' });
      for (const k of OPENING_KINDS) {
        pal.append(h('button', {
          type: 'button', class: 'jdi-card', 'data-opening-kind': k.id, 'aria-pressed': String(st.openKind === k.id),
          onclick: () => { st.dismissed.access = true; chooseOpening(k.id); },
        }, h('span', { class: 'jdi-pastille', style: { background: k.color, color: '#fff' } }, k.emoji),
        h('span', { class: 'jdi-card-name' }, k.label), h('span', { class: 'jdi-card-meta' }, `${cm(k.width)} cm`)));
      }
      panel.append(pal);
    }
  }

  function renderDetail() {
    detail.replaceChildren();
    detail.hidden = true;
    const show = (...kids) => { detail.append(...kids.filter(Boolean)); detail.hidden = false; };
    if (st.tab === 'furniture') {
      const it = selItem();
      if (!it) return;
      const k = getItemKind(it.kind);
      const out = contourOk() && !polygonInside(itemPolygon(it), g.boundary);
      show(
        h('div', { class: 'jdi-detail-title', 'data-role': 'sel-banner' },
          `${k.emoji} ${it.label || k.label}`,
          h('small', null, `${itemDims(it)}${itemRadius(it) == null ? ` · ${Math.round(it.rotation || 0)}°` : ''} · ≈ ${euro(k.priceEur)}`),
          out ? h('span', { class: 'jdi-warn' }, '⚠ sort du terrain') : null),
        itemRadius(it) == null ? btn('↺', 'rot-ccw', () => rotateSel(-90), '', { 'aria-label': 'Tourner de 90° à gauche' }) : null,
        itemRadius(it) == null ? btn('↻', 'rot-cw', () => rotateSel(90), '', { 'aria-label': 'Tourner de 90° à droite' }) : null,
        btn('✎ Taille', 'edit', () => openItemPop(it)),
        btn('⧉', 'dup', () => duplicateItem(it), '', { 'aria-label': 'Dupliquer' }),
        btn('🗑', 'del', deleteSel, 'danger', { 'aria-label': 'Supprimer' }));
    } else if (st.tab === 'edges') {
      const i = selEdge();
      const o = selObstacle();
      if (i != null) {
        const kind = edgeKindOf(g, i);
        const side = boundarySides(g)[i];
        const L = side ? distance(side.a, side.b) : 0;
        const hIn = h('input', { class: 'jd-input', type: 'text', inputmode: 'numeric', 'aria-label': 'Hauteur en centimètres', 'data-field': 'edge-height', value: kind === 'open' ? '' : cm(edgeHeightOf(g, i)), disabled: kind === 'open' });
        const commit = () => { const v = parseLength(hIn.value); if (Number.isFinite(v)) setEdgeHeight(i, v); else refreshUI(); };
        hIn.addEventListener('change', commit);
        hIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); hIn.blur(); } });
        show(
          h('div', { class: 'jdi-detail-title', 'data-role': 'sel-banner' }, `Côté ${i + 1} · ${fr(L)} m`, h('small', null, kind === 'open' ? 'Ouvert' : `${getEdgeKind(kind).label} · hauteur en cm`)),
          h('div', { class: 'jdi-seg' }, EDGE_KINDS.map((k) => btn(k.label, `edge-${k.id}`, () => chooseEdgeKind(k.id), '', { 'data-edge-kind': k.id, 'aria-pressed': String(kind === k.id) }))),
          kind === 'open' ? null : h('span', { class: 'jdi-seg' }, hIn, h('span', { class: 'jd-unit' }, 'cm')),
          btn('Appliquer à tous les côtés', 'apply-all', applyAll));
      } else if (o) {
        const hIn = h('input', { class: 'jd-input', type: 'text', inputmode: 'numeric', 'aria-label': 'Hauteur en centimètres', 'data-field': 'free-height', value: cm(o.height || FREE_KINDS[o.kind].height) });
        hIn.addEventListener('change', () => { const v = parseLength(hIn.value); if (Number.isFinite(v)) mutate(() => { o.height = v; }); else refreshUI(); });
        show(h('div', { class: 'jdi-detail-title', 'data-role': 'sel-banner' }, `${FREE_KINDS[o.kind].label} libre`, h('small', null, 'hauteur en cm')),
          hIn, btn('🗑', 'del', deleteSel, 'danger', { 'aria-label': 'Supprimer' }));
      }
    } else {
      const op = selOpening();
      if (!op) return;
      const k = getOpeningKind(op.kind);
      show(
        h('div', { class: 'jdi-detail-title', 'data-role': 'sel-banner' }, `${k.emoji} ${k.label}`, h('small', null, `${cm(op.width)} cm`)),
        ...OPENING_SWINGS.filter((sw) => op.kind !== 'garage' || sw.id === 'sliding').map((sw) => btn(sw.id === 'in' ? '⤶ Dedans' : sw.id === 'out' ? '⤷ Dehors' : '⇄ Coulissant', `swing-${sw.id}`, () => setSwing(sw.id), '', { 'aria-pressed': String((op.swing || k.swing) === sw.id), title: sw.label })),
        btn('✎ Largeur', 'edit', () => openOpeningPop(op)),
        btn('🗑', 'del', deleteSel, 'danger', { 'aria-label': 'Supprimer' }));
    }
  }

  function refreshUI() {
    if (destroyed) return;
    tabBtns.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === st.tab)));
    bUndo.disabled = !st.history.length;
    bRedo.disabled = !st.future.length;
    bGrid.textContent = gridSize() ? `▦ ${fr(gridSize(), 1)} m` : '▦ off';
    chips.hidden = st.tab !== 'furniture';
    renderPanel();
    renderDetail();
    const n = g.items.length;
    const price = itemsTotalPrice(g);
    info.innerHTML = `<span><b data-role="count">${n}</b> élément${n > 1 ? 's' : ''}${n ? ` · ≈ <b data-role="total">${esc(euro(price))}</b>` : ''}</span>`
      + `<span><b data-role="edge-count">${g.boundaryEdges.filter((e) => e && e.kind !== 'open').length}</b> côté(s) bâti(s)</span>`
      + `<span><b data-role="opening-count">${g.openings.length}</b> passage${g.openings.length > 1 ? 's' : ''}</span>`;
    if (!st.msg) { msgEl.textContent = hintText(); msgEl.className = 'jd-msg'; } else paintMsg();
    const sp = startText();
    startEl.hidden = !sp;
    if (sp) startEl.replaceChildren(h('b', null, sp[0]), sp[1]);
  }

  // ---------- démarrage ----------
  fitView();
  refreshUI();
  draw();
  setTimeout(() => { if (!destroyed) { fitView(); draw(); } }, 0);

  return function unmount() {
    destroyed = true;
    try { pop.close(); } catch { /* déjà fermé */ }
    try { cv.destroy(); } catch { /* ok */ }
    root.remove();
  };
}
