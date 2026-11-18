// Ciblage des sorts et des armes : dégâts CIBLÉS (l'ennemi choisi) ou DE ZONE (tous les ennemis vivants). Module pur (aucun DOM).
//
// Source unique : le champ `target` ('single' | 'area') d'un sort ou d'une arme l'emporte ; à défaut, une table d'identifiants
// (AREA_SPELL_IDS), puis le type de l'arme (éventail), puis une lecture du nom / de la description du sort.
// Tout le reste est ciblé. Contre un seul ennemi, les deux revient au même.

export const TARGET = { SINGLE: 'single', AREA: 'area' };

/** Sorts de zone connus : tempêtes, vagues, pluies, purges du plateau… (les identifiants de spells.json). */
export const AREA_SPELL_IDS = new Set([
    'meteor', 'inferno', 'frostNova', 'blizzard', 'iceAge', 'lightningStorm', 'stormOfGods', 'vaporBurst', 'frostLightning',
    'thunderDukeWrath', 'heavenlyRiverFlood', 'nineSunsFall', 'threeDragons', 'starRain', 'dragonCross',
    'crimsonPurge', 'tidalPurge', 'jadePurge', 'stormPurge', 'shadowPurge', 'burningTide', 'seasonsPurge'
]);

/** Sorts qui restent ciblés même si leur texte évoque une zone. */
export const SINGLE_SPELL_IDS = new Set(['fiveHarmony', 'twinDragonsStrike', 'kunlunMountainFall', 'thunderPrison']);

const AREA_WORDS = /temp[êe]te|pluie|orage|vague|crue|purge|d[ée]ferl|balaie|balayage|rafale|toutes? les|tous les|tout sur son passage|zone/i;

/** Ciblage d'un sort : 'area' ou 'single'. */
export function spellTarget(spell) {
    if (!spell) return TARGET.SINGLE;
    if (spell.target === TARGET.AREA || spell.target === TARGET.SINGLE) return spell.target;
    if (SINGLE_SPELL_IDS.has(spell.id)) return TARGET.SINGLE;
    if (AREA_SPELL_IDS.has(spell.id)) return TARGET.AREA;
    const hurts = Boolean(spell.dmg || spell.dmgPerTile || spell.baseDmg || spell.dmgPerGem || spell.shots);
    if (hurts && AREA_WORDS.test(`${spell.name || ''} ${spell.description || ''}`)) return TARGET.AREA;
    return TARGET.SINGLE;
}

/** Armes de zone : un éventail balaie tout le groupe ; certains arcs tirent une volée (champ `target`). */
const AREA_WEAPON_TYPES = new Set(['fan']);
export function weaponTarget(weapon) {
    if (!weapon) return TARGET.SINGLE;
    if (weapon.target === TARGET.AREA || weapon.target === TARGET.SINGLE) return weapon.target;
    return AREA_WEAPON_TYPES.has(weapon.type) ? TARGET.AREA : TARGET.SINGLE;
}

export const isAreaSpell = spell => spellTarget(spell) === TARGET.AREA;
export const isAreaWeapon = weapon => weaponTarget(weapon) === TARGET.AREA;

/** Mention affichée sur une carte : « Zone » ou « Ciblé » (vide pour un sort sans dégâts). */
export function targetLabel(kind) {
    return kind === TARGET.AREA ? 'Zone : touche tous les ennemis' : 'Ciblé : frappe l\'ennemi choisi';
}

/** Part des dégâts subie par les ennemis NON ciblés d'un sort de zone (la cible visée prend le plein). */
export const AREA_SPLASH_SHARE = 1;

/** Ce sort frappe-t-il un ennemi ? (dégâts, poison, étourdissement, ponction de qì…) Les soutiens et soins n'ont pas à choisir de cible. */
export const spellNeedsTarget = spell => Boolean(spell && (spell.dmg || spell.dmgPerTile || spell.baseDmg || spell.dmgPerGem || spell.dmgPerRage || spell.shots
    || spell.poisonDmg || spell.stunTurns || spell.weakenAmount || spell.manaDrain || spell.manaSteal || spell.cpSteal || spell.cursePct || spell.alteration));
