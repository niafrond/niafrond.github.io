/**
 * ui.js — Rendu DOM / mise à jour de l'interface Quiz
 */

import { PHASE, MODE, MODE_LABELS, MODE_DESCRIPTIONS, MODE_MIN_PLAYERS, PARTY_MINI_MODES, CATEGORY_LABELS, DIFFICULTY_LABELS, QUESTION_COUNTS, ANSWER_TIMES } from './constants.js';

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

export function el(id) { return document.getElementById(id); }

export function setText(id, text) {
  const e = el(id);
  if (e) e.textContent = text;
}

export function escapeHtml(str) {
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
    let html = '';
    let separatorAdded = false;
    for (const [mode, label] of Object.entries(MODE_LABELS)) {
      if (!separatorAdded && PARTY_MINI_MODES.includes(mode)) {
        html += `<div class="mode-section-header" role="separator">— Mini-jeux Party (solo) —</div>`;
        separatorAdded = true;
      }
      html += `
      <label class="mode-option ${defaults.mode === mode ? 'selected' : ''}">
        <input type="radio" name="game-mode" value="${mode}" ${defaults.mode === mode ? 'checked' : ''}>
        <span class="mode-label">${label}</span>
        <span class="mode-desc">${MODE_DESCRIPTIONS[mode]}</span>
      </label>
    `;
    }
    modeContainer.innerHTML = html;

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

  // Checkbox "Mode animateur" (implique hostIsReader)
  const hostAnimateurCheck = el('host-is-animateur');
  if (hostAnimateurCheck) {
    hostAnimateurCheck.checked = !!(defaults.hostIsAnimateur || defaults.hostIsReader);
    hostAnimateurCheck.addEventListener('change', () => {
      const checked = hostAnimateurCheck.checked;
      onChange({ hostIsAnimateur: checked, hostIsReader: checked });
    });
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

// ─── Disponibilité des modes selon le nombre de joueurs ───────────────────────

/**
 * Grise les modes qui nécessitent plus de joueurs que présents.
 * Si le mode actuellement sélectionné devient indisponible, bascule sur CLASSIC
 * et appelle onForceChange avec la nouvelle valeur.
 * @param {number} playerCount
 * @param {function(string): void} [onForceChange]
 */
export function updateModeAvailability(playerCount, onForceChange) {
  const modeContainer = el('mode-selector');
  if (!modeContainer) return;

  let selectedModeDisabled = false;

  modeContainer.querySelectorAll('.mode-option').forEach(label => {
    const input = label.querySelector('input[type="radio"]');
    if (!input) return;
    const mode = input.value;
    const minPlayers = MODE_MIN_PLAYERS[mode] ?? 1;
    const tooFew = playerCount < minPlayers;

    label.classList.toggle('mode-disabled', tooFew);
    input.disabled = tooFew;

    if (tooFew) {
      label.dataset.minPlayers = minPlayers;
      if (input.checked) selectedModeDisabled = true;
    } else {
      delete label.dataset.minPlayers;
    }
  });

  // Si le mode sélectionné vient d'être désactivé, basculer sur CLASSIC
  if (selectedModeDisabled && onForceChange) {
    const classicInput = modeContainer.querySelector(`input[value="${MODE.CLASSIC}"]`);
    if (classicInput) {
      classicInput.checked = true;
      modeContainer.querySelectorAll('.mode-option').forEach(l => l.classList.remove('selected'));
      classicInput.parentElement.classList.add('selected');
    }
    onForceChange(MODE.CLASSIC);
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
      if (data.mode === MODE.QCM || data.mode === MODE.PINGPONG) {
        hide('answer-form');
        hide('host-judge-buttons');
        show('phase-answering');
        if (data.hostIsReader) {
          // Hôte lecteur en QCM/Ping-Pong : afficher les choix et révéler immédiatement la bonne réponse
          renderChoices(q?.choices ?? [], null, []);
          if (q?.correctAnswer) {
            highlightChoices(q.correctAnswer, null);
          }
        } else {
          renderChoices(q?.choices ?? [], data.onChoiceClick, data.eliminatedPlayers ?? []);
        }
        // En mode Ping-Pong, afficher qui doit répondre
        if (data.mode === MODE.PINGPONG) {
          const queueEl = el('buzz-queue');
          if (queueEl && data.buzzQueue?.length) {
            const names = data.buzzQueue
              .map(id => data.players?.find(p => p.id === id)?.name)
              .filter(Boolean);
            const first = names[0] ?? '';
            const waiting = names.slice(1);
            const firstHtml = `<strong>🏓 ${escapeHtml(first)}</strong> répond…`;
            const waitHtml = waiting.length
              ? `<span class="buzz-waiting">En attente : ${waiting.map(n => escapeHtml(n)).join(', ')}</span>`
              : '';
            queueEl.innerHTML = firstHtml + (waitHtml ? `<br>${waitHtml}` : '');
            queueEl.hidden = false;
          }
        }
      } else if (data.mode === MODE.BUZZ_QCM && data.onChoiceClick) {
        // BUZZ_QCM : ce joueur a buzzé et reçoit ses choix en privé
        hide('answer-form');
        hide('host-judge-buttons');
        show('phase-answering');
        renderChoices(q?.choices ?? [], data.onChoiceClick, data.eliminatedPlayers ?? []);
        const queueEl = el('buzz-queue');
        if (queueEl) queueEl.hidden = true;
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
      const isAnimateur = data.hostIsAnimateur ?? false;
      const answerRevealed = data.answerRevealed ?? true; // par défaut, réponse visible
      const showAnswer = !isAnimateur || answerRevealed;
      const answerReveal = el('correct-answer-reveal');
      if (answerReveal && q2) {
        answerReveal.textContent = showAnswer ? (q2.correctAnswer ?? '') : '';
        answerReveal.hidden = !showAnswer;
      }
      const correctAnswerLabel = el('correct-answer-label');
      if (correctAnswerLabel) correctAnswerLabel.hidden = !showAnswer;
      const skipBadge = el('skipped-badge');
      if (skipBadge) skipBadge.hidden = !data.lastResult?.skipped;
      // Trivia (anecdote) affiché à tous quand la réponse est révélée
      const triviaEl = el('question-trivia');
      if (triviaEl) {
        if (showAnswer && q2?.trivia) {
          triviaEl.textContent = `💡 ${q2.trivia}`;
          triviaEl.hidden = false;
        } else {
          triviaEl.hidden = true;
        }
      }
      // Bouton "Révéler la réponse" — hôte animateur uniquement, avant révélation
      const revealBtn = el('btn-reveal-answer');
      if (revealBtn) revealBtn.hidden = !isHost || !isAnimateur || answerRevealed;
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
  // Image (questions photo)
  const imgEl = el('question-image');
  if (imgEl) {
    if (q.imageUrl) {
      imgEl.src = q.imageUrl;
      imgEl.alt = q.text;
      imgEl.hidden = false;
      imgEl.onerror = () => { imgEl.hidden = true; };
    } else {
      imgEl.src = '';
      imgEl.hidden = true;
    }
  }
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
  if (config.hostIsAnimateur || config.hostIsReader) html += row('Mode hôte', '🎬 Animateur');
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

// ─── Animateur player picker ──────────────────────────────────────────────────

/**
 * Affiche le panneau de sélection du joueur gagnant (mode animateur, phase BUZZING).
 * @param {Array}    players       — liste des joueurs (id, name)
 * @param {Function} onPickPlayer  — appelé avec (playerId) quand l'hôte choisit un joueur
 * @param {Function} onSkip        — appelé quand l'hôte clique "Personne"
 */
export function renderAnimateurPlayerPicker(players, onPickPlayer, onSkip) {
  const picker = el('animateur-player-picker');
  const grid = el('animateur-picker-buttons');
  const nobodyBtn = el('btn-animateur-nobody');
  if (!picker || !grid || !nobodyBtn) return;

  const eligible = players.filter(p => p.id !== '__host__');
  grid.innerHTML = eligible.map(p =>
    `<button class="animateur-player-btn" data-pid="${escapeHtml(p.id)}">${escapeHtml(p.name)}</button>`
  ).join('');

  grid.querySelectorAll('.animateur-player-btn').forEach(btn => {
    btn.addEventListener('click', () => onPickPlayer(btn.dataset.pid));
  });

  nobodyBtn.onclick = onSkip;
  picker.hidden = false;
}

/**
 * Cache le panneau de sélection du joueur gagnant.
 */
export function hideAnimateurPlayerPicker() {
  const picker = el('animateur-player-picker');
  if (picker) picker.hidden = true;
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

