// Attaque = chance de critique, défense = chance de blocage (plafonnées à 98 %), bonus d'équipement et de sorts,
// force sur les crânes, agilité des ennemis et boss pré-générés.
import { describe, test, expect } from '@jest/globals';
import './fixtures/xhrFromDisk.js';
import {
    STAT_CHANCE_CAP, critChance, blockChance, rawAttack, displayAttack, rawDefense, rollBlock, applyBlock, resolveStrike,
    skullStrengthBonus, levelEdgeBonus, addStatBuff, stackStatusEffect, tickStatBuffs, statBuffAmount, gearBonus
} from '../../combatStats.js';
import { createMapEnemy, createBossEnemyForTier, bossSpellPower } from '../../enemies.js';
import { allWeapons, WEAPON_STAT_BONUSES, getWeaponById } from '../../weapons.js';
import { allItems } from '../../items.js';
import spellsJson from '../../spells.json' with { type: 'json' };

const seq = (...values) => { let i = 0; return () => values[Math.min(i++, values.length - 1)]; };

describe('plafond à 98 %', () => {
    test('affichage brut au-delà de 100, chance réelle plafonnée', () => {
        const e = { attack: 150, defense: 120 };
        expect(rawAttack(e)).toBe(150);
        expect(rawDefense(e)).toBe(120);
        expect(critChance(e)).toBe(STAT_CHANCE_CAP);
        expect(blockChance(e)).toBe(STAT_CHANCE_CAP);
        expect(STAT_CHANCE_CAP).toBe(98);
    });

    test('jamais de coup garanti : 99,5 % de jet ne passe pas à 98 %', () => {
        expect(rollBlock({ defense: 500 }, seq(0.99, 0))).toBe('none');
    });
});

describe('blocage', () => {
    test('total ou partiel', () => {
        expect(rollBlock({ defense: 50 }, seq(0.1, 0.1))).toBe('total');
        expect(rollBlock({ defense: 50 }, seq(0.1, 0.9))).toBe('partial');
        expect(rollBlock({ defense: 50 }, seq(0.9, 0.1))).toBe('none');
        expect(applyBlock(10, 'total')).toBe(0);
        expect(applyBlock(10, 'partial')).toBe(5);
        expect(applyBlock(10, 'none')).toBe(10);
    });

    test('resolveStrike : critique ×1,5 puis blocage', () => {
        const attacker = { attack: 100 };
        const target = { defense: 0 };
        expect(resolveStrike(10, attacker, target, { rng: () => 0.5 })).toEqual({ damage: 15, crit: true, block: 'none' });
        expect(resolveStrike(10, { attack: 0 }, { defense: 100 }, { rng: seq(0.5, 0.1, 0.1) }).damage).toBe(0);
    });

    test('resolveStrike : Fureur des Steppes ajoute un bonus fixe inblocable, critique comme l\'attaque', () => {
        const target = { defense: 0 };
        const enraged = { attack: 0, statusEffects: { enraged: 2, enragedBonus: 10 } };
        expect(resolveStrike(5, enraged, target, { rng: () => 0.99 }).damage).toBe(15);
        expect(resolveStrike(5, { attack: 0, statusEffects: {} }, target, { rng: () => 0.99 }).damage).toBe(5);
        expect(resolveStrike(0, enraged, target, { rng: () => 0.99 }).damage).toBe(0);
        // Le bonus suit le critique de l'attaque : (10 × 1.5) + (10 × 1.5).
        expect(resolveStrike(10, { attack: 100, statusEffects: enraged.statusEffects }, target, { rng: () => 0 }).damage).toBe(30);
        // Attaque bloquée entièrement : seul le bonus passe.
        expect(resolveStrike(10, enraged, { defense: 100 }, { rng: seq(0.99, 0.1, 0.1) })).toEqual({ damage: 10, crit: false, block: 'total' });
    });

    test('displayAttack : l\'attaque affichée tient compte du malus d\'affaiblissement', () => {
        expect(displayAttack({ attack: 30 })).toBe(30);
        expect(displayAttack({ attack: 30, statusEffects: { weakened: 2, weakenedAmount: 12 } })).toBe(18);
        expect(displayAttack({ attack: 5, statusEffects: { weakened: 2, weakenedAmount: 12 } })).toBe(0);
        expect(displayAttack({ attack: 30, statusEffects: { weakened: 0, weakenedAmount: 12 } })).toBe(30);
    });

    test('l\'affaiblissement retire des points d\'attaque', () => {
        expect(critChance({ attack: 30 }, 12)).toBe(18);
    });
});

describe('équipement et sorts', () => {
    test('les bonus d\'armes et de boucliers s\'ajoutent', () => {
        const bow = getWeaponById('arc_du_juge_celeste');
        expect(bow.atkBonus).toBeGreaterThan(0);
        const shield = allItems.find(i => i.id === 'legendary_shield');
        const hero = { attack: 10, defense: 30, equippedWeapon: bow, equipment: { leftHand: shield } };
        expect(gearBonus(hero, 'attack')).toBe(bow.atkBonus + shield.atkBonus);
        expect(rawAttack(hero)).toBe(10 + bow.atkBonus + shield.atkBonus);
        expect(rawDefense(hero)).toBe(30 + bow.defBonus);
    });

    test('chaque bonus d\'arme désigne une arme existante', () => {
        Object.keys(WEAPON_STAT_BONUSES).forEach(id => expect(allWeapons.some(w => w.id === id)).toBe(true));
    });

    test('bonus de sort temporaire : cumulable, chaque lancer garde sa durée', () => {
        const e = { attack: 5, defense: 5 };
        addStatBuff(e, { attack: 20, defense: 10, turns: 2 });
        addStatBuff(e, { attack: 10, turns: 3 });
        expect(rawAttack(e)).toBe(35);
        expect(rawDefense(e)).toBe(15);
        expect(tickStatBuffs(e)).toEqual([]);
        expect(tickStatBuffs(e)).toEqual(['defense']);   // le bonus de défense (2 tours) expire
        expect(statBuffAmount(e, 'defense')).toBe(0);
        expect(statBuffAmount(e, 'attack')).toBe(10);    // seul le +20 (2 tours) est parti
        expect(tickStatBuffs(e)).toEqual(['attack']);
        expect(rawAttack(e)).toBe(5);
    });

    test('stackStatusEffect : bonus additionnés, durée la plus longue', () => {
        const fx = {};
        expect(stackStatusEffect(fx, 'stoneskin', 'stoneskinDefense', 3, 10)).toBe(10);
        expect(stackStatusEffect(fx, 'stoneskin', 'stoneskinDefense', 2, 15)).toBe(15);
        expect(fx).toEqual({ stoneskin: 3, stoneskinDefense: 25 });
        expect(stackStatusEffect(fx, 'reflect', 'pct', 2, 80, 100) + stackStatusEffect(fx, 'reflect', 'pct', 2, 80, 100)).toBe(100);
        fx.stoneskin = 0;   // expiré : repart de zéro
        expect(stackStatusEffect(fx, 'stoneskin', 'stoneskinDefense', 1, 5)).toBe(5);
        expect(fx.stoneskinDefense).toBe(5);
    });

    test('nouveaux sorts de bonus temporaire', () => {
        const buffs = [...spellsJson.sorcererSpells, ...spellsJson.assassinSpells, ...spellsJson.templarSpells, ...spellsJson.barbarianSpells].filter(s => s.effect === 'statBuff');
        expect(buffs.length).toBeGreaterThanOrEqual(4);
        buffs.forEach(s => {
            expect((s.atkBuff || 0) + (s.defBuff || 0)).toBeGreaterThan(0);
            expect(s.duration).toBeGreaterThanOrEqual(1);
        });
        expect(buffs.some(s => s.atkBuff)).toBe(true);
        expect(buffs.some(s => s.defBuff)).toBe(true);
        const inClassList = ['sorcererSpells', 'assassinSpells', 'templarSpells', 'barbarianSpells'].flatMap(k => spellsJson[k]).filter(s => s.effect === 'statBuff');
        expect(inClassList.length).toBe(buffs.length);
    });
});

describe('force et crânes', () => {
    test('la force augmente les dégâts des crânes (plafonné)', () => {
        expect(skullStrengthBonus({ attributes: { strength: 0 } })).toBe(0);
        expect(skullStrengthBonus({ attributes: { strength: 6 } })).toBe(3);
        expect(skullStrengthBonus({ attributes: { strength: 999 } })).toBe(6);
        expect(skullStrengthBonus({})).toBe(0);
    });
});

describe('ennemis', () => {
    const enc = (level, extra = {}) => ({ templateId: 'chiyou', level, ...extra });

    test('les PV des boss sont absolus (courbe de niveau, sans dépendre du héros)', () => {
        const boss = lvl => ({ templateId: 'chiyou', level: lvl, boss: { name: 'Nico' }, enemyId: 'nico' });
        expect(createMapEnemy(boss(56)).maxHp).toBe(createMapEnemy(boss(56)).maxHp);
        expect(createMapEnemy(boss(56)).maxHp).toBeGreaterThan(4000);
        expect(createMapEnemy(boss(56)).maxHp).toBeGreaterThan(createMapEnemy({ templateId: 'chiyou', level: 56 }).maxHp * 1.75);
    });

    test('les boss ont une puissance magique croissante, pas les ennemis normaux', () => {
        const boss = lvl => ({ templateId: 'chiyou', level: lvl, boss: { name: 'Nico' }, enemyId: 'nico' });
        expect(createMapEnemy(boss(56)).spellPower).toBe(bossSpellPower(56));
        expect(bossSpellPower(56)).toBeGreaterThan(200);
        expect(bossSpellPower(56)).toBeGreaterThan(bossSpellPower(10));
        expect(createMapEnemy({ templateId: 'chiyou', level: 56 }).spellPower).toBeUndefined();
    });

    test('agilité proportionnelle au niveau, très rarement nulle', () => {
        let zeros = 0;
        const N = 300;
        for (let i = 0; i < N; i++) {
            const e = createMapEnemy(enc(10));
            if (e.attributes.agility === 0) zeros++;
            expect(e.attributes.agility).toBeLessThanOrEqual(10);
        }
        expect(zeros).toBeLessThan(N * 0.15);
        const avg = lvl => Array.from({ length: 100 }, () => createMapEnemy(enc(lvl)).attributes.agility).reduce((a, b) => a + b, 0) / 100;
        expect(avg(30)).toBeGreaterThan(avg(5) * 3);
    });

    test('attaque et défense sont des pourcentages croissant avec le niveau', () => {
        const low = createMapEnemy(enc(3));
        const high = createMapEnemy(enc(30));
        expect(high.attack).toBeGreaterThan(low.attack);
        expect(low.attack).toBeLessThan(40);
        expect(high.attributes.strength).toBeGreaterThan(low.attributes.strength);
    });

    test('un boss est identique à chaque rencontre (arme, sorts, objet, stats)', () => {
        const boss = () => createMapEnemy(enc(12, { enemyId: 'boss-bambous', boss: { name: 'Boss test' } }));
        const first = boss();
        for (let i = 0; i < 10; i++) {
            const again = boss();
            expect(again.weapon?.id).toBe(first.weapon?.id);
            expect(again.spells.map(s => s.id)).toEqual(first.spells.map(s => s.id));
            expect(again.inventoryItem?.id).toBe(first.inventoryItem?.id);
            expect(again.abilities).toEqual(first.abilities);
            expect(again.attributes).toEqual(first.attributes);
            expect([again.attack, again.defense, again.maxHp]).toEqual([first.attack, first.defense, first.maxHp]);
        }
    });

    test('la génération de boss de palier est déterministe et ne perturbe pas Math.random', () => {
        const before = Math.random;
        const a = createBossEnemyForTier(10);
        const b = createBossEnemyForTier(10);
        expect(Math.random).toBe(before);
        expect([a.templateId, a.weapon?.id, a.spells.map(s => s.id)]).toEqual([b.templateId, b.weapon?.id, b.spells.map(s => s.id)]);
    });

    test('rééquilibrage : critique/blocage raisonnables, coups d\'arme proches du plafond, boss plus forts', () => {
        for (const level of [5, 20, 40]) {
            const normals = Array.from({ length: 60 }, () => createMapEnemy(enc(level)));
            const avg = f => normals.reduce((sum, e) => sum + f(e), 0) / normals.length;
            expect(avg(e => e.attack)).toBeLessThan(level * 1.5 + 8);
            expect(avg(e => e.defense)).toBeLessThan(level * 1.1 + 5);
            const cap = avg(e => e.maxHp) / 4;
            const hit = avg(e => (e.weapon?.damage || 0) + (e.weaponPower || 0));
            expect(hit).toBeGreaterThan(cap * 0.5);
            expect(hit).toBeLessThanOrEqual(cap * 1.3);
            const boss = createMapEnemy(enc(level, { enemyId: 'b', boss: { name: 'B' } }));
            expect(boss.maxHp).toBeGreaterThan(avg(e => e.maxHp) * 1.5);
            expect(boss.attack).toBeGreaterThan(avg(e => e.attack));
            expect(boss.spells.length).toBeLessThanOrEqual(4);
            expect(boss.spells.length).toBeGreaterThanOrEqual(Math.min(4, 2 + Math.floor(level / 3)) - 1);
        }
    });

    test('un ennemi normal reste aléatoire', () => {
        const ids = new Set(Array.from({ length: 40 }, () => createMapEnemy(enc(15)).weapon?.id));
        expect(ids.size).toBeGreaterThan(1);
    });
});

describe('mêmes limites que le joueur : sorts et armes', () => {
    test.each([5, 20, 40, 60])('un boss de palier %i a au plus 4 sorts et une seule arme', tier => {
        const boss = createBossEnemyForTier(tier);
        expect(boss.spells.length).toBeLessThanOrEqual(4);
        expect(Array.isArray(boss.weapon)).toBe(false);
    });
});

describe('écart de niveau : avantage caché du plus haut niveau', () => {
    test('aucun bonus sans écart en sa faveur, croissant puis plafonné', () => {
        expect(levelEdgeBonus({ levelEdge: 0 }, 12)).toBe(12);
        expect(levelEdgeBonus({}, 12)).toBe(12);
        expect(levelEdgeBonus({ levelEdge: 1 }, 12)).toBe(16 + 5);
        expect(levelEdgeBonus({ levelEdge: 4 }, 10)).toBe(36 + 20);
        expect(levelEdgeBonus({ levelEdge: 60 }, 10)).toBe(40 + 300);
    });

    test('il augmente les chances de critique et de blocage, sans changer les valeurs affichées', () => {
        const strong = { attack: 12, defense: 6, levelEdge: 4 };
        const plain = { attack: 12, defense: 6 };
        expect(critChance(strong)).toBeGreaterThan(critChance(plain) * 3);
        expect(blockChance(strong)).toBeGreaterThan(blockChance(plain) * 3);
        expect(rawAttack(strong)).toBe(12);
        expect(rawDefense(strong)).toBe(6);
    });
});

describe('statusBadges', () => {
    test('liste les bonus et malus actifs avec leur explication', async () => {
        const { activeStatuses, statusBadgesHtml } = await import('../../statusBadges.js');
        expect(activeStatuses({ statusEffects: {} })).toEqual([]);
        expect(statusBadgesHtml({})).toBe('');
        const list = activeStatuses({ statusEffects: { enraged: 2, enragedBonus: 10, poisoned: 1, poisonDamage: 3 } });
        expect(list.map(s => [s.id, s.kind, s.turns])).toEqual([['enraged', 'buff', 2], ['poisoned', 'debuff', 1]]);
        expect(list[0].text).toContain('+10');
        expect(statusBadgesHtml({ statusEffects: { enraged: 2, enragedBonus: 10 } })).toContain('data-status="enraged"');
        const { statusLinesHtml } = await import('../../statusBadges.js');
        expect(statusLinesHtml({ statusEffects: {} })).toBe('');
        expect(statusLinesHtml({ statusEffects: { poisoned: 2, poisonDamage: 3 } })).toContain('Poison');
    });
});
