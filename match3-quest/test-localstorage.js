// Test du système de localStorage pour Match3-Quest
// Ce fichier peut être exécuté dans la console du navigateur pour tester le système de sauvegarde

console.log('=== Test du système de localStorage ===');

// 1. Tester la présence d'une sauvegarde
const savedData = localStorage.getItem('player');
if (savedData) {
    console.log('✅ Sauvegarde trouvée dans le localStorage');
    const player = JSON.parse(savedData);
    console.log('📦 Données du joueur:', player);
    
    // Vérifier les propriétés importantes
    if (player.class) {
        console.log(`🎭 Classe: ${player.class}`);
    } else {
        console.log('⚠️ Aucune classe définie');
    }
    
    console.log(`❤️ HP: ${player.hp}/${player.maxHp}`);
    console.log(`⭐ Niveau: ${player.level}`);
    console.log(`📊 Attributs:`, player.attributes);
    console.log(`🔮 Sorts actifs:`, player.activeSpells);
    console.log(`⚔️ Armes:`, player.weapons);
} else {
    console.log('⚠️ Aucune sauvegarde trouvée');
}

// 2. Fonctions utiles pour tester
console.log('\n=== Fonctions de test disponibles ===');
console.log('testSave() - Crée une sauvegarde de test');
console.log('testLoad() - Affiche la sauvegarde actuelle');
console.log('testClear() - Efface la sauvegarde');
console.log('testSetClass(className) - Définit une classe de test');

window.testSave = function() {
    const testPlayer = {
        hp: 100,
        maxHp: 100,
        mana: { red: 0, blue: 0, green: 0, yellow: 0, purple: 0 },
        maxMana: 50,
        attack: 15,
        level: 1,
        attributes: { strength: 2, agility: 0, intelligence: 2, stamina: 0, morale: 0 },
        spells: [],
        activeSpells: [],
        availableSpells: [],
        weapons: [],
        equippedWeapon: null,
        availableWeapons: [],
        combatPoints: 0,
        bonusTurn: false,
        abilities: [],
        class: 'sorcerer',
        statusEffects: {},
        defense: 0
    };
    localStorage.setItem('player', JSON.stringify(testPlayer));
    console.log('✅ Sauvegarde de test créée avec la classe "sorcerer"');
};

window.testLoad = function() {
    const data = localStorage.getItem('player');
    if (data) {
        console.log('📦 Données chargées:', JSON.parse(data));
    } else {
        console.log('⚠️ Aucune sauvegarde');
    }
};

window.testClear = function() {
    localStorage.removeItem('player');
    console.log('🗑️ Sauvegarde effacée');
};

window.testSetClass = function(className) {
    const data = localStorage.getItem('player');
    if (data) {
        const player = JSON.parse(data);
        player.class = className;
        localStorage.setItem('player', JSON.stringify(player));
        console.log(`✅ Classe changée en "${className}"`);
    } else {
        console.log('⚠️ Aucune sauvegarde à modifier');
    }
};

console.log('\n🎮 Système de test chargé !');
