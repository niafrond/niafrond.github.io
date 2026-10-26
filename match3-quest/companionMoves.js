// Choix « ultra smart » du coup supplémentaire de Xiao Gui (logique pure, sans DOM ; appliqué par board.js : foxMakeRandomMove).
//
// Pour chaque échange valide, on simule le coup sur une copie du plateau : alignements, tuiles retirées, gravité, puis cascades
// sur les tuiles déjà présentes (les tuiles qui retombent du haut sont inconnues : on ne les devine pas). Le coup au meilleur score gagne.
import { colors, boardSize } from "./constants.js";
import { collectMatches, getEffectiveMatchLength } from "./matchMechanics.js";
import { shouldCreateJokerFromMatchLength } from "./joker.js";

export const SMART_WEIGHTS = {
    skull: 2.2,        // les crânes frappent l'ennemi
    combat: 1.6,       // points d'action (épées)
    color: 1,          // qì
    neededColor: 0.8,  // bonus par tuile pour la couleur de qì la plus utile au héros
    cascade: 1.25,     // chaque niveau de cascade vaut plus que le précédent
    longMatch: 3,      // alignement de 4+ (XP de combo)
    joker: 6           // alignement de 5+ : crée un joker
};

// Couleur de qì dont le héros manque le plus (sa plus petite réserve) ; null si pas de réserve connue.
export function neededColorOf(mana){
    if(!mana) return null;
    let best = null;
    colors.forEach(c => { if(best === null || (mana[c] || 0) < (mana[best] || 0)) best = c; });
    return best;
}

// Retire les cases `removed` et fait retomber les tuiles restantes (cases vides = null en haut des colonnes).
function collapse(board, removed){
    removed.forEach(i => { board[i] = null; });
    for(let col = 0; col < boardSize; col++){
        let write = boardSize - 1;
        for(let row = boardSize - 1; row >= 0; row--){
            const tile = board[row * boardSize + col];
            if(tile === null || tile === undefined) continue;
            board[write * boardSize + col] = tile;
            if(write !== row) board[row * boardSize + col] = null;
            write--;
        }
        for(; write >= 0; write--) board[write * boardSize + col] = null;
    }
}

// Valeur d'un échange from↔to ; `opts.mana` = réserve de qì du héros. Le plateau fourni n'est pas modifié.
export function scoreMove(board, move, opts = {}){
    const W = { ...SMART_WEIGHTS, ...(opts.weights || {}) };
    const need = neededColorOf(opts.mana);
    const sim = board.slice();
    [sim[move.from], sim[move.to]] = [sim[move.to], sim[move.from]];
    let score = 0, level = 0;
    for(; level < 12; level++){
        const matches = collectMatches(sim)   // les trous (null) ne s'alignent pas;
        if(!matches.length) break;
        const removed = new Set();
        const mult = Math.pow(W.cascade, level);
        matches.forEach(({ indices, info }) => {
            const len = getEffectiveMatchLength(info);
            let weight = info.type === 'skull' ? W.skull : info.type === 'combat' ? W.combat : W.color;
            if(info.type === 'color' && info.color === need) weight += W.neededColor;
            score += len * weight * mult;
            if(info.len >= 4) score += W.longMatch;
            if(shouldCreateJokerFromMatchLength(info.len)) score += W.joker;
            indices.forEach(i => removed.add(i));
        });
        collapse(sim, removed);
    }
    return score;
}

// Meilleur coup parmi `moves` ({from,to,…}) ; null si la liste est vide. Égalités : tirage au sort via `rng`.
export function pickSmartMove(board, moves, opts = {}, rng = Math.random){
    if(!moves || !moves.length) return null;
    let best = [], bestScore = -Infinity;
    moves.forEach(m => {
        const s = scoreMove(board, m, opts);
        if(s > bestScore + 1e-9){ bestScore = s; best = [m]; }
        else if(Math.abs(s - bestScore) <= 1e-9) best.push(m);
    });
    return best[Math.floor(rng() * best.length)];
}
