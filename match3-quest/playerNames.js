// Bibliothèque de noms de joueur aléatoires

const classNamePools = {
    // Mage antique (Fāngshì)
    sorcerer: [
        "Li Wei", "Zhang Yun", "Lan Xi", "Chen Daoxi", "Wen Qing", "Su Ming", "Yun Shu", "Bai Heng"
    ],
    // Rôdeur errant (Yóuxiá, le Hou Yi par défaut)
    assassin: [
        "Hou Yi", "Feng Jian", "Mei Ling", "Yu Hao", "Lian Hua", "Tian Lang", "Xiao Yan", "Jin Rui"
    ],
    // Commandant (Wǔjiàng)
    templar: [
        "Zhao Lin", "Guan Tai", "Liu Kun", "Wang Gang", "Mu Rong", "Shen Bao", "Tang Rui", "Gao Heng"
    ],
    // Guerrier (Wǔshì)
    barbarian: [
        "Tie Shan", "Hu Meng", "Bao Lei", "Da Wei", "Gang Lie", "Hei Long", "Shi Kai", "Lei Zhen"
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
