// Clignotement quand une altération inflige des dégâts (poison, brûlure, noyade, enflammé) : la pastille de l'altération et la barre de vie
// du combattant touché clignotent un court instant, pour que le joueur comprenne d'où viennent les PV perdus.
// Les fiches de combat se redessinent juste après chaque changement : on attend ce rendu avant d'animer les éléments en place.
import { animationsEnabled } from './gameOptions.js';

const DELAY_MS = 180;     // laisse la fiche se redessiner (updateStats) avant d'animer
const DURATION_MS = 700;

const BADGE_FRAMES = [
    { transform: 'scale(1)', filter: 'brightness(1)', boxShadow: '0 0 0 0 rgba(229,57,53,0)' },
    { transform: 'scale(1.4)', filter: 'brightness(1.8)', boxShadow: '0 0 6px 3px rgba(229,57,53,.95)', offset: 0.25 },
    { transform: 'scale(1)', filter: 'brightness(1)', boxShadow: '0 0 0 0 rgba(229,57,53,0)', offset: 0.5 },
    { transform: 'scale(1.4)', filter: 'brightness(1.8)', boxShadow: '0 0 6px 3px rgba(229,57,53,.95)', offset: 0.75 },
    { transform: 'scale(1)', filter: 'brightness(1)', boxShadow: '0 0 0 0 rgba(229,57,53,0)' }
];
const BAR_FRAMES = [
    { boxShadow: '0 0 0 0 rgba(229,57,53,0)', filter: 'brightness(1)' },
    { boxShadow: '0 0 0 3px rgba(229,57,53,.95)', filter: 'brightness(1.5)', offset: 0.25 },
    { boxShadow: '0 0 0 0 rgba(229,57,53,0)', filter: 'brightness(1)', offset: 0.5 },
    { boxShadow: '0 0 0 3px rgba(229,57,53,.95)', filter: 'brightness(1.5)', offset: 0.75 },
    { boxShadow: '0 0 0 0 rgba(229,57,53,0)', filter: 'brightness(1)' }
];

/** Fait clignoter les pastilles `statusIds` (ex. 'poisoned') et la barre de vie du héros (`isPlayer`) ou de l'ennemi. Sans effet hors navigateur. */
export function flashStatusDamage(isPlayer, ...statusIds) {
    try {
        if (typeof document === 'undefined' || typeof Element === 'undefined' || !Element.prototype.animate) return;
        if (!animationsEnabled() || document.body?.classList.contains('fx-reduced')) return;
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
        setTimeout(() => {
            const side = isPlayer ? 'player' : 'enemy';
            const targets = [
                ...statusIds.map(id => [document.querySelector(`#${side}-stats .status-badge[data-status="${id}"]`), BADGE_FRAMES]),
                [document.querySelector(`#${side}-stats .hp-bar-container`), BAR_FRAMES]
            ];
            targets.forEach(([el, frames]) => { if (el) el.animate(frames, { duration: DURATION_MS, easing: 'ease-in-out' }); });
        }, DELAY_MS);
    } catch { /* un clignotement raté ne doit jamais gêner le combat */ }
}
