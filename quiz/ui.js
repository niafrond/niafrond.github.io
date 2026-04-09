/**
 * ui.js — Rendu DOM / mise à jour de l'interface Quiz
 */

import { PHASE, MODE, MODE_LABELS, MODE_DESCRIPTIONS, CATEGORY_LABELS, DIFFICULTY_LABELS, QUESTION_COUNTS, ANSWER_TIMES, POWER, POWER_LABELS, POWER_DESCRIPTIONS, POWER_COOLDOWN } from './constants.js';
import { PARTY_MINI, PARTY_MINI_LABELS } from './party-game.js';

// ─── Chip multi-picker ───────────────────────────────────────────────────────

/**
 * Rendre un sélecteur multi-choix sous forme de chips cliquables.
 * @param {HTMLElement} container
 * @param {Record<string,string>} labelsObj  — valeur → libellé
 * @param {string[]} initialSelected
 * @param {function(string[]): void} onChange
 */
function renderChipPicker(container, labelsObj, initialSelected, onChange) {
  const entries = Object.entries(labelsObj).filter(([v]) => v !== '');
  container.innerHTML = entries.map(([val, label]) =>
    `<button type="button" class="chip-btn${initialSelected.includes(val) ? ' chip-active' : ''}" data-value="${escapeHtml(val)}">${label}</button>`
  ).join('');

  container.querySelectorAll('.chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('chip-active');
      const selected = [...container.querySelectorAll('.chip-btn.chip-active')].map(b => b.dataset.value);
      onChange(selected);
    });
  });
}

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
        // Afficher/masquer les options party
        const partyCard = el('party-options-card');
        if (partyCard) partyCard.hidden = input.value !== MODE.PARTY;
      });
    });

    // Afficher la carte party si le mode actuel est PARTY
    const partyCard = el('party-options-card');
    if (partyCard) partyCard.hidden = defaults.mode !== MODE.PARTY;
  }

  // Catégorie (chip multi-picker)
  const catPicker = el('category-picker');
  if (catPicker) {
    renderChipPicker(catPicker, CATEGORY_LABELS, defaults.categories ?? [], (selected) => {
      onChange({ categories: selected });
    });
  }

  // Difficulté (chip multi-picker)
  const diffPicker = el('difficulty-picker');
  if (diffPicker) {
    const diffOptions = Object.fromEntries(Object.entries(DIFFICULTY_LABELS).filter(([v]) => v !== ''));
    renderChipPicker(diffPicker, diffOptions, defaults.difficulties ?? [], (selected) => {
      onChange({ difficulties: selected });
    });
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

  // Checkbox "Mode hôte lecteur"
  const hostReaderCheck = el('host-is-reader');
  if (hostReaderCheck) {
    hostReaderCheck.checked = defaults.hostIsReader ?? false;
    hostReaderCheck.addEventListener('change', () => onChange({ hostIsReader: hostReaderCheck.checked }));
  }

  // ── Fonctionnalités spéciales ──────────────────────────────────────────────
  const comboStreakCheck = el('combo-streak');
  if (comboStreakCheck) {
    comboStreakCheck.checked = defaults.comboStreak ?? false;
    comboStreakCheck.addEventListener('change', () => onChange({ comboStreak: comboStreakCheck.checked }));
  }

  const doubleOrNothingCheck = el('double-or-nothing');
  if (doubleOrNothingCheck) {
    doubleOrNothingCheck.checked = defaults.doubleOrNothing ?? false;
    doubleOrNothingCheck.addEventListener('change', () => onChange({ doubleOrNothing: doubleOrNothingCheck.checked }));
  }

  const secretBetCheck = el('secret-bet');
  if (secretBetCheck) {
    secretBetCheck.checked = defaults.secretBet ?? false;
    secretBetCheck.addEventListener('change', () => onChange({ secretBet: secretBetCheck.checked }));
  }

  const hiddenTargetCheck = el('hidden-target');
  if (hiddenTargetCheck) {
    hiddenTargetCheck.checked = defaults.hiddenTarget ?? false;
    hiddenTargetCheck.addEventListener('change', () => onChange({ hiddenTarget: hiddenTargetCheck.checked }));
  }

  const powersCheck = el('powers-enabled');
  if (powersCheck) {
    powersCheck.checked = defaults.powers ?? false;
    powersCheck.addEventListener('change', () => onChange({ powers: powersCheck.checked }));
  }

  const draftCatsCheck = el('draft-categories');
  if (draftCatsCheck) {
    draftCatsCheck.checked = defaults.draftCategories ?? false;
    draftCatsCheck.addEventListener('change', () => onChange({ draftCategories: draftCatsCheck.checked }));
  }

  // Bouton "Thèmes aléatoires"
  if (catPicker) {
    const randomBtn = document.createElement('button');
    randomBtn.type = 'button';
    randomBtn.className = 'btn btn-secondary btn-sm random-themes-btn';
    randomBtn.innerHTML = '🎲 Thèmes aléatoires';
    randomBtn.addEventListener('click', () => {
      const keys = Object.keys(CATEGORY_LABELS).filter(k => k !== '');
      // Fisher-Yates shuffle
      for (let i = keys.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [keys[i], keys[j]] = [keys[j], keys[i]];
      }
      const count = 2 + Math.floor(Math.random() * 2); // 2 ou 3 catégories
      const picked = keys.slice(0, count);
      catPicker.querySelectorAll('.chip-btn').forEach(btn => {
        btn.classList.toggle('chip-active', picked.includes(btn.dataset.value));
      });
      onChange({ categories: picked });
    });
    catPicker.after(randomBtn);
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

export function renderScoreboard(players, hostIsReader = false) {
  const filtered = hostIsReader ? players.filter(p => p.id !== '__host__') : players;
  const sorted = [...filtered].sort((a, b) => b.score - a.score);
  const board = el('scoreboard');
  if (!board) return;

  board.innerHTML = sorted.map((p, i) => {
    const streakBadge = (p.streak ?? 0) >= 3
      ? `<span class="streak-badge" title="${p.streak} bonnes réponses consécutives !">🔥${p.streak}</span>`
      : '';
    return `
      <div class="score-row rank-${i + 1}">
        <span class="score-rank">${['🥇', '🥈', '🥉'][i] ?? (i + 1) + '.'}</span>
        <span class="score-name">${escapeHtml(p.name)}</span>
        ${streakBadge}
        <span class="score-pts">${p.score} pts</span>
      </div>
    `;
  }).join('');
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
    const catHtml = cat ? `<span class="category-badge">${escapeHtml(cat)}</span>` : '';
    const diffHtml = diff ? `<span class="diff-badge">${escapeHtml(diff)}</span>` : '';
    metaEl.innerHTML = [catHtml, diffHtml].filter(Boolean).join('');
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
        if (buzzBtn) {
          // En mode hôte lecteur, le bouton buzz est caché
          if (data.hostIsReader) {
            buzzBtn.hidden = true;
          } else {
            buzzBtn.hidden = false;
            buzzBtn.disabled = !data.canBuzz;
          }
        }
      }
      break;

    case PHASE.ANSWERING:
      show('phase-question-preview');
      if (data.mode === MODE.QCM) {
        hide('answer-form');
        hide('host-judge-buttons');
        show('phase-answering');
        if (data.hostIsReader) {
          // Hôte lecteur en QCM : afficher les choix et révéler immédiatement la bonne réponse
          renderChoices(q?.choices ?? [], null, []);
          if (q?.correctAnswer) {
            highlightChoices(q.correctAnswer, null);
          }
        } else {
          renderChoices(q?.choices ?? [], data.onChoiceClick, data.eliminatedPlayers ?? []);
        }
      } else {
        const isHostReader = data.hostIsReader;
        show('phase-buzzing');
        const buzzBtn = el('btn-buzz');
        if (buzzBtn) buzzBtn.disabled = true;

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

        if (isHostReader) {
          // Hôte lecteur : cacher le champ texte pour tous les joueurs
          hide('answer-form');
          if (isHost) {
            // Seul l'hôte voit les boutons Correct / Incorrect pour juger à l'oral
            show('phase-answering');
            show('host-judge-buttons');
            const judgeNameEl = el('judge-player-name');
            if (judgeNameEl && data.buzzQueue?.length) {
              const currentPlayer = data.players?.find(p => p.id === data.buzzQueue[0]);
              judgeNameEl.textContent = currentPlayer ? `🎙️ ${currentPlayer.name} répond à l'oral…` : '';
            }
          } else {
            hide('host-judge-buttons');
          }
        } else {
          hide('host-judge-buttons');
          show('answer-form');
          const isCurrent = data.buzzQueue?.[0] === data.myId;
          if (isCurrent) {
            show('phase-answering');
            const inp = el('answer-input');
            if (inp) {
              inp.disabled = false;
              inp.focus();
            }
          }
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
          const nearPlayer = data.players?.find(p => p.id === r?.playerId);
          const nearName = nearPlayer ? escapeHtml(nearPlayer.name) : '';
          resultText.innerHTML = `<span class="result-near">🤏 Presque !${malusStr}</span>${nearName ? `<br><span class="result-scorer">${nearName} était proche…</span>` : ''}`;
        } else {
          const malusStr = r?.points < 0 ? ` (${r.points} pts)` : '';
          const wrongPlayer = data.players?.find(p => p.id === r?.playerId);
          const wrongName = wrongPlayer ? escapeHtml(wrongPlayer.name) : '';
          resultText.innerHTML = `<span class="result-wrong">❌ Mauvaise réponse${malusStr}</span>${wrongName ? `<br><span class="result-scorer">${wrongName} s'est trompé</span>` : ''}`;
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
      // Trivia (anecdote) affiché à tous quand la réponse est révélée
      const triviaEl = el('question-trivia');
      if (triviaEl) {
        if (q2?.trivia) {
          triviaEl.textContent = `💡 ${q2.trivia}`;
          triviaEl.hidden = false;
        } else {
          triviaEl.hidden = true;
        }
      }
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
  // Afficher la bonne réponse à l'hôte si option activée ou mode hôte lecteur
  const hostAnswer = el('host-answer-hint');
  if (hostAnswer) {
    if (data.showAnswerToHost || data.hostIsReader) {
      hostAnswer.textContent = `🔑 ${q.correctAnswer}`;
      hostAnswer.hidden = false;
    } else {
      hostAnswer.hidden = true;
    }
  }
  // Afficher le trivia à l'hôte en mode hôte lecteur (visible dès la question)
  const triviaHint = el('host-trivia-hint');
  if (triviaHint) {
    if ((data.showAnswerToHost || data.hostIsReader) && q?.trivia) {
      triviaHint.textContent = `💡 ${q.trivia}`;
      triviaHint.hidden = false;
    } else {
      triviaHint.hidden = true;
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

// ─── Config preview (client lobby) ───────────────────────────────────────────

/**
 * Affiche le résumé de la configuration de la partie côté client dans le lobby.
 * @param {object} config — hostConfig reçu via MSG.LOBBY_CONFIG
 */
export function renderLobbyConfigPreview(config) {
  const container = el('lobby-config-preview');
  if (!container) return;

  const mode = config.mode ?? 'CLASSIC';
  const categories = config.categories ?? [];
  const difficulties = config.difficulties ?? [];
  const questionCount = config.questionCount ?? 10;
  const answerTime = config.answerTime ?? 15;
  const applyMalus = config.applyMalus ?? false;
  const hostIsReader = config.hostIsReader ?? false;

  const modeLabel = MODE_LABELS[mode] ?? mode;
  const catLabel = categories.length > 0
    ? categories.map(c => CATEGORY_LABELS[c] ?? c).join(', ')
    : 'Toutes';
  const diffLabel = difficulties.length > 0
    ? difficulties.map(d => DIFFICULTY_LABELS[d] ?? d).join(', ')
    : 'Toutes';

  const row = (label, value) =>
    `<div class="config-preview-row"><span class="config-preview-label">${label}</span><span class="config-preview-value">${escapeHtml(String(value))}</span></div>`;

  let html = row('Mode', modeLabel)
    + row('Catégories', catLabel)
    + row('Difficulté', diffLabel)
    + row('Questions', questionCount)
    + row('Timer réponse', `${answerTime}s`);
  if (applyMalus) html += row('Malus', '−3 pts / erreur');
  if (hostIsReader) html += row('Mode hôte', '🎙️ Lecteur');
  if (config.comboStreak) html += row('Combo streak', '🔥 Activé');
  if (config.doubleOrNothing) html += row('Double ou rien', '💸 Activé');
  if (config.secretBet) html += row('Pari secret', '🎲 Activé');
  if (config.hiddenTarget) html += row('Cible cachée', '🎯 Activé');
  if (config.powers) html += row('Pouvoirs', '⚡ Activé');
  if (config.draftCategories) html += row('Draft catégories', '📋 Activé');

  container.innerHTML = html;
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

// ─── Notification joueur erroné (QCM) ────────────────────────────────────────

export function showWrongPlayerNotification(playerName) {
  const existing = document.getElementById('wrong-player-notif');
  if (existing) existing.remove();

  const notif = document.createElement('div');
  notif.id = 'wrong-player-notif';
  notif.className = 'wrong-player-notif';
  notif.textContent = `❌ ${playerName} s'est trompé !`;
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 2500);
}

// ─── Status de chargement ─────────────────────────────────────────────────────

export function setLoadingStatus(message) {
  setText('loading-status', message);
}

// ─── Classement local (localStorage) ─────────────────────────────────────────

export function renderLeaderboard(entries, listId, cardId) {
  const card = cardId ? el(cardId) : null;
  const container = el(listId);
  if (!container) return;

  if (!entries || entries.length === 0) {
    if (card) card.hidden = true;
    container.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;text-align:center;padding:8px 0;">Aucun score enregistré</p>';
    return;
  }

  if (card) card.hidden = false;
  container.innerHTML = entries.slice(0, 10).map((e, i) => `
    <div class="leaderboard-row">
      <span class="lb-rank">${['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`}</span>
      <span class="lb-name">${escapeHtml(e.name)}</span>
      <span class="lb-score">${e.score} pts</span>
      <span class="lb-date">${escapeHtml(e.date ?? '')}</span>
    </div>
  `).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// ═══ PARTY mode UI ═══════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────────────────

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

  const minis = [];
  if (streakBox?.checked)   minis.push(PARTY_MINI.STREAK);
  if (duelBox?.checked)     minis.push(PARTY_MINI.DUEL);
  if (tfBox?.checked)       minis.push(PARTY_MINI.SPEED_TF);
  if (raceBox?.checked)     minis.push(PARTY_MINI.RACE);
  if (blitzBox?.checked)    minis.push(PARTY_MINI.BLITZ);
  if (carouselBox?.checked) minis.push(PARTY_MINI.CAROUSEL);

  // Si aucun sélectionné ou si mode "tout aléatoire" : retourner null pour utiliser le défaut aléatoire
  const allRandom = randBox?.checked ?? false;
  return {
    partyMinis:  minis.length ? minis : null,
    partyRandom: allRandom,
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
