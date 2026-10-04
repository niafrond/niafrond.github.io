/**
 * music.js — Musique procédurale d'ambiance (style chinois traditionnel) pour Match3-Quest.
 *
 * Tout est synthétisé en WebAudio : aucun fichier audio, aucun réseau, aucune dépendance.
 * Le module n'importe PAS sound.js : l'environnement (AudioContext, volume, mute) est injecté.
 *
 * ── API AUDIO ────────────────────────────────────────────────────────────────
 *   setMusicEnvironment({ getContext, getVolume, isMuted, timer? })
 *       getContext() -> AudioContext|null   (ne doit pas lever ; null/suspendu = on réessaie plus tard)
 *       getVolume()  -> 0..1                (volume musique utilisateur, réévalué à chaque tick)
 *       isMuted()    -> boolean             (idem)
 *       timer        -> { set(fn, ms), clear(id) } optionnel (tests)
 *   setMusicScene(sceneId, { biome?, seed?, boss?, variant? } = {}) -> boolean
 *       Démarre/enchaîne (fondu enchaîné ~1,2 s) la scène. No-op si même scène (+ même biome pour
 *       village/wild ; boss : même nom de boss). `boss` (nom du boss) donne à la scène « boss » un thème propre à
 *       chaque boss ; `variant` (entier/chaîne) choisit un des styles rythmiques de la scène « combat ». Retourne false si l'identifiant est inconnu. Ne lève jamais.
 *   stopMusic({ fadeMs = 1200 } = {})  Fondu puis arrêt propre (nœuds stoppés et déconnectés).
 *   pauseMusic() / resumeMusic()       Gèle/reprend la partition (le temps musical est suspendu).
 *   isMusicPlaying() -> boolean        Une scène est active, non en pause, contexte non suspendu.
 *   getSceneList() -> [{ id, label, description, biomes }]
 *
 * ── API PURE (testable sous node) ────────────────────────────────────────────
 *   composeSection(sceneId, { biome, seed, bar }) -> { events, bpm, bars, beatsPerBar, lengthBeats,
 *       root (classe de hauteur 0..11), scale (nom), pcs, ... }
 *       events : [{ t, dur, midi, inst, vel, orn?, bend? }] — t et dur en TEMPS (noires), t relatif
 *       au début de la section (8 mesures de 4 temps), vel dans ]0,1].
 *       orn: true  = ornement déclaré (appoggiature, trille, trémolo, glissando) ;
 *       bend       = décalage initial en demi-tons, la hauteur glisse ensuite vers `midi`.
 *       `bar` = mesure de départ : floor(bar/8) choisit la phrase (forme A A' B A''… variée).
 *   SCALES, MODE_NAMES, INSTRUMENT_RANGES, UNPITCHED, SCENE_IDS, BIOMES, midiToFreq, makeRng,
 *   getSceneConfig, getSceneList.
 */

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

export const SCENE_IDS = ['title', 'menu', 'village', 'house', 'wild', 'sanctuary', 'moon', 'ending', 'combat', 'boss'];
export const BIOMES = ['paddy', 'riverbed', 'bamboo', 'gobi', 'storm', 'volcano', 'savanna', 'coast', 'fusang', 'moon'];

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

/** Hash FNV-1a 32 bits d'une chaîne. */
function hashString(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
}
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
export function bossKey(name) {
    return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

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

// ═══════════════════════════════════════════════════════════════════════════
// PARTIE AUDIO : synthèse WebAudio et moteur d'ordonnancement
// ═══════════════════════════════════════════════════════════════════════════

// Anticipation d'ordonnancement (s) : les notes sont programmées à l'avance sur l'horloge audio (indépendante du
// thread principal). Sur un vieil appareil dont le thread principal décroche (> 150 ms), une anticipation courte
// laissait des trous / notes sautées ; elle s'élargit donc automatiquement quand on mesure des ticks en retard.
// Aucune perte de qualité : seule la réactivité d'une nouvelle scène varie (de quelques dizaines de ms), les fondus non.
const AHEAD_MIN = 0.3;
const AHEAD_MAX = 1.2;
const LATE_TOLERANCE = 0.35; // une note programmée plus tôt que `now - tolérance` est sautée (sinon jouée aussitôt)
const TICK_MS = 50;
const FADE_S = 1.2;          // fondu enchaîné entre scènes
const MASTER_FACTOR = 0.5;   // plus discret que la musique de combat
const MAX_VOICES = 10;       // polyphonie des voix « tenues » (hors percussions)
const MAX_NODES_VOICES = 24; // plafond dur, queues de résonance comprises

const INST_GAIN = {
    erhu: 0.3, dizi: 0.3, xiao: 0.34, guzheng: 0.4, pipa: 0.36, yangqin: 0.34, harp: 0.36,
    sheng: 0.16, suona: 0.16, bell: 0.24, gong: 0.4, drum: 0.75, clap: 0.35, cymbal: 0.14
};

const defaultTimer = {
    set(fn, ms) { const id = setInterval(fn, ms); if (id && typeof id.unref === 'function') id.unref(); return id; },
    clear(id) { clearInterval(id); }
};

const S = {
    env: { getContext: () => null, getVolume: () => 0.6, isMuted: () => false, timer: defaultTimer },
    desired: null,   // { key, scene, biome, seed }
    players: [],
    voices: [],
    bus: null, busCtx: null,
    paused: false, stopFade: undefined, timerId: null, lastTarget: -1, listening: false, uid: 0,
    ahead: AHEAD_MIN, lastTickAt: 0
};

export function setMusicEnvironment(env = {}) {
    if (typeof env.getContext === 'function') S.env.getContext = env.getContext;
    if (typeof env.getVolume === 'function') S.env.getVolume = env.getVolume;
    if (typeof env.isMuted === 'function') S.env.isMuted = env.isMuted;
    if (env.timer && typeof env.timer.set === 'function') S.env.timer = env.timer;
}

const safe = (fn, fallback) => { try { return fn(); } catch (_) { return fallback; } };
const rampOK = (fn) => { try { fn(); } catch (_) { /* paramètre non supporté */ } };

function isForeground() {
    if (typeof document === 'undefined') return true;
    // Seul l'onglet masqué coupe la musique : `hasFocus()` est faux dans une iframe / après un clic hors page,
    // ce qui rendait la musique silencieuse sans raison.
    return !document.hidden;
}

// ── Bus : entrée → maître (sec) + réverbe convolutive → compresseur → sortie ──
function makeImpulse(ctx) {
    const rate = ctx.sampleRate || 44100;
    const len = Math.floor(rate * 1.8);
    const buf = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
        const data = buf.getChannelData(c);
        const rng = makeRng('impulse', c);
        let lp = 0;
        for (let i = 0; i < len; i++) {
            lp += 0.35 * ((rng() * 2 - 1) - lp); // adoucit les aigus (salle boisée)
            data[i] = lp * Math.pow(1 - i / len, 3);
        }
    }
    return buf;
}
function makeNoise(ctx) {
    const rate = ctx.sampleRate || 44100;
    const len = rate * 2;
    const buf = ctx.createBuffer(1, len, rate);
    const d = buf.getChannelData(0);
    const rng = makeRng('noise');
    for (let i = 0; i < len; i++) d[i] = rng() * 2 - 1;
    return buf;
}
function createBus(ctx) {
    const input = ctx.createGain();
    const master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    const rv = ctx.createConvolver(); rv.buffer = makeImpulse(ctx);
    const send = ctx.createGain(); send.gain.value = 0.3;
    const wet = ctx.createGain(); wet.gain.value = 1;
    input.connect(master); input.connect(send); send.connect(rv); rv.connect(wet); wet.connect(master);
    master.connect(comp); comp.connect(ctx.destination);
    return { input, master, comp, rv, send, wet, noise: makeNoise(ctx), nodes: [input, master, comp, rv, send, wet] };
}
function destroyBus() {
    if (S.bus) for (const n of S.bus.nodes) safe(() => n.disconnect());
    S.bus = null; S.busCtx = null; S.lastTarget = -1;
}

// ── Voix ────────────────────────────────────────────────────────────────────
function newVoice(ctx, player, t0, nominalEnd, perc) {
    const v = { nodes: [], srcs: [], t0, nominalEnd, end: t0, perc, player, done: false };
    v.gain = (val = 1) => { const g = ctx.createGain(); g.gain.value = val; v.nodes.push(g); return g; };
    v.filter = (type, f, q = 0.7) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; v.nodes.push(n); return n; };
    v.osc = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; v.nodes.push(o); v.srcs.push(o); return o; };
    v.noise = (buf) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; v.nodes.push(s); v.srcs.push(s); return s; };
    return v;
}
function finishVoice(v, stopAt, bus, player) {
    v.end = stopAt;
    for (const s of v.srcs) {
        s.start(v.t0);
        s.stop(stopAt);
    }
    v.srcs[0].onended = () => cleanupVoice(v);
    S.voices.push(v);
}
function cleanupVoice(v) {
    if (v.done) return;
    v.done = true;
    for (const n of v.nodes) safe(() => n.disconnect());
    const i = S.voices.indexOf(v);
    if (i >= 0) S.voices.splice(i, 1);
}
function killVoice(v, now) {
    if (v.done) return;
    for (const s of v.srcs) safe(() => s.stop(now));
    cleanupVoice(v);
}

/** Enveloppe tenue : attaque, maintien jusqu'à dur, relâchement exponentiel. Renvoie l'instant d'arrêt. */
function sustainEnv(param, t0, a, peak, dur, rel) {
    const off = t0 + Math.max(dur, a + 0.02);
    param.setValueAtTime(0.0001, t0);
    param.linearRampToValueAtTime(peak, t0 + a);
    param.setValueAtTime(peak, off);
    param.exponentialRampToValueAtTime(0.0001, off + rel);
    return off + rel + 0.03;
}
function decayEnv(param, t0, a, peak, dec) {
    param.setValueAtTime(0.0001, t0);
    param.linearRampToValueAtTime(peak, t0 + a);
    param.exponentialRampToValueAtTime(0.0001, t0 + a + dec);
    return t0 + a + dec + 0.03;
}
function glideTo(freqParam, f, bend, t0, glide) {
    if (bend) {
        freqParam.setValueAtTime(f * Math.pow(2, bend / 12), t0);
        freqParam.exponentialRampToValueAtTime(f, t0 + glide);
    } else freqParam.setValueAtTime(f, t0);
}
/** Vibrato retardé : LFO dont la profondeur (en cents) s'installe après `delay` secondes. */
function addVibrato(v, ctx, targets, t0, rate, cents, delay) {
    const lfo = v.osc('sine', rate);
    const g = v.gain(0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(cents, t0 + delay + 0.4);
    lfo.connect(g);
    for (const o of targets) g.connect(o.detune);
}

const PLUCK = {
    guzheng: { dec: 2.2, cut0: 5200, cut1: 700, mix: 0.35, mul: 2, upper: 'sine' },
    pipa:    { dec: 1.0, cut0: 5000, cut1: 1000, mix: 0.3, mul: 2, upper: 'triangle' },
    yangqin: { dec: 1.2, cut0: 6000, cut1: 1500, mix: 0.3, mul: 3, upper: 'sine' },
    harp:    { dec: 2.8, cut0: 3500, cut1: 900, mix: 0.25, mul: 2, upper: 'sine' }
};

function buildPluck(ctx, v, kind, f, t0, dur, vel, bend, out, peak) {
    const P = PLUCK[kind];
    const dec = clamp(dur * 3, 0.3, P.dec);
    const flt = v.filter('lowpass', 2000, 0.7);
    flt.frequency.setValueAtTime(Math.min(P.cut0 * (0.6 + vel * 0.6) + f, 12000), t0);
    flt.frequency.exponentialRampToValueAtTime(Math.min(P.cut1 + f * 0.5, 9000), t0 + dec * 0.6);
    const g = v.gain();
    const o1 = v.osc('triangle', f); glideTo(o1.frequency, f, bend, t0, 0.14);
    const o2 = v.osc(P.upper, f * P.mul); glideTo(o2.frequency, f * P.mul, bend, t0, 0.14);
    const g2 = v.gain(P.mix);
    o1.connect(flt); o2.connect(g2); g2.connect(flt); flt.connect(g); g.connect(out);
    return decayEnv(g.gain, t0, 0.004, peak, dec);
}

function buildFlute(ctx, v, kind, f, t0, dur, vel, bend, out, peak, noiseBuf) {
    const xiao = kind === 'xiao';
    const g = v.gain();
    const o1 = v.osc('sine', f); glideTo(o1.frequency, f, bend, t0, 0.1);
    const o2 = v.osc('triangle', f * 2); glideTo(o2.frequency, f * 2, bend, t0, 0.1);
    const g2 = v.gain(xiao ? 0.12 : 0.28);
    o1.connect(g); o2.connect(g2); g2.connect(g);
    addVibrato(v, ctx, [o1, o2], t0, xiao ? 4.5 : 5.5, xiao ? 14 : 18, 0.3);
    const n = v.noise(noiseBuf);
    const bp = v.filter('bandpass', Math.min(f * (xiao ? 1.5 : 2), 9000), xiao ? 0.8 : 1.2);
    const ng = v.gain();
    ng.gain.setValueAtTime(xiao ? 0.1 : 0.14, t0);
    ng.gain.exponentialRampToValueAtTime(xiao ? 0.05 : 0.03, t0 + 0.12);
    n.connect(bp); bp.connect(ng); ng.connect(g);
    g.connect(out);
    return sustainEnv(g.gain, t0, xiao ? 0.15 : 0.06, peak, dur, xiao ? 0.3 : 0.15);
}

function buildErhu(ctx, v, f, t0, dur, vel, bend, out, peak) {
    const o = v.osc('sawtooth', f); glideTo(o.frequency, f, bend, t0, 0.14);
    const lp = v.filter('lowpass', Math.min(f * 2.6 + 500, 2600), 0.6);
    const body = v.filter('peaking', 700, 0.9); body.gain.value = 2;
    const g = v.gain();
    o.connect(lp); lp.connect(body); body.connect(g); g.connect(out);
    addVibrato(v, ctx, [o], t0, 5.5, 22, 0.3);
    return sustainEnv(g.gain, t0, 0.08, peak, dur, 0.18);
}

function buildSheng(ctx, v, f, t0, dur, vel, out, peak) {
    const o1 = v.osc('sawtooth', f);
    const o2 = v.osc('triangle', f * 1.003);
    const lp = v.filter('lowpass', Math.min(700 + f * 1.5, 3000), 0.8);
    const g = v.gain();
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(out);
    return sustainEnv(g.gain, t0, 0.7, peak, dur, 1.2);
}

function buildSuona(ctx, v, f, t0, dur, vel, bend, out, peak) {
    const o = v.osc('sawtooth', f); glideTo(o.frequency, f, bend, t0, 0.12);
    const lp = v.filter('lowpass', 2000, 0.5);
    const warm = v.filter('peaking', 600, 0.8); warm.gain.value = 3;
    const g = v.gain();
    o.connect(lp); lp.connect(warm); warm.connect(g); g.connect(out);
    addVibrato(v, ctx, [o], t0, 6, 25, 0.15);
    return sustainEnv(g.gain, t0, 0.03, peak, dur, 0.2);
}

function buildBell(ctx, v, f, t0, vel, out, peak) {
    const parts = [[1, 1, 3.2], [2.01, 0.5, 2.0], [2.76, 0.35, 1.2]];
    let end = t0;
    for (const [ratio, amp, dec] of parts) {
        const o = v.osc('sine', f * ratio);
        const g = v.gain();
        o.connect(g); g.connect(out);
        end = Math.max(end, decayEnv(g.gain, t0, 0.003, peak * amp, dec));
    }
    return end;
}

function buildGong(ctx, v, f, t0, vel, out, peak) {
    const parts = [[1, 1], [1.52, 0.6], [2.31, 0.4], [3.17, 0.25], [1.005, 0.5]];
    let end = t0;
    for (const [ratio, amp] of parts) {
        const o = v.osc(ratio > 3 ? 'triangle' : 'sine', f * ratio);
        o.frequency.setValueAtTime(f * ratio * 1.01, t0);
        o.frequency.exponentialRampToValueAtTime(f * ratio, t0 + 0.6);
        const g = v.gain();
        o.connect(g); g.connect(out);
        end = Math.max(end, decayEnv(g.gain, t0, 0.03, peak * amp * 0.6, 4.5 * (0.6 + vel * 0.4)));
    }
    return end;
}

function buildDrum(ctx, v, f, t0, vel, out, peak, noiseBuf) {
    const o = v.osc('sine', f * 2);
    o.frequency.setValueAtTime(f * 2, t0);
    o.frequency.exponentialRampToValueAtTime(f, t0 + 0.12);
    const g = v.gain();
    o.connect(g); g.connect(out);
    const e1 = decayEnv(g.gain, t0, 0.004, peak, 0.35 + vel * 0.3);
    const n = v.noise(noiseBuf);
    const lp = v.filter('lowpass', 500, 0.7);
    const ng = v.gain();
    n.connect(lp); lp.connect(ng); ng.connect(out);
    const e2 = decayEnv(ng.gain, t0, 0.002, peak * 0.5, 0.08);
    return Math.max(e1, e2);
}

function buildClap(ctx, v, t0, vel, out, peak, noiseBuf) {
    const n = v.noise(noiseBuf);
    const bp = v.filter('bandpass', 1900, 1.2);
    const g = v.gain();
    n.connect(bp); bp.connect(g); g.connect(out);
    const e1 = decayEnv(g.gain, t0, 0.002, peak, 0.05);
    const o = v.osc('triangle', 820);
    o.frequency.setValueAtTime(820, t0);
    o.frequency.exponentialRampToValueAtTime(500, t0 + 0.04);
    const og = v.gain();
    o.connect(og); og.connect(out);
    return Math.max(e1, decayEnv(og.gain, t0, 0.002, peak * 0.4, 0.04));
}

function buildCymbal(ctx, v, t0, vel, out, peak, noiseBuf) {
    const n = v.noise(noiseBuf);
    const hp = v.filter('highpass', 6000, 0.7);
    const g = v.gain();
    n.connect(hp); hp.connect(g); g.connect(out);
    return decayEnv(g.gain, t0, 0.01, peak, 0.8);
}

function startVoice(ctx, player, item, now) {
    const { ev, spb } = item;
    const t0 = Math.max(item.at, now + 0.005);
    const durS = ev.dur * spb;
    const perc = UNPITCHED.has(ev.inst) || ev.inst === 'gong';
    // Plafonds de polyphonie
    let active = 0;
    for (const v of S.voices) if (!v.perc && v.nominalEnd > t0) active++;
    if (!perc && active >= MAX_VOICES) return;
    if (S.voices.length >= MAX_NODES_VOICES && !(ev.inst === 'drum' || ev.inst === 'gong')) return;
    if (S.voices.length >= MAX_NODES_VOICES + 6) return;

    const v = newVoice(ctx, player, t0, t0 + durS, perc);
    const f = midiToFreq(ev.midi);
    const peak = ev.vel * (INST_GAIN[ev.inst] || 0.3);
    const noise = S.bus.noise;
    const out = player.out;
    let end;
    try {
        switch (ev.inst) {
            case 'guzheng': case 'pipa': case 'yangqin': case 'harp':
                end = buildPluck(ctx, v, ev.inst, f, t0, durS, ev.vel, ev.bend, out, peak); break;
            case 'dizi': case 'xiao': end = buildFlute(ctx, v, ev.inst, f, t0, durS, ev.vel, ev.bend, out, peak, noise); break;
            case 'erhu': end = buildErhu(ctx, v, f, t0, durS, ev.vel, ev.bend, out, peak); break;
            case 'sheng': end = buildSheng(ctx, v, f, t0, durS, ev.vel, out, peak); break;
            case 'suona': end = buildSuona(ctx, v, f, t0, durS, ev.vel, ev.bend, out, peak); break;
            case 'bell': end = buildBell(ctx, v, f, t0, ev.vel, out, peak); break;
            case 'gong': end = buildGong(ctx, v, f, t0, ev.vel, out, peak); break;
            case 'drum': end = buildDrum(ctx, v, f, t0, ev.vel, out, peak, noise); break;
            case 'clap': end = buildClap(ctx, v, t0, ev.vel, out, peak, noise); break;
            case 'cymbal': end = buildCymbal(ctx, v, t0, ev.vel, out, peak, noise); break;
            default: for (const n of v.nodes) safe(() => n.disconnect()); return;
        }
        finishVoice(v, end, S.bus, player);
    } catch (_) {
        for (const n of v.nodes) safe(() => n.disconnect());
    }
}

// ── Joueur de scène ─────────────────────────────────────────────────────────
function startPlayer(ctx, desired) {
    const now = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, now);
    out.gain.linearRampToValueAtTime(1, now + FADE_S);
    out.connect(S.bus.input);
    const p = {
        id: ++S.uid, key: desired.key, scene: desired.scene, biome: desired.biome, seed: desired.seed, variant: desired.variant, out,
        nextBar: 0, nextSectionAt: now + 0.12, queue: [], retiring: false, killAt: 0, holdSince: null
    };
    S.players.push(p);
    return p;
}
function retirePlayer(p, fadeS) {
    if (p.retiring) return;
    const ctx = S.busCtx;
    p.retiring = true;
    if (!ctx) { destroyPlayer(p); return; }
    const now = ctx.currentTime;
    p.queue.length = 0;
    rampOK(() => {
        p.out.gain.cancelScheduledValues(now);
        p.out.gain.setValueAtTime(p.out.gain.value, now);
        p.out.gain.linearRampToValueAtTime(0, now + Math.max(0.02, fadeS));
    });
    p.killAt = now + Math.max(0.02, fadeS) + 0.05;
}
function destroyPlayer(p) {
    const now = S.busCtx ? safe(() => S.busCtx.currentTime, 0) : 0;
    for (const v of S.voices.filter((x) => x.player === p)) killVoice(v, now);
    safe(() => p.out.disconnect());
    const i = S.players.indexOf(p);
    if (i >= 0) S.players.splice(i, 1);
}
function hardReset() {
    for (const p of S.players.slice()) destroyPlayer(p);
    for (const v of S.voices.slice()) killVoice(v, 0);
    destroyBus();
}

function updatePlayer(ctx, p, now, hold) {
    if (p.retiring) { if (now >= p.killAt) destroyPlayer(p); return; }
    // Gel du temps musical pendant pause / mute / onglet masqué
    if (hold) { if (p.holdSince === null) p.holdSince = now; }
    else if (p.holdSince !== null) {
        const dt = now - p.holdSince;
        p.nextSectionAt += dt;
        for (const it of p.queue) it.at += dt;
        p.holdSince = null;
    }
    if (hold) return;
    const horizon = now + S.ahead;
    let guard = 0;
    while (p.nextSectionAt <= horizon && guard++ < 4) {
        const sec = composeSection(p.scene, { biome: p.biome, seed: p.seed, variant: p.variant, bar: p.nextBar });
        const spb = 60 / sec.bpm;
        for (const ev of sec.events) p.queue.push({ at: p.nextSectionAt + ev.t * spb, ev, spb });
        p.queue.sort((a, b) => a.at - b.at);
        p.nextSectionAt += sec.lengthBeats * spb;
        p.nextBar += sec.bars;
    }
    if (p.nextSectionAt < now - 2) p.nextSectionAt = now + 0.05;
    while (p.queue.length && p.queue[0].at <= horizon) {
        const it = p.queue.shift();
        if (it.at < now - LATE_TOLERANCE) continue; // vraiment trop en retard : on saute
        startVoice(ctx, p, it, now);
    }
}

/** Élargit l'anticipation si le thread principal a laissé passer un trou entre deux ticks (appareil lent). */
function adaptLookahead(now) {
    const gap = now - S.lastTickAt;
    S.lastTickAt = now;
    if (gap > S.ahead * 0.6 && gap < 5) S.ahead = Math.min(AHEAD_MAX, Math.max(S.ahead, gap * 1.6));
}

function tickInner() {
    const ctx = safe(() => S.env.getContext(), null);
    if (ctx && (ctx.state === 'suspended' || ctx.state === 'interrupted')) safe(() => ctx.resume().catch(() => {}));
    if (!ctx || ctx.state === 'suspended' || ctx.state === 'interrupted' || ctx.state === 'closed') return; // on réessaiera
    if (S.busCtx && S.busCtx !== ctx) hardReset();
    const now = ctx.currentTime;
    adaptLookahead(now);

    const wantPlayer = S.desired !== null;
    if (!S.bus && wantPlayer) { S.bus = createBus(ctx); S.busCtx = ctx; }
    if (!S.bus) return;

    // Scène désirée vs scène courante
    const cur = S.players.find((p) => !p.retiring);
    if (S.desired && (!cur || cur.key !== S.desired.key)) {
        if (cur) retirePlayer(cur, FADE_S);
        startPlayer(ctx, S.desired);
    } else if (!S.desired && cur) {
        retirePlayer(cur, S.stopFade ?? FADE_S);
    }

    // Volume / mute / pause / visibilité
    const vol = clamp(Number(safe(() => S.env.getVolume(), 0)) || 0, 0, 1);
    const muted = Boolean(safe(() => S.env.isMuted(), false));
    const hold = muted || S.paused || vol <= 0 || !isForeground();
    const target = hold ? 0 : vol * MASTER_FACTOR;
    if (Math.abs(target - S.lastTarget) > 0.001) {
        rampOK(() => S.bus.master.gain.setTargetAtTime(target, now, hold ? 0.08 : 0.15));
        S.lastTarget = target;
    }

    for (const p of S.players.slice()) updatePlayer(ctx, p, now, hold);
    for (const v of S.voices.slice()) if (v.end + 0.1 < now) cleanupVoice(v);

    if (!S.desired && S.players.length === 0) {
        for (const v of S.voices.slice()) killVoice(v, now);
        destroyBus();
        stopTimer();
    }
}
function tick() { try { tickInner(); } catch (_) { /* jamais d'exception vers le jeu */ } }

function ensureTimer() {
    if (S.timerId !== null) return;
    S.timerId = safe(() => S.env.timer.set(tick, TICK_MS), null);
    if (S.timerId === null) S.timerId = -1;
    if (!S.listening && typeof document !== 'undefined' && document.addEventListener) {
        S.listening = true;
        document.addEventListener('visibilitychange', tick);
    }
}
function stopTimer() {
    if (S.timerId !== null && S.timerId !== -1) safe(() => S.env.timer.clear(S.timerId));
    S.timerId = null;
    if (S.listening && typeof document !== 'undefined') { safe(() => document.removeEventListener('visibilitychange', tick)); S.listening = false; }
}

// ── API publique ────────────────────────────────────────────────────────────
export function setMusicScene(sceneId, options = {}) {
    if (!SCENES[sceneId]) return false;
    const usesBiome = Boolean(SCENES[sceneId].biomes);
    const biome = usesBiome && BIOMES.includes(options && options.biome) ? options.biome : null;
    const seed = options && options.seed !== undefined ? options.seed : 1;
    const rawVariant = options && (sceneId === 'boss' ? options.boss ?? options.variant : sceneId === 'combat' ? options.variant : undefined);
    const variant = rawVariant === undefined || rawVariant === null || rawVariant === '' ? null : rawVariant;
    const key = `${sceneId}|${biome || ''}|${seed}|${variant ?? ''}`;
    if (S.desired && S.desired.key === key) return true;
    S.desired = { key, scene: sceneId, biome, seed, variant };
    S.stopFade = undefined;
    ensureTimer();
    tick();
    return true;
}

export function stopMusic({ fadeMs = 1200 } = {}) {
    S.desired = null;
    S.paused = false;
    S.stopFade = Math.max(0, Number(fadeMs) || 0) / 1000;
    const ctx = safe(() => S.env.getContext(), null);
    if (!S.bus || !ctx || ctx.state === 'suspended' || ctx.state === 'closed') { hardReset(); stopTimer(); return; }
    tick();
}

export function pauseMusic() { S.paused = true; tick(); }
export function resumeMusic() { S.paused = false; tick(); }

export function isMusicPlaying() {
    if (S.paused || !S.desired || !S.busCtx) return false;
    if (!S.players.some((p) => !p.retiring)) return false;
    return S.busCtx.state !== 'suspended';
}

/** Accès interne pour les tests (ordonnancement manuel, état). */
export const __internals = { tick, state: S, hardReset };
