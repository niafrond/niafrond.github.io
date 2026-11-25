// Ambiances de jardin (« Surprends-moi ») : liste, détection dans un libellé, affinité d'une essence (pur).
import TAGS from './data/plants/ambiances-tags.js';

/** keywords : minuscules sans accents ; un mot-clé de 4 lettres ou plus accepte n'importe quelle fin de mot (radical). */
export const AMBIANCES = [
  { id: 'bucolique', label: 'Bucolique', emoji: '🌼', desc: 'Un jardin champêtre : fleurs des champs, vivaces rustiques et mellifères, ambiance de campagne.', keywords: ['bucolique', 'champetre', 'campagnard', 'campagne', 'pastoral'] },
  { id: 'decoratif', label: 'Décoratif', emoji: '🎨', desc: 'Des floraisons spectaculaires, des couleurs vives et des feuillages ornementaux pour faire de l\'effet.', keywords: ['decoratif', 'decorative', 'ornemental', 'spectaculaire'] },
  { id: 'sauvage', label: 'Sauvage', emoji: '🦔', desc: 'Un coin naturel d\'essences indigènes, très peu d\'entretien et un refuge pour la faune.', keywords: ['sauvage', 'naturel', 'naturelle', 'friche', 'refuge', 'biodiversite', 'ensauvage'] },
  { id: 'zen', label: 'Zen', emoji: '🎋', desc: 'Un esprit japonais sobre : graminées, feuillages, érables, bambous non traçants et mousses.', keywords: ['zen', 'japonais', 'japonaise', 'japon', 'nippon'] },
  { id: 'mediterraneen', label: 'Méditerranéen', emoji: '🫒', desc: 'Lavande, olivier, romarin et plantes sèches au feuillage gris, qui aiment le soleil et la sécheresse.', keywords: ['mediterran', 'provencal', 'provence', 'garrigue', 'maquis'] },
  { id: 'gourmand', label: 'Gourmand', emoji: '🍓', desc: 'Des plantes comestibles : légumes, aromatiques, petits fruits et fruitiers.', keywords: ['gourmand', 'comestible', 'nourricier', 'nourriciere'] },
  { id: 'romantique', label: 'Romantique', emoji: '🌹', desc: 'Roses, clématites, tons pastel et floraisons parfumées pour un jardin tout en douceur.', keywords: ['romantique', 'romance', 'cottage', 'anglais', 'anglaise'] },
  { id: 'contemporain', label: 'Contemporain', emoji: '◼️', desc: 'Un style minimaliste : graminées, formes nettes, peu de couleurs et des plantes structurantes.', keywords: ['contemporain', 'moderne', 'minimal', 'epure', 'design'] },
  { id: 'exotique', label: 'Exotique', emoji: '🌴', desc: 'Grands feuillages luxuriants et floraisons éclatantes : un effet jungle, mais rustique.', keywords: ['exotique', 'tropical', 'tropicale', 'jungle', 'luxuriant'] },
  { id: 'pollinisateurs', label: 'Pollinisateurs', emoji: '🐝', desc: 'Des plantes mellifères pour attirer abeilles, bourdons et papillons toute la saison.', keywords: ['pollinis', 'abeille', 'papillon', 'mellifer', 'butin'] },
  { id: 'apaisant', label: 'Apaisant', emoji: '🕊️', desc: 'Des tons blancs, bleus et verts pour un coin calme où se reposer.', keywords: ['apaisant', 'calme', 'serein', 'sereine', 'reposant', 'tranquille', 'detente', 'relaxant', 'zenitude'] },
  { id: 'colore', label: 'Coloré', emoji: '🌈', desc: 'Une explosion de couleurs, avec une floraison étalée sur toute la saison.', keywords: ['colore', 'coloree', 'multicolore', 'arc en ciel', 'flamboyant'] },
];

const BY_ID = new Map(AMBIANCES.map((a) => [a.id, a]));

/** Ambiance par id (null si inconnue). */
export function getAmbiance(id) {
  return BY_ID.get(id) || null;
}

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Détecte une ambiance explicite dans un texte (nom de zone) : premier mot d'ambiance rencontré, sinon null. */
export function detectAmbiance(texte) {
  const t = ` ${norm(texte)}`;
  if (t.trim() === '') return null;
  let best = null, bestIdx = Infinity;
  for (const a of AMBIANCES) {
    for (const k of a.keywords) {
      const i = t.indexOf(` ${k}`);
      if (i < 0) continue;
      const end = i + 1 + k.length;
      if (k.length < 4 && end < t.length && t[end] !== ' ') continue;
      if (i < bestIdx) { bestIdx = i; best = a.id; }
    }
  }
  return best;
}

// ---------- déductions de repli (essence sans tag) ----------
function hexToHsl(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s, l };
}

/** Floraison de couleur vive (saturée, ni pâle ni sombre) : contraire d'une ambiance calme. */
function isVivid(plant) {
  const c = hexToHsl(plant.flowerColor);
  return !!c && c.s >= 0.6 && c.l >= 0.3 && c.l <= 0.65;
}
function isCalmColor(plant) {
  const c = hexToHsl(plant.flowerColor);
  if (!c) return plant.category === 'grass' || plant.foliage === 'evergreen';
  return c.s < 0.4 || c.l > 0.8 || (c.h >= 180 && c.h <= 270) || (c.h >= 60 && c.h < 180);
}

function deduce(plant) {
  const out = [];
  const add = (a) => { if (!out.includes(a)) out.push(a); };
  if (plant.edible || plant.category === 'vegetable' || plant.category === 'fruit') add('gourmand');
  if (plant.melliferous) add('pollinisateurs');
  if (plant.category === 'grass') { add('contemporain'); add('zen'); add('sauvage'); }
  if (plant.water === 'low' && (plant.sun || []).includes('full') && !(plant.sun || []).includes('shade') && plant.foliage === 'evergreen') add('mediterraneen');
  if (plant.category === 'aquatic' || plant.category === 'groundcover') add('sauvage');
  if (plant.category === 'perennial' || plant.category === 'lawn') add('bucolique');
  if ((plant.bloom || []).length >= 5 && isVivid(plant)) add('colore');
  if (plant.category !== 'vegetable' && isCalmColor(plant) && !isVivid(plant)) add('apaisant');
  if (plant.maintenance === 'low' && plant.melliferous && plant.category !== 'tree') add('sauvage');
  return out;
}

/** Ambiances typiques d'une essence (tags explicites, sinon déductions), par ordre de pertinence. */
export function plantAmbiances(plant) {
  const tag = plant && TAGS[plant.id];
  if (tag && Array.isArray(tag.ambiances) && tag.ambiances.length) return tag.ambiances.slice();
  return plant ? deduce(plant) : [];
}

/** Ambiances auxquelles l'essence ne convient pas. */
export function plantAvoids(plant) {
  const tag = plant && TAGS[plant.id];
  return tag && Array.isArray(tag.avoid) ? tag.avoid.slice() : [];
}

/** Affinité essence/ambiance : 1 très typique, 0,5 compatible, 0 contraire. */
export function plantAmbianceScore(plant, ambianceId) {
  if (!plant || !BY_ID.has(ambianceId)) return 0.5;
  if (plantAvoids(plant).includes(ambianceId)) return 0;
  const tag = TAGS[plant.id];
  const tagged = tag && Array.isArray(tag.ambiances) && tag.ambiances.length ? tag.ambiances : null;
  const list = tagged || deduce(plant);
  const idx = list.indexOf(ambianceId);
  if (idx >= 0) return tagged ? Math.max(0.7, 1 - 0.1 * idx) : 0.7;
  // Non typique : compatible par défaut, plus ou moins selon les contraires évidents.
  if (ambianceId === 'gourmand' && !plant.edible) return 0.4;
  if (ambianceId === 'pollinisateurs' && !plant.melliferous) return 0.4;
  if ((ambianceId === 'apaisant' || ambianceId === 'zen') && isVivid(plant)) return 0.3;
  if (ambianceId === 'colore' && (plant.bloom || []).length === 0) return 0.4;
  return 0.5;
}

/** Une essence est typique d'une ambiance à partir de 0,7. */
export const TYPICAL_THRESHOLD = 0.7;
export function isTypical(plant, ambianceId) {
  return plantAmbianceScore(plant, ambianceId) >= TYPICAL_THRESHOLD;
}
