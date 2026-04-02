/**
 * ui.js — Rendu DOM / mise à jour de l'interface
 *
 * Toutes les fonctions ici sont pures (elles lisent l'état et écrivent dans le DOM).
 * Elles n'ont pas de side-effects réseau.
 */

import { PHASE, MODE, JOKER, JOKER_LABELS, JOKER_DESCRIPTIONS, MODE_LABELS, ANSWER_FORMAT, ANSWER_FORMAT_LABELS, ANSWER_PROMPTS } from './constants.js';

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

function setHTML(id, html) {
  const e = el(id);
  if (e) e.innerHTML = html;
}

// ─── Lobby ────────────────────────────────────────────────────────────────────

export function renderShareLink(hostPeerId) {
  const url = `${location.origin}${location.pathname}?host=${hostPeerId}`;
  const linkEl = el('share-link');
  if (linkEl) linkEl.value = url;

  // QR code via une API publique (google charts est dépréciée, using qrserver.com)
  const qrEl = el('share-qr');
  if (qrEl) {
    qrEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`;
    qrEl.alt = 'QR code de la partie';
  }
}

export function renderLobbyPlayers(players) {
  const list = el('lobby-players-list');
  if (!list) return;
  list.innerHTML = players.map(p => `
    <li class="player-item ${p.ready ? 'ready' : ''}">
      <span class="player-name">${escapeHtml(p.name)}</span>
      <span class="player-status">${p.ready ? '✅ Prêt' : '⏳ En attente'}</span>
    </li>
  `).join('');
}

// ─── Scoreboard ───────────────────────────────────────────────────────────────

export function renderScoreboard(players) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const board = el('scoreboard');
  if (!board) return;

  board.innerHTML = sorted.map((p, i) => `
    <div class="score-row rank-${i + 1}">
      <span class="score-rank">${['🥇','🥈','🥉'][i] ?? (i+1)+'.'}</span>
      <span class="score-name">${escapeHtml(p.name)}</span>
      <span class="score-pts">${p.score} pts</span>
      ${p.doubleActive ? '<span class="joker-active">⚡</span>' : ''}
      ${p.blockedUntilRound >= 0 ? '<span class="joker-blocked">🛡️</span>' : ''}
    </div>
  `).join('');
}

// ─── Jokers (vue joueur) ──────────────────────────────────────────────────────

export function renderJokers(player, allPlayers, currentRound, onJokerClick, windowOpen = false) {
  const container = el('joker-buttons');
  if (!container) return;

  const blocked = player.blockedUntilRound > currentRound;

  container.innerHTML = Object.values(JOKER).map(type => {
    const count = player.jokers[type] ?? 0;
    const disabled = count === 0 || blocked || !windowOpen;
    return `
      <button
        class="joker-btn ${disabled ? 'disabled' : ''}"
        data-joker="${type}"
        ${disabled ? 'disabled' : ''}
        title="${JOKER_DESCRIPTIONS[type]}"
      >
        ${JOKER_LABELS[type]}
        <span class="joker-count">${count}</span>
      </button>
    `;
  }).join('');

  if (!blocked && windowOpen) {
    container.querySelectorAll('.joker-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.joker;
        const needsTarget = type === JOKER.STEAL || type === JOKER.BLOCK;
        if (needsTarget) {
          showJokerTargetPicker(allPlayers.filter(p => p.id !== player.id), (targetId) => {
            onJokerClick(type, targetId);
          });
        } else {
          onJokerClick(type, null);
        }
      });
    });
  }
}

function showJokerTargetPicker(targets, onSelect) {
  const existing = document.getElementById('joker-target-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'joker-target-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <h3>Choisir une cible</h3>
      <ul class="target-list">
        ${targets.map(p => `
          <li>
            <button class="target-btn" data-id="${p.id}">
              ${escapeHtml(p.name)} <span class="target-score">(${p.score} pts)</span>
            </button>
          </li>
        `).join('')}
      </ul>
      <button class="btn-secondary" id="joker-target-cancel">Annuler</button>
    </div>
  `;

  modal.querySelector('#joker-target-cancel').addEventListener('click', () => modal.remove());
  modal.querySelectorAll('.target-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      onSelect(btn.dataset.id);
      modal.remove();
    });
  });

  document.body.appendChild(modal);
}

// ─── Phase de jeu ─────────────────────────────────────────────────────────────

export function renderGamePhase(phase, data, isHost) {
  hide('phase-joker-window');
  hide('phase-countdown');
  hide('phase-playing');
  hide('phase-buzzed');
  hide('phase-answering');
  hide('phase-answer-result');
  hide('phase-round-end');

  // Compteur de chansons restantes
  const counter = el('game-round-counter');
  if (counter && data.currentRound != null && data.totalRounds != null) {
    const played  = data.currentRound + 1; // currentRound est 0-indexé côté host
    const total   = data.totalRounds;
    const remaining = Math.max(0, total - played);
    counter.textContent = remaining > 0
      ? `🎵 ${played}/${total} — ${remaining} restante${remaining > 1 ? 's' : ''}`
      : `🎵 ${played}/${total}`;
    counter.hidden = false;
  } else if (counter && data.currentRound != null && data.totalRounds == null) {
    // Client : currentRound est 1-indexé
    counter.textContent = `🎵 Manche ${data.currentRound}`;
    counter.hidden = false;
  }

  switch (phase) {
    case PHASE.JOKER_WINDOW:
      show('phase-joker-window');
      setText('joker-window-countdown', data.jokerWindowRemaining ?? '');
      break;

    case PHASE.COUNTDOWN:
      show('phase-countdown');
      setText('countdown-number', data.countdown ?? '');
      break;

    case PHASE.PLAYING:
      show('phase-playing');
      if (data.mode === MODE.FOUR_CHOICES && data.choices?.length) {
        renderFourChoices(data.choices, data.onChoiceClick, data.eliminatedChoices ?? []);
      }
      break;

    case PHASE.BUZZED:
    case PHASE.ANSWERING: {
      show('phase-buzzed');
      const currentBuzzer = data.players?.find(p => p.id === data.buzzQueue?.[0]);
      setText('buzzer-name', currentBuzzer ? `🔔 ${currentBuzzer.name} buzze !` : '🔔 Buzz !');
      // File d'attente : affiche les joueurs en attente (queue[1] et suivants)
      const waiting = (data.buzzQueue ?? []).slice(1)
        .map(id => data.players?.find(p => p.id === id)?.name)
        .filter(Boolean);
      setText('buzz-queue-list', waiting.length ? `En attente : ${waiting.join(', ')}` : '');
      if (phase === PHASE.ANSWERING) {
        show('phase-answering');
        // Indiquer ce que le joueur doit répondre
        const step = data.answerStep ?? 'artist';
        const prompt = ANSWER_PROMPTS[step] ?? ANSWER_PROMPTS.artist;
        setText('answer-step-label', prompt.label);
        const inp = el('answer-input');
        if (inp) inp.placeholder = prompt.placeholder;
      }
      break;
    }

    case PHASE.ANSWER_RESULT: {
      show('phase-answer-result');
      const r = data.lastResult;
      if (r?.partial) {
        const points = r?.points > 0 ? ` (+${r.points} pts)` : '';
        setText('answer-result-text', `✅ Artiste correct !${points}`);
        setText('answer-result-answer', `À vous le titre…`);
      } else if (r?.correct) {
        const points = r?.points > 0 ? ` (+${r.points} pts)` : '';
        const successLabel = r?.step === 'title'
          ? '✅ Titre correct !'
          : r?.answerFormat === ANSWER_FORMAT.EITHER_ONE
            ? '✅ Bonne réponse !'
            : '✅ Réponse complète correcte !';
        setText('answer-result-text', `${successLabel}${points}`);
        setText('answer-result-answer', r?.answer ?? '');
      } else {
        const malus = r?.points < 0 ? ` (${r.points} pts)` : '';
        setText('answer-result-text', `❌ Mauvaise réponse${malus}`);
        setText('answer-result-answer', r?.answer ?? '');
      }
      break;
    }

    case PHASE.ROUND_END:
      show('phase-round-end');
      if (data.currentSong) {
        setText('round-end-title', data.currentSong.title);
        setText('round-end-artist', data.currentSong.artist);
        // Thumbnail YouTube
        const thumb = el('round-end-thumb');
        if (thumb) thumb.src = `https://img.youtube.com/vi/${data.currentSong.videoId}/mqdefault.jpg`;
      }
      {
        const errEl = el('round-end-playback-error');
        if (errEl) {
          if (data.playbackError) {
            errEl.hidden = false;
            errEl.textContent = `⚠️ ${data.playbackError}`;
          } else {
            errEl.hidden = true;
            errEl.textContent = '';
          }
        }
      }
      break;
  }
}

function renderFourChoices(choices, onChoiceClick, eliminatedChoices = []) {
  const grid = el('four-choices-grid');
  if (!grid) return;
  grid.innerHTML = choices.map(c => {
    const isEliminated = eliminatedChoices.includes(c);
    return `<button class="choice-btn${isEliminated ? ' eliminated' : ''}" data-choice="${escapeHtml(c)}"${isEliminated ? ' disabled' : ''}>${escapeHtml(c)}</button>`;
  }).join('');
  if (onChoiceClick) {
    grid.querySelectorAll('.choice-btn:not(:disabled)').forEach(btn => {
      btn.addEventListener('click', () => onChoiceClick(btn.dataset.choice));
    });
  }
}

export function highlightCorrectChoice(correctText) {
  document.querySelectorAll('.choice-btn').forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.choice === correctText) {
      btn.classList.add('correct');
    } else {
      btn.classList.add('wrong');
    }
  });
}

// ─── Timer visuel ─────────────────────────────────────────────────────────────

let _timerInterval = null;
let _timerBar = null;
let _timerLabel = null;

export function startTimerBar(durationMs, barId, startPct = 100) {
  stopTimerBar();
  _timerBar = el(barId);
  if (!_timerBar) return;
  // Cherche un label frère portant l'id barId + '-seconds'
  _timerLabel = el(barId + '-seconds');
  const startMs = (startPct / 100) * durationMs;
  const start = Date.now();
  _timerBar.style.width = startPct + '%';
  if (_timerLabel) _timerLabel.textContent = Math.ceil(startMs / 1000) + 's';
  _timerInterval = setInterval(() => {
    const elapsed = Date.now() - start;
    const remaining = Math.max(0, startMs - elapsed);
    const pct = Math.max(0, startPct * (1 - elapsed / durationMs));
    _timerBar.style.width = pct + '%';
    if (_timerLabel) _timerLabel.textContent = Math.ceil(remaining / 1000) + 's';
    if (pct <= 0) stopTimerBar();
  }, 50);
}

export function stopTimerBar() {
  clearInterval(_timerInterval);
  _timerInterval = null;
  if (_timerBar) _timerBar.style.width = '0%';
  if (_timerLabel) _timerLabel.textContent = '';
  _timerLabel = null;
}

// ─── Buzz flash ───────────────────────────────────────────────────────────────

export function flashBuzz() {
  document.body.classList.add('buzz-flash');
  setTimeout(() => document.body.classList.remove('buzz-flash'), 600);
}

// ─── Résultats finaux ─────────────────────────────────────────────────────────

export function renderFinalResults(finalScores) {
  const container = el('final-results');
  if (!container) return;
  container.innerHTML = finalScores.map((p, i) => `
    <div class="final-row rank-${i + 1}">
      <span class="final-rank">${['🥇','🥈','🥉'][i] ?? `${i+1}.`}</span>
      <span class="final-name">${escapeHtml(p.name)}</span>
      <span class="final-score">${p.score} pts</span>
    </div>
  `).join('');
}

// ─── Playlist (vue host) ──────────────────────────────────────────────────────

export function renderPlaylist(songs, onRemove, onMove) {
  const list = el('playlist-list');
  if (!list) return;

  // Compteur dans le titre de la card
  const countEl = el('playlist-count');
  if (countEl) countEl.textContent = songs.length > 0 ? `(${songs.length})` : '';

  if (!songs.length) {
    list.innerHTML = '<li class="empty-playlist">Aucune chanson. Ajoutez-en ci-dessus.</li>';
    return;
  }
  list.innerHTML = songs.map((s, i) => `
    <li class="playlist-item" data-id="${s.id}">
      <div class="playlist-info">
        <span class="playlist-title" title="${escapeHtml(s.title)}">${escapeHtml(initials(s.title))}</span>
        <span class="playlist-artist" title="${escapeHtml(s.artist)}">${escapeHtml(initials(s.artist))}</span>
      </div>
      <div class="playlist-actions">
        <button class="btn-icon" data-action="up" title="Monter" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button class="btn-icon" data-action="down" title="Descendre" ${i === songs.length - 1 ? 'disabled' : ''}>▼</button>
        <button class="btn-icon btn-danger" data-action="remove" title="Supprimer">✕</button>
      </div>
    </li>
  `).join('');

  list.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const li = btn.closest('[data-id]');
      const id = li?.dataset.id;
      if (!id) return;
      const action = btn.dataset.action;
      if (action === 'remove') onRemove(id);
      else if (action === 'up') onMove(id, 'up');
      else if (action === 'down') onMove(id, 'down');
    });
  });
}

// ─── Mode selector ────────────────────────────────────────────────────────────

export function renderModeSelector(selectedMode, onChange) {
  const container = el('mode-selector');
  if (!container) return;
  container.innerHTML = Object.entries(MODE_LABELS).map(([mode, label]) => `
    <label class="mode-option ${selectedMode === mode ? 'selected' : ''}">
      <input type="radio" name="game-mode" value="${mode}" ${selectedMode === mode ? 'checked' : ''}>
      ${label}
    </label>
  `).join('');

  container.querySelectorAll('input[name="game-mode"]').forEach(input => {
    input.addEventListener('change', () => {
      container.querySelectorAll('.mode-option').forEach(l => l.classList.remove('selected'));
      input.parentElement.classList.add('selected');
      onChange(input.value);
    });
  });
}

export function renderAnswerFormatSelector(selectedFormat, onChange) {
  const container = el('answer-format-selector');
  if (!container) return;
  container.innerHTML = Object.entries(ANSWER_FORMAT_LABELS).map(([format, label]) => `
    <label class="mode-option ${selectedFormat === format ? 'selected' : ''}">
      <input type="radio" name="answer-format" value="${format}" ${selectedFormat === format ? 'checked' : ''}>
      ${label}
    </label>
  `).join('');

  container.querySelectorAll('input[name="answer-format"]').forEach(input => {
    input.addEventListener('change', () => {
      container.querySelectorAll('.mode-option').forEach(label => label.classList.remove('selected'));
      input.parentElement.classList.add('selected');
      onChange(input.value);
    });
  });
}

// ─── Utilitaire sécurité ──────────────────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Réduit un texte à ses initiales (ex: "Bohemian Rhapsody" → "B. R.") */
function initials(str) {
  if (!str) return '';
  return str.trim().split(/\s+/).map(w => w[0].toUpperCase() + '.').join(' ');
}
