// Fenêtre d'énigme (DOM) : affiche le plateau du moteur (engine.js) en SVG et relaie clavier, appuis et glissements. Hors du moteur,
// rien ne dépend du mode : le plateau est dessiné par `mode.render`, les actions passent par `puzzle.dir` / `puzzle.tap`.
import { createPuzzle } from './engine.js';
import './modes.js';
import { puzzleDef } from './levels.js';

const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', z: 'up', q: 'left' };
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * Ouvre l'énigme `id` dans `host`. `onSolved()` est appelé une fois, après la victoire (le joueur clique sur « Continuer ») ;
 * `onClose()` à chaque fermeture (abandon compris). Renvoie { close } ou null si l'énigme est inconnue.
 */
export function openPuzzle(host, id, { onSolved, onClose, sfx } = {}) {
    const def = puzzleDef(id);
    if (!def) return null;
    const puzzle = createPuzzle(def);
    const el = document.createElement('div');
    el.className = 'puzzle-overlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', def.title);
    const isDirMode = Boolean(puzzle.mode.dir);
    // Haut de l'écran : titre, coups et boutons ; milieu : le plateau (tout l'espace restant) ; bas : croix directionnelle (au pouce).
    el.innerHTML = `<div class="puzzle-card">
        <div class="puzzle-top">
            <div class="puzzle-head"><div class="puzzle-title">${esc(def.title)}</div><div class="puzzle-status" role="status" aria-live="polite"></div></div>
            <div class="puzzle-buttons">
                <button type="button" data-act="undo">Annuler</button>
                <button type="button" data-act="reset">Recommencer</button>
                <button type="button" data-act="hint">Indice</button>
                <button type="button" data-act="close">Quitter</button>
            </div>
            <div class="puzzle-intro">${esc(def.intro)}</div>
        </div>
        <div class="puzzle-stage"><svg class="puzzle-board" aria-hidden="true"></svg></div>
        ${isDirMode ? `<div class="puzzle-pad">${['up', 'left', 'down', 'right'].map(d => `<button type="button" data-dir="${d}" aria-label="${d}">${{ up: '&#9650;', left: '&#9664;', down: '&#9660;', right: '&#9654;' }[d]}</button>`).join('')}</div>` : ''}
    </div>`;
    host.appendChild(el);
    const svg = el.querySelector('.puzzle-board'), status = el.querySelector('.puzzle-status');
    const { w, h } = puzzle.mode.size(puzzle.state);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    let closed = false, won = false;

    function refresh() {
        svg.innerHTML = puzzle.mode.render(puzzle.state);
        if (puzzle.won && !won) {
            won = true;
            status.innerHTML = `Résolu en ${puzzle.moves} coup${puzzle.moves > 1 ? 's' : ''} ! <button type="button" data-act="done">Continuer</button>`;
            sfx?.('turnBonus');
        } else if (!won) status.textContent = `Coups : ${puzzle.moves}`;
        el.querySelectorAll('[data-act="undo"],[data-act="reset"],[data-dir]').forEach(b => { b.disabled = won; });
    }
    function close(solved) {
        if (closed) return;
        closed = true;
        window.removeEventListener('keydown', onKey, true);
        el.remove();
        onClose?.();
        if (solved) onSolved?.();
    }
    function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false); return; }
        const d = KEYS[e.key] || KEYS[e.key?.toLowerCase()];
        if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { puzzle.undo(); refresh(); e.preventDefault(); e.stopPropagation(); return; }
        if (!d) return;
        e.preventDefault(); e.stopPropagation();       // le héros ne doit pas marcher derrière la fenêtre
        if (puzzle.dir(d)) refresh();
    }
    window.addEventListener('keydown', onKey, true);

    el.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b) return;
        e.stopPropagation();
        if (b.dataset.dir) { if (puzzle.dir(b.dataset.dir)) refresh(); return; }
        switch (b.dataset.act) {
            case 'undo': puzzle.undo(); refresh(); break;
            case 'reset': puzzle.reset(); refresh(); break;
            case 'hint': status.textContent = def.hint || 'Observez bien le plateau.'; break;
            case 'close': close(false); break;
            case 'done': close(true); break;
        }
    });
    // Appui sur le plateau → case ; glissement (> 0,6 case) → direction (déplace le héros ou le bloc choisi).
    let down = null;
    const cellOf = e => {
        const r = svg.getBoundingClientRect();
        const k = Math.min(r.width / w, r.height / h);           // le viewBox est centré dans le cadre (preserveAspectRatio)
        const ox = (r.width - k * w) / 2, oy = (r.height - k * h) / 2;
        return { fx: (e.clientX - r.left - ox) / k, fy: (e.clientY - r.top - oy) / k };
    };
    svg.addEventListener('pointerdown', e => { down = cellOf(e); down.id = e.pointerId; });
    svg.addEventListener('pointerup', e => {
        if (!down) return;
        const up = cellOf(e), dx = up.fx - down.fx, dy = up.fy - down.fy;
        const start = down; down = null;
        const x = Math.floor(start.fx), y = Math.floor(start.fy);
        if (Math.max(Math.abs(dx), Math.abs(dy)) > 0.6 && puzzle.mode.dir) {
            const dirName = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
            if (puzzle.mode.swipeSelects) puzzle.tap(x, y);          // glisser sur un bloc le choisit d'abord
            puzzle.dir(dirName);
            refresh();
        } else if (x >= 0 && y >= 0 && x < w && y < h && puzzle.tap(x, y)) refresh();
    });
    refresh();
    return { close: () => close(false), puzzle };
}
