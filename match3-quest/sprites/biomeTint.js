// Teinte des ennemis selon le biome où ils rôdent. Les dessins d'ennemis sont des SVG écrits à la main, un par gabarit : un « Serpent
// de vase » (gabarit deep_sea_serpent, bleu) dans le lit boueux du fleuve détonne. `tintSvg(svg, biome)` recolore donc les couleurs
// saturées du dessin vers la gamme du biome (marais/vase → bruns, désert → ocres, glace → bleus pâles, volcan → rouges…) en gardant
// contours, blancs, noirs et gris, ainsi que les variations de teinte (compressées autour de la teinte cible).

// hue : teinte cible (0-360) ; spread : part de l'écart de teinte d'origine conservée (0 = teinte unique) ;
// bias : décale la coupure du tour de teinte (évite qu'un bleu bascule vers le magenta plutôt que vers le jaune) ; sat / light : multiplicateurs ; addL : décalage de luminosité (-1..1).
export const BIOME_TINTS = {
    paddy:    { hue: 100, spread: 0.30, sat: 0.95, light: 1.00, addL: 0 },       // rizières : verts
    riverbed: { hue: 30,  bias: 40, spread: 0.20, sat: 0.60, light: 0.88, addL: -0.02 },    // vase, marais : bruns boueux
    bamboo:   { hue: 140, spread: 0.30, sat: 0.65, light: 0.92, addL: 0 },       // forêt de bambous : verts
    gobi:     { hue: 38,  spread: 0.20, sat: 0.80, light: 1.05, addL: 0.03 },     // désert : sable, ocre
    storm:    { hue: 265, spread: 0.30, sat: 0.60, light: 0.95, addL: 0 },       // orage : gris-violet
    volcano:  { hue: 8,   bias: 40, spread: 0.12, sat: 0.90, light: 0.88, addL: -0.03 },    // volcan : rouges sombres
    savanna:  { hue: 45,  spread: 0.25, sat: 0.80, light: 1.00, addL: 0 },       // savane : ocre doré
    coast:    { hue: 195, spread: 0.30, sat: 0.80, light: 1.02, addL: 0.02 },    // côte : bleu-vert marin
    fusang:   { hue: 42,  spread: 0.25, sat: 0.95, light: 1.05, addL: 0.02 },    // arbre solaire : or
    moon:     { hue: 235, spread: 0.30, sat: 0.55, light: 1.08, addL: 0.05 },    // lune : bleus pâles
    cave:     { hue: 270, spread: 0.20, sat: 0.35, light: 0.85, addL: -0.02 },    // souterrain : gris-violet
    ice:      { hue: 200, spread: 0.25, sat: 0.55, light: 1.15, addL: 0.08 }      // glace : bleus pâles
};
// Biomes qui ne teintent pas (intérieurs, arène…) : dessins d'origine.
export const biomeHasTint = biome => Boolean(biome && BIOME_TINTS[biome]);

// Dessins qui ont déjà leur identité (élémentaires, soleils-boss) : jamais recolorés.
const FIXED_KEYS = new Set(['frost_dragon', 'ice_witch', 'ember_dragon', 'lava_behemoth', 'fire_tiger', 'flame_boar', 'ember_wolf', 'sand_colossus', 'void_vampire']);
export const isTintable = key => Boolean(key) && !FIXED_KEYS.has(key) && !/^sun_\d/.test(key);

function hexToRgb(h) {
    let s = h.slice(1);
    if (s.length === 3) s = s.replace(/./g, '$&$&');
    const n = parseInt(s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [(h * 60 + 360) % 360, s, l];
}
export function hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [r, g, b].map(v => Math.round((v + m) * 255));
}
const toHex = rgb => '#' + rgb.map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
const clamp01 = v => Math.max(0, Math.min(1, v));

// Couleur hex recolorée pour un biome ; les neutres (gris, blancs, contours très sombres) restent inchangés.
export function tintHex(hex, biome) {
    const t = BIOME_TINTS[biome];
    if (!t) return hex;
    const [h, s, l] = rgbToHsl(...hexToRgb(hex));
    if (s < 0.14 || l < 0.16 || l > 0.94) return hex;
    const bias = t.bias || 0;                                  // écart signé à la teinte cible, dans [bias-180, bias+180[
    const dh = ((h - t.hue - bias + 540) % 360) - 180 + bias;
    const nh = (t.hue + dh * t.spread + 360) % 360;
    return toHex(hslToRgb(nh, clamp01(s * t.sat), clamp01(l * t.light + t.addL)));
}

const cache = new Map();   // biome → Map(svg → svg teinté)
// SVG recoloré (même chaîne renvoyée à chaque appel pour un couple svg/biome : les caches d'images s'y appuient).
export function tintSvg(svg, biome) {
    if (!svg || !biomeHasTint(biome)) return svg;
    let m = cache.get(biome);
    if (!m) cache.set(biome, m = new Map());
    let out = m.get(svg);
    if (!out) {
        out = svg.replace(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g, c => tintHex(c, biome));
        m.set(svg, out);
    }
    return out;
}

// Part des pixels « colorés » du dessin dans une plage de teintes (utile aux tests et à l'outillage).
export function dominantHue(svg) {
    const acc = {};
    (svg.match(/#[0-9a-fA-F]{6}\b/g) || []).forEach(c => {
        const [h, s, l] = rgbToHsl(...hexToRgb(c));
        if (s < 0.14 || l < 0.16 || l > 0.94) return;
        const b = Math.floor(h / 30) * 30;
        acc[b] = (acc[b] || 0) + 1;
    });
    return Object.entries(acc).sort((a, b) => b[1] - a[1]).map(([h]) => +h)[0] ?? null;
}
