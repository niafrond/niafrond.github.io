// Aperçu d'un équipement chez le marchand : stats globales du héros avant / après avoir porté la pièce à la place de celle équipée.
// Module pur (sans DOM) : calcule sur une copie du héros, ne modifie jamais `hero`.

import { rawAttack, rawDefense } from './combatStats.js';
import { getStuffById } from './stuff.js';
import { MANA_COLORS, MANA_LABELS, gearManaBonus } from './manaGear.js';

/** Pièce actuellement portée à l'emplacement que `obj` occuperait (null si vide ou si la pièce n'est pas équipable). */
export function equippedCounterpart(hero, kind, obj) {
    if (kind === 'stuff') return getStuffById(hero.stuff?.[obj.slot]) || null;
    if (kind === 'weapon') return hero.equippedWeapon || null;
    if (kind === 'item' && obj.type === 'shield') return hero.equipment?.leftHand?.type === 'shield' ? hero.equipment.leftHand : null;
    return null;
}

export const isComparable = (kind, obj) => kind === 'stuff' || kind === 'weapon' || (kind === 'item' && obj?.type === 'shield');

const manaCaps = entity => Object.fromEntries(MANA_COLORS.map(c => [c, Math.max(0, Math.floor(entity.maxMana ?? 50)) + gearManaBonus(entity, c)]));

/** Stats globales après avoir équipé `obj` : { attack, defense, maxHp, mana: { couleur: qì max } }. */
export function statsWith(hero, kind, obj) {
    const clone = { ...hero, equipment: { ...(hero.equipment || {}) }, stuff: { ...(hero.stuff || {}) } };
    const current = equippedCounterpart(hero, kind, obj);
    let maxHp = hero.maxHp || 0;
    if (kind === 'stuff') {
        clone.stuff[obj.slot] = obj.id;
        maxHp += (obj.maxHp || 0) - (current?.maxHp || 0);
    } else if (kind === 'weapon') {
        clone.equippedWeapon = obj;
        if (obj.twoHanded) clone.equipment.leftHand = null;   // une arme à deux mains libère la main gauche
    } else {
        clone.equipment.leftHand = obj;
        // La défense de base d'un bouclier est ajoutée à `defense` à l'équipement (game.js : equipGear).
        clone.defense = Math.max(0, (hero.defense || 0) - (current?.defense || 0) + (obj.defense || 0));
    }
    return { attack: rawAttack(clone), defense: rawDefense(clone), maxHp, mana: manaCaps(clone) };
}

/** Lignes { label, before, after, delta } sur les stats globales du héros. */
export function previewEquip(hero, kind, obj) {
    const before = { attack: rawAttack(hero), defense: rawDefense(hero), maxHp: hero.maxHp || 0, mana: manaCaps(hero) };
    const after = statsWith(hero, kind, obj);
    const row = (label, b, a) => ({ label, before: b, after: a, delta: a - b });
    // Qì max : une ligne par couleur qui change, sinon une seule ligne (inchangé).
    const changed = MANA_COLORS.filter(c => before.mana[c] !== after.mana[c]);
    const manaRows = changed.length
        ? changed.map(c => row(`Qì max ${MANA_LABELS[c]}`, before.mana[c], after.mana[c]))
        : [row('Qì max', before.mana.red, after.mana.red)];
    return [row('Attaque', before.attack, after.attack), row('Défense', before.defense, after.defense), row('PV max', before.maxHp, after.maxHp), ...manaRows];
}
