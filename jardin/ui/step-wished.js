// Étape 3 : zones souhaitées (checklist des types de zones) et mode des massifs (dessinés à la main ou calculés par l'app).
import { h } from './wizard.js';
import { ZONE_TYPES, bedModeOf } from '../model.js';
import { FLOWER_ZONE_TYPES } from '../massifs.js';

const MODES = [
  { id: 'manual', icon: '🖌', title: 'Je dessine mes massifs moi-même', desc: 'Vous placez chaque massif et choisissez ses plantes.' },
  { id: 'auto', icon: '✨', title: 'L’app calcule les massifs', desc: 'Zones fleuries dans les vides, avec les meilleures plantes.' },
];

export function mountWished(el, { garden, onChange }) {
  if (!Array.isArray(garden.wishedZoneTypes)) garden.wishedZoneTypes = [];
  const render = () => {
    const auto = bedModeOf(garden) === 'auto';
    // en mode auto les types massif ne sont plus à choisir (choix conservé, sans perte, si on revient en manuel)
    const types = auto ? ZONE_TYPES.filter((t) => !FLOWER_ZONE_TYPES.includes(t.id)) : ZONE_TYPES;
    const shown = () => garden.wishedZoneTypes.filter((id) => types.some((t) => t.id === id));
    const count = h('p', { class: 'muted', role: 'status', 'aria-live': 'polite' });
    const upd = () => {
      const n = shown().length;
      count.textContent = n ? `${n} type${n > 1 ? 's' : ''} de zone souhaité${n > 1 ? 's' : ''}.` : 'Aucune zone cochée pour l’instant.';
    };
    const items = types.map((t) => {
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
    const setMode = (id) => {
      if (bedModeOf(garden) === id) return;
      garden.context = garden.context || {};
      garden.context.bedMode = id;
      onChange && onChange(garden);
      render();
    };
    const cards = h('div', { class: 'mode-cards', role: 'radiogroup', 'aria-label': 'Mode de création des massifs', 'data-role': 'bed-mode' },
      MODES.map((m) => h('button', {
        type: 'button', class: 'mode-card' + (auto === (m.id === 'auto') ? ' on' : ''), role: 'radio', 'aria-checked': String(auto === (m.id === 'auto')),
        'data-bed-mode': m.id, onclick: () => setMode(m.id),
      }, h('span', { class: 'mode-icon', 'aria-hidden': 'true' }, m.icon), h('span', { class: 'mode-txt' }, h('b', null, m.title), h('small', null, m.desc)))));
    el.replaceChildren(
      h('section', { class: 'card' },
        h('h2', null, 'Comment créer vos massifs ?'),
        h('p', { class: 'muted' }, 'Vous pourrez changer d’avis à tout moment, sans rien perdre.'),
        cards),
      h('section', { class: 'card' },
        h('h2', null, 'Que voulez-vous dans votre jardin ?'),
        h('p', { class: 'muted' }, 'Cochez les types de zones souhaités : ils serviront de liste de contrôle avant le rendu.'),
        auto ? h('p', { class: 'notice info', 'data-role': 'wished-auto-note' }, '🌸 Les zones de fleurs et de plantes (plantes basses, massifs, plantes hautes) ne sont pas à choisir ici : l’app les calcule à l’étape Massifs, dans les vides du jardin.') : null,
        h('ul', { class: 'checklist' }, items), count));
    upd();
  };
  render();
  return () => el.replaceChildren();
}
