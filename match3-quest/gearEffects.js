// Effets de combat de l'équipement (arme, bouclier, casque, collier, bracelet, bague). Module pur (sans DOM).
//
// Une pièce peut porter `effects`, cumulés quand elle est portée (le héros seulement : un ennemi n'en tire aucun effet) :
//  - `vsStatus: { poisoned: 20 }`   : +% de dégâts infligés (armes, crânes, sorts) à un ennemi sous cette altération ;
//  - `spellBoost: { blue: 15 }`     : +% de dégâts des sorts de cette couleur (hors ultimes) ;
//  - `resist: { skull: 15 }`        : −% de dégâts subis selon la source : `skull` (crânes), `weapon` (armes), `spell` (sorts) ;
//  - `signatureReduce: 25`          : −% de dégâts de l'attaque signature d'un boss ;
//  - `parryQi: { chance: 35, amount: 2 }` : après un blocage ou une parade, `chance` % de récupérer `amount` qì d'une couleur au hasard ;
//  - `controlResist: { stunned: 100 }`    : % de chances de résister à cette altération (100 = immunité).

import { wornStuff } from './stuff.js';

export const RESIST_SOURCES = ['skull', 'weapon', 'spell'];
export const RESIST_LABELS = { skull: 'crânes', weapon: 'armes', spell: 'sorts' };
export const STATUS_LABELS = {
    poisoned: 'empoisonné', stunned: 'étourdi', weakened: 'affaibli', cursed: 'maudit', asleep: 'endormi', muted: 'muet',
    petrified: 'pétrifié', exhausted: 'épuisé', corrupted: 'corrompu', confused: 'confus', sealed: 'scellé', chilled: 'ralenti', burning: 'brûlé'
};
const COLOR_LABELS = { red: 'Feu', blue: 'Eau', green: 'Terre', yellow: 'Air', purple: 'Arcane' };
const CONTROL_LABELS = { stunned: "l'étourdissement", asleep: 'le sommeil', muted: 'le silence', petrified: 'la pétrification', cursed: 'la malédiction', exhausted: "l'épuisement", corrupted: 'la corruption', sealed: 'le scellement', chilled: 'le ralentissement', burning: 'la brûlure' };

export const RESIST_CAP = 60;
export const SIGNATURE_REDUCE_CAP = 60;

// Pièces portées par le héros (même liste que manaGear.js). Un ennemi (sans `stuffOwned`) n'a aucun effet.
const pieces = entity => {
    if (!entity || !Array.isArray(entity.stuffOwned)) return [];
    const gear = [entity.equippedWeapon, entity.weapon, entity.equipment?.rightHand, entity.equipment?.leftHand, entity.equipment?.item, ...wornStuff(entity)];
    return [...new Set(gear.filter(Boolean))];
};

const sumInto = (target, source) => Object.entries(source || {}).forEach(([k, v]) => { target[k] = (target[k] || 0) + (Number(v) || 0); });

/** Totaux des effets portés : { vsStatus, spellBoost, resist, signatureReduce, parryQi: { chance, amount }, controlResist }. */
export function gearEffectTotals(entity) {
    const t = { vsStatus: {}, spellBoost: {}, resist: {}, signatureReduce: 0, parryQi: { chance: 0, amount: 0 }, controlResist: {} };
    pieces(entity).forEach(p => {
        const e = p.effects;
        if (!e) return;
        sumInto(t.vsStatus, e.vsStatus);
        sumInto(t.spellBoost, e.spellBoost);
        sumInto(t.resist, e.resist);
        sumInto(t.controlResist, e.controlResist);
        t.signatureReduce += Number(e.signatureReduce) || 0;
        if (e.parryQi) { t.parryQi.chance += Number(e.parryQi.chance) || 0; t.parryQi.amount += Number(e.parryQi.amount) || 0; }
    });
    RESIST_SOURCES.forEach(k => { if (t.resist[k]) t.resist[k] = Math.min(RESIST_CAP, t.resist[k]); });
    t.signatureReduce = Math.min(SIGNATURE_REDUCE_CAP, t.signatureReduce);
    t.parryQi.chance = Math.min(100, t.parryQi.chance);
    Object.keys(t.controlResist).forEach(k => { t.controlResist[k] = Math.min(100, t.controlResist[k]); });
    return t;
}

const hasStatus = (e, key) => (e?.statusEffects?.[key] || 0) > 0;

/**
 * Dégâts infligés par le héros après ses effets d'équipement : { damage, notes }.
 * `colors` : couleurs du sort (vide hors sort) ; `ultimate` : les ultimes ne sont pas modifiés.
 */
export function boostedDamageDealt(hero, target, damage, { colors = [], ultimate = false } = {}) {
    const notes = [];
    if (damage <= 0 || ultimate) return { damage, notes };
    const t = gearEffectTotals(hero);
    let pct = 0;
    Object.entries(t.vsStatus).forEach(([status, p]) => { if (p > 0 && hasStatus(target, status)) { pct += p; notes.push(`${p} % contre un ennemi ${STATUS_LABELS[status] || status}`); } });
    [...new Set(colors)].forEach(c => { const p = t.spellBoost[c] || 0; if (p > 0) { pct += p; notes.push(`${p} % aux sorts de ${COLOR_LABELS[c] || c}`); } });
    if (pct <= 0) return { damage, notes };
    return { damage: damage + Math.max(1, Math.round(damage * pct / 100)), notes };
}

/** Dégâts subis par le héros après ses résistances (`source` : 'skull' | 'weapon' | 'spell'). Renvoie le nombre de points évités avec les dégâts. */
export function resistedDamageTaken(hero, damage, source) {
    const pct = gearEffectTotals(hero).resist[source] || 0;
    if (damage <= 0 || pct <= 0) return { damage, pct: 0 };
    return { damage: Math.max(1, Math.round(damage * (1 - pct / 100))), pct };
}

/** Réduction (0–1) des dégâts d'une attaque signature de boss. */
export const signatureReduction = hero => gearEffectTotals(hero).signatureReduce / 100;

/** Chance (0–100) de résister à une altération. */
export const controlResistChance = (entity, key) => gearEffectTotals(entity).controlResist[key] || 0;
export const resistsControl = (entity, key, rng = Math.random) => {
    const chance = controlResistChance(entity, key);
    return chance > 0 && rng() * 100 < chance;
};

/** Qì récupéré après un blocage ou une parade : { amount } (0 si le jet échoue). */
export function parryQiGain(hero, rng = Math.random) {
    const { chance, amount } = gearEffectTotals(hero).parryQi;
    return chance > 0 && amount > 0 && rng() * 100 < chance ? { amount } : { amount: 0 };
}

/** Effets d'une pièce en texte court (une entrée par effet), pour les fiches et les infobulles. */
export function describeEffects(piece) {
    const e = piece?.effects;
    if (!e) return [];
    const out = [];
    Object.entries(e.vsStatus || {}).forEach(([s, p]) => out.push(`Dégâts +${p} % vs ennemi ${STATUS_LABELS[s] || s}`));
    Object.entries(e.spellBoost || {}).forEach(([c, p]) => out.push(`Sorts de ${COLOR_LABELS[c] || c} +${p} %`));
    Object.entries(e.resist || {}).forEach(([s, p]) => out.push(`Dégâts de ${RESIST_LABELS[s] || s} −${p} %`));
    if (e.signatureReduce) out.push(`Attaques signatures −${e.signatureReduce} %`);
    if (e.parryQi) out.push(`Parade : ${e.parryQi.chance} % de gagner ${e.parryQi.amount} qì`);
    Object.entries(e.controlResist || {}).forEach(([k, p]) => out.push(p >= 100 ? `Immunisé contre ${CONTROL_LABELS[k] || k}` : `Résiste à ${CONTROL_LABELS[k] || k} (${p} %)`));
    return out;
}
