/**
 * targetActions.js — choix d'une cible DANS la zone d'action (colonne des sorts du joueur) : une fois l'attaque, la potion ou l'objet choisi,
 * les boutons d'action sont remplacés par un bouton par cible (nom + barre de vie) : ennemis pour une attaque ciblée, personnages pour un soin.
 * Module sans dépendance : foesView.js (ennemis) et itemTargetPicker.js (personnages) s'en servent. Échap ou « Annuler » referme.
 */
let owner = null;
let cancelCb = null;
let onKey = null;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** La zone d'action est-elle visible (écran de combat affiché) ? Sinon l'appelant garde sa fenêtre superposée. */
export function targetActionsAvailable() {
    const zone = typeof document !== 'undefined' ? document.getElementById('player-spells') : null;
    return Boolean(zone && zone.getClientRects().length);
}

export const targetActionsOwner = () => owner;

/** Referme le panneau (si `who` est donné, seulement s'il en est le propriétaire). */
export function hideTargetActions(who = null) {
    if (who && owner !== who) return;
    document.getElementById('target-actions')?.remove();
    document.body?.classList.remove('target-actions-on');
    if (onKey) document.removeEventListener('keydown', onKey, true);
    onKey = null; cancelCb = null; owner = null;
}

/**
 * @param {{who: string, title: string, items: {id: string, name: string, hp: number, maxHp: number, ko?: boolean, reason?: string|null, hanzi?: boolean}[],
 *   onPick: (id: string) => void, onCancel?: () => void}} o  `reason` renseignée = bouton grisé.
 */
export function showTargetActions({ who, title, items, onPick, onCancel }) {
    hideTargetActions();
    const zone = document.getElementById('player-spells');
    if (!zone) return false;
    owner = who; cancelCb = onCancel || null;
    const panel = document.createElement('div');
    panel.id = 'target-actions';
    panel.className = 'target-actions';
    panel.setAttribute('role', 'group');
    panel.setAttribute('aria-label', title);
    panel.innerHTML = `<div class="ta-title">${esc(title)}</div>` + items.map(it => {
        const pct = it.maxHp ? Math.round(100 * Math.max(0, Math.min(1, it.hp / it.maxHp))) : 0;
        const txt = it.ko ? 'hors de combat' : `${Math.max(0, it.hp)} / ${it.maxHp} PV`;
        return `<button type="button" class="ta-btn${it.ko ? ' ko' : ''}" data-ta="${esc(it.id)}"${it.reason ? ' disabled' : ''} aria-label="${esc(it.name)}, ${txt}${it.reason ? ', ' + esc(it.reason) : ''}">`
            + `<span class="ta-name${it.hanzi ? ' name-hanzi' : ''}">${esc(it.name)}</span>`
            + `<span class="ta-text">${txt}${it.reason && !it.ko ? ' · ' + esc(it.reason) : ''}</span>`
            + `<span class="ta-hp"><span class="${pct < 30 ? 'low' : ''}" style="width:${pct}%"></span></span></button>`;
    }).join('') + '<button type="button" class="ta-cancel" data-ta-cancel>Annuler</button>';
    panel.addEventListener('click', ev => {
        if (ev.target.closest('[data-ta-cancel]')) { const cb = cancelCb; hideTargetActions(); cb?.(); return; }
        const b = ev.target.closest('[data-ta]');
        if (!b || b.disabled) return;
        hideTargetActions();
        onPick(b.dataset.ta);
    });
    onKey = ev => { if (ev.key === 'Escape') { ev.stopPropagation(); const cb = cancelCb; hideTargetActions(); cb?.(); } };
    document.addEventListener('keydown', onKey, true);
    zone.prepend(panel);
    document.body.classList.add('target-actions-on');
    panel.querySelector('.ta-btn:not([disabled])')?.focus({ preventScroll: true });
    return true;
}
