// IA ennemie : difficulté choisie respectée, personnalités qui pondèrent sans contourner les règles, temps de réflexion.
import { describe, test, expect } from '@jest/globals';
import {
    AI_TIERS, TIER_ORDER, baseTierForLevel, resolveDifficulty, tierSettings, thinkingTimeFor,
    PERSONALITIES, PERSONALITY_KEYS, WEIGHT_MIN, WEIGHT_MAX, assignPersonality, personalityWeight, pickWeighted
} from '../../enemyAIProfiles.js';
import { DIFFICULTY_PREFERENCES } from '../../enemyAIProfiles.js';
import { getOption, setOption, OPTION_DEFAULTS } from '../../gameOptions.js';

// Générateur pseudo-aléatoire reproductible (mulberry32).
const seeded = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const spell = extra => ({ type: 'spell', data: { spell: { id: 's', ...extra }, reason: 'x', score: 50 }, probability: 0.25 });
const weapon = (reason = 'attaque normale') => ({ type: 'weapon', data: { reason, score: 40 }, probability: 0.25 });
const board = { type: 'board', data: { reason: 'gain', score: 30 }, probability: 0.5 };
const calm = { isEnemyLowHealth: false, isPlayerVulnerable: false };
const hurt = { isEnemyLowHealth: true, isPlayerVulnerable: false };

// Fréquence de chaque action sur N tirages pondérés (comme makeDecision, hors « coup stupide »).
function frequencies(personality, options, ctx, n = 6000, seed = 7) {
    const rng = seeded(seed);
    const counts = {};
    for (let i = 0; i < n; i++) {
        const weighted = options.map(o => ({ ...o, weight: o.probability * personalityWeight(personality, o, ctx) }));
        const key = pickWeighted(weighted, rng).type;
        counts[key] = (counts[key] || 0) + 1 / n;
    }
    return counts;
}

describe('difficulté choisie par le joueur', () => {
    test('options : défaut « auto », valeurs validées', () => {
        expect(OPTION_DEFAULTS.aiDifficulty).toBe('auto');
        expect(DIFFICULTY_PREFERENCES).toEqual(['auto', 'easy', 'normal', 'hard', 'expert']);
        expect(setOption('aiDifficulty', 'hard')).toBe(true);
        expect(getOption('aiDifficulty')).toBe('hard');
        expect(setOption('aiDifficulty', 'impossible')).toBe(false);
        expect(getOption('aiDifficulty')).toBe('hard');
        setOption('aiDifficulty', 'auto');
    });

    test.each(['easy', 'normal', 'hard', 'expert'])('palier fixe « %s » : respecté quels que soient les niveaux et les profils scénarisés', pref => {
        const cases = [
            { enemyLevel: 1, playerLevel: 10 }, { enemyLevel: 20, playerLevel: 1 }, { enemyLevel: 5, playerLevel: 5 },
            { enemyLevel: 9, playerLevel: 2, enemyProfile: { isOverleveledChoice: true } },
            { enemyLevel: 9, playerLevel: 2, enemyProfile: { isEasyChoice: true } },
        ];
        for (const c of cases) {
            expect(resolveDifficulty({ preference: pref, ...c })).toEqual({ tier: pref, special: null, adapted: false });
        }
        // et sans profil scénarisé : réglages standard du palier
        expect(tierSettings(pref)).toEqual(AI_TIERS[pref]);
    });

    test('auto : palier de base selon le niveau de l\'ennemi', () => {
        expect([1, 3, 4, 7, 8, 12, 13, 30].map(baseTierForLevel)).toEqual(['easy', 'easy', 'normal', 'normal', 'hard', 'hard', 'expert', 'expert']);
        for (const level of [1, 5, 9, 14]) {
            expect(resolveDifficulty({ preference: 'auto', enemyLevel: level, playerLevel: level }).tier).toBe(baseTierForLevel(level));
        }
    });

    test('auto : adaptation bornée à +1 cran, jamais au-dessus de « Difficile » sauf niveau d\'ennemi 13+, jamais en dessous du palier de base', () => {
        for (let enemyLevel = 1; enemyLevel <= 25; enemyLevel++) {
            for (let playerLevel = 1; playerLevel <= 25; playerLevel++) {
                const { tier, adapted } = resolveDifficulty({ preference: 'auto', enemyLevel, playerLevel });
                const base = TIER_ORDER.indexOf(baseTierForLevel(enemyLevel));
                const got = TIER_ORDER.indexOf(tier);
                expect(got).toBeGreaterThanOrEqual(base);              // l'ancienne version rétrogradait un Expert en Difficile
                expect(got).toBeLessThanOrEqual(base + 1);
                if (got > base) expect(got).toBeLessThanOrEqual(TIER_ORDER.indexOf('hard'));
                expect(adapted).toBe(got !== base);
                if (enemyLevel <= playerLevel) expect(got).toBe(base);   // jamais durci quand l'ennemi n'est pas plus haut
            }
        }
        expect(resolveDifficulty({ preference: 'auto', enemyLevel: 2, playerLevel: 1 })).toEqual({ tier: 'normal', special: null, adapted: true });
        expect(resolveDifficulty({ preference: 'auto', enemyLevel: 16, playerLevel: 1 }).tier).toBe('expert');
    });

    test('auto : profils scénarisés (affaibli, hors niveau) seulement en mode auto', () => {
        expect(resolveDifficulty({ enemyLevel: 5, playerLevel: 5, enemyProfile: { isEasyChoice: true } })).toMatchObject({ tier: 'easy', special: 'weakened' });
        expect(resolveDifficulty({ enemyLevel: 5, playerLevel: 5, enemyProfile: { isOverleveledChoice: true } })).toMatchObject({ tier: 'expert', special: 'overleveled' });
        expect(tierSettings('easy', 'weakened').stupidityChance).toBeGreaterThan(AI_TIERS.easy.stupidityChance);
        expect(tierSettings('expert', 'overleveled').name).toBe('Hors niveau');
    });

    test('la difficulté joue sur la qualité des décisions, pas sur des statistiques : aucun champ de stats dans les paliers', () => {
        for (const tier of Object.values(AI_TIERS)) {
            expect(Object.keys(tier).some(k => /attack|defense|damage|hp|crit|block|bonus/i.test(k))).toBe(false);
        }
        const stupidity = TIER_ORDER.map(t => AI_TIERS[t].stupidityChance);
        expect(stupidity).toEqual([...stupidity].sort((a, b) => b - a));       // plus dur = moins d'erreurs
        expect(AI_TIERS.easy.stupidityChance).toBeGreaterThan(0.5);             // le mode Facile reste accessible
    });

    test('temps de réflexion : mêmes bornes pour tous les paliers, plus court à haut niveau', () => {
        for (const tier of Object.values(AI_TIERS)) {
            expect(thinkingTimeFor(tier, 1, () => 0)).toBe(300);
            expect(thinkingTimeFor(tier, 1, () => 1)).toBe(500);
        }
        expect(thinkingTimeFor(AI_TIERS.normal, 10, () => 1)).toBeCloseTo(350);
        expect(thinkingTimeFor(AI_TIERS.normal, 15, () => 1)).toBeCloseTo(250);   // 15+ : le palier à -50 % n'était jamais atteint avant
    });
});

describe('personnalités', () => {
    test('cinq profils, chacun avec un nom, une description et modifyDecision', () => {
        expect(PERSONALITY_KEYS).toEqual(['aggressive', 'defensive', 'tactical', 'reckless', 'cunning']);
        for (const p of Object.values(PERSONALITIES)) {
            expect(p.name).toBeTruthy();
            expect(p.description).toBeTruthy();
            expect(typeof p.modifyDecision).toBe('function');
        }
    });

    test('attribution stable par espèce, et tous les profils sont attribués', () => {
        expect(assignPersonality('wolf')).toBe(assignPersonality('wolf'));
        const keys = Array.from({ length: 200 }, (_, i) => assignPersonality(`tpl-${i}`));
        expect(new Set(keys)).toEqual(new Set(PERSONALITY_KEYS));
        expect(PERSONALITY_KEYS).toContain(assignPersonality());
    });

    test('toute pondération reste dans [0,5 ; 1,8] et une personnalité inconnue est neutre', () => {
        const options = [spell({ dmg: 10 }), spell({ heal: 10 }), spell({ buff: 1 }), spell({ debuff: 1 }), weapon(), weapon('coup fatal'), board];
        for (const key of PERSONALITY_KEYS) {
            for (const ctx of [calm, hurt, { ...calm, bestType: 'weapon' }]) {
                for (const o of options) {
                    const w = personalityWeight(key, o, ctx);
                    expect(w).toBeGreaterThanOrEqual(WEIGHT_MIN);
                    expect(w).toBeLessThanOrEqual(WEIGHT_MAX);
                }
            }
        }
        expect(personalityWeight('inconnue', board, calm)).toBe(1);
        expect(personalityWeight(undefined, board, calm)).toBe(1);
    });

    test('un coup fatal n\'est jamais pénalisé par une personnalité', () => {
        for (const key of PERSONALITY_KEYS) {
            expect(personalityWeight(key, weapon('coup fatal'), hurt)).toBeGreaterThanOrEqual(1);
            expect(personalityWeight(key, { ...spell({ dmg: 99 }), data: { spell: { dmg: 99 }, reason: 'coup fatal' } }, hurt)).toBeGreaterThanOrEqual(1);
        }
    });

    test('agressif : arme plus souvent, plateau moins souvent que sans personnalité', () => {
        const options = [spell({ dmg: 10 }), weapon(), board];
        const base = frequencies(undefined, options, calm);
        const aggressive = frequencies('aggressive', options, calm);
        expect(aggressive.weapon).toBeGreaterThan(base.weapon + 0.05);
        expect(aggressive.board).toBeLessThan(base.board - 0.1);
    });

    test('défensif : se soigne bien plus quand ses PV sont bas, et soigne un peu plus que la normale sinon', () => {
        const options = [spell({ heal: 20 }), weapon(), board];
        const base = frequencies(undefined, options, hurt);
        const defensiveHurt = frequencies('defensive', options, hurt);
        const defensiveCalm = frequencies('defensive', options, calm);
        expect(defensiveHurt.spell).toBeGreaterThan(base.spell + 0.1);
        expect(defensiveHurt.spell).toBeGreaterThan(defensiveCalm.spell);
        expect(defensiveHurt.weapon).toBeLessThan(base.weapon);
    });

    test('téméraire : dépense arme et sorts offensifs, délaisse soin et plateau', () => {
        const attackOptions = [spell({ dmg: 10 }), weapon(), board];
        const base = frequencies(undefined, attackOptions, calm);
        const reckless = frequencies('reckless', attackOptions, calm);
        expect(reckless.spell + reckless.weapon).toBeGreaterThan(base.spell + base.weapon + 0.1);
        const healOptions = [spell({ heal: 20 }), weapon(), board];
        expect(frequencies('reckless', healOptions, hurt).spell).toBeLessThan(frequencies(undefined, healOptions, hurt).spell);
    });

    test('rusé : préfère les sorts d\'affaiblissement', () => {
        const options = [spell({ debuff: 1 }), weapon(), board];
        expect(frequencies('cunning', options, calm).spell).toBeGreaterThan(frequencies(undefined, options, calm).spell + 0.05);
        expect(frequencies('cunning', options, calm).weapon).toBeLessThan(frequencies(undefined, options, calm).weapon);
    });

    test('tactique : favorise l\'action la mieux évaluée, et le coup fatal en priorité', () => {
        const options = [spell({ dmg: 10 }), weapon('coup fatal'), board];
        const ctx = { ...calm, bestType: 'weapon' };
        expect(frequencies('tactical', options, ctx).weapon).toBeGreaterThan(frequencies(undefined, options, ctx).weapon + 0.05);
        // sans meilleure action désignée ni coup fatal : neutre
        const plain = [spell({ dmg: 10 }), weapon(), board];
        expect(frequencies('tactical', plain, calm)).toEqual(frequencies(undefined, plain, calm));
    });

    test('jamais déterministe : même avec le profil le plus tranché, chaque action valide garde au moins 10 % de chances', () => {
        const options = [spell({ dmg: 10 }), weapon(), board];
        for (const key of PERSONALITY_KEYS) {
            const f = frequencies(key, options, hurt);
            for (const type of ['spell', 'weapon', 'board']) expect(f[type]).toBeGreaterThan(0.1);
        }
    });

    test('ne contourne pas les règles : une action absente de la liste (non valide) ne peut jamais être choisie', () => {
        const noWeapon = [spell({ dmg: 10 }), board];            // arme indisponible (coût / cooldown) : jamais proposée à l'IA
        for (const key of PERSONALITY_KEYS) {
            expect(frequencies(key, noWeapon, calm).weapon).toBeUndefined();
        }
        // un seul choix valide : il est toujours pris
        expect(frequencies('aggressive', [board], calm).board).toBeCloseTo(1, 9);
    });

    test('pickWeighted : proportionnel aux poids', () => {
        const options = [{ type: 'a', weight: 1 }, { type: 'b', weight: 3 }];
        expect(pickWeighted(options, () => 0).type).toBe('a');
        expect(pickWeighted(options, () => 0.24).type).toBe('a');
        expect(pickWeighted(options, () => 0.26).type).toBe('b');
        expect(pickWeighted(options, () => 0.999999).type).toBe('b');
    });
});
