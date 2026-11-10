// Croissance des ennemis : un monstre de niveau N est généré comme s'il avait fait N − 1 montées de niveau, chacune avec son point
// d'attribut dépensé selon sa nature (classe, couleur de qì préférée), comme le fait le joueur (gameLevelUp.js). Module pur (sans DOM).
//
// Un monstre peut avoir fait « un peu plus » de montées que son niveau ne l'annonce (`extraLevelUps`). Les statistiques en découlent :
//  - Force → attaque (+1 chacune), Agilité et Moral → défense (+1 chacune), Endurance → PV max (+1 chacune) ; Intelligence → puissance
//    magique et qì (appliqués par game.js comme pour le héros) ;
//  - croissance innée de PV après le niveau 20, identique à celle du héros (progression.js, growthExtras).

import { growthExtras } from './progression.js';

export const ATTRIBUTE_KEYS = ['strength', 'agility', 'intelligence', 'stamina', 'morale'];

// Goûts d'attributs de chaque classe (poids relatifs d'un choix à chaque montée).
export const CLASS_ATTRIBUTE_WEIGHTS = {
    sorcerer: { strength: 1, agility: 1, intelligence: 3, stamina: 1, morale: 2 },
    assassin: { strength: 2, agility: 3, intelligence: 1, stamina: 1, morale: 1 },
    templar: { strength: 1, agility: 1.5, intelligence: 0.5, stamina: 3, morale: 2 },
    barbarian: { strength: 3, agility: 1, intelligence: 0.5, stamina: 2, morale: 1 }
};
// Couleur de qì préférée → attribut associé (attributes.js : ATTRIBUTE_MANA_RULES).
export const COLOR_ATTRIBUTE = { red: 'strength', yellow: 'agility', blue: 'intelligence', green: 'stamina', purple: 'morale' };
const COLOR_BONUS_WEIGHT = 2;
export const ENEMY_HP_PER_LEVEL = 12;   // PV de base gagnés par niveau (enemies.js : 55 + 12 × niveau), aussi pour les montées en plus

/** Nombre de montées de niveau « en plus » d'un monstre (0 à ~10 % de son niveau, +1 pour un boss). */
export function extraLevelUps(level, { boss = false, rng = Math.random } = {}) {
    return Math.floor(rng() * (1 + Math.max(0, level) / 10)) + (boss ? 1 : 0);
}

function pickWeighted(weights, rng) {
    const total = ATTRIBUTE_KEYS.reduce((s, k) => s + weights[k], 0);
    let r = rng() * total;
    for (const k of ATTRIBUTE_KEYS) if ((r -= weights[k]) < 0) return k;
    return ATTRIBUTE_KEYS[ATTRIBUTE_KEYS.length - 1];
}

/**
 * Répartit les points de `levelUps` montées de niveau.
 * @returns {{strength,agility,intelligence,stamina,morale}}
 */
export function allocateAttributes(levelUps, { playerClass, preferredColor, rng = Math.random } = {}) {
    const weights = { ...(CLASS_ATTRIBUTE_WEIGHTS[playerClass] || { strength: 1, agility: 1, intelligence: 1, stamina: 1, morale: 1 }) };
    const favorite = COLOR_ATTRIBUTE[preferredColor];
    if (favorite) weights[favorite] += COLOR_BONUS_WEIGHT;
    const attributes = { strength: 0, agility: 0, intelligence: 0, stamina: 0, morale: 0 };
    for (let i = 0; i < Math.max(0, Math.floor(levelUps)); i++) attributes[pickWeighted(weights, rng)]++;
    return attributes;
}

/**
 * Statistiques d'un monstre de niveau `level` après `levelUps` montées.
 * @returns {{ attributes, attack, defense, hpBonus, levelUps }} `attack`/`defense` s'ajoutent à la base du gabarit ; `hpBonus` aux PV de base
 * (Endurance, croissance innée après le niveau 20, PV des montées en plus)
 */
export function growEnemy(level, { playerClass, preferredColor, boss = false, rng = Math.random } = {}) {
    const lvl = Math.max(1, Math.floor(level) || 1);
    const extra = extraLevelUps(lvl, { boss, rng });
    const levelUps = Math.max(0, lvl - 1) + extra;
    const attributes = allocateAttributes(levelUps, { playerClass, preferredColor, rng });
    const innate = growthExtras(1, 1 + levelUps);
    return {
        levelUps,
        attributes,
        attack: attributes.strength,   // la croissance innée d'attaque du héros (niveau 18+) vient de ses armes et armures : un monstre n'en a pas, son critique reste raisonnable
        defense: attributes.agility + attributes.morale,
        hpBonus: attributes.stamina + innate.maxHp + extra * ENEMY_HP_PER_LEVEL
    };
}

// PV max que le héros aurait au niveau `level`, estimés d'après son état actuel : chaque niveau d'écart apporte +5 PV (gain de base), +1 (un point
// d'Endurance) et +5 de plus au-delà du niveau 20 (progression.js). Sert à garder les ennemis générés plus costauds que le héros du niveau suivant.
export const HERO_HP_PER_LEVEL = 6;
export function heroMaxHpAtLevel(heroMaxHp, heroLevel, level) {
    const from = Math.max(1, Math.floor(heroLevel) || 1), to = Math.max(1, Math.floor(level) || 1);
    const step = lvl => HERO_HP_PER_LEVEL + (lvl > 20 ? 5 : 0);   // gain du passage au niveau `lvl`
    let hp = Math.max(1, Math.floor(heroMaxHp) || 1);
    for (let lvl = from + 1; lvl <= to; lvl++) hp += step(lvl);
    for (let lvl = from; lvl > to; lvl--) hp -= step(lvl);
    return Math.max(1, hp);
}

/**
 * Relève les PV max d'un ennemi généré pour qu'ils dépassent ceux du héros au niveau supérieur (niveau de l'ennemi + 1).
 * Un ennemi « facile » (moins de PV que le héros par construction) n'est pas touché. Renvoie les PV max ajoutés.
 */
export function raiseEnemyHpAboveHero(enemy, hero) {
    if (!enemy || !hero || enemy.isEasyChoice) return 0;
    const target = heroMaxHpAtLevel(hero.maxHp, hero.level, (enemy.level || 1) + 1) + 1;
    const current = Math.max(1, Math.floor(enemy.maxHp) || 1);
    if (current >= target) return 0;
    enemy.maxHp = target;
    enemy.hp = target;   // l'ennemi généré démarre le combat en pleine forme : pas de PV perdus conservés
    return target - current;
}
