// Animations « pixel art » plein écran : intro de la partie, fin de la légende, dialogues de boss.
// Les scènes sont dessinées sur un canvas basse définition (160×90) agrandi sans lissage.
// Chaque scène retourne une Promise résolue à la fin ou au toucher/clic/touche (passer).
import { icon } from './icons.js';
import { playSfx } from './sound.js';

// Taille logique de la scène : 16:9 en paysage, 9:16 en portrait (mise à jour à chaque scène).
let W = 160;
let H = 90;
let P = false;

const PAL = {
    night: ['#0b0b2b', '#141446', '#1d1d63', '#2a2a80'],
    dawn: ['#3b1d5a', '#7a2f63', '#c4476a', '#f2845c', '#ffc46b'],
    ink: '#1b1030',
    moon: '#fff4c8',
    moonShade: '#e8d89a',
    sun: '#ff8a1f',
    sunHi: '#ffd24a',
    ground: '#120d24',
    tree: '#0a0a1a'
};

const prefersReducedMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

function mount(extraClass = '') {
    const overlay = document.createElement('div');
    overlay.className = `cine-overlay ${extraClass}`;
    P = window.innerHeight > window.innerWidth;
    W = P ? 90 : 160;
    H = P ? 160 : 90;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    canvas.className = P ? 'cine-canvas portrait' : 'cine-canvas';
    const skip = document.createElement('div');
    skip.className = 'cine-skip';
    skip.textContent = 'Toucher pour passer ►';
    overlay.append(canvas, skip);
    document.body.appendChild(overlay);
    return { overlay, canvas, ctx: canvas.getContext('2d') };
}

// Boucle d'animation commune : draw(ctx, t en secondes) jusqu'à `duration`, puis attend un toucher.
function runScene({ extraClass, duration, draw, startSfx, onMount, holdAfter = true }) {
    return new Promise(resolve => {
        const { overlay, canvas, ctx } = mount(extraClass);
        ctx.imageSmoothingEnabled = false;
        if (onMount) onMount(overlay);
        let raf = 0;
        let finished = false;
        const t0 = performance.now();
        const reduced = prefersReducedMotion();
        if (startSfx) playSfx(startSfx);

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
            const t = reduced ? duration : (now - t0) / 1000;
            draw(ctx, Math.min(t, duration), t >= duration);
            if (t >= duration && !holdAfter) { close(); return; }
            raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
        void canvas;
    });
}

// ── Primitives pixel art ────────────────────────────────────────────────────
const px = (ctx, c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };

function disc(ctx, c, cx, cy, r) {
    ctx.fillStyle = c;
    for (let y = -r; y <= r; y++) {
        const half = Math.floor(Math.sqrt(r * r - y * y) + 0.5);
        ctx.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1);
    }
}

function lerpColor(a, b, k) {
    const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
    const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
    return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * k).toString(16).padStart(2, '0')).join('');
}

// Ciel en bandes (dégradé « posterisé » façon 16 bits) de `top` à `bottom`.
function sky(ctx, top, bottom, bands = 9) {
    for (let i = 0; i < bands; i++) {
        px(ctx, lerpColor(top, bottom, i / (bands - 1)), 0, Math.floor(i * H / bands), W, Math.ceil(H / bands));
    }
}

function stars(ctx, t, count = 40, alpha = 1) {
    ctx.globalAlpha = alpha;
    for (let i = 0; i < count; i++) {
        const x = (i * 97 + i * i * 13 + 11) % W;
        const y = (i * 61 + i * i * 7 + 3) % Math.floor(H * 0.58);
        const on = Math.floor(t * 2 + i) % 5 !== 0;
        px(ctx, on ? '#ffffff' : '#8a8ac8', x, y);
    }
    ctx.globalAlpha = 1;
}

function moon(ctx, cx, cy, r) {
    disc(ctx, PAL.moon, cx, cy, r);
    disc(ctx, PAL.moonShade, cx + 2, cy + 2, Math.round(r * 0.35));
    disc(ctx, PAL.moonShade, cx - r * 0.4, cy - r * 0.2, Math.round(r * 0.2));
}

function sun(ctx, cx, cy, r, t = 0) {
    disc(ctx, PAL.sun, cx, cy, r);
    disc(ctx, PAL.sunHi, cx - 1, cy - 1, Math.max(1, r - 2));
    for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + t * 2;
        px(ctx, PAL.sunHi, cx + Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2));
    }
}

// Sprite du héros (12×24, regarde à droite). k contour · h cheveux · s peau · r/R robe · g or · w ceinture · p pantalon · b botte
const HERO = [
    '....kgk.....',
    '...khhhk....',
    '..khhhhhk...',
    '..khhhhhhk..',
    '..kssssshk..',
    '..ksskssk...',
    '..kssssssk..',
    '...kkssskk..',
    '..kggggggk..',
    '.kRrrrgrrRk.',
    '.kRrrrgrrRk.',
    '.krrrrgrrrk.',
    '.kggwwwwggk.',
    '.krrrrgrrrk.',
    '.kRrrrgrrRk.',
    '.kRrrrgrrRk.',
    '.kRRrrgrrRk.',
    '..kpppkppk..',
    '..kpppkppk..',
    '..kpppkppk..',
    '..kbbbkbbk..',
    '.kbbbbkbbbk.'
];
const HERO_COL = { k: '#1b1030', h: '#2b1a3f', s: '#f1c595', r: '#d63a2f', R: '#8e1d27', g: '#ffd24a', w: '#fff4c8', p: '#3a2a6a', b: '#5a3a1c' };

function sprite(ctx, rows, colors, x, y) {
    rows.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
            const c = colors[row[i]];
            if (c) px(ctx, c, x + i, y + j);
        }
    });
}

// Héros stylé : robe rouge et or, écharpe qui flotte au vent, arc doré. `aim` = 1 : arc bandé, flèche lumineuse.
function archer(ctx, x, y, aim = 0, t = 0) {
    // écharpe ondulante derrière le cou
    for (let i = 0; i < 12; i++) {
        const wave = Math.round(Math.sin(t * 6 + i * 0.7) * (1 + i * 0.12));
        px(ctx, i % 4 < 2 ? '#ff5a3c' : '#ffd24a', x + 3 - i, y + 8 + wave, 1, 2);
    }
    sprite(ctx, HERO, HERO_COL, x, y);
    // bras tendu
    if (aim) {
        px(ctx, HERO_COL.k, x + 9, y + 9, 8, 3);
        px(ctx, HERO_COL.s, x + 10, y + 10, 7, 1);
        // arc doré
        for (let i = 0; i < 16; i++) {
            const c = Math.round(Math.sin((i / 15) * Math.PI) * 4);
            px(ctx, '#ffd24a', x + 17 + c, y + 2 + i);
            px(ctx, '#b8801f', x + 18 + c, y + 2 + i);
        }
        px(ctx, '#fff4c8', x + 17, y + 2); px(ctx, '#fff4c8', x + 17, y + 17); // cordes
        px(ctx, '#fff4c8', x + 12, y + 10, 5, 1);
        // flèche lumineuse + halo pulsé
        const glow = 0.4 + 0.3 * Math.sin(t * 12);
        ctx.globalAlpha = glow;
        disc(ctx, '#ffe9a0', x + 19, y + 10, 4);
        ctx.globalAlpha = 1;
        px(ctx, '#ffffff', x + 11, y + 10, 10, 1);
        px(ctx, '#ffd24a', x + 20, y + 9, 1, 3);
    } else {
        px(ctx, HERO_COL.k, x + 9, y + 11, 3, 5);
        px(ctx, HERO_COL.s, x + 10, y + 12, 1, 3);
        for (let i = 0; i < 18; i++) { // arc tenu au pied
            const c = Math.round(Math.sin((i / 17) * Math.PI) * 3);
            px(ctx, '#ffd24a', x + 12 + c, y + 4 + i);
        }
    }
    // cheveux au vent
    px(ctx, HERO_COL.h, x + 1, y + 4 + Math.round(Math.sin(t * 5)), 2, 1);
    px(ctx, HERO_COL.h, x, y + 5 + Math.round(Math.sin(t * 5 + 1)), 2, 1);
}

// Texte pixel (police du jeu à très petite taille, agrandie sans lissage).
function text(ctx, str, x, y, size = 8, color = '#fff4c8', align = 'center') {
    ctx.font = `${size}px "Pixelify Sans", "Press Start 2P", monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PAL.ink;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ctx.fillText(str, x + dx, y + dy);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
}


// ── Fin de la légende ───────────────────────────────────────────────────────
// Palette : celle de l'écran de démarrage (`TP`, définie plus bas) : nuit teal, lune crème, lumière or/ambre,
// silhouettes encre. Quatre temps : crépuscule (montée du pic) → autel (gâteaux) → Chang'e dans la lune →
// lanternes des villages + « FIN ». Les plans (ciel, collines, village, pic) défilent à des vitesses différentes
// pendant que la caméra monte. Texte « FIN » / légende / invite en overlay HTML (`.cine-ending-*`).
const clamp01 = k => Math.max(0, Math.min(1, k));
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
function endHero(ctx, x0, y0, pose, t) {
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

export function playEndingAnimation() {
    const DURATION = 15.5;
    const C = P ? END_LAYOUT.port : END_LAYOUT.land;
    let stars = null;
    let overlayEl = null;
    const shown = {};
    const reveal = (cls, on) => { if (on && !shown[cls] && overlayEl) { shown[cls] = true; overlayEl.classList.add(cls); } };
    let layout = null;
    return runScene({
        extraClass: 'cine-ending',
        duration: DURATION,
        startSfx: 'endingJingle',
        onMount(overlay) {
            overlayEl = overlay;
            overlay.insertAdjacentHTML('beforeend', `
                <div class="cine-ending-text">
                    <div class="cine-ending-fin">FIN</div>
                    <div class="cine-ending-legend">Ainsi s'achève la légende de Hou Yi.<br>Chaque automne, là-haut, quelqu'un vous sourira.</div>
                </div>
                <div class="cine-ending-prompt">► Toucher pour continuer</div>`);
        },
        draw(ctx, t) {
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
            reveal('show-fin', t > 11.2);
            reveal('show-legend', t > 12.4);
            reveal('show-prompt', t >= DURATION);
        }
    });
}

// ── Dialogues de début de combat de boss ────────────────────────────────────
const SUN_TAUNTS = [
    'Petit archer ! Mon père Di Jun me protège. Tes flèches fondront avant de m\'atteindre !',
    'Pourquoi éteindre la joie ? Nous ne faisions que jouer dans le ciel…',
    'Brûle avec les rizières, Hou Yi ! Je ne tomberai pas comme mes frères.',
    'Neuf d\'entre nous doivent mourir ? Alors je serai le dernier à rire !',
    'Le ciel est à nous. Retourne à ta poussière, mortel !'
];
const SUN_REPLIES = [
    'Je ne tire pas par haine, je tire pour que la Terre revive.',
    'Le jeu est fini, soleil. Les hommes ont soif.',
    'Mes flèches n\'ont jamais manqué leur but. Pas aujourd\'hui non plus.'
];
const FENGMENG_TAUNTS = [
    'Maître… vous avez tout : le renom, l\'élixir, Chang\'e. Moi, que me reste-t-il ?',
    'Je ne serai pas toujours votre disciple. Aujourd\'hui, c\'est moi qui tends l\'arc !',
    'Regardez-moi enfin, Maître. Regardez-moi comme vous regardez les soleils !'
];
const FENGMENG_REPLIES = [
    'Fengmeng… baisse ton arc. Je ne veux pas te blesser.',
    'Tu as du talent, mais la jalousie guide mal les flèches.',
    'Si je dois te vaincre pour te retrouver, alors soit.'
];

function pick(list, seed) {
    let h = 0;
    for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return list[h % list.length];
}

// Lignes d'un échange de début de combat de boss : [{ who: 'boss' | 'hero', text }].
export function bossIntroLines(enc) {
    const name = enc?.boss?.name || enc?.name || 'Boss';
    const isRival = /fengmeng/i.test(name);
    const taunts = isRival ? FENGMENG_TAUNTS : SUN_TAUNTS;
    const replies = isRival ? FENGMENG_REPLIES : SUN_REPLIES;
    return [
        { who: 'boss', text: pick(taunts, name) },
        { who: 'hero', text: pick(replies, name + enc.level) }
    ];
}

// Boîte de dialogue pixel au-dessus de l'écran de transition : texte tapé lettre à lettre,
// toucher/clic/Entrée/Espace pour accélérer puis passer à la réplique suivante.
// `host` : l'élément `.battle-transition` ; `spriteHtml` : portrait du boss ; renvoie une Promise.
export function playBossDialogue(host, enc, spriteHtml, heroName = 'Hou Yi') {
    const lines = bossIntroLines(enc);
    const bossName = enc.boss?.name || enc.name;
    return new Promise(resolve => {
        const box = document.createElement('div');
        box.className = 'bt-dialog';
        box.innerHTML = `<div class="bt-dialog-portrait"></div>
            <div class="bt-dialog-body"><div class="bt-dialog-name"></div><div class="bt-dialog-text"></div></div>
            <div class="bt-dialog-next">▼</div>`;
        host.appendChild(box);
        const portrait = box.querySelector('.bt-dialog-portrait');
        const nameEl = box.querySelector('.bt-dialog-name');
        const textEl = box.querySelector('.bt-dialog-text');
        const reduced = prefersReducedMotion();
        let idx = 0;
        let typing = null;
        let full = '';
        let pos = 0;
        let ended = false;

        const showLine = () => {
            const line = lines[idx];
            const isBoss = line.who === 'boss';
            box.classList.toggle('hero', !isBoss);
            portrait.innerHTML = isBoss ? spriteHtml : icon('bow');
            nameEl.textContent = isBoss ? bossName : heroName;
            full = line.text;
            pos = 0;
            textEl.textContent = '';
            clearInterval(typing);
            if (reduced) { textEl.textContent = full; pos = full.length; return; }
            typing = setInterval(() => {
                pos++;
                textEl.textContent = full.slice(0, pos);
                if (pos % 3 === 0) playSfx('uiClick');
                if (pos >= full.length) clearInterval(typing);
            }, 28);
        };

        const finish = () => {
            if (ended) return;
            ended = true;
            clearInterval(typing);
            document.removeEventListener('keydown', onKey, true);
            host.removeEventListener('pointerdown', advance);
            box.remove();
            resolve();
        };
        const advance = () => {
            if (pos < full.length) { clearInterval(typing); pos = full.length; textEl.textContent = full; return; }
            idx++;
            if (idx >= lines.length) { finish(); return; }
            showLine();
        };
        const onKey = e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); advance(); }
            else if (e.key === 'Escape') { e.preventDefault(); finish(); }
        };
        host.addEventListener('pointerdown', advance);
        document.addEventListener('keydown', onKey, true);
        showLine();
    });
}

// ── Écran de démarrage (launcher) : portrait pixel art animé de Hou Yi ───────
// Le portrait est peint une seule fois sur 3 calques (carquois/arc, buste, tête) en 100×120, puis
// « posterisé » (alpha binaire) pour des bords nets ; l'animation déplace les calques (respiration,
// parallaxe), fait cligner les yeux, balance le feuillage et fait dériver les rayons de lumière.
//
// Palette unique (miroir des variables CSS `--title-*` de style.css) : décor = une seule teinte froide
// (teal), lumière/liserés/titre = une seule famille chaude (or/ambre, mêmes valeurs que `--rt-gold`,
// `--rt-sand-hi`, `--rt-cream` de retro.css), ombres teintées d'encre (`--rt-ink`, jamais de noir pur).
// La lumière vient du haut-droite : côté droit clair (…Hi), côté gauche ombré (…Lo).
const TP = {
    ink: '#2a0f10',                                            // encre du jeu (ombres, contours, cheveux)
    // décor froid (teal)
    tealDeep: '#0d3440', tealMid: '#1b5f68', tealLight: '#58a89f', mist: '#b4dcd0',
    // lumière chaude (or / ambre)
    gold: '#e8b923', goldHi: '#fbe7b0', cream: '#fbf1d8', sand: '#f0d9a0',
    // peau
    skinLo: '#a8683a', skin: '#cf8f55', skinHi: '#e8b57a', blush: '#b0583e',
    // cheveux (encre + reflet chaud)
    hair: '#2a0f10', hairHi: '#5a2f28',
    // robe teal à liserés or
    robeLo: '#123f4a', robe: '#1f6672', robeHi: '#3f9396',
    // bois / cuir
    woodLo: '#5a3418', wood: '#8a5a34', woodHi: '#b9823f', brown: '#7a1f24', brownHi: '#a8504a'
};
const PORTRAIT_W = 100;
const PORTRAIT_H = 120;

function makeLayer(drawFn) {
    const c = document.createElement('canvas');
    c.width = PORTRAIT_W;
    c.height = PORTRAIT_H;
    const g = c.getContext('2d', { willReadFrequently: true });
    drawFn(g);
    const d = g.getImageData(0, 0, PORTRAIT_W, PORTRAIT_H);
    for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] > 110 ? 255 : 0;
    g.putImageData(d, 0, 0);
    return c;
}
const gPoly = (g, col, pts) => { g.fillStyle = col; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };
const gEll = (g, col, x, y, rx, ry, rot = 0) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, 7); g.fill(); };
const gLine = (g, col, pts, w = 1) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'butt'; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); };

// Silhouette unie d'un calque (pour l'ombre portée sur le décor)
function silhouette(layer, color) {
    const c = document.createElement('canvas');
    c.width = PORTRAIT_W;
    c.height = PORTRAIT_H;
    const g = c.getContext('2d');
    g.drawImage(layer, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, PORTRAIT_W, PORTRAIT_H);
    return c;
}

let portraitCache = null;
function buildPortrait() {
    if (portraitCache) return portraitCache;
    // Arc et carquois derrière l'épaule
    const back = makeLayer(g => {
        gPoly(g, TP.wood, [[62, 60], [88, 54], [93, 88], [66, 92]]);
        gPoly(g, TP.woodHi, [[80, 56], [88, 54], [93, 88], [86, 90]]);
        for (let k = 0; k < 6; k++) {
            gLine(g, TP.woodHi, [[66 + k * 3.4, 66], [70 + k * 3.4 + k * 0.8, 38 - k * 2]], 1);
            gEll(g, k % 2 ? TP.cream : TP.sand, 65 + k * 3.4, 64, 2.2, 6, 0.1);
        }
        gPoly(g, TP.woodLo, [[70, 0], [77, 0], [78, 10], [81, 30], [87, 52], [91, 72], [86, 75], [80, 57], [73, 35], [70, 12]]);
        gLine(g, TP.wood, [[75, 2], [76, 12], [79, 30], [85, 52]], 1);
        gPoly(g, TP.gold, [[68, 6], [79, 6], [79, 10], [68, 10]]);
        gLine(g, TP.cream, [[69, 11], [60, 78]], 1);
    });
    // Buste : cou, robe teal à liserés or, baudrier, épaule nue
    const body = makeLayer(g => {
        gPoly(g, TP.robe, [[2, 120], [6, 92], [24, 76], [40, 70], [58, 72], [74, 70], [92, 78], [99, 96], [100, 120]]);
        gPoly(g, TP.robeLo, [[2, 120], [6, 92], [24, 76], [34, 86], [26, 120]]);
        gPoly(g, TP.robeHi, [[60, 72], [92, 78], [99, 96], [88, 86], [70, 80]]);
        gPoly(g, TP.wood, [[80, 98], [99, 98], [100, 120], [74, 120]]);
        gPoly(g, TP.woodLo, [[80, 98], [88, 104], [84, 120], [74, 120]]);
        gLine(g, TP.gold, [[28, 80], [46, 99], [62, 90], [78, 96]], 1);
        gLine(g, TP.gold, [[58, 100], [82, 92], [99, 98]], 1);
        gLine(g, TP.goldHi, [[60, 73], [92, 79]], 1);
        gPoly(g, TP.skin, [[38, 56], [60, 56], [62, 78], [50, 96], [36, 80]]);
        gPoly(g, TP.skinLo, [[38, 60], [60, 60], [60, 70], [40, 70]]);
        gPoly(g, TP.cream, [[36, 76], [44, 98], [54, 82], [46, 72]]);
        gPoly(g, TP.sand, [[44, 98], [54, 82], [50, 82]]);
        gPoly(g, TP.brown, [[10, 102], [20, 90], [42, 120], [26, 120]]);
        gLine(g, TP.brownHi, [[20, 90], [42, 120]], 1);
    });
    // Tête : chignon, cheveux, visage éclairé par la droite, sourcils, yeux, moustache et bouc
    const head = makeLayer(g => {
        gEll(g, TP.hair, 48, 26, 22, 18);
        gEll(g, TP.hair, 68, 12, 6, 7);
        gPoly(g, TP.gold, [[66, 17], [71, 17], [71, 19], [66, 19]]);
        gPoly(g, TP.skin, [[30, 26], [36, 20], [60, 20], [66, 26], [66, 44], [62, 56], [54, 64], [44, 64], [36, 56], [31, 44]]);
        gPoly(g, TP.skinLo, [[30, 26], [36, 22], [37, 56], [31, 44]]);
        gPoly(g, TP.skinHi, [[56, 28], [64, 28], [64, 46], [60, 54], [58, 40]]);
        gEll(g, TP.skin, 67, 38, 3, 5);
        gEll(g, TP.blush, 67, 38, 1.4, 3);
        gPoly(g, TP.hair, [[28, 30], [30, 18], [40, 10], [56, 10], [66, 18], [68, 32], [64, 26], [58, 19], [48, 17], [38, 19], [32, 26]]);
        gLine(g, TP.hair, [[64, 24], [63, 52]], 1.6);
        gLine(g, TP.hair, [[31, 26], [30, 48]], 1.6);
        gLine(g, TP.hairHi, [[44, 13], [58, 13]], 1);
        gLine(g, TP.ink, [[48, 11], [48, 18]], 1);
        gLine(g, TP.ink, [[34, 29.5], [45, 28.2]], 2.2);
        gLine(g, TP.ink, [[50, 28.2], [62, 30.2]], 2.2);
        gEll(g, TP.cream, 40, 34, 4.6, 2.4);
        gEll(g, TP.cream, 56, 35, 4.6, 2.4);
        gEll(g, TP.woodLo, 41, 34.2, 2.2, 2.2);
        gEll(g, TP.woodLo, 57.5, 35.2, 2.2, 2.2);
        gEll(g, TP.ink, 41, 34.2, 1, 1);
        gEll(g, TP.ink, 57.5, 35.2, 1, 1);
        gLine(g, TP.ink, [[35, 32.4], [45, 32.2]], 1.2);
        gLine(g, TP.ink, [[51, 33], [62, 33.4]], 1.2);
        gLine(g, TP.skinLo, [[36, 37.5], [44, 37.5]], 1);
        gLine(g, TP.skinLo, [[52, 38.5], [60, 38.5]], 1);
        gPoly(g, TP.skinLo, [[49, 36], [46, 46], [50, 48], [53, 46], [52, 38]]);
        gEll(g, TP.skinHi, 50, 45, 2, 1.2);
        gPoly(g, TP.ink, [[39, 51], [46, 47], [50, 48.5], [54, 47], [61, 51], [56, 51.5], [50, 50.5], [44, 51.5]]);
        gEll(g, TP.brown, 50, 54.5, 3.2, 1.6);
        gEll(g, TP.blush, 50, 52.8, 3.6, 1);
        gPoly(g, TP.ink, [[46, 57], [54, 57], [53, 66], [50, 69], [47, 66]]);
        gLine(g, TP.hairHi, [[37, 50], [41, 62], [46, 65]], 1);
        gLine(g, TP.hairHi, [[62, 50], [58, 62], [54, 65]], 1);
    });
    // Ombres portées (lumière en haut à droite → l'ombre tombe vers la gauche)
    const shade = { back: silhouette(back, TP.tealDeep), body: silhouette(body, TP.tealDeep), head: silhouette(head, TP.tealDeep) };
    portraitCache = { back, body, head, shade };
    return portraitCache;
}

// Feuillage : petits carrés de feuilles, répartis une fois pour toutes (graine fixe).
function makeLeaves() {
    const leaves = [];
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 90; i++) {
        const right = i % 3 === 0;
        leaves.push({
            x: right ? 0.62 + rnd() * 0.38 : rnd() * 0.42,
            y: (right ? 0 : 0.02) + rnd() * (right ? 0.26 : 0.38) * (1 - (right ? 0.3 : 0.4) * rnd()),
            s: 2 + Math.floor(rnd() * 3),
            c: [TP.tealDeep, TP.tealMid, TP.tealLight, TP.mist, TP.goldHi][Math.floor(rnd() * 5)],
            p: rnd() * 6
        });
    }
    return leaves;
}

export function playTitleScreen() {
    return new Promise(resolve => {
        const portrait = buildPortrait();
        const leaves = makeLeaves();
        const pollen = Array.from({ length: 36 }, (_, i) => ({ x: (i * 37 % 100) / 100, y: (i * 61 % 100) / 100, v: 0.01 + (i % 5) * 0.004, p: i }));
        const reduced = prefersReducedMotion();

        const overlay = document.createElement('div');
        overlay.className = 'title-screen';
        overlay.innerHTML = `
            <canvas class="title-canvas"></canvas>
            <div class="title-logo">
                <div class="title-kicker">LA LÉGENDE DE</div>
                <div class="title-main">HOU YI</div>
                <div class="title-sub">ET LES DIX SOLEILS</div>
            </div>
            <div class="title-start">► Toucher pour commencer</div>`;
        document.body.appendChild(overlay);
        const canvas = overlay.querySelector('canvas');
        const ctx = canvas.getContext('2d');
        let W = 0;
        let H = 0;
        let portraitMode = false;

        const resize = () => {
            const vw = window.innerWidth || 1;
            const vh = window.innerHeight || 1;
            portraitMode = vw < vh;
            if (portraitMode) { W = 100; H = Math.max(150, Math.round(100 * vh / vw)); }
            else { H = 130; W = Math.max(150, Math.round(130 * vw / vh)); }
            canvas.width = W;
            canvas.height = H;
            ctx.imageSmoothingEnabled = false;
        };
        resize();
        window.addEventListener('resize', resize);

        let raf = 0;
        let ended = false;
        const t0 = performance.now();

        const frame = now => {
            const t = reduced ? 3 : (now - t0) / 1000;
            const bobBody = Math.round(Math.sin(t * 1.3) * 1.2);
            const bobHead = Math.round(Math.sin(t * 1.3 - 0.7) * 1.4);
            const camY = Math.round(Math.sin(t * 0.45) * 2);
            const charX = portraitMode ? 0 : Math.round(W * 0.58 - PORTRAIT_W / 2);
            const charY = H - PORTRAIT_H + 6;

            // Ciel / sous-bois en bandes teal (sombre en haut → brume claire en bas)
            const bands = 18;
            for (let i = 0; i < bands; i++) {
                const k = i / (bands - 1);
                px(ctx, k < 0.55 ? lerpColor(TP.tealDeep, TP.tealMid, k / 0.55) : lerpColor(TP.tealMid, TP.mist, (k - 0.55) / 0.45), 0, Math.floor(i * H / bands), W, Math.ceil(H / bands) + 1);
            }
            // lueur chaude venant du haut-droite
            const glow = ctx.createRadialGradient(W * 0.92, -H * 0.05, 2, W * 0.92, -H * 0.05, Math.max(W, H) * 0.8);
            glow.addColorStop(0, 'rgba(251,231,176,0.55)');
            glow.addColorStop(0.5, 'rgba(232,185,35,0.14)');
            glow.addColorStop(1, 'rgba(232,185,35,0)');
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, W, H);
            // troncs lointains (parallaxe lente)
            ctx.globalAlpha = 0.35;
            for (let i = 0; i < 6; i++) {
                const x = ((i * 47 + 13) % W) + Math.round(Math.sin(t * 0.3 + i) * 1);
                px(ctx, TP.tealDeep, x, 0, 5 + (i % 3) * 3, H);
            }
            ctx.globalAlpha = 1;
            // taches de lumière (bokeh carré, plus chaudes vers la droite)
            for (let i = 0; i < 26; i++) {
                const bx = (i * 43) % W;
                ctx.globalAlpha = 0.12 + 0.1 * Math.sin(t * 0.8 + i);
                px(ctx, bx > W * 0.55 ? TP.goldHi : TP.mist, bx, ((i * 29) % H) + camY, 4 + (i % 4) * 2, 4 + (i % 3) * 2);
            }
            ctx.globalAlpha = 1;

            // halo chaud derrière la tête + ombre portée du personnage (côté gauche, lumière à droite)
            const hcx = charX + 48 + Math.round(Math.sin(t * 0.7) * 0.8);
            const hcy = charY + bobHead + 34;
            const halo = ctx.createRadialGradient(hcx + 4, hcy - 4, 4, hcx + 4, hcy - 4, 46);
            halo.addColorStop(0, 'rgba(251,231,176,0.42)');
            halo.addColorStop(1, 'rgba(232,185,35,0)');
            ctx.fillStyle = halo;
            ctx.fillRect(hcx - 50, hcy - 50, 100, 100);
            ctx.globalAlpha = 0.4;
            ctx.drawImage(portrait.shade.back, charX - 3, charY + bobBody + 2);
            ctx.drawImage(portrait.shade.body, charX - 3, charY + bobBody + 2);
            ctx.globalAlpha = 1;

            // Calque arrière (arc, carquois) : léger décalage opposé
            ctx.drawImage(portrait.back, charX + Math.round(Math.sin(t * 0.9) * 1), charY + bobBody - 1);
            ctx.drawImage(portrait.body, charX, charY + bobBody);
            // tête
            ctx.drawImage(portrait.head, charX + Math.round(Math.sin(t * 0.7) * 0.8), charY + bobHead);
            // clignement des yeux
            if (!reduced && (t % 4.2) < 0.16) {
                const hx = charX + Math.round(Math.sin(t * 0.7) * 0.8);
                const hy = charY + bobHead;
                px(ctx, TP.skin, hx + 35, hy + 32, 11, 4);
                px(ctx, TP.skin, hx + 51, hy + 33, 11, 4);
                px(ctx, TP.ink, hx + 35, hy + 35, 10, 1);
                px(ctx, TP.ink, hx + 51, hy + 36, 11, 1);
            }

            // Feuillage balancé par le vent
            leaves.forEach((l, i) => {
                const sway = Math.sin(t * 1.1 + l.p) * 1.5;
                px(ctx, l.c, l.x * W + sway, l.y * H + camY + Math.sin(t * 0.8 + i) * 0.6, l.s, l.s);
            });

            // Rayons de lumière dérivants
            for (let i = 0; i < 5; i++) {
                const a = 0.07 + 0.06 * Math.sin(t * 0.7 + i * 1.7);
                const x0 = ((i * 0.27 + t * 0.012) % 1.3 - 0.15) * W;
                ctx.globalAlpha = Math.max(0, a);
                ctx.fillStyle = TP.goldHi;
                ctx.beginPath();
                ctx.moveTo(x0, 0);
                ctx.lineTo(x0 + 10 + i * 3, 0);
                ctx.lineTo(x0 - 40 + i * 3 + 10, H);
                ctx.lineTo(x0 - 40 + i * 3, H);
                ctx.closePath();
                ctx.fill();
            }
            ctx.globalAlpha = 1;

            // Pollen / poussières montantes
            pollen.forEach(p => {
                const y = ((p.y - t * p.v) % 1 + 1) % 1;
                ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2 + p.p);
                px(ctx, TP.goldHi, p.x * W + Math.sin(t + p.p) * 3, y * H, 1, 1);
            });
            ctx.globalAlpha = 1;

            // Vignette basse pour la lisibilité du titre
            for (let i = 0; i < 14; i++) {
                ctx.globalAlpha = 0.035 * (i + 1);
                px(ctx, TP.ink, 0, H - 14 + i, W, 1);
            }
            ctx.globalAlpha = 1;

            if (!ended) raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);

        const start = () => {
            if (ended) return;
            ended = true;
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', resize);
            document.removeEventListener('keydown', onKey, true);
            playSfx('introJingle');
            overlay.classList.add('closing');
            setTimeout(() => { overlay.remove(); resolve(); }, 600);
        };
        const onKey = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); start(); } };
        overlay.addEventListener('pointerdown', start);
        document.addEventListener('keydown', onKey, true);
    });
}

// ── Prologue animé (nouvelle partie) ────────────────────────────────────────
// Cinq tableaux pixel art racontent STORY_INTRO avec la palette `TP` ; légende tapée lettre à lettre.
// Toucher : finir la légende puis passer au tableau suivant ; « Passer » ou Échap : tout sauter.
let prologuePlayed = false;
export const prologueAnimationPlayed = () => prologuePlayed;

const mixTP = (a, b, k) => lerpColor(TP[a] || a, TP[b] || b, Math.max(0, Math.min(1, k)));
const EMBER = () => mixTP('gold', 'brownHi', 0.55);

// Soleil pixel art : disque ambre, cœur or clair, rayons tournants ; `face` ajoute un visage rieur.
function tpSun(ctx, cx, cy, r, t, face = false) {
    for (let i = 0; i < 10; i++) {
        const a = i * Math.PI / 5 + t * 0.8;
        px(ctx, TP.gold, cx + Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2), 1, 1);
    }
    disc(ctx, EMBER(), cx, cy, r);
    disc(ctx, TP.gold, cx - 0.5, cy - 0.5, Math.max(1, r - 1));
    disc(ctx, TP.goldHi, cx - 1, cy - 1, Math.max(1, r - 3));
    if (face && r >= 4) {
        px(ctx, TP.ink, cx - 2, cy - 1, 1, 1);
        px(ctx, TP.ink, cx + 1, cy - 1, 1, 1);
        px(ctx, TP.ink, cx - 2, cy + 1, 5, 1);
        px(ctx, TP.ink, cx - 1, cy + 2, 3, 1);
    }
}

// Petit personnage de profil/face (7×16) : robe, cheveux, barbe ou chapeau selon les options.
function tpFigure(ctx, x, y, o) {
    const { robe, robeLo, hair, hat, beard, arms } = o;
    x = Math.round(x); y = Math.round(y);
    if (hat) { px(ctx, TP.gold, x, y, 8, 1); px(ctx, TP.ink, x + 1, y + 1, 6, 1); }
    px(ctx, hair, x + 1, y + (hat ? 2 : 1), 6, 2);
    px(ctx, TP.skinHi, x + 2, y + (hat ? 3 : 3), 4, 3);
    px(ctx, TP.ink, x + 3, y + 4, 1, 1);
    px(ctx, TP.ink, x + 5, y + 4, 1, 1);
    if (beard) px(ctx, TP.cream, x + 2, y + 6, 4, 3);
    px(ctx, robe, x, y + 7, 8, 8);
    px(ctx, robeLo, x, y + 7, 2, 8);
    px(ctx, TP.gold, x + 3, y + 7, 1, 8);
    px(ctx, TP.ink, x + 1, y + 15, 3, 1);
    px(ctx, TP.ink, x + 5, y + 15, 3, 1);
    if (arms === 'up') { px(ctx, robe, x - 2, y + 4, 2, 5); px(ctx, robe, x + 8, y + 4, 2, 5); px(ctx, TP.skinHi, x - 2, y + 3, 2, 1); px(ctx, TP.skinHi, x + 8, y + 3, 2, 1); }
}

const PRO_SCENES = [
    {   // 1. L'arbre Fusang : dix soleils endormis, le corbeau d'or traîne le char du jour
        dur: 8,
        caption: "Au commencement, les dix soleils, fils de Di Jun, dormaient dans l'Arbre Fusang et se levaient un à un, chacun son tour, dans un char traîné par un corbeau d'or.",
        draw(ctx, t) {
            sky(ctx, TP.tealDeep, mixTP('goldHi', 'sand', 0.5), 14);
            stars(ctx, t, 26, 0.5);
            const gy = Math.round(H * 0.8);
            for (let x = 0; x < W; x++) px(ctx, TP.tealMid, x, gy - 6 - Math.round(Math.sin(x * 0.07) * 4 + Math.sin(x * 0.19) * 2), 1, 14);
            px(ctx, TP.tealDeep, 0, gy, W, H - gy);
            const tx = Math.round(W * (P ? 0.5 : 0.32));
            px(ctx, TP.ink, tx - 3, gy - 38, 7, 40);
            [[-22, -34, 22], [4, -38, 22], [-14, -26, 30], [-26, -16, 20], [8, -20, 22]].forEach(([dx, dy, w]) => { px(ctx, TP.ink, tx + dx, gy + dy, w, 3); px(ctx, TP.ink, tx + dx + 2, gy + dy - 2, w - 4, 2); });
            [[-18, -36], [-4, -41], [14, -38], [22, -32], [-24, -28], [-8, -29], [8, -24], [-20, -18], [16, -16], [0, -34]].forEach(([dx, dy], i) => {
                tpSun(ctx, tx + dx, gy + dy, 2, t + i);
            });
            // corbeau d'or et son char : traverse le ciel
            const k = (t % 8) / 8;
            const bx = -10 + k * (W + 20);
            const by = H * 0.22 - Math.sin(k * Math.PI) * H * 0.1;
            const flap = Math.floor(t * 6) % 2;
            px(ctx, TP.gold, bx, by, 6, 3);
            px(ctx, TP.goldHi, bx + 5, by - 1, 3, 2);
            px(ctx, TP.gold, bx - 3 + flap, by - 3 + flap * 5, 4, 1);
            px(ctx, TP.gold, bx + 1, by - 3 + flap * 5, 4, 1);
            tpSun(ctx, bx - 12, by + 2, 3, t);
            px(ctx, TP.woodHi, bx - 9, by + 2, 9, 1);
        }
    },
    {   // 2. Les dix frères s'élancent ensemble : le fleuve tarit, les rizières jaunissent
        dur: 7.5,
        caption: "Mais un matin, les dix frères s'élancèrent ensemble, par jeu. Les fleuves tarirent, les rizières jaunirent, les forêts prirent feu, et les bêtes devinrent folles.",
        draw(ctx, t) {
            const heat = Math.min(1, t / 4);
            sky(ctx, mixTP('tealMid', 'brown', heat), mixTP('mist', 'gold', heat), 14);
            for (let i = 0; i < 10; i++) {
                const x = (i + 0.5) * (W / 10);
                const y = H * (0.12 + (i % 3) * 0.07) + Math.sin(t * 2 + i) * 2;
                tpSun(ctx, x, y, P ? 3 : 4, t + i);
            }
            const gy = Math.round(H * 0.62);
            // rizières qui jaunissent
            px(ctx, mixTP('tealLight', 'sand', heat), 0, gy, W, H - gy);
            for (let r = 0; r < 4; r++) for (let x = (r % 2) * 3; x < W; x += 6) px(ctx, mixTP('tealMid', 'woodHi', heat), x, gy + 8 + r * 8, 3, 2);
            // fleuve qui tarit
            const riverW = Math.max(2, Math.round((P ? 14 : 20) * (1 - heat * 0.9)));
            for (let y = gy; y < H; y++) px(ctx, TP.tealLight, Math.round(W * 0.5 + Math.sin(y * 0.15) * 5 - riverW / 2), y, riverW, 1);
            // flammes à l'horizon
            for (let x = 0; x < W; x += 3) {
                const fh = 3 + Math.abs(Math.sin(t * 7 + x)) * 6 * heat;
                px(ctx, EMBER(), x, gy - fh, 2, fh);
                px(ctx, TP.gold, x, gy - fh * 0.5, 1, fh * 0.5);
            }
        }
    },
    {   // 3. Yao supplie Di Jun, les soleils rient
        dur: 7,
        caption: "L'empereur Yao supplia Di Jun de rappeler ses fils. Les soleils rirent, et le ciel resta en feu.",
        draw(ctx, t) {
            sky(ctx, TP.brown, mixTP('gold', 'goldHi', 0.4), 14);
            for (let i = 0; i < 5; i++) {
                const x = W * (0.12 + i * 0.19);
                const y = H * 0.2 + Math.abs(Math.sin(t * 3 + i)) * -4 + (i % 2) * 8;
                tpSun(ctx, x, y, P ? 5 : 6, t + i, true);
            }
            const gy = Math.round(H * 0.8);
            px(ctx, TP.ink, 0, gy, W, H - gy);
            // marches du palais
            for (let s = 0; s < 4; s++) px(ctx, s % 2 ? TP.brown : TP.brownHi, Math.round(W * 0.2) - s * 4, gy - 4 - s * 3, Math.round(W * 0.6) + s * 8, 3);
            px(ctx, TP.brown, Math.round(W * 0.2) - 12, gy - 20, 4, 20);
            px(ctx, TP.brown, Math.round(W * 0.8) + 8, gy - 20, 4, 20);
            // l'empereur, bras levés, qui supplie
            const sway = Math.round(Math.sin(t * 3));
            tpFigure(ctx, W * 0.5 - 4, gy - 24 + sway, { robe: TP.gold, robeLo: TP.woodHi, hair: TP.ink, hat: true, arms: 'up' });
            tpFigure(ctx, W * 0.5 - 18, gy - 15, { robe: TP.robe, robeLo: TP.robeLo, hair: TP.ink });
            tpFigure(ctx, W * 0.5 + 12, gy - 15, { robe: TP.robe, robeLo: TP.robeLo, hair: TP.ink });
        }
    },
    {   // 4. Hou Yi, Chang'e, Fengmeng et l'élixir d'immortalité
        dur: 7,
        caption: "Alors Yao se souvint de Hou Yi, l'archer dont les flèches n'ont jamais manqué leur but. Près de lui : Chang'e, son épouse, Fengmeng, son disciple, et l'Élixir d'Immortalité.",
        draw(ctx, t) {
            sky(ctx, TP.tealDeep, TP.tealMid, 12);
            stars(ctx, t, 22, 0.8);
            const gy = Math.round(H * 0.78);
            const cx = Math.round(W / 2);
            moon(ctx, Math.round(W * 0.78), Math.round(H * 0.22), P ? 9 : 11);
            px(ctx, TP.ink, 0, gy, W, H - gy);
            // autel et élixir lumineux
            px(ctx, TP.brownHi, cx - 14, gy - 8, 28, 3);
            px(ctx, TP.brown, cx - 12, gy - 5, 24, 5);
            const glow = 0.35 + 0.25 * Math.sin(t * 3);
            ctx.globalAlpha = glow;
            disc(ctx, TP.goldHi, cx, gy - 16, 9);
            ctx.globalAlpha = 1;
            px(ctx, TP.mist, cx - 2, gy - 17, 5, 8);
            px(ctx, TP.gold, cx - 1, gy - 14, 3, 4);
            px(ctx, TP.cream, cx - 1, gy - 19, 3, 2);
            // les trois personnages
            endHero(ctx, cx - 6 - (P ? 16 : 32), gy - 22, 'idle', t);
            tpFigure(ctx, cx + 22, gy - 16, { robe: TP.gold, robeLo: TP.woodHi, hair: TP.ink });
            tpFigure(ctx, cx - 38 - (P ? 0 : 20), gy - 16, { robe: TP.brown, robeLo: TP.ink, hair: TP.ink });
        }
    },
    {   // 5. Rizières desséchées : en route vers le doyen Wen
        dur: 8,
        caption: "Vous êtes Hou Yi. Neuf soleils sont à abattre, un seul à épargner, afin que la Terre garde un jour. Le doyen Wen vous attend dans les Rizières Desséchées : allez lui parler.",
        draw(ctx, t) {
            sky(ctx, TP.brown, mixTP('gold', 'goldHi', 0.55), 14);
            tpSun(ctx, W * 0.78, H * 0.2, P ? 7 : 9, t);
            const gy = Math.round(H * 0.66);
            px(ctx, mixTP('sand', 'woodHi', 0.5), 0, gy, W, H - gy);
            // terre craquelée
            for (let i = 0; i < 40; i++) {
                const x = (i * 37) % W;
                const y = gy + 4 + ((i * 53) % Math.max(8, H - gy - 6));
                px(ctx, TP.woodLo, x, y, 3 + (i % 4), 1);
                px(ctx, TP.woodLo, x + 2, y + 1, 1, 2);
            }
            // tiges de riz mortes
            for (let x = 4; x < W; x += 9) { px(ctx, TP.woodHi, x, gy - 3, 1, 5); px(ctx, TP.sand, x + 1, gy - 4, 1, 2); }
            const walk = Math.min(1, t / 6);
            const hx = -14 + walk * (W * (P ? 0.35 : 0.55));
            endHero(ctx, hx, gy - 16, walk < 1 ? 'walk' : 'idle', t);
            // le doyen Wen, barbe blanche, bâton
            const ex = Math.round(W * (P ? 0.68 : 0.78));
            tpFigure(ctx, ex, gy - 17, { robe: TP.robeLo, robeLo: TP.ink, hair: TP.cream, beard: true });
            px(ctx, TP.woodHi, ex + 9, gy - 18, 1, 19);
            // poussière
            for (let i = 0; i < 12; i++) px(ctx, TP.sand, (i * 31 + t * 12) % W, gy + ((i * 7) % 6) - 6, 1, 1);
        }
    }
];

export function playPrologueAnimation() {
    return new Promise(resolve => {
        const { overlay, canvas, ctx } = mount('cine-prologue');
        ctx.imageSmoothingEnabled = false;
        void canvas;
        overlay.querySelector('.cine-skip')?.remove();
        overlay.insertAdjacentHTML('beforeend', `
            <div class="cine-prologue-caption"><div class="cine-prologue-text"></div><div class="cine-prologue-next">▼</div></div>
            <div class="cine-prologue-dots">${PRO_SCENES.map(() => '<i></i>').join('')}</div>
            <button type="button" class="cine-prologue-skip">Passer ►►</button>`);
        const textEl = overlay.querySelector('.cine-prologue-text');
        const dots = overlay.querySelectorAll('.cine-prologue-dots i');
        const reduced = prefersReducedMotion();
        playSfx('introJingle');
        let idx = 0;
        let sceneT0 = performance.now();
        let raf = 0;
        let done = false;
        const FADE = 0.5;

        const setScene = i => {
            idx = i;
            sceneT0 = performance.now();
            dots.forEach((d, n) => d.classList.toggle('on', n === i));
            textEl.textContent = '';
        };
        const finish = () => {
            if (done) return;
            done = true;
            prologuePlayed = true;
            cancelAnimationFrame(raf);
            document.removeEventListener('keydown', onKey, true);
            overlay.classList.add('closing');
            setTimeout(() => { overlay.remove(); resolve(); }, 350);
        };
        const fullLen = () => PRO_SCENES[idx].caption.length;
        const typed = () => (reduced ? fullLen() : Math.floor((performance.now() - sceneT0) / 1000 * 32));
        const advance = () => {
            if (typed() < fullLen()) { sceneT0 = performance.now() - fullLen() / 32 * 1000 - 50; return; }
            if (idx + 1 >= PRO_SCENES.length) finish(); else setScene(idx + 1);
        };
        const onKey = e => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); }
            else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); advance(); }
        };
        overlay.addEventListener('pointerdown', e => { if (!e.target.closest('.cine-prologue-skip')) advance(); });
        overlay.querySelector('.cine-prologue-skip').addEventListener('click', finish);
        document.addEventListener('keydown', onKey, true);
        setScene(0);

        const frame = now => {
            const sc = PRO_SCENES[idx];
            const t = (now - sceneT0) / 1000;
            sc.draw(ctx, reduced ? sc.dur : t);
            // fondu d'entrée du tableau
            if (!reduced && t < FADE) { ctx.globalAlpha = 1 - t / FADE; px(ctx, TP.ink, 0, 0, W, H); ctx.globalAlpha = 1; }
            const n = Math.min(fullLen(), typed());
            if (textEl.textContent.length !== n) textEl.textContent = sc.caption.slice(0, n);
            overlay.classList.toggle('caption-done', n >= fullLen());
            // enchaînement automatique après la légende + un temps de lecture
            if (!reduced && t > sc.dur + 2 && n >= fullLen()) { if (idx + 1 >= PRO_SCENES.length) { finish(); return; } setScene(idx + 1); }
            raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
    });
}
