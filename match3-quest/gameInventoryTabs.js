// Onglets Armes, Équipement et Inventaire : armes en main, boutons d'arme/objet, cartes, équiper / vendre / utiliser un objet.
// Extrait de game.js.
import { getWeaponById, BIOME_LABELS, describeStatBonuses } from "./weapons.js";
import { actionGuard } from "./actionGuard.js";
import { compareButtonHtml, deltaBadgesHtml, equipDeltaGroupsHtml } from "./compareView.js";
import { getItemIcon, getRarityColor, useItem, describeRecharge, shiftActiveItemIndexes } from "./items.js";
import { afflictionsOf } from "./alterations.js";
import { playSfx } from "./sound.js";
import { icon as svgIcon } from "./icons.js";
import { equip as equipGearSlot, unequip as unequipGearSlot } from "./equipment.js";
import { itemGroupKey, toggleSellTag, allShieldsTagged } from "./merchants.js";
import { displayAttack, rawDefense, statModifier } from "./combatStats.js";
import { showCombatAnimation } from "./gameStatsTab.js";
import { bindTooltip, bindCardTips, showWeaponTooltip, showItemTooltip, hideSpellTooltip } from "./gameTooltips.js";
import { escapeHtml, rowCardHtml, emptyRowHtml, badgeHtml, cardTipHtml, shortText, WEAPON_SORTS, sortChoice, bindSortSelect, sortedEntries } from "./gameCardUi.js";
import { getWeaponIcon, player, currentTurn, gameState, enemy, normalizeActiveInventoryIndex, getActiveInventoryItem, getSecondActiveInventoryItem, log, logActiveAction, saveUpdate, rejectRushedAction, useWeapon, finishPlayerTurn } from "./game.js";

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
    const sealed = (player.statusEffects?.sealed || 0) > 0;   // Talisman de Scellement : cadenas, arme inutilisable
    const icon = sealed ? svgIcon('lock') : getWeaponIcon(weapon.type);
    btn.innerHTML = `
        <div class="spell-name">${icon} ${weapon.name}</div>
        <div class="spell-cost">${weapon.actionPoints} ${svgIcon('arrow')} - ${weapon.damage} ${svgIcon('skull')}</div>
    `;
    const showDetails = () => showWeaponTooltip(btn, weapon);
    const hideDetails = () => hideSpellTooltip();
    bindTooltip(btn, showDetails, hideDetails);
    if(sealed || player.level < weapon.minLevel || player.combatPoints < weapon.actionPoints) {
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


// hand : 'right' | 'left' pour une arme en main (bouton « Retirer »), absent pour une arme du sac.
// Carte compacte : nom, puis les écarts avec l'arme en main droite (ce qui compte pour choisir) ou, à défaut, dégâts et PA.
// Atk/Déf, biome et description sont dans l'infobulle (appui long) ; « Main gauche », « Comparer » et « À vendre » dans le menu « ⋯ ».
function weaponCardHtml(weapon, { hand, count = 1 } = {}){
    const right = player.equippedWeapon;
    const locked = player.level < weapon.minLevel;
    const bonuses = describeStatBonuses(weapon);
    // Écarts avec la main droite et, pour une arme à une main, avec ce qui est en main gauche (arme, bouclier ou rien).
    const deltas = hand ? '' : equipDeltaGroupsHtml(player, 'weapon', weapon);
    const stats = `<span class="rc-stats">${weapon.damage} ${svgIcon('skull')} · ${weapon.actionPoints} ${svgIcon('arrow')}</span>`;
    const tip = cardTipHtml(escapeHtml(weapon.name), [
        `${weapon.damage} ${svgIcon('skull')} • ${weapon.actionPoints} ${svgIcon('arrow')} • Niv. ${weapon.minLevel}${weapon.twoHanded ? ' • Deux mains' : ''}`,
        bonuses ? escapeHtml(bonuses) : '',
        weapon.biome ? `Bonus de dégâts : ${escapeHtml(BIOME_LABELS[weapon.biome])}` : '',
        count > 1 ? `Exemplaires : ${count}` : ''
    ], escapeHtml(weapon.description || ''));
    let primary, more = '';
    if(hand){
        primary = `<button type="button" class="rc-btn rc-btn-alt" onclick="window.unequipWeapon('${hand}')">Retirer</button>`;
        more = compareButtonHtml('weapon', weapon.id);
    } else {
        if(locked){
            primary = `<button type="button" class="rc-btn" disabled>Niv. ${weapon.minLevel}</button>`;
        } else if(weapon.twoHanded){
            primary = `<button type="button" class="rc-btn" title="Se manie à deux mains" onclick="window.equipWeapon('${weapon.id}', 'right')">Équiper</button>`;
        } else {
            primary = `<button type="button" class="rc-btn" title="Main droite" onclick="window.equipWeapon('${weapon.id}', 'right')">Équiper</button>`;
            const leftBlocked = right?.twoHanded;
            more += `<button type="button" class="weapon-action" ${leftBlocked ? `disabled title="${escapeHtml(right.name)} occupe les deux mains"` : ''} onclick="window.equipWeapon('${weapon.id}', 'left')">Main gauche</button>`;
        }
        more += compareButtonHtml('weapon', weapon.id) + weaponSellTagButton(weapon);
    }
    const badges = (hand ? badgeHtml(hand === 'left' ? 'Gauche' : 'Droite', 'rc-badge-on') : '') + (weapon.twoHanded ? badgeHtml('2 mains') : '') + (count > 1 ? badgeHtml(`×${count}`) : '');
    return rowCardHtml({
        key: `w:${weapon.id}${hand ? ':' + hand : ''}`,
        cls: `${hand ? 'rc-equipped' : ''}${locked && !hand ? ' is-locked' : ''}`,
        border: getRarityColor(weapon.rarity),
        name: `${getWeaponIcon(weapon.type)} ${escapeHtml(weapon.name)}`,
        badges,
        sub: deltas || stats,   // écarts d'abord ; les chiffres bruts sont dans l'infobulle
        primary, more, tip
    });
}

// mise à jour de l'onglet armes
export function updateWeaponsTab(){
    bindSortSelect('weapons-sort', updateWeaponsTab);
    bindSortSelect('items-sort', updateWeaponsTab);
    const equippedDiv = document.getElementById('equipped-weapon');
    const availableList = document.getElementById('available-weapons-list');
    if(!equippedDiv || !availableList) return;
    
    // Armes équipées : une case par main, vide ou occupée (bouclier, arme à deux mains), comme l'onglet Stuff.
    equippedDiv.innerHTML = '<h3>En main</h3>';
    const right = player.equippedWeapon;
    const left = getLeftHandWeapon();
    equippedDiv.insertAdjacentHTML('beforeend', right
        ? weaponCardHtml(right, { hand: 'right' })
        : emptyRowHtml('Main droite', 'vide'));
    const shield = player.equipment?.leftHand?.type === 'shield' ? player.equipment.leftHand : null;
    if(left) equippedDiv.insertAdjacentHTML('beforeend', weaponCardHtml(left, { hand: 'left' }));
    else if(right?.twoHanded) equippedDiv.insertAdjacentHTML('beforeend', emptyRowHtml('Main gauche', 'occupée (arme à deux mains)'));
    else if(shield) equippedDiv.insertAdjacentHTML('beforeend', emptyRowHtml('Main gauche', `${escapeHtml(shield.name)} (bouclier)`));
    else equippedDiv.insertAdjacentHTML('beforeend', emptyRowHtml('Main gauche', 'vide'));

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
        // Exemplaires identiques : une seule carte avec une pastille ×N.
        const grouped = list => { const m = new Map(); list.forEach(w => m.set(w.id, m.has(w.id) ? { w: m.get(w.id).w, count: m.get(w.id).count + 1 } : { w, count: 1 })); return [...m.values()]; };
        const card = ({ w, count }) => weaponCardHtml(w, { count });
        availableList.innerHTML = grouped(usable).map(card).join('')
            + (locked.length ? `<details class="locked-group"${lockedWasOpen ? ' open' : ''}><summary>Niveau trop bas (${locked.length})</summary>${grouped(locked).map(card).join('')}</details>` : '');
    }

    renderGearList(document.getElementById('shield-list'), 'shield');
    bindCardTips(equippedDiv);
    bindCardTips(availableList);
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
    const shields = withShields ? groupInventoryEntries(sortedEntries(inventory.map((it, index) => ({ it, index })).filter(({ it }) => it.type === 'shield'), 'items-sort')) : [];
    if(!(withShields && wornShield) && shields.length === 0) return;
    const section = document.createElement('div');
    section.innerHTML = '<h3 class="shop-section-title">Boucliers</h3>';
    // Écarts d'un bouclier du sac avec celui qui est porté (défense, attaque, absorption).
    const deltas = it => equipDeltaGroupsHtml(player, 'item', it);   // vs ce qui est en main gauche (bouclier, arme ou rien)
    const row = (it, { current, locked, label, onclick, title, sellTag, count = 1 }) => {
        const d = current ? '' : deltas(it);
        const tip = cardTipHtml(escapeHtml(it.name), [escapeHtml(shieldStats(it))], escapeHtml(it.description || ''));
        const primary = `<button type="button" class="rc-btn${current ? ' rc-btn-alt' : ''}" ${locked ? 'disabled' : ''}${title ? ` title="${escapeHtml(title)}"` : ''} onclick="${onclick}">${label}</button>`;
        return rowCardHtml({
            key: `sh:${it.id || it.name}${current ? ':worn' : ''}`,
            cls: `${current ? 'rc-equipped' : ''}${locked ? ' is-locked' : ''}`,
            border: getRarityColor(it.rarity),
            name: `${svgIcon('shield')} ${escapeHtml(it.name)}`,
            badges: (current ? badgeHtml('Gauche', 'rc-badge-on') : '') + (count > 1 ? badgeHtml(`×${count}`) : ''),
            sub: d || `<span class="rc-stats">${it.defense ? `Déf +${it.defense}` : ''}${it.atkBonus ? ` Atk +${it.atkBonus}` : ''}${it.absorbDamage ? ` Abs. ${it.absorbDamage}` : ''}</span>`,
            primary,
            more: compareButtonHtml('item', it.id) + (sellTag ? sellTagButton(it, count) : ''),
            tip
        });
    };
    let html = '';
    if(withShields && wornShield) html += row(wornShield, { current: true, label: 'Retirer', onclick: "window.unequipGear('leftHand')" });
    shields.forEach(({ it, index, count }) => {
        const locked = player.level < (it.minLevel || 1);
        html += row(it, { sellTag: true, count, locked, label: locked ? `Niv. ${it.minLevel}` : 'Équiper', title: !locked && player.equipment?.rightHand?.twoHanded ? `${player.equipment.rightHand.name} (deux mains) sera retirée` : '', onclick: `window.equipGear(${index})` });
    });
    section.insertAdjacentHTML('beforeend', html);
    container.appendChild(section);
    bindCardTips(section);
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
    shiftActiveItemIndexes(player, inventoryIndex);
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
        else { g.count++; if(e.index === player.activeInventoryIndex || e.index === player.activeInventoryIndex2) g.index = e.index; }
    });
    return [...groups.values()];
}
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

    // Les boucliers (portés ou en réserve) sont gérés dans l'onglet Armes : le sac ne liste que les objets, une seule fois chacun.
    if(!player.inventory || !player.inventory.some(item => item.type !== 'shield')){
        inventoryList.innerHTML = emptyRowHtml(svgIcon('box'), 'aucun objet dans le sac');
        return;
    }

    const entries = groupInventoryEntries(sortedEntries(player.inventory.map((item, index) => ({ it: item, index })).filter(({ it }) => it.type !== 'shield'), 'items-sort'));
    const activeItem = getActiveInventoryItem();
    const inCombat = gameState.combatState === 'active';
    const secondName = getSecondActiveInventoryItem()?.name;
    const hint = `<p class="rc-hint" style="margin:0 0 6px;font-size:12px;opacity:.75">Au combat : <b>2 objets</b> au plus (objet 1${secondName ? ` : ${escapeHtml(activeItem?.name || '—')} • objet 2 : ${escapeHtml(secondName)}` : ' ; un 2e emplacement est libre'}). « Activer » équipe l'objet, « ⋯ » choisit l'emplacement.</p>`;
    inventoryList.innerHTML = hint + entries.map(({ it: item, index, count }) => {
        const slot = index === player.activeInventoryIndex ? 1 : index === player.activeInventoryIndex2 ? 2 : 0;   // objet actif n°1 / n°2
        const isActive = slot > 0;
        const usable = item.type === 'consumable' || item.type === 'reusable';
        const levelLocked = player.level < (item.minLevel || 1);
        const charges = item.type === 'reusable' ? `${item.chargesLeft ?? item.chargesPerCycle}/${item.chargesPerCycle}` : '';
        // Écarts avec l'objet actif (seulement entre objets d'usage qui ont un effet en commun), sinon la première phrase de l'effet.
        const deltas = !isActive && usable && sharesEffect(item, activeItem) ? deltaBadgesHtml(itemNumbers(item), itemNumbers(activeItem), ITEM_DELTA_FIELDS) : '';
        const chips = (usable ? `<span class="rc-chip">${item.actionPoints || 2} ${svgIcon('arrow')}</span>` : '') + (charges ? `<span class="rc-chip" title="Charges">${charges}</span>` : '');
        // Deux objets actifs : « Activer » prend la place libre (sinon remplace l'objet 2) ; le menu « ⋯ » permet de choisir l'emplacement.
        // Deux objets du même nom ne se partagent pas les deux emplacements.
        const sameAsOther = usable && !isActive && [player.activeInventoryIndex, player.activeInventoryIndex2].some(i => Number.isInteger(i) && player.inventory[i]?.id === item.id);
        const freeSlot = activeItem ? 2 : 1;
        const activateTitle = levelLocked ? `Nécessite le niveau ${item.minLevel}` : inCombat ? "Impossible de changer d'objet actif pendant le combat" : sameAsOther ? 'Un objet identique est déjà actif' : `Équiper en objet ${freeSlot}`;
        const primary = slot === 2
            ? `<button type="button" class="rc-btn rc-btn-alt" ${inCombat ? 'disabled' : ''} onclick="window.unsetSecondItem()">Retirer</button>`
            : isActive ? '' : `<button type="button" class="rc-btn" ${levelLocked || inCombat || sameAsOther ? 'disabled' : ''} title="${escapeHtml(activateTitle)}" onclick="window.setActiveInventoryItem(${index}, ${freeSlot})">${levelLocked ? `Niv. ${item.minLevel}` : 'Activer'}</button>`;
        const slotChoice = usable && !isActive && !levelLocked && !inCombat && !sameAsOther && activeItem
            ? `<button type="button" class="item-discard-btn" onclick="window.setActiveInventoryItem(${index}, 1)">En objet 1</button>` : '';
        const more = slotChoice + sellTagButton(item, count) + `<button type="button" class="item-discard-btn" onclick="window.discardInventoryItem(${index})">Jeter</button>`;
        const tip = cardTipHtml(escapeHtml(item.name), [
            usable ? `${item.actionPoints || 2} ${svgIcon('arrow')}${item.type === 'reusable' ? ` • Charges ${charges}${(item.chargesLeft ?? item.chargesPerCycle) <= 0 ? ` (${escapeHtml(describeRecharge(item))})` : ''}` : ''}` : 'Relique permanente',
            count > 1 ? `Exemplaires : ${count}` : ''
        ], escapeHtml(item.description || ''));
        return rowCardHtml({
            key: `i:${itemGroupKey(item)}`,
            cls: `${isActive ? 'rc-equipped' : ''}${levelLocked ? ' is-locked' : ''}`,
            border: getRarityColor(item.rarity),
            name: `${getItemIcon(item)} ${escapeHtml(item.name)}`,
            badges: (count > 1 ? badgeHtml(`×${count}`) : '') + (isActive ? badgeHtml(`Objet ${slot}`, 'rc-badge-on') : ''),
            sub: chips + (deltas ? `<span class="card-deltas" title="Par rapport à l'objet actif">${deltas}</span>` : `<span class="rc-short">${escapeHtml(shortText(item.description))}</span>`),
            primary, more, tip
        });
    }).join('');
    bindCardTips(inventoryList);
}

// Chiffres comparables d'un objet d'usage (effets numériques + points d'action) pour les écarts avec l'objet actif.
const ITEM_DELTA_FIELDS = [['heal', 'PV'], ['mana', 'qì'], ['tempAttack', 'Atk'], ['tempDefense', 'Déf'], ['actionPoints', 'PA', 'low']];
const itemNumbers = item => item ? { id: item.id, actionPoints: item.actionPoints || 2, ...Object.fromEntries(ITEM_DELTA_FIELDS.map(([k]) => [k, Number(item.effect?.[k]) || 0])) } : null;
const sharesEffect = (a, b) => !!a && !!b && ITEM_DELTA_FIELDS.some(([k]) => k !== 'actionPoints' && a.effect?.[k] && b.effect?.[k]);

export function updateItemButton(){
    const container = document.getElementById('item-button');
    if(!container) return;
    container.innerHTML = '';
    normalizeActiveInventoryIndex();

    if(!player.inventory || player.inventory.length === 0) return;

    // Objet 1 puis objet 2 (s'il y en a un) : un bouton chacun, au-dessus des sorts.
    [[getActiveInventoryItem(), player.activeInventoryIndex], [getSecondActiveInventoryItem(), player.activeInventoryIndex2]].forEach(([item, index]) => {
        if(item) container.appendChild(buildItemButton(item, index));
    });
}

function buildItemButton(item, index){
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
        return div;
    }

    const pa = item.actionPoints || 2;
    const exhausted = item.type === 'reusable' && (item.chargesLeft ?? item.chargesPerCycle) <= 0;
    const healUseless = isUselessHeal(item);
    const sealed = (player.statusEffects?.sealed || 0) > 0;   // Talisman de Scellement : cadenas, objet inutilisable
    const canUse = gameState.combatState === 'active' && currentTurn === 'player' && player.combatPoints >= pa && !exhausted && !healUseless && !sealed;

    const btn = document.createElement('div');
    btn.className = 'enemy-spell-item';
    btn.tabIndex = 0;
    btn.innerHTML = `
        <div class="spell-name">${svgIcon(sealed ? 'lock' : 'bag')} ${item.name}</div>
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
        btn.onclick = () => useInventoryItem(item.id, index);
        btn.onkeydown = (event) => {
            if(event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                useInventoryItem(item.id, index);
            }
        };
    }
    return btn;
}

// Choisit l'objet actif n°1 ou n°2 (hors combat). Choisir un objet déjà actif dans l'autre emplacement échange les deux ;
// l'objet 2 doit être un objet d'usage différent du n°1.
export function setActiveInventoryItem(index, slot = 1){
    if(gameState.combatState === 'active'){
        log('Vous ne pouvez pas changer d\'objet actif pendant le combat !');
        return;
    }
    if(!Array.isArray(player.inventory) || player.inventory.length === 0) return;
    if(!Number.isInteger(index) || index < 0 || index >= player.inventory.length) return;
    const chosen = player.inventory[index];
    if(chosen.type === 'shield') return;
    if(player.level < (chosen.minLevel || 1)){ log(`Nécessite niveau ${chosen.minLevel} pour utiliser ${chosen.name}.`); return; }
    const key = slot === 2 ? 'activeInventoryIndex2' : 'activeInventoryIndex';
    const otherKey = slot === 2 ? 'activeInventoryIndex' : 'activeInventoryIndex2';
    if(player[key] === index) return;
    if(player[otherKey] === index){   // déjà dans l'autre emplacement : on échange
        player[otherKey] = player[key] ?? null;
        player[key] = index;
    } else {
        const other = Number.isInteger(player[otherKey]) ? player.inventory[player[otherKey]] : null;
        if(other && other.id === chosen.id){ log(`${chosen.name} est déjà équipé dans l'autre emplacement.`); return; }
        if(slot === 2 && chosen.type === 'artifact') return;
        player[key] = index;
    }
    normalizeActiveInventoryIndex();
    log(`Objet ${slot === 2 ? 2 : 1} : ${chosen.name}.`);
    updateInventoryTab();
    updateItemButton();
    saveUpdate();
}

// Libère l'emplacement de l'objet n°2 (hors combat).
export function unsetSecondItem(){
    if(gameState.combatState === 'active'){ log('Vous ne pouvez pas changer d\'objet actif pendant le combat !'); return; }
    if(!Number.isInteger(player.activeInventoryIndex2)) return;
    const item = player.inventory[player.activeInventoryIndex2];
    player.activeInventoryIndex2 = null;
    if(item) log(`${item.name} n'est plus équipé.`);
    updateInventoryTab();
    updateItemButton();
    saveUpdate();
}

// Objet de pur soin inutile quand les PV sont déjà au maximum
function isUselessHeal(item){
    const keys = Object.keys(item?.effect || {});
    if(keys.length === 1 && keys[0] === 'cure') return afflictionsOf(player, item.effect.cure === 'all' ? undefined : item.effect.cure).length === 0;   // remède : rien à guérir
    return keys.length === 1 && keys[0] === 'heal' && player.hp >= player.maxHp;
}

export function useInventoryItem(itemId, index){
    if(gameState.combatState !== 'active'){ log("Aucun combat en cours."); return; }
    if(currentTurn !== 'player'){ log("Ce n'est pas votre tour."); return; }
    if(rejectRushedAction()) return;
    if((player.statusEffects?.sealed || 0) > 0){ log("Vous êtes scellé : impossible d'utiliser un objet."); return; }

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
    if(isUselessHeal(item)){ log(item.effect?.cure ? "Vous ne souffrez d'aucune altération que cet objet guérit." : "Vos PV sont déjà au maximum."); return; }

    const pa = item.actionPoints || 2;
    if(player.combatPoints < pa){
        log(`Il faut ${pa} points d'action pour utiliser ${item.name}.`);
        return;
    }

    actionGuard.markPlayerAction();
    player.combatPoints -= pa;
    const result = useItem(itemId, player, enemy, resolvedIndex);
    if(result.success){
        if(item.effect?.cure) playSfx('cure');
        logActiveAction(`utilise l'objet ${item.name} (cout ${pa} PA)`);
        log(result.message);
        // Animation d'utilisation (comme un sort ou une arme) : nom de l'objet et ses effets, au-dessus du plateau.
        showCombatAnimation({ icon: getItemIcon(item), title: item.name, heal: String(result.message || '').trim() || null, target: '→ Vous' }, true);
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
    shiftActiveItemIndexes(player, targetIndex);
    normalizeActiveInventoryIndex();
    log(`Vous avez jeté ${item.name}.`);
    updateInventoryTab();
    updateItemButton();
    saveUpdate();
}
