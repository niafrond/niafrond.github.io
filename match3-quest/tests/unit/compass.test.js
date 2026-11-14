import { createSession, checkAutoQuests, questDirection, questDirections, setTrackedQuest, setCompass, questStatus, solvePuzzle, enterScreen } from '../../exploration.js';
import { questTargets } from '../../explorationGuide.js';
import { PUZZLE_SETS, puzzlesOfSet } from '../../puzzle/levels.js';
import { COMPASS_PRICE, MERCHANT_IDS, merchantStock, availableOffers, buyOffer } from '../../merchants.js';

describe('Boussole des destins', () => {
    test('vendue 150000 par chaque marchand, une seule fois', () => {
        expect(COMPASS_PRICE).toBe(150000);
        MERCHANT_IDS.forEach(id => expect(merchantStock(id).find(o => o.kind === 'compass')).toMatchObject({ price: 150000, key: 'compass:compass' }));
        const hero = { gold: 200000, inventory: [] };
        expect(buyOffer(MERCHANT_IDS[0], 'compass:compass', hero)).toMatchObject({ ok: true });
        expect(hero).toMatchObject({ compass: true, gold: 50000 });
        MERCHANT_IDS.forEach(id => expect(availableOffers(id, hero).some(o => o.kind === 'compass')).toBe(false));
        expect(buyOffer(MERCHANT_IDS[1], 'compass:compass', hero).ok).toBe(false);
    });

    test('armure antique : sans boussole aucune cible, avec elle la direction mène à l\'énigme suivante', () => {
        const s = createSession({});
        const set = Object.keys(PUZZLE_SETS)[0];
        const [first] = puzzlesOfSet(set);
        solvePuzzle(s, first);
        checkAutoQuests(s);
        const quest = s.quests.find(q => q.id === `sq_armure_${set}`);
        expect(questStatus(s, quest)).toBe('active');
        setCompass(s, false);
        expect(questTargets(s, quest)).toEqual([]);
        setCompass(s, true);
        const targets = questTargets(s, quest);
        expect(targets).toHaveLength(puzzlesOfSet(set).length - 1);   // une cible par pièce manquante
        const target = targets[0];
        expect(target).toMatchObject({ kind: 'chest' });
        expect(s.screens[target.screenId].chests.find(c => c.id === target.id).puzzle).not.toBe(first);
        enterScreen(s, target.screenId, s.screens[target.screenId].spawn);
        setTrackedQuest(s, quest.id);
        expect(questDirection(s)).toMatchObject({ kind: 'target' });
        const dirs = questDirections(s);
        expect(dirs.length).toBeGreaterThanOrEqual(1);
        expect(dirs.length).toBeLessThanOrEqual(4);
    });
});

describe('Pierre de voyage conseillée', () => {
    test('la pierre activée la plus proche de la cible de la quête suivie est recommandée', async () => {
        const { activateWaypoint, travelAdvice, talkToNpc, setTrackedQuest: track, START_SCREEN } = await import('../../exploration.js');
        const { routeLength } = await import('../../explorationGuide.js');
        const s = createSession({});
        s.data.quests.q_sun_1 = 'active';
        track(s, 'q_sun_1');
        expect(travelAdvice(s)).toBeNull();   // aucune pierre activée
        const stones = Object.values(s.screens).filter(sc => sc.waypoint);
        stones.forEach(sc => activateWaypoint(s, sc.id));
        const target0 = Object.values(s.screens).find(sc => sc.enemies.some(e => e.id === 'sun_1'));
        const far = stones.map(sc => ({ sc, d: routeLength(s, sc.id, target0.id) })).filter(x => x.d !== null).sort((a, b) => b.d - a.d)[0].sc;
        s.data.screenId = far.id;
        expect(travelAdvice(s)).not.toBeNull();
        s.data.screenId = START_SCREEN;
        const advice = travelAdvice(s);
        if (advice) {
            expect(s.data.waypoints).toContain(advice.screenId);
            const target = Object.values(s.screens).find(sc => sc.enemies.some(e => e.id === 'sun_1'));
            expect(routeLength(s, advice.screenId, target.id)).toBe(advice.distance);
            expect(advice.distance).toBeLessThan(routeLength(s, START_SCREEN, target.id));
            stones.forEach(sc => { const d = routeLength(s, sc.id, target.id); if (d !== null) expect(d).toBeGreaterThanOrEqual(advice.distance); });
        }
    });
});
