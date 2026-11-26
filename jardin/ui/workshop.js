// « Atelier plein écran » : mise en page des étapes de dessin et de rendu.
// La page ne défile plus : en-tête compact, progression segmentée, plan sur toute la hauteur restante,
// feuille tirable (repliée / mi-hauteur / haute) et barre Précédent/Suivant toujours visible.
// Sur écran large ou court en paysage, la feuille devient une colonne à droite.
// Les éditeurs gardent leur DOM : `adoptWorkshop` en déplace seulement les blocs (barres → rangée d'outils,
// panneaux → feuille) et les remet en place à la destruction.

export const SHEET_STATES = ['peek', 'half', 'full'];
export const PEEK_PX = 68;
/** Même condition que la media query de workshop.css : colonne à droite au lieu de la feuille du bas. */
export const COLUMN_MQ = '(min-width: 900px), (min-width: 560px) and (max-height: 560px), (orientation: landscape) and (max-height: 600px)';
const KB_MIN = 120; // px : en dessous, ce n'est pas un clavier mais la barre d'adresse

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ---------- fonctions pures (testées) ----------

/** Hauteurs (px) des trois états de la feuille pour une zone d'atelier de hauteur `hostH`. */
export function sheetHeights(hostH, { keyboard = false } = {}) {
  const H = Math.max(Number(hostH) || 0, 160);
  if (keyboard) {
    const full = Math.max(PEEK_PX + 20, H - 72); // le plan garde une bande de 72 px
    return { peek: PEEK_PX, half: Math.max(PEEK_PX + 10, Math.min(full, Math.round(H * 0.5))), full };
  }
  const full = Math.max(PEEK_PX + 60, Math.round(H * 0.66));
  const half = Math.min(full - 30, Math.max(PEEK_PX + 90, Math.round(H * 0.4)));
  return { peek: PEEK_PX, half, full };
}

export const nextState = (s) => SHEET_STATES[(SHEET_STATES.indexOf(s) + 1) % SHEET_STATES.length];
export const upState = (s) => SHEET_STATES[Math.min(SHEET_STATES.length - 1, SHEET_STATES.indexOf(s) + 1)];
export const downState = (s) => SHEET_STATES[Math.max(0, SHEET_STATES.indexOf(s) - 1)];

/**
 * État d'arrivée après un glissé : hauteur courante `px`, vitesse `vy` (px/ms, positive vers le bas),
 * état de départ `from`. Inertie simple : on projette la hauteur 180 ms plus loin, puis on prend l'état le plus proche ;
 * un geste vif (> 0,6 px/ms) change toujours d'état.
 */
export function settleState(px, heights, vy = 0, from = null) {
  const proj = px - vy * 180;
  let best = 'peek';
  let bd = Infinity;
  for (const s of SHEET_STATES) { const d = Math.abs(proj - heights[s]); if (d < bd) { bd = d; best = s; } }
  if (from && best === from && Math.abs(vy) > 0.6) best = vy < 0 ? upState(from) : downState(from);
  return best;
}

/**
 * Clavier virtuel : `inset` = hauteur masquée par le clavier. `baseline` = plus grande hauteur de fenêtre vue
 * (les webviews qui redimensionnent la fenêtre ne bougent pas `visualViewport` seul).
 */
export function keyboardMetrics({ innerHeight, vv, baseline } = {}) {
  const inner = Number(innerHeight) || 0;
  if (!vv) return { open: false, inset: 0, height: inner, top: 0 };
  const base = Math.max(inner, Number(baseline) || 0);
  const top = Math.max(0, Math.round(vv.offsetTop || 0));
  const inset = Math.max(0, Math.round(base - vv.height - top));
  return { open: inset > KB_MIN, inset, height: Math.round(vv.height), top };
}

/** Observe visualViewport (repli : resize). cb({open, inset, height, top}) ; renvoie stop(). */
export function observeKeyboard(cb, win = (typeof window !== 'undefined' ? window : null)) {
  if (!win) return () => {};
  const vv = win.visualViewport || null;
  let baseline = win.innerHeight || 0;
  let baseW = win.innerWidth || 0;
  const read = () => {
    if ((win.innerWidth || 0) !== baseW) { baseW = win.innerWidth || 0; baseline = win.innerHeight || 0; } // rotation
    if ((win.innerHeight || 0) > baseline) baseline = win.innerHeight;
    cb(keyboardMetrics({ innerHeight: win.innerHeight, vv, baseline }));
  };
  const target = vv || win;
  target.addEventListener('resize', read);
  if (vv) vv.addEventListener('scroll', read);
  read();
  return () => { target.removeEventListener('resize', read); if (vv) vv.removeEventListener('scroll', read); };
}

export function isColumnLayout() {
  try { return !!(window.matchMedia && window.matchMedia(COLUMN_MQ).matches); } catch { return false; }
}
const reducedMotion = () => { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch { return false; } };

// ---------- DOM ----------
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  const add = (c) => { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(add); else el.append(c.nodeType ? c : document.createTextNode(String(c))); };
  kids.forEach(add);
  return el;
}

export function injectWorkshopStyles() {
  try {
    if (typeof document === 'undefined' || document.getElementById('ws-styles')) return;
    const link = document.createElement('link');
    link.id = 'ws-styles'; link.rel = 'stylesheet';
    link.href = new URL('./workshop.css', import.meta.url).href;
    document.head.appendChild(link);
  } catch { /* styles par défaut */ }
}
injectWorkshopStyles();

/** Fait défiler `scroller` pour que `el` soit visible (sans toucher aux ancêtres). */
export function revealInside(scroller, el) {
  try {
    const s = scroller.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.height === 0 && r.width === 0) return;
    const pad = 12;
    if (r.bottom > s.bottom - pad) scroller.scrollTop += r.bottom - s.bottom + pad;
    else if (r.top < s.top + pad) scroller.scrollTop -= s.top - r.top + pad;
  } catch { /* jsdom */ }
}

/**
 * Feuille tirable. `container` est l'élément positionné qui la reçoit (hauteur de référence = sa hauteur).
 * @returns {{el, grab, sum, inner, getState, setState, next, layout, setKeyboard, destroy, onState, pane, selectTab}}
 */
export function createSheet(container, { label = 'Détails et réglages', tabs = null, state = 'peek' } = {}) {
  const grab = h('button', {
    type: 'button', class: 'ws-grab', 'data-role': 'sheet-handle', 'aria-expanded': 'false',
    'aria-label': 'Hauteur de la feuille : touchez ou glissez pour l’agrandir',
  }, h('i'));
  const sum = h('div', { class: 'ws-sum', 'data-role': 'sheet-summary' });
  const inner = h('div', { class: 'ws-inner', 'data-role': 'sheet-inner' });
  const el = h('div', { class: 'ws-sheet', 'data-role': 'sheet', 'data-state': state, role: 'region', 'aria-label': label }, grab, sum, inner);
  container.append(el);

  let cur = state;
  let kb = false;
  let live = false; // pas d'événement de mise en page pendant le montage de l'éditeur (ses variables ne sont pas encore prêtes)
  setTimeout(() => { live = true; }, 0);
  let heights = sheetHeights(container.clientHeight || 500);
  const listeners = new Set();
  const panes = {};
  let tabBtns = [];

  const apply = (animate) => {
    const px = heights[cur];
    if (!animate || reducedMotion()) el.classList.add('no-anim'); else el.classList.remove('no-anim');
    el.style.height = `${px}px`;
    el.dataset.state = cur;
    grab.setAttribute('aria-expanded', String(cur !== 'peek'));
    const prevH = container.style.getPropertyValue('--ws-sheet-h');
    container.style.setProperty('--ws-sheet-h', `${px}px`);
    if (live && prevH !== `${px}px`) { try { window.dispatchEvent(new Event('ws-layout')); } catch { /* ok */ } }
  };
  const layout = () => { heights = sheetHeights(container.clientHeight || 500, { keyboard: kb }); apply(false); };
  const setState = (s, { animate = true, silent = false } = {}) => {
    if (!SHEET_STATES.includes(s)) return;
    const changed = s !== cur;
    cur = s;
    heights = sheetHeights(container.clientHeight || 500, { keyboard: kb });
    apply(animate);
    if (changed && !silent) listeners.forEach((f) => { try { f(cur); } catch (e) { console.error(e); } });
  };
  const next = () => setState(nextState(cur));

  // onglets (Rendu : Affichage / Exporter)
  const selectTab = (id, { open = false } = {}) => {
    tabBtns.forEach((b) => { const on = b.dataset.tab === id; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    Object.entries(panes).forEach(([k, p]) => { p.hidden = k !== id; });
    if (open && cur === 'peek') setState('half');
  };
  if (tabs && tabs.length) {
    const tl = h('div', { class: 'ws-tabs', role: 'tablist', 'aria-label': label });
    tabs.forEach((t, i) => {
      const b = h('button', {
        type: 'button', class: 'ws-tab', role: 'tab', 'data-tab': t.id, id: `ws-tab-${t.id}`, 'aria-controls': `ws-pane-${t.id}`,
        onclick: () => selectTab(t.id, { open: true }),
        onkeydown: (e) => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          const j = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
          selectTab(tabs[j].id, { open: true }); tabBtns[j].focus();
        },
      }, t.label);
      tabBtns.push(b); tl.append(b);
      panes[t.id] = h('div', { class: 'ws-pane', role: 'tabpanel', id: `ws-pane-${t.id}`, 'aria-labelledby': `ws-tab-${t.id}`, 'data-pane': t.id }, ...(t.nodes || []));
      inner.append(panes[t.id]);
    });
    sum.append(tl);
    selectTab(tabs[0].id);
  }

  // glissé sur la poignée
  let drag = null;
  const px0 = () => heights[cur];
  grab.addEventListener('pointerdown', (e) => {
    if (isColumnLayout()) return;
    try { grab.setPointerCapture(e.pointerId); } catch { /* jsdom */ }
    drag = { id: e.pointerId, y0: e.clientY, h0: px0(), t0: Date.now(), moved: false, samples: [{ t: Date.now(), y: e.clientY }], from: cur };
  });
  grab.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const dy = e.clientY - drag.y0;
    if (!drag.moved && Math.abs(dy) > 6) { drag.moved = true; el.classList.add('dragging'); }
    if (!drag.moved) return;
    const px = clamp(drag.h0 - dy, heights.peek, heights.full);
    el.style.height = `${px}px`;
    drag.px = px;
    drag.samples.push({ t: Date.now(), y: e.clientY });
    if (drag.samples.length > 8) drag.samples.shift();
  });
  const end = (e, cancelled = false) => {
    if (!drag || drag.id !== e.pointerId) return;
    const d = drag; drag = null;
    el.classList.remove('dragging');
    try { grab.releasePointerCapture(e.pointerId); } catch { /* jsdom */ }
    if (cancelled) { apply(false); return; }
    if (!d.moved) { if (Date.now() - d.t0 < 600) next(); return; }
    const now = Date.now();
    d.samples.push({ t: now, y: e.clientY });
    const recent = d.samples.filter((q) => now - q.t <= 120); // doigt arrêté avant de se lever : pas d'inertie
    const vy = recent.length >= 2 ? (recent[recent.length - 1].y - recent[0].y) / Math.max(1, recent[recent.length - 1].t - recent[0].t) : 0;
    setState(settleState(d.px ?? px0(), heights, vy, d.from));
    apply(true);
  };
  grab.addEventListener('pointerup', (e) => end(e));
  grab.addEventListener('pointercancel', (e) => end(e, true));
  grab.addEventListener('click', (e) => { if (e.detail === 0) next(); }); // clavier / lecteur d'écran
  grab.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); setState(upState(cur)); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setState(downState(cur)); }
    else if (e.key === 'Home') { e.preventDefault(); setState('peek'); }
    else if (e.key === 'End') { e.preventDefault(); setState('full'); }
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && cur !== 'peek' && !e.defaultPrevented) { e.stopPropagation(); setState('peek'); grab.focus(); }
  });

  // champ actif toujours visible (clavier)
  const onFocusIn = (e) => {
    const t = e.target;
    if (!t || !t.matches || !t.matches('input, textarea, select, [contenteditable]')) return;
    if (cur === 'peek' && !isColumnLayout()) setState('half');
    const go = () => revealInside(inner, t);
    go(); setTimeout(go, 120); setTimeout(go, 350);
  };
  el.addEventListener('focusin', onFocusIn);

  let ro = null;
  if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(() => layout()); ro.observe(container); }
  apply(false);

  return {
    el, grab, sum, inner, getState: () => cur, setState, next, layout, selectTab,
    pane: (id) => panes[id] || null,
    setKeyboard(open) {
      if (open === kb) return;
      kb = open;
      layout();
      if (open && document.activeElement && inner.contains(document.activeElement)) {
        setState('full', { animate: false });
        revealInside(inner, document.activeElement);
      }
    },
    onState(f) { listeners.add(f); return () => listeners.delete(f); },
    destroy() { if (ro) ro.disconnect(); listeners.clear(); el.remove(); container.style.removeProperty('--ws-sheet-h'); },
  };
}

// ---------- sélecteur d'étapes ----------
/** Feuille « Aller à l'étape » : liste des étapes, saut libre. → close() */
export function openStepPicker({ steps, current, go, doneBefore = current }) {
  const prev = document.activeElement;
  const close = () => { overlay.remove(); if (prev && prev.focus) { try { prev.focus(); } catch { /* */ } } };
  const items = steps.map((s, i) => h('button', {
    type: 'button', class: 'ws-pick' + (i === current ? ' current' : ''), 'data-step-pick': s.id, role: 'option',
    'aria-selected': String(i === current), 'aria-current': i === current ? 'step' : null,
    onclick: () => { close(); if (i !== current) go(s.id); },
  }, h('span', { class: 'ws-pick-n' }, String(i + 1)), h('span', { class: 'ws-pick-i' }, s.icon || ''), h('span', { class: 'ws-pick-l' }, s.label),
  h('span', { class: 'ws-pick-s' }, i === current ? 'étape actuelle' : i < doneBefore ? '✓' : '')));
  const list = h('div', { class: 'ws-picklist', role: 'listbox', 'aria-label': 'Étapes de l’assistant' }, items);
  const dlg = h('div', { class: 'ws-pickbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Aller à l’étape', 'data-role': 'step-picker' },
    h('div', { class: 'ws-pickhead' }, h('b', null, 'Aller à l’étape'),
      h('button', { type: 'button', class: 'btn btn-sm', 'data-act': 'picker-close', onclick: close }, 'Fermer')),
    list);
  const overlay = h('div', {
    class: 'ws-overlay',
    onclick: (e) => { if (e.target === overlay) close(); },
    onkeydown: (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const i = items.indexOf(document.activeElement);
        const j = clamp((i < 0 ? current : i) + (e.key === 'ArrowDown' ? 1 : -1), 0, items.length - 1);
        items[j].focus();
      }
    },
  }, dlg);
  document.body.append(overlay);
  (items[current] || items[0]).focus();
  return close;
}

// ---------- l'atelier (mise en page de l'assistant) ----------
/**
 * Active/désactive l'atelier plein écran sur la coque de l'assistant.
 * parts : {header, stepsEl, title, body, footer} ; steps : STEPS ; current : index ; go(id) ; garden.
 */
export function enterWorkshop(app, { header, stepsEl, title, body, footer, steps = [], current = 0, go = () => {}, garden = null, startOn = false } = {}) {
  injectWorkshopStyles();
  const sheets = new Set();
  const ctrl = {
    on: false, full: false, el: app, sheets,
    set(on) { on ? enable() : disable(); },
    isOn: () => ctrl.on,
    setFullscreen(v) { setFull(!!v); },
    openPicker() { return openStepPicker({ steps, current, go }); },
    leave() { disable(); },
    kb: { open: false, inset: 0 },
  };
  let stopKb = null;
  let menuBtn = null;
  let menu = null;
  let exitBtn = null;
  let titleText = null;
  let onDocDown = null;
  const root = document.documentElement;

  const applyViewport = (m) => {
    ctrl.kb = m;
    const vh = window.visualViewport ? m.height : window.innerHeight;
    if (vh > 0) { app.style.setProperty('--ws-h', `${vh}px`); app.classList.add('ws-vv'); }
    app.style.setProperty('--ws-top', `${m.top || 0}px`);
    app.classList.toggle('ws-kb', !!m.open);
    sheets.forEach((s) => s.setKeyboard(!!m.open));
    if (m.open) { try { window.scrollTo(0, 0); } catch { /* jsdom */ } }
  };

  function closeMenu() {
    if (menu) { menu.remove(); menu = null; }
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
    if (onDocDown) { document.removeEventListener('pointerdown', onDocDown, true); onDocDown = null; }
  }
  function openMenu() {
    if (menu) { closeMenu(); return; }
    const status = (document.getElementById('save-status') || {}).textContent || '';
    const item = (label, act, fn) => h('button', { type: 'button', role: 'menuitem', class: 'ws-mi', 'data-act': act, onclick: () => { closeMenu(); fn(); } }, label);
    menu = h('div', { class: 'ws-menu', role: 'menu', 'data-role': 'ws-menu', 'aria-label': 'Menu de l’atelier' },
      h('div', { class: 'ws-mstatus', role: 'status' }, status || 'Enregistrement automatique'),
      item('🧭 Aller à l’étape…', 'menu-steps', () => ctrl.openPicker()),
      item('⛶ Plein écran', 'menu-fullscreen', () => setFull(true)),
      garden && garden.status === 'validated'
        ? h('a', { class: 'ws-mi', role: 'menuitem', href: `#/garden/${encodeURIComponent(garden.id)}/advice`, 'data-act': 'menu-advice', onclick: closeMenu }, '💡 Conseils') : null,
      item('📄 Exporter en PDF', 'menu-pdf', () => { import('./pdf-dialog.js').then((m) => m.openPdfDialog({ garden })).catch((e) => console.error(e)); }));
    app.append(menu);
    menuBtn.setAttribute('aria-expanded', 'true');
    const first = menu.querySelector('.ws-mi'); if (first) first.focus();
    menu.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeMenu(); menuBtn.focus(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const its = [...menu.querySelectorAll('.ws-mi')]; const i = its.indexOf(document.activeElement);
        its[(i + (e.key === 'ArrowDown' ? 1 : -1) + its.length) % its.length].focus();
      }
    });
    onDocDown = (e) => { if (menu && !menu.contains(e.target) && e.target !== menuBtn) closeMenu(); };
    document.addEventListener('pointerdown', onDocDown, true);
  }

  function setFull(v) {
    ctrl.full = v;
    app.classList.toggle('ws-full', v);
    if (v && !exitBtn) {
      exitBtn = h('button', { type: 'button', class: 'ws-exit-full', 'data-role': 'ws-exit-full', 'aria-label': 'Quitter le plein écran', onclick: () => setFull(false) }, '⤡');
      app.append(exitBtn);
    }
    if (!v && exitBtn) { exitBtn.remove(); exitBtn = null; }
    sheets.forEach((s) => s.layout());
  }

  function enable() {
    if (ctrl.on) return;
    ctrl.on = true;
    app.classList.add('ws-on');
    root.classList.add('ws-lock');
    app._ws = ctrl;
    if (title) {
      titleText = title.textContent;
      const b = h('button', { type: 'button', class: 'ws-title-btn', 'data-role': 'step-title-btn', 'aria-haspopup': 'dialog', title: 'Aller à une autre étape', onclick: () => ctrl.openPicker() }, titleText);
      title.replaceChildren(b);
    }
    if (header) {
      menuBtn = h('button', { type: 'button', class: 'btn btn-icon ws-menu-btn', 'data-role': 'ws-menu-btn', 'aria-label': 'Menu de l’atelier', 'aria-haspopup': 'menu', 'aria-expanded': 'false', onclick: openMenu }, '⋯');
      header.append(menuBtn);
    }
    if (stepsEl) stepsEl.querySelectorAll('.step').forEach((b) => { b.dataset.wsLabel = b.getAttribute('aria-label') || ''; });
    stopKb = observeKeyboard(applyViewport);
  }
  function disable() {
    if (!ctrl.on) return;
    closeMenu();
    setFull(false);
    ctrl.on = false;
    if (stopKb) { stopKb(); stopKb = null; }
    app.classList.remove('ws-on', 'ws-kb', 'ws-vv', 'ws-full');
    app.style.removeProperty('--ws-h'); app.style.removeProperty('--ws-top');
    root.classList.remove('ws-lock');
    if (title && titleText != null) { title.textContent = titleText; titleText = null; }
    if (menuBtn) { menuBtn.remove(); menuBtn = null; }
    if (app._ws === ctrl) delete app._ws;
  }

  if (startOn) enable();
  return ctrl;
}

/**
 * Adopte un éditeur de dessin / de rendu dans l'atelier. Sans atelier actif (`.ws-on` absent) → null
 * (l'éditeur garde sa mise en page habituelle).
 * cfg : {
 *   wrap        zone de dessin (reçoit la pastille du nord et les boutons flottants),
 *   canvas      élément dimensionné par l'atelier (par défaut wrap),
 *   tools       éléments → rangée d'outils superposée en haut du plan,
 *   fab         éléments → boutons flottants à droite (zoom, recentrer, 3D…),
 *   summary     élément de la ligne de résumé (ex. .jd-info), primary : bouton principal contextuel,
 *   sheetTop / sheet   éléments dans la feuille (avant / après les onglets),
 *   tabs        [{id, label, nodes}] : feuille à onglets,
 *   footer      éléments à mettre dans la barre du bas (remplacent ses boutons),
 *   want        () => ({key, state}) : hauteur utile ; la feuille ne bouge que quand `key` change,
 * }
 * @returns {{sheet, sync, destroy, tools, fab}|null}
 */
export function adoptWorkshop(root, cfg = {}) {
  const app = root && root.closest ? root.closest('.ws-on') : null;
  if (!app) return null;
  const ctrl = app._ws || null;
  const moved = [];
  const created = [];
  const put = (node, dest, before = null) => {
    if (!node) return;
    moved.push({ node, parent: node.parentNode, next: node.nextSibling });
    dest.insertBefore(node, before);
  };
  const wrap = cfg.wrap;
  const canvas = cfg.canvas || wrap;
  root.classList.add('ws-editor');
  if (canvas) canvas.classList.add('ws-canvas');

  const tools = (cfg.tools || []).filter(Boolean);
  let toolsRow = null;
  if (tools.length) {
    toolsRow = h('div', { class: 'ws-tools', role: 'toolbar', 'aria-label': 'Outils du plan', 'data-role': 'ws-tools' });
    root.insertBefore(toolsRow, canvas || root.firstChild);
    created.push(toolsRow);
    tools.forEach((t) => put(t, toolsRow));
  }
  root.dataset.wsTools = toolsRow ? '1' : '0';

  let fab = null;
  const fabEls = (cfg.fab || []).filter(Boolean);
  if (fabEls.length && wrap) {
    fab = h('div', { class: 'ws-fab', 'data-role': 'ws-fab' });
    wrap.append(fab);
    created.push(fab);
    fabEls.forEach((b) => put(b, fab));
  }

  const sheet = createSheet(root, { label: cfg.label || 'Détails et réglages', tabs: cfg.tabs || null });
  created.push(sheet.el);
  if (ctrl) { ctrl.sheets.add(sheet); }
  if (cfg.summary) put(cfg.summary, sheet.sum, sheet.sum.firstChild);
  if (cfg.primary) { cfg.primary.classList.add('ws-primary'); put(cfg.primary, sheet.sum); }
  const topNodes = (cfg.sheetTop || []).filter(Boolean);
  topNodes.forEach((n) => put(n, sheet.inner, sheet.inner.firstChild));
  (cfg.sheet || []).filter(Boolean).forEach((n) => put(n, sheet.inner));

  // barre du bas (Rendu : ← Modifier / Valider) : remplace temporairement les boutons Précédent / Suivant
  let footerEl = null; let footerSaved = null; let footerCur = [];
  const setFooter = (nodes) => {
    footerEl = footerEl || app.querySelector('.wizard-nav');
    if (!footerEl) return;
    if (!footerSaved) { footerSaved = [...footerEl.childNodes]; footerSaved.forEach((n) => n.remove()); }
    footerCur.forEach((n) => n.remove());
    footerCur = (nodes || []).filter(Boolean);
    footerCur.forEach((n) => footerEl.append(n));
    footerEl.classList.add('ws-custom');
  };
  if (cfg.footer) setFooter(cfg.footer);

  // aucun défilement parasite (scrollIntoView, focus) ne doit décaler l'atelier : seule la feuille défile
  const unscroll = (e) => { const t = e.currentTarget; if (t.scrollTop) t.scrollTop = 0; if (t.scrollLeft) t.scrollLeft = 0; };
  const locks = [root, sheet.el, app.querySelector('.step-body')].filter(Boolean);
  locks.forEach((n) => n.addEventListener('scroll', unscroll));

  let lastKey = null;
  const sync = () => {
    if (!cfg.want) return;
    const w = cfg.want();
    if (!w) return;
    if (w.key !== lastKey) {
      const first = lastKey === null;
      lastKey = w.key;
      if (w.state) sheet.setState(w.state, { animate: !first });
    }
  };
  sync();
  sheet.layout();

  return {
    sheet, tools: toolsRow, fab, sync, setFooter,
    destroy() {
      if (ctrl) ctrl.sheets.delete(sheet);
      locks.forEach((n) => n.removeEventListener('scroll', unscroll));
      try { sheet.destroy(); } catch { /* ok */ }
      for (let i = moved.length - 1; i >= 0; i--) {
        const m = moved[i];
        try {
          if (m.parent && m.parent.isConnected !== false) m.parent.insertBefore(m.node, m.next && m.next.parentNode === m.parent ? m.next : null);
          else m.node.remove();
        } catch { /* ok */ }
      }
      if (footerEl && footerSaved) { footerCur.forEach((n) => n.remove()); footerSaved.forEach((n) => footerEl.append(n)); footerEl.classList.remove('ws-custom'); }
      created.forEach((n) => { try { n.remove(); } catch { /* ok */ } });
      if (canvas) canvas.classList.remove('ws-canvas');
      root.classList.remove('ws-editor');
      delete root.dataset.wsTools;
    },
  };
}
