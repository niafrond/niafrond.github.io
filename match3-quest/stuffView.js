// Onglet « Stuff » : casque, collier, bracelet et bague (stuff.js). Affichage et actions du joueur ; la logique est dans stuff.js.

import { player, gameState, log, saveUpdate, updateStats } from './game.js';
import { getRarityColor } from './items.js';
import { compareButtonHtml, deltaBadgesHtml } from './compareView.js';
import {
    STUFF_SLOTS, STUFF_SLOT_LABELS, BIOME_PROTECTION_TEXT, BIOME_PROTECTION_LABEL,
    getStuffById, describeStuff, powerLines, equipStuff, unequipStuff, stuffTotals, normalizeStuff, relicsOf
} from './stuff.js';

const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const RARITY_LABEL = { common: 'Commun', uncommon: 'Peu commun', rare: 'Rare', legendary: 'Ultra rare' };

const STUFF_DELTA_FIELDS = [['atkBonus', 'Atk'], ['defBonus', 'Déf'], ['maxHp', 'PV max'], ['poisonResist', '% poison']];

const expanded = new Set();   // pièces dont la description est dépliée (un appui sur la carte la montre ou la cache)

const rarityTitle = stuff => escapeHtml(`${RARITY_LABEL[stuff.rarity] || ''} : touchez pour la description`);
const descriptionHtml = stuff => `<span class="weapon-description stuff-desc">${escapeHtml(stuff.description)}${stuff.biomeProtect ? ` <strong>Au combat dans ce biome, ${escapeHtml(BIOME_PROTECTION_TEXT[stuff.biomeProtect])}.</strong>` : ''}</span>`;

// Tuile d'un emplacement porté (grille 2 × 2) : emplacement, nom, bonus, « Retirer ».
function wornTile(slot) {
    const stuff = getStuffById(player.stuff[slot]);
    if (!stuff) return `<div class="stuff-tile slot-empty"><span class="stuff-slot">${STUFF_SLOT_LABELS[slot]}</span><span class="stuff-tile-empty">Vide</span></div>`;
    const lockedInCombat = gameState.combatState === 'active';
    return `
        <div class="stuff-tile stuff-item${expanded.has(stuff.id) ? ' expanded' : ''}" data-stuff="${stuff.id}" style="border-left-color:${getRarityColor(stuff.rarity)}" title="${rarityTitle(stuff)}">
            <span class="stuff-slot">${STUFF_SLOT_LABELS[slot]}</span>
            <span class="weapon-name">${escapeHtml(stuff.name)}</span>
            <span class="weapon-stats">${escapeHtml(describeStuff(stuff))}</span>
            ${descriptionHtml(stuff)}
            <span class="stuff-tile-actions">${compareButtonHtml('stuff', stuff.id)}<button type="button" class="weapon-action" data-unequip="${slot}" ${lockedInCombat ? 'disabled' : ''}>Retirer</button></span>
        </div>`;
}

// Ligne compacte de la collection : emplacement + bonus et écarts à gauche, action et « Comparer » à droite.
function pieceRow(stuff) {
    const locked = player.level < stuff.minLevel;
    const lockedInCombat = gameState.combatState === 'active';
    const worn = getStuffById(player.stuff[stuff.slot]);
    const deltas = locked ? '' : deltaBadgesHtml(stuff, worn, STUFF_DELTA_FIELDS);
    return `
        <div class="stuff-row stuff-item${locked ? ' is-locked' : ''}${expanded.has(stuff.id) ? ' expanded' : ''}" data-stuff="${stuff.id}" style="border-left-color:${getRarityColor(stuff.rarity)}" title="${rarityTitle(stuff)}">
            <div class="stuff-row-main">
                <span class="weapon-name">${escapeHtml(stuff.name)}</span>
                <span class="weapon-stats"><b>${STUFF_SLOT_LABELS[stuff.slot]}</b> • ${escapeHtml(describeStuff(stuff))}</span>
                ${deltas ? `<span class="card-deltas" title="Par rapport à la pièce portée">${deltas}</span>` : ''}
                ${descriptionHtml(stuff)}
            </div>
            <div class="stuff-row-actions">
                <button type="button" class="weapon-action" data-equip="${stuff.id}" ${locked || lockedInCombat ? 'disabled' : ''}>${locked ? `Niv. ${stuff.minLevel}` : worn ? 'Remplacer' : 'Équiper'}</button>
                ${compareButtonHtml('stuff', stuff.id)}
            </div>
        </div>`;
}

// Collection : par emplacement (casque, collier, bracelet, bague), pièces utilisables d'abord, puis par niveau.
const bySlotUsableLevel = (a, b) => STUFF_SLOTS.indexOf(a.slot) - STUFF_SLOTS.indexOf(b.slot)
    || (player.level < a.minLevel) - (player.level < b.minLevel) || a.minLevel - b.minLevel || a.name.localeCompare(b.name, 'fr');

export function renderStuffTab() {
    const root = document.getElementById('stuff-content');
    if (!root) return;
    normalizeStuff(player);
    const totals = stuffTotals(player);
    const spare = player.stuffOwned.map(getStuffById).filter(s => s && player.stuff[s.slot] !== s.id).sort(bySlotUsableLevel);
    const summary = [
        totals.atk ? `Atk +${totals.atk}` : '', totals.def ? `Déf +${totals.def}` : '',
        totals.maxHp ? `PV max +${totals.maxHp}` : '',
        totals.poisonResist ? (totals.poisonResist >= 100 ? 'Immunisé au poison' : `Poison −${totals.poisonResist} %`) : '',
        ...[...totals.biomes].map(b => `Protégé : ${BIOME_PROTECTION_LABEL[b]}`),
        ...powerLines(totals),
        totals.stealth ? 'Indétectable' : ''
    ].filter(Boolean).join(' • ');
    root.innerHTML = `
        <div class="stuff-summary">${summary ? `Bonus portés : ${escapeHtml(summary)}` : '<em>Aucun bonus porté.</em>'}</div>
        <h3>Porté</h3><div class="stuff-grid">${STUFF_SLOTS.map(wornTile).join('')}</div>
        <h3>Collection${spare.length ? ` (${spare.length})` : ''}</h3>${spare.length ? spare.map(pieceRow).join('') : '<p class="shop-empty">Rien d\'autre. Achetez-en chez les marchands, trouvez-en dans les coffres ou en butin, ou gagnez un collier de biome en finissant sa quête.</p>'}${relicsHtml()}`;
}

// Reliques permanentes (type `artifact` : amulette, bague d'archer, sandales, couronne…) : elles n'ont pas d'emplacement, leur bonus s'applique
// dès qu'on les ramasse. Listées ici en lecture seule pour qu'un objet annoncé par un coffre se retrouve dans l'équipement ; la vente et le rebut restent dans l'onglet Objets.
function relicsHtml() {
    const relics = relicsOf(player);
    if (!relics.length) return '';
    const rows = relics.map(r => `
        <div class="stuff-row" style="border-left-color:${getRarityColor(r.rarity)}" title="${escapeHtml(RARITY_LABEL[r.rarity] || '')}">
            <div class="stuff-row-main">
                <span class="weapon-name">${escapeHtml(r.name)}</span>
                <span class="weapon-stats"><b>Relique</b> • ${escapeHtml(r.description || '')}</span>
            </div>
        </div>`).join('');
    return `<h3>Reliques (${relics.length})</h3><p class="shop-empty">Permanentes, toujours actives : sans emplacement. Vente et rebut dans l'onglet Objets.</p>${rows}`;
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
    const equip = ev.target.closest('[data-equip]');
    if (equip) { if (gameState.combatState !== 'active') afterChange(equipStuff(player, equip.dataset.equip).message); return; }
    const off = ev.target.closest('[data-unequip]');
    if (off) { if (gameState.combatState !== 'active') afterChange(unequipStuff(player, off.dataset.unequip).message); return; }
    // Appui ailleurs sur une pièce (hors boutons) : déplie ou replie sa description.
    const card = ev.target.closest('[data-stuff]');
    if (card && !ev.target.closest('button')) {
        const id = card.dataset.stuff;
        if (!expanded.delete(id)) expanded.add(id);
        card.classList.toggle('expanded', expanded.has(id));
    }
}

function init() {
    document.getElementById('stuff-content')?.addEventListener('click', onClick);
    document.addEventListener('stuff-changed', renderStuffTab);
    document.addEventListener('special-tab-open', renderSpecialTab);
    renderSpecialTab();
    renderStuffTab();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
