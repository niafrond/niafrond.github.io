// ============================================================
// theme-party/main.js — Routeur d'écrans + câblage DOM + boucle de lecture.
// Pas de tests unitaires ici (câblage DOM pur), comme main.js/game.js dans
// blind-test/mix-blind-test.
//
// L'écran courant et la progression (pool de la partie, thème/piste en
// cours) sont persistés en continu (themes.js) pour qu'un rechargement
// accidentel de la page ne fasse pas perdre la partie : au chargement, on
// restaure directement l'écran où on s'était arrêté (voir restoreSession()).
// ============================================================

import { SCREEN, TIMER, THEME_TRACK_COUNT, THEME_CHOICE_COUNT } from './constants.js';
import {
  loadThemes, saveThemes, createTheme, addTrackToTheme, removeTrackFromTheme,
  updateTrackHints, updateTrackReponse, deleteTheme, loadSessionPlayedIds, saveSessionPlayedIds,
  markThemePlayed, resetSession, getEligibleThemesForSession, pickThemeChoices,
  getRemainingPoolThemes, loadSessionPool, saveSessionPool,
  loadSessionScreen, saveSessionScreen, loadCurrentThemeId, saveCurrentThemeId,
  loadCurrentTrackIndex, saveCurrentTrackIndex,
  exportThemeJSON, importThemeJSON, importThemePackJSON, mergeThemePack,
} from './themes.js';
import { initApiConfigUI, searchTracks, ensureDownloaded, getSongKey, prefetchAudio, LocalAudioPlayer } from './audioSource.js';
import { createHintRevealState, resetHintReveal, advanceHintReveal } from './roundTimer.js';
import * as ui from './ui.js';
import { getMatch3Version, getMatch3BuildDate } from '../match3-quest/version.js';

// ─── Références DOM ───────────────────────────────────────────────────────────

const refs = {
  btnLaunchGame: document.getElementById('btn-launch-game'),
  btnOpenSetup: document.getElementById('btn-open-setup'),

  apiUrlInput: document.getElementById('api-url-input'),
  apiTokenInput: document.getElementById('api-token-input'),
  apiCdnInput: document.getElementById('api-cdn-input'),
  btnApiSave: document.getElementById('btn-api-save'),
  btnApiTest: document.getElementById('btn-api-test'),
  apiStatus: document.getElementById('api-status'),

  themeCount: document.getElementById('theme-count'),
  themeList: document.getElementById('theme-list'),
  btnNewTheme: document.getElementById('btn-new-theme'),
  importThemeFile: document.getElementById('import-theme-file'),
  btnLoadSeedThemes: document.getElementById('btn-load-seed-themes'),
  themeListStatus: document.getElementById('theme-list-status'),

  themeEditor: document.getElementById('theme-editor'),
  themeNameInput: document.getElementById('theme-name-input'),
  themeConsigneInput: document.getElementById('theme-consigne-input'),
  trackSearchInput: document.getElementById('track-search-input'),
  btnTrackSearch: document.getElementById('btn-track-search'),
  trackSearchStatus: document.getElementById('track-search-status'),
  trackSearchResults: document.getElementById('track-search-results'),
  themeTrackCount: document.getElementById('theme-track-count'),
  themeTracks: document.getElementById('theme-tracks'),
  btnExportTheme: document.getElementById('btn-export-theme'),
  btnCloseEditor: document.getElementById('btn-close-editor'),

  btnBackHomeFromSetup: document.getElementById('btn-back-home-from-setup'),

  themeCards: document.getElementById('theme-cards'),
  pickerEmptyMsg: document.getElementById('picker-empty-msg'),
  btnAbandonGame: document.getElementById('btn-abandon-game'),

  roundThemeName: document.getElementById('round-theme-name'),
  roundThemeConsigne: document.getElementById('round-theme-consigne'),
  discCarousel: document.getElementById('disc-carousel'),
  hint1Text: document.getElementById('hint1-text'),
  hint2Text: document.getElementById('hint2-text'),
  btnReveal: document.getElementById('btn-reveal'),
  revealAnswerText: document.getElementById('reveal-answer-text'),
  roundErrorText: document.getElementById('round-error-text'),
  progressRingFg: document.getElementById('progress-ring-fg'),
  btnPlayPause: document.getElementById('btn-play-pause'),
  btnPrev: document.getElementById('btn-prev'),
  btnNext: document.getElementById('btn-next'),
  btnExtendPlay: document.getElementById('btn-extend-play'),

  setEndThemeName: document.getElementById('set-end-theme-name'),
  btnContinue: document.getElementById('btn-continue'),

  btnBackHomeFromGameOver: document.getElementById('btn-back-home-from-game-over'),

  versionBadge: document.getElementById('theme-party-version'),
};

// ─── État ─────────────────────────────────────────────────────────────────────

let themes = loadThemes();
let editingThemeId = null;

let sessionPool = loadSessionPool();           // ids tirés au lancement de la partie en cours
let sessionPlayedIds = loadSessionPlayedIds();  // ids déjà joués dans ce pool

let currentTheme = null;
let currentTrackIndex = 0;
let hintState = createHintRevealState();
let revealed = false;
let revealTimeoutHandle = null;
let roundActive = false;
let rafHandle = null;
let extendedPlayMax = TIMER.PLAY_MAX; // repoussé de EXTEND_STEP à chaque "+15s" (intro trop longue)

const player = new LocalAudioPlayer();
player.init();
player.addEventListener('play', () => ui.renderPlayPause(refs.btnPlayPause, true));
player.addEventListener('pause', () => ui.renderPlayPause(refs.btnPlayPause, false));
player.addEventListener('ended', () => ui.renderPlayPause(refs.btnPlayPause, false));
player.addEventListener('error', (e) => {
  ui.renderRoundError(refs.roundErrorText, `Serveur indisponible — vérifiez la configuration (${e.detail?.reason || 'erreur'})`);
});

// ─── Préchargement anticipé ───────────────────────────────────────────────────
//
// Dès que le picker propose ses thèmes, on lance en tâche de fond le
// téléchargement + la mise en cache navigateur de toutes leurs pistes,
// pendant que le DJ hésite : au moment de lancer le Set, la 1ère piste
// (et souvent bien plus) est déjà prête, sans latence. Une file simple,
// un morceau à la fois, pour ne pas saturer le serveur downloader local.

let prefetchQueue = [];
let prefetchRunning = false;

function enqueuePrefetch(tracks) {
  for (const track of tracks) {
    if (!track.cachePath && !prefetchQueue.includes(track)) prefetchQueue.push(track);
  }
  runPrefetchQueue();
}

/**
 * Fait passer les pistes du thème choisi en tête de la file de préchargement.
 * Appelé au lancement d'un Set (startSet) : sans ça, ces pistes restaient
 * coincées derrière celles des autres thèmes du pool (encore non choisis)
 * dans la file "un morceau à la fois", si bien que la lecture directe
 * (loadCurrentTrack) devait parfois retélécharger elle-même une piste
 * du Set en cours faute d'avoir été préchargée à temps — c'est-à-dire
 * rappeler l'API pendant que la partie est en cours. La piste en cours de
 * téléchargement (déjà retirée de la file par runPrefetchQueue) n'est pas
 * interrompue, mais les 6 suivantes passent devant le reste du pool.
 */
function prioritizePrefetch(tracks) {
  const toPrioritize = tracks.filter((track) => !track.cachePath);
  if (toPrioritize.length === 0) return;
  prefetchQueue = [...toPrioritize, ...prefetchQueue.filter((track) => !toPrioritize.includes(track))];
  runPrefetchQueue();
}

async function runPrefetchQueue() {
  if (prefetchRunning) return;
  prefetchRunning = true;
  while (prefetchQueue.length > 0) {
    const track = prefetchQueue.shift();
    if (track.cachePath) continue; // déjà résolu entre-temps (ex: lecture manuelle)
    try {
      await ensureDownloaded(track);
      saveThemes(themes);
      await prefetchAudio(getSongKey(track));
    } catch (_) {
      // best-effort : la piste sera re-tentée normalement au moment de la lecture
    }
  }
  prefetchRunning = false;
}

// ─── Accueil ──────────────────────────────────────────────────────────────────

function hasActiveGame() {
  if (sessionPool.length === 0) return false;
  return getRemainingPoolThemes(themes, sessionPool, sessionPlayedIds).length > 0;
}

function goToHome() {
  ui.renderLaunchButton(refs.btnLaunchGame, hasActiveGame());
  saveSessionScreen(SCREEN.HOME);
  ui.showScreen(SCREEN.HOME);
}

function startNewGame() {
  resetSession();
  sessionPool = [];
  sessionPlayedIds = [];

  const eligible = getEligibleThemesForSession(themes, []);
  const chosen = pickThemeChoices(eligible, THEME_CHOICE_COUNT);
  sessionPool = chosen.map((t) => t.id);
  saveSessionPool(sessionPool);

  goToPicker();
}

refs.btnLaunchGame.addEventListener('click', () => {
  if (hasActiveGame()) goToPicker();
  else startNewGame();
});

refs.btnOpenSetup.addEventListener('click', () => {
  refreshThemeList();
  saveSessionScreen(SCREEN.SETUP);
  ui.showScreen(SCREEN.SETUP);
});

refs.btnBackHomeFromSetup.addEventListener('click', goToHome);
refs.btnBackHomeFromGameOver.addEventListener('click', goToHome);

// ─── Atelier : config API ────────────────────────────────────────────────────

initApiConfigUI({
  inputEl: refs.apiUrlInput,
  tokenInputEl: refs.apiTokenInput,
  cdnInputEl: refs.apiCdnInput,
  saveBtn: refs.btnApiSave,
  testBtn: refs.btnApiTest,
  statusEl: refs.apiStatus,
});

// ─── Atelier : bibliothèque de thèmes ────────────────────────────────────────

function refreshThemeList() {
  refs.themeCount.textContent = `(${themes.length})`;
  ui.renderThemeList(refs.themeList, themes, {
    onEdit: openEditor,
    onDelete: handleDeleteTheme,
    onExport: handleExportTheme,
  });
}

function handleDeleteTheme(themeId) {
  themes = deleteTheme(themes, themeId);
  saveThemes(themes);
  refreshThemeList();
}

function handleExportTheme(themeId) {
  const theme = themes.find((t) => t.id === themeId);
  if (!theme) return;
  const json = exportThemeJSON(theme);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `theme-${theme.name.toLowerCase().replace(/\s+/g, '-') || 'sans-nom'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

refs.btnNewTheme.addEventListener('click', () => {
  const theme = createTheme('Nouveau thème');
  themes.push(theme);
  saveThemes(themes);
  refreshThemeList();
  openEditor(theme.id);
});

refs.importThemeFile.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const theme = importThemeJSON(text);
    themes.push(theme);
    saveThemes(themes);
    refreshThemeList();
    refs.themeListStatus.textContent = `Thème "${theme.name}" importé.`;
  } catch (err) {
    refs.themeListStatus.textContent = err.message || 'Import impossible.';
  } finally {
    e.target.value = '';
  }
});

/**
 * Charge le pack de thèmes fourni (theme-party/themes.json) et le fusionne
 * dans la bibliothèque (dédupliqué par nom, voir mergeThemePack). Utilisé à
 * la fois par le bouton manuel et par le chargement automatique au démarrage
 * (voir ensureSeedThemesLoaded) — c'est le pack "par défaut" de l'app.
 */
async function loadSeedThemes() {
  const response = await fetch('./themes.json');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  const pack = importThemePackJSON(text);
  const { merged, addedCount, skippedCount } = mergeThemePack(themes, pack);
  themes = merged;
  saveThemes(themes);
  return { addedCount, skippedCount };
}

refs.btnLoadSeedThemes.addEventListener('click', async () => {
  refs.themeListStatus.textContent = 'Chargement…';
  try {
    const { addedCount, skippedCount } = await loadSeedThemes();
    refreshThemeList();
    refs.themeListStatus.textContent = skippedCount > 0
      ? `${addedCount} thème(s) ajouté(s), ${skippedCount} déjà présent(s) ignoré(s).`
      : `${addedCount} thème(s) ajouté(s).`;
  } catch (err) {
    refs.themeListStatus.textContent = `Chargement impossible : ${err.message}`;
  }
});

// ─── Atelier : éditeur d'un thème ────────────────────────────────────────────

function openEditor(themeId) {
  editingThemeId = themeId;
  const theme = themes.find((t) => t.id === themeId);
  if (!theme) return;
  refs.themeEditor.classList.remove('hidden');
  refs.themeNameInput.value = theme.name;
  refs.themeConsigneInput.value = theme.consigne || '';
  refs.trackSearchResults.innerHTML = '';
  refs.trackSearchStatus.textContent = '';
  renderEditorTracks();
}

function getEditingTheme() {
  return themes.find((t) => t.id === editingThemeId) || null;
}

function renderEditorTracks() {
  const theme = getEditingTheme();
  if (!theme) return;
  refs.themeTrackCount.textContent = String(theme.tracks.length);
  ui.renderThemeTracks(refs.themeTracks, theme, {
    onRemove: (trackId) => {
      removeTrackFromTheme(theme, trackId);
      saveThemes(themes);
      renderEditorTracks();
    },
    onHintChange: (trackId, patch) => {
      updateTrackHints(theme, trackId, patch);
      saveThemes(themes);
    },
    onReponseChange: (trackId, reponse) => {
      updateTrackReponse(theme, trackId, reponse);
      saveThemes(themes);
    },
  });
}

refs.themeNameInput.addEventListener('input', (e) => {
  const theme = getEditingTheme();
  if (!theme) return;
  theme.name = e.target.value;
  saveThemes(themes);
});

refs.themeConsigneInput.addEventListener('input', (e) => {
  const theme = getEditingTheme();
  if (!theme) return;
  theme.consigne = e.target.value;
  saveThemes(themes);
});

refs.btnTrackSearch.addEventListener('click', async () => {
  const term = refs.trackSearchInput.value.trim();
  if (!term) return;
  refs.trackSearchStatus.textContent = 'Recherche…';
  const results = await searchTracks(term, { limit: 10 });
  refs.trackSearchStatus.textContent = results.length ? '' : 'Aucun résultat (vérifiez la config API).';
  ui.renderSearchResults(refs.trackSearchResults, results, (track) => {
    const theme = getEditingTheme();
    if (!theme) return;
    try {
      addTrackToTheme(theme, { title: track.title, artist: track.artist });
      saveThemes(themes);
      renderEditorTracks();
      refreshThemeList();
    } catch (err) {
      refs.trackSearchStatus.textContent = err.message;
    }
  });
});

refs.btnExportTheme.addEventListener('click', () => {
  if (editingThemeId) handleExportTheme(editingThemeId);
});

refs.btnCloseEditor.addEventListener('click', () => {
  editingThemeId = null;
  refs.themeEditor.classList.add('hidden');
  refreshThemeList();
});

// ─── Picker : thèmes restants du pool de la partie en cours ──────────────────

function goToPicker() {
  const remaining = getRemainingPoolThemes(themes, sessionPool, sessionPlayedIds);
  if (remaining.length === 0) {
    if (sessionPool.length === 0) {
      // Aucun thème complet (7 pistes) dans la bibliothèque : retour à
      // l'accueil plutôt qu'un faux écran "partie terminée".
      goToHome();
      return;
    }
    goToGameOver();
    return;
  }
  ui.renderThemePicker(refs.themeCards, refs.pickerEmptyMsg, remaining, startSet);
  saveSessionScreen(SCREEN.THEME_PICKER);
  ui.showScreen(SCREEN.THEME_PICKER);
  enqueuePrefetch(remaining.flatMap((t) => t.tracks));
}

refs.btnAbandonGame.addEventListener('click', () => {
  resetSession();
  sessionPool = [];
  sessionPlayedIds = [];
  goToHome();
});

function goToGameOver() {
  saveSessionScreen(SCREEN.GAME_OVER);
  ui.showScreen(SCREEN.GAME_OVER);
}

// ─── Manche ───────────────────────────────────────────────────────────────────

function startSet(themeId) {
  currentTheme = themes.find((t) => t.id === themeId);
  if (!currentTheme) return;
  currentTrackIndex = 0;
  saveCurrentThemeId(currentTheme.id);
  saveCurrentTrackIndex(0);
  saveSessionScreen(SCREEN.ROUND);
  ui.showScreen(SCREEN.ROUND);
  prioritizePrefetch(currentTheme.tracks);
  startTrack();
}

function startTrack() {
  hintState = resetHintReveal();
  clearRevealTimeout();
  revealed = false;
  roundActive = true;
  extendedPlayMax = TIMER.PLAY_MAX;
  saveCurrentTrackIndex(currentTrackIndex);

  const track = currentTheme.tracks[currentTrackIndex];
  refs.roundThemeName.textContent = currentTheme.name.toUpperCase();
  ui.renderConsigne(refs.roundThemeConsigne, currentTheme);
  ui.renderDiscCarousel(refs.discCarousel, currentTrackIndex, THEME_TRACK_COUNT);
  ui.renderHints(refs.hint1Text, refs.hint2Text, track, hintState);
  ui.renderRevealAnswer(refs.revealAnswerText, track, false);
  ui.renderRoundError(refs.roundErrorText, '');
  ui.renderProgressRing(refs.progressRingFg, 0);
  ui.renderPlayPause(refs.btnPlayPause, false);
  ui.renderExtendPrompt(refs.btnExtendPlay, false);
  refs.btnPrev.disabled = currentTrackIndex === 0;

  // Prépare la piste (téléchargement + résolution de la source) sans la
  // lancer : c'est le DJ qui décide du moment via le bouton play, pas l'app.
  loadCurrentTrack();
  if (rafHandle) cancelAnimationFrame(rafHandle);
  rafHandle = requestAnimationFrame(onAnimationFrame);
}

async function loadCurrentTrack() {
  const track = currentTheme.tracks[currentTrackIndex];
  try {
    const hadCachePath = Boolean(track.cachePath);
    await ensureDownloaded(track);
    if (!hadCachePath && track.cachePath) saveThemes(themes);
    await player.load(getSongKey(track), { autoplay: false });
  } catch (err) {
    ui.renderRoundError(refs.roundErrorText, err.message || 'Lecture impossible.');
  }
}

function onAnimationFrame() {
  if (!roundActive) return;
  const elapsedMs = player.getCurrentTime() * 1000;
  // PLAY_MAX peut être repoussé par extendPlayback() (voir plus bas) : on ne
  // passe donc pas TIMER tel quel, pour que HINT_1/HINT_2 restent fixes tout
  // en laissant le plafond de lecture évoluer piste par piste.
  const timings = { HINT_1: TIMER.HINT_1, HINT_2: TIMER.HINT_2, PLAY_MAX: extendedPlayMax };
  const next = advanceHintReveal(hintState, elapsedMs, timings);
  if (next.changed) {
    hintState = next;
    const track = currentTheme.tracks[currentTrackIndex];
    ui.renderHints(refs.hint1Text, refs.hint2Text, track, hintState);
    if (next.stopped) player.pause();
  }
  // Affiché dès qu'on approche le plafond (EXTEND_LEAD avant), pas seulement
  // une fois la lecture coupée : le DJ peut prolonger avant la coupure.
  ui.renderExtendPrompt(refs.btnExtendPlay, elapsedMs >= extendedPlayMax - TIMER.EXTEND_LEAD);
  ui.renderProgressRing(refs.progressRingFg, elapsedMs / extendedPlayMax);
  rafHandle = requestAnimationFrame(onAnimationFrame);
}

refs.btnPlayPause.addEventListener('click', () => {
  if (player.getState() === 1) player.pause();
  else player.play();
});

refs.btnExtendPlay.addEventListener('click', () => {
  extendedPlayMax += TIMER.EXTEND_STEP;
  hintState = { ...hintState, stopped: false };
  ui.renderExtendPrompt(refs.btnExtendPlay, false);
  player.play();
});

function clearRevealTimeout() {
  if (revealTimeoutHandle) {
    clearTimeout(revealTimeoutHandle);
    revealTimeoutHandle = null;
  }
}

refs.btnReveal.addEventListener('click', () => {
  clearRevealTimeout();
  revealed = !revealed;
  const track = currentTheme.tracks[currentTrackIndex];
  ui.renderRevealAnswer(refs.revealAnswerText, track, revealed);

  // La réponse dévoilée se recache toute seule après REVEAL_DURATION, pour
  // qu'elle ne reste pas affichée à l'écran pendant que le téléphone circule.
  if (revealed) {
    revealTimeoutHandle = setTimeout(() => {
      revealTimeoutHandle = null;
      revealed = false;
      ui.renderRevealAnswer(refs.revealAnswerText, track, false);
    }, TIMER.REVEAL_DURATION);
  }
});

refs.btnPrev.addEventListener('click', () => {
  goToPreviousTrack();
});

refs.btnNext.addEventListener('click', () => {
  goToNextTrack();
});

function goToPreviousTrack() {
  if (currentTrackIndex === 0) return;
  player.pause();
  currentTrackIndex -= 1;
  startTrack();
}

function goToNextTrack() {
  player.pause();
  if (currentTrackIndex + 1 >= THEME_TRACK_COUNT) {
    goToSetEnd();
  } else {
    currentTrackIndex += 1;
    startTrack();
  }
}

function goToSetEnd() {
  roundActive = false;
  if (rafHandle) cancelAnimationFrame(rafHandle);
  clearRevealTimeout();
  player.pause();

  sessionPlayedIds = markThemePlayed(sessionPlayedIds, currentTheme.id);
  saveSessionPlayedIds(sessionPlayedIds);

  ui.renderSetEnd(refs.setEndThemeName, currentTheme.name);
  saveSessionScreen(SCREEN.SET_END);
  ui.showScreen(SCREEN.SET_END);
}

refs.btnContinue.addEventListener('click', goToPicker);

// ─── Démarrage : restauration de la partie en cours (misclick/refresh) ──────

function restoreSession() {
  const screen = loadSessionScreen();

  if (screen === SCREEN.ROUND) {
    const themeId = loadCurrentThemeId();
    currentTheme = themes.find((t) => t.id === themeId) || null;
    if (currentTheme) {
      currentTrackIndex = Math.min(loadCurrentTrackIndex(), currentTheme.tracks.length - 1);
      ui.showScreen(SCREEN.ROUND);
      startTrack();
      return;
    }
  }

  if (screen === SCREEN.SET_END) {
    const themeId = loadCurrentThemeId();
    currentTheme = themes.find((t) => t.id === themeId) || null;
    if (currentTheme) {
      ui.renderSetEnd(refs.setEndThemeName, currentTheme.name);
      ui.showScreen(SCREEN.SET_END);
      return;
    }
  }

  if (screen === SCREEN.THEME_PICKER) {
    goToPicker();
    return;
  }

  if (screen === SCREEN.GAME_OVER) {
    ui.showScreen(SCREEN.GAME_OVER);
    return;
  }

  if (screen === SCREEN.SETUP) {
    refreshThemeList();
    ui.showScreen(SCREEN.SETUP);
    return;
  }

  goToHome();
}

// ─── Démarrage ────────────────────────────────────────────────────────────────

if (refs.versionBadge) {
  const buildDate = getMatch3BuildDate();
  const dateLabel = buildDate
    ? ` · ${new Date(buildDate).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`
    : '';
  refs.versionBadge.textContent = `v${getMatch3Version()}${dateLabel}`;
}

// Le pack fourni (theme-party/themes.json) est chargé par défaut au démarrage
// (fusionné, dédupliqué par nom — voir loadSeedThemes) : pas besoin de cliquer
// "Charger les thèmes fournis" pour avoir des thèmes prêts à jouer. Best-effort :
// si le fetch échoue (offline, fichier absent…), on continue quand même avec la
// bibliothèque existante ; le bouton manuel reste disponible pour réessayer.
try {
  await loadSeedThemes();
} catch (_) {
  // best-effort — voir commentaire ci-dessus
}

restoreSession();
