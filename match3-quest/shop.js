// =====================================
// Marchands (PNJ des villages, voir merchants.js)
// =====================================

import { getRarityIcon, getRarityColor } from './items.js';
import { icon as svgIcon } from './icons.js';
import { describeStuff, STUFF_SLOT_LABELS } from './stuff.js';
import { offerObject, availableOffers, buyOffer, sellableEntries, sellEntry, surplusEntries, sellSurplus } from './merchants.js';
import { describeManaMax } from './manaGear.js';
import { previewEquip, equippedCounterpart, isComparable } from './equipPreview.js';
import { compareButtonHtml, equipDeltaGroupsHtml } from './compareView.js';
import { rowCardHtml, badgeHtml, cardTipHtml, escapeHtml as esc } from './gameCardUi.js';
import { bindCardTips } from './gameTooltips.js';
import { player, gameState, log, updateAvailableWeapons, saveUpdate, getWeaponIcon, updateInventoryTab, updateItemButton, createWeaponButton } from './game.js';

const SECTION_TITLES = {
    gear: 'Équipement',
    mount: 'Monture',
    stall: 'Étal',
    standard: 'Fournitures',
    stuff: 'Parures',
    rare: 'Pièces rares',
    exceptional: 'Pièce d\'exception'
};
const RARITY_LABEL = { common: 'Commun', uncommon: 'Peu commun', rare: 'Rare', legendary: 'Ultra rare' };

const escapeHtml = esc;

// Offre d'un marchand en carte compacte : nom et rareté, écarts avec ce que vous portez (sinon les chiffres clés), le prix dans le bouton d'achat ;
// « Comparer » et la comparaison complète dans le menu « ⋯ », description à l'appui long.
function offerRow(offer, gold) {
    const obj = offerObject(offer);
    if (!obj) return '';
    const canAfford = gold >= offer.price;
    const color = getRarityColor(offer.rarity);
    const icon = offer.kind === 'weapon' ? getWeaponIcon(obj.type) : getRarityIcon(offer.rarity);
    const special = offer.kind === 'mount' || offer.kind === 'torch';
    const stats = offer.kind === 'torch' ? 'Vue élargie sous terre'
        : offer.kind === 'mount' ? `Déplacements ×${obj.speed}`
        : offer.kind === 'stuff' ? `${STUFF_SLOT_LABELS[obj.slot]} • ${describeStuff(obj)}`
        : offer.kind === 'weapon'
        ? `${obj.damage} ${svgIcon('skull')} • ${obj.actionPoints} ${svgIcon('arrow')}${describeManaMax(obj) ? ` • ${describeManaMax(obj)}` : ''}`
        : obj.type === 'shield' ? `Déf. +${obj.defense}`
            : obj.type === 'reusable' ? `${obj.actionPoints || 2} ${svgIcon('arrow')} • ${obj.chargesPerCycle} charge${obj.chargesPerCycle > 1 ? 's' : ''}`
                : 'Relique passive';
    const kind = offer.kind === 'weapon' ? 'weapon' : offer.kind === 'stuff' ? 'stuff' : 'item';
    const deltas = special ? '' : equipDeltaGroupsHtml(player, kind, obj);
    const tooLow = !special && (obj.minLevel || 1) > player.level;
    const more = (special ? '' : compareButtonHtml(kind, obj.id))
        + (isComparable(offer.kind, obj) ? `<button type="button" class="compare-btn" data-preview="${offer.key}" title="Voir l'effet sur vos stats par rapport à la pièce équipée">Comparer à l'équipé</button>` : '');
    return rowCardHtml({
        key: `shop:${offer.key}`, cls: `merchant-offer rarity-${offer.rarity}`, border: color,
        name: `${icon} ${escapeHtml(obj.name)}`,
        badges: (offer.rarity === 'rare' || offer.rarity === 'legendary' ? badgeHtml(RARITY_LABEL[offer.rarity]) : '') + (tooLow ? badgeHtml(`Niv. ${obj.minLevel}`, 'rc-badge-warn') : ''),
        sub: deltas || `<span class="rc-stats">${stats}</span>`,
        primary: `<button type="button" class="rc-btn rc-buy" data-buy="${offer.key}" ${canAfford ? '' : 'disabled'} title="${canAfford ? 'Acheter' : 'Pas assez d\'or'}">${offer.price} ${svgIcon('coin')}</button>`,
        more,
        tip: cardTipHtml(escapeHtml(obj.name), [stats, special ? '' : `Niv. ${obj.minLevel}`, `${RARITY_LABEL[offer.rarity] || ''} • ${offer.price} pièces d'or`], escapeHtml(obj.description || ''))
    });
}

function sellRow(entry) {
    const obj = entry.obj;
    const color = getRarityColor(entry.rarity);
    const icon = entry.kind === 'weapon' ? getWeaponIcon(obj.type) : getRarityIcon(entry.rarity);
    const kind = entry.kind === 'weapon' ? 'weapon' : entry.kind === 'stuff' ? 'stuff' : 'item';
    const stats = entry.kind === 'stuff' ? `${STUFF_SLOT_LABELS[obj.slot]} • ${describeStuff(obj)}` : entry.kind === 'weapon' ? `${obj.damage} ${svgIcon('skull')} • ${obj.actionPoints} ${svgIcon('arrow')}` : (obj.type === 'shield' ? `Déf. +${obj.defense}` : obj.type === 'artifact' ? 'Relique' : 'Objet');
    return rowCardHtml({
        key: `sell:${entry.key}`, cls: `merchant-offer${entry.locked ? ' is-locked' : ''}`, border: color,
        name: `${icon} ${escapeHtml(obj.name)}`,
        badges: entry.rarity === 'rare' || entry.rarity === 'legendary' ? badgeHtml(RARITY_LABEL[entry.rarity]) : '',   // communs et peu communs : la couleur du liseré suffit
        sub: `<span class="rc-stats">${stats}</span>`,
        primary: `<button type="button" class="rc-btn rc-buy" data-sell="${entry.key}" ${entry.locked ? 'disabled' : ''} title="${entry.locked ? escapeHtml(entry.locked) : 'Vendre'}">${entry.locked ? escapeHtml(entry.locked) : `+${entry.price} ${svgIcon('coin')}`}</button>`,
        more: compareButtonHtml(kind, obj.id),
        tip: cardTipHtml(escapeHtml(obj.name), [stats, `Niv. ${obj.minLevel}`, `Rachat : ${entry.price} pièces d'or`], escapeHtml(obj.description || ''))
    });
}

// Comparaison avec la pièce équipée : stats globales avant → après (vert = mieux, rouge = moins bien).
function previewPanel(offer) {
    const obj = offer && offerObject(offer);
    if (!obj || !isComparable(offer.kind, obj)) return '';
    const current = equippedCounterpart(player, offer.kind, obj);
    const rows = previewEquip(player, offer.kind, obj).map(r => `
        <tr><th scope="row">${r.label}</th><td>${r.before}</td><td>${r.after}</td>
        <td class="${!r.delta ? '' : (r.delta > 0) === (r.better !== 'low') ? 'delta-up' : 'delta-down'}">${r.delta > 0 ? '+' : r.delta < 0 ? '−' : ''}${r.delta ? Math.abs(r.delta) : '='}</td></tr>`).join('');
    return `
        <div class="preview-panel" role="dialog" aria-label="Comparaison avec l'équipé">
            <h4>${escapeHtml(obj.name)} <em>contre</em> ${current ? escapeHtml(current.name) : 'aucune pièce équipée'}</h4>
            <table class="compare-table"><thead><tr><th></th><th>Actuel</th><th>Avec ${escapeHtml(obj.name)}</th><th></th></tr></thead><tbody>${rows}</tbody></table>
            <button type="button" class="primary" data-preview-close>Fermer</button>
        </div>`;
}

// Popup « vous vouliez vendre » : excédents tagués (bouton pièce de l'onglet Objets), un confirmer/annuler par ligne.
function surplusPopup(pending) {
    const rows = surplusEntries(player).filter(e => pending.includes(e.id));
    if (!rows.length) return '';
    return `
        <div class="surplus-popup" role="dialog" aria-label="Vente de l'excédent">
            <h4>Vous vouliez vendre :</h4>
            ${rows.map(e => `
                <div class="surplus-row">
                    <span class="surplus-name">${escapeHtml(e.obj.name)} x ${e.qty} <em>(+${e.price * e.qty} ${svgIcon('coin')})</em></span>
                    <button type="button" class="weapon-action" data-surplus-ok="${escapeHtml(e.id)}">Confirmer</button>
                    <button type="button" class="item-discard-btn" data-surplus-no="${escapeHtml(e.id)}">Annuler</button>
                </div>`).join('')}
            <button type="button" class="primary" data-surplus-all>Tout confirmer</button>
        </div>`;
}

/**
 * Remplit `card` avec la boutique du marchand `npc` (fiche de PNJ) et gère les achats.
 * hooks : { close(), ngPlus? }
 */
export function renderMerchant(npc, card, hooks = {}) {
    let mode = 'buy';
    let previewKey = null;
    let pending = gameState.combatState === 'active' ? [] : surplusEntries(player).map(e => e.id);
    const drawSell = (note = '') => {
        const entries = sellableEntries(player);
        card.innerHTML = `
            <h3>${svgIcon('coin')} ${escapeHtml(npc.name)}</h3>
            <div class="carnet-tabs"><button type="button" class="carnet-tab" data-mode="buy">Acheter</button><button type="button" class="carnet-tab on" data-mode="sell">Vendre</button></div>
            <p class="shop-subtitle">Le matériel activé reste dans votre sac.</p>
            <div class="shop-gold-display">${svgIcon('coin')} Or disponible : <strong>${player.gold || 0}</strong></div>
            ${note ? `<p class="merchant-note">${escapeHtml(note)}</p>` : ''}
            ${surplusPopup(pending)}
            ${entries.length ? entries.map(sellRow).join('') : '<p class="shop-empty">Vous n\'avez rien à vendre.</p>'}
            <button type="button" class="primary merchant-close">Fermer</button>`;
        bindCardTips(card);
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
            ${surplusPopup(pending)}
            ${previewPanel(offers.find(o => o.key === previewKey))}
            ${sections || '<p class="shop-empty">Le marchand a tout vendu.</p>'}
            <button type="button" class="primary merchant-close">Fermer</button>`;
        bindCardTips(card);
    };
    card.onclick = ev => {
        if (ev.target.closest('.merchant-close')) { hooks.close?.(); return; }
        const prev = ev.target.closest('[data-preview]');
        if (prev) { previewKey = prev.dataset.preview; draw(); return; }
        if (ev.target.closest('[data-preview-close]')) { previewKey = null; draw(); return; }
        const refresh = () => {
            updateAvailableWeapons();
            createWeaponButton?.();
            updateInventoryTab?.();
            updateItemButton?.();
            saveUpdate();
        };
        const settle = id => {
            const res = sellSurplus(player, id);
            pending = pending.filter(p => p !== id);
            if (res.ok) log(res.message);
            return res;
        };
        const okBtn = ev.target.closest('[data-surplus-ok]');
        if (okBtn) { const res = settle(okBtn.dataset.surplusOk); refresh(); draw(res.message); return; }
        const noBtn = ev.target.closest('[data-surplus-no]');
        if (noBtn) {
            const id = noBtn.dataset.surplusNo;
            pending = pending.filter(p => p !== id);
            player.sellTags = (player.sellTags || []).filter(t => t !== id);
            refresh();
            draw();
            return;
        }
        if (ev.target.closest('[data-surplus-all]')) {
            const results = [...pending].map(settle).filter(r => r.ok);
            refresh();
            draw(results.length ? `${results.reduce((n, r) => n + r.gain, 0)} pièces d'or gagnées.` : '');
            return;
        }
        const modeBtn = ev.target.closest('[data-mode]');
        if (modeBtn) { mode = modeBtn.dataset.mode; draw(); return; }
        const sellBtn = ev.target.closest('[data-sell]');
        if (sellBtn) {
            if (gameState.combatState === 'active') { draw('La boutique est inaccessible pendant le combat !'); return; }
            const res = sellEntry(player, sellBtn.dataset.sell);
            if (res.ok) {
                updateAvailableWeapons();
                document.dispatchEvent(new Event('stuff-changed'));
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
            if (res.offer.kind === 'stuff') document.dispatchEvent(new Event('stuff-changed'));
            saveUpdate();
            log(res.message);
        }
        draw(res.message);
    };
    draw();
}
