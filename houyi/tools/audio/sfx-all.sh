#!/usr/bin/env bash
# sfx-all.sh — ÉCHANTILLON COMPLET : génère les 130 bruitages (122 sorts dont 12 ultimes + 8 coups d'arc) et les INSTALLE dans le jeu.
# Écrase audio/sfx/spell-*.mp3 et audio/sfx/weaponHit-<rareté>-p|e.mp3 et met à jour audio/manifest.json ; régénère ensuite precache-manifest.json.
# Valider d'abord le modèle avec sfx-sample.sh ; `git checkout -- audio/` annule en cas de regret (tout est versionné).
#
#   tools/audio/sfx-all.sh [modèle] [options]
#   tools/audio/sfx-all.sh audioldm2-large --yes
#   tools/audio/sfx-all.sh cmd --cmd "mon_outil --prompt {prompt} --seconds {secs} --out {out}" --yes
#   tools/audio/sfx-all.sh audioldm2 --only=spell-ice,spell-bolt --yes      (quelques clips seulement)
# Options : --yes (sans confirmation) ; le reste est transmis à sfx_generate.py (--caption=long --candidates=N --steps=N --seed=N --caption-file=f.json …).
# Durée : environ 15 minutes avec AudioLDM2 sur une carte de 8 Go. À lancer dans WSL (le script libère le GPU lui-même).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE/../.."
source "$HERE/sfx-env.sh"
MODEL="${1:-audioldm2}"
[ $# -gt 0 ] && shift
YES=0; REST=()
for a in "$@"; do if [ "$a" = "--yes" ]; then YES=1; else REST+=("$a"); fi; done
if [ "$YES" != 1 ]; then
  read -r -p "Remplacer les clips de sorts et de coups d'arc de audio/sfx par ceux du modèle « $MODEL » ? [o/N] " ok
  [[ "$ok" =~ ^[oOyY]$ ]] || { echo "annulé"; exit 1; }
fi
"$PY" tools/audio/sfx_generate.py --install --model="$MODEL" "${REST[@]}"
if command -v node >/dev/null; then
  node tools/precache-manifest.mjs
else
  echo "node introuvable : lancer ensuite  node match3-quest/tools/precache-manifest.mjs  (depuis la racine du dépôt)"
fi
echo "Terminé. Vérifier : npx jest match3-quest/tests/unit/music match3-quest/tests/unit/precache ; page d'écoute : voir sfx-sample.sh."
