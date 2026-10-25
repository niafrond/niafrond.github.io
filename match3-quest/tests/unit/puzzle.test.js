import './fixtures/xhrFromDisk.js';
import { describe, test, expect } from '@jest/globals';
import { createPuzzle, solve, registerMode, getMode } from '../../puzzle/engine.js';
import { traceBeams } from '../../puzzle/modes.js';
import { PUZZLES, PUZZLE_SETS, puzzleDef, puzzlesOfSet, pieceOfPuzzle } from '../../puzzle/levels.js';
import { getStuffById, stuffTotals, grantStuff, equipStuff, allStuff, ANTIQUE_ARMORS, STUFF_SLOTS, lootableStuff, describeStuff } from '../../stuff.js';
import { createSession, openChest, solvePuzzle, puzzleSetProgress } from '../../exploration.js';
import { SCREENS } from '../../story.js';

const make = id => createPuzzle(puzzleDef(id));

describe('moteur d\'énigmes', () => {
    test('chaque énigme déclarée a un mode connu, un titre et un texte', () => {
        Object.entries(PUZZLES).forEach(([id, p]) => {
            expect(getMode(p.mode)).not.toBeNull();
            expect(p.title && p.intro && p.hint).toBeTruthy();
            expect(id).toMatch(/^[a-z_]+$/);
        });
    });

    test.each(Object.keys(PUZZLES))('%s : faisable, mais pas déjà résolue au départ', id => {
        const moves = solve(puzzleDef(id));
        expect(moves).toBeGreaterThan(0);
        expect(make(id).won).toBe(false);
    });

    test('un mode doit fournir init / size / won / render', () => {
        expect(() => registerMode('cassé', { init() {} })).toThrow(/manquant/);
    });

    test('annuler et recommencer', () => {
        const p = make('riz_jarres');
        const start = p.state;
        expect(p.dir('left') || p.dir('up')).toBe(true);
        expect(p.moves).toBe(1);
        expect(p.undo()).toBe(true);
        expect(p.state).toBe(start);
        p.dir('left'); p.dir('up'); p.reset();
        expect(p.moves).toBe(0);
        expect(p.state.player).toBe(start.player);
        expect(p.undo()).toBe(false);
    });
});

describe('mode push', () => {
    const def = { mode: 'push', level: { grid: ['#######', '#@$.*.#', '#######'] } };
    test('pousse une caisse, pas deux d\'affilée ni dans un mur', () => {
        const p = createPuzzle({ mode: 'push', level: { grid: ['######', '#@$$.#', '######'] } });
        expect(p.dir('right')).toBe(false);          // deux caisses alignées
        expect(p.dir('up')).toBe(false);             // mur
        const q = createPuzzle(def);
        expect(q.dir('right')).toBe(true);
        expect(q.dir('right')).toBe(true);
        expect(q.won).toBe(true);
        expect(q.dir('left')).toBe(false);           // énigme finie : plus de coup
    });
    test('un appui déplace le héros d\'un pas vers la case touchée', () => {
        const p = createPuzzle(def);
        expect(p.tap(5, 1)).toBe(true);
        expect(p.state.player % p.state.w).toBe(2);
    });
});

describe('mode mirror', () => {
    test('le rayon est dévié par un miroir puis éclaire la cible', () => {
        const p = createPuzzle({ mode: 'mirror', level: { grid: ['#####', '#>./#', '#..T#', '#####'] } });
        expect(p.won).toBe(false);                    // « / » renvoie le rayon vers le mur du haut
        expect(p.tap(3, 1)).toBe(true);               // « / » → « \ » : le rayon descend sur la cible
        expect(p.won).toBe(true);
        expect(p.undo()).toBe(false);                 // énigme résolue : plus d'annulation
    });
    test('un miroir tourne, un mur ou une case vide non', () => {
        const p = createPuzzle({ mode: 'mirror', level: { grid: ['#####', '#>.\\#', '#.T.#', '#####'] } });
        expect(p.tap(1, 2)).toBe(false);
        expect(p.tap(3, 1)).toBe(true);
        expect(p.state.cells[1 * 5 + 3]).toBe('/');
    });
    test('le prisme sépare le rayon en deux : il faut les deux cibles', () => {
        const one = createPuzzle({ mode: 'mirror', level: { grid: ['#####', '#.T.#', '#.*.#', '#.^.#', '#####'] } });
        expect(one.won).toBe(true);
        const both = createPuzzle({ mode: 'mirror', level: { grid: ['#####', '#.T.#', '#.*T#', '#.^.#', '#####'] } });
        expect(both.won).toBe(true);                  // tout droit et vers la droite
        const miss = createPuzzle({ mode: 'mirror', level: { grid: ['#####', '#.T.#', '#.*.#', '#.^T#', '#####'] } });
        expect(miss.won).toBe(false);
    });
    test('un rayon bouclé ne fait pas planter', () => {
        const p = createPuzzle({ mode: 'mirror', level: { grid: ['#####', '#>.\\#', '#.T.#', '#####'] } });
        expect(() => traceBeams(p.state)).not.toThrow();
    });
});

describe('mode slide', () => {
    const level = { w: 4, h: 3, exit: { side: 'right', at: 1 }, blocks: [{ id: 'H', x: 0, y: 1, w: 2, h: 1, hero: true }, { id: 'v', x: 2, y: 0, w: 1, h: 2 }] };
    test('un bloc ne glisse que sur son axe et se choisit par un appui', () => {
        const p = createPuzzle({ mode: 'slide', level });
        expect(p.dir('right')).toBe(false);          // rien de sélectionné
        expect(p.tap(2, 0)).toBe(true);              // sélection du bloc vertical
        expect(p.moves).toBe(0);                     // une sélection n'est pas un coup
        expect(p.dir('left')).toBe(false);           // vertical : pas de glissement horizontal
        expect(p.dir('down')).toBe(true);
        expect(p.state.blocks.find(b => b.id === 'v').y).toBe(1);
        expect(p.dir('down')).toBe(false);           // bord
    });
    test('un appui sur une case libre dans l\'axe fait glisser jusque-là', () => {
        const p = createPuzzle({ mode: 'slide', level: { ...level, blocks: [{ id: 'H', x: 0, y: 1, w: 2, h: 1, hero: true }] } });
        p.tap(0, 1);
        expect(p.tap(3, 1)).toBe(true);
        expect(p.won).toBe(true);
        expect(p.moves).toBe(1);
    });
});

describe('coffres à énigme', () => {
    const chestsWithPuzzle = () => Object.values(SCREENS).flatMap(s => s.chests.filter(c => c.puzzle).map(c => ({ s, c })));

    test('les coffres à énigme pointent des énigmes existantes, une seule fois chacune', () => {
        const list = chestsWithPuzzle();
        expect(list.length).toBe(Object.keys(PUZZLES).length);
        list.forEach(({ c }) => expect(PUZZLES[c.puzzle]).toBeDefined());
        expect(new Set(list.map(x => x.c.puzzle)).size).toBe(list.length);
    });

    test('le coffre ne s\'ouvre qu\'une fois l\'énigme résolue', () => {
        const { s, c } = chestsWithPuzzle()[0];
        const session = createSession(null);
        session.data.screenId = s.id;
        const res = openChest(session, c.id);
        expect(res.type).toBe('puzzle');
        expect(res.puzzleId).toBe(c.puzzle);
        expect(session.data.openedChests).not.toContain(c.id);
        solvePuzzle(session, c.puzzle);
        expect(openChest(session, c.id).type).toBe('chestOpened');
        expect(session.data.openedChests).toContain(c.id);
        expect(session.data.solvedPuzzles).toEqual([c.puzzle]);
    });

    test('trois énigmes par famille, dans des biomes différents, chacune sur son coffre', () => {
        Object.keys(PUZZLE_SETS).forEach(set => {
            const ids = puzzlesOfSet(set);
            expect(ids).toHaveLength(3);
            const biomes = ids.map(id => chestsWithPuzzle().find(x => x.c.puzzle === id).s.biome);
            expect(new Set(biomes).size).toBe(3);
            [...PUZZLE_SETS[set].pieces, PUZZLE_SETS[set].finale].forEach(id => expect(getStuffById(id)).toMatchObject({ armor: set, quest: true }));
        });
    });

    test('chaque énigme donne sa pièce, la famille complète donne la dernière', () => {
        const session = createSession(null);
        const ids = puzzlesOfSet('lumiere');
        expect(solvePuzzle(session, ids[0])).toEqual({ set: 'lumiere', label: 'Lumière', stuff: ['prisme_heaume'], complete: false });
        expect(solvePuzzle(session, ids[1]).stuff).toEqual(['prisme_gorgerin']);
        expect(puzzleSetProgress(session, ids[0])).toEqual({ done: 2, total: 3 });
        expect(solvePuzzle(session, ids[2])).toEqual({ set: 'lumiere', label: 'Lumière', stuff: ['prisme_brassard', 'prisme_anneau'], complete: true });
        expect(solvePuzzle(session, ids[2])).toBeNull();           // une seule remise
        expect(pieceOfPuzzle(ids[1])).toBe('prisme_gorgerin');
    });
});

describe('armures antiques', () => {
    const hero = () => ({ level: 40, hp: 100, maxHp: 100, stuffOwned: [], stuff: {}, statusEffects: {} });
    const wear = (h, ids) => ids.forEach(id => { grantStuff(h, id); expect(equipStuff(h, id).ok).toBe(true); });

    test('12 pièces : 3 armures de 4 pièces (une par emplacement), hors boutique et butin', () => {
        const pieces = allStuff.filter(s => s.armor);
        expect(pieces).toHaveLength(12);
        Object.entries(ANTIQUE_ARMORS).forEach(([k, a]) => {
            expect(pieces.filter(p => p.armor === k).map(p => p.slot).sort()).toEqual([...STUFF_SLOTS].sort());
            expect(a.powerText).toBeTruthy();
        });
        pieces.forEach(p => expect(lootableStuff()).not.toContain(p));
        expect(describeStuff(getStuffById('prisme_heaume'))).toContain('Armure antique du Prisme');
    });

    test('le pouvoir n\'existe que si les quatre pièces de la même armure sont portées', () => {
        const h = hero();
        wear(h, ['prisme_heaume', 'prisme_gorgerin', 'prisme_brassard']);
        expect(stuffTotals(h)).toMatchObject({ turnHealPct: 0, armors: [] });
        wear(h, ['jarres_anneau']);                                  // une pièce d'une autre armure ne complète rien
        expect(stuffTotals(h).turnHealPct).toBe(0);
        wear(h, ['prisme_anneau']);
        expect(stuffTotals(h)).toMatchObject({ turnHealPct: 10, turnArrowsPct: 0, reflectPct: 0, armors: ['lumiere'] });
    });

    test('jarres : +10 % de flèches, charrette : 50 % de dégâts renvoyés', () => {
        const a = hero(); wear(a, ANTIQUE_ARMORS.jarres.pieces.map(p => p.id));
        expect(stuffTotals(a)).toMatchObject({ turnArrowsPct: 10, reflectPct: 0 });
        const b = hero(); wear(b, ANTIQUE_ARMORS.charrette.pieces.map(p => p.id));
        expect(stuffTotals(b)).toMatchObject({ reflectPct: 50, turnHealPct: 0 });
    });
});
