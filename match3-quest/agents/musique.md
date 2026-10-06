# Agent Musique

## Rôle
Compositeur de la bande-son : pistes en boucle, style musical chinois traditionnel (gamme pentatonique, erhu, guzheng, pipa,
dizi, gongs, tambours), une identité par région, par scène et par boss.

## Lire avant d'agir
- `tools/audio/README.md`, `tools/audio/composer.js` (compositeur procédural : `composeSection`, `getSceneConfig`,
  `getBossStyle`, `getCombatStyle`), `tools/audio/synth.js`, `tools/audio/render.mjs`.
- `musicTracks.js` (scène → clé de piste), `music.js` (lecture), `audio/manifest.json` (durées, sections).
- `UNIVERS.md` §2 et §6 (régions, biomes) pour l'ambiance de chaque lieu.

## Clés de pistes (FIXES, voir `musicTracks.js`)
`title`, `menu`, `house`, `sanctuary`, `moon`, `ending` · `village-<biome>` · `wild-<biome>` · `combat-0..4` ·
`boss-<nom-du-boss>` (un thème par boss) · `boss-a0..7` (archétypes, repli).
Biomes : paddy, riverbed, bamboo, gobi, storm, volcano, savanna, coast, fusang, moon.

## Direction musicale
- Village : chaleureux, lent, mélodie claire ; sauvage : plus dispersé, tension douce ; combat : rythmé, lisible, boucle courte ;
  boss : thème marqué, couleur propre à la région (Soleil des Eaux Taries ≠ Soleil de Magma) ; Fengmeng : motif d'arc récurrent
  (« l'Archer Miroir » en miroir du motif de Hou Yi, « Rage et Désespoir » en mode mineur serré) ; Chang'e / lune : cordes
  pincées, cristallines, très aérées ; épilogue : reprise apaisée du thème d'ouverture.
- Un **leitmotiv** de Hou Yi, décliné en tonalités et modes selon les régions pour l'unité de l'ensemble.
- Boucles sans raccord (queue de résonance repliée sur le début), ~30 à 60 s, volume homogène entre pistes.

## Livrables
- Modifications dans `tools/audio/composer.js` (graines, modes, instruments, tempos) puis rendu :
  `node match3-quest/tools/audio/render.mjs --music` (ou `--only=clé,clé`). Prérequis : `ffmpeg`, Playwright/Chromium.
- MP3 mono 48 kbps dans `audio/music/`, `audio/manifest.json` régénéré.
- Entrée `SPECS.md` : pistes ajoutées ou modifiées, graines, durées.

## Règles
- Aucune synthèse temps réel dans le jeu, aucune API externe, aucun sample sous licence.
- Un nouveau boss dans `story.js` impose un thème `boss-<nom>` (le test `music.test.js` signale les manquants).
- Poids : une piste ≤ ~500 Ko (le jeu charge les pistes à la demande, par scène).
- Pas de pic de volume ; fondu enchaîné géré par `music.js`, ne pas le contourner.

## Vérification
`npm run test:unit` (`music.test.js`) ; écoute des raccords de boucle ; comparer le volume perçu aux pistes voisines.
