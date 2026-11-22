// Pouvoirs de combat des compagnons (données pures et tirage, sans DOM ; appliqués par game.js : applyCompanionPowers).
//
// À la fin de chaque tour du joueur, chaque compagnon présent dans le groupe peut déclencher son pouvoir (`chance`), une fois par tour.
//   kind : 'extraMove' (Xiao Gui : coup supplémentaire sur le plateau, géré à part par game.js), 'heal', 'splash', 'mana', 'mirage',
//          'rage' (+ part de la jauge de rage), 'arrows' (toutes les tuiles d'une couleur deviennent des flèches), 'steal' (vole le qì d'une couleur à l'ennemi).
export const COMPANION_POWERS = {
    xiao_gui: { name: 'Coup de renard', kind: 'extraMove', chance: 0.30, text: '30 % : joue un coup supplémentaire sur le plateau.' },
    zhi: { name: 'Souffle de Zhi', kind: 'heal', chance: 0.25, healPct: 0.10, text: '25 % : rend 10 % des PV max au héros.' },
    dawa: { name: 'Mirage de Dawa', kind: 'mirage', chance: 0.20, text: "20 % : l'ennemi se perd dans un mirage et perd son tour." },
    yu: { name: "Jet d'eau de Yu", kind: 'splash', chance: 0.25, base: 4, perLevel: 1, text: "25 % : un jet d'eau blesse l'ennemi (4 + niveau du héros)." },
    braise: { name: 'Colère de Braise', kind: 'rage', chance: 0.15, chancePerLevel: 0.0015, chanceMax: 0.25, ragePct: 0.5, text: '15 % (jusqu\'à 25 % avec le niveau) : remplit 50 % de la jauge de rage.' },
    jian: { name: 'Volée de Jian', kind: 'arrows', chance: 0.05, chancePerLevel: 0.001, chanceMax: 0.12, text: '5 % (jusqu\'à 12 % avec le niveau) : toutes les tuiles d\'une couleur au hasard deviennent des flèches.' },
    tou: { name: 'Larcin de Tou', kind: 'steal', chance: 0.30, text: "30 % : vole tout le qì d'une couleur au hasard à l'ennemi." },
    etincelle: { name: "Foudre de Leigong", kind: 'mana', chance: 0.30, amount: 4, amountPerLevels: 5, text: '30 % : +4 qì dans une couleur au hasard, +1 tous les 5 niveaux du héros.' }
};

export const MANA_COLORS = ['red', 'blue', 'green', 'yellow', 'purple'];

// Les pouvoirs à valeur fixe perdaient tout leur poids à haut niveau (les sorts y coûtent 100 à 270 qì, alors que Zhi, Dawa et Yu suivent le niveau) :
// Braise et Jian gagnent en fréquence (plafonnée), Leigong en qì. Valeurs validées par l'agent Équilibrage (SPECS.md, 2026-11-22).
const heroLevel = hero => Math.max(1, Math.floor(hero?.level || 1));

/** Chance de déclenchement d'un pouvoir pour ce héros (fixe, ou croissante avec le niveau puis plafonnée). */
export function powerChance(power, hero) {
    if (!power?.chancePerLevel) return power?.chance || 0;
    return Math.min(power.chanceMax ?? 1, power.chance + (heroLevel(hero) - 1) * power.chancePerLevel);
}

/** Qì rendu par Leigong : 4, puis +1 tous les `amountPerLevels` niveaux. */
export const manaPowerAmount = (power, hero) => power.amount + (power.amountPerLevels ? Math.floor(heroLevel(hero) / power.amountPerLevels) : 0);

// Compagnons du groupe dont le pouvoir se joue en fin de tour (hors Xiao Gui, dont le coup est géré à part).
export const turnPowerIds = ids => [...(ids || [])].filter(id => COMPANION_POWERS[id] && COMPANION_POWERS[id].kind !== 'extraMove');

// Décide quels pouvoirs se déclenchent : renvoie la liste des { id, power, ...détail } ; `rng` permet de tester (défaut Math.random).
export function rollCompanionPowers(ids, hero, rng = Math.random, enemy = null) {
    const fired = [];
    turnPowerIds(ids).forEach(id => {
        const power = COMPANION_POWERS[id];
        if (rng() >= powerChance(power, hero)) return;
        const entry = { id, power };
        if (power.kind === 'heal') entry.amount = Math.max(1, Math.floor((hero?.maxHp || 1) * power.healPct));
        if (power.kind === 'splash') entry.amount = power.base + Math.max(0, Math.floor(hero?.level || 1)) * power.perLevel;
        if (power.kind === 'mana') { entry.amount = manaPowerAmount(power, hero); entry.color = MANA_COLORS[Math.min(MANA_COLORS.length - 1, Math.floor(rng() * MANA_COLORS.length))]; }
        if (power.kind === 'rage') entry.amount = power.ragePct;
        if (power.kind === 'steal') {
            const stock = MANA_COLORS.filter(c => Math.floor(enemy?.mana?.[c] || 0) > 0);
            if (!stock.length) return;   // rien à voler : le pouvoir ne se déclenche pas
            entry.color = stock[Math.min(stock.length - 1, Math.floor(rng() * stock.length))];
        }
        fired.push(entry);
    });
    return fired;
}
