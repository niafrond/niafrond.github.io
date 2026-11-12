// Niveau et attributs : XP gagnée (combo, gros alignements, mana), barre de niveau, menu des attributs, réinitialisation.
// Extrait de game.js.
import { bigMatchXpFor } from './matchMechanics.js';
import { icon as svgIcon, manaIcon } from './icons.js';
import { ATTRIBUTE_ORDER, describeAttributeChoice, respecAttributes, manaPerMatch } from './attributes.js';
import { MAX_LEVEL, getXPProgress, getXPToNextLevel } from './experience.js';
import { log, saveUpdate, updateStats } from './gameHud.js';
import { updatePlayerStatsTab } from './gameStatsTab.js';
import { clampManaToCaps, gameState, player, queueCombatXP } from './game.js';

export function grantComboMasteryRewards(xpAmount = 25){
    queueCombatXP(xpAmount);
    return xpAmount;
}

export function grantBigMatchXP(len){
    return queueCombatXP(bigMatchXpFor(len));
}

export function grantManaGeneratedXP(manaAmount){
    const safeMana = Math.max(0, Math.floor(manaAmount || 0));
    if(safeMana <= 0) return { xpGained: 0, leveledUp: false, levelsGained: 0 };

    queueCombatXP(safeMana);

    return {
        xpGained: safeMana,
        leveledUp: false,
        levelsGained: 0
    };
}

// HUD permanent : niveau, XP actuelle, XP du prochain niveau et progression.
export function updateLevelHud(){
    const hud = document.getElementById('level-hud');
    if(!hud) return;
    const max = player.level >= MAX_LEVEL;
    const pct = getXPProgress(player);
    hud.querySelector('.level-hud-level').textContent = `Niv. ${player.level}`;
    hud.querySelector('.level-hud-xp').textContent = max ? `${player.xp} XP (max)` : `${player.xp} / ${player.xpToNextLevel} XP`;
    hud.querySelector('.level-hud-bar i').style.width = `${pct}%`;
    hud.querySelector('.level-hud-pct').textContent = max ? '' : `${pct}%`;
    const pts = player.unspentLevelPoints || 0;
    hud.title = max ? 'Niveau maximum atteint' : `Niveau ${player.level} : ${getXPToNextLevel(player)} XP restants avant le niveau ${player.level + 1}`
        + (pts > 0 ? ` · ${pts} point(s) d'attribut à dépenser` : '');
    hud.classList.toggle('has-points', pts > 0);
}
if(typeof window !== 'undefined' && typeof setInterval === 'function'){
    setInterval(() => { if(!document.hidden) updateLevelHud(); }, 500);   // inutile (et coûteux sur vieil appareil) onglet masqué
}

function renderLevelUpHud(){
    const info = document.getElementById('levelup-progress');
    if(!info) return;
    const remaining = getXPToNextLevel(player);
    info.innerHTML = player.level >= MAX_LEVEL
        ? `Niveau ${player.level} (maximum) · ${player.xp} XP`
        : `Niveau ${player.level} · ${player.xp} / ${player.xpToNextLevel} XP · ${getXPProgress(player)} % vers le niveau ${player.level + 1} (${remaining} XP restants)`;
}

function buildAttributeCards(){
    const grid = document.getElementById('levelup-attributes');
    if(!grid) return;
    grid.innerHTML = ATTRIBUTE_ORDER.map(attr => {
        const d = describeAttributeChoice(player, attr);
        return `<div class="attribute-card attr-${d.color}" data-attr="${attr}" role="button" tabindex="0">
            <div class="attr-icon">${svgIcon(d.icon)}</div>
            <div class="attr-name">${d.name} <span class="attr-points">(${d.points} → ${d.nextPoints})</span></div>
            <div class="attr-description"><ul>${d.lines.map((l, i) => `<li>${i === 1 ? manaIcon(d.color) + ' ' : ''}${l}</li>`).join('')}</ul></div>
        </div>`;
    }).join('');
}

export function showAttributeMenu(){
    if((player.unspentLevelPoints || 0) <= 0) return;

    // Afficher la modale de montée de niveau
    const modal = document.getElementById('levelup-modal');
    const newLevelSpan = document.getElementById('new-level');
    const subtitle = modal ? modal.querySelector('.levelup-subtitle') : null;
    
    if(!modal || !newLevelSpan) {
        console.error('Modale de montée de niveau introuvable');
        return;
    }
    
    newLevelSpan.textContent = player.level;
    if(subtitle) {
        const remainingPoints = player.unspentLevelPoints || 0;
        subtitle.textContent = remainingPoints > 1
            ? `Choisissez un attribut à améliorer (${remainingPoints} points restants). Chaque point améliore une statistique ET la couleur de qì associée.`
            : 'Choisissez un attribut à améliorer. Chaque point améliore une statistique ET la couleur de qì associée.';
    }
    renderLevelUpHud();
    buildAttributeCards();
    modal.style.display = 'flex';

    modal.querySelectorAll('.attribute-card').forEach(card => {
        const choose = () => {
            const attr = card.dataset.attr;
            if(!attr) return;
            selectAttribute(attr);
            if((player.unspentLevelPoints || 0) <= 0) {
                modal.style.display = 'none';
            } else {
                showAttributeMenu();
            }
        };
        card.addEventListener('click', choose);
        card.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); choose(); } });
    });
}

function selectAttribute(attr) {
    const attrNames = {
        'strength': 'Battle',
        'agility': 'Defense',
        'intelligence': 'Cunning',
        'stamina': 'Stamina',
        'morale': 'Morale'
    };
    
    if((player.unspentLevelPoints || 0) <= 0) return;

    player.attributes[attr]++;
    player.unspentLevelPoints = Math.max(0, (player.unspentLevelPoints || 0) - 1);
    applyAttributeBonus(attr);
    const d = describeAttributeChoice(player, attr);
    log(`+1 ${attrNames[attr]} : ${d.statTitle} +1, qì ${d.colorLabel} ${manaPerMatch(attr, player.attributes[attr])} par match de 3`);
    updateLevelHud();
    updatePlayerStatsTab();
    saveUpdate();
}

// Menu « Réinitialiser les points » (onglet Stats) : rend tous les points d'attribut dépensés, hors combat, puis ouvre la répartition.
export function resetAttributePoints(){
    if(gameState.combatState === 'active') {
        log("Impossible de réinitialiser les points pendant un combat.");
        return { ok: false, refunded: 0 };
    }
    const { refunded } = respecAttributes(player);
    if(refunded <= 0) return { ok: false, refunded: 0 };
    clampManaToCaps(player);
    log(`Points réinitialisés : ${refunded} point(s) d'attribut à répartir.`);
    updateLevelHud();
    updateStats();
    updatePlayerStatsTab();
    saveUpdate();
    showAttributeMenu();
    return { ok: true, refunded };
}

export function applyAttributeBonus(attr){
    switch(attr){
        case "strength":
            player.attack += 1;
            break;
        case "agility":
            player.defense = (player.defense || 0) + 1;
            break;
        case "intelligence":
            // L'effet principal reste linéaire (v) sur la puissance magique.
            break;
        case "stamina":
            player.maxHp += 1;
            player.hp = Math.min(player.maxHp, player.hp + 1);
            break;
        case "morale":
            player.defense = (player.defense || 0) + 1;   // le moral donne de l'agilité : défense (comme l'agilité) et initiative (agilityScore)
            break;
    }
    clampManaToCaps(player);
}

// -------------------------------------
