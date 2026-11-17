/**
 * synth.js — Synthèse WebAudio des instruments chinois — OUTIL DE BUILD (rendu hors ligne), pas chargé par le jeu.
 *
 * `renderLoop(OfflineAudioContext, ...)` programme toutes les notes d'une scène sur un contexte hors ligne et renvoie des
 * échantillons parfaitement bouclables que tools/audio/render.mjs encode en MP3 (rendu une fois pour toutes : aucun calcul
 * audio pendant le jeu).
 */
import { composeSection, midiToFreq, UNPITCHED, makeRng } from './composer.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const safe = (fn, fallback) => { try { return fn(); } catch (_) { return fallback; } };
export const MASTER_GAIN = 0.5;

const INST_GAIN = {
    erhu: 0.3, dizi: 0.3, xiao: 0.34, guzheng: 0.4, pipa: 0.36, yangqin: 0.34, harp: 0.36,
    sheng: 0.16, suona: 0.16, bell: 0.24, gong: 0.4, drum: 0.75, clap: 0.35, cymbal: 0.14
};


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
    const master = ctx.createGain(); master.gain.value = MASTER_GAIN;
    const comp = ctx.createDynamicsCompressor();
    const rv = ctx.createConvolver(); rv.buffer = makeImpulse(ctx);
    const send = ctx.createGain(); send.gain.value = 0.3;
    const wet = ctx.createGain(); wet.gain.value = 1;
    input.connect(master); input.connect(send); send.connect(rv); rv.connect(wet); wet.connect(master);
    master.connect(comp); comp.connect(ctx.destination);
    return { input, master, comp, rv, send, wet, noise: makeNoise(ctx), nodes: [input, master, comp, rv, send, wet] };
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
}
function cleanupVoice(v) {
    if (v.done) return;
    v.done = true;
    for (const n of v.nodes) safe(() => n.disconnect());
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
    const v = newVoice(ctx, player, t0, t0 + durS, perc);
    const f = midiToFreq(ev.midi);
    const peak = ev.vel * (INST_GAIN[ev.inst] || 0.3);
    const noise = player.bus.noise;
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
        finishVoice(v, end, player.bus, player);
    } catch (_) {
        for (const n of v.nodes) safe(() => n.disconnect());
    }
}


// ── Rendu hors ligne d'une scène en boucle ──────────────────────────────────
const SECTION_BEATS = 32;

/** Nombre de sections (8 mesures) d'une piste : environ `targetSeconds` de musique, entre 1 et 4. */
export function sectionCountFor(bpm, targetSeconds = 30) {
    return clamp(Math.ceil(targetSeconds / (SECTION_BEATS * 60 / bpm)), 1, 4);
}

/**
 * Rend `sceneId` en une boucle parfaitement bouclable : la queue de résonance (après la fin de la boucle) est ajoutée au
 * début, puis le niveau est normalisé (crête = `peak`).
 * @returns {{samples: Float32Array, sampleRate: number, loopSeconds: number, sections: number}} (mono)
 */
export async function renderLoop(OfflineCtor, sceneId, opts = {}, { sampleRate = 32000, targetSeconds = 30, tailSeconds = 2.5, peak = 0.89 } = {}) {
    const first = composeSection(sceneId, { ...opts, bar: 0 });
    const sections = sectionCountFor(first.bpm, targetSeconds);
    const composed = [];
    for (let k = 0; k < sections; k++) composed.push(composeSection(sceneId, { ...opts, bar: k * 8 }));
    const loopSeconds = composed.reduce((t, sec) => t + sec.lengthBeats * 60 / sec.bpm, 0);

    const ctx = new OfflineCtor(1, Math.ceil((loopSeconds + tailSeconds) * sampleRate), sampleRate);
    const bus = createBus(ctx);
    const out = ctx.createGain();
    out.connect(bus.input);
    const player = { out, bus, offline: true };
    let at = 0;
    for (const sec of composed) {
        const spb = 60 / sec.bpm;
        for (const ev of sec.events) startVoice(ctx, player, { at: at + ev.t * spb, ev, spb }, 0);
        at += sec.lengthBeats * spb;
    }
    const rendered = await ctx.startRendering();
    const data = rendered.getChannelData(0);
    const loopLen = Math.round(loopSeconds * sampleRate);
    const samples = new Float32Array(loopLen);
    samples.set(data.subarray(0, loopLen));
    for (let i = 0; i < data.length - loopLen && i < loopLen; i++) samples[i] += data[loopLen + i];
    let max = 0;
    for (let i = 0; i < samples.length; i++) max = Math.max(max, Math.abs(samples[i]));
    const gain = max > 0 ? peak / max : 1;
    for (let i = 0; i < samples.length; i++) samples[i] *= gain;
    return { samples, sampleRate, loopSeconds, sections };
}
