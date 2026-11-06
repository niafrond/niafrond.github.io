// Découverte d'une région et passage de portail. Extrait de cinematics.js.
import { loadSequence, sequenceRect } from './ultimateCinematics.js';
import { H, W, archer, disc, lerpColor, moon, px, runScene, sky, stars } from './cinematicsCore.js';

// ── Découverte d'une région ─────────────────────────────────────────────────
// Courte cinématique jouée la toute première fois que Hou Yi entre dans une région : le héros marche vers
// l'horizon, les collines défilent à deux vitesses, le ciel prend les couleurs de la région, puis le nom
// et la description de la région apparaissent (`.cine-region-*`).
// Palettes [haut du ciel, bas du ciel, collines lointaines, collines proches, accent].
export const REGION_SCENES = {
    rizieres: ['#6b2d2a', '#e8a15a', '#8a4a2e', '#4a2418', '#ffd24a'],
    fleuve: ['#5a3a1c', '#d9a35a', '#7a5a34', '#3a2a14', '#f0d9a0'],
    bambous: ['#2a2420', '#7a5a4a', '#3a3a30', '#1a1a14', '#9bd1a0'],
    gobi: ['#7a3a1c', '#ffc46b', '#c4824a', '#8a5a2e', '#fff4c8'],
    tonnerre: ['#1d1d45', '#6a5aa0', '#3a3a70', '#14143a', '#ffe36b'],
    volcan: ['#2a0f10', '#d63a2f', '#5a1d1a', '#1b0a0a', '#ffb347'],
    fauves: ['#7a4a1c', '#e8b04a', '#a8783a', '#5a3a1c', '#fbe7b0'],
    mer: ['#0d3440', '#58a89f', '#1b5f68', '#0a2a34', '#b4dcd0'],
    fusang: ['#5a1d3a', '#ffb06b', '#a8504a', '#4a1830', '#ffd24a'],
    marees: ['#0a2038', '#4a8fb0', '#1b4a6a', '#08172a', '#ffd9a0'],
    lune: ['#0b0b2b', '#3a3a90', '#2a2a70', '#141446', '#fff4c8'],
    wandering_souls: ['#02100c', '#14503f', '#0b2a22', '#05140f', '#dff5ea'],   // royaume des âmes errantes (événement)
    winter_lantern_mountain: ['#293b59', '#a5cedd', '#e8edf0', '#1a2740', '#d4a94e']   // montagne des lanternes enneigées (événement)
};

// Passage d'une porte d'événement (exploration.js `res.portal`) : brume d'esprits en spirale autour d'une porte qui s'ouvre. 'in' vers le royaume
// (nuit verte, les flammes convergent), 'out' vers le monde des vivants (la nuit vire à l'aube, les flammes s'éloignent). ≈ 1,8 s, se passe d'un toucher.
export function playPortalTransition(direction = 'in') {
    const DURATION = 1.8, entering = direction !== 'out';
    return runScene({
        extraClass: 'cine-portal',
        duration: DURATION,
        holdAfter: false,
        draw(ctx, t) {
            const k = Math.min(1, t / DURATION), cx = Math.round(W / 2), cy = Math.round(H * 0.55);
            const top = entering ? '#02100c' : lerpColor('#0b2a22', '#3b1d5a', k);
            const bottom = entering ? lerpColor('#0b2a22', '#14503f', k) : lerpColor('#0b2a22', '#ffc46b', k);
            sky(ctx, top, bottom, 14);
            // halo de la porte : un disque de lumière verte qui grandit (entrée) ou se resserre (sortie)
            const glow = Math.round((entering ? k : 1 - k) * Math.min(W, H) * 0.42);
            disc(ctx, '#1d6b55', cx, cy, glow + 5);
            disc(ctx, '#78b8a0', cx, cy, Math.max(0, glow));
            disc(ctx, '#dff5ea', cx, cy, Math.max(0, glow - 6));
            // la porte : deux piliers noirs, linteau laqué rouge, lanternes
            const gh = Math.round(H * 0.34), gw = Math.round(gh * 0.9), gx = cx - Math.round(gw / 2), gy = cy - Math.round(gh / 2);
            px(ctx, '#0b0f14', gx - 3, gy, 4, gh); px(ctx, '#0b0f14', gx + gw - 1, gy, 4, gh);
            px(ctx, '#0b0f14', gx - 6, gy - 4, gw + 12, 4);
            px(ctx, '#c4382a', gx - 4, gy - 2, gw + 8, 2);
            px(ctx, '#e0533d', gx - 2, gy + 4, 2, 4); px(ctx, '#e0533d', gx + gw, gy + 4, 2, 4);
            // flammes d'esprits en spirale, vers la porte ou loin d'elle
            const maxR = Math.min(W, H) * 0.62;
            for (let i = 0; i < 46; i++) {
                const phase = ((i * 0.137 + t * 0.9) % 1 + 1) % 1;
                const r = (entering ? 1 - phase : phase) * maxR;
                const a = i * 2.399 + t * (entering ? 4.2 : -4.2);
                const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.62;
                const edge = Math.min(1, phase * 4, (1 - phase) * 4);
                ctx.globalAlpha = 0.25 + 0.75 * edge;
                px(ctx, i % 3 ? '#78b8a0' : '#dff5ea', x, y, i % 4 ? 2 : 3, i % 4 ? 2 : 3);
            }
            ctx.globalAlpha = 1;
        }
    });
}

// Animation pixel art générée en local (tools/gen-biome-intros.py, rangée par pack-ultimate-sequences.mjs) : `biome_<id>-seq` dans
// sprites/ultimates/index.json. En portrait et si elle existe, elle remplace la scène procédurale (dernière image tenue jusqu'au titre).
export function playRegionDiscovery(zone = {}) {
    const portrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
    const clip = portrait ? loadSequence(`biome_${zone.id || 'rizieres'}`).catch(() => null) : Promise.resolve(null);
    return clip.then(seq => playRegionScene(zone, seq));
}

function playRegionScene({ id = 'rizieres', name = '', description = '', kicker: kickerText = 'Nouvelle région' } = {}, seq = null) {
    const pal = REGION_SCENES[id] || REGION_SCENES.rizieres;
    const DURATION = seq && !seq.loop ? Math.max(5.5, seq.frames / seq.fps + 1.5) : 5.5;   // un clip en boucle tourne pendant les 5,5 s de la scène
    return runScene({
        extraClass: 'cine-region',
        duration: DURATION,
        startSfx: 'introJingle',
        onMount(overlay) {
            const box = document.createElement('div');
            box.className = 'cine-region-text';
            const kicker = document.createElement('div');
            kicker.className = 'cine-region-kicker';
            kicker.textContent = kickerText;
            const title = document.createElement('div');
            title.className = 'cine-region-title';
            title.textContent = name;
            const line = document.createElement('div');
            line.className = 'cine-region-line';
            line.textContent = description;
            box.append(kicker, title, line);
            overlay.append(box);
        },
        draw(ctx, t) {
            if (seq) {   // clip pixel art plein écran : image courante de la planche, fondu d'entrée et de sortie comme la scène procédurale
                const [sx, sy, sw, sh] = sequenceRect(seq, seq.loop ? (t * seq.fps) % seq.frames : t * seq.fps);
                ctx.drawImage(seq.img, sx, sy, sw, sh, 0, 0, W, H);
                const k = Math.min(1, t / 0.6) * Math.min(1, (DURATION - t + 0.4) / 0.8);
                ctx.globalAlpha = 1 - Math.max(0, Math.min(1, k));
                px(ctx, '#000000', 0, 0, W, H);
                ctx.globalAlpha = 1;
                return;
            }
            sky(ctx, pal[0], pal[1], 16);
            if (id === 'lune' || id === 'tonnerre') stars(ctx, t, 36, 0.9);
            // soleil bas / lune selon la région
            if (id === 'lune') moon(ctx, Math.round(W * 0.72), Math.round(H * 0.28), 9);
            else if (id !== 'tonnerre') disc(ctx, pal[4], Math.round(W * 0.72), Math.round(H * 0.5), 8);
            const ridge = (color, speed, base, amp, freq) => {
                for (let x = 0; x < W; x++) {
                    const u = x + t * speed;
                    const h = Math.round(Math.sin(u * freq) * amp + Math.sin(u * freq * 2.3 + 1) * amp * 0.4);
                    px(ctx, color, x, base + h, 1, H - base - h);
                }
            };
            ridge(pal[2], 6, Math.round(H * 0.62), 5, 0.045);
            ridge(pal[3], 16, Math.round(H * 0.78), 3, 0.09);
            // l'avancée du héros : léger rebond, éclat d'accent sur l'arc
            const hx = Math.round(W * 0.2);
            const hy = Math.round(H * 0.78) - 18 + Math.round(Math.abs(Math.sin(t * 6)));
            archer(ctx, hx, hy, 0, t);
            // poussière / lueurs dérivantes
            for (let i = 0; i < 10; i++) {
                const fx = (W - ((t * (18 + i * 3) + i * 37) % W));
                px(ctx, pal[4], fx, H * 0.82 + (i % 4) * 4, 1, 1);
            }
            // fondu d'entrée / sortie
            const fade = Math.min(1, t / 0.6) * Math.min(1, (DURATION - t + 0.4) / 0.8);
            ctx.globalAlpha = 1 - Math.max(0, Math.min(1, fade));
            px(ctx, '#000000', 0, 0, W, H);
            ctx.globalAlpha = 1;
        }
    });
}
