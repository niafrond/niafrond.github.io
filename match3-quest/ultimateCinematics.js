// Cinématiques plein écran des ultimes, façon invocations de FF9 : 4 plans portrait (incantation, apparition de l'entité,
// attaque signature, impact) générés avec Pixel Lab (tools/gen-ultimates.mjs → sprites/ultimates/), habillés en code
// (bandes noires, éclairs, zoom, lignes de vitesse, tremblement, carton-titre). Sans planches, un repli procédural joue.
import { registerUltimateCinematic } from './ultimates.js';
import { ultimateSpells } from './spells.js';
import { playSfx } from './sound.js';

export const ULTIMATE_PLAN_COUNT = 4;
export const ULTIMATE_PLAN_SECONDS = 2.2;
export const ULTIMATE_SIZE = [144, 256];
const TOTAL = ULTIMATE_PLAN_COUNT * ULTIMATE_PLAN_SECONDS;
const TITLE_AT = 3 * ULTIMATE_PLAN_SECONDS + 0.7;

// Couleur dominante de chaque ultime (repli procédural, lignes de vitesse, lueur du titre).
export const ULTIMATE_COLORS = {
    ultimateFiveElements: '#7be0a8',
    ultimateHeavenlyThunder: '#c9a6ff',
    ultimateThousandArrows: '#ffd24a',
    ultimateSunPiercer: '#ff8a1f',
    ultimateImperialDragon: '#ffd24a',
    ultimateEternalBastion: '#6ee7d8',
    ultimateThousandRiders: '#ff6a4a',
    ultimateSkyWolf: '#8fb8ff'
};

const prefersReducedMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
const clamp01 = v => Math.max(0, Math.min(1, v));

// Index des planches (un seul téléchargement) et planches déjà chargées, gardés en mémoire : un ultime relancé ou
// préchargé (`preloadUltimateCinematic`) ne retélécharge ni ne redécode rien. Un échec n'est pas mémorisé (nouvel essai).
const BASE = new URL('./sprites/ultimates/', import.meta.url);
let indexPromise = null;
const plansCache = new Map();

// Stockage permanent sur l'appareil (Cache Storage, sans service worker) : téléchargé une seule fois, puis servi depuis
// le téléphone, y compris hors ligne et d'une session à l'autre. À régénérer les planches, incrémenter la version.
export const ULTIMATE_ART_VERSION = 5;   // 5 : ultimes en trois actes (arrivée, mouvement, explosion) `<id>-seq.png` ; 4 : boucles d'arrivée en biome `biome_<région>-seq.png` ; 2 : Dragon Impérial, Rempart Éternel et Mille Cavaliers régénérés (héros chinois) ; 3 : plans-séquences `<id>-seq.png`
const CACHE_NAME = `match3-ultimates-v${ULTIMATE_ART_VERSION}`;
let persistAsked = false;   // demande de persistance + purge des anciennes versions : une fois par session

async function openDeviceCache() {
    try {
        if (typeof caches === 'undefined') return null;
        const cache = await caches.open(CACHE_NAME);
        if (!persistAsked) {
            persistAsked = true;
            navigator.storage?.persist?.().catch(() => {});   // évite l'éviction par le navigateur
            caches.keys().then(keys => keys.filter(k => k.startsWith('match3-ultimates-') && k !== CACHE_NAME).forEach(k => caches.delete(k))).catch(() => {});
        }
        return cache;
    } catch (e) {
        return null;
    }
}

// Réponse du cache de l'appareil, sinon réseau (puis mise en cache des réponses réussies). Lève si introuvable.
export async function deviceFetch(url) {
    const cache = await openDeviceCache();
    const hit = cache && await cache.match(url).catch(() => null);
    if (hit) return hit;
    const res = await fetch(url);
    if (!res || res.ok === false) throw new Error(`HTTP ${res?.status}`);
    if (cache) cache.put(url, res.clone()).catch(() => {});
    return res;
}

function loadIndex() {
    indexPromise ||= deviceFetch(new URL('index.json', BASE).href).then(r => r.json()).catch(() => { indexPromise = null; return null; });
    return indexPromise;
}

const loadImage = async url => {
    let src = url, blobUrl = null;
    try { blobUrl = URL.createObjectURL(await (await deviceFetch(url)).blob()); src = blobUrl; } catch (e) { return null; }
    return new Promise(res => {
        const img = new Image();
        const done = v => { URL.revokeObjectURL(blobUrl); res(v); };
        img.onload = () => (img.decode ? img.decode().catch(() => {}).then(() => done(img)) : done(img));
        img.onerror = () => done(null);
        img.src = src;
    });
};

// Planches Pixel Lab de l'ultime : tableau de 4 { img, frames, fps, size }, ou null si l'une manque (repli procédural).
export function loadPlans(id) {
    if (!plansCache.has(id)) {
        const p = (async () => {
            const index = await loadIndex();
            if (!index) return null;
            const plans = await Promise.all(Array.from({ length: ULTIMATE_PLAN_COUNT }, async (_, i) => {
                const meta = index[`${id}-${i + 1}`];
                const img = meta && await loadImage(new URL(`${id}-${i + 1}.png`, BASE).href);
                return img ? { img, ...meta } : null;
            }));
            return plans.every(Boolean) ? plans : null;
        })().then(plans => { if (!plans) plansCache.delete(id); return plans; });
        plansCache.set(id, p);
    }
    return plansCache.get(id);
}

// Plan-séquence de l'ultime (tools/pack-ultimate-sequences.mjs) : { img, frames, fps, size, cols } — planche en grille, `cols` images par
// ligne — ou null s'il n'existe pas (les 4 planches ou le repli procédural jouent alors). Même mémoire que les planches.
const seqCache = new Map();
export function loadSequence(id) {
    if (!seqCache.has(id)) {
        const p = (async () => {
            const meta = (await loadIndex())?.[`${id}-seq`];
            const img = meta && await loadImage(new URL(`${id}-seq.png`, BASE).href);
            return img ? { img, ...meta } : null;
        })().then(seq => { if (!seq) seqCache.delete(id); return seq; });
        seqCache.set(id, p);
    }
    return seqCache.get(id);
}

// Image `i` d'un plan-séquence : rectangle source dans la planche en grille.
export const sequenceRect = (seq, i) => {
    const n = Math.max(0, Math.min(seq.frames - 1, Math.floor(i)));
    return [(n % seq.cols) * seq.size[0], Math.floor(n / seq.cols) * seq.size[1], seq.size[0], seq.size[1]];
};

// Précharge en tâche de fond les planches de ces ultimes (ex. ceux de la classe du joueur).
export function preloadUltimateCinematic(spells) {
    for (const sp of [].concat(spells || [])) if (sp?.id) { loadSequence(sp.id); loadPlans(sp.id); }
}

// Repli procédural : fond sombre teinté, cercle runique qui tourne, rayons et orbe central selon le plan.
function drawFallback(ctx, plan, t, color) {
    const [w, h] = ULTIMATE_SIZE;
    ctx.fillStyle = '#0b0b1d';
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.25 + 0.2 * plan / ULTIMATE_PLAN_COUNT;
    ctx.fillStyle = color;
    ctx.fillRect(0, h * 0.55, w, h * 0.45);
    ctx.globalAlpha = 1;
    const cx = w / 2, cy = h * 0.55;
    const r = 18 + plan * 10 + Math.sin(t * 4) * 2;
    ctx.fillStyle = color;
    for (let i = 0; i < 24; i++) {
        const a = i / 24 * Math.PI * 2 + t * (plan % 2 ? 1.5 : -1.5);
        ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.45), 2, 2);
    }
    if (plan >= 1) {
        const orb = 8 + plan * 8 + Math.sin(t * 8) * 2;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(cx, h * 0.38, orb * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.5; ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(cx, h * 0.38, orb, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
    }
}

function drawSpeedLines(ctx, t, color, strength) {
    const [w, h] = ULTIMATE_SIZE;
    const cx = w / 2, cy = h / 2;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.55 * strength;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 28; i++) {
        const a = i / 28 * Math.PI * 2 + Math.floor(t * 12) * 0.37;
        const r0 = 30 + ((i * 53 + Math.floor(t * 24) * 17) % 40), r1 = r0 + 40 + (i % 5) * 12;
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 1.4);
        ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 1.4);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
}

// Joue la cinématique de l'ultime `spell` ; résolue à la fin ou au toucher/clic/touche (passer).
export function playUltimateScene(spell) {
    return new Promise(resolve => {
        const id = spell?.id;
        const color = ULTIMATE_COLORS[id] || '#ffd24a';
        const reduced = prefersReducedMotion();
        const overlay = document.createElement('div');
        overlay.className = 'cine-overlay cine-ultimate';
        const canvas = document.createElement('canvas');
        [canvas.width, canvas.height] = ULTIMATE_SIZE;
        canvas.className = 'cine-canvas portrait';
        const title = document.createElement('div');
        title.className = 'cine-ultimate-title';
        title.textContent = spell?.name || '';
        title.style.setProperty('--ult-color', color);
        overlay.append(canvas, title);
        overlay.insertAdjacentHTML('beforeend', '<i class="cine-ultimate-bar top"></i><i class="cine-ultimate-bar bottom"></i><div class="cine-skip">Toucher pour passer ►</div>');
        document.body.appendChild(overlay);
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.imageSmoothingEnabled = false;

        let plans = null, seq = null, raf = 0, finished = false, t0 = 0, lastPlan = -1;
        const close = () => {
            if (finished) return;
            finished = true;
            cancelAnimationFrame(raf);
            document.removeEventListener('keydown', onKey, true);
            overlay.classList.add('closing');
            setTimeout(() => { overlay.remove(); resolve(); }, 350);
        };
        const onKey = e => { e.preventDefault(); e.stopPropagation(); close(); };
        overlay.addEventListener('pointerdown', close);
        document.addEventListener('keydown', onKey, true);

        const frame = now => {
            if (finished) return;
            if (!ctx) { close(); return; }   // pas de canvas 2D (environnement sans rendu) : rien à montrer
            if (!t0) t0 = now;
            if (seq) {   // plan-séquence continu : une seule prise, titre aux trois quarts, éclairs sonores au milieu et à l'impact
                const total = seq.frames / seq.fps, t = reduced ? total - 0.01 : (now - t0) / 1000;
                if (t >= total + 0.4 && !reduced) { close(); return; }
                if (reduced && !title.classList.contains('show')) { title.classList.add('show'); setTimeout(close, 1800); }
                const [w, h] = ULTIMATE_SIZE, [sx, sy, sw, sh] = sequenceRect(seq, t * seq.fps);
                const step = Math.floor(t / total * 4);
                if (step !== lastPlan) { lastPlan = step; if (step === 1 || step === 3) playSfx('spellCast', { isPlayer: true }); }
                ctx.drawImage(seq.img, sx, sy, sw, sh, 0, 0, w, h);
                if (!reduced && t < 0.5) { ctx.globalAlpha = 1 - t / 0.5; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
                if (t >= total * 0.75) title.classList.add('show');
                raf = requestAnimationFrame(frame);
                return;
            }
            const t = reduced ? TOTAL - 0.01 : (now - t0) / 1000;
            if (t >= TOTAL + 0.4 && !reduced) { close(); return; }
            if (reduced && !title.classList.contains('show')) { title.classList.add('show'); setTimeout(close, 1800); }
            const plan = Math.min(ULTIMATE_PLAN_COUNT - 1, Math.floor(t / ULTIMATE_PLAN_SECONDS));
            const lt = t - plan * ULTIMATE_PLAN_SECONDS;
            if (plan !== lastPlan) {
                lastPlan = plan;
                if (plan === 1 || plan === 3) playSfx('spellCast', { isPlayer: true });
            }
            // zoom progressif au plan 3 (attaque), léger au plan 2, tremblement à l'impact
            const zoom = plan === 2 ? 1 + lt / ULTIMATE_PLAN_SECONDS * 0.3 : plan === 1 ? 1 + lt / ULTIMATE_PLAN_SECONDS * 0.08 : 1;
            const shake = !reduced && plan === 3 ? Math.max(0, 1 - lt / 1.2) * 6 : 0;
            const sx = shake ? Math.round((Math.random() - 0.5) * shake) : 0;
            const sy = shake ? Math.round((Math.random() - 0.5) * shake) : 0;
            const [w, h] = ULTIMATE_SIZE;
            ctx.save();
            ctx.translate(w / 2 + sx, h / 2 + sy);
            ctx.scale(zoom, zoom);
            ctx.translate(-w / 2, -h / 2);
            if (plans) {
                const p = plans[plan];
                const fi = reduced ? 0 : Math.min(p.frames - 1, Math.floor(lt * p.fps));
                ctx.drawImage(p.img, fi * p.size[0], 0, p.size[0], p.size[1], 0, 0, w, h);
            } else drawFallback(ctx, plan, lt, color);
            ctx.restore();
            if (!reduced) {
                if (plan === 2) drawSpeedLines(ctx, lt, color, clamp01(lt / 0.6));
                // éclair blanc à l'apparition (plan 2) et à l'impact (plan 4), fondu depuis le noir au tout début
                const flash = (plan === 1 && lt < 0.45) || (plan === 3 && lt < 0.7) ? 1 - lt / (plan === 3 ? 0.7 : 0.45) : 0;
                if (flash > 0) { ctx.globalAlpha = flash; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
                if (t < 0.6) { ctx.globalAlpha = 1 - t / 0.6; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
            }
            if (t >= TITLE_AT) title.classList.add('show');
            raf = requestAnimationFrame(frame);
        };
        const start = () => { if (!finished) raf = requestAnimationFrame(frame); };
        Promise.all([loadSequence(id), loadPlans(id)]).then(([sq, p]) => { seq = sq; plans = p; start(); });
    });
}

for (const spell of ultimateSpells) registerUltimateCinematic(spell.cinematic, () => playUltimateScene(spell));
