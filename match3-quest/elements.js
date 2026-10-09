// Éléments de mana et table des faiblesses. Module pur (aucun DOM), partagé par enemies.js, terrain.js et l'UI.
//
// Les 5 couleurs de mana portent chacune un élément :
//   rouge = Feu, bleu = Eau, vert = Terre, jaune = Air, violet = Arcane (5e élément, hors cycle classique).
//
// Faiblesses (un ennemi d'un élément est vulnérable à l'élément qui le « contre ») :
//   Feu   <- Eau     : l'eau éteint le feu.
//   Eau   <- Terre   : la terre absorbe / endigue l'eau.
//   Terre <- Air     : le vent érode et disperse la terre.
//   Air   <- Feu     : le feu consume l'oxygène et attire les courants d'air (le feu domine l'air).
//   Arcane<- Terre   : la matière brute ancre et dissipe la magie pure (l'ancienne faiblesse vert/violet est conservée).
// Les 4 éléments classiques forment un cycle fermé (Feu -> Eau -> Terre -> Air -> Feu) ; aucune couleur n'est sa propre faiblesse.

export const MANA_COLORS = ['red', 'blue', 'green', 'yellow', 'purple'];

export const ELEMENT_OF_COLOR = {
    red: 'fire',
    blue: 'water',
    green: 'earth',
    yellow: 'air',
    purple: 'arcane'
};

export const ELEMENT_LABELS = {
    fire: 'Feu',
    water: 'Eau',
    earth: 'Terre',
    air: 'Air',
    arcane: 'Arcane'
};

// couleur de l'ennemi -> couleur à laquelle il est faible
export const WEAKNESS_OF_COLOR = {
    red: 'blue',      // Feu   <- Eau
    blue: 'green',    // Eau   <- Terre
    green: 'yellow',  // Terre <- Air
    yellow: 'red',    // Air   <- Feu
    purple: 'green'   // Arcane<- Terre
};

const norm = color => (typeof color === 'string' ? color.toLowerCase() : color);

// Élément (identifiant : fire, water, earth, air, arcane) d'une couleur de mana, ou null.
export const elementOf = color => ELEMENT_OF_COLOR[norm(color)] || null;

// Libellé français de l'élément d'une couleur (« Feu », « Eau »...), ou null.
export const elementName = color => {
    const el = elementOf(color);
    return el ? ELEMENT_LABELS[el] : null;
};

// Couleur de mana contre laquelle l'ennemi de cette couleur est faible, ou null.
export const weaknessOf = color => WEAKNESS_OF_COLOR[norm(color)] || null;

// Ajuste un profil de résistances pour que la couleur faible ait la résistance la plus basse (strictement).
// Ne touche pas aux autres couleurs ; si la couleur faible est déjà la plus basse, rien ne change.
export function applyWeaknessToResistances(resistances, weakColor) {
    if (!weakColor || !(weakColor in resistances)) return resistances;
    const others = MANA_COLORS.filter(c => c !== weakColor).map(c => resistances[c]).filter(Number.isFinite);
    if (!others.length) return resistances;
    const minOthers = Math.min(...others);
    if (resistances[weakColor] >= minOthers) {
        resistances[weakColor] = Math.max(0, Math.round((minOthers - 0.01) * 1000) / 1000);
    }
    return resistances;
}
