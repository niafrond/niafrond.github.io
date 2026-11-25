// Étape « Massifs » : en mode auto, l'app calcule des massifs fleuris dans les vides du jardin
// (aperçu sur plan, réglages, cartes de massifs, verrouillage, validation → zones `auto`).
import { h, createCanvas, injectStyles, svgEl, esc } from './draw-util.js';
import { toast, gardenHash } from './wizard.js';
import { attachNorthBadge } from './north-pop.js';
import { renderItemsSVG } from '../render-items.js';
import { bounds, centroid, pointInPolygon, shapePolygon, shapeArea, shapeBounds } from '../geometry.js';
import { bedModeOf, getZoneType } from '../model.js';
import { freeSpace, proposeBeds, designBed, bedsToZones } from '../massifs.js';
import { getPlantPhoto } from '../photos.js';
import { levelForZone } from '../maintenance.js';
import { getAmbiance } from '../ambiances.js';
import { openAmbiancePicker, ambianceOf } from './ambiance-picker.js';
import { formatEuro } from '../pricing.js';
import { OBSTACLE_LABELS } from '../render-common.js';
import { bedColor, bedCard, settingsPanel, createThumbLoader, bloomMonthsOf, monthsText } from './beds-panel.js';

const MIN_AREA = 2;
const PROGRESS_AFTER_MS = 300;
const NO_SPACE = 'Pas de place libre : réduisez les zones ou le mobilier.';
const NO_CONTOUR = 'Dessinez d’abord le contour du terrain (étape Terrain).';
const clone = (o) => JSON.parse(JSON.stringify(o));
const fmt1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
const tick = () => new Promise((r) => setTimeout(r, 0));
const UNDO = new WeakMap(); // jardin → {zones, draft} : dernière validation annulable (tant que l'application tourne)

let cssDone = false;
function injectBedStyles() {
  try {
    if (cssDone || typeof document === 'undefined' || document.getElementById('jd-beds-css')) return;
    cssDone = true;
    const link = document.createElement('link');
    link.id = 'jd-beds-css'; link.rel = 'stylesheet';
    link.href = new URL('./beds.css', import.meta.url).href;
    document.head.appendChild(link);
  } catch { /* styles par défaut */ }
}

/** Brouillon des propositions (garden.context.bedDraft), complété avec ses valeurs par défaut. */
export function ensureBedDraft(garden) {
  const c = garden.context || (garden.context = {});
  const d = c.bedDraft && typeof c.bedDraft === 'object' ? c.bedDraft : (c.bedDraft = {});
  if (!Number.isFinite(d.seed)) d.seed = 1;
  d.settings = { coverage: 50, style: 'mixed', palette: 'auto', ambiance: null, budget: null, ...(d.settings || {}) };
  if (!Array.isArray(d.beds)) d.beds = [];
  if (!Array.isArray(d.locked)) d.locked = [];
  if (!d.applied || typeof d.applied !== 'object') d.applied = {};
  return d;
}

/** Massif « pseudo-proposé » reconstruit depuis une zone auto déjà validée. */
function bedFromZone(z) {
  const pts = z.shape && z.shape.kind === 'polygon' ? z.shape.points.map((p) => ({ x: p.x, y: p.y })) : null;
  if (!pts) return null;
  const area = Math.round(shapeArea(z.shape) * 10) / 10;
  const bb = bounds(pts);
  const info = z.autoInfo || {};
  return {
    id: String(z.id).replace(/^z_/, ''), role: info.role || 'ilot', shape: { kind: 'polygon', points: pts }, areaM2: area,
    widthM: Math.round(Math.min(bb.width, bb.height) * 10) / 10, sunLevel: null, why: info.why || '', plantings: (z.plantings || []).map((p) => ({ ...p })),
    summary: info.summary || null, plantsWhy: '', alternatives: [], ambiance: z.ambiance || null, seed: info.seed ?? null, label: z.label,
  };
}

export function mountBeds(el, {
  garden, onChange, navigate, getPhoto = getPlantPhoto, IO, plants,
} = {}) {
  injectStyles(); injectBedStyles();
  const change = () => { if (onChange) onChange(garden); };
  const go = (step) => { if (navigate) navigate(gardenHash(garden.id, step)); };
  let destroyed = false;
  let runId = 0;
  let thumbs = null;
  let cleanup = [];
  const undoBox = () => UNDO.get(garden) || null;

  // ------------------------------------------------------------ état
  const draft = ensureBedDraft(garden);
  let beds = draft.beds;
  const zoneForBed = (b) => (draft.applied[b.id] ? garden.zones.find((z) => z.id === draft.applied[b.id]) : null);
  (function syncWithZones() {
    // massifs déjà validés : suivre les modifications faites dans l'étape Zones (forme, essences, nom) ou leur suppression
    beds = beds.filter((b) => {
      if (!draft.applied[b.id]) return true;
      const z = zoneForBed(b);
      if (!z || !z.auto) { delete draft.applied[b.id]; return false; }
      if (z.shape && z.shape.kind === 'polygon') { b.shape = { kind: 'polygon', points: z.shape.points.map((p) => ({ x: p.x, y: p.y })) }; b.areaM2 = Math.round(shapeArea(z.shape) * 10) / 10; }
      b.plantings = (z.plantings || []).map((p) => ({ ...p }));
      b.ambiance = z.ambiance || null;
      b.label = z.label;
      return true;
    });
    // zones auto présentes sans brouillon : on les affiche comme massifs validés
    for (const z of garden.zones) {
      if (!z.auto || Object.values(draft.applied).includes(z.id)) continue;
      const b = bedFromZone(z);
      if (b && !beds.some((x) => x.id === b.id)) { beds.push(b); draft.applied[b.id] = z.id; }
    }
    const lockedSet = new Set(draft.locked);
    beds.forEach((b) => { b.locked = lockedSet.has(b.id) || !!b.locked; });
    draft.beds = beds;
  }());
  const persist = () => {
    draft.beds = beds;
    draft.locked = beds.filter((b) => b.locked).map((b) => b.id);
    change();
  };

  const manualZones = () => garden.zones.filter((z) => !z.auto);
  const withZones = (zones) => ({ ...garden, zones });
  const lockedBedsOf = (list) => list.filter((b) => b.locked);
  const gardenWith = (extraBeds) => withZones([...manualZones(), ...bedsToZones(withZones([]), extraBeds, { plants, startIndex: 0 })]);
  const settings = draft.settings;
  const maintLevel = () => levelForZone(garden, null);
  const hasContour = () => Array.isArray(garden.boundary) && garden.boundary.length >= 3 && garden.boundaryClosed;
  const nameOf = (b, i) => {
    if (b.label) return b.label;
    const a = b.ambiance ? getAmbiance(b.ambiance) : null;
    return a ? `Massif ${a.label.toLowerCase()} n°${i + 1}` : `Massif n°${i + 1}`;
  };

  // ------------------------------------------------------------ mode manuel
  function renderManual() {
    el.replaceChildren(h('section', { class: 'card beds-manual', 'data-role': 'beds-manual' },
      h('h2', null, '🖌 Vos massifs sont dessinés à la main'),
      h('p', { class: 'muted' }, 'Vous avez choisi de dessiner vous-même les zones de fleurs et de plantes à l’étape précédente. Rien à calculer ici.'),
      h('p', { class: 'muted' }, 'Envie d’un coup de main ? L’app peut calculer les meilleurs massifs dans les vides de votre jardin et choisir les plantes.'),
      h('div', { class: 'beds-row' },
        h('button', { type: 'button', class: 'btn btn-primary btn-block', 'data-act': 'to-auto', onclick: () => { garden.context.bedMode = 'auto'; change(); mode(); } }, '✨ Laisser l’app calculer les massifs'),
        h('button', { type: 'button', class: 'btn btn-block', 'data-act': 'next', onclick: () => go('plants') }, 'Passer à l’étape suivante →'))));
  }

  // ------------------------------------------------------------ mode auto
  function renderAuto() {
    const root = h('div', { class: 'beds-auto', 'data-role': 'beds-auto' });
    const head = h('section', { class: 'card beds-intro' },
      h('h2', null, '🌸 Massifs calculés par l’app'),
      h('p', { class: 'muted' }, 'L’app place des massifs fleuris dans les vides du jardin et choisit pour chacun les meilleures plantes (floraison étalée, couleurs harmonieuses, adaptées au soleil).'),
      h('button', { type: 'button', class: 'btn btn-sm', 'data-act': 'to-manual', onclick: () => { garden.context.bedMode = 'manual'; change(); mode(); } }, '🖌 Je préfère dessiner mes massifs'));

    // --- plan
    const wrap = h('div', { class: 'jd-canvas-wrap bed-plan', 'data-role': 'bed-plan' });
    const plan = h('div', { class: 'jd bed-plan-card' }, wrap);
    const legend = h('p', { class: 'bed-legend small muted', 'data-role': 'bed-summary', role: 'status', 'aria-live': 'polite' });
    const gMain = svgEl('g', {});
    const cv = createCanvas(wrap, { onView: () => drawPlan(), handlers: { tap: onPlanTap } });
    cv.svg.append(gMain);
    cv.svg.setAttribute('aria-label', 'Plan des massifs proposés');
    const north = attachNorthBadge(wrap, { garden, onChange: () => change() });
    const zoomBox = h('div', { class: 'bed-zoom' },
      ...[['＋', 'Zoom avant', () => cv.zoomCenter(1.4)], ['－', 'Zoom arrière', () => cv.zoomCenter(1 / 1.4)], ['⤢', 'Recentrer', () => fit()]].map(([t, l, f]) => h('button', { type: 'button', class: 'jd-btn', 'aria-label': l, onclick: f }, t)));
    wrap.append(zoomBox);
    const fit = () => {
      const pts = [...garden.boundary];
      if (pts.length >= 2) cv.fit(bounds(pts), 1.2); else { cv.view.cx = 5; cv.view.cy = 4; cv.view.mpp = 0.04; cv.apply(); }
    };

    const poly = (pts) => pts.map((p) => `${p.x},${p.y}`).join(' ');
    const NSv = 'vector-effect="non-scaling-stroke"';
    function freeMaskPath(fs) {
      // lignes de cellules libres fusionnées en rectangles (un seul tracé)
      const { nx, ny, grid, cell, minX, minY } = fs;
      let d = '';
      let open = new Map(); // "i0:i1" → {j0, rows}
      const flush = (keep) => {
        for (const [k, r] of open) {
          if (keep && keep.has(k)) continue;
          const [i0, i1] = k.split(':').map(Number);
          d += `M${+(minX + i0 * cell).toFixed(3)} ${+(minY + r.j0 * cell).toFixed(3)}h${+((i1 - i0) * cell).toFixed(3)}v${+(r.rows * cell).toFixed(3)}h${-+((i1 - i0) * cell).toFixed(3)}z`;
          open.delete(k);
        }
      };
      for (let j = 0; j < ny; j++) {
        const runs = new Set(); const next = new Map();
        let i = 0;
        while (i < nx) {
          if (!grid[j * nx + i]) { i++; continue; }
          let e = i; while (e < nx && grid[j * nx + e]) e++;
          const k = `${i}:${e}`; runs.add(k);
          next.set(k, open.has(k) ? { j0: open.get(k).j0, rows: open.get(k).rows + 1 } : { j0: j, rows: 1 });
          i = e;
        }
        flush(runs);
        open = new Map([...open, ...next]);
      }
      flush(null);
      return d;
    }
    let lastFree = null;
    const freeNow = () => {
      try { return freeSpace(gardenWith(beds), { cell: 0.25 }); } catch { return null; }
    };
    function drawPlan() {
      if (destroyed) return;
      if (north) north.update();
      let s = '';
      s += `<defs><pattern id="bed-dots" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.1" fill="#4f9a5c" fill-opacity=".55"/></pattern></defs>`;
      if (garden.boundary.length >= 3) s += `<polygon points="${poly(garden.boundary)}" fill="#2e7d32" fill-opacity=".05" stroke="#222" stroke-width="2.5" stroke-linejoin="round" ${NSv}/>`;
      if (lastFree && lastFree.nx) s += `<path data-role="free-space" d="${freeMaskPath(lastFree)}" fill="url(#bed-dots)" stroke="none"/>`;
      for (const o of garden.obstacles || []) {
        if (o.kind === 'tree' && o.center) s += `<circle cx="${o.center.x}" cy="${o.center.y}" r="${o.radius || 1}" fill="#558b2f" fill-opacity=".12" stroke="#33691e" stroke-dasharray="5 3" ${NSv}/>`;
        else if (o.points && o.points.length >= 3) s += `<polygon points="${poly(o.points)}" fill="#9e9e9e" fill-opacity=".4" stroke="#616161" ${NSv}/>`;
        else if (o.points) s += `<polyline points="${poly(o.points)}" fill="none" stroke="#616161" stroke-width="3" ${NSv}/>`;
      }
      let placed = '';
      try { placed = renderItemsSVG(garden, { scale: 1, px: cv.px(1), names: false, bg: '#fafaf5' }); } catch { placed = ''; }
      s += `<g pointer-events="none" opacity=".85">${placed}</g>`;
      const fs = cv.px(11);
      for (const o of garden.obstacles || []) {
        const nm = OBSTACLE_LABELS[o.kind];
        if (!nm || o.kind === 'wall' || o.kind === 'fence') continue;
        const c = o.center ? o.center : (o.points && o.points.length >= 3 ? centroid(o.points) : null);
        if (c) s += `<text x="${c.x}" y="${c.y + fs / 3}" font-size="${fs}" text-anchor="middle" fill="#455a64" stroke="#fff" stroke-width="${fs * 0.2}" paint-order="stroke">${esc(nm)}</text>`;
      }
      // zones existantes (hors massifs auto) en grisé
      for (const z of manualZones()) {
        const t = getZoneType(z.type); if (!t) continue;
        let pl = []; try { pl = shapePolygon(z.shape, 32); } catch { pl = []; }
        if (pl.length < 3) continue;
        s += `<polygon points="${poly(pl)}" fill="#8d8d86" fill-opacity=".28" stroke="#6f6f68" stroke-opacity=".7" stroke-width="1.2" ${NSv}/>`;
        const c = centroid(pl);
        s += `<text x="${c.x}" y="${c.y + fs / 3}" font-size="${fs}" text-anchor="middle" fill="#55554f" stroke="#fff" stroke-width="${fs * 0.2}" paint-order="stroke">${t.icon} ${esc(z.label)}</text>`;
      }
      // massifs proposés
      beds.forEach((b, i) => {
        const col = bedColor(i);
        const pl = b.shape.points;
        s += `<polygon data-bed-shape="${esc(b.id)}" points="${poly(pl)}" fill="${col}" fill-opacity=".62" stroke="${col}" stroke-width="${b.locked ? 3.5 : 2}" stroke-linejoin="round" ${b.locked ? '' : 'stroke-opacity=".9"'} ${NSv}/>`;
        const c = centroid(pl);
        s += `<circle cx="${c.x}" cy="${c.y}" r="${cv.px(11)}" fill="#fff" fill-opacity=".92" stroke="${col}" stroke-width="2" ${NSv}/>`;
        s += `<text x="${c.x}" y="${c.y}" font-size="${cv.px(12)}" font-weight="800" text-anchor="middle" dominant-baseline="central" fill="#222">${i + 1}${b.locked ? '' : ''}</text>`;
      });
      gMain.innerHTML = s;
    }
    function onPlanTap(w) {
      const idx = beds.findIndex((b) => pointInPolygon(w, b.shape.points));
      if (idx < 0) return;
      const card = results.querySelector(`[data-bed="${CSS.escape ? CSS.escape(beds[idx].id) : beds[idx].id}"]`);
      if (card) { card.scrollIntoView && card.scrollIntoView({ block: 'center', behavior: 'smooth' }); card.classList.add('flash'); setTimeout(() => card.classList.remove('flash'), 1200); }
    }

    // --- réglages
    const panel = settingsPanel(settings, {
      getMaint: maintLevel,
      setMaint: (id) => { garden.context.maintenance = id; },
      onChange: () => { persist(); },
    });

    // --- actions de calcul
    const progText = h('span', { 'data-role': 'bed-progress-text' }, 'Calcul des massifs…');
    const progBar = h('progress', { max: '100', value: '0', 'aria-hidden': 'true' });
    const prog = h('div', { class: 'bed-progress', role: 'status', 'aria-live': 'polite', hidden: true, 'data-role': 'bed-progress' }, progText, progBar);
    const bCompute = h('button', { type: 'button', class: 'btn btn-primary btn-block btn-xl', 'data-act': 'compute', onclick: () => compute(false) }, '✨ Calculer les massifs');
    const bAnother = h('button', { type: 'button', class: 'btn btn-block', 'data-act': 'another', onclick: () => compute(true) }, '🎲 Autre proposition');
    const msg = h('p', { class: 'notice', role: 'status', 'aria-live': 'polite', 'data-role': 'bed-message', hidden: true });
    const actions = h('section', { class: 'card beds-actions' }, bCompute, bAnother, prog, msg);
    const setMsg = (t, kind = 'info') => { msg.textContent = t || ''; msg.hidden = !t; msg.className = `notice ${kind}`; msg.dataset.kind = t ? kind : ''; };

    // --- résultats
    const results = h('div', { class: 'beds-results', 'data-role': 'beds-results' });
    const bValidate = h('button', { type: 'button', class: 'btn btn-primary btn-block btn-xl', 'data-act': 'validate', onclick: () => validate() }, '✔ Valider ces massifs');
    const bUndo = h('button', { type: 'button', class: 'btn btn-block', 'data-act': 'undo-validation', onclick: () => undoValidation() }, '↩ Annuler la dernière validation');
    const sumLine = h('p', { class: 'beds-sum', 'data-role': 'beds-total' });
    const list = h('ul', { class: 'bed-list', 'aria-label': 'Massifs proposés' });
    results.append(sumLine, bValidate, bUndo, list);

    const totalBeds = () => beds.reduce((s, b) => s + (b.areaM2 || 0), 0);
    const totalCost = () => beds.reduce((s, b) => s + (b.summary && Number.isFinite(b.summary.costEur) ? b.summary.costEur : 0), 0);

    function refresh({ cards = true, free = true } = {}) {
      if (destroyed) return;
      if (free) lastFree = freeNow();
      const freeA = lastFree ? lastFree.freeArea : 0;
      const n = beds.length;
      legend.textContent = !hasContour() ? NO_CONTOUR
        : `Vide à planter : ${fmt1(freeA)} m²${n ? ` · ${n} massif${n > 1 ? 's' : ''} sur ${fmt1(totalBeds())} m²` : ''}`;
      bAnother.hidden = !n;
      results.hidden = !n && !undoBox();
      bValidate.hidden = !n;
      bUndo.hidden = !undoBox();
      sumLine.textContent = n ? `${n} massif${n > 1 ? 's' : ''} · ${fmt1(totalBeds())} m² · ≈ ${formatEuro(totalCost(), { digits: 0 })}` : '';
      sumLine.hidden = !n;
      const applied = n && beds.every((b) => draft.applied[b.id]);
      bValidate.textContent = applied ? '✔ Revalider ces massifs' : '✔ Valider ces massifs';
      drawPlan();
      if (cards) renderCards();
    }
    function renderCards() {
      if (thumbs) thumbs.destroy();
      thumbs = createThumbLoader({ getPhoto, IO });
      list.replaceChildren(...beds.map((b, i) => bedCard(b, {
        index: i, name: nameOf(b, i), locked: !!b.locked, color: bedColor(i),
        altLabel: b.variant && b.alternatives && b.alternatives[b.variant - 1] ? b.alternatives[b.variant - 1].label : '',
      }, {
        lock: () => { b.locked = !b.locked; persist(); refresh(); },
        remove: () => { beds = beds.filter((x) => x !== b); draft.beds = beds; persist(); refresh(); toast('Massif retiré de la proposition.'); },
        shuffle: () => { reshuffle(b); },
        ambiance: () => pickAmbiance(b, i),
        edit: () => editShape(b, i),
      }, { thumbs })));
    }

    // --- calcul
    const common = () => ({
      ambiance: settings.ambiance || null, maintenance: maintLevel(), palette: settings.palette || 'auto', plants,
    });
    async function compute(another) {
      if (destroyed || bCompute.disabled) return;
      if (!hasContour()) { setMsg(NO_CONTOUR, 'warn'); return; }
      const my = ++runId;
      if (another) draft.seed = (draft.seed || 1) + 1;
      bCompute.disabled = true; bAnother.disabled = true; bValidate.disabled = true;
      setMsg('');
      progBar.value = 0; progText.textContent = 'Calcul des massifs…';
      const showTimer = setTimeout(() => { if (my === runId && !destroyed) prog.hidden = false; }, PROGRESS_AFTER_MS);
      const end = () => { clearTimeout(showTimer); prog.hidden = true; if (!destroyed) { bCompute.disabled = false; bAnother.disabled = false; bValidate.disabled = false; } };
      try {
        await tick();
        if (destroyed || my !== runId) { end(); return; }
        const locked = lockedBedsOf(beds);
        const base = gardenWith(locked);
        const free0 = freeSpace(withZones(manualZones()), { cell: 0.25 }).freeArea;
        const freeBase = freeSpace(base, { cell: 0.25 }).freeArea;
        const wanted = Math.min(1, Math.max(0.1, (settings.coverage || 50) / 100)) * free0;
        const lockedArea = locked.reduce((s, b) => s + b.areaM2, 0);
        const remaining = Math.max(0, wanted - lockedArea);
        let shapes = [];
        if (freeBase >= MIN_AREA && remaining >= MIN_AREA * 0.9) {
          const cov = Math.min(1, Math.max(0.02, remaining / freeBase));
          shapes = proposeBeds(base, { ...common(), design: false, seed: draft.seed, coverage: cov, style: settings.style || 'mixed', minArea: MIN_AREA });
        }
        if (!shapes.length && !locked.length) {
          beds = []; draft.beds = beds; persist(); refresh();
          setMsg(NO_SPACE, 'warn');
          end(); return;
        }
        const totalShape = shapes.reduce((s, b) => s + b.areaM2, 0) || 1;
        const lockedCost = locked.reduce((s, b) => s + ((b.summary && b.summary.costEur) || 0), 0);
        const budgetLeft = settings.budget ? Math.max(0, settings.budget - lockedCost) : null;
        const fresh = [];
        for (let i = 0; i < shapes.length; i++) {
          if (destroyed || my !== runId) { end(); return; }
          progText.textContent = `Calcul des massifs… ${i + 1}/${shapes.length}`; progBar.value = Math.round((i / shapes.length) * 100);
          await tick();
          if (destroyed || my !== runId) { end(); return; }
          const b = shapes[i];
          const d = designBed(base, b, { ...common(), seed: draft.seed, budget: budgetLeft != null ? budgetLeft * (b.areaM2 / totalShape) : undefined });
          Object.assign(b, { plantings: d.plantings, summary: d.summary, plantsWhy: d.why, alternatives: d.alternatives, ambiance: settings.ambiance || null, seed: draft.seed, variant: 0, locked: false });
          fresh.push(b);
        }
        // les massifs gardés gardent leur rang ; les nouveaux suivent
        beds = [...locked, ...fresh];
        draft.beds = beds;
        persist(); refresh();
        if (!beds.length) setMsg(NO_SPACE, 'warn');
        else if (!fresh.length) setMsg('Rien à ajouter : les massifs gardés couvrent déjà la part de vide demandée.', 'info');
      } catch (e) {
        console.error(e);
        setMsg(`Le calcul a échoué : ${e && e.message ? e.message : 'erreur'}`, 'warn');
      }
      end();
    }

    // --- actions par massif
    function reshuffle(b) {
      const alts = b.alternatives || [];
      const next = (b.variant || 0) + 1;
      if (next <= alts.length) {
        const a = alts[next - 1];
        Object.assign(b, { plantings: a.plantings.map((p) => ({ ...p })), summary: a.summary, plantsWhy: a.why, variant: next });
        if (a.ambiance) b.ambiance = a.ambiance;
        delete b.label;
      } else redesign(b, { ambiance: b.ambiance, bump: true });
      persist(); refresh({ free: false });
    }
    function redesign(b, { ambiance, bump = false } = {}) {
      const seed = bump ? ((b.designSeed || draft.seed || 1) + 7) : (b.designSeed || draft.seed || 1);
      const d = designBed(withZones(manualZones()), b, { ...common(), ambiance: ambiance || null, seed, budget: settings.budget ? settings.budget * (b.areaM2 / Math.max(1, totalBeds())) : undefined });
      Object.assign(b, { plantings: d.plantings, summary: d.summary, plantsWhy: d.why, alternatives: d.alternatives, ambiance: ambiance || null, variant: 0, designSeed: seed });
    }
    function pickAmbiance(b, i) {
      const z = { id: b.id, label: nameOf(b, i), ambiance: b.ambiance || null };
      openAmbiancePicker(document.body, {
        zones: [z], defaults: { [b.id]: b.ambiance || null }, title: 'Quelle ambiance pour ce massif ?',
        onConfirm: (m) => {
          const id = m[b.id] || null;
          redesign(b, { ambiance: id });
          delete b.label;
          persist(); refresh({ free: false });
          const a = ambianceOf(id);
          toast(a ? `Ambiance « ${a.label} » : plantes redessinées pour ce massif.` : 'Ambiance retirée : plantes redessinées pour ce massif.');
        },
      });
    }
    function editShape(b, i) {
      const prevZone = zoneForBed(b);
      let z = prevZone;
      if (z) { z.auto = false; delete z.autoInfo; } else {
        z = bedsToZones(withZones(garden.zones), [{ ...b, ambiance: b.ambiance || null }], { plants, startIndex: i })[0];
        z.label = nameOf(b, i); z.auto = false; delete z.autoInfo;
        garden.zones.push(z);
      }
      beds = beds.filter((x) => x !== b); draft.beds = beds; delete draft.applied[b.id];
      persist();
      toast('Le massif est devenu une zone ordinaire : modifiez sa forme à l’étape Zones.');
      go('zones');
    }

    // --- validation / annulation
    function validate() {
      if (!beds.length) return;
      const prevZones = clone(garden.zones);
      UNDO.set(garden, { zones: prevZones, draft: clone(draft) });
      const kept = manualZones();
      const fresh = bedsToZones(withZones(kept), beds, { plants, startIndex: 0 });
      fresh.forEach((z, i) => {
        const prev = prevZones.find((p) => p.id === draft.applied[beds[i].id]);
        if (prev) { z.label = prev.label || z.label; z.notes = prev.notes || ''; if (prev.maintenance) z.maintenance = prev.maintenance; }
      });
      garden.zones = [...kept, ...fresh];
      draft.applied = {};
      beds.forEach((b, i) => { draft.applied[b.id] = fresh[i].id; b.label = fresh[i].label; });
      persist();
      refresh();
      toast(`${fresh.length} massif${fresh.length > 1 ? 's' : ''} ajouté${fresh.length > 1 ? 's' : ''} au plan : retrouvez-les dans l’étape Essences.`);
      go('plants');
    }
    function undoValidation() {
      const u = undoBox();
      if (!u) return;
      garden.zones = u.zones;
      garden.context.bedDraft = u.draft;
      UNDO.delete(garden);
      change();
      toast('Validation annulée : zones précédentes restaurées.');
      mode();
    }

    root.append(head, plan, legend, panel.el, actions, results);
    el.replaceChildren(root);
    cleanup.push(() => { cv.destroy(); if (north) north.destroy(); });
    lastFree = freeNow();
    refresh();
    if (hasContour() && lastFree && lastFree.freeArea < MIN_AREA && !beds.length) setMsg(NO_SPACE, 'warn');
    if (!hasContour()) setMsg(NO_CONTOUR, 'warn');
    requestAnimationFrame(() => fit());
    setTimeout(() => { if (!destroyed) fit(); }, 80);
  }

  function mode() {
    cleanup.forEach((f) => { try { f(); } catch { /* */ } }); cleanup = [];
    if (thumbs) { thumbs.destroy(); thumbs = null; }
    if (bedModeOf(garden) === 'auto') renderAuto(); else renderManual();
  }
  void shapeBounds; void bloomMonthsOf; void monthsText;
  mode();
  return function unmount() {
    destroyed = true; runId++;
    cleanup.forEach((f) => { try { f(); } catch { /* */ } });
    if (thumbs) thumbs.destroy();
    el.replaceChildren();
  };
}
