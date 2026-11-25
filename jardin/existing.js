// Plantes déjà présentes sur le terrain (arbres, arbustes, haies, grimpantes, massifs existants) : modèle, empreintes,
// ombre portée, résumé et données pour les rendus (pur, sans DOM).
// Données : `garden.existing = [{id, kind, plantId|null, label, x, y, points?, height, width, keep, notes}]`.
import { getPlant } from './catalog.js';
import { getHabit, habitOf } from './habits.js';
import { MATERIALS } from './items.js';

/**
 * Types d'éléments existants. `height` × `width` : dimensions typiques (m) ; `habit` : port par défaut sans essence ;
 * `category` : catégories du catalogue proposées ; `linear` : tracé en polyligne (haie) ; `palette: false` : hors palette.
 */
export const EXISTING_KINDS = [
  { id: 'tree', label: 'Arbre', plural: 'arbres', emoji: '🌳', color: '#4f8a3a', height: 8, width: 5, habit: 'tree-round', category: ['tree', 'fruit'], defaultLabel: 'Arbre existant' },
  { id: 'shrub', label: 'Arbuste', plural: 'arbustes', emoji: '🌿', color: '#6aa84a', height: 1.5, width: 1.5, habit: 'shrub-round', category: ['shrub'], defaultLabel: 'Arbuste existant' },
  { id: 'hedge', label: 'Haie', plural: 'haies', emoji: '🟩', color: '#3f8f4a', height: 1.8, width: 0.8, habit: 'hedge-clipped', category: ['hedge'], linear: true, defaultLabel: 'Haie existante' },
  { id: 'climber', label: 'Grimpante', plural: 'grimpantes', emoji: '🌱', color: '#5a9a4a', height: 2.5, width: 1.5, habit: 'climber', category: ['climber'], defaultLabel: 'Grimpante existante' },
  { id: 'perennial', label: 'Vivace / massif', plural: 'vivaces ou massifs', emoji: '🌸', color: '#c26a9a', height: 0.7, width: 1, habit: 'perennial-clump', category: ['perennial', 'grass', 'bulb', 'groundcover'], defaultLabel: 'Massif existant' },
  { id: 'fence', label: 'Clôture', plural: 'clôtures', emoji: '🚧', color: '#8d6e63', height: 1.2, width: 0.05, habit: null, category: [], linear: true, plant: false, defaultLabel: 'Clôture existante' },
  { id: 'other', label: 'Autre plante', plural: 'autres plantes', emoji: '🪴', color: '#7a9a5a', height: 1, width: 1, habit: 'shrub-round', category: [], defaultLabel: 'Plante existante', palette: false },
];
export const EXISTING_KIND_IDS = EXISTING_KINDS.map((k) => k.id);
export const getExistingKind = (id) => EXISTING_KINDS.find((k) => k.id === id);

/**
 * Matériaux d'une clôture existante : hauteur et épaisseur typiques (m) ; `opacity` : part de lumière arrêtée
 * (métal ajouré ≈ transparent, bois et béton opaques).
 */
export const FENCE_MATERIALS = [
  { id: 'wood', label: 'Bois', height: 1.2, thickness: 0.05, opacity: 1, color: MATERIALS.wood.color },
  { id: 'metal', label: 'Métal', height: 1.5, thickness: 0.03, opacity: 0.15, color: MATERIALS.metal.color },
  { id: 'concrete', label: 'Béton', height: 1.8, thickness: 0.15, opacity: 1, color: MATERIALS.concrete.color },
];
export const getFenceMaterial = (id) => FENCE_MATERIALS.find((m) => m.id === id) || FENCE_MATERIALS[0];

/** Facteurs d'âge appliqués à la taille adulte du catalogue. */
export const EXISTING_AGES = [
  { id: 'young', label: 'Jeune', factor: 0.4 },
  { id: 'adult', label: 'Adulte', factor: 1 },
  { id: 'old', label: 'Vieux', factor: 1.15 },
];

const num = (v, d) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
const SEG = 20;

function newEid() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return `e_${c.randomUUID().replace(/-/g, '').slice(0, 14)}`;
  return `e_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

const centroidOf = (pts) => {
  if (!pts.length) return { x: 0, y: 0 };
  return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
};

/** Nouvel élément existant. `at` : un point {x, y}, ou (haie) un tableau de points. */
export function createExisting(kind, at = { x: 0, y: 0 }) {
  const k = getExistingKind(kind);
  if (!k) throw new Error(`Type d'existant inconnu : ${kind}`);
  const e = { id: newEid(), kind, plantId: null, label: k.defaultLabel, x: 0, y: 0, height: k.height, width: k.width, keep: true, notes: '' };
  if (Array.isArray(at)) {
    e.points = at.map((p) => ({ x: p.x, y: p.y }));
    const c = centroidOf(e.points);
    e.x = c.x; e.y = c.y;
  } else {
    e.x = at.x; e.y = at.y;
    if (k.linear) { e.points = [{ x: at.x - 1, y: at.y }, { x: at.x + 1, y: at.y }]; }
  }
  if (kind === 'fence') { e.material = 'wood'; const m = getFenceMaterial('wood'); e.height = m.height; e.width = m.thickness; }
  return e;
}

/** Change le matériau d'une clôture existante (hauteur et épaisseur typiques du matériau). */
export function setFenceMaterial(e, material) {
  const m = getFenceMaterial(material);
  e.material = m.id; e.height = m.height; e.width = m.thickness;
  return e;
}

/** Essence du catalogue d'un existant (`lookup` injectable), ou null. */
export function existingPlant(e, lookup = getPlant) {
  return e && e.plantId ? (lookup(e.plantId) || null) : null;
}

/** Nom affiché : libellé saisi, sinon nom de l'essence, sinon libellé par défaut du type. */
export function existingLabel(e, lookup = getPlant) {
  if (e && typeof e.label === 'string' && e.label.trim()) return e.label.trim();
  const p = existingPlant(e, lookup);
  if (p) return p.commonName || p.id;
  const k = e && getExistingKind(e.kind);
  return k ? k.defaultLabel : 'Plante existante';
}

/** Taille actuelle estimée d'une essence selon l'âge ('young' | 'adult' | 'old' ou facteur) : {height, width} en m. */
export function sizeForPlant(plant, age = 'adult', kind = null) {
  const a = EXISTING_AGES.find((x) => x.id === age);
  const f = a ? a.factor : num(age, 1);
  const k = getExistingKind(kind) || null;
  const h0 = num(plant && plant.heightAdult, k ? k.height : 1);
  const w0 = num(plant && plant.widthAdult, k ? k.width : 1);
  const r = (v) => Math.max(0.1, Math.round(v * 20) / 20);
  return { height: r(h0 * f), width: r(w0 * (0.5 + 0.5 * f)) };
}

/** Type d'existant conseillé pour une catégorie du catalogue. */
export function kindForCategory(category) {
  const k = EXISTING_KINDS.find((x) => x.category.includes(category));
  return k ? k.id : 'other';
}

/**
 * Complète un jardin avec `existing` et y migre les obstacles « arbre existant » (kind:'tree') de l'éditeur de contour,
 * en conservant leurs ids. Idempotent.
 */
export function ensureExisting(g) {
  if (!g || typeof g !== 'object') return g;
  if (!Array.isArray(g.existing)) g.existing = [];
  // assainit les entrées
  g.existing = g.existing.filter((e) => e && typeof e === 'object').map((e) => {
    const k = getExistingKind(e.kind) || getExistingKind('other');
    const out = { ...e };
    out.kind = k.id;
    if (!out.id) out.id = newEid();
    if (out.plantId === undefined) out.plantId = null;
    if (typeof out.label !== 'string') out.label = k.defaultLabel;
    if (Array.isArray(out.points)) out.points = out.points.filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y)).map((p) => ({ x: p.x, y: p.y }));
    if (k.linear && (!out.points || out.points.length < 2)) out.points = [{ x: num(out.x, 0) - 1, y: num(out.y, 0) }, { x: num(out.x, 0) + 1, y: num(out.y, 0) }];
    if (out.points && out.points.length) {
      if (!Number.isFinite(out.x) || !Number.isFinite(out.y)) { const c = centroidOf(out.points); out.x = c.x; out.y = c.y; }
    } else { out.x = num(out.x, 0); out.y = num(out.y, 0); }
    out.height = Math.max(0.05, num(out.height, k.height));
    out.width = Math.max(0.02, num(out.width, k.width));
    out.keep = out.keep !== false;
    if (typeof out.notes !== 'string') out.notes = '';
    if (k.id === 'fence') out.material = FENCE_MATERIALS.some((m) => m.id === out.material) ? out.material : 'wood';
    else delete out.material;
    return out;
  });
  if (Array.isArray(g.obstacles)) {
    const have = new Set(g.existing.map((e) => e.id));
    const rest = [];
    for (const o of g.obstacles) {
      if (o && o.kind === 'tree' && o.center) {
        const id = o.id || newEid();
        if (!have.has(id)) {
          have.add(id);
          g.existing.push({
            id, kind: 'tree', plantId: null, label: getExistingKind('tree').defaultLabel,
            x: o.center.x, y: o.center.y, height: num(o.height, 8), width: Math.max(0.2, num(o.radius, 2) * 2), keep: true, notes: '',
          });
        }
      } else rest.push(o);
    }
    if (rest.length !== g.obstacles.length) g.obstacles = rest;
  }
  return g;
}

const circle = (c, r, n = SEG) => Array.from({ length: n }, (_, i) => {
  const t = (2 * Math.PI * i) / n;
  return { x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t) };
});

/** Bande de largeur `w` autour d'une polyligne (décalage des sommets par la normale moyenne). */
function band(points, w) {
  const n = points.length;
  const half = w / 2;
  const left = []; const right = [];
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)]; const b = points[Math.min(n - 1, i + 1)];
    let dx = b.x - a.x; let dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 1;
    dx /= L; dy /= L;
    left.push({ x: points[i].x - dy * half, y: points[i].y + dx * half });
    right.push({ x: points[i].x + dy * half, y: points[i].y - dx * half });
  }
  return [...left, ...right.reverse()];
}

/** Empreinte au sol d'un existant : houppier échantillonné (cercle) ou bande de haie. */
export function existingFootprint(e) {
  if (!e) return [];
  const w = Math.max(0.02, num(e.width, 1));
  if (Array.isArray(e.points) && e.points.length >= 2) return band(e.points, w);
  return circle({ x: num(e.x, 0), y: num(e.y, 0) }, w / 2);
}

/** Existants comptés dans le plan futur : ceux « à retirer » sont écartés sauf `includeRemoved`. */
function actifs(garden, includeRemoved) {
  return ((garden && garden.existing) || []).filter((e) => e && (includeRemoved || e.keep !== false));
}

/** Empreintes de tous les existants conservés : [{id, kind, keep, polygon}] (espace occupé, pour l'espace libre des massifs). */
export function existingFootprints(garden, { includeRemoved = false } = {}) {
  return actifs(garden, includeRemoved).map((e) => ({ id: e.id, kind: e.kind, keep: e.keep !== false, polygon: existingFootprint(e) }));
}

/**
 * Obstacles d'ombre pour sun.js : disques {kind:'tree'|'shrub', center, radius, height} ou polylignes (haie).
 * Les éléments « à retirer » ne projettent pas d'ombre (plan futur) ; `includeRemoved` les garde.
 */
export function existingShadowObstacles(garden, { includeRemoved = false } = {}) {
  const out = [];
  for (const e of actifs(garden, includeRemoved)) {
    const height = num(e.height, 0);
    if (!(height > 0)) continue;
    const opacity = e.kind === 'fence' ? getFenceMaterial(e.material).opacity : 1;
    if (opacity < 0.5) continue; // clôture ajourée : presque pas d'ombre
    if (Array.isArray(e.points) && e.points.length >= 2) {
      out.push({ id: `existing_${e.id}`, kind: e.kind === 'fence' ? 'fence' : 'hedge', existing: true, thickness: e.kind === 'fence' ? num(e.width, 0.05) : num(e.width, 0.8), opacity, points: e.points.map((p) => ({ x: p.x, y: p.y })), height });
    } else {
      out.push({ id: `existing_${e.id}`, kind: e.kind === 'tree' ? 'tree' : 'shrub', existing: true, center: { x: num(e.x, 0), y: num(e.y, 0) }, radius: Math.max(0.05, num(e.width, 1) / 2), height });
    }
  }
  return out;
}

/** Résumé : {total, byKind, toRemove, text} — « 3 existants : 2 arbres, 1 haie ». */
export function existingSummary(garden) {
  const list = (garden && garden.existing) || [];
  const byKind = {};
  for (const e of list) byKind[e.kind] = (byKind[e.kind] || 0) + 1;
  const toRemove = list.filter((e) => e.keep === false).length;
  const parts = EXISTING_KINDS.filter((k) => byKind[k.id]).map((k) => `${byKind[k.id]} ${byKind[k.id] > 1 ? k.plural : k.label.toLowerCase().replace(' / massif', '')}`);
  const total = list.length;
  const text = total ? `${total} existant${total > 1 ? 's' : ''} : ${parts.join(', ')}` : 'Aucun existant';
  return { total, byKind, toRemove, text };
}

/**
 * Données pour les rendus isométrique / 3D : [{id, kind, plant (catalogue ou null), x, y, points?, height, width, keep, habit, label}].
 * `habit` : port (habits.js) de l'essence, sinon port par défaut du type.
 */
export function existingForRender(garden, { lookup = getPlant } = {}) {
  return ((garden && garden.existing) || []).map((e) => {
    const k = getExistingKind(e.kind) || getExistingKind('other');
    const plant = existingPlant(e, lookup);
    const habit = k.habit ? (plant ? habitOf(plant) : getHabit(k.habit)) : null;
    const r = {
      id: e.id, kind: e.kind, plant, x: e.x, y: e.y, height: e.height, width: e.width, keep: e.keep !== false, habit, label: existingLabel(e, lookup),
    };
    if (e.kind === 'fence') r.material = getFenceMaterial(e.material).id;
    if (Array.isArray(e.points) && e.points.length >= 2) r.points = e.points.map((p) => ({ x: p.x, y: p.y }));
    return r;
  });
}
