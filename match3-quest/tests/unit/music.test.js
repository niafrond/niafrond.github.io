import {
    SCALES, SCENE_IDS, BIOMES, INSTRUMENT_RANGES, UNPITCHED, midiToFreq, makeRng, composeSection, getSceneConfig,
    getSceneList, setMusicEnvironment, setMusicScene, stopMusic, pauseMusic, resumeMusic, isMusicPlaying, __internals
} from '../../music.js';

// ── Faux AudioContext : enregistre les nœuds, simule le temps ───────────────
function makeParam(initial = 0) {
    const p = {
        value: initial, calls: [], targets: [],
        setValueAtTime(v) { p.value = v; p.calls.push(['set', v]); },
        linearRampToValueAtTime(v) { p.value = v; p.calls.push(['lin', v]); },
        exponentialRampToValueAtTime(v) { p.calls.push(['exp', v]); },
        setTargetAtTime(v) { p.targets.push(v); },
        cancelScheduledValues() {}
    };
    return p;
}
function makeCtx() {
    const nodes = [];
    const ctx = {
        currentTime: 0, state: 'running', sampleRate: 8000, nodes,
        destination: { kind: 'destination', connect() {}, disconnect() {} }
    };
    const base = (kind, extra = {}) => {
        const n = {
            kind, connections: 0, disconnected: false,
            connect(dest) { n.connections++; return dest; },
            disconnect() { n.disconnected = true; },
            ...extra
        };
        nodes.push(n);
        return n;
    };
    const src = (kind, extra = {}) => base(kind, {
        started: false, stopped: false, startAt: 0, stopAt: 0,
        start(t) { if (this.started) throw new Error('start 2x'); this.started = true; this.startAt = t; },
        stop(t) { this.stopped = true; this.stopAt = this.stopAt ? Math.min(this.stopAt, t) : t; },
        ...extra
    });
    ctx.createGain = () => base('gain', { gain: makeParam(1) });
    ctx.createOscillator = () => src('osc', { type: 'sine', frequency: makeParam(440), detune: makeParam(0) });
    ctx.createBufferSource = () => src('buf', { buffer: null, loop: false });
    ctx.createBiquadFilter = () => base('filter', { type: 'lowpass', frequency: makeParam(350), Q: makeParam(1), gain: makeParam(0) });
    ctx.createConvolver = () => base('convolver', { buffer: null });
    ctx.createDynamicsCompressor = () => base('comp');
    ctx.createBuffer = (ch, len, rate) => ({ length: len, sampleRate: rate, getChannelData: () => new Float32Array(len) });
    return ctx;
}
const noopTimer = { set: () => 1, clear: () => {} };

function setup(ctx, opts = {}) {
    const state = { volume: opts.volume ?? 1, muted: false };
    setMusicEnvironment({ getContext: () => ctx, getVolume: () => state.volume, isMuted: () => state.muted, timer: noopTimer });
    return state;
}
function run(ctx, seconds, step = 0.05) {
    for (let t = 0; t < seconds; t += step) { ctx.currentTime += step; __internals.tick(); }
}
function leaks(ctx) {
    const srcs = ctx.nodes.filter((n) => n.kind === 'osc' || n.kind === 'buf');
    const unstopped = srcs.filter((n) => n.started && !n.stopped);
    const connected = ctx.nodes.filter((n) => n.connections > 0 && !n.disconnected);
    return { unstopped, connected, srcs };
}

const pcsOf = (r) => SCALES[r.scale].map((s) => (r.root + s) % 12);

describe('justesse et gammes', () => {
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
        expect(getSceneConfig('village', 'volcano').perc).toBe('taiko');
        expect(getSceneConfig('village', 'coast').melody.inst).toBe('pipa');
        // Biome inconnu / scène sans biome : ignoré
        expect(getSceneConfig('village', 'nope')).toEqual(getSceneConfig('village'));
        expect(composeSection('house', { biome: 'volcano', seed: 1 })).toEqual(
            { ...composeSection('house', { seed: 1 }), biome: 'volcano' });
    });

    test('scène inconnue : composeSection lève, getSceneList liste les 8 scènes', () => {
        expect(() => composeSection('zzz')).toThrow();
        expect(getSceneList().map((s) => s.id)).toEqual(SCENE_IDS);
    });
});

describe('moteur audio (faux AudioContext)', () => {
    afterEach(() => { __internals.hardReset(); __internals.state.desired = null; __internals.state.players = []; stopMusic({ fadeMs: 0 }); });

    test('sans contexte ni exception', () => {
        setMusicEnvironment({ getContext: () => null, getVolume: () => 1, isMuted: () => false, timer: noopTimer });
        expect(() => { setMusicScene('title'); pauseMusic(); resumeMusic(); stopMusic(); }).not.toThrow();
        expect(isMusicPlaying()).toBe(false);
        expect(setMusicScene('inconnue')).toBe(false);
        setMusicEnvironment({ getContext: () => { throw new Error('boom'); } });
        expect(() => { setMusicScene('menu'); __internals.tick(); stopMusic(); }).not.toThrow();
    });

    test('contexte suspendu : rien n\'est créé, puis démarre quand il passe en running', () => {
        const ctx = makeCtx(); ctx.state = 'suspended';
        setup(ctx);
        setMusicScene('village', { biome: 'bamboo' });
        run(ctx, 1);
        expect(ctx.nodes.length).toBe(0);
        expect(isMusicPlaying()).toBe(false);
        ctx.state = 'running';
        run(ctx, 2);
        expect(isMusicPlaying()).toBe(true);
        expect(ctx.nodes.some((n) => n.kind === 'osc' && n.started)).toBe(true);
        stopMusic({ fadeMs: 100 });
        run(ctx, 1);
    });

    test.each(SCENE_IDS)('%s : 60 s simulées sans exception ni fuite', (scene) => {
        const ctx = makeCtx(); setup(ctx);
        let maxAlive = 0;
        setMusicScene(scene, { biome: scene === 'wild' || scene === 'village' ? 'volcano' : undefined });
        for (let t = 0; t < 60; t += 0.05) {
            ctx.currentTime += 0.05; __internals.tick();
            const alive = ctx.nodes.filter((n) => (n.kind === 'osc' || n.kind === 'buf') && n.started && !n.disconnected && n.stopAt > ctx.currentTime && n.startAt <= ctx.currentTime).length;
            maxAlive = Math.max(maxAlive, alive);
        }
        expect(isMusicPlaying()).toBe(true);
        expect(maxAlive).toBeGreaterThan(0);
        expect(maxAlive).toBeLessThan(90); // charge CPU bornée
        // Nœuds vivants à tout moment bornés (pas de croissance)
        expect(__internals.state.voices.length).toBeLessThanOrEqual(30);
        stopMusic({ fadeMs: 500 });
        run(ctx, 2);
        const l = leaks(ctx);
        expect(l.srcs.length).toBeGreaterThan(0);
        expect(l.unstopped).toHaveLength(0);
        expect(l.connected).toHaveLength(0);
        expect(__internals.state.voices).toHaveLength(0);
        expect(__internals.state.players).toHaveLength(0);
        expect(__internals.state.bus).toBeNull();
        expect(isMusicPlaying()).toBe(false);
    });

    test('fondu enchaîné, no-op sur même scène, aucune fuite après changements de scène', () => {
        const ctx = makeCtx(); setup(ctx);
        setMusicScene('title'); run(ctx, 3);
        const n0 = ctx.nodes.length;
        setMusicScene('title'); // no-op
        expect(__internals.state.players).toHaveLength(1);
        setMusicScene('village', { biome: 'paddy' }); run(ctx, 0.3);
        expect(__internals.state.players).toHaveLength(2); // ancien en fondu + nouveau
        run(ctx, 2);
        expect(__internals.state.players).toHaveLength(1);
        setMusicScene('village', { biome: 'paddy' });
        expect(__internals.state.players).toHaveLength(1);
        setMusicScene('village', { biome: 'coast' }); run(ctx, 3);
        setMusicScene('house'); run(ctx, 3);
        expect(ctx.nodes.length).toBeGreaterThan(n0);
        stopMusic({ fadeMs: 300 }); run(ctx, 2);
        const l = leaks(ctx);
        expect(l.unstopped).toHaveLength(0);
        expect(l.connected).toHaveLength(0);
    });

    test('volume : gain maître = 0,5 x volume ; mute et pause -> 0 ; reprise', () => {
        const ctx = makeCtx(); const st = setup(ctx, { volume: 0.8 });
        setMusicScene('menu'); run(ctx, 1);
        const master = __internals.state.bus.master.gain;
        expect(master.targets[master.targets.length - 1]).toBeCloseTo(0.4, 5);
        st.muted = true; run(ctx, 0.2);
        expect(master.targets[master.targets.length - 1]).toBe(0);
        const started = ctx.nodes.filter((n) => n.started).length;
        run(ctx, 3); // silencieux : aucune nouvelle voix
        expect(ctx.nodes.filter((n) => n.started).length).toBe(started);
        st.muted = false; st.volume = 0.2; run(ctx, 1);
        expect(master.targets[master.targets.length - 1]).toBeCloseTo(0.1, 5);
        pauseMusic(); run(ctx, 0.2);
        expect(master.targets[master.targets.length - 1]).toBe(0);
        expect(isMusicPlaying()).toBe(false);
        resumeMusic(); run(ctx, 1);
        expect(isMusicPlaying()).toBe(true);
        expect(ctx.nodes.filter((n) => n.started).length).toBeGreaterThan(started);
        stopMusic({ fadeMs: 100 }); run(ctx, 1);
    });

    test('changement de contexte : ancien graphe nettoyé', () => {
        const a = makeCtx(); let cur = a;
        setMusicEnvironment({ getContext: () => cur, getVolume: () => 1, isMuted: () => false, timer: noopTimer });
        setMusicScene('moon'); run(a, 2);
        const b = makeCtx(); cur = b;
        run(b, 2);
        expect(leaks(a).unstopped).toHaveLength(0);
        expect(b.nodes.some((n) => n.started)).toBe(true);
        stopMusic({ fadeMs: 0 }); run(b, 1);
        expect(leaks(b).unstopped).toHaveLength(0);
    });
});
