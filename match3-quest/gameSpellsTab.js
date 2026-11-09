// Onglet Sorts : liste des sorts disponibles, tri, sélecteur d'ultime, équiper / retirer un sort ou un ultime.
// Extrait de game.js.
import { MAX_ACTIVE_SPELLS } from "./constants.js";
import { compareButtonHtml } from "./compareView.js";
import { icon as svgIcon } from "./icons.js";
import { getSelectableUltimates, getEquippedUltimate, getQuestUltimates, isUltimateUnlocked, withUltimateCost } from "./ultimates.js";
import { bindTooltip, showSpellTooltip, hideSpellTooltip } from "./gameTooltips.js";
import { cardActionsHtml, sortChoice, bindSortSelect } from "./gameCardUi.js";
import { spellEffectIcon, spellColorsOf, spellCostHtml, markMultiManaSpell, player, gameState, log, saveUpdate } from "./game.js";

// ── Tri de la liste des sorts disponibles (menu déroulant de l'onglet Sorts) ──
const spellCostTotal = sp => typeof sp.cost === 'number' ? sp.cost : Object.values(sp.cost || {}).reduce((a, b) => a + b, 0);
const SPELL_COLOR_ORDER = ['red', 'blue', 'green', 'yellow'];
const SPELL_SORTS = {
    name: (a, b) => String(a.name).localeCompare(String(b.name), 'fr'),
    cost: (a, b) => spellCostTotal(a) - spellCostTotal(b) || String(a.name).localeCompare(String(b.name), 'fr'),
    dmg: (a, b) => (b.dmg || 0) - (a.dmg || 0) || spellCostTotal(a) - spellCostTotal(b),
    heal: (a, b) => (b.heal || 0) - (a.heal || 0) || spellCostTotal(a) - spellCostTotal(b),
    color: (a, b) => ((SPELL_COLOR_ORDER.indexOf(spellColorsOf(a)[0]) + 1) || 99) - ((SPELL_COLOR_ORDER.indexOf(spellColorsOf(b)[0]) + 1) || 99) || spellCostTotal(a) - spellCostTotal(b)
};

// Carte d'un sort : nom, coût en gomettes et effets, puis pied « Comparer » + action.
function spellCard(sp, actionHtml, extraClass){
    const div = document.createElement('div');
    div.className = `spell-item gear-card ${extraClass}`;
    markMultiManaSpell(div, sp);
    const damageText = sp.dmg ? ` • ${sp.dmg} ${svgIcon('skull')}` : '';
    const healText = sp.heal ? ` • ${sp.heal} ${svgIcon('heart')}` : '';
    const effectText = sp.effect ? ` • ${sp.description}` : '';
    div.innerHTML = `
        <div class="spell-content">
            <div class="spell-name">${sp.name} ${spellEffectIcon(sp)}</div>
            <div class="spell-cost">${spellCostHtml(sp)}${damageText}${healText}${effectText}</div>
        </div>
        ${cardActionsHtml(compareButtonHtml('spell', sp.id), actionHtml)}`;
    bindSpellRowTooltip(div, sp);
    return div;
}

// mise à jour de l'onglet sorts
export function updateSpellsTab(){
    const activeList = document.getElementById('active-spells-list');
    const availableList = document.getElementById('available-spells-list');
    if(!activeList || !availableList) return;
    bindSortSelect('spells-sort', updateSpellsTab);

    // sorts actifs, puis une case vide par emplacement libre
    activeList.innerHTML = `<h3>Sorts actifs (${player.activeSpells.length}/${MAX_ACTIVE_SPELLS})</h3>`;
    player.activeSpells.forEach(sp => {
        activeList.appendChild(spellCard(sp, `<button type="button" class="weapon-action" onclick="window.unequipSpell('${sp.id}')">Retirer</button>`, 'active-spell'));
    });
    for(let i = player.activeSpells.length; i < MAX_ACTIVE_SPELLS; i++){
        activeList.insertAdjacentHTML('beforeend', `<div class="spell-item gear-card slot-empty"><div class="spell-content"><div class="spell-name">Emplacement ${i + 1}</div><div class="spell-cost">libre</div></div></div>`);
    }

    updateUltimatePicker();

    // sorts disponibles (non équipés)
    availableList.innerHTML = '';
    const sortFn = SPELL_SORTS[sortChoice('spells-sort')];
    const archived = archivedIds();
    const unequipped = player.availableSpells.filter(sp => !player.activeSpells.some(active => active.id === sp.id) && !archived.includes(sp.id));
    if(sortFn) unequipped.sort(sortFn);
    const full = player.activeSpells.length >= MAX_ACTIVE_SPELLS;   // plus de place : le bouton propose de remplacer un sort
    if(unequipped.length === 0){
        availableList.innerHTML = '<p class="shop-empty">Aucun sort à équiper.</p>';
    }
    unequipped.forEach(sp => {
        const actions = `<button type="button" class="weapon-action" onclick="window.archiveSpell('${sp.id}')" title="Ranger ce sort dans les archives">Archiver</button>`
            + `<button type="button" class="weapon-action" onclick="window.equipSpell('${sp.id}')">${full ? 'Remplacer…' : 'Équiper'}</button>`;
        availableList.appendChild(spellCard(sp, actions, 'available-spell'));
    });
    updateArchivedSpells(sortFn);
}

// ── Archives : sorts rangés hors de la liste des sorts disponibles (pour épurer la vue) ──
const archivedIds = () => Array.isArray(player.archivedSpells) ? player.archivedSpells : [];

function updateArchivedSpells(sortFn){
    const box = document.getElementById('archived-spells');
    const list = document.getElementById('archived-spells-list');
    const count = document.getElementById('archived-spells-count');
    if(!box || !list) return;
    const archived = archivedIds();
    const spells = player.availableSpells.filter(sp => archived.includes(sp.id));
    if(sortFn) spells.sort(sortFn);
    if(count) count.textContent = `(${spells.length})`;
    list.innerHTML = spells.length ? '' : '<p class="shop-empty">Aucun sort archivé.</p>';
    spells.forEach(sp => {
        list.appendChild(spellCard(sp, `<button type="button" class="weapon-action" onclick="window.unarchiveSpell('${sp.id}')">Désarchiver</button>`, 'archived-spell'));
    });
}

export function archiveSpell(spellId){
    if(!player.availableSpells.some(s => s.id === spellId)) return;
    if(player.activeSpells.some(s => s.id === spellId)) return;   // un sort équipé ne s'archive pas
    if(!Array.isArray(player.archivedSpells)) player.archivedSpells = [];
    if(!player.archivedSpells.includes(spellId)) player.archivedSpells.push(spellId);
    saveUpdate();
    updateSpellsTab();
}

export function unarchiveSpell(spellId){
    player.archivedSpells = archivedIds().filter(id => id !== spellId);
    saveUpdate();
    updateSpellsTab();
}

// Appui long (ou survol à la souris) sur un sort de la liste : affiche son effet.
function bindSpellRowTooltip(div, sp){
    bindTooltip(div, () => showSpellTooltip(div, sp), hideSpellTooltip);
}

// Choix de l'ultime : un seul, le seul lançable en combat (en cliquant sur la jauge de rage pleine).
export function updateUltimatePicker(){
    const list = document.getElementById('ultimate-spells-list');
    if(!list) return;
    // Rien à montrer tant qu'aucun ultime n'est débloqué : pas de section, pas de cadenas, pas d'indice sur la façon de les obtenir.
    const choices = getSelectableUltimates(player);
    // Déjà gagné par sa quête mais niveau insuffisant : seul cas où un ultime non choisissable est montré.
    const tooWeak = getQuestUltimates().filter(sp => isUltimateUnlocked(player, sp) && !choices.some(c => c.id === sp.id));
    list.innerHTML = choices.length || tooWeak.length ? '<h3>Ultime (1 seul, jauge de rage)</h3>' : '';
    if(choices.length === 0 && tooWeak.length === 0) return;
    const current = getEquippedUltimate(player);
    choices.forEach(sp => {
        const chosen = sp.id === current.id;
        const action = chosen
            ? '<button type="button" class="weapon-action" disabled>Choisi</button>'
            : `<button type="button" class="weapon-action" onclick="window.equipUltimate('${sp.id}')">Choisir</button>`;
        const div = document.createElement('div');
        div.className = 'spell-item gear-card ultimate-spell' + (chosen ? ' active-spell' : '');
        markMultiManaSpell(div, sp);
        div.innerHTML = `
            <div class="spell-content">
                <div class="spell-name">${sp.name}</div>
                <div class="spell-cost">${spellCostHtml(withUltimateCost(sp))} • ${sp.dmg} ${svgIcon('skull')}${sp.description ? ` • ${sp.description}` : ''}</div>
            </div>
            ${cardActionsHtml('', action)}`;
        list.appendChild(div);
    });
    tooWeak.forEach(sp => {
        const div = document.createElement('div');
        div.className = 'spell-item ultimate-spell locked-spell';
        div.innerHTML = `
            <div class="spell-content">
                <div class="spell-name">${svgIcon('lock')} ${sp.name}</div>
                <div class="spell-cost">Niveau ${sp.minLevel} requis</div>
            </div>
        `;
        list.appendChild(div);
    });
}

export function equipUltimate(spellId){
    if(gameState.combatState === 'active'){
        log("Vous ne pouvez pas changer d'ultime pendant le combat !");
        return;
    }
    const spell = getSelectableUltimates(player).find(s => s.id === spellId);
    if(!spell) return;
    player.equippedUltimate = spell.id;
    saveUpdate();
    updateUltimatePicker();
    log(`Ultime ${spell.name} choisi.`);
}

export function equipSpell(spellId, replaceId = null){
    if(gameState.combatState === 'active'){
        log('Vous ne pouvez pas modifier vos sorts pendant le combat !');
        return;
    }
    const spell = player.availableSpells.find(s => s.id === spellId);
    if(!spell) return;
    if(player.activeSpells.some(s => s.id === spellId)) return;
    if(player.activeSpells.length >= MAX_ACTIVE_SPELLS){
        // plus de place : on demande quel sort remplacer
        if(!replaceId){ askSpellToReplace(spell); return; }
        const idx = player.activeSpells.findIndex(s => s.id === replaceId);
        if(idx < 0) return;
        const old = player.activeSpells[idx];
        player.activeSpells[idx] = spell;
        player.spells = player.activeSpells;
        saveUpdate();
        log(`${spell.name} équipé à la place de ${old.name}.`);
        return;
    }
    player.activeSpells.push(spell);
    player.spells = player.activeSpells;
    saveUpdate();
    log(`${spell.name} équipé.`);
}

// Fenêtre « Remplacer quel sort ? » : liste des sorts équipés, un clic échange l'élu.
function askSpellToReplace(spell){
    document.getElementById('replace-spell-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'replace-spell-modal';
    modal.className = 'modal active';
    modal.innerHTML = `<div class="modal-content">
        <h3>Remplacer quel sort par ${spell.name} ?</h3>
        <div class="replace-spell-list"></div>
        <button type="button" class="weapon-action replace-spell-cancel">Annuler</button>
    </div>`;
    const list = modal.querySelector('.replace-spell-list');
    player.activeSpells.forEach(sp => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'weapon-action';
        btn.innerHTML = `${sp.name} ${spellCostHtml(sp)}${sp.dmg ? ` • ${sp.dmg} ${svgIcon('skull')}` : ''}${sp.heal ? ` • ${sp.heal} ${svgIcon('heart')}` : ''}`;
        btn.addEventListener('click', () => { modal.remove(); equipSpell(spell.id, sp.id); });
        list.appendChild(btn);
    });
    modal.querySelector('.replace-spell-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', ev => { if(ev.target === modal) modal.remove(); });
    document.body.appendChild(modal);
}

export function unequipSpell(spellId){
    if(gameState.combatState === 'active'){
        log('Vous ne pouvez pas modifier vos sorts pendant le combat !');
        return;
    }
    player.activeSpells = player.activeSpells.filter(s => s.id !== spellId);
    player.spells = player.activeSpells;
    saveUpdate();
    const spell = player.availableSpells.find(s => s.id === spellId);
    if(spell) log(`${spell.name} retiré.`);
}
