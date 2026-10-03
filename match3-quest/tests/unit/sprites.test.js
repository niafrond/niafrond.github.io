import { readFileSync } from 'fs';
import { SCREENS } from '../../story.js';
import { playerClasses } from '../../classes.js';
import {
    HERO_SPRITES, NPC_SPRITES, CHEST_SPRITES, ENEMY_SPRITES, TILE_FILES, heroSprite, npcSprite, chestSprite, enemySprite, spriteUri
} from '../../sprites/index.js';

const catalog = JSON.parse(readFileSync(new URL('../../enemies.catalog.json', import.meta.url), 'utf8'));
const screens = Object.values(SCREENS);

const all = [
    ...Object.entries(HERO_SPRITES).map(([k, v]) => [`héros ${k}`, v]),
    ...Object.entries(NPC_SPRITES).map(([k, v]) => [`PNJ ${k}`, v]),
    ...Object.entries(CHEST_SPRITES).map(([k, v]) => [`coffre ${k}`, v]),
    ...Object.entries(ENEMY_SPRITES).map(([k, v]) => [`ennemi ${k}`, v])
];

// Analyse minimale : balises équilibrées (les balises auto-fermantes sont ignorées).
function checkWellFormed(svg) {
    const stack = [];
    const re = /<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g;
    let m;
    while ((m = re.exec(svg))) {
        const [, closing, name, , selfClosing] = m;
        if (selfClosing) continue;
        if (closing) {
            if (stack.pop() !== name) return `balise fermante inattendue </${name}>`;
        } else {
            stack.push(name);
        }
    }
    return stack.length ? `balises non fermées : ${stack.join(',')}` : null;
}

describe('couverture des sprites', () => {
    test('chaque classe de héros a son dessin', () => {
        Object.keys(playerClasses).forEach(id => expect(heroSprite(id)).toBeTruthy());
    });

    test('chaque PNJ de l\'histoire a son dessin', () => {
        screens.flatMap(s => s.npcs).forEach(n => expect(npcSprite(n.id)).toBeTruthy());
    });

    test('les deux états du coffre existent', () => {
        expect(chestSprite(false)).toBeTruthy();
        expect(chestSprite(true)).toBeTruthy();
        expect(chestSprite(false)).not.toBe(chestSprite(true));
    });

    test('chaque ennemi de la carte a un dessin (propre ou de son gabarit)', () => {
        screens.flatMap(s => s.enemies).forEach(e => expect(enemySprite(e.spriteKey || e.id, e.templateId)).toBeTruthy());
    });

    test('chaque gabarit du catalogue a un dessin', () => {
        catalog.forEach(t => expect(ENEMY_SPRITES[t.id]).toBeTruthy());
    });

    test('les neuf soleils, les quatre Fengmeng et les trois bêtes ont chacun leur dessin', () => {
        for (let n = 1; n <= 9; n++) expect(ENEMY_SPRITES[`sun_${n}`]).toBeTruthy();
        ['fengmeng_1', 'fengmeng_2', 'fengmeng_3a', 'fengmeng_3b'].forEach(k => expect(ENEMY_SPRITES[k]).toBeTruthy());
        ['fire_tiger', 'flame_boar', 'ember_wolf'].forEach(k => expect(ENEMY_SPRITES[k]).toBeTruthy());
    });

    test('les boss ont un dessin propre, distinct de celui de leur gabarit', () => {
        screens.flatMap(s => s.enemies).filter(e => e.boss && /^(sun_|fengmeng_|mirage)/.test(e.id)).forEach(e => {
            const key = e.spriteKey || e.id;
            expect(ENEMY_SPRITES[key]).toBeTruthy();
            if (key !== e.templateId && ENEMY_SPRITES[e.templateId]) {
                expect(ENEMY_SPRITES[key]).not.toBe(ENEMY_SPRITES[e.templateId]);
            }
        });
    });

    test('aucune clé de sprite inutile ou orpheline', () => {
        const wanted = new Set([
            ...catalog.map(t => t.id),
            ...screens.flatMap(s => s.enemies).flatMap(e => [e.id, e.spriteKey].filter(Boolean))
        ]);
        Object.keys(ENEMY_SPRITES).forEach(k => expect(wanted.has(k)).toBe(true));
    });

    test('aucun sprite de PNJ orphelin', () => {
        const ids = new Set(screens.flatMap(s => s.npcs).map(n => n.id));
        Object.keys(NPC_SPRITES).forEach(k => expect(ids.has(k)).toBe(true));
    });
});

describe('tuiles du plateau (gâteaux de lune)', () => {
    test.each(TILE_FILES)('%s : SVG autonome, bien formé et léger', file => {
        const svg = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8').trim();
        expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"')).toBe(true);
        expect(svg.endsWith('</svg>')).toBe(true);
        expect(svg.length).toBeLessThanOrEqual(5000);
        expect(checkWellFormed(svg)).toBeNull();
        expect(/[^\x20-\x7E\n\r\t]/.test(svg)).toBe(false);
        expect(/<(text|image|script|foreignObject|style|animate|set)\b/i.test(svg)).toBe(false);
        const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
        expect(new Set(ids).size).toBe(ids.length);
        [...svg.matchAll(/url\(#([^)]+)\)/g)].forEach(m => expect(ids).toContain(m[1]));
    });

    test('les huit tuiles du jeu ont un dessin et sont toutes différentes', () => {
        expect(TILE_FILES).toHaveLength(8);
        const contents = TILE_FILES.map(f => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8'));
        expect(new Set(contents).size).toBe(8);
    });

    test('retro.css associe chaque classe de tuile à son dessin', () => {
        const css = readFileSync(new URL('../../retro.css', import.meta.url), 'utf8');
        ['red', 'blue', 'green', 'yellow', 'purple', 'skull', 'combat', 'joker'].forEach(name => {
            expect(css).toContain(`sprites/tiles/tile-${name}.svg`);
        });
    });
});

describe('qualité technique des SVG', () => {
    test.each(all)('%s : SVG autonome et bien formé', (_name, svg) => {
        expect(typeof svg).toBe('string');
        expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"')).toBe(true);
        expect(svg.trim().endsWith('</svg>')).toBe(true);
        expect(svg.length).toBeLessThanOrEqual(9000);
        expect(svg.length).toBeGreaterThan(300); // pas un simple carré
        expect(checkWellFormed(svg)).toBeNull();
        // pas d'emoji ni de caractère non ASCII, pas de texte ni de ressource externe
        expect(/[^\x20-\x7E\n\r\t]/.test(svg)).toBe(false);
        expect(/<(text|image|script|foreignObject|style|animate|set)\b/i.test(svg)).toBe(false);
        expect(/(href|src)\s*=\s*["'](?!#)/i.test(svg)).toBe(false);
        expect(/https?:\/\//.test(svg.replace('http://www.w3.org/2000/svg', ''))).toBe(false);
    });

    test.each(all)('%s : identifiants définis, uniques et référencés existants', (_name, svg) => {
        const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
        expect(new Set(ids).size).toBe(ids.length);
        const refs = [...svg.matchAll(/url\(#([^)]+)\)/g)].map(m => m[1])
            .concat([...svg.matchAll(/href="#([^"]+)"/g)].map(m => m[1]));
        refs.forEach(r => expect(ids).toContain(r));
    });

    test('tous les dessins sont différents les uns des autres', () => {
        const svgs = all.map(([, svg]) => svg);
        expect(new Set(svgs).size).toBe(svgs.length);
    });

    test('spriteUri produit une data URI SVG décodable', () => {
        const svg = heroSprite('sorcerer');
        const uri = spriteUri(svg);
        expect(uri.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
        expect(decodeURIComponent(uri.split(',').slice(1).join(','))).toBe(svg);
        expect(spriteUri(null)).toBe('');
    });
});
