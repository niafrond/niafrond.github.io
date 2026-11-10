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
        expect(s).toEqual({ count: 2, averageCycleSeconds: 30, effectiveDamagePerCycle: 40, averageSeconds: 150 });
    });
    test('stockage borné', () => {
        const mem = {}; const storage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
        for (let i = 0; i < COMBAT_STATS_KEEP + 5; i++) saveCombatRecord({ outcome: 'victory', cycles: 1, seconds: i }, storage);
        const list = loadCombatRecords(storage);
        expect(list).toHaveLength(COMBAT_STATS_KEEP);
        expect(list.at(-1).seconds).toBe(COMBAT_STATS_KEEP + 4);
    });
});
