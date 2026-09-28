// Sonnerie d'alarme générée via Web Audio (pas de fichier audio à charger,
// fonctionne hors-ligne dans la PWA comme dans le wrapper Android).

let audioCtx = null;
let loopId = null;

function beep(ctx, freq, duration, when) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(0.35, when + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(when);
  osc.stop(when + duration + 0.02);
}

function playPattern() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  beep(audioCtx, 880, 0.18, now);
  beep(audioCtx, 880, 0.18, now + 0.28);
  beep(audioCtx, 660, 0.32, now + 0.56);
}

export function startAlarmSound() {
  if (loopId) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  audioCtx = audioCtx || new Ctx();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  playPattern();
  loopId = setInterval(playPattern, 1000);
  if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400, 200, 400]);
}

export function stopAlarmSound() {
  if (loopId) {
    clearInterval(loopId);
    loopId = null;
  }
  if (navigator.vibrate) navigator.vibrate(0);
}

export function isAlarmSoundPlaying() {
  return loopId != null;
}
