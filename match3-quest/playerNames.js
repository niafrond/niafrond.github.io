// Bibliothèque de noms de joueur aléatoires

const classNamePools = {
    // Maître taoïste
    sorcerer: [
        "Li Wei", "Zhang Yun", "Lan Xi", "Chen Daoxi", "Wen Qing", "Su Ming", "Yun Shu", "Bai Heng"
    ],
    // Archer céleste (le Hou Yi par défaut)
    assassin: [
        "Hou Yi", "Feng Jian", "Mei Ling", "Yu Hao", "Lian Hua", "Tian Lang", "Xiao Yan", "Jin Rui"
    ],
    // Garde impérial
    templar: [
        "Zhao Yun", "Guan Tai", "Liu Shan", "Wang Gang", "Mu Lan", "Shen Bao", "Tang Rui", "Gao Heng"
    ],
    // Guerrier des steppes
    barbarian: [
        "Batu", "Temujin", "Borte", "Subutai", "Qasar", "Hulan", "Arslan", "Jebe"
    ]
};

const genericNames = [
    "Hou Yi", "Ming Yue", "Xiao Long", "Jin Hao", "Lan Xi", "Bai Hu", "Yu Feng", "Tian Ming"
];

function pickRandom(list) {
    if(!Array.isArray(list) || list.length === 0) return "Hou Yi";
    return list[Math.floor(Math.random() * list.length)];
}

export function getRandomPlayerName(playerClass) {
    const classPool = classNamePools[playerClass] || [];
    const pool = classPool.length > 0 ? classPool : genericNames;
    return pickRandom(pool);
}
