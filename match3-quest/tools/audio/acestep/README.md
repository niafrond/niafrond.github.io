# Génération de la BO avec ACE-Step (hors Claude, sans tokens)

Pilote l'API REST d'[ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5) pour générer les 82 pistes du jeu
(clés de `musicTracks.js`) à partir du brief « Hou Yi : la Chute des Dix Soleils ». Références d'ambiance : Final Fantasy IX
(lyrisme mélodique) et Pokémon GBA (mélodies vives, son compact) — `STYLE_REFERENCES` dans `catalog.mjs`.

## Prérequis
1. Serveur ACE-Step lancé en local par **game-maker** (dans WSL) : `tools/gm up audio` (port 8001). Node ≥ 18. `ffmpeg` pour `install`.
2. Se placer dans ce dossier : `cd match3-quest/tools/audio/acestep`. Aucune dépendance npm.

## Installation (WSL Ubuntu-22.04, GPU NVIDIA)
ACE-Step n'est plus installé ici : il vit dans **game-maker** (`/mnt/c/Users/Niafrond/dev/game-maker`, voir son `README.md`) avec le reste de la pile IA locale.
```
/mnt/c/Users/Niafrond/dev/game-maker/gm setup     # une fois (venv uv, dépendances) ; modèles téléchargés au 1er lancement
tools/gm up audio                                 # serveur sur 127.0.0.1:8001 ; `tools/gm down audio` pour l'arrêter, `tools/gm status`
```
`ACE-Step-1.5` dans ce dossier est un lien (ignoré par git) vers `game-maker/audio/ACE-Step-1.5` ; `~/ACE-Step-1.5` (WSL) aussi, par compatibilité.
Fichiers temporaires d'ACE-Step : `game-maker/audio/tmp` (`ACESTEP_TMPDIR`). Les générations sont téléchargées par HTTP : seuls `out/` et `approved/` de ce dossier comptent.
Le motif est envoyé en upload multipart (le serveur refuse les chemins absolus hors `/tmp`).
Un seul gros modèle GPU à la fois (8 Go) : `tools/gm free` / `tools/gm down pixel` avant la musique si ComfyUI tourne.

## Flux de travail (cohérence des leitmotivs d'abord)
```
node generate.mjs motifs                          # refs/houyi|fengmeng|suns.wav + .mid (depuis leitmotifs.json)
node generate.mjs generate title                  # 2 variantes -> out/title/v001.mp3, v002.mp3 (+ .json)
node generate.mjs approve title v002              # retient la meilleure -> approved/title.mp3 + paramètres
node generate.mjs generate boss-soleil-ardent boss-fengmeng-le-disciple   # thèmes soleils et Feng Meng
node generate.mjs generate "village-*" "wild-*" "combat-*"                # puis le reste
node generate.mjs status                          # avancement
node generate.mjs approve title v007 v008         # 2e version = variante title-b (le jeu en joue une au hasard)
node generate.mjs install                         # approved/ -> audio/music/*.mp3 (stéréo 96 kbps, fin tronquée au dernier passage plein puis fondue dans le début = boucle) + manifest.json
```

## Régénérer facilement
- Nouvelle tentative : relancer `generate <clé>` (nouvelle graine, versions v003, v004… — rien n'est écrasé).
- Retoucher sans réécrire le catalogue : `generate boss-soleil-de-magma --extra "slower, more menacing, deeper pipa"`.
- Affiner une version qui plaît : `generate title --seed 12 --extra "softer drums"` (graine lue dans `out/<clé>/vNNN.json`).
- Mélodie plus fidèle au leitmotiv : `--cover` (le motif sert de source audio) ; `--no-motif` pour s'en passer.
- Mieux structuré : `--thinking`. Durée : `--duration 45`. Champ brut de l'API : `--param guidance_scale=5`.
- Prompt d'une piste à refaire en dur : éditer son `style` dans `catalog.mjs`. Mélodie d'un leitmotiv : `leitmotifs.json` puis `motifs`.
- `--dry-run` affiche les requêtes sans appeler le serveur ; `--host` / `ACESTEP_URL` pour un autre serveur, `ACESTEP_API_KEY` si clé.

## Contrôler une piste sans l'écouter
- `python3 tonality.py out/<clé>/vNNN.mp3` (WSL, numpy + librosa) : tonalité lue dans le `.json` voisin ; liste les fenêtres de 4 s dont plus de 30 % de l'énergie est hors gamme (fausse note, instrument à côté) ou désaccordées de plus de 30 centièmes, avec leur horodatage. Code de sortie 1 s'il y a des passages suspects. `--key "D minor"`, `--win`, `--limit` pour forcer. Les harmoniques naturelles font qu'environ 15 à 25 % d'énergie hors gamme est normal : comparer les variantes entre elles plutôt que viser zéro.
- `node breaks.mjs <fichiers>` : creux de rythme et passages doux (voir l'en-tête du script).

## Fichiers
- `catalog.mjs` : style global + prompt, tempo, tonalité, durée et leitmotiv de chaque piste.
- `leitmotifs.json` : notation exacte des motifs (Hou Yi, Feng Meng, Dix Soleils), source des références WAV/MIDI.
- `out/` (ignoré par git) : toutes les versions générées avec leur requête complète.
- `approved/` : pistes retenues + `.json` (prompt, graine, paramètres) + `approved.json` ; seuls les `.json` sont versionnés (MP3 sources ignorés, trop lourds : voir `export`).

## Export vers Google Drive
`node generate.mjs export` copie les pistes approuvées dans `D:\GoogleDriveCFO\musicMatchQuest\v<AAAA-MM-JJ_HHMM>\` (côté WSL : `/mnt/d/GoogleDriveCFO/musicMatchQuest`). Chaque export crée un dossier horodaté ; `--dest DIR` change la destination.

## Limites à connaître
- Un prompt texte ne reproduit pas les mêmes notes d'un morceau à l'autre : la référence audio réduit l'écart, sans le supprimer.
  Écouter, choisir, et rejouer les motifs importants à la main (MIDI de `refs/`) si besoin.
- Les pistes du jeu bouclent : ACE-Step ne garantit pas un raccord parfait (l'installation ajoute seulement des fondus courts).
  Garder ≤ ~500 Ko (≈ 80 s en 48 kbps mono).
- `install` écrase `audio/music/<clé>.mp3` et met à jour `audio/manifest.json` (durée) ; `render.mjs` (synthèse procédurale) reste le repli.
