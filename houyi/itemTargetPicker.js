/**
 * itemTargetPicker.js — « Sur qui ? » : choix du personnage (Hou Yi ou un compagnon de l'équipe) quand on utilise une potion ou un objet
 * en combat. Chaque ligne montre la barre de vie du personnage (PV actuels / max, hors de combat indiqué) ; seuls ceux que l'objet peut
 * aider sont cliquables. Fenêtre superposée au jeu, fermée par Annuler, la touche Échap ou un clic à côté.
 */
import { player, gameState } from './game.js';
import { escapeHtml } from './escapeHtml.js';

/** Hou Yi puis les compagnons de l'équipe : [{ classId, name, hp, maxHp, ko }]. */
export function teamMembers() {
    return [{ classId: 'assassin', name: 'Hou Yi', hp: Math.max(0, player.hp), maxHp: player.maxHp, ko: !!gameState.heroKo },
        ...Object.values(gameState.allies || {}).map(a => ({ classId: a.classId, name: a.name, hp: a.hp, maxHp: a.maxHp, ko: !!a.ko }))];
}

/** Au moins un compagnon est encore debout : il faut alors demander sur qui utiliser une potion de soin. */
export const hasLivingAlly = () => Object.values(gameState.allies || {}).some(a => !a.ko);

let current = null;
export function closeTargetPicker() { current?.close(); }

/**
 * @param {string} title ex. « Potion moyenne : sur qui ? »
 * @param {(m: object) => string|null} blockReason null si le membre peut être visé, sinon la raison affichée
 * @param {(classId: string) => void} onPick
 */
export function openTargetPicker({ title, blockReason, onPick }) {
    closeTargetPicker();
    const overlay = document.createElement('div');
    overlay.className = 'target-picker-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', title);
    const rows = teamMembers().map(m => {
        const reason = blockReason ? blockReason(m) : null;
        const pct = m.maxHp ? Math.round(100 * Math.min(1, m.hp / m.maxHp)) : 0;
        return `<button type="button" class="target-row${m.ko ? ' ko' : ''}" data-pick="${escapeHtml(m.classId)}"${reason ? ' disabled' : ''}>
            <span class="target-name">${escapeHtml(m.name)}</span>
            <span class="target-hp" role="progressbar" aria-valuemin="0" aria-valuemax="${m.maxHp}" aria-valuenow="${m.hp}"><span class="target-hp-fill${pct < 30 ? ' low' : ''}" style="width:${pct}%"></span></span>
            <span class="target-hp-text">${m.ko ? 'hors de combat' : `${m.hp} / ${m.maxHp} PV`}${reason && !m.ko ? ` · ${escapeHtml(reason)}` : ''}</span></button>`;
    }).join('');
    overlay.innerHTML = `<div class="target-picker"><div class="target-title">${escapeHtml(title)}</div>${rows}<button type="button" class="target-cancel" data-cancel>Annuler</button></div>`;
    const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey, true); if (current && current.overlay === overlay) current = null; };
    const onKey = ev => { if (ev.key === 'Escape') { ev.stopPropagation(); close(); } };
    overlay.addEventListener('click', ev => {
        if (ev.target === overlay || ev.target.closest('[data-cancel]')) { close(); return; }
        const pick = ev.target.closest('[data-pick]');
        if (pick && !pick.disabled) { const id = pick.dataset.pick; close(); onPick(id); }
    });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(overlay);
    overlay.querySelector('.target-row:not([disabled])')?.focus();
    current = { overlay, close };
    return overlay;
}
