import { pickTrapZone, trapDamage, mirrorLoadout, duelTurnPlan, weakenedHp, TRAP_SIZE } from '../../duel.js';
import { SCREENS } from '../../story.js';
import { createSession, encounterFor } from '../../exploration.js';
import { bossIntroLines } from '../../cinematics.js';

const seq = values => { let i = 0; return () => values[i++ % values.length]; };

describe('duel contre Fengmeng : règles pures', () => {
    test('pickTrapZone : une zone 3 x 3 contiguë, toujours dans le plateau', () => {
        [[0, 0], [0.999, 0.999], [0.5, 0.2]].forEach(([a, b]) => {
            const cells = pickTrapZone(8, seq([a, b]));
            expect(cells).toHaveLength(TRAP_SIZE * TRAP_SIZE);
            cells.forEach(i => { expect(i).toBeGreaterThanOrEqual(0); expect(i).toBeLessThan(64); });
            const rows = cells.map(i => Math.floor(i / 8)), cols = cells.map(i => i % 8);
            expect(Math.max(...rows) - Math.min(...rows)).toBe(2);
            expect(Math.max(...cols) - Math.min(...cols)).toBe(2);
        });
        expect(pickTrapZone(8, () => 0)).toEqual([0, 1, 2, 8, 9, 10, 16, 17, 18]);
    });

    test('trapDamage : par case restante, 1/8 de l\'attaque (2 minimum)', () => {
        expect(trapDamage(0, 100)).toBe(0);
        expect(trapDamage(6, 80)).toBe(60);
        expect(trapDamage(3, 4)).toBe(6);
    });

    test('duelTurnPlan : pièges et tirs rapides aux bons tours', () => {
        const duel = { rapidShots: 3, zoneTraps: 2 };
        expect(duelTurnPlan(duel, 1, 0)).toEqual({ detonate: 0, layTrap: false, rapidShot: false });
        expect(duelTurnPlan(duel, 2, 0)).toEqual({ detonate: 0, layTrap: true, rapidShot: false });
        expect(duelTurnPlan(duel, 3, 5)).toEqual({ detonate: 5, layTrap: false, rapidShot: true });
        expect(duelTurnPlan(duel, 6, 0)).toMatchObject({ layTrap: true, rapidShot: true });
        expect(duelTurnPlan(null, 2, 4)).toEqual({ detonate: 0, layTrap: false, rapidShot: false });
    });

    test('mirrorLoadout : copie des sorts équipés et de l\'arme (copies indépendantes)', () => {
        const hero = { class: 'assassin', activeSpells: [{ id: 'a', name: 'A' }], equippedWeapon: { id: 'bow', name: 'Arc' } };
        const copy = mirrorLoadout(hero, [{ id: 'x' }]);
        expect(copy.spells).toEqual([{ id: 'a', name: 'A' }]);
        expect(copy.spells[0]).not.toBe(hero.activeSpells[0]);
        expect(copy.weapon).toEqual({ id: 'bow', name: 'Arc' });
        expect(copy.playerClass).toBe('assassin');
        // sans sort équipé : sorts de classe connus (4 au plus), sans arme : pas d'arme
        const bare = mirrorLoadout({ class: 'templar', activeSpells: [] }, [1, 2, 3, 4, 5].map(id => ({ id })));
        expect(bare.spells.map(sp => sp.id)).toEqual([1, 2, 3, 4]);
        expect(bare.weapon).toBeNull();
    });

    test('weakenedHp : fraction des PV max, au moins 1', () => {
        expect(weakenedHp(200, 0.75)).toBe(150);
        expect(weakenedHp(1, 0.5)).toBe(1);
        expect(weakenedHp(200, 0)).toBe(200);
        expect(weakenedHp(200, 1)).toBe(200);
    });
});

describe('duel contre Fengmeng : données de l\'histoire', () => {
    const enemies = Object.values(SCREENS).flatMap(s => s.enemies);
    const fm = id => enemies.find(e => e.id === id);

    test('phase 1 : Archer Miroir, héros affaibli ; phase 2 : tirs rapides et pièges de zone', () => {
        expect(fm('fengmeng_3a').duel).toEqual({ mirror: true, heroHpPct: 0.75 });
        expect(fm('fengmeng_3b').duel).toEqual({ rapidShots: 3, zoneTraps: 2 });
        expect(fm('fengmeng_1').duel).toBeUndefined();
    });

    test('la rencontre transmet les règles de duel au combat', () => {
        const s = createSession({});
        expect(encounterFor(s, 'fengmeng_3b', 19).duel).toEqual({ rapidShots: 3, zoneTraps: 2 });
        expect(encounterFor(s, 'sun_1', 1).duel).toBeNull();
    });

    test('rencontre 2 : Fengmeng voulait devancer Hou Yi pour la gloire', () => {
        expect(fm('fengmeng_2').defeatScene.lines.join(' ')).toMatch(/avant vous/);
    });

    test('chaque duel a son échange de début de combat', () => {
        ['fengmeng_1', 'fengmeng_2', 'fengmeng_3a', 'fengmeng_3b'].forEach(id => {
            const lines = bossIntroLines({ enemyId: id, name: fm(id).name, boss: fm(id).boss, level: 10 });
            expect(lines.map(l => l.who)).toEqual(['boss', 'hero']);
            lines.forEach(l => expect(l.text.length).toBeGreaterThan(10));
        });
        expect(bossIntroLines({ enemyId: 'fengmeng_3a', level: 18 })[0].text).toMatch(/élixir/);
        expect(bossIntroLines({ enemyId: 'fengmeng_3b', level: 19 })[0].text).toMatch(/tout bu/);
    });
});
