// Potions trouvées dans les coffres de la carte : plus un coffre est difficile à trouver, plus il a de chances
// de contenir une potion, et plus elle est rare.
//
// Difficulté (1 à 4) : le palier du coffre (or ≈ 15 × numéro de région × palier 1|2|3, voir world/FORMAT.md),
// +1 en zone sauvage (coffre gardé par des ennemis, hors du chemin). Un coffre peut la fixer avec `difficulty`.
//   1 : jardin, maison           → 30 % de chances, potion commune
//   2 : marché, cache sauvage     → 50 %, commune ou peu commune
//   3 : coffre caché ou gardé     → 75 %, surtout peu commune, parfois rare
//   4 : trésor d'un gardien       → toujours, peu commune ou rare
// Un coffre difficile peut donner une potion au-dessus du niveau du héros (LEVEL_SLACK). Si aucune potion de la
// rareté tirée n'existe à ce niveau, on prend la rareté inférieure.
// Tirage déterministe (graine = id du coffre + Nouvelle Partie +) : recharger la partie ne change pas le butin.

import { allItems } from './items.js';

const RARITY_ORDER = ['common', 'uncommon', 'rare'];
export const CHEST_LOOT = {
    1: { chance: 0.3, rarity: { common: 1 } },
    2: { chance: 0.5, rarity: { common: 0.6, uncommon: 0.4 } },
    3: { chance: 0.75, rarity: { common: 0.15, uncommon: 0.55, rare: 0.3 } },
    4: { chance: 1, rarity: { uncommon: 0.3, rare: 0.7 } }
};
const LEVEL_SLACK = { 1: 1, 2: 2, 3: 4, 4: 6 };

const POTIONS = allItems.filter(item => item.type === 'consumable');

// regionIndex : 1 (rizières) … 10 (lune).
export function chestDifficulty(chest, screen, regionIndex = 1) {
    if (!chest || chest.altar || !(chest.gold > 0)) return 0;
    if (Number.isInteger(chest.difficulty)) return Math.min(4, Math.max(1, chest.difficulty));
    const tier = Math.min(3, Math.max(1, Math.round(chest.gold / (15 * Math.max(1, regionIndex)))));
    return Math.min(4, tier + (screen?.kind === 'wild' ? 1 : 0));
}

function rng(seedText) {
    let h = 2166136261;
    for (const ch of String(seedText)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    let a = h >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Potion contenue dans le coffre (copie de l'objet du catalogue), ou null.
export function chestPotion(chest, screen, { regionIndex = 1, level = 1, ngPlus = 0 } = {}) {
    const difficulty = chestDifficulty(chest, screen, regionIndex);
    if (!difficulty) return null;
    const table = CHEST_LOOT[difficulty];
    const random = rng(`${chest.id}:${ngPlus}`);
    if (random() >= table.chance) return null;
    let roll = random();
    let rarity = RARITY_ORDER[0];
    for (const r of RARITY_ORDER) {
        const w = table.rarity[r] || 0;
        if (roll < w) { rarity = r; break; }
        roll -= w;
    }
    const maxLevel = Math.max(1, level) + LEVEL_SLACK[difficulty];
    for (let i = RARITY_ORDER.indexOf(rarity); i >= 0; i--) {
        const pool = POTIONS.filter(p => p.rarity === RARITY_ORDER[i] && p.minLevel <= maxLevel);
        if (pool.length) return { ...pool[Math.floor(random() * pool.length)] };
    }
    return null;
}
