#!/usr/bin/env bash
# run-ultimates.sh — génère les cinématiques des 8 ultimes (étape vidéo) de façon robuste, dans WSL :
# relance ComfyUI et reprend (segments déjà faits sautés) si une tentative échoue (ex. OOM). Journal : game-maker/logs/ultimates.log
# Usage : tools/run-ultimates.sh [stage=video] [--only=ultimateX,...]      (détaché : setsid nohup tools/run-ultimates.sh &)
cd "$(dirname "$0")/.." || exit 1
GM="${GAME_MAKER_DIR:-/mnt/c/Users/Niafrond/dev/game-maker}"
STAGE="${1:-video}"; shift || true
for attempt in $(seq 1 30); do
  echo "=== tentative $attempt ($(date '+%F %T')) ==="
  "$GM/gm" down audio >/dev/null 2>&1; "$GM/gm" free >/dev/null 2>&1
  "$GM/gm" up pixel || { sleep 30; continue; }
  if python3 tools/gen-all-ultimate-sequences.py --stage="$STAGE" "$@"; then
    # terminé seulement si plus aucun ultime n'est en échec
    if ! python3 tools/gen-all-ultimate-sequences.py --stage="$STAGE" "$@" 2>&1 | grep -q "échec(s) \["; then echo "=== TERMINÉ ($(date '+%F %T')) ==="; exit 0; fi
  fi
  "$GM/gm" restart pixel; sleep 20
done
echo "=== ABANDON après 30 tentatives ==="; exit 1
