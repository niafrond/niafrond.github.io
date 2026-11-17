// Suggestion de coup au joueur (minuteur d'inactivité, surbrillance) et gestion du plateau sans coup possible.
// Extrait de board.js.
import { currentTurn, log } from './game.js';
import { tutorialCallbacks } from './tutorial.js';
import { findPossibleMatches } from './matchMechanics.js';
import { enemyMakeMove } from './boardEnemyMoves.js';
import { board, clearSelectedTile, isBlocked, regenerateBoard, selected } from './board.js';

let suggestionTimer = null;
let suggestedMoveIndices = null;
// Fonctions pour gérer la suggestion de match
export function startSuggestionTimer(){
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

export function clearSuggestionTimer(){
    if(suggestionTimer !== null){
        clearTimeout(suggestionTimer);
        suggestionTimer = null;
    }
}

export function getSortedPossibleMoves(){
    const possibleMoves = findPossibleMatches(board).filter(m => !isBlocked(m.from) && !isBlocked(m.to));
    possibleMoves.sort((a, b) => b.matchLength - a.matchLength);
    return possibleMoves;
}

export function handleNoPossibleMoveForCurrentTurn(){
    const actor = currentTurn === 'player' ? 'joueur' : 'ennemi';
    log(`Aucun coup possible pour le ${actor}, plateau régénéré.`);

    clearSelectedTile();
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
        if(tutorialCallbacks.noSuggestions) return;   // tutoriel : surbrillances propres à chaque étape, pas de conseil standard (le plateau bloqué reste régénéré)
        const suggestedMove = possibleMoves[0];
        
        suggestedMoveIndices = [suggestedMove.from, suggestedMove.to];
        
        const boardDiv = document.getElementById('board');
        const tiles = boardDiv.children;
        
        // Ajouter la classe de clignotement doux
        suggestedMoveIndices.forEach(idx => {
            tiles[idx].classList.add('suggested');
        });
        
        log(`Conseil : essayez d'échanger ces deux tuiles !`);
        return;
    }

    handleNoPossibleMoveForCurrentTurn();
}

export function clearSuggestion(){
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
