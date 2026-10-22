import './fixtures/playerForge.js';
import { describe, test, expect } from '@jest/globals';
import { SCREENS } from '../../story.js';
import { connectionRows } from '../../mapConnections.js';

describe('Désert de Gobi : vrai soleil et mur de sable', () => {
    const gobi = SCREENS.gobi;
    const sun = gobi.enemies.find(e => e.id === 'sun_4');

    test('dix mirages, tous différents du vrai soleil', () => {
        const mirages = gobi.enemies.filter(e => e.illusion);
        expect(mirages).toHaveLength(10);
        expect(new Set(mirages.map(m => `${m.x},${m.y}`)).size).toBe(10);
        mirages.forEach(m => expect([m.x, m.y]).not.toEqual([sun.x, sun.y]));
    });

    test('le vrai soleil se tient en bas à droite, loin du passage est', () => {
        expect(sun.x).toBeGreaterThan(gobi.w * 0.6);
        expect(sun.y).toBeGreaterThan(gobi.h * 0.6);
        expect(sun.guardsDoor).toBeUndefined();
    });

    test('le passage est est muré de sable tant que le soleil vit', () => {
        const rows = connectionRows(SCREENS, gobi).filter(r => r.edge === 'east');
        expect(rows.length).toBeGreaterThan(0);
        rows.forEach(r => expect([r.requires, r.wall]).toEqual(['sun_4', 'sand']));
    });
});
