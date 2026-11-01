// Butin d'un ennemi de niveau supérieur : le vaincre rapporte à coup sûr de l'équipement rare, du niveau du joueur (jamais
// au-dessus : il doit pouvoir s'en servir) et d'autant plus rare que l'écart est grand. Module pur (sans DOM).

import { allItems } from './items.js';
import { allWeapons, weaponRarity } from './weapons.js';
import { WARD_STUFF } from './stuff.js';

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

// Clé stable d'un boss pour ne verser son butin de palier qu'une fois : ennemi de carte, sinon maître d'arène, sinon gabarit + niveau.
export function bossLootKey(enemy) {
    if (!enemy) return null;
    if (enemy.arena?.master) return `arena:${enemy.arena.tier}`;
    if (enemy.mapEnemyId) return `map:${enemy.mapEnemyId}`;
    return `boss:${enemy.templateId || enemy.name}:${enemy.level}`;
}

/**
 * Butin de palier garanti à la première victoire sur un boss : l'arme la plus puissante que le héros peut manier et la relique
 * la plus haute qu'il ne possède pas encore (jamais au-dessus de son niveau). Remplace le hasard du butin pour l'équipement idéal.
 * @param {object} owner { level, weapons: [{id}], inventory: [{id, type}] }
 * @returns {Array<{ kind: 'item'|'weapon', rarity: string, item?: object, weapon?: object }>}
 */
export function rollBossLoot(owner = {}, rng = Math.random, element = null) {
    const level = Math.max(1, owner.level || 1);
    const ownedWeapons = new Set((owner.weapons || []).map(w => w.id));
    const ownedArtifacts = new Set((owner.inventory || []).filter(i => i?.type === 'artifact').map(i => i.id));
    const loot = [];

    const weapons = allWeapons.filter(w => w.minLevel <= level && !ownedWeapons.has(w.id) && weaponRarity(w) !== 'common');
    if (weapons.length) {
        const top = Math.max(...weapons.map(w => w.minLevel));
        const best = weapons.filter(w => w.minLevel === top).sort((a, b) => b.damage - a.damage)[0];
        loot.push({ kind: 'weapon', rarity: weaponRarity(best), weapon: best });
    }

    const relics = allItems.filter(i => i.type === 'artifact' && i.minLevel <= level && !ownedArtifacts.has(i.id));
    if (relics.length) {
        const rank = r => RARITY_ORDER.indexOf(r.rarity);
        const top = Math.max(...relics.map(rank));
        const pool = relics.filter(r => rank(r) === top);
        const topLevel = Math.max(...pool.map(r => r.minLevel));
        const pick = pool.filter(r => r.minLevel === topLevel);
        const item = pick[Math.floor(rng() * pick.length)];
        loot.push({ kind: 'item', rarity: item.rarity, item });
    }
    // Parure de l'élément du boss (palier le plus haut que le héros peut porter) : la protection contre ce type de sorts.
    if (element) {
        const owned = new Set(owner.stuffOwned || []);
        const wards = WARD_STUFF.filter(s => s.ward?.[element] && s.minLevel <= level && !owned.has(s.id));
        if (wards.length) {
            const top = Math.max(...wards.map(s => s.minLevel));
            const pool = wards.filter(s => s.minLevel === top);
            const stuff = pool[Math.floor(rng() * pool.length)];
            loot.push({ kind: 'stuff', rarity: stuff.rarity, stuff });
        }
    }
    return loot;
}
