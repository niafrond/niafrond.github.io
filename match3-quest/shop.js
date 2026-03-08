// =====================================
// Boutique
// =====================================

import { allWeapons } from './weapons.js';
import { allItems, getRarityEmoji, getRarityColor } from './items.js';
import { player, gameState, log, updateAvailableWeapons, saveUpdate, getWeaponIcon } from './game.js';

function getWeaponPrice(weapon) {
    return Math.floor(weapon.minLevel * 15 + weapon.damage * 2);
}

const ITEM_RARITY_PRICE = { common: 5, uncommon: 12, rare: 30, legendary: 80 };
function getItemPrice(item) {
    return Math.floor(item.minLevel * (ITEM_RARITY_PRICE[item.rarity] || 5));
}

export function buyWeapon(weaponId) {
    if (gameState.combatState === 'active') {
        log('⚠️ La boutique est inaccessible pendant le combat !');
        return;
    }
    const weapon = allWeapons.find(w => w.id === weaponId);
    if (!weapon) return;

    const price = getWeaponPrice(weapon);
    if (player.gold < price) {
        log(`⚠️ Pas assez d'or ! Coût: ${price} 💰, vous avez: ${player.gold} 💰`);
        return;
    }

    player.gold -= price;
    player.weapons.push(weapon);
    updateAvailableWeapons();
    saveUpdate();
    log(`🛒 ${weapon.name} achetée pour ${price} pièces d'or !`);
    updateShopTab();
}

export function buyItem(itemId) {
    if (gameState.combatState === 'active') {
        log('⚠️ La boutique est inaccessible pendant le combat !');
        return;
    }
    const item = allItems.find(i => i.id === itemId);
    if (!item) return;

    if (player.inventory && player.inventory.length > 0) {
        log('⚠️ Votre inventaire est plein ! Jetez votre objet actuel d\'abord.');
        return;
    }

    const price = getItemPrice(item);
    if (player.gold < price) {
        log(`⚠️ Pas assez d'or ! Coût: ${price} 💰, vous avez: ${player.gold} 💰`);
        return;
    }

    player.gold -= price;
    if (!player.inventory) player.inventory = [];
    player.inventory.push({ ...item });
    saveUpdate();
    log(`🛒 ${item.name} acheté pour ${price} pièces d'or !`);
    updateShopTab();
}

export function updateShopTab() {
    const shopContent = document.getElementById('shop-content');
    const shopGold = document.getElementById('shop-gold');
    if (!shopContent) return;
    if (shopGold) shopGold.textContent = player.gold;

    shopContent.innerHTML = '';

    // === Section Armes ===
    const minLvl = Math.max(1, player.level - 2);
    const maxLvl = player.level + 4;
    const damageThreshold = player.level * 4;
    const shopWeapons = allWeapons
        .filter(w => {
            if (player.weapons && player.weapons.some(owned => owned.id === w.id)) return false;
            if (w.minLevel < minLvl || w.minLevel > maxLvl) return false;
            if (w.minLevel < player.level && w.damage < damageThreshold) return false;
            return true;
        })
        .sort((a, b) => a.minLevel - b.minLevel);

    const weaponsSection = document.createElement('div');
    weaponsSection.innerHTML = '<h3 class="shop-section-title">⚔️ Armes</h3>';

    if (shopWeapons.length === 0) {
        weaponsSection.innerHTML += '<p class="shop-empty">Aucune nouvelle arme disponible pour votre niveau.</p>';
    } else {
        shopWeapons.forEach(weapon => {
            const price = getWeaponPrice(weapon);
            const canAfford = player.gold >= price;
            const icon = getWeaponIcon(weapon.type);

            const div = document.createElement('div');
            div.className = 'weapon-item shop-weapon';
            div.innerHTML = `
                <span class="weapon-icon">${icon}</span>
                <div class="weapon-details">
                    <span class="weapon-name">${weapon.name}</span>
                    <span class="weapon-stats">${weapon.damage} 💀 • ${weapon.actionPoints} ⚔️ • Niv. ${weapon.minLevel}</span>
                    <span class="weapon-description">${weapon.description}</span>
                </div>
                <div class="shop-weapon-right">
                    <span class="shop-price-tag">${price} 💰</span>
                    <button class="weapon-action"
                        ${!canAfford ? 'disabled' : ''}
                        onclick="window.buyWeapon('${weapon.id}')">
                        ${canAfford ? '🛒 Acheter' : '❌ Insuff.'}
                    </button>
                </div>
            `;
            weaponsSection.appendChild(div);
        });
    }
    shopContent.appendChild(weaponsSection);

    // === Section Objets ===
    const inventoryFull = player.inventory && player.inventory.length > 0;
    const shopItems = allItems
        .filter(i => i.minLevel <= player.level + 2)
        .sort((a, b) => a.minLevel - b.minLevel);

    const itemsSection = document.createElement('div');
    itemsSection.innerHTML = '<h3 class="shop-section-title">🎒 Objets</h3>';
    if (inventoryFull) {
        itemsSection.innerHTML += '<p class="shop-empty">Inventaire plein — jetez votre objet actuel pour en acheter un.</p>';
    }

    shopItems.forEach(item => {
        const price = getItemPrice(item);
        const canAfford = player.gold >= price;
        const rarityEmoji = getRarityEmoji(item.rarity);
        const rarityColor = getRarityColor(item.rarity);

        const div = document.createElement('div');
        div.className = 'weapon-item shop-weapon';
        div.style.borderLeft = `3px solid ${rarityColor}`;
        div.innerHTML = `
            <span class="weapon-icon">${rarityEmoji}</span>
            <div class="weapon-details">
                <span class="weapon-name">${item.name}</span>
                <span class="weapon-stats">${item.type === 'consumable' ? `${item.actionPoints} ⚔️` : '⚡ Passif'} • Niv. ${item.minLevel}</span>
                <span class="weapon-description">${item.description}</span>
            </div>
            <div class="shop-weapon-right">
                <span class="shop-price-tag">${price} 💰</span>
                <button class="weapon-action"
                    ${inventoryFull || !canAfford ? 'disabled' : ''}
                    onclick="window.buyItem('${item.id}')">
                    ${inventoryFull ? '🔒 Plein' : canAfford ? '🛒 Acheter' : '❌ Insuff.'}
                </button>
            </div>
        `;
        itemsSection.appendChild(div);
    });
    shopContent.appendChild(itemsSection);
}
