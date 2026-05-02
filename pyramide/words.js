/**
 * words.js — Base de données de mots pour le jeu Pyramide
 *
 * 10 catégories, 300+ mots en français.
 * Chaque partie sélectionne 15 mots au hasard pour former la pyramide.
 */

export const CATEGORIES = {
  sport:       { label: 'Sport',        emoji: '⚽' },
  cinema:      { label: 'Cinéma',       emoji: '🎬' },
  geographie:  { label: 'Géographie',   emoji: '🌍' },
  animaux:     { label: 'Animaux',      emoji: '🦁' },
  nourriture:  { label: 'Nourriture',   emoji: '🍕' },
  metiers:     { label: 'Métiers',      emoji: '👷' },
  objets:      { label: 'Objets',       emoji: '🔧' },
  musique:     { label: 'Musique',      emoji: '🎵' },
  histoire:    { label: 'Histoire',     emoji: '📜' },
  actions:     { label: 'Actions',      emoji: '🏃' },
};

const POOL = [
  // ─── Sport ────────────────────────────────────────────────────────────────────
  { word: 'Football',        cat: 'sport',  kids: true  },
  { word: 'Tennis',          cat: 'sport',  kids: true  },
  { word: 'Natation',        cat: 'sport',  kids: true  },
  { word: 'Cyclisme',        cat: 'sport',  kids: true  },
  { word: 'Basketball',      cat: 'sport',  kids: true  },
  { word: 'Rugby',           cat: 'sport',  kids: true  },
  { word: 'Ski',             cat: 'sport',  kids: true  },
  { word: 'Boxe',            cat: 'sport',  kids: true  },
  { word: 'Golf',            cat: 'sport',  kids: true  },
  { word: 'Volleyball',      cat: 'sport',  kids: true  },
  { word: 'Judo',            cat: 'sport',  kids: true  },
  { word: 'Athlétisme',      cat: 'sport',  kids: true  },
  { word: 'Handball',        cat: 'sport',  kids: true  },
  { word: 'Escrime',         cat: 'sport'               },
  { word: 'Équitation',      cat: 'sport',  kids: true  },
  { word: 'Tir à l\'arc',    cat: 'sport',  kids: true  },
  { word: 'Aviron',          cat: 'sport'               },
  { word: 'Plongée',         cat: 'sport',  kids: true  },
  { word: 'Escalade',        cat: 'sport',  kids: true  },
  { word: 'Triathlon',       cat: 'sport'               },
  { word: 'Badminton',       cat: 'sport',  kids: true  },
  { word: 'Pétanque',        cat: 'sport',  kids: true  },
  { word: 'Bowling',         cat: 'sport',  kids: true  },
  { word: 'Curling',         cat: 'sport'               },
  { word: 'Biathlon',        cat: 'sport'               },
  { word: 'Kayak',           cat: 'sport',  kids: true  },
  { word: 'Surf',            cat: 'sport',  kids: true  },
  { word: 'Skateboard',      cat: 'sport',  kids: true  },
  { word: 'Ping-pong',       cat: 'sport',  kids: true  },
  { word: 'Patinage',        cat: 'sport',  kids: true  },

  // ─── Cinéma ───────────────────────────────────────────────────────────────────
  { word: 'Avatar',             cat: 'cinema', kids: true  },
  { word: 'Titanic',            cat: 'cinema', kids: true  },
  { word: 'Matrix',             cat: 'cinema'              },
  { word: 'Inception',          cat: 'cinema'              },
  { word: 'Interstellar',       cat: 'cinema'              },
  { word: 'Le Parrain',         cat: 'cinema'              },
  { word: 'Star Wars',          cat: 'cinema', kids: true  },
  { word: 'Spider-Man',         cat: 'cinema', kids: true  },
  { word: 'Batman',             cat: 'cinema', kids: true  },
  { word: 'Superman',           cat: 'cinema', kids: true  },
  { word: 'Alien',              cat: 'cinema'              },
  { word: 'Jurassic Park',      cat: 'cinema', kids: true  },
  { word: 'Indiana Jones',      cat: 'cinema', kids: true  },
  { word: 'James Bond',         cat: 'cinema'              },
  { word: 'Harry Potter',       cat: 'cinema', kids: true  },
  { word: 'Astérix',            cat: 'cinema', kids: true  },
  { word: 'Intouchables',       cat: 'cinema'              },
  { word: 'Les Misérables',     cat: 'cinema'              },
  { word: 'OSS 117',            cat: 'cinema'              },
  { word: 'Le Dîner de Cons',   cat: 'cinema'              },
  { word: 'La Grande Vadrouille', cat: 'cinema'            },
  { word: 'Kaamelott',          cat: 'cinema'              },
  { word: 'Amélie Poulain',     cat: 'cinema'              },
  { word: 'Le Fabuleux Destin', cat: 'cinema'              },
  { word: 'Toy Story',          cat: 'cinema', kids: true  },
  { word: 'Le Roi Lion',        cat: 'cinema', kids: true  },
  { word: 'Shrek',              cat: 'cinema', kids: true  },
  { word: 'Frozen',             cat: 'cinema', kids: true  },
  { word: 'Mad Max',            cat: 'cinema'              },

  // ─── Géographie ───────────────────────────────────────────────────────────────
  { word: 'Paris',         cat: 'geographie', kids: true  },
  { word: 'Lyon',          cat: 'geographie', kids: true  },
  { word: 'Marseille',     cat: 'geographie', kids: true  },
  { word: 'Tokyo',         cat: 'geographie', kids: true  },
  { word: 'New York',      cat: 'geographie', kids: true  },
  { word: 'Londres',       cat: 'geographie', kids: true  },
  { word: 'Rome',          cat: 'geographie', kids: true  },
  { word: 'Berlin',        cat: 'geographie', kids: true  },
  { word: 'Madrid',        cat: 'geographie', kids: true  },
  { word: 'Barcelone',     cat: 'geographie', kids: true  },
  { word: 'Sahara',        cat: 'geographie', kids: true  },
  { word: 'Amazonie',      cat: 'geographie', kids: true  },
  { word: 'Himalaya',      cat: 'geographie', kids: true  },
  { word: 'Everest',       cat: 'geographie', kids: true  },
  { word: 'Nil',           cat: 'geographie', kids: true  },
  { word: 'Méditerranée',  cat: 'geographie'              },
  { word: 'Pacifique',     cat: 'geographie', kids: true  },
  { word: 'Atlantique',    cat: 'geographie'              },
  { word: 'Arctique',      cat: 'geographie', kids: true  },
  { word: 'Antarctique',   cat: 'geographie', kids: true  },
  { word: 'Brésil',        cat: 'geographie', kids: true  },
  { word: 'Australie',     cat: 'geographie', kids: true  },
  { word: 'Canada',        cat: 'geographie', kids: true  },
  { word: 'Mexique',       cat: 'geographie', kids: true  },
  { word: 'Égypte',        cat: 'geographie', kids: true  },
  { word: 'Maroc',         cat: 'geographie', kids: true  },
  { word: 'Sénégal',       cat: 'geographie', kids: true  },
  { word: 'Chine',         cat: 'geographie', kids: true  },
  { word: 'Inde',          cat: 'geographie', kids: true  },
  { word: 'Islande',       cat: 'geographie', kids: true  },

  // ─── Animaux ──────────────────────────────────────────────────────────────────
  { word: 'Éléphant',      cat: 'animaux', kids: true },
  { word: 'Girafe',        cat: 'animaux', kids: true },
  { word: 'Crocodile',     cat: 'animaux', kids: true },
  { word: 'Pingouin',      cat: 'animaux', kids: true },
  { word: 'Koala',         cat: 'animaux', kids: true },
  { word: 'Panda',         cat: 'animaux', kids: true },
  { word: 'Tigre',         cat: 'animaux', kids: true },
  { word: 'Lion',          cat: 'animaux', kids: true },
  { word: 'Zèbre',         cat: 'animaux', kids: true },
  { word: 'Rhinocéros',    cat: 'animaux', kids: true },
  { word: 'Autruche',      cat: 'animaux', kids: true },
  { word: 'Flamant rose',  cat: 'animaux', kids: true },
  { word: 'Perroquet',     cat: 'animaux', kids: true },
  { word: 'Aigle',         cat: 'animaux', kids: true },
  { word: 'Hibou',         cat: 'animaux', kids: true },
  { word: 'Requin',        cat: 'animaux', kids: true },
  { word: 'Dauphin',       cat: 'animaux', kids: true },
  { word: 'Baleine',       cat: 'animaux', kids: true },
  { word: 'Méduse',        cat: 'animaux', kids: true },
  { word: 'Pieuvre',       cat: 'animaux', kids: true },
  { word: 'Fourmi',        cat: 'animaux', kids: true },
  { word: 'Abeille',       cat: 'animaux', kids: true },
  { word: 'Papillon',      cat: 'animaux', kids: true },
  { word: 'Coccinelle',    cat: 'animaux', kids: true },
  { word: 'Serpent',       cat: 'animaux', kids: true },
  { word: 'Lézard',        cat: 'animaux', kids: true },
  { word: 'Grenouille',    cat: 'animaux', kids: true },
  { word: 'Tortue',        cat: 'animaux', kids: true },
  { word: 'Chameau',       cat: 'animaux', kids: true },
  { word: 'Kangourou',     cat: 'animaux', kids: true },

  // ─── Nourriture ───────────────────────────────────────────────────────────────
  { word: 'Pizza',         cat: 'nourriture', kids: true  },
  { word: 'Sushi',         cat: 'nourriture', kids: true  },
  { word: 'Tacos',         cat: 'nourriture', kids: true  },
  { word: 'Hamburger',     cat: 'nourriture', kids: true  },
  { word: 'Croissant',     cat: 'nourriture', kids: true  },
  { word: 'Baguette',      cat: 'nourriture', kids: true  },
  { word: 'Fromage',       cat: 'nourriture', kids: true  },
  { word: 'Chocolat',      cat: 'nourriture', kids: true  },
  { word: 'Glace',         cat: 'nourriture', kids: true  },
  { word: 'Crêpe',         cat: 'nourriture', kids: true  },
  { word: 'Raclette',      cat: 'nourriture', kids: true  },
  { word: 'Fondue',        cat: 'nourriture', kids: true  },
  { word: 'Cassoulet',     cat: 'nourriture'              },
  { word: 'Quiche',        cat: 'nourriture', kids: true  },
  { word: 'Omelette',      cat: 'nourriture', kids: true  },
  { word: 'Soufflé',       cat: 'nourriture'              },
  { word: 'Tarte Tatin',   cat: 'nourriture'              },
  { word: 'Madeleine',     cat: 'nourriture', kids: true  },
  { word: 'Éclair',        cat: 'nourriture', kids: true  },
  { word: 'Spaghetti',     cat: 'nourriture', kids: true  },
  { word: 'Risotto',       cat: 'nourriture'              },
  { word: 'Paella',        cat: 'nourriture'              },
  { word: 'Ramen',         cat: 'nourriture', kids: true  },
  { word: 'Brownie',       cat: 'nourriture', kids: true  },
  { word: 'Tiramisu',      cat: 'nourriture'              },
  { word: 'Macarons',      cat: 'nourriture', kids: true  },
  { word: 'Millefeuille',  cat: 'nourriture'              },
  { word: 'Choucroute',    cat: 'nourriture'              },
  { word: 'Foie gras',     cat: 'nourriture'              },
  { word: 'Crème brûlée',  cat: 'nourriture'              },

  // ─── Métiers ──────────────────────────────────────────────────────────────────
  { word: 'Médecin',         cat: 'metiers', kids: true  },
  { word: 'Boulanger',       cat: 'metiers', kids: true  },
  { word: 'Pompier',         cat: 'metiers', kids: true  },
  { word: 'Policier',        cat: 'metiers', kids: true  },
  { word: 'Enseignant',      cat: 'metiers', kids: true  },
  { word: 'Architecte',      cat: 'metiers'              },
  { word: 'Ingénieur',       cat: 'metiers'              },
  { word: 'Plombier',        cat: 'metiers', kids: true  },
  { word: 'Électricien',     cat: 'metiers'              },
  { word: 'Maçon',           cat: 'metiers'              },
  { word: 'Infirmier',       cat: 'metiers', kids: true  },
  { word: 'Pharmacien',      cat: 'metiers'              },
  { word: 'Dentiste',        cat: 'metiers', kids: true  },
  { word: 'Vétérinaire',     cat: 'metiers', kids: true  },
  { word: 'Chirurgien',      cat: 'metiers'              },
  { word: 'Avocat',          cat: 'metiers'              },
  { word: 'Juge',            cat: 'metiers'              },
  { word: 'Comptable',       cat: 'metiers'              },
  { word: 'Chef cuisinier',  cat: 'metiers', kids: true  },
  { word: 'Pâtissier',       cat: 'metiers', kids: true  },
  { word: 'Boucher',         cat: 'metiers'              },
  { word: 'Pilote',          cat: 'metiers', kids: true  },
  { word: 'Astronaute',      cat: 'metiers', kids: true  },
  { word: 'Marin',           cat: 'metiers', kids: true  },
  { word: 'Militaire',       cat: 'metiers'              },
  { word: 'Acteur',          cat: 'metiers', kids: true  },
  { word: 'Chanteur',        cat: 'metiers', kids: true  },
  { word: 'Journaliste',     cat: 'metiers'              },
  { word: 'Photographe',     cat: 'metiers'              },
  { word: 'Agriculteur',     cat: 'metiers', kids: true  },

  // ─── Objets ───────────────────────────────────────────────────────────────────
  { word: 'Téléphone',     cat: 'objets', kids: true  },
  { word: 'Voiture',       cat: 'objets', kids: true  },
  { word: 'Vélo',          cat: 'objets', kids: true  },
  { word: 'Avion',         cat: 'objets', kids: true  },
  { word: 'Bateau',        cat: 'objets', kids: true  },
  { word: 'Télévision',    cat: 'objets', kids: true  },
  { word: 'Ordinateur',    cat: 'objets', kids: true  },
  { word: 'Montre',        cat: 'objets', kids: true  },
  { word: 'Lunettes',      cat: 'objets', kids: true  },
  { word: 'Parapluie',     cat: 'objets', kids: true  },
  { word: 'Valise',        cat: 'objets', kids: true  },
  { word: 'Marteau',       cat: 'objets', kids: true  },
  { word: 'Tournevis',     cat: 'objets'              },
  { word: 'Ciseau',        cat: 'objets', kids: true  },
  { word: 'Scie',          cat: 'objets'              },
  { word: 'Perceuse',      cat: 'objets'              },
  { word: 'Frigo',         cat: 'objets', kids: true  },
  { word: 'Micro-ondes',   cat: 'objets', kids: true  },
  { word: 'Cafetière',     cat: 'objets'              },
  { word: 'Grille-pain',   cat: 'objets', kids: true  },
  { word: 'Lampe',         cat: 'objets', kids: true  },
  { word: 'Miroir',        cat: 'objets', kids: true  },
  { word: 'Tabouret',      cat: 'objets'              },
  { word: 'Aspirateur',    cat: 'objets', kids: true  },
  { word: 'Fer à repasser', cat: 'objets'             },
  { word: 'Lave-linge',    cat: 'objets'              },
  { word: 'Bougie',        cat: 'objets', kids: true  },
  { word: 'Calculatrice',  cat: 'objets', kids: true  },
  { word: 'Thermomètre',   cat: 'objets', kids: true  },
  { word: 'Loupe',         cat: 'objets', kids: true  },

  // ─── Musique ──────────────────────────────────────────────────────────────────
  { word: 'Beatles',          cat: 'musique', kids: true  },
  { word: 'Mozart',           cat: 'musique', kids: true  },
  { word: 'Beethoven',        cat: 'musique', kids: true  },
  { word: 'Elvis',            cat: 'musique', kids: true  },
  { word: 'Michael Jackson',  cat: 'musique', kids: true  },
  { word: 'Madonna',          cat: 'musique'              },
  { word: 'David Bowie',      cat: 'musique'              },
  { word: 'Prince',           cat: 'musique'              },
  { word: 'Bob Marley',       cat: 'musique', kids: true  },
  { word: 'Freddie Mercury',  cat: 'musique'              },
  { word: 'Édith Piaf',       cat: 'musique'              },
  { word: 'Jacques Brel',     cat: 'musique'              },
  { word: 'Serge Gainsbourg', cat: 'musique'              },
  { word: 'Charles Aznavour', cat: 'musique'              },
  { word: 'Dalida',           cat: 'musique'              },
  { word: 'Johnny Hallyday',  cat: 'musique'              },
  { word: 'Daft Punk',        cat: 'musique', kids: true  },
  { word: 'Stromae',          cat: 'musique'              },
  { word: 'Aya Nakamura',     cat: 'musique'              },
  { word: 'Angèle',           cat: 'musique'              },
  { word: 'Soprano',          cat: 'musique'              },
  { word: 'Vianney',          cat: 'musique'              },
  { word: 'Kendji Girac',     cat: 'musique'              },
  { word: 'Amir',             cat: 'musique'              },
  { word: 'Louane',           cat: 'musique'              },
  { word: 'Maes',             cat: 'musique'              },
  { word: 'Nekfeu',           cat: 'musique'              },
  { word: 'Orelsan',          cat: 'musique'              },
  { word: 'Bigflo & Oli',     cat: 'musique'              },
  { word: 'Francis Cabrel',   cat: 'musique'              },

  // ─── Histoire ─────────────────────────────────────────────────────────────────
  { word: 'Napoléon',              cat: 'histoire', kids: true  },
  { word: 'Marie Curie',           cat: 'histoire', kids: true  },
  { word: 'Einstein',              cat: 'histoire', kids: true  },
  { word: 'Shakespeare',           cat: 'histoire'              },
  { word: 'Picasso',               cat: 'histoire', kids: true  },
  { word: 'Léonard de Vinci',      cat: 'histoire', kids: true  },
  { word: 'Christophe Colomb',     cat: 'histoire', kids: true  },
  { word: 'Jules César',           cat: 'histoire', kids: true  },
  { word: 'Cléopâtre',             cat: 'histoire', kids: true  },
  { word: 'Louis XIV',             cat: 'histoire'              },
  { word: 'Victor Hugo',           cat: 'histoire'              },
  { word: 'Voltaire',              cat: 'histoire'              },
  { word: 'Molière',               cat: 'histoire'              },
  { word: 'Jeanne d\'Arc',         cat: 'histoire', kids: true  },
  { word: 'Marco Polo',            cat: 'histoire', kids: true  },
  { word: 'Alexandre le Grand',    cat: 'histoire'              },
  { word: 'Galilée',               cat: 'histoire'              },
  { word: 'Newton',                cat: 'histoire', kids: true  },
  { word: 'Darwin',                cat: 'histoire'              },
  { word: 'Freud',                 cat: 'histoire'              },
  { word: 'Nelson Mandela',        cat: 'histoire', kids: true  },
  { word: 'Gandhi',                cat: 'histoire', kids: true  },
  { word: 'Martin Luther King',    cat: 'histoire', kids: true  },
  { word: 'Charles de Gaulle',     cat: 'histoire'              },
  { word: 'Simone de Beauvoir',    cat: 'histoire'              },
  { word: 'Louis Pasteur',         cat: 'histoire', kids: true  },
  { word: 'Marie Antoinette',      cat: 'histoire'              },
  { word: 'Napoléon Bonaparte',    cat: 'histoire'              },
  { word: 'Abraham Lincoln',       cat: 'histoire', kids: true  },
  { word: 'Winston Churchill',     cat: 'histoire'              },

  // ─── Actions ──────────────────────────────────────────────────────────────────
  { word: 'Courir',        cat: 'actions', kids: true },
  { word: 'Sauter',        cat: 'actions', kids: true },
  { word: 'Nager',         cat: 'actions', kids: true },
  { word: 'Voler',         cat: 'actions', kids: true },
  { word: 'Grimper',       cat: 'actions', kids: true },
  { word: 'Danser',        cat: 'actions', kids: true },
  { word: 'Chanter',       cat: 'actions', kids: true },
  { word: 'Jouer',         cat: 'actions', kids: true },
  { word: 'Travailler',    cat: 'actions', kids: true },
  { word: 'Dormir',        cat: 'actions', kids: true },
  { word: 'Manger',        cat: 'actions', kids: true },
  { word: 'Boire',         cat: 'actions', kids: true },
  { word: 'Lire',          cat: 'actions', kids: true },
  { word: 'Écrire',        cat: 'actions', kids: true },
  { word: 'Dessiner',      cat: 'actions', kids: true },
  { word: 'Cuisiner',      cat: 'actions', kids: true },
  { word: 'Conduire',      cat: 'actions'              },
  { word: 'Téléphoner',    cat: 'actions', kids: true },
  { word: 'Voyager',       cat: 'actions', kids: true },
  { word: 'Photographier', cat: 'actions'              },
  { word: 'Jardiner',      cat: 'actions', kids: true },
  { word: 'Bricoler',      cat: 'actions'              },
  { word: 'Pêcher',        cat: 'actions', kids: true },
  { word: 'Skier',         cat: 'actions', kids: true },
  { word: 'Surfer',        cat: 'actions', kids: true },
  { word: 'Peindre',       cat: 'actions', kids: true },
  { word: 'Tricoter',      cat: 'actions'              },
  { word: 'Coudre',        cat: 'actions'              },
  { word: 'Chuchoter',     cat: 'actions'              },
  { word: 'Réparer',       cat: 'actions'              },
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

/**
 * Retourne 15 mots mélangés pour une partie.
 * Assure la diversité des catégories : max 2 mots par catégorie.
 * @param {Set<string>} [exclude]  - Ensemble de mots à exclure (pour éviter les doublons entre équipes).
 * @param {boolean}     [kidsMode] - Si vrai, filtre uniquement les mots adaptés aux enfants.
 */
export function getGameWords(exclude = new Set(), kidsMode = false) {
  const pool = kidsMode ? POOL.filter(w => w.kids) : POOL;
  const byCategory = {};
  for (const w of pool) {
    if (!byCategory[w.cat]) byCategory[w.cat] = [];
    byCategory[w.cat].push(w);
  }

  const result = [];
  const shuffledCats = shuffle(Object.keys(byCategory));

  // Pick up to 2 words per category in first pass (excluding already-used words)
  for (const cat of shuffledCats) {
    const words = shuffle(byCategory[cat]).filter(w => !exclude.has(w.word));
    const pick = Math.min(2, words.length);
    result.push(...words.slice(0, pick));
  }

  // Shuffle and take 15
  return shuffle(result).slice(0, 15);
}

// ─── Manche "Les Énigmes" ──────────────────────────────────────────────────────
/**
 * Retourne 5 mots pour la manche Les Énigmes.
 * @param {Set<string>} [exclude]
 * @param {boolean}     [kidsMode]
 */
export function getEnigmesWords(exclude = new Set(), kidsMode = false) {
  const pool = kidsMode ? POOL.filter(w => w.kids) : POOL;
  return shuffle(pool.filter(w => !exclude.has(w.word))).slice(0, 5);
}

// ─── Manche "Contre-la-montre" ─────────────────────────────────────────────────
/**
 * Retourne 7 mots d'une même catégorie pour la manche Contre-la-montre.
 * @param {Set<string>} [usedCats] - Catégories déjà utilisées (pour varier).
 * @param {boolean}     [kidsMode]
 * @returns {{ cat: string, catInfo: object, words: object[] }}
 */
export function getContreLaMontre(usedCats = new Set(), kidsMode = false) {
  const pool = kidsMode ? POOL.filter(w => w.kids) : POOL;
  const byCategory = {};
  for (const w of pool) {
    if (!byCategory[w.cat]) byCategory[w.cat] = [];
    byCategory[w.cat].push(w);
  }
  const eligible = Object.keys(byCategory).filter(c => byCategory[c].length >= 7);
  const available = eligible.filter(c => !usedCats.has(c));
  const cats = available.length > 0 ? available : eligible;
  const cat = shuffle(cats)[0];
  const words = shuffle(byCategory[cat]).slice(0, 7);
  return { cat, catInfo: CATEGORIES[cat], words };
}

// ─── Manche "La Grande Pyramide" ───────────────────────────────────────────────
/**
 * Retourne 6 mots pour la Grande Pyramide.
 * @param {boolean} [kidsMode]
 */
export function getGrandePyramideWords(kidsMode = false) {
  const pool = kidsMode ? POOL.filter(w => w.kids) : POOL;
  return shuffle([...pool]).slice(0, 6);
}

// ─── Manche "Noms propres" ─────────────────────────────────────────────────────
/**
 * Ensemble de noms propres groupés par thème pour la manche Noms propres.
 */
export const NOMS_PROPRES_SETS = [
  { theme: 'Présidents français',           names: ['Charles de Gaulle', 'François Mitterrand', 'Jacques Chirac', 'Nicolas Sarkozy', 'François Hollande', 'Emmanuel Macron'] },
  { theme: 'Planètes du Système solaire',   names: ['Mercure', 'Vénus', 'Mars', 'Jupiter', 'Saturne', 'Uranus', 'Neptune'] },
  { theme: 'Capitales européennes',         names: ['Paris', 'Berlin', 'Madrid', 'Rome', 'Lisbonne', 'Vienne', 'Amsterdam', 'Bruxelles', 'Stockholm', 'Varsovie'] },
  { theme: 'Footballeurs légendaires',      names: ['Zinedine Zidane', 'Pelé', 'Maradona', 'Ronaldo', 'Messi', 'Mbappé', 'Ronaldinho', 'Thierry Henry'] },
  { theme: 'Acteurs hollywoodiens',         names: ['Tom Hanks', 'Brad Pitt', 'Leonardo DiCaprio', 'Morgan Freeman', 'Meryl Streep', 'Denzel Washington', 'Jodie Foster', 'Cate Blanchett'] },
  { theme: 'Grands compositeurs classiques', names: ['Mozart', 'Beethoven', 'Bach', 'Chopin', 'Vivaldi', 'Tchaïkovski', 'Liszt', 'Haendel'] },
  { theme: 'Super-héros Marvel',            names: ['Spider-Man', 'Iron Man', 'Captain America', 'Thor', 'Hulk', 'Black Widow', 'Docteur Strange', 'Black Panther'] },
  { theme: 'Auteurs français classiques',   names: ['Victor Hugo', 'Molière', 'Voltaire', 'Gustave Flaubert', 'Émile Zola', 'Honoré de Balzac', 'Marcel Proust', 'Charles Baudelaire'] },
  { theme: 'Peintres célèbres',             names: ['Léonard de Vinci', 'Pablo Picasso', 'Salvador Dalí', 'Claude Monet', 'Vincent van Gogh', 'Michel-Ange', 'Rembrandt', 'Paul Gauguin'] },
  { theme: 'Fleuves de France',             names: ['Seine', 'Loire', 'Garonne', 'Rhône', 'Dordogne', 'Saône', 'Moselle'] },
  { theme: 'Villes françaises',             names: ['Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg', 'Montpellier', 'Rennes'] },
  { theme: 'Fromages français',             names: ['Camembert', 'Brie', 'Roquefort', 'Comté', 'Reblochon', 'Munster', 'Époisses', 'Cantal', 'Emmental'] },
  { theme: 'Présidents américains',         names: ['Abraham Lincoln', 'John Kennedy', 'Franklin Roosevelt', 'Barack Obama', 'George Washington', 'Theodore Roosevelt', 'Bill Clinton'] },
  { theme: 'Personnages de Disney',         names: ['Mickey Mouse', 'Simba', 'Elsa', 'Cendrillon', 'Ariel', 'Belle', 'Bambi', 'Mulan', 'Pinocchio'] },
  { theme: 'Pays d\'Afrique',              names: ['Maroc', 'Égypte', 'Algérie', 'Éthiopie', 'Nigeria', 'Afrique du Sud', 'Tunisie', 'Sénégal', 'Kenya', 'Ghana'] },
];

/**
 * Retourne un set de noms propres pour la manche Noms propres.
 * @param {Set<string>} [usedThemes] - Thèmes déjà utilisés (pour varier).
 * @returns {{ theme: string, names: string[] }}
 */
export function getNomsPropreSet(usedThemes = new Set()) {
  const available = NOMS_PROPRES_SETS.filter(s => !usedThemes.has(s.theme));
  const pool = available.length > 0 ? available : NOMS_PROPRES_SETS;
  const set = shuffle(pool)[0];
  return { theme: set.theme, names: shuffle([...set.names]).slice(0, 3) };
}
