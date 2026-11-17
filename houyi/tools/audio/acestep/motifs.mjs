/**
 * motifs.mjs — rend les leitmotivs de `leitmotifs.json` en audio de référence (WAV) et en MIDI (.mid), sans dépendance.
 * Le WAV (synthèse pincée simple) est envoyé à ACE-Step comme référence pour garder la même mélodie d'un morceau à l'autre.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REFS_DIR = path.join(HERE, 'refs');
export const loadMotifs = () => JSON.parse(fs.readFileSync(path.join(HERE, 'leitmotifs.json'), 'utf8'));

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** "F#4" → numéro MIDI. */
export function midiNumber(n) {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(n);
    if (!m) throw new Error(`Note invalide : ${n}`);
    return 12 * (Number(m[3]) + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

/** Déroule le motif (répétitions) en notes [{midi, start, len}] exprimées en temps. */
function expand(motif) {
    const out = []; let t = 0;
    for (let r = 0; r < (motif.repeat || 1); r++) {
        for (const [n, d] of motif.notes) { if (n !== 'R') out.push({ midi: midiNumber(n), start: t, len: d }); t += d; }
        t += 2; // respiration entre deux reprises
    }
    return { notes: out, beats: t };
}

function writeWav(file, motif) {
    const SR = 32000, spb = 60 / motif.bpm, { notes, beats } = expand(motif);
    const buf = new Float32Array(Math.ceil((beats * spb + 1.5) * SR));
    for (const n of notes) {
        const f = 440 * 2 ** ((n.midi - 69) / 12), s0 = Math.floor(n.start * spb * SR), dur = n.len * spb + 0.6;
        for (let i = 0, N = Math.floor(dur * SR); i < N && s0 + i < buf.length; i++) {
            const t = i / SR, env = Math.min(1, t / 0.005) * Math.exp(-t * (n.len > 1.5 ? 1.6 : 3.2));
            const w = Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(4 * Math.PI * f * t) + 0.18 * Math.sin(6 * Math.PI * f * t);
            buf[s0 + i] += 0.3 * env * w;
        }
    }
    const pcm = Buffer.alloc(44 + buf.length * 2);
    pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + buf.length * 2, 4); pcm.write('WAVEfmt ', 8); pcm.writeUInt32LE(16, 16);
    pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22); pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 2, 28);
    pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(buf.length * 2, 40);
    buf.forEach((v, i) => pcm.writeInt16LE(Math.max(-1, Math.min(1, v)) * 32767, 44 + i * 2));
    fs.writeFileSync(file, pcm);
}

function writeMidi(file, motif) {
    const TPQ = 480, { notes } = expand(motif), ev = [];
    for (const n of notes) {
        ev.push({ t: Math.round(n.start * TPQ), d: [0x90, n.midi, 90] }, { t: Math.round((n.start + n.len * 0.95) * TPQ), d: [0x80, n.midi, 0] });
    }
    ev.sort((a, b) => a.t - b.t || (a.d[0] === 0x80 ? -1 : 1));
    const vlq = v => { const b = [v & 0x7f]; while ((v >>= 7)) b.unshift((v & 0x7f) | 0x80); return b; };
    const us = Math.round(60e6 / motif.bpm), trk = [0, 0xff, 0x51, 3, us >> 16 & 255, us >> 8 & 255, us & 255, 0, 0xc0, 71];
    let last = 0;
    for (const e of ev) { trk.push(...vlq(e.t - last), ...e.d); last = e.t; }
    trk.push(0, 0xff, 0x2f, 0);
    const head = Buffer.from([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, TPQ >> 8, TPQ & 255, 0x4d, 0x54, 0x72, 0x6b, trk.length >>> 24, trk.length >> 16 & 255, trk.length >> 8 & 255, trk.length & 255]);
    fs.writeFileSync(file, Buffer.concat([head, Buffer.from(trk)]));
}

/** Génère refs/<nom>.wav et .mid pour tous les motifs ; renvoie {nom: chemin absolu du wav}. */
export function renderMotifs() {
    fs.mkdirSync(REFS_DIR, { recursive: true });
    const res = {};
    for (const [name, m] of Object.entries(loadMotifs())) {
        if (name.startsWith('_')) continue;
        writeWav(path.join(REFS_DIR, `${name}.wav`), m); writeMidi(path.join(REFS_DIR, `${name}.mid`), m);
        res[name] = path.join(REFS_DIR, `${name}.wav`);
    }
    return res;
}
export const motifPath = name => path.join(REFS_DIR, `${name}.wav`);
