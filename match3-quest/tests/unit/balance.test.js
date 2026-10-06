// Équilibrage : garde-fous chiffrés contre le « bourrinage » (spammer la même action sans réfléchir).
// Repères : un tour de plateau rapporte ~3-4 points de mana ou d'action ; un ennemi de niveau L inflige
// ~6 + 1,5 L PV par tour ; les objets (infinis, rechargeables) ne doivent être qu'un complément.
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { allItems, useItem, isCombatLongEffect } from '../../items.js';
import { allWeapons } from '../../weapons.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const allGeneric = JSON.parse(readFileSync(join(root, 'spells.json'), 'utf8')).allSpells;
const spells = allGeneric.filter(s => typeof s.cost === 'number');     // mono-mana
const multiSpells = allGeneric.filter(s => typeof s.cost === 'object');  // multimana
const totalCost = s => Object.values(s.cost).reduce((a, b) => a + b, 0);
const reusables = allItems.filter(i => i.type === 'reusable');
const enemyDamagePerTurn = level => 6 + 1.5 * level;
const COLORS = 5;

describe('objets rechargeables : puissance par tour', () => {
    test.each(reusables.filter(i => i.effect.heal || i.effect.regen).map(i => [i.id, i]))(
        '%s : soin moyen ≤ 45 % des dégâts ennemis par tour', (_, i) => {
            const total = (i.effect.heal || 0) + (i.effect.regen || 0) * (i.effect.duration || 1);
            const perTurn = total * i.chargesPerCycle / i.rechargeTurns;
            expect(perTurn).toBeLessThanOrEqual(enemyDamagePerTurn(Math.max(3, i.minLevel)) * 0.45);
        });

    test.each(reusables.filter(i => i.effect.mana || i.effect.randomMana).map(i => [i.id, i]))(
        '%s : mana moyen par tour ≤ 8 (tous coloris confondus)', (_, i) => {
            const total = (i.effect.mana || 0) * COLORS + (i.effect.randomMana || 0);
            expect(total * i.chargesPerCycle / i.rechargeTurns).toBeLessThanOrEqual(8);
        });

    test('un objet à effet de combat durable n\'a qu\'une charge, des bonus bornés', () => {
        reusables.filter(i => isCombatLongEffect(i.effect)).forEach(i => {
            expect(i.chargesPerCycle).toBe(1);
            expect(i.effect.tempDefense || 0).toBeLessThanOrEqual(8);
            expect(i.effect.tempAttack || 0).toBeLessThanOrEqual(15);
        });
    });

    test('tous les objets se rechargent en 3 tours ou plus', () => {
        reusables.forEach(i => expect(i.rechargeTurns).toBeGreaterThanOrEqual(3));
    });
});

describe('effets de combat : pas de cumul', () => {
    const makePlayer = inv => ({ hp: 50, maxHp: 100, attack: 15, defense: 0, mana: { red: 0 }, maxMana: 50, inventory: inv });

    test('le même bonus ne s\'applique qu\'une fois par combat, sans consommer de charge', () => {
        const potion = { ...allItems.find(i => i.id === 'defensePotion'), chargesLeft: 1 };
        const player = makePlayer([potion]);
        expect(useItem('defensePotion', player, null, 0).success).toBe(true);
        expect(player.defense).toBe(8);
        potion.chargesLeft = 1; potion.rechargeLeft = 0;   // même rechargée en plein combat
        const again = useItem('defensePotion', player, null, 0);
        expect(again.success).toBe(false);
        expect(player.defense).toBe(8);
        expect(potion.chargesLeft).toBe(1);
        player.itemBuffs = {};   // nouveau combat (restartCombat)
        expect(useItem('defensePotion', player, null, 0).success).toBe(true);
    });

    test('la Plume de Fenghuang ne ressuscite qu\'une fois par combat', () => {
        const feather = { ...allItems.find(i => i.id === 'phoenixFeather') };
        const player = makePlayer([feather]);
        expect(useItem('phoenixFeather', player, null, 0).success).toBe(true);
        player.hasRevive = false;   // résurrection consommée
        feather.chargesLeft = 1;
        expect(useItem('phoenixFeather', player, null, 0).success).toBe(false);
    });

    test('soins et mana restent utilisables à chaque recharge', () => {
        const potion = { ...allItems.find(i => i.id === 'healthPotion'), chargesLeft: 1 };
        const player = makePlayer([potion]);
        expect(useItem('healthPotion', player, null, 0).success).toBe(true);
        potion.chargesLeft = 1;
        expect(useItem('healthPotion', player, null, 0).success).toBe(true);
    });
});

describe('sorts', () => {
    test('les soins sont moins rentables que les dégâts (≤ 2,1 PV par mana)', () => {
        spells.filter(s => s.type === 'heal').forEach(s => expect(s.heal / s.cost).toBeLessThanOrEqual(2.1));
    });

    test('les dégâts rapportent 2,2 à 2,6 par mana', () => {
        spells.filter(s => s.type === 'damage').forEach(s => {
            expect(s.dmg / s.cost).toBeGreaterThanOrEqual(2.2);
            expect(s.dmg / s.cost).toBeLessThanOrEqual(2.6);
        });
    });

    test('aucun sort ne coûte plus que la réserve de mana de base (50)', () => {
        spells.forEach(s => expect(s.cost).toBeLessThanOrEqual(50));
    });
});

describe('sorts multimana', () => {
    test('au moins 12 sorts de dégâts multimana, jusqu\'au niveau 70', () => {
        const dmg = multiSpells.filter(s => s.type === 'damage');
        expect(dmg.length).toBeGreaterThanOrEqual(12);
        expect(Math.max(...dmg.map(s => s.minLevel))).toBe(70);
    });

    test('au moins deux couleurs, jamais lancés par les ennemis', () => {
        multiSpells.forEach(s => {
            expect(Object.keys(s.cost).length).toBeGreaterThanOrEqual(2);
            expect(s.playerOnly).toBe(true);
        });
    });

    test('dégâts : 2,7 à 4,3 par mana, plus rentables aux hauts niveaux', () => {
        const dmg = multiSpells.filter(s => s.type === 'damage').sort((a, b) => a.minLevel - b.minLevel);
        dmg.forEach(s => {
            expect(s.dmg / totalCost(s)).toBeGreaterThanOrEqual(2.7);
            expect(s.dmg / totalCost(s)).toBeLessThanOrEqual(4.3);
        });
        dmg.slice(1).forEach((s, i) => expect(s.dmg).toBeGreaterThan(dmg[i].dmg));
    });

    test('soins : ≤ 2,1 PV par mana', () => {
        multiSpells.filter(s => s.type === 'heal').forEach(s => expect(s.heal / totalCost(s)).toBeLessThanOrEqual(2.1));
    });
});

describe('arcs à deux mains lourds', () => {
    const heavy = allWeapons.filter(w => w.twoHanded && w.minLevel >= 16);
    test('au moins 8 arcs, très chers en PA, jamais portés par les ennemis', () => {
        expect(heavy.length).toBeGreaterThanOrEqual(8);
        heavy.forEach(w => { expect(w.actionPoints).toBeGreaterThanOrEqual(8); expect(w.playerOnly).toBe(true); });
    });
    test('beaucoup plus puissants que les arcs à une main du même niveau', () => {
        heavy.forEach(w => {
            const oneHand = allWeapons.filter(o => !o.twoHanded && o.minLevel <= w.minLevel).map(o => o.damage);
            expect(w.damage).toBeGreaterThanOrEqual(Math.max(...oneHand) * 1.25);
            expect((w.damage + 15) / w.actionPoints).toBeGreaterThanOrEqual(10.5 + 0.30 * w.minLevel);
        });
    });
});

describe('armes : rendement par point d\'action', () => {
    // Avec l'attaque de base (15) : (dégâts + 15) / PA reste dans un couloir qui monte avec le niveau.
    test.each(allWeapons.map(w => [w.name, w]))('%s', (_, w) => {
        const e = (w.damage + 15) / w.actionPoints;
        expect(e).toBeLessThanOrEqual(12 + 0.35 * w.minLevel);
        expect(e).toBeGreaterThanOrEqual(6.5 + 0.25 * w.minLevel);
    });
});
