/**
 * words.js — Liste de mots thématiques généraux
 * pour le jeu Flash Guess
 */

const STORAGE_KEY = 'flashguess_custom_words';

export const CATEGORY_LABELS = {
  history:            { label: 'Histoire',          emoji: '🏛️' },
  geography:          { label: 'Géographie',         emoji: '🗺️' },
  music:              { label: 'Musique',            emoji: '🎵' },
  film_and_tv:        { label: 'Cinéma & TV',        emoji: '🎬' },
  sport:              { label: 'Sport & Loisirs',    emoji: '⚽' },
  science:            { label: 'Sciences',           emoji: '🔬' },
  general_knowledge:  { label: 'Culture Générale',   emoji: '🌐' },
  arts_and_literature:{ label: 'Arts & Littérature', emoji: '📚' },
  food_and_drink:     { label: 'Cuisine & Boissons', emoji: '🍽️' },
  society_and_culture:{ label: 'Société & Culture',  emoji: '👥' },
};

export const DEFAULT_WORDS = [
  // ─── Histoire ─────────────────────────────────────────────────────────────────
  { word: 'Napoléon Bonaparte',      category: 'history',              kidFriendly: true  },
  { word: 'Révolution française',    category: 'history' },
  { word: 'Jeanne d\'Arc',           category: 'history',              kidFriendly: true  },
  { word: 'Louis XIV',               category: 'history' },
  { word: 'Jules César',             category: 'history',              kidFriendly: true  },
  { word: 'Cléopâtre',               category: 'history',              kidFriendly: true  },
  { word: 'Charlemagne',             category: 'history',              kidFriendly: true  },
  { word: 'Versailles',              category: 'history',              kidFriendly: true  },
  { word: 'Bastille',                category: 'history' },
  { word: 'Waterloo',                category: 'history' },
  { word: 'Guerre mondiale',         category: 'history',              kidFriendly: true  },
  { word: 'Mur de Berlin',           category: 'history' },
  { word: 'Homère',                  category: 'history' },
  { word: 'Alexandre le Grand',      category: 'history',              kidFriendly: true  },
  { word: 'Magellan',                category: 'history' },
  { word: 'Gutenberg',               category: 'history' },
  { word: 'Guillotine',              category: 'history' },
  { word: 'Débarquement',            category: 'history' },
  { word: 'Armistice',               category: 'history' },
  { word: 'Colonisation',            category: 'history' },

  // ─── Géographie ───────────────────────────────────────────────────────────────
  { word: 'Everest',                 category: 'geography',            kidFriendly: true  },
  { word: 'Amazone',                 category: 'geography',            kidFriendly: true  },
  { word: 'Sahara',                  category: 'geography',            kidFriendly: true  },
  { word: 'Himalaya',                category: 'geography',            kidFriendly: true  },
  { word: 'Nil',                     category: 'geography',            kidFriendly: true  },
  { word: 'Antarctique',             category: 'geography',            kidFriendly: true  },
  { word: 'Grand Canyon',            category: 'geography',            kidFriendly: true  },
  { word: 'Île de Pâques',           category: 'geography',            kidFriendly: true  },
  { word: 'Machu Picchu',            category: 'geography' },
  { word: 'Venise',                  category: 'geography',            kidFriendly: true  },
  { word: 'Mont Blanc',              category: 'geography',            kidFriendly: true  },
  { word: 'Islande',                 category: 'geography' },
  { word: 'Patagonie',               category: 'geography' },
  { word: 'Maldives',                category: 'geography' },
  { word: 'Désert de Gobi',          category: 'geography' },
  { word: 'Fjord',                   category: 'geography' },
  { word: 'Amazonie',                category: 'geography',            kidFriendly: true  },
  { word: 'Méditerranée',            category: 'geography',            kidFriendly: true  },
  { word: 'Arctique',                category: 'geography',            kidFriendly: true  },
  { word: 'Volcan',                  category: 'geography',            kidFriendly: true  },

  // ─── Musique ──────────────────────────────────────────────────────────────────
  { word: 'Beatles',                 category: 'music',                kidFriendly: true  },
  { word: 'Mozart',                  category: 'music',                kidFriendly: true  },
  { word: 'Michael Jackson',         category: 'music',                kidFriendly: true  },
  { word: 'Beethoven',               category: 'music',                kidFriendly: true  },
  { word: 'Elvis Presley',           category: 'music',                kidFriendly: true  },
  { word: 'Bob Marley',              category: 'music',                kidFriendly: true  },
  { word: 'Rolling Stones',          category: 'music' },
  { word: 'Édith Piaf',              category: 'music' },
  { word: 'Daft Punk',               category: 'music',                kidFriendly: true  },
  { word: 'Freddie Mercury',         category: 'music' },
  { word: 'Metallica',               category: 'music' },
  { word: 'Rihanna',                 category: 'music',                kidFriendly: true  },
  { word: 'Chopin',                  category: 'music' },
  { word: 'David Bowie',             category: 'music' },
  { word: 'Miles Davis',             category: 'music' },
  { word: 'Johnny Hallyday',         category: 'music' },
  { word: 'Beyoncé',                 category: 'music',                kidFriendly: true  },
  { word: 'Guitare électrique',      category: 'music',                kidFriendly: true  },
  { word: 'Disque de platine',       category: 'music' },
  { word: 'Karaoké',                 category: 'music',                kidFriendly: true  },

  // ─── Cinéma & TV ──────────────────────────────────────────────────────────────
  { word: 'Titanic',                 category: 'film_and_tv',          kidFriendly: true  },
  { word: 'Star Wars',               category: 'film_and_tv',          kidFriendly: true  },
  { word: 'Avengers',                category: 'film_and_tv',          kidFriendly: true  },
  { word: 'James Bond',              category: 'film_and_tv',          kidFriendly: true  },
  { word: 'Harry Potter',            category: 'film_and_tv',          kidFriendly: true  },
  { word: 'Le Parrain',              category: 'film_and_tv' },
  { word: 'Batman',                  category: 'film_and_tv',          kidFriendly: true  },
  { word: 'Jurassic Park',           category: 'film_and_tv',          kidFriendly: true  },
  { word: 'Toy Story',               category: 'film_and_tv',          kidFriendly: true  },
  { word: 'Terminator',              category: 'film_and_tv',          kidFriendly: true  },
  { word: 'Matrix',                  category: 'film_and_tv' },
  { word: 'Indiana Jones',           category: 'film_and_tv',          kidFriendly: true  },
  { word: 'Game of Thrones',         category: 'film_and_tv' },
  { word: 'Breaking Bad',            category: 'film_and_tv' },
  { word: 'Friends',                 category: 'film_and_tv',          kidFriendly: true  },
  { word: 'Shrek',                   category: 'film_and_tv',          kidFriendly: true  },
  { word: 'Lion King',               category: 'film_and_tv',          kidFriendly: true  },
  { word: 'Inception',               category: 'film_and_tv' },
  { word: 'Pirates des Caraïbes',    category: 'film_and_tv',          kidFriendly: true  },
  { word: 'Forrest Gump',            category: 'film_and_tv' },

  // ─── Sport & Loisirs ──────────────────────────────────────────────────────────
  { word: 'Coupe du Monde',          category: 'sport',                kidFriendly: true  },
  { word: 'Jeux Olympiques',         category: 'sport',                kidFriendly: true  },
  { word: 'Tour de France',          category: 'sport',                kidFriendly: true  },
  { word: 'Roland Garros',           category: 'sport' },
  { word: 'Formule 1',               category: 'sport',                kidFriendly: true  },
  { word: 'Championnat du Monde',    category: 'sport',                kidFriendly: true  },
  { word: 'Michael Jordan',          category: 'sport',                kidFriendly: true  },
  { word: 'Cristiano Ronaldo',       category: 'sport',                kidFriendly: true  },
  { word: 'Serena Williams',         category: 'sport' },
  { word: 'Usain Bolt',              category: 'sport',                kidFriendly: true  },
  { word: 'Muhammad Ali',            category: 'sport',                kidFriendly: true  },
  { word: 'Super Bowl',              category: 'sport' },
  { word: 'Tour Eiffel Marathon',    category: 'sport' },
  { word: 'Skateboard',              category: 'sport',                kidFriendly: true  },
  { word: 'Surf',                    category: 'sport',                kidFriendly: true  },
  { word: 'Rugby',                   category: 'sport',                kidFriendly: true  },
  { word: 'Basket-ball',             category: 'sport',                kidFriendly: true  },
  { word: 'Natation',                category: 'sport',                kidFriendly: true  },
  { word: 'Escrime',                 category: 'sport' },
  { word: 'Karaté',                  category: 'sport',                kidFriendly: true  },

  // ─── Sciences ─────────────────────────────────────────────────────────────────
  { word: 'Albert Einstein',         category: 'science',              kidFriendly: true  },
  { word: 'ADN',                     category: 'science' },
  { word: 'Big Bang',                category: 'science',              kidFriendly: true  },
  { word: 'Gravité',                 category: 'science',              kidFriendly: true  },
  { word: 'Atome',                   category: 'science',              kidFriendly: true  },
  { word: 'Évolution',               category: 'science' },
  { word: 'Isaac Newton',            category: 'science',              kidFriendly: true  },
  { word: 'Trou noir',               category: 'science',              kidFriendly: true  },
  { word: 'Radioactivité',           category: 'science' },
  { word: 'Marie Curie',             category: 'science',              kidFriendly: true  },
  { word: 'Charles Darwin',          category: 'science' },
  { word: 'Clonage',                 category: 'science' },
  { word: 'Virus',                   category: 'science',              kidFriendly: true  },
  { word: 'Vaccin',                  category: 'science',              kidFriendly: true  },
  { word: 'Quantum',                 category: 'science' },
  { word: 'Photosynthèse',           category: 'science',              kidFriendly: true  },
  { word: 'Intelligence artificielle', category: 'science' },
  { word: 'Galaxie',                 category: 'science',              kidFriendly: true  },
  { word: 'Fusée',                   category: 'science',              kidFriendly: true  },
  { word: 'Électricité',             category: 'science',              kidFriendly: true  },

  // ─── Culture Générale ─────────────────────────────────────────────────────────
  { word: 'Tour Eiffel',             category: 'general_knowledge',    kidFriendly: true  },
  { word: 'Big Ben',                 category: 'general_knowledge',    kidFriendly: true  },
  { word: 'Colisée',                 category: 'general_knowledge',    kidFriendly: true  },
  { word: 'Pyramides de Gizeh',      category: 'general_knowledge',    kidFriendly: true  },
  { word: 'Statue de la Liberté',    category: 'general_knowledge',    kidFriendly: true  },
  { word: 'Arc de Triomphe',         category: 'general_knowledge',    kidFriendly: true  },
  { word: 'Vatican',                 category: 'general_knowledge' },
  { word: 'Muraille de Chine',       category: 'general_knowledge',    kidFriendly: true  },
  { word: 'Stonehenge',              category: 'general_knowledge',    kidFriendly: true  },
  { word: 'Taj Mahal',               category: 'general_knowledge',    kidFriendly: true  },
  { word: 'Notre-Dame de Paris',     category: 'general_knowledge',    kidFriendly: true  },
  { word: 'Louvre',                  category: 'general_knowledge',    kidFriendly: true  },
  { word: 'Colosseum',               category: 'general_knowledge',    kidFriendly: true  },
  { word: 'Opéra de Sydney',         category: 'general_knowledge',    kidFriendly: true  },
  { word: 'Golden Gate',             category: 'general_knowledge',    kidFriendly: true  },
  { word: 'Kremlin',                 category: 'general_knowledge' },
  { word: 'Tour de Pise',            category: 'general_knowledge',    kidFriendly: true  },
  { word: 'Alhambra',                category: 'general_knowledge' },
  { word: 'Acropole',                category: 'general_knowledge' },
  { word: 'Angkor Wat',              category: 'general_knowledge' },

  // ─── Arts & Littérature ───────────────────────────────────────────────────────
  { word: 'Mona Lisa',               category: 'arts_and_literature',  kidFriendly: true  },
  { word: 'Pablo Picasso',           category: 'arts_and_literature',  kidFriendly: true  },
  { word: 'Shakespeare',             category: 'arts_and_literature',  kidFriendly: true  },
  { word: 'Victor Hugo',             category: 'arts_and_literature',  kidFriendly: true  },
  { word: 'Léonard de Vinci',        category: 'arts_and_literature',  kidFriendly: true  },
  { word: 'Balzac',                  category: 'arts_and_literature' },
  { word: 'Monet',                   category: 'arts_and_literature',  kidFriendly: true  },
  { word: 'Van Gogh',                category: 'arts_and_literature',  kidFriendly: true  },
  { word: 'Cervantes',               category: 'arts_and_literature' },
  { word: 'Molière',                 category: 'arts_and_literature' },
  { word: 'Baudelaire',              category: 'arts_and_literature' },
  { word: 'Michelange',              category: 'arts_and_literature',  kidFriendly: true  },
  { word: 'Dali',                    category: 'arts_and_literature',  kidFriendly: true  },
  { word: 'Frida Kahlo',             category: 'arts_and_literature' },
  { word: 'Rodin',                   category: 'arts_and_literature' },
  { word: 'Jules Verne',             category: 'arts_and_literature',  kidFriendly: true  },
  { word: 'Camus',                   category: 'arts_and_literature' },
  { word: 'Zola',                    category: 'arts_and_literature' },
  { word: 'Rembrandt',               category: 'arts_and_literature' },
  { word: 'Kafka',                   category: 'arts_and_literature' },

  // ─── Cuisine & Boissons ───────────────────────────────────────────────────────
  { word: 'Croissant',               category: 'food_and_drink',       kidFriendly: true  },
  { word: 'Pizza',                   category: 'food_and_drink',       kidFriendly: true  },
  { word: 'Sushi',                   category: 'food_and_drink',       kidFriendly: true  },
  { word: 'Champagne',               category: 'food_and_drink' },
  { word: 'Baguette',                category: 'food_and_drink',       kidFriendly: true  },
  { word: 'Raclette',                category: 'food_and_drink',       kidFriendly: true  },
  { word: 'Coq au vin',              category: 'food_and_drink' },
  { word: 'Crêpe',                   category: 'food_and_drink',       kidFriendly: true  },
  { word: 'Macarons',                category: 'food_and_drink',       kidFriendly: true  },
  { word: 'Tarte Tatin',             category: 'food_and_drink' },
  { word: 'Foie gras',               category: 'food_and_drink' },
  { word: 'Chocolat',                category: 'food_and_drink',       kidFriendly: true  },
  { word: 'Burrito',                 category: 'food_and_drink',       kidFriendly: true  },
  { word: 'Ramen',                   category: 'food_and_drink',       kidFriendly: true  },
  { word: 'Burger',                  category: 'food_and_drink',       kidFriendly: true  },
  { word: 'Tacos',                   category: 'food_and_drink',       kidFriendly: true  },
  { word: 'Fromage',                 category: 'food_and_drink',       kidFriendly: true  },
  { word: 'Mojito',                  category: 'food_and_drink' },
  { word: 'Tiramisu',                category: 'food_and_drink',       kidFriendly: true  },
  { word: 'Paella',                  category: 'food_and_drink',       kidFriendly: true  },

  // ─── Société & Culture ────────────────────────────────────────────────────────
  { word: 'Réseaux sociaux',         category: 'society_and_culture',  kidFriendly: true  },
  { word: 'Mondialisation',          category: 'society_and_culture' },
  { word: 'Intelligence artificielle', category: 'society_and_culture' },
  { word: 'Grève',                   category: 'society_and_culture' },
  { word: 'Manifestation',           category: 'society_and_culture' },
  { word: 'Démocratie',              category: 'society_and_culture' },
  { word: 'Féminisme',               category: 'society_and_culture' },
  { word: 'Réchauffement climatique',category: 'society_and_culture',  kidFriendly: true  },
  { word: 'Pandémie',                category: 'society_and_culture' },
  { word: 'Élections',               category: 'society_and_culture' },
  { word: 'Religion',                category: 'society_and_culture' },
  { word: 'Immigration',             category: 'society_and_culture' },
  { word: 'Droits de l\'Homme',      category: 'society_and_culture' },
  { word: 'Cryptomonnaie',           category: 'society_and_culture' },
  { word: 'Écologie',                category: 'society_and_culture',  kidFriendly: true  },
  { word: 'Mode',                    category: 'society_and_culture',  kidFriendly: true  },
  { word: 'Publicité',               category: 'society_and_culture' },
  { word: 'Télévision réalité',      category: 'society_and_culture' },
  { word: 'Jeux vidéo',              category: 'society_and_culture',  kidFriendly: true  },
  { word: 'Podcast',                 category: 'society_and_culture' },
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
        ).map(w => ({
          word: w.word.trim(),
          category: w.category.trim(),
          ...(w.kidFriendly === true ? { kidFriendly: true } : {}),
        }));
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

export function getShuffledWords(selectedCategories = null, kidsMode = false) {
  const words = loadWords();
  let filtered = selectedCategories
    ? words.filter(w => selectedCategories.includes(w.category))
    : words;
  if (kidsMode) {
    filtered = filtered.filter(w => w.kidFriendly === true);
  }
  return shuffle(filtered);
}

export function getCategoryInfo(category) {
  return CATEGORY_LABELS[category] ?? { label: category, emoji: '❓' };
}
