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

// Pilules entre deux éléments (sorts et objets) : `from`/`to` sont des éléments DOM ou des fonctions qui les renvoient.
function flyDots(fromEl, toEl, color, count, { scatter = false } = {}) {
    try {
        const dotColor = COLORS[color];
        if (!dotColor || !fromEl || !toEl || !getOption('manaFlight')) return;
        if (typeof document === 'undefined' || typeof Element === 'undefined' || !Element.prototype.animate) return;
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
        const a = fromEl.getBoundingClientRect();
        const b = toEl.getBoundingClientRect();
        if ((!a.width && !a.height) || (!b.width && !b.height)) return;
        const n = Math.max(1, Math.min(Math.ceil(count || 1), maxManaParticles()));
        for (let i = 0; i < n; i++) {
            const sx = a.left + (scatter ? Math.random() * a.width : a.width / 2);
            const sy = a.top + (scatter ? Math.random() * a.height : a.height / 2);
            const dx = b.left + b.width / 2 - sx;
            const dy = b.top + b.height / 2 - sy;
            const dot = document.createElement('div');
            dot.className = 'mana-fly-dot';
            dot.style.background = dotColor;
            dot.style.left = `${sx - 6}px`;
            dot.style.top = `${sy - 6}px`;
            document.body.appendChild(dot);
            const remove = () => dot.remove();
            const anim = dot.animate([
                { transform: 'translate(0,0) scale(1)', opacity: 1 },
                { transform: `translate(${dx}px, ${dy}px) scale(0.5)`, opacity: 0.8 },
            ], { duration: FLIGHT_MS, delay: i * 60, easing: 'ease-in', fill: 'both' });
            anim.onfinish = remove;
            setTimeout(remove, FLIGHT_MS + i * 60 + 600);
        }
    } catch (e) { /* décoratif : jamais bloquant */ }
}

const sideOf = isPlayer => (isPlayer ? 'player' : 'enemy');

// Sort payé : les pilules quittent le compteur de mana et sont consommées par le lanceur, ou rejoignent le sort
// (élément `[data-spell-id]` désigné par `toSpellId`). `cost` = { couleur: quantité }.
export function flyManaSpend(isPlayer, cost, { toSpellId = null } = {}) {
    try {
        const side = sideOf(isPlayer);
        const spellEl = toSpellId ? document.querySelector(`[data-spell-id="${toSpellId}"]`) : null;
        Object.entries(cost || {}).forEach(([color, amount]) => {
            flyDots(document.getElementById(`${side}-mana-${color}`), spellEl || document.getElementById(`${side}-stats`), color, amount);
        });
    } catch (e) { /* décoratif : jamais bloquant (ex. sans DOM) */ }
}

// Mana reçu d'un sort ou d'un objet : les pilules partent du lanceur (ou de la zone `fromBoard` du plateau,
// ou de l'élément `fromId` — ex. le bouton d'objet) vers son compteur.
export function flyManaGain(isPlayer, gains, { fromBoard = false, fromId = null } = {}) {
    try {
        const side = sideOf(isPlayer);
        const visible = el => el && (el.getBoundingClientRect().width || el.getBoundingClientRect().height);
        // Le conteneur d'objet est en `display: contents` en mobile (aucune boîte) : on part alors du bouton qu'il contient.
        const fromEl = fromId ? document.getElementById(fromId) : null;
        const fromButton = visible(fromEl) ? fromEl : fromEl?.firstElementChild;
        const source = (visible(fromButton) && fromButton)
            || (fromBoard ? document.getElementById('board') : document.getElementById(`${side}-stats`));
        Object.entries(gains || {}).forEach(([color, amount]) => {
            if (amount > 0) flyDots(source, document.getElementById(`${side}-mana-${color}`), color, amount, { scatter: fromBoard });
        });
    } catch (e) { /* décoratif : jamais bloquant (ex. sans DOM) */ }
}

// Mana volé : du compteur de la victime vers celui du voleur.
export function flyManaSteal(thiefIsPlayer, gains) {
    try {
        const thief = sideOf(thiefIsPlayer);
        const victim = sideOf(!thiefIsPlayer);
        Object.entries(gains || {}).forEach(([color, amount]) => {
            if (amount > 0) flyDots(document.getElementById(`${victim}-mana-${color}`), document.getElementById(`${thief}-mana-${color}`), color, amount);
        });
    } catch (e) { /* décoratif : jamais bloquant (ex. sans DOM) */ }
}

// Soin : petites pilules à croix verte qui partent du soigné vers sa barre de vie.
export function flyHeal(isPlayer, amount) {
    try {
        if (!(amount > 0) || !getOption('manaFlight')) return;
        if (typeof document === 'undefined' || typeof Element === 'undefined' || !Element.prototype.animate) return;
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
        const side = sideOf(isPlayer);
        const from = document.getElementById(`${side}-stats`)?.getBoundingClientRect();
        const to = (document.querySelector(`#${side}-stats .hp-bar-container`) || document.getElementById(`${side}-hp-current`))?.getBoundingClientRect();
        if (!from || !to || (!from.width && !from.height) || (!to.width && !to.height)) return;
        const n = Math.max(1, Math.min(Math.ceil(amount / 10), maxManaParticles()));
        for (let i = 0; i < n; i++) {
            const sx = from.left + from.width / 2 + (i - (n - 1) / 2) * 14;
            const sy = from.top + from.height / 2;
            const dot = document.createElement('div');
            dot.className = 'heal-fly-dot';
            dot.style.left = `${sx - 7}px`;
            dot.style.top = `${sy - 7}px`;
            document.body.appendChild(dot);
            const remove = () => dot.remove();
            const anim = dot.animate([
                { transform: 'translate(0,0) scale(1)', opacity: 1 },
                { transform: `translate(${to.left + to.width / 2 - sx}px, ${to.top + to.height / 2 - sy}px) scale(0.6)`, opacity: 0.8 },
            ], { duration: FLIGHT_MS, delay: i * 60, easing: 'ease-in', fill: 'both' });
            anim.onfinish = remove;
            setTimeout(remove, FLIGHT_MS + i * 60 + 600);
        }
    } catch (e) { /* décoratif : jamais bloquant */ }
}
