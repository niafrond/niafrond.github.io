// Couloir de dégâts : un coup d'arme ou un sort de dégâts doit rapporter, par ressource dépensée, des dégâts proches de la courbe de son niveau.
// Armes : dégâts par point d'action (PA) selon le niveau minimal ; sorts de dégâts : dégâts par point de qì (tous coloris confondus).
// Une arme ou un sort hors du couloir fausse la mesure « dégâts du héros par cycle » dont dépend la durée des combats (combatBalance.js).
// Module pur (sans DOM), utilisé par les tests ; les effets secondaires (soin, contrôle, drain) se paient dans le coût, pas dans le couloir.

export const CORRIDOR_TOLERANCE = 0.25;   // ±25 % autour de la courbe de référence

// Points d'ancrage [niveau, dégâts par ressource] ; interpolation linéaire entre eux, constante au-delà.
export const WEAPON_DAMAGE_PER_AP = [[1, 3.8], [5, 6], [10, 9], [16, 13], [22, 17], [30, 20.6], [46, 26.5], [70, 35]];
export const SPELL_DAMAGE_PER_QI = [[1, 2.4], [15, 2.4], [16, 2.8], [30, 3.15], [48, 3.6], [66, 4], [70, 4.1]];

export function referenceAt(anchors, level) {
    const L = Math.max(1, Number(level) || 1);
    if (L <= anchors[0][0]) return anchors[0][1];
    for (let i = 1; i < anchors.length; i++) {
        const [l1, v1] = anchors[i], [l0, v0] = anchors[i - 1];
        if (L <= l1) return v0 + (v1 - v0) * (L - l0) / (l1 - l0);
    }
    return anchors[anchors.length - 1][1];
}

export const spellQiCost = cost => typeof cost === 'number' ? cost : Object.values(cost || {}).reduce((total, v) => total + (Number(v) || 0), 0);

/** Écart relatif d'un ratio à sa référence (0,1 = +10 %). */
export const deviation = (ratio, reference) => ratio / reference - 1;

/** Armes hors couloir : [{ id, level, ratio, reference, deviation }]. */
export function weaponOutliers(weapons, tolerance = CORRIDOR_TOLERANCE) {
    return weapons.filter(w => w.damage > 0 && w.actionPoints > 0).map(w => {
        const ratio = w.damage / w.actionPoints, reference = referenceAt(WEAPON_DAMAGE_PER_AP, w.minLevel);
        return { id: w.id, level: w.minLevel, ratio, reference, deviation: deviation(ratio, reference) };
    }).filter(x => Math.abs(x.deviation) > tolerance);
}

/** Sorts de dégâts purs hors couloir (les sorts à effet : soin, drain, contrôle… sont exclus). */
export function spellOutliers(spells, tolerance = CORRIDOR_TOLERANCE) {
    return spells.filter(s => s.type === 'damage' && s.dmg > 0 && spellQiCost(s.cost) > 0).map(s => {
        const ratio = s.dmg / spellQiCost(s.cost), reference = referenceAt(SPELL_DAMAGE_PER_QI, s.minLevel);
        return { id: s.id, level: s.minLevel, ratio, reference, deviation: deviation(ratio, reference) };
    }).filter(x => Math.abs(x.deviation) > tolerance);
}
