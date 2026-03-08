import { player, enemy, currentTurn, saveUpdate, log, skullDamage, finishEnemyTurn, finishPlayerTurn, showAttackAnimation, grantComboMasteryRewards, grantManaGeneratedXP } from "./game.js";
import { colors, boardSize } from "./constants.js";

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

export function setGameStarted(started){
    gameStarted = started;
}

// utilitaire utilisé lors de la génération pour éviter combos initiaux
export function hasMatches(){
    for(let i=0;i<boardSize;i++){
        for(let j=0;j<boardSize;j++){
            const idx=i*boardSize+j;
            const color=board[idx];
            if(j<=boardSize-3 && board[idx+1]===color && board[idx+2]===color) return true;
            if(i<=boardSize-3 && board[idx+boardSize]===color && board[idx+2*boardSize]===color) return true;
        }
    }
    return false;
}

function generateNewBoard(){
    // la grille peut contenir aussi quelques tuiles spéciales
    do{
        board=[];
        for(let i=0;i<boardSize*boardSize;i++){
            board.push(generateRandomTile());
        }
    }while(hasMatches());
}

function getSpecialTileProbabilities(){
    const hasWeaponsOrSpells = player.availableWeapons.length > 0 || player.availableSpells.length > 0;
    if(!hasWeaponsOrSpells) {
        return { skullProb: 0.15, combatProb: 0.02 };
    }
    return { skullProb: 0.25, combatProb: 0.07 };
}

function generateRandomTile(){
    const { skullProb, combatProb } = getSpecialTileProbabilities();
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
    
    // Animation de disparition
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
}

export function selectTile(index){
    // Empêcher le joueur de jouer si ce n'est pas son tour
    if(currentTurn !== 'player'){
        log('⚠️ Ce n\'est pas votre tour !');
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
    const adj=[selected-1,selected+1,selected-boardSize,selected+boardSize];
    if(!adj.includes(index)){
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
    
    // Effectuer le swap
    [board[i],board[j]]=[board[j],board[i]];
    
    // Vérifier s'il y a un match après le swap
    const hasMatch = checkForMatchesOnly();
    
    if(!hasMatch) {
        // Aucun match créé : annuler le swap (mais garder le tour)
        [board[i],board[j]]=[board[j],board[i]];
        renderBoard();
        if(currentTurn === 'player'){
            log("⚠️ Aucun match créé ! Mouvement annulé, à vous de rejouer.");
            // Redémarrer le minuteur après un mauvais mouvement
            startSuggestionTimer();
        } else {
            log("⚠️ L'ennemi n'a créé aucun match. Son mouvement est annulé.");
            finishEnemyTurn();
        }
        return;
    }
    
    // Il y a un match : continuer normalement
    renderBoard();
    checkMatches();
}

export function renderBoard(skipCleanup = false){
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
}

// Vérifie uniquement si des matchs existent (sans les traiter)
export function checkForMatchesOnly(){
    // scan horizontal
    for(let i=0;i<boardSize;i++){
        for(let j=0;j<boardSize-2;j++){
            const idx=i*boardSize+j;
            const t=board[idx];
            const t1=board[idx+1];
            const t2=board[idx+2];
            
            // Ignorer si toutes sont des jokers
            if(t==='joker' && t1==='joker' && t2==='joker') continue;
            
            // Match avec jokers pour couleurs
            if(colors.includes(t) || colors.includes(t1) || colors.includes(t2)){
                // Extraire la couleur (ignorer les jokers)
                const nonJokers = [t, t1, t2].filter(tile => tile !== 'joker' && colors.includes(tile));
                if(nonJokers.length === 0) continue; // Que des jokers
                const matchColor = nonJokers[0];
                // Vérifier que toutes les tuiles non-joker ont la même couleur
                if(nonJokers.every(tile => tile === matchColor)) return true;
            }
            // Match avec jokers pour types spéciaux (skull, combat)
            else if((t === t1 || t === 'joker' || t1 === 'joker') && 
                    (t1 === t2 || t1 === 'joker' || t2 === 'joker') && 
                    (t === t2 || t === 'joker' || t2 === 'joker')){
                const nonJokers = [t, t1, t2].filter(tile => tile !== 'joker');
                if(nonJokers.length > 0 && nonJokers.every(tile => tile === nonJokers[0])) return true;
            }
        }
    }
    
    // scan vertical
    for(let j=0;j<boardSize;j++){
        for(let i=0;i<boardSize-2;i++){
            const idx=i*boardSize+j;
            const t=board[idx];
            const t1=board[(i+1)*boardSize+j];
            const t2=board[(i+2)*boardSize+j];
            
            // Ignorer si toutes sont des jokers
            if(t==='joker' && t1==='joker' && t2==='joker') continue;
            
            // Match avec jokers pour couleurs
            if(colors.includes(t) || colors.includes(t1) || colors.includes(t2)){
                // Extraire la couleur (ignorer les jokers)
                const nonJokers = [t, t1, t2].filter(tile => tile !== 'joker' && colors.includes(tile));
                if(nonJokers.length === 0) continue; // Que des jokers
                const matchColor = nonJokers[0];
                // Vérifier que toutes les tuiles non-joker ont la même couleur
                if(nonJokers.every(tile => tile === matchColor)) return true;
            }
            // Match avec jokers pour types spéciaux (skull, combat)
            else if((t === t1 || t === 'joker' || t1 === 'joker') && 
                    (t1 === t2 || t1 === 'joker' || t2 === 'joker') && 
                    (t === t2 || t === 'joker' || t2 === 'joker')){
                const nonJokers = [t, t1, t2].filter(tile => tile !== 'joker');
                if(nonJokers.length > 0 && nonJokers.every(tile => tile === nonJokers[0])) return true;
            }
        }
    }
    
    return false;
}

export function checkMatches(){
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
            let manaGain = info.len;
            
            // Vérifier les aptitudes du joueur pour bonus de mana
            if(currentPlayer === player && player.abilities){
                if(info.color === 'red' && player.abilities.includes('fireMastery')) manaGain += 2;
                if(info.color === 'blue' && player.abilities.includes('iceMastery')) manaGain += 2;
                if(info.color === 'green' && player.abilities.includes('natureMastery')) manaGain += 2;
                if(info.color === 'yellow' && player.abilities.includes('stormMastery')) manaGain += 2;
                if(info.color === 'purple' && player.abilities.includes('shadowMastery')) manaGain += 2;
            }
            
            const manaBefore = currentPlayer.mana[info.color];
            const manaCap = currentPlayer === player ? player.maxMana : 50;
            const manaAfter = Math.min(manaCap, manaBefore + manaGain);
            currentPlayer.mana[info.color] = manaAfter;

            if(currentPlayer === player){
                const generatedMana = Math.max(0, manaAfter - manaBefore);
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
                showAttackAnimation(
                    `<div class="attack-icon">🎁</div><div class="attack-title">TOUR BONUS !</div><div class="attack-damage">Match de ${info.len} tuiles</div><div class="attack-target">${isPlayer ? 'Vous rejouez !' : 'L\'ennemi rejoue !'}</div>`,
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
                showAttackAnimation(
                    `<div class="attack-icon">🎁</div><div class="attack-title">TOUR BONUS !</div><div class="attack-damage">Match de ${info.len} épées</div><div class="attack-target">${isPlayer ? 'Vous rejouez !' : 'L\'ennemi rejoue !'}</div>`,
                    isPlayer
                );
            }
            if(info.len>=5){ info.makeJoker=true; }
        } else if(info.type==='skull'){
            const dmg = info.len * skullDamage;
            const opponent = currentTurn === 'player' ? enemy : player;
            opponent.hp -= dmg;
            log(`💀 Match ${info.len} crânes : -${dmg} HP pour ${currentTurn === 'player' ? 'l\'ennemi' : 'le joueur'}`);
            // Bonus de tour pour 4+ crânes
            if(info.len>=4){ 
                currentPlayer.bonusTurn = true;
                log(`🎁 Match de ${info.len} crânes : tour bonus gagné par ${currentTurn === 'player' ? 'le joueur' : 'l\'ennemi'}`);
                const isPlayer = currentTurn === 'player';
                showAttackAnimation(
                    `<div class="attack-icon">🎁</div><div class="attack-title">TOUR BONUS !</div><div class="attack-damage">Match de ${info.len} crânes</div><div class="attack-target">${isPlayer ? 'Vous rejouez !' : 'L\'ennemi rejoue !'}</div>`,
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

            showAttackAnimation(
                `<div class="attack-icon">🌟</div><div class="attack-title">COMBO MAGISTRAL</div><div class="attack-damage">${turnDistinctMatches} matchs différents</div><div class="attack-target">+${comboXp} XP, Joker créé, vous rejouez !</div>`,
                true
            );
            log(`🌟 Combo magistral : +${comboXp} XP, création d'un Joker et tour bonus !`);
        }

        highlightCombo(indices, info);
    }

    // scan horizontal
    for(let i=0;i<boardSize;i++){
        let j=0;
        while(j<boardSize){
            const idx=i*boardSize+j;
            const t=board[idx];
            let run=[idx];
            let type=t;
            if(colors.includes(t) || t==='joker') type='color';
            let color = colors.includes(t)?t:null;
            let k=j+1;
            while(k<boardSize){
                const idx2=i*boardSize+k;
                const t2=board[idx2];
                if(type==='color'){
                    // Joker = wildcard, mais une fois une couleur trouvée,
                    // on ne doit accepter que cette couleur (ou joker).
                    if(t2==='joker' || (color && t2===color) || (!color && colors.includes(t2))){
                        run.push(idx2);
                        if(!color && colors.includes(t2)) color=t2;
                        k++;
                        continue;
                    }
                } else {
                    if(t2===type || t2==='joker' || t==='joker'){ 
                        run.push(idx2); 
                        if(t==='joker' && t2!=='joker') type=t2;
                        k++; 
                        continue; 
                    }
                }
                break;
            }
            if(run.length>=3){
                const info={type:type,len:run.length,color:color};
                handleRun(run, info);
                if(info.makeJoker){ board[run[0]]='joker'; }
            }
            j += Math.max(run.length,1);
        }
    }

    // scan vertical
    for(let j=0;j<boardSize;j++){
        let i=0;
        while(i<boardSize){
            const idx=i*boardSize+j;
            const t=board[idx];
            let run=[idx];
            let type=t;
            if(colors.includes(t) || t==='joker') type='color';
            let color = colors.includes(t)?t:null;
            let k=i+1;
            while(k<boardSize){
                const idx2=k*boardSize+j;
                const t2=board[idx2];
                if(type==='color'){
                    // Joker = wildcard, mais une fois une couleur trouvée,
                    // on ne doit accepter que cette couleur (ou joker).
                    if(t2==='joker' || (color && t2===color) || (!color && colors.includes(t2))){
                        run.push(idx2);
                        if(!color && colors.includes(t2)) color=t2;
                        k++;
                        continue;
                    }
                } else {
                    if(t2===type || t2==='joker' || t==='joker'){ 
                        run.push(idx2); 
                        if(t==='joker' && t2!=='joker') type=t2;
                        k++; 
                        continue; 
                    }
                }
                break;
            }
            if(run.length>=3){
                const info={type:type,len:run.length,color:color};
                handleRun(run, info);
                if(info.makeJoker){ board[run[0]]='joker'; }
            }
            i += Math.max(run.length,1);
        }
    }

    if(!combos){
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
        saveUpdate();
        // Le délai doit être suffisant pour toutes les animations
        setTimeout(checkMatches, 1500); // Augmenté pour tenir compte du clignotement (800ms) + disparition + chute
    }
}

// Fonction pour faire descendre les tuiles et créer des nouvelles en haut
function dropTiles(removedIndices){
    const removed = new Set(removedIndices);
    const affectedCols = new Set();
    
    // Identifier les colonnes affectées
    removedIndices.forEach(idx => {
        affectedCols.add(idx % boardSize);
    });
    
    // Pour chaque colonne affectée, faire descendre les tuiles
    for(let col of affectedCols){
        let column = [];
        for(let row=0; row<boardSize; row++){
            const idx = row * boardSize + col;
            if(!removed.has(idx) && board[idx] !== undefined && board[idx] !== null){
                column.push(board[idx]);
            }
        }
        // Ajouter des nouvelles tuiles en haut
        while(column.length < boardSize){
            column.unshift(generateRandomTile());
        }
        // Remettre la colonne dans le board
        for(let row=0; row<boardSize; row++){
            const idx = row * boardSize + col;
            board[idx] = column[row];
        }
    }
    
    return affectedCols;
}

export function highlightCombo(indices, info){
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
            
            // Compter les tuiles supprimées par colonne pour savoir combien de nouvelles tuiles
            const newTilesPerCol = new Map();
            nullIndices.forEach(idx => {
                const col = idx % boardSize;
                newTilesPerCol.set(col, (newTilesPerCol.get(col) || 0) + 1);
            });
            
            const affectedCols = dropTiles(nullIndices);
            renderBoard(true); // Préserver les classes d'animation
            
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
            }, 700 + (boardSize * 50));
        }, 150);
        }, 800); // Durée du clignotement (2 cycles de 0.4s)
    }, 300);
}

// Fonctions pour gérer la suggestion de match
function startSuggestionTimer(){
    // Ne démarrer le timer que si c'est le tour du joueur
    if(currentTurn !== 'player') return;
    
    // Arrêter l'ancien timer s'il existe
    clearSuggestionTimer();
    
    // Démarrer un nouveau timer
    suggestionTimer = setTimeout(() => {
        showMatchSuggestion();
    }, 5000); // 5 secondes
}

function clearSuggestionTimer(){
    if(suggestionTimer !== null){
        clearTimeout(suggestionTimer);
        suggestionTimer = null;
    }
}

function showMatchSuggestion(){
    // Trouver un match potentiel
    const possibleMoves = findPossibleMatches();
    
    if(possibleMoves.length > 0){
        // Choisir un bon match (privilégier les combos les plus longs)
        possibleMoves.sort((a, b) => b.matchLength - a.matchLength);
        const suggestedMove = possibleMoves[0];
        
        suggestedMoveIndices = [suggestedMove.from, suggestedMove.to];
        
        const boardDiv = document.getElementById('board');
        const tiles = boardDiv.children;
        
        // Ajouter la classe de clignotement doux
        suggestedMoveIndices.forEach(idx => {
            tiles[idx].classList.add('suggested');
        });
        
        log(`💡 Conseil : essayez d'échanger ces deux tuiles !`);
    }
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

    // Effet léger pour que le joueur suive bien le mouvement
    fromTile.style.transition = 'transform 0.32s ease, box-shadow 0.32s ease';
    toTile.style.transition = 'transform 0.32s ease, box-shadow 0.32s ease';
    fromTile.style.zIndex = '25';
    toTile.style.zIndex = '25';
    fromTile.style.boxShadow = '0 0 12px rgba(231, 76, 60, 0.85)';
    toTile.style.boxShadow = '0 0 12px rgba(231, 76, 60, 0.85)';

    requestAnimationFrame(() => {
        fromTile.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        toTile.style.transform = `translate(${-deltaX}px, ${-deltaY}px)`;
    });

    setTimeout(() => {
        fromTile.style.transition = '';
        toTile.style.transition = '';
        fromTile.style.transform = '';
        toTile.style.transform = '';
        fromTile.style.zIndex = '';
        toTile.style.zIndex = '';
        fromTile.style.boxShadow = '';
        toTile.style.boxShadow = '';
        onComplete();
    }, 340);
}

// Fonction pour que l'ennemi fasse un mouvement sur le plateau
export function enemyMakeMove(){
    // Arrêter la suggestion si le joueur change de tour
    clearSuggestionTimer();
    clearSuggestion();
    log('🤖 L\'ennemi réfléchit...');
    
    // Trouver tous les mouvements possibles qui créent des matches
    const possibleMoves = findPossibleMatches();
    
    if(possibleMoves.length > 0){
        // Choisir un mouvement (privilégier les combos les plus longs)
        possibleMoves.sort((a, b) => b.matchLength - a.matchLength);
        const move = possibleMoves[0];
        
        log(`🎯 L'ennemi échange les tuiles...`);
        
        // Effectuer le mouvement
        setTimeout(() => {
            animateEnemySwap(move.from, move.to, () => {
                swapTiles(move.from, move.to);
            });
        }, 800);
    } else {
        // Aucun match possible, vérifier s'il y a des mouvements valides
        const randomMove = findRandomMove();
        if(randomMove){
            log('🎲 L\'ennemi fait un mouvement aléatoire...');
            setTimeout(() => {
                animateEnemySwap(randomMove.from, randomMove.to, () => {
                    swapTiles(randomMove.from, randomMove.to);
                });
            }, 800);
        } else {
            // Aucun mouvement possible du tout : régénérer
            regenerateBoard();
            setTimeout(() => {
                finishEnemyTurn();
            }, 1000);
        }
    }
}

// Trouve tous les mouvements possibles qui créent des matches
function findPossibleMatches(){
    const moves = [];
    
    for(let i = 0; i < boardSize * boardSize; i++){
        // Essayer d'échanger avec les tuiles adjacentes
        const adjacents = [
            i - 1, // gauche
            i + 1, // droite
            i - boardSize, // haut
            i + boardSize // bas
        ];
        
        for(const j of adjacents){
            // Vérifier que le mouvement est valide
            if(j < 0 || j >= boardSize * boardSize) continue;
            if(i % boardSize === 0 && j === i - 1) continue; // bord gauche
            if((i + 1) % boardSize === 0 && j === i + 1) continue; // bord droit
            
            // Simuler l'échange
            [board[i], board[j]] = [board[j], board[i]];
            
            // Vérifier s'il y a un match
            const matchInfo = checkMatchAtPosition(i) || checkMatchAtPosition(j);
            
            // Annuler l'échange
            [board[i], board[j]] = [board[j], board[i]];
            
            if(matchInfo){
                moves.push({
                    from: i,
                    to: j,
                    matchLength: matchInfo.length,
                    matchType: matchInfo.type
                });
            }
        }
    }
    
    return moves;
}

// Vérifie s'il y a un match à une position donnée
function checkMatchAtPosition(idx){
    const row = Math.floor(idx / boardSize);
    const col = idx % boardSize;
    const t = board[idx];
    
    if(!t) return null;
    
    let type = t;
    if(colors.includes(t) || t === 'joker') type = 'color';
    let matchColor = colors.includes(t) ? t : null;
    
    // Vérifier horizontalement
    let hCount = 1;
    // Compter à gauche
    for(let c = col - 1; c >= 0; c--){
        const testIdx = row * boardSize + c;
        const testT = board[testIdx];
        if(type === 'color'){
            if(testT === 'joker' || (matchColor && testT === matchColor) || (!matchColor && colors.includes(testT))){
                hCount++;
                if(!matchColor && colors.includes(testT)) matchColor = testT;
            }
            else break;
        } else {
            if(testT === t || testT === 'joker' || t === 'joker') hCount++;
            else break;
        }
    }
    // Compter à droite
    for(let c = col + 1; c < boardSize; c++){
        const testIdx = row * boardSize + c;
        const testT = board[testIdx];
        if(type === 'color'){
            if(testT === 'joker' || (matchColor && testT === matchColor) || (!matchColor && colors.includes(testT))){
                hCount++;
                if(!matchColor && colors.includes(testT)) matchColor = testT;
            }
            else break;
        } else {
            if(testT === t || testT === 'joker' || t === 'joker') hCount++;
            else break;
        }
    }
    
    if(hCount >= 3) return { length: hCount, type: type };
    
    // Réinitialiser la couleur pour la vérification verticale
    matchColor = colors.includes(t) ? t : null;
    
    // Vérifier verticalement
    let vCount = 1;
    // Compter en haut
    for(let r = row - 1; r >= 0; r--){
        const testIdx = r * boardSize + col;
        const testT = board[testIdx];
        if(type === 'color'){
            if(testT === 'joker' || (matchColor && testT === matchColor) || (!matchColor && colors.includes(testT))){
                vCount++;
                if(!matchColor && colors.includes(testT)) matchColor = testT;
            }
            else break;
        } else {
            if(testT === t || testT === 'joker' || t === 'joker') vCount++;
            else break;
        }
    }
    // Compter en bas
    for(let r = row + 1; r < boardSize; r++){
        const testIdx = r * boardSize + col;
        const testT = board[testIdx];
        if(type === 'color'){
            if(testT === 'joker' || (matchColor && testT === matchColor) || (!matchColor && colors.includes(testT))){
                vCount++;
                if(!matchColor && colors.includes(testT)) matchColor = testT;
            }
            else break;
        } else {
            if(testT === t || testT === 'joker' || t === 'joker') vCount++;
            else break;
        }
    }
    
    if(vCount >= 3) return { length: vCount, type: type };
    
    return null;
}

// Trouve un mouvement aléatoire valide
function findRandomMove(){
    const validMoves = [];
    
    for(let i = 0; i < boardSize * boardSize; i++){
        const adjacents = [i - 1, i + 1, i - boardSize, i + boardSize];
        
        for(const j of adjacents){
            if(j < 0 || j >= boardSize * boardSize) continue;
            if(i % boardSize === 0 && j === i - 1) continue;
            if((i + 1) % boardSize === 0 && j === i + 1) continue;
            
            validMoves.push({ from: i, to: j });
        }
    }
    
    if(validMoves.length > 0){
        return validMoves[Math.floor(Math.random() * validMoves.length)];
    }
    
    return null;
}
