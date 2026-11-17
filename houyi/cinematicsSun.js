// Chute d'un soleil (animation plein écran). Extrait de cinematics.js.
import { H, PAL, W, archer, disc, lerpColor, moon, px, runScene, sky, stars, sun } from './cinematicsCore.js';
import { clamp01 } from './cinematicsEnding.js';
import { loadSceneArt } from './cinematicsPrologue.js';

// ── Chute d'un soleil ───────────────────────────────────────────────────────
// Courte cinématique jouée après la défaite de chacun des neuf soleils : la flèche de Hou Yi frappe l'astre, il
// devient braise et tombe derrière l'horizon. Le ciel s'assombrit à chaque soleil abattu (1/9 → 9/9), la lune
// gagne en clarté et un compteur de neuf soleils s'éteint peu à peu.
export const SUN_FALL_CAPTIONS = [
    "Le premier soleil s'éteint sur les rizières. Un soir, enfin, descend sur la terre.",
    "Le deuxième soleil refroidit dans la roche. Le volcan s'endort sous les étoiles.",
    "Le troisième soleil se dissipe comme un mirage. Le désert, pour une fois, se tait.",
    "Le quatrième soleil s'abîme dans la vase du fleuve. L'eau, au loin, murmure de nouveau.",
    "Le cinquième soleil se défait en cendres. Dans la forêt, une première goutte de pluie tombe.",
    "Le sixième soleil se tait dans un dernier éclair. Les nuages respirent.",
    "Le septième soleil retombe sur les herbes. Les loups hurlent à la lune, comme avant.",
    "Le huitième soleil plonge dans la mer. L'écume, enfin, redevient fraîche.",
    "Le dernier soleil de la Terre tombe, et il ne reste qu'un seul astre : celui qui éclaire les hommes."
];

// Rang de chaque soleil dans l'ordre des régions (les ids ne le suivent pas) : légende et tableau Pixel Lab propres à chaque
// soleil, quel que soit l'ordre dans lequel ils tombent.
export const SUN_RANK = { sun_1: 1, sun_6: 2, sun_4: 3, sun_2: 4, sun_3: 5, sun_5: 6, sun_7: 7, sun_8: 8, sun_9: 9 };

// Tableaux animés de la chute (tools/gen-prologue.mjs --set=sunfall), gardés en mémoire une fois chargés ; null si absents.
const sunArtCache = new Map();
function loadSunArt(rank, portrait) {
    const key = `${rank}-${portrait ? 'port' : 'land'}`;
    if (!sunArtCache.has(key)) {
        sunArtCache.set(key, loadSceneArt('sunfall', 9, portrait, [rank]).then(a => {
            if (!a) sunArtCache.delete(key);
            return a ? a[0] : null;
        }));
    }
    return sunArtCache.get(key);
}

// `id` : identifiant du soleil abattu (rang, légende, tableau) ; à défaut, `count` = nombre de soleils déjà tombés.
export async function playSunFallAnimation({ count = 1, name = 'Soleil', id } = {}) {
    const n = SUN_RANK[id] || Math.max(1, Math.min(9, count));
    const DURATION = 7;
    const caption = SUN_FALL_CAPTIONS[n - 1];
    const art = await loadSunArt(n, window.innerHeight > window.innerWidth);
    const ART_FPS = 3;   // 13 images ≈ 4,3 s, puis la dernière image est tenue
    const FALLEN_AT = art ? Math.min(DURATION - 1, art.frames / ART_FPS) : 5.0;
    // Compteur de neuf soleils : les tombés sont éteints, le soleil en train de tomber s'éteint à la fin de sa chute.
    const drawCounter = (ctx, t, width) => {
        const gap = 9;
        const cx0 = Math.round(width / 2 - (8 * gap) / 2);
        for (let i = 0; i < 9; i++) {
            const fallen = i < n - 1 || (i === n - 1 && t >= FALLEN_AT);
            disc(ctx, fallen ? '#2a2a50' : PAL.sun, cx0 + i * gap, 6, 2);
            if (!fallen) px(ctx, PAL.sunHi, cx0 + i * gap - 1, 5, 1, 1);
        }
    };
    return runScene({
        extraClass: 'cine-sunfall',
        duration: DURATION,
        startSfx: 'bossStart',
        onMount(overlay) {
            if (art) {
                const c = overlay.querySelector('canvas');
                c.width = art.size[0];
                c.height = art.size[1];
            }
            const box = document.createElement('div');
            box.className = 'cine-sunfall-text';
            const title = document.createElement('div');
            title.className = 'cine-sunfall-title';
            title.textContent = `${name} est tombé`;
            const line = document.createElement('div');
            line.className = 'cine-sunfall-line';
            line.textContent = caption;
            box.append(title, line);
            overlay.append(box);
        },
        draw(ctx, t) {
            if (art) {
                // le canvas a été redimensionné après le premier réglage : le lissage est à remettre à chaque image
                ctx.imageSmoothingEnabled = false;
                const [aw, ah] = art.size;
                const fi = Math.min(art.frames - 1, Math.floor(t * ART_FPS));
                ctx.drawImage(art.img, fi * aw, 0, aw, ah, 0, 0, aw, ah);
                drawCounter(ctx, t, aw);
                return;
            }
            const darkK = n / 9;
            const horizon = Math.round(H * 0.78);
            // ciel : crépuscule doré → nuit selon le nombre de soleils tombés
            const top = lerpColor('#c4476a', '#0b0b2b', Math.min(1, darkK * 1.1));
            const bot = lerpColor('#ffc46b', '#2a2a80', Math.min(1, darkK * 1.05));
            sky(ctx, top, bot, 16);
            if (darkK > 0.3) stars(ctx, t, Math.round(60 * darkK), Math.min(1, (darkK - 0.3) * 1.6));
            moon(ctx, Math.round(W * 0.82), Math.round(H * 0.16), Math.round(4 + darkK * 5));

            // soleil : plane, est touché par la flèche (2,2 s), devient braise et chute (2,8 → 5,2 s)
            const sx = W * 0.5;
            const sy0 = H * 0.3;
            const r = 10;
            const fallT = clamp01((t - 2.8) / 2.4);
            const sy = sy0 + fallT * fallT * (horizon - sy0 + r + 4);
            if (t < 2.8) {
                ctx.globalAlpha = 0.25;
                disc(ctx, PAL.sunHi, sx, sy0, r + 5 + Math.round(Math.sin(t * 6)));
                ctx.globalAlpha = 1;
                sun(ctx, sx, sy0 + Math.round(Math.sin(t * 3)), r, t);
            } else if (fallT < 1) {
                const k = Math.min(1, fallT * 2);
                disc(ctx, lerpColor(PAL.sun, '#5a1d1a', k), sx, sy, r);
                disc(ctx, lerpColor(PAL.sunHi, '#a8301f', k), sx - 1, sy - 1, Math.max(1, r - 2));
                for (let i = 0; i < 14; i++) {      // traînée de braises
                    const age = i / 14;
                    const ey = sy - 4 - i * 3;
                    if (ey > 0) px(ctx, i % 2 ? PAL.sunHi : '#ff5a3c', sx + Math.sin(t * 9 + i * 1.7) * (2 + i * 0.4), ey, 1, 1 + (age < 0.5 ? 1 : 0));
                }
            }
            // flèche en vol (2,0 → 2,8 s) depuis l'archer vers le soleil
            const ax = W * 0.16;
            const ay = horizon - 24;
            if (t >= 2.0 && t < 2.8) {
                const k = (t - 2.0) / 0.8;
                const fx = ax + 19 + (sx - ax - 19) * k;
                const fy = ay + 10 + (sy0 - ay - 10) * k;
                px(ctx, '#ffffff', fx - 6, fy + 3 * (1 - k) * 0.5, 7, 1);
                px(ctx, '#ffd24a', fx + 1, fy - 1, 1, 3);
                ctx.globalAlpha = 0.4;
                disc(ctx, '#ffe9a0', fx, fy, 3);
                ctx.globalAlpha = 1;
            }
            // éclat à l'impact
            if (t >= 2.8 && t < 3.3) {
                ctx.globalAlpha = 1 - (t - 2.8) / 0.5;
                disc(ctx, '#ffffff', sx, sy0, 10 + Math.round((t - 2.8) * 40));
                ctx.globalAlpha = 1;
            }
            // collines et sol (silhouettes encre)
            for (let x = 0; x < W; x++) {
                const h = Math.round(Math.sin(x * 0.07 + 1) * 3 + Math.sin(x * 0.19) * 1.5);
                px(ctx, PAL.ground, x, horizon + h, 1, H - horizon - h);
            }
            // lueur de l'atterrissage
            if (t >= 5.0) {
                const k = Math.min(1, (t - 5.0) / 0.6);
                ctx.globalAlpha = (1 - clamp01((t - 5.6) / 1.4)) * 0.7 * k;
                disc(ctx, '#ff8a1f', sx, horizon, Math.round(8 + k * 14));
                ctx.globalAlpha = 1;
                px(ctx, PAL.ground, sx - 30, horizon + 3, 60, H - horizon);
            }
            archer(ctx, ax, ay, t < 2.8 ? 1 : 0, t);
            drawCounter(ctx, t, W);
            // assombrissement progressif
            ctx.globalAlpha = 0.35 * darkK;
            px(ctx, PAL.ink, 0, 0, W, H);
            ctx.globalAlpha = 1;
        }
    });
}
