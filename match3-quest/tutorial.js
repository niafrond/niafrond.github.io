/**
 * tutorial.js – Mode tutoriel guidé étape par étape.
 *
 * Ce module n'a aucune importation statique de board.js ou game.js afin
 * d'éviter toute dépendance circulaire à l'initialisation.
 * board.js et game.js importent { tutorialCallbacks } depuis ce fichier.
 */

import { icon } from './icons.js';

// ─── Callbacks — appelés par board.js / game.js ────────────────────────────
// board.js et game.js lisent et appellent ces fonctions au moment opportun.
export const tutorialCallbacks = {
    onTileSwap: null,      // (i, j, hadMatch: bool) → void
    onMatch: null,         // (type: string, color: string|null, len: number) → void
    onSpellCast: null,     // () → void
    onEnemyDefeated: null, // () → void
    useDumbAI: false,      // board.js lit ce flag dans enemyMakeMove
    allowSwap: null,       // (i, j, board) → bool : refuse tout échange autre que celui demandé (board.js, selectTile)
    allowSpell: null,      // (spell) → bool : refuse tout sort autre que celui demandé (game.js, castSpell)
};

// ─── Constantes internes ───────────────────────────────────────────────────
const TOTAL_STEPS = 5;
const TUTO_SPELL_ID = 'tutorial_fireball';
const TUTORIAL_COMPLETED_KEY = 'match3_tutorial_done';
const ENEMY_FINISH_HP = 10;      // PV laissés à l'adversaire après le sort : un dernier coup suffit à conclure
const ENEMY_MIN_HP_EARLY = 30;   // PV minimaux avant le sort, pour que les premiers coups ne l'achèvent pas

// Plateau pré-généré garanti sans match initial, avec 8+ coups possibles dont :
//   – 1 coup crâne : échanger index 35 (4,3)=skull et index 43 (5,3)=blue → 4 crânes alignés en ligne 5
//   – plusieurs coups couleur disponibles dès le départ
// prettier-ignore
const TUTORIAL_BOARD = [
    'red',   'red',    'green',  'blue',   'blue',   'yellow', 'purple', 'purple',  // ligne 0
    'green', 'blue',   'red',    'red',    'green',  'purple', 'blue',   'blue',    // ligne 1
    'blue',  'green',  'blue',   'green',  'yellow', 'red',    'green',  'red',     // ligne 2
    'yellow','purple', 'yellow', 'purple', 'red',    'blue',   'red',    'yellow',  // ligne 3
    'purple','yellow', 'green',  'skull',  'blue',   'green',  'yellow', 'purple',  // ligne 4 : skull idx 35
    'green', 'skull',  'skull',  'blue',   'skull',  'red',    'yellow', 'blue',    // ligne 5 : skulls idx 41,42,44
    'red',   'blue',   'yellow', 'green',  'purple', 'yellow', 'blue',   'red',     // ligne 6
    'blue',  'red',    'purple', 'yellow', 'green',  'blue',   'purple', 'green',   // ligne 7
];

const TUTORIAL_SPELL = {
    id: TUTO_SPELL_ID,
    name: 'Flèche d\'entraînement',
    color: 'red',
    type: 'damage',
    cost: 6,
    dmg: 6,
    minLevel: 1,
    description: 'Sort de tutoriel : une flèche enflammée qui inflige 6 dégâts de feu.',
};

// Ennemi tutoriel — mannequin d'entraînement de l'école de Hou Yi, très faible, IA aléatoire, aucun sort
export const TUTORIAL_ENEMY = {
    name: 'Mannequin d\'entraînement',
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
        icon: 'refresh',
        title: 'Déplacer une tuile',
        desc: 'Bienvenue à l\'école de Hou Yi ! Cliquez sur l\'une des deux <strong>tuiles en surbrillance</strong>, puis sur l\'autre pour les échanger. Un échange n\'est valide que s\'il aligne 3 tuiles identiques ou plus : seul ce mouvement est autorisé pour l\'instant.',
    },
    {
        step: 2,
        icon: 'skull',
        title: 'Frapper les crânes',
        desc: `Alignez <strong>3 crânes ${icon('skull')} ou plus</strong> pour infliger des dégâts à votre adversaire ! Faites <strong>l\'échange en surbrillance</strong> : il frappera des crânes.`,
    },
    {
        step: 3,
        icon: 'spark',
        title: 'Générer du mana',
        desc: 'Alignez <strong>3 gâteaux de lune de la même saveur</strong> (rouge, bleu, vert, jaune ou violet) pour générer du mana. Faites <strong>l\'échange en surbrillance</strong> : le mana est nécessaire pour lancer des sorts puissants !',
    },
    {
        step: 4,
        icon: 'mana_red',
        title: 'Lancer un sort',
        desc: 'Cliquez sur le bouton de votre sort en bas pour le lancer et infliger des dégâts à votre adversaire.',
    },
    {
        step: 5,
        icon: 'bow',
        title: 'Terminer le combat',
        desc: `Il ne reste plus que quelques PV à votre adversaire : <strong>un dernier coup</strong> suffit pour remporter la victoire ! Frappez les crânes ${icon('skull')}, gagnez des flèches ${icon('arrow')}, alignez des gâteaux de lune et lancez vos sorts.`,
    },
];

// ─── État interne ──────────────────────────────────────────────────────────
let _active = false;
let _step = 0;
let _spellInjected = false;
let _tutoSpell = null;       // sort offensif utilisé à l'étape 4 (sort du joueur, ou sort d'entraînement injecté)
let _highlightedElements = [];
let _highlightTimer = null;
let _game = null;
let _bm = null;
let _mm = null;

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
let _duelEnemy = null;

export function startTutorial(opts = {}) {
    if (_active) return;
    _duelEnemy = opts.enemy || null;
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
    _stopHighlightLoop();
    _cleanupHighlights();
    _hideOverlay();
    _clearHooks();
    tutorialCallbacks.useDumbAI = false;
    _active = false;
    _step = 0;
    _removeTutorialSpell();
    import('./game.js').then(m => {
        m.log('Tutoriel quitté. Bonne chance, archer !');
    });
}

/**
 * Initialise les listeners des boutons du tutoriel (à appeler dans init()).
 */
export function initTutorialUI() {
    // Bouton replier / déplier : l'aide ne doit jamais gêner l'accès aux boutons
    const toggleBtn = document.getElementById('tutorial-toggle-btn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const overlay = document.getElementById('tutorial-overlay');
            const collapsed = overlay?.classList.toggle('collapsed');
            toggleBtn.textContent = collapsed ? '+' : '–';
        });
    }

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

function _findOffensiveSpell(player) {
    return (player.activeSpells || []).find(sp => sp && sp.type === 'damage' && sp.dmg > 0 && !sp.effect && sp.color && sp.cost);
}

async function _injectTutorialSpell() {
    const m = await import('./game.js');
    _spellInjected = false;
    _tutoSpell = _findOffensiveSpell(m.player);
    // Le joueur a normalement déjà un sort offensif ; sinon on lui prête le sort d'entraînement.
    if (!_tutoSpell) {
        _spellInjected = true;
        _tutoSpell = TUTORIAL_SPELL;
        m.player.spells = [TUTORIAL_SPELL, ...(m.player.spells || []).filter(s => s.id !== TUTO_SPELL_ID)];
        m.player.availableSpells = [TUTORIAL_SPELL, ...(m.player.availableSpells || []).filter(s => s.id !== TUTO_SPELL_ID)];
        m.player.activeSpells = [TUTORIAL_SPELL, ...(m.player.activeSpells || []).filter(s => s.id !== TUTO_SPELL_ID)].slice(0, 4);
    }
}

async function _removeTutorialSpell() {
    if (!_spellInjected) return; // le joueur avait déjà son sort offensif, ne rien toucher
    _spellInjected = false;
    try {
        const m = await import('./game.js');
        m.player.spells = (m.player.spells || []).filter(s => s.id !== TUTO_SPELL_ID);
        m.player.activeSpells = (m.player.activeSpells || []).filter(s => s.id !== TUTO_SPELL_ID);
        m.player.availableSpells = (m.player.availableSpells || []).filter(s => s.id !== TUTO_SPELL_ID);
        m.createSpellButtons?.();
    } catch (_) { /* ignore */ }
}

function _startTutorialCombat() {
    Promise.all([import('./game.js'), import('./board.js'), import('./matchMechanics.js')]).then(([g, b, mm]) => {
        _game = g; _bm = b; _mm = mm;
    }).then(() => import('./game.js')).then(gameModule => {
        const { startNewCombat, updateStats, createSpellButtons, log } = gameModule;

        // Démarrer le combat d'entraînement
        let enemy = TUTORIAL_ENEMY;
        if (_duelEnemy) {
            // Duel contre un vrai adversaire (Fengmeng) : on garde son identité mais on l'adoucit pour apprendre.
            enemy = Object.assign(_duelEnemy, {
                hp: Math.min(_duelEnemy.hp, 40), maxHp: Math.min(_duelEnemy.maxHp, 40),
                attack: Math.min(_duelEnemy.attack, 4), defense: 0,
                spells: [], abilities: [], useDumbAI: true, isTutorialEnemy: true
            });
            _duelEnemy = null;
        }
        startNewCombat(enemy);

        import('./board.js').then(boardModule => {
            boardModule.generateBoard();
            boardModule.applyBoard(TUTORIAL_BOARD);
            updateStats();
            createSpellButtons();
            log('Duel d\'entraînement ! Suivez les instructions dans le panneau en bas à droite.');
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
    _stopHighlightLoop();
    _adjustEnemyHp(step);
    _installHooks(step);

    if (step === 4) {
        // Le joueur doit avoir assez de mana pour lancer le sort demandé
        const spell = _tutoSpell;
        let extra = '';
        if (spell) {
            const m = _game;
            if ((m.player.mana[spell.color] || 0) < spell.cost) {
                m.player.mana[spell.color] = spell.cost;
                m.updateStats();
                m.log(`Tutoriel : votre maître vous offre le mana ${spell.color} nécessaire pour lancer ${spell.name} !`);
            }
            m.createSpellButtons(); // Mettre à jour l'affichage (bouton actif)
            extra = `Vous avez du mana ${icon('mana_' + spell.color)} ! Cliquez sur le bouton du sort <strong>"${spell.name}"</strong> en bas pour le lancer et infliger des dégâts à votre adversaire. Les échanges de tuiles sont suspendus.`;
        }
        _updateOverlay(step, extra);
        setTimeout(() => _highlightSpellButtons(), 400);
    } else {
        _updateOverlay(step);
        _startHighlightLoop();
    }
}

/**
 * Règle les PV de l'adversaire pour qu'il tienne juste assez longtemps : assez pour encaisser les premiers coups,
 * puis, à l'étape du sort, exactement les dégâts du sort + ENEMY_FINISH_HP (le dernier coup l'achève).
 */
function _adjustEnemyHp(step) {
    const m = _game;
    const foe = m?.enemy;
    if (!foe) return;
    if (step === 2 || step === 3) {
        foe.hp = Math.max(foe.hp, ENEMY_MIN_HP_EARLY);
        foe.maxHp = Math.max(foe.maxHp, foe.hp);
    } else if (step === 4 && _tutoSpell) {
        foe.hp = (_tutoSpell.dmg || 0) + ENEMY_FINISH_HP;
        foe.maxHp = Math.max(foe.maxHp, foe.hp);
    } else if (step === 5) {
        foe.hp = Math.max(1, Math.min(foe.hp, ENEMY_FINISH_HP));
    } else {
        return;
    }
    m.updateStats();
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
    const msg = _feedbackMessages[completedStep] || 'Étape réussie !';
    _showFeedbackBanner(msg, () => {
        if (_active) _activateStep(completedStep + 1);
    });
}

function _completeTutorial() {
    _stopHighlightLoop();
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

        _showFeedbackBanner('Tutoriel terminé ! Que les flèches de Hou Yi vous guident !', null, true);
        import('./game.js').then(m => {
            m.log('Tutoriel terminé ! Vous maîtrisez les bases. Les dix soleils vous attendent !');
        });
        _removeTutorialSpell();
    }
}

const _feedbackMessages = {
    1: 'Bravo ! Vous avez échangé deux tuiles !',
    2: 'Excellent ! Les crânes encaissent vos coups !',
    3: 'Parfait ! Les gâteaux de lune vous ont donné du mana !',
    4: 'Super ! Votre flèche a atteint sa cible !',
};

// ─── Hooks par étape ──────────────────────────────────────────────────────

function _installHooks(step) {
    _clearHooks();

    // Victoire à n'importe quel moment : le tutoriel est terminé (l'adversaire est réglé pour tomber à la fin)
    tutorialCallbacks.onEnemyDefeated = () => {
        // Petit délai pour laisser l'animation de victoire commencer
        setTimeout(() => _completeTutorial(), 200);
    };

    // Contrainte : seul le mouvement / le sort demandé est accepté
    tutorialCallbacks.allowSwap = _allowSwap;
    tutorialCallbacks.allowSpell = _allowSpell;

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
    }
}

function _clearHooks() {
    tutorialCallbacks.onTileSwap = null;
    tutorialCallbacks.onMatch = null;
    tutorialCallbacks.onSpellCast = null;
    tutorialCallbacks.onEnemyDefeated = null;
    tutorialCallbacks.allowSwap = null;
    tutorialCallbacks.allowSpell = null;
}

function _warn(message) {
    _game?.log(message);
}

/**
 * Échange demandé par l'étape en cours : vérifie que le plateau le permet, sinon remet le plateau d'entraînement.
 * Étapes 1 à 3 : un seul échange accepté ; étape 4 : aucun échange (il faut lancer le sort) ; étape 5 : libre.
 */
function _allowSwap(i, j, board) {
    if (_step === 4) {
        _warn(`Lancez d'abord le sort "${_tutoSpell?.name || ''}" en bas de l'écran.`);
        return false;
    }
    if (_step < 1 || _step > 3) return true;
    const target = _pickTarget(_step, board);
    if (!target) {
        // Le plateau actuel ne permet pas le coup demandé : on remet le plateau d'entraînement en place.
        _bm?.applyBoard(TUTORIAL_BOARD);
        _warn('Le plateau a été remis en place pour pouvoir faire le mouvement demandé.');
        return false;
    }
    if ((i === target.from && j === target.to) || (i === target.to && j === target.from)) return true;
    _warn('Faites l\'échange des deux tuiles en surbrillance.');
    return false;
}

function _allowSpell(spell) {
    if (_step === 4 && _tutoSpell && spell.id !== _tutoSpell.id) {
        _warn(`Lancez le sort "${_tutoSpell.name}".`);
        return false;
    }
    return true;
}

// ─── Surbrillances ────────────────────────────────────────────────────────

/**
 * Calcule l'échange attendu selon l'étape (null si le plateau ne le permet pas).
 * – step 2 : un échange qui crée un match de crânes
 * – step 3 : un échange qui crée un match de couleur
 * – step 5 : de préférence un échange qui frappe des crânes
 * – sinon  : le premier échange valide
 */
function _pickTarget(step, board) {
    if (!_mm || !board || board.some(t => !t)) return null;
    const moves = _mm.findPossibleMatches(board);
    if (!moves || moves.length === 0) return null;
    const makes = (mv, wantType) => {
        const testBoard = [...board];
        [testBoard[mv.from], testBoard[mv.to]] = [testBoard[mv.to], testBoard[mv.from]];
        return _mm.collectMatches(testBoard).some(m => m.info.type === wantType);
    };
    if (step === 2 || step === 3) {
        const wantType = step === 2 ? 'skull' : 'color';
        return moves.find(mv => makes(mv, wantType)) || null;
    }
    if (step === 5) return moves.find(mv => makes(mv, 'skull')) || moves[0];
    return moves[0];
}

function _stopHighlightLoop() {
    if (_highlightTimer) clearInterval(_highlightTimer);
    _highlightTimer = null;
}

// Garde la surbrillance alignée sur l'échange attendu (le plateau change entre les tours, renderBoard réécrit les classes).
function _startHighlightLoop() {
    _stopHighlightLoop();
    _highlightTimer = setInterval(_refreshHighlight, 400);
    setTimeout(_refreshHighlight, 700);
}

function _refreshHighlight() {
    if (!_active || !_bm || _step === 4) return;
    const tiles = document.getElementById('board')?.children;
    if (!tiles) return;
    const target = _pickTarget(_step, _bm.board);
    const wanted = target ? [tiles[target.from], tiles[target.to]].filter(Boolean) : [];
    _highlightedElements = _highlightedElements.filter(el => {
        if (wanted.includes(el)) return true;
        el.classList.remove('tutorial-highlight');
        return false;
    });
    wanted.forEach(el => {
        el.classList.add('tutorial-highlight');
        if (!_highlightedElements.includes(el)) _highlightedElements.push(el);
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

function _updateOverlay(step, descOverride) {
    const stepData = STEPS.find(s => s.step === step);
    if (!stepData) return;

    const elIcon = document.getElementById('tutorial-icon');
    const elTitle = document.getElementById('tutorial-title');
    const elDesc = document.getElementById('tutorial-desc');
    const elCurrent = document.getElementById('tutorial-step-current');

    if (elIcon) elIcon.innerHTML = icon(stepData.icon);
    if (elTitle) elTitle.textContent = stepData.title;
    if (elDesc) elDesc.innerHTML = descOverride || stepData.desc;
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
