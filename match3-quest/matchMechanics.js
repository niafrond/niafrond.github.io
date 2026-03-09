import { colors, boardSize } from "./constants.js";
import {
    isJokerTile,
    analyzeMatchWindowWithJoker,
    tileMatchesTargetWithJoker
} from "./joker.js";

// Utilitaire de generation: detecte si la grille contient deja un match.
export function hasMatches(board){
    for(let i = 0; i < boardSize; i++){
        for(let j = 0; j < boardSize; j++){
            const idx = i * boardSize + j;
            const color = board[idx];
            if(j <= boardSize - 3 && board[idx + 1] === color && board[idx + 2] === color) return true;
            if(i <= boardSize - 3 && board[idx + boardSize] === color && board[idx + 2 * boardSize] === color) return true;
        }
    }
    return false;
}

// Verifie uniquement si des matches existent (sans les traiter).
export function checkForMatchesOnly(board){
    function hasMatchInWindow(indices){
        const target = analyzeMatchWindowWithJoker(indices.map(index => board[index]), colors);
        return Boolean(target);
    }

    // scan horizontal
    for(let i = 0; i < boardSize; i++){
        for(let j = 0; j < boardSize - 2; j++){
            const idx = i * boardSize + j;
            if(hasMatchInWindow([idx, idx + 1, idx + 2])) return true;
        }
    }

    // scan vertical
    for(let j = 0; j < boardSize; j++){
        for(let i = 0; i < boardSize - 2; i++){
            const idx = i * boardSize + j;
            if(hasMatchInWindow([idx, (i + 1) * boardSize + j, (i + 2) * boardSize + j])) return true;
        }
    }

    return false;
}

// Verifie s'il y a un match a une position donnee.
export function checkMatchAtPosition(board, idx){
    const row = Math.floor(idx / boardSize);
    const col = idx % boardSize;
    if(!board[idx]) return null;

    function analyzeWindow(indices){
        return analyzeMatchWindowWithJoker(indices.map(i => board[i]), colors);
    }

    function getRunLengthHorizontal(targetType, targetColor){
        let count = 1;

        for(let c = col - 1; c >= 0; c--){
            const t = board[row * boardSize + c];
            const ok = targetType === 'color'
                ? (isJokerTile(t) || t === targetColor)
                : (isJokerTile(t) || t === targetType);
            if(!ok) break;
            count++;
        }

        for(let c = col + 1; c < boardSize; c++){
            const t = board[row * boardSize + c];
            const ok = targetType === 'color'
                ? (isJokerTile(t) || t === targetColor)
                : (isJokerTile(t) || t === targetType);
            if(!ok) break;
            count++;
        }

        return count;
    }

    function getRunLengthVertical(targetType, targetColor){
        let count = 1;

        for(let r = row - 1; r >= 0; r--){
            const t = board[r * boardSize + col];
            const ok = targetType === 'color'
                ? (isJokerTile(t) || t === targetColor)
                : (isJokerTile(t) || t === targetType);
            if(!ok) break;
            count++;
        }

        for(let r = row + 1; r < boardSize; r++){
            const t = board[r * boardSize + col];
            const ok = targetType === 'color'
                ? (isJokerTile(t) || t === targetColor)
                : (isJokerTile(t) || t === targetType);
            if(!ok) break;
            count++;
        }

        return count;
    }

    let bestMatch = null;

    // Fenetres horizontales de 3 contenant idx
    const hStart = Math.max(0, col - 2);
    const hEnd = Math.min(col, boardSize - 3);
    for(let start = hStart; start <= hEnd; start++){
        const window = [
            row * boardSize + start,
            row * boardSize + start + 1,
            row * boardSize + start + 2
        ];
        const result = analyzeWindow(window);
        if(!result) continue;

        const length = getRunLengthHorizontal(result.type, result.color);
        if(length >= 3 && (!bestMatch || length > bestMatch.length)){
            bestMatch = { length, type: result.type };
        }
    }

    // Fenetres verticales de 3 contenant idx
    const vStart = Math.max(0, row - 2);
    const vEnd = Math.min(row, boardSize - 3);
    for(let start = vStart; start <= vEnd; start++){
        const window = [
            start * boardSize + col,
            (start + 1) * boardSize + col,
            (start + 2) * boardSize + col
        ];
        const result = analyzeWindow(window);
        if(!result) continue;

        const length = getRunLengthVertical(result.type, result.color);
        if(length >= 3 && (!bestMatch || length > bestMatch.length)){
            bestMatch = { length, type: result.type };
        }
    }

    if(bestMatch) return bestMatch;
    return null;
}

// Trouve tous les mouvements possibles qui creent des matches.
export function findPossibleMatches(board){
    const moves = [];

    for(let i = 0; i < boardSize * boardSize; i++){
        const adjacents = [
            i - 1,
            i + 1,
            i - boardSize,
            i + boardSize
        ];

        for(const j of adjacents){
            if(j < 0 || j >= boardSize * boardSize) continue;
            if(i % boardSize === 0 && j === i - 1) continue;
            if((i + 1) % boardSize === 0 && j === i + 1) continue;

            [board[i], board[j]] = [board[j], board[i]];
            const matchInfo = checkMatchAtPosition(board, i) || checkMatchAtPosition(board, j);
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

// Trouve un mouvement aleatoire valide.
export function findRandomMove(board){
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

// Collecte toutes les sequences de match (horizontales + verticales).
export function collectMatches(board){
    const matches = [];
    const seen = new Set();

    function analyzeWindow(indices){
        return analyzeMatchWindowWithJoker(indices.map(index => board[index]), colors);
    }

    function matchesTarget(tile, target){
        return tileMatchesTargetWithJoker(tile, target);
    }

    function pushMatch(indices, target){
        if(indices.length < 3) return;
        const key = `${indices.join(',')}|${target.type}|${target.color || ''}`;
        if(seen.has(key)) return;
        seen.add(key);
        matches.push({
            indices,
            info: {
                type: target.type,
                len: indices.length,
                color: target.color || null
            }
        });
    }

    // scan horizontal via windows of 3 then expand to full contiguous run
    for(let row = 0; row < boardSize; row++){
        for(let start = 0; start <= boardSize - 3; start++){
            const window = [
                row * boardSize + start,
                row * boardSize + start + 1,
                row * boardSize + start + 2
            ];
            const target = analyzeWindow(window);
            if(!target) continue;

            let left = start;
            while(left > 0){
                const idx = row * boardSize + (left - 1);
                if(!matchesTarget(board[idx], target)) break;
                left--;
            }

            let right = start + 2;
            while(right < boardSize - 1){
                const idx = row * boardSize + (right + 1);
                if(!matchesTarget(board[idx], target)) break;
                right++;
            }

            const run = [];
            for(let col = left; col <= right; col++){
                run.push(row * boardSize + col);
            }
            pushMatch(run, target);
        }
    }

    // scan vertical via windows of 3 then expand to full contiguous run
    for(let col = 0; col < boardSize; col++){
        for(let start = 0; start <= boardSize - 3; start++){
            const window = [
                start * boardSize + col,
                (start + 1) * boardSize + col,
                (start + 2) * boardSize + col
            ];
            const target = analyzeWindow(window);
            if(!target) continue;

            let top = start;
            while(top > 0){
                const idx = (top - 1) * boardSize + col;
                if(!matchesTarget(board[idx], target)) break;
                top--;
            }

            let bottom = start + 2;
            while(bottom < boardSize - 1){
                const idx = (bottom + 1) * boardSize + col;
                if(!matchesTarget(board[idx], target)) break;
                bottom++;
            }

            const run = [];
            for(let row = top; row <= bottom; row++){
                run.push(row * boardSize + col);
            }
            pushMatch(run, target);
        }
    }

    return matches;
}
