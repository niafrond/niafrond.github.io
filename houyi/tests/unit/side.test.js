import { describe, test, expect } from '@jest/globals';
import { viewDir, viewSprite, SIDE_SPRITES } from '../../sprites/side.js';

describe('vues de côté / de dos des sprites', () => {
    test('direction de regard → vue', () => {
        expect(viewDir({ dx: 0, dy: 1 })).toBe('front');
        expect(viewDir({ dx: 0, dy: -1 })).toBe('back');
        expect(viewDir({ dx: 1, dy: 0 })).toBe('right');
        expect(viewDir({ dx: -1, dy: 0 })).toBe('left');
        expect(viewDir(null)).toBe('front');
    });

    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="25" r="12"/></svg>';

    test('de face : le dessin est inchangé ; hors navigateur la dérivation rend le dessin de face', () => {
        expect(viewSprite(svg, 'front')).toBe(svg);
        expect(viewSprite(svg, 'right')).toBe(svg);
        expect(viewSprite(null, 'left')).toBeNull();
    });

    test('un dessin de profil dédié prime ; vers la gauche = miroir', () => {
        const side = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="4" height="4"/></svg>';
        const front = svg.replace('r="12"', 'r="13"');
        SIDE_SPRITES.set(front, side);
        expect(viewSprite(front, 'right')).toBe(side);
        expect(viewSprite(front, 'left')).toContain('scale(-1 1)');
    });
});
