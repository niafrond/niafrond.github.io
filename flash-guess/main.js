/**
 * main.js — Point d'entrée Flash Guess
 *
 * Flux : setup → categories → teams → round-intro → pre-turn → turn → turn-end → round-end → game-over
 */

import { state, demo, withCooldown, GAMEPLAY_SCREENS } from './state.js';
import { el, showScreen, getCurrentScreen } from './ui.js';
import { setMuted, getMuted } from './sound.js';
import { getMatch3Version, getMatch3BuildDate } from '../match3-quest/version.js';

import {
  startRound, startPreTurn, startTurn,
  wordFound, wordSkipped, wordFault,
  undoLastAction, redoLastAction,
  childConfirmedRead,
  handleNextTurn, showGameOver,
  openCorrectTurn, closeCorrectTurn, applyTurnCorrection,
  assignTeams, renderTeams,
  pauseTimer, resumeTimer,
  fitWordCard,
  setCoopObjective,
  startWordDraft, showWordDraftTurn, confirmWordDraftEliminations,
} from './game.js';

import {
  loadCardCount, saveCardCount,
  loadKidsMode,
  loadWordDraftMode, saveWordDraftMode,
  renderPlayerList,
  addPlayer,
  updateKidsModeStatus, toggleKidsMode,
  openCategorySelect,
  selectAllCategories, deselectAllCategories, confirmCategories,
} from './setup.js';

import {
  loadMembers,
  renderMembersList, renderGroupsInSetup,
  openGroupsEditor, createNewGroup,
} from './members.js';

import { openWordsEditor, addWord, exportWords, importWords, handleResetWords } from './editor.js';
import { startDemoTurn } from './demo.js';
import { toggleFullscreen, updateFullscreenBtn, installPwa, initServiceWorker } from './pwa.js';
import { playButtonClick } from './sound.js';
import { openLeaderboard, renderLeaderboard } from './leaderboard.js';

// ─── Overlay orientation ───────────────────────────────────────────────────────
function handleOrientationTimerState(overlayVisible) {
  if (getCurrentScreen() !== 'screen-turn') return;
  if (overlayVisible) {
    pauseTimer();
  } else if (state.timerPaused) {
    resumeTimer();
  }
}

function updateRotateOverlay() {
  const isPortrait    = window.matchMedia('(orientation: portrait)').matches;
  const currentScreen = getCurrentScreen();
  const shouldShow    = GAMEPLAY_SCREENS.has(currentScreen) && isPortrait;
  el('rotate-overlay').classList.toggle('active', shouldShow || (demo.waiting && isPortrait));
  handleOrientationTimerState(shouldShow);

  if (demo.waiting && !isPortrait) {
    demo.waiting         = false;
    demo.mode            = true;
    demo.childReadFrozen = false;
    startPreTurn();
  }
}

// ─── INIT ──────────────────────────────────────────────────────────────────────
function init() {
  // ── Version ──
  const versionEl = document.getElementById('flashguess-version');
  const buildDate = getMatch3BuildDate();
  if (versionEl) {
    const dateLabel = buildDate
      ? ` · ${new Date(buildDate).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`
      : '';
    versionEl.textContent = `v${getMatch3Version()}${dateLabel}`;
  }

  // ── Setup ──
  el('btn-add-player').addEventListener('click', withCooldown(addPlayer));
  el('player-input').addEventListener('keydown', e => { if (e.key === 'Enter') addPlayer(); });
  el('btn-start-game').addEventListener('click', withCooldown(() => {
    if (state.playerNames.length >= 2) openCategorySelect();
  }));
  renderMembersList();
  renderGroupsInSetup();

  // ── Groupes ──
  el('btn-manage-groups').addEventListener('click', withCooldown(openGroupsEditor));
  el('btn-groups-back').addEventListener('click', withCooldown(() => {
    renderMembersList();
    renderGroupsInSetup();
    showScreen('screen-setup');
    updateRotateOverlay();
  }));
  el('btn-group-create').addEventListener('click', withCooldown(createNewGroup));
  el('group-new-name').addEventListener('keydown', e => { if (e.key === 'Enter') createNewGroup(); });

  // ── Options de partie ──
  state.cardCount = loadCardCount();
  const selectCardCount = el('select-card-count');
  selectCardCount.value = String(state.cardCount);
  selectCardCount.addEventListener('change', () => {
    state.cardCount = parseInt(selectCardCount.value, 10);
    saveCardCount(state.cardCount);
  });

  // ── Mode enfant ──
  state.kidsModeManual = loadKidsMode();
  updateKidsModeStatus();
  el('toggle-kids-mode').addEventListener('click', withCooldown(toggleKidsMode));

  // ── Choix des mots (word draft) ──
  state.wordDraftMode = loadWordDraftMode();
  const wordDraftBtn = el('toggle-word-draft');
  function updateWordDraftBtn() {
    wordDraftBtn.textContent = state.wordDraftMode ? 'ON' : 'OFF';
    wordDraftBtn.className =
      `kids-mode-toggle-btn${state.wordDraftMode ? ' kids-mode-toggle-btn--on' : ''}`;
    wordDraftBtn.setAttribute('aria-checked', String(state.wordDraftMode));
  }
  updateWordDraftBtn();
  wordDraftBtn.addEventListener('click', withCooldown(() => {
    state.wordDraftMode = !state.wordDraftMode;
    saveWordDraftMode(state.wordDraftMode);
    updateWordDraftBtn();
  }));

  // ── Categories ──
  el('btn-categories-back').addEventListener('click', withCooldown(() => {
    showScreen('screen-setup');
    updateRotateOverlay();
  }));
  el('btn-cats-all').addEventListener('click', withCooldown(selectAllCategories));
  el('btn-cats-none').addEventListener('click', withCooldown(deselectAllCategories));
  el('btn-cats-confirm').addEventListener('click', withCooldown(confirmCategories));

  // ── Teams ──
  el('btn-reshuffle').addEventListener('click', withCooldown(() => {
    assignTeams();
    renderTeams();
  }));
  el('btn-launch-game').addEventListener('click', withCooldown(() => {
    if (state.wordDraftMode) {
      startWordDraft();
    } else {
      startRound(1);
    }
    updateRotateOverlay();
  }));

  // ── Word draft cover ──
  el('btn-draft-cover-ready').addEventListener('click', withCooldown(() => {
    playButtonClick();
    showWordDraftTurn(state.draftCurrentPlayerIdx);
  }));

  // ── Word draft turn ──
  el('btn-draft-confirm').addEventListener('click', withCooldown(() => {
    playButtonClick();
    confirmWordDraftEliminations();
    updateRotateOverlay();
  }));

  // ── Objectif coop 2 joueurs ──
  document.querySelectorAll('.btn-coop-opt').forEach(btn => {
    btn.addEventListener('click', withCooldown(() => setCoopObjective(btn.dataset.obj)));
  });

  // ── Round intro ──
  el('btn-round-go').addEventListener('click', withCooldown(() => {
    playButtonClick();
    startPreTurn();
    updateRotateOverlay();
  }));

  // ── Pre-turn ──
  el('btn-ready').addEventListener('click', withCooldown(() => {
    playButtonClick();
    startTurn();
    updateRotateOverlay();
  }));

  // ── Turn ──
  el('btn-found').addEventListener('click', withCooldown(wordFound));
  el('btn-error').addEventListener('click', withCooldown(wordFault));
  el('btn-skip').addEventListener('click', withCooldown(wordSkipped));
  el('btn-undo').addEventListener('click', withCooldown(undoLastAction));
  el('btn-redo').addEventListener('click', withCooldown(redoLastAction));
  el('btn-child-read').addEventListener('click', withCooldown(childConfirmedRead));

  // ── Turn end ──
  el('btn-correct-turn').addEventListener('click', withCooldown(openCorrectTurn));
  el('correct-turn-close').addEventListener('click', withCooldown(closeCorrectTurn));
  el('correct-turn-confirm').addEventListener('click', withCooldown(applyTurnCorrection));
  el('correct-turn-overlay').addEventListener('click', (e) => {
    if (e.target === el('correct-turn-overlay')) closeCorrectTurn();
  });
  el('btn-next-turn').addEventListener('click', withCooldown(() => {
    playButtonClick();
    handleNextTurn();
    updateRotateOverlay();
  }));

  // ── Round end ──
  el('btn-next-round').addEventListener('click', withCooldown(() => {
    playButtonClick();
    if (demo.mode) {
      state.currentRound++;
      const team = state.teams[state.currentTeamIdx];
      state.teamPlayerIdx[state.currentTeamIdx] =
        (state.teamPlayerIdx[state.currentTeamIdx] + 1) % team.players.length;
      state.roundWords  = [...state.allWords];
      state.currentWord = null;
      startTurn();
    } else {
      startRound(state.currentRound + 1);
    }
    updateRotateOverlay();
  }));
  el('btn-final-results').addEventListener('click', withCooldown(() => {
    playButtonClick();
    showGameOver();
    updateRotateOverlay();
  }));

  // ── Game over ──
  el('btn-replay').addEventListener('click', withCooldown(() => {
    state.teams              = [];
    state.teamPlayerIdx      = [];
    state.allWords           = [];
    state.roundWords         = [];
    state.currentRound       = 0;
    state.noTeamsMode        = false;
    state.selectedCategories = [];
    state.playerIsChild.clear();
    state.coopObjectives = new Set();
    state.coopTimeUsed   = 0;
    state.coopTurnsCount = 0;
    const freshMembers = loadMembers();
    state.playerNames.forEach(name => {
      const m = freshMembers.find(x => x.name === name);
      if (m?.isChild) state.playerIsChild.add(name);
    });
    renderPlayerList();
    renderMembersList();
    renderGroupsInSetup();
    showScreen('screen-setup');
    updateRotateOverlay();
  }));

  // ── Mute toggle ──
  el('btn-mute').addEventListener('click', withCooldown(() => {
    setMuted(!getMuted());
    el('btn-mute').textContent = getMuted() ? '🔇' : '🔊';
  }));

  // ── Words editor ──
  el('btn-edit-words').addEventListener('click', withCooldown(openWordsEditor));
  el('btn-install-pwa').addEventListener('click', withCooldown(installPwa));
  el('btn-words-back').addEventListener('click', withCooldown(() => {
    showScreen('screen-setup');
    updateRotateOverlay();
  }));
  el('btn-word-add').addEventListener('click', withCooldown(addWord));
  el('word-new-text').addEventListener('keydown', e => { if (e.key === 'Enter') addWord(); });
  el('btn-words-export').addEventListener('click', withCooldown(exportWords));
  el('input-words-import').addEventListener('change', e => {
    importWords(e.target.files[0]);
    e.target.value = '';
  });
  el('btn-words-reset').addEventListener('click', withCooldown(handleResetWords));

  // ── Classement ──
  el('btn-leaderboard').addEventListener('click', withCooldown(openLeaderboard));
  el('btn-leaderboard-back').addEventListener('click', withCooldown(() => {
    showScreen('screen-setup');
    updateRotateOverlay();
  }));
  document.querySelectorAll('.leaderboard-tab-btn').forEach(btn => {
    btn.addEventListener('click', withCooldown(() => renderLeaderboard(btn.dataset.tab)));
  });

  // ── Démo ──
  el('btn-launch-demo').addEventListener('click', withCooldown(startDemoTurn));

  // ── Bouton retour (navigateur / téléphone) ──
  window.addEventListener('popstate', (e) => {
    const current = getCurrentScreen();
    if (GAMEPLAY_SCREENS.has(current)) {
      // Bloquer le retour pendant le gameplay pour éviter une sortie accidentelle
      history.pushState({ screen: current }, '');
      return;
    }
    const target = e.state?.screen ?? 'screen-setup';
    showScreen(target, false);
    updateRotateOverlay();
  });

  // ── Redimensionnement / orientation ──
  window.addEventListener('resize', () => {
    if (!el('screen-turn').hidden) fitWordCard();
    updateRotateOverlay();
  });
  window.addEventListener('orientationchange', updateRotateOverlay);

  // ── Fullscreen ──
  el('btn-fullscreen').addEventListener('click', withCooldown(toggleFullscreen));
  document.addEventListener('fullscreenchange', updateFullscreenBtn);
  document.addEventListener('webkitfullscreenchange', updateFullscreenBtn);

  renderPlayerList();
  showScreen('screen-setup');
  updateRotateOverlay();
}

document.addEventListener('DOMContentLoaded', init);
initServiceWorker();
