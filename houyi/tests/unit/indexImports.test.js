// Garde-fou : un import nommé inexistant dans un <script type="module"> d'index.html fait échouer tout le module
// (ex. bouton « Abandonner » sans écouteur) sans aucune erreur visible pour le joueur.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');

describe('imports des scripts module d\'index.html', () => {
    const imports = [...html.matchAll(/import\s*\{([^}]+)\}\s*from\s*'\.\/([\w./-]+)'/g)];

    test('au moins un import détecté', () => expect(imports.length).toBeGreaterThan(0));

    test.each(imports.map(m => [m[2], m[1]]))('%s exporte tout ce qui est importé', (file, names) => {
        const src = readFileSync(join(root, file), 'utf8');
        names.split(',').map(n => n.trim().split(/\s+as\s+/)[0]).filter(Boolean).forEach(name => {
            const exported = new RegExp(`export\\s+(?:async\\s+)?(?:function\\*?|const|let|var|class)\\s+${name}\\b`).test(src)
                || new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`).test(src);
            expect({ file, name, exported }).toEqual({ file, name, exported: true });
        });
    });
});
