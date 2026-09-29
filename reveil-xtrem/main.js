import {
  loadAlarms, saveAlarms, createAlarm, upsertAlarm, removeAlarm, patchAlarm,
  loadRuntime, saveRuntime, clampProblemsCount, MIN_PROBLEMS_COUNT, MAX_PROBLEMS_COUNT,
} from './alarms.js';
import {
  evaluateAlarms, applySnooze, clearSnooze, runtimeToObject, runtimeFromObject,
  nextOccurrence, getNextAlarmOccurrence,
} from './scheduler.js';
import {
  generateProblem, suggestedProblemsCount, DIFFICULTY_LABELS, DIFFICULTY_ORDER,
} from './math-challenge.js';
import { startAlarmSound, stopAlarmSound, previewSound, DEFAULT_SOUND_ID } from './sound.js';
import { formatAlarmSchedule, formatClock, formatCountdown } from './ui.js';
import {
  installPwa, initServiceWorker, initApkDownloadLink,
  requestRingFullscreen, exitRingFullscreen, notifyRingIfHidden,
} from './pwa.js';
import {
  isNativePlatform, syncNativeAlarms, nativeSnooze, nativeDismiss,
  consumeNativePendingUpdates, getNativePendingRingId, onNativeRing,
  listPermissionKeys, permissionInfo, checkPermission, requestPermission,
} from './native-bridge.js';

// ── État ────────────────────────────────────────────────────────────────
let alarms = loadAlarms();
let runtimeMap = runtimeFromObject(loadRuntime());
let editingId = null;
const ringQueue = [];
let currentRing = null; // { alarmId, solved, required, problem }

// ── Réfs DOM ────────────────────────────────────────────────────────────
const el = id => document.getElementById(id);
const screens = {
  home: el('screen-home'),
  edit: el('screen-edit'),
  ring: el('screen-ring'),
};
const clockNow = el('clock-now');
const alarmList = el('alarm-list');
const alarmEmptyState = el('alarm-empty-state');
const nextAlarmHero = el('next-alarm-hero');
const nextAlarmCountdown = el('next-alarm-countdown');
const nextAlarmDetail = el('next-alarm-detail');

function showScreen(name) {
  for (const s of Object.values(screens)) s.hidden = true;
  screens[name].hidden = false;
}

function persistAlarms() {
  saveAlarms(alarms);
  syncNativeAlarms(alarms); // no-op hors wrapper Capacitor
}
function persistRuntime() { saveRuntime(runtimeToObject(runtimeMap)); }

// ── Toast ───────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(message) {
  const toast = el('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
}

// ── Rendu liste ─────────────────────────────────────────────────────────
function renderAlarmList(now = new Date()) {
  alarmList.innerHTML = '';
  const sorted = [...alarms].sort((a, b) => a.time.localeCompare(b.time));
  alarmEmptyState.hidden = sorted.length > 0;

  for (const alarm of sorted) {
    const rt = runtimeMap.get(alarm.id);
    const nextAt = alarm.enabled ? nextOccurrence(alarm, now) : null;
    const card = document.createElement('div');
    card.className = 'alarm-card' + (alarm.enabled ? '' : ' disabled') + (rt && rt.snoozeUntil ? ' snoozing' : '');
    card.dataset.id = alarm.id;

    card.innerHTML = `
      <div class="alarm-card-top">
        <span class="alarm-status-icon">${alarm.enabled ? '⏰' : '🔕'}</span>
        <div class="alarm-time">${alarm.time}</div>
        <div class="alarm-meta">
          <div class="alarm-label"></div>
          <div class="alarm-days">${formatAlarmSchedule(alarm, nextAt, now)}${rt && rt.snoozeUntil ? ' · 💤 reporté' : ''}</div>
        </div>
        <label class="switch">
          <input type="checkbox" class="alarm-toggle" ${alarm.enabled ? 'checked' : ''}>
          <span class="switch-track"></span>
        </label>
      </div>
      <div class="alarm-card-bottom">
        <span class="badge difficulty-${alarm.difficulty}">${DIFFICULTY_LABELS[alarm.difficulty]}</span>
        <span class="badge count-badge">×${alarm.problemsCount}</span>
        <span class="alarm-card-spacer"></span>
        <button type="button" class="icon-btn btn-skip-next ${alarm.skipNext ? 'active' : ''}">⏭ Passer</button>
      </div>
    `;
    card.querySelector('.alarm-label').textContent = alarm.label;

    card.querySelector('.alarm-toggle').addEventListener('click', e => e.stopPropagation());
    card.querySelector('.alarm-toggle').addEventListener('change', e => {
      e.stopPropagation();
      toggleEnabled(alarm.id, e.target.checked);
    });
    card.querySelector('.btn-skip-next').addEventListener('click', e => {
      e.stopPropagation();
      toggleSkipNext(alarm.id);
    });
    card.addEventListener('click', () => openEdit(alarm.id));

    alarmList.appendChild(card);
  }
}

function updateNextAlarmHero(now = new Date()) {
  const next = getNextAlarmOccurrence(alarms, now, runtimeMap);
  if (!next) {
    nextAlarmHero.hidden = true;
    return;
  }
  nextAlarmCountdown.textContent = `Sonne dans ${formatCountdown(next.at.getTime() - now.getTime())}`;
  const hh = String(next.at.getHours()).padStart(2, '0');
  const mm = String(next.at.getMinutes()).padStart(2, '0');
  nextAlarmDetail.textContent = `${next.alarm.label} · ${hh}:${mm}`;
  nextAlarmHero.hidden = false;
}

function refreshHome(now = new Date()) {
  renderAlarmList(now);
  updateNextAlarmHero(now);
}

function toggleEnabled(id, enabled) {
  alarms = patchAlarm(alarms, id, { enabled });
  persistAlarms();
  showToast(enabled ? 'Alarme activée' : 'Alarme désactivée');
  refreshHome();
}

function toggleSkipNext(id) {
  const alarm = alarms.find(a => a.id === id);
  if (!alarm) return;
  alarms = patchAlarm(alarms, id, { skipNext: !alarm.skipNext });
  persistAlarms();
  showToast(!alarm.skipNext ? 'La prochaine sonnerie sera sautée' : 'Sonnerie rétablie');
  refreshHome();
}

// ── Écran édition ───────────────────────────────────────────────────────
function openEdit(id) {
  editingId = id;
  const alarm = id ? alarms.find(a => a.id === id) : null;

  el('edit-title').textContent = alarm ? "Modifier l'alarme" : 'Nouvelle alarme';
  el('input-time').value = alarm ? alarm.time : '07:00';
  el('input-label').value = alarm ? alarm.label : '';
  el('input-snooze').value = alarm ? alarm.snoozeMinutes : 9;
  el('btn-delete-alarm').hidden = !alarm;

  const days = alarm ? alarm.days : [];
  document.querySelectorAll('#days-picker .day-chip').forEach(chip => {
    chip.classList.toggle('active', days.includes(Number(chip.dataset.day)));
  });

  const difficulty = alarm ? alarm.difficulty : 'veryEasy';
  setDifficultySlider(difficulty, { suggestCount: !alarm });
  setProblemsCount(alarm ? alarm.problemsCount : suggestedProblemsCount(difficulty));
  setSelectedSound(alarm ? alarm.sound : DEFAULT_SOUND_ID);

  showScreen('edit');
}

// ── Difficulté (slider à 5 crans, façon Alarm Clock Xtreme) ──────────────
const difficultySlider = el('difficulty-slider');
const difficultyCurrentLabel = el('difficulty-current-label');
const difficultyExampleValue = el('difficulty-example-value');

function setDifficultySlider(difficulty, { suggestCount = false } = {}) {
  const index = Math.max(0, DIFFICULTY_ORDER.indexOf(difficulty));
  difficultySlider.value = String(index);
  difficultyCurrentLabel.textContent = DIFFICULTY_LABELS[DIFFICULTY_ORDER[index]];
  regenerateDifficultyExample();

  // Pour une NOUVELLE alarme, suggère un nombre de calculs adapté à la
  // difficulté choisie — mais ne touche jamais au réglage d'une alarme
  // existante déjà personnalisée par l'utilisateur.
  if (suggestCount) setProblemsCount(suggestedProblemsCount(DIFFICULTY_ORDER[index]));
}

function regenerateDifficultyExample() {
  const { text } = generateProblem(getSelectedDifficulty());
  difficultyExampleValue.textContent = text;
}

function getSelectedDifficulty() {
  return DIFFICULTY_ORDER[Number(difficultySlider.value)] || 'veryEasy';
}

difficultySlider.addEventListener('input', () => {
  difficultyCurrentLabel.textContent = DIFFICULTY_LABELS[getSelectedDifficulty()];
  regenerateDifficultyExample();
});
difficultySlider.addEventListener('change', () => {
  // Alarme existante : ne pas re-suggérer. Nouvelle alarme : suggère le
  // nombre de calculs adapté, une fois le glissement terminé.
  if (editingId === null) setProblemsCount(suggestedProblemsCount(getSelectedDifficulty()));
});

function getSelectedDays() {
  return [...document.querySelectorAll('#days-picker .day-chip.active')].map(c => Number(c.dataset.day));
}

// ── Nombre de calculs (stepper, indépendant de la difficulté) ────────────
const countValueEl = el('count-value');
const countHintEl = el('count-hint');

function setProblemsCount(value) {
  const clamped = clampProblemsCount(value);
  countValueEl.textContent = String(clamped);
  el('btn-count-minus').disabled = clamped <= MIN_PROBLEMS_COUNT;
  el('btn-count-plus').disabled = clamped >= MAX_PROBLEMS_COUNT;
  countHintEl.textContent = clamped > 1
    ? `${clamped} calculs à résoudre d'affilée — une erreur remet le compteur à zéro.`
    : '1 seul calcul à résoudre.';
}

function getSelectedProblemsCount() {
  return clampProblemsCount(countValueEl.textContent);
}

el('btn-count-minus').addEventListener('click', () => setProblemsCount(getSelectedProblemsCount() - 1));
el('btn-count-plus').addEventListener('click', () => setProblemsCount(getSelectedProblemsCount() + 1));

// ── Sonnerie (propre à chaque alarme) ─────────────────────────────────────
function setSelectedSound(soundId) {
  document.querySelectorAll('#sound-picker .sound-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.sound === soundId);
  });
}

function getSelectedSound() {
  const active = document.querySelector('#sound-picker .sound-chip.active');
  return active ? active.dataset.sound : DEFAULT_SOUND_ID;
}

document.querySelectorAll('#sound-picker .sound-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    setSelectedSound(chip.dataset.sound);
    previewSound(chip.dataset.sound);
  });
});

function saveAlarmFromForm() {
  const time = el('input-time').value || '07:00';
  const label = el('input-label').value;
  const days = getSelectedDays();
  const difficulty = getSelectedDifficulty();
  const problemsCount = getSelectedProblemsCount();
  const sound = getSelectedSound();
  const snoozeMinutes = Number(el('input-snooze').value) || 9;

  if (editingId) {
    alarms = patchAlarm(alarms, editingId, {
      time, label: label.trim() || 'Alarme', days, difficulty, problemsCount, sound, snoozeMinutes,
    });
  } else {
    const alarm = createAlarm({ time, label, days, difficulty, problemsCount, sound, snoozeMinutes });
    alarms = upsertAlarm(alarms, alarm);
  }
  persistAlarms();
  showToast('Alarme enregistrée');
  showScreen('home');
  refreshHome();
}

function deleteCurrentAlarm() {
  if (!editingId) return;
  alarms = removeAlarm(alarms, editingId);
  runtimeMap.delete(editingId);
  persistAlarms();
  persistRuntime();
  showToast('Alarme supprimée');
  showScreen('home');
  refreshHome();
}

// ── Boucle de vérification ──────────────────────────────────────────────
function tick() {
  const now = new Date();
  clockNow.textContent = formatClock(now);
  if (screens.home.hidden === false) updateNextAlarmHero(now);

  // Sous le wrapper Android, AlarmManager (programmé via AlarmScheduler natif)
  // déclenche réellement les alarmes — y compris appli fermée. La détection
  // JS ci-dessous ne servirait qu'à sonner une deuxième fois en double.
  if (isNativePlatform()) return;

  const { ringing, skipConsumed, nextRuntime } = evaluateAlarms(alarms, now, runtimeMap);
  runtimeMap = nextRuntime;

  if (skipConsumed.length > 0) {
    for (const id of skipConsumed) {
      const alarm = alarms.find(a => a.id === id);
      if (!alarm) continue;
      const isOneTime = !alarm.days || alarm.days.length === 0;
      alarms = patchAlarm(alarms, id, { skipNext: false, ...(isOneTime ? { enabled: false } : {}) });
    }
    persistAlarms();
    renderAlarmList(now);
  }

  if (ringing.length > 0) {
    for (const id of ringing) if (!ringQueue.includes(id)) ringQueue.push(id);
    persistRuntime();
    renderAlarmList(now);
  }

  if (!currentRing && ringQueue.length > 0) {
    startRing(ringQueue.shift());
  }
}

// ── Écran sonnerie ──────────────────────────────────────────────────────

/** Point d'entrée pour une sonnerie déclenchée côté natif (event/cold start). */
function triggerNativeRing(alarmId) {
  if (currentRing) {
    if (!ringQueue.includes(alarmId)) ringQueue.push(alarmId);
    return;
  }
  startRing(alarmId);
}

function startRing(alarmId) {
  const alarm = alarms.find(a => a.id === alarmId);
  if (!alarm) return;

  currentRing = { alarmId, solved: 0, required: clampProblemsCount(alarm.problemsCount ?? 1), problem: null };
  el('ring-label').textContent = alarm.label;
  nextChallengeProblem();
  startAlarmSound(alarm.sound);
  showScreen('ring');

  // Une alarme doit être impossible à rater : plein écran + tentative de
  // reprendre le focus si l'onglet tournait en arrière-plan.
  requestRingFullscreen();
  notifyRingIfHidden(`⏰ ${alarm.label}`, "Résolvez le calcul pour désactiver l'alarme.");
  window.focus();
}

function nextChallengeProblem({ resetError = true } = {}) {
  const alarm = alarms.find(a => a.id === currentRing.alarmId);
  currentRing.problem = generateProblem(alarm.difficulty);
  el('challenge-problem').textContent = currentRing.problem.text;
  el('challenge-answer').value = '';
  if (resetError) el('challenge-error').hidden = true;

  const progressEl = el('challenge-progress');
  if (currentRing.required > 1) {
    progressEl.hidden = false;
    progressEl.textContent = `Question ${currentRing.solved + 1} / ${currentRing.required}`;
  } else {
    progressEl.hidden = true;
  }
}

function updateRingClock() {
  if (currentRing) el('ring-time').textContent = formatClock(new Date());
}

function validateChallengeAnswer() {
  if (!currentRing) return;
  const value = Number(el('challenge-answer').value);
  if (Number.isNaN(value) || value !== currentRing.problem.answer) {
    currentRing.solved = 0;
    el('challenge-error').hidden = false;
    const input = el('challenge-answer');
    input.classList.remove('shake');
    void input.offsetWidth;
    input.classList.add('shake');
    nextChallengeProblem({ resetError: false });
    return;
  }

  currentRing.solved += 1;
  if (currentRing.solved >= currentRing.required) {
    dismissCurrentRing();
  } else {
    nextChallengeProblem();
  }
}

function dismissCurrentRing() {
  if (!currentRing) return;
  const { alarmId } = currentRing;
  const alarm = alarms.find(a => a.id === alarmId);
  stopAlarmSound();
  nativeDismiss(alarmId); // no-op hors wrapper Capacitor
  runtimeMap = clearSnooze(runtimeMap, alarmId);

  if (alarm && (!alarm.days || alarm.days.length === 0)) {
    alarms = patchAlarm(alarms, alarmId, { enabled: false });
    persistAlarms();
  }
  persistRuntime();

  currentRing = null;
  showScreen('home');
  refreshHome();

  if (ringQueue.length > 0) {
    startRing(ringQueue.shift());
  } else {
    exitRingFullscreen();
  }
}

function snoozeCurrentRing() {
  if (!currentRing) return;
  const { alarmId } = currentRing;
  const alarm = alarms.find(a => a.id === alarmId);
  const minutes = alarm ? alarm.snoozeMinutes : 9;
  stopAlarmSound();
  nativeSnooze(alarmId, minutes); // no-op hors wrapper Capacitor
  runtimeMap = applySnooze(runtimeMap, alarmId, new Date(), minutes);
  persistRuntime();

  currentRing = null;
  showScreen('home');
  refreshHome();
  showToast(`Reporté de ${minutes} min`);

  if (ringQueue.length > 0) {
    startRing(ringQueue.shift());
  } else {
    exitRingFullscreen();
  }
}

// ── Bannière des autorisations système (uniquement sous Capacitor) ───────
const permissionsBanner = el('permissions-banner');
const permissionsList = el('permissions-list');

async function refreshPermissionsBanner() {
  if (!isNativePlatform()) {
    permissionsBanner.hidden = true;
    return;
  }

  const missing = [];
  for (const key of listPermissionKeys()) {
    if (!(await checkPermission(key))) missing.push(key);
  }

  if (missing.length === 0) {
    permissionsBanner.hidden = true;
    return;
  }

  permissionsList.innerHTML = '';
  for (const key of missing) {
    const info = permissionInfo(key);
    const row = document.createElement('div');
    row.className = 'permission-row';
    row.innerHTML = `
      <div class="permission-row-text">
        <div class="permission-row-label">${info.label}</div>
        <div class="permission-row-reason">${info.reason}</div>
      </div>
      <button type="button" class="btn btn-primary btn-sm">Autoriser</button>
    `;
    row.querySelector('button').addEventListener('click', async () => {
      await requestPermission(key);
      // Ces réglages ouvrent un écran système ; on réévalue au retour sur l'appli
      // (voir le listener 'visibilitychange' plus bas) plutôt qu'ici.
    });
    permissionsList.appendChild(row);
  }
  permissionsBanner.hidden = false;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshPermissionsBanner();
});

// ── Démarrage natif (Capacitor uniquement — no-op sur la PWA web) ────────
async function initNative() {
  if (!isNativePlatform()) return;

  // Applique les changements décidés côté natif pendant que l'appli était fermée
  // (skipNext consommé, alarme ponctuelle désactivée après sonnerie).
  const updates = await consumeNativePendingUpdates();
  if (Object.keys(updates).length > 0) {
    for (const [id, patch] of Object.entries(updates)) {
      alarms = patchAlarm(alarms, id, patch);
    }
    saveAlarms(alarms);
    refreshHome();
  }

  syncNativeAlarms(alarms);
  onNativeRing(triggerNativeRing);

  const pendingId = await getNativePendingRingId();
  if (pendingId) triggerNativeRing(pendingId);

  await refreshPermissionsBanner();
}

// ── Écouteurs ───────────────────────────────────────────────────────────
el('btn-add-alarm').addEventListener('click', () => openEdit(null));
el('btn-edit-cancel').addEventListener('click', () => { showScreen('home'); refreshHome(); });
el('btn-save-alarm').addEventListener('click', saveAlarmFromForm);
el('btn-delete-alarm').addEventListener('click', deleteCurrentAlarm);
el('btn-install-pwa').addEventListener('click', installPwa);

document.querySelectorAll('#days-picker .day-chip').forEach(chip => {
  chip.addEventListener('click', () => chip.classList.toggle('active'));
});

el('btn-challenge-validate').addEventListener('click', validateChallengeAnswer);
el('challenge-answer').addEventListener('keydown', e => {
  if (e.key === 'Enter') validateChallengeAnswer();
});
// Valide automatiquement dès que la réponse tapée est la bonne, sans
// attendre un clic sur "Valider" — la réponse ne peut jamais matcher par
// erreur en cours de frappe puisqu'un seul calcul (donc une seule réponse)
// est affiché à la fois.
el('challenge-answer').addEventListener('input', () => {
  if (!currentRing) return;
  const value = Number(el('challenge-answer').value);
  if (!Number.isNaN(value) && value === currentRing.problem.answer) validateChallengeAnswer();
});
el('btn-snooze').addEventListener('click', snoozeCurrentRing);

// ── Démarrage ───────────────────────────────────────────────────────────
refreshHome();
showScreen('home');
setInterval(tick, 1000);
setInterval(updateRingClock, 1000);
tick();

if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
  Notification.requestPermission().catch(() => {});
}

initServiceWorker(() => currentRing != null);
initApkDownloadLink();
initNative();
