import { describe, test, expect } from '@jest/globals';
import { estimateEnemyHp, targetCycles, durationVerdict, levelMultipliers, beginCombatRecord, recordPlayerTurn, recordEnemyTurn, recordDamageDealt, pauseCombatRecord, resumeCombatRecord, finishCombatRecord, summarizeCombats, saveCombatRecord, loadCombatRecords, COMBAT_STATS_KEEP } from '../../combatBalance.js';

describe('combatBalance : formules', () => {
    test('exemple du document : 40 dégâts/cycle, cycle de 30 s, 3 min 30 → 280 PV', () => {
        expect(estimateEnemyHp({ effectiveDamagePerCycle: 40, targetDurationSeconds: 210, averageCycleSeconds: 30 })).toBe(280);
        expect(targetCycles(480, 30)).toBe(16);
    });
    test('le coefficient de profil s\'applique', () => {
        expect(estimateEnemyHp({ effectiveDamagePerCycle: 40, targetDurationSeconds: 450, averageCycleSeconds: 30, profileMultiplier: 1.2 })).toBe(720);
    });
    test('verdict de durée', () => {
        expect(durationVerdict('normal', 150)).toBe('short');
        expect(durationVerdict('normal', 240)).toBe('ok');
        expect(durationVerdict('normal', 280)).toBe('long');
        expect(durationVerdict('boss', 500)).toBe('long');
    });
    test('multiplicateurs de niveau : 1 au niveau 1, croissants', () => {
        expect(levelMultipliers(1)).toEqual({ hp: 1, attack: 1, defense: 1 });
        expect(levelMultipliers(100).hp).toBeGreaterThan(levelMultipliers(50).hp);
    });
});

describe('combatBalance : enregistreur', () => {
    test('une longue pause de réflexion n\'est comptée que jusqu\'à 20 s', () => {
        beginCombatRecord({}, 0);
        recordPlayerTurn(10000);
        recordEnemyTurn(15000);
        recordPlayerTurn(315000);   // 5 min de réflexion : 20 s comptées
        const r = finishCombatRecord('victory', 320000);
        expect(r.seconds).toBe(40);
    });

    test('durée sans pause, cycles et dégâts par cycle', () => {
        beginCombatRecord({ boss: false }, 0);
        for (let i = 0; i < 4; i++) { recordPlayerTurn(i * 1000); recordEnemyTurn(i * 1000); }
        recordDamageDealt(160, 4000);
        pauseCombatRecord(60000); resumeCombatRecord(90000);
        const r = finishCombatRecord('victory', 105000);   // 105 s − 36 s de réflexion longue − 30 s de pause
        expect(r).toMatchObject({ seconds: 39, cycles: 4, damagePerCycle: 40, outcome: 'victory' });
        expect(finishCombatRecord('victory')).toBeNull();
    });
    test('synthèse : victoires ET défaites, abandons exclus', () => {
        const s = summarizeCombats([{ outcome: 'victory', seconds: 120, cycles: 4, dealt: 160 }, { outcome: 'victory', seconds: 180, cycles: 6, dealt: 240 }, { outcome: 'defeat', seconds: 60, cycles: 2, dealt: 40 }, { outcome: 'abandon', seconds: 10, cycles: 1, dealt: 0 }]);
        expect(s).toEqual({ count: 3, victories: 2, defeats: 1, winRate: 0.67, averageCycleSeconds: 30, effectiveDamagePerCycle: 36.7, damageBySourcePerCycle: { weapon: 0, spell: 0, skull: 0, other: 0 }, rawDamageTakenPerCycle: 0, averageSeconds: 120 });
    });
    test('stockage borné', () => {
        const mem = {}; const storage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
        for (let i = 0; i < COMBAT_STATS_KEEP + 5; i++) saveCombatRecord({ outcome: 'victory', cycles: 1, seconds: i }, storage);
        const list = loadCombatRecords(storage);
        expect(list).toHaveLength(COMBAT_STATS_KEEP);
        expect(list.at(-1).seconds).toBe(COMBAT_STATS_KEEP + 4);
    });
});

import { maxDamageMultFor, MODE_MAX_DAMAGE_MULT, MAX_DAMAGE_MULT, heroEffectiveHp, heroReferenceHp, calibrateEnemy, enemyCategory, DEFAULT_CYCLE_SECONDS, ENEMY_WIN_RATIO, ENEMY_RAW_CATEGORY_FACTOR, HP_DURATION_FACTOR, winRatioLevelFactor, measuredCorrections, cappedEnemyHit, HIT_SHARE_CAP, EXPERT_WIN_RATIO_FACTOR, EXPERT_CATEGORY_FACTOR, heroDamagePerCycleModel, enemyRawDamagePerCycleModel } from '../../combatBalance.js';

describe('combatBalance : calibrage des ennemis', () => {
    test('catégories', () => {
        expect(enemyCategory({ boss: true, hpMult: 1 })).toBe('boss');
        expect(enemyCategory({ easy: true, hpMult: 2 })).toBe('weak');
        expect(enemyCategory({ hpMult: 1 })).toBe('normal');
        expect(enemyCategory({ hpMult: 1.5 })).toBe('aggressive');
        expect(enemyCategory({ hpMult: 1.8 })).toBe('elite');
        expect(enemyCategory({ hpMult: 3 })).toBe('miniBoss');
    });
    test('sans mesure : modèles de simulation ; plus la catégorie est haute, plus les PV sont élevés', () => {
        const order = ['weak', 'normal', 'aggressive', 'elite', 'miniBoss', 'boss'];
        const hps = order.map(category => calibrateEnemy({ category, heroMaxHp: 150, heroLevel: 10 }).hpBase);
        expect(hps).toEqual([...hps].sort((a, b) => a - b));
        const n = calibrateEnemy({ category: 'normal', heroMaxHp: 300, heroLevel: 30 });
        expect(n.measured).toBe(false);
        expect(n.hpBase).toBe(Math.round(heroDamagePerCycleModel(30) * (210 / DEFAULT_CYCLE_SECONDS) * HP_DURATION_FACTOR.normal));
        expect(n.hp).toBe(n.hpBase);
        // l'ennemi vainc le héros en ENEMY_WIN_RATIO × la durée cible, d'après ses dégâts bruts modélisés
        const raw = enemyRawDamagePerCycleModel(30, 'normal');
        expect(300 / (raw * n.damageScale)).toBeCloseTo(7 * ENEMY_WIN_RATIO.normal * winRatioLevelFactor(30) * EXPERT_WIN_RATIO_FACTOR * EXPERT_CATEGORY_FACTOR.normal, 0);
    });
    test('ajustement par niveau : interpolé entre les points d\'ancrage', () => {
        expect(winRatioLevelFactor(1, [[5, 0.5], [15, 1]])).toBe(0.5);
        expect(winRatioLevelFactor(10, [[5, 0.5], [15, 1]])).toBeCloseTo(0.75, 5);
        expect(winRatioLevelFactor(99, [[5, 0.5], [15, 1]])).toBe(1);
    });
    test('modèles : croissants avec le niveau ; boss plus dangereux qu\'un normal', () => {
        expect(heroDamagePerCycleModel(70)).toBeGreaterThan(heroDamagePerCycleModel(10));
        expect(enemyRawDamagePerCycleModel(30, 'boss')).toBeGreaterThan(enemyRawDamagePerCycleModel(30, 'normal'));
        expect(ENEMY_RAW_CATEGORY_FACTOR.boss).toBeGreaterThan(1);
    });
    // Combat mesuré où le héros fait 2× le modèle et l'ennemi 0,5× le modèle, au niveau 10, cycles de 30 s.
    const rec = (outcome = 'victory', level = 10) => ({ outcome, playerLevel: level, enemyLevel: level, category: 'normal', seconds: 240, cycles: 8,
        dealt: 8 * 2 * heroDamagePerCycleModel(level), takenRaw: 8 * 0.5 * enemyRawDamagePerCycleModel(level, 'normal') });
    test('calibration : rien sous 5 combats, puis un mélange progressif (jamais 100 % mesure)', () => {
        expect(measuredCorrections(Array(4).fill(rec()), 10)).toMatchObject({ weight: 0, hero: 1, enemy: 1 });
        const at5 = measuredCorrections(Array(5).fill(rec()), 10), at20 = measuredCorrections(Array(20).fill(rec()), 10), at60 = measuredCorrections(Array(60).fill(rec()), 10);
        expect(at5.weight).toBeCloseTo(0.2, 2);
        expect(at20.weight).toBe(0.5);
        expect(at20.hero).toBeCloseTo(1.5, 5);     // 1 + 0,5 × (2 − 1)
        expect(at20.enemy).toBeCloseTo(0.75, 5);   // 1 + 0,5 × (0,5 − 1)
        expect(at60.weight).toBeLessThan(1);
    });
    test('calibration : les défaites comptent, la médiane résiste aux combats aberrants, l\'écart est borné', () => {
        const mixed = [...Array(10).fill(rec('victory')), ...Array(10).fill(rec('defeat'))];
        expect(measuredCorrections(mixed, 10).n).toBe(20);
        const outliers = [...Array(17).fill(rec()), ...Array(3).fill({ ...rec(), dealt: 1e6 })];
        expect(measuredCorrections(outliers, 10).hero).toBeCloseTo(1.5, 5);
        const extreme = Array(20).fill({ ...rec(), dealt: 8 * 10 * heroDamagePerCycleModel(10) });   // ×10 mesuré → borné à ×2
        expect(measuredCorrections(extreme, 10).hero).toBeCloseTo(1.5, 5);
        expect(measuredCorrections(Array(20).fill(rec('abandon')), 10).n).toBe(0);
    });
    test('calibration : combats d\'un autre niveau ignorés ; le calibrage en tient compte', () => {
        expect(measuredCorrections(Array(20).fill(rec('victory', 40)), 10).n).toBe(0);
        const r = calibrateEnemy({ category: 'normal', heroMaxHp: 240, heroLevel: 10, records: Array(20).fill(rec()) });
        expect(r.measured).toBe(true);
        expect(r.measuredWeight).toBe(0.5);
        expect(r.hpBase).toBe(Math.round(heroDamagePerCycleModel(10) * 1.5 * 7 * HP_DURATION_FACTOR.normal));
    });
    test('coup fatal : le multiplicateur ne porte jamais un coup au-delà du plafond des PV max du héros', () => {
        expect(cappedEnemyHit(30, 2, 1000)).toBe(60);       // sous le plafond : multiplié
        expect(cappedEnemyHit(100, 7, 400)).toBe(Math.round(400 * HIT_SHARE_CAP));      // 700 → plafonné
        expect(cappedEnemyHit(200, 3, 400)).toBe(200);      // chiffres bruts déjà au-dessus : gardés, jamais augmentés
        expect(cappedEnemyHit(0, 5, 400)).toBe(0);
        expect(HIT_SHARE_CAP * 1.5).toBeLessThan(1);         // même critique (×1,5), un coup plein ne tue pas
    });
});

describe('combatBalance : le héros n\'est pas un sac à PV', () => {
    test('référence : 100 au niveau 1, +6 par niveau, +5 de plus après le 20', () => {
        expect(heroReferenceHp(1)).toBe(100);
        expect(heroReferenceHp(20)).toBe(214);
        expect(heroReferenceHp(21)).toBe(225);
    });
    test('sous le plafond (+60 %) : tout compte ; au-delà : un quart seulement', () => {
        expect(heroEffectiveHp(300, 20)).toBe(300);
        expect(heroEffectiveHp(1226, 29)).toBe(Math.round(heroReferenceHp(29) * 1.6 + (1226 - heroReferenceHp(29) * 1.6) * 0.25));
    });
    test('calibrage : un héros gonflé voit ses dégâts subis majorés, pas ses PV changés', () => {
        const r = calibrateEnemy({ category: 'normal', heroMaxHp: 1226, heroLevel: 29 });
        expect(r.heroDamageScale).toBeGreaterThan(1);
        expect(r.heroEffectiveHp).toBeLessThan(1226);
        expect(calibrateEnemy({ category: 'normal', heroMaxHp: 300, heroLevel: 29 }).heroDamageScale).toBe(1);
    });
});

import { recordDamageDealt as dealt, damageShares, DAMAGE_SOURCES } from '../../combatBalance.js';
describe('combatBalance : source des dégâts', () => {
    test('arme, sort, crânes et autres sont comptés à part', () => {
        beginCombatRecord({}, 0);
        recordPlayerTurn(1000); recordEnemyTurn(2000);
        dealt(30, 3000, 'weapon'); dealt(50, 4000, 'spell'); dealt(15, 5000, 'skull'); dealt(5, 6000, 'poison?'); dealt(10, 7000);
        const r = finishCombatRecord('victory', 8000);
        expect(r.dealt).toBe(110);
        expect(r.dealtBy).toEqual({ weapon: 30, spell: 50, skull: 15, other: 15 });
    });
    test('synthèse par source et parts', () => {
        const rec = { outcome: 'victory', seconds: 60, cycles: 2, dealt: 100, dealtBy: { weapon: 20, spell: 60, skull: 20, other: 0 } };
        const s = summarizeCombats([rec, rec]);
        expect(s.damageBySourcePerCycle).toEqual({ weapon: 10, spell: 30, skull: 10, other: 0 });
        expect(damageShares(s)).toEqual({ weapon: 0.2, spell: 0.6, skull: 0.2, other: 0 });
        expect(DAMAGE_SOURCES).toHaveLength(4);
    });
});

import { DIFFICULTY_TARGET_WIN_RATE, MODE_DIVISOR, MIN_DAMAGE_MULT } from '../../combatBalance.js';
describe('combatBalance : mode de difficulté', () => {
    test('les PV ne dépendent pas du mode (durée 3 à 8 min) ; un mode plus doux divise l\'attaque et le stuff', () => {
        const base = { category: 'boss', heroMaxHp: 400, heroLevel: 40 };
        expect(new Set(['easy', 'normal', 'auto', 'hard', 'expert'].map(d => calibrateEnemy({ ...base, difficulty: d }).hp)).size).toBe(1);
        const hard = calibrateEnemy({ ...base, modeDivisor: 1 }), soft = calibrateEnemy({ ...base, modeDivisor: 2 });
        expect(soft.hp).toBe(hard.hp);
        expect(soft.damageMult).toBe(Math.max(MIN_DAMAGE_MULT, Math.round(hard.damageMult / 2 * 100) / 100));
        expect(soft.gearScale).toBe(0.5);
    });
    test('cibles décroissantes de Facile à Expert ; diviseurs décroissants aussi', () => {
        expect(DIFFICULTY_TARGET_WIN_RATE.easy.boss).toBeGreaterThan(DIFFICULTY_TARGET_WIN_RATE.expert.boss);
        Object.keys(MODE_DIVISOR.easy).forEach(cat => expect(MODE_DIVISOR.easy[cat]).toBeGreaterThanOrEqual(MODE_DIVISOR.expert[cat]));
    });
});

import { BOSS_ADJUST, MIN_DAMAGE_MULT_BOSS } from '../../combatBalance.js';
describe('combatBalance : réglage propre à chaque boss', () => {
    test('attack divise l\'attaque (un boss peut descendre jusqu\'à la moitié de son grimoire), hp multiplie les PV', () => {
        const base = { category: 'boss', heroMaxHp: 400, heroLevel: 40, enemyLevel: 41 };
        const plain = calibrateEnemy(base), adj = calibrateEnemy({ ...base, adjust: { attack: 2, hp: 1.5 } });
        expect(adj.hp).toBe(Math.round(plain.hp * 1.5));
        expect(adj.damageMult).toBeLessThan(plain.damageMult);
        expect(calibrateEnemy({ ...base, adjust: { attack: 100 } }).damageMult).toBe(MIN_DAMAGE_MULT_BOSS);
        expect(calibrateEnemy({ ...base, category: 'normal', adjust: { attack: 100 } }).damageMult).toBe(1);
    });
    test('chaque réglage de boss est borné', () => {
        Object.values(BOSS_ADJUST).forEach(a => {
            expect(a.attack).toBeGreaterThan(0.1);
            expect(a.attack).toBeLessThan(10);
            expect(a.hp).toBeGreaterThanOrEqual(0.6);
            expect(a.hp).toBeLessThanOrEqual(1.6);
        });
        expect(Object.keys(BOSS_ADJUST).length).toBeGreaterThan(30);
    });
});

import { EXPERT_DAMAGE_BONUS, EXPERT_HIT_SHARE_CAP, EXPERT_SPELL_COST_FACTOR, EXPERT_CATCHUP_CAP, EXPERT_CATCHUP_THRESHOLD, expertCatchUpPoints, enemySpellCost, isExpertMode } from '../../combatBalance.js';
describe('combatBalance : leviers propres au mode Expert', () => {
    const base = { category: 'normal', heroMaxHp: 400, heroLevel: 30, enemyLevel: 30 };
    test('Expert : dégâts × EXPERT_DAMAGE_BONUS, plafond de coup relevé, sorts moins chers ; PV inchangés', () => {
        const hard = calibrateEnemy({ ...base, modeDivisor: 1, difficulty: 'hard' }), exp = calibrateEnemy({ ...base, modeDivisor: 1, difficulty: 'expert' });
        expect(exp.hp).toBe(hard.hp);
        expect(exp.damageMult).toBeCloseTo(Math.min(7, hard.damageMult * EXPERT_DAMAGE_BONUS), 1);
        expect(exp.hitShareCap).toBe(EXPERT_HIT_SHARE_CAP);
        expect(exp.spellCostFactor).toBe(EXPERT_SPELL_COST_FACTOR);
    });
    test('les autres modes ne changent pas (plafond 40 %, coûts du grimoire)', () => {
        for (const d of ['easy', 'normal', 'auto', 'hard']) {
            const r = calibrateEnemy({ ...base, difficulty: d });
            expect(r.hitShareCap).toBe(HIT_SHARE_CAP);
            expect(r.spellCostFactor).toBe(1);
        }
        expect(isExpertMode('expert')).toBe(true);
        expect(isExpertMode('auto')).toBe(false);
    });
    test('plafond relevé : un coup plein, même critique, ne tue toujours pas', () => {
        expect(EXPERT_HIT_SHARE_CAP).toBeGreaterThan(HIT_SHARE_CAP);
        expect(EXPERT_HIT_SHARE_CAP * 1.5).toBeLessThan(1);
        expect(cappedEnemyHit(100, 7, 400, EXPERT_HIT_SHARE_CAP)).toBe(Math.round(400 * EXPERT_HIT_SHARE_CAP));
        expect(cappedEnemyHit(100, 7, 400)).toBe(Math.round(400 * HIT_SHARE_CAP));
    });
    test('coût des sorts d\'ennemi : arrondi au-dessus, au moins 1, inchangé sans facteur', () => {
        expect(enemySpellCost(9, EXPERT_SPELL_COST_FACTOR)).toBe(7);
        expect(enemySpellCost(5, EXPERT_SPELL_COST_FACTOR)).toBe(4);
        expect(enemySpellCost(1, EXPERT_SPELL_COST_FACTOR)).toBe(1);
        expect(enemySpellCost(9)).toBe(9);
        expect(enemySpellCost(9, 1)).toBe(9);
    });
    test('rattrapage d\'Att/Déf : rien sous le seuil, la moitié de l\'excédent au-delà, plafonné', () => {
        expect(expertCatchUpPoints(60, 32)).toBe(Math.floor((60 - 32 - EXPERT_CATCHUP_THRESHOLD) * 0.5));
        expect(expertCatchUpPoints(105, 32)).toBe(EXPERT_CATCHUP_CAP);
        expect(expertCatchUpPoints(40, 30)).toBe(0);
        expect(expertCatchUpPoints(30, 100)).toBe(0);
        expect(expertCatchUpPoints(500, 10)).toBe(EXPERT_CATCHUP_CAP);
    });
});

describe('plafond du multiplicateur de dégâts selon le mode', () => {
    const hero = { heroMaxHp: 596, heroLevel: 33, enemyLevel: 31 };
    const cats = ['weak', 'normal', 'aggressive', 'elite', 'miniBoss', 'boss'];
    test('Facile ×3 et Normal ×4 ; Auto, Difficile et Expert gardent ×7', () => {
        expect(maxDamageMultFor('easy')).toBe(3);
        expect(maxDamageMultFor('normal')).toBe(4);
        ['auto', 'hard', 'expert', undefined].forEach(d => expect(maxDamageMultFor(d)).toBe(MAX_DAMAGE_MULT));
        expect(MODE_MAX_DAMAGE_MULT.normal).toBeLessThan(MAX_DAMAGE_MULT);
    });
    test('en Normal, aucun ennemi (boss compris, même réglé très offensif) ne dépasse ×4', () => {
        cats.forEach(category => expect(calibrateEnemy({ ...hero, category, difficulty: 'normal' }).damageMult).toBeLessThanOrEqual(4));
        expect(calibrateEnemy({ ...hero, category: 'boss', difficulty: 'normal', adjust: { attack: 0.15, hp: 1 } }).damageMult).toBe(4);
        cats.forEach(category => expect(calibrateEnemy({ ...hero, category, difficulty: 'easy' }).damageMult).toBeLessThanOrEqual(3));
    });
    test("les autres modes ne sont pas touchés (ennemi normal, Expert : ×7)", () => {
        expect(calibrateEnemy({ ...hero, category: 'normal', difficulty: 'expert' }).damageMult).toBe(7);
        expect(calibrateEnemy({ ...hero, category: 'normal', difficulty: 'auto' }).damageMult).toBeGreaterThan(4);
    });
});
