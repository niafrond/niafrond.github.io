// Écran de démarrage (launcher) : boucle pixel art de Hou Yi. Extrait de cinematics.js.
import { playSfx } from './sound.js';
import { H, TP, W, prefersReducedMotion, px } from './cinematicsCore.js';
import { loadSceneArt } from './cinematicsPrologue.js';

// ── Écran de démarrage (launcher) : boucle pixel art Pixel Lab de Hou Yi ─────
// Seule la boucle sprites/launcher/ est affichée (fond uni teal le temps du chargement ; plus de scène dessinée en code).
//
// Palette unique (miroir des variables CSS `--title-*` de style.css) : décor = une seule teinte froide
// (teal), lumière/liserés/titre = une seule famille chaude (or/ambre, mêmes valeurs que `--rt-gold`,
// `--rt-sand-hi`, `--rt-cream` de retro.css), ombres teintées d'encre (`--rt-ink`, jamais de noir pur).
// La lumière vient du haut-droite : côté droit clair (…Hi), côté gauche ombré (…Lo).
export function playTitleScreen() {
    return new Promise(resolve => {
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
        let art = null;      // boucle Pixel Lab { img, frames, fps, size } ou null (fond uni le temps du chargement)
        let artFor = null;   // orientation pour laquelle `art` est (ou sera) chargée
        let ended = false;

        const resize = () => {
            const vw = window.innerWidth || 1;
            const vh = window.innerHeight || 1;
            portraitMode = vw < vh;
            if (art) {
                // résolution native de l'image (pas de mise à l'échelle fractionnaire), débordement rogné en « cover »
                const [nw, nh] = art.size;
                if (portraitMode) { W = nw; H = Math.max(nh, Math.round(nw * vh / vw)); }
                else { H = nh; W = Math.max(nw, Math.round(nh * vw / vh)); }
            } else if (portraitMode) { W = 144; H = Math.max(256, Math.round(144 * vh / vw)); }
            else { H = 144; W = Math.max(256, Math.round(144 * vw / vh)); }
            canvas.width = W;
            canvas.height = H;
            ctx.imageSmoothingEnabled = false;
        };
        resize();
        window.addEventListener('resize', resize);

        // Boucle Pixel Lab (tools/gen-prologue.mjs --set=launcher), une planche par orientation. Chargement tolérant : sans
        // planche, seul le fond uni teal s'affiche. Relue si l'orientation change.
        const ensureArt = () => {
            if (artFor === portraitMode) return;
            artFor = portraitMode;
            art = null;
            resize();
            loadSceneArt('launcher', 1, portraitMode).then(a => {
                if (artFor !== portraitMode || ended || !a) return;
                art = a[0];
                resize();
            });
        };
        ensureArt();
        window.addEventListener('resize', ensureArt);

        let raf = 0;
        let nextTimer = 0;
        const t0 = performance.now();
        // Batterie : l'écran-titre peut rester affiché longtemps ; ~24 i/s suffisent (boucle Pixel Lab à quelques i/s, pollen lent),
        // la boucle dort entre deux images au lieu de redessiner à chaque rafraîchissement de l'écran (60 à 120 Hz).
        const TITLE_FRAME_MS = 42;
        const next = () => { nextTimer = setTimeout(() => { if (!ended) raf = requestAnimationFrame(frame); }, TITLE_FRAME_MS); };

        // Image Pixel Lab en « cover » sur le canvas, lue en aller-retour (boucle sans saut), sans lissage.
        const drawArt = (a, t) => {
            const [aw, ah] = a.size;
            const n = a.frames;
            const period = Math.max(1, 2 * (n - 1));
            const k = reduced ? 0 : Math.floor(t * a.fps) % period;
            const fi = k < n ? k : period - k;
            const s = Math.max(W / aw, H / ah);
            const dw = aw * s;
            const dh = ah * s;
            ctx.drawImage(a.img, fi * aw, 0, aw, ah, Math.round((W - dw) / 2), Math.round((H - dh) / 2), Math.ceil(dw), Math.ceil(dh));
        };

        const frame = now => {
            const t = reduced ? 3 : (now - t0) / 1000;
            if (art) {
                drawArt(art, t);
                // pollen doré par-dessus, puis vignette basse pour la lisibilité de l'invite
                pollen.forEach(p => {
                    const y = ((p.y - t * p.v) % 1 + 1) % 1;
                    ctx.globalAlpha = 0.4 + 0.4 * Math.sin(t * 2 + p.p);
                    px(ctx, TP.goldHi, p.x * W + Math.sin(t + p.p) * 3, y * H, 1, 1);
                });
                for (let i = 0; i < 14; i++) {
                    ctx.globalAlpha = 0.035 * (i + 1);
                    px(ctx, TP.ink, 0, H - 14 + i, W, 1);
                }
                ctx.globalAlpha = 1;
                if (!ended) next();
                return;
            }
            // pas de boucle chargée : fond uni teal (jamais de scène dessinée en code)
            ctx.fillStyle = TP.tealDeep;
            ctx.fillRect(0, 0, W, H);
            if (!ended) next();
        };
        raf = requestAnimationFrame(frame);

        const start = () => {
            if (ended) return;
            ended = true;
            cancelAnimationFrame(raf);
            clearTimeout(nextTimer);
            window.removeEventListener('resize', resize);
            window.removeEventListener('resize', ensureArt);
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
