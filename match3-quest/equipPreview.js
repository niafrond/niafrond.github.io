// Aperçu d'un équipement chez le marchand : stats globales du héros avant / après avoir porté la pièce à la place de celle équipée.
// Module pur (sans DOM) : calcule sur une copie du héros, ne modifie jamais `hero`.

import { rawAttack, rawDefense } from './combatStats.js';
import { getStuffById } from './stuff.js';

/** Pièce actuellement portée à l'emplacement que `obj` occuperait (null si vide ou si la pièce n'est pas équipable). */
export function equippedCounterpart(hero, kind, obj) {
    if (kind === 'stuff') return getStuffById(hero.stuff?.[obj.slot]) || null;
    if (kind === 'weapon') return hero.equippedWeapon || null;
    if (kind === 'item' && obj.type === 'shield') return hero.equipment?.leftHand?.type === 'shield' ? hero.equipment.leftHand : null;
    return null;
}

export const isComparable = (kind, obj) => kind === 'stuff' || kind === 'weapon' || (kind === 'item' && obj?.type === 'shield');

// Qì max apporté par une pièce (champ `maxMana`, aucune pièce actuelle n'en donne : la ligne reste à l'identique).
const manaOf = piece => Math.max(0, Math.floor(piece?.maxMana || 0));

/** Stats globales après avoir équipé `obj` : { attack, defense, maxHp, maxMana }. */
export function statsWith(hero, kind, obj) {
    const clone = { ...hero, equipment: { ...(hero.equipment || {}) }, stuff: { ...(hero.stuff || {}) } };
    const current = equippedCounterpart(hero, kind, obj);
    let maxHp = hero.maxHp || 0, maxMana = hero.maxMana || 0;
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
    maxMana += manaOf(obj) - manaOf(current);
    return { attack: rawAttack(clone), defense: rawDefense(clone), maxHp, maxMana };
}

/** Lignes { label, before, after, delta } sur les stats globales du héros. */
export function previewEquip(hero, kind, obj) {
    const before = { attack: rawAttack(hero), defense: rawDefense(hero), maxHp: hero.maxHp || 0, maxMana: hero.maxMana || 0 };
    const after = statsWith(hero, kind, obj);
    const row = (label, key) => ({ label, before: before[key], after: after[key], delta: after[key] - before[key] });
    return [row('Attaque', 'attack'), row('Défense', 'defense'), row('PV max', 'maxHp'), row('Qì max', 'maxMana')];
}
