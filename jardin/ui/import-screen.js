// Import d'un jardin reçu par lien, QR code ou code collé : aperçu puis import comme nouveau jardin.
import { h, toast } from './wizard.js';
import { storage } from '../storage.js';
import { decodeGarden, describeGarden, buildAppLink } from '../transfer.js';

const fmtM2 = (s) => (s > 0 ? `${s.toFixed(s < 10 ? 1 : 0).replace('.', ',')} m²` : 'contour non tracé');

/** mountImportScreen(el, {code, onDone, onCancel}) → unmount() */
export function mountImportScreen(el, { code, onDone, onCancel }) {
  let dead = false;
  const body = h('div', { class: 'import-body' }, h('p', { class: 'muted' }, 'Lecture du jardin…'));
  const cancel = h('button', { class: 'btn', type: 'button', 'data-act': 'cancel', onclick: () => onCancel && onCancel() }, 'Annuler');
  el.replaceChildren(h('main', { class: 'import' }, h('h2', null, 'Importer un jardin'), body));

  (async () => {
    let g;
    try { g = await decodeGarden(code); } catch (e) {
      if (dead) return;
      body.replaceChildren(h('p', { class: 'notice', role: 'alert', 'data-role': 'import-error' }, e && e.message ? e.message : 'Code illisible.'), h('div', { class: 'row end' }, cancel));
      return;
    }
    if (dead) return;
    const d = describeGarden(g);
    const thumb = h('div', { class: 'thumb', 'aria-hidden': 'true', style: 'width:160px;height:120px' }, '🌳');
    const importBtn = h('button', { class: 'btn btn-primary', type: 'button', 'data-act': 'import', onclick: async () => {
      importBtn.disabled = true;
      try {
        const saved = await storage.importGarden({ format: 'jardin-v1', garden: g });
        toast('Jardin importé.');
        if (onDone) onDone(saved.id);
      } catch (e) { importBtn.disabled = false; toast('Import impossible : ' + (e && e.message ? e.message : 'données invalides')); }
    } }, 'Importer comme nouveau jardin');
    const native = !!(globalThis.Capacitor && globalThis.Capacitor.isNativePlatform && globalThis.Capacitor.isNativePlatform());
    const href = /Android/i.test(navigator.userAgent || '')
      ? `intent://import/${code}#Intent;scheme=jardin;package=io.github.niafrond.jardin;end` : buildAppLink(code);
    body.replaceChildren(
      h('div', { class: 'row' }, thumb,
        h('div', { class: 'grow', 'data-role': 'preview' },
          h('strong', null, d.name),
          h('p', { class: 'muted' }, `${fmtM2(d.areaM2)} · ${d.zones} zone${d.zones > 1 ? 's' : ''} · ${d.plants} plant${d.plants > 1 ? 's' : ''}`))),
      h('p', { class: 'muted' }, 'Le jardin sera ajouté à vos jardins : aucun jardin existant n’est modifié.'),
      h('div', { class: 'row end' }, cancel, importBtn),
      native ? null : h('p', null, h('a', { class: 'btn', 'data-act': 'open-app', href }, 'Ouvrir dans l’application Android')));
    try {
      const { renderPlanSVG } = await import('../render.js');
      if (dead || !g.boundary || g.boundary.length < 3) return;
      thumb.innerHTML = renderPlanSVG(g, { view: 'plan', width: 160, height: 120, layers: { dims: false, legend: false, sun: false, names: false } });
      const svg = thumb.querySelector('svg');
      if (svg) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `Plan de ${d.name}`); svg.removeAttribute('width'); svg.removeAttribute('height'); }
    } catch { /* vignette indisponible */ }
  })();

  return () => { dead = true; el.replaceChildren(); };
}
