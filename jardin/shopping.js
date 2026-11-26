// Listes de courses de plantation (pur, sans DOM) : plantes groupées par format d'achat et par catégorie, par zone,
// par période de plantation, fournitures estimées (terreau, paillage, engrais, tuteurs…) et aménagements à acheter.
// Les totaux de plantes reprennent EXACTEMENT les calculs de `pricing.js` (`plantCost`), donc = `gardenCost`.
// Tous les prix sont des moyennes indicatives en jardinerie (France, € TTC) ; les quantités sont arrondies au sac / lot.
import { allPlants } from './catalog.js';
import { plantCost, formatEuro } from './pricing.js';
import { shapeArea } from './geometry.js';
import { getItemKind } from './items.js';
import { itemHeight } from './heights.js';

export const LOSS_MARGIN = 0.1; // marge conseillée pour les pertes (non incluse dans les totaux)
export const SHOPPING_NOTE = 'Prix moyens en jardinerie, à titre indicatif : vérifiez les stocks et les tailles de pots. Ajustez les quantités de 10 % pour compenser les pertes.';

/** Constantes des fournitures (documentées) : quantités unitaires et conditionnements. */
export const SUPPLY = {
  compostLPerM2Bed: 10, // L de terreau / compost par m² de massif
  compostLPerWoody: 20, // L par arbre, arbuste, haie ou grimpante planté en fosse
  compostBagL: 40, compostBagPrice: 6.9,
  mulchDepthM: 0.05, // 5 cm
  mulchBagL: 50, mulchBagPrice: 5.5,
  fertKgPerWoody: 0.1, fertKgPerOther: 0.03, // corne broyée / engrais organique de plantation
  fertBagKg: 2, fertBagPrice: 8.5,
  stakePrice: 4.5, // tuteur d'arbre
  tiesPack: 10, tiesPackPrice: 4.5, // attaches par lot
  trellisPrice: 18, // treillage ou fils par grimpante
  hedgeStakeEvery: 4, hedgeStakePrice: 2.5, // un piquet toutes les 4 plantes de haie
  cardboardPricePerM2: 1.2, // carton brun ou géotextile
  waterLTree: 30, waterLShrub: 15, waterLSmall: 5, waterRounds: 10, // arrosage de reprise (L par plant et par arrosage, nb d'arrosages)
};

export const SHOP_GROUPS = [
  { id: 'trees', label: 'Arbres et fruitiers', cats: ['tree', 'fruit'] },
  { id: 'shrubs', label: 'Arbustes et haies', cats: ['shrub', 'hedge'] },
  { id: 'climbers', label: 'Grimpantes', cats: ['climber'] },
  { id: 'perennials', label: 'Vivaces et graminées', cats: ['perennial', 'grass'] },
  { id: 'groundcover', label: 'Couvre-sols', cats: ['groundcover'] },
  { id: 'bulbs', label: 'Bulbes', cats: ['bulb'] },
  { id: 'aquatic', label: 'Plantes aquatiques', cats: ['aquatic'] },
  { id: 'vegetable', label: 'Potager (godets et semis)', cats: ['vegetable'] },
  { id: 'lawn', label: 'Gazon (semences ou rouleaux)', cats: ['lawn'] },
];
const WOODY = new Set(['tree', 'fruit', 'shrub', 'hedge', 'climber']);
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

let defMap = null;
const defaultLookup = (id) => { if (!defMap) defMap = new Map(allPlants().map((p) => [p.id, p])); return defMap.get(id) || null; };
const lookupOf = (l) => (typeof l === 'function' ? l : l instanceof Map ? (id) => l.get(id) || null : l ? (id) => l[id] || null : defaultLookup);
const zoneArea = (z) => { try { return z && z.shape ? shapeArea(z.shape) || 0 : 0; } catch { return 0; } };
const zoneLabelOf = (z, i) => z.label || `Zone ${i + 1}`;

/** « oct. à nov. » à partir de mois (suites consécutives réunies : « mars à mai, sept. »). */
export function monthsText(months) {
  const ms = [...new Set((months || []).filter((m) => m >= 1 && m <= 12))].sort((a, b) => a - b);
  if (!ms.length) return '';
  const runs = []; let s = ms[0]; let p = ms[0];
  for (const m of ms.slice(1)) { if (m === p + 1) { p = m; continue; } runs.push([s, p]); s = m; p = m; }
  runs.push([s, p]);
  return runs.map(([a, b]) => (a === b ? MONTHS_SHORT[a - 1] : `${MONTHS_SHORT[a - 1]} à ${MONTHS_SHORT[b - 1]}`)).join(', ');
}

const groupOf = (plant) => SHOP_GROUPS.find((g) => g.cats.includes(plant.category)) || SHOP_GROUPS[3];
const formatOf = (plant) => (plant.priceNote && String(plant.priceNote).trim()) || (plant.priceUnit === 'bulb' ? 'bulbe' : plant.priceUnit === 'm2' ? 'au m²' : 'plant');

/** Mois de plantation d'une essence (fiche, sinon vide). */
export const plantMonthsOf = (plant) => (plant && plant.care && Array.isArray(plant.care.plantMonths) ? plant.care.plantMonths : []);

function newLine(plant, format) {
  return { plantId: plant.id, plant, format, qty: 0, unit: 'plant', unitPrice: null, total: 0, priced: true, zoneIds: [], plantMonths: plantMonthsOf(plant) };
}

/**
 * Liste de courses. `zoneNumbers` : Map(zoneId → n) pour citer les zones.
 * → {groups:[{id,label,formats:[{format, lines}], lines, subtotal}], byZone:[{zoneId,label,n,lines,total}], total, unknownCount, plantCount}
 * `lines` : {plantId, plant, format, qty, unit('plant'|'bulb'|'m2'), unitPrice (null = sans prix), total, zoneIds, plantMonths}.
 */
export function shoppingList(garden, plantsById) {
  const lookup = lookupOf(plantsById);
  const zones = (garden && garden.zones) || [];
  const byPlant = new Map();
  const byZone = [];
  let unknownCount = 0; let plantCount = 0;
  zones.forEach((z, zi) => {
    const zl = { zoneId: z.id, label: zoneLabelOf(z, zi), n: zi + 1, lines: new Map(), total: 0 };
    for (const pl of z.plantings || []) {
      const plant = lookup(pl.plantId);
      if (!plant) continue;
      const c = plantCost(plant, pl, z);
      const count = Math.max(1, Math.round(Number(pl.count) || 1));
      if (plant.category !== 'lawn') plantCount += count;
      for (const [map, key] of [[byPlant, plant.id], [zl.lines, plant.id]]) {
        let ln = map.get(key);
        if (!ln) { ln = newLine(plant, formatOf(plant)); map.set(key, ln); }
        if (c) { ln.qty = round2(ln.qty + c.qty); ln.unit = c.unit; ln.unitPrice = c.unitPrice; ln.total = round2(ln.total + c.total); }
        else { ln.priced = false; ln.qty = round2(ln.qty + count); }
        if (!ln.zoneIds.includes(z.id)) ln.zoneIds.push(z.id);
      }
      if (!c) unknownCount++;
      zl.total = round2(zl.total + (c ? c.total : 0));
    }
    byZone.push({ ...zl, lines: sortLines([...zl.lines.values()]) });
  });
  const lines = [...byPlant.values()];
  const groups = SHOP_GROUPS.map((g) => {
    const gl = sortLines(lines.filter((l) => groupOf(l.plant).id === g.id));
    const formats = [];
    for (const l of gl) { let f = formats.find((x) => x.format === l.format); if (!f) { f = { format: l.format, lines: [] }; formats.push(f); } f.lines.push(l); }
    return { id: g.id, label: g.label, formats, lines: gl, subtotal: round2(gl.reduce((s, l) => s + l.total, 0)) };
  }).filter((g) => g.lines.length);
  return { groups, byZone: byZone.filter((z) => z.lines.length), total: round2(groups.reduce((s, g) => s + g.subtotal, 0)), unknownCount, plantCount, lines };
}
const sortLines = (ls) => ls.sort((a, b) => String(a.format).localeCompare(String(b.format), 'fr') || String(a.plant.commonName).localeCompare(String(b.plant.commonName), 'fr'));

export const PERIODS = [
  { id: 'autumn', label: 'À acheter pour planter en automne', months: [9, 10, 11] },
  { id: 'winter', label: 'À acheter pour planter en hiver (racines nues, hors gel)', months: [12, 1, 2] },
  { id: 'spring', label: 'À acheter pour planter au printemps', months: [3, 4, 5, 6] },
  { id: 'sow', label: 'À semer (graines et semences)', months: [] },
];
const isSow = (plant) => /semis|graine|semence/i.test(String(plant.priceNote || '')) || plant.category === 'lawn';

/** Période d'achat conseillée d'une essence : 'autumn' | 'winter' | 'spring' | 'sow'. */
export function periodOf(plant) {
  if (isSow(plant)) return 'sow';
  const pm = plantMonthsOf(plant);
  const score = (id) => PERIODS.find((p) => p.id === id).months.filter((m) => pm.includes(m)).length;
  if (/racines nues/i.test(String(plant.priceNote || '')) && score('winter')) return 'winter';
  let best = 'autumn'; let bs = -1;
  for (const id of ['autumn', 'spring', 'winter']) { const s = score(id); if (s > bs) { best = id; bs = s; } }
  return bs > 0 ? best : 'spring';
}

/** Achats étalés selon la période de plantation : [{id, label, lines:[{…ligne, best:'oct. à nov.'}], subtotal}] (périodes non vides). */
export function shoppingByPeriod(garden, plantsById) {
  const sl = shoppingList(garden, plantsById);
  return PERIODS.map((p) => {
    const lines = sortLines(sl.lines.filter((l) => periodOf(l.plant) === p.id)).map((l) => ({ ...l, best: p.id === 'sow' ? monthsText(l.plantMonths) : monthsText(l.plantMonths.filter((m) => p.months.includes(m))) || monthsText(l.plantMonths) }));
    return { id: p.id, label: p.label, lines, subtotal: round2(lines.reduce((s, l) => s + l.total, 0)) };
  }).filter((p) => p.lines.length);
}

/**
 * Fournitures estimées → {lines:[{id, label, qty, unit, packs, pack, unitPrice, total, basis}], total, bedArea, plantedArea, woody, trees, climbers}.
 * Vide (lines = []) s'il n'y a aucune plantation. Arrondi au sac / lot.
 */
export function suppliesList(garden, plantsById) {
  const lookup = lookupOf(plantsById);
  const S = SUPPLY;
  let bedArea = 0; let treeArea = 0; let woody = 0; let trees = 0; let climbers = 0; let hedgePlants = 0; let others = 0; let waterL = 0; let any = false;
  for (const z of (garden && garden.zones) || []) {
    const area = zoneArea(z);
    let hasBed = false; let hasTree = false;
    for (const pl of z.plantings || []) {
      const p = lookup(pl.plantId);
      if (!p) continue;
      any = true;
      const n = Math.max(1, Math.round(Number(pl.count) || 1));
      if (p.category === 'lawn') continue;
      if (p.category === 'aquatic') { others += n; continue; }
      if (WOODY.has(p.category)) {
        woody += n;
        if (p.category === 'tree' || p.category === 'fruit') { trees += n; hasTree = true; waterL += n * S.waterLTree; } else waterL += n * S.waterLShrub;
        if (p.category === 'climber') climbers += n;
        if (p.category === 'hedge') hedgePlants += n;
        if (p.category !== 'tree' && p.category !== 'fruit') hasBed = hasBed || z.type !== 'trees';
      } else { others += n; hasBed = true; waterL += n * S.waterLSmall; }
    }
    if (hasBed) bedArea += area; else if (hasTree) treeArea += area;
  }
  if (!any) return { lines: [], total: 0, bedArea: 0, plantedArea: 0, woody: 0, trees: 0, climbers: 0 };
  const plantedArea = bedArea + treeArea;
  const lines = [];
  const add = (id, label, qty, unit, pack, unitPrice, basis) => {
    const packs = pack ? Math.max(1, Math.ceil(qty / pack - 1e-9)) : Math.max(1, Math.ceil(qty - 1e-9));
    const total = unitPrice == null ? 0 : round2(packs * unitPrice);
    lines.push({ id, label, qty: round2(qty), unit, pack, packs, unitPrice, total, basis });
  };
  const compostL = bedArea * S.compostLPerM2Bed + woody * S.compostLPerWoody;
  if (compostL > 0) add('compost', `Terreau ou compost (sacs de ${S.compostBagL} L)`, compostL, 'L', S.compostBagL, S.compostBagPrice, `${S.compostLPerM2Bed} L/m² de massif (${round2(bedArea)} m²) + ${S.compostLPerWoody} L par arbre, arbuste ou haie (${woody})`);
  const mulchM3 = plantedArea * S.mulchDepthM;
  if (mulchM3 > 0) add('mulch', `Paillage : broyat, paille ou écorces (sacs de ${S.mulchBagL} L)`, mulchM3 * 1000, 'L', S.mulchBagL, S.mulchBagPrice, `${round2(plantedArea)} m² plantés × 5 cm = ${round2(mulchM3)} m³`);
  const fertKg = woody * S.fertKgPerWoody + others * S.fertKgPerOther;
  if (fertKg > 0) add('fert', `Engrais de plantation : corne broyée ou organique (sacs de ${S.fertBagKg} kg)`, fertKg, 'kg', S.fertBagKg, S.fertBagPrice, `${S.fertKgPerWoody * 1000} g par ligneux, ${S.fertKgPerOther * 1000} g par autre plant`);
  if (trees > 0) {
    add('stakes', 'Tuteurs d’arbre (1 par arbre)', trees, 'pièce', 1, S.stakePrice, `${trees} arbre${trees > 1 ? 's' : ''}`);
    add('ties', `Attaches souples (lots de ${S.tiesPack})`, trees + climbers, 'attache', S.tiesPack, S.tiesPackPrice, 'arbres et grimpantes');
  }
  if (climbers > 0) add('trellis', 'Treillage ou fils tendus (1 par grimpante)', climbers, 'pièce', 1, S.trellisPrice, `${climbers} grimpante${climbers > 1 ? 's' : ''}`);
  if (hedgePlants > 0) add('hedgestakes', 'Piquets et cordeau pour aligner les haies', Math.ceil(hedgePlants / S.hedgeStakeEvery), 'piquet', 1, S.hedgeStakePrice, `1 piquet pour ${S.hedgeStakeEvery} plants de haie`);
  if (bedArea > 0) add('cardboard', 'Carton brun ou géotextile sous le paillage (si le sol est enherbé)', bedArea, 'm²', 1, S.cardboardPricePerM2, `${round2(bedArea)} m² de massifs`);
  if (waterL > 0) lines.push({ id: 'water', label: 'Arrosage de reprise (eau, à prévoir la 1re saison)', qty: Math.round(waterL * S.waterRounds), unit: 'L', pack: null, packs: 0, unitPrice: null, total: 0, basis: `≈ ${Math.round(waterL)} L par tour d’arrosage × ${S.waterRounds} arrosages` });
  return { lines, total: round2(lines.reduce((s, l) => s + l.total, 0)), bedArea: round2(bedArea), plantedArea: round2(plantedArea), woody, trees, climbers };
}

/** Mobilier et structures à acheter ou à construire : [{id, label, dims, height, price}] + total (catalogue d'éléments). */
export function itemsToBuy(garden) {
  const lines = [];
  for (const it of (garden && garden.items) || []) {
    const k = getItemKind(it.kind);
    if (!k) continue;
    const r = Number.isFinite(it.radius) && it.radius > 0 ? it.radius : null;
    const fr = (n) => String(Math.round(n * 100) / 100).replace('.', ',');
    lines.push({ id: it.id, kind: it.kind, label: it.label || k.label, category: k.category, dims: r != null ? `Ø ${fr(r * 2)} m` : `${fr(it.width || k.w)} × ${fr(it.depth || k.d)} m`, height: itemHeight(it), price: k.priceEur || 0 });
  }
  return { lines, total: round2(lines.reduce((s, l) => s + l.price, 0)) };
}
export { formatEuro };
