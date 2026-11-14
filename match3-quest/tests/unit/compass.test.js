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
