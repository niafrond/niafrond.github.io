// Tour des autres ennemis du groupe (foes.js), une fois par tour d'ennemi : chacun frappe (arme, sort ou coup de base) puis les invocateurs appellent
// peut-être un renfort. L'ennemi ciblé joue son tour complet (gameTurnFlow.js) ; ici, les autres jouent une version simple de leur IA.
import { enemy, gameState, player, log, setActiveEnemy, applyDamage, partyWiped } from './game.js';
import { updateStats } from './gameHud.js';
import { refreshFoeCharges } from './foesView.js';
import { makeDecision } from './enemyAI.js';
import { resolveStrike } from './combatStats.js';
import { isAsleep } from './alterations.js';
import { playSfx } from './sound.js';
import { showCombatAnimation } from './gameStatsTab.js';
import { applyEnemyAction, applyEnemyActionNow, payEnemyAction } from './gameTurnFlow.js';
import { livingFoes, shouldSummon, SUPPORT_DAMAGE_MULT } from './enemyGroup.js';
import { addFoe, foeChargeProgress } from './foes.js';
import { enemyChargeMs, chargeSpeed } from './classCharge.js';
import { chargeEnabled } from './gameSpellList.js';
import { handlePlayerDeath } from './game.js';

/** Exécute `fn` avec `foe` pour `enemy` (l'IA et les règles lisent l'ennemi courant), puis remet l'ennemi ciblé. */
function asFoe(foe, fn){
    const focus = enemy;
    setActiveEnemy(foe);
    try { return fn(); } finally { if(enemy !== focus && focus.hp > 0) setActiveEnemy(focus); }
}

/** Coup de base d'un ennemi sans arme ni sort abordable : un coup de sa puissance. */
function basicStrike(foe){
    const raw = Math.max(1, Math.round((foe.power || 6) * 0.5));
    const strike = resolveStrike(raw, foe, player);
    applyDamage(player, strike.damage);
    playSfx('weaponHit', { isPlayer: false });
    log(`${foe.name} frappe : ${strike.damage} dégâts.${strike.crit ? ' Coup critique !' : ''}`);
}

function supportAction(foe){
    if((foe.statusEffects?.stunned || 0) > 0){
        foe.statusEffects.stunned--;
        log(`${foe.name} est étourdi et perd son tour.`);
        return;
    }
    if(isAsleep(foe)){ log(`${foe.name} dort.`); return; }
    const previousScale = foe.damageScale;
    foe.damageScale = SUPPORT_DAMAGE_MULT;   // un renfort frappe moins fort : un groupe ne multiplie pas la menace
    try {
        asFoe(foe, () => {
            const decision = makeDecision();
            if(decision.action === 'spell' && !decision.data?.spell?.boardSpell && payEnemyAction(decision)){ applyEnemyAction(decision); return; }
            if(foe.weapon){ applyEnemyAction({ action: 'weapon', data: decision.data }); return; }
            basicStrike(foe);
        });
    } finally { foe.damageScale = previousScale; }
}

function summonAction(summoner){
    const foe = addFoe(summoner);
    if(!foe) return;
    summoner.summonsMade = (summoner.summonsMade || 0) + 1;
    summoner.summonedLastTurn = true;
    log(`${summoner.name} invoque ${foe.name} !`);
    playSfx('spellCast', { isPlayer: false });
    showCombatAnimation({ icon: 'bolt', title: 'INVOCATION', damage: foe.name, source: summoner.name, target: '→ Renfort' }, false, { autoHideMs: 1100 });
}

/** Appelée une fois par tour d'ennemi (finishEnemyTurn) : les ennemis non ciblés agissent, puis les invocateurs peuvent appeler un renfort. */
export function runFoePhase(){
    const foes = gameState.foes;
    if(gameState.combatState !== 'active' || !foes || (foes.length < 2 && !foes.some(f => f.summon))) return;
    const lead = enemy;
    if(!chargeEnabled()){   // sans temps de chargement : les autres ennemis frappent à chaque tour d'ennemi
        for(const foe of livingFoes(foes).filter(f => f !== lead)){
            if(gameState.combatState !== 'active' || foe.hp <= 0) continue;
            supportAction(foe);
            if(partyWiped()) return;
        }
    }
    for(const f of livingFoes(foes)){
        if(shouldSummon(f, gameState.foes)) summonAction(f);
        else f.summonedLastTurn = false;
    }
    updateStats();
}

/**
 * Chargement propre à chaque ennemi non ciblé (appelé par le ticker du combat, gameSpellList.js) : sa barre avance (ralentie ou accélérée par ses altérations),
 * et dès qu'elle est pleine il agit puis se recharge. L'ennemi ciblé garde la barre du combat (enemyProactiveAction).
 */
export function tickFoeCharges(dtMs){
    const charge = gameState.charge;
    if(gameState.combatState !== 'active' || !charge || !chargeEnabled() || (gameState.foes?.length || 0) < 2) return;
    for(const foe of livingFoes(gameState.foes)){
        if(foe === enemy) continue;
        if(foe.readyAt == null) foe.readyAt = charge.now + enemyChargeMs(foe, 1);
        const shift = dtMs * (1 - Math.max(0, Math.min(3, chargeSpeed(foe))));   // ralenti : la date de « prêt » recule
        if(shift !== 0 && foe.readyAt > charge.now - dtMs) foe.readyAt = Math.max(charge.now, foe.readyAt + shift);
        if(foe.readyAt > charge.now) continue;
        supportAction(foe);
        foe.readyAt = charge.now + enemyChargeMs(foe, 1);
        if(partyWiped()){ handlePlayerDeath(); return; }
    }
    refreshFoeCharges();
}
