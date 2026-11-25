// Éditeur du contour du terrain : tracé tactile métré, côtés éditables, obstacles, relevé GPS.
import {
  distance, polygonArea, perimeter, isSimplePolygon, pointInPolygon, bounds, pointFromLengthBearing, bearing,
  closeGapReport, gpsToLocal, centroid, signedArea,
} from '../geometry.js';
import { newId } from '../model.js';
import { getPosition } from '../geo.js';
import { createSurveyUI } from './gps-survey-ui.js';
import {
  injectStyles, h, createCanvas, gridPath, snap, clone, esc, fr, frLen, frArea, parseNum, parseLength, toCm,
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
    obstacleKind: 'house', selSide: null, pop: null,
  };
  let timer = null;
  let destroyed = false;

  let survey = null; // relevé GPS guidé (ui/gps-survey-ui.js)
  const surveyOn = () => !!(survey && survey.isActive());

  const snapshot = () => clone({ boundary: g.boundary, boundaryClosed: !!g.boundaryClosed, obstacles: g.obstacles, gpsOrigin: (g.context && g.context.gpsOrigin) || null });
  const restore = (s) => {
    g.boundary = clone(s.boundary); g.boundaryClosed = s.boundaryClosed; g.obstacles = clone(s.obstacles);
    if (s.gpsOrigin) g.context.gpsOrigin = clone(s.gpsOrigin); else if ('gpsOrigin' in s) delete g.context.gpsOrigin;
    st.sel = null; st.selObstacle = null; st.closePrompt = null; };
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
  const startEl = h('div', { class: 'jd-start', hidden: true, 'data-role': 'start-panel' });
  const pop = h('div', { class: 'jd-pop', hidden: true, role: 'dialog', 'aria-modal': 'false', 'data-role': 'pop' });
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
  const bGps = btn('📍 Relevé GPS', 'gps-point', () => startSurvey());
  const bLive = btn('🛰 Ma position', 'gps-live', () => toggleLive(), '', { 'aria-pressed': 'false' });
  bar2.append(bClose, bDel, bSides, bGps, bLive);

  // ---------- canvas ----------
  const gGrid = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const gMain = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const gTop = document.createElementNS('http://www.w3.org/2000/svg', 'g');

  const cv = createCanvas(wrap, { onView: () => { if (survey) survey.viewChanged(); draw(); }, handlers: { down: onDown, tap: onTap, hover: onHover, long: onLong } });
  wrap.append(startEl, pop);
  cv.svg.append(gGrid, gMain, gTop);
  survey = createSurveyUI({
    root, wrap, cv, garden: g,
    persist: () => { if (onChange) onChange(g); },
    redraw: () => draw(),
    onApply: ({ points, origin }) => {
      mutate(() => {
        g.boundary = points.map((p) => ({ x: p.x, y: p.y })); g.boundaryClosed = true;
        g.context.gpsOrigin = { lat: origin.lat, lon: origin.lon };
        delete g.context.gpsSurveyDraft;
        st.sel = null; st.closePrompt = null;
      });
      fitView();
      announceValidity();
    },
    onManual: () => { st.sheet = true; say('GPS indisponible : saisissez les côtés à la main (longueur et direction).', 'warn'); refreshUI(); },
    onExit: () => { fitView(); refreshUI(); },
  });
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
    if (surveyOn()) return null;
    if (st.pop) closePop();
    if (st.tool === 'obstacle') return downObstacle(w);
    const vi = hitVertex(w);
    if (vi >= 0) return vertexDrag(vi);
    const mi = hitMid(w);
    if (mi >= 0) return midDrag(mi);
    return null;
  }

  /** Milieu d'un côté : un toucher ouvre la saisie de la longueur, un glissé insère un sommet. */
  function midDrag(mi) {
    let inserted = null;
    return {
      move(w) {
        if (!inserted) {
          const a = g.boundary[mi]; const b = g.boundary[(mi + 1) % g.boundary.length];
          st.history.push(snapshot()); st.future = [];
          g.boundary.splice(mi + 1, 0, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
          st.sel = mi + 1; inserted = vertexDrag(mi + 1, true);
        }
        inserted.move(w);
      },
      up(w, e, didMove) {
        if (inserted) return inserted.up(w, e, didMove);
        openSidePop(mi);
        return undefined;
      },
      cancel() { if (inserted) inserted.cancel(); },
    };
  }

  // ---------- appui long ----------
  function sideAt(w, tol = cv.px(22)) {
    const n = g.boundary.length;
    if (n < 2) return -1;
    const edges = closed() ? n : n - 1;
    let best = -1; let bd = tol;
    for (let i = 0; i < edges; i++) {
      const a = g.boundary[i]; const b = g.boundary[(i + 1) % n];
      const L2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1;
      const t = Math.max(0, Math.min(1, ((w.x - a.x) * (b.x - a.x) + (w.y - a.y) * (b.y - a.y)) / L2));
      const d = distance(w, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
      if (d <= bd) { bd = d; best = i; }
    }
    return best;
  }
  function onLong(w) {
    if (surveyOn() || st.tool !== 'draw') return;
    const vi = hitVertex(w, 26);
    if (vi >= 0) { openVertexPop(vi); return; }
    const si = sideAt(w);
    if (si >= 0) { openSidePop(si); return; }
    if (!g.boundary.length) { openRectPop(snapAt(w).p); return; }
    if (!closed()) openNextPop(w);
  }

  // ---------- fenêtre de saisie (cm) ----------
  function closePop() { st.pop = null; st.selSide = null; pop.hidden = true; pop.innerHTML = ''; draw(); }
  /**
   * Petite fenêtre en haut du plan : champs numériques en cm (« 350 » = 3,50 m ; « 3,5 m » accepté),
   * boutons − / + 10 cm, actions supplémentaires. `onOk(valeurs en m)` ; Entrée valide, Échap annule.
   */
  function openPop({ title, hint, fields = [], extra = null, actions = [], okLabel = 'Valider', onOk }) {
    st.pop = { title };
    pop.innerHTML = '';
    pop.hidden = false;
    const inputs = {};
    const rows = fields.map((f) => {
      const inp = h('input', { class: 'jd-input jd-pop-input', type: 'text', inputmode: f.decimal ? 'decimal' : 'numeric', value: f.value ?? '', 'aria-label': f.label, enterkeyhint: 'done', 'data-field': f.key });
      inputs[f.key] = inp;
      const step = (d) => () => {
        const v = parseLength(inp.value);
        const next = Math.max(0.01, (Number.isFinite(v) ? v : 0) + d);
        inp.value = toCm(next); inp.focus(); inp.select();
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
        if (!Number.isFinite(v)) { inputs[f.key].classList.add('bad'); inputs[f.key].focus(); say('Saisissez une longueur en cm, par exemple 350 (ou 3,5 m).', 'warn'); return; }
        out[f.key] = v;
      }
      const res = onOk ? onOk(out) : null;
      if (res !== false) closePop();
    };
    const kids = [
      h('div', { class: 'jd-pop-title' }, title),
      ...rows,
      extra,
      hint ? h('div', { class: 'jd-pop-hint' }, hint) : null,
      h('div', { class: 'jd-row' },
        h('button', { type: 'button', class: 'jd-btn primary', 'data-act': 'pop-ok', onclick: commit }, okLabel),
        h('button', { type: 'button', class: 'jd-btn', 'data-act': 'pop-cancel', onclick: closePop }, 'Annuler'),
        ...actions.map((a) => h('button', { type: 'button', class: `jd-btn ${a.danger ? 'danger' : ''}`, 'data-act': a.act, onclick: () => { a.fn(); } }, a.label))),
    ];
    pop.append(...kids.filter(Boolean));
    pop.onkeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      else if (e.key === 'Escape') { e.preventDefault(); closePop(); }
    };
    const first = Object.values(inputs)[0];
    if (first) setTimeout(() => { first.focus(); first.select(); }, 0);
  }

  function openSidePop(i) {
    const n = g.boundary.length;
    const { a, b } = edgeAt(i);
    st.selSide = i; st.sel = null;
    const L = distance(a, b);
    draw();
    openPop({
      title: `Côté ${i + 1} → ${((i + 1) % n) + 1} · ${frLen(L)}`,
      fields: [{ key: 'len', label: 'Longueur', value: toCm(L) }],
      hint: 'Tapez en centimètres : 350 = 3,50 m. Les sommets suivants se décalent.',
      onOk: ({ len }) => { setSideLength(i, len); },
    });
  }

  function openVertexPop(i) {
    st.sel = i; draw(); refreshUI();
    const p = g.boundary[i];
    openPop({
      title: `Sommet ${i + 1}`,
      hint: `Position : ${fr(p.x)} m ; ${fr(p.y)} m. Glissez le sommet pour le déplacer.`,
      okLabel: 'Fermer',
      onOk: () => {},
      actions: [{ label: '🗑 Supprimer', act: 'pop-del-vertex', danger: true, fn: () => { closePop(); deleteVertex(); } }],
    });
  }

  function openNextPop(w) {
    const n = g.boundary.length;
    const last = g.boundary[n - 1];
    const raw = bearing(last, w);
    const dirs = [{ d: 0, t: '↑' }, { d: 90, t: '→' }, { d: 180, t: '↓' }, { d: 270, t: '←' }];
    let cur = dirs.reduce((best, x) => {
      const dd = Math.abs((((raw - x.d) % 360) + 540) % 360 - 180);
      return dd < best.dd ? { d: x.d, dd } : best;
    }, { d: 90, dd: 999 }).d;
    const chips = h('div', { class: 'jd-row jd-dirs', 'data-role': 'pop-dirs' }, h('label', {}, 'Direction'),
      dirs.map((x) => h('button', {
        type: 'button', class: 'jd-btn jd-dir', 'aria-pressed': String(x.d === cur), 'data-dir': x.d,
        onclick: (e) => { cur = x.d; chips.querySelectorAll('.jd-dir').forEach((c) => c.setAttribute('aria-pressed', String(c === e.currentTarget))); },
      }, x.t)));
    openPop({
      title: `Côté suivant depuis le sommet ${n}`,
      fields: [{ key: 'len', label: 'Longueur', value: '' }],
      extra: chips,
      hint: 'Haut du plan = ↑. Tapez la longueur en cm (500 = 5 m).',
      okLabel: 'Ajouter le côté',
      onOk: ({ len }) => { addSegment(len, cur); },
    });
  }

  function openRectPop(origin) {
    openPop({
      title: 'Terrain rectangulaire',
      fields: [{ key: 'w', label: 'Largeur', value: '' }, { key: 'l', label: 'Longueur', value: '' }],
      hint: 'Tapez les dimensions en centimètres (1000 = 10 m). Vous pourrez ensuite ajuster chaque côté.',
      okLabel: 'Créer le rectangle',
      onOk: ({ w, l }) => {
        mutate(() => {
          const o = origin || { x: 0, y: 0 };
          g.boundary = [{ x: o.x, y: o.y }, { x: o.x + w, y: o.y }, { x: o.x + w, y: o.y + l }, { x: o.x, y: o.y + l }]
            .map((p) => ({ x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000 }));
          g.boundaryClosed = true; st.sel = null;
        });
        fitView();
        announceValidity();
      },
    });
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
    if (surveyOn()) return undefined;
    if (st.tool === 'obstacle') return tapObstacle(w);
    const lab = labelAt(w);
    if (lab >= 0) { openSidePop(lab); return; }
    if (closed()) { st.sel = null; say('Contour fermé : touchez un sommet pour le déplacer, un « + » pour en insérer un, ou « Rouvrir ».'); draw(); refreshUI(); return; }
    const { p } = snapAt(w);
    if (g.boundary.length && distance(g.boundary[g.boundary.length - 1], p) < 1e-6) return;
    mutate(() => { g.boundary.push(p); st.sel = null; });
    st.ghost = null; drawTop();
    st.closePrompt = null;
    say('');
  }

  /** Étiquette de cote touchée (≈ au milieu du côté, légèrement décalée vers l'extérieur) ? */
  function labelAt(w) {
    const n = g.boundary.length;
    if (n < 2) return -1;
    const edges = closed() ? n : n - 1;
    let best = -1; let bd = cv.px(26);
    for (let i = 0; i < edges; i++) {
      const a = g.boundary[i]; const b = g.boundary[(i + 1) % n];
      if (distance(a, b) < cv.px(40)) continue;
      const d = distance({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, w);
      if (d <= bd) { bd = d; best = i; }
    }
    return best;
  }

  function onHover(w) {
    if (surveyOn()) return;
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
  /** Relevé GPS guidé plein écran (consignes, qualité du signal, point par point) : voir ui/gps-survey-ui.js. */
  function startSurvey() { if (survey) survey.start(); }
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
    if (surveyOn()) {
      const sv = survey.svg();
      gMain.innerHTML = sv ? sv.main : '';
      gTop.innerHTML = sv ? sv.top : '';
      return;
    }
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
      if (st.selSide != null && st.selSide < (isClosed ? n : n - 1)) {
        const sa = b[st.selSide]; const sb = b[(st.selSide + 1) % n];
        s += `<line x1="${sa.x}" y1="${sa.y}" x2="${sb.x}" y2="${sb.y}" stroke="#d81b60" stroke-width="5" stroke-linecap="round" ${NS}/>`;
      }
      const sgn = isClosed ? Math.sign(signedArea(b)) || 1 : 1;
      const edges = isClosed ? n : n - 1;
      for (let i = 0; i < edges; i++) s += dimText(b[i], b[(i + 1) % n], fs, sgn);
    }
    if (st.tool === 'draw') {
      // milieu des côtés : toucher = saisir la longueur, glisser = insérer un sommet
      if (n >= 2) {
        const edges = isClosed ? n : n - 1;
        for (let i = 0; i < edges; i++) {
          const a = b[i]; const c = b[(i + 1) % n];
          if (distance(a, c) < cv.px(50)) continue;
          s += `<circle cx="${(a.x + c.x) / 2}" cy="${(a.y + c.y) / 2}" r="${cv.px(5)}" fill="var(--jd-card,#fff)" stroke="#0d47a1" stroke-width="1.5" ${NS}/>`;
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
    if (destroyed || surveyOn()) return;
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
    const draft = survey && survey.draft();
    bGps.textContent = draft ? `📍 Reprendre le relevé (${draft.points.length})` : '📍 Relevé GPS';
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
      if (st.tool === 'draw' && !n) msgEl.textContent = 'Touchez le plan pour poser le 1er sommet. Un appui long ouvre la saisie des dimensions en cm.';
      else if (st.tool === 'draw' && !isClosed && n) msgEl.textContent = 'Touchez pour ajouter un sommet, touchez une cote ou appuyez longuement sur un côté pour saisir sa longueur en cm. Touchez le sommet 1 pour fermer.';
      else if (st.tool === 'draw' && isClosed) msgEl.textContent = 'Touchez une cote (ou appuyez longuement sur un côté) pour la corriger en cm. Glissez un sommet pour le déplacer, tirez le point au milieu d\'un côté pour ajouter un sommet.';
      else if (st.tool === 'obstacle') msgEl.textContent = st.draft ? 'Touchez les points suivants puis « Terminer ».' : 'Choisissez un type d\'obstacle puis touchez le plan. Touchez un obstacle pour le modifier ou le déplacer.';
    }
    // démarrage : trois façons de commencer
    startEl.hidden = !(st.tool === 'draw' && !n);
    if (!startEl.hidden && !startEl.firstChild) {
      startEl.append(
        h('div', { class: 'jd-start-title' }, 'Comment voulez-vous commencer ?'),
        h('div', { class: 'jd-row' },
          btn('▭ Je connais les dimensions', 'start-rect', () => openRectPop({ x: 0, y: 0 }), 'primary'),
          btn('✏️ Je dessine au doigt', 'start-draw', () => say('Touchez le plan pour poser chaque angle du terrain.')),
          btn('📍 Je fais le tour au GPS', 'start-gps', () => startSurvey())),
      );
    }
    const resume = survey && survey.draft();
    const resumeBtn = startEl.querySelector('[data-act=start-gps]');
    if (resumeBtn) resumeBtn.textContent = resume ? `📍 Reprendre le relevé GPS (${resume.points.length} point${resume.points.length > 1 ? 's' : ''})` : '📍 Je fais le tour au GPS';
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
    if (survey) survey.destroy();
    if (timer) clearInterval(timer);
    cv.destroy();
    el.innerHTML = '';
  };
}
