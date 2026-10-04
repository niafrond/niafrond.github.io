// Garde-fous de performance (statiques, sans navigateur) : voir aussi tests/e2e/perf-mobile.spec.js.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (f) => readFileSync(join(root, f), 'utf8');
const css = read('style.css');

/** Corps d'un bloc délimité par des accolades à partir de l'index de l'accolade ouvrante. */
function block(src, open) {
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}' && --depth === 0) return src.slice(open + 1, i);
    }
    return '';
}
function keyframeProps(name) {
    const m = new RegExp(`@keyframes\\s+${name}\\s*\\{`).exec(css);
    if (!m) throw new Error(`@keyframes ${name} introuvable`);
    const body = block(css, m.index + m[0].length - 1);
    return new Set([...body.matchAll(/([a-z-]+)\s*:/g)].map((x) => x[1]));
}

describe('animations du coup suggéré (tuile du plateau)', () => {
    const names = ['softGlow', 'blink', 'glowOrange', 'glowYellow'];
    test.each(names)('%s : uniquement transform / opacity (composées par le GPU)', (name) => {
        const props = keyframeProps(name);
        for (const bad of ['box-shadow', 'filter', 'background-position', 'width', 'height', 'top', 'left']) {
            expect(props.has(bad)).toBe(false);
        }
    });

    test('la règle .tile.suggested ne référence que des animations connues et sans flou', () => {
        const rule = /\.tile\.suggested\s*\{([^}]*)\}/.exec(css)[1];
        const used = /animation:\s*([^;]+);/.exec(rule)[1].split(',').map((a) => a.trim().split(/\s+/)[0]);
        for (const n of used) {
            const props = keyframeProps(n);
            expect(props.has('box-shadow')).toBe(false);
            expect(props.has('filter')).toBe(false);
        }
    });
});

describe('carte d\'exploration : coût de rendu', () => {
    const view = read('explorationView.js');

    test('le flou d\'ombre (shadowBlur) n\'est appliqué que dans le calque de sol en cache ou son repli', () => {
        const uses = [...view.matchAll(/\.shadowBlur\s*=/g)];
        expect(uses.length).toBeLessThanOrEqual(2);   // calque de sol + repli direct
        expect(view).toMatch(/getGroundLayer\(/);
    });

    test('le sol statique n\'est pas repeint cellule par cellule dans draw()', () => {
        const draw = view.slice(view.indexOf('function draw(now)'));
        const head = draw.slice(0, draw.indexOf('// contour des zones de vigilance'));
        // dans draw(), seules les parties animées (reflets, aura) passent par cell(); le sol passe par le calque
        expect(head).toMatch(/drawImage\(ground\.canvas/);
        expect(head).not.toMatch(/biome\.path/);
    });
});

describe('audio : appareils modestes', () => {
    const sound = read('sound.js');
    test('tampon audio élargi sur appareil modeste et notes SFX plafonnées', () => {
        expect(sound).toMatch(/latencyHint:\s*0\.15/);
        expect(sound).toMatch(/hardwareConcurrency/);
        expect(sound).toMatch(/MAX_ACTIVE_TONES/);
        expect(sound).toMatch(/osc\.onended/);
    });
});
