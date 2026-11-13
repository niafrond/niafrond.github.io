import { healEntity, ENVIRONMENT_STATUSES, environmentDamage, cureStatuses, clearEnvironmentStatuses, CURABLE_STATUSES, afflictionsOf } from '../../alterations.js';
import { activeStatuses, statusTooltipHtml } from '../../statusBadges.js';

describe('Noyade et Enflammé (malus du milieu)', () => {
    test('dégâts : 4 % des PV max, au moins 2', () => {
        expect(environmentDamage(100)).toBe(4);
        expect(environmentDamage(10)).toBe(2);
        expect(environmentDamage(0)).toBe(2);
    });
    test('le collier qui en préserve : mer pour la noyade, volcan pour les flammes', () => {
        expect(ENVIRONMENT_STATUSES.drowning.collar).toBe('sea');
        expect(ENVIRONMENT_STATUSES.ablaze.collar).toBe('volcano');
    });
    test('aucun remède ne les guérit', () => {
        const hero = { statusEffects: { drowning: 4, ablaze: 4, poisoned: 2 } };
        expect(CURABLE_STATUSES).not.toContain('drowning');
        expect(CURABLE_STATUSES).not.toContain('ablaze');
        expect(afflictionsOf(hero)).toEqual(['poisoned']);
        expect(cureStatuses(hero, 'all')).toEqual(['poisoned']);
        expect(hero.statusEffects).toMatchObject({ drowning: 4, ablaze: 4 });
        clearEnvironmentStatuses(hero);
        expect(hero.statusEffects.drowning).toBeUndefined();
    });
    test('pastilles : dégâts par tour, tout le combat, sans mention de remède', () => {
        const list = activeStatuses({ statusEffects: { drowning: 4, ablaze: 5 } });
        const drowning = list.find(s => s.id === 'drowning');
        expect(drowning).toMatchObject({ label: 'Noyade', kind: 'debuff', text: 'Perd 4 PV à chaque tour.' });
        expect(list.find(s => s.id === 'ablaze').label).toBe('Enflammé');
        const html = statusTooltipHtml(drowning);
        expect(html).toContain('tout le combat');
        expect(html).not.toMatch(/soign|gu[ée]ri|collier|remède/i);
    });
    test('ne bloquent pas les soins : les PV se récupèrent normalement', () => {
        const hero = { hp: 40, maxHp: 100, statusEffects: { drowning: 4, ablaze: 4 } };
        expect(healEntity(hero, 25)).toMatchObject({ healed: 25, harmed: 0 });
        expect(hero.hp).toBe(65);
    });
});
