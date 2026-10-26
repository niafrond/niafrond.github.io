// Fenêtre d'énigme (DOM) : affiche le plateau du moteur (engine.js) en SVG et relaie clavier, appuis et glissements. Hors du moteur,
// rien ne dépend du mode : le plateau est dessiné par `mode.render`, les actions passent par `puzzle.dir` / `puzzle.tap`.
import { createPuzzle, solvePath } from './engine.js';
import { spriteDefs, setHeroSprite } from './art.js';
import './modes.js';
import { puzzleDef, pieceOfPuzzle, PUZZLE_SETS } from './levels.js';
import { icon } from '../icons.js';
import { getStuffById, STUFF_SLOT_LABELS, describeStuff } from '../stuff.js';

const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', z: 'up', q: 'left' };
const SLOT_ICON = { head: 'crown', neck: 'stone', wrist: 'shield', ring: 'star' };   // icône de l'emplacement de la pièce gagnée (aucune police chinoise embarquée)
const INTRO_ICON = { push: 'box', mirror: 'mirror', slide: 'cart' };
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * Ouvre l'énigme `id` dans `host`. `onSolved()` est appelé une fois, après la victoire (le joueur clique sur « Continuer ») ;
 * `onClose()` à chaque fermeture (abandon compris). `solution: true` ajoute un bouton qui rejoue lentement la solution la plus courte
 * (page de test, pas le jeu). Renvoie { close } ou null si l'énigme est inconnue.
 */
export function openPuzzle(host, id, { onSolved, onClose, sfx, solution = false, hero } = {}) {
    const def = puzzleDef(id);
    if (!def) return null;
    setHeroSprite(hero);   // data URI du héros du joueur (énigme des jarres) ; absent : pion bleu
    const puzzle = createPuzzle(def);
    const el = document.createElement('div');
    el.className = 'puzzle-overlay';
    el.dataset.mode = def.mode;   // choisit la musique (main.js) et l'animation d'intro (retro.css)
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
                ${solution ? '<button type="button" data-act="solve">Solution</button>' : ''}
                <button type="button" data-act="close">Quitter</button>
            </div>
        </div>
        <div class="puzzle-stage"><svg class="puzzle-board" aria-hidden="true"></svg></div>
        ${isDirMode ? `<div class="puzzle-pad">${['up', 'left', 'down', 'right'].map(d => `<button type="button" data-dir="${d}" aria-label="${d}">${{ up: '&#9650;', left: '&#9664;', down: '&#9660;', right: '&#9654;' }[d]}</button>`).join('')}</div>` : ''}
    </div>`;
    host.appendChild(el);
    // Intro (~1,4 s) : bandeau du type d'énigme sur le plateau qui se déploie ; retiré tout seul, sans bloquer les commandes.
    const intro = document.createElement('div');
    intro.className = 'puzzle-intro';
    intro.setAttribute('aria-hidden', 'true');
    intro.innerHTML = `<span class="puzzle-intro-icon">${icon(INTRO_ICON[def.mode] || 'puzzle')}</span><span class="puzzle-intro-title">${esc(def.title)}</span>`;
    el.appendChild(intro);
    intro.addEventListener('animationend', () => intro.remove());
    setTimeout(() => intro.remove(), 2200);   // filet : animations coupées (économie d'énergie, préférence de mouvement réduit)
    const svg = el.querySelector('.puzzle-board'), status = el.querySelector('.puzzle-status');
    // Les dessins sont déclarés une fois ; seul le calque du plateau est refait à chaque coup.
    svg.innerHTML = `<defs>${spriteDefs()}</defs><g class="layer"></g>`;
    const layer = svg.querySelector('.layer');
    const { w, h } = puzzle.mode.size(puzzle.state);
    const stage = el.querySelector('.puzzle-stage');
    let closed = false, won = false, rot = false;

    // Plateau pivoté d'un quart de tour quand sa forme est à l'opposé de celle de la zone libre (téléphone en portrait, plateau large) : il remplit
    // alors la zone. Un point (x, y) du plateau s'affiche en (h − y, x) ; les directions du clavier, de la croix et du glissement suivent l'écran.
    const ROT_DIR = { up: 'left', down: 'right', left: 'down', right: 'up' };
    const gameDir = d => (rot ? ROT_DIR[d] : d);
    function fitRotation() {
        const r = stage.getBoundingClientRect();
        const want = r.width > 0 && w !== h && (r.height > r.width) !== (h > w);
        if (want === rot) return false;
        rot = want;
        return true;
    }

    // Écran de victoire : coups joués, pièce d'armure antique gagnée (nom, emplacement, bonus, histoire) et bouton « Continuer ».
    function showVictory() {
        const piece = getStuffById(pieceOfPuzzle(id));
        const set = PUZZLE_SETS[def.set];
        const card = piece ? `<div class="puzzle-victory-piece">
                <div class="puzzle-victory-glyph">${icon(SLOT_ICON[piece.slot] || 'shield')}</div>
                <div class="puzzle-victory-name">${esc(piece.name)}</div>
                <div class="puzzle-victory-slot">${esc(STUFF_SLOT_LABELS[piece.slot])} · armure antique « ${esc(set.label)} »</div>
                <div class="puzzle-victory-bonus">${esc(describeStuff(piece).split(' • ').filter(t => !/^armure antique/i.test(t)).join(' • '))}</div>
                <div class="puzzle-victory-desc">${esc(piece.description)}</div>
            </div>` : '';
        const v = document.createElement('div');
        v.className = 'puzzle-victory';
        v.setAttribute('role', 'status');
        v.innerHTML = `<div class="puzzle-victory-title">Énigme résolue !</div>
            <div class="puzzle-victory-moves">${puzzle.moves} coup${puzzle.moves > 1 ? 's' : ''}</div>${card}
            <button type="button" data-act="done">Continuer</button>`;
        el.appendChild(v);
        v.querySelector('button')?.focus();
    }

    function refresh() {
        fitRotation();
        svg.setAttribute('viewBox', rot ? `0 0 ${h} ${w}` : `0 0 ${w} ${h}`);
        const inner = puzzle.mode.render(puzzle.state, { rot });
        layer.innerHTML = rot ? `<g transform="translate(${h} 0) rotate(90)">${inner}</g>` : inner;
        if (puzzle.won) {
            if (!won) {
                won = true;
                el.dataset.won = '1';   // main.js : la musique de victoire remplace celle de l'énigme
                status.textContent = `Résolu en ${puzzle.moves} coup${puzzle.moves > 1 ? 's' : ''} !`;
                showVictory();
                sfx?.('victory');
            }
        } else { won = false; status.textContent = `Coups : ${puzzle.moves}`; }
        el.querySelectorAll('[data-act="undo"],[data-act="reset"],[data-dir]').forEach(b => { b.disabled = won || Boolean(replay); });
    }

    // Solution (page de test) : repart du début et rejoue lentement la suite de coups la plus courte ; toute action du joueur l'arrête.
    let replay = null;
    const solveBtn = el.querySelector('[data-act="solve"]');
    function stopReplay() {
        if (!replay) return;
        clearTimeout(replay);
        replay = null;
        if (solveBtn) solveBtn.textContent = 'Solution';
        refresh();
    }
    function playSolution() {
        if (replay) { stopReplay(); return; }
        const path = solvePath(def);
        if (!path || path.length < 2) { status.textContent = 'Aucune solution trouvée'; return; }
        puzzle.reset();
        replay = true;
        solveBtn.textContent = 'Arrêter';
        refresh();
        const delay = Math.min(800, Math.max(250, 30000 / (path.length - 1)));   // 30 s au plus pour les longues solutions
        let i = 1;
        const step = () => {
            let next = path[i];
            const info = puzzle.mode.describe?.(path[i - 1], next);
            if (puzzle.mode.swipeSelects && info?.id) next = { ...next, sel: info.id };      // le bloc déplacé est montré comme choisi
            puzzle.play(next);
            i++;
            if (i >= path.length) { replay = null; solveBtn.textContent = 'Solution'; } else replay = setTimeout(step, delay);
            refresh();
        };
        replay = setTimeout(step, 500);
    }
    function close(solved) {
        if (closed) return;
        closed = true;
        clearTimeout(replay);
        window.removeEventListener('keydown', onKey, true);
        window.removeEventListener('resize', onResize);
        el.remove();
        onClose?.();
        if (solved) onSolved?.();
    }
    function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false); return; }
        const d = KEYS[e.key] || KEYS[e.key?.toLowerCase()];
        if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { stopReplay(); puzzle.undo(); refresh(); e.preventDefault(); e.stopPropagation(); return; }
        if (!d) return;
        stopReplay();                                   // une touche de déplacement reprend la main sur la solution
        e.preventDefault(); e.stopPropagation();       // le héros ne doit pas marcher derrière la fenêtre
        if (puzzle.dir(gameDir(d))) refresh();
    }
    window.addEventListener('keydown', onKey, true);
    const onResize = () => { if (fitRotation()) refresh(); };
    window.addEventListener('resize', onResize);

    el.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b) return;
        e.stopPropagation();
        if (b.dataset.dir) { if (puzzle.dir(gameDir(b.dataset.dir))) refresh(); return; }
        switch (b.dataset.act) {
            case 'undo': puzzle.undo(); refresh(); break;
            case 'reset': puzzle.reset(); refresh(); break;
            case 'solve': playSolution(); break;
            case 'close': close(false); break;
            case 'done': close(true); break;
        }
    });
    // Appui sur le plateau → case ; glissement (> 0,6 case) → direction (déplace le héros ou le bloc choisi).
    let down = null;
    const cellOf = e => {
        const r = svg.getBoundingClientRect();
        const dw = rot ? h : w, dh = rot ? w : h;                  // taille affichée (le plateau pivoté échange largeur et hauteur)
        const k = Math.min(r.width / dw, r.height / dh);          // le viewBox est centré dans le cadre (preserveAspectRatio)
        const ox = (r.width - k * dw) / 2, oy = (r.height - k * dh) / 2;
        const X = (e.clientX - r.left - ox) / k, Y = (e.clientY - r.top - oy) / k;
        return rot ? { fx: Y, fy: h - X } : { fx: X, fy: Y };       // retour dans le repère du plateau
    };
    svg.addEventListener('pointerdown', e => { stopReplay(); down = cellOf(e); down.id = e.pointerId; });
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
