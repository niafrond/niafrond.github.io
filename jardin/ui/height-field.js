// Champ « Hauteur (cm) » commun aux éditeurs : saisie en cm, − / +, valeur par défaut (↺), bornes de heights.js.
import { h } from './draw-util.js';
import { checkHeight, parseHeight, heightToCm, heightMessage, formatHeight } from '../heights.js';

/**
 * @param {object} o
 * @param {string} o.label        libellé visible (« Hauteur de la paroi (cm) »…)
 * @param {number} o.value        hauteur actuelle (m)
 * @param {number} o.def          hauteur par défaut (m)
 * @param {string} o.kind         clé de bornes (`HEIGHT_LIMITS`)
 * @param {boolean} [o.custom]    vrai si la valeur est réglée à la main (sinon « catalogue »)
 * @param {string} [o.field]      valeur de `data-field` de la saisie
 * @param {(m:number|null, info:{clamped:boolean,message:string})=>void} o.onSet  m = nouvelle hauteur (m) ou null = défaut
 * @param {(msg:string)=>void} [o.onMessage]
 * @param {number} [o.step=0.1]   pas des boutons − / + (m)
 */
export function heightField({ label, value, def, kind, custom = false, field = 'height', onSet, onMessage = null, step = 0.1, defLabel = 'catalogue' }) {
  const input = h('input', {
    class: 'jd-input jd-hinput', type: 'text', inputmode: 'numeric', value: heightToCm(value), 'aria-label': label,
    'data-field': field, enterkeyhint: 'done', autocomplete: 'off', placeholder: heightToCm(def),
  });
  const state = h('span', { class: 'jd-hstate', 'data-role': 'height-state', 'data-state': custom ? 'custom' : 'default' },
    custom ? `personnalisée · par défaut ${formatHeight(def)}` : `${defLabel} · ${formatHeight(def)}`);
  const note = h('span', { class: 'jd-hnote', role: 'status', 'aria-live': 'polite', 'data-role': 'height-note' });
  const say = (m) => { note.textContent = m || ''; if (onMessage && m) onMessage(m); };
  const apply = (m) => {
    const chk = checkHeight(kind, m);
    if (!chk.ok) { input.classList.add('bad'); say(heightMessage(kind)); input.value = heightToCm(value); return; }
    input.classList.remove('bad');
    say(chk.clamped ? chk.message : '');
    onSet(chk.value, { clamped: chk.clamped, message: chk.message });
  };
  const commit = () => {
    const m = parseHeight(input.value);
    if (m == null) { input.classList.add('bad'); say(heightMessage(kind)); return; }
    apply(m);
  };
  input.addEventListener('change', commit);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
  const bump = (dir) => () => { const m = parseHeight(input.value); apply((m == null ? value : m) + dir * step); };
  const reset = h('button', {
    type: 'button', class: 'jd-btn jd-hreset', 'data-act': 'height-reset', disabled: !custom,
    'aria-label': `Valeur par défaut (${formatHeight(def)})`, title: `Valeur par défaut : ${formatHeight(def)}`, onclick: () => { say(''); onSet(null, { clamped: false, message: '' }); },
  }, '↺ Valeur par défaut');
  return h('div', { class: 'jd-field jd-hfield', 'data-role': 'height-field' },
    h('div', { class: 'jd-hrow' },
      h('label', { class: 'jd-flabel' }, label),
      h('button', { type: 'button', class: 'jd-btn jd-step', 'data-act': 'height-minus', 'aria-label': 'Moins 10 centimètres', onclick: bump(-1) }, '−10'),
      input, h('span', { class: 'jd-unit' }, 'cm'),
      h('button', { type: 'button', class: 'jd-btn jd-step', 'data-act': 'height-plus', 'aria-label': 'Plus 10 centimètres', onclick: bump(1) }, '+10')),
    h('div', { class: 'jd-hrow' }, state, reset),
    note);
}
