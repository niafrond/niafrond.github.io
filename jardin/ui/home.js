// Accueil : liste des jardins, nouveau/dupliquer/supprimer, import/export, tâches du mois.
import { h, toast, confirmDialog, gardenHash } from './wizard.js';
import { polygonArea } from '../geometry.js';
import { codeFromUrl } from '../transfer.js';
import { openSaveDialog, safeFilename } from './save-file.js';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function surfaceOf(g) {
  try { return g.boundary && g.boundary.length >= 3 ? polygonArea(g.boundary) : 0; } catch { return 0; }
}
const fmtSurface = (s) => (s > 0 ? `${s.toFixed(s < 10 ? 1 : 0).replace('.', ',')} m²` : 'Contour à tracer');

function download(name, text) {
  openSaveDialog({ filename: name, text, title: 'Exporter le jardin' });
}

/** mountHome(el, {storage, navigate, createGarden}) → unmount() */
export function mountHome(el, { storage, navigate, createGarden }) {
  let dead = false;
  const list = h('ul', { class: 'garden-list', 'aria-label': 'Mes jardins' });
  const banner = h('div', { class: 'banner-wrap' });
  const fileInput = h('input', {
    type: 'file', accept: '.json,application/json', hidden: true, id: 'import-file', 'aria-label': 'Importer un jardin (fichier JSON)',
    onchange: async (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!f) return;
      try {
        const g = await storage.importGarden(await f.text());
        if (g && g.id) await storage.saveGarden(g);
        toast('Jardin importé.');
        refresh();
      } catch (err) { toast('Import impossible : ' + (err && err.message ? err.message : 'fichier invalide')); }
    },
  });

  el.replaceChildren(
    h('header', { class: 'topbar' },
      h('h1', { class: 'app-title' }, '🌱 Mon jardin'),
      h('a', { class: 'btn btn-icon', href: '#/settings', 'aria-label': 'Réglages' }, '⚙️')),
    h('main', { class: 'home' },
      banner,
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-primary grow', type: 'button', id: 'btn-new', onclick: async () => {
          const gs = await storage.listGardens();
          const g = createGarden(`Jardin ${gs.length + 1}`);
          await storage.saveGarden(g);
          navigate(gardenHash(g.id, 'context'));
        } }, '＋ Nouveau jardin')),
      list,
      h('div', { class: 'row' },
        h('button', { class: 'btn grow', type: 'button', onclick: () => fileInput.click() }, '📥 Importer (JSON)'),
        h('button', { class: 'btn grow', type: 'button', id: 'btn-import-link', onclick: openPasteDialog }, '📲 Importer un lien ou un code'),
        fileInput)));

  function openPasteDialog() {
    const prev = document.activeElement;
    const close = () => { overlay.remove(); if (prev && prev.focus) prev.focus(); };
    const area = h('textarea', { rows: 4, id: 'import-paste', 'aria-label': 'Lien ou code de transfert', placeholder: 'Collez ici le lien ou le code reçu', style: 'width:100%' });
    const err = h('p', { class: 'notice', role: 'alert', hidden: true }, 'Rien de reconnu : collez le lien complet ou le code (il commence par « v1. »).');
    const go = () => {
      const code = codeFromUrl(area.value);
      if (!code) { err.hidden = false; area.focus(); return; }
      close();
      navigate('#/import/' + code);
    };
    const overlay = h('div', { class: 'overlay', onkeydown: (e) => { if (e.key === 'Escape') close(); } },
      h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Importer un lien ou un code' },
        h('p', null, 'Collez un lien « Continuer sur mon téléphone » ou un code de transfert.'),
        area, err,
        h('div', { class: 'row end' },
          h('button', { class: 'btn', type: 'button', onclick: close }, 'Annuler'),
          h('button', { class: 'btn btn-primary', type: 'button', id: 'import-paste-ok', onclick: go }, 'Continuer'))));
    document.body.append(overlay);
    area.focus();
  }

  async function loadThumb(box, g) {
    try {
      const { renderPlanSVG } = await import('../render.js');
      if (dead || !g.boundary || g.boundary.length < 3) return;
      box.innerHTML = renderPlanSVG(g, { view: 'plan', width: 160, height: 120, layers: { dims: false, legend: false, sun: false, names: false } });
      const svg = box.querySelector('svg');
      if (svg) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `Plan de ${g.name}`); svg.removeAttribute('width'); svg.removeAttribute('height'); }
    } catch { /* vignette indisponible */ }
  }

  async function loadTasks(gardens) {
    banner.replaceChildren();
    const validated = gardens.filter((g) => g.status === 'validated');
    if (!validated.length) return;
    let advice;
    try { advice = await import('../advice.js'); } catch { return; }
    if (dead) return;
    const now = new Date();
    const month = now.getMonth() + 1;
    for (const g of validated) {
      let tasks = [];
      try { tasks = advice.tasksForMonth(g, month) || []; } catch { /* ignore */ }
      if (!tasks.length) continue;
      const key = (t, i) => `${now.getFullYear()}-${month}:${t.kind}:${t.zoneId || ''}:${t.plantId || ''}:${i}`;
      const items = tasks.slice(0, 5).map((t, i) => {
        const k = key(t, i);
        const cb = h('input', {
          type: 'checkbox', id: 'task-' + g.id + '-' + i, checked: !!(g.tasksDone && g.tasksDone[k]),
          onchange: async (e) => {
            g.tasksDone = g.tasksDone || {};
            if (e.target.checked) g.tasksDone[k] = true; else delete g.tasksDone[k];
            await storage.saveGarden(g);
          },
        });
        return h('li', null, cb, h('label', { for: cb.id }, t.text));
      });
      banner.append(h('section', { class: 'banner', 'aria-label': `Tâches de ${MOIS[month - 1]} pour ${g.name}` },
        h('h2', null, `🗓️ Ce mois-ci (${MOIS[month - 1]}) · ${g.name}`),
        h('ul', { class: 'tasks' }, items),
        h('a', { class: 'link', href: `#/garden/${encodeURIComponent(g.id)}/advice` }, tasks.length > 5 ? `Voir les ${tasks.length} tâches` : 'Ouvrir les conseils')));
    }
  }

  async function refresh() {
    let gardens = [];
    try { gardens = (await storage.listGardens()) || []; } catch (e) { console.error(e); }
    if (dead) return;
    gardens = gardens.slice().sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    list.replaceChildren();
    if (!gardens.length) {
      list.append(h('li', { class: 'empty' }, h('p', null, 'Aucun jardin pour l’instant.'), h('p', { class: 'muted' }, 'Créez votre premier jardin : décrivez votre terrain, placez des zones et choisissez des essences adaptées.')));
    }
    for (const g of gardens) {
      const thumb = h('div', { class: 'thumb', 'aria-hidden': 'true' }, '🌳');
      const open = () => navigate(g.status === 'validated' ? `#/garden/${encodeURIComponent(g.id)}/advice` : gardenHash(g.id, 'context'));
      list.append(h('li', { class: 'garden-card', 'data-id': g.id },
        h('button', { class: 'card-main', type: 'button', onclick: open, 'aria-label': `Ouvrir ${g.name}` },
          thumb,
          h('span', { class: 'card-text' },
            h('strong', null, g.name || 'Jardin sans nom'),
            h('span', { class: 'muted' }, fmtSurface(surfaceOf(g)) + (g.context && g.context.region ? ' · ' + g.context.region : '')),
            h('span', { class: 'badge ' + (g.status === 'validated' ? 'ok' : '') }, g.status === 'validated' ? 'Validé' : 'Brouillon'))),
        h('div', { class: 'card-actions' },
          g.status === 'validated' ? h('a', { class: 'btn btn-sm', href: gardenHash(g.id, 'render') }, 'Modifier') : null,
          h('button', { class: 'btn btn-sm', type: 'button', onclick: async () => { await storage.duplicateGarden(g.id); toast('Jardin dupliqué.'); refresh(); } }, 'Dupliquer'),
          h('a', { class: 'btn btn-sm', href: `#/garden/${encodeURIComponent(g.id)}/share` }, 'Envoyer vers le téléphone'),
          g.boundary && g.boundary.length >= 3 ? h('button', { class: 'btn btn-sm', type: 'button', 'data-act': 'pdf', onclick: () => import('./pdf-dialog.js').then((m) => m.openPdfDialog({ garden: g })) }, '📄 PDF du jardin') : null,
          h('button', { class: 'btn btn-sm', type: 'button', onclick: async () => download(safeFilename(g.name), await storage.exportGarden(g)) }, 'Exporter'),
          h('button', { class: 'btn btn-sm btn-danger', type: 'button', onclick: async () => {
            if (await confirmDialog(`Supprimer « ${g.name} » ? Cette action est définitive.`, { ok: 'Supprimer', danger: true })) {
              await storage.deleteGarden(g.id); toast('Jardin supprimé.'); refresh();
            }
          } }, 'Supprimer'))));
      loadThumb(thumb, g);
    }
    loadTasks(gardens);
  }
  refresh();
  return () => { dead = true; el.replaceChildren(); };
}
