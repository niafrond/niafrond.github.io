// =====================================
// Marchands (PNJ des villages, voir merchants.js)
// =====================================

import { getRarityIcon, getRarityColor } from './items.js';
import { icon as svgIcon } from './icons.js';
import { describeStuff, STUFF_SLOT_LABELS } from './stuff.js';
import { offerObject, availableOffers, buyOffer, sellableEntries, sellEntry, surplusEntries, sellSurplus } from './merchants.js';
import { describeManaMax } from './manaGear.js';
import { BIOME_LABELS } from './weapons.js';
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

// Caractéristiques d'une pièce, toutes visibles sur la carte de boutique (on achète sur ces chiffres) : [{ label, value }].
const level = n => `<span class="rc-attr">Niv. <b>${n}</b></span>`;
const attr = (label, value) => `<span class="rc-attr"><b>${value}</b> ${label}</span>`;
function attributesOf(kind, obj) {
    const out = [];
    if (kind === 'torch') return [`<span class="rc-attr">Vue élargie sous terre</span>`];
    if (kind === 'mount') return [attr('de vitesse', `×${obj.speed}`)];
    if (kind === 'weapon') {
        out.push(attr('dégâts', `${obj.damage} ${svgIcon('skull')}`), attr('PA', `${obj.actionPoints} ${svgIcon('arrow')}`));
        if (obj.twoHanded) out.push('<span class="rc-attr"><b>Deux mains</b></span>');
        if (obj.atkBonus) out.push(attr('Atk', `+${obj.atkBonus}`));
        if (obj.defBonus) out.push(attr('Déf', `+${obj.defBonus}`));
        if (obj.biome) out.push(`<span class="rc-attr">Bonus : <b>${escapeHtml(BIOME_LABELS[obj.biome] || obj.biome)}</b></span>`);
    } else if (kind === 'stuff') {
        out.push(`<span class="rc-attr"><b>${escapeHtml(STUFF_SLOT_LABELS[obj.slot])}</b></span>`);
        describeStuff(obj).split(' • ').filter(Boolean).forEach(t => out.push(`<span class="rc-attr">${escapeHtml(t)}</span>`));
        return out.concat(level(obj.minLevel));
    } else if (obj.type === 'shield') {
        out.push(attr('Déf', `+${obj.defense}`));
        if (obj.atkBonus) out.push(attr('Atk', `+${obj.atkBonus}`));
        if (obj.absorbDamage) out.push(attr('absorbés', obj.absorbDamage));
    } else if (obj.type === 'reusable') {
        out.push(attr('PA', `${obj.actionPoints || 2} ${svgIcon('arrow')}`), attr(`charge${obj.chargesPerCycle > 1 ? 's' : ''}`, obj.chargesPerCycle));   // la recharge est dans l'effet décrit juste dessous
    } else {
        out.push('<span class="rc-attr"><b>Relique</b> permanente</span>');
    }
    const mana = describeManaMax(obj);
    if (mana) out.push(`<span class="rc-attr">${escapeHtml(mana)}</span>`);
    return out.concat(level(obj.minLevel || 1));
}

// Offre d'un marchand : carte aérée, car on achète sur les chiffres. Nom en entier, toutes les caractéristiques, l'effet des objets, puis
// les écarts avec ce que vous portez ; le prix est dans le bouton d'achat, « Comparer » dans le menu « ⋯ », le texte d'ambiance à l'appui long.
function shopCard(key, obj, kindOfOffer, rarity, { primary, extraMore = '', iconHtml, price }) {
    const special = kindOfOffer === 'mount' || kindOfOffer === 'torch';
    const kind = kindOfOffer === 'weapon' ? 'weapon' : kindOfOffer === 'stuff' ? 'stuff' : 'item';
    const deltas = special ? '' : equipDeltaGroupsHtml(player, kind, obj);
    const tooLow = !special && (obj.minLevel || 1) > player.level;
    // Les armes et pièces de stuff ont une description d'ambiance (à l'appui long) ; l'effet d'un objet, d'une relique ou d'une monture est affiché.
    const effect = kind === 'item' || special ? `<div class="rc-desc">${escapeHtml(obj.description || '')}</div>` : '';
    const attrs = attributesOf(special ? kindOfOffer : kind === 'item' ? 'item' : kind, obj);
    return rowCardHtml({
        key: `shop:${key}`, cls: `merchant-offer rc-roomy rarity-${rarity}`, border: getRarityColor(rarity),
        name: `${iconHtml} ${escapeHtml(obj.name)}`,
        badges: (rarity === 'rare' || rarity === 'legendary' ? badgeHtml(RARITY_LABEL[rarity]) : '') + (tooLow ? badgeHtml(`Niv. ${obj.minLevel}`, 'rc-badge-warn') : ''),
        sub: `<div class="rc-attrs">${attrs.join('')}</div>${effect}${deltas ? `<div class="rc-deltas-row">${deltas}</div>` : ''}`,
        primary, more: (special ? '' : compareButtonHtml(kind, obj.id)) + extraMore,
        tip: cardTipHtml(escapeHtml(obj.name), [`${RARITY_LABEL[rarity] || ''} • ${price} pièces d'or`], escapeHtml(obj.description || ''))
    });
}

function offerRow(offer, gold) {
    const obj = offerObject(offer);
    if (!obj) return '';
    const canAfford = gold >= offer.price;
    return shopCard(offer.key, obj, offer.kind, offer.rarity, {
        iconHtml: offer.kind === 'weapon' ? getWeaponIcon(obj.type) : getRarityIcon(offer.rarity), price: offer.price,
        primary: `<button type="button" class="rc-btn rc-buy" data-buy="${offer.key}" ${canAfford ? '' : 'disabled'} title="${canAfford ? 'Acheter' : 'Pas assez d\'or'}">${offer.price} ${svgIcon('coin')}</button>`,
        extraMore: isComparable(offer.kind, obj) ? `<button type="button" class="compare-btn" data-preview="${offer.key}" title="Voir l'effet sur vos stats par rapport à la pièce équipée">Comparer à l'équipé</button>` : ''
    });
}

function sellRow(entry) {
    const obj = entry.obj;
    return shopCard(`sell:${entry.key}`, obj, entry.kind, entry.rarity, {
        iconHtml: entry.kind === 'weapon' ? getWeaponIcon(obj.type) : getRarityIcon(entry.rarity), price: entry.price,
        primary: `<button type="button" class="rc-btn rc-buy" data-sell="${entry.key}" ${entry.locked ? 'disabled' : ''} title="${entry.locked ? escapeHtml(entry.locked) : 'Vendre'}">${entry.locked ? escapeHtml(entry.locked) : `+${entry.price} ${svgIcon('coin')}`}</button>`
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
