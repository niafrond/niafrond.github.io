// Décors des obstacles par biome (module pur, aucun DOM) : l'exploration les dessine (explorationView.js) et le moteur
// (exploration.js) s'en sert pour savoir quels obstacles sont « bas » : ces décors-là (roseaux, jonc des rizières) se traversent
// comme des hautes herbes, avec leurs rencontres aléatoires, au lieu de barrer le passage.

export const BIOME_DECOR = {
    paddy: ['rice', 'deadtree', 'rice'],
    riverbed: ['rock', 'rice', 'rock'],
    bamboo: ['bamboo', 'deadtree', 'bamboo'],
    gobi: ['cactus', 'rock', 'cactus'],
    storm: ['crag', 'deadtree', 'crag'],
    volcano: ['spire', 'rock', 'spire'],
    savanna: ['rice', 'rock', 'rice'],
    coast: ['shell', 'rock', 'conch'],
    tides: ['rock', 'shell', 'rock'],
    fusang: ['tree', 'deadtree', 'tree'],
    house: ['chair', 'jar', 'bed', 'books', 'lantern', 'teapot'],
    cave: ['rock', 'stalagmite', 'rock'],
    moon: ['rock', 'deadtree', 'rock']
};

// Décors franchissables : touffes de roseaux, trop basses pour arrêter un héros.
export const LOW_DECOR = new Set(['rice']);

export const hash = (x, y) => Math.abs(Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1;

// Décor choisi (au hasard stable selon la case) dans la liste d'un biome.
export const pickDecor = (list, x, y) => list[Math.floor(hash(x, y) * list.length)];

const inRects = (rects, x, y) => (rects || []).some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh);

// L'obstacle de la case (x, y) est-il un décor bas franchissable ? Jamais le pourtour de la carte (rangée de bordure), ni un
// intérieur, une arène, une carte aquatique (récifs), un bâtiment ou un pilier : seuls les obstacles de décor en plein terrain.
export function isLowObstacle(screen, x, y) {
    if (!screen || !inRects(screen.obstacles, x, y)) return false;
    if (screen.interior || screen.aquatic || screen.arena || screen.kind === 'arena') return false;
    if (x <= 0 || y <= 0 || x >= screen.w - 1 || y >= screen.h - 1) return false;
    if ((screen.buildings || []).some(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h)) return false;
    if ((screen.pillars || []).some(([px, py]) => px === x && py === y)) return false;
    const list = BIOME_DECOR[screen.biome];
    return Boolean(list) && LOW_DECOR.has(pickDecor(list, x, y));
}
