// Onglet « Stuff » : casque, collier, bracelet et bague (stuff.js). Affichage et actions du joueur ; la logique est dans stuff.js.

import { player, gameState, log, saveUpdate, updateStats } from './game.js';
import { getRarityColor, relicSlots, wornRelics, equipRelic, unequipRelic } from './items.js';
import { MAX_LEVEL } from './experience.js';
import { compareButtonHtml, gearDeltasHtml } from './compareView.js';
import { rowCardHtml, emptyRowHtml, badgeHtml, cardTipHtml, escapeHtml as esc, shortText } from './gameCardUi.js';
import { bindCardTips } from './gameTooltips.js';
import {
    STUFF_SLOTS, STUFF_SLOT_LABELS, BIOME_PROTECTION_TEXT, BIOME_PROTECTION_LABEL,
    getStuffById, describeStuff, powerLines, equipStuff, unequipStuff, stuffTotals, normalizeStuff, relicsOf
} from './stuff.js';

const escapeHtml = esc;

const RARITY_LABEL = { common: 'Commun', uncommon: 'Peu commun', rare: 'Rare', legendary: 'Ultra rare' };

// Infobulle (appui long / survol) : emplacement, rareté, bonus complets, protection de biome, description.
const stuffTip = stuff => cardTipHtml(escapeHtml(stuff.name), [
    `${escapeHtml(STUFF_SLOT_LABELS[stuff.slot])} • ${escapeHtml(RARITY_LABEL[stuff.rarity] || '')} • Niv. ${stuff.minLevel}`,
    escapeHtml(describeStuff(stuff)),
    stuff.biomeProtect ? `Au combat dans ce biome, ${escapeHtml(BIOME_PROTECTION_TEXT[stuff.biomeProtect])}.` : ''
], escapeHtml(stuff.description || ''));

// Pièce portée (liste « Porté », une ligne par emplacement) : nom et bonus, « Retirer » ; Comparer dans le menu « ⋯ ».
function wornRow(slot) {
    const stuff = getStuffById(player.stuff[slot]);
    if (!stuff) return emptyRowHtml(escapeHtml(STUFF_SLOT_LABELS[slot]), 'vide');
    const lockedInCombat = gameState.combatState === 'active';
    return rowCardHtml({
        key: `st:${stuff.id}:worn`, cls: 'rc-equipped', border: getRarityColor(stuff.rarity),
        name: escapeHtml(stuff.name),
        sub: `<span class="rc-chip">${escapeHtml(STUFF_SLOT_LABELS[slot])}</span><span class="rc-stats">${escapeHtml(describeStuff(stuff))}</span>`,
        primary: `<button type="button" class="rc-btn rc-btn-alt" data-unequip="${slot}" ${lockedInCombat ? 'disabled' : ''}>Retirer</button>`,
        more: compareButtonHtml('stuff', stuff.id), tip: stuffTip(stuff)
    });
}

// Ligne de la collection : nom, écarts avec la pièce portée au même emplacement (sinon ses bonus), « Équiper » ; Comparer dans « ⋯ ».
function pieceRow(stuff) {
    const locked = player.level < stuff.minLevel;
    const lockedInCombat = gameState.combatState === 'active';
    const worn = getStuffById(player.stuff[stuff.slot]);
    const deltas = gearDeltasHtml(stuff, worn);   // aussi pour une pièce verrouillée (pour savoir si elle vaudra le coup) ; emplacement vide : gain complet
    return rowCardHtml({
        key: `st:${stuff.id}`, cls: locked ? 'is-locked' : '', border: getRarityColor(stuff.rarity),
        name: escapeHtml(stuff.name),
        sub: deltas ? `<span class="card-deltas" title="Par rapport à la pièce portée (ou à un emplacement vide)">${deltas}</span>` : `<span class="rc-stats">${escapeHtml(describeStuff(stuff))}</span>`,
        primary: `<button type="button" class="rc-btn" data-equip="${stuff.id}" ${locked || lockedInCombat ? 'disabled' : ''}>${locked ? `Niv. ${stuff.minLevel}` : worn ? 'Remplacer' : 'Équiper'}</button>`,
        more: compareButtonHtml('stuff', stuff.id), tip: stuffTip(stuff)
    });
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
        totals.atk ? `Atk ${totals.atk > 0 ? '+' : ''}${totals.atk}` : '', totals.def ? `Déf ${totals.def > 0 ? '+' : ''}${totals.def}` : '',
        totals.maxHp ? `PV max +${totals.maxHp}` : '',
        totals.poisonResist ? (totals.poisonResist >= 100 ? 'Immunisé au poison' : `Poison −${totals.poisonResist} %`) : '',
        ...[...totals.biomes].map(b => `Protégé : ${BIOME_PROTECTION_LABEL[b]}`),
        ...powerLines(totals),
        totals.stealth ? 'Indétectable' : ''
    ].filter(Boolean).join(' • ');
    root.innerHTML = `
        <div class="stuff-summary">${summary ? `Bonus portés : ${escapeHtml(summary)}` : '<em>Aucun bonus porté.</em>'}</div>
        <h3>Porté</h3>${STUFF_SLOTS.map(wornRow).join('')}
        <h3>Collection${spare.length ? ` (${spare.length})` : ''}</h3>${spare.length ? spare.map((s, i) => (i === 0 || spare[i - 1].slot !== s.slot ? `<div class="rc-group">${escapeHtml(STUFF_SLOT_LABELS[s.slot])}</div>` : '') + pieceRow(s)).join('') : '<p class="shop-empty">Rien d\'autre. Achetez-en chez les marchands, trouvez-en dans les coffres ou en butin, ou gagnez un collier de biome en finissant sa quête.</p>'}${relicsHtml()}`;
    bindCardTips(root);
}

// Reliques permanentes (type `artifact` : amulette, bague d'archer, sandales, couronne…) : elles n'ont pas d'emplacement, leur bonus s'applique
// dès qu'on les ramasse. Listées ici en lecture seule pour qu'un objet annoncé par un coffre se retrouve dans l'équipement ; la vente et le rebut restent dans l'onglet Objets.
function relicsHtml() {
    const relics = relicsOf(player);
    if (!relics.length) return '';
    const slots = relicSlots(player.level), worn = wornRelics(player);
    const lockedInCombat = gameState.combatState === 'active';
    const wornIds = new Set(worn.map(r => r.id));
    const rows = relics.map((r, index) => {
        const isWorn = !!r.applied;
        const dup = !isWorn && wornIds.has(r.id);
        const full = !isWorn && worn.length >= slots;
        const label = isWorn ? 'Retirer' : dup ? 'Déjà portée' : full ? 'Complet' : 'Porter';
        return rowCardHtml({
            key: `rel:${r.id || r.name}:${index}`, border: getRarityColor(r.rarity), name: escapeHtml(r.name), badges: badgeHtml(isWorn ? 'Portée' : 'Relique'),
            sub: `<span class="rc-short">${escapeHtml(shortText(r.description))}</span>`,
            primary: `<button type="button" class="rc-btn${isWorn ? ' rc-btn-alt' : ''}" data-relic="${index}" ${lockedInCombat || dup || full ? 'disabled' : ''}>${label}</button>`,
            tip: cardTipHtml(escapeHtml(r.name), [escapeHtml(RARITY_LABEL[r.rarity] || '')], escapeHtml(r.description || ''))
        });
    }).join('');
    return `<h3>Reliques portées ${worn.length} / ${slots}</h3><p class="shop-empty">Une seule relique par type ; un emplacement de plus à chaque palier de niveau (10 au niveau ${MAX_LEVEL}).</p>${rows}`;
}

// Onglet « Spéciaux » : objets de quête rangés dans exploration.questItems (jamais dans le sac, donc invendables).
export function renderSpecialTab() {
    const root = document.getElementById('special-content');
    if (!root) return;
    const special = Array.isArray(player.exploration?.questItems) ? player.exploration.questItems : [];
    root.innerHTML = special.length
        ? special.map((i, n) => rowCardHtml({
            key: `sp:${n}:${i.name}`, name: escapeHtml(i.name), badges: badgeHtml('Quête'),
            sub: `<span class="rc-short">${escapeHtml(shortText(i.description, 60))}</span>`,
            tip: cardTipHtml(escapeHtml(i.name), [], escapeHtml(i.description || ''))
        })).join('')
        : '<p class="shop-empty">Aucun objet spécial pour le moment.</p>';
    bindCardTips(root);
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
    const relic = ev.target.closest('[data-relic]');
    if (relic) {
        if (gameState.combatState === 'active') return;
        const item = relicsOf(player)[Number(relic.dataset.relic)];
        if (item) afterChange((item.applied ? unequipRelic(player, item) : equipRelic(player, item)).message);
        return;
    }
    const off = ev.target.closest('[data-unequip]');
    if (off) { if (gameState.combatState !== 'active') afterChange(unequipStuff(player, off.dataset.unequip).message); return; }
}

function init() {
    document.getElementById('stuff-content')?.addEventListener('click', onClick);
    document.addEventListener('stuff-changed', renderStuffTab);
    document.addEventListener('special-tab-open', renderSpecialTab);
    renderSpecialTab();
    renderStuffTab();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
