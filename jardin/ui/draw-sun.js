// Éditeur d'ensoleillement : niveau unique, ou carte peinte au pinceau / en polygones (3 niveaux).
import { shapePolygon, bounds, polygonArea, pointInPolygon, distance } from '../geometry.js';
import { newId, SUN_LABELS } from '../model.js';
import { estimateSunMap } from '../sun.js';
import {
  injectStyles, h, createCanvas, gridPath, clone, fr,
} from './draw-util.js';
import { attachNorthBadge } from './north-pop.js';

const NS = 'vector-effect="non-scaling-stroke"';
const COLORS = { full: '#ffc107', partial: '#ff8f00', shade: '#5c6bc0' };
const SHORT = { full: '☀ Plein soleil', partial: '⛅ Mi-ombre', shade: '☁ Ombre' };
const LEVELS = ['full', 'partial', 'shade'];

export function mountSunPainter(el, { garden, onChange } = {}) {
  injectStyles();
  const g = garden;
  g.sun = g.sun || { mode: 'unknown', uniform: null, regions: [] };
  g.sun.regions = g.sun.regions || [];
  const st = { level: 'full', tool: 'brush', size: 2, stroke: null, poly: [], history: [], future: [], msg: '' };
  let destroyed = false;
  let north = null; // pastille du nord

  const snap0 = () => clone(g.sun);
  const changed = () => { if (onChange) onChange(g); draw(); refreshUI(); };
  const mutate = (fn) => { st.history.push(snap0()); if (st.history.length > 100) st.history.shift(); st.future = []; fn(); changed(); };
  const undo = () => { if (!st.history.length) return; st.future.push(snap0()); g.sun = st.history.pop(); changed(); };
  const redo = () => { if (!st.future.length) return; st.history.push(snap0()); g.sun = st.future.pop(); changed(); };

  const root = h('div', { class: 'jd jd-editor', 'data-role': 'sun-painter' });
  const modes = h('div', { class: 'jd-bar jd-scroll' });
  const tools = h('div', { class: 'jd-bar jd-scroll' });
  const wrap = h('div', { class: 'jd-canvas-wrap' });
  const legend = h('div', { class: 'jd-legend' });
  const msgEl = h('div', { class: 'jd-msg', role: 'status', 'aria-live': 'polite' });
  root.append(modes, tools, wrap, legend, msgEl);
  el.innerHTML = '';
  el.appendChild(root);

  const btn = (label, act, onclick, cls = '', extra = {}) => h('button', { type: 'button', class: `jd-btn ${cls}`, 'data-act': act, onclick, ...extra }, label);

  const setMode = (m) => {
    mutate(() => {
      g.sun.mode = m;
      if (m === 'uniform' && !g.sun.uniform) g.sun.uniform = 'full';
      if (m === 'unknown') g.sun.uniform = null;
    });
  };

  const gGrid = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const gMain = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const cv = createCanvas(wrap, { onView: () => draw(), handlers: { down: onDown, tap: onTap } });
  cv.svg.append(gGrid, gMain);
  north = attachNorthBadge(wrap, { garden: g, onChange: () => { if (onChange) onChange(g); } });
  cv.svg.setAttribute('aria-label', 'Carte d\'ensoleillement');
  const fitView = () => { if (g.boundary && g.boundary.length >= 3) cv.fit(bounds(g.boundary), 1.25); else { cv.view.cx = 5; cv.view.cy = 4; cv.view.mpp = 0.04; cv.apply(); } };

  const inside = (p) => !(g.boundary && g.boundary.length >= 3) || pointInPolygon(p, g.boundary);

  function onDown(w) {
    if (g.sun.mode !== 'map' || st.tool !== 'brush') return null;
    st.stroke = [w];
    return {
      move(p) { st.stroke.push(p); draw(); },
      up(p, e, moved) { const pts = st.stroke; st.stroke = null; commitStroke(moved ? pts : [pts[0], { x: pts[0].x + 0.01, y: pts[0].y }]); },
      cancel() { st.stroke = null; draw(); },
    };
  }
  function commitStroke(pts) {
    const shape = { kind: 'line', points: pts.map((p) => ({ x: p.x, y: p.y })), width: st.size };
    const points = shapePolygon(shape, 12);
    if (points.length < 3) { draw(); return; }
    mutate(() => { g.sun.regions.push({ id: newId('s_'), level: st.level, points }); });
  }
  function onTap(w) {
    if (g.sun.mode !== 'map') return;
    if (st.tool === 'polygon') {
      // toucher le 1er point (≥ 3 points) = fermer la forme
      if (st.poly.length >= 3 && distance(w, st.poly[0]) <= cv.px(24)) { finishPoly(); return; }
      st.poly.push(w); draw(); refreshUI(); return;
    }
    if (st.tool === 'erase') {
      for (let i = g.sun.regions.length - 1; i >= 0; i--) {
        if (pointInPolygon(w, g.sun.regions[i].points)) { mutate(() => { g.sun.regions.splice(i, 1); }); return; }
      }
    }
  }
  function finishPoly() {
    if (st.poly.length < 3) { st.msg = 'Il faut au moins 3 points.'; refreshUI(); return; }
    const pts = st.poly; st.poly = [];
    mutate(() => { g.sun.regions.push({ id: newId('s_'), level: st.level, points: pts }); });
  }
  function estimate() {
    const loc = g.context && g.context.location;
    if (!loc || !g.boundary || g.boundary.length < 3) { st.msg = 'Estimation impossible : localisation ou contour manquant.'; refreshUI(); return; }
    try {
      const y = new Date().getFullYear();
      const regions = estimateSunMap(g, { date: new Date(y, 5, 21, 12) });
      mutate(() => { g.sun.mode = 'map'; g.sun.regions = regions.map((r) => ({ id: newId('s_'), level: r.level, points: r.points })); });
      st.msg = 'Estimation d\'été : approximative, retouchez-la à la main. L\'ombre des voisins n\'est pas connue.';
      refreshUI();
    } catch (e) { st.msg = 'Estimation impossible.'; refreshUI(); }
  }

  const poly = (pts) => pts.map((p) => `${p.x},${p.y}`).join(' ');
  function draw() {
    if (destroyed) return;
    if (north) north.update();
    const r = cv.svg.getBoundingClientRect();
    const gp = gridPath(cv.view, { width: r.width || 390, height: r.height || 520 });
    gGrid.innerHTML = `<path d="${gp.minor}" stroke="var(--jd-grid,#e3e3da)" fill="none" ${NS}/><path d="${gp.major}" stroke="var(--jd-line,#cfcfc4)" fill="none" ${NS}/>`;
    let s = '';
    const b = g.boundary || [];
    if (b.length >= 3) {
      const uni = g.sun.mode === 'uniform' && g.sun.uniform;
      s += `<polygon points="${poly(b)}" fill="${uni ? COLORS[g.sun.uniform] : '#fff'}" fill-opacity="${uni ? 0.5 : 0.35}" stroke="var(--jd-fg,#222)" stroke-width="2.5" ${NS}/>`;
    }
    if (g.sun.mode === 'map') {
      const clip = b.length >= 3 ? `<clipPath id="jd-sun-clip"><polygon points="${poly(b)}"/></clipPath>` : '';
      s += clip + `<g${clip ? ' clip-path="url(#jd-sun-clip)"' : ''}>`;
      for (const rg of g.sun.regions) s += `<polygon points="${poly(rg.points)}" fill="${COLORS[rg.level]}" fill-opacity=".55" stroke="${COLORS[rg.level]}" stroke-width="1" ${NS}/>`;
      if (st.stroke && st.stroke.length) s += `<polyline points="${poly(st.stroke)}" fill="none" stroke="${COLORS[st.level]}" stroke-opacity=".6" stroke-width="${st.size}" stroke-linecap="round" stroke-linejoin="round"/>`;
      s += '</g>';
      if (st.poly.length) {
        s += `<polyline points="${poly(st.poly)}" fill="none" stroke="${COLORS[st.level]}" stroke-width="3" stroke-dasharray="6 4" ${NS}/>`;
        st.poly.forEach((p, i) => { s += (i === 0 && st.poly.length >= 3) ? `<circle cx="${p.x}" cy="${p.y}" r="${cv.px(15)}" fill="#2e7d32" stroke="#fff" stroke-width="3" ${NS}/>` : `<circle cx="${p.x}" cy="${p.y}" r="${cv.px(8)}" fill="${COLORS[st.level]}" stroke="#fff" stroke-width="2" ${NS}/>`; });
      }
    }
    gMain.innerHTML = s;
  }

  function refreshUI() {
    if (destroyed) return;
    const mode = g.sun.mode;
    modes.innerHTML = '';
    modes.append(
      btn('❔ Non renseigné', 'mode-unknown', () => setMode('unknown'), '', { 'aria-pressed': String(mode === 'unknown') }),
      btn('☀ Un seul niveau', 'mode-uniform', () => setMode('uniform'), '', { 'aria-pressed': String(mode === 'uniform') }),
      btn('🖌 Carte détaillée', 'mode-map', () => setMode('map'), '', { 'aria-pressed': String(mode === 'map') }),
    );
    tools.innerHTML = '';
    if (mode === 'uniform') {
      LEVELS.forEach((l) => tools.append(btn(SHORT[l], `uniform-${l}`, () => mutate(() => { g.sun.uniform = l; }), '', { 'aria-pressed': String(g.sun.uniform === l) })));
    } else if (mode === 'map') {
      LEVELS.forEach((l) => tools.append(btn(SHORT[l], `level-${l}`, () => { st.level = l; st.tool = st.tool === 'erase' ? 'brush' : st.tool; refreshUI(); draw(); }, '', { 'aria-pressed': String(st.level === l && st.tool !== 'erase'), style: { borderColor: COLORS[l] } })));
      tools.append(
        btn('🖌 Pinceau', 'tool-brush', () => { st.tool = 'brush'; st.poly = []; refreshUI(); draw(); }, '', { 'aria-pressed': String(st.tool === 'brush') }),
        btn('⬠ Polygone', 'tool-polygon', () => { st.tool = 'polygon'; refreshUI(); }, '', { 'aria-pressed': String(st.tool === 'polygon') }),
        btn('🧽 Gomme', 'tool-erase', () => { st.tool = 'erase'; st.poly = []; refreshUI(); draw(); }, '', { 'aria-pressed': String(st.tool === 'erase') }),
      );
      if (st.tool === 'brush') {
        const sz = h('input', { type: 'range', min: '0.5', max: '6', step: '0.5', value: String(st.size), 'aria-label': 'Taille du pinceau', style: { width: '120px', height: '44px' } });
        sz.addEventListener('input', () => { st.size = parseFloat(sz.value); lab.textContent = `${fr(st.size, 1)} m`; });
        const lab = h('span', {}, `${fr(st.size, 1)} m`);
        tools.append(sz, lab);
      }
      if (st.tool === 'polygon') tools.append(btn('✔ Terminer', 'poly-done', finishPoly, 'primary', { disabled: st.poly.length < 3 }), btn('Annuler', 'poly-cancel', () => { st.poly = []; draw(); refreshUI(); }));
      tools.append(
        btn('↶', 'undo', undo, '', { disabled: !st.history.length, 'aria-label': 'Annuler' }),
        btn('↷', 'redo', redo, '', { disabled: !st.future.length, 'aria-label': 'Rétablir' }),
        btn('🗑 Tout', 'clear', () => mutate(() => { g.sun.regions = []; }), 'danger', { disabled: !g.sun.regions.length }),
        btn('✨ Estimer', 'estimate', estimate),
      );
    } else {
      tools.append(h('span', { class: 'jd-msg' }, 'Aucune essence ne sera exclue sur ce critère, mais un avertissement s\'affichera.'));
    }
    tools.append(
      btn('－', 'zoom-out', () => cv.zoomCenter(1 / 1.4), '', { 'aria-label': 'Zoom arrière' }),
      btn('＋', 'zoom-in', () => cv.zoomCenter(1.4), '', { 'aria-label': 'Zoom avant' }),
      btn('⤢', 'fit', fitView, '', { 'aria-label': 'Recentrer' }),
    );
    legend.innerHTML = '';
    const area = {};
    for (const rg of g.sun.regions) area[rg.level] = (area[rg.level] || 0) + polygonArea(rg.points);
    LEVELS.forEach((l) => legend.append(h('span', {}, h('i', { style: { background: COLORS[l] } }), `${SUN_LABELS[l]}${mode === 'map' && area[l] ? ` · ≈ ${fr(area[l], 0)} m²` : ''}`)));
    msgEl.textContent = st.msg || (mode === 'map' ? (st.tool === 'brush' ? 'Peignez au doigt ; pincez ou utilisez deux doigts pour déplacer et zoomer.' : st.tool === 'polygon' ? 'Touchez les angles de la zone ; touchez le 1er point (vert) pour fermer la forme.' : 'Touchez une zone peinte pour l\'effacer.') : '');
  }

  draw(); refreshUI();
  requestAnimationFrame(() => { if (!destroyed) fitView(); });
  setTimeout(() => { if (!destroyed) fitView(); }, 60);
  void inside;
  return function unmount() { destroyed = true; if (north) north.destroy(); cv.destroy(); el.innerHTML = ''; };
}
