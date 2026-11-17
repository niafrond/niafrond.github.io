// Fin de la légende (animation plein écran) et générique de fin. Extrait de cinematics.js.
import { H, P, TP, W, disc, lerpColor, moon, prefersReducedMotion, px, runScene, sprite, stars, text } from './cinematicsCore.js';
import { loadSceneArt } from './cinematicsPrologue.js';

// ── Fin de la légende ───────────────────────────────────────────────────────
// Palette : celle de l'écran de démarrage (`TP`, définie plus bas) : nuit teal, lune crème, lumière or/ambre,
// silhouettes encre. Quatre temps : crépuscule (montée du pic) → autel (gâteaux) → Chang'e dans la lune →
// lanternes des villages + « FIN ». Les plans (ciel, collines, village, pic) défilent à des vitesses différentes
// pendant que la caméra monte. Texte « FIN » / légende / invite en overlay HTML (`.cine-ending-*`).
export const clamp01 = k => Math.max(0, Math.min(1, k));
const smooth = k => { const c = clamp01(k); return c * c * (3 - 2 * c); };

// Gabarits de scène (coordonnées de la vue finale). ridge = crête du pic de la Lune (silhouette encre).
const END_LAYOUT = {
    land: {
        ridge: [[-10, 92], [-10, 84], [6, 78], [14, 72], [20, 68], [28, 62], [34, 56], [40, 50], [48, 48], [72, 48], [78, 51], [88, 57], [100, 64], [114, 72], [130, 80], [150, 84], [175, 86], [175, 150]],
        moon: [108, 32, 24], altarX: 55, plateau: 48, start: 2, end: 40, cam: 14, farA: 60, farB: 71, houses: [106, 117, 127, 138, 147, 155]
    },
    port: {
        ridge: [[-10, 170], [-10, 150], [2, 142], [10, 134], [16, 128], [22, 120], [28, 114], [34, 108], [42, 106], [60, 106], [66, 109], [74, 116], [84, 124], [100, 134], [100, 220]],
        moon: [50, 58, 26], altarX: 48, plateau: 106, start: 0, end: 33, cam: 24, farA: 90, farB: 101, houses: [2, 11, 20, 66, 75, 83]
    }
};

function ridgeAt(pts, x) {
    for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[i + 1];
        if (x <= x1) return x1 === x0 ? y1 : y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
    }
    return pts[pts.length - 1][1];
}

// Remplit sous une courbe y = fn(x), colonne par colonne (bords nets, pas d'anti-crénelage).
function fillCols(ctx, color, fn, dy, rim) {
    for (let x = 0; x < W; x++) {
        const y = Math.round(fn(x) + dy);
        px(ctx, color, x, y, 1, Math.max(1, H + 80 - y));
        if (rim) px(ctx, rim, x, y, 1, 1);
    }
}

// Hou Yi (13×22, regarde à droite), mêmes teintes que le portrait de l'écran de démarrage : cheveux encre + chignon or,
// robe teal à liserés or, ceinture brun-rouge, lumière venant de la droite (…Hi) et côté gauche ombré (…Lo).
const HOU_END = [
    '....gg.......',
    '...khhk......',
    '..khhhhhk....',
    '..khHhhhhk...',
    '..khhhssssk..',
    '...khssksSk..',
    '....kssssk...',
    '....kkSkkk...',
    '...kggGGggk..',
    '..kRrrrrrLk..',
    '..kRrrGgrLk..',
    '..kRrrrgrrLk.',
    '..kbbbbbbbk..',
    '.kRrrrrrrrLk.',
    '.kRrrrrrrrLk.',
    '.kRrrrrrrrLk.',
    '.kRRrrrrrrLk.',
    '.kRRrrrrrrLk.',
    '.kRRrrrrrrLk.',
    '.kgggggggggk.'
];
const houEndCol = () => ({ k: TP.ink, h: TP.hair, H: TP.hairHi, s: TP.skin, S: TP.skinLo, r: TP.robe, R: TP.robeLo, L: TP.robeHi, g: TP.gold, G: TP.goldHi, b: TP.brown });

// pose : 'walk' (corbeille de gâteaux au bras) · 'offer' (bras tendu vers l'autel) · 'idle' · 'wave' (main levée vers la lune)
export function endHero(ctx, x0, y0, pose, t) {
    const step = Math.floor(t * 6) % 2;
    const x = Math.round(x0);
    const y = Math.round(y0) - (pose === 'walk' && step ? 1 : 0);
    // arc doré dans le dos + carquois
    for (let i = 0; i < 18; i++) px(ctx, TP.gold, x + 1 - Math.round(Math.sin((i / 17) * Math.PI) * 2), y + 3 + i);
    sprite(ctx, HOU_END, houEndCol(), x, y);
    px(ctx, TP.woodLo, x - 1, y + 9, 2, 7);
    px(ctx, TP.wood, x, y + 9, 1, 7);
    px(ctx, TP.cream, x - 1, y + 7, 1, 2);
    px(ctx, TP.sand, x, y + 8, 1, 1);
    // pieds
    const f = pose === 'walk' ? step : 0;
    px(ctx, TP.ink, x + 3, y + 20 - f, 3, 2);
    px(ctx, TP.ink, x + 7, y + 20 - (1 - f && pose === 'walk' ? 1 : 0), 3, 2);
    px(ctx, TP.woodLo, x + 4, y + 20 - f, 1, 1);
    px(ctx, TP.woodLo, x + 8, y + 20, 1, 1);
    // bras
    if (pose === 'walk') {
        px(ctx, TP.robeHi, x + 9, y + 10, 4, 2);
        px(ctx, TP.skinHi, x + 12, y + 10, 1, 2);
        px(ctx, TP.woodHi, x + 11, y + 12, 6, 3);
        px(ctx, TP.woodLo, x + 11, y + 14, 6, 1);
        for (let i = 0; i < 3; i++) px(ctx, i % 2 ? TP.cream : TP.gold, x + 12 + i * 2, y + 11, 2, 1);
    } else if (pose === 'offer') {
        px(ctx, TP.robeHi, x + 9, y + 11, 5, 2);
        px(ctx, TP.skinHi, x + 14, y + 11, 1, 2);
    } else if (pose === 'wave') {
        const a = 1.15 + Math.sin(t * 2) * 0.22;
        for (let i = 0; i < 9; i++) {
            const bx = x + 9 + Math.cos(a) * i;
            const by = y + 9 - Math.sin(a) * i;
            px(ctx, i > 6 ? TP.skinHi : TP.robeHi, bx, by, 2, 2);
        }
    } else {
        px(ctx, TP.robeHi, x + 9, y + 10, 2, 5);
        px(ctx, TP.skinHi, x + 9, y + 15, 2, 1);
    }
}

// Chang'e dans la lune : cheveux encre, robe or / or clair, manche ample levée qui salue, rubans qui flottent.
function endChange(ctx, mx, my, r, t, alpha) {
    const u = r / 24;
    ctx.globalAlpha = alpha * 0.55;
    disc(ctx, TP.goldHi, mx, my + 2 * u, Math.round(r * 0.85));
    ctx.globalAlpha = alpha;
    const hy = my - 9 * u;
    // rubans (ondulent, dépassent du disque)
    for (let i = 0; i < 20; i++) {
        const rx = mx - 3 - i * 1.4 * u;
        const ry = my + 2 * u + Math.sin(t * 2.2 + i * 0.5) * (1 + i * 0.14) + i * 0.15;
        px(ctx, i % 4 < 2 ? TP.goldHi : TP.gold, rx, ry, 2, 1);
    }
    // robe : tunique puis jupe évasée
    for (let j = 0; j < 22; j++) {
        const half = Math.round((j < 7 ? 3 + j * 0.3 : 4.5 + (j - 7) * 0.55) * u);
        const yy = Math.round(my - 5 * u + j * u);
        px(ctx, j < 6 ? TP.gold : TP.woodHi, mx - half, yy, Math.min(half, 2), 1);
        px(ctx, TP.gold, mx - half + 2, yy, Math.max(0, half - 1), 1);
        px(ctx, TP.goldHi, mx + 1, yy, half, 1);
    }
    px(ctx, TP.cream, mx - 5 * u, my - 0 * u, 10 * u, 1); // ceinture
    px(ctx, TP.brown, mx - 1, my + 0.5 * u, 2, 5 * u);
    // tête : cheveux, chignon, épingle, visage
    disc(ctx, TP.hair, mx, hy, Math.round(3.4 * u));
    disc(ctx, TP.hair, mx - 2 * u, hy - 4 * u, Math.max(1, Math.round(1.8 * u)));
    px(ctx, TP.gold, mx - 3 * u, hy - 5 * u, 2, 1);
    px(ctx, TP.skinHi, mx - 1, hy - 1, 3, 4);
    px(ctx, TP.skin, mx - 1, hy + 2, 2, 1);
    px(ctx, TP.hair, mx - 4 * u, hy, 1, Math.round(9 * u));
    // bras levé (manche ample) qui salue
    const a = 1.0 + Math.sin(t * 2.4) * 0.32;
    const sx = mx + 3 * u;
    const sy = my - 4 * u;
    const L = 14 * u;
    for (let i = 0; i <= L; i++) {
        const w = 1 + Math.round((i / L) * 2.5);
        px(ctx, i % 5 < 2 ? TP.goldHi : TP.cream, sx + Math.cos(a) * i, sy - Math.sin(a) * i, w, w);
    }
    px(ctx, TP.skinHi, sx + Math.cos(a) * (L + 1), sy - Math.sin(a) * (L + 1) - 1, 2, 3);
    // autre bras le long du corps
    px(ctx, TP.goldHi, mx - 5 * u, my - 3 * u, 2, Math.round(7 * u));
    ctx.globalAlpha = 1;
}

const ENDING_BEATS = 4;   // tableaux Pixel Lab de la fin : crépuscule, autel, Chang'e dans la lune, lanternes
const ENDING_BEAT_SECONDS = 6.5;

// Une légende par tableau : elle explique ce qu'il advient du monde, de Fengmeng, de Chang'e et des hommes.
export const ENDING_CAPTIONS = [
    "Le dernier soleil décline : pour la première fois depuis des lunes, la nuit tombe sur la Terre. Les fleuves regonflent, les rizières reverdissent, et l'empereur Yao fait graver le nom de Hou Yi dans le jade.",
    "Hou Yi dépose les gâteaux de lune sur l'autel blanc, un à un, comme Chang'e le faisait. Fengmeng, lui, est redescendu à pied, sans arme, son carquois laissé au pied de l'autel : en bas, il devra répondre de ses actes.",
    "Là-haut, Chang'e veille. L'élixir lui a donné le ciel, mais n'a pas pris son cœur : dans le bronze, les deux moitiés du miroir ne forment plus qu'un seul cercle, et une main se lève dans la lune.",
    "Chaque automne, à la pleine lune, les hommes posent des gâteaux sur leurs toits et allument des lanternes. Et là-haut, quelqu'un leur sourit. Ainsi s'achève la légende de Hou Yi."
];

export async function playEndingAnimation() {
    const art = await loadSceneArt('ending', ENDING_BEATS, window.innerHeight > window.innerWidth);
    const DURATION = art ? ENDING_BEATS * ENDING_BEAT_SECONDS + 2.5 : 27.5;
    const PROC_BEAT_SECONDS = 6;   // sans tableaux : une légende toutes les 6 s sur la scène dessinée
    const C = P ? END_LAYOUT.port : END_LAYOUT.land;
    let stars = null;
    let overlayEl = null;
    const shown = {};
    const reveal = (cls, on) => { if (on && !shown[cls] && overlayEl) { shown[cls] = true; overlayEl.classList.add(cls); } };
    // Légende du tableau en cours : elle réapparaît en fondu à chaque changement.
    let captionIdx = -1;
    const showCaption = i => {
        const el = overlayEl?.querySelector('.cine-ending-legend');
        if (!el || i === captionIdx) return;
        captionIdx = i;
        el.textContent = ENDING_CAPTIONS[i];
        el.classList.remove('swap');
        void el.offsetWidth;
        el.classList.add('swap');
    };
    let layout = null;
    // Tableaux Pixel Lab : un fondu enchaîné entre chaque temps ; « FIN » et la légende apparaissent sur le dernier.
    const drawEndingArt = (ctx, t) => {
        ctx.imageSmoothingEnabled = false;
        t = Math.max(0, t);   // la première image rAF peut précéder t0
        const beat = Math.min(ENDING_BEATS - 1, Math.floor(t / ENDING_BEAT_SECONDS));
        const local = t - beat * ENDING_BEAT_SECONDS;
        const frameOf = (b, tt) => { const a = art[b]; return Math.floor(tt * a.fps) % a.frames; };
        const blit = (b, tt) => { const a = art[b], [aw, ah] = a.size; ctx.drawImage(a.img, frameOf(b, tt) * aw, 0, aw, ah, 0, 0, aw, ah); };
        blit(beat, local);
        if (beat > 0 && local < 0.8) { ctx.globalAlpha = 1 - local / 0.8; blit(beat - 1, local + ENDING_BEAT_SECONDS); ctx.globalAlpha = 1; }   // fondu depuis le tableau précédent
        showCaption(beat);
        reveal('show-fin', t > (ENDING_BEATS - 1) * ENDING_BEAT_SECONDS + 0.6);
        reveal('show-prompt', t >= DURATION);
    };
    return runScene({
        extraClass: 'cine-ending',
        duration: DURATION,
        startSfx: 'endingJingle',
        onMount(overlay) {
            overlayEl = overlay;
            const cv = overlay.querySelector('canvas');
            if (art && cv) { cv.width = art[0].size[0]; cv.height = art[0].size[1]; }
            overlay.insertAdjacentHTML('beforeend', `
                <div class="cine-ending-text">
                    <div class="cine-ending-fin">FIN</div>
                    <div class="cine-ending-legend"></div>
                </div>
                <div class="cine-ending-prompt">► Toucher pour continuer</div>`);
        },
        draw(ctx, t) {
            if (art) return drawEndingArt(ctx, t);
            if (!layout) {
                layout = END_LAYOUT[P ? 'port' : 'land'];
                stars = Array.from({ length: P ? 46 : 60 }, (_, i) => ({
                    x: (i * 97 + i * i * 13 + 11) % W,
                    y: (i * 61 + i * i * 7 + 3) % Math.floor(H * 0.62),
                    c: [TP.cream, TP.goldHi, TP.mist][i % 3], p: i
                }));
            }
            const lay = layout || C;
            const nightK = smooth(t / 7);
            const camE = smooth(t / 12);
            const camDy = -lay.cam * (1 - camE);        // la caméra monte : la scène descend à l'écran
            const [mx0, my0, mr] = lay.moon;
            const mx = mx0;
            const my = Math.round(my0 + camDy * 0.35 + (1 - smooth(t / 9)) * 9);

            // ── Plan 1 : ciel (crépuscule → nuit) ──
            const bands = 26;
            const nightTop = lerpColor(TP.tealDeep, TP.ink, 0.45);
            for (let i = 0; i < bands; i++) {
                const k = i / (bands - 1);
                const dusk = k < 0.6 ? lerpColor(TP.tealMid, TP.tealLight, k / 0.6) : lerpColor(TP.tealLight, TP.sand, (k - 0.6) / 0.4);
                const night = k < 0.7 ? lerpColor(nightTop, TP.tealDeep, k / 0.7) : lerpColor(TP.tealDeep, TP.tealMid, (k - 0.7) / 0.3);
                px(ctx, lerpColor(dusk, night, nightK), 0, Math.floor(i * H / bands), W, Math.ceil(H / bands) + 1);
            }
            // dernière lueur chaude du soleil couchant, à gauche
            const sunsetA = 0.5 * (1 - nightK);
            if (sunsetA > 0.01) {
                const g = ctx.createRadialGradient(W * 0.1, H * 0.74 + camDy * 0.2, 2, W * 0.1, H * 0.74 + camDy * 0.2, Math.max(W, H) * 0.7);
                g.addColorStop(0, `rgba(251,231,176,${sunsetA})`);
                g.addColorStop(0.5, `rgba(232,185,35,${sunsetA * 0.25})`);
                g.addColorStop(1, 'rgba(232,185,35,0)');
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, W, H);
            }
            // étoiles (scintillent, apparaissent à la nuit)
            stars.forEach(s => {
                ctx.globalAlpha = clamp01(nightK * 1.2 - (s.p % 7) * 0.05) * (0.45 + 0.55 * Math.abs(Math.sin(t * 1.3 + s.p)));
                px(ctx, s.c, s.x, s.y + camDy * 0.1, 1, 1);
            });
            ctx.globalAlpha = 1;

            // ── Plan 2 : lune géante + halo ──
            const flare = smooth((t - 7.5) / 2.5);
            const haloR = mr * (2.3 + flare * 0.7);
            const halo = ctx.createRadialGradient(mx, my, mr * 0.8, mx, my, haloR);
            halo.addColorStop(0, `rgba(251,231,176,${0.35 + flare * 0.3})`);
            halo.addColorStop(0.5, `rgba(232,185,35,${0.1 + flare * 0.08})`);
            halo.addColorStop(1, 'rgba(232,185,35,0)');
            ctx.fillStyle = halo;
            ctx.fillRect(mx - haloR, my - haloR, haloR * 2, haloR * 2);
            disc(ctx, TP.sand, mx, my, mr);
            disc(ctx, TP.cream, mx + 1, my - 1, mr - 2);
            disc(ctx, TP.goldHi, mx + 3, my - 3, Math.max(2, mr - 8)); // face éclairée vers le haut-droite
            const crater = lerpColor(TP.cream, TP.sand, 0.7);
            [[-0.45, -0.25, 0.2], [0.35, 0.4, 0.14], [-0.2, 0.5, 0.1], [0.5, -0.4, 0.09]].forEach(([cx, cy, cr]) => {
                disc(ctx, crater, mx + cx * mr, my + cy * mr, Math.max(1, Math.round(cr * mr)));
            });
            endChange(ctx, mx, my, mr, t, smooth((t - 8.2) / 2));

            // ── Plan 3 : collines lointaines, village ──
            const farAc = lerpColor(TP.tealMid, TP.tealDeep, 0.5);
            const farBc = lerpColor(TP.tealDeep, TP.ink, 0.4);
            fillCols(ctx, farAc, x => lay.farA + Math.sin(x * 0.045) * 4 + Math.sin(x * 0.13 + 1) * 2, camDy * 0.5, null);
            const bdy = Math.round(camDy * 0.75);
            fillCols(ctx, farBc, x => lay.farB + Math.sin(x * 0.06 + 2) * 2 + Math.sin(x * 0.17) * 1, bdy, null);
            const lanternsOn = smooth((t - 10.4) / 1.5);
            lay.houses.forEach((hx, i) => {
                const gy = Math.round(lay.farB + Math.sin(hx * 0.06 + 2) * 2 + Math.sin(hx * 0.17) + bdy);
                const hw = 5 + (i % 2);
                px(ctx, farBc, hx, gy - 3, hw, 3);
                for (let r = 0; r < 3; r++) px(ctx, farBc, hx - 1 + r, gy - 4 - r, hw + 2 - r * 2, 1);
                const lit = t > 5 + i * 0.4;
                px(ctx, lit ? TP.gold : farBc, hx + 1, gy - 2, 1, 1);
                if (lit && hw > 5) px(ctx, TP.goldHi, hx + 3, gy - 2, 1, 1);
                if (lanternsOn > 0) { ctx.globalAlpha = lanternsOn; px(ctx, TP.gold, hx + hw, gy - 5, 1, 2); px(ctx, TP.goldHi, hx + hw, gy - 5, 1, 1); ctx.globalAlpha = 1; }
            });

            // ── Plan 4 : pic de la Lune (silhouette encre, liseré de lune sur la crête) ──
            const pdy = Math.round(camDy);
            const rim = lerpColor(TP.ink, TP.tealMid, 0.55);
            fillCols(ctx, TP.ink, x => ridgeAt(lay.ridge, x) + (x > lay.end + 12 ? Math.round(Math.sin(x * 1.3) * 0.9) : 0), pdy, rim);
            // marches du sentier
            for (let x = 2; x < lay.end; x += 5) px(ctx, lerpColor(TP.ink, TP.tealDeep, 0.6), x, Math.round(ridgeAt(lay.ridge, x)) + pdy + 1, 2, 1);

            // autel : dalle, socle, gâteaux, lueur chaude
            const ax = lay.altarX;
            const ay = lay.plateau + pdy;
            const cakesShown = [5.9, 6.4, 6.9, 7.4].filter(ts => t > ts).length;
            const altarGlow = smooth((t - 6) / 3);
            if (altarGlow > 0) {
                const gg = ctx.createRadialGradient(ax + 6, ay - 6, 1, ax + 6, ay - 6, 22);
                gg.addColorStop(0, `rgba(251,231,176,${0.45 * altarGlow})`);
                gg.addColorStop(0.6, `rgba(232,185,35,${0.12 * altarGlow})`);
                gg.addColorStop(1, 'rgba(232,185,35,0)');
                ctx.fillStyle = gg;
                ctx.fillRect(ax - 18, ay - 30, 48, 48);
            }
            px(ctx, TP.ink, ax, ay - 5, 13, 2);          // dalle
            px(ctx, TP.ink, ax + 2, ay - 3, 9, 3);       // socle
            px(ctx, TP.sand, ax, ay - 5, 13, 1);         // arête éclairée
            px(ctx, TP.goldHi, ax + 8, ay - 5, 5, 1);
            for (let i = 0; i < cakesShown; i++) {
                const cx = ax + 2 + i * 3;
                px(ctx, TP.gold, cx, ay - 7, 3, 2);
                px(ctx, TP.goldHi, cx + 1, ay - 7, 2, 1);
                px(ctx, TP.woodLo, cx, ay - 6, 1, 1);
            }
            // encens
            if (t > 7) {
                for (let i = 0; i < 7; i++) {
                    ctx.globalAlpha = 0.5 * (1 - i / 7) * smooth((t - 7) / 1.5);
                    px(ctx, TP.mist, ax + 6 + Math.sin(t * 1.6 + i * 0.9) * (1 + i * 0.3), ay - 9 - i * 2, 1, 1);
                }
                ctx.globalAlpha = 1;
            }
            // pins en silhouette sur la pente de droite + grain de roche (lueur de lune sur les arêtes)
            (P ? [68, 76, 84] : [84, 92, 101]).forEach((tx, k) => {
                const gy = Math.round(ridgeAt(lay.ridge, tx)) + pdy;
                for (let r = 0; r < 6; r++) px(ctx, TP.ink, tx - (5 - r), gy - 3 - r * 2 - k, (5 - r) * 2 + 1, 2);
                px(ctx, TP.ink, tx, gy - 4, 1, 4);
            });
            const grain = lerpColor(TP.ink, TP.tealDeep, 0.55);
            for (let i = 0; i < 70; i++) {
                const gx = (i * 53 + 7) % W;
                const gy2 = Math.round(ridgeAt(lay.ridge, gx)) + pdy + 3 + ((i * 29) % 40);
                if (gy2 < H) px(ctx, i % 4 ? grain : lerpColor(TP.ink, TP.tealMid, 0.5), gx, gy2, i % 3 ? 1 : 2, 1);
            }

            // ── Hou Yi : montée, offrande, salut ──
            const hx = lay.start + (lay.end - lay.start) * smooth((t - 0.3) / 5.2);
            const hy = ridgeAt(lay.ridge, hx + 6) + pdy - 21;
            let pose = 'idle';
            if (t < 5.5) pose = 'walk';
            else if (t < 7.9) pose = 'offer';
            else if (t > 10.2) pose = 'wave';
            const offering = t >= 5.5 && t < 7.9;
            endHero(ctx, hx, hy, pose, t);
            if (offering && cakesShown < 4) { // corbeille encore tenue pendant l'offrande
                px(ctx, TP.woodHi, hx + 14, hy + 14, 5, 3);
                px(ctx, TP.gold, hx + 15, hy + 13, 3, 1);
            }

            // ── Pétales / pollen doré qui tombent de la lune ──
            const n = P ? 26 : 34;
            for (let i = 0; i < n; i++) {
                const k = (i * 37 % 100) / 100;
                const v = 0.025 + (i % 5) * 0.008;
                const yy = (((k * 1.7 + t * v) % 1) + 1) % 1;
                const fade = smooth((t - 2 - (i % 6) * 0.7) / 2);
                ctx.globalAlpha = fade * (0.35 + 0.65 * Math.abs(Math.sin(t * 2 + i)));
                px(ctx, [TP.goldHi, TP.gold, TP.cream][i % 3], ((i * 53 % 100) / 100) * W + Math.sin(t * 0.9 + i) * 4 - yy * 14, yy * H, i % 4 === 0 ? 2 : 1, 1);
            }
            ctx.globalAlpha = 1;

            // ── Lanternes qui montent (des villages et de l'autel) ──
            const srcs = lay.houses.map(hx2 => [hx2 + 3, lay.farB - 8 + bdy]).concat([[ax + 3, ay - 10], [ax + 9, ay - 10], [ax + 6, ay - 12]]);
            srcs.forEach(([lx, ly], i) => {
                const ts = 10.4 + i * 0.32;
                const lt = t - ts;
                if (lt < 0) return;
                const x = lx + Math.sin(lt * 0.9 + i) * 3 + lt * (i % 2 ? 1.5 : -1.2);
                const y = ly - lt * (6 + (i % 4) * 1.6) - 2;
                const big = i % 3 === 0;
                const w = big ? 5 : 3;
                const h = big ? 7 : 5;
                const hr = big ? 9 : 6;
                const lg = ctx.createRadialGradient(x + w / 2, y + h / 2, 1, x + w / 2, y + h / 2, hr);
                lg.addColorStop(0, 'rgba(251,231,176,0.5)');
                lg.addColorStop(1, 'rgba(232,185,35,0)');
                ctx.globalAlpha = smooth(lt / 0.6);
                ctx.fillStyle = lg;
                ctx.fillRect(x + w / 2 - hr, y + h / 2 - hr, hr * 2, hr * 2);
                ctx.globalAlpha = smooth(lt / 0.6);
                px(ctx, TP.ink, x, y, w, 1);
                px(ctx, TP.gold, x, y + 1, w, h - 2);
                px(ctx, TP.goldHi, x + 1, y + 2, Math.max(1, w - 2), Math.max(1, h - 4));
                px(ctx, TP.brown, x, y + h - 1, w, 1);
                ctx.globalAlpha = 1;
            });

            // vignette d'encre en bas
            for (let i = 0; i < 12; i++) {
                ctx.globalAlpha = 0.04 * (i + 1);
                px(ctx, TP.ink, 0, H - 12 + i, W, 1);
            }
            ctx.globalAlpha = 1;

            // ── Textes (overlay HTML) ──
            showCaption(Math.min(ENDING_BEATS - 1, Math.floor(t / PROC_BEAT_SECONDS)));
            reveal('show-fin', t > (ENDING_BEATS - 1) * PROC_BEAT_SECONDS + 0.6);
            reveal('show-prompt', t >= DURATION);
        }
    });
}

// ── Générique de fin ────────────────────────────────────────────────────────
// Défile tout seul sur la musique de fin (main.js : `.cine-credits` → piste `ending`). Le joueur peut remonter pour relire :
// dès qu'il touche, roule ou presse une flèche, le défilement s'arrête et reprend après quelques secondes d'inactivité.
// À la fin, l'écran reste sur la dernière phrase et un bouton « Continuer » résout la Promise.
// Entrées : `{ type: 'title' | 'rule' | 'thanks' }` ou un bloc `{ role, names?, lines? }` (noms en gras, lignes en retrait).
export const CREDITS = [
    { type: 'title', text: 'La Légende de Hou Yi' },
    { role: 'Un jeu imaginé et créé par', names: ['Mickaël Fontaine'] },
    { type: 'rule' },
    { role: 'Concept original, réalisation et scénario', names: ['Mickaël Fontaine'] },
    { role: 'Inspiré librement de la mythologie chinoise', lines: ["Et notamment des légendes de Hou Yi et de Chang'e"] },
    { role: 'Inspiration et transmission', lines: ['Ethan, pour ses cours de chinois'] },
    { type: 'rule' },
    { role: "Avec le soutien de l'intelligence artificielle", lines: ['Assistance créative : Claude (Anthropic)', 'Musique : ACE-Step', 'Création visuelle : ComfyUI', 'Génération de textes : Ollama'] },
    { type: 'rule' },
    { role: 'Idées, suggestions et contributions', names: ['Ethan, Luna'] },
    { role: 'Tests et assurance qualité (QA)', names: ['Ethan, Luna, Vanessa'] },
    { role: 'Early bird', names: ['Jo et Arnaud'] },
    { type: 'rule' },
    { role: 'Remerciements', lines: ['À ma carte graphique, qui a affronté les flammes sans jamais rendre l\'âme.'] },
    { type: 'thanks', text: "À ma femme et mes enfants, qui m'ont suivi dans mon délire, je vous aime fort." }
];
export const CREDITS_SPEED = 42;          // px CSS par seconde
export const CREDITS_RESUME_MS = 3000;    // inactivité du joueur avant la reprise du défilement

const creditsHtml = c => c.type === 'rule' ? '<div class="cine-credits-rule"></div>'
    : c.type ? `<p class="cine-credits-${c.type}">${c.text}</p>`
    : `<div class="cine-credits-block"><p class="cine-credits-role">${c.role}</p>${(c.names || []).map(n => `<p class="cine-credits-name">${n}</p>`).join('')}${(c.lines || []).map(l => `<p class="cine-credits-line">${l}</p>`).join('')}</div>`;

export function playCredits() {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'cine-overlay cine-credits';
        overlay.innerHTML = `
            <div class="cine-credits-scroll" tabindex="0"><div class="cine-credits-roll">${CREDITS.map(creditsHtml).join('')}</div></div>
            <button type="button" class="cine-credits-skip">Passer ►►</button>
            <button type="button" class="cine-credits-continue">Continuer</button>`;
        document.body.appendChild(overlay);
        const scroller = overlay.querySelector('.cine-credits-scroll');
        const reduced = prefersReducedMotion();
        const maxScroll = () => Math.max(0, scroller.scrollHeight - scroller.clientHeight);
        let pos = 0, last = 0, raf = 0, idleUntil = 0, done = false, finished = false;
        const markDone = () => { done = true; overlay.classList.add('done'); };
        const frame = now => {
            const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
            last = now;
            if (!done && now >= idleUntil) {
                pos = Math.min(maxScroll(), pos + CREDITS_SPEED * dt);
                scroller.scrollTop = pos;
                if (pos >= maxScroll() - 1) markDone();   // reste sur la dernière phrase
            }
            raf = requestAnimationFrame(frame);
        };
        // Le joueur reprend la main (remonter pour relire) : on se cale sur sa position et on attend avant de reprendre.
        const userTouch = () => { pos = scroller.scrollTop; idleUntil = performance.now() + CREDITS_RESUME_MS; };
        ['wheel', 'touchstart', 'touchmove', 'pointerdown'].forEach(ev => scroller.addEventListener(ev, userTouch, { passive: true }));
        scroller.addEventListener('scroll', () => {
            if (!done && scroller.scrollTop >= maxScroll() - 1 && !reduced) markDone();
        });
        const toEnd = () => { scroller.scrollTop = pos = maxScroll(); markDone(); };
        const close = () => {
            if (finished) return;
            finished = true;
            cancelAnimationFrame(raf);
            document.removeEventListener('keydown', onKey, true);
            overlay.classList.add('closing');
            setTimeout(() => { overlay.remove(); resolve(); }, 350);
        };
        const onKey = e => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'PageUp' || e.key === 'PageDown') { userTouch(); return; }
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                if (done) close(); else toEnd();
            }
        };
        document.addEventListener('keydown', onKey, true);
        overlay.querySelector('.cine-credits-skip').addEventListener('click', toEnd);
        overlay.querySelector('.cine-credits-continue').addEventListener('click', close);
        if (reduced) markDone();   // pas de défilement automatique : lecture à la main, bouton déjà là
        else raf = requestAnimationFrame(frame);
    });
}
