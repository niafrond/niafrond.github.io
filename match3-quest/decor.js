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
    house: ['shelf', 'cabinet', 'bed', 'table', 'jar', 'basket', 'plant', 'cushion'],
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

// ── Maisons ───────────────────────────────────────────────────────────────
// Un intérieur n'est pas tiré au hasard : le mobilier haut (étagère, armoire, lit) s'adosse au mur du fond, deux obstacles contigus
// forment une table basse, les obstacles isolés sont des objets domestiques (jarre, panier, plante, coussin) : plus de lanternes ni de
// théières posées par terre. `isObst(x, y)` : la case est un obstacle (le pourtour est un mur).
const WALL_FURNITURE = ['shelf', 'cabinet', 'bed', 'shelf'];
const FLOOR_OBJECTS = ['jar', 'basket', 'plant', 'cushion', 'jar'];

export function houseDecor(isObst, x, y) {
    if (y === 1) return WALL_FURNITURE[Math.floor(hash(x, y) * WALL_FURNITURE.length)];
    if (isObst(x - 1, y) || isObst(x + 1, y) || isObst(x, y - 1) || isObst(x, y + 1)) return 'table';
    return FLOOR_OBJECTS[Math.floor(hash(x, y) * FLOOR_OBJECTS.length)];
}

// Tapis de la pièce : plus grand rectangle (jusqu'à 5×3, minimum 2×2) libre de tout obstacle, hors rangée du fond et rangée de la porte,
// au plus près du centre. `blocked(x, y)` : obstacle ou sortie. Retourne { x, y, w, h } ou null si la pièce est trop encombrée.
export function houseRug(blocked, w, h) {
    let best = null;
    for (let rw = Math.min(5, w - 4); rw >= 2 && !best; rw--) {
        for (let rh = Math.min(3, h - 4); rh >= 2 && !best; rh--) {
            let bestD = Infinity;
            for (let ry = 2; ry + rh <= h - 2; ry++) for (let rx = 1; rx + rw <= w - 1; rx++) {
                let free = true;
                for (let i = 0; i < rw && free; i++) for (let j = 0; j < rh && free; j++) if (blocked(rx + i, ry + j)) free = false;
                const d = Math.abs(rx + rw / 2 - w / 2) + Math.abs(ry + rh / 2 - h / 2);
                if (free && d < bestD) { bestD = d; best = { x: rx, y: ry, w: rw, h: rh }; }
            }
        }
    }
    return best;
}
