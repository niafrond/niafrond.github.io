// Niveau d'entretien souhaité : pastilles (jardin ou zone), rappel et indicateur d'effort d'une essence.
import { h } from './draw-util.js';
import { MAINTENANCE_LEVELS, getMaintenanceLevel, levelForZone, effortBadge, effortLabel } from '../maintenance.js';

/** « 🌿 peu d'entretien » (minuscules) ; chaîne vide pour « main verte » ou un niveau inconnu. */
export function levelPhrase(id) {
  const l = getMaintenanceLevel(id);
  return l && l.id !== 'green' ? `${l.emoji} ${l.label.toLowerCase()}` : '';
}

/**
 * Pastilles de niveau d'entretien (radio). `inherit` ajoute une première pastille « Comme le jardin » (valeur null).
 * `cards` : une pastille par ligne avec description (niveau du jardin). `onPick(id|null)`.
 * @returns {HTMLElement} le conteneur ; `.setValue(id|null)` met à jour la sélection.
 */
export function maintenanceChips({ value = null, onPick, inherit = false, inheritLabel = 'Comme le jardin', cards = false, ariaLabel = 'Niveau d’entretien', dataRole } = {}) {
  const box = h('div', {
    class: `amb-chips maint-chips${cards ? ' amb-cards' : ' maint-compact'}`, role: 'radiogroup', 'aria-label': ariaLabel, 'data-role': dataRole,
  });
  const entries = [];
  if (inherit) entries.push({ id: '', label: inheritLabel, emoji: '', desc: '' });
  MAINTENANCE_LEVELS.forEach((l) => entries.push(l));
  const btns = entries.map((l) => {
    const content = cards
      ? [h('span', { class: 'amb-emoji', 'aria-hidden': 'true' }, l.emoji),
        h('span', { class: 'amb-txt' }, h('b', null, l.label), l.desc ? h('small', null, l.desc) : null)]
      : [l.emoji ? h('span', { class: 'amb-emoji', 'aria-hidden': 'true' }, l.emoji) : null, l.emoji ? ' ' : null, l.label];
    return h('button', {
      type: 'button', class: 'amb-chip maint-chip', 'data-maintenance': l.id, role: 'radio', title: l.desc || l.label,
      onclick: () => { box.setValue(l.id || null); if (onPick) onPick(l.id || null); },
    }, content);
  });
  box.append(...btns);
  box.setValue = (v) => {
    const cur = v || '';
    const hasSel = btns.some((b) => b.dataset.maintenance === cur);
    btns.forEach((b, i) => {
      const on = b.dataset.maintenance === cur;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on || (!hasSel && i === 0) ? 0 : -1;
      b.classList.toggle('on', on);
    });
  };
  box.addEventListener('keydown', (e) => {
    const k = e.key;
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(k)) return;
    e.preventDefault();
    const i = btns.indexOf(document.activeElement);
    const n = btns.length;
    const j = (i + (k === 'ArrowRight' || k === 'ArrowDown' ? 1 : -1) + n) % n;
    btns[j].focus(); btns[j].click();
  });
  box.setValue(value);
  return box;
}

/** Bloc « Votre niveau de jardinage » / « Quel niveau d'entretien ? » pour le jardin. */
export function gardenMaintenancePicker(garden, { onChange, title = 'Quel niveau d’entretien ?', hint = 'Les essences conseillées s’adaptent au temps que vous voulez y consacrer.' } = {}) {
  const c = garden.context || (garden.context = {});
  const chips = maintenanceChips({
    value: levelForZone(garden, null), cards: true, ariaLabel: 'Niveau d’entretien du jardin', dataRole: 'garden-maintenance',
    onPick: (id) => { c.maintenance = id || 'green'; if (onChange) onChange(c.maintenance); },
  });
  return h('div', { class: 'maint-block' }, h('h3', { class: 'maint-title' }, title), h('p', { class: 'muted small' }, hint), chips);
}

/** Sélecteur de zone : « Cette zone : comme le jardin / 🧤 / 🌿 / 🛋 ». */
export function zoneMaintenancePicker(garden, zone, { onChange } = {}) {
  const chips = maintenanceChips({
    value: zone.maintenance || null, inherit: true, inheritLabel: 'Comme le jardin', ariaLabel: 'Niveau d’entretien de cette zone', dataRole: 'zone-maintenance',
    onPick: (id) => { if (id) zone.maintenance = id; else delete zone.maintenance; if (onChange) onChange(id); },
  });
  return h('div', { class: 'maint-zone' }, h('span', { class: 'small muted maint-zone-label' }, 'Entretien de cette zone'), chips);
}

/**
 * Rappel dans une fenêtre : « Niveau d'entretien : 🌿 peu d'entretien — changer ». « changer » déploie les pastilles.
 * `get()` → id courant, `set(id|null)`, `inherit` : propose « Comme le jardin » (cas d'une seule zone).
 */
export function maintenanceReminder({ get, set, inherit = false } = {}) {
  const textEl = h('span', { 'data-role': 'maint-reminder-text' });
  const draw = () => {
    const id = get();
    const l = getMaintenanceLevel(id) || getMaintenanceLevel('green');
    textEl.textContent = `Niveau d’entretien : ${l.emoji} ${l.label.toLowerCase()}`;
  };
  const chips = maintenanceChips({ value: null, inherit: false, ariaLabel: 'Niveau d’entretien', onPick: (id) => { set(id); draw(); chips.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
  chips.hidden = true;
  const btn = h('button', { type: 'button', class: 'btn btn-sm', 'data-act': 'maint-change', 'aria-expanded': 'false',
    onclick: () => { chips.setValue(get()); chips.hidden = !chips.hidden; btn.setAttribute('aria-expanded', String(!chips.hidden)); } }, 'changer');
  draw();
  const el = h('div', { class: 'maint-reminder', 'data-role': 'maint-reminder' }, h('p', { class: 'small' }, textEl, ' — ', btn), chips);
  el.refresh = draw;
  return el;
}

/** Indicateur d'effort d'une essence : « 🧤×1 Entretien : léger ». */
export function effortIndicator(effort, { ok = true } = {}) {
  return h('span', { class: `effort effort-${effort}${ok ? '' : ' ko'}`, 'data-role': 'effort', 'data-effort': String(effort), title: `Entretien ${effortLabel(effort)}` },
    h('span', { 'aria-hidden': 'true' }, effortBadge(effort)), ` Entretien : ${effortLabel(effort)}`);
}
