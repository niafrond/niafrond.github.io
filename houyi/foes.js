// Groupe d'ennemis d'un combat (état et opérations) : départ à 1 à 3 ennemis, invocation de renforts, ennemi ciblé, relève à la mort.
// Règles pures dans enemyGroup.js ; ciblage des sorts et des armes dans targeting.js ; tours des autres ennemis dans foeTurns.js.
//
// `enemy` (game.js) reste l'ennemi CIBLÉ : celui que le joueur frappe, que l'écran de combat décrit et dont la barre de chargement est affichée.
// `gameState.foes` contient tous les ennemis du combat (vivants et vaincus). Un clic sur la fiche d'un autre ennemi le prend pour cible.
import { enemy, gameState, player, log, setActiveEnemy, prepareFoe, queueCombatXP, combatRewards } from './game.js';
import { updateStats, updateEnemySpells } from './gameHud.js';
import { enemyChargeMs } from './classCharge.js';
import { createReinforcement, enemyCatalogList } from './enemies.js';
import { calculateXPGain } from './experience.js';
import { playSfx } from './sound.js';
import { isAreaSpell } from './targeting.js';
import { MAX_ENEMIES, REINFORCEMENT_HP_MULT, rollGroupSize, reinforcementLevel, livingFoes, isAlive, hasRoom, pickSummonTemplate, rewardShare } from './enemyGroup.js';

// ── Qì et points d'action mutualisés : comme l'équipe du joueur, les ennemis partagent UNE réserve de qì et UNE barre de PA. ──
/** Fait pointer `mana` et `combatPoints` de chaque ennemi sur la réserve commune (`gameState.foePool`). Les écritures (`foe.mana = …`, `foe.combatPoints -= …`) passent par la réserve. */
function linkFoePool(foes){
    const pool = gameState.foePool;
    for(const foe of foes){
        if(foe.poolLinked) continue;
        Object.defineProperty(foe, 'mana', { configurable: true, enumerable: true, get: () => pool.mana,
            set: v => { for(const c of Object.keys(pool.mana)) pool.mana[c] = Math.max(0, Math.floor(v?.[c] || 0)); } });   // la réserve garde son identité : tous la voient
        Object.defineProperty(foe, 'combatPoints', { configurable: true, enumerable: true, get: () => pool.combatPoints, set: v => { pool.combatPoints = Math.max(0, Number(v) || 0); } });
        foe.poolLinked = true;
    }
}
/** Verse le qì et les PA de départ d'un nouvel ennemi dans la réserve commune, puis le rattache à elle. */
function joinFoePool(foe){
    const pool = gameState.foePool;
    for(const c of Object.keys(pool.mana)) pool.mana[c] += Math.max(0, Math.floor(foe.mana?.[c] || 0));
    pool.combatPoints += Math.max(0, Number(foe.combatPoints) || 0);
    linkFoePool([foe]);
}

/** Ennemis du combat (au moins l'ennemi ciblé). */
export const allFoes = () => (gameState.foes?.length ? gameState.foes : [enemy]);

/** Compose le groupe de départ autour du meneur (parfois 2 ou 3 ennemis). Appelée par newEnemy une fois le meneur prêt. */
export function setupFoeGroup(lead){
    pending = null; document.body?.classList.remove('picking-target');
    gameState.foes = [lead];
    gameState.foePool = { mana: lead.mana, combatPoints: lead.combatPoints || 0 };   // la réserve commune part de celle du meneur
    linkFoePool([lead]);
    const size = rollGroupSize(lead);
    for(let i = 1; i < size; i++){
        const catalog = enemyCatalogList();
        const template = (lead.pack && catalog.find(t => t.id === lead.templateId)) || pickSummonTemplate(lead, catalog);   // meute : même espèce que le meneur
        if(!template) break;
        const foe = prepareFoe(createReinforcement(reinforcementLevel(lead.level), template), { hpMult: REINFORCEMENT_HP_MULT, biome: lead.biome });
        foe.isReinforcement = true;
        foe.readyAt = (gameState.charge?.now || 0) + enemyChargeMs(foe, 1);   // barre de chargement propre
        joinFoePool(foe);
        gameState.foes.push(foe);
    }
    if(gameState.foes.length > 1){
        log(`Ils sont ${gameState.foes.length} : ${gameState.foes.map(f => f.name).join(', ')} ! Touchez un ennemi pour le prendre pour cible ; les sorts de zone les frappent tous.`);
    }
}

/** Prend `next` pour cible (le joueur l'a choisi, ou relève après une défaite). Renvoie false si c'est impossible. */
export function focusFoe(next){
    if(!next || next === enemy || !isAlive(next) || !allFoes().includes(next)) return false;
    const charge = gameState.charge;
    if(charge){   // chaque ennemi garde sa propre barre de chargement (date de « prêt » sur le temps de combat)
        enemy.readyAt = charge.enemyReady;
        charge.enemyReady = next.readyAt ?? charge.enemyReady;
    }
    setActiveEnemy(next);
    updateEnemySpells();
    updateStats();
    return true;
}

/** Appelle un renfort dans le combat (invocation, ou arrivée en cours de combat). Renvoie l'ennemi ajouté, ou null s'il n'y a plus de place. */
export function addFoe(summoner){
    if(!hasRoom(gameState.foes)) return null;
    const template = pickSummonTemplate(summoner, enemyCatalogList());
    if(!template) return null;
    const foe = prepareFoe(createReinforcement(reinforcementLevel(summoner.level), template), { hpMult: REINFORCEMENT_HP_MULT, biome: summoner.biome });
    foe.isReinforcement = true;
    foe.summonedBy = summoner.name;
    foe.readyAt = (gameState.charge?.now || 0) + enemyChargeMs(foe, 1);
    joinFoePool(foe);
    gameState.foes = [...livingFoes(gameState.foes), foe].slice(0, MAX_ENEMIES);   // les vaincus libèrent leur place
    return foe;
}

/**
 * Un ennemi vient de tomber : s'il en reste d'autres, il touche une part de récompense, le suivant prend la relève et le combat continue
 * (renvoie true). Sinon renvoie false : c'est la victoire (handleEnemyDefeated verse alors tout le butin).
 */
export function advanceAfterFoeDefeat(){
    const remaining = livingFoes(gameState.foes).filter(f => f !== enemy);
    if(!remaining.length) return false;
    const fallen = enemy;
    log(`${fallen.name} est vaincu !`);
    playSfx('victory');
    const share = rewardShare(false);
    const xp = Math.max(1, Math.round(calculateXPGain(fallen, player.level) * share));
    queueCombatXP(xp);
    const lvl = fallen.level || player.level || 1;
    const gold = Math.round((lvl * 3 * (fallen.dropProfile?.goldMult ?? 1) + lvl) * share);
    player.gold = (player.gold || 0) + gold;
    combatRewards.gold += gold;
    log(`Vous gagnez ${xp} XP et ${gold} zhu ; ${remaining.length} ennemi${remaining.length > 1 ? 's' : ''} restant${remaining.length > 1 ? 's' : ''}.`);
    focusFoe(remaining[0]);
    log(`${enemy.name} prend la relève.`);
    return true;
}

// ── Choix de la cible : après avoir choisi l'attaque, on touche l'ennemi voulu ; la cible n'est jamais mémorisée d'une attaque à l'autre. ──
let pending = null;   // attaque en attente d'une cible : fonction qui la relance une fois la cible prise

/** Annule le choix de cible en cours (autre action, fin de combat). */
export function cancelTargetPick(){
    if(!pending) return;
    pending = null;
    document.body?.classList.remove('picking-target');
    log('Choix de la cible annulé.');
    updateStats();
}
export const isPickingTarget = () => Boolean(pending);

/**
 * À appeler juste avant de payer une attaque. Renvoie true si l'attaque est suspendue : le joueur doit toucher un ennemi, puis `rerun` la relance
 * avec cette cible. Renvoie false (l'attaque part) s'il n'y a qu'un ennemi vivant, si l'attaque est de zone, ou si la cible vient d'être choisie.
 */
export function targetGate(isArea, rerun){
    if(gameState.targetPicked){ gameState.targetPicked = false; return false; }
    if(isArea || livingFoes(gameState.foes).length < 2) return false;
    pending = rerun;
    document.body?.classList.add('picking-target');
    log('Choisissez l\'ennemi à viser.');
    updateStats();
    return true;
}

/** L'ennemi touché devient la cible de l'attaque en attente, qui part aussitôt. */
export function pickTarget(foe){
    if(!pending || !focusFoe(foe) && foe !== enemy) return false;
    const run = pending;
    pending = null;
    document.body?.classList.remove('picking-target');
    gameState.targetPicked = true;
    run();
    gameState.targetPicked = false;   // si l'attaque a été refusée en route, le drapeau ne traîne pas
    return true;
}

// ── Effets secondaires des sorts de zone : poison, étourdissement, ponction de qì… touchent aussi les autres ennemis. ──
/** Photographie de ce qu'un sort peut modifier chez l'ennemi ciblé (altérations, qì, points d'action). */
export const snapshotFoe = f => ({ status: JSON.parse(JSON.stringify(f.statusEffects || {})), mana: { ...(f.mana || {}) }, cp: f.combatPoints || 0 });

/** Après un sort de zone lancé sur `focus` : recopie sur les autres ennemis vivants ce qui a changé chez lui (altérations posées, qì et points d'action perdus). */
export function spreadAreaEffects(spell, focus, before){
    if(!before || !isAreaSpell(spell)) return;
    const others = livingFoes(gameState.foes).filter(f => f !== focus);
    if(!others.length) return;
    let touched = false;
    const status = focus.statusEffects || {};
    for(const f of others){
        f.statusEffects ||= {};
        for(const key of Object.keys(status)){
            if(JSON.stringify(status[key]) === JSON.stringify(before.status[key])) continue;   // inchangé par ce sort
            const value = JSON.parse(JSON.stringify(status[key]));
            const had = f.statusEffects[key];
            f.statusEffects[key] = (typeof value === 'number' && typeof had === 'number') ? Math.max(value, had) : value;
            touched = true;
        }
        for(const color of Object.keys(before.mana)){
            const lost = (before.mana[color] || 0) - (focus.mana?.[color] || 0);
            if(lost > 0 && f.mana){ f.mana[color] = Math.max(0, (f.mana[color] || 0) - lost); touched = true; }
        }
        const cpLost = before.cp - (focus.combatPoints || 0);
        if(cpLost > 0){ f.combatPoints = Math.max(0, (f.combatPoints || 0) - cpLost); touched = true; }
    }
    if(touched) log(`${spell.name} : les effets touchent aussi ${others.length > 1 ? 'les autres ennemis' : others[0].name}.`);
}

/** Part de chargement (0..1) de la barre d'un ennemi : la sienne, ou celle du combat pour l'ennemi ciblé. */
export function foeChargeProgress(foe){
    const charge = gameState.charge;
    if(!charge || !isAlive(foe)) return 0;
    const readyAt = foe === enemy ? charge.enemyReady : (foe.readyAt ?? charge.now);
    const left = Math.max(0, readyAt - charge.now);
    return left <= 0 ? 1 : Math.max(0, 1 - left / enemyChargeMs(foe, 1));
}
