// Système d'objets et inventaire

// Bibliothèque de tous les objets disponibles
export const allItems = [
    // Potions (niveau 1+)
    {id:"healthPotion", name:"Potion de Soin", type:"consumable", minLevel:1, rarity:"common", 
     description:"Restaure 30 HP", effect:{heal:30}},
    {id:"manaPotion", name:"Potion de Mana", type:"consumable", minLevel:1, rarity:"common",
     description:"Restaure 15 mana de chaque couleur", effect:{mana:15}},
    {id:"strengthPotion", name:"Potion de Force", type:"consumable", minLevel:3, rarity:"uncommon",
     description:"Augmente l'attaque de 10 pour ce combat", effect:{tempAttack:10}},
    
    // Potions avancées (niveau 5+)
    {id:"greaterHealthPotion", name:"Grande Potion de Soin", type:"consumable", minLevel:5, rarity:"uncommon",
     description:"Restaure 60 HP", effect:{heal:60}},
    {id:"greaterManaPotion", name:"Grande Potion de Mana", type:"consumable", minLevel:5, rarity:"uncommon",
     description:"Restaure 25 mana de chaque couleur", effect:{mana:25}},
    {id:"defensePotion", name:"Potion de Défense", type:"consumable", minLevel:6, rarity:"uncommon",
     description:"Augmente la défense de 15 pour ce combat", effect:{tempDefense:15}},
    
    // Potions rares (niveau 10+)
    {id:"elixirOfPower", name:"Élixir de Puissance", type:"consumable", minLevel:10, rarity:"rare",
     description:"Augmente attaque et défense de 15 pour ce combat", effect:{tempAttack:15, tempDefense:15}},
    {id:"phoenixFeather", name:"Plume de Phénix", type:"consumable", minLevel:12, rarity:"rare",
     description:"Ressuscite avec 50% HP si vous mourrez (1 utilisation)", effect:{revive:0.5}},
    
    // Artefacts permanents (niveau 8+)
    {id:"ringOfVitality", name:"Anneau de Vitalité", type:"artifact", minLevel:8, rarity:"rare",
     description:"Augmente HP max de 25 (permanent)", effect:{permMaxHp:25}},
    {id:"amuletOfPower", name:"Amulette de Pouvoir", type:"artifact", minLevel:10, rarity:"rare",
     description:"Augmente attaque de 5 (permanent)", effect:{permAttack:5}},
    {id:"shieldCharm", name:"Charme de Protection", type:"artifact", minLevel:12, rarity:"rare",
     description:"Augmente défense de 5 (permanent)", effect:{permDefense:5}},
    
    // Objets légendaires (niveau 15+)
    {id:"crownOfTheArchmage", name:"Couronne de l'Archimage", type:"artifact", minLevel:15, rarity:"legendary",
     description:"Augmente mana max de 20 (permanent)", effect:{permMaxMana:20}},
    {id:"dragonHeart", name:"Cœur de Dragon", type:"artifact", minLevel:17, rarity:"legendary",
     description:"Augmente HP max de 50 et attaque de 10 (permanent)", effect:{permMaxHp:50, permAttack:10}},
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
        // Fallback sur les objets de niveau 1
        return allItems.find(item => item.id === "healthPotion");
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

// Obtenir l'emoji selon la rareté
export function getRarityEmoji(rarity) {
    const emojis = {
        common: '⚪',
        uncommon: '🟢',
        rare: '🔵',
        legendary: '🟣'
    };
    return emojis[rarity] || '⚪';
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
export function useItem(itemId, player, enemy) {
    const itemIndex = player.inventory.findIndex(item => item.id === itemId);
    if(itemIndex === -1) return {success: false, message: "Objet introuvable"};
    
    const item = player.inventory[itemIndex];
    
    // Les artefacts ne peuvent pas être utilisés (ils sont automatiques)
    if(item.type === "artifact") {
        return {success: false, message: "Les artefacts sont déjà équipés automatiquement"};
    }
    
    // Appliquer l'effet de l'objet
    let message = "";
    if(item.effect.heal) {
        player.hp = Math.min(player.maxHp, player.hp + item.effect.heal);
        message += `💚 Vous récupérez ${item.effect.heal} HP. `;
    }
    if(item.effect.mana) {
        Object.keys(player.mana).forEach(color => {
            player.mana[color] = Math.min(player.maxMana, player.mana[color] + item.effect.mana);
        });
        message += `✨ Vous gagnez ${item.effect.mana} mana de chaque couleur. `;
    }
    if(item.effect.tempAttack) {
        player.tempAttack = (player.tempAttack || 0) + item.effect.tempAttack;
        player.attack += item.effect.tempAttack;
        message += `⚔️ Votre attaque augmente de ${item.effect.tempAttack} pour ce combat. `;
    }
    if(item.effect.tempDefense) {
        player.tempDefense = (player.tempDefense || 0) + item.effect.tempDefense;
        player.defense += item.effect.tempDefense;
        message += `🛡️ Votre défense augmente de ${item.effect.tempDefense} pour ce combat. `;
    }
    if(item.effect.revive) {
        player.hasRevive = true;
        player.revivePercent = item.effect.revive;
        message += `🔥 Vous serez ressuscité si vous mourrez ! `;
    }
    
    // Retirer l'objet consommable de l'inventaire
    if(item.type === "consumable") {
        player.inventory.splice(itemIndex, 1);
    }
    
    return {success: true, message: message};
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
            item.applied = true;
        }
    });
}
