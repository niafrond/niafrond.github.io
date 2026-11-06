// Cinématique du duel de mi-parcours contre Fengmeng (gorges du Volcan). Extrait de cinematics.js.
import { playSfx } from './sound.js';
import { mount, prefersReducedMotion } from './cinematicsCore.js';
import { loadSceneArt } from './cinematicsPrologue.js';

// ── Duel de mi-parcours contre Fengmeng (gorges du Volcan) ──────────────────
// Quatre tableaux Pixel Lab (tools/gen-prologue.mjs --set=fengmeng) légendés, joués avant le combat contre
// fengmeng_2. Même habillage que le prologue ; sans planches, rien n'est affiché (le combat enchaîne directement).
export const FENGMENG_DUEL_CAPTIONS = [
    "Fengmeng est parti deux jours avant vous. Il a gravi les marches du Kunlun pour demander l'élixir à la Reine Mère de l'Occident. Elle n'en a qu'un seul véritable, et il est déjà donné.",
    "Elle a refusé avec douceur. Il a compris en un instant qui le détenait. Depuis ce jour, une flèche de braise brûle dans son carquois, et elle n'a plus rien d'un jeu.",
    "Aux gorges du Volcan, il a trouvé le défilé : un corridor de basalte entre deux fleuves de lave, le seul chemin vers l'est. Il s'y est posté, et il attend son Maître.",
    "Deux archers, une seule corde brisée entre eux. Cette fois, Fengmeng ne retiendra plus ses coups."
];
let fengmengDuelPlayed = false;
export const fengmengDuelCinematicPlayed = () => fengmengDuelPlayed;

export async function playFengmengDuelCinematic() {
    const captions = FENGMENG_DUEL_CAPTIONS;
    const art = await loadSceneArt('fengmeng', captions.length, window.innerHeight > window.innerWidth);
    if (!art) return;
    return new Promise(resolve => {
        const { overlay, canvas, ctx } = mount('cine-prologue');
        canvas.width = art[0].size[0];
        canvas.height = art[0].size[1];
        ctx.imageSmoothingEnabled = false;
        overlay.querySelector('.cine-skip')?.remove();
        overlay.insertAdjacentHTML('beforeend', `
            <div class="cine-prologue-caption"><div class="cine-prologue-text"></div><div class="cine-prologue-next">▼</div></div>
            <div class="cine-prologue-dots">${captions.map(() => '<i></i>').join('')}</div>
            <button type="button" class="cine-prologue-skip">Passer ►►</button>`);
        const textEl = overlay.querySelector('.cine-prologue-text');
        const dots = overlay.querySelectorAll('.cine-prologue-dots i');
        const reduced = prefersReducedMotion();
        playSfx('introJingle');
        const FADE = 0.5;
        let idx = 0, sceneT0 = performance.now(), raf = 0, done = false;
        const setScene = i => {
            idx = i;
            sceneT0 = performance.now();
            dots.forEach((d, n) => d.classList.toggle('on', n === i));
            textEl.textContent = '';
        };
        const finish = () => {
            if (done) return;
            done = true;
            fengmengDuelPlayed = true;
            cancelAnimationFrame(raf);
            document.removeEventListener('keydown', onKey, true);
            overlay.classList.add('closing');
            setTimeout(() => { overlay.remove(); resolve(); }, 350);
        };
        const fullLen = () => captions[idx].length;
        const typed = () => (reduced ? fullLen() : Math.floor((performance.now() - sceneT0) / 1000 * 32));
        const advance = () => {
            if (typed() < fullLen()) { sceneT0 = performance.now() - fullLen() / 32 * 1000 - 50; return; }
            if (idx + 1 >= captions.length) finish(); else setScene(idx + 1);
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
            const t = (now - sceneT0) / 1000;
            const a = art[idx], [aw, ah] = a.size;
            ctx.drawImage(a.img, (reduced ? 0 : Math.floor(t * a.fps) % a.frames) * aw, 0, aw, ah, 0, 0, aw, ah);
            if (!reduced && t < FADE) { ctx.globalAlpha = 1 - t / FADE; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, aw, ah); ctx.globalAlpha = 1; }
            const n = Math.min(fullLen(), typed());
            if (textEl.textContent.length !== n) textEl.textContent = captions[idx].slice(0, n);
            overlay.classList.toggle('caption-done', n >= fullLen());
            if (!reduced && t > 8 && n >= fullLen()) { if (idx + 1 >= captions.length) { finish(); return; } setScene(idx + 1); }
            raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
    });
}
