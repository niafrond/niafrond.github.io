/**
 * composer.js — Composition procédurale (style chinois traditionnel) — OUTIL DE BUILD, pas chargé par le jeu.
 *
 * Sert à produire les pistes de `audio/music/` (tools/audio/render.mjs). Module pur (testable sous node) :
 *   composeSection(sceneId, { biome, seed, bar, boss, variant }) -> { events, bpm, bars, beatsPerBar, lengthBeats, root, scale, pcs, ... }
 *   events : [{ t, dur, midi, inst, vel, orn?, bend? }] (t et dur en temps ; vel dans ]0,1]).
 *   SCALES, MODE_NAMES, INSTRUMENT_RANGES, UNPITCHED, midiToFreq, makeRng, getSceneConfig, getBossStyle, getCombatStyle, getSceneList.
 */
import { SCENE_IDS, BIOMES, COMBAT_STYLE_COUNT as COMBAT_COUNT, BOSS_ARCHETYPE_COUNT, hashString, bossKey } from '../../musicTracks.js';
export { SCENE_IDS, BIOMES, bossKey };

// ═══════════════════════════════════════════════════════════════════════════
// PARTIE PURE : gammes, PRNG, composition
// ═══════════════════════════════════════════════════════════════════════════

/** Gammes pentatoniques chinoises (demi-tons depuis la tonique du mode). */
export const SCALES = {
    gong:  [0, 2, 4, 7, 9],   // do ré mi sol la
    shang: [0, 2, 5, 7, 10],  // ré mi sol la do
    jue:   [0, 3, 5, 8, 10],  // mi sol la do ré
    zhi:   [0, 2, 5, 7, 9],   // sol la do ré mi
    yu:    [0, 3, 5, 7, 10]   // la do ré mi sol
};
export const MODE_NAMES = Object.keys(SCALES);


/** Tessitures jouables (MIDI) par instrument. */
export const INSTRUMENT_RANGES = {
    erhu: [55, 93], dizi: [69, 96], xiao: [55, 84], guzheng: [38, 96], pipa: [45, 88],
    yangqin: [48, 96], harp: [36, 100], sheng: [36, 81], suona: [59, 88], bell: [72, 100],
    gong: [36, 60], drum: [28, 55], clap: [60, 84], cymbal: [72, 96]
};
/** Instruments sans hauteur (hors contrôle de gamme). */
export const UNPITCHED = new Set(['drum', 'clap', 'cymbal']);

const BEATS_PER_BAR = 4;
const BARS_PER_SECTION = 8;
const SEG_BEATS = 2 * BEATS_PER_BAR;

export function midiToFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

/** PRNG mulberry32 : renvoie une fonction () -> [0,1). */
export function makeRng(...parts) {
    let a = hashString(parts.join('|')) || 1;
    return function rng() {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const r3 = (v) => Math.round(v * 1000) / 1000;

// Palettes rythmiques d'une mesure (somme = 4 temps).
const SLOW = [[4], [2, 2], [3, 1], [2, 1, 1], [1, 1, 2]];
const MID = [[2, 1, 1], [1, 1, 2], [1.5, 0.5, 1, 1], [1, 1, 1, 1], [2, 2], [1, 0.5, 0.5, 2], [0.5, 0.5, 1, 2]];
const LIVELY = [[1, 0.5, 0.5, 1, 1], [0.5, 0.5, 0.5, 0.5, 1, 1], [1, 1, 0.5, 0.5, 1], [0.5, 0.5, 1, 0.5, 0.5, 1], [1.5, 0.5, 1.5, 0.5], [1, 1, 1, 1]];

// Palettes supplémentaires : rythmes variés (syncopes, pointés, triolets approchés, marche, galop).
const WALTZ = [[2, 1, 1], [1, 1, 2], [1, 2, 1], [3, 1], [1, 1, 1, 1]];                         // appui sur 1 et 3, souple
const DOTTED = [[1.5, 0.5, 1.5, 0.5], [1.5, 0.5, 2], [0.75, 0.25, 1, 2], [1.5, 1.5, 1], [2, 1.5, 0.5]];
const SYNC = [[0.5, 1, 0.5, 1, 1], [0.5, 1, 1, 0.5, 1], [1, 0.5, 1, 0.5, 1], [0.5, 1, 0.5, 2], [1.5, 1, 1.5]];
const TRIPLET = [[1 / 3, 1 / 3, 1 / 3, 1, 1, 1], [1, 1 / 3, 1 / 3, 1 / 3, 1, 1], [2, 1 / 3, 1 / 3, 1 / 3, 1], [1, 1, 2 / 3, 2 / 3, 2 / 3]];
const DRIVE = [[0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], [0.5, 0.5, 1, 0.5, 0.5, 1], [0.5, 0.5, 0.5, 0.5, 1, 1], [0.75, 0.75, 0.5, 0.75, 0.75, 0.5], [0.5, 0.5, 1, 1, 0.5, 0.5]];
const GALLOP = [[0.5, 0.25, 0.25, 0.5, 0.25, 0.25, 0.5, 0.25, 0.25, 0.5, 0.25, 0.25], [1, 0.5, 0.25, 0.25, 1, 0.5, 0.25, 0.25], [0.5, 0.25, 0.25, 1, 0.5, 0.25, 0.25, 1]];

// Tessitures de mélodie par instrument.
const MELODY_REG = { dizi: [69, 93], erhu: [62, 86], pipa: [57, 84], xiao: [62, 84], sheng: [55, 79], suona: [64, 88], guzheng: [55, 91], bell: [72, 100] };

// ── Scènes ──────────────────────────────────────────────────────────────────
const SCENES = {
    title: {
        label: 'Écran titre', description: 'Solennel : erhu, bourdon de sheng, gong.',
        root: 2, scale: 'yu', bpm: 54, lo: 62, hi: 86,
        melody: { inst: 'erhu', vel: 0.75, cells: SLOW, rest: 0.1, orn: 0.3, bend: 0.35 },
        par: { inst: 'xiao', interval: -7, vel: 0.35 },
        pad: { inst: 'sheng', bars: 2, vel: 0.35 },
        perc: 'gong4'
    },
    menu: {
        label: 'Menus', description: 'Calme : guzheng léger (carnet, carte, inventaire, boutique).',
        root: 7, scale: 'gong', bpm: 72, lo: 67, hi: 91,
        melody: { inst: 'guzheng', vel: 0.6, cells: MID, rest: 0.25, orn: 0.25, bend: 0.15 },
        accomp: { kind: 'arp', inst: 'guzheng', vel: 0.28, keep: 0.65, lo: 43 },
        pad: { inst: 'sheng', bars: 4, vel: 0.15 },
        perc: 'none', gliss: 0.3
    },
    village: {
        label: 'Village', description: 'Vivant et chaleureux : dizi, pipa, petites percussions.', biomes: true,
        root: 2, scale: 'gong', bpm: 96, lo: 69, hi: 93,
        melody: { inst: 'dizi', vel: 0.62, cells: [...DOTTED, ...MID, ...WALTZ], rest: 0.18, orn: 0.25, bend: 0.05 },
        hetero: { inst: 'guzheng', oct: 0, vel: 0.35 },
        accomp: { kind: 'pluck', inst: 'guzheng', vel: 0.26, keep: 0.7, lo: 43 },
        perc: 'village'
    },
    house: {
        label: 'Maison', description: 'Très intime : guzheng seul, xiao, peu de notes.',
        root: 9, scale: 'yu', bpm: 50, lo: 57, hi: 81,
        melody: { inst: 'guzheng', vel: 0.6, cells: SLOW, rest: 0.5, orn: 0.3, bend: 0.3 },
        accomp: { kind: 'arp', inst: 'guzheng', vel: 0.22, keep: 0.22, lo: 45 },
        pad: { inst: 'xiao', bars: 4, vel: 0.1 },
        perc: 'none', gliss: 0.15
    },
    wild: {
        label: 'Terres sauvages', description: 'Mystérieux : tambour lointain, erhu, tension modérée.', biomes: true,
        root: 4, scale: 'yu', bpm: 62, lo: 62, hi: 88,
        melody: { inst: 'xiao', vel: 0.6, cells: [...SLOW, ...WALTZ, ...TRIPLET.slice(0, 2)], rest: 0.35, orn: 0.2, bend: 0.2 },
        accomp: { kind: 'arp', inst: 'yangqin', vel: 0.2, keep: 0.25, lo: 43 },
        pad: { inst: 'sheng', bars: 4, vel: 0.22 },
        perc: 'far'
    },
    sanctuary: {
        label: 'Sanctuaire', description: 'Grave et solennel, calme : xiao, guzheng, bourdon, gong lointain (sans suona).',
        root: 2, scale: 'jue', bpm: 66, lo: 62, hi: 86,
        melody: { inst: 'xiao', vel: 0.6, cells: [...SLOW, ...DOTTED.slice(0, 2), ...WALTZ.slice(0, 3)], rest: 0.3, orn: 0.2, bend: 0.3 },
        hetero: { inst: 'guzheng', oct: -12, vel: 0.25 },
        accomp: { kind: 'arp', inst: 'guzheng', vel: 0.24, keep: 0.5, lo: 38 },
        pad: { inst: 'sheng', bars: 4, vel: 0.22 },
        perc: 'gong4'
    },
    moon: {
        label: 'Pic de la Lune', description: 'Éthéré : cloches, xiao, harpe.',
        root: 9, scale: 'zhi', bpm: 56, lo: 62, hi: 84,
        melody: { inst: 'xiao', vel: 0.55, cells: SLOW, rest: 0.4, orn: 0.2, bend: 0.2 },
        hetero: { inst: 'bell', oct: 12, vel: 0.3 },
        accomp: { kind: 'arp', inst: 'harp', vel: 0.3, keep: 0.6, lo: 48 },
        pad: { inst: 'sheng', bars: 4, vel: 0.15 },
        perc: 'bells', bells: { prob: 0.6, vel: 0.4 }, gliss: 0.5
    },
    combat: {
        label: 'Combat', description: 'Rythmé : tambours, pipa, claquoirs ; 5 styles de rythme selon le combat (ordinaires).',
        root: 4, scale: 'jue', bpm: 118, lo: 62, hi: 88,
        melody: { inst: 'pipa', vel: 0.62, cells: DRIVE, rest: 0.08, orn: 0.2, bend: 0.2 },
        hetero: { inst: 'dizi', oct: 12, vel: 0.28 },
        accomp: { kind: 'pluck', inst: 'pipa', vel: 0.3, keep: 0.9, lo: 38 },
        pad: { inst: 'sheng', bars: 2, vel: 0.14 },
        perc: 'drive'
    },
    boss: {
        label: 'Boss', description: 'Épique et rythmé : thème propre à chaque boss (nom du boss), taiko, gong, cordes.',
        root: 2, scale: 'jue', bpm: 128, lo: 62, hi: 90,
        melody: { inst: 'erhu', vel: 0.62, cells: SYNC, rest: 0.08, orn: 0.3, bend: 0.4 },
        hetero: { inst: 'pipa', oct: 0, vel: 0.4 },
        accomp: { kind: 'pluck', inst: 'pipa', vel: 0.36, keep: 0.9, lo: 38 },
        pad: { inst: 'sheng', bars: 2, vel: 0.2 },
        perc: 'taiko', suona: { prob: 0.25, vel: 0.3 }
    },
    ending: {
        label: 'Épilogue', description: 'Mélancolique et lumineux : erhu, dizi, guzheng, cloches.',
        root: 7, scale: 'zhi', bpm: 60, lo: 62, hi: 86,
        melody: { inst: 'erhu', vel: 0.7, cells: SLOW, rest: 0.15, orn: 0.3, bend: 0.4 },
        hetero: { inst: 'dizi', oct: 12, vel: 0.3 },
        accomp: { kind: 'arp', inst: 'guzheng', vel: 0.3, keep: 0.8, lo: 43 },
        pad: { inst: 'sheng', bars: 4, vel: 0.2 },
        perc: 'none', bells: { prob: 0.3, vel: 0.35 }
    }
};

// ── Variations par biome (village / wild) ───────────────────────────────────
const BIOME_STYLES = {
    paddy: { all: {}, village: {}, wild: {} },
    riverbed: {
        all: { root: 5, scale: 'shang', bpmMul: 0.94, perc: 'sway' },
        village: { accomp: { kind: 'arp', inst: 'yangqin', vel: 0.3, keep: 0.75, lo: 48 } },
        wild: { accomp: { kind: 'arp', inst: 'yangqin', vel: 0.22, keep: 0.3, lo: 48 } }
    },
    bamboo: {
        all: { root: 7, scale: 'gong', bpmMul: 1.04, perc: 'sway', melody: { inst: 'dizi', vel: 0.7 } },
        village: { hetero: { inst: 'xiao', oct: 0, vel: 0.3 } },
        wild: { hetero: { inst: 'erhu', oct: -12, vel: 0.3 } }
    },
    gobi: {
        all: { root: 4, scale: 'yu', bpmMul: 0.9, perc: 'caravan', melody: { inst: 'erhu', vel: 0.72 } },
        village: { hetero: { inst: 'pipa', oct: 0, vel: 0.4 } }, wild: {}
    },
    storm: { all: { root: 2, scale: 'jue', bpmMul: 1.0, perc: 'thunder' }, village: { melody: { inst: 'erhu' } }, wild: {} },
    volcano: {
        all: { root: 9, scale: 'jue', perc: 'far', suona: null, melody: { inst: 'erhu', vel: 0.58 } },
        village: {}, wild: {}
    },
    savanna: { all: { root: 7, scale: 'zhi', perc: 'caravan', melody: { inst: 'pipa', vel: 0.7, cells: LIVELY } }, village: {}, wild: {} },
    coast: {
        all: { root: 5, scale: 'shang', melody: { inst: 'pipa', vel: 0.7, cells: LIVELY, rest: 0.05, orn: 0.4 } },
        village: { hetero: { inst: 'dizi', oct: 12, vel: 0.3 } }, wild: {}
    },
    fusang: {
        all: { root: 9, scale: 'gong', bells: { prob: 0.5, vel: 0.4 }, melody: { inst: 'dizi' }, pad: { inst: 'sheng', bars: 4, vel: 0.2 } },
        village: {}, wild: {}
    },
    moon: {
        all: {
            root: 9, scale: 'zhi', bpmMul: 0.8, perc: 'bells', bells: { prob: 0.8, vel: 0.4 },
            melody: { inst: 'xiao', vel: 0.6 }, hetero: { inst: 'bell', oct: 12, vel: 0.3 }
        },
        village: {}, wild: {}
    }
};

// Styles de combat : 5 grooves distincts (percussion, cellules rythmiques, tempo, mode, instruments).
const COMBAT_STYLES = [
    { perc: 'drive', bpm: 118, root: 4, scale: 'jue', melody: { inst: 'pipa', cells: DRIVE } },
    { perc: 'gallop', bpm: 126, root: 9, scale: 'yu', melody: { inst: 'erhu', cells: [...GALLOP, ...DRIVE.slice(0, 2)], vel: 0.58 }, hetero: { inst: 'pipa', oct: 12, vel: 0.3 } },
    { perc: 'march', bpm: 104, root: 7, scale: 'shang', melody: { inst: 'dizi', cells: [...DOTTED, ...SYNC.slice(0, 2)], vel: 0.6 }, hetero: { inst: 'erhu', oct: -12, vel: 0.3 } },
    { perc: 'shuffle', bpm: 112, root: 2, scale: 'zhi', melody: { inst: 'pipa', cells: [...TRIPLET, ...SYNC.slice(0, 2)] }, hetero: { inst: 'xiao', oct: 12, vel: 0.28 } },
    { perc: 'tresillo', bpm: 122, root: 5, scale: 'jue', melody: { inst: 'guzheng', cells: [...SYNC, ...DRIVE.slice(2, 4)], vel: 0.6 }, hetero: { inst: 'pipa', oct: 0, vel: 0.3 } }
];

// Thèmes de boss : archétypes (couleur, rythme, instruments) + mode/tempo propres à chaque boss.
const BOSS_ARCHETYPES = [
    { perc: 'taiko', scale: 'jue', bpm: 130, melody: { inst: 'erhu', cells: SYNC }, hetero: { inst: 'pipa', oct: 0, vel: 0.4 }, suona: { prob: 0.3, vel: 0.3 } },   // fanfare martiale
    { perc: 'gallop', scale: 'yu', bpm: 138, melody: { inst: 'pipa', cells: GALLOP }, hetero: { inst: 'erhu', oct: 0, vel: 0.35 }, suona: null },                       // charge
    { perc: 'tresillo', scale: 'zhi', bpm: 120, melody: { inst: 'guzheng', cells: [...SYNC, ...TRIPLET] }, hetero: { inst: 'dizi', oct: 12, vel: 0.3 }, suona: null },  // incantatoire
    { perc: 'march', scale: 'shang', bpm: 112, melody: { inst: 'erhu', cells: DOTTED }, hetero: { inst: 'xiao', oct: 12, vel: 0.3 }, suona: { prob: 0.4, vel: 0.28 } },  // procession
    { perc: 'thunder', scale: 'jue', bpm: 126, melody: { inst: 'erhu', cells: [...DRIVE, ...SYNC] }, hetero: { inst: 'yangqin', oct: 12, vel: 0.35 }, suona: null },        // orage
    { perc: 'shuffle', scale: 'gong', bpm: 116, melody: { inst: 'dizi', cells: [...TRIPLET, ...DOTTED] }, hetero: { inst: 'pipa', oct: 0, vel: 0.4 }, suona: null },      // ruse
    { perc: 'drive', scale: 'yu', bpm: 134, melody: { inst: 'pipa', cells: DRIVE }, hetero: { inst: 'erhu', oct: 0, vel: 0.4 }, suona: { prob: 0.3, vel: 0.28 } },         // fournaise
    { perc: 'taiko', scale: 'zhi', bpm: 108, melody: { inst: 'erhu', cells: [...DOTTED, ...MID] }, hetero: { inst: 'bell', oct: 12, vel: 0.28 }, suona: null }             // solennel
];

const clone = (o) => JSON.parse(JSON.stringify(o));

function applyStyle(cfg, style) {
    for (const key of Object.keys(style)) {
        const val = style[key];
        if (key === 'bpmMul') cfg.bpm = Math.round(cfg.bpm * val);
        else if (['melody', 'hetero', 'accomp', 'pad', 'bells', 'suona', 'par'].includes(key)) {
            cfg[key] = val === null ? null : { ...(cfg[key] || {}), ...clone(val) };
            if (key === 'melody' && val && val.inst && MELODY_REG[val.inst]) {
                [cfg.lo, cfg.hi] = MELODY_REG[val.inst];
            }
        } else cfg[key] = clone(val);
    }
}

/** Configuration résolue d'une scène (+ biome pour village/wild). Lève si la scène est inconnue. */
/** Style (partiel) d'un boss : archétype + mode/tempo/tonique décalés selon le nom → un thème propre à chaque boss. */
export function getBossStyle(name) {
    const key = bossKey(name) || 'boss';
    const h = hashString(`boss|${key}`);
    const a = BOSS_ARCHETYPES[h % BOSS_ARCHETYPES.length];
    const st = clone(a);
    st.root = (h >>> 3) % 12;
    if ((h >>> 9) % 3 === 0) st.scale = MODE_NAMES[(h >>> 12) % MODE_NAMES.length];
    st.bpm = a.bpm + ((h >>> 15) % 17) - 8;
    return st;
}

/** Style de combat ordinaire choisi par `variant` (entier ou chaîne). */
export function getCombatStyle(variant) {
    const n = typeof variant === 'number' && Number.isFinite(variant) ? Math.abs(Math.floor(variant)) : hashString(String(variant ?? 0));
    return clone(COMBAT_STYLES[n % COMBAT_STYLES.length]);
}
export const COMBAT_STYLE_COUNT = COMBAT_STYLES.length;
if (COMBAT_STYLE_COUNT !== COMBAT_COUNT || BOSS_ARCHETYPES.length !== BOSS_ARCHETYPE_COUNT) throw new Error('composer.js et musicTracks.js ne sont plus alignés');

export function getSceneConfig(sceneId, biome, variant) {
    const base = SCENES[sceneId];
    if (!base) throw new TypeError(`Scène musicale inconnue : ${sceneId}`);
    const cfg = clone(base);
    cfg.id = sceneId;
    if (base.biomes && biome && BIOME_STYLES[biome]) {
        const st = BIOME_STYLES[biome];
        applyStyle(cfg, st.all || {});
        applyStyle(cfg, st[sceneId] || {});
    }
    if (sceneId === 'boss' && variant) applyStyle(cfg, getBossStyle(variant));
    if (sceneId === 'combat' && variant !== undefined && variant !== null) applyStyle(cfg, getCombatStyle(variant));
    cfg.root = ((cfg.root % 12) + 12) % 12;
    cfg.pcs = SCALES[cfg.scale].map((s) => (cfg.root + s) % 12);
    return cfg;
}

export function getSceneList() {
    return SCENE_IDS.map((id) => ({ id, label: SCENES[id].label, description: SCENES[id].description, biomes: Boolean(SCENES[id].biomes) }));
}

// ── Outils de hauteur ───────────────────────────────────────────────────────
function buildLadder(pcs, lo, hi) {
    const out = [];
    for (let m = lo; m <= hi; m++) if (pcs.includes(m % 12)) out.push(m);
    return out;
}
/** Note de la gamme la plus proche (égalité : vers le bas). */
function snapMidi(m, pcs) {
    for (let d = 0; d <= 3; d++) {
        if (pcs.includes((((m - d) % 12) + 12) % 12)) return m - d;
        if (pcs.includes((((m + d) % 12) + 12) % 12)) return m + d;
    }
    return m;
}
function fitRange(m, inst) {
    const [lo, hi] = INSTRUMENT_RANGES[inst];
    while (m < lo) m += 12;
    while (m > hi) m -= 12;
    return m;
}
function mkEvent(inst, t, dur, midi, vel, extra) {
    const ev = { t: r3(t), dur: r3(Math.max(0.0625, dur)), midi: UNPITCHED.has(inst) ? midi : fitRange(midi, inst), inst, vel: r3(clamp(vel, 0.05, 1)) };
    if (extra) Object.assign(ev, extra);
    return ev;
}

// ── Motifs et variations ────────────────────────────────────────────────────
const STEPS = [-2, -1, -1, 0, 1, 1, 1, 2, 3, -3];

function makeMotif(rng, cfg, ladderLen) {
    const notes = [];
    let idx = Math.floor(ladderLen / 2) + Math.floor(rng() * 3) - 1;
    for (let b = 0; b < 2; b++) {
        const cell = pick(rng, cfg.melody.cells);
        let t = b * BEATS_PER_BAR;
        for (let i = 0; i < cell.length; i++) {
            const rest = !(b === 0 && i === 0) && rng() < cfg.melody.rest;
            if (!rest) {
                idx = clamp(idx + pick(rng, STEPS), 0, ladderLen - 1);
                notes.push({ t, dur: cell[i], idx });
            }
            t += cell[i];
        }
    }
    return notes;
}

/** Variation d'un motif (level 0 = identique). */
function varyMotif(rng, notes, level, ladderLen) {
    if (level === 0) return notes.map((n) => ({ ...n }));
    const out = [];
    notes.forEach((n, i) => {
        const r = rng();
        if (i > 0 && r < 0.22 * level) out.push({ ...n, idx: clamp(n.idx + (rng() < 0.5 ? -1 : 1), 0, ladderLen - 1) });
        else if (r < 0.36 * level && n.dur >= 1) {
            const h = n.dur / 2;
            out.push({ t: n.t, dur: h, idx: n.idx });
            out.push({ t: n.t + h, dur: h, idx: clamp(n.idx + (rng() < 0.5 ? -1 : 1), 0, ladderLen - 1) });
        } else if (i > 0 && n.dur <= 0.5 && r > 1 - 0.15 * level) { /* note omise */ }
        else out.push({ ...n });
    });
    return out;
}

/** Cadence : la dernière note retombe sur une tonique et se tient jusqu'à la fin du segment. */
function applyCadence(notes, ladder, rootPc) {
    if (!notes.length) return notes;
    const last = notes[notes.length - 1];
    let best = last.idx, bd = 99;
    ladder.forEach((m, i) => { if (m % 12 === rootPc && Math.abs(i - last.idx) < bd) { bd = Math.abs(i - last.idx); best = i; } });
    last.idx = best;
    last.dur = Math.min(4, SEG_BEATS - last.t);
    return notes;
}

// Formes de phrase : 4 segments de 2 mesures [motif, niveau de variation, cadence].
const FORMS = [
    [['A', 0], ['A', 1], ['B', 0], ['A', 2, true]],
    [['A', 1], ['A', 0], ['B', 1], ['A', 2, true]],
    [['B', 0], ['B', 1], ['A', 1], ['A', 0, true]],
    [['A', 2], ['B', 1], ['A', 0], ['B', 1, true]]
];
const PROGS = [[0, 0, 7, 0, 0, 9, 7, 0], [0, 7, 0, 7, 0, 5, 7, 0], [0, 0, 5, 7, 0, 0, 7, 0]];

const TRILLERS = new Set(['erhu', 'dizi', 'xiao', 'guzheng', 'pipa', 'yangqin', 'harp']);
const BENDERS = new Set(['erhu', 'guzheng', 'pipa', 'suona']);

/** Émet une note mélodique, avec ornement éventuel (appoggiature, trille, glissando). */
function emitMelodyNote(out, rng, ladder, inst, n, vel, ornP, bendP, tOff, oct) {
    const m = ladder[n.idx] + oct;
    const up = ladder[Math.min(ladder.length - 1, n.idx + 1)] + oct;
    const r = rng();
    if (r < ornP && n.dur >= 1 && n.idx + 1 < ladder.length) {
        out.push(mkEvent(inst, n.t + tOff, 0.125, up, vel * 0.65, { orn: true }));
        out.push(mkEvent(inst, n.t + tOff + 0.125, n.dur - 0.125, m, vel));
    } else if (r < ornP * 1.6 && n.dur >= 2 && TRILLERS.has(inst) && n.idx + 1 < ladder.length) {
        const tl = Math.min(1, n.dur / 2);
        out.push(mkEvent(inst, n.t + tOff, n.dur - tl, m, vel));
        const steps = Math.round(tl / 0.125);
        for (let k = 0; k < steps; k++) {
            out.push(mkEvent(inst, n.t + tOff + (n.dur - tl) + k * 0.125, 0.125, k % 2 === 0 ? up : m, vel * 0.6, { orn: true }));
        }
    } else {
        const extra = BENDERS.has(inst) && rng() < bendP ? { bend: -pick(rng, [1, 2]) } : null;
        out.push(mkEvent(inst, n.t + tOff, n.dur, m, vel, extra));
    }
}

function composePerc(kind, rng, c, b, out) {
    const t0 = b * BEATS_PER_BAR;
    const LOW = 36, MID_D = 43, CLAP = 76, CYM = 84;
    const gongMidi = 36 + (((c.root - 36) % 12) + 12) % 12;
    const d = (t, v, m = LOW, dur = 0.5) => out.push(mkEvent('drum', t0 + t, dur, m, v));
    const cl = (t, v) => out.push(mkEvent('clap', t0 + t, 0.25, CLAP, v));
    const cy = (t, v) => out.push(mkEvent('cymbal', t0 + t, 1, CYM, v));
    const gg = (t, v) => out.push(mkEvent('gong', t0 + t, 4, gongMidi, v));
    switch (kind) {
        case 'gong4':
            if (b % 4 === 0) gg(0, 0.6);
            if (b % 2 === 0) d(0, 0.3);
            if (b === 7 && rng() < 0.5) cy(3, 0.2);
            break;
        case 'village':
            if (b % 4 === 3) { d(0, 0.34, MID_D); cl(1.5, 0.24); d(2.5, 0.3, MID_D); cl(3, 0.28); }
            else { d(0, 0.34, MID_D); cl(1, 0.24); d(2, 0.24, MID_D); cl(3, 0.26); }
            if (rng() < 0.3) cl(1.5, 0.15);
            if (b === 7) { cl(3.5, 0.3); cy(0, 0.12); }
            break;
        case 'caravan':
            d(0, 0.5); d(1.5, 0.33, MID_D); cl(2, 0.28); d(2.5, 0.3, MID_D); if (rng() < 0.5) cl(3.5, 0.18);
            break;
        case 'thunder':
            if (b % 4 === 0) { d(0, 0.5); if (rng() < 0.6) cy(0, 0.18); }
            if (rng() < 0.5) {
                const s = rng() < 0.5 ? 0 : 2;
                for (let k = 0; k < 6; k++) d(s + k * 0.25, 0.2 + k * 0.07, k % 2 ? MID_D : LOW, 0.3);
            }
            break;
        case 'taiko':
            if (b % 2 === 0) { d(0, 0.9); d(1.5, 0.55, MID_D); d(2, 0.7); d(3, 0.55, MID_D); }
            else { d(0, 0.8); d(2.5, 0.5, MID_D); d(3, 0.6); d(3.5, 0.5, MID_D); }
            if (b % 4 === 0) gg(0, 0.7);
            if (b === 7) for (let k = 0; k < 4; k++) d(2 + k * 0.5, 0.5 + k * 0.1, MID_D, 0.3);
            break;
        case 'sway':   // balancement doux (exploration) : tambour feutré, rare, sans claquoir
            if (b % 2 === 0) d(0, 0.22, MID_D);
            if (b % 4 === 2 && rng() < 0.6) d(2.5, 0.14, MID_D);
            if (b % 4 === 0) cy(0, 0.07);
            break;
        case 'drive':  // combat : quatre temps francs, contretemps de claquoir, croches de cymbale
            d(0, 0.85); cl(1, 0.4); d(2, 0.7); cl(3, 0.42);
            d(1.5, 0.35, MID_D);
            if (b % 2 === 1) d(3.5, 0.45, MID_D);
            for (let k = 0; k < 8; k += 2) if (b % 2 === 0 || k > 2) cy(k * 0.5 + 0.5, 0.07);
            if (b % 4 === 0) gg(0, 0.45);
            if (b === 7) for (let k = 0; k < 4; k++) { d(2 + k * 0.5, 0.5 + k * 0.1, MID_D, 0.3); cl(2.25 + k * 0.5, 0.2); }
            break;
        case 'gallop': // galop : croche, double-croche, double-croche
            for (let k = 0; k < 4; k++) { d(k, k === 0 ? 0.85 : 0.6); d(k + 0.5, 0.35, MID_D, 0.2); d(k + 0.75, 0.4, MID_D, 0.2); }
            if (b % 2 === 1) cl(1, 0.3); cl(3, 0.34);
            if (b % 4 === 0) gg(0, 0.5);
            break;
        case 'march':  // marche : caisse claire pointée, grosse caisse sur 1 et 3
            d(0, 0.85); cl(0.5, 0.2); cl(1, 0.38); cl(1.75, 0.22); d(2, 0.7); cl(2.5, 0.2); cl(3, 0.4); cl(3.5, 0.26);
            if (b % 4 === 3) { cy(0, 0.16); d(3.5, 0.55, MID_D, 0.3); }
            break;
        case 'shuffle': // swing ternaire
            for (let k = 0; k < 4; k++) { d(k, k % 2 ? 0.45 : 0.8, k % 2 ? MID_D : LOW); cl(k + 2 / 3, 0.2); }
            cl(1, 0.32); cl(3, 0.34);
            if (b % 4 === 0) cy(0, 0.14);
            break;
        case 'tresillo': // 3 + 3 + 2 : le motif de la danse du lion
            d(0, 0.85); d(1.5, 0.6, MID_D); d(3, 0.7);
            cl(1, 0.3); cl(2.5, 0.34); cl(3.5, 0.26);
            if (b % 2 === 1) d(2, 0.4, MID_D);
            if (b % 4 === 3) cy(0, 0.14);
            break;
        case 'far':
            if (b % 2 === 0 && rng() < 0.8) d(rng() < 0.5 ? 0 : 2, 0.3 + rng() * 0.1);
            if (b % 4 === 3 && rng() < 0.5) cl(1, 0.15);
            break;
        case 'bells':
            if (b % 4 === 0) cy(0, 0.13);
            break;
        default: break;
    }
}

function composeAccomp(cfg, rng, bar, prog, out) {
    const a = cfg.accomp;
    if (!a) return;
    let rootBase = a.lo; while (rootBase % 12 !== cfg.root) rootBase++;
    const barRoot = snapMidi(rootBase + prog[bar], cfg.pcs);
    const tones = [barRoot, snapMidi(barRoot + 7, cfg.pcs), barRoot + 12, snapMidi(barRoot + 16, cfg.pcs)];
    const t0 = bar * BEATS_PER_BAR;
    if (a.kind === 'arp') {
        const PAT = [0, 1, 2, 1, 3, 2, 1, 2];
        PAT.forEach((ti, i) => {
            if (rng() < a.keep) out.push(mkEvent(a.inst, t0 + i * 0.5, 1, tones[ti], a.vel * (i % 2 ? 0.7 : 1)));
        });
    } else if (a.kind === 'pluck') {
        const PL = [[0, 0, 0.55], [1, 1, 0.35], [2, 2, 0.45], [2.5, 1, 0.3], [3, 1, 0.35]];
        for (const [t, ti, v] of PL) if (rng() < a.keep) out.push(mkEvent(a.inst, t0 + t, 0.75, tones[ti], a.vel * v / 0.55));
        if ((bar === 3 || bar === 7) && rng() < 0.4) {
            for (let k = 0; k < 6; k++) out.push(mkEvent(a.inst, t0 + 2 + k * 0.25, 0.25, tones[2], a.vel * 0.7, { orn: true }));
        }
    }
}

/**
 * Compose une section de 8 mesures (32 temps).
 * @param {string} sceneId
 * @param {{biome?:string, seed?:number|string, bar?:number}} [opts]
 */
export function composeSection(sceneId, opts = {}) {
    const biome = opts.biome || null;
    const variant = opts.variant ?? opts.boss ?? null;
    const cfg = getSceneConfig(sceneId, biome, variant);
    const seed = opts.seed ?? 1;
    const bar = Math.max(0, Math.floor(opts.bar || 0));
    const phrase = Math.floor(bar / BARS_PER_SECTION);
    const key = `${seed}|${sceneId}|${(cfg.biomes && biome) || ''}|${variant ?? ''}`;
    const ladder = buildLadder(cfg.pcs, cfg.lo, cfg.hi);
    const ev = [];

    // Motifs A et B stables sur toute la pièce (dépendent seulement de la graine).
    const motifs = { A: makeMotif(makeRng(key, 'A'), cfg, ladder.length), B: makeMotif(makeRng(key, 'B'), cfg, ladder.length) };
    const form = FORMS[phrase % FORMS.length];
    const base = [];
    form.forEach(([name, level, cad], s) => {
        const rng = makeRng(key, 'var', phrase, s);
        let notes = varyMotif(rng, motifs[name], level, ladder.length);
        if (cad) notes = applyCadence(notes, ladder, cfg.root);
        for (const n of notes) base.push({ t: n.t + s * SEG_BEATS, dur: n.dur, idx: n.idx });
    });

    // Mélodie principale
    const rm = makeRng(key, 'orn', phrase);
    const m = cfg.melody;
    for (const n of base) emitMelodyNote(ev, rm, ladder, m.inst, n, m.vel, m.orn, m.bend, 0, 0);

    // Hétérophonie : même mélodie, instrument 2, plus légère, ornée autrement, légèrement décalée
    if (cfg.hetero) {
        const rh = makeRng(key, 'het', phrase);
        for (const n of base) {
            if (n.dur <= 0.5 && rh() < 0.4) continue;
            emitMelodyNote(ev, rh, ladder, cfg.hetero.inst, n, cfg.hetero.vel, Math.min(0.9, m.orn * 2), 0.3, 0.04, cfg.hetero.oct || 0);
        }
    }
    // Quintes parallèles (voix doublée à la quinte)
    if (cfg.par) {
        for (const n of base) {
            if (n.dur < 1) continue;
            ev.push(mkEvent(cfg.par.inst, n.t + 0.03, n.dur, snapMidi(ladder[n.idx] + cfg.par.interval, cfg.pcs), cfg.par.vel));
        }
    }

    // Accompagnement et bourdon
    const prog = PROGS[Math.floor(makeRng(key, 'prog', phrase)() * PROGS.length)];
    const ra = makeRng(key, 'acc', phrase);
    for (let b = 0; b < BARS_PER_SECTION; b++) composeAccomp(cfg, ra, b, prog, ev);
    if (cfg.pad) {
        let pb = 48; while (pb % 12 !== cfg.root) pb++;
        for (let b = 0; b < BARS_PER_SECTION; b += cfg.pad.bars) {
            const r0 = snapMidi(pb + prog[b], cfg.pcs);
            const dur = cfg.pad.bars * BEATS_PER_BAR + 0.5;
            ev.push(mkEvent(cfg.pad.inst, b * BEATS_PER_BAR, dur, r0, cfg.pad.vel));
            ev.push(mkEvent(cfg.pad.inst, b * BEATS_PER_BAR, dur, snapMidi(r0 + 7, cfg.pcs), cfg.pad.vel * 0.8));
        }
    }

    // Glissando de harpe/guzheng en début de section
    const rg = makeRng(key, 'gliss', phrase);
    if (cfg.gliss && rg() < cfg.gliss) {
        const inst = (cfg.accomp || cfg.melody).inst;
        const lad = buildLadder(cfg.pcs, 55, 84);
        const s0 = Math.floor(rg() * Math.max(1, lad.length - 9));
        for (let k = 0; k < 8; k++) ev.push(mkEvent(inst, k * 0.125, 0.125, lad[s0 + k], 0.3 + k * 0.03, { orn: true }));
    }

    // Cloches éparses
    if (cfg.bells) {
        const rb = makeRng(key, 'bells', phrase);
        const bl = buildLadder(cfg.pcs, 72, 100);
        for (let b = 0; b < BARS_PER_SECTION; b++) {
            if (rb() < cfg.bells.prob) ev.push(mkEvent('bell', b * BEATS_PER_BAR + pick(rb, [0, 1, 2, 3, 1.5]), 3, pick(rb, bl), cfg.bells.vel * (0.7 + rb() * 0.3)));
        }
    }

    // Suona : courte fanfare aux fins de demi-phrase
    if (cfg.suona) {
        const rs = makeRng(key, 'suona', phrase);
        [3, 7].forEach((endBar) => {
            if (rs() >= cfg.suona.prob) return;
            let sb = 60; while (sb % 12 !== cfg.root) sb++;
            const t = endBar * BEATS_PER_BAR;
            ev.push(mkEvent('suona', t, 0.5, sb, cfg.suona.vel, { bend: -1 }));
            ev.push(mkEvent('suona', t + 0.5, 1, snapMidi(sb + 7, cfg.pcs), cfg.suona.vel));
            ev.push(mkEvent('suona', t + 1.5, 2, sb + 12, cfg.suona.vel * 0.9, { bend: -2 }));
        });
    }

    // Percussions
    const rp = makeRng(key, 'perc', phrase);
    for (let b = 0; b < BARS_PER_SECTION; b++) composePerc(cfg.perc, rp, cfg, b, ev);

    ev.sort((a, b) => a.t - b.t || a.midi - b.midi);
    return {
        sceneId, biome, seed, variant, phrase, bpm: cfg.bpm, bars: BARS_PER_SECTION, beatsPerBar: BEATS_PER_BAR,
        lengthBeats: BARS_PER_SECTION * BEATS_PER_BAR, startBar: phrase * BARS_PER_SECTION,
        root: cfg.root, scale: cfg.scale, pcs: cfg.pcs.slice(), events: ev
    };
}
