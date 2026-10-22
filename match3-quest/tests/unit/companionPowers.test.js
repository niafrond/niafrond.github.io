import { readFileSync } from 'fs';
import { COMPANION_POWERS, rollCompanionPowers, turnPowerIds, MANA_COLORS } from '../../companionPowers.js';
import { COMPANIONS } from '../../companions.js';
import { createSession, activeCompanionOf, setActiveCompanion } from '../../exploration.js';
import { QUESTS } from '../../story.js';

const game = readFileSync(new URL('../../game.js', import.meta.url), 'utf8');
const hero = { maxHp: 100, level: 10 };

describe('pouvoirs des compagnons', () => {
    test('chaque compagnon a un pouvoir, et inversement', () => {
        expect(COMPANIONS.map(c => c.id).sort()).toEqual(Object.keys(COMPANION_POWERS).sort());
    });
    test('Xiao Gui est géré à part, les autres jouent en fin de tour', () => {
        expect(turnPowerIds(['xiao_gui', 'zhi', 'inconnu', 'yu'])).toEqual(['zhi', 'yu']);
    });
    test('un tirage trop haut ne déclenche rien', () => {
        expect(rollCompanionPowers(['zhi', 'dawa', 'yu', 'etincelle'], hero, () => 0.99)).toEqual([]);
    });
    test('un tirage bas déclenche tout, avec les bons montants', () => {
        const fired = rollCompanionPowers(['zhi', 'dawa', 'yu', 'etincelle'], hero, () => 0);
        const by = Object.fromEntries(fired.map(f => [f.id, f]));
        expect(by.zhi.amount).toBe(10);
        expect(by.yu.amount).toBe(14);
        expect(by.etincelle.amount).toBe(4);
        expect(MANA_COLORS).toContain(by.etincelle.color);
        expect(by.dawa.power.kind).toBe('mirage');
    });
    test('Braise : 50 % de la jauge de rage ; Jian : 5 % ; Tou : ne vole que du mana présent', () => {
        expect(COMPANION_POWERS.braise.ragePct).toBe(0.5);
        expect(rollCompanionPowers(['braise'], hero, () => 0)[0].amount).toBe(0.5);
        expect(COMPANION_POWERS.jian.chance).toBe(0.05);
        expect(rollCompanionPowers(['jian'], hero, () => 0.04)).toHaveLength(1);
        expect(rollCompanionPowers(['jian'], hero, () => 0.05)).toHaveLength(0);
        expect(rollCompanionPowers(['tou'], hero, () => 0, { mana: { red: 0, blue: 0, green: 0, yellow: 0, purple: 0 } })).toEqual([]);
        const stolen = rollCompanionPowers(['tou'], hero, () => 0, { mana: { red: 0, blue: 0, green: 3, yellow: 0, purple: 7 } });
        expect(stolen[0].color).toBe('green');
        expect(['green', 'purple']).toContain(rollCompanionPowers(['tou'], hero, (() => { const v = [0, 0.99]; return () => v.shift() ?? 0; })(), { mana: { green: 3, purple: 7 } })[0].color);
    });
    test('chaque compagnon se recrute par une quête annexe existante', () => {
        const ids = Object.values(QUESTS).map(q => q.id);
        COMPANIONS.forEach(c => expect(ids).toContain(c.joinWhen));
    });
    test('Jian transforme une couleur en flèches (board.js)', () => {
        const board = readFileSync(new URL('../../board.js', import.meta.url), 'utf8');
        expect(board).toContain("board[i] = 'combat'");
        expect(game).toContain('convertRandomColorToArrows()');
    });
    test("game.js applique les pouvoirs une fois par tour", () => {
        expect(game).toContain('applyCompanionPowers()');
        expect(game).toContain('companionsActedThisTurn');
    });
});

describe('agilité dans les statistiques de combat', () => {
    test("l'onglet Stats affiche l'agilité", () => {
        expect(game).toContain('Agilité (initiative)');
    });
});

describe('un seul compagnon actif, choisi dans le menu', () => {
    const withJoined = ids => createSession({ quests: Object.fromEntries(ids.map(q => [q, 'done'])) });
    test('sans choix, le premier compagnon recruté est actif ; aucun recruté = aucun', () => {
        expect(activeCompanionOf(createSession(null))).toBeNull();
        expect(activeCompanionOf(withJoined(['sq_bell', 'sq_golden_carp'])).id).toBe('zhi');
    });
    test('on choisit parmi les recrutés seulement, ou « none »', () => {
        const session = withJoined(['sq_bell', 'sq_golden_carp']);
        expect(setActiveCompanion(session, 'dawa')).toBe(false);
        expect(setActiveCompanion(session, 'yu')).toBe(true);
        expect(activeCompanionOf(session).id).toBe('yu');
        expect(setActiveCompanion(session, 'none')).toBe(true);
        expect(activeCompanionOf(session)).toBeNull();
    });
    test('le choix survit à la sauvegarde et un id obsolète retombe sur le premier', () => {
        const session = withJoined(['sq_bell', 'sq_golden_carp']);
        setActiveCompanion(session, 'yu');
        expect(activeCompanionOf(createSession({ ...session.data })).id).toBe('yu');
        expect(activeCompanionOf(createSession({ ...session.data, activeCompanion: 'fantome' })).id).toBe('zhi');
    });
    test("le menu Stats propose le choix et le combat n'active que le compagnon choisi", () => {
        expect(game).toContain('companionSectionHtml()');
        const main = readFileSync(new URL('../../main.js', import.meta.url), 'utf8');
        expect(main).toContain('companionMenuHooks.setActive');
        const view = readFileSync(new URL('../../explorationView.js', import.meta.url), 'utf8');
        expect(view).toContain('return active ? [active.id] : [];');
    });
});
