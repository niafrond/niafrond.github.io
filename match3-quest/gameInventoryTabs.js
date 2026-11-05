// Onglets Armes, Équipement et Inventaire : armes en main, boutons d'arme/objet, cartes, équiper / vendre / utiliser un objet.
// Extrait de game.js.
import { getWeaponById, BIOME_LABELS, describeStatBonuses } from "./weapons.js";
import { actionGuard } from "./actionGuard.js";
import { compareButtonHtml, deltaBadgesHtml } from "./compareView.js";
import { getRarityIcon, getRarityColor, useItem, describeRecharge } from "./items.js";
import { icon as svgIcon } from "./icons.js";
import { equip as equipGearSlot, unequip as unequipGearSlot } from "./equipment.js";
import { itemGroupKey, toggleSellTag, allShieldsTagged } from "./merchants.js";
import { displayAttack, rawDefense, statModifier } from "./combatStats.js";
import { bindTooltip, showWeaponTooltip, showItemTooltip, hideSpellTooltip } from "./gameTooltips.js";
import { escapeHtml, cardActionsHtml, emptySlotHtml, WEAPON_SORTS, sortChoice, bindSortSelect, sortedEntries } from "./gameCardUi.js";
import { getWeaponIcon, player, currentTurn, gameState, enemy, normalizeActiveInventoryIndex, getActiveInventoryItem, log, logActiveAction, saveUpdate, rejectRushedAction, useWeapon, finishPlayerTurn } from "./game.js";

// -------------------------------------
// Armes
export function updateAvailableWeapons(){
    // Initialiser l'inventaire des armes s'il n'existe pas
    if(!player.weapons) {
        player.weapons = [];
    }
    // Les armes disponibles sont celles que le joueur possède et peut utiliser
    player.availableWeapons = player.weapons.filter(weapon => weapon.minLevel <= player.level);
    
    // Si l'arme équipée n'est plus disponible (niveau trop bas), la retirer
    if(player.equippedWeapon && player.level < player.equippedWeapon.minLevel){
        player.equippedWeapon = null;
    }
}

// Retire ce qui occupe la main gauche ; un bouclier retourne dans l'inventaire (et perd son bonus de défense).
function clearLeftHand(){
    if(!player.equipment) player.equipment = { rightHand: null, leftHand: null, item: null };
    const previous = player.equipment.leftHand;
    player.equipment.leftHand = null;
    if(previous?.type === 'shield'){
        if(!player.inventory) player.inventory = [];
        player.inventory.push(previous);
        if(previous.defense) player.defense = Math.max(0, (player.defense || 0) - previous.defense);
    }
    return previous;
}

export function equipWeapon(weaponId, hand = 'right'){
    if(gameState.combatState === 'active'){
        log('Vous ne pouvez pas modifier vos armes pendant le combat !');
        return;
    }
    const weapon = getWeaponById(weaponId);
    if(!weapon){ log('Arme inconnue.'); return; }
    if(player.level < weapon.minLevel){
        log(`Nécessite niveau ${weapon.minLevel} pour équiper ${weapon.name}.`);
        return;
    }
    if(!player.equipment) player.equipment = { rightHand: null, leftHand: null, item: null };
    if(hand === 'left'){
        if(weapon.twoHanded){ log(`${weapon.name} se manie à deux mains : main droite uniquement.`); return; }
        if(player.equippedWeapon?.twoHanded){ log(`Une arme à deux mains occupe déjà vos deux mains.`); return; }
        if(player.equippedWeapon?.id === weapon.id){ log(`${weapon.name} est déjà en main droite.`); return; }
        clearLeftHand();
        player.equipment.leftHand = weapon;
        saveUpdate();
        log(`${weapon.name} équipée en main gauche.`);
        createWeaponButton();
        return;
    }
    if(weapon.twoHanded && player.equipment.leftHand){
        const freed = clearLeftHand();
        log(`${weapon.name} se manie à deux mains : ${freed.name} est retiré de la main gauche.`);
    }
    if(player.equipment.leftHand?.id === weapon.id) player.equipment.leftHand = null;
    player.equippedWeapon = weapon;
    player.equipment.rightHand = weapon;
    saveUpdate();
    log(`${weapon.name} équipée.`);
    createWeaponButton();
}

export function unequipWeapon(hand = 'right'){
    if(gameState.combatState === 'active'){
        log('Vous ne pouvez pas modifier vos armes pendant le combat !');
        return;
    }
    if(hand === 'left'){
        const left = getLeftHandWeapon();
        if(!left) return;
        player.equipment.leftHand = null;
        saveUpdate();
        log(`${left.name} retirée.`);
        createWeaponButton();
        return;
    }
    if(!player.equippedWeapon) return;
    const weaponName = player.equippedWeapon.name;
    player.equippedWeapon = null;
    if(player.equipment) player.equipment.rightHand = null;
    saveUpdate();
    log(`${weaponName} retirée.`);
    createWeaponButton();
}

export function getLeftHandWeapon(){
    const left = player.equipment?.leftHand;
    return left && left.type !== 'shield' && left.damage !== undefined ? left : null;
}

function appendWeaponButton(container, weapon, hand){
    const btn = document.createElement('div');
    btn.className = 'enemy-spell-item';
    btn.tabIndex = 0;
    const icon = getWeaponIcon(weapon.type);
    btn.innerHTML = `
        <div class="spell-name">${icon} ${weapon.name}</div>
        <div class="spell-cost">${weapon.actionPoints} ${svgIcon('arrow')} - ${weapon.damage} ${svgIcon('skull')}</div>
    `;
    const showDetails = () => showWeaponTooltip(btn, weapon);
    const hideDetails = () => hideSpellTooltip();
    bindTooltip(btn, showDetails, hideDetails);
    if(player.level < weapon.minLevel || player.combatPoints < weapon.actionPoints) {
        btn.classList.add('disabled');
        btn.tabIndex = -1;
        btn.onclick = null;
    } else {
        btn.onclick = () => useWeapon(hand);
        btn.onkeydown = (event) => {
            if(event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                useWeapon(hand);
            }
        };
    }
    container.appendChild(btn);
}

export function createWeaponButton(){
    const container = document.getElementById('weapon-button');
    if(!container) return;
    container.innerHTML = "";

    if(!player.equippedWeapon){
        if(player.availableWeapons && player.availableWeapons.length > 0) {
            container.innerHTML = `
                <div class="enemy-spell-item disabled">
                    <div class="spell-name">Aucune arme equipee</div>
                    <div class="spell-cost">Allez dans l'onglet Armes pour en equiper une.</div>
                </div>
            `;
        }
    } else {
        appendWeaponButton(container, player.equippedWeapon, 'right');
    }
    const leftWeapon = getLeftHandWeapon();
    if(leftWeapon) appendWeaponButton(container, leftWeapon, 'left');

    updateWeaponsTab();
}

const WEAPON_DELTA_FIELDS = [['damage', 'Dégâts'], ['actionPoints', 'PA', 'low'], ['atkBonus', 'Atk'], ['defBonus', 'Déf']];

// hand : 'right' | 'left' pour une arme en main (bouton « Retirer »), absent pour une arme du sac.
function weaponCardHtml(weapon, { hand } = {}){
    const right = player.equippedWeapon;
    const locked = player.level < weapon.minLevel;
    const bonuses = describeStatBonuses(weapon);
    const stats = `${weapon.damage} ${svgIcon('skull')} • ${weapon.actionPoints} ${svgIcon('arrow')} • Niv. ${weapon.minLevel}${weapon.twoHanded ? ' • Deux mains' : ''}${bonuses ? ` • ${bonuses}` : ''}${weapon.biome ? ` • Bonus : ${BIOME_LABELS[weapon.biome]}` : ''}`;
    const deltas = hand || locked ? '' : deltaBadgesHtml(weapon, right, WEAPON_DELTA_FIELDS);
    let actions;
    if(hand){
        actions = `<button type="button" class="weapon-action" onclick="window.unequipWeapon('${hand}')">Retirer</button>`;
    } else if(locked){
        actions = `<button type="button" class="weapon-action" disabled>Niv. ${weapon.minLevel} requis</button>`;
    } else if(weapon.twoHanded){
        actions = `<button type="button" class="weapon-action" onclick="window.equipWeapon('${weapon.id}', 'right')">${right ? 'Remplacer' : 'Équiper'} (2 mains)</button>`;
    } else {
        const leftBlocked = right?.twoHanded;
        actions = `<button type="button" class="weapon-action" onclick="window.equipWeapon('${weapon.id}', 'right')">Main droite</button>`
            + `<button type="button" class="weapon-action" ${leftBlocked ? `disabled title="${escapeHtml(right.name)} occupe les deux mains"` : ''} onclick="window.equipWeapon('${weapon.id}', 'left')">Main gauche</button>`;
    }
    const handBadge = hand ? `<em class="slot-badge">${hand === 'left' ? 'Main gauche' : 'Main droite'}</em>` : '';
    return `
        <div class="weapon-item gear-card ${hand ? 'equipped-weapon' : 'available-weapon'}${locked && !hand ? ' is-locked' : ''}">
            <span class="weapon-icon">${getWeaponIcon(weapon.type)}</span>
            <div class="weapon-details">
                <span class="weapon-name">${weapon.name} ${handBadge}</span>
                <span class="weapon-stats">${stats}</span>
                ${deltas ? `<span class="card-deltas" title="Par rapport à l'arme en main droite">${deltas}</span>` : ''}
                <span class="weapon-description">${weapon.description}</span>
            </div>
            ${cardActionsHtml(compareButtonHtml('weapon', weapon.id) + (hand ? '' : weaponSellTagButton(weapon)), actions)}
        </div>`;
}

// mise à jour de l'onglet armes
export function updateWeaponsTab(){
    bindSortSelect('weapons-sort', updateWeaponsTab);
    bindSortSelect('items-sort', updateWeaponsTab);
    const equippedDiv = document.getElementById('equipped-weapon');
    const availableList = document.getElementById('available-weapons-list');
    if(!equippedDiv || !availableList) return;
    
    // Armes équipées : une case par main, vide ou occupée (bouclier, arme à deux mains), comme l'onglet Stuff.
    equippedDiv.innerHTML = '<h3>Armes équipées</h3>';
    const right = player.equippedWeapon;
    const left = getLeftHandWeapon();
    equippedDiv.insertAdjacentHTML('beforeend', right
        ? weaponCardHtml(right, { hand: 'right' })
        : emptySlotHtml('Main droite', 'Vide : équipez une arme ci-dessous.'));
    const shield = player.equipment?.leftHand?.type === 'shield' ? player.equipment.leftHand : null;
    if(left) equippedDiv.insertAdjacentHTML('beforeend', weaponCardHtml(left, { hand: 'left' }));
    else if(right?.twoHanded) equippedDiv.insertAdjacentHTML('beforeend', emptySlotHtml('Main gauche', `Occupée : ${escapeHtml(right.name)} se tient à deux mains.`));
    else if(shield) equippedDiv.insertAdjacentHTML('beforeend', emptySlotHtml('Main gauche', `${escapeHtml(shield.name)} (bouclier, ci-dessous).`));
    else equippedDiv.insertAdjacentHTML('beforeend', emptySlotHtml('Main gauche', 'Vide : une arme à une main peut s\'y ajouter.'));

    // Armes disponibles : celles du sac (hors mains), utilisables d'abord, puis « Niveau trop bas » repliées.
    const lockedWasOpen = !!availableList.querySelector('details.locked-group')?.open;
    availableList.innerHTML = '';
    const weaponSort = WEAPON_SORTS[sortChoice('weapons-sort')];
    const ownedWeapons = weaponSort ? [...(player.weapons || [])].sort(weaponSort) : (player.weapons || []);
    const spare = ownedWeapons.filter(w => w.id !== right?.id && w.id !== left?.id);
    if(spare.length === 0){
        availableList.innerHTML = ownedWeapons.length
            ? '<p class="shop-empty">Toutes vos armes sont en main.</p>'
            : '<p class="shop-empty"><strong>Aucune arme en votre possession.</strong> Les armes s\'obtiennent en gagnant des combats ou chez les marchands.</p>';
    } else {
        const usable = spare.filter(w => player.level >= w.minLevel);
        const locked = spare.filter(w => player.level < w.minLevel);
        availableList.innerHTML = usable.map(w => weaponCardHtml(w)).join('')
            + (locked.length ? `<details class="locked-group"${lockedWasOpen ? ' open' : ''}><summary>Niveau trop bas (${locked.length})</summary>${locked.map(w => weaponCardHtml(w)).join('')}</details>` : '');
    }

    renderGearList(document.getElementById('shield-list'), 'shield');
    updateInventoryTab();
    updateItemButton();
}


export const shieldStats = it => [it.defense ? `Déf. +${it.defense}` : '', it.atkBonus ? `Atk +${it.atkBonus}` : '', it.absorbDamage ? `absorbe ${it.absorbDamage}` : '', `Niv. ${it.minLevel}`, 'Main gauche'].filter(Boolean).join(' • ');

// Boucliers (main gauche, onglet Armes) ou objets rechargeables (objet actif, onglet Objets) : affichés dès l'achat,
// non sélectionnables tant que le niveau requis n'est pas atteint.
function renderGearList(container, kind){
    if(!container) return;
    container.innerHTML = '';
    if(!player.equipment) player.equipment = { rightHand: null, leftHand: null, item: null };
    const inventory = player.inventory || [];
    const wornShield = player.equipment.leftHand?.type === 'shield' ? player.equipment.leftHand : null;
    const withShields = kind === 'shield';
    const shields = withShields ? sortedEntries(inventory.map((it, index) => ({ it, index })).filter(({ it }) => it.type === 'shield'), 'items-sort') : [];
    if(!(withShields && wornShield) && shields.length === 0) return;
    const section = document.createElement('div');
    section.innerHTML = '<h3 class="shop-section-title">Boucliers</h3>';
    const row = (it, details, action) => {
        const div = document.createElement('div');
        div.className = 'weapon-item available-weapon' + (action.locked ? ' is-locked' : '') + (action.current ? ' is-equipped' : '');
        div.innerHTML = `
            <span class="weapon-icon">${svgIcon(it.type === 'shield' ? 'shield' : 'bag')}</span>
            <div class="weapon-details">
                <span class="weapon-name">${it.name}</span>
                <span class="weapon-stats">${details}</span>
                <span class="weapon-description">${it.description || ''}</span>
            </div>
            <button class="weapon-action" ${action.disabled ? 'disabled' : ''}${action.title ? ` title="${escapeHtml(action.title)}"` : ''} onclick="${action.onclick || ''}">${action.label}</button>`;
        div.querySelector('.weapon-details').insertAdjacentHTML('beforeend', compareButtonHtml('item', it.id) + (action.sellTag ? sellTagButton(it, 1) : ''));
        section.appendChild(div);
    };
    if(withShields && wornShield) row(wornShield, shieldStats(wornShield), { current: true, label: 'Retirer', onclick: "window.unequipGear('leftHand')" });
    shields.forEach(({ it, index }) => {
        const locked = player.level < (it.minLevel || 1);
        row(it, shieldStats(it), { sellTag: true, locked, disabled: locked, label: locked ? `Niv. ${it.minLevel} requis` : 'Équiper', title: !locked && player.equipment?.rightHand?.twoHanded ? `${player.equipment.rightHand.name} (deux mains) sera retirée` : '', onclick: `window.equipGear(${index})` });
    });
    container.appendChild(section);
}

export function equipGear(inventoryIndex){
    if(gameState.combatState === 'active'){ log('Vous ne pouvez pas modifier votre équipement pendant le combat !'); return; }
    const it = player.inventory?.[inventoryIndex];
    if(!it || it.type !== 'shield') return;
    if(player.level < (it.minLevel || 1)){ log(`Nécessite niveau ${it.minLevel} pour équiper ${it.name}.`); return; }
    if(!player.equipment) player.equipment = { rightHand: null, leftHand: null, item: null };
    // Une arme à deux mains occupe la main gauche : on la range pour libérer la main (comme l'inverse, qui renvoie le bouclier).
    const freedWeapon = player.equipment.rightHand?.twoHanded ? player.equipment.rightHand : null;
    if(freedWeapon){
        player.equippedWeapon = null;
        player.equipment.rightHand = null;
        log(`${freedWeapon.name} se manie à deux mains : elle est retirée pour équiper ${it.name}.`);
    }
    const previous = player.equipment.leftHand;
    const result = equipGearSlot(player, it, 'leftHand');
    if(!result.success){ log(result.message || `${it.name} ne peut pas être équipé.`); return; }
    if(freedWeapon) createWeaponButton();
    player.inventory.splice(inventoryIndex, 1);
    if(previous?.type === 'shield'){ player.inventory.push(previous); if(previous.defense) player.defense = Math.max(0, (player.defense || 0) - previous.defense); }
    if(it.defense) player.defense = (player.defense || 0) + it.defense;
    // L'index de l'objet actif suit le décalage de l'inventaire
    if(Number.isInteger(player.activeInventoryIndex) && player.activeInventoryIndex > inventoryIndex) player.activeInventoryIndex--;
    saveUpdate();
    log(`${it.name} équipé.`);
    updateWeaponsTab();
}

export function unequipGear(slot){
    if(gameState.combatState === 'active'){ log('Vous ne pouvez pas modifier votre équipement pendant le combat !'); return; }
    if(slot !== 'leftHand' || player.equipment?.leftHand?.type !== 'shield') return;
    const it = unequipGearSlot(player, slot);
    player.inventory.push(it);
    if(it.defense) player.defense = Math.max(0, (player.defense || 0) - it.defense);
    saveUpdate();
    log(`${it.name} retiré.`);
    updateWeaponsTab();
}

// =====================================
// (Boutique déplacée dans shop.js)
// =====================================

// Regroupe les exemplaires identiques ({ it, index } → { it, index, count }) : l'index retenu est l'objet actif du groupe, sinon le premier.
function groupInventoryEntries(entries){
    const groups = new Map();
    entries.forEach(e => {
        const key = itemGroupKey(e.it);
        const g = groups.get(key);
        if(!g) groups.set(key, { ...e, count: 1 });
        else { g.count++; if(e.index === player.activeInventoryIndex) g.index = e.index; }
    });
    return [...groups.values()];
}
const countLabel = count => count > 1 ? ` x ${count}` : '';
// Bouton pièce : tague une pièce à vendre au prochain marchand. Armes et boucliers : toujours (la pièce entière, même sans doublon) ;
// autres objets : seulement quand il y en a plusieurs (l'excédent).
const sellTagButtonFor = (tag, title) => {
    const on = (player.sellTags || []).includes(tag);
    return `<button class="item-discard-btn item-sell-tag${on ? ' on' : ''}" aria-pressed="${on}" title="${on ? 'À vendre au prochain marchand (cliquer pour annuler)' : title}" onclick="window.toggleSellSurplus('${String(tag).replace(/'/g, "\\'")}')">${svgIcon('coin')}<span class="item-sell-tag-label">À vendre</span></button>`;
};
const sellTagButton = (it, count) => {
    if(it.type === 'shield') return sellTagButtonFor(itemGroupKey(it), 'Marquer ce bouclier à vendre au prochain marchand');
    if(count < 2) return '';
    return sellTagButtonFor(itemGroupKey(it), 'Marquer l\'excédent à vendre au prochain marchand');
};
const weaponSellTagButton = weapon => sellTagButtonFor(`weapon:${weapon.id}`, 'Marquer cette arme à vendre au prochain marchand');
export function toggleSellSurplus(id){
    const tagged = toggleSellTag(player, id);
    if(tagged && allShieldsTagged(player)) log('Attention : tous vos boucliers sont marqués à vendre, vous n\'en aurez plus aucun après la vente.');
    updateWeaponsTab();   // redessine aussi l'onglet Objets
    saveUpdate();
}

// Valeur d'Attaque / de Défense : verte si un sort ou un effet l'augmente, rouge s'il la diminue.
export function statValueHtml(entity, stat){
    const value = stat === 'attack' ? displayAttack(entity) : rawDefense(entity);
    const mod = statModifier(entity, stat);
    if(!mod) return String(value);
    const title = `${mod > 0 ? '+' : '−'}${Math.abs(mod)} grâce aux effets en cours`;
    return `<span class="${mod > 0 ? 'stat-up' : 'stat-down'}" title="${title}">${value}</span>`;
}

export function updateInventoryTab(){
    const inventoryList = document.getElementById('inventory-list');
    if(!inventoryList) return;
    document.dispatchEvent(new Event('stuff-changed'));   // les reliques du sac sont aussi listées dans l'onglet Stuff (stuffView.js)
    bindSortSelect('items-sort', updateWeaponsTab);
    normalizeActiveInventoryIndex();

    inventoryList.innerHTML = '';

    // Les boucliers (portés ou en réserve) sont gérés dans l'onglet Armes : le sac ne liste que les objets, une seule fois chacun.
    if(!player.inventory || !player.inventory.some(item => item.type !== 'shield')){
        inventoryList.innerHTML = `
            <div class="inventory-slot inventory-slot-empty">
                <span class="slot-icon">${svgIcon('box')}</span>
                <span class="slot-label"><em>Aucun objet</em></span>
            </div>
        `;
        return;
    }

    groupInventoryEntries(sortedEntries(player.inventory.map((item, index) => ({ it: item, index })).filter(({ it }) => it.type !== 'shield'), 'items-sort')).forEach(({ it: item, index, count }) => {
        const isActive = index === player.activeInventoryIndex;
        const rarityEmoji = getRarityIcon(item.rarity);
        const rarityColor = getRarityColor(item.rarity);

        const div = document.createElement('div');
        div.className = `item-card ${item.type === 'consumable' || item.type === 'reusable' ? 'consumable-item' : 'artifact-item'}`;
        div.style.borderLeft = `4px solid ${rarityColor}`;
        const paInfo = item.type === 'consumable' || item.type === 'reusable' ? ` <span style="color:#888;font-size:0.85em;">(${item.actionPoints || 2} ${svgIcon('arrow')})</span>` : '';
        const levelLocked = player.level < (item.minLevel || 1);
        const inCombat = gameState.combatState === 'active';
        const activateTitle = levelLocked ? `Nécessite le niveau ${item.minLevel}` : inCombat ? "Impossible de changer d'objet actif pendant le combat" : '';
        div.innerHTML = `
            <div class="item-header">
                <span class="item-name">${rarityEmoji} ${item.name}${countLabel(count)}${paInfo}</span>
                <div class="item-actions">
                    ${sellTagButton(item, count)}
                    ${isActive ? '<span class="artifact-badge">Actif</span>' : `<button class="item-discard-btn" ${levelLocked || inCombat ? 'disabled' : ''} title="${activateTitle}" onclick="window.setActiveInventoryItem(${index})">${levelLocked ? `Niv. ${item.minLevel} requis` : 'Activer'}</button>`}
                    <button class="item-discard-btn" onclick="window.discardInventoryItem(${index})">Jeter</button>
                </div>
            </div>
            <div class="item-description">${item.description}${item.type === 'reusable' ? ` <em>(${item.chargesLeft ?? item.chargesPerCycle}/${item.chargesPerCycle} charges)</em>` : ''}${item.type === 'reusable' && (item.chargesLeft ?? item.chargesPerCycle) <= 0 ? ` <em>(${describeRecharge(item)})</em>` : ''}</div>
        `;
        inventoryList.appendChild(div);
    });
}

export function updateItemButton(){
    const container = document.getElementById('item-button');
    if(!container) return;
    container.innerHTML = '';
    normalizeActiveInventoryIndex();

    if(!player.inventory || player.inventory.length === 0) return;

    const item = getActiveInventoryItem();
    if(!item) return;

    if(item.type === 'artifact'){
        const div = document.createElement('div');
        div.className = 'enemy-spell-item disabled';
        div.tabIndex = 0;
        div.innerHTML = `
            <div class="spell-name">${svgIcon('bolt')} ${item.name}</div>
            <div class="spell-cost">Actif (passif)</div>
        `;
        const showDetails = () => showItemTooltip(div, item, { isEnemyItem: false });
        const hideDetails = () => hideSpellTooltip();
        bindTooltip(div, showDetails, hideDetails);
        container.appendChild(div);
        return;
    }

    const pa = item.actionPoints || 2;
    const exhausted = item.type === 'reusable' && (item.chargesLeft ?? item.chargesPerCycle) <= 0;
    const healUseless = isUselessHeal(item);
    const canUse = gameState.combatState === 'active' && currentTurn === 'player' && player.combatPoints >= pa && !exhausted && !healUseless;

    const btn = document.createElement('div');
    btn.className = 'enemy-spell-item';
    btn.tabIndex = 0;
    btn.innerHTML = `
        <div class="spell-name">${svgIcon('bag')} ${item.name}</div>
        <div class="spell-cost">${pa} ${svgIcon('arrow')}${item.type === 'reusable' ? ` • ${item.chargesLeft ?? item.chargesPerCycle}/${item.chargesPerCycle}${(item.chargesLeft ?? item.chargesPerCycle) <= 0 ? ` • ${describeRecharge(item)}` : ''}` : ''}</div>
    `;
    const showDetails = () => showItemTooltip(btn, item, { isEnemyItem: false });
    const hideDetails = () => hideSpellTooltip();
    bindTooltip(btn, showDetails, hideDetails);

    if(!canUse){
        btn.classList.add('disabled');
        btn.tabIndex = -1;
        btn.onclick = null;
    } else {
        btn.onclick = () => useInventoryItem(item.id, player.activeInventoryIndex);
        btn.onkeydown = (event) => {
            if(event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                useInventoryItem(item.id, player.activeInventoryIndex);
            }
        };
    }
    container.appendChild(btn);
}

export function setActiveInventoryItem(index){
    if(gameState.combatState === 'active'){
        log('Vous ne pouvez pas changer d\'objet actif pendant le combat !');
        return;
    }
    if(!Array.isArray(player.inventory) || player.inventory.length === 0) return;
    if(!Number.isInteger(index) || index < 0 || index >= player.inventory.length) return;
    if(player.activeInventoryIndex === index) return;
    const chosen = player.inventory[index];
    if(chosen.type === 'shield') return;
    if(player.level < (chosen.minLevel || 1)){ log(`Nécessite niveau ${chosen.minLevel} pour utiliser ${chosen.name}.`); return; }

    player.activeInventoryIndex = index;
    const item = player.inventory[index];
    log(`Objet actif : ${item.name}.`);
    updateInventoryTab();
    updateItemButton();
    saveUpdate();
}

// Objet de pur soin inutile quand les PV sont déjà au maximum
function isUselessHeal(item){
    const keys = Object.keys(item?.effect || {});
    return keys.length === 1 && keys[0] === 'heal' && player.hp >= player.maxHp;
}

export function useInventoryItem(itemId, index){
    if(gameState.combatState !== 'active'){ log("Aucun combat en cours."); return; }
    if(currentTurn !== 'player'){ log("Ce n'est pas votre tour."); return; }
    if(rejectRushedAction()) return;

    normalizeActiveInventoryIndex();
    const resolvedIndex = Number.isInteger(index) ? index : player.activeInventoryIndex;
    if(!Number.isInteger(resolvedIndex) || resolvedIndex < 0 || resolvedIndex >= player.inventory.length) {
        log("Aucun objet actif sélectionné.");
        return;
    }

    const item = player.inventory[resolvedIndex];
    if(item.id !== itemId){
        log("L'objet actif a changé, réessayez.");
        return;
    }
    if(!item){ log("Objet introuvable."); return; }
    if(isUselessHeal(item)){ log("Vos PV sont déjà au maximum."); return; }

    const pa = item.actionPoints || 2;
    if(player.combatPoints < pa){
        log(`Il faut ${pa} points d'action pour utiliser ${item.name}.`);
        return;
    }

    actionGuard.markPlayerAction();
    player.combatPoints -= pa;
    const result = useItem(itemId, player, enemy, resolvedIndex);
    if(result.success){
        logActiveAction(`utilise l'objet ${item.name} (cout ${pa} PA)`);
        log(result.message);
        normalizeActiveInventoryIndex();
        updateInventoryTab();
        updateItemButton();
        saveUpdate();
        finishPlayerTurn();
    } else {
        player.combatPoints += pa;
        log(`${result.message}`);
    }
}

export function discardInventoryItem(index){
    if(!player.inventory || player.inventory.length === 0) return;
    let targetIndex = Number.isInteger(index) ? index : player.activeInventoryIndex;
    if(!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= player.inventory.length) {
        targetIndex = 0;
    }

    const item = player.inventory[targetIndex];
    player.inventory.splice(targetIndex, 1);
    normalizeActiveInventoryIndex();
    log(`Vous avez jeté ${item.name}.`);
    updateInventoryTab();
    updateItemButton();
    saveUpdate();
}
