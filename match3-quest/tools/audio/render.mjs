#!/usr/bin/env node
// Rend toute la musique et tous les effets sonores en MP3 : `node match3-quest/tools/audio/render.mjs [--only clé,clé] [--music|--sfx]`.
// Rendu hors ligne dans Chromium (OfflineAudioContext), encodage MP3 par ffmpeg. Résultat : audio/music, audio/sfx, audio/manifest.json.
// Les fichiers sont versionnés : on ne relance cette commande que pour changer la musique ou les sons (voir README.md).
import http from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));      // racine du dépôt
const GAME = join(ROOT, 'match3-quest');
const args = process.argv.slice(2);
const only = (args.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const wantMusic = !args.includes('--sfx');
const wantSfx = !args.includes('--music');

const { BIOMES, COMBAT_STYLE_COUNT, BOSS_ARCHETYPE_COUNT, bossSlug, bossArchetypeIndex, trackUrl } = await import(pathToFileURL(join(GAME, 'musicTracks.js')));
const { sfxVariants } = await import(pathToFileURL(join(GAME, 'sfxCatalog.js')));
const { SCREENS } = await import(pathToFileURL(join(GAME, 'story.js')));

// ── Liste des pistes ────────────────────────────────────────────────────────
export function trackList() {
    const tracks = ['title', 'menu', 'house', 'sanctuary', 'moon', 'ending'].map(key => ({ key, scene: key, opts: {} }));
    for (const scene of ['village', 'wild']) for (const biome of BIOMES) tracks.push({ key: `${scene}-${biome}`, scene, opts: { biome } });
    for (let v = 0; v < COMBAT_STYLE_COUNT; v++) tracks.push({ key: `combat-${v}`, scene: 'combat', opts: { variant: v } });
    const bossNames = new Map();
    for (const sc of Object.values(SCREENS)) for (const e of sc.enemies || []) if (e.boss?.name) bossNames.set(bossSlug(e.boss.name), e.boss.name);
    for (const [slug, name] of bossNames) tracks.push({ key: `boss-${slug}`, scene: 'boss', opts: { boss: name } });
    // thèmes d'archétype (repli pour tout boss sans piste dédiée, p. ex. « Boss <ennemi> » tiré au hasard)
    for (let i = 0; i < BOSS_ARCHETYPE_COUNT; i++) {
        let n = 0;
        while (bossArchetypeIndex(`archetype-${i}-${n}`) !== i) n++;
        tracks.push({ key: `boss-a${i}`, scene: 'boss', opts: { boss: `archetype-${i}-${n}` } });
    }
    return tracks;
}

// ── Serveur statique + Chromium ─────────────────────────────────────────────
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json' };
const server = http.createServer((req, res) => {
    const file = normalize(join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch(process.env.PLAYWRIGHT_BROWSERS_PATH ? { executablePath: '/opt/pw-browsers/chromium' } : {});
const page = await browser.newPage();
await page.goto(`${origin}/match3-quest/tools/audio/blank.html`);

function encodeMp3(pcmB64, sampleRate, bitrate, outFile) {
    mkdirSync(join(outFile, '..'), { recursive: true });
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 's16le', '-ar', String(sampleRate), '-ac', '1', '-i', 'pipe:0',
        '-codec:a', 'libmp3lame', '-b:a', bitrate, outFile], { input: Buffer.from(pcmB64, 'base64'), maxBuffer: 1 << 28 });
    if (r.status !== 0) throw new Error(`ffmpeg : ${r.stderr}`);
}

const manifestFile = join(GAME, 'audio', 'manifest.json');
const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : { music: {}, sfx: {} };
const keep = key => !only.length || only.includes(key);

if (wantMusic) {
    for (const t of trackList().filter(t => keep(t.key))) {
        const res = await page.evaluate(async ({ scene, opts, origin }) => {
            const m = await import(`${origin}/match3-quest/tools/audio/browser.js`);
            return m.renderMusic(scene, opts, { sampleRate: 32000, targetSeconds: 30 });
        }, { scene: t.scene, opts: t.opts, origin });
        const out = join(GAME, trackUrl(t.key));
        encodeMp3(res.pcm, res.sampleRate, '48k', out);
        manifest.music[t.key] = { seconds: Math.round(res.loopSeconds * 10) / 10, sections: res.sections };
        console.log(`music ${t.key.padEnd(34)} ${res.loopSeconds.toFixed(1)} s`);
    }
}
if (wantSfx) {
    for (const v of sfxVariants().filter(v => keep(v.key))) {
        const res = await page.evaluate(async ({ event, payload, origin }) => {
            const m = await import(`${origin}/match3-quest/tools/audio/browser.js`);
            return m.renderSfx(event, payload);
        }, { event: v.event, payload: v.payload, origin });
        encodeMp3(res.pcm, res.sampleRate, '64k', join(GAME, 'audio', 'sfx', `${v.key}.mp3`));
        manifest.sfx[v.key] = { seconds: Math.round(res.seconds * 100) / 100 };
        console.log(`sfx   ${v.key.padEnd(34)} ${res.seconds.toFixed(2)} s`);
    }
}
writeFileSync(manifestFile, JSON.stringify(manifest, null, 1) + '\n');
await browser.close();
server.close();
