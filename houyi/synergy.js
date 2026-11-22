// Synergies de combat (module pur, sans DOM ; appliquées par game.js aux dégâts du héros et de ses compagnons).
//  - Grimoire : un sort de dégâts gagne +5 % quand un AUTRE sort du grimoire de la même classe partage une de ses couleurs de qì.
//  - Alternance : un coup (arme ou sort de dégâts) porté par une classe différente de celle du coup précédent gagne +5 %.
// Le total est plafonné à +10 % : un bonus de choix et de rythme, jamais un build strictement dominant. Valeurs validées par l'agent
// Équilibrage (SPECS.md, 2026-11-22 ; garde-fou dans balance.test.js).
export const GRIMOIRE_SYNERGY_PCT = 5;
export const CLASS_ALTERNATION_PCT = 5;
export const SYNERGY_MAX_PCT = 10;

const colorsOf = spell => {
    if (!spell) return [];
    if (spell.cost && typeof spell.cost === 'object') return Object.keys(spell.cost);
    if (Array.isArray(spell.colors) && spell.colors.length) return spell.colors;
    return spell.color ? [spell.color] : [];
};

/** +5 % si un autre sort du grimoire partage une couleur avec `spell`, sinon 0. */
export function grimoireSynergyPct(loadout, spell) {
    const mine = colorsOf(spell);
    if (!mine.length) return 0;
    const shared = (loadout || []).some(other => other && other.id !== spell.id && colorsOf(other).some(c => mine.includes(c)));
    return shared ? GRIMOIRE_SYNERGY_PCT : 0;
}

/** +5 % si la classe qui frappe n'est pas celle du coup précédent (premier coup du combat : rien). */
export const alternationPct = (previousClass, currentClass) => (previousClass && currentClass && previousClass !== currentClass ? CLASS_ALTERNATION_PCT : 0);

/** Dégâts après bonus de synergie (total plafonné à SYNERGY_MAX_PCT), arrondis à l'entier inférieur, au moins 1 si la base l'était. */
export function applySynergy(damage, ...pcts) {
    const pct = Math.min(SYNERGY_MAX_PCT, pcts.reduce((sum, p) => sum + Math.max(0, p || 0), 0));
    if (!(damage > 0) || pct <= 0) return damage;
    return Math.max(1, Math.floor(damage * (1 + pct / 100)));
}
