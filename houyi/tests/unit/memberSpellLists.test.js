// Chaque personnage a ses propres boutons de sort : les commandes de compétences communes (Salve double, Tonnerre lointain…) sont à Hou Yi seul.
// gameSpellList.js dépend du DOM : garde-fou de structure.
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';

const src = readFileSync(new URL('../../gameSpellList.js', import.meta.url), 'utf8');

describe('liste de sorts par personnage', () => {
    test('les compétences d\'action sans classe ne vont qu\'à Hou Yi, celles d\'une classe qu\'à cette classe', () => {
        expect(src).toMatch(/actionSpells\(player\)\.filter\(sp => sp\.class \? sp\.class === cls : cls === START_CLASS\)/);
        expect(src).not.toMatch(/actionSpells\(player\)\.filter\(sp => !sp\.class \|\| sp\.class === cls\)/);
    });
});
