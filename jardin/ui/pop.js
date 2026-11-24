// Fenêtre de saisie flottante (dimensions en cm, angle en degrés, texte) : variante autonome du motif de draw-contour.
import { h, parseLength, parseNum, toCm } from './draw-util.js';

/**
 * Crée une fenêtre de saisie dans `host` (élément positionné). Champs :
 *   {key, label, value, kind:'length'|'angle'|'text'|'height'}  — « length » en cm (« 350 » = 3,50 m ; « 3,5 m » accepté),
 *   « angle » en degrés. `onOk(valeurs)` : longueurs en mètres, angle en degrés ; renvoyer false garde la fenêtre ouverte.
 * @returns {{open:Function, close:Function, isOpen:()=>boolean, el:HTMLElement}}
 */
export function createPop(host, { onClose, onWarn } = {}) {
  const el = h('div', { class: 'jd-pop jdi-pop', hidden: true, role: 'dialog', 'aria-modal': 'false', 'data-role': 'pop' });
  host.append(el);
  let opened = false;

  function close() {
    const was = opened;
    opened = false;
    el.hidden = true;
    el.innerHTML = '';
    if (was && onClose) onClose();
  }

  function open({ title, hint = '', fields = [], extra = null, actions = [], okLabel = 'Valider', onOk }) {
    el.innerHTML = '';
    el.hidden = false;
    opened = true;
    const inputs = {};
    const rows = fields.map((f) => {
      const kind = f.kind || 'length';
      const unit = kind === 'angle' ? '°' : kind === 'text' ? '' : 'cm';
      const inp = h('input', {
        class: 'jd-input jd-pop-input', type: 'text', value: f.value ?? '', 'aria-label': f.label, enterkeyhint: 'done',
        inputmode: kind === 'text' ? 'text' : kind === 'angle' ? 'decimal' : 'numeric', 'data-field': f.key,
      });
      inputs[f.key] = inp;
      const bump = (dir) => () => {
        if (kind === 'angle') {
          const v = parseNum(inp.value);
          inp.value = String((((Number.isFinite(v) ? v : 0) + dir * 15) % 360 + 360) % 360);
        } else {
          const v = parseLength(inp.value);
          inp.value = toCm(Math.max(0.01, (Number.isFinite(v) ? v : 0) + dir * 0.1));
        }
        inp.focus(); inp.select();
      };
      return h('div', { class: 'jd-pop-row' },
        h('label', {}, f.label),
        kind === 'text' ? null : h('button', { type: 'button', class: 'jd-btn jd-step', 'aria-label': kind === 'angle' ? 'Moins 15 degrés' : 'Moins 10 centimètres', onclick: bump(-1) }, kind === 'angle' ? '−15' : '−10'),
        inp,
        unit ? h('span', { class: 'jd-unit' }, unit) : null,
        kind === 'text' ? null : h('button', { type: 'button', class: 'jd-btn jd-step', 'aria-label': kind === 'angle' ? 'Plus 15 degrés' : 'Plus 10 centimètres', onclick: bump(1) }, kind === 'angle' ? '+15' : '+10'));
    });
    const commit = () => {
      const out = {};
      for (const f of fields) {
        const kind = f.kind || 'length';
        const raw = inputs[f.key].value;
        if (kind === 'text') { out[f.key] = String(raw).trim(); continue; }
        const v = kind === 'angle' ? parseNum(raw) : parseLength(raw);
        if (!Number.isFinite(v)) {
          inputs[f.key].classList.add('bad'); inputs[f.key].focus();
          if (onWarn) onWarn(kind === 'angle' ? 'Saisissez un angle en degrés, par exemple 45.' : 'Saisissez une longueur en cm, par exemple 350 (ou 3,5 m).');
          return;
        }
        out[f.key] = kind === 'angle' ? ((v % 360) + 360) % 360 : v;
      }
      const res = onOk ? onOk(out) : null;
      if (res !== false) close();
    };
    el.append(...[
      h('div', { class: 'jd-pop-title' }, title),
      ...rows,
      extra,
      hint ? h('div', { class: 'jd-pop-hint' }, hint) : null,
      h('div', { class: 'jd-row' },
        h('button', { type: 'button', class: 'jd-btn primary', 'data-act': 'pop-ok', onclick: commit }, okLabel),
        h('button', { type: 'button', class: 'jd-btn', 'data-act': 'pop-cancel', onclick: close }, 'Annuler'),
        ...actions.map((a) => h('button', { type: 'button', class: `jd-btn ${a.danger ? 'danger' : ''}`, 'data-act': a.act, onclick: () => a.fn() }, a.label))),
    ].filter(Boolean));
    el.onkeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); } else if (e.key === 'Escape') { e.preventDefault(); close(); }
    };
    const first = Object.values(inputs)[0];
    if (first) setTimeout(() => { first.focus(); if (first.select) first.select(); }, 0);
  }

  return { open, close, isOpen: () => opened, el };
}
