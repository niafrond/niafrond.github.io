#!/usr/bin/env node
/**
 * generate.mjs — pilote l'API REST d'ACE-Step 1.5 pour générer la bande-son (aucun token Claude consommé).
 *
 *   node generate.mjs list [motif]                 liste les pistes du catalogue (filtre : sous-chaîne ou glob *)
 *   node generate.mjs motifs                       (re)crée refs/*.wav|.mid depuis leitmotifs.json
 *   node generate.mjs generate <clés…> [options]   génère de nouvelles versions (out/<clé>/v001.mp3, v001.json…)
 *   node generate.mjs status                       tableau : versions générées / version approuvée par piste
 *   node generate.mjs approve <clé> <vNNN>         marque une version comme retenue (copie dans approved/)
 *   node generate.mjs install [clés…]              approved/ → ../../../audio/music/<clé>.mp3 (mono 48 kbps, ffmpeg)
 *
 * Prérequis : serveur ACE-Step lancé en local (`acestep-api`, port 8001 par défaut) et Node ≥ 18.
 * Les <clés> acceptent les jokers : `boss-soleil-*`, `village-*`, `all`. Ordre conseillé (cohérence des leitmotivs) :
 *   title → boss-soleil-ardent → boss-fengmeng-le-disciple → le reste (voir README.md).
 *
 * Options de `generate` :
 *   --variants N      versions par piste (défaut 2, max 8 : batch_size)
 *   --seed N          graine fixe (reproduire / affiner une version) ; sinon aléatoire
 *   --duration S      durée en secondes (défaut : celle du catalogue)
 *   --extra "texte"   retouche ajoutée au prompt (ex. "more energetic, faster pipa, less reverb")
 *   --thinking        active le LM de planification d'ACE-Step (plus lent, structure plus cohérente)
 *   --steps N         inference_steps (défaut du serveur)
 *   --no-motif        ne pas envoyer le leitmotiv de référence
 *   --cover           motif envoyé comme audio source (task_type=cover, mélodie suivie de près) au lieu de simple référence
 *   --param k=v       champ brut supplémentaire de /release_task (répétable), ex. --param guidance_scale=5
 *   --skip-approved   ignorer les pistes déjà approuvées
 *   --dry-run         affiche les requêtes sans appeler le serveur
 *   --host URL        défaut http://127.0.0.1:8001 (ou env ACESTEP_URL) ; --api-key KEY (ou env ACESTEP_API_KEY)
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CATALOG, buildCaption } from './catalog.mjs';
import { renderMotifs, motifPath } from './motifs.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out'), APPROVED = path.join(HERE, 'approved');
const GAME_MUSIC = path.resolve(HERE, '../../audio/music'), GAME_MANIFEST = path.resolve(HERE, '../../audio/manifest.json');
const APPROVED_DB = path.join(APPROVED, 'approved.json');

/* ───────────── arguments ───────────── */
function parseArgs(argv) {
    const o = { _: [], param: {} };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (!a.startsWith('--')) { o._.push(a); continue; }
        const k = a.slice(2);
        if (['thinking', 'dry-run', 'no-motif', 'cover', 'skip-approved'].includes(k)) { o[k] = true; continue; }
        const v = argv[++i];
        if (v === undefined) die(`Valeur manquante pour --${k}`);
        if (k === 'param') { const [pk, ...pv] = v.split('='); o.param[pk] = coerce(pv.join('=')); } else o[k] = v;
    }
    return o;
}
const coerce = v => (v === 'true' ? true : v === 'false' ? false : v !== '' && !isNaN(v) ? Number(v) : v);
function die(msg) { console.error(`✗ ${msg}`); process.exit(1); }
const pad = n => String(n).padStart(3, '0');
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };

function selectKeys(patterns) {
    const all = Object.keys(CATALOG);
    if (!patterns.length) return [];
    const sel = new Set();
    for (const p of patterns) {
        if (p === 'all') { all.forEach(k => sel.add(k)); continue; }
        const re = new RegExp(`^${p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
        const hits = all.filter(k => re.test(k));
        if (!hits.length) die(`Aucune piste ne correspond à « ${p} » (voir : node generate.mjs list)`);
        hits.forEach(k => sel.add(k));
    }
    return [...sel];
}

/* ───────────── API ACE-Step ───────────── */
function api(opts) {
    const base = (opts.host || process.env.ACESTEP_URL || 'http://127.0.0.1:8001').replace(/\/$/, '');
    const key = opts['api-key'] || process.env.ACESTEP_API_KEY;
    const headers = { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) };
    const call = async (url, init) => {
        const r = await fetch(base + url, { headers, ...init });
        if (!r.ok) throw new Error(`HTTP ${r.status} sur ${url} : ${(await r.text()).slice(0, 300)}`);
        return r;
    };
    return {
        base,
        health: () => call('/health').then(r => r.json()),
        submit: async body => {
            const j = await (await call('/release_task', { method: 'POST', body: JSON.stringify(body) })).json();
            const id = j?.data?.task_id ?? j?.task_id;
            if (!id) throw new Error(`Réponse inattendue : ${JSON.stringify(j).slice(0, 300)}`);
            return id;
        },
        poll: async (id, onTick) => {
            for (;;) {
                const j = await (await call('/query_result', { method: 'POST', body: JSON.stringify({ task_id_list: [id] }) })).json();
                const item = (j?.data || [])[0];
                let res = item?.result;
                if (typeof res === 'string') { try { res = JSON.parse(res); } catch { /* reste en texte */ } }
                const list = Array.isArray(res) ? res : res ? [res] : [];
                const st = item?.status ?? list[0]?.status ?? 0;
                if (st === 2 || list.some(x => x?.status === 2)) throw new Error(`Génération échouée : ${JSON.stringify(res).slice(0, 400)}`);
                if (st === 1 && list.length) return list;
                onTick?.();
                await new Promise(r => setTimeout(r, 3000));
            }
        },
        download: async fileUrl => Buffer.from(await (await call(fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`)).arrayBuffer())
    };
}

/* ───────────── commandes ───────────── */
function nextVersion(dir) {
    fs.mkdirSync(dir, { recursive: true });
    const nums = fs.readdirSync(dir).map(f => /^v(\d+)\./.exec(f)?.[1]).filter(Boolean).map(Number);
    return Math.max(0, ...nums) + 1;
}

async function cmdGenerate(opts) {
    const keys = selectKeys(opts._.slice(1));
    if (!keys.length) die('Indiquer au moins une clé (ex. `generate title`, `generate boss-soleil-*`, `generate all`).');
    const approved = readJson(APPROVED_DB, {});
    const todo = keys.filter(k => !(opts['skip-approved'] && approved[k]));
    const A = api(opts);
    if (!opts['dry-run']) {
        try { await A.health(); } catch (e) { die(`Serveur ACE-Step injoignable sur ${A.base} (${e.message}). Lancer \`acestep-api\` ou utiliser --host.`); }
    }
    const variants = Math.min(8, Math.max(1, Number(opts.variants ?? 2)));
    const motifs = todo.some(k => CATALOG[k].motif) && !opts['no-motif'] ? renderMotifs() : {};
    console.log(`${todo.length} piste(s), ${variants} variante(s) chacune → ${path.relative(process.cwd(), OUT) || OUT}`);

    let n = 0;
    for (const key of todo) {
        n++;
        const t = CATALOG[key];
        const body = {
            prompt: buildCaption(t, opts.extra), lyrics: '[Instrumental]', vocal_language: 'unknown', audio_format: 'mp3',
            audio_duration: Number(opts.duration ?? t.dur), batch_size: variants, thinking: !!opts.thinking,
            ...(t.bpm ? { bpm: t.bpm } : {}), ...(t.keyScale ? { key_scale: t.keyScale } : {}), time_signature: '4',
            ...(opts.seed !== undefined ? { use_random_seed: false, seed: Number(opts.seed) } : { use_random_seed: true }),
            ...(opts.steps ? { inference_steps: Number(opts.steps) } : {})
        };
        if (t.motif && motifs[t.motif]) {
            if (opts.cover) { body.task_type = 'cover'; body.src_audio_path = motifs[t.motif]; } else body.reference_audio_path = motifs[t.motif];
        }
        Object.assign(body, opts.param);
        console.log(`\n[${n}/${todo.length}] ${key}${t.motif && motifs[t.motif] ? `  (motif: ${t.motif})` : ''}`);
        if (opts['dry-run']) { console.log(JSON.stringify(body, null, 2)); continue; }
        try {
            const id = await A.submit(body);
            const t0 = Date.now();
            const results = await A.poll(id, () => process.stdout.write(`\r  … ${Math.round((Date.now() - t0) / 1000)} s`));
            process.stdout.write('\r');
            const dir = path.join(OUT, key);
            let v = nextVersion(dir);
            const seeds = String(results[0]?.seed_value ?? '').split(',');
            for (let i = 0; i < results.length; i++, v++) {
                const r = results[i];
                const file = path.join(dir, `v${pad(v)}.mp3`);
                fs.writeFileSync(file, await A.download(r.file));
                fs.writeFileSync(path.join(dir, `v${pad(v)}.json`), JSON.stringify({
                    key, version: `v${pad(v)}`, date: new Date().toISOString(), seed: seeds[i] ?? seeds[0] ?? null,
                    request: body, motifFile: body.reference_audio_path || body.src_audio_path || null, metas: r.metas ?? null
                }, null, 2));
                console.log(`  ✓ ${path.relative(HERE, file)}  (seed ${seeds[i] ?? seeds[0] ?? '?'})`);
            }
        } catch (e) { console.error(`  ✗ ${key} : ${e.message}`); }
    }
    console.log('\nÉcouter les fichiers de out/, puis : node generate.mjs approve <clé> <vNNN>');
}

function cmdList(opts) {
    const f = opts._[1];
    const keys = f ? selectKeysLoose(f) : Object.keys(CATALOG);
    for (const k of keys) { const t = CATALOG[k]; console.log(`${k.padEnd(58)} ${String(t.bpm ?? '').padStart(3)} bpm  ${t.keyScale.padEnd(9)} ${String(t.dur).padStart(3)} s  ${t.motif ? '♪' + t.motif : ''}`); }
    console.log(`${keys.length} piste(s)`);
}
function selectKeysLoose(f) { return Object.keys(CATALOG).filter(k => (f.includes('*') ? new RegExp(`^${f.replace(/\*/g, '.*')}$`).test(k) : k.includes(f))); }

function cmdStatus() {
    const approved = readJson(APPROVED_DB, {});
    let ok = 0;
    for (const k of Object.keys(CATALOG)) {
        const d = path.join(OUT, k), vs = fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith('.mp3')).length : 0;
        if (approved[k]) ok++;
        console.log(`${(approved[k] ? '✔' : vs ? '·' : ' ')} ${k.padEnd(58)} ${String(vs).padStart(2)} version(s)  ${approved[k] ? `approuvée : ${approved[k].version} (seed ${approved[k].seed})` : ''}`);
    }
    console.log(`\n${ok}/${Object.keys(CATALOG).length} approuvées`);
}

function cmdApprove(opts) {
    const [, key, ver] = opts._;
    if (!CATALOG[key] || !/^v\d+$/.test(ver || '')) die('Usage : approve <clé> <vNNN>   (ex. approve title v002)');
    const src = path.join(OUT, key, `${ver}.mp3`);
    if (!fs.existsSync(src)) die(`Introuvable : ${src}`);
    fs.mkdirSync(APPROVED, { recursive: true });
    fs.copyFileSync(src, path.join(APPROVED, `${key}.mp3`));
    const meta = readJson(path.join(OUT, key, `${ver}.json`), {});
    fs.copyFileSync(path.join(OUT, key, `${ver}.json`), path.join(APPROVED, `${key}.json`));
    const db = readJson(APPROVED_DB, {});
    db[key] = { version: ver, seed: meta.seed ?? null, date: new Date().toISOString(), prompt: meta.request?.prompt ?? '' };
    fs.writeFileSync(APPROVED_DB, JSON.stringify(db, null, 2));
    console.log(`✔ ${key} ← ${ver} (seed ${meta.seed}). Fichier + paramètres conservés dans approved/.`);
}

function cmdInstall(opts) {
    const approved = readJson(APPROVED_DB, {});
    const keys = opts._.length > 1 ? selectKeys(opts._.slice(1)) : Object.keys(approved);
    if (spawnSync('ffmpeg', ['-version']).error) die('ffmpeg introuvable dans le PATH.');
    const manifest = readJson(GAME_MANIFEST, { music: {}, sfx: {} });
    for (const k of keys) {
        const src = path.join(APPROVED, `${k}.mp3`);
        if (!fs.existsSync(src)) { console.warn(`· ${k} : pas de version approuvée, ignoré`); continue; }
        const dst = path.join(GAME_MUSIC, `${k}.mp3`);
        // mono 48 kbps comme le reste du jeu ; fondus courts pour éviter les clics au raccord de boucle
        const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src], { encoding: 'utf8' });
        const sec = parseFloat(probe.stdout) || 0;
        const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-ac', '1', '-ar', '32000', '-b:a', '48k',
            '-af', `afade=t=in:d=0.15,afade=t=out:st=${Math.max(0, sec - 0.4).toFixed(2)}:d=0.4`, dst]);
        if (r.status !== 0) { console.error(`✗ ${k} : ${r.stderr}`); continue; }
        const kb = Math.round(fs.statSync(dst).size / 1024);
        manifest.music[k] = { seconds: Math.round(sec * 10) / 10, sections: manifest.music[k]?.sections ?? 1 };
        console.log(`✔ ${k} → audio/music/${k}.mp3 (${kb} Ko${kb > 500 ? ' ⚠ > 500 Ko, raccourcir via --duration' : ''})`);
    }
    fs.writeFileSync(GAME_MANIFEST, JSON.stringify(manifest, null, 1) + '\n');
}

const opts = parseArgs(process.argv.slice(2));
const cmd = opts._[0];
const main = { list: cmdList, status: cmdStatus, approve: cmdApprove, install: cmdInstall, generate: cmdGenerate,
    motifs: () => { for (const [n, p] of Object.entries(renderMotifs())) console.log(`✔ ${n} → ${p} (+ .mid)`); } }[cmd];
if (!main) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n/, '').replace(/^\/\*\*\n|^ \* ?/gm, '')); process.exit(cmd ? 1 : 0); }
Promise.resolve(main(opts)).catch(e => die(e.message));
