// Calque d'étiquettes HTML de la vue 3D : pastilles projetées depuis les ancres 3D, désencombrées en espace écran,
// sélection d'une essence (mise en évidence + fiche). Indépendant de three.js : la projection est fournie par l'appelant.
import { h, svgEl } from './draw-util.js';
import { getPlantPhoto } from '../photos.js';
import { applyGrowth, declutter, occludedKeys, ficheRows, renderIdsOfEssence, estimateWidth, LABEL } from '../gl-labels.js';

/** Mesure de texte réelle (canvas) si disponible, sinon estimation. */
function makeMeasure() {
  let ctx = null; let tried = false;
  const ua = () => { try { return String(navigator.userAgent); } catch (e) { return ''; } };
  return (text, o = {}) => {
    if (!tried) {
      tried = true;
      try { if (!/jsdom/i.test(ua())) { const c = document.createElement('canvas'); ctx = c.getContext && c.getContext('2d'); } } catch (e) { ctx = null; }
    }
    if (!ctx) return estimateWidth(text, o);
    const size = o.size || 12;
    ctx.font = `${o.italic ? 'italic ' : ''}${o.bold ? '600 ' : ''}${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    return ctx.measureText(String(text || '')).width + 2;
  };
}

/**
 * @param {{root:HTMLElement, mobile?:boolean, project:(a:{x:number,y:number,z:number})=>{x:number,y:number,behind?:boolean}|null,
 *   viewport:()=>{width:number,height:number}, safeRects?:()=>{x:number,y:number,w:number,h:number}[],
 *   onHighlight?:(ids:Set<string>|null)=>void, onFocus?:(group:object)=>void}} cfg
 */
export function createLabelsUI({ root, mobile = false, project, viewport, safeRects = () => [], onHighlight = () => {}, onFocus = () => {}, cameraPos = () => null, getPhoto = getPlantPhoto }) {
  const layer = h('div', { class: 'v3d-labels', 'data-role': 'labels' });
  const leads = svgEl('svg', { class: 'v3d-leads', 'aria-hidden': 'true' });
  layer.append(leads);
  const card = h('div', { class: 'v3d-card', 'data-role': 'label-card', role: 'status', hidden: true });
  root.append(layer, card);
  const measure = makeMeasure();
  const st = { groups: [], base: [], names: true, latin: false, moving: false, selected: null, prev: [], last: [], growth: { age: 1, month: null } };
  const els = new Map(); // clé de groupe → {el, line, dot}
  let destroyed = false;

  const groupOf = (key) => st.groups.find((g) => g.key === key) || null;
  const essenceOf = (key) => { const g = groupOf(key); return g ? g.essence : null; };

  function clearDom() {
    for (const v of els.values()) { v.el.remove(); v.line.remove(); v.dot.remove(); }
    els.clear(); st.last = []; st.prev = [];
  }

  function renderCard() {
    const g = st.selected ? groupOf(st.selected) : null;
    if (!g) { card.hidden = true; card.textContent = ''; return; }
    card.hidden = false; card.textContent = '';
    const close = h('button', { type: 'button', class: 'v3d-card-close', 'aria-label': 'Fermer la fiche', 'data-act': 'card-close', onclick: () => clear() }, '✕');
    const plant = g.catalog || g.plant || null;
    const photoBox = h('div', { class: 'v3d-card-photo', 'data-role': 'card-photo', hidden: true });
    const credit = h('span', { class: 'v3d-card-credit' });
    if (plant && plant.id) {
      const key = st.selected;
      Promise.resolve().then(() => getPhoto(plant)).then((ph) => {
        if (!ph || !ph.url || st.selected !== key || !photoBox.isConnected) return;
        const img = h('img', { src: ph.medium || ph.url, alt: `Photo de ${g.name}`, decoding: 'async' });
        img.addEventListener('error', () => { if (img.src !== ph.url) img.src = ph.url; else photoBox.hidden = true; });
        img.addEventListener('load', () => { photoBox.hidden = false; credit.textContent = ph.credit || 'Photo : Wikipédia'; });
        photoBox.replaceChildren(img, credit);
      }).catch(() => {});
    }
    card.append(
      close,
      photoBox,
      h('strong', { class: 'v3d-card-name', 'data-role': 'card-name' }, g.name),
      g.latin ? h('em', { class: 'v3d-card-latin' }, g.latin) : null,
      h('dl', { class: 'v3d-card-rows' }, ficheRows(g).map((r) => [h('dt', null, r.label), h('dd', null, r.value)])),
    );
  }

  function highlight() {
    const g = st.selected ? groupOf(st.selected) : null;
    onHighlight(g ? renderIdsOfEssence(st.groups, g.essence) : null);
  }

  function select(key) {
    if (!groupOf(key)) return;
    st.selected = st.selected === key ? null : key;
    renderCard(); highlight(); update();
  }
  function clear() {
    if (st.selected == null) return false;
    st.selected = null; renderCard(); highlight(); update();
    return true;
  }
  /** Essence entière (ligne de la légende) : met en évidence, ouvre la fiche du groupe principal et demande le centrage. */
  function selectEssence(essence) {
    const gs = st.groups.filter((g) => g.essence === essence).sort((a, b) => b.priority - a.priority);
    if (!gs.length) return false;
    st.selected = gs[0].key;
    renderCard(); highlight(); update();
    try { onFocus(gs[0]); } catch (e) { /* ignoré */ }
    return true;
  }

  function sync(results) {
    const seen = new Set();
    const sel = st.selected ? essenceOf(st.selected) : null;
    for (const r of results) {
      seen.add(r.key);
      let v = els.get(r.key);
      if (!v) {
        const dot = h('i', { class: 'v3d-label-dot' });
        const name = h('span', { class: 'v3d-label-name' });
        const latin = h('span', { class: 'v3d-label-latin' });
        const el = h('button', { type: 'button', class: 'v3d-label', 'data-key': r.key, onclick: (e) => { e.stopPropagation(); select(r.key); } }, dot, h('span', { class: 'v3d-label-text' }, name, latin));
        const line = svgEl('line', { class: 'v3d-lead' });
        const adot = svgEl('circle', { class: 'v3d-lead-dot', r: 2.5 });
        layer.append(el); leads.append(line, adot);
        v = { el, line, dot: adot, nameEl: name, latinEl: latin, dotEl: dot };
        els.set(r.key, v);
        requestAnimationFrame(() => { if (!destroyed) el.classList.add('is-in'); });
      }
      const g = r.group;
      if (v.nameEl.textContent !== g.name) v.nameEl.textContent = g.name;
      const lat = r.latin ? g.latin : '';
      if (v.latinEl.textContent !== lat) v.latinEl.textContent = lat;
      v.el.classList.toggle('has-latin', !!lat);
      v.el.classList.toggle('is-selected', st.selected === r.key);
      v.el.classList.toggle('is-essence', !!sel && g.essence === sel && st.selected !== r.key);
      v.el.classList.toggle('is-ghost', !!g.ghost);
      v.el.setAttribute('aria-pressed', String(st.selected === r.key));
      v.el.setAttribute('aria-label', `${g.name}${g.source === 'existant' ? ' (existant)' : `, ${g.count} plant${g.count > 1 ? 's' : ''}`}`);
      v.dotEl.style.background = g.colors.foliage;
      v.dotEl.style.boxShadow = g.colors.flower ? `0 0 0 2px ${g.colors.flower}` : 'none';
      const { rect } = r;
      v.el.style.width = `${rect.w}px`; v.el.style.height = `${rect.h}px`;
      v.el.style.transform = `translate(${Math.round(rect.x)}px, ${Math.round(rect.y)}px)`;
      const toBottom = r.slot < 2;
      const tx = Math.max(rect.x + 6, Math.min(rect.x + rect.w - 6, r.ax));
      const ty = toBottom ? rect.y + rect.h : rect.y;
      v.line.setAttribute('x1', String(Math.round(tx))); v.line.setAttribute('y1', String(Math.round(ty)));
      v.line.setAttribute('x2', String(Math.round(r.ax))); v.line.setAttribute('y2', String(Math.round(r.ay)));
      v.dot.setAttribute('cx', String(Math.round(r.ax))); v.dot.setAttribute('cy', String(Math.round(r.ay)));
    }
    for (const [k, v] of els) if (!seen.has(k)) { v.el.remove(); v.line.remove(); v.dot.remove(); els.delete(k); }
  }

  /** Reprojette, désencombre et met le DOM à jour. `distance` : distance caméra / rayon de la scène. */
  function update({ distance = null } = {}) {
    if (destroyed) return [];
    if (st.lastDistance === undefined) st.lastDistance = null;
    if (Number.isFinite(distance)) st.lastDistance = distance;
    if (!st.names || !st.groups.length) { if (els.size) clearDom(); return []; }
    const vp = viewport();
    const proj = new Map();
    const hidden = occludedKeys(st.groups, cameraPos(), { keep: st.selected });
    for (const g of st.groups) { const p = project(g.anchor); if (p) proj.set(g.key, hidden.has(g.key) ? { ...p, visible: false } : p); }
    // le groupe sélectionné garde toujours son étiquette (priorité maximale)
    const gs = st.selected ? st.groups.map((g) => (g.key === st.selected ? { ...g, priority: 1e12 } : g)) : st.groups;
    const safe = (safeRects() || []).filter((r) => r && r.w > 0 && r.h > 0);
    const results = declutter(gs, proj, { viewport: vp, mobile, latin: st.latin, measure, safe, previous: st.prev, distance: st.lastDistance });
    st.prev = results; st.last = results;
    sync(results);
    return results;
  }

  const api = {
    el: layer, card,
    setGroups(groups) {
      st.base = groups; st.groups = applyGrowth(groups, st.growth);
      if (st.selected && !groupOf(st.selected)) st.selected = null;
      renderCard(); highlight(); update();
    },
    /** Âge (0–1) et mois : met à jour les hauteurs / ancres sans recalculer les groupes. */
    setGrowth(growth) {
      st.growth = { ...st.growth, ...growth };
      st.groups = applyGrowth(st.base, st.growth);
    },
    setOptions({ names, latin } = {}) {
      if (typeof names === 'boolean') st.names = names;
      if (typeof latin === 'boolean') st.latin = latin;
      layer.classList.toggle('is-off', !st.names);
      update();
    },
    /** Pendant un geste rapide (mobile) : masque le calque sans rien recalculer. */
    setMoving(on) { st.moving = !!on; layer.classList.toggle('is-moving', st.moving); },
    update, select, selectEssence, clear,
    selected: () => st.selected,
    selectedGroup: () => (st.selected ? groupOf(st.selected) : null),
    highlightIds: () => { const g = st.selected ? groupOf(st.selected) : null; return g ? renderIdsOfEssence(st.groups, g.essence) : null; },
    groups: () => st.groups,
    /** Étiquettes affichées : [{key, name, rect}] (tests). */
    visible: () => st.last.map((r) => ({ key: r.key, name: r.group.name, rect: { ...r.rect }, latin: r.latin })),
    cardEl: card,
    destroy() { destroyed = true; layer.remove(); card.remove(); els.clear(); },
  };
  void LABEL;
  return api;
}
