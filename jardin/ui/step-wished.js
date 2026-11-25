// Étape 3 : zones souhaitées (checklist des types de zones).
import { h } from './wizard.js';
import { ZONE_TYPES } from '../model.js';

export function mountWished(el, { garden, onChange }) {
  if (!Array.isArray(garden.wishedZoneTypes)) garden.wishedZoneTypes = [];
  const count = h('p', { class: 'muted', role: 'status', 'aria-live': 'polite' });
  const upd = () => {
    const n = garden.wishedZoneTypes.length;
    count.textContent = n ? `${n} type${n > 1 ? 's' : ''} de zone souhaité${n > 1 ? 's' : ''}.` : 'Aucune zone cochée pour l’instant.';
  };
  const items = ZONE_TYPES.map((t) => {
    const id = 'wish-' + t.id;
    const cb = h('input', {
      type: 'checkbox', id, checked: garden.wishedZoneTypes.includes(t.id),
      onchange: (e) => {
        const s = new Set(garden.wishedZoneTypes);
        if (e.target.checked) s.add(t.id); else s.delete(t.id);
        garden.wishedZoneTypes = ZONE_TYPES.map((z) => z.id).filter((z) => s.has(z));
        upd(); onChange && onChange(garden);
      },
    });
    return h('li', null, h('label', { class: 'check', for: id },
      cb, h('span', { class: 'swatch', style: `background:${t.color}`, 'aria-hidden': 'true' }, t.icon), h('span', null, t.label)));
  });
  el.replaceChildren(
    h('section', { class: 'card' },
      h('h2', null, 'Que voulez-vous dans votre jardin ?'),
      h('p', { class: 'muted' }, 'Cochez les types de zones souhaités : ils serviront de liste de contrôle avant le rendu.'),
      h('ul', { class: 'checklist' }, items), count));
  upd();
  return () => el.replaceChildren();
}
