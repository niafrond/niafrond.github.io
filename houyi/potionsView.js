// Potions de soin à usage unique (potions.js) : boutons de combat (coût en PA) et panneau de l'onglet Inventaire (on boit hors combat, gratuitement).
import { player, gameState, currentTurn, drinkPotionAction, xiuEffect } from './game.js';
import { POTION_SIZES, POTIONS, potionCount, potionHeal, drinkBlockReason } from './potions.js';
import { escapeHtml } from './escapeHtml.js';

const label = size => `${POTIONS[size].name} (+${potionHeal(player, size)} PV)`;

let potionMenuOpen = false;   // le menu des potions est déplié (après un clic sur « Objet »)

/** Potions du combat : un seul bouton « Objet » ; il déplie le choix de la potion (une tuile par taille : nombre restant, coût en points d'action). */
export function renderPotionButtons() {
    const box = document.getElementById('potion-buttons');
    if (!box) return;
    if (gameState.combatState !== 'active') { potionMenuOpen = false; box.innerHTML = ''; return; }
    const mine = currentTurn === 'player';
    const total = POTION_SIZES.reduce((n, size) => n + potionCount(player, size), 0);
    if (!mine || !total) potionMenuOpen = false;
    if (!potionMenuOpen) {
        const off = !mine || !total;
        box.innerHTML = `<button type="button" class="enemy-spell-item potion-btn${off ? ' disabled' : ''}" data-open-potions${off ? ' disabled' : ''} title="${total ? 'Choisir une potion' : 'Aucune potion : achetez-en chez les marchands'}">
            <div class="spell-name">Objet</div>
            <div class="spell-cost">Potions ×${total}</div></button>`;
        return;
    }
    const free = !!xiuEffect().freePotions;   // Souffle du Lotus d'Or : potions sans point d'action
    box.innerHTML = POTION_SIZES.map(size => {
        const p = POTIONS[size];
        const blocked = drinkBlockReason(player, size, true, free);
        return `<button type="button" class="enemy-spell-item potion-btn${blocked ? ' disabled' : ''}" data-potion="${size}"${blocked ? ' disabled' : ''} title="${escapeHtml(label(size))}">
            <div class="spell-name">${escapeHtml(p.name)} ×${potionCount(player, size)}</div>
            <div class="spell-cost">${free ? '0 PA' : `${p.actionPoints} PA`} · ${p.healPct} % des PV</div></button>`;
    }).join('') + `<button type="button" class="enemy-spell-item potion-btn potion-back" data-close-potions><div class="spell-name">Retour</div></button>`;
}

/** Panneau de l'Inventaire : stock de potions et bouton « Boire » (hors combat). */
export function renderPotionsPanel() {
    const box = document.getElementById('potions-panel');
    if (!box) return;
    const inCombat = gameState.combatState === 'active';
    box.innerHTML = `<h3>Potions</h3><p class="potions-note">À usage unique. Les PV ne reviennent pas tout seuls après un combat : achetez-en chez les marchands.</p>` +
        POTION_SIZES.map(size => {
            const p = POTIONS[size];
            const reason = inCombat ? 'Pendant le combat, utilisez les boutons de potion.' : drinkBlockReason(player, size, false);
            return `<div class="potion-row"><span><strong>${escapeHtml(p.name)}</strong> ×${potionCount(player, size)} <em>+${potionHeal(player, size)} PV (${p.healPct} %)</em></span>
                <button type="button" class="rc-btn" data-drink="${size}"${reason ? ' disabled' : ''} title="${escapeHtml(reason || 'Boire (gratuit hors combat)')}">Boire</button></div>`;
        }).join('');
}

function init() {
    document.addEventListener('stuff-changed', renderPotionsPanel);
    document.addEventListener('potions-changed', () => { renderPotionsPanel(); renderPotionButtons(); });
    document.getElementById('potions-panel')?.addEventListener('click', ev => {
        const btn = ev.target.closest('[data-drink]');
        if (btn) { drinkPotionAction(btn.dataset.drink); renderPotionsPanel(); }
    });
    document.getElementById('potion-buttons')?.addEventListener('click', ev => {
        const open = ev.target.closest('[data-open-potions]');
        if (open && !open.disabled) { potionMenuOpen = true; renderPotionButtons(); return; }
        if (ev.target.closest('[data-close-potions]')) { potionMenuOpen = false; renderPotionButtons(); return; }
        const btn = ev.target.closest('[data-potion]');
        if (btn && !btn.disabled) { potionMenuOpen = false; drinkPotionAction(btn.dataset.potion); renderPotionButtons(); }
    });
    renderPotionsPanel();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else setTimeout(init, 0);
