/**
 * tutorial.js – Mode tutoriel guidé étape par étape.
 *
 * Ce module n'a aucune importation statique de board.js ou game.js afin
 * d'éviter toute dépendance circulaire à l'initialisation.
 * board.js et game.js importent { tutorialCallbacks } depuis ce fichier.
 */

// ─── Callbacks — appelés par board.js / game.js ────────────────────────────
// board.js et game.js lisent et appellent ces fonctions au moment opportun.
export const tutorialCallbacks = {
    onTileSwap: null,      // (i, j, hadMatch: bool) → void
    onMatch: null,         // (type: string, color: string|null, len: number) → void
    onSpellCast: null,     // () → void
    onEnemyDefeated: null, // () → void
    useDumbAI: false,      // board.js lit ce flag dans enemyMakeMove
};

// ─── Constantes internes ───────────────────────────────────────────────────
const TOTAL_STEPS = 5;
const TUTO_SPELL_ID = 'tutorial_fireball';
const TUTORIAL_COMPLETED_KEY = 'match3_tutorial_done';

const TUTORIAL_SPELL = {
    id: TUTO_SPELL_ID,
    name: 'Éclair du tutoriel',
    emoji: '🔥',
    color: 'red',
    cost: 6,
    dmg: 6,
    minLevel: 1,
    description: 'Sort de tutoriel : inflige 6 dégâts de feu.',
};

// Ennemi tutoriel — très faible, IA aléatoire, aucun sort
export const TUTORIAL_ENEMY = {
    name: 'Mannequin',
    raceEmoji: '🤖',
    level: 1,
    hp: 25,
    maxHp: 25,
    attack: 2,
    defense: 0,
    mana: { red: 0, blue: 0, green: 0, yellow: 0, purple: 0 },
    manaCaps: { red: 50, blue: 50, green: 50, yellow: 50, purple: 50 },
    spells: [],
    weapon: null,
    abilities: [],
    statusEffects: {},
    bonusTurn: 0,
    inventoryItem: null,
    resistances: {},
    combatPoints: 0,
    useDumbAI: true,
    isTutorialEnemy: true,
    dropProfile: { dropChance: 0, goldMult: 0, weaponChance: 0 },
};

// Définition des 5 étapes du tutoriel
const STEPS = [
    {
        step: 1,
        icon: '🔄',
        title: 'Déplacer une tuile',
        desc: 'Cliquez sur une tuile, puis sur une tuile <strong>adjacente</strong> pour les échanger. Un déplacement n\'est valide que s\'il crée un alignement de 3 tuiles identiques ou plus.',
    },
    {
        step: 2,
        icon: '💀',
        title: 'Match de crânes',
        desc: 'Alignez <strong>3 crânes 💀 ou plus</strong> pour infliger des dégâts à l\'ennemi ! Les tuiles en surbrillance indiquent un échange qui créera un match de crânes.',
    },
    {
        step: 3,
        icon: '✨',
        title: 'Générer du mana',
        desc: 'Alignez <strong>3 tuiles colorées identiques</strong> (rouge, bleu, vert, jaune ou violet) pour générer du mana. Le mana est nécessaire pour lancer des sorts puissants !',
    },
    {
        step: 4,
        icon: '🪄',
        title: 'Lancer un sort',
        desc: 'Vous avez du mana rouge 🔴 ! Cliquez sur le bouton du sort <strong>"Éclair du tutoriel"</strong> en bas pour l\'utiliser et infliger des dégâts à l\'ennemi.',
    },
    {
        step: 5,
        icon: '⚔️',
        title: 'Terminer le combat',
        desc: 'Réduisez les <strong>PV de l\'ennemi à 0</strong> pour remporter la victoire ! Utilisez les crânes, les sorts et les tuiles colorées.',
    },
];

// ─── État interne ──────────────────────────────────────────────────────────
let _active = false;
let _step = 0;
let _hadSpellBefore = false;
let _highlightedElements = [];

// ─── API publique ──────────────────────────────────────────────────────────

export function isTutorialActive() {
    return _active;
}

export function getTutorialStep() {
    return _step;
}

export function hasTutorialBeenCompleted() {
    try {
        return localStorage.getItem(TUTORIAL_COMPLETED_KEY) === '1';
    } catch (_) {
        return false;
    }
}

/**
 * Affiche le modal de proposition du tutoriel.
 * @param {Function} [onDecline] - callback si le joueur refuse
 */
export function proposeTutorial(onDecline) {
    if (hasTutorialBeenCompleted()) {
        onDecline?.();
        return;
    }
    const modal = document.getElementById('tutorial-proposal-modal');
    if (!modal) {
        onDecline?.();
        return;
    }

    modal.classList.add('active');

    const yesBtn = document.getElementById('tutorial-proposal-yes');
    const noBtn = document.getElementById('tutorial-proposal-no');

    const cleanup = () => {
        modal.classList.remove('active');
        if (yesBtn) yesBtn.onclick = null;
        if (noBtn) noBtn.onclick = null;
    };

    if (yesBtn) {
        yesBtn.onclick = () => {
            cleanup();
            startTutorial();
        };
    }
    if (noBtn) {
        noBtn.onclick = () => {
            cleanup();
            onDecline?.();
        };
    }
}

/**
 * Démarre le tutoriel (combat guidé étape par étape).
 */
export function startTutorial() {
    if (_active) return;
    _active = true;
    _step = 1;
    tutorialCallbacks.useDumbAI = true;

    _injectTutorialSpell().then(() => {
        _startTutorialCombat();
    });
}

/**
 * Quitte le tutoriel immédiatement.
 */
export function quitTutorial() {
    if (!_active) return;
    _cleanupHighlights();
    _hideOverlay();
    _clearHooks();
    tutorialCallbacks.useDumbAI = false;
    _active = false;
    _step = 0;
    _removeTutorialSpell();
    import('./game.js').then(m => {
        m.log('🚪 Tutoriel quitté. Bonne chance !');
    });
}

/**
 * Initialise les listeners des boutons du tutoriel (à appeler dans init()).
 */
export function initTutorialUI() {
    // Bouton "Quitter le tutoriel" dans l'overlay
    const quitBtn = document.getElementById('tutorial-quit-btn');
    if (quitBtn) {
        quitBtn.addEventListener('click', () => {
            if (confirm('Êtes-vous sûr de vouloir quitter le tutoriel ?')) {
                quitTutorial();
            }
        });
    }

    // Bouton de lancement manuel du tutoriel (si présent dans le DOM)
    const startBtn = document.getElementById('tutorial-start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            if (!_active) startTutorial();
        });
    }
}

// ─── Mise en place du combat tutoriel ─────────────────────────────────────

async function _injectTutorialSpell() {
    const m = await import('./game.js');
    _hadSpellBefore = (m.player.activeSpells || []).length > 0;
    // Donner un sort tutoriel de base si le joueur n'a aucun sort actif
    if (!_hadSpellBefore) {
        const alreadyHas = (m.player.spells || []).some(s => s.id === TUTO_SPELL_ID);
        if (!alreadyHas) {
            m.player.spells = [TUTORIAL_SPELL, ...(m.player.spells || [])];
            m.player.availableSpells = [TUTORIAL_SPELL, ...(m.player.availableSpells || [])];
        }
        m.player.activeSpells = [TUTORIAL_SPELL];
    }
}

async function _removeTutorialSpell() {
    if (_hadSpellBefore) return; // le joueur avait déjà ses sorts, ne rien toucher
    try {
        const m = await import('./game.js');
        m.player.spells = (m.player.spells || []).filter(s => s.id !== TUTO_SPELL_ID);
        m.player.activeSpells = (m.player.activeSpells || []).filter(s => s.id !== TUTO_SPELL_ID);
        m.player.availableSpells = (m.player.availableSpells || []).filter(s => s.id !== TUTO_SPELL_ID);
        m.createSpellButtons?.();
    } catch (_) { /* ignore */ }
}

function _startTutorialCombat() {
    import('./game.js').then(gameModule => {
        const { startNewCombat, updateStats, createSpellButtons, log } = gameModule;

        // Démarrer le combat contre le mannequin
        startNewCombat(TUTORIAL_ENEMY);

        import('./board.js').then(boardModule => {
            boardModule.generateBoard();
            boardModule.renderBoard();
            updateStats();
            createSpellButtons();
            log('📚 Tutoriel démarré ! Suivez les instructions dans le panneau en bas à droite.');
        });

        // Afficher les éléments de combat et basculer sur l'onglet combat
        document.querySelector('.stats-container').style.display = 'flex';
        document.getElementById('board').style.display = 'grid';
        document.getElementById('spells-container').style.display = 'flex';

        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('tab-combat')?.classList.add('active');
        const firstTabBtn = document.querySelectorAll('.tab-btn')[0];
        if (firstTabBtn) firstTabBtn.classList.add('active');

        // Afficher l'overlay et activer l'étape 1
        _renderOverlay();
        _activateStep(1);
    });
}

// ─── Gestion des étapes ────────────────────────────────────────────────────

function _activateStep(step) {
    _step = step;
    _cleanupHighlights();
    _updateOverlay(step);
    _installHooks(step);

    // Déclenchement des surbrillances avec léger délai (laisse le board se stabiliser)
    if (step === 1 || step === 2 || step === 3 || step === 5) {
        setTimeout(() => _highlightBoardForStep(step), 700);
    } else if (step === 4) {
        // S'assurer que le joueur a assez de mana rouge pour le sort tutoriel
        import('./game.js').then(m => {
            if ((m.player.mana.red || 0) < 6) {
                m.player.mana.red = 10;
                m.updateStats();
                m.log('🔴 Tutoriel : 10 mana rouge offert pour utiliser votre sort !');
            }
            m.createSpellButtons(); // Mettre à jour l'affichage (bouton actif)
        });
        setTimeout(() => _highlightSpellButtons(), 400);
    }
}

function _advanceStep() {
    if (!_active) return;
    _cleanupHighlights();
    _clearHooks();

    const completedStep = _step;

    if (completedStep >= TOTAL_STEPS) {
        _completeTutorial();
        return;
    }

    // Afficher un message de réussite, puis passer à l'étape suivante
    const msg = _feedbackMessages[completedStep] || '✅ Étape réussie !';
    _showFeedbackBanner(msg, () => {
        if (_active) _activateStep(completedStep + 1);
    });
}

function _completeTutorial() {
    _clearHooks();
    _cleanupHighlights();
    _hideOverlay();
    tutorialCallbacks.useDumbAI = false;
    const wasActive = _active;
    _active = false;
    _step = 0;

    if (wasActive) {
        try {
            localStorage.setItem(TUTORIAL_COMPLETED_KEY, '1');
        } catch (_) { /* ignore */ }

        _showFeedbackBanner('🏆 Tutoriel terminé ! Bonne aventure !', null, true);
        import('./game.js').then(m => {
            m.log('🏆 Tutoriel terminé ! Vous maîtrisez les bases. À l\'aventure !');
        });
        _removeTutorialSpell();
    }
}

const _feedbackMessages = {
    1: '✅ Bravo ! Vous avez échangé deux tuiles !',
    2: '✅ Excellent ! Les crânes infligent des dégâts !',
    3: '✅ Parfait ! Vous avez généré du mana !',
    4: '✅ Super ! Vous avez lancé un sort !',
};

// ─── Hooks par étape ──────────────────────────────────────────────────────

function _installHooks(step) {
    _clearHooks();

    if (step === 1) {
        tutorialCallbacks.onTileSwap = (i, j, hadMatch) => {
            if (hadMatch) _advanceStep();
        };

    } else if (step === 2) {
        tutorialCallbacks.onMatch = (type) => {
            if (type === 'skull') _advanceStep();
        };

    } else if (step === 3) {
        tutorialCallbacks.onMatch = (type) => {
            if (type === 'color') _advanceStep();
        };

    } else if (step === 4) {
        tutorialCallbacks.onSpellCast = () => {
            _advanceStep();
        };

    } else if (step === 5) {
        tutorialCallbacks.onEnemyDefeated = () => {
            // Petit délai pour laisser l'animation de victoire commencer
            setTimeout(() => _completeTutorial(), 200);
        };
    }
}

function _clearHooks() {
    tutorialCallbacks.onTileSwap = null;
    tutorialCallbacks.onMatch = null;
    tutorialCallbacks.onSpellCast = null;
    tutorialCallbacks.onEnemyDefeated = null;
}

// ─── Surbrillances ────────────────────────────────────────────────────────

/**
 * Calcule la paire de tuiles à mettre en surbrillance selon l'étape.
 * – step 2 : cherche un échange qui crée un match de crânes
 * – step 3 : cherche un échange qui crée un match de couleur
 * – sinon  : meilleur move disponible (quel que soit le type)
 */
function _highlightBoardForStep(step) {
    import('./board.js').then(bm => {
        const board = bm.board; // live binding suffisant ici (board est stable)
        import('./matchMechanics.js').then(mm => {
            const moves = mm.findPossibleMatches(board);
            if (!moves || moves.length === 0) return;

            let target = null;

            if (step === 2 || step === 3) {
                const wantType = step === 2 ? 'skull' : 'color';
                for (const mv of moves) {
                    // Simuler le swap pour voir quels matchs il génère
                    const testBoard = [...board];
                    [testBoard[mv.from], testBoard[mv.to]] = [testBoard[mv.to], testBoard[mv.from]];
                    const matches = mm.collectMatches(testBoard);
                    if (matches.some(m => m.info.type === wantType)) {
                        target = mv;
                        break;
                    }
                }
                // Fallback : n'importe quel move
                if (!target) target = moves[0];
            } else {
                target = moves[0];
            }

            if (!target) return;
            const boardDiv = document.getElementById('board');
            if (!boardDiv) return;
            const tiles = boardDiv.children;

            [target.from, target.to].forEach(idx => {
                const tile = tiles[idx];
                if (tile) {
                    tile.classList.add('tutorial-highlight');
                    _highlightedElements.push(tile);
                }
            });
        });
    });
}

function _highlightSpellButtons() {
    const container = document.getElementById('spell-buttons');
    if (!container) return;

    // Mettre en surbrillance tous les sorts actifs du joueur
    const buttons = container.querySelectorAll('.enemy-spell-item:not(.disabled)');
    buttons.forEach(btn => {
        btn.classList.add('tutorial-highlight');
        _highlightedElements.push(btn);
    });

    // Encadrer aussi le conteneur
    container.classList.add('tutorial-highlight-container');
    _highlightedElements.push(container);
}

function _cleanupHighlights() {
    _highlightedElements.forEach(el => {
        if (!el) return;
        el.classList.remove('tutorial-highlight');
        el.classList.remove('tutorial-highlight-container');
    });
    _highlightedElements = [];
}

// ─── UI Overlay ───────────────────────────────────────────────────────────

function _renderOverlay() {
    const overlay = document.getElementById('tutorial-overlay');
    if (overlay) overlay.classList.remove('hidden');
}

function _hideOverlay() {
    const overlay = document.getElementById('tutorial-overlay');
    if (overlay) overlay.classList.add('hidden');
}

function _updateOverlay(step) {
    const stepData = STEPS.find(s => s.step === step);
    if (!stepData) return;

    const elIcon = document.getElementById('tutorial-icon');
    const elTitle = document.getElementById('tutorial-title');
    const elDesc = document.getElementById('tutorial-desc');
    const elCurrent = document.getElementById('tutorial-step-current');

    if (elIcon) elIcon.textContent = stepData.icon;
    if (elTitle) elTitle.textContent = stepData.title;
    if (elDesc) elDesc.innerHTML = stepData.desc;
    if (elCurrent) elCurrent.textContent = step;

    const overlay = document.getElementById('tutorial-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
        overlay.classList.remove('step-pop');
        // force reflow pour relancer l'animation
        void overlay.getBoundingClientRect();
        overlay.classList.add('step-pop');
    }
}

/**
 * Affiche un bandeau de retour d'information temporaire.
 * @param {string} message
 * @param {Function|null} [callback] - appelé après disparition
 * @param {boolean} [isSuccess]
 */
function _showFeedbackBanner(message, callback, isSuccess = false) {
    const banner = document.getElementById('tutorial-feedback');
    if (!banner) {
        setTimeout(() => callback?.(), 100);
        return;
    }

    banner.textContent = message;
    banner.classList.remove('hidden', 'success');
    if (isSuccess) banner.classList.add('success');
    // Forcer le display avant d'ajouter visible
    banner.style.display = 'block';
    void banner.getBoundingClientRect();
    banner.classList.add('visible');

    setTimeout(() => {
        banner.classList.remove('visible');
        setTimeout(() => {
            banner.classList.add('hidden');
            banner.style.display = '';
            callback?.();
        }, 350);
    }, isSuccess ? 3000 : 1600);
}
