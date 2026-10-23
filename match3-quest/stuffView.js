// Onglet « Stuff » : casque, collier, bracelet et bague (stuff.js). Affichage et actions du joueur ; la logique est dans stuff.js.

import { player, gameState, log, saveUpdate, updateStats } from './game.js';
import { getRarityColor } from './items.js';
import { compareButtonHtml, deltaBadgesHtml } from './compareView.js';
import {
    STUFF_SLOTS, STUFF_SLOT_LABELS, BIOME_PROTECTION_TEXT, BIOME_PROTECTION_LABEL,
    getStuffById, describeStuff, equipStuff, unequipStuff, stuffTotals, normalizeStuff
} from './stuff.js';

const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const RARITY_LABEL = { common: 'Commun', uncommon: 'Peu commun', rare: 'Rare', legendary: 'Ultra rare' };

const STUFF_DELTA_FIELDS = [['atkBonus', 'Atk'], ['defBonus', 'Déf'], ['maxHp', 'PV max'], ['poisonResist', '% poison']];

// Carte d'une pièce : action 'unequip' (portée) ou 'equip' (collection, « Remplacer » si l'emplacement est pris).
function pieceCard(stuff, action) {
    const locked = player.level < stuff.minLevel;
    const lockedInCombat = gameState.combatState === 'active';
    const worn = action === 'equip' ? getStuffById(player.stuff[stuff.slot]) : null;
    const button = action === 'unequip'
        ? `<button type="button" class="weapon-action" data-unequip="${stuff.slot}" ${lockedInCombat ? 'disabled' : ''}>Retirer</button>`
        : `<button type="button" class="weapon-action" data-equip="${stuff.id}" ${locked || lockedInCombat ? 'disabled' : ''}>${locked ? `Niv. ${stuff.minLevel} requis` : worn ? 'Remplacer' : 'Équiper'}</button>`;
    const deltas = locked ? '' : deltaBadgesHtml(stuff, worn, STUFF_DELTA_FIELDS);
    return `
        <div class="weapon-item gear-card stuff-item${action === 'unequip' ? ' equipped-weapon' : ''}${locked && action === 'equip' ? ' is-locked' : ''}" style="border-left:6px solid ${getRarityColor(stuff.rarity)}">
            <div class="weapon-details">
                <span class="weapon-name">${escapeHtml(stuff.name)} <em class="merchant-rarity" style="color:${getRarityColor(stuff.rarity)}">${RARITY_LABEL[stuff.rarity] || ''}</em></span>
                <span class="weapon-stats">${action === 'unequip' ? `${STUFF_SLOT_LABELS[stuff.slot]} • ` : ''}${escapeHtml(describeStuff(stuff))} • Niv. ${stuff.minLevel}</span>
                ${deltas ? `<span class="card-deltas" title="Par rapport à la pièce portée">${deltas}</span>` : ''}
                <span class="weapon-description">${escapeHtml(stuff.description)}${stuff.biomeProtect ? ` <strong>Au combat dans ce biome, ${escapeHtml(BIOME_PROTECTION_TEXT[stuff.biomeProtect])}.</strong>` : ''}</span>
            </div>
            <div class="card-actions">${compareButtonHtml('stuff', stuff.id)}<span class="card-actions-main">${button}</span></div>
        </div>`;
}

// Collection rangée par emplacement : pièces utilisables d'abord (niveau croissant), puis celles de niveau trop élevé.
const byUsableThenLevel = (a, b) => (player.level < a.minLevel) - (player.level < b.minLevel) || a.minLevel - b.minLevel || a.name.localeCompare(b.name, 'fr');

export function renderStuffTab() {
    const root = document.getElementById('stuff-content');
    if (!root) return;
    normalizeStuff(player);
    const totals = stuffTotals(player);
    const worn = STUFF_SLOTS.map(slot => {
        const s = getStuffById(player.stuff[slot]);
        return s
            ? pieceCard(s, 'unequip')
            : `<div class="weapon-item gear-card stuff-item slot-empty"><div class="weapon-details"><span class="weapon-name">${STUFF_SLOT_LABELS[slot]}</span><span class="weapon-description">Emplacement vide</span></div></div>`;
    }).join('');
    const spare = player.stuffOwned.map(getStuffById).filter(s => s && player.stuff[s.slot] !== s.id);
    const collection = STUFF_SLOTS.map(slot => {
        const pieces = spare.filter(s => s.slot === slot).sort(byUsableThenLevel);
        return pieces.length ? `<h4 class="stuff-slot-title">${STUFF_SLOT_LABELS[slot]} (${pieces.length})</h4>${pieces.map(s => pieceCard(s, 'equip')).join('')}` : '';
    }).join('');
    const summary = [
        totals.atk ? `Atk +${totals.atk}` : '', totals.def ? `Déf +${totals.def}` : '',
        totals.maxHp ? `PV max +${totals.maxHp}` : '',
        totals.poisonResist ? (totals.poisonResist >= 100 ? 'Immunisé au poison' : `Poison −${totals.poisonResist} %`) : '',
        ...[...totals.biomes].map(b => `Protégé : ${BIOME_PROTECTION_LABEL[b]}`)
    ].filter(Boolean).join(' • ');
    root.innerHTML = `
        <div class="stuff-summary">${summary ? `Bonus portés : ${escapeHtml(summary)}` : '<em>Aucun bonus : équipez un casque, un collier, un bracelet ou une bague.</em>'}</div>
        <h3>Porté</h3>${worn}
        <h3>Collection</h3>${collection || '<p class="shop-empty">Rien d\'autre. Achetez-en chez les marchands, trouvez-en dans les coffres ou en butin, ou gagnez un collier de biome en finissant sa quête.</p>'}`;
}

// Onglet « Spéciaux » : objets de quête rangés dans exploration.questItems (jamais dans le sac, donc invendables).
export function renderSpecialTab() {
    const root = document.getElementById('special-content');
    if (!root) return;
    const special = Array.isArray(player.exploration?.questItems) ? player.exploration.questItems : [];
    root.innerHTML = special.length
        ? special.map(i => `<div class="weapon-item stuff-item special-item"><div class="weapon-details"><span class="weapon-name">${escapeHtml(i.name)} <em class="merchant-rarity">Quête</em></span><span class="weapon-description">${escapeHtml(i.description || '')}</span></div></div>`).join('')
        : '<p class="shop-empty">Aucun objet spécial pour le moment.</p>';
}

function afterChange(message) {
    if (message) log(message);
    updateStats();
    saveUpdate();
    renderStuffTab();
}

function onClick(ev) {
    if (gameState.combatState === 'active') return;
    const equip = ev.target.closest('[data-equip]');
    if (equip) { afterChange(equipStuff(player, equip.dataset.equip).message); return; }
    const off = ev.target.closest('[data-unequip]');
    if (off) afterChange(unequipStuff(player, off.dataset.unequip).message);
}

function init() {
    document.getElementById('stuff-content')?.addEventListener('click', onClick);
    document.addEventListener('stuff-changed', renderStuffTab);
    document.addEventListener('special-tab-open', renderSpecialTab);
    renderSpecialTab();
    renderStuffTab();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
