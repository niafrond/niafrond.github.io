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
    dropProbabilities: null, // { skullProb, combatProb, jokerProb } : répartition des tuiles neuves pendant le tutoriel (board.js)
    enemyHpFloor: 0,       // PV minimaux de l'adversaire (game.js, applyDamage) : plancher qui l'empêche de mourir avant l'étape finale
    noSuggestions: false,  // true : pas de conseil « essayez d'échanger ces deux tuiles » (le tutoriel a ses propres surbrillances)
    dropTile: null,        // (index, board, turn) → tuile | null : tuile neuve imposée à cet emplacement (board.js, remplissage et tirage)
    pickEnemyMove: null,   // (moves) → coup | null : coup de l'adversaire imposé (board.js, enemyMakeRandomMove)
    allowSpell: null,      // (spell) → bool : refuse tout sort autre que celui demandé (game.js, castSpell)
    enemyDecision: null,   // () → décision | null : action imposée à l'adversaire à son tour (gameTurnFlow.js, enemyTurn)
    allowWeapon: null,     // () → bool : refuse l'arme hors de l'étape prévue (game.js, useWeapon)
    onWeaponUsed: null,    // () → void : le joueur vient de frapper avec son arme (game.js, useWeapon)
    onPlayerTurn: null,    // ('turn' | 'bonus') → void : le joueur (re)prend la main (gameTurnFlow.js, finishEnemyTurn / finishPlayerTurn)
};

// ─── Constantes internes ───────────────────────────────────────────────────
const TOTAL_STEPS = 11;
const TUTO_SPELL_ID = 'tutorial_fireball';
const TUTORIAL_COMPLETED_KEY = 'match3_tutorial_done';
const ENEMY_FINISH_HP = 10;      // PV laissés à l'adversaire après le sort : le dernier coup (3 crânes) l'achève
const COLORS = ['red', 'blue', 'green', 'yellow', 'purple'];
const COLOR_FR = { red: 'rouges', blue: 'bleus', green: 'verts', yellow: 'jaunes', purple: 'violets' };
const ENEMY_MIN_HP_EARLY = 30;   // PV minimaux avant le sort, pour que les premiers coups ne l'achèvent pas

// Répartition des tuiles neuves pendant le tutoriel (le reste = gâteaux de lune) : beaucoup de crânes et de qì,
// ni flèches ni joker, pour que chaque étape se résolve en quelques coups.
const TUTORIAL_DROP_PROBABILITIES = Object.freeze({ skullProb: 0.30, combatProb: 0.05, jokerProb: 0 });

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

// Tuiles neuves PRÉ-GÉNÉRÉES (96, tirées une fois avec une graine fixe, jamais trois identiques d'affilée) : au tour du joueur,
// les tuiles qui tombent suivent cette suite (beaucoup de crânes et de qì), donc le déroulement est le même à chaque partie.
// prettier-ignore
const TUTORIAL_DROPS = [
    'red', 'purple', 'red', 'skull', 'blue', 'skull', 'skull', 'blue',
    'red', 'yellow', 'green', 'yellow', 'purple', 'yellow', 'red', 'yellow',
    'skull', 'purple', 'skull', 'skull', 'yellow', 'blue', 'skull', 'skull',
    'red', 'red', 'purple', 'skull', 'purple', 'green', 'green', 'blue',
    'yellow', 'blue', 'skull', 'skull', 'red', 'red', 'purple', 'skull',
    'green', 'skull', 'green', 'skull', 'green', 'red', 'green', 'blue',
    'combat', 'skull', 'green', 'green', 'purple', 'skull', 'green', 'red',
    'skull', 'green', 'skull', 'skull', 'red', 'yellow', 'skull', 'purple',
    'green', 'blue', 'yellow', 'blue', 'green', 'combat', 'purple', 'yellow',
    'yellow', 'green', 'red', 'green', 'skull', 'green', 'skull', 'green',
    'combat', 'skull', 'red', 'red', 'skull', 'yellow', 'red', 'blue',
    'purple', 'blue', 'blue', 'skull', 'blue', 'yellow', 'green', 'yellow',
];
let _dropCursor = 0;
export const TUTORIAL_DROPS_SCRIPT = TUTORIAL_DROPS;

// Une tuile neuve ne doit jamais former une ligne de 3 avec les tuiles déjà posées (pas de cascade, donc pas de tour bonus).
function _formsLine(board, size, index, tile) {
    const at = (r, c) => (r < 0 || c < 0 || r >= size || c >= size ? undefined : board[r * size + c]);
    const r = Math.floor(index / size), c = index % size;
    const same = (a, b) => a === tile && b === tile;
    return same(at(r, c - 1), at(r, c - 2)) || same(at(r, c + 1), at(r, c + 2)) || same(at(r, c - 1), at(r, c + 1))
        || same(at(r - 1, c), at(r - 2, c)) || same(at(r + 1, c), at(r + 2, c)) || same(at(r - 1, c), at(r + 1, c));
}

// Tuile neuve du tutoriel. Tour du joueur : la suite pré-générée. Tour de l'adversaire : une couleur neutre (ni crâne, ni épée).
// Dans les deux cas elle ne forme aucune ligne avec les tuiles déjà posées : pas de cascade, donc pas de tour bonus ni de dégâts
// imprévus qui feraient dérailler le scénario.
export function _dropTile(index, board, turn) {
    const size = Math.round(Math.sqrt(board.length));
    let tile = null;
    if (turn !== 'enemy') {
        tile = TUTORIAL_DROPS[_dropCursor % TUTORIAL_DROPS.length];
        _dropCursor++;
        if (!_formsLine(board, size, index, tile)) return tile;
    }
    const start = (_dropCursor + index) % COLORS.length;
    for (let k = 0; k < COLORS.length; k++) {
        const color = COLORS[(start + k) % COLORS.length];
        if (!_formsLine(board, size, index, color)) return color;
    }
    return tile && COLORS.includes(tile) ? tile : COLORS[start];
}

// Coup de l'adversaire : jamais de crâne (donc aucun dégât), jamais de match de 4+ (donc aucun tour bonus), le plus petit gain possible.
export function _pickEnemyMove(moves) {
    if (!moves?.length) return null;
    const rank = m => (m.matchType === 'skull' ? 2 : 0) * 100 + (m.matchLength >= 4 ? 1 : 0) * 50 + m.matchLength;
    const best = Math.min(...moves.map(rank));
    const pool = moves.filter(m => rank(m) === best);
    return pool[Math.floor(Math.random() * pool.length)];
}

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

// Ennemi tutoriel — mannequin d'entraînement de la cour de Hou Yi, très faible, IA aléatoire, aucun sort
export const TUTORIAL_ENEMY = {
    name: 'Mannequin d\'entraînement',
    level: 1,
    hp: 25,
    maxHp: 25,
    attack: 2,
    defense: 0,
    attributes: { strength: 0, agility: 0, intelligence: 0, stamina: 0, morale: 0 },   // aucune agilité : ni esquive, ni initiative
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

// ─── Scénario ──────────────────────────────────────────────────────────────
// Le duel est écrit d'avance : Hou Yi (J1, le joueur) et Fengmeng (J2) enchaînent des coups prévus. C'est le joueur qui déclenche
// ses propres actions (échange de tuiles, lancer de sort), mais seule l'action demandée est acceptée ; les coups de Fengmeng sont imposés.
//   who   : 'player' | 'enemy'
//   kind  : 'swap' (échange de tuiles) | 'spell' (lancer de sort)
//   match : alignement attendu { type: 'color' | 'skull', len, side: 'me' | 'foe' (couleur du joueur ou de Fengmeng) }
const STEPS = [
    {   // J1 joue en premier : 3 gâteaux de sa couleur
        who: 'player', kind: 'swap', match: { type: 'color', len: 3, side: 'me' }, icon: 'spark',
        title: () => `Combinez trois gâteaux ${COLOR_FR[_myColor]}`,
        desc: () => `Vous jouez en premier ! Échangez les deux <strong>tuiles en surbrillance</strong> pour aligner <strong>3 gâteaux de lune ${COLOR_FR[_myColor]}</strong> : chaque gâteau aligné vous donne du qì ${icon('mana_' + _myColor)}.`,
        done: 'Bravo ! Vous avez gagné du qì.',
    },
    {   // J2 : 3 gâteaux de sa couleur
        who: 'enemy', kind: 'swap', match: { type: 'color', len: 3, side: 'foe' }, icon: 'refresh',
        title: () => "L'ennemi joue",
        desc: () => `Fengmeng joue à son tour sur le même plateau. Il aligne <strong>3 gâteaux de lune ${COLOR_FR[_foeColor]}</strong> et gagne du qì ${icon('mana_' + _foeColor)}, comme vous.`,
        done: 'Fengmeng a gagné du qì.',
    },
    {   // J1 : 3 crânes
        who: 'player', kind: 'swap', match: { type: 'skull', len: 3 }, icon: 'skull', hp: 'min',
        title: () => 'Combinez trois crânes',
        desc: () => `Alignez <strong>3 crânes ${icon('skull')}</strong> pour blesser Fengmeng. Faites <strong>l'échange en surbrillance</strong>.`,
        done: 'Fengmeng a encaissé vos crânes !',
    },
    {   // J2 : 3 crânes (le joueur subit des dégâts)
        who: 'enemy', kind: 'swap', match: { type: 'skull', len: 3 }, icon: 'skull',
        title: () => "L'ennemi joue",
        desc: () => `Fengmeng aligne <strong>3 crânes ${icon('skull')}</strong> : vous <strong>subissez des dégâts</strong>. Surveillez vos PV !`,
        done: 'Aïe ! Vous avez perdu des PV.',
    },
    {   // J1 : 4 gâteaux (tour bonus)
        who: 'player', kind: 'swap', match: { type: 'color', len: 4, side: 'me' }, icon: 'gift',
        title: () => `Combinez quatre gâteaux ${COLOR_FR[_myColor]}`,
        desc: () => `Un alignement de <strong>4 tuiles ou plus</strong> offre un <strong>tour bonus</strong> : vous rejouez tout de suite, sans que l'adversaire ne joue. Faites <strong>l'échange en surbrillance</strong>.`,
        done: 'Tour bonus ! Vous rejouez tout de suite.',
    },
    {   // J1 : lance un sort
        who: 'player', kind: 'spell', icon: 'bow', hp: 'min',
        title: () => 'Lancez votre sort',
        desc: () => `Vous avez assez de qì ${icon('mana_' + (_tutoSpell?.color || _myColor))} ! Cliquez sur le bouton du sort <strong>« ${_tutoSpell?.name || 'sort'} »</strong> en bas pour le lancer. Les échanges de tuiles sont suspendus.`,
        done: 'Votre flèche a atteint sa cible : Fengmeng n\'a plus que 10 PV !',
    },
    {   // J2 : lance un sort, J1 le bloque
        who: 'enemy', kind: 'spell', icon: 'shield',
        title: () => "L'ennemi joue",
        desc: () => `Fengmeng lance un sort, mais votre défense vous permet de <strong>bloquer</strong> le coup : un blocage total annule les dégâts, une parade les réduit.`,
        done: 'Blocage réussi : aucun dégât !',
    },
    {   // J1 : 4 flèches (tuiles d'action) : tour bonus, il utilise son arme tout de suite
        who: 'player', kind: 'swap', match: { type: 'combat', len: 4 }, icon: 'arrow',
        title: () => 'Combinez quatre flèches',
        desc: () => `Votre arme se déclenche avec des <strong>flèches ${icon('arrow')}</strong> : alignez <strong>4 tuiles d'action</strong> pour en gagner, et gagner un tour bonus pour frapper tout de suite. Faites <strong>l'échange en surbrillance</strong>.`,
        done: 'Tour bonus ! Frappez tout de suite avec votre arme.',
    },
    {   // J1 : frappe avec son arme (flèches offertes si besoin)
        who: 'player', kind: 'weapon', icon: 'bow',
        title: () => 'Utilisez votre arme',
        desc: () => `Vous avez gagné des flèches ${icon('arrow')} : cliquez sur <strong>« ${_game?.player?.equippedWeapon?.name || 'votre arme'} »</strong> en bas pour frapper. Les échanges de tuiles sont suspendus.`,
        done: 'Touché ! Votre arme frappe sans qu\'il faille aligner de crânes.',
    },
    {   // J2 : un petit coup sans danger
        who: 'enemy', kind: 'swap', match: { type: 'color', len: 3, side: 'other' }, icon: 'refresh',
        title: () => "L'ennemi joue",
        desc: () => `Fengmeng joue un dernier coup tranquille sur le plateau.`,
        done: '',
    },
    {   // J1 : 3 crânes, Fengmeng perd
        who: 'player', kind: 'swap', match: { type: 'skull', len: 5 }, icon: 'bow', hp: 'finish',
        title: () => 'Combinez cinq crânes pour créer un joker',
        desc: () => `Il ne reste que quelques PV à Fengmeng : alignez <strong>5 crânes ${icon('skull')}</strong> pour remporter la victoire ! Un alignement de 5 fait aussi apparaître un <strong>joker</strong>, qui remplace n'importe quelle tuile. Faites <strong>l'échange en surbrillance</strong>.`,
        done: '',
    },
];

// Sort de Fengmeng (étape 7) : un petit sort de dégâts de sa couleur, que le joueur bloque.
function _foeSpell() {
    return { id: 'tutorial_foe_spell', name: 'Rafale de Fengmeng', color: _foeColor, type: 'damage', cost: 3, dmg: 6, minLevel: 1, description: 'Sort de tutoriel.' };
}

// ─── État interne ──────────────────────────────────────────────────────────
let _active = false;
let _step = 0;                // 1..TOTAL_STEPS : étape du scénario en cours
let _spellInjected = false;
let _tutoSpell = null;       // sort offensif utilisé à l'étape 6 (sort du joueur, ou sort d'entraînement injecté)
let _myColor = 'red';        // couleur des gâteaux du joueur (celle de son sort)
let _foeColor = 'blue';      // couleur des gâteaux de Fengmeng
let _otherColor = 'green';   // troisième couleur (dernier coup de Fengmeng)
let _target = null;          // { from, to } : échange attendu à l'étape en cours (joueur) ou joué par Fengmeng
let _enemyActed = false;     // Fengmeng a déjà joué son coup prévu à ce tour (un éventuel tour bonus imprévu est libre)
let _freeMove = false;       // tour bonus imprévu du joueur : un échange libre est accepté
let _highlightedElements = [];
let _highlightTimer = null;
let _game = null;
let _bm = null;
let _mm = null;

const _cur = () => STEPS[_step - 1] || null;

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
    tutorialCallbacks.dropProbabilities = TUTORIAL_DROP_PROBABILITIES;
    tutorialCallbacks.noSuggestions = true;
    tutorialCallbacks.enemyHpFloor = 1;   // l'adversaire ne meurt qu'à l'étape finale
    tutorialCallbacks.dropTile = _dropTile;
    tutorialCallbacks.pickEnemyMove = _pickScriptedEnemyMove;
    tutorialCallbacks.enemyDecision = _enemyDecision;
    tutorialCallbacks.onPlayerTurn = _onPlayerTurn;
    _dropCursor = 0;
    _target = null;

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
    _resetCallbacks();
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
    // Les gâteaux du joueur sont de la couleur de son sort (rouge pour le sort d'entraînement) ; Fengmeng prend une autre couleur.
    _myColor = COLORS.includes(_tutoSpell.color) ? _tutoSpell.color : 'red';
    _foeColor = _myColor === 'blue' ? 'green' : 'blue';
    _otherColor = COLORS.find(c => c !== _myColor && c !== _foeColor);
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
        const { startNewCombat, updateStats, createSpellButtons, log } = g;

        // Démarrer le duel d'entraînement
        let enemy = TUTORIAL_ENEMY;
        if (_duelEnemy) {
            // Duel contre un vrai adversaire (Fengmeng) : on garde son identité mais on l'adoucit pour apprendre.
            enemy = Object.assign(_duelEnemy, {
                hp: Math.min(_duelEnemy.hp, 40), maxHp: Math.min(_duelEnemy.maxHp, 40),
                attack: Math.min(_duelEnemy.attack, 4), defense: 0,
                spells: [], abilities: [], useDumbAI: true, isTutorialEnemy: true, duel: null,   // pas de pièges ni de tirs rapides
                attributes: { ..._duelEnemy.attributes, agility: 0 }   // Fengmeng sans agilité : Hou Yi (J1) joue en premier
            });
            _duelEnemy = null;
        }
        startNewCombat(enemy);

        b.generateBoard();
        b.applyBoard(TUTORIAL_BOARD);
        updateStats();
        createSpellButtons();
        log('Duel d\'entraînement ! Suivez les instructions dans le panneau en bas à droite.');

        // Afficher les éléments de combat et basculer sur l'onglet combat
        document.querySelector('.stats-container').style.display = 'flex';
        document.getElementById('board').style.display = 'grid';
        document.getElementById('spells-container').style.display = 'flex';

        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('tab-combat')?.classList.add('active');
        const firstTabBtn = document.querySelectorAll('.tab-btn')[0];
        if (firstTabBtn) firstTabBtn.classList.add('active');

        // Afficher l'overlay et lancer le scénario : Hou Yi joue en premier
        const total = document.getElementById('tutorial-step-total');
        if (total) total.textContent = TOTAL_STEPS;
        _renderOverlay();
        _step = 1;
        _enemyActed = false;
        _freeMove = false;
        _installHooks();
        _beginPlayerStep();
    });
}

// ─── Coups prévus : repérage et mise en place ─────────────────────────────

// Alignement attendu par une étape (la couleur dépend de qui joue).
function _wanted(match) {
    return { type: match.type, len: match.len, color: match.type === 'color' ? (match.side === 'foe' ? _foeColor : match.side === 'other' ? _otherColor : _myColor) : null };
}

// Échange du plateau qui produit exactement l'alignement demandé, ou null.
export function _findScriptedMove(board, want, mm = _mm) {
    if (!mm || !board || board.some(t => !t) || mm.collectMatches(board).length) return null;
    for (const mv of mm.findPossibleMatches(board)) {
        const test = [...board];
        [test[mv.from], test[mv.to]] = [test[mv.to], test[mv.from]];
        const found = mm.collectMatches(test);
        const info = found.length === 1 ? found[0].info : null;
        if (info && info.type === want.type && info.len === want.len && (want.type !== 'color' || info.color === want.color)) return { from: mv.from, to: mv.to };
    }
    return null;
}

// Écrit sur le plateau un échange qui produit exactement l'alignement demandé : T T _ T (4) ou T T _ (3) dans une rangée, la case
// vide recevant, par l'échange avec la case du dessous, la tuile manquante. Renvoie { board, from, to } ou null.
export function _plantMove(board, want, mm = _mm) {
    const size = Math.round(Math.sqrt(board.length));
    const tile = want.type === 'color' ? want.color : want.type;   // 'skull' ou 'combat' : la tuile porte le nom du type
    const fillers = COLORS.filter(c => c !== tile);
    for (let r = 0; r < size - 1; r++) {
        for (let c = 0; c + want.len - 1 < size; c++) {
            const gap = c + 2;
            for (const filler of fillers) {
                const planted = [...board];
                for (let k = 0; k < want.len; k++) planted[r * size + c + k] = tile;
                planted[r * size + gap] = filler;
                planted[(r + 1) * size + gap] = tile;
                if (mm.collectMatches(planted).length) continue;
                const from = r * size + gap, to = (r + 1) * size + gap;
                const test = [...planted];
                [test[from], test[to]] = [test[to], test[from]];
                const found = mm.collectMatches(test);
                const info = found.length === 1 ? found[0].info : null;
                if (info && info.type === want.type && info.len === want.len && (want.type !== 'color' || info.color === want.color)) {
                    return { board: planted, from, to };
                }
            }
        }
    }
    return null;
}

// Trouve (ou prépare, en arrangeant le plateau) l'échange demandé par l'étape ; renvoie { from, to } ou null.
function _prepareMove(step) {
    const want = _wanted(step.match);
    const board = _bm.board;
    const found = _findScriptedMove(board, want);
    if (found) return found;
    const planted = _plantMove(board, want);
    if (!planted) return null;
    _bm.applyBoard(planted.board);
    return { from: planted.from, to: planted.to };
}

// ─── Gestion des étapes ────────────────────────────────────────────────────

// Début d'une étape du joueur : on prépare le plateau (ou le qì) et on affiche la consigne.
function _beginPlayerStep() {
    if (!_active || !_game) return;
    const step = _cur();
    if (!step || step.who !== 'player') return;
    _cleanupHighlights();
    _stopHighlightLoop();
    _enemyActed = false;
    _game.player.tutorialBlock = null;
    _installHooks();
    _adjustEnemyHp();
    _target = null;
    _updateOverlay(_step);

    if (step.kind === 'swap') {
        _target = _prepareMove(step);
        _startHighlightLoop();
    } else if (step.kind === 'spell' && _tutoSpell) {
        // Le joueur doit avoir assez de qì pour lancer le sort demandé
        const spell = _tutoSpell;
        if ((_game.player.mana[spell.color] || 0) < spell.cost) {
            _game.player.mana[spell.color] = spell.cost;
            _game.updateStats();
            _game.log(`Tutoriel : le qì ${spell.color} nécessaire pour lancer ${spell.name} vous est offert !`);
        }
        _game.createSpellButtons();   // met à jour l'affichage (bouton actif)
        setTimeout(() => { if (_active && _cur() === step) _highlightSpellButtons(); }, 400);
    }
    if (step.kind === 'weapon') {
        // Filet de sécurité : si les flèches gagnées ne suffisent pas pour l'arme équipée (arme plus chère), on complète.
        const weapon = _game.player.equippedWeapon;
        if (weapon && (_game.player.combatPoints || 0) < weapon.actionPoints) {
            _game.player.combatPoints = weapon.actionPoints;
            _game.log(`Tutoriel : les flèches nécessaires pour utiliser ${weapon.name} vous sont offertes !`);
        }
        _game.updateStats();
        import('./gameInventoryTabs.js').then(m => {
            m.createWeaponButton?.();
            setTimeout(() => { if (_active && _cur() === step) _highlightWeaponButton(); }, 300);
        });
    }
}

// Action imposée à Fengmeng à son tour (appelée par enemyTurn, à la place de la décision de l'IA).
function _enemyDecision() {
    const step = _cur();
    const idle = { action: 'board', data: {}, thinkingTime: 700, reason: 'hésite', isStupid: false, randomBoardMove: true };
    if (!_active || !_game || !step || step.who !== 'enemy' || _enemyActed) return _active ? idle : null;
    _enemyActed = true;
    _cleanupHighlights();
    _stopHighlightLoop();
    _updateOverlay(_step);

    if (step.kind === 'spell') {
        const spell = _foeSpell();
        const foe = _game.enemy;
        foe.spells = [spell];
        if ((foe.mana[spell.color] || 0) < spell.cost) foe.mana[spell.color] = spell.cost;   // il a de quoi lancer son sort
        _game.player.tutorialBlock = 'total';                                                 // Hou Yi bloque le coup (consommé par le tirage)
        _game.updateStats();
        return { action: 'spell', data: { spell, score: 100 }, thinkingTime: 900, reason: 'sort du tutoriel', isStupid: false };
    }
    _target = _prepareMove(step);
    return { ...idle, thinkingTime: 900, reason: 'coup prévu' };
}

// Coup de Fengmeng : l'échange prévu s'il existe, sinon le moins dangereux (jamais de crâne ni de tour bonus).
function _pickScriptedEnemyMove(moves) {
    if (_active && _cur()?.who === 'enemy' && _target) {
        const planned = moves.find(m => m.from === _target.from && m.to === _target.to) || moves.find(m => m.from === _target.to && m.to === _target.from);
        if (planned) return planned;
    }
    return _pickEnemyMove(moves);
}

// Le joueur reprend la main : fin de l'étape de Fengmeng (tour normal) ou nouvelle action du joueur (tour bonus).
function _onPlayerTurn(reason) {
    if (!_active || !_game) return;
    _enemyActed = false;
    _game.player.tutorialBlock = null;
    const step = _cur();
    if (!step) return;
    if (step.who === 'enemy') {
        if (reason === 'bonus') {   // tour bonus imprévu (cascade) : le joueur rejoue librement, le scénario reprend ensuite
            _freeMove = true;
            _game.log('Tour bonus : rejouez librement.');
            return;
        }
        _step++;                    // l'étape de Fengmeng est terminée
        if (step.done) _showFeedbackBanner(step.done, null);
    }
    _beginPlayerStep();
}

// L'action demandée au joueur est faite : on passe à l'étape suivante (Fengmeng joue, ou le joueur enchaîne).
function _completePlayerStep() {
    if (!_active) return;
    const step = _cur();
    _cleanupHighlights();
    _stopHighlightLoop();
    _target = null;
    if (_step >= TOTAL_STEPS) return;   // dernier coup : la victoire termine le tutoriel (onEnemyDefeated)
    _step++;
    if (step?.done) _showFeedbackBanner(step.done, null);
    _updateOverlay(_step);
}

/**
 * Règle les PV de Fengmeng pour que le scénario tienne : assez pour encaisser les premiers coups, 10 PV après le sort, et le
 * dernier coup (3 crânes) l'achève.
 */
function _adjustEnemyHp() {
    const foe = _game?.enemy;
    if (!foe) return;
    const hp = _cur()?.hp;
    if (hp === 'min') {
        foe.hp = Math.max(foe.hp, ENEMY_MIN_HP_EARLY);
        foe.maxHp = Math.max(foe.maxHp, foe.hp);
    } else if (hp === 'finish') {
        foe.hp = Math.max(1, Math.min(foe.hp, ENEMY_FINISH_HP));
        tutorialCallbacks.enemyHpFloor = 0;   // dernier coup : il peut mourir
    } else {
        return;
    }
    _game.updateStats();
}

function _completeTutorial() {
    _stopHighlightLoop();
    _clearHooks();
    _cleanupHighlights();
    _hideOverlay();
    _resetCallbacks();
    const wasActive = _active;
    _active = false;
    _step = 0;

    if (wasActive) {
        try {
            localStorage.setItem(TUTORIAL_COMPLETED_KEY, '1');
        } catch (_) { /* ignore */ }

        _showFeedbackBanner('Tutoriel terminé ! Que vos flèches soient justes !', null, true);
        import('./game.js').then(m => {
            m.log('Tutoriel terminé ! Vous maîtrisez les bases. Les dix soleils vous attendent !');
        });
        _removeTutorialSpell();
    }
}

function _resetCallbacks() {
    tutorialCallbacks.useDumbAI = false;
    tutorialCallbacks.dropProbabilities = null;
    tutorialCallbacks.noSuggestions = false;
    tutorialCallbacks.enemyHpFloor = 0;
    tutorialCallbacks.dropTile = null;
    tutorialCallbacks.pickEnemyMove = null;
    tutorialCallbacks.enemyDecision = null;
    tutorialCallbacks.onPlayerTurn = null;
    if (_game?.player) _game.player.tutorialBlock = null;
}

// ─── Hooks ────────────────────────────────────────────────────────────────

function _installHooks() {
    _clearHooks();

    // Victoire : le tutoriel est terminé (Fengmeng est réglé pour tomber au dernier coup)
    tutorialCallbacks.onEnemyDefeated = () => {
        // Petit délai pour laisser l'animation de victoire commencer
        setTimeout(() => _completeTutorial(), 200);
    };

    // Contrainte : seul l'échange / le sort demandé est accepté
    tutorialCallbacks.allowSwap = _allowSwap;
    tutorialCallbacks.allowSpell = _allowSpell;

    // Un échange valide du joueur : fin de son étape (le tour bonus imprévu ne compte pas)
    tutorialCallbacks.onTileSwap = (i, j, hadMatch) => {
        if (_freeMove) { _freeMove = false; return; }
        if (hadMatch && _cur()?.who === 'player' && _cur().kind === 'swap') _completePlayerStep();
    };

    // Un skull du joueur à la dernière étape : le dernier coup achève Fengmeng (les crânes seuls ne suffiraient pas à 10 PV)
    tutorialCallbacks.onMatch = (type) => {
        if (type === 'skull' && _step === TOTAL_STEPS && _game?.enemy) _game.enemy.hp = 1;
    };

    tutorialCallbacks.allowWeapon = _allowWeapon;
    tutorialCallbacks.onWeaponUsed = () => {
        if (_cur()?.kind !== 'weapon' || _cur().who !== 'player') return;
        _completePlayerStep();
    };

    tutorialCallbacks.onSpellCast = () => {
        if (_cur()?.kind !== 'spell' || _cur().who !== 'player') return;
        if (_game?.enemy) { _game.enemy.hp = ENEMY_FINISH_HP; _game.updateStats(); }
        _completePlayerStep();
    };
}

function _clearHooks() {
    tutorialCallbacks.onTileSwap = null;
    tutorialCallbacks.onMatch = null;
    tutorialCallbacks.onSpellCast = null;
    tutorialCallbacks.onEnemyDefeated = null;
    tutorialCallbacks.allowSwap = null;
    tutorialCallbacks.allowSpell = null;
    tutorialCallbacks.allowWeapon = null;
    tutorialCallbacks.onWeaponUsed = null;
}

function _warn(message) {
    _game?.log(message);
}

/** Échange demandé par l'étape en cours : seul cet échange est accepté (le plateau est arrangé si besoin). */
function _allowSwap(i, j, board) {
    if (_freeMove) return true;
    const step = _cur();
    if (!step || step.who !== 'player') return false;
    if (step.kind === 'weapon') {
        _warn(`Utilisez d'abord votre arme en bas de l'écran.`);
        return false;
    }
    if (step.kind === 'spell') {
        _warn(`Lancez d'abord le sort "${_tutoSpell?.name || ''}" en bas de l'écran.`);
        return false;
    }
    if (!_target) _target = _prepareMove(step);
    if (!_target) return true;
    if ((i === _target.from && j === _target.to) || (i === _target.to && j === _target.from)) return true;
    _warn('Faites l\'échange des deux tuiles en surbrillance.');
    return false;
}

function _allowWeapon() {
    const step = _cur();
    if (step?.who === 'player' && step.kind === 'weapon') return true;
    _warn('Pas encore : suivez les instructions du tutoriel.');
    return false;
}

function _allowSpell(spell) {
    const step = _cur();
    if (!(step?.who === 'player' && step.kind === 'spell')) {
        _warn('Pas encore : suivez les instructions du tutoriel.');
        return false;
    }
    if (_tutoSpell && spell.id !== _tutoSpell.id) {
        _warn(`Lancez le sort "${_tutoSpell.name}".`);
        return false;
    }
    return true;
}

// ─── Surbrillances ────────────────────────────────────────────────────────

function _stopHighlightLoop() {
    if (_highlightTimer) clearInterval(_highlightTimer);
    _highlightTimer = null;
}

// Garde la surbrillance alignée sur l'échange attendu (renderBoard réécrit les classes à chaque affichage).
function _startHighlightLoop() {
    _stopHighlightLoop();
    _highlightTimer = setInterval(() => { if (!document.hidden) _refreshHighlight(); }, 400);
    setTimeout(_refreshHighlight, 300);
}

function _refreshHighlight() {
    if (!_active || !_target || _cur()?.who !== 'player' || _cur().kind !== 'swap') return;
    const tiles = document.getElementById('board')?.children;
    if (!tiles) return;
    const wanted = [tiles[_target.from], tiles[_target.to]].filter(Boolean);
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

function _highlightWeaponButton() {
    const container = document.getElementById('weapon-button');
    if (!container) return;
    container.querySelectorAll('.enemy-spell-item:not(.disabled)').forEach(btn => {
        btn.classList.add('tutorial-highlight');
        _highlightedElements.push(btn);
    });
    container.classList.add('tutorial-highlight-container');
    _highlightedElements.push(container);
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
    const stepData = STEPS[step - 1];
    if (!stepData) return;

    const elIcon = document.getElementById('tutorial-icon');
    const elTitle = document.getElementById('tutorial-title');
    const elDesc = document.getElementById('tutorial-desc');
    const elCurrent = document.getElementById('tutorial-step-current');

    if (elIcon) elIcon.innerHTML = icon(stepData.icon);
    if (elTitle) elTitle.textContent = stepData.title();
    if (elDesc) { elDesc.innerHTML = stepData.desc(); elDesc.hidden = true; }   // seul le titre est affiché
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
