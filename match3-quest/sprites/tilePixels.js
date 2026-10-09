// Tuiles du plateau en vrai pixel art. Les dessins (sprites/tiles/*.svg) restent vectoriels ; ils sont pixellisés ici à la taille
// EXACTE de la case : un « pixel » du dessin fait un nombre ENTIER de pixels CSS (`px`, 2 au minimum), la grille compte donc
// `floor(case / px)` pixels et l'image est affichée à `grille × px` (centrée dans la case), sans lissage (image-rendering: pixelated
// dans retro.css). Résultat : zoom entier à toutes les tailles de plateau, jamais de pixels de largeur inégale.
// Le PNG pixellisé est posé en variables CSS sur <html> (`--tile-red`…, `--tile-bg-size`) ; retro.css retombe sur le SVG vectoriel
// tant qu'elles ne sont pas prêtes (hors ligne, file://, première image).
import { preparePixelSprite, spriteUri, releasePixelSprite } from './index.js';

export const TILE_NAMES = ['red', 'blue', 'green', 'yellow', 'purple', 'skull', 'combat', 'joker'];
const TARGET_GRID = 26;          // nombre de pixels visés sur la largeur d'une tuile (plus fin = plus de détail, moins « pixel art »)

// Géométrie du pixel pour une case de `tilePx` pixels CSS.
export function tileGeometry(tilePx) {
    const t = Math.max(8, Math.floor(tilePx) || 0);
    const px = Math.max(2, Math.round(t / TARGET_GRID));
    const grid = Math.max(8, Math.floor(t / px));
    return { px, grid, size: grid * px };
}

const sources = new Map();       // nom → texte du SVG
let current = { grid: 0, svgs: [] };
let token = 0;

async function loadSource(name) {
    if (sources.has(name)) return sources.get(name);
    const v = typeof window !== 'undefined' && window.__match3Build ? `?v=${window.__match3Build}` : '';
    const res = await fetch(`sprites/tiles/tile-${name}.svg${v}`);
    if (!res.ok) throw new Error(`tuile introuvable : ${name}`);
    const text = await res.text();
    sources.set(name, text);
    return text;
}

// Pixellise les huit tuiles pour une case de `tilePx` px et pose les variables CSS. Sans effet (le SVG vectoriel reste) si le navigateur
// ne sait pas charger ou convertir les dessins. Renvoie la géométrie appliquée, ou null.
export async function applyTilePixels(tilePx) {
    if (typeof document === 'undefined' || typeof fetch !== 'function') return null;
    const geo = tileGeometry(tilePx);
    if (geo.grid === current.grid) { document.documentElement.style.setProperty('--tile-bg-size', `${geo.size}px ${geo.size}px`); return geo; }
    const mine = ++token;
    try {
        const svgs = await Promise.all(TILE_NAMES.map(loadSource));
        await Promise.all(svgs.map(svg => preparePixelSprite(svg, geo.grid)));
        if (mine !== token) return null;                       // une taille plus récente a été demandée entre-temps
        const uris = svgs.map(svg => spriteUri(svg, geo.grid));
        if (uris.some(u => !u.startsWith('data:image/png'))) return null;   // conversion impossible : on garde le SVG vectoriel
        const root = document.documentElement.style;
        TILE_NAMES.forEach((name, i) => root.setProperty(`--tile-${name}`, `url("${uris[i]}")`));
        root.setProperty('--tile-bg-size', `${geo.size}px ${geo.size}px`);
        current.svgs.forEach(svg => releasePixelSprite(svg, current.grid));
        current = { grid: geo.grid, svgs };
        return geo;
    } catch (e) {
        return null;
    }
}
