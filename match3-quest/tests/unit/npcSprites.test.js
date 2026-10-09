// PNJ, Fengmeng et villageois générés en vrai pixel art (direction artistique « soigné et brillant », agents/animation-pixel-art.md) :
// SVG de rectangles entiers alignés sur la grille 64 x 64, 16 couleurs au plus, contour sombre d'un pixel continu, pas de pixel orphelin,
// pieds vers y = 58, traits du visage de Fengmeng en éléments séparés (pour les vues de profil et de dos de sprites/side.js).
import { SCREENS } from '../../story.js';
import { NPC_PACK } from '../../sprites/packs.js';
import { NPC_SPRITES_A } from '../../sprites/cn/actors-a.js';
import { NPC_SPRITES_B, FENGMENG_SPRITES } from '../../sprites/cn/actors-b.js';
import { villagerSprite, villagerLook } from '../../sprites/villagers.js';
import { creatureSprite } from '../../sprites/creatures.js';

const OUTLINE = '#2b1b17';
const DRAWN = { ...NPC_SPRITES_A, ...NPC_SPRITES_B };
const FENG = FENGMENG_SPRITES;

// ids des PNJ de l'histoire sans dessin à la main : villageois générés (les créatures sont dessinées par creatures.js)
const npcIds = [...new Set(Object.values(SCREENS).flatMap(s => s.npcs.map(n => n.id)))];
const VILLAGERS = Object.fromEntries(npcIds.filter(id => !NPC_PACK[id] && !creatureSprite(id)).map(id => [id, villagerSprite(id)]));

const colorsOf = svg => new Set([...svg.matchAll(/fill="(#[0-9a-fA-F]+)"/g)].map(m => m[1].toLowerCase()));

// Reconstitue la grille 64 x 64 à partir des rectangles « Mx yhwvhh-w » (ordre du peintre : le dernier rectangle gagne).
function grid(svg) {
    const g = Array.from({ length: 64 }, () => Array(64).fill(null));
    for (const m of svg.matchAll(/<path fill="(#[0-9a-fA-F]+)" d="([^"]*)"/g)) {
        for (const r of m[2].matchAll(/M(\d+) (\d+)h(\d+)v(\d+)h-(\d+)/g)) {
            const [x, y, w, h] = [r[1], r[2], r[3], r[4]].map(Number);
            expect(Number(r[5])).toBe(w);
            for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) g[j][i] = m[1].toLowerCase();
        }
    }
    return g;
}
const solid = (g, x, y) => x >= 0 && y >= 0 && x < 64 && y < 64 && g[y][x] !== null;

function checkPixelArt(svg, { strictFeet = true } = {}) {
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"')).toBe(true);
    expect(svg.trim().endsWith('</svg>')).toBe(true);
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(/[^\x20-\x7E]/.test(svg)).toBe(false);                                                       // ASCII seulement
    expect(svg).not.toMatch(/<(text|image|script|foreignObject|style|animate|set|filter|mask|pattern|(linear|radial)Gradient|defs|g)\b/i);
    expect(svg).not.toMatch(/opacity|transform|\bstroke|rgba|hsla|url\(|href/);                          // pas d'opacité, de trait ni de transformation
    expect(svg.length).toBeLessThanOrEqual(9000);
    expect(colorsOf(svg).size).toBeLessThanOrEqual(16);
    // coordonnées entières : seules les commandes M h v et des entiers positifs dans les tracés
    for (const m of svg.matchAll(/ d="([^"]*)"/g)) expect(m[1]).toMatch(/^(?:M\d+ \d+h\d+v\d+h-\d+)+$/);
    const g = grid(svg);
    let minY = 64, maxY = -1, n = 0;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        if (!solid(g, x, y)) continue;
        n++; minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => solid(g, x + dx, y + dy)).length;
        expect({ x, y, orphelin: nb === 0 }).toEqual({ x, y, orphelin: false });                            // aucun pixel isolé
        const edge = nb < 4;
        if (edge) expect({ x, y, couleur: g[y][x] }).toEqual({ x, y, couleur: OUTLINE });                   // la silhouette est bordée d'un contour continu
    }
    expect(n).toBeGreaterThan(500);
    if (strictFeet) expect(maxY).toBeGreaterThanOrEqual(56);                                              // pieds vers y = 58
    expect(maxY).toBeLessThanOrEqual(61);
    expect(colorsOf(svg).has(OUTLINE)).toBe(true);
    return g;
}

describe('PNJ dessinés à la main : pixel art', () => {
    test('26 PNJ, tous déclarés dans leur paquet', () => {
        expect(Object.keys(DRAWN)).toHaveLength(26);
        Object.keys(DRAWN).forEach(id => expect(NPC_PACK[id]).toBeTruthy());
        expect(Object.keys(DRAWN)).toEqual(expect.arrayContaining(['parley_sun2', 'parley_sun3', 'parley_sun5', 'parley_sun6', 'parley_sun8', 'parley_sun9', 'change', 'change_moon', 'sun_ten']));
    });
    test.each(Object.entries(DRAWN))('%s : rectangles entiers, 16 couleurs au plus, contour continu, sans pixel orphelin', (id, svg) => {
        checkPixelArt(svg);
        expect(svg.length).toBeLessThanOrEqual(6000);
    });
    test('tous différents', () => {
        expect(new Set(Object.values(DRAWN)).size).toBe(26);
    });
    test('Chang\'e garde le même visage (grands yeux à reflet blanc) à la maison et à la Lune', () => {
        [DRAWN.change, DRAWN.change_moon].forEach(svg => expect(colorsOf(svg).has('#fff')).toBe(true));
    });
});

describe('Fengmeng : quatre rencontres lisibles sur fond clair comme sur fond sombre', () => {
    test('4 dessins différents', () => {
        expect(Object.keys(FENG).sort()).toEqual(['fengmeng_1', 'fengmeng_2', 'fengmeng_3a', 'fengmeng_3b']);
        expect(new Set(Object.values(FENG)).size).toBe(4);
    });
    test.each(Object.entries(FENG))('%s : pixel art net', (id, svg) => {
        checkPixelArt(svg);
        expect(svg.length).toBeLessThanOrEqual(6000);
    });
    test.each(Object.entries(FENG))('%s : yeux, sourcils et bouche en éléments séparés et petits (vues de profil et de dos)', (id, svg) => {
        const small = [...svg.matchAll(/<path fill="[^"]*" d="([^"]*)"/g)].map(m => {
            const xs = [], ys = [];
            for (const r of m[1].matchAll(/M(\d+) (\d+)h(\d+)v(\d+)/g)) { xs.push(+r[1], +r[1] + +r[3]); ys.push(+r[2], +r[2] + +r[4]); }
            return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), cy: (Math.max(...ys) + Math.min(...ys)) / 2 };
        }).filter(b => b.w <= 15 && b.h <= 10 && b.cy >= 6 && b.cy <= 40);
        expect(small.length).toBeGreaterThanOrEqual(6);
    });
    test('les yeux de Fengmeng brillent (cyan puis rouge) : reflet blanc et iris colorés', () => {
        expect(colorsOf(FENG.fengmeng_2).has('#6ff')).toBe(true);
        expect(colorsOf(FENG.fengmeng_3b).has('#f66')).toBe(true);
        Object.values(FENG).forEach(svg => expect(colorsOf(svg).has('#fff')).toBe(true));
    });
});

describe('villageois générés : famille cohérente', () => {
    const entries = Object.entries(VILLAGERS);
    test('plus de 100 villageois, tous différents pour des ids différents', () => {
        expect(entries.length).toBeGreaterThan(100);
        expect(new Set(entries.map(([, svg]) => svg)).size).toBe(entries.length);
    });
    test('déterministes', () => {
        entries.slice(0, 20).forEach(([id, svg]) => expect(villagerSprite(id)).toBe(svg));
    });
    test.each(entries)('%s : pixel art net, 16 couleurs au plus, au plus 6 000 caractères', (id, svg) => {
        checkPixelArt(svg);
        expect(svg.length).toBeLessThanOrEqual(6000);
    });
    test('âge, sexe et habit viennent de l\'identifiant', () => {
        expect(villagerLook('grandma_x')).toMatchObject({ age: 'old', female: true, hair: ['#fff', '#ccc', '#999'] });
        expect(villagerLook('kid_x').age).toBe('child');
        expect(villagerLook('monk_x')).toMatchObject({ style: 'bald' });
        expect(villagerLook('nun_ying').style).toBe('bald');
        expect(villagerLook('lady_lan').female).toBe(true);
        expect(villagerLook('porter_san').female).toBe(false);
    });
    test('un enfant et un adulte ont des silhouettes différentes (l\'enfant a la tête plus basse)', () => {
        const top = svg => { const g = grid(svg); for (let y = 0; y < 64; y++) if (g[y].some(Boolean)) return y; return 64; };
        expect(top(villagerSprite('kid_x'))).toBeGreaterThan(top(villagerSprite('porter_san')) - 1);
    });
    test('les créatures restent dessinées par creatures.js', () => {
        expect(villagerSprite('buffalo_dahei')).toBe(creatureSprite('buffalo_dahei'));
    });
});
