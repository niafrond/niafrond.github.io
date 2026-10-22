// Pouvoirs de combat des compagnons (données pures et tirage, sans DOM ; appliqués par game.js : applyCompanionPowers).
//
// À la fin de chaque tour du joueur, chaque compagnon présent dans le groupe peut déclencher son pouvoir (`chance`), une fois par tour.
//   kind : 'extraMove' (Xiao Gui : coup supplémentaire sur le plateau, géré à part par game.js), 'heal', 'splash', 'mana', 'mirage'.
export const COMPANION_POWERS = {
    xiao_gui: { name: 'Coup de renard', kind: 'extraMove', chance: 0.30, text: '30 % : joue un coup supplémentaire sur le plateau.' },
    zhi: { name: 'Souffle de Zhi', kind: 'heal', chance: 0.25, healPct: 0.10, text: '25 % : rend 10 % des PV max au héros.' },
    dawa: { name: 'Mirage de Dawa', kind: 'mirage', chance: 0.20, text: "20 % : l'ennemi se perd dans un mirage et perd son tour." },
    yu: { name: "Jet d'eau de Yu", kind: 'splash', chance: 0.25, base: 4, perLevel: 1, text: "25 % : un jet d'eau blesse l'ennemi (4 + niveau du héros)." },
    etincelle: { name: "Étincelle d'Étincelle", kind: 'mana', chance: 0.30, amount: 4, text: '30 % : +4 mana dans une couleur au hasard.' }
};

export const MANA_COLORS = ['red', 'blue', 'green', 'yellow', 'purple'];

// Compagnons du groupe dont le pouvoir se joue en fin de tour (hors Xiao Gui, dont le coup est géré à part).
export const turnPowerIds = ids => [...(ids || [])].filter(id => COMPANION_POWERS[id] && COMPANION_POWERS[id].kind !== 'extraMove');

// Décide quels pouvoirs se déclenchent : renvoie la liste des { id, power, ...détail } ; `rng` permet de tester (défaut Math.random).
export function rollCompanionPowers(ids, hero, rng = Math.random) {
    const fired = [];
    turnPowerIds(ids).forEach(id => {
        const power = COMPANION_POWERS[id];
        if (rng() >= power.chance) return;
        const entry = { id, power };
        if (power.kind === 'heal') entry.amount = Math.max(1, Math.floor((hero?.maxHp || 1) * power.healPct));
        if (power.kind === 'splash') entry.amount = power.base + Math.max(0, Math.floor(hero?.level || 1)) * power.perLevel;
        if (power.kind === 'mana') { entry.amount = power.amount; entry.color = MANA_COLORS[Math.min(MANA_COLORS.length - 1, Math.floor(rng() * MANA_COLORS.length))]; }
        fired.push(entry);
    });
    return fired;
}
