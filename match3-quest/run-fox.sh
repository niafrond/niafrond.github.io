source ~/.nvm/nvm.sh >/dev/null; nvm use 22 >/dev/null
cd /mnt/c/Users/Niafrond/dev/niafrond.github.io/match3-quest
node tools/gen-sprites-gm.mjs --force --only=companion_xiao_gui --desc=from_behind,tail_visible 2>&1 | tail -5
node tools/gen-companion-walk.mjs --only=companion_xiao_gui 2>&1 | tail -3
node sprites/build-gba.mjs 2>&1 | tail -2
echo DONE
