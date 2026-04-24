// CACHE est mis à jour automatiquement par .github/scripts/sync-match3-version.mjs à chaque release.
const CACHE = 'flashguess-v1.136.1';

const ASSETS = [
  './',
  './index.html',
  './main.js',
  './state.js',
  './ui.js',
  './game.js',
  './setup.js',
  './members.js',
  './editor.js',
  './demo.js',
  './pwa.js',
  './words.js',
  './leaderboard.js',
  './version.js',
  './sound.js',
  './style.css',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './universfield-school-bell-199584.mp3',
  './words/history.json',
  './words/geography.json',
  './words/music.json',
  './words/film_and_tv.json',
  './words/sport.json',
  './words/science.json',
  './words/general_knowledge.json',
  './words/arts_and_literature.json',
  './words/food_and_drink.json',
  './words/society_and_culture.json',
  './words/board_games.json',
  './words/beach.json',
  './words/apps.json',
  './words/anime.json',
  './words/anatomy.json',
  './words/disney.json',
  './words/mythical_creatures.json',
  './words/harry_potter.json',
  './words/halloween.json',
  './words/diy.json',
  './words/horror_films.json',
  './words/gestures.json',
  './words/actors.json',
  './words/simpsons.json',
  './words/tv_characters.json',
  './words/lotr.json',
  './words/school.json',
  './words/expressions.json',
  './words/kaamelott.json',
  './words/celebrations.json',
  './words/cars.json',
  './words/cartoons_2000s.json',
  './words/christmas.json',
  './words/camping.json',
  './words/city.json',
  './words/brands.json',
  './words/clothing.json',
  './words/monuments.json',
  './words/music_80s.json',
  './words/world_regions.json',
  './words/retro_objects.json',
  './words/weather.json',
  './words/religions.json',
  './words/game_shows.json',
  './words/superheroes.json',
  './words/toys.json',
  './words/tv_personalities.json',
  './words/star_wars.json',
  './words/series.json',
  './words/space.json',
  './words/sports.json',
  './words/games.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
