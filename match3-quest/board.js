import { player, enemy, currentTurn, saveUpdate, log, skullDamage } from "./game.js";
import { colors, boardSize } from "./constants.js";

// grille et sélection
export let board = [];
export let selected = null;

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

export function generateBoard(){
    // la grille peut contenir aussi quelques tuiles spéciales
    const specialProb = 0.08; // ~8% de tuiles spéciales
    do{
        board=[];
        const boardDiv=document.getElementById('board');
        boardDiv.innerHTML="";
        for(let i=0;i<boardSize*boardSize;i++){
            let tileType;
            const r=Math.random();
            if(r < specialProb/2) tileType='skull';
            else if(r < specialProb) tileType='combat';
            else tileType=colors[Math.floor(Math.random()*colors.length)];
            board.push(tileType);
            const tile=document.createElement('div');
            tile.className=`tile ${tileType}`;
            tile.dataset.index=i;
            tile.onclick=()=>selectTile(i);
            boardDiv.appendChild(tile);
        }
    }while(hasMatches());
}

export function selectTile(index){
    if(selected===null){ selected=index; return; }
    // n'accepte que les tuiles adjacentes (haut/bas/gauche/droite)
    const adj=[selected-1,selected+1,selected-boardSize,selected+boardSize];
    if(!adj.includes(index)){
        log("⚠️ Échange non valide (doit être adjacent)");
        selected=null;
        return;
    }
    swapTiles(selected,index);
    selected=null;
}

export function swapTiles(i,j){
    [board[i],board[j]]=[board[j],board[i]];
    renderBoard();
    checkMatches();
}

export function renderBoard(){
    const tiles=document.getElementById('board').children;
    for(let i=0;i<board.length;i++){
        const t=board[i];
        tiles[i].className=`tile ${t}`;
        tiles[i].textContent = '';
        if(t==='skull') tiles[i].textContent='💀';
        else if(t==='combat') tiles[i].textContent='⚔️';
        else if(t==='joker') tiles[i].textContent='?';
    }
}

export function checkMatches(){
    let combos=false;
    const processed = new Set();
    
    function handleRun(indices, info){
        // info: {type,color?,len,makeJoker?}
        combos=true;
        // Determine which player gets the rewards
        const currentPlayer = currentTurn === 'player' ? player : enemy;
        // apply effects
        if(info.type==='color'){
            currentPlayer.mana[info.color]=Math.min(currentPlayer === player ? player.maxMana : 50, currentPlayer.mana[info.color]+5);
            if(info.len>=4){ 
                log('🎁 Match de 4 : tour bonus gagné');
            }
            if(info.len>=5){ info.makeJoker=true; }
        } else if(info.type==='combat'){
            currentPlayer.combatPoints += info.len;
            log(`⚔️ +${info.len} points de combat pour ${currentTurn === 'player' ? 'le joueur' : 'l\'ennemi'}`);
        } else if(info.type==='skull'){
            const dmg = info.len * skullDamage;
            player.hp -= dmg;
            log(`💀 Match ${info.len} crânes : -${dmg} HP`);
        }
        highlightCombo(indices, info);
    }

    // scan horizontal
    for(let i=0;i<boardSize;i++){
        let j=0;
        while(j<boardSize){
            const idx=i*boardSize+j;
            const t=board[idx];
            if(t==='joker'){ j++; continue; }
            let run=[idx];
            let type=t;
            if(colors.includes(t) || t==='joker') type='color';
            let color = colors.includes(t)?t:null;
            let k=j+1;
            while(k<boardSize){
                const idx2=i*boardSize+k;
                const t2=board[idx2];
                if(type==='color'){
                    if(t2===color || t2==='joker'){
                        run.push(idx2);
                        if(!color && colors.includes(t2)) color=t2;
                        k++;
                        continue;
                    }
                } else {
                    if(t2===type){ run.push(idx2); k++; continue; }
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
            if(t==='joker'){ i++; continue; }
            let run=[idx];
            let type=t;
            if(colors.includes(t) || t==='joker') type='color';
            let color = colors.includes(t)?t:null;
            let k=i+1;
            while(k<boardSize){
                const idx2=k*boardSize+j;
                const t2=board[idx2];
                if(type==='color'){
                    if(t2===color || t2==='joker'){
                        run.push(idx2);
                        if(!color && colors.includes(t2)) color=t2;
                        k++;
                        continue;
                    }
                } else {
                    if(t2===type){ run.push(idx2); k++; continue; }
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

    renderBoard();
    if(combos){
        saveUpdate();
        setTimeout(checkMatches,500);
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
            if(!removed.has(idx)){
                column.push(board[idx]);
            }
        }
        // Ajouter des nouvelles tuiles en haut
        while(column.length < boardSize){
            const r = Math.random();
            let newTile;
            if(r < 0.08/2) newTile = 'skull';
            else if(r < 0.08) newTile = 'combat';
            else newTile = colors[Math.floor(Math.random()*colors.length)];
            column.unshift(newTile);
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
        // Effet de disparition (vide)
        indices.forEach(i=>{
            tiles[i].classList.remove('match');
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
            const affectedCols = dropTiles(nullIndices);
            renderBoard();
            
            // Ajouter l'animation de descente seulement sur les colonnes affectées
            for(let col of affectedCols){
                for(let row=0; row<boardSize; row++){
                    const idx = row * boardSize + col;
                    tiles[idx].classList.add('fall');
                }
            }
            
            // Les jokers ne descendent pas, donc pas d'animation pour eux
            
            // Enlever la classe fall après l'animation
            setTimeout(()=>{
                for(let col of affectedCols){
                    for(let row=0; row<boardSize; row++){
                        const idx = row * boardSize + col;
                        tiles[idx].classList.remove('fall');
                    }
                }
            }, 350);
        }, 150);
    },300);
}
