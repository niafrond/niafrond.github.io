// logique globale du joueur, ennemis, combat et interface

import { colors } from "./constants.js";
import { generateRandomEnemy } from "./enemies.js";
import { allWeapons, getAvailableWeapons, getWeaponById } from "./weapons.js";
import { enemyMakeMove, setGameStarted } from "./board.js";
import { makeDecision, setAIDifficulty, getAIDifficulty, logDecision, setAIDifficultyByLevel } from "./enemyAI.js";
import { getRandomItem, getRarityEmoji, getRarityColor, useItem, applyArtifactEffects } from "./items.js";
import { initializeXP, addXP, calculateXPGain, getXPProgress, getXPToNextLevel } from "./experience.js";

const BASE_MANA_CAP = 50;
const EMPTY_MANA_POOL = { red:0, blue:0, green:0, yellow:0, purple:0 };
const WEAPON_ICONS = {
    sword: '⚔️',
    axe: '🪓',
    dagger: '🗡️',
    mace: '🔨',
    bow: '🏹',
    staff: '🪄'
};

// Règles paramétrables: une aptitude influence uniquement la couleur de mana associée.
export const ATTRIBUTE_MANA_RULES = {
    strength: { color: "red", bonuses: { initial: 1, gain: 1, max: 2 } },
    agility: { color: "yellow", bonuses: { initial: 1, gain: 1, max: 2 } },
    stamina: { color: "green", bonuses: { initial: 1, gain: 1, max: 2 } },
    intelligence: { color: "blue", bonuses: { initial: 1, gain: 1, max: 2 } },
    morale: { color: "purple", bonuses: { initial: 1, gain: 1, max: 2 } }
};

export function getPrimaryAttributeEffect(entity, attribute){
    return Math.max(0, Math.floor(entity?.attributes?.[attribute] || 0));
}

function getAssociatedAttributeByColor(color){
    return Object.keys(ATTRIBUTE_MANA_RULES).find(attr => ATTRIBUTE_MANA_RULES[attr].color === color);
}

export function getAttributeManaBonus(entity, color, bonusType){
    const attribute = getAssociatedAttributeByColor(color);
    if(!attribute) return 0;
    const fixedBonus = ATTRIBUTE_MANA_RULES[attribute]?.bonuses?.[bonusType] || 0;
    if(fixedBonus <= 0) return 0;
    return getPrimaryAttributeEffect(entity, attribute) * fixedBonus;
}

export function getManaCapForColor(entity, color){
    const baseCap = Math.max(0, Math.floor(entity?.maxMana ?? BASE_MANA_CAP));
    return baseCap + getAttributeManaBonus(entity, color, "max");
}

export function recalculateManaCaps(entity){
    if(!entity || !entity.mana) return;
    const manaCaps = {};
    Object.keys(entity.mana).forEach(color => {
        manaCaps[color] = getManaCapForColor(entity, color);
    });
    entity.manaCaps = manaCaps;
}

function clampManaToCaps(entity){
    if(!entity || !entity.mana) return;
    recalculateManaCaps(entity);
    Object.keys(entity.mana).forEach(color => {
        entity.mana[color] = Math.min(entity.manaCaps[color], Math.max(0, Math.floor(entity.mana[color] || 0)));
    });
}

export function addManaForColor(entity, color, baseGain, options = {}){
    if(!entity || !entity.mana || !Object.prototype.hasOwnProperty.call(entity.mana, color)) {
        return { before: 0, after: 0, totalGain: 0, gainBonus: 0, cap: 0, gained: 0 };
    }

    const before = Math.max(0, Math.floor(entity.mana[color] || 0));
    const applyGainBonus = options.applyGainBonus !== false;
    const gainBonus = applyGainBonus ? getAttributeManaBonus(entity, color, "gain") : 0;
    const totalGain = Math.max(0, Math.floor((baseGain || 0) + gainBonus));
    const cap = getManaCapForColor(entity, color);
    const after = Math.min(cap, before + totalGain);
    entity.mana[color] = after;
    recalculateManaCaps(entity);

    return {
        before,
        after,
        totalGain,
        gainBonus,
        cap,
        gained: Math.max(0, after - before)
    };
}

export function getWeaponIcon(weaponType){
    return WEAPON_ICONS[weaponType] || '⚔️';
}

export function canEntityCastSpell(entity, spell){
    if(!entity || !entity.mana || !spell) return false;

    if(typeof spell.cost === 'number') {
        return (entity.mana[spell.color] || 0) >= spell.cost;
    }

    if(spell.cost && typeof spell.cost === 'object') {
        return Object.entries(spell.cost).every(([color, amount]) =>
            (entity.mana[color] || 0) >= amount
        );
    }

    return true;
}

function getMissingManaColor(entity, spell){
    if(!entity || !entity.mana || !spell) return null;

    if(typeof spell.cost === 'number') {
        return (entity.mana[spell.color] || 0) >= spell.cost ? null : spell.color;
    }

    if(spell.cost && typeof spell.cost === 'object') {
        for(const [color, amount] of Object.entries(spell.cost)) {
            if((entity.mana[color] || 0) < amount) return color;
        }
    }

    return null;
}

export function consumeSpellMana(entity, spell){
    if(!entity || !entity.mana || !spell) return;

    if(typeof spell.cost === 'number') {
        entity.mana[spell.color] = Math.max(0, (entity.mana[spell.color] || 0) - spell.cost);
        return;
    }

    if(spell.cost && typeof spell.cost === 'object') {
        for(const [color, amount] of Object.entries(spell.cost)) {
            entity.mana[color] = Math.max(0, (entity.mana[color] || 0) - amount);
        }
    }
}

function applyStandardSpellEffects(caster, target, spell, isPlayerCaster){
    const intelligenceBonus = getPrimaryAttributeEffect(caster, "intelligence");

    if(spell.dmg){
        const targetResistance = target.resistances?.[spell.color] || 0;
        const dmg = Math.floor((spell.dmg + intelligenceBonus) * (1 - targetResistance));
        target.hp -= dmg;

        if(isPlayerCaster) {
            showCombatAnimation({ icon: '🔥', title: spell.name, damage: `-${Math.floor(dmg)} dégâts`, target: `→ ${target.name}` }, true);
            log(`🔥 ${spell.name} inflige ${dmg} dégâts.`);
        } else {
            showCombatAnimation({ icon: '🔥', title: spell.name, damage: `-${Math.floor(dmg)} dégâts`, source: caster.name, target: '→ Vous' }, false);
            log(`🔥 ${caster.name} lance ${spell.name} ! ${dmg} dégâts.`);
        }
    }

    if(spell.heal){
        const healAmount = spell.heal + intelligenceBonus;
        caster.hp = Math.min(caster.maxHp, caster.hp + healAmount);

        if(isPlayerCaster) {
            showCombatAnimation({ icon: '💚', title: spell.name, heal: `+${healAmount} HP`, target: '→ Vous' }, true);
            log(`💚 ${spell.name} soigne ${healAmount} HP.`);
        } else {
            showCombatAnimation({ icon: '💚', title: spell.name, heal: `+${healAmount} HP`, source: caster.name }, false);
            log(`💚 ${caster.name} utilise ${spell.name} et soigne ${healAmount} HP.`);
        }
    }
}

// joueur
export let player = {
    name: "Aventurier",
    hp: 100,
    maxHp: 100,
    mana: { ...EMPTY_MANA_POOL },
    maxMana: BASE_MANA_CAP,
    manaCaps: { red:BASE_MANA_CAP, blue:BASE_MANA_CAP, green:BASE_MANA_CAP, yellow:BASE_MANA_CAP, purple:BASE_MANA_CAP },
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
    inventory: [],  // inventaire - 1 objet max
    tempAttack: 0,  // bonus d'attaque temporaire
    tempDefense: 0,  // bonus de défense temporaire
    hasRevive: false,  // possède un effet de résurrection
    revivePercent: 0,  // pourcentage de HP à la résurrection
    unspentLevelPoints: 0 // points d'attribut a depenser apres les gains de niveaux
};

// tour actuel
export let currentTurn = 'player';

// état du combat (objet pour pouvoir modifier la propriété)
export const gameState = { 
    combatState: 'ready' // 'ready' (avant combat), 'active' (en cours), 'finished' (terminé)
};

const combatRewards = {
    xpGained: 0,
    xpApplied: false,
    items: [],
    weapons: []
};

function resetCombatRewards(){
    combatRewards.xpGained = 0;
    combatRewards.xpApplied = false;
    combatRewards.items = [];
    combatRewards.weapons = [];
}

function queueCombatXP(xpAmount){
    const safeXP = Math.max(0, Math.floor(xpAmount || 0));
    if(safeXP <= 0) return 0;
    combatRewards.xpGained += safeXP;
    return safeXP;
}

function applyCombatXPAtEnd(){
    if(combatRewards.xpApplied) {
        return {
            xpApplied: 0,
            leveledUp: false,
            levelsGained: 0
        };
    }

    const pendingXP = Math.max(0, Math.floor(combatRewards.xpGained || 0));
    combatRewards.xpApplied = true;

    if(pendingXP <= 0) {
        return {
            xpApplied: 0,
            leveledUp: false,
            levelsGained: 0
        };
    }

    const levelUpResult = addXP(player, pendingXP);
    if(levelUpResult.leveledUp) {
        const levelsGained = Math.max(1, levelUpResult.levelsGained || 1);
        player.unspentLevelPoints = Math.max(0, player.unspentLevelPoints || 0) + levelsGained;

        const healAmount = levelsGained * 20;
        if(healAmount > 0) {
            player.hp = Math.min(player.maxHp, player.hp + healAmount);
        }
    }

    return {
        xpApplied: pendingXP,
        leveledUp: levelUpResult.leveledUp,
        levelsGained: levelUpResult.levelsGained
    };
}

function hideCombatResultScreen(){
    const screen = document.getElementById('battle-result-screen');
    if(screen){
        screen.classList.remove('active');
    }
}

function showCombatResultScreen(isVictory){
    const screen = document.getElementById('battle-result-screen');
    const title = document.getElementById('battle-result-title');
    const subtitle = document.getElementById('battle-result-subtitle');
    const summary = document.getElementById('battle-result-summary');
    if(!screen || !title || !subtitle || !summary) return;

    title.textContent = isVictory ? 'Victoire' : 'Defaite';
    subtitle.textContent = isVictory ? 'Combat termine avec succes.' : 'Vous avez ete vaincu.';

    const itemLines = combatRewards.items.length > 0
        ? combatRewards.items.map(name => `<li>Objet: ${name}</li>`).join('')
        : '<li>Objet: Aucun</li>';
    const weaponLines = combatRewards.weapons.length > 0
        ? combatRewards.weapons.map(name => `<li>Arme: ${name}</li>`).join('')
        : '<li>Arme: Aucune</li>';

    summary.innerHTML = `
        <div class="battle-result-xp">XP gagnee: ${combatRewards.xpGained}</div>
        <ul class="battle-result-loot">
            ${itemLines}
            ${weaponLines}
        </ul>
    `;

    screen.classList.add('active');
}

// règles de combat
export const combatCost = 5;             // points nécessaires pour une attaque normale
export const skullDamage = 1;           // dégâts infligés par crâne lors d'un match

// ennemi courant (combatPoints pour attaquer)
export let enemy = { name:"Gobelin", hp:50, maxHp:50, attack:10, resistances:{}, combatPoints:0, mana: { red:0, blue:0, green:0, yellow:0, purple:0 }, spells:[], weapon: null, abilities: [], statusEffects: {}, bonusTurn: false, inventoryItem: null };

// si le joueur meurt, on restaure ses PV et réinitialise le combat
export function restartCombat(){
    player.hp = player.maxHp;
    player.combatPoints = 0;
    player.bonusTurn = false;
    enemy.hp = enemy.maxHp;
    enemy.combatPoints = 0;
    enemy.bonusTurn = false;
    // Réinitialiser le mana à 0
    player.mana = { ...EMPTY_MANA_POOL };
    enemy.mana = { ...EMPTY_MANA_POOL };
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
    
    const xpResult = applyCombatXPAtEnd();
    if(xpResult.xpApplied > 0) {
        log(`⭐ ${xpResult.xpApplied} XP appliquee(s) a la fin du combat.`);
        if(xpResult.leveledUp) {
            log(`🎉 Niveau ${player.level} atteint en fin de combat.`);
            if(xpResult.levelsGained > 1) {
                log(`✨ Vous avez gagne ${xpResult.levelsGained} niveaux d'un coup !`);
            }
            updateAvailableSpells();
            updateAvailableWeapons();
            updateInventoryTab();
            showAttributeMenu();
        }
    }
    saveUpdate();

    log("💀 Vous êtes mort ! Le combat est terminé.");
    
    // Marquer le combat comme terminé
    gameState.combatState = 'finished';
    showCombatResultScreen(false);
    
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
export function startNewCombat(selectedEnemy = null){
    gameState.combatState = 'active';
    resetCombatRewards();
    hideCombatResultScreen();
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
    newEnemy(selectedEnemy);
}

// Abandonner le combat en cours
export function abandonCombat(){
    if(gameState.combatState !== 'active') {
        return;
    }
    
    const xpResult = applyCombatXPAtEnd();
    if(xpResult.xpApplied > 0) {
        log(`⭐ ${xpResult.xpApplied} XP appliquee(s) a la fin du combat.`);
        if(xpResult.leveledUp) {
            log(`🎉 Niveau ${player.level} atteint en fin de combat.`);
            if(xpResult.levelsGained > 1) {
                log(`✨ Vous avez gagne ${xpResult.levelsGained} niveaux d'un coup !`);
            }
            updateAvailableSpells();
            updateAvailableWeapons();
            updateInventoryTab();
            showAttributeMenu();
        }
    }
    saveUpdate();

    log("🏳️ Vous avez abandonné le combat...");
    
    // Marquer le combat comme terminé
    gameState.combatState = 'finished';
    showCombatResultScreen(false);
    
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
            player.mana = { ...player.mana, ...(loaded.mana || {}) };
            player.maxMana = loaded.maxMana ?? player.maxMana;
            player.attack = loaded.attack ?? player.attack;
            player.level = loaded.level ?? player.level;
            player.xp = loaded.xp ?? player.xp;
            player.xpToNextLevel = loaded.xpToNextLevel ?? player.xpToNextLevel;
            player.attributes = { ...player.attributes, ...(loaded.attributes || {}) };
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
            player.unspentLevelPoints = loaded.unspentLevelPoints ?? player.unspentLevelPoints;
            clampManaToCaps(player);
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
clampManaToCaps(player);

// interface minimale

// --- Animation compteur (tick 1 par 1) ---
const _activeCounters = {};
function _animateCounter(id, from, to) {
    if (_activeCounters[id]) {
        clearInterval(_activeCounters[id]);
        delete _activeCounters[id];
    }
    const el = document.getElementById(id);
    if (!el || isNaN(from) || from === to) return;
    el.textContent = from;
    let current = from;
    const step = to > from ? 1 : -1;
    const delta = Math.abs(to - from);
    const intervalMs = Math.max(50, Math.min(150, Math.round(1500 / delta)));
    _activeCounters[id] = setInterval(() => {
        current += step;
        const elNow = document.getElementById(id);
        if (elNow) elNow.textContent = current;
        if (current === to) {
            clearInterval(_activeCounters[id]);
            delete _activeCounters[id];
        }
    }, intervalMs);
}

export function updateStats(){
    // truncate log to only the latest message
    const logDiv=document.getElementById('log');
    if(logDiv){
        const lines = logDiv.innerHTML.split('<br>').filter(l=>l.trim()!=='');
        logDiv.innerHTML = lines.slice(-1).join('<br>');
    }

    // Snapshot des valeurs affichées AVANT le rebuild du DOM
    const snapPlayerHp = parseInt(document.getElementById('player-hp-current')?.textContent, 10);
    const snapEnemyHp  = parseInt(document.getElementById('enemy-hp-current')?.textContent,  10);
    const snapPlayerMana = {};
    const snapEnemyMana  = {};
    for (const c of ['red','blue','green','yellow','purple']) {
        snapPlayerMana[c] = parseInt(document.getElementById(`player-mana-${c}`)?.textContent, 10);
        snapEnemyMana[c]  = parseInt(document.getElementById(`enemy-mana-${c}`)?.textContent,  10);
    }

    // Cibles (valeurs actuelles des entités)
    const targetPlayerHp = Math.floor(player.hp);
    const targetEnemyHp  = Math.floor(enemy.hp);
    const targetPlayerMana = { red: player.mana.red, blue: player.mana.blue, green: player.mana.green, yellow: player.mana.yellow, purple: player.mana.purple };
    const targetEnemyMana  = { red: enemy.mana.red,  blue: enemy.mana.blue,  green: enemy.mana.green,  yellow: enemy.mana.yellow,  purple: enemy.mana.purple  };

    const playerDiv=document.getElementById('player-stats');
    // Affichage de la classe si définie
    const playerClassEmoji = player.class ? (async () => {
        const module = await import('./classes.js');
        return module.playerClasses[player.class]?.emoji || '';
    })() : Promise.resolve('');
    
    playerClassEmoji.then(emoji => {
        playerDiv.innerHTML = `
            <div class="stat"><span class="enemy-combat-name" title="${emoji} ${player.name || 'Aventurier'}">${emoji} ${(player.name || 'Aventurier').split(' ')[0]}</span><span style="color: #888;"> ${player.level}</span></div>
            <div class="stat">
                <div class="hp-bar-container">
                    <progress value="${targetPlayerHp}" max="${player.maxHp}"></progress>
                    <span class="hp-text"><span id="player-hp-current">${targetPlayerHp}</span>/${player.maxHp}</span>
                </div>
            </div>
            <div class="stat"><strong>Atk:</strong> ${player.attack} <strong>Def:</strong> ${player.defense || 0}</div>
            <div class="stat">
                <div class="mana-dots">
                    <span class="mana-dot mana-red" title="${targetPlayerMana.red}"></span><span id="player-mana-red">${targetPlayerMana.red}</span>
                    <span class="mana-dot mana-blue" title="${targetPlayerMana.blue}"></span><span id="player-mana-blue">${targetPlayerMana.blue}</span>
                    <span class="mana-dot mana-green" title="${targetPlayerMana.green}"></span><span id="player-mana-green">${targetPlayerMana.green}</span>
                    <span class="mana-dot mana-yellow" title="${targetPlayerMana.yellow}"></span><span id="player-mana-yellow">${targetPlayerMana.yellow}</span>
                    <span class="mana-dot mana-purple" title="${targetPlayerMana.purple}"></span><span id="player-mana-purple">${targetPlayerMana.purple}</span>
                </div>
            </div>
            <div class="stat"><strong>⚔️:</strong> ${player.combatPoints}</div>`;
        
        // Animer les compteurs si les valeurs ont changé
        _animateCounter('player-hp-current', snapPlayerHp, targetPlayerHp);
        for (const c of ['red','blue','green','yellow','purple']) {
            _animateCounter(`player-mana-${c}`, snapPlayerMana[c], targetPlayerMana[c]);
        }

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
        <div class="stat"><span class="enemy-combat-name" title="${enemyClassEmoji} ${enemy.name}">${enemyClassEmoji} ${enemy.name.split(' ')[0]}</span>${levelIndicator}</div>
        <div class="stat">
            <div class="hp-bar-container">
                <progress class="enemy-bar" value="${targetEnemyHp}" max="${enemy.maxHp}"></progress>
                <span class="hp-text"><span id="enemy-hp-current">${targetEnemyHp}</span>/${enemy.maxHp}</span>
            </div>
        </div>
        <div class="stat"><strong>Atk:</strong> ${enemy.attack} <strong>Def:</strong> ${enemy.defense || 0}</div>
        <div class="stat">
            <div class="mana-dots">
                <span class="mana-dot mana-red" title="${targetEnemyMana.red}"></span><span id="enemy-mana-red">${targetEnemyMana.red}</span>
                <span class="mana-dot mana-blue" title="${targetEnemyMana.blue}"></span><span id="enemy-mana-blue">${targetEnemyMana.blue}</span>
                <span class="mana-dot mana-green" title="${targetEnemyMana.green}"></span><span id="enemy-mana-green">${targetEnemyMana.green}</span>
                <span class="mana-dot mana-yellow" title="${targetEnemyMana.yellow}"></span><span id="enemy-mana-yellow">${targetEnemyMana.yellow}</span>
                <span class="mana-dot mana-purple" title="${targetEnemyMana.purple}"></span><span id="enemy-mana-purple">${targetEnemyMana.purple}</span>
            </div>
        </div>
        <div class="stat"><strong>⚔️:</strong> ${enemy.combatPoints}</div>`;
    if(enemy.inventoryItem) {
        enemyDiv.innerHTML += `<div class="stat" style="font-size:0.85em; color:#888;">🎒 Objet: ${enemy.inventoryItem.name}</div>`;
    }

    // Animer les compteurs ennemi
    _animateCounter('enemy-hp-current', snapEnemyHp, targetEnemyHp);
    for (const c of ['red','blue','green','yellow','purple']) {
        _animateCounter(`enemy-mana-${c}`, snapEnemyMana[c], targetEnemyMana[c]);
    }
    
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
        const effectText = sp.description || (sp.effect ? 'Effet special' : (sp.dmg ? `Inflige ${sp.dmg} degats` : (sp.heal ? `Soigne ${sp.heal} HP` : 'Aucun effet')));
        div.innerHTML = `
            <div class="spell-name">${spellClassIndicator} ${sp.name}</div>
            <div class="spell-cost">${costDisplay}${damageText}${healText}</div>
        `;
        div.title = effectText;

        const showDetails = () => showSpellTooltip(div, sp);
        const hideDetails = () => hideSpellTooltip();
        div.addEventListener('mouseenter', showDetails);
        div.addEventListener('mouseleave', hideDetails);
        div.addEventListener('mousedown', showDetails);
        div.addEventListener('mouseup', hideDetails);
        div.addEventListener('touchstart', showDetails, { passive: true });
        div.addEventListener('touchend', hideDetails);
        div.addEventListener('touchcancel', hideDetails);
        div.addEventListener('focus', showDetails);
        div.addEventListener('blur', hideDetails);

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

export function logActiveAction(actionText){
    const actor = currentTurn === 'player'
        ? `joueur (${player.name || 'Aventurier'})`
        : `ennemi (${enemy.name || 'Ennemi'})`;
    console.log(`🎯 Action active - ${actor}: ${actionText}`);
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
    clampManaToCaps(player);
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
                <span class="stat-effect">Effet principal: ${getPrimaryAttributeEffect(player, 'strength')} Attaque</span>
            </div>
            <div class="stat-line">
                <span class="stat-label">🏃 Agilité (Agility):</span>
                <span class="stat-value">${player.attributes.agility}</span>
                <span class="stat-effect">Effet principal: ${getPrimaryAttributeEffect(player, 'agility')} Défense</span>
            </div>
            <div class="stat-line">
                <span class="stat-label">🧠 Intelligence:</span>
                <span class="stat-value">${player.attributes.intelligence}</span>
                <span class="stat-effect">Effet principal: ${getPrimaryAttributeEffect(player, 'intelligence')} Puissance magique</span>
            </div>
            <div class="stat-line">
                <span class="stat-label">❤️ Endurance (Stamina):</span>
                <span class="stat-value">${player.attributes.stamina}</span>
                <span class="stat-effect">Effet principal: ${getPrimaryAttributeEffect(player, 'stamina')} HP max</span>
            </div>
            <div class="stat-line">
                <span class="stat-label">🎯 Moral (Morale):</span>
                <span class="stat-value">${player.attributes.morale}</span>
                <span class="stat-effect">Effet principal: ${getPrimaryAttributeEffect(player, 'morale')} Attaque morale</span>
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
            <div class="stat-line">
                <span class="stat-label">🔴🟡🟢🔵🟣 Caps mana:</span>
                <span class="stat-value">${player.manaCaps?.red ?? player.maxMana}/${player.manaCaps?.yellow ?? player.maxMana}/${player.manaCaps?.green ?? player.maxMana}/${player.manaCaps?.blue ?? player.maxMana}/${player.manaCaps?.purple ?? player.maxMana}</span>
            </div>
        </div>
        
        <div class="stats-section">
            <button onclick="window.clearPlayerSave()" class="secondary">🗑️ Effacer la sauvegarde</button>
        </div>
    `;
    });
}

// Construit et affiche une animation d'attaque ou de sort à partir de paramètres structurés.
// Paramètres : { icon, title, damage?, heal?, source?, target? }
export function showCombatAnimation({ icon, title, damage = null, heal = null, source = null, target = null }, isPlayerAttack = true) {
    let html = `<div class="attack-icon">${icon}</div><div class="attack-title">${String(title).toUpperCase()}</div>`;
    if (damage !== null) html += `<div class="attack-damage">${damage}</div>`;
    if (heal   !== null) html += `<div class="attack-heal">${heal}</div>`;
    if (source !== null) html += `<div class="attack-source">${source}</div>`;
    if (target !== null) html += `<div class="attack-target">${target}</div>`;
    showAttackAnimation(html, isPlayerAttack);
}

// Mécanisme DOM bas niveau pour afficher un overlay d'animation sur la grille
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
    if(gameState.combatState !== 'active'){ log("⚠️ Aucun combat en cours."); return; }
    if(currentTurn !== 'player'){ log("⚠️ Seul le joueur actif peut utiliser une attaque."); return; }
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
    
    const icon = getWeaponIcon(weapon.type);

    logActiveAction(`utilise l'arme ${weapon.name} (cout ${weapon.actionPoints} PA)`);
    
    showCombatAnimation({ icon, title: weapon.name, damage: `-${dmg} dégâts`, target: `→ ${enemy.name}` }, true);
    log(`${icon} Vous utilisez ${weapon.name} et infligez ${dmg} dégâts.`);
    
    finishPlayerTurn();
}

export function castSpell(spellId){
    if(gameState.combatState !== 'active'){ log("⚠️ Aucun combat en cours."); return; }
    if(currentTurn !== 'player'){ log("⚠️ Seul le joueur actif peut lancer un sort."); return; }
    const spell=player.activeSpells.find(s=>s.id===spellId);
    if(!spell){ log("Sort indisponible !"); return; }
    if(player.level<spell.minLevel){ log(`Nécessite niveau ${spell.minLevel}`); return; }
    
    if(!canEntityCastSpell(player, spell)){
        const missingColor = getMissingManaColor(player, spell);
        log(missingColor ? `Pas assez de mana ${missingColor} !` : "Pas assez de mana !");
        return;
    }
    consumeSpellMana(player, spell);
    
    // Gérer les sorts avec effet spécial
    if(spell.effect) {
        logActiveAction(`lance le sort ${spell.name} (effet special)`);
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
    logActiveAction(`lance le sort ${spell.name}`);
    applyStandardSpellEffects(player, enemy, spell, true);
    
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
            logActiveAction(`lance le sort ${spell.name}`);

            if(!canEntityCastSpell(enemy, spell)) {
                log(`⚠️ ${enemy.name} n'a plus assez de mana pour ${spell.name}.`);
                finishEnemyTurn();
                return;
            }

            consumeSpellMana(enemy, spell);
            applyStandardSpellEffects(enemy, player, spell, false);
            
            // Vérifier l'état après l'action
            finishEnemyTurn();
            
        } else if(decision.action === 'weapon'){
            logActiveAction(`utilise l'arme ${enemy.weapon.name}`);
            enemy.combatPoints -= enemy.weapon.actionPoints;
            let dmg = enemy.weapon.damage;
            player.hp -= dmg;
            const icon = getWeaponIcon(enemy.weapon.type);
            showCombatAnimation({ icon, title: enemy.weapon.name, damage: `-${dmg} dégâts`, source: enemy.name, target: '→ Vous' }, false);
            log(`${icon} ${enemy.name} utilise ${enemy.weapon.name} ! ${dmg} dégâts.`);
            
            // Vérifier l'état après l'action
            finishEnemyTurn();
            
        } else {
            // L'ennemi joue sur le plateau
            logActiveAction('joue sur le plateau');
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
    
    // Calculer et mettre en attente l'XP (application en fin de combat)
    const xpGain = calculateXPGain(enemy.level || player.level, player.level);
    queueCombatXP(xpGain);
    log(`⭐ Vous gagnez ${xpGain} XP !`);

    // Drop de l'objet de l'ennemi (si il en avait un)
    if(enemy.inventoryItem) {
        if(player.inventory.length < 1) {
            player.inventory.push({...enemy.inventoryItem, applied: false});
            combatRewards.items.push(enemy.inventoryItem.name);
            const rarityEmoji = getRarityEmoji(enemy.inventoryItem.rarity);
            log(`${rarityEmoji} ${enemy.name} portait : ${enemy.inventoryItem.name} !`);
            if(enemy.inventoryItem.type === 'artifact') {
                applyArtifactEffects(player);
                log(`✨ ${enemy.inventoryItem.description}`);
            }
        } else {
            log(`🎒 ${enemy.name} portait ${enemy.inventoryItem.name} mais votre inventaire est plein.`);
        }
    }

    // 40% de chance de ne rien obtenir
    const dropChance = Math.random();
    if(dropChance > 0.4) {
        // Obtenir un objet ou une arme aléatoire
        const itemOrWeapon = Math.random();
        
        if(itemOrWeapon < 0.7) {
            // 70% de chance d'obtenir un objet
            const droppedItem = getRandomItem(player.level);
            if(droppedItem) {
                if(player.inventory.length < 1) {
                    player.inventory.push({...droppedItem, applied: false});
                    combatRewards.items.push(droppedItem.name);
                    const rarityEmoji = getRarityEmoji(droppedItem.rarity);
                    log(`${rarityEmoji} Vous obtenez : ${droppedItem.name} !`);
                    // Appliquer immédiatement les effets des artefacts
                    if(droppedItem.type === "artifact") {
                        applyArtifactEffects(player);
                        log(`✨ ${droppedItem.description}`);
                    }
                } else {
                    const rarityEmoji = getRarityEmoji(droppedItem.rarity);
                    log(`${rarityEmoji} ${droppedItem.name} trouvé, mais votre inventaire est plein (jetez votre objet actuel dans l'onglet Inventaire).`);
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
                    combatRewards.weapons.push(randomWeapon.name);
                    // Mettre à jour la liste des armes disponibles du joueur
                    updateAvailableWeapons();
                    const icon = getWeaponIcon(randomWeapon.type);
                    log(`${icon} Vous obtenez : ${randomWeapon.name} !`);
                } else {
                    log(`💰 Vous obtenez quelques pièces d'or (arme déjà possédée).`);
                }
            }
        }
    } else {
        log(`💨 L'ennemi ne laisse rien derrière lui...`);
    }
    
    const xpResult = applyCombatXPAtEnd();
    if(xpResult.leveledUp) {
        const healAmount = Math.max(0, (xpResult.levelsGained || 0) * 20);
        log(`🎉 Niveau ${player.level} atteint ! +${healAmount} HP de recuperation.`);
        if(xpResult.levelsGained > 1) {
            log(`✨ Vous avez gagné ${xpResult.levelsGained} niveaux d'un coup !`);
        }
        updateAvailableSpells();
        updateAvailableWeapons();
        updateInventoryTab();
        showAttributeMenu();
    } else {
        log(`📊 Progression: ${player.xp}/${player.xpToNextLevel} XP`);
    }
    saveUpdate();
    
    // Marquer le combat comme terminé
    gameState.combatState = 'finished';
    showCombatResultScreen(true);
    
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

export function grantComboMasteryRewards(xpAmount = 25){
    queueCombatXP(xpAmount);
    return xpAmount;
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
            ? `Choisissez un attribut a ameliorer (${remainingPoints} points restants)`
            : 'Choisissez un attribut a ameliorer';
    }
    modal.style.display = 'flex';
    
    // Attacher les événements aux cartes d'attributs
    const attributeCards = modal.querySelectorAll('.attribute-card');
    
    // Supprimer les anciens listeners
    attributeCards.forEach(card => {
        const newCard = card.cloneNode(true);
        card.parentNode.replaceChild(newCard, card);
    });
    
    // Ajouter les nouveaux listeners
    const freshCards = modal.querySelectorAll('.attribute-card');
    freshCards.forEach(card => {
        card.addEventListener('click', () => {
            const attr = card.dataset.attr;
            if(attr) {
                selectAttribute(attr);
                if((player.unspentLevelPoints || 0) <= 0) {
                    modal.style.display = 'none';
                } else {
                    showAttributeMenu();
                }
            }
        });
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
    log(`📈 +1 ${attrNames[attr]}`);
    saveUpdate();
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
            player.attack += 1;
            break;
    }
    clampManaToCaps(player);
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
        effectText = `Inflige ${spell.dmg} 💀 et soigne ${spell.heal} ❤️`;
    } else if(spell.dmg) {
        effectText = `Inflige ${spell.dmg} 💀`;
    } else if(spell.heal) {
        effectText = `Soigne ${spell.heal} ❤️`;
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
            const damageText = sp.dmg ? ` • ${sp.dmg} 💀` : '';
            const healText = sp.heal ? ` • ${sp.heal} ❤️` : '';
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
            const damageText = sp.dmg ? ` • ${sp.dmg} 💀` : '';
            const healText = sp.heal ? ` • ${sp.heal} ❤️` : '';
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
    player.mana = { ...EMPTY_MANA_POOL };
    enemy.mana = { ...EMPTY_MANA_POOL };

    // Bonus de départ liés aux aptitudes (une couleur par aptitude).
    Object.keys(player.mana).forEach(color => {
        const initialBonus = getAttributeManaBonus(player, color, "initial");
        if(initialBonus > 0) {
            addManaForColor(player, color, initialBonus, { applyGainBonus: false });
        }
    });

    Object.keys(enemy.mana).forEach(color => {
        const initialBonus = getAttributeManaBonus(enemy, color, "initial");
        if(initialBonus > 0) {
            addManaForColor(enemy, color, initialBonus, { applyGainBonus: false });
        }
    });
    
    // Appliquer les aptitudes du joueur
    if(player.abilities && player.abilities.length > 0){
        player.abilities.forEach(abilityId => {
            const ability = allAbilities.find(a => a.id === abilityId);
            if(ability && ability.startMana){
                Object.keys(ability.startMana).forEach(color => {
                    addManaForColor(player, color, ability.startMana[color], { applyGainBonus: false });
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
                    addManaForColor(enemy, color, ability.startMana[color], { applyGainBonus: false });
                });
            }
        });
    }

    clampManaToCaps(player);
}

// ennemis
export function newEnemy(selectedEnemy = null){
    enemy = selectedEnemy ? { ...selectedEnemy } : generateRandomEnemy(player.level, allSpells, allWeapons);
    
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
    if(enemy.inventoryItem){
        log(`🎒 ${enemy.name} porte : ${enemy.inventoryItem.name}`);
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
    
    const icon = getWeaponIcon(weapon.type);
    
    btn.innerHTML = `${icon} ${weapon.name} <span class="weapon-cost">${weapon.actionPoints} ⚔️</span> - ${weapon.damage} 💀`;
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
        const icon = getWeaponIcon(weapon.type);
        const div = document.createElement('div');
        div.className = 'weapon-item equipped-weapon';
        div.innerHTML = `
            <span class="weapon-icon">${icon}</span>
            <div class="weapon-details">
                <span class="weapon-name">${weapon.name}</span>
                <span class="weapon-stats">${weapon.damage} 💀 • ${weapon.actionPoints} ⚔️ • Niv. ${weapon.minLevel}</span>
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
        const icon = getWeaponIcon(weapon.type);
        const div = document.createElement('div');
        div.className = 'weapon-item available-weapon';
        const isEquipped = player.equippedWeapon && player.equippedWeapon.id === weapon.id;
        if(isEquipped) div.classList.add('is-equipped');
        
        div.innerHTML = `
            <span class="weapon-icon">${icon}</span>
            <div class="weapon-details">
                <span class="weapon-name">${weapon.name}</span>
                <span class="weapon-stats">${weapon.damage} 💀 • ${weapon.actionPoints} ⚔️ • Niv. ${weapon.minLevel}</span>
                <span class="weapon-description">${weapon.description}</span>
            </div>
            <button class="weapon-action" ${isEquipped ? 'disabled' : ''} onclick="window.equipWeapon('${weapon.id}')">${isEquipped ? '✅ Équipée' : '📦 Équiper'}</button>
        `;
        availableList.appendChild(div);
    });

    updateInventoryTab();
}

// -------------------------------------
// -------------------------------------
// Inventaire (slot unique)
export function updateInventoryTab(){
    const inventoryList = document.getElementById('inventory-list');
    if(!inventoryList) return;

    inventoryList.innerHTML = '';

    if(!player.inventory || player.inventory.length === 0){
        inventoryList.innerHTML = `
            <div class="inventory-slot inventory-slot-empty">
                <span class="slot-icon">📦</span>
                <span class="slot-label"><em>Aucun objet</em></span>
            </div>
        `;
        return;
    }

    const item = player.inventory[0];
    const rarityEmoji = getRarityEmoji(item.rarity);
    const rarityColor = getRarityColor(item.rarity);
    const canUse = gameState.combatState === 'active' && item.type === 'consumable';

    const div = document.createElement('div');
    div.className = `item-card ${item.type === 'consumable' ? 'consumable-item' : 'artifact-item'}`;
    div.style.borderLeft = `4px solid ${rarityColor}`;
    div.innerHTML = `
        <div class="item-header">
            <span class="item-name">${rarityEmoji} ${item.name}</span>
            <div class="item-actions">
                ${item.type === 'consumable'
                    ? `<button class="item-use-btn" ${canUse ? '' : 'disabled'} onclick="window.useInventoryItem('${item.id}', 0)">${canUse ? '✅ Utiliser' : '❌ Hors combat'}</button>`
                    : `<span class="artifact-badge">⚡ Actif</span>`
                }
                <button class="item-discard-btn" onclick="window.discardInventoryItem()">🗑️ Jeter</button>
            </div>
        </div>
        <div class="item-description">${item.description}</div>
    `;
    inventoryList.appendChild(div);
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

export function discardInventoryItem(){
    if(!player.inventory || player.inventory.length === 0) return;
    const item = player.inventory[0];
    player.inventory.splice(0, 1);
    log(`🗑️ Vous avez jeté ${item.name}.`);
    updateInventoryTab();
    saveUpdate();
}

// Exports pour les fonctions accessibles globalement
window.equipSpell = equipSpell;
window.unequipSpell = unequipSpell;
window.equipWeapon = equipWeapon;
window.unequipWeapon = unequipWeapon;
window.useInventoryItem = useInventoryItem;
window.discardInventoryItem = discardInventoryItem;
