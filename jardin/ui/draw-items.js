// Éditeur d'aménagements : mobilier et équipements, murs / clôtures / haies, portes et accès.
import { distance, bounds, polygonInside, centroid, shapePolygon, pointInPolygon } from '../geometry.js';
import { createItem, createOpening, ensureAmenagements, newId, getZoneType } from '../model.js';
import {
  ITEM_KINDS, ITEM_CATEGORIES, OPENING_KINDS, OPENING_SWINGS, EDGE_KINDS, getItemKind, getOpeningKind, getEdgeKind,
  itemPolygon, itemContains, itemRadius, itemHalfSize, boundarySides, obstacleSides, edgeKindOf, edgeHeightOf,
  openingGeometry, snapOpeningToSides, itemsTotalPrice, EDGE_MATERIALS, MATERIALS, materialOf,
} from '../items.js';
import { renderItemsSVG, fenceMarkup } from '../render-items.js';
import {
  createExisting, existingFootprint, existingSummary, getExistingKind, getFenceMaterial, setFenceMaterial, sizeForPlant, existingLabel, existingPlant,
} from '../existing.js';
import { renderExistingPalette, renderExistingDetail, materialChoice } from './existing-panel.js';
import {
  injectStyles, h, createCanvas, gridPath, clone, esc, fr, projectOnLine, parseLength, toCm,
} from './draw-util.js';
import { createPop } from './pop.js';
import { heightField } from './height-field.js';
import { itemHeight, defaultItemHeight, checkHeight, heightMessage, formatHeight } from '../heights.js';
import { attachNorthBadge } from './north-pop.js';

const NS = 'vector-effect="non-scaling-stroke"';
const GRIDS = [0.1, 0.5, 0];
const TABS = [
  { id: 'furniture', label: '🪑 Mobilier' },
  { id: 'edges', label: '🧱 Murs & clôtures' },
  { id: 'access', label: '🚪 Portes & accès' },
  { id: 'existing', label: '🌳 Existant' },
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
    exKind: null, exDraft: null, exQuery: '', exAge: 'adult', fenceMaterial: 'wood', exGhost: null,
  };
  let destroyed = false;
  let north = null; // pastille du nord

  const snapshot = () => clone({ items: g.items, boundaryEdges: g.boundaryEdges, openings: g.openings, obstacles: g.obstacles, existing: g.existing });
  const restore = (s) => {
    g.items = clone(s.items); g.boundaryEdges = clone(s.boundaryEdges); g.openings = clone(s.openings); g.obstacles = clone(s.obstacles); g.existing = clone(s.existing || []);
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
  const selEx = () => (st.sel && st.sel.t === 'ex' ? g.existing.find((e) => e.id === st.sel.id) : null);
  const selEdge = () => (st.sel && st.sel.t === 'edge' ? st.sel.i : null);
  function selExists() {
    if (!st.sel) return true;
    if (st.sel.t === 'item') return !!selItem();
    if (st.sel.t === 'open') return !!selOpening();
    if (st.sel.t === 'obst') return !!selObstacle();
    if (st.sel.t === 'ex') return !!selEx();
    if (st.sel.t === 'edge') return st.sel.i < boundarySides(g).length;
    return true;
  }

  // ---------- DOM ----------
  const root = h('div', { class: 'jd jd-editor jdi', 'data-role': 'items-editor' });
  const tabs = h('div', { class: 'jdi-tabs', role: 'tablist', 'aria-label': 'Aménagements' });
  const bar = h('div', { class: 'jd-bar jd-scroll' });
  const panel = h('div', { class: 'jdi-panel' });
  const wrap = h('div', { class: 'jd-canvas-wrap' });
  const detail = h('div', { class: 'jdi-detail', 'data-role': 'detail' });
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
  north = attachNorthBadge(wrap, { garden: g, onChange: () => { if (onChange) onChange(g); } });
  cv.svg.setAttribute('aria-label', 'Plan du terrain : aménagements');
  const pop = createPop(wrap, { onClose: () => draw(), onWarn: (m) => say(m, 'warn') });

  function fitView() {
    const pts = [...g.boundary];
    g.obstacles.forEach((o) => { if (o.points) pts.push(...o.points); else if (o.center) pts.push(o.center); });
    g.items.forEach((i) => pts.push(...itemPolygon(i)));
    g.existing.forEach((e) => pts.push(...existingFootprint(e)));
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
    if (st.tab === 'existing' && !st.exDraft) {
      const hit = hitExisting(w);
      if (hit) return existingDrag(hit, w);
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
    if (ref.type === 'existing') { const ex = g.existing.find((e) => e.id === ref.existingId); const sx = ex && obstacleSides(ex).find((x) => x.i === ref.side); return sx ? [sx.a, sx.b] : null; }
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
    if (st.tab === 'existing') { tapExisting(w); return; }
    tapAccess(w);
  }

  function onHover(w) {
    if (st.tab === 'existing' && st.exKind && !st.exDraft && !getExistingKind(st.exKind).linear) {
      const p = snapGrid(w);
      st.exGhost = createExisting(st.exKind, p);
      draw();
      return;
    }
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
    if (st.tab === 'existing') {
      const hit = hitExisting(w);
      if (hit) { st.sel = { t: 'ex', id: hit.id }; st.exKind = null; draw(); refreshUI(); openExistingPop(hit); return; }
      if (st.exKind && !st.exDraft && !getExistingKind(st.exKind).linear) { const e = placeExisting(w); if (e) openExistingPop(e); }
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
    fields.push({ key: 'ht', label: 'Hauteur', value: cm(itemHeight(it)), kind: 'length' });
    fields.push({ key: 'label', label: 'Nom', value: it.label || '', kind: 'text' });
    pop.open({
      title: `${k ? k.emoji + ' ' + k.label : 'Élément'} : taille en cm`,
      hint: `« 150 » = 1,50 m ; « 1,5 m » accepté. Hauteur par défaut : ${formatHeight(defaultItemHeight(it.kind))}.`,
      fields,
      actions: [
        { label: '↺ Hauteur par défaut', act: 'pop-height-default', fn: () => { pop.close(); mutate(() => { delete it.height; }); say(`Hauteur par défaut : ${formatHeight(defaultItemHeight(it.kind))}.`); } },
        { label: '⧉ Dupliquer', act: 'pop-dup', fn: () => { pop.close(); duplicateItem(it); } },
        { label: '🗑 Supprimer', act: 'pop-del', danger: true, fn: () => { pop.close(); deleteSel(); } },
      ],
      onOk: (v) => mutate(() => {
        if (circle) { it.radius = v.w / 2; it.width = v.w; it.depth = v.w; } else { it.width = v.w; it.depth = v.d; it.rotation = v.rot; }
        setItemHeight(it, v.ht);
        if (v.label) it.label = v.label; else delete it.label;
      }),
    });
  }

  /** Enregistre la hauteur d'un aménagement (bornée) ; la valeur par défaut supprime le réglage. */
  function setItemHeight(it, m) {
    const chk = checkHeight(it.kind, m);
    if (!chk.ok) return;
    if (Math.abs(chk.value - defaultItemHeight(it.kind)) < 0.005) delete it.height; else it.height = chk.value;
    if (chk.clamped) say(chk.message, 'warn');
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
    else if (st.sel && st.sel.t === 'ex') {
      mutate(() => {
        const id = st.sel.id;
        g.existing = g.existing.filter((e) => e.id !== id);
        g.openings = g.openings.filter((o) => !(o.ref && o.ref.type === 'existing' && o.ref.existingId === id));
        st.sel = null;
      });
    } else if (st.sel && st.sel.t === 'open') mutate(() => { g.openings = g.openings.filter((o) => o.id !== st.sel.id); st.sel = null; });
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
  /** `material` : undefined = conserve celui du côté si le type ne change pas, null = aucun (matériau par défaut). */
  function setEdge(i, kind, height, material) {
    const n = boundarySides(g).length;
    while (g.boundaryEdges.length < Math.max(n, i + 1)) g.boundaryEdges.push({ kind: 'open', height: 0 });
    const prev = g.boundaryEdges[i];
    const mat = material !== undefined ? material : (prev && prev.kind === kind ? prev.material : null);
    const ok = mat && (EDGE_MATERIALS[kind] || []).includes(mat);
    g.boundaryEdges[i] = kind === 'open' ? { kind: 'open', height: 0 } : (ok ? { kind, height, material: mat } : { kind, height });
  }
  const edgeMaterial = (i) => materialOf(edgeKindOf(g, i), g.boundaryEdges[i] && g.boundaryEdges[i].material);
  function setEdgeMaterial(i, mat) { const kind = edgeKindOf(g, i); if (kind === 'open') return; mutate(() => setEdge(i, kind, edgeHeightOf(g, i), mat)); say(`Côté ${i + 1} : ${MATERIALS[mat].label.toLowerCase()}.`); }
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
    const chk = checkHeight(kind, m);
    if (!chk.ok) { say(heightMessage(kind), 'warn'); refreshUI(); return; }
    mutate(() => setEdge(i, kind, chk.value));
    if (chk.clamped) say(chk.message, 'warn');
  }
  function applyAll() {
    const i = selEdge();
    if (i == null) return;
    const kind = edgeKindOf(g, i); const ht = edgeHeightOf(g, i);
    const mat = (g.boundaryEdges[i] && g.boundaryEdges[i].material) || null;
    mutate(() => { for (const s of boundarySides(g)) setEdge(s.i, kind, ht, mat); });
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
      onOk: (v) => { const chk = checkHeight(tmp.kind, v.h); mutate(() => setEdge(i, tmp.kind, chk.value)); if (chk.clamped) say(chk.message, 'warn'); },
    });
  }
  function openFreePop(o) {
    pop.open({
      title: `${FREE_KINDS[o.kind].label} libre : hauteur`, fields: [{ key: 'h', label: 'Hauteur', value: cm(o.height || FREE_KINDS[o.kind].height), kind: 'length' }],
      actions: [{ label: '🗑 Supprimer', act: 'pop-del', danger: true, fn: () => { pop.close(); deleteSel(); } }],
      onOk: (v) => { const chk = checkHeight(o.kind, v.h); mutate(() => { o.height = chk.value; }); if (chk.clamped) say(chk.message, 'warn'); },
    });
  }
  function startDraft(kind) {
    st.draft = { kind, points: [] }; st.sel = null; refreshUI(); draw();
    say(`${FREE_KINDS[kind].label} libre : touchez les points successifs, puis « Terminer » (ou touchez le 1er point pour fermer la boucle).`);
  }
  function addDraftPoint(w) {
    // toucher le 1er point (≥ 3 points) = fermer la boucle (mur ou clôture qui fait le tour)
    const pts0 = st.draft.points;
    if (pts0.length >= 3 && distance(w, pts0[0]) <= cv.px(24)) { pts0.push({ x: pts0[0].x, y: pts0[0].y }); finishDraft(); say('Boucle fermée.'); return; }
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
    say(`${k.label} ajouté. Glissez-le le long du côté, appui long pour sa largeur en cm.`);
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

  // ---------- plantes existantes ----------
  const exKindDef = (e) => getExistingKind(e.kind) || getExistingKind('other');
  function hitExisting(w) {
    for (let i = g.existing.length - 1; i >= 0; i--) {
      const e = g.existing[i];
      const tol = Math.max(exKindDef(e).linear ? e.width / 2 : e.width / 2, cv.px(18));
      if (Array.isArray(e.points) && e.points.length >= 2) {
        for (let k = 0; k < e.points.length - 1; k++) {
          const d = projectOnLine(w, e.points[k], e.points[k + 1]);
          const t = Math.min(1, Math.max(0, d.t));
          const q = { x: e.points[k].x + (e.points[k + 1].x - e.points[k].x) * t, y: e.points[k].y + (e.points[k + 1].y - e.points[k].y) * t };
          if (distance(w, q) <= tol) return e;
        }
      } else if (distance(e, w) <= tol) return e;
    }
    return null;
  }
  function moveExisting(e, dx, dy, from) {
    if (from.points) { e.points = from.points.map((q) => ({ x: q.x + dx, y: q.y + dy })); }
    e.x = from.x + dx; e.y = from.y + dy;
  }
  function existingDrag(e, w) {
    const before = snapshot();
    const from = clone({ x: e.x, y: e.y, points: e.points });
    let moved = false;
    if (!(st.sel && st.sel.t === 'ex' && st.sel.id === e.id)) { st.sel = { t: 'ex', id: e.id }; st.exKind = null; refreshUI(); draw(); }
    return {
      move(w2) {
        moved = true;
        let dx = w2.x - w.x; let dy = w2.y - w.y;
        const ref = from.points ? from.points[0] : from;
        const p = snapGrid({ x: ref.x + dx, y: ref.y + dy });
        dx = p.x - ref.x; dy = p.y - ref.y;
        moveExisting(e, dx, dy, from);
        draw();
      },
      up(_w, _e, mv) { if (mv && moved) { pushHistory(before); changed(); } else { draw(); refreshUI(); } },
      cancel() { restore(before); changed(); },
    };
  }
  function tapExisting(w) {
    if (st.exDraft) { addExDraftPoint(w); return; }
    const hit = hitExisting(w);
    if (hit) { st.sel = { t: 'ex', id: hit.id }; st.exKind = null; draw(); refreshUI(); say(''); return; }
    if (st.exKind) {
      if (getExistingKind(st.exKind).linear) { st.exDraft = { kind: st.exKind, points: [] }; st.sel = null; addExDraftPoint(w); say(''); return; }
      placeExisting(w); return;
    }
    if (st.sel) { st.sel = null; draw(); refreshUI(); }
    say('Touchez un type (arbre, arbuste, haie…), puis le plan pour le poser.');
  }
  function placeExisting(w) {
    const kd = getExistingKind(st.exKind);
    if (!kd) return null;
    const e = createExisting(kd.id, snapGrid(w));
    if (kd.id === 'fence') setFenceMaterial(e, st.fenceMaterial);
    mutate(() => { g.existing.push(e); st.sel = { t: 'ex', id: e.id }; st.exKind = null; st.exGhost = null; st.exQuery = ''; });
    say(`« ${kd.label} » posé. Précisez la plante ci-dessous (ou « Je ne sais pas »), réglez sa taille actuelle, glissez pour le déplacer.`);
    return e;
  }
  function addExDraftPoint(w) {
    const pts = st.exDraft.points;
    const isFence = st.exDraft.kind === 'fence';
    if (isFence && pts.length >= 3 && distance(w, pts[0]) <= cv.px(24)) { pts.push({ x: pts[0].x, y: pts[0].y }); finishExDraft(); say('Boucle fermée.'); return; }
    const p = nearVertex(w) || snapGrid(w);
    const last = pts[pts.length - 1];
    if (last && distance(last, p) < 0.02) return;
    pts.push(p); draw(); refreshUI();
  }
  function finishExDraft() {
    const d = st.exDraft;
    if (!d || d.points.length < 2) { say('Posez au moins deux points.', 'warn'); return; }
    const e = createExisting(d.kind, d.points);
    if (d.kind === 'fence') setFenceMaterial(e, st.fenceMaterial);
    mutate(() => { g.existing.push(e); st.exDraft = null; st.exKind = null; st.sel = { t: 'ex', id: e.id }; st.exQuery = ''; });
    say(`${getExistingKind(d.kind).label} ajoutée. Glissez-la pour la déplacer, appui long pour saisir sa hauteur en cm.`);
  }
  const cancelExDraft = () => { st.exDraft = null; refreshUI(); draw(); };
  function openExistingPop(e) {
    const kd = exKindDef(e);
    const fields = [{ key: 'h', label: 'Hauteur', value: cm(e.height), kind: 'length' }];
    if (e.kind !== 'fence') fields.push({ key: 'w', label: e.kind === 'hedge' ? 'Largeur' : 'Largeur (houppier)', value: cm(e.width), kind: 'length' });
    fields.push({ key: 'label', label: 'Nom', value: e.label || '', kind: 'text' });
    pop.open({
      title: `${kd.emoji} ${kd.label} : taille actuelle en cm`, hint: '« 800 » = 8 m ; « 1,5 m » accepté.', fields,
      actions: [
        { label: '⧉ Dupliquer', act: 'pop-dup', fn: () => { pop.close(); duplicateExisting(e); } },
        { label: '🗑 Supprimer', act: 'pop-del', danger: true, fn: () => { pop.close(); deleteSel(); } },
      ],
      onOk: (v) => { const chk = checkHeight(e.kind, v.h); mutate(() => { e.height = chk.value; if (v.w) e.width = v.w; e.label = v.label || kd.defaultLabel; }); if (chk.clamped) say(chk.message, 'warn'); },
    });
  }
  function duplicateExisting(e) {
    const c = createExisting(e.kind, { x: e.x + 0.6, y: e.y + 0.6 });
    Object.assign(c, clone(e), { id: c.id });
    c.x = e.x + 0.6; c.y = e.y + 0.6;
    if (c.points) c.points = c.points.map((q) => ({ x: q.x + 0.6, y: q.y + 0.6 }));
    mutate(() => { g.existing.push(c); st.sel = { t: 'ex', id: c.id }; });
  }
  function choosePlant(e, plant) {
    mutate(() => {
      const wasDefault = !e.label || e.label === exKindDef(e).defaultLabel || (e.plantId && existingLabel(e) === (getPlantName(e.plantId)));
      e.plantId = plant.id;
      if (wasDefault) e.label = plant.commonName || plant.id;
      const sz = sizeForPlant(plant, st.exAge, e.kind);
      e.height = sz.height; e.width = sz.width;
    });
    say(`${plant.commonName} : taille ${cm(g.existing.find((x) => x.id === e.id).height)} cm de haut, réglable en cm.`);
  }
  const getPlantName = (id) => { const p = existingPlant({ plantId: id }); return p ? p.commonName : ''; };
  function unknownPlant(e, text) {
    mutate(() => { e.plantId = null; e.label = (text || '').trim() || exKindDef(e).defaultLabel; });
  }
  function setAge(e, plant, age) {
    st.exAge = age;
    mutate(() => { const sz = sizeForPlant(plant, age, e.kind); e.height = sz.height; e.width = sz.width; });
  }
  function setKeep(e, keep) { mutate(() => { e.keep = keep; }); say(keep ? 'À conserver.' : 'À retirer ou remplacer : l’élément ne compte plus dans l’ombre ni l’espace occupé.'); }
  function setMaterial(e, id) { mutate(() => setFenceMaterial(e, id)); }
  const exApi = () => ({
    st, g, e: selEx(), btn, draw, refreshUI, mutate, say, finishDraft: finishExDraft, cancelDraft: cancelExDraft,
    pickKind: (k) => { st.exKind = k; st.sel = null; st.exGhost = null; st.exDraft = null; st.dismissed.existing = true; say(''); draw(); refreshUI(); },
    pickMaterial: (id) => { st.fenceMaterial = id; st.exKind = 'fence'; st.sel = null; st.dismissed.existing = true; say(''); draw(); refreshUI(); },
    choosePlant, unknownPlant, setAge, setKeep, setMaterial, openPop: openExistingPop, duplicate: duplicateExisting, deleteSel,
    isOutside: (e) => contourOk() && (e.points && e.points.length ? e.points : [{ x: e.x, y: e.y }]).some((p) => !pointInPolygon(p, g.boundary)),
  });

  // ---------- dessin ----------
  const poly = (pts) => pts.map((p) => `${p.x},${p.y}`).join(' ');
  function obstacleSvg(o, selected) {
    const col = selected ? '#d81b60' : null;
    if (o.kind === 'tree' && o.center) return `<circle cx="${o.center.x}" cy="${o.center.y}" r="${o.radius || 1}" fill="#558b2f" fill-opacity=".2" stroke="#33691e" stroke-dasharray="6 4" stroke-width="1.5" ${NS}/>`;
    if (!o.points) return '';
    if (o.kind === 'wall' || o.kind === 'fence') return `<g data-obstacle-material="${materialOf(o.kind, o.material)}">${fenceMarkup(o.points, materialOf(o.kind, o.material), { u: cv.px(1), thick: o.kind === 'wall' ? 0.2 : 0.05, scale: 1, selected })}</g>`;
    const c = centroid(o.points);
    return `<polygon points="${poly(o.points)}" fill="#bdbdbd" fill-opacity=".5" stroke="#424242" stroke-width="2" ${NS}/><text x="${c.x}" y="${c.y}" font-size="${cv.px(11)}" text-anchor="middle" fill="#37474f">${o.kind === 'house' ? 'Maison' : 'Abri'}</text>`;
  }

  /** Zones déjà dessinées (étape précédente) : fond coloré par type + nom, sous les aménagements. */
  function zonesSvg(u) {
    let out = '';
    for (const z of g.zones || []) {
      const t = getZoneType(z.type);
      if (!t || !z.shape) continue;
      let pts;
      try { pts = shapePolygon(z.shape, 40); } catch { continue; }
      if (!pts || pts.length < 3) continue;
      out += `<polygon points="${poly(pts)}" fill="${t.color}" fill-opacity=".42" stroke="${t.color}" stroke-width="1.5" stroke-opacity=".9" pointer-events="none" ${NS}/>`;
      const c = centroid(pts);
      const label = `${t.icon} ${z.label || t.label}`;
      out += `<text x="${c.x}" y="${c.y}" font-size="${u * 12}" text-anchor="middle" dominant-baseline="central" fill="var(--jd-fg,#222)" stroke="var(--jd-canvas,#fff)" stroke-width="${u * 3}" paint-order="stroke" pointer-events="none">${esc(label)}</text>`;
    }
    return out;
  }

  function draw() {
    if (destroyed || !cv) return;
    if (north) north.update();
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
    s += zonesSvg(u);
    for (const o of g.obstacles) s += obstacleSvg(o, st.sel && st.sel.t === 'obst' && st.sel.id === o.id);
    s += renderItemsSVG(g, {
      scale: 1, px: u, bg: 'var(--jd-canvas,#fbfaf4)',
      selected: { itemId: st.sel && st.sel.t === 'item' ? st.sel.id : null, openingId: st.sel && st.sel.t === 'open' ? st.sel.id : null, edge: selEdge(), existingId: st.sel && st.sel.t === 'ex' ? st.sel.id : null },
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
    const ex = selEx();
    if (ex && st.tab === 'existing') {
      top += `<polygon points="${poly(existingFootprint(ex))}" fill="none" stroke="#d81b60" stroke-width="2" stroke-dasharray="6 3" ${NS}/>`;
      if (contourOk() && exApi().isOutside(ex)) top += `<text x="${ex.x}" y="${ex.y - u * 18}" font-size="${u * 12}" text-anchor="middle" fill="#b26a00">hors du terrain</text>`;
    }
    if (st.exGhost && st.tab === 'existing' && st.exKind) {
      top += `<polygon points="${poly(existingFootprint(st.exGhost))}" fill="#2e7d32" fill-opacity=".18" stroke="#2e7d32" stroke-dasharray="4 3" stroke-width="1.5" ${NS}/>`;
    }
    if (st.exDraft) {
      const pts = st.exDraft.points;
      if (pts.length) top += `<polyline points="${poly(pts)}" fill="none" stroke="#d81b60" stroke-width="3" ${NS}/>`;
      pts.forEach((p, i) => { top += (i === 0 && pts.length >= 3 && st.exDraft.kind === 'fence') ? `<circle cx="${p.x}" cy="${p.y}" r="${u * 12}" fill="#2e7d32" stroke="#fff" stroke-width="3" ${NS}/>` : `<circle cx="${p.x}" cy="${p.y}" r="${u * 6}" fill="#d81b60"/>`; });
    }
    if (st.draft) {
      const pts = st.draft.points;
      if (pts.length) top += `<polyline points="${poly(pts)}" fill="none" stroke="#d81b60" stroke-width="3" ${NS}/>`;
      pts.forEach((p, i) => { top += (i === 0 && pts.length >= 3) ? `<circle cx="${p.x}" cy="${p.y}" r="${u * 12}" fill="#2e7d32" stroke="#fff" stroke-width="3" ${NS}/>` : `<circle cx="${p.x}" cy="${p.y}" r="${u * 6}" fill="#d81b60"/>`; });
    }
    gTop.innerHTML = top;
  }
  const contourOk = () => closed() && g.boundary.length >= 3;

  // ---------- interface ----------
  function setTab(id) {
    if (st.tab === id) return;
    st.tab = id; st.sel = null; st.kind = null; st.draft = null; st.ghost = null; st.exKind = null; st.exDraft = null; st.exGhost = null;
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
    if (st.tab === 'existing') {
      if (st.exDraft) return `${getExistingKind(st.exDraft.kind).label} : touchez les points successifs (${st.exDraft.points.length} posé${st.exDraft.points.length > 1 ? 's' : ''}), puis « Terminer »${st.exDraft.kind === 'fence' ? ' (ou touchez le 1er point pour fermer la boucle)' : ''}.`;
      if (st.exKind) return getExistingKind(st.exKind).linear ? `Touchez le plan pour tracer ${st.exKind === 'fence' ? 'la clôture' : 'la haie'} point par point.` : `Touchez le plan pour poser « ${getExistingKind(st.exKind).label} » (grille ${gridSize() ? fr(gridSize(), 1) + ' m' : 'off'}).`;
      if (selEx()) return 'Glissez pour déplacer, appui long pour saisir la taille en cm, précisez la plante ci-dessous.';
      return 'Déjà des plantes ou une clôture ? Touchez un type, puis le plan pour le placer.';
    }
    if (selOpening()) return 'Glissez le passage le long du côté, appui long pour sa largeur en cm, ou changez son sens d’ouverture.';
    return `Choisissez un type de passage puis touchez un côté ${st.openKind === 'garage' || st.openKind === 'door' ? 'de maison ou d’abri' : 'du terrain, d’un mur ou d’une clôture'}.`;
  }

  function startText() {
    const d = st.dismissed;
    if (st.tab === 'furniture' && !g.items.length && !st.kind && !d.furniture) return ['Aménagez votre jardin', 'Choisissez un banc, une table… dans la palette, puis touchez le plan pour le poser.'];
    if (st.tab === 'edges' && !hasContour() && !g.obstacles.length && !st.draft && !d.edges) return ['Pas encore de terrain', 'Tracez le contour à l’étape Terrain pour poser murs et clôtures sur ses côtés, ou dessinez un mur libre.'];
    if (st.tab === 'access' && !snapOpeningToSides(g, { x: 0, y: 0 }, { kind: st.openKind }) && !d.access) return ['Aucun côté disponible', 'Tracez le terrain (et la maison) à l’étape Terrain pour poser portails et portes.'];
    if (st.tab === 'existing' && !g.existing.length && !st.exKind && !st.exDraft && !d.existing) return ['Qu’y a-t-il déjà ?', 'Arbres, arbustes, haies, clôtures… Choisissez un type puis touchez le plan pour le placer : ils comptent dans l’ombre et la place libre.'];
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
        h('span', { class: 'jdi-card-meta' }, `${k.shape === 'circle' ? 'Ø ' + cm(k.w) : cm(k.w) + '×' + cm(k.d)} cm · ${euro(k.priceEur)}`)));
      }
      panel.append(pal);
    } else if (st.tab === 'existing') {
      renderExistingPalette(panel, exApi());
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
    detail.className = `jdi-detail is-${st.tab}`;
    const show = (...kids) => { detail.append(...kids.filter(Boolean)); };
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
        btn('🗑', 'del', deleteSel, 'danger', { 'aria-label': 'Supprimer' }),
        heightField({
          label: 'Hauteur (cm)', value: itemHeight(it), def: defaultItemHeight(it.kind), kind: it.kind, custom: it.height != null && Math.abs(Number(it.height) - defaultItemHeight(it.kind)) >= 0.005,
          field: 'item-height', defLabel: 'catalogue', onMessage: (m) => say(m, 'warn'),
          onSet: (m) => mutate(() => { if (m == null || Math.abs(m - defaultItemHeight(it.kind)) < 0.005) delete it.height; else it.height = m; }),
        }));
    } else if (st.tab === 'existing') {
      renderExistingDetail(detail, exApi());
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
          kind === 'open' ? null : h('span', { class: 'jdi-seg' }, hIn, h('span', { class: 'jd-unit' }, 'cm'),
            btn('↺ Valeur par défaut', 'edge-height-reset', () => setEdgeHeight(i, getEdgeKind(kind).height), '', { 'aria-label': `Hauteur par défaut (${formatHeight(getEdgeKind(kind).height)})`, disabled: Math.abs(edgeHeightOf(g, i) - getEdgeKind(kind).height) < 0.005 })),
          h('div', { class: 'jdi-seg jdi-row2' }, EDGE_KINDS.map((k) => btn(k.label, `edge-${k.id}`, () => chooseEdgeKind(k.id), '', { 'data-edge-kind': k.id, 'aria-pressed': String(kind === k.id) })),
            btn('Appliquer à tous', 'apply-all', applyAll, '', { title: 'Appliquer à tous les côtés', 'aria-label': 'Appliquer à tous les côtés' })),
          EDGE_MATERIALS[kind] ? materialChoice(edgeMaterial(i), (m) => setEdgeMaterial(i, m), EDGE_MATERIALS[kind], 'data-edge-material') : null);
      } else if (o) {
        const hIn = h('input', { class: 'jd-input', type: 'text', inputmode: 'numeric', 'aria-label': 'Hauteur en centimètres', 'data-field': 'free-height', value: cm(o.height || FREE_KINDS[o.kind].height) });
        hIn.addEventListener('change', () => { const v = parseLength(hIn.value); if (!Number.isFinite(v)) { refreshUI(); return; } const chk = checkHeight(o.kind, v); mutate(() => { o.height = chk.value; }); if (chk.clamped) say(chk.message, 'warn'); });
        show(h('div', { class: 'jdi-detail-title', 'data-role': 'sel-banner' }, `${FREE_KINDS[o.kind].label} libre`, h('small', null, 'hauteur en cm')),
          hIn, btn('↺ Valeur par défaut', 'free-height-reset', () => mutate(() => { o.height = FREE_KINDS[o.kind].height; }), '', { 'aria-label': `Hauteur par défaut (${formatHeight(FREE_KINDS[o.kind].height)})`, disabled: Math.abs((o.height || 0) - FREE_KINDS[o.kind].height) < 0.005 }), btn('🗑', 'del', deleteSel, 'danger', { 'aria-label': 'Supprimer' }),
          materialChoice(materialOf(o.kind, o.material), (m) => mutate(() => { o.material = m; }), EDGE_MATERIALS[o.kind], 'data-free-material'));
      }
    } else {
      const op = selOpening();
      if (!op) return;
      const k = getOpeningKind(op.kind);
      show(
        h('div', { class: 'jdi-detail-title', 'data-role': 'sel-banner' }, `${k.emoji} ${k.label}`, h('small', null, `${cm(op.width)} cm`)),
        ...OPENING_SWINGS.filter((sw) => op.kind !== 'garage' || sw.id === 'sliding').map((sw) => btn(sw.id === 'in' ? '⤶' : sw.id === 'out' ? '⤷' : '⇄', `swing-${sw.id}`, () => setSwing(sw.id), '', { 'aria-pressed': String((op.swing || k.swing) === sw.id), title: sw.label, 'aria-label': sw.label })),
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
    const exs = existingSummary(g);
    info.innerHTML = `<span><b data-role="count">${n}</b> élément${n > 1 ? 's' : ''}${n ? ` · ≈ <b data-role="total">${esc(euro(price))}</b>` : ''}</span>`
      + `<span><b data-role="edge-count">${g.boundaryEdges.filter((e) => e && e.kind !== 'open').length}</b> côté(s) bâti(s)</span>`
      + `<span><b data-role="opening-count">${g.openings.length}</b> passage${g.openings.length > 1 ? 's' : ''}</span>`
      + (exs.total || st.tab === 'existing' ? `<span data-role="existing-count">${esc(exs.text)}</span>` : '');
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
    if (north) north.destroy();
    try { cv.destroy(); } catch { /* ok */ }
    root.remove();
  };
}
