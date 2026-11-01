// Équilibrage des boss : PV bornés, grimoire offensif garanti, qì (départ, gain), faiblesse visible, butin de palier garanti à la première victoire.
import { describe, test, expect } from '@jest/globals';
import './fixtures/xhrFromDisk.js';
import {
    bossHpMult, BOSS_HP_MULT_MAX, ensureBossOffense, isOffensiveSpell, bossManaGainBonus, bossStartingMana, BOSS_CAST_PRIORITY
} from '../../bossBalance.js';
import { createMapEnemy } from '../../enemies.js';
import { rollBossLoot, bossLootKey } from '../../victoryLoot.js';
import { allWeapons } from '../../weapons.js';
import { allItems } from '../../items.js';
import { getAllSpells } from '../../spells.js';

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

    test('tout boss de niveau 30+ a au moins 2 sorts offensifs forts (≥ 60 % du meilleur sort ennemi)', () => {
        const best = Math.max(...getAllSpells().filter(s => !s.class && !s.effect && !s.playerOnly && s.minLevel <= 56).map(s => s.dmg || 0));
        for (const id of catalogIds) for (let i = 0; i < 6; i++) {
            const b = boss(id, 56, { enemyId: `x${i}` });
            expect(b.spells.filter(sp => (sp.dmg || 0) >= best * 0.6).length).toBeGreaterThanOrEqual(2);
            expect(b.spells.length).toBeLessThanOrEqual(4);
        }
    });
});

describe('qì des boss', () => {
    test('gain bonus croissant avec le niveau, porté par le boss seulement', () => {
        expect(bossManaGainBonus(56)).toBeGreaterThan(bossManaGainBonus(10));
        expect(boss('chiyou', 56).manaGainBonus).toBe(bossManaGainBonus(56));
        expect(createMapEnemy({ templateId: 'chiyou', level: 56 }).manaGainBonus).toBeUndefined();
    });

    test('qì de départ = la moitié du coût des sorts offensifs, borné par la réserve', () => {
        const spells = [{ dmg: 120, cost: 50, color: 'red' }, { dmg: 96, cost: { blue: 20, yellow: 20 } }, { dmg: 0, cost: 99, color: 'green' }];
        expect(bossStartingMana(spells)).toEqual({ red: 25, blue: 10, yellow: 10 });
        expect(bossStartingMana(spells, () => 12)).toEqual({ red: 12, blue: 10, yellow: 10 });
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
