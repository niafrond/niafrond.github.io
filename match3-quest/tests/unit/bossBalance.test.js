// Équilibrage des boss : PV bornés, grimoire offensif garanti, qì (départ, gain), faiblesse visible, butin de palier garanti à la première victoire.
import { describe, test, expect } from '@jest/globals';
import './fixtures/xhrFromDisk.js';
import {
    bossHpMult, BOSS_HP_MULT_MAX, ensureBossOffense, isOffensiveSpell, bossManaGainBonus, bossStartingMana, BOSS_CAST_PRIORITY, bossResistances, bossCounterStrength, BOSS_EXTRA_SPELLS, manaGainBonusOf, bossOffensiveScoreBonus, shouldBossCast, BOSS_COUNTER_FROM_LEVEL, BOSS_COUNTER_FULL_LEVEL, elementalCandidates
} from '../../bossBalance.js';
import { createMapEnemy, bossSpellPower, BOSS_SPELL_POWER_QUADRATIC } from '../../enemies.js';
import { MERCHANTS, merchantStock } from '../../merchants.js';
import { REGION_LEVEL } from '../../world/index.js';
import { exportSaveToFile } from '../../saveManager.js';
import { compareRows } from '../../compareView.js';
import { unreachableCosts } from '../../manaGear.js';
import { claimBossLoot } from '../../victoryLoot.js';
import { rollBossLoot, bossLootKey } from '../../victoryLoot.js';
import { allWeapons } from '../../weapons.js';
import { allItems } from '../../items.js';
import { getAllSpells } from '../../spells.js';
import { WARD_STUFF, WARD_TIERS, WARD_CAP, getStuffById, allStuff, describeStuff, describeWard, wardAgainst, wardedDamage, stuffTotals, normalizeStuff, lootableStuff } from '../../stuff.js';

const boss = (templateId, level, extra = {}) => createMapEnemy({ templateId, level, boss: { name: 'Boss test' }, enemyId: `boss_${templateId}_${level}`, ...extra });
const catalogIds = ['chiyou', 'canglong', 'wen_shen', 'huli_commun', 'zhulong_serpent', 'wu_shou', 'yingyu', 'feng_bo', 'bai_ze', 'xiangliu', 'jinwu', 'nu_gui'];

describe('PV des boss', () => {
    test('le coefficient de gabarit est borné (×1 à ×1,5)', () => {
        expect(bossHpMult(0.9)).toBe(1);
        expect(bossHpMult(1.2)).toBe(1.2);
        expect(bossHpMult(3)).toBe(BOSS_HP_MULT_MAX);
        expect(bossHpMult(undefined)).toBe(1);
    });

    test('au niveau 56, tout boss a entre 1 200 et 1 700 PV (1,75 × (55 + 12 × niveau) × coefficient de gabarit borné), quel que soit son gabarit', () => {
        for (const id of catalogIds) {
            const b = boss(id, 56);
            expect(b.maxHp).toBeGreaterThanOrEqual(Math.floor(727 * 1.75 * 0.99));
            expect(b.maxHp).toBeLessThanOrEqual(Math.ceil(727 * 1.75 * BOSS_HP_MULT_MAX * 1.01));
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
            expect(b.prep.lines.join(' ')).not.toMatch(/parure/);
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

    test('le jeu n\'annonce pas le contre-équipement : le joueur doit le deviner (c\'est dans la soluce)', () => {
        for (const id of catalogIds) expect(boss(id, 56).prep.lines.join(' ')).not.toMatch(/parure|antidote|venin/i);
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

    test('qì de départ = 50 % du coût des sorts offensifs, borné par la réserve', () => {
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

// ── Compléments : règles pures extraites de game.js / enemyAI.js, courbes, parures, marchands, sauvegarde ─────────────────────────────

describe('règles de combat des boss (game.js / enemyAI.js)', () => {
    test('manaGainBonusOf : seulement le champ du boss, jamais négatif', () => {
        expect(manaGainBonusOf(boss('chiyou', 56))).toBe(bossManaGainBonus(56));
        expect(manaGainBonusOf({ manaGainBonus: -4 })).toBe(0);
        expect(manaGainBonusOf({ manaGainBonus: 7.9 })).toBe(7);
        expect(manaGainBonusOf(null)).toBe(0);
        expect(manaGainBonusOf(createMapEnemy({ templateId: 'chiyou', level: 56 }))).toBe(0);
    });

    test('score offensif de l\'IA : bonus pour un boss seulement', () => {
        expect(bossOffensiveScoreBonus({ isBoss: true })).toBeGreaterThan(0);
        expect(bossOffensiveScoreBonus({ isBoss: false })).toBe(0);
        expect(bossOffensiveScoreBonus(undefined)).toBe(0);
    });

    test('shouldBossCast : boss + sort offensif abordable + tirage sous BOSS_CAST_PRIORITY', () => {
        const attack = { spell: { dmg: 90 } }, buff = { spell: { buff: true } };
        expect(shouldBossCast({ isBoss: true }, attack, () => 0)).toBe(true);
        expect(shouldBossCast({ isBoss: true }, attack, () => BOSS_CAST_PRIORITY)).toBe(false);   // tirage au-dessus : choix normal
        expect(shouldBossCast({ isBoss: true }, buff, () => 0)).toBe(false);                       // jamais pour un envoûtement
        expect(shouldBossCast({ isBoss: true }, null, () => 0)).toBe(false);                       // aucun sort abordable
        expect(shouldBossCast({ isBoss: false }, attack, () => 0)).toBe(false);                    // ennemi ordinaire
    });

    test('qì de départ d\'un vrai boss : une réserve par couleur de ses sorts offensifs, jamais pour les autres', () => {
        for (const id of catalogIds) {
            const b = boss(id, 56);
            const start = bossStartingMana(b.spells);
            const offensiveColors = new Set(b.spells.filter(isOffensiveSpell).flatMap(sp => typeof sp.cost === 'number' ? [sp.color] : Object.keys(sp.cost)));
            expect(Object.keys(start).length).toBeGreaterThan(0);
            Object.keys(start).forEach(c => expect(offensiveColors.has(c)).toBe(true));
            Object.values(start).forEach(v => expect(v).toBeGreaterThan(0));
        }
        expect(bossStartingMana([])).toEqual({});
        expect(bossStartingMana(undefined)).toEqual({});
    });

    test('unreachableCosts : coûts au-dessus de la réserve, mono et multi-couleurs', () => {
        expect(unreachableCosts({ cost: 60, color: 'red' }, () => 50)).toEqual([['red', 60, 50]]);
        expect(unreachableCosts({ cost: { blue: 80, green: 20 } }, c => (c === 'blue' ? 50 : 50))).toEqual([['blue', 80, 50]]);
        expect(unreachableCosts({ cost: { blue: 40 } }, () => 50)).toEqual([]);
        expect(unreachableCosts({}, () => 50)).toEqual([]);
        expect(unreachableCosts(null, () => 50)).toEqual([]);
    });
});

describe('courbes de PV et de puissance magique', () => {
    test('puissance magique : formule quadratique, croissante, jamais négative', () => {
        expect(bossSpellPower(1)).toBe(Math.round(BOSS_SPELL_POWER_QUADRATIC + 0.5));
        let prev = -1;
        for (let l = 1; l <= 76; l++) { const p = bossSpellPower(l); expect(p).toBeGreaterThanOrEqual(prev); prev = p; }
        expect(bossSpellPower(56)).toBeGreaterThan(bossSpellPower(30));
        expect(bossSpellPower(56)).toBeLessThan(120);   // sorts de boss lisibles pour un héros dont les PV suivent la vraie courbe (≈ 10 × niveau)
        expect(bossSpellPower(0)).toBe(bossSpellPower(1));
    });

    test('PV : jamais sous ceux d\'un ennemi normal, et ×1,5 au plus entre deux gabarits', () => {
        const hp = id => boss(id, 56).maxHp;
        const all = catalogIds.map(hp);
        expect(Math.max(...all) / Math.min(...all)).toBeLessThanOrEqual(1.5 + 0.01);
        for (const id of catalogIds) expect(hp(id)).toBeGreaterThan(createMapEnemy({ templateId: id, level: 56 }).maxHp);
    });

    test('un boss de niveau 1 reste jouable (PV et puissance magique minimes)', () => {
        const b = boss('chiyou', 1);
        expect(b.maxHp).toBeLessThan(400);
        expect(b.spellPower).toBeLessThanOrEqual(2);
        expect(b.manaGainBonus).toBe(bossManaGainBonus(1));
    });
});

describe('grimoire : élément et niveau', () => {
    test('au-delà du niveau 15, les sorts offensifs d\'un boss sont de sa couleur ; en dessous, tirage libre mais jamais sans attaque', () => {
        const colorsOf = sp => [...(sp.colors || []), sp.color, ...Object.keys(typeof sp.cost === 'object' ? sp.cost : {})].filter(Boolean);
        for (const id of catalogIds) {
            for (const level of [16, 25, 40, 70]) {
                const b = boss(id, level, { enemyId: `l${level}` });
                const offensive = b.spells.filter(isOffensiveSpell);
                expect(offensive.length).toBeGreaterThanOrEqual(1);
                offensive.forEach(sp => expect(colorsOf(sp)).toContain(b.preferredColor));
            }
            expect(boss(id, 8).spells.some(isOffensiveSpell)).toBe(true);
        }
    });

    test('elementalCandidates : replie sur tous les sorts quand l\'élément en a moins de deux', () => {
        const pool = [{ id: 'a', dmg: 50, color: 'red' }, { id: 'b', dmg: 60, color: 'blue' }, { id: 'c', dmg: 70, color: 'blue' }];
        expect(elementalCandidates(pool, 'blue').map(s => s.id)).toEqual(['b', 'c']);
        expect(elementalCandidates(pool, 'red')).toBe(pool);
        expect(elementalCandidates(pool, 'green')).toBe(pool);
    });

    test('les attaques de Terre réservées aux boss sont cohérentes (offensives, vertes, mêmes paliers que Feu/Eau)', () => {
        expect(BOSS_EXTRA_SPELLS).toHaveLength(3);
        BOSS_EXTRA_SPELLS.forEach(sp => { expect(sp.color).toBe('green'); expect(isOffensiveSpell(sp)).toBe(true); expect(sp.minLevel).toBeLessThanOrEqual(BOSS_COUNTER_FROM_LEVEL); });
        expect(new Set(BOSS_EXTRA_SPELLS.map(s => s.id)).size).toBe(3);
        const ids = new Set(getAllSpells().map(s => s.id));
        BOSS_EXTRA_SPELLS.forEach(sp => expect(ids.has(sp.id)).toBe(false));   // hors spells.json : aucun sort de héros ajouté
    });

    test('un boss vert de niveau 40 lance bien ses attaques de Terre', () => {
        const greens = catalogIds.map(id => boss(id, 40)).filter(b => b.preferredColor === 'green');
        expect(greens.length).toBeGreaterThan(0);
        greens.forEach(b => expect(b.spells.filter(isOffensiveSpell).length).toBeGreaterThanOrEqual(2));
    });

    test('constantes de niveau minimum cohérentes avec les parures', () => {
        expect(BOSS_COUNTER_FROM_LEVEL).toBeLessThan(BOSS_COUNTER_FULL_LEVEL);
        expect(WARD_TIERS[0].minLevel).toBeGreaterThanOrEqual(BOSS_COUNTER_FROM_LEVEL);   // la contre-mesure n'existe pas avant que l'exigence commence
        expect(WARD_TIERS[0].minLevel).toBeLessThanOrEqual(BOSS_COUNTER_FULL_LEVEL);
    });
});

describe('parures : totaux, plafond, description, état du héros', () => {
    const wear = ids => { const h = { stuffOwned: [...ids], stuff: {} }; ids.forEach(id => { h.stuff[getStuffById(id).slot] = id; }); return h; };

    test('chaque pièce : un seul élément, bonne rareté et bon niveau selon son palier', () => {
        for (const piece of WARD_STUFF) {
            const colors = Object.keys(piece.ward);
            expect(colors).toHaveLength(1);
            const tier = WARD_TIERS.find(t => t.minLevel === piece.minLevel);
            expect(tier).toBeTruthy();
            expect(piece.ward[colors[0]]).toBe(tier.ward);
            expect(piece.rarity).toBe(tier.rarity);
            expect(piece.quest).toBeUndefined();
        }
    });

    test('la totalité des 40 pièces est en butin et en vente (aucune pièce de quête)', () => {
        const loot = new Set(lootableStuff().map(s => s.id));
        WARD_STUFF.forEach(p => expect(loot.has(p.id)).toBe(true));
    });

    test('les protections de couleurs différentes ne se mélangent pas et se cumulent par couleur', () => {
        const h = wear(['ward_red_head_1', 'ward_red_neck_1', 'ward_blue_wrist_2', 'ward_blue_ring_2']);
        const total = stuffTotals(h).ward;
        expect(total.red).toBe(12);
        expect(total.blue).toBe(20);
        expect(total.green + total.yellow + total.purple).toBe(0);
        expect(wardAgainst(h, 'blue')).toBeCloseTo(0.2);
        expect(describeWard(total)).toBe('Feu −12 %, Eau −20 %');
    });

    test('le plafond de protection est respecté', () => {
        // Pièces fictives de 40 % (insérées puis retirées du catalogue) : 4 × 40 % = 160 % → plafonné à WARD_CAP
        const fakes = ['head', 'neck', 'wrist', 'ring'].map(slot => ({ id: `fake_${slot}`, type: 'stuff', slot, name: slot, minLevel: 1, rarity: 'common', ward: { red: 40 } }));
        allStuff.push(...fakes);
        try {
            const h = { stuffOwned: fakes.map(f => f.id), stuff: Object.fromEntries(fakes.map(f => [f.slot, f.id])) };
            expect(stuffTotals(h).ward.red).toBe(WARD_CAP);
            expect(wardAgainst(h, ['red'])).toBeCloseTo(WARD_CAP / 100);
            expect(wardedDamage(100, h, ['red'])).toBe(100 - WARD_CAP);
        } finally {
            fakes.forEach(f => allStuff.splice(allStuff.indexOf(f), 1));
        }
        expect(getStuffById('fake_head')).toBeNull();
    });

    test('wardedDamage : réduit, au moins 1, inchangé sans parure ni couleur', () => {
        const full = wear(['ward_red_head_2', 'ward_red_neck_2', 'ward_red_wrist_2', 'ward_red_ring_2']);
        expect(wardedDamage(100, full, ['red'])).toBe(60);
        expect(wardedDamage(100, full, ['blue'])).toBe(100);
        expect(wardedDamage(100, full, ['red', 'blue'])).toBe(80);
        expect(wardedDamage(1, full, ['red'])).toBe(1);
        expect(wardedDamage(100, { stuffOwned: [], stuff: {} }, ['red'])).toBe(100);
        expect(wardedDamage(100, full, [])).toBe(100);
    });

    test('normalizeStuff garde les parures possédées et porte la bonne pièce dans son emplacement', () => {
        const h = { stuffOwned: ['ward_green_ring_1', 'inconnu'], stuff: { ring: 'ward_green_ring_1', head: 'ward_green_ring_1' } };
        normalizeStuff(h);
        expect(h.stuffOwned).toEqual(['ward_green_ring_1']);
        expect(h.stuff.ring).toBe('ward_green_ring_1');
        expect(h.stuff.head).toBeNull();
    });

    test('le comparateur affiche la protection élémentaire', () => {
        const row = compareRows('stuff', getStuffById('ward_purple_neck_1')).find(r => r.label === 'Protection élémentaire');
        expect(row.text).toBe('Arcane −6 %');
        expect(compareRows('stuff', getStuffById('casque_de_cuir')).find(r => r.label === 'Protection élémentaire').text).toBe('—');
    });
});

describe('butin de palier : première victoire seulement', () => {
    const hero = level => ({ level, weapons: [], inventory: [], stuffOwned: [] });

    test('un ennemi ordinaire ne donne rien', () => {
        expect(claimBossLoot(hero(56), { isBoss: false, preferredColor: 'red' })).toEqual([]);
        expect(claimBossLoot(hero(56), null)).toEqual([]);
    });

    test('première victoire : arme + relique + parure ; la clé est mémorisée ; la seconde ne donne rien', () => {
        const owner = hero(56);
        const b = boss('chiyou', 56);
        const first = claimBossLoot(owner, b, () => 0);
        expect(first.map(e => e.kind).sort()).toEqual(['item', 'stuff', 'weapon']);
        expect(owner.bossLootClaimed).toHaveLength(1);
        expect(claimBossLoot(owner, b, () => 0)).toEqual([]);
        expect(owner.bossLootClaimed).toHaveLength(1);
    });

    test('deux boss différents : deux butins (clé par ennemi)', () => {
        const owner = hero(56);
        expect(claimBossLoot(owner, boss('chiyou', 56, { enemyId: 'a' }), () => 0).length).toBeGreaterThan(0);
        expect(claimBossLoot(owner, boss('chiyou', 56, { enemyId: 'b' }), () => 0).length).toBeGreaterThan(0);
        expect(owner.bossLootClaimed).toHaveLength(2);
    });

    test('un maître d\'arène : une clé par cercle, indépendante de l\'ennemi', () => {
        const owner = hero(56);
        const master = { isBoss: true, preferredColor: 'blue', arena: { master: true, tier: 4 }, level: 30 };
        expect(claimBossLoot(owner, master, () => 0).length).toBeGreaterThan(0);
        expect(owner.bossLootClaimed).toEqual(['arena:4']);
        expect(claimBossLoot(owner, { ...master, name: 'autre' }, () => 0)).toEqual([]);
    });

    test('ancienne sauvegarde sans bossLootClaimed : le champ est créé', () => {
        const owner = { level: 56, weapons: [], inventory: [] };
        claimBossLoot(owner, boss('chiyou', 56), () => 0);
        expect(Array.isArray(owner.bossLootClaimed)).toBe(true);
    });

    test('la sauvegarde exportée contient bossLootClaimed', async () => {
        const player = { name: 'Hou Yi', level: 56, hp: 10, maxHp: 10, bossLootClaimed: ['map:a', 'arena:2'], inventory: [], equipment: {}, weapons: [] };
        const result = exportSaveToFile(player, '1.0.0');
        const data = JSON.parse(await result.blob.text());
        expect(JSON.stringify(data)).toContain('map:a');
        expect(JSON.stringify(data)).toContain('arena:2');
    });
});

describe('marchands et parures', () => {
    test('un marchand propose une parure du bon palier dès que le palier 1 est à portée de sa région', () => {
        for (const m of MERCHANTS) {
            const L = REGION_LEVEL[m.region];
            const offers = merchantStock(m.id).filter(o => o.kind === 'stuff' && getStuffById(o.id)?.ward);
            const reachable = WARD_STUFF.some(s => s.minLevel <= L + 4 && s.minLevel >= L - 14);
            expect(offers.length > 0).toBe(reachable);
            offers.forEach(o => { const s = getStuffById(o.id); expect(s.minLevel).toBeLessThanOrEqual(L + 4); expect(s.minLevel).toBeGreaterThanOrEqual(L - 14); });
        }
    });

    test('aucun doublon dans un stock, et l\'offre de parure est unique et payante', () => {
        for (const m of MERCHANTS) {
            const keys = merchantStock(m.id).map(o => o.key);
            expect(new Set(keys).size).toBe(keys.length);
            merchantStock(m.id).filter(o => getStuffById(o.id)?.ward).forEach(o => { expect(o.unique).toBe(true); expect(o.price).toBeGreaterThan(0); });
        }
    });

    test('le stock reste déterministe', () => {
        for (const m of MERCHANTS) expect(merchantStock(m.id)).toEqual(merchantStock(m.id));
    });
});
