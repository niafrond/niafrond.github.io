// Moteur du puzzle de soin de Chang'e (pur, sans DOM : testable). Même principe que le plateau de base (aligner trois tuiles ou plus), mais
// la finalité est inversée : les alignements de la couleur demandée par un blessé le soignent. Il n'y a ni ennemi, ni chronomètre, ni dégât.
//
// 0 % de crânes et 0 % de flèches : les seules tuiles qui existent ici sont les cinq énergies de soin et le joker « pleine lune » (créé par un
// alignement de cinq). Le tirage initial et le remplissage ne piochent QUE dans ENERGIES ; `TILE_KINDS` est la liste complète, vérifiée par les tests.

export const SIZE = 8;
export const ENERGIES = ['jade', 'lotus', 'perle', 'eau', 'argent'];
export const JOKER = 'lune';
export const TILE_KINDS = [...ENERGIES, JOKER];
export const GAUGE_MAX = 10;        // tuiles d'autres couleurs à recueillir pour charger le souffle lunaire
export const BREATH_TILES = 5;      // tuiles que le souffle lunaire convertit en la couleur demandée

const pick = (list, rng) => list[Math.floor(rng() * list.length) % list.length];
const idx = (x, y) => y * SIZE + x;

/** Génère un plateau sans alignement de départ et avec au moins un coup possible. */
export function generateBoard(rng = Math.random) {
    for (let attempt = 0; attempt < 200; attempt++) {
        const b = new Array(SIZE * SIZE).fill(null);
        for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
            const banned = new Set();
            if (x >= 2 && b[idx(x - 1, y)] === b[idx(x - 2, y)]) banned.add(b[idx(x - 1, y)]);
            if (y >= 2 && b[idx(x, y - 1)] === b[idx(x, y - 2)]) banned.add(b[idx(x, y - 1)]);
            b[idx(x, y)] = pick(ENERGIES.filter(c => !banned.has(c)), rng);
        }
        if (hasMove(b)) return b;
    }
    throw new Error('plateau de soin : aucune génération valide');
}

/** Alignements de trois cases ou plus (horizontaux et verticaux). Le joker remplace n'importe quelle couleur. */
export function findRuns(board) {
    const runs = [];
    const scan = (get, len, perp, vertical) => {
        for (let p = 0; p < perp; p++) {
            let i = 0;
            while (i < len) {
                let j = i, color = null;
                while (j < len) {
                    const t = board[get(p, j)];
                    if (t === null || t === undefined) break;
                    if (t !== JOKER) { if (color === null) color = t; else if (t !== color) break; }
                    j++;
                }
                if (j - i >= 3 && color !== null) {
                    runs.push({ color, vertical, cells: Array.from({ length: j - i }, (_, k) => get(p, i + k)) });
                    i = j;
                } else i = Math.max(i + 1, j > i ? i + 1 : i + 1);
            }
        }
    };
    scan((p, j) => idx(j, p), SIZE, SIZE, false);
    scan((p, j) => idx(p, j), SIZE, SIZE, true);
    return runs;
}

const swapped = (board, a, b) => { const c = board.slice(); [c[a], c[b]] = [c[b], c[a]]; return c; };
const adjacent = (a, b) => (Math.abs(a - b) === 1 && Math.floor(a / SIZE) === Math.floor(b / SIZE)) || Math.abs(a - b) === SIZE;

/** Coups possibles : permutations de deux cases voisines qui créent un alignement. */
export function possibleMoves(board) {
    const out = [];
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        const a = idx(x, y);
        for (const b of [x + 1 < SIZE ? idx(x + 1, y) : -1, y + 1 < SIZE ? idx(x, y + 1) : -1]) {
            if (b >= 0 && findRuns(swapped(board, a, b)).length) out.push([a, b]);
        }
    }
    return out;
}
export const hasMove = board => possibleMoves(board).length > 0;

function fall(board, rng) {
    for (let x = 0; x < SIZE; x++) {
        const col = [];
        for (let y = SIZE - 1; y >= 0; y--) if (board[idx(x, y)] !== null) col.push(board[idx(x, y)]);
        for (let y = SIZE - 1, k = 0; y >= 0; y--, k++) board[idx(x, y)] = k < col.length ? col[k] : pick(ENERGIES, rng);   // le remplissage ne produit jamais que des énergies
    }
}

/**
 * Résout les alignements en cascade. Soin = tuiles de la couleur demandée retirées (+1 pour un alignement de quatre, +2 pour cinq et plus) ;
 * les tuiles des autres couleurs chargent la jauge du souffle lunaire. Un alignement de cinq laisse un joker. Renvoie les étapes pour l'animation.
 */
function resolve(state, rng, origin) {
    const steps = [];
    let cascade = 0;
    for (let guard = 0; guard < 60; guard++) {
        const runs = findRuns(state.board);
        if (!runs.length) break;
        cascade++;
        const cleared = new Set(), heal = new Set(), create = [];
        let bonus = 0;
        for (const r of runs) {
            r.cells.forEach(c => cleared.add(c));
            if (r.color === state.color) {
                r.cells.forEach(c => heal.add(c));
                bonus += r.cells.length >= 5 ? 2 : r.cells.length === 4 ? 1 : 0;
            }
            if (r.cells.length >= 5) create.push(r.cells.includes(origin) ? origin : r.cells[Math.floor(r.cells.length / 2)]);
        }
        let gain = heal.size ? heal.size + bonus : 0;
        const gauge = [...cleared].filter(c => !heal.has(c)).length;
        state.gauge = Math.min(GAUGE_MAX, state.gauge + gauge);
        const room = Math.max(0, state.need - state.hp);
        gain = Math.min(gain, room);
        state.hp += gain;
        const made = [...new Set(create)];
        cleared.forEach(c => { state.board[c] = null; });
        made.forEach(c => { state.board[c] = JOKER; });
        fall(state.board, rng);
        steps.push({ cleared: [...cleared], created: made, gain, board: state.board.slice() });
    }
    return steps;
}

/** Nouvel essai d'un niveau de soin. `hp` : soins déjà obtenus (conservés entre les tentatives). */
export function createLevel({ color, need, moves, hp = 0 }, rng = Math.random) {
    if (!ENERGIES.includes(color)) throw new Error(`énergie inconnue : ${color}`);
    return { color, need, moves, movesLeft: moves, hp: Math.max(0, Math.min(need, hp | 0)), gauge: 0, board: generateBoard(rng), over: false, won: false, rng };
}

const finish = state => {
    if (state.hp >= state.need) { state.over = true; state.won = true; }
    else if (state.movesLeft <= 0) { state.over = true; state.won = false; }
};

/** Échange deux cases voisines. Refusé (rien ne change, aucun coup dépensé) s'il ne forme aucun alignement. */
export function playMove(state, a, b) {
    if (state.over) return { ok: false, reason: 'over' };
    if (!adjacent(a, b) || a < 0 || b < 0 || a >= SIZE * SIZE || b >= SIZE * SIZE) return { ok: false, reason: 'far' };
    const test = swapped(state.board, a, b);
    if (!findRuns(test).length) return { ok: false, reason: 'nomatch' };
    const before = state.hp;
    state.board = test;
    state.movesLeft--;
    const steps = resolve(state, state.rng, b);
    let reshuffled = false;
    if (!state.over && state.hp < state.need && !hasMove(state.board)) { state.board = generateBoard(state.rng); reshuffled = true; }
    finish(state);
    return { ok: true, steps, gain: state.hp - before, reshuffled, over: state.over, won: state.won };
}

/** Souffle lunaire : convertit des tuiles d'autres couleurs en la couleur demandée (sans dépenser de coup) quand la jauge est pleine. */
export function useBreath(state) {
    if (state.over || state.gauge < GAUGE_MAX) return { ok: false };
    const cells = [];
    state.board.forEach((t, i) => { if (t !== state.color && t !== JOKER) cells.push(i); });
    const chosen = [];
    while (chosen.length < BREATH_TILES && cells.length) chosen.push(cells.splice(Math.floor(state.rng() * cells.length) % cells.length, 1)[0]);
    chosen.forEach(c => { state.board[c] = state.color; });
    state.gauge -= GAUGE_MAX;
    const before = state.hp;
    const steps = resolve(state, state.rng, -1);
    let reshuffled = false;
    if (!state.over && state.hp < state.need && !hasMove(state.board)) { state.board = generateBoard(state.rng); reshuffled = true; }
    finish(state);
    return { ok: true, converted: chosen, steps, gain: state.hp - before, reshuffled, over: state.over, won: state.won };
}
