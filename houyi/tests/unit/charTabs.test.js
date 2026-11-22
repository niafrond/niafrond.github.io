import { describe, it, expect } from '@jest/globals';
import { charTabIds, getCharTab, setCharTab, charTabsHtml } from '../../charTabs.js';
import { grantClass, START_CLASS } from '../../classRoster.js';

const hero = () => ({ level: 5 });

describe('onglets par personnage', () => {
    it('Hou Yi seul : pas de bande d\'onglets', () => {
        const h = hero();
        expect(charTabIds(h)).toEqual([START_CLASS]);
        expect(charTabsHtml('spells', h)).toBe('');
    });

    it('un onglet par compagnon recruté, Hou Yi en premier', () => {
        const h = hero();
        grantClass(h, 'monk'); grantClass(h, 'shaman');
        expect(charTabIds(h)).toEqual([START_CLASS, 'monk', 'shaman']);
        const html = charTabsHtml('armes-test', h, 'Armes');
        expect(html.match(/<button/g)).toHaveLength(3);
        expect(html).toContain('data-char-tab="monk"');
        expect(html).toContain('aria-selected="true"');
    });

    it('le choix est gardé par menu et revient à Hou Yi si le personnage n\'est plus recruté', () => {
        const h = hero();
        grantClass(h, 'monk');
        setCharTab('menu-a', 'monk');
        expect(getCharTab('menu-a', h)).toBe('monk');
        expect(getCharTab('menu-b', h)).toBe(START_CLASS);
        expect(getCharTab('menu-a', hero())).toBe(START_CLASS);
    });
});
