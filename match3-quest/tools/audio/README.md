# Audio du jeu : pistes et effets pré-enregistrés

Le jeu **ne génère plus aucun son en temps réel** : la musique (`audio/music/*.mp3`) et les effets (`audio/sfx/*.mp3`) sont
rendus une fois pour toutes, puis simplement lus (`music.js`, `sound.js`). Aucune saccade, même sur un vieil appareil.

* Les pistes sont composées et synthétisées par du code (`composer.js`, `synth.js`, `sfxRecipes.js`) : aucune API externe, aucun
  sample sous licence. (Les services de sons gratuits comme freesound.org ne sont pas joignables depuis l'environnement de
  développement, et le style chinois généré est cohérent avec le jeu.)
* **Régénérer** (seulement pour changer la musique ou les sons) : `node match3-quest/tools/audio/render.mjs`
  (`--music`, `--sfx`, `--only=clé,clé`). Prérequis : `ffmpeg` et Playwright/Chromium. Le rendu se fait hors ligne dans Chromium
  (`OfflineAudioContext`), puis ffmpeg encode en MP3 mono (48 kbps pour la musique, 64 kbps pour les effets).
* Chaque piste de musique est une boucle sans raccord (la queue de résonance est repliée sur le début), d'environ 30 s.
* Clés de pistes (voir `musicTracks.js`) : `title`, `menu`, `house`, `sanctuary`, `moon`, `ending`, `village-<biome>`,
  `wild-<biome>`, `combat-0..4`, `boss-<nom-du-boss>` (un thème par boss, d'après `story.js`) et `boss-a0..7` (thèmes d'archétype,
  repli pour un boss sans piste dédiée). Clés d'effets : `sfxCatalog.js`.
* Ajouter un boss dans `story.js` : relancer `render.mjs --music` (ou `--only=boss-<nom>`) ; le test `music.test.js` signale
  toute piste manquante.
