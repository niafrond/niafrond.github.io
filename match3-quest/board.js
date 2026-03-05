import { player, saveUpdate, log } from "./game.js";
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
    do{
        board=[];
        const boardDiv=document.getElementById('board');
        boardDiv.innerHTML="";
        for(let i=0;i<boardSize*boardSize;i++){
            const color=colors[Math.floor(Math.random()*colors.length)];
            board.push(color);
            const tile=document.createElement('div');
            tile.className=`tile ${color}`;
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
        tiles[i].className=`tile ${board[i]}`;
    }
}

export function checkMatches(){
    let combos=false;
    for(let i=0;i<boardSize;i++){
        for(let j=0;j<boardSize;j++){
            const idx=i*boardSize+j;
            const color=board[idx];
            // horizontal
            if(j<=boardSize-3 && board[idx+1]===color && board[idx+2]===color){
                combos=true;
                player.mana[color]=Math.min(player.maxMana, player.mana[color]+5);
                highlightCombo([idx, idx+1, idx+2]);
            }
            // vertical
            if(i<=boardSize-3 && board[idx+boardSize]===color && board[idx+2*boardSize]===color){
                combos=true;
                player.mana[color]=Math.min(player.maxMana, player.mana[color]+5);
                highlightCombo([idx, idx+boardSize, idx+2*boardSize]);
            }
        }
    }
    renderBoard();
    if(combos){
        saveUpdate();
        setTimeout(checkMatches,350);
    }
}

export function highlightCombo(indices){
    const tiles=document.getElementById('board').children;
    indices.forEach(i=>tiles[i].classList.add('match'));
    log(`✨ Combo ${board[indices[0]]}! +5 mana`);
    setTimeout(()=>{
        indices.forEach(i=>tiles[i].classList.remove('match'));
        indices.forEach(i=>board[i]=colors[Math.floor(Math.random()*colors.length)]);
        renderBoard();
    },300);
}
