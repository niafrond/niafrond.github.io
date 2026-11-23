// Groupes d'ennemis : jusqu'à MAX_ENEMIES ennemis dans un même combat. Module pur (aucun DOM, aucun accès à game.js).
//
// Un combat commence parfois avec 2 ou 3 ennemis (renforts plus faibles que le meneur), et certains ennemis ont le pouvoir
// « Invocation » : à la fin de leur tour, ils appellent un ennemi (précis ou au hasard) tant qu'il reste de la place.
// Le moteur (foes.js) garde `enemy` = l'ennemi CIBLÉ ; les autres agissent chacun à leur tour (foeTurns.js).

export const MAX_ENEMIES = 3;

/** Probabilité d'un groupe de 2, puis de 3 ennemis (le reste : un seul ennemi). */
export const GROUP_ODDS = { two: 0.22, three: 0.06 };
/** Niveau minimal du meneur pour rencontrer un groupe (les tout premiers combats restent en tête à tête). */
export const GROUP_MIN_LEVEL = 3;
/** Un renfort est plus fragile et frappe moins fort que le meneur : un groupe ne multiplie pas la menace. */
export const REINFORCEMENT_HP_MULT = 0.6;
export const SUPPORT_DAMAGE_MULT = 0.6;
/** Récompense (XP, zhu) d'un renfort vaincu avant la fin du combat : part de celle d'un ennemi seul. */
export const REINFORCEMENT_REWARD_SHARE = 0.7;
/** Un invocateur n'appelle jamais plus de renforts que ce nombre par combat, et jamais deux tours de suite. */
export const DEFAULT_SUMMON = { chance: 0.3, maxCalls: 2 };

/** Un combat peut-il compter plusieurs ennemis ? (pas de boss, de tutoriel, de duel, d'arène ni d'entraînement) */
export function groupAllowed(e) {
    if (!e) return false;
    return !(e.isBoss || e.isTutorialEnemy || e.duel || e.arena || e.training);
}

/** Taille d'une meute `{ min, max }` (au moins 2, au plus MAX_ENEMIES). */
export function packSize(pack, rng = Math.random) {
    const min = Math.max(2, Math.min(MAX_ENEMIES, Math.floor(Number(pack?.min) || 2)));
    const max = Math.max(min, Math.min(MAX_ENEMIES, Math.floor(Number(pack?.max) || min)));
    return min + Math.min(max - min, Math.floor(rng() * (max - min + 1)));
}

/** Taille du groupe de départ (1 à MAX_ENEMIES) selon le niveau du meneur. `rng` : () => [0, 1[. */
export function rollGroupSize(leader, rng = Math.random) {
    if (groupAllowed(leader) && leader.pack) return packSize(leader.pack, rng);   // meute : toujours plusieurs ennemis, quel que soit le niveau
    if (!groupAllowed(leader) || (leader.level || 1) < GROUP_MIN_LEVEL) return 1;
    const r = rng();
    if (r < GROUP_ODDS.three) return 3;
    if (r < GROUP_ODDS.three + GROUP_ODDS.two) return 2;
    return 1;
}

/** Part de chacun dans un coup de crânes de zone : le total est divisé entre les cibles (arrondi au-dessus, au moins 1 si le coup touche). */
export const skullShare = (total, targets) => (total > 0 && targets > 1 ? Math.max(1, Math.ceil(total / targets)) : total);

export const isAlive = e => Boolean(e) && e.hp > 0;
export const livingFoes = foes => (Array.isArray(foes) ? foes : []).filter(isAlive);

/** Reste-t-il de la place dans le groupe ? Les ennemis vaincus libèrent leur place : seuls les vivants comptent. */
export const hasRoom = foes => livingFoes(foes).length < MAX_ENEMIES;

/** Réglage d'invocation d'un ennemi (`summon` du gabarit) : null s'il n'a pas le pouvoir. */
export function summonSettings(e) {
    if (!e?.summon) return null;
    const s = typeof e.summon === 'object' ? e.summon : {};
    return {
        templateId: typeof s.templateId === 'string' ? s.templateId : null,   // null : un ennemi au hasard
        chance: Math.max(0, Math.min(1, Number.isFinite(s.chance) ? s.chance : DEFAULT_SUMMON.chance)),
        maxCalls: Math.max(1, Math.floor(Number.isFinite(s.maxCalls) ? s.maxCalls : DEFAULT_SUMMON.maxCalls))
    };
}

/**
 * Cet invocateur appelle-t-il un renfort à ce tour ? Il faut : le pouvoir, être debout et libre d'agir, de la place, des appels restants
 * (`e.summonsMade`), ne pas avoir invoqué au tour précédent (`e.summonedLastTurn`), puis réussir le tirage.
 */
export function shouldSummon(e, foes, rng = Math.random) {
    const s = summonSettings(e);
    if (!s || !isAlive(e) || e.isBoss || !hasRoom(foes)) return false;   // un boss reste seul à invoquer rien : ses combats sont en tête à tête
    if ((e.summonsMade || 0) >= s.maxCalls || e.summonedLastTurn) return false;
    if ((e.statusEffects?.stunned || 0) > 0 || (e.statusEffects?.asleep || 0) > 0) return false;
    return rng() < s.chance;
}

/** Niveau d'un renfort ou d'une créature invoquée : un cran sous celui qui l'appelle (jamais sous 1). */
export const reinforcementLevel = leaderLevel => Math.max(1, Math.floor(leaderLevel || 1) - 1);

/** Gabarits invocables : ni boss, ni copies de boss (`copyOf`), ni gabarit qui l'interdit (`summonable: false`). */
export const summonableTemplates = catalog => (Array.isArray(catalog) ? catalog : []).filter(t => t && !t.copyOf && t.summonable !== false && !/^(sun_|fengmeng|maitre|maitresse|dame_|grand_maitre|seigneur_)/.test(t.id));

/** Gabarit à invoquer : celui que l'invocateur désigne, sinon un gabarit au hasard (hors le sien pour varier). */
export function pickSummonTemplate(summoner, catalog, rng = Math.random) {
    const pool = summonableTemplates(catalog);
    if (!pool.length) return null;
    const wanted = summonSettings(summoner)?.templateId;
    const precise = wanted && (catalog || []).find(t => t.id === wanted);
    if (precise) return precise;
    const others = pool.filter(t => t.id !== summoner?.templateId);
    const list = others.length ? others : pool;
    return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

/** Prochain ennemi vivant après l'indice `from` (circulaire), ou null s'il n'en reste aucun. */
export function nextLivingIndex(foes, from = -1) {
    const list = Array.isArray(foes) ? foes : [];
    for (let step = 1; step <= list.length; step++) {
        const i = (from + step + list.length) % list.length;
        if (isAlive(list[i])) return i;
    }
    return -1;
}

/** Part de récompense d'un ennemi vaincu : l'ennemi de la fin de combat touche tout (le butin complet), les autres une part. */
export const rewardShare = isLast => (isLast ? 1 : REINFORCEMENT_REWARD_SHARE);
