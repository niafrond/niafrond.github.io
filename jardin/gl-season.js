// Saisons de la vue 3D : état saisonnier d'une plante, du sol et de la lumière selon le jour de l'année (pur, sans three.js).
import { isWoody, isDeciduousWoody, hashStr } from './gl-worker-core.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const SAISONS = ['hiver', 'printemps', 'été', 'automne'];
/** Jours de l'année représentatifs des 4 saisons (curseur et puces) : 15 janvier, 15 avril, 21 juin, 15 octobre. */
export const SEASON_DOY = { hiver: 15, printemps: 105, été: 172, automne: 288 };

/** Jour de l'année (1–366) d'une date (calendrier local). */
export function dayOfYear(d) {
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 86400000);
}
/** Jour de l'année « saisonnier » : décalé de 6 mois dans l'hémisphère sud. */
export const seasonDoy = (doy, lat = 46.5) => (lat < 0 ? ((Math.floor(doy) + 181) % 365) + 1 : doy);

/** Saison astronomique approchée : 'hiver' | 'printemps' | 'été' | 'automne'. */
export function seasonName(doy, lat = 46.5) {
  const d = seasonDoy(doy, lat);
  if (d >= 356 || d < 80) return 'hiver';
  if (d < 172) return 'printemps';
  if (d < 266) return 'été';
  return 'automne';
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
/** « Printemps · 15 avril » */
export function seasonLabel(date, lat = 46.5) {
  return `${cap(seasonName(dayOfYear(date), lat))} · ${date.getDate()} ${MOIS[date.getMonth()]}`;
}

/** Couleurs d'automne (jaune, orange, rouge) choisies de façon stable par essence. */
export const AUTUMN_HUES = ['#e2c13a', '#d9822b', '#b5381f'];
export const autumnHue = (plant) => AUTUMN_HUES[hashStr(String(plant.id)) % 3];

// Calendrier du feuillage des caducs (jour de l'année)
const BUD0 = 88; const BUD1 = 135; // débourrement
const COL0 = 272; const COL1 = 318; // coloration d'automne
const FALL0 = 300; const FALL1 = 345; // chute des feuilles

function woodyLeaf(doy) {
  const grow = doy < 200 ? smooth(BUD0, BUD1, doy) : 1 - smooth(FALL0, FALL1, doy);
  return {
    density: grow,
    spring: doy < 200 ? 1 - smooth(BUD0 + 8, BUD1 + 28, doy) : 0,
    tint: doy >= 200 ? smooth(COL0, COL1, doy) : 0,
  };
}
/** Facteur de hauteur / vigueur des herbacées caduques (repos hivernal 0,22 → 1). */
export function dormancy(doy) {
  if (doy <= 60) return 0.22;
  if (doy < 110) return 0.22 + 0.78 * smooth(60, 110, doy);
  if (doy <= 300) return 1;
  if (doy < 335) return 1 - 0.78 * smooth(300, 335, doy);
  return 0.22;
}

/** Intensité de floraison (0–1) : plateau sur les mois de `bloom`, fondu d'apparition/disparition de 0,3 mois aux extrémités. */
export function flowerAmount(bloom, doy) {
  if (!bloom || !bloom.length) return 0;
  const set = new Set(bloom);
  const p = ((doy - 0.5) / 365.25) * 12; // 0..12
  const idx = Math.floor(p);
  const k = (idx % 12) + 1; const frac = p - idx;
  if (!set.has(k)) return 0;
  const prev = ((k + 10) % 12) + 1; const next = (k % 12) + 1;
  let v = 1;
  if (!set.has(prev)) v = Math.min(v, smooth(0, 0.3, frac));
  if (!set.has(next)) v = Math.min(v, smooth(0, 0.3, 1 - frac));
  return v;
}

/**
 * État saisonnier d'une plante au jour `doy`.
 * @returns {{kind:'evergreen'|'woody'|'herb', leafDensity:number, spring:number, tint:number, hue:string, scaleY:number, bare:boolean, flower:number}}
 *   leafDensity : fraction du feuillage (0 = branches nues) ; spring : vert tendre (0–1) ; tint : virage d'automne (0–1) vers `hue` ;
 *   scaleY : repos des herbacées ; flower : fondu des fleurs (0 = aucune).
 */
export function plantSeasonState(plant, doy) {
  const out = { kind: 'evergreen', leafDensity: 1, spring: 0, tint: 0, hue: autumnHue(plant), scaleY: 1, bare: false, flower: flowerAmount(plant.bloom, doy) };
  if (isWoody(plant)) {
    if (isDeciduousWoody(plant)) {
      const w = woodyLeaf(doy);
      Object.assign(out, { kind: 'woody', leafDensity: w.density, spring: w.spring, tint: w.tint });
    } else if (plant.foliage === 'semi' && plant.category !== 'hedge' && !/conifer/.test(plant.category)) {
      const w = woodyLeaf(doy);
      Object.assign(out, { kind: 'woody', leafDensity: 0.55 + 0.45 * w.density, spring: w.spring * 0.5, tint: w.tint * 0.3 });
    }
  } else if (plant.foliage === 'deciduous' && plant.category !== 'lawn') {
    const d = dormancy(doy);
    Object.assign(out, { kind: 'herb', scaleY: d, tint: 1 - d });
  } else if (plant.foliage === 'semi' && plant.category !== 'lawn') {
    const d = dormancy(doy);
    Object.assign(out, { kind: 'herb', scaleY: 0.6 + 0.4 * d, tint: (1 - d) * 0.5 });
  }
  out.bare = out.kind === 'woody' && out.leafDensity < 0.04;
  return out;
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = (c) => `#${c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('')}`;
export const mixHex = (a, b, t) => { const x = hex(a); const y = hex(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };

const LAWN_KEYS = [[0, '#d2dbc8'], [60, '#dfe8cc'], [105, '#ffffff'], [165, '#f0f4dc'], [215, '#eceed2'], [270, '#efeac6'], [320, '#dcdfc3'], [365, '#d2dbc8']];
/**
 * Teinte du sol selon la saison (multipliée avec la texture) : vert vif au printemps, vert doux l'été,
 * paille en plein été sec (`dry` 0–1 : sécheresse propre à chaque jardin), terne l'hiver.
 */
export function groundState(doy, dry = 0.4) {
  let a = LAWN_KEYS[0]; let b = LAWN_KEYS[1];
  for (let i = 1; i < LAWN_KEYS.length; i++) { if (doy <= LAWN_KEYS[i][0]) { a = LAWN_KEYS[i - 1]; b = LAWN_KEYS[i]; break; } }
  let c = mixHex(a[1], b[1], (doy - a[0]) / (b[0] - a[0] || 1));
  const summer = smooth(180, 215, doy) * (1 - smooth(250, 285, doy));
  c = mixHex(c, '#e8d48c', clamp(dry, 0, 1) * summer * 0.75);
  return { lawnTint: c, groundTint: mixHex(c, '#ffffff', 0.15), dryness: clamp(dry, 0, 1) * summer };
}

/** Chaleur de la lumière : +1 au solstice d'été, −1 au solstice d'hiver. */
export const seasonWarmth = (doy) => Math.cos(((doy - 172) / 365) * Math.PI * 2);
/** Intensité de la chute de feuilles (0–1) pour les particules : pic mi-novembre. */
export const leafFall = (doy) => smooth(285, 312, doy) * (1 - smooth(338, 355, doy));

/** Fructification (0–1) des arbres et arbustes fruitiers : mûrissement de juillet à octobre, chute en novembre. */
export function fruitAmount(plant, doy) {
  if (!plant || (plant.category !== 'fruit' && plant.habit !== 'vegetable-climbing')) return 0;
  return smooth(180, 220, doy) * (1 - smooth(300, 335, doy));
}
