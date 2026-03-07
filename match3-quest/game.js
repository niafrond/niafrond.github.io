// logique globale du joueur, ennemis, combat et interface

import { colors } from "./constants.js";
import { generateRandomEnemy } from "./enemies.js";
import { allWeapons, getAvailableWeapons, getWeaponById } from "./weapons.js";
import { enemyMakeMove, setGameStarted } from "./board.js";
import { makeDecision, setAIDifficulty, getAIDifficulty, logDecision, setAIDifficultyByLevel } from "./enemyAI.js";
import { getRandomItem, getRarityEmoji, getRarityColor, useItem, applyArtifactEffects } from "./items.js";
import { initializeXP, addXP, calculateXPGain, getXPProgress, getXPToNextLevel } from "./experience.js";

// joueur
export let player = {
    name: "Aventurier",
    hp: 100,
    maxHp: 100,
    mana: { red:0, blue:0, green:0, yellow:0, purple:0 },
    maxMana: 50,
    attack: 15,
    level: 1,
    xp: 0,
    xpToNextLevel: 100,
    attributes: { strength:0, agility:0, intelligence:0, stamina:0, morale:0 },
    spells: [],
    activeSpells: [],  // sorts équipés (max 4)
    availableSpells: [], // sorts débloqués
    weapons: [],  // armes possédées
    equippedWeapon: null,  // arme équipée
    availableWeapons: [],  // armes débloquées
    combatPoints: 0,
    bonusTurn: false,
    abilities: [],  // aptitudes acquises
    class: null,  // classe du joueur (sorcerer, assassin, templar, barbarian)
    statusEffects: {},  // effets de statut actifs (poison, stun, buffs, etc.)
    defense: 0,  // défense du joueur
    inventory: [],  // inventaire d'objets
    tempAttack: 0,  // bonus d'attaque temporaire
    tempDefense: 0,  // bonus de défense temporaire
    hasRevive: false,  // possède un effet de résurrection
    revivePercent: 0  // pourcentage de HP à la résurrection
};

// tour actuel
export let currentTurn = 'player';

// état du combat (objet pour pouvoir modifier la propriété)
export const gameState = { 
    combatState: 'ready' // 'ready' (avant combat), 'active' (en cours), 'finished' (terminé)
};

// règles de combat
export const combatCost = 5;             // points nécessaires pour une attaque normale
export const skullDamage = 1;           // dégâts infligés par crâne lors d'un match

// ennemi courant (combatPoints pour attaquer)
export let enemy = { name:"Gobelin", hp:50, maxHp:50, attack:10, resistances:{}, combatPoints:0, mana: { red:0, blue:0, green:0, yellow:0, purple:0 }, spells:[], weapon: null, abilities: [], statusEffects: {}, bonusTurn: false };

// si le joueur meurt, on restaure ses PV et réinitialise le combat
export function restartCombat(){
    player.hp = player.maxHp;
    player.combatPoints = 0;
    player.bonusTurn = false;
    enemy.hp = enemy.maxHp;
    enemy.combatPoints = 0;
    enemy.bonusTurn = false;
    // Réinitialiser le mana à 0
    player.mana = { red:0, blue:0, green:0, yellow:0, purple:0 };
    enemy.mana = { red:0, blue:0, green:0, yellow:0, purple:0 };
    // Réinitialiser les bonus temporaires
    if(player.tempAttack) {
        player.attack -= player.tempAttack;
        player.tempAttack = 0;
    }
    if(player.tempDefense) {
        player.defense -= player.tempDefense;
        player.tempDefense = 0;
    }
    player.hasRevive = false;
    player.revivePercent = 0;
    // Réinitialiser le statut du jeu
    setGameStarted(false);
    // Appliquer les aptitudes de début de combat
    applyStartingAbilities();
    
    log("🎮 Combat réinitialisé, vous êtes en pleine santé.");
    updateStats();
    saveUpdate();
}

// Gérer la mort du joueur
export function handlePlayerDeath(){
    // Vérifier si le joueur a un effet de résurrection
    if(player.hasRevive && player.revivePercent > 0) {
        const reviveHp = Math.floor(player.maxHp * player.revivePercent);
        player.hp = reviveHp;
        player.hasRevive = false;
        player.revivePercent = 0;
        log(`🔥 Vous êtes ressuscité avec ${reviveHp} HP !`);
        updateStats();
        saveUpdate();
        return;
    }
    
    log("💀 Vous êtes mort ! Le combat est terminé.");
    
    // Marquer le combat comme terminé
    gameState.combatState = 'finished';
    
    // Cacher les éléments de combat
    document.querySelector('.stats-container').style.display = 'none';
    document.getElementById('board').style.display = 'none';
    document.getElementById('spells-container').style.display = 'none';
    
    // Cacher le bouton "Abandonner"
    const abandonBtn = document.getElementById('abandon-combat-btn');
    if(abandonBtn) {
        abandonBtn.style.display = 'none';
    }
    
    // Afficher le bouton "Nouveau Combat"
    const newCombatBtn = document.getElementById('new-combat-btn');
    if(newCombatBtn) {
        newCombatBtn.style.display = 'block';
    }
    
    // Réafficher les onglets
    const tabs = document.querySelector('.tabs');
    if(tabs) {
        tabs.style.display = 'flex';
    }
    
    log("⚔️ Cliquez sur \"Nouveau Combat\" pour recommencer.");
}

// démarre un nouveau combat
export function startNewCombat(){
    gameState.combatState = 'active';
    // Cacher le bouton "Nouveau Combat"
    const newCombatBtn = document.getElementById('new-combat-btn');
    if(newCombatBtn) {
        newCombatBtn.style.display = 'none';
    }
    // Afficher le bouton "Abandonner"
    const abandonBtn = document.getElementById('abandon-combat-btn');
    if(abandonBtn) {
        abandonBtn.style.display = 'inline-block';
    }
    // Cacher les onglets pendant le combat
    const tabs = document.querySelector('.tabs');
    if(tabs) {
        tabs.style.display = 'none';
    }
    // Restaurer les PV et préparer le combat
    restartCombat();
    newEnemy();
}

// Abandonner le combat en cours
export function abandonCombat(){
    if(gameState.combatState !== 'active') {
        return;
    }
    
    log("🏳️ Vous avez abandonné le combat...");
    
    // Marquer le combat comme terminé
    gameState.combatState = 'finished';
    
    // Cacher les éléments de combat
    document.querySelector('.stats-container').style.display = 'none';
    document.getElementById('board').style.display = 'none';
    document.getElementById('spells-container').style.display = 'none';
    
    // Cacher le bouton "Abandonner"
    const abandonBtn = document.getElementById('abandon-combat-btn');
    if(abandonBtn) {
        abandonBtn.style.display = 'none';
    }
    
    // Afficher le bouton "Nouveau Combat"
    const newCombatBtn = document.getElementById('new-combat-btn');
    if(newCombatBtn) {
        newCombatBtn.style.display = 'block';
    }
    
    // Réafficher les onglets
    const tabs = document.querySelector('.tabs');
    if(tabs) {
        tabs.style.display = 'flex';
    }
    
    log(`⚔️ Cliquez sur "Nouveau Combat" pour recommencer ou modifiez vos sorts/armes.`);
}


// bibliothèque des aptitudes
export const allAbilities = [
    {id:"fireAffinity", name:"Affinité de Feu", description:"Commence le combat avec 10 mana rouge", startMana:{red:10}},
    {id:"iceAffinity", name:"Affinité de Glace", description:"Commence le combat avec 10 mana bleu", startMana:{blue:10}},
    {id:"natureAffinity", name:"Affinité de Nature", description:"Commence le combat avec 10 mana vert", startMana:{green:10}},
    {id:"stormAffinity", name:"Affinité de Foudre", description:"Commence le combat avec 10 mana jaune", startMana:{yellow:10}},
    {id:"shadowAffinity", name:"Affinité d'Ombre", description:"Commence le combat avec 10 mana violet", startMana:{purple:10}},
    {id:"elementalist", name:"Élémentaliste", description:"Commence le combat avec 5 mana de chaque couleur", startMana:{red:5, blue:5, green:5, yellow:5, purple:5}},
    {id:"fireMastery", name:"Maîtrise du Feu", description:"+2 mana rouge par match (5 au lieu de 3)"},
    {id:"iceMastery", name:"Maîtrise de la Glace", description:"+2 mana bleu par match (5 au lieu de 3)"},
    {id:"natureMastery", name:"Maîtrise de la Nature", description:"+2 mana vert par match (5 au lieu de 3)"},
    {id:"stormMastery", name:"Maîtrise de la Foudre", description:"+2 mana jaune par match (5 au lieu de 3)"},
    {id:"shadowMastery", name:"Maîtrise de l'Ombre", description:"+2 mana violet par match (5 au lieu de 3)"}
];

// bibliothèque des sorts
export const allSpells = [
    {id:"fireball", name:"Boule de Feu", color:"red", cost:10, dmg:25, minLevel:2},
    {id:"ice", name:"Glace", color:"blue", cost:12, dmg:30, minLevel:2},
    {id:"heal", name:"Soin", color:"green", cost:8, heal:20, minLevel:2},
    {id:"bolt", name:"Éclair", color:"yellow", cost:15, dmg:35, minLevel:2},
    {id:"flameStrike", name:"Frappe de Flammes", color:"red", cost:20, dmg:50, minLevel:5},
    {id:"frostNova", name:"Nova de Glace", color:"blue", cost:22, dmg:55, minLevel:5},
    {id:"greatHeal", name:"Grand Soin", color:"green", cost:18, heal:45, minLevel:5},
    {id:"thunderBolt", name:"Foudre", color:"yellow", cost:25, dmg:60, minLevel:5},
    {id:"inferno", name:"Inferno", color:"red", cost:35, dmg:80, minLevel:10},
    {id:"blizzard", name:"Blizzard", color:"blue", cost:38, dmg:85, minLevel:10},
    {id:"revitalize", name:"Revitalisation", color:"green", cost:30, heal:75, minLevel:10},
    {id:"lightningStorm", name:"Tempête de Foudre", color:"yellow", cost:40, dmg:90, minLevel:10},
    {id:"meteor", name:"Météore", color:"red", cost:50, dmg:120, minLevel:15},
    {id:"iceAge", name:"Ère de Glace", color:"blue", cost:55, dmg:125, minLevel:15},
    {id:"miracle", name:"Miracle", color:"green", cost:45, heal:110, minLevel:15},
    {id:"stormOfGods", name:"Tempête Divine", color:"yellow", cost:60, dmg:140, minLevel:15}
];

// Fonction de chargement de la sauvegarde
export function loadGameData() {
    const savedPlayer = localStorage.getItem('player');
    if (savedPlayer) {
        try {
            const loaded = JSON.parse(savedPlayer);
            // Fusionner les données sauvegardées avec les valeurs par défaut
            player.name = loaded.name ?? player.name;
            player.hp = loaded.hp ?? player.hp;
            player.maxHp = loaded.maxHp ?? player.maxHp;
            player.mana = loaded.mana ?? player.mana;
            player.maxMana = loaded.maxMana ?? player.maxMana;
            player.attack = loaded.attack ?? player.attack;
            player.level = loaded.level ?? player.level;
            player.xp = loaded.xp ?? player.xp;
            player.xpToNextLevel = loaded.xpToNextLevel ?? player.xpToNextLevel;
            player.attributes = loaded.attributes ?? player.attributes;
            player.spells = loaded.spells ?? player.spells;
            player.activeSpells = loaded.activeSpells ?? player.activeSpells;
            player.availableSpells = loaded.availableSpells ?? player.availableSpells;
            player.weapons = loaded.weapons ?? [];
            player.equippedWeapon = loaded.equippedWeapon ?? null;
            player.availableWeapons = loaded.availableWeapons ?? player.availableWeapons;
            player.combatPoints = loaded.combatPoints ?? player.combatPoints;
            player.bonusTurn = loaded.bonusTurn ?? player.bonusTurn;
            player.abilities = loaded.abilities ?? player.abilities;
            player.class = loaded.class ?? player.class;
            player.statusEffects = loaded.statusEffects ?? player.statusEffects;
            player.defense = loaded.defense ?? player.defense;
            player.inventory = loaded.inventory ?? player.inventory;
            player.tempAttack = loaded.tempAttack ?? player.tempAttack;
            player.tempDefense = loaded.tempDefense ?? player.tempDefense;
            player.hasRevive = loaded.hasRevive ?? player.hasRevive;
            player.revivePercent = loaded.revivePercent ?? player.revivePercent;
            console.log('💾 Données du joueur chargées depuis le localStorage');
            if (player.class) {
                console.log(`✨ Classe chargée: ${player.class}`);
            }
        } catch (e) {
            console.error('❌ Erreur lors du chargement de la sauvegarde:', e);
        }
    }
    // Initialiser l'XP si nécessaire (pour les sauvegardes anciennes)
    initializeXP(player);
}

// Chargement de la sauvegarde au démarrage
loadGameData();
// Appliquer les effets des artefacts
applyArtifactEffects(player);

// interface minimale
export function updateStats(){
    // truncate log to only the latest message
    const logDiv=document.getElementById('log');
    if(logDiv){
        const lines = logDiv.innerHTML.split('<br>').filter(l=>l.trim()!=='');
        logDiv.innerHTML = lines.slice(-1).join('<br>');
    }

    const playerDiv=document.getElementById('player-stats');
    // Affichage de la classe si définie
    const playerClassEmoji = player.class ? (async () => {
        const module = await import('./classes.js');
        return module.playerClasses[player.class]?.emoji || '';
    })() : Promise.resolve('');
    
    playerClassEmoji.then(emoji => {
        const classDisplay = emoji ? `<div class="stat"><strong>${emoji}</strong></div>` : '';
        const nameDisplay = `<div class="stat"><strong>${player.name || 'Aventurier'}</strong></div>`;
        
        // Calculer la progression XP
        const xpProgress = getXPProgress(player);
        const xpRemaining = getXPToNextLevel(player);
        
        playerDiv.innerHTML = `
            ${nameDisplay}
            ${classDisplay}
            <div class="stat">
                <div class="hp-bar-container">
                    <progress value="${Math.floor(player.hp)}" max="${player.maxHp}"></progress>
                    <span class="hp-text">${Math.floor(player.hp)}/${player.maxHp}</span>
                </div>
            </div>
            <div class="stat">
                <div class="xp-bar-container" title="XP: ${player.xp}/${player.xpToNextLevel} (${xpRemaining} restants)">
                    <progress class="xp-bar" value="${xpProgress}" max="100"></progress>
                    <span class="xp-text">Niv.${player.level} - ${xpProgress}%</span>
                </div>
            </div>
            <div class="stat">
                <div class="mana-dots">
                    <span class="mana-dot mana-red" title="${player.mana.red}"></span>${player.mana.red}
                    <span class="mana-dot mana-blue" title="${player.mana.blue}"></span>${player.mana.blue}
                    <span class="mana-dot mana-green" title="${player.mana.green}"></span>${player.mana.green}
                    <span class="mana-dot mana-yellow" title="${player.mana.yellow}"></span>${player.mana.yellow}
                    <span class="mana-dot mana-purple" title="${player.mana.purple}"></span>${player.mana.purple}
                </div>
            </div>
            <div class="stat"><strong>CP:</strong> ${player.combatPoints}</div>`;
        
        // Ajouter/retirer classe pour liseré selon le tour actuel
        playerDiv.classList.toggle('active-turn', currentTurn === 'player');
    });
    
    const enemyDiv=document.getElementById('enemy-stats');
    enemyDiv.classList.toggle('active-turn', currentTurn === 'enemy');
    
    // Obtenir l'emoji de la classe de l'ennemi
    const classEmojis = { 'sorcerer': '🧙', 'assassin': '🗡️', 'templar': '🛡️', 'barbarian': '🪓' };
    const enemyClassEmoji = classEmojis[enemy.playerClass] || '';
    
    // Afficher un indicateur visuel si l'ennemi est plus fort
    const levelIndicator = enemy.level > player.level ? 
        `<span style="color: #ff4444; font-weight: bold;"> ⚡Niv.${enemy.level}</span>` : 
        `<span style="color: #888;"> ${enemy.level}</span>`;
    
    enemyDiv.innerHTML = `
        <div class="stat">${enemyClassEmoji} ${enemy.name}${levelIndicator}</div>
        <div class="stat">
            <div class="hp-bar-container">
                <progress class="enemy-bar" value="${Math.floor(enemy.hp)}" max="${enemy.maxHp}"></progress>
                <span class="hp-text">${Math.floor(enemy.hp)}/${enemy.maxHp}</span>
            </div>
        </div>
        <div class="stat">
            <div class="mana-dots">
                <span class="mana-dot mana-red" title="${enemy.mana.red}"></span>${enemy.mana.red}
                <span class="mana-dot mana-blue" title="${enemy.mana.blue}"></span>${enemy.mana.blue}
                <span class="mana-dot mana-green" title="${enemy.mana.green}"></span>${enemy.mana.green}
                <span class="mana-dot mana-yellow" title="${enemy.mana.yellow}"></span>${enemy.mana.yellow}
                <span class="mana-dot mana-purple" title="${enemy.mana.purple}"></span>${enemy.mana.purple}
            </div>
        </div>
        <div class="stat"><strong>Atk:</strong> ${enemy.attack}</div>
        <div class="stat"><strong>CP:</strong> ${enemy.combatPoints}</div>`;
    
    updateEnemySpells();
}

export function updateEnemySpells(){
    const container = document.getElementById('enemy-spell-list');
    if(!container) return;
    container.innerHTML = '';
    
    if(!enemy.spells || enemy.spells.length === 0){
        container.innerHTML = '<div class="enemy-spell-item" style="text-align:center;"><em>Aucun sort</em></div>';
        return;
    }
    
    enemy.spells.forEach(sp => {
        const div = document.createElement('div');
        div.className = 'enemy-spell-item';
        
        // Déterminer si c'est un sort de classe et obtenir son emoji
        const classEmojis = { 'sorcerer': '🧙', 'assassin': '🗡️', 'templar': '🛡️', 'barbarian': '🪓' };
        const spellClassIndicator = sp.class ? classEmojis[sp.class] : '';
        
        // Gestion des coûts multiples pour les sorts de classe
        let costDisplay = '';
        if (typeof sp.cost === 'number') {
            costDisplay = `<span class="mana-dot mana-${sp.color}"></span>${sp.cost}`;
        } else if (typeof sp.cost === 'object') {
            costDisplay = Object.entries(sp.cost)
                .map(([color, amount]) => `<span class="mana-dot mana-${color}"></span>${amount}`)
                .join(' ');
        }
        
        const damageText = sp.dmg ? ` • ${sp.dmg} dmg` : '';
        const healText = sp.heal ? ` • ${sp.heal} HP` : '';
        div.innerHTML = `
            <div class="spell-name">${spellClassIndicator} ${sp.name}</div>
            <div class="spell-cost">${costDisplay}${damageText}${healText}</div>
        `;
        container.appendChild(div);
    });
}

export function log(text){
    const logDiv=document.getElementById('log');
    if(logDiv){
        logDiv.innerHTML = text + "<br>";
        logDiv.scrollTop = logDiv.scrollHeight;
    }
}

// ========================================
// GESTION DE LA DIFFICULTÉ DE L'IA
// ========================================

export function changeAIDifficulty(difficultyLevel) {
    setAIDifficulty(difficultyLevel);
    log(`🤖 Difficulté de l'IA changée: ${difficultyLevel}`);
}

export function getCurrentAIDifficulty() {
    const difficulty = getAIDifficulty();
    return difficulty.name;
}

// ========================================

export function saveUpdate(){
    try {
        localStorage.setItem('player', JSON.stringify(player));
        console.log('💾 Données du joueur sauvegardées');
        if (player.class) {
            console.log(`✨ Classe sauvegardée: ${player.class}`);
        }
    } catch (e) {
        console.error('❌ Erreur lors de la sauvegarde:', e);
    }
    updateStats();
    createSpellButtons();
    createWeaponButton();
    updatePlayerStatsTab();
}

// Fonction pour effacer la sauvegarde
export function clearSaveData() {
    if (confirm('Êtes-vous sûr de vouloir effacer votre sauvegarde ?')) {
        localStorage.removeItem('player');
        console.log('🗑️ Sauvegarde effacée');
        location.reload();
    }
}

// mise à jour de l'onglet stats détaillées
export function updatePlayerStatsTab(){
    const statsContent = document.getElementById('stats-content');
    if(!statsContent) return;
    
    // Import de la classe pour afficher le nom
    import('./classes.js').then(module => {
        const classData = player.class ? module.playerClasses[player.class] : null;
        const className = classData ? `${classData.emoji} ${classData.name}` : 'Aucune';
        
        // Calculer la progression XP
        const xpProgress = getXPProgress(player);
        const xpRemaining = getXPToNextLevel(player);
        
        statsContent.innerHTML = `
            <div class="stats-section">
                <h3>Informations</h3>
                <div class="stat-line">
                    <span class="stat-label">🪪 Nom:</span>
                    <span class="stat-value">${player.name || 'Aventurier'}</span>
                </div>
                <div class="stat-line">
                    <span class="stat-label">🎭 Classe:</span>
                    <span class="stat-value">${className}</span>
                </div>
                <div class="stat-line">
                    <span class="stat-label">⭐ Niveau:</span>
                    <span class="stat-value">${player.level}</span>
                </div>
                <div class="stat-line">
                    <span class="stat-label">📊 Expérience:</span>
                    <span class="stat-value">${player.xp} / ${player.xpToNextLevel} XP</span>
                </div>
                <div class="stat-line">
                    <div style="width: 100%; margin-top: 5px;">
                        <div class="xp-bar-container">
                            <progress class="xp-bar" value="${xpProgress}" max="100" style="width: 100%;"></progress>
                            <span class="xp-text">${xpProgress}% (${xpRemaining} XP restants)</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="stats-section">
                <h3>Caractéristiques</h3>
            <div class="stat-line">
                <span class="stat-label">💪 Force (Strength):</span>
                <span class="stat-value">${player.attributes.strength}</span>
                <span class="stat-effect">+${player.attributes.strength * 2} Attaque</span>
            </div>
            <div class="stat-line">
                <span class="stat-label">🏃 Agilité (Agility):</span>
                <span class="stat-value">${player.attributes.agility}</span>
                <span class="stat-effect">+${player.attributes.agility * 2} Défense</span>
            </div>
            <div class="stat-line">
                <span class="stat-label">🧠 Intelligence:</span>
                <span class="stat-value">${player.attributes.intelligence}</span>
                <span class="stat-effect">+${player.attributes.intelligence * 10} HP max, +${player.attributes.intelligence * 5} mana</span>
            </div>
            <div class="stat-line">
                <span class="stat-label">❤️ Endurance (Stamina):</span>
                <span class="stat-value">${player.attributes.stamina}</span>
                <span class="stat-effect">+${player.attributes.stamina * 15} HP max</span>
            </div>
            <div class="stat-line">
                <span class="stat-label">🎯 Moral (Morale):</span>
                <span class="stat-value">${player.attributes.morale}</span>
                <span class="stat-effect">+${player.attributes.morale * 3} Attaque</span>
            </div>
        </div>
        
        <div class="stats-section">
            <h3>Statistiques de combat</h3>
            <div class="stat-line">
                <span class="stat-label">⚔️ Attaque:</span>
                <span class="stat-value">${player.attack}</span>
            </div>
            <div class="stat-line">
                <span class="stat-label">🛡️ Défense:</span>
                <span class="stat-value">${player.defense || 0}</span>
            </div>
            <div class="stat-line">
                <span class="stat-label">❤️ HP Maximum:</span>
                <span class="stat-value">${player.maxHp}</span>
            </div>
            <div class="stat-line">
                <span class="stat-label">✨ Mana Maximum:</span>
                <span class="stat-value">${player.maxMana}</span>
            </div>
        </div>
        
        <div class="stats-section">
            <button onclick="window.clearPlayerSave()" class="secondary">🗑️ Effacer la sauvegarde</button>
        </div>
    `;
    });
}

// Fonction pour afficher une animation d'attaque qui recouvre la grille
export function showAttackAnimation(text, isPlayerAttack = true) {
    const boardDiv = document.getElementById('board');
    if(!boardDiv) return;
    
    // Créer l'overlay qui cache la grille
    const overlay = document.createElement('div');
    overlay.className = 'attack-overlay';
    
    // Créer le contenu de l'animation
    const attackDiv = document.createElement('div');
    attackDiv.className = 'attack-animation';
    attackDiv.innerHTML = text;
    
    // Couleur selon qui attaque
    if(isPlayerAttack) {
        overlay.classList.add('player-attack');
    } else {
        overlay.classList.add('enemy-attack');
    }
    
    overlay.appendChild(attackDiv);
    boardDiv.appendChild(overlay);
    
    // Supprimer après 3 secondes minimum
    setTimeout(() => {
        overlay.classList.add('fade-out');
        setTimeout(() => {
            if(overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }, 500);
    }, 1000);
}

// -------------------------------------
// Combat avec arme
export function useWeapon(){
    if(!player.equippedWeapon){ log("Aucune arme équipée !"); return; }
    const weapon = player.equippedWeapon;
    if(player.combatPoints < weapon.actionPoints){ 
        log(`Il faut ${weapon.actionPoints} points d'action pour utiliser ${weapon.name}.`); 
        return; 
    }
    if(player.hp<=0){ handlePlayerDeath(); return; }
    if(player.level < weapon.minLevel){ 
        log(`Nécessite niveau ${weapon.minLevel} pour utiliser ${weapon.name}`); 
        return; 
    }
    
    player.combatPoints -= weapon.actionPoints;
    const dmg = weapon.damage;
    enemy.hp -= dmg;
    
    // Icône selon le type d'arme
    const weaponIcons = {
        'sword': '⚔️',
        'axe': '🪓',
        'dagger': '🗡️',
        'mace': '🔨',
        'bow': '🏹',
        'staff': '🪄'
    };
    const icon = weaponIcons[weapon.type] || '⚔️';
    
    showAttackAnimation(`<div class="attack-icon">${icon}</div><div class="attack-title">${weapon.name.toUpperCase()}</div><div class="attack-damage">-${dmg} dégâts</div><div class="attack-target">→ ${enemy.name}</div>`, true);
    log(`${icon} Vous utilisez ${weapon.name} et infligez ${dmg} dégâts.`);
    
    finishPlayerTurn();
}

export function castSpell(spellId){
    const spell=player.activeSpells.find(s=>s.id===spellId);
    if(!spell){ log("Sort indisponible !"); return; }
    if(player.level<spell.minLevel){ log(`Nécessite niveau ${spell.minLevel}`); return; }
    
    // Vérifier le coût du sort (peut être un nombre ou un objet avec plusieurs couleurs)
    if(typeof spell.cost === 'number') {
        // Sort simple avec un seul coût de couleur
        if(player.mana[spell.color]<spell.cost){ log("Pas assez de mana !"); return; }
        player.mana[spell.color]-=spell.cost;
    } else if(typeof spell.cost === 'object') {
        // Sort de classe avec plusieurs coûts de mana
        for(const color in spell.cost) {
            if(!player.mana[color] || player.mana[color] < spell.cost[color]) {
                log(`Pas assez de mana ${color} !`);
                return;
            }
        }
        // Déduire tous les coûts
        for(const color in spell.cost) {
            player.mana[color] -= spell.cost[color];
        }
    }
    
    // Gérer les sorts avec effet spécial
    if(spell.effect) {
        // Import dynamique pour éviter les dépendances circulaires
        import('./classSpellEffects.js').then(module => {
            if(module.applyClassSpellEffect(spell)) {
                saveUpdate();
                finishPlayerTurn();
            } else {
                saveUpdate();
            }
        });
        return;
    }
    
    // Sorts standards (dégâts ou soins)
    if(spell.dmg){
        let dmg=Math.floor(spell.dmg*(1-(enemy.resistances[spell.color]||0)));
        enemy.hp-=dmg;
        showAttackAnimation(`<div class="attack-icon">🔥</div><div class="attack-title">${spell.name.toUpperCase()}</div><div class="attack-damage">-${Math.floor(dmg)} dégâts</div><div class="attack-target">→ ${enemy.name}</div>`, true);
        log(`🔥 ${spell.name} inflige ${dmg} dégâts.`);
    }
    if(spell.heal){
        player.hp=Math.min(player.maxHp,player.hp+spell.heal);
        showAttackAnimation(`<div class="attack-icon">💚</div><div class="attack-title">${spell.name.toUpperCase()}</div><div class="attack-heal">+${spell.heal} HP</div><div class="attack-target">→ Vous</div>`, true);
        log(`💚 ${spell.name} soigne ${spell.heal} HP.`);
    }
    
    updateStats();
    saveUpdate();
    
    finishPlayerTurn();
}

export function finishPlayerTurn(){
    // Vérifier si le joueur est mort
    if(player.hp<=0){
        handlePlayerDeath();
        return;
    }
    
    // Vérifier si le joueur a un tour bonus
    if(player.bonusTurn){
        player.bonusTurn = false;
        log("🎯 Tour bonus utilisé : pas d'attaque ennemie.");
        saveUpdate();
        return;
    }
    enemyTurn();
}

export function enemyTurn(){
    if(enemy.hp<=0){ handleEnemyDefeated(); return; }
    currentTurn = 'enemy';
    // show turn change before action
    updateStats();
    
    // Utiliser la nouvelle IA pour prendre une décision
    const decision = makeDecision();
    
    // Log la décision pour debug
    logDecision(decision);
    
    // Afficher la réflexion de l'ennemi
    log(`🤖 ${enemy.name} réfléchit... (${decision.reason})`);
    
    // Attendre le temps de réflexion avant d'agir
    setTimeout(()=>{
        // Exécuter l'action choisie par l'IA
        if(decision.action === 'spell'){
            const spell = decision.data.spell;
            
            // Consommer le mana du sort (gérer coût simple et multiple)
            if(typeof spell.cost === 'number') {
                enemy.mana[spell.color] -= spell.cost;
            } else if(typeof spell.cost === 'object') {
                for(const color in spell.cost) {
                    enemy.mana[color] -= spell.cost[color];
                }
            }
            
            if(spell.dmg){
                let dmg = Math.floor(spell.dmg * (1 - (player.resistances && player.resistances[spell.color] || 0)));
                player.hp -= dmg;
                showAttackAnimation(`<div class="attack-icon">🔥</div><div class="attack-title">${spell.name.toUpperCase()}</div><div class="attack-damage">-${Math.floor(dmg)} dégâts</div><div class="attack-source">${enemy.name}</div><div class="attack-target">→ Vous</div>`, false);
                log(`🔥 ${enemy.name} lance ${spell.name} ! ${dmg} dégâts.`);
            }
            if(spell.heal){
                enemy.hp = Math.min(enemy.maxHp, enemy.hp + spell.heal);
                showAttackAnimation(`<div class="attack-icon">💚</div><div class="attack-title">${spell.name.toUpperCase()}</div><div class="attack-heal">+${spell.heal} HP</div><div class="attack-source">${enemy.name}</div>`, false);
                log(`💚 ${enemy.name} utilise ${spell.name} et soigne ${spell.heal} HP.`);
            }
            
            // Vérifier l'état après l'action
            finishEnemyTurn();
            
        } else if(decision.action === 'weapon'){
            enemy.combatPoints -= enemy.weapon.actionPoints;
            let dmg = enemy.weapon.damage;
            player.hp -= dmg;
            const weaponIcons = {
                'sword': '⚔️',
                'axe': '🪓',
                'dagger': '🗡️',
                'mace': '🔨',
                'bow': '🏹',
                'staff': '🪄'
            };
            const icon = weaponIcons[enemy.weapon.type] || '⚔️';
            showAttackAnimation(`<div class="attack-icon">${icon}</div><div class="attack-title">${enemy.weapon.name.toUpperCase()}</div><div class="attack-damage">-${dmg} dégâts</div><div class="attack-source">${enemy.name}</div><div class="attack-target">→ Vous</div>`, false);
            log(`${icon} ${enemy.name} utilise ${enemy.weapon.name} ! ${dmg} dégâts.`);
            
            // Vérifier l'état après l'action
            finishEnemyTurn();
            
        } else {
            // L'ennemi joue sur le plateau
            enemyMakeMove();
            
            // Pas besoin d'appeler finishEnemyTurn ici car checkMatches le fera
            // après avoir traité tous les combos
        }
    }, decision.thinkingTime);
}

// Fonction pour terminer le tour de l'ennemi
export function finishEnemyTurn(){
    if(player.hp<=0){
        handlePlayerDeath();
        return;
    }
    
    // Vérifier si l'ennemi a un tour bonus
    if(enemy.bonusTurn){
        enemy.bonusTurn = false;
        log("🎯 L'ennemi a un tour bonus et rejoue !");
        updateStats();
        saveUpdate();
        // L'ennemi rejoue immédiatement
        setTimeout(() => {
            enemyTurn();
        }, 1000);
    } else {
        // Tour suivant : joueur
        updateStats();
        saveUpdate();
        currentTurn = 'player';
        updateStats(); // Pour mettre à jour le liseré
    }
}

// -------------------------------------
// progression
export function handleEnemyDefeated(){
    log(`🏆 ${enemy.name} est vaincu !`);
    
    // Calculer et donner l'XP
    const xpGain = calculateXPGain(enemy.level || player.level, player.level);
    log(`⭐ Vous gagnez ${xpGain} XP !`);
    
    const levelUpResult = addXP(player, xpGain);
    
    // 40% de chance de ne rien obtenir
    const dropChance = Math.random();
    if(dropChance > 0.4) {
        // Obtenir un objet ou une arme aléatoire
        const itemOrWeapon = Math.random();
        
        if(itemOrWeapon < 0.7) {
            // 70% de chance d'obtenir un objet
            const droppedItem = getRandomItem(player.level);
            if(droppedItem) {
                player.inventory.push({...droppedItem, applied: false});
                const rarityEmoji = getRarityEmoji(droppedItem.rarity);
                log(`${rarityEmoji} Vous obtenez : ${droppedItem.name} !`);
                
                // Appliquer immédiatement les effets des artefacts
                if(droppedItem.type === "artifact") {
                    applyArtifactEffects(player);
                    log(`✨ ${droppedItem.description}`);
                }
            }
        } else {
            // 30% de chance d'obtenir une arme
            const availableWeapons = getAvailableWeapons(player.level + 2).filter(
                w => w.minLevel >= Math.max(1, player.level - 3)
            );
            if(availableWeapons.length > 0) {
                const randomWeapon = availableWeapons[Math.floor(Math.random() * availableWeapons.length)];
                // Vérifier si le joueur possède déjà cette arme
                if(!player.weapons.some(w => w.id === randomWeapon.id)) {
                    player.weapons.push(randomWeapon);
                    // Mettre à jour la liste des armes disponibles du joueur
                    updateAvailableWeapons();
                    const weaponIcons = {
                        'sword': '⚔️',
                        'axe': '🪓',
                        'dagger': '🗡️',
                        'mace': '🔨',
                        'bow': '🏹',
                        'staff': '🪄'
                    };
                    const icon = weaponIcons[randomWeapon.type] || '⚔️';
                    log(`${icon} Vous obtenez : ${randomWeapon.name} !`);
                } else {
                    log(`💰 Vous obtenez quelques pièces d'or (arme déjà possédée).`);
                }
            }
        }
    } else {
        log(`💨 L'ennemi ne laisse rien derrière lui...`);
    }
    
    // Gestion de la montée de niveau
    if(levelUpResult.leveledUp) {
        player.hp = Math.min(player.maxHp, player.hp + 20);
        log(`🎉 Niveau ${player.level} atteint ! HP restauré.`);
        if(levelUpResult.levelsGained > 1) {
            log(`✨ Vous avez gagné ${levelUpResult.levelsGained} niveaux d'un coup !`);
        }
        updateAvailableSpells();
        updateAvailableWeapons();
        updateInventoryTab();
        showAttributeMenu();
    } else {
        log(`📊 Progression: ${player.xp}/${player.xpToNextLevel} XP`);
    }
    
    // Marquer le combat comme terminé
    gameState.combatState = 'finished';
    
    // Cacher les éléments de combat
    document.querySelector('.stats-container').style.display = 'none';
    document.getElementById('board').style.display = 'none';
    document.getElementById('spells-container').style.display = 'none';
    
    // Cacher le bouton "Abandonner"
    const abandonBtn = document.getElementById('abandon-combat-btn');
    if(abandonBtn) {
        abandonBtn.style.display = 'none';
    }
    
    // Afficher le bouton "Nouveau Combat"
    const newCombatBtn = document.getElementById('new-combat-btn');
    if(newCombatBtn) {
        newCombatBtn.style.display = 'block';
    }
    
    // Réafficher les onglets
    const tabs = document.querySelector('.tabs');
    if(tabs) {
        tabs.style.display = 'flex';
    }
    
    log(`⚔️ Cliquez sur "Nouveau Combat" pour continuer ou modifiez vos sorts/armes.`);
}

export function showAttributeMenu(){
    const choices=["strength","agility","intelligence","stamina","morale"];
    let choice=prompt(
        "Attribuez 1 point d'attribut:\n1. Strength\n2. Agility\n3. Intelligence\n4. Stamina\n5. Morale",
        "1"
    );
    let idx=parseInt(choice)-1;
    if(idx<0||idx>=choices.length){ log("Choix invalide."); return; }
    let attr=choices[idx];
    player.attributes[attr]++;
    applyAttributeBonus(attr);
    log(`📈 +1 ${attr}`);
    saveUpdate();
}

export function applyAttributeBonus(attr){
    switch(attr){
        case "strength": player.attack+=2; break;
        case "agility": player.defense=(player.defense||0)+2; break;
        case "intelligence": player.maxHp+=10; Object.keys(player.mana).forEach(c=>player.mana[c]+=5); break;
        case "stamina": player.maxHp+=15; break;
        case "morale": player.attack+=3; break;
    }
}

// -------------------------------------
// sorts
export function updateAvailableSpells(){
    // Si le joueur a une classe, inclure les sorts de classe
    let allAvailableSpells = [...allSpells.filter(sp=>player.level>=sp.minLevel)];
    
    if(player.class) {
        import('./classes.js').then(module => {
            const classSpells = module.getClassSpells(player.class, player.level);
            allAvailableSpells = [...allAvailableSpells, ...classSpells];
            player.availableSpells = allAvailableSpells;
            updateActiveSpells();
        });
    } else {
        player.availableSpells = allAvailableSpells;
        updateActiveSpells();
    }
}

function updateActiveSpells() {
    // garder seulement les sorts actifs valides
    player.activeSpells = player.activeSpells.filter(sp => 
        player.availableSpells.some(avail => avail.id === sp.id)
    );
    // si moins de 4 sorts actifs, en ajouter automatiquement
    if(player.activeSpells.length < 4){
        for(const sp of player.availableSpells){
            if(!player.activeSpells.some(active => active.id === sp.id)){
                player.activeSpells.push(sp);
                if(player.activeSpells.length >= 4) break;
            }
        }
    }
    // maintenir la compatibilité avec l'ancien code
    player.spells = player.activeSpells;
}

export function createSpellButtons(){
    const container=document.getElementById('spell-buttons');
    if(!container) return;
    hideSpellTooltip();
    container.innerHTML="";
    player.activeSpells.forEach(sp=>{
        const btn=document.createElement('button');
        const damageText = sp.dmg ? ` - ${sp.dmg} dmg` : '';
        const healText = sp.heal ? ` - ${sp.heal} HP` : '';
        
        // Gérer l'affichage du coût (simple ou multiple)
        let costHTML = '';
        let hasEnoughMana = true;
        if(typeof sp.cost === 'number') {
            costHTML = `<span class="mana-dot mana-${sp.color}"></span>${sp.cost}`;
            hasEnoughMana = player.mana[sp.color] >= sp.cost;
        } else if(typeof sp.cost === 'object') {
            costHTML = Object.keys(sp.cost).map(color => 
                `<span class="mana-dot mana-${color}"></span>${sp.cost[color]}`
            ).join(' ');
            // Vérifier si on a assez de mana pour tous les coûts
            hasEnoughMana = Object.keys(sp.cost).every(color => player.mana[color] >= sp.cost[color]);
        }
        
        btn.innerHTML=`${sp.name}${costHTML}${damageText}${healText}`;
        if(player.level<sp.minLevel || !hasEnoughMana) {
            btn.classList.add('disabled');
            btn.onclick = null; // Désactiver le clic
        } else {
            btn.onclick=()=>castSpell(sp.id);
        }

        const showDetails = () => showSpellTooltip(btn, sp);
        const hideDetails = () => hideSpellTooltip();
        btn.addEventListener('mouseenter', showDetails);
        btn.addEventListener('mouseleave', hideDetails);
        btn.addEventListener('mousedown', showDetails);
        btn.addEventListener('mouseup', hideDetails);
        btn.addEventListener('touchstart', showDetails, { passive: true });
        btn.addEventListener('touchend', hideDetails);
        btn.addEventListener('touchcancel', hideDetails);
        btn.addEventListener('focus', showDetails);
        btn.addEventListener('blur', hideDetails);

        container.appendChild(btn);
    });
    updateSpellsTab();
}

function getSpellTooltipHtml(spell) {
    let effectText = 'Aucun effet';
    if(spell.effect) {
        effectText = spell.description || 'Effet spécial';
    } else if(spell.dmg && spell.heal) {
        effectText = `Inflige ${spell.dmg} dégâts et soigne ${spell.heal} HP`;
    } else if(spell.dmg) {
        effectText = `Inflige ${spell.dmg} dégâts`;
    } else if(spell.heal) {
        effectText = `Soigne ${spell.heal} HP`;
    }

    return `<div class="spell-tooltip-line">🧠 ${effectText}</div>`;
}

function ensureSpellTooltip() {
    let tooltip = document.getElementById('spell-detail-tooltip');
    if(!tooltip){
        tooltip = document.createElement('div');
        tooltip.id = 'spell-detail-tooltip';
        tooltip.className = 'spell-detail-tooltip';
        document.body.appendChild(tooltip);
    }
    return tooltip;
}

function showSpellTooltip(button, spell) {
    if(!button || !spell) return;
    const tooltip = ensureSpellTooltip();
    tooltip.innerHTML = getSpellTooltipHtml(spell);
    tooltip.classList.add('visible');

    const rect = button.getBoundingClientRect();
    const tooltipWidth = 260;
    const margin = 10;
    const left = Math.min(
        window.innerWidth - tooltipWidth - margin,
        Math.max(margin, rect.left + (rect.width / 2) - (tooltipWidth / 2))
    );
    const top = Math.max(margin, rect.top - 120);

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
}

function hideSpellTooltip() {
    const tooltip = document.getElementById('spell-detail-tooltip');
    if(tooltip){
        tooltip.classList.remove('visible');
    }
}

// mise à jour de l'onglet sorts
export function updateSpellsTab(){
    const activeList = document.getElementById('active-spells-list');
    const availableList = document.getElementById('available-spells-list');
    if(!activeList || !availableList) return;
    
    // sorts actifs
    activeList.innerHTML = '<h3>Sorts actifs (' + player.activeSpells.length + '/4)</h3>';
    if(player.activeSpells.length === 0){
        activeList.innerHTML += '<p><em>Aucun sort équipé</em></p>';
    } else {
        player.activeSpells.forEach(sp => {
            const div = document.createElement('div');
            div.className = 'spell-item active-spell';
            const damageText = sp.dmg ? ` • ${sp.dmg} dmg` : '';
            const healText = sp.heal ? ` • ${sp.heal} HP` : '';
            const effectText = sp.effect ? ` • ${sp.description}` : '';
            
            // Gérer l'affichage du coût
            let costHTML = '';
            if(typeof sp.cost === 'number') {
                costHTML = `<span class="mana-dot mana-${sp.color}"></span>${sp.cost}`;
            } else if(typeof sp.cost === 'object') {
                costHTML = Object.keys(sp.cost).map(color => 
                    `<span class="mana-dot mana-${color}"></span>${sp.cost[color]}`
                ).join(' ');
            }
            
            div.innerHTML = `
                <span class="spell-name">${sp.name}</span>
                <span class="spell-info">${costHTML}${damageText}${healText}${effectText}</span>
                <button class="spell-action" onclick="window.unequipSpell('${sp.id}')">❌ Retirer</button>
            `;
            activeList.appendChild(div);
        });
    }
    
    // sorts disponibles (non équipés)
    availableList.innerHTML = '';
    const unequipped = player.availableSpells.filter(sp => 
        !player.activeSpells.some(active => active.id === sp.id)
    );
    if(unequipped.length === 0){
        availableList.innerHTML = '<p><em>Tous vos sorts sont équipés</em></p>';
    } else {
        unequipped.forEach(sp => {
            const div = document.createElement('div');
            div.className = 'spell-item available-spell';
            const canEquip = player.activeSpells.length < 4;
            const damageText = sp.dmg ? ` • ${sp.dmg} dmg` : '';
            const healText = sp.heal ? ` • ${sp.heal} HP` : '';
            const effectText = sp.effect ? ` • ${sp.description}` : '';
            
            // Gérer l'affichage du coût
            let costHTML = '';
            if(typeof sp.cost === 'number') {
                costHTML = `<span class="mana-dot mana-${sp.color}"></span>${sp.cost}`;
            } else if(typeof sp.cost === 'object') {
                costHTML = Object.keys(sp.cost).map(color => 
                    `<span class="mana-dot mana-${color}"></span>${sp.cost[color]}`
                ).join(' ');
            }
            
            div.innerHTML = `
                <span class="spell-name">${sp.name}</span>
                <span class="spell-info">${costHTML}${damageText}${healText}${effectText}</span>
                <button class="spell-action" ${canEquip ? '' : 'disabled'} onclick="window.equipSpell('${sp.id}')">✅ Équiper</button>
            `;
            availableList.appendChild(div);
        });
    }
}

export function equipSpell(spellId){
    if(gameState.combatState === 'active'){
        log('⚠️ Vous ne pouvez pas modifier vos sorts pendant le combat !');
        return;
    }
    if(player.activeSpells.length >= 4){
        log('⚠️ Maximum 4 sorts actifs atteint.');
        return;
    }
    const spell = player.availableSpells.find(s => s.id === spellId);
    if(!spell) return;
    if(player.activeSpells.some(s => s.id === spellId)) return;
    player.activeSpells.push(spell);
    player.spells = player.activeSpells;
    saveUpdate();
    log(`✅ ${spell.name} équipé.`);
}

export function unequipSpell(spellId){
    if(gameState.combatState === 'active'){
        log('⚠️ Vous ne pouvez pas modifier vos sorts pendant le combat !');
        return;
    }
    player.activeSpells = player.activeSpells.filter(s => s.id !== spellId);
    player.spells = player.activeSpells;
    saveUpdate();
    const spell = player.availableSpells.find(s => s.id === spellId);
    if(spell) log(`❌ ${spell.name} retiré.`);
}

// -------------------------------------
// Applique les aptitudes de début de combat pour le joueur et l'ennemi
export function applyStartingAbilities(){
    // Réinitialiser le mana à 0
    player.mana = { red:0, blue:0, green:0, yellow:0, purple:0 };
    enemy.mana = { red:0, blue:0, green:0, yellow:0, purple:0 };
    
    // Appliquer les aptitudes du joueur
    if(player.abilities && player.abilities.length > 0){
        player.abilities.forEach(abilityId => {
            const ability = allAbilities.find(a => a.id === abilityId);
            if(ability && ability.startMana){
                Object.keys(ability.startMana).forEach(color => {
                    player.mana[color] += ability.startMana[color];
                });
                log(`✨ Aptitude: ${ability.name} activée`);
            }
        });
    }
    
    // Appliquer les aptitudes de l'ennemi
    if(enemy.abilities && enemy.abilities.length > 0){
        enemy.abilities.forEach(abilityId => {
            const ability = allAbilities.find(a => a.id === abilityId);
            if(ability && ability.startMana){
                Object.keys(ability.startMana).forEach(color => {
                    enemy.mana[color] += ability.startMana[color];
                });
            }
        });
    }
}

// ennemis
export function newEnemy(){
    enemy = generateRandomEnemy(player.level, allSpells, allWeapons);
    
    // Ajuster automatiquement la difficulté de l'IA selon le niveau de l'ennemi
    setAIDifficultyByLevel(enemy.level, player.level);
    
    // Afficher le niveau de l'ennemi dans les logs
    if (enemy.level > player.level) {
        log(`⚠️ ${enemy.name} (Niveau ${enemy.level}) apparaît ! Il est plus fort que vous !`);
    } else {
        log(`⚔️ ${enemy.name} (Niveau ${enemy.level}) apparaît !`);
    }
    // Réinitialiser le mana de l'ennemi à 0 puis appliquer ses aptitudes
    enemy.mana = { red:0, blue:0, green:0, yellow:0, purple:0 };
    applyStartingAbilities();
    log(`🔹 Un nouvel ennemi: ${enemy.name}`);
    if(enemy.weapon){
        log(`🗡️ L'ennemi est équipé de : ${enemy.weapon.name}`);
    } else {
        log(`🔮 L'ennemi n'a pas d'arme (utilise uniquement la magie)`);
    }
    if(enemy.spells.length > 0){
        log(`✨ L'ennemi dispose de sorts : ${enemy.spells.map(s => s.name).join(", ")}`);
    }
    updateEnemySpells();
    // déterminer au hasard qui commence
    decideFirstTurn();
}

// détermine le premier tour selon l'agilité (plus d'agilité = joueur plus rapide)
export function decideFirstTurn(){
    const playerAgility = player.attributes.agility || 0;
    const enemyAgility = enemy.attributes?.agility || 0;
    
    let starter;
    if(playerAgility > enemyAgility){
        starter = 'player';
        log(`⚡ Vous êtes plus agile ! Vous commencez en premier.`);
    } else if(enemyAgility > playerAgility){
        starter = 'enemy';
        log(`⚡ ${enemy.name} est plus agile ! Il commence en premier.`);
    } else {
        // En cas d'égalité, le joueur commence
        starter = 'player';
        log(`⚖️ Égalité d'agilité, vous commencez !`);
    }
    
    currentTurn = starter;
    log(`🔄 Premier tour : ${starter === 'player' ? 'Joueur' : 'Ennemi'}`);
    if(starter === 'enemy'){
        enemyTurn();
    }
}

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

export function equipWeapon(weaponId){
    if(gameState.combatState === 'active'){
        log('⚠️ Vous ne pouvez pas modifier vos armes pendant le combat !');
        return;
    }
    const weapon = allWeapons.find(w => w.id === weaponId);
    if(!weapon) return;
    if(player.level < weapon.minLevel){
        log(`⚠️ Nécessite niveau ${weapon.minLevel} pour équiper ${weapon.name}.`);
        return;
    }
    player.equippedWeapon = weapon;
    saveUpdate();
    log(`✅ ${weapon.name} équipée.`);
    createWeaponButton();
}

export function unequipWeapon(){
    if(gameState.combatState === 'active'){
        log('⚠️ Vous ne pouvez pas modifier vos armes pendant le combat !');
        return;
    }
    if(!player.equippedWeapon) return;
    const weaponName = player.equippedWeapon.name;
    player.equippedWeapon = null;
    saveUpdate();
    log(`❌ ${weaponName} retirée.`);
    createWeaponButton();
}

export function createWeaponButton(){
    const container = document.getElementById('weapon-button');
    if(!container) return;
    container.innerHTML = "";
    
    if(!player.equippedWeapon){
        if(!player.availableWeapons || player.availableWeapons.length === 0) {
            container.innerHTML = '';
        } else {
            container.innerHTML = '<div style="padding: 10px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; font-size: 0.85em; color: #856404;"><strong>⚠️ Aucune arme équipée</strong><br>Allez dans l\'onglet Armes pour en équiper une.</div>';
        }
        updateWeaponsTab();
        return;
    }
    
    const weapon = player.equippedWeapon;
    const btn = document.createElement('button');
    btn.className = 'weapon-btn';
    
    // Icône selon le type d'arme
    const weaponIcons = {
        'sword': '⚔️',
        'axe': '🪓',
        'dagger': '🗡️',
        'mace': '🔨',
        'bow': '🏹',
        'staff': '🪄'
    };
    const icon = weaponIcons[weapon.type] || '⚔️';
    
    btn.innerHTML = `${icon} ${weapon.name} <span class="weapon-cost">${weapon.actionPoints} PA</span> - ${weapon.damage} dmg`;
    if(player.level < weapon.minLevel || player.combatPoints < weapon.actionPoints) {
        btn.classList.add('disabled');
        btn.onclick = null; // Désactiver le clic
    } else {
        btn.onclick = () => useWeapon();
    }
    container.appendChild(btn);
    
    updateWeaponsTab();
}

// mise à jour de l'onglet armes
export function updateWeaponsTab(){
    const equippedDiv = document.getElementById('equipped-weapon');
    const availableList = document.getElementById('available-weapons-list');
    if(!equippedDiv || !availableList) return;
    
    // Arme équipée
    equippedDiv.innerHTML = '<h3>Arme équipée</h3>';
    if(!player.equippedWeapon){
        equippedDiv.innerHTML += '<p><em>Aucune arme équipée</em></p>';
    } else {
        const weapon = player.equippedWeapon;
        const weaponIcons = {
            'sword': '⚔️',
            'axe': '🪓',
            'dagger': '🗡️',
            'mace': '🔨',
            'bow': '🏹',
            'staff': '🪄'
        };
        const icon = weaponIcons[weapon.type] || '⚔️';
        const div = document.createElement('div');
        div.className = 'weapon-item equipped-weapon';
        div.innerHTML = `
            <span class="weapon-icon">${icon}</span>
            <div class="weapon-details">
                <span class="weapon-name">${weapon.name}</span>
                <span class="weapon-stats">${weapon.damage} dégâts • ${weapon.actionPoints} PA • Niv. ${weapon.minLevel}</span>
                <span class="weapon-description">${weapon.description}</span>
            </div>
            <button class="weapon-action" onclick="window.unequipWeapon()">❌ Retirer</button>
        `;
        equippedDiv.appendChild(div);
    }
    
    // Armes disponibles
    availableList.innerHTML = '';
    if(!player.availableWeapons || player.availableWeapons.length === 0){
        availableList.innerHTML = '<div style="padding: 15px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; margin-top: 15px;"><strong>💡 Aucune arme en votre possession</strong><br>Les armes peuvent être obtenues en gagnant des combats !</div>';
        return;
    }
    player.availableWeapons.forEach(weapon => {
        const weaponIcons = {
            'sword': '⚔️',
            'axe': '🪓',
            'dagger': '🗡️',
            'mace': '🔨',
            'bow': '🏹',
            'staff': '🪄'
        };
        const icon = weaponIcons[weapon.type] || '⚔️';
        const div = document.createElement('div');
        div.className = 'weapon-item available-weapon';
        const isEquipped = player.equippedWeapon && player.equippedWeapon.id === weapon.id;
        if(isEquipped) div.classList.add('is-equipped');
        
        div.innerHTML = `
            <span class="weapon-icon">${icon}</span>
            <div class="weapon-details">
                <span class="weapon-name">${weapon.name}</span>
                <span class="weapon-stats">${weapon.damage} dégâts • ${weapon.actionPoints} PA • Niv. ${weapon.minLevel}</span>
                <span class="weapon-description">${weapon.description}</span>
            </div>
            <button class="weapon-action" ${isEquipped ? 'disabled' : ''} onclick="window.equipWeapon('${weapon.id}')">${isEquipped ? '✅ Équipée' : '📦 Équiper'}</button>
        `;
        availableList.appendChild(div);
    });
}

// -------------------------------------
// -------------------------------------
// Inventaire
export function updateInventoryTab(){
    const inventoryList = document.getElementById('inventory-list');
    if(!inventoryList) return;
    
    inventoryList.innerHTML = '<h3>Inventaire</h3>';
    
    if(!player.inventory || player.inventory.length === 0){
        inventoryList.innerHTML += '<p><em>Votre inventaire est vide</em></p>';
        return;
    }
    
    // Grouper les objets par type
    const consumables = player.inventory.filter(item => item.type === 'consumable');
    const artifacts = player.inventory.filter(item => item.type === 'artifact');
    
    // Afficher les consommables
    if(consumables.length > 0) {
        inventoryList.innerHTML += '<h4 style="margin-top: 15px;">🧪 Consommables</h4>';
        consumables.forEach((item, index) => {
            const rarityEmoji = getRarityEmoji(item.rarity);
            const rarityColor = getRarityColor(item.rarity);
            const div = document.createElement('div');
            div.className = 'item-card consumable-item';
            div.style.borderLeft = `4px solid ${rarityColor}`;
            
            const canUse = gameState.combatState === 'active';
            
            div.innerHTML = `
                <div class="item-header">
                    <span class="item-name">${rarityEmoji} ${item.name}</span>
                    <button class="item-use-btn" ${canUse ? '' : 'disabled'} onclick="window.useInventoryItem('${item.id}', ${index})">${canUse ? '✅ Utiliser' : '❌ Hors combat'}</button>
                </div>
                <div class="item-description">${item.description}</div>
            `;
            inventoryList.appendChild(div);
        });
    }
    
    // Afficher les artefacts
    if(artifacts.length > 0) {
        inventoryList.innerHTML += '<h4 style="margin-top: 15px;">✨ Artefacts (Effets permanents)</h4>';
        artifacts.forEach(item => {
            const rarityEmoji = getRarityEmoji(item.rarity);
            const rarityColor = getRarityColor(item.rarity);
            const div = document.createElement('div');
            div.className = 'item-card artifact-item';
            div.style.borderLeft = `4px solid ${rarityColor}`;
            div.innerHTML = `
                <div class="item-header">
                    <span class="item-name">${rarityEmoji} ${item.name}</span>
                    <span class="artifact-badge">⚡ Actif</span>
                </div>
                <div class="item-description">${item.description}</div>
            `;
            inventoryList.appendChild(div);
        });
    }
}

export function useInventoryItem(itemId, index){
    if(gameState.combatState !== 'active'){
        log('⚠️ Vous ne pouvez utiliser des objets qu\'en combat !');
        return;
    }
    
    const result = useItem(itemId, player, enemy);
    if(result.success){
        log(result.message);
        updateInventoryTab();
        saveUpdate();
    } else {
        log(`⚠️ ${result.message}`);
    }
}

// Exports pour les fonctions accessibles globalement
window.equipSpell = equipSpell;
window.unequipSpell = unequipSpell;
window.equipWeapon = equipWeapon;
window.unequipWeapon = unequipWeapon;
window.useInventoryItem = useInventoryItem;
