#!/usr/bin/env bash
# sfx-env.sh — environnement commun de sfx-sample.sh et sfx-all.sh (à « sourcer », pas à lancer). À utiliser dans WSL.
#   - PY : l'interpréteur Python qui a torch + diffusers (venv d'ACE-Step de game-maker) ; SFX_PYTHON=/chemin/python pour en imposer un autre
#     (par exemple le venv d'un modèle que vous avez installé vous-même, avec --model=cmd ou --model=hf:<dépôt>) ;
#   - PYTHONPATH : transformers 4.45.2 + diffusers 0.31.0 installés À PART (~/.cache/game-maker/sfx-tf), car AudioLDM2 plante avec
#     transformers ≥ 4.50 ; installés une fois, depuis PyPI, sans toucher au venv d'ACE-Step ;
#   - GPU : libéré (ComfyUI, ACE-Step, vision arrêtés : un seul gros modèle à la fois sur 8 Go).
set -euo pipefail
GM_DIR="${GAME_MAKER_DIR:-/mnt/c/Users/Niafrond/dev/game-maker}"
VENV_PY="${SFX_PYTHON:-$HOME/.cache/game-maker/venvs/acestep/bin/python}"
SIDE="${SFX_SIDE_DIR:-$HOME/.cache/game-maker/sfx-tf}"

[ -x "$VENV_PY" ] || { echo "sfx : Python introuvable ($VENV_PY). Définir SFX_PYTHON, ou installer game-maker (README : gm setup)." >&2; exit 1; }
command -v ffmpeg >/dev/null || { echo "sfx : ffmpeg introuvable dans le PATH." >&2; exit 1; }

if [ -z "${SFX_PYTHON:-}" ] && [ ! -d "$SIDE/transformers" ]; then
  echo "sfx : installation (une fois) de transformers 4.45.2 et diffusers 0.31.0 dans $SIDE …"
  UV="$(command -v uv || echo "$HOME/.local/bin/uv")"
  "$UV" pip install --python "$VENV_PY" --target "$SIDE" --no-deps 'transformers==4.45.2' 'tokenizers==0.20.3' 'diffusers==0.31.0'
fi
[ -d "$SIDE/transformers" ] && export PYTHONPATH="$SIDE${PYTHONPATH:+:$PYTHONPATH}"

if [ -x "$GM_DIR/gm" ]; then
  for svc in pixel audio vision; do "$GM_DIR/gm" down "$svc" >/dev/null 2>&1 || true; done
fi
export PY="$VENV_PY"
