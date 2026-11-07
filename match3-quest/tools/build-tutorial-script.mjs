// Pré-génère le plateau et les tuiles qui tombent du tutoriel (plus aucun hasard en jeu) : `node tools/build-tutorial-script.mjs`
// écrit `tutorialScript.js`. Chaque étape d'échange du scénario (tutorial.js, STEPS) reçoit : le plateau au début de l'étape, l'échange
// attendu et la suite exacte des tuiles qui tombent, calculée pour qu'il n'y ait jamais de cascade et que le coup de l'étape suivante
// existe déjà sur le plateau. Couleurs en jetons génériques : A = couleur du joueur, B = celle de Fengmeng, C = la troisième, D et E = le reste.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collectMatches, checkMatchAtPosition, pickJokerSpawns } from '../matchMechanics.js';

const SIZE = 8;
const COLORS = ['red', 'blue', 'green', 'yellow', 'purple'];
const TOKEN = { red: 'A', blue: 'B', green: 'C', yellow: 'D', purple: 'E' };
const PLAN = [   // numéro d'étape du scénario (tutorial.js) et alignement attendu
    { id: 1, want: { type: 'color', len: 3, color: 'red' } },
    { id: 2, want: { type: 'color', len: 3, color: 'blue' } },
    { id: 3, want: { type: 'skull', len: 3 } },
    { id: 4, want: { type: 'skull', len: 3 } },
    { id: 5, want: { type: 'color', len: 4, color: 'red' } },
    { id: 8, want: { type: 'combat', len: 4 } },
    { id: 10, want: { type: 'color', len: 3, color: 'green' } },
    { id: 11, want: { type: 'skull', len: 5 } },
    { id: 12, want: { type: 'color', len: 3, color: 'red', joker: true } },
    { id: 13, want: { type: 'color', len: 3, color: 'blue' } },
    { id: 14, want: { type: 'skull', len: 3 } },
];

// Générateur pseudo-aléatoire à graine : le résultat est toujours le même.
function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Zone réservée (rangées 5 à 7, colonnes 0 à 4) : le coup des 5 crânes et celui du joker y sont inscrits dès le départ ; les étapes
// précédentes n'y touchent pas (aucun échange ni alignement dans la zone), donc rien ne bouge là-dedans avant l'étape 11.
const ZONE = new Set();
for (let r = 5; r < SIZE; r++) for (let c = 0; c < 5; c++) ZONE.add(r * SIZE + c);
const at = (r, c) => r * SIZE + c;
function reserve(board) {   // 5 crânes sur la rangée 6, joker en (6,2) ensuite aligné avec deux gâteaux rouges
    const b = [...board];
    ['skull', 'skull', 'yellow', 'skull', 'skull'].forEach((t, c) => { b[at(6, c)] = t; });
    b[at(7, 2)] = 'skull';           // voisine qui complète les 5 crânes
    b[at(5, 3)] = 'red';             // deviendra la case (6,3) à droite du joker
    b[at(5, 4)] = 'purple';          // deviendra la case vide (6,4)
    b[at(7, 4)] = 'red';             // voisine rouge qui complète l'alignement du joker
    return b;
}

const wantedTile = w => (w.type === 'color' ? w.color : w.type);
function randomTile(rand, favorite) {
    const r = rand();
    if (r < 0.40) return favorite;
    const u = rand();
    return u < 0.22 ? 'skull' : u < 0.30 ? 'combat' : COLORS[Math.floor(rand() * 5)];
}

// Échanges dont le résultat est exactement l'alignement voulu (un seul alignement, longueur et couleur exactes, joker compris si demandé).
function movesFor(board, want, avoidZone = false) {
    const jIdx = board.indexOf('joker');
    const out = [];
    for (let i = 0; i < SIZE * SIZE; i++) {
        for (const j of [i + 1, i + SIZE]) {
            if (j >= SIZE * SIZE || (j === i + 1 && j % SIZE === 0)) continue;
            const t = [...board];
            [t[i], t[j]] = [t[j], t[i]];
            if (!checkMatchAtPosition(t, i) && !checkMatchAtPosition(t, j)) continue;   // test rapide avant le calcul complet
            const found = collectMatches(t);
            if (found.length !== 1) continue;
            const m = found[0];
            if (m.info.type !== want.type || m.info.len !== want.len || (want.type === 'color' && m.info.color !== want.color)) continue;
            if (want.joker && !m.indices.includes(jIdx)) continue;
            if (avoidZone && (ZONE.has(i) || ZONE.has(j) || m.indices.some(x => ZONE.has(x)))) continue;
            out.push({ from: i, to: j, top: m.indices.reduce((a, x) => a + Math.floor(x / SIZE), 0) });
        }
    }
    return out.sort((a, b) => a.top - b.top);   // d'abord les alignements les plus hauts (plus de tuiles neuves libres)
}

// Résolution d'un échange : alignement retiré (sauf le joker créé par 5 tuiles), gravité colonne par colonne comme board.js,
// puis les tuiles neuves dans l'ordre exact où le jeu les demande (colonnes de gauche à droite, de bas en haut).
function resolve(board, move) {
    const t = [...board];
    [t[move.from], t[move.to]] = [t[move.to], t[move.from]];
    const matches = collectMatches(t);
    matches.forEach(m => { if (m.info.len >= 5) m.info.makeJoker = true; });   // comme board.js : 5 tuiles ou plus créent un joker
    const spawns = pickJokerSpawns(matches);
    const keep = new Set(spawns.map(s => s.index));
    const removed = new Set();
    matches.forEach(m => m.indices.forEach(i => { if (!keep.has(i)) removed.add(i); }));
    const out = [...t];
    spawns.forEach(sp => { t[sp.index] = 'joker'; out[sp.index] = 'joker'; });
    const slots = [];   // indices à combler, dans l'ordre d'appel
    for (let col = 0; col < SIZE; col++) {
        let w = SIZE - 1;
        for (let row = SIZE - 1; row >= 0; row--) {
            const idx = row * SIZE + col;
            if (removed.has(idx)) continue;
            out[w * SIZE + col] = t[idx];
            w--;
        }
        for (; w >= 0; w--) { out[w * SIZE + col] = null; slots.push(w * SIZE + col); }
    }
    return { out, slots };
}

// Lignes de coup possibles pour un alignement voulu : cases (de la ligne), case vide à échanger, case voisine qui apporte la tuile.
// Motif : T T _ [T [T]] le long d'une ligne (joker d'abord si demandé), la case vide étant échangée avec une voisine perpendiculaire T.
function patterns(want, jIdx) {
    const tile = wantedTile(want);
    const out = [];
    for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        for (let start = 0; start < SIZE * SIZE; start++) {
            const r0 = Math.floor(start / SIZE), c0 = start % SIZE;
            const cells = [];
            for (let k = 0; k < want.len; k++) cells.push([r0 + dr * k, c0 + dc * k]);
            if (cells.some(([r, c]) => r < 0 || c < 0 || r >= SIZE || c >= SIZE)) continue;
            for (const [pr, pc] of [[dc, dr], [-dc, -dr]]) {
                const gap = cells[2];
                const partner = [gap[0] + pr, gap[1] + pc];
                if (partner[0] < 0 || partner[1] < 0 || partner[0] >= SIZE || partner[1] >= SIZE) continue;
                const o = { tile, cells: cells.map(([r, c]) => r * SIZE + c), gap: gap[0] * SIZE + gap[1], partner: partner[0] * SIZE + partner[1], jokerCell: -1 };
                if (!want.joker) { out.push(o); continue; }
                for (const jc of [o.cells[0], o.cells[1], o.partner]) if (jc === jIdx) out.push({ ...o, jokerCell: jc });   // le joker tient la place d'un gâteau
            }
        }
    }
    return out;
}

// Complète les trous (tuiles neuves) en y inscrivant le coup de l'étape suivante quand ses cases le permettent, le reste au hasard.
function fillHoles(out, slots, next, rand, avoidZone) {
    const jIdx = out.indexOf('joker');
    const free = new Set(slots);
    const tryFill = need => {
        const settled = [...out];
        slots.forEach(idx => { settled[idx] = need?.get(idx) ?? randomTile(rand, next ? wantedTile(next) : 'red'); });
        return settled;
    };
    const good = settled => !collectMatches(settled).length && (!next || movesFor(settled, next, avoidZone).length);
    for (let trial = 0; trial < 30; trial++) {   // d'abord le hasard : le coup suivant existe parfois déjà
        const settled = tryFill();
        if (good(settled)) return slots.map(idx => settled[idx]);
    }
    const opts = next ? patterns(next, jIdx) : [];
    for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
    for (const o of opts) {
        const need = new Map();   // case libre → tuile imposée
        let ok = true;
        o.cells.forEach((idx, k) => {
            if (!ok || k === 2 || idx === o.jokerCell) return;   // case 2 : la case vide, tout sauf T (vérifié plus bas)
            if (free.has(idx)) need.set(idx, o.tile); else if (out[idx] !== o.tile) ok = false;
        });
        if (!ok) continue;
        if (o.partner !== o.jokerCell) { if (free.has(o.partner)) need.set(o.partner, o.tile); else if (out[o.partner] !== o.tile) continue; }
        if (!free.has(o.gap) && out[o.gap] === o.tile) continue;
        for (let trial = 0; trial < 20; trial++) {
            const settled = tryFill(need);
            if (free.has(o.gap) && settled[o.gap] === o.tile) settled[o.gap] = COLORS.find(c => c !== o.tile);
            if (good(settled)) return slots.map(idx => settled[idx]);
        }
    }
    return null;
}

// Recherche en profondeur : chaque étape essaie ses coups candidats, plusieurs remplissages, et revient en arrière si la suite est impossible.
function build(seed) {
    const rand = rng(seed);
    let start = null;
    for (let n = 0; n < 20000 && !start; n++) {
        const b = reserve(Array.from({ length: SIZE * SIZE }, () => randomTile(rand, 'red')));
        if (collectMatches(b).length === 0 && movesFor(b, PLAN[0].want, true).length && movesFor(b, { type: 'skull', len: 5 }).length) start = b;
    }
    if (!start) return null;
    let nodes = 0, maxDepth = -1;
    const t0 = Date.now();
    const walk = (board, k) => {
        if (k === PLAN.length) return [];
        if (++nodes > 1500) return null;
        if (k > maxDepth) { maxDepth = k; if (process.env.DEBUG) console.error('seed', seed, 'profondeur', k, 'noeuds', nodes, Date.now() - t0, 'ms'); }
        const { id, want } = PLAN[k];
        const next = PLAN[k + 1]?.want;
        for (const move of movesFor(board, want, k < 7)) {
            const { out, slots } = resolve(board, move);
            for (let attempt = 0; attempt < 6; attempt++) {
                const drops = fillHoles(out, slots, next, rand, k + 1 < 7);
                if (process.env.DEBUG && k === 7) console.error('  S11 coup', move.from, move.to, 'trous', slots.length, 'joker', out.indexOf('joker'), drops ? 'OK' : 'ECHEC');
                if (!drops) break;
                const settled = [...out];
                slots.forEach((idx, i) => { settled[idx] = drops[i]; });
                const rest = walk(settled, k + 1);
                if (rest) return [{ step: id, board, swap: [move.from, move.to], drops }, ...rest];
                if (nodes > 1500) return null;
            }
        }
        return null;
    };
    return walk(start, 0);
}

let script = null, usedSeed = 0;
for (let seed = Number(process.env.SEED || 1); seed < (process.env.SEED ? Number(process.env.SEED) + 1 : 200) && !script; seed++) { script = build(seed); usedSeed = seed; }
if (!script) { console.error('aucun scénario trouvé'); process.exit(1); }
const tok = t => TOKEN[t] || t;
const fmt = arr => '[' + arr.map(t => `'${tok(t)}'`).join(', ') + ']';
const lines = script.map(s => `    { step: ${s.step}, swap: [${s.swap.join(', ')}],\n      board: ${fmt(s.board)},\n      drops: ${fmt(s.drops)} },`);
const file = `// GÉNÉRÉ par tools/build-tutorial-script.mjs (graine ${usedSeed}) : ne pas modifier à la main.
// Plateau et tuiles qui tombent du tutoriel, pré-générés : aucun hasard en jeu. Jetons : A = couleur du joueur, B = celle de Fengmeng,
// C = la troisième couleur, D et E = les deux dernières ; 'skull', 'combat' (flèche) et 'joker' tels quels.
// Une entrée par étape d'échange du scénario : plateau au début de l'étape, échange attendu, tuiles neuves dans l'ordre où le jeu les demande.
export const TUTORIAL_SCRIPT = [
${lines.join('\n')}
];
`;
writeFileSync(fileURLToPath(new URL('../tutorialScript.js', import.meta.url)), file);
console.log('graine', usedSeed, '— étapes', script.map(s => s.step).join(','));
