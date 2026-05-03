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
  { word: 'submarine',   cat: 'divers' },
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
