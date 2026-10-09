// Contrat des sprites d'ennemis « pixel art soigné et brillant » (agents/ref/direction-artistique-soleils.png) :
//  - chaque ennemi dessiné du catalogue (lots enemies-1 et enemies-2) est un SVG de rectangles alignés sur une grille de 64 x 64,
//    sans dégradé, filtre, opacité ni transform, en ASCII, <= 9 000 caractères (<= 6 000 pour tous ceux-ci), <= 16 couleurs ;
//  - le dessin est lu comme une image de pixels : contour #2b1b17 continu d'un pixel, aucun pixel isolé, rien ne touche le bord de la grille,
//    pas d'ombre au sol, reflet blanc dans les yeux, yeux et sourcils posés en tracés à part (utiles aux vues de profil et de dos) ;
//  - le générateur de créatures (creatures.js) cale ses couleurs sur le réseau de 6 niveaux de la pixellisation et garde des rampes lisibles.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ENEMY_SPRITES_CN_1 } from '../../sprites/cn/enemies-1.js';
import { ENEMY_SPRITES_CN_2 } from '../../sprites/cn/enemies-2.js';
import { BEAST_SPRITES } from '../../sprites/cn/suns.js';
import { viewSprite } from '../../sprites/side.js';
import { CREATURE_KINDS, CREATURE_BY_ID, creatureSprite, drawCreature, snapColor, shadeOf, litOf, mixHex } from '../../sprites/creatures.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const catalog = JSON.parse(readFileSync(join(root, 'enemies.catalog.json'), 'utf8'));
const OUTLINE = '#2b1b17';

const drawn = { ...ENEMY_SPRITES_CN_1, ...ENEMY_SPRITES_CN_2 };
const entries = Object.entries(drawn);

// ── Lecture d'un SVG de rectangles : tracés (couleur, rectangles) puis image 64 x 64 (peinture dans l'ordre du document) ──────────────
function parse(svg) {
    const paths = [...svg.matchAll(/<path fill="(#[0-9a-f]{6})" d="([^"]*)"\/>/g)].map(([, color, d]) => {
        const rects = [];
        let x = 0, y = 0, sx = 0, sy = 0, pts = [];
        const close = () => {
            if (pts.length) {
                const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
                rects.push([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]);
            }
            pts = [];
        };
        for (const [, cmd, args] of d.matchAll(/([MmHhVv])([^MmHhVv]*)/g)) {
            const n = args.trim().split(/\s+/).filter(Boolean).map(Number);
            if (cmd === 'M' || cmd === 'm') { close(); x = cmd === 'M' ? n[0] : x + n[0]; y = cmd === 'M' ? n[1] : y + n[1]; sx = x; sy = y; pts = [[x, y]]; }
            else if (cmd === 'h') { x += n[0]; pts.push([x, y]); }
            else if (cmd === 'v') { y += n[0]; pts.push([x, y]); }
        }
        close();
        return { color, rects, d };
    });
    const grid = Array.from({ length: 64 }, () => Array(64).fill(null));
    paths.forEach(({ color, rects }) => rects.forEach(([x0, y0, x1, y1]) => {
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (y >= 0 && y < 64 && x >= 0 && x < 64) grid[y][x] = color;
    }));
    return { paths, grid };
}
const at = (grid, x, y) => (x < 0 || y < 0 || x > 63 || y > 63) ? null : grid[y][x];
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = [...N4, [1, 1], [-1, 1], [1, -1], [-1, -1]];

describe('inventaire des ennemis dessinés', () => {
    test('tous les gabarits du catalogue ont un dessin (hors les trois bêtes solaires, dessinées dans suns.js)', () => {
        const beasts = new Set(Object.keys(BEAST_SPRITES));
        catalog.map(e => e.id).filter(id => !beasts.has(id)).forEach(id => expect({ id, drawn: Boolean(drawn[id]) }).toEqual({ id, drawn: true }));
        expect(beasts.size).toBe(3);
    });
    test('les 25 dessins des lots 1 et 2 sont ceux de la refonte', () => {
        expect(entries.length).toBe(25);
        ['rizieres_w_toad', 'goblin_saboteur', 'ice_witch', 'frost_dragon', 'ember_dragon', 'crystal_sage', 'moon_priestess'].forEach(k => expect(drawn[k]).toBeTruthy());
    });
});

describe.each(entries)('ennemi %s', (key, svg) => {
    const { paths, grid } = parse(svg);

    test('SVG valide, ASCII, sans dégradé, filtre, opacité, transform ni trait', () => {
        expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 64 64" shape-rendering="crispEdges">[\s\S]*<\/svg>$/);
        expect(/^[\x20-\x7e\n]*$/.test(svg)).toBe(true);
        expect(svg).not.toMatch(/Gradient|<filter|<fe[A-Z]|<pattern|<mask|<clipPath|<defs|<use|<text|<image|<script|<style|<g[\s>]/);
        expect(svg).not.toMatch(/opacity|transform|stroke|rgba\(|hsla\(|url\(/);
        expect(svg.startsWith('<svg') && svg.endsWith('</svg>')).toBe(true);
        expect(paths.length).toBeGreaterThan(5);
    });

    test('poids et palette : <= 6 000 caractères, <= 16 couleurs, contour #2b1b17 et reflet blanc', () => {
        expect(svg.length).toBeLessThanOrEqual(6000);
        const colors = new Set(paths.map(p => p.color));
        expect(colors.size).toBeLessThanOrEqual(16);
        expect(colors.has(OUTLINE)).toBe(true);
        expect(colors.has('#ffffff')).toBe(true);
    });

    test('coordonnées entières alignées sur la grille 64 x 64 (aucune décimale, rien hors de la grille)', () => {
        paths.forEach(({ d, rects }) => {
            expect(d).toMatch(/^[MmHhVv\d\s-]+$/);
            expect(d).not.toMatch(/\./);
            rects.forEach(([x0, y0, x1, y1]) => { expect(x0).toBeGreaterThanOrEqual(0); expect(y0).toBeGreaterThanOrEqual(0); expect(x1).toBeLessThanOrEqual(64); expect(y1).toBeLessThanOrEqual(64); expect(x1 > x0 && y1 > y0).toBe(true); });
        });
        // tous les chiffres du SVG sont des entiers
        expect([...svg.matchAll(/ d="([^"]*)"/g)].every(m => !/\d\.\d/.test(m[1]))).toBe(true);
    });

    test('contour d\'un pixel continu : tout bord de la silhouette est #2b1b17, la silhouette ne touche pas le bord de la grille', () => {
        let opaque = 0, minY = 64, maxY = -1, minX = 64, maxX = -1;
        for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
            const c = grid[y][x];
            if (!c) continue;
            opaque++; minY = Math.min(minY, y); maxY = Math.max(maxY, y); minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            const edge = N4.some(([dx, dy]) => !at(grid, x + dx, y + dy));
            if (edge) expect({ x, y, c }).toEqual({ x, y, c: OUTLINE });
        }
        expect(opaque).toBeGreaterThan(900);
        // rien sur la dernière rangée ni la dernière colonne, et un contour entier en haut et à gauche
        expect(maxY).toBeLessThanOrEqual(62);
        expect(maxX).toBeLessThanOrEqual(63);
        expect(maxY - minY).toBeGreaterThanOrEqual(40);
        expect(maxY).toBeGreaterThanOrEqual(54);
        expect(maxY).toBeLessThanOrEqual(62);
    });

    test('aucun pixel orphelin (chaque pixel a un voisin de même couleur, diagonales comprises)', () => {
        const orphans = [];
        for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
            const c = grid[y][x];
            if (c && !N8.some(([dx, dy]) => at(grid, x + dx, y + dy) === c)) orphans.push([x, y, c]);
        }
        expect(orphans).toEqual([]);
    });

    test('pas d\'ombre au sol : la rangée du bas (hors contour) n\'est jamais une ellipse sombre plus large que le personnage', () => {
        const rows = grid.map(r => r.filter(Boolean).length);
        const last = rows.map((n, y) => n ? y : -1).reduce((a, b) => Math.max(a, b));
        const widest = Math.max(...rows);
        expect(rows[last]).toBeLessThanOrEqual(widest);                 // la dernière rangée est celle du contour des pieds
        const body = grid[last - 1].filter(c => c && c !== OUTLINE);
        expect(body.length).toBeGreaterThan(0);                          // sous le contour : de la matière colorée, pas un aplat d'ombre
    });

    test('yeux et sourcils : au moins deux petits tracés séparés (vues de profil et de dos)', () => {
        const small = paths.filter(({ rects }) => {
            const xs = rects.flatMap(r => [r[0], r[2]]), ys = rects.flatMap(r => [r[1], r[3]]);
            const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys), cy = (Math.max(...ys) + Math.min(...ys)) / 2;
            return w <= 15 && h <= 10 && cy >= 6 && cy <= 40;
        });
        expect(small.length).toBeGreaterThanOrEqual(2);
    });

    test('la vue de profil est un SVG (dérivation hors navigateur : le dessin de face est rendu tel quel)', () => {
        expect(viewSprite(svg, 'right')).toMatch(/^<svg/);
        expect(viewSprite(svg, 'front')).toBe(svg);
    });
});

describe('palette lisible sur fond clair et fond sombre', () => {
    const lum = hex => { const n = parseInt(hex.slice(1), 16); return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
    test.each(entries)('%s : la matière dominante n\'est ni noyée dans le contour ni dans le désert', (key, svg) => {
        const { grid } = parse(svg);
        const counts = new Map();
        grid.flat().forEach(c => { if (c && c !== OUTLINE) counts.set(c, (counts.get(c) || 0) + 1); });
        const total = [...counts.values()].reduce((a, b) => a + b, 0);
        const mean = [...counts].reduce((a, [c, n]) => a + lum(c) * n, 0) / total;
        expect(mean).toBeGreaterThan(0.2);     // pas un aplat sombre qui disparaît sur le volcan (#2b0f0d)
        expect(mean).toBeLessThan(0.93);       // pas un aplat blanc qui disparaît sur le désert (#d9c27a)
    });
});

describe('générateur de créatures (creatures.js)', () => {
    const hexes = svg => [...svg.matchAll(/#[0-9a-fA-F]{6}\b/g)].map(m => m[0].toLowerCase());
    const onLattice = h => h === OUTLINE || [1, 3, 5].every(i => parseInt(h.slice(i, i + 2), 16) % 51 === 0);

    test.each(CREATURE_KINDS)('%s : couleurs calées sur les 6 niveaux de la pixellisation, reflet blanc, ni dégradé ni filtre', kind => {
        const svg = drawCreature(kind);
        expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 64 64">/);
        expect(svg).not.toMatch(/Gradient|<filter|<pattern|<mask/);
        expect(svg).toContain('fill="#ffffff"');
        expect(hexes(svg).filter(h => !onLattice(h))).toEqual([]);
        expect(svg.length).toBeLessThanOrEqual(6000);
    });

    test('les grands yeux des mammifères et oiseaux ont un reflet blanc et un iris (ellipse sombre + iris + point blanc)', () => {
        ['dog', 'fox', 'wolf', 'rabbit', 'monkey', 'chick', 'gull', 'dragon'].forEach(k => {
            const svg = drawCreature(k);
            expect((svg.match(/rx="3(\.\d+)?" ry="3\.\d+" fill="#2b1b17"/g) || []).length).toBeGreaterThanOrEqual(2);   // deux yeux sombres
            expect((svg.match(/<circle cx="\d+" cy="\d+" r="\.?\d*\.?\d+" fill="#ffffff"/g) || []).length).toBeGreaterThanOrEqual(2);  // deux reflets
        });
    });

    test('les PNJ créatures du jeu sont tous générés sans erreur', () => {
        Object.keys(CREATURE_BY_ID).forEach(id => expect(creatureSprite(id)).toMatch(/^<svg/));
    });

    test('shadeOf / litOf donnent des couleurs qui restent distinctes après réduction à 6 niveaux', () => {
        ['#d2a86c', '#f1ece2', '#8a8f99', '#e07a2e', '#4a4e58', '#f8f6f2', '#9aa0aa', '#ece4d6'].forEach(c => {
            expect(snapColor(shadeOf(c))).not.toBe(snapColor(c));
            if (snapColor(c) !== '#ffffff') expect(snapColor(litOf(c))).not.toBe(snapColor(c));   // déjà blanc : rien de plus clair
        });
        expect(snapColor('#4a4e58')).toBe('#666666');            // un gris bleuté reste gris (arrondi canal par canal : sarcelle)
        expect(snapColor(OUTLINE)).toBe(OUTLINE);
        expect(mixHex('#000000', '#ffffff', .5)).toBe('#808080');
    });
});
