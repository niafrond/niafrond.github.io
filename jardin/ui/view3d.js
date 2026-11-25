// Vue 3D temps réel du jardin (PC) : WebGL (GPU) + génération des instances en Web Workers (CPU multicœur).
// three.js n'est chargé qu'à la demande (import dynamique) : rien n'est téléchargé tant que la vue 3D n'est pas ouverte.
import { h, saveBlob } from './draw-util.js';
import { getPlant } from '../catalog.js';
import { buildSceneAsync, sunDirection } from '../render-gl.js';
import { createPool, poolSize } from '../gl-pool.js';
import { QUALITIES, QUALITY_ORDER, autoQuality, resolveQuality, isSoftwareRenderer } from '../gl-quality.js';
import { renderPhoto } from '../gl-photo.js';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const FORCE_KEY = 'jardin-force-3d';
let webgl2Cache = null;

/** WebGL2 est-il disponible dans ce navigateur ? (résultat mémorisé) */
export function hasWebGL2() {
  if (webgl2Cache !== null) return webgl2Cache;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    webgl2Cache = !!gl;
    const lose = gl && gl.getExtension && gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  } catch (e) { webgl2Cache = false; }
  return webgl2Cache;
}
/** Vide le cache de détection WebGL2 (tests). */
export function resetWebGL2Cache() { webgl2Cache = null; }

/**
 * La vue 3D est-elle proposée ? PC : écran ≥ 900 px et pointeur précis, WebGL2, sans « économie de données ».
 * `?3d=1` dans l'URL ou `localStorage['jardin-force-3d']` forcent la proposition (WebGL2 reste indispensable).
 */
export function isDesktop3DCapable() {
  let forced = false;
  try { forced = /[?&]3d=1(&|$)/.test(String(globalThis.location && globalThis.location.search)); } catch (e) { /* ignoré */ }
  try { const v = globalThis.localStorage && globalThis.localStorage.getItem(FORCE_KEY); if (v && v !== '0' && v !== 'false') forced = true; } catch (e) { /* stockage indisponible */ }
  if (!hasWebGL2()) return false;
  if (forced) return true;
  try {
    const mm = globalThis.matchMedia;
    if (typeof mm !== 'function') return false;
    if (!mm.call(globalThis, '(min-width: 900px) and (pointer: fine)').matches) return false;
    if (mm.call(globalThis, '(prefers-reduced-data: reduce)').matches) return false;
    return true;
  } catch (e) { return false; }
}

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

  let disposed = false;
  let THREE = null; let OrbitControls = null;
  let renderer = null; let canvas = null; let camera = null; let controls = null; let api3 = null; let pool = null;
  let raf = 0; let dirty = true; let busy = false;
  let envTex = null; let envElev = -99; let pmrem = null;
  const viewGroupItems = {};
  const S = {
    hour: 15, date: new Date(), age: 1, quality: 'auto', qualityResolved: 'medium', shadows: true, grid: false,
    gpu: '', software: false, fps: 0, view: 'ne', mode: 'orbit', playing: false, growing: false, photoBusy: false,
  };
  const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 2;
  let qParams = resolveQuality('medium');

  // ── panneau ──
  const q$ = (sel) => root.querySelector(sel);
  const info = h('div', { class: 'v3d-info', 'data-role': 'info', 'aria-live': 'polite' });
  const fpsEl = h('span', { 'data-role': 'fps' }, '— FPS');
  const hourLbl = h('output', { 'data-role': 'hour-label' });
  const dateLbl = h('output', { 'data-role': 'date-label' });
  const ageLbl = h('output', { 'data-role': 'age-label' });
  const hourIn = h('input', { type: 'range', min: '6', max: '21', step: '0.25', value: String(S.hour), 'data-role': 'hour', 'aria-label': 'Heure (solaire)' });
  const dateIn = h('input', { type: 'range', min: '1', max: '365', step: '1', value: String(dayOfYear(S.date)), 'data-role': 'date', 'aria-label': 'Date' });
  const ageIn = h('input', { type: 'range', min: '0', max: '1', step: '0.01', value: '1', 'data-role': 'age', 'aria-label': 'Âge des plantes' });
  const qualSel = h('select', { 'data-role': 'quality', 'aria-label': 'Qualité' }, h('option', { value: 'auto' }, 'Auto'), ...QUALITY_ORDER.map((id) => h('option', { value: id }, QUALITIES[id].label)));
  const shadowCb = h('input', { type: 'checkbox', checked: true, 'data-role': 'shadows' });
  const gridCb = h('input', { type: 'checkbox', 'data-role': 'grid' });
  const legend = h('ul', { class: 'v3d-legend', 'data-role': 'legend' });
  const playBtn = h('button', { type: 'button', class: 'v3d-btn', 'data-act': 'play-day', 'aria-pressed': 'false' }, '▶ Journée accélérée');
  const growBtn = h('button', { type: 'button', class: 'v3d-btn', 'data-act': 'grow' }, '🌱 Pousse');
  const photoBtn = h('button', { type: 'button', class: 'v3d-btn v3d-primary', 'data-act': 'photo' }, '📷 Rendu photo haute qualité');
  const photoInfo = h('p', { class: 'v3d-hint', 'data-role': 'photo-info' });
  const prog = h('div', { class: 'v3d-progress', hidden: true, 'data-role': 'progress' },
    h('div', { class: 'v3d-progress-card' }, h('strong', null, 'Rendu photo en cours…'), h('div', { class: 'v3d-bar' }, h('i', { 'data-role': 'bar' })), h('span', { 'data-role': 'prog-text' }, '0 %'),
      h('button', { type: 'button', class: 'v3d-btn', 'data-act': 'photo-cancel' }, 'Annuler')));
  const SEASONS = [['Hiver', 1, 15], ['Printemps', 3, 25], ['Été', 5, 21], ['Automne', 9, 15]];
  const seasons = h('div', { class: 'v3d-seg' }, SEASONS.map(([label, mo, d]) => h('button', { type: 'button', class: 'v3d-chip', 'data-season': label.toLowerCase(), onclick: () => setDate(new Date(S.date.getFullYear(), mo, d)) }, label)));
  const VIEWS = [['top', 'Dessus'], ['ne', 'Coin NE'], ['se', 'Coin SE'], ['sw', 'Coin SO'], ['nw', 'Coin NO'], ['eye', 'À hauteur d’yeux'], ['fly', 'Survol']];
  const viewBtns = h('div', { class: 'v3d-seg', 'data-role': 'views' }, VIEWS.map(([id, label]) => h('button', { type: 'button', class: 'v3d-chip', 'data-view': id, 'aria-pressed': 'false', onclick: () => setView(id) }, label)));
  const panelBody = h('div', { class: 'v3d-panel-body' },
    h('section', null, h('h3', null, 'Vues'), viewBtns),
    h('section', null, h('h3', null, 'Soleil'),
      h('label', null, 'Heure solaire ', hourLbl), hourIn, playBtn,
      h('label', null, 'Date ', dateLbl), dateIn, seasons),
    h('section', null, h('h3', null, 'Plantes'),
      h('label', null, 'Âge ', ageLbl, h('small', null, ' (jeunes → adultes)')), ageIn, growBtn),
    h('section', null, h('h3', null, 'Affichage'),
      h('label', { class: 'v3d-row' }, 'Qualité', qualSel),
      h('label', { class: 'v3d-check' }, shadowCb, ' Ombres portées'),
      h('label', { class: 'v3d-check' }, gridCb, ' Grille de 1 m')),
    h('section', null, h('h3', null, 'Photo'), photoBtn, photoInfo),
    h('section', null, h('h3', null, 'Essences'), legend));
  const panel = h('aside', { class: 'v3d-panel', 'data-role': 'panel' }, panelBody);
  const toggle = h('button', { type: 'button', class: 'v3d-btn v3d-toggle', 'data-act': 'toggle-panel', 'aria-expanded': 'true', 'aria-label': 'Réglages' }, '⚙ Réglages');
  const closeBtn = h('button', { type: 'button', class: 'v3d-btn v3d-close', 'data-act': 'close', 'aria-label': 'Fermer la vue 3D (Échap)' }, '✕ Fermer');
  const top = h('header', { class: 'v3d-top' }, h('strong', { class: 'v3d-title' }, `🧊 ${g.name || 'Mon jardin'} — vue 3D`), h('span', { class: 'v3d-spacer' }), toggle, closeBtn);
  const help = h('div', { class: 'v3d-help', 'data-role': 'help' }, 'Clic gauche : tourner · clic droit : déplacer · molette : zoom · « À hauteur d’yeux » : ZQSD/WASD + souris · Échap : fermer');
  const hud = h('div', { class: 'v3d-hud' }, info, h('div', { class: 'v3d-fps' }, fpsEl));
  root.append(top, panel, hud, help, prog);

  toggle.addEventListener('click', () => {
    const open = panel.classList.toggle('is-collapsed') === false;
    toggle.setAttribute('aria-expanded', String(open));
  });
  closeBtn.addEventListener('click', () => close());
  function close() { if (typeof onClose === 'function') onClose(); else unmount(); }

  // ── utilitaires ──
  const markDirty = () => { dirty = true; };
  function refreshLabels() {
    hourLbl.textContent = hLabel(S.hour);
    dateLbl.textContent = dLabel(S.date);
    ageLbl.textContent = S.age >= 0.995 ? 'adultes' : `${Math.round(S.age * 100)} %`;
    hourIn.value = String(S.hour); dateIn.value = String(dayOfYear(S.date)); ageIn.value = String(S.age);
    playBtn.setAttribute('aria-pressed', String(S.playing));
    playBtn.textContent = S.playing ? '⏸ Arrêter la journée' : '▶ Journée accélérée';
    for (const b of viewBtns.children) b.setAttribute('aria-pressed', String(b.dataset.view === S.view));
    const [mo] = [S.date.getMonth()];
    const s = mo <= 1 || mo === 11 ? 'hiver' : mo <= 4 ? 'printemps' : mo <= 7 ? 'été' : 'automne';
    for (const b of seasons.children) b.setAttribute('aria-pressed', String(b.dataset.season === s));
  }
  function refreshInfo() {
    const gen = api3 && api3.generation;
    const lines = [];
    if (gen) lines.push(gen.workers > 0
      ? `Scène générée en ${gen.ms} ms sur ${gen.workers} cœur${gen.workers > 1 ? 's' : ''} (${gen.instances.toLocaleString('fr-FR')} instances)`
      : `Scène générée en ${gen.ms} ms sur 1 cœur (mode synchrone, ${gen.instances.toLocaleString('fr-FR')} instances)`);
    if (S.gpu) lines.push(`GPU : ${S.gpu}${S.software ? ' — rendu logiciel' : ''}`);
    if (renderer) lines.push(`WebGL2 · qualité ${QUALITIES[S.qualityResolved].label}${S.quality === 'auto' ? ' (auto)' : ''} · ombres ${qParams.shadow} px`);
    info.textContent = '';
    for (const l of lines) info.append(h('div', null, l));
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
      legend.append(h('li', null, h('i', { class: 'v3d-dot', style: { background: p.foliageColor || '#5a9a45', boxShadow: p.flowerColor ? `0 0 0 2px ${p.flowerColor}` : 'none' } }), h('span', null, `${p.commonName} ×${counts.get(id)}`)));
    }
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
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); showError('Le contexte graphique (GPU) a été perdu. Fermez puis rouvrez la vue 3D.'); });
    pmrem = new THREE.PMREMGenerator(renderer);
    envTex = null; envElev = -99;
    controls && controls.dispose();
    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; controls.screenSpacePanning = false;
    controls.addEventListener('change', markDirty);
    attachLook();
  }
  function applyRendererQuality() {
    qParams = resolveQuality(S.qualityResolved, { maxTextureSize: renderer.capabilities.maxTextureSize, dpr: window.devicePixelRatio || 1 });
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
    api3.update({ date: S.date, hour: S.hour, month });
    updateEnvironment(true);
    if (savedView) { camera.position.copy(savedView.p); controls.target.copy(savedView.t); controls.update(); }
    refreshLegend(); refreshInfo(); markDirty();
  }

  // ── caméra ──
  let tween = null;
  const fitDist = () => {
    const b = api3.bounds; const fov = (camera.fov * Math.PI) / 180;
    const vert = Math.max(b.depth, b.width / camera.aspect) * 0.62 + 2;
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
  const fp = { x: 0, z: 0, yaw: 0, pitch: 0, keys: new Set(), look: null };
  function eyeStart() {
    const b = ((g.boundary || []).length >= 3 ? g.boundary : [{ x: api3.bounds.minX, y: api3.bounds.minZ }]);
    const c = { x: api3.bounds.cx, y: api3.bounds.cz };
    const p0 = b[0];
    fp.x = p0.x + (c.x - p0.x) * 0.18; fp.z = p0.y + (c.y - p0.y) * 0.18;
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
      S.mode = 'eye'; controls.enabled = false; eyeStart(); applyEye();
    } else {
      if (S.mode === 'eye') { S.mode = 'orbit'; controls.enabled = true; controls.target.copy(c); }
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
  const KEYMAP = { z: 'f', w: 'f', arrowup: 'f', s: 'b', arrowdown: 'b', q: 'l', a: 'l', arrowleft: 'l', d: 'r', arrowright: 'r' };
  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
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
  function setDate(d) {
    S.date = d;
    if (api3) { api3.update({ date: d }); updateEnvironment(true); }
    refreshLabels(); markDirty();
  }
  function setAge(a) {
    S.age = Math.max(0, Math.min(1, Number(a)));
    if (api3) api3.update({ age: S.age });
    refreshLabels(); markDirty();
  }
  async function setQuality(id) {
    S.quality = id;
    S.qualityResolved = id === 'auto' ? autoQuality(S.gpu) : id;
    qualSel.value = id;
    const wantMsaa = QUALITIES[S.qualityResolved].msaa;
    if (wantMsaa !== S.msaa) { createRenderer(wantMsaa); }
    applyRendererQuality();
    await buildAll();
  }
  hourIn.addEventListener('input', () => { S.playing = false; setHour(hourIn.value); });
  dateIn.addEventListener('input', () => setDate(fromDoy(S.date.getFullYear(), Number(dateIn.value))));
  ageIn.addEventListener('input', () => { S.growing = false; setAge(ageIn.value); });
  playBtn.addEventListener('click', () => { S.playing = !S.playing; if (S.playing && S.hour >= 20.9) setHour(6); refreshLabels(); markDirty(); });
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
        width: opts.width || qParams.photoWidth, passes: opts.passes || qParams.photoPasses, msaa: qParams.msaa,
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
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!renderer || !api3 || busy || document.hidden) return;
    let animated = stepTween(now);
    if (S.mode === 'eye' && fp.keys.size) {
      const sp = (fp.keys.has('shift') ? 5 : 2.2) * dt;
      const fx = Math.sin(fp.yaw); const fz = -Math.cos(fp.yaw);
      const dx = (fp.keys.has('f') ? fx : 0) - (fp.keys.has('b') ? fx : 0) + (fp.keys.has('r') ? -fz : 0) - (fp.keys.has('l') ? -fz : 0);
      const dz = (fp.keys.has('f') ? fz : 0) - (fp.keys.has('b') ? fz : 0) + (fp.keys.has('r') ? fx : 0) - (fp.keys.has('l') ? fx : 0);
      fp.x += dx * sp; fp.z += dz * sp; applyEye(); animated = true;
    }
    if (S.playing) { setHour(S.hour + dt * 1.6); if (S.hour >= 20.99) { S.playing = false; refreshLabels(); } animated = true; }
    if (S.growing) { setAge(Math.min(1, S.age + dt / 6)); if (S.age >= 1) S.growing = false; animated = true; }
    const moved = S.mode === 'orbit' ? controls.update() : false;
    if (dirty || moved || animated) {
      dirty = false;
      renderer.render(api3.scene, camera);
      frames++;
      if (now - fpsT > 500) { S.fps = Math.round((frames * 1000) / (now - fpsT)); fpsEl.textContent = `${S.fps} FPS`; frames = 0; fpsT = now; }
    } else if (now - fpsT > 1500) { fpsEl.textContent = `${S.fps || '—'} FPS (au repos)`; fpsT = now; frames = 0; }
  }

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
  ro && ro.observe(stage);

  // ── API de test / pilotage ──
  const api = {
    snapshot() { api3.update({}); renderer.render(api3.scene, camera); return canvas.toDataURL('image/png'); },
    setHour, setDate, setAge, setQuality, setView, photo,
    info: () => ({ gpu: S.gpu, software: S.software, quality: S.qualityResolved, fps: S.fps, generation: api3 && api3.generation, canvas, webgl2: true, instances: api3 && api3.stats.instances, state: { ...S } }),
    get scene() { return api3 && api3.scene; },
    get renderer() { return renderer; },
  };

  const ready = (async () => {
    try {
      await loadThree();
      if (disposed) return;
      camera = new THREE.PerspectiveCamera(45, 1.6, 0.1, 3000);
      pool = createPool({ size: poolSize(cores) });
      createRenderer(true); // contexte d'essai pour lire le nom du GPU
      S.gpu = gpuName(renderer.getContext());
      S.software = isSoftwareRenderer(S.gpu);
      S.qualityResolved = autoQuality(S.gpu);
      qualSel.value = 'auto';
      if (!QUALITIES[S.qualityResolved].msaa) createRenderer(false);
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
    document.removeEventListener('keydown', onKeyDown); document.removeEventListener('keyup', onKeyUp);
    try { api3 && api3.dispose(); } catch (e) { /* ignoré */ }
    try { envTex && envTex.dispose(); pmrem && pmrem.dispose(); } catch (e) { /* ignoré */ }
    try { controls && controls.dispose(); } catch (e) { /* ignoré */ }
    try { if (renderer) { renderer.dispose(); renderer.forceContextLoss(); } } catch (e) { /* ignoré */ }
    try { pool && pool.dispose(); } catch (e) { /* ignoré */ }
    root.remove();
    try { delete el.__view3d; } catch (e) { /* ignoré */ }
  }
  unmount.api = api;
  unmount.ready = ready;
  el.__view3d = api;
  void sunDirection; void viewGroupItems;
  return unmount;
}
