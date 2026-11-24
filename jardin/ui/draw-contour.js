// Éditeur du contour du terrain : tracé tactile métré, côtés éditables, obstacles, relevé GPS.
import {
  distance, polygonArea, perimeter, isSimplePolygon, pointInPolygon, bounds, pointFromLengthBearing, bearing,
  closeGapReport, gpsToLocal, centroid, signedArea,
} from '../geometry.js';
import { newId } from '../model.js';
import { getPosition } from '../geo.js';
import {
  injectStyles, h, createCanvas, gridPath, snap, clone, esc, fr, frLen, frArea, parseNum,
} from './draw-util.js';

const OBSTACLE_KINDS = [
  { id: 'house', label: 'Maison', height: 6, poly: true },
  { id: 'shed', label: 'Abri', height: 2.5, poly: true },
  { id: 'wall', label: 'Mur', height: 2, poly: false },
  { id: 'fence', label: 'Clôture', height: 1.2, poly: false },
  { id: 'tree', label: 'Arbre existant', height: 8, poly: false },
];
const kindLabel = (k) => (OBSTACLE_KINDS.find((o) => o.id === k) || { label: k }).label;
const GRIDS = [0.5, 0.1, 1, 0];
const NS = 'vector-effect="non-scaling-stroke"';

export function mountContourEditor(el, { garden, onChange } = {}) {
  injectStyles();
  const g = garden;
  g.boundary = g.boundary || [];
  g.obstacles = g.obstacles || [];
  g.context = g.context || {};

  const st = {
    tool: 'draw', gridIdx: 0, ortho: true, magnet: true, sheet: false,
    sel: null, selObstacle: null, ghost: null, history: [], future: [],
    draft: null, // obstacle en cours {kind, points}
    rect: true, closePrompt: null, msg: '', msgKind: '', fix: null, live: null, liveOn: false, busy: false,
    obstacleKind: 'house',
  };
  let timer = null;
  let destroyed = false;

  const snapshot = () => clone({ boundary: g.boundary, boundaryClosed: !!g.boundaryClosed, obstacles: g.obstacles });
  const restore = (s) => { g.boundary = clone(s.boundary); g.boundaryClosed = s.boundaryClosed; g.obstacles = clone(s.obstacles); st.sel = null; st.selObstacle = null; st.closePrompt = null; };
  const changed = () => { if (onChange) onChange(g); draw(); refreshUI(); };
  const mutate = (fn) => { st.history.push(snapshot()); if (st.history.length > 100) st.history.shift(); st.future = []; fn(); changed(); };
  const undo = () => { if (!st.history.length) return; st.future.push(snapshot()); restore(st.history.pop()); changed(); };
  const redo = () => { if (!st.future.length) return; st.history.push(snapshot()); restore(st.future.pop()); changed(); };
  const say = (msg, kind = '') => { st.msg = msg; st.msgKind = kind; if (msgEl) { msgEl.textContent = msg; msgEl.className = `jd-msg ${kind}`; } };

  const closed = () => !!g.boundaryClosed && g.boundary.length >= 3;
  const gridSize = () => GRIDS[st.gridIdx];

  // ---------- DOM ----------
  const root = h('div', { class: 'jd jd-editor', 'data-role': 'contour-editor' });
  const bar1 = h('div', { class: 'jd-bar jd-scroll' });
  const bar2 = h('div', { class: 'jd-bar jd-scroll' });
  const wrap = h('div', { class: 'jd-canvas-wrap' });
  const info = h('div', { class: 'jd-info' });
  const msgEl = h('div', { class: 'jd-msg', role: 'status', 'aria-live': 'polite' });
  const promptEl = h('div', { class: 'jd-panel', hidden: true });
  const sheet = h('div', { class: 'jd-sheet', hidden: true });
  root.append(bar1, bar2, wrap, info, msgEl, promptEl, sheet);
  el.innerHTML = '';
  el.appendChild(root);

  const btn = (label, act, onclick, cls = '', extra = {}) => h('button', { type: 'button', class: `jd-btn ${cls}`, 'data-act': act, onclick, ...extra }, label);

  const bUndo = btn('↶', 'undo', undo, '', { 'aria-label': 'Annuler' });
  const bRedo = btn('↷', 'redo', redo, '', { 'aria-label': 'Rétablir' });
  const bTool = btn('', 'tool', () => { st.tool = st.tool === 'draw' ? 'obstacle' : 'draw'; st.sel = null; st.draft = null; st.selObstacle = null; st.sheet = st.tool === 'obstacle'; draw(); refreshUI(); });
  const bGrid = btn('', 'grid', () => { st.gridIdx = (st.gridIdx + 1) % GRIDS.length; draw(); refreshUI(); });
  const bOrtho = btn('⊾ Équerre', 'ortho', () => { st.ortho = !st.ortho; refreshUI(); }, '', { 'aria-pressed': 'true', title: 'Alignement et angles droits' });
  const bMagnet = btn('🧲', 'magnet', () => { st.magnet = !st.magnet; refreshUI(); }, '', { 'aria-pressed': 'true' });
  const bFit = btn('⤢', 'fit', () => fitView(), '', { 'aria-label': 'Recentrer le plan', title: 'Recentrer' });
  const bZoomIn = btn('＋', 'zoom-in', () => cv.zoomCenter(1.4), '', { 'aria-label': 'Zoom avant' });
  const bZoomOut = btn('－', 'zoom-out', () => cv.zoomCenter(1 / 1.4), '', { 'aria-label': 'Zoom arrière' });
  bar1.append(bUndo, bRedo, bTool, bGrid, bOrtho, bMagnet, bZoomOut, bZoomIn, bFit);

  const bClose = btn('', 'close', () => (closed() ? reopen() : tryClose()));
  const bDel = btn('🗑 Sommet', 'del-vertex', () => deleteVertex(), 'danger');
  const bSides = btn('📏 Côtés', 'sides', () => { st.sheet = !st.sheet; refreshUI(); });
  const bGps = btn('📍 Point ici', 'gps-point', () => posePointGps());
  const bLive = btn('🛰 Ma position', 'gps-live', () => toggleLive(), '', { 'aria-pressed': 'false' });
  bar2.append(bClose, bDel, bSides, bGps, bLive);

  // ---------- canvas ----------
  const gGrid = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const gMain = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const gTop = document.createElementNS('http://www.w3.org/2000/svg', 'g');

  const cv = createCanvas(wrap, { onView: () => draw(), handlers: { down: onDown, tap: onTap, hover: onHover } });
  cv.svg.append(gGrid, gMain, gTop);
  cv.svg.setAttribute('aria-label', 'Plan du terrain : touchez pour poser les sommets du contour');

  const fitView = () => {
    const pts = [...g.boundary];
    g.obstacles.forEach((o) => { if (o.points) pts.push(...o.points); else if (o.center) pts.push(o.center); });
    if (pts.length >= 2) cv.fit(bounds(pts), 1.35);
    else if (pts.length === 1) { cv.view.cx = pts[0].x; cv.view.cy = pts[0].y; cv.view.mpp = 0.04; cv.apply(); }
    else { cv.view.cx = 5; cv.view.cy = 4; cv.view.mpp = 0.04; cv.apply(); }
  };

  // ---------- accrochage ----------
  function snapAt(w, { exclude = -1, from = undefined } = {}) {
    const tol = cv.px(14);
    const verts = g.boundary.filter((_, i) => i !== exclude);
    const last = from !== undefined ? from : (!closed() && g.boundary.length ? g.boundary[g.boundary.length - 1] : null);
    const r = snap(w, {
      grid: gridSize(), points: st.magnet ? verts : [], tolerance: tol, ortho: st.ortho && last ? last : null,
    });
    let p = r.p; let kind = r.kind;
    // angle droit par rapport au côté précédent
    if (st.ortho && last && kind !== 'point') {
      const idx = g.boundary.indexOf(last);
      const prev = idx > 0 ? g.boundary[idx - 1] : null;
      if (prev) {
        const dx = last.x - prev.x; const dy = last.y - prev.y; const L = Math.hypot(dx, dy);
        if (L > 1e-6) {
          const ux = dx / L; const uy = dy / L;
          const cx = w.x - last.x; const cy = w.y - last.y;
          const along = cx * ux + cy * uy;
          if (Math.abs(along) < tol) {
            const t = -cx * uy + cy * ux;
            p = { x: last.x - uy * t, y: last.y + ux * t }; kind = 'ortho';
          }
        }
      }
    }
    return { p, kind };
  }

  // ---------- gestes ----------
  const hitVertex = (w, r = 22) => {
    let best = -1; let bd = cv.px(r);
    g.boundary.forEach((p, i) => { const d = distance(p, w); if (d <= bd) { bd = d; best = i; } });
    return best;
  };
  const hitMid = (w) => {
    if (g.boundary.length < 2) return -1;
    const n = g.boundary.length;
    const edges = closed() ? n : n - 1;
    let best = -1; let bd = cv.px(18);
    for (let i = 0; i < edges; i++) {
      const a = g.boundary[i]; const b = g.boundary[(i + 1) % n];
      if (distance(a, b) < cv.px(50)) continue;
      const d = distance({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, w);
      if (d <= bd) { bd = d; best = i; }
    }
    return best;
  };

  function onDown(w) {
    if (st.tool === 'obstacle') return downObstacle(w);
    const vi = hitVertex(w);
    if (vi >= 0) return vertexDrag(vi);
    const mi = hitMid(w);
    if (mi >= 0) {
      const a = g.boundary[mi]; const b = g.boundary[(mi + 1) % g.boundary.length];
      st.history.push(snapshot()); st.future = [];
      g.boundary.splice(mi + 1, 0, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      st.sel = mi + 1; changed();
      return vertexDrag(mi + 1, true);
    }
    return null;
  }

  function vertexDrag(i, already = false) {
    let before = already ? null : snapshot();
    let moved = false;
    return {
      move(w) {
        if (!moved) { moved = true; }
        const n = g.boundary.length;
        const from = i > 0 ? g.boundary[i - 1] : (closed() ? g.boundary[n - 1] : null);
        const { p } = snapAt(w, { exclude: i, from: from || undefined });
        g.boundary[i] = p; st.sel = i;
        if (onChange) onChange(g);
        draw(); refreshUI(true);
      },
      up(w, e, didMove) {
        if (didMove && before) { st.history.push(before); st.future = []; }
        if (!didMove) {
          // simple touche : fermer sur le 1er point, sinon sélectionner
          if (i === 0 && !closed() && g.boundary.length >= 3) { tryClose(true); return; }
          st.sel = st.sel === i ? null : i; draw(); refreshUI();
        } else changed();
        before = null;
      },
      cancel() { if (before) { restore(before); changed(); } },
    };
  }

  function onTap(w) {
    if (st.tool === 'obstacle') return tapObstacle(w);
    if (closed()) { st.sel = null; say('Contour fermé : touchez un sommet pour le déplacer, un « + » pour en insérer un, ou « Rouvrir ».'); draw(); refreshUI(); return; }
    const { p } = snapAt(w);
    if (g.boundary.length && distance(g.boundary[g.boundary.length - 1], p) < 1e-6) return;
    mutate(() => { g.boundary.push(p); st.sel = null; });
    st.ghost = null; drawTop();
    st.closePrompt = null;
    say('');
  }

  function onHover(w) {
    if (st.tool === 'draw' && !closed()) st.ghost = snapAt(w).p;
    else if (st.tool === 'obstacle') st.ghost = snapAt(w, { from: null }).p;
    else st.ghost = null;
    drawTop();
  }

  // ---------- fermeture / sommets ----------
  function reopen() { mutate(() => { g.boundaryClosed = false; st.closePrompt = null; }); }
  function doClose() { mutate(() => { g.boundaryClosed = true; st.closePrompt = null; st.sel = null; }); announceValidity(); }
  function tryClose(fromTap = false) {
    const pts = g.boundary;
    if (pts.length < 3) { say('Il faut au moins 3 sommets pour fermer le contour.', 'warn'); return; }
    const gap = distance(pts[pts.length - 1], pts[0]);
    const per = perimeter(pts, false);
    if (!fromTap && pts.length >= 4 && gap > 0.005 && gap < Math.min(2, 0.1 * per)) {
      st.closePrompt = { gap };
      refreshUI();
      return;
    }
    doClose();
  }
  function applyAssistedClose() {
    const rep = closeGapReport(g.boundary);
    mutate(() => {
      const pts = rep.corrected && rep.corrected.length ? rep.corrected : g.boundary;
      g.boundary = pts.slice(0, -1).map((p) => ({ x: p.x, y: p.y })); // le dernier point se confond avec le premier
      g.boundaryClosed = true; st.closePrompt = null; st.sel = null;
    });
    announceValidity();
  }
  function announceValidity() {
    const pts = g.boundary;
    if (!isSimplePolygon(pts)) say('Attention : le contour se croise lui-même. Déplacez un sommet.', 'err');
    else if (polygonArea(pts) <= 1) say('La surface doit dépasser 1 m².', 'warn');
    else say(`Contour fermé : ${frArea(polygonArea(pts))}.`);
  }
  function deleteVertex() {
    const i = st.sel;
    if (i == null || i < 0 || i >= g.boundary.length) return;
    mutate(() => {
      g.boundary.splice(i, 1); st.sel = null;
      if (g.boundary.length < 3) g.boundaryClosed = false;
    });
  }

  // ---------- côtés (saisie au clavier) ----------
  function shiftFrom(i, dx, dy) { for (let k = i; k < g.boundary.length; k++) { g.boundary[k] = { x: g.boundary[k].x + dx, y: g.boundary[k].y + dy }; } }
  function edgeAt(i) { const n = g.boundary.length; return { a: g.boundary[i], b: g.boundary[(i + 1) % n], last: closed() && i === n - 1 }; }
  const isRect = () => {
    const b = g.boundary;
    if (b.length !== 4 || !closed()) return false;
    return [0, 1, 2, 3].every((k) => {
      const p = b[k]; const q = b[(k + 1) % 4]; const r = b[(k + 2) % 4];
      const dot = (q.x - p.x) * (r.x - q.x) + (q.y - p.y) * (r.y - q.y);
      return Math.abs(dot) < 1e-3 * Math.max(1, distance(p, q) * distance(q, r));
    });
  };
  /** Décale les sommets suivants (ou, pour un rectangle, la paire de sommets qui garde le rectangle). */
  function applyEdgeDelta(i, dx, dy) {
    if (isRect()) {
      const pair = [(i + 1) % 4, (i + 2) % 4];
      if (pair.includes(0)) { const c = [i % 4, (i + 3) % 4]; c.forEach((k) => { g.boundary[k] = { x: g.boundary[k].x - dx, y: g.boundary[k].y - dy }; }); }
      else pair.forEach((k) => { g.boundary[k] = { x: g.boundary[k].x + dx, y: g.boundary[k].y + dy }; });
    } else shiftFrom(i + 1, dx, dy);
  }
  function setSideLength(i, L) {
    if (!(L > 0)) return;
    const { a, b, last } = edgeAt(i);
    if (Math.abs(distance(a, b) - L) < 0.0005) return;
    const brg = distance(a, b) > 1e-9 ? bearing(a, b) : 0;
    mutate(() => {
      if (last && !isRect()) { g.boundary[i] = pointFromLengthBearing(b, L, bearing(b, a)); }
      else { const nb = pointFromLengthBearing(a, L, last ? bearing(b, a) + 180 : brg); applyEdgeDelta(i, nb.x - b.x, nb.y - b.y); }
    });
  }
  function setSideBearing(i, deg) {
    if (!Number.isFinite(deg)) return;
    const { a, b, last } = edgeAt(i);
    const L = distance(a, b) || 1;
    if (distance(a, b) > 1e-9 && Math.abs((((bearing(a, b) - deg) % 360) + 540) % 360 - 180) < 0.05) return;
    mutate(() => {
      if (last) { g.boundary[i] = pointFromLengthBearing(b, L, (deg + 180) % 360); }
      else { const nb = pointFromLengthBearing(a, L, ((deg % 360) + 360) % 360); shiftFrom(i + 1, nb.x - b.x, nb.y - b.y); }
    });
  }
  function addSegment(L, deg) {
    if (!(L > 0) || !Number.isFinite(deg)) { say('Saisissez une longueur (m) et une direction (°).', 'warn'); return; }
    if (closed()) { say('Contour fermé : rouvrez-le pour ajouter un côté.', 'warn'); return; }
    mutate(() => {
      if (!g.boundary.length) g.boundary.push({ x: 0, y: 0 });
      const last = g.boundary[g.boundary.length - 1];
      const p = pointFromLengthBearing(last, L, ((deg % 360) + 360) % 360);
      g.boundary.push({ x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000 });
    });
  }

  // ---------- obstacles ----------
  const obstacleKind = () => OBSTACLE_KINDS.find((k) => k.id === st.obstacleKind) || OBSTACLE_KINDS[0];
  function obstacleHit(w) {
    for (let i = g.obstacles.length - 1; i >= 0; i--) {
      const o = g.obstacles[i];
      if (o.kind === 'tree' && o.center) { if (distance(o.center, w) <= Math.max(o.radius || 1, cv.px(16))) return i; }
      else if (o.points && o.points.length >= 3 && o.kind !== 'wall' && o.kind !== 'fence') { if (pointInPolygon(w, o.points)) return i; }
      else if (o.points) {
        for (let k = 0; k < o.points.length - 1; k++) {
          const a = o.points[k]; const b = o.points[k + 1];
          const L2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1;
          const t = Math.max(0, Math.min(1, ((w.x - a.x) * (b.x - a.x) + (w.y - a.y) * (b.y - a.y)) / L2));
          if (distance(w, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }) <= cv.px(16)) return i;
        }
      }
    }
    return -1;
  }
  function downObstacle(w) {
    if (st.draft) return null;
    const i = obstacleHit(w);
    if (i < 0) return null;
    st.selObstacle = i;
    const before = snapshot();
    const o0 = clone(g.obstacles[i]);
    let start = w; let moved = false;
    return {
      move(p) {
        moved = true;
        const dx = p.x - start.x; const dy = p.y - start.y;
        const o = g.obstacles[i];
        if (o0.center) o.center = { x: o0.center.x + dx, y: o0.center.y + dy };
        if (o0.points) o.points = o0.points.map((q) => ({ x: q.x + dx, y: q.y + dy }));
        draw();
      },
      up(p, e, didMove) {
        if (didMove && moved) { st.history.push(before); st.future = []; if (onChange) onChange(g); }
        draw(); refreshUI();
      },
      cancel() { restore(before); changed(); },
    };
  }
  function tapObstacle(w) {
    const i = obstacleHit(w);
    if (i >= 0 && !st.draft) { st.selObstacle = i; draw(); refreshUI(); return; }
    const k = obstacleKind();
    const { p } = snapAt(w, { from: null });
    if (k.id === 'tree') {
      mutate(() => { g.obstacles.push({ id: newId('o_'), kind: 'tree', center: p, radius: 2, height: k.height }); st.selObstacle = g.obstacles.length - 1; });
      return;
    }
    if (!st.draft) st.draft = { kind: k.id, points: [] };
    st.draft.points.push(p);
    if (k.poly && st.rect && st.draft.points.length === 2) { finishDraft(); return; }
    draw(); refreshUI();
  }
  function finishDraft() {
    const d = st.draft; if (!d) return;
    const k = OBSTACLE_KINDS.find((x) => x.id === d.kind);
    let pts = d.points;
    if (k.poly && st.rect && pts.length === 2) {
      const [a, b] = pts;
      pts = [{ x: a.x, y: a.y }, { x: b.x, y: a.y }, { x: b.x, y: b.y }, { x: a.x, y: b.y }];
    }
    const min = k.poly ? 3 : 2;
    if (pts.length < min) { say(`Il faut au moins ${min} points.`, 'warn'); return; }
    mutate(() => { g.obstacles.push({ id: newId('o_'), kind: d.kind, points: pts, height: k.height }); st.selObstacle = g.obstacles.length - 1; st.draft = null; });
  }

  // ---------- GPS ----------
  const gpsOrigin = () => (g.context && g.context.gpsOrigin) || null;
  async function posePointGps() {
    if (st.busy) return;
    if (closed()) { say('Contour fermé : rouvrez-le pour poser un nouveau point.', 'warn'); return; }
    st.busy = true; refreshUI();
    say('Mesure GPS en cours… restez immobile quelques secondes.');
    try {
      const fix = await getPosition({ samples: 5 });
      if (destroyed) return;
      st.fix = fix;
      let origin = gpsOrigin();
      let p;
      if (!origin) { origin = { lat: fix.lat, lon: fix.lon }; g.context.gpsOrigin = origin; p = g.boundary.length ? { ...g.boundary[0] } : { x: 0, y: 0 }; if (g.boundary.length) g.context.gpsOrigin = origin; }
      else p = gpsToLocal([{ lat: fix.lat, lon: fix.lon }], origin).points[0];
      p = { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 };
      mutate(() => { g.boundary.push(p); st.sel = null; });
      const acc = Number(fix.accuracy);
      if (acc > 5) say(`Point posé (précision ±${fr(acc, 1)} m). Le GPS d'un téléphone est peu fiable sous couvert : complétez au mètre à ruban (touche « Côtés »).`, 'warn');
      else say(`Point posé (précision ±${fr(acc, 1)} m).`);
    } catch (e) {
      say(`Position indisponible : ${(e && e.message) || 'autorisation refusée ou signal absent'}. Vous pouvez saisir les côtés à la main.`, 'err');
    } finally { st.busy = false; if (!destroyed) refreshUI(); }
  }
  async function pollLive() {
    try {
      const fix = await getPosition({ samples: 1, timeoutMs: 8000 });
      if (destroyed || !st.liveOn) return;
      st.live = fix;
      if (!gpsOrigin()) say('Position reçue (±' + fr(fix.accuracy, 1) + ' m). Posez d\'abord un point GPS pour caler le plan.', 'warn');
      else if (fix.accuracy > 5) say(`Position en direct, précision faible (±${fr(fix.accuracy, 1)} m).`, 'warn');
      else say(`Position en direct (±${fr(fix.accuracy, 1)} m).`);
      drawTop();
    } catch (e) { if (!destroyed) say('Position indisponible.', 'warn'); }
  }
  function toggleLive() {
    st.liveOn = !st.liveOn;
    if (st.liveOn) { pollLive(); timer = setInterval(pollLive, 4000); }
    else { clearInterval(timer); timer = null; st.live = null; drawTop(); }
    refreshUI();
  }

  // ---------- dessin ----------
  const dimText = (a, b, fs, outward) => {
    const L = distance(a, b);
    if (L < 1e-6) return '';
    const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2;
    const dx = b.x - a.x; const dy = b.y - a.y;
    let nx = dy / L; let ny = -dx / L;
    if (outward < 0) { nx = -nx; ny = -ny; }
    let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (ang > 90) ang -= 180; else if (ang < -90) ang += 180;
    const off = fs * 1.1;
    return `<text transform="translate(${mx + nx * off} ${my + ny * off}) rotate(${ang})" font-size="${fs}" text-anchor="middle" dominant-baseline="middle" fill="#0d47a1" stroke="var(--jd-canvas,#fff)" stroke-width="${fs * 0.25}" paint-order="stroke">${fr(L)} m</text>`;
  };
  const poly = (pts) => pts.map((p) => `${p.x},${p.y}`).join(' ');

  function obstacleSvg(o, selected) {
    const sel = selected ? ' stroke="#d81b60" stroke-width="3"' : '';
    if (o.kind === 'tree' && o.center) {
      return `<circle cx="${o.center.x}" cy="${o.center.y}" r="${o.radius || 1}" fill="#558b2f" fill-opacity=".25" stroke="${selected ? '#d81b60' : '#33691e'}" stroke-dasharray="6 4" stroke-width="2" ${NS}/><circle cx="${o.center.x}" cy="${o.center.y}" r="${cv.px(4)}" fill="#33691e"/>`;
    }
    if (!o.points) return '';
    if (o.kind === 'wall') return `<polyline points="${poly(o.points)}" fill="none" stroke="${selected ? '#d81b60' : '#424242'}" stroke-width="5" ${NS}/>`;
    if (o.kind === 'fence') return `<polyline points="${poly(o.points)}" fill="none" stroke="${selected ? '#d81b60' : '#6d4c41'}" stroke-width="3" stroke-dasharray="8 4" ${NS}/>`;
    const c = centroid(o.points);
    return `<polygon points="${poly(o.points)}" fill="#bdbdbd" fill-opacity=".55" stroke="#424242" stroke-width="2" ${NS}${sel}/><text x="${c.x}" y="${c.y}" font-size="${cv.px(12)}" text-anchor="middle" fill="#263238">${esc(kindLabel(o.kind))}</text>`;
  }

  function draw() {
    if (destroyed || !cv) return;
    const view = cv.view;
    const r = cv.svg.getBoundingClientRect();
    const rect = { width: r.width || 390, height: r.height || 520 };
    const gp = gridPath(view, rect);
    gGrid.innerHTML = `<path d="${gp.minor}" stroke="var(--jd-grid,#e3e3da)" stroke-width="1" fill="none" ${NS}/><path d="${gp.major}" stroke="var(--jd-line,#cfcfc4)" stroke-width="1" fill="none" ${NS}/>`
      + `<path d="M-0.15 0H0.15M0 -0.15V0.15" stroke="var(--jd-muted,#777)" stroke-width="1" ${NS}/>`;
    const fs = cv.px(12);
    const hr = cv.px(9);
    const b = g.boundary;
    const n = b.length;
    const isClosed = closed();
    let s = '';
    for (const [i, o] of g.obstacles.entries()) s += obstacleSvg(o, st.tool === 'obstacle' && st.selObstacle === i);
    if (n >= 2) {
      if (isClosed) s += `<polygon points="${poly(b)}" fill="var(--jd-accent,#2e7d32)" fill-opacity=".12" stroke="var(--jd-fg,#222)" stroke-width="2.5" stroke-linejoin="round" ${NS}/>`;
      else s += `<polyline points="${poly(b)}" fill="none" stroke="var(--jd-fg,#222)" stroke-width="2.5" stroke-linejoin="round" ${NS}/>`;
      const sgn = isClosed ? Math.sign(signedArea(b)) || 1 : 1;
      const edges = isClosed ? n : n - 1;
      for (let i = 0; i < edges; i++) s += dimText(b[i], b[(i + 1) % n], fs, sgn);
    }
    if (st.tool === 'draw') {
      // poignées d'insertion
      if (n >= 2 && cv.px(1) < 0.02) {
        const edges = isClosed ? n : n - 1;
        for (let i = 0; i < edges; i++) {
          const a = b[i]; const c = b[(i + 1) % n];
          if (distance(a, c) < cv.px(50)) continue;
          s += `<g><circle cx="${(a.x + c.x) / 2}" cy="${(a.y + c.y) / 2}" r="${cv.px(8)}" fill="var(--jd-card,#fff)" stroke="var(--jd-accent,#2e7d32)" stroke-width="1.5" ${NS}/><path d="M${(a.x + c.x) / 2 - cv.px(4)} ${(a.y + c.y) / 2}h${cv.px(8)}M${(a.x + c.x) / 2} ${(a.y + c.y) / 2 - cv.px(4)}v${cv.px(8)}" stroke="var(--jd-accent,#2e7d32)" stroke-width="1.5" ${NS}/></g>`;
        }
      }
      b.forEach((p, i) => {
        const first = i === 0;
        const sel = st.sel === i;
        const canClose = first && !isClosed && n >= 3;
        s += `<circle cx="${p.x}" cy="${p.y}" r="${canClose ? hr * 1.5 : hr}" fill="${sel ? '#d81b60' : first ? '#2e7d32' : 'var(--jd-card,#fff)'}" stroke="${sel ? '#fff' : '#2e7d32'}" stroke-width="2.5" ${NS}/>`;
        s += `<text x="${p.x}" y="${p.y}" font-size="${cv.px(10)}" text-anchor="middle" dominant-baseline="central" fill="${first || sel ? '#fff' : '#2e7d32'}" font-weight="700">${i + 1}</text>`;
      });
    }
    if (st.draft && st.draft.points.length) {
      s += `<polyline points="${poly(st.draft.points)}" fill="none" stroke="#d81b60" stroke-width="2.5" stroke-dasharray="6 4" ${NS}/>`;
      st.draft.points.forEach((p) => { s += `<circle cx="${p.x}" cy="${p.y}" r="${hr}" fill="#d81b60" ${NS}/>`; });
    }
    gMain.innerHTML = s;
    drawTop();
  }

  function drawTop() {
    if (destroyed) return;
    let s = '';
    const b = g.boundary;
    if (st.tool === 'draw' && !closed() && b.length && st.ghost) {
      const last = b[b.length - 1];
      const L = distance(last, st.ghost);
      if (L > cv.px(14)) {
        s += `<line x1="${last.x}" y1="${last.y}" x2="${st.ghost.x}" y2="${st.ghost.y}" stroke="var(--jd-accent,#2e7d32)" stroke-width="2" stroke-dasharray="5 4" ${NS}/>`;
        s += dimText(last, st.ghost, cv.px(12), 1);
      }
      s += `<circle cx="${st.ghost.x}" cy="${st.ghost.y}" r="${cv.px(5)}" fill="none" stroke="var(--jd-accent,#2e7d32)" stroke-width="1.5" ${NS}/>`;
    }
    const origin = gpsOrigin();
    const fixes = [];
    if (st.live) fixes.push({ f: st.live, live: true });
    for (const { f, live } of fixes) {
      if (!origin) continue;
      const p = gpsToLocal([{ lat: f.lat, lon: f.lon }], origin).points[0];
      const rr = Math.max(Number(f.accuracy) || 0, cv.px(8));
      s += `<circle cx="${p.x}" cy="${p.y}" r="${rr}" fill="#1e88e5" fill-opacity=".14" stroke="#1e88e5" stroke-width="1" ${NS}/><circle cx="${p.x}" cy="${p.y}" r="${cv.px(7)}" fill="#1e88e5" stroke="#fff" stroke-width="2" ${NS}/>`;
      void live;
    }
    gTop.innerHTML = s;
  }

  // ---------- interface ----------
  let sheetSig = '';
  function refreshUI(light = false) {
    if (destroyed) return;
    const n = g.boundary.length;
    const isClosed = closed();
    bUndo.disabled = !st.history.length;
    bRedo.disabled = !st.future.length;
    bTool.textContent = st.tool === 'draw' ? '🏠 Obstacles' : '✏️ Contour';
    bGrid.textContent = gridSize() ? `▦ ${fr(gridSize(), 1)} m` : '▦ off';
    bOrtho.setAttribute('aria-pressed', String(st.ortho));
    bMagnet.setAttribute('aria-pressed', String(st.magnet));
    bLive.setAttribute('aria-pressed', String(st.liveOn));
    bLive.textContent = st.liveOn ? '🛰 Position : oui' : '🛰 Où suis-je';
    bClose.textContent = isClosed ? '🔓 Rouvrir' : '🔒 Fermer';
    bClose.disabled = !isClosed && n < 3;
    bDel.disabled = st.sel == null || st.tool !== 'draw';
    bDel.hidden = st.tool !== 'draw';
    bSides.hidden = st.tool !== 'draw';
    bGps.hidden = st.tool !== 'draw';
    bGps.disabled = st.busy;
    bGps.textContent = st.busy ? '⏳ Mesure…' : '📍 Poser un point ici';
    bClose.hidden = st.tool !== 'draw';

    const pts = g.boundary;
    const area = n >= 3 ? polygonArea(pts) : 0;
    const per = n >= 2 ? perimeter(pts, isClosed) : 0;
    const simple = n >= 3 ? isSimplePolygon(pts) : true;
    info.innerHTML = `<span>Surface <b data-role="area">${n >= 3 ? fr(area) : '0,00'}</b> m²${!isClosed && n >= 3 ? ' (si fermé)' : ''}</span>`
      + `<span>Périmètre <b data-role="perimeter">${fr(per)}</b> m</span>`
      + `<span><b data-role="count">${n}</b> sommet${n > 1 ? 's' : ''}${isClosed ? ' · fermé' : ''}</span>`
      + (!simple ? '<span class="jd-msg err" style="padding:0">⚠ contour croisé</span>' : '')
      + (n >= 3 && isClosed && area <= 1 ? '<span class="jd-msg warn" style="padding:0">⚠ surface ≤ 1 m²</span>' : '');
    msgEl.textContent = st.msg; msgEl.className = `jd-msg ${st.msgKind}`;
    if (!st.msg) {
      if (st.tool === 'draw' && !n) msgEl.textContent = 'Touchez le plan pour poser le 1er sommet, ou saisissez les côtés (« Côtés »). Pincez pour zoomer.';
      else if (st.tool === 'draw' && !isClosed && n) msgEl.textContent = 'Touchez pour ajouter un sommet. Touchez le sommet 1 (ou « Fermer ») pour terminer.';
      else if (st.tool === 'obstacle') msgEl.textContent = st.draft ? 'Touchez les points suivants puis « Terminer ».' : 'Choisissez un type d\'obstacle puis touchez le plan. Touchez un obstacle pour le modifier ou le déplacer.';
    }
    // assistant de fermeture
    promptEl.hidden = !st.closePrompt;
    if (st.closePrompt) {
      promptEl.innerHTML = '';
      promptEl.append(
        h('div', { 'data-role': 'close-prompt' }, `Écart de fermeture : ${frLen(st.closePrompt.gap)}. Le dernier point doit-il se confondre avec le premier ? Dans ce cas l'écart est réparti sur les côtés.`),
        h('div', { class: 'jd-row' },
          btn('Répartir l\'écart et fermer', 'close-fix', applyAssistedClose, 'primary'),
          btn('Fermer tel quel', 'close-asis', doClose),
          btn('Annuler', 'close-cancel', () => { st.closePrompt = null; refreshUI(); })),
      );
    }
    if (light) return;
    // feuille
    sheet.hidden = !(st.sheet || st.tool === 'obstacle');
    if (!sheet.hidden) renderSheet();
    void sheetSig;
  }

  function numInput(value, onCommit, { step = '0.01', cls = '', label = '' } = {}) {
    const inp = h('input', { class: `jd-input sm ${cls}`, type: 'text', inputmode: 'decimal', value: value, 'aria-label': label, enterkeyhint: 'done' });
    const commit = () => { const v = parseNum(inp.value); if (Number.isFinite(v)) onCommit(v); else refreshUI(); };
    inp.addEventListener('change', commit);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
    void step;
    return inp;
  }

  function renderSheet() {
    sheet.innerHTML = '';
    if (st.tool === 'obstacle') return renderObstacleSheet();
    const n = g.boundary.length;
    const isClosed = closed();
    sheet.append(h('h3', {}, 'Côtés du contour'));
    if (!isClosed) {
      let defBearing = 90;
      if (n >= 2) defBearing = (bearing(g.boundary[n - 2], g.boundary[n - 1]) + 90) % 360;
      const lenIn = h('input', { class: 'jd-input sm', type: 'text', inputmode: 'decimal', placeholder: 'm', 'aria-label': 'Longueur du côté en mètres', 'data-role': 'add-length' });
      const dirIn = h('input', { class: 'jd-input sm', type: 'text', inputmode: 'decimal', value: String(Math.round(defBearing)), 'aria-label': 'Direction en degrés', 'data-role': 'add-bearing' });
      const rel = (d) => { const base = n >= 2 ? bearing(g.boundary[n - 2], g.boundary[n - 1]) : 90; dirIn.value = String(Math.round((base + d + 360) % 360)); };
      sheet.append(
        h('div', { class: 'jd-row' },
          h('label', {}, 'Longueur (m)'), lenIn, h('label', {}, 'Direction (°, 0 = haut)'), dirIn),
        h('div', { class: 'jd-row' },
          btn('↰ 90° gauche', 'rel-left', () => rel(-90)),
          btn('↑ Tout droit', 'rel-straight', () => rel(0)),
          btn('↱ 90° droite', 'rel-right', () => rel(90)),
          btn('➕ Ajouter le côté', 'add-side', () => addSegment(parseNum(lenIn.value), parseNum(dirIn.value)), 'primary')),
      );
    }
    if (n >= 2) {
      const tbl = h('table', { class: 'jd-sides', 'data-role': 'sides' });
      tbl.append(h('tr', {}, h('th', {}, 'Côté'), h('th', {}, 'Long. (m)'), h('th', {}, 'Cap (°)')));
      const edges = isClosed ? n : n - 1;
      for (let i = 0; i < edges; i++) {
        const a = g.boundary[i]; const b = g.boundary[(i + 1) % n];
        tbl.append(h('tr', { class: 'side' },
          h('td', {}, `${i + 1}→${((i + 1) % n) + 1}`),
          h('td', {}, numInput(fr(distance(a, b)), (v) => setSideLength(i, v), { label: `Longueur du côté ${i + 1}`, cls: 'side-len' })),
          h('td', {}, numInput(String(Math.round(bearing(a, b) * 10) / 10).replace('.', ','), (v) => setSideBearing(i, v), { label: `Direction du côté ${i + 1}`, cls: 'side-brg' }))));
      }
      sheet.append(tbl, h('div', { class: 'jd-msg' }, 'Modifier une longueur ou un cap décale les sommets suivants ; le dernier côté absorbe l\'écart.'));
    } else sheet.append(h('div', { class: 'jd-msg' }, 'Aucun côté pour l\'instant.'));
  }

  function renderObstacleSheet() {
    const kinds = h('div', { class: 'jd-row' }, OBSTACLE_KINDS.map((k) => btn(k.label, `obst-${k.id}`, () => { st.obstacleKind = k.id; st.draft = null; draw(); refreshUI(); }, '', { 'aria-pressed': String(st.obstacleKind === k.id) })));
    sheet.append(h('h3', {}, 'Obstacles'), kinds);
    const k = obstacleKind();
    if (k.poly) {
      sheet.append(h('label', { class: 'jd-switch' }, h('span', {}, 'Rectangle en 2 touches (coins opposés)'),
        h('input', { type: 'checkbox', checked: st.rect, onchange: (e) => { st.rect = e.target.checked; st.draft = null; draw(); } })));
    }
    if (st.draft) {
      sheet.append(h('div', { class: 'jd-row' },
        btn('✔ Terminer', 'draft-done', finishDraft, 'primary'),
        btn('Annuler le tracé', 'draft-cancel', () => { st.draft = null; draw(); refreshUI(); })));
    }
    if (!g.obstacles.length) sheet.append(h('div', { class: 'jd-msg' }, 'Aucun obstacle. Ils servent au calcul d\'ombre et interdisent des zones.'));
    g.obstacles.forEach((o, i) => {
      const row = h('div', { class: 'jd-row', style: { background: st.selObstacle === i ? 'color-mix(in srgb, var(--jd-accent) 14%, transparent)' : '', borderRadius: '8px', padding: '2px 4px' } },
        h('button', { type: 'button', class: 'jd-btn', onclick: () => { st.selObstacle = i; draw(); refreshUI(); } }, kindLabel(o.kind)),
        h('label', {}, 'Hauteur (m)'),
        numInput(fr(o.height ?? 0), (v) => { mutate(() => { g.obstacles[i].height = Math.max(0, v); }); }, { label: `Hauteur de ${kindLabel(o.kind)}` }),
        o.kind === 'tree' ? h('label', {}, 'Rayon (m)') : null,
        o.kind === 'tree' ? numInput(fr(o.radius ?? 1), (v) => { mutate(() => { g.obstacles[i].radius = Math.max(0.2, v); }); }, { label: 'Rayon de l\'arbre' }) : null,
        btn('🗑', `obst-del-${i}`, () => mutate(() => { g.obstacles.splice(i, 1); st.selObstacle = null; }), 'danger', { 'aria-label': 'Supprimer l\'obstacle' }));
      sheet.append(row);
    });
  }

  // ---------- init ----------
  draw();
  refreshUI();
  requestAnimationFrame(() => { if (!destroyed) { fitView(); } });
  setTimeout(() => { if (!destroyed) fitView(); }, 60);

  return function unmount() {
    destroyed = true;
    if (timer) clearInterval(timer);
    cv.destroy();
    el.innerHTML = '';
  };
}
