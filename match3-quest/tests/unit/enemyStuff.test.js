import { rollEnemyStuff, slotWearChance, stuffLevelFor, rollEnemyStuffDrops, enemyStuffMaxHp } from '../../enemyStuff.js';
import { getStuffById, STUFF_SLOTS } from '../../stuff.js';
import { gearBonus } from '../../combatStats.js';
import { gearManaBonus } from '../../manaGear.js';

const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };

describe('stuff des ennemis', () => {
    test('un boss porte les quatre emplacements, jamais au-dessus de son niveau effectif ni de pièce de quête', () => {
        for (let n = 0; n < 30; n++) {
            const level = 5 + n;
            const stuff = rollEnemyStuff(level, { boss: true });
            const eff = stuffLevelFor(level, null, true);
            STUFF_SLOTS.forEach(slot => {
                const s = getStuffById(stuff[slot]);
                expect(s).toBeTruthy();
                expect(s.slot).toBe(slot);
                expect(s.quest).toBeFalsy();
                expect(s.minLevel).toBeLessThanOrEqual(eff);
            });
        }
    });
    test('plus l\'ennemi est haut, plus il porte de pièces ; sa puissance relève le niveau du stuff', () => {
        expect(slotWearChance(1)).toBeLessThan(slotWearChance(30));
        expect(stuffLevelFor(10, { hpMult: 1.5, atkMult: 1.5, defMult: 1.5 })).toBeGreaterThan(stuffLevelFor(10, { hpMult: 1, atkMult: 1, defMult: 1 }));
    });
    test('le stuff agit sur l\'ennemi : Atk/Déf, PV max, qì max', () => {
        const e = { stuff: { head: 'casque_du_sage_celeste', neck: null, wrist: 'bracelet_de_foudre', ring: null } };
        expect(gearBonus(e, 'attack')).toBe(8);
        expect(gearBonus(e, 'defense')).toBe(8);
        expect(enemyStuffMaxHp(e)).toBe(20);
        expect(gearManaBonus(e, 'red')).toBe(10);
    });
    test('butin : chaque pièce portée non possédée a sa chance, la meilleure est garantie contre un ennemi plus fort', () => {
        const e = { stuff: { head: 'casque_de_cuir', neck: null, wrist: null, ring: 'bague_de_l_immortel' } };
        expect(rollEnemyStuffDrops(e, { stuffOwned: [] }, { rng: () => 0 }).map(s => s.id)).toEqual(['casque_de_cuir', 'bague_de_l_immortel']);
        expect(rollEnemyStuffDrops(e, { stuffOwned: [] }, { rng: () => 0.99 })).toEqual([]);
        expect(rollEnemyStuffDrops(e, { stuffOwned: [] }, { gap: 2, rng: () => 0.99 }).map(s => s.id)).toEqual(['bague_de_l_immortel']);
        expect(rollEnemyStuffDrops(e, { stuffOwned: ['casque_de_cuir', 'bague_de_l_immortel'] }, { gap: 2, rng: () => 0 })).toEqual([]);
        expect(rollEnemyStuffDrops({}, { stuffOwned: [] }, { rng: () => 0 })).toEqual([]);
    });
});
