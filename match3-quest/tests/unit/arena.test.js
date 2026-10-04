import { readFileSync } from 'fs';
import {
    ARENA_MIN_LEVEL, ARENA_TIERS, ARENA_TEMPLATES, arenaTier, isArenaUnlocked, isTierUnlocked, normalizeArenaStats,
    arenaWaveLevel, isChampionWave, arenaEncounter, applyArenaScaling, arenaRewardBonus, recordArenaWave
} from '../../arena.js';

const catalog = JSON.parse(readFileSync(new URL('../../enemies.catalog.json', import.meta.url), 'utf8'));
const increasing = list => list.every((v, i) => i === 0 || v > list[i - 1]);
const nonDecreasing = list => list.every((v, i) => i === 0 || v >= list[i - 1]);

describe('Arène des Mille Flèches : huit cercles', () => {
    test('ouverte à partir du niveau 15', () => {
        expect(ARENA_MIN_LEVEL).toBe(15);
        expect(isArenaUnlocked(14)).toBe(false);
        expect(isArenaUnlocked(15)).toBe(true);
    });

    test('au moins 8 cercles, de plus en plus difficiles et rémunérateurs', () => {
        expect(ARENA_TIERS.length).toBeGreaterThanOrEqual(8);
        expect(ARENA_TIERS.map(t => t.id)).toEqual(ARENA_TIERS.map((_, i) => i + 1));
        expect(increasing(ARENA_TIERS.map(t => t.levelOffset))).toBe(true);
        expect(nonDecreasing(ARENA_TIERS.map(t => t.statMult))).toBe(true);
        expect(nonDecreasing(ARENA_TIERS.map(t => t.waves))).toBe(true);
        expect(increasing(ARENA_TIERS.map(t => t.rewardMult))).toBe(true);
        expect(increasing(ARENA_TIERS.map(t => t.clearGold))).toBe(true);
        // le champion du dernier cercle est plus fort que celui du premier, à niveau de héros égal
        const last = ARENA_TIERS[ARENA_TIERS.length - 1];
        expect(arenaWaveLevel(last.id, last.waves, 20)).toBeGreaterThan(arenaWaveLevel(1, ARENA_TIERS[0].waves, 20));
        // les cercles hauts ajoutent les règles de duel (tirs rapides, pièges, miroir)
        expect(last.championDuel).toMatchObject({ mirror: true });
        ARENA_TIERS.slice(5).forEach(t => expect(t.duel).toBeTruthy());
    });

    test('déblocage : cercle 1 ouvert, chaque cercle suivant après avoir terminé le précédent', () => {
        expect(isTierUnlocked(undefined, 1)).toBe(true);
        expect(isTierUnlocked(undefined, 2)).toBe(false);
        expect(isTierUnlocked({ cleared: [1] }, 2)).toBe(true);
        expect(isTierUnlocked({ cleared: [1] }, 3)).toBe(false);
        expect(isTierUnlocked({ cleared: [1, 2, 3, 4, 5, 6, 7] }, 8)).toBe(true);
        expect(isTierUnlocked({ cleared: [1, 2, 3, 4, 5, 6] }, 8)).toBe(false);
        expect(isTierUnlocked({ cleared: [1] }, 99)).toBe(false);
    });

    test('vagues : niveau croissant, dernière vague = champion avec ses règles de duel', () => {
        ARENA_TIERS.forEach(t => {
            const levels = Array.from({ length: t.waves }, (_, i) => arenaWaveLevel(t.id, i + 1, 18));
            expect(nonDecreasing(levels)).toBe(true);
            expect(levels[0]).toBe(18 + t.levelOffset);
            const first = arenaEncounter(t.id, 1, 18, () => 0);
            const champ = arenaEncounter(t.id, t.waves, 18, () => 0.5);
            expect(first).toMatchObject({ enemyId: null, boss: null, arena: { tier: t.id, wave: 1, waves: t.waves, statMult: t.statMult } });
            expect(first.duel).toEqual(t.duel ? t.duel : null);
            expect(champ.boss).toEqual({ name: champ.name, level: champ.level });
            expect(champ.name).toContain(t.name);
            expect(champ.duel).toEqual(t.championDuel || t.duel || null);
            expect(isChampionWave(t.id, t.waves)).toBe(true);
            expect(isChampionWave(t.id, t.waves - 1)).toBe(false);
        });
        const ids = new Set(catalog.map(t => t.id));
        ARENA_TEMPLATES.forEach(id => expect(ids.has(id)).toBe(true));
        [0, 0.9999].forEach(r => expect(ids.has(arenaEncounter(4, 2, 18, () => r).templateId)).toBe(true));
    });

    test('renfort des adversaires des cercles hauts', () => {
        const e = applyArenaScaling({ hp: 3, maxHp: 100, attack: 20, defense: 10 }, 1.5);
        expect(e).toEqual({ hp: 150, maxHp: 150, attack: 30, defense: 15 });
        expect(applyArenaScaling({ hp: 5, maxHp: 100, attack: 20, defense: 10 }, 1)).toEqual({ hp: 5, maxHp: 100, attack: 20, defense: 10 });
    });

    test('prime : croissante avec la vague et le cercle, doublée pour le champion', () => {
        expect(arenaRewardBonus(1, 2, 16).gold).toBeGreaterThan(arenaRewardBonus(1, 1, 16).gold);
        expect(arenaRewardBonus(5, 1, 16).xp).toBeGreaterThan(arenaRewardBonus(1, 1, 16).xp);
        const t = arenaTier(3);
        expect(arenaRewardBonus(3, t.waves, 16).gold).toBeGreaterThan(2 * arenaRewardBonus(3, t.waves - 1, 16).gold);
    });

    test('record : cercle terminé (premier passage signalé une seule fois), ancien format accepté', () => {
        let r = recordArenaWave(undefined, 1, 2, true);
        expect(r.firstClear).toBe(false);
        expect(r.stats).toEqual({ cleared: [], best: { 1: 2 }, wins: 1, runs: 0 });
        r = recordArenaWave(r.stats, 1, arenaTier(1).waves, true);
        expect(r.firstClear).toBe(true);
        expect(r.stats.cleared).toEqual([1]);
        expect(isTierUnlocked(r.stats, 2)).toBe(true);
        r = recordArenaWave(r.stats, 1, arenaTier(1).waves, true);
        expect(r.firstClear).toBe(false);
        expect(recordArenaWave(r.stats, 2, 1, false).stats.wins).toBe(r.stats.wins);
        expect(normalizeArenaStats({ best: 7, wins: 3, runs: 2 })).toEqual({ cleared: [], best: { 1: arenaTier(1).waves }, wins: 3, runs: 2 });
    });
});
