// Système d'ennemis piloté par un catalogue JSON

import { allWeapons } from "./weapons.js";
import { getSpellsByClass, getAllSpells } from "./spells.js";
import { getRandomItem } from "./items.js";

let enemyCatalog = [];

function loadEnemyCatalogSync(){
    if(enemyCatalog.length > 0) return enemyCatalog;

    try {
        const req = new XMLHttpRequest();
        req.open('GET', './enemies.catalog.json', false);
        req.send(null);
        if(req.status >= 200 && req.status < 300){
            const parsed = JSON.parse(req.responseText);
            if(Array.isArray(parsed)){
                enemyCatalog = parsed;
            }
        }
    } catch (error) {
        console.error('Impossible de charger enemies.catalog.json', error);
    }

    if(enemyCatalog.length === 0){
        enemyCatalog = [
            {
                id: 'fallback_enemy',
                name: 'Cultiste',
                race: 'Humain',
                emoji: '🧙',
                title: 'Arcaniste',
                playerClass: 'sorcerer',
                hasWeapon: false,
                statsModifiers: { hpMult: 1.0, atkMult: 1.0, defMult: 1.0 },
                levelBias: 0,
                spellProfile: { preferredColors: ['blue'], preferClassSpells: true, targetSpellCount: 3 },
                resistanceProfile: { red: 0.1, blue: 0.2, green: 0.1, yellow: 0.1, purple: 0.1 }
            }
        ];
    }

    return enemyCatalog;
}

function clamp(num, min, max){
    return Math.max(min, Math.min(max, num));
}

function pickRandom(arr){
    return arr[Math.floor(Math.random() * arr.length)];
}

function uniqueById(spells){
    const map = new Map();
    spells.forEach(sp => map.set(sp.id, sp));
    return Array.from(map.values());
}

function buildResistances(template, level){
    const defaults = { red: 0.08, blue: 0.08, green: 0.08, yellow: 0.08, purple: 0.08 };
    const profile = template.resistanceProfile || {};
    return {
        red: clamp(profile.red ?? defaults.red + (level * 0.002), 0, 0.5),
        blue: clamp(profile.blue ?? defaults.blue + (level * 0.002), 0, 0.5),
        green: clamp(profile.green ?? defaults.green + (level * 0.002), 0, 0.5),
        yellow: clamp(profile.yellow ?? defaults.yellow + (level * 0.002), 0, 0.5),
        purple: clamp(profile.purple ?? defaults.purple + (level * 0.002), 0, 0.5)
    };
}

function buildSpellLoadout(template, enemyLevel){
    const classSpells = getSpellsByClass(template.playerClass, enemyLevel);
    const genericSpells = getAllSpells().filter(sp => !sp.class && sp.minLevel <= enemyLevel);

    const preferredColors = template.spellProfile?.preferredColors || [];
    const maxSpells = Math.floor(enemyLevel / 5) + 1;
    const targetSpellCount = Math.ceil(Math.random() * maxSpells);
    const preferClassSpells = template.spellProfile?.preferClassSpells !== false;

    const preferredGeneric = genericSpells.filter(sp => preferredColors.includes(sp.color));
    const otherGeneric = genericSpells.filter(sp => !preferredColors.includes(sp.color));

    const selected = [];

    const takeFrom = (source, maxToTake) => {
        const pool = [...source];
        while(pool.length > 0 && selected.length < maxToTake){
            const spell = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
            selected.push(spell);
        }
    };

    if(preferClassSpells){
        takeFrom(classSpells, targetSpellCount - 1);
    }
    takeFrom(preferredGeneric, targetSpellCount);
    if(!preferClassSpells){
        takeFrom(classSpells, targetSpellCount);
    }
    takeFrom(otherGeneric, targetSpellCount);

    const unique = uniqueById(selected);
    return unique.slice(0, targetSpellCount);
}

function buildEnemyFromTemplate(template, enemyLevel, allWeaponsArg = allWeapons){
    const stats = template.statsModifiers || { hpMult: 1, atkMult: 1, defMult: 1 };
    const baseHp = 40 + enemyLevel * 10;
    const baseAtk = 5 + enemyLevel * 4;

    const hp = Math.floor(baseHp * (stats.hpMult || 1));
    const atk = Math.floor(baseAtk * (stats.atkMult || 1));

    let enemyWeapon = null;
    if(template.hasWeapon !== false){
        const availableWeapons = allWeaponsArg.filter(w => w.minLevel <= enemyLevel);
        if(availableWeapons.length > 0){
            enemyWeapon = pickRandom(availableWeapons);
        }
    }

    const enemyAbilities = [];
    if(Math.random() < 0.15) enemyAbilities.push('fireAffinity');
    if(Math.random() < 0.15) enemyAbilities.push('iceAffinity');
    if(Math.random() < 0.15) enemyAbilities.push('natureAffinity');
    if(Math.random() < 0.15) enemyAbilities.push('stormAffinity');

    // 25% de chance d'avoir un objet dans l'inventaire
    let enemyInventoryItem = null;
    if(Math.random() < 0.25) {
        try {
            const item = getRandomItem(enemyLevel);
            if(item) enemyInventoryItem = {...item, applied: false};
        } catch(e) {}
    }

    return {
        templateId: template.id,
        race: template.race,
        raceEmoji: template.emoji,
        class: template.title,
        playerClass: template.playerClass,
        name: `${template.name} ${template.title}`,
        hp: hp,
        maxHp: hp,
        attack: atk,
        resistances: buildResistances(template, enemyLevel),
        combatPoints: 0,
        mana: { red: 0, blue: 0, green: 0, yellow: 0, purple: 0 },
        spells: buildSpellLoadout(template, enemyLevel),
        weapon: enemyWeapon,
        level: enemyLevel,
        abilities: enemyAbilities,
        isOverleveledChoice: false,
        inventoryItem: enemyInventoryItem
    };
}

export function generateRandomEnemy(playerLevel, _allSpells, allWeaponsArg = allWeapons){
    const catalog = loadEnemyCatalogSync();
    const template = pickRandom(catalog);

    const rand = Math.random();
    let delta = 0;
    if(rand < 0.10) delta = 3;
    else if(rand < 0.25) delta = 2;
    else if(rand < 0.55) delta = 1;

    const enemyLevel = Math.max(1, playerLevel + (template.levelBias || 0) + delta);
    return buildEnemyFromTemplate(template, enemyLevel, allWeaponsArg);
}

export function generateEnemyChoices(playerLevel, count = 4, allWeaponsArg = allWeapons){
    const catalog = [...loadEnemyCatalogSync()];
    const choices = [];
    const normalMaxLevel = playerLevel + 1;

    while(catalog.length > 0 && choices.length < count){
        const template = catalog.splice(Math.floor(Math.random() * catalog.length), 1)[0];
        const randomDelta = [-1, 0, 1][Math.floor(Math.random() * 3)];
        const rawLevel = playerLevel + (template.levelBias || 0) + randomDelta;
        const level = clamp(Math.max(1, rawLevel), 1, normalMaxLevel);
        choices.push(buildEnemyFromTemplate(template, level, allWeaponsArg));
    }

    // Cas rare: un adversaire dangereux peut dépasser largement le niveau du joueur
    if(choices.length > 0 && Math.random() < 0.08){
        const idx = Math.floor(Math.random() * choices.length);
        const boostedLevel = playerLevel + 6;
        const template = loadEnemyCatalogSync().find(t => t.id === choices[idx].templateId);
        const boosted = buildEnemyFromTemplate(template, boostedLevel, allWeaponsArg);
        boosted.isOverleveledChoice = true;
        choices[idx] = boosted;
    }

    return choices;
}

export function getEnemyDescription(enemy) {
    return `${enemy.raceEmoji} ${enemy.name}`;
}
