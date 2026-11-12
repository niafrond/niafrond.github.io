// Constantes de la vue d'exploration : durées, tailles de tuile, touches, palette des biomes.
// Extrait de explorationView.js.
import { ARENA_BIOMES } from './arena.js';
import { BIOME_DECOR } from './decor.js';

// Intervalle de redessin de la carte quand un modal la recouvre en partie (ms).
export const COVERED_DRAW_MS = 250;
export const IDLE_DRAW_MS = 33;        // héros immobile : seules les animations d'ambiance bougent, 30 i/s suffisent (batterie)
export const IDLE_DRAW_LOW_MS = 66;    // idem en effets réduits : ~15 i/s
// En mouvement : 60 i/s au plus (sur un écran 120 Hz, dessiner à chaque rafraîchissement double la consommation sans gain visible).
export const MOVING_DRAW_MS = 16;
// Aucune saisie depuis DEEP_IDLE_AFTER_MS (téléphone posé, écran allumé) : ~11 i/s suffisent aux animations d'ambiance.
export const DEEP_IDLE_AFTER_MS = 20000;
export const DEEP_IDLE_DRAW_MS = 90;
// Carte cachée (combat, menus, cinématique) ou sous un modal : la boucle ne se réveille que toutes les SLEEP_TICK_MS.
// Reste sous le plafond de 100 ms du pas de temps (la logique ne doit pas ralentir).
export const SLEEP_TICK_MS = 90;
// Distance (cases) à une sortie en deçà de laquelle le sol de la carte voisine est préparé, et temps (ms) alloué à chaque image.
export const PREBUILD_RANGE = 14;
export const PREBUILD_BUDGET_MS = 8;
export const ARRIVAL_BUDGET_MS = 24;   // à l'arrivée sur une carte dont le sol n'est pas fini : tranche par image

export const MIN_TILE = 44;    // en dessous, la carte défile avec le héros au lieu de rétrécir
export const MAX_TILE = 96;
export const HUD_TOP = 64;     // bandeau du haut (titre, objectif, boutons)
export const HUD_BOTTOM = 8;
export const MOVE_DELAY_MS = 150;
export const MOUNTED_MOVE_DELAY_MS = 75;   // à cheval : deux fois plus vite
export const MOUNTED_SPRITE_TILES = 1.325; // sprite du cavalier (40 px) : 1,06 case pour 32 px (héros à pied) × 40/32, soit le même grain de pixel
export const BATTLE_TRANSITION_MS = 3400;   // durée de l'animation d'entrée en combat : le nom de l'adversaire reste lisible environ 2 s
export const BATTLE_STRIPS = 10;

export const DIRECTIONS = {
    up: { dx: 0, dy: -1 },
    down: { dx: 0, dy: 1 },
    left: { dx: -1, dy: 0 },
    right: { dx: 1, dy: 0 }
};

export const KEY_TO_DIR = {
    ArrowUp: 'up', w: 'up', z: 'up', W: 'up', Z: 'up',
    ArrowDown: 'down', s: 'down', S: 'down',
    ArrowLeft: 'left', a: 'left', q: 'left', A: 'left', Q: 'left',
    ArrowRight: 'right', d: 'right', D: 'right'
};

// Palette de chaque biome : sol (damier), chemin, falaise, liquide, ciel, décors des obstacles.
// Les 10 biomes de la légende de Hou Yi (voir UNIVERS.md §6).
export const BIOMES = {
    paddy: { a: '#c4a85c', b: '#b99d52', path: '#dcc88e', cliff: '#7a5a30', liquid: '#8a9a78', sky: ['#f0a860', '#fbe3b8'], decor: BIOME_DECOR.paddy },
    riverbed: { a: '#6b5538', b: '#614d33', path: '#8c7550', cliff: '#3f3020', liquid: '#4f4129', sky: ['#e3b878', '#f7e6c6'], decor: BIOME_DECOR.riverbed },
    bamboo: { a: '#8a9684', b: '#808c7a', path: '#b8b09a', cliff: '#4a4f46', liquid: '#4f5f5a', sky: ['#9aa59a', '#d8dbd0'], decor: BIOME_DECOR.bamboo },
    gobi: { a: '#efdfb2', b: '#e8d6a4', path: '#f7ecc8', cliff: '#bf9c58', liquid: '#78c0c8', sky: ['#f8d98a', '#fff6dc'], decor: BIOME_DECOR.gobi },
    storm: { a: '#7d7690', b: '#746d88', path: '#a39cb8', cliff: '#3f3a54', liquid: '#4a5fa8', sky: ['#3b3558', '#7a73a0'], decor: BIOME_DECOR.storm },
    volcano: { a: '#3b3438', b: '#352e32', path: '#5a4a48', cliff: '#1d1719', liquid: '#ff5a1f', sky: ['#2a1010', '#7a2a14'], decor: BIOME_DECOR.volcano },
    savanna: { a: '#d8c06a', b: '#cfb75f', path: '#ead89a', cliff: '#8a6c2e', liquid: '#4a8fb8', sky: ['#f4c26a', '#fde9bd'], decor: BIOME_DECOR.savanna },
    coast: { a: '#e6d7b0', b: '#dccda6', path: '#f0e4c4', cliff: '#8a7650', liquid: '#1d5fa8', sky: ['#7ec4ec', '#e6f5fb'], decor: BIOME_DECOR.coast },
    tides: { a: '#8a6a44', b: '#7d5f3c', path: '#b88b52', cliff: '#2c2018', liquid: '#123a52', sky: ['#08142a', '#1d3d63'], decor: BIOME_DECOR.tides },
    fusang: { a: '#f0dc8c', b: '#e8d27e', path: '#fff0b0', cliff: '#b88a2a', liquid: '#e8b830', sky: ['#fde6a6', '#fffbea'], decor: BIOME_DECOR.fusang },
    house: { a: '#c9a06a', b: '#bd9560', path: '#a8483a', cliff: '#5a3a24', liquid: '#6ab7c9', sky: ['#3a2a20', '#5a4130'], decor: BIOME_DECOR.house },
    cave: { a: '#4a4440', b: '#433d39', path: '#5d554e', cliff: '#1c1815', liquid: '#2a3f55', sky: ['#0b0a0c', '#1c1815'], decor: BIOME_DECOR.cave },
    moon: { a: '#c9cde8', b: '#bec3e0', path: '#e4e6f4', cliff: '#3a3f78', liquid: '#6f86d8', sky: ['#171a4a', '#3b3f86'], decor: BIOME_DECOR.moon },
    // Royaume des âmes errantes (événement) : pierre grise, noir encre, brume bleu nuit, chemin d'or vieilli (palette de la spec)
    wandering_souls: { a: '#686a70', b: '#5f6167', path: '#8c7b55', cliff: '#171a24', liquid: '#273b59', sky: ['#171a24', '#273b59'], decor: BIOME_DECOR.wandering_souls },
    // Montagne des lanternes enneigées (événement) : neige blanche, glace bleue, ciel bleu nuit, chemin de pierre chaude (palette de la spec)
    winter_lantern_mountain: { a: '#e8edf0', b: '#dde4e8', path: '#b8a98c', cliff: '#293b59', liquid: '#a5cedd', sky: ['#293b59', '#a5cedd'], decor: BIOME_DECOR.winter_lantern_mountain, tall: { bg: '#d3e1ec', mid: '#aac4d8', deep: '#7f9fba', tip: '#ffffff' } },
    ...ARENA_BIOMES  // parvis et salles de l'Arène des Mille Flèches (arena.js)
};

export const shade = (hex, amt) => {
    const n = parseInt(hex.slice(1), 16);
    const c = v => Math.max(0, Math.min(255, v + amt));
    return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
};
