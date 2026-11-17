// Gestion des effets spéciaux des sorts de classe

import { escapeHtml } from "./escapeHtml.js";
import { flyManaGain } from "./manaFlight.js";
import { player, enemy, currentTurn, log, showCombatAnimation, finishPlayerTurn, applyDamage, addBonusTurn, addManaForColor, skullDamage, playFighterAttack, grantBigMatchXP } from "./game.js";
import { board, checkMatches, claimMatchBonusTurn } from "./board.js";
import { colors } from "./constants.js";
import { resolveStrike, skullStrengthBonus } from "./combatStats.js";
import { playSfx } from "./sound.js";


import { skullValue } from "./joker.js";
import { applyChasm, applyDarkChannels, applyFingerOfDeath, applyFireballArea, applyFlameBolts, applyFlameblade, applyHandOfIce, applyIceShield, applyMageStrike, applyShadowCurse, applyWeakness, applyWildMana } from './classSpellsMage.js';
import { applyColorsToActionGems, applyActionGemsToMana, applyActionGemsToSkulls, applyActionGemsToColor } from './classSpellsActionGems.js';
import { applyAlterEnemy } from './classSpellsAlterations.js';
import { applyBarrier, applyBloodlust, applyCleave, applyConfuse, applyCounterAttack, applyDefensiveWall, applyDivinePower, applyDualShot, applyEnrage, applyFocus, applyHeavensWrath, applyHoldTheLine, applyBlockAll, applyIntimidate, applyManaSiphon, applyMirrorShield, applyPoison, applyReinforce, applyRush, applyShadowStrike, applyShieldBash, applySneakAttack, applyStatBuffSpell, applyStealth, applyStoneskin, applyStrength, applySwiftStrike, applyThrowAxe } from './classSpellsWarrior.js';
import { applyBerserkerRage, applyCageEnemy, applyClearColor, applyDeathbringer, applyHarmony, applyRageGain, applyRageToDamage, applyRageToMana, applyRevenant, applySecondWind, applySingingBlades, applySkullsFromColors, applyStarRain, applySummonTempest, applySweepLines, applyUltimate } from './classSpellsAdvanced.js';

export function getManaCap(color) {
    return player.manaCaps?.[color] ?? player.maxMana;
}

export function getCurrentCaster() {
    return currentTurn === 'enemy' ? enemy : player;
}

// Qì des gemmes détruites, plus effets des flèches et crânes détruits (comme s'ils avaient été combinés).
export function collectDestroyedColorTilesMana(caster, destroyedTiles = []) {
    const result = collectDestroyedManaOnly(caster, destroyedTiles);
    result.special = collectDestroyedSpecialTiles(caster, destroyedTiles);
    return result;
}

function collectDestroyedManaOnly(caster, destroyedTiles = []) {
    if(!caster || !caster.mana) return { total: 0, byColor: {} };

    const byColor = { red: 0, blue: 0, green: 0, yellow: 0, purple: 0 };
    destroyedTiles.forEach(tile => {
        if(colors.includes(tile)) {
            byColor[tile] = (byColor[tile] || 0) + 1;
        }
    });

    let total = 0;
    const gainedByColor = {};
    Object.entries(byColor).forEach(([color, amount]) => {
        if(amount <= 0) return;
        const manaResult = addManaForColor(caster, color, amount, { applyGainBonus: false });
        total += manaResult.gained;
        gainedByColor[color] = manaResult.gained;
    });
    flyManaGain(caster === player, gainedByColor, { fromBoard: true });

    return { total, byColor };
}

// Flèches (points de combat) et crânes (dégâts) détruits par un sort de lignes/colonnes : ils comptent comme lors d'un match
// (1 point de combat par flèche, dégâts de crâne du lanceur contre son adversaire), en plus du qì des gemmes.
function collectDestroyedSpecialTiles(caster, destroyedTiles = []) {
    const arrows = destroyedTiles.filter(t => t === 'combat').length;
    const skulls = destroyedTiles.reduce((n, t) => n + skullValue(t), 0);   // un crâne +5 vaut 5 crânes
    if(arrows > 0) {
        caster.combatPoints = (caster.combatPoints || 0) + arrows;
        log(`+${arrows} point(s) de combat (flèches détruites) pour ${escapeHtml(caster.name)}.`);
    }
    let skullDmg = 0;
    if(skulls > 0) {
        const opponent = caster === player ? enemy : player;
        const weakened = caster === enemy ? Math.max(0, Math.floor(enemy.statusEffects?.weakenedAmount || 0)) : 0;
        const strike = resolveStrike(skulls * (skullDamage + skullStrengthBonus(caster)), caster, opponent, { weakened });
        skullDmg = strike.damage;
        if(skullDmg > 0 && opponent === player && player.damageReduction > 0) {
            skullDmg = Math.max(1, Math.floor(skullDmg * (1 - player.damageReduction)));
        }
        playFighterAttack(caster === player);
        playSfx('skullHit', { matchType: 'skull', length: skulls, isPlayer: caster === player });
        if(skullDmg > 0) applyDamage(opponent, skullDmg);
        log(`${skulls} crâne(s) détruit(s) : -${skullDmg} PV pour ${opponent.name}.${strike.crit ? ' (critique !)' : ''}${strike.block === 'total' ? ' (bloqué)' : strike.block === 'partial' ? ' (paré)' : ''}`);
        // Comme un match de 4+ crânes : tour bonus (un seul par tour, cascade comprise), et XP des belles combinaisons pour le joueur.
        if(skulls >= 4 && claimMatchBonusTurn()) {
            addBonusTurn(caster);
            playSfx('turnBonus');
            log(`${skulls} crânes détruits : tour bonus gagné par ${caster === player ? 'le joueur' : "l'ennemi"}`);
            showCombatAnimation({ icon: 'gift', title: 'TOUR BONUS !', damage: `${skulls} crânes détruits`, target: caster === player ? 'Vous rejouez !' : "L'ennemi rejoue !" }, caster === player);
        }
        if(skulls >= 4 && caster === player) {
            const bonusXp = grantBigMatchXP(skulls);
            if(bonusXp > 0) log(`+${bonusXp} XP (belle combinaison)`);
        }
    }
    return { arrows, skulls, skullDmg };
}

// Photo du plateau avant un sort : sert à savoir si le sort l'a modifié (voir endPlayerSpellTurn).
export function snapshotBoard() {
    return board.slice();
}

// Fin du tour après un sort de classe qui a réussi. Si le sort a modifié le plateau (cases détruites ou transformées, avec
// régénération partielle ou complète), on NE passe PAS la main tout de suite : on attend la fin de la régénération, puis les
// combinaisons déclenchées par la chute se résolvent encore pendant le tour de celui qui a lancé le sort (qì, dégâts , tours
// bonus : un seul par tour, voir claimMatchBonusTurn). `checkMatches` termine le tour du joueur quand plus rien ne bouge.
export function endPlayerSpellTurn(before) {
    const changed = Array.isArray(before) && board.some((tile, i) => tile !== before[i]);
    if(changed) checkMatches(true);
    else finishPlayerTurn();
}

// Applique l'effet d'un sort de classe
export function applyClassSpellEffect(spell) {
    switch(spell.effect) {
        case 'scaleWithBlue': // Frappe du Maître Taoïste
            return applyMageStrike(spell);
        case 'createJoker': // Qi Sauvage
            return applyWildMana(spell);
        case 'preventItems': // Talisman de Scellement
            return applyShadowCurse(spell);
        case 'destroyColor': // Méridiens Obscurs
            return applyDarkChannels(spell);
        case 'yellowBolts': // Talismans Enflammés
            return applyFlameBolts(spell);
        case 'damageToMana': // Rempart de Jade de Givre
            return applyIceShield(spell);
        case 'enchantWeapon': // Lame de Feu Pourpre
            return applyFlameblade(spell);
        case 'reduceEnemyAtk': // Sceau d'Affaiblissement
            return applyWeakness(spell);
        case 'alterEnemy': // Muet, Maudit, Pétrifié, Endormi, Épuisé, Corrompu
            return applyAlterEnemy(spell);
        case 'freezeEnemy': // Paume de Givre
            return applyHandOfIce(spell);
        case 'createSkull': // Doigt de la Mort
            return applyFingerOfDeath(spell);
        case 'destroyArea': // Abîme
            return applyChasm(spell);
        case 'statBuff': // Œil du Tigre, Pas de l'Ombre, Flèche Affûtée, Aura de Commandement, Cri de Guerre
            return applyStatBuffSpell(spell);
        case 'increaseDefense': // Peau de Jade
            return applyStoneskin(spell);
        case 'increasePhysical': // Force
            return applyStrength(spell);
        case 'fireballArea': // Sphère de Flammes
            return applyFireballArea(spell);
        case 'reflectDamage': // Miroir de Bronze
            return applyMirrorShield(spell);
        case 'drainMana': // Aspiration du Qi
            return applyManaSiphon(spell);
        case 'bonusTurn': // Tir Furtif
            return applySneakAttack(spell);
        case 'yellowToPurple': // Tir Rapide
            return applySwiftStrike(spell);
        case 'reduceManaGain': // Flèche de Brume
            return applyConfuse(spell);
        case 'damageToManaPurple': // Voile de Brume
            return applyStealth(spell);
        case 'applyPoison': // Flèche Empoisonnée
            return applyPoison(spell);
        case 'destroyPurple': // Flèche d'Ombre
            return applyShadowStrike(spell);
        case 'dualWeaponAttack': // Flèches Jumelles
            return applyDualShot(spell);
        case 'purpleToDefense': // Muraille Impériale
            return applyDefensiveWall(spell);
        case 'defenseAttack': // Coup de Bouclier Rond
            return applyShieldBash(spell);
        case 'createActionGem': // Concentration du Qi
            return applyFocus(spell);
        case 'colorsToActionGems': // Forge des Légions
            return applyColorsToActionGems(spell);
        case 'actionGemsToMana': // Moisson d'Acier
            return applyActionGemsToMana(spell);
        case 'actionGemsToSkulls': // Lames Brisées
            return applyActionGemsToSkulls(spell);
        case 'actionGemsToColor': // Mue d'Acier
            return applyActionGemsToColor(spell);
        case 'stealCP': // Regard Impérial
            return applyIntimidate(spell);
        case 'stunEnemy': // Charge de Cavalerie
            return applyRush(spell);
        case 'counterOnBlock': // Riposte du Garde
            return applyCounterAttack(spell);
        case 'destroyActionGemHeal': // Renfort des Troupes
            return applyReinforce(spell);
        case 'massiveDefense': // Rempart de Jade
            return applyBarrier(spell);
        case 'defenseToMana': // Mandat du Ciel
            return applyDivinePower(spell);
        case 'immunityEffects': // Formation de la Tortue
            return applyHoldTheLine(spell);
        case 'blockAll': // Bastion Infranchissable
            return applyBlockAll(spell);
        case 'explodeActionGems': // Courroux du Ciel
            return applyHeavensWrath(spell);
        case 'damageBoost': // Rage
            return applyEnrage(spell);
        case 'yellowDamage': // Entaille de la Horde
            return applyCleave(spell);
        case 'skullBonus': // Lancer de Hache
            return applyThrowAxe(spell);
        case 'giveRedMana': // Soif de Bataille
            return applyBloodlust(spell);
        case 'destroyColumns': // Appel du Vent Céleste
            return applySummonTempest(spell);
        case 'redToSkulls': // Fureur du Loup des Steppes
            return applyBerserkerRage(spell);
        case 'drainOnHit': // Flèches Sifflantes
            return applySingingBlades(spell);
        case 'redToSkullsHalf': // Porte-Crânes
            return applyDeathbringer(spell);
        case 'doubleBattle': // Esprit des Ancêtres
            return applyRevenant(spell);
        case 'rageGain': // Sang en Ébullition
            return applyRageGain(spell);
        case 'rageToMana': // Souffle de la Colère
            return applyRageToMana(spell);
        case 'rageToDamage': // Coup de la Fureur Brisée
            return applyRageToDamage(spell);
        case 'ultimate': // Sorts ultimes (jauge de rage)
            return applyUltimate(spell);
        // Sorts avancés multi-qì (3 à 5 couleurs), génériques
        case 'sweepRow': // Lame des Quatre Vents
            return applySweepLines(spell, 'row');
        case 'sweepCol': // Fente de Givre, Entaille du Vent…
            return applySweepLines(spell, 'col');
        case 'sweepCross': // Croix du Dragon
            return applySweepLines(spell, 'cross');
        case 'clearColor': // Purges : toutes les gemmes des couleurs du sort
            return applyClearColor(spell);
        case 'skullsFromColors': // Brasier des Sceaux
            return applySkullsFromColors(spell);
        case 'cageEnemy': // Prison du Tonnerre Glacé
            return applyCageEnemy(spell);
        case 'secondWind': // Souffle de Jade Céleste
            return applySecondWind(spell);
        case 'starRain': // Pluie des Mille Étoiles
            return applyStarRain(spell);
        case 'harmony': // Harmonie des Cinq Éléments
            return applyHarmony(spell);
        default:
            log(`Effet inconnu: ${spell.effect}`);
            return false;
    }
}

// SORCERER SPELLS
