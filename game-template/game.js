/**
 * game.js — Logique de jeu : timer, tours, scores
 *
 * TODO : Adaptez ce fichier à la mécanique de votre jeu.
 *        Les fonctions marquées TODO sont les points d'extension principaux.
 */

import { state, TEAMS_META } from './state.js';
import { el, showScreen, showToast } from './ui.js';
import { playTick, playTickUrgent, playBuzzer, playFound, playGameStart, playGameOver } from './sound.js';

// ─── Équipes ───────────────────────────────────────────────────────────────────

/**
 * Répartit les joueurs en équipes de façon équilibrée et aléatoire.
 * Mélange d'abord la liste puis découpe en tranches.
 */
export function assignTeams() {
  const names   = [...state.playerNames].sort(() => Math.random() - 0.5);
  const count   = Math.min(Math.max(2, Math.floor(names.length / 2)), TEAMS_META.length);
  state.teams   = [];

  for (let i = 0; i < count; i++) {
    state.teams.push({
      name:    TEAMS_META[i].label,
      color:   TEAMS_META[i].color,
      players: [],
      score:   0,
    });
  }
  names.forEach((name, idx) => {
    state.teams[idx % count].players.push(name);
  });
  state.currentTeamIdx = 0;
}

/** Affiche les équipes sur l'écran screen-teams. */
export function renderTeams() {
  const container = el('teams-container');
  if (!container) return;
  container.innerHTML = state.teams.map(team => `
    <div class="team-card" style="border-left: 4px solid ${team.color}">
      <div class="team-name" style="color:${team.color}">${team.name}</div>
      <div class="team-players">${team.players.join(', ')}</div>
    </div>
  `).join('');
}

// ─── Timer ─────────────────────────────────────────────────────────────────────

const TIMER_RADIUS  = 46;
const TIMER_CIRCUM  = 2 * Math.PI * TIMER_RADIUS;

function _updateTimerDisplay() {
  const progress = el('timer-progress');
  const label    = el('timer-label');
  if (progress) {
    const ratio = Math.max(0, state.timeLeft / state.turnDuration);
    progress.style.strokeDashoffset = TIMER_CIRCUM * (1 - ratio);
    const pct = ratio * 100;
    progress.style.stroke = pct > 50 ? 'var(--success)' : pct > 20 ? 'var(--warning)' : 'var(--danger)';
  }
  if (label) label.textContent = state.timeLeft;
}

function _onTimerTick() {
  if (state.timerPaused) return;
  state.timeLeft--;

  if (state.timeLeft <= 5)       playTickUrgent();
  else if (state.timeLeft <= 10) playTick();

  _updateTimerDisplay();

  if (state.timeLeft <= 0) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
    _onTimeUp();
  }
}

function _onTimeUp() {
  playBuzzer();
  // TODO : gérez ici la fin du temps (passer au tour suivant, afficher résultats…)
  endTurn();
}

export function startTimer() {
  clearInterval(state.timerInterval);
  state.timeLeft     = state.turnDuration;
  state.timerPaused  = false;
  _updateTimerDisplay();
  state.timerInterval = setInterval(_onTimerTick, 1000);
}

export function pauseTimer() {
  state.timerPaused = true;
}

export function resumeTimer() {
  state.timerPaused = false;
}

export function stopTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
}

// ─── Déroulement d'un tour ─────────────────────────────────────────────────────

/**
 * Démarre un nouveau tour pour l'équipe courante.
 * TODO : initialisez ici l'état spécifique à votre tour (piocher une carte, etc.)
 */
export function startTurn() {
  const team = state.teams[state.currentTeamIdx];
  const turnTeamName = el('turn-team-name');
  if (turnTeamName) {
    turnTeamName.textContent = team.name;
    turnTeamName.style.color = team.color;
  }

  playGameStart();

  // TODO : affichez le premier élément de jeu (mot, carte, défi…)
  _renderTurnContent();

  startTimer();
  showScreen('screen-turn');
}

/**
 * TODO : Affichez ici le contenu de votre tour (mot à faire deviner, défi, etc.)
 */
function _renderTurnContent() {
  const content = el('turn-content');
  if (content) {
    content.textContent = '? ? ?'; // TODO: remplacer par votre contenu de jeu
  }
}

/**
 * Appelé quand la réponse est correcte.
 * TODO : adaptez le score, passez au prochain élément, etc.
 */
export function itemFound() {
  playFound();
  state.teams[state.currentTeamIdx].score++;
  el('score-display').textContent = state.teams[state.currentTeamIdx].score;
  // TODO : piocher l'élément suivant ou terminer le tour si plus rien
}

/**
 * Fin du tour (temps écoulé ou volontairement terminé).
 * Passe à l'équipe suivante ou affiche le game over.
 */
export function endTurn() {
  stopTimer();

  // Afficher les scores intermédiaires
  const scoresEl = el('turn-end-scores');
  if (scoresEl) {
    scoresEl.innerHTML = state.teams.map(team => `
      <div class="turn-end-score-row">
        <span class="turn-end-team" style="color:${team.color}">${team.name}</span>
        <span class="turn-end-pts">${team.score} pt${team.score !== 1 ? 's' : ''}</span>
      </div>
    `).join('');
  }

  // TODO : logique de fin de manche / fin de partie
  // Ici on passe simplement à l'équipe suivante après un écran intermédiaire.
  state.currentTeamIdx = (state.currentTeamIdx + 1) % state.teams.length;

  showScreen('screen-turn-end');
}

// ─── Fin de partie ─────────────────────────────────────────────────────────────

/** Affiche l'écran de fin de partie avec les scores finaux. */
export function showGameOver() {
  stopTimer();
  playGameOver();

  // Trier les équipes par score décroissant
  const sorted = [...state.teams].sort((a, b) => b.score - a.score);
  const results = el('game-over-results');
  if (results) {
    results.innerHTML = sorted.map((team, i) => `
      <div class="result-row">
        <span class="result-rank">${i === 0 ? '🏆' : `${i + 1}.`}</span>
        <span class="result-team" style="color:${team.color}">${team.name}</span>
        <span class="result-score">${team.score} pt${team.score !== 1 ? 's' : ''}</span>
      </div>
    `).join('');
  }

  showScreen('screen-game-over');
}
