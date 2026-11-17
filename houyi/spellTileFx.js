// Effets décoratifs sur le plateau des sorts de flèches d'action (classSpellsActionGems.js) : anneau d'onde et éclats par case.
// Purement visuel (Web Animations, aucun état ni attente) ; coupé si les animations sont désactivées ; jamais bloquant.
import { animationsEnabled, effectsLevel } from './gameOptions.js';

// Couleurs de l'anneau et des éclats, sens des éclats (`rise` : montent comme du qì ou des flèches, sinon rayonnent) et durée.
export const TILE_FX = {
    forge:   { ring: '#ffd24a', shards: ['#ffd24a', '#5aaaff', '#fff'], rise: true,  ms: 900 },    // Forge des Légions : une flèche naît
    harvest: { ring: '#e67e22', shards: ['#e67e22', '#3498db', '#fff'], rise: true,  ms: 800 },    // Moisson d'Acier : la flèche se brise en qì bleu
    skull:   { ring: '#e74c3c', shards: ['#e74c3c', '#ecf0f1', '#8e1f1f'], rise: false, ms: 800 }, // Lames Brisées : la flèche se fend en crâne
    moult:   { ring: '#9b59b6', shards: ['#9b59b6', '#d7b8f3', '#fff'], rise: false, ms: 900 }     // Mue d'Acier : la peau d'acier vire au violet
};
const SHARDS = { low: 3, normal: 5, high: 8 };

const GOLDEN_ANGLE = 2.399963;   // répartition régulière des éclats, sans hasard (rendu reproductible)

/** Joue l'effet `kind` sur les cases `indices` du plateau ; à appeler quand les cases ont leur place à l'écran. Ne lève jamais. */
export function playTileFx(kind, indices) {
    try {
        const fx = TILE_FX[kind];
        const board = typeof document !== 'undefined' && document.getElementById('board');
        if (!fx || !board || !indices?.length || typeof Element === 'undefined' || !Element.prototype.animate || !animationsEnabled()) return;
        const count = SHARDS[effectsLevel()] || 5;
        indices.forEach((index, n) => {
            const tile = board.children[index];
            const r = tile?.getBoundingClientRect();
            if (!r || !r.width) return;
            const cx = r.left + r.width / 2, cy = r.top + r.height / 2, size = r.width, delay = Math.min(n, 8) * 60;
            const ring = overlay(cx, cy, size, size, fx.ring);
            ring.style.borderRadius = '50%';
            ring.style.background = 'transparent';
            ring.style.border = `3px solid ${fx.ring}`;
            run(ring, [{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.5)', opacity: 0 }], fx.ms * 0.7, delay);
            for (let k = 0; k < count; k++) {
                const a = (fx.rise ? -Math.PI / 2 + (k - (count - 1) / 2) * 0.35 : k * GOLDEN_ANGLE), dist = size * (0.55 + 0.12 * (k % 3));
                const s = Math.max(3, Math.round(size / 9)), shard = overlay(cx, cy, s, s, fx.shards[k % fx.shards.length]);
                run(shard, [
                    { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
                    { transform: `translate(calc(-50% + ${Math.cos(a) * dist}px), calc(-50% + ${Math.sin(a) * dist - (fx.rise ? size * 0.4 : 0)}px)) scale(.3) rotate(${k * 70}deg)`, opacity: 0 }
                ], fx.ms, delay);
            }
        });
    } catch (e) { /* décoratif : jamais bloquant */ }
}

function overlay(cx, cy, w, h, color) {
    const el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;width:${w}px;height:${h}px;background:${color};pointer-events:none;z-index:60;opacity:0;transform:translate(-50%,-50%)`;
    document.body.appendChild(el);
    return el;
}

function run(el, keyframes, ms, delay) {
    const anim = el.animate(keyframes, { duration: ms, delay, easing: 'ease-out', fill: 'both' });
    anim.onfinish = anim.oncancel = () => el.remove();
}
