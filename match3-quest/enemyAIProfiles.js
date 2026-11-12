// Profils de l'IA ennemie : module pur (sans DOM, sans import de game.js) donc testable seul.
//
// Quatre notions distinctes, ne pas les confondre :
//  1. niveau et statistiques de l'ennemi  -> enemies.js (PV, attaque, défense...), jamais touchés ici ;
//  2. style / personnalité                -> PERSONALITIES : tendances de choix (attaquer, soigner, affaiblir...) ;
//  3. qualité tactique des décisions      -> AI_TIERS : probabilités d'action, fréquence des coups hasardeux, repérage du coup fatal
//     (lethalAwareness), poids du score des actions (scoreSharpness) et profondeur d'analyse du plateau (boardLookahead) ;
//  4. difficulté choisie par le joueur    -> préférence 'auto' | 'easy' | 'normal' | 'hard' | 'expert' (Options).
// Ici, seule la qualité des décisions change. Le mode choisi règle aussi, ailleurs, la vitesse à laquelle l'ennemi peut vaincre le héros
// (dégâts calibrés : combatBalance.js, DIFFICULTY_WIN_RATIO_FACTOR) ; les PV et l'équipement de l'ennemi n'en dépendent pas.

import { thinkingTimeFactor } from "./enemyAIChoice.js";

export const TIER_ORDER = ['easy', 'normal', 'hard', 'expert'];
export const DIFFICULTY_PREFERENCES = ['auto', ...TIER_ORDER];

// Temps de réflexion (ms) identique pour les quatre paliers : le rythme du combat ne dépend pas de la difficulté.
export const AI_TIERS = {
    easy: {
        name: "Facile",
        thinkingTimeMin: 300, thinkingTimeMax: 500,
        spellUseProbability: 0.20, weaponUseProbability: 0.20, boardMoveProbability: 0.60,
        strategicThinking: false,       // choisit ses sorts au hasard
        healThreshold: 0.3,             // se soigne si PV < 30 %
        aggressiveThreshold: 0.7,       // joueur « vulnérable » si PV < 70 %
        stupidityChance: 0.80,          // part des tours joués au hasard
        randomBoardMove: true,
        lethalAwareness: 0,             // chance de repérer un coup fatal et de le jouer à coup sûr
        scoreSharpness: 0,              // exposant du score dans le tirage de l'action (0 = le score est ignoré)
        boardLookahead: 0,              // simulations par coup de plateau (0 = premier coup de la liste)
    },
    normal: {
        name: "Normal",
        thinkingTimeMin: 300, thinkingTimeMax: 500,
        spellUseProbability: 0.25, weaponUseProbability: 0.25, boardMoveProbability: 0.50,
        strategicThinking: true,
        healThreshold: 0.4, aggressiveThreshold: 0.6,
        stupidityChance: 0.55,
        randomBoardMove: true,
        lethalAwareness: 0.5, scoreSharpness: 0.5, boardLookahead: 0,
    },
    hard: {
        name: "Difficile",
        thinkingTimeMin: 300, thinkingTimeMax: 500,
        spellUseProbability: 0.30, weaponUseProbability: 0.25, boardMoveProbability: 0.45,
        strategicThinking: true,
        healThreshold: 0.5, aggressiveThreshold: 0.5,
        stupidityChance: 0.35,
        randomBoardMove: false,
        manaFocus: true,                // choisit les combinaisons qui donnent le qì dont il manque
        lethalAwareness: 0.85, scoreSharpness: 1, boardLookahead: 8,
    },
    expert: {
        name: "Expert",
        thinkingTimeMin: 300, thinkingTimeMax: 500,
        spellUseProbability: 0.35, weaponUseProbability: 0.25, boardMoveProbability: 0.40,
        strategicThinking: true,
        healThreshold: 0.6, aggressiveThreshold: 0.4,
        stupidityChance: 0.20,
        randomBoardMove: false,
        manaFocus: true,
        refillMana: true,               // aucun sort lançable : le plateau pour remplir son qì passe devant (enemyAI.js)
        lethalAwareness: 1, scoreSharpness: 1.5, boardLookahead: 16,
    },
};

// Profils scénarisés (ennemi « affaibli », ennemi/boss « hors niveau ») : uniquement en mode Auto.
export const SPECIAL_TIERS = {
    weakened: {
        base: 'easy', name: "Affaibli",
        spellUseProbability: 0.08, weaponUseProbability: 0.07, boardMoveProbability: 0.85,
        strategicThinking: false, stupidityChance: 0.97, randomBoardMove: true,
        lethalAwareness: 0, scoreSharpness: 0, boardLookahead: 0,
        thinkingTimeMin: 450, thinkingTimeMax: 850,
    },
    overleveled: {
        base: 'expert', name: "Hors niveau",
        spellUseProbability: 0.45, weaponUseProbability: 0.35, boardMoveProbability: 0.20,
        strategicThinking: true, stupidityChance: 0.02, randomBoardMove: false, manaFocus: true,
        lethalAwareness: 1, scoreSharpness: 2, boardLookahead: 24,
        thinkingTimeMin: 180, thinkingTimeMax: 320,
    },
};

/** Palier de base d'après le niveau de l'ennemi. */
export function baseTierForLevel(enemyLevel) {
    if (enemyLevel <= 3) return 'easy';
    if (enemyLevel <= 7) return 'normal';
    if (enemyLevel <= 12) return 'hard';
    return 'expert';
}

/**
 * Palier de l'IA pour un combat. Renvoie { tier, special, adapted }.
 *  - préférence fixe (easy/normal/hard/expert) : respectée à la lettre, quels que soient les niveaux et le profil de l'ennemi ;
 *  - 'auto' (défaut) : palier de base selon le niveau de l'ennemi, +1 cran s'il dépasse le joueur, ce cran ne pouvant pas
 *    faire passer au-dessus de « Difficile » (seul un ennemi de niveau 13+ est Expert), puis profils scénarisés.
 */
export function resolveDifficulty({ preference = 'auto', enemyLevel = 1, playerLevel = 1, enemyProfile = null } = {}) {
    if (TIER_ORDER.includes(preference)) return { tier: preference, special: null, adapted: false };
    if (enemyProfile?.isEasyChoice) return { tier: 'easy', special: 'weakened', adapted: false };
    if (enemyProfile?.isOverleveledChoice) return { tier: 'expert', special: 'overleveled', adapted: false };
    const base = baseTierForLevel(enemyLevel);
    const bump = enemyLevel > playerLevel ? 1 : 0;
    const bumped = TIER_ORDER[Math.min(TIER_ORDER.indexOf(base) + bump, Math.max(TIER_ORDER.indexOf(base), TIER_ORDER.indexOf('hard')))];
    return { tier: bumped, special: null, adapted: bumped !== base };
}

/** Réglages complets (palier + éventuel profil scénarisé). */
export function tierSettings(tier, special = null) {
    const { base, ...override } = special && SPECIAL_TIERS[special] ? SPECIAL_TIERS[special] : {};
    return { ...AI_TIERS[tier], ...override };
}

/** Temps de réflexion : plus court pour les ennemis de haut niveau (15+ : -50 %, 10+ : -30 %). */
export function thinkingTimeFor(settings, enemyLevel, rng = Math.random) {
    const time = settings.thinkingTimeMin + rng() * (settings.thinkingTimeMax - settings.thinkingTimeMin);
    return time * thinkingTimeFactor(enemyLevel);
}

// ========================================
// PERSONNALITÉS
// ========================================
// Une personnalité ne fait que PONDÉRER les actions déjà valides (coûts, cooldowns et ressources sont vérifiés en amont,
// avant que l'action n'entre dans la liste) : modifyDecision(option, ctx) renvoie un multiplicateur de poids.
// Le produit est borné à [WEIGHT_MIN, WEIGHT_MAX] : aucune action valide n'est jamais exclue ni imposée, et un tour reste
// imprévisible. Un « coup fatal » n'est jamais pénalisé par une personnalité.
export const WEIGHT_MIN = 0.5;
export const WEIGHT_MAX = 1.8;

const spellOf = option => (option.type === 'spell' ? option.data?.spell : null);

export const PERSONALITIES = {
    aggressive: {
        name: "Agressif",
        description: "Préfère frapper : arme et sorts de dégâts, rarement le plateau.",
        modifyDecision: (option) => {
            const spell = spellOf(option);
            if (option.type === 'weapon') return 1.4;
            if (option.type === 'board') return 0.6;
            if (spell?.dmg) return 1.3;
            if (spell?.heal) return 0.8;
            return 1;
        },
    },
    defensive: {
        name: "Défensif",
        description: "Se soigne et se renforce plus volontiers, surtout quand ses PV baissent.",
        modifyDecision: (option, ctx) => {
            const spell = spellOf(option);
            if (spell?.heal) return ctx.isEnemyLowHealth ? 1.8 : 1.2;
            if (spell?.buff) return 1.3;
            if (option.type === 'weapon' && ctx.isEnemyLowHealth) return 0.8;
            if (option.type === 'board') return 1.15;
            return 1;
        },
    },
    tactical: {
        name: "Tactique",
        description: "Suit l'évaluation de la situation : favorise le meilleur coup, surtout un coup fatal.",
        modifyDecision: (option, ctx) => {
            if (option.data?.reason === 'coup fatal') return 1.5;
            return ctx.bestType && option.type === ctx.bestType ? 1.3 : 1;
        },
    },
    reckless: {
        name: "Téméraire",
        description: "Dépense ses ressources sans compter : arme et sorts offensifs, soin et plateau négligés.",
        modifyDecision: (option) => {
            const spell = spellOf(option);
            if (option.type === 'weapon') return 1.3;
            if (option.type === 'board') return 0.6;
            if (spell?.heal) return 0.7;
            if (spell) return 1.3;
            return 1;
        },
    },
    cunning: {
        name: "Rusé",
        description: "Affaiblit et manœuvre : sorts d'affaiblissement et de renfort, arme en second.",
        modifyDecision: (option) => {
            const spell = spellOf(option);
            if (spell?.debuff) return 1.5;
            if (spell?.buff) return 1.2;
            if (option.type === 'weapon') return 0.9;
            return 1;
        },
    },
};

export const PERSONALITY_KEYS = Object.keys(PERSONALITIES);

function hashString(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
}

/**
 * Personnalité stable d'une espèce d'ennemi (même clé -> même style à chaque rencontre), pour qu'un joueur puisse la
 * reconnaître et s'y adapter. `key` : identifiant de gabarit (ou nom).
 */
export function assignPersonality(key = '') {
    return PERSONALITY_KEYS[hashString(String(key)) % PERSONALITY_KEYS.length];
}

/** Multiplicateur de poids d'une action pour une personnalité (1 si inconnue), borné et sans pénalité sur un coup fatal. */
export function personalityWeight(personality, option, ctx = {}) {
    const p = PERSONALITIES[personality];
    if (!p) return 1;
    let factor = p.modifyDecision(option, ctx);
    if (option.data?.reason === 'coup fatal' && factor < 1) factor = 1;
    return Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, factor));
}
