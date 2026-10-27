#!/usr/bin/env bash
# sfx-sample.sh — ÉCHANTILLON RESTREINT de bruitages (14 sorts et coups représentatifs) pour comparer des modèles à l'oreille.
# N'écrit rien dans le jeu : les clips et une page d'écoute vont dans audio/sfx-sample/<modèle>/ (ouvrir index.html dans un navigateur).
#
#   tools/audio/sfx-sample.sh [modèle] [options]
#   tools/audio/sfx-sample.sh gm                    (commande `gm studio sfx generate` de game-maker : MMAudio ; --gm-project=NOM)
#   tools/audio/sfx-sample.sh audioldm2-large
#   tools/audio/sfx-sample.sh audioldm2 --caption=long --candidates=6
#   tools/audio/sfx-sample.sh cmd --cmd "mon_outil --prompt {prompt} --seconds {secs} --out {out}"
#   tools/audio/sfx-sample.sh stable-audio-open        (après `huggingface-cli login` et acceptation de la licence)
#   tools/audio/sfx-sample.sh hf:cvssp/audioldm-m-full --pipeline=audioldm
# Modèle par défaut : audioldm2. Toutes les options (--only=spell-ice,… --steps --seed --caption-file --list) : en-tête de sfx_generate.py.
# À lancer dans WSL (le script libère le GPU lui-même).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE/../.."
source "$HERE/sfx-env.sh"
MODEL="${1:-audioldm2}"
[ $# -gt 0 ] && shift
exec "$PY" tools/audio/sfx_generate.py --sample --model="$MODEL" "$@"
