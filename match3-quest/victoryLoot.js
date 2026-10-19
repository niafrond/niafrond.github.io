// Butin d'un ennemi de niveau supérieur : le vaincre rapporte à coup sûr de l'équipement rare, du niveau du joueur (jamais
// au-dessus : il doit pouvoir s'en servir) et d'autant plus rare que l'écart est grand. Module pur (sans DOM).

import { allItems } from './items.js';
import { allWeapons, weaponRarity } from './weapons.js';

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'legendary'];

// Toujours rare au minimum (le jeu n'a pas de rareté « épique » : rare → légendaire). Poids de rareté selon l'écart de niveau (ennemi − joueur), et nombre de tirages.
export function overleveledLootTier(gap) {
    if (gap >= 4) return { rolls: 2, rarity: { legendary: 100 } };
    if (gap === 3) return { rolls: 2, rarity: { rare: 40, legendary: 60 } };
    if (gap === 2) return { rolls: 1, rarity: { rare: 65, legendary: 35 } };
    if (gap === 1) return { rolls: 1, rarity: { rare: 85, legendary: 15 } };
    return null;
}

function pickWeighted(weights, rng) {
    const entries = Object.entries(weights).filter(([, w]) => w > 0);
    let r = rng() * entries.reduce((s, [, w]) => s + w, 0);
    for (const [key, w] of entries) if ((r -= w) < 0) return key;
    return entries[entries.length - 1][0];
}

// Parmi les candidats de la rareté voulue (sinon d'un cran en dessous…), ceux du niveau du joueur d'abord (niveau − 2 et plus).
function pick(candidates, rarityOf, rarity, level, rng) {
    for (let i = RARITY_ORDER.indexOf(rarity); i >= 0; i--) {
        const pool = candidates.filter(c => rarityOf(c) === RARITY_ORDER[i]);
        if (!pool.length) continue;
        const near = pool.filter(c => c.minLevel >= level - 2);
        const from = near.length ? near : pool;
        return from[Math.floor(rng() * from.length)];
    }
    return null;
}

/**
 * Tire le butin garanti d'un ennemi de niveau supérieur ([] si l'ennemi n'est pas plus haut que le joueur).
 * @param {number} gap   niveau de l'ennemi − niveau du joueur
 * @param {object} owner { level, weapons: [{id}], inventory: [{id, type}] } : pas de doublon d'arme ni de relique
 * @returns {Array<{ kind: 'item'|'weapon', rarity: string, item?: object, weapon?: object }>}
 */
export function rollOverleveledLoot(gap, owner = {}, rng = Math.random) {
    const tier = overleveledLootTier(Math.floor(gap || 0));
    if (!tier) return [];
    const level = Math.max(1, owner.level || 1);
    const ownedWeapons = new Set((owner.weapons || []).map(w => w.id));
    const ownedArtifacts = new Set((owner.inventory || []).filter(i => i?.type === 'artifact').map(i => i.id));
    const loot = [];
    for (let n = 0; n < tier.rolls; n++) {
        const rarity = pickWeighted(tier.rarity, rng);
        if (rng() < 0.5) {
            const weapon = pick(allWeapons.filter(w => w.minLevel <= level && !ownedWeapons.has(w.id)), weaponRarity, rarity, level, rng);
            if (weapon) {
                ownedWeapons.add(weapon.id);
                loot.push({ kind: 'weapon', rarity: weaponRarity(weapon), weapon });
                continue;
            }
        }
        const item = pick(allItems.filter(i => i.minLevel <= level && !(i.type === 'artifact' && ownedArtifacts.has(i.id))), i => i.rarity, rarity, level, rng);
        if (item) {
            if (item.type === 'artifact') ownedArtifacts.add(item.id);
            loot.push({ kind: 'item', rarity: item.rarity, item });
        }
    }
    return loot;
}
