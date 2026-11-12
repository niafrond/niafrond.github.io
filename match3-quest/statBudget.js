// Budget des statistiques en pourcentage : Attaque (critique), Défense (blocage) et réserve de qì par couleur ont un MAXIMUM de 100.
// Il doit être atteint naturellement au niveau maximal (70) par un héros qui met tous ses points dans la statistique et porte le
// meilleur équipement, et ne jamais être dépassé avant (surtout pas dès le niveau 20, l'équipement s'ajoutant aux points).
//   Attaque : 15 (départ) + 69 points (Battle, +1) + 16 d'équipement (armes, boucliers, stuff, reliques) = 100
//   Défense :  0 (départ) + 69 points (Agilité ou Moral, +1) + 31 d'équipement = 100
//   Qì      : 50 (réserve de base) + 23 (+1 tous les 3 points d'Intelligence pour le bleu, etc.) + 27 d'équipement = 100
// Reliques : on n'en porte que `relicSlots(niveau)` (3 au niveau 1, 10 au niveau 70, items.js), une seule par identifiant ; le budget
// retient les meilleures pour la statistique. Compromis : un équipement peut avoir un bonus négatif (beaucoup d'Atk contre de la Déf) ; le budget ne retient
// que le meilleur bonus POSITIF de chaque emplacement, la pénalité n'est qu'un coût en plus pour l'autre statistique.
// Objets à compromis (un bonus négatif ailleurs) : HORS du budget ci-dessus, car leur gros bonus (2 à 3 fois celui d'une pièce normale)
// se paie par un malus d'au moins la moitié du bonus : un héros peut ainsi atteindre 100 plus tôt (ou dépasser le plafond réel,
// 98 % de critique, 75 % de blocage) mais sacrifie une autre statistique. Voir tradeoffPieces et les tests.
// Hors budget : les bonus temporaires (sorts, potions) et l'avantage de niveau d'un combat (levelEdge), qui peuvent dépasser 100 à
// l'écran (la chance réelle reste plafonnée : combatStats.js). Module pur, sans DOM.

import { MAX_LEVEL } from './experience.js';
import { manaBonusFor } from './attributes.js';
import { allWeapons } from './weapons.js';
import { allItems, relicSlots } from './items.js';
import { allStuff, STUFF_SLOTS } from './stuff.js';

export const STAT_MAX = 100;
export const START_ATTACK = 15;
export const START_DEFENSE = 0;
export const START_MANA_CAP = 50;

// Valeur d'un équipement pour la statistique : atk (atkBonus), def (defBonus + `defense` d'un bouclier), qi (plus gros manaMax d'une couleur).
const gearValue = {
    atk: piece => Math.floor(piece.atkBonus || 0),
    def: piece => Math.floor(piece.defBonus || 0) + (piece.type === 'shield' ? Math.floor(piece.defense || 0) : 0),
    qi: piece => Math.max(0, ...Object.values(piece.manaMax || {}).map(n => Math.floor(n || 0)))
};
const permValue = {
    atk: effect => Math.floor(effect.permAttack || 0) + Math.floor(effect.permCritChance || 0),
    def: effect => Math.floor(effect.permDefense || 0),
    qi: effect => Math.floor(effect.permMaxMana || 0)
};

/** Plus grand total d'équipement qu'un héros de niveau `level` peut cumuler pour `stat` : arme en main droite + arme ou bouclier en
 *  main gauche, un stuff par emplacement, toutes les reliques permanentes. */
const hasPenalty = piece => (piece.atkBonus || 0) < 0 || (piece.defBonus || 0) < 0;

/** Plus grand total d'équipement SANS compromis (voir plus bas). */
export function maxGearBonus(stat, level) {
    const value = gearValue[stat];
    const best = list => Math.max(0, ...list.map(value));
    const weapons = allWeapons.filter(w => w.minLevel <= level && !hasPenalty(w)).map(value).sort((a, b) => b - a);
    const shields = allItems.filter(i => i.type === 'shield' && i.minLevel <= level && !hasPenalty(i));
    const hands = (weapons[0] || 0) + Math.max(weapons[1] || 0, best(shields));
    const worn = STUFF_SLOTS.reduce((sum, slot) => sum + best(allStuff.filter(p => p.slot === slot && p.minLevel <= level && !hasPenalty(p))), 0);
    // reliques : un héros spécialisé porte les `relicSlots(level)` meilleures pour cette statistique (une par identifiant)
    const relics = allItems.filter(i => i.type === 'artifact' && i.minLevel <= level && i.effect).map(i => permValue[stat](i.effect))
        .sort((a, b) => b - a).slice(0, relicSlots(level)).reduce((sum, n) => sum + n, 0);
    return hands + worn + relics;
}

/** Valeur maximale de `stat` ('atk' | 'def' | 'qi') au niveau `level` : tous les points (1 par niveau) dans la statistique + meilleur équipement. */
export function maxStatAtLevel(stat, level) {
    const points = Math.max(0, Math.min(MAX_LEVEL, Math.floor(level)) - 1);
    if (stat === 'qi') return START_MANA_CAP + manaBonusFor('intelligence', points, 'max') + maxGearBonus('qi', level);
    return (stat === 'atk' ? START_ATTACK : START_DEFENSE) + points + maxGearBonus(stat, level);
}

/** Pièces à compromis (stuff et boucliers) : bonus fort contre malus. */
export const tradeoffPieces = () => [...allStuff, ...allItems.filter(i => i.type === 'shield')].filter(hasPenalty);

/** { gain, cost } d'une pièce à compromis : gain = bonus positifs (Atk, Déf, défense de bouclier, qì max) ; coût = malus (valeurs absolues). */
export function tradeoffValue(piece) {
    const gain = Math.max(0, piece.atkBonus || 0) + Math.max(0, piece.defBonus || 0) + (piece.type === 'shield' ? Math.max(0, piece.defense || 0) : 0)
        + (piece.manaMax ? Math.max(...Object.values(piece.manaMax)) : 0);
    const cost = Math.max(0, -(piece.atkBonus || 0)) + Math.max(0, -(piece.defBonus || 0));
    return { gain, cost };
}
