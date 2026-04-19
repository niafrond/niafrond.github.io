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
  { word: 'Napoléon Bonaparte',      category: 'history' },
  { word: 'Révolution française',    category: 'history' },
  { word: 'Jeanne d\'Arc',           category: 'history' },
  { word: 'Louis XIV',               category: 'history' },
  { word: 'Jules César',             category: 'history' },
  { word: 'Cléopâtre',               category: 'history' },
  { word: 'Charlemagne',             category: 'history' },
  { word: 'Versailles',              category: 'history' },
  { word: 'Bastille',                category: 'history' },
  { word: 'Waterloo',                category: 'history' },
  { word: 'Guerre mondiale',         category: 'history' },
  { word: 'Mur de Berlin',           category: 'history' },
  { word: 'Homère',                  category: 'history' },
  { word: 'Alexandre le Grand',      category: 'history' },
  { word: 'Magellan',                category: 'history' },
  { word: 'Gutenberg',               category: 'history' },
  { word: 'Guillotine',              category: 'history' },
  { word: 'Débarquement',            category: 'history' },
  { word: 'Armistice',               category: 'history' },
  { word: 'Colonisation',            category: 'history' },

  // ─── Géographie ───────────────────────────────────────────────────────────────
  { word: 'Everest',                 category: 'geography' },
  { word: 'Amazone',                 category: 'geography' },
  { word: 'Sahara',                  category: 'geography' },
  { word: 'Himalaya',                category: 'geography' },
  { word: 'Nil',                     category: 'geography' },
  { word: 'Antarctique',             category: 'geography' },
  { word: 'Grand Canyon',            category: 'geography' },
  { word: 'Île de Pâques',           category: 'geography' },
  { word: 'Machu Picchu',            category: 'geography' },
  { word: 'Venise',                  category: 'geography' },
  { word: 'Mont Blanc',              category: 'geography' },
  { word: 'Islande',                 category: 'geography' },
  { word: 'Patagonie',               category: 'geography' },
  { word: 'Maldives',                category: 'geography' },
  { word: 'Désert de Gobi',          category: 'geography' },
  { word: 'Fjord',                   category: 'geography' },
  { word: 'Amazonie',                category: 'geography' },
  { word: 'Méditerranée',            category: 'geography' },
  { word: 'Arctique',                category: 'geography' },
  { word: 'Volcan',                  category: 'geography' },

  // ─── Musique ──────────────────────────────────────────────────────────────────
  { word: 'Beatles',                 category: 'music' },
  { word: 'Mozart',                  category: 'music' },
  { word: 'Michael Jackson',         category: 'music' },
  { word: 'Beethoven',               category: 'music' },
  { word: 'Elvis Presley',           category: 'music' },
  { word: 'Bob Marley',              category: 'music' },
  { word: 'Rolling Stones',          category: 'music' },
  { word: 'Édith Piaf',              category: 'music' },
  { word: 'Daft Punk',               category: 'music' },
  { word: 'Freddie Mercury',         category: 'music' },
  { word: 'Metallica',               category: 'music' },
  { word: 'Rihanna',                 category: 'music' },
  { word: 'Chopin',                  category: 'music' },
  { word: 'David Bowie',             category: 'music' },
  { word: 'Miles Davis',             category: 'music' },
  { word: 'Johnny Hallyday',         category: 'music' },
  { word: 'Beyoncé',                 category: 'music' },
  { word: 'Guitare électrique',      category: 'music' },
  { word: 'Disque de platine',       category: 'music' },
  { word: 'Karaoké',                 category: 'music' },

  // ─── Cinéma & TV ──────────────────────────────────────────────────────────────
  { word: 'Titanic',                 category: 'film_and_tv' },
  { word: 'Star Wars',               category: 'film_and_tv' },
  { word: 'Avengers',                category: 'film_and_tv' },
  { word: 'James Bond',              category: 'film_and_tv' },
  { word: 'Harry Potter',            category: 'film_and_tv' },
  { word: 'Le Parrain',              category: 'film_and_tv' },
  { word: 'Batman',                  category: 'film_and_tv' },
  { word: 'Jurassic Park',           category: 'film_and_tv' },
  { word: 'Toy Story',               category: 'film_and_tv' },
  { word: 'Terminator',              category: 'film_and_tv' },
  { word: 'Matrix',                  category: 'film_and_tv' },
  { word: 'Indiana Jones',           category: 'film_and_tv' },
  { word: 'Game of Thrones',         category: 'film_and_tv' },
  { word: 'Breaking Bad',            category: 'film_and_tv' },
  { word: 'Friends',                 category: 'film_and_tv' },
  { word: 'Shrek',                   category: 'film_and_tv' },
  { word: 'Lion King',               category: 'film_and_tv' },
  { word: 'Inception',               category: 'film_and_tv' },
  { word: 'Pirates des Caraïbes',    category: 'film_and_tv' },
  { word: 'Forrest Gump',            category: 'film_and_tv' },

  // ─── Sport & Loisirs ──────────────────────────────────────────────────────────
  { word: 'Coupe du Monde',          category: 'sport' },
  { word: 'Jeux Olympiques',         category: 'sport' },
  { word: 'Tour de France',          category: 'sport' },
  { word: 'Roland Garros',           category: 'sport' },
  { word: 'Formule 1',               category: 'sport' },
  { word: 'Championnat du Monde',    category: 'sport' },
  { word: 'Michael Jordan',          category: 'sport' },
  { word: 'Cristiano Ronaldo',       category: 'sport' },
  { word: 'Serena Williams',         category: 'sport' },
  { word: 'Usain Bolt',              category: 'sport' },
  { word: 'Muhammad Ali',            category: 'sport' },
  { word: 'Super Bowl',              category: 'sport' },
  { word: 'Tour Eiffel Marathon',    category: 'sport' },
  { word: 'Skateboard',              category: 'sport' },
  { word: 'Surf',                    category: 'sport' },
  { word: 'Rugby',                   category: 'sport' },
  { word: 'Basket-ball',             category: 'sport' },
  { word: 'Natation',                category: 'sport' },
  { word: 'Escrime',                 category: 'sport' },
  { word: 'Karaté',                  category: 'sport' },

  // ─── Sciences ─────────────────────────────────────────────────────────────────
  { word: 'Albert Einstein',         category: 'science' },
  { word: 'ADN',                     category: 'science' },
  { word: 'Big Bang',                category: 'science' },
  { word: 'Gravité',                 category: 'science' },
  { word: 'Atome',                   category: 'science' },
  { word: 'Évolution',               category: 'science' },
  { word: 'Isaac Newton',            category: 'science' },
  { word: 'Trou noir',               category: 'science' },
  { word: 'Radioactivité',           category: 'science' },
  { word: 'Marie Curie',             category: 'science' },
  { word: 'Charles Darwin',          category: 'science' },
  { word: 'Clonage',                 category: 'science' },
  { word: 'Virus',                   category: 'science' },
  { word: 'Vaccin',                  category: 'science' },
  { word: 'Quantum',                 category: 'science' },
  { word: 'Photosynthèse',           category: 'science' },
  { word: 'Intelligence artificielle', category: 'science' },
  { word: 'Galaxie',                 category: 'science' },
  { word: 'Fusée',                   category: 'science' },
  { word: 'Électricité',             category: 'science' },

  // ─── Culture Générale ─────────────────────────────────────────────────────────
  { word: 'Tour Eiffel',             category: 'general_knowledge' },
  { word: 'Big Ben',                 category: 'general_knowledge' },
  { word: 'Colisée',                 category: 'general_knowledge' },
  { word: 'Pyramides de Gizeh',      category: 'general_knowledge' },
  { word: 'Statue de la Liberté',    category: 'general_knowledge' },
  { word: 'Arc de Triomphe',         category: 'general_knowledge' },
  { word: 'Vatican',                 category: 'general_knowledge' },
  { word: 'Muraille de Chine',       category: 'general_knowledge' },
  { word: 'Stonehenge',              category: 'general_knowledge' },
  { word: 'Taj Mahal',               category: 'general_knowledge' },
  { word: 'Notre-Dame de Paris',     category: 'general_knowledge' },
  { word: 'Louvre',                  category: 'general_knowledge' },
  { word: 'Colosseum',               category: 'general_knowledge' },
  { word: 'Opéra de Sydney',         category: 'general_knowledge' },
  { word: 'Golden Gate',             category: 'general_knowledge' },
  { word: 'Kremlin',                 category: 'general_knowledge' },
  { word: 'Tour de Pise',            category: 'general_knowledge' },
  { word: 'Alhambra',                category: 'general_knowledge' },
  { word: 'Acropole',                category: 'general_knowledge' },
  { word: 'Angkor Wat',              category: 'general_knowledge' },

  // ─── Arts & Littérature ───────────────────────────────────────────────────────
  { word: 'Mona Lisa',               category: 'arts_and_literature' },
  { word: 'Pablo Picasso',           category: 'arts_and_literature' },
  { word: 'Shakespeare',             category: 'arts_and_literature' },
  { word: 'Victor Hugo',             category: 'arts_and_literature' },
  { word: 'Léonard de Vinci',        category: 'arts_and_literature' },
  { word: 'Balzac',                  category: 'arts_and_literature' },
  { word: 'Monet',                   category: 'arts_and_literature' },
  { word: 'Van Gogh',                category: 'arts_and_literature' },
  { word: 'Cervantes',               category: 'arts_and_literature' },
  { word: 'Molière',                 category: 'arts_and_literature' },
  { word: 'Baudelaire',              category: 'arts_and_literature' },
  { word: 'Michelange',              category: 'arts_and_literature' },
  { word: 'Dali',                    category: 'arts_and_literature' },
  { word: 'Frida Kahlo',             category: 'arts_and_literature' },
  { word: 'Rodin',                   category: 'arts_and_literature' },
  { word: 'Jules Verne',             category: 'arts_and_literature' },
  { word: 'Camus',                   category: 'arts_and_literature' },
  { word: 'Zola',                    category: 'arts_and_literature' },
  { word: 'Rembrandt',               category: 'arts_and_literature' },
  { word: 'Kafka',                   category: 'arts_and_literature' },

  // ─── Cuisine & Boissons ───────────────────────────────────────────────────────
  { word: 'Croissant',               category: 'food_and_drink' },
  { word: 'Pizza',                   category: 'food_and_drink' },
  { word: 'Sushi',                   category: 'food_and_drink' },
  { word: 'Champagne',               category: 'food_and_drink' },
  { word: 'Baguette',                category: 'food_and_drink' },
  { word: 'Raclette',                category: 'food_and_drink' },
  { word: 'Coq au vin',              category: 'food_and_drink' },
  { word: 'Crêpe',                   category: 'food_and_drink' },
  { word: 'Macarons',                category: 'food_and_drink' },
  { word: 'Tarte Tatin',             category: 'food_and_drink' },
  { word: 'Foie gras',               category: 'food_and_drink' },
  { word: 'Chocolat',                category: 'food_and_drink' },
  { word: 'Burrito',                 category: 'food_and_drink' },
  { word: 'Ramen',                   category: 'food_and_drink' },
  { word: 'Burger',                  category: 'food_and_drink' },
  { word: 'Tacos',                   category: 'food_and_drink' },
  { word: 'Fromage',                 category: 'food_and_drink' },
  { word: 'Mojito',                  category: 'food_and_drink' },
  { word: 'Tiramisu',                category: 'food_and_drink' },
  { word: 'Paella',                  category: 'food_and_drink' },

  // ─── Société & Culture ────────────────────────────────────────────────────────
  { word: 'Réseaux sociaux',         category: 'society_and_culture' },
  { word: 'Mondialisation',          category: 'society_and_culture' },
  { word: 'Intelligence artificielle', category: 'society_and_culture' },
  { word: 'Grève',                   category: 'society_and_culture' },
  { word: 'Manifestation',           category: 'society_and_culture' },
  { word: 'Démocratie',              category: 'society_and_culture' },
  { word: 'Féminisme',               category: 'society_and_culture' },
  { word: 'Réchauffement climatique',category: 'society_and_culture' },
  { word: 'Pandémie',                category: 'society_and_culture' },
  { word: 'Élections',               category: 'society_and_culture' },
  { word: 'Religion',                category: 'society_and_culture' },
  { word: 'Immigration',             category: 'society_and_culture' },
  { word: 'Droits de l\'Homme',      category: 'society_and_culture' },
  { word: 'Cryptomonnaie',           category: 'society_and_culture' },
  { word: 'Écologie',                category: 'society_and_culture' },
  { word: 'Mode',                    category: 'society_and_culture' },
  { word: 'Publicité',               category: 'society_and_culture' },
  { word: 'Télévision réalité',      category: 'society_and_culture' },
  { word: 'Jeux vidéo',              category: 'society_and_culture' },
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

export function getShuffledWords(selectedCategories = null) {
  const words = loadWords();
  const filtered = selectedCategories
    ? words.filter(w => selectedCategories.includes(w.category))
    : words;
  return shuffle(filtered);
}

export function getCategoryInfo(category) {
  return CATEGORY_LABELS[category] ?? { label: category, emoji: '❓' };
}
