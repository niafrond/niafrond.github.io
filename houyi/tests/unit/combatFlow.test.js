import { jest } from '@jest/globals';
import { readFileSync } from 'fs';
import {
    MIN_ANNOUNCE_MS, createAnnouncement, announceDurationMs, waitUntil, isHpBarEmpty,
    openingStrikeCount, isWeaknessShown
} from '../../combatFlow.js';
import { createActionGuard } from '../../actionGuard.js';
import { readExplorationViewSource } from './fixtures/explorationViewSource.js';
import { readGameSource } from './fixtures/gameSource.js';
import { readStyleSource } from './fixtures/styleSource.js';

const game = readGameSource();
const css = readStyleSource();

describe('annonces : 2 s minimum, fermables ensuite', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test('un clic avant 2 s est ignoré, après 2 s il ferme', () => {
        const done = jest.fn();
        const a = createAnnouncement({ autoMs: 6000, onDone: done });
        jest.advanceTimersByTime(MIN_ANNOUNCE_MS - 1);
        expect(a.canSkip()).toBe(false);
        expect(a.skip()).toBe(false);
        expect(done).not.toHaveBeenCalled();
        jest.advanceTimersByTime(1);
        expect(a.canSkip()).toBe(true);
        expect(a.skip()).toBe(true);
        expect(done).toHaveBeenCalledTimes(1);
        jest.advanceTimersByTime(10000);
        expect(done).toHaveBeenCalledTimes(1);   // jamais deux fois
    });
    test('sans clic elle se ferme seule, jamais avant 2 s', () => {
        const done = jest.fn();
        createAnnouncement({ autoMs: 500, onDone: done });
        jest.advanceTimersByTime(MIN_ANNOUNCE_MS - 1);
        expect(done).not.toHaveBeenCalled();
        jest.advanceTimersByTime(1);
        expect(done).toHaveBeenCalledTimes(1);
    });
    test('la durée automatique croît avec le nombre de lignes', () => {
        expect(announceDurationMs(0, 1)).toBe(MIN_ANNOUNCE_MS);
        expect(announceDurationMs(3, 1)).toBeGreaterThan(announceDurationMs(1, 1));
    });
    test('cancel termine sans condition', () => {
        const done = jest.fn();
        const a = createAnnouncement({ onDone: done });
        a.cancel();
        expect(done).toHaveBeenCalledTimes(1);
    });
});

describe('écran de victoire / défaite : barre de PV réellement vide', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test('isHpBarEmpty exige un compteur terminé et une valeur affichée à 0', () => {
        expect(isHpBarEmpty({ shownValue: 12, animating: true })).toBe(false);
        expect(isHpBarEmpty({ shownValue: 0, animating: true })).toBe(false);
        expect(isHpBarEmpty({ shownValue: 3, animating: false })).toBe(false);
        expect(isHpBarEmpty({ shownValue: 0, animating: false })).toBe(true);
        expect(isHpBarEmpty({ shownValue: null, animating: false })).toBe(true);
    });
    test('waitUntil attend la condition puis rappelle une seule fois', () => {
        let ready = false;
        const cb = jest.fn();
        waitUntil(() => ready, cb, { pollMs: 50, maxMs: 5000 });
        jest.advanceTimersByTime(1000);
        expect(cb).not.toHaveBeenCalled();
        ready = true;
        jest.advanceTimersByTime(60);
        expect(cb).toHaveBeenCalledTimes(1);
        jest.advanceTimersByTime(5000);
        expect(cb).toHaveBeenCalledTimes(1);
    });
    test('filet de sécurité : rappel après maxMs même si la barre ne se vide pas', () => {
        const cb = jest.fn();
        waitUntil(() => false, cb, { pollMs: 50, maxMs: 1000 });
        jest.advanceTimersByTime(1100);
        expect(cb).toHaveBeenCalledTimes(1);
    });
    test('game.js attend la barre de PV avant l\'écran de fin', () => {
        expect(game).toMatch(/function whenLoserHpBarEmpty/);
        expect(game).toMatch(/whenLoserHpBarEmpty\(isVictory, \(\) => \{[\s\S]*finalizeCombatEndUI\(isVictory\)/);
    });
});

describe('coups d\'ouverture et faiblesse repérée', () => {
    test('l\'embuscade donne un coup, la faiblesse repérée aucun', () => {
        expect(openingStrikeCount({ tags: ['ambush'] })).toBe(1);
        expect(openingStrikeCount({ tags: ['observed'] })).toBe(0);
        expect(openingStrikeCount({ tags: ['ambush', 'observed', 'trap'] })).toBe(1);
        expect(openingStrikeCount(null)).toBe(0);
    });
    test('la ligne Faiblesse n\'apparaît que si elle est repérée', () => {
        expect(isWeaknessShown({ weaknessRevealed: true })).toBe(true);
        expect(isWeaknessShown({ weaknessRevealed: false })).toBe(false);
        expect(isWeaknessShown(undefined)).toBe(false);
    });
    test('game.js n\'utilise plus \'observed\' pour les coups d\'ouverture et n\'a plus de bandeau séparé', () => {
        expect(game).not.toMatch(/t === 'observed'/);
        expect(game).not.toMatch(/showPrepBanner/);
        expect(game).toMatch(/showCombatIntro\(/);
        expect(game).not.toMatch(/bindEnemyCardTap/);   // le clic simple ne fait que changer le nom (appui long : infobulle complète)
    });
});

describe('boutons du joueur verrouillés hors de son tour', () => {
    test('l\'actionGuard refuse tout tant que le tour est verrouillé, puis réautorise', () => {
        const g = createActionGuard(() => 100000);
        g.setTurnLocked(true);
        expect(g.blockReason()).toBe('turn');
        g.setTurnLocked(false);
        expect(g.blockReason()).toBeNull();
    });
    test('reset() déverrouille', () => {
        const g = createActionGuard(() => 100000);
        g.setTurnLocked(true);
        g.reset();
        expect(g.isTurnLocked()).toBe(false);
    });
    test('game.js synchronise le verrouillage à chaque updateStats', () => {
        expect(game).toMatch(/export function updateStats\(\)\{\s*syncPlayerControlsLock\(\)/);
        expect(game).toMatch(/actionGuard\.setTurnLocked\(locked\)/);
        expect(css).toMatch(/#player-spells\.turn-locked/);
        // infobulles (appui long / survol) possibles à tout moment : la colonne n'est ni inerte ni sans pointeur
        expect(css).not.toMatch(/#player-spells\.turn-locked\s*\{[^}]*pointer-events/);
        expect(game).not.toMatch(/setAttribute\('inert'/);
    });
});

describe('écran de résultat : trois sections', () => {
    test('expérience, pièces et objets ont chacune titre, icône et cadre', () => {
        ['xp', 'gold', 'items'].forEach(k => {
            expect(game).toContain(`section('${k}'`);
            expect(css).toContain(`.battle-result-sec-${k}`);
        });
        expect(game).toMatch(/Aucun butin/);
        expect(css).toMatch(/100dvh/);
    });
});

describe('compteur de PV : moins de 4 s quel que soit l\'écart', () => {
    test.each([1, 10, 100, 400, 1000, 5000])('écart %i', async delta => {
        const { hpBarTiming, HP_BAR_MAX_ANIMATION_MS } = await import('../../combatFlow.js');
        const { intervalMs, unit } = hpBarTiming(delta);
        expect(Math.ceil(delta / unit) * intervalMs).toBeLessThanOrEqual(HP_BAR_MAX_ANIMATION_MS + intervalMs);
        expect(Math.ceil(delta / unit) * intervalMs).toBeLessThan(4000);
    });
});

describe('plateau : les matchs de l\'ennemi sont toujours résolus', () => {
    const board = readFileSync(new URL('../../board.js', import.meta.url), 'utf8');
    test('le premier échange, joueur ou ennemi, démarre la partie', () => {
        const swap = board.slice(board.indexOf('export function swapTiles'), board.indexOf('export function renderBoard'));
        expect(swap).toMatch(/\n    gameStarted = true;/);
        expect(swap).not.toMatch(/if\(currentTurn === 'player'\)\{\s*gameStarted = true;/);
    });
    test('cliquer une case de biome affiche brièvement son effet', () => {
        const sel = board.slice(board.indexOf('export function selectTile'), board.indexOf('export function selectTile') + 1200);
        expect(sel).toMatch(/announceClickedBiomeCell\(index\)/);
        expect(board).toMatch(/function announceClickedBiomeCell[\s\S]*?floatCellText\(index, cellBanner\(/);
    });
    test('un plateau de départ ne garde pas d\'alignement non résolu', () => {
        expect(board).toMatch(/if\(!gameStarted && !forceFullBoard\)\{[\s\S]*?hasMatchesOnBoard\(board\)\) generateNewBoard\(\)/);
    });
});

describe('compagnon renard', () => {
    test('l\'annonce s\'affiche avant le mouvement de Xiao Gui', () => {
        const i = game.indexOf("activeCompanionIds.has('xiao_gui')");
        const block = game.slice(i, i + 1600);
        expect(block.indexOf('showCombatAnimation')).toBeGreaterThan(-1);
        expect(block.indexOf('showCombatAnimation')).toBeLessThan(block.indexOf('foxMakeRandomMove()'));
        expect(block).toMatch(/onContinue:[^\n]*foxMakeRandomMove\(\)/);
    });
    test('le renard attend la fin des animations en cours avant d\'agir', () => {
        const i = game.indexOf("activeCompanionIds.has('xiao_gui')");
        const block = game.slice(i, i + 1600);
        expect(block.indexOf('afterPlayerAnimations(')).toBeGreaterThan(-1);
        expect(block.indexOf('afterPlayerAnimations(')).toBeLessThan(block.indexOf('showCombatAnimation'));
    });
});

describe('fin de combat : le mot Victoire / Défaite, puis le résultat, puis « Retour à l\'exploration »', () => {
    const main = readFileSync(new URL('../../main.js', import.meta.url), 'utf8');
    const body = (src, name) => src.slice(src.indexOf(`function ${name}`), src.indexOf('\n}\n', src.indexOf(`function ${name}`)));

    test("victoire et défaite passent par le même enchaînement, sans second écran « Cliquez pour continuer »", () => {
        const end = body(game, 'showEndCombatAnimation');
        expect(end).toMatch(/finalizeCombatEndUI\(isVictory\)/);
        expect(end).not.toMatch(/showCombatAnimation/);
    });

    test("le mot plein écran vient d'abord ; le résultat ne se met en place que plus tard, sous lui", () => {
        const final = body(game, 'finalizeCombatEndUI').replace(/\/\/.*$/gm, '');   // sans les commentaires
        expect(final).toMatch(/playCombatEndBanner\(isVictory,/);
        expect(final).not.toMatch(/showCombatResultScreen|combat-ended/);   // ni le résultat ni le bouton avant le mot
        const reveal = body(game, 'revealCombatEndUI');
        expect(reveal.indexOf('showCombatResultScreen(isVictory)')).toBeGreaterThan(-1);
        expect(reveal.indexOf('showCombatResultScreen(isVictory)')).toBeLessThan(reveal.indexOf("classList.add('combat-ended')"));
        expect(body(game, 'showCombatResultScreen')).not.toMatch(/Banner|combat-end-fade/);
    });

    test('le bouton de retour apparaît avec retard, une fois le résultat en place', () => {
        expect(css).toMatch(/body\.combat-ended #combat-controls #new-combat-btn \{[^}]*animation: returnBtnIn [\d.]+s ease-out 0\.9s backwards/);
        expect(css).toMatch(/@keyframes returnBtnIn/);
    });

    test("la musique de l'issue démarre avec le mot et boucle jusqu'au retour à l'exploration", () => {
        expect(game).toMatch(/document\.body\.dataset\.combatEnd = isVictory \? 'victory' : 'defeat'/);
        expect(main).toMatch(/document\.body\.dataset\.combatEnd\) return \[document\.body\.dataset\.combatEnd\]/);
        expect(main).toMatch(/enterExploration = \(\) => \{[\s\S]*?delete document\.body\.dataset\.combatEnd/);
        expect(game).toMatch(/startNewCombat[\s\S]*?delete document\.body\.dataset\.combatEnd/);
    });
});

describe('début de combat : jingles avant l\'animation, nom de l\'adversaire plus longtemps', () => {
    const view = readExplorationViewSource();
    const main = readFileSync(new URL('../../main.js', import.meta.url), 'utf8');

    test("aucun jingle de début de combat n'est joué à l'annonce", () => {
        const fn = view.slice(view.indexOf('function playBattleTransition'));
        expect(fn.slice(0, fn.indexOf('removeBattleTransition()'))).not.toMatch(/battleStart|bossStart/);
    });

    test("l'annonce dure au moins 3 s (le nom de l'adversaire reste lisible environ 2 s)", () => {
        expect(Number(view.match(/BATTLE_TRANSITION_MS = (\d+)/)[1])).toBeGreaterThanOrEqual(3000);
    });

    test("pas de jingle au début du combat et la musique de combat n'attend rien", () => {
        expect(game).not.toMatch(/playSfx\('combatStart'\)/);
        expect(main).not.toMatch(/COMBAT_INTRO_MS|combatIntroUntil/);
    });
});

describe('écrans de fin de combat : boucles animées (feu d\'artifice / cœur qui ne bat presque plus)', () => {
    const index = JSON.parse(readFileSync(new URL('../../sprites/ultimates/index.json', import.meta.url), 'utf8'));
    const sheet = id => new URL(`../../sprites/ultimates/${id}-seq.png`, import.meta.url);

    test.each(['combatend_victory', 'combatend_defeat'])('%s : planche rangée, en boucle, 96 images de 144×256 à 24 i/s', id => {
        const meta = index[`${id}-seq`];
        expect(meta).toMatchObject({ frames: 96, fps: 24, size: [144, 256], loop: true });
        const png = readFileSync(sheet(id));
        expect(png.readUInt32BE(16)).toBe(meta.size[0] * meta.cols);
        expect(png.length).toBeLessThan(1_000_000);   // planche indexée (palette commune), pas un PNG de plusieurs Mo
    });

    test("le mot est joué sur la boucle de son issue, chargée d'avance, et sans elle il reste sur fond noir", () => {
        expect(game).toMatch(/victory: 'combatend_victory', defeat: 'combatend_defeat'/);
        expect(game).toMatch(/playCombatEndLoop\(fade, isVictory, reduced\)/);
        expect(game).toMatch(/startNewCombat[\s\S]*?preloadCombatEndSequences\(\)/);
        expect(game).toMatch(/if\(!seq \|\| !fade\.isConnected\) return;/);
        expect(css).toMatch(/\.combat-end-loop \{[^}]*object-fit: cover;[^}]*z-index: -1/);
    });
});

describe('barre de PV : part encaissable par le bouclier', () => {
    test('30 PV + 10 encaissables : la barre vaut 40, dont 10 de bouclier à la suite des PV', async () => {
        const { hpShieldSegment } = await import('../../combatFlow.js');
        expect(hpShieldSegment(30, 10, 40)).toEqual({ max: 40, absorb: 10, left: 75, width: 25 });
        // PV max plus grands que PV + bouclier : l'échelle reste celle des PV max
        expect(hpShieldSegment(30, 10, 100)).toEqual({ max: 100, absorb: 10, left: 30, width: 10 });
        // PV pleins + bouclier : la barre s'agrandit pour tout montrer
        expect(hpShieldSegment(100, 20, 100)).toEqual({ max: 120, absorb: 20, left: 100 / 120 * 100, width: 20 / 120 * 100 });
        // pas de bouclier : segment vide
        expect(hpShieldSegment(50, 0, 100)).toMatchObject({ max: 100, absorb: 0, width: 0 });
        expect(hpShieldSegment(NaN, -5, 0)).toMatchObject({ max: 1, absorb: 0, width: 0 });
    });
});
