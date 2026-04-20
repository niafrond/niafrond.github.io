/**
 * leaderboard.js — Classement Flash Guess
 * Gère la persistance et l'affichage des résultats de parties.
 */

import { el, showScreen } from './ui.js';

const LEADERBOARD_KEY = 'flashguess_leaderboard';
const MAX_ENTRIES     = 100;

// ─── Persistence ───────────────────────────────────────────────────────────────

export function loadLeaderboard() {
  try { return JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || '[]'); } catch { return []; }
}

function saveLeaderboard(entries) {
  try { localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries)); } catch (_) { /* ignore */ }
}

/**
 * Enregistre une partie dans le classement.
 * @param {{ date: string, mode: 'standard'|'coop2', teams: Array, cardCount: number,
 *           objectives?: string[], coopTimeUsed?: number, coopTurnsCount?: number }} result
 */
export function saveGameResult(result) {
  const entries = loadLeaderboard();
  entries.unshift(result);
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  saveLeaderboard(entries);
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatCoopTime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}min` : `${m}min ${s}s`;
}

function formatDate(isoString) {
  try {
    return new Date(isoString).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
    });
  } catch { return ''; }
}

// ─── Écran ─────────────────────────────────────────────────────────────────────

let _currentTab = 'standard';

export function openLeaderboard() {
  renderLeaderboard(_currentTab);
  showScreen('screen-leaderboard');
}

export function renderLeaderboard(tabName = 'standard') {
  _currentTab = tabName;
  const entries  = loadLeaderboard();
  const standard = entries.filter(e => e.mode === 'standard');
  const coop2    = entries.filter(e => e.mode === 'coop2');

  renderStandardTab(standard);
  renderCoop2Tab(coop2);
  setActiveTab(tabName);
}

function setActiveTab(tabName) {
  document.querySelectorAll('.leaderboard-tab-btn').forEach(t => {
    t.classList.toggle('leaderboard-tab-btn--active', t.dataset.tab === tabName);
  });
  el('leaderboard-standard').hidden = (tabName !== 'standard');
  el('leaderboard-coop2').hidden    = (tabName !== 'coop2');
}

// ─── Onglet Standard ───────────────────────────────────────────────────────────

const RANK_EMOJIS = ['🥇', '🥈', '🥉', '🎖️'];

function renderStandardTab(entries) {
  const container = el('leaderboard-standard');
  container.innerHTML = '';

  if (entries.length === 0) {
    const p = document.createElement('p');
    p.className = 'leaderboard-empty';
    p.textContent = 'Aucune partie enregistrée.';
    container.appendChild(p);
    return;
  }

  entries.forEach(entry => {
    const card = document.createElement('div');
    card.className = 'card leaderboard-card';

    const meta = document.createElement('div');
    meta.className = 'leaderboard-meta';
    meta.textContent = `${formatDate(entry.date)} · 🃏 ${entry.cardCount} cartes`;
    card.appendChild(meta);

    const sorted = [...entry.teams].sort((a, b) => b.total - a.total);
    const isTie  = sorted.length >= 2 && sorted[0].total === sorted[1].total;

    sorted.forEach((team, i) => {
      const row = document.createElement('div');
      row.className = `leaderboard-team-row${i === 0 && !isTie ? ' leaderboard-team-row--winner' : ''}`;

      const rankEl = document.createElement('span');
      rankEl.className = 'leaderboard-rank';
      rankEl.textContent = (i === 0 && !isTie)
        ? RANK_EMOJIS[0]
        : RANK_EMOJIS[Math.min(i, RANK_EMOJIS.length - 1)];

      const nameEl = document.createElement('span');
      nameEl.className = 'leaderboard-team-name';
      nameEl.textContent = team.players.join(' · ');

      const scoreEl = document.createElement('span');
      scoreEl.className = 'leaderboard-team-score';
      scoreEl.textContent = `${team.total} pts`;

      row.appendChild(rankEl);
      row.appendChild(nameEl);
      row.appendChild(scoreEl);
      card.appendChild(row);
    });

    container.appendChild(card);
  });
}

// ─── Onglet Coop 2 joueurs ─────────────────────────────────────────────────────

function renderCoop2Tab(entries) {
  const container = el('leaderboard-coop2');
  container.innerHTML = '';

  if (entries.length === 0) {
    const p = document.createElement('p');
    p.className = 'leaderboard-empty';
    p.textContent = 'Aucune partie coop 2 joueurs enregistrée.';
    container.appendChild(p);
    return;
  }

  entries.forEach(entry => {
    const card = document.createElement('div');
    card.className = 'card leaderboard-card';

    const meta = document.createElement('div');
    meta.className = 'leaderboard-meta';
    meta.textContent = formatDate(entry.date);
    card.appendChild(meta);

    // Joueurs + score
    const team = entry.teams[0] ?? { players: [], total: 0 };
    const teamRow = document.createElement('div');
    teamRow.className = 'leaderboard-team-row leaderboard-team-row--winner';

    const nameEl = document.createElement('span');
    nameEl.className = 'leaderboard-team-name';
    nameEl.textContent = team.players.join(' · ');

    const scoreEl = document.createElement('span');
    scoreEl.className = 'leaderboard-team-score';
    scoreEl.textContent = `${team.total} pts`;

    teamRow.appendChild(nameEl);
    teamRow.appendChild(scoreEl);
    card.appendChild(teamRow);

    // Statistiques de performance
    const perfDiv = document.createElement('div');
    perfDiv.className = 'leaderboard-coop-perf';

    const cardSpan = document.createElement('span');
    cardSpan.className = 'leaderboard-coop-stat';
    cardSpan.textContent = `🃏 ${entry.cardCount} cartes`;
    perfDiv.appendChild(cardSpan);

    if ((entry.objectives ?? []).includes('chrono')) {
      const s = document.createElement('span');
      s.className = 'leaderboard-coop-stat leaderboard-coop-stat--chrono';
      s.textContent = `⏱️ ${formatCoopTime(entry.coopTimeUsed ?? 0)}`;
      perfDiv.appendChild(s);
    }

    if ((entry.objectives ?? []).includes('precision')) {
      const count = entry.coopTurnsCount ?? 0;
      const s = document.createElement('span');
      s.className = 'leaderboard-coop-stat leaderboard-coop-stat--precision';
      s.textContent = `🎯 ${count} tour${count !== 1 ? 's' : ''}`;
      perfDiv.appendChild(s);
    }

    card.appendChild(perfDiv);
    container.appendChild(card);
  });
}
