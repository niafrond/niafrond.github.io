// Gestion des effets spéciaux des sorts de classe

import { player, enemy, currentTurn, log, saveUpdate, showCombatAnimation, finishPlayerTurn, applyDamage, addBonusTurn, addManaForColor } from "./game.js";
import { board, renderBoard, setBoardTargetingMode, checkMatches } from "./board.js";
import { colors, boardSize } from "./constants.js";
import { JOKER_TILE, isJokerTile, isTransformableToJoker } from "./joker.js";

function getManaCap(color) {
    return player.manaCaps?.[color] ?? player.maxMana;
}

function getCurrentCaster() {
    return currentTurn === 'enemy' ? enemy : player;
}

function collectDestroyedColorTilesMana(caster, destroyedTiles = []) {
    if(!caster || !caster.mana) return { total: 0, byColor: {} };

    const byColor = { red: 0, blue: 0, green: 0, yellow: 0, purple: 0 };
    destroyedTiles.forEach(tile => {
        if(colors.includes(tile)) {
            byColor[tile] = (byColor[tile] || 0) + 1;
        }
    });

    let total = 0;
    Object.entries(byColor).forEach(([color, amount]) => {
        if(amount <= 0) return;
        const manaResult = addManaForColor(caster, color, amount, { applyGainBonus: false });
        total += manaResult.gained;
    });

    return { total, byColor };
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
        case 'freezeEnemy': // Paume de Givre
            return applyHandOfIce(spell);
        case 'createSkull': // Doigt Solaire
            return applyFingerOfDeath(spell);
        case 'destroyArea': // Abîme
            return applyChasm(spell);
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
        case 'noEndTurn': // Tir Furtif
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
        case 'redToSkullsHalf': // Porte-Soleil
            return applyDeathbringer(spell);
        case 'doubleBattle': // Esprit des Ancêtres
            return applyRevenant(spell);
        // Sorts avancés multi-mana (3 à 5 couleurs), génériques
        case 'sweepRow': // Lame des Quatre Vents
            return applySweepLines(spell, 'row');
        case 'sweepCross': // Croix du Dragon
            return applySweepLines(spell, 'cross');
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
function applyMageStrike(spell) {
    const blueMana = player.mana.blue;
    const bonusDmg = Math.floor(blueMana / 3);
    const totalDmg = spell.baseDmg + bonusDmg;
    applyDamage(enemy, totalDmg, { sourceSpell: spell });
    showCombatAnimation({ icon: 'fire', title: "FRAPPE DU MAÎTRE TAOÏSTE", damage: `-${totalDmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`Frappe du Maître Taoïste inflige ${totalDmg} dégâts (${spell.baseDmg} base + ${bonusDmg} bonus)`);
    return true;
}

function applyWildMana(spell) {
    const hasAnyTile = board.some(tile => isTransformableToJoker(tile));
    if(!hasAnyTile){
        log(`Aucune gemme à transformer`);
        return false;
    }

    setBoardTargetingMode({
        highlightPredicate: (_index, tile) => isTransformableToJoker(tile),
        onTileClick: (index, tile) => {
            if(!isTransformableToJoker(tile)){
                log(`Choisissez une gemme pour Qi Sauvage.`);
                return true;
            }

            board[index] = JOKER_TILE;
            setBoardTargetingMode(null);
            showCombatAnimation({ icon: 'star', title: "QI SAUVAGE", damage: 'Joker créé !', target: '→ Plateau' }, true);
            log(`Qi Sauvage transforme la gemme choisie en joker !`);
            saveUpdate();
            checkMatches(true);
            return true;
        }
    });

    log(`Qi Sauvage: choisissez n'importe quelle gemme à transformer en joker.`);
    return false;
}

function applyShadowCurse(spell) {
    enemy.statusEffects.itemBlocked = spell.duration || 3;
    showCombatAnimation({ icon: 'moon', title: "TALISMAN DE SCELLEMENT", damage: 'Objets bloqués', target: `→ ${enemy.name} (${enemy.statusEffects.itemBlocked} tours)` }, true);
    log(`Talisman de Scellement bloque les objets ennemis pendant ${enemy.statusEffects.itemBlocked} tours.`);
    return true;
}

function applyDarkChannels(spell) {
    const caster = getCurrentCaster();
    const hasColorTile = board.some(tile => colors.includes(tile));
    if(!hasColorTile){
        log(`Aucune gemme de couleur à cibler.`);
        return false;
    }

    setBoardTargetingMode({
        highlightPredicate: (_index, tile) => colors.includes(tile),
        onTileClick: (_index, tile) => {
            if(!colors.includes(tile)) {
                log(`Choisissez une gemme de couleur pour Méridiens Obscurs.`);
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
                log(`Aucune gemme de couleur ${targetColor} trouvée`);
                return true;
            }

            const boardDiv = document.getElementById('board');
            const tiles = boardDiv ? boardDiv.children : null;
            const rowDelayMs = 110;

            const destroyRow = (rowIndex) => {
                if(rowIndex >= rowsToDestroy.length) {
                    const destroyedTiles = Array.from({ length: count }, () => targetColor);
                    const manaCollected = collectDestroyedColorTilesMana(caster, destroyedTiles);
                    // renderBoard applique la gravite (descente) puis genere les nouvelles tuiles.
                    renderBoard();
                    showCombatAnimation({ icon: 'swirl', title: "MÉRIDIENS OBSCURS", damage: `${count} gâteaux de lune détruits`, target: `+${manaCollected.total} mana récupéré` }, true);
                    log(`Méridiens Obscurs détruit ${count} gâteaux de lune ${targetColor} et ${caster.name} récupère ${manaCollected.total} mana.`);
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

    log(`Méridiens Obscurs: choisissez une couleur en cliquant une gemme.`);
    return false;
}

function applyFlameBolts(spell) {
    const yellowMana = player.mana.yellow;
    const projectiles = Math.floor(yellowMana / 5);
    const totalDmg = projectiles * 5;
    if(projectiles > 0) {
        applyDamage(enemy, totalDmg, { sourceSpell: spell });
        player.mana.yellow = 0;
        showCombatAnimation({ icon: 'bolt', title: "TALISMANS ENFLAMMÉS", damage: `${projectiles} × 5 = ${totalDmg} dégâts`, target: `→ ${enemy.name}` }, true);
        log(`Talismans Enflammés tire ${projectiles} projectiles pour ${totalDmg} dégâts !`);
        return true;
    }
    log(`Pas assez de mana jaune pour tirer des projectiles`);
    return false;
}

function applyIceShield(spell) {
    const turns = spell.duration || 1;
    player.statusEffects.manaShield = { color: 'blue', turns };
    showCombatAnimation({ icon: 'snow', title: "BARRIÈRE DE GIVRE", damage: 'Dégâts -> mana bleu', target: `→ Vous (${turns} tour${turns > 1 ? 's' : ''})` }, true);
    log(`Rempart de Jade de Givre actif: les prochains dégâts sont absorbés par le mana bleu.`);
    return true;
}

function applyFlameblade(spell) {
    const redMana = player.mana.red;
    player.statusEffects.flameblade = redMana;
    player.mana.red = 0;
    showCombatAnimation({ icon: 'fire', title: "LAME DE FEU POURPRE", damage: `+${redMana} dégâts bonus`, target: '→ Arme enchantée' }, true);
    log(`Lame de Feu Pourpre enchante votre arme avec ${redMana} points de dégâts bonus !`);
    return true;
}

function applyWeakness(spell) {
    const reduction = Math.max(0, Math.floor(spell.reduction || 0));
    const duration = Math.max(1, Math.floor(spell.duration || 1));
    enemy.statusEffects.weakened = duration;
    enemy.statusEffects.weakenedAmount = reduction;
    showCombatAnimation({ icon: 'web', title: "SCEAU D'AFFAIBLISSEMENT", damage: `-${reduction} attaque`, target: `→ ${enemy.name} (${duration} tours)` }, true);
    log(`Sceau d'Affaiblissement réduit l'attaque ennemie de ${reduction} pendant ${duration} tours.`);
    return true;
}

function applyHandOfIce(spell) {
    const turns = Math.max(1, Math.floor(spell.duration || 1));
    enemy.statusEffects.stunned = Math.max(enemy.statusEffects.stunned || 0, turns);
    showCombatAnimation({ icon: 'snow', title: "PAUME DE GIVRE", damage: `Étourdi ${turns} tours`, target: `→ ${enemy.name}` }, true);
    log(`Paume de Givre étourdit l'ennemi pendant ${turns} tours.`);
    return true;
}

function applyFingerOfDeath(spell) {
    const available = board.filter(tile => colors.includes(tile)).length;
    const maxTargets = Math.min(3, available);
    if(maxTargets <= 0) {
        log(`Aucun gâteau de lune de couleur à transformer en soleil.`);
        return false;
    }

    let created = 0;
    setBoardTargetingMode({
        highlightPredicate: (_index, tile) => colors.includes(tile),
        onTileClick: (index, tile) => {
            if(!colors.includes(tile)) {
                log(`Choisissez une gemme de couleur pour Doigt Solaire.`);
                return true;
            }

            board[index] = 'skull';
            created++;
            renderBoard();

            if(created < maxTargets) {
                log(`Doigt Solaire: choisissez encore ${maxTargets - created} cible(s).`);
                return true;
            }

            setBoardTargetingMode(null);
            showCombatAnimation({ icon: 'skull', title: "DOIGT SOLAIRE", damage: `${created} crânes créés`, target: '→ Plateau' }, true);
            log(`Doigt Solaire crée ${created} crânes !`);
            saveUpdate();
            checkMatches(true);
            return true;
        }
    });

    log(`Doigt Solaire: choisissez ${maxTargets} gâteau(x) de lune à transformer en soleil.`);
    return false;
}

function applyChasm(spell) {
    const caster = getCurrentCaster();
    setBoardTargetingMode({
        highlightPredicate: () => true,
        onTileClick: (index) => {
            const centerRow = Math.floor(index / boardSize);
            const centerCol = index % boardSize;
            const destroyedTiles = [];

            for(let row = centerRow - 2; row <= centerRow + 2; row++) {
                for(let col = centerCol - 2; col <= centerCol + 2; col++) {
                    if(row >= 0 && row < boardSize && col >= 0 && col < boardSize) {
                        const idx = row * boardSize + col;
                        const tile = board[idx];
                        destroyedTiles.push(tile);
                        board[idx] = null;
                    }
                }
            }

            const manaCollected = collectDestroyedColorTilesMana(caster, destroyedTiles);

            setBoardTargetingMode(null);
            renderBoard();
            showCombatAnimation({ icon: 'fire', title: "FISSURE DU FLEUVE JAUNE", damage: 'Zone 5×5 détruite', target: `+${manaCollected.total} mana récupéré` }, true);
            log(`Abîme détruit une zone 5×5 et ${caster.name} récupère ${manaCollected.total} mana.`);
            saveUpdate();
            checkMatches(true);
            return true;
        }
    });

    log(`Abîme: choisissez le centre de la zone à détruire.`);
    return false;
}

function applyFireballArea(spell) {
    const caster = getCurrentCaster();
    setBoardTargetingMode({
        highlightPredicate: () => true,
        onTileClick: (index) => {
            const centerRow = Math.floor(index / boardSize);
            const centerCol = index % boardSize;
            const destroyedTiles = [];

            for(let r = centerRow - 1; r <= centerRow + 1; r++) {
                for(let c = centerCol - 1; c <= centerCol + 1; c++) {
                    if(r >= 0 && r < boardSize && c >= 0 && c < boardSize) {
                        const idx = r * boardSize + c;
                        destroyedTiles.push(board[idx]);
                        board[idx] = null;
                    }
                }
            }

            const manaCollected = collectDestroyedColorTilesMana(caster, destroyedTiles);

            setBoardTargetingMode(null);
            applyDamage(enemy, spell.dmg, { sourceSpell: spell });
            renderBoard();
            showCombatAnimation({ icon: 'fire', title: "SPHÈRE DE FLAMMES", damage: `-${spell.dmg} dégâts`, target: `+${manaCollected.total} mana récupéré` }, true);
            log(`Sphère de Flammes détruit une zone 3×3, inflige ${spell.dmg} dégâts et fait récupérer ${manaCollected.total} mana à ${caster.name}.`);
            saveUpdate();
            checkMatches(true);
            return true;
        }
    });

    log(`Sphère de Flammes: choisissez le centre de la zone à détruire.`);
    return false;
}

function applyStoneskin(spell) {
    const bonus = Math.max(0, Math.floor(spell.defenseBonus || 0));
    const turns = Math.max(1, Math.floor(spell.duration || 1));
    player.statusEffects.stoneskin = turns;
    player.statusEffects.stoneskinDefense = bonus;
    player.defense = (player.defense || 0) + bonus;
    showCombatAnimation({ icon: 'rock', title: "PEAU DE JADE", heal: `+${bonus} défense`, target: `→ Vous (${turns} tours)` }, true);
    log(`Peau de Jade augmente la défense de ${bonus} pendant ${turns} tours.`);
    return true;
}

function applyStrength(spell) {
    const bonus = Math.max(0, Math.floor(spell.atkBonus || 0));
    const turns = Math.max(1, Math.floor(spell.duration || 1));
    player.statusEffects.strength = turns;
    player.statusEffects.strengthBonus = bonus;
    player.attack += bonus;
    showCombatAnimation({ icon: 'muscle', title: "FORCE DU TIGRE", damage: `+${bonus} attaque`, target: `→ Vous (${turns} tours)` }, true);
    log(`Force augmente l'attaque physique de ${bonus} pendant ${turns} tours.`);
    return true;
}

function applyMirrorShield(spell) {
    const percent = Math.max(0, Math.floor(spell.reflectPercent || 0));
    const turns = Math.max(1, Math.floor(spell.duration || 1));
    player.statusEffects.reflectDamage = turns;
    player.statusEffects.reflectDamagePercent = percent;
    showCombatAnimation({ icon: 'mirror', title: "MIROIR DE BRONZE", damage: `${percent}% renvoyés`, target: `→ Vous (${turns} tours)` }, true);
    log(`Miroir de Bronze renverra ${percent}% des dégâts pendant ${turns} tours.`);
    return true;
}

function applyManaSiphon(spell) {
    const stealTotal = Math.max(0, Math.floor(spell.manaSteal || 0));
    if(stealTotal <= 0) {
        log(`Aspiration du Qi n'a aucun effet (manaSteal invalide).`);
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

    showCombatAnimation({ icon: 'swirl', title: "ASPIRATION DU QI", damage: `-${drained} mana ennemi`, target: '→ Vous' }, true);
    log(`Aspiration du Qi absorbe ${drained} mana ennemi.`);
    return true;
}

// ASSASSIN SPELLS
function applySneakAttack(spell) {
    applyDamage(enemy, spell.dmg, { sourceSpell: spell });
    addBonusTurn(player);
    showCombatAnimation({ icon: 'sword', title: "TIR FURTIF", damage: `-${spell.dmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`Tir Furtif inflige ${spell.dmg} dégâts sans terminer le tour !`);
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
    showCombatAnimation({ icon: 'bolt', title: "TIR RAPIDE", damage: `-${dmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`Tir Rapide convertit ${count} gâteaux de lune jaunes et inflige ${dmg} dégâts !`);
    return true;
}

function applyConfuse(spell) {
    enemy.statusEffects.confused = spell.duration;
    showCombatAnimation({ icon: 'dizzy', title: "FLÈCHE DE BRUME", damage: '−mana/combo', target: `→ ${enemy.name} (${spell.duration} tours)` }, true);
    log(`Flèche de Brume : l'ennemi ne gagne que 1 mana par combinaison pendant ${spell.duration} tours !`);
    return true;
}

function applyStealth(spell) {
    const turns = spell.duration || 1;
    player.statusEffects.manaShield = { color: 'purple', turns };
    showCombatAnimation({ icon: 'eye', title: "VOILE DE BRUME", damage: 'Dégâts -> mana violet', target: `→ Vous (${turns} tour${turns > 1 ? 's' : ''})` }, true);
    log(`Voile de Brume active: les prochains dégâts sont absorbés par le mana violet.`);
    return true;
}

function applyPoison(spell) {
    enemy.statusEffects.poisoned = spell.duration;
    enemy.statusEffects.poisonDamage = spell.poisonDmg;
    showCombatAnimation({ icon: 'poison', title: "FLÈCHE EMPOISONNÉE", damage: `${spell.poisonDmg} dégâts/tour`, target: `→ ${enemy.name} (${spell.duration} tours)` }, true);
    log(`Flèche Empoisonnée applique un poison de ${spell.poisonDmg} dégâts/tour pendant ${spell.duration} tours !`);
    return true;
}

function applyShadowStrike(spell) {
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
    const dmg = count * 2;
    applyDamage(enemy, dmg, { sourceSpell: spell });
    renderBoard();
    showCombatAnimation({ icon: 'moon', title: "FLÈCHE D'OMBRE", damage: `-${dmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`Flèche d'Ombre détruit ${count} gâteaux de lune violettes, inflige ${dmg} dégâts et fait récupérer ${manaCollected.total} mana à ${caster.name}.`);
    return true;
}

function applyDualShot(spell) {
    const weapons = Array.isArray(player.weapons) ? player.weapons : [];
    if(weapons.length < 2) {
        log(`Flèches Jumelles nécessite au moins 2 armes dans l'inventaire.`);
        return false;
    }

    const sorted = [...weapons].sort((a, b) => (b.damage || 0) - (a.damage || 0));
    const totalDmg = Math.max(1, Math.floor((sorted[0].damage || 0) + (sorted[1].damage || 0) + (player.attack || 0)));
    applyDamage(enemy, totalDmg, { sourceSpell: spell });
    showCombatAnimation({ icon: 'target', title: "FLÈCHES JUMELLES", damage: `-${totalDmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`Flèches Jumelles inflige ${totalDmg} dégâts (2 meilleures armes + attaque).`);
    return true;
}

// TEMPLAR SPELLS
function applyDefensiveWall(spell) {
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
    log(`Muraille Impériale détruit ${count} gâteaux de lune violettes: +${defenseGain} défense et +${manaCollected.total} mana pour ${caster.name}.`);
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
    showCombatAnimation({ icon: 'shield', title: "COUP DE BOUCLIER ROND", damage: `-${totalDmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`Coup de Bouclier Rond inflige ${totalDmg} dégâts et retire les statuts négatifs !`);
    return true;
}

function applyFocus(spell) {
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

function applyIntimidate(spell) {
    const stolen = Math.min(spell.cpSteal, enemy.combatPoints);
    enemy.combatPoints -= stolen;
    player.combatPoints += stolen;
    showCombatAnimation({ icon: 'anger', title: "REGARD IMPÉRIAL", damage: `-${stolen} PA`, target: `→ ${enemy.name}` }, true);
    log(`Regard Impérial vole ${stolen} points de combat à l'ennemi !`);
    return true;
}

function applyRush(spell) {
    const yellowMana = player.mana.yellow;
    const extraTurns = Math.floor(yellowMana / 7);
    const totalTurns = 2 + extraTurns;
    enemy.statusEffects.stunned = totalTurns;
    showCombatAnimation({ icon: 'wind', title: "CHARGE DE CAVALERIE", damage: `Étourdi ${totalTurns} tours`, target: `→ ${enemy.name}` }, true);
    log(`Charge de Cavalerie étourdit l'ennemi pour ${totalTurns} tours !`);
    return true;
}

function applyCounterAttack(spell) {
    const turns = Math.max(1, Math.floor(spell.duration || 1));
    const counterDmg = Math.max(1, Math.floor(spell.counterDmg || 1));
    player.statusEffects.counterOnBlock = turns;
    player.statusEffects.counterOnBlockDmg = counterDmg;
    showCombatAnimation({ icon: 'shield', title: "RIPOSTE DU GARDE", damage: `${counterDmg} dégâts de riposte`, target: `→ Vous (${turns} tours)` }, true);
    log(`Riposte du Garde active: ${counterDmg} dégâts renvoyés en blocage pendant ${turns} tours.`);
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
        log(`Aucune Action Gem à détruire pour Renfort des Troupes.`);
        return false;
    }

    const heal = count * Math.max(1, Math.floor(spell.healPerGem || 1));
    player.hp = Math.min(player.maxHp, player.hp + heal);
    renderBoard();
    showCombatAnimation({ icon: 'spark', title: "RENFORT DES TROUPES", heal: `+${heal} HP`, target: '→ Vous' }, true);
    log(`Renfort des Troupes détruit ${count} Action Gem(s) et soigne ${heal} HP.`);
    return true;
}

function applyBarrier(spell) {
    player.statusEffects.barrier = spell.duration;
    player.statusEffects.barrierDefense = spell.defenseBonus;
    player.defense = (player.defense || 0) + spell.defenseBonus;
    showCombatAnimation({ icon: 'shield', title: "REMPART DE JADE", heal: `+${spell.defenseBonus} défense`, target: `→ Vous (${spell.duration} tours)` }, true);
    log(`Rempart de Jade augmente la défense de ${spell.defenseBonus} pendant ${spell.duration} tours !`);
    return true;
}

function applyDivinePower(spell) {
    const defense = Math.max(0, Math.floor(player.defense || 0));
    const yellowGain = Math.floor(defense / 5);
    if(yellowGain <= 0) {
        log(`Défense insuffisante pour générer du mana jaune.`);
        return false;
    }

    player.mana.yellow = Math.min(getManaCap('yellow'), player.mana.yellow + yellowGain);
    showCombatAnimation({ icon: 'star', title: "MANDAT DU CIEL", heal: `+${yellowGain} mana jaune`, target: '→ Vous' }, true);
    log(`Mandat du Ciel convertit la défense en +${yellowGain} mana jaune.`);
    return true;
}

function applyHoldTheLine(spell) {
    const turns = Math.max(1, Math.floor(spell.duration || 1));
    player.statusEffects.immunityEffects = turns;
    showCombatAnimation({ icon: 'shield', title: "FORMATION DE LA TORTUE", damage: 'Immunité aux effets', target: `→ Vous (${turns} tours)` }, true);
    log(`Formation de la Tortue: immunité aux effets négatifs pendant ${turns} tours.`);
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
        log(`Aucune Action Gem à faire exploser.`);
        return false;
    }

    applyDamage(enemy, totalDmg, { sourceSpell: spell });
    renderBoard();
    showCombatAnimation({ icon: 'bolt', title: "COURROUX DU CIEL", damage: `-${totalDmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`Courroux du Ciel fait exploser ${count} Action Gem(s) pour ${totalDmg} dégâts.`);
    return true;
}

// BARBARIAN SPELLS
function applyEnrage(spell) {
    player.statusEffects.enraged = spell.duration;
    player.statusEffects.enragedBonus = spell.atkBonus;
    player.attack += spell.atkBonus;
    addBonusTurn(player);
    showCombatAnimation({ icon: 'anger', title: "FUREUR DES STEPPES", damage: `+${spell.atkBonus} attaque`, target: `→ Vous (${spell.duration} tours)` }, true);
    log(`Rage augmente l'attaque de ${spell.atkBonus} pendant ${spell.duration} tours !`);
    return true;
}

function applyCleave(spell) {
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
    const dmg = count;
    applyDamage(enemy, dmg, { sourceSpell: spell });
    renderBoard();
    showCombatAnimation({ icon: 'axe', title: "ENTAILLE DE LA HORDE", damage: `-${dmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`Entaille de la Horde détruit ${count} gâteaux de lune jaunes, inflige ${dmg} dégâts et récupère ${manaCollected.total} mana pour ${caster.name}.`);
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
    showCombatAnimation({ icon: 'axe', title: 'LANCER DE HACHE', damage: `-${totalDmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`Lancer de Hache inflige ${totalDmg} dégâts (${spell.baseDmg} + ${skullCount} crânes) !`);
    return true;
}

function applyBloodlust(spell) {
    player.mana.red = Math.min(getManaCap('red'), player.mana.red + spell.manaGain);
    showCombatAnimation({ icon: 'blood', title: "SOIF DE BATAILLE", heal: `+${spell.manaGain} mana rouge`, target: '→ Vous' }, true);
    log(`Soif de Bataille donne +${spell.manaGain} mana rouge !`);
    return true;
}

// ── Sorts avancés multi-mana ────────────────────────────────────────────────

const MANA_COLORS = ['red', 'blue', 'green', 'yellow', 'purple'];

// Détruit les cases `indices` : récupère le mana des gemmes de couleur et inflige `dmgPerTile` par case détruite.
function destroyIndices(spell, indices, title, label) {
    const caster = getCurrentCaster();
    const unique = [...new Set(indices)].filter(i => board[i] !== null && board[i] !== undefined);
    const destroyedTiles = unique.map(i => board[i]);
    unique.forEach(i => { board[i] = null; });
    const manaCollected = collectDestroyedColorTilesMana(caster, destroyedTiles);
    const dmg = Math.max(0, Math.floor(spell.dmgPerTile || 0)) * unique.length;
    if(dmg > 0) applyDamage(enemy, dmg, { sourceSpell: spell });
    renderBoard();
    showCombatAnimation({ icon: 'bolt', title, damage: dmg > 0 ? `-${dmg} dégâts` : label, target: `${label} • +${manaCollected.total} mana` }, true);
    log(`${spell.name} : ${label}, ${dmg} dégâts, +${manaCollected.total} mana récupéré.`);
    return { count: unique.length, dmg, mana: manaCollected.total };
}

const rowIndices = row => Array.from({ length: boardSize }, (_, c) => row * boardSize + c);
const colIndices = col => Array.from({ length: boardSize }, (_, r) => r * boardSize + col);

function applySweepLines(spell, shape) {
    setBoardTargetingMode({
        highlightPredicate: () => true,
        onTileClick: (index) => {
            const row = Math.floor(index / boardSize);
            const col = index % boardSize;
            const indices = shape === 'cross' ? [...rowIndices(row), ...colIndices(col)] : rowIndices(row);
            setBoardTargetingMode(null);
            destroyIndices(spell, indices, spell.name.toUpperCase(), shape === 'cross' ? 'Ligne et colonne détruites' : 'Ligne détruite');
            saveUpdate();
            checkMatches(true);
            return true;
        }
    });
    log(`${spell.name} : choisissez ${shape === 'cross' ? 'le centre de la croix' : 'la ligne à détruire'}.`);
    return false;
}

function applySkullsFromColors(spell) {
    const converted = Array.isArray(spell.convert) ? spell.convert : [];
    let count = 0;
    for(let i = 0; i < board.length; i++) {
        if(converted.includes(board[i])) {
            board[i] = 'skull';
            count++;
        }
    }
    if(count === 0) {
        log(`Aucune gemme à transformer en crâne.`);
        return false;
    }
    renderBoard();
    showCombatAnimation({ icon: 'skull', title: spell.name.toUpperCase(), damage: `${count} gemmes → crânes`, target: '→ Plateau' }, true);
    log(`${spell.name} transforme ${count} gemmes en crânes !`);
    checkMatches(true);
    return false;
}

function applyCageEnemy(spell) {
    const turns = Math.max(1, Math.floor(spell.duration || 1));
    if(!enemy.statusEffects) enemy.statusEffects = {};
    enemy.statusEffects.stunned = Math.max(enemy.statusEffects.stunned || 0, turns);
    const drain = Math.max(0, Math.floor(spell.manaDrain || 0));
    let drained = 0;
    MANA_COLORS.forEach(color => {
        const amount = Math.min(drain, enemy.mana?.[color] || 0);
        if(amount > 0) { enemy.mana[color] -= amount; drained += amount; }
    });
    showCombatAnimation({ icon: 'snow', title: spell.name.toUpperCase(), damage: `Étourdi ${turns} tours`, target: `→ ${enemy.name} • -${drained} mana` }, true);
    log(`${spell.name} étourdit l'ennemi ${turns} tours et lui retire ${drained} mana.`);
    return true;
}

function applySecondWind(spell) {
    const heal = Math.max(0, Math.floor(spell.heal || 0));
    player.hp = Math.min(player.maxHp, player.hp + heal);
    ['poisoned', 'poisonDamage', 'stunned', 'weakened', 'weakenedAmount', 'confused'].forEach(k => { delete player.statusEffects[k]; });
    addBonusTurn(player);
    showCombatAnimation({ icon: 'leaf', title: spell.name.toUpperCase(), heal: `+${heal} PV • statuts purgés`, target: '→ Vous • rejouez !' }, true);
    log(`${spell.name} soigne ${heal} PV, retire les statuts négatifs et vous laisse rejouer.`);
    return true;
}

function applyStarRain(spell) {
    const rows = [...Array(boardSize).keys()].sort(() => Math.random() - 0.5).slice(0, Math.max(1, spell.rows || 2));
    const cols = [...Array(boardSize).keys()].sort(() => Math.random() - 0.5).slice(0, Math.max(1, spell.columns || 2));
    const indices = [...rows.flatMap(rowIndices), ...cols.flatMap(colIndices)];
    destroyIndices(spell, indices, spell.name.toUpperCase(), `${rows.length} lignes et ${cols.length} colonnes détruites`);
    saveUpdate();
    checkMatches(true);
    return false;
}

function applyHarmony(spell) {
    const dmg = Math.max(0, Math.floor(spell.dmg || 0));
    const heal = Math.max(0, Math.floor(spell.heal || 0));
    const drain = Math.max(0, Math.floor(spell.manaDrain || 0));
    applyDamage(enemy, dmg, { sourceSpell: spell });
    player.hp = Math.min(player.maxHp, player.hp + heal);
    MANA_COLORS.forEach(color => { enemy.mana[color] = Math.max(0, (enemy.mana[color] || 0) - drain); });
    showCombatAnimation({ icon: 'yinyang', title: spell.name.toUpperCase(), damage: `-${dmg} dégâts`, heal: `+${heal} PV`, target: `→ ${enemy.name} • -${drain} mana de chaque couleur` }, true);
    log(`${spell.name} inflige ${dmg} dégâts, vous soigne de ${heal} PV et vide ${drain} mana de chaque couleur à l'ennemi.`);
    return true;
}

function applySummonTempest(spell) {
    const caster = getCurrentCaster();
    const colsToDestroy = Math.max(1, Math.min(boardSize, Math.floor(spell.columns || 1)));
    const availableCols = Array.from({ length: boardSize }, (_, i) => i);
    const pickedCols = [];
    const destroyedTiles = [];

    for(let i = 0; i < colsToDestroy && availableCols.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * availableCols.length);
        pickedCols.push(availableCols.splice(randomIndex, 1)[0]);
    }

    pickedCols.forEach(col => {
        for(let row = 0; row < boardSize; row++) {
            destroyedTiles.push(board[row * boardSize + col]);
            board[row * boardSize + col] = null;
        }
    });

    const manaCollected = collectDestroyedColorTilesMana(caster, destroyedTiles);
    if(spell.dmgPerTile) applyDamage(enemy, Math.floor(spell.dmgPerTile) * destroyedTiles.length, { sourceSpell: spell });

    renderBoard();
    showCombatAnimation({ icon: 'bolt', title: (spell.name || "Appel du Vent Céleste").toUpperCase(), damage: `${pickedCols.length} colonnes détruites`, target: `+${manaCollected.total} mana récupéré` }, true);
    log(`${spell.name || 'Appel du Vent Céleste'} détruit ${pickedCols.length} colonne(s) et ${caster.name} récupère ${manaCollected.total} mana.`);
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
    showCombatAnimation({ icon: 'anger', title: "FUREUR DU LOUP DES STEPPES", damage: `${count} rouges → crânes`, target: '→ Plateau' }, true);
    log(`Fureur du Loup des Steppes transforme ${count} gâteaux de lune rouges en crânes !`);
    return true;
}

function applySingingBlades(spell) {
    const turns = Math.max(1, Math.floor(spell.duration || 1));
    const manaDrain = Math.max(1, Math.floor(spell.manaDrain || 1));
    player.statusEffects.drainOnHit = turns;
    player.statusEffects.drainOnHitAmount = manaDrain;
    showCombatAnimation({ icon: 'music', title: "FLÈCHES SIFFLANTES", damage: `-${manaDrain} mana / coup`, target: `→ ${enemy.name} (${turns} tours)` }, true);
    log(`Flèches Sifflantes active un drain de ${manaDrain} mana par coup pendant ${turns} tours.`);
    return true;
}

function applyDeathbringer(spell) {
    const redMana = Math.max(0, Math.floor(player.mana.red || 0));
    const skullsToCreate = Math.floor(redMana / 2);
    if(skullsToCreate <= 0) {
        log(`Pas assez de mana rouge pour créer des crânes.`);
        return false;
    }

    const candidates = board
        .map((tile, index) => ({ tile, index }))
        .filter(entry => colors.includes(entry.tile));

    if(candidates.length <= 0) {
        log(`Aucune gemme de couleur à transformer.`);
        return false;
    }

    const count = Math.min(skullsToCreate, candidates.length);
    for(let i = 0; i < count; i++) {
        const idx = Math.floor(Math.random() * candidates.length);
        const target = candidates.splice(idx, 1)[0];
        board[target.index] = 'skull';
    }

    renderBoard();
    showCombatAnimation({ icon: 'poison', title: "PORTE-SOLEIL", damage: `${count} crânes créés`, target: '→ Plateau' }, true);
    log(`Porte-Soleil crée ${count} crânes (basé sur le mana rouge).`);
    return true;
}

function applyRevenant(spell) {
    player.statusEffects.revenant = true;
    showCombatAnimation({ icon: 'ghost', title: "ESPRIT DES ANCÊTRES", damage: 'PA doublés', target: '→ Vous' }, true);
    log(`Esprit des Ancêtres : Les points de combat sont maintenant doublés !`);
    return true;
}
