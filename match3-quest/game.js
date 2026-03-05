// logique globale du joueur, ennemis, combat et interface

import { colors } from "./constants.js";
import { generateRandomEnemy } from "./enemies.js";

// joueur
export let player = {
    hp: 100,
    maxHp: 100,
    mana: { red:0, blue:0, green:0, yellow:0 },
    maxMana: 50,
    attack: 15,
    level: 1,
    attributes: { strength:0, agility:0, intelligence:0, stamina:0, morale:0 },
    spells: [],
    combatPoints: 0,
    bonusTurn: false
};

// tour actuel
export let currentTurn = 'player';

// règles de combat
export const combatCost = 5;             // points nécessaires pour une attaque normale
export const skullDamage = 10;           // dégâts infligés par crâne lors d'un match

// ennemi courant (combatPoints pour attaquer)
export let enemy = { name:"Gobelin", hp:50, maxHp:50, attack:10, resistances:{}, combatPoints:0, mana: { red:0, blue:0, green:0, yellow:0 }, spells:[] };

// si le joueur meurt, on restaure ses PV et réinitialise le combat
export function restartCombat(){
    player.hp = player.maxHp;
    player.combatPoints = 0;
    enemy.hp = enemy.maxHp;
    enemy.combatPoints = 0;
    log("🎮 Combat réinitialisé, vous êtes en pleine santé.");
    updateStats();
    saveUpdate();
}


// bibliothèque des sorts
export const allSpells = [
    {id:"fireball", name:"Boule de Feu", color:"red", cost:10, dmg:25, minLevel:1},
    {id:"ice", name:"Glace", color:"blue", cost:12, dmg:30, minLevel:1},
    {id:"heal", name:"Soin", color:"green", cost:8, heal:20, minLevel:1},
    {id:"bolt", name:"Éclair", color:"yellow", cost:15, dmg:35, minLevel:1},
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

// Chargement de la sauvegarde
if(localStorage.getItem('player')) player = JSON.parse(localStorage.getItem('player'));

// interface minimale
export function updateStats(){
    // truncate log to only the latest message
    const logDiv=document.getElementById('log');
    if(logDiv){
        const lines = logDiv.innerHTML.split('<br>').filter(l=>l.trim()!=='');
        logDiv.innerHTML = lines.slice(-1).join('<br>');
    }

    const playerDiv=document.getElementById('player-stats');
    playerDiv.innerHTML = `
        <div class="stat"><strong>HP:</strong>
            <progress value="${player.hp}" max="${player.maxHp}"></progress>
            ${player.hp}/${player.maxHp}
        </div>
        <div class="stat"><strong>Mana:</strong>
            <div class="mana-dots">
                <span class="mana-dot mana-red" title="${player.mana.red}"></span>${player.mana.red}
                <span class="mana-dot mana-blue" title="${player.mana.blue}"></span>${player.mana.blue}
                <span class="mana-dot mana-green" title="${player.mana.green}"></span>${player.mana.green}
                <span class="mana-dot mana-yellow" title="${player.mana.yellow}"></span>${player.mana.yellow}
            </div>
        </div>
        <div class="stat"><strong>Niv:</strong> ${player.level}</div>
        <div class="stat"><strong>CP:</strong> ${player.combatPoints}</div>
        <div class="stat"><strong>Bonus:</strong> ${player.bonusTurn ? 'oui' : 'non'}</div>
        <div class="stat"><strong>Tour:</strong> ${currentTurn === 'player' ? 'Joueur' : 'Ennemi'}</div>
        <div class="attributes">
            STR ${player.attributes.strength}, AGI ${player.attributes.agility}, INT ${player.attributes.intelligence}, STA ${player.attributes.stamina}, MOR ${player.attributes.morale}
        </div>`;

    const enemyDiv=document.getElementById('enemy-stats');
    enemyDiv.innerHTML = `
        <div class="stat"><strong>${enemy.name}</strong></div>
        <div class="stat"><strong>HP:</strong>
            <progress class="enemy-bar" value="${enemy.hp}" max="${enemy.maxHp}"></progress>
            ${enemy.hp}/${enemy.maxHp}
        </div>
        <div class="stat"><strong>Atk:</strong> ${enemy.attack}</div>
        <div class="stat"><strong>CP:</strong> ${enemy.combatPoints}</div>`;
}

export function log(text){
    const logDiv=document.getElementById('log');
    if(logDiv){
        logDiv.innerHTML = text + "<br>";
        logDiv.scrollTop = logDiv.scrollHeight;
    }
}

export function saveUpdate(){
    localStorage.setItem('player',JSON.stringify(player));
    updateStats();
    createSpellButtons();
}

// -------------------------------------
// Combat
export function attackEnemy(){
    if(player.combatPoints < combatCost){ log(`Il faut ${combatCost} points de combat pour attaquer.`); return; }
    if(player.hp<=0){ log("Vous êtes mort !"); restartCombat(); return; }
    player.combatPoints -= combatCost;
    const dmg=Math.floor(Math.random()*player.attack)+5;
    enemy.hp-=dmg;
    log(`⚔️ Vous infligez ${dmg} dégâts.`);
    if(player.bonusTurn){
        player.bonusTurn = false;
        log("🎯 Tour bonus utilisé : pas d'attaque ennemie.");
        saveUpdate();
        return;
    }
    enemyTurn();
}

export function castSpell(spellId){
    const spell=player.spells.find(s=>s.id===spellId);
    if(!spell){ log("Sort indisponible !"); return; }
    if(player.level<spell.minLevel){ log(`Nécessite niveau ${spell.minLevel}`); return; }
    if(player.mana[spell.color]<spell.cost){ log("Pas assez de mana !"); return; }
    player.mana[spell.color]-=spell.cost;
    if(spell.dmg){
        let dmg=spell.dmg*(1-(enemy.resistances[spell.color]||0));
        enemy.hp-=dmg;
        log(`🔥 ${spell.name} inflige ${dmg} dégâts.`);
    }
    if(spell.heal){
        player.hp=Math.min(player.maxHp,player.hp+spell.heal);
        log(`💚 ${spell.name} soigne ${spell.heal} HP.`);
    }
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
    // delay to make enemy action visible
    setTimeout(()=>{
        // choose to cast spell or attack
        let action = 'attack';
        let useableSpells = enemy.spells.filter(s => enemy.mana[s.color] >= s.cost);
        if(useableSpells.length > 0 && Math.random() > 0.4){
            // 60% chance to cast spell if available
            action = 'spell';
        }

        if(action === 'spell'){
            const spell = useableSpells[Math.floor(Math.random() * useableSpells.length)];
            enemy.mana[spell.color] -= spell.cost;
            if(spell.dmg){
                let dmg = spell.dmg * (1 - (player.resistances && player.resistances[spell.color] || 0));
                player.hp -= dmg;
                log(`🔥 ${enemy.name} lance ${spell.name} ! ${dmg} dégâts.`);
            }
            if(spell.heal){
                enemy.hp = Math.min(enemy.maxHp, enemy.hp + spell.heal);
                log(`💚 ${enemy.name} utilise ${spell.name} et soigne ${spell.heal} HP.`);
            }
        } else {
            // normal attack
            if(enemy.combatPoints < combatCost) enemy.combatPoints = combatCost;
            enemy.combatPoints -= combatCost;
            let dmg=Math.floor(Math.random()*enemy.attack)+5;
            if(Math.random()>0.5) dmg+=player.level*2;
            player.hp-=dmg;
            log(`💀 ${enemy.name} attaque ! ${dmg} dégâts.`);
        }

        if(player.hp<=0){
            log("💀 Vous êtes mort ! Recommencement du combat.");
            restartCombat();
            return;
        }
        updateStats();
        saveUpdate();
        currentTurn = 'player';
    }, 500);
}

// -------------------------------------
// progression
export function handleEnemyDefeated(){
    log(`🏆 ${enemy.name} est vaincu !`);
    player.level++;
    player.hp=Math.min(player.maxHp,player.hp+20);
    log(`🎉 Niveau ${player.level} ! HP restauré.`);
    updateAvailableSpells();
    showAttributeMenu();
    newEnemy();
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
    player.spells = allSpells.filter(sp=>player.level>=sp.minLevel);
}

export function createSpellButtons(){
    const container=document.getElementById('spell-buttons');
    container.innerHTML="";
    player.spells.forEach(sp=>{
        const btn=document.createElement('button');
        btn.textContent=`${sp.name} (${sp.cost} ${sp.color} mana) - Lv${sp.minLevel}+`;
        if(player.level<sp.minLevel) btn.classList.add('disabled');
        btn.onclick=()=>castSpell(sp.id);
        container.appendChild(btn);
    });
}

// -------------------------------------
// ennemis
export function newEnemy(){
    enemy = generateRandomEnemy(player.level, allSpells);
    log(`🔹 Un nouvel ennemi: ${enemy.name}`);
    if(enemy.spells.length > 0){
        log(`✨ L'ennemi dispose de sorts : ${enemy.spells.map(s => s.name).join(", ")}`);
    }
    // déterminer au hasard qui commence
    decideFirstTurn();
}

// choisit aléatoirement le premier tour et le lance si c'est l'ennemi
export function decideFirstTurn(){
    const starter = Math.random() < 0.5 ? 'player' : 'enemy';
    currentTurn = starter;
    log(`🔄 Premier tour : ${starter === 'player' ? 'Joueur' : 'Ennemi'}`);
    if(starter === 'enemy'){
        enemyTurn();
    }
}
