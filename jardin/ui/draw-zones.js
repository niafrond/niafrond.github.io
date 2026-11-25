// Éditeur de zones : palette des types, création guidée (rectangle en 2 touches, forme libre, cercle, ligne),
// aimantation, sélection par toucher, poignées, déplacement, saisie des dimensions en cm (appui long), avertissements.
import {
  distance, shapePolygon, shapeArea, shapeBounds, bounds, overlapArea, polygonInside, pointInPolygon, centroid,
} from '../geometry.js';
import { attachNorthBadge } from './north-pop.js';
import { ZONE_TYPES, getZoneType, createZone } from '../model.js';
import { ambianceChips, ambianceOf, ambianceEmoji, nameWithAmbiance, detectIn } from './ambiance-picker.js';
import {
  injectStyles, h, createCanvas, gridPath, snap, clone, esc, fr, frLen, frArea, parseLength, toCm,
  projectOnLine, snapToLines, rectPoints, isRectangle,
} from './draw-util.js';

const NS = 'vector-effect="non-scaling-stroke"';
const KIND_LABELS = { polygon: '⬠ Polygone', circle: '◯ Cercle', line: '〰 Ligne' };
const GRIDS = [0.5, 0.1, 1, 0];
const PINK = '#d81b60';
const ERR = 'var(--jd-err,#b3261e)';
const WARN = 'var(--jd-warn,#b26a00)';
const SUGGEST = ['lawn', 'terrace', 'midplants', 'vegetable'];

export function mountZoneEditor(el, { garden, onChange } = {}) {
  injectStyles();
  const g = garden;
  g.zones = g.zones || [];
  g.boundary = g.boundary || [];
  const st = {
    typeId: null, kind: null, mode: 'rect', drawing: null, ghost: null, snapMark: null, sel: null, gridIdx: 0, allTypes: false,
    history: [], future: [], msg: '', lineWidth: 1, pop: false, cotes: [], naming: null, focusName: false,
  };
  let destroyed = false;
  let north = null; // pastille du nord

  const snap0 = () => clone(g.zones);
  const zoneById = (id) => g.zones.find((z) => z.id === id);
  const changed = (light = false) => { if (onChange) onChange(g); draw(); refreshUI(light); };
  const mutate = (fn, light = false) => { st.history.push(snap0()); if (st.history.length > 100) st.history.shift(); st.future = []; fn(); changed(light); };
  const restore = (zones) => { g.zones = zones; if (!zoneById(st.sel)) st.sel = null; closePop(); changed(); };
  const undo = () => { if (!st.history.length) return; st.future.push(snap0()); restore(st.history.pop()); };
  const redo = () => { if (!st.future.length) return; st.history.push(snap0()); restore(st.future.pop()); };
  const gridSize = () => GRIDS[st.gridIdx];
  const say = (m) => { st.msg = m; refreshMsg(); };

  const root = h('div', { class: 'jd jd-editor', 'data-role': 'zone-editor' });
  const barTop = h('div', { class: 'jd-bar jd-scroll' });
  const chips = h('div', { class: 'jd-chips', 'data-role': 'palette', role: 'toolbar', 'aria-label': 'Types de zones' });
  const kindBar = h('div', { class: 'jd-bar jd-scroll', hidden: true, 'data-role': 'kind-bar' });
  const wrap = h('div', { class: 'jd-canvas-wrap' });
  const liveEl = h('div', { class: 'jd-live', hidden: true, 'data-role': 'live' });
  const startEl = h('div', { class: 'jd-start', hidden: true, 'data-role': 'start-panel' });
  const pop = h('div', { class: 'jd-pop', hidden: true, role: 'dialog', 'aria-modal': 'false', 'data-role': 'pop' });
  const info = h('div', { class: 'jd-info' });
  const panel = h('div', { class: 'jd-panel jd-zsheet', hidden: true, 'data-role': 'zone-panel' });
  const msgEl = h('div', { class: 'jd-msg', role: 'status', 'aria-live': 'polite', 'data-role': 'help' });
  root.append(barTop, chips, kindBar, wrap, info, msgEl, panel);
  el.innerHTML = '';
  el.appendChild(root);

  const btn = (label, act, onclick, cls = '', extra = {}) => h('button', { type: 'button', class: `jd-btn ${cls}`, 'data-act': act, onclick, ...extra }, label);
  const bUndo = btn('↶', 'undo', undo, '', { 'aria-label': 'Annuler' });
  const bRedo = btn('↷', 'redo', redo, '', { 'aria-label': 'Rétablir' });
  const bGrid = btn('', 'grid', () => { st.gridIdx = (st.gridIdx + 1) % GRIDS.length; refreshUI(true); }, '', { title: 'Pas de la grille' });
  const bSelect = btn('☝ Sélection', 'select-mode', () => { stopDrawing(); st.typeId = null; st.kind = null; closePop(); refreshUI(); draw(); });
  barTop.append(bUndo, bRedo, bSelect, bGrid,
    btn('－', 'zoom-out', () => cv.zoomCenter(1 / 1.4), '', { 'aria-label': 'Zoom arrière' }),
    btn('＋', 'zoom-in', () => cv.zoomCenter(1.4), '', { 'aria-label': 'Zoom avant' }),
    btn('⤢', 'fit', () => fitView(), '', { 'aria-label': 'Recentrer' }));

  const gGrid = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const gMain = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const gTop = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const cv = createCanvas(wrap, { onView: () => draw(), handlers: { down: onDown, tap: onTap, hover: onHover, long: onLong } });
  wrap.append(liveEl, startEl, pop);
  cv.svg.append(gGrid, gMain, gTop);
  north = attachNorthBadge(wrap, { garden: g, onChange: () => { if (onChange) onChange(g); } });
  cv.svg.setAttribute('aria-label', 'Plan des zones');

  const fitView = () => {
    const pts = [...g.boundary];
    g.zones.forEach((z) => { const b = shapeBounds(z.shape); if (b && Number.isFinite(b.minX)) pts.push({ x: b.minX, y: b.minY }, { x: b.maxX, y: b.maxY }); });
    if (pts.length >= 2) cv.fit(bounds(pts), 1.25); else { cv.view.cx = 5; cv.view.cy = 4; cv.view.mpp = 0.04; cv.apply(); }
  };

  // ---------- helpers de forme ----------
  const polyOf = (z) => shapePolygon(z.shape, 48);
  const round2 = (n) => Math.round(n * 100) / 100;
  const allVerts = () => {
    const v = [...g.boundary];
    g.zones.forEach((z) => { if (z.shape.points) v.push(...z.shape.points); });
    return v;
  };
  const boundaryLines = () => {
    const n = g.boundary.length; const out = [];
    if (n < 2) return out;
    const edges = g.boundaryClosed ? n : n - 1;
    for (let i = 0; i < edges; i++) out.push({ a: g.boundary[i], b: g.boundary[(i + 1) % n] });
    return out;
  };
  /** Aimantation : sommets (contour, autres zones) > côtés du contour prolongés > grille. */
  function snapAt(w, exclude = []) {
    const tol = cv.px(14);
    const pts = allVerts().filter((p) => !exclude.includes(p));
    const r = snap(w, { grid: 0, points: pts, tolerance: tol });
    if (r.kind === 'point') { st.snapMark = { p: r.p, kind: 'point' }; return r.p; }
    const l = snapToLines(w, boundaryLines(), tol);
    if (l) { st.snapMark = { p: l.p, kind: 'edge' }; return { x: round2(l.p.x), y: round2(l.p.y) }; }
    const gs = gridSize();
    if (gs) { const q = snap(w, { grid: gs, points: [], tolerance: tol }).p; st.snapMark = { p: q, kind: 'grid' }; return q; }
    st.snapMark = null;
    return { x: round2(w.x), y: round2(w.y) };
  }
  const stopDrawing = () => { st.drawing = null; st.ghost = null; st.snapMark = null; };
  const defaultRadius = (typeId) => (typeId === 'trees' || typeId === 'orchard' ? 2 : typeId === 'pond' || typeId === 'pool' ? 1.5 : 1.2);
  const lineLength = (pts) => pts.slice(1).reduce((s, p, i) => s + distance(pts[i], p), 0);

  function inZone(z, w) {
    if (z.shape.kind === 'line') {
      const pts = z.shape.points;
      for (let k = 0; k < pts.length - 1; k++) {
        if (projectSeg(w, pts[k], pts[k + 1]) <= Math.max(z.shape.width / 2, cv.px(16))) return true;
      }
      return false;
    }
    return pointInPolygon(w, polyOf(z));
  }
  function projectSeg(w, a, b) {
    const r = projectOnLine(w, a, b);
    const t = Math.max(0, Math.min(1, r.t));
    return distance(w, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
  }
  function hitZone(w) {
    const s = zoneById(st.sel);
    if (s && inZone(s, w)) return s;
    const order = [...g.zones].sort((a, b) => ((getZoneType(a.type) || {}).layer === 'canopy') - ((getZoneType(b.type) || {}).layer === 'canopy'));
    for (let i = order.length - 1; i >= 0; i--) if (inZone(order[i], w)) return order[i];
    return null;
  }

  // poignées de la zone sélectionnée
  function handlesOf(z) {
    const s = z.shape;
    if (s.kind === 'circle') return [{ id: 'c', p: s.center, kind: 'center' }, { id: 'r', p: { x: s.center.x + s.radius, y: s.center.y }, kind: 'radius' }];
    const hs = s.points.map((p, i) => ({ id: i, p, kind: 'vertex' }));
    const n = s.points.length;
    const edges = s.kind === 'polygon' ? n : n - 1;
    for (let i = 0; i < edges; i++) {
      const a = s.points[i]; const b = s.points[(i + 1) % n];
      if (distance(a, b) > cv.px(36)) hs.push({ id: `m${i}`, i, p: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, kind: 'mid' });
    }
    return hs;
  }
  const translateShape = (s0, dx, dy) => {
    const s = clone(s0);
    if (s.center) s.center = { x: s.center.x + dx, y: s.center.y + dy };
    if (s.points) s.points = s.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    return s;
  };

  // ---------- gestes ----------
  function select(id) { st.sel = id; st.naming = null; st.msg = ''; closePop(); draw(); refreshUI(); }

  function onDown(w) {
    if (st.typeId) {
      st.msg = '';
      if (st.kind === 'circle') return circleDown(w);
      if (st.drawing && st.drawing.rect) return rectDown();
      return null;
    }
    const z = zoneById(st.sel);
    if (z) {
      let best = null; let bd = Infinity;
      for (const hd of handlesOf(z)) {
        const d = distance(hd.p, w);
        const lim = hd.kind === 'mid' ? cv.px(22) : cv.px(26);
        if (d <= lim && d < bd) { best = hd; bd = d; }
      }
      if (best) return best.kind === 'mid' ? midDrag(z, best) : handleDrag(z, best);
      if (inZone(z, w)) return bodyDrag(z, w);
    }
    return null; // glisser = déplacer le plan ; un toucher sélectionne
  }

  function circleDown(w0) {
    const was = st.drawing && st.drawing.kind === 'circle' && st.drawing.waiting ? st.drawing : null;
    const c = was ? was.center : snapAt(w0);
    st.drawing = { kind: 'circle', center: c, radius: 0.01, waiting: false };
    const finish = (w) => {
      const r = round2(distance(c, snapAt(w)));
      const radius = r < 0.2 ? defaultRadius(st.typeId) : r;
      stopDrawing();
      addZone({ kind: 'circle', center: c, radius });
    };
    return {
      move(w) { st.ghost = snapAt(w); st.drawing.radius = Math.max(0.1, round2(distance(c, st.ghost))); drawTop(); },
      up(w, e, moved) {
        if (!was && !moved) { st.drawing = { kind: 'circle', center: c, radius: 0.01, waiting: true }; refreshUI(); draw(); return; }
        finish(w);
      },
      cancel() { st.drawing = was ? { ...was, waiting: true } : null; draw(); refreshUI(); },
    };
  }

  function rectDown() {
    const a = st.drawing.points[0];
    return {
      move(w) { st.ghost = snapAt(w); drawTop(); },
      up(w) { finishRect(a, snapAt(w)); },
      cancel() { drawTop(); },
    };
  }
  function finishRect(a, b) {
    if (Math.abs(b.x - a.x) < 0.1 || Math.abs(b.y - a.y) < 0.1) { say('Les deux coins sont trop proches : touchez le coin opposé, plus loin.'); return; }
    stopDrawing();
    addZone({ kind: 'polygon', points: rectPoints(a, b) });
  }

  function commitDrag(before, moved) {
    if (moved) { st.history.push(before); if (st.history.length > 100) st.history.shift(); st.future = []; }
    changed();
  }

  function handleDrag(z, hd) {
    const before = snap0();
    let moved = false;
    return {
      move(w) {
        moved = true;
        const s = z.shape;
        if (hd.kind === 'center') s.center = snapAt(w);
        else if (hd.kind === 'radius') s.radius = Math.max(0.2, round2(distance(s.center, snapAt(w))));
        else if (s.kind === 'polygon' && isRectangle(s.points)) dragRectCorner(s, hd.id, snapAt(w, [s.points[hd.id]]));
        else s.points[hd.id] = snapAt(w, [s.points[hd.id]]);
        if (onChange) onChange(g);
        draw(); refreshUI(true);
      },
      up(w, e, didMove) { commitDrag(before, didMove && moved); },
      cancel() { g.zones = before; changed(); },
    };
  }

  // Un coin d'un rectangle : le coin opposé reste fixe, les deux voisins suivent (le rectangle reste un rectangle).
  function dragRectCorner(s, i, q) {
    const P = s.points; const o = P[(i + 2) % 4];
    const u = (a, b) => { const L = distance(a, b) || 1; return { x: (b.x - a.x) / L, y: (b.y - a.y) / L }; };
    const e1 = u(P[i], P[(i + 1) % 4]); const e2 = u(P[i], P[(i + 3) % 4]);
    const d = { x: q.x - o.x, y: q.y - o.y };
    const s1 = d.x * e1.x + d.y * e1.y; const s2 = d.x * e2.x + d.y * e2.y;
    if (Math.abs(s1) < 0.05 || Math.abs(s2) < 0.05) return;
    const r = (p) => ({ x: round2(p.x), y: round2(p.y) });
    P[(i + 1) % 4] = r({ x: o.x + s2 * e2.x, y: o.y + s2 * e2.y });
    P[(i + 3) % 4] = r({ x: o.x + s1 * e1.x, y: o.y + s1 * e1.y });
    P[i] = { x: q.x, y: q.y };
  }

  // Glisser le point du milieu d'un côté insère un sommet.
  function midDrag(z, hd) {
    const before = snap0();
    let ins = -1;
    return {
      move(w) {
        const s = z.shape;
        if (ins < 0) { s.points.splice(hd.i + 1, 0, { x: hd.p.x, y: hd.p.y }); ins = hd.i + 1; }
        s.points[ins] = snapAt(w, [s.points[ins]]);
        if (onChange) onChange(g);
        draw(); refreshUI(true);
      },
      up() { commitDrag(before, ins >= 0); },
      cancel() { g.zones = before; changed(); },
    };
  }

  function bodyDrag(z, start) {
    const before = snap0();
    const s0 = clone(z.shape);
    let moved = false;
    const anchors = (s) => (s.center ? [s.center] : s.points);
    return {
      move(w) {
        moved = true;
        const dx0 = w.x - start.x; const dy0 = w.y - start.y;
        // aimantation d'un sommet de la zone sur un sommet / un côté du terrain, sinon grille
        let best = null; const tol = cv.px(14);
        const others = allVerts().filter((p) => !(z.shape.points || []).includes(p));
        const lines = boundaryLines();
        for (const a of anchors(s0)) {
          const q = { x: a.x + dx0, y: a.y + dy0 };
          for (const o of others) { const d = distance(q, o); if (d <= tol && (!best || d < best.d)) best = { d, dx: o.x - a.x, dy: o.y - a.y }; }
          const l = snapToLines(q, lines, tol);
          if (l && (!best || l.d < best.d)) best = { d: l.d, dx: l.p.x - a.x, dy: l.p.y - a.y };
        }
        let dx = dx0; let dy = dy0;
        if (best) { dx = best.dx; dy = best.dy; } else {
          const gs = gridSize();
          if (gs) { dx = Math.round(dx0 / gs) * gs; dy = Math.round(dy0 / gs) * gs; }
        }
        z.shape = translateShape(s0, dx, dy);
        if (onChange) onChange(g);
        draw(); refreshUI(true);
      },
      up(w, e, didMove) { commitDrag(before, didMove && moved); },
      cancel() { g.zones = before; changed(); },
    };
  }

  function onTap(w) {
    st.msg = '';
    if (st.typeId && st.kind && st.kind !== 'circle') {
      const p = snapAt(w);
      if (!st.drawing) st.drawing = st.kind === 'polygon' && st.mode === 'rect' ? { kind: 'polygon', rect: true, points: [] } : { kind: st.kind, points: [] };
      const d = st.drawing; const pts = d.points;
      if (d.rect) {
        if (!pts.length) { pts.push(p); st.ghost = null; draw(); refreshUI(); return; }
        finishRect(pts[0], p); return;
      }
      // toucher le 1er point (avec au moins 3 points) = fermer la forme
      if (d.kind === 'polygon' && pts.length >= 3 && (distance(w, pts[0]) <= cv.px(24) || distance(p, pts[0]) <= cv.px(24))) { finishDrawing(); return; }
      if (pts.length && distance(pts[pts.length - 1], p) < 1e-6) { if (pts.length >= (d.kind === 'line' ? 2 : 3)) finishDrawing(); return; }
      pts.push(p);
      draw(); refreshUI();
      return;
    }
    if (st.typeId) { draw(); refreshUI(); return; } // cercle : géré au toucher
    const z = zoneById(st.sel);
    if (z) { // toucher une cote de la zone sélectionnée : saisir ses dimensions
      const c = st.cotes.find((k) => distance(k.p, w) <= cv.px(22));
      if (c) { openDimsPop(z); return; }
    }
    const hit = hitZone(w);
    select(hit ? hit.id : null);
  }
  function onHover(w) {
    if (!st.typeId) return;
    const d = st.drawing;
    if (d && (d.points || d.waiting)) {
      st.ghost = snapAt(w);
      if (d.waiting) d.radius = Math.max(0.1, round2(distance(d.center, st.ghost)));
      drawTop();
    }
  }

  function finishDrawing() {
    const d = st.drawing;
    if (!d || !d.points) return;
    const min = d.kind === 'line' ? 2 : 3;
    if (d.rect || d.points.length < min) { say(d.rect ? 'Touchez le coin opposé pour finir le rectangle.' : `Il faut au moins ${min} points.`); return; }
    const t = getZoneType(st.typeId);
    const shape = d.kind === 'line'
      ? { kind: 'line', points: d.points, width: st.lineWidth || (t && t.defaultWidth) || 1 }
      : { kind: 'polygon', points: d.points };
    stopDrawing();
    addZone(shape);
  }

  function addZone(shape) {
    const t = getZoneType(st.typeId);
    if (!t) return;
    mutate(() => {
      const z = createZone(t.id, shape);
      const same = g.zones.filter((q) => q.type === t.id).length;
      if (same) z.label = `${t.label} ${same + 1}`;
      g.zones.push(z);
      st.sel = z.id; st.naming = z.id; st.focusName = true;
      st.typeId = null; st.kind = null; st.ghost = null; st.snapMark = null;
      st.msg = `Zone « ${z.label} » ajoutée (${frArea(shapeArea(shape))}). Choisissez un autre type pour enchaîner, ou ↶ pour annuler.`;
    });
  }

  // ---------- appui long : saisie des dimensions ----------
  function onLong(w) {
    if (st.typeId) { stopDrawing(); draw(); refreshUI(); openCreatePop(snapAt(w)); return; }
    const z = hitZone(w);
    if (z) { st.sel = z.id; draw(); refreshUI(); openDimsPop(z); return; }
    say('Choisissez d’abord un type de zone, puis appuyez longuement sur le plan pour saisir ses dimensions.');
  }

  function closePop() { st.pop = false; pop.hidden = true; pop.innerHTML = ''; }
  /** Fenêtre de saisie en cm (« 350 » = 3,50 m ; « 3,5 m » accepté), −10 / +10, Entrée valide, Échap annule. */
  function openPop({ title, hint, fields = [], okLabel = 'Valider', onOk }) {
    st.pop = true;
    pop.innerHTML = '';
    pop.hidden = false;
    const inputs = {};
    const rows = fields.map((f) => {
      const inp = h('input', { class: 'jd-input jd-pop-input', type: 'text', inputmode: 'numeric', value: f.value ?? '', 'aria-label': f.label, enterkeyhint: 'done', 'data-field': f.key });
      inputs[f.key] = inp;
      const step = (d) => () => {
        const v = parseLength(inp.value);
        inp.value = toCm(Math.max(0.01, (Number.isFinite(v) ? v : 0) + d)); inp.focus(); inp.select();
      };
      return h('div', { class: 'jd-pop-row' },
        h('label', {}, f.label),
        h('button', { type: 'button', class: 'jd-btn jd-step', 'aria-label': 'Moins 10 centimètres', onclick: step(-0.1) }, '−10'),
        inp,
        h('span', { class: 'jd-unit' }, 'cm'),
        h('button', { type: 'button', class: 'jd-btn jd-step', 'aria-label': 'Plus 10 centimètres', onclick: step(0.1) }, '+10'));
    });
    const commit = () => {
      const out = {};
      for (const f of fields) {
        const v = parseLength(inputs[f.key].value);
        if (!Number.isFinite(v)) { inputs[f.key].classList.add('bad'); inputs[f.key].focus(); say('Saisissez une longueur en cm, par exemple 350 (ou 3,5 m).'); return; }
        out[f.key] = v;
      }
      const res = onOk ? onOk(out) : null;
      if (res !== false) closePop();
    };
    pop.append(...[
      h('div', { class: 'jd-pop-title' }, title),
      ...rows,
      hint ? h('div', { class: 'jd-pop-hint' }, hint) : null,
      h('div', { class: 'jd-row' },
        h('button', { type: 'button', class: 'jd-btn primary', 'data-act': 'pop-ok', onclick: commit }, okLabel),
        h('button', { type: 'button', class: 'jd-btn', 'data-act': 'pop-cancel', onclick: closePop }, 'Annuler')),
    ].filter(Boolean));
    pop.onkeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); } else if (e.key === 'Escape') { e.preventDefault(); closePop(); }
    };
    const first = Object.values(inputs)[0];
    if (first) setTimeout(() => { first.focus(); first.select(); }, 0);
  }

  /** Dimensions courantes : rectangle = largeur × longueur ; autre polygone = emprise ; cercle = rayon ; ligne = largeur. */
  function dimsOf(z) {
    const s = z.shape;
    if (s.kind === 'circle') return { kind: 'circle', r: s.radius };
    if (s.kind === 'line') return { kind: 'line', w: s.width, len: lineLength(s.points) };
    if (isRectangle(s.points)) return { kind: 'rect', w: distance(s.points[0], s.points[1]), l: distance(s.points[0], s.points[3]) };
    const b = shapeBounds(s);
    return { kind: 'poly', w: b.maxX - b.minX, l: b.maxY - b.minY };
  }
  const dimsText = (z) => {
    const d = dimsOf(z);
    if (d.kind === 'circle') return `rayon ${frLen(d.r)}`;
    if (d.kind === 'line') return `${frLen(d.len)} de long × ${frLen(d.w)} de large`;
    return `${frLen(d.w)} × ${frLen(d.l)}${d.kind === 'poly' ? ' (emprise)' : ''}`;
  };

  function applyDims(z, v) {
    const s = z.shape;
    if (s.kind === 'circle') s.radius = round2(v.r);
    else if (s.kind === 'line') s.width = round2(v.w);
    else if (isRectangle(s.points)) {
      const [p0, p1, , p3] = s.points;
      const L1 = distance(p0, p1) || 1; const L2 = distance(p0, p3) || 1;
      const u = { x: (p1.x - p0.x) / L1, y: (p1.y - p0.y) / L1 }; const t = { x: (p3.x - p0.x) / L2, y: (p3.y - p0.y) / L2 };
      const r = (p) => ({ x: round2(p.x), y: round2(p.y) });
      s.points = [r(p0), r({ x: p0.x + u.x * v.w, y: p0.y + u.y * v.w }),
        r({ x: p0.x + u.x * v.w + t.x * v.l, y: p0.y + u.y * v.w + t.y * v.l }), r({ x: p0.x + t.x * v.l, y: p0.y + t.y * v.l })];
    } else {
      const b = shapeBounds(s);
      const kx = v.w / ((b.maxX - b.minX) || 1); const ky = v.l / ((b.maxY - b.minY) || 1);
      s.points = s.points.map((p) => ({ x: round2(b.minX + (p.x - b.minX) * kx), y: round2(b.minY + (p.y - b.minY) * ky) }));
    }
  }

  function openDimsPop(z) {
    const d = dimsOf(z);
    const fields = d.kind === 'circle' ? [{ key: 'r', label: 'Rayon', value: toCm(d.r) }]
      : d.kind === 'line' ? [{ key: 'w', label: 'Largeur', value: toCm(d.w) }]
        : [{ key: 'w', label: 'Largeur', value: toCm(d.w) }, { key: 'l', label: 'Longueur', value: toCm(d.l) }];
    const hint = d.kind === 'circle' ? 'Tapez le rayon en centimètres : 150 = 1,50 m.'
      : d.kind === 'line' ? `Longueur du tracé : ${frLen(d.len)}. Tapez la largeur en centimètres : 100 = 1 m.`
        : d.kind === 'poly' ? 'Forme libre : la forme est étirée à cette emprise. Centimètres : 350 = 3,50 m.'
          : 'Tapez en centimètres : 350 = 3,50 m. Le coin en haut à gauche reste en place.';
    openPop({
      title: `${z.label} · ${dimsText(z)}`, hint, fields, okLabel: 'Appliquer',
      onOk: (v) => { mutate(() => { applyDims(z, v); }); },
    });
  }

  function openCreatePop(a) {
    const t = getZoneType(st.typeId);
    if (!t) return;
    const title = `Nouvelle zone : ${t.icon} ${t.label}`;
    if (st.kind === 'circle') {
      openPop({
        title, fields: [{ key: 'r', label: 'Rayon', value: '' }], okLabel: 'Créer le cercle',
        hint: 'Le centre est posé là où vous avez appuyé. Centimètres : 150 = 1,50 m.',
        onOk: ({ r }) => { addZone({ kind: 'circle', center: a, radius: round2(r) }); },
      });
    } else if (st.kind === 'line') {
      openPop({
        title, okLabel: 'Créer la ligne',
        fields: [{ key: 'len', label: 'Longueur', value: '' }, { key: 'w', label: 'Largeur', value: toCm(st.lineWidth || t.defaultWidth || 1) }],
        hint: 'La ligne part de ce point vers la droite ; vous pourrez la déformer ensuite.',
        onOk: ({ len, w }) => { addZone({ kind: 'line', points: [a, { x: round2(a.x + len), y: a.y }], width: round2(w) }); },
      });
    } else {
      openPop({
        title, okLabel: 'Créer la zone', fields: [{ key: 'w', label: 'Largeur', value: '' }, { key: 'l', label: 'Longueur', value: '' }],
        hint: 'Le coin haut gauche est posé là où vous avez appuyé. Centimètres : 350 = 3,50 m.',
        onOk: ({ w, l }) => { addZone({ kind: 'polygon', points: rectPoints(a, { x: round2(a.x + w), y: round2(a.y + l) }) }); },
      });
    }
  }

  // ---------- avertissements ----------
  const ovCache = new Map();
  const sigOf = (z) => JSON.stringify(z.shape);
  function overlapOf(a, b) {
    const [x, y] = a.id < b.id ? [a, b] : [b, a];
    const k = `${x.id}|${y.id}`; const sx = sigOf(x); const sy = sigOf(y);
    const c = ovCache.get(k);
    if (c && c.sx === sx && c.sy === sy) return c.v;
    const v = overlapArea(polyOf(x), polyOf(y));
    ovCache.set(k, { sx, sy, v });
    return v;
  }
  const outCache = new Map();
  function isOut(z) {
    if (!(g.boundary.length >= 3 && g.boundaryClosed)) return false;
    const sg = sigOf(z) + JSON.stringify(g.boundary);
    const c = outCache.get(z.id);
    if (c && c.sg === sg) return c.v;
    const v = !polygonInside(polyOf(z), g.boundary);
    outCache.set(z.id, { sg, v });
    return v;
  }
  const isGround = (z) => ((getZoneType(z.type) || {}).layer === 'ground');
  function warningsFor(z) {
    const out = [];
    if (isGround(z)) {
      for (const o of g.zones) {
        if (o === z || !isGround(o)) continue;
        const a = overlapOf(z, o);
        if (a > 0.1) out.push(`Chevauche « ${o.label} » sur environ ${frArea(a)}. Deux zones au sol ne peuvent pas occuper le même endroit.`);
      }
    }
    if (isOut(z)) out.push('Dépasse du contour du terrain.');
    return out;
  }
  const overlapIds = () => {
    const ids = new Set(); let n = 0;
    const ground = g.zones.filter(isGround);
    for (let i = 0; i < ground.length; i++) for (let j = i + 1; j < ground.length; j++) if (overlapOf(ground[i], ground[j]) > 0.1) { n++; ids.add(ground[i].id); ids.add(ground[j].id); }
    return { n, ids };
  };

  // ---------- dessin ----------
  const poly = (pts) => pts.map((p) => `${p.x},${p.y}`).join(' ');
  const label = (x, y, txt, fs, extra = '') => `<text x="${x}" y="${y}" font-size="${fs}" ${extra} text-anchor="middle" fill="#14210f" stroke="#fff" stroke-width="${fs * 0.22}" paint-order="stroke">${txt}</text>`;
  function cotesOf(pl, closed = true) {
    const c = centroid(pl); const out = [];
    const n = pl.length; const edges = closed ? n : n - 1;
    for (let i = 0; i < edges; i++) {
      const a = pl[i]; const b = pl[(i + 1) % n]; const L = distance(a, b);
      if (L < cv.px(44)) continue;
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      let nx = -(b.y - a.y) / L; let ny = (b.x - a.x) / L;
      if ((m.x - c.x) * nx + (m.y - c.y) * ny < 0) { nx = -nx; ny = -ny; }
      out.push({ p: { x: m.x + nx * cv.px(16), y: m.y + ny * cv.px(16) + cv.px(4) }, len: L });
    }
    return out;
  }
  function draw() {
    if (destroyed) return;
    if (north) north.update();
    const r = cv.svg.getBoundingClientRect();
    const gp = gridPath(cv.view, { width: r.width || 390, height: r.height || 520 });
    gGrid.innerHTML = `<path d="${gp.minor}" stroke="var(--jd-grid,#e3e3da)" fill="none" stroke-width="1" ${NS}/><path d="${gp.major}" stroke="var(--jd-line,#cfcfc4)" fill="none" stroke-width="1" ${NS}/>`;
    let s = '';
    if (g.boundary.length >= 2) {
      s += g.boundaryClosed && g.boundary.length >= 3
        ? `<polygon points="${poly(g.boundary)}" fill="var(--jd-accent,#2e7d32)" fill-opacity=".07" stroke="var(--jd-fg,#222)" stroke-width="2.5" ${NS}/>`
        : `<polyline points="${poly(g.boundary)}" fill="none" stroke="var(--jd-fg,#222)" stroke-width="2.5" stroke-dasharray="6 4" ${NS}/>`;
    }
    for (const o of g.obstacles || []) {
      if (o.kind === 'tree' && o.center) s += `<circle cx="${o.center.x}" cy="${o.center.y}" r="${o.radius || 1}" fill="#558b2f" fill-opacity=".12" stroke="#33691e" stroke-dasharray="5 3" ${NS}/>`;
      else if (o.points && o.points.length >= 3) s += `<polygon points="${poly(o.points)}" fill="#9e9e9e" fill-opacity=".35" stroke="#616161" ${NS}/>`;
      else if (o.points) s += `<polyline points="${poly(o.points)}" fill="none" stroke="#616161" stroke-width="3" ${NS}/>`;
    }
    const order = [...g.zones].sort((a, b) => ((getZoneType(a.type) || {}).layer === 'canopy') - ((getZoneType(b.type) || {}).layer === 'canopy'));
    const fs = cv.px(12);
    const ov = overlapIds().ids;
    st.cotes = [];
    for (const z of order) {
      const t = getZoneType(z.type); if (!t) continue;
      const pl = polyOf(z); if (pl.length < 3) continue;
      const selected = z.id === st.sel;
      const canopy = t.layer === 'canopy';
      const out = isOut(z);
      const stroke = out ? ERR : ov.has(z.id) ? WARN : selected ? PINK : 'rgba(0,0,0,.55)';
      const sw = out || selected ? 3.5 : ov.has(z.id) ? 2.5 : 1.5;
      s += `<polygon points="${poly(pl)}" fill="${t.color}" fill-opacity="${canopy ? 0.35 : 0.6}" stroke="${stroke}" stroke-width="${sw}"${canopy && !out ? ' stroke-dasharray="6 3"' : ''} stroke-linejoin="round" ${NS}${out ? ' data-out="1"' : ''}/>`;
      const c = centroid(pl);
      const ae = ambianceEmoji(z.ambiance);
      s += label(c.x, c.y, `${out ? '⚠ ' : ''}${t.icon} ${esc(z.label)}${ae ? ` ${ae}` : ''}`, fs, 'font-weight="700"');
      s += label(c.x, c.y + fs * 1.3, `${fr(shapeArea(z.shape), 1)} m²`, fs * 0.9);
      if (selected && !st.typeId && z.shape.kind !== 'circle') {
        const cs = cotesOf(z.shape.points, z.shape.kind === 'polygon');
        for (const k of cs) { s += label(k.p.x, k.p.y, frLen(k.len), fs * 0.85, 'font-weight="600"'); st.cotes.push(k); }
      } else if (selected && !st.typeId) {
        const p = { x: z.shape.center.x, y: z.shape.center.y - z.shape.radius - cv.px(10) };
        s += label(p.x, p.y, `r = ${frLen(z.shape.radius)}`, fs * 0.85, 'font-weight="600"');
        st.cotes.push({ p, len: z.shape.radius });
      }
    }
    const sel = zoneById(st.sel);
    if (sel && !st.typeId) {
      for (const hd of handlesOf(sel)) {
        if (hd.kind === 'mid') s += `<circle cx="${hd.p.x}" cy="${hd.p.y}" r="${cv.px(8)}" fill="#fff" fill-opacity=".85" stroke="${PINK}" stroke-width="2" stroke-dasharray="3 2" data-handle="mid" ${NS}/><path d="M${hd.p.x - cv.px(4)} ${hd.p.y}H${hd.p.x + cv.px(4)}M${hd.p.x} ${hd.p.y - cv.px(4)}V${hd.p.y + cv.px(4)}" stroke="${PINK}" stroke-width="1.5" ${NS}/>`;
        else s += `<circle cx="${hd.p.x}" cy="${hd.p.y}" r="${cv.px(hd.kind === 'radius' ? 12 : 11)}" fill="${hd.kind === 'radius' ? '#ffb300' : '#fff'}" stroke="${PINK}" stroke-width="3" data-handle="${hd.kind}" ${NS}/>`;
      }
    }
    gMain.innerHTML = s;
    drawTop();
  }
  function drawTop() {
    if (destroyed) return;
    const d = st.drawing; let s = ''; let live = '';
    const t = getZoneType(st.typeId);
    const col = (t && t.color) || '#2e7d32';
    const fs = cv.px(13);
    if (d && d.kind === 'circle') {
      const r = d.waiting && !st.ghost ? 0 : d.radius;
      if (r > 0.02) s += `<circle cx="${d.center.x}" cy="${d.center.y}" r="${r}" fill="${col}" fill-opacity=".4" stroke="${PINK}" stroke-width="2" stroke-dasharray="5 3" ${NS}/><line x1="${d.center.x}" y1="${d.center.y}" x2="${d.center.x + r}" y2="${d.center.y}" stroke="${PINK}" ${NS}/>`;
      s += `<circle cx="${d.center.x}" cy="${d.center.y}" r="${cv.px(9)}" fill="${PINK}" stroke="#fff" stroke-width="2" ${NS}/>`;
      if (r > 0.02) live = `Rayon ${frLen(r)} · surface ${frArea(Math.PI * r * r)}`;
    } else if (d && d.rect && d.points.length) {
      const a = d.points[0]; const b = st.ghost || a;
      const pts = rectPoints(a, b);
      const w = Math.abs(b.x - a.x); const l = Math.abs(b.y - a.y);
      s += `<polygon points="${poly(pts)}" fill="${col}" fill-opacity=".35" stroke="${PINK}" stroke-width="2" stroke-dasharray="6 4" ${NS}/>`;
      s += `<circle cx="${a.x}" cy="${a.y}" r="${cv.px(10)}" fill="${PINK}" stroke="#fff" stroke-width="2" ${NS}/>`;
      if (w > 0.05 && l > 0.05) {
        s += label((a.x + b.x) / 2, Math.min(a.y, b.y) - cv.px(6), frLen(w), fs, 'font-weight="600"');
        s += label(Math.max(a.x, b.x) + cv.px(26), (a.y + b.y) / 2, frLen(l), fs, 'font-weight="600"');
        live = `${frLen(w)} × ${frLen(l)} · surface ${frArea(w * l)}`;
      } else live = 'Touchez le coin opposé.';
    } else if (d && d.points && d.points.length) {
      const pts = st.ghost ? [...d.points, st.ghost] : d.points;
      if (d.kind === 'line') {
        s += `<polyline points="${poly(pts)}" fill="none" stroke="${col}" stroke-opacity=".5" stroke-width="${st.lineWidth || 1}" stroke-linejoin="round" stroke-linecap="butt"/>`;
        s += `<polyline points="${poly(pts)}" fill="none" stroke="${PINK}" stroke-width="2" stroke-dasharray="6 4" ${NS}/>`;
        live = `Longueur ${frLen(lineLength(pts))} · largeur ${frLen(st.lineWidth || 1)}`;
      } else {
        s += pts.length >= 3
          ? `<polygon points="${poly(pts)}" fill="${col}" fill-opacity=".3" stroke="${PINK}" stroke-width="2" stroke-dasharray="6 4" ${NS}/>`
          : `<polyline points="${poly(pts)}" fill="none" stroke="${PINK}" stroke-width="2" stroke-dasharray="6 4" ${NS}/>`;
        live = pts.length >= 3 ? `Surface ${frArea(shapeArea({ kind: 'polygon', points: pts }))} · ${pts.length} points` : pts.length === 2 ? `Côté ${frLen(distance(pts[0], pts[1]))}` : '';
      }
      const closable = d.kind === 'polygon' && d.points.length >= 3;
      d.points.forEach((p, i) => {
        if (i === 0 && closable) s += `<circle cx="${p.x}" cy="${p.y}" r="${cv.px(17)}" fill="#2e7d32" stroke="#fff" stroke-width="3" ${NS}/><text x="${p.x}" y="${p.y}" font-size="${cv.px(15)}" text-anchor="middle" dominant-baseline="central" fill="#fff" font-weight="700" pointer-events="none">✔</text>`;
        else s += `<circle cx="${p.x}" cy="${p.y}" r="${cv.px(i === 0 ? 12 : 8)}" fill="${i === 0 ? PINK : '#fff'}" stroke="${PINK}" stroke-width="2" ${NS}/>`;
      });
    }
    if (st.typeId && st.snapMark && (st.ghost || (d && d.points && !d.points.length))) {
      const m = st.snapMark;
      s += `<circle cx="${m.p.x}" cy="${m.p.y}" r="${cv.px(6)}" fill="none" stroke="${m.kind === 'point' ? '#1e88e5' : m.kind === 'edge' ? '#8e24aa' : '#777'}" stroke-width="2" ${NS}/>`;
    }
    gTop.innerHTML = s;
    liveEl.textContent = live;
    liveEl.hidden = !live;
  }

  // ---------- interface ----------
  function typeList() {
    const wished = (g.wishedZoneTypes || []).map(getZoneType).filter(Boolean);
    const rest = ZONE_TYPES.filter((t) => !wished.includes(t));
    return { wished, rest };
  }
  function refreshChips() {
    chips.innerHTML = '';
    const { wished, rest } = typeList();
    const card = (t, isWished) => {
      const n = g.zones.filter((z) => z.type === t.id).length;
      const status = n ? `✓ dessiné (${n})` : isWished ? 'à dessiner' : '';
      return h('button', {
        type: 'button', class: `jd-chip jd-tcard${n ? ' done' : ''}${isWished && !n ? ' todo' : ''}`, style: { '--chip': t.color }, 'data-type': t.id,
        'aria-pressed': String(st.typeId === t.id), title: t.label, onclick: () => chooseType(t.id),
      }, h('span', { class: 'jd-ticon', 'aria-hidden': 'true' }, t.icon), h('span', { class: 'jd-tname' }, t.label), h('span', { class: 'jd-tstat' }, status));
    };
    wished.forEach((t) => chips.append(card(t, true)));
    if (st.allTypes || !wished.length) rest.forEach((t) => chips.append(card(t, false)));
    if (wished.length) chips.append(h('button', { type: 'button', class: 'jd-chip jd-tcard jd-tmore', 'data-act': 'toggle-all', onclick: () => { st.allTypes = !st.allTypes; refreshChips(); } }, h('span', { class: 'jd-ticon' }, st.allTypes ? '−' : '＋'), h('span', { class: 'jd-tname' }, st.allTypes ? 'Masquer les autres' : 'Autres types')));
  }
  function chooseType(id) {
    const t = getZoneType(id);
    stopDrawing(); st.sel = null; st.naming = null; st.msg = ''; closePop();
    if (st.typeId === id) { st.typeId = null; st.kind = null; } else {
      st.typeId = id; st.kind = t.shapeKinds[0]; st.mode = 'rect'; st.lineWidth = t.defaultWidth || 1;
    }
    refreshUI(); draw();
  }

  function help() {
    const d = st.drawing;
    if (st.typeId) {
      if (st.kind === 'circle') return d && d.waiting ? 'Touchez le bord du cercle (ou glissez) pour fixer le rayon.' : 'Touchez le centre, puis glissez ou touchez le bord pour le rayon. Appui long : saisir le rayon.';
      if (st.kind === 'line') return `Touchez chaque point de la ligne puis « Terminer ». Largeur : ${frLen(st.lineWidth || 1)}. Appui long : saisir les mesures.`;
      if (st.mode === 'rect') return d && d.points.length ? 'Touchez (ou glissez jusqu’à) le coin opposé du rectangle.' : 'Touchez un premier coin, puis le coin opposé. Appui long : saisir largeur × longueur.';
      return d && d.points.length >= 3 ? 'Touchez le 1er point (✔ vert) pour fermer la forme, ou continuez à poser des angles.' : 'Touchez chaque angle ; touchez le 1er point pour fermer la forme. Appui long : saisir les mesures.';
    }
    if (zoneById(st.sel)) return 'Glissez un rond pour déformer, un ＋ pour ajouter un sommet, la zone pour la déplacer. Appui long : dimensions en cm.';
    return g.zones.length ? 'Touchez une zone pour la sélectionner, ou choisissez un type pour en ajouter. Appui long sur une zone : dimensions.' : 'Choisissez un type de zone puis dessinez-la sur le plan.';
  }
  const refreshMsg = () => { msgEl.textContent = st.msg || help(); };

  function refreshKindBar() {
    const t = getZoneType(st.typeId);
    kindBar.hidden = !t;
    kindBar.innerHTML = '';
    if (!t) return;
    if (t.shapeKinds.length > 1) t.shapeKinds.forEach((k) => kindBar.append(btn(KIND_LABELS[k] || k, `kind-${k}`, () => { st.kind = k; stopDrawing(); st.msg = ''; refreshUI(); draw(); }, '', { 'aria-pressed': String(st.kind === k) })));
    if (st.kind === 'polygon') {
      kindBar.append(btn('▭ Rectangle', 'mode-rect', () => { st.mode = 'rect'; stopDrawing(); refreshUI(); draw(); }, '', { 'aria-pressed': String(st.mode === 'rect'), title: 'Deux coins opposés' }));
      kindBar.append(btn('✎ Forme libre', 'mode-free', () => { st.mode = 'free'; stopDrawing(); refreshUI(); draw(); }, '', { 'aria-pressed': String(st.mode === 'free'), title: 'Un point par angle' }));
    }
    if (st.kind === 'line') {
      const win = h('input', { class: 'jd-input sm', type: 'text', inputmode: 'numeric', value: toCm(st.lineWidth || 1), 'aria-label': 'Largeur en centimètres', 'data-role': 'line-width' });
      win.addEventListener('change', () => { const v = parseLength(win.value); if (v > 0.04) { st.lineWidth = v; drawTop(); refreshMsg(); } win.value = toCm(st.lineWidth); });
      kindBar.append(h('label', { class: 'jd-msg', style: { padding: '0 2px' } }, 'Largeur'), win, h('span', { class: 'jd-unit' }, 'cm'));
    }
    if (st.kind !== 'circle') {
      const n = st.drawing && st.drawing.points ? st.drawing.points.length : 0;
      const need = st.kind === 'line' ? 2 : 3;
      kindBar.append(btn('✔ Terminer', 'finish', finishDrawing, 'primary', { disabled: (st.drawing && st.drawing.rect) || n < need }));
    }
    const has = !!st.drawing;
    kindBar.append(btn('✕ Annuler le tracé', 'cancel-draw', () => { stopDrawing(); draw(); refreshUI(); }, '', { disabled: !has }));
  }

  function refreshUI(light = false) {
    if (destroyed) return;
    bUndo.disabled = !st.history.length;
    bRedo.disabled = !st.future.length;
    bGrid.textContent = gridSize() ? `▦ ${fr(gridSize(), 1)} m` : '▦ off';
    bSelect.setAttribute('aria-pressed', String(!st.typeId));
    const sel = zoneById(st.sel);
    if (!light) {
      refreshChips();
      refreshKindBar();
    }
    // La palette reste toujours visible (pour enchaîner les zones) ; compacte quand une zone est sélectionnée.
    chips.hidden = false;
    chips.classList.toggle('compact', !!(sel && !st.typeId));
    const { n: ov } = overlapIds();
    const out = g.zones.filter(isOut).length;
    const wished = (g.wishedZoneTypes || []).filter((id) => !g.zones.some((z) => z.type === id));
    info.innerHTML = `<span><b data-role="zone-count">${g.zones.length}</b> zone${g.zones.length > 1 ? 's' : ''}</span>`
      + (ov ? `<span class="jd-msg warn" style="padding:0">⚠ ${ov} chevauchement${ov > 1 ? 's' : ''}</span>` : '')
      + (out ? `<span class="jd-msg err" style="padding:0">⚠ ${out} hors du terrain</span>` : '')
      + (wished.length ? `<span class="jd-msg" style="padding:0">À dessiner : ${wished.map((id) => (getZoneType(id) || { label: id }).label).join(', ')}</span>` : '');
    info.hidden = false;
    refreshMsg();
    refreshStart();
    panel.hidden = !sel || !!st.typeId;
    if (sel && !st.typeId) {
      if (light) {
        const a = panel.querySelector('[data-role=zone-area]');
        if (a) a.textContent = frArea(shapeArea(sel.shape));
        const dm = panel.querySelector('[data-role=zone-dims]');
        if (dm) dm.textContent = dimsText(sel);
        renderWarns(sel);
      } else renderPanel(sel);
    }
  }

  function refreshStart() {
    const show = !g.zones.length && !st.typeId && !st.drawing && !st.pop;
    startEl.hidden = !show;
    if (!show) { startEl.innerHTML = ''; return; }
    if (startEl.childElementCount) return;
    const { wished } = typeList();
    const pick = (wished.length ? wished : SUGGEST.map(getZoneType).filter(Boolean)).slice(0, 4);
    startEl.append(
      h('div', { class: 'jd-start-title' }, 'Choisissez une zone puis dessinez-la'),
      h('div', { class: 'jd-row jd-grid2' },
        pick.map((t) => h('button', { type: 'button', class: 'jd-btn', 'data-start-type': t.id, style: { borderColor: t.color, borderWidth: '2px' }, onclick: () => chooseType(t.id) }, `${t.icon} ${t.label}`)),
        h('button', { type: 'button', class: 'jd-btn', 'data-act': 'start-more', onclick: () => { st.allTypes = true; refreshChips(); chips.scrollIntoView && chips.scrollIntoView({ block: 'nearest' }); say('Tous les types sont dans la palette du haut.'); } }, '＋ Autres types')));
  }

  function renderWarns(z) {
    let ul = panel.querySelector('[data-role=zone-warnings]');
    const w = warningsFor(z);
    if (!w.length) { if (ul) ul.remove(); return; }
    if (!ul) { ul = h('ul', { class: 'jd-warns', 'data-role': 'zone-warnings' }); panel.querySelector('[data-role=zone-actions]').before(ul); }
    ul.innerHTML = w.map((x) => `<li>${esc(x)}</li>`).join('');
  }

  function renderPanel(z) {
    panel.innerHTML = '';
    const t = getZoneType(z.type);
    const naming = st.naming === z.id;
    panel.classList.toggle('naming', naming);
    const nameIn = h('input', {
      class: 'jd-input', type: 'text', value: z.label, 'aria-label': 'Nom de la zone', 'data-role': 'zone-name', maxlength: '60',
      placeholder: 'ex. Massif bucolique devant la terrasse', enterkeyhint: 'done', autocomplete: 'off',
    });
    // détection d'un mot d'ambiance tapé dans le nom : proposée, jamais imposée
    const detEl = h('div', { class: 'jd-detect', 'data-role': 'ambiance-detected', hidden: true, role: 'status', 'aria-live': 'polite' });
    const commitName = () => { z.label = nameIn.value.trim() || t.label; };
    const refreshDetect = () => {
      const id = detectIn(nameIn.value);
      const a = id && id !== z.ambiance ? ambianceOf(id) : null;
      detEl.hidden = !a; detEl.textContent = '';
      if (a) {
        detEl.append(h('span', null, `Ambiance détectée : ${a.emoji} ${a.label}`),
          btn('Appliquer', 'apply-ambiance', () => { mutate(() => { commitName(); z.ambiance = id; }); }, 'primary'));
      }
    };
    nameIn.addEventListener('input', refreshDetect);
    nameIn.addEventListener('change', () => { mutate(() => { commitName(); }, true); refreshDetect(); });
    if (naming) nameIn.addEventListener('focus', () => { try { nameIn.select(); } catch { /* */ } });
    const typeSel = h('select', { class: 'jd-select', 'aria-label': 'Type de zone', 'data-role': 'zone-type' }, ZONE_TYPES.map((tt) => h('option', { value: tt.id, selected: tt.id === z.type }, `${tt.icon} ${tt.label}`)));
    typeSel.addEventListener('change', () => { mutate(() => { const old = getZoneType(z.type); if (z.label === old.label) z.label = getZoneType(typeSel.value).label; z.type = typeSel.value; }); });
    const nPl = (z.plantings || []).length;
    const setAmbiance = (id) => { mutate(() => { z.ambiance = id || null; }); };
    const ambField = h('div', { class: 'jd-field jd-amb', 'data-role': 'zone-ambiance-field' },
      h('div', { class: 'jd-flabel', id: 'jd-amb-label' }, 'Ambiance'),
      ambianceChips({ value: z.ambiance || null, none: 'Aucune', ariaLabel: 'Ambiance de la zone', dataRole: 'zone-ambiance', onPick: setAmbiance }));
    const nameHead = naming ? h('div', { class: 'jd-naming-head', 'data-role': 'naming' },
      h('label', { class: 'jd-flabel', for: 'jd-zone-name' }, 'Donnez-lui un nom'),
      h('div', { class: 'jd-hint' }, 'Le nom s’affiche sur le plan : ajoutez l’ambiance voulue pour vous y retrouver.')) : null;
    const nameSug = naming ? h('div', { class: 'jd-naming', 'data-role': 'naming-suggestions' },
      h('div', { class: 'jd-suggest-label', id: 'jd-sug-label' }, 'Touchez une ambiance pour l’ajouter au nom'),
      ambianceChips({
        mode: 'action', ariaLabel: 'Suggestions d’ambiance pour le nom', dataRole: 'name-suggestions',
        onPick: (id) => { mutate(() => { z.label = nameWithAmbiance(nameIn.value.trim() || z.label, id); z.ambiance = id; }); },
      })) : null;
    nameIn.id = 'jd-zone-name';
    panel.append(
      nameHead,
      h('div', { class: 'jd-zhead' }, h('span', { class: 'jd-zdot', style: { background: t.color } }, t.icon),
        naming ? h('div', { class: 'jd-zname' }, nameIn) : nameIn,
        btn('✕', 'deselect', () => select(null), '', { 'aria-label': 'Désélectionner' })),
      nameSug, detEl, ambField,
      h('div', { class: 'jd-row' }, typeSel),
      h('div', { class: 'jd-row jd-zfacts' },
        h('span', {}, 'Surface : ', h('b', { 'data-role': 'zone-area' }, frArea(shapeArea(z.shape)))),
        h('span', { 'data-role': 'zone-dims' }, dimsText(z)),
        h('span', { class: 'jd-muted', 'data-role': 'zone-plants' }, nPl ? `🌱 ${nPl} plante${nPl > 1 ? 's' : ''} choisie${nPl > 1 ? 's' : ''}` : 'Aucune plante choisie')),
      h('div', { class: 'jd-row jd-zacts', 'data-role': 'zone-actions' },
        btn('📏 Dimensions…', 'dims', () => openDimsPop(z)),
        btn('⧉ Dupliquer', 'duplicate', () => duplicate(z)),
        btn('🗑 Supprimer', 'delete-zone', () => remove(z), 'danger')));
    if (naming) nameIn.setAttribute('aria-describedby', 'jd-sug-label');
    refreshDetect();
    renderWarns(z);
    if (naming && st.focusName) {
      st.focusName = false;
      // pas de clavier intempestif sur mobile : focus automatique seulement avec un pointeur précis (souris)
      let fine = false;
      try { fine = !!(window.matchMedia && window.matchMedia('(pointer: fine)').matches); } catch { /* */ }
      if (fine) setTimeout(() => { if (!destroyed) nameIn.focus({ preventScroll: true }); }, 0);
      setTimeout(() => { if (!destroyed && panel.scrollIntoView) { try { panel.scrollIntoView({ block: 'nearest' }); } catch { /* */ } } }, 0);
    }
  }

  function duplicate(z) {
    mutate(() => {
      const c = createZone(z.type, translateShape(z.shape, 0.5, 0.5));
      c.label = `${z.label} (copie)`; c.notes = z.notes || '';
      if (z.ambiance) c.ambiance = z.ambiance;
      g.zones.push(c);
      st.sel = c.id;
      st.msg = `Copie « ${c.label} » posée en décalé : glissez-la à sa place.`;
    });
  }
  function remove(z) {
    mutate(() => { g.zones = g.zones.filter((q) => q.id !== z.id); st.sel = null; st.msg = `Zone « ${z.label} » supprimée. Touchez ↶ pour la retrouver.`; });
  }

  draw(); refreshUI();
  requestAnimationFrame(() => { if (!destroyed) fitView(); });
  setTimeout(() => { if (!destroyed) fitView(); }, 60);

  return function unmount() { destroyed = true; if (north) north.destroy(); cv.destroy(); el.innerHTML = ''; };
}
