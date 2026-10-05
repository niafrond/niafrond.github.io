import { readFileSync } from 'node:fs';
import { BOSS_LOSS_THRESHOLD, recordBossLoss, recordVictory, isStreakTipDue, applicableTips, pickBossTip } from '../../bossTips.js';

describe('conseil anti try-hard (3 défaites d\'affilée contre le même boss)', () => {
    test('la série compte les défaites contre le même boss et repart à 1 pour un autre', () => {
        let s = null;
        s = recordBossLoss(s, 'sun_1'); expect(s).toEqual({ id: 'sun_1', count: 1 });
        s = recordBossLoss(s, 'sun_1'); expect(s.count).toBe(2);
        s = recordBossLoss(s, 'sun_2'); expect(s).toEqual({ id: 'sun_2', count: 1 });
        expect(recordBossLoss(s, null)).toEqual(s);
    });
    test('une victoire interrompt la série', () => {
        expect(recordVictory()).toBeNull();
        expect(isStreakTipDue(recordVictory())).toBe(false);
    });
    test('aucun conseil avant la 3e défaite, un conseil à partir de la 3e', () => {
        expect(BOSS_LOSS_THRESHOLD).toBe(3);
        expect(pickBossTip({ id: 'b', count: 2 }, {})).toBeNull();
        expect(pickBossTip(null, {})).toBeNull();
        expect(typeof pickBossTip({ id: 'b', count: 3 }, {})).toBe('string');
    });
    test('niveau trop bas : conseille des ennemis plus faibles pour monter de niveau', () => {
        const tip = pickBossTip({ id: 'b', count: 3 }, { playerLevel: 3, bossLevel: 7, gold: 0 });
        expect(tip).toMatch(/ennemis plus faibles/);
        expect(tip).toMatch(/niveau 7/);
    });
    test('de l\'or en poche : conseille d\'acheter aux marchands ; le conseil change à chaque défaite suivante', () => {
        const ctx = { playerLevel: 10, bossLevel: 9, gold: 500, unspentPoints: 0 };
        const tips = applicableTips(ctx);
        expect(tips.some(t => /marchands/.test(t) && /armes/.test(t))).toBe(true);
        const seen = new Set([3, 4, 5, 6, 7].map(count => pickBossTip({ id: 'b', count }, ctx)));
        expect(seen.size).toBeGreaterThanOrEqual(4);
        expect(pickBossTip({ id: 'b', count: 3 + tips.length }, ctx)).toBe(pickBossTip({ id: 'b', count: 3 }, ctx));   // cycle
    });
    test('points d\'attribut non dépensés : rappelés', () => {
        expect(applicableTips({ playerLevel: 5, bossLevel: 5, gold: 0, unspentPoints: 2 }).some(t => /attribut/.test(t))).toBe(true);
    });
});

describe('branchement dans game.js (lecture statique : le module dépend du DOM)', () => {
    const game = readFileSync(new URL('../../game.js', import.meta.url), 'utf8');
    const body = (name) => { const i = game.indexOf(`function ${name}(`); return game.slice(i, game.indexOf('\n}\n', i)); };
    test('défaite contre un boss : série mise à jour ; victoire : série effacée', () => {
        expect(body('handlePlayerDeath')).toMatch(/enemy\?\.isBoss[\s\S]*recordBossLoss\(/);
        expect(body('handleEnemyDefeated')).toContain('recordVictory()');
    });
    test('l\'écran de défaite affiche le conseil, seulement pour un boss perdu', () => {
        const screen = body('showCombatResultScreen');
        expect(screen).toContain('pickBossTip(');
        expect(screen).toMatch(/!isVictory && enemy\?\.isBoss/);
        expect(screen).toContain('battle-result-tip');
    });
    test('la série et les achats aux marchands sont restaurés au chargement de la sauvegarde', () => {
        const load = body('loadGameData');
        expect(load).toContain('bossLossStreak');
        expect(load).toContain('merchantSold');
    });
});
