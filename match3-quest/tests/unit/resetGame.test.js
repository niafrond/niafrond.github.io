import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';

// index.html / main.js dépendent du DOM : vérification statique.
const read = f => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');

describe('réinitialiser le jeu et choix du personnage', () => {
    it('le menu Options propose « Réinitialiser » relié à clearSaveData (avec confirmation)', () => {
        expect(read('index.html')).toMatch(/id="game-reset-btn"/);
        expect(read('main.js')).toMatch(/game-reset-btn'\)\?\.addEventListener\('click', \(\) => clearSaveData\(\)\)/);
        expect(read('game.js')).toMatch(/export function clearSaveData\(\) \{\s*if \(confirm\(/);
    });
    it('plus de bouton « Sans classe » au choix du personnage', () => {
        expect(read('main.js')).not.toMatch(/skip-class|Sans classe/);
        expect(read('main.js')).toMatch(/id="confirm-class"/);
    });
});
