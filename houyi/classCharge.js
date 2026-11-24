// Temps de chargement des classes (et de l'ennemi). Module pur (aucun accès au DOM).
// Le plateau reste au tour par tour ; ce sont les ACTIONS (arme, sort, compétence de classe, objet, potion) qui sont soumises au chargement :
// une classe qui vient d'agir se recharge en temps réel (`chargeTime` unités × CHARGE_MS_PER_UNIT) et ne peut plus agir tant qu'elle n'est
// pas prête ; l'ennemi a la même contrainte. Avec plusieurs classes, on change de classe pour agir : l'une charge pendant que l'autre joue.
import { ATTRIBUTE_MANA_RULES, getAttributePoints, agilityScore } from './attributes.js';
import { skillBonus } from './skills.js';
import { wornRelics } from './items.js';

export const CHARGE_MS_PER_UNIT = 200;   // durée réelle d'une unité de chargement : 100 unités = 20 s ; un héros de milieu de partie (≈ 75 unités) met environ 15 s
export const BOARD_IDLE_PAUSE_MS = 5000;   // plateau inactif depuis ce délai : les chargements se mettent en pause, jusqu'au prochain combo
export const CHARGE_BASE = 100;          // temps de chargement sans aucun bonus
export const CHARGE_MIN = 40;            // plancher : jamais plus de 60 % de réduction
const AGILITY_PCT = 0.5;                 // % de réduction par point d'Agilité + Moral (toutes les classes)
const CLASS_ATTR_PCT = 0.4;              // % par point de l'attribut propre à la classe
const QI_PCT = 0.3;                      // % par qì de la couleur de la classe
export const ENEMY_CHARGE_FACTOR = 1.8;  // l'ennemi se recharge 1,8 fois plus lentement que le héros à bonus égal : il joue déjà sur le plateau à chaque tour (équilibrage)
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
        skills: skillBonus(hero, 'chargePct', classId)   // les compétences de CE personnage (chacun a ses Fulu)
    };
    const total = pct.agility + pct.attribute + pct.qi + pct.skills;
    return { time: clampTime(total), pct };
}

export const classChargeTime = (hero, classId) => classChargeInfo(hero, classId).time;

/** Temps de chargement de l'ennemi : son niveau et son agilité (il n'a pas de classe). */
export function enemyChargeTime(enemy) {
    return Math.round(clampTime((enemy?.level || 0) * ENEMY_LEVEL_PCT + agilityScore(enemy) * AGILITY_PCT) * ENEMY_CHARGE_FACTOR);
}

/** Nouveau combat : tout le monde est prêt. `now` est le temps de combat écoulé (ms) ; `ready` : date de « prêt » par classe. */
export const newCharge = () => ({ now: 0, ready: {}, enemyReady: 0 });

/**
 * Vitesse de chargement d'un combattant selon ses altérations (1 = normale, 0 = à l'arrêt) : Ralenti et Pétrifié moitié moins vite, Épuisé et Maudit un peu
 * moins vite, Étourdi et Endormi l'arrêtent ; les altérations POSITIVES l'accélèrent (Concentré ×1,25, Hâte ×1,5, Élan ×2). Les facteurs se multiplient.
 */
export const CHARGE_MOD = { chilled: 0.5, petrified: 0.5, exhausted: 0.7, cursed: 0.8, stunned: 0, asleep: 0, hindered: 0.6, focused: 1.25, haste: 1.5, surge: 2 };
export const CHARGE_SLOW = CHARGE_MOD;   // ancien nom
export function chargeSpeed(entity) {
    const status = entity?.statusEffects || {};
    return Math.min(3, Object.entries(CHARGE_MOD).reduce((f, [key, k]) => ((Number(status[key]) || 0) > 0 ? f * k : f), 1));
}

/** Fait avancer le temps de combat (le ticker de gameSpellList.js ne l'appelle qu'en combat, fenêtre visible). Un combattant ralenti voit ses dates de « prêt » reculer d'autant. */
export function chargeTick(charge, dtMs, heroSpeed = 1, enemySpeed = 1) {
    const dt = Math.max(0, dtMs || 0);
    const before = charge.now;
    charge.now += dt;
    const shift = speed => dt * (1 - Math.max(0, Math.min(3, speed)));   // > 0 : retard (ralenti), < 0 : avance (accéléré)
    // heroSpeed : un nombre pour toute l'équipe, ou { classId: vitesse } (chaque compagnon a ses propres altérations)
    Object.keys(charge.ready).forEach(id => {
        const sp = typeof heroSpeed === 'object' && heroSpeed ? (heroSpeed[id] ?? 1) : heroSpeed;
        const d = shift(sp);
        if (d !== 0 && charge.ready[id] > before) charge.ready[id] = Math.max(charge.now, charge.ready[id] + d);
    });
    const foeShift = shift(enemySpeed);
    if (foeShift !== 0 && charge.enemyReady > before) charge.enemyReady = Math.max(charge.now, charge.enemyReady + foeShift);
}

const readyAt = (charge, id) => charge.ready[id] ?? 0;
const factorOf = factor => (Number.isFinite(factor) && factor > 0 ? factor : 1);

export const classChargeMs = (hero, id, factor = 1) => Math.round(classChargeTime(hero, id) * CHARGE_MS_PER_UNIT * factorOf(factor));
export const enemyChargeMs = (enemy, factor = 1) => Math.round(enemyChargeTime(enemy) * CHARGE_MS_PER_UNIT * factorOf(factor));

export const isClassReady = (charge, id) => readyAt(charge, id) <= charge.now;
export const classRemainingMs = (charge, id) => Math.max(0, readyAt(charge, id) - charge.now);

/** Part de chargement d'une classe (0..1) : 1 = prête. */
export function classProgress(charge, hero, id, factor = 1) {
    const left = classRemainingMs(charge, id);
    return left <= 0 ? 1 : Math.max(0, 1 - left / classChargeMs(hero, id, factor));
}

/** La classe vient d'agir (arme, sort, compétence, objet, potion) : elle se recharge. */
export function spendClass(charge, hero, id, factor = 1) { charge.ready[id] = charge.now + classChargeMs(hero, id, factor); }

export const isEnemyReady = charge => charge.enemyReady <= charge.now;
export const enemyRemainingMs = charge => Math.max(0, charge.enemyReady - charge.now);
/** L'ennemi vient d'agir (sort, arme, capacité) : il se recharge. */
export function spendEnemy(charge, enemy, factor = 1) { charge.enemyReady = charge.now + enemyChargeMs(enemy, factor); }

// ── File d'attente des actions ──────────────────────────────────────────────
// Une action choisie (sort, compétence, objet, arme) est exécutée tout de suite si la classe est prête et qu'aucune action n'attend ; sinon elle
// entre dans la file, dans l'ordre d'arrivée, et part dès que sa classe est chargée. L'ordre n'est jamais montré au joueur.
export const newActionQueue = () => [];
let _seq = 0;
export function enqueueAction(queue, item) { const entry = { ...item, seq: ++_seq }; queue.push(entry); return entry; }
/** Retire et renvoie la prochaine action à partir (file commune joueur / ennemi) : parmi celles qui peuvent partir (`canRun`), la plus anciennement prête (`dueAt`), puis l'ordre d'arrivée. */
export function takeNextDue(queue, canRun) {
    let best = -1;
    queue.forEach((it, i) => {
        if (!canRun(it)) return;
        if (best === -1 || it.dueAt < queue[best].dueAt || (it.dueAt === queue[best].dueAt && it.seq < queue[best].seq)) best = i;
    });
    return best === -1 ? null : queue.splice(best, 1)[0];
}
// Délais de lisibilité (ms) : ils sont à 0 — une action dont c'est le moment entre dans la file et part aussitôt, les actions s'enchaînent sans pause (seule l'animation de la précédente les retient). Réglables via actionTimes.
export const ACTION_ENTER_DELAY_MS = 0;    // plus de pause artificielle : une action dont c'est le moment entre dans la file et part aussitôt (elles s'enchaînent)
export const ACTION_LAUNCH_DELAY_MS = 0;
/** Dates (ms) d'entrée visible dans la file et de lancement possible d'une action choisie à `now`. */
export const actionTimes = (now, enter = ACTION_ENTER_DELAY_MS, launch = ACTION_LAUNCH_DELAY_MS) => ({ visibleAt: now + enter, runAt: now + enter + launch });
export const isActionVisible = (item, now) => now >= (item.visibleAt ?? 0);
export const isActionLaunchable = (item, now) => now >= (item.runAt ?? 0);
export const hasQueuedAction = (queue, owner) => queue.some(item => item.owner === owner);

/** Le temps de chargement avance-t-il ? Oui tant qu'un combo a eu lieu sur le plateau depuis moins de BOARD_IDLE_PAUSE_MS. */
export const chargeRunning = (nowMs, lastComboMs) => nowMs - lastComboMs < BOARD_IDLE_PAUSE_MS;

/**
 * Début de combat : toutes les classes et l'ennemi partent avec une barre VIDE (il faut attendre leur chargement), sauf bonus :
 * `startChargePct` (compétences de soutien actives, effet des reliques portées) remplit d'avance la barre des classes ; `enemy.startChargePct` celle de l'ennemi.
 */
export function startChargePctOf(hero, classId = null) {
    const relics = (typeof wornRelics === 'function' ? wornRelics(hero) : []).reduce((n, r) => n + (Number(r?.effect?.startChargePct) || 0), 0);
    return Math.max(0, Math.min(100, skillBonus(hero, 'startChargePct', classId || undefined) + relics));   // classId : seulement les compétences de ce personnage
}
export function initCharge(charge, hero, classIds, enemy, factor = 1) {
    classIds.forEach(id => { charge.ready[id] = charge.now + Math.round(classChargeMs(hero, id, factor) * (1 - startChargePctOf(hero, id) / 100)); });
    const foePct = Math.max(0, Math.min(100, Number(enemy?.startChargePct) || 0)) / 100;
    charge.enemyReady = charge.now + Math.round(enemyChargeMs(enemy, factor) * (1 - foePct));
    return charge;
}

/** Phrase brève d'une action en file : « Hou Yi prépare Arc du Chasseur (20 dégâts) → Dragon ». `info` : { caster, name, damage?, target? (texte ou fonction) }. */
export function queueSentence(info) {
    if (!info?.name) return 'Une action se prépare';
    const dmg = Number(info.damage) > 0 ? ` (${Math.round(info.damage)} dégâts)` : '';
    const target = typeof info.target === 'function' ? info.target() : info.target;   // fonction : cible recalculée à l'affichage (ennemi : personnage que le coup toucherait alors)
    return `${info.caster || 'Quelqu\'un'} prépare ${info.name}${dmg}${target ? ` → ${target}` : ''}`;
}
/** Actions en file dans l'ordre de départ : [{ side: 'hero'|'foe', sentence }] (même ordre que les perles de `upcomingBeads`). */
export function upcomingActions(queue) {
    return queue.map(it => ({ side: it.owner === 'enemy' ? 'foe' : 'hero', due: it.dueAt ?? 0, seq: it.seq, sentence: queueSentence(it.info) }))
        .sort((a, b) => a.due - b.due || a.seq - b.seq).map(({ side, sentence, seq }) => ({ side, sentence, seq }));
}

/**
 * Perles des actions à venir (ligne discrète en haut du combat) : une perle par action en attente, dans l'ordre où elles partiront
 * (temps de chargement restant de leur classe, puis ordre d'arrivée). 'hero' = action du joueur (verte), 'foe' = action ennemie (rouge).
 */
export function upcomingBeads(charge, queue, enemyTurnBound) {
    const items = queue.map(it => ({ side: it.owner === 'enemy' ? 'foe' : 'hero', due: it.dueAt ?? 0, seq: it.seq }));
    if (enemyTurnBound) items.push({ side: 'foe', due: charge.enemyReady, seq: Infinity });
    return items.sort((a, b) => a.due - b.due || a.seq - b.seq).map(it => it.side);
}
