// Préparation du terrain et règles de biome. Module pur (aucun DOM) : exploration.js, game.js et board.js l'appliquent.
//
// 1. PRÉPARATION DU TERRAIN : ce que le héros fait sur la carte change le combat qui suit.
//    - de face : combat normal ; de dos : embuscade (+1 PA, on joue en premier) ;
//    - observer un ennemi quelques secondes immobile : on découvre sa faiblesse (dégâts bonus de cette couleur) ;
//    - ennemi dans un piège (`trap`) ou des hautes herbes (`tallGrass`) au contact : il commence altéré ;
//    - combat déclenché depuis un belvédère (`outlook`) : le plateau démarre avec des tuiles de sa couleur faible.
// 2. BIOMES : chaque biome du monde impose une règle au plateau de match-3 (bambous, volcan, marais, sanctuaire,
//    mer, neige). Les cases spéciales sont un état par indice de case, avancé à chaque tour du joueur.

export const FACE_FRONT = 'front';
export const FACE_BEHIND = 'behind';
export const FACE_SIDE = 'side';

export const OBSERVE_MS = 3000;          // temps d'immobilité pour percer un ennemi
export const OBSERVE_EXTRA_RANGE = 4;    // portée d'observation au-delà de la zone de vigilance
export const AMBUSH_BONUS_PA = 1;
export const WEAKNESS_DAMAGE_BONUS = 0.25;
export const OUTLOOK_TILES = 5;

export const SPOT_KINDS = ['tallGrass', 'trap', 'outlook'];

const COLOR_NAMES = { red: 'rouge', blue: 'bleu', green: 'vert', yellow: 'jaune', purple: 'violet' };
export const colorName = color => COLOR_NAMES[color] || color;

const sign = n => (n > 0) - (n < 0);

// Où le héros se trouve par rapport au regard de l'ennemi : devant, derrière ou sur le côté.
export function approachOf(face, enemyPos, playerPos) {
    const f = face && (face.dx || face.dy) ? face : { dx: 0, dy: 1 };
    const dot = sign(f.dx) * sign(playerPos.x - enemyPos.x) + sign(f.dy) * sign(playerPos.y - enemyPos.y);
    if (dot > 0) return FACE_FRONT;
    if (dot < 0) return FACE_BEHIND;
    return FACE_SIDE;
}

// Direction d'un pas d'ennemi (pour mémoriser son regard).
export const faceFromStep = (from, to) => ({ dx: sign(to.x - from.x), dy: sign(to.y - from.y) });

export const spotAt = (spots, x, y, kind) => (spots || []).find(s => s.x === x && s.y === y && (!kind || s.kind === kind)) || null;

// Faiblesse d'un profil de résistances : la couleur la moins résistée (ordre fixe en cas d'égalité).
export function weakestColor(resistances) {
    let best = null;
    for (const c of Object.keys(COLOR_NAMES)) {
        const v = Number(resistances?.[c]);
        if (Number.isFinite(v) && (best === null || v < best.v)) best = { c, v };
    }
    return best ? best.c : null;
}

// Suivi de l'observation : le héros reste immobile `stillMs`, un ennemi vivant dans la portée est « lu ».
// Retourne l'id de l'ennemi observé (le plus proche non encore observé) ou null.
export function observationTarget(stillMs, playerPos, enemies, observed = {}, extraRange = OBSERVE_EXTRA_RANGE) {
    if (stillMs < OBSERVE_MS) return null;
    let best = null;
    for (const e of enemies) {
        if (observed[e.id] || e.shielded || e.illusion) continue;
        const d = Math.max(Math.abs(e.x - playerPos.x), Math.abs(e.y - playerPos.y));
        if (d <= (e.aggro || 1) + extraRange && (!best || d < best.d)) best = { id: e.id, d };
    }
    return best ? best.id : null;
}

// Préparation d'un combat. ctx : { approach, enemyOnTrap, enemyOnGrass, observed, onOutlook }.
export function buildPrep(ctx = {}) {
    const prep = {
        tags: [], lines: [],
        playerBonusPA: 0, enemyBonusPA: 0,
        playerFirst: false, enemyFirst: false,
        enemyStatus: null,        // { poisoned|confused: tours }
        weaknessRevealed: false,
        boardBoost: null          // { count } : tuiles à convertir à la couleur faible de l'ennemi
    };
    const add = (tag, line) => { prep.tags.push(tag); prep.lines.push(line); };

    if (ctx.approach === FACE_BEHIND) {
        prep.playerBonusPA += AMBUSH_BONUS_PA;
        prep.playerFirst = true;
        add('ambush', 'Attaque surprise : +1 PA et vous jouez en premier.');
    }
    if (ctx.observed) {
        prep.weaknessRevealed = true;
        add('observed', 'Faiblesse repérée : ses dégâts de cette couleur sont accrus.');
    }
    if (ctx.enemyOnTrap) {
        prep.enemyStatus = { poisoned: 3 };
        add('trap', "L'ennemi a marché dans un piège : il commence empoisonné.");
    } else if (ctx.enemyOnGrass) {
        prep.enemyStatus = { confused: 2 };
        add('grass', "L'ennemi se débat dans les hautes herbes : il commence désorienté.");
    }
    if (ctx.onOutlook) {
        prep.boardBoost = { count: OUTLOOK_TILES };
        add('outlook', `Position dominante : le plateau démarre avec ${OUTLOOK_TILES} tuiles de la couleur faible de l'ennemi.`);
    }
    return prep;
}

// Bandeau d'annonce affiché au début du combat quand le terrain donne un avantage (ou un handicap) :
// titre selon l'avantage principal, une ligne par conséquence (déjà rédigée dans `prep.lines`). null si aucune préparation.
const BANNERS = {
    ambush: { icon: 'bolt', title: 'Attaque surprise !' },
    trap: { icon: 'poison', title: 'Piège !' },
    grass: { icon: 'leaf', title: 'Hautes herbes !' },
    outlook: { icon: 'flag', title: 'Position dominante !' },
    observed: { icon: 'eye', title: 'Faiblesse repérée !' }
};
export function prepBanner(prep, enemyName = "L'ennemi") {
    if (!prep || !prep.lines?.length) return null;
    const lines = [...prep.lines];
    let head = BANNERS[prep.tags[0]] || { icon: 'bolt', title: 'Avantage du terrain !' };
    if (prep.enemyFirst) {
        head = { icon: 'bolt', title: `${enemyName} vous attend !` };
        lines.push(`${enemyName} joue en premier.`);
    }
    return { icon: head.icon, title: head.title, lines };
}

// Dégâts d'un sort sur un ennemi dont la faiblesse a été percée.
export const weaknessDamage = (damage, spellColor, weakColor, revealed) =>
    revealed && weakColor && spellColor === weakColor ? Math.ceil(damage * (1 + WEAKNESS_DAMAGE_BONUS)) : damage;

// Convertit `count` cases au hasard (hors cases ciblées déjà `color`) vers `color`. Retourne les indices changés.
export function applyBoardBoost(tiles, color, count, rng = Math.random) {
    const candidates = [];
    tiles.forEach((t, i) => { if (t !== color && colors.includes(t)) candidates.push(i); });
    const changed = [];
    while (changed.length < count && candidates.length) {
        const k = Math.floor(rng() * candidates.length);
        const [idx] = candidates.splice(k, 1);
        tiles[idx] = color;
        changed.push(idx);
    }
    return changed;
}
const colors = Object.keys(COLOR_NAMES);

// ── Biomes ─────────────────────────────────────────────────────────────────

// Biome de carte (explorationView / story) → règle de plateau.
export const BIOME_RULE_OF = {
    bamboo: 'bamboo', volcano: 'volcano', paddy: 'swamp', riverbed: 'swamp',
    fusang: 'sanctuary', moon: 'sanctuary', coast: 'sea', storm: 'snow'
};
export const ruleForBiome = biome => BIOME_RULE_OF[biome] || null;

export const BIOME_RULES = {
    bamboo: { kind: 'bamboo', label: 'Bambous', text: 'Des bambous poussent : au bout de 3 tours, une case se bloque.', every: 3, spawn: 1, blocks: true, ttl: 0 },
    volcano: { kind: 'lava', label: 'Volcan', text: 'Des cases deviennent brûlantes : un match dessus inflige des dégâts à l\'ennemi, une case brûlante non utilisée blesse le héros.', every: 2, spawn: 1, ttl: 3, matchDamage: 6, burnDamage: 3 },
    swamp: { kind: 'mud', label: 'Marais', text: 'Des cases se transforment en boue : un match dessus donne 1 mana de moins.', every: 2, spawn: 1, ttl: 4, manaPenalty: 1 },
    sanctuary: { kind: 'sacred', label: 'Sanctuaire', text: 'Des cases sacrées : un match dessus donne +2 mana.', every: 2, spawn: 1, ttl: 4, manaBonus: 2 },
    sea: { kind: 'drift', label: 'Mer', text: 'Certaines cases dérivent : chaque tour, une rangée glisse d\'une case.', every: 1, spawn: 0, ttl: 0, drift: true },
    snow: { kind: 'frost', label: 'Neige', text: 'Des cases gèlent : elles sont indisponibles 2 tours.', every: 2, spawn: 1, ttl: 2, blocks: true }
};

// État des cases spéciales : { [indice]: { kind, ttl } } (ttl 0 = permanent jusqu'à destruction).
export const createBiomeState = () => ({ cells: {}, turn: 0 });

// Une case bloquée (bambou, glace) ne peut ni se déplacer ni se faire échanger.
export const isBlockedCell = (state, index, rule) => Boolean(rule?.blocks && state?.cells?.[index]);

// Avance d'un tour joueur : vieillit les cases (la glace fond), en fait apparaître de nouvelles.
// Retourne { spawned: [indices], expired: [indices], drifted: row|null }.
export function advanceBiome(state, rule, size, rng = Math.random) {
    const out = { spawned: [], expired: [], drifted: null };
    if (!state || !rule) return out;
    state.turn++;
    for (const key of Object.keys(state.cells)) {
        const c = state.cells[key];
        if (c.ttl > 0 && --c.ttl === 0) { delete state.cells[key]; out.expired.push(Number(key)); }
    }
    if (state.turn % rule.every !== 0) return out;
    if (rule.drift) { out.drifted = Math.floor(rng() * size); return out; }
    const free = [];
    for (let i = 0; i < size * size; i++) if (!state.cells[i]) free.push(i);
    for (let n = 0; n < rule.spawn && free.length; n++) {
        const idx = free.splice(Math.floor(rng() * free.length), 1)[0];
        state.cells[idx] = { kind: rule.kind, ttl: rule.ttl };
        out.spawned.push(idx);
    }
    return out;
}

// Effet d'un match de joueur qui traverse des cases spéciales : { manaDelta, damage, cleared: [indices] }.
export function resolveBiomeMatch(state, rule, indices) {
    const res = { manaDelta: 0, damage: 0, cleared: [] };
    if (!state || !rule) return res;
    for (const i of indices) {
        const c = state.cells[i];
        if (!c || c.kind !== rule.kind) continue;
        if (rule.manaBonus) res.manaDelta += rule.manaBonus;
        if (rule.manaPenalty) res.manaDelta -= rule.manaPenalty;
        if (rule.matchDamage) res.damage += rule.matchDamage;
        if (!rule.blocks) { delete state.cells[i]; res.cleared.push(i); }
    }
    return res;
}

// Dégâts de brûlure à la fin du tour du joueur : une par case brûlante encore présente.
export const burnDamage = (state, rule) =>
    rule?.burnDamage ? Object.values(state?.cells || {}).filter(c => c.kind === rule.kind).length * rule.burnDamage : 0;

// Glissement d'une rangée (mer) : décale les tuiles d'une case vers la droite en boucle (pur, retourne les indices modifiés).
export function driftRow(tiles, row, size) {
    const base = row * size;
    const last = tiles[base + size - 1];
    for (let c = size - 1; c > 0; c--) tiles[base + c] = tiles[base + c - 1];
    tiles[base] = last;
    return Array.from({ length: size }, (_, c) => base + c);
}
