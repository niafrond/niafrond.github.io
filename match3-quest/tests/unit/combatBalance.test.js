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
    test('synthèse : ne garde que les victoires', () => {
        const s = summarizeCombats([{ outcome: 'victory', seconds: 120, cycles: 4, dealt: 160 }, { outcome: 'victory', seconds: 180, cycles: 6, dealt: 240 }, { outcome: 'defeat', seconds: 10, cycles: 1, dealt: 0 }]);
        expect(s).toEqual({ count: 2, averageCycleSeconds: 30, effectiveDamagePerCycle: 40, rawDamageTakenPerCycle: 0, averageSeconds: 150 });
    });
    test('stockage borné', () => {
        const mem = {}; const storage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
        for (let i = 0; i < COMBAT_STATS_KEEP + 5; i++) saveCombatRecord({ outcome: 'victory', cycles: 1, seconds: i }, storage);
        const list = loadCombatRecords(storage);
        expect(list).toHaveLength(COMBAT_STATS_KEEP);
        expect(list.at(-1).seconds).toBe(COMBAT_STATS_KEEP + 4);
    });
});

import { calibrateEnemy, enemyCategory, DEFAULT_CYCLE_SECONDS, ENEMY_WIN_RATIO, heroDamagePerCycleModel } from '../../combatBalance.js';

describe('combatBalance : calibrage des ennemis', () => {
    test('catégories', () => {
        expect(enemyCategory({ boss: true, hpMult: 1 })).toBe('boss');
        expect(enemyCategory({ easy: true, hpMult: 2 })).toBe('weak');
        expect(enemyCategory({ hpMult: 1 })).toBe('normal');
        expect(enemyCategory({ hpMult: 1.5 })).toBe('aggressive');
        expect(enemyCategory({ hpMult: 1.8 })).toBe('elite');
        expect(enemyCategory({ hpMult: 3 })).toBe('miniBoss');
    });
    test('sans mesure : PV d\'après le modèle, dégâts inchangés ; plus la catégorie est haute, plus les PV sont élevés', () => {
        const order = ['weak', 'normal', 'aggressive', 'elite', 'miniBoss', 'boss'];
        const hps = order.map(category => calibrateEnemy({ category, heroMaxHp: 500 }).hp);
        expect(hps).toEqual([...hps].sort((a, b) => a - b));
        const n = calibrateEnemy({ category: 'normal', heroMaxHp: 500 });
        expect(n.damageScale).toBe(1);
        expect(n.measured).toBe(false);
        expect(n.hp).toBe(Math.round(heroDamagePerCycleModel(500) * (210 / DEFAULT_CYCLE_SECONDS) * 1));
    });
    test('avec mesures : l\'ennemi tue le héros en ENEMY_WIN_RATIO × la durée cible', () => {
        const rec = { outcome: 'victory', playerLevel: 10, seconds: 240, cycles: 8, dealt: 400, takenRaw: 160 };   // 20 dégâts bruts/cycle, cycle 30 s
        const r = calibrateEnemy({ category: 'normal', heroMaxHp: 420, heroLevel: 10, records: [rec, rec, rec, rec] });
        expect(r.measured).toBe(true);
        expect(r.hp).toBe(Math.round(50 * 7));
        // héros 420 PV, 7 cycles × 1,2 = 8,4 cycles → 50 dégâts/cycle voulus (20 mesurés → ×2,5)
        expect(r.damageScale).toBe(2.5);
        expect(420 / (20 * r.damageScale)).toBeCloseTo(7 * ENEMY_WIN_RATIO, 0);
    });
    test('mesures lointaines (autre niveau) ignorées', () => {
        const rec = { outcome: 'victory', playerLevel: 50, seconds: 240, cycles: 8, dealt: 400, takenRaw: 160 };
        expect(calibrateEnemy({ category: 'normal', heroMaxHp: 420, heroLevel: 10, records: [rec, rec, rec, rec] }).measured).toBe(false);
    });
});
