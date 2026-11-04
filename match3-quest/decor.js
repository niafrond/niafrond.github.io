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

// Décors franchissables : tout ce qui ressemble à de l'herbe (roseaux, jonc, herbe sèche, algues) est trop bas pour arrêter un héros ;
// ces cases se parcourent comme des hautes herbes, avec leurs rencontres aléatoires.
export const LOW_DECOR = new Set(['rice', 'deadreed', 'drygrass', 'seaweed', 'kelp']);

// ── Échelle des décors ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Jusqu'ici tous les décors étaient dessinés à 0,85 case : un lit, une armoire et un coquillage avaient la même taille. Ici chaque décor a sa taille :
// on lit la plus grande dimension visible voulue (en cases ; 1 case ≈ 1,8 m, un personnage fait ≈ 0,95 case de haut) et l'on en tire le facteur
// appliqué à la largeur du sprite (mesure faite sur le cadre réel de chaque dessin, marges transparentes comprises). Un décor absent de la table
// garde DEFAULT_DECOR_SCALE.
export const DEFAULT_DECOR_SCALE = 0.85;
export const DECOR_SCALE = {
    bed: 1.47,   // 1.4 cases
    cabinet: 1.21,   // 1.15 cases
    shelf: 1.26,   // 1.2 cases
    table: 1.11,   // 1.05 cases
    basket: 0.74,   // 0.7 case
    plant: 0.89,   // 0.85 case
    cushion: 0.53,   // 0.5 case
    jar: 0.86,   // 0.7 case
    rice: 0.92,   // 0.8 case
    deadreed: 1.0,   // 0.9 case
    stump: 0.62,   // 0.55 case
    scarecrow: 1.17,   // 1.15 cases
    tools: 0.91,   // 0.8 case
    brokenjar: 0.69,   // 0.55 case
    strawhat: 0.54,   // 0.45 case
    wiltedlotus: 0.77,   // 0.6 case
    sluice: 1.19,   // 1.0 case
    fence: 1.02,   // 1.0 case
    mudrock: 0.94,   // 0.8 case
    driftlog: 1.1,   // 1.0 case
    clayblock: 0.9,   // 0.7 case
    fossil: 0.97,   // 0.7 case
    bamboo: 1.21,   // 1.1 cases
    fallenlog: 1.1,   // 1.0 cases
    mossrock: 0.95,   // 0.8 case
    shoot: 0.89,   // 0.7 case
    mushroom: 0.56,   // 0.4 case
    stonelantern: 1.18,   // 1.0 case
    cactus: 1.44,   // 1.3 cases
    thornbush: 0.87,   // 0.8 case
    standingstone: 1.6,   // 1.3 cases
    drygrass: 0.82,   // 0.8 case
    bones: 0.7,   // 0.6 case
    crag: 1.48,   // 1.3 cases
    blastedtree: 1.55,   // 1.3 cases
    brokenpost: 1.23,   // 0.9 case
    fallenbranch: 0.99,   // 0.9 case
    basalt: 1.36,   // 1.1 cases
    vcrystal: 1.19,   // 1.0 case
    charred: 1.46,   // 1.2 cases
    glowmush: 0.62,   // 0.5 case
    embers: 0.9,   // 0.7 case
    obsidian: 1.2,   // 0.9 case
    dragonstatue: 1.59,   // 1.4 cases
    acacia: 1.59,   // 1.4 cases
    termite: 1.23,   // 1.0 case
    shell: 0.49,   // 0.4 case
    conch: 0.52,   // 0.4 case
    driftwood: 1.07,   // 0.9 case
    crab: 0.41,   // 0.35 case
    starfish: 0.42,   // 0.35 case
    seaweed: 0.84,   // 0.8 case
    kelp: 1.06,   // 1.0 case
    anemone: 0.6,   // 0.45 case
    hermit: 0.52,   // 0.35 case
    tidestone: 1.27,   // 1.0 case
    tree: 1.73,   // 1.4 cases
    sunflower: 1.12,   // 1.0 case
    fusroot: 1.11,   // 0.9 case
    goldleaves: 0.77,   // 0.6 case
    blackfeather: 0.64,   // 0.5 case
    stalagmite: 1.41,   // 1.1 cases
    meteorite: 1.15,   // 0.9 case
    mooncrystal: 1.25,   // 1.1 cases
    brokenpillar: 1.3,   // 1.2 cases
    moonflower: 0.69,   // 0.6 case
    whiterabbit: 0.45,   // 0.4 case
    red_lantern: 1.05,   // 1.0 case
    stone_stele: 1.37,   // 1.3 cases
    guardian_lion: 1.26,   // 1.2 cases
    soul_urn: 0.63,   // 0.6 case
    incense_burner: 0.74,   // 0.7 case
    spirit_mirror: 1.26,   // 1.2 cases
    pale_flowers: 0.63,   // 0.6 case
    offering_bowl: 0.53,   // 0.5 case
    snow_pine: 1.53,   // 1.5 cases
    snow_rock: 0.92,   // 0.9 case
    stone_column_snow: 1.43,   // 1.4 cases
    lantern_red: 0.82,   // 0.8 case
    snow_flowers: 0.61,   // 0.6 case
    ice_block: 0.92,   // 0.9 case
    guardian_statue_snow: 1.43,   // 1.4 cases
    bronze_bell: 0.82,   // 0.8 case
    frozen_bamboo: 1.43,   // 1.4 cases
    fallen_log_snow: 1.12,   // 1.1 cases
    kang: 1.33,   // 1.3 cases
    tea_shelf: 1.22,   // 1.2 cases
    lacquer_chest: 0.82,   // 0.8 case
    calligraphy_scroll: 1.02,   // 1.0 case
    brazier: 0.71,   // 0.7 case
    firewood_basket: 0.61,   // 0.6 case
    indoor_lantern: 0.61,   // 0.6 case
    ice_stalagmite: 1.12,   // 1.1 case
    ice_crystal: 0.92,   // 0.9 case
    lantern_gold: 0.82,   // 0.8 case
    lantern_white: 0.82,   // 0.8 case
    lantern_jade: 0.82,   // 0.8 case
    silk_ribbons: 1.02,   // 1.0 case
    jade_ornament: 0.71,   // 0.7 case
    snow_hare: 0.51,   // 0.5 case
    glowing_crystal_lamp: 0.92,   // 0.9 case
};
export const decorScale = name => DECOR_SCALE[name] ?? DEFAULT_DECOR_SCALE;

// Échelle des PNJ par rapport à un personnage (1) : un buffle, un cheval ou un chameau dépassent un homme, une tortue, un lièvre ou une carpe le sont moins.
export const NPC_SCALE = {
    buffalo_dahei: 1.35,   // buffle d'eau
    horse_tian: 1.45,      // cheval céleste
    camel_baba: 1.5,       // chameau
    huli_xia: 0.95,        // renarde
    monkey_sun: 0.8,       // singe
    gui_turtle: 0.8,       // vieille tortue
    huang_xian: 0.7,       // belette
    hare_tuzi: 0.6,        // lièvre
    jade_hare: 0.6,        // lièvre de jade (messager de Chang'e)
    carp_jin: 0.55         // carpe dans sa flaque
};
export const npcScale = id => NPC_SCALE[id] ?? 1;

export const hash = (x, y) => Math.abs(Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1;

// Décor choisi (au hasard stable selon la case) dans la liste d'un biome.
export const pickDecor = (list, x, y) => list[Math.floor(hash(x, y) * list.length)];

const inRects = (rects, x, y) => (rects || []).some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh);

// Un décor est tiré au hasard d'après les coordonnées de la case. Une carte agrandie (world/enlarge.js, `screen.decorMap`) garde le tirage de sa
// grille d'origine : on lit le décor aux anciennes coordonnées, pour que les décors bas franchissables (roseaux, riz…) ne changent pas de place.
export function decorCell(screen, x, y) {
    const m = screen?.decorMap;
    if (!m) return [x, y];
    return [x < m.seam + m.block ? x : x - m.block, y - m.top];
}

// L'obstacle de la case (x, y) est-il un décor bas franchissable ? Jamais le pourtour de la carte (rangée de bordure), ni un
// intérieur, une arène, une carte aquatique (récifs), un bâtiment ou un pilier : seuls les obstacles de décor en plein terrain.
export function isLowObstacle(screen, x, y) {
    if (!screen || !inRects(screen.obstacles, x, y)) return false;
    return isLowCell(screen, x, y);
}

// Variante sans lecture de `screen.obstacles` : un obstacle posé sur cette case serait-il un décor bas franchissable ? (world/levelDesign.js)
export function isLowCell(screen, x, y) {
    if (!screen) return false;
    if (screen.interior || screen.aquatic || screen.arena || screen.kind === 'arena') return false;
    if (x <= 0 || y <= 0 || x >= screen.w - 1 || y >= screen.h - 1) return false;
    if ((screen.buildings || []).some(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h)) return false;
    if ((screen.structures || []).some(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h)) return false;
    if ((screen.pillars || []).some(([px, py]) => px === x && py === y)) return false;
    const list = BIOME_DECOR[screen.biome];
    return Boolean(list) && LOW_DECOR.has(pickDecor(list, ...decorCell(screen, x, y)));
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
