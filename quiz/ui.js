/**
 * ui.js — Rendu DOM / mise à jour de l'interface Quiz
 */

import { PHASE, MODE, MODE_LABELS, MODE_DESCRIPTIONS, CATEGORY_LABELS, DIFFICULTY_LABELS, QUESTION_COUNTS, ANSWER_TIMES } from './constants.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function show(id) {
  const el = document.getElementById(id);
  if (el) el.hidden = false;
}

export function hide(id) {
  const el = document.getElementById(id);
  if (el) el.hidden = true;
}

export function showOnly(screenId) {
  document.querySelectorAll('[data-screen]').forEach(el => {
    el.hidden = el.dataset.screen !== screenId;
  });
}

function el(id) { return document.getElementById(id); }

function setText(id, text) {
  const e = el(id);
  if (e) e.textContent = text;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── Setup (hôte) ─────────────────────────────────────────────────────────────

/**
 * Initialise les contrôles de configuration et retourne les valeurs
 * via le callback onChange à chaque changement.
 */
export function renderSetupForm(defaults, onChange) {
  // Mode de jeu
  const modeContainer = el('mode-selector');
  if (modeContainer) {
    modeContainer.innerHTML = Object.entries(MODE_LABELS).map(([mode, label]) => `
      <label class="mode-option ${defaults.mode === mode ? 'selected' : ''}">
        <input type="radio" name="game-mode" value="${mode}" ${defaults.mode === mode ? 'checked' : ''}>
        <span class="mode-label">${label}</span>
        <span class="mode-desc">${MODE_DESCRIPTIONS[mode]}</span>
      </label>
    `).join('');

    modeContainer.querySelectorAll('input[name="game-mode"]').forEach(input => {
      input.addEventListener('change', () => {
        modeContainer.querySelectorAll('.mode-option').forEach(l => l.classList.remove('selected'));
        input.parentElement.classList.add('selected');
        onChange({ mode: input.value });
      });
    });
  }

  // Catégorie
  const catSelect = el('category-select');
  if (catSelect) {
    catSelect.innerHTML = Object.entries(CATEGORY_LABELS).map(([val, label]) =>
      `<option value="${val}" ${defaults.category === val ? 'selected' : ''}>${label}</option>`
    ).join('');
    catSelect.addEventListener('change', () => onChange({ category: catSelect.value }));
  }

  // Difficulté
  const diffSelect = el('difficulty-select');
  if (diffSelect) {
    diffSelect.innerHTML = Object.entries(DIFFICULTY_LABELS).map(([val, label]) =>
      `<option value="${val}" ${defaults.difficulty === val ? 'selected' : ''}>${label}</option>`
    ).join('');
    diffSelect.addEventListener('change', () => onChange({ difficulty: diffSelect.value }));
  }

  // Nombre de questions
  const countSelect = el('question-count-select');
  if (countSelect) {
    countSelect.innerHTML = QUESTION_COUNTS.map(n =>
      `<option value="${n}" ${defaults.questionCount === n ? 'selected' : ''}>${n} questions</option>`
    ).join('');
    countSelect.addEventListener('change', () => onChange({ questionCount: Number(countSelect.value) }));
  }

  // Timer de réponse
  const timeSelect = el('answer-time-select');
  if (timeSelect) {
    timeSelect.innerHTML = ANSWER_TIMES.map(s =>
      `<option value="${s}" ${defaults.answerTime === s ? 'selected' : ''}>${s}s</option>`
    ).join('');
    timeSelect.addEventListener('change', () => onChange({ answerTime: Number(timeSelect.value) }));
  }

  // Checkbox "Voir la réponse (hôte)"
  const showAns = el('show-answer-host');
  if (showAns) {
    showAns.checked = defaults.showAnswerToHost ?? false;
    showAns.addEventListener('change', () => onChange({ showAnswerToHost: showAns.checked }));
  }

  // Checkbox "Mode malus"
  const malusCheck = el('apply-malus');
  if (malusCheck) {
    malusCheck.checked = defaults.applyMalus ?? false;
    malusCheck.addEventListener('change', () => onChange({ applyMalus: malusCheck.checked }));
  }
}

// ─── Lien de partage ──────────────────────────────────────────────────────────

export function renderShareLink(hostPeerId) {
  const url = `${location.origin}${location.pathname}?host=${hostPeerId}`;
  const linkEl = el('share-link');
  if (linkEl) linkEl.value = url;

  const qrEl = el('share-qr');
  if (qrEl) {
    qrEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}`;
    qrEl.alt = 'QR code de la partie';
  }

  const copyBtn = el('btn-copy-link');
  if (copyBtn) {
    copyBtn.onclick = () => {
      navigator.clipboard?.writeText(url).catch(() => {});
      copyBtn.textContent = '✅ Copié !';
      setTimeout(() => { copyBtn.textContent = '📋 Copier'; }, 2000);
    };
  }
}

// ─── Lobby ────────────────────────────────────────────────────────────────────

export function renderLobbyPlayers(players, isHost, onKick) {
  const list = el('lobby-players-list');
  if (!list) return;
  list.innerHTML = players.map(p => `
    <li class="player-item ${p.ready ? 'ready' : ''}">
      <span class="player-name">${escapeHtml(p.name)}${p.id === '__host__' ? ' 👑' : ''}</span>
      <span class="player-status">${p.ready ? '✅ Prêt' : '⏳ En attente'}</span>
      ${isHost && p.id !== '__host__' ? `<button class="btn-icon btn-danger" data-kick="${escapeHtml(p.id)}" title="Exclure">✕</button>` : ''}
    </li>
  `).join('');

  if (isHost && onKick) {
    list.querySelectorAll('[data-kick]').forEach(btn => {
      btn.addEventListener('click', () => onKick(btn.dataset.kick));
    });
  }
}

// ─── Scoreboard ───────────────────────────────────────────────────────────────

export function renderScoreboard(players) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const board = el('scoreboard');
  if (!board) return;

  board.innerHTML = sorted.map((p, i) => `
    <div class="score-row rank-${i + 1}">
      <span class="score-rank">${['🥇', '🥈', '🥉'][i] ?? (i + 1) + '.'}</span>
      <span class="score-name">${escapeHtml(p.name)}</span>
      <span class="score-pts">${p.score} pts</span>
    </div>
  `).join('');
}

// ─── Phase de jeu ─────────────────────────────────────────────────────────────

export function renderGamePhase(phase, data, isHost) {
  // Masquer tous les panneaux de phase
  [
    'phase-question-preview', 'phase-buzzing', 'phase-answering',
    'phase-answer-result', 'phase-question-end',
  ].forEach(id => hide(id));

  // Compteur de questions
  const counter = el('question-counter');
  if (counter && data.currentIndex != null && data.total != null) {
    const n = data.currentIndex + 1;
    counter.textContent = `Question ${n} / ${data.total}`;
    counter.hidden = false;
  }

  // Catégorie / difficulté
  const q = data.currentQuestion;
  const metaEl = el('question-meta');
  if (metaEl && q) {
    const cat = CATEGORY_LABELS[q.category] ?? q.category ?? '';
    const diff = DIFFICULTY_LABELS[q.difficulty] ?? q.difficulty ?? '';
    metaEl.textContent = [cat, diff].filter(Boolean).join(' · ');
    metaEl.hidden = false;
  }

  switch (phase) {
    case PHASE.QUESTION_PREVIEW:
      show('phase-question-preview');
      renderQuestion(q, data);
      break;

    case PHASE.BUZZING:
      show('phase-question-preview');
      show('phase-buzzing');
      renderQuestion(q, data);
      {
        const buzzBtn = el('btn-buzz');
        if (buzzBtn) buzzBtn.disabled = !data.canBuzz;
      }
      break;

    case PHASE.ANSWERING:
      show('phase-question-preview');
      if (data.mode === MODE.QCM) {
        show('phase-answering');
        renderChoices(q?.choices ?? [], data.onChoiceClick, data.eliminatedPlayers ?? []);
      } else {
        const isCurrent = data.buzzQueue?.[0] === data.myId;
        show('phase-buzzing');
        const buzzBtn = el('btn-buzz');
        if (buzzBtn) buzzBtn.disabled = true;

        if (isCurrent) {
          show('phase-answering');
          const inp = el('answer-input');
          if (inp) {
            inp.disabled = false;
            inp.focus();
          }
        }

        // Afficher la file d'attente
        const queueEl = el('buzz-queue');
        if (queueEl && data.buzzQueue?.length) {
          const names = data.buzzQueue
            .map(id => data.players?.find(p => p.id === id)?.name)
            .filter(Boolean);
          const first = names[0] ?? '';
          const waiting = names.slice(1);
          const firstHtml = `<strong>🔔 ${escapeHtml(first)}</strong> répond…`;
          const waitHtml = waiting.length
            ? `<span class="buzz-waiting">En attente : ${waiting.map(n => escapeHtml(n)).join(', ')}</span>`
            : '';
          queueEl.innerHTML = firstHtml + (waitHtml ? `<br>${waitHtml}` : '');
          queueEl.hidden = false;
        }
      }
      break;

    case PHASE.ANSWER_RESULT: {
      show('phase-question-preview');
      show('phase-answer-result');
      const r = data.lastResult;
      const resultText = el('result-text');
      const resultAnswer = el('result-answer');
      if (resultText) {
        if (r?.correct) {
          const speedBonus = r.speedBonus ?? 0;
          const bonusStr = speedBonus > 0 ? ` ⚡+${speedBonus}` : '';
          const pts = r.points > 0 ? ` (+${r.points} pts${bonusStr})` : '';
          const scorer = data.players?.find(p => p.id === r.playerId);
          const scorerName = scorer ? escapeHtml(scorer.name) : '';
          resultText.innerHTML = `<span class="result-correct">✅ Correct !${pts}</span>${scorerName ? `<br><span class="result-scorer">${scorerName}</span>` : ''}`;
        } else if (r?.nearMiss) {
          const malusStr = r.points < 0 ? ` (${r.points} pts)` : '';
          resultText.innerHTML = `<span class="result-near">🤏 Presque !${malusStr}</span>`;
        } else {
          const malusStr = r?.points < 0 ? ` (${r.points} pts)` : '';
          resultText.innerHTML = `<span class="result-wrong">❌ Mauvaise réponse${malusStr}</span>`;
        }
      }
      if (resultAnswer) {
        resultAnswer.textContent = r?.answer ? `« ${r.answer} »` : '';
      }
      break;
    }

    case PHASE.QUESTION_END: {
      show('phase-question-preview');
      show('phase-question-end');
      const q2 = data.currentQuestion;
      const answerReveal = el('correct-answer-reveal');
      if (answerReveal && q2) {
        answerReveal.textContent = q2.correctAnswer;
      }
      const skipBadge = el('skipped-badge');
      if (skipBadge) skipBadge.hidden = !data.lastResult?.skipped;
      // Bouton "Suivant" visible uniquement pour l'hôte
      const nextBtn = el('btn-next-question');
      if (nextBtn) nextBtn.hidden = !isHost;
      break;
    }
  }
}

function renderQuestion(q, data) {
  if (!q) return;
  setText('question-text', q.text);
  // Afficher la bonne réponse à l'hôte si option activée
  const hostAnswer = el('host-answer-hint');
  if (hostAnswer) {
    if (data.showAnswerToHost) {
      hostAnswer.textContent = `🔑 ${q.correctAnswer}`;
      hostAnswer.hidden = false;
    } else {
      hostAnswer.hidden = true;
    }
  }
}

function renderChoices(choices, onChoiceClick, eliminatedPlayers) {
  const grid = el('choices-grid');
  if (!grid) return;
  grid.innerHTML = choices.map(c => {
    const eliminated = eliminatedPlayers.includes('__self__'); // géré côté client
    return `<button class="choice-btn" data-choice="${escapeHtml(c)}"${eliminated ? ' disabled' : ''}>${escapeHtml(c)}</button>`;
  }).join('');

  if (onChoiceClick) {
    grid.querySelectorAll('.choice-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => onChoiceClick(btn.dataset.choice));
    });
  }
}

export function highlightChoices(correctAnswer, wrongChoice) {
  document.querySelectorAll('.choice-btn').forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.choice === correctAnswer) {
      btn.classList.add('choice-correct');
    } else if (btn.dataset.choice === wrongChoice) {
      btn.classList.add('choice-wrong');
    }
  });
}

export function disableChoice(choice) {
  document.querySelectorAll('.choice-btn').forEach(btn => {
    if (btn.dataset.choice === choice) {
      btn.disabled = true;
      btn.classList.add('choice-eliminated');
    }
  });
}

// ─── Timer visuel ─────────────────────────────────────────────────────────────

let _timerInterval = null;
let _timerBar = null;
let _timerLabel = null;
let _timerLastSecond = null;

export function startTimerBar(durationMs, barId, startPct = 100, onTickSecond = null) {
  stopTimerBar();
  _timerBar = el(barId);
  if (!_timerBar) return;
  _timerLabel = el(barId + '-seconds');
  const startMs = (startPct / 100) * durationMs;
  const start = Date.now();
  _timerBar.style.width = startPct + '%';
  const initSec = Math.ceil(startMs / 1000);
  if (_timerLabel) _timerLabel.textContent = initSec + 's';
  _timerLastSecond = initSec;

  _timerInterval = setInterval(() => {
    const elapsed = Date.now() - start;
    const remaining = Math.max(0, startMs - elapsed);
    const pct = Math.max(0, startPct * (1 - elapsed / durationMs));
    _timerBar.style.width = pct + '%';
    const sec = Math.ceil(remaining / 1000);
    if (_timerLabel) _timerLabel.textContent = sec + 's';
    if (onTickSecond && sec !== _timerLastSecond && sec <= 3 && sec > 0) {
      onTickSecond(sec);
    }
    _timerLastSecond = sec;
    if (pct <= 0) stopTimerBar();
  }, 50);
}

export function stopTimerBar() {
  clearInterval(_timerInterval);
  _timerInterval = null;
  if (_timerBar) _timerBar.style.width = '0%';
  if (_timerLabel) _timerLabel.textContent = '';
  _timerLabel = null;
  _timerLastSecond = null;
}

// ─── Flash buzz ───────────────────────────────────────────────────────────────

export function flashBuzz() {
  document.body.classList.add('buzz-flash');
  setTimeout(() => document.body.classList.remove('buzz-flash'), 600);
  if (navigator.vibrate) navigator.vibrate(150);
}

// ─── Résultats finaux ─────────────────────────────────────────────────────────

export function renderFinalResults(finalScores) {
  const container = el('final-results');
  if (!container) return;
  container.innerHTML = finalScores.map((p, i) => `
    <div class="final-row rank-${i + 1}">
      <span class="final-rank">${['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`}</span>
      <span class="final-name">${escapeHtml(p.name)}</span>
      <span class="final-score">${p.score} pts</span>
    </div>
  `).join('');
}

// ─── Toast / notification ─────────────────────────────────────────────────────

export function showToast(message, type = 'info') {
  const existing = document.getElementById('quiz-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'quiz-toast';
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ─── Status de chargement ─────────────────────────────────────────────────────

export function setLoadingStatus(message) {
  setText('loading-status', message);
}
