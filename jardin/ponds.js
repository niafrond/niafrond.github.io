// Mares : profondeur, adéquation d'une essence à la taille de la mare, couverture et quantités (pur).
import { shapeArea } from './geometry.js';
import POND_TAGS from './data/plants/pond-tags.js';

const WATER_ROLES = new Set(['flottante', 'oxygenante']);
/** Part de la surface de la mare qu'un rôle peut raisonnablement occuper. */
const COVER = { flottante: 0.5, oxygenante: 0.3, bordure: 0.25, berge: 0.2, marais: 0.2 };
/** Au-delà de cette surface, une essence très colonisatrice (`spread: 'fort'`) reste raisonnable. */
export const STRONG_SPREAD_MIN_AREA = 20;

const r1 = (n) => Math.round(n * 10) / 10;
const fmt = (n) => String(r1(n)).replace('.', ',');

export const pondTag = (plant) => (plant && POND_TAGS[plant.id]) || null;
export const pondTaggedIds = () => Object.keys(POND_TAGS);

/** Surface de la mare (m²). */
export function pondArea(zone) {
  try { return zone && zone.shape ? shapeArea(zone.shape) : 0; } catch { return 0; }
}

/** Profondeur estimée d'après la surface : < 2 m² → 40 cm, < 6 → 60, < 20 → 80, sinon 100. */
export function estimatePondDepth(area) {
  return area < 2 ? 40 : area < 6 ? 60 : area < 20 ? 80 : 100;
}

/** Profondeur moyenne (cm) : `zone.depth` si valide, sinon estimée d'après la surface. */
export function pondDepth(zone) {
  const d = Number(zone && zone.depth);
  return Number.isFinite(d) && d > 0 ? Math.round(d) : estimatePondDepth(pondArea(zone));
}

/** Adéquation à partir de valeurs numériques (surface m², profondeur cm). */
export function pondFitFor(plant, area, depth) {
  const tag = pondTag(plant);
  if (!tag) return { ok: true, level: 'ok', reasons: [] };
  const reasons = [];
  let level = 'ok';
  const worse = (l) => { if (l === 'forbid' || (l === 'avoid' && level === 'ok')) level = l; };
  const name = plant.commonName || plant.id;

  if (plant.invasive) {
    worse('forbid');
    reasons.push(`${name} est une plante invasive : interdite en mare, elle envahit les milieux naturels`);
  }
  if (area < tag.minArea - 1e-9) {
    worse(area < tag.minArea * 0.6 ? 'forbid' : 'avoid');
    if (!plant.invasive) reasons.push(`Trop grande pour cette mare (${fmt(area)} m² ; il faut ≥ ${fmt(tag.minArea)} m²)`);
  }
  if (WATER_ROLES.has(tag.role) && Number.isFinite(tag.minDepth) && depth < tag.minDepth - 1e-9) {
    worse(depth < tag.minDepth * 0.75 ? 'forbid' : 'avoid');
    reasons.push(`Mare trop peu profonde pour ${plant.id === 'h-nenuphar' ? 'ce nénuphar' : 'cette plante'} (${depth} cm ; il faut ≥ ${tag.minDepth} cm)`);
  }
  if (tag.spread === 'fort' && area < STRONG_SPREAD_MIN_AREA && !plant.invasive) {
    worse('avoid');
    reasons.push(`Très colonisatrice : elle envahirait une mare de moins de ${STRONG_SPREAD_MIN_AREA} m²`);
  }
  return { ok: level === 'ok', level, reasons };
}

/** `{ok, level:'ok'|'avoid'|'forbid', reasons}` : l'essence convient-elle à cette mare ? */
export function pondFit(plant, zone) {
  return pondFitFor(plant, pondArea(zone), pondDepth(zone));
}

/** Part de la surface de la mare (0–1) que l'essence peut raisonnablement couvrir ; 0 si non étiquetée. */
export function pondCoverage(plant, zone) {
  const tag = pondTag(plant);
  if (!tag) return 0;
  return COVER[tag.role] || 0.2;
}

/** Quantité raisonnable d'une essence dans cette mare (≥ 1). */
export function pondPlantQuantity(plant, zone) {
  const tag = pondTag(plant);
  const area = pondArea(zone);
  if (!tag || area <= 0) return 1;
  if (tag.role === 'oxygenante') return Math.max(1, Math.min(30, Math.round(area * pondCoverage(plant, zone) / 0.5)));
  const sp = plant.spacing > 0 ? plant.spacing : plant.widthAdult > 0 ? plant.widthAdult : 1;
  const footprint = tag.role === 'flottante' ? Math.PI * ((plant.widthAdult || sp) / 2) ** 2 : sp * sp;
  return Math.max(1, Math.floor(pondCoverage(plant, zone) * area / footprint + 1e-9));
}
