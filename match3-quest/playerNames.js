// Bibliothèque de noms de joueur aléatoires

const classNamePools = {
    sorcerer: [
        "Aelion", "Myrdhin", "Zorya", "Eldrin", "Nyxar", "Valeria", "Kael", "Ilyra"
    ],
    assassin: [
        "Shade", "Vesper", "Kairo", "Riven", "Nyra", "Silas", "Mira", "Dusk"
    ],
    templar: [
        "Aldric", "Seraphine", "Gideon", "Leona", "Bastien", "Elara", "Thorne", "Cassian"
    ],
    barbarian: [
        "Ragnar", "Brakka", "Torvin", "Skarn", "Hilda", "Korak", "Svala", "Draven"
    ]
};

const genericNames = [
    "Nox", "Liora", "Kaen", "Arin", "Zeph", "Valko", "Iris", "Orion"
];

function pickRandom(list) {
    if(!Array.isArray(list) || list.length === 0) return "Aventurier";
    return list[Math.floor(Math.random() * list.length)];
}

export function getRandomPlayerName(playerClass) {
    const classPool = classNamePools[playerClass] || [];
    const pool = classPool.length > 0 ? classPool : genericNames;
    return pickRandom(pool);
}
