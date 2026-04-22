/**
 * words.js — Liste de mots thématiques pour Flash Guess
 * Les mots sont stockés dans des fichiers JSON (un par catégorie)
 * dans le dossier words/.
 */

import historyWords         from './words/history.json'          with { type: 'json' };
import geographyWords       from './words/geography.json'        with { type: 'json' };
import musicWords           from './words/music.json'            with { type: 'json' };
import filmAndTvWords       from './words/film_and_tv.json'      with { type: 'json' };
import sportWords           from './words/sport.json'            with { type: 'json' };
import scienceWords         from './words/science.json'          with { type: 'json' };
import generalKnowledgeWords from './words/general_knowledge.json' with { type: 'json' };
import artsAndLiteratureWords from './words/arts_and_literature.json' with { type: 'json' };
import foodAndDrinkWords    from './words/food_and_drink.json'   with { type: 'json' };
import societyAndCultureWords from './words/society_and_culture.json' with { type: 'json' };
import boardGamesWords      from './words/board_games.json'      with { type: 'json' };
import beachWords           from './words/beach.json'            with { type: 'json' };
import appsWords            from './words/apps.json'             with { type: 'json' };
import animeWords           from './words/anime.json'            with { type: 'json' };
import anatomyWords         from './words/anatomy.json'          with { type: 'json' };
import disneyWords          from './words/disney.json'           with { type: 'json' };
import mythicalCreaturesWords from './words/mythical_creatures.json' with { type: 'json' };
import harryPotterWords     from './words/harry_potter.json'     with { type: 'json' };
import halloweenWords       from './words/halloween.json'        with { type: 'json' };
import diyWords             from './words/diy.json'              with { type: 'json' };
import horrorFilmsWords     from './words/horror_films.json'     with { type: 'json' };
import gesturesWords        from './words/gestures.json'         with { type: 'json' };
import actorsWords          from './words/actors.json'           with { type: 'json' };
import simpsonsWords        from './words/simpsons.json'         with { type: 'json' };
import tvCharactersWords    from './words/tv_characters.json'    with { type: 'json' };
import lotrWords            from './words/lotr.json'             with { type: 'json' };
import schoolWords          from './words/school.json'           with { type: 'json' };
import expressionsWords     from './words/expressions.json'      with { type: 'json' };
import kaamelottWords       from './words/kaamelott.json'        with { type: 'json' };
import celebrationsWords    from './words/celebrations.json'     with { type: 'json' };
import carsWords            from './words/cars.json'             with { type: 'json' };
import cartoons2000sWords   from './words/cartoons_2000s.json'   with { type: 'json' };
import christmasWords       from './words/christmas.json'        with { type: 'json' };
import campingWords         from './words/camping.json'          with { type: 'json' };
import cityWords            from './words/city.json'             with { type: 'json' };
import brandsWords          from './words/brands.json'           with { type: 'json' };
import clothingWords        from './words/clothing.json'         with { type: 'json' };
import monumentsWords       from './words/monuments.json'        with { type: 'json' };
import music80sWords        from './words/music_80s.json'        with { type: 'json' };
import worldRegionsWords    from './words/world_regions.json'    with { type: 'json' };
import retroObjectsWords    from './words/retro_objects.json'    with { type: 'json' };
import weatherWords         from './words/weather.json'          with { type: 'json' };
import religionsWords       from './words/religions.json'        with { type: 'json' };
import gameShowsWords       from './words/game_shows.json'       with { type: 'json' };
import superheroesWords     from './words/superheroes.json'      with { type: 'json' };
import toysWords            from './words/toys.json'             with { type: 'json' };
import tvPersonalitiesWords from './words/tv_personalities.json' with { type: 'json' };
import starWarsWords        from './words/star_wars.json'        with { type: 'json' };
import seriesWords          from './words/series.json'           with { type: 'json' };
import spaceWords           from './words/space.json'            with { type: 'json' };
import sportsWords          from './words/sports.json'           with { type: 'json' };
import gamesWords           from './words/games.json'            with { type: 'json' };

const STORAGE_KEY = 'flashguess_custom_words';

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

/** Associe chaque clé de catégorie à son tableau de mots JSON. */
const CATEGORY_WORDS = {
  history:             historyWords,
  geography:           geographyWords,
  music:               musicWords,
  film_and_tv:         filmAndTvWords,
  sport:               sportWords,
  science:             scienceWords,
  general_knowledge:   generalKnowledgeWords,
  arts_and_literature: artsAndLiteratureWords,
  food_and_drink:      foodAndDrinkWords,
  society_and_culture: societyAndCultureWords,
  board_games:         boardGamesWords,
  beach:               beachWords,
  apps:                appsWords,
  anime:               animeWords,
  anatomy:             anatomyWords,
  disney:              disneyWords,
  mythical_creatures:  mythicalCreaturesWords,
  harry_potter:        harryPotterWords,
  halloween:           halloweenWords,
  diy:                 diyWords,
  horror_films:        horrorFilmsWords,
  gestures:            gesturesWords,
  actors:              actorsWords,
  simpsons:            simpsonsWords,
  tv_characters:       tvCharactersWords,
  lotr:                lotrWords,
  school:              schoolWords,
  expressions:         expressionsWords,
  kaamelott:           kaamelottWords,
  celebrations:        celebrationsWords,
  cars:                carsWords,
  cartoons_2000s:      cartoons2000sWords,
  christmas:           christmasWords,
  camping:             campingWords,
  city:                cityWords,
  brands:              brandsWords,
  clothing:            clothingWords,
  monuments:           monumentsWords,
  music_80s:           music80sWords,
  world_regions:       worldRegionsWords,
  retro_objects:       retroObjectsWords,
  weather:             weatherWords,
  religions:           religionsWords,
  game_shows:          gameShowsWords,
  superheroes:         superheroesWords,
  toys:                toysWords,
  tv_personalities:    tvPersonalitiesWords,
  star_wars:           starWarsWords,
  series:              seriesWords,
  space:               spaceWords,
  sports:              sportsWords,
  games:               gamesWords,
};

export const DEFAULT_WORDS = Object.entries(CATEGORY_WORDS).flatMap(
  ([category, entries]) => entries.map(({ word, kidFriendly }) => ({
    word,
    category,
    ...(kidFriendly ? { kidFriendly: true } : {}),
  }))
);

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
    filtered = filtered.filter(w => w.kidFriendly);
  } else {
    filtered = filtered.filter(w => !w.kidFriendly);
  }
  return shuffle(filtered);
}

export function getCategoryInfo(category) {
  return CATEGORY_LABELS[category] ?? { label: category, emoji: '❓' };
}
