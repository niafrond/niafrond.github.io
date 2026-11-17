// Prologue animé de la nouvelle partie. Extrait de cinematics.js.
import { playSfx } from './sound.js';
import { H, P, TP, W, disc, lerpColor, moon, mount, prefersReducedMotion, px, sky, stars } from './cinematicsCore.js';
import { endHero } from './cinematicsEnding.js';

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
        caption: "Alors Yao se souvint de Hou Yi, l'archer dont les flèches n'ont jamais manqué leur but. Près de lui : Chang'e, son épouse tant aimée, Fengmeng, son disciple, et l'Élixir d'Immortalité.",
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

// Tableaux animés générés avec Pixel Lab (tools/gen-prologue.mjs) : boucles, une planche par tableau et orientation, dans
// sprites/<dossier>/. Chargement tolérant : si l'index ou une planche manque, la scène dessinée en code reste le repli.
// `only` : numéros de tableaux (à partir de 1) à charger seuls, au lieu des `count` premiers.
export async function loadSceneArt(dir, count, portrait, only = null) {
    try {
        const base = new URL(`./sprites/${dir}/`, import.meta.url);
        const index = await (await fetch(new URL('index.json', base))).json();
        const o = portrait ? 'port' : 'land';
        const numbers = only || Array.from({ length: count }, (_, i) => i + 1);
        const scenes = await Promise.all(numbers.map(n => new Promise(res => {
            const meta = index[`${n}-${o}`];
            if (!meta) return res(null);
            const img = new Image();
            img.onload = () => res({ img, ...meta });
            img.onerror = () => res(null);
            img.src = new URL(`${n}-${o}.png`, base).href;
        })));
        return scenes.every(Boolean) ? scenes : null;
    } catch (e) {
        return null;
    }
}

export function playPrologueAnimation() {
    return new Promise(resolve => {
        const { overlay, canvas, ctx } = mount('cine-prologue');
        ctx.imageSmoothingEnabled = false;
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

        let art = null;   // tableaux Pixel Lab (null : tableaux dessinés en code)
        const frame = now => {
            const sc = PRO_SCENES[idx];
            const t = (now - sceneT0) / 1000;
            if (art) {
                const a = art[idx], [aw, ah] = a.size;
                const fi = reduced ? 0 : Math.floor(t * a.fps) % a.frames;
                ctx.drawImage(a.img, fi * aw, 0, aw, ah, 0, 0, aw, ah);
            } else sc.draw(ctx, reduced ? sc.dur : t);
            // fondu d'entrée du tableau
            if (!reduced && t < FADE) { ctx.globalAlpha = 1 - t / FADE; ctx.fillStyle = TP.ink; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.globalAlpha = 1; }
            const n = Math.min(fullLen(), typed());
            if (textEl.textContent.length !== n) textEl.textContent = sc.caption.slice(0, n);
            overlay.classList.toggle('caption-done', n >= fullLen());
            // enchaînement automatique après la légende + un temps de lecture
            if (!reduced && t > sc.dur + 2 && n >= fullLen()) { if (idx + 1 >= PRO_SCENES.length) { finish(); return; } setScene(idx + 1); }
            raf = requestAnimationFrame(frame);
        };
        loadSceneArt('prologue', PRO_SCENES.length, P).then(a => {
            if (done) return;
            art = a;
            if (a) { canvas.width = a[0].size[0]; canvas.height = a[0].size[1]; ctx.imageSmoothingEnabled = false; }
            setScene(0);
            raf = requestAnimationFrame(frame);
        });
    });
}
