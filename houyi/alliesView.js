// Barre des compagnons en combat : une carte par compagnon de l'équipe (portrait, nom, classe, barre de vie). Hors de combat à 0 PV : carte grisée.
// Les compagnons partagent le qì de Hou Yi (aucune réserve propre). Données : gameState.allies (allies.js).
import { gbaSprite, loadGbaSprites } from './sprites/index.js';
import { escapeHtml } from './escapeHtml.js';
import { CLASS_SHORT } from './classRoster.js';
import { gameState, currentTurn, activateXiuxian } from './game.js';
import { TRANSE_EFFECTS, TRANSE_TURNS } from './transe.js';
import { RAGE_MAX } from './ultimates.js';

// Zone Xiūxiān d'un compagnon : cachée, elle s'affiche au clic long (appui maintenu) sur sa carte ; la jauge pleine se touche pour la déclencher.
const XIU_HOLD_MS = 450, XIU_SHOW_MS = 6000, XIU_MOVE_PX = 10;
const shown = new Map();   // classId -> fin d'affichage (ms)
let bound = false;

const portrait = key => {
    try { return gbaSprite(key, 'front') || ''; } catch { return ''; }
};

/** (Re)dessine la barre des compagnons ; masquée hors combat ou sans compagnon dans l'équipe. */
export function renderAllyBar() {
    const box = typeof document !== 'undefined' ? document.getElementById('ally-bar') : null;
    if (!box) return;
    const allies = Object.values(gameState.allies || {});
    box.hidden = gameState.combatState !== 'active' || !allies.length;
    if (box.hidden) { box.innerHTML = ''; return; }
    bindXiu(box);
    box.innerHTML = allies.map(a => {
        const pct = Math.max(0, Math.min(100, Math.round(a.hp / a.maxHp * 100)));
        const src = portrait(a.sprite);
        const open = (shown.get(a.classId) || 0) > Date.now();
        const inXiu = Math.floor(a.transe || 0) > 0, full = Math.floor(a.rage || 0) >= RAGE_MAX;
        const ready = !a.ko && !inXiu && full && gameState.combatState === 'active' && currentTurn === 'player';
        const gauge = inXiu ? Math.floor(a.transe) / TRANSE_TURNS * 100 : Math.min(100, a.rage || 0);
        const eff = TRANSE_EFFECTS[a.classId];
        const xiu = `<button type="button" class="ally-xiu${inXiu ? ' in-xiu' : ''}${ready ? ' ready' : ''}" data-xiu="${a.classId}" ${ready ? '' : 'disabled'} title="${escapeHtml(eff ? `${eff.name} : ${eff.text}` : 'Xiūxiān')}"><i style="width:${gauge}%"></i><span>${inXiu ? `${eff?.name || 'Xiūxiān'} · ${Math.floor(a.transe)} t` : ready ? 'XIŪXIĀN !' : `Xiūxiān ${Math.floor(a.rage || 0)}`}</span></button>`;
        return `<div class="ally-card${a.ko ? ' ko' : ''}${open || inXiu ? ' show-xiu' : ''}${inXiu ? ' xiu-on' : ''}" data-ally="${a.classId}" tabindex="0" title="${escapeHtml(`${a.name} · ${CLASS_SHORT[a.classId]} · ${a.hp}/${a.maxHp} PV${a.ko ? ' (hors de combat)' : ''}`)}">`
            + `${src ? `<img class="ally-portrait" src="${src}" alt="" width="30" height="30">` : '<span class="ally-portrait"></span>'}`
            + `<span class="ally-name">${escapeHtml(a.short)}</span>`
            + `<span class="ally-hp" role="progressbar" aria-label="PV de ${escapeHtml(a.name)}" aria-valuemin="0" aria-valuemax="${a.maxHp}" aria-valuenow="${a.hp}"><i style="width:${pct}%"></i></span>${xiu}</div>`;
    }).join('');
}

/** Charge les dessins des compagnons de l'équipe puis redessine la barre. */
export function prepareAllyPortraits() {
    const keys = Object.values(gameState.allies || {}).map(a => a.sprite);
    if (!keys.length) { renderAllyBar(); return Promise.resolve(); }
    return Promise.resolve(loadGbaSprites(keys)).catch(() => {}).then(renderAllyBar);
}


function showXiu(classId, on) {
    shown.set(classId, on ? Date.now() + XIU_SHOW_MS : 0);
    renderAllyBar();
    if (on) setTimeout(renderAllyBar, XIU_SHOW_MS + 50);
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
        timer = setTimeout(() => { timer = null; showXiu(card.dataset.ally, (shown.get(card.dataset.ally) || 0) <= Date.now()); }, XIU_HOLD_MS);
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
        if (card && ev.target === card && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); showXiu(card.dataset.ally, (shown.get(card.dataset.ally) || 0) <= Date.now()); }
    });
}
