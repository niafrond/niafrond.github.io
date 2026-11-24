// Étape 6 : choix des essences par zone (recommandations explicables).
import { h, toast, gardenHash } from './wizard.js';
import { getZoneType } from '../model.js';
import { getPlant, searchPlants } from '../catalog.js';
import { recommendForZone, suggestQuantity, checkCoherence, suggestSelection } from '../recommend.js';
import { shapeArea } from '../geometry.js';

const STATUS = { ideal: 'Idéale', possible: 'Possible', discouraged: 'Déconseillée' };
const SUNL = { full: 'soleil', partial: 'mi-ombre', shade: 'ombre' };
const WATER = { low: 'peu d’eau', medium: 'eau moyenne', high: 'beaucoup d’eau' };
const FOLIAGE = [['', 'Tous feuillages'], ['deciduous', 'Caduc'], ['evergreen', 'Persistant'], ['semi', 'Semi-persistant']];
const CHECKS = [
  ['melliferous', 'Mellifère'], ['edible', 'Comestible'], ['lowMaintenance', 'Faible entretien'],
  ['lowWater', 'Peu d’eau'], ['nonToxic', 'Non toxique'], ['nonInvasive', 'Non invasive'],
];
const PAGE = 30;
const qty = (q) => { const n = typeof q === 'number' ? q : q && (q.count ?? q.quantity); return Number.isFinite(n) && n > 0 ? Math.round(n) : 1; };

export function mountPlants(el, { garden, onChange }) {
  const change = () => onChange && onChange(garden);
  let zoneId = garden.zones[0] ? garden.zones[0].id : null;
  const filters = {};
  let query = '';
  let showDisc = false;
  let limit = PAGE;

  if (!garden.zones.length) {
    el.replaceChildren(h('section', { class: 'card' },
      h('h2', null, 'Aucune zone à garnir'),
      h('p', null, 'Dessinez d’abord des zones sur le plan pour choisir leurs essences.'),
      h('a', { class: 'btn btn-primary', href: gardenHash(garden.id, 'zones') }, '← Dessiner les zones')));
    return () => el.replaceChildren();
  }

  const warnBox = h('div', { class: 'warnings', 'aria-live': 'polite' });
  const chosenBox = h('div', { class: 'chosen' });
  const listBox = h('ul', { class: 'plant-list', 'aria-label': 'Essences recommandées' });
  const moreBox = h('div');
  const zone = () => garden.zones.find((z) => z.id === zoneId) || garden.zones[0];

  function drawWarnings() {
    let list = [];
    try { list = checkCoherence(garden) || []; } catch { /* */ }
    warnBox.replaceChildren(...list.map((w) => h('p', { class: w.level === 'warn' ? 'notice warn' : 'notice info', role: w.level === 'warn' ? 'alert' : null },
      (w.level === 'warn' ? '⚠️ ' : 'ℹ️ ') + w.text)));
  }

  function drawChosen() {
    const z = zone();
    const rows = (z.plantings || []).map((pl) => {
      const p = getPlant(pl.plantId);
      const input = h('input', { type: 'number', min: '1', max: '999', value: String(pl.count || 1), 'aria-label': `Quantité de ${p ? p.commonName : pl.plantId}`, class: 'qty',
        onchange: (e) => { pl.count = Math.max(1, Math.round(Number(e.target.value) || 1)); e.target.value = pl.count; change(); drawWarnings(); } });
      const step = (d) => () => { pl.count = Math.max(1, (Number(pl.count) || 1) + d); input.value = pl.count; change(); drawWarnings(); };
      return h('li', { class: 'chosen-row' },
        h('span', { class: 'grow' }, h('strong', null, p ? p.commonName : pl.plantId), p ? h('em', { class: 'muted' }, ' ' + p.latinName) : null),
        h('button', { class: 'btn btn-icon', type: 'button', 'aria-label': 'Moins', onclick: step(-1) }, '−'),
        input,
        h('button', { class: 'btn btn-icon', type: 'button', 'aria-label': 'Plus', onclick: step(1) }, '+'),
        h('button', { class: 'btn btn-icon btn-danger', type: 'button', 'aria-label': `Retirer ${p ? p.commonName : ''}`, onclick: () => {
          z.plantings = z.plantings.filter((x) => x !== pl); change(); drawChosen(); drawList(); drawWarnings();
        } }, '🗑'));
    });
    chosenBox.replaceChildren(
      h('h3', null, `Dans cette zone (${rows.length})`),
      rows.length ? h('ul', { class: 'chosen-list' }, rows) : h('p', { class: 'muted' }, 'Aucune essence choisie pour l’instant.'));
  }

  function drawList() {
    const z = zone();
    let recs = [];
    try { recs = recommendForZone(garden, z, { includeDiscouraged: showDisc, filters: { ...filters } }) || []; } catch (e) { console.error(e); }
    if (query.trim()) {
      let ids = null;
      try { ids = new Set(searchPlants(query).map((p) => p.id)); } catch { /* */ }
      if (ids) recs = recs.filter((r) => ids.has(r.plant.id));
    }
    listBox.replaceChildren();
    if (!recs.length) listBox.append(h('li', { class: 'muted empty' }, 'Aucune essence ne correspond. Assouplissez les filtres ou affichez les déconseillées.'));
    recs.slice(0, limit).forEach((r) => {
      const p = r.plant;
      const present = (z.plantings || []).find((x) => x.plantId === p.id);
      const nInput = h('input', { type: 'number', min: '1', max: '999', class: 'qty', value: String(qty(safeQty(p, z))), 'aria-label': `Quantité à ajouter de ${p.commonName}` });
      listBox.append(h('li', { class: 'plant-card ' + r.status, 'data-plant': p.id },
        h('div', { class: 'plant-head' },
          h('div', { class: 'grow' }, h('strong', null, p.commonName), h('br'), h('em', { class: 'muted' }, p.latinName)),
          h('span', { class: 'badge ' + r.status }, `${STATUS[r.status] || r.status} · ${Math.round(r.score)}`)),
        h('p', { class: 'muted small' }, `${p.heightAdult} m × ${p.widthAdult} m · ${(p.sun || []).map((s) => SUNL[s]).join('/')} · ${WATER[p.water] || ''} · rustique à ${p.hardiness} °C`),
        h('details', null, h('summary', null, 'Pourquoi ?'),
          h('ul', { class: 'reasons' }, (r.reasons || []).map((x) => h('li', { class: x.ok === true ? 'ok' : x.ok === false ? 'ko' : '' },
            (x.ok === true ? '✔ ' : x.ok === false ? '✖ ' : '• ') + x.text)))),
        h('div', { class: 'row end' },
          present ? h('button', { class: 'btn btn-sm', type: 'button', onclick: () => {
            z.plantings = z.plantings.filter((x) => x !== present); change(); drawChosen(); drawList(); drawWarnings();
          } }, 'Retirer') : [nInput,
            h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => {
              z.plantings = z.plantings || [];
              z.plantings.push({ plantId: p.id, count: Math.max(1, Math.round(Number(nInput.value) || 1)) });
              change(); drawChosen(); drawList(); drawWarnings();
            } }, 'Ajouter')])));
    });
    moreBox.replaceChildren(recs.length > limit ? h('button', { class: 'btn btn-block', type: 'button', onclick: () => { limit += PAGE; drawList(); } }, `Afficher plus (${recs.length - limit} restantes)`) : null);
  }
  function safeQty(p, z) { try { return suggestQuantity(p, z); } catch { return 1; } }

  const zoneSel = h('select', { id: 'zone-sel', onchange: (e) => { zoneId = e.target.value; limit = PAGE; drawZoneInfo(); drawChosen(); drawList(); } },
    garden.zones.map((z) => { const t = getZoneType(z.type); return h('option', { value: z.id, selected: z.id === zoneId }, `${t ? t.icon + ' ' : ''}${z.label || (t && t.label) || 'Zone'}`); }));
  const zoneInfo = h('p', { class: 'muted' });
  function drawZoneInfo() {
    const z = zone();
    let a = 0; try { a = shapeArea(z.shape); } catch { /* */ }
    const t = getZoneType(z.type);
    zoneInfo.textContent = `${t ? t.label : z.type} · ${a.toFixed(a < 10 ? 1 : 0).replace('.', ',')} m²`;
  }

  const filterBox = h('details', { class: 'filters' }, h('summary', null, 'Filtres'),
    h('div', { class: 'field' }, h('label', { for: 'f-foliage' }, 'Feuillage'),
      h('select', { id: 'f-foliage', onchange: (e) => { if (e.target.value) filters.foliage = e.target.value; else delete filters.foliage; limit = PAGE; drawList(); } },
        FOLIAGE.map(([v, l]) => h('option', { value: v }, l)))),
    h('div', { class: 'chips' }, CHECKS.map(([k, l]) => h('label', { class: 'chip' },
      h('input', { type: 'checkbox', onchange: (e) => { if (e.target.checked) filters[k] = true; else delete filters[k]; limit = PAGE; drawList(); } }), h('span', null, l)))),
    h('label', { class: 'chip' }, h('input', { type: 'checkbox', id: 'f-disc', onchange: (e) => { showDisc = e.target.checked; limit = PAGE; drawList(); } }), h('span', null, 'Afficher les déconseillées')));

  const surprise = h('button', { class: 'btn', type: 'button', id: 'btn-surprise', onclick: () => {
    const z = zone();
    try {
      const sel = suggestSelection(garden, z, { seed: Date.now() }) || [];
      const next = [];
      for (const it of sel) {
        const id = it.plantId || (it.plant && it.plant.id) || it.id;
        if (!id) continue;
        const p = getPlant(id);
        next.push({ plantId: id, count: it.count != null ? qty(it.count) : qty(p ? safeQty(p, z) : 1) });
      }
      if (!next.length) { toast('Aucune proposition possible pour cette zone.'); return; }
      z.plantings = next; change(); drawChosen(); drawList(); drawWarnings();
      toast('Sélection proposée : retouchez-la à votre guise.');
    } catch (e) { toast('Suggestion impossible : ' + (e && e.message ? e.message : 'erreur')); }
  } }, '🎲 Surprends-moi');

  el.replaceChildren(
    warnBox,
    h('section', { class: 'card' },
      h('div', { class: 'field' }, h('label', { for: 'zone-sel' }, 'Zone'), zoneSel), zoneInfo, chosenBox, surprise),
    h('section', { class: 'card' },
      h('h3', null, 'Essences conseillées'),
      h('div', { class: 'field' }, h('label', { for: 'plant-search' }, 'Rechercher (nom commun ou latin)'),
        h('input', { id: 'plant-search', type: 'search', oninput: (e) => { query = e.target.value; limit = PAGE; drawList(); } })),
      filterBox, listBox, moreBox));
  drawZoneInfo(); drawChosen(); drawList(); drawWarnings();
  return () => el.replaceChildren();
}
