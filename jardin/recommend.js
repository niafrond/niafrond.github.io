// Recommandation d'essences : score, quantité, cohérence, sélection automatique (pur).
import { allPlants, getPlant, filterPlants } from './catalog.js';
import { climateForDepartement, adjustTminForAltitude } from './climate.js';
import { shapeArea, shapePolygon, bounds } from './geometry.js';
import { zoneSunLevel } from './sun.js';

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
 * ctx = {tminC, zoneType, sunLevel|null, areaM2, minDimension, soil|null, windy:boolean|null}
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
    } else {
      score -= 35;
      forceDiscouraged = true;
      add(false, 'zone', `Peu adaptée à ${ZONE_LABEL[ctx.zoneType] || 'ce type de zone'}`);
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

  score = Math.max(0, Math.min(100, Math.round(score)));
  let status = score >= 75 ? 'ideal' : score >= 50 ? 'possible' : 'discouraged';
  if (excluded || forceDiscouraged) status = 'discouraged';
  return { score, status, reasons, excluded };
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
export function contextForZone(garden, zone) {
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
  };
}

/** Essences conseillées pour une zone, triées par score (les exclusions dures sont toujours retirées). */
export function recommendForZone(garden, zone, { includeDiscouraged = false, filters, plants } = {}) {
  const ctx = contextForZone(garden, zone);
  const list = filterPlants(plants || allPlants(), filters || {});
  return list
    .map((plant) => ({ plant, ...scorePlant(plant, ctx) }))
    .filter((r) => !r.excluded && (includeDiscouraged || r.status !== 'discouraged'))
    .sort((a, b) => b.score - a.score || PLANT_NAME(a.plant).localeCompare(PLANT_NAME(b.plant), 'fr'));
}

/** Quantité suggérée pour une zone. */
export function suggestQuantity(plant, zone) {
  const spacing = plant.spacing > 0 ? plant.spacing : plant.widthAdult > 0 ? plant.widthAdult : 1;
  const shape = zone.shape;
  if (!shape) return 1;
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
      .map((pl) => ({ plant: lookup(pl.plantId), count: pl.count || 1 }))
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

    // Besoins en eau mélangés.
    const levels = new Set(items.map(({ plant }) => plant.water).filter(Boolean));
    if (levels.has('low') && levels.has('high')) {
      out.push({ level: 'warn', zoneId: zone.id, text: `Zone « ${name} » : besoins en eau très différents (faible et élevé) dans la même zone, arrosage difficile à adapter` });
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
 */
export function suggestSelection(garden, zone, { seed = 1, plants, max } = {}) {
  const rnd = mulberry32(hashSeed(seed));
  const strict = zone.type === 'vegetable' || zone.type === 'terrace';
  let cands = recommendForZone(garden, zone, { plants }).filter((r) => !r.plant.invasive && !(strict && r.plant.toxic));
  if (!cands.length) return [];
  const area = shapeArea(zone.shape);
  const target = Math.min(cands.length, max || (area < 4 ? 2 : area < 15 ? 3 : area < 60 ? 4 : 5));

  const chosen = [];
  const layers = new Set();
  const months = new Set();
  const cats = new Set();
  while (chosen.length < target && cands.length) {
    let best = null, bestV = -Infinity;
    for (const c of cands) {
      const bloom = c.plant.bloom || [];
      const newMonths = bloom.filter((m) => !months.has(m)).length;
      const v = c.score / 100
        + (layers.has(heightLayer(c.plant.heightAdult)) ? 0 : 0.5)
        + newMonths / 12
        + (cats.has(c.plant.category) ? 0 : 0.15)
        + rnd() * 0.25;
      if (v > bestV) { bestV = v; best = c; }
    }
    chosen.push(best);
    cands = cands.filter((c) => c !== best);
    layers.add(heightLayer(best.plant.heightAdult));
    (best.plant.bloom || []).forEach((m) => months.add(m));
    cats.add(best.plant.category);
  }
  const n = chosen.length;
  return chosen.map(({ plant }) => {
    const q = suggestQuantity(plant, zone);
    const single = plant.category === 'tree' || plant.category === 'lawn';
    return { plantId: plant.id, count: single ? q : Math.max(1, Math.round(q / n)) };
  });
}
