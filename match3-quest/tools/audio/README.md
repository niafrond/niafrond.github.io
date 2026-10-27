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
  `puzzle-push|mirror|slide` (énigmes à plateau), `wild-<biome>`, `combat-0..4`, `boss-<nom-du-boss>` (un thème par boss, d'après `story.js`) et `boss-a0..7` (thèmes d'archétype,
  repli pour un boss sans piste dédiée). Clés d'effets : `sfxCatalog.js`.
* Ajouter un boss dans `story.js` : relancer `render.mjs --music` (ou `--only=boss-<nom>`) ; le test `music.test.js` signale
  toute piste manquante.

## Effets de sorts et de coups d'arme

Chaque sort a son petit clip (`audio/sfx/spell-<id>.mp3`) et chaque rareté d'arme son coup d'arc (`weaponHit-<rareté>-p|e`) ; ils sont
produits par `spellFx` / `bowHitFx` (`sfxRecipes.js`). Régénérer un sort : `node match3-quest/tools/audio/render.mjs --sfx --only=spell-<id>`.
Ajouter un sort dans `spells.json` : ajouter son id à `SPELL_SFX_IDS` (`sfxCatalog.js`) puis rendre son clip (le test `music.test.js` signale l'oubli).
Pendant ces effets, `duckMusic` (`music.js`) baisse la musique d'environ 40 % le temps du clip.

## Jingles composés par ACE-Step

Les 7 jingles les plus audibles (`introJingle`, `endingJingle`, `battleStart`, `combatStart`, `bossStart`, `victory`, `defeat`) sont composés par
ACE-Step (voir `acestep/README.md`) et non rendus par `render.mjs` : `node acestep/generate.mjs generate "jingle-*"` puis
`node acestep/jingles.mjs install`. Ne pas relancer `render.mjs --sfx` sans `--only` : il écraserait ces clips.
