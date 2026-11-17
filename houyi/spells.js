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
        req.open('GET', './spells.json' + (typeof window !== 'undefined' && window.__houyiBuild ? '?v=' + window.__houyiBuild : ''), false);   // ?v= : anti-cache (voir index.html)
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
        ultimateSpells: []
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

// Sorts ultimes (jauge de rage) : hors des listes de sorts équipables et de la limite de 4 sorts.
export const ultimateSpells = Array.isArray(spellCatalog.ultimateSpells)
    ? spellCatalog.ultimateSpells.map(normalizeSpellColorAttributes)
    : [];

// Classes obtenues en cours de route (Moine, Alchimiste, Chamane) : leurs sorts reprennent l'effet d'un sort existant (donneur), avec
// leur propre nom, coût, niveau et description. Ainsi chaque effet est déjà géré par le moteur et par la version ennemie des sorts.
const donorSpells = [...sorcererSpells, ...assassinSpells, ...templarSpells, ...barbarianSpells];
function deriveSpells(className, recipes) {
    return recipes.map(({ from, id, name, cost, minLevel, description }) => {
        const donor = donorSpells.find(sp => sp.id === from);
        if (!donor) {   // catalogue absent (module chargé sans spells.json) : aucune dérivation
            if (donorSpells.length) throw new Error(`Sort donneur introuvable : ${from}`);
            return null;
        }
        const spell = { ...donor, id, name, class: className, minLevel: minLevel ?? donor.minLevel, description: description || donor.description };
        if (cost) spell.cost = { ...cost };
        return normalizeSpellColorAttributes(spell);
    }).filter(Boolean);
}

export const monkSpells = deriveSpells('monk', [
    { from: 'stoneskin', id: 'monkIronRobe', name: 'Robe de Fer', cost: { green: 6 }, minLevel: 1, description: 'Une robe de moine tissée de qì : défense en hausse quelques tours' },
    { from: 'defensiveWall', id: 'monkSutraWall', name: 'Murmure du Sutra', minLevel: 2 },
    { from: 'reinforce', id: 'monkLotusBreath', name: 'Souffle du Lotus', minLevel: 6 },
    { from: 'counterAttack', id: 'monkReturningPalm', name: 'Paume de Retour', minLevel: 8 },
    { from: 'iceShield', id: 'monkLakeCalm', name: 'Calme du Lac', minLevel: 7 },
    { from: 'barrier', id: 'monkSacredBarrier', name: 'Barrière Sacrée', minLevel: 10 },
    { from: 'holdTheLine', id: 'monkStillMind', name: 'Esprit Impassible', minLevel: 12 }
]);
export const alchemistSpells = deriveSpells('alchemist', [
    { from: 'flameBolts', id: 'alchemySparkPowder', name: 'Poudre d\'Étincelles', cost: { red: 4 }, minLevel: 1 },
    { from: 'weakness', id: 'alchemyBitterPowder', name: 'Poudre Amère', minLevel: 3 },
    { from: 'poisonBlade', id: 'alchemyVenomElixir', name: 'Élixir Venimeux', minLevel: 5 },
    { from: 'tigerEye', id: 'alchemyVigorPill', name: 'Pilule de Vigueur', minLevel: 6 },
    { from: 'manaSiphon', id: 'alchemyDistillation', name: 'Distillation de Qì', minLevel: 8 },
    { from: 'impureBreath', id: 'alchemyFoulFumes', name: 'Vapeurs Impures', minLevel: 11 },
    { from: 'flameSphere', id: 'alchemyPortableFurnace', name: 'Fournaise Portative', minLevel: 8 }
]);
export const shamanSpells = deriveSpells('shaman', [
    { from: 'shadowCurse', id: 'shamanSpiritSeal', name: 'Sceau des Esprits', minLevel: 1 },
    { from: 'handOfIce', id: 'shamanColdBreath', name: 'Souffle Glacial', minLevel: 4 },
    { from: 'cursedMark', id: 'shamanAncestorMark', name: 'Marque des Ancêtres', minLevel: 6 },
    { from: 'sleepDust', id: 'shamanDreamDust', name: 'Poussière de Rêve', minLevel: 7 },
    { from: 'rush', id: 'shamanThunderDance', name: 'Danse du Tonnerre', minLevel: 8 },
    { from: 'fingerOfDeath', id: 'shamanDeadFinger', name: 'Doigt des Morts', minLevel: 9 },
    { from: 'stealth', id: 'shamanSpiritVeil', name: 'Voile d\'Esprit', minLevel: 6 }
]);

// Toujours dérivée des listes par classe : une copie figée dans spells.json masquerait tout sort ajouté ensuite.
export const allClassSpells = [
    ...sorcererSpells,
    ...assassinSpells,
    ...templarSpells,
    ...barbarianSpells,
    ...monkSpells,
    ...alchemistSpells,
    ...shamanSpells
];

export function getSpellsByColor(color) {
    return allSpells.filter(spell => (spell.colors || [spell.color]).includes(color));
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
