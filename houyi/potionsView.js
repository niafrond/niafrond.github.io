// Potions de soin à usage unique (potions.js) : boutons de combat (coût en PA) et panneau de l'onglet Inventaire (on boit hors combat, gratuitement).
import { player, gameState, currentTurn, drinkPotionAction, xiuEffect } from './game.js';
import { POTION_SIZES, POTIONS, potionCount, potionHeal, drinkBlockReason } from './potions.js';
import { escapeHtml } from './escapeHtml.js';

const label = size => `${POTIONS[size].name} (+${potionHeal(player, size)} PV)`;

/** Boutons de potion du combat : une tuile par taille, avec le nombre restant et le coût en points d'action. */
export function renderPotionButtons() {
    const box = document.getElementById('potion-buttons');
    if (!box) return;
    if (gameState.combatState !== 'active') { box.innerHTML = ''; return; }
    box.innerHTML = POTION_SIZES.map(size => {
        const p = POTIONS[size];
        const free = !!xiuEffect().freePotions;   // Souffle du Lotus d'Or : potions sans point d'action
        const blocked = currentTurn !== 'player' || drinkBlockReason(player, size, true, free);
        return `<button type="button" class="enemy-spell-item potion-btn${blocked ? ' disabled' : ''}" data-potion="${size}"${blocked ? ' disabled' : ''} title="${escapeHtml(label(size))}">
            <div class="spell-name">${escapeHtml(p.name)} ×${potionCount(player, size)}</div>
            <div class="spell-cost">${free ? '0 PA' : `${p.actionPoints} PA`} · ${p.healPct} % des PV</div></button>`;
    }).join('');
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
        const btn = ev.target.closest('[data-potion]');
        if (btn && !btn.disabled) drinkPotionAction(btn.dataset.potion);
    });
    renderPotionsPanel();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
