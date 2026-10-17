// Garde-fou : chaque module du jeu doit au moins se compiler (import dupliqué, identifiant redéclaré…).
// Les tests unitaires n'importent pas game.js / board.js : une erreur de syntaxe passait inaperçue et le jeu ne se lançait plus.
import { readdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { describe, test } from '@jest/globals';

const root = new URL('../../', import.meta.url).pathname;
const files = readdirSync(root).filter(f => f.endsWith('.js'));

describe('syntaxe des modules', () => {
    test.each(files)('%s se compile', file => {
        execFileSync(process.execPath, ['--check', root + file], { stdio: 'pipe' });
    });
});
