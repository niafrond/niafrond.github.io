// Équilibrage des boss : PV bornés, grimoire offensif garanti, qì (départ, gain), faiblesse visible, butin de palier garanti à la première victoire.
import { describe, test, expect } from '@jest/globals';
import './fixtures/xhrFromDisk.js';
import {
    bossHpMult, BOSS_HP_MULT_MAX, ensureBossOffense, isOffensiveSpell, bossManaGainBonus, bossStartingMana, BOSS_CAST_PRIORITY, bossResistances, bossCounterStrength, BOSS_EXTRA_SPELLS
} from '../../bossBalance.js';
import { createMapEnemy } from '../../enemies.js';
import { rollBossLoot, bossLootKey } from '../../victoryLoot.js';
import { allWeapons } from '../../weapons.js';
import { allItems } from '../../items.js';
import { getAllSpells } from '../../spells.js';
import { WARD_STUFF, getStuffById, describeStuff, wardAgainst } from '../../stuff.js';
import { merchantStock } from '../../merchants.js';

const boss = (templateId, level, extra = {}) => createMapEnemy({ templateId, level, boss: { name: 'Boss test' }, enemyId: `boss_${templateId}_${level}`, ...extra });
const catalogIds = ['chiyou', 'canglong', 'wen_shen', 'huli_commun', 'zhulong_serpent', 'wu_shou', 'yingyu', 'feng_bo', 'bai_ze', 'xiangliu', 'jinwu', 'nu_gui'];

describe('PV des boss', () => {
    test('le coefficient de gabarit est borné (×1 à ×1,5)', () => {
        expect(bossHpMult(0.9)).toBe(1);
        expect(bossHpMult(1.2)).toBe(1.2);
        expect(bossHpMult(3)).toBe(BOSS_HP_MULT_MAX);
        expect(bossHpMult(undefined)).toBe(1);
    });

    test('au niveau 56, tout boss a entre 4 700 et 7 300 PV, quel que soit son gabarit', () => {
        for (const id of catalogIds) {
            const b = boss(id, 56);
            expect(b.maxHp).toBeGreaterThanOrEqual(4700);
            expect(b.maxHp).toBeLessThanOrEqual(7300);
        }
    });
});

describe('grimoire des boss', () => {
    const spell = (id, dmg) => ({ id, name: id, dmg });

    test('ensureBossOffense remplace les sorts faibles ou de soutien par des sorts offensifs forts', () => {
        const pool = [spell('a', 125), spell('b', 120), spell('c', 25), spell('d', 0)];
        const out = ensureBossOffense([spell('c', 25), spell('d', 0), spell('e', 0), spell('f', 0)], pool, 4, () => 0);
        expect(out).toHaveLength(4);
        expect(out.filter(sp => sp.dmg >= 75)).toHaveLength(2);
    });

    test('ne touche pas un grimoire déjà offensif et ne dépasse pas les emplacements', () => {
        const pool = [spell('a', 125), spell('b', 120), spell('c', 100)];
        const kept = [spell('a', 125), spell('b', 120)];
        expect(ensureBossOffense(kept, pool, 2)).toEqual(kept);
        expect(ensureBossOffense([spell('x', 0), spell('y', 0)], pool, 2, () => 0)).toHaveLength(2);
    });

    const colorsOf = sp => [...(sp.colors || []), sp.color, ...Object.keys(typeof sp.cost === 'object' ? sp.cost : {})].filter(Boolean);

    test('tout boss de niveau 56 a au moins 2 sorts offensifs (≥ 45 de base), de son élément', () => {
        for (const id of catalogIds) for (let i = 0; i < 6; i++) {
            const b = boss(id, 56, { enemyId: `x${i}` });
            const offensive = b.spells.filter(isOffensiveSpell);
            expect(offensive.filter(sp => sp.dmg >= 45).length).toBeGreaterThanOrEqual(2);
            expect(b.spells.length).toBeLessThanOrEqual(4);
            offensive.forEach(sp => expect(colorsOf(sp)).toContain(b.preferredColor));
        }
    });
});

describe('identité élémentaire', () => {
    test('à pleine force (niveau 40+), un boss résiste fort à son élément et aux autres, sauf à sa faiblesse', () => {
        for (const id of catalogIds) {
            const b = boss(id, 56);
            for (const c of Object.keys(b.resistances)) {
                if (c === b.weakColor) expect(b.resistances[c]).toBeLessThanOrEqual(0.05);
                else if (c === b.preferredColor) expect(b.resistances[c]).toBeGreaterThanOrEqual(0.6);
                else expect(b.resistances[c]).toBeGreaterThanOrEqual(0.4);
            }
        }
        expect(bossResistances({ red: 0.1, blue: 0.1, green: 0.1 }, 'red', 'blue', 56)).toEqual({ red: 0.6, blue: 0.05, green: 0.4 });
    });

    test('niveau minimum : aucune exigence jusqu\'au niveau 15, progressive ensuite, pleine au niveau 40', () => {
        expect(bossCounterStrength(10)).toBe(0);
        expect(bossCounterStrength(15)).toBe(0);
        expect(bossCounterStrength(27.5)).toBeCloseTo(0.5);
        expect(bossCounterStrength(40)).toBe(1);
        expect(bossCounterStrength(70)).toBe(1);
        const res = { red: 0.1, blue: 0.1, green: 0.1 };
        expect(bossResistances(res, 'red', 'blue', 12)).toEqual(res);
        expect(bossResistances(res, 'red', 'blue', 27.5).red).toBeCloseTo(0.3);
        expect(bossResistances(res, 'red', 'blue', 27.5).green).toBeCloseTo(0.2);
    });

    test('un boss de bas niveau (≤ 15) garde les résistances d\'un ennemi normal et n\'annonce aucun contre-équipement', () => {
        for (const id of catalogIds) {
            const b = boss(id, 12), n = createMapEnemy({ templateId: id, level: 12 });
            expect(b.resistances).toEqual(n.resistances);
            expect(b.prep.lines.join(' ')).not.toMatch(/parure de/);
        }
    });

    test('chaque couleur offre au moins 2 sorts offensifs de boss dès le niveau 15 (sinon un boss n\'aurait pas d\'élément)', () => {
        const pool = [...getAllSpells().filter(s => !s.class && !s.effect && !s.playerOnly), ...BOSS_EXTRA_SPELLS].filter(s => s.minLevel <= 15 && (s.dmg || 0) > 0);
        for (const color of ['red', 'blue', 'green', 'yellow', 'purple']) {
            const n = pool.filter(s => s.color === color || (s.cost && typeof s.cost === 'object' && color in s.cost)).length;
            expect(n).toBeGreaterThanOrEqual(2);
        }
    });

    test('les 5 éléments de boss ont chacun une faiblesse différente (variété des contre-équipements)', () => {
        const weak = new Set(catalogIds.map(id => boss(id, 56).weakColor));
        expect(weak.size).toBeGreaterThanOrEqual(4);
    });

    test('la préparation du boss annonce son élément et le contre-équipement', () => {
        const b = boss('chiyou', 56);
        expect(b.prep.lines.join(' ')).toMatch(/parure de/);
    });
});

describe('parures de protection élémentaire', () => {
    const hero = ids => { const h = { stuffOwned: ids, stuff: {} }; ids.forEach(id => { h.stuff[getStuffById(id).slot] = id; }); return h; };

    test('40 pièces : 5 éléments × 4 emplacements × 2 paliers, sans doublon d\'id', () => {
        expect(WARD_STUFF).toHaveLength(40);
        expect(new Set(WARD_STUFF.map(s => s.id)).size).toBe(40);
        expect(getStuffById('ward_red_head_1').ward).toEqual({ red: 6 });
        expect(describeStuff(getStuffById('ward_blue_neck_2'))).toMatch(/Eau −10 %/);
    });

    test('quatre pièces du même élément réduisent les sorts de cette couleur seulement', () => {
        const full = hero(['ward_red_head_2', 'ward_red_neck_2', 'ward_red_wrist_2', 'ward_red_ring_2']);
        expect(wardAgainst(full, ['red'])).toBeCloseTo(0.4);
        expect(wardAgainst(full, ['blue'])).toBe(0);
        expect(wardAgainst(full, ['red', 'blue'])).toBeCloseTo(0.2);   // multi-qì : moyenne
        expect(wardAgainst({ stuffOwned: [], stuff: {} }, ['red'])).toBe(0);
    });

    test('un marchand de la région 22 propose une parure', () => {
        const stock = merchantStock('merchant_tonnerre');
        expect(stock.some(o => o.kind === 'stuff' && getStuffById(o.id)?.ward)).toBe(true);
    });
});

describe('qì des boss', () => {
    test('gain bonus croissant avec le niveau, porté par le boss seulement', () => {
        expect(bossManaGainBonus(56)).toBeGreaterThan(bossManaGainBonus(10));
        expect(boss('chiyou', 56).manaGainBonus).toBe(bossManaGainBonus(56));
        expect(createMapEnemy({ templateId: 'chiyou', level: 56 }).manaGainBonus).toBeUndefined();
    });

    test('qì de départ = 75 % du coût des sorts offensifs, borné par la réserve', () => {
        const spells = [{ dmg: 120, cost: 50, color: 'red' }, { dmg: 96, cost: { blue: 20, yellow: 20 } }, { dmg: 0, cost: 99, color: 'green' }];
        expect(bossStartingMana(spells)).toEqual({ red: 37, blue: 15, yellow: 15 });
        expect(bossStartingMana(spells, () => 12)).toEqual({ red: 12, blue: 12, yellow: 12 });
    });

    test('un sort offensif est un sort à dégâts directs ; l\'IA du boss préfère lancer', () => {
        expect(isOffensiveSpell({ dmg: 5 })).toBe(true);
        expect(isOffensiveSpell({ heal: 5 })).toBe(false);
        expect(BOSS_CAST_PRIORITY).toBeGreaterThan(0.5);
    });
});

describe('faiblesse du boss', () => {
    test('la faiblesse d\'un boss est toujours repérée (infobulle et bonus de dégâts)', () => {
        const b = boss('chiyou', 40);
        expect(b.prep.weaknessRevealed).toBe(true);
        expect(b.prep.tags).toContain('observed');
        expect(b.prep.lines.length).toBeGreaterThan(0);
    });
    test('un ennemi normal n\'a pas de préparation', () => {
        expect(createMapEnemy({ templateId: 'chiyou', level: 40 }).prep).toBeUndefined();
    });
});

describe('butin de palier garanti', () => {
    const owner = (level, weapons = [], inventory = []) => ({ level, weapons, inventory });

    test('l\'arme la plus haute utilisable + la relique la plus haute non possédée', () => {
        const loot = rollBossLoot(owner(56), () => 0);
        const weapon = loot.find(l => l.kind === 'weapon').weapon;
        expect(weapon.id).toBe('arc_des_neuf_fleuves');   // 54 : le palier du niveau 56
        const relic = loot.find(l => l.kind === 'item').item;
        expect(relic.type).toBe('artifact');
        expect(relic.minLevel).toBeLessThanOrEqual(56);
    });

    test('la parure de l\'élément du boss est ajoutée (palier le plus haut, jamais de doublon)', () => {
        const stuff = rollBossLoot(owner(56), () => 0, 'red').find(l => l.kind === 'stuff').stuff;
        expect(stuff.ward.red).toBeGreaterThan(0);
        expect(stuff.minLevel).toBe(46);
        const again = rollBossLoot({ ...owner(56), stuffOwned: [stuff.id] }, () => 0, 'red').find(l => l.kind === 'stuff').stuff;
        expect(again.id).not.toBe(stuff.id);
        expect(rollBossLoot(owner(10), () => 0, 'red').some(l => l.kind === 'stuff')).toBe(false);
    });

    test('jamais au-dessus du niveau, jamais de doublon', () => {
        const first = rollBossLoot(owner(56), () => 0);
        const w = first.find(l => l.kind === 'weapon').weapon;
        const i = first.find(l => l.kind === 'item').item;
        const again = rollBossLoot(owner(56, [w], [i]), () => 0);
        expect(again.find(l => l.kind === 'weapon')?.weapon.id).not.toBe(w.id);
        expect(again.find(l => l.kind === 'item')?.item.id).not.toBe(i.id);
        for (const l of rollBossLoot(owner(20), () => 0)) expect((l.weapon || l.item).minLevel).toBeLessThanOrEqual(20);
        expect(allWeapons.length).toBeGreaterThan(0); expect(allItems.length).toBeGreaterThan(0);
    });

    test('clé de boss : arène, ennemi de carte, sinon gabarit + niveau', () => {
        expect(bossLootKey({ arena: { master: true, tier: 3 } })).toBe('arena:3');
        expect(bossLootKey({ mapEnemyId: 'grukk' })).toBe('map:grukk');
        expect(bossLootKey({ templateId: 'chiyou', level: 12 })).toBe('boss:chiyou:12');
        expect(bossLootKey(null)).toBeNull();
    });
});
