// Fenêtre « Orienter le plan » : règle où se trouve le nord par rapport au HAUT du plan.
// Convention : context.northAngle = rotation horaire du nord par rapport au haut (0 = nord en haut) ;
// context.orientation = (360 − northAngle) % 360 (azimut de ce qui est en haut du plan).
import { h, injectStyles, parseNum, normAngle, createNorthRose, createNorthBadge, northLabel } from './draw-util.js';
import { watchHeading } from '../geo.js';

/**
 * Enregistre l'angle du nord dans `context` (une seule logique pour les deux champs).
 * @returns {number|null} l'angle normalisé (0–359), ou null si `deg` est illisible (contexte inchangé)
 */
export function setNorthAngle(context, deg) {
  const a = normAngle(deg);
  if (!context || !Number.isFinite(a)) return null;
  context.northAngle = a;
  context.orientation = (360 - a) % 360;
  return a;
}

/** Le jardin a-t-il une orientation renseignée ? (pastille « inconnue » sinon) */
export function northKnown(garden) {
  const c = garden && garden.context;
  return !!c && (c.orientation != null || (Number(c.northAngle) || 0) !== 0 || !!c.gpsOrigin);
}

const PRESETS = [
  ['north-up', 'Nord en haut ↑', 0],
  ['north-right', 'Nord à droite →', 90],
  ['north-down', 'Nord en bas ↓', 180],
  ['north-left', 'Nord à gauche ←', 270],
];
const COMPASS_TIMEOUT_MS = 3000;

/**
 * Ouvre la fenêtre de réglage dans `container` (élément positionné, ex. jd-canvas-wrap).
 * @param {HTMLElement} container
 * @param {{garden:object, onChange?:(garden:object)=>void}} o
 * @returns {{close:()=>void, el:HTMLElement}}
 */
export function openNorthDialog(container, { garden, onChange } = {}) {
  injectStyles();
  const ctx = (garden.context = garden.context || {});
  container.querySelectorAll('[data-role=north-dialog]').forEach((n) => n.remove());
  let draft = normAngle(ctx.northAngle) || 0;
  let stopCompass = null;
  let timer = null;

  const rose = createNorthRose();
  const caption = h('div', { class: 'jd-north-cap', 'aria-live': 'polite' });
  const status = h('div', { class: 'jd-north-status', role: 'status', 'aria-live': 'polite' });
  const input = h('input', { class: 'jd-input jd-pop-input', type: 'text', inputmode: 'numeric', value: String(draft), 'aria-label': 'Angle du nord en degrés', enterkeyhint: 'done', 'data-field': 'north-angle' });
  const el = h('div', { class: 'jd-pop jd-north-pop', role: 'dialog', 'aria-modal': 'false', 'aria-label': 'Orienter le plan', 'data-role': 'north-dialog' });

  const show = () => { rose.set(draft, true); caption.textContent = `${northLabel(draft)} (${draft}°)`; };
  const setStatus = (t, warn = false) => { status.textContent = t; status.classList.toggle('warn', warn); };
  const stopLive = () => { if (stopCompass) { stopCompass(); stopCompass = null; } if (timer) { clearTimeout(timer); timer = null; } };
  const close = () => { stopLive(); el.remove(); };
  const commit = (deg) => {
    const a = setNorthAngle(ctx, deg);
    if (a == null) { input.classList.add('bad'); setStatus('Saisissez un angle entre 0 et 359 degrés.', true); input.focus(); return false; }
    close();
    if (onChange) onChange(garden);
    return true;
  };

  input.addEventListener('input', () => {
    const v = parseNum(input.value);
    input.classList.toggle('bad', !Number.isFinite(v));
    if (Number.isFinite(v)) { draft = normAngle(v); show(); }
  });

  const presetBtns = PRESETS.map(([act, label, deg]) => h('button', { type: 'button', class: 'jd-btn', 'data-act': act, onclick: () => commit(deg) }, label));

  function startCompass() {
    stopLive();
    const loc = ctx.location;
    let got = false;
    const begin = () => {
      stopCompass = watchHeading((hd) => {
        got = true;
        if (timer) { clearTimeout(timer); timer = null; }
        draft = normAngle(360 - hd); // le haut du plan pointe vers le cap hd : le nord est à (360 − cap)
        input.value = String(draft); input.classList.remove('bad'); show();
        setStatus(`Cap du haut du plan : ${Math.round(hd)}°. Touchez « Valider » quand l'aiguille est stable.`);
      }, loc && Number.isFinite(loc.lat) ? { lat: loc.lat, lon: loc.lon } : {});
      setStatus('Placez le haut du plan face à vous : tenez le téléphone à plat, orienté comme le plan, puis touchez « Valider ».');
      timer = setTimeout(() => {
        timer = null;
        if (!got) { stopLive(); setStatus('Boussole indisponible sur cet appareil (ou accès refusé). Choisissez un bouton ci-dessus ou saisissez l\'angle.', true); }
      }, COMPASS_TIMEOUT_MS);
    };
    try {
      const D = globalThis.DeviceOrientationEvent;
      if (D && typeof D.requestPermission === 'function') {
        D.requestPermission().then((r) => { if (r === 'granted') begin(); else setStatus('Accès à la boussole refusé : réglez le nord avec les boutons ou en saisissant l\'angle.', true); })
          .catch(() => setStatus('Boussole indisponible sur cet appareil.', true));
      } else if (globalThis.window && 'ondeviceorientation' in globalThis.window) begin();
      else setStatus('Boussole indisponible sur cet appareil : choisissez un bouton ci-dessus ou saisissez l\'angle.', true);
    } catch { setStatus('Boussole indisponible sur cet appareil.', true); }
  }

  el.append(...[
    h('div', { class: 'jd-pop-title' }, 'Orienter le plan'),
    h('div', { class: 'jd-north-prev' }, rose.el, caption),
    h('div', { class: 'jd-pop-hint' }, 'Où est le nord par rapport au haut du plan ?'),
    h('div', { class: 'jd-north-grid' }, presetBtns),
    h('div', { class: 'jd-pop-row' }, h('label', {}, 'Angle'), input, h('span', { class: 'jd-unit' }, '°')),
    h('div', { class: 'jd-pop-hint' }, 'Degrés, de 0 à 359, dans le sens des aiguilles d\'une montre : 0 = nord en haut, 90 = nord à droite.'),
    h('button', { type: 'button', class: 'jd-btn', style: { width: '100%' }, 'data-act': 'north-compass', onclick: startCompass }, '🧭 Utiliser la boussole du téléphone'),
    status,
    garden.context.gpsOrigin ? h('div', { class: 'jd-pop-hint' }, 'Ce plan vient d\'un relevé GPS : le nord y est en haut. Ne le changez que si vous savez ce que vous faites.') : null,
    h('div', { class: 'jd-row' },
      h('button', { type: 'button', class: 'jd-btn primary', 'data-act': 'north-ok', onclick: () => commit(parseNum(input.value)) }, 'Valider'),
      h('button', { type: 'button', class: 'jd-btn', 'data-act': 'north-cancel', onclick: close }, 'Annuler')),
  ].filter(Boolean));
  el.onkeydown = (e) => {
    if (e.key === 'Enter' && e.target === input) { e.preventDefault(); commit(parseNum(input.value)); } else if (e.key === 'Escape') { e.preventDefault(); close(); }
  };
  container.appendChild(el);
  show();
  return { close, el };
}

/**
 * Pastille du nord d'un éditeur + ouverture du réglage au toucher.
 * `getAngle`/`getKnown` peuvent être surchargés (relevé GPS : nord en haut).
 * @returns {{update:()=>void, destroy:()=>void, el:HTMLElement}}
 */
export function attachNorthBadge(wrap, { garden, onChange, getAngle, getKnown } = {}) {
  let badge = null;
  badge = createNorthBadge(wrap, {
    getAngle: getAngle || (() => Number(garden.context && garden.context.northAngle) || 0),
    getKnown: getKnown || (() => northKnown(garden)),
    onClick: () => openNorthDialog(wrap, { garden, onChange: (g) => { if (onChange) onChange(g); badge.update(); } }),
  });
  return {
    update: badge.update,
    el: badge.el,
    destroy: () => { badge.destroy(); wrap.querySelectorAll('[data-role=north-dialog]').forEach((n) => n.remove()); },
  };
}
