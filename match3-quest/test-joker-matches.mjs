import { boardSize } from './constants.js';
import { collectMatches, checkForMatchesOnly, checkMatchAtPosition } from './matchMechanics.js';

const PALETTE = ['red', 'blue', 'green', 'yellow', 'purple'];

function createBoard(){
    const board = new Array(boardSize * boardSize);
    for(let row = 0; row < boardSize; row++){
        for(let col = 0; col < boardSize; col++){
            board[row * boardSize + col] = PALETTE[(row * 2 + col) % PALETTE.length];
        }
    }
    return board;
}

function setHorizontal(board, row, startCol, tiles){
    for(let i = 0; i < tiles.length; i++){
        board[row * boardSize + startCol + i] = tiles[i];
    }
}

function setVertical(board, col, startRow, tiles){
    for(let i = 0; i < tiles.length; i++){
        board[(startRow + i) * boardSize + col] = tiles[i];
    }
}

function hasExactRun(matches, indices, type, color = null){
    return matches.some(match => {
        if(match.info.type !== type) return false;
        if((match.info.color || null) !== color) return false;
        if(match.indices.length !== indices.length) return false;
        return indices.every((idx, i) => match.indices[i] === idx);
    });
}

function assert(condition, message){
    if(!condition){
        throw new Error(message);
    }
}

function runTests(){
    const tests = [];

    tests.push(() => {
        const board = createBoard();
        setHorizontal(board, 0, 0, ['joker', 'blue', 'blue']);
        const matches = collectMatches(board);
        assert(hasExactRun(matches, [0, 1, 2], 'color', 'blue'), 'Case joker,blue,blue non detecte');
        assert(checkForMatchesOnly(board) === true, 'checkForMatchesOnly devrait etre true pour joker,blue,blue');
        const atJoker = checkMatchAtPosition(board, 0);
        assert(atJoker && atJoker.type === 'color' && atJoker.length >= 3, 'checkMatchAtPosition sur joker devrait trouver un match couleur');
    });

    tests.push(() => {
        const board = createBoard();
        setHorizontal(board, 1, 1, ['blue', 'joker', 'blue']);
        const matches = collectMatches(board);
        const base = 1 * boardSize + 1;
        assert(hasExactRun(matches, [base, base + 1, base + 2], 'color', 'blue'), 'Case blue,joker,blue non detecte');
    });

    tests.push(() => {
        const board = createBoard();
        setHorizontal(board, 2, 2, ['blue', 'blue', 'joker']);
        const matches = collectMatches(board);
        const base = 2 * boardSize + 2;
        assert(hasExactRun(matches, [base, base + 1, base + 2], 'color', 'blue'), 'Case blue,blue,joker non detecte');
    });

    tests.push(() => {
        const board = createBoard();
        setHorizontal(board, 3, 0, ['red', 'joker', 'blue', 'blue']);
        const matches = collectMatches(board);
        const base = 3 * boardSize;
        assert(hasExactRun(matches, [base + 1, base + 2, base + 3], 'color', 'blue'), 'Case chevauchante red,joker,blue,blue non detectee sur blue');
    });

    tests.push(() => {
        const board = createBoard();
        setVertical(board, 0, 0, ['joker', 'blue', 'blue']);
        const matches = collectMatches(board);
        assert(hasExactRun(matches, [0, boardSize, boardSize * 2], 'color', 'blue'), 'Case verticale joker,blue,blue non detectee');
    });

    tests.push(() => {
        const board = createBoard();
        setHorizontal(board, 4, 3, ['joker', 'blue', 'red']);
        const matches = collectMatches(board);
        const base = 4 * boardSize + 3;
        assert(!hasExactRun(matches, [base, base + 1, base + 2], 'color', 'blue'), 'Faux positif detecte pour joker,blue,red');
    });

    for(let i = 0; i < tests.length; i++){
        tests[i]();
    }

    console.log(`OK: ${tests.length} tests joker passes`);
}

runTests();
