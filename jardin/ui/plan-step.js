// Étape « Rendu » : plan SVG (vue plan / illustrée) et vues sous différents angles (isométriques, élévations),
// âge, saison, calques, zoom, validation et export.
import { renderPlanSVG } from '../render.js';
import { renderViewSVG, renderContactSheet, VIEWS } from '../render3d.js';
import { monthLabel, MONTHS_SHORT } from '../render-common.js';
import { validateGarden } from '../model.js';
import { injectStyles, h, createPanZoom, saveBlob, esc } from './draw-util.js';

const VIEW_W = 1000;
const VIEWS_MAX_BYTES = 1.5e6; // taille totale maximale du plan + vues enregistrées dans le jardin
const ISO_VIEWS = ['iso-ne', 'iso-se', 'iso-sw', 'iso-nw'];

export function mountPlanStep(el, { garden, onValidate, onBack, onChange } = {}) {
  injectStyles();
  const g = garden;
  const st = {
    view: 'plan', vue: 'top', month: null, age: 'adult', layers: { dims: true, legend: true, sun: false, names: true }, msg: '', msgKind: '',
  };
  let destroyed = false;

  let VIEW_H = 760;
  const root = h('div', { class: 'jd jd-plan', 'data-role': 'plan-step' });
  const vueBar = h('div', { class: 'jd-bar jd-scroll', 'data-role': 'vue-bar', role: 'group', 'aria-label': 'Angle de vue' });
  const bar = h('div', { class: 'jd-bar' });
  const seasonOut = h('output', { 'data-role': 'season-label', style: { minWidth: '8.5em', fontSize: '14px', textAlign: 'right' } });
  const seasonRange = h('input', {
    type: 'range', min: '0', max: '12', step: '1', value: '0', 'data-role': 'season', 'aria-label': 'Saison',
    style: { flex: '1 1 140px', minWidth: '120px', height: '44px', accentColor: 'var(--jd-accent)' },
    oninput: (e) => { const v = Number(e.target.value); st.month = v >= 1 ? v : null; seasonOut.textContent = seasonText(); render(); },
  });
  const seasonBar = h('div', { class: 'jd-bar', 'data-role': 'season-bar' }, h('span', { style: { fontSize: '14px' } }, '🌸 Saison'), seasonRange, seasonOut);
  const checks = h('div', { class: 'jd-checks' });
  const details = h('details', { class: 'jd-details' }, h('summary', {}, '🗂 Calques'), checks);
  const view = h('div', { class: 'jd-view', 'data-role': 'plan-view' });
  const content = h('div', { class: 'jd-content', 'data-role': 'plan-content' });
  const zoom = h('div', { class: 'jd-zoom' });
  view.append(content, zoom);
  const issues = h('div', { class: 'jd-panel', hidden: true, 'data-role': 'plan-issues' });
  const msgEl = h('div', { class: 'jd-msg', role: 'status', 'aria-live': 'polite', 'data-role': 'plan-msg' });
  const actions = h('div', { class: 'jd-actions' });
  root.append(vueBar, bar, seasonBar, details, view, issues, msgEl, actions);
  el.innerHTML = '';
  el.appendChild(root);

  const btn = (label, act, onclick, cls = '', extra = {}) => h('button', { type: 'button', class: `jd-btn ${cls}`, 'data-act': act, onclick, ...extra }, label);
  const pz = createPanZoom(view, content);

  const seasonText = () => (st.month ? MONTHS_SHORT[st.month - 1] : monthLabel(null));
  const svgString = (opts = {}) => {
    const o = { age: st.age, month: st.month, layers: st.layers, width: VIEW_W, height: VIEW_H, ...opts };
    return st.vue === 'top' ? renderPlanSVG(g, { view: st.view, ...o }) : renderViewSVG(g, { view: st.vue, ...o });
  };
  const sizeToView = () => {
    const r = view.getBoundingClientRect();
    if (r.width > 50 && r.height > 50) VIEW_H = Math.round(Math.min(1500, Math.max(640, (VIEW_W * r.height) / r.width)));
  };
  const render = (refit = false) => {
    if (destroyed) return;
    sizeToView();
    content.innerHTML = svgString();
    const svg = content.querySelector('svg');
    if (svg) { svg.style.display = 'block'; }
    if (refit) pz.fit(VIEW_W, VIEW_H);
  };

  const say = (m, k = '') => { st.msg = m; st.msgKind = k; msgEl.textContent = m; msgEl.className = `jd-msg ${k}`; };

  function buildBar() {
    vueBar.innerHTML = '';
    for (const v of VIEWS) {
      vueBar.append(btn(v.label, `vue-${v.id}`, () => { st.vue = v.id; buildBar(); render(); }, '', { 'aria-pressed': String(st.vue === v.id) }));
    }
    bar.innerHTML = '';
    bar.append(
      btn('📐 Plan', 'view-plan', () => { st.view = 'plan'; st.vue = 'top'; buildBar(); render(); }, '', { 'aria-pressed': String(st.vue === 'top' && st.view === 'plan') }),
      btn('🎨 Illustré', 'view-illustrated', () => { st.view = 'illustrated'; st.vue = 'top'; buildBar(); render(); }, '', { 'aria-pressed': String(st.vue === 'top' && st.view === 'illustrated') }),
      btn('🌱 Jeunes plants', 'age-young', () => { st.age = st.age === 'young' ? 'adult' : 'young'; buildBar(); render(); }, '', { 'aria-pressed': String(st.age === 'young') }),
    );
    checks.innerHTML = '';
    for (const [k, label] of [['dims', 'Cotes'], ['legend', 'Légende'], ['sun', 'Ensoleillement'], ['names', 'Noms des essences']]) {
      checks.append(h('label', {}, h('input', { type: 'checkbox', 'data-layer': k, checked: st.layers[k], onchange: (e) => { st.layers[k] = e.target.checked; render(); } }), label));
    }
  }

  zoom.append(
    btn('＋', 'zoom-in', () => pz.zoomBy(1.4), '', { 'aria-label': 'Zoom avant' }),
    btn('－', 'zoom-out', () => pz.zoomBy(1 / 1.4), '', { 'aria-label': 'Zoom arrière' }),
    btn('⤢', 'zoom-fit', () => pz.fit(VIEW_W, VIEW_H), '', { 'aria-label': 'Ajuster à l\'écran' }),
  );

  const baseName = () => (g.name || 'jardin').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'jardin';

  const suffix = () => (st.vue === 'top' ? '' : `-${st.vue}`);
  async function exportSVG() {
    const blob = new Blob([svgString({ width: 2000, height: 1520, idPrefix: 'jx' })], { type: 'image/svg+xml' });
    const r = await saveBlob(blob, `plan-${baseName()}${suffix()}.svg`);
    say(r === 'shared' ? 'Plan partagé.' : r === 'cancelled' ? '' : 'Plan SVG exporté.');
  }
  async function exportSheet() {
    try {
      const blob = new Blob([renderContactSheet(g, { month: st.month, age: st.age })], { type: 'image/svg+xml' });
      const r = await saveBlob(blob, `${baseName()}-vues.svg`);
      say(r === 'shared' ? 'Vues partagées.' : r === 'cancelled' ? '' : 'Feuille de vues exportée.');
    } catch (e) { say('Export des vues impossible.', 'err'); }
  }
  async function exportPNG() {
    try {
      const W = 2000; const H = 1520;
      const svg = svgString({ width: W, height: H, idPrefix: 'jx' });
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('image')); img.src = url; });
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);
      URL.revokeObjectURL(url);
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      if (!blob) throw new Error('png');
      const r = await saveBlob(blob, `plan-${baseName()}${suffix()}.png`);
      say(r === 'shared' ? 'Plan partagé.' : r === 'cancelled' ? '' : 'Plan PNG exporté.');
    } catch (e) { say('Export PNG impossible sur cet appareil : utilisez l\'export SVG.', 'err'); }
  }

  function validate() {
    const v = validateGarden(g);
    issues.innerHTML = '';
    if (!v.ok) {
      issues.hidden = false;
      issues.append(h('h3', {}, 'Le plan ne peut pas être validé'), h('ul', { class: 'jd-warns', style: { color: 'var(--jd-err)' } }, v.errors.map((e) => h('li', {}, e))), h('div', { class: 'jd-msg' }, 'Corrigez ces points avec « Modifier », puis revalidez.'));
      say('Validation impossible.', 'err');
      return false;
    }
    if (v.warnings.length) {
      issues.hidden = false;
      issues.append(h('h3', {}, 'Points d\'attention'), h('ul', { class: 'jd-warns' }, v.warnings.map((w) => h('li', {}, w))));
    } else issues.hidden = true;
    g.status = 'validated';
    const layers = { dims: true, legend: true, sun: false, names: true };
    const plan = { ...(g.plan || {}), svg: renderPlanSVG(g, { view: 'plan', age: 'adult', month: st.month, layers, width: VIEW_W, height: VIEW_H }), validatedAt: new Date().toISOString() };
    delete plan.views;
    // vues isométriques jointes seulement si la taille totale reste raisonnable
    try {
      const views = {};
      let size = plan.svg.length;
      for (const id of ISO_VIEWS) { views[id] = renderViewSVG(g, { view: id, age: 'adult', month: st.month, layers, width: VIEW_W, height: VIEW_H }); size += views[id].length; }
      if (size < VIEWS_MAX_BYTES) plan.views = views;
    } catch { /* le dessus seul */ }
    g.plan = plan;
    say('Plan validé : les conseils sont débloqués.');
    if (onChange) onChange(g);
    if (onValidate) onValidate(g);
    buildActions();
    return true;
  }

  function buildActions() {
    actions.innerHTML = '';
    actions.append(
      btn('← Modifier', 'back', () => { if (onBack) onBack(); }),
      btn('⬇ SVG', 'export-svg', exportSVG),
      btn('🖼 PNG', 'export-png', exportPNG),
      btn('🧭 Toutes les vues', 'export-sheet', exportSheet),
      btn(g.status === 'validated' ? '✅ Revalider le plan' : '✅ Valider le plan', 'validate', validate, 'primary'),
    );
  }

  seasonOut.textContent = seasonText();
  buildBar(); buildActions(); render();
  if (g.status === 'validated' && g.plan && g.plan.validatedAt) say(`Plan validé le ${new Date(g.plan.validatedAt).toLocaleDateString('fr-FR')}.`);
  const refit = () => { if (!destroyed) { render(true); } };
  requestAnimationFrame(refit);
  setTimeout(refit, 80);
  void esc;
  return function unmount() { destroyed = true; pz.destroy(); el.innerHTML = ''; };
}
