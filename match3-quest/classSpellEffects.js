// Gestion des effets spéciaux des sorts de classe

import { player, enemy, log, saveUpdate, showCombatAnimation, finishPlayerTurn, applyDamage, addBonusTurn } from "./game.js";
import { board, renderBoard, setBoardTargetingMode, checkMatches } from "./board.js";
import { colors, boardSize } from "./constants.js";
import { JOKER_TILE, isJokerTile, isTransformableToJoker } from "./joker.js";

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
        case 'preventItems': // Malédiction d'Ombre
            return applyShadowCurse(spell);
        case 'destroyColor': // Canaux Sombres
            return applyDarkChannels(spell);
        case 'yellowBolts': // Projectiles de Flamme
            return applyFlameBolts(spell);
        case 'damageToMana': // Bouclier de Glace
            return applyIceShield(spell);
        case 'enchantWeapon': // Lame de Feu
            return applyFlameblade(spell);
        case 'reduceEnemyAtk': // Faiblesse
            return applyWeakness(spell);
        case 'freezeEnemy': // Main de Glace
            return applyHandOfIce(spell);
        case 'createSkull': // Doigt de Mort
            return applyFingerOfDeath(spell);
        case 'destroyArea': // Abîme
            return applyChasm(spell);
        case 'increaseDefense': // Peau de Pierre
            return applyStoneskin(spell);
        case 'increasePhysical': // Force
            return applyStrength(spell);
        case 'fireballArea': // Boule de Feu
            return applyFireballArea(spell);
        case 'reflectDamage': // Bouclier Miroir
            return applyMirrorShield(spell);
        case 'drainMana': // Siphon de Mana
            return applyManaSiphon(spell);
        case 'noEndTurn': // Attaque Sournoise
            return applySneakAttack(spell);
        case 'yellowToPurple': // Frappe Rapide
            return applySwiftStrike(spell);
        case 'reduceManaGain': // Confusion
            return applyConfuse(spell);
        case 'damageToManaPurple': // Furtivité
            return applyStealth(spell);
        case 'applyPoison': // Lame Empoisonnée
            return applyPoison(spell);
        case 'destroyPurple': // Frappe de l'Ombre
            return applyShadowStrike(spell);
        case 'dualWeaponAttack': // Double Tir
            return applyDualShot(spell);
        case 'purpleToDefense': // Mur Défensif
            return applyDefensiveWall(spell);
        case 'defenseAttack': // Coup de Bouclier
            return applyShieldBash(spell);
        case 'createActionGem': // Concentration
            return applyFocus(spell);
        case 'stealCP': // Intimidation
            return applyIntimidate(spell);
        case 'stunEnemy': // Charge
            return applyRush(spell);
        case 'counterOnBlock': // Contre-Attaque
            return applyCounterAttack(spell);
        case 'destroyActionGemHeal': // Renforcement
            return applyReinforce(spell);
        case 'massiveDefense': // Barrière
            return applyBarrier(spell);
        case 'defenseToMana': // Puissance Divine
            return applyDivinePower(spell);
        case 'immunityEffects': // Tenir la Ligne
            return applyHoldTheLine(spell);
        case 'explodeActionGems': // Colère Céleste
            return applyHeavensWrath(spell);
        case 'damageBoost': // Rage
            return applyEnrage(spell);
        case 'yellowDamage': // Entaille
            return applyCleave(spell);
        case 'skullBonus': // Lancer de Hache
            return applyThrowAxe(spell);
        case 'giveRedMana': // Soif de Sang
            return applyBloodlust(spell);
        case 'destroyColumns': // Invoquer la Tempête
            return applySummonTempest(spell);
        case 'redToSkulls': // Rage Berserker
            return applyBerserkerRage(spell);
        case 'drainOnHit': // Lames Chantantes
            return applySingingBlades(spell);
        case 'redToSkullsHalf': // Porte-Mort
            return applyDeathbringer(spell);
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
    applyDamage(enemy, totalDmg, { sourceSpell: spell });
    showCombatAnimation({ icon: '🔥', title: 'FRAPPE DU MAGE', damage: `-${totalDmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`🔥 Frappe du Mage inflige ${totalDmg} dégâts (${spell.baseDmg} base + ${bonusDmg} bonus)`);
    return true;
}

function applyWildMana(spell) {
    const hasAnyTile = board.some(tile => isTransformableToJoker(tile));
    if(!hasAnyTile){
        log(`⚠️ Aucune gemme à transformer`);
        return false;
    }

    setBoardTargetingMode({
        highlightPredicate: (_index, tile) => isTransformableToJoker(tile),
        onTileClick: (index, tile) => {
            if(!isTransformableToJoker(tile)){
                log(`⚠️ Choisissez une gemme pour Mana Sauvage.`);
                return true;
            }

            board[index] = JOKER_TILE;
            setBoardTargetingMode(null);
            showCombatAnimation({ icon: '⭐', title: 'MANA SAUVAGE', damage: 'Joker créé !', target: '→ Plateau' }, true);
            log(`✨ Mana Sauvage transforme la gemme choisie en joker !`);
            saveUpdate();
            checkMatches(true);
            return true;
        }
    });

    log(`✨ Mana Sauvage: choisissez n'importe quelle gemme à transformer en joker.`);
    return false;
}

function applyShadowCurse(spell) {
    enemy.statusEffects.itemBlocked = spell.duration || 3;
    showCombatAnimation({ icon: '🌒', title: "MALÉDICTION D'OMBRE", damage: 'Objets bloqués', target: `→ ${enemy.name} (${enemy.statusEffects.itemBlocked} tours)` }, true);
    log(`🌒 Malédiction d'Ombre bloque les objets ennemis pendant ${enemy.statusEffects.itemBlocked} tours.`);
    return true;
}

function applyDarkChannels(spell) {
    const hasColorTile = board.some(tile => colors.includes(tile));
    if(!hasColorTile){
        log(`⚠️ Aucune gemme de couleur à cibler.`);
        return false;
    }

    setBoardTargetingMode({
        highlightPredicate: (_index, tile) => colors.includes(tile),
        onTileClick: (_index, tile) => {
            if(!colors.includes(tile)) {
                log(`⚠️ Choisissez une gemme de couleur pour Canaux Sombres.`);
                return true;
            }

            const targetColor = tile;
            setBoardTargetingMode(null);
            const rowsToDestroy = [];
            let count = 0;

            for(let row = 0; row < boardSize; row++) {
                const rowIndices = [];
                for(let col = 0; col < boardSize; col++) {
                    const idx = row * boardSize + col;
                    if(board[idx] === targetColor) {
                        rowIndices.push(idx);
                    }
                }
                if(rowIndices.length > 0) {
                    rowsToDestroy.push(rowIndices);
                    count += rowIndices.length;
                }
            }

            if(count <= 0) {
                log(`⚠️ Aucune gemme de couleur ${targetColor} trouvée`);
                return true;
            }

            const boardDiv = document.getElementById('board');
            const tiles = boardDiv ? boardDiv.children : null;
            const rowDelayMs = 110;

            const destroyRow = (rowIndex) => {
                if(rowIndex >= rowsToDestroy.length) {
                    player.mana[targetColor] = Math.min(getManaCap(targetColor), player.mana[targetColor] + count * 3);
                    // renderBoard applique la gravite (descente) puis genere les nouvelles tuiles.
                    renderBoard();
                    showCombatAnimation({ icon: '🌀', title: 'CANAUX SOMBRES', damage: `${count} gemmes détruites`, target: `+${count * 3} mana ${targetColor}` }, true);
                    log(`🌀 Canaux Sombres détruit ${count} gemmes ${targetColor} ligne par ligne et donne ${count * 3} mana !`);
                    saveUpdate();
                    checkMatches(true);
                    return;
                }

                const indices = rowsToDestroy[rowIndex];
                indices.forEach(idx => {
                    board[idx] = null;
                    if(tiles && tiles[idx]) {
                        tiles[idx].className = 'tile';
                        tiles[idx].textContent = '';
                    }
                });

                setTimeout(() => destroyRow(rowIndex + 1), rowDelayMs);
            };

            destroyRow(0);
            return true;
        }
    });

    log(`🌀 Canaux Sombres: choisissez une couleur en cliquant une gemme.`);
    return false;
}

function applyFlameBolts(spell) {
    const yellowMana = player.mana.yellow;
    const projectiles = Math.floor(yellowMana / 5);
    const totalDmg = projectiles * 5;
    if(projectiles > 0) {
        applyDamage(enemy, totalDmg, { sourceSpell: spell });
        player.mana.yellow = 0;
        showCombatAnimation({ icon: '⚡', title: 'PROJECTILES DE FLAMME', damage: `${projectiles} × 5 = ${totalDmg} dégâts`, target: `→ ${enemy.name}` }, true);
        log(`⚡ Projectiles de Flamme tire ${projectiles} projectiles pour ${totalDmg} dégâts !`);
        return true;
    }
    log(`⚠️ Pas assez de mana jaune pour tirer des projectiles`);
    return false;
}

function applyIceShield(spell) {
    const turns = spell.duration || 1;
    player.statusEffects.manaShield = { color: 'blue', turns };
    showCombatAnimation({ icon: '🧊', title: 'BOUCLIER DE GLACE', damage: 'Dégâts -> mana bleu', target: `→ Vous (${turns} tour${turns > 1 ? 's' : ''})` }, true);
    log(`🧊 Bouclier de Glace actif: les prochains dégâts sont absorbés par le mana bleu.`);
    return true;
}

function applyFlameblade(spell) {
    const redMana = player.mana.red;
    player.statusEffects.flameblade = redMana;
    player.mana.red = 0;
    showCombatAnimation({ icon: '🔥', title: 'LAME DE FEU', damage: `+${redMana} dégâts bonus`, target: '→ Arme enchantée' }, true);
    log(`🔥 Lame de Feu enchante votre arme avec ${redMana} points de dégâts bonus !`);
    return true;
}

function applyWeakness(spell) {
    const reduction = Math.max(0, Math.floor(spell.reduction || 0));
    const duration = Math.max(1, Math.floor(spell.duration || 1));
    enemy.statusEffects.weakened = duration;
    enemy.statusEffects.weakenedAmount = reduction;
    showCombatAnimation({ icon: '🕸️', title: 'FAIBLESSE', damage: `-${reduction} attaque`, target: `→ ${enemy.name} (${duration} tours)` }, true);
    log(`🕸️ Faiblesse réduit l'attaque ennemie de ${reduction} pendant ${duration} tours.`);
    return true;
}

function applyHandOfIce(spell) {
    const turns = Math.max(1, Math.floor(spell.duration || 1));
    enemy.statusEffects.stunned = Math.max(enemy.statusEffects.stunned || 0, turns);
    showCombatAnimation({ icon: '❄️', title: 'MAIN DE GLACE', damage: `Étourdi ${turns} tours`, target: `→ ${enemy.name}` }, true);
    log(`❄️ Main de Glace étourdit l'ennemi pendant ${turns} tours.`);
    return true;
}

function applyFingerOfDeath(spell) {
    const available = board.filter(tile => colors.includes(tile)).length;
    const maxTargets = Math.min(3, available);
    if(maxTargets <= 0) {
        log(`⚠️ Aucune gemme de couleur à transformer en crâne.`);
        return false;
    }

    let created = 0;
    setBoardTargetingMode({
        highlightPredicate: (_index, tile) => colors.includes(tile),
        onTileClick: (index, tile) => {
            if(!colors.includes(tile)) {
                log(`⚠️ Choisissez une gemme de couleur pour Doigt de Mort.`);
                return true;
            }

            board[index] = 'skull';
            created++;
            renderBoard();

            if(created < maxTargets) {
                log(`💀 Doigt de Mort: choisissez encore ${maxTargets - created} cible(s).`);
                return true;
            }

            setBoardTargetingMode(null);
            showCombatAnimation({ icon: '💀', title: 'DOIGT DE MORT', damage: `${created} crânes créés`, target: '→ Plateau' }, true);
            log(`💀 Doigt de Mort crée ${created} crânes !`);
            saveUpdate();
            checkMatches(true);
            return true;
        }
    });

    log(`💀 Doigt de Mort: choisissez ${maxTargets} gemme(s) à transformer en crâne.`);
    return false;
}

function applyChasm(spell) {
    setBoardTargetingMode({
        highlightPredicate: () => true,
        onTileClick: (index) => {
            const centerRow = Math.floor(index / boardSize);
            const centerCol = index % boardSize;
            const manaGained = { red: 0, blue: 0, green: 0, yellow: 0, purple: 0 };

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

            Object.keys(manaGained).forEach(color => {
                if(manaGained[color] > 0) {
                    player.mana[color] = Math.min(getManaCap(color), player.mana[color] + manaGained[color]);
                }
            });

            setBoardTargetingMode(null);
            renderBoard();
            showCombatAnimation({ icon: '🌋', title: 'ABÎME', damage: 'Zone 5×5 détruite', target: '→ Plateau + mana' }, true);
            log(`🌋 Abîme détruit une zone 5×5 choisie et donne du mana !`);
            saveUpdate();
            checkMatches(true);
            return true;
        }
    });

    log(`🌋 Abîme: choisissez le centre de la zone à détruire.`);
    return false;
}

function applyFireballArea(spell) {
    setBoardTargetingMode({
        highlightPredicate: () => true,
        onTileClick: (index) => {
            const centerRow = Math.floor(index / boardSize);
            const centerCol = index % boardSize;

            for(let r = centerRow - 1; r <= centerRow + 1; r++) {
                for(let c = centerCol - 1; c <= centerCol + 1; c++) {
                    if(r >= 0 && r < boardSize && c >= 0 && c < boardSize) {
                        const idx = r * boardSize + c;
                        board[idx] = null;
                    }
                }
            }

            setBoardTargetingMode(null);
            applyDamage(enemy, spell.dmg, { sourceSpell: spell });
            renderBoard();
            showCombatAnimation({ icon: '🔥', title: 'BOULE DE FEU', damage: `-${spell.dmg} dégâts`, target: `→ ${enemy.name}` }, true);
            log(`🔥 Boule de Feu détruit une zone 3×3 choisie et inflige ${spell.dmg} dégâts !`);
            saveUpdate();
            checkMatches(true);
            return true;
        }
    });

    log(`🔥 Boule de Feu: choisissez le centre de la zone à détruire.`);
    return false;
}

function applyStoneskin(spell) {
    const bonus = Math.max(0, Math.floor(spell.defenseBonus || 0));
    const turns = Math.max(1, Math.floor(spell.duration || 1));
    player.statusEffects.stoneskin = turns;
    player.statusEffects.stoneskinDefense = bonus;
    player.defense = (player.defense || 0) + bonus;
    showCombatAnimation({ icon: '🪨', title: 'PEAU DE PIERRE', heal: `+${bonus} défense`, target: `→ Vous (${turns} tours)` }, true);
    log(`🪨 Peau de Pierre augmente la défense de ${bonus} pendant ${turns} tours.`);
    return true;
}

function applyStrength(spell) {
    const bonus = Math.max(0, Math.floor(spell.atkBonus || 0));
    const turns = Math.max(1, Math.floor(spell.duration || 1));
    player.statusEffects.strength = turns;
    player.statusEffects.strengthBonus = bonus;
    player.attack += bonus;
    showCombatAnimation({ icon: '💪', title: 'FORCE', damage: `+${bonus} attaque`, target: `→ Vous (${turns} tours)` }, true);
    log(`💪 Force augmente l'attaque physique de ${bonus} pendant ${turns} tours.`);
    return true;
}

function applyMirrorShield(spell) {
    const percent = Math.max(0, Math.floor(spell.reflectPercent || 0));
    const turns = Math.max(1, Math.floor(spell.duration || 1));
    player.statusEffects.reflectDamage = turns;
    player.statusEffects.reflectDamagePercent = percent;
    showCombatAnimation({ icon: '🪞', title: 'BOUCLIER MIROIR', damage: `${percent}% renvoyés`, target: `→ Vous (${turns} tours)` }, true);
    log(`🪞 Bouclier Miroir renverra ${percent}% des dégâts pendant ${turns} tours.`);
    return true;
}

function applyManaSiphon(spell) {
    const stealTotal = Math.max(0, Math.floor(spell.manaSteal || 0));
    if(stealTotal <= 0) {
        log(`⚠️ Siphon de Mana n'a aucun effet (manaSteal invalide).`);
        return false;
    }

    const manaColors = ['red', 'blue', 'green', 'yellow', 'purple'];
    const stealPerColor = Math.max(1, Math.floor(stealTotal / manaColors.length));
    let drained = 0;

    manaColors.forEach(color => {
        const amount = Math.min(stealPerColor, enemy.mana[color] || 0);
        if(amount > 0) {
            enemy.mana[color] -= amount;
            player.mana[color] = Math.min(getManaCap(color), (player.mana[color] || 0) + amount);
            drained += amount;
        }
    });

    showCombatAnimation({ icon: '🌀', title: 'SIPHON DE MANA', damage: `-${drained} mana ennemi`, target: '→ Vous' }, true);
    log(`🌀 Siphon de Mana absorbe ${drained} mana ennemi.`);
    return true;
}

// ASSASSIN SPELLS
function applySneakAttack(spell) {
    applyDamage(enemy, spell.dmg, { sourceSpell: spell });
    addBonusTurn(player);
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
    applyDamage(enemy, dmg, { sourceSpell: spell });
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

function applyStealth(spell) {
    const turns = spell.duration || 1;
    player.statusEffects.manaShield = { color: 'purple', turns };
    showCombatAnimation({ icon: '🫥', title: 'FURTIVITÉ', damage: 'Dégâts -> mana violet', target: `→ Vous (${turns} tour${turns > 1 ? 's' : ''})` }, true);
    log(`🫥 Furtivité active: les prochains dégâts sont absorbés par le mana violet.`);
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
    applyDamage(enemy, dmg, { sourceSpell: spell });
    renderBoard();
    showCombatAnimation({ icon: '🌑', title: "FRAPPE DE L'OMBRE", damage: `-${dmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`🌑 Frappe de l'Ombre détruit ${count} gemmes violettes et inflige ${dmg} dégâts !`);
    return true;
}

function applyDualShot(spell) {
    const weapons = Array.isArray(player.weapons) ? player.weapons : [];
    if(weapons.length < 2) {
        log(`⚠️ Double Tir nécessite au moins 2 armes dans l'inventaire.`);
        return false;
    }

    const sorted = [...weapons].sort((a, b) => (b.damage || 0) - (a.damage || 0));
    const totalDmg = Math.max(1, Math.floor((sorted[0].damage || 0) + (sorted[1].damage || 0) + (player.attack || 0)));
    applyDamage(enemy, totalDmg, { sourceSpell: spell });
    showCombatAnimation({ icon: '🎯', title: 'DOUBLE TIR', damage: `-${totalDmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`🎯 Double Tir inflige ${totalDmg} dégâts (2 meilleures armes + attaque).`);
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
    applyDamage(enemy, totalDmg, { sourceSpell: spell });
    // Retirer les statuts négatifs
    delete player.statusEffects.poisoned;
    delete player.statusEffects.stunned;
    delete player.statusEffects.weakened;
    showCombatAnimation({ icon: '🛡️', title: 'COUP DE BOUCLIER', damage: `-${totalDmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`🛡️ Coup de Bouclier inflige ${totalDmg} dégâts et retire les statuts négatifs !`);
    return true;
}

function applyFocus(spell) {
    const hasCandidate = board.some(tile => tile && !isJokerTile(tile) && tile !== 'combat');
    if(!hasCandidate) {
        log(`⚠️ Aucune gemme valide à transformer en Action Gem.`);
        return false;
    }

    setBoardTargetingMode({
        highlightPredicate: (_index, tile) => tile && !isJokerTile(tile) && tile !== 'combat',
        onTileClick: (index, tile) => {
            if(!tile || isJokerTile(tile) || tile === 'combat') {
                log(`⚠️ Choisissez une gemme valide pour Concentration.`);
                return true;
            }

            board[index] = 'combat';
            setBoardTargetingMode(null);
            renderBoard();
            showCombatAnimation({ icon: '⚔️', title: 'CONCENTRATION', damage: 'Action Gem créée', target: '→ Plateau' }, true);
            log(`⚔️ Concentration transforme la gemme choisie en Action Gem.`);
            saveUpdate();
            checkMatches(true);
            return true;
        }
    });

    log(`⚔️ Concentration: choisissez une gemme à transformer en Action Gem.`);
    return false;
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

function applyCounterAttack(spell) {
    const turns = Math.max(1, Math.floor(spell.duration || 1));
    const counterDmg = Math.max(1, Math.floor(spell.counterDmg || 1));
    player.statusEffects.counterOnBlock = turns;
    player.statusEffects.counterOnBlockDmg = counterDmg;
    showCombatAnimation({ icon: '🛡️', title: 'CONTRE-ATTAQUE', damage: `${counterDmg} dégâts de riposte`, target: `→ Vous (${turns} tours)` }, true);
    log(`🛡️ Contre-Attaque active: ${counterDmg} dégâts renvoyés en blocage pendant ${turns} tours.`);
    return true;
}

function applyReinforce(spell) {
    let count = 0;
    for(let i = 0; i < board.length; i++) {
        if(board[i] === 'combat') {
            board[i] = null;
            count++;
        }
    }

    if(count <= 0) {
        log(`⚠️ Aucune Action Gem à détruire pour Renforcement.`);
        return false;
    }

    const heal = count * Math.max(1, Math.floor(spell.healPerGem || 1));
    player.hp = Math.min(player.maxHp, player.hp + heal);
    renderBoard();
    showCombatAnimation({ icon: '✨', title: 'RENFORCEMENT', heal: `+${heal} HP`, target: '→ Vous' }, true);
    log(`✨ Renforcement détruit ${count} Action Gem(s) et soigne ${heal} HP.`);
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

function applyDivinePower(spell) {
    const defense = Math.max(0, Math.floor(player.defense || 0));
    const yellowGain = Math.floor(defense / 5);
    if(yellowGain <= 0) {
        log(`⚠️ Défense insuffisante pour générer du mana jaune.`);
        return false;
    }

    player.mana.yellow = Math.min(getManaCap('yellow'), player.mana.yellow + yellowGain);
    showCombatAnimation({ icon: '🌟', title: 'PUISSANCE DIVINE', heal: `+${yellowGain} mana jaune`, target: '→ Vous' }, true);
    log(`🌟 Puissance Divine convertit la défense en +${yellowGain} mana jaune.`);
    return true;
}

function applyHoldTheLine(spell) {
    const turns = Math.max(1, Math.floor(spell.duration || 1));
    player.statusEffects.immunityEffects = turns;
    showCombatAnimation({ icon: '🛡️', title: 'TENIR LA LIGNE', damage: 'Immunité aux effets', target: `→ Vous (${turns} tours)` }, true);
    log(`🛡️ Tenir la Ligne: immunité aux effets négatifs pendant ${turns} tours.`);
    return true;
}

function applyHeavensWrath(spell) {
    let count = 0;
    for(let i = 0; i < board.length; i++) {
        if(board[i] === 'combat') {
            board[i] = null;
            count++;
        }
    }

    const dmgPerGem = Math.max(1, Math.floor(spell.dmgPerGem || 1));
    const totalDmg = count * dmgPerGem;
    if(totalDmg <= 0) {
        log(`⚠️ Aucune Action Gem à faire exploser.`);
        return false;
    }

    applyDamage(enemy, totalDmg, { sourceSpell: spell });
    renderBoard();
    showCombatAnimation({ icon: '⚡', title: 'COLÈRE CÉLESTE', damage: `-${totalDmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`⚡ Colère Céleste fait exploser ${count} Action Gem(s) pour ${totalDmg} dégâts.`);
    return true;
}

// BARBARIAN SPELLS
function applyEnrage(spell) {
    player.statusEffects.enraged = spell.duration;
    player.statusEffects.enragedBonus = spell.atkBonus;
    player.attack += spell.atkBonus;
    addBonusTurn(player);
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
    applyDamage(enemy, dmg, { sourceSpell: spell });
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
    applyDamage(enemy, totalDmg, { sourceSpell: spell });
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

function applySummonTempest(spell) {
    const colsToDestroy = Math.max(1, Math.min(boardSize, Math.floor(spell.columns || 1)));
    const availableCols = Array.from({ length: boardSize }, (_, i) => i);
    const pickedCols = [];

    for(let i = 0; i < colsToDestroy && availableCols.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * availableCols.length);
        pickedCols.push(availableCols.splice(randomIndex, 1)[0]);
    }

    pickedCols.forEach(col => {
        for(let row = 0; row < boardSize; row++) {
            board[row * boardSize + col] = null;
        }
    });

    renderBoard();
    showCombatAnimation({ icon: '🌩️', title: 'INVOQUER LA TEMPÊTE', damage: `${pickedCols.length} colonnes détruites`, target: '→ Plateau' }, true);
    log(`🌩️ Invoquer la Tempête détruit ${pickedCols.length} colonne(s).`);
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

function applySingingBlades(spell) {
    const turns = Math.max(1, Math.floor(spell.duration || 1));
    const manaDrain = Math.max(1, Math.floor(spell.manaDrain || 1));
    player.statusEffects.drainOnHit = turns;
    player.statusEffects.drainOnHitAmount = manaDrain;
    showCombatAnimation({ icon: '🎵', title: 'LAMES CHANTANTES', damage: `-${manaDrain} mana / coup`, target: `→ ${enemy.name} (${turns} tours)` }, true);
    log(`🎵 Lames Chantantes active un drain de ${manaDrain} mana par coup pendant ${turns} tours.`);
    return true;
}

function applyDeathbringer(spell) {
    const redMana = Math.max(0, Math.floor(player.mana.red || 0));
    const skullsToCreate = Math.floor(redMana / 2);
    if(skullsToCreate <= 0) {
        log(`⚠️ Pas assez de mana rouge pour créer des crânes.`);
        return false;
    }

    const candidates = board
        .map((tile, index) => ({ tile, index }))
        .filter(entry => colors.includes(entry.tile));

    if(candidates.length <= 0) {
        log(`⚠️ Aucune gemme de couleur à transformer.`);
        return false;
    }

    const count = Math.min(skullsToCreate, candidates.length);
    for(let i = 0; i < count; i++) {
        const idx = Math.floor(Math.random() * candidates.length);
        const target = candidates.splice(idx, 1)[0];
        board[target.index] = 'skull';
    }

    renderBoard();
    showCombatAnimation({ icon: '☠️', title: 'PORTE-MORT', damage: `${count} crânes créés`, target: '→ Plateau' }, true);
    log(`☠️ Porte-Mort crée ${count} crânes (basé sur le mana rouge).`);
    return true;
}

function applyRevenant(spell) {
    player.statusEffects.revenant = true;
    showCombatAnimation({ icon: '👻', title: 'REVENANT', damage: 'PA doublés', target: '→ Vous' }, true);
    log(`👻 Revenant : Les points de combat sont maintenant doublés !`);
    return true;
}
