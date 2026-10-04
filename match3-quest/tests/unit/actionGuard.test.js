import fs from 'node:fs';
import { createActionGuard, ACTION_COOLDOWN_MS, BOARD_SETTLE_MS, BOARD_BUSY_TIMEOUT_MS } from '../../actionGuard.js';
import { collectMatches, getColorMatchManaBaseGain, getEffectiveMatchLength, getJokerMatchMultiplier } from '../../matchMechanics.js';

const clock = () => { let t = 100000; return { now: () => t, advance: (ms) => { t += ms; } }; };

describe('anti-bourrinage : actionGuard', () => {
    test('libre au départ', () => {
        const c = clock(); const g = createActionGuard(c.now);
        expect(g.blockReason()).toBeNull();
    });
    test('un clic d\'arme répété n\'est accepté qu\'une fois par délai', () => {
        const c = clock(); const g = createActionGuard(c.now);
        g.markPlayerAction();
        for (let i = 0; i < 10; i++) { c.advance(ACTION_COOLDOWN_MS / 12); expect(g.blockReason()).toBe('cooldown'); }
        c.advance(ACTION_COOLDOWN_MS);
        expect(g.blockReason()).toBeNull();
    });
    test('plateau en résolution : bloqué, puis encore un court instant après la fin', () => {
        const c = clock(); const g = createActionGuard(c.now);
        g.beginBoardAction();
        c.advance(3000);
        expect(g.blockReason()).toBe('board');
        g.endBoardAction();
        expect(g.blockReason()).toBe('settling');
        c.advance(BOARD_SETTLE_MS + 1);
        expect(g.blockReason()).toBeNull();
    });
    test('un échange sans match (action plateau immédiate) bloque aussi brièvement', () => {
        const c = clock(); const g = createActionGuard(c.now);
        g.endBoardAction();
        expect(g.blockReason()).toBe('settling');
    });
    test('filet de sécurité : un plateau « occupé » ne bloque pas indéfiniment', () => {
        const c = clock(); const g = createActionGuard(c.now);
        g.beginBoardAction();
        c.advance(BOARD_BUSY_TIMEOUT_MS + BOARD_SETTLE_MS + ACTION_COOLDOWN_MS + 10);
        expect(g.blockReason()).toBeNull();
    });
    test('reset (nouveau combat) lève tous les blocages', () => {
        const c = clock(); const g = createActionGuard(c.now);
        g.beginBoardAction(); g.markPlayerAction(); g.reset();
        expect(g.blockReason()).toBeNull();
    });
});

// Pourquoi rien ne couvrait cela : game.js dépend du DOM et n'est importé par aucun test ; les tests ne touchaient que
// les modules purs. La logique est donc isolée (actionGuard.js) et on vérifie ici, statiquement, son branchement.
describe('branchement du garde dans game.js / board.js', () => {
    const game = fs.readFileSync(new URL('../../game.js', import.meta.url), 'utf8');
    const board = fs.readFileSync(new URL('../../board.js', import.meta.url), 'utf8');
    const body = (src, name) => { const i = src.indexOf(`function ${name}(`); return src.slice(i, src.indexOf('\nexport function', i + 10)); };

    test.each(['useWeapon', 'castSpell', 'useInventoryItem'])('%s refuse les clics pressés et marque l\'action', (fn) => {
        const b = body(game, fn);
        expect(b).toContain('rejectRushedAction()');
        expect(b).toContain('actionGuard.markPlayerAction()');
        expect(b.indexOf('rejectRushedAction()')).toBeLessThan(b.indexOf('actionGuard.markPlayerAction()'));
    });
    test('le plateau signale début/fin de résolution et ignore les clics pendant celle-ci', () => {
        expect(board).toContain('actionGuard.beginBoardAction()');
        expect((board.match(/actionGuard\.endBoardAction\(\)/g) || []).length).toBeGreaterThanOrEqual(3);
        expect(body(board, 'selectTile')).toContain('actionGuard.isBoardBusy()');
    });
    test('nouveau combat : garde réinitialisé', () => {
        expect(body(game, 'restartCombat')).toContain('actionGuard.reset()');
    });
});

describe('jokers : ×2 mana / actions / crânes quand ils sont combinés', () => {
    const info = (type, len, jokerCount) => ({ type, len, color: type === 'color' ? 'blue' : null, jokerCount });
    test('multiplicateur ×2 dès qu\'un joker participe (non cumulé)', () => {
        expect(getJokerMatchMultiplier(info('color', 3, 0))).toBe(1);
        expect(getJokerMatchMultiplier(info('color', 3, 1))).toBe(2);
        expect(getJokerMatchMultiplier(info('color', 4, 2))).toBe(2);
    });
    test('mana : 3 tuiles + joker = 6 ; sans joker = 3', () => {
        expect(getColorMatchManaBaseGain(info('color', 3, 0))).toBe(3);
        expect(getColorMatchManaBaseGain(info('color', 3, 1))).toBe(6);
        expect(getColorMatchManaBaseGain(info('color', 5, 1))).toBe(10);
    });
    test('actions (épées) et crânes : longueur effective doublée', () => {
        expect(getEffectiveMatchLength(info('combat', 3, 1))).toBe(6);
        expect(getEffectiveMatchLength(info('skull', 4, 1))).toBe(8);
        expect(getEffectiveMatchLength(info('skull', 4, 0))).toBe(4);
    });
    test('collectMatches remonte bien jokerCount', () => {
        const n = 8; const board = new Array(n * n).fill(null).map((_, i) => ['red', 'green', 'blue', 'yellow'][(i * 7 + Math.floor(i / n)) % 4]);
        board[0] = 'combat'; board[1] = 'joker'; board[2] = 'combat';
        const m = collectMatches(board).find((x) => x.info.type === 'combat');
        expect(m).toBeTruthy();
        expect(m.info.jokerCount).toBe(1);
    });
});
