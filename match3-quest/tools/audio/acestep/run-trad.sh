#!/usr/bin/env bash
# Génère, approuve (v001) et installe toutes les variantes `-b` de la vague 3 (catalog.mjs), par lots, avec relance du serveur si un lot se fige.
# Usage (WSL) : bash run-trad.sh   — journal : /tmp/trad.log
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null
cd "$(dirname "$0")"
GM=../../gm
keys=$(node -e 'import("./catalog.mjs").then(m=>{const c=m.CATALOG||m.TRACKS;console.log(Object.keys(c).filter(k=>/-b$/.test(k)&&!/^(sfx|jingle)/.test(k)).join(" "))})')
todo=""
for k in $keys; do [ -f "../../../audio/music/$k.mp3" ] || todo="$todo $k"; done
echo "à produire : $(echo $todo | wc -w)"
$GM up audio | tail -1
set -- $todo
while [ $# -gt 0 ]; do
  batch=""; n=0
  while [ $# -gt 0 ] && [ $n -lt 6 ]; do batch="$batch $1"; shift; n=$((n+1)); done
  echo "lot :$batch"
  if ! timeout 900 node generate.mjs generate $batch --variants 1 > /tmp/trad-batch.log 2>&1; then
    echo "lot figé ou en échec, redémarrage du serveur"; $GM down audio | tail -1; sleep 3; $GM up audio | tail -1
    timeout 900 node generate.mjs generate $batch --variants 1 > /tmp/trad-batch.log 2>&1 || echo "lot abandonné :$batch"
  fi
  for k in $batch; do
    [ -f "out/$k/v001.mp3" ] && node generate.mjs approve $k v001 > /dev/null 2>&1
  done
  node generate.mjs install $batch 2>&1 | grep -E "^OK" | cut -c1-80
done
$GM down audio | tail -1
echo "TERMINÉ"
