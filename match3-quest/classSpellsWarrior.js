// Sorts de classe : bonus de caractéristiques, guerrier, templier, barbare (renforts, barrière, enragement, hache…). Extrait de classSpellEffects.js.
import { flyManaGain, flyManaSteal, flyHeal } from './manaFlight.js';
import { player, enemy, log, saveUpdate, showCombatAnimation, applyDamage, lastSpellDamage, addBonusTurn } from './game.js';
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
    showCombatAnimation({ icon: 'rock', title: "PEAU DE JADE", heal: `+${bonus} défense`, target: `→ Vous (${turns} tours)` }, true);
    log(`Peau de Jade augmente la défense de ${bonus} pendant ${turns} tours.`);
    return true;
}

export function applyStrength(spell) {
    const bonus = Math.max(0, Math.floor(spell.atkBonus || 0));
    const turns = Math.max(1, Math.floor(spell.duration || 1));
    stackStatusEffect(player.statusEffects, 'strength', 'strengthBonus', turns, bonus);
    player.attack += bonus;
    showCombatAnimation({ icon: 'muscle', title: "FORCE DU TIGRE", damage: `+${bonus} attaque`, target: `→ Vous (${turns} tours)` }, true);
    log(`Force augmente l'attaque physique de ${bonus} pendant ${turns} tours.`);
    return true;
}

export function applyMirrorShield(spell) {
    const percent = Math.max(0, Math.floor(spell.reflectPercent || 0));
    const turns = Math.max(1, Math.floor(spell.duration || 1));
    stackStatusEffect(player.statusEffects, 'reflectDamage', 'reflectDamagePercent', turns, percent, 100);
    showCombatAnimation({ icon: 'mirror', title: "MIROIR DE BRONZE", damage: `${percent}% renvoyés`, target: `→ Vous (${turns} tours)` }, true);
    log(`Miroir de Bronze renverra ${percent}% des dégâts pendant ${turns} tours.`);
    return true;
}

export function applyManaSiphon(spell) {
    const stealTotal = Math.max(0, Math.floor(spell.manaSteal || 0));
    if(stealTotal <= 0) {
        log(`Aspiration du Qi n'a aucun effet (manaSteal invalide).`);
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
    showCombatAnimation({ icon: 'swirl', title: "ASPIRATION DU QI", damage: `-${drained} qì ennemi`, target: '→ Vous' }, true);
    log(`Aspiration du Qi absorbe ${drained} qì ennemi.`);
    return true;
}

// ASSASSIN SPELLS
export function applySneakAttack(spell) {
    applyDamage(enemy, spell.dmg, { sourceSpell: spell });
    const sneakDmg = lastSpellDamage(spell.dmg);
    addBonusTurn(player);
    showCombatAnimation({ icon: 'sword', title: "TIR FURTIF", damage: `-${sneakDmg} dégâts · TOUR BONUS`, target: `→ ${enemy.name} · vous rejouez !` }, true);
    log(`Tir Furtif inflige ${sneakDmg} dégâts et vous donne un tour bonus !`);
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
    showCombatAnimation({ icon: 'bolt', title: "TIR RAPIDE", damage: `-${dmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`Tir Rapide convertit ${count} gâteaux de lune jaunes et inflige ${dmg} dégâts !`);
    return true;
}

export function applyConfuse(spell) {
    enemy.statusEffects.confused = spell.duration;
    showCombatAnimation({ icon: 'dizzy', title: "FLÈCHE DE BRUME", damage: '−qì/combo', target: `→ ${enemy.name} (${spell.duration} tours)` }, true);
    log(`Flèche de Brume : l'ennemi ne gagne que 1 qì par combinaison pendant ${spell.duration} tours !`);
    return true;
}

export function applyStealth(spell) {
    const turns = spell.duration || 1;
    player.statusEffects.manaShield = { color: 'purple', turns };
    showCombatAnimation({ icon: 'eye', title: "VOILE DE BRUME", damage: 'Dégâts -> qì violet', target: `→ Vous (${turns} tour${turns > 1 ? 's' : ''})` }, true);
    log(`Voile de Brume active: les prochains dégâts sont absorbés par le qì violet.`);
    return true;
}

export function applyPoison(spell) {
    enemy.statusEffects.poisoned = spell.duration;
    enemy.statusEffects.poisonDamage = spell.poisonDmg;
    showCombatAnimation({ icon: 'poison', title: "FLÈCHE EMPOISONNÉE", damage: `${spell.poisonDmg} dégâts/tour`, target: `→ ${enemy.name} (${spell.duration} tours)` }, true);
    log(`Flèche Empoisonnée applique un poison de ${spell.poisonDmg} dégâts/tour pendant ${spell.duration} tours !`);
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
    showCombatAnimation({ icon: 'moon', title: "FLÈCHE D'OMBRE", damage: `-${dmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`Flèche d'Ombre détruit ${count} gâteaux de lune violettes, inflige ${dmg} dégâts et fait récupérer ${manaCollected.total} qì à ${caster.name}.`);
    return true;
}

export function applyDualShot(spell) {
    const weapons = Array.isArray(player.weapons) ? player.weapons : [];
    if(weapons.length < 2) {
        log(`Flèches Jumelles nécessite au moins 2 armes dans l'inventaire.`);
        return false;
    }

    const sorted = [...weapons].sort((a, b) => (b.damage || 0) - (a.damage || 0));
    let totalDmg = Math.max(1, Math.floor((sorted[0].damage || 0) + (sorted[1].damage || 0)));
    applyDamage(enemy, totalDmg, { sourceSpell: spell });
    totalDmg = lastSpellDamage(totalDmg);
    showCombatAnimation({ icon: 'target', title: "FLÈCHES JUMELLES", damage: `-${totalDmg} dégâts`, target: `→ ${enemy.name}` }, true);
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
    showCombatAnimation({ icon: 'shield', title: "MURAILLE IMPÉRIALE", heal: `+${defenseGain} défense`, target: '→ Vous' }, true);
    log(`Muraille Impériale détruit ${count} gâteaux de lune violettes: +${defenseGain} défense et +${manaCollected.total} qì pour ${caster.name}.`);
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
    showCombatAnimation({ icon: 'shield', title: "COUP DE BOUCLIER ROND", damage: `-${totalDmg} dégâts`, target: `→ ${enemy.name}` }, true);
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
            showCombatAnimation({ icon: 'sword', title: "CONCENTRATION DU QI", damage: 'Flèche créée', target: '→ Plateau' }, true);
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
    showCombatAnimation({ icon: 'anger', title: "REGARD IMPÉRIAL", damage: `-${stolen} PA`, target: `→ ${enemy.name}` }, true);
    log(`Regard Impérial vole ${stolen} points de combat à l'ennemi !`);
    return true;
}

export function applyRush(spell) {
    const yellowMana = player.mana.yellow;
    const extraTurns = Math.floor(yellowMana / 7);
    const totalTurns = 2 + extraTurns;
    enemy.statusEffects.stunned = totalTurns;
    showCombatAnimation({ icon: 'wind', title: "CHARGE DE CAVALERIE", damage: `Étourdi ${totalTurns} tours`, target: `→ ${enemy.name}` }, true);
    log(`Charge de Cavalerie étourdit l'ennemi pour ${totalTurns} tours !`);
    return true;
}

export function applyCounterAttack(spell) {
    const turns = Math.max(1, Math.floor(spell.duration || 1));
    const counterDmg = Math.max(1, Math.floor(spell.counterDmg || 1));
    player.statusEffects.counterOnBlock = turns;
    player.statusEffects.counterOnBlockDmg = counterDmg;
    showCombatAnimation({ icon: 'shield', title: "RIPOSTE DU GARDE", damage: `${counterDmg} dégâts de riposte`, target: `→ Vous (${turns} tours)` }, true);
    log(`Riposte du Garde active: ${counterDmg} dégâts renvoyés en blocage pendant ${turns} tours.`);
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
        log(`Aucune Action Gem à détruire pour Renfort des Troupes.`);
        return false;
    }

    const heal = count * Math.max(1, Math.floor(spell.healPerGem || 1));
    player.hp = Math.min(player.maxHp, player.hp + heal);
    flyHeal(true, heal);
    renderBoard();
    showCombatAnimation({ icon: 'spark', title: "RENFORT DES TROUPES", heal: `+${heal} HP`, target: '→ Vous' }, true);
    log(`Renfort des Troupes détruit ${count} Action Gem(s) et soigne ${heal} HP.`);
    return true;
}

export function applyBarrier(spell) {
    stackStatusEffect(player.statusEffects, 'barrier', 'barrierDefense', spell.duration, spell.defenseBonus);
    player.defense = (player.defense || 0) + spell.defenseBonus;
    showCombatAnimation({ icon: 'shield', title: "REMPART DE JADE", heal: `+${spell.defenseBonus} défense`, target: `→ Vous (${spell.duration} tours)` }, true);
    log(`Rempart de Jade augmente la défense de ${spell.defenseBonus} pendant ${spell.duration} tours !`);
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
    showCombatAnimation({ icon: 'star', title: "MANDAT DU CIEL", heal: `+${yellowGain} qì jaune`, target: '→ Vous' }, true);
    log(`Mandat du Ciel convertit la défense en +${yellowGain} qì jaune.`);
    return true;
}

export function applyHoldTheLine(spell) {
    const turns = Math.max(1, Math.floor(spell.duration || 1));
    player.statusEffects.immunityEffects = turns;
    showCombatAnimation({ icon: 'shield', title: "FORMATION DE LA TORTUE", damage: 'Immunité aux effets', target: `→ Vous (${turns} tours)` }, true);
    log(`Formation de la Tortue: immunité aux effets négatifs pendant ${turns} tours.`);
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
    showCombatAnimation({ icon: 'bolt', title: "COURROUX DU CIEL", damage: `-${totalDmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`Courroux du Ciel fait exploser ${count} Action Gem(s) pour ${totalDmg} dégâts.`);
    return true;
}

// BARBARIAN SPELLS
export function applyEnrage(spell) {
    stackStatusEffect(player.statusEffects, 'enraged', 'enragedBonus', spell.duration, spell.atkBonus);
    addBonusTurn(player);
    showCombatAnimation({ icon: 'anger', title: "FUREUR DES STEPPES", damage: `+${spell.atkBonus} dégâts`, target: `→ Vous (${spell.duration} tours)` }, true);
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
    showCombatAnimation({ icon: 'axe', title: "ENTAILLE DE LA HORDE", damage: `-${dmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`Entaille de la Horde détruit ${count} gâteaux de lune jaunes, inflige ${dmg} dégâts et récupère ${manaCollected.total} qì pour ${caster.name}.`);
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
    showCombatAnimation({ icon: 'blood', title: "SOIF DE BATAILLE", heal: `+${spell.manaGain} qì rouge`, target: '→ Vous' }, true);
    log(`Soif de Bataille donne +${spell.manaGain} qì rouge !`);
    return true;
}
