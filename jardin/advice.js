// Conseils de plantation, entretien, arrosage et calendrier (pur, textes en français).
// Les fiches d'essence (`plant.care`) priment ; les champs manquants sont complétés par `genericCare(category)`.
import { allPlants } from './catalog.js';

const TYPE_LABEL = {
  pond: 'Mare', pool: 'Piscine', terrace: 'Terrasse', path: 'Allée', lawn: 'Pelouse', lowplants: 'Couvre-sols',
  midplants: 'Massif', tallplants: 'Plantes hautes', hedge: 'Haie', trees: 'Arbres', vegetable: 'Potager',
  orchard: 'Verger', other: 'Zone',
};

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

const GENERIC = {
  tree: {
    plantMonths: [11, 12, 2, 3], pruneMonths: [1, 2], fertMonths: [3],
    planting: 'Planter à l\'automne ou en fin d\'hiver hors gel, dans un trou deux fois plus large que la motte ; tuteurer, pailler et arroser copieusement.',
    pruning: 'Taille de formation les premières années, puis éclaircie légère en fin d\'hiver ; retirer le bois mort.',
    fertilizer: 'Compost mûr au pied chaque printemps.',
    watering: 'Arrosage de reprise la première année (20 à 30 L toutes les 2 semaines en été sec), ensuite rare.',
    notes: 'Respecter la distance aux limites de propriété et à la maison selon la taille adulte.',
  },
  fruit: {
    plantMonths: [11, 12, 2, 3], pruneMonths: [1, 2, 7], fertMonths: [3, 9],
    planting: 'Planter à racines nues de novembre à mars hors gel ; pralinage des racines, tuteur, paillage.',
    pruning: 'Taille de fructification en hiver, éclaircissage des fruits en juin.',
    fertilizer: 'Compost ou fumier décomposé en fin d\'hiver, apport potassique à l\'automne.',
    watering: 'Arroser en cas de sécheresse, surtout pendant le grossissement des fruits.',
    notes: 'Vérifier la pollinisation (variété compagne) pour les espèces non autofertiles.',
  },
  shrub: {
    plantMonths: [10, 11, 3, 4], pruneMonths: [3, 6], fertMonths: [3],
    planting: 'Planter à l\'automne ou au printemps, collet au niveau du sol, avec un apport de compost et un paillage.',
    pruning: 'Tailler après la floraison pour les arbustes de printemps, en fin d\'hiver pour ceux d\'été.',
    fertilizer: 'Engrais organique ou compost au printemps.',
    watering: 'Arroser régulièrement la première année ; ensuite seulement en période sèche prolongée.',
    notes: 'Laisser la place du développement adulte.',
  },
  hedge: {
    plantMonths: [10, 11, 3], pruneMonths: [4, 9], fertMonths: [3],
    planting: 'Planter en quinconce à l\'automne, en respectant l\'écartement indiqué ; pailler le pied pour limiter les herbes.',
    pruning: 'Deux tailles par an (printemps et fin d\'été), en évitant la période de nidification (avril à juillet).',
    fertilizer: 'Compost ou engrais organique au printemps.',
    watering: 'Arrosage soutenu les deux premières années.',
    notes: 'Tailler plus large à la base qu\'au sommet pour que la lumière arrive en bas.',
  },
  climber: {
    plantMonths: [10, 11, 3, 4], pruneMonths: [2, 3], fertMonths: [3, 6],
    planting: 'Planter à 30 cm du support, incliner la tige vers lui ; installer fils ou treillage solides.',
    pruning: 'Tailler selon l\'espèce : fin d\'hiver pour les floraisons d\'été, après floraison pour le printemps.',
    fertilizer: 'Compost au printemps, engrais floraison en juin.',
    watering: 'Arroser régulièrement au pied, surtout au contact d\'un mur.',
    notes: 'Palisser les jeunes pousses au fur et à mesure.',
  },
  perennial: {
    plantMonths: [3, 4, 9, 10], pruneMonths: [3, 10], fertMonths: [3],
    planting: 'Planter au printemps ou à l\'automne, en ameublissant le sol ; espacer selon la taille adulte.',
    pruning: 'Couper les tiges fanées en fin d\'automne ou en fin d\'hiver ; supprimer les fleurs fanées pour prolonger la floraison.',
    fertilizer: 'Compost en surface au printemps.',
    watering: 'Arroser à la plantation et en période sèche ; pailler pour garder la fraîcheur.',
    notes: 'Diviser les touffes tous les 3 à 5 ans à l\'automne ou au printemps.',
  },
  groundcover: {
    plantMonths: [3, 4, 9, 10], pruneMonths: [3], fertMonths: [3],
    planting: 'Planter serré (voir l\'écartement conseillé) sur sol désherbé et paillé pour une couverture rapide.',
    pruning: 'Rabattre ou recadrer en fin d\'hiver pour contenir la plante.',
    fertilizer: 'Peu d\'apports : un peu de compost au printemps suffit.',
    watering: 'Arrosage de reprise régulier, puis occasionnel.',
    notes: 'Désherber soigneusement la première année, le temps que la plante couvre le sol.',
  },
  grass: {
    plantMonths: [3, 4, 9, 10], pruneMonths: [3], fertMonths: [4],
    planting: 'Planter en touffes au printemps ou à l\'automne, en sol bien drainé.',
    pruning: 'Couper les touffes à 10 cm du sol en fin d\'hiver avant la reprise.',
    fertilizer: 'Compost léger au printemps.',
    watering: 'Arroser à la plantation, puis seulement en cas de sécheresse.',
    notes: 'Éviter de tailler avant la fin de l\'hiver : le feuillage protège le cœur du gel.',
  },
  bulb: {
    plantMonths: [9, 10, 11], pruneMonths: [], fertMonths: [3],
    planting: 'Planter à une profondeur égale à 2 à 3 fois la hauteur du bulbe, pointe vers le haut, en sol drainant.',
    pruning: 'Laisser le feuillage jaunir complètement avant de le couper.',
    fertilizer: 'Engrais pauvre en azote après la floraison.',
    watering: 'Arroser modérément pendant la croissance, pas en dormance.',
    notes: 'Éviter l\'eau stagnante qui fait pourrir les bulbes.',
  },
  aquatic: {
    plantMonths: [4, 5, 6], pruneMonths: [9, 10], fertMonths: [],
    planting: 'Installer en panier ou en berge à la profondeur indiquée, de mai à juin quand l\'eau se réchauffe.',
    pruning: 'Retirer les feuilles mortes et limiter les plantes envahissantes à l\'automne.',
    fertilizer: 'Aucun engrais : il favorise les algues.',
    watering: 'Maintenir le niveau d\'eau en été ; privilégier l\'eau de pluie.',
    notes: 'Curer la mare tous les 3 à 5 ans à l\'automne, par moitié.',
  },
  vegetable: {
    plantMonths: [3, 4, 5, 6], pruneMonths: [], fertMonths: [3, 5],
    planting: 'Semer ou repiquer après les dernières gelées, sur sol ameubli et enrichi en compost.',
    pruning: 'Tuteurer et supprimer les gourmands selon la culture.',
    fertilizer: 'Compost mûr à la préparation, purin ou engrais organique en cours de culture.',
    watering: 'Arroser au pied, régulièrement, de préférence le soir ou tôt le matin.',
    notes: 'Pratiquer la rotation des cultures d\'une année sur l\'autre.',
  },
  lawn: {
    plantMonths: [4, 5, 9], pruneMonths: range(4, 10), fertMonths: [4, 9],
    planting: 'Semer au printemps ou en début d\'automne sur sol bien préparé et roulé.',
    pruning: 'Tondre à 5-6 cm de hauteur, une fois par semaine en pleine pousse.',
    fertilizer: 'Engrais gazon organique au printemps et en septembre.',
    watering: 'Arroser rarement mais abondamment, tôt le matin ; laisser jaunir en été est toléré.',
    notes: 'Scarifier et aérer à l\'automne.',
  },
};

const FALLBACK_CAT = 'shrub';

/** Conseils génériques d'une catégorie (arbre, arbuste, vivace…) quand la fiche est incomplète. */
export function genericCare(category) {
  const g = GENERIC[category] || GENERIC[FALLBACK_CAT];
  return { ...g, plantMonths: [...g.plantMonths], pruneMonths: [...g.pruneMonths], fertMonths: [...g.fertMonths] };
}

const ZONE_TIPS = {
  pond: ['Curer la mare par moitié à l\'automne, tous les 3 à 5 ans.', 'Ne pas introduire de poissons rouges : ils déséquilibrent la mare.'],
  pool: ['Garder les arbres à l\'écart pour limiter les feuilles et les racines.'],
  terrace: ['Nettoyer à la brosse et au savon noir, sans produits agressifs, au printemps.'],
  path: ['Désherber à la main ou au grattoir, regarnir le revêtement si besoin.'],
  lawn: ['Tondre haut (5-6 cm), scarifier à l\'automne, sursemer les zones dégarnies.'],
  vegetable: ['Faire tourner les cultures chaque année et pailler pour économiser l\'eau.'],
  orchard: ['Ramasser les fruits tombés pour limiter les maladies.'],
};

const CATEGORY_ORDER = {
  tree: 1, fruit: 1,
  shrub: 2, hedge: 2, climber: 2,
  perennial: 3, bulb: 3, aquatic: 3, vegetable: 3,
  groundcover: 4,
  grass: 5, lawn: 5,
};

const STAGES = [
  { n: 0, label: 'Gros œuvre', text: 'terrasse, allées, mare ou piscine, clôtures et terrassements' },
  { n: 1, label: 'Arbres', text: 'arbres isolés et fruitiers (les plus gros d\'abord)' },
  { n: 2, label: 'Arbustes', text: 'arbustes, haies et plantes grimpantes' },
  { n: 3, label: 'Vivaces', text: 'vivaces, bulbes, plantes aquatiques et potager' },
  { n: 4, label: 'Couvre-sols', text: 'plantes couvre-sol' },
  { n: 5, label: 'Gazon', text: 'semis ou pose du gazon, en dernier pour ne pas l\'abîmer' },
];

let defaultMap = null;
function defaultPlantsById() {
  if (!defaultMap) defaultMap = Object.fromEntries(allPlants().map((p) => [p.id, p]));
  return defaultMap;
}

const zoneLabel = (z) => z.label || TYPE_LABEL[z.type] || 'Zone';
const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;
const monthsOr = (arr, fb) => (Array.isArray(arr) && arr.length ? arr : fb);

function mergedCare(plant) {
  const g = genericCare(plant.category);
  const c = plant.care || {};
  return {
    plantMonths: monthsOr(c.plantMonths, g.plantMonths),
    pruneMonths: Array.isArray(c.pruneMonths) ? c.pruneMonths : g.pruneMonths,
    fertMonths: Array.isArray(c.fertMonths) ? c.fertMonths : g.fertMonths,
    planting: nonEmpty(c.planting) ? c.planting : g.planting,
    pruning: nonEmpty(c.pruning) ? c.pruning : g.pruning,
    fertilizer: nonEmpty(c.fertilizer) ? c.fertilizer : g.fertilizer,
    watering: nonEmpty(c.watering) ? c.watering : g.watering,
    notes: nonEmpty(c.notes) ? c.notes : g.notes,
  };
}

function waterMonths(plant) {
  if (plant.water === 'high') return range(4, 10);
  if (plant.water === 'low') return [6, 7, 8];
  return range(5, 9);
}

function entries(garden, plantsById) {
  const out = [];
  for (const zone of garden?.zones || []) {
    for (const pl of zone.plantings || []) {
      const plant = plantsById[pl.plantId];
      if (plant) out.push({ zone, plant, count: pl.count ?? 1 });
    }
  }
  return out;
}

/** Conseils du jardin par zone et par essence, ordre de chantier, conseils généraux. */
export function buildAdvice(garden, opts = {}) {
  const plantsById = opts.plantsById || defaultPlantsById();
  const zones = (garden?.zones || []).map((zone) => {
    const plants = [];
    for (const pl of zone.plantings || []) {
      const plant = plantsById[pl.plantId];
      if (!plant) continue;
      const c = mergedCare(plant);
      plants.push({
        plant, count: pl.count ?? 1,
        planting: c.planting, pruning: c.pruning, fertilizer: c.fertilizer, watering: c.watering, notes: c.notes,
      });
    }
    return { zoneId: zone.id, zoneLabel: zoneLabel(zone), type: zone.type, plants, tips: ZONE_TIPS[zone.type] || [] };
  });

  // ordre de chantier : étapes présentes uniquement
  const present = new Set();
  for (const z of garden?.zones || []) if (['pond', 'pool', 'terrace', 'path'].includes(z.type)) present.add(0);
  for (const z of garden?.zones || []) if (z.type === 'lawn') present.add(5);
  for (const { plant } of entries(garden, plantsById)) present.add(CATEGORY_ORDER[plant.category] ?? 2);
  const plantingOrder = STAGES.filter((s) => present.has(s.n)).map((s, i) => `${i + 1}. ${s.label} : ${s.text}.`);

  const general = {
    disclaimer: 'Les quantités et périodes sont des ordres de grandeur : adaptez-les à votre terrain et au temps qu\'il fait.',
    mulch: 'Paillez les massifs sur 5 à 8 cm (broyat, paille, feuilles) pour garder l\'humidité et limiter les herbes.',
    water: 'Arrosez de préférence tôt le matin ou le soir, au pied, copieusement et rarement.',
    rainwater: garden?.context?.roofArea
      ? `Avec ${Math.round(garden.context.roofArea)} m² de toit, une cuve de ${Math.max(300, Math.round(garden.context.roofArea * 15 / 100) * 100)} L est un bon départ pour récupérer l'eau de pluie.`
      : 'Récupérer l\'eau de pluie d\'un toit dans une cuve réduit l\'arrosage au robinet.',
    emptyHint: zones.every((z) => !z.plants.length) ? 'Aucune essence choisie pour le moment : ajoutez-en pour obtenir des conseils détaillés.' : null,
  };
  return { zones, plantingOrder, general };
}

/** Calendrier de 12 mois : `[{month, tasks:[{kind, zoneId, plantId?, text}]}]`. */
export function calendar(garden, opts = {}) {
  const plantsById = opts.plantsById || defaultPlantsById();
  const months = range(1, 12).map((month) => ({ month, tasks: [] }));
  const add = (m, kind, zone, plant, text) => months[m - 1].tasks.push({ kind, zoneId: zone.id, ...(plant ? { plantId: plant.id } : {}), text });
  for (const { zone, plant } of entries(garden, plantsById)) {
    const c = mergedCare(plant);
    const where = zoneLabel(zone).toLowerCase();
    const name = plant.commonName || plant.id;
    c.plantMonths.forEach((m) => add(m, 'plant', zone, plant, `Planter : ${name} (${where})`));
    c.pruneMonths.forEach((m) => add(m, 'prune', zone, plant, `Tailler / entretenir : ${name} (${where})`));
    c.fertMonths.forEach((m) => add(m, 'fertilize', zone, plant, `Fertiliser : ${name} (${where})`));
    waterMonths(plant).forEach((m) => add(m, 'water', zone, plant, `Surveiller l'arrosage : ${name} (${where})`));
    (plant.harvest || []).forEach((m) => add(m, 'harvest', zone, plant, `Récolter : ${name} (${where})`));
    if (typeof plant.hardiness === 'number' && plant.hardiness > -5) {
      [11, 12, 1, 2].forEach((m) => add(m, 'protect', zone, plant, `Protéger du gel : ${name} (${where})`));
    }
  }
  // zones sans plantation connue : tâches génériques par type
  for (const zone of garden?.zones || []) {
    if (zone.type === 'lawn' && !(zone.plantings || []).length) {
      const g = genericCare('lawn');
      g.pruneMonths.forEach((m) => add(m, 'prune', zone, null, `Tondre : ${zoneLabel(zone).toLowerCase()}`));
      g.fertMonths.forEach((m) => add(m, 'fertilize', zone, null, `Fertiliser : ${zoneLabel(zone).toLowerCase()}`));
    }
    if (zone.type === 'pond') add(10, 'prune', zone, null, `Curer la mare par moitié : ${zoneLabel(zone).toLowerCase()}`);
  }
  return months;
}

export function tasksForMonth(garden, month, opts = {}) {
  const m = ((Number(month) - 1 + 12) % 12) + 1;
  return calendar(garden, opts)[m - 1].tasks;
}

/** Protections à prévoir pour une température minimale donnée (°C) → `[{zoneId, plantId, text}]`. */
export function frostProtection(garden, tminC, opts = {}) {
  const plantsById = opts.plantsById || defaultPlantsById();
  const out = [];
  for (const { zone, plant } of entries(garden, plantsById)) {
    if (typeof plant.hardiness !== 'number' || plant.hardiness <= tminC) continue;
    const name = plant.commonName || plant.id;
    const where = zoneLabel(zone).toLowerCase();
    const how = ['aquatic', 'perennial', 'bulb'].includes(plant.category)
      ? 'pailler épais le pied et couvrir d\'un voile d\'hivernage'
      : plant.category === 'vegetable'
        ? 'couvrir d\'un voile ou d\'une cloche'
        : plant.category === 'tree' || plant.category === 'fruit'
          ? 'pailler le pied et protéger le tronc d\'un voile ou de paille'
          : 'pailler le pied et envelopper la plante d\'un voile d\'hivernage (rentrer si en pot)';
    out.push({
      zoneId: zone.id, plantId: plant.id,
      text: `${name} (${where}) supporte ${plant.hardiness} °C et il fera ${tminC} °C : ${how}.`,
    });
  }
  return out;
}
