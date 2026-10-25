// Moteur d'énigmes à plateau (logique pure, sans DOM). Une énigme = un mode (règles) + un niveau (données) ; le moteur gère l'état
// courant, le nombre de coups, l'annulation et la remise à zéro. Pour ajouter un type d'énigme : écrire un mode dans `modes.js`
// (ou l'enregistrer avec `registerMode`) puis déclarer des niveaux dans `levels.js`.
//
// Un mode est un objet :
//   init(level)          → état initial (les états sont immuables : toute action renvoie un nouvel état)
//   size(state)          → { w, h } en cases
//   dir(state, d)        → { state, move } | null     d ∈ 'up' | 'down' | 'left' | 'right' (clavier, glissement)
//   tap(state, x, y)     → { state, move } | null     appui sur une case
//   won(state)           → booléen
//   render(state)        → SVG (contenu) dessiné dans un repère d'une unité par case
// `move` vaut true quand l'action compte comme un coup (une simple sélection n'en est pas un).
const modes = new Map();

export function registerMode(name, mode) {
    ['init', 'size', 'won', 'render'].forEach(k => { if (typeof mode[k] !== 'function') throw new Error(`mode « ${name} » : ${k}() manquant`); });
    modes.set(name, mode);
}

export const getMode = name => modes.get(name) || null;

export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/** @returns {{ mode:object, state:object, moves:number, won:boolean, dir:Function, tap:Function, undo:Function, reset:Function, canUndo:Function }} */
export function createPuzzle(def) {
    const mode = getMode(def.mode);
    if (!mode) throw new Error(`mode d'énigme inconnu : ${def.mode}`);
    let state = mode.init(def.level);
    const history = [];
    const puzzle = {
        def, mode,
        get state() { return state; },
        get moves() { return history.length; },
        get won() { return mode.won(state); },
        canUndo: () => history.length > 0,
        apply(res) {
            if (!res || puzzle.won) return false;
            if (res.move) history.push(state);
            else if (res.state === state) return false;
            state = res.state;
            return true;
        },
        dir: d => puzzle.apply(mode.dir?.(state, d)),
        tap: (x, y) => puzzle.apply(mode.tap?.(state, x, y)),
        undo() { if (!history.length || puzzle.won) return false; state = history.pop(); return true; },
        reset() { state = mode.init(def.level); history.length = 0; }
    };
    return puzzle;
}

/** Recherche en largeur du plus court enchaînement de coups (outil de test : prouve qu'un niveau est faisable). `key(state)` identifie un état. */
export function solve(def, { maxStates = 300000 } = {}) {
    const mode = getMode(def.mode);
    const start = mode.init(def.level);
    if (mode.won(start)) return 0;
    const seen = new Set([mode.key(start)]);
    let frontier = [start];
    for (let depth = 1; frontier.length; depth++) {
        const next = [];
        for (const s of frontier) {
            for (const res of mode.successors(s)) {
                const k = mode.key(res);
                if (seen.has(k)) continue;
                if (mode.won(res)) return depth;
                seen.add(k);
                if (seen.size > maxStates) return null;
                next.push(res);
            }
        }
        frontier = next;
    }
    return null;
}
