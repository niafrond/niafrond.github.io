/**
 * ui-party.js — Rendu DOM pour le mode Party (mini-jeux)
 */

import { CATEGORY_LABELS, POWER, POWER_LABELS, POWER_DESCRIPTIONS, POWER_COOLDOWN } from './constants.js';
import { PARTY_MINI, PARTY_MINI_LABELS } from './party-game.js';
import { el, setText, escapeHtml } from './ui.js';

/**
 * Lit les options party depuis le formulaire de configuration et retourne l'objet de config.
 */
export function readPartyOptions() {
  const streakBox   = el('party-mini-streak');
  const duelBox     = el('party-mini-duel');
  const tfBox       = el('party-mini-tf');
  const raceBox     = el('party-mini-race');
  const blitzBox    = el('party-mini-blitz');
  const carouselBox = el('party-mini-carousel');
  const randBox     = el('party-random');
  const qCountInput = el('party-questions-count');

  const minis = [];
  if (streakBox?.checked)   minis.push(PARTY_MINI.STREAK);
  if (duelBox?.checked)     minis.push(PARTY_MINI.DUEL);
  if (tfBox?.checked)       minis.push(PARTY_MINI.SPEED_TF);
  if (raceBox?.checked)     minis.push(PARTY_MINI.RACE);
  if (blitzBox?.checked)    minis.push(PARTY_MINI.BLITZ);
  if (carouselBox?.checked) minis.push(PARTY_MINI.CAROUSEL);

  // Si aucun sélectionné ou si mode "tout aléatoire" : retourner null pour utiliser le défaut aléatoire
  const allRandom = randBox?.checked ?? false;
  const questionsPerMini = Math.max(1, Math.min(15, parseInt(qCountInput?.value ?? '5', 10) || 5));
  return {
    partyMinis:      minis.length ? minis : null,
    partyRandom:     allRandom,
    questionsPerMini,
  };
}

/**
 * Affiche ou masque l'overlay de transition entre mini-jeux.
 * @param {{ mini:string, miniIndex:number, totalMinis:number, label:string, icon:string, rules:string }|null} data
 *   Passer null pour masquer l'overlay.
 * @param {boolean} isHost
 * @param {function(): void} [onStart]  callback lié au bouton "Commencer !" (hôte)
 */
export function renderPartyOverlay(data, isHost, onStart) {
  const overlay = el('party-mini-overlay');
  if (!overlay) return;

  if (!data) {
    overlay.hidden = true;
    return;
  }

  setText('party-overlay-progress',
    `Mini-jeu ${data.miniIndex + 1} / ${data.totalMinis}`);
  const iconEl = el('party-overlay-icon');
  if (iconEl) iconEl.textContent = data.icon ?? '🎮';
  setText('party-overlay-name', data.label ?? data.mini);
  setText('party-overlay-rules', data.rules ?? '');

  const btnStart = el('btn-party-start-mini');
  if (btnStart) {
    btnStart.hidden = !isHost;
    btnStart.disabled = false;
    btnStart.textContent = '▶️ Commencer !';
    if (isHost && onStart) btnStart.onclick = onStart;
  }

  overlay.hidden = false;
}

/** Cache l'overlay de transition */
export function hidePartyOverlay() {
  const overlay = el('party-mini-overlay');
  if (overlay) overlay.hidden = true;
}

// ─── Helpers internes party ────────────────────────────────────────────────────

function hideAllPartyPanels() {
  const ids = [
    'phase-party-streak', 'phase-party-streak-reveal',
    'phase-party-duel-assign', 'phase-party-duel-pick',
    'phase-party-duel-question', 'phase-party-duel-result',
    'phase-party-tf', 'phase-party-tf-result',
    'phase-party-race', 'phase-party-blitz', 'phase-party-carousel',
    'phase-party-mini-end',
  ];
  ids.forEach(id => { const e = el(id); if (e) e.hidden = true; });
}

function showPartyPanel(id) {
  hideAllPartyPanels();
  const e = el(id);
  if (e) e.hidden = false;
}

function renderPartyChoiceGrid(containerId, choices, onChoiceClick, disabledAll = false) {
  const grid = el(containerId);
  if (!grid) return;
  grid.innerHTML = choices.map(c =>
    `<button class="choice-btn party-choice-btn" data-choice="${escapeHtml(c)}"${disabledAll ? ' disabled' : ''}>${escapeHtml(c)}</button>`
  ).join('');
  if (onChoiceClick && !disabledAll) {
    grid.querySelectorAll('.choice-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        grid.querySelectorAll('.choice-btn').forEach(b => { b.disabled = true; });
        btn.classList.add('choice-selected');
        // Récupérer la valeur originale depuis l'attribut data-choice (déjà HTML-escapé)
        onChoiceClick(btn.dataset.choice);
      });
    });
  }
}

function highlightPartyChoiceGrid(containerId, correctAnswer) {
  const grid = el(containerId);
  if (!grid) return;
  grid.querySelectorAll('.choice-btn').forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.choice === correctAnswer) btn.classList.add('choice-correct');
    else if (btn.classList.contains('choice-selected')) btn.classList.add('choice-wrong');
  });
}

// ─── STREAK ───────────────────────────────────────────────────────────────────

/**
 * Affiche la question STREAK avec grille de choix.
 * @param {{ text:string, choices:string[], index:number, total:number, correctAnswer?:string }} data
 * @param {boolean} isHost
 * @param {function(string): void} [onChoice]
 */
export function renderPartyStreakQuestion(data, isHost, onChoice) {
  showPartyPanel('phase-party-streak');
  setText('party-streak-counter', `Question ${data.index + 1} / ${data.total}`);
  setText('party-streak-text', data.text ?? '');
  const hint = el('party-streak-host-answer');
  if (hint) {
    hint.hidden = !isHost || !data.correctAnswer;
    if (isHost && data.correctAnswer) hint.textContent = `🔑 ${data.correctAnswer}`;
  }
  renderPartyChoiceGrid('party-streak-choices', data.choices ?? [], onChoice ?? null, onChoice == null);
  // Show/hide streak board
  const board = el('streak-board');
  if (board) board.hidden = false;
}

/**
 * Affiche le résultat de la question STREAK.
 * @param {{ correctAnswer:string, results:object, streaks:object }} data
 * @param {string[]} playerIds  — liste des joueurs dans l'ordre
 * @param {Map<string,string>} playerNames
 */
export function renderPartyStreakReveal(data, players) {
  showPartyPanel('phase-party-streak-reveal');
  highlightPartyChoiceGrid('party-streak-choices', data.correctAnswer);
  setText('party-streak-reveal-answer', data.correctAnswer ?? '');

  const container = el('party-streak-results');
  if (container) {
    container.innerHTML = players
      .map(p => {
        const r = data.results[p.id] ?? { correct: false, choice: null };
        const streak = data.streaks[p.id] ?? { current: 0, max: 0 };
        const cls = r.correct ? 'streak-correct' : 'streak-wrong';
        const icon = r.correct ? '✅' : '❌';
        const streakTxt = streak.current > 0
          ? `🔥×${streak.current}`
          : (streak.max > 0 ? `max ${streak.max}` : '');
        return `<div class="party-streak-result-row ${cls}">
          <span class="streak-result-icon">${icon}</span>
          <span class="streak-result-name">${escapeHtml(p.name)}</span>
          <span class="streak-result-answer">${escapeHtml(r.choice ?? '(sans réponse)')}</span>
          ${streakTxt ? `<span class="streak-result-streak">${streakTxt}</span>` : ''}
        </div>`;
      }).join('');
  }
  // Mettre à jour le tableau des séries
  renderStreakBoard(data.streaks, players);
}

/**
 * Met à jour le tableau des séries dans la sidebar.
 */
export function renderStreakBoard(streaks, players) {
  const board = el('streak-board');
  const list  = el('streak-list');
  if (!board || !list) return;
  board.hidden = false;
  list.innerHTML = players
    .map(p => {
      const s = streaks[p.id] ?? { current: 0, max: 0 };
      return `<div class="streak-board-row">
        <span class="streak-board-name">${escapeHtml(p.name)}</span>
        <span class="streak-board-current">${s.current > 0 ? `🔥×${s.current}` : '·'}</span>
        <span class="streak-board-max">max ${s.max}</span>
      </div>`;
    }).join('');
}

// ─── DUEL ─────────────────────────────────────────────────────────────────────

/**
 * Affiche l'annonce du duel (qui interroge).
 */
export function renderPartyDuelAssign(data) {
  showPartyPanel('phase-party-duel-assign');
  const board = el('streak-board');
  if (board) board.hidden = true;
  setText('party-duel-assign-text',
    `${data.interrogateurName} est l'Interrogateur (Duel ${data.duelIndex + 1}/${data.totalDuels})`);
}

/**
 * Affiche les options de choix privées pour l'interrogateur (hôte ou client).
 * @param {{ options: Array<{id,text,correctAnswer}> }} data
 * @param {function(string): void} onPick
 */
export function renderPartyDuelPick(data, onPick) {
  showPartyPanel('phase-party-duel-pick');
  const container = el('party-duel-pick-options');
  if (!container) return;
  container.innerHTML = data.options.map(q => `
    <button class="party-pick-btn" data-qid="${escapeHtml(q.id)}">
      ${escapeHtml(q.text)}
      <span class="pick-answer-hint">🔑 ${escapeHtml(q.correctAnswer)}</span>
    </button>
  `).join('');
  container.querySelectorAll('.party-pick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.party-pick-btn').forEach(b => { b.disabled = true; });
      onPick(btn.dataset.qid);
    });
  });
}

/**
 * Affiche la question duel pour tous les joueurs (sauf interrogateur).
 */
export function renderPartyDuelQuestion(data, myId, isHost, onChoice) {
  showPartyPanel('phase-party-duel-question');
  const isInterrogateur = myId === data.interrogateurId;

  setText('party-duel-asker-label',
    `🎯 ${data.interrogateurName} pose la question (Duel ${data.duelIndex + 1}/${data.totalDuels}) :`);
  setText('party-duel-question-text', data.questionText ?? '');

  const hint = el('party-duel-host-answer');
  if (hint) {
    hint.hidden = !(isHost && data.correctAnswer);
    if (isHost && data.correctAnswer) hint.textContent = `🔑 ${data.correctAnswer}`;
  }

  const watching = el('party-duel-watching');
  if (watching) {
    watching.hidden = !isInterrogateur;
    watching.textContent = isInterrogateur
      ? '👀 Vous observez les réponses des autres…' : '';
  }

  renderPartyChoiceGrid(
    'party-duel-choices',
    data.choices ?? [],
    isInterrogateur ? null : onChoice,
    isInterrogateur
  );
}

/**
 * Affiche le résultat d'un round duel.
 */
export function renderPartyDuelResult(data, players) {
  showPartyPanel('phase-party-duel-result');
  const container = el('party-duel-result-content');
  if (!container) return;

  const rows = players
    .map(p => {
      if (p.id === data.interrogateurId) {
        const pts = data.ptsInterrogateur ?? 0;
        const ptsCls = pts >= 0 ? 'pts-pos' : 'pts-neg';
        const ptsStr = pts >= 0 ? `+${pts}` : `${pts}`;
        return `<div class="party-duel-result-row duel-interrogateur">
          <span class="duel-result-icon">🎯</span>
          <span class="duel-result-name">${escapeHtml(p.name)} <em style="font-weight:400;font-size:0.8rem;">(interrogateur)</em></span>
          <span class="duel-result-pts ${ptsCls}">${ptsStr} pts</span>
        </div>`;
      }
      const r = data.results[p.id] ?? { correct: false, choice: null };
      const cls = r.correct ? 'duel-correct' : 'duel-wrong';
      const icon = r.correct ? '✅' : '❌';
      const pts = r.correct ? '+5' : '-2';
      const ptsCls = r.correct ? 'pts-pos' : 'pts-neg';
      return `<div class="party-duel-result-row ${cls}">
        <span class="duel-result-icon">${icon}</span>
        <span class="duel-result-name">${escapeHtml(p.name)}</span>
        <span class="duel-result-pts ${ptsCls}">${pts} pts</span>
      </div>`;
    }).join('');

  const correctLine = `<p class="party-duel-correct-answer">✅ Bonne réponse : <strong>${escapeHtml(data.correctAnswer ?? '')}</strong></p>`;
  container.innerHTML = rows + correctLine;
}

// ─── SPEED TF ─────────────────────────────────────────────────────────────────

/**
 * Affiche l'énoncé Vrai/Faux.
 * @param {boolean} votingOpen  — true = boutons actifs
 */
export function renderPartyTFQuestion(data, isHost, myVote, onVote, votingOpen) {
  showPartyPanel('phase-party-tf');
  setText('party-tf-counter', `Question ${(data.tfIndex ?? 0) + 1} / ${data.totalTF ?? 5}`);
  setText('party-tf-statement', data.statement ?? '');

  const hint = el('party-tf-host-hint');
  if (hint) {
    hint.hidden = !(isHost && data.correctVote);
    if (isHost && data.correctVote) hint.textContent = `🔑 Réponse : ${data.correctVote === 'V' ? 'VRAI ✅' : 'FAUX ❌'}`;
  }

  const buttons = el('party-tf-buttons');
  if (buttons) buttons.hidden = !votingOpen;

  const voted = el('party-tf-voted');
  if (voted) {
    voted.hidden = !myVote || !votingOpen;
    voted.textContent = myVote
      ? `Vous avez voté : ${myVote === 'V' ? '✅ VRAI' : '❌ FAUX'}`
      : '';
  }

  if (votingOpen && onVote && !myVote) {
    const btnVrai = el('btn-tf-vrai');
    const btnFaux = el('btn-tf-faux');
    if (btnVrai) { btnVrai.disabled = false; btnVrai.classList.remove('tf-selected'); btnVrai.onclick = () => { onVote('V'); }; }
    if (btnFaux) { btnFaux.disabled = false; btnFaux.classList.remove('tf-selected'); btnFaux.onclick = () => { onVote('F'); }; }
  } else {
    const btnVrai = el('btn-tf-vrai');
    const btnFaux = el('btn-tf-faux');
    if (btnVrai) btnVrai.disabled = true;
    if (btnFaux) btnFaux.disabled = true;
  }
}

/**
 * Affiche le résultat Vrai/Faux.
 */
export function renderPartyTFReveal(data, players) {
  showPartyPanel('phase-party-tf-result');
  const correct = data.correctVote;
  setText('party-tf-reveal-answer',
    `${correct === 'V' ? '✅ VRAI' : '❌ FAUX'} — ${data.tfStatement ?? ''}`);

  const container = el('party-tf-reveal-votes');
  if (!container) return;
  container.innerHTML = players
    .map(p => {
      const vote = data.votes[p.id];
      if (!vote) {
        return `<div class="party-tf-vote-row tf-vote-none">
          <span class="tf-vote-icon">⏱️</span>
          <span class="tf-vote-name">${escapeHtml(p.name)}</span>
          <span class="tf-vote-label">Pas de vote</span>
          <span class="tf-vote-pts" style="color:var(--text-muted)">0 pt</span>
        </div>`;
      }
      const isCorrect = vote === correct;
      const cls = isCorrect ? 'tf-vote-correct' : 'tf-vote-wrong';
      const icon = vote === 'V' ? '✅' : '❌';
      const pts = isCorrect ? '+3' : '-2';
      const ptsCls = isCorrect ? 'pts-pos' : 'pts-neg';
      return `<div class="party-tf-vote-row ${cls}">
        <span class="tf-vote-icon">${icon}</span>
        <span class="tf-vote-name">${escapeHtml(p.name)}</span>
        <span class="tf-vote-label">${vote === 'V' ? 'VRAI' : 'FAUX'}</span>
        <span class="tf-vote-pts ${ptsCls}">${pts} pts</span>
      </div>`;
    }).join('');
}

// ─── Fin de mini-jeu ──────────────────────────────────────────────────────────

/**
 * Affiche le récap de fin de mini-jeu.
 * @param {{ mini:string, miniScores:object, scores:object }} data
 * @param {Array<{id,name,score}>} players
 */
export function renderPartyMiniEnd(data, players) {
  showPartyPanel('phase-party-mini-end');
  const board = el('streak-board');
  if (board) board.hidden = true;

  setText('party-mini-end-title',
    `${PARTY_MINI_LABELS[data.mini] ?? data.mini} — Résultats`);

  const container = el('party-mini-end-scores');
  if (!container) return;

  // Trier par score total
  const sorted = [...players]
    .map(p => ({
      ...p,
      miniPts: data.miniScores?.[p.id] ?? null,
      total: data.scores?.[p.id] ?? p.score,
    }))
    .sort((a, b) => b.total - a.total);

  container.innerHTML = sorted.map((p, i) => {
    const medal = ['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`;
    const isWinner = i === 0;
    const miniStr = p.miniPts !== null ? ` (+${p.miniPts} pts ce mini)` : '';
    return `<div class="party-mini-end-row${isWinner ? ' end-winner' : ''}">
      <span class="party-mini-end-rank">${medal}</span>
      <span class="party-mini-end-name">${escapeHtml(p.name)}</span>
      <span class="party-mini-end-pts">${p.total} pts${miniStr}</span>
    </div>`;
  }).join('');
}

// ─── RACE UI ──────────────────────────────────────────────────────────────────

/**
 * Affiche la question RACE (course classique).
 * @param {{ text, choices, index, total, answers, correctAnswer? }} data
 * @param {boolean} isHost
 * @param {function(string)|null} onChoice
 */
export function renderPartyRaceQuestion(data, isHost, onChoice) {
  showPartyPanel('phase-party-race');
  const panel = el('phase-party-race');
  if (!panel) return;

  const answeredCount = Object.keys(data.answers ?? {}).length;

  panel.innerHTML = `
    <div class="party-question-counter">🏁 Course — Question ${data.index + 1} / ${data.total}</div>
    <div class="party-question-text">${escapeHtml(data.text)}</div>
    ${data.correctAnswer
      ? `<p class="party-correct-answer">✅ Réponse : <strong>${escapeHtml(data.correctAnswer)}</strong></p>`
      : ''
    }
    <div id="party-race-choices" class="party-choices-grid"></div>
    <p class="party-race-info">${answeredCount} joueur${answeredCount !== 1 ? 's' : ''} ont répondu</p>
  `;
  renderPartyChoiceGrid('party-race-choices', data.choices ?? [], isHost ? null : onChoice, !!data.correctAnswer);
}

export function renderPartyRaceReveal(data, players) {
  showPartyPanel('phase-party-race');
  const panel = el('phase-party-race');
  if (!panel) return;

  const results = data.results ?? {};
  const sorted = Object.entries(results)
    .map(([pid, r]) => ({ pid, ...r, name: players.find(p => p.id === pid)?.name ?? pid }))
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));

  const rows = sorted.map(r => {
    const sign = r.pts > 0 ? '+' : '';
    const cls = r.correct ? 'race-correct' : 'race-wrong';
    return `<div class="party-race-result-row ${cls}">
      <span>${escapeHtml(r.name)}</span>
      <span>${r.correct ? `🏁 ${r.rank}${r.rank === 1 ? 'er' : 'e'}` : '❌'}</span>
      <span class="race-pts">${sign}${r.pts} pts</span>
    </div>`;
  }).join('');

  panel.innerHTML = `
    <div class="party-question-counter">🏁 Course — Résultats</div>
    <p class="party-correct-answer">✅ Réponse : <strong>${escapeHtml(data.correctAnswer ?? '')}</strong></p>
    <div class="party-race-results">${rows}</div>
  `;
}

// ─── BLITZ UI ─────────────────────────────────────────────────────────────────

/**
 * Affiche la question BLITZ (QCM ultra-rapide).
 */
export function renderPartyBlitzQuestion(data, isHost, onChoice) {
  showPartyPanel('phase-party-blitz');
  const panel = el('phase-party-blitz');
  if (!panel) return;

  const answeredCount = Object.keys(data.answers ?? {}).length;

  panel.innerHTML = `
    <div class="party-question-counter">💨 Blitz — Question ${data.index + 1} / ${data.total}</div>
    <div class="party-blitz-timer-hint">⚡ 5 secondes !</div>
    <div class="party-question-text">${escapeHtml(data.text)}</div>
    ${data.correctAnswer
      ? `<p class="party-correct-answer">✅ Réponse : <strong>${escapeHtml(data.correctAnswer)}</strong></p>`
      : ''
    }
    <div id="party-blitz-choices" class="party-choices-grid"></div>
    <p class="party-blitz-info">${answeredCount} joueur${answeredCount !== 1 ? 's' : ''} ont répondu</p>
  `;
  renderPartyChoiceGrid('party-blitz-choices', data.choices ?? [], isHost ? null : onChoice, !!data.correctAnswer);
}

export function renderPartyBlitzReveal(data, players) {
  showPartyPanel('phase-party-blitz');
  const panel = el('phase-party-blitz');
  if (!panel) return;

  const results = data.results ?? {};
  const rows = Object.entries(results)
    .map(([pid, r]) => ({ pid, ...r, name: players.find(p => p.id === pid)?.name ?? pid }))
    .sort((a, b) => b.pts - a.pts)
    .map(r => {
      const sign = r.pts > 0 ? '+' : '';
      return `<div class="party-race-result-row ${r.correct ? 'race-correct' : 'race-wrong'}">
        <span>${escapeHtml(r.name)}</span>
        <span>${r.correct ? '✅' : (r.choice ? '❌' : '—')}</span>
        <span class="race-pts">${sign}${r.pts} pts</span>
      </div>`;
    }).join('');

  panel.innerHTML = `
    <div class="party-question-counter">💨 Blitz — Résultats</div>
    <p class="party-correct-answer">✅ Réponse : <strong>${escapeHtml(data.correctAnswer ?? '')}</strong></p>
    <div class="party-race-results">${rows}</div>
  `;
}

// ─── CAROUSEL UI ──────────────────────────────────────────────────────────────

/**
 * Affiche la phase CAROUSEL (tour à tour).
 * @param {{ activePlayer, activePlayerName, text, choices, showQuestion, index, total, correctAnswer? }} data
 * @param {string} myId
 * @param {boolean} isHost
 * @param {function(string)|null} onChoice
 */
export function renderPartyCarouselQuestion(data, myId, isHost, onChoice) {
  showPartyPanel('phase-party-carousel');
  const panel = el('phase-party-carousel');
  if (!panel) return;

  const isMyTurn = data.activePlayer === myId;

  if (!data.showQuestion) {
    panel.innerHTML = `
      <div class="party-question-counter">🎠 Carrousel — Question ${(data.index ?? 0) + 1} / ${data.total}</div>
      <div class="party-carousel-assign">
        <div class="carousel-player-spot">${isMyTurn ? '🎯 C\'est votre tour !' : `⏳ Au tour de <strong>${escapeHtml(data.activePlayerName)}</strong>`}</div>
        <p class="carousel-hint">Préparez-vous…</p>
      </div>
    `;
    return;
  }

  panel.innerHTML = `
    <div class="party-question-counter">🎠 Carrousel — Question ${(data.index ?? 0) + 1} / ${data.total}</div>
    <div class="carousel-active-indicator">${isMyTurn ? '🎯 À vous de jouer !' : `👁️ ${escapeHtml(data.activePlayerName)} répond…`}</div>
    <div class="party-question-text">${escapeHtml(data.text)}</div>
    ${data.correctAnswer
      ? `<p class="party-correct-answer">✅ Réponse : <strong>${escapeHtml(data.correctAnswer)}</strong></p>`
      : ''
    }
    <div id="party-carousel-choices" class="party-choices-grid"></div>
  `;

  const canClick = (isMyTurn || isHost) && !data.correctAnswer;
  renderPartyChoiceGrid('party-carousel-choices', data.choices ?? [], canClick ? onChoice : null, !canClick || !!data.correctAnswer);

  if (!isMyTurn && !isHost) {
    const grid = el('party-carousel-choices');
    if (grid) grid.querySelectorAll('.choice-btn').forEach(b => { b.disabled = true; });
  }
}

export function renderPartyCarouselReveal(data, players) {
  showPartyPanel('phase-party-carousel');
  const panel = el('phase-party-carousel');
  if (!panel) return;

  const activeName = players.find(p => p.id === data.activePlayer)?.name ?? '';
  const sign = data.pts > 0 ? '+' : '';

  panel.innerHTML = `
    <div class="party-question-counter">🎠 Carrousel — Résultat</div>
    <div class="carousel-active-indicator">👤 ${escapeHtml(activeName)}</div>
    <p class="party-correct-answer">✅ Réponse : <strong>${escapeHtml(data.correctAnswer ?? '')}</strong></p>
    <div class="party-carousel-result ${data.correct ? 'race-correct' : (data.choice ? 'race-wrong' : '')}">
      ${data.choice ? escapeHtml(data.choice) : '— (pas de réponse)'}
      <span class="race-pts"> ${sign}${data.pts} pts</span>
    </div>
  `;
}

// ─── Phase betting (pari secret) ──────────────────────────────────────────────

/**
 * Affiche le panneau de pari secret pour le joueur.
 * @param {{ myScore: number, betCount: number, total: number, deadline: number }} data
 * @param {Function} onBet — appelé avec le montant du pari
 */
export function renderBettingPhase(data, onBet) {
  const panel = el('phase-betting');
  if (!panel) return;

  const remaining = Math.max(0, Math.round((data.deadline - Date.now()) / 1000));
  const hasBet = data.myBet != null;

  panel.innerHTML = `
    <div class="betting-header">
      <span class="betting-icon">🎲</span>
      <span class="betting-title">Pari secret</span>
    </div>
    <p class="betting-desc">Misez des points avant que la question ne soit jouée !</p>
    <p class="betting-count">${data.betCount} / ${data.total} joueur${data.total > 1 ? 's' : ''} ont parié</p>
    ${hasBet
      ? `<p class="betting-placed">✅ Votre pari : <strong>${data.myBet} pts</strong></p>`
      : `<div class="betting-form">
          <input id="bet-input" class="input bet-input" type="number" min="0" max="${data.myScore}"
            placeholder="0 – ${data.myScore} pts" value="0">
          <button id="btn-place-bet" class="btn btn-primary">💸 Parier</button>
        </div>`
    }
  `;

  if (!hasBet && onBet) {
    const btn = panel.querySelector('#btn-place-bet');
    const inp = panel.querySelector('#bet-input');
    if (btn && inp) {
      btn.addEventListener('click', () => {
        const amount = Math.max(0, Math.min(parseInt(inp.value ?? '0', 10) || 0, data.myScore));
        onBet(amount);
      });
    }
  }
}

// ─── Phase draft ───────────────────────────────────────────────────────────────

/**
 * Affiche le panneau de draft des catégories.
 * @param {{ picks, currentPicker, categories, round, totalRounds, myId, players }} data
 * @param {Function} onPick — appelé avec la catégorie choisie
 */
export function renderDraftPhase(data, onPick) {
  const panel = el('phase-draft');
  if (!panel) return;

  const isMyTurn = data.currentPicker === data.myId;
  const currentPlayerName = data.players?.find(p => p.id === data.currentPicker)?.name ?? '…';

  const picksList = Object.entries(data.picks ?? {}).map(([pid, cats]) => {
    const pname = data.players?.find(p => p.id === pid)?.name ?? pid;
    const catLabels = cats.map(c => CATEGORY_LABELS[c] ?? c).join(', ') || '—';
    return `<div class="draft-pick-row">
      <span class="draft-picker-name">${escapeHtml(pname)}</span>
      <span class="draft-picks-cats">${escapeHtml(catLabels)}</span>
    </div>`;
  }).join('');

  panel.innerHTML = `
    <div class="draft-header">
      <span class="draft-icon">📋</span>
      <span class="draft-title">Draft de catégories</span>
    </div>
    <p class="draft-turn">${isMyTurn
      ? '🎯 C\'est votre tour de choisir !'
      : `⏳ ${escapeHtml(currentPlayerName)} choisit…`
    }</p>
    ${picksList ? `<div class="draft-picks-list">${picksList}</div>` : ''}
    ${isMyTurn && data.categories?.length > 0
      ? `<div class="draft-cats-grid">${
          data.categories.map(c => `
            <button class="draft-cat-btn chip-btn" data-cat="${escapeHtml(c)}">
              ${escapeHtml(CATEGORY_LABELS[c] ?? c)}
            </button>
          `).join('')
        }</div>`
      : ''
    }
  `;

  if (isMyTurn && onPick) {
    panel.querySelectorAll('.draft-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => onPick(btn.dataset.cat));
    });
  }
}

// ─── Panneau "Double ou rien" ─────────────────────────────────────────────────

/**
 * Affiche (ou cache) le bouton "Double ou rien" pendant la phase de réponse.
 * @param {{ canDouble: boolean, alreadyDoubled: boolean, myScore: number }} data
 * @param {Function} onDoubleDown
 */
export function renderDoubleOrNothingButton(data, onDoubleDown) {
  const btn = el('btn-double-down');
  if (!btn) return;

  if (!data.canDouble || data.myScore <= 0) {
    btn.hidden = true;
    return;
  }
  btn.hidden = false;
  btn.disabled = data.alreadyDoubled;
  btn.textContent = data.alreadyDoubled ? '💸 Double ou rien (activé !)' : '💸 Double ou rien ?';
  btn.className = `btn ${data.alreadyDoubled ? 'btn-warning' : 'btn-danger'} btn-sm`;

  if (!data.alreadyDoubled && onDoubleDown) {
    btn.onclick = () => onDoubleDown();
  }
}

// ─── Sélecteur de cible cachée ────────────────────────────────────────────────

/**
 * Affiche le sélecteur de cible cachée.
 * @param {{ players, myId, selectedTarget: string|null }} data
 * @param {Function} onTarget
 */
export function renderTargetSelector(data, onTarget) {
  const container = el('target-selector');
  if (!container) return;

  const others = (data.players ?? []).filter(p => p.id !== data.myId && p.id !== '__host__');
  if (others.length === 0) { container.hidden = true; return; }

  container.hidden = false;
  container.innerHTML = `
    <div class="target-title">🎯 Choisir une cible secrète</div>
    <div class="target-players">
      ${others.map(p => `
        <button class="target-btn ${data.selectedTarget === p.id ? 'target-selected' : ''}"
          data-target="${escapeHtml(p.id)}">
          ${escapeHtml(p.name)}
        </button>
      `).join('')}
    </div>
    ${data.selectedTarget
      ? `<p class="target-chosen">✅ Cible choisie</p>`
      : `<p class="target-hint">Si vous gagnez plus que votre cible : +5 pts bonus !</p>`
    }
  `;

  if (onTarget) {
    container.querySelectorAll('.target-btn').forEach(btn => {
      btn.addEventListener('click', () => onTarget(btn.dataset.target));
    });
  }
}

// ─── Panneau des pouvoirs ─────────────────────────────────────────────────────

/**
 * Affiche les boutons de pouvoir dans la sidebar.
 * @param {{ myId, players, currentIndex, powerCooldowns, powers }} data
 * @param {Function} onUsePower
 */
export function renderPowers(data, onUsePower) {
  const container = el('powers-panel');
  if (!container) return;

  const cooldowns = data.powerCooldowns ?? {};
  const powersHtml = Object.values(POWER).map(power => {
    const lastUsed = cooldowns[power] ?? -(POWER_COOLDOWN + 1);
    const remaining = POWER_COOLDOWN - (data.currentIndex - lastUsed);
    const onCooldown = remaining > 0;
    return `
      <div class="power-item">
        <button class="btn power-btn ${onCooldown ? 'power-cooldown' : 'btn-secondary btn-sm'}"
          data-power="${escapeHtml(power)}"
          ${onCooldown ? 'disabled' : ''}
          title="${escapeHtml(POWER_DESCRIPTIONS[power])}">
          ${POWER_LABELS[power]}
          ${onCooldown ? `<span class="power-cd">(${remaining}q)</span>` : ''}
        </button>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="card-title">⚡ Pouvoirs</div>
    <div class="powers-list">${powersHtml}</div>
  `;

  container.querySelectorAll('.power-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!onUsePower) return;
      const power = btn.dataset.power;
      // Ouvrir le sélecteur de cible pour ce pouvoir
      showPowerTargetPicker(data, power, onUsePower);
    });
  });
}

function showPowerTargetPicker(data, power, onUsePower) {
  // Supprimer un éventuel picker existant
  document.getElementById('power-target-picker')?.remove();

  const others = (data.players ?? []).filter(p => p.id !== data.myId);
  if (others.length === 0) return;

  const picker = document.createElement('div');
  picker.id = 'power-target-picker';
  picker.className = 'power-target-picker';
  picker.innerHTML = `
    <div class="power-picker-title">${POWER_LABELS[power]} — Choisir la cible</div>
    <div class="power-picker-list">
      ${others.map(p => `
        <button class="btn btn-secondary btn-sm power-target-btn" data-target="${escapeHtml(p.id)}">
          ${escapeHtml(p.name)}
        </button>
      `).join('')}
    </div>
    <button class="btn btn-sm power-picker-cancel">✕ Annuler</button>
  `;

  picker.querySelector('.power-picker-cancel').addEventListener('click', () => picker.remove());
  picker.querySelectorAll('.power-target-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      onUsePower(power, btn.dataset.target);
      picker.remove();
    });
  });

  document.body.appendChild(picker);
}

// ─── Notification d'effet de pouvoir ──────────────────────────────────────────

export function showPowerEffectNotification(power, byName, targetName) {
  const existing = document.getElementById('power-effect-notif');
  if (existing) existing.remove();

  const notif = document.createElement('div');
  notif.id = 'power-effect-notif';
  notif.className = 'power-effect-notif';
  notif.textContent = `⚡ ${escapeHtml(byName)} utilise ${POWER_LABELS[power]} sur ${escapeHtml(targetName)} !`;
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 3000);
}

// ─── Révélation des paris / cibles en fin de question ─────────────────────────

/**
 * Affiche les paris révélés et les bonus de cible dans la phase QUESTION_END.
 * @param {{ betReveal, targetsReveal, players }} data
 */
export function renderQuestionEndExtras(data) {
  const betContainer = el('bet-reveal');
  if (betContainer) {
    if (data.betReveal && Object.keys(data.betReveal).length > 0) {
      const rows = Object.entries(data.betReveal).map(([pid, amount]) => {
        const name = data.players?.find(p => p.id === pid)?.name ?? pid;
        return `<div class="bet-reveal-row">
          <span>${escapeHtml(name)}</span>
          <span class="bet-reveal-amount">${amount} pts pariés</span>
        </div>`;
      }).join('');
      betContainer.innerHTML = `<div class="bet-reveal-title">🎲 Paris révélés</div>${rows}`;
      betContainer.hidden = false;
    } else {
      betContainer.hidden = true;
    }
  }

  const targetsContainer = el('targets-reveal');
  if (targetsContainer) {
    if (data.targetsReveal && Object.keys(data.targetsReveal.targets ?? {}).length > 0) {
      const { targets, bonuses } = data.targetsReveal;
      const rows = Object.entries(targets).map(([pid, tid]) => {
        const pname = data.players?.find(p => p.id === pid)?.name ?? pid;
        const tname = data.players?.find(p => p.id === tid)?.name ?? tid;
        const bonus = bonuses?.[pid];
        return `<div class="target-reveal-row">
          <span>${escapeHtml(pname)}</span>
          <span class="target-reveal-arrow">→</span>
          <span>${escapeHtml(tname)}</span>
          ${bonus ? `<span class="target-reveal-bonus">+${bonus} pts 🎯</span>` : ''}
        </div>`;
      }).join('');
      targetsContainer.innerHTML = `<div class="targets-reveal-title">🎯 Cibles révélées</div>${rows}`;
      targetsContainer.hidden = false;
    } else {
      targetsContainer.hidden = true;
    }
  }
}
