// Animations « pixel art » plein écran : intro de la partie, fin de la légende, dialogues de boss.
// Les scènes sont dessinées sur un canvas basse définition (160×90) agrandi sans lissage.
// Chaque scène retourne une Promise résolue à la fin ou au toucher/clic/touche (passer).
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
    skip.textContent = 'Toucher pour passer ▶';
    overlay.append(canvas, skip);
    document.body.appendChild(overlay);
    return { overlay, canvas, ctx: canvas.getContext('2d') };
}

// Boucle d'animation commune : draw(ctx, t en secondes) jusqu'à `duration`, puis attend un toucher.
function runScene({ extraClass, duration, draw, startSfx, holdAfter = true }) {
    return new Promise(resolve => {
        const { overlay, canvas, ctx } = mount(extraClass);
        ctx.imageSmoothingEnabled = false;
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
export function playEndingAnimation() {
    const DURATION = 14;
    return runScene({
        extraClass: 'cine-ending',
        duration: DURATION,
        startSfx: 'endingJingle',
        draw(ctx, t, done) {
            const gy = H - (P ? 26 : 16);             // ligne de sol
            const mx = P ? Math.round(W * 0.58) : 100; // centre de la lune
            const my = P ? Math.round(H * 0.34) : 36;
            const mr = (P ? 24 : 20) + Math.min(4, t * 0.5);
            const nightK = Math.min(1, t / 4);
            sky(ctx, lerpColor('#c4476a', PAL.night[0], nightK), lerpColor('#ffc46b', PAL.night[3], nightK));
            stars(ctx, t, P ? 36 : 50, nightK);
            moon(ctx, mx, my, mr);

            // Silhouette de Chang'e dans la lune, main levée (apparaît à 6 s)
            if (t > 6) {
                ctx.globalAlpha = Math.min(1, (t - 6) / 2);
                const c = '#f6c6ff';
                px(ctx, c, mx - 2, my - 12, 4, 4);
                px(ctx, c, mx - 4, my - 8, 8, 12);
                px(ctx, c, mx - 6, my + 4, 12, 3);
                const wave = Math.floor(t * 2) % 2;
                px(ctx, c, mx + 4 + wave, my - 10 - wave, 2, 8);
                ctx.globalAlpha = 1;
            }

            // Pic de la Lune, autel et gâteaux
            const peakX = P ? Math.round(W * 0.55) : 62;
            for (let y = 0; y < 14; y++) px(ctx, PAL.ground, peakX - (6 + y * 3), gy - 12 + y, 12 + y * 6, 1);
            px(ctx, PAL.ground, 0, gy, W, H - gy);
            const ax = P ? Math.round(W * 0.42) : 54;
            px(ctx, '#e8e8f0', ax, gy - 8, 18, 3);
            for (let i = 0; i < 4; i++) disc(ctx, '#e8c070', ax + 3 + i * 4, gy - 10, 1);

            // Hou Yi près de l'autel
            archer(ctx, P ? 6 : 36, gy - 24, 0, t);

            // Lanternes qui montent
            const n = P ? 7 : 9;
            for (let i = 0; i < n; i++) {
                const lt = t - 8 - i * 0.6;
                if (lt < 0) continue;
                const x = 8 + i * ((W - 16) / n) + Math.sin(lt + i) * 3;
                const y = gy - lt * 7;
                if (y > -4) { px(ctx, '#ff8a1f', x, y, 3, 4); px(ctx, '#ffd24a', x + 1, y + 1, 1, 2); }
            }

            if (t > 10.5) {
                const k = Math.floor((t - 10.5) * 8);
                text(ctx, 'FIN'.slice(0, k), W / 2, P ? 18 : 14, 12, '#ffd24a');
                const cap = P ? ["Chaque automne,", "quelqu'un vous sourira."] : ["Chaque automne, quelqu'un vous sourira."];
                let left = Math.max(0, k * 2 - 6);
                cap.forEach((line, i) => {
                    text(ctx, line.slice(0, left), W / 2, H - (P ? 12 - i * 8 : 6), 5, '#fff4c8');
                    left = Math.max(0, left - line.length);
                });
            }
            if (done && Math.floor(t * 2) % 2 === 0) text(ctx, 'Toucher pour continuer', W / 2, 6, 5, '#ffffff');
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
    'Je ne suis plus votre disciple. Aujourd\'hui, c\'est moi qui tends l\'arc !',
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
            portrait.innerHTML = isBoss ? spriteHtml : '🏹';
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

let portraitCache = null;
function buildPortrait() {
    if (portraitCache) return portraitCache;
    // Arc et carquois derrière l'épaule
    const back = makeLayer(g => {
        gPoly(g, '#6a4a2c', [[62, 60], [88, 54], [93, 88], [66, 92]]);
        for (let k = 0; k < 6; k++) {
            gLine(g, '#b07a40', [[66 + k * 3.4, 66], [70 + k * 3.4 + k * 0.8, 38 - k * 2]], 1);
            gEll(g, k % 2 ? '#e4e6ea' : '#c4c8ce', 65 + k * 3.4, 64, 2.2, 6, 0.1);
        }
        gPoly(g, '#3a2618', [[70, 0], [77, 0], [78, 10], [81, 30], [87, 52], [91, 72], [86, 75], [80, 57], [73, 35], [70, 12]]);
        gLine(g, '#6b4a2c', [[75, 2], [76, 12], [79, 30], [85, 52]], 1);
        gPoly(g, '#b08040', [[68, 6], [79, 6], [79, 10], [68, 10]]);
        gLine(g, '#f1e6c8', [[69, 11], [60, 78]], 1);
    });
    // Buste : cou, robe bleue à liserés dorés, baudrier, épaule nue
    const body = makeLayer(g => {
        gPoly(g, '#2f6c9a', [[2, 120], [6, 92], [24, 76], [40, 70], [58, 72], [74, 70], [92, 78], [99, 96], [100, 120]]);
        gPoly(g, '#1f4a72', [[2, 120], [6, 92], [24, 76], [34, 86], [26, 120]]);
        gPoly(g, '#4a8dbb', [[60, 72], [92, 78], [99, 96], [88, 86], [70, 80]]);
        gPoly(g, '#8a5a34', [[80, 98], [99, 98], [100, 120], [74, 120]]);
        gPoly(g, '#6e4425', [[80, 98], [88, 104], [84, 120], [74, 120]]);
        gLine(g, '#d9a441', [[28, 80], [46, 99], [62, 90], [78, 96]], 1);
        gLine(g, '#d9a441', [[58, 100], [82, 92], [99, 98]], 1);
        gLine(g, '#e8c06a', [[60, 73], [92, 79]], 1);
        gPoly(g, '#b87444', [[38, 56], [60, 56], [62, 78], [50, 96], [36, 80]]);
        gPoly(g, '#8a5530', [[38, 60], [60, 60], [60, 70], [40, 70]]);
        gPoly(g, '#e8e6df', [[36, 76], [44, 98], [54, 82], [46, 72]]);
        gPoly(g, '#c9c7c0', [[44, 98], [54, 82], [50, 82]]);
        gPoly(g, '#7a4a42', [[10, 102], [20, 90], [42, 120], [26, 120]]);
        gLine(g, '#a8706a', [[20, 90], [42, 120]], 1);
    });
    // Tête : chignon, cheveux, visage éclairé de côté, sourcils, yeux, moustache et bouc
    const head = makeLayer(g => {
        gEll(g, '#17110d', 48, 26, 22, 18);
        gEll(g, '#17110d', 68, 12, 6, 7);
        gPoly(g, '#8a5a2a', [[66, 17], [71, 17], [71, 19], [66, 19]]);
        gPoly(g, '#cf8f55', [[30, 26], [36, 20], [60, 20], [66, 26], [66, 44], [62, 56], [54, 64], [44, 64], [36, 56], [31, 44]]);
        gPoly(g, '#b4733f', [[30, 26], [36, 22], [37, 56], [31, 44]]);
        gPoly(g, '#e0a068', [[56, 28], [64, 28], [64, 46], [60, 54], [58, 40]]);
        gEll(g, '#d8905a', 67, 38, 3, 5);
        gEll(g, '#c0603c', 67, 38, 1.4, 3);
        gPoly(g, '#17110d', [[28, 30], [30, 18], [40, 10], [56, 10], [66, 18], [68, 32], [64, 26], [58, 19], [48, 17], [38, 19], [32, 26]]);
        gLine(g, '#17110d', [[64, 24], [63, 52]], 1.6);
        gLine(g, '#17110d', [[31, 26], [30, 48]], 1.6);
        gLine(g, '#43362b', [[40, 13], [56, 13]], 1);
        gLine(g, '#0a0705', [[48, 11], [48, 18]], 1);
        gLine(g, '#120c08', [[34, 29.5], [45, 28.2]], 2.2);
        gLine(g, '#120c08', [[50, 28.2], [62, 30.2]], 2.2);
        gEll(g, '#efe0cc', 40, 34, 4.6, 2.4);
        gEll(g, '#efe0cc', 56, 35, 4.6, 2.4);
        gEll(g, '#4a2c18', 41, 34.2, 2.2, 2.2);
        gEll(g, '#4a2c18', 57.5, 35.2, 2.2, 2.2);
        gEll(g, '#120c08', 41, 34.2, 1, 1);
        gEll(g, '#120c08', 57.5, 35.2, 1, 1);
        gLine(g, '#1a100a', [[35, 32.4], [45, 32.2]], 1.2);
        gLine(g, '#1a100a', [[51, 33], [62, 33.4]], 1.2);
        gLine(g, '#a8683a', [[36, 37.5], [44, 37.5]], 1);
        gLine(g, '#a8683a', [[52, 38.5], [60, 38.5]], 1);
        gPoly(g, '#b4733f', [[49, 36], [46, 46], [50, 48], [53, 46], [52, 38]]);
        gEll(g, '#e0a068', 50, 45, 2, 1.2);
        gPoly(g, '#120c08', [[39, 51], [46, 47], [50, 48.5], [54, 47], [61, 51], [56, 51.5], [50, 50.5], [44, 51.5]]);
        gEll(g, '#6a2a22', 50, 54.5, 3.2, 1.6);
        gEll(g, '#b0583e', 50, 52.8, 3.6, 1);
        gPoly(g, '#120c08', [[46, 57], [54, 57], [53, 66], [50, 69], [47, 66]]);
        gLine(g, '#3a2418', [[37, 50], [41, 62], [46, 65]], 1);
        gLine(g, '#3a2418', [[62, 50], [58, 62], [54, 65]], 1);
    });
    portraitCache = { back, body, head };
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
            c: ['#1e5a3a', '#2f7a46', '#58a64e', '#9acb5a', '#d6e27a'][Math.floor(rnd() * 5)],
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
            <div class="title-start">▶ Toucher pour commencer</div>`;
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

            // Ciel / sous-bois en bandes
            const bands = 18;
            for (let i = 0; i < bands; i++) {
                px(ctx, lerpColor('#17456e', '#9fd3e0', i / (bands - 1)), 0, Math.floor(i * H / bands), W, Math.ceil(H / bands) + 1);
            }
            // troncs lointains (parallaxe lente)
            ctx.globalAlpha = 0.35;
            for (let i = 0; i < 6; i++) {
                const x = ((i * 47 + 13) % W) + Math.round(Math.sin(t * 0.3 + i) * 1);
                px(ctx, '#123d5e', x, 0, 5 + (i % 3) * 3, H);
            }
            ctx.globalAlpha = 1;
            // taches de lumière (bokeh carré)
            for (let i = 0; i < 26; i++) {
                ctx.globalAlpha = 0.12 + 0.1 * Math.sin(t * 0.8 + i);
                px(ctx, '#d9f3f0', (i * 43) % W, ((i * 29) % H) + camY, 4 + (i % 4) * 2, 4 + (i % 3) * 2);
            }
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
                px(ctx, '#cf8f55', hx + 35, hy + 32, 11, 4);
                px(ctx, '#cf8f55', hx + 51, hy + 33, 11, 4);
                px(ctx, '#1a100a', hx + 35, hy + 35, 10, 1);
                px(ctx, '#1a100a', hx + 51, hy + 36, 11, 1);
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
                ctx.fillStyle = '#f4fff8';
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
                px(ctx, '#fff6c0', p.x * W + Math.sin(t + p.p) * 3, y * H, 1, 1);
            });
            ctx.globalAlpha = 1;

            // Vignette basse pour la lisibilité du titre
            for (let i = 0; i < 14; i++) {
                ctx.globalAlpha = 0.035 * (i + 1);
                px(ctx, '#050818', 0, H - 14 + i, W, 1);
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
