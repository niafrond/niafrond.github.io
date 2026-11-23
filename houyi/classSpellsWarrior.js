// Sorts de classe : bonus de caractéristiques, guerrier, templier, barbare (renforts, barrière, enragement, hache…). Extrait de classSpellEffects.js.
import { escapeHtml } from "./escapeHtml.js";
import { flyManaGain, flyManaSteal, flyHeal } from './manaFlight.js';
import { healEntity, inflictTurnLoss } from './alterations.js';
import { player, enemy, log, saveUpdate, showCombatAnimation, applyDamage, lastSpellDamage, addBonusTurn, grantActionBonus } from './game.js';
import { board, renderBoard, setBoardTargetingMode, checkMatches } from './board.js';
import { stackStatusEffect, addStatBuff, describeStatBuff } from './combatStats.js';
import { isJokerTile, skullValue } from './joker.js';
import { collectDestroyedColorTilesMana, getCurrentCaster, getManaCap } from './classSpellEffects.js';

// Bonus temporaire d'attaque (critique) et/ou de défense (blocage) en %, voir combatStats.js.
export function applyStatBuffSpell(spell) {
    const buff = { attack: spell.atkBuff || 0, defense: spell.defBuff || 0, turns: spell.duration || 1 };
    addStatBuff(player, buff);
    showCombatAnimation({ icon: buff.attack > 0 ? 'sword' : 'shield', title: spell.name.toUpperCase(), heal: describeStatBuff(buff), target: '→ Vous' }, true);
    log(`${spell.name} : ${describeStatBuff(buff)}.`);
    return true;
}

export function applyStoneskin(spell) {
    const bonus = Math.max(0, Math.floor(spell.defenseBonus || 0));
    const turns = Math.max(1, Math.floor(spell.duration || 1));
    stackStatusEffect(player.statusEffects, 'stoneskin', 'stoneskinDefense', turns, bonus);
    player.defense = (player.defense || 0) + bonus;
    showCombatAnimation({ icon: 'rock', title: (spell.name || "PEAU DE JADE").toUpperCase(), heal: `+${bonus} défense`, target: `→ Vous (${turns} tours)` }, true);
    log(`${spell.name} augmente la défense de ${bonus} pendant ${turns} tours.`);
    return true;
}

export function applyStrength(spell) {
    const bonus = Math.max(0, Math.floor(spell.atkBonus || 0));
    const turns = Math.max(1, Math.floor(spell.duration || 1));
    stackStatusEffect(player.statusEffects, 'strength', 'strengthBonus', turns, bonus);
    player.attack += bonus;
    showCombatAnimation({ icon: 'muscle', title: (spell.name || "FORCE DU TIGRE").toUpperCase(), damage: `+${bonus} attaque`, target: `→ Vous (${turns} tours)` }, true);
    log(`Force augmente l'attaque physique de ${bonus} pendant ${turns} tours.`);
    return true;
}

export function applyMirrorShield(spell) {
    const percent = Math.max(0, Math.floor(spell.reflectPercent || 0));
    const turns = Math.max(1, Math.floor(spell.duration || 1));
    stackStatusEffect(player.statusEffects, 'reflectDamage', 'reflectDamagePercent', turns, percent, 100);
    showCombatAnimation({ icon: 'mirror', title: (spell.name || "MIROIR DE BRONZE").toUpperCase(), damage: `${percent}% renvoyés`, target: `→ Vous (${turns} tours)` }, true);
    log(`Miroir de Bronze renverra ${percent}% des dégâts pendant ${turns} tours.`);
    return true;
}

export function applyManaSiphon(spell) {
    const stealTotal = Math.max(0, Math.floor(spell.manaSteal || 0));
    if(stealTotal <= 0) {
        log(`${spell.name} n'a aucun effet (manaSteal invalide).`);
        return false;
    }

    const manaColors = ['red', 'blue', 'green', 'yellow', 'purple'];
    const stealPerColor = Math.max(1, Math.floor(stealTotal / manaColors.length));
    let drained = 0;
    const stolen = {};

    manaColors.forEach(color => {
        const amount = Math.min(stealPerColor, enemy.mana[color] || 0);
        if(amount > 0) {
            stolen[color] = amount;
            enemy.mana[color] -= amount;
            player.mana[color] = Math.min(getManaCap(color), (player.mana[color] || 0) + amount);
            drained += amount;
        }
    });

    flyManaSteal(true, stolen);
    showCombatAnimation({ icon: 'swirl', title: (spell.name || "ASPIRATION DU QI").toUpperCase(), damage: `-${drained} qì ennemi`, target: '→ Vous' }, true);
    log(`${spell.name} absorbe ${drained} qì ennemi.`);
    return true;
}

// ASSASSIN SPELLS
export function applySneakAttack(spell) {
    applyDamage(enemy, spell.dmg, { sourceSpell: spell });
    const sneakDmg = lastSpellDamage(spell.dmg);
    const refilled = grantActionBonus(player, spell);   // actions indépendantes du plateau : la barre d'action se remplit aussitôt
    showCombatAnimation({ icon: 'sword', title: (spell.name || "TIR FURTIF").toUpperCase(), damage: `-${sneakDmg} dégâts · ${refilled ? 'BARRE REMPLIE' : 'TOUR BONUS'}`, target: `→ ${enemy.name} · ${refilled ? 'vous pouvez agir de nouveau !' : 'tour bonus en réserve'}` }, true);
    log(refilled ? `Tir Furtif inflige ${sneakDmg} dégâts et remplit aussitôt votre barre d'action !` : `Tir Furtif inflige ${sneakDmg} dégâts et vous donne un tour bonus !`);
    return true;
}

export function applySwiftStrike(spell) {
    let count = 0;
    for(let i = 0; i < board.length; i++) {
        if(board[i] === 'yellow') {
            board[i] = 'purple';
            count++;
        }
    }
    let dmg = count * 2;
    applyDamage(enemy, dmg, { sourceSpell: spell });
    dmg = lastSpellDamage(dmg);
    renderBoard();
    showCombatAnimation({ icon: 'bolt', title: (spell.name || "TIR RAPIDE").toUpperCase(), damage: `-${dmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`Tir Rapide convertit ${count} gâteaux de lune jaunes et inflige ${dmg} dégâts !`);
    return true;
}

export function applyConfuse(spell) {
    enemy.statusEffects.confused = spell.duration;
    showCombatAnimation({ icon: 'dizzy', title: (spell.name || "FLÈCHE DE BRUME").toUpperCase(), damage: '−qì/combo', target: `→ ${enemy.name} (${spell.duration} tours)` }, true);
    log(`Flèche de Brume : l'ennemi est confus pendant ${spell.duration} tours : 1 qì par combinaison, et ses attaques peuvent se retourner contre lui !`);
    return true;
}

export function applyStealth(spell) {
    const turns = spell.duration || 1;
    player.statusEffects.manaShield = { color: 'purple', turns };
    showCombatAnimation({ icon: 'eye', title: (spell.name || "VOILE DE BRUME").toUpperCase(), damage: 'Dégâts -> qì violet', target: `→ Vous (${turns} tour${turns > 1 ? 's' : ''})` }, true);
    log(`${spell.name} active: les prochains dégâts sont absorbés par le qì violet.`);
    return true;
}

export function applyPoison(spell) {
    enemy.statusEffects.poisoned = spell.duration;
    enemy.statusEffects.poisonDamage = spell.poisonDmg;
    showCombatAnimation({ icon: 'poison', title: (spell.name || "FLÈCHE EMPOISONNÉE").toUpperCase(), damage: `${spell.poisonDmg} dégâts/tour`, target: `→ ${enemy.name} (${spell.duration} tours)` }, true);
    log(`${spell.name} applique un poison de ${spell.poisonDmg} dégâts/tour pendant ${spell.duration} tours !`);
    return true;
}

export function applyShadowStrike(spell) {
    const caster = getCurrentCaster();
    let count = 0;
    const destroyedTiles = [];
    for(let i = 0; i < board.length; i++) {
        if(board[i] === 'purple') {
            count++;
            destroyedTiles.push(board[i]);
            board[i] = null;
        }
    }
    const manaCollected = collectDestroyedColorTilesMana(caster, destroyedTiles);
    let dmg = count * 2;
    applyDamage(enemy, dmg, { sourceSpell: spell });
    dmg = lastSpellDamage(dmg);
    renderBoard();
    showCombatAnimation({ icon: 'moon', title: (spell.name || "FLÈCHE D'OMBRE").toUpperCase(), damage: `-${dmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`Flèche d'Ombre détruit ${count} gâteaux de lune violettes, inflige ${dmg} dégâts et fait récupérer ${manaCollected.total} qì à ${escapeHtml(caster.name)}.`);
    return true;
}

export function applyDualShot(spell) {
    const weapons = Array.isArray(player.weapons) ? player.weapons.filter(w => !w.companion) : [];
    if(weapons.length < 2) {
        log(`Flèches Jumelles nécessite au moins 2 armes dans l'inventaire.`);
        return false;
    }

    const sorted = [...weapons].sort((a, b) => (b.damage || 0) - (a.damage || 0));
    let totalDmg = Math.max(1, Math.floor((sorted[0].damage || 0) + (sorted[1].damage || 0)));
    applyDamage(enemy, totalDmg, { sourceSpell: spell });
    totalDmg = lastSpellDamage(totalDmg);
    showCombatAnimation({ icon: 'target', title: (spell.name || "FLÈCHES JUMELLES").toUpperCase(), damage: `-${totalDmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`Flèches Jumelles inflige ${totalDmg} dégâts (2 meilleures armes + attaque).`);
    return true;
}

// TEMPLAR SPELLS
export function applyDefensiveWall(spell) {
    const caster = getCurrentCaster();
    let count = 0;
    const destroyedTiles = [];
    for(let i = 0; i < board.length; i++) {
        if(board[i] === 'purple') {
            count++;
            destroyedTiles.push(board[i]);
            board[i] = null;
        }
    }
    const manaCollected = collectDestroyedColorTilesMana(caster, destroyedTiles);
    const defenseGain = count * 5;
    player.defense = (player.defense || 0) + defenseGain;
    renderBoard();
    showCombatAnimation({ icon: 'shield', title: (spell.name || "MURAILLE IMPÉRIALE").toUpperCase(), heal: `+${defenseGain} défense`, target: '→ Vous' }, true);
    log(`${spell.name} détruit ${count} gâteaux de lune violettes: +${defenseGain} défense et +${manaCollected.total} qì pour ${escapeHtml(caster.name)}.`);
    return true;
}

export function applyShieldBash(spell) {
    const defense = player.defense || 0;
    const bonusDmg = Math.floor(defense / 3);
    let totalDmg = spell.baseDmg + bonusDmg;
    applyDamage(enemy, totalDmg, { sourceSpell: spell });
    totalDmg = lastSpellDamage(totalDmg);
    // Retirer les statuts négatifs
    delete player.statusEffects.poisoned;
    delete player.statusEffects.stunned;
    delete player.statusEffects.weakened;
    showCombatAnimation({ icon: 'shield', title: (spell.name || "COUP DE BOUCLIER ROND").toUpperCase(), damage: `-${totalDmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`Coup de Bouclier Rond inflige ${totalDmg} dégâts et retire les statuts négatifs !`);
    return true;
}

export function applyFocus(spell) {
    const hasCandidate = board.some(tile => tile && !isJokerTile(tile) && tile !== 'combat');
    if(!hasCandidate) {
        log(`Aucune gemme valide à transformer en Action Gem.`);
        return false;
    }

    setBoardTargetingMode({
        highlightPredicate: (_index, tile) => tile && !isJokerTile(tile) && tile !== 'combat',
        onTileClick: (index, tile) => {
            if(!tile || isJokerTile(tile) || tile === 'combat') {
                log(`Choisissez une gemme valide pour Concentration du Qi.`);
                return true;
            }

            board[index] = 'combat';
            setBoardTargetingMode(null);
            renderBoard();
            showCombatAnimation({ icon: 'sword', title: (spell.name || "CONCENTRATION DU QI").toUpperCase(), damage: 'Flèche créée', target: '→ Plateau' }, true);
            log(`Concentration du Qi transforme la gemme choisie en Action Gem.`);
            saveUpdate();
            checkMatches(true);
            return true;
        }
    });

    log(`Concentration du Qi: choisissez une gemme à transformer en Action Gem.`);
    return false;
}

export function applyIntimidate(spell) {
    const stolen = Math.min(spell.cpSteal, enemy.combatPoints);
    enemy.combatPoints -= stolen;
    player.combatPoints += stolen;
    showCombatAnimation({ icon: 'anger', title: (spell.name || "REGARD IMPÉRIAL").toUpperCase(), damage: `-${stolen} PA`, target: `→ ${enemy.name}` }, true);
    log(`Regard Impérial vole ${stolen} points de combat à l'ennemi !`);
    return true;
}

export function applyRush(spell) {
    const stun = inflictTurnLoss(enemy, 'stunned', 2);   // plafonné à 2 tours ; ne se cumule pas avec un autre étourdissement ou sommeil
    if(!stun.landed) {
        showCombatAnimation({ icon: 'wind', title: (spell.name || "CHARGE DE CAVALERIE").toUpperCase(), damage: 'Résisté', target: `→ ${enemy.name}` }, true);
        log(stun.reason === 'immune' ? `${enemy.name} est immunisé contre « ${spell.name} ».` : `${enemy.name} résiste à « ${spell.name} » (résistance aux contrôles).`);
        return true;
    }
    showCombatAnimation({ icon: 'wind', title: (spell.name || "CHARGE DE CAVALERIE").toUpperCase(), damage: `Étourdi ${stun.turns} tours`, target: `→ ${enemy.name}` }, true);
    log(`${spell.name} étourdit l'ennemi pour ${stun.turns} tours !`);
    return true;
}

export function applyCounterAttack(spell) {
    const turns = Math.max(1, Math.floor(spell.duration || 1));
    const counterDmg = Math.max(1, Math.floor(spell.counterDmg || 1));
    player.statusEffects.counterOnBlock = turns;
    player.statusEffects.counterOnBlockDmg = counterDmg;
    showCombatAnimation({ icon: 'shield', title: (spell.name || "RIPOSTE DU GARDE").toUpperCase(), damage: `${counterDmg} dégâts de riposte`, target: `→ Vous (${turns} tours)` }, true);
    log(`${spell.name} active: ${counterDmg} dégâts renvoyés en blocage pendant ${turns} tours.`);
    return true;
}

export function applyReinforce(spell) {
    let count = 0;
    for(let i = 0; i < board.length; i++) {
        if(board[i] === 'combat') {
            board[i] = null;
            count++;
        }
    }

    if(count <= 0) {
        log(`Aucune Action Gem à détruire pour ${spell.name}.`);
        return false;
    }

    const heal = count * Math.max(1, Math.floor(spell.healPerGem || 1));
    healEntity(player, heal);   // Corrompu : le soin blesse
    flyHeal(true, heal);
    renderBoard();
    showCombatAnimation({ icon: 'spark', title: (spell.name || "RENFORT DES TROUPES").toUpperCase(), heal: `+${heal} HP`, target: '→ Vous' }, true);
    log(`${spell.name} détruit ${count} Action Gem(s) et soigne ${heal} HP.`);
    return true;
}

export function applyBarrier(spell) {
    stackStatusEffect(player.statusEffects, 'barrier', 'barrierDefense', spell.duration, spell.defenseBonus);
    player.defense = (player.defense || 0) + spell.defenseBonus;
    showCombatAnimation({ icon: 'shield', title: (spell.name || "REMPART DE JADE").toUpperCase(), heal: `+${spell.defenseBonus} défense`, target: `→ Vous (${spell.duration} tours)` }, true);
    log(`${spell.name} augmente la défense de ${spell.defenseBonus} pendant ${spell.duration} tours !`);
    return true;
}

export function applyDivinePower(spell) {
    const defense = Math.max(0, Math.floor(player.defense || 0));
    const yellowGain = Math.floor(defense / 5);
    if(yellowGain <= 0) {
        log(`Défense insuffisante pour générer du qì jaune.`);
        return false;
    }

    player.mana.yellow = Math.min(getManaCap('yellow'), player.mana.yellow + yellowGain);
    flyManaGain(true, { yellow: yellowGain });
    showCombatAnimation({ icon: 'star', title: (spell.name || "MANDAT DU CIEL").toUpperCase(), heal: `+${yellowGain} qì jaune`, target: '→ Vous' }, true);
    log(`Mandat du Ciel convertit la défense en +${yellowGain} qì jaune.`);
    return true;
}

export function applyHoldTheLine(spell) {
    const turns = Math.max(1, Math.floor(spell.duration || 1));
    player.statusEffects.immunityEffects = turns;
    showCombatAnimation({ icon: 'shield', title: (spell.name || "FORMATION DE LA TORTUE").toUpperCase(), damage: 'Immunité aux effets', target: `→ Vous (${turns} tours)` }, true);
    log(`${spell.name}: immunité aux effets négatifs pendant ${turns} tours.`);
    return true;
}

export function applyBlockAll(spell) {
    const turns = Math.max(1, Math.floor(spell.duration || 1));
    player.statusEffects.shieldWall = Math.max(player.statusEffects.shieldWall || 0, turns);
    showCombatAnimation({ icon: 'shield', title: (spell.name || "BASTION INFRANCHISSABLE").toUpperCase(), damage: 'Blocage total', target: `→ Vous (${turns} tours)` }, true);
    log(`Bastion Infranchissable: toutes les attaques sont bloquées pendant ${turns} tours.`);
    return true;
}

export function applyHeavensWrath(spell) {
    let count = 0;
    for(let i = 0; i < board.length; i++) {
        if(board[i] === 'combat') {
            board[i] = null;
            count++;
        }
    }

    const dmgPerGem = Math.max(1, Math.floor(spell.dmgPerGem || 1));
    let totalDmg = count * dmgPerGem;
    if(totalDmg <= 0) {
        log(`Aucune Action Gem à faire exploser.`);
        return false;
    }

    applyDamage(enemy, totalDmg, { sourceSpell: spell });
    totalDmg = lastSpellDamage(totalDmg);
    renderBoard();
    showCombatAnimation({ icon: 'bolt', title: (spell.name || "COURROUX DU CIEL").toUpperCase(), damage: `-${totalDmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`Courroux du Ciel fait exploser ${count} Action Gem(s) pour ${totalDmg} dégâts.`);
    return true;
}

// BARBARIAN SPELLS
export function applyEnrage(spell) {
    stackStatusEffect(player.statusEffects, 'enraged', 'enragedBonus', spell.duration, spell.atkBonus);
    grantActionBonus(player, spell);   // la barre d'action se remplit aussitôt (tour bonus d'avant)
    showCombatAnimation({ icon: 'anger', title: (spell.name || "FUREUR DES STEPPES").toUpperCase(), damage: `+${spell.atkBonus} dégâts`, target: `→ Vous (${spell.duration} tours)` }, true);
    log(`Fureur des Steppes augmente de ${spell.atkBonus} tous vos dégâts (crânes, armes, sorts) pendant ${spell.duration} tours !`);
    return true;
}

export function applyCleave(spell) {
    const caster = getCurrentCaster();
    let count = 0;
    const destroyedTiles = [];
    for(let i = 0; i < board.length; i++) {
        if(board[i] === 'yellow') {
            count++;
            destroyedTiles.push(board[i]);
            board[i] = null;
        }
    }
    const manaCollected = collectDestroyedColorTilesMana(caster, destroyedTiles);
    let dmg = count * 2;
    applyDamage(enemy, dmg, { sourceSpell: spell });
    dmg = lastSpellDamage(dmg);
    renderBoard();
    showCombatAnimation({ icon: 'axe', title: (spell.name || "ENTAILLE DE LA HORDE").toUpperCase(), damage: `-${dmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`Entaille de la Horde détruit ${count} gâteaux de lune jaunes, inflige ${dmg} dégâts et récupère ${manaCollected.total} qì pour ${escapeHtml(caster.name)}.`);
    return true;
}

export function applyThrowAxe(spell) {
    let skullCount = 0;
    for(let i = 0; i < board.length; i++) {
        if(skullValue(board[i]) > 0) {
            skullCount += skullValue(board[i]);
        }
    }
    let totalDmg = spell.baseDmg + skullCount * 2;
    applyDamage(enemy, totalDmg, { sourceSpell: spell });
    totalDmg = lastSpellDamage(totalDmg);
    showCombatAnimation({ icon: 'axe', title: 'LANCER DE HACHE', damage: `-${totalDmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`Lancer de Hache inflige ${totalDmg} dégâts (${spell.baseDmg} + 2 × ${skullCount} crânes) !`);
    return true;
}

export function applyBloodlust(spell) {
    player.mana.red = Math.min(getManaCap('red'), player.mana.red + spell.manaGain);
    flyManaGain(true, { red: spell.manaGain });
    showCombatAnimation({ icon: 'blood', title: (spell.name || "SOIF DE BATAILLE").toUpperCase(), heal: `+${spell.manaGain} qì rouge`, target: '→ Vous' }, true);
    log(`Soif de Bataille donne +${spell.manaGain} qì rouge !`);
    return true;
}
