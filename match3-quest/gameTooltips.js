// Infobulles du combat (sorts, armes, objets, équipement du joueur, ennemi) et pastilles de statut.
// Extrait de game.js pour alléger ce fichier ; game.js ré-exporte ce qui était public.
import { escapeHtml } from "./escapeHtml.js";
import { BIOME_LABELS } from "./weapons.js";
import { STUFF_SLOT_LABELS, getStuffById, normalizeStuff } from "./stuff.js";
import { enemyStuffPieces } from "./enemyStuff.js";
import { describeStuff } from "./stuff.js";
import { elementName } from "./elements.js";
import { isWeaknessShown } from "./combatFlow.js";
import { describeRecharge } from "./items.js";
import { icon as svgIcon, manaIcon } from "./icons.js";
import { activeStatuses, statusTooltipHtml, statusLinesHtml } from "./statusBadges.js";
import { MANA_COLOR_ORDER, MANA_COLOR_META, player, enemy, updateStats } from "./game.js";
import { shieldStats } from "./gameInventoryTabs.js";

// Infobulle d'un sort / d'une arme / d'un objet : au survol à la souris, au focus clavier, ou par appui long au doigt
// (un appui bref sert à utiliser l'élément et ne doit pas afficher l'infobulle).
export const TOOLTIP_LONG_PRESS_MS = 400;
// Pastilles de bonus/malus : survol ou appui long = explication de l'effet.
export function bindStatusBadges(container, entity) {
    const list = activeStatuses(entity);
    container.querySelectorAll('.status-badge').forEach(el => {
        const status = list.find(x => x.id === el.dataset.status);
        if(!status) return;
        el.removeAttribute('title');
        bindTooltip(el, () => {
            const tooltip = ensureSpellTooltip();
            tooltip.innerHTML = statusTooltipHtml(status);
            tooltip.classList.add('visible');
            placeTooltip(tooltip, el, 260);
        }, hideSpellTooltip);
    });
}

export function bindTooltip(el, show, hide) {
    let timer = null;
    let shownByPress = false;
    const cancel = () => { clearTimeout(timer); timer = null; };
    el.addEventListener('pointerenter', e => { if(e.pointerType === 'mouse') show(); });
    el.addEventListener('pointerleave', e => { cancel(); if(e.pointerType === 'mouse') hide(); });
    el.addEventListener('pointerdown', e => {
        if(e.pointerType === 'mouse') return;
        cancel();
        timer = setTimeout(() => { timer = null; shownByPress = true; show(); }, TOOLTIP_LONG_PRESS_MS);
    });
    // Relâcher un appui long ne doit pas utiliser l'élément : on avale le clic qui suit.
    el.addEventListener('click', e => {
        if(!shownByPress) return;
        shownByPress = false;
        e.preventDefault();
        e.stopImmediatePropagation();
    }, true);
    ['pointerup', 'pointercancel'].forEach(type => el.addEventListener(type, () => { cancel(); hide(); }));
    el.addEventListener('focus', () => { if(el.matches?.(':focus-visible')) show(); });
    el.addEventListener('blur', () => { cancel(); hide(); });
}

// Infobulle des cartes compactes (gameCardUi.js : rowCardHtml) : le contenu est lu dans l'élément .rc-tip de la carte,
// affiché au survol (souris), à l'appui long (tactile) ou au focus clavier.
export function bindCardTips(root) {
    root?.querySelectorAll?.('.rc[data-rc]').forEach(card => {
        const tip = card.querySelector('.rc-tip');
        if(!tip) return;
        bindTooltip(card, () => {
            const tooltip = ensureSpellTooltip();
            tooltip.innerHTML = tip.innerHTML;
            tooltip.classList.add('visible');
            placeTooltip(tooltip, card, 260);
        }, hideSpellTooltip);
    });
}

export function getSpellTooltipHtml(spell) {
    let effectText = 'Aucun effet';
    if(spell.effect) {
        effectText = spell.description || 'Effet spécial';
    } else if(spell.dmg && spell.heal) {
        effectText = `Inflige ${spell.dmg} ${svgIcon('skull')} et soigne ${spell.heal} ${svgIcon('heart')}`;
    } else if(spell.dmg) {
        effectText = `Inflige ${spell.dmg} ${svgIcon('skull')}`;
    } else if(spell.heal) {
        effectText = `Soigne ${spell.heal} ${svgIcon('heart')}`;
    }

    return `<div class="spell-tooltip-line">${effectText}</div>`;
}

function getWeaponTooltipHtml(weapon) {
    let html = `<div class="spell-tooltip-title">${weapon.name}</div>`;
    html += `<div class="spell-tooltip-line">${weapon.damage} ${svgIcon('skull')} • ${weapon.actionPoints} ${svgIcon('arrow')}</div>`;
    if(weapon.description) html += `<div class="spell-tooltip-line">${weapon.description}</div>`;
    if(weapon.biome) html += `<div class="spell-tooltip-line">Bonus de dégâts en ${BIOME_LABELS[weapon.biome]}${enemy?.biome === weapon.biome ? ' (actif)' : ''}</div>`;
    return html;
}

export function showWeaponTooltip(button, weapon) {
    if(!button || !weapon) return;
    const tooltip = ensureSpellTooltip();
    tooltip.innerHTML = getWeaponTooltipHtml(weapon);
    tooltip.classList.add('visible');
    placeTooltip(tooltip, button, 260);
}

function getItemTooltipHtml(item, options = {}) {
    if(!item) return '<div class="spell-tooltip-line">Objet inconnu</div>';

    const isEnemyItem = options.isEnemyItem === true;
    const ownerLabel = isEnemyItem ? 'ennemi' : 'allié';
    const typeLabel = item.type === 'artifact'
        ? 'Relique passive'
        : (item.type === 'consumable' ? 'Consommable' : item.type === 'reusable' ? 'Objet rechargeable' : 'Objet');
    const actionPoints = (item.type === 'consumable' || item.type === 'reusable') ? (item.actionPoints || 2) : null;

    let html = `<div class="spell-tooltip-title">${item.name || 'Objet'}</div>`;
    html += `<div class="spell-tooltip-line">Objet ${ownerLabel}</div>`;
    html += `<div class="spell-tooltip-line">Type: ${typeLabel}</div>`;
    if(actionPoints !== null) {
        html += `<div class="spell-tooltip-line">Coût: ${actionPoints} PA</div>`;
    }
    if(item.description) {
        html += `<div class="spell-tooltip-line">${item.description}</div>`;
    }
    if(item.type === 'reusable') {
        html += `<div class="spell-tooltip-line">Charges: ${item.chargesLeft ?? item.chargesPerCycle}/${item.chargesPerCycle} • ${describeRecharge(item)}</div>`;
    }
    return html;
}

export function ensureSpellTooltip() {
    let tooltip = document.getElementById('spell-detail-tooltip');
    if(!tooltip){
        tooltip = document.createElement('div');
        tooltip.id = 'spell-detail-tooltip';
        tooltip.className = 'spell-detail-tooltip';
        document.body.appendChild(tooltip);
    }
    return tooltip;
}

// Place une infobulle au-dessus de l'élément maintenu, à bonne distance : le pouce (ou le doigt) qui appuie dessus ne doit pas
// cacher le contenu. Pas assez de place au-dessus : en dessous, plus bas encore pour dégager le pouce.
const TOOLTIP_GAP_ABOVE = 28;
const TOOLTIP_GAP_BELOW = 72;
export function placeTooltip(tooltip, targetEl, tooltipWidth) {
    const rect = targetEl.getBoundingClientRect();
    const margin = 10;
    const height = tooltip.offsetHeight || 100;
    const left = Math.min(
        window.innerWidth - tooltipWidth - margin,
        Math.max(margin, rect.left + (rect.width / 2) - (tooltipWidth / 2))
    );
    let top = rect.top - height - TOOLTIP_GAP_ABOVE;
    if(top < margin) top = Math.min(window.innerHeight - height - margin, rect.bottom + TOOLTIP_GAP_BELOW);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${Math.max(margin, top)}px`;
}

export function showSpellTooltip(button, spell) {
    if(!button || !spell) return;
    const tooltip = ensureSpellTooltip();
    tooltip.innerHTML = getSpellTooltipHtml(spell);
    tooltip.classList.add('visible');

    placeTooltip(tooltip, button, 260);
}

// Équipement du joueur (arme, bouclier, stuff) : appui long sur sa carte en combat.
function getPlayerGearTooltipHtml() {
    const line = (label, text) => `<div class="spell-tooltip-line"><strong>${label} :</strong> ${text}</div>`;
    const weapon = player.equippedWeapon;
    const shield = player.equipment?.leftHand?.type === 'shield' ? player.equipment.leftHand : null;
    let html = `<div class="spell-tooltip-title">${escapeHtml(player.name || 'Hou Yi')}</div>`;
    html += line('Arme', weapon ? `${weapon.name} (${weapon.damage} ${svgIcon('skull')})` : 'aucune');
    html += line('Bouclier', shield ? `${shield.name} (${shieldStats(shield)})` : 'aucun');
    normalizeStuff(player);
    Object.entries(STUFF_SLOT_LABELS).forEach(([slot, label]) => {
        const piece = getStuffById(player.stuff[slot]);
        html += line(label, piece ? piece.name : '—');
    });
    return html + statusLinesHtml(player);
}

export function showPlayerGearTooltip(targetEl) {
    if(!targetEl) return;
    const tooltip = ensureSpellTooltip();
    tooltip.innerHTML = getPlayerGearTooltipHtml();
    tooltip.classList.add('visible');
    placeTooltip(tooltip, targetEl, 260);
}

export function showItemTooltip(button, item, options = {}) {
    if(!button || !item) return;
    const tooltip = ensureSpellTooltip();
    tooltip.innerHTML = getItemTooltipHtml(item, options);
    tooltip.classList.add('visible');

    placeTooltip(tooltip, button, 260);
}

export function hideSpellTooltip() {
    const tooltip = document.getElementById('spell-detail-tooltip');
    if(tooltip){
        tooltip.classList.remove('visible');
    }
}

function ensureEnemyNameTooltip() {
    let tooltip = document.getElementById('enemy-name-tooltip');
    if(!tooltip){
        tooltip = document.createElement('div');
        tooltip.id = 'enemy-name-tooltip';
        tooltip.className = 'enemy-name-tooltip';
        document.body.appendChild(tooltip);
    }
    return tooltip;
}

function getEnemyResistanceInsights(enemyEntity) {
    const resistances = enemyEntity?.resistances || {};
    const entries = MANA_COLOR_ORDER
        .filter(color => Number.isFinite(Number(resistances[color])))
        .map(color => ({
            color,
            value: Math.max(0, Number(resistances[color]))
        }));

    if(entries.length === 0) {
        return { weakest: null, strongest: null };
    }

    const sorted = [...entries].sort((a, b) => a.value - b.value);
    return {
        weakest: sorted[0] || null,
        strongest: sorted[sorted.length - 1] || null
    };
}

// Infobulle de l'ennemi : sa force est toujours indiquée ; sa faiblesse (couleur + élément) seulement une fois repérée
// (avantage « Faiblesse repérée » du terrain, prep.weaknessRevealed).
function getEnemyNameTooltipHtml(fullName, enemyEntity, { showAll = false } = {}) {
    const { weakest, strongest } = getEnemyResistanceInsights(enemyEntity);
    const lines = [`<div class="enemy-tooltip-title">${fullName}</div>`];

    if(strongest) {
        const strongMeta = MANA_COLOR_META[strongest.color];
        const strongPercent = Math.round(strongest.value * 100);
        lines.push(`<div class="enemy-tooltip-row enemy-tooltip-strong">Force : ${manaIcon(strongest.color)} ${strongMeta.name} (${strongPercent}% res.)</div>`);
    }

    if(showAll || isWeaknessShown(enemyEntity?.prep)) {
        const weakColor = enemyEntity.weakColor || weakest?.color;
        if(weakColor && MANA_COLOR_META[weakColor]) {
            const element = elementName(weakColor);
            const resist = Number(enemyEntity.resistances?.[weakColor]);
            const percent = Number.isFinite(resist) ? ` (${Math.round(Math.max(0, resist) * 100)}% res.)` : '';
            lines.push(`<div class="enemy-tooltip-row enemy-tooltip-weak">Faiblesse : ${manaIcon(weakColor)} ${element ? `${element} - ` : ''}${MANA_COLOR_META[weakColor].name}${percent}</div>`);
        }
    }

    lines.push(statusLinesHtml(enemyEntity));
    return lines.join('');
}

// Un clic / toucher sur la carte ou le portrait de l'ennemi affiche son infobulle (faiblesse incluse si elle est repérée),
// qui se referme seule après quelques secondes. Lié une seule fois : le panneau est reconstruit à chaque updateStats.
export const ENEMY_TAP_TOOLTIP_MS = 3500;
let enemyTapTimer = null;
let playerTapTimer = null;
// Affiche l'équipement du joueur quelques secondes après un clic / toucher sur sa carte.
export function showPlayerGearTooltipBriefly(targetEl){
    showPlayerGearTooltip(targetEl);
    clearTimeout(playerTapTimer);
    playerTapTimer = setTimeout(hideSpellTooltip, ENEMY_TAP_TOOLTIP_MS);
}
export function bindEnemyCardTap(enemyDiv){
    if(!enemyDiv || enemyDiv.dataset.tapBound) return;
    enemyDiv.dataset.tapBound = '1';
    enemyDiv.addEventListener('click', () => {
        const nameEl = enemyDiv.querySelector('.enemy-combat-name');
        if(!nameEl) return;
        showEnemyNameTooltip(nameEl, nameEl.dataset.fullName || enemy.name, enemy);
        clearTimeout(enemyTapTimer);
        enemyTapTimer = setTimeout(hideEnemyNameTooltip, ENEMY_TAP_TOOLTIP_MS);
    });
}

export function showEnemyNameTooltip(targetEl, fullName, enemyEntity = enemy) {
    if(!targetEl || !fullName) return;
    const tooltip = ensureEnemyNameTooltip();
    tooltip.innerHTML = getEnemyNameTooltipHtml(fullName, enemyEntity);
    tooltip.classList.add('visible');

    placeTooltip(tooltip, targetEl, 250);
}

// Appui long sur le nom de l'ennemi : force, faiblesse et stuff (une ligne par emplacement, avec les effets de la pièce).
const STUFF_RARITY_LABEL = { common: 'Commun', uncommon: 'Peu commun', rare: 'Rare', legendary: 'Ultra rare' };
export function getEnemyStuffTooltipHtml(fullName, enemyEntity) {
    // Appui long : force, faiblesse (toujours montrée) et stuff réunis.
    const lines = [getEnemyNameTooltipHtml(escapeHtml(fullName), enemyEntity, { showAll: true })];
    const pieces = enemyStuffPieces(enemyEntity);
    if(!pieces.length) {
        lines.push('<div class="enemy-tooltip-row">Aucun stuff équipé.</div>');
    } else {
        lines.push('<div class="enemy-tooltip-row"><strong>Stuff équipé</strong></div>');
        pieces.forEach(s => lines.push(`<div class="enemy-tooltip-row">${STUFF_SLOT_LABELS[s.slot]} : <strong>${escapeHtml(s.name)}</strong> (${STUFF_RARITY_LABEL[s.rarity] || ''}, niv. ${s.minLevel})<br><small>${escapeHtml(describeStuff(s))}</small></div>`));
    }
    return lines.join('');
}

export function showEnemyStuffTooltip(targetEl, fullName, enemyEntity = enemy) {
    if(!targetEl) return;
    const tooltip = ensureEnemyNameTooltip();
    tooltip.innerHTML = getEnemyStuffTooltipHtml(fullName || enemyEntity.name, enemyEntity);
    tooltip.classList.add('visible');
    placeTooltip(tooltip, targetEl, 280);
}

// Appui long (souris ou doigt) sur le nom de l'ennemi : affiche son stuff, qui reste quelques secondes après le relâchement.
export const ENEMY_STUFF_LONG_PRESS_MS = 500;
export function bindEnemyStuffLongPress(nameEl, fullName, enemyEntity = enemy) {
    if(!nameEl) return;
    let timer = null;
    let shown = false;
    const cancel = () => { clearTimeout(timer); timer = null; };
    nameEl.addEventListener('pointerdown', () => {
        cancel();
        shown = false;
        delete nameEl.dataset.stuffShown;
        timer = setTimeout(() => {
            timer = null; shown = true;
            nameEl.dataset.stuffShown = '1';
            showEnemyStuffTooltip(nameEl, fullName, enemyEntity);
            clearTimeout(enemyTapTimer);
            enemyTapTimer = setTimeout(() => { delete nameEl.dataset.stuffShown; hideEnemyNameTooltip(); }, ENEMY_TAP_TOOLTIP_MS + 1500);
        }, ENEMY_STUFF_LONG_PRESS_MS);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => nameEl.addEventListener(t, cancel));
    // Le clic qui suit un appui long ne doit ni basculer le nom (kanji) ni remplacer l'infobulle.
    nameEl.addEventListener('click', e => { if(!shown) return; shown = false; e.stopImmediatePropagation(); e.preventDefault(); }, true);
}

export function hideEnemyNameTooltip() {
    const tooltip = document.getElementById('enemy-name-tooltip');
    if(tooltip){
        tooltip.classList.remove('visible');
    }
}

// Cartes des onglets Armes / Sorts : nom, caractéristiques, description, puis pied « Comparer » + actions.
