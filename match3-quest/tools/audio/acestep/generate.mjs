#!/usr/bin/env node
/**
 * generate.mjs — pilote l'API REST d'ACE-Step 1.5 pour générer la bande-son (aucun token Claude consommé).
 *
 *   node generate.mjs list [motif]                 liste les pistes du catalogue (filtre : sous-chaîne ou glob *)
 *   node generate.mjs motifs                       (re)crée refs/*.wav|.mid depuis leitmotifs.json
 *   node generate.mjs generate <clés…> [options]   génère de nouvelles versions (out/<clé>/v001.mp3, v001.json…)
 *   node generate.mjs status                       tableau : versions générées / version approuvée par piste
 *   node generate.mjs approve <clé> <vNNN> [<vNNN>]  marque une version retenue (+ une 2e variante, `<clé>-b`) dans approved/
 *   node generate.mjs install [clés…]              approved/ → ../../../audio/music/<clé>.mp3 (stéréo 96 kbps, ffmpeg)
 *   node generate.mjs export [--dest DIR]          copie approved/ dans DIR/v<AAAA-MM-JJ_HHMM>/ (défaut : /mnt/d/GoogleDriveCFO/musicMatchQuest)
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
const GAME_MUSIC = path.resolve(HERE, '../../../audio/music'), GAME_MANIFEST = path.resolve(HERE, '../../../audio/manifest.json');
const APPROVED_DB = path.join(APPROVED, 'approved.json');
/** Dossier de copie versionnée (chemin WSL du lecteur D:, car le script tourne dans WSL). */
const DEFAULT_EXPORT_DIR = '/mnt/d/GoogleDriveCFO/musicMatchQuest';
/** Durée minimale de chaque piste générée (secondes) : les pistes du jeu bouclent, 3 min évitent les boucles trop courtes. */
const MIN_DURATION = 180;
/** Suffixe de la 2e variante d'une piste (`<clé>-b.mp3`) : le jeu en tire une au hasard à chaque scène. */
const ALT_SUFFIX = '-b';
/** Traitements d'installation par piste. Combat 2 et 3 (trop doux) : compression + limiteur qui relève les passages calmes ; village volcan (aigus agressifs) : coupe des hautes fréquences. */
const PUNCH_FILTER = 'acompressor=threshold=-26dB:ratio=3.5:attack=8:release=120:makeup=3.8,alimiter=limit=0.95';
/** Pistes dont seule une première partie est gardée (fraction de la durée utile) : le reste était faux ou nasillard ; la boucle reprend alors plus tôt. */
const KEEP_FRACTION = {};
const POST_FILTERS = { 'combat-1': PUNCH_FILTER, 'combat-2': PUNCH_FILTER, 'village-volcano': 'lowpass=f=5000,treble=g=-4:f=2500' };
/** Durée (s) du raccord fondu fin -> début qui rend la boucle continue, et débit des MP3 du jeu (3 min stéréo 96 kbps ≈ 2,1 Mo). */
const LOOP_FADE_S = 2, MUSIC_BITRATE = '96k';

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
        // `upload` ({ field, file }) : le serveur refuse les chemins absolus hors /tmp, le fichier est donc envoyé en multipart.
        submit: async (body, upload) => {
            let init = { method: 'POST', body: JSON.stringify(body) };
            if (upload) {
                const form = new FormData();
                for (const [k, v] of Object.entries(body)) form.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
                form.append(upload.field, new Blob([fs.readFileSync(upload.file)]), path.basename(upload.file));
                const { 'Content-Type': _ct, ...h } = headers;
                init = { method: 'POST', body: form, headers: h };
            }
            const j = await (await call('/release_task', init)).json();
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
            audio_duration: Math.max(t.jingle || t.sfx ? 10 : MIN_DURATION, Number(opts.duration ?? t.dur)), batch_size: variants, thinking: !!opts.thinking,
            ...(t.bpm ? { bpm: t.bpm } : {}), ...(t.keyScale ? { key_scale: t.keyScale } : {}), time_signature: '4',
            ...(opts.seed !== undefined ? { use_random_seed: false, seed: Number(opts.seed) } : { use_random_seed: true }),
            ...(opts.steps ? { inference_steps: Number(opts.steps) } : {})
        };
        let upload = null;
        if (t.motif && motifs[t.motif]) {
            if (opts.cover) body.task_type = 'cover';
            upload = { field: opts.cover ? 'ctx_audio' : 'ref_audio', file: motifs[t.motif] };
        }
        Object.assign(body, opts.param);
        console.log(`\n[${n}/${todo.length}] ${key}${t.motif && motifs[t.motif] ? `  (motif: ${t.motif})` : ''}`);
        if (opts['dry-run']) { console.log(JSON.stringify(body, null, 2)); continue; }
        try {
            const id = await A.submit(body, upload);
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
                    request: body, motifFile: upload?.file ?? null, metas: r.metas ?? null
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
    for (const k of keys) { const t = CATALOG[k]; console.log(`${k.padEnd(58)} ${String(t.bpm ?? '').padStart(3)} bpm  ${t.keyScale.padEnd(9)} ${String(t.dur).padStart(3)} s  ${t.motif ? '[musique] ' + t.motif : ''}`); }
    console.log(`${keys.length} piste(s)`);
}
function selectKeysLoose(f) { return Object.keys(CATALOG).filter(k => (f.includes('*') ? new RegExp(`^${f.replace(/\*/g, '.*')}$`).test(k) : k.includes(f))); }

function cmdStatus() {
    const approved = readJson(APPROVED_DB, {});
    let ok = 0;
    for (const k of Object.keys(CATALOG)) {
        const d = path.join(OUT, k), vs = fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith('.mp3')).length : 0;
        if (approved[k]) ok++;
        console.log(`${(approved[k] ? 'OK' : vs ? '·' : ' ')} ${k.padEnd(58)} ${String(vs).padStart(2)} version(s)  ${approved[k] ? `approuvée : ${approved[k].version} (seed ${approved[k].seed})` : ''}`);
    }
    console.log(`\n${ok}/${Object.keys(CATALOG).length} approuvées`);
}

function cmdApprove(opts) {
    const [, key, ver, alt] = opts._;
    if (!CATALOG[key] || !/^v\d+$/.test(ver || '') || (alt && !/^v\d+$/.test(alt))) die('Usage : approve <clé> <vNNN> [<vNNN variante>]   (ex. approve title v007 v008)');
    const src = path.join(OUT, key, `${ver}.mp3`), altSrc = alt && path.join(OUT, key, `${alt}.mp3`);
    if (!fs.existsSync(src)) die(`Introuvable : ${src}`);
    if (altSrc && !fs.existsSync(altSrc)) die(`Introuvable : ${altSrc}`);
    fs.mkdirSync(APPROVED, { recursive: true });
    fs.copyFileSync(src, path.join(APPROVED, `${key}.mp3`));
    if (altSrc) fs.copyFileSync(altSrc, path.join(APPROVED, `${key}${ALT_SUFFIX}.mp3`));
    else fs.rmSync(path.join(APPROVED, `${key}${ALT_SUFFIX}.mp3`), { force: true });
    const meta = readJson(path.join(OUT, key, `${ver}.json`), {});
    fs.copyFileSync(path.join(OUT, key, `${ver}.json`), path.join(APPROVED, `${key}.json`));
    const db = readJson(APPROVED_DB, {});
    db[key] = { version: ver, ...(alt ? { alt } : {}), seed: meta.seed ?? null, date: new Date().toISOString(), prompt: meta.request?.prompt ?? '' };
    fs.writeFileSync(APPROVED_DB, JSON.stringify(db, null, 2));
    console.log(`OK ${key} ← ${ver}${alt ? ` + variante ${alt}` : ''} (seed ${meta.seed}). Fichier + paramètres conservés dans approved/.`);
}

/** Début (s) du premier passage intense : première fenêtre de 0,5 s dont le niveau RMS est à moins de 1,5 dB de la moyenne, tenue 2 s (max 20 s) ; 0 si la piste démarre déjà fort. */
function punchyStart(file) {
    const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-af', 'asetnsamples=n=22050:p=0,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-', '-f', 'null', '-'], { encoding: 'utf8' });
    const lv = (r.stdout.match(/RMS_level=(-?[\d.]+|-inf)/g) || []).map(x => parseFloat(x.split('=')[1])).map(v => (Number.isFinite(v) ? v : -90));
    if (lv.length < 8) return 0;
    const avg = 10 * Math.log10(lv.reduce((a, v) => a + 10 ** (v / 10), 0) / lv.length);
    const i = lv.findIndex((v, k) => lv.slice(k + 4, k + 8).every(u => u >= avg - 1.5));   // le fichier installé démarre 2 s après (fondu de boucle) : on juge les 4 fenêtres suivantes
    return i <= 0 ? 0 : Math.min(i * 0.5, 20);
}

/** Fin utile (s) : coupe le fondu de sortie et le silence final (fenêtres de 0,25 s à plus de 4 dB sous la moyenne, max 30 s coupées), sinon la boucle fin -> début s'entend. */
function tailEnd(file, duration) {
    const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-af', 'asetnsamples=n=11025:p=0,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-', '-f', 'null', '-'], { encoding: 'utf8' });
    const lv = (r.stdout.match(/RMS_level=(-?[\d.]+|-inf)/g) || []).map(x => parseFloat(x.split('=')[1])).map(v => (Number.isFinite(v) ? v : -90));
    if (lv.length < 16 || !duration) return duration;
    const win = duration / lv.length;
    const avg = 10 * Math.log10(lv.reduce((a, v) => a + 10 ** (v / 10), 0) / lv.length);
    let i = lv.length - 1;
    while (i > 0 && !(lv[i] >= avg - 4 && lv[i - 1] >= avg - 4)) i--;
    return Math.max(duration - 30, (i + 1) * win);
}

/** Écart (dB) entre le niveau moyen d'un fichier et celui de ses 1,5 premières secondes (positif = intro plus faible). */
function introGap(file) {
    const mean = t => parseFloat((spawnSync('ffmpeg', ['-t', String(t), '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr.match(/mean_volume: (-?[\d.]+)/) || [0, -90])[1]);
    return mean(999) - mean(1.5);
}

function cmdInstall(opts) {
    const approved = readJson(APPROVED_DB, {});
    const keys = opts._.length > 1 ? selectKeys(opts._.slice(1)) : Object.keys(approved);
    if (spawnSync('ffmpeg', ['-version']).error) die('ffmpeg introuvable dans le PATH.');
    const manifest = readJson(GAME_MANIFEST, { music: {}, sfx: {} });
    for (const k of keys) {
        const parts = [k, `${k}${ALT_SUFFIX}`].filter(n => fs.existsSync(path.join(APPROVED, `${n}.mp3`)));
        if (!parts.length) { console.warn(`· ${k} : pas de version approuvée, ignoré`); continue; }
        // la variante n'existe plus si elle a été retirée de approved/ : on supprime l'ancien fichier du jeu
        if (!parts.includes(`${k}${ALT_SUFFIX}`)) fs.rmSync(path.join(GAME_MUSIC, `${k}${ALT_SUFFIX}.mp3`), { force: true });
        for (const name of parts) {
            const src = path.join(APPROVED, `${name}.mp3`), dst = path.join(GAME_MUSIC, `${name}.mp3`);
            const combat = /^(combat|boss)-/.test(k);
            let head = combat ? punchyStart(src) : 0;   // combats : pas d'intro douce, la piste démarre au premier passage intense
            const duration = parseFloat(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src], { encoding: 'utf8' }).stdout) || 0;
            const end = tailEnd(src, duration) * (KEEP_FRACTION[k] ?? 1);   // fin utile : sans fondu de sortie ni silence, la boucle est invisible
            let total, c, r;
            for (;;) {
                total = end - head;
                // stéréo 44,1 kHz ; boucle sans coupure : la fin est fondue (sinus carré) dans le début, puis le fichier
                // reprend après ce début, donc le saut fin -> début du lecteur (`source.loop`) est continu et sans clic
                c = Math.min(LOOP_FADE_S, total / 4);
                const body = total - c;
                const graph = total > 0
                    ? `[0:a]atrim=0:${c},asetpts=PTS-STARTPTS[h];[0:a]atrim=${c}:${body},asetpts=PTS-STARTPTS[m];[0:a]atrim=${body}:${total},asetpts=PTS-STARTPTS[t];[t][h]acrossfade=d=${c}:c1=qsin:c2=qsin[x];[m][x]concat=n=2:v=0:a=1[o]`
                    : '[0:a]anull[o]';
                const full = POST_FILTERS[k] ? `${graph};[o]${POST_FILTERS[k]}[p]` : graph;
                r = spawnSync('ffmpeg', ['-y', '-v', 'error', ...(head ? ['-ss', String(head)] : []), '-i', src, '-filter_complex', full, '-map', POST_FILTERS[k] ? '[p]' : '[o]', '-ac', '2', '-ar', '44100', '-b:a', MUSIC_BITRATE, dst]);
                // contrôle du fichier installé : intro à plus de 2,5 dB sous la moyenne -> 1 s de plus coupée (max 25 s)
                if (r.status !== 0 || !combat || head >= 25 || introGap(dst) <= 2.5) break;
                head += 1;
            }
            if (r.status !== 0) { console.error(`✗ ${name} : ${r.stderr}`); continue; }
            const kb = Math.round(fs.statSync(dst).size / 1024);
            if (name === k) manifest.music[k] = { seconds: Math.round((total - c) * 10) / 10, sections: manifest.music[k]?.sections ?? 1 };
            console.log(`OK ${name} → audio/music/${name}.mp3 (${kb} Ko${kb > 2400 ? ' ATTENTION : > 2,4 Mo, raccourcir via --duration' : ''})`);
        }
    }
    fs.writeFileSync(GAME_MANIFEST, JSON.stringify(manifest, null, 1) + '\n');
}

/** Copie versionnée de approved/ (mp3 + paramètres + approved.json) vers un dossier horodaté : rien n'est écrasé. */
function cmdExport(opts) {
    if (!fs.existsSync(APPROVED_DB)) die('Rien à exporter : aucune piste approuvée (voir : node generate.mjs status).');
    const dest = path.resolve(opts.dest || DEFAULT_EXPORT_DIR);
    const d = new Date(), p2 = n => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}`;
    const target = path.join(dest, `v${stamp}`);
    if (fs.existsSync(target)) die(`Dossier déjà existant : ${target} (attendre une minute).`);
    fs.mkdirSync(target, { recursive: true });
    const files = fs.readdirSync(APPROVED).filter(f => /\.(mp3|json)$/.test(f));
    for (const f of files) fs.copyFileSync(path.join(APPROVED, f), path.join(target, f));
    console.log(`OK ${files.length} fichier(s) → ${target}`);
}

const opts = parseArgs(process.argv.slice(2));
const cmd = opts._[0];
const main = { list: cmdList, status: cmdStatus, approve: cmdApprove, install: cmdInstall, export: cmdExport, generate: cmdGenerate,
    motifs: () => { for (const [n, p] of Object.entries(renderMotifs())) console.log(`OK ${n} → ${p} (+ .mid)`); } }[cmd];
if (!main) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n/, '').replace(/^\/\*\*\n|^ \* ?/gm, '')); process.exit(cmd ? 1 : 0); }
Promise.resolve(main(opts)).catch(e => die(e.message));
