import { readFileSync } from 'fs';
import { SCREENS } from '../../story.js';
import { playerClasses } from '../../classes.js';
import {
    HERO_SPRITES, NPC_SPRITES, CHEST_SPRITES, ENEMY_SPRITES, heroSprite, npcSprite, chestSprite, enemySprite, spriteUri
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
        screens.flatMap(s => s.enemies).forEach(e => expect(enemySprite(e.id, e.templateId)).toBeTruthy());
    });

    test('chaque gabarit du catalogue a un dessin', () => {
        catalog.forEach(t => expect(ENEMY_SPRITES[t.id]).toBeTruthy());
    });

    test('les boss et ennemis nommés ont un dessin distinct de leur gabarit', () => {
        screens.flatMap(s => s.enemies).filter(e => e.boss || ['old_tusk', 'warden_vrok', 'sand_skorr'].includes(e.id))
            .forEach(e => {
                const own = ENEMY_SPRITES[e.id];
                expect(own).toBeTruthy();
                if (e.id !== e.templateId) expect(own).not.toBe(ENEMY_SPRITES[e.templateId]);
            });
    });

    test('aucune clé de sprite inutile ou orpheline', () => {
        const wanted = new Set([
            ...catalog.map(t => t.id),
            ...screens.flatMap(s => s.enemies).map(e => e.id)
        ]);
        Object.keys(ENEMY_SPRITES).forEach(k => expect(wanted.has(k)).toBe(true));
    });
});

describe('qualité technique des SVG', () => {
    test.each(all)('%s : SVG autonome et bien formé', (_name, svg) => {
        expect(typeof svg).toBe('string');
        expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"')).toBe(true);
        expect(svg.trim().endsWith('</svg>')).toBe(true);
        expect(svg.length).toBeLessThanOrEqual(14000); // boss détaillés : ~12 Ko max, sans impact perceptible au chargement
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
