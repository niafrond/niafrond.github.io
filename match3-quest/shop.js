// =====================================
// Marchands (PNJ des villages, voir merchants.js)
// =====================================

import { getRarityIcon, getRarityColor } from './items.js';
import { icon as svgIcon } from './icons.js';
import { offerObject, availableOffers, buyOffer, sellableEntries, sellEntry } from './merchants.js';
import { player, gameState, log, updateAvailableWeapons, saveUpdate, getWeaponIcon, updateInventoryTab, updateItemButton, createWeaponButton } from './game.js';

const SECTION_TITLES = {
    mount: 'Monture',
    stall: 'Étal',
    rare: 'Pièces rares',
    exceptional: 'Pièce d\'exception'
};
const RARITY_LABEL = { common: 'Commun', uncommon: 'Peu commun', rare: 'Rare', legendary: 'Ultra rare' };

const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function offerRow(offer, gold) {
    const obj = offerObject(offer);
    if (!obj) return '';
    const canAfford = gold >= offer.price;
    const color = getRarityColor(offer.rarity);
    const icon = offer.kind === 'weapon' ? getWeaponIcon(obj.type) : getRarityIcon(offer.rarity);
    const levelText = offer.kind === 'mount' ? '' : ` • Niv. ${obj.minLevel}`;
    const stats = offer.kind === 'mount' ? `Déplacements ×${obj.speed}`
        : offer.kind === 'weapon'
        ? `${obj.damage} ${svgIcon('skull')} • ${obj.actionPoints} ${svgIcon('arrow')}`
        : obj.type === 'shield' ? `Déf. +${obj.defense}`
            : obj.type === 'reusable' ? `${obj.actionPoints || 2} ${svgIcon('arrow')} • ${obj.chargesPerCycle} charge${obj.chargesPerCycle > 1 ? 's' : ''}, rechargé en ${obj.rechargeTurns || 4} tours`
                : 'Relique passive';
    return `
        <div class="weapon-item shop-weapon merchant-offer rarity-${offer.rarity}" style="border-left:3px solid ${color}">
            <span class="weapon-icon">${icon}</span>
            <div class="weapon-details">
                <span class="weapon-name">${escapeHtml(obj.name)} <em class="merchant-rarity" style="color:${color}">${RARITY_LABEL[offer.rarity] || ''}</em></span>
                <span class="weapon-stats">${stats}${levelText}</span>
                <span class="weapon-description">${escapeHtml(obj.description || '')}</span>
            </div>
            <div class="shop-weapon-right">
                <span class="shop-price-tag">${offer.price} ${svgIcon('coin')}</span>
                <button type="button" class="weapon-action" data-buy="${offer.key}" ${canAfford ? '' : 'disabled'}>${canAfford ? 'Acheter' : 'Trop cher'}</button>
            </div>
        </div>`;
}

function sellRow(entry) {
    const obj = entry.obj;
    const color = getRarityColor(entry.rarity);
    const icon = entry.kind === 'weapon' ? getWeaponIcon(obj.type) : getRarityIcon(entry.rarity);
    const stats = entry.kind === 'weapon' ? `${obj.damage} ${svgIcon('skull')} • ${obj.actionPoints} ${svgIcon('arrow')}` : (obj.type === 'shield' ? `Déf. +${obj.defense}` : obj.type === 'artifact' ? 'Relique' : 'Objet');
    return `
        <div class="weapon-item shop-weapon merchant-offer${entry.locked ? ' is-locked' : ''}" style="border-left:3px solid ${color}">
            <span class="weapon-icon">${icon}</span>
            <div class="weapon-details">
                <span class="weapon-name">${escapeHtml(obj.name)} <em class="merchant-rarity" style="color:${color}">${RARITY_LABEL[entry.rarity] || ''}</em></span>
                <span class="weapon-stats">${stats} • Niv. ${obj.minLevel}</span>
            </div>
            <div class="shop-weapon-right">
                <span class="shop-price-tag">+${entry.price} ${svgIcon('coin')}</span>
                <button type="button" class="weapon-action" data-sell="${entry.key}" ${entry.locked ? 'disabled' : ''}>${entry.locked ? escapeHtml(entry.locked) : 'Vendre'}</button>
            </div>
        </div>`;
}

/**
 * Remplit `card` avec la boutique du marchand `npc` (fiche de PNJ) et gère les achats.
 * hooks : { close(), ngPlus? }
 */
export function renderMerchant(npc, card, hooks = {}) {
    let mode = 'buy';
    const drawSell = (note = '') => {
        const entries = sellableEntries(player);
        card.innerHTML = `
            <h3>${svgIcon('coin')} ${escapeHtml(npc.name)}</h3>
            <div class="carnet-tabs"><button type="button" class="carnet-tab" data-mode="buy">Acheter</button><button type="button" class="carnet-tab on" data-mode="sell">Vendre</button></div>
            <p class="shop-subtitle">Le matériel activé reste dans votre sac.</p>
            <div class="shop-gold-display">${svgIcon('coin')} Or disponible : <strong>${player.gold || 0}</strong></div>
            ${note ? `<p class="merchant-note">${escapeHtml(note)}</p>` : ''}
            ${entries.length ? entries.map(sellRow).join('') : '<p class="shop-empty">Vous n\'avez rien à vendre.</p>'}
            <button type="button" class="primary merchant-close">Fermer</button>`;
    };
    const draw = (note = '') => {
        if (mode === 'sell') { drawSell(note); return; }
        const offers = availableOffers(npc.id, player, hooks.ngPlus || 0);
        const sections = Object.keys(SECTION_TITLES).map(section => {
            const rows = offers.filter(o => o.section === section);
            if (!rows.length) return '';
            return `<h3 class="shop-section-title">${SECTION_TITLES[section]}</h3>${rows.map(o => offerRow(o, player.gold || 0)).join('')}`;
        }).join('');
        card.innerHTML = `
            <h3>${svgIcon('coin')} ${escapeHtml(npc.name)}</h3>
            <div class="carnet-tabs"><button type="button" class="carnet-tab on" data-mode="buy">Acheter</button><button type="button" class="carnet-tab" data-mode="sell">Vendre</button></div>
            <p class="shop-subtitle">${escapeHtml(npc.title || 'Marchand')}</p>
            <div class="shop-gold-display">${svgIcon('coin')} Or disponible : <strong>${player.gold || 0}</strong></div>
            ${note ? `<p class="merchant-note">${escapeHtml(note)}</p>` : ''}
            ${sections || '<p class="shop-empty">Le marchand a tout vendu.</p>'}
            <button type="button" class="primary merchant-close">Fermer</button>`;
    };
    card.onclick = ev => {
        if (ev.target.closest('.merchant-close')) { hooks.close?.(); return; }
        const modeBtn = ev.target.closest('[data-mode]');
        if (modeBtn) { mode = modeBtn.dataset.mode; draw(); return; }
        const sellBtn = ev.target.closest('[data-sell]');
        if (sellBtn) {
            if (gameState.combatState === 'active') { draw('La boutique est inaccessible pendant le combat !'); return; }
            const res = sellEntry(player, sellBtn.dataset.sell);
            if (res.ok) {
                updateAvailableWeapons();
                updateInventoryTab?.();
                updateItemButton?.();
                createWeaponButton?.();
                saveUpdate();
                log(res.message);
            }
            draw(res.message);
            return;
        }
        const btn = ev.target.closest('[data-buy]');
        if (!btn) return;
        if (gameState.combatState === 'active') { draw('La boutique est inaccessible pendant le combat !'); return; }
        const res = buyOffer(npc.id, btn.dataset.buy, player, hooks.ngPlus || 0);
        if (res.ok) {
            if (res.offer.kind === 'weapon') updateAvailableWeapons();
            else updateInventoryTab?.();
            saveUpdate();
            log(res.message);
        }
        draw(res.message);
    };
    draw();
}
