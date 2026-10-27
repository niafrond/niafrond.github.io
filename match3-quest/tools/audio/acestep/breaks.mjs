#!/usr/bin/env node
/**
 * breaks.mjs — mesure les creux de rythme et la douceur de pistes générées (sans les écouter).
 *
 *   node breaks.mjs <fichier.mp3…>
 *
 * Par fichier : `dips` = nombre de creux (fenêtres de 0,25 s à plus de 8 dB sous la médiane locale de ±2 s, groupées),
 * `p10` = niveau RMS (dB) dépassé 90 % du temps (plus il est haut, moins il y a de passages doux), `med` = niveau médian (dB).
 * Sert à départager des variantes : peu de `dips`, `p10` et `med` élevés pour un combat intense.
 */
import { spawnSync } from 'node:child_process';

const WIN = 11025;   // ≈ 0,25 s

export function analyse(file) {
    const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-af', `asetnsamples=n=${WIN}:p=0,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-`, '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const lv = (r.stdout.match(/RMS_level=(-?[\d.]+|-inf)/g) || []).map(x => parseFloat(x.split('=')[1])).map(v => (Number.isFinite(v) ? v : -90));
    if (lv.length < 16) return { dips: 0, p10: -90, med: -90 };
    const sorted = [...lv].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)], p10 = sorted[Math.floor(sorted.length * 0.1)];
    const half = 8;   // ±2 s
    let dips = 0, inDip = false;
    for (let i = half; i < lv.length - half; i++) {
        const local = lv.slice(i - half, i + half + 1).sort((a, b) => a - b)[half];
        const low = lv[i] < local - 8;
        if (low && !inDip) dips++;
        inDip = low;
    }
    return { dips, p10: Math.round(p10 * 10) / 10, med: Math.round(med * 10) / 10 };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('breaks.mjs')) {
    for (const f of process.argv.slice(2)) { const a = analyse(f); console.log(`${f}  dips=${a.dips}  p10=${a.p10}  med=${a.med}`); }
}
