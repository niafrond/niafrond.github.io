// Point d'entrée : routeur par hash, état, autosauvegarde (debounce) via storage.js.
import { storage } from './storage.js';
import { createGarden } from './model.js';
import { mountHome } from './ui/home.js';
import { mountWizard, parseRoute, gardenHash, setSaveStatus, toast, h } from './ui/wizard.js';

export const state = { route: null, garden: null };
const SAVE_DELAY = 400;
let saveTimer = null;
let saving = Promise.resolve();
let current = null; // unmount de l'écran courant
let routeToken = 0;

export function navigate(hash) {
  if (location.hash === hash) route(); else location.hash = hash;
}

export function scheduleSave() {
  if (!state.garden) return;
  setSaveStatus('Enregistrement…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, SAVE_DELAY);
}

export function flush() {
  clearTimeout(saveTimer);
  saveTimer = null;
  const g = state.garden;
  if (!g) return saving;
  saving = saving.then(async () => {
    try { await storage.saveGarden(g); setSaveStatus('Enregistré ✓'); } catch (e) { console.error(e); setSaveStatus('Échec de l’enregistrement'); }
  });
  return saving;
}

async function validate() {
  const g = state.garden;
  if (!g) return;
  g.status = 'validated';
  g.plan = g.plan || { svg: null, validatedAt: null };
  g.plan.validatedAt = new Date().toISOString();
  if (!g.plan.svg) {
    try { const { renderPlanSVG } = await import('./render.js'); g.plan.svg = renderPlanSVG(g, { view: 'plan', age: 'adult', layers: { dims: true, legend: true, sun: false, names: true } }); } catch { /* le SVG se régénère à la demande */ }
  }
  await flush();
  toast('Jardin validé : les conseils sont disponibles.');
  navigate(`#/garden/${encodeURIComponent(g.id)}/advice`);
}

async function loadGarden(id) {
  if (state.garden && state.garden.id === id) return state.garden;
  await flush();
  const g = await storage.getGarden(id);
  state.garden = g || null;
  return state.garden;
}

function shell(title, body, extra) {
  return h('div', { class: 'screen' },
    h('header', { class: 'topbar' },
      h('a', { class: 'btn btn-icon', href: '#/', 'aria-label': 'Retour à l’accueil' }, '←'),
      h('h1', { class: 'app-title' }, title), extra || null),
    body);
}

async function route() {
  const token = ++routeToken;
  const root = document.getElementById('app');
  if (!root) return;
  if (typeof current === 'function') { try { current(); } catch (e) { console.error(e); } }
  current = null;
  const r = parseRoute(location.hash);
  state.route = r;
  try { window.scrollTo(0, 0); } catch { /* jsdom */ }

  if (r.name === 'home') {
    await flush();
    state.garden = null;
    current = mountHome(root, { storage, navigate, createGarden });
    return;
  }
  if (r.name === 'settings') {
    const body = h('main', { class: 'settings' });
    root.replaceChildren(shell('Réglages', body));
    try {
      const { mountSettings } = await import('./ui/settings.js');
      if (token !== routeToken) return;
      current = mountSettings(body, {});
    } catch { body.append(h('p', { class: 'notice' }, 'Écran en cours de chargement. Les réglages ne sont pas encore disponibles.')); }
    return;
  }

  if (r.name === 'import') {
    const body = h('main', { class: 'import' });
    root.replaceChildren(shell('Importer un jardin', body));
    try {
      const { mountImportScreen } = await import('./ui/import-screen.js');
      if (token !== routeToken) return;
      current = mountImportScreen(body, { code: r.code, onDone: (id) => navigate(gardenHash(id, 'context')), onCancel: () => navigate('#/') });
    } catch (e) { console.error(e); body.append(h('p', { class: 'notice' }, 'Impossible de lire ce lien.')); }
    return;
  }

  const g = await loadGarden(r.id);
  if (token !== routeToken) return;
  if (!g) { toast('Jardin introuvable.'); navigate('#/'); return; }

  if (r.name === 'share') {
    const body = h('main', { class: 'share' });
    root.replaceChildren(shell('Continuer sur mon téléphone', body));
    try {
      const { mountShareScreen } = await import('./ui/share-screen.js');
      if (token !== routeToken) return;
      current = mountShareScreen(body, { garden: g, onBack: () => navigate('#/') });
    } catch (e) { console.error(e); body.append(h('p', { class: 'notice' }, 'Écran de partage indisponible.')); }
    return;
  }

  if (r.name === 'advice') {
    if (g.status !== 'validated') { navigate(gardenHash(g.id, 'render')); return; }
    const body = h('main', { class: 'advice' });
    root.replaceChildren(shell(g.name || 'Conseils', body,
      h('a', { class: 'btn btn-sm', href: gardenHash(g.id, 'render') }, 'Modifier')));
    try {
      const { mountAdvice } = await import('./ui/advice-screen.js');
      if (token !== routeToken) return;
      current = mountAdvice(body, { garden: g });
    } catch { body.append(h('p', { class: 'notice' }, 'Écran en cours de chargement. Les conseils ne sont pas encore disponibles.')); }
    return;
  }

  current = mountWizard(root, { garden: g, step: r.step, navigate, save: scheduleSave, onValidate: validate });
  setSaveStatus('');
}

/** Liens profonds de l'app Android (jardin://import/<code> ou lien https du site) : ouvre l'import. */
async function openIncomingUrl(url) {
  try {
    const { routeFromIncomingUrl } = await import('./transfer.js');
    const hash = routeFromIncomingUrl(url);
    if (hash) navigate(hash);
  } catch (e) { console.error(e); }
}
function listenDeepLinks() {
  const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (!App) return;
  try {
    App.addListener('appUrlOpen', (ev) => { if (ev && ev.url) openIncomingUrl(ev.url); });
    if (App.getLaunchUrl) App.getLaunchUrl().then((r) => { if (r && r.url) openIncomingUrl(r.url); }).catch(() => {});
  } catch (e) { console.error(e); }
}

export function start() {
  listenDeepLinks();
  window.addEventListener('hashchange', () => { flush().then(route); });
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  return route();
}

window.__jardin = { storage, state, navigate, flush, scheduleSave };
if (typeof document !== 'undefined' && document.getElementById('app')) start();
