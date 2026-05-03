/**
 * words.js — Liste de mots pour Pyramide
 * 60+ mots généraux adaptés au jeu de devinettes en équipe.
 */

export const WORDS = [
  // Animaux
  { word: 'éléphant',   cat: 'animal' },
  { word: 'girafe',     cat: 'animal' },
  { word: 'perroquet',  cat: 'animal' },
  { word: 'kangourou',  cat: 'animal' },
  { word: 'requin',     cat: 'animal' },
  { word: 'hibou',      cat: 'animal' },
  { word: 'zèbre',      cat: 'animal' },
  { word: 'baleine',    cat: 'animal' },
  { word: 'guépard',    cat: 'animal' },
  { word: 'escargot',   cat: 'animal' },
  { word: 'pingouin',   cat: 'animal' },
  { word: 'crocodile',  cat: 'animal' },

  // Objets
  { word: 'parapluie',    cat: 'objet' },
  { word: 'lunettes',     cat: 'objet' },
  { word: 'bouteille',    cat: 'objet' },
  { word: 'guitare',      cat: 'objet' },
  { word: 'accordéon',    cat: 'objet' },
  { word: 'lanterne',     cat: 'objet' },
  { word: 'xylophone',    cat: 'objet' },
  { word: 'aquarium',     cat: 'objet' },
  { word: 'lampe torche', cat: 'objet' },
  { word: 'boomerang',    cat: 'objet' },
  { word: 'trampoline',   cat: 'objet' },
  { word: 'jumelles',     cat: 'objet' },

  // Lieux / nature
  { word: 'montagne',    cat: 'lieu' },
  { word: 'volcan',      cat: 'lieu' },
  { word: 'pyramide',    cat: 'lieu' },
  { word: 'phare',       cat: 'lieu' },
  { word: 'bibliothèque', cat: 'lieu' },
  { word: 'cascade',     cat: 'lieu' },
  { word: 'igloo',       cat: 'lieu' },
  { word: 'désert',      cat: 'lieu' },
  { word: 'grotte',      cat: 'lieu' },
  { word: 'château',     cat: 'lieu' },

  // Nourriture
  { word: 'chocolat',   cat: 'aliment' },
  { word: 'ananas',     cat: 'aliment' },
  { word: 'champignon', cat: 'aliment' },
  { word: 'spaghetti',  cat: 'aliment' },
  { word: 'fraise',     cat: 'aliment' },
  { word: 'baguette',   cat: 'aliment' },
  { word: 'fromage',    cat: 'aliment' },
  { word: 'crevette',   cat: 'aliment' },
  { word: 'pastèque',   cat: 'aliment' },
  { word: 'croissant',  cat: 'aliment' },

  // Personnages / métiers
  { word: 'astronaute', cat: 'perso' },
  { word: 'dentiste',   cat: 'perso' },
  { word: 'fantôme',    cat: 'perso' },
  { word: 'jongleur',   cat: 'perso' },
  { word: 'pirate',     cat: 'perso' },
  { word: 'dinosaure',  cat: 'perso' },
  { word: 'licorne',    cat: 'perso' },
  { word: 'robot',      cat: 'perso' },
  { word: 'vampire',    cat: 'perso' },
  { word: 'magicien',   cat: 'perso' },

  // Divers
  { word: 'arc-en-ciel', cat: 'divers' },
  { word: 'tramway',     cat: 'divers' },
  { word: 'cyclone',     cat: 'divers' },
  { word: 'karaté',      cat: 'divers' },
  { word: 'carnaval',    cat: 'divers' },
  { word: 'yoyo',        cat: 'divers' },
  { word: 'révolution',  cat: 'divers' },
  { word: 'origami',     cat: 'divers' },
  { word: 'sous-marin',  cat: 'divers' },
  { word: 'tornade',     cat: 'divers' },
];

/**
 * Retourne `count` mots aléatoires (sans doublons).
 * @param {number} count
 * @returns {string[]}
 */
export function getGameWords(count = 20) {
  const shuffled = [...WORDS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, WORDS.length)).map(w => w.word);
}

// ─── Mode Officiel — Mots pour les Énigmes ────────────────────────────────────
// Pool étendu de mots communs pour la manche 1 (énigmes)
const ENIGMES_POOL = [
  'soleil', 'nuage', 'pluie', 'neige', 'vent', 'orage', 'arc-en-ciel',
  'arbre', 'forêt', 'fleuve', 'océan', 'plage', 'île', 'montagne', 'désert',
  'maison', 'appartement', 'cuisine', 'salon', 'jardin', 'fenêtre', 'porte',
  'voiture', 'avion', 'bateau', 'train', 'vélo', 'moto', 'bus', 'fusée',
  'chien', 'chat', 'lapin', 'cochon', 'vache', 'cheval', 'mouton', 'poule',
  'lion', 'tigre', 'ours', 'loup', 'renard', 'cerf', 'dauphin', 'tortue',
  'pomme', 'orange', 'banane', 'raisin', 'cerises', 'mangue', 'poire', 'prune',
  'pain', 'gâteau', 'glace', 'pizza', 'burger', 'soupe', 'crêpe', 'confiture',
  'livre', 'journal', 'télévision', 'téléphone', 'ordinateur', 'radio', 'appareil photo',
  'médecin', 'policier', 'pompier', 'boulanger', 'professeur', 'acteur', 'chanteur',
  'sport', 'football', 'tennis', 'natation', 'ski', 'danse', 'musique', 'peinture',
  'chapeau', 'manteau', 'chaussures', 'sac', 'montre', 'cravate', 'robe',
  'école', 'hôpital', 'cinéma', 'musée', 'restaurant', 'supermarché', 'aéroport',
  'printemps', 'été', 'automne', 'hiver', 'matin', 'soir', 'nuit', 'midi',
  'rouge', 'bleu', 'vert', 'jaune', 'orange', 'violet', 'rose', 'noir', 'blanc',
];

/**
 * Retourne `count` mots uniques pour les Énigmes.
 * @param {number} count
 * @param {string[]} [exclude=[]] — mots déjà utilisés à exclure
 * @returns {string[]}
 */
export function getEnigmesWords(count = 5, exclude = []) {
  const pool = ENIGMES_POOL.filter(w => !exclude.includes(w));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// ─── Mode Officiel — Mots Ping-Pong ───────────────────────────────────────────
/**
 * Retourne les mots partagés pour le Ping-Pong (manche 2).
 * @param {number} count
 * @returns {string[]}
 */
export function getPingpongWords(count = 5) {
  return getEnigmesWords(count);
}

// ─── Mode Officiel — Noms Propres (Manche 3) ──────────────────────────────────
export const NOMS_PROPRES_SETS = [
  {
    theme: 'Personnages historiques',
    words: ['Napoléon Bonaparte', 'Marie Curie', 'Jules César', 'Cléopâtre', 'Louis XIV', 'Albert Einstein', 'Jeanne d\'Arc', 'Charlemagne'],
  },
  {
    theme: 'Chanteurs & Musiciens',
    words: ['Michael Jackson', 'Edith Piaf', 'Elvis Presley', 'Céline Dion', 'David Bowie', 'Freddie Mercury', 'Madonna', 'Bob Marley'],
  },
  {
    theme: 'Personnages de cinéma',
    words: ['Indiana Jones', 'James Bond', 'Superman', 'Batman', 'Zorro', 'Sherlock Holmes', 'Rocky Balboa', 'Robin Hood'],
  },
  {
    theme: 'Pays du monde',
    words: ['Australie', 'Brésil', 'Japon', 'Inde', 'Canada', 'Mexique', 'Afrique du Sud', 'Norvège'],
  },
  {
    theme: 'Sportifs célèbres',
    words: ['Zinedine Zidane', 'Serena Williams', 'Muhammad Ali', 'Michael Jordan', 'Usain Bolt', 'Roger Federer', 'Pelé', 'Lionel Messi'],
  },
  {
    theme: 'Villes du monde',
    words: ['New York', 'Tokyo', 'Rio de Janeiro', 'Dubaï', 'Sydney', 'Istanbul', 'Barcelone', 'Amsterdam'],
  },
  {
    theme: 'Personnages de fiction',
    words: ['Cendrillon', 'Pinocchio', 'Don Quichotte', 'Dracula', 'Tarzan', 'Frankenstein', 'Robin des Bois', 'Blanche-Neige'],
  },
  {
    theme: 'Inventeurs & Scientifiques',
    words: ['Thomas Edison', 'Leonardo da Vinci', 'Isaac Newton', 'Charles Darwin', 'Louis Pasteur', 'Nikola Tesla', 'Galilée', 'Archimède'],
  },
];

/**
 * Retourne un set de noms propres aléatoire.
 * @returns {{ theme: string, words: string[] }}
 */
export function getNomsPropreSet() {
  const set = NOMS_PROPRES_SETS[Math.floor(Math.random() * NOMS_PROPRES_SETS.length)];
  const shuffled = [...set.words].sort(() => Math.random() - 0.5);
  return { theme: set.theme, words: shuffled.slice(0, 3) };
}

// ─── Mode Officiel — Contre-la-Montre (Manche 4) ─────────────────────────────
export const CONTRE_LA_MONTRE_SETS = [
  { theme: 'Les sports',      words: ['football', 'natation', 'tennis', 'escrime', 'judo', 'cyclisme', 'rugby'] },
  { theme: 'La cuisine',      words: ['couteau', 'casserole', 'four', 'réfrigérateur', 'spatule', 'poêle', 'mixeur'] },
  { theme: 'Les animaux de la ferme', words: ['vache', 'cochon', 'poule', 'mouton', 'chèvre', 'cheval', 'canard'] },
  { theme: 'Les transports',  words: ['voiture', 'avion', 'bateau', 'train', 'vélo', 'moto', 'hélicoptère'] },
  { theme: 'La musique',      words: ['guitare', 'piano', 'violon', 'trompette', 'batterie', 'flûte', 'saxophone'] },
  { theme: 'Les métiers',     words: ['médecin', 'pompier', 'policier', 'boulanger', 'professeur', 'jardinier', 'pilote'] },
  { theme: 'Les fruits',      words: ['pomme', 'banane', 'cerise', 'orange', 'raisin', 'mangue', 'kiwi'] },
  { theme: 'La nature',       words: ['forêt', 'rivière', 'montagne', 'volcan', 'désert', 'glacier', 'île'] },
  { theme: 'Les vêtements',   words: ['manteau', 'robe', 'pantalon', 'chapeau', 'écharpe', 'gants', 'chaussettes'] },
  { theme: 'Les pays',        words: ['France', 'Espagne', 'Italie', 'Allemagne', 'Portugal', 'Grèce', 'Maroc'] },
];

/**
 * Retourne un set de mots pour le Contre-la-Montre.
 * @param {string[]} [exclude=[]] — thèmes à exclure
 * @returns {{ theme: string, words: string[] }}
 */
export function getContreLaMontre(exclude = []) {
  const available = CONTRE_LA_MONTRE_SETS.filter(s => !exclude.includes(s.theme));
  const pool = available.length > 0 ? available : CONTRE_LA_MONTRE_SETS;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Mode Officiel — La Grande Pyramide (Finale) ──────────────────────────────
export const GRANDE_PYRAMIDE_SETS = [
  [
    'avoir le cafard',
    'casser les pieds',
    'avoir la tête dans les nuages',
    'prendre le taureau par les cornes',
    'se lever du pied gauche',
    'avoir d\'autres chats à fouetter',
  ],
  [
    'manger les pissenlits par la racine',
    'avoir le beurre et l\'argent du beurre',
    'poser un lapin',
    'tomber dans les pommes',
    'avoir le vent en poupe',
    'brûler les étapes',
  ],
  [
    'tourner autour du pot',
    'casser du sucre sur le dos de quelqu\'un',
    'avoir les dents qui rayent le parquet',
    'ne pas être dans son assiette',
    'mettre les pieds dans le plat',
    'couper les cheveux en quatre',
  ],
  [
    'vendre la peau de l\'ours avant de l\'avoir tué',
    'avoir du pain sur la planche',
    'tirer les vers du nez',
    'faire la fine bouche',
    'avoir du mal à avaler la pilule',
    'rouler quelqu\'un dans la farine',
  ],
  [
    'arriver comme un cheveu sur la soupe',
    'ne pas y aller par quatre chemins',
    'avoir le cœur sur la main',
    'raconter des salades',
    'tomber à pic',
    'faire d\'une pierre deux coups',
  ],
];

/**
 * Retourne un set de 6 expressions pour la Grande Pyramide.
 * @returns {string[]}
 */
export function getGrandePyramideWords() {
  const set = GRANDE_PYRAMIDE_SETS[Math.floor(Math.random() * GRANDE_PYRAMIDE_SETS.length)];
  return [...set].sort(() => Math.random() - 0.5);
}
