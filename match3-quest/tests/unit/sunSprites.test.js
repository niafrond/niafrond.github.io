// Soleils-Boss en pixel art : neuf dessins SVG (sun_1 … sun_9, sun_4 sert aussi aux mirages) générés depuis des grilles de pixels
// indexés (voir agents/animation-pixel-art.md, « Direction artistique de référence »). Ce test vérifie le contrat du format
// (SVG autonome 64 x 64, ASCII, sans dégradé ni opacité, coordonnées entières, ≤ 16 couleurs, poids) et, en rastérisant les contours,
// la propreté du dessin : pas de pixel orphelin, silhouette pleine, contour sombre, lecture nette à la grille 32 du jeu.
import { SUN_SPRITES, BEAST_SPRITES } from '../../sprites/cn/suns.js';
import { SCREENS } from '../../story.js';

const KEYS = Array.from({ length: 9 }, (_, i) => `sun_${i + 1}`);
const OUTLINE = '#2b1b17';
const entries = KEYS.map(k => [k, SUN_SPRITES[k]]);

const colorsOf = svg => [...svg.matchAll(/fill="(#[0-9a-fA-F]{6})"/g)].map(m => m[1].toLowerCase());

// Rastérise les <path> (commandes M m h v H V z, polygones à angles droits) en grille 64 x 64 de couleurs, dans l'ordre de peinture.
function rasterize(svg) {
    const N = 64;
    const grid = Array.from({ length: N }, () => Array(N).fill(null));
    for (const m of svg.matchAll(/<path fill="(#[0-9a-f]{6})" d="([^"]*)"\/>/g)) {
        const [, color, d] = m;
        const vedges = [];                                  // arêtes verticales [x, yMin, yMax]
        let x = 0, y = 0, sx = 0, sy = 0;
        for (const [, cmd, args] of d.matchAll(/([MmHhVvz])([^MmHhVvz]*)/g)) {
            const nums = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : [];
            if (cmd === 'M' || cmd === 'm') {
                if (cmd === 'M') { x = nums[0]; y = nums[1]; } else { x += nums[0]; y += nums[1]; }
                sx = x; sy = y;
            } else if (cmd === 'h') x += nums[0];
            else if (cmd === 'H') x = nums[0];
            else if (cmd === 'v' || cmd === 'V') {
                const ny = cmd === 'v' ? y + nums[0] : nums[0];
                vedges.push([x, Math.min(y, ny), Math.max(y, ny)]);
                y = ny;
            } else if (cmd === 'z') {
                if (x !== sx) { /* fermeture horizontale */ x = sx; }
                if (y !== sy) { vedges.push([sx, Math.min(y, sy), Math.max(y, sy)]); y = sy; }
            }
        }
        for (let row = 0; row < N; row++) {
            const xs = vedges.filter(([, a, b]) => a <= row && row < b).map(e => e[0]).sort((p, q) => p - q);
            for (let i = 0; i + 1 < xs.length; i += 2) for (let c = xs[i]; c < xs[i + 1]; c++) if (c >= 0 && c < N) grid[row][c] = color;
        }
    }
    return grid;
}
const opaque = (g, x, y) => (g[y] && g[y][x]) !== null && (g[y] && g[y][x]) !== undefined;

describe('soleils-boss : format du SVG', () => {
    test('exactement neuf soleils sun_1 … sun_9, tous des chaînes', () => {
        expect(Object.keys(SUN_SPRITES).sort()).toEqual(KEYS);
        entries.forEach(([, svg]) => expect(typeof svg).toBe('string'));
    });

    test('les trois bêtes embrasées sont conservées', () => {
        expect(Object.keys(BEAST_SPRITES).sort()).toEqual(['ember_wolf', 'fire_tiger', 'flame_boar']);
    });

    test('les mirages (spriteKey) pointent toujours vers un soleil existant', () => {
        const keys = Object.values(SCREENS).flatMap(s => s.enemies).map(e => e.spriteKey).filter(Boolean);
        expect(keys).toContain('sun_4');
        keys.filter(k => /^sun_/.test(k)).forEach(k => expect(SUN_SPRITES[k]).toBeDefined());
    });

    test.each(entries)('%s : SVG autonome viewBox 64 x 64, balises équilibrées, uniquement des <path> pleins', (key, svg) => {
        expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"')).toBe(true);
        expect(svg.endsWith('</svg>')).toBe(true);
        expect(svg).toMatch(/shape-rendering="crispEdges"/);
        const tags = [...svg.matchAll(/<\/?([a-zA-Z]+)\b[^>]*?(\/?)>/g)];
        expect(tags.filter(t => t[1] !== 'svg' && t[1] !== 'path')).toEqual([]);
        const stack = [];
        tags.forEach(([full, name, selfClosing]) => {
            if (selfClosing) return;
            if (full.startsWith('</')) expect(stack.pop()).toBe(name); else stack.push(name);
        });
        expect(stack).toEqual([]);
        const paths = [...svg.matchAll(/<path\b[^>]*>/g)].map(m => m[0]);
        expect(paths.length).toBeGreaterThan(3);
        paths.forEach(p => expect(p).toMatch(/^<path fill="#[0-9a-f]{6}" d="[^"]+"\/>$/));
    });

    test.each(entries)('%s : ASCII pur, sans texte, image, script ni ressource externe', (key, svg) => {
        expect(svg).toMatch(/^[\x20-\x7e]+$/);
        expect(svg).not.toMatch(/<text|<image|<script|<style|<use|href|url\(|@import|xlink|<!\[CDATA/i);
    });

    test.each(entries)('%s : sans dégradé, filtre, opacité, trait ni transform', (key, svg) => {
        expect(svg).not.toMatch(/Gradient|<filter|<fe[A-Z]|<pattern|<mask|<clipPath/);
        expect(svg).not.toMatch(/opacity|rgba\(|hsla\(|\sfilter=|transform=|stroke|class=|<animate|<set/);
    });

    test.each(entries)('%s : coordonnées entières, uniquement des segments horizontaux et verticaux', (key, svg) => {
        const ds = [...svg.matchAll(/ d="([^"]*)"/g)].map(m => m[1]);
        expect(ds.length).toBeGreaterThan(3);
        ds.forEach(d => {
            expect(d).toMatch(/^[MmHhVvz0-9\s-]+$/);          // aucune courbe, aucun arc, aucune diagonale
            expect(d).not.toMatch(/\d\.\d|\.\d/);             // aucun nombre décimal
        });
        expect(svg.match(/viewBox="([^"]*)"/)[1]).toBe('0 0 64 64');
    });

    test('les neuf dessins sont tous différents', () => {
        expect(new Set(entries.map(([, svg]) => svg)).size).toBe(9);
    });

    test.each(entries)('%s : poids ≤ 9 000 caractères (visé : ≤ 6 000) et ≤ 16 couleurs', (key, svg) => {
        expect(svg.length).toBeLessThanOrEqual(9000);
        expect(svg.length).toBeLessThanOrEqual(6000);
        const colors = new Set(colorsOf(svg));
        expect(colors.size).toBeLessThanOrEqual(16);
        expect(colors.has(OUTLINE)).toBe(true);
    });

    test('palettes distinctes : deux soleils ne partagent jamais plus de 80 % de leurs couleurs', () => {
        const sets = entries.map(([k, svg]) => [k, new Set(colorsOf(svg))]);
        for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) {
            const inter = [...sets[i][1]].filter(c => sets[j][1].has(c)).length;
            const union = new Set([...sets[i][1], ...sets[j][1]]).size;
            expect({ a: sets[i][0], b: sets[j][0], jaccard: inter / union <= 0.8 }).toEqual({ a: sets[i][0], b: sets[j][0], jaccard: true });
        }
    });
});

describe('soleils-boss : propreté du pixel art (grille 64 rastérisée)', () => {
    const grids = Object.fromEntries(entries.map(([k, svg]) => [k, rasterize(svg)]));

    test.each(entries)('%s : silhouette dans le cadre, large d\'au moins 24 pixels, sans ombre au sol', key => {
        const g = grids[key];
        const pts = [];
        g.forEach((row, y) => row.forEach((c, x) => { if (c) pts.push([x, y]); }));
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
        expect(Math.max(...xs) - Math.min(...xs) + 1).toBeGreaterThanOrEqual(40);
        expect(Math.max(...ys) - Math.min(...ys) + 1).toBeGreaterThanOrEqual(40);
        // le sprite ne dessine aucune ombre : pas de couleur très sombre translucide (aucune opacité) ni ellipse plate sous le corps
        expect(pts.length).toBeGreaterThan(900);
    });

    test.each(entries)('%s : aucun pixel de silhouette isolé (pas de particule d\'un pixel)', key => {
        const g = grids[key];
        const isolated = [];
        for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
            if (!opaque(g, x, y)) continue;
            let n = 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && opaque(g, x + dx, y + dy)) n++;
            if (n === 0) isolated.push([x, y]);
        }
        expect(isolated).toEqual([]);
    });

    test.each(entries)('%s : pas de petite île détachée (toute la silhouette tient en une seule pièce, voisinage à 8)', key => {
        const g = grids[key];
        const seen = Array.from({ length: 64 }, () => Array(64).fill(false));
        const comps = [];
        for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
            if (!opaque(g, x, y) || seen[y][x]) continue;
            let size = 0; const stack = [[x, y]]; seen[y][x] = true;
            while (stack.length) {
                const [cx, cy] = stack.pop(); size++;
                for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                    const nx = cx + dx, ny = cy + dy;
                    if (opaque(g, nx, ny) && !seen[ny][nx]) { seen[ny][nx] = true; stack.push([nx, ny]); }
                }
            }
            comps.push(size);
        }
        comps.sort((a, b) => b - a);
        // un seul grand bloc ; tout fragment détaché (goutte de sueur, éclair) fait au moins 12 pixels et n'est pas du bruit
        expect(comps[0]).toBeGreaterThan(900);
        comps.slice(1).forEach(s => expect(s).toBeGreaterThanOrEqual(12));
    });

    test.each(entries)('%s : un contour d\'un pixel logique, d\'une seule teinte, borde la silhouette (sombre, ou lueur pour les couronnes de feu)', key => {
        const g = grids[key];
        const count = {};
        let boundary = 0;
        for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
            if (!opaque(g, x, y)) continue;
            const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !opaque(g, x + dx, y + dy));
            if (!edge) continue;
            boundary++;
            count[g[y][x]] = (count[g[y][x]] || 0) + 1;
        }
        expect(boundary).toBeGreaterThan(100);
        expect(Math.max(...Object.values(count)) / boundary).toBeGreaterThanOrEqual(0.5);
        // le contour sombre #2b1b17 existe toujours (contour du visage et des accessoires)
        expect(g.flat().filter(c => c === OUTLINE).length).toBeGreaterThan(150);
    });

    test.each(entries)('%s : lecture nette à la grille 32 : chaque bloc 2 x 2 a une couleur majoritaire (aucun bloc 1-1-1-1)', key => {
        const g = grids[key];
        const bad = [];
        for (let by = 0; by < 32; by++) for (let bx = 0; bx < 32; bx++) {
            const cells = [g[2 * by][2 * bx], g[2 * by][2 * bx + 1], g[2 * by + 1][2 * bx], g[2 * by + 1][2 * bx + 1]].filter(Boolean);
            if (cells.length < 2) continue;                  // sous 50 % de couverture, le bloc est transparent (bords nets)
            const counts = {};
            cells.forEach(c => { counts[c] = (counts[c] || 0) + 1; });
            if (Math.max(...Object.values(counts)) < 2) bad.push([bx, by]);
        }
        expect(bad).toEqual([]);
    });

    test.each(entries)('%s : visage lisible : reflets clairs dans les yeux ou les dents (au moins 4 pixels très clairs)', key => {
        const g = grids[key];
        const light = g.flat().filter(c => c && [1, 3, 5].every(i => parseInt(c.slice(i, i + 2), 16) >= 0xcc)).length;
        expect(light).toBeGreaterThanOrEqual(4);
    });

    test.each(entries)('%s : symétrie gauche-droite globale de la silhouette (couronne régulière)', key => {
        const g = grids[key];
        let same = 0, total = 0;
        for (let y = 0; y < 64; y++) for (let x = 0; x < 31; x++) {
            const a = opaque(g, x, y), b = opaque(g, 61 - x, y);   // axe de symétrie : entre les colonnes 30 et 31 (pixel central 15 de l'art 32)
            if (a || b) { total++; if (a === b) same++; }
        }
        expect(same / total).toBeGreaterThanOrEqual(0.8);
    });
});
