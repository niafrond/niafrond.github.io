# Génération de la BO avec ACE-Step (hors Claude, sans tokens)

Pilote l'API REST d'[ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5) pour générer les 82 pistes du jeu
(clés de `musicTracks.js`) à partir du brief « Hou Yi : la Chute des Dix Soleils ». Références d'ambiance : Final Fantasy IX
(lyrisme mélodique) et Pokémon GBA (mélodies vives, son compact) — `STYLE_REFERENCES` dans `catalog.mjs`.

## Prérequis
1. Serveur ACE-Step lancé en local : `acestep-api` (port 8001). Node ≥ 18. `ffmpeg` pour `install`.
2. Se placer dans ce dossier : `cd match3-quest/tools/audio/acestep`. Aucune dépendance npm.

## Flux de travail (cohérence des leitmotivs d'abord)
```
node generate.mjs motifs                          # refs/houyi|fengmeng|suns.wav + .mid (depuis leitmotifs.json)
node generate.mjs generate title                  # 2 variantes -> out/title/v001.mp3, v002.mp3 (+ .json)
node generate.mjs approve title v002              # retient la meilleure -> approved/title.mp3 + paramètres
node generate.mjs generate boss-soleil-ardent boss-fengmeng-le-disciple   # thèmes soleils et Feng Meng
node generate.mjs generate "village-*" "wild-*" "combat-*"                # puis le reste
node generate.mjs status                          # avancement
node generate.mjs install                         # approved/ -> audio/music/*.mp3 (mono 48 kbps) + manifest.json
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
- `approved/` (versionné) : pistes retenues + `.json` (prompt, graine, paramètres) + `approved.json`.

## Limites à connaître
- Un prompt texte ne reproduit pas les mêmes notes d'un morceau à l'autre : la référence audio réduit l'écart, sans le supprimer.
  Écouter, choisir, et rejouer les motifs importants à la main (MIDI de `refs/`) si besoin.
- Les pistes du jeu bouclent : ACE-Step ne garantit pas un raccord parfait (l'installation ajoute seulement des fondus courts).
  Garder ≤ ~500 Ko (≈ 80 s en 48 kbps mono).
- `install` écrase `audio/music/<clé>.mp3` et met à jour `audio/manifest.json` (durée) ; `render.mjs` (synthèse procédurale) reste le repli.
