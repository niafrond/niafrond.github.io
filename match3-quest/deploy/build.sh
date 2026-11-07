#!/usr/bin/env bash
# Assemble match3-quest/deploy/public : le jeu servi à la racine du domaine (houyi.fontaine.one/).
# Le code (js, css, json) n'est PAS publié ici : firebase.json le redirige vers GitHub Pages, où se font les mises à jour.
# Restent sur Firebase : les pages html, sw.js (un service worker doit être du même domaine) et manifest.json (start_url du même domaine).
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT=match3-quest/deploy/public
rm -rf "$OUT"; mkdir -p "$OUT"
rsync -a match3-quest/ "$OUT/" \
  --include='/sw.js' --include='/manifest.json' --exclude='*.js' --exclude='*.mjs' --exclude='*.css' --exclude='*.json' \
  --exclude='/deploy' --exclude='/tools' --exclude='/tests' --exclude='/docs' --exclude='/agents' --exclude='node_modules' \
  --exclude='/sprites/ultimates-seq' --exclude='/sprites/ultimates-comfy' --exclude='/sprites/ultimates-sdxl' \
  --exclude='/sprites/house/cand' --exclude='/sprites/png/back-cand' --exclude='/sprites/cinematics-change' \
  --exclude='/sprites/png' --exclude='/audio' --exclude='/soluce/img' --exclude='/sprites/**.png' --exclude='/sprites/**.gif' --exclude='*.md' --exclude='*.bat' --exclude='test-*'
find "$OUT/sprites" -type d -empty -delete
du -sh "$OUT"
