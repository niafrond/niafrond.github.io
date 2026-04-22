/**
 * words.js — Liste de mots thématiques pour Flash Guess
 * Les fichiers JSON sont chargés à la demande (lazy loading) :
 * seules les catégories sélectionnées sont importées.
 */

const STORAGE_KEY = 'flashguess_custom_words';

/** Map catégorie → chemin relatif du fichier JSON. */
const CATEGORY_FILE_MAP = {
  history:             './words/history.json',
  geography:           './words/geography.json',
  music:               './words/music.json',
  film_and_tv:         './words/film_and_tv.json',
  sport:               './words/sport.json',
  science:             './words/science.json',
  general_knowledge:   './words/general_knowledge.json',
  arts_and_literature: './words/arts_and_literature.json',
  food_and_drink:      './words/food_and_drink.json',
  society_and_culture: './words/society_and_culture.json',
  board_games:         './words/board_games.json',
  beach:               './words/beach.json',
  apps:                './words/apps.json',
  anime:               './words/anime.json',
  anatomy:             './words/anatomy.json',
  disney:              './words/disney.json',
  mythical_creatures:  './words/mythical_creatures.json',
  harry_potter:        './words/harry_potter.json',
  halloween:           './words/halloween.json',
  diy:                 './words/diy.json',
  horror_films:        './words/horror_films.json',
  gestures:            './words/gestures.json',
  actors:              './words/actors.json',
  simpsons:            './words/simpsons.json',
  tv_characters:       './words/tv_characters.json',
  lotr:                './words/lotr.json',
  school:              './words/school.json',
  expressions:         './words/expressions.json',
  kaamelott:           './words/kaamelott.json',
  celebrations:        './words/celebrations.json',
  cars:                './words/cars.json',
  cartoons_2000s:      './words/cartoons_2000s.json',
  christmas:           './words/christmas.json',
  camping:             './words/camping.json',
  city:                './words/city.json',
  brands:              './words/brands.json',
  clothing:            './words/clothing.json',
  monuments:           './words/monuments.json',
  music_80s:           './words/music_80s.json',
  world_regions:       './words/world_regions.json',
  retro_objects:       './words/retro_objects.json',
  weather:             './words/weather.json',
  religions:           './words/religions.json',
  game_shows:          './words/game_shows.json',
  superheroes:         './words/superheroes.json',
  toys:                './words/toys.json',
  tv_personalities:    './words/tv_personalities.json',
  star_wars:           './words/star_wars.json',
  series:              './words/series.json',
  space:               './words/space.json',
  sports:              './words/sports.json',
  games:               './words/games.json',
};

/** Cache en mémoire : catégorie → tableau brut du JSON. */
const _cache = {};

/** Charge les données brutes d'une catégorie (avec cache). */
async function loadCategoryWords(category) {
  if (_cache[category]) return _cache[category];
  const mod = await import(CATEGORY_FILE_MAP[category], { with: { type: 'json' } });
  _cache[category] = mod.default;
  return _cache[category];
}

export const CATEGORY_LABELS = {
  history:             { label: 'Histoire',              emoji: '🏛️' },
  geography:           { label: 'Géographie',             emoji: '🗺️' },
  music:               { label: 'Musique',                emoji: '🎵' },
  film_and_tv:         { label: 'Cinéma & TV',            emoji: '🎬' },
  sport:               { label: 'Sport & Loisirs',        emoji: '⚽' },
  science:             { label: 'Sciences',               emoji: '🔬' },
  general_knowledge:   { label: 'Culture Générale',       emoji: '🌐' },
  arts_and_literature: { label: 'Arts & Littérature',     emoji: '📚' },
  food_and_drink:      { label: 'Cuisine & Boissons',     emoji: '🍽️' },
  society_and_culture: { label: 'Société & Culture',      emoji: '👥' },
  board_games:         { label: 'Jeux de société',        emoji: '🎲' },
  beach:               { label: 'La Plage',               emoji: '🏖️' },
  apps:                { label: 'Applis',                 emoji: '📱' },
  anime:               { label: 'Anime',                  emoji: '🎌' },
  anatomy:             { label: 'Anatomie',               emoji: '🫀' },
  disney:              { label: 'Disney',                 emoji: '🏰' },
  mythical_creatures:  { label: 'Créatures Mythiques',    emoji: '🐉' },
  harry_potter:        { label: 'Harry Potter',           emoji: '⚡' },
  halloween:           { label: 'Halloween',              emoji: '🎃' },
  diy:                 { label: 'Bricolage',              emoji: '🔧' },
  horror_films:        { label: "Films d'horreur",        emoji: '👻' },
  gestures:            { label: 'Gestes',                 emoji: '🤌' },
  actors:              { label: 'Acteurs & Actrices',     emoji: '🎭' },
  simpsons:            { label: 'Les Simpson',            emoji: '🟡' },
  tv_characters:       { label: 'Personnages de séries',  emoji: '📺' },
  lotr:                { label: 'Le Seigneur des Anneaux',emoji: '💍' },
  school:              { label: "À l'École",              emoji: '🏫' },
  expressions:         { label: 'Expressions',            emoji: '💬' },
  kaamelott:           { label: 'Kaamelott',              emoji: '⚔️' },
  celebrations:        { label: 'Célébrations',           emoji: '🎉' },
  cars:                { label: 'Voitures',               emoji: '🚗' },
  cartoons_2000s:      { label: 'Dessins Animés 2000s',   emoji: '🖥️' },
  christmas:           { label: 'Noël',                   emoji: '🎄' },
  camping:             { label: 'Camping',                emoji: '⛺' },
  city:                { label: 'En ville',               emoji: '🏙️' },
  brands:              { label: 'Marques',                emoji: '🏷️' },
  clothing:            { label: 'Vêtements',              emoji: '👗' },
  monuments:           { label: 'Monuments',              emoji: '🗽' },
  music_80s:           { label: 'Musique 80s',            emoji: '🎸' },
  world_regions:       { label: 'Régions du monde',       emoji: '🌍' },
  retro_objects:       { label: 'Objets Retro',           emoji: '📼' },
  weather:             { label: 'Météo',                  emoji: '⛅' },
  religions:           { label: 'Religions',              emoji: '🕌' },
  game_shows:          { label: 'Jeux Télé',              emoji: '🎙️' },
  superheroes:         { label: 'Super héros',            emoji: '🦸' },
  toys:                { label: 'Jouets',                 emoji: '🧸' },
  tv_personalities:    { label: 'Personnalités TV',       emoji: '🎤' },
  star_wars:           { label: 'Star Wars',              emoji: '⭐' },
  series:              { label: 'Séries',                 emoji: '🎬' },
  space:               { label: 'Espace',                 emoji: '🚀' },
  sports:              { label: 'Sports',                 emoji: '🏅' },
  games:               { label: 'Jeux',                   emoji: '🎮' },
};

/** Mélange aléatoire (Fisher-Yates) */
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Charge et normalise les mots d'un ensemble de catégories (sans localStorage). */
async function loadCategoriesFromFiles(cats) {
  const chunks = await Promise.all(
    cats
      .filter(cat => cat in CATEGORY_FILE_MAP)
      .map(async cat => {
        const entries = await loadCategoryWords(cat);
        return entries.map(({ word, kidFriendly }) => ({
          word,
          category: cat,
          ...(kidFriendly ? { kidFriendly: true } : {}),
        }));
      })
  );
  return chunks.flat();
}

/**
 * Retourne les mots normalisés pour les catégories données.
 * Si des mots personnalisés existent en localStorage, ils sont renvoyés
 * en totalité (la catégorie sera filtrée par getShuffledWords si besoin).
 * Sinon, seuls les fichiers JSON des catégories demandées sont chargés.
 *
 * @param {string[]|null} categories - catégories à charger, ou null pour toutes
 */
export async function loadWords(categories = null) {
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

  return loadCategoriesFromFiles(categories ?? Object.keys(CATEGORY_LABELS));
}

/** Charge la totalité des mots par défaut (toutes catégories, sans localStorage). */
export function getDefaultWords() {
  return loadCategoriesFromFiles(Object.keys(CATEGORY_LABELS));
}

/** Sauvegarde un tableau de mots dans localStorage. */
export function saveWords(words) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
}

/** Supprime les mots personnalisés (retour aux mots par défaut). */
export function resetWords() {
  localStorage.removeItem(STORAGE_KEY);
}

export async function getShuffledWords(selectedCategories = null, kidsMode = false) {
  const words = await loadWords(selectedCategories);
  let filtered = selectedCategories
    ? words.filter(w => selectedCategories.includes(w.category))
    : words;
  if (kidsMode) {
    filtered = filtered.filter(w => w.kidFriendly);
  } else {
    filtered = filtered.filter(w => !w.kidFriendly);
  }
  return shuffle(filtered);
}

export function getCategoryInfo(category) {
  return CATEGORY_LABELS[category] ?? { label: category, emoji: '❓' };
}
