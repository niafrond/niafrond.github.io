// Système d'équipement multi-slot (main droite, main gauche, objet)

/**
 * Structure de l'équipement du joueur
 * @typedef {Object} Equipment
 * @property {Object|null} rightHand - Arme/objet équipé en main droite
 * @property {Object|null} leftHand - Arme/bouclier équipé en main gauche
 * @property {Object|null} item - Objet équipé (potion réutilisable, relique portable)
 */

/**
 * Initialise l'équipement du joueur avec les valeurs par défaut
 */
export function initializeEquipment() {
    return {
        rightHand: null,
        leftHand: null,
        item: null
    };
}

/**
 * Détermine les slots valides pour un objet donné
 * @param {Object} obj - L'objet à vérifier (arme, bouclier, etc.)
 * @returns {string[]} Les slots où cet objet peut être équipé
 */
export function getValidSlots(obj) {
    if (!obj) return [];

    if (obj.type === 'shield') {
        return ['leftHand'];
    }

    if (obj.type === 'weapon') {
        if (obj.twoHanded) {
            return ['rightHand', 'leftHand'];
        }
        return ['rightHand', 'leftHand'];
    }

    if (obj.type === 'reusable' || obj.type === 'consumable') {
        return ['item'];
    }

    return [];
}

/**
 * Vérifie si un objet peut être équipé dans un slot donné
 * @param {Object} obj - L'objet à vérifier
 * @param {string} slot - Le slot cible ('rightHand', 'leftHand', 'item')
 * @returns {boolean}
 */
export function canEquip(obj, slot) {
    if (!obj || !slot) return false;

    // Les boucliers ne vont qu'en main gauche
    if (obj.type === 'shield' && slot !== 'leftHand') {
        return false;
    }

    // Les armes à deux mains occupent les deux mains
    if (obj.type === 'weapon' && obj.twoHanded && slot !== 'rightHand' && slot !== 'leftHand') {
        return false;
    }

    // Les objets consommables/rechargeables vont dans le slot item
    if ((obj.type === 'reusable' || obj.type === 'consumable') && slot !== 'item') {
        return false;
    }

    return getValidSlots(obj).includes(slot);
}

/**
 * Équipe un objet dans un slot donné
 * @param {Object} player - L'objet joueur
 * @param {Object} obj - L'objet à équiper
 * @param {string} slot - Le slot cible
 * @returns {Object} Le résultat { success, message, unequipped }
 */
export function equip(player, obj, slot) {
    if (!obj || !slot) {
        return { success: false, message: 'Objet ou slot invalide' };
    }

    if (!canEquip(obj, slot)) {
        return { success: false, message: 'Cet objet ne peut pas être équipé dans ce slot' };
    }

    // Si c'est une arme à deux mains en main droite, retirer la main gauche
    if (obj.type === 'weapon' && obj.twoHanded && slot === 'rightHand') {
        const unequipped = player.equipment.leftHand;
        player.equipment.leftHand = null;
        player.equipment.rightHand = obj;
        return {
            success: true,
            message: `${obj.name} équipée (arme à deux mains)`,
            unequipped
        };
    }

    // Si on équipe un bouclier en main gauche et qu'il y a une arme à deux mains à droite
    if (obj.type === 'shield' && slot === 'leftHand') {
        if (player.equipment.rightHand?.twoHanded) {
            return {
                success: false,
                message: 'Impossible: une arme à deux mains est déjà équipée'
            };
        }
    }

    // Remplacer l'équipement existant
    const unequipped = player.equipment[slot];
    player.equipment[slot] = obj;

    return {
        success: true,
        message: `${obj.name} équipé${slot === 'rightHand' ? ' en main droite' : slot === 'leftHand' ? ' en main gauche' : ''}`,
        unequipped
    };
}

/**
 * Déséquipe un objet d'un slot
 * @param {Object} player - L'objet joueur
 * @param {string} slot - Le slot à dépouiller
 * @returns {Object} L'objet qui était équipé, ou null
 */
export function unequip(player, slot) {
    const unequipped = player.equipment[slot];
    player.equipment[slot] = null;
    return unequipped;
}

/**
 * Récupère l'objet équipé dans un slot
 * @param {Object} player - L'objet joueur
 * @param {string} slot - Le slot à vérifier
 * @returns {Object|null}
 */
export function getEquipped(player, slot) {
    return player.equipment?.[slot] || null;
}

/**
 * Obtient tous les objets équipés
 * @param {Object} player - L'objet joueur
 * @returns {Object[]} Tableau des équipements actuels
 */
export function getAllEquipped(player) {
    const equipped = [];
    if (player.equipment.rightHand) equipped.push(player.equipment.rightHand);
    if (player.equipment.leftHand) equipped.push(player.equipment.leftHand);
    if (player.equipment.item) equipped.push(player.equipment.item);
    return equipped;
}

/**
 * Calcule les bonus de défense des objets équipés
 * @param {Object} player - L'objet joueur
 * @returns {number} Bonus de défense total
 */
export function getEquipmentDefenseBonus(player) {
    let bonus = 0;

    if (player.equipment.rightHand?.defense) {
        bonus += player.equipment.rightHand.defense;
    }
    if (player.equipment.leftHand?.defense) {
        bonus += player.equipment.leftHand.defense;
    }
    if (player.equipment.item?.defense) {
        bonus += player.equipment.item.defense;
    }

    return bonus;
}

/**
 * Applique les bonus permanents des équipements
 * @param {Object} player - L'objet joueur
 */
export function applyEquipmentBonuses(player) {
    if (!player.equipment) return;

    // Bonus de défense de l'équipement
    const defenseBonus = getEquipmentDefenseBonus(player);
    player.defense = (player.defense || 0) + defenseBonus;

    // Bonus d'attaque des armes (déjà appliqué lors de la création du joueur)
    // À traiter si nécessaire
}
