// Modèle de données du jardin : constantes, création, validation (pur, sans DOM).
import { polygonArea, isSimplePolygon, shapePolygon, shapeArea, polygonInside, overlapArea, pointInPolygon } from './geometry.js';
import { getItemKind, getOpeningKind, itemPolygon, resolveSide } from './items.js';
import { ensureExisting, existingLabel } from './existing.js';

/** Types de zones. `layer` : 'ground' (au sol, exclusif) ou 'canopy' (au-dessus, superposable). */
export const ZONE_TYPES = [
  { id: 'pond', label: 'Mare / bassin', color: '#4aa3d8', icon: '💧', layer: 'ground', shapeKinds: ['polygon', 'circle'], minSun: 'partial' },
  { id: 'pool', label: 'Piscine', color: '#2ec4d6', icon: '🏊', layer: 'ground', shapeKinds: ['polygon', 'circle'], minSun: 'full' },
  { id: 'terrace', label: 'Terrasse', color: '#c9a77c', icon: '🪑', layer: 'ground', shapeKinds: ['polygon'], minSun: null },
  { id: 'path', label: 'Allée / cheminement', color: '#b8b0a2', icon: '🚶', layer: 'ground', shapeKinds: ['line', 'polygon'], defaultWidth: 1, minSun: null },
  { id: 'lawn', label: 'Pelouse', color: '#7cc95a', icon: '🌱', layer: 'ground', shapeKinds: ['polygon', 'circle'], minSun: 'partial' },
  { id: 'lowplants', label: 'Plantes basses / couvre-sol', color: '#9bd17a', icon: '🍀', layer: 'ground', shapeKinds: ['polygon', 'circle'], minSun: null },
  { id: 'midplants', label: 'Massif de plantes moyennes', color: '#e58fb0', icon: '🌸', layer: 'ground', shapeKinds: ['polygon', 'circle'], minSun: null },
  { id: 'tallplants', label: 'Plantes hautes', color: '#6aa86a', icon: '🌾', layer: 'ground', shapeKinds: ['polygon', 'circle', 'line'], defaultWidth: 1, minSun: null },
  { id: 'hedge', label: 'Haie', color: '#3f8f4a', icon: '🌿', layer: 'ground', shapeKinds: ['line', 'polygon'], defaultWidth: 1, minSun: null },
  { id: 'trees', label: 'Arbres', color: '#2e7d32', icon: '🌳', layer: 'canopy', shapeKinds: ['circle', 'polygon'], minSun: null },
  { id: 'vegetable', label: 'Potager', color: '#d9a441', icon: '🥕', layer: 'ground', shapeKinds: ['polygon'], minSun: 'full' },
  { id: 'orchard', label: 'Verger', color: '#e0793c', icon: '🍎', layer: 'canopy', shapeKinds: ['polygon', 'circle'], minSun: 'full' },
  { id: 'other', label: 'Autre', color: '#9e9e9e', icon: '📍', layer: 'ground', shapeKinds: ['polygon', 'circle', 'line'], defaultWidth: 1, minSun: null },
];

export const SUN_LEVELS = ['full', 'partial', 'shade'];
export const SUN_LABELS = { full: 'Plein soleil (≥ 6 h)', partial: 'Mi-ombre (3–6 h)', shade: 'Ombre (< 3 h)' };

export const WATER_NEEDS = ['low', 'medium', 'high'];
export const WATER_LABELS = { low: 'Faible', medium: 'Moyen', high: 'Élevé' };

export const PLANT_CATEGORIES = ['tree', 'shrub', 'hedge', 'fruit', 'climber', 'perennial', 'groundcover', 'grass', 'bulb', 'aquatic', 'vegetable', 'lawn'];
export const CATEGORY_LABELS = {
  tree: 'Arbre', shrub: 'Arbuste', hedge: 'Haie', fruit: 'Fruitier', climber: 'Grimpante', perennial: 'Vivace',
  groundcover: 'Couvre-sol', grass: 'Graminée', bulb: 'Bulbe', aquatic: 'Aquatique', vegetable: 'Légume', lawn: 'Gazon',
};

export const SOILS = ['clay', 'limestone', 'sandy', 'loam', 'humus'];
export const SOIL_LABELS = { clay: 'Argileux', limestone: 'Calcaire', sandy: 'Sableux', loam: 'Limoneux', humus: 'Humifère' };

/** Orientations : `azimuth` en degrés depuis le nord, sens horaire. */
export const ORIENTATIONS = [
  { id: 'N', label: 'Nord', azimuth: 0 },
  { id: 'NE', label: 'Nord-Est', azimuth: 45 },
  { id: 'E', label: 'Est', azimuth: 90 },
  { id: 'SE', label: 'Sud-Est', azimuth: 135 },
  { id: 'S', label: 'Sud', azimuth: 180 },
  { id: 'SW', label: 'Sud-Ouest', azimuth: 225 },
  { id: 'W', label: 'Ouest', azimuth: 270 },
  { id: 'NW', label: 'Nord-Ouest', azimuth: 315 },
];

/** Identifiant unique court (préfixe optionnel). */
export function newId(prefix = '') {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return prefix + c.randomUUID().replace(/-/g, '').slice(0, 16);
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/** Type de zone par id (undefined si inconnu). */
export function getZoneType(id) {
  return ZONE_TYPES.find((t) => t.id === id);
}

/** Nouveau jardin brouillon. */
export function createGarden(name = 'Mon jardin') {
  const now = new Date().toISOString();
  return {
    id: newId('g_'),
    name,
    createdAt: now,
    updatedAt: now,
    status: 'draft',
    context: {
      location: null, commune: null, departement: null, region: null, altitude: null,
      orientation: null, northAngle: 0, soil: null, slope: null, wind: null, roofArea: null,
      bedMode: 'manual', // 'manual' = je dessine mes massifs, 'auto' = l'app calcule les massifs (absent = 'manual')
    },
    boundary: [],
    boundaryClosed: false,
    obstacles: [],
    items: [],
    existing: [],
    boundaryEdges: [],
    openings: [],
    sun: { mode: 'unknown', uniform: null, regions: [] },
    wishedZoneTypes: [],
    zones: [],
    plan: { svg: null, validatedAt: null },
    tasksDone: {},
  };
}

/** Mode des massifs d'un jardin : 'manual' (défaut, y compris champ absent) ou 'auto'. */
export const BED_MODES = ['manual', 'auto'];
export function bedModeOf(g) {
  return g && g.context && g.context.bedMode === 'auto' ? 'auto' : 'manual';
}

/** Nouvelle zone d'un type donné (lève une erreur si le type est inconnu). */
export function createZone(typeId, shape) {
  const t = getZoneType(typeId);
  if (!t) throw new Error(`Type de zone inconnu : ${typeId}`);
  const z = { id: newId('z_'), type: typeId, label: t.label, shape, plantings: [], notes: '', ambiance: null, auto: false };
  if (typeId === 'pool') { z.variant = 'inground'; }
  return z;
}

/** Variantes d'une piscine : enterrée (défaut, absente = enterrée) ou hors sol. */
export const POOL_VARIANTS = [
  { id: 'inground', label: 'Enterrée' },
  { id: 'above', label: 'Hors sol' },
];
export const POOL_ABOVE_LABEL = 'Piscine hors sol';

/** Variante effective d'une zone (« inground » par défaut, seulement pour une piscine ; null sinon). */
export function poolVariant(zone) {
  if (!zone || zone.type !== 'pool') return null;
  return zone.variant === 'above' ? 'above' : 'inground';
}
export const isAbovePool = (zone) => poolVariant(zone) === 'above';

/**
 * Change la variante d'une piscine. Le libellé suit la variante tant qu'il est le libellé par défaut
 * (« Piscine » ↔ « Piscine hors sol », numéro éventuel conservé) ; un nom saisi n'est jamais écrasé.
 */
export function setPoolVariant(zone, variant) {
  if (!zone || zone.type !== 'pool') return zone;
  const v = variant === 'above' ? 'above' : 'inground';
  const base = getZoneType('pool').label;
  const m = /^(Piscine(?: hors sol)?)( \d+)?$/.exec(zone.label || '');
  zone.variant = v;
  if (m) zone.label = `${v === 'above' ? POOL_ABOVE_LABEL : base}${m[2] || ''}`;
  return zone;
}

/** Nouvel élément d'aménagement (lève une erreur si le type est inconnu). Cercle : `radius` et width = depth = diamètre. */
export function createItem(kindId, x = 0, y = 0, rotation = 0) {
  const k = getItemKind(kindId);
  if (!k) throw new Error(`Élément inconnu : ${kindId}`);
  const it = { id: newId('i_'), kind: kindId, x, y, rotation, width: k.w, depth: k.d };
  if (k.shape === 'circle') { it.radius = k.w / 2; }
  return it;
}

/** Nouvelle ouverture (portail, porte…) sur un côté `ref` à la position `t` (0..1). */
export function createOpening(kindId, ref, t = 0.5) {
  const k = getOpeningKind(kindId);
  if (!k) throw new Error(`Ouverture inconnue : ${kindId}`);
  return { id: newId('op_'), kind: kindId, ref, t, width: k.width, swing: k.swing };
}

/** Complète un jardin ancien avec les champs d'aménagement absents (sans toucher aux autres). */
export function ensureAmenagements(g) {
  if (!g || typeof g !== 'object') return g;
  if (!Array.isArray(g.items)) g.items = [];
  if (!Array.isArray(g.boundaryEdges)) g.boundaryEdges = [];
  if (!Array.isArray(g.openings)) g.openings = [];
  ensureExisting(g);
  return g;
}

const SEUIL_CHEVAUCHEMENT = 0.1; // m²

/**
 * Valide un jardin. Erreurs bloquantes : contour absent, non fermé, auto-intersecté, surface ≤ 1 m²,
 * zone dégénérée ou de type inconnu. Avertissements : zone hors contour, chevauchement de zones « au sol »,
 * zone souhaitée sans forme dessinée.
 * @returns {{ok:boolean, errors:string[], warnings:string[]}}
 */
export function validateGarden(g) {
  const errors = [];
  const warnings = [];
  const contour = g && Array.isArray(g.boundary) ? g.boundary : [];
  let contourValide = false;

  if (contour.length < 3) {
    errors.push('Le contour du terrain doit comporter au moins 3 sommets.');
  } else if (!g.boundaryClosed) {
    errors.push("Le contour du terrain n'est pas fermé.");
  } else if (!isSimplePolygon(contour)) {
    errors.push('Le contour du terrain se croise lui-même.');
  } else if (polygonArea(contour) <= 1) {
    errors.push('La surface du terrain doit dépasser 1 m².');
  } else {
    contourValide = true;
  }

  const zones = Array.isArray(g && g.zones) ? g.zones : [];
  const polys = [];
  zones.forEach((z, i) => {
    const nom = z.label || `Zone ${i + 1}`;
    const type = getZoneType(z.type);
    if (!type) {
      errors.push(`Zone « ${nom} » : type inconnu.`);
      return;
    }
    const poly = shapePolygon(z.shape);
    if (poly.length < 3 || shapeArea(z.shape) <= 1e-6) {
      errors.push(`Zone « ${nom} » : forme invalide ou vide.`);
      return;
    }
    polys.push({ z, nom, type, poly });
    if (contourValide && !polygonInside(poly, contour)) {
      warnings.push(`Zone « ${nom} » : sort du contour du terrain.`);
    }
  });

  // Chevauchement entre zones « au sol » uniquement.
  const sol = polys.filter((p) => p.type.layer === 'ground');
  for (let i = 0; i < sol.length; i++) {
    for (let j = i + 1; j < sol.length; j++) {
      if (overlapArea(sol[i].poly, sol[j].poly) > SEUIL_CHEVAUCHEMENT) {
        warnings.push(`Zones « ${sol[i].nom} » et « ${sol[j].nom} » : elles se chevauchent.`);
      }
    }
  }

  // Aménagements : éléments hors du terrain, ouvertures sans côté.
  const items = Array.isArray(g && g.items) ? g.items : [];
  items.forEach((it, i) => {
    const k = getItemKind(it.kind);
    const nom = (it.label || (k && k.label)) || `Élément ${i + 1}`;
    if (!k) { warnings.push(`Élément « ${nom} » : type inconnu.`); return; }
    if (contourValide && !polygonInside(itemPolygon(it), contour)) warnings.push(`Élément « ${nom} » : sort du contour du terrain.`);
  });
  const openings = Array.isArray(g && g.openings) ? g.openings : [];
  openings.forEach((op, i) => {
    const k = getOpeningKind(op.kind);
    const nom = (k && k.label) || `Ouverture ${i + 1}`;
    if (!resolveSide(g, op.ref)) warnings.push(`Ouverture « ${nom} » : le côté qui la porte n'existe plus.`);
  });

  // Plantes existantes : centre (ou tracé de haie) hors du terrain.
  const existing = Array.isArray(g && g.existing) ? g.existing : [];
  existing.forEach((e, i) => {
    if (!contourValide || !e) return;
    const pts = Array.isArray(e.points) && e.points.length ? e.points : [{ x: e.x, y: e.y }];
    if (pts.some((p) => !pointInPolygon(p, contour))) warnings.push(`${e.kind === 'fence' ? 'Clôture existante' : 'Plante existante'} « ${existingLabel(e) || `Élément ${i + 1}`} » : sort du contour du terrain.`);
  });

  // Zones souhaitées sans forme dessinée.
  const wished = Array.isArray(g && g.wishedZoneTypes) ? g.wishedZoneTypes : [];
  for (const id of wished) {
    if (!zones.some((z) => z.type === id)) {
      const t = getZoneType(id);
      warnings.push(`Zone souhaitée « ${t ? t.label : id} » : aucune forme dessinée.`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
