// Aperçu plein cadre « Revoir le plan et la 3D » : plan illustré, vue 3D temps réel, vues isométriques.
// Réutilisable depuis n'importe quel écran : openPreview(garden, {zoneId, tab, onClose, onSelectZone}) → {close, ...}.
import { renderPlanSVG } from '../render.js';
import { renderViewSVG, VIEWS } from '../render3d.js';
import { getPlant } from '../catalog.js';
import { createPanZoom } from './draw-util.js';

const W = 1000, H = 760;
const TABS = [['zones', '🗺️ Zones'], ['3d', '🧊 Vue 3D'], ['iso', '📐 Isométrique']];
const ISO = VIEWS.filter((v) => v.id.startsWith('iso-'));
const CSS = `
.pv-overlay{position:fixed;inset:0;z-index:900;display:flex;flex-direction:column;background:var(--bg,#f4f7f2);color:var(--text,#1d2a21);font:16px/1.4 system-ui,sans-serif;padding:var(--sat,env(safe-area-inset-top,0px)) var(--sar,env(safe-area-inset-right,0px)) var(--sab,env(safe-area-inset-bottom,0px)) var(--sal,env(safe-area-inset-left,0px))}
.pv-head{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border,#d3ddd5)}
.pv-head h2{flex:1;margin:0;font-size:1.05rem;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pv-btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:44px;padding:0 14px;border-radius:12px;border:1px solid var(--border,#d3ddd5);background:var(--surface,#fff);color:inherit;font:inherit;font-weight:600;cursor:pointer;touch-action:manipulation}
.pv-btn[aria-pressed=true],.pv-tabs [aria-selected=true]{background:var(--ok,#1f7a3d);color:#fff;border-color:var(--ok,#1f7a3d)}
.pv-tabs{display:flex;gap:6px;padding:8px 12px;overflow-x:auto}
.pv-tabs .pv-btn{flex:1 0 auto}
.pv-body{flex:1;min-height:0;display:flex;flex-direction:column;position:relative}
.pv-panel{flex:1;min-height:0;display:flex;flex-direction:column}
.pv-panel[hidden]{display:none}
.pv-view{flex:1;min-height:0;position:relative;overflow:hidden;touch-action:none;background:var(--surface,#fff)}
.pv-content{position:absolute;left:0;top:0;transform-origin:0 0}
.pv-content svg{display:block}
.pv-zoom{position:absolute;right:10px;bottom:10px;display:flex;flex-direction:column;gap:6px}
.pv-info{padding:6px 12px;font-size:.9rem}
.pv-chip{display:inline-block;padding:2px 10px;border-radius:999px;background:var(--surface,#fff);border:1px solid var(--border,#d3ddd5)}
.pv-legend{max-height:28%;overflow:auto;padding:6px 12px;border-top:1px solid var(--border,#d3ddd5);font-size:.9rem}
.pv-legend ul{margin:2px 0 6px;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:4px 14px}
.pv-dot{display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:5px;vertical-align:-1px;border:1px solid rgba(0,0,0,.25)}
.pv-iso-bar{display:flex;gap:6px;padding:6px 12px;overflow-x:auto}
.pv-iso-bar .pv-btn{flex:1 0 auto}
.pv-3d{flex:1;min-height:0;position:relative;background:#0b1410}
.pv-msg{margin:8px 12px;padding:10px 12px;border-radius:10px;background:var(--surface,#fff);border:1px solid var(--border,#d3ddd5)}
.pv-plan g.pv-sel :is(path,polygon,circle,ellipse,rect,polyline){stroke:#ff9800 !important;stroke-width:3.5px !important}
.pv-plan g[data-zone]{cursor:pointer}
`;

function injectCss() {
  if (document.getElementById('pv-styles')) return;
  const s = document.createElement('style');
  s.id = 'pv-styles'; s.textContent = CSS;
  document.head.appendChild(s);
}

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
  return n;
}

async function loadView3D() {
  try { return await import('./view3d.js'); } catch { return null; }
}

/**
 * Ouvre l'aperçu plein cadre.
 * @param {object} garden jardin courant (lu à chaque affichage : reflète les plantations non encore enregistrées)
 * @param {{zoneId?:string, tab?:'zones'|'3d'|'iso', onClose?:Function, onSelectZone?:(id:string)=>void,
 *          view3d?:{isView3DCapable:Function, mountView3D:Function}}} opts `view3d` : module de vue 3D (injection pour les tests)
 * @returns {{close:Function, setTab:Function, selectZone:Function, refresh:Function, el:HTMLElement}}
 */
export function openPreview(garden, { zoneId = null, tab = 'zones', onClose, onSelectZone, view3d } = {}) {
  injectCss();
  let curTab = TABS.some((t) => t[0] === tab) ? tab : 'zones';
  let selected = zoneId;
  let isoView = 'iso-ne';
  let disposed = false;
  let un3d = null;
  let ignorePop = false;
  const viewers = [];
  const prevFocus = document.activeElement;

  const title = el('h2', { id: 'pv-title' }, `Plan et 3D · ${garden.name || 'votre jardin'}`);
  const closeBtn = el('button', { type: 'button', class: 'pv-btn', 'data-act': 'preview-close', 'aria-label': 'Fermer l’aperçu', onclick: () => close() }, '✕ Fermer');
  const head = el('div', { class: 'pv-head' }, title, closeBtn);
  const tabBar = el('div', { class: 'pv-tabs', role: 'tablist', 'aria-label': 'Vues' });
  const panels = {};
  const tabBtns = {};
  for (const [id, label] of TABS) {
    tabBtns[id] = el('button', { type: 'button', class: 'pv-btn', role: 'tab', 'data-tab': id, id: `pv-tab-${id}`, 'aria-controls': `pv-panel-${id}`, onclick: () => setTab(id) }, label);
    tabBar.append(tabBtns[id]);
    panels[id] = el('div', { class: 'pv-panel', role: 'tabpanel', id: `pv-panel-${id}`, 'aria-labelledby': `pv-tab-${id}`, 'data-panel': id, hidden: true });
  }
  const body = el('div', { class: 'pv-body' }, ...Object.values(panels));
  const root = el('div', { class: 'pv-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'pv-title', 'data-role': 'preview-overlay' }, head, tabBar, body);
  document.body.append(root);

  // ---------- visionneuse SVG avec pan/zoom tactile ----------
  function viewer(host, { plan = false } = {}) {
    const content = el('div', { class: 'pv-content' + (plan ? ' pv-plan' : ''), style: `width:${W}px;height:${H}px` });
    const view = el('div', { class: 'pv-view', 'data-role': plan ? 'plan-view' : 'iso-view' }, content);
    const pz = createPanZoom(view, content);
    const zbtn = (label, aria, fn) => el('button', { type: 'button', class: 'pv-btn', 'aria-label': aria, onclick: fn }, label);
    view.append(el('div', { class: 'pv-zoom' },
      zbtn('＋', 'Zoom avant', () => pz.zoomBy(1.4)), zbtn('－', 'Zoom arrière', () => pz.zoomBy(1 / 1.4)), zbtn('⤢', 'Ajuster à l’écran', () => pz.fit(W, H))));
    host.append(view);
    const v = { content, view, pz, set(svg) { content.innerHTML = svg; pz.fit(W, H); } };
    viewers.push(v);
    return v;
  }

  // ---------- onglet Zones ----------
  const zonesInfo = el('div', { class: 'pv-info', 'aria-live': 'polite', 'data-role': 'preview-zone-name' });
  const legendBox = el('div', { class: 'pv-legend', 'data-role': 'preview-legend' });
  const zonesView = viewer(panels.zones, { plan: true });
  panels.zones.prepend(zonesInfo);
  panels.zones.append(legendBox);

  const zoneName = (z) => z.label || z.type || 'Zone';
  function paintSelection() {
    zonesView.content.querySelectorAll('g[data-zone]').forEach((g) => g.classList.toggle('pv-sel', g.getAttribute('data-zone') === selected));
    const z = (garden.zones || []).find((q) => q.id === selected);
    zonesInfo.replaceChildren(z ? el('span', { class: 'pv-chip' }, `📍 Zone en cours : ${zoneName(z)}`) : 'Touchez une zone pour la sélectionner.');
  }
  const col = (p) => (p && (p.flowerColor || p.foliageColor)) || '#7fb069';
  function paintLegend() {
    const blocks = [];
    for (const z of garden.zones || []) {
      const items = (z.plantings || []).map((pl) => ({ p: getPlant(pl.plantId), n: pl.count || 1 })).filter((x) => x.p);
      if (!items.length) continue;
      blocks.push(el('div', { 'data-zone-legend': z.id }, el('strong', null, zoneName(z)),
        el('ul', null, items.map(({ p, n }) => el('li', null, el('span', { class: 'pv-dot', style: `background:${col(p)}`, 'aria-hidden': 'true' }), `${p.commonName} × ${n}`)))));
    }
    legendBox.replaceChildren(el('strong', null, 'Essences'), ...(blocks.length ? blocks : [el('p', { class: 'pv-info' }, 'Aucune essence choisie pour l’instant.')]));
  }
  function renderZones() {
    zonesView.set(renderPlanSVG(garden, { view: 'illustrated', width: W, height: H, idPrefix: 'pvp', layers: { legend: false, dims: false } }));
    paintSelection(); paintLegend();
  }
  function selectZone(id, notify = true) {
    selected = id;
    paintSelection();
    if (notify && onSelectZone) { try { onSelectZone(id); } catch (e) { console.error(e); } }
  }
  let down = null;
  zonesView.view.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  zonesView.view.addEventListener('click', (e) => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) return; // c'était un glissement
    let n = e.target;
    let g = n && n.closest ? n.closest('[data-zone]') : null;
    if (!g && n === zonesView.view && typeof document.elementFromPoint === 'function') { // capture du pointeur : cible rabattue sur la vue
      n = document.elementFromPoint(e.clientX, e.clientY);
      g = n && n.closest ? n.closest('[data-zone]') : null;
    }
    if (g && zonesView.content.contains(g)) selectZone(g.getAttribute('data-zone'));
  });

  // ---------- onglet Vue 3D ----------
  const host3d = el('div', { class: 'pv-3d', 'data-role': 'preview-3d' });
  const fallbackBox = el('div', { 'data-role': 'preview-3d-fallback', hidden: true, style: 'flex:1;min-height:0;display:flex;flex-direction:column' });
  panels['3d'].append(host3d, fallbackBox);
  let fallbackView = null;
  let started3d = false;
  async function start3d() {
    if (started3d || disposed) return;
    started3d = true;
    const mod = view3d || await loadView3D();
    if (disposed) return;
    let capable = false;
    try { capable = !!(mod && (mod.isView3DCapable || mod.isDesktop3DCapable) && (mod.isView3DCapable || mod.isDesktop3DCapable)()); } catch { capable = false; }
    if (capable && mod.mountView3D) {
      host3d.hidden = false; fallbackBox.hidden = true;
      try {
        un3d = mod.mountView3D(host3d, { garden, onClose: () => { stop3d(); setTab('zones'); } });
        return;
      } catch (e) { console.error(e); un3d = null; }
    }
    host3d.hidden = true; fallbackBox.hidden = false;
    fallbackBox.replaceChildren(el('p', { class: 'pv-msg', role: 'status', 'data-role': 'preview-3d-unavailable' }, 'Vue 3D indisponible sur cet appareil. Voici la vue isométrique à la place.'));
    fallbackView = viewer(fallbackBox);
    fallbackView.set(renderViewSVG(garden, { view: 'iso-ne', width: W, height: H, idPrefix: 'pv3' }));
  }
  function stop3d() {
    if (!un3d) return;
    const f = un3d; un3d = null; started3d = false;
    try { if (history.state && history.state.v3d) ignorePop = true; } catch { /* ignoré */ }
    try { f(); } catch { /* déjà démonté */ }
  }

  // ---------- onglet Isométrique ----------
  const isoBar = el('div', { class: 'pv-iso-bar', role: 'group', 'aria-label': 'Coin de vue' });
  const isoView_ = viewer(panels.iso);
  panels.iso.prepend(isoBar);
  function renderIso() {
    isoBar.replaceChildren(...ISO.map((v) => el('button', { type: 'button', class: 'pv-btn', 'data-view': v.id, 'aria-pressed': String(v.id === isoView),
      onclick: () => { isoView = v.id; renderIso(); } }, v.label)));
    isoView_.set(renderViewSVG(garden, { view: isoView, width: W, height: H, idPrefix: 'pvi' }));
  }

  // ---------- onglets ----------
  function setTab(id) {
    if (disposed || !panels[id]) return;
    if (curTab === '3d' && id !== '3d') stop3d();
    curTab = id;
    for (const [k] of TABS) {
      panels[k].hidden = k !== id;
      tabBtns[k].setAttribute('aria-selected', String(k === id));
      tabBtns[k].tabIndex = k === id ? 0 : -1;
    }
    if (id === 'zones') renderZones();
    else if (id === 'iso') renderIso();
    else if (id === '3d') {
      if (fallbackView) { fallbackView.set(renderViewSVG(garden, { view: 'iso-ne', width: W, height: H, idPrefix: 'pv3' })); }
      start3d();
    }
    if (id !== '3d') requestAnimationFrame(() => { if (!disposed) viewers.forEach((v) => { if (v.view.offsetParent) v.pz.fit(W, H); }); });
  }

  // ---------- fermeture : bouton, Échap, retour Android ----------
  let histPushed = false;
  try { history.pushState({ pv: true }, ''); histPushed = true; } catch { /* ignoré */ }
  const onPop = () => { if (disposed || un3d) return; if (ignorePop) { ignorePop = false; return; } histPushed = false; close(); };
  const onKey = (e) => { if (e.key === 'Escape' && !disposed) { e.preventDefault(); close(); } };
  window.addEventListener('popstate', onPop);
  document.addEventListener('keydown', onKey);

  function close() {
    if (disposed) return;
    disposed = true;
    window.removeEventListener('popstate', onPop);
    document.removeEventListener('keydown', onKey);
    if (un3d) { const f = un3d; un3d = null; try { f(); } catch { /* ignoré */ } }
    viewers.forEach((v) => { try { v.pz.destroy(); } catch { /* ignoré */ } });
    viewers.length = 0;
    root.remove();
    if (histPushed) { histPushed = false; try { history.back(); } catch { /* ignoré */ } }
    if (prevFocus && prevFocus.focus) { try { prevFocus.focus(); } catch { /* ignoré */ } }
    if (onClose) { try { onClose(); } catch (e) { console.error(e); } }
  }

  setTab(curTab);
  closeBtn.focus();
  return { close, setTab, selectZone: (id) => selectZone(id, false), refresh: () => setTab(curTab), el: root };
}
