// Coups joués sur le plateau par l'ennemi et par le compagnon (Xiao Gui) : choix, animation de l'échange.
// Extrait de board.js.
import { player, log, finishPlayerTurn } from './game.js';
import { tutorialCallbacks } from './tutorial.js';
import { pickSmartMove } from './companionMoves.js';
import { boardMoveOptions } from './enemyAI.js';
import { clearSuggestion, clearSuggestionTimer, getSortedPossibleMoves, handleNoPossibleMoveForCurrentTurn } from './boardSuggestions.js';
import { board, generateRandomTile, swapTiles } from './board.js';

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
    // En mode tutoriel, l'ennemi utilise toujours un mouvement aléatoire (IA stupide)
    if(tutorialCallbacks.useDumbAI) {
        enemyMakeRandomMove();
        return;
    }

    clearSuggestionTimer();
    clearSuggestion();
    log('L\'ennemi réfléchit...');
    
    const possibleMoves = getSortedPossibleMoves();
    
    if(possibleMoves.length > 0){
        // IA avancée : privilégie les combinaisons qui donnent le qì dont elle a besoin
        const aiOpts = boardMoveOptions();
        const move = (aiOpts && pickSmartMove(board, possibleMoves, { ...aiOpts, refill: () => generateRandomTile(), samples: aiOpts.samples || 8 })) || possibleMoves[0];
        log(`L'ennemi échange les tuiles...`);
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
    log('L\'ennemi hésite...');

    const possibleMoves = getSortedPossibleMoves();
    if(possibleMoves.length === 0){ handleNoPossibleMoveForCurrentTurn(); return; }

    // Prendre un mouvement aléatoire parmi tous les valides (pas forcément le meilleur)
    const move = tutorialCallbacks.pickEnemyMove?.(possibleMoves) || possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
    log(`L'ennemi fait un move aléatoire...`);
    setTimeout(() => {
        animateEnemySwap(move.from, move.to, () => {
            swapTiles(move.from, move.to);
        });
    }, 800);
}

// Xiao Gui joue le meilleur coup (simulation des cascades, voir companionMoves.js) pendant le tour du joueur (currentTurn reste 'player').
export function foxMakeRandomMove(){
    clearSuggestionTimer();
    clearSuggestion();

    const possibleMoves = getSortedPossibleMoves();
    if(possibleMoves.length === 0){ finishPlayerTurn(); return; }

    const move = pickSmartMove(board, possibleMoves, { mana: player.mana, refill: () => generateRandomTile() }) || possibleMoves[0];
    setTimeout(() => {
        animateFoxSwap(move.from, move.to, () => {
            swapTiles(move.from, move.to);
        });
    }, 600);
}

function animateFoxSwap(from, to, onComplete){
    const boardDiv = document.getElementById('board');
    if(!boardDiv){ onComplete(); return; }

    const tiles = boardDiv.children;
    const fromTile = tiles[from];
    const toTile = tiles[to];
    if(!fromTile || !toTile){ onComplete(); return; }

    const fromRect = fromTile.getBoundingClientRect();
    const toRect = toTile.getBoundingClientRect();
    const deltaX = toRect.left - fromRect.left;
    const deltaY = toRect.top - fromRect.top;

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
        ghost.style.transition = 'transform 0.28s ease, box-shadow 0.28s ease';
        ghost.style.boxShadow = '0 0 14px rgba(224, 122, 46, 0.9)';
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
    }, 300);
}
