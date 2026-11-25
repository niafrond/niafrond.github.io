// Budget indicatif des plantations (pur) : prix moyens en jardinerie, à titre indicatif.
import { shapeArea } from './geometry.js';

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
function group(intStr) { return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

/** « 12,50 € » (arrondi au centime) ; `digits` : 0 pour « 340 € ». */
export function formatEuro(n, { digits = 2 } = {}) {
  let v = Number(n);
  if (!Number.isFinite(v)) v = 0;
  const k = 10 ** digits;
  v = Math.round((Math.abs(v) + Number.EPSILON) * k) / k * (v < 0 ? -1 : 1);
  const neg = v < 0;
  const [i, d] = Math.abs(v).toFixed(digits).split('.');
  return `${neg ? '−' : ''}${group(i)}${d ? ',' + d : ''} €`;
}

/** Prix unitaire sans zéros inutiles : 12 → « 12 € », 0,5 → « 0,5 € », 6,75 → « 6,75 € ». */
export function formatPrice(n) {
  const v = round2(Number(n) || 0);
  const s = String(v).replace('.', ',');
  return `${s} €`;
}

export const UNIT_LABEL = { plant: 'plant', bulb: 'bulbe', m2: 'm²' };

const hasPrice = (p) => !!p && typeof p.priceEur === 'number' && Number.isFinite(p.priceEur) && p.priceEur >= 0;

const lookupOf = (plantsById) => (id) => {
  if (!plantsById) return null;
  if (typeof plantsById === 'function') return plantsById(id) || null;
  if (plantsById instanceof Map) return plantsById.get(id) || null;
  return plantsById[id] || null;
};

/** Coût d'une plantation : {qty, unit, unitPrice, total} ou null si la plante n'a pas de prix. */
export function plantCost(plant, planting, zone) {
  if (!hasPrice(plant)) return null;
  const unit = plant.priceUnit === 'bulb' || plant.priceUnit === 'm2' ? plant.priceUnit : 'plant';
  let qty;
  if (unit === 'm2') {
    let a = 0;
    try { a = zone && zone.shape ? shapeArea(zone.shape) : 0; } catch { a = 0; }
    qty = round2(a);
  } else {
    const c = Math.round(Number(planting && (planting.count ?? planting.quantity)));
    qty = Number.isFinite(c) && c > 0 ? c : 1;
  }
  return { qty, unit, unitPrice: plant.priceEur, total: round2(qty * plant.priceEur) };
}

/** Coût d'une zone : {zoneId, label, total, lines:[{plantId, plant, qty, unit, unitPrice, total}], unknownCount}. */
export function zoneCost(zone, plantsById) {
  const get = lookupOf(plantsById);
  const lines = [];
  let total = 0;
  let unknownCount = 0;
  for (const pl of (zone && zone.plantings) || []) {
    const plant = get(pl.plantId);
    const c = plantCost(plant, pl, zone);
    if (!c) { unknownCount++; continue; }
    lines.push({ plantId: pl.plantId, plant, ...c });
    total += c.total;
  }
  return { zoneId: zone && zone.id, label: (zone && zone.label) || '', total: round2(total), lines, unknownCount };
}

/** Coût du jardin : {total, byZone:[{zoneId,label,total,lines,unknownCount}], unknownCount}. */
export function gardenCost(garden, plantsById) {
  const byZone = ((garden && garden.zones) || []).map((z) => zoneCost(z, plantsById));
  return {
    total: round2(byZone.reduce((s, z) => s + z.total, 0)),
    byZone,
    unknownCount: byZone.reduce((s, z) => s + z.unknownCount, 0),
  };
}

/** Plage de floraison « de mars à octobre » à partir de tous les mois. */
export function bloomRangeText(months) {
  const ms = [...new Set(months)].filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b);
  if (!ms.length) return '';
  return ms.length === 1 ? `floraison en ${MONTHS[ms[0] - 1]}` : `floraison de ${MONTHS[ms[0] - 1]} à ${MONTHS[ms[ms.length - 1] - 1]}`;
}

/** Résumé d'un jardin : « 8 essences, floraison de mars à octobre, ≈ 210 € ». */
export function summarizeGarden(garden, plantsById) {
  const get = lookupOf(plantsById);
  const ids = new Set();
  const months = [];
  for (const z of (garden && garden.zones) || []) {
    for (const pl of z.plantings || []) {
      ids.add(pl.plantId);
      const p = get(pl.plantId);
      if (p) months.push(...(p.bloom || []));
    }
  }
  const cost = gardenCost(garden, plantsById);
  const parts = [`${ids.size} essence${ids.size > 1 ? 's' : ''}`];
  const bl = bloomRangeText(months);
  if (bl) parts.push(bl);
  parts.push(`≈ ${formatEuro(cost.total, { digits: 0 })}`);
  return { species: ids.size, total: cost.total, unknownCount: cost.unknownCount, text: parts.join(', ') };
}
