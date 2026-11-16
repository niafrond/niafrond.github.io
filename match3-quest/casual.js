// Mode Casual : le côté RPG s'efface, le jeu choisit à la place du joueur son stuff, ses armes et ses points d'attribut, sans rien annoncer,
// et change l'équipement vers un profil plus défensif quand le héros enchaîne les défaites. Module pur (sans DOM) : les choix sont calculés ici,
// `casualPilot.js` les applique au héros.

export const LOSS_STREAK_DEFENSIVE = 2;   // défaites d'affilée avant de passer à un équipement défensif
export const LOSS_STREAK_TANK = 4;        // ... puis à un équipement purement protecteur

// Une session Casual : 1 ou 2 combats pour 15 à 30 minutes en tout, puis le joueur pose son téléphone. Les combats durent donc plus longtemps
// (plus de PV à l'ennemi, ses dégâts par tour baissent d'autant : le danger reste le même) et les rencontres au hasard sont plus rares.
export const CASUAL_DURATION_FACTOR = 2.5;        // combat ordinaire : 3 à 4 min -> environ 9 min
export const CASUAL_BOSS_DURATION_FACTOR = 1.6;   // boss : 7 à 8 min -> environ 12 min
export const CASUAL_ENCOUNTER_FACTOR = 0.5;       // moitié moins de rencontres au hasard
export const casualDurationFactor = category => (category === 'boss' ? CASUAL_BOSS_DURATION_FACTOR : CASUAL_DURATION_FACTOR);

/** Profil d'équipement selon la série de défaites : 'balanced' | 'defensive' | 'tank'. */
export const biasFor = lossStreak => (lossStreak >= LOSS_STREAK_TANK ? 'tank' : lossStreak >= LOSS_STREAK_DEFENSIVE ? 'defensive' : 'balanced');

const STUFF_WEIGHTS = {
    balanced: { atk: 3, def: 3, hp: 0.05, poison: 0.02 },
    defensive: { atk: 1.5, def: 5, hp: 0.1, poison: 0.04 },
    tank: { atk: 0.5, def: 6, hp: 0.2, poison: 0.05 }
};
const WEAPON_AP_EXPONENT = { balanced: 0.5, defensive: 0.75, tank: 1 };   // plus le profil est prudent, plus une arme économe en PA compte
const ATTRIBUTE_RATIOS = {
    balanced: { strength: 3, agility: 2, stamina: 3, morale: 1, intelligence: 1 },
    defensive: { strength: 2, agility: 3, stamina: 4, morale: 1, intelligence: 1 },
    tank: { strength: 1, agility: 4, stamina: 5, morale: 1, intelligence: 1 }
};

/** Valeur d'une pièce de stuff pour un profil. */
export function stuffScore(s, bias = 'balanced') {
    if (!s) return 0;
    const w = STUFF_WEIGHTS[bias] || STUFF_WEIGHTS.balanced;
    return (s.atkBonus || 0) * w.atk + (s.defBonus || 0) * w.def + (s.maxHp || 0) * w.hp + (s.poisonResist || 0) * w.poison;
}

/**
 * Meilleur stuff porté par emplacement parmi les pièces possédées et utilisables au niveau du héros.
 * @param {{ stuffOwned?: string[], stuff?: Object, level?: number }} hero
 * @param {(id: string) => Object} getStuffById
 * @returns {Object<string, string|null>} emplacement -> id (la pièce actuelle est gardée à égalité, pour ne pas changer pour rien)
 */
export function planStuff(hero, bias, getStuffById, slots = ['head', 'neck', 'wrist', 'ring']) {
    const plan = {};
    const level = hero?.level || 1;
    const owned = (hero?.stuffOwned || []).map(id => getStuffById(id)).filter(s => s && s.minLevel <= level);
    for (const slot of slots) {
        const current = hero?.stuff?.[slot] || null;
        let best = current ? owned.find(s => s.id === current) || null : null;
        for (const s of owned) if (s.slot === slot && (!best || stuffScore(s, bias) > stuffScore(best, bias))) best = s;
        plan[slot] = best ? best.id : null;
    }
    return plan;
}

/** Valeur d'une arme : dégâts par point d'action (l'exposant dépend du profil), plus ses bonus d'Att/Déf. */
export function weaponScore(w, bias = 'balanced', bonuses = {}) {
    if (!w) return 0;
    const ap = Math.max(1, w.actionPoints || 1);
    const b = bonuses[w.id] || {};
    return (w.damage || 0) / Math.pow(ap, WEAPON_AP_EXPONENT[bias] ?? 0.5) + (b.atkBonus || 0) * 2 + (b.defBonus || 0) * (bias === 'balanced' ? 2 : 5);
}

/** Armes à tenir : { right, left } (ids ou null). Une arme à deux mains n'est choisie que si elle vaut plus que les deux meilleures à une main. */
export function planWeapons(hero, bias, bonuses = {}) {
    const level = hero?.level || 1;
    const usable = (hero?.weapons || []).filter(w => w && w.damage !== undefined && (w.minLevel || 1) <= level);
    const ranked = [...usable].sort((a, b) => weaponScore(b, bias, bonuses) - weaponScore(a, bias, bonuses));
    const best = ranked[0];
    if (!best) return { right: null, left: null };
    const ones = ranked.filter(w => !w.twoHanded);
    const pair = (ones[0] ? weaponScore(ones[0], bias, bonuses) : 0) + (ones[1] ? weaponScore(ones[1], bias, bonuses) : 0);
    if (best.twoHanded && weaponScore(best, bias, bonuses) >= pair) return { right: best.id, left: null };
    return { right: ones[0]?.id || null, left: ones[1]?.id || null };
}

/** Attributs à augmenter pour dépenser `points` points : toujours celui le plus en retard sur la répartition visée. */
export function planAttributes(attributes, points, bias = 'balanced') {
    const ratios = ATTRIBUTE_RATIOS[bias] || ATTRIBUTE_RATIOS.balanced;
    const counts = { ...attributes };
    const picks = [];
    for (let i = 0; i < Math.max(0, points); i++) {
        const next = Object.keys(ratios).reduce((a, b) => ((counts[a] || 0) / ratios[a] <= (counts[b] || 0) / ratios[b] ? a : b));
        counts[next] = (counts[next] || 0) + 1;
        picks.push(next);
    }
    return picks;
}
