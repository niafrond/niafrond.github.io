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

Chaque sort a son petit clip (`audio/sfx/spell-<id>.mp3`, 1 à 2,7 s) et chaque rareté d'arme son coup d'arc (`weaponHit-<rareté>-p|e`). Pendant ces
effets, `duckMusic` (`music.js`) baisse la musique d'environ 40 % (1,5 s pour un sort, 1,1 s pour un coup). Ajouter un sort dans `spells.json` :
ajouter son id à `SPELL_SFX_IDS` (`sfxCatalog.js`) puis générer son clip (le test `music.test.js` signale l'oubli).

**Générer les clips, avec le modèle de son choix** (à lancer dans WSL ; les scripts libèrent le GPU et préparent l'environnement tout seuls) :

```
tools/audio/sfx-sample.sh [modèle] [options]   # ÉCHANTILLON : 14 sons représentatifs -> audio/sfx-sample/<modèle>/index.html (page d'écoute), rien dans le jeu
tools/audio/sfx-all.sh    [modèle] [options]   # COMPLET : les 130 clips, installés dans audio/sfx/ + manifeste + précache (demande confirmation, --yes pour passer)
```

Modèles : `audioldm2` (défaut), `audioldm2-large`, `audioldm`, `stable-audio-open` (licence à accepter sur Hugging Face + `huggingface-cli login`),
`hf:<dépôt> --pipeline=audioldm2|audioldm|stableaudio` pour un autre dépôt diffusers, et `cmd` pour N'IMPORTE QUEL outil installé par vos soins :
`tools/audio/sfx-sample.sh cmd --cmd "mon_outil --prompt {prompt} --seconds {secs} --out {out}"` (l'outil écrit un fichier audio à l'emplacement `{out}` ;
`{seed}` et `{key}` sont aussi disponibles ; `SFX_PYTHON=/chemin/python` impose l'interpréteur de votre modèle). Options utiles : `--only=spell-ice,spell-bolt`,
`--caption=short|long`, `--caption-file=f.json` (légendes sur mesure `{clé: légende}`), `--candidates=N`, `--steps=N`, `--seed=N`, `--list`
(affiche les légendes sans rien générer). Tout est détaillé en tête de `sfx_generate.py` ; les légendes de sons se corrigent dans sa liste `RULES`
(mots-clés de l'identifiant du sort -> légende). Les durées sont toujours ≥ 1 s. `git checkout -- audio/` annule une installation décevante.
`render.mjs --sfx --only=spell-<id>` rend la version synthétisée de repli ; ACE-Step (musique) n'est pas fait pour les bruitages.

## Jingles composés par ACE-Step

Les 7 jingles les plus audibles (`introJingle`, `endingJingle`, `battleStart`, `combatStart`, `bossStart`, `victory`, `defeat`) sont composés par
ACE-Step (voir `acestep/README.md`) et non rendus par `render.mjs` : `node acestep/generate.mjs generate "jingle-*"` puis
`node acestep/jingles.mjs install`. Ne pas relancer `render.mjs --sfx` sans `--only` : il écraserait ces clips.
