// Étape « Aménagements » : mobilier, murs & clôtures, portes & accès (coque autour de l'éditeur de dessin).
import { h } from './wizard.js';
import { mountItemEditor } from './draw-items.js';

export function mountItems(el, { garden, onChange } = {}) {
  const host = h('div', { class: 'items-host', 'data-role': 'items-step' });
  el.append(host);
  const unmount = mountItemEditor(host, { garden, onChange });
  return function unmountStep() {
    try { unmount(); } catch (e) { console.error(e); }
    host.remove();
  };
}
