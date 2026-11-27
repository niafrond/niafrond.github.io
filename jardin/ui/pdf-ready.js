// Bandeau global du PDF généré en arrière-plan : progression (annulable) puis « Le PDF est prêt » → télécharger.
import { h } from './draw-util.js';
import { loadReady, clearReady } from '../pdf-ready.js';
import { openSaveDialog } from './save-file.js';

const jobs = { cancel: null };
/** La fenêtre PDF enregistre ici la fonction d'annulation de la génération détachée. */
export function setPdfCancel(fn) { jobs.cancel = fn; }

export function mountPdfReady({ deps = {} } = {}) {
  const bar = h('div', { class: 'pdf-ready', 'data-role': 'pdf-ready', role: 'status', 'aria-live': 'polite', hidden: true,
    style: { position: 'fixed', left: '8px', right: '8px', bottom: 'calc(8px + env(safe-area-inset-bottom, 0px))', zIndex: 60, display: 'none', gap: '8px', alignItems: 'center', flexWrap: 'wrap',
      padding: '10px 12px', borderRadius: '12px', background: 'var(--card, #fff)', color: 'var(--fg, #1d2a1f)', border: '1px solid var(--line, #ccc)', boxShadow: '0 6px 24px #0004' } });
  document.body.append(bar);
  const set = (...kids) => { bar.hidden = false; bar.style.display = 'flex'; bar.replaceChildren(...kids.filter(Boolean)); };
  const hide = () => { bar.hidden = true; bar.style.display = 'none'; bar.replaceChildren(); };
  const text = (t) => h('span', { style: { flex: '1 1 160px' }, 'data-role': 'pdf-ready-text' }, t);

  async function showReady() {
    const r = await (deps.load || loadReady)();
    if (!r) { hide(); return; }
    set(text(`📄 Le PDF est prêt : ${r.filename}`),
      h('button', { class: 'btn btn-primary', type: 'button', 'data-act': 'pdf-ready-open', onclick: () => (deps.openSave || openSaveDialog)({ filename: r.filename, blob: r.blob, mime: 'application/pdf', title: 'PDF du jardin prêt' }) }, '⬇ Télécharger'),
      h('button', { class: 'btn', type: 'button', 'data-act': 'pdf-ready-dismiss', 'aria-label': 'Supprimer le PDF prêt', onclick: async () => { await (deps.clear || clearReady)(); hide(); } }, '✕'));
  }
  const onEvent = (e) => {
    const d = e.detail || {};
    if (d.type === 'running' || d.type === 'progress') {
      set(text(`📄 Génération du PDF… ${d.pct != null ? `${d.pct} % ` : ''}${d.label || ''}`.trim()),
        h('button', { class: 'btn', type: 'button', 'data-act': 'pdf-ready-cancel', onclick: () => { if (jobs.cancel) jobs.cancel(); hide(); } }, 'Annuler'));
    } else if (d.type === 'ready') showReady();
    else if (d.type === 'error') set(text(`📄 Le PDF n’a pas pu être généré (${d.message || 'erreur'}). Relancez l’export.`), h('button', { class: 'btn', type: 'button', 'data-act': 'pdf-ready-dismiss', onclick: hide }, 'OK'));
    else if (d.type === 'cleared') hide();
  };
  const onVisible = () => { if (document.visibilityState === 'visible' && bar.hidden) showReady(); };
  globalThis.addEventListener('jardin-pdf', onEvent);
  document.addEventListener('visibilitychange', onVisible);
  showReady();
  return { el: bar, refresh: showReady, destroy() { globalThis.removeEventListener('jardin-pdf', onEvent); document.removeEventListener('visibilitychange', onVisible); bar.remove(); } };
}
