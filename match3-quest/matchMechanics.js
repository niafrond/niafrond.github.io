import { colors, boardSize } from "./constants.js";

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
    // scan horizontal
    for(let i = 0; i < boardSize; i++){
        for(let j = 0; j < boardSize - 2; j++){
            const idx = i * boardSize + j;
            const t = board[idx];
            const t1 = board[idx + 1];
            const t2 = board[idx + 2];

            // Ignorer si toutes sont des jokers
            if(t === 'joker' && t1 === 'joker' && t2 === 'joker') continue;

            // Match avec jokers pour couleurs
            if(colors.includes(t) || colors.includes(t1) || colors.includes(t2)){
                const nonJokers = [t, t1, t2].filter(tile => tile !== 'joker' && colors.includes(tile));
                if(nonJokers.length === 0) continue;
                const matchColor = nonJokers[0];
                if(nonJokers.every(tile => tile === matchColor)) return true;
            }
            // Match avec jokers pour types speciaux (skull, combat)
            else if((t === t1 || t === 'joker' || t1 === 'joker') &&
                    (t1 === t2 || t1 === 'joker' || t2 === 'joker') &&
                    (t === t2 || t === 'joker' || t2 === 'joker')){
                const nonJokers = [t, t1, t2].filter(tile => tile !== 'joker');
                if(nonJokers.length > 0 && nonJokers.every(tile => tile === nonJokers[0])) return true;
            }
        }
    }

    // scan vertical
    for(let j = 0; j < boardSize; j++){
        for(let i = 0; i < boardSize - 2; i++){
            const idx = i * boardSize + j;
            const t = board[idx];
            const t1 = board[(i + 1) * boardSize + j];
            const t2 = board[(i + 2) * boardSize + j];

            // Ignorer si toutes sont des jokers
            if(t === 'joker' && t1 === 'joker' && t2 === 'joker') continue;

            // Match avec jokers pour couleurs
            if(colors.includes(t) || colors.includes(t1) || colors.includes(t2)){
                const nonJokers = [t, t1, t2].filter(tile => tile !== 'joker' && colors.includes(tile));
                if(nonJokers.length === 0) continue;
                const matchColor = nonJokers[0];
                if(nonJokers.every(tile => tile === matchColor)) return true;
            }
            // Match avec jokers pour types speciaux (skull, combat)
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

// Verifie s'il y a un match a une position donnee.
export function checkMatchAtPosition(board, idx){
    const row = Math.floor(idx / boardSize);
    const col = idx % boardSize;
    if(!board[idx]) return null;

    function analyzeWindow(indices){
        const tiles = indices.map(i => board[i]);
        if(tiles.some(t => !t)) return null;

        const nonJokers = tiles.filter(t => t !== 'joker');
        if(nonJokers.length === 0) return null;

        const hasColor = tiles.some(t => colors.includes(t));
        if(hasColor){
            if(nonJokers.some(t => !colors.includes(t))) return null;
            const nonJokerColors = nonJokers.filter(t => colors.includes(t));
            if(nonJokerColors.length === 0) return null;
            const color = nonJokerColors[0];
            if(nonJokerColors.every(t => t === color)){
                return { type: 'color', color };
            }
            return null;
        }

        const specialType = nonJokers[0];
        if(nonJokers.every(t => t === specialType)){
            return { type: specialType };
        }
        return null;
    }

    function getRunLengthHorizontal(targetType, targetColor){
        let count = 1;

        for(let c = col - 1; c >= 0; c--){
            const t = board[row * boardSize + c];
            const ok = targetType === 'color'
                ? (t === 'joker' || t === targetColor)
                : (t === 'joker' || t === targetType);
            if(!ok) break;
            count++;
        }

        for(let c = col + 1; c < boardSize; c++){
            const t = board[row * boardSize + c];
            const ok = targetType === 'color'
                ? (t === 'joker' || t === targetColor)
                : (t === 'joker' || t === targetType);
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
                ? (t === 'joker' || t === targetColor)
                : (t === 'joker' || t === targetType);
            if(!ok) break;
            count++;
        }

        for(let r = row + 1; r < boardSize; r++){
            const t = board[r * boardSize + col];
            const ok = targetType === 'color'
                ? (t === 'joker' || t === targetColor)
                : (t === 'joker' || t === targetType);
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

    // scan horizontal
    for(let i = 0; i < boardSize; i++){
        let j = 0;
        while(j < boardSize){
            const idx = i * boardSize + j;
            const t = board[idx];
            let run = [idx];
            let type = t;
            if(colors.includes(t) || t === 'joker') type = 'color';
            let color = colors.includes(t) ? t : null;
            let k = j + 1;
            while(k < boardSize){
                const idx2 = i * boardSize + k;
                const t2 = board[idx2];
                if(type === 'color'){
                    if(t2 === 'joker' || (color && t2 === color) || (!color && colors.includes(t2))){
                        run.push(idx2);
                        if(!color && colors.includes(t2)) color = t2;
                        k++;
                        continue;
                    }
                } else {
                    if(t2 === type || t2 === 'joker' || t === 'joker'){
                        run.push(idx2);
                        if(t === 'joker' && t2 !== 'joker') type = t2;
                        k++;
                        continue;
                    }
                }
                break;
            }
            if(run.length >= 3){
                matches.push({
                    indices: run,
                    info: { type, len: run.length, color }
                });
            }
            j += Math.max(run.length, 1);
        }
    }

    // scan vertical
    for(let j = 0; j < boardSize; j++){
        let i = 0;
        while(i < boardSize){
            const idx = i * boardSize + j;
            const t = board[idx];
            let run = [idx];
            let type = t;
            if(colors.includes(t) || t === 'joker') type = 'color';
            let color = colors.includes(t) ? t : null;
            let k = i + 1;
            while(k < boardSize){
                const idx2 = k * boardSize + j;
                const t2 = board[idx2];
                if(type === 'color'){
                    if(t2 === 'joker' || (color && t2 === color) || (!color && colors.includes(t2))){
                        run.push(idx2);
                        if(!color && colors.includes(t2)) color = t2;
                        k++;
                        continue;
                    }
                } else {
                    if(t2 === type || t2 === 'joker' || t === 'joker'){
                        run.push(idx2);
                        if(t === 'joker' && t2 !== 'joker') type = t2;
                        k++;
                        continue;
                    }
                }
                break;
            }
            if(run.length >= 3){
                matches.push({
                    indices: run,
                    info: { type, len: run.length, color }
                });
            }
            i += Math.max(run.length, 1);
        }
    }

    return matches;
}
