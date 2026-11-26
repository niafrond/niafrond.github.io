// Étape 6 : choix des essences par zone (recommandations explicables).
import { h, toast, gardenHash, confirmDialog } from './wizard.js';
import { getZoneType } from '../model.js';
import { getPlant, searchPlants } from '../catalog.js';
import { recommendForZone, suggestQuantity, checkCoherence, suggestSelection } from '../recommend.js';
import { shapeArea } from '../geometry.js';
import { getPlantPhoto } from '../photos.js';
import { openAmbiancePicker, ambianceOf, ambianceEmoji, zoneAmbiance } from './ambiance-picker.js';
import { isTypical } from '../ambiances.js';
import { plantEffort, fitsMaintenance, levelForZone, effortLabel } from '../maintenance.js';
import { gardenMaintenancePicker, zoneMaintenancePicker, maintenanceReminder, effortIndicator, levelPhrase } from './maintenance-picker.js';
import { designBed } from '../massifs.js';
import { checkHeight, parseHeight, heightToCm, heightMessage, formatHeight, plantHeightKind, isDefaultHeight } from '../heights.js';
import { pondArea, pondDepth, pondFit, pondTag, pondTaggedIds, estimatePondDepth } from '../ponds.js';
import { gardenCost, formatEuro, formatPrice, UNIT_LABEL, summarizeGarden } from '../pricing.js';

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

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const CAT_EMOJI = {
  tree: '🌳', shrub: '🌿', hedge: '🌲', fruit: '🍎', climber: '🌱', perennial: '🌸', groundcover: '☘️',
  grass: '🌾', bulb: '🌷', aquatic: '🪷', vegetable: '🥕', lawn: '🟩',
};
const NO_PLANT = new Set(['pool', 'path']);
const DEFAULT_TINT = '#7fb069';
const hexOk = (c) => (typeof c === 'string' && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(c.trim()) ? c.trim() : null);

/** Nom français approximatif d'une couleur #hex (libellés accessibles). */
export function colorName(hex) {
  let c = hexOk(hex);
  if (!c) return 'inconnue';
  c = c.slice(1);
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const r = parseInt(c.slice(0, 2), 16) / 255, g = parseInt(c.slice(2, 4), 16) / 255, b = parseInt(c.slice(4, 6), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (l < 0.12) return 'noir';
  if (l > 0.93) return 'blanc';
  if (sat < 0.13) return l > 0.7 ? 'gris clair' : 'gris';
  let hue = 0;
  if (d) {
    if (mx === r) hue = ((g - b) / d) % 6; else if (mx === g) hue = (b - r) / d + 2; else hue = (r - g) / d + 4;
    hue = (hue * 60 + 360) % 360;
  }
  if (hue < 15 || hue >= 345) return l > 0.72 ? 'rose pâle' : l < 0.3 ? 'bordeaux' : 'rouge';
  if (hue < 40) return l < 0.38 ? 'brun' : l > 0.75 ? 'pêche' : 'orange';
  if (hue < 68) return l > 0.8 ? 'crème' : l < 0.35 ? 'olive' : 'jaune';
  if (hue < 95) return l > 0.65 ? 'vert tendre' : 'vert-jaune';
  if (hue < 165) return l < 0.3 ? 'vert foncé' : l > 0.7 ? 'vert clair' : 'vert';
  if (hue < 200) return 'turquoise';
  if (hue < 255) return l > 0.75 ? 'bleu clair' : 'bleu';
  if (hue < 290) return l > 0.72 ? 'lilas' : 'violet';
  if (hue < 330) return sat > 0.5 && l < 0.7 ? 'magenta' : 'rose';
  return l < 0.35 ? 'bordeaux' : 'rose';
}

/** « mars à juin, septembre » à partir d'une liste de mois (1–12). */
export function formatBloom(months) {
  const ms = [...new Set((months || []).filter((m) => m >= 1 && m <= 12))].sort((a, b) => a - b);
  if (!ms.length) return '';
  const groups = [];
  for (const m of ms) {
    const last = groups[groups.length - 1];
    if (last && m === last[1] + 1) last[1] = m; else groups.push([m, m]);
  }
  return groups.map(([a, b]) => (a === b ? MONTHS[a - 1] : b === a + 1 ? `${MONTHS[a - 1]} et ${MONTHS[b - 1]}` : `${MONTHS[a - 1]} à ${MONTHS[b - 1]}`)).join(', ');
}

const fmtNum = (n) => String(Math.round(n * 10) / 10).replace('.', ',');

/** « ≈ 12 € / plant, pot 3 L » ; null si pas de prix. */
export function priceLabel(p) {
  if (!p || typeof p.priceEur !== 'number') return null;
  const unit = UNIT_LABEL[p.priceUnit] || 'plant';
  return `≈ ${formatPrice(p.priceEur)} / ${unit}${p.priceNote ? ', ' + p.priceNote : ''}`;
}

function thumbBackground(p) {
  const fl = hexOk(p.flowerColor), fo = hexOk(p.foliageColor);
  return `linear-gradient(135deg, ${fl || fo || DEFAULT_TINT} 0%, ${fo || fl || DEFAULT_TINT} 100%)`;
}

function swatches(p) {
  const out = [];
  const fl = hexOk(p.flowerColor), fo = hexOk(p.foliageColor);
  if (fl) out.push(h('span', { class: 'swatch', 'data-kind': 'flower' }, h('i', { style: `background:${fl}`, 'aria-hidden': 'true' }), `Fleurs : ${colorName(fl)}`));
  if (fo) out.push(h('span', { class: 'swatch', 'data-kind': 'foliage' }, h('i', { style: `background:${fo}`, 'aria-hidden': 'true' }), `Feuillage : ${colorName(fo)}`));
  return out.length ? h('div', { class: 'swatches' }, out) : null;
}

export function mountPlants(el, { garden, onChange, getPhoto = getPlantPhoto, IO, seed } = {}) {
  const change = () => onChange && onChange(garden);
  let zoneId = garden.zones[0] ? garden.zones[0].id : null;
  const filters = {};
  let query = '';
  let showDisc = false;
  let limit = PAGE;
  const IOImpl = IO !== undefined ? IO : (typeof window !== 'undefined' ? window.IntersectionObserver : null);
  const baseSeed = seed != null ? seed : Date.now();
  let round = 0;
  let proposal = null; // {key, snapshot: Map(zoneId -> plantings)}

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
  let zoneTotalEl = null;

  // ---------- budget ----------
  const budgetMain = h('strong', { 'data-role': 'budget-main' });
  const budgetSub = h('span', { class: 'small', 'data-role': 'budget-sub' });
  const budgetBar = h('div', { class: 'budget-bar', id: 'budget-bar', role: 'status', 'aria-live': 'polite' }, budgetMain, budgetSub);
  const budgetMax = () => { const n = Number(String(budgetInput.value).replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null; };
  function drawBudget() {
    const gc = gardenCost(garden, getPlant);
    const u = gc.unknownCount;
    budgetMain.textContent = `Budget estimé ≈ ${formatEuro(gc.total, { digits: 0 })}${u ? ` · ${u} essence${u > 1 ? 's' : ''} sans prix` : ''}`;
    const zc = gc.byZone.find((x) => x.zoneId === zone().id);
    budgetSub.textContent = `Cette zone ≈ ${formatEuro(zc ? zc.total : 0, { digits: 0 })} · prix moyens en jardinerie, à titre indicatif`;
    const max = budgetMax();
    budgetBar.classList.toggle('over', !!max && gc.total > max);
    if (zoneTotalEl && zc) zoneTotalEl.textContent = zc.total ? ` · ≈ ${formatEuro(zc.total, { digits: 0 })}` : '';
  }

  function drawWarnings() {
    let list = [];
    try { list = checkCoherence(garden) || []; } catch { /* */ }
    warnBox.replaceChildren(...list.map((w) => h('p', { class: w.level === 'warn' ? 'notice warn' : 'notice info', role: w.level === 'warn' ? 'alert' : null },
      (w.level === 'warn' ? '⚠️ ' : 'ℹ️ ') + w.text)));
  }
  const refresh = () => { change(); drawChosen(); drawList(); drawWarnings(); drawBudget(); };

  /** Hauteur adulte réglable (cm) d'une essence choisie : champ, état catalogue / personnalisée, bouton « Valeur par défaut ». */
  function heightControl(p, pl) {
    const kind = plantHeightKind(p);
    const def = Number(p.heightAdult) || 0.5;
    const name = p.commonName || p.id;
    const input = h('input', { type: 'text', inputmode: 'numeric', class: 'height-input', 'data-field': 'plant-height', 'aria-label': `Hauteur de ${name} en centimètres`,
      placeholder: heightToCm(def), enterkeyhint: 'done', autocomplete: 'off' });
    const state = h('span', { class: 'height-state muted small', 'data-role': 'height-state' });
    const note = h('span', { class: 'height-note small', role: 'status', 'aria-live': 'polite' });
    const reset = h('button', { class: 'btn btn-icon height-reset', type: 'button', 'data-act': 'height-reset', 'aria-label': `Valeur par défaut de la hauteur de ${name} (${formatHeight(def)})`, title: 'Valeur par défaut' }, '↺');
    const paint = () => {
      const custom = !isDefaultHeight(pl, def) && Number(pl.height) > 0;
      input.value = custom ? heightToCm(pl.height) : '';
      state.textContent = custom ? `personnalisée · catalogue ${formatHeight(def)}` : 'catalogue';
      state.dataset.state = custom ? 'custom' : 'catalog';
      reset.disabled = !custom;
    };
    const commit = () => {
      const raw = input.value.trim();
      if (raw === '') { delete pl.height; note.textContent = ''; paint(); afterHeight(); return; }
      const m = parseHeight(raw);
      const chk = m == null ? { ok: false, message: heightMessage(kind) } : checkHeight(kind, m);
      if (!chk.ok) { note.textContent = chk.message; input.classList.add('bad'); paint(); return; }
      input.classList.remove('bad');
      if (Math.abs(chk.value - def) < 0.005) delete pl.height; else pl.height = chk.value;
      note.textContent = chk.clamped ? chk.message : '';
      paint(); afterHeight();
    };
    input.addEventListener('change', commit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
    reset.addEventListener('click', () => { delete pl.height; note.textContent = ''; paint(); afterHeight(); });
    paint();
    return h('div', { class: 'height-row', 'data-role': 'height-row' },
      h('label', { class: 'height-label small' }, 'Hauteur'), input, h('span', { class: 'height-unit small' }, 'cm'), reset, state, note);
  }
  function afterHeight() { change(); drawWarnings(); }

  function drawChosen() {
    const z = zone();
    resetThumbs('chosen');
    let recById = new Map();
    try { recById = new Map((recommendForZone(garden, z, { includeDiscouraged: true }) || []).map((x) => [x.plant.id, x])); } catch { /* fiche sans raisons */ }
    const rows = (z.plantings || []).map((pl) => {
      const p = getPlant(pl.plantId);
      const lineEl = h('span', { class: 'muted small line-total' });
      const upd = () => {
        const gc = gardenCost({ zones: [{ ...z, plantings: [pl] }] }, getPlant);
        lineEl.textContent = gc.total ? `≈ ${formatEuro(gc.total, { digits: 0 })}` : (gc.unknownCount ? 'sans prix' : '');
      };
      const afterQty = () => { change(); upd(); drawWarnings(); drawBudget(); };
      const input = h('input', { type: 'number', min: '1', max: '999', value: String(pl.count || 1), 'aria-label': `Quantité de ${p ? p.commonName : pl.plantId}`, class: 'qty',
        onchange: (e) => { pl.count = Math.max(1, Math.round(Number(e.target.value) || 1)); e.target.value = pl.count; afterQty(); } });
      const step = (d) => () => { pl.count = Math.max(1, (Number(pl.count) || 1) + d); input.value = pl.count; afterQty(); };
      upd();
      return h('li', { class: 'chosen-row' },
        p ? makeThumb(p, recById.get(p.id) || null, 'chosen') : null,
        h('span', { class: 'grow' }, h('strong', null, p ? p.commonName : pl.plantId), p ? h('em', { class: 'muted' }, ' ' + p.latinName) : null, h('br'), lineEl),
        h('button', { class: 'btn btn-icon', type: 'button', 'aria-label': 'Moins', onclick: step(-1) }, '−'),
        input,
        h('button', { class: 'btn btn-icon', type: 'button', 'aria-label': 'Plus', onclick: step(1) }, '+'),
        h('button', { class: 'btn btn-icon btn-danger', type: 'button', 'aria-label': `Retirer ${p ? p.commonName : ''}`, onclick: () => {
          z.plantings = z.plantings.filter((x) => x !== pl); refresh();
        } }, '🗑'),
        p ? heightControl(p, pl) : null);
    });
    zoneTotalEl = h('span', { class: 'zone-total', 'data-role': 'zone-total' });
    chosenBox.replaceChildren(
      h('h3', null, `Dans cette zone (${rows.length})`, zoneTotalEl),
      rows.length ? h('ul', { class: 'chosen-list' }, rows) : h('p', { class: 'muted' }, 'Aucune essence choisie pour l’instant.'));
  }

  // ---------- vignettes (photo paresseuse, repli coloré immédiat) ----------
  let io = null;
  const pending = new Map();
  function loadThumb(job) {
    Promise.resolve().then(() => getPhoto(job.plant)).then((ph) => {
      if (!ph || !ph.url || !job.box.isConnected) return;
      const img = h('img', { src: ph.url, alt: '', decoding: 'async', onload: () => {
        img.style.display = '';
        job.box.classList.add('has-photo');
        job.box.replaceChildren(img);
        job.credit.textContent = ph.credit || 'Photo : Wikipédia';
      } });
      img.style.display = 'none';
      job.box.append(img);
      img.addEventListener('error', () => img.remove());
    }).catch(() => {});
  }
  function observe(job) {
    if (!IOImpl) { loadThumb(job); return; }
    if (!io) {
      io = new IOImpl((entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const j = pending.get(e.target);
          if (j) { pending.delete(e.target); io.unobserve(e.target); loadThumb(j); }
        }
      }, { rootMargin: '150px' });
    }
    pending.set(job.node, job);
    io.observe(job.node);
  }
  // `group` ('list' | 'chosen') : ne réinitialise que les vignettes de ce groupe ; sans groupe, tout.
  function resetThumbs(group) {
    if (!io) { pending.clear(); return; }
    if (!group) { io.disconnect(); io = null; pending.clear(); return; }
    for (const [node, job] of [...pending]) if (job.group === group) { io.unobserve(node); pending.delete(node); }
  }

  function fallbackBox(p, cls) {
    return h('span', { class: cls, style: `background:${thumbBackground(p)}`, 'aria-hidden': 'true' }, CAT_EMOJI[p.category] || '🌱');
  }

  function makeThumb(p, r, group = 'list') {
    const fb = fallbackBox(p, 'thumb-fb');
    const box = h('span', { class: 'thumb-box' }, fb);
    const credit = h('span', { class: 'photo-credit' });
    const btn = h('button', { class: 'plant-thumb', type: 'button', 'aria-label': `Agrandir la fiche de ${p.commonName}`, onclick: () => openDetail(p, r) }, box);
    observe({ plant: p, box, credit, node: btn, group });
    return h('div', { class: 'thumb-col' }, btn, credit);
  }

  function openDetail(p, r) {
    const prev = document.activeElement;
    const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); if (prev && prev.focus) prev.focus(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const photoBox = h('div', { class: 'detail-photo' }, fallbackBox(p, 'thumb-fb big'));
    const credit = h('p', { class: 'photo-credit' });
    Promise.resolve().then(() => getPhoto(p)).then((ph) => {
      if (!ph || !ph.url || !photoBox.isConnected) return;
      const img = h('img', { src: ph.medium || ph.url, alt: `Photo de ${p.commonName}`, decoding: 'async' });
      img.addEventListener('error', () => { if (img.src !== ph.url) img.src = ph.url; else img.remove(); }, { once: false });
      img.addEventListener('load', () => { img.style.display = ''; photoBox.replaceChildren(img); credit.replaceChildren(
        ph.page ? h('a', { href: ph.page, target: '_blank', rel: 'noopener' }, ph.credit || 'Photo : Wikipédia') : (ph.credit || 'Photo : Wikipédia')); });
      img.style.display = 'none'; photoBox.append(img);
    }).catch(() => {});
    const care = p.care || {};
    const careRows = [['Plantation', care.planting], ['Taille', care.pruning], ['Engrais', care.fertilizer], ['Arrosage', care.watering], ['À savoir', care.notes]].filter(([, v]) => v);
    const price = priceLabel(p);
    const overlay = h('div', { class: 'overlay', onclick: (e) => { if (e.target === overlay) close(); } },
      h('div', { class: 'dialog plant-detail', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Fiche : ${p.commonName}`, 'data-role': 'plant-detail' },
        photoBox, credit,
        h('h3', null, p.commonName), h('p', { class: 'muted' }, h('em', null, p.latinName)),
        swatches(p),
        h('p', { class: 'small' }, [
          p.bloom && p.bloom.length ? `Floraison : ${formatBloom(p.bloom)}. ` : '',
          `Hauteur adulte : ${fmtNum(p.heightAdult)} m, largeur ${fmtNum(p.widthAdult)} m. `,
          (() => { const pl = (zone().plantings || []).find((x) => x.plantId === p.id); return pl && Number(pl.height) > 0 && !isDefaultHeight(pl, p.heightAdult) ? `Hauteur : ${formatHeight(pl.height)} (personnalisée). ` : ''; })(),
          price ? `Prix indicatif : ${price}. ` : 'Prix non renseigné. ',
          `Entretien : ${effortLabel(plantEffort(p))}.`]),
        r ? h('div', null, h('h4', null, `Pourquoi ${STATUS[r.status] ? STATUS[r.status].toLowerCase() : 'cette note'} (${Math.round(r.score)}/100)`),
          h('ul', { class: 'reasons' }, (r.reasons || []).map((x) => h('li', { class: x.ok === true ? 'ok' : x.ok === false ? 'ko' : '' },
            (x.ok === true ? '✔ ' : x.ok === false ? '✖ ' : '• ') + x.text)))) : null,
        careRows.length ? h('div', null, h('h4', null, 'Entretien'), h('ul', { class: 'care-list small' }, careRows.map(([k, v]) => h('li', null, h('strong', null, k + ' : '), v)))) : null,
        h('div', { class: 'row end' }, h('button', { class: 'btn btn-primary', type: 'button', 'data-act': 'close-detail', onclick: close }, 'Fermer'))));
    document.addEventListener('keydown', onKey);
    document.body.append(overlay);
    const b = overlay.querySelector('[data-act=close-detail]'); if (b) b.focus();
  }

  function drawList() {
    const z = zone();
    resetThumbs('list');
    let recs = [];
    try { recs = recommendForZone(garden, z, { includeDiscouraged: showDisc, filters: { ...filters } }) || []; } catch (e) { console.error(e); }
    if (filters.lowMaintenance) {
      // « Faible entretien » suit le niveau choisi : une seule essence légère pour « pas d'entretien ».
      const lvl = levelForZone(garden, z);
      const cap = lvl === 'none' ? 1 : lvl === 'low' ? 2 : 3;
      recs = recs.filter((r) => plantEffort(r.plant) <= cap);
    }
    if (query.trim()) {
      let ids = null;
      try { ids = new Set(searchPlants(query).map((p) => p.id)); } catch { /* */ }
      if (ids) recs = recs.filter((r) => ids.has(r.plant.id));
    }
    if (z.type === 'pond') recs = recs.filter((r) => !pondTag(r.plant) || pondFit(r.plant, z).ok);
    listBox.replaceChildren();
    if (!recs.length) listBox.append(h('li', { class: 'muted empty' }, 'Aucune essence ne correspond. Assouplissez les filtres ou affichez les déconseillées.'));
    recs.slice(0, limit).forEach((r) => {
      const p = r.plant;
      const present = (z.plantings || []).find((x) => x.plantId === p.id);
      const nInput = h('input', { type: 'number', min: '1', max: '999', class: 'qty', value: String(qty(safeQty(p, z))), 'aria-label': `Quantité à ajouter de ${p.commonName}` });
      const price = priceLabel(p);
      const bloom = formatBloom(p.bloom);
      const effort = plantEffort(p);
      const fit = fitsMaintenance(p, levelForZone(garden, z));
      listBox.append(h('li', { class: 'plant-card ' + r.status + (fit.ok ? '' : ' maint-ko'), 'data-plant': p.id },
        h('div', { class: 'plant-head' },
          makeThumb(p, r),
          h('div', { class: 'grow' }, h('strong', null, p.commonName), h('br'), h('em', { class: 'muted' }, p.latinName),
            swatches(p), typical(p, z) ? h('span', { class: 'amb-pill', 'data-role': 'ambiance-ok', title: 'Typique de l’ambiance de la zone' }, '✓ ambiance') : null),
          h('span', { class: 'badge ' + r.status }, `${STATUS[r.status] || r.status} · ${Math.round(r.score)}`)),
        h('p', { class: 'muted small' }, `${bloom ? 'Floraison : ' + bloom + ' · ' : ''}Hauteur adulte ${fmtNum(p.heightAdult)} m × ${fmtNum(p.widthAdult)} m`),
        h('p', { class: 'muted small' }, `${(p.sun || []).map((s) => SUNL[s]).join('/')} · ${WATER[p.water] || ''} · rustique à ${p.hardiness} °C`),
        h('p', { class: 'price small' + (price ? '' : ' muted'), 'data-role': 'price' }, price || 'Prix non renseigné'),
        h('p', { class: 'small maint-line' }, effortIndicator(effort, { ok: fit.ok }),
          fit.ok ? null : h('span', { class: 'maint-pill', 'data-role': 'maint-ko', title: fit.text }, 'demande de l’entretien')),
        h('details', null, h('summary', null, 'Pourquoi ?'),
          h('ul', { class: 'reasons' }, (r.reasons || []).map((x) => h('li', { class: x.ok === true ? 'ok' : x.ok === false ? 'ko' : '' },
            (x.ok === true ? '✔ ' : x.ok === false ? '✖ ' : '• ') + x.text)))),
        h('div', { class: 'row end' },
          present ? h('button', { class: 'btn btn-sm', type: 'button', onclick: () => {
            z.plantings = z.plantings.filter((x) => x !== present); refresh();
          } }, 'Retirer') : [nInput,
            h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => {
              z.plantings = z.plantings || [];
              z.plantings.push({ plantId: p.id, count: Math.max(1, Math.round(Number(nInput.value) || 1)) });
              refresh();
            } }, 'Ajouter')])));
    });
    drawPond();
    moreBox.replaceChildren(recs.length > limit ? h('button', { class: 'btn btn-block', type: 'button', onclick: () => { limit += PAGE; drawList(); } }, `Afficher plus (${recs.length - limit} restantes)`) : null);
  }

  // ---------- mare : profondeur, résumé, essences écartées, bandeau après redimensionnement ----------
  const fmtArea = (a) => `${a.toFixed(a < 10 ? 1 : 0).replace('.', ',')} m²`;
  const depthInput = h('input', { id: 'pond-depth', type: 'number', inputmode: 'numeric', min: '10', max: '500', step: '5', 'data-field': 'pond-depth', 'aria-describedby': 'pond-depth-hint' });
  const depthHint = h('span', { id: 'pond-depth-hint', class: 'muted small', 'data-role': 'pond-depth-hint' });
  const pondSummary = h('p', { class: 'pond-summary', 'data-role': 'pond-summary', 'aria-live': 'polite' });
  const pondAlert = h('div', { class: 'notice warn', role: 'alert', 'data-role': 'pond-alert', hidden: true });
  const pondExcluded = h('details', { class: 'pond-excluded', 'data-role': 'pond-excluded', hidden: true });
  const pondBox = h('div', { class: 'pond-box', 'data-role': 'pond-box', hidden: true },
    h('div', { class: 'field' }, h('label', { for: 'pond-depth' }, 'Profondeur de la mare (cm)'), depthInput, depthHint), pondSummary, pondAlert);
  let pondZoneId = null;
  const commitDepth = () => {
    const z = zone();
    if (z.type !== 'pond') return;
    const raw = String(depthInput.value).trim().replace(',', '.');
    const n = Math.round(Number(raw));
    if (raw === '' ) delete z.depth;
    else if (Number.isFinite(n) && n >= 10 && n <= 500) z.depth = n;
    else { depthHint.textContent = 'Profondeur entre 10 et 500 cm.'; return; }
    limit = PAGE; refresh();
  };
  depthInput.addEventListener('change', commitDepth);
  depthInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commitDepth(); } });
  function drawPond() {
    const z = zone();
    const isPond = z.type === 'pond';
    pondBox.hidden = !isPond;
    pondExcluded.hidden = true;
    if (!isPond) { pondAlert.hidden = true; pondZoneId = null; return; }
    const area = pondArea(z), depth = pondDepth(z);
    if (pondZoneId !== z.id || document.activeElement !== depthInput) depthInput.value = String(depth);
    pondZoneId = z.id;
    depthHint.textContent = z.depth > 0 ? `Valeur saisie (estimation d’après la surface : ${estimatePondDepth(area)} cm).` : 'Valeur estimée d’après la surface : modifiez-la si vous la connaissez.';
    // essences de mare étiquetées : adaptées / écartées
    let all = [];
    try { all = recommendForZone(garden, z, { includeDiscouraged: true, includeForbidden: true }) || []; } catch { /* */ }
    const tagged = all.filter((r) => pondTag(r.plant) && pondTaggedIds().includes(r.plant.id));
    const out = tagged.map((r) => ({ p: r.plant, fit: pondFit(r.plant, z) })).filter((x) => !x.fit.ok);
    const okN = tagged.length - out.length;
    pondSummary.textContent = `Mare de ${fmtArea(area)}, profondeur ${depth} cm : ${okN} essence${okN > 1 ? 's' : ''} adaptée${okN > 1 ? 's' : ''}, ${out.length} écartée${out.length > 1 ? 's' : ''}.`;
    if (out.length) {
      pondExcluded.hidden = false;
      pondExcluded.replaceChildren(h('summary', null, `Écartées pour cette mare (${out.length})`),
        h('ul', { class: 'reasons' }, out.map(({ p, fit }) => h('li', { class: 'ko', 'data-plant': p.id, 'data-level': fit.level },
          h('strong', null, p.commonName), ' : ', fit.reasons.join(' ; ')))));
    } else pondExcluded.replaceChildren();
    // essences déjà choisies devenues inadaptées (mare redimensionnée, profondeur modifiée)
    const bad = (z.plantings || []).map((pl) => ({ pl, p: getPlant(pl.plantId) })).filter((x) => x.p && pondTag(x.p) && !pondFit(x.p, z).ok);
    if (bad.length) {
      pondAlert.hidden = false;
      pondAlert.replaceChildren(
        h('p', null, `⚠️ La mare a changé (${fmtArea(area)}, ${depth} cm) : ${bad.map((x) => x.p.commonName).join(', ')} ne ${bad.length > 1 ? 'conviennent' : 'convient'} plus.`),
        h('button', { class: 'btn btn-sm', type: 'button', 'data-act': 'pond-remove-bad', onclick: () => {
          const ids = new Set(bad.map((x) => x.pl));
          z.plantings = (z.plantings || []).filter((x) => !ids.has(x));
          refresh();
        } }, 'Retirer ces essences'));
    } else { pondAlert.hidden = true; pondAlert.replaceChildren(); }
  }
  function typical(p, z) {
    const a = zoneAmbiance(z);
    if (!a) return false;
    try { return isTypical(p, a); } catch { return false; }
  }
  function safeQty(p, z) { try { return suggestQuantity(p, z); } catch { return 1; } }

  const optLabel = (z) => { const t = getZoneType(z.type); const e = ambianceEmoji(zoneAmbiance(z)); return `${t ? t.icon + ' ' : ''}${z.label || (t && t.label) || 'Zone'}${e ? ' ' + e : ''}${z.auto ? ' ✨' : ''}`; };
  // massif calculé par l'app : on le redessine (autre combinaison de plantes, même forme)
  let recalcRound = 0;
  function recalcBed() {
    const z = zone();
    recalcRound++;
    const info = z.autoInfo || (z.autoInfo = {});
    const seed = (Number(info.seed) || 1) + recalcRound * 11 + (z.plantings || []).length;
    let a = 0; try { a = shapeArea(z.shape); } catch { /* */ }
    try {
      const d = designBed(garden, { id: z.id, role: info.role, shape: z.shape, areaM2: Math.round(a * 10) / 10 }, { seed, ambiance: z.ambiance || null, maintenance: levelForZone(garden, z) });
      if (!d.plantings.length) { toast('Aucune autre combinaison trouvée pour ce massif.'); return; }
      z.plantings = d.plantings;
      info.seed = seed;
      info.summary = d.summary;
      info.why = [String(info.why || '').split(' — ')[0], d.why].filter(Boolean).join(' — ');
      limit = PAGE; refresh(); drawZoneInfo();
      toast('Massif recalculé : nouvelle combinaison de plantes.');
    } catch (e) { toast('Recalcul impossible : ' + (e && e.message ? e.message : 'erreur')); }
  }
  const pickZone = (id) => { zoneId = id; limit = PAGE; drawZoneInfo(); drawChosen(); drawList(); drawWarnings(); drawBudget(); };
  function openPlanPreview(tab = 'zones') {
    import('./preview-overlay.js').then((m) => {
      const ov = m.openPreview(garden, { zoneId: zone().id, tab, onSelectZone: (id) => { if (garden.zones.some((q) => q.id === id)) { zoneSel.value = id; pickZone(id); } } });
      void ov;
    }).catch((e) => toast('Aperçu indisponible : ' + (e && e.message ? e.message : 'erreur')));
  }
  const zoneSel = h('select', { id: 'zone-sel', onchange: (e) => pickZone(e.target.value) },
    garden.zones.map((z) => h('option', { value: z.id, selected: z.id === zoneId }, optLabel(z))));
  const zoneInfo = h('p', { class: 'muted' });
  const zoneHead = h('div', { class: 'zone-head', 'data-role': 'zone-head' });
  function changeAmbiance() {
    const z = zone();
    openAmbiancePicker(document.body, { zones: [z], onConfirm: (m) => {
      z.ambiance = m[z.id] || null;
      limit = PAGE; refresh(); drawZoneInfo();
      toast(z.ambiance ? `Ambiance « ${(ambianceOf(z.ambiance) || {}).label} » enregistrée pour cette zone.` : 'Ambiance retirée pour cette zone.');
    } });
  }
  function drawZoneInfo() {
    const z = zone();
    Array.from(zoneSel.options).forEach((o) => { const q = garden.zones.find((x) => x.id === o.value); if (q) o.textContent = optLabel(q); });
    const amb = ambianceOf(zoneAmbiance(z));
    zoneHead.replaceChildren(
      h('div', { class: 'zone-head-txt' },
        h('strong', { 'data-role': 'zone-head-name' }, z.label || 'Zone', z.auto ? h('span', { class: 'auto-badge', 'data-role': 'auto-badge', title: 'Massif calculé par l’app' }, '✨ auto') : null),
        h('span', { class: 'amb-tag', 'data-role': 'zone-head-ambiance' }, amb ? `${amb.emoji} ambiance ${amb.label.toLowerCase()}` : 'Ambiance : peu importe')),
      h('button', { class: 'btn btn-sm', type: 'button', 'data-act': 'change-ambiance', onclick: changeAmbiance }, 'Changer l’ambiance'),
      h('button', { class: 'btn btn-sm', type: 'button', 'data-act': 'preview-zone', onclick: () => openPlanPreview('zones') }, '🗺️ Voir cette zone sur le plan'),
      zoneMaintenancePicker(garden, z, { onChange: () => { limit = PAGE; refresh(); } }),
      z.auto && z.autoInfo && z.autoInfo.why ? h('div', { class: 'auto-info', 'data-role': 'auto-info' },
        h('p', null, z.autoInfo.why),
        h('button', { class: 'btn btn-sm', type: 'button', 'data-act': 'recalc-bed', onclick: recalcBed }, '🎲 Recalculer ce massif')) : null);
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

  // ---------- « Surprends-moi » (zone ou jardin entier), annulable ----------
  const clonePl = (z) => (z.plantings || []).map((x) => ({ ...x }));
  function selectionFor(z, budget) {
    const sel = suggestSelection(garden, z, { seed: baseSeed + round, ambiance: z.ambiance || null, ...(budget ? { budget } : {}) }) || [];
    const next = [];
    for (const it of sel) {
      const id = it.plantId || (it.plant && it.plant.id) || it.id;
      if (!id) continue;
      const p = getPlant(id);
      next.push({ plantId: id, count: it.count != null ? qty(it.count) : qty(p ? safeQty(p, z) : 1) });
    }
    return next;
  }
  const summaryEl = h('p', { class: 'proposal-summary', id: 'proposal-summary', 'aria-live': 'polite' });
  const undoBtn = h('button', { class: 'btn', type: 'button', id: 'btn-undo', hidden: true, onclick: () => {
    if (!proposal) return;
    for (const z of garden.zones) if (proposal.snapshot.has(z.id)) z.plantings = proposal.snapshot.get(z.id).map((x) => ({ ...x }));
    proposal = null; round++;
    summaryEl.textContent = '';
    undoBtn.hidden = true; allBtn.textContent = ALL_LABEL; surprise.textContent = ZONE_LABEL;
    refresh();
    toast('Proposition annulée : sélection précédente restaurée.');
  } }, 'Annuler la proposition');
  const ALL_LABEL = '🎲 Surprends-moi pour tout le jardin';
  const ZONE_LABEL = '🎲 Surprends-moi';

  function askAmbiances(zones) {
    return new Promise((resolve) => {
      const pk = openAmbiancePicker(document.body, { zones, onConfirm: (m) => resolve(m), onCancel: () => resolve(null) });
      // Rappel du niveau d'entretien (modifiable) sous le titre.
      const single = zones.length === 1 ? zones[0] : null;
      const rem = maintenanceReminder({
        get: () => levelForZone(garden, single),
        set: (id) => { if (single) single.maintenance = id; else garden.context.maintenance = id; change(); syncMaint(); drawZoneInfo(); },
      });
      const dlg = pk && pk.el && pk.el.querySelector('.amb-dialog');
      if (dlg) dlg.insertBefore(rem, dlg.children[2] || null);
    });
  }
  /** « 8 essences · ambiance bucolique · floraison de mars à octobre · ≈ 210 € » */
  function summaryText(sm, targets) {
    const parts = sm.text.split(', ');
    const ids = [...new Set(targets.map((z) => z.ambiance || null))];
    let amb = null;
    if (ids.length === 1 && ids[0]) { const a = ambianceOf(ids[0]); if (a) amb = `ambiance ${a.label.toLowerCase()}`; }
    else if (ids.length > 1 && ids.some(Boolean)) amb = 'ambiances variées selon les zones';
    if (amb) parts.splice(1, 0, amb);
    const lv = [...new Set(targets.map((z) => levelForZone(garden, z)))];
    let mt = null;
    if (lv.length === 1) mt = levelPhrase(lv[0]);
    else if (lv.some((id) => id !== 'green')) mt = 'entretien variable selon les zones';
    if (mt) parts.splice(amb ? 2 : 1, 0, mt);
    return parts.join(' · ');
  }

  async function propose(key, pick) {
    const again = !!proposal && proposal.key === key;
    let targets;
    if (again) targets = garden.zones.filter((z) => proposal.snapshot.has(z.id));
    else {
      const r = await pick();
      if (!r) return;
      targets = r;
      if (!targets.length) { toast('Aucune zone à garnir.'); return; }
      // demande d'ambiance (une zone, ou zone par zone) avant toute proposition
      const amb = await askAmbiances(targets);
      if (!amb) return;
      targets.forEach((z) => { z.ambiance = amb[z.id] || null; });
    }
    if (!targets.length) { toast('Aucune zone à garnir.'); return; }
    const snapshot = again ? proposal.snapshot : new Map(targets.map((z) => [z.id, clonePl(z)]));
    const max = budgetMax();
    const totalArea = targets.reduce((s, z) => { try { return s + shapeArea(z.shape); } catch { return s; } }, 0) || 1;
    round++;
    const results = [];
    try {
      for (const z of targets) {
        let a = 0; try { a = shapeArea(z.shape); } catch { /* */ }
        const share = max ? max * (targets.length === 1 ? 1 : a / totalArea) : null;
        results.push([z, selectionFor(z, share)]);
      }
    } catch (e) { toast('Suggestion impossible : ' + (e && e.message ? e.message : 'erreur')); return; }
    if (!results.some(([, n]) => n.length)) { toast('Aucune proposition possible pour ' + (targets.length === 1 ? 'cette zone.' : 'ces zones.')); return; }
    for (const [z, n] of results) {
      if (snapshot.has(z.id)) z.plantings = snapshot.get(z.id).map((x) => ({ ...x }));
      if (n.length) z.plantings = n;
    }
    proposal = { key, snapshot };
    undoBtn.hidden = false;
    allBtn.textContent = key === 'all' ? '🎲 Autre proposition' : ALL_LABEL;
    surprise.textContent = key !== 'all' ? '🎲 Autre proposition' : ZONE_LABEL;
    refresh();
    drawZoneInfo();
    const sm = summarizeGarden(garden, getPlant);
    summaryEl.textContent = summaryText(sm, targets) + (max && sm.total > max ? ` (au-dessus du budget de ${formatEuro(max, { digits: 0 })})` : '');
    toast('Sélection proposée : retouchez-la à votre guise ou annulez-la.');
  }

  const surprise = h('button', { class: 'btn', type: 'button', id: 'btn-surprise', onclick: () => propose('zone:' + zone().id, () => [zone()]) }, ZONE_LABEL);
  const allBtn = h('button', { class: 'btn btn-primary btn-block btn-xl', type: 'button', id: 'btn-surprise-all', onclick: () => propose('all', async () => {
    const plantable = garden.zones.filter((z) => !NO_PLANT.has(z.type));
    const empty = plantable.filter((z) => !(z.plantings || []).length);
    if (empty.length) return empty;
    if (!plantable.length) return plantable;
    const ok = await confirmDialog('Toutes les zones ont déjà des essences. Les remplacer par une proposition ? (vous pourrez l’annuler)', { ok: 'Remplacer' });
    return ok ? plantable : null;
  }) }, ALL_LABEL);
  const budgetInput = h('input', { id: 'budget-max', type: 'number', inputmode: 'decimal', min: '0', step: '10', placeholder: 'Sans limite', oninput: () => drawBudget() });

  const gardenMaint = gardenMaintenancePicker(garden, { onChange: () => { limit = PAGE; refresh(); drawZoneInfo(); } });
  function syncMaint() { const c = gardenMaint.querySelector('.maint-chips'); if (c) c.setValue(levelForZone(garden, null)); }

  el.replaceChildren(
    h('button', { class: 'btn btn-block btn-xl', type: 'button', id: 'btn-preview', 'data-act': 'preview', onclick: () => openPlanPreview('zones') }, '🗺️ Revoir le plan et la 3D'),
    h('section', { class: 'card', 'data-role': 'maintenance-card' }, gardenMaint),
    h('section', { class: 'card surprise-all' },
      allBtn,
      h('div', { class: 'field' }, h('label', { for: 'budget-max' }, 'Budget max en € (facultatif)'), budgetInput),
      summaryEl, undoBtn),
    warnBox,
    h('section', { class: 'card' },
      h('div', { class: 'field' }, h('label', { for: 'zone-sel' }, 'Zone'), zoneSel), zoneHead, zoneInfo, pondBox, chosenBox, surprise),
    h('section', { class: 'card' },
      h('h3', null, 'Essences conseillées'),
      h('div', { class: 'field' }, h('label', { for: 'plant-search' }, 'Rechercher (nom commun ou latin)'),
        h('input', { id: 'plant-search', type: 'search', oninput: (e) => { query = e.target.value; limit = PAGE; drawList(); } })),
      filterBox, listBox, moreBox, pondExcluded),
    h('div', { class: 'budget-spacer', 'aria-hidden': 'true' }),
    budgetBar);
  drawZoneInfo(); drawChosen(); drawList(); drawWarnings(); drawBudget();
  return () => { resetThumbs(); el.replaceChildren(); };
}
