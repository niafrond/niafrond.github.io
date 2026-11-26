// Assistant à 9 étapes : barre d'étapes, navigation libre, chargement paresseux des étapes.
// Exporte aussi de petits utilitaires DOM partagés (h, toast, confirmDialog…).
// Les étapes `workshop` (dessin, rendu) passent en « atelier plein écran » (ui/workshop.js) :
// `workshop: true` dès l'entrée ; `workshop: 'auto'` quand l'étape l'active elle-même (Soleil en mode carte, Massifs).
import { enterWorkshop } from './workshop.js';

export const STEPS = [
  { id: 'context', label: 'Contexte', icon: '📍' },
  { id: 'boundary', label: 'Terrain', icon: '📐', workshop: true },
  { id: 'wished', label: 'Zones souhaitées', icon: '✅' },
  { id: 'sun', label: 'Soleil', icon: '☀️', workshop: 'auto' },
  { id: 'items', label: 'Aménagements', icon: '🪑', workshop: true },
  { id: 'zones', label: 'Dessin des zones', icon: '🗺️', workshop: true },
  { id: 'beds', label: 'Massifs', icon: '🌸', workshop: 'auto' },
  { id: 'plants', label: 'Essences', icon: '🌿' },
  { id: 'render', label: 'Rendu', icon: '🖼️', workshop: true },
];
export const STEP_IDS = STEPS.map((s) => s.id);

/** Analyse un hash : #/, #/settings, #/garden/:id/:step, #/garden/:id/advice */
export function parseRoute(hash) {
  const parts = String(hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
  if (!parts.length) return { name: 'home' };
  if (parts[0] === 'settings') return { name: 'settings' };
  if (parts[0] === 'import' && parts[1]) return { name: 'import', code: parts.slice(1).join('/') };
  if (parts[0] === 'garden' && parts[1]) {
    const id = decodeURIComponent(parts[1]);
    if (parts[2] === 'advice') return { name: 'advice', id };
    if (parts[2] === 'share') return { name: 'share', id };
    return { name: 'wizard', id, step: STEP_IDS.includes(parts[2]) ? parts[2] : 'context' };
  }
  return { name: 'home' };
}
export const gardenHash = (id, step = 'context') => `#/garden/${encodeURIComponent(id)}/${step}`;

/** Création d'éléments DOM : h('div', {class:'x', onclick}, 'texte', enfant…) */
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  const add = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.append(c.nodeType ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  return el;
}

let toastTimer = null;
export function toast(message, ms = 3200) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = message;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

/** Boîte de confirmation accessible → Promise<boolean>. */
export function confirmDialog(message, { ok = 'Confirmer', cancel = 'Annuler', danger = false } = {}) {
  return new Promise((resolve) => {
    const prev = document.activeElement;
    const done = (v) => { overlay.remove(); if (prev && prev.focus) prev.focus(); resolve(v); };
    const okBtn = h('button', { class: 'btn ' + (danger ? 'btn-danger' : 'btn-primary'), type: 'button', onclick: () => done(true) }, ok);
    const overlay = h('div', { class: 'overlay', onkeydown: (e) => { if (e.key === 'Escape') done(false); } },
      h('div', { class: 'dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': message },
        h('p', null, message),
        h('div', { class: 'row end' },
          h('button', { class: 'btn', type: 'button', onclick: () => done(false) }, cancel), okBtn)));
    document.body.append(overlay);
    okBtn.focus();
  });
}

export function setSaveStatus(text) {
  const s = document.getElementById('save-status');
  if (s) s.textContent = text;
}

const LOADERS = {
  context: async () => (await import('./step-context.js')).mountContext,
  boundary: async () => (await import('./draw.js')).mountContourEditor,
  wished: async () => (await import('./step-wished.js')).mountWished,
  sun: async () => (await import('./step-sun.js')).mountSun,
  zones: async () => (await import('./draw.js')).mountZoneEditor,
  items: async () => (await import('./step-items.js')).mountItems,
  beds: async () => (await import('./step-beds.js')).mountBeds,
  plants: async () => (await import('./step-plants.js')).mountPlants,
  render: async () => (await import('./plan-step.js')).mountPlanStep,
};

/**
 * mountWizard(el, {garden, step, navigate(hash), save(), onValidate()}) → unmount()
 */
export function mountWizard(el, { garden, step, navigate, save, onValidate }) {
  const idx = Math.max(0, STEP_IDS.indexOf(step));
  const go = (id) => navigate(gardenHash(garden.id, id));
  let stepUnmount = null;
  let dead = false;

  const nameInput = h('input', {
    class: 'name-input', type: 'text', value: garden.name || '', 'aria-label': 'Nom du jardin', maxlength: '60',
    oninput: (e) => { garden.name = e.target.value; save(); },
  });
  const header = h('header', { class: 'topbar' },
    h('a', { class: 'btn btn-icon', href: '#/', 'aria-label': 'Retour à l’accueil' }, '←'),
    nameInput,
    h('span', { id: 'save-status', class: 'save-status', role: 'status', 'aria-live': 'polite' }, ''));

  const steps = h('ol', { class: 'steps', 'aria-label': 'Étapes de l’assistant' },
    STEPS.map((s, i) => h('li', null,
      h('button', {
        type: 'button', class: 'step' + (i === idx ? ' current' : i < idx ? ' done' : ''),
        'aria-current': i === idx ? 'step' : null, 'aria-label': `Étape ${i + 1} : ${s.label}`,
        'data-step': s.id, onclick: () => go(s.id),
      }, h('span', { class: 'step-n' }, s.icon)))));

  const title = h('h1', { class: 'step-title' }, `${idx + 1}/${STEPS.length} · ${STEPS[idx].label}`);
  const body = h('main', { class: 'step-body', id: 'step-body' });

  const prev = idx > 0 ? STEPS[idx - 1] : null;
  const next = idx < STEPS.length - 1 ? STEPS[idx + 1] : null;
  const footer = h('footer', { class: 'wizard-nav' },
    prev ? h('button', { class: 'btn', type: 'button', id: 'btn-prev', title: prev.label, onclick: () => go(prev.id) }, '← ' + prev.label) : h('span'),
    next ? h('button', { class: 'btn btn-primary', type: 'button', id: 'btn-next', title: next.label, onclick: () => go(next.id) }, next.label + ' →') : h('span'));

  el.replaceChildren(header, steps, title, body, footer);
  // 9 étapes : la barre défile horizontalement, l'étape courante est centrée
  const curBtn = steps.querySelector('.step.current');
  if (curBtn) { const a = curBtn.getBoundingClientRect(); const b = steps.getBoundingClientRect(); steps.scrollLeft = Math.max(0, steps.scrollLeft + (a.left - b.left) - (b.width - a.width) / 2); }
  if (garden.status === 'validated') {
    header.append(h('a', { class: 'btn btn-sm', href: `#/garden/${encodeURIComponent(garden.id)}/advice` }, 'Conseils'));
  }

  const wsFlag = STEPS[idx].workshop;
  const ws = enterWorkshop(el, {
    header, stepsEl: steps, title, body, footer, steps: STEPS, current: idx, go, garden, startOn: wsFlag === true,
  });

  (async () => {
    body.append(h('p', { class: 'muted' }, 'Chargement…'));
    let mount;
    try {
      mount = await LOADERS[STEP_IDS[idx]]();
      if (typeof mount !== 'function') throw new Error('absent');
    } catch (e) {
      if (dead) return;
      body.replaceChildren(h('p', { class: 'notice' }, 'Écran en cours de chargement. Cette étape n’est pas encore disponible.'));
      return;
    }
    if (dead) return;
    body.replaceChildren();
    try {
      stepUnmount = mount(body, {
        garden,
        onChange: () => save(),
        onValidate: () => onValidate && onValidate(),
        onBack: () => go('plants'),
        navigate,
        workshop: ws,
      });
    } catch (e) {
      console.error(e);
      body.replaceChildren(h('p', { class: 'notice', role: 'alert' }, 'Cette étape a rencontré un problème : ' + (e && e.message ? e.message : e)));
    }
  })();

  return function unmount() {
    dead = true;
    try { if (typeof stepUnmount === 'function') stepUnmount(); } catch (e) { console.error(e); }
    try { ws.leave(); } catch (e) { console.error(e); }
    el.replaceChildren();
  };
}
