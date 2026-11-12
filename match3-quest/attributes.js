// Attributs du joueur : source unique des effets (appliqués par game.js) et de leur description affichée.
// Module pur (aucun accès au DOM) pour rester testable.

// Règles paramétrables : un attribut influence la couleur de qì associée, mais PAS à chaque point (pas de virgules : tout est entier).
// Chaque bonus est un rythme [période, reste] : le point n° n (1, 2, 3…) donne +1 si n % période === reste. Ainsi un point peut donner
// +1 d'attaque sans rien de plus pour la couleur, et les bonus de couleur alternent d'un point à l'autre :
//  initial : qì de cette couleur au début de chaque combat   -> points 1, 5, 9…    (1 point sur 4 : 18 aux 69 points)
//  gain    : qì en plus à chaque match de cette couleur      -> points 3, 7, 11…   (1 point sur 4 : 17 aux 69 points)
//  max     : plafond de qì de cette couleur                  -> points multiples de 3 (1 point sur 3 : 23 aux 69 points du niveau 70,
//            soit 50 + 23 = 73 ; les 27 restants viennent de l'équipement, soit 100 au total : voir statBudget.js)
const COLOR_RHYTHM = { initial: [4, 1], gain: [4, 3], max: [3, 0] };
export const ATTRIBUTE_MANA_RULES = {
    strength: { color: "red", rhythm: COLOR_RHYTHM },
    agility: { color: "yellow", rhythm: COLOR_RHYTHM },
    stamina: { color: "green", rhythm: COLOR_RHYTHM },
    intelligence: { color: "blue", rhythm: COLOR_RHYTHM },
    morale: { color: "purple", rhythm: COLOR_RHYTHM }
};

// Effet direct d'un point (stat de combat), appliqué par applyAttributeBonus.
export const ATTRIBUTE_STAT_EFFECTS = {
    strength: { stat: "attack", amount: 1 },
    agility: { stat: "defense", amount: 1 },
    intelligence: { stat: "spellPower", amount: 1 }, // calculé à l'utilisation (dégâts/soins des sorts)
    stamina: { stat: "maxHp", amount: 1 },
    morale: { stat: "defense", amount: 1 } // le moral donne de l'agilité (défense et initiative), pas de l'attaque
};

// Jauge de rage (ultimes, sur 100) : Battle donne de la rage dès le début du combat, Moral accélère son accumulation (la rage gagnée
// en perdant des PV est majorée d'un pourcentage). Même principe que la couleur : des paliers entiers qui alternent, et un plafond
// atteint au niveau 70 (69 points) : rage de départ 1 par point + 1 de plus aux points pairs = 103, plafonnée à 100 ; rage gagnée
// +3 % aux points pairs = +102 %, plafonnée à +100 % (jamais plus du double).
//  chaque palier : { rhythm: [période, reste], amount } (voir manaBonusFor) ; `cap` plafond du total.
export const RAGE_CAP = 100;
export const ATTRIBUTE_RAGE_RULES = {
    strength: { initial: { cap: RAGE_CAP, steps: [{ rhythm: [1, 0], amount: 1 }, { rhythm: [2, 0], amount: 1 }] } },
    morale: { gainPct: { cap: 100, steps: [{ rhythm: [2, 0], amount: 3 }] } }
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
        line: `+${n} attaque : ${n} % de chances de coup critique en plus (arme, crânes) ; la force augmente aussi les dégâts des crânes (+1 par crâne tous les 2 points).`
    }),
    agility: (n) => ({
        title: "Défense",
        line: `+${n} défense : ${n} % de chances de bloquer en tout ou partie une attaque armée ou de crânes.`
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
        title: "Agilité morale",
        line: `+${n} défense et +${n} agilité : ${n} % de chances de bloquer en plus, et l'initiative compte les points de moral comme ceux d'agilité.`
    })
};

const baseCap = entity => Math.max(0, Math.floor(entity?.maxMana ?? 50));

export function getAttributePoints(entity, attr) {
    return Math.max(0, Math.floor(entity?.attributes?.[attr] || 0));
}

// Nombre de points parmi les `points` premiers (n = 1..points) qui donnent un bonus au rythme [période, reste].
const countRhythm = (points, [period, rest]) => {
    const p = Math.max(0, Math.floor(points || 0));
    return rest === 0 ? Math.floor(p / period) : p >= rest ? Math.floor((p - rest) / period) + 1 : 0;
};

// Bonus de qì d'une couleur (initial | gain | max) pour un nombre de points donné.
export function manaBonusFor(attr, points, type) {
    const rhythm = ATTRIBUTE_MANA_RULES[attr]?.rhythm?.[type];
    return rhythm ? countRhythm(points, rhythm) : 0;
}

// Rage de départ (sur 100) et majoration (%) de la rage gagnée pour `points` points d'un attribut.
const rageTotal = (rule, points) => rule ? Math.min(rule.cap, rule.steps.reduce((sum, st) => sum + st.amount * countRhythm(points, st.rhythm), 0)) : 0;
export const rageInitialFor = (attr, points) => rageTotal(ATTRIBUTE_RAGE_RULES[attr]?.initial, points);
export const rageGainPctFor = (attr, points) => rageTotal(ATTRIBUTE_RAGE_RULES[attr]?.gainPct, points);

/** Rage dont le héros dispose au début de chaque combat (points de Battle). */
export const startingRage = entity => rageInitialFor("strength", getAttributePoints(entity, "strength"));

/** Rage gagnée `base` après majoration par le Moral (arrondie, jamais inférieure à `base`). */
export function boostedRageGain(entity, base) {
    const gain = Math.max(0, Math.floor(base || 0));
    if (gain <= 0) return 0;
    return Math.round(gain * (1 + rageGainPctFor("morale", getAttributePoints(entity, "morale")) / 100));
}

// Qì obtenu pour un match de `len` tuiles de la couleur de l'attribut, avec `points` points.
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
    const rageLines = [];
    if (ATTRIBUTE_RAGE_RULES[attr]?.initial) {
        const gain = rageInitialFor(attr, next) - rageInitialFor(attr, pts);
        rageLines.push(`Rage : ${gain > 0 ? `+${gain} de jauge` : 'pas de jauge en plus'} dès le début du combat (${rageInitialFor(attr, next)} au total, ${ATTRIBUTE_RAGE_RULES[attr].initial.cap} au plus).`);
    }
    if (ATTRIBUTE_RAGE_RULES[attr]?.gainPct) {
        const gain = rageGainPctFor(attr, next) - rageGainPctFor(attr, pts);
        rageLines.push(`Rage : ${gain > 0 ? `+${gain} %` : 'pas de bonus'} de rage gagnée en perdant des PV (${rageGainPctFor(attr, next)} % au total, ${ATTRIBUTE_RAGE_RULES[attr].gainPct.cap} % au plus).`);
    }
    const lines = [
        stat.line,
        `Couleur ${color} : un match de 3 tuiles ${color}s donne ${manaPerMatch(attr, next)} qì ${color}${manaBonusFor(attr, next, "gain") > manaBonusFor(attr, pts, "gain") ? ` au lieu de ${manaPerMatch(attr, pts)}` : ' (pas de gain de match avec ce point)'}.`,
        `Un match de 4 donne ${manaPerMatch(attr, next, 4)} qì ${color} (tour bonus) ; de 5, ${manaPerMatch(attr, next, 5)}.`,
        manaBonusFor(attr, next, "initial") > manaBonusFor(attr, pts, "initial")
            ? `+1 qì ${color} en début de combat (${manaBonusFor(attr, next, "initial")} au total).`
            : `Pas de qì ${color} de départ en plus avec ce point (${manaBonusFor(attr, next, "initial")} au total).`,
        manaBonusFor(attr, next, "max") > manaBonusFor(attr, pts, "max")
            ? `Réserve maximale de qì ${color} +1 (${baseCap(entity) + manaBonusFor(attr, next, "max")} au total).`
            : `Réserve maximale de qì ${color} inchangée avec ce point (${baseCap(entity) + manaBonusFor(attr, next, "max")}).`,
        ...rageLines
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

// Total de points d'attribut dépensés.
export const totalAttributePoints = entity => ATTRIBUTE_ORDER.reduce((sum, attr) => sum + getAttributePoints(entity, attr), 0);

/**
 * Remet à zéro tous les points d'attribut dépensés et les rend à dépenser (menu « Réinitialiser les points ») : retire l'effet direct
 * de chaque point (attaque pour Battle, défense pour Agilité et Moral, PV max pour Endurance) et rend les points dans
 * `unspentLevelPoints`. Les bonus de couleur de qì disparaissent avec les points (ils se calculent d'après eux). Hors combat seulement :
 * l'appelant vérifie. Renvoie { refunded } (nombre de points rendus).
 */
export function respecAttributes(entity) {
    const pts = Object.fromEntries(ATTRIBUTE_ORDER.map(attr => [attr, getAttributePoints(entity, attr)]));
    const refunded = ATTRIBUTE_ORDER.reduce((sum, attr) => sum + pts[attr], 0);
    if (refunded <= 0) return { refunded: 0 };
    entity.attack = Math.max(0, Math.floor(entity.attack || 0) - pts.strength);
    entity.defense = Math.max(0, Math.floor(entity.defense || 0) - pts.agility - pts.morale);
    entity.maxHp = Math.max(1, Math.floor(entity.maxHp || 1) - pts.stamina);
    entity.hp = Math.max(1, Math.min(Math.floor(entity.hp || 1), entity.maxHp));
    ATTRIBUTE_ORDER.forEach(attr => { entity.attributes[attr] = 0; });
    entity.unspentLevelPoints = Math.max(0, Math.floor(entity.unspentLevelPoints || 0)) + refunded;
    return { refunded };
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

// Agilité effective (initiative en début de combat) : les points d'agilité et de moral comptent pareil.
export const agilityScore = entity => getAttributePoints(entity, "agility") + getAttributePoints(entity, "morale");
