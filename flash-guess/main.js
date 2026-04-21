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
  loadRotatingGuesserMode, saveRotatingGuesserMode,
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

// ─── TUTORIAL ─────────────────────────────────────────────────────────────────
const TUTORIAL_SLIDES = [
  {
    icon: '⚡',
    title: 'Bienvenue dans Flash Guess !',
    html: `
      <p>Flash Guess est un jeu de société en <strong>3 manches progressives</strong> où les équipes
      doivent faire deviner des mots — les mêmes à chaque manche, mais avec des règles
      de plus en plus difficiles !</p>
      <p>Ce tutoriel vous explique chaque écran et chaque bouton du jeu. 🎉</p>
      <div class="tuto-mock" style="text-align:center;padding:14px">
        <div style="font-size:1.5rem;margin-bottom:6px">🗣️ → ☝️ → 🤐</div>
        <div style="font-size:0.82rem;color:var(--text-muted)">Parler librement → Un seul mot → Mime</div>
      </div>
      <p>1 mot trouvé = 1 point · L'équipe avec le plus de points gagne 🏆</p>
    `,
  },
  {
    icon: '👥',
    title: 'Écran d\'accueil — Ajouter des joueurs',
    html: `
      <p>Saisissez au moins <strong>2 prénoms</strong> pour démarrer une partie.
      Le bouton 🚀 se débloque automatiquement dès que le minimum est atteint.</p>
      <div class="tuto-mock">
        <div class="tuto-mock-row">
          <span style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:5px 10px;font-size:0.82rem;color:var(--text-muted)">Prénom du joueur…</span>
          <span class="tuto-btn tuto-btn-action">Ajouter</span>
        </div>
        <div class="tuto-mock-row">
          <span style="font-size:1.1rem">👤</span>
          <span class="tuto-mock-label"><strong>Lucie</strong></span>
          <span style="font-size:0.75rem;color:var(--danger);cursor:pointer">✕</span>
        </div>
        <div class="tuto-mock-row">
          <span style="font-size:1.1rem">👤</span>
          <span class="tuto-mock-label"><strong>Maxime</strong></span>
          <span style="font-size:0.75rem;color:var(--danger);cursor:pointer">✕</span>
        </div>
      </div>
      <p>Vous pouvez aussi ajouter des joueurs depuis un <strong>groupe enregistré</strong> 👥 ou depuis la liste des <strong>joueurs enregistrés</strong> 📋 — pratique pour retrouver vos habitués !</p>
    `,
  },
  {
    icon: '⚙️',
    title: 'Options de partie',
    html: `
      <p>Avant de démarrer, configurez la partie selon vos envies :</p>
      <div style="display:flex;flex-direction:column;gap:6px;margin:10px 0">
        <div class="tuto-rule-badge"><span class="tuto-rule-icon">🃏</span><span><strong>Nombre de mots</strong> — choisissez entre 10 et tous les mots disponibles (défaut : 40).</span></div>
        <div class="tuto-rule-badge"><span class="tuto-rule-icon">🧒</span><span><strong>Mode Enfant</strong> — activez-le si des joueurs de moins de 12 ans jouent. L'orateur voit le mot avant le début du tour et peut dire "J'ai lu !" pour démarrer le chrono.</span></div>
        <div class="tuto-rule-badge"><span class="tuto-rule-icon">🎯</span><span><strong>Choix des mots</strong> — chaque joueur élimine secrètement 3 mots avant la partie. Les autres joueurs ne voient pas les choix.</span></div>
      </div>
      <p>Dans les <strong>📖 Règles rapides</strong> (section dépliable), retrouvez un résumé des 3 manches.</p>
    `,
  },
  {
    icon: '📂',
    title: 'Écran — Sélection des catégories',
    html: `
      <p>Après avoir cliqué sur <strong>🚀 Choisir les catégories</strong>, sélectionnez les thèmes
      à inclure dans la partie.</p>
      <div class="tuto-mock">
        <div class="tuto-mock-row" style="flex-wrap:wrap;gap:6px;padding:8px 0">
          <span style="background:rgba(232,93,4,0.2);border:1px solid var(--volcan);border-radius:8px;padding:5px 10px;font-size:0.8rem">🏛️ Histoire ✓</span>
          <span style="background:rgba(0,150,199,0.15);border:1px solid var(--lagon);border-radius:8px;padding:5px 10px;font-size:0.8rem">🗺️ Géographie ✓</span>
          <span style="background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:8px;padding:5px 10px;font-size:0.8rem;color:var(--text-muted)">🎵 Musique</span>
          <span style="background:rgba(232,93,4,0.2);border:1px solid var(--volcan);border-radius:8px;padding:5px 10px;font-size:0.8rem">⚽ Sport ✓</span>
        </div>
      </div>
      <p>Utilisez <strong>✅ Tout sélectionner</strong> ou <strong>☐ Tout désélectionner</strong>
      pour gérer rapidement toutes les catégories. Au moins une catégorie est requise.</p>
    `,
  },
  {
    icon: '🎲',
    title: 'Écran — Les Équipes',
    html: `
      <p>Les équipes sont formées <strong>aléatoirement</strong>. Pour 2 joueurs : mode coopératif
      (score commun). Pour 4 joueurs : 2 équipes de 2, etc.</p>
      <div class="tuto-mock">
        <div class="tuto-mock-row" style="gap:10px">
          <div style="flex:1;background:rgba(232,93,4,0.15);border:1px solid var(--volcan);border-radius:8px;padding:8px;text-align:center;font-size:0.82rem">
            <div style="color:var(--volcan);font-weight:700">Équipe 🔴</div>
            <div style="color:var(--text-muted)">👤 Lucie</div>
            <div style="color:var(--text-muted)">👤 Marc</div>
          </div>
          <div style="flex:1;background:rgba(0,150,199,0.15);border:1px solid var(--lagon);border-radius:8px;padding:8px;text-align:center;font-size:0.82rem">
            <div style="color:var(--lagon);font-weight:700">Équipe 🔵</div>
            <div style="color:var(--text-muted)">👤 Sophie</div>
            <div style="color:var(--text-muted)">👤 Kévin</div>
          </div>
        </div>
        <div class="tuto-mock-row" style="justify-content:center;gap:8px;padding-top:8px">
          <span class="tuto-btn" style="background:transparent;border:1px solid var(--border);color:var(--text-muted)">🔀 Rebattre</span>
          <span class="tuto-btn tuto-btn-action">⚡ C'est parti !</span>
        </div>
      </div>
      <p>En mode <strong>coop 2 joueurs</strong>, vous pouvez aussi activer des objectifs bonus
      (minimiser le temps ⏱️ ou le nombre de tours 🎯) pour corser le défi !</p>
    `,
  },
  {
    icon: '🎯',
    title: 'Choix des mots — Tri secret',
    html: `
      <p>Si l'option <strong>🎯 Choix des mots</strong> est activée, chaque joueur élimine
      secrètement <strong>3 mots</strong> avant la partie.</p>
      <div class="tuto-mock" style="text-align:center;padding:14px">
        <div style="font-weight:700;color:var(--warning);font-size:0.85rem;margin-bottom:8px">🙈 Passez le téléphone à…</div>
        <div style="font-size:1.2rem;font-weight:900;margin-bottom:4px">Lucie</div>
        <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:10px">Attendez que le joueur soit seul avant de continuer.</div>
        <span class="tuto-btn tuto-btn-action">👀 Je suis prêt, montrer mes mots</span>
      </div>
      <p>Chaque joueur voit une liste de mots et en <strong>élimine exactement 3</strong>. Les
      autres joueurs ne voient pas les choix. Les mots éliminés <strong>ne seront pas</strong> dans
      la partie.</p>
    `,
  },
  {
    icon: '📖',
    title: 'Présentation de la manche',
    html: `
      <p>Avant chaque manche, un écran rappelle les <strong>règles spécifiques</strong> à
      respecter pendant les 30 secondes de chaque tour.</p>
      <div class="tuto-mock" style="text-align:center">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:4px 14px;display:inline-block;font-size:0.78rem;color:var(--warning);font-weight:700;margin-bottom:8px">Manche 1 / 3</div>
        <div style="font-size:2rem;margin-bottom:4px">🗣️</div>
        <div style="font-weight:800;font-size:0.95rem;margin-bottom:6px">Parler librement</div>
        <div style="font-size:0.78rem;color:var(--text-muted);line-height:1.5">Les règles de la manche s'affichent ici.</div>
        <div class="tuto-btn tuto-btn-action" style="margin-top:10px;display:inline-flex">▶ Commencer la manche</div>
      </div>
      <p>Lisez les règles attentivement puis cliquez <strong>▶ Commencer la manche</strong> pour démarrer les tours.</p>
    `,
  },
  {
    icon: '📱',
    title: 'Pré-tour — Passez le téléphone',
    html: `
      <p>Au début de chaque tour, le nom de <strong>l'orateur</strong> (celui qui fait deviner)
      et de son <strong>équipe</strong> est affiché.</p>
      <div class="tuto-mock" style="text-align:center;padding:14px">
        <div style="font-size:0.78rem;color:var(--text-muted)">Au tour de</div>
        <div style="font-size:1.4rem;font-weight:900;color:#ffd166">Sophie</div>
        <div style="font-size:0.78rem;color:var(--text-muted)">qui fait deviner à</div>
        <div style="font-size:1.4rem;font-weight:900;color:#06d6a0">Marc · Lucie</div>
        <div class="tuto-btn tuto-btn-action" style="margin-top:10px;display:inline-flex">✅ Je suis prêt !</div>
      </div>
      <p>L'orateur prend le téléphone et clique <strong>✅ Je suis prêt !</strong>
      pour lancer le chronomètre de 30 secondes.</p>
    `,
  },
  {
    icon: '⏱️',
    title: 'Tour actif — Écran de jeu',
    html: `
      <p>L'orateur voit le mot à faire deviner. Le chronomètre de <strong>30 secondes</strong>
      tourne en haut au centre.</p>
      <div class="tuto-fake-turn">
        <div class="tuto-fake-header">
          <span class="tuto-fake-round-badge">Manche 1</span>
          <span class="tuto-fake-stat">👤 Sophie</span>
          <span class="tuto-fake-stat">🃏 12 restant(s)</span>
        </div>
        <div class="tuto-fake-grid">
          <div class="tuto-fake-side-btn tuto-fake-skip">⏭<br>Carte suivante</div>
          <div class="tuto-fake-center-col">
            <div class="tuto-fake-timer-circle"><span>22</span></div>
            <div class="tuto-fake-word">Einstein</div>
            <div class="tuto-fake-cat">🔬 Sciences</div>
          </div>
          <div class="tuto-fake-side-btn tuto-fake-found">✅<br>Trouvé !</div>
        </div>
        <div class="tuto-fake-callouts">
          <div class="tuto-callout tuto-callout-up"><strong>Passer</strong><br>manche 2+</div>
          <div class="tuto-fake-undo-callout"><strong>↩ Annuler · ↪ Refaire</strong> apparaissent après chaque action</div>
          <div class="tuto-callout tuto-callout-up"><strong>Trouvé !</strong></div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;margin:8px 0">
        <div class="tuto-rule-badge"><span class="tuto-rule-icon">✅</span><span><strong>Trouvé !</strong> — L'équipe a trouvé le mot (grand bouton vert)</span></div>
        <div class="tuto-rule-badge"><span class="tuto-rule-icon">⏭</span><span><strong>Carte suivante</strong> — Passer la carte (disponible à partir de la manche 2)</span></div>
        <div class="tuto-rule-badge"><span class="tuto-rule-icon">↩</span><span><strong>Annuler / Refaire</strong> — Corrige une action erronée</span></div>
      </div>
    `,
  },
  {
    icon: '🗣️',
    title: 'Manche 1 — Parler librement',
    html: `
      <p>L'orateur peut utiliser <strong>tous les mots qu'il veut</strong> pour décrire le mot,
      sauf ceux interdits ci-dessous.</p>
      <div style="display:flex;flex-direction:column;gap:5px;margin:10px 0">
        <div class="tuto-rule-badge"><span class="tuto-rule-icon">⛔</span><span>Interdits : dire le nom, épeler, traduire directement</span></div>
        <div class="tuto-rule-badge"><span class="tuto-rule-icon">✅</span><span>Les devineurs peuvent faire autant de propositions qu'ils veulent</span></div>
        <div class="tuto-rule-badge"><span class="tuto-rule-icon">🃏</span><span>Pas de bouton Passer en manche 1 — continuez jusqu'à la fin du temps</span></div>
      </div>
      <p>💡 <strong>Conseil :</strong> mémorisez bien les mots que vous entendez, ils reviendront
      aux manches 2 et 3 !</p>
    `,
  },
  {
    icon: '☝️',
    title: 'Manche 2 — Un seul mot',
    html: `
      <p>L'orateur ne peut dire qu'<strong>un seul mot</strong> pour chaque carte.
      L'équipe n'a droit qu'à <strong>une seule proposition</strong>.</p>
      <div style="display:flex;flex-direction:column;gap:5px;margin:10px 0">
        <div class="tuto-rule-badge"><span class="tuto-rule-icon">✅</span><span><strong>Bonne réponse</strong> → carte gagnée (cliquer Trouvé !)</span></div>
        <div class="tuto-rule-badge"><span class="tuto-rule-icon">❌</span><span><strong>Mauvaise réponse</strong> → carte perdue pour ce tour, mais remise dans la manche</span></div>
        <div class="tuto-rule-badge"><span class="tuto-rule-icon">⏭</span><span><strong>Carte suivante</strong> apparaît si l'orateur est bloqué ou s'il n'a pas respecté la règle</span></div>
        <div class="tuto-rule-badge"><span class="tuto-rule-icon">⛔</span><span>Interdits : plusieurs mots, partie du nom, traduction directe</span></div>
      </div>
    `,
  },
  {
    icon: '🤐',
    title: 'Manche 3 — Mime et bruitages',
    html: `
      <p>Plus de paroles ! L'orateur ne peut utiliser que des <strong>mimes</strong>
      et des <strong>bruitages</strong>.</p>
      <div style="display:flex;flex-direction:column;gap:5px;margin:10px 0">
        <div class="tuto-rule-badge"><span class="tuto-rule-icon">✅</span><span><strong>Bonne réponse</strong> → carte gagnée</span></div>
        <div class="tuto-rule-badge"><span class="tuto-rule-icon">🚨</span><span><strong>Erreur</strong> (bouton gauche) → l'orateur a parlé — carte perdue pour ce tour</span></div>
        <div class="tuto-rule-badge"><span class="tuto-rule-icon">⏭</span><span><strong>Carte suivante</strong> → passer la carte (perdue pour ce tour)</span></div>
        <div class="tuto-rule-badge"><span class="tuto-rule-icon">⛔</span><span>Interdits : parler, former des mots, fredonner une chanson</span></div>
      </div>
    `,
  },
  {
    icon: '📊',
    title: 'Fin de tour & Fin de manche',
    html: `
      <p>À la fin de chaque tour (temps écoulé ou tous les mots trouvés), le <strong>récapitulatif</strong>
      s'affiche.</p>
      <div class="tuto-mock" style="text-align:center;padding:14px">
        <div style="font-size:1.2rem;margin-bottom:4px">⏱️ Temps écoulé !</div>
        <div style="font-size:2.5rem;font-weight:900;color:var(--success);line-height:1">4</div>
        <div style="font-size:0.82rem;color:var(--text-muted)">mot(s) ce tour · 12 restant(s)</div>
        <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px;align-items:center">
          <span class="tuto-btn" style="background:transparent;border:1px solid rgba(255,255,255,0.15);color:var(--text-muted);font-size:0.78rem;padding:5px 14px">✏️ Corriger</span>
          <span class="tuto-btn tuto-btn-action" style="font-size:0.82rem;padding:6px 20px">➡ Suivant</span>
        </div>
      </div>
      <div style="display:flex;gap:6px;margin:6px 0">
        <div class="tuto-rule-badge"><span class="tuto-rule-icon">✏️</span><span><strong>Corriger</strong> — Une faute n'a pas été signalée ? Décochez les mots concernés pour les retirer du score et les remettre dans la manche.</span></div>
      </div>
      <p>Quand tous les mots sont trouvés, le <strong>tableau des scores</strong> s'affiche.
      Les points se cumulent sur les 3 manches.</p>
    `,
  },
  {
    icon: '🎉',
    title: 'Fin de partie — Résultats finaux',
    html: `
      <p>Après les <strong>3 manches</strong>, le classement final s'affiche avec le total
      de points de chaque équipe.</p>
      <div class="tuto-mock" style="text-align:center;padding:14px">
        <div style="font-size:2rem;margin-bottom:6px">🎉</div>
        <div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:6px">Vainqueur</div>
        <div style="font-size:1.4rem;font-weight:900;color:var(--volcan);margin-bottom:10px">Sophie · Marc</div>
        <div style="display:flex;flex-direction:column;gap:5px;font-size:0.85rem">
          <div style="background:var(--surface);border-radius:8px;padding:8px 12px;display:flex;align-items:center;gap:8px">
            <span style="font-size:1.1rem">🥇</span>
            <span style="font-weight:700;color:var(--volcan);flex:1;text-align:left">Sophie · Marc</span>
            <span style="color:var(--warning);font-weight:700">18 pts</span>
          </div>
          <div style="background:var(--surface);border-radius:8px;padding:8px 12px;display:flex;align-items:center;gap:8px">
            <span style="font-size:1.1rem">🥈</span>
            <span style="font-weight:700;color:var(--lagon);flex:1;text-align:left">Lucie · Kévin</span>
            <span style="color:var(--warning);font-weight:700">14 pts</span>
          </div>
        </div>
      </div>
      <p>Vos scores sont enregistrés dans le <strong>🏆 Classement</strong> accessible depuis l'accueil.
      Cliquez <strong>🔄 Rejouer</strong> pour une nouvelle partie !</p>
    `,
  },
];

let _tutorialCurrentSlide = 0;

function openTutorial(startSlide = 0) {
  _tutorialCurrentSlide = startSlide;
  renderTutorialSlide();
  el('tutorial-overlay').hidden = false;
  el('tutorial-close').focus();
}

function closeTutorial() {
  el('tutorial-overlay').hidden = true;
}

function renderTutorialSlide() {
  const total   = TUTORIAL_SLIDES.length;
  const slide   = TUTORIAL_SLIDES[_tutorialCurrentSlide];
  const content = el('tutorial-slide-content');

  content.innerHTML = `
    <div class="tuto-slide-icon">${slide.icon}</div>
    <div class="tuto-slide-title">${slide.title}</div>
    <div class="tuto-slide-body">${slide.html}</div>
  `;

  const dotsEl = el('tutorial-dots');
  dotsEl.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const dot = document.createElement('button');
    dot.className = `tutorial-dot${i === _tutorialCurrentSlide ? ' active' : ''}`;
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', `Diapositive ${i + 1}`);
    if (i === _tutorialCurrentSlide) {
      dot.setAttribute('aria-current', 'true');
      dot.setAttribute('aria-selected', 'true');
    } else {
      dot.removeAttribute('aria-current');
      dot.setAttribute('aria-selected', 'false');
    }
    dot.addEventListener('click', () => {
      _tutorialCurrentSlide = i;
      renderTutorialSlide();
    });
    dotsEl.appendChild(dot);
  }

  el('tutorial-prev').disabled = _tutorialCurrentSlide === 0;
  const nextBtn = el('tutorial-next');
  if (_tutorialCurrentSlide === total - 1) {
    nextBtn.textContent = '✅ Fermer';
  } else {
    nextBtn.textContent = 'Suivant ›';
  }

  content.scrollTop = 0;
}

function tutorialNext() {
  if (_tutorialCurrentSlide < TUTORIAL_SLIDES.length - 1) {
    _tutorialCurrentSlide++;
    renderTutorialSlide();
  } else {
    closeTutorial();
  }
}

function tutorialPrev() {
  if (_tutorialCurrentSlide > 0) {
    _tutorialCurrentSlide--;
    renderTutorialSlide();
  }
}

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

  // ── Tutorial ──
  el('btn-tutorial').addEventListener('click', withCooldown(() => openTutorial(0)));
  el('tutorial-close').addEventListener('click', withCooldown(closeTutorial));
  el('tutorial-prev').addEventListener('click', withCooldown(tutorialPrev));
  el('tutorial-next').addEventListener('click', withCooldown(tutorialNext));
  el('tutorial-overlay').addEventListener('click', (e) => {
    if (e.target === el('tutorial-overlay')) closeTutorial();
  });
  el('tutorial-overlay').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeTutorial(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); tutorialNext(); }
    else if (e.key === 'ArrowLeft')  { e.preventDefault(); tutorialPrev(); }
  });

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

  // ── Devineur tournant ──
  state.rotatingGuesserMode = loadRotatingGuesserMode();
  const rotatingGuesserBtn = el('toggle-rotating-guesser');
  function updateRotatingGuesserBtn() {
    rotatingGuesserBtn.textContent = state.rotatingGuesserMode ? 'ON' : 'OFF';
    rotatingGuesserBtn.className =
      `kids-mode-toggle-btn${state.rotatingGuesserMode ? ' kids-mode-toggle-btn--on' : ''}`;
    rotatingGuesserBtn.setAttribute('aria-checked', String(state.rotatingGuesserMode));
  }
  updateRotatingGuesserBtn();
  rotatingGuesserBtn.addEventListener('click', withCooldown(() => {
    state.rotatingGuesserMode = !state.rotatingGuesserMode;
    saveRotatingGuesserMode(state.rotatingGuesserMode);
    updateRotatingGuesserBtn();
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
      state.allWords = [];
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
    state.rotatingGuesserTarget   = [];
    state.currentGuesserTeamIdx   = -1;
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
