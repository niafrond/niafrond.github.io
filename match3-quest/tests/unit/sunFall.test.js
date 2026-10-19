/** @jest-environment jsdom */
// Chute des soleils : la légende et le tableau suivent le soleil abattu (son rang), pas le nombre de soleils déjà vaincus.
import { describe, test, expect } from '@jest/globals';
import { playSunFallAnimation, SUN_RANK, SUN_FALL_CAPTIONS } from '../../cinematics.js';

// Contexte 2D factice : jsdom n'a pas de canvas.
const noopCtx = new Proxy({}, {
    get: (t, k) => (k === 'canvas' ? {} : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}),
    set: () => true
});

describe('rang des soleils', () => {
    test('neuf soleils, neuf rangs distincts de 1 à 9, une légende chacun', () => {
        expect(Object.keys(SUN_RANK)).toHaveLength(9);
        expect(Object.values(SUN_RANK).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        expect(SUN_FALL_CAPTIONS).toHaveLength(9);
    });

    test('ordre des régions : rizières, volcan, gobi, fleuve, bambous, tonnerre, fauves, mer, fusang', () => {
        const byRank = Object.entries(SUN_RANK).sort((a, b) => a[1] - b[1]).map(([id]) => id);
        expect(byRank).toEqual(['sun_1', 'sun_6', 'sun_4', 'sun_2', 'sun_3', 'sun_5', 'sun_7', 'sun_8', 'sun_9']);
    });
});

describe('playSunFallAnimation', () => {
    test('la légende est celle du soleil abattu, même si le compteur de soleils vaincus diffère', async () => {
        window.matchMedia = () => ({ matches: false });
        HTMLCanvasElement.prototype.getContext = () => noopCtx;
        // soleil des marées (sun_8, rang 8) abattu alors que `count` n'indique qu'un soleil tombé
        const p = playSunFallAnimation({ id: 'sun_8', count: 1, name: 'Soleil des Marées' });
        await new Promise(r => setTimeout(r, 20));
        const overlay = document.querySelector('.cine-sunfall');
        expect(overlay).not.toBeNull();
        expect(overlay.querySelector('.cine-sunfall-line').textContent).toBe(SUN_FALL_CAPTIONS[7]);
        expect(overlay.querySelector('.cine-sunfall-title').textContent).toBe('Soleil des Marées est tombé');
        overlay.dispatchEvent(new Event('pointerdown'));
        await p;
        expect(document.querySelector('.cine-sunfall')).toBeNull();
    });

    test('sans identifiant : le nombre de soleils tombés fait foi (compatibilité)', async () => {
        window.matchMedia = () => ({ matches: false });
        HTMLCanvasElement.prototype.getContext = () => noopCtx;
        const p = playSunFallAnimation({ count: 3 });
        await new Promise(r => setTimeout(r, 20));
        const overlay = document.querySelector('.cine-sunfall');
        expect(overlay.querySelector('.cine-sunfall-line').textContent).toBe(SUN_FALL_CAPTIONS[2]);
        overlay.dispatchEvent(new Event('pointerdown'));
        await p;
    });
});
