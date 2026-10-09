// Animation purement décorative : de petits points de la couleur du mana volent des tuiles combinées
// vers le compteur de mana du joueur (option « Particules de mana », nombre selon les effets visuels). N'influence jamais la logique (aucun état, aucune attente).

const FLIGHT_MS = 650;
import { getOption, maxManaParticles } from './gameOptions.js';

const COLORS = { red: '#e74c3c', blue: '#3498db', green: '#2ecc71', yellow: '#f1c40f', purple: '#9b59b6' };
// Matchs non colorés : flèches (points d'action) et crânes (dégâts).
const TYPE_COLORS = { combat: '#e67e22', skull: '#ecf0f1' };

// Élément DOM visé : compteur de mana (couleur), compteur de PA (flèches) ou zone de stats (crânes) du camp concerné.
function findTarget(side, type, color) {
    if (type === 'combat') return document.querySelector(`#${side}-stats .pa-stat`) || document.getElementById(`${side}-stats`);
    if (type === 'skull') return document.getElementById(`${side}-stats`);
    return document.getElementById(`${side}-mana-${color}`);
}

// type : 'color' (défaut, `color` = couleur de mana), 'combat' (flèches/épées) ou 'skull' (crânes).
// isPlayer=false : particules vers le compteur de l'ennemi.
export function flyManaToCounter(tileIndices, color, { isPlayer = true, type = 'color' } = {}) {
    try {
        const dotColor = type === 'color' ? COLORS[color] : TYPE_COLORS[type];
        if (!dotColor || !getOption('manaFlight')) return;
        if (typeof document === 'undefined' || typeof Element === 'undefined' || !Element.prototype.animate) return;
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
        const board = document.getElementById('board');
        const target = findTarget(isPlayer ? 'player' : 'enemy', type, color);
        if (!board || !target) return;
        const to = target.getBoundingClientRect();
        if (!to.width && !to.height) return;
        const tx = to.left + to.width / 2;
        const ty = to.top + to.height / 2;
        const tiles = board.children;
        // Une répartition régulière si plus de maxManaParticles() tuiles.
        const step = Math.max(1, Math.ceil(tileIndices.length / maxManaParticles()));
        for (let n = 0; n < tileIndices.length; n += step) {
            const tile = tiles[tileIndices[n]];
            if (!tile) continue;
            const from = tile.getBoundingClientRect();
            if (!from.width) continue;
            const dot = document.createElement('div');
            dot.className = 'mana-fly-dot';
            dot.style.background = dotColor;
            dot.style.left = `${from.left + from.width / 2 - 6}px`;
            dot.style.top = `${from.top + from.height / 2 - 6}px`;
            document.body.appendChild(dot);
            const remove = () => dot.remove();
            const anim = dot.animate([
                { transform: 'translate(0,0) scale(1)', opacity: 1 },
                { transform: `translate(${tx - from.left - from.width / 2}px, ${ty - from.top - from.height / 2}px) scale(0.5)`, opacity: 0.8 },
            ], { duration: FLIGHT_MS, delay: (n / step) * 60, easing: 'ease-in', fill: 'both' });
            anim.onfinish = remove;
            setTimeout(remove, FLIGHT_MS + 600); // filet de sécurité
        }
    } catch (e) { /* décoratif : jamais bloquant */ }
}
