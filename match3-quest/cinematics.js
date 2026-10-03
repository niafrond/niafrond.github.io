// Animations « pixel art » plein écran : intro de la partie, fin de la légende, dialogues de boss.
// Les scènes sont dessinées sur un canvas basse définition (160×90) agrandi sans lissage.
// Chaque scène retourne une Promise résolue à la fin ou au toucher/clic/touche (passer).
import { playSfx } from './sound.js';

const W = 160;
const H = 90;

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
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    canvas.className = 'cine-canvas';
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
        const y = (i * 61 + i * i * 7 + 3) % 52;
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

function fusangTree(ctx) {
    px(ctx, PAL.tree, 18, 40, 5, 50);              // tronc
    px(ctx, PAL.tree, 8, 74, 25, 16);              // racines
    const branches = [[10, 36, 22], [4, 28, 14], [26, 30, 22], [18, 20, 14], [8, 14, 12], [28, 16, 14]];
    branches.forEach(([x, y, w]) => { px(ctx, PAL.tree, x, y, w, 3); px(ctx, PAL.tree, x + 2, y - 2, w - 4, 2); });
}

const TREE_SUNS = [[12, 33], [8, 25], [30, 27], [22, 17], [11, 11], [32, 13], [4, 34], [38, 35], [20, 8], [27, 38]];

// ── Intro de la partie ──────────────────────────────────────────────────────
export function playIntroAnimation() {
    const DURATION = 11;
    return runScene({
        extraClass: 'cine-intro',
        duration: DURATION,
        startSfx: 'introJingle',
        draw(ctx, t, done) {
            // Phase 1 (0–3,5 s) : nuit, la lune monte. Phase 2 (3,5–7 s) : les dix soleils s'élancent. Phase 3 : titre.
            const dayK = Math.max(0, Math.min(1, (t - 4.5) / 2.5));
            sky(ctx, lerpColor(PAL.night[0], '#a8321c', dayK), lerpColor(PAL.night[3], '#ffb347', dayK));
            stars(ctx, t, 44, 1 - dayK);
            const moonY = 62 - Math.min(t, 3.5) * 9 + dayK * 70;
            moon(ctx, 110, moonY, 11);

            fusangTree(ctx);
            // Dix soleils : dormants dans l'arbre, puis chacun s'élève vers le ciel (un toutes les 0,3 s).
            TREE_SUNS.forEach(([sx, sy], i) => {
                const launch = 3.5 + i * 0.3;
                const k = Math.max(0, t - launch);
                const x = sx + k * (6 + i * 3);
                const y = sy - k * k * 4 - k * 6;
                if (y > -8) sun(ctx, x, y, t < launch ? 2 : 3 + Math.min(2, k), t);
            });

            // Sol rouge brûlé et archer au premier plan
            px(ctx, lerpColor(PAL.ground, '#4a1608', dayK), 0, 76, W, 14);
            const aim = t > 7.5 ? 1 : 0;
            // rocher en surplomb
            px(ctx, '#2a1a20', 72, 78, 40, 12); px(ctx, '#3a2630', 76, 76, 30, 2);
            archer(ctx, 80 - Math.max(0, 6 - t) * 6, 53, aim, t);
            if (t > 8.6) { // la flèche file vers le ciel en laissant une traînée
                const k = t - 8.6;
                for (let i = 0; i < 6; i++) px(ctx, i ? '#ffd24a' : '#ffffff', 102 + (k - i * 0.03) * 22, 63 - (k - i * 0.03) * 34, 2, 1);
            }

            if (t > 6.5) {
                const n = Math.min(24, Math.floor((t - 6.5) * 14));
                text(ctx, 'HOU YI ET LES'.slice(0, n), W / 2, 14, 9);
                text(ctx, 'DIX SOLEILS'.slice(0, Math.max(0, n - 13)), W / 2, 27, 11, '#ffd24a');
            }
            if (done && Math.floor(t * 2) % 2 === 0) text(ctx, 'Toucher pour commencer', W / 2, 83, 6, '#ffffff');
        }
    });
}

// ── Fin de la légende ───────────────────────────────────────────────────────
export function playEndingAnimation() {
    const DURATION = 14;
    return runScene({
        extraClass: 'cine-ending',
        duration: DURATION,
        startSfx: 'endingJingle',
        draw(ctx, t, done) {
            const nightK = Math.min(1, t / 4);
            sky(ctx, lerpColor('#c4476a', PAL.night[0], nightK), lerpColor('#ffc46b', PAL.night[3], nightK));
            stars(ctx, t, 50, nightK);
            // Pleine lune, immense
            moon(ctx, 100, 36, 20 + Math.min(4, t * 0.5));

            // Silhouette de Chang'e dans la lune, main levée (apparaît à 6 s)
            if (t > 6) {
                const a = Math.min(1, (t - 6) / 2);
                ctx.globalAlpha = a;
                px(ctx, '#f6c6ff', 98, 24, 4, 4);
                px(ctx, '#f6c6ff', 96, 28, 8, 12);
                px(ctx, '#f6c6ff', 94, 40, 12, 3);
                const wave = Math.floor(t * 2) % 2;
                px(ctx, '#f6c6ff', 104 + wave, 26 - wave, 2, 8);
                ctx.globalAlpha = 1;
            }

            // Pic de la Lune, autel et gâteaux
            for (let y = 0; y < 14; y++) px(ctx, PAL.ground, 62 - (6 + y * 3), 62 + y, 12 + y * 6, 1);
            px(ctx, PAL.ground, 0, 74, W, 16);
            px(ctx, '#e8e8f0', 54, 66, 18, 3);
            for (let i = 0; i < 4; i++) disc(ctx, '#e8c070', 57 + i * 4, 64, 1);

            // Hou Yi assis, puis lève la main (à 9 s)
            archer(ctx, 36, 50, t > 9 ? 0 : 0, t);

            // Lanternes qui montent
            for (let i = 0; i < 9; i++) {
                const lt = t - 8 - i * 0.6;
                if (lt < 0) continue;
                const x = 20 + i * 15 + Math.sin(lt + i) * 3;
                const y = 80 - lt * 7;
                if (y > -4) { px(ctx, '#ff8a1f', x, y, 3, 4); px(ctx, '#ffd24a', x + 1, y + 1, 1, 2); }
            }

            if (t > 10.5) {
                const n = Math.floor((t - 10.5) * 8);
                text(ctx, 'FIN'.slice(0, n), W / 2, 14, 12, '#ffd24a');
                text(ctx, 'Chaque automne, quelqu\'un vous sourira.'.slice(0, Math.max(0, n * 2 - 6)), W / 2, 84, 5, '#fff4c8');
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
