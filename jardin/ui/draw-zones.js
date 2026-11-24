// Éditeur de zones : palette des types, tracé polygone / cercle / ligne, déplacement, poignées, avertissements.
import {
  distance, shapePolygon, shapeArea, shapeBounds, bounds, overlapArea, polygonInside, pointInPolygon, centroid,
} from '../geometry.js';
import { ZONE_TYPES, getZoneType, createZone } from '../model.js';
import {
  injectStyles, h, createCanvas, gridPath, snap, clone, esc, fr, frArea, parseNum,
} from './draw-util.js';

const NS = 'vector-effect="non-scaling-stroke"';
const KIND_LABELS = { polygon: '⬠ Polygone', circle: '◯ Cercle', line: '〰 Ligne' };
const GRIDS = [0.5, 0.1, 1, 0];

export function mountZoneEditor(el, { garden, onChange } = {}) {
  injectStyles();
  const g = garden;
  g.zones = g.zones || [];
  g.boundary = g.boundary || [];
  const st = {
    typeId: null, kind: null, drawing: null, sel: null, gridIdx: 0, allTypes: false, history: [], future: [], msg: '',
  };
  let destroyed = false;

  const snap0 = () => clone(g.zones);
  const changed = () => { if (onChange) onChange(g); draw(); refreshUI(); };
  const mutate = (fn) => { st.history.push(snap0()); if (st.history.length > 100) st.history.shift(); st.future = []; fn(); changed(); };
  const undo = () => { if (!st.history.length) return; st.future.push(snap0()); g.zones = st.history.pop(); if (!zoneById(st.sel)) st.sel = null; changed(); };
  const redo = () => { if (!st.future.length) return; st.history.push(snap0()); g.zones = st.future.pop(); if (!zoneById(st.sel)) st.sel = null; changed(); };
  const zoneById = (id) => g.zones.find((z) => z.id === id);
  const gridSize = () => GRIDS[st.gridIdx];

  const root = h('div', { class: 'jd jd-editor', 'data-role': 'zone-editor' });
  const barTop = h('div', { class: 'jd-bar jd-scroll' });
  const chips = h('div', { class: 'jd-chips', 'data-role': 'palette', role: 'toolbar', 'aria-label': 'Types de zones' });
  const kindBar = h('div', { class: 'jd-bar jd-scroll', hidden: true });
  const wrap = h('div', { class: 'jd-canvas-wrap' });
  const info = h('div', { class: 'jd-info' });
  const panel = h('div', { class: 'jd-panel', hidden: true, 'data-role': 'zone-panel' });
  const msgEl = h('div', { class: 'jd-msg', role: 'status', 'aria-live': 'polite' });
  root.append(barTop, chips, kindBar, wrap, info, msgEl, panel);
  el.innerHTML = '';
  el.appendChild(root);

  const btn = (label, act, onclick, cls = '', extra = {}) => h('button', { type: 'button', class: `jd-btn ${cls}`, 'data-act': act, onclick, ...extra }, label);
  const bUndo = btn('↶', 'undo', undo, '', { 'aria-label': 'Annuler' });
  const bRedo = btn('↷', 'redo', redo, '', { 'aria-label': 'Rétablir' });
  const bGrid = btn('', 'grid', () => { st.gridIdx = (st.gridIdx + 1) % GRIDS.length; refreshUI(); });
  const bSelect = btn('☝ Sélection', 'select-mode', () => { stopDrawing(); st.typeId = null; refreshUI(); draw(); });
  barTop.append(bUndo, bRedo, bSelect, bGrid,
    btn('－', 'zoom-out', () => cv.zoomCenter(1 / 1.4), '', { 'aria-label': 'Zoom arrière' }),
    btn('＋', 'zoom-in', () => cv.zoomCenter(1.4), '', { 'aria-label': 'Zoom avant' }),
    btn('⤢', 'fit', () => fitView(), '', { 'aria-label': 'Recentrer' }));

  const gGrid = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const gMain = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const gTop = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const cv = createCanvas(wrap, { onView: () => draw(), handlers: { down: onDown, tap: onTap, hover: onHover } });
  cv.svg.append(gGrid, gMain, gTop);
  cv.svg.setAttribute('aria-label', 'Plan des zones');

  const fitView = () => {
    const pts = [...g.boundary];
    g.zones.forEach((z) => { const b = shapeBounds(z.shape); if (b && Number.isFinite(b.minX)) pts.push({ x: b.minX, y: b.minY }, { x: b.maxX, y: b.maxY }); });
    if (pts.length >= 2) cv.fit(bounds(pts), 1.25); else { cv.view.cx = 5; cv.view.cy = 4; cv.view.mpp = 0.04; cv.apply(); }
  };

  // ---------- helpers de forme ----------
  const polyOf = (z) => shapePolygon(z.shape, 48);
  const allVerts = () => {
    const v = [...g.boundary];
    g.zones.forEach((z) => { if (z.shape.points) v.push(...z.shape.points); });
    return v;
  };
  const snapAt = (w, exclude = []) => {
    const tol = cv.px(14);
    const pts = allVerts().filter((p) => !exclude.includes(p));
    return snap(w, { grid: gridSize(), points: pts, tolerance: tol }).p;
  };
  const stopDrawing = () => { st.drawing = null; };
  const defaultRadius = (typeId) => (typeId === 'trees' || typeId === 'orchard' ? 2 : typeId === 'pond' || typeId === 'pool' ? 1.5 : 1.2);

  function hitZone(w) {
    const order = [...g.zones].sort((a, b) => ((getZoneType(a.type) || {}).layer === 'canopy') - ((getZoneType(b.type) || {}).layer === 'canopy'));
    for (let i = order.length - 1; i >= 0; i--) {
      const z = order[i];
      if (z.shape.kind === 'line') {
        const pts = z.shape.points;
        for (let k = 0; k < pts.length - 1; k++) {
          const a = pts[k]; const b = pts[k + 1];
          const L2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1;
          const t = Math.max(0, Math.min(1, ((w.x - a.x) * (b.x - a.x) + (w.y - a.y) * (b.y - a.y)) / L2));
          if (distance(w, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }) <= Math.max(z.shape.width / 2, cv.px(16))) return z;
        }
      } else if (pointInPolygon(w, polyOf(z))) return z;
    }
    return null;
  }

  // poignées de la zone sélectionnée : [{id, p, kind}]
  function handlesOf(z) {
    const s = z.shape;
    if (s.kind === 'circle') return [{ id: 'c', p: s.center, kind: 'center' }, { id: 'r', p: { x: s.center.x + s.radius, y: s.center.y }, kind: 'radius' }];
    return s.points.map((p, i) => ({ id: i, p, kind: 'vertex' }));
  }
  const translateShape = (s0, dx, dy) => {
    const s = clone(s0);
    if (s.center) s.center = { x: s.center.x + dx, y: s.center.y + dy };
    if (s.points) s.points = s.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    return s;
  };

  // ---------- gestes ----------
  function onDown(w) {
    if (st.drawing || st.typeId) {
      if (st.kind === 'circle') return circleDraw(w);
      return null;
    }
    const z = zoneById(st.sel);
    if (z) {
      const hr = cv.px(24);
      const hd = handlesOf(z).find((hd0) => distance(hd0.p, w) <= hr);
      if (hd) return handleDrag(z, hd);
    }
    const hit = hitZone(w);
    if (hit) { st.sel = hit.id; draw(); refreshUI(); return bodyDrag(hit, w); }
    return null;
  }

  function circleDraw(w0) {
    const c = snapAt(w0);
    st.drawing = { kind: 'circle', center: c, radius: 0.01 };
    return {
      move(w) { st.drawing.radius = Math.max(0.1, Math.round(distance(c, snapAt(w)) * 100) / 100); draw(); },
      up(w, e, moved) {
        const r = moved ? st.drawing.radius : defaultRadius(st.typeId);
        st.drawing = null;
        addZone({ kind: 'circle', center: c, radius: Math.max(0.2, r) });
      },
      cancel() { st.drawing = null; draw(); },
    };
  }

  function handleDrag(z, hd) {
    const before = snap0();
    let moved = false;
    return {
      move(w) {
        moved = true;
        const s = z.shape;
        if (hd.kind === 'center') s.center = snapAt(w);
        else if (hd.kind === 'radius') s.radius = Math.max(0.2, Math.round(distance(s.center, snapAt(w)) * 100) / 100);
        else s.points[hd.id] = snapAt(w, [s.points[hd.id]]);
        if (onChange) onChange(g);
        draw(); refreshUI(true);
      },
      up(w, e, didMove) { if (didMove && moved) { st.history.push(before); st.future = []; } changed(); },
      cancel() { g.zones = before; changed(); },
    };
  }

  function bodyDrag(z, start) {
    const before = snap0();
    const s0 = clone(z.shape);
    let moved = false;
    return {
      move(w) {
        moved = true;
        let dx = w.x - start.x; let dy = w.y - start.y;
        const gs = gridSize();
        if (gs) { dx = Math.round(dx / gs) * gs; dy = Math.round(dy / gs) * gs; }
        z.shape = translateShape(s0, dx, dy);
        if (onChange) onChange(g);
        draw(); refreshUI(true);
      },
      up(w, e, didMove) { if (didMove && moved) { st.history.push(before); st.future = []; } changed(); },
      cancel() { g.zones = before; changed(); },
    };
  }

  function onTap(w) {
    if (st.typeId && st.kind && st.kind !== 'circle') {
      const p = snapAt(w);
      if (!st.drawing) st.drawing = { kind: st.kind, points: [] };
      const pts = st.drawing.points;
      if (st.kind === 'polygon' && pts.length >= 3 && distance(p, pts[0]) <= cv.px(18)) { finishDrawing(); return; }
      if (pts.length && distance(pts[pts.length - 1], p) < 1e-6) return;
      pts.push(p);
      draw(); refreshUI();
      return;
    }
    if (st.typeId) return; // cercle : géré au toucher
    st.sel = null; draw(); refreshUI();
  }
  function onHover(w) {
    if (st.drawing && st.drawing.points) { st.ghost = snapAt(w); drawTop(); }
  }

  function finishDrawing() {
    const d = st.drawing;
    if (!d) return;
    const min = d.kind === 'line' ? 2 : 3;
    if (d.points.length < min) { st.msg = `Il faut au moins ${min} points.`; refreshUI(); return; }
    const t = getZoneType(st.typeId);
    const shape = d.kind === 'line'
      ? { kind: 'line', points: d.points, width: (t && t.defaultWidth) || 1 }
      : { kind: 'polygon', points: d.points };
    st.drawing = null;
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
      st.sel = z.id;
      st.typeId = null; st.kind = null;
      st.msg = `Zone « ${z.label} » ajoutée (${frArea(shapeArea(shape))}).`;
    });
  }

  // ---------- avertissements ----------
  function warningsFor(z) {
    const out = [];
    const t = getZoneType(z.type);
    const pa = polyOf(z);
    if (t && t.layer === 'ground') {
      for (const o of g.zones) {
        if (o === z) continue;
        const to = getZoneType(o.type);
        if (!to || to.layer !== 'ground') continue;
        const a = overlapArea(pa, polyOf(o));
        if (a > 0.1) out.push(`Chevauche « ${o.label} » sur environ ${frArea(a)}. Deux zones au sol ne peuvent pas occuper le même endroit.`);
      }
    }
    if (g.boundary.length >= 3 && g.boundaryClosed && !polygonInside(pa, g.boundary)) out.push('Dépasse du contour du terrain.');
    return out;
  }
  const overlapCount = () => {
    let n = 0;
    const ground = g.zones.filter((z) => (getZoneType(z.type) || {}).layer === 'ground');
    for (let i = 0; i < ground.length; i++) for (let j = i + 1; j < ground.length; j++) if (overlapArea(polyOf(ground[i]), polyOf(ground[j])) > 0.1) n++;
    return n;
  };

  // ---------- dessin ----------
  const poly = (pts) => pts.map((p) => `${p.x},${p.y}`).join(' ');
  function draw() {
    if (destroyed) return;
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
    for (const z of order) {
      const t = getZoneType(z.type); if (!t) continue;
      const pl = polyOf(z); if (pl.length < 3) continue;
      const selected = z.id === st.sel;
      const canopy = t.layer === 'canopy';
      s += `<polygon points="${poly(pl)}" fill="${t.color}" fill-opacity="${canopy ? 0.35 : 0.6}" stroke="${selected ? '#d81b60' : 'rgba(0,0,0,.55)'}" stroke-width="${selected ? 3 : 1.5}"${canopy ? ' stroke-dasharray="6 3"' : ''} stroke-linejoin="round" ${NS}/>`;
      const c = centroid(pl);
      s += `<text x="${c.x}" y="${c.y}" font-size="${fs}" font-weight="700" text-anchor="middle" fill="#14210f" stroke="#fff" stroke-width="${fs * 0.22}" paint-order="stroke">${t.icon} ${esc(z.label)}</text>`;
      s += `<text x="${c.x}" y="${c.y + fs * 1.3}" font-size="${fs * 0.9}" text-anchor="middle" fill="#14210f" stroke="#fff" stroke-width="${fs * 0.2}" paint-order="stroke">${fr(shapeArea(z.shape), 1)} m²</text>`;
    }
    const sel = zoneById(st.sel);
    if (sel && !st.typeId) {
      for (const hd of handlesOf(sel)) {
        s += `<circle cx="${hd.p.x}" cy="${hd.p.y}" r="${cv.px(hd.kind === 'radius' ? 11 : 10)}" fill="${hd.kind === 'radius' ? '#ffb300' : '#fff'}" stroke="#d81b60" stroke-width="2.5" ${NS}/>`;
      }
    }
    gMain.innerHTML = s;
    drawTop();
  }
  function drawTop() {
    if (destroyed) return;
    const d = st.drawing; let s = '';
    const t = getZoneType(st.typeId);
    const col = (t && t.color) || '#2e7d32';
    if (d && d.kind === 'circle') s += `<circle cx="${d.center.x}" cy="${d.center.y}" r="${d.radius}" fill="${col}" fill-opacity=".4" stroke="#d81b60" stroke-width="2" stroke-dasharray="5 3" ${NS}/><line x1="${d.center.x}" y1="${d.center.y}" x2="${d.center.x + d.radius}" y2="${d.center.y}" stroke="#d81b60" ${NS}/><text x="${d.center.x}" y="${d.center.y}" font-size="${cv.px(13)}" text-anchor="middle" fill="#14210f" stroke="#fff" stroke-width="${cv.px(3)}" paint-order="stroke">r = ${fr(d.radius)} m</text>`;
    if (d && d.points && d.points.length) {
      const pts = st.ghost ? [...d.points, st.ghost] : d.points;
      s += d.kind === 'polygon' && pts.length >= 3
        ? `<polygon points="${poly(pts)}" fill="${col}" fill-opacity=".3" stroke="#d81b60" stroke-width="2" stroke-dasharray="6 4" ${NS}/>`
        : `<polyline points="${poly(pts)}" fill="none" stroke="#d81b60" stroke-width="${d.kind === 'line' ? 3 : 2}" stroke-dasharray="6 4" ${NS}/>`;
      d.points.forEach((p, i) => { s += `<circle cx="${p.x}" cy="${p.y}" r="${cv.px(i === 0 ? 12 : 8)}" fill="${i === 0 ? '#d81b60' : '#fff'}" stroke="#d81b60" stroke-width="2" ${NS}/>`; });
    }
    gTop.innerHTML = s;
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
    const chip = (t) => {
      const has = g.zones.some((z) => z.type === t.id);
      const c = h('button', {
        type: 'button', class: `jd-chip${has ? ' done' : ''}`, style: { '--chip': t.color }, 'data-type': t.id,
        'aria-pressed': String(st.typeId === t.id), onclick: () => chooseType(t.id),
      }, `${t.icon} ${t.label}`);
      return c;
    };
    wished.forEach((t) => chips.append(chip(t)));
    if (st.allTypes || !wished.length) rest.forEach((t) => chips.append(chip(t)));
    if (wished.length) chips.append(h('button', { type: 'button', class: 'jd-chip', 'data-act': 'toggle-all', onclick: () => { st.allTypes = !st.allTypes; refreshChips(); } }, st.allTypes ? '− Masquer les autres' : '＋ Tous les types'));
  }
  function chooseType(id) {
    const t = getZoneType(id);
    st.drawing = null; st.sel = null;
    if (st.typeId === id) { st.typeId = null; st.kind = null; }
    else { st.typeId = id; st.kind = t.shapeKinds[0]; }
    refreshUI(); draw();
  }

  function refreshUI(light = false) {
    if (destroyed) return;
    bUndo.disabled = !st.history.length;
    bRedo.disabled = !st.future.length;
    bGrid.textContent = gridSize() ? `▦ ${fr(gridSize(), 1)} m` : '▦ off';
    bSelect.setAttribute('aria-pressed', String(!st.typeId));
    if (!light) refreshChips();
    // choix de forme + terminer
    const t = getZoneType(st.typeId);
    kindBar.hidden = !t;
    if (t && !light) {
      kindBar.innerHTML = '';
      if (t.shapeKinds.length > 1) t.shapeKinds.forEach((k) => kindBar.append(btn(KIND_LABELS[k] || k, `kind-${k}`, () => { st.kind = k; st.drawing = null; refreshUI(); draw(); }, '', { 'aria-pressed': String(st.kind === k) })));
      if (st.kind !== 'circle') {
        const d = st.drawing;
        const n = d && d.points ? d.points.length : 0;
        kindBar.append(btn('✔ Terminer', 'finish', finishDrawing, 'primary', { disabled: n < (st.kind === 'line' ? 2 : 3) }));
        kindBar.append(btn('Annuler le tracé', 'cancel-draw', () => { st.drawing = null; st.ghost = null; draw(); refreshUI(); }, '', { disabled: !n }));
      }
      kindBar.append(h('span', { class: 'jd-msg' }, st.kind === 'circle' ? 'Touchez le centre puis glissez pour fixer le rayon.' : st.kind === 'line' ? 'Touchez chaque point de la ligne puis « Terminer ».' : 'Touchez chaque angle puis « Terminer » (ou le 1er point).'));
    }
    const ov = overlapCount();
    const wished = (g.wishedZoneTypes || []).filter((id) => !g.zones.some((z) => z.type === id));
    info.innerHTML = `<span><b data-role="zone-count">${g.zones.length}</b> zone${g.zones.length > 1 ? 's' : ''}</span>`
      + (ov ? `<span class="jd-msg warn" style="padding:0">⚠ ${ov} chevauchement${ov > 1 ? 's' : ''}</span>` : '')
      + (wished.length ? `<span class="jd-msg" style="padding:0">À dessiner : ${wished.map((id) => (getZoneType(id) || { label: id }).label).join(', ')}</span>` : '');
    msgEl.textContent = st.msg || (!g.zones.length && !st.typeId ? 'Choisissez un type de zone puis dessinez-la sur le plan.' : '');
    // panneau de la zone
    const z = zoneById(st.sel);
    panel.hidden = !z || !!st.typeId;
    if (z && !st.typeId) {
      if (light) {
        const a = panel.querySelector('[data-role=zone-area]');
        if (a) a.textContent = frArea(shapeArea(z.shape));
      } else renderPanel(z);
    }
  }

  function renderPanel(z) {
    panel.innerHTML = '';
    const t = getZoneType(z.type);
    const nameIn = h('input', { class: 'jd-input', type: 'text', value: z.label, 'aria-label': 'Nom de la zone', 'data-role': 'zone-name', maxlength: '60' });
    nameIn.addEventListener('change', () => { mutate(() => { z.label = nameIn.value.trim() || t.label; }); });
    const typeSel = h('select', { class: 'jd-select', 'aria-label': 'Type de zone', 'data-role': 'zone-type' }, ZONE_TYPES.map((tt) => h('option', { value: tt.id, selected: tt.id === z.type }, `${tt.icon} ${tt.label}`)));
    typeSel.addEventListener('change', () => { mutate(() => { const old = getZoneType(z.type); if (z.label === old.label) z.label = getZoneType(typeSel.value).label; z.type = typeSel.value; }); });
    panel.append(h('div', { class: 'jd-row' }, nameIn), h('div', { class: 'jd-row' }, typeSel));
    const extras = [h('span', {}, 'Surface : ', h('b', { 'data-role': 'zone-area' }, frArea(shapeArea(z.shape))))];
    if (z.shape.kind === 'circle') {
      const rin = h('input', { class: 'jd-input sm', type: 'text', inputmode: 'decimal', value: fr(z.shape.radius), 'aria-label': 'Rayon en mètres' });
      rin.addEventListener('change', () => { const v = parseNum(rin.value); if (v > 0.1) mutate(() => { z.shape.radius = v; }); });
      extras.push(h('label', {}, 'Rayon (m)'), rin);
    }
    if (z.shape.kind === 'line') {
      const win = h('input', { class: 'jd-input sm', type: 'text', inputmode: 'decimal', value: fr(z.shape.width), 'aria-label': 'Largeur en mètres' });
      win.addEventListener('change', () => { const v = parseNum(win.value); if (v > 0.05) mutate(() => { z.shape.width = v; }); });
      extras.push(h('label', {}, 'Largeur (m)'), win);
    }
    panel.append(h('div', { class: 'jd-row' }, extras));
    const w = warningsFor(z);
    if (w.length) panel.append(h('ul', { class: 'jd-warns', 'data-role': 'zone-warnings' }, w.map((x) => h('li', {}, x))));
    panel.append(h('div', { class: 'jd-row' },
      btn('Désélectionner', 'deselect', () => { st.sel = null; draw(); refreshUI(); }),
      btn('🗑 Supprimer la zone', 'delete-zone', () => mutate(() => { g.zones = g.zones.filter((q) => q.id !== z.id); st.sel = null; }), 'danger')));
  }

  draw(); refreshUI();
  requestAnimationFrame(() => { if (!destroyed) fitView(); });
  setTimeout(() => { if (!destroyed) fitView(); }, 60);

  return function unmount() { destroyed = true; cv.destroy(); el.innerHTML = ''; };
}
