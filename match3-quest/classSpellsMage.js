// Sorts de classe : mage, ensorceleur et assassin (frappe, sphères, malédictions, glace, poison…). Extrait de classSpellEffects.js.
import { escapeHtml } from "./escapeHtml.js";
import { player, enemy, log, saveUpdate, showCombatAnimation, applyDamage, lastSpellDamage } from './game.js';
import { board, renderBoard, setBoardTargetingMode, checkMatches } from './board.js';
import { colors, boardSize } from './constants.js';
import { JOKER_TILE, isTransformableToJoker } from './joker.js';

import { collectDestroyedColorTilesMana, getCurrentCaster } from './classSpellEffects.js';

export function applyMageStrike(spell) {
    const blueMana = player.mana.blue;
    const bonusDmg = Math.floor(blueMana / 3);
    let totalDmg = spell.baseDmg + bonusDmg;
    applyDamage(enemy, totalDmg, { sourceSpell: spell });
    totalDmg = lastSpellDamage(totalDmg);
    showCombatAnimation({ icon: 'fire', title: "FRAPPE DU MAÎTRE TAOÏSTE", damage: `-${totalDmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`Frappe du Maître Taoïste inflige ${totalDmg} dégâts (${spell.baseDmg} base + ${bonusDmg} bonus)`);
    return true;
}

export function applyWildMana(spell) {
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

export function applyShadowCurse(spell) {
    enemy.statusEffects.itemBlocked = spell.duration || 3;
    showCombatAnimation({ icon: 'moon', title: "TALISMAN DE SCELLEMENT", damage: 'Objets bloqués', target: `→ ${enemy.name} (${enemy.statusEffects.itemBlocked} tours)` }, true);
    log(`Talisman de Scellement bloque les objets ennemis pendant ${enemy.statusEffects.itemBlocked} tours.`);
    return true;
}

export function applyDarkChannels(spell) {
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
                    showCombatAnimation({ icon: 'swirl', title: "MÉRIDIENS OBSCURS", damage: `${count} gâteaux de lune détruits`, target: `+${manaCollected.total} qì récupéré` }, true);
                    log(`Méridiens Obscurs détruit ${count} gâteaux de lune ${targetColor} et ${escapeHtml(caster.name)} récupère ${manaCollected.total} qì.`);
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

export function applyFlameBolts(spell) {
    const yellowMana = player.mana.yellow;
    const projectiles = Math.floor(yellowMana / 5);
    let totalDmg = projectiles * 5;
    if(projectiles > 0) {
        applyDamage(enemy, totalDmg, { sourceSpell: spell });
        totalDmg = lastSpellDamage(totalDmg);
        player.mana.yellow = 0;
        showCombatAnimation({ icon: 'bolt', title: "TALISMANS ENFLAMMÉS", damage: `${projectiles} × 5 = ${totalDmg} dégâts`, target: `→ ${enemy.name}` }, true);
        log(`Talismans Enflammés tire ${projectiles} projectiles pour ${totalDmg} dégâts !`);
        return true;
    }
    log(`Pas assez de qì jaune pour tirer des projectiles`);
    return false;
}

export function applyIceShield(spell) {
    const turns = spell.duration || 1;
    player.statusEffects.manaShield = { color: 'blue', turns };
    showCombatAnimation({ icon: 'snow', title: "BARRIÈRE DE GIVRE", damage: 'Dégâts -> qì bleu', target: `→ Vous (${turns} tour${turns > 1 ? 's' : ''})` }, true);
    log(`Rempart de Jade de Givre actif: les prochains dégâts sont absorbés par le qì bleu.`);
    return true;
}

export function applyFlameblade(spell) {
    const redMana = player.mana.red;
    player.statusEffects.flameblade = redMana;
    player.mana.red = 0;
    showCombatAnimation({ icon: 'fire', title: "LAME DE FEU POURPRE", damage: `+${redMana} dégâts bonus`, target: '→ Arme enchantée' }, true);
    log(`Lame de Feu Pourpre enchante votre arme avec ${redMana} points de dégâts bonus !`);
    return true;
}

export function applyWeakness(spell) {
    const reduction = Math.max(0, Math.floor(spell.reduction || 0));
    const duration = Math.max(1, Math.floor(spell.duration || 1));
    enemy.statusEffects.weakened = duration;
    enemy.statusEffects.weakenedAmount = reduction;
    showCombatAnimation({ icon: 'web', title: "SCEAU D'AFFAIBLISSEMENT", damage: `-${reduction} attaque`, target: `→ ${enemy.name} (${duration} tours)` }, true);
    log(`Sceau d'Affaiblissement réduit l'attaque ennemie de ${reduction} pendant ${duration} tours.`);
    return true;
}

export function applyHandOfIce(spell) {
    const turns = Math.max(1, Math.floor(spell.duration || 1));
    enemy.statusEffects.stunned = Math.max(enemy.statusEffects.stunned || 0, turns);
    showCombatAnimation({ icon: 'snow', title: "PAUME DE GIVRE", damage: `Étourdi ${turns} tours`, target: `→ ${enemy.name}` }, true);
    log(`Paume de Givre étourdit l'ennemi pendant ${turns} tours.`);
    return true;
}

export function applyFingerOfDeath(spell) {
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

export function applyChasm(spell) {
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
            showCombatAnimation({ icon: 'fire', title: "FISSURE DU FLEUVE JAUNE", damage: 'Zone 5×5 détruite', target: `+${manaCollected.total} qì récupéré` }, true);
            log(`Abîme détruit une zone 5×5 et ${escapeHtml(caster.name)} récupère ${manaCollected.total} qì.`);
            saveUpdate();
            checkMatches(true);
            return true;
        }
    });

    log(`Abîme: choisissez le centre de la zone à détruire.`);
    return false;
}

export function applyFireballArea(spell) {
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
            const sphereDmg = lastSpellDamage(spell.dmg);
            renderBoard();
            showCombatAnimation({ icon: 'fire', title: "SPHÈRE DE FLAMMES", damage: `-${sphereDmg} dégâts`, target: `+${manaCollected.total} qì récupéré` }, true);
            log(`Sphère de Flammes détruit une zone 3×3, inflige ${sphereDmg} dégâts et fait récupérer ${manaCollected.total} qì à ${escapeHtml(caster.name)}.`);
            saveUpdate();
            checkMatches(true);
            return true;
        }
    });

    log(`Sphère de Flammes: choisissez le centre de la zone à détruire.`);
    return false;
}
