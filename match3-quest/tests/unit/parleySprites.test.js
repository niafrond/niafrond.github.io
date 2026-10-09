import { NPC_PACK } from '../../sprites/packs.js';
import { npcSprite, NPC_SPRITES, loadAllSprites } from '../../sprites/index.js';
import { villagerSprite } from '../../sprites/villagers.js';

// Les six PNJ de pourparlers (chemin relationnel vers les soleils) ont chacun un dessin à la main,
// à la place du villageois générique qui les représentait.
const PARLEY = ['parley_sun2', 'parley_sun3', 'parley_sun5', 'parley_sun6', 'parley_sun8', 'parley_sun9'];

await loadAllSprites();

describe('sprites des PNJ de pourparlers', () => {
    test.each(PARLEY)('%s : déclaré dans un paquet et dessiné à la main', id => {
        expect(NPC_PACK[id]).toBeTruthy();
        expect(NPC_SPRITES[id]).toBeTruthy();
        expect(npcSprite(id)).toBe(NPC_SPRITES[id]);
    });

    test.each(PARLEY)('%s : SVG valide, ASCII, sans texte ni script, léger', id => {
        const svg = NPC_SPRITES[id];
        expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"')).toBe(true);
        expect(svg.trim().endsWith('</svg>')).toBe(true);
        expect(svg.length).toBeLessThanOrEqual(9000);
        expect(/[^\x20-\x7E\n\r\t]/.test(svg)).toBe(false);
        expect(/<(text|image|script|foreignObject|style|animate|set)\b/i.test(svg)).toBe(false);
        const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
        ids.forEach(i => expect(i.startsWith(`${id}-`)).toBe(true));
        [...svg.matchAll(/url\(#([^)]+)\)/g)].forEach(m => expect(ids).toContain(m[1]));
    });

    test.each(PARLEY)('%s : différent du villageois généré', id => {
        expect(NPC_SPRITES[id]).not.toBe(villagerSprite(id));
    });

    test('les six dessins sont tous différents', () => {
        expect(new Set(PARLEY.map(id => NPC_SPRITES[id])).size).toBe(PARLEY.length);
    });
});
