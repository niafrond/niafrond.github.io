// Déroulé des tours : coup du joueur (arme, sort, ultime), pouvoirs des compagnons, tour de l'ennemi, fin de tour, victoire sur l'ennemi.
// Extrait de game.js. L'état du tour reste dans game.js : `currentTurn` s'assigne via setCurrentTurn, les drapeaux du renard et des compagnons vivent dans `turnFlags`.
import { boardSize } from './constants.js';
import { tutorialCallbacks } from './tutorial.js';
import { getAvailableWeapons } from './weapons.js';
import { enemyMakeMove, enemyMakeRandomMove, foxMakeRandomMove, restartSuggestionTimer, getTrappedCells, setTrappedCells, advanceBiomeTurn, announceBurningCells, convertRandomColorToArrows, checkMatches, board } from './board.js';
import { stuffTotals, inflictPoison, isVenomous, POISON_CHANCE } from './stuff.js';
import { rollEnemyStuffDrops } from './enemyStuff.js';
import { recordVictory } from './bossTips.js';
import { pickTrapZone, trapDamage, mirrorLoadout, duelTurnPlan, weakenedHp } from './duel.js';
import { arenaRewardBonus, arenaTier } from './arena.js';
import { makeDecision, logDecision } from './enemyAI.js';
import { rollOverleveledLoot, effectiveDropChance } from './victoryLoot.js';
import { healEntity, tickAlterations, isAsleep, confusedSelfHit } from './alterations.js';
import { stepBossScript, signatureDamage } from './bossScript.js';
import { tickSpellCooldowns } from './spellCooldown.js';
import { getRandomItem, getRarityIcon, applyArtifactEffects, tickReusableRecharge } from './items.js';
import { rollCompanionPowers } from './companionPowers.js';
import { MANA_COLOR_LABELS } from './attributes.js';
import { calculateXPGain } from './experience.js';
import { playSfx } from './sound.js';
import { RAGE_MAX, addRage } from './ultimates.js';
import { resolveStrike, blockLabel, tickStatBuffs, ancientArrowGain } from './combatStats.js';
import { animationFactor } from './gameOptions.js';
import { flyHeal } from './manaFlight.js';
import { getLeftHandWeapon, updateAvailableWeapons, updateInventoryTab } from './gameInventoryTabs.js';
import { getSpellsByClass } from './spells.js';
import { log, logActiveAction, saveUpdate, updateStats } from './gameHud.js';
import { companionIconHtml, foxIconHtml, showCombatAnimation, showStrikeAnimation } from './gameStatsTab.js';
import { finishCombatRecord, recordEnemyTurn, recordPlayerTurn, saveCombatRecord } from './combatBalance.js';
import { showAttributeMenu } from './gameLevelUp.js';
import { updateAvailableSpells } from './gameSpellList.js';
import { activeCompanionIds, addBonusTurn, addManaForColor, applyCombatXPAtEnd, applyDamage, applyStandardSpellEffects, canEntityCastSpell, combatHooks, combatRewards, consumeSpellMana, enemy, gameState, getWeaponIcon, grantStuffPiece, handlePlayerDeath, normalizeActiveInventoryIndex, normalizeBonusTurnValue, player, queueCombatXP, showEndCombatAnimation, turnFlags, setCurrentTurn } from './game.js';

// Applique les pouvoirs de fin de tour des compagnons présents (soin, jet d'eau, qì, mirage). Renvoie { skipEnemy, enemyDown }.
export const COMPANION_NAMES = { zhi: 'Zhi', dawa: 'Dawa', yu: 'Yu', etincelle: 'Leigong', braise: 'Braise', jian: 'Jian', tou: 'Tou' };
function applyCompanionPowers(){
    const outcome = { skipEnemy: false, enemyDown: false, boardChanged: false, announcements: [] };
    rollCompanionPowers([...activeCompanionIds], player, Math.random, enemy).forEach(({ id, power, amount, color }) => {
        const who = COMPANION_NAMES[id] || id;
        const announce = text => outcome.announcements.push({ id, title: who, damage: power.name, target: text });
        if(power.kind === 'heal'){
            const healed = Math.max(0, Math.min(player.maxHp - player.hp, amount));
            healEntity(player, healed);
            if(healed > 0) flyHeal(true, healed);
            announce(`+${healed} PV`);
            log(`${power.name} : ${who} rend ${healed} PV.`);
        } else if(power.kind === 'splash'){
            applyDamage(enemy, amount);
            log(`${power.name} : ${enemy.name} subit ${amount} dégâts.`);
            announce(`${enemy.name} subit ${amount} dégâts`);
            if(enemy.hp <= 0) outcome.enemyDown = true;
        } else if(power.kind === 'mana'){
            const r = addManaForColor(player, color, amount, { applyGainBonus: false });
            log(`${power.name} : +${r.gained ?? amount} qì ${MANA_COLOR_LABELS[color] || color}.`);
            announce(`+${r.gained ?? amount} qì ${MANA_COLOR_LABELS[color] || color}`);
        } else if(power.kind === 'mirage'){
            outcome.skipEnemy = true;
            announce(`${enemy.name} perd son tour`);
        } else if(power.kind === 'rage'){
            const gained = addRage(player, Math.floor(RAGE_MAX * amount));
            log(`${power.name} : +${gained} rage.`);
            announce(`+${gained} rage`);
        } else if(power.kind === 'arrows'){
            const converted = convertRandomColorToArrows();
            if(converted){ outcome.boardChanged = true; log(`${power.name} : les tuiles ${MANA_COLOR_LABELS[converted] || converted} deviennent des flèches.`); announce(`Tuiles ${MANA_COLOR_LABELS[converted] || converted} → flèches`); }
        } else if(power.kind === 'steal'){
            const stolen = Math.max(0, Math.floor(enemy.mana[color] || 0));
            enemy.mana[color] = 0;
            const r = addManaForColor(player, color, stolen, { applyGainBonus: false });
            log(`${power.name} : ${stolen} qì ${MANA_COLOR_LABELS[color] || color} volé à ${enemy.name} (+${r.gained} pour vous).`);
            announce(`${stolen} qì ${MANA_COLOR_LABELS[color] || color} volé`);
        }
    });
    return outcome;
}

// Annonce chaque pouvoir déclenché (portrait du compagnon, nom du pouvoir, effet), l'un après l'autre, comme le coup de Xiao Gui.
function playCompanionAnnouncements(list, done){
    const next = i => {
        if(gameState.combatState !== 'active' || i >= list.length){ done(); return; }
        const a = list[i];
        showCombatAnimation({ icon: companionIconHtml(a.id), title: a.title, damage: a.damage, target: a.target }, true, {
            autoHideMs: 1100 * animationFactor(),
            onContinue: () => next(i + 1)
        });
    };
    next(0);
}

export function finishPlayerTurn(){
    turnFlags.foxPlaying = false;
    if(gameState.combatState !== 'active'){
        return;
    }
    recordPlayerTurn();

    // Vérifier si le joueur est mort
    if(player.hp<=0){
        handlePlayerDeath();
        return;
    }
    
    // Vérifier si le joueur a un tour bonus
    if(normalizeBonusTurnValue(player.bonusTurn) > 0){
        player.bonusTurn = normalizeBonusTurnValue(player.bonusTurn) - 1;
        const remaining = normalizeBonusTurnValue(player.bonusTurn);
        log(`Tour bonus utilisé : pas d'attaque ennemie.${remaining > 0 ? ` (${remaining} restant${remaining > 1 ? 's' : ''})` : ''}`);
        saveUpdate();
        tutorialCallbacks.onPlayerTurn?.('bonus');   // tutoriel scripté : le joueur rejoue
        return;
    }
    // Pouvoirs des autres compagnons (Zhi, Dawa, Yu, Leigong) : tirés une fois par tour, en fin de tour du joueur.
    let outcome = null;
    if (!turnFlags.companionsActed) {
        turnFlags.companionsActed = true;
        outcome = applyCompanionPowers();
        if (outcome.announcements.length) {   // les annonces se jouent d'abord (commandes bloquées), puis finishPlayerTurn reprend avec ce résultat
            turnFlags.pendingOutcome = outcome;
            turnFlags.foxPlaying = true;
            updateStats();
            playCompanionAnnouncements(outcome.announcements, () => { turnFlags.foxPlaying = false; finishPlayerTurn(); });
            return;
        }
    } else if (turnFlags.pendingOutcome) {
        outcome = turnFlags.pendingOutcome;
        turnFlags.pendingOutcome = null;
    }
    if (outcome) {
        if (outcome.enemyDown) { setCurrentTurn('enemy'); updateStats(); afterPlayerAnimations(() => { if(gameState.combatState === 'active') enemyTurn(); }); return; }
        if (outcome.boardChanged) {   // le plateau se résout, puis rappelle finishPlayerTurn (les pouvoirs ne se retirent pas : flag posé)
            turnFlags.foxPlaying = true; updateStats(); saveUpdate(); checkMatches(true); return;
        }
        if (outcome.skipEnemy) { log(`Mirage de Dawa : ${enemy.name} se perd, pas d'attaque ennemie.`); updateStats(); saveUpdate(); return; }
    }

    // Xiao Gui (compagnon renard) : 30 % de chance de jouer un coup aléatoire supplémentaire.
    if (!turnFlags.foxActed && activeCompanionIds.has('xiao_gui') && Math.random() < 0.30) {
        turnFlags.foxActed = true;
        // Le renard attend la fin de l'événement en cours (attaque qui s'abat, annonce à valider par un clic…) avant d'agir.
        setCurrentTurn('enemy'); // bloque le plateau pendant l'attente
        updateStats();
        afterPlayerAnimations(() => {
            if(gameState.combatState !== 'active') return;
            setCurrentTurn('player'); // le coup du renard se joue pendant le tour du joueur
            turnFlags.foxPlaying = true;      // ... mais les commandes du joueur restent bloquées
            updateStats();   // verrouille les boutons
            log('Xiao Gui bondit ! Hi hi — un coup de renard !');
            // On annonce que le renard joue, puis seulement il fait son mouvement.
            showCombatAnimation({ icon: foxIconHtml(), title: 'Xiao Gui', damage: 'Un coup de renard !', target: 'Le renard joue sur le plateau…' }, true, {
                autoHideMs: 1200 * animationFactor(),
                onContinue: () => { if(gameState.combatState === 'active') foxMakeRandomMove(); }
            });
        });
        return; // le plateau rappelle finishPlayerTurn() après résolution
    }

    // Laisse finir l'animation de l'action du joueur (attaque, sort, soin, objet) avant la réplique de l'adversaire.
    setCurrentTurn('enemy'); // bloque le plateau pendant l'animation
    updateStats();
    afterPlayerAnimations(() => {
        if(gameState.combatState !== 'active') return;
        if(player.hp <= 0){ handlePlayerDeath(); return; }
        const burn = advanceBiomeTurn();
        // « Case brûlante - 3 dégâts » s'affiche sur chaque case avant que les dégâts ne tombent.
        const warnMs = announceBurningCells() * animationFactor();
        setTimeout(() => {
            if(gameState.combatState !== 'active') return;
            if(burn > 0){ applyDamage(player, burn); log(`Cases brûlantes : -${burn} PV.`); updateStats(); }
            if(player.hp <= 0){ handlePlayerDeath(); return; }
            if(!applyDuelRulesBeforeEnemyTurn()) return;
            enemyTurn();
        }, warnMs);
    });
}

// Délai minimal après une action du joueur, puis attente de la disparition des overlays d'animation du plateau.
const PLAYER_ACTION_PAUSE_MS = 500;   // × vitesse des animations (gameOptions.js)
function afterPlayerAnimations(callback){
    const waitOverlay = () => {
        if(document.querySelector('#board .attack-overlay')) setTimeout(waitOverlay, 100);
        else setTimeout(callback, 250 * animationFactor());
    };
    setTimeout(waitOverlay, PLAYER_ACTION_PAUSE_MS * animationFactor());
}

// Duel contre Fengmeng (duel.js) : avant chacun de ses tours normaux, les pièges restants se déclenchent,
// puis il peut piéger une nouvelle zone et préparer un tir rapide. Renvoie false si le héros y succombe.
function applyDuelRulesBeforeEnemyTurn(){
    const duel = enemy?.duel;
    if(!duel) return true;
    enemy.duelTurns = (enemy.duelTurns || 0) + 1;
    const plan = duelTurnPlan(duel, enemy.duelTurns, getTrappedCells().length);
    if(plan.detonate > 0){
        const dmg = applyDamage(player, trapDamage(plan.detonate, enemy.power ?? enemy.attack));
        log(`Les pièges de ${enemy.name} se déclenchent : ${plan.detonate} case(s) encore piégée(s), ${dmg} dégâts !`);
        playSfx('weaponHit');
    } else if(getTrappedCells().length === 0 && enemy.duelTrapLaid){
        log('Vous avez désamorcé tous les pièges !');
    }
    enemy.duelTrapLaid = false;
    setTrappedCells([]);
    updateStats();
    if(player.hp <= 0){
        handlePlayerDeath();
        return false;
    }
    if(plan.layTrap){
        setTrappedCells(pickTrapZone(boardSize));
        enemy.duelTrapLaid = true;
        log(`${enemy.name} piège une zone du plateau : détruisez ses tuiles avant son prochain tour, sinon chaque case piégée vous blessera.`);
    }
    if(plan.rapidShot){
        addBonusTurn(enemy, 1);
        log(`Tir rapide : ${enemy.name} encoche deux flèches à la fois, il rejouera !`);
    }
    return true;
}

// Règles de duel au début du combat : l'Archer Miroir copie les techniques du héros ; le héros peut entrer affaibli.
export function applyDuelRulesAtCombatStart(){
    const duel = enemy?.duel;
    if(!duel) return;
    enemy.duelTurns = 0;
    enemy.duelTrapLaid = false;
    if(duel.mirror){
        const copy = mirrorLoadout(player, getSpellsByClass(player.class, enemy.level));
        if(copy.spells.length) enemy.spells = copy.spells;
        if(copy.weapon) enemy.weapon = copy.weapon;
        if(copy.playerClass) enemy.playerClass = copy.playerClass;
        log(`${enemy.name} imite vos techniques : ${enemy.spells.map(sp => sp.name).join(', ') || 'aucun sort'}${copy.weapon ? `, ${copy.weapon.name}` : ''}.`);
    }
    if(duel.heroHpPct){
        player.hp = Math.min(player.hp, weakenedHp(player.maxHp, duel.heroHpPct));
        log(enemy.arena
            ? `L'épreuve commence durement : vous entrez avec ${player.hp}/${player.maxHp} PV.`
            : `Épuisé par neuf soleils, vous entrez dans le duel avec ${player.hp}/${player.maxHp} PV.`);
    }
}

export function enemyTurn(){
    if(gameState.combatState !== 'active'){
        return;
    }

    recordEnemyTurn();
    if(enemy.hp<=0){ handleEnemyDefeated(); return; }

    if((enemy.statusEffects?.poisoned || 0) > 0) {
        // le stuff de l'ennemi peut le protéger du poison (comme celui du héros)
        const poisonDmg = Math.max(0, Math.round(Math.max(1, Math.floor(enemy.statusEffects.poisonDamage || 1)) * (1 - stuffTotals(enemy).poisonResist / 100)));
        if(poisonDmg > 0) applyDamage(enemy, poisonDmg);
        enemy.statusEffects.poisoned--;
        log(poisonDmg > 0 ? `Poison: ${enemy.name} subit ${poisonDmg} dégâts.` : `Poison: ${enemy.name} y résiste grâce à son stuff.`);
        if(enemy.statusEffects.poisoned <= 0) {
            delete enemy.statusEffects.poisoned;
            delete enemy.statusEffects.poisonDamage;
            log(`Le poison sur ${enemy.name} se dissipe.`);
        }
        if(enemy.hp <= 0) {
            handleEnemyDefeated();
            return;
        }
    }

    // Boss semi-scripté (bossScript.js) : échauffement annoncé, puis attaque dévastatrice ; étourdi ou endormi pendant l'échauffement, il est interrompu.
    if(enemy.bossScript) {
        const script = enemy.bossScript;
        const lostTurn = (enemy.statusEffects?.stunned || 0) > 0 || isAsleep(enemy);
        const step = stepBossScript(script, enemy, { lostTurn });
        if(step.action === 'interrupted') {
            log(`${enemy.name} est interrompu : ${script.name} n'aura pas lieu !`);
            showCombatAnimation({ icon: 'dizzy', title: 'ÉCHAUFFEMENT INTERROMPU', damage: script.name, target: `→ ${enemy.name}` }, true);
        } else if(step.action === 'start') {
            setCurrentTurn('enemy');
            const pct = Math.round(script.share * 100);
            log(`${enemy.name} s'échauffe${step.phase ? ' (sa colère monte)' : ''} : ${script.name} dans ${step.left} tours (${pct} % de vos PV max). Défense, Bastion, bouclier de qì ou soin pour l'encaisser ; l'étourdir ou l'endormir l'interrompt.`);
            showCombatAnimation({ icon: 'fire', title: `${script.name.toUpperCase()} !`, damage: `Dans ${step.left} tours : ${pct} % de vos PV max`, source: enemy.name, target: 'Préparez-vous (défense, Bastion, bouclier, soin) ou étourdissez-le' }, false, { requireClick: true });
            updateStats();
            setTimeout(() => finishEnemyTurn(), 900);
            return;
        } else if(step.action === 'release') {
            setCurrentTurn('enemy');
            const hit = signatureDamage(script, player);
            if(hit.blocked) {
                log(`${enemy.name} déchaîne ${script.name}… le Bastion Infranchissable l'arrête net !`);
                showCombatAnimation({ icon: 'shield', title: script.name.toUpperCase(), heal: 'Bloqué par le Bastion', source: enemy.name, target: '→ Vous' }, false, { requireClick: true });
            } else {
                applyDamage(player, hit.damage, { damageSource: 'boss' });
                const prepared = hit.reduction > 0 ? ` (préparation : -${Math.round(hit.reduction * 100)} %)` : '';
                log(`${enemy.name} déchaîne ${script.name} : ${hit.damage} dégâts${prepared}.`);
                showCombatAnimation({ icon: 'fire', title: script.name.toUpperCase(), damage: `-${hit.damage} dégâts${prepared}`, source: enemy.name, target: '→ Vous' }, false, { requireClick: true });
            }
            updateStats();
            setTimeout(() => finishEnemyTurn(), 900);
            return;
        } else if(step.action === 'charging') {
            log(`${enemy.name} : ${script.name} au prochain tour !`);
        }
    }

    if((enemy.statusEffects?.stunned || 0) > 0) {
        enemy.statusEffects.stunned--;
        log(`${enemy.name} est étourdi et perd son tour.`);
        setCurrentTurn('enemy');
        updateStats();
        setTimeout(() => {
            finishEnemyTurn();
        }, 500);
        return;
    }

    if(isAsleep(enemy)) {   // Endormi : n'agit que s'il subit des dégâts (qui le réveillent)
        log(`${enemy.name} dort et ne peut pas agir.`);
        setCurrentTurn('enemy');
        updateStats();
        setTimeout(() => { finishEnemyTurn(); }, 500);
        return;
    }

    setCurrentTurn('enemy');
    // show turn change before action
    updateStats();
    
    // Utiliser la nouvelle IA pour prendre une décision
    const decision = tutorialCallbacks.enemyDecision?.() || makeDecision();   // tutoriel scripté : action imposée à l'adversaire
    
    // Log la décision pour debug
    logDecision(decision);
    
    // Afficher la réflexion de l'ennemi
    log(`${enemy.name} réfléchit... (${decision.reason})`);
    
    // Attendre le temps de réflexion avant d'agir
    setTimeout(()=>{
        if(gameState.combatState !== 'active'){
            return;
        }

        // Exécuter l'action choisie par l'IA
        if(decision.action === 'spell'){
            const spell = decision.data.spell;
            logActiveAction(`lance le sort ${spell.name}`);

            if(!canEntityCastSpell(enemy, spell)) {
                log(`${enemy.name} n'a plus assez de qì pour ${spell.name}.`);
                finishEnemyTurn();
                return;
            }

            consumeSpellMana(enemy, spell);
            playSfx('spellCast', { isPlayer: false, spellId: spell.id });
            if(spell.boardSpell) {   // sort de plateau : lignes et colonnes tirées au hasard ; checkMatches rend la main une fois le plateau stabilisé
                castEnemyBoardSpell(spell);
                return;
            }
            applyStandardSpellEffects(enemy, player, spell, false);
            
            // Vérifier l'état après l'action
            finishEnemyTurn();
            
        } else if(decision.action === 'weapon'){
            logActiveAction(`utilise l'arme ${enemy.weapon.name}`);
            enemy.combatPoints -= enemy.weapon.actionPoints;
            const weakenedAmount = Math.max(0, Math.floor(enemy.statusEffects?.weakenedAmount || 0));
            // Attaque de l'ennemi = chance de critique ; défense du joueur = chance de blocage
            if(confusedSelfHit(enemy)) {   // Confus : l'ennemi se frappe lui-même
                const selfStrike = resolveStrike(enemy.weapon.damage + (enemy.weaponPower || 0), enemy, enemy, { weakened: weakenedAmount });
                applyDamage(enemy, selfStrike.damage);
                playSfx('weaponHit', { isPlayer: false, rarity: enemy.weapon.rarity });
                log(`${enemy.name} est confus et se frappe avec ${enemy.weapon.name} : ${selfStrike.damage} dégâts !`);
                finishEnemyTurn();
                return;
            }
            const strike = resolveStrike(enemy.weapon.damage + (enemy.weaponPower || 0), enemy, player, { weakened: weakenedAmount });
            let dmg = strike.damage;
            if(dmg > 0 && player.damageReduction > 0) {
                dmg = Math.max(1, Math.floor(dmg * (1 - player.damageReduction)));
            }
            applyDamage(player, dmg);
            if(dmg > 0 && isVenomous(enemy.templateId) && Math.random() < POISON_CHANCE){
                const poison = inflictPoison(player, Math.max(1, Math.round((enemy.attack || 10) * 0.2)));
                log(poison > 0 ? `${enemy.name} vous empoisonne : ${poison} dégâts par tour.` : `${enemy.name} tente de vous empoisonner, mais votre équipement vous protège.`);
            }
            playSfx('weaponHit', { isPlayer: false, rarity: enemy.weapon.rarity });
            const icon = getWeaponIcon(enemy.weapon.type);
            showStrikeAnimation({ icon, title: enemy.weapon.name, source: enemy.name, target: '→ Vous' }, strike, false, dmg);
            log(`${icon} ${enemy.name} utilise ${enemy.weapon.name} ! ${dmg} dégâts.${strike.crit ? ' Coup critique !' : ''}${strike.unblockable ? ' Coup inblocable !' : ''}${strike.block === 'total' ? ' Vous bloquez entièrement le coup.' : strike.block === 'partial' ? ' Vous parez le coup.' : ''}`);
            
            // Vérifier l'état après l'action
            finishEnemyTurn();
            
        } else {
            // L'ennemi joue sur le plateau
            logActiveAction(`joue sur le plateau${decision.isStupid ? ' (mouvement hasardeux)' : ''}`);
            if(decision.randomBoardMove) {
                enemyMakeRandomMove();
            } else {
                enemyMakeMove();
            }
            // Pas besoin d'appeler finishEnemyTurn ici car checkMatches le fera
            // après avoir traité tous les combos
        }
    }, decision.thinkingTime);
}

// Armures antiques, au début de chaque tour du joueur : soin en % des PV max, flèches en % du coût de l'arme active la plus chère (au moins +1).
export function applyAncientTurnPowers(){
    const { turnHealPct, turnArrowsPct } = stuffTotals(player);
    if(turnHealPct > 0 && player.hp > 0 && player.hp < player.maxHp){
        const heal = Math.min(player.maxHp - player.hp, Math.max(1, Math.round(player.maxHp * turnHealPct / 100)));
        healEntity(player, heal);
        flyHeal(true, heal);
        log(`Heaume antique : +${heal} PV.`);
    }
    if(turnArrowsPct > 0){
        // Référence : flèches nécessaires à l'arme active la plus chère (main droite ou gauche).
        const gain = ancientArrowGain(turnArrowsPct, [player.equippedWeapon, getLeftHandWeapon()]);
        player.combatPoints = (player.combatPoints || 0) + gain;
        log(`Brassard antique : +${gain} flèche${gain > 1 ? 's' : ''}.`);
    }
}

// Fonction pour terminer le tour de l'ennemi
// Sort de plateau lancé par l'ennemi. Les sorts de balayage et de purge relancent eux-mêmes la résolution du plateau (checkMatches finit alors le tour
// de l'ennemi) ; sinon (rien à détruire, plateau inchangé) le tour se termine ici.
async function castEnemyBoardSpell(spell){
    const { snapshotBoard, applyClassSpellEffect } = await import('./classSpellEffects.js');   // import différé : classSpellEffects.js dépend de game.js
    const before = snapshotBoard();
    let applied = false;
    try { applied = await applyClassSpellEffect(spell); } catch(error) { console.error(error); }
    const changed = board.some((tile, i) => tile !== before[i]);
    if(applied === true && changed) checkMatches(true);
    else if(!changed) finishEnemyTurn();
}

export function finishEnemyTurn(){
    if(gameState.combatState !== 'active'){
        return;
    }

    if(player.hp<=0){
        handlePlayerDeath();
        return;
    }
    
    // Vérifier si l'ennemi a un tour bonus
    if(normalizeBonusTurnValue(enemy.bonusTurn) > 0){
        enemy.bonusTurn = normalizeBonusTurnValue(enemy.bonusTurn) - 1;
        const remaining = normalizeBonusTurnValue(enemy.bonusTurn);
        log(`L'ennemi a un tour bonus et rejoue !${remaining > 0 ? ` (${remaining} restant${remaining > 1 ? 's' : ''})` : ''}`);
        updateStats();
        saveUpdate();
        // L'ennemi rejoue immédiatement
        setTimeout(() => {
            enemyTurn();
        }, 1000);
    } else {
        if((enemy.statusEffects?.confused || 0) > 0) {
            enemy.statusEffects.confused--;
            if(enemy.statusEffects.confused <= 0) {
                delete enemy.statusEffects.confused;
                log(`La confusion de ${enemy.name} se dissipe.`);
            }
        }
        if((enemy.statusEffects?.weakened || 0) > 0) {
            enemy.statusEffects.weakened--;
            if(enemy.statusEffects.weakened <= 0) {
                delete enemy.statusEffects.weakened;
                delete enemy.statusEffects.weakenedAmount;
                log(`L'affaiblissement de ${enemy.name} prend fin.`);
            }
        }
        tickStatBuffs(enemy).forEach(stat => log(`Le bonus ${stat === 'attack' ? 'd\'attaque' : 'de défense'} de ${enemy.name} se dissipe.`));
        if((enemy.statusEffects?.sealed || 0) > 0) {
            enemy.statusEffects.sealed--;
            if(enemy.statusEffects.sealed <= 0) {
                delete enemy.statusEffects.sealed;
                log(`Le scellement de ${enemy.name} se dissipe.`);
            }
        }
        tickAlterations(enemy).forEach(m => log(m));
        if((player.statusEffects?.sealed || 0) > 0) {
            player.statusEffects.sealed--;
            if(player.statusEffects.sealed <= 0) {
                delete player.statusEffects.sealed;
                log('Le scellement qui vous frappait se dissipe.');
            }
        }

        // Tick des effets de durée du joueur
        if((player.statusEffects?.poisoned || 0) > 0){
            const poisonDmg = Math.max(1, Math.floor(player.statusEffects.poisonDamage || 1));
            applyDamage(player, poisonDmg);
            player.statusEffects.poisoned--;
            log(`Poison : vous subissez ${poisonDmg} dégâts.`);
            if(player.statusEffects.poisoned <= 0){
                delete player.statusEffects.poisoned;
                delete player.statusEffects.poisonDamage;
                log('Le poison se dissipe.');
            }
            updateStats();
            if(player.hp <= 0){ handlePlayerDeath(); return; }
        }
        applyAncientTurnPowers();
        tickStatBuffs(player).forEach(stat => log(`Le bonus temporaire ${stat === 'attack' ? 'd\'attaque' : 'de défense'} se dissipe.`));
        if(player.regenEffect && player.regenEffect.turnsLeft > 0) {
            healEntity(player, player.regenEffect.hp);
            flyHeal(true, player.regenEffect.hp);
            log(`Régénération : +${player.regenEffect.hp} HP.`);
            player.regenEffect.turnsLeft--;
            if(player.regenEffect.turnsLeft <= 0) {
                player.regenEffect = null;
                log(`L'effet de régénération se dissipe.`);
            }
        }
        if(player.manaMultiplier && player.manaMultiplier.turnsLeft > 0) {
            player.manaMultiplier.turnsLeft--;
            if(player.manaMultiplier.turnsLeft <= 0) {
                player.manaMultiplier = null;
                log(`L'effet du Déferlement du Qi se dissipe.`);
            }
        }
        if((player.statusEffects?.barrier || 0) > 0) {
            player.statusEffects.barrier--;
            if(player.statusEffects.barrier <= 0) {
                const bonus = Math.max(0, Math.floor(player.statusEffects.barrierDefense || 0));
                player.defense = Math.max(0, (player.defense || 0) - bonus);
                delete player.statusEffects.barrier;
                delete player.statusEffects.barrierDefense;
                log(`Rempart de Jade se dissipe (-${bonus} défense).`);
            }
        }
        if((player.statusEffects?.stoneskin || 0) > 0) {
            player.statusEffects.stoneskin--;
            if(player.statusEffects.stoneskin <= 0) {
                const bonus = Math.max(0, Math.floor(player.statusEffects.stoneskinDefense || 0));
                player.defense = Math.max(0, (player.defense || 0) - bonus);
                delete player.statusEffects.stoneskin;
                delete player.statusEffects.stoneskinDefense;
                log(`Peau de Jade se dissipe (-${bonus} défense).`);
            }
        }
        if((player.statusEffects?.enraged || 0) > 0) {
            player.statusEffects.enraged--;
            if(player.statusEffects.enraged <= 0) {
                delete player.statusEffects.enraged;
                delete player.statusEffects.enragedBonus;
                log(`Fureur des Steppes se dissipe.`);
            }
        }
        if((player.statusEffects?.strength || 0) > 0) {
            player.statusEffects.strength--;
            if(player.statusEffects.strength <= 0) {
                const bonus = Math.max(0, Math.floor(player.statusEffects.strengthBonus || 0));
                player.attack = Math.max(0, (player.attack || 0) - bonus);
                delete player.statusEffects.strength;
                delete player.statusEffects.strengthBonus;
                log(`Force du Tigre se dissipe (-${bonus} attaque).`);
            }
        }
        if((player.statusEffects?.reflectDamage || 0) > 0) {
            player.statusEffects.reflectDamage--;
            if(player.statusEffects.reflectDamage <= 0) {
                delete player.statusEffects.reflectDamage;
                delete player.statusEffects.reflectDamagePercent;
                log(`Miroir de Bronze se dissipe.`);
            }
        }
        if((player.statusEffects?.counterOnBlock || 0) > 0) {
            player.statusEffects.counterOnBlock--;
            if(player.statusEffects.counterOnBlock <= 0) {
                delete player.statusEffects.counterOnBlock;
                delete player.statusEffects.counterOnBlockDmg;
                log(`Riposte du Garde se dissipe.`);
            }
        }
        if((player.statusEffects?.shieldWall || 0) > 0) {
            player.statusEffects.shieldWall--;
            if(player.statusEffects.shieldWall <= 0) {
                delete player.statusEffects.shieldWall;
                log(`Le Bastion Infranchissable se dissipe.`);
            }
        }
        if((player.statusEffects?.immunityEffects || 0) > 0) {
            player.statusEffects.immunityEffects--;
            if(player.statusEffects.immunityEffects <= 0) {
                delete player.statusEffects.immunityEffects;
                log(`L'immunité aux effets négatifs se dissipe.`);
            }
        }
        if((player.statusEffects?.drainOnHit || 0) > 0) {
            player.statusEffects.drainOnHit--;
            if(player.statusEffects.drainOnHit <= 0) {
                delete player.statusEffects.drainOnHit;
                delete player.statusEffects.drainOnHitAmount;
                log(`L'effet des Flèches Sifflantes se dissipe.`);
            }
        }
        if((player.statusEffects?.manaShield?.turns || 0) > 0) {
            player.statusEffects.manaShield.turns--;
            if(player.statusEffects.manaShield.turns <= 0) {
                delete player.statusEffects.manaShield;
                log(`Le bouclier de qì se dissipe.`);
            }
        }
        // Objets rechargeables épuisés : le compte à rebours avance d'un tour ; à 0 ils sont de nouveau pleins.
        tickReusableRecharge(player).forEach(it => log(`${it.name} est rechargé.`));
        tickSpellCooldowns();   // temps de recharge des sorts (Brasier des Sceaux…)
        const playerSleeps = isAsleep(player);   // Endormi : le héros perd ce tour (sauf s'il a été réveillé par des dégâts)
        tickAlterations(player).forEach(m => log(m));
        // Tour suivant : joueur (définir le tour avant saveUpdate pour que les boutons dépendants du tour soient corrects)
        turnFlags.foxActed = false;
        turnFlags.companionsActed = false;
        setCurrentTurn('player');
        updateStats();
        saveUpdate();
        updateStats(); // Pour mettre à jour le liseré
        restartSuggestionTimer();
        if(playerSleeps){
            log('Vous dormez et ne pouvez pas agir ce tour-ci.');
            setTimeout(() => { if(gameState.combatState === 'active' && player.hp > 0) enemyTurn(); }, 900);
            return;
        }
        tutorialCallbacks.onPlayerTurn?.('turn');   // tutoriel scripté : début du tour du joueur
    }
}

// -------------------------------------
// progression
export function handleEnemyDefeated(){
    const levelGap = (enemy.level || 0) - (player.level || 0);   // avant le gain de niveau de fin de combat
    log(`${enemy.name} est vaincu !`);
    player.bossLossStreak = recordVictory();
    saveCombatRecord(finishCombatRecord('victory'));   // mesure d'équilibrage : durée, cycles et dégâts du combat
    playSfx('victory');
    
    // Calculer et mettre en attente l'XP (application en fin de combat)
    const xpGain = calculateXPGain(enemy, player.level);
    queueCombatXP(xpGain);
    log(`Vous gagnez ${xpGain} XP !`);

    // Pièces d'or : base liée au niveau de l'ennemi + part aléatoire + multiplicateur du profil de l'ennemi
    const enemyLvl = enemy.level || player.level || 1;
    const goldMult = enemy.dropProfile?.goldMult ?? 1.0;
    const goldBase = Math.round(enemyLvl * 3 * goldMult);
    const goldBonus = Math.floor(Math.random() * (enemyLvl * 2 + 5)) + 1;
    const goldEarned = goldBase + goldBonus;
    player.gold = (player.gold || 0) + goldEarned;
    combatRewards.gold = goldEarned;
    log(`Vous ramassez ${goldEarned} pièce${goldEarned > 1 ? 's' : ''} d'or !`);

    // Prime de l'Arène des Mille Flèches (arena.js) : or et XP en plus, croissants avec le cercle et le combat,
    // et grosse prime quand un cercle est terminé pour la première fois (son maître vaincu : `firstClear`).
    if(enemy.arena) {
        const { tier: tierId, wave } = enemy.arena;
        const bonus = arenaRewardBonus(tierId, wave, enemyLvl);
        player.gold += bonus.gold;
        combatRewards.gold += bonus.gold;
        queueCombatXP(bonus.xp);
        log(`Prime d'arène (combat ${wave}/${enemy.arena.waves}) : +${bonus.gold} or, +${bonus.xp} XP !`);
        const tier = arenaTier(tierId);
        if(tier && enemy.arena.firstClear) {
            player.gold += tier.clearGold;
            combatRewards.gold += tier.clearGold;
            queueCombatXP(tier.clearXp);
            log(`${tier.name} terminé pour la première fois : +${tier.clearGold} or, +${tier.clearXp} XP !`);
        }
    }

    // Drop de l'objet de l'ennemi (si il en avait un)
    if(enemy.inventoryItem) {
        player.inventory.push({...enemy.inventoryItem, applied: false});
        normalizeActiveInventoryIndex();
        combatRewards.items.push(enemy.inventoryItem.name);
        const rarityEmoji = getRarityIcon(enemy.inventoryItem.rarity);
        log(`${rarityEmoji} ${enemy.name} portait : ${enemy.inventoryItem.name} !`);
        if(enemy.inventoryItem.type === 'artifact') {
            applyArtifactEffects(player);
            log(`${enemy.inventoryItem.description}`);
        }
    }

    // Chance de drop selon le profil de l'ennemi (défaut : 60%)
    // (réduite pour les ennemis ordinaires : ne rien trouver est normal, voir victoryLoot.js)
    if(Math.random() < effectiveDropChance(enemy)) {
        // Répartition arme/objet selon le profil de l'ennemi (défaut : 30% arme)
        const weaponChance = enemy.dropProfile?.weaponChance ?? 0.3;
        const itemOrWeapon = Math.random();
        
        if(itemOrWeapon >= weaponChance) {
            // chance d'obtenir un objet (1 - weaponChance)
            const droppedItem = getRandomItem(player.level);
            if(droppedItem) {
                player.inventory.push({...droppedItem, applied: false});
                normalizeActiveInventoryIndex();
                combatRewards.items.push(droppedItem.name);
                const rarityEmoji = getRarityIcon(droppedItem.rarity);
                log(`${rarityEmoji} Vous obtenez : ${droppedItem.name} !`);
                // Appliquer immédiatement les effets des artefacts
                if(droppedItem.type === "artifact") {
                    applyArtifactEffects(player);
                    log(`${droppedItem.description}`);
                }
            }
        } else {
            // chance d'obtenir une arme (weaponChance)
            const availableWeapons = getAvailableWeapons(player.level + 2).filter(
                w => w.minLevel >= Math.max(1, player.level - 3)
            );
            if(availableWeapons.length > 0) {
                const randomWeapon = availableWeapons[Math.floor(Math.random() * availableWeapons.length)];
                // Vérifier si le joueur possède déjà cette arme
                if(!player.weapons.some(w => w.id === randomWeapon.id)) {
                    player.weapons.push(randomWeapon);
                    combatRewards.weapons.push(randomWeapon.name);
                    // Mettre à jour la liste des armes disponibles du joueur
                    updateAvailableWeapons();
                    const icon = getWeaponIcon(randomWeapon.type);
                    log(`${icon} Vous obtenez : ${randomWeapon.name} !`);
                } else {
                    // Arme déjà possédée : convertir en or
                    const bonusGold = Math.floor(randomWeapon.minLevel * 2 + 5);
                    player.gold = (player.gold || 0) + bonusGold;
                    combatRewards.gold += bonusGold;
                    log(`Arme déjà possédée, convertie en ${bonusGold} pièce${bonusGold > 1 ? 's' : ''} d'or.`);
                }
            }
        }
    } else if(levelGap <= 0) {
        log(`L'ennemi ne laisse rien derrière lui...`);
    }

    // Ennemi de niveau supérieur : butin rare garanti, du niveau du joueur (voir victoryLoot.js)
    rollOverleveledLoot(levelGap, player).forEach(entry => {
        const rarityEmoji = getRarityIcon(entry.rarity);
        if(entry.kind === 'weapon') {
            player.weapons.push(entry.weapon);
            combatRewards.weapons.push(entry.weapon.name);
            updateAvailableWeapons();
            log(`${rarityEmoji} ${enemy.name} était plus fort que vous : vous obtenez ${entry.weapon.name} !`);
        } else {
            player.inventory.push({...entry.item, applied: false});
            normalizeActiveInventoryIndex();
            combatRewards.items.push(entry.item.name);
            log(`${rarityEmoji} ${enemy.name} était plus fort que vous : vous obtenez ${entry.item.name} !`);
            if(entry.item.type === 'artifact') {
                applyArtifactEffects(player);
                log(`${entry.item.description}`);
            }
        }
    });

    // Stuff : on peut récupérer ce que l'ennemi portait (enemyStuff.js) ; la meilleure pièce est garantie contre un ennemi plus fort.
    rollEnemyStuffDrops(enemy, player, { gap: levelGap }).forEach(piece => {
        const label = grantStuffPiece(piece.id, `${enemy.name} portait`);
        if(label) combatRewards.items.push(label);
    });

    const xpResult = applyCombatXPAtEnd();
    if(xpResult.leveledUp) {
        log(`Niveau ${player.level} atteint ! +${xpResult.maxHpGained} HP max, +${xpResult.hpRecovered} HP de recuperation.`);
        if(xpResult.levelsGained > 1) {
            log(`Vous avez gagné ${xpResult.levelsGained} niveaux d'un coup !`);
        }
        updateAvailableSpells();
        updateAvailableWeapons();
        updateInventoryTab();
        showAttributeMenu();
    } else {
        log(`Progression: ${player.xp}/${player.xpToNextLevel} XP`);
    }

    if(enemy.isBoss) {
        const bossTier = Math.max(5, Math.floor(enemy.bossTier || enemy.level || 5));
        if(!Array.isArray(player.defeatedBossTiers)) {
            player.defeatedBossTiers = [];
        }
        if(!player.defeatedBossTiers.includes(bossTier)) {
            player.defeatedBossTiers.push(bossTier);
            player.defeatedBossTiers.sort((a, b) => a - b);
        }
        if(player.pendingBoss && player.pendingBoss.tier === bossTier) {
            player.pendingBoss = null;
        }
        log(`Boss du palier ${bossTier} vaincu !`);
    }

    combatHooks.onVictory?.();
    saveUpdate();
    
    // Marquer le combat comme terminé
    gameState.combatState = 'finished';

    // Notifier le tutoriel que l'ennemi est vaincu
    tutorialCallbacks.onEnemyDefeated?.();

    showEndCombatAnimation(true);
}
