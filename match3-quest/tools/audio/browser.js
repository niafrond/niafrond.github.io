// Code exécuté DANS Chromium par tools/audio/render.mjs (OfflineAudioContext n'existe pas sous Node).
import { renderLoop } from './synth.js';
import { sfxRecipe } from './sfxRecipes.js';
import { SFX_RENDER_GAIN } from '../../sfxCatalog.js';

// PCM 16 bits mono -> base64 (l'encodage MP3 se fait côté Node avec ffmpeg).
function pcm16Base64(samples) {
    const bytes = new Uint8Array(samples.length * 2);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < samples.length; i++) view.setInt16(i * 2, Math.max(-1, Math.min(1, samples[i])) * 32767, true);
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(bin);
}

export async function renderMusic(sceneId, opts, params) {
    const { samples, sampleRate, loopSeconds, sections } = await renderLoop(OfflineAudioContext, sceneId, opts, params);
    return { pcm: pcm16Base64(samples), sampleRate, loopSeconds, sections };
}

let noiseBuf = null;
function noiseFor(ctx) {
    if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
    const len = Math.floor(ctx.sampleRate * 0.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let a = 12345;
    for (let i = 0; i < len; i++) { a = (a * 1664525 + 1013904223) >>> 0; d[i] = a / 2147483648 - 1; }
    noiseBuf = buf;
    return buf;
}

export async function renderSfx(event, payload) {
    const SR = 44100;
    const { tones, noises } = sfxRecipe(event, payload);
    let end = 0;
    for (const { p } of tones) end = Math.max(end, p[0] + p[2] + 0.08);
    for (const { b } of noises) end = Math.max(end, b[0] + b[1] + 0.05);
    const ctx = new OfflineAudioContext(1, Math.ceil((end + 0.05) * SR), SR);
    for (const { p: [delay, freq, dur, rel = 1, wave = 'sine'], gain } of tones) {
        const t0 = 0.01 + delay;
        const g = SFX_RENDER_GAIN * gain * rel;
        const osc = ctx.createOscillator();
        const node = ctx.createGain();
        osc.type = wave;
        osc.frequency.setValueAtTime(Math.max(40, freq), t0);
        const attack = Math.min(0.015, dur * 0.2);
        const releaseStart = Math.max(t0 + attack, t0 + dur - 0.03);
        node.gain.setValueAtTime(0.0001, t0);
        node.gain.exponentialRampToValueAtTime(Math.max(0.0001, g), t0 + attack);
        node.gain.exponentialRampToValueAtTime(0.0001, releaseStart + 0.03);
        osc.connect(node); node.connect(ctx.destination);
        osc.start(t0); osc.stop(t0 + dur + 0.04);
    }
    for (const { b: [delay, duration, rel, f0, f1, type = 'bandpass'], gain } of noises) {
        const t0 = 0.01 + delay;
        const src = ctx.createBufferSource();
        src.buffer = noiseFor(ctx); src.loop = true;
        const flt = ctx.createBiquadFilter();
        flt.type = type; flt.Q.value = 0.9;
        flt.frequency.setValueAtTime(f0, t0);
        flt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + duration);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0001, SFX_RENDER_GAIN * gain * rel * 3), t0 + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
        src.connect(flt); flt.connect(g); g.connect(ctx.destination);
        src.start(t0); src.stop(t0 + duration + 0.03);
    }
    const out = (await ctx.startRendering()).getChannelData(0).slice();
    let max = 0;
    for (const v of out) max = Math.max(max, Math.abs(v));
    if (max > 0.95) for (let i = 0; i < out.length; i++) out[i] *= 0.95 / max;   // jamais d'écrêtage
    return { pcm: pcm16Base64(out), sampleRate: SR, seconds: out.length / SR };
}
