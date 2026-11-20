// Les sorts du Moine, de l'Alchimiste et du Chamane reprennent l'effet d'un sort « donneur » (spells.js : deriveSpells) avec leur propre nom.
// Les fonctions d'effet doivent donc afficher `spell.name`, jamais le nom en dur du donneur (sinon « Robe de Fer » lance « Peau de Jade »).
import { describe, test, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

const catalog = JSON.parse(read('spells.json'));
const byId = Object.fromEntries(Object.values(catalog).filter(Array.isArray).flat().filter(s => s?.id).map(s => [s.id, s.name]));
const donorNames = [...read('spells.js').matchAll(/from: '(\w+)'/g)].map(m => byId[m[1]]).filter(Boolean);

describe('noms de sorts dans les effets', () => {
    test('il y a des sorts donneurs à vérifier', () => { expect(donorNames.length).toBeGreaterThan(15); });
    for (const file of ['classSpellsWarrior.js', 'classSpellsMage.js']) {
        test(`${file} : aucun nom de sort donneur en dur dans un titre d'animation ou le journal`, () => {
            const bad = read(file).split('\n').map((line, i) => ({ line, n: i + 1 }))
                .filter(({ line }) => /title:|log\(/.test(line) && !/^\s*\/\//.test(line))
                .filter(({ line }) => donorNames.some(name => line.toUpperCase().replace(/\(SPELL\.NAME \|\| "[^"]*"\)/g, '').includes(name.toUpperCase())));
            expect(bad.map(b => `${file}:${b.n} ${b.line.trim()}`)).toEqual([]);
        });
    }
});
