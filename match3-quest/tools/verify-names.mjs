#!/usr/bin/env node
/**
 * verify-names.mjs — Vérifie, pour chaque ennemi / maître d'arène ayant un nom chinois (bestiaryNames.js) :
 *   1. le pinyin du jeu contre le pinyin donné par l'API pour les caractères simplifiés ;
 *   2. la traduction française littérale du jeu (bestiaryLiteral.js) contre la traduction de l'API
 *      et contre le sens de chaque caractère pris isolément.
 *
 * API : endpoint public « gtx » de Google Traduction (translate.googleapis.com), sans clé ni compte.
 *   - dt=rm  → romanisation (pinyin avec tons) ;
 *   - dt=t   → traduction zh-CN → fr ; un appel par caractère donne son sens littéral.
 *   C'est un point d'accès non documenté mais stable et gratuit ; MyMemory (api.mymemory.translated.net)
 *   a été écarté : quota anonyme de 5 000 caractères par jour et passerelle souvent en 504.
 *   Une API de traduction renvoie le sens d'usage, pas toujours le sens littéral : un écart n'est donc
 *   qu'un signal « à relire », jamais une correction automatique.
 *
 * Verdicts :
 *   pinyin  : OK | TONS (mêmes syllabes, tons différents) | ≠ (syllabes différentes)
 *   littéral: OK (un mot significatif retrouvé dans la traduction ou dans le sens d'un caractère)
 *             NOM (nom propre : doit égaler le pinyin sans tons) | À REVOIR
 *
 * Usage : node match3-quest/tools/verify-names.mjs [--only id1,id2] [--limit N] [--md rapport.md] [--refresh]
 *   Les réponses de l'API sont gardées dans tools/.verify-names-cache.json (ignoré par git) : une seconde
 *   exécution ne réinterroge rien. --refresh vide ce cache.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BESTIARY_NAMES } from '../bestiaryNames.js';
import { LITERAL_BY_HANZI } from '../bestiaryLiteral.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = join(HERE, '.verify-names-cache.json');
const arg = n => { const i = process.argv.indexOf(n); return i < 0 ? null : (process.argv[i + 1] ?? true); };
const ONLY = arg('--only') ? new Set(String(arg('--only')).split(',')) : null;
const LIMIT = Number(arg('--limit')) || Infinity;
const MD = arg('--md');
const DELAY_MS = 350;

let cache = {};
if (!process.argv.includes('--refresh') && existsSync(CACHE_FILE)) { try { cache = JSON.parse(readFileSync(CACHE_FILE, 'utf8')); } catch { cache = {}; } }
const save = () => writeFileSync(CACHE_FILE, JSON.stringify(cache));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Un appel gtx : { text, pinyin } pour une chaîne chinoise. Réessaie 3 fois avec attente croissante.
async function gtx(q) {
    if (cache[q]) return cache[q];
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=fr&dt=t&dt=rm&q=${encodeURIComponent(q)}`;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            const seg = data[0] || [];
            const out = {
                text: seg.map(s => s?.[0]).filter(Boolean).join('').trim(),
                pinyin: seg.map(s => s?.[3]).filter(Boolean).join(' ').trim()
            };
            cache[q] = out; save();
            await sleep(DELAY_MS);
            return out;
        } catch (e) {
            if (attempt === 3) return { text: '', pinyin: '', error: String(e.message || e) };
            await sleep(1000 * attempt);
        }
    }
}

const stripTones = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ü/g, 'u');
const compact = s => s.toLowerCase().replace(/[\s'’\-·]/g, '');
const fold = s => stripTones(s.toLowerCase());
const STOP = new Set(['de', 'du', 'des', 'les', 'aux', 'la', 'le', 'un', 'une', 'qui', 'sans', 'avec', 'dans', 'en', 'et', 'au', 'sur', 'par', 'pour', 'ou']);
const words = s => fold(s).split(/[^a-z]+/).filter(w => w.length >= 4 && !STOP.has(w));

function pinyinVerdict(ours, theirs) {
    if (!theirs) return 'N/A';
    const a = compact(ours), b = compact(theirs);
    if (a === b) return 'OK';
    return stripTones(a) === stripTones(b) ? 'TONS' : '≠';
}

function literalVerdict(literal, pinyinOurs, apiText, glosses) {
    if (!literal) return 'À REVOIR';
    // Nom propre : le « littéral » est le nom, sans tons, en une ou deux syllabes jointes (Chiyou, Hong Gang…).
    if (compact(stripTones(literal)) === compact(stripTones(pinyinOurs))) return 'NOM';
    const pool = fold([apiText, ...glosses].join(' '));
    const hit = words(literal).some(w => pool.includes(w.slice(0, 5)));
    return hit ? 'OK' : 'À REVOIR';
}

const rows = [];
let done = 0;
for (const [id, [pinyin, hanzi]] of Object.entries(BESTIARY_NAMES)) {
    if (ONLY && !ONLY.has(id)) continue;
    if (done++ >= LIMIT) break;
    const whole = await gtx(hanzi);
    const chars = [];
    for (const ch of hanzi) {
        const g = await gtx(ch);
        chars.push({ ch, text: g.text, pinyin: g.pinyin });
    }
    const literal = LITERAL_BY_HANZI[hanzi] || '';
    const row = {
        id, hanzi, pinyin, apiPinyin: whole.pinyin,
        pinyinVerdict: pinyinVerdict(pinyin, whole.pinyin),
        literal, apiText: whole.text,
        chars: chars.map(c => `${c.ch}=${c.text}`).join(' · '),
        literalVerdict: literalVerdict(literal, pinyin, whole.text, chars.map(c => c.text)),
        error: whole.error || ''
    };
    rows.push(row);
    const flag = row.pinyinVerdict === 'OK' && row.literalVerdict !== 'À REVOIR' ? ' ' : '!';
    console.log(`${flag} ${id.padEnd(20)} ${hanzi.padEnd(8)} pinyin ${row.pinyinVerdict.padEnd(4)} (${pinyin} / ${row.apiPinyin || '?'}) | littéral ${row.literalVerdict.padEnd(8)} « ${literal} » / API « ${row.apiText} »${row.error ? ' ERREUR ' + row.error : ''}`);
}

const count = f => rows.filter(f).length;
console.log(`\n${rows.length} noms · pinyin : ${count(r => r.pinyinVerdict === 'OK')} OK, ${count(r => r.pinyinVerdict === 'TONS')} tons différents, ${count(r => r.pinyinVerdict === '≠')} différents`
    + ` · littéral : ${count(r => r.literalVerdict === 'OK')} OK, ${count(r => r.literalVerdict === 'NOM')} noms propres, ${count(r => r.literalVerdict === 'À REVOIR')} à revoir`);

if (MD) {
    const esc = s => String(s).replace(/\|/g, '\\|');
    const lines = ['# Vérification des noms chinois (API de traduction)', '',
        '| Id | Hanzi | Pinyin jeu | Pinyin API | Pinyin | Littéral jeu | Traduction API | Sens par caractère | Littéral |', '|---|---|---|---|---|---|---|---|---|',
        ...rows.map(r => `| ${r.id} | ${r.hanzi} | ${esc(r.pinyin)} | ${esc(r.apiPinyin)} | ${r.pinyinVerdict} | ${esc(r.literal)} | ${esc(r.apiText)} | ${esc(r.chars)} | ${r.literalVerdict} |`)];
    writeFileSync(MD === true ? 'verification-noms-api.md' : MD, lines.join('\n') + '\n');
    console.log('Rapport écrit : ' + (MD === true ? 'verification-noms-api.md' : MD));
}
