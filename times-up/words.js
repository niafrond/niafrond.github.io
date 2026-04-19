/**
 * words.js — Liste de mots thématiques sur La Réunion
 * pour le jeu Time's Up Nout Péi
 */

const STORAGE_KEY = 'timesup_custom_words';

export const CATEGORY_LABELS = {
  lieu:        { label: 'Lieu',         emoji: '🗺️' },
  gastronomie: { label: 'Gastronomie',  emoji: '🍛' },
  culture:     { label: 'Culture',      emoji: '🎵' },
  nature:      { label: 'Nature',       emoji: '🌿' },
  creole:      { label: 'Créole',       emoji: '🗣️' },
};

export const DEFAULT_WORDS = [
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
  { word: 'Piton',                    category: 'lieu' },
  { word: 'Mafate',                   category: 'lieu' },
  { word: 'Cilaos',                   category: 'lieu' },
  { word: 'Salazie',                  category: 'lieu' },
  { word: 'Lagon',                    category: 'lieu' },
  { word: 'Barachois',                category: 'lieu' },
  { word: 'Ravine',                   category: 'lieu' },
  { word: 'Bassin',                   category: 'lieu' },
  { word: 'Cascade',                  category: 'lieu' },
  { word: 'Case créole',              category: 'lieu' },
  { word: 'Boutik chinois',           category: 'lieu' },
  { word: 'Marché forain',            category: 'lieu' },
  { word: 'Chemin cabri',             category: 'lieu' },

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
  { word: 'Baba figue',               category: 'gastronomie' },
  { word: 'Cari',                     category: 'gastronomie' },
  { word: 'Rougail',                  category: 'gastronomie' },
  { word: 'Achard',                   category: 'gastronomie' },
  { word: 'Bonbon piment',            category: 'gastronomie' },
  { word: 'Gratin chouchou',          category: 'gastronomie' },
  { word: 'Bringelle',                category: 'gastronomie' },
  { word: 'Pipangaille',              category: 'gastronomie' },
  { word: 'Macatia',                  category: 'gastronomie' },
  { word: 'Pain bouchon',             category: 'gastronomie' },
  { word: 'Saucisse',                 category: 'gastronomie' },
  { word: 'Boucané',                  category: 'gastronomie' },
  { word: 'Ti jacque boucané',        category: 'gastronomie' },
  { word: 'Riz chauffé',              category: 'gastronomie' },
  { word: 'Grain',                    category: 'gastronomie' },
  { word: 'Lentilles',                category: 'gastronomie' },
  { word: 'Pois du cap',              category: 'gastronomie' },
  { word: 'Brède',                    category: 'gastronomie' },
  { word: 'Songes',                   category: 'gastronomie' },
  { word: 'Manioc',                   category: 'gastronomie' },
  { word: 'Patate douce',             category: 'gastronomie' },
  { word: 'Chouchou',                 category: 'gastronomie' },
  { word: 'Galabé',                   category: 'gastronomie' },

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
  { word: 'Kayamb',                   category: 'culture' },
  { word: 'Séga',                     category: 'culture' },
  { word: 'Dodo',                     category: 'culture' },
  { word: 'Fèt kaf',                  category: 'culture' },

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
  { word: 'Letchi',                   category: 'nature' },
  { word: 'Letchis',                  category: 'nature' },
  { word: 'Bibasse',                  category: 'nature' },
  { word: 'Tangor',                   category: 'nature' },
  { word: 'Goyavier',                 category: 'nature' },
  { word: 'Vacoa',                    category: 'nature' },
  { word: 'Filaos',                   category: 'nature' },
  { word: 'Fouquet',                  category: 'nature' },
  { word: 'Bélier',                   category: 'nature' },
  { word: 'Cabri',                    category: 'nature' },

  // ─── Créole & Identité ────────────────────────────────────────────────────
  { word: 'Zoreil',                   category: 'creole' },
  { word: 'Nout péi',                 category: 'creole' },
  { word: 'Kafrine',                  category: 'creole' },
  { word: 'Kabardine',                category: 'creole' },
  { word: 'Yab',                      category: 'creole' },
  { word: 'Malbar',                   category: 'creole' },
  { word: 'Métis',                    category: 'creole' },
  { word: 'La Réunion',               category: 'creole' },
  { word: 'Lontan',                   category: 'creole' },
  { word: 'Kaz',                      category: 'creole' },
  { word: 'Marmay',                   category: 'creole' },
  { word: 'Dalon',                    category: 'creole' },
  { word: 'Zanfan',                   category: 'creole' },
  { word: 'Zamal',                    category: 'creole' },
  { word: 'Créole',                   category: 'creole' },
  { word: 'Cour',                     category: 'creole' },
  { word: 'Varangue',                 category: 'creole' },
  { word: 'Largue la corde',          category: 'creole' },
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

/** Retourne les mots personnalisés depuis localStorage, ou les mots par défaut. */
export function loadWords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const valid = parsed.filter(
          w => w && typeof w.word === 'string' && w.word.trim() &&
               typeof w.category === 'string' && w.category.trim()
        ).map(w => ({ word: w.word.trim(), category: w.category.trim() }));
        if (valid.length > 0) return valid;
      }
    }
  } catch (_) { /* ignore */ }
  return [...DEFAULT_WORDS];
}

/** Sauvegarde un tableau de mots dans localStorage. */
export function saveWords(words) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
}

/** Supprime les mots personnalisés (retour aux mots par défaut). */
export function resetWords() {
  localStorage.removeItem(STORAGE_KEY);
}

export function getShuffledWords() {
  return shuffle(loadWords());
}

export function getCategoryInfo(category) {
  return CATEGORY_LABELS[category] ?? { label: category, emoji: '❓' };
}
