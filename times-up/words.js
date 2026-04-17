/**
 * words.js — Liste de mots thématiques sur La Réunion
 * pour le jeu Time's Up Nout Péi
 */

const CATEGORY_LABELS = {
  lieu:        { label: 'Lieu',         emoji: '🗺️' },
  gastronomie: { label: 'Gastronomie',  emoji: '🍛' },
  culture:     { label: 'Culture',      emoji: '🎵' },
  nature:      { label: 'Nature',       emoji: '🌿' },
  creole:      { label: 'Créole',       emoji: '🗣️' },
};

const RAW_WORDS = [
  // ─── Lieux ────────────────────────────────────────────────────────────────
  { word: 'Piton de la Fournaise',    category: 'lieu' },
  { word: 'Piton des Neiges',         category: 'lieu' },
  { word: 'Cirque de Mafate',         category: 'lieu' },
  { word: 'Cirque de Cilaos',         category: 'lieu' },
  { word: 'Cirque de Salazie',        category: 'lieu' },
  { word: 'Hell-Bourg',               category: 'lieu' },
  { word: 'Grand Bassin',             category: 'lieu' },
  { word: 'Saint-Denis',              category: 'lieu' },
  { word: 'Plaine des Cafres',        category: 'lieu' },
  { word: 'Cap Méchant',              category: 'lieu' },
  { word: 'Les Makes',                category: 'lieu' },
  { word: 'Étang-Salé',               category: 'lieu' },
  { word: 'Forêt de Bélouve',         category: 'lieu' },
  { word: 'Grand Étang',              category: 'lieu' },
  { word: 'Lagon de Saint-Gilles',    category: 'lieu' },

  // ─── Gastronomie ──────────────────────────────────────────────────────────
  { word: 'Rougail saucisse',         category: 'gastronomie' },
  { word: 'Carry poulet',             category: 'gastronomie' },
  { word: 'Samoussa',                 category: 'gastronomie' },
  { word: 'Bouchon',                  category: 'gastronomie' },
  { word: 'Gâteau patate',            category: 'gastronomie' },
  { word: 'Rougail mangue',           category: 'gastronomie' },
  { word: 'Achards légumes',          category: 'gastronomie' },
  { word: 'Rhum arrangé',             category: 'gastronomie' },
  { word: 'Punch coco',               category: 'gastronomie' },
  { word: 'Cari requin',              category: 'gastronomie' },
  { word: 'Vindaye poisson',          category: 'gastronomie' },
  { word: 'Brèdes chouchou',          category: 'gastronomie' },
  { word: 'Café Bourbon pointu',      category: 'gastronomie' },
  { word: 'Vanille Bourbon',          category: 'gastronomie' },
  { word: 'Bonbon la cire',           category: 'gastronomie' },

  // ─── Culture ──────────────────────────────────────────────────────────────
  { word: 'Maloya',                   category: 'culture' },
  { word: 'Séga typique',             category: 'culture' },
  { word: 'Danyèl Waro',              category: 'culture' },
  { word: 'Firmin Viry',              category: 'culture' },
  { word: 'Ziskakan',                 category: 'culture' },
  { word: 'Christine Salem',          category: 'culture' },
  { word: 'Nathalie Natiembé',        category: 'culture' },
  { word: 'Grand Raid',               category: 'culture' },
  { word: 'Sakifo',                   category: 'culture' },
  { word: 'Kabar',                    category: 'culture' },
  { word: 'Fête du Dipavali',         category: 'culture' },
  { word: 'Tour des cirques',         category: 'culture' },
  { word: 'Fête de l\'Aïd',           category: 'culture' },
  { word: 'Fête des vendanges',       category: 'culture' },
  { word: 'Téléphérique des Sables',  category: 'culture' },

  // ─── Nature & Faune ───────────────────────────────────────────────────────
  { word: 'Tangue',                   category: 'nature' },
  { word: 'Papangue',                 category: 'nature' },
  { word: 'Paille en queue',          category: 'nature' },
  { word: 'Pétrel de Barau',          category: 'nature' },
  { word: 'Takamaka',                 category: 'nature' },
  { word: 'Vacoas',                   category: 'nature' },
  { word: 'Choca',                    category: 'nature' },
  { word: 'Bulbul orphée',            category: 'nature' },
  { word: 'Caméléon de Bourbon',      category: 'nature' },
  { word: 'Lézard vert',              category: 'nature' },

  // ─── Créole & Identité ────────────────────────────────────────────────────
  { word: 'Zoreil',                   category: 'creole' },
  { word: 'Nout péi',                 category: 'creole' },
  { word: 'Kafrine',                  category: 'creole' },
  { word: 'Kabardine',                category: 'creole' },
  { word: 'Yab',                      category: 'creole' },
  { word: 'Malbar',                   category: 'creole' },
  { word: 'Métis',                    category: 'creole' },
  { word: 'La Réunion',               category: 'creole' },
];

/** Mélange aléatoire (Fisher-Yates) */
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function getShuffledWords() {
  return shuffle(RAW_WORDS);
}

export function getCategoryInfo(category) {
  return CATEGORY_LABELS[category] ?? { label: category, emoji: '❓' };
}

export const TOTAL_WORDS = RAW_WORDS.length;
