// Onglet « Existant » de l'éditeur d'aménagements : palette de types, bandeau de l'élément sélectionné
// (espèce du catalogue, taille actuelle en cm, à conserver / à retirer, notes). Pas de logique de gestes ici.
import { searchPlants, allPlants, getPlant } from '../catalog.js';
import { fenceMarkup } from '../render-items.js';
import {
  EXISTING_KINDS, EXISTING_AGES, FENCE_MATERIALS, getExistingKind, getFenceMaterial, existingLabel, existingSummary, sizeForPlant,
} from '../existing.js';
import { MATERIALS } from '../items.js';
import { h, parseLength } from './draw-util.js';
import { checkHeight, heightMessage, formatHeight } from '../heights.js';

const cm = (m) => `${Math.round(m * 100)}`;
const safeHex = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '#7a9a5a');

/** Essences proposées pour un type (types voisins d'abord), filtrées par la saisie. */
export function plantResults(kindId, query, limit = 8) {
  const k = getExistingKind(kindId);
  const q = String(query || '').trim();
  const list = (q ? searchPlants(q) : allPlants()).slice();
  const pref = (p) => (k && k.category.includes(p.category) ? 0 : 1);
  list.sort((a, b) => pref(a) - pref(b) || String(a.commonName).localeCompare(String(b.commonName), 'fr'));
  return list.slice(0, limit);
}

/** Pastille d'aperçu du motif d'un matériau de clôture (SVG en ligne). */
export function materialPreview(materialId) {
  const pts = [{ x: 4, y: 12 }, { x: 36, y: 12 }];
  const wrap = h('span', { class: 'jdi-mat-prev', 'aria-hidden': 'true' });
  wrap.innerHTML = `<svg viewBox="0 0 40 24" width="40" height="24"><rect width="40" height="24" rx="6" fill="#f4f1e6"/>${fenceMarkup(pts, materialId, { u: 1, thick: 0.1, scale: 40 })}</svg>`;
  return wrap;
}

/** Choix du matériau d'une clôture existante : 3 pastilles. */
export function materialChoice(current, onPick, ids = FENCE_MATERIALS.map((m) => m.id), attr = 'data-fence-material') {
  return h('div', { class: 'jdi-seg jdi-mats', role: 'group', 'aria-label': 'Matériau', 'data-role': 'fence-materials' },
    ids.map((id) => h('button', {
      type: 'button', class: 'jdi-mat', [attr]: id, 'aria-pressed': String(current === id), 'aria-label': MATERIALS[id].label,
      onclick: (ev) => { ev.stopPropagation(); onPick(id); },
    }, materialPreview(id), h('span', null, MATERIALS[id].label))));
}

/**
 * Palette des types existants. `api` : {st, say, draw, refreshUI, pickMaterial}.
 */
export function renderExistingPalette(panel, api) {
  const { st } = api;
  const row = h('div', { class: 'jdi-palette', 'data-role': 'existing-kinds' });
  if (st.exDraft) {
    const k = getExistingKind(st.exDraft.kind);
    row.append(
      api.btn('✔ Terminer', 'ex-finish', api.finishDraft, 'primary', { disabled: st.exDraft.points.length < 2 }),
      api.btn('↩ Retirer le dernier point', 'ex-undo', () => { st.exDraft.points.pop(); api.draw(); api.refreshUI(); }, '', { disabled: !st.exDraft.points.length }),
      api.btn('✕ Annuler', 'ex-cancel', api.cancelDraft));
    void k;
    panel.append(row);
    return;
  }
  for (const k of EXISTING_KINDS.filter((x) => x.palette !== false)) {
    const dims = k.id === 'fence' ? `${cm(getFenceMaterial(st.fenceMaterial).height)} cm` : `${cm(k.height)}×${cm(k.width)} cm`;
    const pressed = st.exKind === k.id;
    const pick = () => api.pickKind(pressed ? null : k.id);
    if (k.id === 'fence') {
      row.append(h('div', { class: 'jdi-card jdi-card-fence', 'data-ex-card': 'fence', 'aria-pressed': String(pressed) },
        h('button', { type: 'button', class: 'jdi-fence-main', 'data-ex-kind': 'fence', 'aria-pressed': String(pressed), onclick: pick },
          h('span', { class: 'jdi-pastille', style: { background: getFenceMaterial(st.fenceMaterial).color } }, k.emoji),
          h('span', { class: 'jdi-card-name' }, k.label), h('span', { class: 'jdi-card-meta' }, `${dims} · tracé`)),
        materialChoice(st.fenceMaterial, (id) => { api.pickMaterial(id); })));
      continue;
    }
    row.append(h('button', {
      type: 'button', class: 'jdi-card', 'data-ex-kind': k.id, 'aria-pressed': String(pressed),
      'aria-label': `${k.label}, ${dims}`, onclick: pick,
    }, h('span', { class: 'jdi-pastille', style: { background: k.color } }, k.emoji),
    h('span', { class: 'jdi-card-name' }, k.label),
    h('span', { class: 'jdi-card-meta' }, `${dims}${k.linear ? ' · tracé' : ''}`)));
  }
  panel.append(row);
}

/** Bandeau de l'élément sélectionné. `api` : {st, g, e, mutate, ...}. */
export function renderExistingDetail(detail, api) {
  const { st, e } = api;
  if (!e) return;
  const k = getExistingKind(e.kind);
  const plant = e.plantId ? getPlant(e.plantId) : null;
  const isFence = e.kind === 'fence';
  const out = api.isOutside(e);
  const lab = isFence ? `Clôture ${getFenceMaterial(e.material).label.toLowerCase()}` : existingLabel(e);
  const kids = [];
  kids.push(h('div', { class: 'jdi-detail-title', 'data-role': 'sel-banner' }, `${k.emoji} ${e.label && e.label !== k.defaultLabel ? e.label : lab}`,
    h('small', null, `${isFence ? `hauteur ${cm(e.height)} cm` : `${cm(e.height)} cm de haut × ${cm(e.width)} cm de large`} · ${e.keep === false ? 'à retirer ou remplacer' : 'à conserver'}${plant ? ` · ${plant.latinName || ''}` : ''}`),
    out ? h('span', { class: 'jdi-warn' }, '⚠ sort du terrain') : null));

  if (isFence) {
    kids.push(materialChoice(e.material, (id) => api.setMaterial(e, id)));
  } else {
    // « Quelle plante ? »
    const results = h('div', { class: 'jdi-palette jdi-plants', 'data-role': 'plant-results' });
    const fill = () => {
      results.replaceChildren();
      for (const p of plantResults(e.kind, st.exQuery)) {
        results.append(h('button', {
          type: 'button', class: 'jdi-card jdi-plant', 'data-plant': p.id, 'aria-pressed': String(e.plantId === p.id),
          'aria-label': `${p.commonName}, ${p.latinName || ''}`, onclick: () => api.choosePlant(e, p),
        }, h('span', { class: 'jdi-pastille', style: { background: safeHex(p.foliageColor) } }, ''),
        h('span', { class: 'jdi-card-name' }, p.commonName), h('span', { class: 'jdi-card-meta jdi-latin' }, p.latinName || '')));
      }
      if (!results.children.length) results.append(h('span', { class: 'jd-msg' }, 'Aucune essence trouvée : utilisez « Je ne sais pas / autre ».'));
    };
    const search = h('input', {
      class: 'jd-input jdi-search', type: 'search', placeholder: 'Quelle plante ? (nom ou nom latin)', 'aria-label': 'Quelle plante ?',
      'data-field': 'plant-search', value: st.exQuery || '', enterkeyhint: 'search',
    });
    search.addEventListener('input', () => { st.exQuery = search.value; fill(); });
    const other = api.btn('Je ne sais pas / autre', 'plant-other', () => api.unknownPlant(e, search.value), '', { title: 'Espèce inconnue ; le texte saisi sert de nom libre' });
    kids.push(h('div', { class: 'jdi-row2 jdi-plant-box' },
      h('div', { class: 'jdi-plant-head' }, h('b', null, 'Quelle plante ?'), plant ? h('span', { class: 'jdi-picked', 'data-role': 'plant-picked' }, `✔ ${plant.commonName}`) : h('span', { class: 'jdi-picked jdi-unknown' }, 'espèce non précisée')),
      h('div', { class: 'jdi-plant-search' }, search, other), results));
    fill();
    if (plant) {
      kids.push(h('div', { class: 'jdi-seg jdi-row2', role: 'group', 'aria-label': 'Âge de la plante' },
        h('span', { class: 'jd-unit' }, 'Âge :'),
        EXISTING_AGES.map((a) => api.btn(a.label, `age-${a.id}`, () => api.setAge(e, plant, a.id), '', { 'data-age': a.id, 'aria-pressed': String(st.exAge === a.id) }))));
    }
  }
  // tailles en cm
  const num = (key, label, val, set) => {
    const inp = h('input', { class: 'jd-input', type: 'text', inputmode: 'numeric', 'aria-label': `${label} en centimètres`, 'data-field': key, value: cm(val) });
    inp.addEventListener('change', () => { const v = parseLength(inp.value); if (Number.isFinite(v)) set(v); else api.refreshUI(); });
    inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); inp.blur(); } });
    return h('label', { class: 'jdi-size' }, h('span', null, label), inp, h('span', { class: 'jd-unit' }, 'cm'));
  };
  const defH = isFence ? getFenceMaterial(e.material).height : plant ? sizeForPlant(plant, st.exAge || 'adult', e.kind).height : k.height;
  const setHeight = (v) => { const chk = checkHeight(e.kind, v); const m = chk.ok ? chk.value : null; if (m == null) { api.say(heightMessage(e.kind), 'warn'); api.refreshUI(); return; } api.mutate(() => { e.height = m; }); if (chk.clamped) api.say(chk.message, 'warn'); };
  kids.push(h('div', { class: 'jdi-seg jdi-row2' },
    num('ex-height', 'Hauteur', e.height, setHeight),
    api.btn('↺ Valeur par défaut', 'height-reset', () => api.mutate(() => { e.height = defH; }), '', { 'aria-label': `Hauteur par défaut (${formatHeight(defH)})`, title: `Valeur par défaut : ${formatHeight(defH)}`, disabled: Math.abs((Number(e.height) || 0) - defH) < 0.005 }),
    isFence ? null : num('ex-width', 'Largeur', e.width, (v) => api.mutate(() => { e.width = v; }))));
  kids.push(h('div', { class: 'jdi-seg jdi-row2', role: 'group', 'aria-label': 'Devenir' },
    api.btn('✅ À conserver', 'keep', () => api.setKeep(e, true), '', { 'aria-pressed': String(e.keep !== false) }),
    api.btn('🪓 À retirer ou remplacer', 'remove', () => api.setKeep(e, false), '', { 'aria-pressed': String(e.keep === false) })));
  const notes = h('input', { class: 'jd-input jdi-notes', type: 'text', placeholder: 'Notes (état, remarques…)', 'aria-label': 'Notes', 'data-field': 'ex-notes', value: e.notes || '' });
  notes.addEventListener('change', () => api.mutate(() => { e.notes = notes.value.trim(); }));
  kids.push(h('div', { class: 'jdi-row2 jdi-seg' }, notes,
    api.btn('✎ Taille', 'edit', () => api.openPop(e)),
    api.btn('⧉', 'dup', () => api.duplicate(e), '', { 'aria-label': 'Dupliquer' }),
    api.btn('🗑', 'del', api.deleteSel, 'danger', { 'aria-label': 'Supprimer' })));
  detail.append(...kids);
}

/** Texte du compteur : « 3 existants : 2 arbres, 1 haie ». */
export const existingInfoText = (g) => existingSummary(g).text;

export { sizeForPlant };
