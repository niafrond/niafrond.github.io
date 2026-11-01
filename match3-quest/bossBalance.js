// bossBalance.js — réglages d'équilibrage propres aux boss (module pur, sans DOM). Voir SPECS.md (2026-10-31, équilibrage des boss).
//
// Pourquoi : à niveau égal, la menace d'un boss variait de ×30 selon le tirage de ses sorts et de son qì (il lançait un sort une fois sur dix),
// et ses PV de ×3 selon son gabarit. Les boss ont donc : des PV bornés, un grimoire garanti (≥ 2 sorts offensifs parmi les plus forts),
// du qì de départ, un gain de qì majoré et une IA qui préfère lancer un sort abordable.

export const BOSS_HP_MULT_MIN = 1;
export const BOSS_HP_MULT_MAX = 1.5;
/** Coefficient de PV du gabarit, borné pour un boss (×1 à ×1,5) : le héros idéal doit pouvoir le vider en 25-35 tours. */
export const bossHpMult = mult => Math.min(BOSS_HP_MULT_MAX, Math.max(BOSS_HP_MULT_MIN, Number(mult) || 1));

/** Un sort offensif direct. */
export const isOffensiveSpell = spell => Boolean(spell) && (Number(spell.dmg) || 0) > 0;

export const BOSS_OFFENSIVE_MIN = 2;          // sorts offensifs « forts » garantis (1 seul quand le boss n'a que 2 emplacements)
export const BOSS_STRONG_RATIO = 0.6;         // « fort » : au moins 60 % des dégâts du meilleur sort offensif du niveau
const BOSS_STRONG_POOL = 4;                   // on tire parmi les 4 sorts offensifs les plus puissants

/**
 * Complète le grimoire d'un boss : au moins BOSS_OFFENSIVE_MIN sorts offensifs forts (parmi les plus puissants que son niveau permet).
 * `selected` : grimoire déjà tiré ; `candidates` : sorts utilisables par un ennemi à ce niveau ; `slots` : emplacements.
 * Remplace d'abord les sorts offensifs faibles, puis les sorts de soutien en fin de liste. Renvoie un nouveau tableau.
 */
export function ensureBossOffense(selected, candidates, slots, rng = Math.random) {
    const result = [...selected];
    const offensive = candidates.filter(isOffensiveSpell);
    if (!offensive.length) return result;
    const best = Math.max(...offensive.map(sp => sp.dmg));
    const isStrong = sp => isOffensiveSpell(sp) && sp.dmg >= best * BOSS_STRONG_RATIO;
    const need = Math.min(slots >= 3 ? BOSS_OFFENSIVE_MIN : 1, offensive.filter(isStrong).length);

    const strongPool = offensive.filter(isStrong).sort((a, b) => b.dmg - a.dmg).slice(0, BOSS_STRONG_POOL);
    const restPool = offensive.filter(sp => !strongPool.includes(sp)).sort((a, b) => b.dmg - a.dmg);
    const total = Math.min(BOSS_OFFENSIVE_MIN, offensive.length);   // au moins 2 sorts offensifs (tous éléments confondus du pool), dont `need` forts
    const notYet = list => list.filter(sp => !result.some(r => r.id === sp.id));
    while (result.filter(isStrong).length < need || result.filter(isOffensiveSpell).length < total) {
        const strongMissing = result.filter(isStrong).length < need;
        const from = notYet(strongMissing || !notYet(restPool).length ? strongPool : restPool);
        if (!from.length) break;
        const spell = strongMissing ? from[Math.floor(rng() * from.length)] : from[0];
        let idx = -1;
        for (let i = result.length - 1; i >= 0 && idx < 0; i--) if (isOffensiveSpell(result[i]) && !isStrong(result[i]) && strongMissing) idx = i;
        for (let i = result.length - 1; i >= 0 && idx < 0; i--) if (!isOffensiveSpell(result[i])) idx = i;
        if (idx < 0 && result.length < slots) idx = result.length;
        if (idx < 0) break;
        result[idx] = spell;
    }
    return result;
}

/** Qì gagné en plus à chaque match de couleur d'un boss (le héros gagne, lui, un bonus par point d'attribut). Niveau 56 : +22. */
export const BOSS_MANA_GAIN_PER_LEVEL = 0.4;
export const bossManaGainBonus = level => Math.max(0, Math.round((Math.max(1, Math.floor(level || 1))) * BOSS_MANA_GAIN_PER_LEVEL));

/** Qì de départ d'un boss : la moitié du coût de ses sorts offensifs, couleur par couleur (jamais au-delà de la réserve `capOf(couleur)`). */
export const BOSS_START_MANA_RATIO = 0.75;
export function bossStartingMana(spells, capOf = () => Infinity) {
    const mana = {};
    for (const spell of spells || []) {
        if (!isOffensiveSpell(spell)) continue;
        const cost = typeof spell.cost === 'number' ? { [spell.color]: spell.cost } : (spell.cost || {});
        for (const [color, amount] of Object.entries(cost)) {
            const want = Math.min(Math.floor(amount * BOSS_START_MANA_RATIO), capOf(color));
            if (want > (mana[color] || 0)) mana[color] = want;
        }
    }
    return mana;
}

/** Probabilité qu'un boss lance un sort offensif abordable plutôt que de jouer le plateau ou l'arme (hors coup « stupide »). */
export const BOSS_CAST_PRIORITY = 0.85;
/** Bonus de score d'un sort offensif dans le choix de sort d'un boss : il lance ses attaques élémentaires avant ses envoûtements (soin critique à 100 : prioritaire). */
export const BOSS_OFFENSIVE_SCORE_BONUS = 60;

// ── Identité élémentaire d'un boss ──────────────────────────────────────────
// Logique « contre-équipement » : un boss oblige le joueur à varier ses sorts et son stuff.
//  - son élément (couleur préférée) : ses sorts offensifs sont de cette couleur → une parure de cette couleur (stuff.js) les réduit ;
//  - ses résistances : fortes pour toutes les couleurs sauf sa faiblesse → il faut des sorts de la couleur faible ;
//  - son venin (isVenomous) → un antidote.
// Niveau minimum : les contre-mesures n'existent qu'à partir d'un certain niveau (parures de palier 1 au niveau 20, sorts de chaque couleur
// dès le niveau 15), donc l'exigence monte progressivement : aucune avant BOSS_COUNTER_FROM_LEVEL, pleine à BOSS_COUNTER_FULL_LEVEL.
export const BOSS_COUNTER_FROM_LEVEL = 15;
export const BOSS_COUNTER_FULL_LEVEL = 40;
/** Force de l'exigence de contre-équipement d'un boss, de 0 (niveau ≤ 15) à 1 (niveau ≥ 40). */
export const bossCounterStrength = level => Math.min(1, Math.max(0, ((Number(level) || 0) - BOSS_COUNTER_FROM_LEVEL) / (BOSS_COUNTER_FULL_LEVEL - BOSS_COUNTER_FROM_LEVEL)));

export const BOSS_OWN_RESIST = 0.6;        // résistance de la couleur du boss (à pleine force)
export const BOSS_OTHER_RESIST = 0.4;      // résistance minimale des autres couleurs (à pleine force)
export const BOSS_WEAK_RESIST_MAX = 0.05;  // résistance maximale de sa couleur faible

/** Profil de résistances d'un boss : planchers proportionnels à la force d'exigence du niveau, faiblesse laissée presque nue (dès qu'il y a une exigence). */
export function bossResistances(resistances, ownColor, weakColor, level = BOSS_COUNTER_FULL_LEVEL) {
    const s = bossCounterStrength(level);
    if (s <= 0) return { ...resistances };
    const out = { ...resistances };
    for (const color of Object.keys(out)) {
        if (color === weakColor) out[color] = Math.min(out[color], BOSS_WEAK_RESIST_MAX);
        else if (color === ownColor) out[color] = Math.max(out[color], BOSS_OWN_RESIST * s);
        else out[color] = Math.max(out[color], BOSS_OTHER_RESIST * s);
    }
    return out;
}

const colorsOf = spell => (Array.isArray(spell?.colors) && spell.colors.length ? spell.colors : [spell?.color]).filter(Boolean);

/** Sorts de l'élément du boss s'il y en a assez d'offensifs (au moins 2), sinon tous les candidats : un boss ne se retrouve jamais sans sort offensif. */
export function elementalCandidates(candidates, ownColor) {
    const own = candidates.filter(sp => colorsOf(sp).includes(ownColor) || (sp.cost && typeof sp.cost === 'object' && ownColor in sp.cost));
    return own.filter(isOffensiveSpell).length >= BOSS_OFFENSIVE_MIN ? own : candidates;
}

// Sorts offensifs réservés aux boss (hors spells.json) : la Terre (vert) n'a qu'un seul sort offensif d'ennemi de niveau ≤ 15, alors que
// chaque élément de boss doit disposer d'au moins deux attaques (les héros, eux, ont leurs sorts de classe et multi-qì). Mêmes paliers que Feu/Eau.
export const BOSS_EXTRA_SPELLS = [
    { id: 'bossEarthRoots', name: 'Racines du Mont Tai', color: 'green', type: 'damage', cost: 22, dmg: 55, minLevel: 5, description: 'Des racines de pierre surgissent du sol et infligent 55 dégâts' },
    { id: 'bossWorldQuake', name: 'Séisme du Pilier du Monde', color: 'green', type: 'damage', cost: 38, dmg: 85, minLevel: 10, description: 'Un séisme ébranle le sol et inflige 85 dégâts' },
    { id: 'bossEarthWrath', name: 'Colère de la Terre Mère', color: 'green', type: 'damage', cost: 50, dmg: 120, minLevel: 15, description: 'La terre elle-même se dresse et inflige 120 dégâts' }
];

/** Qì gagné en plus par match de couleur (champ `manaGainBonus` posé sur les boss, 0 pour tout autre combattant). */
export const manaGainBonusOf = entity => Math.max(0, Math.floor(entity?.manaGainBonus || 0));

/** Bonus de score d'un sort offensif dans le choix de sort de l'IA : réservé aux boss. */
export const bossOffensiveScoreBonus = entity => (entity?.isBoss ? BOSS_OFFENSIVE_SCORE_BONUS : 0);

/** Un boss qui peut payer un sort offensif le lance, avec la probabilité BOSS_CAST_PRIORITY (le choix normal de l'IA s'applique sinon). */
export const shouldBossCast = (entity, spellEval, rng = Math.random) =>
    Boolean(entity?.isBoss) && Boolean(spellEval) && isOffensiveSpell(spellEval.spell) && rng() < BOSS_CAST_PRIORITY;
