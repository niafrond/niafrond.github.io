export const JOKER_TILE = 'joker';
export const JOKER_SYMBOL = '★';

export function isJokerTile(tile){
    return tile === JOKER_TILE;
}

export function isTransformableToJoker(tile){
    return Boolean(tile) && !isJokerTile(tile);
}

export function getNonJokerTiles(tiles){
    return tiles.filter(tile => !isJokerTile(tile));
}

export function analyzeMatchWindowWithJoker(tiles, availableColors){
    if(tiles.some(tile => !tile)) return null;

    const nonJokers = getNonJokerTiles(tiles);
    if(nonJokers.length === 0) return null;

    const hasColor = tiles.some(tile => availableColors.includes(tile));
    if(hasColor){
        if(nonJokers.some(tile => !availableColors.includes(tile))) return null;
        const matchColor = nonJokers[0];
        if(nonJokers.every(tile => tile === matchColor)){
            return { type: 'color', color: matchColor };
        }
        return null;
    }

    const specialType = nonJokers[0];
    if(nonJokers.every(tile => tile === specialType)){
        return { type: specialType };
    }
    return null;
}

export function tileMatchesTargetWithJoker(tile, target){
    if(isJokerTile(tile)) return true;
    if(target.type === 'color'){
        return tile === target.color;
    }
    return tile === target.type;
}

export function shouldCreateJokerFromMatchLength(length){
    return length >= 5;
}

export function pickRandomNonJokerIndex(board, randomFn = Math.random){
    const candidates = board
        .map((tile, index) => ({ tile, index }))
        .filter(entry => isTransformableToJoker(entry.tile));

    if(candidates.length === 0) return null;
    const picked = candidates[Math.floor(randomFn() * candidates.length)];
    return picked.index;
}

export function rollTileWithJoker(probabilities, availableColors, options = {}, randomFn = Math.random){
    const { skullProb, combatProb, jokerProb } = probabilities;
    const allowJoker = options.allowJoker !== false;
    const r = randomFn();

    if(r < skullProb) return 'skull';
    if(r < skullProb + combatProb) return 'combat';
    if(allowJoker && r < skullProb + combatProb + jokerProb) return JOKER_TILE;
    return availableColors[Math.floor(randomFn() * availableColors.length)];
}
