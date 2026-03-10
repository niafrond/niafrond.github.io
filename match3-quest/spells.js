// Catalogue des sorts charge depuis spells.json

export const SpellType = {
    DAMAGE: 'damage',
    HEAL: 'heal',
    BUFF: 'buff',
    DEBUFF: 'debuff'
};

export const ManaColor = {
    RED: 'red',
    BLUE: 'blue',
    GREEN: 'green',
    YELLOW: 'yellow'
};

function loadSpellsCatalogSync(){
    try {
        const req = new XMLHttpRequest();
        req.open('GET', './spells.json', false);
        req.send(null);
        if(req.status >= 200 && req.status < 300){
            const parsed = JSON.parse(req.responseText);
            if(parsed && typeof parsed === 'object'){
                return parsed;
            }
        }
    } catch (error) {
        console.error('Impossible de charger spells.json', error);
    }

    return {
        allSpells: [],
        sorcererSpells: [],
        assassinSpells: [],
        templarSpells: [],
        barbarianSpells: [],
        allClassSpells: []
    };
}

const spellCatalog = loadSpellsCatalogSync();

function uniqueColors(colors){
    const seen = new Set();
    const normalized = [];
    (colors || []).forEach(color => {
        if(typeof color !== 'string') return;
        const value = color.trim().toLowerCase();
        if(!value || seen.has(value)) return;
        seen.add(value);
        normalized.push(value);
    });
    return normalized;
}

function deriveSpellColors(spell){
    if(!spell || typeof spell !== 'object') return [];

    if(Array.isArray(spell.colors) && spell.colors.length > 0) {
        return uniqueColors(spell.colors);
    }

    if(Array.isArray(spell.couleurs) && spell.couleurs.length > 0) {
        return uniqueColors(spell.couleurs);
    }

    if(typeof spell.color === 'string' && spell.color.trim().length > 0) {
        return uniqueColors([spell.color]);
    }

    if(spell.cost && typeof spell.cost === 'object') {
        return uniqueColors(Object.keys(spell.cost));
    }

    return [];
}

function normalizeSpellColorAttributes(spell){
    const colors = deriveSpellColors(spell);
    return {
        ...spell,
        colors,
        couleurs: [...colors],
        color: spell.color || colors[0] || null
    };
}

export const allSpells = Array.isArray(spellCatalog.allSpells)
    ? spellCatalog.allSpells.map(normalizeSpellColorAttributes)
    : [];
export const sorcererSpells = Array.isArray(spellCatalog.sorcererSpells)
    ? spellCatalog.sorcererSpells.map(normalizeSpellColorAttributes)
    : [];
export const assassinSpells = Array.isArray(spellCatalog.assassinSpells)
    ? spellCatalog.assassinSpells.map(normalizeSpellColorAttributes)
    : [];
export const templarSpells = Array.isArray(spellCatalog.templarSpells)
    ? spellCatalog.templarSpells.map(normalizeSpellColorAttributes)
    : [];
export const barbarianSpells = Array.isArray(spellCatalog.barbarianSpells)
    ? spellCatalog.barbarianSpells.map(normalizeSpellColorAttributes)
    : [];

export const allClassSpells = Array.isArray(spellCatalog.allClassSpells)
    ? spellCatalog.allClassSpells
    : [
        ...sorcererSpells,
        ...assassinSpells,
        ...templarSpells,
        ...barbarianSpells
    ];

export function getSpellsByColor(color) {
    return allSpells.filter(spell => spell.color === color);
}

export function getSpellsByType(type) {
    return allSpells.filter(spell => spell.type === type);
}

export function getSpellsByLevel(level) {
    return allSpells.filter(spell => spell.minLevel <= level);
}

export function getSpellById(id) {
    return allSpells.find(spell => spell.id === id);
}

export function getClassSpellById(id) {
    return allClassSpells.find(spell => spell.id === id);
}

export function getSpellsByClass(className, playerLevel = 1) {
    return allClassSpells.filter(spell =>
        spell.class === className && playerLevel >= spell.minLevel
    );
}

export function getAllSpells() {
    return [...allSpells, ...allClassSpells];
}

const numericCosts = allSpells
    .map(spell => spell.cost)
    .filter(cost => typeof cost === 'number');

export const SpellStats = {
    totalSpells: allSpells.length,
    totalClassSpells: allClassSpells.length,
    totalAllSpells: allSpells.length + allClassSpells.length,
    byColor: {
        red: getSpellsByColor(ManaColor.RED).length,
        blue: getSpellsByColor(ManaColor.BLUE).length,
        green: getSpellsByColor(ManaColor.GREEN).length,
        yellow: getSpellsByColor(ManaColor.YELLOW).length
    },
    byType: {
        damage: getSpellsByType(SpellType.DAMAGE).length,
        heal: getSpellsByType(SpellType.HEAL).length
    },
    byClass: {
        sorcerer: sorcererSpells.length,
        assassin: assassinSpells.length,
        templar: templarSpells.length,
        barbarian: barbarianSpells.length
    },
    maxDamage: Math.max(0, ...allSpells.filter(s => s.dmg).map(s => s.dmg)),
    maxHeal: Math.max(0, ...allSpells.filter(s => s.heal).map(s => s.heal)),
    minCost: numericCosts.length > 0 ? Math.min(...numericCosts) : 0,
    maxCost: numericCosts.length > 0 ? Math.max(...numericCosts) : 0
};

export function displaySpellStats() {
    console.log('=== STATISTIQUES DES SORTS ===');
    console.log(`Total de sorts generiques: ${SpellStats.totalSpells}`);
    console.log(`Total de sorts de classe: ${SpellStats.totalClassSpells}`);
    console.log(`Total general: ${SpellStats.totalAllSpells}`);
    console.log('\nSorts generiques par couleur:');
    console.log(`  Rouge (Feu): ${SpellStats.byColor.red}`);
    console.log(`  Bleu (Glace): ${SpellStats.byColor.blue}`);
    console.log(`  Vert (Nature): ${SpellStats.byColor.green}`);
    console.log(`  Jaune (Foudre): ${SpellStats.byColor.yellow}`);
    console.log('\nSorts generiques par type:');
    console.log(`  Degats: ${SpellStats.byType.damage}`);
    console.log(`  Soins: ${SpellStats.byType.heal}`);
    console.log('\nSorts par classe:');
    console.log(`  Sorcerer: ${SpellStats.byClass.sorcerer}`);
    console.log(`  Assassin: ${SpellStats.byClass.assassin}`);
    console.log(`  Templar: ${SpellStats.byClass.templar}`);
    console.log(`  Barbarian: ${SpellStats.byClass.barbarian}`);
    console.log('\nExtremas (sorts generiques):');
    console.log(`  Degats max: ${SpellStats.maxDamage}`);
    console.log(`  Soins max: ${SpellStats.maxHeal}`);
    console.log(`  Cout min: ${SpellStats.minCost}`);
    console.log(`  Cout max: ${SpellStats.maxCost}`);
}
