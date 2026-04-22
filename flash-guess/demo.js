/**
 * demo.js — Mode démo (fausse partie pour découvrir le jeu)
 */

import { state, demo, demoHooks } from './state.js';
import { el } from './ui.js';
import { getShuffledWords } from './words.js';
import { startPreTurn } from './game.js';

// ─── Tips de la démo ───────────────────────────────────────────────────────────
const DEMO_TIPS = {
  'pre-turn': [
    { targetId: 'btn-ready', text: '✅ « Je suis prêt ! » — Passe le téléphone à l\'orateur, puis appuie ici quand tout le monde est prêt à jouer.' },
  ],
  1: [
    {
      targetId: 'btn-child-read',
      text: '👀 J\'ai lu ! — L\'orateur est un enfant : ce bouton lui permet de confirmer qu\'il a bien lu le mot avant que le chrono démarre.',
    },
    { targetId: 'timer-number',   text: '⏱️ Le chrono ! En vraie partie il compte 30 secondes. Ici il est infini pour que tu puisses explorer sans pression.' },
    { targetId: 'word-card-text', text: '🃏 Le mot à faire deviner ! Décris-le librement — interdit de le dire, l\'épeler ou le traduire.' },
    {
      targetId: 'btn-found',
      text: '✅ Trouvé ! Appuie ici quand ton équipe trouve le mot. D\'abord, clique sur « J\'ai lu » pour continuer !',
      onOk: () => { demo.childReadFrozen = false; import('./game.js').then(({ showChildReadBtn }) => showChildReadBtn(true)); },
    },
  ],
  2: [
    { targetId: 'btn-skip', text: '⏭ Nouveau en manche 2 ! Si tu es bloqué, passe la carte : elle reviendra pour un autre tour.' },
  ],
  3: [
    { targetId: 'btn-error', text: '🚨 En manche 3, appuie sur « Erreur » si l\'orateur a parlé.' },
    { targetId: 'btn-skip',  text: '⏭ En manche 3, appuie sur « Carte suivante » si l\'orateur souhaite passer.' },
  ],
};

const DEMO_TIPS_AFTER_FIRST_FOUND = [
  { targetId: 'btn-undo', text: '↩ Annuler — Tu as appuyé sur « Trouvé » trop vite ? Ce bouton annule le dernier mot. Le bouton ↪ Refaire apparaîtra alors juste à côté si tu veux rétablir.' },
];

const DEMO_TIPS_TURN_END = [
  { targetId: 'btn-correct-turn', text: '✏️ Corriger le tour — Une faute non signalée ? Appuie ici pour décocher les mots concernés.' },
];

// ─── Affichage des tips ────────────────────────────────────────────────────────
function _showDemoTip(tips) {
  const tip     = tips[demo.tipIdx];
  const overlay = el('demo-tooltip-overlay');
  const ring    = el('demo-highlight-ring');
  const textEl  = el('demo-tooltip-text');
  const panel   = el('demo-tooltip-panel');

  textEl.textContent = tip.text;

  const target = tip.targetId ? document.getElementById(tip.targetId) : null;
  if (target) {
    const rect = target.getBoundingClientRect();
    const pad  = 8;
    ring.style.top    = (rect.top    - pad) + 'px';
    ring.style.left   = (rect.left   - pad) + 'px';
    ring.style.width  = (rect.width  + pad * 2) + 'px';
    ring.style.height = (rect.height + pad * 2) + 'px';
    ring.hidden = false;

    const panelW = Math.min(280, window.innerWidth - 32);
    const panelH = 130;
    const gap    = 14;
    let top  = rect.bottom + gap;
    if (top + panelH > window.innerHeight - 10) top = rect.top - panelH - gap;
    if (top < 10) top = 10;
    let left = rect.left + rect.width / 2 - panelW / 2;
    if (left < 10) left = 10;
    if (left + panelW > window.innerWidth - 10) left = window.innerWidth - panelW - 10;
    panel.style.top       = top + 'px';
    panel.style.left      = left + 'px';
    panel.style.transform = '';
  } else {
    ring.hidden = true;
    panel.style.top       = '50%';
    panel.style.left      = '50%';
    panel.style.transform = 'translate(-50%,-50%)';
  }

  overlay.hidden = false;

  el('demo-tooltip-ok').onclick = () => {
    const currentTip = tips[demo.tipIdx];
    if (currentTip.onOk) currentTip.onOk();
    demo.tipIdx++;
    if (demo.tipIdx < tips.length) {
      _showDemoTip(tips);
    } else {
      overlay.hidden = true;
    }
  };
}

function showDemoTips(round) {
  const tips = DEMO_TIPS[round];
  if (!tips || tips.length === 0) return;
  demo.tipIdx = 0;
  _showDemoTip(tips);
}

function showDemoTurnEndTips() {
  demo.tipIdx = 0;
  _showDemoTip(DEMO_TIPS_TURN_END);
}

function showAfterFoundTips() {
  demo.tipIdx = 0;
  _showDemoTip(DEMO_TIPS_AFTER_FIRST_FOUND);
}

// ─── Injection des hooks dans game.js ─────────────────────────────────────────
demoHooks.showTips           = showDemoTips;
demoHooks.showTurnEndTips    = showDemoTurnEndTips;
demoHooks.showAfterFoundTips = showAfterFoundTips;

// ─── Lancement de la démo ─────────────────────────────────────────────────────
export async function startDemoTurn() {
  state.currentRound    = 1;
  state.currentTeamIdx  = 0;
  state.teamPlayerIdx   = [0];
  state.noTeamsMode     = false;
  state.teams           = [{
    color: 'var(--volcan)',
    players: ['Enfant', 'Adulte'],
    score: [0, 0, 0],
  }];
  state.playerIsChild = new Set(['Enfant']);
  state.actionHistory = [];
  state.redoStack     = [];

  const words     = await getShuffledWords(null, true);
  const demoWords = words.slice(0, 3);
  state.allWords   = demoWords;
  state.roundWords = [...demoWords];
  state.currentWord = null;

  if (window.matchMedia('(orientation: portrait)').matches) {
    demo.waiting = true;
    el('rotate-overlay').classList.add('active');
    return;
  }

  demo.mode           = true;
  demo.firstWordFound = false;
  demo.childReadFrozen = false;
  startPreTurn();
}
