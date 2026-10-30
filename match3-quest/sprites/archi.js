// Sprites des structures de décor (world/structures.js) : pixel art généré (biomeArchi.js) ou SVG (biomeSvg.js), prêts à être dessinés sur
// la carte d'exploration. `archiSprite(id)` renvoie le canvas de la structure une fois décodée (sinon null, et le décodage démarre) ;
// à dessiner sans lissage sur w × h cases (dimensions de world/structures.js).
import { BIOME_ARCHI } from './biomeArchi.js';
import { BIOME_SVG } from './biomeSvg.js';

const SVG_PX = 32;   // pixels par case pour les SVG (rendu pixellisé comme le reste de la carte)
const done = new Map();
const pending = new Set();

export const hasArchi = id => Boolean(BIOME_ARCHI[id] || BIOME_SVG[id]);

export function archiSprite(id) {
    if (done.has(id)) return done.get(id);
    if (pending.has(id) || typeof document === 'undefined' || !hasArchi(id)) return null;
    pending.add(id);
    const img = new Image();
    img.onload = () => {
        const c = document.createElement('canvas');
        c.width = BIOME_ARCHI[id] ? img.naturalWidth : SVG_PX * 2;
        c.height = BIOME_ARCHI[id] ? img.naturalHeight : SVG_PX;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = Boolean(BIOME_SVG[id] && !BIOME_ARCHI[id]);
        g.drawImage(img, 0, 0, c.width, c.height);
        done.set(id, c);
        pending.delete(id);
    };
    img.onerror = () => pending.delete(id);
    img.src = BIOME_ARCHI[id] ? BIOME_ARCHI[id].uri : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(BIOME_SVG[id])}`;
    return null;
}
