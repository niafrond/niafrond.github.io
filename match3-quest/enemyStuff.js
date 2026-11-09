// Stuff des ennemis : casque, collier, bracelet et bague portés par un monstre. Module pur (sans DOM).
//
// Un ennemi porte `stuff` ({ head, neck, wrist, ring } : id ou null), comme le héros. Les pièces sont tirées dans le catalogue (stuff.js,
// hors pièces de quête) selon son niveau et sa puissance : plus il est haut ou costaud, plus il porte de pièces, et plus elles sont proches
// de son niveau. Elles agissent comme sur le héros : Atk / Déf (combatStats.js), qì max (manaGear.js), PV max (ajoutés à la création),
// résistance au poison (gameTurnFlow.js). En le battant, on a une chance de récupérer ce qu'il portait (rollEnemyStuffDrops).

import { STUFF_SLOTS, getStuffById, lootableStuff, wornStuff } from './stuff.js';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** Niveau « effectif » du stuff d'un ennemi : son niveau, relevé par sa puissance (multiplicateurs du gabarit) et par le statut de boss. */
export function stuffLevelFor(level, statsModifiers = null, boss = false) {
    const m = statsModifiers || {};
    const avg = ((m.hpMult || 1) + (m.atkMult || 1) + (m.defMult || 1)) / 3;
    return Math.max(1, Math.round((level || 1) + (avg - 1) * 6 + (boss ? 3 : 0)));
}

/** Chance qu'un ennemi porte une pièce à un emplacement donné (un boss les porte toutes). */
export function slotWearChance(level, boss = false) {
    return boss ? 1 : clamp(0.12 + (level || 1) * 0.022, 0.12, 0.75);
}

function pickWeighted(list, weightOf, rng) {
    const total = list.reduce((s, x) => s + weightOf(x), 0);
    let r = rng() * total;
    for (const x of list) if ((r -= weightOf(x)) < 0) return x;
    return list[list.length - 1];
}

/**
 * Tire le stuff d'un ennemi. Une pièce ne dépasse jamais le niveau effectif ; les pièces proches de ce niveau sont les plus probables.
 * @returns {{head,neck,wrist,ring}} ids (ou null)
 */
export function rollEnemyStuff(level, { statsModifiers = null, boss = false, rng = Math.random } = {}) {
    const eff = stuffLevelFor(level, statsModifiers, boss);
    const stuff = { head: null, neck: null, wrist: null, ring: null };
    const pool = lootableStuff().filter(s => s.minLevel <= eff);
    STUFF_SLOTS.forEach(slot => {
        if (rng() >= slotWearChance(level, boss)) return;
        let candidates = pool.filter(s => s.slot === slot);
        // un boss ne porte rien de commun s'il y a mieux
        if (boss) { const better = candidates.filter(s => s.rarity !== 'common'); if (better.length) candidates = better; }
        if (!candidates.length) return;
        stuff[slot] = pickWeighted(candidates, s => 0.25 + Math.pow(s.minLevel / eff, 3), rng).id;
    });
    return stuff;
}

/** PV max apportés par les pièces portées par l'ennemi. */
export const enemyStuffMaxHp = enemy => wornStuff(enemy).reduce((sum, s) => sum + (s.maxHp || 0), 0);

/** Pièces portées (fiches du catalogue). */
export const enemyStuffPieces = enemy => (enemy?.stuff ? wornStuff(enemy) : []);

// Chance de récupérer chaque pièce portée, selon sa rareté (un boss : ×1,5).
export const ENEMY_STUFF_DROP_CHANCE = { common: 0.3, uncommon: 0.22, rare: 0.15, legendary: 0.1 };
const RANK = { common: 0, uncommon: 1, rare: 2, legendary: 3 };

/**
 * Pièces que le héros récupère en battant l'ennemi : chacune des pièces portées qu'il ne possède pas encore a sa chance.
 * Contre un ennemi de niveau supérieur (`gap` > 0), la meilleure pièce non possédée est garantie.
 */
export function rollEnemyStuffDrops(enemy, owner, { gap = 0, rng = Math.random } = {}) {
    const owned = new Set(owner?.stuffOwned || []);
    const pieces = enemyStuffPieces(enemy).filter(s => !owned.has(s.id));
    const mult = enemy?.isBoss ? 1.5 : 1;
    const drops = pieces.filter(s => rng() < (ENEMY_STUFF_DROP_CHANCE[s.rarity] || 0.2) * mult);
    if (gap > 0 && !drops.length && pieces.length) drops.push([...pieces].sort((a, b) => RANK[b.rarity] - RANK[a.rarity])[0]);
    return drops;
}

export { getStuffById };
