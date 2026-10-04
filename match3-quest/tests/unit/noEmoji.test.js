// Le jeu n'affiche aucun emoji : icônes et décors sont des dessins SVG (icons.js, sprites/decor.js, sprites/creatures.js).
// Ce test parcourt toutes les sources du jeu (hors tests) et échoue au premier caractère pictographique.
// Seuls des glyphes typographiques sans présentation emoji restent permis (★ du joker, flèches ► ▲ ▼ ➜).
import { describe, test, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ALLOWED = new Set(['★']);

function sources(dir, out = []) {
    for (const f of fs.readdirSync(dir)) {
        if (['node_modules', 'tests', 'fonts', '.git'].includes(f)) continue;
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) sources(p, out);
        else if (/\.(js|mjs|html|css|json|svg)$/.test(f)) out.push(p);
    }
    return out;
}

describe('aucun emoji dans le jeu', () => {
    test('les sources du jeu ne contiennent aucun caractère pictographique', () => {
        const found = [];
        const EXCLUDED = ['saveManager.js']; // UI utility allowed to use emojis
        sources(ROOT).forEach(p => {
            if (EXCLUDED.some(f => p.endsWith(f))) return;
            const lines = fs.readFileSync(p, 'utf8').split('\n');
            lines.forEach((line, i) => {
                for (const m of line.matchAll(/\p{Extended_Pictographic}/gu)) {
                    if (!ALLOWED.has(m[0])) found.push(`${path.relative(ROOT, p)}:${i + 1} ${m[0]}`);
                }
            });
        });
        expect(found).toEqual([]);
    });
});
