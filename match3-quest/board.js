import { player, enemy, currentTurn, saveUpdate, log, skullDamage, finishEnemyTurn, finishPlayerTurn, showCombatAnimation, grantComboMasteryRewards, grantManaGeneratedXP, addManaForColor, logActiveAction, clampEnemyAttackDamage, applyDamage } from "./game.js";
import { colors, boardSize } from "./constants.js";
import {
    hasMatches as hasMatchesOnBoard,
    checkForMatchesOnly as checkForMatchesOnlyOnBoard,
    checkMatchAtPosition,
    findPossibleMatches,
    collectMatches
} from "./matchMechanics.js";

// grille et sélection
export let board = [];
export let selected = null;

// Minuteur pour suggestion de match
let suggestionTimer = null;
let suggestedMoveIndices = null;

// Track si le jeu a vraiment commencé (un joueur a joué)
let gameStarted = false;
let turnDistinctMatches = 0;
let comboMasteryTriggered = false;
let pendingSwap = null;
let tileClickInterceptor = null;
let tileHighlightPredicate = null;
let boardDropProbabilities = null;
let pendingComboAnimations = 0;
let boardSettledCallbacks = [];

const SKULL_ATTACK_BONUS_DIVISOR = 10;
const SKULL_ATTACK_BONUS_CAP = 6;

function onBoardSettled(callback){
    if(typeof callback !== 'function') return;
    if(pendingComboAnimations <= 0){
        callback();
        return;
    }
    boardSettledCallbacks.push(callback);
}

function beginComboAnimation(){
    pendingComboAnimations++;
}

function endComboAnimation(){
    pendingComboAnimations = Math.max(0, pendingComboAnimations - 1);
    if(pendingComboAnimations > 0) return;

    const callbacks = boardSettledCallbacks;
    boardSettledCallbacks = [];
    callbacks.forEach(cb => cb());
}

export function setGameStarted(started){
    gameStarted = started;
}

export function setBoardTargetingMode(config = null){
    if(!config){
        tileClickInterceptor = null;
        tileHighlightPredicate = null;
        refreshTargetingHighlights();
        return;
    }

    tileClickInterceptor = typeof config.onTileClick === 'function' ? config.onTileClick : null;
    tileHighlightPredicate = typeof config.highlightPredicate === 'function' ? config.highlightPredicate : null;
    refreshTargetingHighlights();
}

function refreshTargetingHighlights(){
    const boardDiv = document.getElementById('board');
    if(!boardDiv) return;
    const tiles = boardDiv.children;

    for(let i = 0; i < tiles.length; i++){
        tiles[i].classList.remove('targetable');
        if(tileHighlightPredicate && tileHighlightPredicate(i, board[i])){
            tiles[i].classList.add('targetable');
        }
    }
}

function computeSpecialTileProbabilities(){
    const hasWeaponsOrSpells = player.availableWeapons.length > 0 || player.availableSpells.length > 0;
    if(!hasWeaponsOrSpells) {
        return { skullProb: 0.15, combatProb: 0.02 };
    }
    return { skullProb: 0.25, combatProb: 0.07 };
}

function refreshBoardDropProbabilities(){
    boardDropProbabilities = computeSpecialTileProbabilities();
}

function generateNewBoard(){
    // On fige les probabilites de drop pour tout le plateau courant.
    refreshBoardDropProbabilities();
    // la grille peut contenir aussi quelques tuiles spéciales
    do{
        board=[];
        for(let i=0;i<boardSize*boardSize;i++){
            board.push(generateRandomTile());
        }
    }while(hasMatchesOnBoard(board));
}

function generateRandomTile(){
    if(!boardDropProbabilities){
        refreshBoardDropProbabilities();
    }

    const { skullProb, combatProb } = boardDropProbabilities;
    const r = Math.random();
    if(r < skullProb) return 'skull';
    if(r < skullProb + combatProb) return 'combat';
    return colors[Math.floor(Math.random() * colors.length)];
}

function fillColumnByGravity(col){
    const kept = [];
    for(let row = boardSize - 1; row >= 0; row--){
        const idx = row * boardSize + col;
        const tile = board[idx];
        if(tile !== null && tile !== undefined){
            kept.push(tile);
        }
    }

    let writeRow = boardSize - 1;
    for(const tile of kept){
        const writeIdx = writeRow * boardSize + col;
        board[writeIdx] = tile;
        writeRow--;
    }

    while(writeRow >= 0){
        const writeIdx = writeRow * boardSize + col;
        board[writeIdx] = generateRandomTile();
        writeRow--;
    }
}

function normalizeBoardHoles(){
    for(let col = 0; col < boardSize; col++){
        fillColumnByGravity(col);
    }
}

export function generateBoard(){
    generateNewBoard();
    const boardDiv=document.getElementById('board');
    if(!boardDiv){
        console.error('Board element not found!');
        return;
    }
    boardDiv.innerHTML="";
    for(let i=0;i<boardSize*boardSize;i++){
        const tile=document.createElement('div');
        tile.className=`tile ${board[i]}`;
        tile.dataset.index=i;
        tile.onclick=()=>selectTile(i);
        boardDiv.appendChild(tile);
    }
    renderBoard();
}

// Régénère le plateau avec animation quand aucune combinaison n'est possible
export function regenerateBoard(){
    log("🔄 Plateau régénéré (aucune combinaison possible) !");
    const boardDiv = document.getElementById('board');
    const tiles = boardDiv.children;

    // Animation via showCombatAnimation (overlay sur le plateau)
    showCombatAnimation({ icon: '🚫', title: 'Aucun coup possible !', target: 'Le plateau est régénéré...' }, true);

    // Disparition des tuiles après que l'overlay soit visible (~900ms)
    setTimeout(() => {
        for(let i = 0; i < tiles.length; i++){
            tiles[i].style.opacity = '0';
            tiles[i].style.transform = 'scale(0.5)';
        }

        // Régénérer le plateau après animation
        setTimeout(() => {
            generateNewBoard();
            for(let i = 0; i < tiles.length; i++){
                tiles[i].style.opacity = '1';
                tiles[i].style.transform = 'scale(1)';
                tiles[i].className = `tile ${board[i]}`;
                if(board[i] === 'skull') tiles[i].textContent = '💀';
                else if(board[i] === 'combat') tiles[i].textContent = '⚔️';
                else if(board[i] === 'joker') tiles[i].textContent = '★';
                else tiles[i].textContent = '';
            }
            renderBoard();
        }, 400);
    }, 900);
}

export function selectTile(index){
    if(tileClickInterceptor){
        const consumed = tileClickInterceptor(index, board[index]);
        if(consumed !== false){
            return;
        }
    }

    // Empêcher le joueur de jouer si ce n'est pas son tour
    if(currentTurn !== 'player'){
        log('⚠️ Ce n\'est pas votre tour !');
        return;
    }

    // Regle commune joueur/ennemi: plateau bloque => regeneration puis meme acteur rejoue.
    if(getSortedPossibleMoves().length === 0){
        handleNoPossibleMoveForCurrentTurn();
        return;
    }
    
    // Arrêter le minuteur de suggestion
    clearSuggestionTimer();
    clearSuggestion();
    
    const boardDiv=document.getElementById('board');
    const tiles=boardDiv.children;
    
    if(selected===null){ 
        selected=index;
        tiles[index].classList.add('selected');
        // Arrêter le minuteur temporairement
        clearSuggestionTimer();
        clearSuggestion();
        return; 
    }
    // n'accepte que les tuiles adjacentes (haut/bas/gauche/droite)
    const selectedRow = Math.floor(selected / boardSize);
    const selectedCol = selected % boardSize;
    const indexRow = Math.floor(index / boardSize);
    const indexCol = index % boardSize;
    const isAdjacent = Math.abs(selectedRow - indexRow) + Math.abs(selectedCol - indexCol) === 1;
    if(!isAdjacent){
        log("⚠️ Échange non valide (doit être adjacent)");
        tiles[selected].classList.remove('selected');
        selected=null;
        return;
    }
    tiles[selected].classList.remove('selected');
    swapTiles(selected,index);
    selected=null;
    
    // Redémarrer le minuteur après un mouvement
    startSuggestionTimer();
}

export function swapTiles(i,j){
    // Marquer le jeu comme commencé si c'est le tour du joueur
    if(currentTurn === 'player'){
        gameStarted = true;
    }

    turnDistinctMatches = 0;
    comboMasteryTriggered = false;

    logActiveAction(`echange les tuiles ${i} <-> ${j}`);
    
    // Effectuer le swap
    [board[i],board[j]]=[board[j],board[i]];
    
    // Vérifier si le swap crée un match autour des deux tuiles échangées
    const hasMatch = Boolean(checkMatchAtPosition(board, i) || checkMatchAtPosition(board, j));
    
    if(!hasMatch) {
        pendingSwap = null;
        // Aucun match créé : annuler le swap (mais garder le tour)
        [board[i],board[j]]=[board[j],board[i]];
        renderBoard();
        if(currentTurn === 'player'){
            log("⚠️ Aucun match créé ! Mouvement annulé, à vous de rejouer.");
            // Redémarrer le minuteur après un mauvais mouvement
            startSuggestionTimer();
        } else {
            log("⚠️ L'ennemi n'a créé aucun match. Mouvement annulé, il rejoue.");
            setTimeout(() => {
                if(currentTurn === 'enemy') enemyMakeMove();
            }, 700);
        }
        return;
    }

    pendingSwap = {
        i,
        j,
        turn: currentTurn,
        resolvedAtLeastOneMatch: false
    };
    
    // Il y a un match : continuer normalement
    renderBoard();
    checkMatches();
}

export function renderBoard(skipCleanup = false){
    startSuggestionTimer();
    const boardDiv=document.getElementById('board');
    if(!boardDiv){
        console.error('Board element not found in renderBoard!');
        return;
    }
    normalizeBoardHoles();
    const tiles=boardDiv.children;
    for(let i=0;i<board.length;i++){
        let t=board[i];
        if(!t) continue;
        if(!skipCleanup){
            tiles[i].className=`tile ${t}`;
        } else {
            // Préserver les classes d'animation existantes
            const existingClasses = Array.from(tiles[i].classList).filter(c => 
                c === 'match' || c === 'blink' || c === 'disappear' || c === 'fall'
            );
            tiles[i].className = `tile ${t}`;
            existingClasses.forEach(c => tiles[i].classList.add(c));
        }
        tiles[i].textContent = '';
        if(t==='skull') tiles[i].textContent='💀';
        else if(t==='combat') tiles[i].textContent='⚔️';
        else if(t==='joker') tiles[i].textContent='★';
    }
    refreshTargetingHighlights();
}

// Vérifie uniquement si des matchs existent (sans les traiter)
export function checkForMatchesOnly(){
    return checkForMatchesOnlyOnBoard(board);
}

export function checkMatches(){
    if(pendingComboAnimations > 0){
        onBoardSettled(() => {
            setTimeout(checkMatches, 0);
        });
        return;
    }

    // Ne traiter les matchs que si le jeu a vraiment commencé
    if(!gameStarted){
        renderBoard(); // Seulement redessiner sans traiter les matchs
        return;
    }
    
    let combos=false;
    
    function handleRun(indices, info){
        // info: {type,color?,len,makeJoker?}
        combos=true;
        turnDistinctMatches++;
        // Determine which player gets the rewards
        const currentPlayer = currentTurn === 'player' ? player : enemy;
        // apply effects
        if(info.type==='color'){
            // Gain de mana : 1 par tuile du match (3=>3, 4=>4, 5=>5...)
            const manaResult = addManaForColor(currentPlayer, info.color, info.len);

            if(currentPlayer === player){
                const generatedMana = manaResult.gained;
                if(generatedMana > 0){
                    grantManaGeneratedXP(generatedMana);
                    log(`⭐ +${generatedMana} XP (mana généré)`);
                }
            }
            if(info.len>=4){ 
                currentPlayer.bonusTurn = true;
                log(`🎁 Match de ${info.len} : tour bonus gagné par ${currentTurn === 'player' ? 'le joueur' : 'l\'ennemi'}`);
                // Afficher une animation de tour bonus
                const isPlayer = currentTurn === 'player';
                showCombatAnimation(
                    { icon: '🎁', title: 'TOUR BONUS !', damage: `Match de ${info.len} tuiles`, target: isPlayer ? 'Vous rejouez !' : "L'ennemi rejoue !" },
                    isPlayer
                );
            }
            if(info.len>=5){ info.makeJoker=true; }
        } else if(info.type==='combat'){
            currentPlayer.combatPoints += info.len;
            log(`⚔️ +${info.len} points de combat pour ${currentTurn === 'player' ? 'le joueur' : 'l\'ennemi'}`);
            // Bonus de tour pour 4+ épées
            if(info.len>=4){ 
                currentPlayer.bonusTurn = true;
                log(`🎁 Match de ${info.len} : tour bonus gagné par ${currentTurn === 'player' ? 'le joueur' : 'l\'ennemi'}`);
                const isPlayer = currentTurn === 'player';
                showCombatAnimation(
                    { icon: '🎁', title: 'TOUR BONUS !', damage: `Match de ${info.len} épées`, target: isPlayer ? 'Vous rejouez !' : "L'ennemi rejoue !" },
                    isPlayer
                );
            }
            if(info.len>=5){ info.makeJoker=true; }
        } else if(info.type==='skull'){
            const attacker = currentTurn === 'player' ? player : enemy;
            const opponent = currentTurn === 'player' ? enemy : player;
            // Diminution des pics de degats des cranes a haut niveau.
            const attackBonus = Math.min(
                SKULL_ATTACK_BONUS_CAP,
                Math.floor((attacker.attack || 0) / SKULL_ATTACK_BONUS_DIVISOR)
            );
            const rawDmg = info.len * (skullDamage + attackBonus);
            const defReduction = Math.floor((opponent.defense || 0) / 2);
            let dmg = Math.max(1, rawDmg - defReduction);
            if(opponent === player && player.damageReduction > 0) {
                dmg = Math.max(1, Math.floor(dmg * (1 - player.damageReduction)));
            }
            if(attacker === enemy) {
                dmg = clampEnemyAttackDamage(dmg, enemy);
            }
            applyDamage(opponent, dmg);
            log(`💀 Match ${info.len} crânes : -${dmg} HP pour ${currentTurn === 'player' ? 'l\'ennemi' : 'le joueur'}`);
            // Bonus de tour pour 4+ crânes
            if(info.len>=4){ 
                currentPlayer.bonusTurn = true;
                log(`🎁 Match de ${info.len} crânes : tour bonus gagné par ${currentTurn === 'player' ? 'le joueur' : 'l\'ennemi'}`);
                const isPlayer = currentTurn === 'player';
                showCombatAnimation(
                    { icon: '🎁', title: 'TOUR BONUS !', damage: `Match de ${info.len} crânes`, target: isPlayer ? 'Vous rejouez !' : "L'ennemi rejoue !" },
                    isPlayer
                );
            }
            if(info.len>=5){ info.makeJoker=true; }
        }

        if(currentTurn === 'player' && turnDistinctMatches > 5 && !comboMasteryTriggered){
            comboMasteryTriggered = true;
            currentPlayer.bonusTurn = true;
            const comboXp = grantComboMasteryRewards();

            const candidates = board
                .map((tile, index) => ({ tile, index }))
                .filter(entry => entry.tile && entry.tile !== 'joker');

            if(candidates.length > 0){
                const random = candidates[Math.floor(Math.random() * candidates.length)];
                board[random.index] = 'joker';
            }

            showCombatAnimation(
                { icon: '🌟', title: 'COMBO MAGISTRAL', damage: `${turnDistinctMatches} matchs différents`, target: `+${comboXp} XP, Joker créé, vous rejouez !` },
                true
            );
            log(`🌟 Combo magistral : +${comboXp} XP, création d'un Joker et tour bonus !`);
        }

        highlightCombo(indices, info);
    }

    const matches = collectMatches(board);
    for(const match of matches){
        handleRun(match.indices, match.info);
        if(match.info.makeJoker){
            board[match.indices[0]] = 'joker';
        }
    }

    if(!combos){
        if(pendingSwap && !pendingSwap.resolvedAtLeastOneMatch){
            const { i, j, turn } = pendingSwap;
            pendingSwap = null;

            // Sécurité: si aucun combo réel n'a été résolu, on annule le swap et le même acteur rejoue.
            [board[i],board[j]]=[board[j],board[i]];
            turnDistinctMatches = 0;
            comboMasteryTriggered = false;
            renderBoard();

            if(turn === 'enemy' && currentTurn === 'enemy'){
                log("⚠️ Aucun match validé pour l'ennemi. Mouvement annulé, il rejoue.");
                setTimeout(() => {
                    if(currentTurn === 'enemy') enemyMakeMove();
                }, 700);
            } else if(turn === 'player' && currentTurn === 'player'){
                log("⚠️ Aucun match validé ! Mouvement annulé, à vous de rejouer.");
                startSuggestionTimer();
            }
            return;
        }

        pendingSwap = null;
        turnDistinctMatches = 0;
        comboMasteryTriggered = false;
        renderBoard(); // Seulement si pas de combos pour nettoyer les classes 'match'
        // Si c'est le tour de l'ennemi et qu'il n'y a pas de combos, terminer son tour
        if(currentTurn === 'enemy'){
            finishEnemyTurn();
        }
        // Si c'est le tour du joueur et qu'il n'y a pas de combos, terminer son tour
        else if(currentTurn === 'player'){
            finishPlayerTurn();
        }
    } else {
        if(pendingSwap){
            pendingSwap.resolvedAtLeastOneMatch = true;
        }
        saveUpdate();
        // Attendre la fin reelle des animations de chute avant de relancer la detection.
        onBoardSettled(() => {
            setTimeout(checkMatches, 0);
        });
    }
}

// Fonction pour faire descendre les tuiles et créer des nouvelles en haut
function dropTiles(removedIndices){
    const removed = new Set(removedIndices);
    const affectedCols = new Set();
    const movedTileOffsets = new Map();
    const newTilesPerCol = new Map();
    
    // Identifier les colonnes affectées
    removedIndices.forEach(idx => {
        affectedCols.add(idx % boardSize);
    });
    
    // Pour chaque colonne affectée, faire descendre les tuiles
    for(let col of affectedCols){
        let writeRow = boardSize - 1;

        // Compacte vers le bas et garde la trace des tuiles qui glissent.
        for(let row = boardSize - 1; row >= 0; row--){
            const sourceIdx = row * boardSize + col;
            if(removed.has(sourceIdx)){
                continue;
            }

            const tile = board[sourceIdx];
            if(tile === undefined || tile === null){
                continue;
            }

            const destIdx = writeRow * boardSize + col;
            board[destIdx] = tile;

            if(writeRow !== row){
                movedTileOffsets.set(destIdx, writeRow - row);
            }

            writeRow--;
        }

        const numNewTiles = writeRow + 1;
        newTilesPerCol.set(col, numNewTiles);

        // Ajouter des nouvelles tuiles en haut.
        while(writeRow >= 0){
            const idx = writeRow * boardSize + col;
            board[idx] = generateRandomTile();
            writeRow--;
        }
    }
    
    return {
        affectedCols,
        movedTileOffsets,
        newTilesPerCol
    };
}

function animateGravityGlide(tiles, movedTileOffsets){
    if(!movedTileOffsets || movedTileOffsets.size === 0){
        return;
    }

    const rowStep = (() => {
        const first = tiles[0];
        const secondRow = tiles[boardSize];
        if(first && secondRow){
            const a = first.getBoundingClientRect();
            const b = secondRow.getBoundingClientRect();
            const step = b.top - a.top;
            if(step > 0) return step;
        }
        return 58;
    })();

    movedTileOffsets.forEach((deltaRows, destIdx) => {
        const tile = tiles[destIdx];
        if(!tile) return;

        const offsetY = deltaRows * rowStep;
        tile.style.transition = 'none';
        tile.style.transform = `translateY(-${offsetY}px)`;
    });

    requestAnimationFrame(() => {
        movedTileOffsets.forEach((_, destIdx) => {
            const tile = tiles[destIdx];
            if(!tile) return;
            tile.style.transition = 'transform 0.26s ease-out';
            tile.style.transform = 'translateY(0)';
        });
    });

    setTimeout(() => {
        movedTileOffsets.forEach((_, destIdx) => {
            const tile = tiles[destIdx];
            if(!tile) return;
            tile.style.transition = '';
            tile.style.transform = '';
        });
    }, 300);
}

export function highlightCombo(indices, info){
    beginComboAnimation();
    const tiles=document.getElementById('board').children;
    indices.forEach(i=>tiles[i].classList.add('match'));
    // message personnalisé
    if(info){
        if(info.type==='color'){
            log(`✨ Combo ${info.color} x${info.len}` + (info.len>=4?" (bonus)":""));
        } else if(info.type==='combat'){
            log(`⚔️ Combo points de combat x${info.len}`);
        } else if(info.type==='skull'){
            log(`💀 Combo crânes x${info.len}`);
        }
    } else {
        log(`✨ Combo ${board[indices[0]]}!`);
    }
    setTimeout(()=>{
        // Clignotement subtil
        indices.forEach(i=>{
            tiles[i].classList.remove('match');
            tiles[i].classList.add('blink');
        });
        
        setTimeout(()=>{
            // Effet de disparition
            indices.forEach(i=>{
                tiles[i].classList.remove('blink');
                tiles[i].classList.add('disappear');
            });
            
            // Traiter les jokers spéciaux avant suppression
            indices.forEach(i=>{
                if(info && info.makeJoker && i===indices[0]){
                    board[i]='joker';
                } else {
                    board[i]=null; // Marquer comme supprimé
                }
            });
            
            setTimeout(()=>{
            // Faire descendre les tuiles et ajouter de nouvelles en haut
            const nullIndices = indices.filter(i=>board[i]===null);
            
            const gravityResult = dropTiles(nullIndices);
            const affectedCols = gravityResult.affectedCols;
            const newTilesPerCol = gravityResult.newTilesPerCol;
            renderBoard(true); // Préserver les classes d'animation
            animateGravityGlide(tiles, gravityResult.movedTileOffsets);
            
            // Nettoyer la classe disappear des tuiles qui ont été déplacées
            for(let col of affectedCols){
                for(let row=0; row<boardSize; row++){
                    const idx = row * boardSize + col;
                    tiles[idx].classList.remove('disappear', 'blink', 'match');
                }
            }
            
            // Ajouter l'animation uniquement aux nouvelles tuiles en haut de chaque colonne
            for(let col of affectedCols){
                const numNewTiles = newTilesPerCol.get(col) || 0;
                for(let row=0; row<numNewTiles; row++){
                    const idx = row * boardSize + col;
                    const tile = tiles[idx];
                    // délai progressif : 50ms par rangée
                    const delay = row * 50;
                    setTimeout(()=>{
                        tile.classList.add('fall');
                    }, delay);
                }
            }
            
            // Enlever la classe fall après les animations
            setTimeout(()=>{
                for(let col of affectedCols){
                    const numNewTiles = newTilesPerCol.get(col) || 0;
                    for(let row=0; row<numNewTiles; row++){
                        const idx = row * boardSize + col;
                        tiles[idx].classList.remove('fall');
                    }
                }
                endComboAnimation();
            }, 700 + (boardSize * 50));
        }, 150);
        }, 800); // Durée du clignotement (2 cycles de 0.4s)
    }, 300);
}

// Fonctions pour gérer la suggestion de match
function startSuggestionTimer(){
    // Arrêter l'ancien timer s'il existe
    clearSuggestionTimer();

    // Ne démarrer le timer que si c'est le tour du joueur et qu'aucune tuile n'est sélectionnée
    if(currentTurn !== 'player' || selected !== null) return;
    
    // Démarrer un nouveau timer
    suggestionTimer = setTimeout(() => {
        showMatchSuggestion();
    }, 3000); // 3 secondes
}

export function restartSuggestionTimer(){
    clearSuggestion();
    startSuggestionTimer();
}

function clearSuggestionTimer(){
    if(suggestionTimer !== null){
        clearTimeout(suggestionTimer);
        suggestionTimer = null;
    }
}

function getSortedPossibleMoves(){
    const possibleMoves = findPossibleMatches(board);
    possibleMoves.sort((a, b) => b.matchLength - a.matchLength);
    return possibleMoves;
}

function handleNoPossibleMoveForCurrentTurn(){
    const actor = currentTurn === 'player' ? 'joueur' : 'ennemi';
    log(`🔄 Aucun coup possible pour le ${actor}, plateau régénéré.`);

    selected = null;
    regenerateBoard();

    // regenerateBoard prend ~1300ms avec la nouvelle animation (900ms notice + 400ms disparition)
    const retryDelay = currentTurn === 'enemy' ? 1800 : 1400;
    setTimeout(() => {
        if(currentTurn === 'enemy'){
            enemyMakeMove();
        } else if(currentTurn === 'player'){
            startSuggestionTimer();
        }
    }, retryDelay);
}

function showMatchSuggestion(){
    // Trouver un match potentiel
    const possibleMoves = getSortedPossibleMoves();
    
    if(possibleMoves.length > 0){
        const suggestedMove = possibleMoves[0];
        
        suggestedMoveIndices = [suggestedMove.from, suggestedMove.to];
        
        const boardDiv = document.getElementById('board');
        const tiles = boardDiv.children;
        
        // Ajouter la classe de clignotement doux
        suggestedMoveIndices.forEach(idx => {
            tiles[idx].classList.add('suggested');
        });
        
        log(`💡 Conseil : essayez d'échanger ces deux tuiles !`);
        return;
    }

    handleNoPossibleMoveForCurrentTurn();
}

function clearSuggestion(){
    if(suggestedMoveIndices !== null){
        const boardDiv = document.getElementById('board');
        if(boardDiv){
            const tiles = boardDiv.children;
            suggestedMoveIndices.forEach(idx => {
                tiles[idx].classList.remove('suggested');
            });
        }
        suggestedMoveIndices = null;
    }
}

// Petite animation de déplacement pour visualiser le swap de l'ennemi
function animateEnemySwap(from, to, onComplete){
    const boardDiv = document.getElementById('board');
    if(!boardDiv){
        onComplete();
        return;
    }

    const tiles = boardDiv.children;
    const fromTile = tiles[from];
    const toTile = tiles[to];

    if(!fromTile || !toTile){
        onComplete();
        return;
    }

    const fromRect = fromTile.getBoundingClientRect();
    const toRect = toTile.getBoundingClientRect();
    const deltaX = toRect.left - fromRect.left;
    const deltaY = toRect.top - fromRect.top;

    // Anime des copies visuelles pour eviter l'effet de double swap lors du rerender.
    function createGhost(sourceTile, rect){
        const ghost = sourceTile.cloneNode(true);
        ghost.style.position = 'fixed';
        ghost.style.left = `${rect.left}px`;
        ghost.style.top = `${rect.top}px`;
        ghost.style.width = `${rect.width}px`;
        ghost.style.height = `${rect.height}px`;
        ghost.style.margin = '0';
        ghost.style.zIndex = '40';
        ghost.style.pointerEvents = 'none';
        ghost.style.transition = 'transform 0.32s ease, box-shadow 0.32s ease';
        ghost.style.boxShadow = '0 0 12px rgba(231, 76, 60, 0.85)';
        return ghost;
    }

    const fromGhost = createGhost(fromTile, fromRect);
    const toGhost = createGhost(toTile, toRect);

    fromTile.style.visibility = 'hidden';
    toTile.style.visibility = 'hidden';
    document.body.appendChild(fromGhost);
    document.body.appendChild(toGhost);

    requestAnimationFrame(() => {
        fromGhost.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        toGhost.style.transform = `translate(${-deltaX}px, ${-deltaY}px)`;
    });

    setTimeout(() => {
        fromGhost.remove();
        toGhost.remove();
        fromTile.style.visibility = '';
        toTile.style.visibility = '';
        onComplete();
    }, 340);
}

// Fonction pour que l'ennemi fasse un mouvement sur le plateau
export function enemyMakeMove(){
    clearSuggestionTimer();
    clearSuggestion();
    log('🤖 L\'ennemi réfléchit...');
    
    const possibleMoves = getSortedPossibleMoves();
    
    if(possibleMoves.length > 0){
        const move = possibleMoves[0];
        log(`🎯 L'ennemi échange les tuiles...`);
        setTimeout(() => {
            animateEnemySwap(move.from, move.to, () => {
                swapTiles(move.from, move.to);
            });
        }, 800);
    } else {
        handleNoPossibleMoveForCurrentTurn();
    }
}

// Mouvement aléatoire (ennemi stupide) : choisit un swap valide au hasard
export function enemyMakeRandomMove(){
    clearSuggestionTimer();
    clearSuggestion();
    log('🤖 L\'ennemi hésite...');

    const possibleMoves = getSortedPossibleMoves();
    if(possibleMoves.length === 0){ handleNoPossibleMoveForCurrentTurn(); return; }

    // Prendre un mouvement aléatoire parmi tous les valides (pas forcément le meilleur)
    const move = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
    log(`🎲 L'ennemi fait un move aléatoire...`);
    setTimeout(() => {
        animateEnemySwap(move.from, move.to, () => {
            swapTiles(move.from, move.to);
        });
    }, 800);
}

