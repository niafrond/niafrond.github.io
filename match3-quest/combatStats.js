// Attaque / Défense : ce sont des probabilités, pas des dégâts.
//  - Attaque = chance de COUP CRITIQUE (×1,5) d'une attaque armée ou d'un match de crânes ;
//  - Défense = chance de BLOQUER une attaque armée ou un match de crânes subi : le blocage est total (aucun dégât)
//    ou partiel (dégâts divisés par 2).
// Les valeurs peuvent dépasser 100 à l'écran (cumul d'objets, de sorts, de niveaux) mais la chance réelle reste
// plafonnée à STAT_CHANCE_CAP (98 %). Les sorts ne sont ni bloqués ni critiques. Module pur, sans DOM.

import { getAttributePoints } from "./attributes.js";
import { stuffTotals } from "./stuff.js";

export const STAT_CHANCE_CAP = 98;
export const CRIT_MULTIPLIER = 1.5;
export const PARTIAL_BLOCK_FACTOR = 0.5;   // dégâts restants après un blocage partiel
export const TOTAL_BLOCK_SHARE = 0.4;      // part des blocages qui sont totaux (le reste est partiel)
export const SKULL_STRENGTH_DIVISOR = 2;   // 1 dégât de plus par crâne tous les 2 points de force
export const SKULL_STRENGTH_BONUS_CAP = 6;

// Avantage caché du plus haut niveau : `entity.levelEdge` = écart de niveau en sa faveur (posé au début du combat, voir newEnemy).
// Il multiplie son attaque et sa défense (×1,35 à 1 niveau, ×1,8 à 2, ×3,6 à 4, ×4 au plus) et y ajoute 5 points par niveau d'écart :
// il crite et bloque bien plus souvent, donc frappe et encaisse mieux. Jamais affiché (rawAttack / rawDefense l'ignorent), aucun
// malus pour le plus faible.
export const LEVEL_EDGE_MAX_MULT = 4;
export const LEVEL_EDGE_FLAT_PER_LEVEL = 5;
export function levelEdgeBonus(entity, raw) {
    const gap = Math.max(0, Math.floor(Number(entity?.levelEdge) || 0));
    if (gap === 0) return raw;
    const mult = Math.min(LEVEL_EDGE_MAX_MULT, 1 + 0.25 * gap + 0.1 * gap * gap);
    return Math.floor(raw * mult) + LEVEL_EDGE_FLAT_PER_LEVEL * gap;
}

const clampChance = value => Math.max(0, Math.min(STAT_CHANCE_CAP, Math.floor(Number(value) || 0)));

// Bonus d'Atk/Déf apportés par l'arme en main droite/gauche et le bouclier (champs `atkBonus` / `defBonus`).
// Les `defense` historiques des boucliers sont déjà ajoutées à entity.defense à l'équipement : on ne les recompte pas.
export function gearBonus(entity, stat) {
    const key = stat === 'attack' ? 'atkBonus' : 'defBonus';
    const gear = [entity?.equippedWeapon, entity?.weapon, entity?.equipment?.leftHand, entity?.equipment?.item];
    const seen = new Set();
    const worn = gear.reduce((sum, piece) => {
        if (!piece || seen.has(piece)) return sum;
        seen.add(piece);
        return sum + Math.max(0, Math.floor(piece[key] || 0));
    }, 0);
    // Casque, collier, bracelet et bague (stuff.js) : seulement pour qui en porte (le héros).
    const totals = entity?.stuff ? stuffTotals(entity) : null;
    return worn + (totals ? (stat === 'attack' ? totals.atk : totals.def) : 0);
}

// Bonus temporaires (sorts, `entity.statBuffs = { attack: { amount, turns }, defense: { amount, turns } }`) : ils ne modifient pas
// entity.attack / entity.defense, expirent d'eux-mêmes (tickStatBuffs, une fois par tour du porteur) et disparaissent en fin de combat.
/** Flèches gagnées par tour grâce à l'armure antique des Jarres : `pct` % du coût en flèches de l'arme active la plus chère, au moins 1. */
export function ancientArrowGain(pct, weapons) {
    const costliest = Math.max(0, ...weapons.filter(Boolean).map(w => w.actionPoints || 0));
    return Math.max(1, Math.round(costliest * pct / 100));
}

export function statBuffAmount(entity, stat) {
    const buff = entity?.statBuffs?.[stat];
    return buff && buff.turns > 0 ? Math.max(0, Math.floor(buff.amount || 0)) : 0;
}

// Pose un bonus temporaire d'Atk et/ou de Déf pour `turns` tours. Les lancers se CUMULENT : chacun garde sa propre durée
// (`stacks`), `amount` est la somme des bonus encore actifs et `turns` la durée restante la plus longue.
export function addStatBuff(entity, { attack = 0, defense = 0, turns = 1 } = {}) {
    if (!entity.statBuffs) entity.statBuffs = {};
    const duration = Math.max(1, Math.floor(turns || 1));
    for (const [stat, amount] of [['attack', attack], ['defense', defense]]) {
        const value = Math.max(0, Math.floor(amount || 0));
        if (value <= 0) continue;
        const current = entity.statBuffs[stat];
        const stacks = current && current.turns > 0 ? [...(current.stacks || [{ amount: current.amount, turns: current.turns }]), { amount: value, turns: duration }] : [{ amount: value, turns: duration }];
        entity.statBuffs[stat] = summarizeStacks(stacks);
    }
    return entity.statBuffs;
}

const summarizeStacks = stacks => ({ amount: stacks.reduce((n, st) => n + st.amount, 0), turns: Math.max(...stacks.map(st => st.turns)), stacks });

/**
 * Effet de statut à durée cumulable (Peau de Jade, Force, Rempart, Fureur, Miroir…) : le bonus s'ajoute à celui encore actif (plafonné par `cap`),
 * la durée restante devient la plus longue des deux. L'expiration retire alors la somme. Renvoie le bonus ajouté réellement.
 */
export function stackStatusEffect(effects, turnKey, valueKey, turns, value, cap = Infinity) {
    const active = (effects[turnKey] || 0) > 0;
    const before = active ? Math.max(0, Math.floor(effects[valueKey] || 0)) : 0;
    const total = Math.min(cap, before + Math.max(0, Math.floor(value || 0)));
    effects[turnKey] = Math.max(active ? effects[turnKey] : 0, Math.max(1, Math.floor(turns || 1)));
    effects[valueKey] = total;
    return total - before;
}

// Décompte d'un tour : renvoie les stats ('attack' | 'defense') dont le bonus vient de se terminer.
export function tickStatBuffs(entity) {
    const expired = [];
    for (const stat of ['attack', 'defense']) {
        const buff = entity?.statBuffs?.[stat];
        if (!buff) continue;
        const stacks = (buff.stacks || [{ amount: buff.amount, turns: buff.turns }]).map(st => ({ ...st, turns: st.turns - 1 })).filter(st => st.turns > 0);
        if (stacks.length === 0) { delete entity.statBuffs[stat]; expired.push(stat); } else entity.statBuffs[stat] = summarizeStacks(stacks);
    }
    return expired;
}

export function clearStatBuffs(entity) {
    if (entity) entity.statBuffs = {};
}

// « +20 % d'attaque et +10 % de défense pendant 3 tours » (journal / animation).
export function describeStatBuff({ attack = 0, defense = 0, turns = 1 } = {}) {
    const parts = [attack > 0 ? `+${attack} % d'attaque` : '', defense > 0 ? `+${defense} % de défense` : ''].filter(Boolean);
    return `${parts.join(' et ')} pendant ${turns} tour${turns > 1 ? 's' : ''}`;
}

// Valeurs affichées (non plafonnées).
export function rawAttack(entity) {
    return Math.max(0, Math.floor(entity?.attack || 0)) + gearBonus(entity, 'attack') + statBuffAmount(entity, 'attack')
        + Math.max(0, Math.floor(entity?.critChance || 0)) + Math.max(0, Math.floor(entity?.tempCritChance || 0));
}
export function rawDefense(entity) {
    return Math.max(0, Math.floor(entity?.defense || 0)) + gearBonus(entity, 'defense') + statBuffAmount(entity, 'defense');
}

// Attaque affichée : attaque brute moins le malus d'affaiblissement en cours (Sceau d'Affaiblissement).
export function displayAttack(entity) {
    const weakened = (entity?.statusEffects?.weakened || 0) > 0 ? Math.max(0, Math.floor(entity.statusEffects.weakenedAmount || 0)) : 0;
    return Math.max(0, rawAttack(entity) - weakened);
}

// Part temporaire (sorts, effets) comprise dans la valeur affichée d'Attaque / de Défense : > 0 bonus (affiché en vert), < 0 malus (en rouge).
// Reprend ce que rawAttack / rawDefense additionnent (bonus de sorts), ce que Force / Peau de Jade ajoutent directement à la stat de base, et l'affaiblissement.
export function statModifier(entity, stat) {
    const fx = entity?.statusEffects || {};
    const on = key => (fx[key] || 0) > 0;
    if (stat === 'attack') {
        const weakened = on('weakened') ? Math.max(0, Math.floor(fx.weakenedAmount || 0)) : 0;
        return statBuffAmount(entity, 'attack') + Math.max(0, Math.floor(entity?.tempCritChance || 0)) + Math.floor(entity?.tempAttack || 0)
            + (on('strength') ? Math.floor(fx.strengthBonus || 0) : 0) - weakened;
    }
    return statBuffAmount(entity, 'defense') + Math.floor(entity?.tempDefense || 0) + (on('stoneskin') ? Math.floor(fx.stoneskinDefense || 0) : 0);
}

// Chances réelles (plafonnées à 98 %). `weakened` : points d'attaque retirés (Sceau d'Affaiblissement).
export function critChance(entity, weakened = 0) {
    return clampChance(levelEdgeBonus(entity, rawAttack(entity)) - Math.max(0, Math.floor(weakened || 0)));
}
export function blockChance(entity) {
    return clampChance(levelEdgeBonus(entity, rawDefense(entity)));
}

export function rollCrit(entity, rng = Math.random, weakened = 0) {
    return rng() * 100 < critChance(entity, weakened);
}

// 'none' | 'partial' | 'total'
export function rollBlock(entity, rng = Math.random) {
    if (!(rng() * 100 < blockChance(entity))) return 'none';
    return rng() < TOTAL_BLOCK_SHARE ? 'total' : 'partial';
}

export function applyBlock(damage, outcome) {
    const dmg = Math.max(0, Math.floor(damage || 0));
    if (outcome === 'total') return 0;
    if (outcome === 'partial') return Math.max(1, Math.floor(dmg * PARTIAL_BLOCK_FACTOR));
    return dmg;
}

export function applyCrit(damage) {
    return Math.floor(Math.max(0, damage || 0) * CRIT_MULTIPLIER);
}

// Dégâts supplémentaires par crâne dus à la force (points d'attribut « Battle »).
export function skullStrengthBonus(entity) {
    return Math.min(SKULL_STRENGTH_BONUS_CAP, Math.floor(getAttributePoints(entity, 'strength') / SKULL_STRENGTH_DIVISOR));
}

// Attaque (arme ou crânes) complète : critique puis blocage de la cible. Renvoie { damage, crit, block }.
export function resolveStrike(rawDamage, attacker, target, { rng = Math.random, weakened = 0 } = {}) {
    let damage = Math.max(0, Math.floor(rawDamage || 0));
    // Fureur des Steppes : bonus fixe ajouté à chaque dégât infligé par le lanceur (crânes, armes, sorts). Il suit le critique
    // de l'attaque (même jet), mais échappe au blocage : l'attaque peut être parée ou bloquée, pas le bonus.
    const enrageBonus = damage > 0 && (attacker?.statusEffects?.enraged || 0) > 0 ? Math.max(0, Math.floor(attacker.statusEffects.enragedBonus || 0)) : 0;
    const crit = rollCrit(attacker, rng, weakened);
    if (crit) damage = applyCrit(damage);
    const bonus = crit ? applyCrit(enrageBonus) : enrageBonus;
    const block = rollBlock(target, rng);
    damage = applyBlock(damage, block) + bonus;
    return { damage, crit, block };
}

// Libellé d'un blocage pour le journal / l'animation.
export function blockLabel(block) {
    return block === 'total' ? 'BLOQUÉ !' : block === 'partial' ? 'paré' : '';
}
