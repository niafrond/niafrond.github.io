// Système d'ennemis piloté par un catalogue JSON

import { allWeapons } from "./weapons.js";
import { MAX_ACTIVE_SPELLS } from "./constants.js";
import { getSpellsByClass, getAllSpells } from "./spells.js";
import { getRandomItem } from "./items.js";
import { applyArenaScaling } from "./arena.js";
import { enemyDefenseForLevel } from "./progression.js";
import { weaknessOf, applyWeaknessToResistances } from "./elements.js";

let enemyCatalog = [];

function loadEnemyCatalogSync(){
    if(enemyCatalog.length > 0) return enemyCatalog;

    try {
        const req = new XMLHttpRequest();
        req.open('GET', './enemies.catalog.json' + (typeof window !== 'undefined' && window.__match3Build ? '?v=' + window.__match3Build : ''), false);   // ?v= : anti-cache (voir index.html)
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


// Graine déterministe : les boss (et leur équipement, sorts, objet) sont pré-générés une fois pour toutes à partir d'une clé stable,
// ils ne changent donc pas quand on revient les voir. Math.random est remplacé le temps de la construction (synchrone).
function hashSeed(key){
    let h = 2166136261;
    const text = String(key);
    for(let i = 0; i < text.length; i++){
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function mulberry32(seed){
    let a = seed >>> 0;
    return function(){
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function withSeededRandom(key, build){
    const original = Math.random;
    Math.random = mulberry32(hashSeed(key));
    try {
        return build();
    } finally {
        Math.random = original;
    }
}

function clamp(num, min, max){
    return Math.max(min, Math.min(max, num));
}

function pickRandom(arr){
    return arr[Math.floor(Math.random() * arr.length)];
}

function toNumberOrDefault(value, defaultValue){
    const n = Number(value);
    return Number.isFinite(n) ? n : defaultValue;
}

function uniqueById(spells){
    const map = new Map();
    spells.forEach(sp => map.set(sp.id, sp));
    return Array.from(map.values());
}

function resolvePreferredColor(template){
    const profileColors = template?.spellProfile?.preferredColors;
    if(Array.isArray(profileColors) && profileColors.length > 0) {
        return String(profileColors[0]).toLowerCase();
    }
    return 'red';
}

// Catalogue complet des gabarits d'ennemis (onglet Bestiaire du carnet, bestiary.js).
export const enemyCatalogList = () => loadEnemyCatalogSync();

// Faiblesse d'un gabarit d'ennemi (révélée par l'observation sur la carte, voir terrain.js).
export function weakColorOfTemplate(templateId){
    const template = loadEnemyCatalogSync().find(t => t.id === templateId);
    return template ? resolveWeakColor(resolvePreferredColor(template)) : null;
}

function resolveWeakColor(preferredColor){
    return weaknessOf(preferredColor);   // table des éléments : voir elements.js
}

function buildResistances(template, level){
    const defaults = { red: 0.08, blue: 0.08, green: 0.08, yellow: 0.08, purple: 0.08 };
    const profile = template.resistanceProfile || {};
    const resistances = {
        red: clamp(profile.red ?? defaults.red + (level * 0.002), 0, 0.5),
        blue: clamp(profile.blue ?? defaults.blue + (level * 0.002), 0, 0.5),
        green: clamp(profile.green ?? defaults.green + (level * 0.002), 0, 0.5),
        yellow: clamp(profile.yellow ?? defaults.yellow + (level * 0.002), 0, 0.5),
        purple: clamp(profile.purple ?? defaults.purple + (level * 0.002), 0, 0.5)
    };
    // La couleur faible (élément qui contre l'ennemi) a toujours la résistance la plus basse du profil.
    return applyWeaknessToResistances(resistances, resolveWeakColor(resolvePreferredColor(template)));
}

// Emplacements de sorts d'un ennemi : 2 dès le niveau 1, 3 au niveau 3, 4 (plafond du joueur) dès le niveau 6.
export function enemySpellSlots(level){
    return Math.min(MAX_ACTIVE_SPELLS, 2 + Math.floor(Math.max(1, level) / 3));
}

function buildSpellLoadout(template, enemyLevel, { fullLoadout = false } = {}){
    const classSpells = getSpellsByClass(template.playerClass, enemyLevel);
    const genericSpells = getAllSpells().filter(sp => !sp.class && !sp.effect && !sp.playerOnly && sp.minLevel <= enemyLevel);   // sorts avancés (effets de plateau) : réservés au joueur

    const preferredColors = template.spellProfile?.preferredColors || [];
    const slots = enemySpellSlots(enemyLevel);
    const maxSpells = Math.min(slots, Math.max(2, Math.floor(toNumberOrDefault(template.spellProfile?.targetSpellCount, slots))));   // le gabarit plafonne son grimoire
    const targetSpellCount = fullLoadout ? slots : maxSpells;   // un boss a toujours son grimoire complet
    const preferClassSpells = template.spellProfile?.preferClassSpells !== false;

    const preferredGeneric = genericSpells.filter(sp => (sp.colors || [sp.color]).some(c => preferredColors.includes(c)));
    const otherGeneric = genericSpells.filter(sp => !(sp.colors || [sp.color]).some(c => preferredColors.includes(c)));

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

    const unique = uniqueById(selected).slice(0, targetSpellCount);
    // Au moins un sort de dégâts direct : sinon l'ennemi n'aurait que des sorts de soutien.
    if(!unique.some(sp => sp.type === 'damage' || sp.dmg || sp.baseDmg)){
        const attack = [...preferredGeneric, ...otherGeneric, ...classSpells].find(sp => sp.type === 'damage' && !unique.includes(sp));
        if(attack){
            if(unique.length >= targetSpellCount) unique.pop();
            unique.push(attack);
        }
    }
    return unique;
}

function scoreTemplateForBoss(template){
    const stats = template?.statsModifiers || {};
    const hpMult = toNumberOrDefault(stats.hpMult, 1);
    const atkMult = toNumberOrDefault(stats.atkMult, 1);
    const defMult = toNumberOrDefault(stats.defMult, 1);
    const levelBias = toNumberOrDefault(template?.levelBias, 0);
    return (hpMult * 1.8) + (atkMult * 1.4) + (defMult * 1.2) + levelBias;
}

function pickBossTemplate(preferredTemplateId = null){
    const catalog = loadEnemyCatalogSync();
    if(catalog.length === 0) return null;

    if(preferredTemplateId) {
        const forced = catalog.find(t => t.id === preferredTemplateId);
        if(forced) return forced;
    }

    const scored = [...catalog].sort((a, b) => scoreTemplateForBoss(b) - scoreTemplateForBoss(a));
    const topSliceSize = Math.max(1, Math.ceil(scored.length * 0.35));
    const topPool = scored.slice(0, topSliceSize);
    return pickRandom(topPool);
}

export const BOSS_HP_QUADRATIC = 0.64;

function buildEnemyFromTemplate(template, enemyLevel, allWeaponsArg = allWeapons, { boss = false } = {}){
    const stats = template.statsModifiers || { hpMult: 1, atkMult: 1, defMult: 1 };
    // PV absolus (indépendants du héros). Les boss ont une courbe quadratique pour rester à la hauteur d'un héros endurci
    // (≈ 4 000 PV au niveau 56) : niveau 56, gabarit ×1 → ~4 800 PV après le renfort de boss (×1,75).
    const baseHp = 55 + enemyLevel * 12 + (boss ? Math.round(BOSS_HP_QUADRATIC * enemyLevel * enemyLevel) : 0);
    const baseDef = enemyDefenseForLevel(enemyLevel);

    const hp = Math.floor(baseHp * (stats.hpMult || 1));
    // Force et agilité proportionnelles au niveau (l'agilité n'est que très rarement nulle).
    const strength = Math.max(0, Math.round(enemyLevel * (0.3 + Math.random() * 0.5) * (stats.atkMult || 1)));
    const agility = Math.random() < 0.04 ? 0 : Math.max(1, Math.round(enemyLevel * (0.25 + Math.random() * 0.4) * (stats.defMult || 1)));
    // Attaque = chance de critique, défense = chance de blocage (en %, plafonnées à 98 % à l'usage : voir combatStats.js).
    const atk = Math.max(0, Math.round((5 + enemyLevel * 1.0) * (stats.atkMult || 1)));
    const def = Math.max(0, Math.floor(baseDef * 0.3 * (stats.defMult || 1))) + agility;
    // Puissance brute (ancienne « attaque ») : sert aux pièges de zone et aux calculs d'XP.
    const power = Math.min(Math.floor((6 + enemyLevel * 5) * (stats.atkMult || 1)), Math.max(1, Math.floor(hp / 4)));

    // Les armes de l'ennemi : tirées parmi la moitié la plus puissante de celles de son niveau (un boss : les deux plus puissantes).
    let enemyWeapon = null;
    if(template.hasWeapon !== false){
        const availableWeapons = allWeaponsArg.filter(w => w.minLevel <= enemyLevel && !w.playerOnly)
            .sort((a, b) => b.damage - a.damage);
        if(availableWeapons.length > 0){
            const poolSize = boss ? Math.min(2, availableWeapons.length) : Math.max(1, Math.ceil(availableWeapons.length / 2));
            enemyWeapon = pickRandom(availableWeapons.slice(0, poolSize));
        }
    }
    // Dégâts ajoutés à chaque coup d'arme (la force de l'ennemi, en quelque sorte) : 45 % de la puissance brute.
    const weaponPower = enemyWeapon ? Math.floor(power * 0.45) : 0;

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

    const preferredColor = resolvePreferredColor(template);
    const weakColor = resolveWeakColor(preferredColor);

    return {
        templateId: template.id,
        race: template.race,
        class: template.title,
        playerClass: template.playerClass,
        name: `${template.name} ${template.title}`,
        hp: hp,
        maxHp: hp,
        attack: atk,
        defense: def,
        power,
        weaponPower,
        attributes: { strength, agility, intelligence: 0, stamina: 0, morale: 0 },
        resistances: buildResistances(template, enemyLevel),
        combatPoints: 0,
        mana: { red: 0, blue: 0, green: 0, yellow: 0, purple: 0 },
        spells: buildSpellLoadout(template, enemyLevel, { fullLoadout: boss }),
        weapon: enemyWeapon,
        level: enemyLevel,
        abilities: enemyAbilities,
        preferredColor,
        weakColor,
        isOverleveledChoice: false,
        inventoryItem: enemyInventoryItem,
        dropProfile: template.dropProfile ? { ...template.dropProfile } : null,
        isBoss: false,
        bossTier: null,
    };
}

// Renforce un ennemi pour en faire un boss (PV, attaque, défense, butin).
function applyBossScaling(boss, template){
    boss.isBoss = true;
    boss.maxHp = Math.max(1, Math.floor(boss.maxHp * 1.75));
    boss.hp = boss.maxHp;
    boss.attack = Math.max(1, Math.floor(boss.attack * 1.35));
    boss.defense = Math.max(0, Math.floor(boss.defense * 1.25));
    boss.weaponPower = Math.floor((boss.weaponPower || 0) * 1.35);
    if(boss.attributes){
        boss.attributes.strength = Math.ceil(boss.attributes.strength * 1.3);
        boss.attributes.agility = Math.ceil(boss.attributes.agility * 1.2);
    }
    boss.isOverleveledChoice = true;

    boss.dropProfile = {
        ...(boss.dropProfile || {}),
        goldMult: Math.max(2.2, toNumberOrDefault(template?.dropProfile?.goldMult, 1) * 1.5),
        dropChance: Math.max(0.8, toNumberOrDefault(template?.dropProfile?.dropChance, 0.6)),
        weaponChance: Math.max(0.35, toNumberOrDefault(template?.dropProfile?.weaponChance, 0.3))
    };
    return boss;
}

export function createBossEnemyForTier(tierLevel, allWeaponsArg = allWeapons, preferredTemplateId = null){
    const safeTier = Math.max(5, Math.floor(tierLevel || 5));
    return withSeededRandom(`boss|${safeTier}|${preferredTemplateId || ''}`, () => {
        const template = pickBossTemplate(preferredTemplateId) || pickRandom(loadEnemyCatalogSync());
        const bossLevel = safeTier + 2;
        const boss = buildEnemyFromTemplate(template, bossLevel, allWeaponsArg, { boss: true });

        applyBossScaling(boss, template);
        boss.bossTier = safeTier;
        boss.name = `Boss ${boss.name}`;

        return boss;
    });
}

// Ennemi rencontré sur la carte d'exploration (voir exploration.js > encounterFor) :
// { templateId, level, boss?: { name, level } } → ennemi prêt pour startNewCombat.
export function createMapEnemy(encounter, allWeaponsArg = allWeapons){
    const catalog = loadEnemyCatalogSync();
    const template = catalog.find(t => t.id === encounter?.templateId) || pickRandom(catalog);
    const level = Math.max(1, Math.floor(encounter?.level || 1));
    // Boss : équipement, sorts et objet pré-générés d'après son identité (ils ne bougent pas quand on revient le voir).
    // une copie de gabarit (`copyOf`) tire le même équipement que l'original : seuls le nom et la fiche du bestiaire changent
    const bossKey = encounter?.boss ? `map-boss|${encounter.enemyId || ''}|${template.copyOf || template.id}|${level}` : null;
    const enemyEntity = bossKey
        ? withSeededRandom(bossKey, () => buildEnemyFromTemplate(template, level, allWeaponsArg, { boss: true }))
        : buildEnemyFromTemplate(template, level, allWeaponsArg);

    if(encounter?.boss){
        applyBossScaling(enemyEntity, template);
        enemyEntity.bossTier = level;
        enemyEntity.name = encounter.boss.name || `Boss ${enemyEntity.name}`;
    }
    if(!encounter?.boss && encounter?.name) enemyEntity.name = encounter.name;   // ennemi de la carte (sentinelle ou hautes herbes) : le nom que le joueur a vu sur la carte
    enemyEntity.mapEnemyId = encounter?.enemyId || null;
    enemyEntity.spriteKey = encounter?.spriteKey || encounter?.enemyId || template.id;   // dessin affiché sur l'écran de combat
    // Préparation du terrain (terrain.js) : embuscade, faiblesse repérée, piège, alerte… appliquée par game.js.
    if(encounter?.biome) enemyEntity.biome = encounter.biome;
    if(encounter?.prep?.tags?.length) enemyEntity.prep = { ...encounter.prep };
    // Règles de duel (Fengmeng : miroir, tirs rapides, pièges de zone) appliquées par game.js, voir duel.js.
    if(encounter?.duel) enemyEntity.duel = { ...encounter.duel };
    // Phase d'un duel enchaîné : le héros garde les PV de la phase précédente (game.js : restartCombat).
    if(encounter?.carryHp) enemyEntity.carryHp = true;
    // Vague de l'Arène des Mille Flèches (arena.js) : prime versée par game.js à la victoire.
    if(encounter?.arena) {
        enemyEntity.arena = { ...encounter.arena };
        applyArenaScaling(enemyEntity, encounter.arena.statMult);
    }
    return enemyEntity;
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

export function generateEnemyChoices(playerLevel, count = 4, allWeaponsArg = allWeapons, playerMaxHp = null, allowedTemplateIds = null){
    const fullCatalog = loadEnemyCatalogSync();
    const zoneCatalog = Array.isArray(allowedTemplateIds) && allowedTemplateIds.length > 0
        ? fullCatalog.filter(template => allowedTemplateIds.includes(template.id))
        : fullCatalog;
    // Garde-fou : si la zone ne correspond à aucun gabarit connu, on retombe sur le catalogue complet.
    const sourceCatalog = zoneCatalog.length > 0 ? zoneCatalog : fullCatalog;

    const catalog = [...sourceCatalog];
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
        const template = fullCatalog.find(t => t.id === choices[idx].templateId);
        const boosted = buildEnemyFromTemplate(template, boostedLevel, allWeaponsArg);
        boosted.isOverleveledChoice = true;
        choices[idx] = boosted;
    }

    // Ennemi facile garanti : niveau réduit de 2 (minimum 1)
    const easyTemplate = pickRandom(sourceCatalog);
    const easyLevel = Math.max(1, playerLevel - 2);
    const easyEnemy = buildEnemyFromTemplate(easyTemplate, easyLevel, allWeaponsArg);

    // Un ennemi "affaibli" doit avoir moins de vie que le joueur.
    const safePlayerMaxHp = Math.max(1, Math.floor(playerMaxHp || 0));
    if(safePlayerMaxHp > 1) {
        const maxAllowedHp = safePlayerMaxHp - 1;
        if(easyEnemy.maxHp >= safePlayerMaxHp) {
            easyEnemy.maxHp = Math.max(1, maxAllowedHp);
            easyEnemy.hp = easyEnemy.maxHp;
            easyEnemy.attack = Math.min(easyEnemy.attack, Math.max(1, Math.floor(easyEnemy.maxHp / 4)));
        }
    }

    easyEnemy.isEasyChoice = true;
    choices.push(easyEnemy);

    return choices;
}

export function getEnemyDescription(enemy) {
    return enemy.name;
}
