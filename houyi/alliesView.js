// Barre des compagnons en combat : une carte par compagnon de l'équipe (portrait, nom, classe, barre de vie). Hors de combat à 0 PV : carte grisée.
// Les compagnons partagent le qì de Hou Yi (aucune réserve propre). Données : gameState.allies (allies.js).
import { gbaSprite, loadGbaSprites } from './sprites/index.js';
import { escapeHtml } from './escapeHtml.js';
import { CLASS_SHORT } from './classRoster.js';
import { gameState, currentTurn, activateXiuxian } from './game.js';
import { decoupled } from './gameSpellList.js';
import { TRANSE_EFFECTS, TRANSE_TURNS } from './transe.js';
import { RAGE_MAX } from './ultimates.js';

// Zone Xiūxiān d'un compagnon : cachée, elle s'affiche au clic long (appui maintenu) sur sa carte ; la jauge pleine se touche pour la déclencher.
const XIU_HOLD_MS = 450, XIU_SHOW_MS = 6000, XIU_MOVE_PX = 10;
let bound = false;
let textTimer = null;
/** Texte de la Xiūxiān (bandeau « effet, tours restants ») : caché, il s'affiche quelques secondes après un clic long sur un personnage. Les jauges, elles, sont toujours visibles. */
export function showXiuText(on) {
    clearTimeout(textTimer);
    document.body.classList.toggle('show-xiu-text', !!on);
    if (on) textTimer = setTimeout(() => document.body.classList.remove('show-xiu-text'), XIU_SHOW_MS);
}

const portrait = key => {
    try { return gbaSprite(key, 'front') || ''; } catch { return ''; }
};

/** La barre des compagnons du haut de l'écran n'existe plus : leurs PV et leur Xiūxiān sont dans leur bouton de la barre d'action (gameSpellList.js : renderClassPicker). */
export function renderAllyBar() {
    const box = typeof document !== 'undefined' ? document.getElementById('ally-bar') : null;
    if (box) { box.hidden = true; box.innerHTML = ''; }
}

/** Charge les dessins des compagnons de l'équipe puis redessine la barre. */
export function prepareAllyPortraits() {
    const keys = Object.values(gameState.allies || {}).map(a => a.sprite);
    if (!keys.length) { renderAllyBar(); return Promise.resolve(); }
    return Promise.resolve(loadGbaSprites(keys)).catch(() => {}).then(renderAllyBar);
}


/** Clic long (appui maintenu) sur la carte d'un compagnon : sa zone Xiūxiān s'affiche ; toucher la jauge pleine déclenche sa Xiūxiān. */
function bindXiu(box) {
    if (bound || box.dataset.xiuBound) return;
    bound = true; box.dataset.xiuBound = '1';
    let timer = null, sx = 0, sy = 0;
    const cancel = () => { clearTimeout(timer); timer = null; };
    box.addEventListener('pointerdown', ev => {
        const card = ev.target.closest?.('.ally-card');
        if (!card || ev.target.closest('.ally-xiu')) return;
        sx = ev.clientX; sy = ev.clientY; cancel();
        timer = setTimeout(() => { timer = null; showXiuText(!document.body.classList.contains('show-xiu-text')); }, XIU_HOLD_MS);
    });
    box.addEventListener('pointermove', ev => { if (timer && Math.hypot(ev.clientX - sx, ev.clientY - sy) > XIU_MOVE_PX) cancel(); });
    ['pointerup', 'pointercancel'].forEach(t => box.addEventListener(t, cancel));   // pas pointerleave : la barre est redessinée souvent, ce qui le déclenche
    box.addEventListener('contextmenu', ev => ev.preventDefault());
    box.addEventListener('click', ev => {
        const btn = ev.target.closest?.('.ally-xiu');
        if (btn && !btn.disabled) { activateXiuxian(btn.dataset.xiu); renderAllyBar(); }
    });
    box.addEventListener('keydown', ev => {
        const card = ev.target.closest?.('.ally-card');
        if (card && ev.target === card && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); showXiuText(!document.body.classList.contains('show-xiu-text')); }
    });
}
