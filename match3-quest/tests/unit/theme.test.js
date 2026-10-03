import { readFileSync, existsSync, statSync } from 'fs';

const read = rel => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const exists = rel => existsSync(new URL(`../../${rel}`, import.meta.url));
const retro = read('retro.css');
const html = read('index.html');

describe('thème rétro (retro.css)', () => {
    test('la page charge retro.css après style.css et active le thème sur <body>', () => {
        const style = html.indexOf('href="style.css"');
        const theme = html.indexOf('href="retro.css"');
        expect(style).toBeGreaterThan(-1);
        expect(theme).toBeGreaterThan(style); // chargé après : ses règles l'emportent à spécificité égale
        expect(/<body class="[^"]*\brt\b[^"]*">/.test(html)).toBe(true);
    });

    test('toutes les règles sont portées par body.rt (le thème ne fuit pas sur d\'autres pages)', () => {
        const css = retro.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@font-face\s*\{[^}]*\}/g, '').replace(/@keyframes\s+[\w-]+\s*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '');
        const selectors = css.split('}').map(chunk => chunk.split('{')[0].trim()).filter(Boolean);
        selectors.flatMap(list => list.split(',').map(s => s.trim())).forEach(sel => {
            expect(sel.startsWith('body.rt')).toBe(true);
        });
    });

    test('les polices référencées existent, sont légères et ont leur licence OFL', () => {
        const urls = [...retro.matchAll(/url\('([^']+)'\)/g)].map(m => m[1]);
        expect(urls.length).toBeGreaterThanOrEqual(3);
        urls.forEach(u => {
            expect(exists(u)).toBe(true);
            expect(statSync(new URL(`../../${u}`, import.meta.url)).size).toBeLessThan(40 * 1024);
        });
        expect(exists('fonts/OFL-PixelifySans.txt')).toBe(true);
        expect(exists('fonts/OFL-PressStart2P.txt')).toBe(true);
        expect(read('fonts/OFL-PixelifySans.txt')).toMatch(/SIL OPEN FONT LICENSE/i);
    });

    test('le préchargement des polices pointe vers des fichiers existants', () => {
        [...html.matchAll(/rel="preload" href="([^"]+)"/g)].forEach(m => expect(exists(m[1])).toBe(true));
    });

    test('les chiffres sont servis par une police lisible (Pixelify rend 5 et 6 comme un S)', () => {
        expect(retro).toMatch(/font-family:\s*'Rt Digits'[\s\S]*?unicode-range:\s*U\+0030-0039/);
        expect(retro).toMatch(/--rt-font:\s*'Rt Digits',\s*'Pixelify Sans'/);
    });

    test('chaque variable --rt-* utilisée est définie dans le thème clair', () => {
        const defined = new Set([...retro.matchAll(/(--rt-[\w-]+)\s*:/g)].map(m => m[1]));
        const used = new Set([...retro.matchAll(/var\((--rt-[\w-]+)\)/g)].map(m => m[1]));
        used.forEach(v => expect(defined.has(v)).toBe(true));
    });

    test('le mode sombre ne redéfinit que des variables existantes', () => {
        const light = retro.match(/body\.rt\s*\{([^}]*--rt-ink[^}]*)\}/)[1];
        const dark = retro.match(/body\.rt\.dark-mode\s*\{([^}]*)\}/)[1];
        const lightVars = new Set([...light.matchAll(/(--rt-[\w-]+)\s*:/g)].map(m => m[1]));
        [...dark.matchAll(/(--rt-[\w-]+)\s*:/g)].forEach(m => expect(lightVars.has(m[1])).toBe(true));
    });

    test('accolades équilibrées', () => {
        let depth = 0;
        for (const c of retro) {
            if (c === '{') depth++;
            if (c === '}') depth--;
            expect(depth).toBeGreaterThanOrEqual(0);
        }
        expect(depth).toBe(0);
    });
});
