// Gestion des effets spéciaux des sorts de classe

import { player, enemy, log, saveUpdate, showCombatAnimation, finishPlayerTurn } from "./game.js";
import { board, renderBoard, setBoardTargetingMode, checkMatches } from "./board.js";
import { colors, boardSize } from "./constants.js";

function getManaCap(color) {
    return player.manaCaps?.[color] ?? player.maxMana;
}

// Applique l'effet d'un sort de classe
export function applyClassSpellEffect(spell) {
    switch(spell.effect) {
        case 'scaleWithBlue': // Frappe du Mage
            return applyMageStrike(spell);
        case 'createJoker': // Mana Sauvage
            return applyWildMana(spell);
        case 'destroyColor': // Canaux Sombres
            return applyDarkChannels(spell);
        case 'yellowBolts': // Projectiles de Flamme
            return applyFlameBolts(spell);
        case 'enchantWeapon': // Lame de Feu
            return applyFlameblade(spell);
        case 'createSkull': // Doigt de Mort
            return applyFingerOfDeath(spell);
        case 'destroyArea': // Abîme
            return applyChasm(spell);
        case 'fireballArea': // Boule de Feu
            return applyFireballArea(spell);
        case 'noEndTurn': // Attaque Sournoise
            return applySneakAttack(spell);
        case 'yellowToPurple': // Frappe Rapide
            return applySwiftStrike(spell);
        case 'reduceManaGain': // Confusion
            return applyConfuse(spell);
        case 'applyPoison': // Lame Empoisonnée
            return applyPoison(spell);
        case 'destroyPurple': // Frappe de l'Ombre
            return applyShadowStrike(spell);
        case 'purpleToDefense': // Mur Défensif
            return applyDefensiveWall(spell);
        case 'defenseAttack': // Coup de Bouclier
            return applyShieldBash(spell);
        case 'stealCP': // Intimidation
            return applyIntimidate(spell);
        case 'stunEnemy': // Charge
            return applyRush(spell);
        case 'massiveDefense': // Barrière
            return applyBarrier(spell);
        case 'damageBoost': // Rage
            return applyEnrage(spell);
        case 'yellowDamage': // Entaille
            return applyCleave(spell);
        case 'skullBonus': // Lancer de Hache
            return applyThrowAxe(spell);
        case 'giveRedMana': // Soif de Sang
            return applyBloodlust(spell);
        case 'redToSkulls': // Rage Berserker
            return applyBerserkerRage(spell);
        case 'doubleBattle': // Revenant
            return applyRevenant(spell);
        default:
            log(`⚠️ Effet inconnu: ${spell.effect}`);
            return false;
    }
}

// SORCERER SPELLS
function applyMageStrike(spell) {
    const blueMana = player.mana.blue;
    const bonusDmg = Math.floor(blueMana / 3);
    const totalDmg = spell.baseDmg + bonusDmg;
    enemy.hp -= totalDmg;
    showCombatAnimation({ icon: '🔥', title: 'FRAPPE DU MAGE', damage: `-${totalDmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`🔥 Frappe du Mage inflige ${totalDmg} dégâts (${spell.baseDmg} base + ${bonusDmg} bonus)`);
    return true;
}

function applyWildMana(spell) {
    const hasAnyTile = board.some(tile => tile && tile !== 'joker');
    if(!hasAnyTile){
        log(`⚠️ Aucune gemme à transformer`);
        return false;
    }

    setBoardTargetingMode({
        highlightPredicate: (_index, tile) => tile && tile !== 'joker',
        onTileClick: (index, tile) => {
            if(!tile || tile === 'joker'){
                log(`⚠️ Choisissez une gemme pour Mana Sauvage.`);
                return true;
            }

            board[index] = 'joker';
            setBoardTargetingMode(null);
            showCombatAnimation({ icon: '⭐', title: 'MANA SAUVAGE', damage: 'Joker créé !', target: '→ Plateau' }, true);
            log(`✨ Mana Sauvage transforme la gemme choisie en joker !`);
            saveUpdate();
            checkMatches();
            return true;
        }
    });

    log(`✨ Mana Sauvage: choisissez n'importe quelle gemme à transformer en joker.`);
    return false;
}

function applyDarkChannels(spell) {
    // Choisir une couleur aléatoire et détruire toutes les gemmes de cette couleur
    const targetColor = colors[Math.floor(Math.random() * colors.length)];
    let count = 0;
    for(let i = 0; i < board.length; i++) {
        if(board[i] === targetColor) {
            count++;
            board[i] = null;
        }
    }
    if(count > 0) {
        player.mana[targetColor] = Math.min(getManaCap(targetColor), player.mana[targetColor] + count * 3);
        renderBoard();
        showCombatAnimation({ icon: '🌀', title: 'CANAUX SOMBRES', damage: `${count} gemmes détruites`, target: `+${count * 3} mana ${targetColor}` }, true);
        log(`🌀 Canaux Sombres détruit ${count} gemmes ${targetColor} et donne ${count * 3} mana !`);
        return true;
    }
    log(`⚠️ Aucune gemme de couleur ${targetColor} trouvée`);
    return false;
}

function applyFlameBolts(spell) {
    const yellowMana = player.mana.yellow;
    const projectiles = Math.floor(yellowMana / 5);
    const totalDmg = projectiles * 5;
    if(projectiles > 0) {
        enemy.hp -= totalDmg;
        player.mana.yellow = 0;
        showCombatAnimation({ icon: '⚡', title: 'PROJECTILES DE FLAMME', damage: `${projectiles} × 5 = ${totalDmg} dégâts`, target: `→ ${enemy.name}` }, true);
        log(`⚡ Projectiles de Flamme tire ${projectiles} projectiles pour ${totalDmg} dégâts !`);
        return true;
    }
    log(`⚠️ Pas assez de mana jaune pour tirer des projectiles`);
    return false;
}

function applyFlameblade(spell) {
    const redMana = player.mana.red;
    player.statusEffects.flameblade = redMana;
    player.mana.red = 0;
    showCombatAnimation({ icon: '🔥', title: 'LAME DE FEU', damage: `+${redMana} dégâts bonus`, target: '→ Arme enchantée' }, true);
    log(`🔥 Lame de Feu enchante votre arme avec ${redMana} points de dégâts bonus !`);
    return true;
}

function applyFingerOfDeath(spell) {
    const colorTiles = [];
    for(let i = 0; i < board.length; i++) {
        if(colors.includes(board[i])) {
            colorTiles.push(i);
        }
    }
    const count = Math.min(3, colorTiles.length);
    for(let i = 0; i < count; i++) {
        const randomIndex = colorTiles.splice(Math.floor(Math.random() * colorTiles.length), 1)[0];
        board[randomIndex] = 'skull';
    }
    renderBoard();
    showCombatAnimation({ icon: '💀', title: 'DOIGT DE MORT', damage: `${count} crânes créés`, target: '→ Plateau' }, true);
    log(`💀 Doigt de Mort crée ${count} crânes !`);
    return true;
}

function applyChasm(spell) {
    // Détruire une zone 5x5 centrale du plateau
    const centerRow = Math.floor(boardSize / 2);
    const centerCol = Math.floor(boardSize / 2);
    let manaGained = {red:0, blue:0, green:0, yellow:0, purple:0};
    
    for(let row = centerRow - 2; row <= centerRow + 2; row++) {
        for(let col = centerCol - 2; col <= centerCol + 2; col++) {
            if(row >= 0 && row < boardSize && col >= 0 && col < boardSize) {
                const idx = row * boardSize + col;
                const tile = board[idx];
                if(colors.includes(tile)) {
                    manaGained[tile] = (manaGained[tile] || 0) + 2;
                }
                board[idx] = null;
            }
        }
    }
    
    // Appliquer le mana gagné
    Object.keys(manaGained).forEach(color => {
        if(manaGained[color] > 0) {
            player.mana[color] = Math.min(getManaCap(color), player.mana[color] + manaGained[color]);
        }
    });
    
    renderBoard();
    showCombatAnimation({ icon: '🌋', title: 'ABÎME', damage: 'Zone 5×5 détruite', target: '→ Plateau + mana' }, true);
    log(`🌋 Abîme détruit une zone massive et donne du mana !`);
    return true;
}

function applyFireballArea(spell) {
    // Détruire une zone 3x3 aléatoire
    const row = Math.floor(Math.random() * (boardSize - 2));
    const col = Math.floor(Math.random() * (boardSize - 2));
    
    for(let r = row; r < row + 3; r++) {
        for(let c = col; c < col + 3; c++) {
            const idx = r * boardSize + c;
            board[idx] = null;
        }
    }
    
    enemy.hp -= spell.dmg;
    renderBoard();
    showCombatAnimation({ icon: '🔥', title: 'BOULE DE FEU', damage: `-${spell.dmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`🔥 Boule de Feu détruit une zone 3×3 et inflige ${spell.dmg} dégâts !`);
    return true;
}

// ASSASSIN SPELLS
function applySneakAttack(spell) {
    enemy.hp -= spell.dmg;
    player.bonusTurn = true;
    showCombatAnimation({ icon: '🗡️', title: 'ATTAQUE SOURNOISE', damage: `-${spell.dmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`🗡️ Attaque Sournoise inflige ${spell.dmg} dégâts sans terminer le tour !`);
    return true;
}

function applySwiftStrike(spell) {
    let count = 0;
    for(let i = 0; i < board.length; i++) {
        if(board[i] === 'yellow') {
            board[i] = 'purple';
            count++;
        }
    }
    const dmg = count;
    enemy.hp -= dmg;
    renderBoard();
    showCombatAnimation({ icon: '⚡', title: 'FRAPPE RAPIDE', damage: `-${dmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`⚡ Frappe Rapide convertit ${count} gemmes jaunes et inflige ${dmg} dégâts !`);
    return true;
}

function applyConfuse(spell) {
    enemy.statusEffects.confused = spell.duration;
    showCombatAnimation({ icon: '😵', title: 'CONFUSION', damage: '−mana/combo', target: `→ ${enemy.name} (${spell.duration} tours)` }, true);
    log(`😵 Confusion : l'ennemi ne gagne que 1 mana par combinaison pendant ${spell.duration} tours !`);
    return true;
}

function applyPoison(spell) {
    enemy.statusEffects.poisoned = spell.duration;
    enemy.statusEffects.poisonDamage = spell.poisonDmg;
    showCombatAnimation({ icon: '☠️', title: 'LAME EMPOISONNÉE', damage: `${spell.poisonDmg} dégâts/tour`, target: `→ ${enemy.name} (${spell.duration} tours)` }, true);
    log(`☠️ Lame Empoisonnée applique un poison de ${spell.poisonDmg} dégâts/tour pendant ${spell.duration} tours !`);
    return true;
}

function applyShadowStrike(spell) {
    let count = 0;
    for(let i = 0; i < board.length; i++) {
        if(board[i] === 'purple') {
            count++;
            board[i] = null;
        }
    }
    const dmg = count * 2;
    enemy.hp -= dmg;
    renderBoard();
    showCombatAnimation({ icon: '🌑', title: "FRAPPE DE L'OMBRE", damage: `-${dmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`🌑 Frappe de l'Ombre détruit ${count} gemmes violettes et inflige ${dmg} dégâts !`);
    return true;
}

// TEMPLAR SPELLS
function applyDefensiveWall(spell) {
    let count = 0;
    for(let i = 0; i < board.length; i++) {
        if(board[i] === 'purple') {
            count++;
            board[i] = null;
        }
    }
    const defenseGain = count * 5;
    player.defense = (player.defense || 0) + defenseGain;
    renderBoard();
    showCombatAnimation({ icon: '🛡️', title: 'MUR DÉFENSIF', heal: `+${defenseGain} défense`, target: '→ Vous' }, true);
    log(`🛡️ Mur Défensif détruit ${count} gemmes violettes et donne +${defenseGain} défense !`);
    return true;
}

function applyShieldBash(spell) {
    const defense = player.defense || 0;
    const bonusDmg = Math.floor(defense / 5);
    const totalDmg = spell.baseDmg + bonusDmg;
    enemy.hp -= totalDmg;
    // Retirer les statuts négatifs
    delete player.statusEffects.poisoned;
    delete player.statusEffects.stunned;
    delete player.statusEffects.weakened;
    showCombatAnimation({ icon: '🛡️', title: 'COUP DE BOUCLIER', damage: `-${totalDmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`🛡️ Coup de Bouclier inflige ${totalDmg} dégâts et retire les statuts négatifs !`);
    return true;
}

function applyIntimidate(spell) {
    const stolen = Math.min(spell.cpSteal, enemy.combatPoints);
    enemy.combatPoints -= stolen;
    player.combatPoints += stolen;
    showCombatAnimation({ icon: '😠', title: 'INTIMIDATION', damage: `-${stolen} PA`, target: `→ ${enemy.name}` }, true);
    log(`😠 Intimidation vole ${stolen} points de combat à l'ennemi !`);
    return true;
}

function applyRush(spell) {
    const yellowMana = player.mana.yellow;
    const extraTurns = Math.floor(yellowMana / 7);
    const totalTurns = 2 + extraTurns;
    enemy.statusEffects.stunned = totalTurns;
    showCombatAnimation({ icon: '💨', title: 'CHARGE', damage: `Étourdi ${totalTurns} tours`, target: `→ ${enemy.name}` }, true);
    log(`💨 Charge étourdit l'ennemi pour ${totalTurns} tours !`);
    return true;
}

function applyBarrier(spell) {
    player.statusEffects.barrier = spell.duration;
    player.statusEffects.barrierDefense = spell.defenseBonus;
    player.defense = (player.defense || 0) + spell.defenseBonus;
    showCombatAnimation({ icon: '🛡️', title: 'BARRIÈRE', heal: `+${spell.defenseBonus} défense`, target: `→ Vous (${spell.duration} tours)` }, true);
    log(`🛡️ Barrière augmente la défense de ${spell.defenseBonus} pendant ${spell.duration} tours !`);
    return true;
}

// BARBARIAN SPELLS
function applyEnrage(spell) {
    player.statusEffects.enraged = spell.duration;
    player.statusEffects.enragedBonus = spell.atkBonus;
    player.attack += spell.atkBonus;
    player.bonusTurn = true;
    showCombatAnimation({ icon: '😡', title: 'RAGE', damage: `+${spell.atkBonus} attaque`, target: `→ Vous (${spell.duration} tours)` }, true);
    log(`😡 Rage augmente l'attaque de ${spell.atkBonus} pendant ${spell.duration} tours !`);
    return true;
}

function applyCleave(spell) {
    let count = 0;
    for(let i = 0; i < board.length; i++) {
        if(board[i] === 'yellow') {
            count++;
            board[i] = null;
        }
    }
    const dmg = count;
    enemy.hp -= dmg;
    renderBoard();
    showCombatAnimation({ icon: '🪓', title: 'ENTAILLE', damage: `-${dmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`🪓 Entaille détruit ${count} gemmes jaunes et inflige ${dmg} dégâts !`);
    return true;
}

function applyThrowAxe(spell) {
    let skullCount = 0;
    for(let i = 0; i < board.length; i++) {
        if(board[i] === 'skull') {
            skullCount++;
        }
    }
    const totalDmg = spell.baseDmg + skullCount;
    enemy.hp -= totalDmg;
    showCombatAnimation({ icon: '🪓', title: 'LANCER DE HACHE', damage: `-${totalDmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`🪓 Lancer de Hache inflige ${totalDmg} dégâts (${spell.baseDmg} + ${skullCount} crânes) !`);
    return true;
}

function applyBloodlust(spell) {
    player.mana.red = Math.min(getManaCap('red'), player.mana.red + spell.manaGain);
    showCombatAnimation({ icon: '💉', title: 'SOIF DE SANG', heal: `+${spell.manaGain} mana rouge`, target: '→ Vous' }, true);
    log(`💉 Soif de Sang donne +${spell.manaGain} mana rouge !`);
    return true;
}

function applyBerserkerRage(spell) {
    let count = 0;
    for(let i = 0; i < board.length; i++) {
        if(board[i] === 'red') {
            board[i] = 'skull';
            count++;
        }
    }
    renderBoard();
    showCombatAnimation({ icon: '😈', title: 'RAGE BERSERKER', damage: `${count} rouges → crânes`, target: '→ Plateau' }, true);
    log(`😈 Rage Berserker transforme ${count} gemmes rouges en crânes !`);
    return true;
}

function applyRevenant(spell) {
    player.statusEffects.revenant = true;
    showCombatAnimation({ icon: '👻', title: 'REVENANT', damage: 'PA doublés', target: '→ Vous' }, true);
    log(`👻 Revenant : Les points de combat sont maintenant doublés !`);
    return true;
}
