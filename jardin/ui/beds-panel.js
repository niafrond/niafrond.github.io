// Étape « Massifs » (mode auto) : cartes de massifs proposés, mini-calendrier de floraison, panneau de réglages.
// Fonctions de DOM sans état propre : l'état (brouillon, massifs) vit dans step-beds.js.
import { h } from './draw-util.js';
import { getPlant } from '../catalog.js';
import { formatEuro } from '../pricing.js';
import { ambianceChips, ambianceOf } from './ambiance-picker.js';
import { maintenanceChips } from './maintenance-picker.js';

export const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
export const MONTH_NAMES = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const BED_COLORS = ['#e8744f', '#7a6bd6', '#d9a21b', '#2f9e8f', '#d6568a', '#4f8fd4', '#8fb339', '#c0703d', '#9a5fc4', '#3c9a5f', '#d9843a', '#4f7fb0'];
export const bedColor = (i) => BED_COLORS[((i % BED_COLORS.length) + BED_COLORS.length) % BED_COLORS.length];

export const COVERAGE_PRESETS = [
  { id: 'few', label: 'Quelques massifs', value: 25 },
  { id: 'balanced', label: 'Équilibré', value: 50 },
  { id: 'lush', label: 'Foisonnant', value: 80 },
];
export const STYLES = [
  { id: 'mixed', label: 'Mixte', emoji: '🌿' },
  { id: 'borders', label: 'Bordures', emoji: '▭' },
  { id: 'islands', label: 'Îlots', emoji: '🏝' },
];
export const PALETTES = [
  { id: 'auto', label: 'Auto', color: 'linear-gradient(135deg,#e8744f,#d9a21b 35%,#4f8fd4 70%,#9a5fc4)' },
  { id: 'chaud', label: 'Chaude', color: '#e8744f' },
  { id: 'froid', label: 'Froide', color: '#5b7fd6' },
  { id: 'pastel', label: 'Pastel', color: '#f3c6d8' },
  { id: 'blanc', label: 'Blanche', color: '#f6f6ef' },
  { id: 'vif', label: 'Vive', color: '#e0307a' },
];
export const SUN_TEXT = { full: '☀️ plein soleil', partial: '⛅ mi-ombre', shade: '☁️ ombre' };

const hexOk = (c) => (typeof c === 'string' && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(c.trim()) ? c.trim() : null);
const fmt1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
const frSurf = (n) => `${fmt1(n)} m²`;

/** Phrase « mars à octobre » d'une liste de mois (1–12). */
export function monthsText(months) {
  const ms = [...new Set((months || []).filter((m) => m >= 1 && m <= 12))].sort((a, b) => a - b);
  if (!ms.length) return 'aucune floraison';
  const groups = [];
  for (const m of ms) {
    const last = groups[groups.length - 1];
    if (last && m === last[1] + 1) last[1] = m; else groups.push([m, m]);
  }
  return groups.map(([a, b]) => (a === b ? MONTH_NAMES[a - 1] : b === a + 1 ? `${MONTH_NAMES[a - 1]} et ${MONTH_NAMES[b - 1]}` : `${MONTH_NAMES[a - 1]} à ${MONTH_NAMES[b - 1]}`)).join(', ');
}

/** Mois de floraison d'un massif : résumé du moteur, sinon calculé depuis les essences. */
export function bloomMonthsOf(bed, lookup = getPlant) {
  if (bed && bed.summary && Array.isArray(bed.summary.bloomMonths) && bed.summary.bloomMonths.length) return [...bed.summary.bloomMonths];
  const s = new Set();
  for (const pl of (bed && bed.plantings) || []) {
    const p = lookup(pl.plantId);
    if (p && Array.isArray(p.bloom)) p.bloom.forEach((m) => s.add(m));
  }
  return [...s].sort((a, b) => a - b);
}

/** Mini-calendrier de floraison : 12 barres colorées (une par mois). */
export function bloomCalendar(months, { color = '#d6568a' } = {}) {
  const on = new Set(months || []);
  const bars = MONTH_LETTERS.map((l, i) => h('li', { class: 'bed-month' + (on.has(i + 1) ? ' on' : ''), 'data-month': String(i + 1), 'data-on': on.has(i + 1) ? '1' : '0', title: MONTH_NAMES[i] },
    h('span', { class: 'bed-bar', style: on.has(i + 1) ? `background:${color}` : '', 'aria-hidden': 'true' }),
    h('span', { class: 'bed-ml', 'aria-hidden': 'true' }, l)));
  return h('ul', { class: 'bed-cal', 'data-role': 'bloom-calendar', role: 'img', 'aria-label': `Floraison : ${monthsText(months)}` }, bars);
}

/** Couleurs de fleurs distinctes (hex) d'un massif. */
export function flowerColorsOf(bed, lookup = getPlant) {
  const out = [];
  for (const pl of (bed && bed.plantings) || []) {
    const p = lookup(pl.plantId);
    const c = p && hexOk(p.flowerColor);
    if (c && !out.includes(c.toLowerCase())) out.push(c.toLowerCase());
  }
  return out;
}

/** Charge paresseusement les photos Wikipédia des vignettes (repli coloré immédiat). */
export function createThumbLoader({ getPhoto, IO } = {}) {
  const IOImpl = IO !== undefined ? IO : (typeof window !== 'undefined' ? window.IntersectionObserver : null);
  let io = null;
  const pending = new Map();
  let dead = false;
  const load = (job) => {
    if (!getPhoto) return;
    Promise.resolve().then(() => getPhoto(job.plant)).then((ph) => {
      if (dead || !ph || !ph.url || !job.box.isConnected) return;
      const img = h('img', { src: ph.url, alt: '', decoding: 'async' });
      img.style.display = 'none';
      img.addEventListener('load', () => { img.style.display = ''; job.box.classList.add('has-photo'); job.box.replaceChildren(img); });
      img.addEventListener('error', () => img.remove());
      job.box.append(img);
    }).catch(() => {});
  };
  return {
    observe(box, plant) {
      const job = { box, plant };
      if (!IOImpl) { load(job); return; }
      if (!io) {
        io = new IOImpl((entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            const j = pending.get(e.target);
            if (j) { pending.delete(e.target); io.unobserve(e.target); load(j); }
          }
        }, { rootMargin: '150px' });
      }
      pending.set(box, job);
      io.observe(box);
    },
    destroy() { dead = true; pending.clear(); if (io) io.disconnect(); io = null; },
  };
}

/** Composition en vignettes : couleur fleur / feuillage, nom, quantité (photo si disponible). */
export function compositionList(bed, { lookup = getPlant, thumbs } = {}) {
  const rows = [];
  for (const pl of bed.plantings || []) {
    const p = lookup(pl.plantId);
    const fl = p && hexOk(p.flowerColor);
    const fo = p && hexOk(p.foliageColor);
    const box = h('span', { class: 'bed-thumb', style: `background:linear-gradient(135deg, ${fl || fo || '#7fb069'} 0%, ${fo || fl || '#7fb069'} 100%)`, 'aria-hidden': 'true' });
    if (p && thumbs) thumbs.observe(box, p);
    rows.push(h('li', { class: 'bed-comp', 'data-plant': pl.plantId },
      box,
      h('span', { class: 'bed-comp-txt' }, h('span', { class: 'bed-comp-name' }, p ? p.commonName : pl.plantId), h('span', { class: 'bed-comp-qty' }, `× ${pl.count}`))));
  }
  return h('ul', { class: 'bed-comps', 'data-role': 'bed-composition', 'aria-label': 'Composition du massif' }, rows);
}

/**
 * Carte d'un massif proposé. `info` : {index, name, locked, color, altLabel}.
 * `on` : {lock, remove, shuffle, ambiance, edit} (callbacks sans argument).
 */
export function bedCard(bed, info, on = {}, { lookup = getPlant, thumbs } = {}) {
  const months = bloomMonthsOf(bed, lookup);
  const flowers = flowerColorsOf(bed, lookup);
  const cost = bed.summary && Number.isFinite(bed.summary.costEur) ? bed.summary.costEur : null;
  const amb = ambianceOf(bed.ambiance);
  const btn = (act, label, fn, cls = '', extra = {}) => h('button', { type: 'button', class: `btn btn-sm ${cls}`, 'data-act': act, onclick: fn, ...extra }, label);
  const head = h('div', { class: 'bed-head' },
    h('span', { class: 'bed-num', style: `background:${info.color}`, 'aria-hidden': 'true' }, String(info.index + 1)),
    h('div', { class: 'bed-title' },
      h('strong', { 'data-role': 'bed-name' }, info.name),
      h('span', { class: 'muted small' }, `${frSurf(bed.areaM2)}${bed.widthM ? ` · ${fmt1(bed.widthM)} m de large` : ''}${bed.sunLevel ? ` · ${SUN_TEXT[bed.sunLevel]}` : ''}`)),
    info.locked ? h('span', { class: 'bed-lock', 'data-role': 'bed-locked', title: 'Massif gardé' }, '🔒') : null);
  return h('li', { class: 'bed-card' + (info.locked ? ' locked' : ''), 'data-bed': bed.id, style: `--bed:${info.color}` },
    head,
    bed.why ? h('p', { class: 'bed-why', 'data-role': 'bed-why' }, bed.why) : null,
    bed.plantsWhy ? h('p', { class: 'bed-plants-why small muted' }, bed.plantsWhy) : null,
    bloomCalendar(months, { color: info.color }),
    h('div', { class: 'bed-dots', 'data-role': 'bed-colors', 'aria-label': 'Couleurs des fleurs' },
      flowers.map((c) => h('i', { class: 'bed-dot', style: `background:${c}`, 'aria-hidden': 'true' })),
      amb ? h('span', { class: 'bed-amb small' }, `${amb.emoji} ${amb.label}`) : null,
      info.altLabel ? h('span', { class: 'bed-alt small muted' }, info.altLabel) : null,
      cost != null ? h('span', { class: 'bed-cost', 'data-role': 'bed-cost' }, `≈ ${formatEuro(cost, { digits: 0 })}`) : null),
    compositionList(bed, { lookup, thumbs }),
    h('div', { class: 'bed-actions' },
      btn('lock', info.locked ? '🔓 Libérer' : '🔒 Garder', () => on.lock && on.lock(), info.locked ? 'btn-on' : '', { 'aria-pressed': String(!!info.locked) }),
      btn('shuffle', '🎲 Autre combinaison', () => on.shuffle && on.shuffle()),
      btn('ambiance', '🎨 Ambiance', () => on.ambiance && on.ambiance()),
      btn('edit', '✏️ Modifier la forme', () => on.edit && on.edit()),
      btn('remove', '🗑 Retirer', () => on.remove && on.remove(), 'btn-danger')));
}

/**
 * Panneau de réglages. `st` = objet de réglages modifié sur place : {coverage (10–100), style, palette, ambiance, budget}.
 * `getMaint()`/`setMaint(id)` : niveau d'entretien du jardin. `onChange()` après chaque changement.
 */
export function settingsPanel(st, { getMaint, setMaint, onChange } = {}) {
  const changed = () => { if (onChange) onChange(); };
  const out = h('output', { class: 'bed-cov-out', 'data-role': 'coverage-out', 'aria-live': 'polite' }, `${st.coverage} %`);
  const range = h('input', {
    type: 'range', min: '10', max: '100', step: '5', value: String(st.coverage), id: 'bed-coverage', 'data-role': 'coverage', 'aria-label': 'Part du vide à remplir',
    oninput: (e) => { st.coverage = Number(e.target.value); out.textContent = `${st.coverage} %`; syncPresets(); changed(); },
  });
  const presetBtns = COVERAGE_PRESETS.map((p) => h('button', {
    type: 'button', class: 'amb-chip', role: 'radio', 'data-preset': p.id,
    onclick: () => { st.coverage = p.value; range.value = String(p.value); out.textContent = `${p.value} %`; syncPresets(); changed(); },
  }, p.label));
  function syncPresets() {
    presetBtns.forEach((b, i) => { const on = COVERAGE_PRESETS[i].value === st.coverage; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
  }
  syncPresets();

  const radio = (items, key, label, render) => {
    const box = h('div', { class: 'amb-chips bed-scroll', role: 'radiogroup', 'aria-label': label, 'data-role': `bed-${key}` });
    const btns = items.map((it) => h('button', {
      type: 'button', class: 'amb-chip', role: 'radio', [`data-${key}`]: it.id,
      onclick: () => { st[key] = it.id; sync(); changed(); },
    }, render(it)));
    function sync() { btns.forEach((b, i) => { const on = items[i].id === st[key]; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }); }
    box.append(...btns); sync();
    return box;
  };
  const styleBox = radio(STYLES, 'style', 'Style des massifs', (s) => [h('span', { class: 'amb-emoji', 'aria-hidden': 'true' }, s.emoji), ' ', s.label]);
  const paletteBox = radio(PALETTES, 'palette', 'Palette de couleurs', (p) => [h('i', { class: 'bed-pal', style: `background:${p.color}`, 'aria-hidden': 'true' }), ' ', p.label]);

  const ambBox = ambianceChips({ value: st.ambiance || null, none: 'Peu importe', ariaLabel: 'Ambiance globale', dataRole: 'bed-ambiance', onPick: (id) => { st.ambiance = id || null; changed(); } });
  ambBox.classList.add('bed-scroll');
  const maintBox = maintenanceChips({ value: getMaint ? getMaint() : 'green', ariaLabel: 'Niveau d’entretien du jardin', dataRole: 'bed-maintenance', onPick: (id) => { if (setMaint) setMaint(id || 'green'); changed(); } });
  const budget = h('input', {
    id: 'bed-budget', type: 'number', inputmode: 'decimal', min: '0', step: '10', placeholder: 'Sans limite', 'data-role': 'bed-budget',
    value: st.budget ? String(st.budget) : '',
    oninput: (e) => { const n = Number(String(e.target.value).replace(',', '.')); st.budget = Number.isFinite(n) && n > 0 ? n : null; changed(); },
  });

  const el = h('section', { class: 'card bed-settings', 'data-role': 'bed-settings' },
    h('h3', null, 'Quelle part du vide remplir ?'),
    h('div', { class: 'bed-cov' }, range, out),
    h('div', { class: 'amb-chips', role: 'radiogroup', 'aria-label': 'Quantité de massifs' }, presetBtns),
    h('h3', { class: 'bed-sub' }, 'Style'), styleBox,
    h('h3', { class: 'bed-sub' }, 'Palette de couleurs'), paletteBox,
    h('h3', { class: 'bed-sub' }, 'Ambiance globale'), ambBox,
    h('h3', { class: 'bed-sub' }, 'Entretien du jardin'), maintBox,
    h('div', { class: 'field bed-sub' }, h('label', { for: 'bed-budget' }, 'Budget max en € (facultatif)'), budget));
  return { el, sync: () => { syncPresets(); ambBox.setValue(st.ambiance || null); } };
}
