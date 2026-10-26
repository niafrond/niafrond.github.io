import { flyManaGain, flyHeal } from './manaFlight.js';
import { manaIcon } from './icons.js';
import { canEquip, equip, unequip } from './equipment.js';

// Système d'objets et inventaire

// Bibliothèque de tous les objets disponibles
export const allItems = [
    // === BOUCLIERS ===
    {id:"jade_shield", name:"Bouclier de Jade", type:"shield", minLevel:5, rarity:"uncommon",
     description:"Un bouclier poli en jade, renforce la défense (blocage) de 10", defense:10},
    {id:"dragon_shield", name:"Bouclier du Dragon Blanc", type:"shield", minLevel:10, rarity:"rare",
     description:"Un bouclier gravé du dragon blanc, défense +20, critique +5", defense:20, atkBonus:5},
    {id:"ancestral_shield", name:"Rondache Ancestrale", type:"shield", minLevel:15, rarity:"rare",
     description:"Un bouclier ancien renforcé par le temps, défense +28, absorbe 70 dégâts par combat", defense:28, absorbDamage:70},
    {id:"legendary_shield", name:"Bouclier de l'Empereur Jaune", type:"shield", minLevel:18, rarity:"legendary",
     description:"Le bouclier mythique de l'Empereur Jaune, défense +42, critique +10, absorbe 150 dégâts", defense:42, atkBonus:10, absorbDamage:150},

    // === OBJETS RECHARGEABLES ===
    {id:"honey_vial", name:"Flacon de Miel Magique", type:"reusable", minLevel:3, rarity:"uncommon", chargesPerCycle:2, rechargeTurns:8,
     description:"Soigne 25 HP par utilisation (2 usages, puis rechargé en 8 tours)", effect:{heal:25}},
    {id:"protective_sachet", name:"Sachet d'Encens Protecteur", type:"reusable", minLevel:6, rarity:"uncommon", chargesPerCycle:1, rechargeTurns:5,
     description:"Augmente la défense de 10 pour ce combat, sans cumul (rechargé en 5 tours)", effect:{tempDefense:10}},
    {id:"energy_stone", name:"Pierre d'Énergie Ravivante", type:"reusable", minLevel:8, rarity:"rare", chargesPerCycle:2, rechargeTurns:8,
     description:"Restaure 9 qì de chaque couleur (2 usages, puis rechargé en 8 tours)", effect:{mana:9}},
    {id:"power_talisman", name:"Talisman de Puissance", type:"reusable", minLevel:12, rarity:"rare", chargesPerCycle:1, rechargeTurns:6,
     description:"Augmente l'attaque de 25 pour ce combat, sans cumul (rechargé en 6 tours)", effect:{tempAttack:25}},

    // Élixirs, pilules et tisanes (niveau 1+)
    {id:"healthPotion", name:"Élixir de Vie", type:"reusable", minLevel:1, rarity:"common", actionPoints:1, chargesPerCycle:1, rechargeTurns:6,
     description:"Restaure 35 HP (rechargé en 6 tours)", effect:{heal:35}},
    {id:"manaPotion", name:"Pilule de Qi", type:"reusable", minLevel:1, rarity:"common", actionPoints:1, chargesPerCycle:1, rechargeTurns:6,
     description:"Restaure 6 qì de chaque couleur (rechargé en 6 tours)", effect:{mana:6}},
    {id:"strengthPotion", name:"Pilule de Vigueur", type:"reusable", minLevel:3, rarity:"uncommon", actionPoints:2, chargesPerCycle:1, rechargeTurns:4,
     description:"Augmente l'attaque de 15 pour ce combat, sans cumul (rechargé en 4 tours)", effect:{tempAttack:15}},
    
    // Préparations avancées (niveau 5+)
    {id:"greaterHealthPotion", name:"Grand Élixir de Vie", type:"reusable", minLevel:5, rarity:"uncommon", actionPoints:2, chargesPerCycle:1, rechargeTurns:8,
     description:"Restaure 60 HP (rechargé en 8 tours)", effect:{heal:60}},
    {id:"greaterManaPotion", name:"Grande Pilule de Qi", type:"reusable", minLevel:5, rarity:"uncommon", actionPoints:2, chargesPerCycle:1, rechargeTurns:7,
     description:"Restaure 10 qì de chaque couleur (rechargé en 7 tours)", effect:{mana:10}},
    {id:"defensePotion", name:"Talisman de Garde", type:"reusable", minLevel:6, rarity:"uncommon", actionPoints:2, chargesPerCycle:1, rechargeTurns:4,
     description:"Augmente la défense de 12 pour ce combat, sans cumul (rechargé en 4 tours)", effect:{tempDefense:12}},
    
    // Préparations rares (niveau 10+)
    {id:"elixirOfPower", name:"Élixir du Dragon et du Tigre", type:"reusable", minLevel:10, rarity:"rare", actionPoints:3, chargesPerCycle:1, rechargeTurns:5,
     description:"Augmente attaque de 15 et défense de 12 pour ce combat, sans cumul (rechargé en 5 tours)", effect:{tempAttack:15, tempDefense:12}},
    {id:"phoenixFeather", name:"Plume de Fenghuang", type:"reusable", minLevel:12, rarity:"rare", actionPoints:1, chargesPerCycle:1, rechargeTurns:8,
     description:"Ressuscite avec 50% HP si vous mourrez, une fois par combat (rechargé en 8 tours)", effect:{revive:0.5}},
    
    // Reliques permanentes (niveau 8+)
    {id:"ringOfVitality", name:"Bracelet de Jade Vital", type:"artifact", minLevel:8, rarity:"rare",
     description:"Augmente HP max de 40 (permanent)", effect:{permMaxHp:40}},
    {id:"amuletOfPower", name:"Amulette du Tigre Blanc", type:"artifact", minLevel:10, rarity:"rare",
     description:"Augmente attaque de 8 (permanent)", effect:{permAttack:8}},
    {id:"shieldCharm", name:"Charme de la Tortue Noire", type:"artifact", minLevel:12, rarity:"rare",
     description:"Augmente défense de 8 (permanent)", effect:{permDefense:8}},
    
    // Objets légendaires (niveau 15+)
    {id:"crownOfTheArchmage", name:"Couronne de Perles de l'Immortel", type:"artifact", minLevel:15, rarity:"legendary",
     description:"Augmente le qì max de 30 (permanent)", effect:{permMaxMana:30}},
    {id:"dragonHeart", name:"Perle du Dragon", type:"artifact", minLevel:17, rarity:"legendary",
     description:"Augmente HP max de 80 et attaque de 15 (permanent)", effect:{permMaxHp:80, permAttack:15}},

     {id:"ringOfPrecision", name:"Bague d'Archer en Jade", type:"artifact", minLevel:9, rarity:"rare",
 description:"Augmente les chances de critique de 8% (permanent)", effect:{permCritChance:8}},

{id:"bootsOfSwiftness", name:"Sandales du Vent Léger", type:"artifact", minLevel:11, rarity:"rare",
 description:"Commence chaque combat avec +1 point d'action", effect:{permStartActionPoints:1}},

{id:"orbOfWisdom", name:"Orbe de Jade de Sagesse", type:"artifact", minLevel:12, rarity:"rare",
 description:"Augmente le qì max de 15 (permanent)", effect:{permMaxMana:15}},
 {id:"timeWarpPotion", name:"Pilule du Temps Suspendu", type:"reusable", minLevel:11, rarity:"rare", actionPoints:2, chargesPerCycle:1, rechargeTurns:8,
 description:"Jouez immédiatement un tour supplémentaire (rechargé en 8 tours)", effect:{extraTurn:1}},

{id:"vampiricPotion", name:"Vin Écarlate du Dragon", type:"reusable", minLevel:10, rarity:"rare", actionPoints:2, chargesPerCycle:1, rechargeTurns:5,
 description:"Vous récupérez 40% des dégâts infligés en HP pour ce combat, sans cumul (rechargé en 5 tours)", effect:{lifesteal:0.4}},

{id:"arcaneSurgePotion", name:"Élixir de Déferlement du Qi", type:"reusable", minLevel:12, rarity:"rare", actionPoints:3, chargesPerCycle:1, rechargeTurns:8,
 description:"Double le qì gagné pendant 3 tours (rechargé en 8 tours)", effect:{manaMultiplier:2, duration:3}},
 {id:"berserkPotion", name:"Vin de la Fureur", type:"reusable", minLevel:6, rarity:"uncommon", actionPoints:2, chargesPerCycle:1, rechargeTurns:4,
 description:"Augmente attaque de 25 mais réduit défense de 10 pour ce combat, sans cumul (rechargé en 4 tours)", effect:{tempAttack:25, tempDefense:-10}},

{id:"clarityPotion", name:"Thé de Clarté d'Esprit", type:"reusable", minLevel:5, rarity:"uncommon", actionPoints:1, chargesPerCycle:1, rechargeTurns:5,
 description:"Restaure 18 qì d'une couleur aléatoire (rechargé en 5 tours)", effect:{randomMana:18}},

{id:"stoneSkinPotion", name:"Pilule de Peau de Bronze", type:"reusable", minLevel:7, rarity:"uncommon", actionPoints:2, chargesPerCycle:1, rechargeTurns:4,
 description:"Réduit les dégâts subis de 25% pour ce combat, sans cumul (rechargé en 4 tours)", effect:{damageReduction:0.25}},
 {id:"focusPotion", name:"Infusion de Concentration", type:"reusable", minLevel:2, rarity:"common", actionPoints:1, chargesPerCycle:1, rechargeTurns:3,
 description:"Augmente les chances de critique de 15% pour ce combat, sans cumul (rechargé en 3 tours)", effect:{critChance:15}},

{id:"swiftPotion", name:"Pilule de Célérité", type:"reusable", minLevel:2, rarity:"common", actionPoints:1, chargesPerCycle:1, rechargeTurns:4,
 description:"Accorde 2 points d'action supplémentaires ce tour (rechargé en 4 tours)", effect:{gainActionPoints:2}},

{id:"regenPotion", name:"Gourde de Tisane Médicinale", type:"reusable", minLevel:3, rarity:"common", actionPoints:2, chargesPerCycle:1, rechargeTurns:6,
 description:"Restaure 8 HP par tour pendant 3 tours (rechargé en 6 tours)", effect:{regen:8, duration:3}},

    // === OBJETS DE HAUT NIVEAU (au-delà du niveau 18) ===
    // L'attaque et la défense étant des chances plafonnées à 98 %, les paliers misent sur les PV, le qì, les soins et la réduction de dégâts.
    // Boucliers
    {id:"qilin_shield", name:"Rondache du Qilin", type:"shield", minLevel:28, rarity:"rare",
     description:"Un bouclier orné du Qilin, défense +45, critique +8, absorbe 150 dégâts", defense:45, atkBonus:8, absorbDamage:150},
    {id:"golden_tortoise_aegis", name:"Égide de la Tortue d'Or", type:"shield", minLevel:45, rarity:"legendary",
     description:"L'égide de la Tortue d'Or, défense +55, critique +12, absorbe 300 dégâts", defense:55, atkBonus:12, absorbDamage:300},
    {id:"celestial_mandate_shield", name:"Bouclier du Mandat Céleste", type:"shield", minLevel:60, rarity:"legendary",
     description:"Le bouclier du Mandat Céleste, défense +65, critique +15, absorbe 500 dégâts", defense:65, atkBonus:15, absorbDamage:500},

    // Soins, qì et effets de combat
    {id:"celestial_jade_elixir", name:"Élixir de Jade Céleste", type:"reusable", minLevel:25, rarity:"rare", actionPoints:2, chargesPerCycle:1, rechargeTurns:8,
     description:"Restaure 90 HP (rechargé en 8 tours)", effect:{heal:90}},
    {id:"celestial_qi_pill", name:"Pilule de Qi Céleste", type:"reusable", minLevel:28, rarity:"rare", actionPoints:2, chargesPerCycle:1, rechargeTurns:7,
     description:"Restaure 14 qì de chaque couleur (rechargé en 7 tours)", effect:{mana:14}},
    {id:"tiger_eye_infusion", name:"Infusion de l'Œil du Tigre", type:"reusable", minLevel:30, rarity:"rare", actionPoints:1, chargesPerCycle:1, rechargeTurns:4,
     description:"Augmente les chances de critique de 25% pour ce combat, sans cumul (rechargé en 4 tours)", effect:{critChance:25}},
    {id:"thousand_springs_tisane", name:"Tisane des Mille Printemps", type:"reusable", minLevel:32, rarity:"rare", actionPoints:2, chargesPerCycle:1, rechargeTurns:6,
     description:"Restaure 25 HP par tour pendant 3 tours (rechargé en 6 tours)", effect:{regen:25, duration:3}},
    {id:"diamond_skin_pill", name:"Pilule de Peau de Diamant", type:"reusable", minLevel:35, rarity:"rare", actionPoints:2, chargesPerCycle:1, rechargeTurns:5,
     description:"Réduit les dégâts subis de 35% pour ce combat, sans cumul (rechargé en 5 tours)", effect:{damageReduction:0.35}},
    {id:"celestial_swiftness_pill", name:"Pilule de Célérité Céleste", type:"reusable", minLevel:38, rarity:"rare", actionPoints:1, chargesPerCycle:1, rechargeTurns:5,
     description:"Accorde 3 points d'action supplémentaires ce tour (rechargé en 5 tours)", effect:{gainActionPoints:3}},
    {id:"imperial_cinnabar_elixir", name:"Élixir de Cinabre Impérial", type:"reusable", minLevel:40, rarity:"rare", actionPoints:2, chargesPerCycle:1, rechargeTurns:8,
     description:"Restaure 140 HP (rechargé en 8 tours)", effect:{heal:140}},
    {id:"imperial_crimson_wine", name:"Vin Écarlate Impérial", type:"reusable", minLevel:42, rarity:"rare", actionPoints:2, chargesPerCycle:1, rechargeTurns:5,
     description:"Vous récupérez 50% des dégâts infligés en HP pour ce combat, sans cumul (rechargé en 5 tours)", effect:{lifesteal:0.5}},
    {id:"golden_phoenix_feather", name:"Plume de Fenghuang Dorée", type:"reusable", minLevel:45, rarity:"legendary", actionPoints:1, chargesPerCycle:1, rechargeTurns:8,
     description:"Ressuscite avec 80% HP si vous mourrez, une fois par combat (rechargé en 8 tours)", effect:{revive:0.8}},
    {id:"frozen_time_pill", name:"Pilule du Temps Figé", type:"reusable", minLevel:48, rarity:"legendary", actionPoints:1, chargesPerCycle:1, rechargeTurns:8,
     description:"Jouez immédiatement un tour supplémentaire (rechargé en 8 tours)", effect:{extraTurn:1}},
    {id:"nine_heavens_pill", name:"Pilule des Neuf Cieux", type:"reusable", minLevel:50, rarity:"legendary", actionPoints:2, chargesPerCycle:1, rechargeTurns:9,
     description:"Restaure 20 qì de chaque couleur (rechargé en 9 tours)", effect:{mana:20}},
    {id:"immortals_nectar", name:"Nectar des Immortels", type:"reusable", minLevel:55, rarity:"legendary", actionPoints:2, chargesPerCycle:1, rechargeTurns:9,
     description:"Restaure 200 HP (rechargé en 9 tours)", effect:{heal:200}},
    {id:"imperial_jade_armor_pill", name:"Pilule d'Armure de Jade Impériale", type:"reusable", minLevel:60, rarity:"legendary", actionPoints:2, chargesPerCycle:1, rechargeTurns:6,
     description:"Réduit les dégâts subis de 45% pour ce combat, sans cumul (rechargé en 6 tours)", effect:{damageReduction:0.45}},

    // Reliques permanentes
    {id:"ancient_jade_heart", name:"Cœur de Jade Antique", type:"artifact", minLevel:22, rarity:"rare",
     description:"Augmente HP max de 60 (permanent)", effect:{permMaxHp:60}},
    {id:"azure_dragon_pendant", name:"Pendentif du Dragon Azur", type:"artifact", minLevel:26, rarity:"rare",
     description:"Augmente le qì max de 25 (permanent)", effect:{permMaxMana:25}},
    {id:"red_phoenix_ring", name:"Anneau du Phénix Rouge", type:"artifact", minLevel:30, rarity:"rare",
     description:"Augmente HP max de 90 (permanent)", effect:{permMaxHp:90}},
    {id:"celestial_tortoise_seal", name:"Sceau de la Tortue Céleste", type:"artifact", minLevel:34, rarity:"rare",
     description:"Augmente défense de 12 (permanent)", effect:{permDefense:12}},
    {id:"piercing_eye_ring", name:"Bague de l'Œil Perçant", type:"artifact", minLevel:38, rarity:"rare",
     description:"Augmente les chances de critique de 10% (permanent)", effect:{permCritChance:10}},
    {id:"imperial_jade_crown", name:"Couronne de Jade Impériale", type:"artifact", minLevel:45, rarity:"legendary",
     description:"Augmente HP max de 150 et le qì max de 40 (permanent)", effect:{permMaxHp:150, permMaxMana:40}},
    {id:"dragon_emperor_pearl", name:"Perle de l'Empereur Dragon", type:"artifact", minLevel:55, rarity:"legendary",
     description:"Augmente HP max de 220 et défense de 10 (permanent)", effect:{permMaxHp:220, permDefense:10}},
    {id:"golden_clouds_boots", name:"Bottes des Nuages Dorés", type:"artifact", minLevel:60, rarity:"legendary",
     description:"Commence chaque combat avec +1 point d'action", effect:{permStartActionPoints:1}},
    {id:"heaven_seal", name:"Sceau du Ciel", type:"artifact", minLevel:65, rarity:"legendary",
     description:"Augmente HP max de 300, le qì max de 60 et les chances de critique de 10% (permanent)", effect:{permMaxHp:300, permMaxMana:60, permCritChance:10}},
];

// Chances de drop selon la rareté
const rarityWeights = {
    common: 60,     // 60% de chance
    uncommon: 30,   // 30% de chance
    rare: 9,        // 9% de chance
    legendary: 1    // 1% de chance
};

// Obtenir un objet aléatoire selon le niveau du joueur
export function getRandomItem(playerLevel) {
    // Filtrer les objets disponibles (niveau du joueur + 2 maximum)
    const availableItems = allItems.filter(item => 
        item.minLevel <= playerLevel + 2 && item.minLevel >= Math.max(1, playerLevel - 3)
    );
    
    if(availableItems.length === 0) {
        // Rien dans la fenêtre de niveau : les meilleurs objets que le joueur peut utiliser (sinon un élixir de niveau 1)
        const usable = allItems.filter(item => item.minLevel <= playerLevel + 2);
        const top = Math.max(0, ...usable.map(item => item.minLevel));
        const best = usable.filter(item => item.minLevel === top);
        return best.length ? best[Math.floor(Math.random() * best.length)] : allItems.find(item => item.id === "healthPotion");
    }
    
    // Calculer le poids total selon la rareté
    const weightedItems = [];
    availableItems.forEach(item => {
        const weight = rarityWeights[item.rarity] || 1;
        for(let i = 0; i < weight; i++) {
            weightedItems.push(item);
        }
    });
    
    // Sélectionner un objet aléatoire
    const randomIndex = Math.floor(Math.random() * weightedItems.length);
    return weightedItems[randomIndex];
}

// Pastille de couleur selon la rareté (icône SVG)
export function getRarityIcon(rarity) {
    const colors = { common: 'white', uncommon: 'green', rare: 'blue', legendary: 'purple' };
    return manaIcon(colors[rarity] || 'white');
}

// Obtenir la couleur selon la rareté
export function getRarityColor(rarity) {
    const colors = {
        common: '#aaa',
        uncommon: '#2ecc71',
        rare: '#3498db',
        legendary: '#9b59b6'
    };
    return colors[rarity] || '#aaa';
}

// Utiliser un objet de l'inventaire
export function useItem(itemId, player, enemy, preferredIndex = null) {
    const isPreferredIndexValid = Number.isInteger(preferredIndex)
        && preferredIndex >= 0
        && preferredIndex < player.inventory.length
        && player.inventory[preferredIndex]?.id === itemId;
    const itemIndex = isPreferredIndexValid
        ? preferredIndex
        : player.inventory.findIndex(item => item.id === itemId);
    if(itemIndex === -1) return {success: false, message: "Objet introuvable"};

    const item = player.inventory[itemIndex];

    // Les artefacts ne peuvent pas être utilisés (ils sont automatiques)
    if(item.type === "artifact") {
        return {success: false, message: "Les reliques sont déjà portées automatiquement"};
    }

    // Les effets valables « pour ce combat » ne se cumulent pas (sinon un objet infini rendrait invincible) :
    // une fois actif, l'objet est refusé jusqu'au prochain combat (restartCombat remet `itemBuffs` à zéro).
    if(item.type === "reusable" && isCombatLongEffect(item.effect)) {
        player.itemBuffs = player.itemBuffs || {};
        if(player.itemBuffs[item.id]) return {success: false, message: "Cet effet est déjà actif pour ce combat"};
    }

    // Plus aucun objet à usage unique : un ancien consommable devient rechargeable avant usage.
    if(item.type === "consumable") toReusable(item);

    // Les objets rechargeables doivent avoir des charges restantes
    if(item.type === "reusable") {
        if(!Number.isInteger(item.chargesLeft)) item.chargesLeft = item.chargesPerCycle;
        if(item.chargesLeft <= 0) {
            const left = Math.max(0, Math.floor(item.rechargeLeft || 0));
            return {success: false, message: left > 0 ? `Cet objet se recharge encore ${left} tour${left > 1 ? 's' : ''}` : "Cet objet doit être rechargé"};
        }
        item.chargesLeft--;
        // Dernière charge utilisée : le compte à rebours de rechargement démarre (pas d'usage unique).
        if(item.chargesLeft <= 0) item.rechargeLeft = getRechargeTurns(item);
    }

    // Les boucliers ne peuvent pas être utilisés (ils sont équipés)
    if(item.type === "shield") {
        return {success: false, message: "Les boucliers doivent être équipés, pas utilisés"};
    }
    
    // Appliquer l'effet de l'objet
    let message = "";
    if(item.effect.heal) {
        player.hp = Math.min(player.maxHp, player.hp + item.effect.heal);
        flyHeal(true, item.effect.heal);
        message += `Vous récupérez ${item.effect.heal} HP. `;
    }
    if(item.effect.mana) {
        flyManaGain(true, Object.fromEntries(Object.keys(player.mana).map(color => [color, item.effect.mana])), { fromId: 'item-button' });
        Object.keys(player.mana).forEach(color => {
            const manaCap = player.manaCaps?.[color] ?? player.maxMana;
            player.mana[color] = Math.min(manaCap, player.mana[color] + item.effect.mana);
        });
        message += `Vous gagnez ${item.effect.mana} qì de chaque couleur. `;
    }
    if(item.effect.tempAttack) {
        player.tempAttack = (player.tempAttack || 0) + item.effect.tempAttack;
        player.attack += item.effect.tempAttack;
        message += `Votre attaque augmente de ${item.effect.tempAttack} pour ce combat. `;
    }
    if(item.effect.tempDefense) {
        player.tempDefense = (player.tempDefense || 0) + item.effect.tempDefense;
        player.defense += item.effect.tempDefense;
        message += `Votre défense augmente de ${item.effect.tempDefense} pour ce combat. `;
    }
    if(item.effect.revive) {
        player.hasRevive = true;
        player.revivePercent = item.effect.revive;
        message += `Vous serez ressuscité si vous mourrez ! `;
    }
    if(item.effect.gainActionPoints) {
        player.combatPoints = (player.combatPoints || 0) + item.effect.gainActionPoints;
        message += `Vous gagnez ${item.effect.gainActionPoints} point(s) d'action. `;
    }
    if(item.effect.extraTurn) {
        const extraTurns = Math.max(1, Math.floor(item.effect.extraTurn));
        const currentBonusTurns = Math.max(0, Math.floor(Number(player.bonusTurn) || 0));
        player.bonusTurn = currentBonusTurns + extraTurns;
        message += `Vous gagnez ${extraTurns} tour${extraTurns > 1 ? 's' : ''} supplémentaire${extraTurns > 1 ? 's' : ''} ! `;
    }
    if(item.effect.randomMana !== undefined) {
        const manaColors = Object.keys(player.mana);
        const chosenColor = manaColors[Math.floor(Math.random() * manaColors.length)];
        flyManaGain(true, { [chosenColor]: item.effect.randomMana }, { fromId: 'item-button' });
        const manaCap = player.manaCaps?.[chosenColor] ?? player.maxMana;
        player.mana[chosenColor] = Math.min(manaCap, player.mana[chosenColor] + item.effect.randomMana);
        message += `Vous gagnez ${item.effect.randomMana} qì ${chosenColor}. `;
    }
    if(item.effect.regen) {
        player.regenEffect = { hp: item.effect.regen, turnsLeft: item.effect.duration || 3 };
        message += `Régénération de ${item.effect.regen} HP/tour pendant ${item.effect.duration || 3} tours. `;
    }
    if(item.effect.lifesteal) {
        player.lifesteal = (player.lifesteal || 0) + item.effect.lifesteal;
        message += `Vol de vie ${Math.round(item.effect.lifesteal * 100)}% activé pour ce combat. `;
    }
    if(item.effect.manaMultiplier) {
        player.manaMultiplier = { mult: item.effect.manaMultiplier, turnsLeft: item.effect.duration || 3 };
        message += `Gain de qì ×${item.effect.manaMultiplier} pendant ${item.effect.duration || 3} tours. `;
    }
    if(item.effect.damageReduction) {
        player.damageReduction = (player.damageReduction || 0) + item.effect.damageReduction;
        message += `Réduction des dégâts subis de ${Math.round(item.effect.damageReduction * 100)}% pour ce combat. `;
    }
    if(item.effect.critChance) {
        player.tempCritChance = (player.tempCritChance || 0) + item.effect.critChance;
        message += `Chances de critique +${item.effect.critChance}% pour ce combat. `;
    }

    if(item.type === "reusable" && isCombatLongEffect(item.effect)) player.itemBuffs[item.id] = true;
    return {success: true, message: message};
}

// Effets qui durent tout le combat et ne se cumulent donc pas.
export function isCombatLongEffect(effect) {
    return Boolean(effect && (effect.tempAttack || effect.tempDefense || effect.lifesteal || effect.damageReduction || effect.critChance || effect.revive));
}

// Appliquer les effets permanents des artefacts
export function applyArtifactEffects(player) {
    if(!player.inventory) return;

    player.inventory.forEach(item => {
        if(item.type === "artifact" && !item.applied) {
            if(item.effect.permMaxHp) {
                player.maxHp += item.effect.permMaxHp;
                player.hp += item.effect.permMaxHp;
            }
            if(item.effect.permAttack) {
                player.attack += item.effect.permAttack;
            }
            if(item.effect.permDefense) {
                player.defense = (player.defense || 0) + item.effect.permDefense;
            }
            if(item.effect.permMaxMana) {
                player.maxMana += item.effect.permMaxMana;
            }
            if(item.effect.permCritChance) {
                player.critChance = (player.critChance || 0) + item.effect.permCritChance;
            }
            if(item.effect.permStartActionPoints) {
                player.startActionPoints = (player.startActionPoints || 0) + item.effect.permStartActionPoints;
            }
            item.applied = true;
        }
    });
}

// Convertit un ancien consommable (usage unique) en objet rechargeable, sans jamais le détruire.
// Reprend les champs du catalogue si l'objet y figure, sinon 1 charge rechargée en 3 tours.
export function toReusable(item) {
    if(!item || item.type !== 'consumable') return item;
    const ref = allItems.find(i => i.id === item.id && i.type === 'reusable');
    const charges = ref?.chargesPerCycle || 1;
    Object.assign(item, {
        type: 'reusable',
        chargesPerCycle: charges,
        rechargeTurns: ref?.rechargeTurns || 3,
        chargesLeft: charges,
        rechargeLeft: 0,
    });
    if(ref) item.description = ref.description;
    return item;
}

// Nombre de tours pour qu'un objet rechargeable se recharge une fois ses charges épuisées
// (valeur de l'objet, sinon celle du catalogue pour les anciennes sauvegardes).
export function getRechargeTurns(item) {
    const own = Number(item?.rechargeTurns);
    if(Number.isFinite(own) && own > 0) return Math.floor(own);
    const catalogItem = allItems.find(i => i.id === item?.id);
    return Math.max(1, Math.floor(catalogItem?.rechargeTurns || 4));
}

// Texte d'état de recharge pour l'interface : « Recharge en N tours » / « 3 charges, rechargé en 4 tours ».
export function describeRecharge(item) {
    if(!item || item.type !== 'reusable') return '';
    const left = Math.max(0, Math.floor(item.rechargeLeft || 0));
    if((item.chargesLeft ?? item.chargesPerCycle) <= 0 && left > 0) return `recharge en ${left} tour${left > 1 ? 's' : ''}`;
    const n = getRechargeTurns(item);
    return `rechargé en ${n} tours`;
}

// À appeler à chaque début de tour du joueur : fait avancer la recharge des objets épuisés.
// Renvoie les objets qui viennent d'être rechargés.
export function tickReusableRecharge(player) {
    const recharged = [];
    (player?.inventory || []).forEach(item => {
        if(item.type !== 'reusable') return;
        if((item.chargesLeft ?? item.chargesPerCycle) > 0) { item.rechargeLeft = 0; return; }
        const left = Number.isFinite(item.rechargeLeft) && item.rechargeLeft > 0 ? item.rechargeLeft : getRechargeTurns(item);
        item.rechargeLeft = left - 1;
        if(item.rechargeLeft <= 0) {
            item.rechargeLeft = 0;
            item.chargesLeft = item.chargesPerCycle;
            recharged.push(item);
        }
    });
    return recharged;
}

// Recharger les objets rechargeables
export function rechargeReusableItems(player) {
    if(!player.inventory) return [];

    const recharged = [];
    player.inventory.forEach(item => {
        if(item.type === "reusable" && (item.chargesLeft ?? item.chargesPerCycle) < item.chargesPerCycle) {
            item.chargesLeft = item.chargesPerCycle;
            item.rechargeLeft = 0;
            recharged.push(item);
        }
    });

    return recharged;
}
