// Attributs du joueur : source unique des effets (appliqués par game.js) et de leur description affichée.
// Module pur (aucun accès au DOM) pour rester testable.

// Règles paramétrables : un attribut influence la couleur de mana associée.
//  initial : mana de cette couleur au début de chaque combat, par point
//  gain    : mana en plus à chaque match de cette couleur, par point (3 tuiles => 3 + gain)
//  max     : plafond de mana de cette couleur, par point
export const ATTRIBUTE_MANA_RULES = {
    strength: { color: "red", bonuses: { initial: 1, gain: 1, max: 2 } },
    agility: { color: "yellow", bonuses: { initial: 1, gain: 1, max: 2 } },
    stamina: { color: "green", bonuses: { initial: 1, gain: 1, max: 2 } },
    intelligence: { color: "blue", bonuses: { initial: 1, gain: 1, max: 2 } },
    morale: { color: "purple", bonuses: { initial: 1, gain: 1, max: 2 } }
};

// Effet direct d'un point (stat de combat), appliqué par applyAttributeBonus.
export const ATTRIBUTE_STAT_EFFECTS = {
    strength: { stat: "attack", amount: 1 },
    agility: { stat: "defense", amount: 1 },
    intelligence: { stat: "spellPower", amount: 1 }, // calculé à l'utilisation (dégâts/soins des sorts)
    stamina: { stat: "maxHp", amount: 1 },
    morale: { stat: "attack", amount: 1 }
};

export const ATTRIBUTE_ORDER = ["strength", "agility", "intelligence", "stamina", "morale"];

export const MANA_COLOR_LABELS = { red: "rouge", blue: "bleu", green: "vert", yellow: "jaune", purple: "violet" };

export const ATTRIBUTE_LABELS = {
    strength: { name: "Battle", color: "red", icon: "sword" },
    agility: { name: "Defense", color: "yellow", icon: "shield" },
    intelligence: { name: "Intelligence", color: "blue", icon: "brain" },
    stamina: { name: "Stamina", color: "green", icon: "heart" },
    morale: { name: "Morale", color: "purple", icon: "target" }
};

const STAT_TEXT = {
    strength: (n) => ({
        title: "Attaque",
        line: `+${n} attaque : chaque attaque (arme, points d'action) inflige ${n} dégât de plus.`
    }),
    agility: (n) => ({
        title: "Défense",
        line: `+${n} défense : chaque attaque physique subie fait ${n} dégât de moins (jamais moins de 1), et les crânes vous blessent un peu moins.`
    }),
    intelligence: (n) => ({
        title: "Puissance magique",
        line: `+${n} puissance magique : chaque sort de dégâts ou de soin gagne ${n} point.`
    }),
    stamina: (n) => ({
        title: "Points de vie",
        line: `+${n} PV max (et ${n} PV rendu).`
    }),
    morale: (n) => ({
        title: "Attaque morale",
        line: `+${n} attaque : chaque attaque inflige ${n} dégât de plus.`
    })
};

const baseCap = entity => Math.max(0, Math.floor(entity?.maxMana ?? 50));

export function getAttributePoints(entity, attr) {
    return Math.max(0, Math.floor(entity?.attributes?.[attr] || 0));
}

// Bonus de mana d'une couleur pour un nombre de points donné.
export function manaBonusFor(attr, points, type) {
    const rule = ATTRIBUTE_MANA_RULES[attr];
    return (rule?.bonuses?.[type] || 0) * Math.max(0, Math.floor(points || 0));
}

// Mana obtenu pour un match de `len` tuiles de la couleur de l'attribut, avec `points` points.
export function manaPerMatch(attr, points, len = 3) {
    return len + manaBonusFor(attr, points, "gain");
}

// Description concrète du choix d'un attribut pour un joueur donné : valeurs avant -> après.
export function describeAttributeChoice(entity, attr) {
    const rule = ATTRIBUTE_MANA_RULES[attr];
    const eff = ATTRIBUTE_STAT_EFFECTS[attr];
    const label = ATTRIBUTE_LABELS[attr];
    if (!rule || !eff || !label) return null;
    const pts = getAttributePoints(entity, attr);
    const next = pts + 1;
    const color = MANA_COLOR_LABELS[rule.color];
    const stat = STAT_TEXT[attr](eff.amount);
    const b = rule.bonuses;
    const lines = [
        stat.line,
        `Couleur ${color} : un match de 3 tuiles ${color}s donne ${manaPerMatch(attr, next)} mana ${color} au lieu de ${manaPerMatch(attr, pts)}.`,
        `Un match de 4 donne ${manaPerMatch(attr, next, 4)} mana ${color} (tour bonus) ; de 5, ${manaPerMatch(attr, next, 5)}.`,
        `+${b.initial} mana ${color} en début de combat (${manaBonusFor(attr, next, "initial")} au total) ; réserve maximale de mana ${color} +${b.max} (${baseCap(entity) + manaBonusFor(attr, next, "max")} au total).`
    ];
    return {
        attr,
        name: label.name,
        color: rule.color,
        colorLabel: color,
        icon: label.icon,
        points: pts,
        nextPoints: next,
        statTitle: stat.title,
        lines
    };
}

// Résumé permanent des bonus de couleur déjà acquis (onglet Stats).
export function summarizeColorBonuses(entity) {
    return ATTRIBUTE_ORDER.map(attr => {
        const pts = getAttributePoints(entity, attr);
        const rule = ATTRIBUTE_MANA_RULES[attr];
        return {
            attr,
            color: rule.color,
            colorLabel: MANA_COLOR_LABELS[rule.color],
            points: pts,
            perMatch3: manaPerMatch(attr, pts, 3),
            initial: manaBonusFor(attr, pts, "initial"),
            cap: baseCap(entity) + manaBonusFor(attr, pts, "max")
        };
    });
}
