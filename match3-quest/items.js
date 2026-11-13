import { flyManaGain, flyHeal } from './manaFlight.js';
import { healEntity, cureStatuses, afflictionsOf, CURE_NAMES } from './alterations.js';
import { manaIcon, itemIcon } from './icons.js';
import { canEquip, equip, unequip } from './equipment.js';
import { MAX_LEVEL } from './experience.js';

// Système d'objets et inventaire

// Bibliothèque de tous les objets disponibles
export const SHADOW_RELIC_ID = 'voile_ombre_fusang';   // relique de quête de Fusang (indétectable)
export const allItems = [
    // === BOUCLIERS ===
    {id:"jade_shield", name:"Bouclier de Jade", type:"shield", minLevel:5, rarity:"uncommon",
     description:"Un bouclier poli en jade, renforce la défense (blocage) de 2", defense:2},
    {id:"dragon_shield", name:"Bouclier du Dragon Blanc", type:"shield", minLevel:10, rarity:"rare",
     description:"Un bouclier gravé du dragon blanc, défense +5, critique +1", defense:5, atkBonus:1},
    {id:"ancestral_shield", name:"Rondache Ancestrale", type:"shield", minLevel:15, rarity:"rare",
     description:"Un bouclier ancien renforcé par le temps, défense +7, absorbe 70 dégâts par combat", defense:7, absorbDamage:70},
    {id:"legendary_shield", name:"Bouclier de l'Empereur Jaune", type:"shield", minLevel:18, rarity:"legendary",
     description:"Le bouclier mythique de l'Empereur Jaune, défense +10, critique +1, absorbe 150 dégâts", defense:10, atkBonus:1, absorbDamage:150},

    // Boucliers à compromis : beaucoup d'un côté, un malus de l'autre (atkBonus / defBonus négatifs permis).
    {id:"spiked_buckler", name:"Targe Hérissée du Tigre", type:"shield", minLevel:24, rarity:"rare",
     description:"Une targe garnie de pointes : défense +4, critique +14, mais la garde est grande ouverte (défense -10)", defense:4, atkBonus:14, defBonus:-10},
    {id:"rampart_pavise", name:"Pavois du Rempart", type:"shield", minLevel:50, rarity:"legendary",
     description:"Un pavois de muraille, défense +30, absorbe 400 dégâts, mais il alourdit tant le bras (critique -16)", defense:30, atkBonus:-16, absorbDamage:400},

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
    
    // Remèdes : guérissent des altérations (effet `cure`). Inutilisables, au combat, tant qu'on n'en souffre pas.
    {id:"antidotePill", name:"Pilule d'Antidote", type:"reusable", minLevel:3, rarity:"common", actionPoints:1, chargesPerCycle:1, rechargeTurns:5,
     description:"Guérit le poison (rechargé en 5 tours)", effect:{cure:['poisoned']}},
    {id:"clearIncense", name:"Encens de Clarté", type:"reusable", minLevel:12, rarity:"uncommon", actionPoints:1, chargesPerCycle:1, rechargeTurns:6,
     description:"Guérit le silence et la confusion (rechargé en 6 tours)", effect:{cure:['muted', 'confused']}},
    {id:"lotusBalm", name:"Baume de Lotus", type:"reusable", minLevel:18, rarity:"uncommon", actionPoints:1, chargesPerCycle:1, rechargeTurns:6,
     description:"Guérit la brûlure et le ralentissement (rechargé en 6 tours)", effect:{cure:['burning', 'chilled']}},
    {id:"breakingStonePill", name:"Pilule de Pierre Brisée", type:"reusable", minLevel:22, rarity:"uncommon", actionPoints:2, chargesPerCycle:1, rechargeTurns:6,
     description:"Guérit la pétrification, l'affaiblissement et l'épuisement (rechargé en 6 tours)", effect:{cure:['petrified', 'weakened', 'exhausted']}},
    {id:"jadeSaltTalisman", name:"Talisman de Sel de Jade", type:"reusable", minLevel:34, rarity:"rare", actionPoints:2, chargesPerCycle:1, rechargeTurns:7,
     description:"Guérit la malédiction et la corruption (rechargé en 7 tours)", effect:{cure:['cursed', 'corrupted']}},
    {id:"purificationElixir", name:"Élixir de Purification", type:"reusable", minLevel:48, rarity:"rare", actionPoints:2, chargesPerCycle:1, rechargeTurns:8,
     description:"Guérit toutes les altérations négatives (rechargé en 8 tours)", effect:{cure:'all'}},

    // Reliques permanentes (niveau 8+)
    {id:"amuletOfPower", name:"Amulette du Tigre Blanc", type:"artifact", minLevel:10, rarity:"rare",
     description:"Augmente attaque de 1 (permanent)", effect:{permAttack:1}},
    {id:"shieldCharm", name:"Charme de la Tortue Noire", type:"artifact", minLevel:12, rarity:"rare",
     description:"Augmente défense de 2 (permanent)", effect:{permDefense:2}},
    
    // Objets légendaires (niveau 15+)
    {id:"crownOfTheArchmage", name:"Couronne de Perles de l'Immortel", type:"artifact", minLevel:15, rarity:"legendary",
     description:"Augmente le qì max de 4 (permanent)", effect:{permMaxMana:4}},
    {id:"dragonHeart", name:"Perle du Dragon", type:"artifact", minLevel:17, rarity:"legendary",
     description:"Augmente HP max de 80 et attaque de 2 (permanent)", effect:{permMaxHp:80, permAttack:2}},

     {id:"ringOfPrecision", name:"Bague d'Archer en Jade", type:"artifact", minLevel:9, rarity:"rare",
 description:"Augmente les chances de critique de 1% (permanent)", effect:{permCritChance:1}},

{id:"bootsOfSwiftness", name:"Sandales du Vent Léger", type:"artifact", minLevel:11, rarity:"rare",
 description:"Commence chaque combat avec +1 point d'action", effect:{permStartActionPoints:1}},

{id:"orbOfWisdom", name:"Orbe de Jade de Sagesse", type:"artifact", minLevel:12, rarity:"rare",
 description:"Augmente le qì max de 2 (permanent)", effect:{permMaxMana:2}},
 {id:"timeWarpPotion", name:"Pilule du Temps Suspendu", type:"reusable", minLevel:11, rarity:"rare", actionPoints:2, chargesPerCycle:1, rechargeTurns:8,
 description:"Jouez immédiatement 3 tours supplémentaires (rechargé en 8 tours)", effect:{extraTurn:3}},

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
    // L'attaque et la défense étant des chances plafonnées (98 % le critique, 75 % le blocage), les paliers misent sur les PV, le qì, les soins et la réduction de dégâts.
    // Boucliers
    {id:"qilin_shield", name:"Rondache du Qilin", type:"shield", minLevel:28, rarity:"rare",
     description:"Un bouclier orné du Qilin, défense +11, critique +1, absorbe 150 dégâts", defense:11, atkBonus:1, absorbDamage:150},
    {id:"golden_tortoise_aegis", name:"Égide de la Tortue d'Or", type:"shield", minLevel:45, rarity:"legendary",
     description:"L'égide de la Tortue d'Or, défense +13, critique +2, absorbe 300 dégâts", defense:13, atkBonus:2, absorbDamage:300},
    {id:"celestial_mandate_shield", name:"Bouclier du Mandat Céleste", type:"shield", minLevel:60, rarity:"legendary",
     description:"Le bouclier du Mandat Céleste, défense +16, critique +2, absorbe 500 dégâts", defense:16, atkBonus:2, absorbDamage:500},

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
     description:"Augmente le qì max de 3 (permanent)", effect:{permMaxMana:3}},
    {id:"red_phoenix_ring", name:"Anneau du Phénix Rouge", type:"artifact", minLevel:30, rarity:"rare",
     description:"Augmente HP max de 90 (permanent)", effect:{permMaxHp:90}},
    {id:"celestial_tortoise_seal", name:"Sceau de la Tortue Céleste", type:"artifact", minLevel:34, rarity:"rare",
     description:"Augmente défense de 3 (permanent)", effect:{permDefense:3}},
    {id:"piercing_eye_ring", name:"Bague de l'Œil Perçant", type:"artifact", minLevel:38, rarity:"rare",
     description:"Augmente les chances de critique de 1% (permanent)", effect:{permCritChance:1}},
    {id:"imperial_jade_crown", name:"Couronne de Jade Impériale", type:"artifact", minLevel:45, rarity:"legendary",
     description:"Augmente HP max de 150 et le qì max de 5 (permanent)", effect:{permMaxHp:150, permMaxMana:5}},
    {id:"dragon_emperor_pearl", name:"Perle de l'Empereur Dragon", type:"artifact", minLevel:55, rarity:"legendary",
     description:"Augmente HP max de 220 et défense de 2 (permanent)", effect:{permMaxHp:220, permDefense:2}},
    {id:"golden_clouds_boots", name:"Bottes des Nuages Dorés", type:"artifact", minLevel:60, rarity:"legendary",
     description:"Commence chaque combat avec +1 point d'action", effect:{permStartActionPoints:1}},
    {id:"heaven_seal", name:"Sceau du Ciel", type:"artifact", minLevel:65, rarity:"legendary",
     description:"Augmente HP max de 300, le qì max de 5 et les chances de critique de 1% (permanent)", effect:{permMaxHp:300, permMaxMana:5, permCritChance:1}},
    // Relique de quête (Fusang) : jamais en butin ni en vente. Portée dans un emplacement de relique, elle rend le héros indétectable.
    {id:SHADOW_RELIC_ID, name:"Voile d'Ombre de Fusang", type:"artifact", minLevel:37, rarity:"legendary", quest:true,
     description:"Les ennemis ne vous remarquent plus, sauf les boss ; les hautes herbes, l'eau et la lave n'attirent plus de combat. Augmente HP max de 30 (permanent)", effect:{permMaxHp:30, stealth:true}},
];

// Objets qui peuvent tomber en butin, se vendre ou se tirer au hasard : sans les reliques de quête.
export const lootableItems = allItems.filter(item => !item.quest);

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
    const availableItems = lootableItems.filter(item => 
        item.minLevel <= playerLevel + 2 && item.minLevel >= Math.max(1, playerLevel - 3)
    );
    
    if(availableItems.length === 0) {
        // Rien dans la fenêtre de niveau : les meilleurs objets que le joueur peut utiliser (sinon un élixir de niveau 1)
        const usable = lootableItems.filter(item => item.minLevel <= playerLevel + 2);
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

// Picto d'un objet (famille d'après son nom, teinte d'après sa rareté)
export function getItemIcon(item) {
    return itemIcon(item);
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

// Objets actifs du héros : `activeInventoryIndex` (objet 1) et `activeInventoryIndex2` (objet 2), des index du sac.
export const ACTIVE_ITEM_KEYS = ['activeInventoryIndex', 'activeInventoryIndex2'];

/** Index du sac actifs (objet 1 puis objet 2), `null` pour un emplacement vide. */
export const activeItemIndexes = hero => ACTIVE_ITEM_KEYS.map(k => (Number.isInteger(hero?.[k]) ? hero[k] : null));

/** Le sac vient de perdre l'objet `removed` (vente, jet, bouclier équipé) : les index qui le suivent reculent, l'objet 2 retiré se vide. */
export function shiftActiveItemIndexes(hero, removed) {
    ACTIVE_ITEM_KEYS.forEach((k, slot) => {
        if (!Number.isInteger(hero[k])) return;
        if (hero[k] > removed) hero[k]--;
        else if (hero[k] === removed && slot === 1) hero[k] = null;
    });
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
        const potion = healEntity(player, item.effect.heal);   // Corrompu : la potion blesse
        if(potion.harmed > 0){
            message += `Corrompu : la potion vous inflige ${potion.harmed} dégâts ! `;
        } else {
            flyHeal(true, item.effect.heal);
            message += `Vous récupérez ${item.effect.heal} HP. `;
        }
    }
    if(item.effect.cure) {   // remède : guérit des altérations (une liste de clés, ou 'all')
        const cured = cureStatuses(player, item.effect.cure);
        message += cured.length ? `Vous guérissez ${cured.map(k => CURE_NAMES[k]).join(', ')}. ` : `Aucune altération à guérir. `;
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
        // Tire parmi les couleurs qui absorbent tout le gain ; sinon, parmi celles qui ont le plus de place (le gain n'est jamais rogné inutilement).
        const allColors = Object.keys(player.mana);
        const room = c => (player.manaCaps?.[c] ?? player.maxMana) - player.mana[c];
        const best = Math.max(...allColors.map(room));
        const needed = Math.min(item.effect.randomMana, best);
        const manaColors = allColors.filter(c => room(c) >= needed);
        const chosenColor = manaColors[Math.floor(Math.random() * manaColors.length)];
        const manaCap = player.manaCaps?.[chosenColor] ?? player.maxMana;
        const gained = Math.max(0, Math.min(manaCap, player.mana[chosenColor] + item.effect.randomMana) - player.mana[chosenColor]);
        flyManaGain(true, { [chosenColor]: gained }, { fromId: 'item-button' });
        player.mana[chosenColor] += gained;
        message += `Vous gagnez ${gained} qì ${chosenColor}. `;
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

// Reliques permanentes : le héros n'en PORTE qu'un nombre limité, qui croît avec son niveau (3 au niveau 1, 10 au niveau 70), et
// une seule par identifiant (sinon cinq Cœurs de Jade ou trois Charmes de la Tortue Noire dépasseraient le budget de statistiques :
// statBudget.js). `applied` = portée (son effet est dans les statistiques du héros) ; une relique non portée reste dans le sac,
// vendable. `stowed` = retirée volontairement : elle n'est plus remise toute seule.
export const RELIC_SLOTS_MIN = 3;
export const RELIC_SLOTS_MAX = 10;
export function relicSlots(level) {
    const lvl = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level) || 1));
    return RELIC_SLOTS_MIN + Math.floor((lvl - 1) * (RELIC_SLOTS_MAX - RELIC_SLOTS_MIN) / (MAX_LEVEL - 1));
}
export const wornRelics = player => (player?.inventory || []).filter(i => i.type === "artifact" && i.applied);
/** Le héros porte-t-il le Voile d'ombre : indétectable par les ennemis (hors boss). */
export const hasShadowRelic = player => wornRelics(player).some(i => i.effect?.stealth);

function shiftRelicEffect(player, item, sign) {
    const e = item.effect || {};
    if(e.permMaxHp) {
        player.maxHp = Math.max(1, player.maxHp + sign * e.permMaxHp);
        player.hp = sign > 0 ? player.hp + e.permMaxHp : Math.min(player.hp, player.maxHp);
    }
    if(e.permAttack) player.attack = Math.max(0, player.attack + sign * e.permAttack);
    if(e.permDefense) player.defense = Math.max(0, (player.defense || 0) + sign * e.permDefense);
    if(e.permMaxMana) player.maxMana = Math.max(0, player.maxMana + sign * e.permMaxMana);
    if(e.permCritChance) player.critChance = Math.max(0, (player.critChance || 0) + sign * e.permCritChance);
    if(e.permStartActionPoints) player.startActionPoints = Math.max(0, (player.startActionPoints || 0) + sign * e.permStartActionPoints);
}

/** Porte une relique du sac. Renvoie { ok, message }. */
export function equipRelic(player, item) {
    if(!item || item.type !== "artifact" || item.applied) return { ok: false, message: "" };
    if(wornRelics(player).some(i => i.id === item.id)) return { ok: false, message: `${item.name} est déjà portée.` };
    const slots = relicSlots(player.level);
    if(wornRelics(player).length >= slots) return { ok: false, message: `Toutes vos reliques sont portées (${slots} au niveau ${player.level}). Retirez-en une.` };
    shiftRelicEffect(player, item, 1);
    item.applied = true;
    delete item.stowed;
    return { ok: true, message: `Relique portée : ${item.name}.` };
}

/** Retire une relique portée (son effet disparaît). */
export function unequipRelic(player, item) {
    if(!item || item.type !== "artifact" || !item.applied) return { ok: false, message: "" };
    shiftRelicEffect(player, item, -1);
    item.applied = false;
    item.stowed = true;
    return { ok: true, message: `Relique retirée : ${item.name}.` };
}

// Remplit les emplacements libres avec les reliques du sac (ramassage, gain de niveau, chargement), sauf celles retirées à la main.
export function applyArtifactEffects(player) {
    if(!player.inventory) return;
    player.inventory.forEach(item => {
        if(item.type === "artifact" && !item.applied && !item.stowed) equipRelic(player, item);
    });
}

// Sauvegarde ancienne (reliques toutes portées, en double) : retire l'effet des doublons et des reliques au-delà du nombre
// d'emplacements du niveau. Renvoie le nombre de reliques retirées.
export function normalizeRelics(player) {
    if(!player?.inventory) return 0;
    const seen = new Set();
    let worn = 0, removed = 0;
    const slots = relicSlots(player.level);
    player.inventory.forEach(item => {
        if(item.type !== "artifact" || !item.applied) return;
        if(!seen.has(item.id) && worn < slots) { seen.add(item.id); worn++; return; }
        shiftRelicEffect(player, item, -1);
        item.applied = false;
        removed++;
    });
    return removed;
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

// Ancienne sauvegarde : le collier du voile d'ombre est devenu la relique « Voile d'ombre de Fusang ». Le collier (et ses PV max s'il était porté) est retiré, la relique rendue.
const OLD_SHADOW_COLLAR = 'collier_voile_d_ombre';
export function migrateShadowCollar(hero){
    if(!hero?.stuffOwned?.includes?.(OLD_SHADOW_COLLAR)) return false;
    hero.stuffOwned = hero.stuffOwned.filter(id => id !== OLD_SHADOW_COLLAR);
    if(hero.stuff?.neck === OLD_SHADOW_COLLAR){
        hero.stuff.neck = null;
        hero.maxHp = Math.max(1, (hero.maxHp || 1) - 30);
        hero.hp = Math.min(hero.hp || hero.maxHp, hero.maxHp);
    }
    const item = allItems.find(i => i.id === SHADOW_RELIC_ID);
    if(item && !(hero.inventory || []).some(i => i.id === SHADOW_RELIC_ID)){
        if(!Array.isArray(hero.inventory)) hero.inventory = [];
        hero.inventory.push({ ...item, applied: false });
    }
    return true;
}

