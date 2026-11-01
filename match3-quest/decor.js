// Décors des obstacles par biome (module pur, aucun DOM) : l'exploration les dessine (explorationView.js) et le moteur
// (exploration.js) s'en sert pour savoir quels obstacles sont « bas » : ces décors-là (roseaux, jonc des rizières) se traversent
// comme des hautes herbes, avec leurs rencontres aléatoires, au lieu de barrer le passage.

export const BIOME_DECOR = {
    paddy: ['rice', 'deadreed', 'stump', 'rice', 'rock', 'fence', 'scarecrow', 'basket', 'tools', 'brokenjar', 'rice', 'deadtree', 'strawhat', 'wiltedlotus', 'sluice'],
    riverbed: ['rock', 'rice', 'mudrock', 'driftlog', 'clayblock', 'rice', 'fossil', 'rock'],
    bamboo: ['bamboo', 'deadtree', 'bamboo', 'fallenlog', 'mossrock', 'shoot', 'mushroom', 'stonelantern'],
    gobi: ['cactus', 'rock', 'cactus', 'thornbush', 'standingstone', 'drygrass', 'bones'],
    storm: ['crag', 'deadtree', 'crag', 'blastedtree', 'brokenpost', 'fallenbranch', 'mushroom'],
    volcano: ['basalt', 'rock', 'vcrystal', 'charred', 'basalt', 'bones', 'glowmush', 'rock', 'embers', 'obsidian', 'dragonstatue'],
    savanna: ['rice', 'rock', 'rice', 'thornbush', 'acacia', 'termite', 'bones', 'drygrass'],
    coast: ['shell', 'rock', 'conch', 'driftwood', 'crab', 'starfish', 'seaweed'],
    tides: ['rock', 'shell', 'rock', 'kelp', 'anemone', 'hermit', 'tidestone', 'driftwood'],
    fusang: ['tree', 'deadtree', 'tree', 'sunflower', 'fusroot', 'goldleaves', 'blackfeather'],
    house: ['shelf', 'cabinet', 'bed', 'table', 'jar', 'basket', 'plant', 'cushion'],
    cave: ['rock', 'stalagmite', 'rock'],
    moon: ['rock', 'deadtree', 'rock', 'meteorite', 'mooncrystal', 'brokenpillar', 'moonflower', 'whiterabbit'],
    // Royaume des âmes errantes (événement, events/wanderingSouls/) : lanternes de pierre, colonnes brisées, urnes, plumes noires.
    wandering_souls: ['red_lantern', 'stone_stele', 'guardian_lion', 'soul_urn', 'incense_burner', 'spirit_mirror', 'pale_flowers', 'offering_bowl'],
    // Montagne des lanternes enneigées (événement, events/winterLanternFestival/) : sprites pixel art générés (tools/gen-winter-decor.mjs).
    winter_lantern_mountain: ['snow_pine', 'snow_rock', 'stone_column_snow', 'lantern_red', 'snow_flowers', 'ice_block', 'guardian_statue_snow', 'bronze_bell', 'frozen_bamboo', 'fallen_log_snow', 'ice_stalagmite', 'ice_crystal', 'lantern_gold', 'lantern_white', 'lantern_jade', 'silk_ribbons', 'jade_ornament', 'snow_hare', 'glowing_crystal_lamp']
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
    if ((screen.structures || []).some(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h)) return false;
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

// Maison d'hiver (`screen.furnishing === 'winter'`, sprites de tools/gen-winter-decor.mjs, sans neige) : étagère à thé et coffre laqué au fond,
// kang pour deux obstacles contigus, brasero, panier de bois ou lanterne pour les obstacles isolés.
const WINTER_WALL_FURNITURE = ['tea_shelf', 'lacquer_chest', 'calligraphy_scroll', 'tea_shelf'];
const WINTER_FLOOR_OBJECTS = ['brazier', 'firewood_basket', 'indoor_lantern', 'firewood_basket'];

export function houseDecor(isObst, x, y, furnishing) {
    if (furnishing === 'winter') {
        if (y === 1) return WINTER_WALL_FURNITURE[Math.floor(hash(x, y) * WINTER_WALL_FURNITURE.length)];
        if (isObst(x - 1, y) || isObst(x + 1, y) || isObst(x, y - 1) || isObst(x, y + 1)) return 'kang';
        return WINTER_FLOOR_OBJECTS[Math.floor(hash(x, y) * WINTER_FLOOR_OBJECTS.length)];
    }
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
