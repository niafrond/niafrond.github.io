import { BIOME_TINTS, tintSvg, tintHex, dominantHue, isTintable, rgbToHsl } from '../../sprites/biomeTint.js';
import { SPRITE_PACKS, loadAllSprites, enemySprite, ENEMY_SPRITES } from '../../sprites/index.js';
import { SCREENS } from '../../story.js';

const hexes = svg => svg.match(/#[0-9a-fA-F]{6}\b/g) || [];
const hueOf = hex => { const n = parseInt(hex.slice(1), 16); return rgbToHsl((n >> 16) & 255, (n >> 8) & 255, n & 255); };
// part (0..1) de couleurs saturées dont la teinte est bleue (190-260°)
const blueShare = svg => {
    const col = hexes(svg).map(hueOf).filter(([, s, l]) => s >= 0.14 && l >= 0.16 && l <= 0.94);
    return col.length ? col.filter(([h]) => h >= 190 && h <= 260).length / col.length : 0;
};

beforeAll(async () => { await loadAllSprites(); });

describe('palettes par biome', () => {
    test('chaque biome a une palette valide', () => {
        Object.entries(BIOME_TINTS).forEach(([, t]) => {
            expect(t.hue).toBeGreaterThanOrEqual(0); expect(t.hue).toBeLessThan(360);
            expect(t.spread).toBeGreaterThan(0); expect(t.spread).toBeLessThanOrEqual(1);
        });
        ['riverbed', 'gobi', 'volcano', 'bamboo', 'cave', 'moon'].forEach(b => expect(BIOME_TINTS[b]).toBeTruthy());
    });
    test('les neutres et contours ne changent pas, un bleu devient brun en marais', () => {
        expect(tintHex('#2b1b17', 'riverbed')).toBe('#2b1b17');
        expect(tintHex('#ffffff', 'gobi')).toBe('#ffffff');
        expect(tintHex('#808080', 'volcano')).toBe('#808080');
        const [h] = hueOf(tintHex('#2f7fd0', 'riverbed'));
        expect(h).toBeGreaterThanOrEqual(15); expect(h).toBeLessThanOrEqual(80);
    });
    test('désert, volcan, forêt : teintes attendues', () => {
        const hue = (hex, b) => hueOf(tintHex(hex, b))[0];
        expect(hue('#3a6fd0', 'gobi')).toBeLessThan(80);
        const v = hue('#3a6fd0', 'volcano'); expect(v < 60 || v > 330).toBe(true);
        const f = hue('#c04040', 'bamboo'); expect(f).toBeGreaterThan(90); expect(f).toBeLessThan(180);
    });
});

describe('enemySprite avec biome', () => {
    const base = () => enemySprite('deep_sea_serpent', 'deep_sea_serpent');
    test('rétrocompatible : sans biome, ou biome sans teinte, dessin d\'origine', () => {
        expect(base()).toBe(ENEMY_SPRITES.deep_sea_serpent);
        expect(enemySprite('deep_sea_serpent', 'deep_sea_serpent', undefined)).toBe(base());
        expect(enemySprite('deep_sea_serpent', 'deep_sea_serpent', 'house')).toBe(base());
        expect(enemySprite('deep_sea_serpent', 'deep_sea_serpent', 'inconnu')).toBe(base());
        expect(enemySprite('zzz', 'zzz', 'riverbed')).toBeNull();
    });
    test('le serpent de vase (lit du fleuve) n\'est plus bleu', () => {
        const mud = enemySprite('fleuve_w_serpent', 'deep_sea_serpent', 'riverbed');
        expect(mud).not.toBe(base());
        expect(blueShare(base())).toBeGreaterThan(0.3);
        expect(blueShare(mud)).toBeLessThan(0.1);
        const d = dominantHue(mud);
        expect(d).toBeGreaterThanOrEqual(0); expect(d).toBeLessThanOrEqual(60);   // tranche de 30° : 0-60° = rouge/orange/jaune
        expect(mud).toMatch(/^<svg/);
    });
    test('cache par (dessin, biome) : même chaîne, et biomes différents', () => {
        expect(enemySprite('x', 'deep_sea_serpent', 'riverbed')).toBe(enemySprite('y', 'deep_sea_serpent', 'riverbed'));
        expect(enemySprite('x', 'deep_sea_serpent', 'gobi')).not.toBe(enemySprite('x', 'deep_sea_serpent', 'riverbed'));
    });
    test('soleils-boss et élémentaires gardent leur dessin', () => {
        expect(isTintable('sun_3')).toBe(false);
        expect(enemySprite('sun_3', null, 'riverbed')).toBe(ENEMY_SPRITES.sun_3);
        expect(enemySprite('x', 'frost_dragon', 'volcano')).toBe(ENEMY_SPRITES.frost_dragon);
    });
    test('tous les ennemis du jeu se teintent dans leur biome en un SVG valide de même structure', () => {
        Object.values(SCREENS).forEach(sc => sc.enemies.forEach(e => {
            const plain = enemySprite(e.spriteKey || e.id, e.templateId);
            const tinted = enemySprite(e.spriteKey || e.id, e.templateId, sc.biome);
            expect(Boolean(tinted)).toBe(Boolean(plain));
            if (plain) expect(tinted.replace(/#[0-9a-f]{3,6}\b/gi, '#')).toBe(plain.replace(/#[0-9a-f]{3,6}\b/gi, '#'));
        }));
    });
});
