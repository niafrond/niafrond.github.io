import { describe, test, expect } from '@jest/globals';
import { HERO_ID, THREAT_HALF_LIFE_MS, addThreat, threatOf, rememberTarget, targetWeights, pickPartyTarget } from '../../enemyTargeting.js';

const team = (heroPct = 1, monk = 1, barb = 1) => [{ id: HERO_ID, hpPct: heroPct }, { id: 'monk', hpPct: monk }, { id: 'barbarian', hpPct: barb }];
/** Tire `n` cibles d'affilée (en mémorisant l'historique, comme le jeu) et compte chaque membre. */
function simulate(members, n, { threat = {}, now = 0, seed = 1 } = {}) {
    let s = seed;
    const rng = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const history = [], counts = {};
    for (let i = 0; i < n; i++) {
        const id = pickPartyTarget({ members, threat, history, now, rng });
        rememberTarget(history, id);
        counts[id] = (counts[id] || 0) + 1;
    }
    return { counts, history };
}

describe("ciblage des ennemis", () => {
    test("Hou Yi n'est plus visé systématiquement : la part de chacun reste proche à menace égale", () => {
        const { counts } = simulate(team(), 900);
        for (const id of [HERO_ID, 'monk', 'barbarian']) expect(counts[id]).toBeGreaterThan(200);
        expect(counts[HERO_ID]).toBeLessThan(450);
    });

    test("variété : jamais trois coups d'affilée sur la même cible tant que tous sont en forme", () => {
        const { history } = simulate(team(), 600);
        for (let i = 2; i < history.length; i++) expect(history[i] === history[i - 1] && history[i] === history[i - 2]).toBe(false);
    });

    test("menace en temps réel : qui agit souvent est davantage ciblé", () => {
        const threat = {};
        for (let i = 0; i < 6; i++) addThreat(threat, 'barbarian', 40, 0);
        const base = simulate(team(), 900).counts.barbarian;
        const { counts } = simulate(team(), 900, { threat, now: 0 });
        expect(counts.barbarian).toBeGreaterThan(base * 1.4);
        expect(counts.barbarian).toBeGreaterThan(counts.monk);
    });

    test("la menace s'estompe avec le temps (demi-vie)", () => {
        const threat = {};
        addThreat(threat, 'monk', 0, 0);
        expect(threatOf(threat, 'monk', 0)).toBeCloseTo(1, 5);
        expect(threatOf(threat, 'monk', THREAT_HALF_LIFE_MS)).toBeCloseTo(0.5, 5);
        expect(threatOf(threat, 'monk', THREAT_HALF_LIFE_MS * 5)).toBeLessThan(0.05);
        expect(threatOf({}, 'monk', 0)).toBe(0);
    });

    test("achèvement : un personnage presque à terre attire les coups, Hou Yi compris", () => {
        const w = targetWeights({ members: team(1, 0.15, 1) });
        expect(w.monk).toBeGreaterThan(1.8 * w.barbarian);
        const heroLow = targetWeights({ members: team(0.2, 1, 1) });
        expect(heroLow[HERO_ID]).toBeGreaterThan(2 * heroLow.monk);
    });

    test("un personnage presque à terre peut être achevé plusieurs fois de suite (pas de pénalité de variété)", () => {
        const w = targetWeights({ members: team(1, 0.1, 1), history: ['monk', 'monk', 'monk'] });
        expect(w.monk).toBeGreaterThan(w.barbarian);
        const healthy = targetWeights({ members: team(1, 0.9, 1), history: ['monk', 'monk', 'monk'] });
        expect(healthy.monk).toBeLessThan(0.2 * healthy.barbarian);
    });

    test("cas limites : équipe vide → Hou Yi, un seul membre → lui, jamais d'id inconnu", () => {
        expect(pickPartyTarget({ members: [] })).toBe(HERO_ID);
        expect(pickPartyTarget({ members: [{ id: 'monk', hpPct: 1 }] })).toBe('monk');
        const ids = new Set(team().map(m => m.id));
        const { counts } = simulate(team(), 200);
        Object.keys(counts).forEach(id => expect(ids.has(id)).toBe(true));
        expect(pickPartyTarget({ members: team(), rng: () => 0.999999 })).toBe('barbarian');
    });

    test("l'historique est borné", () => {
        const h = [];
        for (let i = 0; i < 20; i++) rememberTarget(h, 'monk');
        expect(h.length).toBeLessThanOrEqual(6);
    });
});
