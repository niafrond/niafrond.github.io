// Vue 3D temps réel du jardin (PC) : WebGL (GPU) + génération des instances en Web Workers (CPU multicœur).
// three.js n'est chargé qu'à la demande (import dynamique) : rien n'est téléchargé tant que la vue 3D n'est pas ouverte.
import { h, saveBlob } from './draw-util.js';
import { getPlant } from '../catalog.js';
import { buildSceneAsync, sunDirection } from '../render-gl.js';
import { createPool, poolSize } from '../gl-pool.js';
import { QUALITIES, QUALITY_ORDER, autoQuality, resolveQuality, isSoftwareRenderer, isStrongMobileGpu, lowerQuality } from '../gl-quality.js';
import { renderPhoto } from '../gl-photo.js';
import { seasonLabel, seasonName, SEASON_DOY } from '../gl-season.js';
import { buildLabelGroups } from '../gl-labels.js';
import { createLabelsUI } from './view3d-labels.js';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const FORCE_KEY = 'jardin-force-3d';
let webgl2Cache = null;
let webgl2Gpu = '';

/** WebGL2 est-il disponible dans ce navigateur ? (résultat mémorisé, avec le nom du GPU) */
export function hasWebGL2() {
  if (webgl2Cache !== null) return webgl2Cache;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    webgl2Cache = !!gl;
    try {
      const ext = gl && gl.getExtension && gl.getExtension('WEBGL_debug_renderer_info');
      webgl2Gpu = String((ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || '');
    } catch (e) { webgl2Gpu = ''; }
    const lose = gl && gl.getExtension && gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  } catch (e) { webgl2Cache = false; }
  return webgl2Cache;
}
/** Vide le cache de détection WebGL2 (tests). */
export function resetWebGL2Cache() { webgl2Cache = null; webgl2Gpu = ''; }

const mq = (q) => { try { return typeof globalThis.matchMedia === 'function' && !!globalThis.matchMedia(q).matches; } catch (e) { return false; } };

/** Appareil mobile : pointeur tactile (coarse), écran < 900 px ou UA Android. */
export function isMobileDevice() {
  let ua = '';
  try { ua = String(globalThis.navigator && globalThis.navigator.userAgent); } catch (e) { /* ignoré */ }
  const w = Number(globalThis.innerWidth) || 0;
  return mq('(pointer: coarse)') || (w > 0 && w < 900) || /Android/i.test(ua);
}

/**
 * La vue 3D est-elle viable ici ? WebGL2 requis, pas d'« économie de données » ; sur mobile : pas de rendu logiciel pur,
 * `navigator.deviceMemory` ≥ 3 si connu et au moins 2 cœurs. `?3d=1` ou `localStorage['jardin-force-3d']` forcent
 * (WebGL2 reste indispensable).
 */
export function isView3DCapable() {
  let forced = false;
  try { forced = /[?&]3d=1(&|$)/.test(String(globalThis.location && globalThis.location.search)); } catch (e) { /* ignoré */ }
  try { const v = globalThis.localStorage && globalThis.localStorage.getItem(FORCE_KEY); if (v && v !== '0' && v !== 'false') forced = true; } catch (e) { /* stockage indisponible */ }
  if (!hasWebGL2()) return false;
  if (forced) return true;
  if (mq('(prefers-reduced-data: reduce)')) return false;
  if (isMobileDevice()) {
    if (isSoftwareRenderer(webgl2Gpu)) return false;
    const nav = globalThis.navigator || {};
    if (Number.isFinite(nav.deviceMemory) && nav.deviceMemory < 3) return false;
    if (Number.isFinite(nav.hardwareConcurrency) && nav.hardwareConcurrency < 2) return false;
  }
  return true;
}
/** Ancien nom (vue réservée au PC), conservé pour compatibilité. */
export const isDesktop3DCapable = isView3DCapable;

function injectCss() {
  try {
    if (document.getElementById('v3d-styles')) return;
    const link = document.createElement('link');
    link.id = 'v3d-styles'; link.rel = 'stylesheet';
    link.href = new URL('./view3d.css', import.meta.url).href;
    document.head.appendChild(link);
  } catch (e) { /* styles par défaut */ }
}

const dayOfYear = (d) => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 86400000);
const fromDoy = (year, n) => new Date(year, 0, n);
const hLabel = (hr) => { const m = Math.round(hr * 60); return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`; };
const dLabel = (d) => `${d.getDate()} ${MOIS[d.getMonth()]}`;
const slug = (s) => String(s || 'jardin').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'jardin';
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);

/**
 * Monte la vue 3D plein cadre dans `el`. Retourne `unmount()` (avec `unmount.api` et `unmount.ready`).
 * @param {HTMLElement} el
 * @param {{garden:object, onClose?:Function}} props
 */
export function mountView3D(el, { garden, onClose } = {}) {
  injectCss();
  const g = garden || { name: 'Jardin', boundary: [], zones: [], obstacles: [] };
  const root = h('div', { class: 'v3d', role: 'dialog', 'aria-label': `Vue 3D de ${g.name || 'votre jardin'}`, 'data-role': 'view3d' });
  const stage = h('div', { class: 'v3d-stage' });
  const loading = h('div', { class: 'v3d-overlay', 'data-role': 'loading' }, h('div', { class: 'v3d-spinner' }), h('p', null, 'Chargement du moteur 3D…'));
  root.append(stage, loading);
  el.appendChild(root);

  const mobile = isMobileDevice();
  if (mobile) root.classList.add('v3d--mobile');
  let disposed = false;
  let THREE = null; let OrbitControls = null;
  let renderer = null; let canvas = null; let camera = null; let controls = null; let api3 = null; let pool = null;
  let raf = 0; let dirty = true; let busy = false;
  let envTex = null; let envElev = -99; let pmrem = null;
  const viewGroupItems = {};
  const S = {
    hour: 15, date: new Date(), age: 1, names: true, latin: false, quality: 'auto', qualityResolved: 'medium', shadows: true, grid: false,
    gpu: '', software: false, fps: 0, view: 'ne', mode: 'orbit', playing: false, growing: false, photoBusy: false, doyF: 0, lapse: false, speed: 1, leaves: true,
  };
  S.doyF = dayOfYear(S.date);
  const glat = g.context && g.context.location && Number.isFinite(g.context.location.lat) ? g.context.location.lat : 46.5;
  const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 2;
  let qParams = resolveQuality('medium', { mobile });

  // ── panneau ──
  const q$ = (sel) => root.querySelector(sel);
  const info = h('div', { class: 'v3d-info', 'data-role': 'info', 'aria-live': 'polite' });
  const fpsEl = h('span', { 'data-role': 'fps' }, '— FPS');
  const hourLbl = h('output', { 'data-role': 'hour-label' });
  const ageLbl = h('output', { 'data-role': 'age-label' });
  const hourIn = h('input', { type: 'range', min: '6', max: '21', step: '0.25', value: String(S.hour), 'data-role': 'hour', 'aria-label': 'Heure (solaire)' });
  const seasonIn = h('input', { type: 'range', min: '1', max: '365', step: '1', value: String(Math.round(S.doyF)), 'data-role': 'season', 'aria-label': 'Saison : jour de l’année' });
  const seasonLbl = h('output', { class: 'v3d-season-label', 'data-role': 'season-label', 'aria-live': 'polite' });
  const ticks = h('div', { class: 'v3d-ticks', 'aria-hidden': 'true' }, 'JFMAMJJASOND'.split('').map((l) => h('span', null, l)));
  const lapseBtn = h('button', { type: 'button', class: 'v3d-btn v3d-primary', 'data-act': 'play-year', 'aria-pressed': 'false' }, '▶ Année accélérée');
  const speedSel = h('select', { 'data-role': 'lapse-speed', 'aria-label': 'Vitesse de l’année accélérée' }, h('option', { value: '0.5' }, '× 0,5 (30 s)'), h('option', { value: '1', selected: true }, '× 1 (15 s)'), h('option', { value: '2' }, '× 2 (8 s)'));
  const leavesCb = h('input', { type: 'checkbox', checked: true, 'data-role': 'leaves' });
  const leavesTxt = h('span', null, ' Feuilles qui tombent');
  const stripIn = h('input', { type: 'range', min: '1', max: '365', step: '1', value: String(Math.round(S.doyF)), 'data-role': 'season-strip', 'aria-label': 'Saison : jour de l’année' });
  const stripLbl = h('output', { class: 'v3d-strip-label', 'data-role': 'strip-label' });
  const stripBtn = h('button', { type: 'button', class: 'v3d-btn', 'data-act': 'play-year-strip', 'aria-label': 'Année accélérée', 'aria-pressed': 'false' }, '▶');
  const strip = h('div', { class: 'v3d-strip', 'data-role': 'season-bar' }, stripLbl, stripIn, stripBtn);
  const ageIn = h('input', { type: 'range', min: '0', max: '1', step: '0.01', value: '1', 'data-role': 'age', 'aria-label': 'Âge des plantes' });
  const qualSel = h('select', { 'data-role': 'quality', 'aria-label': 'Qualité' }, h('option', { value: 'auto' }, 'Auto'), ...QUALITY_ORDER.map((id) => h('option', { value: id }, QUALITIES[id].label)));
  const shadowCb = h('input', { type: 'checkbox', checked: true, 'data-role': 'shadows' });
  const gridCb = h('input', { type: 'checkbox', 'data-role': 'grid' });
  const namesCb = h('input', { type: 'checkbox', checked: true, 'data-role': 'names' });
  const latinCb = h('input', { type: 'checkbox', 'data-role': 'latin' });
  const legend = h('ul', { class: 'v3d-legend', 'data-role': 'legend' });
  const playBtn = h('button', { type: 'button', class: 'v3d-btn', 'data-act': 'play-day', 'aria-pressed': 'false' }, '▶ Journée accélérée');
  const growBtn = h('button', { type: 'button', class: 'v3d-btn', 'data-act': 'grow' }, '🌱 Pousse');
  const photoBtn = h('button', { type: 'button', class: 'v3d-btn v3d-primary', 'data-act': 'photo' }, '📷 Rendu photo haute qualité');
  const photoInfo = h('p', { class: 'v3d-hint', 'data-role': 'photo-info' });
  const prog = h('div', { class: 'v3d-progress', hidden: true, 'data-role': 'progress' },
    h('div', { class: 'v3d-progress-card' }, h('strong', null, 'Rendu photo en cours…'), h('div', { class: 'v3d-bar' }, h('i', { 'data-role': 'bar' })), h('span', { 'data-role': 'prog-text' }, '0 %'),
      h('button', { type: 'button', class: 'v3d-btn', 'data-act': 'photo-cancel' }, 'Annuler')));
  const chipDoy = (n) => (glat < 0 ? ((n + 183) % 365) || 365 : n);
  const SEASONS = [['Hiver', 'hiver'], ['Printemps', 'printemps'], ['Été', 'été'], ['Automne', 'automne']];
  const seasons = h('div', { class: 'v3d-seg v3d-seasons' }, SEASONS.map(([label, id]) => h('button', { type: 'button', class: 'v3d-chip', 'data-season': id, 'aria-pressed': 'false', onclick: () => { S.lapse = false; setDoy(chipDoy(SEASON_DOY[id])); } }, label)));
  const VIEWS = [['top', 'Dessus'], ['ne', 'Coin NE'], ['se', 'Coin SE'], ['sw', 'Coin SO'], ['nw', 'Coin NO'], ['eye', 'À hauteur d’yeux'], ['fly', 'Survol']];
  const viewBtns = h('div', { class: 'v3d-seg', 'data-role': 'views' }, VIEWS.map(([id, label]) => h('button', { type: 'button', class: 'v3d-chip', 'data-view': id, 'aria-pressed': 'false', onclick: () => setView(id) }, label)));
  const panelBody = h('div', { class: 'v3d-panel-body' },
    h('section', { class: 'v3d-season' }, h('h3', null, 'Saisons'), seasonLbl, seasonIn, ticks, seasons,
      h('div', { class: 'v3d-lapse' }, lapseBtn, speedSel),
      h('label', { class: 'v3d-check' }, leavesCb, leavesTxt)),
    h('section', null, h('h3', null, 'Vues'), viewBtns),
    h('section', null, h('h3', null, 'Soleil'),
      h('label', null, 'Heure solaire ', hourLbl), hourIn, playBtn),
    h('section', null, h('h3', null, 'Plantes'),
      h('label', null, 'Âge ', ageLbl, h('small', null, ' (jeunes → adultes)')), ageIn, growBtn),
    h('section', null, h('h3', null, 'Affichage'),
      h('label', { class: 'v3d-row' }, 'Qualité', qualSel),
      h('label', { class: 'v3d-check' }, shadowCb, ' Ombres portées'),
      h('label', { class: 'v3d-check' }, gridCb, ' Grille de 1 m'),
      h('label', { class: 'v3d-check', title: 'Touche N' }, namesCb, ' Noms des plantes'),
      h('label', { class: 'v3d-check v3d-sub' }, latinCb, ' + noms latins')),
    h('section', null, h('h3', null, 'Photo'), photoBtn, photoInfo),
    h('section', null, h('h3', null, 'Essences'), legend));
  const panel = h('aside', { class: 'v3d-panel', 'data-role': 'panel' }, panelBody);
  const toggle = h('button', { type: 'button', class: 'v3d-btn v3d-toggle', 'data-act': 'toggle-panel', 'aria-expanded': 'true', 'aria-label': 'Réglages' }, '⚙ Réglages');
  const closeBtn = h('button', { type: 'button', class: 'v3d-btn v3d-close', 'data-act': 'close', 'aria-label': 'Fermer la vue 3D (Échap)' }, '✕ Fermer');
  const top = h('header', { class: 'v3d-top' }, h('strong', { class: 'v3d-title' }, `🧊 ${g.name || 'Mon jardin'} — vue 3D`), h('span', { class: 'v3d-spacer' }), toggle, closeBtn);
  const help = h('div', { class: 'v3d-help', 'data-role': 'help' }, 'Clic gauche : tourner · clic droit : déplacer · molette : zoom · « À hauteur d’yeux » : ZQSD/WASD + souris · Échap : fermer');
  const hud = h('div', { class: 'v3d-hud' }, mobile ? null : info, h('div', { class: 'v3d-fps' }, fpsEl));
  if (mobile) panelBody.append(h('section', null, h('h3', null, 'Informations'), info));
  const notice = h('div', { class: 'v3d-notice', hidden: true, role: 'status', 'data-role': 'notice' });
  const joyKnob = h('i', { class: 'v3d-joy-knob' });
  const joy = h('div', { class: 'v3d-joy', hidden: true, 'data-role': 'joystick', 'aria-label': 'Joystick de déplacement' }, joyKnob);
  root.append(top, panel, strip, hud, help, prog, notice, joy);

  // ── noms des plantes : un calque d'étiquettes (une pastille par groupe) projeté depuis les ancres 3D ──
  let tmpV = null; let rendered = false; let labelsDirty = true; let gesture = false;
  const projectAnchor = (a) => {
    if (!camera || !THREE || !rendered) return null;
    const w = stage.clientWidth; const hh = stage.clientHeight;
    if (!w || !hh) return null;
    if (!tmpV) tmpV = new THREE.Vector3();
    tmpV.set(a.x, a.y, a.z).applyMatrix4(camera.matrixWorldInverse);
    const behind = tmpV.z >= -camera.near;
    tmpV.applyMatrix4(camera.projectionMatrix);
    return { x: ((tmpV.x + 1) / 2) * w, y: ((1 - tmpV.y) / 2) * hh, behind };
  };
  const safeRects = () => {
    const rr = root.getBoundingClientRect();
    const out = [];
    for (const el of [top, panel.classList.contains('is-collapsed') ? null : panel, strip, hud, help, joy, notice, labelsUI && labelsUI.cardEl]) {
      if (!el || el.hidden) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) out.push({ x: r.left - rr.left, y: r.top - rr.top, w: r.width, h: r.height });
    }
    return out;
  };
  const labelsUI = createLabelsUI({
    root, mobile, project: projectAnchor,
    viewport: () => ({ width: stage.clientWidth || window.innerWidth || 1280, height: stage.clientHeight || window.innerHeight || 800 }),
    safeRects,
    onHighlight: (ids) => { if (api3) api3.setHighlight(ids); refreshLegendPressed(); markDirty(); },
    onFocus: (gr) => focusGroup(gr),
  });

  if (mobile) { panel.classList.add('is-collapsed'); toggle.setAttribute('aria-expanded', 'false'); }
  toggle.addEventListener('click', () => {
    const open = panel.classList.toggle('is-collapsed') === false;
    toggle.setAttribute('aria-expanded', String(open));
  });
  closeBtn.addEventListener('click', () => close());
  function close() { if (typeof onClose === 'function') onClose(); else unmount(); }

  // ── utilitaires ──
  const markDirty = () => { dirty = true; labelsDirty = true; };
  function refreshLabels() {
    hourLbl.textContent = hLabel(S.hour);
    seasonLbl.textContent = seasonLabel(S.date, glat);
    stripLbl.textContent = seasonLabel(S.date, glat).replace(/ (\S{3})\S*$/, ' $1.');
    ageLbl.textContent = S.age >= 0.995 ? 'adultes' : `${Math.round(S.age * 100)} %`;
    hourIn.value = String(S.hour); seasonIn.value = stripIn.value = String(Math.round(S.doyF)); ageIn.value = String(S.age);
    lapseBtn.setAttribute('aria-pressed', String(S.lapse)); stripBtn.setAttribute('aria-pressed', String(S.lapse));
    lapseBtn.textContent = S.lapse ? '⏸ Arrêter l’année' : '▶ Année accélérée'; stripBtn.textContent = S.lapse ? '⏸' : '▶';
    playBtn.setAttribute('aria-pressed', String(S.playing));
    playBtn.textContent = S.playing ? '⏸ Arrêter la journée' : '▶ Journée accélérée';
    for (const b of viewBtns.children) b.setAttribute('aria-pressed', String(b.dataset.view === S.view));
    const s = seasonName(dayOfYear(S.date), glat);
    for (const b of seasons.children) b.setAttribute('aria-pressed', String(b.dataset.season === s));
  }
  function refreshInfo() {
    const gen = api3 && api3.generation;
    const lines = [];
    if (gen) lines.push(gen.workers > 0
      ? `Scène générée en ${gen.ms} ms sur ${gen.workers} cœur${gen.workers > 1 ? 's' : ''} (${gen.instances.toLocaleString('fr-FR')} instances)`
      : `Scène générée en ${gen.ms} ms sur 1 cœur (mode synchrone, ${gen.instances.toLocaleString('fr-FR')} instances)`);
    if (S.gpu) lines.push(`GPU : ${S.gpu}${S.software ? ' — rendu logiciel' : ''}`);
    if (renderer) lines.push(`${mobile ? 'Mobile · ' : ''}WebGL2 · qualité ${QUALITIES[S.qualityResolved].label}${S.quality === 'auto' ? ' (auto)' : ''} · ombres ${qParams.shadow} px`);
    info.textContent = '';
    for (const l of lines) info.append(h('div', null, l));
    leavesCb.disabled = !qParams.particles; leavesTxt.textContent = qParams.particles ? ' Feuilles qui tombent' : ' Feuilles qui tombent (qualité Moyenne ou plus)';
    const width = qParams.photoWidth;
    photoInfo.textContent = `${qParams.photoPasses} passes, ${width} px de large (selon la qualité), export PNG avec filigrane.`;
  }
  function refreshLegend() {
    legend.textContent = '';
    if (!api3) return;
    const counts = new Map();
    for (const z of g.zones || []) for (const pl of z.plantings || []) counts.set(pl.plantId, (counts.get(pl.plantId) || 0) + Math.max(1, Math.round(Number(pl.count ?? pl.quantity) || 1)));
    const ids = [...counts.keys()].filter((id) => getPlant(id));
    if (!ids.length) legend.append(h('li', { class: 'v3d-muted' }, 'Aucune essence plantée pour le moment.'));
    for (const id of ids) {
      const p = getPlant(id);
      const pick = () => labelsUI.selectedGroup() && labelsUI.selectedGroup().essence === id ? labelsUI.clear() : labelsUI.selectEssence(id);
      legend.append(h('li', { 'data-essence': id, role: 'button', tabindex: '0', 'aria-pressed': 'false', title: 'Mettre en évidence cette essence', onclick: pick, onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } } },
        h('i', { class: 'v3d-dot', style: { background: p.foliageColor || '#5a9a45', boxShadow: p.flowerColor ? `0 0 0 2px ${p.flowerColor}` : 'none' } }), h('span', null, `${p.commonName} ×${counts.get(id)}`)));
    }
    refreshLegendPressed();
  }
  function refreshLegendPressed() {
    const sel = labelsUI.selectedGroup();
    for (const li of legend.children) if (li.dataset && li.dataset.essence) li.setAttribute('aria-pressed', String(!!sel && sel.essence === li.dataset.essence));
  }
  /** Centrage doux de la caméra sur un groupe (sans changer la distance ni l'angle). */
  function focusGroup(gr) {
    if (!api3 || !camera || !controls || S.mode !== 'orbit') return;
    const target = new THREE.Vector3(gr.anchor.x, Math.min(gr.hAdult * 0.5, 1.5), gr.anchor.z);
    const delta = target.clone().sub(controls.target);
    flyTo(camera.position.clone().add(delta), target, 600);
  }

  // ── rendu ──
  async function loadThree() {
    const base = new URL('../vendor/three/', import.meta.url).href;
    const [T, OC] = await Promise.all([import(/* webpackIgnore: true */ `${base}three.module.min.js`), import(/* webpackIgnore: true */ `${base}OrbitControls.js`)]);
    THREE = T; OrbitControls = OC.OrbitControls;
  }
  function gpuName(gl) {
    try {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return String((ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || '');
    } catch (e) { return ''; }
  }
  function createRenderer(msaa) {
    if (renderer) { renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) { /* ignoré */ } canvas && canvas.remove(); }
    canvas = h('canvas', { class: 'v3d-canvas', 'data-role': 'canvas', tabindex: '0' });
    stage.prepend(canvas);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !!msaa, powerPreference: 'high-performance', alpha: false });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = S.shadows;
    S.msaa = !!msaa;
    const mine = canvas;
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); if (mine !== canvas || disposed) return; showError('Le contexte graphique (GPU) a été perdu. Fermez puis rouvrez la vue 3D.'); });
    pmrem = new THREE.PMREMGenerator(renderer);
    envTex = null; envElev = -99;
    controls && controls.dispose();
    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; controls.screenSpacePanning = false;
    controls.addEventListener('change', markDirty);
    controls.addEventListener('start', () => { gesture = true; if (mobile) labelsUI.setMoving(true); });
    controls.addEventListener('end', () => { gesture = false; labelsDirty = true; });
    attachLook();
  }
  function computeQuality() {
    return resolveQuality(S.qualityResolved, { maxTextureSize: renderer.capabilities.maxTextureSize, dpr: window.devicePixelRatio || 1, mobile, strongGpu: isStrongMobileGpu(S.gpu) });
  }
  function applyRendererQuality() {
    qParams = computeQuality();
    renderer.setPixelRatio(qParams.pixelRatio);
    const sm = renderer.shadowMap;
    const type = qParams.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    if (sm.type !== type) { sm.type = type; if (api3) api3.scene.traverse((o) => { if (o.material) { for (const m of [].concat(o.material)) m.needsUpdate = true; } }); }
    sm.enabled = S.shadows;
    resize();
  }
  function resize() {
    if (!renderer) return;
    const w = Math.max(2, stage.clientWidth); const hh = Math.max(2, stage.clientHeight);
    renderer.setSize(w, hh, false);
    camera.aspect = w / hh; camera.updateProjectionMatrix();
    markDirty();
  }
  function updateEnvironment(force) {
    if (!api3 || !pmrem) return;
    const el = api3.state.sun ? api3.state.sun.elevation : 30;
    if (!force && Math.abs(el - envElev) < 4 && envTex) return;
    envElev = el;
    const tmp = new THREE.Scene();
    tmp.add(new THREE.Mesh(new THREE.SphereGeometry(50, 16, 8), api3.sky.material));
    const rt = pmrem.fromScene(tmp, 0.04);
    if (envTex) envTex.dispose();
    envTex = rt.texture;
    api3.scene.environment = envTex;
    api3.scene.environmentIntensity = 0.55;
    for (const w of api3.waterMeshes) { w.material.envMap = envTex; w.material.envMapIntensity = 2.2; w.material.needsUpdate = true; }
    tmp.children[0].geometry.dispose();
  }
  function gridObject() {
    const size = Math.ceil(Math.max(api3.bounds.width, api3.bounds.depth) + 4);
    const gh = new THREE.GridHelper(size, size, 0xffffff, 0xffffff);
    gh.material.transparent = true; gh.material.opacity = 0.28; gh.material.depthWrite = false;
    gh.position.set(api3.bounds.cx, 0.06, api3.bounds.cz);
    gh.visible = S.grid; gh.name = 'grille';
    return gh;
  }
  async function buildAll() {
    const savedView = camera && controls ? { p: camera.position.clone(), t: controls.target.clone() } : null;
    if (api3) { api3.scene.remove(...api3.scene.children.filter((c) => c.name === 'grille')); api3.dispose(); api3 = null; }
    const month = S.date.getMonth() + 1;
    const next = await buildSceneAsync(THREE, g, { month, age: S.age, hour: S.hour, date: S.date, plantsById: getPlant, quality: qParams }, pool);
    if (disposed) { next.dispose(); return; }
    api3 = next;
    api3.scene.add(gridObject());
    api3.setShadowSize(qParams.shadow);
    api3.sun.castShadow = S.shadows;
    camera.far = Math.max(2000, api3.sky.geometry.parameters.radius * 2.6);
    camera.updateProjectionMatrix();
    api3.update({ date: S.date, doy: S.doyF, hour: S.hour, month, leaves: S.leaves });
    updateEnvironment(true);
    if (savedView) { camera.position.copy(savedView.p); controls.target.copy(savedView.t); controls.update(); }
    refreshLegend(); refreshInfo();
    try { labelsUI.setGrowth({ age: S.age, month }); labelsUI.setGroups(buildLabelGroups(g, { plantsById: getPlant, age: S.age, month })); } catch (e) { console.error(e); }
    if (labelsUI.selected() && api3) api3.setHighlight(labelsUI.highlightIds());
    markDirty();
  }

  // ── caméra ──
  let tween = null;
  const fitDist = () => {
    const b = api3.bounds; const fov = (camera.fov * Math.PI) / 180;
    const vert = Math.max(b.depth, b.width / camera.aspect) * (mobile ? 0.5 : 0.72) + (mobile ? 2 : 3);
    return vert / Math.tan(fov / 2);
  };
  function flyTo(pos, target, ms = 800) {
    if (!camera) return;
    tween = { t0: performance.now(), ms, p0: camera.position.clone(), t0v: controls.target.clone(), p1: pos, t1: target };
    markDirty();
  }
  function stepTween(now) {
    if (!tween) return false;
    const k = Math.min(1, (now - tween.t0) / tween.ms); const e = ease(k);
    camera.position.lerpVectors(tween.p0, tween.p1, e);
    controls.target.lerpVectors(tween.t0v, tween.t1, e);
    camera.lookAt(controls.target);
    if (k >= 1) tween = null;
    return true;
  }
  const fp = { x: 0, z: 0, yaw: 0, pitch: 0, keys: new Set(), look: null, joy: { x: 0, y: 0 } };
  function eyeStart() {
    const b = ((g.boundary || []).length >= 3 ? g.boundary : [{ x: api3.bounds.minX, y: api3.bounds.minZ }]);
    const c = { x: api3.bounds.cx, y: api3.bounds.cz };
    const p0 = b[0];
    // départ hors des bâtiments : premier point libre entre le 1er sommet et le centre
    const bats = (g.obstacles || []).filter((o) => (o.kind === 'house' || o.kind === 'shed') && (o.points || []).length >= 3);
    const inside = (x, y, pts) => { let r = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { if ((pts[i].y > y) !== (pts[j].y > y) && x < ((pts[j].x - pts[i].x) * (y - pts[i].y)) / (pts[j].y - pts[i].y) + pts[i].x) r = !r; } return r; };
    let k = 0.18;
    for (const t of [0.18, 0.3, 0.42, 0.55, 0.7]) { k = t; const x = p0.x + (c.x - p0.x) * t; const y = p0.y + (c.y - p0.y) * t; if (!bats.some((o) => inside(x, y, o.points) || o.points.some((q) => Math.hypot(q.x - x, q.y - y) < 3.5))) break; }
    fp.x = p0.x + (c.x - p0.x) * k; fp.z = p0.y + (c.y - p0.y) * k;
    fp.yaw = Math.atan2(c.x - fp.x, -(c.y - fp.z)); fp.pitch = -0.05;
  }
  function applyEye() {
    camera.position.set(fp.x, 1.7, fp.z);
    const cp = Math.cos(fp.pitch);
    camera.lookAt(fp.x + Math.sin(fp.yaw) * cp, 1.7 + Math.sin(fp.pitch), fp.z - Math.cos(fp.yaw) * cp);
  }
  function setView(id) {
    if (!api3 || !camera) return;
    S.view = id; tween = null;
    const b = api3.bounds; const c = new THREE.Vector3(b.cx, 0, b.cz);
    controls.autoRotate = false;
    if (id === 'eye') {
      S.mode = 'eye'; controls.enabled = false; eyeStart(); applyEye(); joy.hidden = !(mobile || (navigator.maxTouchPoints > 0));
    } else {
      if (S.mode === 'eye') { S.mode = 'orbit'; controls.enabled = true; controls.target.copy(c); }
      joy.hidden = true; fp.joy = { x: 0, y: 0 };
      const d = fitDist();
      if (id === 'top') flyTo(new THREE.Vector3(b.cx, d * 1.05, b.cz + 0.01), c);
      else if (id === 'fly') { flyTo(new THREE.Vector3(b.cx + d * 0.75, d * 0.55, b.cz + d * 0.75), c, 900); controls.autoRotate = true; controls.autoRotateSpeed = 1.1; }
      else {
        const sx = id.includes('e') ? 1 : -1; const sz = id.startsWith('n') ? -1 : 1;
        flyTo(new THREE.Vector3(b.cx + sx * d * 0.62, d * 0.62, b.cz + sz * d * 0.62), c);
      }
    }
    refreshLabels(); markDirty();
  }
  function attachLook() {
    const down = (e) => { if (S.mode !== 'eye') return; fp.look = { x: e.clientX, y: e.clientY }; try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignoré */ } };
    const move = (e) => {
      if (S.mode !== 'eye' || !fp.look) return;
      fp.yaw += (e.clientX - fp.look.x) * 0.0035;
      fp.pitch = Math.max(-1.2, Math.min(1.2, fp.pitch - (e.clientY - fp.look.y) * 0.0035));
      fp.look = { x: e.clientX, y: e.clientY }; applyEye(); markDirty();
    };
    const up = () => { fp.look = null; };
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  }
  {
    let id = null; let cx = 0; let cy = 0;
    const R = 44;
    const set = (e) => {
      let dx = e.clientX - cx; let dy = e.clientY - cy; const L = Math.hypot(dx, dy);
      if (L > R) { dx = (dx / L) * R; dy = (dy / L) * R; }
      fp.joy = { x: dx / R, y: dy / R };
      joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
      markDirty();
    };
    joy.addEventListener('pointerdown', (e) => { const r = joy.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; id = e.pointerId; try { joy.setPointerCapture(id); } catch (err) { /* ignoré */ } set(e); e.preventDefault(); });
    joy.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e); });
    const end = (e) => { if (e.pointerId !== id) return; id = null; fp.joy = { x: 0, y: 0 }; joyKnob.style.transform = ''; };
    joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
  }
  const KEYMAP = { z: 'f', w: 'f', arrowup: 'f', s: 'b', arrowdown: 'b', q: 'l', a: 'l', arrowleft: 'l', d: 'r', arrowright: 'r' };
  const isTyping = (t) => !!t && (/^(SELECT|TEXTAREA)$/.test(t.tagName) || (t.tagName === 'INPUT' && !/^(checkbox|radio|range|button)$/i.test(t.type || 'text')) || t.isContentEditable);
  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); if (labelsUI.clear()) return; close(); return; }
    if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target)) { e.preventDefault(); setNames(!S.names); return; }
    if (S.mode !== 'eye' || e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    const k = KEYMAP[String(e.key).toLowerCase()];
    if (k) { fp.keys.add(k); if (e.shiftKey) fp.keys.add('shift'); e.preventDefault(); }
  };
  const onKeyUp = (e) => { const k = KEYMAP[String(e.key).toLowerCase()]; if (k) fp.keys.delete(k); if (e.key === 'Shift') fp.keys.delete('shift'); };
  document.addEventListener('keydown', onKeyDown); document.addEventListener('keyup', onKeyUp);

  // ── actions ──
  function setHour(hr) {
    S.hour = Math.max(6, Math.min(21, Number(hr)));
    if (api3) { api3.update({ hour: S.hour }); updateEnvironment(false); }
    refreshLabels(); markDirty();
  }
  /** Jour de l'année (réel, pour le défilement continu) : seule source de vérité de la saison, de la date et du soleil. */
  function setDoy(n, fast = false) {
    S.doyF = Math.max(1, Math.min(365, Number(n)));
    S.date = fromDoy(S.date.getFullYear(), Math.floor(S.doyF));
    labelsUI.setGrowth({ month: S.date.getMonth() + 1 }); labelsDirty = true;
    if (api3) { api3.update({ date: S.date, doy: S.doyF }); updateEnvironment(!fast); }
    refreshLabels(); markDirty();
  }
  function setDate(d) { setDoy(dayOfYear(d)); }
  function playYear(on = !S.lapse) {
    S.lapse = !!on;
    if (S.lapse) S.playing = false;
    refreshLabels(); markDirty();
  }
  function setAge(a) {
    S.age = Math.max(0, Math.min(1, Number(a)));
    labelsUI.setGrowth({ age: S.age }); labelsDirty = true;
    if (api3) api3.update({ age: S.age });
    refreshLabels(); markDirty();
  }
  async function setQuality(id) {
    S.quality = id;
    S.qualityResolved = id === 'auto' ? autoQuality(S.gpu, { mobile }) : id;
    qualSel.value = id;
    const wantMsaa = computeQuality().msaa;
    if (wantMsaa !== S.msaa) { createRenderer(wantMsaa); }
    applyRendererQuality();
    await buildAll();
  }
  function setNames(on) {
    S.names = !!on; namesCb.checked = S.names; latinCb.disabled = !S.names;
    labelsUI.setOptions({ names: S.names, latin: S.latin }); markDirty();
  }
  namesCb.addEventListener('change', () => setNames(namesCb.checked));
  latinCb.addEventListener('change', () => { S.latin = latinCb.checked; labelsUI.setOptions({ names: S.names, latin: S.latin }); markDirty(); });
  hourIn.addEventListener('input', () => { S.playing = false; setHour(hourIn.value); });
  const onSeasonInput = (inp) => () => { S.lapse = false; setDoy(inp.value, true); };
  seasonIn.addEventListener('input', onSeasonInput(seasonIn)); stripIn.addEventListener('input', onSeasonInput(stripIn));
  seasonIn.addEventListener('change', () => updateEnvironment(true)); stripIn.addEventListener('change', () => updateEnvironment(true));
  lapseBtn.addEventListener('click', () => playYear()); stripBtn.addEventListener('click', () => playYear());
  speedSel.addEventListener('change', () => { S.speed = Number(speedSel.value) || 1; });
  leavesCb.addEventListener('change', () => { S.leaves = leavesCb.checked; if (api3) api3.update({ leaves: S.leaves }); markDirty(); });
  ageIn.addEventListener('input', () => { S.growing = false; setAge(ageIn.value); });
  playBtn.addEventListener('click', () => { S.playing = !S.playing; if (S.playing) S.lapse = false; if (S.playing && S.hour >= 20.9) setHour(6); refreshLabels(); markDirty(); });
  growBtn.addEventListener('click', () => { setAge(0); S.growing = true; });
  qualSel.addEventListener('change', () => setQuality(qualSel.value));
  shadowCb.addEventListener('change', () => { S.shadows = shadowCb.checked; renderer.shadowMap.enabled = S.shadows; if (api3) { api3.sun.castShadow = S.shadows; api3.scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; }); } markDirty(); });
  gridCb.addEventListener('change', () => { S.grid = gridCb.checked; const gr = api3 && api3.scene.getObjectByName('grille'); if (gr) gr.visible = S.grid; markDirty(); });

  let cancelPhoto = false;
  async function photo(opts = {}) {
    if (!api3 || S.photoBusy) return null;
    S.photoBusy = true; cancelPhoto = false; busy = true;
    const bar = prog.querySelector('[data-role=bar]'); const txt = prog.querySelector('[data-role=prog-text]');
    prog.hidden = false; bar.style.width = '0%'; txt.textContent = '0 %';
    try {
      const dateTxt = `${S.date.getDate()} ${MOIS[S.date.getMonth()]} ${S.date.getFullYear()} · ${hLabel(S.hour)} (heure solaire)`;
      const res = await renderPhoto(THREE, {
        renderer, scene: api3.scene, camera, sun: api3.sun,
        width: mobile ? Math.min(opts.width || qParams.photoWidth, 2048) : (opts.width || qParams.photoWidth), passes: mobile ? Math.min(opts.passes || qParams.photoPasses, 48) : (opts.passes || qParams.photoPasses), msaa: qParams.msaa,
        watermark: `${g.name || 'Mon jardin'} · ${dateTxt}`,
        isCancelled: () => cancelPhoto || disposed,
        onProgress: (i, n) => { const p = Math.round((i / n) * 100); bar.style.width = `${p}%`; txt.textContent = `${p} % (${i}/${n} passes)`; },
      });
      if (res && opts.download !== false) await saveBlob(res.blob, `${slug(g.name)}-3d-${S.date.getFullYear()}${String(S.date.getMonth() + 1).padStart(2, '0')}${String(S.date.getDate()).padStart(2, '0')}.png`);
      if (res) photoInfo.textContent = `Image exportée : ${res.width} × ${res.height} px, ${res.passes} passes.`;
      return res;
    } finally {
      prog.hidden = true; S.photoBusy = false; busy = false; resize(); markDirty();
    }
  }
  photoBtn.addEventListener('click', () => { photo().catch((e) => showError(`Rendu photo impossible : ${e.message || e}`)); });
  prog.querySelector('[data-act=photo-cancel]').addEventListener('click', () => { cancelPhoto = true; });

  function showError(msg) {
    loading.hidden = false; loading.textContent = '';
    loading.append(h('p', { class: 'v3d-error', role: 'alert' }, msg), h('button', { type: 'button', class: 'v3d-btn v3d-primary', onclick: () => close() }, 'Fermer'));
  }

  // ── boucle ──
  let last = performance.now(); let frames = 0; let fpsT = last;
  let lastRender = 0; let avgDt = 0; let activeMs = 0; let lastReduce = 0; let noticeTimer = 0;
  function showNotice(msg) {
    notice.textContent = msg; notice.hidden = false;
    clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { notice.hidden = true; }, 7000);
  }
  /** FPS < 20 en continu : on baisse d'un niveau (la qualité peut être remontée à la main dans les réglages). */
  function autoReduce(now) {
    activeMs = 0; avgDt = 0;
    const lower = lowerQuality(S.qualityResolved);
    if (!lower || now - lastReduce < 8000 || busy) return;
    lastReduce = now;
    showNotice('Qualité réduite automatiquement (modifiable dans les réglages).');
    setQuality(lower);
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!renderer || !api3 || busy || document.hidden) return;
    let animated = stepTween(now);
    if (S.mode === 'eye' && (fp.keys.size || fp.joy.x || fp.joy.y)) {
      const sp = (fp.keys.has('shift') ? 5 : 2.2) * dt;
      const fx = Math.sin(fp.yaw); const fz = -Math.cos(fp.yaw);
      const f = (fp.keys.has('f') ? 1 : 0) - (fp.keys.has('b') ? 1 : 0) - fp.joy.y;
      const r = (fp.keys.has('r') ? 1 : 0) - (fp.keys.has('l') ? 1 : 0) + fp.joy.x;
      fp.x += (f * fx - r * fz) * sp; fp.z += (f * fz + r * fx) * sp; applyEye(); animated = true;
    }
    if (S.lapse) { let n = S.doyF + dt * (365 / 15) * S.speed; if (n > 365) n -= 364; setDoy(n, true); animated = true; }
    if (api3.fxActive() && api3.tick(dt)) animated = true;
    if (S.playing) { setHour(S.hour + dt * 1.6); if (S.hour >= 20.99) { S.playing = false; refreshLabels(); } animated = true; }
    if (S.growing) { setAge(Math.min(1, S.age + dt / 6)); if (S.age >= 1) S.growing = false; animated = true; }
    const moved = S.mode === 'orbit' ? controls.update() : false;
    if (dirty || moved || animated) {
      dirty = false;
      renderer.render(api3.scene, camera);
      rendered = true; labelsDirty = true;
      frames++;
      const dr = now - lastRender; lastRender = now;
      if (dr < 150) {
        avgDt = avgDt ? avgDt * 0.92 + dr * 0.08 : dr; activeMs += dr;
        if (activeMs > 3000 && 1000 / avgDt < 20) autoReduce(now);
      } else { activeMs = 0; avgDt = 0; }
      if (now - fpsT > 500) { if (avgDt) S.fps = Math.round(1000 / avgDt); fpsEl.textContent = `${S.fps || '—'} FPS`; frames = 0; fpsT = now; }
    } else if (now - fpsT > 1500) { fpsEl.textContent = `${S.fps || '—'} FPS (au repos)`; fpsT = now; frames = 0; }
    // étiquettes : PC = à chaque image rendue ; mobile = seulement quand la caméra est arrêtée (pas de boucle en plus)
    if (labelsDirty && rendered) {
      if (mobile && (gesture || moved || animated)) labelsUI.setMoving(true);
      else {
        labelsDirty = false; labelsUI.setMoving(false);
        const b = api3.bounds;
        labelsUI.update({ distance: camera.position.distanceTo(S.mode === 'orbit' ? controls.target : new THREE.Vector3(b.cx, 0, b.cz)) / Math.max(1, b.radius) });
      }
    }
  }

  // Retour (Android) = fermer la vue : un état d'historique est poussé à l'ouverture.
  let histPushed = false;
  try { history.pushState({ v3d: true }, ''); histPushed = true; } catch (e) { /* ignoré */ }
  const onPop = () => { if (disposed) return; histPushed = false; close(); };
  window.addEventListener('popstate', onPop);

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
  ro && ro.observe(stage);

  // ── API de test / pilotage ──
  const api = {
    snapshot() { api3.update({}); renderer.render(api3.scene, camera); return canvas.toDataURL('image/png'); },
    setHour, setDate, setDoy, playYear, setAge, setQuality, setView, photo,
    info: () => ({ gpu: S.gpu, software: S.software, quality: S.qualityResolved, fps: S.fps, generation: api3 && api3.generation, canvas, webgl2: true, instances: api3 && api3.stats.instances, state: { ...S }, labels: labelsUI.visible().length }),
    labels: labelsUI, setNames,
    get camera() { return camera; },
    get controls() { return controls; },
    get scene() { return api3 && api3.scene; },
    get renderer() { return renderer; },
  };

  const ready = (async () => {
    try {
      await loadThree();
      if (disposed) return;
      camera = new THREE.PerspectiveCamera(45, 1.6, 0.1, 3000);
      pool = createPool({ size: poolSize(cores) });
      createRenderer(!mobile); // contexte d'essai pour lire le nom du GPU
      S.gpu = gpuName(renderer.getContext());
      S.software = isSoftwareRenderer(S.gpu);
      S.qualityResolved = autoQuality(S.gpu, { mobile });
      qualSel.value = 'auto';
      if (computeQuality().msaa !== S.msaa) createRenderer(computeQuality().msaa);
      applyRendererQuality();
      await buildAll();
      if (disposed) return;
      setView('ne');
      loading.hidden = true;
      refreshLabels(); refreshInfo();
      raf = requestAnimationFrame(frame);
      return api;
    } catch (e) {
      if (!disposed) showError(`La vue 3D n’a pas pu démarrer : ${e && e.message ? e.message : e}`);
      return null;
    }
  })();
  refreshLabels();

  function unmount() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    ro && ro.disconnect();
    window.removeEventListener('popstate', onPop);
    clearTimeout(noticeTimer);
    if (histPushed) { histPushed = false; try { if (history.state && history.state.v3d) history.back(); } catch (e) { /* ignoré */ } }
    document.removeEventListener('keydown', onKeyDown); document.removeEventListener('keyup', onKeyUp);
    try { api3 && api3.dispose(); } catch (e) { /* ignoré */ }
    try { envTex && envTex.dispose(); pmrem && pmrem.dispose(); } catch (e) { /* ignoré */ }
    try { controls && controls.dispose(); } catch (e) { /* ignoré */ }
    try { if (renderer) { renderer.dispose(); renderer.forceContextLoss(); } } catch (e) { /* ignoré */ }
    try { pool && pool.dispose(); } catch (e) { /* ignoré */ }
    try { labelsUI.destroy(); } catch (e) { /* ignoré */ }
    root.remove();
    try { delete el.__view3d; } catch (e) { /* ignoré */ }
  }
  unmount.api = api;
  unmount.labels = labelsUI;
  unmount.hasSelection = () => labelsUI.selected() != null;
  unmount.ready = ready;
  el.__view3d = api;
  void sunDirection; void viewGroupItems;
  return unmount;
}
