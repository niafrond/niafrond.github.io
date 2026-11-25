// Hauteurs réglables (pur, sans DOM) : valeurs par défaut, bornes plausibles, validation et formatage partagés
// par toutes les interfaces et tous les rendus. Unité : mètres (les saisies se font en cm).
// Modèle rétro-compatible : une hauteur absente = valeur par défaut du catalogue.
import { getItemKind } from './items.js';

/** Hauteurs par défaut (m) hors catalogue d'essences. */
export const DEFAULT_HEIGHTS = {
  poolAbove: 1.2, // paroi d'une piscine hors sol
  terrace: 0, // terrasse au sol
  edge: { wall: 2, fence: 1.2, hedge: 1.8 },
  obstacle: { house: 6, shed: 2.5, wall: 2, fence: 1.2, tree: 8 },
  item: {
  bench: 0.85, table: 0.76, table_round: 0.76, chair: 0.85, lounge: 0.8, sunbed: 0.5, parasol: 2.5, hammock: 1.6, bbq: 1.0, firepit: 0.35,
  composter: 0.9, rain_tank: 1.5, planter: 0.55, raised_bed: 0.45, woodpile: 1.0, clothesline: 1.8, mailbox: 1.3, light: 2.2, fountain: 1.0,
  swing: 2.2, trampoline: 0.9, sandbox: 0.3, playhouse: 1.8, shed_item: 2.3, greenhouse: 2, pergola: 2.4, gazebo: 2.5,
  },
};

/** Bornes plausibles [min, max] (m) par catégorie d'élément ou de plante. */
export const HEIGHT_LIMITS = {
  tree: [0.5, 40], fruit: [0.5, 15], shrub: [0.1, 8], hedge: [0.3, 8], climber: [0.2, 15], perennial: [0.05, 3], grass: [0.05, 4],
  bulb: [0.05, 2], groundcover: [0.02, 1], vegetable: [0.05, 3], aquatic: [0.02, 3], lawn: [0.02, 0.5],
  pool: [0.5, 2], terrace: [0, 1.5], wall: [0.3, 6], fence: [0.3, 3], house: [2, 15], shed: [1.5, 5],
  pergola: [1.8, 4], gazebo: [1.8, 4], parasol: [1.5, 4], shed_item: [1.5, 5], greenhouse: [1.2, 5], playhouse: [0.8, 3.5],
  rain_tank: [0.5, 3], swing: [1.5, 4], trampoline: [0.3, 2], light: [0.3, 6], item: [0.05, 5], default: [0.05, 40],
};

/** Bornes [min, max] d'une catégorie (`HEIGHT_LIMITS` ; tout type d'aménagement inconnu = « item »). */
export function heightLimits(kind) {
  if (HEIGHT_LIMITS[kind]) return HEIGHT_LIMITS[kind];
  if (kind && getItemKind(kind)) return HEIGHT_LIMITS.item;
  return HEIGHT_LIMITS.default;
}

const frNum = (v, d = 2) => {
  const s = (Math.round(v * 10 ** d) / 10 ** d).toFixed(d);
  return s.replace('.', ',');
};
const frShort = (v) => String(Math.round(v * 100) / 100).replace('.', ',');

/** « 2,40 m ». */
export function formatHeight(m) {
  return Number.isFinite(Number(m)) ? `${frNum(Number(m))} m` : '—';
}

/** Hauteur en cm entier pour un champ de saisie. */
export const heightToCm = (m) => String(Math.round(Number(m) * 100));

/** Message d'aide : « Hauteur plausible : 0,5 à 40 m ; valeur arrondie ». */
export function heightMessage(kind) {
  const [a, b] = heightLimits(kind);
  return `Hauteur plausible : ${frShort(a)} à ${frShort(b)} m ; valeur arrondie`;
}

/** Saisie → mètres : « 450 » = 4,50 m (cm), « 4,5 m » accepté ; null si illisible. */
export function parseHeight(text) {
  if (typeof text === 'number') return Number.isFinite(text) ? text / 100 : null;
  const s = String(text ?? '').trim().toLowerCase().replace(/\s+/g, '').replace(',', '.');
  if (!s) return null;
  const m = /^(-?\d+(?:\.\d+)?)(cm|m)?$/.exec(s);
  if (!m) return null;
  const v = Number(m[1]);
  if (!Number.isFinite(v)) return null;
  return m[2] === 'm' ? v : v / 100;
}

/** Ramène une hauteur (m) dans les bornes de la catégorie. */
export function clampHeight(kind, value) {
  const [a, b] = heightLimits(kind);
  const v = Number(value);
  if (!Number.isFinite(v)) return a;
  return Math.min(b, Math.max(a, Math.round(v * 100) / 100));
}

/** Validation : {value, ok, clamped, message}. `ok` faux si illisible. */
export function checkHeight(kind, value) {
  const v = Number(value);
  if (!Number.isFinite(v)) return { value: null, ok: false, clamped: false, message: heightMessage(kind) };
  const c = clampHeight(kind, v);
  const clamped = Math.abs(c - Math.round(v * 100) / 100) > 1e-9;
  return { value: c, ok: true, clamped, message: clamped ? heightMessage(kind) : '' };
}

/** Hauteur réglée (m) d'une entité, sinon `defaults` (nombre). 0 est valide (terrasse au sol). */
export function heightOf(entity, defaults) {
  const h = entity ? entity.height : undefined;
  if (h !== undefined && h !== null && h !== '' && Number.isFinite(Number(h)) && Number(h) >= 0 && (Number(h) > 0 || defaults === 0)) return Number(h);
  return Number.isFinite(Number(defaults)) ? Number(defaults) : 0;
}

/** Vrai si la hauteur de l'entité est celle par défaut (absente ou égale à `defaults` au centimètre près). */
export function isDefaultHeight(entity, defaults) {
  const h = entity ? entity.height : undefined;
  if (h === undefined || h === null || h === '') return true;
  return Math.abs(Number(h) - Number(defaults)) < 0.005;
}

/**
 * Enregistre une hauteur validée sur l'entité (clampée) ; la valeur par défaut supprime le champ.
 * @returns {{value:number, clamped:boolean, message:string, isDefault:boolean}}
 */
export function applyHeight(entity, kind, value, defaults, field = 'height') {
  const chk = checkHeight(kind, value);
  if (!chk.ok) return { value: heightOf(entity, defaults), clamped: false, message: chk.message, isDefault: isDefaultHeight(entity, defaults), invalid: true };
  const isDef = Math.abs(chk.value - Number(defaults)) < 0.005;
  if (isDef) delete entity[field]; else entity[field] = chk.value;
  return { value: chk.value, clamped: chk.clamped, message: chk.message, isDefault: isDef };
}

/** Efface la hauteur réglée (retour à la valeur par défaut). */
export function resetHeight(entity, field = 'height') {
  if (entity) delete entity[field];
  return entity;
}

// ─── hauteurs par catégorie d'objet ─────────────────────────────────────────────

/** Hauteur par défaut d'un aménagement (m). */
export const defaultItemHeight = (kindId) => {
  const k = getItemKind(kindId);
  return DEFAULT_HEIGHTS.item[kindId] || (k && k.height) || 0.5;
};
/** Hauteur effective d'un aménagement (m). */
export const itemHeight = (item) => heightOf(item, defaultItemHeight(item && item.kind));

/** Hauteur par défaut d'un obstacle (maison, abri, mur, clôture, arbre). */
export const defaultObstacleHeight = (kind) => DEFAULT_HEIGHTS.obstacle[kind] || 2.3;
export const obstacleHeight = (ob) => heightOf(ob, defaultObstacleHeight(ob && ob.kind));

/** Hauteur de paroi d'une piscine hors sol ou surélévation d'une terrasse (0 sinon). */
export function zoneHeight(zone) {
  if (!zone) return 0;
  if (zone.type === 'pool' && zone.variant === 'above') return heightOf(zone, DEFAULT_HEIGHTS.poolAbove);
  if (zone.type === 'terrace') return heightOf(zone, DEFAULT_HEIGHTS.terrace);
  return 0;
}
export const defaultZoneHeight = (zone) => (zone && zone.type === 'pool' ? DEFAULT_HEIGHTS.poolAbove : zone && zone.type === 'terrace' ? DEFAULT_HEIGHTS.terrace : 0);
/** Clé de bornes pour une zone ('pool' | 'terrace'). */
export const zoneHeightKind = (zone) => (zone && zone.type === 'terrace' ? 'terrace' : 'pool');

/** Bornes d'une essence selon sa catégorie. */
export const plantHeightKind = (plant) => (plant && HEIGHT_LIMITS[plant.category] ? plant.category : 'default');

/** Essence « effective » d'une plantation : hauteur/largeur réglées (m) à la place du catalogue ; même objet si aucun réglage. */
export function effectivePlant(plant, planting) {
  if (!plant || !planting) return plant;
  const h = Number(planting.height); const w = Number(planting.width);
  const hh = Number.isFinite(h) && h > 0; const ww = Number.isFinite(w) && w > 0;
  if (!hh && !ww) return plant;
  return { ...plant, heightAdult: hh ? h : plant.heightAdult, widthAdult: ww ? w : plant.widthAdult };
}

/** Hauteur adulte retenue (m) pour une plantation : réglée sinon catalogue. */
export const plantingHeight = (plant, planting) => {
  const h = Number(planting && planting.height);
  return Number.isFinite(h) && h > 0 ? h : Number(plant && plant.heightAdult) || 0;
};
