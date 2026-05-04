/**
 * ui.js — Navigation d'écrans et fonctions de rendu Taboo
 */

// ─── Helpers DOM ──────────────────────────────────────────────────────────────

export function el(id) { return document.getElementById(id); }

let _currentScreen = null;
const _screenCbs   = [];

/** Affiche uniquement l'écran ciblé, cache tous les autres. */
export function showScreen(id) {
  document.querySelectorAll('[data-screen]').forEach(s => { s.hidden = true; });
  const scr = el(id);
  if (scr) {
    scr.hidden = false;
    _currentScreen = id;
    _screenCbs.forEach(cb => cb(id));
  }
}

export function getCurrentScreen() { return _currentScreen; }

/** Enregistre un callback appelé à chaque changement d'écran. */
export function onScreenChange(cb) { _screenCbs.push(cb); }

/** Affiche un toast temporaire (3,5 s). */
export function showToast(msg, type = 'info') {
  const toast = el('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `toast toast-${type}`;
  toast.hidden = false;
  clearTimeout(toast._tid);
  toast._tid = setTimeout(() => { toast.hidden = true; }, 3500);
}

// ─── Rendu écran : Host lobby ─────────────────────────────────────────────────

export function renderHostLobby(peerId, url) {
  const qr = el('lobby-qr');
  if (qr) {
    qr.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
    qr.alt = 'QR code pour rejoindre la partie';
  }
  const urlEl = el('lobby-url');
  if (urlEl) urlEl.textContent = url;

  el('lobby-status').textContent = "En attente de l'autre téléphone…";
}

// ─── Rendu écran : Client connecting ─────────────────────────────────────────

export function renderClientConnect(msg, isError = false) {
  const s = el('connect-status');
  if (!s) return;
  s.textContent = msg;
  s.className = isError ? 'connect-status connect-error' : 'connect-status';
  el('connect-spinner').hidden = isError;
}

// ─── Rendu écran : Pre-turn ───────────────────────────────────────────────────

/**
 * @param {object} s  snapshot de l'état
 * @param {boolean} asHost  true si c'est le téléphone HOST qui rend
 */
export function renderPreTurn(s, asHost) {
  const giverTeam = s.teams[s.currentTeamIdx];
  const judgeTeam = s.teams[1 - s.currentTeamIdx];
  const myTeamIdx = asHost ? 0 : 1;
  const isGiver   = myTeamIdx === s.currentTeamIdx;

  el('pre-turn-round').textContent = `Manche ${s.currentRound} / ${s.totalRounds}`;
  el('pre-turn-giver').textContent  = giverTeam.name;
  el('pre-turn-judge').textContent  = judgeTeam.name;
  el('pre-turn-role').textContent   = isGiver
    ? '📣 Vous donnez les indices !'
    : '👀 Vous êtes juge !';

  const readyBtn = el('btn-ready');
  const waitMsg  = el('pre-turn-wait');
  const iAmReady    = asHost ? s.hostReady    : s.clientReady;
  const otherReady  = asHost ? s.clientReady  : s.hostReady;

  readyBtn.disabled    = iAmReady;
  readyBtn.textContent = iAmReady ? '✅ Prêt !' : '✅ Je suis prêt';
  waitMsg.hidden       = !iAmReady || otherReady;
}

// ─── Rendu écran : Turn giver ─────────────────────────────────────────────────

export function renderTurnGiver(s) {
  el('giver-round').textContent  = `Manche ${s.currentRound}/${s.totalRounds}`;
  el('giver-team').textContent   = `📣 ${s.teams[s.currentTeamIdx].name}`;
  el('giver-stats').textContent  =
    `✅ ${s.turnStats.found}  ❌ ${s.turnStats.passed}  🔔 ${s.turnStats.buzzed}`;
  _renderCard('giver', s.currentCard);
  updateTimerBar(s.timeLeft, s.timerDuration);
}

// ─── Rendu écran : Turn judge ─────────────────────────────────────────────────

export function renderTurnJudge(s) {
  el('judge-round').textContent = `Manche ${s.currentRound}/${s.totalRounds}`;
  el('judge-team').textContent  = `👀 ${s.teams[1 - s.currentTeamIdx].name} — Jugez !`;
  _renderCard('judge', s.currentCard);
  updateTimerBar(s.timeLeft, s.timerDuration);
}

// ─── Carte Taboo ─────────────────────────────────────────────────────────────

function _renderCard(prefix, card) {
  if (!card) return;
  const wordEl      = el(`${prefix}-word`);
  const forbiddenEl = el(`${prefix}-forbidden`);
  if (wordEl)      wordEl.textContent = card.word;
  if (forbiddenEl) {
    forbiddenEl.innerHTML = card.taboo
      .map(w => `<li class="forbidden-item"><span class="forbidden-icon">🚫</span>${w}</li>`)
      .join('');
  }
}

// ─── Barre de timer ──────────────────────────────────────────────────────────

export function updateTimerBar(timeLeft, duration) {
  const bar   = el('timer-bar');
  const label = el('timer-label');
  if (!bar || !label) return;
  const pct = duration > 0 ? (timeLeft / duration) * 100 : 0;
  bar.style.width = `${pct}%`;
  label.textContent = timeLeft;
  bar.className = 'timer-bar';
  if (timeLeft <= 5)       bar.classList.add('timer-urgent');
  else if (timeLeft <= 10) bar.classList.add('timer-warning');
}

// ─── Rendu écran : Turn end ──────────────────────────────────────────────────

export function renderTurnEnd(s, asHost) {
  const statsEl = el('turn-end-stats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="stat-chip">✅ <strong>${s.turnStats.found}</strong> trouvé${s.turnStats.found !== 1 ? 's' : ''}</div>
      <div class="stat-chip">❌ <strong>${s.turnStats.passed}</strong> passé${s.turnStats.passed !== 1 ? 's' : ''}</div>
      <div class="stat-chip">🔔 <strong>${s.turnStats.buzzed}</strong> buzzé${s.turnStats.buzzed !== 1 ? 's' : ''}</div>
    `;
  }

  const scoresEl = el('turn-end-scores');
  if (scoresEl) {
    scoresEl.innerHTML = '';
    s.teams.forEach((t, i) => {
      const row = document.createElement('div');
      row.className = `score-row ${i === 0 ? 'score-red' : 'score-blue'}`;
      
      const teamSpan = document.createElement('span');
      teamSpan.className = 'score-team';
      teamSpan.textContent = `${i === 0 ? '🔴' : '🔵'} ${t.name}`;
      
      const ptsSpan = document.createElement('span');
      ptsSpan.className = 'score-pts';
      ptsSpan.textContent = `${t.score} pt${t.score !== 1 ? 's' : ''}`;
      
      row.appendChild(teamSpan);
      row.appendChild(ptsSpan);
      scoresEl.appendChild(row);
    });
  }

  const nextBtn = el('btn-next-turn');
  if (nextBtn) nextBtn.hidden = !asHost;

  const waitEl = el('turn-end-wait');
  if (waitEl) waitEl.hidden = asHost;
}

// ─── Rendu écran : Game over ─────────────────────────────────────────────────

export function renderGameOver(s, asHost) {
  const sorted = s.teams
    .map((t, i) => ({ ...t, teamIdx: i }))
    .sort((a, b) => b.score - a.score);

  const winner = sorted[0];
  el('go-winner').textContent = `🎉 ${winner.name} gagne !`;

  const scoresEl = el('go-scores');
  if (scoresEl) {
    scoresEl.innerHTML = '';
    sorted.forEach((t, rank) => {
      const row = document.createElement('div');
      row.className = 'go-row';
      
      const rankSpan = document.createElement('span');
      rankSpan.className = 'go-rank';
      rankSpan.textContent = rank === 0 ? '🏆' : '🥈';
      
      const teamSpan = document.createElement('span');
      teamSpan.className = 'go-team';
      teamSpan.textContent = `${t.teamIdx === 0 ? '🔴' : '🔵'} ${t.name}`;
      
      const ptsSpan = document.createElement('span');
      ptsSpan.className = 'go-pts';
      ptsSpan.textContent = `${t.score} pt${t.score !== 1 ? 's' : ''}`;
      
      row.appendChild(rankSpan);
      row.appendChild(teamSpan);
      row.appendChild(ptsSpan);
      scoresEl.appendChild(row);
    });
  }

  const replayBtn = el('btn-replay');
  if (replayBtn) replayBtn.hidden = !asHost;

  const waitEl = el('go-wait');
  if (waitEl) waitEl.hidden = asHost;
}
