#!/usr/bin/env node
/**
 * jingles.mjs — Jingles du jeu (clips `audio/sfx/<clé>.mp3`) composés par ACE-Step au lieu de la synthèse de `render.mjs`.
 *
 * Les 7 jingles les plus audibles : introJingle, endingJingle, battleStart, combatStart, bossStart, victory, defeat (sfxCatalog.js).
 * ACE-Step génère des pistes d'au moins 10 s : on en tire plusieurs variantes (`generate.mjs generate "jingle-*" --variants 4`),
 * puis `install` découpe chacune à la durée voulue (début net, fondu de fin), l'égalise au niveau des clips du jeu (crête à
 * SFX_RENDER_GAIN) et garde la plus énergique dans sa durée. Rien n'est écrasé dans out/ : on peut réécouter les variantes.
 *
 * Usage (WSL, `gm up audio` pour la génération ; ffmpeg pour l'installation) :
 *   node generate.mjs generate "jingle-*" --variants 4      # 4 variantes par jingle -> out/jingle-<clé>/vNNN.mp3
 *   node jingles.mjs list                                   # durées visées et variantes disponibles
 *   node jingles.mjs install [clé…] [--pick vNNN] [--from vNNN]  # meilleure variante (ou celle imposée) -> audio/sfx/<clé>.mp3 + manifest.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { CATALOG } from './catalog.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
const GAME = path.resolve(HERE, '../../..');
const SFX_DIR = path.join(GAME, 'audio', 'sfx'), MANIFEST = path.join(GAME, 'audio', 'manifest.json');
const PEAK_DB = -6;   // SFX_RENDER_GAIN = 0,5 (sfxCatalog.js) : crête à −6 dBFS

const keys = Object.keys(CATALOG).filter(k => CATALOG[k].jingle || CATALOG[k].sfx);
const specOf = k => CATALOG[k].jingle || CATALOG[k].sfx;
const sfxKeyOf = k => k.replace(/^(?:jingle|sfx)-/, '');
const die = msg => { console.error(msg); process.exit(1); };
const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8' });
if (run('ffmpeg', ['-version']).error) die('ffmpeg introuvable dans le PATH.');

const variantsOf = key => {
    const dir = path.join(OUT, key);
    return fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /^v\d+\.mp3$/.test(f)).sort().map(f => path.join(dir, f)) : [];
};

/** Filtre : coupe le silence initial, garde `target` s, fondu de fin, mono 32 kHz. */
const trimFilter = ({ target, fade }, gainDb = 0) =>
    `silenceremove=start_periods=1:start_duration=0.02:start_threshold=-42dB,atrim=0:${target},asetpts=PTS-STARTPTS,` +
    `afade=t=out:st=${Math.max(0, target - fade)}:d=${fade},volume=${gainDb}dB`;

function stats(file, spec, gainDb = 0) {
    const r = run('ffmpeg', ['-v', 'info', '-i', file, '-af', `${trimFilter(spec, gainDb)},volumedetect`, '-f', 'null', '-']);
    const mean = /mean_volume:\s*(-?[\d.]+) dB/.exec(r.stderr), max = /max_volume:\s*(-?[\d.]+) dB/.exec(r.stderr);
    return mean && max ? { mean: Number(mean[1]), max: Number(max[1]) } : null;
}

function encode(src, dst, spec, gainDb) {
    const r = run('ffmpeg', ['-y', '-v', 'error', '-i', src, '-af', trimFilter(spec, gainDb), '-ac', '1', '-ar', '32000', '-b:a', '64k', dst]);
    if (r.status !== 0) die(`ffmpeg a échoué pour ${src} : ${r.stderr}`);
}

function durationOf(file) {
    const r = run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
    return Math.round(parseFloat(r.stdout) * 100) / 100;
}

function cmdList() {
    keys.forEach(k => console.log(`${sfxKeyOf(k).padEnd(14)} ${String(specOf(k).target).padStart(4)} s  ${variantsOf(k).length} variante(s)`));
}

function cmdInstall(args) {
    const pickIdx = args.indexOf('--pick');
    const pick = pickIdx >= 0 ? args[pickIdx + 1] : null;
    const fromIdx = args.indexOf('--from');   // `--from vNNN` : ne considérer que les variantes à partir de celle-ci (après une régénération)
    const from = fromIdx >= 0 ? args[fromIdx + 1] : null;
    const wanted = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--pick' && args[i - 1] !== '--from');
    const todo = keys.filter(k => !wanted.length || wanted.includes(sfxKeyOf(k)) || wanted.includes(k));
    const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    for (const key of todo) {
        const spec = specOf(key), files = variantsOf(key).filter(f => !from || path.basename(f, '.mp3') >= from);
        if (!files.length) { console.log(`· ${sfxKeyOf(key)} : aucune variante dans out/${key}/`); continue; }
        const scored = files.map(f => ({ f, s: stats(f, spec) })).filter(x => x.s);
        // la plus énergique dans sa durée (niveau moyen le plus haut) : un jingle doit « sonner » d'emblée
        const chosen = pick ? scored.find(x => path.basename(x.f, '.mp3') === pick) : scored.sort((a, b) => b.s.mean - a.s.mean)[0];
        if (!chosen) { console.log(`✗ ${sfxKeyOf(key)} : variante introuvable`); continue; }
        const gain = PEAK_DB - chosen.s.max;
        const dst = path.join(SFX_DIR, `${sfxKeyOf(key)}.mp3`);
        encode(chosen.f, dst, spec, gain);
        const seconds = durationOf(dst);
        manifest.sfx[sfxKeyOf(key)] = { seconds };
        console.log(`OK ${sfxKeyOf(key).padEnd(14)} ← ${path.basename(chosen.f)} (${scored.length} essai(s), niveau moyen ${chosen.s.mean} dB, gain ${gain.toFixed(1)} dB) → ${seconds} s, ${Math.round(fs.statSync(dst).size / 1024)} Ko`);
    }
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n');
}

const [cmd, ...rest] = process.argv.slice(2);
const commands = { list: cmdList, install: () => cmdInstall(rest) };
if (!commands[cmd]) die("Usage : node jingles.mjs list | install [clé…] [--pick vNNN] [--from vNNN]");
commands[cmd]();
