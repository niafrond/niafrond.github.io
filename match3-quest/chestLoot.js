// Butin des coffres d'exploration : en plus de l'or, un coffre peut contenir des potions (consommables),
// des reliques (objets permanents) ou des armes. Plus le coffre est difficile à trouver, plus le butin est
// abondant et rare.
//
// Difficulté d'un coffre (sans config explicite) :
//  - l'or qu'il contient, rapporté à sa région (palier ≈ or / (15 × n° de région), cf. world/FORMAT.md) :
//    un coffre caché derrière le décor ou au bout d'une zone en contient 2 à 3 fois plus qu'une jarre de village ;
//  - son emplacement : maison / village (sûr) < zone sauvage (ennemis) < sanctuaire (derrière le gardien).
// Un coffre peut forcer son palier avec `lootTier: 1..4`, ou n'avoir aucun butin avec `loot: false`.
// Les coffres sans or (autel de la lune…) ne donnent jamais d'objet.
//
// Module pur (sans DOM) : `rollChestLoot` tire le butin, game.js (`grantChestLoot`) le met dans le sac.

import { allItems } from './items.js';
import { allWeapons } from './weapons.js';
import { REGION_ORDER, REGION_LEVEL } from './world/index.js';

const LOCATION_BONUS = { house: 0, village: 0, wild: 0.5, sanctuary: 1 };

// Paliers de coffre : nombre de tirages, chance d'arme, poids de rareté, niveaux d'avance autorisés.
export const LOOT_TIERS = {
    1: { name: 'Coffre ordinaire', rolls: [0.6], weaponChance: 0.1, levelBonus: 0,
         rarity: { common: 85, uncommon: 15 } },
    2: { name: 'Coffre bien caché', rolls: [1], weaponChance: 0.2, levelBonus: 2,
         rarity: { common: 35, uncommon: 50, rare: 15 } },
    3: { name: 'Coffre secret', rolls: [1, 0.5], weaponChance: 0.3, levelBonus: 4,
         rarity: { uncommon: 35, rare: 55, legendary: 10 } },
    4: { name: 'Trésor légendaire', rolls: [1, 1], weaponChance: 0.4, levelBonus: 6,
         rarity: { rare: 60, legendary: 40 } }
};

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'legendary'];

// Rareté d'une arme : son rang dans sa famille (la plus faible = commune, la 4e et au-delà = légendaire).
export function weaponRarity(weapon) {
    const family = allWeapons.filter(w => w.type === weapon.type).sort((a, b) => a.minLevel - b.minLevel);
    return RARITY_ORDER[Math.min(family.findIndex(w => w.id === weapon.id), RARITY_ORDER.length - 1)] || 'common';
}

// Palier de difficulté (1 à 4) d'un coffre posé sur un écran (`screen.kind` : house / village / wild ; sanctuaire sinon).
export function chestTier(chest, screen = {}) {
    if (!chest || chest.loot === false || !(chest.gold > 0)) return 0;
    if (chest.lootTier) return Math.max(1, Math.min(4, chest.lootTier));
    const region = Math.max(1, REGION_ORDER.indexOf(screen.region) + 1);
    const location = LOCATION_BONUS[screen.kind] ?? LOCATION_BONUS.sanctuary;
    const score = chest.gold / (15 * region) + location;
    if (score >= 3.5) return 4;
    if (score >= 2.5) return 3;
    if (score >= 1.5) return 2;
    return 1;
}

function pickWeighted(weights, rng) {
    const entries = Object.entries(weights).filter(([, w]) => w > 0);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = rng() * total;
    for (const [key, w] of entries) {
        if ((r -= w) < 0) return key;
    }
    return entries[entries.length - 1]?.[0];
}

const pickOne = (list, rng) => list[Math.floor(rng() * list.length)];

// Candidats de la rareté voulue ; à défaut, on descend d'un cran de rareté (jamais d'objet au-dessus du niveau permis).
function pickByRarity(candidates, rarityOf, rarity, rng) {
    for (let i = RARITY_ORDER.indexOf(rarity); i >= 0; i--) {
        const pool = candidates.filter(c => rarityOf(c) === RARITY_ORDER[i]);
        if (pool.length) return pickOne(pool, rng);
    }
    return null;
}

/**
 * Tire le butin d'un coffre.
 * @param {object} chest  coffre (gold, lootTier?, loot?)
 * @param {object} screen écran où il se trouve (region, kind)
 * @param {object} owner  { level, weapons: [{id}], inventory: [{id, type}] } : évite les doublons d'armes et de reliques
 * @param {Function} rng  générateur [0, 1[ (Math.random par défaut)
 * @returns {{ tier: number, tierName: string, loot: Array<{ kind: 'item'|'weapon', rarity: string, item?: object, weapon?: object }> }}
 */
export function rollChestLoot(chest, screen = {}, owner = {}, rng = Math.random) {
    const tier = chestTier(chest, screen);
    const cfg = LOOT_TIERS[tier];
    if (!cfg) return { tier: 0, tierName: '', loot: [] };
    const level = Math.max(owner.level || 1, REGION_LEVEL[screen.region] || 1);
    const maxLevel = level + cfg.levelBonus;
    const ownedWeapons = new Set((owner.weapons || []).map(w => w.id));
    const ownedArtifacts = new Set((owner.inventory || []).filter(i => i?.type === 'artifact').map(i => i.id));
    const loot = [];

    cfg.rolls.forEach(chance => {
        if (rng() >= chance) return;
        const rarity = pickWeighted(cfg.rarity, rng);
        if (rng() < cfg.weaponChance) {
            const weapons = allWeapons.filter(w => w.minLevel <= maxLevel && !ownedWeapons.has(w.id));
            const weapon = pickByRarity(weapons, weaponRarity, rarity, rng);
            if (weapon) {
                ownedWeapons.add(weapon.id);
                loot.push({ kind: 'weapon', rarity: weaponRarity(weapon), weapon });
                return;
            }
        }
        // Potions et reliques ; une relique déjà portée n'est pas redonnée (ses effets se cumuleraient).
        const items = allItems.filter(i => i.minLevel <= maxLevel && !(i.type === 'artifact' && ownedArtifacts.has(i.id)));
        const item = pickByRarity(items, i => i.rarity, rarity, rng);
        if (item) {
            if (item.type === 'artifact') ownedArtifacts.add(item.id);
            loot.push({ kind: 'item', rarity: item.rarity, item });
        }
    });
    return { tier, tierName: cfg.name, loot };
}
