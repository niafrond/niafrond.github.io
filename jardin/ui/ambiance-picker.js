// Ambiance d'une zone (bucolique, décoratif…) : pastilles réutilisables, nom suggéré et fenêtre de choix
// (une zone ou le jardin entier, zone par zone) utilisée par « Surprends-moi » et le bandeau de l'éditeur de zones.
import { AMBIANCES, getAmbiance, detectAmbiance } from '../ambiances.js';
import { h } from './draw-util.js';

const lc = (s) => String(s || '').toLowerCase();
const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Ambiance (objet) d'un id, ou null. */
export function ambianceOf(id) {
  if (!id) return null;
  try { return getAmbiance(id) || null; } catch { return null; }
}
/** Emoji de l'ambiance (chaîne vide si aucune). */
export function ambianceEmoji(id) { const a = ambianceOf(id); return a ? a.emoji : ''; }
/** Mot d'ambiance tel qu'il est écrit dans un nom de zone (minuscules). */
export const ambianceWord = (a) => lc(a && a.label);

/** Ambiance détectée dans un texte (nom de zone), id ou null. */
export function detectIn(text) {
  try { return detectAmbiance(String(text || '')) || null; } catch { return null; }
}
/** Ambiance effective d'une zone : celle qui est enregistrée, sinon celle que le nom laisse deviner. */
export function zoneAmbiance(zone) {
  if (!zone) return null;
  return zone.ambiance || detectIn(zone.label);
}

/**
 * Nom de zone avec le mot d'ambiance : « Terrasse » + bucolique → « Terrasse — bucolique ».
 * Remplace le mot d'ambiance précédent s'il y en a un (suffixe « — mot » ou mot isolé), le retire si `id` est vide.
 */
export function nameWithAmbiance(label, id) {
  let name = String(label || '').trim();
  const words = AMBIANCES.map(ambianceWord).filter(Boolean).sort((a, b) => b.length - a.length);
  const any = words.map(escRe).join('|');
  if (any) {
    name = name.replace(new RegExp(`\\s*[—–-]\\s*(?:${any})\\s*$`, 'i'), '').trim();
    if (!id) {
      name = name.replace(new RegExp(`(^|\\s)(?:${any})(?=\\s|$)`, 'i'), '$1').replace(/\s{2,}/g, ' ').trim();
    }
  }
  const a = ambianceOf(id);
  if (!a) return name;
  const w = ambianceWord(a);
  const re = new RegExp(`(^|\\s)${escRe(w)}(?=\\s|$)`, 'i');
  if (re.test(name)) return name; // déjà dans le nom : on ne le répète pas
  return name ? `${name} — ${w}` : w;
}

/**
 * Pastilles d'ambiance. `mode: 'radio'` (une valeur, avec « Aucune » ou autre libellé via `none`) ou
 * `'action'` (suggestions : un toucher déclenche `onPick(id)`). `onPick(id|null)`.
 * @returns {HTMLElement} le conteneur ; `.setValue(id)` met à jour la sélection.
 */
export function ambianceChips({ value = null, onPick, mode = 'radio', none = 'Aucune', ariaLabel = 'Ambiance', cards = false, dataRole } = {}) {
  const radio = mode === 'radio';
  const box = h('div', {
    class: `amb-chips${cards ? ' amb-cards' : ''}`, role: radio ? 'radiogroup' : 'group', 'aria-label': ariaLabel, 'data-role': dataRole,
  });
  const entries = [];
  if (radio && none) entries.push({ id: '', label: none, emoji: '∅', desc: '' });
  AMBIANCES.forEach((a) => entries.push(a));
  const btns = entries.map((a) => {
    const label = cards
      ? [h('span', { class: 'amb-emoji', 'aria-hidden': 'true' }, a.emoji),
        h('span', { class: 'amb-txt' }, h('b', null, a.label), a.desc ? h('small', null, a.desc) : null)]
      : [h('span', { class: 'amb-emoji', 'aria-hidden': 'true' }, a.emoji), ' ', a.label];
    const b = h('button', {
      type: 'button', class: 'amb-chip', 'data-ambiance': a.id, title: a.desc || a.label,
      role: radio ? 'radio' : null, 'aria-label': radio || !a.desc ? null : `${a.label} : ${a.desc}`,
      onclick: () => { if (radio) box.setValue(a.id || null); if (onPick) onPick(a.id || null); },
    }, label);
    return b;
  });
  box.append(...btns);
  box.setValue = (v) => {
    const cur = v || '';
    const hasSel = btns.some((b) => radio && b.dataset.ambiance === cur);
    btns.forEach((b, i) => {
      const on = radio && b.dataset.ambiance === cur;
      if (radio) { b.setAttribute('aria-checked', String(on)); b.tabIndex = on || (!hasSel && i === 0) ? 0 : -1; }
      b.classList.toggle('on', on);
    });
  };
  if (radio) {
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
  }
  return box;
}

/**
 * Fenêtre « Quelle ambiance pour cette zone ? » (une zone) ou « …pour chaque zone ? » (plusieurs : une ligne par zone).
 * `defaults` : {zoneId: id|null} (sinon l'ambiance de la zone, sinon celle que son nom laisse deviner).
 * `onConfirm({zoneId: id|null})` à la validation ; `onCancel()` à l'annulation (Échap, toucher hors fenêtre).
 * @returns {{el:HTMLElement, close:Function, values:()=>object}}
 */
export function openAmbiancePicker(container, { zones = [], onConfirm, onCancel, defaults = {}, title, okLabel = 'Valider' } = {}) {
  const host = container || document.body;
  const prev = document.activeElement;
  const multi = zones.length > 1;
  const vals = {};
  zones.forEach((z) => { vals[z.id] = Object.prototype.hasOwnProperty.call(defaults, z.id) ? (defaults[z.id] || null) : zoneAmbiance(z); });
  const groups = new Map();
  let sameBox = null;

  const done = () => { overlay.remove(); if (prev && prev.focus) { try { prev.focus(); } catch { /* */ } } };
  const cancel = () => { done(); if (onCancel) onCancel(); };
  const confirm = () => { const out = { ...vals }; done(); if (onConfirm) onConfirm(out); };

  const nameOf = (z) => z.label || 'Zone';
  const rows = zones.map((z) => {
    const g = ambianceChips({
      value: vals[z.id], cards: !multi, ariaLabel: multi ? `Ambiance de ${nameOf(z)}` : 'Ambiance de la zone', none: 'Peu importe',
      onPick: (id) => { vals[z.id] = id; },
    });
    groups.set(z.id, g);
    return multi
      ? h('li', { class: 'amb-row', 'data-zone': z.id }, h('div', { class: 'amb-zname' }, h('b', null, nameOf(z))), g)
      : h('div', { class: 'amb-row', 'data-zone': z.id }, g);
  });

  const heading = title || (multi ? 'Quelle ambiance pour chaque zone ?' : 'Quelle ambiance pour cette zone ?');
  const titleEl = h('h3', { id: 'amb-title' }, heading);
  const body = [titleEl];
  if (!multi && zones[0]) body.push(h('p', { class: 'muted small', 'data-role': 'amb-zone' }, nameOf(zones[0])));
  else body.push(h('p', { class: 'muted small' }, 'Choisissez l’ambiance de chaque zone, ou « Peu importe ». Vous pourrez la changer ensuite.'));
  if (multi) {
    const sameBtn = h('button', {
      type: 'button', class: 'btn btn-block', 'data-act': 'same-ambiance', 'aria-expanded': 'false',
      onclick: () => {
        const open = sameBox.hidden;
        sameBox.hidden = !open; sameBtn.setAttribute('aria-expanded', String(open));
      },
    }, 'Même ambiance pour toutes');
    sameBox = h('div', { class: 'amb-same', hidden: true, 'data-role': 'amb-same' },
      ambianceChips({
        value: undefined, none: 'Peu importe', ariaLabel: 'Ambiance commune à toutes les zones',
        onPick: (id) => {
          zones.forEach((z) => { vals[z.id] = id; groups.get(z.id).setValue(id); });
          sameBox.hidden = true; sameBtn.setAttribute('aria-expanded', 'false');
        },
      }));
    sameBox.firstChild.setValue('__none__');
    body.push(sameBtn, sameBox, h('ul', { class: 'amb-list', 'aria-label': 'Zones' }, rows));
  } else body.push(...rows);
  body.push(h('div', { class: 'row end amb-actions' },
    h('button', { class: 'btn', type: 'button', 'data-act': 'amb-cancel', onclick: cancel }, 'Annuler'),
    h('button', { class: 'btn btn-primary', type: 'button', 'data-act': 'amb-ok', onclick: confirm }, okLabel)));

  const overlay = h('div', {
    class: 'overlay amb-overlay', 'data-role': 'ambiance-picker',
    onclick: (e) => { if (e.target === overlay) cancel(); },
    onkeydown: (e) => { if (e.key === 'Escape') { e.stopPropagation(); cancel(); } },
  }, h('div', { class: 'dialog amb-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'amb-title' }, body));
  host.append(overlay);
  const first = overlay.querySelector('.amb-chip.on') || overlay.querySelector('.amb-chip');
  if (first) first.focus();
  return { el: overlay, close: done, values: () => ({ ...vals }) };
}
