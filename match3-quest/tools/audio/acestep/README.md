# Génération de la BO avec ACE-Step (hors Claude, sans tokens)

Pilote l'API REST d'[ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5) pour générer les 82 pistes du jeu
(clés de `musicTracks.js`) à partir du brief « Hou Yi : la Chute des Dix Soleils ». Références d'ambiance : Final Fantasy IX
(lyrisme mélodique) et Pokémon GBA (mélodies vives, son compact) — `STYLE_REFERENCES` dans `catalog.mjs`.

## Prérequis
1. Serveur ACE-Step lancé en local : `acestep-api` (port 8001). Node ≥ 18. `ffmpeg` pour `install`.
2. Se placer dans ce dossier : `cd match3-quest/tools/audio/acestep`. Aucune dépendance npm.

## Installation (WSL Ubuntu-22.04, GPU NVIDIA)
```
curl -LsSf https://astral.sh/uv/install.sh | sh && git clone https://github.com/ace-step/ACE-Step-1.5.git ~/ACE-Step-1.5 && cd ~/ACE-Step-1.5 && uv sync
cd ~/ACE-Step-1.5 && uv run acestep-api        # serveur sur 127.0.0.1:8001 (modèles téléchargés au 1er lancement)
```
Accès depuis ce dossier (lien créé côté WSL, ignoré par git, utilisable depuis WSL) : `wsl ln -sfn /home/niafrond/ACE-Step-1.5 <ce dossier>/ACE-Step-1.5`.
Le serveur est lancé avec `ACESTEP_TMPDIR=<ce dossier>/tmp` (ignoré par git) : audio générés et uploads temporaires y atterrissent (`~/run-acestep-api.sh` côté WSL).
Le motif est envoyé en upload multipart (le serveur refuse les chemins absolus hors `/tmp`).

## Flux de travail (cohérence des leitmotivs d'abord)
```
node generate.mjs motifs                          # refs/houyi|fengmeng|suns.wav + .mid (depuis leitmotifs.json)
node generate.mjs generate title                  # 2 variantes -> out/title/v001.mp3, v002.mp3 (+ .json)
node generate.mjs approve title v002              # retient la meilleure -> approved/title.mp3 + paramètres
node generate.mjs generate boss-soleil-ardent boss-fengmeng-le-disciple   # thèmes soleils et Feng Meng
node generate.mjs generate "village-*" "wild-*" "combat-*"                # puis le reste
node generate.mjs status                          # avancement
node generate.mjs approve title v007 v008         # 2e version = variante title-b (le jeu en joue une au hasard)
node generate.mjs install                         # approved/ -> audio/music/*.mp3 (mono 32 kbps, fin fondue dans le début = boucle) + manifest.json
```

## Régénérer facilement
- Nouvelle tentative : relancer `generate <clé>` (nouvelle graine, versions v003, v004… — rien n'est écrasé).
- Retoucher sans réécrire le catalogue : `generate boss-soleil-de-magma --extra "slower, more menacing, deeper pipa"`.
- Affiner une version qui plaît : `generate title --seed 12 --extra "softer drums"` (graine lue dans `out/<clé>/vNNN.json`).
- Mélodie plus fidèle au leitmotiv : `--cover` (le motif sert de source audio) ; `--no-motif` pour s'en passer.
- Mieux structuré : `--thinking`. Durée : `--duration 45`. Champ brut de l'API : `--param guidance_scale=5`.
- Prompt d'une piste à refaire en dur : éditer son `style` dans `catalog.mjs`. Mélodie d'un leitmotiv : `leitmotifs.json` puis `motifs`.
- `--dry-run` affiche les requêtes sans appeler le serveur ; `--host` / `ACESTEP_URL` pour un autre serveur, `ACESTEP_API_KEY` si clé.

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
