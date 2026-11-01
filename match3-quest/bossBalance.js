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

    const pool = offensive.filter(isStrong).sort((a, b) => b.dmg - a.dmg).slice(0, BOSS_STRONG_POOL)
        .filter(sp => !result.some(r => r.id === sp.id));
    while (result.filter(isStrong).length < need && pool.length) {
        const spell = pool.splice(Math.floor(rng() * pool.length), 1)[0];
        let idx = -1;
        for (let i = result.length - 1; i >= 0 && idx < 0; i--) if (isOffensiveSpell(result[i]) && !isStrong(result[i])) idx = i;
        for (let i = result.length - 1; i >= 0 && idx < 0; i--) if (!isOffensiveSpell(result[i])) idx = i;
        if (idx < 0 && result.length < slots) idx = result.length;
        if (idx < 0) idx = result.length - 1;
        result[idx] = spell;
    }
    return result;
}

/** Qì gagné en plus à chaque match de couleur d'un boss (le héros gagne, lui, un bonus par point d'attribut). Niveau 56 : +14. */
export const BOSS_MANA_GAIN_PER_LEVEL = 0.25;
export const bossManaGainBonus = level => Math.max(0, Math.round((Math.max(1, Math.floor(level || 1))) * BOSS_MANA_GAIN_PER_LEVEL));

/** Qì de départ d'un boss : la moitié du coût de ses sorts offensifs, couleur par couleur (jamais au-delà de la réserve `capOf(couleur)`). */
export const BOSS_START_MANA_RATIO = 0.5;
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
