// Ports (silhouettes) des plantes : table des ports + fonctions pures de modélisation.
// Aucune dépendance au DOM ni au rendu ; les rendus 2D / isométrique / 3D n'ont qu'à lire `habitParams`.
import TAGS from './data/plants/habits-tags.js';

/** Fabrique d'un port. */
const H = (id, label, crown, ratio, trunk, density, spread, leaf, flowerStyle, note, extra) =>
  ({ id, label, crown, ratio, trunk, density, spread, leaf, flowerStyle, note, ...extra });

/**
 * crown : forme du houppier/volume (round, spreading, column, cone, weeping, vase, umbrella, dome, fountain, clump,
 *   spike, mat, creeping, rosette, fan, blade, tuft, floating, vines, row, none).
 * ratio : hauteur / largeur typique ; density 0–1 (plein ↔ léger) ; spread 0–1 (étalement).
 */
export const HABITS = [
  H('tree-round', 'arbre à houppier arrondi', 'round', 1.4, 'tall', 0.8, 0.6, 'broad', 'canopy', 'Tronc net et houppier ovale ou arrondi.'),
  H('tree-spreading', 'arbre à houppier étalé', 'spreading', 1.1, 'tall', 0.85, 0.9, 'broad', 'canopy', 'Large houppier plus large que haut, charpente massive.'),
  H('tree-columnar', 'arbre en colonne', 'column', 3.2, 'short', 0.85, 0.1, 'needle', 'none', 'Silhouette fastigiée très étroite (cyprès).'),
  H('tree-conical', 'arbre conique', 'cone', 2, 'short', 0.9, 0.35, 'needle', 'none', 'Cône régulier, branches étagées jusqu\'au sol ou presque.'),
  H('tree-weeping', 'arbre pleureur', 'weeping', 1.5, 'tall', 0.6, 0.6, 'broad', 'canopy', 'Rameaux retombants en rideau.'),
  H('tree-vase', 'arbre en vase', 'vase', 1.2, 'short', 0.65, 0.7, 'broad', 'canopy', 'Branches ascendantes partant d\'un tronc court, houppier évasé.'),
  H('tree-umbrella', 'arbre en parasol', 'umbrella', 0.9, 'tall', 0.65, 0.9, 'broad', 'canopy', 'Houppier plat et large porté par un tronc nu.'),
  H('tree-fruit', 'arbre fruitier', 'round', 1, 'short', 0.75, 0.7, 'broad', 'canopy', 'Tronc court, houppier bas et arrondi, floraison abondante.'),
  H('palm', 'palmier', 'fountain', 1.8, 'tall', 0.7, 0.5, 'palm', 'none', 'Stipe nu surmonté d\'une couronne de palmes.'),
  H('shrub-round', 'arbuste arrondi', 'dome', 1, 'none', 0.85, 0.7, 'broad', 'scattered', 'Dôme dense ramifié dès la base.'),
  H('shrub-upright', 'arbuste dressé', 'vase', 1.5, 'multi', 0.7, 0.4, 'broad', 'scattered', 'Tiges dressées partant de la souche.', { stems: { min: 5, max: 15 } }),
  H('shrub-arching', 'arbuste à port arqué', 'fountain', 1, 'multi', 0.6, 0.8, 'broad', 'scattered', 'Branches souples arquées qui retombent en fontaine.', { stems: { min: 6, max: 20 } }),
  H('shrub-mound', 'arbuste en coussin', 'dome', 0.7, 'none', 0.9, 0.85, 'broad', 'scattered', 'Dôme bas, plus large que haut.'),
  H('shrub-conical', 'arbuste conique', 'cone', 1.8, 'none', 0.9, 0.3, 'needle', 'none', 'Cône dense feuillu jusqu\'au sol.'),
  H('shrub-columnar', 'arbuste en colonne', 'column', 3.5, 'none', 0.9, 0.1, 'needle', 'none', 'Pilier étroit fastigié (if, genévrier colonnaire).'),
  H('bamboo', 'bambou', 'tuft', 3, 'multi', 0.3, 0.5, 'fine', 'none',
    'Touffe cespiteuse (non traçante) de nombreux chaumes verticaux fins, feuillage léger en plumeaux en haut, gaine souvent teintée ; 2 à 6 m.',
    { stems: { min: 20, max: 80 }, sheath: true }),
  H('hedge-clipped', 'haie taillée', 'column', 2.2, 'none', 0.95, 0.15, 'broad', 'none', 'Bande verte dense aux faces planes, taillée.'),
  H('climber', 'grimpante', 'vines', 3, 'none', 0.6, 0.3, 'broad', 'scattered', 'Tiges volubiles ou palissées qui montent sur un support.', { support: 'trellis', stems: { min: 2, max: 6 } }),
  H('vine', 'liane à crampons', 'vines', 3, 'none', 0.85, 0.5, 'broad', 'none', 'Liane vigoureuse qui couvre mur, pergola ou arbre.', { support: 'wall', stems: { min: 1, max: 4 } }),
  H('perennial-clump', 'vivace en touffe', 'clump', 1.1, 'none', 0.7, 0.5, 'broad', 'scattered', 'Touffe buissonnante de tiges feuillées.', { stems: { min: 8, max: 30 } }),
  H('perennial-upright', 'vivace à hampes dressées', 'spike', 1.8, 'none', 0.5, 0.3, 'broad', 'spikes', 'Rosette basse d\'où partent de hautes hampes florales.', { stems: { min: 3, max: 12 } }),
  H('perennial-mound', 'vivace en coussin', 'dome', 0.7, 'none', 0.85, 0.7, 'broad', 'scattered', 'Coussin arrondi de feuillage couvert de fleurs.', { stems: { min: 10, max: 40 } }),
  H('groundcover-mat', 'couvre-sol en tapis', 'mat', 0.15, 'none', 0.95, 0.9, 'fine', 'scattered', 'Tapis ras et dense.'),
  H('groundcover-creeping', 'couvre-sol rampant', 'creeping', 0.2, 'none', 0.8, 1, 'broad', 'scattered', 'Tiges rampantes qui s\'étalent et s\'enracinent.'),
  H('grass-arching', 'graminée arquée', 'fountain', 1.3, 'none', 0.55, 0.8, 'blade', 'spikes', 'Fontaine de feuilles arquées et d\'épis.', { stems: { min: 30, max: 100 } }),
  H('grass-upright', 'graminée dressée', 'column', 2.5, 'none', 0.5, 0.2, 'blade', 'spikes', 'Touffe raide et dressée, panicules verticales.', { stems: { min: 25, max: 80 } }),
  H('grass-fine', 'graminée fine', 'tuft', 1, 'none', 0.4, 0.6, 'fine', 'spikes', 'Touffe ébouriffée de feuilles filiformes.', { stems: { min: 50, max: 150 } }),
  H('fern', 'fougère', 'fountain', 1.1, 'none', 0.6, 0.8, 'frond', 'none', 'Couronne de frondes arquées qui se déroulent.', { stems: { min: 8, max: 25 } }),
  H('rosette', 'plante en rosette', 'rosette', 0.6, 'none', 0.9, 0.9, 'broad', 'spikes', 'Rosette de grandes feuilles, hampes florales au-dessus.', { stems: { min: 10, max: 30 } }),
  H('bulb-spike', 'bulbe à hampe', 'spike', 6, 'none', 0.3, 0.1, 'blade', 'spikes', 'Hampe unique dressée portant la fleur, feuilles basses.', { stems: { min: 1, max: 5 } }),
  H('bulb-clump', 'bulbe en touffe', 'tuft', 2.5, 'none', 0.5, 0.4, 'blade', 'scattered', 'Petite touffe de feuilles en lanières et de fleurs.', { stems: { min: 5, max: 20 } }),
  H('aquatic-floating', 'plante aquatique flottante', 'floating', 0.05, 'none', 0.8, 1, 'floating', 'scattered', 'Feuilles posées à la surface de l\'eau.'),
  H('aquatic-reed', 'plante de roselière', 'blade', 4, 'none', 0.5, 0.4, 'blade', 'spikes', 'Touffe de feuilles ou tiges dressées dans l\'eau.', { stems: { min: 10, max: 60 } }),
  H('aquatic-marginal', 'plante de berge', 'clump', 1, 'none', 0.7, 0.6, 'broad', 'scattered', 'Touffe à pied humide, au bord de l\'eau.', { stems: { min: 6, max: 20 } }),
  H('vegetable-row', 'légume en rang', 'row', 1, 'none', 0.8, 0.5, 'broad', 'none', 'Plants alignés en rang au potager.', { stems: { min: 1, max: 6 } }),
  H('vegetable-climbing', 'légume grimpant', 'vines', 3, 'none', 0.65, 0.3, 'broad', 'scattered', 'Tiges palissées sur tuteur, rames ou grillage.', { support: 'tripod', stems: { min: 1, max: 4 } }),
  H('herb-bush', 'aromatique en buisson', 'dome', 0.9, 'none', 0.65, 0.7, 'fine', 'spikes', 'Petit buisson dense de feuilles fines et aromatiques.', { stems: { min: 10, max: 40 } }),
  H('lawn', 'pelouse', 'mat', 0.1, 'none', 1, 1, 'blade', 'none', 'Tapis uniforme de gazon.'),
];

export const HABIT_IDS = HABITS.map((h) => h.id);
const BY_ID = Object.fromEntries(HABITS.map((h) => [h.id, h]));
export const SUPPORTS = ['wall', 'trellis', 'pergola', 'tripod'];
export const TAGS_BY_PLANT = TAGS;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);

/** Port par id (null si inconnu). */
export function getHabit(id) {
  return BY_ID[id] || null;
}

const RE = {
  conifer: /\b(Pinus|Cedrus|Cupressus|Cupressocyparis|Taxus|Thuja|Abies|Picea|Juniperus|Larix|Sequoia|Chamaecyparis|Tsuga)\b/i,
  palm: /\b(Phoenix|Trachycarpus|Chamaerops|Washingtonia|Butia|Livistona)\b/i,
  bamboo: /\b(Fargesia|Phyllostachys|Bambusa|Pleioblastus|Sasa|Semiarundinaria|Pseudosasa|Chusquea)\b/i,
  fern: /\b(Dryopteris|Athyrium|Polystichum|Asplenium|Osmunda|Blechnum|Matteuccia|Polypodium)\b/i,
  rosette: /\b(Hosta|Bergenia|Heuchera|Sempervivum|Primula|Brunnera)\b/i,
  weeping: /pendula|babylonica|pendulum|'?pleureur/i,
};

/** Port de repli par catégorie, taille et feuillage (sans tag explicite). */
function deduce(p) {
  const cat = p.category;
  const h = num(p.heightAdult, 1);
  const w = num(p.widthAdult, h);
  const ratio = h / w;
  const latin = String(p.latinName || '');
  const ev = p.foliage === 'evergreen';
  if (RE.bamboo.test(latin)) return 'bamboo';
  if (RE.palm.test(latin)) return 'palm';
  switch (cat) {
    case 'tree':
      if (RE.conifer.test(latin)) return ratio >= 3 ? 'tree-columnar' : 'tree-conical';
      if (RE.weeping.test(latin)) return 'tree-weeping';
      if (ratio >= 3) return 'tree-columnar';
      return ratio <= 1.1 ? 'tree-spreading' : 'tree-round';
    case 'fruit':
      return h >= 8 ? 'tree-spreading' : (h <= 2 ? 'shrub-round' : 'tree-fruit');
    case 'shrub':
      if (RE.conifer.test(latin)) return ratio >= 3 ? 'shrub-columnar' : 'shrub-conical';
      if (ratio >= 3) return 'shrub-columnar';
      if (h <= 1.2 && w >= h) return 'shrub-mound';
      if (ratio >= 1.4) return 'shrub-upright';
      return ev ? 'shrub-round' : 'shrub-arching';
    case 'hedge':
      if (RE.conifer.test(latin) && ratio >= 6) return 'tree-columnar';
      return 'hedge-clipped';
    case 'climber':
      return h >= 8 ? 'vine' : 'climber';
    case 'perennial':
      if (RE.fern.test(latin)) return 'fern';
      if (RE.rosette.test(latin)) return 'rosette';
      if (ratio >= 1.8) return 'perennial-upright';
      if (ratio <= 0.8) return 'perennial-mound';
      return 'perennial-clump';
    case 'groundcover':
      return h < 0.3 ? 'groundcover-mat' : 'groundcover-creeping';
    case 'grass':
      if (ratio >= 2) return 'grass-upright';
      return h <= 0.5 && w <= 0.5 ? 'grass-fine' : 'grass-arching';
    case 'bulb':
      return ratio >= 3 ? 'bulb-spike' : 'bulb-clump';
    case 'aquatic':
      if (h <= 0.2 && w >= 0.4) return 'aquatic-floating';
      return h >= 0.8 ? 'aquatic-reed' : 'aquatic-marginal';
    case 'vegetable':
      return h >= 1.5 ? 'vegetable-climbing' : 'vegetable-row';
    case 'lawn':
      return 'lawn';
    default:
      return h >= 3 ? 'tree-round' : (h >= 1 ? 'shrub-round' : 'perennial-clump');
  }
}

function tagOf(p) {
  return (p && p.id && TAGS[p.id]) || null;
}

/** Port d'une essence : tag explicite (champ `habit` de la plante, sinon table de tags), sinon déduction. */
export function habitOf(plant) {
  if (!plant) return BY_ID['shrub-round'];
  if (plant.habit && BY_ID[plant.habit]) return BY_ID[plant.habit];
  const tag = tagOf(plant);
  if (tag && BY_ID[tag.habit]) return BY_ID[tag.habit];
  return BY_ID[deduce(plant)];
}

/** Facteur d'âge → { h, w } : nombre 0–1 (0,35→1 en hauteur), ou 'young' / 'adult'. */
function ageFactors(age) {
  let a = 1;
  if (age === 'young') a = 0;
  else if (age === 'adult' || age == null) a = 1;
  else if (Number.isFinite(Number(age))) a = clamp(Number(age), 0, 1);
  return { a, h: 0.35 + 0.65 * a, w: 0.3 + 0.7 * a };
}

const TRUNK_FRAC = { none: 0, short: 0.2, tall: 0.4, multi: 0.12 };

/**
 * Paramètres numériques de modélisation d'une plante à un âge donné.
 * Hauteur/largeur (m), ratio effectif, hauteur de tronc, hauteur de couronne, nombre de tiges, densité, etc.
 */
export function habitParams(plant, { age = 1 } = {}) {
  const habit = habitOf(plant);
  const tag = tagOf(plant) || {};
  const f = ageFactors(age);
  const heightAdult = num(plant && plant.heightAdult, 1);
  const widthAdult = num(plant && plant.widthAdult, Math.max(0.05, heightAdult / habit.ratio));
  const height = Math.max(0.001, heightAdult * f.h);
  const width = Math.max(0.001, widthAdult * f.w);
  const trunkHeight = habit.trunk === 'none' ? 0 : height * TRUNK_FRAC[habit.trunk];

  const range = tag.stems || habit.stems || null;
  let stems = 0;
  if (range) {
    const fill = clamp(widthAdult / 2, 0.05, 1);
    const adult = range.min + (range.max - range.min) * fill;
    stems = Math.max(range.min > 1 ? 2 : 1, Math.round(adult * (0.3 + 0.7 * f.a)));
  } else if (habit.trunk === 'multi') {
    stems = 3;
  } else if (habit.trunk !== 'none') {
    stems = 1;
  }
  const support = tag.support || habit.support || null;
  return {
    habit: habit.id,
    label: habit.label,
    crown: habit.crown,
    trunk: habit.trunk,
    leaf: habit.leaf,
    flowerStyle: habit.flowerStyle,
    heightAdult, widthAdult,
    height, width,
    ratio: height / width,
    typicalRatio: habit.ratio,
    trunkHeight,
    crownHeight: height - trunkHeight,
    density: habit.density,
    spread: habit.spread,
    stems,
    support,
    sheath: !!habit.sheath,
    ageFactor: f.a,
  };
}

const SUPPORT_FR = { wall: 'un mur', trellis: 'un treillage', pergola: 'une pergola', tripod: 'un tuteur' };

/** Phrase française courte décrivant le port de l'essence. */
export function describeHabit(plant) {
  const h = habitOf(plant);
  const tag = tagOf(plant) || {};
  const hh = num(plant && plant.heightAdult, 0);
  const ww = num(plant && plant.widthAdult, 0);
  const fmt = (v) => (v >= 10 ? String(Math.round(v)) : String(Math.round(v * 10) / 10)).replace('.', ',');
  const dims = hh ? ` (${fmt(hh)} m${ww && ww >= 0.1 ? ` × ${fmt(ww)} m` : ''})` : '';
  const cap = h.label.charAt(0).toUpperCase() + h.label.slice(1);
  const sup = tag.support || h.support;
  const parts = [`${cap}${dims}`];
  if (sup && (h.crown === 'vines')) parts[0] += `, sur ${SUPPORT_FR[sup] || 'un support'}`;
  const note = tag.note || h.note;
  return `${parts[0]}. ${note}`;
}
