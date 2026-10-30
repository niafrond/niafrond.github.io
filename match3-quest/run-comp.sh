source ~/.nvm/nvm.sh >/dev/null; nvm use 22 >/dev/null
cd /mnt/c/Users/Niafrond/dev/niafrond.github.io/match3-quest
tools/gm up pixel 2>&1 | tail -3
IDS=companion_xiao_gui,companion_zhi,companion_dawa,companion_yu,companion_etincelle,companion_braise,companion_jian,companion_tou
node tools/gen-sprites-gm.mjs --force --only=$IDS 2>&1 | tail -40
node tools/gen-companion-walk.mjs 2>&1 | tail -15
node sprites/build-gba.mjs 2>&1 | tail -5
echo DONE
