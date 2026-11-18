// Potions de soin à usage unique (potions.js) : boutons de combat (coût en PA) et panneau de l'onglet Inventaire (on boit hors combat, gratuitement).
import { player, gameState, currentTurn, drinkPotionAction, xiuEffect } from './game.js';
import { POTION_SIZES, POTIONS, potionCount, potionHeal, drinkBlockReason } from './potions.js';
import { escapeHtml } from './escapeHtml.js';
import { itemUsability, useInventoryItem, eligibleTargets } from './gameInventoryTabs.js';
import { isTeamItem } from './items.js';
import { classCanAct } from './gameSpellList.js';
import { isSingleUse } from './itemReuse.js';

const label = size => `${POTIONS[size].name} (+${potionHeal(player, size)} PV)`;

let potionMenuOpen = false;
let pendingTarget = null;   // objet d'équipe choisi : { index, id } ; il reste à désigner l'équipier   // le menu des potions est déplié (après un clic sur « Objet »)

/** Objets de l'inventaire utilisables en combat (tout objet « usage unique » ou « relique réutilisable » du sac, quel que soit son emplacement actif). */
const usableItems = () => (player.inventory || []).map((item, index) => ({ item, index }))
    .filter(({ item }) => item && (item.type === 'reusable' || item.type === 'consumable'));

const itemTag = item => (item.type === 'reusable' && !isSingleUse(item))
    ? `${item.chargesLeft ?? item.chargesPerCycle}/${item.chargesPerCycle} charges`
    : 'usage unique';

/** « Objet » : un seul bouton en combat ; il déplie le choix parmi les potions et tous les objets du sac (usage unique ou reliques réutilisables). */
export function renderPotionButtons() {
    const box = document.getElementById('potion-buttons');
    if (!box) return;
    if (gameState.combatState !== 'active') { potionMenuOpen = false; box.innerHTML = ''; box.classList.remove('potion-menu'); return; }
    const mine = currentTurn === 'player';
    const potions = POTION_SIZES.reduce((n, size) => n + potionCount(player, size), 0);
    const items = usableItems();
    const total = potions + items.length;
    if (!mine || !total) { potionMenuOpen = false; pendingTarget = null; }
    box.classList.toggle('potion-menu', potionMenuOpen);   // menu déplié : sur toute la largeur
    if (!potionMenuOpen) {
        const off = !mine || !total;
        box.innerHTML = `<button type="button" class="enemy-spell-item potion-btn${off ? ' disabled' : ''}" data-open-potions${off ? ' disabled' : ''} title="${total ? 'Choisir une potion ou un objet' : 'Aucun objet : achetez-en chez les marchands'}">
            <div class="spell-name">Objet</div>
            <div class="spell-cost">${potions ? `Potions ×${potions}` : ''}${potions && items.length ? ' · ' : ''}${items.length ? `Objets ×${items.length}` : ''}${total ? '' : '—'}</div></button>`;
        return;
    }
    if (pendingTarget) {   // « Sur qui ? » : les équipiers que l'objet peut viser
        const item = (player.inventory || [])[pendingTarget.index];
        const targets = item && item.id === pendingTarget.id ? eligibleTargets(item) : [];
        if (!targets.length) pendingTarget = null;
        else {
            box.innerHTML = `<div class="potion-ask">${escapeHtml(item.name)} : sur qui ?</div>` + targets.map(t =>
                `<button type="button" class="enemy-spell-item potion-btn" data-target-class="${t.classId}"><div class="spell-name">${escapeHtml(t.name)}</div><div class="spell-cost">${t.ko ? 'hors de combat' : `${t.hp} / ${t.maxHp} PV`}</div></button>`).join('')
                + `<button type="button" class="enemy-spell-item potion-btn potion-back" data-close-target><div class="spell-name">Retour</div></button>`;
            return;
        }
    }
    const free = !!xiuEffect().freePotions;   // Souffle du Lotus d'Or : potions sans point d'action
    const potionTiles = POTION_SIZES.map(size => {
        const p = POTIONS[size];
        const blocked = drinkBlockReason(player, size, true, free) || !classCanAct();
        return `<button type="button" class="enemy-spell-item potion-btn${blocked ? ' disabled' : ''}" data-potion="${size}"${blocked ? ' disabled' : ''} title="${escapeHtml(label(size))}">
            <div class="spell-name">${escapeHtml(p.name)} ×${potionCount(player, size)}</div>
            <div class="spell-cost">${p.actionPoints > 0 && !free ? `${p.actionPoints} PA · ` : ''}${p.healPct} % des PV</div></button>`;
    }).join('');
    const itemTiles = items.map(({ item, index }) => {
        const use = itemUsability(item);
        return `<button type="button" class="enemy-spell-item potion-btn${use.ok ? '' : ' disabled'}" data-use-item="${index}" data-item-id="${escapeHtml(item.id)}"${use.ok ? '' : ' disabled'} title="${escapeHtml(`${item.description || ''}${use.ok ? '' : ` (${use.reason})`}`)}">
            <div class="spell-name">${escapeHtml(item.name)}</div>
            <div class="spell-cost">${item.actionPoints || 2} PA · ${itemTag(item)}${use.ok ? '' : ` · ${escapeHtml(use.reason)}`}</div></button>`;
    }).join('');
    box.innerHTML = potionTiles + itemTiles + `<button type="button" class="enemy-spell-item potion-btn potion-back" data-close-potions><div class="spell-name">Retour</div></button>`;
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
        const tgt = ev.target.closest('[data-target-class]');
        if (tgt && pendingTarget) { const t = pendingTarget; pendingTarget = null; potionMenuOpen = false; useInventoryItem(t.id, t.index, tgt.dataset.targetClass); renderPotionButtons(); return; }
        if (ev.target.closest('[data-close-target]')) { pendingTarget = null; renderPotionButtons(); return; }
        const itemBtn = ev.target.closest('[data-use-item]');
        if (itemBtn && !itemBtn.disabled) {
            const idx = Number(itemBtn.dataset.useItem), item = (player.inventory || [])[idx];
            if (isTeamItem(item)) { pendingTarget = { index: idx, id: itemBtn.dataset.itemId }; renderPotionButtons(); return; }   // objet d'équipe : on choisit d'abord l'équipier
            potionMenuOpen = false; useInventoryItem(itemBtn.dataset.itemId, idx); renderPotionButtons(); return;
        }
        const btn = ev.target.closest('[data-potion]');
        if (btn && !btn.disabled) { potionMenuOpen = false; drinkPotionAction(btn.dataset.potion); renderPotionButtons(); }
    });
    renderPotionsPanel();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else setTimeout(init, 0);
