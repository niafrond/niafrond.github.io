import { describe, test, expect, beforeAll } from '@jest/globals';
import {
    approachOf, buildPrep, observationTarget, weaknessDamage, applyBoardBoost, spotAt, faceFromStep,
    createBiomeState, advanceBiome, resolveBiomeMatch, burnDamage, driftRow, isBlockedCell, BIOME_RULES, ruleForBiome, OBSERVE_MS
} from '../../terrain.js';

describe('approche', () => {
    test('face, dos et côté selon le regard', () => {
        const e = { x: 5, y: 5 };
        expect(approachOf({ dx: 0, dy: 1 }, e, { x: 5, y: 7 })).toBe('front');
        expect(approachOf({ dx: 0, dy: 1 }, e, { x: 5, y: 3 })).toBe('behind');
        expect(approachOf({ dx: 0, dy: 1 }, e, { x: 7, y: 5 })).toBe('side');
        expect(approachOf({ dx: 1, dy: 0 }, e, { x: 3, y: 5 })).toBe('behind');
        expect(faceFromStep({ x: 1, y: 1 }, { x: 0, y: 1 })).toEqual({ dx: -1, dy: 0 });
    });
});

describe('préparation', () => {
    test('de face : rien', () => expect(buildPrep({ approach: 'front' }).tags).toEqual([]));
    test('embuscade : +1 PA et premier tour', () => {
        const p = buildPrep({ approach: 'behind' });
        expect(p.playerBonusPA).toBe(1);
        expect(p.playerFirst).toBe(true);
    });
    test('alerté annule l\'embuscade', () => {
        const p = buildPrep({ approach: 'behind', alerted: true });
        expect(p.playerBonusPA).toBe(0);
        expect(p.enemyFirst).toBe(true);
        expect(p.enemyBonusPA).toBe(1);
    });
    test('piège > herbes ; belvédère ; faiblesse', () => {
        expect(buildPrep({ enemyOnTrap: true, enemyOnGrass: true }).enemyStatus).toEqual({ poisoned: 3 });
        expect(buildPrep({ enemyOnGrass: true }).enemyStatus).toEqual({ confused: 2 });
        expect(buildPrep({ onOutlook: true }).boardBoost.count).toBe(5);
        expect(buildPrep({ observed: true }).weaknessRevealed).toBe(true);
    });
    test('dégâts de faiblesse', () => {
        expect(weaknessDamage(8, 'red', 'red', true)).toBe(10);
        expect(weaknessDamage(8, 'blue', 'red', true)).toBe(8);
        expect(weaknessDamage(8, 'red', 'red', false)).toBe(8);
    });
    test('observation : immobile assez longtemps, à portée', () => {
        const list = [{ id: 'a', x: 8, y: 5, aggro: 2 }, { id: 'b', x: 20, y: 5, aggro: 2 }];
        expect(observationTarget(OBSERVE_MS - 1, { x: 5, y: 5 }, list)).toBeNull();
        expect(observationTarget(OBSERVE_MS, { x: 5, y: 5 }, list)).toBe('a');
        expect(observationTarget(OBSERVE_MS, { x: 5, y: 5 }, list, { a: true })).toBeNull();
    });
    test('spotAt et boost de plateau', () => {
        expect(spotAt([{ x: 1, y: 2, kind: 'bell' }], 1, 2, 'bell')).not.toBeNull();
        expect(spotAt([{ x: 1, y: 2, kind: 'bell' }], 1, 2, 'trap')).toBeNull();
        const tiles = Array(64).fill('red');
        expect(applyBoardBoost(tiles, 'blue', 5, () => 0).length).toBe(5);
        expect(tiles.filter(t => t === 'blue').length).toBe(5);
    });
});

describe('biomes', () => {
    test('biome de carte → règle', () => {
        expect(ruleForBiome('bamboo')).toBe('bamboo');
        expect(ruleForBiome('paddy')).toBe('swamp');
        expect(ruleForBiome('gobi')).toBeNull();
    });
    test('bambous : une case bloquée tous les 3 tours, permanente', () => {
        const st = createBiomeState(); const rule = BIOME_RULES.bamboo;
        advanceBiome(st, rule, 8, () => 0); advanceBiome(st, rule, 8, () => 0);
        expect(Object.keys(st.cells)).toHaveLength(0);
        const r = advanceBiome(st, rule, 8, () => 0);
        expect(r.spawned).toEqual([0]);
        expect(isBlockedCell(st, 0, rule)).toBe(true);
    });
    test('neige : la glace fond après 2 tours', () => {
        const st = createBiomeState(); const rule = BIOME_RULES.snow;
        advanceBiome(st, rule, 8, () => 0); advanceBiome(st, rule, 8, () => 0);   // gèle au 2e tour (ttl 2)
        expect(st.cells[0]).toBeDefined();
        advanceBiome(st, rule, 8, () => 0);
        const r = advanceBiome(st, rule, 8, () => 0.5);
        expect(r.expired).toContain(0);
    });
    test('volcan : match sur case brûlante blesse l\'ennemi ; brûlure du héros', () => {
        const st = createBiomeState(); const rule = BIOME_RULES.volcano;
        st.cells[3] = { kind: 'lava', ttl: 3 }; st.cells[9] = { kind: 'lava', ttl: 3 };
        expect(burnDamage(st, rule)).toBe(6);
        const res = resolveBiomeMatch(st, rule, [2, 3, 4]);
        expect(res.damage).toBe(6);
        expect(res.cleared).toEqual([3]);
        expect(st.cells[3]).toBeUndefined();
    });
    test('marais −1 mana, sanctuaire +2 mana', () => {
        const mud = createBiomeState(); mud.cells[1] = { kind: 'mud', ttl: 4 };
        expect(resolveBiomeMatch(mud, BIOME_RULES.swamp, [0, 1, 2]).manaDelta).toBe(-1);
        const sac = createBiomeState(); sac.cells[1] = { kind: 'sacred', ttl: 4 };
        expect(resolveBiomeMatch(sac, BIOME_RULES.sanctuary, [0, 1, 2]).manaDelta).toBe(2);
    });
    test('mer : rangée glissante', () => {
        const t = ['a', 'b', 'c', 'd']; driftRow(t, 0, 4);
        expect(t).toEqual(['d', 'a', 'b', 'c']);
        const st = createBiomeState();
        expect(advanceBiome(st, BIOME_RULES.sea, 4, () => 0).drifted).toBe(0);
    });
});

describe('intégration exploration', () => {
    let X;
    beforeAll(async () => { X = await import('../../exploration.js'); });

    const sessionOnWild = () => {
        const s = X.createSession(null);
        const id = Object.keys(s.screens).find(k => k.endsWith('_wild') && s.screens[k].spots?.some(sp => sp.kind === 'bell'));
        X.enterScreen(s, id, { x: 1, y: 1 });
        return s;
    };

    test('les zones sauvages ont cloches et belvédères', () => {
        const s = sessionOnWild();
        const kinds = new Set(X.currentScreen(s).spots.map(sp => sp.kind));
        expect(kinds.has('bell')).toBe(true);
        expect(kinds.has('outlook')).toBe(true);
    });

    test('encounterFor : embuscade par derrière, de face rien', () => {
        const s = sessionOnWild();
        const def = X.currentScreen(s).enemies.find(e => !e.boss && !e.illusion && !e.arena);
        const st = s.rt.enemies[def.id];
        st.face = { dx: 0, dy: 1 };
        s.data.x = st.x; s.data.y = st.y - 1;
        expect(X.encounterFor(s, def.id, 5).prep.tags).toContain('ambush');
        s.data.y = st.y + 1;
        expect(X.encounterFor(s, def.id, 5).prep.tags).not.toContain('ambush');
    });

    test('cloche : alerte, plus d\'embuscade ; observation après immobilité', () => {
        const s = sessionOnWild();
        const bell = X.currentScreen(s).spots.find(sp => sp.kind === 'bell');
        s.data.x = bell.x - 1; s.data.y = bell.y;
        const res = X.tryMove(s, 1, 0);
        expect(['alert', 'combat']).toContain(res.type);
        const def = X.currentScreen(s).enemies.find(e => !e.boss && !e.illusion && !e.arena);
        const st = s.rt.enemies[def.id];
        s.rt.alerted[def.id] = true;
        s.data.x = st.x; s.data.y = st.y - 1; st.face = { dx: 0, dy: 1 };
        const prep = X.encounterFor(s, def.id, 5).prep;
        expect(prep.tags).toContain('alerted');
        expect(prep.tags).not.toContain('ambush');
    });

    test('observation : événement après 3 s d\'immobilité à portée', () => {
        const s = sessionOnWild();
        const def = X.currentScreen(s).enemies.find(e => !e.boss && !e.illusion && !e.arena && !e.shieldedBy);
        const st = s.rt.enemies[def.id];
        s.data.x = st.x - (def.aggro || 2) - 2; s.data.y = st.y;
        s.rt.grace = 0;
        const ev = X.tick(s, 3100).find(e => e.type === 'observed');
        expect(ev?.enemyId).toBeDefined();
        expect(s.data.observed[ev.enemyId]).toBe(true);
    });
});
