import { readFileSync } from 'fs';
import { ICON_NAMES, iconGrid, iconSvg, iconUri, iconForEmoji, stripEmoji, splitEmoji, hasEmoji, EMOJI_ICON } from '../../pixelIcons.js';
import { ARENA_BIOMES } from '../../arena.js';
import { buildWorldMapSvg } from '../../worldMapView.js';
import { worldZones } from '../../worldMap.js';

const src = f => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
const PICTO = /\p{Extended_Pictographic}/u;

describe('icônes pixel art (aucun emoji à l\'écran)', () => {
    test('chaque icône est une grille 12 x 12 aux couleurs de la palette', () => {
        expect(ICON_NAMES.length).toBeGreaterThanOrEqual(90);
        ICON_NAMES.forEach(name => {
            const g = iconGrid(name);
            expect(g.rows).toHaveLength(12);
            g.rows.forEach(row => {
                expect(row).toHaveLength(12);
                [...row].forEach(ch => expect(ch === '.' || Boolean(g.pal[ch])).toBe(true));
            });
            const svg = iconSvg(name);
            expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 12 12"/);
            expect(svg).toContain('crispEdges');
            expect(PICTO.test(svg)).toBe(false);
            expect(iconUri(name)).toMatch(/^data:image\/svg\+xml/);
        });
        expect(new Set(ICON_NAMES.map(iconSvg)).size).toBe(ICON_NAMES.length);   // toutes différentes
    });

    test('les emojis courants du jeu ont leur icône', () => {
        const expected = { '💰': 'coin', '⭐': 'star', '❤️': 'heart', '💀': 'skull', '🏹': 'arrow', '⚔️': 'swords', '🛡️': 'shield',
            '🔒': 'lock', '🎁': 'gift', '📜': 'scroll', '🗺️': 'map', '🎒': 'bag', '🏆': 'trophy', '🚪': 'door', '🏟️': 'arena',
            '🎯': 'target', '✅': 'check', '❌': 'cross', '⚠️': 'warning', '🔴': 'orb_red', '🔵': 'orb_blue', '🟢': 'orb_green',
            '🟡': 'orb', '🟣': 'orb_purple', '☯️': 'yinyang', '🪓': 'axe', '🌀': 'swirl', '🔥': 'fire', '🌕': 'moon' };
        Object.entries(expected).forEach(([emoji, icon]) => expect(iconForEmoji(emoji)).toBe(icon));
        Object.values(EMOJI_ICON).forEach(icon => expect(ICON_NAMES).toContain(icon));
    });

    test('stripEmoji / splitEmoji : les pictogrammes disparaissent ou deviennent des icônes, la typographie reste', () => {
        expect(stripEmoji('🏆 Cercle terminé ! 🔓 Porte → ouverte ✦')).toBe('Cercle terminé ! Porte → ouverte ✦');
        expect(hasEmoji('Vague ▶ suivante')).toBe(false);
        expect(hasEmoji('💰 +5')).toBe(true);
        expect(splitEmoji('💰 +12 or, 🦄 bonus')).toEqual([{ icon: 'coin' }, { text: ' +12 or, ' }, { text: 'bonus' }]);
        expect(splitEmoji('Sans emoji')).toEqual([{ text: 'Sans emoji' }]);
    });

    test('les décors des cartes sont des icônes, pas des emojis', () => {
        Object.values(ARENA_BIOMES).forEach(b => b.decor.forEach(d => expect(ICON_NAMES).toContain(d)));
        const view = src('explorationView.js');
        const biomes = view.slice(view.indexOf('const BIOMES = {'), view.indexOf('...ARENA_BIOMES'));
        expect(PICTO.test(biomes)).toBe(false);
        expect(view).not.toMatch(/drawEmoji|Color Emoji/);
    });

    test('la carte du monde n\'affiche aucun emoji', () => {
        const svg = buildWorldMapSvg(worldZones, { visitedIds: ['rizieres'], currentId: 'rizieres', level: 3 });
        expect(PICTO.test(svg.replace(/data:image\/svg\+xml[^"]*/g, ''))).toBe(false);
    });

    test('le filtre d\'affichage est installé au démarrage du jeu', () => {
        expect(src('main.js')).toMatch(/installPixelText\(\);/);
        expect(src('style.css')).toMatch(/\.px-icon\s*\{[^}]*image-rendering: pixelated/);
    });
});
