import { readFileSync } from 'node:fs';
import { addXP } from '../../experience.js';

const read = f => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');

// game.js dépend du DOM et n'est importé par aucun test : on vérifie le branchement par lecture du code.
describe('niveau gagné hors combat (quêtes, exploration)', () => {
    const game = read('game.js');
    const main = read('main.js');
    const body = name => { const i = game.indexOf(`function ${name}(`); return game.slice(i, game.indexOf('\n}\n', i)); };

    test('un niveau gagné par une quête donne les mêmes récompenses qu\'en combat (points d\'attribut, PV)', () => {
        expect(body('grantExplorationXP')).toContain('applyLevelUpRewards(');
        expect(body('applyCombatXPAtEnd')).toContain('applyLevelUpRewards(');
        const rewards = body('applyLevelUpRewards');
        expect(rewards).toContain('unspentLevelPoints');
        expect(rewards).toContain('maxHp');
    });

    test('la quête qui fait monter de niveau affiche la notification ET l\'écran de choix d\'attribut', () => {
        const onXp = main.slice(main.indexOf('onXp:'), main.indexOf('onSave:'));
        expect(onXp).toContain('grantExplorationXP(');
        expect(onXp).toContain('exploration.toast(');
        expect(onXp).toContain('showAttributeMenu()');
        expect(main).not.toMatch(/addXP\(player/);
    });

    test('addXP renvoie bien le niveau atteint et le nombre de niveaux', () => {
        const p = { level: 1, xp: 0, xpToNextLevel: 10 };
        const res = addXP(p, 1e9);
        expect(res.leveledUp).toBe(true);
        expect(res.levelsGained).toBeGreaterThan(0);
        expect(res.newLevel).toBe(p.level);
    });
});
