// Compagnons de combat : l'équipe de Hou Yi. Chaque compagnon porte UNE classe (les six maîtres de classe recrutés au fil de l'histoire) ; Hou Yi est
// le Chasseur. Module pur (sans DOM). Ne pas confondre avec les « esprits gardiens » (ex-compagnons de route : Xiao Gui, Zhi, Dawa… : companions.js).
//
//  - Équipe de combat : Hou Yi + 3 compagnons au plus (MAX_USABLE_CLASSES de classRoster.js = 4), choisie hors combat (onglet Compétences).
//  - Chaque compagnon a sa barre de vie (part des PV max de Hou Yi, `hpPct`), sa barre de chargement (sa classe) et ses sorts, compétences de classe et
//    Xiūxiān ; TOUS partagent le qì de Hou Yi.
//  - L'ennemi peut les viser (une action ennemie sur quatre vise un compagnon vivant, au hasard) ; à 0 PV un compagnon est hors de combat jusqu'à la fin :
//    sa classe ne charge plus et ne peut plus agir. Ils sont de nouveau en pleine forme au combat suivant. Hou Yi à terre = défaite.
//  - Recrutement : l'entraînement du maître de classe (world/classTrials.js) ; le maître rejoint l'équipe à la fin de la quête. Un compagnon dans la 1re
//    région (Rizières : Frère Ming), deux dans la 2e (Volcan : Tu le Briseur et Dame Dan), puis un par région (Gobi : Heng, Fleuve : Xuan, Bambous : Wu Po).
import { START_CLASS, normalizeRoster } from './classRoster.js';

export const ALLIES = {
    barbarian: { id: 'barbarian', name: 'Tu le Briseur', short: 'Tu', title: 'Maître des poings de roche', npc: 'trainer_barbarian', sprite: 'ally_barbarian', weapon: 'axe', region: 'volcan', hpPct: 0.9, defensePct: 0.8 },
    templar: { id: 'templar', name: 'Capitaine Heng', short: 'Heng', title: 'Maître de la garde', npc: 'trainer_templar', sprite: 'ally_templar', weapon: 'sword', region: 'gobi', hpPct: 1, defensePct: 1 },
    sorcerer: { id: 'sorcerer', name: 'Maître Xuan', short: 'Xuan', title: 'Taoïste du gué', npc: 'trainer_sorcerer', sprite: 'ally_sorcerer', weapon: 'staff', region: 'fleuve', hpPct: 0.5, defensePct: 0.3 },
    monk: { id: 'monk', name: 'Frère Ming', short: 'Ming', title: 'Moine des cendres', npc: 'trainer_monk', sprite: 'ally_monk', weapon: 'mace', region: 'rizieres', hpPct: 0.7, defensePct: 0.6 },
    alchemist: { id: 'alchemist', name: 'Dame Dan', short: 'Dan', title: 'Alchimiste des orages', npc: 'trainer_alchemist', sprite: 'ally_alchemist', weapon: 'dagger', region: 'volcan', hpPct: 0.55, defensePct: 0.4 },
    shaman: { id: 'shaman', name: 'Aïeule Wu Po', short: 'Wu Po', title: 'Chamane de la plaine', npc: 'trainer_shaman', sprite: 'ally_shaman', weapon: 'staff', region: 'bambous', hpPct: 0.6, defensePct: 0.5 }
};
export const ALLY_IDS = Object.keys(ALLIES);
export const MAX_ALLIES = 3;
export const ALLY_TARGET_CHANCE = 0.25;   // part des actions ennemies qui visent un compagnon (au lieu de Hou Yi), quand il y en a un vivant

export const allyOf = classId => ALLIES[classId] || null;
export const isAllyClass = classId => classId in ALLIES;

/** Nom court d'un membre de l'équipe (Hou Yi pour le Chasseur). */
export const memberName = classId => (ALLIES[classId] ? ALLIES[classId].short : 'Hou Yi');

/** PV max d'un compagnon : une part de ceux de Hou Yi (ils montent donc avec le niveau). */
export const allyMaxHp = (hero, classId) => Math.max(10, Math.round((hero?.maxHp || 100) * (ALLIES[classId]?.hpPct || 0.6)));

/** Compagnons recrutés (classes possédées autres que celle de Hou Yi), dans l'ordre de recrutement. */
export const recruitedAllies = hero => normalizeRoster(hero).owned.filter(id => isAllyClass(id) && id !== START_CLASS);
/** Compagnons de l'équipe de combat (loadout sans Hou Yi). */
export const teamAllies = hero => normalizeRoster(hero).loadout.filter(id => isAllyClass(id) && id !== START_CLASS);

/**
 * Entité de combat d'un compagnon (même forme qu'un combattant : hp, maxHp, defense, statusEffects…), pour que les dégâts et les altérations lui
 * soient appliqués comme à Hou Yi. Partage le qì de Hou Yi (aucune réserve propre).
 */
export function buildAlly(hero, classId) {
    const a = ALLIES[classId];
    const maxHp = allyMaxHp(hero, classId);
    return {
        isAlly: true, classId, name: a.name, short: a.short, title: a.title, sprite: a.sprite, weapon: a.weapon,
        level: hero?.level || 1, hp: maxHp, maxHp, ko: false,
        defense: Math.round((hero?.defense || 0) * a.defensePct), attack: Math.round((hero?.attack || 0) * 0.5),
        attributes: {}, statusEffects: {}
    };
}

/** Équipe de combat au début d'un combat : { classId: entité } pour chaque compagnon de l'équipe, en pleine forme. */
export function buildTeam(hero) {
    return Object.fromEntries(teamAllies(hero).map(id => [id, buildAlly(hero, id)]));
}

export const livingAllies = team => Object.values(team || {}).filter(a => a && !a.ko && a.hp > 0);
export const isAllyKnockedOut = (team, classId) => !!team?.[classId]?.ko;

/**
 * Cible d'une action ennemie : un compagnon vivant, ou null (= Hou Yi). L'ennemi vise un compagnon une fois sur quatre ; il s'acharne sur le plus faible
 * (60 % du temps le moins en forme, sinon au hasard) et, quand un compagnon est presque à terre, il l'achève plus volontiers ; mais si Hou Yi est en
 * danger (moins d'un tiers de ses PV), il se concentre sur lui. `heroHpPct` : part des PV de Hou Yi (0..1).
 */
export function pickEnemyTarget(team, rng = Math.random, heroHpPct = 1) {
    const alive = livingAllies(team);
    if (!alive.length) return null;
    const weakest = alive.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a));
    let chance = ALLY_TARGET_CHANCE;
    if (heroHpPct < 0.35) chance *= 0.4;                                 // Hou Yi est à portée de coup fatal : on le vise
    else if (weakest.hp / weakest.maxHp < 0.3) chance *= 1.6;            // un compagnon à achever
    if (rng() >= Math.min(0.5, chance)) return null;
    return rng() < 0.6 ? weakest : alive[Math.min(alive.length - 1, Math.floor(rng() * alive.length))];
}

/** Applique `damage` à un compagnon ; renvoie { damage, ko } (ko : vient de tomber). */
export function damageAlly(ally, damage) {
    if (!ally || ally.ko) return { damage: 0, ko: false };
    const dealt = Math.min(ally.hp, Math.max(0, Math.floor(damage || 0)));
    ally.hp -= dealt;
    if (ally.hp <= 0) { ally.hp = 0; ally.ko = true; return { damage: dealt, ko: true }; }
    return { damage: dealt, ko: false };
}

/** Soigne un compagnon vivant (plafonné à ses PV max). */
export function healAlly(ally, amount) {
    if (!ally || ally.ko) return 0;
    const before = ally.hp;
    ally.hp = Math.min(ally.maxHp, ally.hp + Math.max(0, Math.floor(amount || 0)));
    return ally.hp - before;
}

/** Un membre de l'équipe est-il hors de combat ? Hou Yi (Chasseur) tombe aussi : `heroKo`. */
export const isMemberKO = (team, heroKo, classId) => (classId === START_CLASS ? !!heroKo : isAllyKnockedOut(team, classId));

/** Un compagnon vivant au hasard (le moins en forme d'abord : 60 %) : reçoit les coups destinés à Hou Yi quand il est à terre. */
export function pickAnyAlly(team, rng = Math.random) {
    const alive = livingAllies(team);
    if (!alive.length) return null;
    const weakest = alive.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a));
    return rng() < 0.6 ? weakest : alive[Math.min(alive.length - 1, Math.floor(rng() * alive.length))];
}

/** Relève un compagnon hors de combat avec `pct` de ses PV max (0..1). Renvoie les PV rendus. */
export function reviveAlly(ally, pct = 0.5) {
    if (!ally || !ally.ko) return 0;
    ally.ko = false;
    ally.hp = Math.max(1, Math.round(ally.maxHp * Math.max(0, Math.min(1, pct))));
    return ally.hp;
}
