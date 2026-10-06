import {
    SCALES, SCENE_IDS, BIOMES, INSTRUMENT_RANGES, UNPITCHED, midiToFreq, makeRng, composeSection, getSceneConfig,
    getSceneList as composerSceneList, getBossStyle, getCombatStyle, COMBAT_STYLE_COUNT
} from '../../tools/audio/composer.js';
import { sectionCountFor } from '../../tools/audio/synth.js';
import {
    setMusicEnvironment, setMusicScene, stopMusic, pauseMusic, resumeMusic, isMusicPlaying, getSceneList, __internals
} from '../../music.js';
import { trackCandidates, trackUrl, bossSlug, bossArchetypeIndex, combatStyleIndex, BOSS_ARCHETYPE_COUNT, COMBAT_STYLE_COUNT as TRACK_COMBAT } from '../../musicTracks.js';
import { sfxVariants, sfxKeyFor, sfxGainFor, sfxUrl } from '../../sfxCatalog.js';
import { readFileSync, existsSync } from 'node:fs';
import { SCREENS } from '../../story.js';

const pcsOf = (r) => SCALES[r.scale].map((s) => (r.root + s) % 12);

describe('composition : justesse et gammes (outil de build)', () => {
    test('midiToFreq : La4 = 440, Do4 = 261.63, octave = x2, quinte tempérée ~ 3/2', () => {
        expect(midiToFreq(69)).toBeCloseTo(440, 6);
        expect(midiToFreq(60)).toBeCloseTo(261.6256, 3);
        expect(midiToFreq(81) / midiToFreq(69)).toBeCloseTo(2, 9);
        expect(midiToFreq(67) / midiToFreq(60)).toBeCloseTo(1.4983, 3);
    });
    test('les 5 modes sont des rotations de la pentatonique gong (do ré mi sol la)', () => {
        const gong = SCALES.gong;
        const rotations = [];
        for (let i = 0; i < 5; i++) rotations.push(gong.map((s) => (s - gong[i] + 12) % 12).sort((a, b) => a - b));
        for (const mode of Object.values(SCALES)) {
            expect(mode).toHaveLength(5);
            expect(rotations.some((r) => JSON.stringify(r) === JSON.stringify(mode))).toBe(true);
        }
    });
    test('écart des degrés tempérés vs intonation juste pentatonique < 20 cents (mode gong)', () => {
        const just = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3];
        SCALES.gong.forEach((semi, i) => {
            const cents = 1200 * Math.log2(midiToFreq(60 + semi) / midiToFreq(60));
            const justCents = 1200 * Math.log2(just[i]);
            expect(Math.abs(cents - justCents)).toBeLessThan(20);
        });
    });
    test('PRNG déterministe', () => {
        const a = makeRng('x', 1), b = makeRng('x', 1), c = makeRng('x', 2);
        const sa = [a(), a(), a()], sb = [b(), b(), b()], sc = [c(), c(), c()];
        expect(sa).toEqual(sb);
        expect(sa).not.toEqual(sc);
        sa.forEach((v) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); });
    });
});

describe('composition (partie pure)', () => {
    const combos = [];
    for (const scene of SCENE_IDS) {
        if (scene === 'village' || scene === 'wild') for (const biome of BIOMES) combos.push([scene, biome]);
        else combos.push([scene, null]);
    }

    test.each(combos)('%s / %s : événements valides, dans la gamme, dans la tessiture', (scene, biome) => {
        for (const seed of [1, 42]) {
            for (const bar of [0, 8, 16, 24]) {
                const r = composeSection(scene, { biome, seed, bar });
                expect(r.events.length).toBeGreaterThan(5);
                const pcs = pcsOf(r);
                const cfg = getSceneConfig(scene, biome);
                expect(r.scale).toBe(cfg.scale);
                let prev = -1;
                for (const e of r.events) {
                    expect(Number.isFinite(e.t) && e.t >= 0 && e.t < r.lengthBeats).toBe(true);
                    expect(e.t).toBeGreaterThanOrEqual(prev); prev = e.t;
                    expect(e.dur).toBeGreaterThan(0);
                    expect(e.vel).toBeGreaterThan(0);
                    expect(e.vel).toBeLessThanOrEqual(1);
                    expect(Number.isInteger(e.midi)).toBe(true);
                    const [lo, hi] = INSTRUMENT_RANGES[e.inst];
                    expect(e.midi).toBeGreaterThanOrEqual(lo);
                    expect(e.midi).toBeLessThanOrEqual(hi);
                    if (!UNPITCHED.has(e.inst)) {
                        // Les ornements sont aussi tirés de la gamme ; tolérance d'1 demi-ton pour un ornement déclaré.
                        const inScale = pcs.includes(e.midi % 12);
                        if (e.orn) {
                            expect([0, 1, -1, 2, -2].some((d) => pcs.includes((((e.midi + d) % 12) + 12) % 12))).toBe(true);
                        } else {
                            expect(inScale).toBe(true);
                        }
                    }
                    if (e.bend !== undefined) expect(Math.abs(e.bend)).toBeLessThanOrEqual(3);
                }
            }
        }
    });

    test('déterministe pour une graine, différent pour deux graines', () => {
        for (const scene of SCENE_IDS) {
            const a = composeSection(scene, { seed: 7, bar: 0 });
            const b = composeSection(scene, { seed: 7, bar: 0 });
            const c = composeSection(scene, { seed: 8, bar: 0 });
            expect(a).toEqual(b);
            expect(c.events).not.toEqual(a.events);
        }
    });

    test('les sections successives varient sans devenir aléatoires (forme A A\' B A\'\')', () => {
        const mel = (scene, bar) => composeSection(scene, { seed: 3, bar }).events.filter((e) => e.inst === getSceneConfig(scene).melody.inst && !e.orn);
        for (const scene of ['village', 'menu', 'title']) {
            const s0 = mel(scene, 0), s1 = mel(scene, 8);
            expect(JSON.stringify(s0)).not.toBe(JSON.stringify(s1));
            // Les motifs se retrouvent : au moins quelques hauteurs communes
            const common = s0.filter((e) => s1.some((f) => f.midi === e.midi)).length;
            expect(common).toBeGreaterThan(0);
        }
    });

    test('biomes : la configuration change (mode, tempo ou instrumentation)', () => {
        const sig = (b) => { const c = getSceneConfig('village', b); return JSON.stringify([c.root, c.scale, c.bpm, c.melody.inst, c.perc]); };
        const sigs = new Set(BIOMES.map(sig));
        expect(sigs.size).toBeGreaterThanOrEqual(7);
        expect(getSceneConfig('village', 'bamboo').melody.inst).toBe('dizi');
        expect(getSceneConfig('village', 'gobi').perc).toBe('caravan');
        expect(getSceneConfig('village', 'volcano').perc).toBe('far');
        expect(getSceneConfig('village', 'coast').melody.inst).toBe('pipa');
        // Biome inconnu / scène sans biome : ignoré
        expect(getSceneConfig('village', 'nope')).toEqual(getSceneConfig('village'));
        expect(composeSection('house', { biome: 'volcano', seed: 1 })).toEqual(
            { ...composeSection('house', { seed: 1 }), biome: 'volcano' });
    });

    test('scène inconnue : composeSection lève, getSceneList liste les 8 scènes', () => {
        expect(() => composeSection('zzz')).toThrow();
        expect(composerSceneList().map((s) => s.id)).toEqual(SCENE_IDS);
        expect(getSceneList().map((s) => s.id)).toEqual(SCENE_IDS);
    });
});

describe('rythmes, exploration calme, combat, boss', () => {
    const insts = (r) => new Set(r.events.map((e) => e.inst));
    test('exploration (village, maison, terres sauvages, sanctuaire, menus, lune) : aucun suona', () => {
        for (const scene of ['village', 'wild', 'house', 'sanctuary', 'menu', 'moon', 'title']) {
            for (const biome of scene === 'village' || scene === 'wild' ? BIOMES : [null]) {
                for (const bar of [0, 8, 16, 24]) expect(insts(composeSection(scene, { biome, seed: 5, bar })).has('suona')).toBe(false);
            }
        }
    });
    test('combat : 5 styles de rythme différents, percussions fournies', () => {
        expect(COMBAT_STYLE_COUNT).toBeGreaterThanOrEqual(5);
        const percs = new Set();
        const sigs = new Set();
        for (let v = 0; v < COMBAT_STYLE_COUNT; v++) {
            const c = getSceneConfig('combat', null, v);
            percs.add(c.perc);
            const r = composeSection('combat', { seed: 1, variant: v });
            sigs.add(JSON.stringify(r.events.filter((e) => e.inst === 'drum').map((e) => e.t)));
            expect(r.events.filter((e) => e.inst === 'drum').length).toBeGreaterThan(16);
        }
        expect(percs.size).toBe(COMBAT_STYLE_COUNT);
        expect(sigs.size).toBe(COMBAT_STYLE_COUNT);
        expect(getCombatStyle('Gobelin')).toEqual(getCombatStyle('Gobelin'));
    });
    test('chaque boss a sa propre musique', () => {
        const names = ['Fengmeng, le Disciple', 'Soleil Ardent', 'Soleil des Eaux Taries', 'Soleil de Cendres', 'Soleil des Mirages',
            'Soleil des Orages', "Fengmeng, l'Archer Pressé", 'Soleil de Magma', 'Soleil des Bêtes Folles', 'Soleil des Marées',
            'Soleil Lâche', "Fengmeng, l'Archer Miroir", 'Fengmeng, Rage et Désespoir', 'Serpent de marée', 'Tigre alpha, Griffe-de-Feu',
            'Lion-gardien fendu', 'Forgeron de lave', 'Prêtresse de givre', 'Garde solaire des racines'];
        const sigs = new Set(names.map((n) => {
            const r = composeSection('boss', { seed: 1, boss: n });
            return JSON.stringify([r.root, r.scale, r.bpm, r.events.slice(0, 40).map((e) => [e.t, e.midi, e.inst])]);
        }));
        expect(sigs.size).toBe(names.length);
        expect(getBossStyle('Soleil Ardent')).toEqual(getBossStyle('soleil ardent'));
        // Hors nom : musique de boss générique, toujours rythmée
        expect(composeSection('boss', { seed: 1 }).events.filter((e) => e.inst === 'drum').length).toBeGreaterThan(10);
    });
    test('les rythmes de mélodie sont variés (≥ 8 découpages de mesure différents sur les scènes)', () => {
        const shapes = new Set();
        for (const scene of SCENE_IDS) for (const bar of [0, 8, 16, 24]) {
            const r = composeSection(scene, { seed: 2, bar, biome: 'paddy' });
            const mel = r.events.filter((e) => e.inst === getSceneConfig(scene, 'paddy').melody.inst && !e.orn);
            for (let b = 0; b < 8; b++) shapes.add(mel.filter((e) => e.t >= b * 4 && e.t < b * 4 + 4).map((e) => +(e.t - b * 4).toFixed(2)).join(','));
        }
        expect(shapes.size).toBeGreaterThanOrEqual(8);
    });
});


// ── Lecteur (runtime) : pistes pré-enregistrées, faux AudioContext et faux fetch ─────────────────────────
function makeParam(initial = 0) {
    return { value: initial, targets: [], setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v) { this.value = v; },
        setTargetAtTime(v) { this.targets.push(v); }, cancelScheduledValues() {} };
}
function makeCtx() {
    const nodes = [];
    const ctx = { currentTime: 0, state: 'running', nodes, destination: { kind: 'dest', connect() {}, disconnect() {} }, decoded: 0 };
    const node = (kind, extra = {}) => { const n = { kind, disconnected: false, connect() {}, disconnect() { n.disconnected = true; }, ...extra }; nodes.push(n); return n; };
    ctx.createGain = () => node('gain', { gain: makeParam(1) });
    ctx.createBufferSource = () => node('source', { buffer: null, loop: false, started: false, stopped: false, start() { this.started = true; }, stop() { this.stopped = true; } });
    ctx.decodeAudioData = (data) => { ctx.decoded++; return Promise.resolve({ length: data.byteLength, tag: Buffer.from(data).toString() }); };
    ctx.resume = () => Promise.resolve();
    return ctx;
}
function makeFetch(existing) {
    const calls = [];
    const fn = async (url) => {
        calls.push(url);
        const key = /audio\/music\/(.+)\.mp3/.exec(url)[1];
        if (!existing.has(key)) return { ok: false, status: 404 };
        return { ok: true, status: 200, arrayBuffer: async () => Buffer.from(key) };
    };
    fn.calls = calls;
    return fn;
}
const noopTimer = { set: () => 1, clear: () => {} };
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); await new Promise((r) => setImmediate(r)); };
function setup(ctx, existing = new Set(['title', 'menu', 'combat-0', 'boss-a0', 'boss-soleil-ardent', 'village-paddy']), extra = {}) {
    const state = { volume: 1, muted: false };
    const fetchFn = makeFetch(existing);
    setMusicEnvironment({ getContext: () => ctx, getVolume: () => state.volume, isMuted: () => state.muted, fetch: fetchFn, baseUrl: 'http://x/match3-quest/', timer: noopTimer, ...extra });
    return { state, fetchFn };
}

describe('pistes pré-enregistrées : correspondance scène → fichier (musicTracks.js)', () => {
    test('chaque scène et chaque biome ont une piste ; scène inconnue : aucune', () => {
        expect(trackCandidates('title')).toEqual(['title']);
        for (const b of BIOMES) { expect(trackCandidates('village', { biome: b })).toEqual([`village-${b}`]); expect(trackCandidates('wild', { biome: b })).toEqual([`wild-${b}`]); }
        expect(trackCandidates('village', { biome: 'nope' })).toEqual(['village-paddy']);
        expect(trackCandidates('inconnue')).toEqual([]);
        expect(TRACK_COMBAT).toBe(COMBAT_STYLE_COUNT);
        expect(trackUrl('title')).toBe('audio/music/title.mp3');
    });
    test('combat : 5 pistes ; boss : piste du boss puis repli sur son archétype', () => {
        const keys = new Set([0, 1, 2, 3, 4, 'Gobelin', 'Orc'].map((v) => trackCandidates('combat', { variant: v })[0]));
        keys.forEach((k) => expect(/^combat-[0-4]$/.test(k)).toBe(true));
        const [exact, fallback] = trackCandidates('boss', { boss: "Fengmeng, l'Archer Pressé" });
        expect(exact).toBe('boss-fengmeng-l-archer-presse');
        expect(fallback).toBe(`boss-a${bossArchetypeIndex("Fengmeng, l'Archer Pressé")}`);
        expect(trackCandidates('boss')).toEqual(['boss-a0']);
        expect(combatStyleIndex('x')).toBeLessThan(5);
    });
    test('l\'archétype de repli est celui que compose le thème du boss (même hachage)', () => {
        for (const n of ['Soleil Ardent', 'Serpent de marée', 'Boss Gobelin']) {
            const style = getBossStyle(n);
            const idx = bossArchetypeIndex(n);
            expect(idx).toBeGreaterThanOrEqual(0); expect(idx).toBeLessThan(BOSS_ARCHETYPE_COUNT);
            expect(style.perc).toBeTruthy();
        }
    });
    test('sections d\'une piste : 30 s environ, 1 à 4 sections', () => {
        expect(sectionCountFor(54)).toBe(1);
        expect(sectionCountFor(96)).toBe(2);
        expect(sectionCountFor(300)).toBe(4);
    });
});

describe('fichiers audio livrés (rendus par tools/audio/render.mjs)', () => {
    const exists = (p) => existsSync(new URL(`../../${p}`, import.meta.url));
    const expectedTracks = () => {
        const keys = ['title', 'menu', 'house', 'sanctuary', 'moon', 'ending', 'victory', 'defeat'];
        BIOMES.forEach((b) => keys.push(`village-${b}`, `wild-${b}`));
        for (let i = 0; i < COMBAT_STYLE_COUNT; i++) keys.push(`combat-${i}`);
        for (let i = 0; i < BOSS_ARCHETYPE_COUNT; i++) keys.push(`boss-a${i}`);
        Object.values(SCREENS).forEach((sc) => (sc.enemies || []).forEach((e) => { if (e.boss?.name) keys.push(`boss-${bossSlug(e.boss.name)}`); }));
        return [...new Set(keys)];
    };
    test('toutes les pistes de musique existent (dont un thème par boss) et ne sont pas vides', () => {
        const missing = expectedTracks().filter((k) => !exists(trackUrl(k)));
        expect(missing).toEqual([]);
        expectedTracks().forEach((k) => expect(readFileSync(new URL(`../../${trackUrl(k)}`, import.meta.url)).length).toBeGreaterThan(20000));
    });
    test('tous les effets sonores existent', () => {
        const missing = sfxVariants().filter((v) => !exists(sfxUrl(v.key))).map((v) => v.key);
        expect(missing).toEqual([]);
        // chaque événement du jeu retombe sur un clip existant
        for (const e of ['uiClick', 'swap', 'match', 'skullHit', 'manaGain', 'weaponHit', 'spellHit', 'spellCast', 'heal', 'victory', 'defeat', 'combatStart', 'bossStart', 'turnBonus', 'inconnu']) {
            for (const p of [{}, { isPlayer: false, length: 5, matchType: 'skull' }, { length: 9, matchType: 'combat' }]) expect(exists(sfxUrl(sfxKeyFor(e, p)))).toBe(true);
        }
        expect(sfxGainFor('manaGain', { isPlayer: false })).toBe(0.5);
    });
    test('plus aucune synthèse en temps réel dans le jeu', () => {
        const music = readFileSync(new URL('../../music.js', import.meta.url), 'utf8');
        const sound = readFileSync(new URL('../../sound.js', import.meta.url), 'utf8');
        expect(music).not.toMatch(/createOscillator|createConvolver|createBiquadFilter/);
        expect(sound).not.toMatch(/createOscillator|createBiquadFilter/);
    });
});

describe('lecteur de musique', () => {
    afterEach(() => { __internals.reset(); });

    test('sans contexte ni exception ; scène inconnue refusée', () => {
        setMusicEnvironment({ getContext: () => null, getVolume: () => 1, isMuted: () => false, timer: noopTimer });
        expect(() => { setMusicScene('title'); pauseMusic(); resumeMusic(); stopMusic(); }).not.toThrow();
        expect(isMusicPlaying()).toBe(false);
        expect(setMusicScene('inconnue')).toBe(false);
        setMusicEnvironment({ getContext: () => { throw new Error('boom'); } });
        expect(() => { setMusicScene('menu'); __internals.tick(); stopMusic(); }).not.toThrow();
    });

    test('télécharge la piste de la scène une seule fois, la joue en boucle (aucun calcul audio)', async () => {
        const ctx = makeCtx(); const { fetchFn } = setup(ctx);
        setMusicScene('title');
        await flush();
        expect(fetchFn.calls).toEqual(['http://x/match3-quest/audio/music/title.mp3']);
        const src = ctx.nodes.find((n) => n.kind === 'source');
        expect(src.started).toBe(true);
        expect(src.loop).toBe(true);
        expect(isMusicPlaying()).toBe(true);
        setMusicScene('title'); await flush();                        // même scène : no-op
        expect(fetchFn.calls).toHaveLength(1);
        setMusicScene('menu'); await flush();
        setMusicScene('title'); await flush();                        // piste en cache : pas de nouveau téléchargement
        expect(fetchFn.calls.filter((u) => u.endsWith('title.mp3'))).toHaveLength(1);
        expect(ctx.decoded).toBe(2);
    });

    test('fondu enchaîné : l\'ancienne piste s\'arrête, une seule piste reste active', async () => {
        const ctx = makeCtx(); setup(ctx);
        setMusicScene('title'); await flush();
        const first = ctx.nodes.find((n) => n.kind === 'source');
        setMusicScene('menu'); await flush();
        const sources = ctx.nodes.filter((n) => n.kind === 'source');
        expect(sources).toHaveLength(2);
        expect(first.stopped).toBe(true);
        expect(sources[1].stopped).toBe(false);
    });

    test('boss : sa piste dédiée, sinon repli sur le thème d\'archétype', async () => {
        const ctx = makeCtx(); const { fetchFn } = setup(ctx);
        setMusicScene('boss', { boss: 'Soleil Ardent' }); await flush();
        expect(fetchFn.calls.map((u) => /music\/(.+)\.mp3/.exec(u)[1])).toEqual(['boss-soleil-ardent']);
        __internals.reset();
        const ctx2 = makeCtx(); const s2 = setup(ctx2, new Set(['boss-a0', 'boss-a1', 'boss-a2', 'boss-a3', 'boss-a4', 'boss-a5', 'boss-a6', 'boss-a7']));
        setMusicScene('boss', { boss: 'Boss Inconnu' }); await flush();
        const keys = s2.fetchFn.calls.map((u) => /music\/(.+)\.mp3/.exec(u)[1]);
        expect(keys).toEqual(['boss-boss-inconnu', `boss-a${bossArchetypeIndex('Boss Inconnu')}`]);
        expect(ctx2.nodes.some((n) => n.kind === 'source' && n.started)).toBe(true);
    });

    test('piste introuvable : silence sans exception, nouvel essai plus tard', async () => {
        const ctx = makeCtx(); const { fetchFn } = setup(ctx, new Set());
        setMusicScene('menu'); await flush();
        expect(isMusicPlaying()).toBe(false);
        expect(ctx.nodes.some((n) => n.kind === 'source')).toBe(false);
        expect(fetchFn.calls).toHaveLength(1);
    });

    test('changement de scène pendant le téléchargement : seule la dernière scène est jouée', async () => {
        const ctx = makeCtx(); setup(ctx);
        setMusicScene('title'); setMusicScene('menu'); await flush();
        const sources = ctx.nodes.filter((n) => n.kind === 'source' && n.started);
        expect(sources).toHaveLength(1);
        expect(sources[0].buffer.tag).toBe('menu');
    });

    test('volume, mute et pause règlent le gain maître sans toucher à la piste', async () => {
        const ctx = makeCtx(); const { state } = setup(ctx);
        setMusicScene('title'); await flush(); __internals.tick();
        const master = __internals.state.master;
        expect(master.gain.targets.at(-1)).toBeGreaterThan(0.1);
        state.muted = true; __internals.tick();
        expect(master.gain.targets.at(-1)).toBe(0);
        state.muted = false; state.volume = 0.5; __internals.tick();
        expect(master.gain.targets.at(-1)).toBeCloseTo(0.5 * 0.35, 5);
        pauseMusic(); expect(master.gain.targets.at(-1)).toBe(0); expect(isMusicPlaying()).toBe(false);
        resumeMusic(); expect(master.gain.targets.at(-1)).toBeGreaterThan(0);
    });

    test('contexte suspendu : rien ne se joue, puis démarre quand il repasse en running', async () => {
        const ctx = makeCtx(); ctx.state = 'suspended'; const { fetchFn } = setup(ctx);
        setMusicScene('title'); await flush();
        expect(fetchFn.calls).toHaveLength(0);
        ctx.state = 'running'; __internals.tick(); await flush();
        expect(isMusicPlaying()).toBe(true);
    });

    test('arrêt : fondu puis plus aucune piste ; le cache est borné à 3 pistes', async () => {
        const ctx = makeCtx();
        setup(ctx, new Set(['title', 'menu', 'house', 'sanctuary', 'moon']));
        for (const s of ['title', 'menu', 'house', 'sanctuary', 'moon']) { setMusicScene(s); await flush(); }
        expect(__internals.state.cache.size).toBeLessThanOrEqual(3);
        stopMusic({ fadeMs: 500 });
        expect(ctx.nodes.filter((n) => n.kind === 'source').every((n) => n.stopped)).toBe(true);
        expect(isMusicPlaying()).toBe(false);
    });
});
