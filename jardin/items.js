// Aménagements du jardin : catalogue de mobilier/équipements, types d'ouvertures (portail, porte…),
// géométrie des éléments, des côtés de contour et des passages (pur, sans DOM).
// Repère : mètres, x vers la droite, y vers le bas ; rotation en degrés, sens horaire à l'écran.
import { pointInPolygon, signedArea } from './geometry.js';

/**
 * Catalogue des éléments posables. `w` × `d` : largeur × profondeur par défaut (m) ; `shape` : 'rect' | 'circle'
 * (pour un cercle, `w` = `d` = diamètre). `priceEur` : prix moyen indicatif en France (€ TTC).
 * `height` : hauteur (m) projetant une ombre (absent = sans effet sur l'ensoleillement).
 */
export const ITEM_KINDS = [
  { id: 'bench', label: 'Banc', short: 'Banc', emoji: '🪑', category: 'furniture', w: 1.5, d: 0.5, shape: 'rect', color: '#a1887f', priceEur: 90 },
  { id: 'table', label: 'Table rectangulaire', short: 'Table', emoji: '🍽️', category: 'furniture', w: 1.8, d: 0.9, shape: 'rect', color: '#bcaaa4', priceEur: 250 },
  { id: 'table_round', label: 'Table ronde', short: 'Table', emoji: '⭕', category: 'furniture', w: 1.2, d: 1.2, shape: 'circle', color: '#bcaaa4', priceEur: 200 },
  { id: 'chair', label: 'Chaise', short: 'Chaise', emoji: '💺', category: 'furniture', w: 0.5, d: 0.5, shape: 'rect', color: '#8d6e63', priceEur: 40 },
  { id: 'lounge', label: 'Salon de jardin', short: 'Salon', emoji: '🛋️', category: 'furniture', w: 2.4, d: 2.4, shape: 'rect', color: '#90a4ae', priceEur: 450 },
  { id: 'sunbed', label: 'Transat / bain de soleil', short: 'Transat', emoji: '🏖️', category: 'furniture', w: 0.65, d: 1.9, shape: 'rect', color: '#ffcc80', priceEur: 120 },
  { id: 'parasol', label: 'Parasol', short: 'Parasol', emoji: '⛱️', category: 'furniture', w: 3, d: 3, shape: 'circle', color: '#ef9a9a', priceEur: 150, height: 2.5 },
  { id: 'hammock', label: 'Hamac sur pied', short: 'Hamac', emoji: '🛏️', category: 'furniture', w: 3.5, d: 1, shape: 'rect', color: '#ce93d8', priceEur: 130 },
  { id: 'bbq', label: 'Barbecue / plancha', short: 'Barbecue', emoji: '🔥', category: 'equipment', w: 0.9, d: 0.6, shape: 'rect', color: '#757575', priceEur: 220 },
  { id: 'firepit', label: 'Brasero / foyer', short: 'Brasero', emoji: '🪵', category: 'equipment', w: 0.8, d: 0.8, shape: 'circle', color: '#8d6e63', priceEur: 80 },
  { id: 'composter', label: 'Composteur', short: 'Compost', emoji: '♻️', category: 'equipment', w: 0.8, d: 0.8, shape: 'rect', color: '#6d4c41', priceEur: 60 },
  { id: 'rain_tank', label: 'Cuve de récupération d’eau', short: 'Cuve', emoji: '🛢️', category: 'equipment', w: 1, d: 1, shape: 'circle', color: '#4fc3f7', priceEur: 150, height: 1.5 },
  { id: 'planter', label: 'Jardinière / bac', short: 'Bac', emoji: '🪴', category: 'equipment', w: 1, d: 0.4, shape: 'rect', color: '#a5d6a7', priceEur: 40 },
  { id: 'raised_bed', label: 'Carré potager surélevé', short: 'Potager', emoji: '🥬', category: 'equipment', w: 1.2, d: 1.2, shape: 'rect', color: '#c5e1a5', priceEur: 70 },
  { id: 'woodpile', label: 'Abri à bûches', short: 'Bûches', emoji: '🪓', category: 'equipment', w: 1.5, d: 0.5, shape: 'rect', color: '#a1887f', priceEur: 90 },
  { id: 'clothesline', label: 'Étendoir', short: 'Étendoir', emoji: '🧺', category: 'equipment', w: 1.6, d: 1.6, shape: 'rect', color: '#b0bec5', priceEur: 60 },
  { id: 'mailbox', label: 'Boîte aux lettres', short: 'Boîte', emoji: '📮', category: 'equipment', w: 0.4, d: 0.3, shape: 'rect', color: '#ffb74d', priceEur: 40 },
  { id: 'light', label: 'Éclairage / lampadaire', short: 'Lampe', emoji: '💡', category: 'equipment', w: 0.3, d: 0.3, shape: 'circle', color: '#fff176', priceEur: 40 },
  { id: 'fountain', label: 'Fontaine', short: 'Fontaine', emoji: '⛲', category: 'equipment', w: 0.8, d: 0.8, shape: 'circle', color: '#81d4fa', priceEur: 150 },
  { id: 'swing', label: 'Balançoire', short: 'Balançoire', emoji: '🎠', category: 'equipment', w: 3, d: 2, shape: 'rect', color: '#ffab91', priceEur: 250 },
  { id: 'trampoline', label: 'Trampoline', short: 'Trampo', emoji: '🤸', category: 'equipment', w: 3, d: 3, shape: 'circle', color: '#9fa8da', priceEur: 250 },
  { id: 'sandbox', label: 'Bac à sable', short: 'Sable', emoji: '🏖️', category: 'equipment', w: 1.2, d: 1.2, shape: 'rect', color: '#ffe082', priceEur: 80 },
  { id: 'playhouse', label: 'Cabane enfant', short: 'Cabane', emoji: '🛖', category: 'structure', w: 1.5, d: 1.5, shape: 'rect', color: '#bcaaa4', priceEur: 300, height: 1.8 },
  { id: 'shed_item', label: 'Abri de jardin', short: 'Abri', emoji: '🏚️', category: 'structure', w: 2.5, d: 2, shape: 'rect', color: '#a1887f', priceEur: 600, height: 2.3 },
  { id: 'greenhouse', label: 'Serre', short: 'Serre', emoji: '🏡', category: 'structure', w: 3, d: 2, shape: 'rect', color: '#b2dfdb', priceEur: 500, height: 2 },
  { id: 'pergola', label: 'Pergola', short: 'Pergola', emoji: '🏛️', category: 'structure', w: 3, d: 3, shape: 'rect', color: '#d7ccc8', priceEur: 900, height: 2.4 },
  { id: 'gazebo', label: 'Tonnelle', short: 'Tonnelle', emoji: '⛺', category: 'structure', w: 3, d: 3, shape: 'rect', color: '#e0e0e0', priceEur: 500, height: 2.5 },
];

export const ITEM_CATEGORIES = [
  { id: 'furniture', label: 'Mobilier' },
  { id: 'equipment', label: 'Équipements' },
  { id: 'structure', label: 'Structures' },
];

/** Types d'ouverture. `targets` : où le passage peut se poser (contour du terrain, types d'obstacles). */
export const OPENING_KINDS = [
  { id: 'gate', label: 'Portail', emoji: '🚪', width: 3, swing: 'in', color: '#5d4037', targets: ['boundary', 'wall', 'fence', 'house', 'shed'] },
  { id: 'wicket', label: 'Portillon', emoji: '🚪', width: 1, swing: 'in', color: '#6d4c41', targets: ['boundary', 'wall', 'fence'] },
  { id: 'door', label: 'Porte', emoji: '🚪', width: 0.9, swing: 'out', color: '#8d6e63', targets: ['house', 'shed'] },
  { id: 'garage', label: 'Porte de garage', emoji: '🚗', width: 2.4, swing: 'sliding', color: '#607d8b', targets: ['house', 'shed'] },
  { id: 'double_gate', label: 'Double portail', emoji: '🚧', width: 4, swing: 'in', color: '#4e342e', targets: ['boundary', 'wall', 'fence'] },
];
export const OPENING_SWINGS = [
  { id: 'in', label: 'S’ouvre vers l’intérieur' },
  { id: 'out', label: 'S’ouvre vers l’extérieur' },
  { id: 'sliding', label: 'Coulissant / sectionnel' },
];

/** Côtés de contour : types et hauteurs par défaut (m). */
export const EDGE_KINDS = [
  { id: 'open', label: 'Ouvert', height: 0 },
  { id: 'wall', label: 'Mur', height: 2, thickness: 0.2, color: '#424242' },
  { id: 'fence', label: 'Clôture', height: 1.2, thickness: 0.05, color: '#6d4c41' },
  { id: 'hedge', label: 'Haie', height: 1.8, thickness: 0.6, color: '#3f8f4a' },
];
export const EDGE_IDS = EDGE_KINDS.map((k) => k.id);

/** Matériaux des murs et clôtures (côtés du contour, clôtures libres, clôtures existantes). */
export const MATERIALS = {
  wood: { label: 'Bois', color: '#8d6e63' },
  metal: { label: 'Métal', color: '#455a64' },
  concrete: { label: 'Béton', color: '#9e9e9e' },
  stone: { label: 'Pierre', color: '#a1887f' },
  brick: { label: 'Brique', color: '#b5593c' },
  mesh: { label: 'Grillage', color: '#78909c' },
};
export const EDGE_MATERIALS = { wall: ['stone', 'concrete', 'brick'], fence: ['wood', 'metal', 'concrete', 'mesh'] };
export const defaultMaterial = (kind) => (kind === 'wall' ? 'stone' : kind === 'fence' ? 'wood' : null);
/** Matériau effectif d'un côté de contour (ou d'une clôture libre) : valeur valide, sinon défaut du type. */
export function materialOf(kind, material) {
  const ids = EDGE_MATERIALS[kind];
  if (!ids) return null;
  return ids.includes(material) ? material : defaultMaterial(kind);
}

export const getItemKind = (id) => ITEM_KINDS.find((k) => k.id === id);
export const getOpeningKind = (id) => OPENING_KINDS.find((k) => k.id === id);
export const getEdgeKind = (id) => EDGE_KINDS.find((k) => k.id === id);

const rad = (d) => (d * Math.PI) / 180;
const CERCLE = 24;
/** Obstacles polygonaux fermés ; les autres (mur, clôture) sont des polylignes ouvertes. */
const FERMES = new Set(['house', 'shed']);

/** Rayon d'un élément circulaire (undefined pour un rectangle). */
export const itemRadius = (item) => (item && Number.isFinite(item.radius) && item.radius > 0 ? item.radius : null);

/** Demi-dimensions d'un élément (m) : {hw, hd}. */
export function itemHalfSize(item) {
  const r = itemRadius(item);
  if (r != null) return { hw: r, hd: r };
  return { hw: Math.max(0.01, item.width || 0.5) / 2, hd: Math.max(0.01, item.depth || 0.5) / 2 };
}

/** Polygone d'un élément : rectangle tourné (4 sommets) ou cercle échantillonné (24 sommets). */
export function itemPolygon(item, segments = CERCLE) {
  const cx = item.x; const cy = item.y;
  const r = itemRadius(item);
  if (r != null) {
    const pts = [];
    for (let i = 0; i < segments; i++) {
      const t = (2 * Math.PI * i) / segments;
      pts.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) });
    }
    return pts;
  }
  const { hw, hd } = itemHalfSize(item);
  const a = rad(item.rotation || 0);
  const c = Math.cos(a); const s = Math.sin(a);
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([lx, ly]) => ({ x: cx + lx * c - ly * s, y: cy + lx * s + ly * c }));
}

/** Le point est-il dans l'élément ? */
export function itemContains(item, p) {
  return pointInPolygon(p, itemPolygon(item));
}

/** Côtés du contour : [{i, a, b}] (n côtés si fermé, n-1 sinon). */
export function boundarySides(garden) {
  const b = (garden && garden.boundary) || [];
  const n = b.length;
  if (n < 2) return [];
  const count = garden.boundaryClosed && n >= 3 ? n : n - 1;
  const out = [];
  for (let i = 0; i < count; i++) out.push({ i, a: b[i], b: b[(i + 1) % n] });
  return out;
}

/** Côtés d'un obstacle : maison/abri = polygone fermé, mur/clôture = polyligne ; arbre = aucun. */
export function obstacleSides(ob) {
  const pts = ob && ob.points;
  if (!pts || pts.length < 2) return [];
  const n = pts.length;
  const count = FERMES.has(ob.kind) && n >= 3 ? n : n - 1;
  const out = [];
  for (let i = 0; i < count; i++) out.push({ i, a: pts[i], b: pts[(i + 1) % n] });
  return out;
}

/** Côté désigné par une référence d'ouverture : {a, b, outward (+1/-1), closed} ou null. */
export function resolveSide(garden, ref) {
  if (!ref || !Number.isInteger(ref.side) || ref.side < 0) return null;
  if (ref.type === 'boundary') {
    const s = boundarySides(garden).find((x) => x.i === ref.side);
    if (!s) return null;
    const closed = !!garden.boundaryClosed && garden.boundary.length >= 3;
    return { a: s.a, b: s.b, outward: closed ? (Math.sign(signedArea(garden.boundary)) || 1) : 1, kind: 'boundary' };
  }
  if (ref.type === 'obstacle') {
    const ob = ((garden && garden.obstacles) || []).find((o) => o.id === ref.obstacleId);
    if (!ob) return null;
    const s = obstacleSides(ob).find((x) => x.i === ref.side);
    if (!s) return null;
    const closedPoly = FERMES.has(ob.kind) && ob.points.length >= 3;
    return { a: s.a, b: s.b, outward: closedPoly ? (Math.sign(signedArea(ob.points)) || 1) : 1, kind: ob.kind };
  }
  if (ref.type === 'existing') {
    const ex = ((garden && garden.existing) || []).find((e) => e.id === ref.existingId);
    if (!ex || ex.kind !== 'fence' || !Array.isArray(ex.points)) return null;
    const s = obstacleSides(ex).find((x) => x.i === ref.side);
    if (!s) return null;
    return { a: s.a, b: s.b, outward: 1, kind: 'fence' };
  }
  return null;
}

/**
 * Segment du passage d'une ouverture : {a, b, center, normal, width, u, t}. `normal` est unitaire et dirigé vers
 * l'extérieur du terrain (ou du bâtiment) ; `t` est ramené pour que le passage tienne sur son côté. Null si le côté
 * n'existe plus.
 */
export function openingGeometry(garden, opening) {
  const side = resolveSide(garden, opening && opening.ref);
  if (!side) return null;
  const dx = side.b.x - side.a.x; const dy = side.b.y - side.a.y;
  const L = Math.hypot(dx, dy);
  if (L < 1e-9) return null;
  const u = { x: dx / L, y: dy / L };
  const width = Math.min(Math.max(0.1, opening.width || 1), L);
  const half = width / 2 / L;
  const t = Math.min(1 - half, Math.max(half, Number.isFinite(opening.t) ? opening.t : 0.5));
  const center = { x: side.a.x + dx * t, y: side.a.y + dy * t };
  // sens horaire à l'écran (aire signée > 0) : l'extérieur est à gauche du sens de parcours = (uy, -ux)
  const normal = { x: u.y * side.outward, y: -u.x * side.outward };
  const w2 = width / 2;
  return {
    a: { x: center.x - u.x * w2, y: center.y - u.y * w2 },
    b: { x: center.x + u.x * w2, y: center.y + u.y * w2 },
    center, normal, u, width, t, sideLength: L, sideKind: side.kind,
  };
}

/** L'obstacle `ob` accepte-t-il ce type d'ouverture ? */
export function openingAllowedOn(kindId, target) {
  const k = getOpeningKind(kindId);
  if (!k) return false;
  return k.targets.includes(target);
}

/**
 * Côté le plus proche d'un point, parmi ceux acceptant le type d'ouverture (`kind`, tous si omis) :
 * {ref, t, point, dist} ou null. `maxDist` (m) limite la recherche.
 */
export function snapOpeningToSides(garden, point, { kind = null, maxDist = Infinity } = {}) {
  let best = null;
  const essai = (a, b, ref) => {
    const dx = b.x - a.x; const dy = b.y - a.y;
    const L2 = dx * dx + dy * dy;
    if (L2 < 1e-12) return;
    const t = Math.min(1, Math.max(0, ((point.x - a.x) * dx + (point.y - a.y) * dy) / L2));
    const q = { x: a.x + dx * t, y: a.y + dy * t };
    const dist = Math.hypot(point.x - q.x, point.y - q.y);
    if (dist <= maxDist && (!best || dist < best.dist)) best = { ref, t, point: q, dist };
  };
  if (!kind || openingAllowedOn(kind, 'boundary')) {
    for (const s of boundarySides(garden)) essai(s.a, s.b, { type: 'boundary', side: s.i });
  }
  for (const ob of (garden && garden.obstacles) || []) {
    if (!['house', 'shed', 'wall', 'fence'].includes(ob.kind)) continue;
    if (kind && !openingAllowedOn(kind, ob.kind)) continue;
    for (const s of obstacleSides(ob)) essai(s.a, s.b, { type: 'obstacle', obstacleId: ob.id, side: s.i });
  }
  for (const ex of (garden && garden.existing) || []) {
    if (ex.kind !== 'fence' || !Array.isArray(ex.points)) continue;
    if (kind && !openingAllowedOn(kind, 'fence')) continue;
    for (const s of obstacleSides(ex)) essai(s.a, s.b, { type: 'existing', existingId: ex.id, side: s.i });
  }
  return best;
}

/** Type d'un côté de contour : 'open' | 'wall' | 'fence' | 'hedge'. */
export function edgeKindOf(garden, i) {
  const e = garden && Array.isArray(garden.boundaryEdges) ? garden.boundaryEdges[i] : null;
  return e && EDGE_IDS.includes(e.kind) ? e.kind : 'open';
}

/** Hauteur (m) d'un côté de contour. */
export function edgeHeightOf(garden, i) {
  const e = garden && Array.isArray(garden.boundaryEdges) ? garden.boundaryEdges[i] : null;
  const k = getEdgeKind(edgeKindOf(garden, i));
  if (!k || k.id === 'open') return 0;
  return e && Number.isFinite(e.height) && e.height > 0 ? e.height : k.height;
}

/**
 * Obstacles linéaires dérivés des côtés du contour murs / clôtures / haies :
 * [{id, kind, points:[a, b], height, edge}] (mur 2 m, clôture 1,2 m, haie 1,8 m par défaut).
 */
export function edgeObstacles(garden) {
  const out = [];
  for (const s of boundarySides(garden)) {
    const kind = edgeKindOf(garden, s.i);
    if (kind === 'open') continue;
    out.push({ id: `edge_${s.i}`, kind, points: [{ x: s.a.x, y: s.a.y }, { x: s.b.x, y: s.b.y }], height: edgeHeightOf(garden, s.i), edge: s.i });
  }
  return out;
}

/** Obstacles d'ombre issus des éléments hauts (pergola, parasol, abri…) : polygones avec hauteur. */
export function itemObstacles(garden) {
  const out = [];
  for (const it of (garden && garden.items) || []) {
    const k = getItemKind(it.kind);
    const h = it.height != null ? it.height : k && k.height;
    if (!(h > 0)) continue;
    out.push({ id: `item_${it.id}`, kind: 'item', itemKind: it.kind, points: itemPolygon(it), height: h });
  }
  return out;
}

/** Prix indicatif total (€) des éléments posés. */
export function itemsTotalPrice(garden) {
  let s = 0;
  for (const it of (garden && garden.items) || []) {
    const k = getItemKind(it.kind);
    if (k) s += k.priceEur || 0;
  }
  return s;
}
