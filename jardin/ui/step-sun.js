// Étape 4 : ensoleillement (inconnu / uniforme / peint / estimé).
import { h, toast } from './wizard.js';
import { estimateSunMap } from '../sun.js';
import { newId } from '../model.js';

const LEVELS = [
  ['full', '☀️ Plein soleil (6 h ou plus)'],
  ['partial', '⛅ Mi-ombre (3 à 6 h)'],
  ['shade', '☁️ Ombre (moins de 3 h)'],
];
const MODES = [
  ['unknown', 'Je ne sais pas', 'Aucune essence n’est exclue sur ce critère, mais un avertissement s’affichera.'],
  ['uniform', 'Un seul niveau pour tout le jardin', 'Mode rapide.'],
  ['map', 'Je peins les zones sur le plan', 'Pinceau ou polygone, avec légende.'],
  ['estimated', 'Estimer automatiquement', 'Calcul approximatif selon la position, l’exposition et les obstacles saisis. À corriger à la main.'],
];

export function mountSun(el, { garden, onChange }) {
  if (!garden.sun) garden.sun = { mode: 'unknown', uniform: null, regions: [] };
  const sun = garden.sun;
  let view = sun.mode === 'map' ? 'map' : sun.mode === 'uniform' ? 'uniform' : 'unknown';
  let unmountPainter = null;
  let dead = false;
  const detail = h('div', { class: 'sun-detail' });
  const change = () => onChange && onChange(garden);

  function clearPainter() { if (unmountPainter) { try { unmountPainter(); } catch { /* */ } unmountPainter = null; } }

  async function showPainter(host) {
    try {
      const { mountSunPainter } = await import('./draw.js');
      if (dead) return;
      unmountPainter = mountSunPainter(host, { garden, onChange: change });
    } catch {
      host.replaceChildren(h('p', { class: 'notice' }, 'Écran en cours de chargement. Le pinceau d’ensoleillement n’est pas encore disponible.'));
    }
  }

  function estimate() {
    if (!garden.boundary || garden.boundary.length < 3) { toast('Tracez d’abord le contour du terrain (étape 2).'); return false; }
    if (!garden.context.location) { toast('Renseignez d’abord la localisation (étape 1) pour estimer le soleil.'); return false; }
    try {
      const regions = estimateSunMap(garden, { date: new Date() }) || [];
      sun.mode = 'map';
      sun.uniform = null;
      sun.regions = regions.map((r) => ({ id: newId(), level: r.level, points: r.points }));
      change();
      return true;
    } catch (e) { toast('Estimation impossible : ' + (e && e.message ? e.message : 'erreur')); return false; }
  }

  function draw() {
    clearPainter();
    detail.replaceChildren();
    if (view === 'unknown') {
      sun.mode = 'unknown'; sun.uniform = null;
    } else if (view === 'uniform') {
      sun.mode = 'uniform';
      detail.append(h('fieldset', { class: 'card' }, h('legend', null, 'Ensoleillement du jardin'),
        LEVELS.map(([v, l]) => h('label', { class: 'check' },
          h('input', { type: 'radio', name: 'sunlevel', value: v, checked: sun.uniform === v, onchange: () => { sun.uniform = v; change(); } }), h('span', null, l)))));
    } else {
      sun.mode = 'map';
      if (view === 'estimated') {
        detail.append(h('p', { class: 'notice' }, 'Estimation approximative : corrigez-la au pinceau si vous connaissez mieux votre jardin (ombre des voisins, arbres…).'));
      }
      const host = h('div', { class: 'painter' });
      detail.append(host);
      showPainter(host);
    }
    change();
  }

  const modeBoxes = MODES.map(([id, label, hint]) => h('label', { class: 'check block' },
    h('input', {
      type: 'radio', name: 'sunmode', value: id, checked: (id === 'estimated' ? false : id === view),
      onchange: () => {
        if (id === 'estimated') {
          if (!estimate()) { renderRadios(); return; }
          view = 'estimated';
        } else view = id;
        draw();
      },
    }), h('span', null, h('strong', null, label), h('br'), h('small', { class: 'muted' }, hint))));
  function renderRadios() {
    modeBoxes.forEach((lab) => {
      const i = lab.querySelector('input');
      i.checked = i.value === view || (i.value === 'map' && view === 'estimated' && false);
    });
  }

  el.replaceChildren(
    h('section', { class: 'card' },
      h('h2', null, 'Ensoleillement (facultatif)'),
      h('p', { class: 'muted' }, 'Il sert à filtrer et à noter les essences. Vous pouvez passer cette étape.'),
      h('fieldset', { class: 'modes' }, h('legend', { class: 'sr-only' }, 'Mode de saisie'), modeBoxes)),
    detail);
  // Ne modifie pas le garden au simple affichage de l'étape.
  if (view === 'uniform') {
    detail.append(h('fieldset', { class: 'card' }, h('legend', null, 'Ensoleillement du jardin'),
      LEVELS.map(([v, l]) => h('label', { class: 'check' },
        h('input', { type: 'radio', name: 'sunlevel', value: v, checked: sun.uniform === v, onchange: () => { sun.uniform = v; change(); } }), h('span', null, l)))));
  } else if (view === 'map') {
    const host = h('div', { class: 'painter' });
    detail.append(host);
    showPainter(host);
  }
  return () => { dead = true; clearPainter(); el.replaceChildren(); };
}
