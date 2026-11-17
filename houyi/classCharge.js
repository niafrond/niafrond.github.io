// Temps de chargement des classes (et de l'ennemi) : une chronologie commune. Module pur (aucun accès au DOM).
// Chaque classe du héros et l'ennemi ont une date de « prêt » ; après avoir agi, un acteur se recharge `chargeTime` unités.
// Le prochain à jouer est le premier prêt : une classe rapide ou plusieurs classes alternées peuvent donc jouer plus souvent que l'ennemi.
// Égalité : l'acteur qui n'a pas joué en dernier passe (le tour par tour d'avant est conservé quand tout est égal).
import { ATTRIBUTE_MANA_RULES, getAttributePoints, agilityScore } from './attributes.js';
import { skillBonus } from './skills.js';

export const CHARGE_BASE = 100;          // temps de chargement sans aucun bonus
export const CHARGE_MIN = 40;            // plancher : jamais plus de 60 % de réduction
const AGILITY_PCT = 0.5;                 // % de réduction par point d'Agilité + Moral (toutes les classes)
const CLASS_ATTR_PCT = 0.4;              // % par point de l'attribut propre à la classe
const QI_PCT = 0.3;                      // % par qì de la couleur de la classe
const ENEMY_LEVEL_PCT = 0.4;             // % par niveau de l'ennemi (en plus de son agilité)

/** Attribut qui rend une classe rapide (sa couleur de qì accélère aussi son chargement). */
export const CLASS_SPEED_ATTRIBUTE = {
    assassin: 'agility', barbarian: 'strength', templar: 'stamina', sorcerer: 'intelligence',
    monk: 'morale', alchemist: 'intelligence', shaman: 'morale'
};

const clampTime = pct => Math.max(CHARGE_MIN, Math.round(CHARGE_BASE * (1 - pct / 100)));

/** Détail du temps de chargement d'une classe du héros : { time, pct: {agility, attribute, qi, skills} }. */
export function classChargeInfo(hero, classId) {
    const attr = CLASS_SPEED_ATTRIBUTE[classId] || 'agility';
    const color = ATTRIBUTE_MANA_RULES[attr]?.color;
    const pct = {
        agility: agilityScore(hero) * AGILITY_PCT,
        attribute: getAttributePoints(hero, attr) * CLASS_ATTR_PCT,
        qi: Math.max(0, Math.floor(hero?.mana?.[color] || 0)) * QI_PCT,
        skills: skillBonus(hero, 'chargePct')
    };
    const total = pct.agility + pct.attribute + pct.qi + pct.skills;
    return { time: clampTime(total), pct };
}

export const classChargeTime = (hero, classId) => classChargeInfo(hero, classId).time;

/** Temps de chargement de l'ennemi : son niveau et son agilité (il n'a pas de classe). */
export function enemyChargeTime(enemy) {
    return clampTime((enemy?.level || 0) * ENEMY_LEVEL_PCT + agilityScore(enemy) * AGILITY_PCT);
}

/** Nouvelle chronologie : tout le monde est prêt à l'instant 0. */
export const newCharge = () => ({ clock: 0, ready: {}, enemyReady: 0, last: null });

const readyAt = (charge, id) => charge.ready[id] ?? 0;

/** Classes du héros prêtes maintenant (parmi `usable`). */
export const readyClasses = (charge, usable) => usable.filter(id => readyAt(charge, id) <= charge.clock);

export const isClassReady = (charge, id) => readyAt(charge, id) <= charge.clock;

/** Part de chargement d'une classe (0..1) : 1 = prête. */
export function classProgress(charge, hero, id) {
    const left = readyAt(charge, id) - charge.clock;
    return left <= 0 ? 1 : Math.max(0, 1 - left / classChargeTime(hero, id));
}

/** Le héros a joué avec `classId` : elle se recharge. */
export function playerActed(charge, hero, classId) {
    charge.ready[classId] = charge.clock + classChargeTime(hero, classId);
    charge.last = 'player';
}

/** L'ennemi a joué : il se recharge. */
export function enemyActed(charge, enemy) {
    charge.enemyReady = charge.clock + enemyChargeTime(enemy);
    charge.last = 'enemy';
}

/** Qui joue ensuite ? Fait avancer l'horloge jusqu'au premier prêt. Retourne 'player' ou 'enemy'. */
export function nextActor(charge, usable) {
    const pool = usable.length ? usable : Object.keys(charge.ready);
    const playerAt = pool.length ? Math.min(...pool.map(id => readyAt(charge, id))) : charge.clock;
    let side;
    if (playerAt < charge.enemyReady) side = 'player';
    else if (charge.enemyReady < playerAt) side = 'enemy';
    else side = charge.last === 'player' ? 'enemy' : 'player';
    charge.clock = Math.max(charge.clock, side === 'player' ? playerAt : charge.enemyReady);
    return side;
}
