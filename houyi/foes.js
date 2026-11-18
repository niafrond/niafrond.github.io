// Groupe d'ennemis d'un combat (état et opérations) : départ à 1 à 3 ennemis, invocation de renforts, ennemi ciblé, relève à la mort.
// Règles pures dans enemyGroup.js ; ciblage des sorts et des armes dans targeting.js ; tours des autres ennemis dans foeTurns.js.
//
// `enemy` (game.js) reste l'ennemi CIBLÉ : celui que le joueur frappe, que l'écran de combat décrit et dont la barre de chargement est affichée.
// `gameState.foes` contient tous les ennemis du combat (vivants et vaincus). Un clic sur la fiche d'un autre ennemi le prend pour cible.
import { enemy, gameState, player, log, setActiveEnemy, prepareFoe, queueCombatXP, combatRewards } from './game.js';
import { updateStats, updateEnemySpells } from './gameHud.js';
import { createReinforcement, enemyCatalogList } from './enemies.js';
import { calculateXPGain } from './experience.js';
import { playSfx } from './sound.js';
import { MAX_ENEMIES, REINFORCEMENT_HP_MULT, rollGroupSize, reinforcementLevel, livingFoes, isAlive, hasRoom, pickSummonTemplate, rewardShare } from './enemyGroup.js';

/** Ennemis du combat (au moins l'ennemi ciblé). */
export const allFoes = () => (gameState.foes?.length ? gameState.foes : [enemy]);

/** Compose le groupe de départ autour du meneur (parfois 2 ou 3 ennemis). Appelée par newEnemy une fois le meneur prêt. */
export function setupFoeGroup(lead){
    gameState.foes = [lead];
    const size = rollGroupSize(lead);
    for(let i = 1; i < size; i++){
        const template = pickSummonTemplate(lead, enemyCatalogList());
        if(!template) break;
        const foe = prepareFoe(createReinforcement(reinforcementLevel(lead.level), template), { hpMult: REINFORCEMENT_HP_MULT, biome: lead.biome });
        foe.isReinforcement = true;
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
    if(charge){   // chaque ennemi garde sa propre progression de chargement
        const left = Math.max(0, charge.enemyReady - charge.now);
        enemy.chargeLeft = left;
        charge.enemyReady = charge.now + (next.chargeLeft ?? left);
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
