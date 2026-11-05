// Socle des animations pixel art : taille de scène, montage plein écran, boucle runScene, primitives de dessin, palette du titre.
// Extrait de cinematics.js.
import { playSfx } from './sound.js';

// Animations « pixel art » plein écran : intro de la partie, fin de la légende, dialogues de boss.
// Les scènes sont dessinées sur un canvas basse définition (160×90) agrandi sans lissage.
// Chaque scène retourne une Promise résolue à la fin ou au toucher/clic/touche (passer).

// Taille logique de la scène : 16:9 en paysage, 9:16 en portrait (mise à jour à chaque scène).
export let W = 160;
export let H = 90;
export let P = false;

export const PAL = {
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

export const prefersReducedMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

export function mount(extraClass = '') {
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
export function runScene({ extraClass, duration, draw, startSfx, onMount, holdAfter = true }) {
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
export const px = (ctx, c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };

export function disc(ctx, c, cx, cy, r) {
    ctx.fillStyle = c;
    for (let y = -r; y <= r; y++) {
        const half = Math.floor(Math.sqrt(r * r - y * y) + 0.5);
        ctx.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1);
    }
}

export function lerpColor(a, b, k) {
    const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
    const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
    return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * k).toString(16).padStart(2, '0')).join('');
}

// Ciel en bandes (dégradé « posterisé » façon 16 bits) de `top` à `bottom`.
export function sky(ctx, top, bottom, bands = 9) {
    for (let i = 0; i < bands; i++) {
        px(ctx, lerpColor(top, bottom, i / (bands - 1)), 0, Math.floor(i * H / bands), W, Math.ceil(H / bands));
    }
}

export function stars(ctx, t, count = 40, alpha = 1) {
    ctx.globalAlpha = alpha;
    for (let i = 0; i < count; i++) {
        const x = (i * 97 + i * i * 13 + 11) % W;
        const y = (i * 61 + i * i * 7 + 3) % Math.floor(H * 0.58);
        const on = Math.floor(t * 2 + i) % 5 !== 0;
        px(ctx, on ? '#ffffff' : '#8a8ac8', x, y);
    }
    ctx.globalAlpha = 1;
}

export function moon(ctx, cx, cy, r) {
    disc(ctx, PAL.moon, cx, cy, r);
    disc(ctx, PAL.moonShade, cx + 2, cy + 2, Math.round(r * 0.35));
    disc(ctx, PAL.moonShade, cx - r * 0.4, cy - r * 0.2, Math.round(r * 0.2));
}

export function sun(ctx, cx, cy, r, t = 0) {
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

export function sprite(ctx, rows, colors, x, y) {
    rows.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
            const c = colors[row[i]];
            if (c) px(ctx, c, x + i, y + j);
        }
    });
}

// Héros stylé : robe rouge et or, écharpe qui flotte au vent, arc doré. `aim` = 1 : arc bandé, flèche lumineuse.
export function archer(ctx, x, y, aim = 0, t = 0) {
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
export function text(ctx, str, x, y, size = 8, color = '#fff4c8', align = 'center') {
    ctx.font = `${size}px "Pixelify Sans", "Press Start 2P", monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PAL.ink;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ctx.fillText(str, x + dx, y + dy);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
}


export const TP = {
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
