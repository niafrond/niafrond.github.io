import { readFileSync } from 'fs';
import { ARENA_MIN_LEVEL, ARENA_TEMPLATES, ARENA_BOSS_EVERY, isArenaUnlocked, arenaWaveLevel, isChampionWave, arenaEncounter, arenaRewardBonus, recordArenaWave } from '../../arena.js';

const catalog = JSON.parse(readFileSync(new URL('../../enemies.catalog.json', import.meta.url), 'utf8'));

describe('Arène des Mille Flèches', () => {
    test('ouverte à partir du niveau 15', () => {
        expect(ARENA_MIN_LEVEL).toBe(15);
        expect(isArenaUnlocked(14)).toBe(false);
        expect(isArenaUnlocked(15)).toBe(true);
        expect(isArenaUnlocked(undefined)).toBe(false);
    });

    test('les vagues sont de plus en plus dures', () => {
        expect(arenaWaveLevel(1, 15)).toBe(14);
        const levels = Array.from({ length: 20 }, (_, i) => arenaWaveLevel(i + 1, 15));
        expect([...levels].sort((a, b) => a - b)).toEqual(levels);
        expect(levels[19]).toBeGreaterThan(levels[0] + 5);
        expect(isChampionWave(ARENA_BOSS_EVERY)).toBe(true);
        expect(isChampionWave(ARENA_BOSS_EVERY + 1)).toBe(false);
    });

    test('rencontre d\'une vague : gabarit connu, champion (boss) toutes les 5 vagues, sans ennemi de carte', () => {
        const ids = new Set(catalog.map(t => t.id));
        ARENA_TEMPLATES.forEach(id => expect(ids.has(id)).toBe(true));
        [0, 0.5, 0.9999].forEach(r => expect(ids.has(arenaEncounter(3, 15, () => r).templateId)).toBe(true));
        const w1 = arenaEncounter(1, 15, () => 0);
        expect(w1).toMatchObject({ enemyId: null, level: 14, boss: null, arena: { wave: 1 } });
        const w5 = arenaEncounter(5, 15, () => 0);
        expect(w5.boss).toEqual({ name: w5.name, level: w5.level });
        expect(w5.name).toMatch(/Champion/);
        expect(arenaEncounter(50, 15, () => 0.3).boss.name).toMatch(/Champion/);   // au-delà des titres connus
    });

    test('prime croissante avec la vague, doublée pour un champion', () => {
        const b1 = arenaRewardBonus(1, 14), b4 = arenaRewardBonus(4, 16), b5 = arenaRewardBonus(5, 16);
        expect(b4.gold).toBeGreaterThan(b1.gold);
        expect(b4.xp).toBeGreaterThan(b1.xp);
        expect(b5.gold).toBeGreaterThan(2 * b4.gold);
        expect(b1.gold).toBeGreaterThan(0);
    });

    test('record : plus haute vague gagnée, victoires', () => {
        let st = recordArenaWave(undefined, 0, false);
        expect(st).toEqual({ best: 0, wins: 0, runs: 0 });
        st = recordArenaWave(st, 3, true);
        st = recordArenaWave(st, 4, false);
        expect(st).toEqual({ best: 3, wins: 1, runs: 0 });
        expect(recordArenaWave({ best: 7, wins: 9, runs: 2 }, 2, true)).toEqual({ best: 7, wins: 10, runs: 2 });
    });
});
