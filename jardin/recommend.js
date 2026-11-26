// Recommandation d'essences : score, quantité, cohérence, sélection automatique (pur).
import { allPlants, getPlant, filterPlants } from './catalog.js';
import { climateForDepartement, adjustTminForAltitude } from './climate.js';
import { shapeArea, shapePolygon, bounds } from './geometry.js';
import { zoneSunLevel } from './sun.js';
import { effectivePlant } from './heights.js';
import { edgeObstacles } from './items.js';
import { existingShadowObstacles } from './existing.js';
import { plantCost } from './pricing.js';
import { levelForZone, fitsMaintenance, plantEffort, getMaintenanceLevel } from './maintenance.js';
import { pondFitFor, pondTag, pondArea, pondDepth, pondFit, pondPlantQuantity } from './ponds.js';
import { getAmbiance, detectAmbiance, plantAmbianceScore, plantAvoids, isTypical } from './ambiances.js';

const SUN_ORDER = { shade: 0, partial: 1, full: 2 };
const SUN_LABEL = { full: 'plein soleil', partial: 'mi-ombre', shade: 'ombre' };
const WATER_ORDER = { low: 0, medium: 1, high: 2 };
const SOIL_LABEL = { clay: 'argileux', limestone: 'calcaire', sandy: 'sableux', loam: 'limoneux', humus: 'humifère' };
const ZONE_LABEL = {
  pond: 'une mare', pool: 'une piscine', terrace: 'une terrasse', path: 'une allée', lawn: 'une pelouse',
  lowplants: 'des plantes basses', midplants: 'un massif', tallplants: 'des plantes hautes', hedge: 'une haie',
  trees: 'des arbres', vegetable: 'un potager', orchard: 'un verger', other: 'cette zone',
};

const fmtC = (t) => `${String(Math.round(t * 10) / 10).replace('.', ',').replace('-', '−')} °C`;
const fmtM = (n) => `${String(Math.round(n * 10) / 10).replace('.', ',')} m`;
const PLANT_NAME = (p) => p.commonName || p.id;

/**
 * Score de compatibilité d'une essence dans un contexte.
 * ctx = {tminC, zoneType, sunLevel|null, areaM2, minDimension, soil|null, windy:boolean|null, ambiance?, maintenance?}
 * (`maintenance` : 'green' | 'low' | 'none' | null, voir maintenance.js).
 * Résultat : {score, status, reasons, excluded} ; `excluded` = exclusion dure (rusticité insuffisante).
 */
export function scorePlant(plant, ctx = {}) {
  let score = 100;
  let forceDiscouraged = false;
  let excluded = false;
  const reasons = [];
  const add = (ok, criterion, text) => reasons.push({ ok, criterion, text });

  // Rusticité : exclusion dure.
  if (typeof ctx.tminC === 'number' && typeof plant.hardiness === 'number') {
    const margin = ctx.tminC - plant.hardiness; // < 0 : le gel du secteur dépasse la tolérance
    if (margin < 0) {
      excluded = true;
      score = 0;
      add(false, 'rusticité', `Ne résiste pas au gel : tolère ${fmtC(plant.hardiness)} seulement (votre secteur : ${fmtC(ctx.tminC)})`);
    } else if (margin < 3) {
      score -= 10;
      add(null, 'rusticité', `Résiste au gel jusqu'à ${fmtC(plant.hardiness)}, juste suffisant (votre secteur : ${fmtC(ctx.tminC)}) : prévoir une protection hivernale`);
    } else {
      add(true, 'rusticité', `Résiste au gel jusqu'à ${fmtC(plant.hardiness)} (votre secteur : ${fmtC(ctx.tminC)})`);
    }
  } else {
    add(null, 'rusticité', 'Climat du secteur non renseigné : rusticité non vérifiée');
  }

  // Type de zone.
  if (ctx.zoneType) {
    const zones = plant.zones || [];
    if (zones.includes(ctx.zoneType)) {
      add(true, 'zone', `Convient pour ${ZONE_LABEL[ctx.zoneType] || 'ce type de zone'}`);
    } else if (ctx.zoneType === 'trees' && isSmallShrub(plant)) {
      // Dans une zone d'arbres, on propose aussi de petits arbustes (sous-étage).
      add(true, 'zone', 'Petit arbuste : s’associe bien aux arbres (sous-étage)');
    } else {
      score -= 35;
      forceDiscouraged = true;
      add(false, 'zone', `Peu adaptée à ${ZONE_LABEL[ctx.zoneType] || 'ce type de zone'}`);
    }
  }

  // Mare : taille et profondeur de la mare (essences aquatiques et de berge étiquetées).
  let forbidden = false;
  if (ctx.zoneType === 'pond' && typeof ctx.pondArea === 'number' && pondTag(plant)) {
    const area = ctx.pondArea;
    const depth = typeof ctx.pondDepth === 'number' ? ctx.pondDepth : 60;
    const fit = pondFitFor(plant, area, depth);
    const areaTxt = `${String(Math.round(area * 10) / 10).replace('.', ',')} m²`;
    if (fit.level === 'ok') {
      add(true, 'mare', `Adaptée à une mare de ${areaTxt} (profondeur ${depth} cm)`);
    } else {
      forceDiscouraged = true;
      score -= fit.level === 'forbid' ? 80 : 40;
      if (fit.level === 'forbid') forbidden = true;
      add(false, 'mare', `Ne convient pas à une mare de ${areaTxt} : ${fit.reasons.join(' ; ')}`);
    }
  }

  // Soleil.
  if (!ctx.sunLevel) {
    add(null, 'soleil', 'Ensoleillement non renseigné');
  } else {
    const sun = plant.sun || [];
    const here = SUN_ORDER[ctx.sunLevel];
    if (sun.includes(ctx.sunLevel)) {
      add(true, 'soleil', `Apprécie ${SUN_LABEL[ctx.sunLevel]}, comme dans cette zone`);
    } else {
      const dist = Math.min(...sun.map((s) => Math.abs(SUN_ORDER[s] - here)), 2);
      score -= dist >= 2 ? 45 : 20;
      const wants = sun.map((s) => SUN_LABEL[s]).join(' ou ') || 'un autre ensoleillement';
      add(false, 'soleil', `Préfère ${wants} (cette zone : ${SUN_LABEL[ctx.sunLevel]})`);
    }
  }

  // Sol.
  if (ctx.soil) {
    const soils = plant.soil || [];
    if (!soils.length || soils.includes(ctx.soil)) {
      add(true, 'sol', `Supporte un sol ${SOIL_LABEL[ctx.soil] || ctx.soil}`);
    } else {
      score -= 15;
      add(false, 'sol', `Sol ${SOIL_LABEL[ctx.soil] || ctx.soil} peu adapté (préfère : ${soils.map((s) => SOIL_LABEL[s] || s).join(', ')})`);
    }
  }

  // Vent.
  if (ctx.windy === true) {
    if (plant.windTolerant) {
      add(true, 'vent', 'Tolère les emplacements ventés');
    } else {
      score -= 10;
      add(false, 'vent', 'Sensible au vent, emplacement exposé');
    }
  }

  // Place disponible.
  const width = plant.widthAdult;
  if (typeof width === 'number' && width > 0) {
    const footprint = Math.PI * (width / 2) ** 2;
    if (typeof ctx.minDimension === 'number' && ctx.minDimension > 0 && width > ctx.minDimension + 1e-6) {
      score -= 25;
      add(false, 'place', `Trop large à l'âge adulte (${fmtM(width)}) pour une zone large de ${fmtM(ctx.minDimension)}`);
    } else if (typeof ctx.areaM2 === 'number' && ctx.areaM2 > 0 && footprint > ctx.areaM2 + 1e-6) {
      score -= 30;
      add(false, 'place', `Surface insuffisante : emprise adulte ≈ ${Math.round(footprint * 10) / 10} m² pour ${Math.round(ctx.areaM2 * 10) / 10} m²`);
    } else if (ctx.areaM2 || ctx.minDimension) {
      add(true, 'place', `Assez de place pour son développement (largeur adulte ${fmtM(width)})`);
    }
  }

  // Ambiance souhaitée (facultative).
  let rank = null;
  const amb = ctx.ambiance ? getAmbiance(ctx.ambiance) : null;
  if (amb && !excluded) {
    const s = plantAmbianceScore(plant, amb.id);
    const name = amb.label.toLowerCase();
    if (plantAvoids(plant).includes(amb.id)) {
      score -= 20;
      add(false, 'ambiance', `Peu adaptée à l'ambiance « ${name} »`);
    } else if (s >= 0.7) {
      score += Math.round(15 * (s - 0.5) / 0.5);
      add(true, 'ambiance', `Convient à l'ambiance « ${name} »`);
    } else {
      if (s < 0.5) score -= Math.round((0.5 - s) * 20);
      add(s < 0.5 ? false : null, 'ambiance', s < 0.5 ? `Ne correspond pas vraiment à l'ambiance « ${name} »` : `Compatible avec l'ambiance « ${name} »`);
    }
    rank = score;
  }

  // Niveau d'entretien souhaité (facultatif : « green » ou absent = aucune restriction).
  if ((ctx.maintenance === 'low' || ctx.maintenance === 'none') && !excluded) {
    const fit = fitsMaintenance(plant, ctx.maintenance);
    score += fit.bonus - fit.penalty;
    if (fit.discouraged) forceDiscouraged = true;
    add(fit.ok, 'entretien', fit.text);
    rank = score;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  let status = score >= 75 ? 'ideal' : score >= 50 ? 'possible' : 'discouraged';
  if (excluded || forceDiscouraged) status = 'discouraged';
  const res = { score, status, reasons, excluded };
  if (forbidden) res.forbidden = true;
  if (rank !== null) res.rank = rank; // score non plafonné, pour départager les essences à 100
  return res;
}

/** Longueur d'une polyligne. */
function polyLength(points) {
  let L = 0;
  for (let i = 1; i < points.length; i++) L += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return L;
}

function minDimensionOf(shape) {
  if (!shape) return undefined;
  if (shape.kind === 'circle') return shape.radius * 2;
  if (shape.kind === 'line') return shape.width;
  const b = bounds(shapePolygon(shape));
  return Math.min(b.width, b.height);
}

/** Contexte de scoring d'une zone dans un jardin. */
export function contextForZone(garden, zone, { ambiance, maintenance } = {}) {
  const c = garden?.context || {};
  const clim = climateForDepartement(c.departement);
  const tminC = clim ? adjustTminForAltitude(clim.tminC, c.altitude) : null;
  let sunLevel = null;
  try {
    sunLevel = zoneSunLevel(garden, zone)?.level ?? null;
  } catch (e) {
    sunLevel = null;
  }
  const w = c.wind;
  const windy = w === null || w === undefined ? null : !(w === false || w === 'none' || w === 'low');
  return {
    tminC,
    zoneType: zone.type,
    sunLevel,
    areaM2: shapeArea(zone.shape),
    minDimension: minDimensionOf(zone.shape),
    soil: c.soil || null,
    windy,
    ambiance: ambiance !== undefined ? ambiance : resolveAmbiance(zone),
    maintenance: maintenance !== undefined ? maintenance : levelForZone(garden, zone),
    ...(zone.type === 'pond' ? { pondArea: pondArea(zone), pondDepth: pondDepth(zone) } : {}),
  };
}

/** Ambiance d'une zone : explicite (`zone.ambiance`), sinon détectée dans son nom, sinon null. */
export function resolveAmbiance(zone) {
  if (zone?.ambiance) return getAmbiance(zone.ambiance) ? zone.ambiance : null;
  return detectAmbiance(zone?.label);
}

/** Essences conseillées pour une zone, triées par score (les exclusions dures sont toujours retirées). */
export function recommendForZone(garden, zone, { includeDiscouraged = false, includeForbidden = false, filters, plants, ambiance, maintenance } = {}) {
  const ctx = contextForZone(garden, zone, { ambiance, maintenance });
  const list = filterPlants(plants || allPlants(), filters || {});
  return list
    .map((plant) => ({ plant, ...scorePlant(plant, ctx) }))
    .filter((r) => !r.excluded && (includeForbidden || !r.forbidden) && (includeDiscouraged || r.status !== 'discouraged'))
    .sort((a, b) => (b.rank ?? b.score) - (a.rank ?? a.score) || PLANT_NAME(a.plant).localeCompare(PLANT_NAME(b.plant), 'fr'));
}

/** Quantité suggérée pour une zone. */
export function suggestQuantity(plant, zone) {
  const spacing = plant.spacing > 0 ? plant.spacing : plant.widthAdult > 0 ? plant.widthAdult : 1;
  const shape = zone.shape;
  if (!shape) return 1;
  if (zone.type === 'pond' && pondTag(plant)) return pondPlantQuantity(plant, zone);
  if (shape.kind === 'line') {
    return Math.max(1, Math.round(polyLength(shape.points || []) / spacing));
  }
  if (plant.category === 'tree' || plant.category === 'lawn') return 1;
  return Math.max(1, Math.floor(shapeArea(shape) / (spacing * spacing) + 1e-9));
}

// ---------- géométrie locale (distance entre formes) ----------
function segDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
function inside(p, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
/** Distance minimale entre deux polygones (0 si contact ou inclusion). */
function polygonsDistance(A, B) {
  if (!A.length || !B.length) return Infinity;
  if (inside(A[0], B) || inside(B[0], A)) return 0;
  let best = Infinity;
  const edges = (P) => P.map((p, i) => [p, P[(i + 1) % P.length]]);
  for (const [a1, a2] of edges(A)) {
    for (const p of B) best = Math.min(best, segDist(p, a1, a2));
  }
  for (const [b1, b2] of edges(B)) {
    for (const p of A) best = Math.min(best, segDist(p, b1, b2));
  }
  return best;
}

/** Haies, clôtures et murs hauts (> 2 m) situés au sud (± 60°) et à moins de 6 m d'une zone de plein soleil. */
function tallWallsSouth(garden, zone, lookup) {
  let level = null;
  try { level = (zoneSunLevel(garden, zone) || {}).level; } catch { level = null; }
  if (level !== 'full') return [];
  const poly = shapePolygon(zone.shape);
  if (poly.length < 3) return [];
  const c = poly.reduce((a, p) => ({ x: a.x + p.x / poly.length, y: a.y + p.y / poly.length }), { x: 0, y: 0 });
  const th = ((garden.context && garden.context.northAngle) || 0) * Math.PI / 180;
  const south = { x: -Math.sin(th), y: Math.cos(th) };
  const KIND = { wall: 'Mur', fence: 'Clôture', hedge: 'Haie' };
  const lines = [];
  for (const e of edgeObstacles(garden)) lines.push({ name: KIND[e.kind] || 'Mur', height: e.height, a: e.points[0], b: e.points[1] });
  for (const o of garden.obstacles || []) if ((o.kind === 'wall' || o.kind === 'fence') && o.points && o.points.length >= 2) for (let i = 0; i < o.points.length - 1; i++) lines.push({ name: KIND[o.kind], height: Number(o.height) || (o.kind === 'wall' ? 2 : 1.2), a: o.points[i], b: o.points[i + 1] });
  for (const e of existingShadowObstacles(garden)) if (e.points && e.points.length >= 2) for (let i = 0; i < e.points.length - 1; i++) lines.push({ name: KIND[e.kind] || 'Haie', height: e.height, a: e.points[i], b: e.points[i + 1] });
  for (const z of garden.zones || []) {
    if (z === zone || !z.shape || z.shape.kind !== 'line' || !z.shape.points || z.shape.points.length < 2) continue;
    for (const pl of z.plantings || []) {
      const pt = effectivePlant(lookup(pl.plantId), pl);
      if (pt && (pt.category === 'hedge' || pt.category === 'shrub') && pt.heightAdult > 2) for (let i = 0; i < z.shape.points.length - 1; i++) lines.push({ name: 'Haie', height: pt.heightAdult, a: z.shape.points[i], b: z.shape.points[i + 1] });
    }
  }
  const out = [];
  let best = null;
  for (const l of lines) {
    if (!(l.height > 2)) continue;
    const m = { x: (l.a.x + l.b.x) / 2, y: (l.a.y + l.b.y) / 2 };
    const vx = m.x - c.x; const vy = m.y - c.y; const vl = Math.hypot(vx, vy) || 1;
    if ((vx * south.x + vy * south.y) / vl < 0.5) continue;
    if (polygonsDistance(poly, [l.a, l.b]) > 6) continue;
    if (!best || l.height > best.height) best = l;
  }
  if (best) out.push(best);
  return out;
}

/** Contrôle de cohérence du jardin : surdensité, arbres hauts près d'une terrasse/piscine, eau, invasives, toxiques. */
export function checkCoherence(garden, { plants } = {}) {
  const out = [];
  const lookup = (id) => {
    if (plants) return plants.find((p) => p.id === id) || null;
    return getPlant(id);
  };
  const zones = garden?.zones || [];
  const sensitive = zones.filter((z) => z.type === 'terrace' || z.type === 'pool');

  for (const zone of zones) {
    const items = (zone.plantings || [])
      .map((pl) => ({ plant: effectivePlant(lookup(pl.plantId), pl), count: pl.count || 1 }))
      .filter((x) => x.plant);
    if (!items.length) continue;
    const name = zone.label || zone.type;
    const area = shapeArea(zone.shape);

    // Surdensité.
    if (area > 0) {
      const need = items.reduce((s, { plant, count }) => {
        const sp = plant.spacing > 0 ? plant.spacing : plant.widthAdult || 1;
        return s + count * sp * sp;
      }, 0);
      if (need > area * 1.25) {
        out.push({ level: 'warn', zoneId: zone.id, text: `Zone « ${name} » : surdensité, les plants occuperont ≈ ${Math.round(need)} m² adultes pour ${Math.round(area)} m² disponibles` });
      }
    }

    // Arbre haut près d'une terrasse / piscine.
    const tall = items.filter(({ plant }) => plant.heightAdult >= 4);
    if (tall.length && zone.shape) {
      const poly = shapePolygon(zone.shape);
      for (const s of sensitive) {
        if (s.id === zone.id) continue;
        const d = polygonsDistance(poly, shapePolygon(s.shape));
        if (d < 3) {
          const what = s.type === 'pool' ? 'la piscine' : 'la terrasse';
          out.push({ level: 'warn', zoneId: zone.id, text: `${PLANT_NAME(tall[0].plant)} (${fmtM(tall[0].plant.heightAdult)} adulte) est à moins de 3 m de ${what} (${fmtM(d)}) : racines, ombre et feuilles à prévoir` });
        }
      }
    }

    // Haie / clôture / mur haut (> 2 m) au sud d'une zone de plein soleil : ombre portée sur la zone.
    if (zone.shape && zone.type !== 'pool' && zone.type !== 'path') {
      for (const w of tallWallsSouth(garden, zone, lookup)) {
        out.push({ level: 'warn', zoneId: zone.id, text: `${w.name} de ${fmtM(w.height)} au sud de la zone « ${name} » (plein soleil) : son ombre portée réduira l'ensoleillement` });
      }
    }

    // Besoins en eau mélangés.
    const levels = new Set(items.map(({ plant }) => plant.water).filter(Boolean));
    if (levels.has('low') && levels.has('high')) {
      out.push({ level: 'warn', zoneId: zone.id, text: `Zone « ${name} » : besoins en eau très différents (faible et élevé) dans la même zone, arrosage difficile à adapter` });
    }

    // Zone prévue sans entretien : essences qui en demandent.
    if (levelForZone(garden, zone) === 'none') {
      for (const { plant } of items) {
        if (plantEffort(plant) >= 2) {
          out.push({ level: 'warn', zoneId: zone.id, text: `Zone « ${name} » : ${PLANT_NAME(plant)} demande un entretien régulier alors que cette zone est prévue sans entretien` });
        }
      }
    }

    // Mare redimensionnée : essences devenues inadaptées.
    if (zone.type === 'pond') {
      for (const { plant } of items) {
        if (plant.invasive) continue;
        const fit = pondFit(plant, zone);
        if (!fit.ok) out.push({ level: 'warn', zoneId: zone.id, text: `Mare « ${name} » : ${PLANT_NAME(plant)} ne convient plus (${fit.reasons.join(' ; ')})` });
      }
    }

    // Invasives.
    for (const { plant } of items) {
      if (plant.invasive) {
        out.push({ level: 'warn', zoneId: zone.id, text: `${PLANT_NAME(plant)} est une essence invasive : à éviter, elle peut envahir le jardin et les milieux naturels` });
      }
    }

    // Toxiques en potager / terrasse.
    if (zone.type === 'vegetable' || zone.type === 'terrace') {
      for (const { plant } of items) {
        if (plant.toxic) {
          out.push({ level: 'warn', zoneId: zone.id, text: `${PLANT_NAME(plant)} est toxique : déconseillée ${zone.type === 'vegetable' ? 'au potager' : 'près d\'une terrasse'} (enfants, animaux)` });
        }
      }
    }
  }
  return out;
}

/** Petit arbuste (≤ 4 m) : accepté aussi dans une zone d'arbres, en sous-étage. */
export const isSmallShrub = (plant) => !!plant && plant.category === 'shrub' && (Number(plant.heightAdult) || 0) <= 4;

// ---------- « Surprends-moi » ----------
function hashSeed(seed) {
  if (typeof seed === 'number') return seed >>> 0;
  let h = 2166136261;
  for (const ch of String(seed ?? 1)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const heightLayer = (h) => (h < 0.5 ? 0 : h < 1.5 ? 1 : h < 4 ? 2 : 3);

/**
 * Sélection équilibrée déterministe : hauteurs étagées, floraison étalée.
 * Retourne [{plantId, count}].
 * `budget` (€, facultatif) : privilégie les essences peu coûteuses et réduit quantités/essences pour rester
 * sous le budget si possible (au moins une essence est toujours conservée).
 */
export function suggestSelection(garden, zone, { seed = 1, plants, max, budget, ambiance, maintenance } = {}) {
  const rnd = mulberry32(hashSeed(seed));
  const strict = zone.type === 'vegetable' || zone.type === 'terrace';
  const amb = ambiance !== undefined ? (getAmbiance(ambiance) ? ambiance : null) : resolveAmbiance(zone);
  const level = maintenance !== undefined ? (getMaintenanceLevel(maintenance) ? maintenance : 'green') : levelForZone(garden, zone);
  const maxEffort = level === 'none' ? 1 : level === 'low' ? 2 : 3;
  let cands = recommendForZone(garden, zone, { plants, ambiance: amb, maintenance: level }).filter((r) => !r.plant.invasive && !(strict && r.plant.toxic));
  if (!cands.length) return [];
  const area = shapeArea(zone.shape);
  const target = Math.min(cands.length, max || (area < 4 ? 2 : area < 15 ? 3 : area < 60 ? 4 : 5));
  const cap = typeof budget === 'number' && Number.isFinite(budget) && budget > 0 ? budget : null;
  const estCost = (plant) => {
    if (cap == null) return 0;
    const c = plantCost(plant, { count: Math.max(1, Math.round(suggestQuantity(plant, zone) / target)) }, zone);
    return c ? c.total : 0;
  };

  const chosen = [];
  const layers = new Set();
  const months = new Set();
  const cats = new Set();
  // Ambiance : au moins 70 % d'essences typiques quand le catalogue le permet.
  const minTypical = amb ? Math.ceil(0.7 * target - 1e-9) : 0;
  let typicalCount = 0;
  // Zone d'arbres : environ un tiers de petits arbustes en sous-étage (si au moins 3 essences et si le catalogue le permet).
  const minShrub = zone.type === 'trees' && target >= 3 ? Math.max(1, Math.floor(target / 3)) : 0;
  let shrubCount = 0;
  while (chosen.length < target && cands.length) {
    let best = null, bestV = -Infinity;
    // Entretien : on épuise d'abord les essences au niveau voulu, puis on complète avec les moins exigeantes.
    let pool = cands;
    if (maxEffort < 3) {
      const easy = cands.filter((c) => plantEffort(c.plant) <= maxEffort);
      if (easy.length) pool = easy;
    }
    if (amb && minTypical - typicalCount >= target - chosen.length) {
      const typ = pool.filter((c) => isTypical(c.plant, amb));
      if (typ.length) pool = typ;
    }
    if (minShrub - shrubCount > 0 && minShrub - shrubCount >= target - chosen.length) {
      const sh = pool.filter((c) => isSmallShrub(c.plant));
      const sh2 = sh.length ? sh : (maxEffort < 3 ? [] : cands.filter((c) => isSmallShrub(c.plant)));
      if (sh2.length) pool = sh2;
    }
    for (const c of pool) {
      const bloom = c.plant.bloom || [];
      const newMonths = bloom.filter((m) => !months.has(m)).length;
      const v = c.score / 100
        + (layers.has(heightLayer(c.plant.heightAdult)) ? 0 : 0.5)
        + newMonths / 12
        + (cats.has(c.plant.category) ? 0 : 0.15)
        - (cap == null ? 0 : Math.min(1, estCost(c.plant) / cap) * 0.6)
        + (amb ? plantAmbianceScore(c.plant, amb) * 1.5 : 0)
        + rnd() * 0.25;
      if (v > bestV) { bestV = v; best = c; }
    }
    chosen.push(best);
    if (amb && isTypical(best.plant, amb)) typicalCount++;
    if (isSmallShrub(best.plant)) shrubCount++;
    cands = cands.filter((c) => c !== best);
    layers.add(heightLayer(best.plant.heightAdult));
    (best.plant.bloom || []).forEach((m) => months.add(m));
    cats.add(best.plant.category);
  }
  const n = chosen.length;
  const sel = chosen.map(({ plant }) => {
    const q = suggestQuantity(plant, zone);
    const single = plant.category === 'tree' || plant.category === 'lawn';
    return { plantId: plant.id, count: single ? q : Math.max(1, Math.round(q / n)) };
  });
  if (cap == null) return sel;
  // Respect du budget : on réduit d'abord les quantités de la ligne la plus chère, puis on retire des essences.
  const byId = new Map(chosen.map(({ plant }) => [plant.id, plant]));
  const line = (it) => { const c = plantCost(byId.get(it.plantId), it, zone); return c ? c.total : 0; };
  const sum = () => sel.reduce((t, it) => t + line(it), 0);
  for (let guard = 0; guard < 5000 && sum() > cap + 1e-9; guard++) {
    const reducible = sel.filter((it) => it.count > 1 && line(it) > 0 && byId.get(it.plantId).priceUnit !== 'm2');
    if (reducible.length) {
      reducible.sort((a, b) => line(b) - line(a));
      reducible[0].count--;
    } else if (sel.length > 1) {
      let k = 0;
      sel.forEach((it, i) => { if (line(it) > line(sel[k])) k = i; });
      sel.splice(k, 1);
    } else break;
  }
  return sel;
}

const NO_PLANT_ZONES = new Set(['pool', 'path']);

/**
 * « Surprends-moi » pour tout le jardin : une sélection par zone plantable, chacune avec son ambiance
 * (`ambiances[zone.id]`, sinon `zone.ambiance`, sinon détectée dans le nom ; `null` explicite = aucune).
 * Retourne [{zoneId, selection}].
 */
export function suggestForGarden(garden, { seed = 1, budget, ambiances = {}, plants, maintenance } = {}) {
  const zones = (garden?.zones || []).filter((z) => !NO_PLANT_ZONES.has(z.type));
  const cap = typeof budget === 'number' && Number.isFinite(budget) && budget > 0 ? budget : null;
  return zones.map((zone, i) => {
    const ambiance = zone.id in (ambiances || {}) ? ambiances[zone.id] : undefined;
    const selection = suggestSelection(garden, zone, {
      seed: `${seed}:${i}`,
      plants,
      ambiance,
      ...(maintenance !== undefined ? { maintenance } : {}),
      ...(cap ? { budget: cap / zones.length } : {}),
    });
    return { zoneId: zone.id, selection };
  });
}
